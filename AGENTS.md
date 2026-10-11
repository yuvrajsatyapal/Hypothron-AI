# Hypothron AI — Engineering Instructions

## Project identity and current stage

Hypothron AI is an autonomous data investigation platform. Preserve three differentiators: hypothesis-driven investigation, deterministic numerical verification, and reproducible investigation replay. Implementation of Phases 1–5 is authorized continuously as of 2026-10-11. Read CURRENT_PHASE.md for actual status; advance only after required gates pass. Local tested-task commits on existing main are authorized by the 2026-10-12 continuation brief. External deployment, paid resources, publishing, pushing and PRs require separate authorization.

Read CURRENT_PHASE.md, TASKS.md, FILE_MAP.md and CODING_STANDARDS.md first. At phase exit use PHASE_REPORT_TEMPLATE.md, write docs/reports/PHASE_N_REPORT.md and the comprehensive docs/learning/PHASE_N_DEEP_DIVE.md; link both in docs/SYSTEM_DESIGN_GUIDE.md. The deep dive and implementation-accurate diagram-design HTML diagrams linked from ARCHITECTURE.md are mandatory phase gates. PHASE_REPORT_TEMPLATE.md owns their coverage contract. Keep this instruction file concise; those documents own process details.

Read README.md, PRD.md, ARCHITECTURE.md, SECURITY.md, ROADMAP.md and relevant ADRs in DECISIONS.md before changing behavior. Read docs/EXECUTION_PROTOCOL.md and docs/VERIFICATION_AND_REPLAY.md for analytical work. The original brief is docs/SOURCE_SPECIFICATION.md; explicit later user instructions take precedence, followed by accepted ADRs and normative contracts. Resolve contradictions explicitly rather than silently changing requirements. Architecture decisions describe the target; CURRENT_PHASE.md and phase reports distinguish implemented/tested behavior from pending work.

## Working method

- Respond in the user's language. Explain new Python, agent orchestration and analytical concepts when useful; avoid repeating basic full-stack material.
- Write a scoped spec and implementation plan before production code. Use available Spartan spec/plan workflows for substantial features, saving their artifacts under .planning/. Small changes still need a written scope and acceptance criteria.
- Follow Red → Green → Refactor for application behavior. Start with a meaningful failing test. Documentation changes need consistency/link checks, not artificial application tests.
- Follow task scope and existing edits. Do not overwrite unrelated work. Never add paid infrastructure without explicit user approval.
- Track risks and decision changes in documentation. Use an ADR when changing trust, persistence, execution, provider or replay boundaries.
- For new screens, create a design document and apply finalized design tokens before implementation. Diagram styling is provisional and does not establish UI branding.
- Report what changed, the validation performed, limitations and the next phase. Never invent benchmark results, confidence scores or security guarantees.
- Save session handoff information before losing context. Keep durable project knowledge in files. Never store user secrets or datasets in handoff notes.

## Architecture invariants

1. Next.js is the UI; FastAPI owns API authorization, provider calls and orchestration. LangGraph executes typed conditional agent workflows; do not duplicate orchestration in Next.js.
2. Raw uploaded CSV/Parquet data stays in browser memory by default. No raw-data upload endpoint in the public MVP. No raw rows in PostgreSQL, logs, checkpoints, telemetry or provider prompts by default.
3. IndexedDB/Dexie investigation storage is opened and written only after explicit Save consent. Do not use OPFS, service-worker data caching or automatic browser snapshot persistence as a workaround.
4. PostgreSQL stores scoped metadata, metric contracts, sanitized graph checkpoints, bounded approved aggregate evidence and protocol records. Treat metadata and aggregates as sensitive.
5. Separate stochastic reasoning from deterministic computation. Agents propose structured operations; trusted compilers generate inspectable read-only SQL and fixed Python templates. Public mode never executes arbitrary model-generated Python or unconstrained SQL.
6. DuckDB-WASM and Pyodide execute approved operations in isolated workers. Workers improve responsiveness but are not sufficient isolation. Follow SECURITY.md and prove the execution-origin policy before release.
7. Verification state and provenance are separate. VERIFIED with CLIENT_REPORTED provenance is local agreement, never trusted server attestation. A hash or signed job does not prove client execution.
8. Deterministic replay uses snapshots, approved plans, runtime locks and a result comparison policy, with zero LLM requests. AI re-investigation is a new billed, nondeterministic run.
9. Keys live only in short-lived browser/backend memory; never in graph state, URLs, persistent stores, prompts, traces or exports. Provider destinations are an allowlist, not a user-controlled proxy URL.
10. Bound all loops, concurrency, payload sizes, runtime and model calls. Budget enforcement is deterministic policy outside LLM discretion.
11. Every material claim references evidence, dataset/metric versions and verification status. Correlation and decomposition do not establish causality.
12. Do not add Redis, Celery, Kafka, Kubernetes, vector stores, pgvector, RAG or extra agents without a demonstrated requirement and ADR.

## Planned module boundaries

- apps/web: Next.js UI, local artifact storage, execution bridge and dedicated workers.
- services/api: FastAPI routes, policies, LangGraph, provider adapters and database repositories.
- packages/contracts: versioned language-neutral schemas and generated TypeScript bindings; Pydantic is the backend contract implementation.
- docs: architecture, contracts, evaluations and decision rationale. tests/fixtures: synthetic/public analytical datasets only.

FILE_MAP.md distinguishes implemented from planned modules. Keep domain logic separate from routes and framework adapters. Use SQLAlchemy 2 async repositories and Alembic migrations; do not import Kotlin/Micronaut/Exposed conventions into this Python project. Use parameterized SQL for application persistence and database constraints for tenant ownership and integrity. Analytics SQL follows a separate restricted compiler.

## Quality gates for future code

Python: pytest, type checking, linting, migration validation, protocol/security negative tests. Web: TypeScript, Vitest and focused Playwright flows, production build, responsive and accessibility checks. Pin runtime versions and lock dependencies together after compatibility spikes. Evaluate numerical correctness with golden datasets and metamorphic properties, not LLM grading alone.

Before a public release, prove cross-tenant rejection, secret redaction, execution egress restrictions, denied operation handling, bounded cancellation, idempotent result submission, checkpoint recovery and zero-inference replay. No claim of production readiness from compilation alone.

## Git and reviews

Work exclusively on the existing main branch; verify branch/status before changes, preserve unrelated edits and create a conventional local commit after each completed tested task. Stage only task-owned source/tests/docs; exclude secrets, real env files, generated runtime assets and database artifacts. Do not switch/create branches or worktrees, amend history, push, publish, deploy or create PRs. Record task hashes in reports. Use dual-agent review when a Spartan quality gate explicitly requires it, with clear ownership; do not introduce runtime agents to satisfy development-review terminology.
