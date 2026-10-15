import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HypothesisTrace } from "../components/HypothesisTrace";
import type { InvestigationState } from "../lib/investigation";
const state: InvestigationState = {
  status: "ANALYZING",
  hypotheses: [
    {
      id: "h1",
      datasetHash: "a".repeat(64),
      statement: "Revenue fell in Q3",
      priority: 1,
    },
    {
      id: "h2",
      datasetHash: "b".repeat(64),
      statement: "<script>unsafe</script>",
      priority: 2,
    },
  ],
  evidence: [
    {
      jobId: "job-1",
      datasetHash: "a".repeat(64),
      hypothesisId: "h1",
      verification: "DISPUTED",
      provenance: "CLIENT_REPORTED",
      sql: { minorUnits: "100", count: 1 },
      python: { minorUnits: "101", count: 1 },
    },
  ],
};
it("trace retains disputed evidence and marks unexecuted hypotheses as awaiting", () => {
  const html = renderToStaticMarkup(createElement(HypothesisTrace, { state }));
  expect(html).toContain("DISPUTED");
  expect(html).toContain("CLIENT_REPORTED");
  expect(html).toContain("AWAITING EVIDENCE");
  expect(html).not.toContain("Verified causal");
  expect(html).not.toContain("<script>");
});
it("trace is absent without proposed hypotheses", () => {
  expect(
    renderToStaticMarkup(
      createElement(HypothesisTrace, {
        state: { status: "PLANNING", evidence: [] },
      }),
    ),
  ).toBe("");
});
