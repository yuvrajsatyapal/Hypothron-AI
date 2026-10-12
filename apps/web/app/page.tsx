"use client";
import { useRef, useState } from "react";
import { approvedMetric, executionVerdict } from "../components/metricApproval";
import { LocalHistory } from "../components/LocalHistory";
import { Investigation } from "../components/Investigation";
import {
  LocalExecutor,
  contentHash,
  type MetricPlan,
  type ExecutionResult,
} from "../lib/execution";
import { replayMatches } from "../../executor/src/contracts";
export default function Page() {
  const localId = useRef<string | null>(null);
  const localCreated = useRef<string>("");
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
  const [advanced, setAdvanced] = useState(false);
  const [currency, setCurrency] = useState<MetricPlan["currency"]>("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [nullPolicy, setNullPolicy] =
    useState<MetricPlan["nullPolicy"]>("exclude");
  const [grain, setGrain] = useState("id");
  const lookup = useRef<{ bytes: Uint8Array; datasetHash: string } | null>(
    null,
  );
  const lookupGeneration = useRef(0);
  const [lookupName, setLookupName] = useState("");
  const [lookupApproved, setLookupApproved] = useState(false);
  const [keyColumn, setKeyColumn] = useState("id");
  const [lookupKeyColumn, setLookupKeyColumn] = useState("id");
  const [cardinality, setCardinality] = useState<"one_to_one" | "many_to_one">(
    "many_to_one",
  );
  const [populationCount, setPopulationCount] = useState(0);
  const [executedLookup, setExecutedLookup] = useState<
    Uint8Array | undefined
  >();
  const uploadGeneration = useRef(0);
  const [executedPlan, setExecutedPlan] = useState<MetricPlan | null>(null);
  const saved = useRef<{
    plan: MetricPlan;
    result: ExecutionResult;
    lookup?: Uint8Array;
  } | null>(null);
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
    try {
      const plan =
        isReplay && saved.current
          ? saved.current.plan
          : approvedMetric({
              datasetHash: hash,
              amountColumn: amount,
              dateColumn: date,
              start,
              end,
              advanced,
              currency,
              timezone,
              nullPolicy,
              grain,
              ...(advanced && lookup.current
                ? {
                    lookup: {
                      datasetHash: lookup.current.datasetHash,
                      keyColumn,
                      lookupKeyColumn,
                      cardinality,
                      populationCount,
                      approved: lookupApproved,
                    },
                  }
                : {}),
            });
      const lookupBytes = isReplay
        ? saved.current?.lookup
        : advanced
          ? lookup.current?.bytes
          : undefined;
      const computed = await executor.current.execute(
        plan,
        bytes.current,
        lookupBytes
          ? { bytes: lookupBytes, approvedRelationship: true }
          : undefined,
      );
      setExecutedLookup(lookupBytes);
      setResult(computed);
      setExecutedPlan({ ...plan });
      setStatus("Local execution complete.");
      if (isReplay && saved.current)
        setReplay(
          replayMatches(saved.current.result, computed) ? "MATCH" : "MISMATCH",
        );
      else {
        saved.current = { plan, result: computed, lookup: lookupBytes };
        localId.current = crypto.randomUUID();
        localCreated.current = new Date().toISOString();
      }
    } catch (error) {
      setResult(null);
      setStatus(
        (error instanceof Error ? error.message : "EXECUTION_FAILED") +
          ": Check the selected columns, period timezone and input limits, then retry. Reload if the runtime is unavailable.",
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
                  setExecutedLookup(undefined);
                  setLookupApproved(false);
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
              Period start (inclusive)
              <input
                disabled={busy}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Period end (exclusive)
              <input
                disabled={busy}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={advanced}
                disabled={busy}
                onChange={(e) => {
                  setAdvanced(e.target.checked);
                  setLookupApproved(false);
                }}
              />
              Use advanced v2 contract (grain, currency and timezone)
            </label>
            {advanced && (
              <fieldset disabled={busy} style={{ minWidth: 0 }}>
                <legend>Advanced metric contract</legend>
                <label>
                  Currency
                  <select
                    value={currency}
                    onChange={(e) =>
                      setCurrency(e.target.value as MetricPlan["currency"])
                    }
                  >
                    <option value="USD">USD (2 decimal places)</option>
                    <option value="EUR">EUR (2 decimal places)</option>
                    <option value="JPY">JPY (whole yen)</option>
                  </select>
                </label>
                <label>
                  Timezone (UTC or fixed offset)
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </label>
                <p>
                  Period timestamps must end with Z for UTC, or this exact
                  offset. Fixed offsets do not follow daylight saving changes.
                </p>
                <label>
                  Unique dataset grain keys (comma-separated)
                  <input
                    value={grain}
                    onChange={(e) => setGrain(e.target.value)}
                  />
                </label>
                <label>
                  Missing amount policy
                  <select
                    value={nullPolicy}
                    onChange={(e) =>
                      setNullPolicy(e.target.value as MetricPlan["nullPolicy"])
                    }
                  >
                    <option value="exclude">Exclude missing amounts</option>
                    <option value="error">Reject missing amounts</option>
                  </select>
                </label>
                <label>
                  Optional lookup CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const generation = ++lookupGeneration.current;
                      lookup.current = null;
                      setLookupName("");
                      setLookupApproved(false);
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        setStatus("INPUT_LIMIT");
                        return;
                      }
                      try {
                        const data = new Uint8Array(await file.arrayBuffer());
                        const datasetHash = await contentHash(data);
                        if (generation !== lookupGeneration.current) return;
                        lookup.current = { bytes: data, datasetHash };
                        setLookupName(file.name);
                      } catch {
                        if (generation === lookupGeneration.current)
                          setStatus("INPUT_READ_FAILED");
                      }
                    }}
                  />
                </label>
                {lookupName && (
                  <>
                    <p>Lookup in local memory: {lookupName}</p>
                    <label>
                      Source join key
                      <input
                        value={keyColumn}
                        onChange={(e) => {
                          setKeyColumn(e.target.value);
                          setLookupApproved(false);
                        }}
                      />
                    </label>
                    <label>
                      Lookup join key
                      <input
                        value={lookupKeyColumn}
                        onChange={(e) => {
                          setLookupKeyColumn(e.target.value);
                          setLookupApproved(false);
                        }}
                      />
                    </label>
                    <label>
                      Join cardinality
                      <select
                        value={cardinality}
                        onChange={(e) => {
                          setCardinality(e.target.value as typeof cardinality);
                          setLookupApproved(false);
                        }}
                      >
                        <option value="many_to_one">
                          Many source rows to one lookup row
                        </option>
                        <option value="one_to_one">
                          One source row to one lookup row
                        </option>
                      </select>
                    </label>
                    <label>
                      Expected source population rows
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={populationCount}
                        onChange={(e) => {
                          setPopulationCount(Number(e.target.value));
                          setLookupApproved(false);
                        }}
                      />
                    </label>
                    <label className="consent-row">
                      <input
                        type="checkbox"
                        checked={lookupApproved}
                        onChange={(e) => setLookupApproved(e.target.checked)}
                      />
                      I approve this derived join on the displayed keys,
                      cardinality and population. Original source bytes remain
                      unchanged.
                    </label>
                  </>
                )}
              </fieldset>
            )}
            <p>
              Contract: {advanced ? currency : "USD"}, exact{" "}
              {advanced && currency === "JPY" ? "yen" : "minor units"},{" "}
              {advanced ? timezone : "UTC"},{" "}
              {nullPolicy === "exclude" ? "exclude" : "reject"} missing amounts.
              Revenue sum.
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
                  {executedPlan?.end}), {executedPlan?.currency} /{" "}
                  {executedPlan?.timezone} / {executedPlan?.nullPolicy} missing
                  amounts / v{executedPlan?.version}. Replay uses this original
                  contract.
                </p>
                <p data-testid="verification" className="verdict">
                  {executedPlan && executionVerdict(executedPlan, result).state}{" "}
                  · CLIENT_REPORTED
                </p>
                <p>
                  Local agreement is not server attestation or proof of
                  causality.
                </p>
                <table>
                  <caption>
                    Exact monetary result in{" "}
                    {executedPlan?.currency === "JPY" ? "yen" : "minor units"}
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
                {result.diagnostics && (
                  <div
                    style={{ overflowX: "auto" }}
                    tabIndex={0}
                    role="region"
                    aria-label="Independent contract diagnostics"
                  >
                    <table style={{ minWidth: 540 }}>
                      <caption>Independent contract diagnostics</caption>
                      <thead>
                        <tr>
                          <th>Engine</th>
                          <th>Population</th>
                          <th>Period</th>
                          <th>Null amounts</th>
                          <th>Unique grain</th>
                          <th>Join keys</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(["sql", "python"] as const).map((engine) => {
                          const d = result.diagnostics![engine];
                          return (
                            <tr key={engine}>
                              <th>{engine}</th>
                              <td>{d.populationRows}</td>
                              <td>{d.periodRows}</td>
                              <td>{d.nullAmounts}</td>
                              <td>{d.grainUniqueRows}</td>
                              <td>{d.joinUniqueRows}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
            primary={{
              bytes: bytes.current,
              plan: executedPlan,
              result,
              lookup: executedLookup,
            }}
            execute={async (plan, data, derivedLookup) => {
              if (!executor.current) throw new Error("EXECUTOR_UNAVAILABLE");
              return executor.current.execute(plan, data, derivedLookup);
            }}
            onBusy={setBusy}
            cancelLocal={() => executor.current?.cancel()}
          />
        )}
        <LocalHistory
          disabled={busy}
          input={
            result && executedPlan && bytes.current && localId.current
              ? {
                  id: localId.current,
                  question: "Local approved revenue calculation",
                  createdAt: localCreated.current,
                  parentId: null,
                  snapshots: [
                    bytes.current,
                    ...(executedLookup ? [executedLookup] : []),
                  ],
                  calculations: [
                    {
                      id: "local-1",
                      hypothesisId: "H1",
                      dependsOn: [],
                      plan: executedPlan,
                      result,
                    },
                  ],
                  report: null,
                  run: null,
                }
              : null
          }
        />
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
