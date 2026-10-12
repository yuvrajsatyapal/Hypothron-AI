import { test, expect, vi } from "vitest";
import { replayArtifact } from "../lib/replay";
import { createArtifact, manifestDigest } from "../lib/artifacts";
import { fixture } from "./artifactFixture";
test("replay has no provider dependency; actively denied fetch; original immutable", async () => {
  const f = await fixture(),
    a = await createArtifact(f),
    before = JSON.stringify(a.manifest);
  const denied = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("INFERENCE_FORBIDDEN");
  });
  try {
    const r = await replayArtifact(
      a,
      {
        execute: async () => structuredClone(f.calculations[0].result),
        cancel() {},
      },
      new AbortController().signal,
    );
    expect(r.status).toBe("MATCH");
    expect(r.comparisons[0].verification).toBe("VERIFIED");
    expect(denied).not.toHaveBeenCalled();
    expect(JSON.stringify(a.manifest)).toBe(before);
  } finally {
    denied.mockRestore();
  }
});
test("exact mismatch/disputed recomputation is preserved", async () => {
  const f = await fixture(),
    a = await createArtifact(f);
  const result = structuredClone(f.calculations[0].result);
  result.python.minorUnits = "1011";
  const r = await replayArtifact(
    a,
    { execute: async () => result, cancel() {} },
    new AbortController().signal,
  );
  expect(r.status).toBe("MISMATCH");
  expect(r.comparisons[0].verification).toBe("DISPUTED");
  expect(r.comparisons[0].current.python.minorUnits).toBe("1011");
});
test("runtime/compiler refusal occurs before execution; cancel and failure do not rewrite original", async () => {
  const f = await fixture(),
    a = await createArtifact(f),
    execute = vi.fn(async () => f.calculations[0].result),
    cancel = vi.fn();
  const changed = structuredClone(a);
  changed.manifest.compiler = "unknown";
  changed.digest = await manifestDigest(changed.manifest);
  const r = await replayArtifact(
    changed,
    { execute, cancel },
    new AbortController().signal,
  );
  expect(r.status).toBe("INCOMPATIBLE_COMPILER");
  expect(execute).not.toHaveBeenCalled();
  const controller = new AbortController();
  controller.abort();
  expect(
    (await replayArtifact(a, { execute, cancel }, controller.signal)).status,
  ).toBe("CANCELLED");
  expect(
    (
      await replayArtifact(
        a,
        {
          execute: async () => {
            throw new Error("EXECUTION_FAILED");
          },
          cancel,
        },
        new AbortController().signal,
      )
    ).status,
  ).toBe("EXECUTION_FAILED");
  expect(
    (await replayArtifact(a, { execute, cancel }, new AbortController().signal))
      .status,
  ).toBe("MATCH");
});
