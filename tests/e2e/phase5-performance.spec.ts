import { test, expect } from "./fixtures";
import { writeFile, stat } from "node:fs/promises";
import { platform, arch, release, cpus, totalmem } from "node:os";

test("repeatable ten-thousand-row workload records actual local lifecycle latency and tracked memory", async ({
  page,
}) => {
  const count = 10000;
  const csv =
    "id,completed_at,revenue\n" +
    Array.from(
      { length: count },
      (_, i) => `${i + 1},2025-07-01T00:00:00Z,10.10\n`,
    ).join("");
  const measurements: Record<string, unknown> = {};
  let start = Date.now();
  await page.goto("/app");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "synthetic.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    page.getByText("Dataset loaded into local memory.", { exact: true }),
  ).toBeVisible();
  measurements.importAndHashMs = Date.now() - start;
  start = Date.now();
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText(String(count * 1010), {
    timeout: 35000,
  });
  await expect(page.getByTestId("python-value")).toHaveText(
    String(count * 1010),
  );
  measurements.executionUiMs = Date.now() - start;
  measurements.workerTiming = await page.getByTestId("timing").textContent();
  measurements.trackedMemory = await page.getByTestId("memory").textContent();
  const history = page.getByRole("region", {
    name: "Local investigation history",
  });
  await history
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  start = Date.now();
  await history
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(history.getByTestId("storage-status")).toContainText(
    "Saved atomically",
  );
  measurements.saveMs = Date.now() - start;
  start = Date.now();
  const downloading = page.waitForEvent("download");
  await history
    .getByRole("button", { name: "Export investigation bundle", exact: true })
    .click();
  const path = await (await downloading).path();
  measurements.exportMs = Date.now() - start;
  measurements.bundleBytes = (await stat(path!)).size;
  await page.reload();
  start = Date.now();
  await history
    .getByRole("button", { name: "Load playback", exact: true })
    .click();
  await expect(
    history.getByRole("heading", { name: "Stored report playback" }),
  ).toBeVisible();
  measurements.loadMs = Date.now() - start;
  start = Date.now();
  await history
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(history.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 35000,
  });
  measurements.replayMs = Date.now() - start;
  await history
    .getByRole("button", { name: "Delete saved investigation", exact: true })
    .click();
  await expect(history.getByLabel("Import investigation bundle")).toBeEnabled();
  start = Date.now();
  await history.getByLabel("Import investigation bundle").setInputFiles(path!);
  await expect(history.getByTestId("import-preview")).toContainText(
    "Validated in memory",
  );
  measurements.importValidateMs = Date.now() - start;
  await history
    .getByLabel("I approve storing this validated imported bundle locally")
    .check();
  start = Date.now();
  await history
    .getByRole("button", { name: "Confirm local import", exact: true })
    .click();
  await expect(history.getByTestId("saved-record")).toHaveCount(1);
  measurements.importSaveMs = Date.now() - start;
  await expect(page.getByLabel("Dataset CSV", { exact: true })).toBeEnabled();
  start = Date.now();
  await page
    .getByLabel("Dataset CSV", { exact: true })
    .setInputFiles("tests/fixtures/phase5-revenue.parquet");
  await expect(page.getByTestId("source-profile")).toContainText(
    "DECIMAL(10,2)",
    { timeout: 35000 },
  );
  measurements.parquetImportAndCanonicalHashMs = Date.now() - start;
  measurements.parquetFixtureBytes = (
    await stat("tests/fixtures/phase5-revenue.parquet")
  ).size;
  await page.getByLabel("I approve this canonical CSV dataset version").check();
  start = Date.now();
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("3030", {
    timeout: 35000,
  });
  await expect(page.getByTestId("python-value")).toHaveText("3030");
  measurements.parquetArithmeticUiMs = Date.now() - start;
  await writeFile(
    process.env.HYPOTHRON_CI === "1"
      ? "test-results/phase5-performance.json"
      : "docs/reports/PHASE_5_PERFORMANCE.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        environment: {
          platform: platform(),
          arch: arch(),
          os: release(),
          cpu: cpus()[0]?.model,
          totalMemoryBytes: totalmem(),
          browser: page.context().browser()?.version(),
        },
        fixture: {
          rows: count,
          bytes: Buffer.byteLength(csv),
          valueMinorUnits: String(count * 1010),
        },
        measurements,
        limitations: [
          "One local sample, not percentile or peak-heap benchmark",
          "UI timings include browser/automation and runtime startup",
          "Tracked engine allocations omit runtime overhead",
          "No physical mobile, real-origin or live provider measurements",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
