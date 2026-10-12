import { defineConfig } from "@playwright/test";
const ci = process.env.HYPOTHRON_CI === "1";
export default defineConfig({
  retries: 0,
  forbidOnly: ci,
  reporter: [["list"]],
  testDir: "tests/e2e",
  timeout: 180000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
    launchOptions: {
      executablePath: ci
        ? undefined
        : process.env.HYPOTHRON_CHROME ||
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
  },
  webServer: [
    {
      command:
        "services/api/.venv/bin/uvicorn browser_server:app --host 127.0.0.1 --port 8000 --no-access-log",
      env: {
        PYTHONPATH: ci
          ? "scripts/ci/python:services/api/tests"
          : "services/api/tests",
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql+psycopg://hypothron:local-development-only@127.0.0.1:55432/hypothron",
      },
      url: "http://127.0.0.1:8000/v1/ready",
      reuseExistingServer: !ci,
      timeout: 30000,
    },
    {
      command: "pnpm executor",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: !ci,
    },
    {
      command: ci
        ? "pnpm --filter @hypothron/web exec next start --hostname 127.0.0.1 --port 3000"
        : "pnpm web",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: !ci,
      timeout: 120000,
    },
  ],
});
