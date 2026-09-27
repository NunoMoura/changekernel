# ChangeKernel source-development status

## Scope and source boundary

Manager worktree: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Wiki owns the [approved model and dependency gates](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation); [AGENTS.md](AGENTS.md) owns procedure. This short temporary handoff owns unfinished source-development coordination, not desired design or governed lifecycle history. No mutable checkout code may govern this checkout. Qualification, activation and controller handoff remain separate.

The target remains the [smallest complete enforced self-development product](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus). Typed-only custody is an intermediate capability, not qualified workers, publication or recovery. Open contracts block affected implementation and interface/schema freeze.

## Approved research direction

The user agreed to incorporate the runtime research's design lessons, not to adopt Jaz or replace Pi. This documentation checkpoint starts from manager review `67be34af6c40fa5b79e801b004dda094a1023dbb` and records the direction in the existing canonical documents:

- [Programmable strategies and bounded delegation](.changekernel/wiki/items/system/components/agent-execution.md#programmable-strategies-and-bounded-delegation): replaceable runtimes, explicit inputs, accountable recursion and governed improvement.
- [Structured history and context projections](.changekernel/wiki/items/system/components/state.md#structured-history-access-and-context-projections): accepted Change history, runtime transcripts and working context have different authority and retention roles.
- [Restart and recovery boundary](.changekernel/wiki/items/system/components/state.md#protected-accepted-prefix-and-recovery-boundary): the operational target includes clean restart/reboot and authorized history reopening, not a process-lifetime-only Change. Crash/I/O incidents, backup rollback and external-effect reconciliation remain distinct contracts.
- [Required assessment failure](.changekernel/wiki/items/system/components/checks.md#results-feedback-and-progression) and [runtime comparison](.changekernel/wiki/items/system/components/package.md#runtime-comparison-and-adoption): missing enforcement cannot become success; a matched-information Pi/Jaz comparison is optional and gated, not a release prerequisite.

No new runtime, public API, serializer, storage algorithm, native host deployment or Python dependency is selected. The research does not close R7-A/B or qualify execution. Existing source, tests and package dependencies are unchanged.

## R7 disposition

The completed combined review is preserved at `67be34af6c40fa5b79e801b004dda094a1023dbb:CHANGEKERNEL_STATUS.md`; safety/source base was `201ac299bea4f12fcfa6ff52d24899cd9af33430`. **A/B remain blocked and stopped; C is accepted for its logical proposal and finished.** No worker handoff was merged wholesale. No worker is dispatched by this documentation update, and their existing assignments are not permission to resume under assumed shared contracts.

| Worker | Branch / worktree | Reviewed report and verdict |
| --- | --- | --- |
| R7-A | `work/protected-host-contract`; `/home/canina7/Projects/changekernel-workers/protected-host-contract` | Report `103e366ca8ec55c225f37d6de5b303231b7b6985`; **blocked overall**. Deterministic slots, pending/active creation and narrower privilege/helper boundaries remain conditional design inputs. [Review](../protected-host-contract/CHANGEKERNEL_STATUS.md#manager-resubmission-review--blocked), verdict `ba44df039ff555d2053face9e7c8a70eca30ee8f`. |
| R7-B | `work/trace-commit-contract`; `/home/canina7/Projects/changekernel-workers/trace-commit-contract` | Report `fa74ee33ecbd9264608b2daf9b80b8dfd8b233ed`; **blocked**. Caller expectations versus append structure are corrected; the one-way gate is not an operational restart profile, and joint creation remains open. [Review](../trace-commit-contract/CHANGEKERNEL_STATUS.md#manager-resubmission-review--blocked), verdict `a5203ebf5fd98fd97fad5f204768af775cde1b64`. |
| R7-C | `work/kernel-lifecycle-contract`; `/home/canina7/Projects/changekernel-workers/kernel-lifecycle-contract` | Report `9db0f4dbcf202cdf8d5ac821d870cb74d3aa7f6a`; **accepted as the bounded logical-semantics proposal**. No resubmission or next slice requested. [Review](../kernel-lifecycle-contract/CHANGEKERNEL_STATUS.md#manager-review--accepted-logical-proposal), verdict `9e93d429de5eba01a62c7c05f5120888858da63d`. |

### Restart-profile decision

The desired operational target is now explicit in Wiki: ordinary clean shutdown/restart/reboot and authorized history reopening must work under declared custody and storage assumptions. A disposable one-process gate is not a substitute. The unresolved decision is the concrete safe protocol, not whether restoring a terminal or conversation alone supplies acceptance authority.

B's reviewed proposal refuses every successor after its gate dies, even after clean shutdown; A's conditional reboot/history path therefore does not compose with it. No reset, marker deletion, acceptance reconstruction or automatic restore is approved. Reopening matching files and re-syncing them do not by themselves resolve a prior storage error. Whole-domain rollback and uncertain source effects remain separate. Root-controlled source placement, UID lifecycle management and native source reattestation are still proposed deployment costs, not permission to configure this machine.

### Next manager action

1. Prepare one bounded, report-first A/B follow-up for the restart target and joint creation. Use A's exact reviewed slot proposal and C's accepted logical semantics. The manager owns the shared sequence and interfaces; B owns storage acceptance/health/reentry, while A supplies the required host identity/protection and native permission conditions. Do not restart a generic framework survey.
2. Close private origin preparation → association activation → final acceptance/reply ordering, immutable result material, control/key encodings and bounds, collision/capacity rules and control-writer ownership. Reconcile expected absence/create collisions, attributable damage, storage incidents and transport loss. Correct the primary-GID/supplementary-group distinction and keep source reattestation separate from storage reopening. Independently review the combined result before adopting the concrete profile and freezing its affected interfaces.
3. Define the next bounded Work/attempt and execution contract against the accepted foundation, including structured history views, scoped delegation, aggregate budgets, cancellation, retained results and unknown outcomes. C's completed assignment is not reopened without a specific new gap. Publication/source-outcome contracts retain their own gate.
4. Only when the required execution/isolation boundary is ready, consider a disposable read-only/candidate-generation Pi/Jaz comparison under the [qualification policy](.changekernel/wiki/items/system/components/package.md#runtime-comparison-and-adoption). No live effects, paid inference, package adoption or worker implementation is authorized by the research recommendation.

These are immediate dependency handoffs, not a second design roadmap. Separate worker assignments with exact bases, ownership and acceptance checks are still required before any resume or implementation.

## Evidence and checks

The research read the full Jaz paper v1 and inspected `jaz-lang/jaz` v0.2.0a4 at external commit `0803d4971be785e95b80054b02259664d70fa3da`. Pinned citations are in the [runtime research basis](.changekernel/wiki/items/system/components/agent-execution.md#runtime-selection-and-research-basis). External inspection material is at `/home/canina7/.local/state/ck-jaz-research.zqy5kS/`; earlier Herdr/Pi session-restoration inspection is at `/home/canina7/.local/state/ck-resume-research.WFDqSF/`. These are disposable research artifacts, not source truth, benchmark reproduction or qualification. No new research execution or R5/R6/R7 probe rerun is claimed by this documentation checkpoint.

Documentation checks passed: active Markdown diagnostics found zero findings across seven changed paths; 90 local links/anchors and 15 retained commit references resolved. All five Wiki frontmatter/provenance blocks, State text from `Native Rust intake` onward and the package bootstrap/source boundary are byte-identical to the prior checkpoint. Whitespace and exact documentation-only scope checks passed. The three worker trees remain clean at the verdicts above, with no handoff edits. No Cargo/npm tests were run: source/tests/manifests and integration boundaries are unchanged. No governed lifecycle records, archives, OS settings, accounts/services, live effects or controller state are changed.

## Preserved executable disposition

- Latest executable integration remains `0b1b434ab`; current source is not an operational protected host or qualified file-first engine.
- R5-B intent revisions and allocation repair remain accepted/integrated. R5-A's whole candidate slice remains unintegrated/held for the path-only attribution gap; no R5 resubmission is owed. Verdicts `f65d52a2587405c283ca485c72ac8da86549beed` (A) and `7420ba2b8ac05e1471d010c183cb3059dc3aa9f9` (B), with consolidated evidence at `2728e8c4d:CHANGEKERNEL_STATUS.md`.
- Existing SQLite profiles/tests are frozen for the first file-first delivery: no extension, R5-A integration, automatic migration, renaming or dual authority. The [historical native contracts](.changekernel/wiki/items/system/components/state.md#native-rust-intake) retain their exact meanings.
- Completed R6/R7 investigation evidence, source-copy identities and limitations remain in Git at `8dea13d2d:CHANGEKERNEL_STATUS.md`, `5e036dda6:CHANGEKERNEL_STATUS.md` and `67be34af6c40fa5b79e801b004dda094a1023dbb:CHANGEKERNEL_STATUS.md`. Historical source hash verification and documentation checks are not new execution or physical durability proof.
