# ChangeKernel source-development status

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns source procedure, and Git preserves completed reviews. Change and Work own execution state after adoption.

## Current checkpoint and testing decision

- **Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.
- **Accepted native code:** `853fcf65e7ebfee85b87225e4f01d95cbc676e5f` (corrected intake). The current cleanup changes tests, test configuration and documentation, not production Rust/TypeScript code or dependencies. Source observation remains unaccepted.
- **User-approved test scope:** Rust engine → Rust tests; retained TypeScript integrations → TypeScript-side tests; compile-time invariants → compiler feedback, not runtime tests. The researched [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy) replaces blanket legacy-suite gates in earlier assignments.
- **Cleanup:** removed 64 legacy JavaScript suites and 8 orphan helpers (72 files, about 13,000 lines). Removed TS engine/Git/Wiki/storage/CLI tests, Pi-named engine compositions, source/import inventories, document assertions and Node tests of native metadata. Git retains their history; they are not a Rust parity backlog.
- **Retained:** four Pi model/provider/session/protocol suites and two helpers; all three existing Rust test targets and both intake JSON corpora. Session fixtures now provide an incoming host contract without calling retired TypeScript authorization policy. `npm test` checks only the narrow adapter closure and runs 70 tests, down from 660; it no longer builds the historical TS engine. `tsconfig.adapters.json` excludes retired engine entrypoints, with existing codec/identity helpers reached only as adapter dependencies.
- **Native gate:** `cargo test --locked` (unit, integration and documentation tests); fmt/clippy before acceptance. No npm requirement for Rust-only work, additional test framework, custom runner, blanket parity/coverage target, duplicate permanent review suite or mandatory mutation ritual. Native runtime regressions for consequential failures remain required.
- **Cleanup checks:** `npm test` passes all 70 adapter tests; `cargo test --locked` passes all 10 native tests (documentation tests enabled, currently none); fmt and clippy pass. Active LSP checks for the changed adapter fixture and JSON configs report clean. Local-import closure and active Markdown link checks pass. Local logs: `/tmp/changekernel-narrow-adapter-tests.log` and `/tmp/changekernel-narrow-native-tests.log`.
- **Limits:** test retirement does not implement or qualify the removed capabilities. Historical TypeScript sources and package build remain private scaffolding pending separate coherent removal/replacement. No live inference, packaging, activation or controller operation was performed. The controller boundary is unchanged: never govern this checkout with mutable checkout bytes.

## R2 verdicts retained

Full exact-review evidence is preserved at `ba0129c7f:CHANGEKERNEL_STATUS.md`; these verdicts do not depend on preserving the retired test suite.

### R2-B — accepted and integrated

- Exact submission `1519e72e5482dc4d565b0d158ffda6c6f9af43f9`, report tip `9e87d27029ce160e28918a6fae3b20a9fa239740`, branch `work/native-intake-hardening`.
- R1-A `a84a121c5084509ff6a1f641288a62c3c129f312` and this correction integrated as `27b8543d6` and `853fcf65e`. R1-A is accepted only with the correction.
- Rejected foreign stores preserve bytes/journal mode; missing retry grounds remain unavailable to authorized owners, not denied; insertion failures roll back both records; the native runner consumes all shared recovery cases and expectations. These runtime checks remain in Rust.
- This worker is finished. No new work on its old branch without assignment.

### R2-A — changes requested; not integrated

- Exact submission `28c02e65c12da3c8e0c792e9832cd1177e01ef61`, including `1ea9edb097c8dabb3751ccb62204afe595810b6a`; report tip `2254f7ea5ac71211fc351fa637a88b3930272b6b`, branch `work/native-source-observation`.
- **F1, high:** `src/adapters/git/source_observation.rs:274-285,333-351` accepts readable but hash-mismatched commit/blob contents. Independent probes returned success for changed bytes under old object IDs while `git fsck` detected corruption. The corrupt-tree control was rejected correctly.
- **F2, high:** the same adapter at `236-244` returns on child exit while a redirected descendant remains live. A failure result does not prove cleanup.
- **F3, medium:** `src/application/source_observation.rs:16-18` converts operational intake unavailability into denial. An exclusive-store-lock probe reproduced the mismatch.
- Exact submitted build/tests passed but did not catch these runtime bugs; compiler guarantees do not cover them. Local repros remain in `/tmp/changekernel-r2-manager-probes/`. Evidence is bounded to tested Git/Linux forms, not general source/sandbox qualification.

## Active assignment: R3-A focused repair

- **Branch/worktree:** `work/native-source-observation`, `/home/canina7/Projects/changekernel-workers/native-source-observation`.
- **Code base:** `28c02e65c12da3c8e0c792e9832cd1177e01ef61`; updated assignment-only tip `6b385d3c3ff5c2e263bccfa0a7920bdbdb090620`. Verify the branch; no switch, merge or rebase.
- **Outcome:** close F1–F3 under the existing API/profile. Preserve verified source identity, literal absence, bounds/read-only behavior, settled subprocess custody and denied/unavailable distinctions.
- **Owned writes:** `src/adapters/git/source_observation.rs`, `src/application/source_observation.rs`, existing `tests/adapters/git/source_observation.rs`, and the worker's own status return. No manifests, lockfiles, exports, shared contracts or other test files without manager coordination.
- **Requirements:** [source custody](.changekernel/wiki/items/system/components/state.md#sources-observations-and-retained-research), [native observation profile](.changekernel/wiki/items/system/components/state.md#native-committed-source-observations), [cleanup/cancellation](.changekernel/wiki/items/system/components/agent-execution.md#time-bounds-cancellation-and-output).
- **Checks:** focused ordinary Rust regressions for the three findings, `cargo test --locked`, fmt, clippy and `git diff --check`. No npm/build duplication or separate negative-control campaign. Return exact revision, actual checks and gaps; do not self-approve or expand the support profile.
- **Integration:** the manager composes the correction with accepted intake, reruns native checks and independently probes the repaired boundaries. Earlier R2 changes to now-deleted Node architecture/manifest tests must not be restored. Source acceptance still precedes dependent candidate work.

## R3-B withdrawn

- The separate adversarial-suite assignment is withdrawn, not accepted or reassigned. Focused regressions belong in R3-A's existing Cargo target; the manager owns independent review. No duplicate test target or standalone Rust runner is needed.
- Branch/worktree: `work/native-source-adversarial`, `/home/canina7/Projects/changekernel-workers/native-source-adversarial`. Base `28c02e65c`; withdrawal-only tip `f182795a2227fe0f0896d146e7857a6454376f44`.
- The manager verified no implementation edits before withdrawal. Do not begin tests, merge, switch branches or start another slice. Await a new independent assignment.

## Ownership and next gates

- **Manager only:** shared contracts, composition, manifests, lockfiles, test registration and consolidated status. Worker handoff files are not merged wholesale.
- **Native candidate custody:** held until source observation passes review and its exact ownership/retention/current-authority interface is agreed. Then assign a cohesive native slice, not a TypeScript parity project.
- **Intent/Decision/Work:** held for an explicit versioned two-phase contract and agreed authorization/delegation policy. Escalate unresolved product intent to the user; do not silently port historical stage policy.
- **First self-development release:** prioritize the smallest complete bounded path in the [package contract](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus), not a broad integration catalogue or generalized framework.
- **Qualification, activation and controller handoff:** still separate exact-subject gates. Only a qualified immutable external release with explicit handoff may govern a later candidate; passing source tests or the engine's intended quality guarantees cannot bootstrap that authority.
