import { pathToFileURL } from "node:url";

function policy(header, code) {
  const directives = new Map();
  for (const segment of (header || "").split(";")) {
    if (!segment.trim()) continue;
    const [name, ...sources] = segment.trim().split(/\s+/);
    if (!/^[a-z][a-z-]*$/.test(name) || directives.has(name) || !sources.length)
      throw new Error(code);
    directives.set(name, sources);
  }
  return directives;
}
function exact(directives, name, sources) {
  const actual = directives.get(name);
  return (
    actual?.length === sources.length &&
    sources.every((source) => actual.includes(source))
  );
}

export function checkResponse(kind, response) {
  if (response.status !== 200) throw new Error("RELEASE_PROBE_STATUS");
  const h = response.headers;
  if (
    h.get("cache-control") !== "no-store" ||
    h.get("x-content-type-options") !== "nosniff" ||
    h.get("referrer-policy") !== "no-referrer"
  )
    throw new Error("RELEASE_PROBE_HEADERS");
  if (kind === "worker") {
    const csp = policy(
      h.get("content-security-policy"),
      "RELEASE_PROBE_WORKER_POLICY",
    );
    if (
      !exact(csp, "default-src", ["'none'"]) ||
      !exact(csp, "connect-src", ["'none'"]) ||
      !exact(csp, "script-src", ["'wasm-unsafe-eval'"])
    )
      throw new Error("RELEASE_PROBE_WORKER_POLICY");
  }
  if (kind === "executor") {
    const csp = policy(
      h.get("content-security-policy"),
      "RELEASE_PROBE_ORIGIN_POLICY",
    );
    if (
      !exact(csp, "default-src", ["'none'"]) ||
      !exact(csp, "frame-ancestors", ["http://127.0.0.1:3000"])
    )
      throw new Error("RELEASE_PROBE_ORIGIN_POLICY");
  }
}

export async function probe() {
  const checks = [
    ["api", "http://127.0.0.1:8000/v1/ready"],
    ["executor", "http://127.0.0.1:3001/"],
    ["worker", "http://127.0.0.1:3001/worker.js"],
    ["worker", "http://127.0.0.1:3001/duckdb-worker.js"],
  ];
  for (const [kind, url] of checks) {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    checkResponse(kind, response);
    if (kind === "api") {
      const ready = await response.json();
      if (ready.database !== "ready" || ready.migration !== "0006_cloud_intents")
        throw new Error("RELEASE_PROBE_MIGRATION");
    } else await response.body?.cancel();
    console.log(JSON.stringify({ target: kind, status: "PASS", local: true }));
  }
  console.log(
    JSON.stringify({
      release: "BLOCKED",
      remaining:
        "Actual origins/TLS/proxy/SSE/cold-start/retention backups/global admission/live provider and device gates require separate evidence and authorization",
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await probe();
