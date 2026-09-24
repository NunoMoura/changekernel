# ChangeKernel source-development handoff

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns procedure, and Git preserves completed reviews. Never govern this checkout with mutable checkout bytes.

## R5 assignments released — awaiting worker execution

**Manager verdict: shared baseline accepted; R5-A and R5-B released for implementation, not accepted.** Both external worktrees are prepared with committed assignments. No worker process was launched by the manager; the next action is to start the two worker sessions in their assigned worktrees.

- Manager: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.
- Exact shared source base for both workers: **`552cab992b5efdd8fffebeaea97d42042bc95957`**.
- Policy and frozen interfaces: [native private continuation profile](.changekernel/wiki/items/system/components/state.md#native-private-continuation-profile), [v1 API/storage contract](.changekernel/wiki/items/system/components/state.md#native-continuation-api-and-storage-v1).

| Slice | Branch / external worktree | Initial assignment commit |
| --- | --- | --- |
| R5-A: file-candidate custody | `work/native-file-candidates` — `/home/canina7/Projects/changekernel-workers/native-file-candidates` | `b41b375833f9aea917345076465d691793c7603c` |
| R5-B: intent-revision appends | `work/native-intent-revisions` — `/home/canina7/Projects/changekernel-workers/native-intent-revisions` | `644b2aa5cf359790a31209a6c0717cf3989c43cc` |

Each assignment commit changes only its own `CHANGEKERNEL_STATUS.md` from the exact shared base. Read the full assignment there. Source bytes are identical at release, and neither slice depends on the other's unreviewed implementation.

## Shared review and evidence

The paused checkpoint was `8e8621a19b114238e57e1b03ee348dafbff7ce71`. Review found a shared-store defect: surviving intent rows could allow recreation of a lost original intake with different text. The new regression reproduced an incorrect successful receipt. Commit `552cab992` repairs it: genesis refuses surviving Change-bound continuation artifacts, and authorized reads classify surviving custody with missing original/retry rows as unavailable. Other actors remain denied. No schema, public API or identity encoding changed; the private `authorized_receipt` helper now takes the known profile flag.

- `cargo test --locked`: **25 passed** (prior 20 plus five shared continuation tests); doctests included, currently none.
- `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `git diff --check`: passed.
- Active LSP checks on the changed Rust paths and handoff: clean. No cached-only cleanliness claim.
- Before-fix reproduction: `/tmp/changekernel-r5-genesis-before.log`; final checks: `/tmp/changekernel-r5-dispatch-checks.log`.
- Worker requirement links resolve. Assignment commits and source equality were checked. Manifests/dependencies/lockfiles, existing intake corpora and TypeScript were unchanged by the repair. No npm campaign was required.

The baseline implements explicit continuation initialization, atomic revision-zero custody, bounded verified intent-history/head reads, transaction-local guards, versioned native types/ports and generic application coordination. `FileCandidateStore for SqliteIntake` and `IntentRevisionStore for SqliteIntake` are intentionally not implemented yet; there are no placeholder success paths. Full concrete feature behavior remains unverified until worker submissions and combined review.

## Ownership and acceptance boundary

- **R5-A writes:** `src/adapters/sqlite/file_candidate.rs` (except frozen `SCHEMA`), internal implementation in `src/application/file_candidate.rs` and `src/kernel/state/file_candidate.rs`, `tests/native_file_candidate.rs`, and its own handoff. Public signatures/types, encodings, bounds and policy/retry semantics remain frozen.
- **R5-B writes:** `src/adapters/sqlite/intent.rs` (except frozen `SCHEMA`), internal implementation in `src/application/intent.rs`, `tests/native_intent_revision.rs`, and its own handoff. Kernel intent types/helpers are read-only.
- **Manager owns:** shared schema/constants, `src/adapters/sqlite/continuation.rs`, existing intake, all ports, composition/exports, manifests/lockfiles, existing tests/corpora and Wiki. Any shared defect/interface change must return to the manager before affected work continues.
- New worker integration tests use ordinary Cargo root auto-discovery. No shared manifest edits, extra frameworks, custom runners, parity suites or compiler-invariant tests. No npm gate for these Rust-only slices.
- Both workers must return exact code revisions, actual results and gaps, with status-only reports kept separate. They must not merge, rebase, switch branches, push, self-approve or start another slice.

## Manager next actions

1. Start the two worker sessions in the paths above; each reads its local `AGENTS.md` and `CHANGEKERNEL_STATUS.md` and verifies branch/worktree before editing. Do not resume implementation on the completed R4 branches.
2. Independently review exact submissions, check owned-path/schema/interface boundaries, and run relevant native gates and active diagnostics. Return defects to the worker with paths and explicit findings; do not merge handoffs wholesale.
3. After source integration, verify the combined candidate-preparation versus intent-revision race using both actual writers, historical candidate custody after head advancement, current policy on retry/delivery, and unchanged intake behavior. A's controlled head-change fixture is not evidence for the combined real-writer race. No duplicate permanent challenge suite is required.
4. Record separate and combined verdicts. Dispatch, source acceptance and passing tests are not exact-release qualification, activation or explicit external-controller handoff.

## Preserved history and gaps

R4-A/B are accepted and finished. Prior accepted integration: `034141eea193eb155a9ffba5582df89cfea00dfc`; detailed verdicts/evidence remain at `9abfac4b2:CHANGEKERNEL_STATUS.md`. The unexplained initial R4-A test summary did not recur in three manager runs or combined checks; its cause remains unknown. Investigate only if new actionable evidence appears.

The first continuation profile permits owner-only private intent/candidate custody under current host retention/delivery grants, protected retention without automatic expiry, and no admission/delegation/execution authority. Decision/Work, operator transport, producer/Check execution, publication/recovery, physical power-loss qualification and controller adoption remain separate capabilities. Do not turn retired TypeScript features into an implicit porting backlog or govern this checkout with its mutable code.
