import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
test("configured executor preserves worker egress denial and exact frame ancestor", async () => {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(process.execPath, ["apps/executor/server.mjs"], {
    stdio: "ignore",
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      HYPOTHRON_DEPLOYMENT: "1",
      APP_ORIGIN: "https://app.example.test",
      API_ORIGIN: "https://api.example.test",
      EXECUTOR_ORIGIN: "https://compute.example.net",
    },
  });
  try {
    let response;
    for (let i = 0; i < 100; i++) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/`);
        break;
      } catch {
        await setTimeout(100);
      }
    }
    assert.ok(response);
    assert.match(
      response.headers.get("content-security-policy"),
      /frame-ancestors https:\/\/app.example.test;/,
    );
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    for (const path of ["/worker.js", "/duckdb-worker.js"]) {
      const worker = await fetch(`http://127.0.0.1:${port}${path}`);
      const csp = worker.headers.get("content-security-policy");
      assert.match(csp, /connect-src 'none'/);
      if (path === "/worker.js")
        assert.match(
          csp,
          /worker-src https:\/\/compute.example.net\/duckdb-worker.js/,
        );
      else assert.match(csp, /worker-src 'none'/);
    }
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
  }
});
