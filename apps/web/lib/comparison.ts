import { canonical, type Artifact } from "./artifacts";
/** Structural differences describe a new stochastic run, never semantic equivalence. */
export function compareInvestigations(original: Artifact, current: Artifact) {
  if (
    current.manifest.id === original.manifest.id ||
    current.manifest.parentId !== original.manifest.id
  )
    throw new Error("INVALID_PARENT");
  const pair = (saved: unknown, value: unknown) => ({
    saved,
    current: value,
    matches: canonical(saved) === canonical(value),
  });
  const plans = (a: Artifact) =>
    a.manifest.calculations.map((c) => ({
      plan: c.plan,
      dependsOn: c.dependsOn.map((id) =>
        a.manifest.calculations.findIndex((p) => p.id === id),
      ),
    }));
  return {
    hypotheses: pair(
      original.manifest.run?.hypotheses ?? [],
      current.manifest.run?.hypotheses ?? [],
    ),
    plans: pair(plans(original), plans(current)),
    findings: pair(original.manifest.report, current.manifest.report),
    verification: pair(
      original.manifest.calculations.map((c) => c.verification),
      current.manifest.calculations.map((c) => c.verification),
    ),
    tokens: pair(
      original.manifest.run?.tokens ?? null,
      current.manifest.run?.tokens ?? null,
    ),
    elapsed: pair(
      original.manifest.run?.providerElapsedMs ?? null,
      current.manifest.run?.providerElapsedMs ?? null,
    ),
  };
}
