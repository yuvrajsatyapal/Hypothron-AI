import {
  contentHash,
  validatePlan,
  validateExecutionResult,
  type ExecutionResult,
  type MetricPlan,
} from "../../executor/src/contracts";
export { contentHash, validatePlan };
export type { ExecutionResult, MetricPlan };
export class LocalExecutor {
  private port: MessagePort;
  private connected = false;
  private closed = false;
  private handshake: ReturnType<typeof setTimeout>;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private pending: {
    id: string;
    plan: MetricPlan;
    bytes: Uint8Array;
    lookupBytes?: Uint8Array;
    resolve: (r: ExecutionResult) => void;
    reject: (e: Error) => void;
  } | null = null;
  constructor(frame: HTMLIFrameElement) {
    const channel = new MessageChannel();
    this.port = channel.port1;
    this.handshake = setTimeout(() => {
      this.closed = true;
      this.fail("EXECUTOR_UNAVAILABLE");
      this.port.close();
    }, 5000);
    this.port.onmessage = (event: MessageEvent<unknown>) => {
      if (
        !event.data ||
        typeof event.data !== "object" ||
        Array.isArray(event.data) ||
        this.closed
      )
        return;
      const data = event.data as Record<string, unknown>;
      if (
        !this.connected &&
        data.type === "CONNECTED" &&
        Object.keys(data).length === 1
      ) {
        this.connected = true;
        clearTimeout(this.handshake);
        this.send();
        return;
      }
      if (!this.pending || data.id !== this.pending.id) return;
      if (data.ok === true) {
        try {
          if (Object.keys(data).length !== 3) throw new Error("INVALID_RESULT");
          const result = validateExecutionResult(
            data.result,
            this.pending.plan,
          );
          const pending = this.pending;
          this.clear();
          pending.resolve(result);
        } catch {
          this.fail("INVALID_RESULT");
        }
      } else {
        const allowed = [
          "CANCELLED",
          "TIMEOUT",
          "INVALID_JOB",
          "INVALID_PLAN",
          "INVALID_HASH",
          "INVALID_PERIOD",
          "INVALID_COLUMN",
          "UNSUPPORTED_OPERATION",
          "DATASET_HASH_MISMATCH",
          "MISSING_COLUMN",
          "INVALID_DATA",
          "NULL_AMOUNT",
          "OUTPUT_LIMIT",
          "INPUT_LIMIT",
          "EXPANDED_INPUT_LIMIT",
          "EXECUTION_FAILED",
          "INVALID_GRAIN",
          "INVALID_RELATIONSHIP",
          "RELATIONSHIP_APPROVAL_REQUIRED",
          "GRAIN_VIOLATION",
          "JOIN_CARDINALITY",
          "POPULATION_MISMATCH",
        ];
        this.fail(
          typeof data.error === "string" && allowed.includes(data.error)
            ? data.error
            : "EXECUTION_FAILED",
        );
      }
    };
    this.port.start();
    frame.contentWindow?.postMessage(
      { type: "CONNECT" },
      "http://127.0.0.1:3001",
      [channel.port2],
    );
  }
  private clear() {
    this.pending = null;
    if (this.deadline) clearTimeout(this.deadline);
    this.deadline = null;
  }
  private fail(code: string) {
    const pending = this.pending;
    this.clear();
    pending?.reject(new Error(code));
  }
  private send() {
    if (this.connected && this.pending) {
      const p = this.pending;
      this.port.postMessage(
        {
          type: "EXECUTE",
          id: p.id,
          plan: p.plan,
          bytes: p.bytes,
          ...(p.lookupBytes
            ? { lookupBytes: p.lookupBytes, approvedRelationship: true }
            : {}),
        },
        [p.bytes.buffer, ...(p.lookupBytes ? [p.lookupBytes.buffer] : [])],
      );
    }
  }
  execute(
    plan: MetricPlan,
    bytes: Uint8Array,
    lookup?: { bytes: Uint8Array; approvedRelationship: true },
  ): Promise<ExecutionResult> {
    validatePlan(plan);
    const relationship = plan.version === 2 ? plan.relationship : null;
    if (
      relationship &&
      (!lookup ||
        lookup.approvedRelationship !== true ||
        !(lookup.bytes instanceof Uint8Array))
    )
      throw new Error("RELATIONSHIP_APPROVAL_REQUIRED");
    if (!relationship && lookup) throw new Error("INVALID_JOB");
    if (this.pending) throw new Error("BUSY");
    if (this.closed) throw new Error("EXECUTOR_CLOSED");
    const copy = new Uint8Array(bytes);
    return new Promise((resolve, reject) => {
      this.pending = {
        id: crypto.randomUUID(),
        plan: JSON.parse(JSON.stringify(plan)) as MetricPlan,
        bytes: copy,
        ...(lookup ? { lookupBytes: new Uint8Array(lookup.bytes) } : {}),
        resolve,
        reject,
      };
      this.deadline = setTimeout(() => {
        if (this.pending)
          this.port.postMessage({ type: "CANCEL", id: this.pending.id });
        this.fail("TIMEOUT");
      }, 35000);
      this.send();
    });
  }
  cancel() {
    if (this.pending) {
      this.port.postMessage({ type: "CANCEL", id: this.pending.id });
      this.fail("CANCELLED");
    }
  }
  close() {
    this.closed = true;
    clearTimeout(this.handshake);
    if (this.pending)
      this.port.postMessage({ type: "CANCEL", id: this.pending.id });
    this.fail("EXECUTOR_CLOSED");
    this.port.close();
  }
}
