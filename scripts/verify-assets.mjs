import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
export async function verifyAssets(root, assets) {
  for (const [name, expected] of Object.entries(assets)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error("INVALID_ASSET_NAME");
    const bytes = await readFile(resolve(root, name));
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw new Error("ASSET_HASH_MISMATCH");
  }
}

export function verifyManifest(expected, actual) {
  if (!isDeepStrictEqual(expected, actual))
    throw new Error("RUNTIME_MANIFEST_DRIFT");
}
