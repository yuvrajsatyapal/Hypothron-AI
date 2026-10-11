# Hypothron AI

An autonomous multi-agent AI data investigation platform built around **hypothesis-driven investigation, deterministic numerical verification and reproducible replay**.

Users load local CSV/Parquet data, ask analytical questions, inspect competing hypotheses and evidence, and replay saved calculations without another LLM request. Next.js provides the interface; FastAPI and LangGraph coordinate reasoning; DuckDB-WASM and Pyodide/Pandas/NumPy compute locally. PostgreSQL stores scoped metadata and checkpoints, not raw datasets by default. OpenRouter and Gemini support free or paid BYOK inference.

## Repository status

Implementation is underway. See [CURRENT_PHASE.md](CURRENT_PHASE.md) and [TASKS.md](TASKS.md) for tested behavior and remaining gates. External deployment is not authorized. “Planned” features and acceptance criteria are not claims of working functionality.

## Reading guide

| Document | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Future Codex instructions and engineering gates |
| [PRD.md](PRD.md) | Scope, constraints and testable requirements |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, flows, state and trust boundaries |
| [SECURITY.md](SECURITY.md) | BYOK, isolation, XSS, privacy and retention |
| [TECH_STACK.md](TECH_STACK.md) | Technology choices and deployment candidates |
| [ROADMAP.md](ROADMAP.md) | Dependency-ordered implementation slices |
| [DECISIONS.md](DECISIONS.md) | Initial architectural decision records |
| [docs/INDEX.md](docs/INDEX.md) | Contracts, risks, evaluations, system-design preparation and diagrams |

## Run the local Phase 1–2 application

The workspace supports local CSV revenue computation/replay and consent-gated Gemini/OpenRouter investigations using genuine conditional LangGraph and PostgreSQL recovery. Up to three approved dataset descriptors, clarification, evidence-driven follow-up and cited reports are implemented. Expanded metric/report semantics, saved history/bundles, Parquet and deployment remain later phases. Read the [Phase2 report](docs/reports/PHASE_2_REPORT.md) and [deep dive](docs/learning/PHASE_2_DEEP_DIVE.md).

Tested tooling: Node 22.22.3, pnpm 10.33.0, Python 3.12.15 via uv, Docker PostgreSQL 17 and installed Chrome 154.0.8037.99 on macOS arm64. Exact web/Python dependencies are locked; mirrored runtime hashes are in packages/contracts/runtime-manifest.json. ADR-015 limits initial validated support to local Chrome 154/macOS arm64 with 8 GiB RAM; mobile/other targets are deferred. Accepted CSV ceilings are 100,000 data rows, 10 MiB source and conservative 128 MiB expansion; these are not hard heap guarantees.

From the repository root:

```sh
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12
node scripts/bootstrap-assets.mjs
pnpm executor:build
docker compose up -d --wait
```

Initial runtime asset bootstrap downloads pinned public packages; generated assets are ignored. Their verified hashes must match the manifest. They are served locally during execution, with no runtime CDN request. No paid service or API key is needed.

Start the real API in a separate terminal:

```sh
cd services/api
export DATABASE_URL='postgresql+psycopg://hypothron:local-development-only@127.0.0.1:55432/hypothron'
export APP_ORIGIN='http://127.0.0.1:3000'
.venv/bin/alembic upgrade head
.venv/bin/uvicorn hypothron.api:app_factory --factory --host 127.0.0.1 --port 8000
```

Start the credential-free executor and frontend in two more root terminals:

```sh
pnpm executor
# Another terminal:
pnpm web
```

Open http://127.0.0.1:3000 and choose tests/fixtures/orders.csv. Use the default columns/period; each engine should calculate 3033 cents across three included rows. API health/readiness is on port 8000; PostgreSQL is bound to localhost:55432. Current bridge/CSP origins are deliberately fixed for localhost and need explicit tested release configuration before deployment. Development/production Next.js outputs use separate directories.

Required API environment: DATABASE_URL; optional APP_ORIGIN defaults to http://127.0.0.1:3000. Optional NEXT_PUBLIC_API_ORIGIN defaults to http://127.0.0.1:8000 (set before frontend build when changing it). Local bridge/executor origins remain fixed and must be retested before changing deployment configuration. No provider key belongs in environment files.

After Execute locally, open the investigation panel. Select Gemini or OpenRouter, enter a model available to your account and its BYOK key, and approve the visible metadata/provider disclosure. Extra CSVs use the displayed approved metric and are profiled locally. A clarification needs a fresh key and answer. Resume identifies the original provider/model/question even if controls are edited. Keys clear on pause/completion/cancel; tokens and unsaved snapshots disappear on reload. Free availability/charges depend on the selected provider. No live model compatibility or pricing guarantee is asserted.

Validation:

```sh
pnpm test
pnpm typecheck
pnpm format:check
pnpm e2e # test-only mock-provider API; stop the real API on port8000 first
pnpm build
# API terminal with DATABASE_URL exported, from services/api:
.venv/bin/pytest -q
.venv/bin/ruff check .
.venv/bin/mypy src
# Root: desktop measurement; macOS installed Chrome default:
node scripts/measure-browser.mjs
```

Playwright automatically starts services/api/tests/browser_server.py on port8000 and checks its mock-provider marker before sending a test key. Only external LLM HTTP is mocked; graph/DB/browser engines are real. Docker PostgreSQL and mirrored runtime assets are required. Tests never fall back to live provider HTTP. Production must use hypothron.api:app_factory, never the test server.

Browser tests default to the installed macOS Chrome; set HYPOTHRON_CHROME to an executable path on another machine. This is not a claim that other targets pass. No real LLM smoke tests have run. Keep sessions and unsaved datasets ephemeral; closing/reloading loses the current investigation snapshot. Docker persists only development metadata in its named volume.

## Honest guarantees

- Data files stay in browser memory unless the user explicitly saves locally. Approved schema/aggregates and questions can leave the browser for reasoning; inspect the disclosure first.
- Local SQL/Pandas agreement detects numerical discrepancies, but does not attest an honest browser or prove business definitions/causality.
- Deterministic replay re-executes compatible approved calculations. AI re-investigation can differ and may incur charges.
- Free hosting is a design objective with quotas/cold starts, not a permanent availability guarantee.

The current user instruction is to finish Phase2 and stop before Phase3. CURRENT_PHASE.md records final gates. No public deployment has occurred.
