# ChangeKernel temporary status

## Current gate — R30 review closed; exact integration and combined checks pending

The user renewed the existing backend review/integration scope. The [combined ledger history/context contract](.changekernel/wiki/items/system/components/ledger-history.md) remains adopted at `25e3cfdd33e496156c2b2b6baf94dd5d6f93e3be`. No R30 source, release or controller is accepted yet. Manager worktree is `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.

Keep the existing four worker slots, including parked source owner; no delegation or pool growth. Original ownership is `00e2b392b3acc6c53f7e7fa91abadf7237bcb329:CHANGEKERNEL_STATUS.md`. No changed API/requirements/budgets, manifests/settings, inference/credentials, effects, migration, release/activation or controller operations. Never load this checkout as controller or use ChangeKernel wiki tools/commands. The user owns any later real-world trial scope.

## Exact subjects

- **Corrected source and owned work tests:** `58a79c25125de3f81b29f684cc6eb8fee0e683a5`; report `88b93fe6a8d454673707f63daf272ede34f49f04:CHANGEKERNEL_STATUS.md`. Relative to `d891848502fc4c99553d00b479737841ba1842ed`, executable changes are exactly `src/adapters/jsonl/ledger/operations.rs`, `src/adapters/jsonl/ledger/history/sequential.rs`, and `tests/ledger_history_work.rs`. The report successor changes status only.
- **Lifecycle overlay:** unchanged `c1f9327664e359f30b2d42546c2d56a1a30077f3:tests/ledger_history.rs`, SHA-256 `54dd4749584b1b923cdae8665f08c597ce654b554d18b673edca4b2f42e6fb09`; previous execution report `f33b3edb45a58bb20a32a92d4a3395d6345c11a1:CHANGEKERNEL_STATUS.md`.
- **Failure overlay:** unchanged `1fe3cff61b12d03828a3432a2647a647467baf92:tests/ledger_history_failures.rs`, SHA-256 `02d5a4a6063c07c79c752d2df723880c180dc2c2828aa5295ae3350ecab7cba9`; previous execution report `03a83494c84d20ba7f61d6d9dc4e87f9d35d4e67:CHANGEKERNEL_STATUS.md`.
- **Previous independent review:** corrected report `316c8378e1a679a47cd8506b192f4c12ebf2dfe2:CHANGEKERNEL_STATUS.md`, preserving first report `c5222b2d911586a5c2ebcd5f8ee406adbb58f0a4`.

Manager reverified native process cwd/argv, `/proc` cwd, persisted session-header cwd, branches, exact submitted checkpoints and clean Git for all four workers and the manager before release. Routing/session/transport evidence stays outside Git. A message, idle state or process exit is not acceptance.

## Manager correction review and actual checks

**Disposition: select `58a79c25125de3f81b29f684cc6eb8fee0e683a5` provisionally for exact independent review and consumer verification; do not integrate or accept yet.**

Manager read the full correction report and complete executable delta, the affected creation function, permission helpers, member failure routing and pending-feasibility body against the adopted authorization/accounting contract. Scope/whitespace and source/report separation pass. Both cleanup gates are v5-only, before either cleanup, and use current collection Create, member Create/History and principal checks. The three KeyFeasibility predicates retain generation/actor/op short-circuit order; each entered string group now supplies its available range without rescanning or changing categories/ceilings. No new scoped static blocker was identified; independent review remains necessary.

Manager reran the **unchanged original public probe**, SHA-256 `e9b1e7d338f54db0031f2e62ca210d1dab62dee6051862560c5cea7cc9c19a82`, over an immutable external archive of this exact successor. `cargo test --locked --offline -- --nocapture`: **exit 0, two passes, no timeout** (12.19 seconds within 150 seconds).

- **A1 reproduction now passes:** Create revoked at the completed `checkpoint.tmp` read yields denied, cleanup attempts/completions **0/0**, and the original **280-byte** temporary remains present. The first failing predecessor deleted it before returning denied. This unchanged probe does not dynamically cover the anchor sibling; the new owned regression separately covers both remnant types and four revocation modes.
- **A2 reproduction now passes:** the 4,096-byte unequal pending actor yields unavailable with **4,096 operand bytes, two words, two completed predicates, one failed comparison**. Actor refusal prevents entering the opcode predicate. The new owned opcode-refusal case is separate evidence, not retroactive reachability of the old failure.

The source owner reports two new owned regressions passing (eight cleanup denial/recovery combinations, two actor refusals and a separate opcode refusal), legacy ledger 30 passes, full source-only **158 parent passes/zero failures/three existing ignored tests**, fmt/clippy exit 0. These remain reported evidence pending independent checks. First A1/A2 regression failures, the first incorrect anchor-fixture/scope failure and subsequent fixture-only correction are preserved in `/home/canina7/.local/state/changekernel-source-review/r30-s-A1A2.71qtuJjT/`.

Manager evidence: `/home/canina7/.local/state/changekernel-source-review/r30-manager-corrected.454xynf9/`. Exact archive SHA-256 `b6308b1a1519673dde091440e2798fa1b2927cc2d649c5769f483d51e915fdb0`; 125 archived regular files; source/report/delta/manifest and probe logs/exits retained. Initial active LSP search returned no matching symbols; direct structural/body reads supplied inspection evidence. Three changed Rust paths returned no findings but **all three were inconclusive silent-on-clean**, not confirmed clean. The cached cross-file graph remains stale and has no nodes for these external files.

## Manager verdict — A1/A2 closed; exact imports authorized

**Accepted for integration only:** source `58a79c25125de3f81b29f684cc6eb8fee0e683a5` and the two unchanged exact test overlays above. Final source acceptance remains blocked until the integrated combined gates pass.

- Independent correction review `4793fe23cfdc03cc1bfa5c1ee990aed581cb62b4:CHANGEKERNEL_STATUS.md` recommends bounded closure of A1/A2, with no new scoped blocker. Manager read the full report, reverified its native/session/branch/clean state and status-only successor delta, and verified its archive's 125 source files against the exact candidate.
- Manager independently ran `cargo test --locked --test ledger_history_work --test ledger_selection -- --nocapture`: **19 + 30 parent passes**, exit 0, 120.31 seconds within 180 seconds; fmt/clippy exit 0. The eight new cleanup combinations preserve both remnant types and restore same-host exact recovery; the actor/opcode cases reproduce the separately entered/refused scopes and expected counters. Nested legacy helper results are not extra parent passes.
- The reviewer identified an uncovered late **Unavailable** outcome and supplied one additional focused public probe, SHA-256 `31a46d38e48fb1de39a4f522489f732bdd31522627289dbbceb22a239a6745f7`. Manager read it in full and reran it unchanged: **one executed test, six combinations**, exit 0, no timeout, two included original tests filtered out. Both cleanup branches preserve bytes with collection Create, member Create or History unavailable; cleanup/retention/private-output attempts remain zero, and same-host authorized exact recovery succeeds. No new backend or validator was introduced. Manager evidence is `manager-unavailable-probe.log`/`.json` under the correction evidence root.
- L report `741c65b2d4f8a020dffba4342263d990d4a9243e:CHANGEKERNEL_STATUS.md`: **10 parent passes** (nine behavioral cases plus one inactive parent helper), fmt/clippy exit 0. F report `82ae16fbf28c13b8a7ce37ef89d536bf9c357b4e:CHANGEKERNEL_STATUS.md`: **19 parent passes** (18 behavioral cases plus one inactive parent helper), **19 expected fault-child exits at 71**, fmt/clippy exit 0. Child exits are not additional Rust passes.
- Manager read both full consumer reports and verified current native/session/branch/clean state, status-only successor deltas, archive SHA, every archived source file and exact overlay hashes. No consumer assertion changed or failed. L successful child logs were removed with its fixture; its retained parent success is not a separate child transcript. F child output remains in its parent log. Neither suite exercised timeout-kill branches.

All four assignment acknowledgments were correlated outside Git. All workers have submitted and are parked; the completed assignments below preserve scope, not permission to start more work. Source acceptance, release and any later real-world trial remain separate gates.

## Completed exact successor assignments — historical scope

All roles retain their current native cwd/branch and original worktree base. No branch switch, merge, rebase, source import or mutable sibling linkage. Review and consumer source is the immutable external archive of **58a79c25125de3f81b29f684cc6eb8fee0e683a5**, not the older source in their worktree. Preserve first results, exact commands/exits, bounded process cleanup and missing evidence. Separate peer dispatch must reference this committed assignment after recipient identity verification.

### R30-A — independent correction review

- Branch `work/r30-history-accounting-review`; worktree `/home/canina7/Projects/changekernel-workers/r30-history-accounting-review`; original source base `d891848502fc4c99553d00b479737841ba1842ed`; current report checkpoint `316c8378e1a679a47cd8506b192f4c12ebf2dfe2`.
- Own only `CHANGEKERNEL_STATUS.md`. Re-review the exact three-path correction and source report against the [authorization and error precedence](.changekernel/wiki/items/system/components/ledger-history.md#authorization-and-error-precedence) and [finite work contract](.changekernel/wiki/items/system/components/ledger-history.md#finite-work-and-named-owners), carrying forward the previous complete-source review and its limits.
- Independently rerun the unchanged original two-failure probe against the successor. Review/run the new owned regressions, including both cleanup branches, current collection/member/principal gates, deterministic denial/unavailability without incident retention, byte preservation and same-host exact authorized recovery; inspect any v4 effect. Review actor/op operands, failed/early exits, same-family counters, complete-call ceilings and owner/disposal implications without padding or alternative validation.
- Run focused locked tests (`ledger_history_work`, `ledger_selection`), fmt and locked all-target warnings-denied clippy. Extra disposable probes are allowed only for a concrete uncovered correction risk, not a new broad framework or duplicated backend. A new full source-only suite is not required in addition to these focused checks and the forthcoming manager combined suite.
- Report closed findings versus actual new blockers and gaps, exact subject/probe identities, scope and actual commands/exits. Do not claim the old timeout/log gap repaired or expand Metadata requirements: list/selection require Metadata **and** History; history/context require History only. Commit the report and park. Only manager accepts.

### R30-L / R30-F — exact corrected-source consumers

- **L:** branch `work/r30-history-consumer-tests`; worktree `/home/canina7/Projects/changekernel-workers/r30-history-consumer-tests`; original base `25e3cfdd33e496156c2b2b6baf94dd5d6f93e3be`; current checkpoint `f33b3edb45a58bb20a32a92d4a3395d6345c11a1`. Own only `tests/ledger_history.rs` and own status.
- **F:** branch `work/r30-history-failure-tests`; worktree `/home/canina7/Projects/changekernel-workers/r30-history-failure-tests`; original base `25e3cfdd33e496156c2b2b6baf94dd5d6f93e3be`; current checkpoint `03a83494c84d20ba7f61d6d9dc4e87f9d35d4e67`. Own only `tests/ledger_history_failures.rs` and own status.
- Each independently archives exact successor source, overlays only its exact owned test identified above, verifies source/test hashes and uses external target and isolated Pi settings. Run the targeted `cargo test --locked --test <owned-test>`, `cargo fmt --check`, and `cargo clippy --locked --all-targets -- -D warnings`. No need to rerun the entire source suite independently.
- Preserve real producer/consumer and fault-child evidence, parent versus helper counts, exit codes and cleanup limits. Report source defects instead of editing source or weakening assertions. Tests are expected unchanged; a genuine owned-test defect needs an explicitly identified correction and preserved first failure. Submit exact test/report revisions, then park.

### R30-S — parked source owner

Branch `work/r30-ledger-history-source`; worktree `/home/canina7/Projects/changekernel-workers/r30-ledger-history-source`; original base `25e3cfdd33e496156c2b2b6baf94dd5d6f93e3be`; current submitted checkpoint `88b93fe6a8d454673707f63daf272ede34f49f04`. No new assignment or code edits while this successor is reviewed. Findings return to the existing source owner, not other workers.

## Integration gate and retained limits

Exact independent successor review and both consumers have returned and passed manager disposition. Import only the **20 owned source/work-test paths** identified by the exact source delta and the **two exact consumer tests**; never import worker status files wholesale. Run fresh **combined** native unit/integration/doc tests, fmt and locked warnings-denied all-target clippy after integration; verify imported bytes match reviewed subjects before final acceptance. No npm gate for Rust-only work. Source acceptance is not release qualification, controller transfer or permission for the later guarded real-world update.

The predecessor `d8918485` with both exact overlays passed manager full checks: **185 parent passes/zero failures/three ignored**, fmt/clippy exit 0, in `/home/canina7/.local/state/changekernel-source-review/r30-manager-combined.zwwg33bh/`. It nevertheless failed the independent A1/A2 probes. Those passes are not successor evidence. The reviewer’s first 120-second run had no returned exit code; its full partial log was overwritten, leaving only the timeout tool result and captured tail. Later passes do not repair that gap. Earlier R29/R30 180-second incomplete runs and R27 analyzer/lifetime/retention/rollback limits remain preserved.

Full preceding findings, original reproduction counts, wrong-selector zero-test run, F2 import correction, and manager’s **withdrawn S3/incorrect F1 permission interpretation** are preserved at `bb9c2f75f1e7da1207af2e70fca92ea96c0dc081:CHANGEKERNEL_STATUS.md`; the source owner correctly stopped that unauthorized gate removal. S1/S2 constructor failures were closed by unchanged manager probes on `d8918485`; first failures remain. No history is amended or reclassified as success.

Accepted executable remains R27 `a4fc984e5ffb69938f83e8bc75335f27b7986c90`, bounded verdict `4645a76914481490291fcaae0927260c43adc384:CHANGEKERNEL_STATUS.md`. Jev’s twelve-request budget remains exhausted; no further credential/inference or production-model activity is authorized.
