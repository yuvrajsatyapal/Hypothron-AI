import { beforeAll, expect, test, vi } from "vitest";
vi.setConfig({ testTimeout: 30000 });
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { PyodideInterface } from "pyodide";
import {
  PYTHON_V2_SOURCE,
  validatePlan,
  type MetricPlan,
} from "../src/contracts";
const requireExecutor = createRequire(resolve("apps/executor/package.json"));
let py: PyodideInterface;
beforeAll(async () => {
  const { loadPyodide } = requireExecutor(
    "pyodide",
  ) as typeof import("pyodide");
  py = await loadPyodide({
    indexURL: resolve("apps/executor/public/assets") + "/",
  });
  await py.loadPackage(["pandas", "numpy"]);
}, 30000);
const csv =
  "order_id,customer_id,completed_at,revenue\n1,A,2025-07-01T00:00:00Z,10.10\n2,A,2025-07-02T00:00:00Z,-0.03\n3,B,2025-08-01T00:00:00Z,\n4,B,2025-10-01T00:00:00Z,999.00\n";
const plan = validatePlan({
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
  relationship: {
    datasetHash: "b".repeat(64),
    keyColumn: "customer_id",
    lookupKeyColumn: "id",
    cardinality: "many_to_one",
    populationCount: 4,
  },
});
async function compute(
  text = csv,
  lookup = "id,label\nA,alpha\nB,beta\n",
  p: MetricPlan = plan,
) {
  py.globals.set("csv_text", text);
  py.globals.set("lookup_csv_text", lookup);
  py.globals.set("plan_json", JSON.stringify(p));
  return JSON.parse((await py.runPythonAsync(PYTHON_V2_SOURCE)) as string) as {
    minorUnits: string | null;
    count: number;
    diagnostics: unknown;
  };
}
test("independent Pandas computes approved join and exact decimal without SQL output", async () => {
  const value = await compute();
  expect(value.minorUnits).toBe("1007");
  expect(value.count).toBe(2);
  expect(value.diagnostics).toEqual({
    populationRows: 4,
    periodRows: 3,
    nullAmounts: 1,
    grainUniqueRows: 4,
    joinUniqueRows: 4,
  });
});
test.each([
  ["grain", csv.replace("2,A", "1,A"), "id\nA\nB\n", plan, "GRAIN_VIOLATION"],
  ["lookup duplicate", csv, "id\nA\nA\nB\n", plan, "JOIN_CARDINALITY"],
  ["unmatched", csv, "id\nA\n", plan, "JOIN_CARDINALITY"],
  [
    "one-to-one",
    csv,
    "id\nA\nB\n",
    {
      ...plan,
      relationship: { ...plan.relationship!, cardinality: "one_to_one" },
    },
    "JOIN_CARDINALITY",
  ],
  [
    "population",
    csv,
    "id\nA\nB\n",
    { ...plan, relationship: { ...plan.relationship!, populationCount: 3 } },
    "POPULATION_MISMATCH",
  ],
  [
    "null policy",
    csv,
    "id\nA\nB\n",
    { ...plan, nullPolicy: "error" },
    "NULL_AMOUNT",
  ],
  [
    "date",
    csv.replace("2025-07-02", "2025-02-30"),
    "id\nA\nB\n",
    plan,
    "day is out of range",
  ],
  [
    "fractional JPY",
    csv,
    "id\nA\nB\n",
    { ...plan, currency: "JPY" },
    "INVALID_DATA",
  ],
  [
    "invalid grain",
    csv.replace("2,A", ",A"),
    "id\nA\nB\n",
    plan,
    "INVALID_GRAIN",
  ],
])("Pandas independently rejects %s", async (_name, text, lookup, p, code) => {
  await expect(
    compute(text as string, lookup as string, p as MetricPlan),
  ).rejects.toThrow(code as string);
});

test.each(["__joined", "__lookup_key", "_left_indicator", "_right_indicator"])(
  "Pandas joins preserve user grain columns named %s",
  async (column) => {
    const value = await compute(
      csv.replace("order_id", column),
      "id,label\nA,alpha\nB,beta\n",
      { ...plan, grainKeys: [column] },
    );
    expect(value.minorUnits).toBe("1007");
    expect(value.count).toBe(2);
  },
);
