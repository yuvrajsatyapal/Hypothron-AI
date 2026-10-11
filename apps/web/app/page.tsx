"use client";
import { useRef, useState } from "react";
import { Investigation } from "../components/Investigation";
import {
  LocalExecutor,
  contentHash,
  type MetricPlan,
  type ExecutionResult,
} from "../lib/execution";
import { verification, replayMatches } from "../../executor/src/contracts";
export default function Page() {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const executor = useRef<LocalExecutor | null>(null);
  const bytes = useRef<Uint8Array | null>(null);
  const [filename, setFilename] = useState("");
  const [hash, setHash] = useState("");
  const [amount, setAmount] = useState("revenue");
  const [date, setDate] = useState("completed_at");
  const [start, setStart] = useState("2025-07-01T00:00:00Z");
  const [end, setEnd] = useState("2025-10-01T00:00:00Z");
  const [status, setStatus] = useState("Choose a CSV to begin.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [replay, setReplay] = useState("");
  const uploadGeneration = useRef(0);
  const [executedPlan, setExecutedPlan] = useState<MetricPlan | null>(null);
  const saved = useRef<{ plan: MetricPlan; result: ExecutionResult } | null>(
    null,
  );
  async function run(isReplay = false) {
    if (!bytes.current) return;
    if (!executor.current && frame.current)
      executor.current = new LocalExecutor(frame.current);
    if (!executor.current) {
      setStatus("EXECUTOR_UNAVAILABLE");
      return;
    }
    setBusy(true);
    setResult(null);
    setReplay("");
    setStatus("Loading isolated runtimes and computing locally…");
    const plan =
      isReplay && saved.current
        ? saved.current.plan
        : ({
            version: 1,
            kind: "revenue_sum",
            datasetHash: hash,
            amountColumn: amount,
            dateColumn: date,
            start,
            end,
            timezone: "UTC",
            currency: "USD",
            nullPolicy: "exclude",
          } as MetricPlan);
    try {
      const computed = await executor.current.execute(plan, bytes.current);
      setResult(computed);
      setExecutedPlan({ ...plan });
      setStatus("Local execution complete.");
      if (isReplay && saved.current)
        setReplay(
          replayMatches(saved.current.result, computed) ? "MATCH" : "MISMATCH",
        );
      else saved.current = { plan, result: computed };
    } catch (error) {
      setResult(null);
      setStatus(
        (error instanceof Error ? error.message : "EXECUTION_FAILED") +
          ": Check the selected columns, UTC dates and input limits, then retry. Reload if the runtime is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <strong>Hypothron AI</strong>
        <span>Deterministic browser foundation</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">LOCAL ANALYTICAL WORKSPACE</p>
          <h1>Inspect the evidence.</h1>
          <p>
            Datasets remain in browser memory. This foundation calculates
            revenue independently with SQL and Python. AI investigations require
            explicit provider consent. No automatic saving.
          </p>
        </section>
        <div className="workspace">
          <section className="controls">
            <h2>Dataset and metric</h2>
            <label>
              Dataset CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={async (e) => {
                  if (busy) return;
                  const generation = ++uploadGeneration.current;
                  const f = e.target.files?.[0];
                  setResult(null);
                  saved.current = null;
                  setReplay("");
                  bytes.current = null;
                  setFilename("");
                  setHash("");
                  setStatus("Choose a CSV to begin.");
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) {
                    setStatus(
                      "INPUT_LIMIT: Choose a CSV no larger than 10 MiB.",
                    );
                    return;
                  }
                  try {
                    const data = new Uint8Array(await f.arrayBuffer());
                    const digest = await contentHash(data);
                    if (generation !== uploadGeneration.current) return;
                    bytes.current = data;
                    setFilename(f.name);
                    setHash(digest);
                    setStatus("Dataset loaded into local memory.");
                  } catch {
                    if (generation === uploadGeneration.current)
                      setStatus("INPUT_READ_FAILED: Select the file again.");
                  }
                }}
              />
            </label>
            <p>{filename || "No dataset selected"}</p>
            <label>
              Amount column
              <input
                disabled={busy}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Date column
              <input
                disabled={busy}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              Period start (inclusive UTC)
              <input
                disabled={busy}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Period end (exclusive UTC)
              <input
                disabled={busy}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <p>
              Contract: USD, exact cents, UTC, exclude missing amounts. Initial
              supported operation: revenue sum.
            </p>
            <div className="actions">
              <button disabled={!hash || busy} onClick={() => run()}>
                Execute locally
              </button>
              <button
                disabled={!busy}
                className="secondary"
                onClick={() => executor.current?.cancel()}
              >
                Cancel
              </button>
              <button
                className="secondary"
                disabled={!saved.current || busy}
                onClick={() => run(true)}
              >
                Replay original calculations
              </button>
            </div>
          </section>
          <section className="evidence">
            <h2>Independent numerical evidence</h2>
            <p role="status" aria-live="polite">
              {status}
            </p>
            {result && (
              <>
                <p data-testid="executed-contract">
                  Executed contract: {executedPlan?.amountColumn}, date{" "}
                  {executedPlan?.dateColumn}, [{executedPlan?.start},{" "}
                  {executedPlan?.end}), USD / UTC / missing amounts excluded.
                  Replay uses this original contract.
                </p>
                <p data-testid="verification" className="verdict">
                  {verification(result.sql, result.python).state} ·
                  CLIENT_REPORTED
                </p>
                <p>
                  Local agreement is not server attestation or proof of
                  causality.
                </p>
                <table>
                  <caption>
                    Exact monetary result in minor units (cents)
                  </caption>
                  <thead>
                    <tr>
                      <th>Engine</th>
                      <th>Value</th>
                      <th>Included rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>DuckDB-WASM</td>
                      <td data-testid="sql-value">
                        {result.sql.minorUnits ?? "undefined"}
                      </td>
                      <td>{result.sql.count}</td>
                    </tr>
                    <tr>
                      <td>Pyodide / Pandas</td>
                      <td data-testid="python-value">
                        {result.python.minorUnits ?? "undefined"}
                      </td>
                      <td>{result.python.count}</td>
                    </tr>
                  </tbody>
                </table>
                <p>
                  Dataset rows: {result.rows}; columns:{" "}
                  {result.schema.join(", ")}
                </p>
                <p data-testid="timing">
                  {Math.round(result.elapsedMs)} ms; DuckDB{" "}
                  {result.runtime.duckdb}; Pyodide {result.runtime.pyodide};
                  Pandas {result.runtime.pandas}; NumPy {result.runtime.numpy}
                </p>
                <p data-testid="memory">
                  Tracked DuckDB allocations: {result.memory.duckdbTrackedBytes}{" "}
                  bytes; Pandas dataframe: {result.memory.pandasDataframeBytes}{" "}
                  bytes. These measurements exclude runtime overhead and are not
                  peak heap bounds.
                </p>
                <p data-testid="replay">{replay}</p>
                <details>
                  <summary>Inspect compiled SQL and Python</summary>
                  <pre>{result.sqlSource}</pre>
                  <pre>{result.pythonSource}</pre>
                </details>
                <p className="hash">Snapshot SHA-256: {result.datasetHash}</p>
              </>
            )}
          </section>
        </div>
        {result && executedPlan && bytes.current && (
          <Investigation
            key={hash}
            primary={{ bytes: bytes.current, plan: executedPlan, result }}
            execute={async (plan, data) => {
              if (!executor.current) throw new Error("EXECUTOR_UNAVAILABLE");
              return executor.current.execute(plan, data);
            }}
            onBusy={setBusy}
            cancelLocal={() => executor.current?.cancel()}
          />
        )}
        <iframe
          ref={frame}
          title="Restricted analytical executor"
          src="http://127.0.0.1:3001/"
          sandbox="allow-scripts allow-same-origin"
          hidden
          onLoad={(e) => {
            executor.current?.close();
            executor.current = new LocalExecutor(e.currentTarget);
          }}
        />
      </main>
    </>
  );
}
