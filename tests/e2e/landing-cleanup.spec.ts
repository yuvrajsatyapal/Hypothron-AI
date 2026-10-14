import { test, expect } from "./fixtures";

test("analytical workspace remains isolated from landing animation resources", async ({
  page,
}) => {
  const chunks: Promise<string>[] = [];
  page.on("response", (response) => {
    if (
      response.url().includes("/_next/static/chunks/") &&
      response.url().endsWith(".js")
    ) {
      chunks.push(response.text());
    }
  });
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Inspect the evidence.",
  );
  await expect(page.getByLabel("Dataset CSV", { exact: true })).toBeVisible();
  await expect(
    page.locator(".marketing, .investigation-film, .lens-host, canvas"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
  expect(chunks.length).toBeGreaterThan(0);
  const hasLandingMotion =
    /ScrollTrigger|WebGLRenderer|createLens|createInvestigationScene/.test(
      (await Promise.all(chunks)).join("\n"),
    );
  expect(
    hasLandingMotion,
    "Workspace must not preload landing animation code",
  ).toBe(false);
});
