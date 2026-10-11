"use client";
import { useEffect, useRef, useState } from "react";
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
}
export function Investigation({
  primary,
  execute,
  onBusy,
  cancelLocal,
}: {
  primary: Snapshot;
  execute: (plan: MetricPlan, bytes: Uint8Array) => Promise<ExecutionResult>;
  onBusy: (busy: boolean) => void;
  cancelLocal: () => void;
}) {
  const [question, setQuestion] = useState(
    "Investigate the approved revenue evidence.",
  );
  const [provider, setProvider] = useState("gemini"),
    [model, setModel] = useState("gemini-2.5-flash");
  const keyInput = useRef<HTMLInputElement>(null),
    token = useRef<string | null>(null),
    runId = useRef<string | null>(null),
    snapshots = useRef<Snapshot[]>([]),
    operation = useRef<AbortController | null>(null),
    eventsAbort = useRef<AbortController | null>(null);
  const [extra, setExtra] = useState<File[]>([]),
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
  const [activeRun, setActiveRun] = useState<{
    provider: string;
    model: string;
    question: string;
  } | null>(null);
  useEffect(
    () => () => {
      operation.current?.abort();
      eventsAbort.current?.abort();
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
      const result = await execute(job.plan, snapshot.bytes);
      if (signal.aborted) throw new Error("CANCELLED");
      await apiJSON(
        `/v1/investigations/${id}/results`,
        token.current,
        {
          jobId: job.id,
          datasetHash: result.datasetHash,
          sql: result.sql,
          python: result.python,
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
        for (const file of extra) {
          if (file.size > 10 * 1024 * 1024) throw new Error("INPUT_LIMIT");
          controller.signal.throwIfAborted();
          const bytes = new Uint8Array(await file.arrayBuffer());
          controller.signal.throwIfAborted();
          const hash = await contentHash(bytes);
          controller.signal.throwIfAborted();
          const plan = { ...primary.plan, datasetHash: hash };
          const result = await execute(plan, bytes);
          controller.signal.throwIfAborted();
          snapshots.current.push({ bytes, plan, result });
        }
        const descriptors = snapshots.current.map((s) => ({
          datasetHash: s.plan.datasetHash,
          columns: s.result.schema,
          contract: s.plan,
        }));
        controller.signal.throwIfAborted();
        const identifier = crypto.randomUUID();
        runId.current = identifier;
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
      <p>
        Approved metric: {primary.plan.amountColumn}, [{primary.plan.start},{" "}
        {primary.plan.end}), USD / UTC. Raw CSV bytes remain local.
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
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 2) {
              setMessage("DATASET_LIMIT: Select at most two additional CSVs.");
              setExtra([]);
            } else setExtra(files);
          }}
        />
      </label>
      <p>
        {extra.map((f) => f.name).join(", ") ||
          "Primary dataset only. Extra datasets use the displayed approved metric."}
      </p>
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
        are sent.
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
          {e.sql.minorUnits ?? "undefined"} cents · {e.verification} ·{" "}
          {e.provenance}
        </p>
      ))}
      {state?.report && (
        <div data-testid="investigation-report">
          <h3>Investigation report</h3>
          <p>{state.report.conclusion}</p>
          <p>
            Citations:{" "}
            {state.report.citations.join(", ") ||
              "No numerical evidence collected."}
          </p>
          <p>
            Client-reported agreement is local verification; it does not attest
            execution or establish causality.
          </p>
        </div>
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
