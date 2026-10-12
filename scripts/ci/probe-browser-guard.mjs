import { spawnSync } from "node:child_process";
const result = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", "--config", "tests/ci/playwright.config.ts"],
  { encoding: "utf8" },
);
if (
  result.status !== 1 ||
  !(result.stdout + result.stderr).includes(
    "Unexpected browser provider HTTP attempt",
  )
) {
  throw new Error("BROWSER_PROVIDER_GUARD_PROBE_FAILED");
}
console.log(
  "Browser provider request guard negative probe passed (intentional test failure)",
);
