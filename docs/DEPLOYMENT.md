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
