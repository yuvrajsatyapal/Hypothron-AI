import { test, expect } from "./fixtures";
const csv = "id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n";
async function calculate(page: import("@playwright/test").Page) {
  await page.goto("/app");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "sensitive.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("1010", {
    timeout: 120000,
  });
}
test("explicit Save survives reload, unsaved data disappears, deletion removes snapshots", async ({
  page,
}) => {
  await calculate(page);
  expect(
    await page.evaluate(async () => await indexedDB.databases()),
  ).toHaveLength(0);
  await page.reload();
  await expect(page.getByTestId("sql-value")).toHaveCount(0);
  expect(
    await page.evaluate(async () => await indexedDB.databases()),
  ).toHaveLength(0);
  await calculate(page);
  const history = page.getByRole("region", {
    name: "Local investigation history",
  });
  await expect(
    history.getByRole("button", { name: "Save investigation", exact: true }),
  ).toBeDisabled();
  await history
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  await history
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(history.getByTestId("storage-status")).toContainText(
    "Saved atomically",
  );
  await page.reload();
  await expect(page.getByTestId("sql-value")).toHaveCount(0);
  await expect(history.getByTestId("saved-record")).toHaveCount(1);
  await history
    .getByRole("button", { name: "Load playback", exact: true })
    .click();
  await expect(history.getByTestId("stored-evidence")).toContainText("1010");
  await expect(history.getByTestId("stored-evidence")).toContainText(
    "historical",
  );
  await history
    .getByRole("button", { name: "Delete saved investigation", exact: true })
    .click();
  await expect(history.getByTestId("saved-record")).toHaveCount(0);
  expect(
    await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("hypothron-local-v1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const count = await new Promise<number>((resolve) => {
        const r = db.transaction("snapshots").objectStore("snapshots").count();
        r.onsuccess = () => resolve(r.result);
      });
      db.close();
      return count;
    }),
  ).toBe(0);
});
test("real IndexedDB abort rolls back snapshots and manifest; quota failure leaves no record", async ({
  page,
}) => {
  await calculate(page);
  await page.evaluate(() => {
    const old = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "investigations") {
        this.transaction.abort();
        throw new DOMException("fixture interruption", "AbortError");
      }
      return old.apply(this, args);
    };
  });
  const h = page.getByRole("region", { name: "Local investigation history" });
  await h
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  await h
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(h.getByTestId("storage-status")).toContainText("Abort");
  await expect(h.getByTestId("saved-record")).toHaveCount(0);
  await page.reload();
  await expect(h.getByTestId("saved-record")).toHaveCount(0);
  await calculate(page);
  await page.evaluate(() => {
    const old = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      ...args: Parameters<IDBObjectStore["add"]>
    ) {
      if (this.name === "snapshots")
        throw new DOMException("fixture quota", "QuotaExceededError");
      return old.apply(this, args);
    };
  });
  await h
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  await h
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(h.getByTestId("storage-status")).toContainText("QUOTA_EXCEEDED");
  await expect(h.getByTestId("saved-record")).toHaveCount(0);
});

test("real browser storage eviction exposes missing history without recreating a database", async ({
  page,
  context,
}) => {
  await calculate(page);
  const h = page.getByRole("region", { name: "Local investigation history" });
  await h
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  await h
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(h.getByTestId("saved-record")).toHaveCount(1);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Storage.clearDataForOrigin", {
    origin: "http://127.0.0.1:3000",
    storageTypes: "indexeddb",
  });
  await cdp.detach();
  await page.reload();
  await expect(h.getByTestId("saved-record")).toHaveCount(0);
  expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
});
