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
