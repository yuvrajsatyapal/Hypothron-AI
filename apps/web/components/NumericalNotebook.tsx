"use client";
import { useState } from "react";
import type { ExecutionResult, MetricPlan } from "../lib/execution";
import { comparisonBars, exactMoney } from "./EvidenceReport";

export function NumericalNotebook({
  result,
  plan,
}: {
  result: ExecutionResult;
  plan: MetricPlan;
}) {
  const [engine, setEngine] = useState<"sql" | "python">("sql");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const bars = comparisonBars(result.sql.minorUnits, result.python.minorUnits);
  const source = engine === "sql" ? result.sqlSource : result.pythonSource;
  return (
    <div className="numerical-notebook">
      <div className="notebook-metrics">
        {(["sql", "python"] as const).map((name) => (
          <div key={name} className={`notebook-metric notebook-${name}`}>
            <span>{name === "sql" ? "DUCKDB · SQL" : "PYODIDE · PYTHON"}</span>
            <strong>
              {exactMoney(result[name].minorUnits, plan.currency)}
            </strong>
            <small>{result[name].count} included non-null metric rows</small>
          </div>
        ))}
      </div>
      <div className="notebook-chart">
        <div>
          <strong>Independent engine comparison</strong>
          <span>{plan.currency} · exact values above</span>
        </div>
        <svg
          viewBox="0 0 400 104"
          role="img"
          aria-label="Magnitude comparison of actual DuckDB and Pyodide results; exact values in the engine cards above"
        >
          <path d="M200 8v80M40 88h320" stroke="#dce3ee" />
          <text x="4" y="28">
            SQL
          </text>
          <text x="4" y="65">
            Python
          </text>
          {bars.map((bar, i) =>
            bar ? (
              <rect
                key={i}
                x={bar.x + 40}
                y={i * 36 + 12}
                width={bar.width}
                height="22"
                rx="3"
                fill={i === 0 ? "#087f8c" : "#7565d9"}
              />
            ) : null,
          )}
          <text x="194" y="102">
            0
          </text>
        </svg>
      </div>
      <div className="notebook-code">
        <div className="notebook-code-header">
          <div role="group" aria-label="Compiled calculation language">
            <button
              aria-pressed={engine === "sql"}
              onClick={() => {
                setEngine("sql");
                setCopied(false);
                setCopyError(false);
              }}
            >
              SQL
            </button>
            <button
              aria-pressed={engine === "python"}
              onClick={() => {
                setEngine("python");
                setCopied(false);
                setCopyError(false);
              }}
            >
              Python
            </button>
          </div>
          <span>READ-ONLY · APPROVED PLAN</span>
          <button
            aria-label="Copy compiled calculation"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(source);
                setCopied(true);
                setCopyError(false);
              } catch {
                setCopyError(true);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <pre>
          <code>{source}</code>
        </pre>
        <p className="notebook-code-caption" role="status">
          {copyError
            ? "Clipboard unavailable. Select the code to copy it."
            : copied
              ? "Compiled calculation copied."
              : "Trusted compiler output. Change the approved metric to generate a new calculation."}
        </p>
      </div>
    </div>
  );
}
