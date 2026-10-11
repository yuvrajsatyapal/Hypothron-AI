# Hypothron Implementation Specification

Authority: user continuous Phases 1–5 request, 2026-10-11; PRD.md, ROADMAP.md and SECURITY.md define required behavior. No deployment/purchase/commit/publish authorization.

Implement the existing roadmap sequentially. Phase 1 owns locked tooling, PostgreSQL identity/readiness/migrations, strict metric/operation contracts, isolated browser engines, memory-only CSV ingestion, independent exact sums, mismatch detection and minimal replay. Its hard gate is actual real-browser isolated runtime evidence, not mocked engines. Phases 2–5 remain as ROADMAP.md, tracked by TASKS.md.

Preserve separate execution origin, credential-free workers, no arbitrary generated source, no raw upload endpoint and no persistent browser dataset before Save. Decimal money and explicit date/null rules; CLIENT_REPORTED provenance. Browser-run zero-LLM replay. Use synthetic fixtures only. All APIs reject unrecognized/oversized inputs with sanitized errors.

Foundation screen: dataset upload + local profile, user-approved metric parameters, execute/replay/cancel controls, independent engine outputs and exact status/provenance. Real failure/loading states, source inspection and no provider dependency yet. Larger capabilities follow passed phase gates.
