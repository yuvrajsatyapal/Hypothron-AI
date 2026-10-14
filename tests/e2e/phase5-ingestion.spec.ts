import { test, expect } from "./fixtures";
test("real Parquet conversion approves canonical version and preserves source through Save export import replay", async ({
  page,
}) => {
  await page.goto("/app");
  await page
    .getByLabel("Dataset CSV", { exact: true })
    .setInputFiles("tests/fixtures/phase5-revenue.parquet");
  await expect(page.getByTestId("source-profile")).toContainText(
    "DECIMAL(10,2)",
    { timeout: 35000 },
  );
  await page.getByLabel("I approve this canonical CSV dataset version").check();
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("3030", {
    timeout: 35000,
  });
  await expect(page.getByTestId("python-value")).toHaveText("3030");
  const h = page.getByRole("region", { name: "Local investigation history" });
  await h
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  await h
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(h.getByTestId("storage-status")).toContainText(
    "Saved atomically",
  );
  await h
    .getByText("Inspect stored manifest, lineage and compiled source", {
      exact: true,
    })
    .click();
  await expect(
    h.getByRole("region", { name: "Stored manifest and compiled source" }),
  ).toContainText('"version": 2');
  const download = page.waitForEvent("download");
  await h
    .getByRole("button", { name: "Export investigation bundle", exact: true })
    .click();
  const path = await (await download).path();
  await page.reload();
  await page.route(/:8000|googleapis|openrouter/, async (route) => {
    await route.abort();
    throw new Error("INFERENCE_FORBIDDEN");
  });
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 35000,
  });
  await h
    .getByRole("button", { name: "Delete saved investigation", exact: true })
    .click();
  await expect(h.getByLabel("Import investigation bundle")).toBeEnabled();
  await h.getByLabel("Import investigation bundle").setInputFiles(path!);
  await expect(h.getByTestId("import-preview")).toContainText("2 snapshots");
  await h
    .getByLabel("I approve storing this validated imported bundle locally")
    .check();
  await h
    .getByRole("button", { name: "Confirm local import", exact: true })
    .click();
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 35000,
  });
});

test("Parquet exact integers retain digits; unsupported schemas and expansion refuse", async ({
  page,
}) => {
  await page.goto("/app");
  const upload = page.getByLabel("Dataset CSV", { exact: true });
  for (const [name, code] of [
    ["float", "UNSUPPORTED_PARQUET_TYPE"],
    ["timestamp", "UNSUPPORTED_PARQUET_TYPE"],
    ["nested", "UNSUPPORTED_PARQUET_TYPE"],
    ["expansion", "EXPANDED_INPUT_LIMIT"],
  ]) {
    await upload.setInputFiles(`tests/fixtures/phase5-${name}.parquet`);
    await expect(page.getByRole("status").first()).toContainText(code, {
      timeout: 35000,
    });
    await expect(
      page.getByRole("button", { name: "Execute locally", exact: true }),
    ).toBeDisabled();
  }
  await upload.setInputFiles({
    name: "bad.parquet",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("PAR1badPAR1"),
  });
  await expect(page.getByRole("status").first()).toContainText(
    "INVALID_PARQUET",
  );
  await upload.setInputFiles({
    name: "big.parquet",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByRole("status").first()).toContainText("INPUT_LIMIT");
  await upload.setInputFiles("tests/fixtures/phase5-large-integer.parquet");
  await expect(page.getByTestId("source-profile")).toContainText("BIGINT", {
    timeout: 35000,
  });
  await page.getByLabel("I approve this canonical CSV dataset version").check();
  await page.getByLabel("Use advanced v2 contract").check();
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("1010", {
    timeout: 35000,
  });
  await expect(page.getByTestId("verification")).toContainText("VERIFIED");
});

test("active Parquet nested worker reads only pinned extension bytes and denies native egress", async ({
  page,
}) => {
  const attempted: string[] = [];
  const responses: string[] = [];
  const failed: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("parquet_native_canary")) responses.push(r.url());
  });
  page.on("requestfailed", (r) => {
    if (r.url().includes("parquet_native_canary"))
      failed.push(r.failure()?.errorText ?? "unknown");
  });
  page.on("request", (r) => {
    if (r.url().includes("parquet_native_canary")) attempted.push(r.url());
  });
  await page.goto("/app");
  const nested = page.waitForEvent("worker", (worker) =>
    worker.url().endsWith("/duckdb-worker.js"),
  );
  await page
    .getByLabel("Dataset CSV", { exact: true })
    .setInputFiles("tests/fixtures/phase5-revenue.parquet");
  const worker = await nested;
  const probes = await worker.evaluate(async () => {
    // Wait for the credential-free parent to transfer its integrity-checked assets.
    for (
      let i = 0;
      i < 100 && !XMLHttpRequest.toString().includes("localExtension");
      i++
    )
      await new Promise((r) => setTimeout(r, 2));
    const exact =
      "http://127.0.0.1:3001/assets/v1.4.3/wasm_eh/parquet.duckdb_extension.wasm";
    const local = new XMLHttpRequest();
    local.open("GET", exact, false);
    local.responseType = "arraybuffer";
    local.send();
    const loaded =
      local.status === 200 &&
      local.response instanceof ArrayBuffer &&
      local.response.byteLength > 0;
    const denied = [
      ["GET", exact + "?parquet_native_canary=1"],
      ["GET", exact + "#parquet_native_canary"],
      ["GET", exact.replace(":3001", ":3000") + "?parquet_native_canary=1"],
      ["GET", exact.replace("v1.4.3", "v1.4.2") + "?parquet_native_canary=1"],
      ["POST", exact + "?parquet_native_canary=1"],
    ].map(([method, url]) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url, false);
        xhr.send();
        return false;
      } catch {
        return true;
      }
    });
    return { loaded, denied };
  });
  expect(probes.loaded).toBe(true);
  expect(probes.denied).toEqual([true, true, true, true, true]);
  expect(responses).toEqual([]);
  expect(failed).toHaveLength(attempted.length);
  expect(failed).toEqual(Array(attempted.length).fill("csp"));
  await expect(page.getByTestId("source-profile")).toContainText(
    "DECIMAL(10,2)",
    { timeout: 35000 },
  );
});

test("primary and lookup imports cancel during file reads without late Parquet work", async ({
  page,
}) => {
  await page.goto("/app");
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (this.name.endsWith(".parquet"))
        await new Promise((r) => setTimeout(r, 1500));
      return read.call(this);
    };
    const send = MessagePort.prototype.postMessage;
    (window as unknown as { parquetRequests: number }).parquetRequests = 0;
    MessagePort.prototype.postMessage = function (message, ...rest) {
      if (message?.type === "PARQUET")
        (window as unknown as { parquetRequests: number }).parquetRequests++;
      return send.call(this, message, ...rest);
    };
  });
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  const primary = page.getByLabel("Dataset CSV", { exact: true });
  await primary.setInputFiles("tests/fixtures/phase5-revenue.parquet");
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(primary).toBeEnabled();
  // Await the deferred file read to prove its completion cannot enqueue work or restore state.
  await page.waitForTimeout(1700);
  await expect(page.getByRole("status").first()).toHaveText("CANCELLED");
  await expect(page.getByTestId("source-profile")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Execute locally", exact: true }),
  ).toBeDisabled();
  await primary.setInputFiles({
    name: "input.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n",
    ),
  });
  await expect(page.getByRole("status").first()).toHaveText(
    "Dataset loaded into local memory.",
  );
  await page.getByLabel("Use advanced v2 contract").check();
  const lookup = page.getByLabel("Optional lookup CSV", { exact: true });
  await lookup.setInputFiles("tests/fixtures/phase5-revenue.parquet");
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(lookup).toBeEnabled();
  await page.waitForTimeout(1700);
  await expect(page.getByRole("status").first()).toHaveText("CANCELLED");
  await expect(page.getByText(/Lookup in local memory:/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { parquetRequests: number }).parquetRequests,
    ),
  ).toBe(0);
  await expect(cancel).toBeDisabled();
});
