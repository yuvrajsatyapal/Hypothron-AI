import { test, expect } from "vitest";
import { exportBundle, importBundle, encodeArchive } from "../lib/bundles";
import { createArtifact, LIMITS, canonical } from "../lib/artifacts";
import { fixture } from "./artifactFixture";
test("roundtrip bounded bundle and no credential fields", async () => {
  const a = await createArtifact(await fixture());
  const bytes = exportBundle(a);
  const b = await importBundle(bytes);
  expect(b.digest).toBe(a.digest);
  expect(b.snapshots[0].bytes).toEqual(a.snapshots[0].bytes);
  expect(new TextDecoder().decode(bytes)).not.toContain("Bearer");
});
test("reject unsafe/duplicate/unknown paths, compression and oversized container", async () => {
  for (const path of [
    "../manifest.json",
    "/manifest.json",
    "snapshots/../evil",
    "evil.py",
    "manifest.json\\evil",
  ])
    await expect(
      importBundle(
        encodeArchive([
          { path: "manifest.json", bytes: new Uint8Array([1]) },
          { path, bytes: new Uint8Array([1]) },
        ]),
      ),
    ).rejects.toThrow("INVALID_ARCHIVE_PATH");
  const duplicate = encodeArchive([
    { path: "manifest.json", bytes: new Uint8Array([1]) },
    { path: "manifest.json", bytes: new Uint8Array([1]) },
  ]);
  await expect(importBundle(duplicate)).rejects.toThrow();
  const a = await createArtifact(await fixture()),
    zip = exportBundle(a);
  zip[8] = 8;
  await expect(importBundle(zip)).rejects.toThrow("ARCHIVE");
  await expect(importBundle(new Uint8Array(LIMITS.bundle + 1))).rejects.toThrow(
    "LIMIT",
  );
});
test("tampering, trailing data, missing snapshots, unknown versions and unsupported IR rejected", async () => {
  const a = await createArtifact(await fixture());
  const bad = exportBundle(a);
  bad[50] ^= 1;
  await expect(importBundle(bad)).rejects.toThrow();
  const good = exportBundle(a);
  await expect(importBundle(new Uint8Array([...good, 1]))).rejects.toThrow();
  await expect(
    importBundle(
      encodeArchive([
        {
          path: "manifest.json",
          bytes: new TextEncoder().encode(
            canonical({ digest: a.digest, manifest: a.manifest }),
          ),
        },
      ]),
    ),
  ).rejects.toThrow();
  const m = structuredClone(a.manifest);
  m.version = 99 as 1;
  const changed = encodeArchive([
    {
      path: "manifest.json",
      bytes: new TextEncoder().encode(
        canonical({ digest: a.digest, manifest: m }),
      ),
    },
    ...a.snapshots.map((s) => ({
      path: `snapshots/${s.hash}.csv`,
      bytes: s.bytes,
    })),
  ]);
  await expect(importBundle(changed)).rejects.toThrow();
});

test("declared expansion bomb, zip encryption and overlapping entry offsets refuse", async () => {
  const a = await createArtifact(await fixture());
  for (const mutate of [
    (v: DataView) => {
      v.setUint32(22, 0xffffffff, true);
    },
    (v: DataView) => {
      v.setUint16(6, 1, true);
    },
    (v: DataView) => {
      v.setUint32(v.getUint32(v.byteLength - 6, true) + 42, 1, true);
    },
  ]) {
    const zip = exportBundle(a);
    mutate(new DataView(zip.buffer));
    await expect(importBundle(zip)).rejects.toThrow();
  }
});

test("rehashing does not authorize unsupported compiler/runtime imports", async () => {
  const a = await createArtifact(await fixture());
  const { manifestDigest } = await import("../lib/artifacts");
  for (const field of ["compiler", "runtimeLockDigest"] as const) {
    const m = structuredClone(a.manifest);
    m[field] = field === "compiler" ? "future" : "0".repeat(64);
    const bytes = encodeArchive([
      {
        path: "manifest.json",
        bytes: new TextEncoder().encode(
          canonical({ manifest: m, digest: await manifestDigest(m) }),
        ),
      },
      ...a.snapshots.map((s) => ({
        path: `snapshots/${s.hash}.csv`,
        bytes: s.bytes,
      })),
    ]);
    await expect(importBundle(bytes)).rejects.toThrow("INCOMPATIBLE");
  }
});
