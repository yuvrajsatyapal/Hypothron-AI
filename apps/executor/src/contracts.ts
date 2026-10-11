export interface MetricPlan {
  version: 1;
  kind: "revenue_sum";
  datasetHash: string;
  amountColumn: string;
  dateColumn: string;
  start: string;
  end: string;
  timezone: "UTC";
  currency: "USD";
  nullPolicy: "exclude" | "error";
}
export interface NumericResult {
  minorUnits: string | null;
  count: number;
}
export interface ExecutionResult {
  datasetHash: string;
  sql: NumericResult;
  python: NumericResult;
  schema: string[];
  rows: number;
  runtime: { duckdb: string; pyodide: string; pandas: string; numpy: string };
  sqlSource: string;
  pythonSource: string;
  elapsedMs: number;
  memory: { pandasDataframeBytes: number; duckdbTrackedBytes: number };
}
const keys = [
  "version",
  "kind",
  "datasetHash",
  "amountColumn",
  "dateColumn",
  "start",
  "end",
  "timezone",
  "currency",
  "nullPolicy",
];
const identifier = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
export function validatePlan(input: unknown): MetricPlan {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("INVALID_PLAN");
  const p = input as Record<string, unknown>;
  if (
    Object.keys(p).length !== keys.length ||
    Object.keys(p).some((k) => !keys.includes(k))
  )
    throw new Error("INVALID_PLAN");
  if (
    p.version !== 1 ||
    p.kind !== "revenue_sum" ||
    p.timezone !== "UTC" ||
    p.currency !== "USD" ||
    (p.nullPolicy !== "exclude" && p.nullPolicy !== "error")
  )
    throw new Error("UNSUPPORTED_OPERATION");
  if (
    typeof p.datasetHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(p.datasetHash)
  )
    throw new Error("INVALID_HASH");
  for (const k of ["amountColumn", "dateColumn"])
    if (typeof p[k] !== "string" || !identifier.test(p[k]))
      throw new Error("INVALID_COLUMN");
  for (const k of ["start", "end"])
    if (
      typeof p[k] !== "string" ||
      !utc.test(p[k]) ||
      !Number.isFinite(Date.parse(p[k])) ||
      new Date(p[k]).toISOString() !== p[k].replace("Z", ".000Z")
    )
      throw new Error("INVALID_PERIOD");
  if (Date.parse(String(p.start)) >= Date.parse(String(p.end)))
    throw new Error("INVALID_PERIOD");
  return p as unknown as MetricPlan;
}
export function compileSQL(plan: MetricPlan): string {
  const p = validatePlan(plan);
  return `SELECT CAST(CAST(SUM(CAST("${p.amountColumn}" AS DECIMAL(18,2))) * 100 AS BIGINT) AS VARCHAR) AS minor_units, COUNT("${p.amountColumn}") AS n FROM orders WHERE CAST("${p.dateColumn}" AS TIMESTAMPTZ) >= TIMESTAMPTZ '${p.start}' AND CAST("${p.dateColumn}" AS TIMESTAMPTZ) < TIMESTAMPTZ '${p.end}'`;
}
export function verification(
  left: NumericResult,
  right: NumericResult,
): {
  state: "VERIFIED" | "DISPUTED" | "INCONCLUSIVE";
  provenance: "CLIENT_REPORTED";
} {
  validateNumeric(left);
  validateNumeric(right);
  const state =
    left.minorUnits === null || right.minorUnits === null
      ? "INCONCLUSIVE"
      : left.minorUnits === right.minorUnits && left.count === right.count
        ? "VERIFIED"
        : "DISPUTED";
  return { state, provenance: "CLIENT_REPORTED" };
}
export async function contentHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export const PYTHON_SOURCE = `
import io, json, re
from decimal import Decimal
import pandas as pd
import numpy as np
p = json.loads(plan_json)
df = pd.read_csv(io.StringIO(csv_text), dtype=str, keep_default_na=False)
if p['amountColumn'] not in df or p['dateColumn'] not in df:
    raise ValueError('MISSING_COLUMN')
amounts = df[p['amountColumn']]
if not amounts.map(lambda x: x == '' or re.fullmatch(r'-?[0-9]{1,15}(\\.[0-9]{1,2})?', x) is not None).all():
    raise ValueError('INVALID_DECIMAL')
if not df[p['dateColumn']].map(lambda x: re.fullmatch(r'\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z', x) is not None).all():
    raise ValueError('INVALID_DATE')
dates = pd.to_datetime(df[p['dateColumn']], utc=True, format='%Y-%m-%dT%H:%M:%SZ', errors='raise')
if p['nullPolicy'] == 'error' and (amounts == '').any():
    raise ValueError('NULL_AMOUNT')
selected = amounts[(dates >= pd.Timestamp(p['start'])) & (dates < pd.Timestamp(p['end'])) & (amounts != '')]
minor = [int(Decimal(value) * 100) for value in selected]
json.dumps({'minorUnits': str(sum(minor)) if minor else None, 'count': int(np.count_nonzero(np.ones(len(minor), dtype=bool))), 'pandas':pd.__version__, 'numpy':np.__version__, 'dataframeBytes':int(df.memory_usage(deep=True).sum())})
`;

function exactObject(
  value: unknown,
  expected: string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_RESULT");
  const object = value as Record<string, unknown>;
  if (
    Object.keys(object).length !== expected.length ||
    Object.keys(object).some((key) => !expected.includes(key))
  )
    throw new Error("INVALID_RESULT");
  return object;
}
export function validateNumeric(value: unknown): NumericResult {
  const r = exactObject(value, ["minorUnits", "count"]);
  if (
    r.minorUnits !== null &&
    (typeof r.minorUnits !== "string" ||
      !/^(0|-?[1-9][0-9]{0,30})$/.test(r.minorUnits))
  )
    throw new Error("INVALID_RESULT");
  if (
    typeof r.count !== "number" ||
    !Number.isSafeInteger(r.count) ||
    r.count < 0 ||
    r.count > 100000 ||
    (r.minorUnits === null && r.count !== 0) ||
    (r.minorUnits !== null && r.count === 0)
  )
    throw new Error("INVALID_RESULT");
  return r as unknown as NumericResult;
}
export function validateExecutionResult(
  value: unknown,
  plan: MetricPlan,
): ExecutionResult {
  const r = exactObject(value, [
    "datasetHash",
    "sql",
    "python",
    "schema",
    "rows",
    "runtime",
    "sqlSource",
    "pythonSource",
    "elapsedMs",
    "memory",
  ]);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 256 * 1024)
    throw new Error("OUTPUT_LIMIT");
  if (
    r.datasetHash !== plan.datasetHash ||
    r.sqlSource !== compileSQL(plan) ||
    r.pythonSource !== PYTHON_SOURCE
  )
    throw new Error("INVALID_RESULT");
  const sql = validateNumeric(r.sql),
    python = validateNumeric(r.python);
  if (
    typeof r.rows !== "number" ||
    !Number.isSafeInteger(r.rows) ||
    r.rows < 0 ||
    r.rows > 100000 ||
    Math.max(sql.count, python.count) > r.rows
  )
    throw new Error("INVALID_RESULT");
  if (
    !Array.isArray(r.schema) ||
    r.schema.length < 1 ||
    r.schema.length > 128 ||
    r.schema.some(
      (x) => typeof x !== "string" || x.length < 1 || x.length > 64,
    ) ||
    new Set(r.schema).size !== r.schema.length ||
    !r.schema.includes(plan.amountColumn) ||
    !r.schema.includes(plan.dateColumn)
  )
    throw new Error("INVALID_RESULT");
  const memory = exactObject(r.memory, [
    "pandasDataframeBytes",
    "duckdbTrackedBytes",
  ]);
  if (
    Object.values(memory).some(
      (v) =>
        typeof v !== "number" ||
        !Number.isSafeInteger(v) ||
        v < 0 ||
        v > 128 * 1024 * 1024,
    )
  )
    throw new Error("EXPANDED_INPUT_LIMIT");
  const runtime = exactObject(r.runtime, [
    "duckdb",
    "pyodide",
    "pandas",
    "numpy",
  ]);
  if (
    Object.values(runtime).some(
      (v) => typeof v !== "string" || !/^v?[0-9]+\.[0-9]+\.[0-9]+$/.test(v),
    )
  )
    throw new Error("INVALID_RESULT");
  if (
    typeof r.elapsedMs !== "number" ||
    !Number.isFinite(r.elapsedMs) ||
    r.elapsedMs < 0 ||
    r.elapsedMs > 35000
  )
    throw new Error("INVALID_RESULT");
  return r as unknown as ExecutionResult;
}
export function replayMatches(
  previous: ExecutionResult,
  current: ExecutionResult,
): boolean {
  if (
    previous.datasetHash !== current.datasetHash ||
    JSON.stringify(previous.runtime) !== JSON.stringify(current.runtime)
  )
    throw new Error("REPLAY_RUNTIME_OR_SNAPSHOT_MISMATCH");
  return (
    JSON.stringify(previous.sql) === JSON.stringify(current.sql) &&
    JSON.stringify(previous.python) === JSON.stringify(current.python)
  );
}
/** Conservative ingestion bound, not a portable hard JS/WASM heap cap. */
export function preflightCSV(bytes: Uint8Array): string {
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024)
    throw new Error("INPUT_LIMIT");
  const csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let cells = 1,
    lines = 1;
  for (const char of csv) {
    if (char === "," || char === "\n") cells++;
    if (char === "\n") lines++;
  }
  // Quoted delimiters deliberately over-count; bound both engine materializations.
  if (
    lines > 100001 + (csv.endsWith("\n") ? 1 : 0) ||
    csv.length * 4 + cells * 192 > 128 * 1024 * 1024
  )
    throw new Error("EXPANDED_INPUT_LIMIT");
  return csv;
}
