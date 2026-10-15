import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
test("backup refuses a shared directory before any Docker command", () => {
  const dir = mkdtempSync(join(tmpdir(), "hypothron-backup-policy-"));
  try {
    chmodSync(dir, 0o755);
    const result = spawnSync("bash", ["scripts/deployment/backup.sh", dir], {
      encoding: "utf8",
      env: { PATH: process.env.PATH },
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /mode 0700/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
