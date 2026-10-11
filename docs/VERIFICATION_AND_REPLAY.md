# Numerical Verification and Reproducible Replay

## Two axes of verification

| State | Meaning |
|---|---|
| VERIFIED | Required independent calculations agree under the same validated contract and tolerance; scope/provenance must accompany the label |
| DISPUTED | Comparable results or required invariants conflict; preserve both results |
| INCONCLUSIVE | Missing data/checks, incompatible semantics/runtime, unresolved ambiguity or unsupported verification prevents a conclusion |
| NOT_CHECKED | No verification was attempted or required by policy; never display as verified |

| Provenance | Available guarantee |
|---|---|
| CLIENT_REPORTED | Browser reports independent local runs; API validates protocol and compares reported outputs, cannot attest source/execution honesty |
| RECOMPUTED_LOCAL | Optional controlled isolated local executor reran exact supplied snapshot; guarantee is within that local operator/environment |
| RECOMPUTED_SERVER | Reserved for future controlled server recomputation with explicit snapshot consent; unavailable in initial public mode |

Execution validity, numerical agreement, semantic approval and causal evidence are distinct. Do not collapse them into one green badge. Dataset hash equality binds claimed bytes; it does not prove that a client actually used them, that bytes are factually correct or that the correct business metric was chosen. A signed server job proves issuance, not completion. A malicious client can forge both SQL and Pandas results. Public browser mode therefore cannot provide adversarial server-side numerical attestation.

## Independent computation contract

1. Freeze exact source bytes, parser settings, dataset versions and metric semantics. Validate join keys/grain before summation to detect double counting.
2. Compile the analyst plan from approved IR. Independently generate verifier SQL/Pandas from the metric contract using a separate implementation, not the analyst output or generated source.
3. Recompute from original source snapshot, not a possibly wrong intermediate analyst table. Record counts, nulls, period bounds, grain and component totals alongside the main metric.
4. Compare contract/hash/settings first. Semantically incomparable results are INCONCLUSIVE; matching numbers under different filters are not VERIFIED.
5. Compare exact and approximate values using the versioned policy; apply invariants such as component reconciliation, valid denominators and join cardinality.
6. On mismatch, preserve evidence, mark DISPUTED, classify deterministic known causes and permit at most two bounded corrections per metric. Planner may request a revised contract with user approval; it cannot relabel disagreement as success.
7. Terminal disagreement remains disputed; unavailable independent path remains inconclusive. Reports cite both and do not choose the more convenient figure.

Independent engines reduce accidental implementation errors; they share contracts, inputs and browser trust, so independence is computational rather than adversarial. Golden expected results, independent hand calculations and metamorphic tests detect common specification/compiler bugs that two engines can share.

## Numerical policy

- Counts and integer monetary minor units compare exactly. Monetary inputs with other scales use exact decimal strings/DECIMAL and compatible Python Decimal or scaled-integer operations, never binary-float money sums. Currency/scale/rounding is contractual; unsupported exact representation fails explicitly.
- Approximate finite values pass when abs(a-b) <= atol + rtol * max(abs(a), abs(b)). Tolerances are per metric, units-aware and recorded before execution; do not enlarge them after seeing disagreement. Proposed float defaults (atol=1e-9, rtol=1e-7) are provisional until fixture calibration, and are not financial tolerances.
- Percent changes use (current-baseline)/baseline with a declared baseline. Zero baseline is undefined unless the contract states another representation. Distinguish a percentage change from percentage-point change.
- Explicit half-open periods [start,end), timezone and timestamp parsing rules; dates are not assumed equivalent to UTC instants. Fix fiscal/calendar year semantics and daylight-saving behavior.
- Preserve missing/NaN/Infinity/signed-zero distinctions where meaningful. Empty input is not automatically a zero. Rounding only occurs at contractual stages; display rounding does not alter comparison.
- Grouped result comparison sorts by declared keys, checks multiplicity/null policy and compares typed values, not formatted text/chart pixels. Ties need explicit tie-breaking. Seed supported stochastic statistics and record algorithm/seed; unsupported nondeterministic operations cannot claim deterministic replay.

## Investigation bundle v1 (proposed)

Logical format: validated manifest JSON plus source snapshot blobs and bounded structured artifacts in an export archive. Local Dexie representation need not be identical to the export container, but both use the same manifest. Reject excessive archive expansion, unsafe paths and unrecognized executable payloads.

| Section | Required contents |
|---|---|
| Identity | bundle/schema version, investigation ID, original question, creation time, parent run ID, consent/disclosure manifest |
| Inputs | Original snapshot bytes, SHA-256/length, original file format, parse options/schema hash; derived transformations and parent lineage |
| Semantics | Metric contracts/versions/hashes, relationships, approved assumptions |
| Reasoning | Hypotheses/statuses, DAG revisions, concise agent decision summaries and evidence links; no hidden reasoning transcript requirement |
| Operations | Approved IR, dependency order, compiler version, inspectable SQL/Python templates, tool parameters and all attempt/retry IDs |
| Results | Typed outputs, canonical hashes, errors/warnings, invariant checks and verification reports/provenance |
| Runtime | DuckDB-WASM/Pyodide/Pandas/NumPy/browser/compiler versions, package locks, WASM/asset hashes, locale/timezone/seed and capability requirements |
| Inference | Provider/model/config metadata, prompt/template version, measured tokens/cost source and duration; no credentials |
| Presentation | Final structured findings/report/chart specs and source calculation references |

Hash original file bytes for source identity and separately hash parse options/schema/derived operation identity. Canonical manifest hashing defines key order, Unicode policy, decimal/timestamp encoding and excludes volatile timing fields from numerical comparison. JSON insertion order alone is not a cross-language canonicalization contract. Finalize canonicalization implementation during Phase 1 with test vectors.

A saved replay-capable bundle includes dataset bytes. A metadata-only export is allowed only if labeled “requires exact dataset reattachment.” Never claim complete replay from a hash alone. Exports contain sensitive data and are not automatically encrypted; sharing is a deliberate user action. No backend upload by default.

## Replay algorithms and guarantees

**Playback:** Render prior saved report/results without executing. Label clearly.

**Deterministic replay:** Validate bundle/version/capabilities/hash → obtain exact saved snapshots → load compatible pinned runtimes → regenerate approved operations with matching compiler → execute task DAG locally → independently verify → compare canonical typed results → produce replay report. No LLM or backend analytical call. Runtime asset loading may need network unless assets are available locally. No service-worker data persistence is introduced implicitly for offline convenience.

Comparison statuses: MATCH, MISMATCH, INCOMPATIBLE_RUNTIME, MISSING_INPUT, UNSUPPORTED_OPERATION and EXECUTION_FAILED. Exact results match exactly; floats match under original tolerances. Preserve the original and create a replay record; never overwrite original evidence. If old runtime assets are unavailable, fail honestly or request an explicit version migration and label its comparison as migrated. An archived lockfile does not ensure artifacts remain downloadable.

**AI re-investigation:** New run over the same source/contract with fresh consent, BYOK and budgets. Compare aligned hypotheses (record alignment assumptions), DAGs, executed calculations, findings, verification, measured tokens and timing. Providers may change weights/models even with a recorded ID; seed/temperature do not guarantee identical decisions. This mode cannot validate deterministic replay.

## Golden tests

Reference decimal revenue/refund totals, duplicate joins, null-only groups, DST/period boundaries, zero denominator, altered snapshot byte, poisoned result, incompatible runtime, lost source snapshot and cancellation. Deterministic replay tests assert no provider adapter invocation and no key requirement. A fixture where both client outputs are forged must retain CLIENT_REPORTED provenance. Injecting one wrong output must produce DISPUTED, regardless of persuasive model prose.

## Implemented boundary at the Phase 2 exit

The current numerical path is exact revenue_sum v1 under approved USD/UTC/period/null semantics. Browser values produce VERIFIED, DISPUTED or INCONCLUSIVE with CLIENT_REPORTED provenance; backend ownership/hash/job/digest checks do not attest computation. Evidence citations must reference accepted jobs, but full numerical prose grounding and contradiction correction remain Phase 3. The foundation re-executes an in-memory plan without inference; saved snapshots, export/import and complete runtime-compatible investigation replay remain Phase 4. No Dexie storage is opened before Save, and no Save implementation exists yet. See [the Phase 2 deep dive](learning/PHASE_2_DEEP_DIVE.md).
