import { describe, expect, it } from "vitest";
import { validateInvestigationState } from "../lib/investigation";
const plan = {
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
} as const;
const pending = {
  kind: "execution",
  id: "a-test-job",
  hypothesisId: "h1",
  plan,
  dependsOn: [],
  reason: "inspect",
};
describe("investigation capability boundary", () => {
  it("accepts only the exact user approved plan", () => {
    expect(
      validateInvestigationState({ status: "WAITING_RESULT", pending }, [plan])
        .pending?.id,
    ).toBe("a-test-job");
    expect(() =>
      validateInvestigationState(
        {
          status: "WAITING_RESULT",
          pending: {
            ...pending,
            plan: { ...plan, start: "2025-01-01T00:00:00Z" },
          },
        },
        [plan],
      ),
    ).toThrow("UNAPPROVED_PLAN");
  });
  it("rejects injected source and malformed evidence", () => {
    expect(() =>
      validateInvestigationState(
        {
          status: "WAITING_RESULT",
          pending: { ...pending, code: "fetch(secret)" },
        },
        [plan],
      ),
    ).toThrow("INVALID_RESPONSE");
    expect(() =>
      validateInvestigationState(
        {
          status: "COMPLETE",
          evidence: [
            {
              jobId: "x",
              datasetHash: plan.datasetHash,
              sql: { minorUnits: "NaN", count: 1 },
              python: { minorUnits: "0", count: 1 },
              verification: "VERIFIED",
              provenance: "CLIENT_REPORTED",
              hypothesisId: "h1",
            },
          ],
        },
        [plan],
      ),
    ).toThrow();
  });
});

it("bounds a stalled API request instead of retaining credentials indefinitely", async () => {
  const { apiJSON } = await import("../lib/investigation");
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        "abort",
        () => reject(new Error("deadline")),
        { once: true },
      );
    });
  try {
    await expect(
      apiJSON("/test", "memory-token", { key: "never-persist" }, undefined, 10),
    ).rejects.toThrow("deadline");
  } finally {
    globalThis.fetch = original;
  }
});

it("rejects false verified v2 grain agreement and accepts honest disputed semantics", () => {
  const advanced = {
    ...plan,
    version: 2,
    grainKeys: ["order_id"],
    relationship: null,
  } as const;
  const counts = {
    populationRows: 3,
    periodRows: 3,
    nullAmounts: 0,
    grainUniqueRows: 2,
    joinUniqueRows: 3,
  };
  const evidence = {
    jobId: "e",
    datasetHash: plan.datasetHash,
    sql: { minorUnits: "3033", count: 3 },
    python: { minorUnits: "3033", count: 3 },
    verification: "DISPUTED",
    provenance: "CLIENT_REPORTED",
    hypothesisId: "h1",
    classification: "GRAIN_VIOLATION",
    contractHash: "b".repeat(64),
    metricVersion: 2,
    currency: "USD",
    dependsOn: [],
    diagnostics: { contract: advanced, sql: counts, python: counts },
  };
  expect(
    validateInvestigationState({ status: "COMPLETE", evidence: [evidence] }, [
      advanced as unknown as import("../lib/execution").MetricPlan,
    ]).evidence[0].verification,
  ).toBe("DISPUTED");
  expect(() =>
    validateInvestigationState(
      {
        status: "COMPLETE",
        evidence: [{ ...evidence, verification: "VERIFIED" }],
      },
      [advanced as unknown as import("../lib/execution").MetricPlan],
    ),
  ).toThrow();
});

it("rejects invented chart numbers and unsupported report claims even with valid citations", () => {
  const e = {
    jobId: "e",
    datasetHash: plan.datasetHash,
    contractHash: "b".repeat(64),
    contract: plan,
    metricVersion: 1,
    currency: "USD",
    sql: { minorUnits: "3033", count: 3 },
    python: { minorUnits: "3033", count: 3 },
    verification: "VERIFIED",
    classification: "AGREEMENT",
    provenance: "CLIENT_REPORTED",
    hypothesisId: "h1",
    dependsOn: [],
  };
  const f = {
    id: "finding-1",
    evidenceId: "e",
    datasetHash: e.datasetHash,
    contractHash: e.contractHash,
    metricVersion: 1,
    currency: "USD",
    verification: "VERIFIED",
    provenance: "CLIENT_REPORTED",
    assessment: "SUPPORTED",
    relation: "observed",
    sql: e.sql,
    python: e.python,
    dependsOn: [],
  };
  const report = {
    version: 1,
    conclusion:
      "Observed computations are client-reported; evidence states are shown below. Arithmetic agreement does not establish causality.",
    citations: ["e"],
    source: "validated",
    rejection: null,
    findings: [f],
    claims: [],
    charts: [
      {
        kind: "engine_comparison",
        evidenceId: "e",
        currency: "USD",
        sqlMinorUnits: "3033",
        pythonMinorUnits: "3033",
      },
    ],
  };
  expect(() =>
    validateInvestigationState(
      {
        status: "COMPLETE",
        evidence: [e],
        report: { ...report, source: ["validated"] },
      },
      [plan],
    ),
  ).toThrow();
  expect(() =>
    validateInvestigationState(
      {
        status: "COMPLETE",
        evidence: [e],
        report: { ...report, conclusion: [report.conclusion] },
      },
      [plan],
    ),
  ).toThrow();
  expect(
    validateInvestigationState({ status: "COMPLETE", evidence: [e], report }, [
      plan,
    ]).report,
  ).toBeDefined();
  expect(() =>
    validateInvestigationState(
      {
        status: "COMPLETE",
        evidence: [e],
        report: {
          ...report,
          charts: [{ ...report.charts[0], sqlMinorUnits: "99999" }],
        },
      },
      [plan],
    ),
  ).toThrow();
  expect(() =>
    validateInvestigationState(
      {
        status: "COMPLETE",
        evidence: [e],
        report: {
          ...report,
          claims: [
            {
              kind: "causal",
              evidenceIds: ["e"],
              datasetHash: e.datasetHash,
              contractHash: e.contractHash,
              value: "20",
              unit: "percent",
            },
          ],
        },
      },
      [plan],
    ),
  ).toThrow();
});

it("independently validates negative fractional percentage operands", () => {
  const currentPlan = { ...plan, datasetHash: "c".repeat(64) };
  const evidence = [
    {
      jobId: "base",
      datasetHash: plan.datasetHash,
      contractHash: "b".repeat(64),
      contract: plan,
      metricVersion: 1,
      currency: "USD",
      sql: { minorUnits: "10000", count: 3 },
      python: { minorUnits: "10000", count: 3 },
      verification: "VERIFIED",
      classification: "AGREEMENT",
      provenance: "CLIENT_REPORTED",
      hypothesisId: "h1",
      dependsOn: [],
    },
    {
      jobId: "current",
      datasetHash: currentPlan.datasetHash,
      contractHash: "d".repeat(64),
      contract: currentPlan,
      metricVersion: 1,
      currency: "USD",
      sql: { minorUnits: "9950", count: 3 },
      python: { minorUnits: "9950", count: 3 },
      verification: "VERIFIED",
      classification: "AGREEMENT",
      provenance: "CLIENT_REPORTED",
      hypothesisId: "h1",
      dependsOn: ["base"],
    },
  ];
  const claim = {
    kind: "percent_change",
    evidenceIds: ["base", "current"],
    datasetHash: currentPlan.datasetHash,
    contractHash: "d".repeat(64),
    value: "-0.5",
    unit: "percent",
  };
  const report = {
    version: 1,
    conclusion:
      "Observed computations are client-reported; evidence states are shown below. Arithmetic agreement does not establish causality.",
    citations: ["base", "current"],
    source: "validated",
    rejection: null,
    findings: evidence.map((e, i) => ({
      id: `finding-${i + 1}`,
      evidenceId: e.jobId,
      datasetHash: e.datasetHash,
      contractHash: e.contractHash,
      metricVersion: 1,
      currency: "USD",
      verification: "VERIFIED",
      provenance: "CLIENT_REPORTED",
      assessment: "SUPPORTED",
      relation: "observed",
      sql: e.sql,
      python: e.python,
      dependsOn: e.dependsOn,
    })),
    claims: [claim],
    charts: evidence.map((e) => ({
      kind: "engine_comparison",
      evidenceId: e.jobId,
      currency: "USD",
      sqlMinorUnits: e.sql.minorUnits,
      pythonMinorUnits: e.python.minorUnits,
    })),
  };
  expect(
    validateInvestigationState({ status: "COMPLETE", evidence, report }, [
      plan,
      currentPlan,
    ]).report?.claims[0].value,
  ).toBe("-0.5");
  expect(() =>
    validateInvestigationState(
      {
        status: "COMPLETE",
        evidence,
        report: { ...report, claims: [{ ...claim, value: "0.5" }] },
      },
      [plan, currentPlan],
    ),
  ).toThrow();
});
