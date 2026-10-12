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
async function saved(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "private.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("1010", {
    timeout: 120000,
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
  await expect(h.getByTestId("storage-status")).toContainText(
    "Saved atomically",
  );
  return h;
}
async function denyInference(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (
        url.includes(":8000") ||
        url.includes("googleapis") ||
        url.includes("openrouter")
      )
        throw new Error("INFERENCE_FORBIDDEN");
      return original(input, init);
    };
  });
  await page.route(/:8000|googleapis|openrouter/, async (route) => {
    await route.abort();
    throw new Error("LLM request attempted during zero-inference replay");
  });
  expect(
    await page.evaluate(async () => {
      try {
        await fetch("http://127.0.0.1:8000/v1/investigations", {
          method: "POST",
        });
        return false;
      } catch (e) {
        return String(e).includes("INFERENCE_FORBIDDEN");
      }
    }),
  ).toBe(true);
}
test("Save/reload then actual engines replay with active inference refusal; export/import confirmation and idempotence", async ({
  page,
}) => {
  const h = await saved(page);
  const dl = page.waitForEvent("download");
  await h
    .getByRole("button", { name: "Export investigation bundle", exact: true })
    .click();
  const file = await dl,
    location = await file.path();
  expect(location).not.toBeNull();
  await page.reload();
  await denyInference(page);
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 120000,
  });
  await expect(h.getByTestId("replay-differences")).toContainText("1010");
  await expect(h.getByTestId("replay-differences")).toContainText(
    "CLIENT_REPORTED",
  );
  await h
    .getByRole("button", { name: "Delete saved investigation", exact: true })
    .click();
  await expect(h.getByLabel("Import investigation bundle")).toBeEnabled();
  await h.getByLabel("Import investigation bundle").setInputFiles(location!);
  await expect(h.getByTestId("import-preview")).toContainText(
    "Validated in memory",
  );
  await expect(h.getByTestId("saved-record")).toHaveCount(0);
  await expect(
    h.getByRole("button", { name: "Confirm local import", exact: true }),
  ).toBeDisabled();
  await h
    .getByLabel("I approve storing this validated imported bundle locally")
    .check();
  await h
    .getByRole("button", { name: "Confirm local import", exact: true })
    .click();
  await expect(h.getByTestId("saved-record")).toHaveCount(1);
  await expect(h.getByLabel("Import investigation bundle")).toBeEnabled();
  await h.getByLabel("Import investigation bundle").setInputFiles(location!);
  await h
    .getByLabel("I approve storing this validated imported bundle locally")
    .check();
  await h
    .getByRole("button", { name: "Confirm local import", exact: true })
    .click();
  await expect(h.getByTestId("saved-record")).toHaveCount(1);
});
test("replay cancel preserves original and retry recovers; malformed bundle stays unsaved", async ({
  page,
}) => {
  const h = await saved(page);
  await denyInference(page);
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(
    h.getByRole("button", { name: "Cancel saved replay", exact: true }),
  ).toBeEnabled();
  await h
    .getByRole("button", { name: "Cancel saved replay", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("CANCELLED");
  await expect(h.getByTestId("stored-evidence")).toContainText("1010");
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 120000,
  });
  await h.getByLabel("Import investigation bundle").setInputFiles({
    name: "hostile.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("arbitrary code"),
  });
  await expect(h.getByTestId("storage-status")).toContainText(
    "INVALID_ARCHIVE",
  );
  await expect(h.getByTestId("saved-record")).toHaveCount(1);
});

test("actual recomputation detects historical forged agreement and changed snapshot bytes", async ({
  page,
}) => {
  const h = await saved(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("hypothron-local-v1");
      r.onsuccess = () => resolve(r.result);
    });
    const row = await new Promise<SavedFixture>((resolve) => {
      const r = db
        .transaction("investigations")
        .objectStore("investigations")
        .getAll();
      r.onsuccess = () => resolve(r.result[0]);
    });
    function canonical(x: unknown): string {
      return x && typeof x === "object"
        ? Array.isArray(x)
          ? "[" + x.map(canonical).join(",") + "]"
          : "{" +
            Object.keys(x)
              .sort()
              .map(
                (k) =>
                  JSON.stringify(k) +
                  ":" +
                  canonical((x as Record<string, unknown>)[k]),
              )
              .join(",") +
            "}"
        : JSON.stringify(x);
    }
    async function hash(x: unknown) {
      return Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonical(x)),
          ),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    }
    const c = row.manifest.calculations[0];
    c.result.sql.minorUnits = "1011";
    c.result.python.minorUnits = "1011";
    c.resultDigest = await hash(c.result);
    row.digest = await hash(row.manifest);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("investigations", "readwrite");
      tx.objectStore("investigations").put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await denyInference(page);
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MISMATCH", {
    timeout: 120000,
  });
  await expect(h.getByTestId("replay-differences")).toContainText("1011");
  await expect(h.getByTestId("replay-differences")).toContainText("1010");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("hypothron-local-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("snapshots", "readwrite"),
        s = tx.objectStore("snapshots"),
        r = s.getAll();
      r.onsuccess = () => {
        const b = r.result[0];
        b.bytes[0] ^= 1;
        s.put(b);
      };
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await expect(h.getByTestId("storage-status")).toContainText(
    "SNAPSHOT_HASH_MISMATCH",
  );
});
