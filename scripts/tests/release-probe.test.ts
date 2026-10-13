import { expect, test } from "vitest";
// @ts-expect-error the probe is an executable ESM script, tested at its HTTP boundary
import { checkResponse } from "../release-probe.mjs";

const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none'",
};
test("release probe refuses missing privacy and permissive worker headers", () => {
  expect(() =>
    checkResponse("worker", new Response("", { headers })),
  ).not.toThrow();
  expect(() => checkResponse("worker", new Response(""))).toThrow("HEADERS");
  expect(() =>
    checkResponse(
      "worker",
      new Response("", {
        headers: { ...headers, "content-security-policy": "default-src *" },
      }),
    ),
  ).toThrow("WORKER_POLICY");
  expect(() =>
    checkResponse("api", new Response("", { status: 503, headers })),
  ).toThrow("STATUS");
});
test.each([
  "default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src 'none' https://attacker.example",
  "default-src 'none'; script-src 'wasm-unsafe-eval'; connect-src *; connect-src 'none'",
  "default-src *; script-src 'wasm-unsafe-eval'; connect-src 'none'",
])("worker probe rejects misleading denied-connect header %s", (csp) => {
  expect(() =>
    checkResponse(
      "worker",
      new Response("", {
        headers: { ...headers, "content-security-policy": csp },
      }),
    ),
  ).toThrow("WORKER_POLICY");
});
