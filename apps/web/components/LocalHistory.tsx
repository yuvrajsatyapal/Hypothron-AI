"use client";
import { useEffect, useRef, useState } from "react";
import {
  createArtifact,
  LIMITS,
  type Artifact,
  type ArtifactInput,
} from "../lib/artifacts";
import { LocalStore, type ReplayRecord } from "../lib/storage";
import { exportBundle, importBundle } from "../lib/bundles";
import { replayArtifact, type ReplayOutcome } from "../lib/replay";
import { EvidenceReport } from "./EvidenceReport";
import type { ExecutionResult, MetricPlan } from "../lib/execution";
export type Execute = (
  plan: MetricPlan,
  bytes: Uint8Array,
  lookup?: { bytes: Uint8Array; approvedRelationship: true },
) => Promise<ExecutionResult>;
export function LocalHistory({
  input,
  disabled = false,
  execute,
  cancelLocal,
  onBusy,
  onFresh,
}: {
  input: ArtifactInput | null;
  disabled?: boolean;
  execute?: Execute;
  cancelLocal?: () => void;
  onBusy?: (busy: boolean) => void;
  onFresh?: (a: Artifact) => void;
}) {
  const store = useRef<LocalStore | null>(null),
    controller = useRef<AbortController | null>(null);
  const [records, setRecords] = useState<
      Awaited<ReturnType<LocalStore["list"]>>
    >([]),
    [selected, setSelected] = useState<Artifact | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Nothing is saved automatically."),
    [imported, setImported] = useState<Artifact | null>(null),
    [importConsent, setImportConsent] = useState(false),
    [outcome, setOutcome] = useState<ReplayOutcome | null>(null),
    [history, setHistory] = useState<ReplayRecord[]>([]);
  function local() {
    if (!store.current) store.current = new LocalStore();
    return store.current;
  }
  async function refresh() {
    setRecords(await local().list());
  }
  useEffect(() => {
    let active = true;
    void local()
      .list()
      .then((r) => {
        if (active) setRecords(r);
      })
      .catch(() => {
        if (active)
          setMessage(
            "STORAGE_UNAVAILABLE: browser-local records could not be read.",
          );
      });
    return () => {
      active = false;
      controller.current?.abort();
      store.current?.close();
    };
  }, []);
  useEffect(() => {
    setConsent(false);
  }, [input?.id]);
  async function action(work: () => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true);
    onBusy?.(true);
    try {
      await work();
    } catch (e) {
      const code = e instanceof Error ? e.message : "STORAGE_UNAVAILABLE";
      const recovery: Record<string, string> = {
        QUOTA_EXCEEDED:
          "Export records you need, delete saved investigations to free space, then retry. Nothing from this failed Save was committed.",
        STORAGE_UNAVAILABLE:
          "Retry or reopen this application; browser settings may prevent local storage. Your unsaved data remains in memory until reload.",
        MISSING_INPUT:
          "Saved data may have been deleted or evicted. Re-import an exact exported bundle with explicit consent, or select the original data again.",
        SNAPSHOT_HASH_MISMATCH:
          "Stored bytes are missing or damaged. Preserve an exported original if available; delete damaged history and explicitly import a validated exact bundle.",
        IDENTIFIER_COLLISION:
          "This identifier already has different content. Import cannot overwrite its history; keep the original record and use a separately identified investigation.",
      };
      setMessage(
        code +
          (recovery[code]
            ? ": " + recovery[code]
            : ". The action did not complete; inspect the input and retry."),
      );
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  async function replay() {
    if (!selected || !execute) return;
    const original = await local().load(selected.manifest.id);
    const control = new AbortController();
    controller.current = control;
    setOutcome({ status: "RUNNING", comparisons: [] });
    const result = await replayArtifact(
      original,
      { execute, cancel: () => cancelLocal?.() },
      control.signal,
    );
    controller.current = null;
    setOutcome(result);
    setMessage(
      "Replay " +
        result.status +
        ". Original historical evidence is unchanged.",
    );
    try {
      await local().recordReplay({
        id: crypto.randomUUID(),
        investigationId: original.manifest.id,
        manifestDigest: original.digest,
        createdAt: new Date().toISOString(),
        ...result,
      });
      setHistory(await local().replayHistory(original.manifest.id));
    } catch (e) {
      setMessage(
        "Replay " +
          result.status +
          "; history was not saved: " +
          (e instanceof Error ? e.message : "STORAGE_UNAVAILABLE"),
      );
    }
  }
  return (
    <section
      id="local-history"
      className="controls"
      role="region"
      aria-label="Local investigation history"
    >
      <h2>Local investigation history</h2>
      <p>
        Save stores original CSV/Parquet and derived canonical CSV snapshots,
        question, approved contracts, compiled source, results and report on
        this browser. Scripts running in this application origin can access
        them. Storage is unencrypted and can be evicted; exports are separate
        sensitive copies. Credentials and session capabilities are excluded.
        Approximate logical quota: 64 MiB / 20 investigations.
      </p>
      <label className="consent-row">
        <input
          type="checkbox"
          checked={consent}
          disabled={!input || busy || disabled}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I approve saving these snapshots and artifacts on this browser
      </label>
      <button
        disabled={!input || !consent || busy || disabled}
        onClick={() =>
          action(async () => {
            const a = await createArtifact(input!);
            await local().save(a, true);
            setSelected(a);
            setOutcome(null);
            setHistory([]);
            setConsent(false);
            await refresh();
            setMessage("Saved atomically. Browser storage is not permanent.");
          })
        }
      >
        Save investigation
      </button>
      <p role="status" aria-live="polite" data-testid="storage-status">
        {message}
      </p>
      <button
        className="secondary"
        disabled={busy || disabled}
        onClick={() =>
          action(async () => {
            await refresh();
            setMessage(
              "History refreshed; absent records may have been deleted or evicted.",
            );
          })
        }
      >
        Refresh saved history
      </button>
      {records.length === 0 && <p>No saved investigations.</p>}
      {records.map((r) => (
        <article key={r.id} data-testid="saved-record">
          <h3>{r.manifest.question}</h3>
          <p className="hash">
            {r.id} · {r.origin} · approximate {r.size} bytes
          </p>
          <div className="actions">
            <button
              className="secondary"
              disabled={busy || disabled}
              onClick={() =>
                action(async () => {
                  setSelected(await local().load(r.id));
                  setOutcome(null);
                  setHistory(await local().replayHistory(r.id));
                  setMessage(
                    "Playback: stored historical evidence; no calculations executed.",
                  );
                })
              }
            >
              Load playback
            </button>
            <button
              className="secondary"
              disabled={busy || disabled}
              onClick={() =>
                action(async () => {
                  await local().delete(r.id);
                  if (selected?.manifest.id === r.id) {
                    setSelected(null);
                    setOutcome(null);
                    setHistory([]);
                  }
                  await refresh();
                  setMessage(
                    "Deleted saved investigation and unreferenced snapshots. Exported copies are unaffected.",
                  );
                })
              }
            >
              Delete saved investigation
            </button>
          </div>
        </article>
      ))}
      {selected && (
        <div data-testid="stored-evidence">
          <h3>Stored report playback</h3>
          <p>
            Historical CLIENT_REPORTED evidence; integrity validation does not
            establish numerical truth or server attestation.
          </p>
          {selected.manifest.calculations.map((c) => (
            <p key={c.id}>
              {c.id} · {c.result.sql.minorUnits ?? "undefined"} /{" "}
              {c.result.python.minorUnits ?? "undefined"} · historical{" "}
              {c.verification} · {c.provenance} · dependencies:{" "}
              {c.dependsOn.join(", ") || "none"}
            </p>
          ))}
          {selected.manifest.report && (
            <EvidenceReport report={selected.manifest.report} />
          )}
          <details>
            <summary>
              Inspect stored manifest, lineage and compiled source
            </summary>
            <pre
              tabIndex={0}
              role="region"
              aria-label="Stored manifest and compiled source"
            >
              {JSON.stringify(selected.manifest, null, 2)}
            </pre>
          </details>
          <div className="actions">
            <button
              disabled={busy || disabled || !execute}
              onClick={() => action(replay)}
            >
              Replay saved investigation
            </button>
            <button
              className="secondary"
              disabled={!controller.current}
              onClick={() => controller.current?.abort()}
            >
              Cancel saved replay
            </button>
            <button
              className="secondary"
              disabled={busy || disabled}
              onClick={() =>
                action(async () => {
                  const a = await local().load(selected.manifest.id),
                    bytes = exportBundle(a),
                    url = URL.createObjectURL(
                      new Blob([new Uint8Array(bytes).buffer], {
                        type: "application/zip",
                      }),
                    );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "hypothron-" + a.manifest.id + ".zip";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  setMessage(
                    "Exported sensitive source snapshots and metadata; no credentials.",
                  );
                })
              }
            >
              Export investigation bundle
            </button>
            {onFresh && (
              <button
                className="secondary"
                disabled={busy || disabled}
                onClick={() =>
                  action(async () => {
                    const a = await local().load(selected.manifest.id);
                    onFresh(a);
                    setMessage(
                      "Fresh AI context loaded into memory. Enter a fresh key and approve provider disclosure separately.",
                    );
                  })
                }
              >
                Start separate fresh AI investigation
              </button>
            )}
          </div>
        </div>
      )}
      {outcome && (
        <div>
          <p role="status" aria-live="polite" data-testid="replay-status">
            {outcome.status}
          </p>
          <div
            role="region"
            aria-label="Replay evidence differences"
            tabIndex={0}
            style={{ overflowX: "auto" }}
          >
            <table data-testid="replay-differences">
              <caption>
                Exact saved/current evidence; timing and allocation differences
                do not affect matches.
              </caption>
              <thead>
                <tr>
                  <th>Calculation</th>
                  <th>Saved SQL / Pandas</th>
                  <th>Current SQL / Pandas</th>
                  <th>Comparison</th>
                  <th>Current local verification</th>
                </tr>
              </thead>
              <tbody>
                {outcome.comparisons.map((c) => (
                  <tr key={c.id}>
                    <th>{c.id}</th>
                    <td>
                      {c.saved.sql.minorUnits ?? "undefined"} /{" "}
                      {c.saved.python.minorUnits ?? "undefined"} (rows{" "}
                      {c.saved.sql.count}/{c.saved.python.count})
                    </td>
                    <td>
                      {c.current.sql.minorUnits ?? "undefined"} /{" "}
                      {c.current.python.minorUnits ?? "undefined"} (rows{" "}
                      {c.current.sql.count}/{c.current.python.count})
                    </td>
                    <td>{c.matches ? "MATCH" : "MISMATCH"}</td>
                    <td>
                      {c.verification} · {c.provenance} · {c.classification}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {history.length > 0 && (
        <details>
          <summary>
            Replay history ({history.length}, latest ten retained)
          </summary>
          {history.map((r) => (
            <p key={r.id}>
              {r.createdAt} · {r.status} · {r.id}
            </p>
          ))}
        </details>
      )}
      <h3>Import a portable bundle</h3>
      <label>
        Import investigation bundle
        <input
          type="file"
          accept=".zip,application/zip"
          disabled={busy || disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            setImported(null);
            setImportConsent(false);
            if (!file) return;
            void action(async () => {
              if (file.size > LIMITS.bundle) throw new Error("BUNDLE_LIMIT");
              const a = await importBundle(
                new Uint8Array(await file.arrayBuffer()),
              );
              setImported(a);
              setMessage(
                "Bundle validated in memory; no persistent write until confirmation.",
              );
            });
          }}
        />
      </label>
      {imported && (
        <div data-testid="import-preview">
          <p>
            Validated in memory: {imported.manifest.question} · {imported.size}{" "}
            approximate bytes · {imported.manifest.snapshots.length} snapshots.
            Imported verification is historical CLIENT_REPORTED, not
            independently trusted.
          </p>
          <label className="consent-row">
            <input
              type="checkbox"
              checked={importConsent}
              disabled={busy || disabled}
              onChange={(e) => setImportConsent(e.target.checked)}
            />
            I approve storing this validated imported bundle locally
          </label>
          <button
            disabled={!importConsent || busy || disabled}
            onClick={() =>
              action(async () => {
                await local().save(imported, true, "imported");
                setImported(null);
                setImportConsent(false);
                await refresh();
                setMessage(
                  "Imported atomically; original identifiers and historical evidence preserved.",
                );
              })
            }
          >
            Confirm local import
          </button>
        </div>
      )}
    </section>
  );
}
