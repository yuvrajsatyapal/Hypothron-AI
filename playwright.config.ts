import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.HYPOTHRON_CHROME ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: [
    {
      command: "pnpm executor",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: true,
    },
    {
      command: "pnpm web",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
});
