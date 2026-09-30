# ChangeKernel source-development handoff

Role: project manager in `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. The user owns product intent. [AGENTS.md](AGENTS.md) owns procedure; [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design. Never load this mutable checkout as controller. This temporary note owns unfinished assignments and verdicts; Git retains completed handoffs.

## R17 — adopted authorization and Rust Landlock direction

The user approved documenting the [State-access/Change-authorization model](.changekernel/wiki/items/product/changekernel.md#state-access-and-change-authorization), establishing the [Rust Landlock direction](.changekernel/wiki/items/system/components/agent-execution.md#repository-contained-worker-sandbox-rust-landlock-direction), and preparing worker tasks. Integration started clean at `6b0f975491aaa08cfc8de2bb557b4498a624ab17`. Existing native permissions remain authoritative; delegation and Change controls narrow effects without a duplicate ACL system. Rust Landlock is first, upstream-first; a fork requires a concrete library gap, not a missing-kernel-feature workaround. Bubblewrap is a reviewed alternative, no longer the preferred first primitive.

**Scope:** documentation and bounded prerequisite work. This is not adoption of a complete kernel/ABI/launch profile, dependency version, new authentication subject, weaker custody guarantee or unrestricted same-account tamper exclusion. The selected protected writer/service, native source-context, exact retry and recovery requirements remain in force. No BPF follow-up, installation, sandbox/namespace/credential experiment, product inference, deployment, activation or controller handoff is released.

### Immediate work

The manager is preparing two independent worker slices from the resulting design checkpoint. Neither is dispatched yet. Each worker will own only its own `CHANGEKERNEL_STATUS.md`; Wiki and shared interfaces/manifests remain manager-owned. Exact worktree, branch, base and acceptance checks will be recorded before dispatch.

| Slice | Outcome | Dependencies and release boundary |
| --- | --- | --- |
| R17-L — Rust Landlock component contract | A concrete supported/refused operation and launch profile, minimal Rust boundary proposal, and finite disposable-fixture qualification specification. Identify the first concrete blocker if upstream cannot meet a required guarantee. | Uses the adopted authorization/containment requirements; no dependency install, code/API freeze, sandbox execution or new fork. Distinguish filesystem rights from process/IPC/network and source-authority proof. |
| R17-A — native and Change authorization composition | An operation-by-operation contract for ordinary native access, narrowed Work, typed acceptance and guarded publication, with exact current-code touchpoints and remaining host/custody prerequisites. | Independent of Landlock implementation. Consume its required postconditions, not invented APIs. No replacement ACL, redefined acting subject, repeated BPF design or disconnected authorization scaffold. |

Implementation tasks follow only after independent review of those outputs: a bounded Landlock component and its real fixture tests; the protected source/Trace opening path; then admitted worker execution/publication and console integration against settled shared contracts. The [canonical dependency plan](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation) owns their design order. These dependent tasks are not dispatched, accepted or silently made runnable by this note.

### Manager review and shared ownership

- Own the five canonical Wiki files, integration handoff, public/persistence/host contracts and all manifests/lockfiles until an exact later assignment transfers a write scope. Do not integrate worker handoffs wholesale.
- Verify native process/session cwd, assigned worktree, branch and clean exact base before dispatch. Require correlated acknowledgment, exact submitted revision and actual checks/gaps. Source inspection is not runtime qualification.
- Review each immutable report independently, resolve contradictions, consolidate durable conclusions into Wiki, and record `accepted`, `changes requested` or `blocked`. A precise blocker is evidence, not automatic acceptance or permission for a weaker guarantee.
- Return unresolved product/safety choices and the exact disposable sandbox experiment proposal to the user before those actions. Do not request routine scheduling approval or ask workers to rediscover already accepted counterexamples.
- Direction documentation checked: exact six-path scope and whitespace passed; all 110 local links/anchors resolved; active Markdown diagnostics confirmed all six documents clean. No source/configuration/dependency changed; Cargo/npm were not run for prose-only work. This accepts the documentation update, not sandbox or native-tool qualification.

## Preserved blockers and accepted evidence

- [Source authority and protected custody](.changekernel/wiki/items/system/components/agent-execution.md#ordinary-client-host-direction) remain unresolved operating gates. R13's post-exec credential counterexample stands; R15's BPF candidate remains unadopted and blocked at exact artifact protection. Landlock worker containment solves a different boundary. Do not resume BPF work or substitute independently authenticated owner authority without an explicit decision.
- [Native authority](.changekernel/wiki/items/system/components/state.md#native-authority-and-delegated-access), [in-place source continuity](.changekernel/wiki/items/system/components/state.md#in-place-source-enrollment-and-continuity) and [account lifecycle](.changekernel/wiki/items/system/components/agent-execution.md#account-retirement-without-assuming-a-permanent-uid-ban) still need exact mechanisms; no managed login, source relocation, new principal secret or permanent UID ban is adopted.
- [File-first interface/recovery](.changekernel/wiki/items/system/components/state.md#first-local-recovery-admission-protocol) remains separate from frozen SQLite/native continuation. Complete opening/history operations, references/retries, codecs/bounds, initialization, writer exclusion and acknowledgment composition are not implemented. Preserve the lost-incident limit, original-key recovery, no suffix promotion/truncation and no replacement identity. R5-A remains frozen/unintegrated; R8-B Phase 2 remains unreleased.
- Native Pi-lens readiness remains open. The accepted `.pi-lens.json` backend correction and direct-LSP/Cargo controls do not prove the current native session selected that backend. A fresh native session and real-error control are still required; no source workaround, suppression, installation, package link or global/tool patch is released. This does not block Markdown-only work.

| Completed evidence | Exact retained handoff / checkpoint |
| --- | --- |
| R16 bounded sandbox research, five pinned subjects and 27 captures; no sandbox executed | `6b0f975491aaa08cfc8de2bb557b4498a624ab17:CHANGEKERNEL_STATUS.md` |
| R15 bounded BPF design investigation; artifact gate and all operational limits retained | `f4fb53f67519e2cfe4689ad1422d541c28131cf1:CHANGEKERNEL_STATUS.md`; acknowledgment `d4848b08e2526ddf0bb822fe7fedb2bc6b730ec8` |
| R14 source assessment; no mechanism/profile adopted | `bb022d67cbd78ce0c0f5c4faa61ce17934624ff6:CHANGEKERNEL_STATUS.md` |
| R13 helper falsification; no installed exploit or universal impossibility claim | `c885fbe5aff0aa1c3b4ff0be4e0e8e2cf612bd18:CHANGEKERNEL_STATUS.md` |
| R12 analyzer/backend reconciliation, native-tool gap retained | `56aed7978ee1432aee2da5831b04d87efb6679f6:CHANGEKERNEL_STATUS.md` |
| R12 hygiene, frozen schema/adapters/archives preserved; no further deletion justified | `f18ccd5ed23d492398fe6af50ba60a426c4c58c4:CHANGEKERNEL_STATUS.md` |
| R11 packet library and earlier bounded source contracts, not host/source authority | `b2b30b86d8783d0bd7727f4855b7ea49fe44fef5:CHANGEKERNEL_STATUS.md` |

## Retained worker pool

Four developers are retained; the ceiling of 15 is not a utilization target. Two ready independent slices justify two active workers after verified relaunch; C/D stay parked for dependent work. Completed acknowledgments are not replayed. Routing identities and transport evidence remain outside Git.

| Worker | Current worktree under `/home/canina7/Projects/changekernel-workers/` | Branch | Retained checkpoint |
| --- | --- | --- | --- |
| A | `bpf-admission-design` | `work/r15-bpf-admission-design` | `e552f1c221c70a0b2688eaefd64f574e86a8a00b`; relaunch planned for R17-L |
| B | `restart-trace-contract` | `work/restart-trace-contract` | `9aa6d02a8c436a9ae130c478ea3b086d19f9e285`; relaunch planned for R17-A |
| C | `analyzer-reconciliation` | `work/r12-analyzer-reconciliation` | `b212699c4772a56613e4db11f3ce741a634b4fbd`; parked |
| D | `attempt-supervision-contract` | `work/attempt-supervision-contract` | `5421254d4563de3176d964eb18bca79d6786a56f`; parked |

First complete delivery remains Linux-first software development, one supported source, one active custodian, a small worker configuration and the owned Rust console. Pi is the development harness/retained adapter; Jaz is inspiration-only. Service-backed collaboration/borrowing is later. Only a qualified immutable external release with explicit controller handoff may govern a later candidate.
