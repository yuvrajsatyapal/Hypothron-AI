import {
  canonical,
  checkCompatibility,
  validateArtifact,
  type Artifact,
  type Calculation,
} from "./artifacts";
import {
  validateExecutionResult,
  type ExecutionResult,
  type MetricPlan,
} from "../../executor/src/contracts";
import { evidenceVerdict } from "./verification";
export interface ReplayExecutor {
  execute: (
    plan: MetricPlan,
    bytes: Uint8Array,
    lookup?: { bytes: Uint8Array; approvedRelationship: true },
  ) => Promise<ExecutionResult>;
  cancel: () => void;
}
export interface ReplayComparison {
  id: string;
  saved: ExecutionResult;
  current: ExecutionResult;
  matches: boolean;
  verification: string;
  provenance: "CLIENT_REPORTED";
  classification: string;
}
export interface ReplayOutcome {
  status: string;
  comparisons: ReplayComparison[];
}
export function comparable(c: ExecutionResult): unknown {
  return {
    datasetHash: c.datasetHash,
    sql: c.sql,
    python: c.python,
    diagnostics: c.diagnostics ?? null,
    schema: c.schema,
    rows: c.rows,
    sqlSource: c.sqlSource,
    pythonSource: c.pythonSource,
  };
}
/** No API/provider/planner dependency. Approved IR is the only executable authority. */
export async function replayArtifact(
  artifact: Artifact,
  executor: ReplayExecutor,
  signal: AbortSignal,
): Promise<ReplayOutcome> {
  const comparisons: ReplayComparison[] = [];
  const abort = () => executor.cancel();
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new Error("CANCELLED");
    const a = await validateArtifact(artifact.manifest, artifact.snapshots);
    if (a.digest !== artifact.digest)
      throw new Error("MANIFEST_DIGEST_MISMATCH");
    await checkCompatibility(a.manifest);
    for (const c of a.manifest.calculations as Calculation[]) {
      if (signal.aborted) throw new Error("CANCELLED");
      const primary = a.snapshots.find((s) => s.hash === c.plan.datasetHash)!,
        lookup = c.plan.relationship
          ? a.snapshots.find((s) => s.hash === c.plan.relationship!.datasetHash)
          : undefined;
      const result = await executor.execute(
        c.plan,
        primary.bytes,
        lookup
          ? { bytes: lookup.bytes, approvedRelationship: true }
          : undefined,
      );
      if (signal.aborted) throw new Error("CANCELLED");
      const current = validateExecutionResult(result, c.plan);
      if (canonical(current.runtime) !== canonical(a.manifest.runtime))
        throw new Error("INCOMPATIBLE_RUNTIME");
      const verdict = evidenceVerdict(
        c.plan,
        current as unknown as Record<string, unknown>,
      );
      comparisons.push({
        id: c.id,
        saved: c.result,
        current,
        matches:
          canonical(comparable(c.result)) === canonical(comparable(current)),
        verification: verdict.state,
        classification: verdict.classification,
        provenance: "CLIENT_REPORTED",
      });
    }
    return {
      status: comparisons.every((c) => c.matches) ? "MATCH" : "MISMATCH",
      comparisons,
    };
  } catch (e) {
    const code = signal.aborted
      ? "CANCELLED"
      : e instanceof Error
        ? e.message
        : "EXECUTION_FAILED";
    const allowed = [
      "CANCELLED",
      "EXECUTOR_UNAVAILABLE",
      "EXECUTOR_CLOSED",
      "INVALID_RESULT",
      "TIMEOUT",
      "INCOMPATIBLE_COMPILER",
      "INCOMPATIBLE_RUNTIME",
      "MISSING_INPUT",
      "UNSUPPORTED_OPERATION",
      "UNSUPPORTED_SCHEMA",
      "DATASET_HASH_MISMATCH",
      "SNAPSHOT_HASH_MISMATCH",
      "MANIFEST_DIGEST_MISMATCH",
      "EVIDENCE_DIGEST_MISMATCH",
    ];
    return {
      status: allowed.includes(code) ? code : "EXECUTION_FAILED",
      comparisons,
    };
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
