# ChangeKernel source-development handoff

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design and its dependency gates, [AGENTS.md](AGENTS.md) owns procedure, and Git preserves completed reviews. Never govern this checkout with mutable checkout bytes.

## Design confirmed; dependent implementation gated

The user approved the consolidated Workspace/State/Change/user-Kernel model, three-stage pipeline, file-first Change Trace custody, cardinalities, borrowing, forks and routing. Canonical requirements now live in the [primary design](.changekernel/wiki/items/product/changekernel.md), [State](.changekernel/wiki/items/system/components/state.md), [Checks](.changekernel/wiki/items/system/components/checks.md), [execution](.changekernel/wiki/items/system/components/agent-execution.md) and [package](.changekernel/wiki/items/system/components/package.md) contracts; README summarizes rather than creating another specification.

**Dependency verdict:** no conflict found in the agreed primitives and relationships, but durability, exclusive borrowing, confidential sharing and aggregate safety depend on unresolved protocols. The [dependency-gated implementation plan](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation) records each prerequisite and blocked capability. Resolve and review the affected contract before its interfaces, formats or implementation are assigned. If it cannot preserve an agreed invariant, return the tradeoff to the user. A smaller qualified profile may leave other capabilities unavailable; it may not approximate their guarantees.

This documentation supersedes the prior database-default/Container/two-phase desired direction, not existing native protocol meanings. There is no implicit migration, JSONL dual-writing, release qualification, activation or controller handoff. No runtime source, tests, dependencies, manifests, archives or governed lifecycle records changed in this consolidation.

## Reviewed and integrated source

Manager worktree: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Shared R5 source base: `552cab992b5efdd8fffebeaea97d42042bc95957`. Latest executable integration checkpoint: `0b1b434ab`.

| Slice | Reviewed repair / report | Manager verdict |
| --- | --- | --- |
| R5-A: file-candidate custody | `5f674977162a3c7bd0b52617caec24bcdd875381` / `fc7351314cdf14802a9bbfa2f40e378cdffdf60f` | **A1 repair accepted; slice blocked** on shared retained attribution. Candidate source unintegrated. Handoff: `f65d52a2587405c283ca485c72ac8da86549beed`. |
| R5-B: intent appends | `2454cae3ecb6624f4a8f9da6849b6177f5e45ea6` / `be342869c381408a576f89249297258d987cd222` | **Accepted and integrated** as `a31694929` and `0b1b434ab`. Handoff: `7420ba2b8ac05e1471d010c183cb3059dc3aa9f9`. |

The old R5 worktrees remain clean and stopped at the manager handoffs above: `work/native-file-candidates` at `/home/canina7/Projects/changekernel-workers/native-file-candidates`, and `work/native-intent-revisions` at `/home/canina7/Projects/changekernel-workers/native-intent-revisions`. They are not being rebased, repurposed or merged wholesale. The user's pasted worker messages predate these verdicts; neither worker owes the quoted R5 resubmission or resource-probe follow-up.

The accepted intent writer retains atomic immutable revision/retry/head updates and bounded corrupt-reference decoding. The accepted A1 repair bounds separate proposed/prior reconstruction budgets. Overall R5 and R5-A remain unaccepted: deliberate partial-custody damage can retain unattributed candidate path rows while allowing changed-intent original recreation. This is not demonstrated ordinary SQLite crash partial-commit failure. The [retained-attribution requirement](.changekernel/wiki/items/system/components/state.md#change-attribution-under-partial-custody-loss) remains; the new architecture does not repair or accept it.

## Recorded evidence and current checks

Git handoffs record repaired A/B/combined **35/33/43 native tests**, fmt/clippy, and **33 post-integration tests**. They also record the manager's successful 80 MiB candidate and 48 MiB retry-reference probes, real-writer history/race probes, and the remaining orphan-custody failure. The raw files formerly under `/tmp/changekernel-r5-resume.d3jiQN/` are now unavailable; do not describe them as freshly inspected or rerun. Detailed historical results, tooling gaps and corrected harness mistakes remain in `2728e8c4d:CHANGEKERNEL_STATUS.md` and the worker manager-verdict commits.

Fresh restart inspection confirmed both old worktree heads/cleanliness and repair ancestry. Integrated `src/adapters/sqlite/intent.rs` and `tests/native_intent_revision.rs` have identical Git blobs to reviewed B1; A's candidate source remains different/unintegrated. No executable/manifests delta exists since `0b1b434ab`. Native tests were not rerun for handoff preparation. The design checkpoint `5ca3a90e7` separately records successful Markdown/link/whitespace checks, not runtime qualification.

R6 setup checks passed: correct fresh branches/base ancestry, assignment-only commits and clean worker trees; 22 local links/anchors resolved across the three handoffs; active Markdown diagnostics found no issues; `git diff --check` passed. No source implementation, dependency change, worker process launch or acceptance is implied.

## R6 — ready contract/probe assignments

The user can supply up to ten parallel agents. Use **two workers now**, plus manager integration/review: the shared identity/Trace contracts are not frozen, so ten production-code assignments would be speculative. The following branches were created from the agreed design/source checkpoint `5ca3a90e7c6cd46f70ec51e3db7b77dd2f271323`. Assignment commits change only each worker's own handoff. Agent processes have not been launched by the manager.

| Worker | Branch / external worktree | Assignment revision and outcome |
| --- | --- | --- |
| R6-A | `work/workspace-boundary-contract` — `/home/canina7/Projects/changekernel-workers/workspace-boundary-contract` | `ec8ad0330f607500decf2141b976df3a95c8aa13`; [full assignment](../workspace-boundary-contract/CHANGEKERNEL_STATUS.md): recommend the minimal Workspace/identity/user-folder/native-enforcement profile and expose its assumptions. |
| R6-B | `work/file-trace-protocol` — `/home/canina7/Projects/changekernel-workers/file-trace-protocol` | `f4eff4e1fe6197eaf63178b7851feadc650552ea`; [full assignment](../file-trace-protocol/CHANGEKERNEL_STATUS.md): recommend a concrete local Trace/Git write, acknowledgment, retry and recovery protocol with bounded probes. |

Both are **ready for investigation only**, not accepted design or production implementation. Each owns only its own `CHANGEKERNEL_STATUS.md`; probe artifacts stay in disposable external directories. No Wiki, source, tests, dependencies, schema/API or lockfile edits are assigned. A owns identity/enforcement analysis; B treats those references as opaque trusted inputs and reports its required assumptions. This permits parallel investigation, not parallel freezing of dependent interfaces. Missing overlap/assumptions return to the manager. Return committed reports, reproducible evidence and gaps; no self-approval or next slice.

## Manager next action and scaling

1. While R6 investigations run, prepare the compatibility/R5 disposition and shared-boundary integration questions. Keep the canonical [dependency plan](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation) as design truth; do not create another roadmap or prematurely extend SQLite. If that profile continues, its manager-owned successor attribution repair and combined acceptance remain prerequisites. No automatic migration, guessed recovery, broad quarantine or claim that A is integrated is authorized.
2. Independently review both reports, reproduce consequential probes, reconcile the identity/storage assumptions and resolve any product/safety tradeoff with the user. Record verdicts and adopt agreed contracts in Wiki before freezing source interfaces. Shared formats, manifests, lockfiles and composition keep one manager owner.
3. After those gates are ready, consider a modest implementation wave around separate Workspace binding, Trace codec/replay, protected filesystem persistence and Kernel/lifecycle responsibilities. These are candidate lanes, not assignments; split only after their interfaces and acceptance checks are agreed. Add read-only query/UI or later execution/effect lanes only when their own prerequisites are ready.
4. Scale toward ten only when there are that many ready, non-overlapping scopes and enough independent review/integration capacity. Workers must not invent shared interfaces to stay busy. Qualification, activation and controller handoff remain separate from source acceptance.

R4-A/B remain accepted and finished. Prior verdicts and the unexplained initial A test summary remain at `9abfac4b2:CHANGEKERNEL_STATUS.md`; reopen only with new actionable evidence.
