"use client";
import { useEffect, useRef, useState } from "react";
import type { ExecutionResult } from "../lib/execution";
import { Brand } from "./Brand";

const destinations = [
  {
    name: "Investigations",
    target: "workspace",
    icon: "◇",
    description: "Your local investigation studio",
  },
  {
    name: "Dataset & Metric",
    target: "dataset-controls",
    icon: "▦",
    description: "Attach data and approve a calculation",
  },
  {
    name: "Numerical Evidence",
    target: "evidence-panel",
    icon: "≋",
    description: "Compare independent SQL and Python results",
  },
  {
    name: "Saved History",
    target: "local-history",
    icon: "↶",
    description: "Explicitly saved investigations and replay",
  },
];
function navigate(target: string) {
  const element = document.getElementById(target);
  element?.scrollIntoView({ block: "start" });
  if (element) {
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
  }
}
export function WorkspaceHeader({
  result,
  filename,
  busy = false,
}: {
  result?: ExecutionResult | null;
  filename?: string;
  busy?: boolean;
}) {
  const search = useRef<HTMLDialogElement>(null);
  const telemetry = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("workspace");
  const matches = destinations.filter((item) =>
    `${item.name} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function openSearch() {
    setQuery("");
    search.current?.showModal();
    searchInput.current?.focus();
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (search.current?.open) search.current.close();
        else if (!telemetry.current?.open) openSearch();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  function go(target: string) {
    search.current?.close();
    setActive(target);
    navigate(target);
  }
  return (
    <>
      <header className="studio-header">
        <Brand />
        <nav aria-label="Workspace navigation">
          {destinations.map((item) => (
            <a
              key={item.target}
              href={`#${item.target}`}
              aria-current={active === item.target ? "page" : undefined}
              onClick={() => setActive(item.target)}
            >
              {item.name}
            </a>
          ))}
        </nav>
        <div className="studio-header-actions">
          <button
            className="studio-search-trigger"
            aria-label="Search workspace"
            onClick={openSearch}
          >
            <span aria-hidden="true">⌕</span>
            <span className="search-label">Search</span>
            <kbd>⌘ K</kbd>
          </button>
          <span className="studio-local">
            <span aria-hidden="true">●</span> Browser-local compute
          </span>
        </div>
      </header>
      <nav className="studio-rail" aria-label="Studio shortcuts">
        {destinations.map((item) => (
          <a
            key={item.target}
            href={`#${item.target}`}
            title={item.name}
            aria-label={item.name}
            aria-current={active === item.target ? "page" : undefined}
            onClick={() => setActive(item.target)}
          >
            <span aria-hidden="true">{item.icon}</span>
          </a>
        ))}
        <a href="/" aria-label="Platform overview" title="Platform overview">
          <span aria-hidden="true">↗</span>
        </a>
        <span
          className="rail-local"
          title="Local session"
          aria-label="Local session"
        />
      </nav>
      <div className="studio-toolbar">
        <div>
          <span className="studio-toolbar-title">Investigation studio</span>
          <span className="studio-session-tag">
            {busy
              ? "COMPUTING"
              : result
                ? "EVIDENCE AVAILABLE"
                : "NEW LOCAL SESSION"}
          </span>
        </div>
        <button
          onClick={() => telemetry.current?.showModal()}
          aria-label="Investigation telemetry"
        >
          <span aria-hidden="true">☷</span> Telemetry
        </button>
      </div>
      <dialog
        ref={search}
        className="studio-command"
        aria-label="Search workspace"
        onClick={(event) => {
          if (event.target === event.currentTarget) search.current?.close();
        }}
      >
        <div className="command-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchInput}
            aria-label="Find a workspace action"
            placeholder="Where would you like to go?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) {
                event.preventDefault();
                go(matches[0].target);
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                search.current
                  ?.querySelector<HTMLButtonElement>(".command-result")
                  ?.focus();
              }
            }}
          />
          <button
            aria-label="Close search"
            onClick={() => search.current?.close()}
          >
            Esc
          </button>
        </div>
        <div className="command-results">
          {matches.map((item) => (
            <button
              className="command-result"
              key={item.target}
              onClick={() => go(item.target)}
              aria-label={item.name}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span aria-hidden="true">↵</span>
            </button>
          ))}
          {!matches.length && <p>No matching workspace actions.</p>}
        </div>
        <p className="command-hint">
          Tab to navigate · Enter to open · Escape to close
        </p>
      </dialog>
      <dialog
        ref={telemetry}
        className="studio-telemetry"
        aria-label="Investigation telemetry"
        onClick={(event) => {
          if (event.target === event.currentTarget) telemetry.current?.close();
        }}
      >
        <div className="telemetry-heading">
          <div>
            <p>LIVE SESSION</p>
            <h2>Investigation telemetry</h2>
          </div>
          <button
            aria-label="Close telemetry"
            onClick={() => telemetry.current?.close()}
          >
            ×
          </button>
        </div>
        <div className="telemetry-block">
          <span className="telemetry-label">DATA BOUNDARY</span>
          <h3>Browser-local memory</h3>
          <p>{filename || "No dataset attached"}</p>
          <p>Raw rows stay local. Saving requires explicit consent.</p>
        </div>
        <div className="telemetry-block">
          <span className="telemetry-label">NUMERICAL EXECUTION</span>
          <h3>
            {busy
              ? "Local operation in progress"
              : result
                ? "Calculation complete"
                : "Awaiting a local calculation"}
          </h3>
          {result ? (
            <dl>
              <div>
                <dt>Dataset rows</dt>
                <dd>{result.rows.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{Math.round(result.elapsedMs)} ms</dd>
              </div>
              <div>
                <dt>DuckDB</dt>
                <dd>{result.runtime.duckdb}</dd>
              </div>
              <div>
                <dt>Pyodide</dt>
                <dd>{result.runtime.pyodide}</dd>
              </div>
              <div>
                <dt>Pandas</dt>
                <dd>{result.runtime.pandas}</dd>
              </div>
              <div>
                <dt>NumPy</dt>
                <dd>{result.runtime.numpy}</dd>
              </div>
            </dl>
          ) : (
            <p>
              Runtime versions, duration and allocation measurements appear
              after execution.
            </p>
          )}
        </div>
        {result && (
          <div className="telemetry-block">
            <span className="telemetry-label">TRACKED ALLOCATIONS</span>
            <dl>
              <div>
                <dt>DuckDB</dt>
                <dd>{result.memory.duckdbTrackedBytes.toLocaleString()} B</dd>
              </div>
              <div>
                <dt>Pandas dataframe</dt>
                <dd>{result.memory.pandasDataframeBytes.toLocaleString()} B</dd>
              </div>
            </dl>
            <p>
              Tracked allocations exclude runtime overhead and are not peak
              memory measurements.
            </p>
            <span className="telemetry-label">SNAPSHOT IDENTITY</span>
            <p className="hash">{result.datasetHash}</p>
          </div>
        )}
        <div className="telemetry-boundary">
          <span aria-hidden="true">◇</span>
          <p>
            CLIENT_REPORTED evidence reflects local calculation agreement.
            Snapshot hashes identify bytes; they do not attest execution.
          </p>
        </div>
      </dialog>
      <nav className="studio-dock" aria-label="Investigation actions">
        <button
          aria-label="Attach local dataset"
          onClick={() => {
            const input = document.querySelector<HTMLInputElement>(
              '#dataset-controls input[type="file"]',
            );
            input?.scrollIntoView({ block: "center" });
            input?.focus();
          }}
        >
          <span aria-hidden="true">＋</span>
          <span>Attach dataset</span>
        </button>
        <button onClick={() => go("evidence-panel")}>
          <span aria-hidden="true">≋</span>
          <span>Inspect evidence</span>
        </button>
        <button onClick={() => go("local-history")}>
          <span aria-hidden="true">↶</span>
          <span>Saved & replay</span>
        </button>
        <button
          className="dock-search"
          aria-label="Open workspace commands"
          onClick={openSearch}
        >
          <span aria-hidden="true">⌕</span>
        </button>
      </nav>
    </>
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
    <ol
      className="studio-progress"
      aria-label="Local calculation progress"
      aria-busy={busy}
    >
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
