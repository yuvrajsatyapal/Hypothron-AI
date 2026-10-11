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
      command:
        "services/api/.venv/bin/uvicorn browser_server:app --host 127.0.0.1 --port 8000 --no-access-log",
      env: {
        PYTHONPATH: "services/api/tests",
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql+psycopg://hypothron:local-development-only@127.0.0.1:55432/hypothron",
      },
      url: "http://127.0.0.1:8000/__test__/provider",
      reuseExistingServer: true,
      timeout: 30000,
    },
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
