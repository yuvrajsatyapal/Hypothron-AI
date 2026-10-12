import { test } from "../e2e/fixtures";
// Intentional failure: a higher-priority page mock handles HTTP with zero egress,
// but the automatic context request audit must still fail this test.
test("provider attempt must fail even when another route fulfills it", async ({
  page,
}) => {
  await page.route("https://openrouter.ai/**", async (route) => {
    await route.fulfill({ status: 200, body: "synthetic" });
  });
  await page.goto("https://openrouter.ai/ci-negative-probe");
});
