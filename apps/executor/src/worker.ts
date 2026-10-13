import { convertParquet, parquetEnvelope } from "./ingestion";
import { sqlDiagnostics } from "./advanced";
import { loadPyodide } from "pyodide";
import { installAssetReader } from "./assets";
import * as duckdb from "@duckdb/duckdb-wasm";
import type { PyodideInterface } from "pyodide";
import {
  compileSQL,
  contentHash,
  pythonSource,
  validatePlan,
  preflightCSV,
  csvExpansionEstimate,
  validateExecutionResult,
  type NumericResult,
  type EngineDiagnostics,
  type ExecutionResult,
} from "./contracts";
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<unknown>) => {
  let stage = "VALIDATION";
  let activeDB: duckdb.AsyncDuckDB | null = null;
  let activeConnection: duckdb.AsyncDuckDBConnection | null = null;
  let nestedWorker: Worker | null = null;
  try {
    const request = event.data as {
      mode?: unknown;
      id?: unknown;
      plan?: unknown;
      bytes?: unknown;
      lookupBytes?: unknown;
      approvedRelationship?: unknown;
      assets?: Record<string, ArrayBuffer>;
    };
    if (
      typeof request.id !== "string" ||
      !(request.bytes instanceof Uint8Array) ||
      request.bytes.byteLength > 10 * 1024 * 1024
    )
      throw new Error("INVALID_JOB");
    if (!request.assets) throw new Error("INVALID_JOB");
    installAssetReader(request.assets);
    if (request.mode === "PARQUET") {
      parquetEnvelope(request.bytes);
      nestedWorker = new Worker("/duckdb-worker.js");
      const wasm = request.assets["duckdb-eh.wasm"],
        extension = request.assets["parquet.duckdb_extension.wasm"];
      nestedWorker.postMessage(
        {
          type: "ASSET_BOOTSTRAP",
          assets: {
            "duckdb-eh.wasm": wasm,
            "parquet.duckdb_extension.wasm": extension,
          },
        },
        [wasm, extension],
      );
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), nestedWorker);
      activeDB = db;
      stage = "PARQUET_LOAD";
      await db.instantiate("/assets/duckdb-eh.wasm");
      await db.open({ query: { castBigIntToDouble: false } });
      const conn = await db.connect();
      activeConnection = conn;
      await conn.query("SET autoinstall_known_extensions=false");
      await conn.query("SET autoload_known_extensions=false");
      await conn.query(
        "SET custom_extension_repository='http://127.0.0.1:3001/assets'",
      );
      await conn.query("LOAD parquet");
      await db.registerFileBuffer(
        "source.parquet",
        new Uint8Array(request.bytes),
      );
      stage = "PARQUET_CONVERSION";
      const result = await convertParquet(
        conn as unknown as Parameters<typeof convertParquet>[0],
        request.bytes,
      );
      scope.postMessage({ id: request.id, ok: true, result }, [
        result.bytes.buffer,
      ]);
      return;
    }
    const plan = validatePlan(request.plan);
    const bytes = request.bytes;
    const relationship = plan.version === 2 ? plan.relationship : null;
    if (
      relationship &&
      (!(request.lookupBytes instanceof Uint8Array) ||
        request.approvedRelationship !== true)
    )
      throw new Error("RELATIONSHIP_APPROVAL_REQUIRED");
    if (
      !relationship &&
      (request.lookupBytes !== undefined ||
        request.approvedRelationship !== undefined)
    )
      throw new Error("INVALID_JOB");
    let lookupCSV = "";
    if (relationship) {
      const lookupBytes = request.lookupBytes as Uint8Array;
      if ((await contentHash(lookupBytes)) !== relationship.datasetHash)
        throw new Error("DATASET_HASH_MISMATCH");
      if (bytes.length + lookupBytes.length > 10 * 1024 * 1024)
        throw new Error("INPUT_LIMIT");
      lookupCSV = preflightCSV(lookupBytes);
    }
    const started = performance.now();
    if ((await contentHash(bytes)) !== plan.datasetHash)
      throw new Error("DATASET_HASH_MISMATCH");
    const csv = preflightCSV(bytes);
    if (
      csvExpansionEstimate(csv) +
        (relationship ? csvExpansionEstimate(lookupCSV) : 0) >
      128 * 1024 * 1024
    )
      throw new Error("EXPANDED_INPUT_LIMIT");
    nestedWorker = new Worker("/duckdb-worker.js");
    const duckdbBytes = request.assets["duckdb-eh.wasm"];
    nestedWorker.postMessage(
      { type: "ASSET_BOOTSTRAP", assets: { "duckdb-eh.wasm": duckdbBytes } },
      [duckdbBytes],
    );
    delete request.assets["duckdb-eh.wasm"];
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), nestedWorker);
    activeDB = db;
    stage = "DUCKDB_LOAD";
    await db.instantiate("/assets/duckdb-eh.wasm");
    stage = "DUCKDB_OPEN";
    await db.open({ query: { castBigIntToDouble: false } });
    stage = "DATA_REGISTER";
    await db.registerFileBuffer("input.csv", bytes);
    const conn = await db.connect();
    activeConnection = conn;
    // File was explicitly registered in-memory; disable remote extension autoload/install.
    await conn.query("SET autoinstall_known_extensions = false");
    await conn.query("SET autoload_known_extensions = false");
    stage = "CSV_PARSE";
    await conn.query(
      "CREATE TABLE orders AS SELECT * FROM read_csv('input.csv', all_varchar=true, header=true, auto_detect=true)",
    );
    if (relationship) {
      await db.registerFileBuffer(
        "lookup.csv",
        request.lookupBytes as Uint8Array,
      );
      await conn.query(
        "CREATE TABLE lookup AS SELECT * FROM read_csv('lookup.csv', all_varchar=true, header=true, auto_detect=true)",
      );
    }
    await conn.query("SET enable_external_access = false");
    const schema = (await conn.query("DESCRIBE orders"))
      .toArray()
      .map((row) => String(row.column_name));
    if (schema.length > 128 || schema.some((name) => name.length > 64))
      throw new Error("EXPANDED_INPUT_LIMIT");
    if (
      !schema.includes(plan.amountColumn) ||
      !schema.includes(plan.dateColumn)
    )
      throw new Error("MISSING_COLUMN");
    if (
      plan.version === 2 &&
      (!plan.grainKeys!.every((k) => schema.includes(k)) ||
        (relationship && !schema.includes(relationship.keyColumn)))
    )
      throw new Error("MISSING_COLUMN");
    if (relationship) {
      const lookupSchema = (await conn.query("DESCRIBE lookup"))
        .toArray()
        .map((row) => String(row.column_name));
      if (lookupSchema.length > 128 || lookupSchema.some((k) => k.length > 64))
        throw new Error("EXPANDED_INPUT_LIMIT");
      if (!lookupSchema.includes(relationship.lookupKeyColumn))
        throw new Error("MISSING_COLUMN");
    }
    let diagnostics: EngineDiagnostics | undefined;
    if (plan.version === 2)
      diagnostics = await sqlDiagnostics(
        conn as unknown as Parameters<typeof sqlDiagnostics>[0],
        plan,
      );
    if (plan.version === 1) {
      const amount = `"${plan.amountColumn}"`;
      const date = `"${plan.dateColumn}"`;
      const invalid = (
        await conn.query(
          `SELECT COUNT(*) AS n FROM orders WHERE (${amount} IS NOT NULL AND NOT regexp_full_match(${amount}, '-?[0-9]{1,15}(\\.[0-9]{1,2})?')) OR ${date} IS NULL OR NOT regexp_full_match(${date}, '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z')`,
        )
      ).toArray()[0];
      if (!invalid || Number(invalid.n) !== 0) throw new Error("INVALID_DATA");
      if (
        plan.nullPolicy === "error" &&
        Number(
          (
            await conn.query(
              `SELECT COUNT(*) AS n FROM orders WHERE ${amount} IS NULL`,
            )
          ).toArray()[0]?.n,
        ) !== 0
      )
        throw new Error("NULL_AMOUNT");
    }
    const sqlSource = compileSQL(plan);
    const aggregate = (await conn.query(sqlSource)).toArray()[0];
    const sql: NumericResult = {
      minorUnits:
        aggregate?.minor_units == null ? null : String(aggregate.minor_units),
      count: Number(aggregate?.n),
    };
    const rows = Number(
      (await conn.query("SELECT COUNT(*) AS n FROM orders")).toArray()[0]?.n,
    );
    const duckdbTrackedBytes = Number(
      (
        await conn.query(
          "SELECT SUM(memory_usage_bytes) AS bytes FROM duckdb_memory()",
        )
      ).toArray()[0]?.bytes ?? 0,
    );
    const engineVersion = await db.getVersion();
    await conn.close();
    activeConnection = null;
    await db.terminate();
    activeDB = null;
    nestedWorker.terminate();
    nestedWorker = null;
    stage = "PYODIDE_LOAD";
    const py = await loadPyodide({ indexURL: "/assets/" });
    stage = "PYODIDE_PACKAGES";
    await py.loadPackage(["pandas", "numpy"]);
    // Package/runtime initialization finished; discard this job’s compressed asset buffers.
    for (const name of Object.keys(request.assets)) delete request.assets[name];
    py.globals.set("plan_json", JSON.stringify(plan));
    py.globals.set("csv_text", csv);
    if (relationship) py.globals.set("lookup_csv_text", lookupCSV);
    stage = "PYTHON_CALCULATION";
    const pythonRaw = (await py.runPythonAsync(pythonSource(plan))) as string;
    const pythonParsed = JSON.parse(pythonRaw) as NumericResult & {
      pandas: string;
      numpy: string;
      dataframeBytes: number;
      diagnostics?: EngineDiagnostics;
    };
    const result: ExecutionResult = {
      datasetHash: plan.datasetHash,
      sql,
      python: {
        minorUnits: pythonParsed.minorUnits,
        count: pythonParsed.count,
      },
      schema,
      rows,
      runtime: {
        duckdb: engineVersion,
        pyodide: py.version,
        pandas: pythonParsed.pandas,
        numpy: pythonParsed.numpy,
      },
      sqlSource,
      pythonSource: pythonSource(plan),
      elapsedMs: performance.now() - started,
      memory: {
        pandasDataframeBytes: pythonParsed.dataframeBytes,
        duckdbTrackedBytes,
      },
    };
    if (plan.version === 2)
      result.diagnostics = {
        contract: plan,
        sql: diagnostics!,
        python: pythonParsed.diagnostics!,
      };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 256 * 1024)
      throw new Error("OUTPUT_LIMIT");
    validateExecutionResult(result, plan);
    scope.postMessage({ id: request.id, ok: true, result });
  } catch (error) {
    const allowed = [
      "INVALID_PARQUET",
      "UNSUPPORTED_PARQUET_TYPE",
      "UNSUPPORTED_PARQUET_VALUE",
      "INVALID_JOB",
      "INVALID_PLAN",
      "INVALID_HASH",
      "INVALID_PERIOD",
      "INVALID_COLUMN",
      "UNSUPPORTED_OPERATION",
      "DATASET_HASH_MISMATCH",
      "MISSING_COLUMN",
      "INVALID_DATA",
      "NULL_AMOUNT",
      "OUTPUT_LIMIT",
      "INPUT_LIMIT",
      "EXPANDED_INPUT_LIMIT",
      "INVALID_RESULT",
      "INVALID_GRAIN",
      "INVALID_RELATIONSHIP",
      "RELATIONSHIP_APPROVAL_REQUIRED",
      "GRAIN_VIOLATION",
      "JOIN_CARDINALITY",
      "POPULATION_MISMATCH",
    ];
    const code =
      error instanceof Error && allowed.includes(error.message)
        ? error.message
        : "EXECUTION_FAILED";
    scope.postMessage({
      id: (event.data as { id?: unknown })?.id,
      ok: false,
      error: code,
      stage,
    });
  } finally {
    try {
      await activeConnection?.close();
      await activeDB?.terminate();
    } catch {
      /* Parent host still enforces termination. */
    }
    nestedWorker?.terminate();
  }
};
