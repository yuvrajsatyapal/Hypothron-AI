import { expect, test } from "vitest";
import { fixture } from "./artifactFixture";
import { createArtifact, validateArtifact } from "../lib/artifacts";
import { contentHash } from "../../executor/src/contracts";
import { exportBundle, importBundle } from "../lib/bundles";
import { readFile } from "node:fs/promises";

test("Parquet source lineage creates strict v2 and round trips both immutable byte identities", async () => {
  const f = await fixture();
  const original = new Uint8Array(
    await readFile("tests/fixtures/phase5-revenue.parquet"),
  );
  const sourceHash = await contentHash(original);
  const source = {
    sourceHash,
    datasetHash: f.calculations[0].plan.datasetHash,
    normalization: "parquet-csv-v1" as const,
    decoder: "duckdb-v1.4.3" as const,
    rows: 1,
    schema: [
      { name: "id", type: "INTEGER" },
      { name: "completed_at", type: "VARCHAR" },
      { name: "revenue", type: "DECIMAL(10,2)" },
    ],
  };
  const a = await createArtifact({
    ...f,
    sources: [{ ...source, bytes: original }],
  });
  expect(a.manifest.version).toBe(2);
  expect(a.manifest.sources).toEqual([source]);
  expect(a.snapshots).toHaveLength(2);
  expect((await importBundle(exportBundle(a))).digest).toBe(a.digest);
  await expect(
    validateArtifact(
      { ...a.manifest, sources: [{ ...source, extra: true }] },
      a.snapshots,
    ),
  ).rejects.toThrow();
  await expect(
    validateArtifact(
      { ...a.manifest, sources: [{ ...source, datasetHash: "a".repeat(64) }] },
      a.snapshots,
    ),
  ).rejects.toThrow();
  await expect(
    validateArtifact({ ...a.manifest, version: 1 }, a.snapshots),
  ).rejects.toThrow();
  await expect(
    validateArtifact(
      {
        ...a.manifest,
        sources: [{ ...source, schema: [{ name: true, type: "VARCHAR" }] }],
      },
      a.snapshots,
    ),
  ).rejects.toThrow();
  await expect(
    validateArtifact(
      {
        ...a.manifest,
        sources: [
          {
            ...source,
            schema: [
              { name: "id", type: "VARCHAR" },
              { name: "ID", type: "VARCHAR" },
            ],
          },
        ],
      },
      a.snapshots,
    ),
  ).rejects.toThrow();
});

test("CSV-only manifests retain v1 and reject injected source lineage", async () => {
  const a = await createArtifact(await fixture());
  expect(a.manifest.version).toBe(1);
  expect(a.manifest).not.toHaveProperty("sources");
  await expect(
    validateArtifact({ ...a.manifest, sources: [] }, a.snapshots),
  ).rejects.toThrow("INVALID_MANIFEST");
});
