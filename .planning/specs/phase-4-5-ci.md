# Phase 4.5 CI specification

Explicit 2026-10-12 authorization: implement CI on existing main, local tested commits only; stop before Phase5. Preserve services/api/.env.example and existing services. No push/deploy/PR/live inference. This supersedes the historical Phase4 stop and moves the CI portion of T5.2 into Phase4.5 without starting Phase5.

## Acceptance
- Push main, PR main and manual dispatch; read-only contents, cancellation, immutable actions, pinned tools and PostgreSQL17 image, frozen pnpm/uv installs.
- Static workflow/action/shell validation; frontend units/strict types/format/production build; backend Ruff/mypy/OpenAPI/pytest and real isolated migrated DB.
- Genuine full browser suite including WASM/Pyodide, IndexedDB, replay, actual LangGraph/API/PostgreSQL with test-only mocked HTTP. Explicit Linux target distinct from ADR015 desktop. No emulation substitution for analytical integration.
- Read-only committed runtime manifest verification and tamper refusal; no silent regeneration. Fresh CI-owned ports3000/3001/8000; reject conflicts. Use production Next server and fixture API readiness.
- Active Python outbound network refusal plus audit of caught refusals; automatic browser provider request refusal with failing assertion. No provider/production secrets. No sensitive artifact upload; bounded diagnostics.
- Isolated faithful Linux container validation where feasible, no unrelated service shutdown. Record local versus hosted evidence honestly; hosted execution awaits authorized push.
- CI guide, educational deep dive, phase report, linked validated architecture diagram and accurate current phase/task/file map; Phase1–4 status retained, Phase5 unstarted.

## Non-goals
Deployment, broader runtime/product support, dependency upgrades, live model compatibility, raw-data upload, changing numerical/persistence semantics.
