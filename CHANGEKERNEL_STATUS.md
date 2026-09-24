# ChangeKernel source-development handoff

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns procedure, and Git preserves completed reviews. Never govern this checkout with mutable checkout bytes.

## Shared R5 baseline — reviewed, preparing dispatch

**Manager verdict: accepted for the shared baseline only, after the repair in this revision.** The user authorized resumption from checkpoint `8e8621a19b114238e57e1b03ee348dafbff7ce71`. Review found that surviving intent custody could allow recreation of a lost original intake with different text. The regression reproduced an incorrect successful receipt before the repair. Shared initialization now refuses all surviving Change-bound continuation artifacts; an authorized read classifies surviving custody with missing original/retry rows as unavailable, while another actor remains denied. No schema, public API or identity encoding changed. The private `authorized_receipt` helper now takes the known profile flag.

The repaired baseline passed **25 native tests**, fmt/clippy and active LSP checks. Evidence: `/tmp/changekernel-r5-genesis-before.log` and `/tmp/changekernel-r5-dispatch-checks.log`. No R5 worker branches/worktrees or final worker handoffs exist yet; create them from this reviewed revision next. This verdict does not accept either complete R5 feature or qualify a release.

- **Manager worktree/branch:** `/home/canina7/Projects/changekernel-workers/integration`, `integration/rust-kickoff-01`.
- **Prior accepted integration:** `034141eea193eb155a9ffba5582df89cfea00dfc`; full R4 verdicts and evidence are preserved at `9abfac4b2:CHANGEKERNEL_STATUS.md`. R4-A/B are accepted and finished. The unexplained first R4-A test summary did not reproduce in three manager runs or the combined run; its cause remains unknown. Do not reopen that investigation without new evidence.
- **Approved R5 scope:** the user said to proceed with the previously proposed owner-only private intent/candidate custody, explicit current host retention/delivery grants, protected retention without automatic expiry, and no admission/delegation/execution authority. The [native profile](.changekernel/wiki/items/system/components/state.md#native-private-continuation-profile) and [v1 API/storage contract](.changekernel/wiki/items/system/components/state.md#native-continuation-api-and-storage-v1) now record that design. This is source-development approval, not managed adoption or controller handoff.

## What this checkpoint implements

- `SqliteIntake::initialize_continuation` creates an explicit richer profile only in an empty/missing absolute SQLite file. Existing `initialize` remains intake-only. `open_existing` validates the exact complete table layout before reading version metadata, rejects unknown tables/views/triggers/indexes/versions, and never upgrades a profile.
- An original proposal, original retry binding, immutable intent revision zero and initial head commit atomically. Existing intake identities and receipt meanings are unchanged. A retry never repairs a missing head or origin.
- The shared continuation reader verifies the original receipt, head, exact revision identities, complete lineage/retry bindings and absence of detached rows. History is bounded to 1,024 revisions including origin. Shared `guard_head` is usable inside both future writers' `IMMEDIATE` transactions; public preflight is not a lease.
- Versioned native data types, digest rules, persistence ports and generic candidate/intent application coordination are present. `SourceCustody::with_authorization` requires the trusted host to keep current permissions valid through its callback; Rust borrowing or a digest is not permission enforcement.
- **Not implemented:** `FileCandidateStore for SqliteIntake` and `IntentRevisionStore for SqliteIntake`. Their actual schema constants are present and used by initialization, not fake success/unavailable implementations. Concrete candidate retention and revision appends remain the workers' tasks. Generic coordination has not yet been exercised end-to-end with those future concrete writers.

## Frozen/shared files to review before dispatch

- `src/kernel/changes/intent.rs`: revision types, validation, versioned identity, origin/successor and history bound.
- `src/kernel/state/file_candidate.rs`: candidate types, exact request/record digests, bounds and observation checks.
- `src/ports/continuation.rs`: shared read/head guard, revision/candidate write ports and scoped source-custody contract.
- `src/adapters/sqlite/container_intake.rs`: profile selection, unchanged original custody and atomic genesis integration.
- `src/adapters/sqlite/continuation.rs`: original/head/history verification and transaction-local guard; manager-owned.
- `src/adapters/sqlite/{intent,file_candidate}.rs`: exact schema constants. Workers may add their own trait implementations, but the constants remain frozen/manager-owned.
- `src/application/{intent,file_candidate}.rs`: generic coordination exists; public signatures, policy ordering and retry semantics are frozen. `src/application/intake.rs` exposes its store only within the crate.
- `src/lib.rs` and `Cargo.toml` already register source modules, exports and the shared baseline test target. No dependency/lockfile or TypeScript changes were made.

## Prior checkpoint checks and remaining feature verification

- `cargo test --locked`: **24 passed** (the prior 20 plus four shared continuation tests); doctests enabled, currently none.
- `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings`: pass. No warning suppression was added; initial unused-function findings were resolved through public data helpers used by the intended contract.
- Four new tests in `tests/adapters/sqlite/native_continuation.rs` cover profile separation, exact genesis/restart, atomic rollback and missing-head refusal, stale-head/history/retry corruption, and rejected foreign/partial/version/view schemas without persistent mutation. A manually populated next-revision fixture tests the shared reader/guard, not a claimed implementation of the append API.
- Log: `/tmp/changekernel-r5-shared-checks.log`. The full suite was rerun after schema-query ordering and bounded head/retry-read corrections. The existing native intake/recovery JSON corpora and Cargo lockfile are unchanged. No npm campaign was needed for this Rust-only slice.
- Active LSP probes reported no errors on the changed Rust/config paths; perform a fresh probe after any resume edits. Source checks are not physical crash, malicious-host containment or exact-release qualification evidence.
- Still required after worker returns: independent exact reviews, concrete end-to-end authorization/custody/retry tests and a combined candidate-preparation versus intent-revision race using the actual writers. Do not add a duplicate permanent challenge suite or compiler-invariant tests.

## Next action — prepare and release the workers

1. The fresh-context shared review and repair are complete. Preserve the accepted observer/intake behavior; any later shared defect must return to the manager rather than prompting incompatible worker fixes.
2. Pin the exact reviewed base, then create external branches/worktrees. Reserved names are `work/native-file-candidates` at `/home/canina7/Projects/changekernel-workers/native-file-candidates`, and `work/native-intent-revisions` at `/home/canina7/Projects/changekernel-workers/native-intent-revisions`. They do not exist yet.
3. **R5-A:** implement concrete SQLite file-candidate custody in `src/adapters/sqlite/file_candidate.rs`; allow internal work in `src/application/file_candidate.rs` and `src/kernel/state/file_candidate.rs` without changing frozen public types, digests, scope, policy or schema. New integration tests: `tests/native_file_candidate.rs` (ordinary Cargo root test auto-discovery; no manifest edit/custom runner). Own handoff only otherwise. Cover exact binary multi-file custody/restart/object loss, current policy on retry/read, conflicting request identity, missing/corrupt grounds, transaction rollback and intent-head changes during capture.
4. **R5-B:** implement `IntentRevisionStore for SqliteIntake` in `src/adapters/sqlite/intent.rs`, with internal coordination work in `src/application/intent.rs`; shared kernel intent types/helpers are read-only. New integration tests: `tests/native_intent_revision.rs` (Cargo auto-discovery). Own handoff only otherwise. Reconcile exact retries before head/capacity conditions; retain revision/retry/head atomically; preserve the original; enforce single-winner concurrency, complete history and the declared bound. No candidate implementation dependency is required.
5. Record final exact base, owned paths, frozen exceptions and requirement links in each worker's `CHANGEKERNEL_STATUS.md`. Shared schema/constants, `continuation.rs`, existing intake, ports, composition, manifests/lockfiles and Wiki remain manager-owned. Both workers use normal Cargo tests, fmt/clippy and diff checks; no npm gate, parity suite or self-approval. Dispatch is not acceptance.

Decision/Work, operator transport, producer/Check execution, publication/recovery and research/memory adoption remain later separately contracted capabilities. Qualification, activation and explicit external-controller handoff are still required before any later candidate governs this repository.
