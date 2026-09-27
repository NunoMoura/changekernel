# ChangeKernel source-development status

## Scope and source boundary

Manager worktree: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Wiki owns the [approved model and dependency gates](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation); [AGENTS.md](AGENTS.md) owns procedure. This short temporary handoff owns unfinished source-development coordination, not desired design or governed lifecycle history. No mutable checkout code may govern this checkout. Qualification, activation and controller handoff remain separate.

The target remains the [smallest complete enforced self-development product](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus). Typed-only custody is an intermediate capability, not qualified workers, publication or recovery. Open contracts block affected implementation and interface/schema freeze.

## Approved research direction

The user agreed to incorporate the runtime research's design lessons, not to adopt Jaz or replace Pi. Documentation checkpoint `18e6397e3694243c3b35b3291f0c8b624cc805ac` records that direction in the existing canonical documents and is the common R8 source/design base:

- [Programmable strategies and bounded delegation](.changekernel/wiki/items/system/components/agent-execution.md#programmable-strategies-and-bounded-delegation): replaceable runtimes, explicit inputs, accountable recursion and governed improvement.
- [Structured history and context projections](.changekernel/wiki/items/system/components/state.md#structured-history-access-and-context-projections): accepted Change history, runtime transcripts and working context have different authority and retention roles.
- [Restart and recovery boundary](.changekernel/wiki/items/system/components/state.md#protected-accepted-prefix-and-recovery-boundary): the operational target includes clean restart/reboot and authorized history reopening, not a process-lifetime-only Change. Crash/I/O incidents, backup rollback and external-effect reconciliation remain distinct contracts.
- [Required assessment failure](.changekernel/wiki/items/system/components/checks.md#results-feedback-and-progression) and [runtime comparison](.changekernel/wiki/items/system/components/package.md#runtime-comparison-and-adoption): missing enforcement cannot become success; a matched-information Pi/Jaz comparison is optional and gated, not a release prerequisite.

No new runtime, public API, serializer, storage algorithm, native host deployment or Python dependency is selected. The research does not close R7-A/B or qualify execution. Existing source, tests and package dependencies are unchanged.

## R7 disposition

The completed combined review is preserved at `67be34af6c40fa5b79e801b004dda094a1023dbb:CHANGEKERNEL_STATUS.md`; safety/source base was `201ac299bea4f12fcfa6ff52d24899cd9af33430`. **R7-A/B remain blocked overall; R7-C is accepted for its logical proposal and finished.** All three old worktrees remain stopped/read-only at their verdicts, verified with no newer submission. The user has now requested new tasks: R8 below authorizes bounded report work in fresh worktrees, not production implementation, profile adoption or resumption of the old assignments. No handoff is merged wholesale.

| Worker | Branch / worktree | Reviewed report and verdict |
| --- | --- | --- |
| R7-A | `work/protected-host-contract`; `/home/canina7/Projects/changekernel-workers/protected-host-contract` | Report `103e366ca8ec55c225f37d6de5b303231b7b6985`; **blocked overall**. Deterministic slots, pending/active creation and narrower privilege/helper boundaries remain conditional design inputs. [Review](../protected-host-contract/CHANGEKERNEL_STATUS.md#manager-resubmission-review--blocked), verdict `ba44df039ff555d2053face9e7c8a70eca30ee8f`. |
| R7-B | `work/trace-commit-contract`; `/home/canina7/Projects/changekernel-workers/trace-commit-contract` | Report `fa74ee33ecbd9264608b2daf9b80b8dfd8b233ed`; **blocked**. Caller expectations versus append structure are corrected; the one-way gate is not an operational restart profile, and joint creation remains open. [Review](../trace-commit-contract/CHANGEKERNEL_STATUS.md#manager-resubmission-review--blocked), verdict `a5203ebf5fd98fd97fad5f204768af775cde1b64`. |
| R7-C | `work/kernel-lifecycle-contract`; `/home/canina7/Projects/changekernel-workers/kernel-lifecycle-contract` | Report `9db0f4dbcf202cdf8d5ac821d870cb74d3aa7f6a`; **accepted as the bounded logical-semantics proposal**. No R7-C resubmission is owed; R8-C below is a separate read-view task. [Review](../kernel-lifecycle-contract/CHANGEKERNEL_STATUS.md#manager-review--accepted-logical-proposal), verdict `9e93d429de5eba01a62c7c05f5120888858da63d`. |

### Restart-profile decision

The desired operational target is now explicit in Wiki: ordinary clean shutdown/restart/reboot and authorized history reopening must work under declared custody and storage assumptions. A disposable one-process gate is not a substitute. The unresolved decision is the concrete safe protocol, not whether restoring a terminal or conversation alone supplies acceptance authority.

B's reviewed proposal refuses every successor after its gate dies, even after clean shutdown; A's conditional reboot/history path therefore does not compose with it. No reset, marker deletion, acceptance reconstruction or automatic restore is approved. Reopening matching files and re-syncing them do not by themselves resolve a prior storage error. Whole-domain rollback and uncertain source effects remain separate. Root-controlled source placement, UID lifecycle management and native source reattestation are still proposed deployment costs, not permission to configure this machine.

## R8 assignments

Common source/design base: `18e6397e3694243c3b35b3291f0c8b624cc805ac`. Each fresh branch/worktree was created by the manager from that checkpoint. Each worker may change **only their own `CHANGEKERNEL_STATUS.md`**, with necessary probes kept externally; Wiki, source, tests, shared interfaces and dependencies remain manager-owned and unchanged. Full outcomes, pinned R7 inputs, requirements, scope and acceptance checks are in the individual assignments. Dispatch is not acceptance or evidence that a worker process is running; the manager launches no worker process here.

The user requested a fourth parallel lane and confirmed Pi startup now works. Target four independent workers when the dependency graph and review capacity support them, not a quota filled with blocked implementation. A/B/C retain their existing assignments; await their submissions without altering their worktrees or consuming unfinished reports. R8-D is released only for independently reviewable logical supervision/accounting choices. Combined execution protocol closure and implementation still wait for the foundation.

| Worker | Ready work and dependency | Branch / worktree / assignment revision |
| --- | --- | --- |
| R8-A | Host reentry/native-context matrix and exact A-owned creation controls. Final host realization remains conditional on B's reviewed restart mechanism. | `work/restart-host-contract`; `/home/canina7/Projects/changekernel-workers/restart-host-contract`; [assignment](../restart-host-contract/CHANGEKERNEL_STATUS.md#assignment); `12f57cd90d88f0f4dcefd50c8d025570d1de338f`. |
| R8-B | **Phase 1 ready:** one practical restart/incident proposal and concrete A obligations. **Phase 2 blocked:** joint creation/encoding closure waits for the manager's exact reviewed R8-A handoff and explicit release. | `work/restart-trace-contract`; `/home/canina7/Projects/changekernel-workers/restart-trace-contract`; [assignment](../restart-trace-contract/CHANGEKERNEL_STATUS.md#assignment); `235a01b65b358fbfefe5c19d01e2d44e701479a6`. |
| R8-C | Independent logical read-view proposal over accepted Trace records and referenced grounds, including bounded lookup/search, authorization, coverage and context reconstruction. No Work/attempt scheduler or A/B codec. | `work/history-view-contract`; `/home/canina7/Projects/changekernel-workers/history-view-contract`; [assignment](../history-view-contract/CHANGEKERNEL_STATUS.md#assignment); `4eef257bffc74078ddb5346b28aef9c870058834`. |
| R8-D | Logical Work/attempt supervision, aggregate execution budgets, nested computation, cancellation/cleanup and retained versus unknown outcomes. Concrete reservation storage, containment, runtime integration and publication are excluded. | `work/attempt-supervision-contract`; `/home/canina7/Projects/changekernel-workers/attempt-supervision-contract`; [assignment](../attempt-supervision-contract/CHANGEKERNEL_STATUS.md#assignment); `9e4863bba743d6eefa3f13ead2d5c8c813ea5578`. |

### R8 shared review boundary

These are provisional review obligations, not adopted public or persisted schemas. A owns native identity/protection and association-control meaning; B owns Trace/checkpoint acceptance, incident scope and reentry evidence; C proposes read views over opaque trusted authorization/accepted-prefix references. D proposes logical attempt transitions/accounting and names additional execution-custody obligations, without redefining A/B controls or C queries. Current A/B assignments do not thereby acquire Work reservation/result implementation. The manager owns joint composition and interface changes. No worker may consume another lane's moving report as an agreed contract.

Reconcile **authorized reservation → private origin preparation → A association activation → B final acceptance/restart evidence → current-authorized advertisement/reply**. Preparation must be verifiable before activation without requiring post-activation public acceptance. An active A association is not an independent reply route. Creation keys remain principal/fixed-family/request scoped with Workspace and complete input compared; existing-Change keys span actors/kinds within immutable Trace identity, with original expectations preserved. Historical SQLite namespaces stay unchanged.

A's independently reviewable control/native-context delta, B's restart mechanism investigation, C's read semantics and D's logical supervision/accounting proposal can proceed in parallel without shared writes. D relies on canonical obligations and pinned R7 semantics, not unfinished R8 outputs. Final A/B composition is serialized behind reviewed exact inputs; final Work/execution composition follows accepted identity, lifecycle, persistence and input-view boundaries. C/D cannot certify health, rebuild acceptance controls, introduce a second history or freeze implementation interfaces. Concrete unresolved platform/evidence costs return to the manager/user; no worker may silently weaken known-incident handling or select mandatory privileged/cloud/hardware deployment.

### Next manager action

1. Independently review A's exact controls/native-context report and B's Phase 1 mechanism or concrete blocker. Resolve genuine deployment/evidence choices with the user. Give B a pinned reviewed A revision and bounded Phase 2 instructions; return any specific host-realization gap to A. Do not auto-advance either worker or reopen general framework research.
2. Review C's logical read-view report independently, then reconcile it with the combined acceptance/delivery contract. Check privacy, bounded consistency and no implicit execution. Consolidate complete accepted contracts into Wiki before freezing affected interfaces or dispatching implementation.
3. Independently review D's bounded logical proposal when submitted. After the foundation is accepted, reconcile it with reviewed C inputs and close the concrete Work/attempt reservation, supervision, aggregate-budget and recovery contract before implementation. Publication/source-outcome contracts keep their own gate. An optional [Pi/Jaz comparison](.changekernel/wiki/items/system/components/package.md#runtime-comparison-and-adoption) waits for qualified isolation and separately authorized execution/budgets; it is not a prerequisite for the first supported path.

These are immediate handoffs, not a second design roadmap. Workers submit exact revisions/checks/gaps and stop; only the manager accepts or advances slices.

## Evidence and checks

The research read the full Jaz paper v1 and inspected `jaz-lang/jaz` v0.2.0a4 at external commit `0803d4971be785e95b80054b02259664d70fa3da`. Pinned citations are in the [runtime research basis](.changekernel/wiki/items/system/components/agent-execution.md#runtime-selection-and-research-basis). External inspection material is at `/home/canina7/.local/state/ck-jaz-research.zqy5kS/`; earlier Herdr/Pi session-restoration inspection is at `/home/canina7/.local/state/ck-resume-research.WFDqSF/`. These are disposable research artifacts, not source truth, benchmark reproduction or qualification. No new research execution or R5/R6/R7 probe rerun is claimed by this documentation checkpoint.

Previous documentation checkpoint `18e6397e3` passed seven active Markdown checks, 90 local links/anchors, 15 retained commit checks and provenance/native-body preservation checks. A/B/C assignment setup at `f20740ef5112f45854058050c665b9267f5c6cac` passed four active Markdown paths, 38 local links/anchors, 21 cited commit references and branch/ancestry/scope checks. These are historical documentation/setup results, not acceptance of worker submissions.

D setup checks passed: two active Markdown paths with zero diagnostics, 27 local links/anchors, 22 cited commit references, exact branch/direct-base ancestry and handoff-only whitespace/scope checks. Other-worker links were checked against pinned assignment/verdict bytes, not moving reports. The D assignment is committed and clean. Only the manager and D handoffs are edited in this update; A/B/C worktrees, source, tests, Wiki, manifests and integration boundaries are untouched. No Cargo/npm source tests, execution probe, package installation, OS/service change, live effect or controller loading is performed for this assignment. No worker process is launched by the manager.

## Preserved executable disposition

- Latest executable integration remains `0b1b434ab`; current source is not an operational protected host or qualified file-first engine.
- R5-B intent revisions and allocation repair remain accepted/integrated. R5-A's whole candidate slice remains unintegrated/held for the path-only attribution gap; no R5 resubmission is owed. Verdicts `f65d52a2587405c283ca485c72ac8da86549beed` (A) and `7420ba2b8ac05e1471d010c183cb3059dc3aa9f9` (B), with consolidated evidence at `2728e8c4d:CHANGEKERNEL_STATUS.md`.
- Existing SQLite profiles/tests are frozen for the first file-first delivery: no extension, R5-A integration, automatic migration, renaming or dual authority. The [historical native contracts](.changekernel/wiki/items/system/components/state.md#native-rust-intake) retain their exact meanings.
- Completed R6/R7 investigation evidence, source-copy identities and limitations remain in Git at `8dea13d2d:CHANGEKERNEL_STATUS.md`, `5e036dda6:CHANGEKERNEL_STATUS.md` and `67be34af6c40fa5b79e801b004dda094a1023dbb:CHANGEKERNEL_STATUS.md`. Historical source hash verification and documentation checks are not new execution or physical durability proof.
