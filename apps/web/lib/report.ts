import type {
  EvidenceReportData,
  ReportClaim,
} from "../components/EvidenceReport";
import type { Evidence } from "./investigation";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_REPORT");
  return value as Record<string, unknown>;
}
function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function require(condition: boolean): void {
  if (!condition) throw new Error("INVALID_REPORT");
}
function ids(value: unknown, max = 6): string[] {
  require(Array.isArray(value) && value.length <= max);
  return (value as unknown[]).map((v) => {
    require(typeof v === "string" && v.length > 0 && v.length <= 64);
    return v as string;
  });
}
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  const o = object(value);
  require(Object.keys(o).sort().join(",") === keys.sort().join(","));
  return o;
}
export function validateReport(
  value: unknown,
  evidence: Evidence[],
): EvidenceReportData {
  const r = exact(value, [
    "version",
    "conclusion",
    "citations",
    "source",
    "rejection",
    "findings",
    "claims",
    "charts",
  ]);
  require(
    r.version === 1 &&
      typeof r.source === "string" &&
      ["validated", "deterministic_fallback"].includes(r.source),
  );
  require(
    r.rejection === null ||
      (typeof r.rejection === "string" && /^[A-Z_]{1,64}$/.test(r.rejection)),
  );
  require(
    typeof r.conclusion === "string" &&
      [
        "Observed computations are client-reported; evidence states are shown below. Arithmetic agreement does not establish causality.",
        "No calculation evidence was collected; no numerical claim is supported.",
      ].includes(r.conclusion as string),
  );
  const citations = ids(r.citations);
  require(
    new Set(citations).size === citations.length &&
      equal(
        citations,
        evidence.map((e) => e.jobId),
      ),
  );
  const known = new Map(evidence.map((e) => [e.jobId, e]));
  require(
    Array.isArray(r.findings) &&
      r.findings.length === evidence.length &&
      Array.isArray(r.charts) &&
      r.charts.length === evidence.length,
  );
  (r.findings as unknown[]).forEach((raw, i) => {
    const f = exact(raw, [
      "id",
      "evidenceId",
      "datasetHash",
      "contractHash",
      "metricVersion",
      "currency",
      "verification",
      "provenance",
      "assessment",
      "relation",
      "sql",
      "python",
      "dependsOn",
    ]);
    const e = evidence[i];
    require(
      f.id === `finding-${i + 1}` &&
        f.evidenceId === e.jobId &&
        f.datasetHash === e.datasetHash &&
        f.contractHash === e.contractHash &&
        f.metricVersion === e.metricVersion &&
        f.currency === e.currency &&
        f.verification === e.verification &&
        f.provenance === "CLIENT_REPORTED" &&
        f.assessment ===
          (e.verification === "VERIFIED" ? "SUPPORTED" : e.verification) &&
        f.relation === "observed" &&
        equal(f.sql, e.sql) &&
        equal(f.python, e.python) &&
        equal(f.dependsOn, e.dependsOn || []),
    );
  });
  (r.charts as unknown[]).forEach((raw, i) => {
    const c = exact(raw, [
        "kind",
        "evidenceId",
        "currency",
        "sqlMinorUnits",
        "pythonMinorUnits",
      ]),
      e = evidence[i];
    require(
      c.kind === "engine_comparison" &&
        c.evidenceId === e.jobId &&
        c.currency === e.currency &&
        c.sqlMinorUnits === e.sql.minorUnits &&
        c.pythonMinorUnits === e.python.minorUnits,
    );
  });
  require(Array.isArray(r.claims) && r.claims.length <= 12);
  const claims = (r.claims as unknown[]).map((raw) => {
    const c = exact(raw, [
      "kind",
      "evidenceIds",
      "datasetHash",
      "contractHash",
      "value",
      "unit",
    ]);
    const refs = ids(c.evidenceIds, 2);
    require(
      refs.length > 0 &&
        new Set(refs).size === refs.length &&
        refs.every((id) => known.has(id) && citations.includes(id)),
    );
    const operands = refs.map((id) => known.get(id)!);
    const current = operands.at(-1)!;
    require(
      c.datasetHash === current.datasetHash &&
        c.contractHash === current.contractHash &&
        operands.every(
          (e) =>
            e.verification === "VERIFIED" &&
            e.provenance === "CLIENT_REPORTED" &&
            equal(e.sql, e.python),
        ),
    );
    require(
      typeof c.value === "string" &&
        /^-?(0|[1-9][0-9]{0,30})(\.[0-9]{1,12})?$/.test(c.value),
    );
    const [whole, fraction = ""] = (c.value as string).split(".");
    const numerator = BigInt(whole + fraction);
    const denominator = 10n ** BigInt(fraction.length);
    if (c.kind === "total" || c.kind === "count") {
      require(
        refs.length === 1 &&
          c.unit === (c.kind === "total" ? "minor_units" : "rows") &&
          fraction === "",
      );
      const raw =
        c.kind === "total" ? current.sql.minorUnits : current.sql.count;
      require(raw !== null && numerator === BigInt(raw!) * denominator);
    } else {
      require(
        c.kind === "percent_change" &&
          refs.length === 2 &&
          c.unit === "percent",
      );
      const baseline = operands[0];
      require(
        baseline.currency === current.currency &&
          baseline.metricVersion === current.metricVersion &&
          !!baseline.contract &&
          !!current.contract,
      );
      const business = (e: Evidence) =>
        Object.fromEntries(
          Object.entries(e.contract!)
            .filter(([k]) => !["datasetHash", "start", "end"].includes(k))
            .sort(([a], [b]) => a.localeCompare(b)),
        );
      // Normalize source/period only; currency, null, offset, grain and relationship stay contractual.
      const a = business(baseline),
        b = business(current);
      require(equal(a, b));
      require(
        baseline.sql.minorUnits !== null && current.sql.minorUnits !== null,
      );
      const base = BigInt(baseline.sql.minorUnits!),
        now = BigInt(current.sql.minorUnits!);
      require(
        base !== 0n && numerator * base === (now - base) * 100n * denominator,
      );
    }
    return c as unknown as ReportClaim;
  });
  return { ...r, claims } as unknown as EvidenceReportData;
}
