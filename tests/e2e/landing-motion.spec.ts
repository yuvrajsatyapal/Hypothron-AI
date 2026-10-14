import { test, expect } from "./fixtures";
test("connected branching workflow reverses with scroll and retains inspectable content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("[data-node]")).toHaveCount(9);
  await expect(page.locator("[data-flow-edge]")).toHaveCount(9);
  await expect
    .poll(() => page.locator("[data-flow-edge]").first().getAttribute("d"))
    .toContain("C");
  const section = page.locator("#pipeline");
  const top = await section.evaluate(
    (e) => e.getBoundingClientRect().top + scrollY,
  );
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top + 500,
  );
  await expect
    .poll(async () => Number(await section.getAttribute("data-progress")))
    .toBeGreaterThan(0);
  const end = Number(await section.getAttribute("data-progress"));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(async () => Number(await section.getAttribute("data-progress")))
    .toBeLessThan(end);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await section.getByText("Inspect calculation boundary").click();
  await expect(
    section.getByText(
      "Restricted read-only SQL and fixed trusted Python templates. No arbitrary model-generated code.",
      { exact: true },
    ),
  ).toBeVisible();
});
for (const width of [375, 768, 1440])
  test(`static workflow ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("[data-node]")).toHaveCount(9);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Start an Investigation", exact: true })
      .first()
      .click();
    await expect(page.getByLabel("Dataset CSV", { exact: true })).toBeVisible();
  });

test("hero pointer depth is active, resets, and disables with reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const preview = page.locator("[data-preview-parallax]");
  await expect(preview).toHaveCount(1);
  const box = await page.locator("#demo").boundingBox();
  if (!box) throw new Error("Missing preview");
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.2);
  await expect
    .poll(() => preview.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => preview.evaluate((e) => getComputedStyle(e).transform))
    .toBe("none");
});
test("landing remains readable without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(baseURL ?? "http://127.0.0.1:3000/");
  await expect(
    page.getByRole("heading", { name: "Evidence Report", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: "Start an Investigation", exact: true })
      .first(),
  ).toBeVisible();
  await context.close();
});
