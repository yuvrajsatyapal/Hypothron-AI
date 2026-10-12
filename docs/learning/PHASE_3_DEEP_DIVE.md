# Phase 3 — Verification and Evidence Expansion: technical deep dive

This guide explains implemented Phase 3 mechanisms from their source. Read [the Phase 2 deep dive](PHASE_2_DEEP_DIVE.md) first for provider reservation, PostgreSQL fencing and checkpoint reconciliation. Phase 3 expands numerical semantics and claim grounding; it does not introduce a new persistence mode, trusted server execution or unrestricted analytics. Final gate measurements and the tested-task commit hashes belong in [the Phase 3 report](../reports/PHASE_3_REPORT.md). Until that report records a completed gate, an implementation description here is not an acceptance claim.

## 1. The problem and the change from Phase 2

Phase 2 proved a bounded investigation could issue an approved revenue job, pause, accept browser-computed evidence and resume safely. It compared integer monetary outputs and counts. That is necessary, but totals alone conceal semantic errors. A duplicate customer in a lookup can multiply orders. An order-level metric can accidentally sum line-item rows. A date at midnight can enter two reporting periods. A value of `10.10` can lose precision if parsed through floating point. Two engines can agree on the wrong population. A report can cite a valid job while saying a number that the job never produced.

Phase 3 adds a second version of the restricted metric contract with explicit grain, fixed-offset timezone and optional approved relationship. Both local engines validate those semantics independently and emit bounded diagnostic counts. The deterministic verifier assigns a classification as well as a status. Conditional LangGraph routing recomputes disputed evidence at most twice using the unchanged contract. Structured report validation binds numerical values to compatible accepted evidence, while unresolved results remain unresolved.

The product still preserves three separate responsibilities: stochastic roles propose bounded reasoning; deterministic code decides arithmetic and compatibility; the user approves the business contract and any lookup relationship. Neither model eloquence nor a hash can stand in for these controls. The raw CSV bytes stay in browser memory. PostgreSQL receives metadata and approved aggregate evidence, and the provider receives minimized context. These boundaries are part of correctness, because silently uploading rows to obtain an easier verification would change the product's trust model.

The implemented analytical surface is deliberately small: `revenue_sum`, versions 1 and 2, USD/EUR/JPY, a half-open period, `exclude` or `error` null policy, and optional one-to-one or many-to-one lookup validation. There is no currency conversion, many-to-many join, arbitrary SQL, arbitrary Python, causal inference or general-purpose statistical engine.

## 2. Read the implementation in this order

| Source | New concept to study | Invariant / exercise |
|---|---|---|
| [models.py](../../services/api/src/hypothron/agents/models.py), `MetricPlan`, `Relationship`, `DiagnosticCounts`, `EvidenceInput` | Strict Pydantic domain models and immutable nested semantics | Try adding an unknown field or mutating the relationship population; both must fail |
| [contracts.ts](../../apps/executor/src/contracts.ts), `validatePlan`, `canonicalPlan`, `compileSQL`, `pythonSource` | A versioned operation IR and a trusted compiler | Compare v1 serialization to v2; unsupported semantics must never be silently downgraded |
| [advanced.ts](../../apps/executor/src/advanced.ts), `sqlDiagnostics` | SQL grain, cardinality and population diagnostics | Construct a duplicate lookup key and identify the exact rejecting query |
| [worker.ts](../../apps/executor/src/worker.ts) | Independent runtime execution and resource lifecycle | Trace when DuckDB closes before Pyodide starts, and what cancellation destroys |
| [verification.py](../../services/api/src/hypothron/verification.py), `contract_hash`, `verify_evidence` | Deterministic status/classification policy | Equal sums with unequal counts cannot produce VERIFIED |
| [verification.ts](../../apps/web/lib/verification.ts), `evidenceVerdict` | Revalidation across the browser/API boundary | Change a returned diagnostic count and compare the two validators |
| [workflow.py](../../services/api/src/hypothron/agents/workflow.py), `issue`, `accept`, `correction`, `route_accept`, `report` | Conditional graph routing with bounded durable retries | Trace three disagreements and count jobs separately from model calls |
| [ledger.py](../../services/api/src/hypothron/ledger.py), `issue`, `submit`, `claim`, `fence`, `cancel` | Transactional idempotency and lease fencing | Retry an identical submission, then a changed submission with the same job ID |
| [driver.py](../../services/api/src/hypothron/driver.py), `InvestigationDriver.advance` | Recovering graph and business-ledger state across separate commits | Resume after the result is accepted but before the graph consumes it |

Pydantic is the Python contract authority, while browser contracts independently validate unknown JSON. Strict parsing is a boundary, not a complete business rule: ownership, approved snapshot identity and exact plan equality must still be checked after parsing. Python tuple conversion for grain keys avoids a mutable list inside an otherwise frozen model. A frozen outer object with a mutable child would leave a semantic mutation hole.

## 3. Architecture diagrams and what they teach

- [Verification and trust boundaries](../diagrams/phase-3-verification.html) separates local raw-row computation from API comparison of client-reported aggregates. The two engines receive the same approved contract and bytes, not each other's output.
- [Evidence lineage and claims](../diagrams/phase-3-evidence.html) shows why existence, compatibility and numerical support are separate checks. A dependency records an investigation predecessor; it does not establish causation.
- [Bounded correction routing](../diagrams/phase-3-correction.html) exposes the finite loop: accept, classify, optionally reissue the same contract, then report unresolved when the correction limit is reached.
- [Report validation and visualization](../diagrams/phase-3-reporting.html) places server and browser validation before escaped text, chart and table rendering. Model output never becomes chart source code or executable markup.

These are static self-contained HTML/SVG artifacts generated with the installed diagram-design skill. The doc-wide canvas is 1280 × 720; small screens scroll the diagram locally. They use the existing provisional editorial style, not a claim of finalized product branding. Four focused diagrams replace one oversized diagram that would hide the trust and retry boundaries.

## 4. Metric contracts: identity, immutability and compatibility

A metric contract is an agreement about what an operation means. Its identity includes input bytes by dataset hash, operation version, columns, period, timezone, currency, null policy and v2 grain/relationship semantics. Changing the period is a different metric even if the new sum coincidentally equals the old one. Changing currency from EUR to USD cannot be accepted merely because both use two decimal places.

`MetricPlan` permits only known operation versions. Version 1 retains its original USD/UTC semantics and wire representation; its serializer omits v2 fields. Version 2 requires one to four distinct grain keys and an explicitly present relationship, which can be null. Required presence distinguishes a reviewed choice of no relationship from an accidentally missing field. Relationship models include the lookup dataset hash, primary and lookup keys, cardinality and approved primary population count. Both contract and relationship are frozen.

`contract_hash` serializes the parsed contract as sorted compact JSON and hashes it with SHA-256. This gives the backend a stable key for correction accounting and evidence binding. Browser `canonicalPlan` independently canonicalizes accepted plans for field equality and replay comparison. A canonical hash is an identity mechanism. It says nothing about the correctness of the business definition, the legitimacy of an input or whether a client performed the calculation.

Do not compare only the operation name and dataset hash. A replay of EUR Q3 cannot satisfy a USD Q2 claim. Do not use the hash as permission to skip the actual approved-contract lookup. Compatibility is a policy decision attached to a known version and exact semantics; unsupported versions are rejected instead of interpreted optimistically.

A concrete v2 contract excerpt is:

```json
{
  "version": 2,
  "kind": "revenue_sum",
  "amountColumn": "revenue",
  "dateColumn": "completed_at",
  "start": "2025-07-01T00:00:00Z",
  "end": "2025-10-01T00:00:00Z",
  "timezone": "UTC",
  "currency": "EUR",
  "nullPolicy": "exclude",
  "grainKeys": ["order_id"],
  "relationship": null
}
```

The complete contract also includes a 64-character dataset hash. Dataset descriptors bind that hash to the contract and constrain known column names. The excerpt omits it for readability; the API does not accept an incomplete contract.

## 5. Independent SQL and Pandas computations

### Runtime and compiler boundaries

The worker receives a validated plan, immutable input bytes, optional lookup bytes and local runtime assets. It checks the content hash and approved relationship flag, parses bounded CSV input, creates a DuckDB in-memory table and disables external access. `compileSQL` produces fixed read-only aggregate SQL from validated identifiers and dates. The model never supplies SQL source.

DuckDB closes before the worker starts Pyodide. `pythonSource` chooses a fixed v1 or v2 template; it never evaluates a model-generated program. Pyodide loads Pandas/NumPy from the approved local runtime assets. The template receives JSON contract and CSV strings as data. Pandas reparses the CSV independently rather than consuming the DuckDB table or sum. The worker validates the final envelope and returns aggregate values, diagnostic counts and local runtime/source metadata. Raw rows and join keys never belong in the API evidence envelope.

Separate implementation paths catch a SQL filter or parser mistake that a single engine's repeated query would reproduce. They do not create statistical independence in the scientific sense. Both paths share the approved definition, input bytes and validation assumptions; a shared mistaken definition can produce identical wrong results.

### Exact monetary arithmetic

`compileSQL` casts the amount column to `DECIMAL(18, scale)` before summing. Version 2 uses scale 2 for USD/EUR and 0 for JPY, multiplies by the corresponding power of ten and serializes an integer through `HUGEINT` to a string. Pandas keeps CSV columns as strings and converts selected amounts with Python `Decimal`, then sums integer minor units using Python integers. Neither path sums binary floating-point money.

For `10.10` and `-0.03`, the exact EUR result is `"1007"` minor units and count 2. A decimal value in a JPY contract fails validation rather than being rounded. The operation accepts at most two fractional digits in USD/EUR and does not infer a currency from row values. There is no exchange-rate table, multi-currency aggregation or implicit rounding policy.

Money uses the named `exact-minor-units-v1` comparison policy: absolute tolerance zero and relative tolerance zero. Generic epsilon comparison would conceal an exact monetary mismatch. A future scientific floating-point operation would need its own versioned error policy, NaN/infinity handling and reproducibility contract; Phase 3 does not pretend the money policy solves those cases.

### Dates, offsets and nulls

The period predicate is `start <= timestamp < end`. Half-open intervals compose adjacent quarters without counting the boundary twice. The engines require timestamp strings matching the contract suffix and parse calendar validity, so `2025-02-30` does not pass a regex alone. Version 2 supports UTC and explicit fixed offsets, such as `+05:30` or `-04:00`; it does not support named IANA zones or infer daylight-saving transitions. An offset is a fixed mapping to UTC, not a geographic timezone history.

Pandas uses `pd.to_datetime(..., utc=True, format=..., errors='raise')`; SQL casts to `TIMESTAMPTZ`. Both compare parsed instants against the explicit start/end. Null date and malformed amount fail. An empty monetary value is treated according to `nullPolicy`: `exclude` counts it as a period null but omits it from the numeric count; `error` rejects null amounts in the input. This policy is intentionally strict across the dataset rather than quietly ignoring bad rows outside the requested period.

`minorUnits: null` with count zero is an empty numeric population, not revenue zero. A sum of zero with a positive count is a valid observed zero. Conflating these states would turn missing evidence into an invented finding.

### Grain and join cardinality

A grain defines what one row represents. `order_id` can be correct for order revenue and incorrect for an order-line dataset. `sqlDiagnostics` checks grain fields are non-null, counts distinct grain tuples and requires that count to equal the primary population. Pandas checks empty keys and uses `drop_duplicates(subset=grainKeys)` independently. Both fail duplicate grain even when duplicate monetary values happen to cancel out.

For a lookup, the primary population must equal the approved `populationCount`. Lookup keys must be non-null and unique. The primary key must also be unique for one-to-one; repeated primary keys are allowed for many-to-one. SQL uses a left join, checks unmatched rows, verifies the joined row count equals the primary count and confirms distinct grain count remains unchanged. Pandas uses `merge(..., validate='one_to_one' or 'many_to_one', indicator='__joined')`, checks all rows match and compares merged length and unique grain. Many-to-many joins are unavailable.

The Pandas join projects only the lookup key and chooses a helper name absent from original primary columns. It avoids `merge(indicator=...)`: Pandas internally reserves `_left_indicator`/`_right_indicator` even for custom indicator names. Unmatched rows are detected through missing validated right-side keys. Actual Pyodide regressions cover `__joined`, `__lookup_key`, `_left_indicator` and `_right_indicator` source grain names; all remain valid columns.

The lookup validates relationship integrity; it does not introduce arbitrary grouping, lookup monetary columns or an unconstrained filter. Extra lookup rows are permitted when unique; missing referenced keys are not. This makes population preservation explicit instead of trusting a plausible final sum.

## 6. Diagnostic classification and trust semantics

`verify_evidence` first checks dataset binding, compares numeric populations, distinguishes empty population from zero, and compares exact minor-unit strings. For version 2 it additionally checks that diagnostics exist and carry the identical approved contract. It then checks grain uniqueness, forbidden nulls, agreement of all semantic counts, internal population consistency and relationship population/cardinality. Browser `evidenceVerdict` mirrors this policy on received data.

The current classification order is deterministic. A grain violation takes precedence over a later count mismatch; this is a diagnostic explanation of a failed invariant, not an attempt to identify the only cause. Multiple faults can exist even though the verdict exposes one classification. The important statuses are:

| Example | Status / classification | Meaning |
|---|---|---|
| Equal count and exact sum; valid matching semantics | VERIFIED / AGREEMENT | Local consistency for the approved operation |
| Equal sum, unequal counts | DISPUTED / POPULATION_MISMATCH | Different numeric populations cannot support agreement |
| Different sums for equal populations | DISPUTED / VALUE_MISMATCH | Numerical contradiction |
| Duplicate grain | DISPUTED / GRAIN_VIOLATION | Input violates approved row meaning |
| Different diagnostic counts | DISPUTED / SEMANTIC_DIAGNOSTIC_MISMATCH | Engines disagree on semantics |
| Missing or changed v2 diagnostic contract | INCONCLUSIVE / INCOMPATIBLE_SEMANTICS | Insufficient compatible evidence |
| Both numeric populations empty | INCONCLUSIVE / EMPTY_POPULATION | No numerical result to claim |

Every verdict retains `CLIENT_REPORTED` provenance. Status answers “did these results meet the comparison policy?” Provenance answers “where did the evidence come from?” A forged client can submit two agreeing values and counts. FastAPI cannot prove source-row execution because it intentionally never receives those rows. A signed job, contract hash or checkpoint does not repair that trust gap. The interface must never reword this as server attestation.

## 7. Evidence dependencies, bounded correction and recovery

`issue` creates a stable job UUID and copies the approved contract into the pending job. Its `dependsOn` contains accepted predecessor job IDs. `accept` resumes a LangGraph interrupt with strict evidence, checks job and dataset binding, invokes deterministic verification and appends an immutable record with hypothesis, contract hash, metric version, currency, tolerance, classification and provenance. Existing ledger checks scope dependencies to accepted jobs of the same run.

A dependency represents investigation ordering and reproducibility context. It does not mean one metric mathematically derives from another, and it does not prove a causal relationship. The bounded history is acyclic because only previously accepted jobs can be dependencies. Existing jobs and evidence are preserved instead of overwritten by a later attempt.

`route_accept` sends DISPUTED evidence to `correction`. That node maintains a per-contract-hash count. It can issue at most two corrections and always recomputes the original approved contract. It never changes the period, removes suspicious rows or asks a model to explain away disagreement. Thus three persisted attempts can all remain disputed: original plus two corrections. A later agreement is a new evidence record; it does not retroactively change prior verdicts.

The six-job bound limits total execution, the twelve-role-call bound limits model calls, and the correction bound limits retries per semantic identity. These are independent safeguards. Correction issues a fixed job without another model call. The analyst also checks exhausted correction identities before repeating them, so ordinary model routing cannot bypass the correction policy.

Recovery keeps the Phase 2 separation of PostgreSQL business records and native LangGraph checkpoints. `Ledger.submit` stores a result and event atomically; identical resubmission is acknowledged and conflicting resubmission rejected. The driver can consume an accepted result after a crash. UUID generation precedes the waiting interrupt, so restarting the wait does not create a new job. A recovered correction therefore retains its original identity and dependencies.

Cancellation increments the lease epoch, cancels pending jobs and makes the run terminal. A stale segment must fail `fence` before writing. Browser cancellation aborts local requests and terminates worker execution; provider work already dispatched can still finish remotely, so cancellation is not a refund guarantee. A durable correction test reconstructs the driver, confirms the pending correction identity, cancels and verifies that a fresh result submission is rejected.

Deterministic replay remains a separate local operation with zero provider calls and no implicit save. Phase 3 versions its semantics so replay comparison can refuse incompatible plans. Phase 4's saved investigation lifecycle is not implemented by these changes.

## 8. Reports and visualizations: grounding beyond citation existence

A numerical statement requires more than a known citation ID. It must identify compatible evidence, refer to the approved dataset and metric semantics, use an admissible verification state and match an actual result or deterministic arithmetic contribution. A report claiming EUR 120 while citing EUR 100 is unsupported even though the job exists. A claim citing a disputed result must remain unresolved instead of selecting the more convenient engine value.

The report path treats provider output as untrusted structured data. Server validation or deterministic fallback precedes completion, and browser validation precedes rendering. Presentation uses escaped React text and fixed chart components, not model HTML, arbitrary markdown scripts or provider-authored visualization code. Accessible visualizations expose a labelled SVG and a data table so meaning does not depend on color, hover or sight. Empty, disputed and inconclusive findings retain clear state/provenance labels.

Observed correlation, arithmetic contribution and causality require different support. An exact percentage change between two compatible totals can establish arithmetic change; causal, correlation and contribution kinds remain rejected because no supported operation establishes them. It cannot establish that a promotion caused the change, because there may be seasonality, composition changes or unobserved confounders. The current restricted operation does not calculate a correlation coefficient or perform randomized experiments. Causal language must therefore be rejected rather than laundered through a valid revenue citation. An unresolved statement can say more analysis is required; it cannot smuggle a causal answer into its wording.

### Actual report schema and execution

[NumericalClaim](../../services/api/src/hypothron/agents/models.py) requires a known `kind`, one or two `evidenceIds`, the current dataset/contract hashes, bounded decimal-string `value` and a unit. `ReportReply` bounds citations at six and claims at twelve. The schema recognizes `correlation`, `contribution` and `causal` so the domain validator can reject them explicitly as `UNSUPPORTED_RELATION`; only `total`, `count` and `percent_change` have supported computation contracts. This distinction makes unsupported analytical meaning a named policy failure rather than silently treating it as an observed total.

[reporting.py](../../services/api/src/hypothron/reporting.py), `validated_report`, builds a job-ID lookup from accepted evidence. It rejects missing, duplicate or orphaned citations. Each claim's evidence IDs must be present in both the accepted evidence and the draft's citation list. The current operand must match the declared dataset and contract hash. Every numeric operand must be VERIFIED, CLIENT_REPORTED and have identical SQL/Python numeric structures. A total takes one minor-unit operand; a count takes one row-count operand. Neither can accept the other unit.

Percentage change takes an explicit ordered baseline/current pair. `_compatible` permits dataset hash and period to differ, while requiring every other business-rule field to agree: currency, operation version, columns, timezone, null policy, grain and relationship. The exact approved contract is retained in the evidence to make this comparison possible. This supports comparisons across periods or source datasets with compatible schemas; it does not support cross-currency comparison or differing grain/null semantics. There is no implicit baseline selected by a model's narrative.

The arithmetic is:

```python
expected = Fraction((current_minor - baseline_minor) * 100, baseline_minor)
```

Python `Fraction` reduces an exact rational ratio without binary floating point. The proposed decimal string is converted to a Fraction and must equal it exactly. From `10000` to `11800` the expected percentage is exactly `18`, while a claim of `20` fails even with valid citations. A baseline of zero raises `UNDEFINED_BASELINE`. A nonterminating fraction such as one-third percent cannot be truthfully approximated by a twelve-decimal claim under this exact policy; it is rejected rather than quietly rounded. A future rounded percentage policy needs an explicit version and error bound.

The prose policy is deliberately conservative. `validated_report` accepts only a small qualitative grammar, such as “Evidence collected.” or “The disagreement remains unresolved.” Agreement wording additionally requires the cited evidence to be verified. Arbitrary prose, including spelled-out numbers or disguised causal explanations, produces `UNTRUSTED_NARRATIVE`. Even accepted proposed prose is not published: the returned conclusion is deterministic. The model has authority to propose admissible structured claims, not to introduce an unstructured factual channel around validation.

`fallback_report` constructs the actual output envelope: version, deterministic conclusion, all evidence citations, source, rejection, findings, claims and charts. Each finding binds its dataset/contract hashes, metric version, currency, status, CLIENT_REPORTED provenance, observed relation, engine values and dependencies. `SUPPORTED` means verified observation; otherwise assessment remains DISPUTED or INCONCLUSIVE. An `engine_comparison` chart carries each engine's actual minor units, including disagreement or null values. A fallback has no numerical claims and retains the rejection code so a user can see why the proposal was refused.

The graph's `report` node re-verifies historical evidence from issued job plans before drafting. This hydrates old Phase 2 records that lacked the new contract/version/classification fields, preserving resumable investigation recovery. It uses the issued job's approved plan as authority rather than trusting newly supplied presentation metadata. If a report proposal fails domain validation, the node emits deterministic fallback and completes. If the report role itself fails or its budget is exhausted after evidence collection, it also falls back without another provider request. This preserves completed computations rather than discarding the investigation because prose was unsafe. Earlier planner/analyst failures retain their existing terminal policy.

### Browser validation and chart algorithms

[report.ts](../../apps/web/lib/report.ts), `validateReport`, independently checks exact output keys, version/source, safe rejection codes, deterministic conclusion, complete ordered citations and one finding/chart per accepted evidence. It compares each finding's identity, values, status, provenance and dependencies with known investigation evidence. A server report cannot freely choose a new dataset label or chart value. Claim validation repeats compatible operands and exact arithmetic using BigInt cross multiplication, avoiding conversion of monetary data to `Number`.

For decimal proposal `n / d` and baseline `b`, the percentage test is `n * b == (current - b) * 100 * d`. This is the browser counterpart of Python Fraction equality. Total/count output is normalized to integer strings on the server and required to be integer-valued in the browser. Published percentage values preserve an exact accepted decimal; there is no claim that irrational or recurring values can be shown exactly with this schema.

[EvidenceReport.tsx](../../apps/web/components/EvidenceReport.tsx) renders the validated envelope. `exactMoney` uses BigInt division/remainder to format signed minor units with the correct currency scale, preserving values beyond JavaScript's safe integer range. `comparisonBars` finds the largest absolute engine value and computes `absolute * 160 / magnitude` as an integer ratio before converting only the bounded pixel width to Number. Negative bars extend left of zero; positive bars extend right. This preserves sign and avoids floating-point overflow during chart normalization.

The bar chart is necessarily a finite-resolution presentation. A nonzero value too small for one pixel displays “below chart resolution,” while an actual zero displays “zero” and null displays “undefined.” The accompanying captioned table preserves exact monetary strings and counts. SVG title/description and axis labels expose the comparison, and evidence links lead to stable findings with expandable hashes and dependencies. The table, text labels and symmetric zero reference carry meaning even when colors are unavailable.

`validateInvestigationState` refuses numerical publication authority to legacy completed Phase 2 free-text reports: it validates old citation ownership but does not render their ungrounded text as a new structured report. Resumable old evidence is hydrated for newly generated reports. This is a compatibility boundary worth explaining: continuing an old run safely differs from blessing previously produced prose under a stronger current claim contract.

[Reporting tests](../../services/api/tests/test_reporting.py) include the exact 18% example with an incorrect 20% proposal, orphan and incompatible citations, disputed operands, zero baseline, mixed currency, unsupported causal/correlation/contribution kinds and untrusted narrative. The graph test proves rejected prose falls back while keeping actual `3033` minor-unit evidence. [Browser report tests](../../apps/web/tests/evidenceReport.test.ts) exercise revalidation, exact formatting, safe markup and visual accessibility contracts. None of these tests requires paid provider inference.

## 9. Performance, security and concurrency reasoning

For N primary rows and M lookup rows, CSV parse, date checks and monetary conversion are O(N + M) in input length, with additional string storage. Grain uniqueness and hash-join validation are expected O(N + M) for common hash implementations, although implementation choices and spill behavior matter; sorting alternatives can be O(N log N). Scalar comparison is O(1), contract hashing is O(B) in serialized contract bytes, and report checks are bounded by six jobs and bounded findings. These are analytical expectations, not measured throughput promises.

Peak memory includes CSV strings, parsed DuckDB columns, lookup data, runtime assets and later Pandas frames. DuckDB termination before Pyodide reduces overlapping live engine state but does not guarantee immediate operating-system reclamation. Bounds include combined input bytes, row/schema counts, expansion estimates, output JSON and runtime deadlines. Lookup input shares the combined input limit; it does not grant a second unbounded data channel. Report and graph state limits prevent metadata amplification.

No new migration is required for these versioned JSON contracts: existing graph/ledger JSON records store them under the same owner/fence policies. This does not imply every arbitrary future contract belongs in JSON forever. A future new indexed query requirement or persistence boundary must be designed explicitly. PostgreSQL row locks serialize a run's mutations; browser execution stays local. Process-local admission control is not a global distributed quota.

Privacy tests must inspect requests and persisted state, not just confirm a UI label. Raw CSV, lookup bytes and credentials must remain absent from provider contexts, evidence submissions, logs and checkpoints. The execution origin gets no provider key or API token. App-origin XSS can still access ephemeral application memory; strict text rendering reduces one avenue but is not hardware secret isolation. Numerical privacy is also bounded, not absolute: aggregate results and schema metadata remain sensitive.

Release-level risks remain the established hosted abuse controls, operational cleanup/backups, browser/runtime compatibility outside the measured desktop target, truthful business contracts and the client-reported trust boundary. Passing local fixtures does not establish a general public-production security guarantee.

## 10. Validation evidence and practical experiments

Final backend validation passes 92 tests in 4.60 seconds against real PostgreSQL. The complete unit suite passes 72 tests in 10.75 seconds, including 14 actual mirrored Pyodide/Pandas tests. The complete real-browser suite passes22 tests in3.8 minutes; its golden/adverse evaluation records22 actual worker cases in61493ms. Production build, strict types, formatting, migration/schema and diagram gates pass; exact commands and limitations are in the phase report. Earlier scoped T3.1 counts are historical and are not added to full totals. The final Phase 3 report records full suites, exact commands, golden-question/adverse evaluation and actual skips or blockers. Do not sum scoped and full run counts; the same test can appear in both.

[Verification tests](../../services/api/tests/test_verification.py) exercise exact classification, missing/incompatible diagnostics, semantic invariants despite equal totals, fixed offsets, deep immutability and bounded corrections. The real PostgreSQL recovery case reconstructs `InvestigationDriver` and checks cancellation fences a pending correction. [Pandas verification tests](../../apps/executor/tests/pandas-verification.test.ts) execute the actual fixed template in Pyodide with independent fixtures for duplicate grain, duplicate lookup, unmatched keys, one-to-one mismatch, population mismatch, null policy, invalid date and fractional JPY. [Advanced browser tests](../../tests/e2e/advanced-verification.spec.ts) exercise the actual local executor with both runtimes.

The [golden fixture file](../../tests/fixtures/phase3-golden.json) contains ten hand-derived questions and twelve adverse cases. The [real-browser evaluation harness](../../tests/e2e/phase3-evaluation.spec.ts) submits each fixture through the executor origin MessageChannel, validates both actual engine outputs against independently declared expected values, asserts rejected cases never become successful evidence, checks no POST requests and no IndexedDB databases, and writes a measured evaluation artifact. It separately probes contradiction and the agreeing-forgery provenance boundary. That finite suite measures honest local computation and privacy policy; it does not prove malicious-client attestation or universal numerical correctness. Final observed pass counts, timings and runtime versions are recorded by the evaluation artifact and phase report.

The diagram skill `self_check.py` passed all four diagrams. `node scripts/check-diagrams.mjs docs/diagrams/phase-3-*.html` ran real Chrome, found no text outside the canvas and confirmed locally scrolling diagrams without page overflow at width 390. Geist loaded during this run. Public Google Fonts can be unavailable offline; the diagrams disclose fallback families. Two inspected screenshots prompted correction of cramped labels before final checks. Screenshots are validation artifacts in `/tmp`, not committed runtime assets.

Useful commands from the repository root are:

```sh
pnpm test
pnpm typecheck
pnpm format:check
pnpm build
pnpm e2e
node scripts/check-diagrams.mjs docs/diagrams/phase-3-*.html
```

Backend commands and required PostgreSQL environment are recorded in the phase report and project setup. Provider tests use mocked external HTTP, not paid inference. Real-browser execution is real WASM/Pandas computation; mocked role HTTP does not invalidate that distinction. A golden expected result must be independently specified, not copied from the production compiler that the evaluation is intended to test.

## 11. System-design interview questions and detailed answers

### Why deterministic verification instead of asking a second LLM?

Arithmetic has an explicit expected behavior. A fixed compiler and exact integer comparison can produce reproducible failures with stable classifications. A second model can share the first model's error, invent a plausible explanation or incur another paid call without a proof obligation. The model is useful for choosing a bounded hypothesis, not deciding whether two population counts match. Follow-up: deterministic code can still be wrong, so use independent execution, semantic invariants, golden datasets and adverse fixtures together.

### Why can two agreeing engines still be wrong?

They may share the wrong metric, corrupted input, an omitted population, a mistaken timezone definition or malicious client evidence. Independence reduces correlated implementation bugs; it does not prove the user approved the right business meaning. Grain/cardinality checks catch some shared wrong-population cases. A true trust claim would require a trusted execution boundary or server recomputation, which the memory-only design intentionally lacks. State the limitation in the result provenance.

### How do status and provenance differ?

Status is an outcome of a comparison policy: verified, disputed or inconclusive. Provenance is the origin: client-reported here. Equal numbers do not turn provenance into server-attested evidence. An honest user can rely on local agreement for exploration while understanding that the backend is validating submitted aggregates. Follow-up: signed plans authorize work and hashes identify bytes; neither authenticates the unobserved computation.

### How do you prevent unsupported numerical claims?

Validate a bounded structured report against accepted evidence. Check existence, same run, contract/dataset compatibility, admissible verification status and exact value or permitted arithmetic relation. Render the validated value using trusted components. Do not allow arbitrary prose numbers to bypass the claim structure. Negative fixtures need valid citation IDs with incorrect numbers, because orphan-only tests miss the harder grounding problem.

### How do you prevent unsupported causal claims?

Separate observational metrics and arithmetic contribution from causal interpretation. Current operations offer no experiment or identification strategy. Reject unsupported causal wording even when all cited sums are correct. “Revenue increased” and “the campaign caused revenue to increase” are different claims. A future causal operation would need explicit assumptions, design, uncertainty and evidence contracts; it is not a report-schema flag added casually.

### How do correction loops terminate across crashes?

Persist a correction count keyed by immutable contract identity, retain every attempted job, and apply independent total-job/model-call limits. Issue a stable job before waiting, then reconcile accepted ledger results on resume. A crash cannot reset a corrected metric merely by reconstructing the Python driver. Fencing prevents a superseded or cancelled owner from restoring old state. Uncertain external billing remains terminal rather than triggering blind HTTP retries.

### Why not repair the contract automatically after disagreement?

Changing a period, currency, null rule or grain changes the question. A model could make engines agree by excluding inconvenient data, producing a confident wrong answer. Recompute the approved contract only. If the contract is wrong, request a new reviewed contract and preserve lineage; do not reinterpret the old evidence silently.

### Why use Decimal and integer strings instead of floats?

Binary float cannot represent most decimal cents exactly, and JavaScript numbers have a finite safe-integer range. Parse a validated string with Decimal, convert exact scale to integer minor units and transport as a string. DuckDB DECIMAL provides an independently implemented decimal path. Zero tolerance follows because the operation is exact; rounded or mixed-currency semantics would need another contract.

### What happens if the database result commit succeeds but checkpoint resume fails?

The accepted result remains in the owner-scoped job ledger. The next segment discovers the graph's pending job, loads the same accepted result and resumes its stable interrupt. Duplicate result submission is safe because its canonical digest matches. These are separate transactions bridged by idempotency and reconciliation, not an invented globally atomic transaction spanning HTTP, browser and checkpoint saver.

## 12. Explain Phase 3 in two minutes

“Hypothron keeps raw data in browser memory and uses an approved, restricted revenue contract. Phase 3 makes the contract explicit about grain, period, offset timezone, currency, nulls and optional lookup cardinality. A trusted compiler runs DuckDB SQL and a fixed Pandas template independently. Both compute exact integer money and semantic diagnostics. The backend compares submitted aggregates and records verified, disputed or inconclusive with client-reported provenance. Agreement does not mean server attestation.

“When evidence disagrees, LangGraph deterministically recomputes the unchanged contract at most twice. Stable job IDs, PostgreSQL idempotency and lease fencing preserve that limit across recovery and cancellation. Structured reports must bind numerical claims to compatible accepted evidence; an existing citation is not enough. The renderer uses escaped text and accessible chart/table components. Tests include real browser engines, exact golden values, incorrect joins, null/date/currency edges, invalid claims and recovery. No paid inference, raw upload or saved replay mode was added.”

## 13. Explain Phase 3 in ten minutes

Spend minute one on privacy and the question: a plausible result is insufficient when joins or population definitions are wrong. Minutes two and three cover the versioned immutable contract with a concrete EUR example, then grain and lookup cardinality. Minutes four and five walk through the independent SQL DECIMAL and Pandas Decimal paths, half-open dates, null population and diagnostic invariants. Use the verification diagram to identify where raw rows stop.

Minute six explains status versus provenance and the two-agreeing-engines counterexample. Minute seven traces original job plus two corrections, distinguishes correction from model retry and shows persistence of the contract-hash counter. Minute eight describes result submission, checkpoint reconciliation and cancellation fencing. Minute nine walks a valid citation with a false claimed value through report rejection, followed by accessible rendering and causal-language limits. Minute ten presents actual fixture results and limitations: fixed offsets, three currencies, one operation, local target, client trust and pending hosted gates. End by inviting the interviewer to choose either numerical correctness or crash recovery for a deeper discussion.

## 14. Practical exercises and prioritized learning checklist

1. Run the Pandas verification fixture, calculate `10.10 - 0.03` manually and explain why its count is two while the period count is three. Change the null policy and predict the failure before running it.
2. Add a duplicate lookup row to a synthetic fixture. Identify both the SQL uniqueness check and Pandas merge validation that must reject it. Then create an unmatched primary key; distinguish missing lookup from fan-out.
3. Add a row exactly at `end` and show both engines exclude it. Change to a fixed offset with corresponding start/end, then try a named IANA zone and explain why contract validation refuses it.
4. Make equal numeric totals with different counts in `test_verification.py`. Confirm the verifier remains disputed. Next make equal counts but different diagnostic grain; describe classification precedence.
5. Trace the bounded-correction test by hand. Record each UUID, `dependsOn`, correction count and provider-call ordinal. Prove a fourth same-contract job cannot be issued after two corrections.
6. Run the recovery/cancellation test with PostgreSQL. Explain which rows survive a driver reconstruction and why cancellation rejects the pending correction submission.
7. Create a report draft with a real job citation and a different monetary value. It must fail numerical support, not pass because the ID exists. Repeat with a causal conclusion whose totals are all correct.
8. Inspect a chart with keyboard and accessibility tools, then read its data table without the SVG. Explain how status, provenance and exact units remain available.

Must know before Phase 4: exact Decimal/integer arithmetic; half-open time intervals; Pandas merge validation and SQL cardinality; strict immutable versioned contracts; count versus empty population; deterministic claim grounding; status versus provenance; interrupt/restart behavior; idempotent result digests and fencing epochs.

Production study priorities: peak browser memory and cancellation; bounded JSON and privacy validation; checkpoint/ledger reconciliation; database lock and connection limits; unsafe deserialization; external provider uncertainty; hosted abuse control and operational retention. Study these with actual negative tests rather than treating a successful build as a proof.

Advanced topics after the core is clear: metamorphic testing, cross-engine parser differentials, broader decimal precision contracts, IANA timezone/version locking, causal identification, signed trusted-execution provenance and reproducible runtime manifests. These are study topics or future design work, not implemented Phase 3 capabilities.
