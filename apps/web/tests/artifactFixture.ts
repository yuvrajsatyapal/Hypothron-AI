import {
  compileSQL,
  pythonSource,
  contentHash,
  type MetricPlan,
  type ExecutionResult,
} from "../../executor/src/contracts";
export async function fixture() {
  const bytes = new TextEncoder().encode(
    "id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n",
  );
  const plan: MetricPlan = {
    version: 1,
    kind: "revenue_sum",
    datasetHash: await contentHash(bytes),
    amountColumn: "revenue",
    dateColumn: "completed_at",
    start: "2025-07-01T00:00:00Z",
    end: "2025-10-01T00:00:00Z",
    timezone: "UTC",
    currency: "USD",
    nullPolicy: "exclude",
  };
  const result: ExecutionResult = {
    datasetHash: plan.datasetHash,
    sql: { minorUnits: "1010", count: 1 },
    python: { minorUnits: "1010", count: 1 },
    schema: ["id", "completed_at", "revenue"],
    rows: 1,
    runtime: {
      duckdb: "v1.4.3",
      pyodide: "0.29.3",
      pandas: "2.3.3",
      numpy: "2.2.5",
    },
    sqlSource: compileSQL(plan),
    pythonSource: pythonSource(plan),
    elapsedMs: 10,
    memory: { pandasDataframeBytes: 20, duckdbTrackedBytes: 30 },
  };
  return {
    id: "local-test",
    question: "Approved revenue",
    createdAt: "2026-10-12T00:00:00Z",
    parentId: null,
    snapshots: [bytes],
    calculations: [
      { id: "job-1", hypothesisId: "H1", dependsOn: [], plan, result },
    ],
    report: null,
    run: null,
  };
}
