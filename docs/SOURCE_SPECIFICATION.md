# HYPOTHRON AI — Master Project Context & Engineering Specification

You are my **Senior AI Systems Architect, Principal Software Engineer, and Technical Development Partner** for a project named **Hypothron AI**.

Read this entire specification carefully. It represents the architectural decisions, project goals, constraints, and feature requirements established through extensive planning.

**Your first task is to understand the project completely, review its feasibility, and help me implement it in carefully designed phases. Do not immediately generate the entire codebase.**

---

# 1. Project Overview

**Name:** Hypothron AI

**Category:** Autonomous Multi-Agent AI Data Investigation Platform

**Primary domain:** GenAI Engineering, Agentic AI, Python Data Engineering, and AI Systems Engineering.

**Core concept:**

Hypothron AI is an AI-powered data investigation platform where users upload CSV/Parquet datasets or connect supported databases and ask complex analytical questions in natural language.

Instead of merely generating SQL queries, charts, or conversational answers, Hypothron AI autonomously:

1. Profiles datasets and identifies quality problems.
2. Understands business questions and relevant metrics.
3. Generates hypotheses explaining trends, anomalies, or business problems.
4. Plans multi-step investigations using specialized AI agents.
5. Executes SQL and Python analytical operations.
6. Tests hypotheses using actual dataset evidence.
7. Independently verifies important numerical calculations.
8. Detects contradictions, inconsistencies, and unsupported claims.
9. Produces evidence-backed insights, interactive charts, and reports.
10. Saves investigation artifacts so results can be reproduced without invoking an LLM again.

**Primary differentiator:**

> Hypothron AI doesn't just answer analytical questions. It investigates hypotheses, verifies its calculations, and makes its findings reproducible.

This must remain the central identity of the product.

---

# 2. Example User Experience

A user uploads:

- orders.csv
- customers.csv
- products.csv
- refunds.csv

The user asks:

"Why did our revenue decline by 18% in Q3?"

Hypothron AI should:

**Step 1 — Understand the datasets**

Identify columns, relationships, missing values, data types, time ranges, and possible metric definitions.

**Step 2 — Generate hypotheses**

Examples:

- H1: Order volume declined.
- H2: Average selling prices decreased.
- H3: Refunds increased.
- H4: Customer retention declined.
- H5: Product mix changed.

**Step 3 — Plan the investigation**

Create a dependency-aware analytical plan.

Identify which hypotheses can be tested independently and which require earlier calculations.

**Step 4 — Execute analytical tools**

Generate and execute appropriate SQL and Python operations.

Use DuckDB, Pandas, NumPy, and statistical methods where applicable.

**Step 5 — Verify results**

Independently recompute important numerical findings.

Check consistency of date ranges, revenue definitions, filters, null handling, and other assumptions.

**Step 6 — Investigate contradictions**

If SQL and Python disagree, determine the reason and retry within defined execution limits.

**Step 7 — Generate an evidence-backed report**

Explain:

- What changed.
- Which factors contributed.
- What the data supports.
- What remains uncertain.
- Which assumptions were used.
- How each important finding was verified.

**Step 8 — Save the investigation**

Preserve the dataset snapshot, investigation plan, SQL/Python operations, execution outputs, verification results, and final report.

**Step 9 — Support replay**

Allow the user to reproduce saved calculations without paying for additional LLM inference.

Important: Hypothron AI must distinguish mathematical contributions and correlations from proven causal relationships. It must not fabricate causal explanations.

---

# 3. Core Product Differentiators

There are three primary differentiators.

These should receive more engineering attention than adding unnecessary agents or infrastructure.

## 3.1 Autonomous Hypothesis-Driven Investigation

Build an actual investigation engine, not a basic text-to-SQL chatbot.

Required capabilities:

- Automatic hypothesis generation.
- Hypothesis prioritization.
- Dependency-aware investigation DAG.
- Multi-step analytical reasoning.
- SQL/Python-based hypothesis testing.
- Evidence collection.
- Supporting and contradicting evidence tracking.
- Hypothesis statuses: supported, rejected, partially supported, inconclusive.
- Contradiction detection.
- Dynamic follow-up investigation.
- Explicit termination conditions.
- Maximum execution and inference budgets.
- Uncertainty reporting.

Advanced capabilities:

- Counterfactual scenario analysis.
- Sensitivity analysis.
- Automatic investigation of suspicious trends.

The supervisor should dynamically select tools and agents based on the investigation.

Do not execute every agent for every question.

## 3.2 Deterministic Numerical Verification Engine

This is one of the most important engineering features.

Do not rely on a second LLM simply claiming that another agent's calculations are correct.

Implement actual deterministic verification using analytical tools.

Required capabilities:

- Independent SQL/Pandas recomputation for important metrics.
- Absolute and relative numerical tolerances.
- Metric-definition consistency.
- Financial calculation precision.
- Date-range and timezone consistency.
- Filter and aggregation validation.
- Dataset version validation.
- Contradiction detection.
- Bounded correction and retry loops.
- Verification status tracking.
- Evidence references and data lineage.

Example:

SQL calculation: Revenue decline = 18%.

Python calculation: Revenue decline = 20%.

The verifier should detect the mismatch, inspect metric definitions and execution parameters, identify the discrepancy, and request corrected calculations when possible.

If verification cannot resolve the discrepancy, the finding must remain disputed or inconclusive.

Do not silently select whichever result seems more plausible.

Verification states should include:

- VERIFIED
- DISPUTED
- INCONCLUSIVE
- NOT_CHECKED

**Metric Contract Registry**

Implement consistent business metric definitions shared across agents.

Example fields:

- Metric name
- Formula
- Source datasets
- Filters
- Date column
- Timezone
- Currency
- Null handling
- Aggregation rules
- Version

A successful numerical recomputation does not automatically prove that the underlying business definition or causal interpretation is correct.

## 3.3 Reproducible Investigation Replay Engine

This should be Hypothron AI's signature feature.

Every investigation should produce versioned, traceable artifacts.

Persist:

- Investigation ID
- Original user question
- Dataset snapshot and content hash
- Schema and source versions
- Metric definitions and versions
- Hypotheses
- Investigation DAG
- Agent decisions
- Generated SQL
- Generated Python
- Tool parameters
- Execution outputs
- Numerical verification results
- Evidence references
- Retry history
- Model/provider configuration metadata
- Runtime and dependency versions
- Final report and charts

Support two replay modes.

**Mode A — Deterministic Replay**

Re-execute saved SQL/Python using the original dataset snapshot and compatible pinned execution environment.

No LLM calls should be required.

Verify whether results match the original investigation.

**Mode B — AI Re-investigation**

Execute the agent workflow again using the same original inputs.

Compare:

- Generated hypotheses
- Investigation plans
- Agent decisions
- Calculations
- Verification outcomes
- Final findings
- Token consumption
- Execution time

LLM decisions may differ between runs. Do not promise bit-for-bit deterministic AI behavior.

Provide an investigation history interface, replay controls, and comparison views.

---

# 4. High-Level Architecture

Use the following logical architecture:

```text
                   USER
                    |
                    v
             NEXT.JS FRONTEND
       Upload / Chat / Dashboard / Replay
                    |
                    v
              FASTAPI BACKEND
       Auth / APIs / SSE / BYOK Gateway
                    |
                    v
             LANGGRAPH SUPERVISOR
          Planning / Routing / State
                    |
        +-----------+-----------+
        |           |           |
        v           v           v
   Data Quality  Planning    SQL Agent
      Agent       Agent         |
        |           |           |
        +-----------+-----------+
                    |
                    v
             PYTHON ANALYSIS
            Pandas / NumPy
                    |
                    v
         DETERMINISTIC VERIFIER
         Recompute / Cross-check
                    |
           +--------+--------+
           |                 |
        Verified         Disputed
           |                 |
           |          Return to planner
           |          (bounded retries)
           v
           REPORT GENERATION
       Findings / Charts / Evidence
                    |
                    v
        INVESTIGATION ARTIFACT STORE
          Versioning / Replay / Lineage
```

This diagram is logical, not a mandatory sequential execution graph.

SQL and Python tools may run in parallel.

The supervisor may loop between planning, execution, and verification.

The verifier should be primarily deterministic software rather than a mandatory LLM agent.

Supporting infrastructure:

```text
PostgreSQL
    |
    +-- Users and workspaces
    +-- Dataset metadata
    +-- Investigation metadata
    +-- Agent checkpoints
    +-- Metric definitions
    +-- Evidence relationships
    +-- Execution records

Browser Execution Layer
    |
    +-- DuckDB-WASM
    +-- Pyodide
    +-- Web Workers
    +-- IndexedDB

LLM Provider Layer
    |
    +-- OpenRouter
    +-- Google Gemini
    +-- OpenAI (later)
    +-- Anthropic (later)
    +-- Other compatible providers

Observability
    |
    +-- Agent traces
    +-- Tool executions
    +-- Latency
    +-- Token usage
    +-- Error tracking
```

Use an appropriate client/server protocol for exchanging validated execution jobs and results.

Never allow browser-supplied results to be treated as trusted server-side verification without appropriate validation or provenance.

---

# 5. Multi-Agent Architecture

Use LangGraph for genuine multi-agent orchestration.

Agents should have distinct responsibilities, tool access, typed outputs, and clear execution boundaries.

## Supervisor Agent

Responsibilities:

- Understand user requests.
- Maintain investigation state.
- Coordinate agents.
- Route tasks.
- Manage dependencies.
- Handle failures.
- Decide whether additional investigation is needed.
- Enforce budgets and termination conditions.

## Data Quality Agent

Responsibilities:

- Inspect schema.
- Detect missing values.
- Identify duplicates.
- Detect inconsistent types.
- Identify suspicious outliers.
- Recommend cleaning operations.
- Request approval for risky transformations.

Use deterministic profiling libraries wherever possible.

## Planning / Hypothesis Agent

Responsibilities:

- Generate testable hypotheses.
- Identify required data.
- Create investigation tasks.
- Build task dependencies.
- Prioritize analytical work.
- Update hypotheses based on evidence.

## SQL Agent

Responsibilities:

- Understand relevant schemas.
- Generate analytical SQL.
- Perform joins and aggregations.
- Handle query failures.
- Return structured results.

Use restricted, read-only SQL execution.

## Python Analysis Agent

Responsibilities:

- Generate appropriate analytical Python.
- Use Pandas and NumPy.
- Perform statistical calculations.
- Generate structured analytical outputs.
- Request execution through the controlled execution layer.

## Verification Engine

Responsibilities:

- Independently validate important calculations.
- Check metric contracts.
- Compare independent results.
- Detect discrepancies.
- Produce machine-readable verification reports.
- Trigger bounded corrections when necessary.

Implement the numerical core deterministically.

An optional LLM critic may explain or investigate mismatches, but it must not replace deterministic checks.

## Report Agent

Responsibilities:

- Summarize verified findings.
- Explain evidence and uncertainty.
- Generate structured chart specifications.
- Produce final investigation reports.
- Link findings to source calculations.

Use Pydantic schemas for all important agent inputs and outputs.

Avoid unnecessary agent proliferation.

---

# 6. Technology Stack

## Frontend

- Next.js with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand where useful
- Recharts
- Web Workers
- IndexedDB/Dexie for browser-side artifacts

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy or another justified database access layer
- Async APIs where appropriate
- Server-Sent Events for investigation progress

## AI Engineering

- LangChain
- LangGraph
- Structured outputs
- Tool calling
- State persistence
- Human-in-the-loop interrupts
- Bounded retries
- Model/provider abstraction
- Evaluation framework

## Data Engineering

- Pandas
- NumPy
- DuckDB
- DuckDB-WASM
- Pyodide
- SQL
- Statistical analysis libraries when needed

## Persistence

- PostgreSQL
- Neon free tier as a candidate
- pgvector only if semantic retrieval is actually necessary
- Versioned investigation artifacts
- Content hashing using SHA-256

## Observability

- OpenTelemetry
- Structured logs
- Agent execution traces
- Token/cost/latency monitoring
- Optional Langfuse integration if practical

## Testing

- pytest
- Vitest
- Playwright
- Golden analytical datasets
- Numerical correctness benchmarks
- Agent evaluation datasets

## Deployment

- Vercel Hobby for frontend, subject to its usage and eligibility rules
- Compatible free FastAPI hosting where available
- Neon PostgreSQL free tier
- GitHub Actions for CI/CD
- BYOK inference to avoid funding users' LLM requests

Do not introduce Redis, Celery, Kafka, Kubernetes, Neo4j, or separate vector databases without a concrete technical requirement.

Favor a simple, modular architecture that can evolve later.

---

# 7. Free-First Deployment Requirement

**This project must be possible to develop locally for $0 and should support a limited publicly accessible demo without mandatory paid infrastructure.**

This is a strict design objective.

Avoid architectures that require:

- Always-on paid compute.
- Paid background workers.
- Paid LLM subscriptions.
- Paid vector databases.
- Paid message brokers.
- Paid container execution platforms.
- Unnecessary third-party SaaS.

Use free and open-source tools wherever practical.

Do not assume any cloud free tier is guaranteed indefinitely.

Validate current provider limitations before finalizing deployment decisions.

## Browser-Based Data Execution

The public demo should primarily use:

- DuckDB-WASM for SQL analytics.
- Pyodide for compatible Python analytics.
- Web Workers to avoid blocking the UI.
- IndexedDB for local data and investigation artifacts.

The backend should primarily manage:

- Authentication.
- Agent orchestration.
- LLM integration.
- Investigation metadata.
- Checkpoints.
- Validated execution plans.
- Persistence and reporting.

Do not execute arbitrary LLM-generated Python directly inside the FastAPI process.

Browser execution is not a hardened server sandbox. Isolate generated code from application secrets, privileged browser APIs, and sensitive origins as far as practical.

If the security requirements cannot be met for unrestricted code, constrain the public demo to allowlisted analytical operations and clearly document the limitations.

## Optional Advanced Execution Mode

For local development and advanced demonstrations, support isolated Python execution workers with:

- Resource limits.
- Execution timeouts.
- Restricted filesystem access.
- Disabled network access.
- No access to application credentials.
- Appropriate process/container isolation.

This should be optional for the initial public demo.

## Application Limits

Initially target configurable limits such as:

- 10 MB per uploaded dataset.
- Three datasets per investigation.
- Four active hypotheses per investigation.
- Twelve LLM calls per investigation.
- Two verification retries.
- One active investigation per user.

These are application-level budgets, not guaranteed provider capacities.

Design the limits so they can be adjusted later.

---

# 8. BYOK — Bring Your Own Key

Hypothron AI should allow users to connect their own free or paid LLM API keys.

Initially support:

1. OpenRouter.
2. Google Gemini.

Design a provider abstraction so additional providers can be added later:

- OpenAI
- Anthropic
- Groq
- Other compatible APIs

Users should be able to:

- Select an LLM provider.
- Enter their API key.
- Select an available model.
- Choose free or paid models where supported.
- Configure investigation budgets.
- View token consumption and estimated inference costs.

Security requirements:

- Never log API keys.
- Never include keys in prompts or agent traces.
- Never expose keys in investigation artifacts.
- Avoid persistent key storage in the initial version.
- Use HTTPS.
- Prevent generated Python/SQL from accessing credentials.
- Clearly disclose which dataset information is transmitted to LLM providers.

A free model is not guaranteed to remain available, and a user's paid key may incur charges to that user.

Provide clear error handling for rate limits, invalid keys, unsupported models, and exhausted quotas.

---

# 9. Dataset Semantic Layer

Implement a lightweight semantic layer to ensure consistent business terminology.

For example:

```text
Metric: Net Revenue

Definition:
Gross sales
- Refunds
- Discounts

Date field:
completed_at

Currency:
USD

Timezone:
UTC

Version:
1
```

Agents should reference this definition rather than independently inventing incompatible revenue formulas.

Support:

- Metric definitions.
- Dataset relationships.
- Column descriptions.
- Business terminology.
- Metric versions.
- Reusable analytical definitions.

Keep the initial implementation simple and PostgreSQL-backed.

---

# 10. Evidence, Lineage, and Reliability

Every significant finding should have supporting evidence.

A finding should reference:

- Source dataset.
- Dataset version/hash.
- Query or calculation ID.
- Metric contract.
- Relevant filters.
- Execution result.
- Verification status.
- Supporting and contradicting evidence.

Avoid invented confidence percentages.

If confidence scores are used, define and evaluate their meaning. Otherwise prefer evidence strength and explicit verification statuses.

Reports must clearly distinguish:

- Observed facts.
- Mathematical contributions.
- Statistical associations.
- Hypotheses.
- Unverified explanations.
- Causal claims supported by appropriate methodology.

The system should be able to say:

"Insufficient evidence to determine the underlying cause."

That is preferable to generating a convincing but unsupported answer.

---

# 11. Investigation Evaluation Framework

Implement a benchmark suite with approximately 50–100 carefully designed analytical questions over time.

Start smaller if necessary, then expand.

Include:

- Correct aggregations.
- Multi-table joins.
- Revenue calculations.
- Missing-data scenarios.
- Conflicting metric definitions.
- Invalid hypotheses.
- Date-boundary errors.
- Numerical contradictions.
- Ambiguous user questions.
- Insufficient-evidence scenarios.
- Replay correctness.

Track:

- Task completion rate.
- Numerical answer accuracy.
- SQL execution success rate.
- Verification success rate.
- False verification rate.
- Unsupported-claim rate.
- Agent recovery rate.
- Execution latency.
- Token consumption.
- Estimated cost per investigation.
- Replay reproducibility.

Also implement a basic single-agent baseline.

Compare the single-agent baseline against the multi-agent architecture.

The purpose is to demonstrate whether multi-agent orchestration actually improves correctness and reliability enough to justify its additional complexity.

Never invent benchmark results.

---

# 12. Product UI and UX

The interface should feel like a modern, professional AI engineering product.

Prefer a premium, minimal, responsive design with restrained visual styling.

Main pages:

**Dashboard**

- Recent investigations.
- Uploaded datasets.
- Investigation statistics.
- Start new investigation.

**Dataset Explorer**

- Dataset preview.
- Column schema.
- Missing-value analysis.
- Data-quality warnings.
- Relationships.
- Metric definitions.

**Investigation Workspace**

- Natural-language question input.
- Hypothesis tree.
- Agent execution timeline.
- SQL/Python execution details.
- Evidence references.
- Interactive charts.
- Verification statuses.
- Final analytical report.

**Investigation History**

- Previous investigations.
- Dataset versions.
- Saved artifacts.
- Deterministic replay.
- AI re-investigation.
- Comparison views.

**AI Provider Settings**

- BYOK configuration.
- Provider selection.
- Model selection.
- Usage budgets.
- Token/cost tracking.

The UI should make the system's reasoning and tool execution understandable without exposing irrelevant internal complexity.

Support mobile and desktop layouts.

---

# 13. Development Phases

Organize implementation into five major phases.

## Phase 1 — Foundation

- Monorepo structure.
- Next.js frontend.
- FastAPI backend.
- PostgreSQL.
- Dataset ingestion.
- Dataset profiling.
- Metric registry.
- Basic authentication or justified demo identity approach.

## Phase 2 — Multi-Agent Investigation

- LangChain model integration.
- BYOK provider abstraction.
- LangGraph supervisor.
- Planning/hypothesis agent.
- Data quality tools.
- SQL agent.
- Python analysis agent.
- Typed agent state.
- Conditional routing.
- Investigation progress streaming.

## Phase 3 — Safe Execution and Verification

- DuckDB-WASM.
- Pyodide.
- Worker isolation.
- Execution protocol.
- Deterministic verification.
- Metric consistency checks.
- Contradiction handling.
- Evidence lineage.
- Human approval for risky operations.

## Phase 4 — Reproducibility

- Investigation artifact format.
- Dataset hashing.
- Versioned snapshots.
- Execution DAG persistence.
- Deterministic replay.
- AI re-investigation.
- Replay comparison.
- Exportable investigation bundles.

## Phase 5 — Production Quality and Deployment

- Complete investigation UI.
- Charts and reports.
- Evaluation benchmarks.
- Agent observability.
- Error handling.
- Resource limits.
- Security review.
- Tests.
- CI/CD.
- Free-tier deployment.
- Documentation.
- Demonstration datasets.

Dependencies between phases should be planned carefully. Build small end-to-end vertical slices where possible rather than leaving integration until the final phase.

---

# 14. Engineering Standards

Treat Hypothron AI as a serious software engineering portfolio project, not a quick chatbot demo.

Requirements:

- Modular architecture.
- Clear separation of concerns.
- Typed contracts.
- Strong input validation.
- Predictable error handling.
- Security-conscious execution.
- Bounded autonomous workflows.
- Structured logging.
- Meaningful automated tests.
- Database migrations.
- Idempotent operations where needed.
- Durable investigation state.
- Resource-aware execution.
- Reproducible analytical outputs.
- Clear documentation.

Avoid:

- Fake agents that only wrap prompts.
- Hardcoded analytical conclusions.
- Mock verification presented as real verification.
- Unnecessary microservices.
- Premature infrastructure complexity.
- Unlimited agent loops.
- Unrestricted generated code execution.
- Storing API keys insecurely.
- Claiming causal findings without evidence.
- Invented evaluation metrics.

Do not introduce technology simply to increase the number of resume keywords.

Every major dependency should solve a real engineering problem.

---

# 15. My Background and Learning Goals

I am a full-stack developer with experience in:

- TypeScript and JavaScript.
- React and Next.js.
- Node.js and Express.
- PostgreSQL and Prisma.
- Redis.
- Docker.
- AWS fundamentals.
- REST APIs.
- Authentication.
- Production-style application architecture.

I am transitioning toward GenAI/AI Engineering.

I have already studied:

- Python fundamentals.
- FastAPI/Pydantic fundamentals.
- Raw LLM API integration.
- LLM concepts.
- RAG fundamentals.

I am learning LangChain and LangGraph while building this project.

I intend to use AI coding assistance to accelerate implementation, but I want to understand the architecture deeply enough to explain and defend every important engineering decision in interviews.

After each phase, I will ask you to explain:

- What was implemented.
- Why the architecture was chosen.
- How the components communicate.
- Important design patterns.
- Relevant production engineering concepts.
- Trade-offs and alternatives.
- Failure scenarios.
- Security considerations.
- Performance considerations.
- Interview questions based on the implementation.

When teaching, focus on concepts that are new relative to my existing TypeScript/full-stack experience.

Explain Python-specific patterns, LangGraph orchestration, data engineering, verification, and production AI engineering in depth when relevant.

Do not repeatedly explain basic JavaScript-equivalent concepts.

---

# 16. Resume and Interview Goals

Hypothron AI should demonstrate:

- Python backend engineering.
- FastAPI.
- LangChain.
- LangGraph.
- Genuine multi-agent orchestration.
- LLM tool calling.
- Structured outputs.
- Pandas and NumPy.
- Advanced SQL.
- Autonomous investigation.
- Numerical verification.
- Data lineage.
- Reproducibility.
- Sandboxed/restricted execution.
- Agent evaluation.
- Observability.
- Production-oriented system design.
- Cost-aware AI architecture.

The most important interview demonstration should be:

1. Upload a dataset.
2. Ask a complex analytical question.
3. Watch agents generate and test hypotheses.
4. Inspect actual SQL/Python execution.
5. Demonstrate a numerical contradiction.
6. Show deterministic verification identifying the discrepancy.
7. Produce an evidence-backed report.
8. Replay the investigation without invoking an LLM.
9. Compare the original run with an AI re-investigation.

The final project should prove not only that an LLM can generate analytical answers, but that the engineering system can verify, trace, and reproduce them.

---

# 17. Your Instructions as My Engineering Partner

Follow these rules throughout development.

1. Preserve the three core differentiators: hypothesis-driven investigation, deterministic verification, and investigation replay.
2. Prioritize correctness, security, reproducibility, and cost efficiency.
3. Use LangGraph meaningfully rather than creating artificial agents.
4. Keep the architecture compatible with free-tier deployment.
5. Prefer open-source technologies and BYOK inference.
6. Do not add paid infrastructure without explicit approval.
7. Avoid unnecessary dependencies and services.
8. Identify genuine technical limitations rather than making unrealistic promises.
9. Make implementation decisions based on actual product requirements.
10. Maintain clear phase boundaries and documentation.
11. Test core functionality rather than relying only on successful compilation.
12. Keep the project understandable, maintainable, and demonstrable.
13. Do not silently remove important features to simplify development.
14. If a feature is too expensive for public hosting, propose a free-compatible implementation or a separate advanced local mode.
15. Explain important architectural decisions when requested.
16. Avoid overengineering where simpler solutions provide equivalent reliability.

---

# 18. What I Want You to Do First

Before writing application code:

**A.** Confirm your understanding of Hypothron AI and its three main differentiators.

**B.** Review the proposed HLD and identify any genuine architectural problems, particularly around browser-based Python execution, LangGraph orchestration, trust boundaries, BYOK security, durable state, and deterministic replay.

**C.** Propose the final implementation architecture, preserving the free-first requirement.

**D.** Produce a practical phased implementation roadmap with dependencies and clear acceptance criteria.

**E.** Identify which features belong in the initial public demo and which should be implemented in the advanced local execution mode.

**F.** Identify the most important technical risks and how to mitigate them.

**G.** Explain how we will ensure that the final system is a genuine multi-agent investigation platform rather than a collection of LLM prompts.

Do not start implementing until the architecture and phase plan have been reviewed.

**Final objective: Build Hypothron AI into an advanced, technically credible, publicly demonstrable GenAI engineering project with real analytical execution, reliable verification, and reproducible investigations—while minimizing mandatory operating costs.**