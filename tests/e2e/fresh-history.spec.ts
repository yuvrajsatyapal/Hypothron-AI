import type { Manifest } from "../../apps/web/lib/artifacts";
interface SavedFixture {
  id: string;
  digest: string;
  manifest: Manifest;
  size: number;
  origin: "local" | "imported";
}
import { test, expect } from "./fixtures";
const csv = "id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n";
test("saved AI run retains unused approved input, fresh consent/link/comparison and zero inference replay", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "primary.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("1010", {
    timeout: 120000,
  });
  await page.getByLabel("Additional CSV datasets (up to two)").setInputFiles(
    ["11.10", "12.10"].map((value) => ({
      name: value + ".csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv.replace("10.10", value)),
    })),
  );
  async function complete() {
    const r = page.getByRole("region", { name: "Autonomous investigation" });
    await r.getByRole("checkbox").check();
    await r
      .getByLabel("BYOK provider key", { exact: true })
      .fill("secret-phase4-canary");
    await r
      .getByRole("button", { name: "Start AI investigation", exact: true })
      .click();
    await expect(page.getByTestId("investigation-status")).toHaveText(
      "CLARIFYING",
      { timeout: 120000 },
    );
    await page
      .getByLabel("Clarification:", { exact: false })
      .fill("Use approved period.");
    await r
      .getByLabel("BYOK provider key", { exact: true })
      .fill("secret-phase4-canary");
    await page
      .getByRole("button", { name: "Answer and resume", exact: true })
      .click();
    await expect(page.getByTestId("investigation-status")).toHaveText(
      "COMPLETE",
      { timeout: 120000 },
    );
  }
  await complete();
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
  const records = async () =>
    page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("hypothron-local-v1");
        r.onsuccess = () => resolve(r.result);
      });
      const rows = await new Promise<SavedFixture[]>((resolve) => {
        const r = db
          .transaction("investigations")
          .objectStore("investigations")
          .getAll();
        r.onsuccess = () => resolve(r.result);
      });
      db.close();
      return rows;
    });
  const original = (await records())[0];
  expect(original.manifest.approved).toHaveLength(3);
  expect(original.manifest.calculations).toHaveLength(2);
  expect(JSON.stringify(original)).not.toContain("secret-phase4-canary");
  await page.reload();
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await h
    .getByRole("button", {
      name: "Start separate fresh AI investigation",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("BYOK provider key", { exact: true }),
  ).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Start AI investigation", exact: true }),
  ).toBeDisabled();
  await complete();
  await expect(page.getByTestId("fresh-comparison")).toContainText(
    "unavailable",
  );
  await h
    .getByLabel(
      "I approve saving these snapshots and artifacts on this browser",
    )
    .check();
  await h
    .getByRole("button", { name: "Save investigation", exact: true })
    .click();
  await expect(h.getByTestId("saved-record")).toHaveCount(2);
  const after = await records();
  const fresh = after.find((r) => r.id !== original.id);
  if (!fresh) throw new Error("Missing fresh artifact fixture");
  expect(fresh.manifest.parentId).toBe(original.id);
  expect(after.find((r) => r.id === original.id)).toEqual(original);
  await page.reload();
  const freshCard = h.getByTestId("saved-record").filter({ hasText: fresh.id });
  await freshCard
    .getByRole("button", { name: "Load playback", exact: true })
    .click();
  let attempts = 0;
  await page.route(/:8000|googleapis|openrouter/, async (route) => {
    attempts++;
    await route.abort();
    throw new Error("INFERENCE_FORBIDDEN");
  });
  await page.evaluate(() => {
    const original = fetch;
    globalThis.fetch = async (input, init) => {
      if (
        String(input instanceof Request ? input.url : input).includes(":8000")
      )
        throw new Error("INFERENCE_FORBIDDEN");
      return original(input, init);
    };
  });
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 120000,
  });
  expect(attempts).toBe(0);
});
