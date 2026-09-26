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

Worker branches/worktrees remain `work/native-file-candidates` at `/home/canina7/Projects/changekernel-workers/native-file-candidates` and `work/native-intent-revisions` at `/home/canina7/Projects/changekernel-workers/native-intent-revisions`. Both remain stopped. No new implementation, rebase, branch switch, merge or push is assigned; worker handoffs were not merged wholesale.

The accepted intent writer retains atomic immutable revision/retry/head updates and bounded corrupt-reference decoding. The accepted A1 repair bounds separate proposed/prior reconstruction budgets. Overall R5 and R5-A remain unaccepted: deliberate partial-custody damage can retain unattributed candidate path rows while allowing changed-intent original recreation. This is not demonstrated ordinary SQLite crash partial-commit failure. The [retained-attribution requirement](.changekernel/wiki/items/system/components/state.md#change-attribution-under-partial-custody-loss) remains; the new architecture does not repair or accept it.

## Recorded evidence and current checks

Historical review evidence remains at `/tmp/changekernel-r5-resume.d3jiQN/` and in `2728e8c4d:CHANGEKERNEL_STATUS.md`: repaired A/B/combined source passed **35/33/43 native tests**, fmt and clippy; integrated source passed **33 tests**. Bounded-allocation probes and real-writer history/race checks passed, while the orphan-path probe reproduced the shared defect. Rust/Cargo 1.88.0 compiled and executed that source. A's LSP findings were inconsistent with compilation; no global analyzer-clean claim. Detailed logs and corrected manager-harness mistakes remain in the historical handoff.

These runtime checks were not rerun for documentation-only changes. Active Markdown diagnostics passed on all seven changed files; 78 local links/anchors across those files and AGENTS resolved; `git diff --check` passed. Review found superseded terms only in explicitly historical/current bounded-profile contexts. Native profile bodies, historical candidate contract text and Wiki provenance metadata were compared with HEAD and preserved exactly; executable files, manifests, archives and governed records are unchanged. No new runtime or release claim follows from these checks.

## Next action — contract-first, manager-owned

1. Resolve the first bounded Workspace/identity and file-first Trace/Git profile contracts, including protected ownership, durable acknowledgment, exact replay/retries and writer/restart behavior. Then settle Kernel/lifecycle/reference interfaces before dependent source work. The Wiki dependency plan owns durable requirements, not this handoff.
2. Explicitly decide compatibility and the disposition of paused SQLite continuation work before further schema extension or R5-A integration. If that profile continues, its manager-owned successor attribution repair and combined acceptance remain prerequisites; neither automatic upgrade, guessed recovery nor broad quarantine is authorized. Do not silently discard the finding or count reviewed candidate source as integrated.
3. Dispatch only ready, non-overlapping slices with agreed shared interfaces and explicit checks. Keep immutable release qualification and controller handoff separate from source acceptance. No worker starts a next slice from this note alone.

R4-A/B remain accepted and finished. Prior verdicts and the unexplained initial A test summary remain at `9abfac4b2:CHANGEKERNEL_STATUS.md`; reopen only with new actionable evidence.
