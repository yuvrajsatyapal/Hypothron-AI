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
    event.origin !== "http://127.0.0.1:3000" ||
    event.source !== parent ||
    event.data?.type !== "CONNECT" ||
    Object.keys(event.data).length !== 1 ||
    event.ports.length !== 1 ||
    port
  )
    return;
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
        d.type !== "EXECUTE" ||
        typeof d.id !== "string" ||
        d.id.length > 64 ||
        !(d.bytes instanceof Uint8Array) ||
        worker ||
        !assets ||
        Object.keys(d).length !== 4
      )
        throw new Error("INVALID_JOB");
      const plan = validatePlan(d.plan);
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
              result: validateExecutionResult(reply.data.result, plan),
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
      worker.postMessage({ id: d.id, plan, bytes: d.bytes, assets: copies }, [
        d.bytes.buffer,
        ...Object.values(copies),
      ]);
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
    assets = loaded;
    port.postMessage({ type: "CONNECTED" });
  } catch {
    port.postMessage({ type: "BOOTSTRAP_FAILED" });
    port.close();
  }
});
