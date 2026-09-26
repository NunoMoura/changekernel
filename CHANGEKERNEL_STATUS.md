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

## R6 — investigations accepted; contract adoption blocked

Both workers completed the assigned contract/probe investigation from source/design base `5ca3a90e7c6cd46f70ec51e3db7b77dd2f271323`. The manager independently reviewed the submitted reports and disposable sources, verified assignment ancestry/report-only deltas and clean worktrees, and reran the consequential probes. **Both investigations are accepted within that bounded scope. No production profile, schema/API, implementation or qualification is accepted.** Both workers remain stopped; no resubmission or next slice is assigned. Their handoffs were not merged wholesale.

| Worker | Branch / external worktree | Reviewed report and verdict |
| --- | --- | --- |
| R6-A | `work/workspace-boundary-contract` — `/home/canina7/Projects/changekernel-workers/workspace-boundary-contract` | `0fb24d57521c630b6b41d633f4c1be4f5191f1f8`; [report and manager verdict](../workspace-boundary-contract/CHANGEKERNEL_STATUS.md). **Accepted investigation**; concrete identity/enforcement profile adoption remains blocked. Assignment: `ec8ad0330f607500decf2141b976df3a95c8aa13`. |
| R6-B | `work/file-trace-protocol` — `/home/canina7/Projects/changekernel-workers/file-trace-protocol` | `99184942f99ff4f52b6ecd535f47cec177b5aa65`; [report and manager verdict](../file-trace-protocol/CHANGEKERNEL_STATUS.md). **Accepted investigation**; Trace/acknowledgment/recovery contract adoption remains blocked. Assignment: `f4eff4e1fe6197eaf63178b7851feadc650552ea`. |

### Independent evidence and findings

Fresh evidence is at `/home/canina7/.local/state/ck-r6-manager-review.pTkbUp/`, with exact copied-source hashes in `sources.sha256` and tools/filesystem in `platform.txt`. Worker originals were preserved. A's copied `probe.py` matched SHA-256 `cc434c5509f5b87e4c701f926a2cc37c4d50d382505689c2a4cebafd2f974f60`; `timeout -k 2s 20s python3 A/probe.py` reproduced the reported same-UID overwrite, peer credentials, symlink/path-resolution and pinned-object-after-rename observations, plus editable Git authorship (`A-results.txt`). `openat2` blocked the tested traversals, not every race or alias.

For B, fresh copied Cargo inputs and fixtures passed all five process/fixture tests using `PROBE_FIXTURES="$PWD/fixtures" CARGO_TARGET_DIR="$PWD/target" timeout -k 5s 90s cargo test --locked --offline --test protocol -- --nocapture --test-threads=1` in the manager `B/` directory (`B-results.txt`). Rust/Cargo 1.88.0, Python 3.14.7, Git 2.55.0, Linux 7.2.5-4-omarchy x86_64 and local Btrfs were used. A separate two-commit Git fixture moved `refs/heads/accepted` backward with the correct expected-old OID, and `git fsck` still passed (`git-results.txt`). Git CAS alone does not enforce monotonic acceptance.

`review_limits.py` challenged B's unchanged stub further (`limits-results.txt`): changing the expected head on a same-payload retry returned `REPLAY`, so the stub does not prove the proposed full retry-input/result binding. After acknowledging `r1`, restoring both original log and checkpoint in the same directory while leaving the lock intact made inspection accept count 1; `r1` with changed payload then received a new `ACK` at count 2. This demonstrates indistinguishable full-custody rollback, not an ordinary crash or a source effect. Reproduction needs only `init`, saved original `trace`/`head` bytes, one `append`, restoration of both saved files, `inspect`, and a changed-payload `append` under the original expected head. The permissive parser and authorization stub remain disposable mechanics, not code to adopt as a codec or authority boundary.

No power-loss, storage-error, backup, host authentication, worker containment, guarded source publication or release proof follows from these checks. Project Cargo/npm suites were not run because no executable project source changed. Detailed worker and manager reports preserve concrete outputs/gaps if external evidence later disappears. Review handoff validation passed: three active Markdown checks with zero diagnostics, 30 local links/anchors, whitespace checks, and only the owned handoff changed in each tree. Probe input hashes still matched after execution; project source, tests, Wiki, manifests, archives and governed records were untouched.

## Pending user decision and manager next action

The manager recommends the following **bounded first-profile assumptions**, but they are not yet adopted design. Resolve the threat/failure model with the user, then apply the canonical [dependency gates](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation):

1. Trust the host OS/account and its protected control storage. Unrelated hostile same-UID processes and privileged host compromise are outside that initial profile; do not claim mode `0600`, a library or path checks resist them. **Untrusted ChangeKernel workers and Checks are not excluded from the threat model:** qualify their isolation and guarded routes before enabling arbitrary execution. For native source State, direct outside writers are a separate drift/guard problem, not permission to treat lost Trace custody as ordinary drift.
2. Treat the Trace as lifecycle history and its protected checkpoint as non-rebuildable accepted-prefix control, not a second history/cache. Prefer Git as checkpoint evidence/transport, not local acceptance. Declare ordinary-restart assumptions explicitly. Refuse active copied/restored input without independently surviving current custody evidence; do not claim automatic detection of an unannounced rollback of the entire custody domain. Whole-domain rollback resistance needs a separately qualified surviving anchor and is outside the recommended initial profile.
3. A typed-only custody/observation milestone can precede worker/publication qualification, but it does not replace the agreed [first self-development delivery](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus). Remote borrowing/import/encryption remain unavailable rather than approximated.

After that decision, the manager must settle concrete authentication and principal/folder/Change association; creation/registration crash windows (including directory-entry persistence); exact envelope/retry/result subjects; supported filesystem/error/barrier recovery; suffix-reconciliation control; and explicit SQLite continuation/non-migration disposition. Keep old R5 findings visible: if SQLite candidate work continues, successor attribution repair and combined acceptance still precede A's integration. No automatic upgrade, guessed recovery, broad quarantine, source rename or revival of retired code is authorized.

Only after reviewed contracts are adopted in Wiki and shared interfaces have one owner should implementation branches be prepared. Workspace binding, Trace codec/replay, protected filesystem persistence and Kernel/lifecycle remain candidate lanes, not ready assignments; later views/execution/effects have further gates. Up to ten agents are available, not a target. No new production assignment, dependency, format or controller authority is granted by this review.

R4-A/B remain accepted and finished. Prior verdicts and the unexplained initial A test summary remain at `9abfac4b2:CHANGEKERNEL_STATUS.md`; reopen only with new actionable evidence.
