# Free-First Deployment Plan

No infrastructure has been provisioned. Public providers are provisional candidates, verified at a documentation level on 2026-10-10; recheck terms, quotas and actual account eligibility immediately before deployment.

## Candidate topology

Personal noncommercial Next.js frontend on Vercel Hobby; credential-free execution host as a separate static origin/deployment; FastAPI on a Render free web service; metadata/checkpoints in Neon PostgreSQL. All browser analytics execute on client resources. BYOK users fund any chargeable inference. No object storage, queue, persistent worker fleet or paid sandbox is required for MVP.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) restricts eligibility to personal noncommercial usage. [Render free services](https://render.com/docs/free) document idle spin-down after 15 minutes, so we require cold-start handling and durable request boundaries. [Neon plans](https://neon.com/pricing) remain a candidate subject to current compute/storage/connection quotas. These are external constraints, not an availability commitment.

## Predeployment probe

Record actual package/artifact size and runtime asset bandwidth; verify WASM MIME types, CSP on documents and worker scripts, separate-origin worker handshake, optional COOP/COEP implications, TLS and origin allowlists. Probe API build/startup memory, database pool limits/migrations, request/provider/SSE timeouts, proxy buffering and cold-start behavior. Confirm browser cookies or authenticated fetch streaming work across the actual hostnames. Test metadata expiry after a sleeping host resumes, and document logs/backups/deletion limitations.

Use a single small API replica with bounded global slots initially. Horizontal scaling later still uses PostgreSQL fencing and ownership; no in-memory concurrency assumption. Short request-triggered graph segments and checkpoints tolerate interrupted requests; user reconnect/advance restarts work. No guarantee of continued background investigation after the client leaves. Heartbeats are for observation, not free-tier keepalive circumvention.

## Cost and failure controls

Set global/session rate and concurrency ceilings; cap result/checkpoint sizes and retention; do not fund inference through a shared production key. Unknown model price prevents claims of a hard spend cap. Detect exhausted hosting quotas and show a clear unavailable/resume-later state. No automatic upgrade to a paid tier. If hosting constraints fail, retain local setup and a recorded synthetic demonstration rather than add mandatory paid services without approval.

## Planned local configuration

Backend: DATABASE_URL, allowed app origin, execution origin, provider endpoint allowlist, retention/budget policy and log-redaction settings. Frontend: public API and static asset URLs only. Execution origin: pinned runtime manifests and CSP/worker headers; no cookies/credentials. services/api/.env.example and README now provide actual local foundation commands. Local origins are fixed in the current bridge/CSP and need explicit release configuration/probes; hosted setup is not implemented.

## Release evidence

Publish selected provider plans/date, measured cold-start and SSE behavior, supported browser/device matrix, runtime/package locks, privacy/provider policy links, exact backup retention and fixture/evaluation results. Security controls require live-host verification; localhost success is insufficient.

## CI is a validation prerequisite

[Phase4.5 CI](CI_CD.md) contains no deployment job. Frozen dependency/static/migration/unit/build/real-browser checks run against synthetic fixtures, disposable PostgreSQL and mocked external HTTP. Local Linux evidence and the independently verified hosted CI run are recorded in [the CI report](reports/PHASE_4_5_CI_REPORT.md). Passing CI does not satisfy the actual-origin, cold-start, TLS/CSP/SSE, provider or retention release probes above. Push, publication and deployment require separate authorization; Phase5 local integration is implemented; its new hosted CI and actual-origin release validation remain pending.

## Phase5 local release candidate configuration

The supported executable topology remains Next.js15.5.27 on127.0.0.1:3000, separate credential-free executor on3001, one FastAPI process on8000, and PostgreSQL17. Use `scripts/run-api.sh` after Alembic upgrade0002 with an explicitly scoped DATABASE_URL; no default production connection or auto-provisioning. This launcher disables access logs and proxy headers. `APP_ORIGIN` accepts an exact TLS origin or loopback HTTP origin, but changing it alone does not configure the fixed browser/executor bridge and CSP. Public environment configuration therefore remains BLOCKED, not a tested deployment mode. Next production build uses `next start`; the executor needs actual document and worker headers from `apps/executor/server.mjs`, WASM MIME types and separate credentials policy. Serving all assets from the app origin fails the trust design.

Run `node scripts/release-probe.mjs` against all three locally started services. It checks API readiness/migration0002, no-store/nosniff/no-referrer headers, exact default/connect/script worker directives and frame ancestors. It performs GET only and does not deploy or invoke a provider. The source/runtime locks include historical `runtime-manifest.json` unchanged and a separate SHA256 Parquet-extension lock. Keep both validated; bootstrap/build refuse mismatch. CSV-only historical artifacts retain their original compiler/runtime identity.

Retention sweep runs once per minute while API lifespan is running, removing at most100expired runs plus100orphan checkpoint threads per transaction, before expired session parents. Failure rolls back and records only DATABASE/INTERNAL. Shutdown cooperates and bounds waiting. Restart resumes sweeps; retained backups and a sleeping free service are not proven deletion guarantees. With many expired records, multiple sweeps are required. API admission is process-local20session creations peractualpeer/minute and1024peer records; proxy peers share quota. Do not enable multiple replicas, trust arbitrary forwarded headers or call this complete public abuse control.

Before external release obtain separate authorization, configure exact real app/execution/API origins together, validate HTTPS, credential-free worker origins and forbidden native egress, SSE no-buffering/timeouts/disconnect/reconnect, provider cold starts and genuine billing uncertainty, database TLS/pool/migrations/backup deletion and rollback. Record free-plan eligibility at that time. Rollback restores tested application/runtime locks; no schema downgrade may delete retained metadata without a separately reviewed backup/retention decision. This phase makes no production deployment, paid resource, hostedPhase5CI or live-provider claim.


## Account/provider extension deployment configuration

The 2026-10-15 extension supersedes the earlier fixed-origin/configuration absence: exact origins, account routes, explicit durable history, disabled-by-default cloud bundles and container/backup tooling now exist. Use [the current SaaS deployment runbook](SAAS_DEPLOYMENT.md) and [actual local acceptance report](reports/SAAS_IMPLEMENTATION_REPORT.md). The active schema head is0006_cloud_intents. Earlier Phase5probe evidence remains historical; actual-host TLS/OAuth/storage/provider/backup gates are still unpassed.
