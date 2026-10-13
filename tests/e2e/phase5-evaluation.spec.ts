import { test, expect } from "./fixtures";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import fixtures from "../fixtures/phase5-golden.json";
import {
  verification,
  validateExecutionResult,
  validatePlan,
} from "../../apps/executor/src/contracts";

test("twenty golden questions and twelve adverse fixtures through genuine independent browser engines", async ({
  page,
}) => {
  test.setTimeout(240000);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") requests.push(r.url());
  });
  await page.goto("/");
  const started = Date.now();
  const observations = await page.evaluate(async (fixtures) => {
    const frame = document.createElement("iframe");
    frame.src = "http://127.0.0.1:3001/";
    frame.hidden = true;
    document.body.append(frame);
    await new Promise<void>((resolve) => (frame.onload = () => resolve()));
    const channel = new MessageChannel();
    let receiver: (value: Record<string, unknown>) => void = () => {};
    channel.port1.onmessage = (e) => receiver(e.data);
    const connected = new Promise<void>(
      (resolve) =>
        (receiver = (r) => {
          if (r.type === "CONNECTED") resolve();
        }),
    );
    frame.contentWindow!.postMessage(
      { type: "CONNECT" },
      "http://127.0.0.1:3001",
      [channel.port2],
    );
    await connected;
    const hash = async (bytes: Uint8Array) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
    const results = [];
    for (const entry of [...fixtures.golden, ...fixtures.adversarial]) {
      const bytes = new TextEncoder().encode(entry.csv);
      const lookupBytes =
        "lookupCSV" in entry ? new TextEncoder().encode(entry.lookupCSV) : null;
      const plan = {
        version: 2,
        kind: "revenue_sum",
        datasetHash:
          "changedHash" in entry && entry.changedHash
            ? "0".repeat(64)
            : await hash(bytes),
        amountColumn: "revenue",
        dateColumn: "completed_at",
        ...entry.plan,
        relationship:
          lookupBytes && "relationship" in entry
            ? { datasetHash: await hash(lookupBytes), ...entry.relationship }
            : null,
      };
      const reply = new Promise<Record<string, unknown>>(
        (resolve) => (receiver = resolve),
      );
      channel.port1.postMessage({
        type: "EXECUTE",
        id: entry.id,
        plan,
        bytes,
        ...(lookupBytes
          ? {
              lookupBytes,
              approvedRelationship: !("approved" in entry) || entry.approved,
            }
          : {}),
      });
      const before = performance.now();
      const result = await reply;
      results.push({
        id: entry.id,
        elapsedMs: performance.now() - before,
        plan,
        reply: result,
      });
    }
    channel.port1.close();
    frame.remove();
    return results;
  }, fixtures);
  const measured = [];
  for (const observation of observations) {
    const golden = fixtures.golden.find((f) => f.id === observation.id);
    if (golden) {
      expect(observation.reply.ok, JSON.stringify(observation.reply)).toBe(
        true,
      );
      const result = validateExecutionResult(
        observation.reply.result,
        validatePlan(observation.plan),
      );
      const actual = verification(result.sql, result.python);
      expect(result.sql).toEqual({
        minorUnits: golden.expected.minorUnits,
        count: golden.expected.count,
      });
      expect(result.python).toEqual(result.sql);
      expect(actual.state).toBe(golden.expected.status);
      expect(actual.provenance).toBe("CLIENT_REPORTED");
      measured.push({
        id: golden.id,
        category: "golden",
        expected: golden.expected,
        actual: {
          sql: result.sql,
          python: result.python,
          status: actual.state,
          provenance: actual.provenance,
          diagnostics: result.diagnostics,
          plan: observation.plan,
        },
        elapsedMs: observation.elapsedMs,
        runtime: result.runtime,
        memory: result.memory,
        workerElapsedMs: result.elapsedMs,
        pass: true,
      });
    } else {
      const adverse = fixtures.adversarial.find(
        (f) => f.id === observation.id,
      )!;
      expect(observation.reply.ok, JSON.stringify(observation.reply)).toBe(
        false,
      );
      expect(observation.reply.error).toBe(adverse.expectedError);
      measured.push({
        id: adverse.id,
        category: "adversarial",
        expectedError: adverse.expectedError,
        actualError: observation.reply.error,
        status: "FAILED",
        elapsedMs: observation.elapsedMs,
        pass: true,
      });
    }
  }
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).length),
  ).toBe(0);
  expect(observations).toHaveLength(32);
  const contradictory = verification(
    { minorUnits: "1800", count: 3 },
    { minorUnits: "2000", count: 3 },
  );
  expect(contradictory.state).toBe("DISPUTED");
  const forged = verification(
    { minorUnits: "1800", count: 3 },
    { minorUnits: "1800", count: 3 },
  );
  expect(forged.provenance).toBe("CLIENT_REPORTED");
  await writeFile(
    resolve(
      process.env.HYPOTHRON_CI === "1"
        ? "test-results/phase5-evaluation.json"
        : "docs/reports/PHASE_5_EVALUATION.json",
    ),
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        fixture: "tests/fixtures/phase5-golden.json",
        target:
          process.env.HYPOTHRON_CI === "1"
            ? "Linux CI Chromium; real DuckDB-WASM and Pyodide/Pandas; mocked external HTTP only"
            : "Local desktop Chrome; real DuckDB-WASM and Pyodide/Pandas; mocked external HTTP only",
        browserVersion: page.context().browser()?.version(),
        elapsedMs: Date.now() - started,
        goldenQuestions: 20,
        adverseFixtures: 12,
        passed: measured.filter((item) => item.pass).length,
        falseVerifiedAdverse: 0,
        privacy: { rawPostRequests: requests.length, indexedDBDatabases: 0 },
        contradictionProbe: contradictory,
        forgeryBoundaryProbe: forged,
        observations: measured,
        limitations: [
          "Finite synthetic honest-client fixture suite, not adversarial execution attestation",
          "Empty and null-only periods remain INCONCLUSIVE",
          "No paid inference or live provider compatibility measurements",
        ],
      },
      null,
      2,
    ) + "\n",
  );
});
