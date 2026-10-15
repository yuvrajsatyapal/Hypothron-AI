# Hypothron SaaS Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development for scoped tasks and reviews. User approved execution in one go; existing main only. No additional plan approval pause.

**Goal:** Extend existing local verified investigations with safe free-model selection/fallback, accounts, durable account history, optional explicitly consented cloud artifacts and deployable configurations.

**Architecture:** Keep FastAPI authorization/provider/orchestration, PostgreSQL ledgers and LangGraph, Next.js UI, and isolated browser numerical execution. Preserve anonymous local mode; add authenticated account ownership without replacing analytical contracts. Scope commits to owned changes and preserve pre-existing UI edits.

**Tech stack:** Existing Python 3.12/FastAPI/SQLAlchemy/Alembic/LangGraph/PostgreSQL and Next.js/TypeScript. No runtime agents, queues or paid provisioning.

**Spec:** ../specs/2026-10-14-openrouter-free-models-design.md plus the user's 2026-10-14 approved adjustments and full SaaS requirements.

## Global constraints

- No deployment, push or paid inference/resources. Real external catalogue GET is allowed; catalogue is not account access or quality proof.
- Raw data remains browser-local absent per-artifact cloud consent. Never put credentials in checkpoints/logs/export/frontend env.
- Preserve Gemini, numerical verification, zero-inference replay, existing graph budgets and unrelated edits.
- Authentication adds accounts/password/OAuth/logout; ownership rejects cross-account reads and writes. Durable history stores metadata/reports, not automatic raw datasets.
- Production readiness depends on actual-origin security, live OAuth/provider/storage, backups and workflow evidence; report unavailable checks honestly.

## Review focus

Stale model consent cannot change a run. Ambiguous provider billing cannot retry. OAuth cannot link an unverified email or accept replayed state. Expiring anonymous cleanup cannot remove durable account history. Optional cloud upload cannot accept raw bytes without explicit consent or expose another account's object.

### Task 1 — Free models, then durable approved switch

Own providers/catalogue, provider HTTP changes, driver/workflow/ledger/records and migration 0003. Interface: authenticated catalogue GET/POST added by root, `ModelCatalog.list/validate/resolve`; expose resolved concrete identity and configured fallback order. Add model-selection revision/history and attempt attribution; pause definitive model/rate failures with durable explicit approval, preserve consumed ordinals and checkpoints.

- [ ] Write and observe failing tests for pricing/capabilities/cache/selection and pause/approval/recovery/ownership.
- [ ] Verify official pricing/routing contracts, implement bounded discovery and free request enforcement.
- [ ] Implement fenced model-switch history and graph pause/resume; do not retry ambiguous reservations.
- [ ] Run real PostgreSQL tests, provider/workflow regressions, lint/types; review and commit task-owned changes.

### Task 2 — Account authentication

Own accounts/auth modules, migration 0004 and authentication tests. Root owns API mounting. Interface: `mount_auth(app, sessions, origin)` returns authenticator accepting account bearer sessions and existing demo bearer sessions; account token owner maps to a stable sessions parent linked to account, so existing ledger ownership remains coherent. Existing anonymous behavior remains available. Prefer opaque hashed tokens, hardened password hashing, bounded login/signup, explicit logout/revocation; Google code exchange/state/nonce/PKCE and verified claims, no implicit account linking. Use only existing dependencies where safely possible; add locked dependencies when necessary.

- [ ] Write failing real-DB auth/ownership tests, implement routes and migration, test revocation/expiry/error redaction.
- [ ] Add Google OAuth with fixed endpoints, CSRF/replay binding and verified identity; real Google login only when an interactive user completes it.
- [ ] Integrate frontend login/register/logout without redesign; test auth-to-investigation with real API/DB.

### Task 3 — Account persistence and consent cloud artifacts

Extend account-linked metadata lifetimes/history/report retrieval, explicit server Save/Delete and optional private S3-compatible storage. Own new persistence/cloud modules and migration 0005; root owns UI and API mounting. No raw rows in metadata records. Validate bounded metadata manifests; preserve account ownership. Optional cloud uploads use explicit consent, bounded bytes, server-derived object paths, encryption/TLS/private bucket and short-lived signed access or backend streaming with ownership checks. Do not activate storage without credentials/configuration.

- [ ] Observe failing DB tests for durable Save/history/logout/login/cross-owner/delete/expiry.
- [ ] Implement history/report persistence and optional artifact upload/download/delete with explicit consent.
- [ ] Run real DB and local storage emulator workflow where available; report actual external cloud evidence separately.

### Task 4 — Deployment and operations

Own Dockerfiles/production compose/deployment scripts/config, backup/restore, CI additions and operations docs. No actual deployment. Keep executor credential-free with its required security headers and distinct production hostname; enforce exact API/web/executor origin configuration. Use least privilege containers, healthchecks, non-secret env examples, migration command, bounded DB pooling and safe redacted logs. Configure encrypted/private backup destination or local restrictive backup output and documented restore drill. CI validates, never deploys automatically.

- [ ] Add config/security tests, image/build/shell validation and controlled local backup/restore drill against disposable DB.
- [ ] Document concrete deployment/run/migration/TLS/OAuth/storage/secrets/rollback instructions and limitations.

### Task 5 — Integration and release evidence

Root owns `api.py`, frontend integration, generated API schema, spec/ADR/report and final review. Mount independent modules sequentially; handle schema head across migrations without losing existing negative drift tests. Run tests against disposable local PostgreSQL, never a user's hosted database. Do not print root .env values.

- [ ] Run backend suite/lint/types/migrations, web units/types/build, focused real browser workflows and existing numerical/privacy regressions.
- [ ] Check real public catalogue without inference. Do not substitute mocked providers/OAuth for live external claims.
- [ ] Review all changes, fix material findings, record exact completed functionality/limits/blockers in docs/reports/SAAS_IMPLEMENTATION_REPORT.md and update live status.
- [ ] Commit tested task-owned files on main. No secrets, unrelated UI changes, pushes or deployment.
