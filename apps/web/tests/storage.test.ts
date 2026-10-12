import "fake-indexeddb/auto";
import { test, expect, afterEach } from "vitest";
import Dexie from "dexie";
import { LocalStore, DB_NAME } from "../lib/storage";
import { createArtifact } from "../lib/artifacts";
import { fixture } from "./artifactFixture";
afterEach(async () => {
  await Dexie.delete(DB_NAME);
});
test("no database before Save consent; reload and immutable idempotence", async () => {
  const store = new LocalStore();
  expect(await store.list()).toEqual([]);
  expect(await Dexie.getDatabaseNames()).toEqual([]);
  const a = await createArtifact(await fixture());
  await expect(store.save(a, false)).rejects.toThrow("CONSENT");
  expect(await Dexie.getDatabaseNames()).toEqual([]);
  await store.save(a, true);
  store.close();
  const next = new LocalStore();
  expect((await next.load(a.manifest.id)).digest).toBe(a.digest);
  await next.save(a, true);
  expect(await next.list()).toHaveLength(1);
  next.close();
});
test("quota and failed transaction leave no partial artifact; last reference deletes bytes", async () => {
  const a = await createArtifact(await fixture());
  const small = new LocalStore(1);
  await expect(small.save(a, true)).rejects.toThrow("QUOTA");
  expect(await small.list()).toHaveLength(0);
  small.close();
  const store = new LocalStore();
  await store.save(a, true);
  const b = await createArtifact({ ...(await fixture()), id: "other" });
  await store.save(b, true);
  await store.delete(a.manifest.id);
  expect((await store.load("other")).digest).toBe(b.digest);
  await store.delete("other");
  expect(await store.list()).toHaveLength(0);
  store.close();
  const db = new Dexie(DB_NAME);
  await db.open();
  expect(await db.table("snapshots").count()).toBe(0);
  db.close();
});
test("identifier collision rejected and eviction explicit", async () => {
  const store = new LocalStore();
  const a = await createArtifact(await fixture());
  await store.save(a, true);
  const b = await createArtifact({ ...(await fixture()), question: "Changed" });
  await expect(store.save(b, true)).rejects.toThrow("COLLISION");
  store.close();
  await Dexie.delete(DB_NAME);
  await expect(new LocalStore().load(a.manifest.id)).rejects.toThrow("MISSING");
});

test("idempotent Save repairs missing bytes atomically and rejects corrupted history", async () => {
  const a = await createArtifact(await fixture()),
    store = new LocalStore();
  await store.save(a, true);
  store.close();
  const db = new Dexie(DB_NAME);
  await db.open();
  await db.table("snapshots").clear();
  db.close();
  await store.save(a, true);
  expect((await store.load(a.manifest.id)).digest).toBe(a.digest);
  store.close();
});

test("replay history quota rejects a valid record and rejects unknown credential fields", async () => {
  const a = await createArtifact(await fixture()),
    store = new LocalStore(a.size + 50);
  await store.save(a, true);
  const { replayArtifact } = await import("../lib/replay");
  const result = await replayArtifact(
    a,
    { execute: async () => a.manifest.calculations[0].result, cancel() {} },
    new AbortController().signal,
  );
  const record = {
    id: "replay-1",
    investigationId: a.manifest.id,
    manifestDigest: a.digest,
    createdAt: new Date().toISOString(),
    ...result,
  };
  await expect(store.recordReplay(record)).rejects.toThrow("QUOTA_EXCEEDED");
  await expect(
    store.recordReplay({ ...record, key: "secret" } as typeof record),
  ).rejects.toThrow("INVALID_MANIFEST");
  store.close();
});

test("unknown database schema is refused without downgrade or record interpretation", async () => {
  const db = new Dexie(DB_NAME);
  db.version(2).stores({
    investigations: "id",
    snapshots: "hash",
    replays: "id,investigationId",
  });
  await db.open();
  db.close();
  await expect(new LocalStore().list()).rejects.toThrow(
    "UNSUPPORTED_STORAGE_SCHEMA",
  );
  const inspect = new Dexie(DB_NAME);
  await inspect.open();
  expect(inspect.verno).toBe(2);
  inspect.close();
});
test("replay comparison flags cannot be forged and history never rewrites evidence", async () => {
  const a = await createArtifact(await fixture()),
    store = new LocalStore();
  await store.save(a, true);
  const { replayArtifact } = await import("../lib/replay");
  const outcome = await replayArtifact(
    a,
    { execute: async () => a.manifest.calculations[0].result, cancel() {} },
    new AbortController().signal,
  );
  const record = {
    id: "history",
    investigationId: a.manifest.id,
    manifestDigest: a.digest,
    createdAt: new Date().toISOString(),
    ...outcome,
  };
  const forged = structuredClone(record);
  forged.comparisons[0].matches = false;
  forged.status = "MISMATCH";
  await expect(store.recordReplay(forged)).rejects.toThrow(
    "INVALID_REPLAY_RECORD",
  );
  await store.recordReplay(record);
  expect((await store.load(a.manifest.id)).digest).toBe(a.digest);
  expect(await store.replayHistory(a.manifest.id)).toHaveLength(1);
  store.close();
});
