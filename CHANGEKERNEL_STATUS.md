# ChangeKernel temporary status

## Current gate — combined R23 candidate; acceptance blocked

**Verdict: blocked pending exact-subject intent-fixture re-review and combined-result checks.** Provisional combined source checkpoint: `6a28ef80bd559165baf5eeaf80184088e62d8c56`. It is reproducible candidate source, not accepted R23, Phase-1 completion, release/host qualification or controller handoff. No dependent slice is released.

R21's bounded opening remains accepted at `b6bbee2f63998873bbceac17d3ea918e7d8c9008`. R22's fresh-only successor contract was adopted at `10aa1e5ea5dd71fd676768805196db0ce2169d70`; [the intent profile](.changekernel/wiki/items/system/components/intent-trace.md) remains normative. Native State stays native; accepted Trace records are Change history, not a second lifecycle database. Durable requirements stay in Wiki; completed handoffs remain in Git.

## Exact source and review lineage

| Subject | Exact revision / disposition |
| --- | --- |
| Original implementation assignment | `d933824c600f64234916fe6b57c11f68229093a8:CHANGEKERNEL_STATUS.md` |
| Original code / report | `21ca93aac5bd606d65bfb5d0851955ae9bcdb096` / `cde90af17b58df181a99a9dd0a065f11561820a6` |
| First challenge / wording erratum | `a8125efa63a0621a9b13984f0f5ae6fbbcf03233` / `1d7a859943c70059472f38471e4a680eb0549952` |
| Accounting correction assignment | `0757e23e0a663741d1be7028bac22b6762e065b6:CHANGEKERNEL_STATUS.md` |
| Accounting code / report | `800a9cde0e4836b427bb83c53ef91b99573423d2` / `93ac076ed32f7b7904bdf1dedbd5cd7085b513ee` |
| R23-V2 assignment / review with addendum | `75b600a826285e6b0b3b8f80f99df942df82594b` / `497847483650bc49129356e2fc8e55ccd3f68691`; review accepted, F1 closed, fixture F2 changes requested |
| Manager combined failure | `f6e81ab790fc47e0d985ba815d1d0b1d0f524052:CHANGEKERNEL_STATUS.md` |
| Intent fixture correction / packet diagnosis assignment | `c3943a7696562a8492c445e717fb485b1905d58d:CHANGEKERNEL_STATUS.md` |
| Intent fixture code / report | `d9d5f284468855eb1feb1e1ee1fefe5b3b1cd7d7` / `3269bcd11c403d1ce603cf2f5626ab42f429ceca` |
| Packet diagnosis / correction assignment | `ff76c2741dde11164519611d5a0f4befe695f275` / `1a02d2b28917020cadffb6ec21d434253051b859`; diagnosis accepted, test-only fix explicitly authorized |
| Packet fixture code / report | `608e06142bd6dd5630e5d58a6372b2f399bb1090` / `a4e2ccf204ff8400a5dbab0081a0071694e4f472` |
| Provisional combined candidate | `6a28ef80bd559165baf5eeaf80184088e62d8c56` |

The manager selected exact source/test bytes, never worker status files. All eight production paths match the accounting subject `93ac076ed…`; `tests/file_first_intent.rs` matches `d9d5f284…`; `tests/native_local_packet.rs` matches separately authorized `608e0614…`. The ten-path combined commit changes no other tests, manifest, dependency, lockfile, Wiki or settings. Existing R21 APIs, opening bytes and custody profiles, and packet production semantics are unchanged.

## Findings closed or awaiting final evidence

**F1 accounting is closed:** source review and production-consuming witnesses now count actual decoder/emitter attempts and completions separately, post-failure incident work, constructed controls, public errors and discarded private replies. No production code changed after that correction. The manager's five focused accounting tests and disposable strict predecessor-exit probes passed: 25 behavior/recovery invocations and 18 accounting invocations across nine cases. Parent never owned custody. File-read equations use inspected deterministic read sites and observed file lengths, not syscall tracing or nonexistent read hooks. Heap measurements are scoped requested bytes, not RSS; raw partial-syscall/disk traffic is not inferred.

**F2 intent fixture correction is submitted, not yet accepted:** the previous manager full native run failed at `tests/file_first_intent.rs:1109` with no incident evidence; an isolated pass did not cure it. Source review established that parallel test threads could own hosts while another test spawned and that a failed connection was mistaken for proof of a reached fault. New fixture code holds one whole-test standard-library mutex across every test entry and records selected/failed-retention hooks separately, with explicit connection prerequisites and full event diagnostics. Live latch, incident evidence and fresh reopen refusal checks remain. The original failure's precise errno/interleaving is not retrospectively established.

**Packet fixture correction has manager source review and focused checks; combined gate pending:** the previous independent full run observed closed-peer `Ok(())` at `tests/native_local_packet.rs:483`. Read-only diagnosis established unprotected lifetime/spawn and explicit CLOEXEC-clear windows, not a production defect or captured inherited descriptor. The sixteen-line test-only correction acquires one whole-test mutex at each of eleven ordinary tests. Manager independently read the changed regions and surrounding fixture/child/thread/drop bodies: guards cover allocations, flag-clear/spawn/restore, scoped joins and child exits; ignored process-local entries and all original assertions remain exact. Production `serve_one` still promises submission, not client receipt. The manager's ordinary-scheduled packet target passed once: eleven parent tests plus their exercised child helpers; no retry. This does not retrospectively prove the earlier failure's cause.

Both authors reported passing assigned focused/fmt/clippy/diagnostic checks. Intent author also reported one full default-scheduled native pass (214.464 seconds, twenty intent entries and unchanged compatibility targets). Packet author's full suite was explicitly deferred until combined intent correction, not falsely claimed. The manager is now running focused cleanup/accounting, one complete default-scheduled offline locked native gate, fmt/clippy and a standalone analyzer on the combined checkpoint. Any failed gate must be retained and investigated, not resampled until green.

## R23-V3 — Independent intent-fixture re-review

**Prepared, not yet dispatched.** Reuse the current packet-fix author for independent review of the *other author's intent correction only*, after graceful process exit and fresh candidate-based worktree launch. The manager, not that worker, independently reviews the packet correction. No independent self-review is claimed.

- **Branch/worktree:** `work/r23-fixture-review`; `/home/canina7/Projects/changekernel-workers/r23-fixture-review`.
- **Exact base and subject:** `6a28ef80bd559165baf5eeaf80184088e62d8c56`, provisional combined candidate. Verify native process cwd, actual session-header cwd, branch and clean exact checkpoint before explicit dispatch.
- **Owned writes:** only the reviewer's `CHANGEKERNEL_STATUS.md`. No source/test fixes, manifests/lockfiles, Wiki/settings, source branch movement, other-worktree edits or new framework. External scratch is not source truth.
- **Read:** complete intent correction report `3269bcd11c403d1ce603cf2f5626ab42f429ceca:CHANGEKERNEL_STATUS.md`; manager correction assignment `c3943a769…`; exact prior review/addendum `49784748…`; [intent acceptance witnesses](.changekernel/wiki/items/system/components/intent-trace.md#required-acceptance-witnesses), [opening profile](.changekernel/wiki/items/system/components/state.md#consumed-opening-profile), and [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy).
- **Outcome:** determine whether intent fixture F2 is closed without weakened witnesses. Review the entire `d9d5f284…` test delta and every relevant host/spawn/drop/child-entry path. Confirm every test entry obtains the same whole-test guard before ownership; helpers do not reacquire it; guards outlive all hosts and confirmed child exits. Preserve explicit local host drops; the mutex does not excuse an owning host in the spawning test itself. Check recovery setup versus actual injected refusal, distinct selected/retention observations, complete event diagnostics and retained live-latch/incident/reopen assertions. Confirm the corrections introduce no skip, retry, sleep, authority/storage behavior change, measurement weakening or unsupported causal claim.
- **Checks:** one `CARGO_NET_OFFLINE=true cargo test --locked --test file_first_intent -- --nocapture` under ordinary scheduling with enough time for about 200 seconds; fmt/clippy and available changed-path diagnostics/scope. The full combined native gate is manager-owned; no need to repeat unrelated targets or build/npm rituals. No intentionally owning-host-fork/descriptor-inheritance experiment. Record any failure and stop for coordination rather than retrying it away.
- **Return:** exact report revision, `no remaining blocker`, `changes requested` or `blocked`, concrete findings, actual checks and limits. Explicitly distinguish independent intent review from your authored packet correction and manager's combined gate. Commit only the report with hooks disabled and stop. No source acceptance, next slice or delegated worker; manager alone accepts/advances.

No dependency acquisition, settings/tool repair, controller activation, privileged/provider/model/Check experiment, branch switch/rebase/merge/push or other-pane messages are authorized. This remains ordinary Pi-native source development, not use of mutable checkout as controller.

## Diagnostics and retained limits

The combined test-path Pi probe reported stale-looking `E0609` findings for accounting fields that exist in the exact current `IntentWork` source and were compiled/exercised by native tests and standalone production-consumer probes. That is an analyzer discrepancy, not a clean verdict or demonstrated source failure. The packet probe had no visible source findings; the tool also noted two suppressed findings without establishing a clean verdict for those locations. No suppression, settings repair or cause is claimed. A fresh active/standalone check accompanies combined native verification; the previously stale review graph is not source-health evidence.

The selected profile is fresh-only on one trusted Linux host, fixed authenticated owner/Workspace/binding/slot, cooperative exclusive custody, 128 records and 16 MiB accepted bytes. Reads/retries preserve original and intervening intent; queries do not append. R21 custody is not migrated, copied into continuing custody, rewritten or dual-written. There are no native effects, models, Check execution, multi-Change ledger, archive/transfer or mandatory Stage/workflow. Requested-heap/byte/pass measurements are bounded fixture evidence, not general cold/warm ledger efficiency or power-loss/hostile-host qualification.

Manager: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Intent author: `work/r23-intent-trace` at report `3269bcd11c403d1ce603cf2f5626ab42f429ceca`, parked. Packet author: `work/r23-accounting-review` at report `a4e2ccf204ff8400a5dbab0081a0071694e4f472`, parked pending verified R23-V3 relaunch. Pool remains eight, including R20-P/R20-V and four older parked sessions. Historical worktrees do not add live workers. Routing/acknowledgments stay outside Git.

After acceptance, the next consumed [Phase-1](.changekernel/wiki/items/product/plan.md#phase-1--a-durable-inspectable-change-without-effects) contract can be prepared under the [foundation gate](.changekernel/wiki/items/product/plan.md#foundations-before-agent-integration). No dependent assignment is active yet.
