# ChangeKernel source-development status

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns source procedure, and Git preserves completed reviews. Change and Work own execution state after adoption.

## Accepted checkpoint

- **Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.
- **Native code:** `c1c0e54ad0d29a77e7910cf36fcf1edc3a3fc29a`: accepted corrected intake plus committed-source observation. R2-A was accepted only with the manager's object-identity, process-cleanup and error-classification repairs; R2-B was accepted at `853fcf65e`. Detailed verdicts/checks are preserved at `4250a9c36:CHANGEKERNEL_STATUS.md`.
- **Actual source checks:** 20 native tests, fmt, clippy and active LSP checks passed; independent corruption, lock, descendant and blocked-stdin probes passed. Evidence: `/tmp/changekernel-r4-manager-probes.I0J4eI/`. This is bounded local Git/Linux source evidence, not operational qualification.
- **Combined accepted checkpoint:** `034141eea193eb155a9ffba5582df89cfea00dfc` contains both R4 deletions and manager-owned dependency/document cleanup. Only 15 TypeScript source files remain: the Pi bridges, required protocols/codecs and entrypoint. Rust/Cargo and native fixture bytes remain identical to `c1c0e54ad`; no new native test run was needed for this TS-only change. The adapter-only boundary was established at `416c79d82`; test retirement is `114a099bd`. The [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy) remains unchanged.

## R4 verdicts — accepted and integrated

Both exact submissions were independently reviewed against base `416c79d8211580fec5e5ec1b8cb425ba58f76d21`, then composed with the accepted native fixes. Handoff-only commits were not merged.

| Slice | Exact code / worker report | Integration | Verdict |
| --- | --- | --- | --- |
| R4-A | `5674ae3115304b386a6db6a9b3c3bd1a49fb251e` / `c499594fd95818163d27fa8fa2f453357fd0642a` | `3ed2a3393` | **accepted** — 37 scoped TS host/API/non-Pi deletions. |
| R4-B | `9e5cf7999d683004a4808830264263b72b8502aa` / `817d292e073c328dd03e16bf05d746449fcc526b` | `2eabe5a14` | **accepted** — 24 scoped TS kernel/Pi-composition deletions. |

- **Combined findings:** the 61 deletion sets are disjoint and within scope. Retained Pi source/test bytes are unchanged. B removes `src/adapters/pi/check-backend.ts`, closing A's dangling `linux-host.ts` import; A removes B's retired callers. Build, adapter and test compiler/import closures agree, all local dependencies resolve, and every remaining TS source file belongs to that closure.
- **Independent checks:** fresh `npm ci --ignore-scripts`, `npm test` and build pass on both exact source trees; A's tests pass in three manager reruns (70 each). After composition and dependency pruning, a fresh install, 70 adapter tests, build, full-source `tsc --noEmit -p tsconfig.json`, import/byte-identity review and diff checks pass. Active probes cover all 15 retained source files, both JSON manifests and six changed Markdown files, with no LSP errors. Auxiliary static hints/style warnings on unchanged retained code are not newly introduced failures and were not mechanically rewritten.
- **Manager cleanup:** removed unused direct `koffi`, `zod`, `mdast-util-from-markdown` and `yaml` dependencies, including 50 unreachable lockfile package entries. No remaining package version/integrity changed; required SDK transitive dependencies remain. Updated active README/Wiki claims and ownership mappings without rewriting historical provenance or adopting the proposed R5 policy. Active local links/anchors resolve and no active documentation points at the deleted implementation paths.
- **Unresolved evidence gap:** A's first test invocation reported a summary-only failure, without diagnostic detail. It did not reproduce in three manager runs or the combined run. The cause is unknown, not diagnosed or claimed fixed; the observed passing source checks and unchanged retained code justify bounded slice acceptance, not a general flake-free claim.
- **Evidence:** `/tmp/changekernel-r4-review/` contains scope/dependency/closure audits and exact/combined check logs. No new permanent tests, native dependency changes, package qualification, live inference or controller operation occurred.
- **Worker return:** acceptance is recorded at `a4254113e1c005798b6843a7cfd544921b2d7b07` in `work/retire-ts-host` (`/home/canina7/Projects/changekernel-workers/retire-ts-host`) and `726b1f781982226113feecbd7d7df24bf307c49c` in `work/retire-ts-kernel` (`/home/canina7/Projects/changekernel-workers/retire-ts-kernel`). Both slices are complete. Workers must await a released next assignment; do not continue on these branches or resume old R3 work.

## Prepared next slices: R5 — blocked pending contract approval and shared baseline

The [proposed native private-continuation profile](.changekernel/wiki/items/system/components/state.md#native-private-continuation-profile-proposed) narrows the next increment to durable exact intent and file-candidate custody. This is a design proposal, not adopted policy, implementation, dispatch or acceptance. Planning now uses the accepted combined R4 checkpoint above; **no R5 branch/worktree has been created and no dispatch base is pinned yet**. R4 review is complete. The manager must still finalize the approved shared contract and its implementation baseline before creating and dispatching the two worktrees.

### R5-A — native file-candidate custody

- **Reserved branch/worktree:** `work/native-file-candidates`, `/home/canina7/Projects/changekernel-workers/native-file-candidates` (not created).
- **Outcome:** prepare and inspect immutable multi-file candidates with exact verified prior grounds, binary proposed bytes/modes or deletion, an exact intent revision and a stable retry binding. No Git/source writes, freshness/approval claim, inference or publication.
- **Planned owned writes:** `src/kernel/state/file_candidate.rs`, `src/application/file_candidate.rs`, `src/adapters/sqlite/file_candidate.rs`, associated focused native tests and its own handoff. Test placement/registration will be pinned with the shared baseline; no separate challenge suite. Shared types, ports, schema, composition and metadata remain manager-owned/frozen.
- **Dependencies:** accepted source observer; approved retention/delivery policy; frozen intent-reference/head transaction guard, source-binding/grant semantics and richer native store profile. The candidate implementation must not depend on Worker B inventing an interface during execution.
- **Acceptance:** multi-file create/replace/delete and binary round-trip; exact grounds survive restart and live-object loss; exact retry reconciles before recapture, conflicting retry rejects; missing/corrupt grounds and current denial/unavailability fail closed; no partial batch on failure; new preparation cannot commit against a changed intent head. Use a small set of ordinary Rust runtime cases, not a port of the old TS suite.

### R5-B — native attributable intent revisions

- **Reserved branch/worktree:** `work/native-intent-revisions`, `/home/canina7/Projects/changekernel-workers/native-intent-revisions` (not created).
- **Outcome:** preserve original intake and append exact attributable What/Why revisions with atomic expected-head comparison, history and retry reconciliation. This is private refinement custody, not Decision admission, a new public phase or a mutable copy of accepted intent.
- **Planned owned writes:** `src/kernel/changes/intent.rs`, `src/application/intent.rs`, `src/adapters/sqlite/intent.rs`, associated focused native tests and its own handoff. Shared intent-reference types, storage guards/schema and metadata remain manager-owned/frozen; Worker A consumes those agreed contracts, not unreviewed changes here.
- **Dependencies:** approved owner-only private-refinement scope and retention policy; frozen initial-revision identity, retry domain, exact encoding and shared store profile. No candidate implementation dependency after those boundaries are fixed.
- **Acceptance:** unchanged original receipt; exact text and absent/present-empty Why preserved through restart; competing revisions have one current-head winner; exact lost-reply retry returns the original result after later revisions; changed request input conflicts; corrupt/missing head/history/retry grounds remain unavailable and cross-container/actor access is denied. Revisions never silently retarget existing candidates.

### Manager pre-dispatch work

1. Obtain confirmation of the proposed scope: one authenticated owner, private intent/candidate custody only, explicit host source-retention/delivery grants (standing scoped grants allowed), protected retention without automatic expiry/eviction, no admission/delegation/execution authority. Unsupported retention obligations must block custody, not be waived. Do not turn this into a mandatory human prompt per operation.
2. Freeze the minimal Rust operation/port/type shapes, versioned identities/encodings, retry domains, result meanings and source-binding/current-grant contract. Keep the existing source-observation API and native intake meanings intact. No new framework, transport, dependency or placeholder success path.
3. Implement/review the shared SQLite initialization/schema and transaction guards once, under manager ownership. **Current `SqliteIntake::open_existing` rejects extra tables**, so the two workers cannot independently add tables or relax validation. Opening must remain non-mutating; foreign/partial schemas and unknown triggers/indexes still fail without journal changes. A deliberately initialized richer profile is distinct from existing intake-only stores; there is no implicit upgrade/import.
4. Establish the revision-zero/head and candidate expected-head checks in the same database transaction boundary. Git capture stays outside transactions. Freeze the required interfaces before parallel implementation; if dependencies remain, serialize rather than dispatch a worker against missing behavior.
5. R4 review is complete. Once the shared-contract baseline passes review, pin its exact commit and create both external worktrees and their final handoffs. Routine native acceptance is `cargo test --locked`, fmt, clippy and `git diff --check`, with active diagnostics and honest gaps. No npm gate for these Rust-only slices. The manager additionally checks the combined candidate-preparation/intent-revision race and unchanged intake regressions.

## Later gates

Decision/Work still needs an explicit versioned admission, assessment and authorization/delegation contract. Operator transport/toolkit, producer/Check execution, publication/recovery and research/memory adoption remain separate supported capabilities, not fields silently added to private custody. Prioritize the [smallest complete self-development path](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus), not prototype parity or disconnected scaffolding.

Qualification, activation and explicit controller handoff remain separate exact-subject gates. No live inference, packaging, activation or controller operation is authorized by these task plans. Never govern this checkout with mutable checkout bytes.
