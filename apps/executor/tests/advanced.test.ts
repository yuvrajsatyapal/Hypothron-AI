import { expect, test } from "vitest";
import { validatePlan, compileSQL } from "../src/contracts";
const base = {
  version: 2,
  kind: "revenue_sum",
  datasetHash: "a".repeat(64),
  amountColumn: "revenue",
  dateColumn: "completed_at",
  start: "2025-07-01T00:00:00Z",
  end: "2025-10-01T00:00:00Z",
  timezone: "UTC",
  currency: "EUR",
  nullPolicy: "exclude",
  grainKeys: ["order_id"],
  relationship: null,
};
test("v2 accepts exact euro, yen and declared immutable grain", () => {
  expect(validatePlan(base)).toEqual(base);
  expect(compileSQL(validatePlan({ ...base, currency: "JPY" }))).toContain(
    "DECIMAL(18,0)",
  );
});
test.each([
  { ...base, timezone: "Europe/London" },
  { ...base, grainKeys: [] },
  { ...base, grainKeys: ["order_id", "order_id"] },
  { ...base, currency: "BTC" },
  { ...base, timezone: "+14:01" },
])("unsupported semantics fail closed %j", (p) =>
  expect(() => validatePlan(p)).toThrow(),
);
test("fixed offset period compiles explicitly", () => {
  const p = validatePlan({
    ...base,
    timezone: "+05:30",
    start: "2025-07-01T00:00:00+05:30",
    end: "2025-10-01T00:00:00+05:30",
  });
  expect(compileSQL(p)).toContain("TIMESTAMPTZ '2025-07-01T00:00:00+05:30'");
});
test("join binds original snapshots and uses only fixed left join", () => {
  const p = validatePlan({
    ...base,
    relationship: {
      datasetHash: "b".repeat(64),
      keyColumn: "customer_id",
      lookupKeyColumn: "id",
      cardinality: "many_to_one",
      populationCount: 5,
    },
  });
  expect(compileSQL(p)).toContain("LEFT JOIN lookup");
  expect(() =>
    validatePlan({
      ...p,
      relationship: { ...p.relationship!, lookupKeyColumn: "id;COPY" },
    }),
  ).toThrow();
});

test.each([
  { ...base, currency: ["USD"] },
  { ...base, timezone: ["UTC"] },
  { ...base, start: "2025-02-30T00:00:00Z" },
  { ...base, start: "2025-07-01T00:00:00+00:00" },
  {
    ...base,
    relationship: {
      datasetHash: "b".repeat(64),
      keyColumn: "id",
      lookupKeyColumn: "id",
      cardinality: ["many_to_one"],
      populationCount: 1,
    },
  },
])("v2 rejects coerced semantics and invalid calendar %j", (p) =>
  expect(() => validatePlan(p)).toThrow(),
);

test("v2 result binds approved semantics and diagnostic population", async () => {
  const { validateExecutionResult, pythonSource } = await import(
    "../src/contracts"
  );
  const p = validatePlan(base);
  const d = {
    populationRows: 3,
    periodRows: 3,
    nullAmounts: 1,
    grainUniqueRows: 3,
    joinUniqueRows: 3,
  };
  const result = {
    datasetHash: p.datasetHash,
    sql: { minorUnits: "1007", count: 2 },
    python: { minorUnits: "1007", count: 2 },
    schema: ["order_id", "revenue", "completed_at"],
    rows: 3,
    runtime: {
      duckdb: "v1.4.3",
      pyodide: "0.29.3",
      pandas: "2.3.3",
      numpy: "2.2.5",
    },
    sqlSource: compileSQL(p),
    pythonSource: pythonSource(p),
    elapsedMs: 1,
    memory: { pandasDataframeBytes: 1000, duckdbTrackedBytes: 1000 },
    diagnostics: { contract: p, sql: d, python: d },
  };
  expect(validateExecutionResult(result, p)).toEqual(result);
  expect(() =>
    validateExecutionResult(
      {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          contract: { ...p, currency: "JPY" },
        },
      },
      p,
    ),
  ).toThrow();
  expect(() =>
    validateExecutionResult(
      {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          python: { ...d, nullAmounts: 0 },
        },
      },
      p,
    ),
  ).toThrow();
  expect(() =>
    validateExecutionResult(
      {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          sql: { ...d, privateKeys: ["raw"] },
        },
      },
      p,
    ),
  ).toThrow();
});

test("an empty result contradicts a populated engine rather than erasing conflict", async () => {
  const { verification } = await import("../src/contracts");
  expect(
    verification(
      { minorUnits: null, count: 0 },
      { minorUnits: "1007", count: 2 },
    ),
  ).toEqual({ state: "DISPUTED", provenance: "CLIENT_REPORTED" });
});
