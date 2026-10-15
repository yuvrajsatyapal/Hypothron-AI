import { test } from "node:test";
import assert from "node:assert/strict";
import { deploymentOrigins } from "../../scripts/deployment/origins.mjs";
test("local origins preserve exact current boundaries", () => {
  assert.deepEqual(deploymentOrigins({}), {
    app: "http://127.0.0.1:3000",
    api: "http://127.0.0.1:8000",
    executor: "http://127.0.0.1:3001",
  });
});
test("production rejects missing, credentialed, non-HTTPS, shared hostname and path origins", () => {
  const valid = {
    HYPOTHRON_DEPLOYMENT: "1",
    APP_ORIGIN: "https://app.example.test",
    API_ORIGIN: "https://api.example.test",
    EXECUTOR_ORIGIN: "https://compute.example.net",
  };
  assert.equal(deploymentOrigins(valid).executor, valid.EXECUTOR_ORIGIN);
  for (const invalid of [
    { EXECUTOR_ORIGIN: "" },
    { APP_ORIGIN: "http://app.example.test" },
    { API_ORIGIN: "https://user:secret@api.example.test" },
    { EXECUTOR_ORIGIN: "https://app.example.test:444" },
    { API_ORIGIN: "https://api.example.test/path" },
    { EXECUTOR_ORIGIN: "https://compute.example.net/?key=secret" },
  ]) {
    assert.throws(
      () => deploymentOrigins({ ...valid, ...invalid }),
      /^Error: INVALID_DEPLOYMENT_ORIGINS$/,
    );
  }
});
