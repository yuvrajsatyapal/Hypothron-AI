import { test, expect } from "vitest";
import { compareInvestigations } from "../lib/comparison";
import { createArtifact } from "../lib/artifacts";
import { fixture } from "./artifactFixture";
test("fresh comparison requires a distinct linked run and preserves unknown measurements", async () => {
  const f = await fixture();
  const a = await createArtifact(f);
  const b = await createArtifact({
    ...f,
    id: "fresh-run",
    parentId: a.manifest.id,
    run: {
      provider: "gemini",
      model: "test",
      hypotheses: [],
      tokens: null,
      providerElapsedMs: 24,
      attempts: 1,
    },
  });
  const result = compareInvestigations(a, b);
  expect(result.tokens.current).toBeNull();
  expect(result.elapsed.current).toBe(24);
  expect(result.plans.matches).toBe(true);
  expect(() => compareInvestigations(a, a)).toThrow("INVALID_PARENT");
});
