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
function setup(handshake = true) {
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
      postMessage(_data: unknown, _origin: string, ports: Port[]) {
        peer = ports[0];
        if (handshake) peer.postMessage({ type: "CONNECTED" });
      },
    },
  } as unknown as HTMLIFrameElement;
  const executor = new LocalExecutor(frame);
  return {
    executor,
    get peer() {
      return peer!;
    },
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
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
