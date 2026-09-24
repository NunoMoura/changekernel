# ChangeKernel source-development status

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns source procedure, and Git preserves completed reviews. Change and Work own execution state after adoption.

## Current checkpoint and testing decision

- **Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.
- **Accepted native intake:** `853fcf65e7ebfee85b87225e4f01d95cbc676e5f`. Test cleanup is committed at `114a099bd`; the tested, adapter-only npm entrypoint/build boundary is `416c79d8211580fec5e5ec1b8cb425ba58f76d21`. The Node launcher and historical engine exports are removed. Source observation remains unaccepted pending the manager's repairs.
- **User-approved test scope:** Rust engine → Rust tests; retained TypeScript integrations → TypeScript-side tests; compile-time invariants → compiler feedback, not runtime tests. The researched [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy) replaces blanket legacy-suite gates in earlier assignments.
- **Cleanup:** removed 64 legacy JavaScript suites and 8 orphan helpers (72 files, about 13,000 lines). Removed TS engine/Git/Wiki/storage/CLI tests, Pi-named engine compositions, source/import inventories, document assertions and Node tests of native metadata. Git retains their history; they are not a Rust parity backlog.
- **Retained:** four Pi model/provider/session/protocol suites and two helpers; all three existing Rust test targets and both intake JSON corpora. Session fixtures now provide an incoming host contract without calling retired TypeScript authorization policy. `npm test` checks only the narrow adapter closure and runs 70 tests, down from 660; it no longer builds the historical TS engine. `tsconfig.adapters.json` excludes retired engine entrypoints, with existing codec/identity helpers reached only as adapter dependencies.
- **Native gate:** `cargo test --locked` (unit, integration and documentation tests); fmt/clippy before acceptance. No npm requirement for Rust-only work, additional test framework, custom runner, blanket parity/coverage target, duplicate permanent review suite or mandatory mutation ritual. Native runtime regressions for consequential failures remain required.
- **Cleanup checks:** `npm test` passes all 70 adapter tests; `cargo test --locked` passes all 10 native tests (documentation tests enabled, currently none); fmt and clippy pass. Active LSP checks for the changed adapter fixture and JSON configs report clean. Local-import closure and active Markdown link checks pass. Local logs: `/tmp/changekernel-narrow-adapter-tests.log` and `/tmp/changekernel-narrow-native-tests.log`.
- **Limits:** retirement does not implement or qualify removed capabilities. Remaining historical TypeScript sources are being deleted in the two independent assignments below; the package builds only retained adapters. No live inference, packaging, activation or controller operation was performed. Never govern this checkout with mutable checkout bytes.

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

## Manager work: source-observation repairs

The user requested new parallel worker slices while the manager fixes the bugs. R3-A is reassigned to the manager in the integration worktree; R3-B's duplicate test suite remains withdrawn. Both old worker trees were clean before handoff. Stop notices are committed at `50e9f7d5e` and `e3fa9a521`; do not write overlapping repairs there.

- Compose only the native source-observation files from `28c02e65c12da3c8e0c792e9832cd1177e01ef61` with accepted intake; never restore retired Node tests or older intake code. This is provisional composition, not acceptance of the defective submission.
- Repair F1–F3 without changing the public API/profile: verified selected commit/tree/blob bytes, settled subprocess custody, operational unavailability versus genuine denial. Preserve literal absence, bounds and read-only behavior.
- Requirements: [source custody](.changekernel/wiki/items/system/components/state.md#sources-observations-and-retained-research), [native observation](.changekernel/wiki/items/system/components/state.md#native-committed-source-observations), [cleanup/cancellation](.changekernel/wiki/items/system/components/agent-execution.md#time-bounds-cancellation-and-output).
- Checks: focused existing-target regressions and independent disposable probes, `cargo test --locked`, fmt, clippy, active diagnostics and `git diff --check`. No extra framework, suite or npm gate for the Rust changes. Acceptance still precedes dependent candidate custody.

## Ready worker assignments: R4

Both worktrees were created from exact base `416c79d8211580fec5e5ec1b8cb425ba58f76d21`. Its adapter typecheck, 70 tests, adapter artifact build and active LSP checks passed. `src/index.ts`, package metadata and build roots are frozen; the manager owns shared metadata and documentation. No worker session was launched by this handoff. Dispatch is not acceptance.

| Worker | Branch and worktree | Assignment-only revision | Exclusive outcome |
| --- | --- | --- | --- |
| A / R4-A | `work/retire-ts-host`, `/home/canina7/Projects/changekernel-workers/retire-ts-host` | `e17b4a24992802b3b1913f128435ee6e0d5d839e` | Remove historical TS server/API, non-Pi adapters, product policy and four unused host/storage ports. |
| B / R4-B | `work/retire-ts-kernel`, `/home/canina7/Projects/changekernel-workers/retire-ts-kernel` | `2a6de5c0d93bc60faa8635f28d93650f4637c0c8` | Remove obsolete TS kernel/identity machinery, three Pi-named engine compositions and the agent-output port. |

Their own `CHANGEKERNEL_STATUS.md` files enumerate exact owned paths and the frozen 14-file adapter dependency closure plus entrypoint. All Rust files, retained adapters/ports/codecs, tests, manifests, lockfiles and documentation are read-only to workers. Never delete a mixed-language directory. Stop on any retained import of a proposed removal; do not widen scope or change wire semantics. Retired cross-slice callers are removed when the two disjoint slices are combined.

Requirements: [historical retirement](.changekernel/wiki/items/system/components/package.md#versioning-and-historical-interpretation), [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy), [supporting package boundary](.changekernel/wiki/items/system/components/package.md#native-rust-bootstrap). Checks: retained import-closure review, `npm test`, `npm run build`, `git diff --check`; no native campaign for unchanged Rust or new inventory tests. Return exact revisions, actual checks and gaps; no self-approval. The manager reviews each return and the combined result, then removes unused package dependencies and stale active documentation links if appropriate.

## Ownership and next gates

- **Manager only:** shared contracts, composition, manifests, lockfiles, test registration and consolidated status. Worker handoff files are not merged wholesale.
- **Native candidate custody:** held until source observation passes review and its exact ownership/retention/current-authority interface is agreed. Then assign a cohesive native slice, not a TypeScript parity project.
- **Intent/Decision/Work:** held for an explicit versioned two-phase contract and agreed authorization/delegation policy. Escalate unresolved product intent to the user; do not silently port historical stage policy.
- **First self-development release:** prioritize the smallest complete bounded path in the [package contract](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus), not a broad integration catalogue or generalized framework.
- **Qualification, activation and controller handoff:** still separate exact-subject gates. Only a qualified immutable external release with explicit handoff may govern a later candidate; passing source tests or the engine's intended quality guarantees cannot bootstrap that authority.
