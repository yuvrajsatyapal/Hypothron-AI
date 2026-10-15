import React from "react";
import type { InvestigationState } from "../lib/investigation";

export function HypothesisTrace({ state }: { state: InvestigationState }) {
  if (!state.hypotheses?.length) return null;
  return (
    <section
      className="hypothesis-trace"
      aria-label="Investigation hypothesis trace"
    >
      <header>
        <div>
          <span>REASONING → CALCULATION → EVIDENCE</span>
          <h3>Hypothesis exploration</h3>
        </div>
        <span>{state.hypotheses.length} proposed paths</span>
      </header>
      <ol>
        {state.hypotheses.map((hypothesis) => {
          const observations = state.evidence.filter(
            (evidence) => evidence.hypothesisId === hypothesis.id,
          );
          const pending = state.pending?.hypothesisId === hypothesis.id;
          return (
            <li key={hypothesis.id} className={pending ? "trace-pending" : ""}>
              <span className="trace-node">{hypothesis.id.toUpperCase()}</span>
              <div>
                <h4>{hypothesis.statement}</h4>
                <p className="trace-meta">
                  Priority {hypothesis.priority} · dataset{" "}
                  {hypothesis.datasetHash.slice(0, 12)}…
                </p>
                {observations.length ? (
                  observations.map((evidence) => (
                    <div className="trace-evidence" key={evidence.jobId}>
                      <span
                        className={`trace-verification trace-${evidence.verification.toLowerCase()}`}
                      >
                        {evidence.verification}
                      </span>
                      <span>{evidence.provenance}</span>
                      <p>
                        Evidence {evidence.jobId}
                        {evidence.classification
                          ? ` · ${evidence.classification}`
                          : ""}
                      </p>
                      {!!evidence.dependsOn?.length && (
                        <p>Depends on: {evidence.dependsOn.join(", ")}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="trace-verification">
                    {pending ? "CALCULATION REQUESTED" : "AWAITING EVIDENCE"}
                  </span>
                )}
                <details>
                  <summary>Inspect dataset identity</summary>
                  <p className="hash">{hypothesis.datasetHash}</p>
                </details>
              </div>
            </li>
          );
        })}
      </ol>
      <p>
        Proposed hypotheses require numerical evidence. Local agreement does not
        establish causality.
      </p>
    </section>
  );
}
