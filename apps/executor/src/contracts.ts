export interface MetricPlan {
  version: 1 | 2;
  kind: "revenue_sum";
  datasetHash: string;
  amountColumn: string;
  dateColumn: string;
  start: string;
  end: string;
  timezone: string;
  currency: "USD" | "EUR" | "JPY";
  grainKeys?: string[];
  relationship?: {
    datasetHash: string;
    keyColumn: string;
    lookupKeyColumn: string;
    cardinality: "one_to_one" | "many_to_one";
    populationCount: number;
  } | null;
  nullPolicy: "exclude" | "error";
}
export interface NumericResult {
  minorUnits: string | null;
  count: number;
}
export interface EngineDiagnostics {
  populationRows: number;
  periodRows: number;
  nullAmounts: number;
  grainUniqueRows: number;
  joinUniqueRows: number;
}
export interface ExecutionResult {
  diagnostics?: {
    contract: MetricPlan;
    sql: EngineDiagnostics;
    python: EngineDiagnostics;
  };
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
    Object.keys(p).length !== keys.length + (p.version === 2 ? 2 : 0) ||
    Object.keys(p).some(
      (k) =>
        ![
          ...keys,
          ...(p.version === 2 ? ["grainKeys", "relationship"] : []),
        ].includes(k),
    )
  )
    throw new Error("INVALID_PLAN");
  if (
    (p.version !== 1 && p.version !== 2) ||
    p.kind !== "revenue_sum" ||
    (p.version === 1 && (p.timezone !== "UTC" || p.currency !== "USD")) ||
    (p.version === 2 &&
      (typeof p.currency !== "string" ||
        !["USD", "EUR", "JPY"].includes(p.currency) ||
        !validTimezone(p.timezone))) ||
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
  if (p.version === 2) {
    if (
      !Array.isArray(p.grainKeys) ||
      p.grainKeys.length < 1 ||
      p.grainKeys.length > 4 ||
      new Set(p.grainKeys).size !== p.grainKeys.length ||
      p.grainKeys.some((k) => typeof k !== "string" || !identifier.test(k))
    )
      throw new Error("INVALID_GRAIN");
    if (p.relationship !== null) {
      const r = exactObject(p.relationship, [
        "datasetHash",
        "keyColumn",
        "lookupKeyColumn",
        "cardinality",
        "populationCount",
      ]);
      if (
        typeof r.datasetHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(r.datasetHash) ||
        typeof r.cardinality !== "string" ||
        !["one_to_one", "many_to_one"].includes(r.cardinality) ||
        typeof r.populationCount !== "number" ||
        !Number.isSafeInteger(r.populationCount) ||
        r.populationCount < 0 ||
        r.populationCount > 100000
      )
        throw new Error("INVALID_RELATIONSHIP");
      for (const k of ["keyColumn", "lookupKeyColumn"])
        if (typeof r[k] !== "string" || !identifier.test(r[k]))
          throw new Error("INVALID_COLUMN");
    }
  }
  const suffix = p.timezone === "UTC" ? "Z" : String(p.timezone);
  const datePattern = new RegExp(
    "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}" +
      suffix.replace("+", "\\+") +
      "$",
  );
  for (const k of ["start", "end"])
    if (
      typeof p[k] !== "string" ||
      !(p.version === 1 ? utc : datePattern).test(p[k]) ||
      !Number.isFinite(Date.parse(p[k])) ||
      !validDate(p[k])
    )
      throw new Error("INVALID_PERIOD");
  if (Date.parse(String(p.start)) >= Date.parse(String(p.end)))
    throw new Error("INVALID_PERIOD");
  return p as unknown as MetricPlan;
}
function validTimezone(v: unknown): boolean {
  return (
    v === "UTC" ||
    (typeof v === "string" && /^[+-](0[0-9]|1[0-3]):[0-5][0-9]$/.test(v)) ||
    v === "+14:00" ||
    v === "-14:00"
  );
}
function validDate(v: string): boolean {
  const local = v.slice(0, 19) + "Z";
  return (
    Number.isFinite(Date.parse(local)) &&
    new Date(local).toISOString() === local.replace("Z", ".000Z")
  );
}
export function currencyScale(p: MetricPlan): number {
  return p.currency === "JPY" ? 0 : 2;
}
export function canonicalPlan(p: MetricPlan): string {
  const validated = validatePlan(p);
  const out: Record<string, unknown> = {};
  for (const k of keys)
    out[k] = (validated as unknown as Record<string, unknown>)[k];
  if (p.version === 2) {
    out.grainKeys = [...p.grainKeys!];
    out.relationship = p.relationship
      ? {
          datasetHash: p.relationship.datasetHash,
          keyColumn: p.relationship.keyColumn,
          lookupKeyColumn: p.relationship.lookupKeyColumn,
          cardinality: p.relationship.cardinality,
          populationCount: p.relationship.populationCount,
        }
      : null;
  }
  return JSON.stringify(out);
}
export function compileSQL(plan: MetricPlan): string {
  const p = validatePlan(plan);
  if (p.version === 2) {
    const scale = currencyScale(p);
    const from = p.relationship
      ? `orders AS o LEFT JOIN lookup AS l ON o."${p.relationship.keyColumn}" = l."${p.relationship.lookupKeyColumn}"`
      : "orders AS o";
    return `SELECT CAST(CAST(SUM(CAST(o."${p.amountColumn}" AS DECIMAL(18,${scale}))) * ${10 ** scale} AS HUGEINT) AS VARCHAR) AS minor_units, COUNT(o."${p.amountColumn}") AS n FROM ${from} WHERE CAST(o."${p.dateColumn}" AS TIMESTAMPTZ) >= TIMESTAMPTZ '${p.start}' AND CAST(o."${p.dateColumn}" AS TIMESTAMPTZ) < TIMESTAMPTZ '${p.end}'`;
  }
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
    left.count !== right.count
      ? "DISPUTED"
      : left.minorUnits === null || right.minorUnits === null
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
    ...(plan.version === 2 ? ["diagnostics"] : []),
  ]);
  if (new TextEncoder().encode(JSON.stringify(value)).length > 256 * 1024)
    throw new Error("OUTPUT_LIMIT");
  if (
    r.datasetHash !== plan.datasetHash ||
    r.sqlSource !== compileSQL(plan) ||
    r.pythonSource !== pythonSource(plan)
  )
    throw new Error("INVALID_RESULT");
  if (plan.version === 2) {
    const d = exactObject(r.diagnostics, ["contract", "sql", "python"]);
    if (canonicalPlan(validatePlan(d.contract)) !== canonicalPlan(plan))
      throw new Error("INVALID_RESULT");
    for (const engine of [d.sql, d.python]) {
      const x = exactObject(engine, [
        "populationRows",
        "periodRows",
        "nullAmounts",
        "grainUniqueRows",
        "joinUniqueRows",
      ]);
      if (
        Object.values(x).some(
          (v) =>
            typeof v !== "number" ||
            !Number.isSafeInteger(v) ||
            v < 0 ||
            v > 100000,
        )
      )
        throw new Error("INVALID_RESULT");
      const numbers = x as unknown as EngineDiagnostics;
      if (
        numbers.populationRows !== r.rows ||
        numbers.periodRows > numbers.populationRows ||
        numbers.nullAmounts > numbers.periodRows ||
        (plan.nullPolicy === "error" && numbers.nullAmounts !== 0) ||
        numbers.grainUniqueRows > numbers.populationRows ||
        numbers.joinUniqueRows > numbers.populationRows
      )
        throw new Error("INVALID_RESULT");
    }
  }
  const sql = validateNumeric(r.sql),
    python = validateNumeric(r.python);
  if (plan.version === 2) {
    const d = r.diagnostics as ExecutionResult["diagnostics"];
    if (
      d!.sql.periodRows - d!.sql.nullAmounts !== sql.count ||
      d!.python.periodRows - d!.python.nullAmounts !== python.count
    )
      throw new Error("INVALID_RESULT");
  }
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
    !r.schema.includes(plan.dateColumn) ||
    (plan.version === 2 &&
      !plan.grainKeys!.every((k) => (r.schema as unknown[]).includes(k))) ||
    (plan.version === 2 &&
      plan.relationship !== null &&
      !(r.schema as unknown[]).includes(plan.relationship!.keyColumn))
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
    JSON.stringify(previous.python) === JSON.stringify(current.python) &&
    JSON.stringify(previous.diagnostics) ===
      JSON.stringify(current.diagnostics) &&
    previous.sqlSource === current.sqlSource &&
    previous.pythonSource === current.pythonSource
  );
}
/** Conservative ingestion bound, not a portable hard JS/WASM heap cap. */
export function csvExpansionEstimate(csv: string): number {
  let cells = 1;
  for (const char of csv) if (char === "," || char === "\n") cells++;
  return csv.length * 4 + cells * 192;
}
export function preflightCSV(bytes: Uint8Array): string {
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024)
    throw new Error("INPUT_LIMIT");
  const csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let lines = 1;
  for (const char of csv) {
    if (char === "\n") lines++;
  }
  // Quoted delimiters deliberately over-count; bound both engine materializations.
  if (
    lines > 100001 + (csv.endsWith("\n") ? 1 : 0) ||
    csvExpansionEstimate(csv) > 128 * 1024 * 1024
  )
    throw new Error("EXPANDED_INPUT_LIMIT");
  return csv;
}

export function pythonSource(plan: MetricPlan): string {
  return plan.version === 1 ? PYTHON_SOURCE : PYTHON_V2_SOURCE;
}
export const PYTHON_V2_SOURCE = `
import io, json, re
from decimal import Decimal
import pandas as pd
import numpy as np
p=json.loads(plan_json)
df=pd.read_csv(io.StringIO(csv_text),dtype=str,keep_default_na=False)
scale=0 if p['currency']=='JPY' else 2
cols=[p['amountColumn'],p['dateColumn']]+p['grainKeys']
if any(c not in df for c in cols): raise ValueError('MISSING_COLUMN')
amounts=df[p['amountColumn']]
pattern=r'-?[0-9]{1,15}' + (r'(\\.[0-9]{1,2})?' if scale else '')
if not amounts.map(lambda x: x=='' or re.fullmatch(pattern,x) is not None).all(): raise ValueError('INVALID_DATA')
suffix='Z' if p['timezone']=='UTC' else p['timezone']
if not df[p['dateColumn']].map(lambda x: re.fullmatch(r'\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}'+re.escape(suffix),x) is not None).all(): raise ValueError('INVALID_DATA')
dates=pd.to_datetime(df[p['dateColumn']],utc=True,format='%Y-%m-%dT%H:%M:%S%z',errors='raise')
if (df[p['grainKeys']]=='').any().any(): raise ValueError('INVALID_GRAIN')
grain_unique=int(len(df.drop_duplicates(subset=p['grainKeys'])))
if grain_unique!=len(df): raise ValueError('GRAIN_VIOLATION')
join_unique=len(df)
r=p['relationship']
if r is not None:
    lookup=pd.read_csv(io.StringIO(lookup_csv_text),dtype=str,keep_default_na=False)
    if r['keyColumn'] not in df or r['lookupKeyColumn'] not in lookup: raise ValueError('MISSING_COLUMN')
    if len(df)!=r['populationCount']: raise ValueError('POPULATION_MISMATCH')
    if (df[r['keyColumn']]=='').any() or (lookup[r['lookupKeyColumn']]=='').any(): raise ValueError('JOIN_CARDINALITY')
    if lookup[r['lookupKeyColumn']].duplicated().any(): raise ValueError('JOIN_CARDINALITY')
    if r['cardinality']=='one_to_one' and df[r['keyColumn']].duplicated().any(): raise ValueError('JOIN_CARDINALITY')
    lookup_temp='__lookup_key'
    while lookup_temp in df.columns: lookup_temp+='_'
    merged=df.merge(lookup[[r['lookupKeyColumn']]].rename(columns={r['lookupKeyColumn']:lookup_temp}),left_on=r['keyColumn'],right_on=lookup_temp,how='left',validate='one_to_one' if r['cardinality']=='one_to_one' else 'many_to_one')
    if len(merged)!=len(df) or merged[lookup_temp].isna().any(): raise ValueError('JOIN_CARDINALITY')
    join_unique=int(len(merged.drop_duplicates(subset=p['grainKeys'])))
if p['nullPolicy']=='error' and (amounts=='').any(): raise ValueError('NULL_AMOUNT')
period=(dates>=pd.Timestamp(p['start'])) & (dates<pd.Timestamp(p['end']))
selected=amounts[period & (amounts!='')]
minor=[int(Decimal(v)*(10**scale)) for v in selected]
diagnostics={'populationRows':int(len(df)),'periodRows':int(period.sum()),'nullAmounts':int((period & (amounts=='')).sum()),'grainUniqueRows':grain_unique,'joinUniqueRows':join_unique}
json.dumps({'minorUnits':str(sum(minor)) if minor else None,'count':len(minor),'diagnostics':diagnostics,'pandas':pd.__version__,'numpy':np.__version__,'dataframeBytes':int(df.memory_usage(deep=True).sum()) + (int(lookup.memory_usage(deep=True).sum()) if r is not None else 0)})
`;
