# ChangeKernel temporary status

## Current gate — R30 candidate review, changes requested

The user authorized the deterministic backend foundation and developer workers. The [combined ledger history/context contract](.changekernel/wiki/items/system/components/ledger-history.md) was adopted at `25e3cfdd33e496156c2b2b6baf94dd5d6f93e3be`. No implementation, release or controller is accepted by this status.

Manager worktree `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Keep four managed slots, including parked sessions. Source and test ownership remains the exact R30 assignment at `00e2b392b3acc6c53f7e7fa91abadf7237bcb329:CHANGEKERNEL_STATUS.md`; source continuation is `72de4f90a7022f070b4ef584c8104c955a9f1a92`. No additional/delegated workers, API changes, effects, credentials/inference, migration, manifests/settings, release/activation or controller operations. Never load this checkout as controller or use ChangeKernel wiki tools/commands.

## Exact submitted subject

- **Source and owned accounting tests:** `d891848502fc4c99553d00b479737841ba1842ed`; separate report `9005ccbabf37a7ce6052b7141e654a247c3ab94d:CHANGEKERNEL_STATUS.md`.
- **Source owner:** `work/r30-ledger-history-source`, `/home/canina7/Projects/changekernel-workers/r30-ledger-history-source`, clean submitted report checkpoint `9005ccbabf37a7ce6052b7141e654a247c3ab94d`. Continue fixes only after the exact manager dispatch below.
- **Lifecycle draft:** `c1f9327664e359f30b2d42546c2d56a1a30077f3:tests/ledger_history.rs`; report `e636a600d7f821ba1ff5125615dcf997689071bc:CHANGEKERNEL_STATUS.md`; branch/worktree `work/r30-history-consumer-tests`, `/home/canina7/Projects/changekernel-workers/r30-history-consumer-tests`.
- **Failure draft:** `f85448fb635c241187ed8337224baae7e01f1327:tests/ledger_history_failures.rs`; report `572a8e3f11d7dbf06bde8d8ed4a34d90f44b1ff7:CHANGEKERNEL_STATUS.md`; branch/worktree `work/r30-history-failure-tests`, `/home/canina7/Projects/changekernel-workers/r30-history-failure-tests`.

Manager verified native/session/worktree identity, clean submitted branches, source/report separation, whitespace and the 20 executable paths against the original ownership. No Wiki, manifest, lockfile, settings, AGENTS or governed-state change occurred. The candidate has a real host and seven methods, selected shared custody and longer-prefix/history/context code, not the earlier constructor fragment. Scope verification and worker-reported checks are not source acceptance.

The source report records full locked native tests, fmt and warnings-denied all-target clippy passing against its candidate, including 17 owned witnesses. It also preserves a first semantic-bound failure at 46 records (`676 > 672`), compiler/clippy failures, a wrong test-target name and wrong hook label. Their correction and all whole-call/custody claims still need independent review. The earlier constructor-only 180-second deadline remains incomplete without a returned exit code; later full runs do not erase it.

## Manager findings and checks

### R30-S1/S2 — closed on the exact candidate

The unchanged manager constructor probe from the failed `a8b838e3ada3f367d6cd0a13a756de29c6425fde` subject was rerun against `d891848502fc4c99553d00b479737841ba1842ed`: **two passes, exit 0**. Invalid UTF-8 paths of 2/4,083 bytes now observe field operand bytes **70/4,151**, words **60/60**. Valid 1/512-component paths observe attempts **204/2,759**, words **207/2,762** in the manager fixture. Its fixed anchor spelling differs from the worker fixture; these are actual manager receipts, not a claimed identical fixture. This closes only those two constructor omissions, not whole-call accounting or custody.

### R30-S3 — Metadata operations incorrectly require History

**Manager verdict: changes requested.** In `src/application/ledger_history.rs::dispatch`, `select_change` checks Metadata and then unconditionally checks History; cursor handling also adds History. In `src/adapters/jsonl/ledger/history/operations.rs::disclosure`, `metadata=true` still checks both, affecting initial/final Selection and listing eligibility/final/cursor checks. The adopted contract makes these operations Metadata-only. The old frozen profile must not be changed to repair the successor.

An exact overlay of failure draft `f85448fb635c241187ed8337224baae7e01f1327` compiled against the source candidate. Manager ran `cargo test --locked --test ledger_history_failures permitted_metadata_remains_available_when_history_is_denied -- --exact --nocapture`: **exit 101, one executed failure**. An otherwise authorized Selection returned `{"v":5,"kind":"error","code":"denied"}` instead of Selection. The failure happens before the test reaches listing; the listing defect is additionally established by the source path, not claimed as a separately executed assertion.

**R30-S correction:** repair the initial/final/eligibility/cursor gates for Metadata-only operations, preserving fresh principal checks and History/mutation gates for the operations that require them. Add/retain the appropriate owned regression and adjust observations to actual selected checks, not padding. Do not change the contract, old profile behavior, APIs or other workers' tests. Verify ordinary Selection and paged/cursor listing with History denied, plus true History denial and final Metadata/principal revocation. Submit a new exact source/test revision and separate focused report with actual tests/fmt/clippy and preserved first results, then park. Original source assignment and ownership apply. No full consumer release or integration of the failed candidate.

### R30-F2 — failure draft fails warnings-denied compilation

`tests/ledger_history_failures.rs:13` imports unused `io::Write`. Manager `cargo clippy --locked --test ledger_history_failures -- -D warnings` against exact `d8918485 + f85448fb6` exits **101**, with that unused import as the sole reported error.

**R30-F correction:** remove the unused import only; retain all semantic assertions, including the corrected Metadata-only witness. Owned writes remain `tests/ledger_history_failures.rs` and own status. Preserve the first draft/report and lint failure. For this correction only, an external exact `d891848502fc4c99553d00b479737841ba1842ed` archive plus exact corrected test bytes is selected for compile/clippy verification, not broad runtime execution or source acceptance. Run standalone fmt and locked warnings-denied clippy there; do not edit source or merge branches. Submit separate test/report successors and park. The known S3 source failure is not permission to weaken the test.

### Actual evidence and limits

Evidence root: `/home/canina7/.local/state/changekernel-source-review/r30-manager-candidate.w5hf_n42/`. It retains the immutable source archive, 20-path SHA manifest, author report, source delta, exact overlays, commands/logs/exits and first attempts. The first metadata test invocation guessed the wrong test name and executed **zero tests with 19 filtered out**; that exit 0 is not behavioral evidence. Its log is preserved. The actual test body/name was read before the exact failing rerun. An active four-path LSP probe reported no findings but confirmed no clean paths: one timeout and three silent-on-clean results. No full manager source suite, combined test acceptance, release or controller claim is made.

## R30-A — independent frozen-source review, not consumer release

- **Role/branch/worktree/base:** fourth reserved slot, `work/r30-history-accounting-review`, `/home/canina7/Projects/changekernel-workers/r30-history-accounting-review`, exact candidate `d891848502fc4c99553d00b479737841ba1842ed`.
- **Dispatch gate:** manager creates the exact-base worktree, stops the verified old parked process and relaunches from the new native cwd. Readiness-only first turn must corroborate native PID/cwd, persisted new-session header, tool cwd, branch/HEAD and clean Git before the separate exact review dispatch. No pool growth.
- **Owned writes:** own `CHANGEKERNEL_STATUS.md` only. No project source/test/Wiki/manifest/settings edits. Use narrowly justified disposable external probes for concrete risks; no parallel backend, validator, generic audit framework or changed acceptance criteria.
- **Subject:** frozen source `d891848502fc4c99553d00b479737841ba1842ed`, report `9005ccbabf37a7ce6052b7141e654a247c3ab94d:CHANGEKERNEL_STATUS.md`, adopted [profile](.changekernel/wiki/items/system/components/ledger-history.md), and this manager finding record. S3 is already a known blocker and being returned to the owner. Review the frozen subject independently; do not consume mutable sibling work or imply that pending corrections are accepted.
- **Outcome:** independently challenge cohesive shared custody versus copied/nested backends, immutable creation association and longer prefix, record/control canonical validation, pending/prospective/successor proof, exact authorized recovery, non-cleaning reads, scope-correct incidents, actual fresh authorization/reply cuts, limited/current/historical context, and constructor/host/thread ownership and observations. Pay special attention to shared legacy deltas, partially built/discarded owners, independent comparison operands, failed predicates, current versus retained Check calculations, semantic/uniqueness limits, full-list sweeps and named-owner overlap. The selected old/public APIs, bytes, errors, callbacks and observation meanings remain frozen; do not infer compatibility from a few passing tests.
- **Checks/report:** read the complete relevant source/delta and retained first failures. Run focused public/native/disposable witnesses and relevant `cargo test --locked`, fmt, locked warnings-denied all-target clippy as justified; preserve actual commands, subject identity, output, exit and deadline/process-cleanup limits. Do not claim full-suite completion from partial output or no analyzer errors from an inconclusive probe. Return path-level findings, concrete reproductions, closed versus unproved properties, actual checks/gaps and a report-only commit. Recommend scoped disposition; only the manager accepts. Submit and park. This is an independent review of a known-failing frozen candidate, not downstream implementation based on it.

## Held dependencies and next integration gate

R30-L stays parked. R30-F may perform only the F2 correction/compile check above, then parks. Broad lifecycle/failure suite execution and dependent changes remain paused on S3. R30-S owns source corrections; R30-A independently reviews the frozen candidate and must later account for any successor delta. No source/test bytes have been imported into integration.

After a corrected exact candidate clears the manager's blocking checks, separately release the two owners' external exact-source/test overlays. Retain their independent first results, return source defects to S and test defects to their owners, then form one exact combined candidate. Run native unit/integration/doc tests, fmt, locked warnings-denied all-target clippy and independent combined consumer/failure evidence before source acceptance. No npm gate for Rust-only work. Source acceptance does not authorize the later guarded real-world update, release/activation or controller handoff.

## Preserved history

The original assignment, constructor first failures, corrected-draft-only F1 disposition and earlier diagnostic/history limits remain at `253d5f5f7d419bfb0a85bc400189e8ebb90aa59d:CHANGEKERNEL_STATUS.md`. Constructor findings were returned at `4f996918bc00ca648a56805e2b837294b1532ebb`; F1 at `e9eb4c603b1afea28cfb4d62bc167b6207eb8617`. Do not erase or amend first submissions or merge worker status files wholesale. Routing/session/transport acknowledgments remain external.

Accepted executable remains R27 `a4fc984e5ffb69938f83e8bc75335f27b7986c90`; its exact bounded verdict and analyzer/missing-log/deadline/cooperative-custody/rollback/lost-observation limits remain at `4645a76914481490291fcaae0927260c43adc384:CHANGEKERNEL_STATUS.md`. R29's earlier incomplete 180-second baseline also remains incomplete. The Jev pilot budget is exhausted; report `26da6c0f02dd27a6806f88b8dc3293f9f4ad8c36:CHANGEKERNEL_STATUS.md`. No further inference, credentials, installs, private-data disclosure, production model integration or controller activity is authorized.
