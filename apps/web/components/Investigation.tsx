"use client";
import { useEffect, useRef, useState } from "react";
import {
  type Artifact,
  type ArtifactInput,
  type SourceInput,
  type CalculationInput,
  createArtifact,
} from "../lib/artifacts";
import { validateInputSet, type LocalInput } from "../lib/ingestion";
import { compareInvestigations } from "../lib/comparison";
import { EvidenceReport } from "./EvidenceReport";
import {
  contentHash,
  type ExecutionResult,
  type MetricPlan,
} from "../lib/execution";
import {
  API_ORIGIN,
  apiJSON,
  validateInvestigationState,
  type InvestigationState,
} from "../lib/investigation";
interface Snapshot {
  bytes: Uint8Array;
  plan: MetricPlan;
  result: ExecutionResult;
  lookup?: Uint8Array;
  sources?: SourceInput[];
}
export function Investigation({
  primary,
  ingest,
  execute,
  onBusy,
  cancelLocal,
  original,
  onArtifact,
}: {
  primary: Snapshot;
  ingest: (file: File, signal?: AbortSignal) => Promise<LocalInput>;
  original?: Artifact | null;
  onArtifact?: (input: ArtifactInput | null) => void;
  execute: (
    plan: MetricPlan,
    bytes: Uint8Array,
    lookup?: { bytes: Uint8Array; approvedRelationship: true },
  ) => Promise<ExecutionResult>;
  onBusy: (busy: boolean) => void;
  cancelLocal: () => void;
}) {
  const [question, setQuestion] = useState(
    original?.manifest.question ?? "Investigate the approved revenue evidence.",
  );
  const [provider, setProvider] = useState(
      original?.manifest.run?.provider ?? "gemini",
    ),
    [model, setModel] = useState(
      original?.manifest.run?.model ?? "gemini-2.5-flash",
    );
  const runContext = useRef<{
    question: string;
    provider: string;
    model: string;
  } | null>(null);
  const calculations = useRef<CalculationInput[]>([]),
    createdAt = useRef("");
  const [comparison, setComparison] = useState<ReturnType<
    typeof compareInvestigations
  > | null>(null);
  async function capture(
    id: string,
    next: InvestigationState,
    signal: AbortSignal,
  ) {
    if (!onArtifact || !calculations.current.length) return;
    let tokens: number | null = null,
      providerElapsedMs: number | null = null,
      attempts: number | null = null;
    try {
      const viewed = await apiJSON(
        `/v1/investigations/${id}`,
        token.current,
        undefined,
        signal,
      );
      const m = viewed.measurements as Record<string, unknown>;
      if (
        m &&
        Number.isSafeInteger(m.attempts) &&
        Number(m.attempts) >= 0 &&
        Number(m.attempts) <= 12
      ) {
        attempts = Number(m.attempts);
        if (Number.isSafeInteger(m.tokens) && Number(m.tokens) >= 0)
          tokens = Number(m.tokens);
        if (
          Number.isSafeInteger(m.providerElapsedMs) &&
          Number(m.providerElapsedMs) >= 0
        )
          providerElapsedMs = Number(m.providerElapsedMs);
      }
    } catch {
      /* Measurements unavailable; never estimate or request inference. */
    }
    if (signal.aborted) throw new Error("CANCELLED");
    const context = runContext.current;
    if (!context) throw new Error("MISSING_RUN_CONTEXT");
    const input: ArtifactInput = {
      id,
      question: context.question,
      createdAt: createdAt.current,
      parentId: original?.manifest.id ?? null,
      approved: snapshots.current.map((s) => s.plan),
      snapshots: snapshots.current.flatMap((s) => [
        s.bytes,
        ...(s.lookup ? [s.lookup] : []),
      ]),
      sources: snapshots.current.flatMap((s) => s.sources ?? []),
      calculations: calculations.current.filter((c) =>
        next.evidence.some((e) => e.jobId === c.id),
      ),
      report: next.report ?? null,
      run: {
        provider: context.provider,
        model: context.model,
        hypotheses: next.hypotheses ?? [],
        tokens,
        providerElapsedMs,
        attempts,
      },
    };
    const artifact = await createArtifact(input);
    if (signal.aborted) throw new Error("CANCELLED");
    if (original) setComparison(compareInvestigations(original, artifact));
    onArtifact(input);
  }
  const keyInput = useRef<HTMLInputElement>(null),
    token = useRef<string | null>(null),
    runId = useRef<string | null>(null),
    snapshots = useRef<Snapshot[]>([]),
    operation = useRef<AbortController | null>(null),
    eventsAbort = useRef<AbortController | null>(null);
  const [extra, setExtra] = useState<(LocalInput & { name: string })[]>([]),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [state, setState] = useState<InvestigationState | null>(null),
    [message, setMessage] = useState(
      "AI investigations require explicit metadata/provider consent.",
    ),
    [answer, setAnswer] = useState(""),
    [events, setEvents] = useState<string[]>([]);
  const cursor = useRef(0);
  const generation = useRef(0);
  const importAbort = useRef<AbortController | null>(null);
  const [activeRun, setActiveRun] = useState<{
    provider: string;
    model: string;
    question: string;
  } | null>(null);
  useEffect(
    () => () => {
      operation.current?.abort();
      eventsAbort.current?.abort();
      importAbort.current?.abort();
      importAbort.current = null;
    },
    [],
  );
  async function observe(id: string, auth: string) {
    eventsAbort.current?.abort();
    const controller = new AbortController();
    eventsAbort.current = controller;
    try {
      while (!controller.signal.aborted) {
        const response = await fetch(
          `${API_ORIGIN}/v1/investigations/${id}/events?after=${cursor.current}`,
          {
            headers: { Authorization: "Bearer " + auth },
            signal: controller.signal,
            cache: "no-store",
            credentials: "omit",
          },
        );
        if (!response.ok) throw new Error("EVENT_STREAM_UNAVAILABLE");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("EVENT_STREAM_UNAVAILABLE");
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            if (buffer.length > 65536) throw new Error("EVENT_LIMIT");
            let boundary;
            while ((boundary = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const idLine = frame
                .split("\n")
                .find((l) => l.startsWith("id: "));
              const eventLine = frame
                .split("\n")
                .find((l) => l.startsWith("event: "));
              if (idLine && eventLine) {
                const next = Number(idLine.slice(4));
                if (Number.isSafeInteger(next) && next > cursor.current) {
                  cursor.current = next;
                  setEvents((old) =>
                    [...old, eventLine.slice(7, 71)].slice(-100),
                  );
                }
              }
            }
          }
        } finally {
          await reader.cancel();
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch {
      if (!controller.signal.aborted)
        setMessage("Event stream unavailable; Resume reads durable state.");
    }
  }
  async function drive(
    id: string,
    initial: unknown,
    key: string,
    signal: AbortSignal,
  ) {
    let next = validateInvestigationState(
      initial,
      snapshots.current.map((s) => s.plan),
    );
    setState(next);
    for (let jobs = 0; jobs <= 6; jobs++) {
      if (signal.aborted) throw new Error("CANCELLED");
      if (next.status !== "WAITING_RESULT") {
        if (next.status === "COMPLETE") await capture(id, next, signal);
        setMessage(next.error || next.status);
        return;
      }
      const job = next.pending;
      if (!job) throw new Error("INVALID_RESPONSE");
      const snapshot = snapshots.current.find(
        (s) => s.plan.datasetHash === job.plan.datasetHash,
      );
      if (!snapshot) throw new Error("SNAPSHOT_UNAVAILABLE");
      setMessage("Executing approved investigation job locally…");
      const result = await execute(
        job.plan,
        snapshot.bytes,
        snapshot.lookup
          ? { bytes: snapshot.lookup, approvedRelationship: true }
          : undefined,
      );
      if (signal.aborted) throw new Error("CANCELLED");
      if (!calculations.current.some((c) => c.id === job.id))
        calculations.current.push({
          id: job.id,
          hypothesisId: job.hypothesisId,
          dependsOn: [...job.dependsOn],
          plan: job.plan,
          result,
        });
      await apiJSON(
        `/v1/investigations/${id}/results`,
        token.current,
        {
          jobId: job.id,
          datasetHash: result.datasetHash,
          sql: result.sql,
          python: result.python,
          ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
        },
        signal,
      );
      const response = await apiJSON(
        `/v1/investigations/${id}/advance`,
        token.current,
        { key },
        signal,
      );
      next = validateInvestigationState(
        response.state,
        snapshots.current.map((s) => s.plan),
      );
      setState(next);
    }
    throw new Error("JOB_BUDGET_EXHAUSTED");
  }
  async function investigate(resume = false) {
    if (operation.current) return;
    if (!consent) {
      setMessage("CONSENT_REQUIRED");
      return;
    }
    const key = keyInput.current?.value || "";
    if (key.length < 8) {
      setMessage("Enter a provider key of at least 8 characters.");
      return;
    }
    const controller = new AbortController();
    generation.current++;
    operation.current = controller;
    const deadline = setTimeout(() => controller.abort(), 600000);
    if (!resume) {
      runId.current = null;
      runContext.current = null;
      calculations.current = [];
      createdAt.current = new Date().toISOString();
      onArtifact?.(null);
      setComparison(null);
      snapshots.current = [];
      setState(null);
      setActiveRun(null);
      setAnswer("");
      setEvents([]);
      cursor.current = 0;
    }
    setBusy(true);
    onBusy(true);
    try {
      if (!token.current) {
        const session = await apiJSON(
          "/v1/sessions",
          null,
          {},
          controller.signal,
        );
        if (typeof session.token !== "string")
          throw new Error("INVALID_RESPONSE");
        token.current = session.token;
      }
      if (resume && runId.current) {
        const viewed = await apiJSON(
          `/v1/investigations/${runId.current}`,
          token.current,
          undefined,
          controller.signal,
        );
        const current = validateInvestigationState(
          viewed.state,
          snapshots.current.map((s) => s.plan),
        );
        if (
          ["COMPLETE", "FAILED", "BUDGET_EXHAUSTED", "CANCELLED"].includes(
            current.status,
          )
        ) {
          if (current.status === "COMPLETE")
            await capture(runId.current, current, controller.signal);
          setState(current);
          setMessage(current.error || current.status);
          return;
        }
        const response = await apiJSON(
          `/v1/investigations/${runId.current}/advance`,
          token.current,
          { key, ...(current.status === "CLARIFYING" ? { answer } : {}) },
          controller.signal,
        );
        void observe(runId.current, token.current);
        await drive(runId.current, response.state, key, controller.signal);
      } else {
        if (!consent) throw new Error("CONSENT_REQUIRED");
        snapshots.current = [primary];

        if (original) {
          snapshots.current = [];
          for (const plan of original.manifest.approved) {
            const bytes = original.snapshots.find(
              (s) => s.hash === plan.datasetHash,
            )!.bytes;
            const lookup = plan.relationship
              ? original.snapshots.find(
                  (s) => s.hash === plan.relationship!.datasetHash,
                )!.bytes
              : undefined;
            const result = await execute(
              plan,
              bytes,
              lookup
                ? { bytes: lookup, approvedRelationship: true }
                : undefined,
            );
            controller.signal.throwIfAborted();
            snapshots.current.push({
              plan,
              bytes,
              lookup,
              result,
              sources: (original.manifest.sources ?? [])
                .filter(
                  (source) =>
                    source.datasetHash === plan.datasetHash ||
                    source.datasetHash === plan.relationship?.datasetHash,
                )
                .map((source) => ({
                  ...source,
                  bytes: original.snapshots.find(
                    (s) => s.hash === source.sourceHash,
                  )!.bytes,
                })),
            });
          }
        }
        const allInputs = snapshots.current.flatMap((s) => [
          {
            bytes: s.bytes,
            hash: s.plan.datasetHash,
            source: s.sources?.find(
              (source) => source.datasetHash === s.plan.datasetHash,
            ),
          },
          ...(s.lookup
            ? [
                {
                  bytes: s.lookup,
                  hash: s.plan.relationship!.datasetHash,
                  source: s.sources?.find(
                    (source) =>
                      source.datasetHash === s.plan.relationship!.datasetHash,
                  ),
                },
              ]
            : []),
        ]);
        validateInputSet([...allInputs, ...(original ? [] : extra)]);
        for (const input of original ? [] : extra) {
          controller.signal.throwIfAborted();
          const plan = {
            ...primary.plan,
            datasetHash: input.hash,
            ...(primary.plan.version === 2 ? { relationship: null } : {}),
          };
          const result = await execute(plan, input.bytes);
          controller.signal.throwIfAborted();
          snapshots.current.push({
            bytes: input.bytes,
            plan,
            result,
            sources: input.source ? [input.source] : [],
          });
        }
        const descriptors = snapshots.current.map((s) => ({
          datasetHash: s.plan.datasetHash,
          columns: s.result.schema,
          contract: s.plan,
        }));
        controller.signal.throwIfAborted();
        const identifier = crypto.randomUUID();
        runId.current = identifier;
        runContext.current = { provider, model, question };
        setActiveRun({ provider, model, question });
        const response = await apiJSON(
          "/v1/investigations",
          token.current,
          {
            requestId: identifier,
            request: { question, datasets: descriptors },
            provider,
            model,
            key,
            consent: true,
          },
          controller.signal,
        );
        if (typeof response.id !== "string")
          throw new Error("INVALID_RESPONSE");
        runId.current = response.id;
        cursor.current = 0;
        setEvents([]);
        void observe(response.id, token.current);
        controller.signal.throwIfAborted();
        const started = await apiJSON(
          `/v1/investigations/${response.id}/advance`,
          token.current,
          { key },
          controller.signal,
        );
        await drive(response.id, started.state, key, controller.signal);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "INVESTIGATION_FAILED",
      );
    } finally {
      clearTimeout(deadline);
      if (keyInput.current) keyInput.current.value = "";
      eventsAbort.current?.abort();
      operation.current = null;
      setBusy(false);
      onBusy(false);
    }
  }
  async function cancel() {
    if (importAbort.current) {
      importAbort.current.abort(new Error("CANCELLED"));
      importAbort.current = null;
      cancelLocal();
      if (keyInput.current) keyInput.current.value = "";
      setBusy(false);
      onBusy(false);
      setMessage("CANCELLED");
      return;
    }
    const cancelledGeneration = generation.current;
    const cancelledRun = runId.current;
    const cancelledToken = token.current;
    operation.current?.abort();
    eventsAbort.current?.abort();
    cancelLocal();
    if (keyInput.current) keyInput.current.value = "";
    const stillCurrent = () =>
      generation.current === cancelledGeneration &&
      runId.current === cancelledRun;
    if (cancelledRun && cancelledToken) {
      try {
        await apiJSON(
          `/v1/investigations/${cancelledRun}/cancel`,
          cancelledToken,
          {},
        );
        if (stillCurrent()) setMessage("CANCELLED");
      } catch {
        if (stillCurrent())
          setMessage(
            "Local work stopped. Server cancellation was not acknowledged; Resume checks its durable state.",
          );
      }
    } else if (stillCurrent())
      setMessage("Local work stopped. No acknowledged server cancellation.");
  }
  return (
    <section className="controls" aria-label="Autonomous investigation">
      <h2>Hypothesis-driven investigation</h2>
      {original && (
        <p>
          Separate fresh AI run linked to {original.manifest.id}. Fresh provider
          consent and BYOK are required. Reasoning may change; original evidence
          remains immutable.
        </p>
      )}
      {comparison && (
        <div data-testid="fresh-comparison">
          <h3>Fresh run comparison</h3>
          <p>
            Structural comparison; matching text does not prove equivalent
            reasoning. Provider elapsed time is measured request time, not
            end-to-end runtime or price.
          </p>
          <div
            style={{ overflowX: "auto" }}
            tabIndex={0}
            role="region"
            aria-label="Fresh investigation comparison"
          >
            <table style={{ minWidth: 640 }}>
              <caption>Original versus fresh AI run</caption>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Original</th>
                  <th>Fresh</th>
                  <th>Comparison</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(comparison).map(([name, c]) => (
                  <tr key={name}>
                    <th>{name}</th>
                    <td>
                      {c.saved === null
                        ? "unavailable"
                        : typeof c.saved === "number"
                          ? c.saved
                          : JSON.stringify(c.saved)}
                    </td>
                    <td>
                      {c.current === null
                        ? "unavailable"
                        : typeof c.current === "number"
                          ? c.current
                          : JSON.stringify(c.current)}
                    </td>
                    <td>{c.matches ? "same representation" : "changed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p>
        Approved metric: {primary.plan.amountColumn}, [{primary.plan.start},{" "}
        {primary.plan.end}), {primary.plan.currency} / {primary.plan.timezone} /
        v{primary.plan.version}. Raw CSV bytes remain local.
      </p>
      <label>
        Investigation question
        <textarea
          disabled={busy}
          value={question}
          maxLength={2000}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </label>
      <label>
        Additional CSV datasets (up to two)
        <input
          type="file"
          multiple
          accept=".csv,.parquet,text/csv,application/vnd.apache.parquet"
          disabled={busy || !!original}
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            setConsent(false);
            setExtra([]);
            onArtifact?.(null);
            if (files.length > (primary.lookup ? 1 : 2)) {
              setMessage(
                "DATASET_LIMIT: Three sources total, including the approved lookup.",
              );
              return;
            }
            setBusy(true);
            onBusy(true);
            const controller = new AbortController();
            importAbort.current = controller;
            try {
              const inputs = [];
              for (const file of files)
                inputs.push({
                  ...(await ingest(file, controller.signal)),
                  name: file.name,
                });
              controller.signal.throwIfAborted();
              validateInputSet([
                { bytes: primary.bytes, hash: primary.plan.datasetHash },
                ...(primary.lookup
                  ? [
                      {
                        bytes: primary.lookup,
                        hash: primary.plan.relationship!.datasetHash,
                      },
                    ]
                  : []),
                ...inputs,
              ]);
              setExtra(inputs);
              setMessage(
                "Additional versions loaded locally. Approve their displayed metric semantics and provider disclosure to start.",
              );
            } catch (error) {
              if (
                importAbort.current === controller &&
                !controller.signal.aborted
              )
                setMessage(
                  error instanceof Error ? error.message : "INPUT_READ_FAILED",
                );
            } finally {
              if (importAbort.current === controller) {
                importAbort.current = null;
                setBusy(false);
                onBusy(false);
              }
            }
          }}
        />
      </label>
      <p>
        {extra.map((f) => f.name).join(", ") ||
          "Primary dataset only. Extra datasets use the displayed approved metric; derived join contracts use only the original source and approved lookup."}
      </p>
      <p>
        CSV or Parquet. Additional inputs use the displayed contract
        independently, without the primary lookup relationship. Selecting new
        versions clears consent.
      </p>
      {extra.map((input) => (
        <p className="hash" key={input.hash}>
          {input.name}: canonical dataset {input.hash}
          {input.source && (
            <>
              ; original Parquet {input.source.sourceHash};{" "}
              {input.source.normalization}; {input.source.rows} rows;{" "}
              {input.source.schema
                .map((c) => c.name + ": " + c.type)
                .join(", ")}
              . Shared DuckDB decoding, independent arithmetic.
            </>
          )}
        </p>
      ))}
      <label htmlFor="investigation-provider">LLM provider</label>
      <select
        id="investigation-provider"
        disabled={busy}
        value={provider}
        onChange={(e) => {
          setProvider(e.target.value);
          setModel(
            e.target.value === "gemini"
              ? "gemini-2.5-flash"
              : "google/gemini-2.5-flash",
          );
        }}
      >
        <option value="gemini">Gemini</option>
        <option value="openrouter">OpenRouter</option>
      </select>
      <label>
        Provider model
        <input
          value={model}
          disabled={busy}
          maxLength={128}
          onChange={(e) => setModel(e.target.value)}
        />
      </label>
      <p>
        Use a model available to your account. Free availability and charges
        depend on the provider; no live compatibility or price is asserted. Up
        to 12 requests, 1024 output tokens per request; ambiguous billing is
        surfaced.
      </p>
      <label>
        BYOK provider key
        <input
          ref={keyInput}
          type="password"
          autoComplete="off"
          maxLength={512}
          disabled={busy}
        />
      </label>
      <label className="consent-row">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I approve sending the question, column names, hashes, metric contracts
        and bounded aggregate evidence to the backend and selected provider.
        Metadata expires after 24 hours; cleanup is opportunistic locally. My
        key stays in short-lived memory and is cleared after completion,
        cancellation or a clarification pause (maximum ten minutes). No raw rows
        are sent. I approve these displayed dataset versions and the displayed
        metric contract for each independent input.
      </label>
      {state?.status === "CLARIFYING" && (
        <label>
          Clarification: {state.clarification}
          <input
            disabled={busy}
            value={answer}
            maxLength={1000}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </label>
      )}
      <div className="actions">
        <button disabled={busy || !consent} onClick={() => investigate()}>
          Start AI investigation
        </button>
        <button
          className="secondary"
          disabled={
            busy ||
            !consent ||
            !runId.current ||
            (state?.status === "CLARIFYING" && !answer.trim())
          }
          onClick={() => investigate(true)}
        >
          {state?.status === "CLARIFYING"
            ? "Answer and resume"
            : "Resume original investigation"}
        </button>
        <button className="secondary" disabled={!busy} onClick={cancel}>
          Cancel investigation
        </button>
      </div>
      <p role="status" aria-live="polite" data-testid="investigation-status">
        {message}
      </p>
      {activeRun && (
        <p data-testid="active-investigation">
          Original run: {activeRun.provider} / {activeRun.model}. Question:{" "}
          {activeRun.question}
        </p>
      )}
      {state?.pending && (
        <p>
          Pending hypothesis {state.pending.hypothesisId}:{" "}
          {state.pending.reason}
        </p>
      )}
      {state?.evidence.map((e) => (
        <p key={e.jobId}>
          Hypothesis {e.hypothesisId} · {e.jobId}:{" "}
          {e.sql.minorUnits ?? "undefined"}{" "}
          {primary.plan.currency === "JPY" ? "yen" : "minor units"} ·{" "}
          {e.verification} · {e.provenance}
          {e.classification && ` · ${e.classification}`}
        </p>
      ))}
      {state?.report && <EvidenceReport report={state.report} />}
      {state?.status === "COMPLETE" && !state.report && (
        <p>
          Legacy report requires evidence revalidation before structured
          findings can be displayed.
        </p>
      )}
      <details>
        <summary>Investigation event ledger</summary>
        <ol>
          {events.map((event, i) => (
            <li key={i}>{event}</li>
          ))}
        </ol>
      </details>
    </section>
  );
}
