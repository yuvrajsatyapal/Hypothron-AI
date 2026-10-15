import { test, expect } from "./fixtures";
test.setTimeout(30000);

test("workspace command search and telemetry are keyboard accessible", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByRole("button", { name: "Search workspace" }).click();
  await expect(
    page.getByRole("dialog", { name: "Search workspace" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Find a workspace action" })
    .fill("dataset");
  await page.getByRole("button", { name: "Dataset & Metric" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Investigation telemetry" }).click();
  const drawer = page.getByRole("dialog", { name: "Investigation telemetry" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("Awaiting a local calculation");
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Investigation telemetry" }),
  ).toBeFocused();
  expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
});

test("landing notebook sorts real synthetic values and exports them", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Source data", exact: true }).click();
  await page.getByRole("button", { name: "Sort by USD" }).click();
  const rows = page.locator("#demo tbody tr");
  await expect(rows.first()).toContainText("44.50");
  await page.getByRole("button", { name: "Sort by USD" }).click();
  await expect(rows.first()).toContainText("120.00");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export example CSV" }).click();
  expect((await download).suggestedFilename()).toBe("revenue_example.csv");
  expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
});

for (const width of [375, 768, 1440]) {
  test(`complete studio controls fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/app");
    await page.getByRole("button", { name: "Investigation telemetry" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Close telemetry" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Attach local dataset" }).click();
    await expect(page.getByLabel("Dataset CSV", { exact: true })).toBeFocused();
    await expect(page.locator("canvas")).toHaveCount(0);
  });
}
