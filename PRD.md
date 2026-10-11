# Hypothron AI — Product Requirements

Status: architecture baseline; no application implemented. Version 0.1, 2026-10-10.

## Product and users

Hypothron AI investigates analytical questions by proposing hypotheses, testing them against data, independently recomputing key metrics, and preserving a replayable evidence trail. Intended users are analysts, developers and technically curious business users with small tabular datasets. The initial public deployment is a bounded portfolio/demo product, not an enterprise warehouse or unattended decision system.

The signature demonstration is: load data → confirm metric → investigate competing hypotheses → inspect calculations → expose a contradiction → inspect verification → read an evidence-backed report → save locally → replay with no inference → optionally compare a new AI run.

## Scope and release slices

| Capability | Public MVP | Later / advanced local |
|---|---|---|
| Input | Local CSV and Parquet; up to three datasets | Database connectors, larger data, governed server snapshots |
| Analysis | Allowlisted SQL/Pandas/NumPy operations | Isolated arbitrary analytical code after a separate security review |
| Investigation | Conditional LangGraph agents, hypothesis DAG, bounded follow-ups | Counterfactuals, sensitivity analysis, proactive investigations |
| Verification | Independent local engine recomputation with provenance label | Trusted recomputation over explicitly supplied local/server data |
| Storage | Browser memory; explicit local Save; backend metadata/checkpoints | Opt-in account sync and object storage, separately designed |
| Replay | Deterministic local replay and bundle export/import | Broader runtime migration support |
| Providers | OpenRouter and Gemini BYOK; model capability checks | OpenAI, Anthropic, Groq and justified adapters |
| Identity | Opaque server-issued demo session with resource ownership | Accounts, workspaces and sharing |

No autonomous causal proof, unlimited datasets, arbitrary network tools, warehouse connectors, real-time feeds, team sharing or enterprise compliance in MVP. These are deferred, not silently removed from the long-term vision.

## Functional requirements and acceptance criteria

| ID | Requirement | Testable acceptance |
|---|---|---|
| F01 | Private ingestion | CSV/Parquet is profiled locally; network inspection finds no raw file/row upload and no dataset persistence before Save. Reject malformed, oversized or incompatible input with an actionable error. |
| F02 | Dataset explorer | Preview, schema, null/duplicate warnings, relationships and metric contracts reference an immutable snapshot; cleaning creates a new derived version and leaves the original available in memory. |
| F03 | Metric agreement | Ambiguous net/gross revenue or missing period/year raises a clarification interrupt. Contracts fix grain, join cardinality, null rules, timezone, currency and versions before material claims. |
| F04 | Autonomous hypotheses | Planner produces testable, prioritized hypotheses and an acyclic task DAG. At least one fixture triggers an evidence-driven follow-up; irrelevant agents are skipped. |
| F05 | Genuine agents | Distinct planner, analytical and report roles have separate typed outputs, tool permissions and state responsibilities. Demonstrate conditional routing, interrupts and durable continuation with provider doubles. |
| F06 | Restricted execution | Operations compile through a versioned allowlist; forbidden SQL/Python/network/storage capabilities are rejected. Workers return bounded typed results and can be terminated. |
| F07 | Deterministic verification | A known 18% versus 20% mismatch becomes DISPUTED; independent agreeing recomputations meet contract tolerance. Missing inputs or incompatible semantics become INCONCLUSIVE, never VERIFIED. |
| F08 | Evidence reporting | Every material numerical finding links to calculations, metric contract and snapshot hashes. Display verification status and provenance together. Unsupported causality and fake confidence percentages are absent. |
| F09 | Budgets and recovery | Reject excess model calls/tasks; cancel active jobs; duplicate submissions do not resume twice. Lost workers and API restarts produce explicit pause/recovery states. |
| F10 | Explicit local Save | Save discloses dataset and artifact persistence, commits atomically in Dexie, handles quota failure and supports deletion/export. Unsaved history vanishes when memory is lost. |
| F11 | Deterministic replay | Saved bundle re-executes approved operations without provider calls or a key. Changed dataset/runtime is detected; result differences are reported. Merely showing the old report is labeled playback. |
| F12 | AI re-investigation | Requires fresh BYOK authorization and budgets; creates a linked new run and compares hypotheses, plans, findings, verification, tokens and timing without deterministic claims. |
| F13 | Provider handling | Model selection checks required structured-output/tool capabilities. Invalid key, unsupported model, quota exhaustion, rate limit and ambiguous timeout have distinct errors. No automatic fallback to a paid model. |
| F14 | Understandable UI | Dashboard, explorer, workspace, history and provider settings work on desktop/mobile; charts have accessible tabular equivalents and verification evidence is inspectable. |

## Limits and nonfunctional requirements

Baseline budgets are configurable, enforced by server and browser policy using the lower allowed value. User settings can lower them but cannot exceed deployment caps.

| Limit | Proposed default |
|---|---|
| Source input | 10 MiB per file; 3 files; 30 MiB total |
| Hypotheses | 4 active; 8 total per run |
| LLM requests | 12 attempted outbound requests, including retries |
| Verification corrections | 2 per disputed metric; all within overall task/call limits |
| Run concurrency | 1 active investigation per session; deployment-wide cap initially 2 |
| Execution | 24 jobs including verifier jobs; 30 seconds/job; serial heavy workers initially |
| Duration | 10 minutes active computation/inference; idle browser wait expires after 15 minutes |
| Results | 256 KiB/result; 1,000 preview rows; 20 MiB artifact metadata excluding snapshots |
| Expanded input | Provisional 128 MiB decoded data total; runtime allocation limits require measurement |

A compressed Parquet file can expand far beyond its input size. Browser memory cannot be given a portable hard guarantee: stop on estimated expansion and benchmark actual peaks. Limits are provisional product choices, not provider promises. Choose runtime and device thresholds in Phase 1 measurements.

No paid service is mandatory for local compute, fixtures or automated tests. Live inference can incur user charges; mock providers allow $0 engineering tests. Public hosting and free models are conditional on current terms and quotas. Cold starts are acceptable with visible loading/reconnect behavior; no always-on SLA.

## Evaluation and release criteria

Start with 10 golden questions, grow to 20 for MVP and 50–100 later. Include multi-table joins, metric conflicts, nulls, timezone boundaries, negative/zero revenue, insufficient evidence and injected contradictions. Hold out evaluation questions from prompt tuning. Define measured denominators in docs/EVALUATION.md. Release requires all deterministic/security fixtures passing and zero false VERIFIED results in the finite honest-client critical numerical fixture suite. This is a release criterion, not a population-wide reliability guarantee.

Evaluate against a single-agent baseline using the same model, contracts, data and total budget. Report uncertainty and measured costs; do not claim multi-agent superiority before measurement.

## Resolved brief inconsistencies

The four-dataset/five-hypothesis example exceeds the initial three-dataset/four-active-hypothesis caps. Use orders/customers/refunds and four active hypotheses in the default demo; test products/mix separately or raise caps only after benchmarks. History is opt-in local persistence. Server checkpoints are necessary transient orchestration storage, disclosed separately from Save. Safe execution and artifact contracts precede autonomous agents. See docs/RISKS_AND_RESOLUTIONS.md.
