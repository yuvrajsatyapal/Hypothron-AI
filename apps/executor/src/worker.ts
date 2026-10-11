import { loadPyodide } from "pyodide";
import { installAssetReader } from "./assets";
import * as duckdb from "@duckdb/duckdb-wasm";
import type { PyodideInterface } from "pyodide";
import {
  compileSQL,
  contentHash,
  PYTHON_SOURCE,
  validatePlan,
  preflightCSV,
  validateExecutionResult,
  type NumericResult,
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
      id?: unknown;
      plan?: unknown;
      bytes?: unknown;
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
    const plan = validatePlan(request.plan);
    const bytes = request.bytes;
    const started = performance.now();
    if ((await contentHash(bytes)) !== plan.datasetHash)
      throw new Error("DATASET_HASH_MISMATCH");
    const csv = preflightCSV(bytes);
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
    stage = "PYTHON_CALCULATION";
    const pythonRaw = (await py.runPythonAsync(PYTHON_SOURCE)) as string;
    const pythonParsed = JSON.parse(pythonRaw) as NumericResult & {
      pandas: string;
      numpy: string;
      dataframeBytes: number;
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
      pythonSource: PYTHON_SOURCE,
      elapsedMs: performance.now() - started,
      memory: {
        pandasDataframeBytes: pythonParsed.dataframeBytes,
        duckdbTrackedBytes,
      },
    };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 256 * 1024)
      throw new Error("OUTPUT_LIMIT");
    validateExecutionResult(result, plan);
    scope.postMessage({ id: request.id, ok: true, result });
  } catch (error) {
    const allowed = [
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
