import { test, expect } from "vitest";
import { createArtifact } from "../lib/artifacts";
import { fixture } from "./artifactFixture";
test("approved but unused inputs are preserved for a separately consented fresh run", async () => {
  const f = await fixture();
  const bytes = new TextEncoder().encode(
    "id,completed_at,revenue\n2,2025-07-01T00:00:00Z,20.20\n",
  );
  const { contentHash } = await import("../../executor/src/contracts");
  const plan = {
    ...f.calculations[0].plan,
    datasetHash: await contentHash(bytes),
  };
  const a = await createArtifact({
    ...f,
    snapshots: [...f.snapshots, bytes],
    approved: [f.calculations[0].plan, plan],
  });
  expect(a.manifest.approved).toHaveLength(2);
  expect(a.snapshots).toHaveLength(2);
});

test("unavailable run observations are null rather than fabricated zero", async () => {
  const a = await createArtifact({
    ...(await fixture()),
    run: {
      provider: "gemini",
      model: "test",
      hypotheses: [],
      tokens: null,
      providerElapsedMs: null,
      attempts: null,
    },
  });
  expect(a.manifest.run?.attempts).toBeNull();
});
