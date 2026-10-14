import { test, expect } from "./fixtures";
test("saved v2 lookup replay regenerates exact engines with original relationship semantics", async ({
  page,
}) => {
  await page.goto("/app");
  await page.getByLabel("Dataset CSV", { exact: true }).setInputFiles({
    name: "orders.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "order_id,customer_id,completed_at,revenue\n1,A,2025-07-01T00:00:00Z,10.10\n2,A,2025-07-02T00:00:00Z,-0.03\n",
    ),
  });
  await page.getByLabel("Use advanced v2 contract").check();
  await page.getByRole("combobox", { name: /^Currency/ }).selectOption("EUR");
  await page.getByLabel("Unique dataset grain keys").fill("order_id");
  await page.getByLabel("Optional lookup CSV").setInputFiles({
    name: "lookup.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("id,label\nA,alpha\n"),
  });
  await expect(
    page.getByText("Lookup in local memory: lookup.csv"),
  ).toBeVisible();
  await page.getByLabel("Source join key", { exact: true }).fill("customer_id");
  await page.getByLabel("Expected source population rows").fill("2");
  await page.getByLabel("I approve this derived join").check();
  await page
    .getByRole("button", { name: "Execute locally", exact: true })
    .click();
  await expect(page.getByTestId("sql-value")).toHaveText("1007", {
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
  await page.reload();
  await h.getByRole("button", { name: "Load playback", exact: true }).click();
  await page.route(/:8000|googleapis|openrouter/, async (route) => {
    await route.abort();
    throw new Error("INFERENCE_FORBIDDEN");
  });
  await h
    .getByRole("button", { name: "Replay saved investigation", exact: true })
    .click();
  await expect(h.getByTestId("replay-status")).toHaveText("MATCH", {
    timeout: 120000,
  });
  await expect(h.getByTestId("replay-differences")).toContainText("1007");
});
