import { test, expect } from "./fixtures";

test("real account API/database and analytical workflow saves metadata across logout/login", async ({
  page,
}) => {
  const email = `browser-${Date.now()}@example.com`;
  await page.goto("/app");
  await page
    .getByText("Account — sign in or create an account", { exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-safe-password-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(`Signed in as ${email}`, { exact: true }),
  ).toBeVisible();
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
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByRole("button", { name: "Start AI investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
    { timeout: 120000 },
  );
  await page
    .getByLabel("Clarification:", { exact: false })
    .fill("Use the approved UTC quarter and USD revenue contract.");
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("button", { name: "Answer and resume", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "COMPLETE",
    { timeout: 120000 },
  );
  await page
    .getByRole("button", {
      name: "Save report and metadata to account",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to account", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-safe-password-2026");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh account history", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View saved report", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Account history" }),
  ).toContainText("CLIENT_REPORTED");
  let release!: () => void;
  let blocked = false;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/v1/account/history",
    async (route) => {
      const response = await route.fetch();
      blocked = true;
      await wait;
      await route.fulfill({ response });
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Refresh account history", exact: true })
    .click();
  await expect.poll(() => blocked).toBe(true);
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  const secondEmail = `second-${Date.now()}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(secondEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-safe-password-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(`Signed in as ${secondEmail}`, { exact: true }),
  ).toBeVisible();
  const delayedResponse = page.waitForResponse((response) =>
    response.url().endsWith("/v1/account/history"),
  );
  release();
  await (await delayedResponse).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(
    page.getByRole("button", { name: "View saved report", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText("Account — sign in or create an account", { exact: true }),
  ).toBeVisible();
  const persisted = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(persisted.local).toEqual([]);
  expect(persisted.session).toEqual([]);
});
