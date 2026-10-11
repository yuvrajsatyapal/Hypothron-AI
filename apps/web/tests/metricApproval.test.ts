import { describe, expect, it } from "vitest";
import { approvedMetric } from "../components/metricApproval";
const input = {
  datasetHash: "a".repeat(64),
  amountColumn: "revenue",
  dateColumn: "completed_at",
  start: "2025-07-01T00:00:00Z",
  end: "2025-10-01T00:00:00Z",
  advanced: false,
  currency: "USD",
  timezone: "UTC",
  nullPolicy: "exclude",
  grain: "id",
} as const;
describe("explicit metric approval", () => {
  it("preserves v1 default without accidentally including v2 fields", () => {
    expect(approvedMetric(input)).toEqual({
      version: 1,
      kind: "revenue_sum",
      datasetHash: input.datasetHash,
      amountColumn: "revenue",
      dateColumn: "completed_at",
      start: input.start,
      end: input.end,
      currency: "USD",
      timezone: "UTC",
      nullPolicy: "exclude",
    });
  });
  it("requires grain and exact offset period semantics for v2", () => {
    expect(() =>
      approvedMetric({ ...input, advanced: true, grain: "" }),
    ).toThrow("INVALID_GRAIN");
    expect(() =>
      approvedMetric({ ...input, advanced: true, timezone: "+05:30" }),
    ).toThrow("INVALID_PERIOD");
    expect(
      approvedMetric({ ...input, advanced: true, currency: "JPY" }).currency,
    ).toBe("JPY");
  });
  it("rejects an unapproved join and binds its exact lookup/hash/population", () => {
    const lookup = {
      datasetHash: "b".repeat(64),
      keyColumn: "id",
      lookupKeyColumn: "id",
      cardinality: "one_to_one",
      populationCount: 3,
      approved: false,
    } as const;
    expect(() => approvedMetric({ ...input, advanced: true, lookup })).toThrow(
      "RELATIONSHIP_APPROVAL_REQUIRED",
    );
    const plan = approvedMetric({
      ...input,
      advanced: true,
      lookup: { ...lookup, approved: true },
    });
    expect(plan.relationship).toEqual({
      datasetHash: lookup.datasetHash,
      keyColumn: "id",
      lookupKeyColumn: "id",
      cardinality: "one_to_one",
      populationCount: 3,
    });
  });
});

it("disputes equal totals with different period/null populations", async () => {
  const { executionVerdict } = await import("../components/metricApproval");
  const plan = approvedMetric({ ...input, advanced: true });
  const diagnostics = {
    populationRows: 3,
    periodRows: 2,
    nullAmounts: 1,
    grainUniqueRows: 3,
    joinUniqueRows: 3,
  };
  expect(
    executionVerdict(plan, {
      sql: { minorUnits: "100", count: 1 },
      python: { minorUnits: "100", count: 1 },
      diagnostics: {
        contract: plan,
        sql: diagnostics,
        python: { ...diagnostics, periodRows: 3, nullAmounts: 2 },
      },
    }),
  ).toEqual({
    state: "DISPUTED",
    classification: "SEMANTIC_DIAGNOSTIC_MISMATCH",
  });
});
