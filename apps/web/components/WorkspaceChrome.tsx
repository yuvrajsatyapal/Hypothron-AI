import { Brand } from "./Brand";
export function WorkspaceHeader() {
  return (
    <header className="studio-header">
      <Brand />
      <nav aria-label="Workspace navigation">
        <a href="#workspace" aria-current="page">
          Investigations
        </a>
        <a href="#dataset-controls">Dataset & Metric</a>
        <a href="#evidence-panel">Numerical Evidence</a>
        <a href="#local-history">Saved History</a>
      </nav>
      <span className="studio-local">
        <span aria-hidden="true">●</span> Browser-local compute
      </span>
    </header>
  );
}
export function WorkspaceProgress({
  hasInput,
  hasResult,
  busy,
  historical,
}: {
  hasInput: boolean;
  hasResult: boolean;
  busy: boolean;
  historical: boolean;
}) {
  const current = hasResult && !busy && !historical;
  const items = [
    [
      "Ingestion & Profiling",
      hasInput ? "Input in local memory" : "Choose a dataset",
    ],
    [
      "Metric Approval",
      historical
        ? "Saved contract"
        : current
          ? "Executed contract retained"
          : "Review semantics",
    ],
    [
      "Local Calculations",
      busy
        ? "Local operation in progress"
        : historical
          ? "Historical playback"
          : current
            ? "Completed"
            : "Awaiting execution",
    ],
    [
      "Engine Comparison",
      historical
        ? "Historical reported evidence"
        : current
          ? "Evidence available"
          : "Not checked",
    ],
    [
      "Evidence & Replay",
      historical
        ? "Saved evidence below"
        : current
          ? "Inspect results below"
          : "No current evidence",
    ],
  ];
  return (
    <ol className="studio-progress" aria-label="Local calculation progress">
      {items.map(([title, description], i) => {
        const complete = (i === 0 && hasInput) || (i > 0 && current);
        return (
          <li
            key={title}
            className={i === 2 && busy ? "active" : complete ? "complete" : ""}
          >
            <span aria-hidden="true">{complete ? "✓" : `0${i + 1}`}</span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
