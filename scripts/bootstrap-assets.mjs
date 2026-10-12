import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { verifyManifest } from "./verify-assets.mjs";
const manifestPath = "packages/contracts/runtime-manifest.json";
const update = process.argv.includes("--update-manifest");
const expected = update
  ? null
  : JSON.parse(await readFile(manifestPath, "utf8"));
const out = resolve("apps/executor/public/assets");
await mkdir(out, { recursive: true });
const py = resolve("apps/executor/node_modules/pyodide");
const duck = resolve("apps/executor/node_modules/@duckdb/duckdb-wasm/dist");
const files = [];
for (const name of [
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "pyodide.mjs",
  "pyodide-lock.json",
  "python_stdlib.zip",
]) {
  await copyFile(py + "/" + name, out + "/" + name);
  files.push(name);
}
for (const name of ["duckdb-eh.wasm", "duckdb-browser-eh.worker.js"]) {
  await copyFile(duck + "/" + name, out + "/" + name);
  files.push(name);
}
const lock = JSON.parse(await readFile(py + "/pyodide-lock.json", "utf8"));
const seen = new Set();
async function wheel(name) {
  if (seen.has(name)) return;
  seen.add(name);
  const p = lock.packages[name];
  for (const d of p.depends) await wheel(d);
  const dest = out + "/" + p.file_name;
  let data;
  try {
    data = await readFile(dest);
  } catch {
    const resp = await fetch(
      "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/" + p.file_name,
      { signal: AbortSignal.timeout(60000) },
    );
    if (!resp.ok) throw new Error("asset download failed " + p.file_name);
    data = Buffer.from(await resp.arrayBuffer());
  }
  if (createHash("sha256").update(data).digest("hex") !== p.sha256)
    throw new Error("asset integrity failure " + name);
  await writeFile(dest, data);
  files.push(p.file_name);
}
await wheel("pandas");
const assets = {};
for (const name of files)
  assets[name] = createHash("sha256")
    .update(await readFile(out + "/" + name))
    .digest("hex");
const actual = {
  version: 1,
  duckdbWasm: "1.32.0",
  pyodide: "0.29.3",
  pandas: lock.packages.pandas.version,
  numpy: lock.packages.numpy.version,
  assets,
};
if (update)
  await writeFile(manifestPath, JSON.stringify(actual, null, 2) + "\n");
else verifyManifest(expected, actual);
console.log(
  "Verified " +
    files.length +
    " pinned runtime assets against runtime manifest",
);
