import { test, expect } from "@playwright/test";
for (const width of [375, 768, 1280, 1440]) {
  test(`Stitch landing ${width}: accessible navigation, honest demo and no persistence`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "verified answers",
    );
    await expect(
      page.getByText("Illustrative synthetic example", { exact: true }).first(),
    ).toBeVisible();
    const pipeline = page.getByRole("region", {
      name: "Investigation pipeline",
    });
    await expect(pipeline).toBeVisible();
    await expect(pipeline.getByRole("heading", { level: 3 })).toHaveText([
      "Local Dataset + Schema + User Question",
      "AI Hypotheses",
      "Approved Calculations",
      "DuckDB/Pyodide Comparison",
      "Evidence Report",
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    await page
      .getByRole("link", { name: "Start an Investigation", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByLabel("Dataset CSV", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Execute locally", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
  });
}

test("desktop motion, SVG connections, route isolation and clean console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("#demo")).toBeVisible();
  await page.screenshot({ path: "/tmp/hypothron-landing-desktop.png" });
  await page.locator("#pipeline").scrollIntoViewIfNeeded();
  const path = page.locator("[data-pipeline-connection]");
  const alignment = await page.locator("#pipeline").evaluate((root) => {
    const svg = root.querySelector("svg")!.getBoundingClientRect();
    const nodes = [
      ...root.querySelectorAll("[data-pipeline-stage] > span:first-child"),
    ].map((n) => n.getBoundingClientRect());
    return nodes.map((n) =>
      Math.abs(n.y + n.height / 2 - (svg.y + svg.height / 2)),
    );
  });
  expect(Math.max(...alignment)).toBeLessThan(3);
  await expect(page.locator("#pipeline svg")).toBeVisible();
  await expect
    .poll(() => path.evaluate((e) => getComputedStyle(e).strokeDasharray))
    .not.toBe("none");
  await page.locator("#privacy").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      path.evaluate((e) => parseFloat(getComputedStyle(e).strokeDashoffset)),
    )
    .toBeLessThan(50);
  await page.locator("#pipeline").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/hypothron-pipeline-desktop.png" });
  expect(errors).toEqual([]);
  await page.goto("/app");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/hypothron-workspace-desktop.png" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "/tmp/hypothron-workspace-mobile.png" });
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: "/tmp/hypothron-landing-mobile.png" });
  expect(errors).toEqual([]);
});
