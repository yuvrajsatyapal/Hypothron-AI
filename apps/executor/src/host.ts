const APP_ORIGIN = process.env.HYPOTHRON_APP_ORIGIN || "http://127.0.0.1:3000";
import parquetLock from "../../../packages/contracts/parquet-runtime.json";
import { validateIngestion, parquetEnvelope } from "./ingestion";
import manifest from "../../../packages/contracts/runtime-manifest.json";
import { contentHash } from "./contracts";
import { validatePlan, validateExecutionResult } from "./contracts";
let assets: Record<string, ArrayBuffer> | null = null;
let port: MessagePort | null = null;
let worker: Worker | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let activeId: string | null = null;
const cleanup = () => {
  worker?.terminate();
  worker = null;
  activeId = null;
  if (timer) clearTimeout(timer);
  timer = null;
};
window.addEventListener("message", async (event: MessageEvent) => {
  if (
    event.origin !== APP_ORIGIN ||
    event.source !== parent ||
    !event.data ||
    typeof event.data !== "object" ||
    Array.isArray(event.data) ||
    Object.keys(event.data).length !== 1
  )
    return;
  if (event.data.type === "PROBE" && event.ports.length === 0) {
    parent.postMessage({ type: "HOST_READY" }, APP_ORIGIN);
    return;
  }
  if (event.data.type !== "CONNECT" || event.ports.length !== 1 || port) return;
  port = event.ports[0];
  port.onmessage = (message: MessageEvent<unknown>) => {
    if (
      !message.data ||
      typeof message.data !== "object" ||
      Array.isArray(message.data)
    )
      return;
    const d = message.data as Record<string, unknown>;
    if (d.type === "CANCEL") {
      if (d.id === activeId) {
        cleanup();
        port?.postMessage({ id: d.id, ok: false, error: "CANCELLED" });
      }
      return;
    }
    try {
      if (
        !["EXECUTE", "PARQUET"].includes(String(d.type)) ||
        typeof d.id !== "string" ||
        d.id.length > 64 ||
        !(d.bytes instanceof Uint8Array) ||
        worker ||
        !assets ||
        Object.keys(d).length !==
          (d.type === "PARQUET" ? 3 : d.lookupBytes === undefined ? 4 : 6) ||
        Object.keys(d).some(
          (k) =>
            ![
              "type",
              "id",
              "plan",
              "bytes",
              "lookupBytes",
              "approvedRelationship",
            ].includes(k),
        )
      )
        throw new Error("INVALID_JOB");
      const plan = d.type === "PARQUET" ? null : validatePlan(d.plan);
      if (!plan) parquetEnvelope(d.bytes);
      const relation = plan?.version === 2 ? plan.relationship : null;
      if (
        relation &&
        (!(d.lookupBytes instanceof Uint8Array) ||
          d.approvedRelationship !== true)
      )
        throw new Error("RELATIONSHIP_APPROVAL_REQUIRED");
      if (
        !relation &&
        (d.lookupBytes !== undefined || d.approvedRelationship !== undefined)
      )
        throw new Error("INVALID_JOB");
      if (
        d.lookupBytes instanceof Uint8Array &&
        d.lookupBytes.length + d.bytes.length > 10 * 1024 * 1024
      )
        throw new Error("INPUT_LIMIT");
      if (d.bytes.byteLength > 10 * 1024 * 1024) throw new Error("INPUT_LIMIT");
      activeId = d.id;
      worker = new Worker("/worker.js", { type: "module" });
      timer = setTimeout(() => {
        cleanup();
        port?.postMessage({ id: d.id, ok: false, error: "TIMEOUT" });
      }, 30000);
      worker.onmessage = (reply) => {
        try {
          if (reply.data?.id !== d.id) throw new Error("INVALID_RESULT");
          if (reply.data.ok === true)
            port?.postMessage({
              id: d.id,
              ok: true,
              result: plan
                ? validateExecutionResult(reply.data.result, plan)
                : validateIngestion(reply.data.result),
            });
          else
            port?.postMessage({
              id: d.id,
              ok: false,
              error: reply.data.error,
              stage: reply.data.stage,
            });
        } catch {
          port?.postMessage({ id: d.id, ok: false, error: "INVALID_RESULT" });
        } finally {
          cleanup();
        }
      };
      worker.onerror = () => {
        cleanup();
        port?.postMessage({ id: d.id, ok: false, error: "EXECUTION_FAILED" });
      };
      const copies = Object.fromEntries(
        Object.entries(assets!).map(([name, buffer]) => [
          name,
          buffer.slice(0),
        ]),
      );
      worker.postMessage(
        {
          id: d.id,
          ...(plan ? { plan } : { mode: "PARQUET" }),
          bytes: d.bytes,
          assets: copies,
          ...(relation
            ? { lookupBytes: d.lookupBytes, approvedRelationship: true }
            : {}),
        },
        [
          ...(d.lookupBytes instanceof Uint8Array
            ? [d.lookupBytes.buffer]
            : []),
          d.bytes.buffer,
          ...Object.values(copies),
        ],
      );
    } catch (error) {
      const code =
        error instanceof Error && /^[A-Z_]+$/.test(error.message)
          ? error.message
          : "INVALID_JOB";
      port?.postMessage({ id: d.id, ok: false, error: code });
    }
  };
  port.start();
  try {
    const loaded: Record<string, ArrayBuffer> = {};
    for (const [name, hash] of Object.entries(manifest.assets)) {
      if (name.endsWith(".js") || name.endsWith(".mjs")) continue;
      const response = await fetch("/assets/" + name);
      if (!response.ok) throw new Error("ASSET_LOAD_FAILED");
      const buffer = await response.arrayBuffer();
      if ((await contentHash(new Uint8Array(buffer))) !== hash)
        throw new Error("ASSET_HASH_MISMATCH");
      loaded[name] = buffer;
    }
    const extension = await fetch("/assets/parquet.duckdb_extension.wasm");
    if (!extension.ok) throw new Error("ASSET_LOAD_FAILED");
    const extensionBytes = await extension.arrayBuffer();
    if (
      (await contentHash(new Uint8Array(extensionBytes))) !== parquetLock.sha256
    )
      throw new Error("ASSET_HASH_MISMATCH");
    loaded["parquet.duckdb_extension.wasm"] = extensionBytes;
    assets = loaded;
    port.postMessage({ type: "CONNECTED" });
  } catch {
    port.postMessage({ type: "BOOTSTRAP_FAILED" });
    port.close();
  }
});
