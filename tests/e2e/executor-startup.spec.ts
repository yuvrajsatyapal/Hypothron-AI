import { test, expect } from "./fixtures";
test("execution started before iframe document load recovers without duplicate channel transfer", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("http://127.0.0.1:3001/", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel("Dataset CSV", { exact: true })).toBeEnabled();
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "early.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n",
    ),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  release();
  await expect(page.getByTestId("sql-value")).toHaveText("1010", {
    timeout: 120000,
  });
  await page
    .getByRole("button", { name: "Replay original calculations", exact: true })
    .click();
  await expect(page.getByTestId("replay")).toHaveText("MATCH", {
    timeout: 120000,
  });
});
