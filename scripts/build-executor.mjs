import { verifyAssets } from "./verify-assets.mjs";
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
const manifest = JSON.parse(
  await readFile("packages/contracts/runtime-manifest.json", "utf8"),
);
await verifyAssets("apps/executor/public/assets", manifest.assets);
await build({
  entryPoints: ["apps/executor/src/host.ts", "apps/executor/src/worker.ts"],
  outdir: "apps/executor/public",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  external: ["node:*", "ws"],
});
const asm = await readFile(
  "apps/executor/public/assets/pyodide.asm.js",
  "utf8",
);
const worker = await readFile("apps/executor/public/worker.js", "utf8");
await writeFile(
  "apps/executor/public/worker.js",
  `(()=>{${asm}\nself._createPyodideModule=_createPyodideModule;})();\n${worker}`,
);
const duckdb = await readFile(
  "apps/executor/public/assets/duckdb-browser-eh.worker.js",
  "utf8",
);
// A capture listener configures the fixed in-memory asset reader before DuckDB receives jobs.
const bootstrap = `let bootstrapped=false;self.addEventListener('message',event=>{if(event.data?.type==='ASSET_BOOTSTRAP'&&!bootstrapped){event.stopImmediatePropagation();bootstrapped=true;const assets=event.data.assets;self.fetch=async input=>{const url=new URL(typeof input==='string'?input:input.url,self.location.href);if(url.origin!==self.location.origin||url.search||url.hash||url.pathname!=='/assets/duckdb-eh.wasm')throw new TypeError('NETWORK_DENIED');return new Response(assets['duckdb-eh.wasm'],{headers:{'Content-Type':'application/wasm'}});};}},{capture:true});\n`;
await writeFile("apps/executor/public/duckdb-worker.js", bootstrap + duckdb);
