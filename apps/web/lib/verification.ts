import {
  validatePlan,
  validateNumeric,
  canonicalPlan,
  type MetricPlan,
} from "../../executor/src/contracts";
export function evidenceVerdict(
  plan: MetricPlan,
  evidence: Record<string, unknown>,
): { state: string; classification: string } {
  const left = validateNumeric(evidence.sql),
    right = validateNumeric(evidence.python);
  let state = "VERIFIED",
    classification = "AGREEMENT";
  if (left.count !== right.count) {
    state = "DISPUTED";
    classification = "POPULATION_MISMATCH";
  } else if (left.minorUnits === null || right.minorUnits === null) {
    state = "INCONCLUSIVE";
    classification = "EMPTY_POPULATION";
  } else if (left.minorUnits !== right.minorUnits) {
    state = "DISPUTED";
    classification = "VALUE_MISMATCH";
  }
  if (plan.version === 2) {
    const raw = evidence.diagnostics;
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return {
        state: "INCONCLUSIVE",
        classification: "INCOMPATIBLE_SEMANTICS",
      };
    const d = raw as Record<string, unknown>;
    if (canonicalPlan(validatePlan(d.contract)) !== canonicalPlan(plan))
      return {
        state: "INCONCLUSIVE",
        classification: "INCOMPATIBLE_SEMANTICS",
      };
    const expected = [
      "populationRows",
      "periodRows",
      "nullAmounts",
      "grainUniqueRows",
      "joinUniqueRows",
    ];
    const values = [d.sql, d.python].map((v) => {
      if (!v || typeof v !== "object" || Array.isArray(v))
        throw new Error("INVALID_RESPONSE");
      const c = v as Record<string, unknown>;
      if (
        Object.keys(c).length !== 5 ||
        expected.some(
          (k) =>
            !Number.isSafeInteger(c[k]) ||
            Number(c[k]) < 0 ||
            Number(c[k]) > 100000,
        )
      )
        throw new Error("INVALID_RESPONSE");
      return c as Record<string, number>;
    });
    if (values.some((c) => c.grainUniqueRows !== c.populationRows)) {
      state = "DISPUTED";
      classification = "GRAIN_VIOLATION";
    } else if (
      plan.nullPolicy === "error" &&
      values.some((c) => c.nullAmounts > 0)
    ) {
      state = "DISPUTED";
      classification = "NULL_POLICY_VIOLATION";
    } else if (expected.some((k) => values[0][k] !== values[1][k])) {
      state = "DISPUTED";
      classification = "SEMANTIC_DIAGNOSTIC_MISMATCH";
    } else if (
      values.some(
        (c, i) =>
          c.periodRows - c.nullAmounts !== [left, right][i].count ||
          c.periodRows > c.populationRows ||
          c.nullAmounts > c.periodRows,
      )
    ) {
      state = "DISPUTED";
      classification = "POPULATION_MISMATCH";
    } else if (
      plan.relationship &&
      values.some(
        (c) =>
          c.populationRows !== plan.relationship!.populationCount ||
          c.joinUniqueRows !== c.populationRows,
      )
    ) {
      state = "DISPUTED";
      classification = "JOIN_CARDINALITY";
    }
  }
  return { state, classification };
}
