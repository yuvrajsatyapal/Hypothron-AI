import { evidenceVerdict } from "../lib/verification";
import {
  validatePlan,
  type MetricPlan,
  type ExecutionResult,
} from "../lib/execution";
export interface MetricApproval {
  datasetHash: string;
  amountColumn: string;
  dateColumn: string;
  start: string;
  end: string;
  advanced: boolean;
  currency: MetricPlan["currency"];
  timezone: string;
  nullPolicy: MetricPlan["nullPolicy"];
  grain: string;
  lookup?: NonNullable<MetricPlan["relationship"]> & { approved: boolean };
}
export function approvedMetric(input: MetricApproval): MetricPlan {
  if (input.lookup && (!input.advanced || !input.lookup.approved))
    throw new Error("RELATIONSHIP_APPROVAL_REQUIRED");
  const plan: MetricPlan = {
    version: input.advanced ? 2 : 1,
    kind: "revenue_sum",
    datasetHash: input.datasetHash,
    amountColumn: input.amountColumn,
    dateColumn: input.dateColumn,
    start: input.start,
    end: input.end,
    currency: input.advanced ? input.currency : "USD",
    timezone: input.advanced ? input.timezone : "UTC",
    nullPolicy: input.nullPolicy,
    ...(input.advanced
      ? {
          grainKeys: input.grain
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          relationship: input.lookup
            ? {
                datasetHash: input.lookup.datasetHash,
                keyColumn: input.lookup.keyColumn,
                lookupKeyColumn: input.lookup.lookupKeyColumn,
                cardinality: input.lookup.cardinality,
                populationCount: input.lookup.populationCount,
              }
            : null,
        }
      : {}),
  };
  return validatePlan(plan);
}

export function executionVerdict(
  plan: MetricPlan,
  result: Pick<ExecutionResult, "sql" | "python" | "diagnostics">,
) {
  return evidenceVerdict(plan, { ...result });
}
