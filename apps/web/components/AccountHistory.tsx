"use client";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "./AccountProvider";
import { apiJSON, API_ORIGIN, record } from "../lib/investigation";
import { importBundle } from "../lib/bundles";
type Item = { id: string; question: string; savedAt: string; model: string };
export function AccountHistory() {
  const { account } = useAccount();
  const identity = useRef<string | null>(null);
  identity.current = account?.token ?? null;
  const currentAccount = () => !!account && identity.current === account.token;
  const [items, setItems] = useState<Item[]>([]),
    [viewed, setViewed] = useState<Record<string, unknown> | null>(null);
  const [objects, setObjects] = useState<{ id: string; byteLength: number }[]>(
    [],
  );
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false);
  useEffect(() => {
    setItems([]);
    setObjects([]);
    setViewed(null);
    setConsent(false);
    setBusy(false);
    setMessage("");
  }, [account?.token]);
  if (!account) return null;
  async function refresh() {
    if (!account) return;
    setBusy(true);
    try {
      const data = await apiJSON("/v1/account/history", account.token);
      if (!Array.isArray(data.items) || data.items.length > 100)
        throw new Error("INVALID_HISTORY");
      const rows = data.items.map((v: unknown) => {
        const r = record(v);
        for (const key of ["id", "question", "savedAt", "model"])
          if (typeof r[key] !== "string" || String(r[key]).length > 2000)
            throw new Error("INVALID_HISTORY");
        return {
          id: String(r.id),
          question: String(r.question),
          savedAt: String(r.savedAt),
          model: String(r.model),
        };
      });
      if (!currentAccount()) return;
      setItems(rows);
      const cloud = await apiJSON("/v1/account/artifacts", account.token);
      if (!currentAccount()) return;
      if (Array.isArray(cloud.items) && cloud.items.length <= 100)
        setObjects(
          cloud.items.map((v: unknown) => {
            const r = record(v);
            if (
              typeof r.id !== "string" ||
              !/^[a-f0-9-]{36}$/.test(r.id) ||
              !Number.isSafeInteger(r.byteLength)
            )
              throw new Error("INVALID_HISTORY");
            return { id: r.id, byteLength: Number(r.byteLength) };
          }),
        );
      setMessage(
        "Account history loaded. Reports are historical client-reported evidence; datasets are not included in metadata history.",
      );
    } catch (e) {
      if (!currentAccount()) return;
      setMessage(e instanceof Error ? e.message : "HISTORY_FAILED");
    } finally {
      if (currentAccount()) setBusy(false);
    }
  }
  async function view(id: string) {
    if (!account) return;
    setBusy(true);
    try {
      const r = await apiJSON(
        `/v1/account/history/${encodeURIComponent(id)}`,
        account.token,
      );
      if (!currentAccount()) return;
      setViewed(record(r.payload));
    } catch (e) {
      if (!currentAccount()) return;
      setMessage(e instanceof Error ? e.message : "HISTORY_FAILED");
    } finally {
      if (currentAccount()) setBusy(false);
    }
  }
  async function remove(id: string, cloud = false) {
    if (!account) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${API_ORIGIN}/v1/account/${cloud ? "artifacts" : "history"}/${encodeURIComponent(id)}/delete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${account.token}` },
          credentials: "omit",
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!currentAccount()) return;
      if (!response.ok) throw new Error("DELETE_FAILED");
      setViewed(null);
      await refresh();
    } catch (e) {
      if (!currentAccount()) return;
      setMessage(e instanceof Error ? e.message : "DELETE_FAILED");
    } finally {
      if (currentAccount()) setBusy(false);
    }
  }
  async function upload(file: File) {
    if (!account || !consent) return;
    setBusy(true);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("ARTIFACT_LIMIT");
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importBundle(bytes);
      if (!currentAccount()) return;
      const response = await fetch(
        `${API_ORIGIN}/v1/account/artifacts?consent=true&media_type=application%2Fzip`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.token}`,
            "Content-Type": "application/zip",
          },
          body: file,
          credentials: "omit",
          signal: AbortSignal.timeout(60000),
        },
      );
      if (!currentAccount()) return;
      if (!response.ok)
        throw new Error(
          response.status === 503
            ? "Cloud storage is disabled or unavailable."
            : "CLOUD_UPLOAD_FAILED",
        );
      setConsent(false);
      await refresh();
      if (!currentAccount()) return;
      setMessage(
        "Consented bundle uploaded privately. It includes raw snapshots. Local originals remain unchanged.",
      );
    } catch (e) {
      if (!currentAccount()) return;
      setMessage(e instanceof Error ? e.message : "CLOUD_UPLOAD_FAILED");
    } finally {
      if (currentAccount()) setBusy(false);
    }
  }
  async function download(id: string) {
    if (!account) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_ORIGIN}/v1/account/artifacts/${id}`, {
        headers: { Authorization: `Bearer ${account.token}` },
        credentials: "omit",
        signal: AbortSignal.timeout(30000),
      });
      if (!currentAccount()) return;
      if (!response.ok) throw new Error("CLOUD_DOWNLOAD_FAILED");
      const blob = await response.blob();
      if (blob.size > 20 * 1024 * 1024) throw new Error("ARTIFACT_LIMIT");
      await importBundle(new Uint8Array(await blob.arrayBuffer()));
      if (!currentAccount()) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `hypothron-${id}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "Validated bundle downloaded. Use the existing confirmed local import to replay on this device.",
      );
    } catch (e) {
      if (!currentAccount()) return;
      setMessage(e instanceof Error ? e.message : "CLOUD_DOWNLOAD_FAILED");
    } finally {
      if (currentAccount()) setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Account history">
      <h2>Account history</h2>
      <button disabled={busy} onClick={refresh}>
        Refresh account history
      </button>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.question} — {item.model} — {item.savedAt}
            <button disabled={busy} onClick={() => view(item.id)}>
              View saved report
            </button>
            <button disabled={busy} onClick={() => remove(item.id)}>
              Delete saved metadata
            </button>
          </li>
        ))}
      </ul>
      {viewed && (
        <details open>
          <summary>Saved investigation metadata and report</summary>
          <p>
            Historical playback. Raw datasets require exact reattachment or a
            separately consented cloud bundle.
          </p>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(viewed, null, 2)}
          </pre>
        </details>
      )}
      <details>
        <summary>Optional private cloud bundles</summary>
        <p>
          Export a saved local investigation first. A bundle includes raw
          dataset snapshots. Cloud upload is optional and requires explicit
          consent for each file; storage must be configured by the operator.
        </p>
        <label>
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          I approve uploading this investigation bundle and its raw datasets for
          cross-device access.
        </label>
        <label>
          Upload exported bundle
          <input
            type="file"
            accept=".zip"
            disabled={busy || !consent}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        <ul>
          {objects.map((o) => (
            <li key={o.id}>
              {o.id} ({o.byteLength} bytes)
              <button disabled={busy} onClick={() => download(o.id)}>
                Download bundle
              </button>
              <button disabled={busy} onClick={() => remove(o.id, true)}>
                Delete cloud bundle
              </button>
            </li>
          ))}
        </ul>
      </details>
      <p role="status">{message}</p>
    </section>
  );
}
