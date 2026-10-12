import { test, expect } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyAssets } from "../verify-assets.mjs";
test("source assets changed after the runtime lock refuse to build", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hypothron-integrity-"));
  try {
    await writeFile(join(dir, "engine.js"), "tampered");
    const digest = createHash("sha256").update("reviewed").digest("hex");
    await expect(verifyAssets(dir, { "engine.js": digest })).rejects.toThrow(
      "ASSET_HASH_MISMATCH",
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("bootstrap compares source hashes against the committed manifest without rewriting it", async () => {
  const { verifyManifest } = await import("../verify-assets.mjs");
  const manifest = { version: 1, assets: { "engine.js": "reviewed" } };
  const before = JSON.stringify(manifest);
  expect(() =>
    verifyManifest(manifest, {
      version: 1,
      assets: { "engine.js": "tampered" },
    }),
  ).toThrow("RUNTIME_MANIFEST_DRIFT");
  expect(JSON.stringify(manifest)).toBe(before);
  expect(() => verifyManifest(manifest, { version: 1, assets: {} })).toThrow(
    "RUNTIME_MANIFEST_DRIFT",
  );
  expect(() =>
    verifyManifest(manifest, structuredClone(manifest)),
  ).not.toThrow();
});
