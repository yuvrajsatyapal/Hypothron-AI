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
