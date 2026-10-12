"use client";
import { useEffect, useRef, useState } from "react";
import {
  createArtifact,
  type Artifact,
  type ArtifactInput,
} from "../lib/artifacts";
import { LocalStore } from "../lib/storage";
import type { ExecutionResult, MetricPlan } from "../lib/execution";
export type Execute = (
  plan: MetricPlan,
  bytes: Uint8Array,
  lookup?: { bytes: Uint8Array; approvedRelationship: true },
) => Promise<ExecutionResult>;
export function LocalHistory({
  input,
  disabled = false,
}: {
  input: ArtifactInput | null;
  disabled?: boolean;
}) {
  const store = useRef<LocalStore | null>(null);
  const [records, setRecords] = useState<
      Awaited<ReturnType<LocalStore["list"]>>
    >([]),
    [selected, setSelected] = useState<Artifact | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("Nothing is saved automatically.");
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
      store.current?.close();
    };
  }, []);
  useEffect(() => {
    setConsent(false);
  }, [input?.id]);
  async function action(work: () => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "STORAGE_UNAVAILABLE");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="controls"
      role="region"
      aria-label="Local investigation history"
    >
      <h2>Local investigation history</h2>
      <p>
        Save stores raw CSV snapshots, question, approved contracts, compiled
        source, results and report on this browser. Scripts running in this
        application origin can access them. Storage is unencrypted and can be
        evicted; exports are separate sensitive copies. Credentials and session
        capabilities are excluded. Approximate logical quota: 64 MiB / 20
        investigations.
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
                  if (selected?.manifest.id === r.id) setSelected(null);
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
          <details>
            <summary>
              Inspect stored manifest, lineage and compiled source
            </summary>
            <pre>{JSON.stringify(selected.manifest, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
