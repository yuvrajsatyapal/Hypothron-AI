"use client";
import { useEffect, useRef, useState } from "react";
import {
  WorkspaceHeader,
  WorkspaceProgress,
} from "../../components/WorkspaceChrome";
import {
  approvedMetric,
  executionVerdict,
} from "../../components/metricApproval";
import { LocalHistory } from "../../components/LocalHistory";
import { Investigation } from "../../components/Investigation";
import {
  LocalExecutor,
  EXECUTOR_ORIGIN,
  contentHash,
  type MetricPlan,
  type ExecutionResult,
} from "../../lib/execution";
import { readLocalInput, validateInputSet } from "../../lib/ingestion";
import type { SourceInput } from "../../lib/artifacts";
import type { Artifact, ArtifactInput } from "../../lib/artifacts";
import { replayMatches } from "../../../executor/src/contracts";
export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const [investigationArtifact, setInvestigationArtifact] =
      useState<ArtifactInput | null>(null),
    [freshArtifact, setFreshArtifact] = useState<Artifact | null>(null);
  const [freshGeneration, setFreshGeneration] = useState(0);
  const localId = useRef<string | null>(null);
  const localCreated = useRef<string>("");
  const frame = useRef<HTMLIFrameElement | null>(null);
  const executor = useRef<LocalExecutor | null>(null);
  const bytes = useRef<Uint8Array | null>(null);
  const [filename, setFilename] = useState("");
  const [source, setSource] = useState<SourceInput | undefined>();
  const [sourceApproved, setSourceApproved] = useState(false);
  const [executedSources, setExecutedSources] = useState<SourceInput[]>([]);
  const [hash, setHash] = useState("");
  const [amount, setAmount] = useState("revenue");
  const [date, setDate] = useState("completed_at");
  const [start, setStart] = useState("2025-07-01T00:00:00Z");
  const [end, setEnd] = useState("2025-10-01T00:00:00Z");
  const [status, setStatus] = useState("Choose a CSV to begin.");
  const [busy, setBusy] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const localAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      localAbort.current?.abort();
      localAbort.current = null;
      executor.current?.close();
    },
    [],
  );
  function beginLocal() {
    const controller = new AbortController();
    localAbort.current = controller;
    setLocalBusy(true);
    setBusy(true);
    return controller;
  }
  function finishLocal(controller: AbortController) {
    if (localAbort.current !== controller) return;
    localAbort.current = null;
    setLocalBusy(false);
    setBusy(false);
  }
  function cancelLocal() {
    if (!localAbort.current) return;
    localAbort.current.abort();
    localAbort.current = null;
    ++uploadGeneration.current;
    ++lookupGeneration.current;
    executor.current?.cancel();
    setLocalBusy(false);
    setBusy(false);
    setStatus("CANCELLED");
  }
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [replay, setReplay] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [currency, setCurrency] = useState<MetricPlan["currency"]>("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [nullPolicy, setNullPolicy] =
    useState<MetricPlan["nullPolicy"]>("exclude");
  const [grain, setGrain] = useState("id");
  const lookup = useRef<{
    bytes: Uint8Array;
    datasetHash: string;
    source?: SourceInput;
  } | null>(null);
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
    const controller = beginLocal();
    setInvestigationArtifact(null);
    setFreshArtifact(null);
    setResult(null);
    setReplay("");
    setStatus("Loading isolated runtimes and computing locally…");
    try {
      if (!isReplay && source && !sourceApproved)
        throw new Error("SOURCE_APPROVAL_REQUIRED");
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
      if (!isReplay)
        validateInputSet([
          { bytes: bytes.current, hash, source },
          ...(lookupBytes && lookup.current
            ? [
                {
                  bytes: lookupBytes,
                  hash: lookup.current.datasetHash,
                  source: lookup.current.source,
                },
              ]
            : []),
        ]);
      const computed = await executor.current.execute(
        plan,
        bytes.current,
        lookupBytes
          ? { bytes: lookupBytes, approvedRelationship: true }
          : undefined,
      );
      if (localAbort.current !== controller || controller.signal.aborted)
        return;
      if (!isReplay)
        setExecutedSources([
          ...(source ? [source] : []),
          ...(lookupBytes && lookup.current?.source
            ? [lookup.current.source]
            : []),
        ]);
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
      if (localAbort.current !== controller || controller.signal.aborted)
        return;
      setResult(null);
      setStatus(
        (error instanceof Error ? error.message : "EXECUTION_FAILED") +
          ": Check the selected columns, period timezone and input limits, then retry. Reload if the runtime is unavailable.",
      );
    } finally {
      finishLocal(controller);
    }
  }
  return (
    <>
      <WorkspaceHeader />
      <main id="workspace" className="studio-main">
        <section className="intro">
          <p className="eyebrow">LOCAL ANALYTICAL WORKSPACE</p>
          <h1>Inspect the evidence.</h1>
          <p>
            Datasets remain in browser memory. This foundation calculates
            revenue independently with SQL and Python. AI investigations require
            explicit provider consent. No automatic saving.
          </p>
        </section>
        <WorkspaceProgress
          hasInput={!!hash}
          hasResult={!!result}
          busy={localBusy}
          historical={!!freshArtifact}
        />
        <div className="workspace">
          <section id="dataset-controls" className="controls">
            <h2>Dataset and metric</h2>
            <label>
              Dataset CSV
              <input
                type="file"
                accept=".csv,.parquet,text/csv,application/vnd.apache.parquet"
                disabled={busy || !hydrated}
                onChange={async (e) => {
                  if (busy) return;
                  const generation = ++uploadGeneration.current;
                  const f = e.target.files?.[0];
                  setResult(null);
                  setInvestigationArtifact(null);
                  setFreshArtifact(null);
                  setExecutedLookup(undefined);
                  setLookupApproved(false);
                  saved.current = null;
                  setReplay("");
                  bytes.current = null;
                  setSource(undefined);
                  setSourceApproved(false);
                  setExecutedSources([]);
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
                  const controller = beginLocal();
                  try {
                    if (!executor.current && frame.current)
                      executor.current = new LocalExecutor(frame.current);
                    if (!executor.current)
                      throw new Error("EXECUTOR_UNAVAILABLE");
                    setStatus("Reading local input and validating its format…");
                    const input = await readLocalInput(
                      f,
                      executor.current,
                      controller.signal,
                    );
                    const data = input.bytes,
                      digest = input.hash;
                    if (
                      generation !== uploadGeneration.current ||
                      localAbort.current !== controller ||
                      controller.signal.aborted
                    )
                      return;
                    setSource(input.source);
                    bytes.current = data;
                    setFilename(f.name);
                    setHash(digest);
                    setStatus("Dataset loaded into local memory.");
                  } catch (error) {
                    if (
                      generation === uploadGeneration.current &&
                      localAbort.current === controller &&
                      !controller.signal.aborted
                    )
                      setStatus(
                        error instanceof Error
                          ? error.message
                          : "INPUT_READ_FAILED",
                      );
                  } finally {
                    finishLocal(controller);
                  }
                }}
              />
            </label>
            <p>
              CSV and Parquet supported. Maximum three distinct sources
              including a lookup, 10 MiB per source. Each calculation permits at
              most 10 MiB combined primary and lookup CSV; all original and
              derived investigation snapshots together permit 30 MiB.
            </p>
            <p>{filename || "No dataset selected"}</p>
            {source && (
              <div data-testid="source-profile">
                <p>
                  {source.rows} rows ·{" "}
                  {source.schema.map((c) => c.name + ": " + c.type).join(", ")}
                </p>
                <p className="hash">
                  Original Parquet SHA-256: {source.sourceHash}
                </p>
                <p className="hash">
                  Canonical CSV SHA-256: {source.datasetHash}
                </p>
                <p>
                  {source.normalization}. DuckDB decodes Parquet once. DuckDB
                  and Pandas independently compute arithmetic over this
                  canonical CSV; parsing is shared.
                </p>
                <label className="consent-row">
                  <input
                    type="checkbox"
                    checked={sourceApproved}
                    disabled={busy}
                    onChange={(e) => setSourceApproved(e.target.checked)}
                  />
                  I approve this canonical CSV dataset version
                </label>
              </div>
            )}
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
                    accept=".csv,.parquet,text/csv,application/vnd.apache.parquet"
                    onChange={async (e) => {
                      if (busy) return;
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
                      const controller = beginLocal();
                      try {
                        if (!executor.current && frame.current)
                          executor.current = new LocalExecutor(frame.current);
                        if (!executor.current)
                          throw new Error("EXECUTOR_UNAVAILABLE");
                        const input = await readLocalInput(
                          file,
                          executor.current,
                          controller.signal,
                        );
                        const data = input.bytes,
                          datasetHash = input.hash;
                        if (
                          generation !== lookupGeneration.current ||
                          localAbort.current !== controller ||
                          controller.signal.aborted
                        )
                          return;
                        lookup.current = {
                          bytes: data,
                          datasetHash,
                          source: input.source,
                        };
                        setLookupName(file.name);
                      } catch (error) {
                        if (
                          generation === lookupGeneration.current &&
                          localAbort.current === controller &&
                          !controller.signal.aborted
                        )
                          setStatus(
                            error instanceof Error
                              ? error.message
                              : "INPUT_READ_FAILED",
                          );
                      } finally {
                        finishLocal(controller);
                      }
                    }}
                  />
                </label>
                {lookupName && (
                  <>
                    <p>Lookup in local memory: {lookupName}</p>
                    <p className="hash">
                      Lookup approved snapshot: {lookup.current?.datasetHash}
                    </p>
                    {lookup.current?.source && (
                      <p className="hash">
                        Original Parquet: {lookup.current.source.sourceHash};
                        canonical CSV {lookup.current.source.normalization};
                        shared DuckDB decoding.{" "}
                        {lookup.current.source.schema
                          .map((c) => c.name + ": " + c.type)
                          .join(", ")}
                      </p>
                    )}
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
                disabled={!localBusy}
                className="secondary"
                onClick={cancelLocal}
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
          <section id="evidence-panel" className="evidence">
            <h2>
              {freshArtifact
                ? "Historical saved input evidence"
                : "Independent numerical evidence"}
            </h2>
            {freshArtifact && (
              <p>
                Historical CLIENT_REPORTED playback from the saved parent. These
                displayed values, runtime and timing have not been recomputed by
                this pane. Fresh investigation jobs establish their own separate
                evidence below.
              </p>
            )}
            <p role="status" aria-live="polite">
              {status}
            </p>
            {!result && (
              <div className="studio-empty">
                <span aria-hidden="true">◇</span>
                <h3>Your investigation starts with local data.</h3>
                <p>
                  Choose a CSV or Parquet file in the dataset panel, review the
                  metric contract, then execute locally. Both numerical engines
                  run before AI reasoning begins.
                </p>
                <ol>
                  <li>Choose your local dataset</li>
                  <li>Review and execute an approved calculation</li>
                  <li>
                    Inspect the evidence or start a consented AI investigation
                  </li>
                </ol>
                <p>No dataset is uploaded or saved automatically.</p>
              </div>
            )}
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
                  {freshArtifact && "HISTORICAL "}
                  {executedPlan &&
                    executionVerdict(executedPlan, result).state}{" "}
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
                      <th>Included non-null metric rows</th>
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
            key={hash + "/" + freshGeneration}
            original={freshArtifact}
            onArtifact={setInvestigationArtifact}
            primary={{
              bytes: bytes.current,
              plan: executedPlan,
              result,
              lookup: executedLookup,
              sources: executedSources,
            }}
            ingest={async (file, signal) => {
              if (!executor.current && frame.current)
                executor.current = new LocalExecutor(frame.current);
              if (!executor.current) throw new Error("EXECUTOR_UNAVAILABLE");
              return readLocalInput(file, executor.current, signal);
            }}
            execute={async (plan, data, derivedLookup) => {
              if (!executor.current && frame.current)
                executor.current = new LocalExecutor(frame.current);
              if (!executor.current) throw new Error("EXECUTOR_UNAVAILABLE");
              return executor.current.execute(plan, data, derivedLookup);
            }}
            onBusy={setBusy}
            cancelLocal={() => executor.current?.cancel()}
          />
        )}
        <LocalHistory
          onFresh={(artifact) => {
            const c = artifact.manifest.calculations[0],
              primary = artifact.snapshots.find(
                (s) => s.hash === c.plan.datasetHash,
              )!;
            bytes.current = new Uint8Array(primary.bytes);
            setSource(undefined);
            setExecutedSources(
              (artifact.manifest.sources ?? []).map((source) => ({
                ...source,
                bytes: artifact.snapshots.find(
                  (s) => s.hash === source.sourceHash,
                )!.bytes,
              })),
            );
            setHash(c.plan.datasetHash);
            setFilename("Saved approved snapshot");
            setExecutedPlan(c.plan);
            setResult(c.result);
            setExecutedLookup(
              c.plan.relationship
                ? new Uint8Array(
                    artifact.snapshots.find(
                      (s) => s.hash === c.plan.relationship!.datasetHash,
                    )!.bytes,
                  )
                : undefined,
            );
            setFreshArtifact(artifact);
            setFreshGeneration((v) => v + 1);
            setInvestigationArtifact(null);
            localId.current = null;
            setStatus(
              "Saved inputs restored to memory for a separate fresh AI run. Consent and key required.",
            );
          }}
          execute={async (plan, data, derivedLookup) => {
            if (!executor.current && frame.current)
              executor.current = new LocalExecutor(frame.current);
            if (!executor.current) throw new Error("EXECUTOR_UNAVAILABLE");
            return executor.current.execute(plan, data, derivedLookup);
          }}
          cancelLocal={() => executor.current?.cancel()}
          onBusy={setBusy}
          disabled={busy}
          input={
            investigationArtifact ??
            (result && executedPlan && bytes.current && localId.current
              ? {
                  id: localId.current,
                  question: "Local approved revenue calculation",
                  createdAt: localCreated.current,
                  parentId: null,
                  snapshots: [
                    bytes.current,
                    ...(executedLookup ? [executedLookup] : []),
                  ],
                  sources: executedSources,
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
              : null)
          }
        />
        <iframe
          ref={frame}
          title="Restricted analytical executor"
          src={EXECUTOR_ORIGIN + "/"}
          sandbox="allow-scripts allow-same-origin"
          hidden
          onLoad={(e) => {
            if (!executor.current)
              executor.current = new LocalExecutor(e.currentTarget);
            else executor.current.notifyFrameLoaded();
          }}
        />
      </main>
    </>
  );
}
