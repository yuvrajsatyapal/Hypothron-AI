import { test, expect } from "./fixtures";

test("connected graph progresses and reverses through real scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const graph = page.locator("#pipeline");
  await expect(graph.locator("[data-flow-edge]")).toHaveCount(9);
  await expect(graph).toHaveAttribute("data-motion-ready", "true");
  const top = await graph.evaluate(
    (e) => e.getBoundingClientRect().top + scrollY,
  );
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top,
  );
  await expect
    .poll(async () => Number(await graph.getAttribute("data-progress")))
    .toBeLessThan(0.05);
  await page.evaluate(
    (y) => window.scrollTo({ top: y + 1400, behavior: "instant" }),
    top,
  );
  await expect
    .poll(async () => Number(await graph.getAttribute("data-progress")))
    .toBeGreaterThan(0.8);
  const completed = await graph
    .locator('[data-node="report"]')
    .evaluate((e) => Number(getComputedStyle(e).opacity));
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top,
  );
  await expect
    .poll(async () => Number(await graph.getAttribute("data-progress")))
    .toBeLessThan(0.05);
  expect(
    await graph
      .locator('[data-node="report"]')
      .evaluate((e) => Number(getComputedStyle(e).opacity)),
  ).toBeLessThan(completed);
  await expect(graph.locator("[data-flow-signal]")).toHaveCount(9);
});

for (const width of [375, 768, 1280, 1440]) {
  test(`complete reduced-motion connected fallback at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const graph = page.locator("#pipeline");
    await expect(graph.locator("[data-flow-edge]")).toHaveCount(9);
    await expect(
      graph.getByRole("heading", { name: "Evidence Report", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await graph
        .locator('[data-node="report"]')
        .evaluate((e) => getComputedStyle(e).opacity),
    ).toBe("1");
    await expect(page.locator("canvas")).toHaveCount(0);
    await graph.getByText("Inspect report provenance").click();
    await expect(
      graph.getByText("CLIENT_REPORTED · illustrative agreement", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => indexedDB.databases())).toHaveLength(0);
  });
}

test("hero parallax, disclosures, lifecycle and short viewport remain usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("#landing")).toHaveAttribute(
    "data-motion-ready",
    "true",
  );
  const preview = page.locator("[data-preview-parallax]");
  const box = await preview.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.9, box!.y + box!.height * 0.3);
  await expect
    .poll(() => preview.evaluate((e) => getComputedStyle(e).transform))
    .not.toBe("none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => preview.evaluate((e) => getComputedStyle(e).transform))
    .toBe("none");
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 850 });
  await expect
    .poll(async () => {
      const shell = await page.locator(".pipeline-shell").boundingBox();
      return (
        (await page.locator("#pipeline .pin-spacer").count()) === 0 ||
        shell!.height + 64 <= 850
      );
    })
    .toBe(true);
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.locator("#pipeline").scrollIntoViewIfNeeded();
  const pin = page.locator("#pipeline .pin-spacer");
  if (await pin.count()) {
    const shell = await page.locator(".pipeline-shell").boundingBox();
    expect(shell!.height + 64).toBeLessThanOrEqual(820);
  }
  await page.locator("#deep-dives").scrollIntoViewIfNeeded();
  await page
    .getByText("What happens when results disagree?", { exact: true })
    .click();
  await expect(
    page.getByText(/The workspace preserves both results/),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Start an Investigation", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator(".pin-spacer, canvas")).toHaveCount(0);
  await page.getByRole("link", { name: "Hypothron AI home" }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("[data-flow-edge]")).toHaveCount(9);
  expect(errors).toEqual([]);
});

test("touch scroll graph, mobile navigation and native disclosures", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/");
  await page.locator("[data-section-nav] > summary").click();
  await page
    .getByRole("navigation", { name: "Mobile section navigation" })
    .getByRole("link", { name: "Investigation Engine" })
    .click();
  await expect(page).toHaveURL(/#pipeline$/);
  const graph = page.locator("#pipeline");
  await expect(graph).toHaveAttribute("data-motion-ready", "true");
  await page.locator('[data-node="report"]').scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await graph.getAttribute("data-progress")))
    .toBeGreaterThan(0.7);
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("server-rendered workflow remains readable without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/");
  await expect(page.locator("[data-flow-edge]")).toHaveCount(9);
  await expect(
    page.getByRole("heading", { name: "Evidence Report", exact: true }),
  ).toBeVisible();
  await page.getByText("Inspect report provenance", { exact: true }).click();
  await expect(
    page.getByText("CLIENT_REPORTED · illustrative agreement", { exact: true }),
  ).toBeVisible();
  await context.close();
});
