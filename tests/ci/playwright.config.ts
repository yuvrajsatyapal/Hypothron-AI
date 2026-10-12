import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "provider-guard.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/guard-probe",
  use: {
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
});
