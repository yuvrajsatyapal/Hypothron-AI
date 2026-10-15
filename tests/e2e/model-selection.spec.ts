import { test, expect } from "./fixtures";

test("OpenRouter discovery resolves Auto then pauses for explicit model approval without losing budget", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "order_id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n2,2025-07-02T00:00:00Z,20.20\n3,2025-09-30T23:59:59Z,0.03\n",
    ),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 120000,
  });
  await page
    .getByLabel("LLM provider", { exact: true })
    .selectOption("openrouter");
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("button", {
      name: "Discover free models / resolve Auto",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Provider model", { exact: true })).toHaveValue(
    "test/first:free",
  );
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "Start AI investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toContainText(
    "PROVIDER_RATE_LIMIT",
    { timeout: 120000 },
  );
  await expect(
    page.getByRole("button", {
      name: "Resume original investigation",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("BYOK provider key", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("button", {
      name: "Discover free models / resolve Auto",
      exact: true,
    })
    .click();
  const approval = page.getByRole("group", {
    name: "Model change requires approval",
    exact: true,
  });
  await approval
    .getByLabel("Replacement model", { exact: true })
    .selectOption("test/second:free");
  await expect(
    approval.getByRole("button", {
      name: "Approve model switch and resume",
      exact: true,
    }),
  ).toBeDisabled();
  await approval.getByRole("checkbox").check();
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await approval
    .getByRole("button", {
      name: "Approve model switch and resume",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
    { timeout: 120000 },
  );
  await page
    .getByLabel("Clarification:", { exact: false })
    .fill("Use the approved USD revenue period.");
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "Answer and resume", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "COMPLETE",
    { timeout: 120000 },
  );
  await expect(page.getByTestId("active-investigation")).toContainText(
    "test/second:free",
  );
  const history = page.getByRole("region", {
    name: "Local investigation history",
  });
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
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("hypothron-local-v1");
      request.onsuccess = () => resolve(request.result);
    });
    const rows = await new Promise<
      {
        manifest: {
          version: number;
          run: {
            model: string;
            modelSelection: { currentModel: string; history: unknown[] };
          };
        };
      }[]
    >((resolve) => {
      const request = db
        .transaction("investigations")
        .objectStore("investigations")
        .getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return rows[0].manifest;
  });
  expect(saved.version).toBe(3);
  expect(saved.run.model).toBe("test/first:free");
  expect(saved.run.modelSelection.currentModel).toBe("test/second:free");
  expect(saved.run.modelSelection.history).toHaveLength(1);
});
