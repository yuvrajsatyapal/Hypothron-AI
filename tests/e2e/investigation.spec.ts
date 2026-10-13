import { test, expect } from "./fixtures";
const csv =
  "order_id,completed_at,revenue\n1,2025-07-01T00:00:00Z,10.10\n2,2025-07-02T00:00:00Z,20.20\n3,2025-09-30T23:59:59Z,0.03\n";
test("real API/LangGraph/Postgres and browser engines clarify then conditionally follow up without raw upload or persistence", async ({
  page,
  request,
}) => {
  await expect(
    (await request.get("http://127.0.0.1:8000/__test__/provider")).json(),
  ).resolves.toEqual({ external_http_mocked: true });
  expect((await request.get("http://127.0.0.1:8000/v1/ready")).status()).toBe(
    200,
  );
  const posts: { url: string; body: string }[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST")
      posts.push({ url: r.url(), body: r.postData() || "" });
  });
  await page.route(
    "**/v1/investigations",
    async (route) => {
      await route.fetch();
      await route.abort("connectionreset");
    },
    { times: 1 },
  );
  await page.goto("/");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("verification")).toContainText("VERIFIED", {
    timeout: 120000,
  });
  await page.getByLabel("Additional CSV datasets (up to two)").setInputFiles([
    {
      name: "second.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv.replace("10.10", "11.10")),
    },
    {
      name: "third.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv.replace("10.10", "12.10")),
    },
  ]);
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
  await expect(
    page.getByRole("button", {
      name: "Resume original investigation",
      exact: true,
    }),
  ).toBeEnabled({ timeout: 120000 });
  await expect(
    page.getByLabel("BYOK provider key", { exact: true }),
  ).toHaveValue("");
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("button", { name: "Resume original investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
    { timeout: 120000 },
  );
  await expect(
    page.getByLabel("BYOK provider key", { exact: true }),
  ).toHaveValue("");
  const clarification = page.getByLabel("Clarification:", { exact: false });
  await clarification.fill(
    "Use the approved UTC quarter and USD revenue contract.",
  );
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
  await expect(page.getByTestId("investigation-report")).toContainText(
    "client-reported",
  );
  await expect(page.getByTestId("investigation-report")).toContainText(
    "UNTRUSTED_NARRATIVE",
  );
  await expect(
    page.getByTestId("investigation-report").getByRole("table"),
  ).toHaveCount(2);
  await expect(
    page.getByTestId("investigation-report").getByRole("img"),
  ).toHaveCount(2);
  await expect(page.getByTestId("investigation-report")).toContainText(
    "30.33 USD",
  );
  expect(
    await page.getByTestId("investigation-report").locator("img").count(),
  ).toBe(0);
  await expect(
    page.getByLabel("BYOK provider key", { exact: true }),
  ).toHaveValue("");
  expect(posts.filter((p) => p.url.endsWith("/results")).length).toBe(2);
  for (const post of posts) {
    expect(post.body).not.toContain("2025-07-02T00:00:00Z,20.20");
    expect(post.body).not.toContain("second.csv");
    expect(post.url).not.toContain("browser-test-key");
  }
  const started = posts.find((p) => p.url.endsWith("/v1/investigations"));
  expect(JSON.parse(started!.body).request.datasets.length).toBe(3);
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .uncheck();
  await expect(
    page.getByRole("button", {
      name: "Resume original investigation",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByLabel("LLM provider", { exact: true })
    .selectOption("openrouter");
  await expect(page.getByTestId("active-investigation")).toContainText(
    "gemini / gemini-2.5-flash",
  );
  await page.getByLabel("Additional CSV datasets (up to two)").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("wrong,date\n1,2025-07-01\n"),
  });
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("button", { name: "Start AI investigation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start AI investigation", exact: true }),
  ).toBeEnabled({ timeout: 120000 });
  await expect(page.getByTestId("investigation-report")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Resume original investigation",
      exact: true,
    }),
  ).toBeDisabled();
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return original.call(this);
    };
    const send = MessagePort.prototype.postMessage;
    const state = window as typeof window & { afterCancelExecutions: number };
    state.afterCancelExecutions = 0;
    MessagePort.prototype.postMessage = function (value, options) {
      if (value?.type === "EXECUTE" || value?.type === "PARQUET")
        state.afterCancelExecutions++;
      return send.call(this, value, options as Transferable[]);
    };
  });
  const creations = posts.filter((p) =>
    p.url.endsWith("/v1/investigations"),
  ).length;
  await page.getByLabel("Additional CSV datasets (up to two)").setInputFiles({
    name: "delayed.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv.replace("10.10", "13.10")),
  });
  await expect(
    page.getByRole("button", { name: "Start AI investigation", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cancel investigation", exact: true })
    .click();
  await expect(
    page.getByLabel("Additional CSV datasets (up to two)"),
  ).toBeEnabled({ timeout: 10000 });
  // File.arrayBuffer itself is not abortable; wait for the late return and prove it cannot enqueue work.
  await page.waitForTimeout(1600);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { afterCancelExecutions: number })
          .afterCancelExecutions,
    ),
  ).toBe(0);
  await expect(
    page
      .getByRole("region", { name: "Autonomous investigation" })
      .getByRole("checkbox"),
  ).not.toBeChecked();
  expect(posts.filter((p) => p.url.endsWith("/v1/investigations")).length).toBe(
    creations,
  );
  await page.getByLabel("LLM provider", { exact: true }).selectOption("gemini");
  await page
    .getByLabel("Additional CSV datasets (up to two)")
    .setInputFiles([]);
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("button", { name: "Start AI investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
    { timeout: 30000 },
  );
  await page
    .getByLabel("Clarification:", { exact: false })
    .fill("Use the approved metric.");
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  let releaseCancellation!: () => void;
  let cancellationSeen!: () => void;
  const cancellationGate = new Promise<void>((resolve) => {
    releaseCancellation = resolve;
  });
  const seen = new Promise<void>((resolve) => {
    cancellationSeen = resolve;
  });
  await page.route(
    "**/cancel",
    async (route) => {
      cancellationSeen();
      await cancellationGate;
      await route.continue();
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Answer and resume", exact: true })
    .click();
  await expect(page.getByText(/Pending hypothesis h1:/)).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Cancel investigation", exact: true })
    .click();
  await seen;
  await expect(
    page.getByRole("button", { name: "Start AI investigation", exact: true }),
  ).toBeEnabled({ timeout: 10000 });
  await page
    .getByRole("region", { name: "Autonomous investigation" })
    .getByRole("checkbox")
    .check();
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("browser-test-key-never-persist");
  await page
    .getByRole("button", { name: "Start AI investigation", exact: true })
    .click();
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
    { timeout: 30000 },
  );
  await page
    .getByLabel("BYOK provider key", { exact: true })
    .fill("next-operation-key-not-cleared");
  const cancellationResponse = page.waitForResponse((response) =>
    response.url().endsWith("/cancel"),
  );
  releaseCancellation();
  await cancellationResponse;
  await expect(
    page.getByLabel("BYOK provider key", { exact: true }),
  ).toHaveValue("next-operation-key-not-cleared");
  await expect(page.getByTestId("investigation-status")).toHaveText(
    "CLARIFYING",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(async () => ({
      db: (await indexedDB.databases()).length,
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ db: 0, local: 0, session: 0 });
});
