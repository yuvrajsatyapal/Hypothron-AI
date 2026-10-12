import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EvidenceReport,
  exactMoney,
  comparisonBars,
} from "../components/EvidenceReport";
const report = {
  version: 1 as const,
  conclusion: "<img src=x onerror=alert(1)>",
  citations: ["job-1"],
  source: "validated" as const,
  rejection: null,
  findings: [
    {
      id: "finding-job-1",
      evidenceId: "job-1",
      datasetHash: "a".repeat(64),
      contractHash: "b".repeat(64),
      metricVersion: 2,
      currency: "EUR" as const,
      verification: "DISPUTED",
      provenance: "CLIENT_REPORTED" as const,
      assessment: "DISPUTED" as const,
      relation: "observed" as const,
      sql: { minorUnits: "1007", count: 2 },
      python: { minorUnits: "900", count: 2 },
      dependsOn: [],
    },
  ],
  claims: [],
  charts: [
    {
      kind: "engine_comparison" as const,
      evidenceId: "job-1",
      currency: "EUR" as const,
      sqlMinorUnits: "1007",
      pythonMinorUnits: "900",
    },
  ],
};
describe("evidence report presentation", () => {
  it("formats exact money without floating point loss", () => {
    expect(exactMoney("9007199254740993123", "USD")).toBe(
      "90071992547409931.23 USD",
    );
    expect(exactMoney("-3", "EUR")).toBe("-0.03 EUR");
    expect(exactMoney("7", "JPY")).toBe("7 JPY");
    expect(exactMoney(null, "EUR")).toBe("undefined EUR");
  });
  it("uses bounded rational bar geometry for huge and negative amounts", () => {
    const bars = comparisonBars("-9007199254740993123", "9007199254740993123");
    expect(bars).toEqual([
      { x: 0, width: 160 },
      { x: 160, width: 160 },
    ]);
    expect(comparisonBars("0", null)).toEqual([{ x: 160, width: 0 }, null]);
  });
  it("renders disputed engines and provenance with exact table and safe text", () => {
    const html = renderToStaticMarkup(
      createElement(EvidenceReport, { report }),
    );
    expect(html).toContain("10.07 EUR");
    expect(html).toContain("9.00 EUR");
    expect(html).toContain("CLIENT_REPORTED");
    expect(html).toContain("Observed");
    expect(html).toContain('role="img"');
    expect(html).toContain('href="#evidence-job-1"');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("DISPUTED");
  });
});

it("renders only controlled numerical templates with exact claim units", () => {
  const valid = {
    ...report,
    findings: [
      {
        ...report.findings[0],
        assessment: "SUPPORTED" as const,
        verification: "VERIFIED",
      },
    ],
    claims: [
      {
        kind: "total" as const,
        evidenceIds: ["job-1"],
        datasetHash: "a".repeat(64),
        contractHash: "b".repeat(64),
        value: "1007",
        unit: "minor_units" as const,
      },
      {
        kind: "count" as const,
        evidenceIds: ["job-1"],
        datasetHash: "a".repeat(64),
        contractHash: "b".repeat(64),
        value: "2",
        unit: "rows" as const,
      },
      {
        kind: "percent_change" as const,
        evidenceIds: ["job-1", "job-2"],
        datasetHash: "a".repeat(64),
        contractHash: "b".repeat(64),
        value: "12.50",
        unit: "percent" as const,
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(EvidenceReport, { report: valid }),
  );
  expect(html).toContain("Observed total: 10.07 EUR");
  expect(html).toContain("Observed count: 2 rows");
  expect(html).toContain("Arithmetic percentage change: 12.50%");
});
it("distinguishes undefined, actual zero and values below pixel resolution", () => {
  const valid = {
    ...report,
    charts: [
      {
        ...report.charts[0],
        sqlMinorUnits: "1",
        pythonMinorUnits: "9007199254740993123",
      },
    ],
  };
  const html = renderToStaticMarkup(
    createElement(EvidenceReport, { report: valid }),
  );
  expect(html).toContain("below chart resolution");
  const empty = {
    ...report,
    charts: [
      { ...report.charts[0], sqlMinorUnits: "0", pythonMinorUnits: null },
    ],
  };
  const emptyHtml = renderToStaticMarkup(
    createElement(EvidenceReport, { report: empty }),
  );
  expect(emptyHtml).toContain("undefined EUR");
  expect(emptyHtml).toContain(">zero</text>");
});
