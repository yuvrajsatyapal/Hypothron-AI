import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const generatedRows = Number(process.argv[2] ?? 0);
if (
  !Number.isSafeInteger(generatedRows) ||
  generatedRows < 0 ||
  generatedRows > 100000
)
  throw new Error("INVALID_BENCHMARK_ROWS");
const padding = Number(process.argv[3] ?? 0);
if (!Number.isSafeInteger(padding) || padding < 0 || padding > 64)
  throw new Error("INVALID_BENCHMARK_PADDING");
const exec = promisify(execFile);
const server = await chromium.launchServer({
  headless: true,
  executablePath:
    process.env.HYPOTHRON_CHROME ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const browser = await chromium.connect(server.wsEndpoint());
const root = server.process().pid;
let peak = 0,
  samples = 0,
  sampling = false;
const sample = async () => {
  if (sampling) return;
  sampling = true;
  try {
    const { stdout } = await exec("ps", ["-axo", "pid=,ppid=,rss="]);
    const rows = stdout
      .trim()
      .split("\n")
      .map((line) => line.trim().split(/\s+/).map(Number));
    const ids = new Set([root]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [pid, parent] of rows)
        if (ids.has(parent) && !ids.has(pid)) {
          ids.add(pid);
          changed = true;
        }
    }
    const rss = rows
      .filter(([pid]) => ids.has(pid))
      .reduce((sum, row) => sum + row[2] * 1024, 0);
    peak = Math.max(peak, rss);
    samples++;
  } finally {
    sampling = false;
  }
};
const timer = setInterval(() => sample().catch(() => {}), 200);
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const started = performance.now();
  await page.goto("http://127.0.0.1:3000");
  if (generatedRows) {
    const csv =
      (padding ? "completed_at,revenue,notes\n" : "completed_at,revenue\n") +
      (
        "2025-07-01T00:00:00Z,10.10" +
        (padding ? "," + "x".repeat(padding) : "") +
        "\n"
      ).repeat(generatedRows);
    await page.getByLabel("Dataset CSV").setInputFiles({
      name: "generated.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  } else
    await page
      .getByLabel("Dataset CSV")
      .setInputFiles("tests/fixtures/orders.csv");
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await page.getByTestId("verification").waitFor({ timeout: 35000 });
  assert.match(await page.getByTestId("verification").innerText(), /^VERIFIED/);
  const expected = generatedRows
    ? String(BigInt(generatedRows) * 1010n)
    : "3033";
  assert.equal(await page.getByTestId("sql-value").innerText(), expected);
  assert.equal(await page.getByTestId("python-value").innerText(), expected);
  await sample();
  const evidence = {
    date: new Date().toISOString(),
    memoryOptimization:
      "Job runtime/package buffers released after initialization",
    browser: browser.version(),
    platform: process.platform,
    architecture: process.arch,
    viewport: { width: 1440, height: 900 },
    fixture: generatedRows
      ? `synthetic ${generatedRows} UTC rows; constant 10.10 USD; padding ${padding}`
      : "tests/fixtures/orders.csv",
    startupToEvidenceMs: Math.round(performance.now() - started),
    engine: await page.getByTestId("timing").innerText(),
    engineDataMemory: await page.getByTestId("memory").innerText(),
    sampledPeakBrowserProcessTreeRssBytes: peak,
    samples,
    samplingIntervalMs: 200,
    scope:
      "Whole fresh headless Chrome process tree, including runtime assets. Sampled RSS is not a continuous maximum, per-engine allocation, mobile device measurement, or portable heap guarantee.",
  };
  await mkdir("docs/reports", { recursive: true });
  const output = "docs/reports/PHASE_1_BROWSER_MEASUREMENT.json";
  let records = [];
  try {
    const previous = JSON.parse(await readFile(output, "utf8"));
    records = Array.isArray(previous) ? previous : [previous];
  } catch {
    /* First measurement. */
  }
  records.push(evidence);
  await writeFile(output, JSON.stringify(records, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
} finally {
  clearInterval(timer);
  await browser.close();
  await server.close();
}
