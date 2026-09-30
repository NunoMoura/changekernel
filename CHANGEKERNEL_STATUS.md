# ChangeKernel source-development handoff

Role: project manager in `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. The user owns product intent. [AGENTS.md](AGENTS.md) owns procedure; [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design. Never load this mutable checkout as controller. This temporary note owns unfinished assignments and verdicts; Git retains completed handoffs.

## R17 — adopted authorization and Rust Landlock direction

The user approved documenting the [State-access/Change-authorization model](.changekernel/wiki/items/product/changekernel.md#state-access-and-change-authorization), establishing the [Rust Landlock direction](.changekernel/wiki/items/system/components/agent-execution.md#repository-contained-worker-sandbox-rust-landlock-direction), and preparing worker tasks. Integration started clean at `6b0f975491aaa08cfc8de2bb557b4498a624ab17`. Existing native permissions remain authoritative; delegation and Change controls narrow effects without a duplicate ACL system. Rust Landlock is first, upstream-first; a fork requires a concrete library gap, not a missing-kernel-feature workaround. Bubblewrap is a reviewed alternative, no longer the preferred first primitive.

**Scope:** documentation and bounded prerequisite work. This is not adoption of a complete kernel/ABI/launch profile, dependency version, new authentication subject, weaker custody guarantee or unrestricted same-account tamper exclusion. The selected protected writer/service, native source-context, exact retry and recovery requirements remain in force. No BPF follow-up, installation, sandbox/namespace/credential experiment, product inference, deployment, activation or controller handoff is released.

### Immediate work

**Ready for dispatch; not yet acknowledged.** The manager created both branches/worktrees from accepted direction checkpoint `06a7932f966e7a9a9999aa5b2b0e4a5ff1d6c9f5`, relaunched each native Pi process there, and independently verified process/session cwd, branch, clean exact base and no project-local package installation. The worktree copies intentionally retain the design-checkpoint handoff; workers must read their exact committed integration assignment before work. Neither slice consumes the other's provisional report.

| Slice / worker | Assigned branch | Assigned worktree | Exact base |
| --- | --- | --- | --- |
| R17-L / A | `work/r17-landlock-contract` | `/home/canina7/Projects/changekernel-workers/r17-landlock-contract` | `06a7932f966e7a9a9999aa5b2b0e4a5ff1d6c9f5` |
| R17-A / B | `work/r17-native-authority` | `/home/canina7/Projects/changekernel-workers/r17-native-authority` | `06a7932f966e7a9a9999aa5b2b0e4a5ff1d6c9f5` |

**Shared write scope and checks:** each worker owns only its own `CHANGEKERNEL_STATUS.md`. Source/tests, Wiki, configuration, manifests and lockfiles are read-only. Private captures/notes belong in disposable external evidence storage, not Git; downloading pinned source for inspection is allowed, installing/building/running it is not. Use existing Pi-native tools without repairs/installations. Return a bounded committed report with exact source/citation references, proposed boundary and first blocker, actual checks and limits. Run `git diff --check`, verify the sole owned-path diff and referenced sources/anchors, and request active exact-file Markdown diagnostics; unavailable coverage is not clean. Cargo/npm are unnecessary because no executable code changes. Do not write code scaffolds, public schemas or a standalone roadmap. Commit with hooks disabled, submit the revision, and stop for manager review; no merge, rebase, push, worker spawning or self-acceptance.

#### R17-L — Rust Landlock component contract (worker A)

**Outcome:** an implementation-ready minimal component proposal or a precise source-backed blocker, plus an executable-in-principle qualification plan. Requirements: [Rust Landlock direction](.changekernel/wiki/items/system/components/agent-execution.md#repository-contained-worker-sandbox-rust-landlock-direction), [native access](.changekernel/wiki/items/system/components/state.md#native-authority-and-delegated-access) and [qualification boundary](.changekernel/wiki/items/system/components/package.md#native-authorization-and-rust-sandbox-qualification). The existing R16 captures may be reused after hash verification; do not repeat the product survey.

- Map required file-content and mutation operations to exact upstream Rust/kernel support. Cover read/write/truncate, create/delete/rename/link, metadata/permission changes, execute, directory rights, protected children under writable ancestors, symlinks/hardlinks/mount aliases and linked-worktree Git metadata. Distinguish prevented access from visible names/metadata and unsupported guarantees.
- Propose the smallest Rust-owned launch/handle boundary: who supplies trusted scope, when hard-required restrictions apply, thread/exec/descendant inheritance, how unintended inherited/transferred FDs and host process/IPC/TTY routes are excluded, and how setup failure prevents the payload starting. Specify network, credentials and resource-control prerequisites without assuming Landlock supplies them. Preserve native rights rather than reconstructing or widening the acting subject.
- State a concrete candidate crate/features/toolchain/required-rights profile and refusal cases from inspected sources, without adopting/locking it. Separate library gaps from kernel gaps and possible additional native controls. Do not fork or resume BPF admission design. If a required property fails, give the first counterexample and the smallest reviewable response; do not invent a weaker profile or launch an open-ended search.
- Specify finite disposable external nonsecret fixtures, expected allowed/denied results, no-payload-on-setup-failure evidence and descendant cleanup. Include a real allowed operation so universal refusal cannot masquerade as containment. Do not create/run the sandbox or syscall/namespace/credential probes. Identify exact approval and environment needs for the later trial.

**Acceptance:** every required boundary is tied to an exact mechanism or explicit unresolved/refused case; no broad-root read grant, silent best-effort downgrade, API-bypass route or kernel capability invented by a fork. Provide a minimal component/API proposal in the report, not a frozen public interface, and one cohesive next code/test assignment with dependency ownership and blockers. The manager independently reviews sources and policy closure before releasing that assignment.

#### R17-A — native and Change authorization composition (worker B)

**Outcome:** close the operation and trust-boundary composition needed to connect native access, admitted Work and authoritative results, or identify the exact unresolved host decision that prevents it. Requirements: [two-authority model](.changekernel/wiki/items/product/changekernel.md#state-access-and-change-authorization), [native access](.changekernel/wiki/items/system/components/state.md#native-authority-and-delegated-access), [backend-only writes](.changekernel/wiki/items/system/components/state.md#backend-only-authoritative-writes), [ordinary-client/source boundary](.changekernel/wiki/items/system/components/agent-execution.md#ordinary-client-host-direction) and [recovery protocol](.changekernel/wiki/items/system/components/state.md#first-local-recovery-admission-protocol).

- Specify authority owner, authenticating evidence, point-of-use checks, permitted result and refusal for query, candidate preparation, publication, Trace append/history delivery and retry. Keep OS resource rights, disclosure, Work scope, Change authorization, Check result and writer custody distinct. Include native-allow/Change-deny, native-deny/Change-allow, narrower-worker-deny, exact all-allow, write-without-read, directory-controlled deletion and authority withdrawal/held-handle cases.
- Trace every proposed untrusted file route through its boundary: shell/editor/generated code, trusted source reader, recursive worker and backend broker. Consume Landlock's required postconditions only; do not depend on A's proposed API or assert that restrictions authenticate a caller/result. Distinguish writable candidate material from protected publication targets and source observations from client claims.
- Inspect the current packet/source/continuation touchpoints using native navigation and exact bodies. Show the smallest integrated source path that could implement the new model without changing frozen SQLite/packet behavior or adding a duplicate ACL/Boolean authorization scaffold. Identify what still blocks trustworthy source access and protected history under the selected service profile.
- Preserve R13's accepted counterexample and R15's unadopted status; do not redesign BPF, silently swap the acting subject, erase the native-source proof requirement or select managed login/new secrets/UID bans/relocation. If ordinary user-context execution leaves an unsatisfied service-proof gate, explain the remaining decision in plain language and distinguish a proposed alternative from adopted guarantees. Return concrete choices rather than another generic host essay.

**Acceptance:** a bounded operation/denial matrix, exact provenance-versus-authority and candidate-versus-publication boundaries, current-code gap map and dependency-ordered minimal implementation proposal. Required gates must have a viable composition or an explicit first blocking decision; no runtime guarantee follows from types, client flags, cached permissions or a successful launch. Manager review owns final shared contracts and scope release.

### Dependent tasks — blocked, not dispatched

| Task | Release condition / result |
| --- | --- |
| Landlock component and fixture tests | Accepted R17-L contract; separately approved exact external sandbox trial and sole dependency/manifest owner. Deliver real enforcement/refusal tests, not an unused policy library. |
| Native source and protected opening/history | Accepted R17-A composition plus resolved identity/source/custody gates and complete Trace/reference/retry protocol. Deliver the first typed proposal/history/reopen path without extending frozen SQLite. |
| Worker execution, guarded publication and console | Agreed lifecycle/Work/result contracts, qualified containment and protected storage/source path. Integrate one bounded Rust worker/Check route and authorized views, not cosmetic progress or raw publication access. |

The [canonical dependency plan](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation) owns design order. No dependent task gains implementation or experiment permission from dispatch of a prerequisite.

### Manager review and shared ownership

- Own the five canonical Wiki files, integration handoff, public/persistence/host contracts and all manifests/lockfiles until an exact later assignment transfers a write scope. Do not integrate worker handoffs wholesale.
- Verify native process/session cwd, assigned worktree, branch and clean exact base before dispatch. Require correlated acknowledgment, exact submitted revision and actual checks/gaps. Source inspection is not runtime qualification.
- Review each immutable report independently, resolve contradictions, consolidate durable conclusions into Wiki, and record `accepted`, `changes requested` or `blocked`. A precise blocker is evidence, not automatic acceptance or permission for a weaker guarantee.
- Return unresolved product/safety choices and the exact disposable sandbox experiment proposal to the user before those actions. Do not request routine scheduling approval or ask workers to rediscover already accepted counterexamples.
- Direction documentation checked: exact six-path scope and whitespace passed; all 110 local links/anchors resolved; active Markdown diagnostics confirmed all six documents clean. No source/configuration/dependency changed; Cargo/npm were not run for prose-only work. This accepts the documentation update, not sandbox or native-tool qualification.
- Assignment checkpoint checked: status-only scope/whitespace, 18 local links/anchors, seven historical handoff references and both clean exact worker bases passed. Active handoff Markdown diagnostics are clean. Dispatch and worker reports remain separate from acceptance.

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
| A | `r17-landlock-contract` | `work/r17-landlock-contract` | `06a7932f966e7a9a9999aa5b2b0e4a5ff1d6c9f5`; native relaunch verified, R17-L ready for dispatch |
| B | `r17-native-authority` | `work/r17-native-authority` | `06a7932f966e7a9a9999aa5b2b0e4a5ff1d6c9f5`; native relaunch verified, R17-A ready for dispatch |
| C | `analyzer-reconciliation` | `work/r12-analyzer-reconciliation` | `b212699c4772a56613e4db11f3ce741a634b4fbd`; parked |
| D | `attempt-supervision-contract` | `work/attempt-supervision-contract` | `5421254d4563de3176d964eb18bca79d6786a56f`; parked |

First complete delivery remains Linux-first software development, one supported source, one active custodian, a small worker configuration and the owned Rust console. Pi is the development harness/retained adapter; Jaz is inspiration-only. Service-backed collaboration/borrowing is later. Only a qualified immutable external release with explicit controller handoff may govern a later candidate.
