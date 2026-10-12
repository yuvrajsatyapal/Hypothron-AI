import {
  validateNumeric,
  validatePlan,
  canonicalPlan,
  type MetricPlan,
  type NumericResult,
} from "../../executor/src/contracts";
import { evidenceVerdict } from "./verification";
import { validateReport } from "./report";
import type { EvidenceReportData } from "../components/EvidenceReport";
export interface Job {
  kind: "execution";
  id: string;
  hypothesisId: string;
  plan: MetricPlan;
  dependsOn: string[];
  reason: string;
}
export interface Evidence {
  jobId: string;
  datasetHash: string;
  sql: NumericResult;
  python: NumericResult;
  verification: "VERIFIED" | "DISPUTED" | "INCONCLUSIVE";
  provenance: "CLIENT_REPORTED";
  hypothesisId: string;
  classification?: string;
  contractHash?: string;
  dependsOn?: string[];
  currency?: string;
  metricVersion?: number;
  contract?: MetricPlan;
}
export interface InvestigationState {
  status: string;
  pending?: Job;
  clarification?: string;
  evidence: Evidence[];
  report?: EvidenceReportData;
  error?: string;
  hypotheses?: {
    id: string;
    datasetHash: string;
    statement: string;
    priority: number;
  }[];
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 240): string {
  if (typeof value !== "string" || !value.length || value.length > max)
    throw new Error("INVALID_RESPONSE");
  return value;
}
function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("INVALID_RESPONSE");
  return value.map((v) => text(v, 64));
}
export function samePlan(a: MetricPlan, b: MetricPlan): boolean {
  return canonicalPlan(a) === canonicalPlan(b);
}
export function validateInvestigationState(
  value: unknown,
  approved: MetricPlan[],
): InvestigationState {
  const raw = record(value),
    status = text(raw.status, 32);
  if (
    ![
      "PLANNING",
      "CLARIFYING",
      "ANALYZING",
      "ISSUING",
      "WAITING_RESULT",
      "REPORTING",
      "COMPLETE",
      "FAILED",
      "BUDGET_EXHAUSTED",
      "CANCELLED",
    ].includes(status)
  )
    throw new Error("INVALID_RESPONSE");
  const output: InvestigationState = { status, evidence: [] };
  if (raw.pending && Object.keys(record(raw.pending)).length) {
    const job = record(raw.pending);
    if (
      Object.keys(job).sort().join(",") !==
        "dependsOn,hypothesisId,id,kind,plan,reason" ||
      job.kind !== "execution"
    )
      throw new Error("INVALID_RESPONSE");
    const plan = validatePlan(job.plan);
    if (!approved.some((p) => samePlan(p, plan)))
      throw new Error("UNAPPROVED_PLAN");
    output.pending = {
      kind: "execution",
      id: text(job.id, 64),
      hypothesisId: text(job.hypothesisId, 3),
      plan,
      dependsOn: strings(job.dependsOn, 6),
      reason: text(job.reason),
    };
  }
  if (raw.hypotheses !== undefined) {
    if (!Array.isArray(raw.hypotheses) || raw.hypotheses.length > 6)
      throw new Error("INVALID_RESPONSE");
    const ids = new Set<string>();
    output.hypotheses = raw.hypotheses.map((value) => {
      const h = record(value),
        id = text(h.id, 3),
        datasetHash = text(h.datasetHash, 64);
      if (
        Object.keys(h).sort().join(",") !==
          "datasetHash,id,priority,statement" ||
        !/^h[1-6]$/.test(id) ||
        ids.has(id) ||
        !approved.some((p) => p.datasetHash === datasetHash) ||
        !Number.isSafeInteger(h.priority) ||
        Number(h.priority) < 1 ||
        Number(h.priority) > 6
      )
        throw new Error("INVALID_RESPONSE");
      ids.add(id);
      return {
        id,
        datasetHash,
        statement: text(h.statement),
        priority: Number(h.priority),
      };
    });
  }
  if (raw.clarification !== undefined && raw.clarification !== null)
    output.clarification = text(raw.clarification);
  if (raw.error !== undefined) output.error = text(raw.error, 64);
  if (raw.evidence !== undefined) {
    if (!Array.isArray(raw.evidence) || raw.evidence.length > 6)
      throw new Error("INVALID_RESPONSE");
    output.evidence = raw.evidence.map((e) => {
      const r = record(e),
        sql = validateNumeric(r.sql),
        python = validateNumeric(r.python),
        hash = text(r.datasetHash, 64);
      const plan = approved.find((p) => p.datasetHash === hash);
      if (
        !plan ||
        r.provenance !== "CLIENT_REPORTED" ||
        evidenceVerdict(plan, r).state !== r.verification ||
        (r.classification !== undefined &&
          evidenceVerdict(plan, r).classification !== r.classification)
      )
        throw new Error("INVALID_RESPONSE");
      if (
        r.contract !== undefined &&
        !samePlan(validatePlan(r.contract), plan!)
      )
        throw new Error("INVALID_RESPONSE");
      return {
        contract: plan!,
        jobId: text(r.jobId, 64),
        datasetHash: hash,
        sql,
        python,
        verification: r.verification as Evidence["verification"],
        provenance: "CLIENT_REPORTED",
        hypothesisId: text(r.hypothesisId, 3),
        ...(r.classification === undefined
          ? {}
          : { classification: text(r.classification, 64) }),
        ...(r.contractHash === undefined
          ? {}
          : { contractHash: text(r.contractHash, 64) }),
        ...(r.dependsOn === undefined
          ? {}
          : { dependsOn: strings(r.dependsOn, 6) }),
        currency: plan!.currency,
        metricVersion: plan!.version,
      };
    });
  }
  const accepted = new Set<string>();
  for (const e of output.evidence) {
    if (
      accepted.has(e.jobId) ||
      (e.dependsOn || []).some((id) => !accepted.has(id))
    )
      throw new Error("INVALID_RESPONSE");
    accepted.add(e.jobId);
  }
  if (raw.report !== undefined) {
    const report = record(raw.report);
    if (report.version === 1)
      output.report = validateReport(report, output.evidence);
    // Legacy Phase 2 playback is refused numerical authority; re-investigate for grounded output.
    else {
      const citations = strings(report.citations, 6);
      if (citations.some((id) => !accepted.has(id)))
        throw new Error("INVALID_RESPONSE");
    }
  }
  return output;
}
export const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN || "http://127.0.0.1:8000";
export async function apiJSON(
  path: string,
  token: string | null,
  body?: unknown,
  signal?: AbortSignal,
  deadlineMs = 65000,
): Promise<Record<string, unknown>> {
  const deadline = AbortSignal.timeout(Math.min(deadlineMs, 65000));
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const response = await fetch(API_ORIGIN + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "omit",
    signal: requestSignal,
  });
  const reader = response.body?.getReader();
  if (!reader) throw new Error("INVALID_RESPONSE");
  const decoder = new TextDecoder();
  let value = "",
    size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 128 * 1024) throw new Error("RESPONSE_LIMIT");
      value += decoder.decode(part.value, { stream: true });
    }
    value += decoder.decode();
  } finally {
    await reader.cancel();
  }
  const parsed = record(JSON.parse(value));
  if (!response.ok)
    throw new Error(
      typeof record(parsed.error || {}).code === "string"
        ? String(record(parsed.error).code)
        : "API_REQUEST_FAILED",
    );
  return parsed;
}
