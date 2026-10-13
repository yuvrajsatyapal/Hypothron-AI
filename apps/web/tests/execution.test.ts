import { test, expect, vi, afterEach } from "vitest";
import { LocalExecutor } from "../lib/execution";
import type { MetricPlan } from "../../executor/src/contracts";
const plan: MetricPlan = {
  version: 1,
  kind: "revenue_sum",
  datasetHash: "a".repeat(64),
  amountColumn: "revenue",
  dateColumn: "completed_at",
  start: "2025-07-01T00:00:00Z",
  end: "2025-10-01T00:00:00Z",
  timezone: "UTC",
  currency: "USD",
  nullPolicy: "exclude",
};
class Port {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  other!: Port;
  postMessage(data: unknown) {
    queueMicrotask(() => this.other.onmessage?.({ data }));
  }
  start() {}
  close() {}
}
function setup(handshake = true, documentReady = true) {
  let listener: ((event: unknown) => void) | null = null;
  let connections = 0;
  vi.stubGlobal("window", {
    addEventListener(_type: string, handler: (event: unknown) => void) {
      listener = handler;
    },
    removeEventListener() {
      listener = null;
    },
  });
  let peer: Port;
  vi.stubGlobal(
    "MessageChannel",
    class {
      port1 = new Port();
      port2 = new Port();
      constructor() {
        this.port1.other = this.port2;
        this.port2.other = this.port1;
      }
    },
  );
  const frame = {
    contentWindow: {
      postMessage(data: { type: string }, _origin: string, ports: Port[] = []) {
        if (data.type === "PROBE") {
          if (documentReady)
            listener?.({
              data: { type: "HOST_READY" },
              origin: "http://127.0.0.1:3001",
              source: frame.contentWindow,
              ports: [],
            });
          return;
        }
        connections++;
        peer = ports[0];
        if (handshake) peer.postMessage({ type: "CONNECTED" });
      },
    },
  } as unknown as HTMLIFrameElement;
  const executor = new LocalExecutor(frame);
  return {
    executor,
    ready(
      origin = "http://127.0.0.1:3001",
      source: unknown = frame.contentWindow,
    ) {
      listener?.({ data: { type: "HOST_READY" }, origin, source, ports: [] });
    },
    get connections() {
      return connections;
    },
    get peer() {
      return peer!;
    },
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
test.each(["cancel", "close"] as const)(
  "Parquet reserves before hashing and %s settles it",
  async (action) => {
    const { executor } = setup();
    const bytes = new Uint8Array(13);
    bytes.set(new TextEncoder().encode("PAR1"));
    bytes.set(new TextEncoder().encode("PAR1"), 9);
    bytes[5] = 1;
    let finish!: (value: ArrayBuffer) => void;
    vi.spyOn(crypto.subtle, "digest").mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const run = executor.ingest(bytes);
    const assertion = expect(run).rejects.toThrow(
      action === "cancel" ? "CANCELLED" : "EXECUTOR_CLOSED",
    );
    try {
      expect(() => executor.execute(plan, new Uint8Array([1]))).toThrow("BUSY");
      await expect(executor.ingest(bytes)).rejects.toThrow("BUSY");
      executor[action]();
      await assertion;
    } finally {
      executor.close();
      finish?.(new ArrayBuffer(32));
    }
  },
);
test("rejects malformed result instead of casting it into evidence", async () => {
  const fixture = setup();
  fixture.peer.onmessage = (event) => {
    const data = event.data as { id: string };
    fixture.peer.postMessage({
      id: data.id,
      ok: true,
      result: { sql: {}, python: {} },
    });
  };
  await expect(
    fixture.executor.execute(plan, new Uint8Array([1])),
  ).rejects.toThrow("INVALID_RESULT");
  fixture.executor.close();
});
test("cancel rejects locally even if the executor disappears", async () => {
  const { executor } = setup();
  const run = executor.execute(plan, new Uint8Array([1]));
  const assertion = expect(run).rejects.toThrow("CANCELLED");
  await Promise.resolve();
  executor.cancel();
  await assertion;
  executor.close();
});
test("close rejects pending execution on executor reload", async () => {
  const { executor } = setup();
  const run = executor.execute(plan, new Uint8Array([1]));
  const assertion = expect(run).rejects.toThrow("EXECUTOR_CLOSED");
  executor.close();
  await assertion;
});
test("missing handshake has a bounded deadline", async () => {
  vi.useFakeTimers();
  const { executor } = setup(false);
  const run = executor.execute(plan, new Uint8Array([1]));
  const assertion = expect(run).rejects.toThrow("EXECUTOR_UNAVAILABLE");
  await vi.advanceTimersByTimeAsync(5001);
  await assertion;
  executor.close();
});
test("execution reply timeout is bounded even after a successful handshake", async () => {
  vi.useFakeTimers();
  const { executor } = setup();
  const run = executor.execute(plan, new Uint8Array([1]));
  const assertion = expect(run).rejects.toThrow("TIMEOUT");
  await vi.advanceTimersByTimeAsync(35001);
  await assertion;
  executor.close();
});

test("joining local snapshots requires deliberate caller approval and freezes plan", async () => {
  const fixture = setup(false);
  const advanced: MetricPlan = {
    ...plan,
    version: 2,
    grainKeys: ["order_id"],
    relationship: {
      datasetHash: "b".repeat(64),
      keyColumn: "customer_id",
      lookupKeyColumn: "id",
      cardinality: "many_to_one",
      populationCount: 1,
    },
  };
  expect(() => fixture.executor.execute(advanced, new Uint8Array([1]))).toThrow(
    "RELATIONSHIP_APPROVAL_REQUIRED",
  );
  const run = fixture.executor.execute(advanced, new Uint8Array([1]), {
    bytes: new Uint8Array([2]),
    approvedRelationship: true,
  });
  const assertion = expect(run).rejects.toThrow("CANCELLED");
  advanced.grainKeys![0] = "mutated";
  advanced.relationship!.populationCount = 99;
  let received: unknown;
  fixture.peer.onmessage = (e) => (received = e.data);
  fixture.peer.postMessage({ type: "CONNECTED" });
  await Promise.resolve();
  await Promise.resolve();
  expect(received).toMatchObject({
    plan: { grainKeys: ["order_id"], relationship: { populationCount: 1 } },
    lookupBytes: new Uint8Array([2]),
    approvedRelationship: true,
  });
  fixture.executor.cancel();
  await assertion;
  fixture.executor.close();
});

test("early calculation waits for verified document readiness and transfers one channel", async () => {
  const fixture = setup(false, false);
  const run = fixture.executor.execute(plan, new Uint8Array([1]));
  const assertion = expect(run).rejects.toThrow("CANCELLED");
  fixture.executor.notifyFrameLoaded();
  fixture.ready("http://evil.invalid");
  fixture.ready("http://127.0.0.1:3001", {});
  expect(fixture.connections).toBe(0);
  fixture.ready();
  fixture.ready();
  fixture.executor.notifyFrameLoaded();
  expect(fixture.connections).toBe(1);
  fixture.executor.cancel();
  await assertion;
  fixture.executor.close();
});

test("cancelled reply hashing cannot settle a later calculation", async () => {
  const fixture = setup();
  const bytes = new Uint8Array(13);
  bytes.set(new TextEncoder().encode("PAR1"));
  bytes.set(new TextEncoder().encode("PAR1"), 9);
  bytes[5] = 1;
  const finishes: ((value: ArrayBuffer) => void)[] = [];
  vi.spyOn(crypto.subtle, "digest").mockImplementation(
    () => new Promise((resolve) => finishes.push(resolve)),
  );
  fixture.peer.onmessage = (event) => {
    const message = event.data as { id: string; type: string };
    if (message.type === "PARQUET")
      fixture.peer.postMessage({
        id: message.id,
        ok: true,
        result: {
          bytes: new TextEncoder().encode("id\n1\n"),
          sourceHash: "0".repeat(64),
          datasetHash: "0".repeat(64),
          normalization: "parquet-csv-v1",
          decoder: "duckdb-v1.4.3",
          rows: 1,
          schema: [{ name: "id", type: "INTEGER" }],
        },
      });
  };
  const old = fixture.executor.ingest(bytes);
  const oldAssertion = expect(old).rejects.toThrow("CANCELLED");
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(finishes).toHaveLength(2);
  fixture.executor.cancel();
  await oldAssertion;
  const next = fixture.executor.execute(plan, new Uint8Array([1]));
  const nextAssertion = expect(next).rejects.toThrow("CANCELLED");
  for (const finish of finishes) finish(new ArrayBuffer(32));
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(() => fixture.executor.execute(plan, new Uint8Array([1]))).toThrow(
    "BUSY",
  );
  fixture.executor.cancel();
  await nextAssertion;
  fixture.executor.close();
});
