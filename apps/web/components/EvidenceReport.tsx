import React from "react";
import type { NumericResult } from "../../executor/src/contracts";
export type Currency = "USD" | "EUR" | "JPY";
export interface ReportFinding {
  id: string;
  evidenceId: string;
  datasetHash: string;
  contractHash: string;
  metricVersion: number;
  currency: Currency;
  verification: string;
  provenance: "CLIENT_REPORTED";
  assessment: "SUPPORTED" | "DISPUTED" | "INCONCLUSIVE";
  relation: "observed";
  sql: NumericResult;
  python: NumericResult;
  dependsOn: string[];
}
export interface ReportClaim {
  kind: "total" | "count" | "percent_change";
  evidenceIds: string[];
  datasetHash: string;
  contractHash: string;
  value: string;
  unit: "minor_units" | "rows" | "percent";
}
export interface EvidenceReportData {
  version: 1;
  conclusion: string;
  citations: string[];
  source: "validated" | "deterministic_fallback";
  rejection: string | null;
  findings: ReportFinding[];
  claims: ReportClaim[];
  charts: {
    kind: "engine_comparison";
    evidenceId: string;
    currency: Currency;
    sqlMinorUnits: string | null;
    pythonMinorUnits: string | null;
  }[];
}
export function exactMoney(value: string | null, currency: Currency): string {
  if (value === null) return `undefined ${currency}`;
  const amount = BigInt(value);
  const negative = amount < 0n;
  const magnitude = negative ? -amount : amount;
  const decimal =
    currency === "JPY"
      ? magnitude.toString()
      : `${magnitude / 100n}.${(magnitude % 100n).toString().padStart(2, "0")}`;
  return `${negative ? "-" : ""}${decimal} ${currency}`;
}
export function comparisonBars(sql: string | null, python: string | null) {
  const values = [sql, python].map((value) =>
    value === null ? null : BigInt(value),
  );
  const magnitude = values.reduce<bigint>((max, value) => {
    const absolute = value === null ? 0n : value < 0n ? -value : value;
    return absolute > max ? absolute : max;
  }, 0n);
  return values.map((value) => {
    if (value === null) return null;
    const absolute = value < 0n ? -value : value;
    const width = magnitude === 0n ? 0 : Number((absolute * 160n) / magnitude);
    return { x: value < 0n ? 160 - width : 160, width };
  });
}
function evidenceLink(id: string) {
  return (
    <a key={id} href={`#evidence-${id}`}>
      {id}
    </a>
  );
}
function claimLabel(claim: ReportClaim, report: EvidenceReportData) {
  if (claim.kind === "count") return `Observed count: ${claim.value} rows`;
  if (claim.kind === "percent_change")
    return `Arithmetic percentage change: ${claim.value}% (first cited evidence to second)`;
  const finding = report.findings.find(
    (f) => f.evidenceId === claim.evidenceIds[0],
  );
  return `Observed total: ${exactMoney(claim.value, finding!.currency)}`;
}
export function EvidenceReport({ report }: { report: EvidenceReportData }) {
  return (
    <div data-testid="investigation-report">
      <h3>Investigation report</h3>
      <p>{report.conclusion}</p>
      <p>
        Report source: {report.source}.{" "}
        {report.rejection && `Proposed claims rejected: ${report.rejection}.`}
      </p>
      <p>
        Client-reported agreement is local verification; it does not attest
        execution or establish causality.
      </p>
      <p>
        Citations:{" "}
        {report.citations.length
          ? report.citations.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && ", "}
                {evidenceLink(id)}
              </React.Fragment>
            ))
          : "No numerical evidence collected."}
      </p>
      {report.claims.length > 0 && (
        <section aria-label="Supported numerical claims">
          <h4>Supported numerical claims</h4>
          <ul>
            {report.claims.map((claim, i) => (
              <li key={i}>
                {claimLabel(claim, report)}. Evidence:{" "}
                {claim.evidenceIds.map((id, index) => (
                  <React.Fragment key={id}>
                    {index > 0 && ", "}
                    {evidenceLink(id)}
                  </React.Fragment>
                ))}{" "}
                · CLIENT_REPORTED
              </li>
            ))}
          </ul>
        </section>
      )}
      {report.findings.map((finding) => {
        const chart = report.charts.find(
          (c) => c.evidenceId === finding.evidenceId,
        );
        const bars = chart
          ? comparisonBars(chart.sqlMinorUnits, chart.pythonMinorUnits)
          : [];
        return (
          <section
            key={finding.id}
            id={`evidence-${finding.evidenceId}`}
            aria-label={`Observed evidence ${finding.evidenceId}`}
          >
            <h4>Observed evidence · {finding.evidenceId}</h4>
            <p>
              {finding.assessment} · {finding.verification} ·{" "}
              {finding.provenance} · {finding.currency} · metric v
              {finding.metricVersion}
            </p>
            {finding.assessment !== "SUPPORTED" && (
              <p>
                Both engine observations are shown. This finding does not
                support a numerical claim.
              </p>
            )}
            <table>
              <caption>Exact observed values for {finding.evidenceId}</caption>
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Amount</th>
                  <th>Included rows</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>SQL</th>
                  <td>
                    {exactMoney(finding.sql.minorUnits, finding.currency)}
                  </td>
                  <td>{finding.sql.count}</td>
                </tr>
                <tr>
                  <th>Pandas</th>
                  <td>
                    {exactMoney(finding.python.minorUnits, finding.currency)}
                  </td>
                  <td>{finding.python.count}</td>
                </tr>
              </tbody>
            </table>
            {chart && (
              <figure style={{ margin: "16px 0" }}>
                <svg
                  viewBox="0 0 480 132"
                  style={{ width: "100%", maxWidth: 640 }}
                  role="img"
                  aria-labelledby={`chart-${finding.evidenceId}-title chart-${finding.evidenceId}-description`}
                >
                  <title id={`chart-${finding.evidenceId}-title`}>
                    SQL and Pandas observed monetary comparison
                  </title>
                  <desc id={`chart-${finding.evidenceId}-description`}>
                    Signed {finding.currency} amounts for {finding.evidenceId}:
                    SQL {exactMoney(chart.sqlMinorUnits, chart.currency)} and
                    Pandas {exactMoney(chart.pythonMinorUnits, chart.currency)}.
                    Exact values and counts appear in the accompanying table.
                  </desc>
                  <line
                    x1="272"
                    y1="16"
                    x2="272"
                    y2="112"
                    stroke="var(--muted)"
                  />
                  <text
                    x="272"
                    y="128"
                    textAnchor="middle"
                    fill="var(--ink)"
                    fontSize="12"
                  >
                    zero
                  </text>
                  {bars.map((bar, i) => (
                    <g key={i}>
                      <text
                        x="0"
                        y={46 + i * 44}
                        fill="var(--ink)"
                        fontSize="14"
                      >
                        {i === 0 ? "SQL" : "Pandas"}
                      </text>
                      {bar && bar.width > 0 ? (
                        <rect
                          x={112 + bar.x}
                          y={30 + i * 44}
                          width={bar.width}
                          height="20"
                          fill={i === 0 ? "var(--accent)" : "var(--muted)"}
                        />
                      ) : (
                        <text
                          x="280"
                          y={46 + i * 44}
                          fill="var(--ink)"
                          fontSize="14"
                        >
                          {bar === null
                            ? "undefined"
                            : BigInt(
                                  i === 0
                                    ? chart.sqlMinorUnits!
                                    : chart.pythonMinorUnits!,
                                ) === 0n
                              ? "zero"
                              : "below chart resolution"}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
                <figcaption>
                  Independent engine observations, symmetric scale around zero.
                  Bar positions use exact integer ratios; the table preserves
                  exact monetary values. This comparison establishes no causal
                  effect.
                </figcaption>
              </figure>
            )}
            <details>
              <summary>Evidence lineage and metric identity</summary>
              <p className="hash">Dataset SHA-256: {finding.datasetHash}</p>
              <p className="hash">Contract SHA-256: {finding.contractHash}</p>
              <p>
                Depends on:{" "}
                {finding.dependsOn.length
                  ? finding.dependsOn.map((id, i) => (
                      <React.Fragment key={id}>
                        {i > 0 && ", "}
                        {evidenceLink(id)}
                      </React.Fragment>
                    ))
                  : "No prior evidence."}
              </p>
            </details>
          </section>
        );
      })}
    </div>
  );
}
