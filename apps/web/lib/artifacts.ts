import {
  contentHash,
  validatePlan,
  validateExecutionResult,
  preflightCSV,
  type MetricPlan,
  type ExecutionResult,
} from "../../executor/src/contracts";
import runtimeLock from "../../../packages/contracts/runtime-manifest.json";
import { evidenceVerdict } from "./verification";
import { validateReport } from "./report";
import type { EvidenceReportData } from "../components/EvidenceReport";
import type { Evidence } from "./investigation";
export const LIMITS = {
  snapshot: 10 * 1024 * 1024,
  raw: 30 * 1024 * 1024,
  metadata: 1024 * 1024,
  bundle: 32 * 1024 * 1024,
  storage: 64 * 1024 * 1024,
  records: 20,
} as const;
export const COMPILER = "revenue-compiler-3";
export const RUNTIME = {
  duckdb: "v1.4.3",
  pyodide: runtimeLock.pyodide,
  pandas: runtimeLock.pandas,
  numpy: runtimeLock.numpy,
};
export interface CalculationInput {
  id: string;
  hypothesisId: string;
  dependsOn: string[];
  plan: MetricPlan;
  result: ExecutionResult;
}
export interface Calculation extends CalculationInput {
  resultDigest: string;
  contractHash: string;
  verification: string;
  provenance: "CLIENT_REPORTED";
}
export interface RunSummary {
  provider: string;
  model: string;
  hypotheses: {
    id: string;
    datasetHash: string;
    statement: string;
    priority: number;
  }[];
  tokens: number | null;
  providerElapsedMs: number | null;
  attempts: number | null;
}
export interface Manifest {
  version: 1;
  id: string;
  question: string;
  createdAt: string;
  parentId: string | null;
  compiler: string;
  runtime: typeof RUNTIME;
  runtimeLockDigest: string;
  parser: "csv-utf8-v1";
  tolerance: "exact-minor-units-v1";
  snapshots: { hash: string; size: number; format: "csv" }[];
  approved: MetricPlan[];
  calculations: Calculation[];
  report: EvidenceReportData | null;
  run: RunSummary | null;
}
export interface SnapshotBlob {
  hash: string;
  bytes: Uint8Array;
}
export interface Artifact {
  manifest: Manifest;
  digest: string;
  snapshots: SnapshotBlob[];
  size: number;
}
export interface ArtifactInput {
  id: string;
  question: string;
  createdAt: string;
  parentId: string | null;
  snapshots: Uint8Array[];
  approved?: MetricPlan[];
  calculations: CalculationInput[];
  report: EvidenceReportData | null;
  run: RunSummary | null;
}
export function canonical(value: unknown, depth = 0): string {
  if (depth > 24) throw new Error("METADATA_DEPTH");
  if (value === null) return "null";
  if (typeof value === "string") {
    if (
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      )
    )
      throw new Error("INVALID_UNICODE");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value))
    return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map((v) => canonical(v, depth + 1)).join(",") + "]";
  if (
    value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  )
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            canonical(k) +
            ":" +
            canonical((value as Record<string, unknown>)[k], depth + 1),
        )
        .join(",") +
      "}"
    );
  throw new Error("INVALID_CANONICAL_VALUE");
}
export async function manifestDigest(value: unknown): Promise<string> {
  return contentHash(new TextEncoder().encode(canonical(value)));
}
export function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_MANIFEST");
  const r = value as Record<string, unknown>;
  if (Object.keys(r).sort().join(",") !== [...keys].sort().join(","))
    throw new Error("INVALID_MANIFEST");
  return r;
}
function string(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.length || value.length > max)
    throw new Error("INVALID_MANIFEST");
  return value;
}
function id(value: unknown): string {
  const s = string(value, 64);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("INVALID_ID");
  return s;
}
function digest(value: unknown): string {
  const s = string(value, 64);
  if (!/^[a-f0-9]{64}$/.test(s)) throw new Error("INVALID_DIGEST");
  return s;
}
export async function createArtifact(input: ArtifactInput): Promise<Artifact> {
  const snapshots: SnapshotBlob[] = [];
  for (const bytes of input.snapshots) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > LIMITS.snapshot)
      throw new Error("SNAPSHOT_LIMIT");
    const copy = new Uint8Array(bytes),
      hash = await contentHash(copy);
    if (!snapshots.some((s) => s.hash === hash))
      snapshots.push({ hash, bytes: copy });
  }
  snapshots.sort((a, b) => a.hash.localeCompare(b.hash));
  const calculations: Calculation[] = [];
  for (const c of input.calculations) {
    const result = validateExecutionResult(c.result, c.plan);
    const verdict = evidenceVerdict(
      c.plan,
      result as unknown as Record<string, unknown>,
    );
    calculations.push({
      id: c.id,
      hypothesisId: c.hypothesisId,
      dependsOn: [...c.dependsOn],
      plan: c.plan,
      result,
      resultDigest: await manifestDigest(result),
      contractHash: await manifestDigest(c.plan),
      verification: verdict.state,
      provenance: "CLIENT_REPORTED",
    });
  }
  const manifest: Manifest = {
    version: 1,
    id: input.id,
    question: input.question,
    createdAt: input.createdAt,
    parentId: input.parentId,
    compiler: COMPILER,
    runtime: RUNTIME,
    runtimeLockDigest: await manifestDigest(runtimeLock),
    parser: "csv-utf8-v1",
    tolerance: "exact-minor-units-v1",
    snapshots: snapshots.map((s) => ({
      hash: s.hash,
      size: s.bytes.byteLength,
      format: "csv",
    })),
    approved: [
      ...new Map(
        (input.approved ?? input.calculations.map((c) => c.plan)).map((p) => [
          canonical(p),
          p,
        ]),
      ).values(),
    ].sort((a, b) =>
      canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0,
    ),
    calculations,
    report: input.report,
    run: input.run,
  };
  return validateArtifact(manifest, snapshots);
}
export function artifactEvidence(m: Manifest): Evidence[] {
  return m.calculations.map((c) => ({
    jobId: c.id,
    contractHash: c.contractHash,
    hypothesisId: c.hypothesisId,
    datasetHash: c.plan.datasetHash,
    contract: c.plan,
    sql: c.result.sql,
    python: c.result.python,
    verification: c.verification as Evidence["verification"],
    provenance: "CLIENT_REPORTED",
    dependsOn: c.dependsOn,
    currency: c.plan.currency,
    metricVersion: c.plan.version,
  }));
}
export async function validateArtifact(
  value: unknown,
  blobs: SnapshotBlob[],
): Promise<Artifact> {
  const serialized = canonical(value);
  const metadataBytes = new TextEncoder().encode(serialized).length;
  if (metadataBytes > LIMITS.metadata) throw new Error("METADATA_LIMIT");
  const m = exact(JSON.parse(serialized), [
    "version",
    "id",
    "question",
    "createdAt",
    "parentId",
    "compiler",
    "runtime",
    "runtimeLockDigest",
    "parser",
    "tolerance",
    "snapshots",
    "approved",
    "calculations",
    "report",
    "run",
  ]);
  if (m.version !== 1) throw new Error("UNSUPPORTED_SCHEMA");
  id(m.id);
  string(m.question, 2000);
  if (m.parentId !== null) id(m.parentId);
  if (m.parentId === m.id) throw new Error("INVALID_PARENT");
  const date = string(m.createdAt, 32);
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(date) ||
    !Number.isFinite(Date.parse(date))
  )
    throw new Error("INVALID_TIME");
  if (typeof m.compiler !== "string") throw new Error("INVALID_MANIFEST");
  exact(m.runtime, ["duckdb", "pyodide", "pandas", "numpy"]);
  if (
    Object.values(m.runtime as Record<string, unknown>).some(
      (v) => typeof v !== "string" || v.length > 32,
    )
  )
    throw new Error("INVALID_RUNTIME");
  digest(m.runtimeLockDigest);
  if (m.parser !== "csv-utf8-v1" || m.tolerance !== "exact-minor-units-v1")
    throw new Error("UNSUPPORTED_SCHEMA");
  if (
    !Array.isArray(m.snapshots) ||
    m.snapshots.length < 1 ||
    m.snapshots.length > 3 ||
    !Array.isArray(blobs) ||
    blobs.length !== m.snapshots.length
  )
    throw new Error("SNAPSHOT_LIMIT");
  let rawSize = 0;
  const hashes = new Set<string>(),
    snapshots: SnapshotBlob[] = [];
  for (const s of m.snapshots) {
    const r = exact(s, ["hash", "size", "format"]);
    const hash = digest(r.hash);
    if (
      hashes.has(hash) ||
      !Number.isSafeInteger(r.size) ||
      Number(r.size) < 1 ||
      Number(r.size) > LIMITS.snapshot ||
      r.format !== "csv"
    )
      throw new Error("INVALID_SNAPSHOT");
    hashes.add(hash);
    rawSize += Number(r.size);
    const b = blobs.find((x) => x.hash === hash);
    if (
      !b ||
      !(b.bytes instanceof Uint8Array) ||
      b.bytes.byteLength !== r.size ||
      (await contentHash(b.bytes)) !== hash
    )
      throw new Error("SNAPSHOT_HASH_MISMATCH");
    preflightCSV(b.bytes);
    snapshots.push({ hash, bytes: new Uint8Array(b.bytes) });
  }
  if (rawSize > LIMITS.raw) throw new Error("SNAPSHOT_LIMIT");
  if (
    !Array.isArray(m.calculations) ||
    m.calculations.length < 1 ||
    m.calculations.length > 6
  )
    throw new Error("CALCULATION_LIMIT");
  const accepted = new Set<string>(),
    referenced = new Set<string>();
  if (
    !Array.isArray(m.approved) ||
    m.approved.length < 1 ||
    m.approved.length > 3
  )
    throw new Error("INVALID_APPROVED");
  const approved = new Set<string>();
  for (const p of m.approved) {
    const plan = validatePlan(p),
      key = canonical(plan);
    if (approved.has(key)) throw new Error("INVALID_APPROVED");
    approved.add(key);
    if (
      !hashes.has(plan.datasetHash) ||
      (plan.relationship && !hashes.has(plan.relationship.datasetHash))
    )
      throw new Error("MISSING_INPUT");
    referenced.add(plan.datasetHash);
    if (plan.relationship) referenced.add(plan.relationship.datasetHash);
  }
  for (const c of m.calculations) {
    const r = exact(c, [
      "id",
      "hypothesisId",
      "dependsOn",
      "plan",
      "result",
      "resultDigest",
      "contractHash",
      "verification",
      "provenance",
    ]);
    const job = id(r.id);
    if (
      accepted.has(job) ||
      !/^[Hh][1-6]$/.test(string(r.hypothesisId, 3)) ||
      !Array.isArray(r.dependsOn) ||
      r.dependsOn.length > 6 ||
      new Set(r.dependsOn).size !== r.dependsOn.length ||
      r.dependsOn.some((v) => !accepted.has(String(v)))
    )
      throw new Error("INVALID_DEPENDENCY");
    const plan = validatePlan(r.plan);
    if (!approved.has(canonical(plan))) throw new Error("UNAPPROVED_PLAN");
    if (
      !hashes.has(plan.datasetHash) ||
      (plan.relationship && !hashes.has(plan.relationship.datasetHash))
    )
      throw new Error("MISSING_INPUT");
    referenced.add(plan.datasetHash);
    if (plan.relationship) referenced.add(plan.relationship.datasetHash);
    if ((await manifestDigest(plan)) !== r.contractHash)
      throw new Error("CONTRACT_HASH_MISMATCH");
    const result = validateExecutionResult(r.result, plan);
    if ((await manifestDigest(result)) !== r.resultDigest)
      throw new Error("EVIDENCE_DIGEST_MISMATCH");
    if (
      r.provenance !== "CLIENT_REPORTED" ||
      evidenceVerdict(plan, result as unknown as Record<string, unknown>)
        .state !== r.verification
    )
      throw new Error("INVALID_VERIFICATION");
    if (canonical(result.runtime) !== canonical(m.runtime))
      throw new Error("INCOMPATIBLE_RUNTIME");
    accepted.add(job);
  }
  if (referenced.size !== hashes.size) throw new Error("UNREFERENCED_SNAPSHOT");
  const manifest = m as unknown as Manifest;
  if (m.report !== null) validateReport(m.report, artifactEvidence(manifest));
  if (m.run !== null) {
    const run = exact(m.run, [
      "provider",
      "model",
      "hypotheses",
      "tokens",
      "providerElapsedMs",
      "attempts",
    ]);
    if (!["gemini", "openrouter"].includes(String(run.provider)))
      throw new Error("INVALID_RUN");
    string(run.model, 128);
    if (!Array.isArray(run.hypotheses) || run.hypotheses.length > 6)
      throw new Error("INVALID_RUN");
    for (const h of run.hypotheses) {
      const r = exact(h, ["id", "datasetHash", "statement", "priority"]);
      if (
        !/^[Hh][1-6]$/.test(string(r.id, 3)) ||
        !hashes.has(digest(r.datasetHash))
      )
        throw new Error("INVALID_RUN");
      string(r.statement, 240);
      if (
        !Number.isSafeInteger(r.priority) ||
        Number(r.priority) < 1 ||
        Number(r.priority) > 6
      )
        throw new Error("INVALID_RUN");
    }
    for (const k of ["tokens", "providerElapsedMs"])
      if (
        run[k] !== null &&
        (!Number.isSafeInteger(run[k]) ||
          Number(run[k]) < 0 ||
          Number(run[k]) > 1e9)
      )
        throw new Error("INVALID_RUN");
    if (
      run.attempts !== null &&
      (!Number.isSafeInteger(run.attempts) ||
        Number(run.attempts) < 0 ||
        Number(run.attempts) > 12)
    )
      throw new Error("INVALID_RUN");
  }
  return {
    manifest,
    digest: await manifestDigest(manifest),
    snapshots,
    size: metadataBytes + rawSize,
  };
}
export async function checkCompatibility(m: Manifest): Promise<void> {
  if (m.compiler !== COMPILER) throw new Error("INCOMPATIBLE_COMPILER");
  if (
    canonical(m.runtime) !== canonical(RUNTIME) ||
    m.runtimeLockDigest !== (await manifestDigest(runtimeLock))
  )
    throw new Error("INCOMPATIBLE_RUNTIME");
}
