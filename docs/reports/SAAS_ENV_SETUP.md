# SaaS environment preparation — 2026-10-14

## Scope and acceptance criteria

Prepare a private root `.env` and matching tracked `.env.example` for the user's next SaaS implementation. Preserve existing source, UI edits and the unrelated untracked `services/api/.env.example`. Do not start implementation, create resources, make provider calls, deploy or push. Acceptance: blank secret fields, ignored private file, matching template key sets and clear current-versus-planned configuration status.

## Plan

Inspect phase status and existing environment consumers; create the template and private copy; check syntax, permissions, ignore rules and documentation links; commit only the template and this setup report locally on existing main.

## Configuration audit

The existing FastAPI factory uses `DATABASE_URL` and `APP_ORIGIN`; Alembic uses the same database URI. The web client uses `NEXT_PUBLIC_API_ORIGIN`. The database URL is a PostgreSQL connection string, not a database API key. The current API launcher and migrations do not load a root dotenv file, and Next.js runs from `apps/web`; root `.env` is a preparation file until explicit environment loading is implemented.

Existing code already includes genuine OpenRouter/Gemini HTTP adapters, conditional LangGraph, PostgreSQL job/event/checkpoint persistence, API/SSE integration and browser deterministic computation/replay. Current identity is an expiring anonymous bearer session, not signup/login or an account. Saved raw snapshots/history are in opt-in browser IndexedDB; server records expire. Accounts, Google OAuth, durable account history, cloud dataset storage and public deployment need implementation. This was a focused configuration audit, not a full production/security audit or fresh application integration test.

## Fill in locally

Open [the root private environment file](../../.env). Fill `DATABASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The template includes a local command to generate the session secret. Google OAuth's proposed local callback is `http://127.0.0.1:8000/v1/auth/google/callback`; it is not an existing route. Keep the local origins for this setup.

SMTP fields prepare verification/recovery delivery. S3 fields are optional; leave them empty and keep `CLOUD_STORAGE_ENABLED=false` until secure consent-gated storage is implemented. No infrastructure must be purchased to complete this preparation. Production workload credentials, OAuth origins and TLS will be validated later against the chosen deployment.

All credentials are backend-only. Only the API origin has a `NEXT_PUBLIC_` prefix. Filling provider credentials does not authorize chargeable inference. The requested server credential flow changes the current ephemeral BYOK policy; optional raw cloud storage changes the current no-upload boundary. Both require explicit documented ADRs and tests during implementation. The latest user request authorizes preparing those changes, but this task stops at placeholders.

## Validation and next step

Template/private key sets, blank secret values, file mode `0600`, Git exclusion, local documentation links and whitespace checks were verified. No application behavior changed, so application tests were not rerun. Only the template and this report belong to the setup commit; the private file is excluded.

After the user fills values and requests continuation, audit the full implementation and write the scoped SaaS spec/plan before application changes. Preserve the UI; validate real database/auth/graph/browser workflows. Live OpenRouter validation remains dependent on explicit cost authorization even after credentials exist. Deployment, push and paid provisioning remain unauthorized. No production-readiness claim follows from this setup.
