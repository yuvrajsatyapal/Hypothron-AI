import { contentHash, preflightCSV } from "./contracts";
export const NORMALIZATION = "parquet-csv-v1" as const;
export interface IngestionResult {
  bytes: Uint8Array;
  sourceHash: string;
  datasetHash: string;
  normalization: typeof NORMALIZATION;
  decoder: "duckdb-v1.4.3";
  rows: number;
  schema: { name: string; type: string }[];
}
export function parquetEnvelope(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || bytes.length > 10 * 1024 * 1024)
    throw new Error("INPUT_LIMIT");
  if (
    bytes.length < 12 ||
    new TextDecoder().decode(bytes.slice(0, 4)) !== "PAR1" ||
    new TextDecoder().decode(bytes.slice(-4)) !== "PAR1"
  )
    throw new Error("INVALID_PARQUET");
  const footer = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(bytes.length - 8, true);
  if (footer < 1 || footer > 1024 * 1024 || footer > bytes.length - 12)
    throw new Error("INVALID_PARQUET");
}
export function supportedSchema(schema: IngestionResult["schema"]): void {
  if (!Array.isArray(schema) || schema.length < 1 || schema.length > 128)
    throw new Error("EXPANDED_INPUT_LIMIT");
  const names = new Set<string>();
  for (const c of schema) {
    if (
      !c ||
      Object.keys(c).sort().join() !== "name,type" ||
      typeof c.name !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(c.name) ||
      names.has(c.name.toLowerCase())
    )
      throw new Error("INVALID_COLUMN");
    if (
      typeof c.type !== "string" ||
      !/^(VARCHAR|BOOLEAN|TINYINT|SMALLINT|INTEGER|BIGINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|HUGEINT|UHUGEINT|DECIMAL\([0-9]{1,2},[0-9]{1,2}\))$/.test(
        c.type,
      )
    )
      throw new Error("UNSUPPORTED_PARQUET_TYPE");
    names.add(c.name.toLowerCase());
  }
}
export function validateIngestion(value: unknown): IngestionResult {
  const r = value as IngestionResult;
  if (
    !r ||
    Object.keys(r).sort().join() !==
      "bytes,datasetHash,decoder,normalization,rows,schema,sourceHash" ||
    !(r.bytes instanceof Uint8Array) ||
    !/^[a-f0-9]{64}$/.test(r.sourceHash) ||
    !/^[a-f0-9]{64}$/.test(r.datasetHash) ||
    r.normalization !== NORMALIZATION ||
    r.decoder !== "duckdb-v1.4.3" ||
    !Number.isSafeInteger(r.rows) ||
    r.rows < 0 ||
    r.rows > 100000
  )
    throw new Error("INVALID_RESULT");
  supportedSchema(r.schema);
  preflightCSV(r.bytes);
  return r;
}
interface Connection {
  query(sql: string): Promise<{ toArray(): Array<Record<string, unknown>> }>;
}
/** Fixed SQL only; all scalar values are cast by DuckDB before Arrow can lose decimal precision. */
export async function convertParquet(
  conn: Connection,
  source: Uint8Array,
): Promise<IngestionResult> {
  parquetEnvelope(source);
  const meta = (
    await conn.query(
      "SELECT SUM(total_uncompressed_size) AS bytes, SUM(num_values) AS cells, MAX(row_group_id) AS groups FROM parquet_metadata('source.parquet')",
    )
  ).toArray()[0];
  const rows = Number(
    (
      await conn.query(
        "SELECT num_rows FROM parquet_file_metadata('source.parquet')",
      )
    ).toArray()[0]?.num_rows,
  );
  if (
    !meta ||
    !Number.isSafeInteger(rows) ||
    rows < 0 ||
    rows > 100000 ||
    Number(meta.groups) > 10000 ||
    !Number.isFinite(Number(meta.bytes)) ||
    !Number.isFinite(Number(meta.cells)) ||
    Number(meta.bytes) * 4 + Number(meta.cells) * 192 > 128 * 1024 * 1024
  )
    throw new Error("EXPANDED_INPUT_LIMIT");
  const schema = (
    await conn.query("DESCRIBE SELECT * FROM read_parquet('source.parquet')")
  )
    .toArray()
    .map((c) => ({ name: String(c.column_name), type: String(c.column_type) }));
  supportedSchema(schema);
  const projected = schema
    .map((c) => `CAST("${c.name}" AS VARCHAR) AS "${c.name}"`)
    .join(",");
  const data = (
    await conn.query(`SELECT ${projected} FROM read_parquet('source.parquet')`)
  ).toArray();
  if (data.length !== rows) throw new Error("INVALID_PARQUET");
  const lines = [schema.map((c) => c.name).join(",") + "\n"];
  let length = lines[0].length;
  for (const row of data) {
    const line =
      schema
        .map((c) => {
          const v = row[c.name];
          if (v === null) return "";
          if (typeof v !== "string" || v === "" || /[\x00-\x1f\x7f]/.test(v))
            throw new Error("UNSUPPORTED_PARQUET_VALUE");
          return '"' + v.replaceAll('"', '""') + '"';
        })
        .join(",") + "\n";
    length += new TextEncoder().encode(line).length;
    if (
      length > 10 * 1024 * 1024 ||
      length * 4 + (rows + 1) * schema.length * 192 > 128 * 1024 * 1024
    )
      throw new Error("EXPANDED_INPUT_LIMIT");
    lines.push(line);
  }
  const bytes = new TextEncoder().encode(lines.join(""));
  preflightCSV(bytes);
  return {
    bytes,
    sourceHash: await contentHash(source),
    datasetHash: await contentHash(bytes),
    normalization: NORMALIZATION,
    decoder: "duckdb-v1.4.3",
    rows,
    schema,
  };
}
