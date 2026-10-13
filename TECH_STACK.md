# Hypothron AI — Technology Decisions

The table describes the target stack. The deterministic foundation is installed with pnpm-lock.yaml and services/api/uv.lock; runtime-manifest.json pins mirrored assets. Phase2 installs locked LangGraph1.2.14, checkpoint-postgres3.1.2 and its psycopg/native saver dependencies; provider adapters use HTTPX. Dexie and later analytical/UI expansion remain planned. The foundation currently uses React state and explicit CSS instead of introducing unused UI/state packages. Actual tested versions and compatibility limits are in docs/reports/PHASE_1_REPORT.md and its measurement JSON; installed does not mean production validated.

| Technology | Responsibility | Trade-off / selection rule |
|---|---|---|
| Next.js App Router / TypeScript | Responsive UI, routing and typed client contracts | SSR cannot access browser runtimes; worker/storage modules must stay client-side |
| Tailwind / shadcn/ui | Small accessible component foundation | Own copied components; UI tokens/design doc required before new screens |
| TanStack Query | API request/cache lifecycle | Must not silently cache datasets or keys; SSE state updates integrate explicitly |
| Zustand, conditional | Ephemeral workspace/run state when React state becomes awkward | No persistence middleware by default; omit if unnecessary |
| Recharts | Typed aggregate chart rendering | Bound point count; no executable model-generated rendering |
| DuckDB-WASM | Local SQL, joins, aggregations and profiling | WASM asset size/memory, extension restrictions and browser support require tests |
| Pyodide + Pandas + NumPy | Fixed analytical templates and independent computation | Cold load and duplicated memory; restricted package set, not arbitrary CPython compatibility |
| Native DuckDB / Python | Tests and optional isolated local recomputation | Native/WASM results require semantic/tolerance comparison, not presumed identical |
| Web Workers + separate execution origin | Responsive compute and privilege separation | Workers alone do not isolate origin credentials or network |
| IndexedDB / Dexie | Atomic opt-in local artifact/snapshot storage | Quota, eviction, origin binding; no automatic backup |
| FastAPI / Pydantic | Async APIs, validation and typed domain contracts | Async does not make CPU-heavy code safe; numerical compute remains outside API process |
| LangGraph | Stateful conditional multi-agent workflow, checkpoints and interrupts | Recovery/idempotency integration adds complexity; demonstrate benefit against baseline |
| LangChain provider integrations, minimal | Structured-output/tool abstractions where useful | Not another orchestrator; use official provider SDK when an adapter is simpler |
| SQLAlchemy 2 async / Alembic | PostgreSQL repositories and schema evolution | Python owns schema; do not add Prisma as a second migration authority |
| PostgreSQL / psycopg | Metadata, budget/job ledger, sanitized graph checkpoints | Payload/retention limits; no raw-data warehouse or artifact blob storage |
| SHA-256 / versioned manifests | Snapshot integrity and replay identity | Integrity is not authorship, execution attestation or anonymization |
| pytest / Vitest / Playwright | Numerical, protocol, unit and real-browser verification | Live LLM tests optional; fixture/double suites run without paid inference |
| Structured logs / OpenTelemetry | Redacted latency, state-transition and budget visibility | No payload tracing by default; external collector/Langfuse optional later |
| GitHub Actions | Phase4.5 read-only validation; first hosted main-push run verified | Standard Linux x64 fast gates/arm64 browser; account quotas remain external; see docs/CI_CD.md |

## Providers

Initial adapters: OpenRouter and Google Gemini. A model capability descriptor records provider/model ID, tool calling, structured output, context/output limits, pricing-source timestamp and adapter version. Do not assume every model within a provider supports the same interface. Support a bounded schema-repair path; repaired output never bypasses validation. Select models at run start, record changes as new attempts, and avoid unapproved paid fallbacks. Free model availability and price changes are runtime conditions, not project guarantees.

## Deployment candidates, checked 2026-10-10

- Vercel Hobby is a candidate for a personal noncommercial portfolio demo; its current documented eligibility limits must be met. [Hobby plan](https://vercel.com/docs/plans/hobby).
- Render free web service is a candidate FastAPI host. Its documented idle spin-down after 15 minutes requires cold-start and request-recovery behavior; it is not an always-on worker. [Free services](https://render.com/docs/free).
- Neon is a candidate metadata database. Quotas and plan terms must be rechecked in the actual account before deploying; avoid building around a numerical quota that may change. [Neon pricing](https://neon.com/pricing).

This selection remains provisional until a deployment probe proves Python dependency size, connection limits, checkpoint migration support, SSE/proxy timeouts, asset budgets and execution-origin headers. No cloud resource is provisioned by these documents. Local PostgreSQL and mock providers are the independent fallback.

## Explicit exclusions

No Redis/Celery/Kafka/Kubernetes, dedicated vector database, pgvector, RAG, Neo4j or separate agents-as-services initially. No object storage because raw snapshots stay local. Add only after an ADR identifies a requirement, simpler alternatives and ongoing cost. Native arbitrary execution is optional local tooling, not a required public service.

Implemented request-scoped provider integration uses request-scoped HTTPX against the official OpenRouter/Gemini REST endpoints. This avoids unused SDK abstractions while retaining a typed validated domain response. It has mock-wire/security coverage, not live-model capability validation; the workspace now requires explicit provider/metadata consent and displays request/output-token caps. Live model capability/pricing probes remain unverified.

Phase5 Parquet uses the pinned matching DuckDB1.4.3 WASM extension with a separate SHA256 lock (`packages/contracts/parquet-runtime.json`); no replacement parser dependency or historical runtime-manifest mutation. Exact scalar canonical CSV then feeds existing independent DuckDB/Pyodide arithmetic. Privacy-safe structured Python logs use the standard logger; periodic retention uses asyncio and existing SQLAlchemy transactions, without paid telemetry.
