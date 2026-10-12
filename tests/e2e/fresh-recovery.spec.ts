import type { Manifest } from "../../apps/web/lib/artifacts";
interface SavedFixture {
  id: string;
  digest: string;
  manifest: Manifest;
  size: number;
  origin: "local" | "imported";
}
import { test, expect } from "./fixtures";
test("lost accepted-result ACK recovers replayable evidence with frozen creation metadata", async ({
  page,
}) => {
  const key = "secret-recovery-canary";
  const capabilities = new Set<string>();
  page.on("request", (request) => {
    const authorization = request.headers()["authorization"];
    if (authorization?.startsWith("Bearer "))
      capabilities.add(authorization.slice(7));
  });
  await page.goto("/");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "original.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n",
    ),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("1010", {
    timeout: 120000,
  });
  const r = page.getByRole("region", { name: "Autonomous investigation" });
  await r.getByRole("checkbox").check();
  await r.getByLabel("BYOK provider key", { exact: true }).fill(key);
  await r
    .getByRole("button", { name: "Start AI investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
    { timeout: 120000 },
  );
  await r
    .getByLabel("Investigation question")
    .fill("Edited UI question never used by original run");
  await r
    .getByLabel("LLM provider", { exact: true })
    .selectOption("openrouter");
  await page
    .getByLabel("Clarification:", { exact: false })
    .fill("Use approved period.");
  await r.getByLabel("BYOK provider key", { exact: true }).fill(key);
  await page.route(
    "**/v1/investigations/*/results",
    async (route) => {
      await route.fetch();
      await route.abort("connectionreset");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Answer and resume", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Resume original investigation",
      exact: true,
    }),
  ).toBeEnabled({ timeout: 120000 });
  await r.getByLabel("BYOK provider key", { exact: true }).fill(key);
  await page
    .getByRole("button", { name: "Resume original investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "COMPLETE",
    { timeout: 120000 },
  );
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
  const stored = await page.evaluate(async () => {
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
    return rows[0];
  });
  expect(stored.manifest.question).toBe(
    "Investigate the approved revenue evidence.",
  );
  if (!stored.manifest.run) throw new Error("Missing AI measurement fixture");
  expect(stored.manifest.run.provider).toBe("gemini");
  expect(stored.manifest.run.model).toBe("gemini-2.5-flash");
  expect(stored.manifest.calculations).toHaveLength(1);
  expect(JSON.stringify(stored)).not.toContain(key);
  expect(capabilities.size).toBeGreaterThan(0);
  for (const capability of capabilities)
    expect(JSON.stringify(stored).includes(capability)).toBe(false);
  expect(stored.manifest.run.attempts).toBe(5);
  const download = page.waitForEvent("download");
  await h
    .getByRole("button", { name: "Export investigation bundle", exact: true })
    .click();
  const file = await download;
  const path = await file.path();
  const fs = await import("node:fs/promises");
  const exported = await fs.readFile(path!);
  expect(exported.includes(Buffer.from(key))).toBe(false);
  for (const capability of capabilities)
    expect(exported.includes(Buffer.from(capability))).toBe(false);
});
