import { evidenceVerdict } from "./verification";
import { validateExecutionResult } from "../../executor/src/contracts";
import { comparable } from "./replay";
import type { ReplayComparison } from "./replay";
import Dexie, { type Table } from "dexie";
import {
  canonical,
  LIMITS,
  validateArtifact,
  type Artifact,
  type Manifest,
  type SnapshotBlob,
  exact,
} from "./artifacts";
export const DB_NAME = "hypothron-local-v1";
interface Saved {
  id: string;
  digest: string;
  manifest: Manifest;
  size: number;
  origin: "local" | "imported";
}
export interface ReplayRecord {
  id: string;
  investigationId: string;
  manifestDigest: string;
  createdAt: string;
  status: string;
  comparisons: ReplayComparison[];
}
class ArtifactDB extends Dexie {
  investigations!: Table<Saved, string>;
  snapshots!: Table<SnapshotBlob, string>;
  replays!: Table<ReplayRecord, string>;
  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      investigations: "id",
      snapshots: "hash",
      replays: "id,investigationId",
    });
    this.on("versionchange", () => this.close());
  }
}
export class LocalStore {
  private db: ArtifactDB | null = null;
  constructor(private quota: number = LIMITS.storage) {}
  close() {
    this.db?.close();
    this.db = null;
  }
  private async open(create = false): Promise<ArtifactDB | null> {
    if (!create && !(await Dexie.getDatabaseNames()).includes(DB_NAME)) {
      this.close();
      return null;
    }
    if (this.db?.isOpen()) return this.db;
    // Dynamic inspection first: never downgrade a newer on-disk schema.
    if ((await Dexie.getDatabaseNames()).includes(DB_NAME)) {
      const inspect = new Dexie(DB_NAME);
      try {
        await inspect.open();
        if (inspect.verno !== 1) throw new Error("UNSUPPORTED_STORAGE_SCHEMA");
      } finally {
        inspect.close();
      }
    }
    const db = new ArtifactDB();
    try {
      await db.open();
      this.db = db;
      return db;
    } catch {
      db.close();
      throw new Error("STORAGE_UNAVAILABLE");
    }
  }
  async list(): Promise<Saved[]> {
    const db = await this.open();
    return db ? db.investigations.toArray() : [];
  }
  async save(
    artifact: Artifact,
    consent: boolean,
    origin: "local" | "imported" = "local",
  ): Promise<void> {
    if (consent !== true) throw new Error("SAVE_CONSENT_REQUIRED");
    // All async hashing is outside IndexedDB transaction; detach caller-owned objects.
    const a = await validateArtifact(artifact.manifest, artifact.snapshots);
    if (a.digest !== artifact.digest)
      throw new Error("MANIFEST_DIGEST_MISMATCH");
    const db = (await this.open(true))!;
    try {
      await db.transaction(
        "rw",
        db.investigations,
        db.snapshots,
        db.replays,
        async () => {
          const existing = await db.investigations.get(a.manifest.id);
          if (existing) {
            if (existing.digest !== a.digest)
              throw new Error("IDENTIFIER_COLLISION");
            if (canonical(existing.manifest) !== canonical(a.manifest))
              throw new Error("MANIFEST_DIGEST_MISMATCH");
          }
          const records = (await db.investigations.toArray()).filter(
            (r) => r.id !== a.manifest.id,
          );
          if (records.length >= LIMITS.records)
            throw new Error("QUOTA_EXCEEDED");
          const stored = await db.snapshots.toArray();
          const replayBytes = (await db.replays.toArray()).reduce(
            (n, r) => n + new TextEncoder().encode(canonical(r)).length,
            0,
          );
          const size =
            replayBytes +
            stored.reduce((n, b) => n + b.bytes.byteLength, 0) +
            records.reduce(
              (n, r) =>
                n +
                (r.size - r.manifest.snapshots.reduce((v, s) => v + s.size, 0)),
              0,
            ) +
            a.size -
            a.snapshots
              .filter((b) => stored.some((s) => s.hash === b.hash))
              .reduce((n, b) => n + b.bytes.byteLength, 0);
          if (size > this.quota) throw new Error("QUOTA_EXCEEDED");
          for (const b of a.snapshots) {
            const old = stored.find((s) => s.hash === b.hash);
            if (old) {
              if (
                old.bytes.byteLength !== b.bytes.byteLength ||
                old.bytes.some((x, i) => x !== b.bytes[i])
              )
                throw new Error("SNAPSHOT_HASH_MISMATCH");
            } else await db.snapshots.add(b);
          }
          if (!existing)
            await db.investigations.add({
              id: a.manifest.id,
              digest: a.digest,
              manifest: a.manifest,
              size: a.size,
              origin,
            });
        },
      );
    } catch (e) {
      if (e instanceof Error && e.name === "QuotaExceededError")
        throw new Error("QUOTA_EXCEEDED");
      throw e;
    }
  }
  async load(id: string): Promise<Artifact> {
    const db = await this.open();
    if (!db) throw new Error("MISSING_INPUT");
    const saved = await db.transaction(
      "r",
      db.investigations,
      db.snapshots,
      async () => {
        const record = await db.investigations.get(id);
        if (!record) throw new Error("MISSING_INPUT");
        const snapshots = await db.snapshots.bulkGet(
          record.manifest.snapshots.map((s) => s.hash),
        );
        if (snapshots.some((s) => !s)) throw new Error("MISSING_INPUT");
        return { record, snapshots: snapshots as SnapshotBlob[] };
      },
    );
    const a = await validateArtifact(saved.record.manifest, saved.snapshots);
    if (a.digest !== saved.record.digest)
      throw new Error("MANIFEST_DIGEST_MISMATCH");
    return a;
  }
  async delete(id: string): Promise<void> {
    const db = await this.open();
    if (!db) throw new Error("MISSING_INPUT");
    await db.transaction(
      "rw",
      db.investigations,
      db.snapshots,
      db.replays,
      async () => {
        await db.investigations.delete(id);
        await db.replays.where("investigationId").equals(id).delete();
        const referenced = new Set(
          (await db.investigations.toArray()).flatMap((r) =>
            r.manifest.snapshots.map((s) => s.hash),
          ),
        );
        for (const s of await db.snapshots.toArray())
          if (!referenced.has(s.hash)) await db.snapshots.delete(s.hash);
      },
    );
  }
  async recordReplay(record: ReplayRecord): Promise<void> {
    exact(record, [
      "id",
      "investigationId",
      "manifestDigest",
      "createdAt",
      "status",
      "comparisons",
    ]);
    if (
      !/^[A-Za-z0-9_-]{1,64}$/.test(record.id) ||
      !Number.isFinite(Date.parse(record.createdAt)) ||
      !Array.isArray(record.comparisons) ||
      record.comparisons.length > 6 ||
      ![
        "MATCH",
        "MISMATCH",
        "CANCELLED",
        "EXECUTOR_UNAVAILABLE",
        "EXECUTOR_CLOSED",
        "INVALID_RESULT",
        "TIMEOUT",
        "INCOMPATIBLE_COMPILER",
        "INCOMPATIBLE_RUNTIME",
        "MISSING_INPUT",
        "UNSUPPORTED_OPERATION",
        "UNSUPPORTED_SCHEMA",
        "DATASET_HASH_MISMATCH",
        "SNAPSHOT_HASH_MISMATCH",
        "MANIFEST_DIGEST_MISMATCH",
        "EVIDENCE_DIGEST_MISMATCH",
        "EXECUTION_FAILED",
      ].includes(record.status)
    )
      throw new Error("INVALID_REPLAY_RECORD");
    const a = await this.load(record.investigationId);
    if (a.digest !== record.manifestDigest)
      throw new Error("MANIFEST_DIGEST_MISMATCH");
    for (const [i, c] of record.comparisons.entries()) {
      exact(c, [
        "id",
        "saved",
        "current",
        "matches",
        "verification",
        "provenance",
        "classification",
      ]);
      const original = a.manifest.calculations[i];
      if (
        !original ||
        c.id !== original.id ||
        canonical(c.saved) !== canonical(original.result) ||
        typeof c.matches !== "boolean" ||
        c.provenance !== "CLIENT_REPORTED"
      )
        throw new Error("INVALID_REPLAY_RECORD");
      validateExecutionResult(c.current, original.plan);
      if (
        c.matches !==
        (canonical(comparable(c.saved)) === canonical(comparable(c.current)))
      )
        throw new Error("INVALID_REPLAY_RECORD");
      const verdict = evidenceVerdict(
        original.plan,
        c.current as unknown as Record<string, unknown>,
      );
      if (
        verdict.state !== c.verification ||
        verdict.classification !== c.classification
      )
        throw new Error("INVALID_REPLAY_RECORD");
    }
    if (
      ["MATCH", "MISMATCH"].includes(record.status) &&
      (record.comparisons.length !== a.manifest.calculations.length ||
        record.status !==
          (record.comparisons.every((c) => c.matches) ? "MATCH" : "MISMATCH"))
    )
      throw new Error("INVALID_REPLAY_RECORD");
    const copy = JSON.parse(canonical(record)) as ReplayRecord,
      bytes = new TextEncoder().encode(canonical(copy)).length;
    if (bytes > 256 * 1024) throw new Error("REPLAY_LIMIT");
    const db = (await this.open())!;
    if (!db) throw new Error("MISSING_INPUT");
    await db.transaction(
      "rw",
      db.investigations,
      db.snapshots,
      db.replays,
      async () => {
        const original = await db.investigations.get(copy.investigationId);
        if (!original || original.digest !== copy.manifestDigest)
          throw new Error("MISSING_INPUT");
        const old = await db.replays
          .where("investigationId")
          .equals(copy.investigationId)
          .toArray();
        const removed =
          old.length >= 10
            ? old.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
            : null;
        const all = await db.investigations.toArray(),
          snapshots = await db.snapshots.toArray(),
          replays = await db.replays.toArray();
        const size =
          snapshots.reduce((n, s) => n + s.bytes.byteLength, 0) +
          all.reduce(
            (n, r) =>
              n + r.size - r.manifest.snapshots.reduce((v, s) => v + s.size, 0),
            0,
          ) +
          replays
            .filter((r) => r.id !== removed?.id)
            .reduce(
              (n, r) => n + new TextEncoder().encode(canonical(r)).length,
              0,
            ) +
          bytes;
        if (size > this.quota) throw new Error("QUOTA_EXCEEDED");
        if (removed) await db.replays.delete(removed.id);
        await db.replays.add(copy);
      },
    );
  }
  async replayHistory(id: string): Promise<ReplayRecord[]> {
    const db = await this.open();
    return db ? db.replays.where("investigationId").equals(id).toArray() : [];
  }
}
