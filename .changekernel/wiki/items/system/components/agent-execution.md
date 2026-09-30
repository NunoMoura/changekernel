---
title: Agent Execution
aliases:
  - Agent Runtime
  - Pi Run Execution
source-id: cw:component:runtime
ownership:
  sourcePatterns:
    - src/adapters/linux/local_packet.rs
    - src/adapters/pi/**
    - src/ports/agent-runtime.ts
    - src/ports/check-model.ts
  testPatterns:
    - tests/native_local_packet.rs
    - tests/adapters/pi/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:1c7bb9922d692274966dd169a4650920846d36a320f052087a44e548082308ed
        codewiki.legacy:source-path: system/components/runtime.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:runtime
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies isolated accountable execution for Project Server-issued Runs.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies isolated Code and Model Check execution without Result authority.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies immutable input and sandbox boundaries for authored Code Checks.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime mounts exact Run Context Bundles and receipts local queries, Work Continuity execution, and DSH compaction.
          target: cw:story:agent.retrieve-bounded-context
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:agent.retrieve-bounded-context
    - attributes:
        codewiki.legacy:relationship:
          rationale: Runtime supplies separately qualified outer Run Process and inner model-code containment.
          target: cw:story:maintainer.contain-model-code
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.contain-model-code
---
# Agent Execution

This contract covers authorized worker execution, read-only Check execution and retained custody. The [primary design](../../product/changekernel.md#intent-and-lifecycle) defines Decision → Planning → Execution as public Kernel stages. Execution reaches an observed and assessed outcome, not merely an agent launch or command exit. Planning assesses Work, dependencies, routes and parallelism; runtime code performs authorized dispatch, candidate preparation, protected effects, deployment where applicable, review and recovery. Checks supply judgments, not orchestration side effects.

The [coordination contract](../../product/changekernel.md#planning-and-work-coordination) owns Work composition. A worker may be a person, service or agent; typed operations need not launch a producer session. A replaceable harness owns session mechanics, not Workspace policy, acceptance or durable continuation. Intake capture/refinement remains within Decision. Admission permits bounded planning/pursuit; each later effect still requires current applicable assessment and native authority.

## Admission and containment

Bind originating owner, authenticated acting user, active custodian, exact Workspace/resource identity, selected Kernel version, intent/plan purpose, relevant State/candidate, role, prerequisites, allowed tools/effects, execution configuration and resource limits before launch. The host resolves user identity and existing application permissions independently of model output. Worker and agent identity are execution provenance, not replacement Change ownership. User-configured automation may exercise the user's shared-editing rights without an additional approval solely because the executor is an agent; native approval rules and explicitly adopted restrictions still apply. See [owner-directed automation](../../product/changekernel.md#owner-directed-automation).

Reject unavailable capability or unsupported enforcement rather than simulate success. Source text, generated instructions, receipt hashes and a user-supplied run identifier do not grant authority. Permission enforcement and attributable execution are system responsibilities; an agent's promise to stay within scope is not enforcement.

Enforce required filesystem, network, credential, descendant-process, memory, time, output and model-call limits before effects. Worktrees, scoped handles and isolated candidates alone are not sandboxes. Enforce commands, sockets, devices and elevation where relevant, not paths alone. Never run untrusted source with privileged hosting credentials. Preserve independent recovery when a supported operation can disable its controller.

Agents and other clients request [typed backend operations](state.md#backend-only-authoritative-writes); they never edit authoritative JSONL or assert their own acceptance. Isolated producers may write permitted candidate material and submit it for assessment. The protected backend owns admission, authoritative records and supported guarded publication. Do not leak publication credentials or permit a generic file/source operation to bypass custody or policy protection. A guarantee covering every source publication also requires enforcement by the native resource/endpoint; otherwise outside writes remain separately observed drift, not governed effects.

The first operational path must separate ordinary client/worker privileges from the trusted custody writer. The selected first Linux host is an administrator-installed local custody service with a dedicated protection identity, distinct from ordinary clients and generated workers. Its authoritative storage, executable/configuration, live controls, handles, processes and IPC require qualified protection; an embedded library, another process under identical privileges or mode `0600` alone cannot supply it. This is one deployment profile of the reusable engine, not a required service architecture for every application. Other hosts require an equivalent qualified boundary.

Containment must prevent applicable filesystem, handle, process and IPC bypasses, not merely hide filenames. Native source permissions must still be checked for the acting user rather than inherited from a more privileged service. The service is not a privileged source-access proxy, and generated source must never run with its custody privileges. Exact native credential acquisition, source enrollment, process/IPC isolation and identity lifecycle mechanisms must be settled before affected interfaces and deployment claims; administrator installation does not automatically select a managed login session, UID ledger or source relocation. The trusted host/OS remains an explicit trust boundary; this does not promise protection after that boundary or valid user credentials are compromised. Missing required isolation makes execution unavailable, not an invitation to trust an otherwise untrusted worker. The [first local recovery limit](state.md#first-local-recovery-profile) changes lost-incident knowledge after process loss, not these containment or authority requirements.

Typed mutations, native capabilities and restricted generated programs remain candidate execution representations; their exact supported combinations are unresolved. Composition is not permission to expose an unrestricted shell or database connection. A Preview is an optional bounded observation method, not a phase or authority; bind its exact artifact/environment, consumers, expiry, output and resource limits and report what the observation actually establishes.

Delegation must retain the originating request, owner, authenticated acting identity, Change/intent/plan and Kernel versions, scope, commitments and relevant limits. Changing workers or custodians does not transfer Change ownership or grant another actor's permissions. A recipient independently authorizes its attributable effects under current native policy, including legitimate contributions the originating user cannot perform directly; a message from another worker is not permission or a substitute for required approval. A restricted investigator cannot obtain an otherwise unauthorized effect by asking a more privileged worker. Legitimate escalation must establish the necessary authority explicitly. Separate contexts can reduce contamination, but neither separate agents nor different prompts prove independent evidence or independent mistakes.

Research Work can acquire and retain new source material under explicit access, disclosure, retention and resource limits. Retained artifacts become ordinary authorized source inputs with exact provenance, not executable instructions or automatically adopted facts. Bind exact procedure versions, required fresh observations and relevant history in the continuation context. Gather missing grounds separately from Check execution and retain the actual supplied inputs and omissions. [State](state.md#sources-observations-and-retained-research) owns source and memory custody; private session content is not a replacement for those records.

A Change may span many bounded attempts and batches without preallocating an enormous task graph or holding a long transaction. Classification and decomposition do not multiply budgets or authority. Preserve aggregate commitments across related Changes and Work, and expose partial results and unresolved obligations. Autonomous learning can prepare memory updates, but publishing adopted knowledge or procedures uses the same protected Change path. No internal learner gains an alternative write route or permission to revise its own governing rules.

## State-triggered runtime responsibilities

The ChangeKernel runtime owns admitted monitoring/trigger scheduling and proposal/continuation coordination; qualified source adapters own their native observation mechanisms. A source may expose polling, notifications or another bounded observation route without becoming a lifecycle authority. Keep the [standing rule and accountable owner](../../product/changekernel.md#state-triggered-automation) separate from the service or worker carrying out monitoring. Authenticate and authorize the resulting typed operation; an event's actor fields, condition result or external callback cannot grant authority.

Monitoring has explicit scope, deadlines, observation/retention budgets, recurrence limits, cancellation and recovery responsibilities. Bounded observations may use admitted Work; a connection, cursor or timer is not permission to execute application effects. Condition evaluation and applicable Checks remain distinct responsibilities: Checks assess exact supplied inputs and do not turn into watchers, dispatchers or effect executors. Deterministic conditions need no model call solely because their origin is automated.

Closing a frontend does not revoke an adopted standing rule or confirm termination of its active Work. Expose monitoring eligibility, pending proposals, missing/stale inputs, policy withdrawal and unresolved effects through authorized derived views. Rule withdrawal must fence future admission and reconcile already admitted or dispatched Work under its actual commitments. Reopening a view does not start monitoring or replay occurrences. The [durable occurrence/result association](state.md#scoped-monitoring-and-trigger-grounds), current guards and source-outcome protocol prevent retries from becoming fresh duplicate effects; an idle process, elapsed cooldown or advanced source cursor is not outcome evidence.

These responsibilities extend the existing runtime and lifecycle, not a separate automation engine, unrestricted event bus or new worker authority. Exact supported adapters, scheduling/storage interfaces and qualified failure semantics remain implementation gates. The first delivery remains Linux-first software development; no market feed, brokerage integration or trading execution is released by this contract.

## Ordinary-client host direction

The target is the [ChangeKernel-owned Rust terminal client](../../product/changekernel.md#operator-console-for-development), separate from eligible worker harnesses and using the shared backend. Preserve ordinary user workflows and existing repository locations where the qualified binding can support them. Pi remains the source-development harness and a retained integration adapter; compatibility with an ordinary Pi client does not make Pi the product frontend or a required engine dependency. This is the preferred design direction, not a claim that arbitrary sessions, filesystems or execution environments are already supported. Before requiring a managed login, repository relocation or a permanent UID-nonreuse policy, identify the concrete unsatisfied guarantee, assess a narrower mechanism and expose any unavoidable workflow cost. The selected administrator-installed custody service and local recovery limit remain unchanged. This direction selects neither a privileged helper implementation nor deployment permission.

### Separate the frontend from trusted execution

A frontend submits bounded typed input and displays authorized results. It need not be the source of authenticated owner identity, source-permission evidence, accepted assessments or effect receipts. The backend obtains those through protected native authority and custody paths. Therefore, protecting the writer does not by itself require replacing the user's login or trusting the entire frontend process. The existing [packet adapter](#linux-local-packet-ingress) supplies only its documented peer/byte observations; it does not establish enrollment or human intent.

Preserving an existing frontend also does **not** qualify its unrestricted shell, extensions or generated code as a governed worker. Protected Work needs a separately admitted execution boundary and attributable results. An ordinary client must not be able to launder a restricted worker's request into broader owner authority: the worker must lack access to owner credentials, owner-command IPC, client process/handle control and any forwarding path that would grant that authority. A worker route carries its protected Work/delegation scope and cannot choose the owner route using payload fields. The exact worker mechanism remains a prerequisite. Do not silently change a same-UID worker into a trusted owner process merely to preserve session reuse.

The preferred composition keeps three roles distinct:

| Role | Responsibility | Forbidden substitution |
| --- | --- | --- |
| Ordinary client | Submit intent/typed requests and inspect authorized views through the protected endpoint. | Client code, PID, session name or claimed actor is not a trust grant; client observations are contributions until independently established. |
| Native source-access helper | Perform a bounded operation under a freshly established, faithful native authority context and exact source binding; return attributable observations/outcomes over a protected channel. | No custody handles, generated code, arbitrary shell or source access under the service's greater rights. |
| Custody writer | Authenticate current enrollment/disclosure, enforce domain controls, reconcile exact retries and durably accept results under the recovery protocol. | No second authoritative helper history or privileged re-open that replaces the helper's native permission check. |

A short-lived protected helper per operation is a narrower candidate than a managed interactive login. It still needs a concrete trusted launch, credential acquisition, process/IPC protection and revocation protocol. It is not implemented by accepting a client's assertion that it ran a fixed binary. Ordinary client workflows and a protected helper are compatible design goals, not proof that the helper exists.

### Native credentials: useful observations and rejected shortcuts

Keep the actual primary and complete supplementary groups, filesystem IDs, relevant namespaces, capabilities and security restrictions in the authority analysis. Removing groups can broaden DAC/ACL access: for another owner's file in group `G`, mode `0604`, a supplementary member of `G` is denied while a nonmember receives `other` read access. Mode `0640` exercises the converse group grant. A fresh account-database lookup is not a capture of the requesting task's credentials; a different LSM subject is not automatically narrower. Any additional confinement must be proved to restrict, rather than replace, the required native authority.

| Candidate shortcut | What it establishes | What remains missing |
| --- | --- | --- |
| `SO_PEERCRED` plus per-message `SCM_CREDENTIALS` | Kernel-checked connected/sending PID and UID/GID under the adapter's constraints. | Supplementary groups, filesystem IDs, per-thread restrictions, durable account incarnation and source authority. |
| `SO_PEERGROUPS` and `SO_PEERPIDFD` | Supplementary groups from the socket's saved peer credentials and a reference to its saved peer process, respectively. | Not an atomic current sending-thread authority snapshot; no reproduction of filesystem IDs, Landlock/LSM policy, namespace view or later revocation. Reconnecting alone does not fill those fields. |
| `/proc` reads, PID pinning and before/after comparisons | Particular process observations, with lifetime pinning where correctly used. | No general proof that a task/thread did not change authority between observations and access. A pin protects process identity, not immutable permissions. |
| User-launched fixed helper or caller-opened source FD | A possible execution/descriptor path. | Trusted launch and resistance to preexisting tracing/injection; exact credential transitions; current permissions and freshness of the open. A descriptor may outlive revocation or have been transferred. |
| Service-side `initgroups`/UID switch | A newly constructed account context. | Faithfulness to the required acting context. It must not discard restrictions or exploit the group-deny/other-allow counterexample. |

A complete source-access contract must specify which native subject authorizes the operation and how that subject is obtained without client assertions. If proposing a separately authenticated user context instead of the calling task, justify its authority and preserve worker/delegation restrictions explicitly; do not silently redefine “acting user” to mean whatever context the service can create. Unsupported contexts make the source-dependent operation unavailable. Private historical delivery has its own current enrollment/disclosure checks and does not need a fabricated source context.

The source-helper path must bind current principal/enrollment, exact request and source/binding revision, operation/scope and response identity; observe credential and policy withdrawal at the required points; and keep its executable, launch configuration, descendants and result channel outside client/worker control. An independent result cannot be replaced by a typed Rust value constructed by the caller. Holding an enrollment guard cannot serialize arbitrary native ACL or namespace changes; supported observation/effect semantics still need their own point-of-use rules.

### Exec-mediated helper admission limit

A fixed set-ID helper cannot establish a faithful **pre-exec calling-thread** source context through post-exec credential checks alone. Linux v6.12, commit `adc218676eef25575469234709c2d87185ca223a`, resets saved and filesystem IDs to the effective IDs in [`prepare_exec_creds`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/cred.c#L254-L279), then assigns them again after set-ID handling in [`cap_bprm_creds_from_file`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/security/commoncap.c#L886-L973). The earlier values are not authenticated by observing the resulting helper IDs.

A concrete counterexample uses real/effective/saved group IDs `P/P/G`, with supplementary groups excluding `G`. Assume UID fields `U/U/U`, FSUID `U`, initial namespaces, a non-idmapped filesystem and no ACL, capability override or additional LSM denial. After a legitimate earlier set-GID transition, modern [`setegid`](https://man7.org/linux/man-pages/man2/seteuid.2.html) can restore effective group `P` without discarding saved group `G`; [`setfsgid(G)`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/sys.c#L916-L955) is then permitted without `CAP_SETGID`. Compare that entry with an otherwise identical thread whose FSGID is `P`. Executing a UID-only helper under a distinct non-root protection identity produces FSGID/saved GID `P` for both, also indistinguishable in these fields from an ordinary `P/P/P` entry. Retaining supplementary groups and checking aligned IDs after exec does not distinguish them.

For another owner's file in group `G`, mode `0604`, entry FSGID `G` selects group denial; reconstructed FSGID `P` selects `other` read. Restoring the caller's real UID for filesystem access therefore grants a read that the original point-of-use context denied. Mode `0640` gives the converse result, so guessing or adding `G` is not uniformly conservative either. The [permission-class selection](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/fs/namei.c#L345-L382) and [filesystem/supplementary group test](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/groups.c#L227-L235) are kernel behavior, not account-database inference. An owner-file-only restriction is insufficient too: entry UID tuple `U/U/D` with FSUID `D` can select `D` using its [saved-UID permission](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/sys.c#L874-L904); restoring FSUID `U` after exec reads a `U`-owned `0600` file that this entry context denied.

This is a logical counterexample to faithful current-subject authorization, **not** a claim that FSGID/FSUID alone confines a malicious worker: those example tasks retain IDs they could select themselves. It is not an installed vulnerability, a privileged experiment, erasure of Landlock restrictions or an impossibility result for every helper. Refusing unsupported entry contexts remains valid, but post-exec alignment cannot prove that the entry was supported. Caller assertions, account reconstruction or a PID/socket observation do not recover the lost proof.

A possible narrower repair is trusted admission before exec loses those fields, atomically bound to the actual executing thread and fixed installed image. Kernel/LSM-mediated admission is an identified candidate, not a selected API, policy, kernel minimum or deployment dependency. It would require privileged policy custody, support/version qualification, fail-closed installation/removal and explicit refusal of unsupported contexts; complete startup, namespace/restriction preservation, IPC, revocation and worker anti-forwarding still need proof. Do not silently impose that cost. Separately authenticated owner authority is a different subject and requires an explicit authority/authentication contract, not a reinterpretation of this failed caller-context path. Account lifecycle, source continuity and recovery remain independent gates.

The mixed-ID helper also has a distinct IPC obligation: [`SO_PEERCRED`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/net/core/sock.c#L1654-L1666) exports saved peer effective IDs, while [automatic SCM credentials](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/include/net/scm.h#L91-L103) use sending real IDs. At real UID `U`/effective UID `H`, those observations differ and the existing packet adapter must reject their mismatch. Linux permits [explicit SCM credentials](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/net/core/scm.c#L47-L65) naming a sender's effective/saved ID, but that fact neither selects a new helper protocol nor authenticates durable user enrollment. The accepted packet contract remains unchanged.

### Pre-exec BPF admission candidate, not an adopted dependency

Read-only Linux v6.12 inspection identifies a concrete admission point: [`bprm_creds_from_file`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/fs/exec.c#L1667-L1674) runs at the start of [`begin_new_exec`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/fs/exec.c#L1222-L1248), before installation of the new credentials. A system-wide `BPF_LSM_MAC` program at that hook could inspect the **executing thread's old `current->cred`**, obtained through [`bpf_get_current_task_btf`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/trace/bpf_trace.c#L771-L782), rather than the already-normalized proposed `bprm->cred`, a group leader or a client snapshot. The old credentials remain current until [`commit_creds`](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/fs/exec.c#L1374-L1399). This avoids the specific R13 information loss; it does not itself reproduce every native restriction or authenticate enrollment.

A narrow **candidate** entry profile would require aligned real/effective/saved/filesystem IDs, no capability-based widening, an exactly supported namespace/root and LSM configuration, and no unsafe tracing, shared filesystem context, seccomp or `no_new_privs` condition. It would preserve the complete inherited supplementary groups, not rebuild or subtract them. Unsupported entries would be refused, not launched with fewer restrictions or forwarded into an owner session. The aligned-ID check must occur on the old thread credentials: applying it to `bprm->cred` or helper startup state repeats the accepted counterexample. These profile restrictions are proposed costs, not selected product requirements. Any LSM domain transition must separately be shown faithful or narrowing; a BPF denial hook cannot establish that for arbitrary policies.

The hook supplies the actual file object used to derive exec credentials. Binding must cover that protected, lifetime-held object and exact installed bytes, mount context and policy version—not a pathname, `argv[0]`, numeric inode pair or caller-provided digest. A qualified static ELF helper is a narrower candidate than trusting a caller-visible loader path: the [ELF implementation](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/fs/binfmt_elf.c#L860-L903) opens `PT_INTERP` in the execution filesystem view. Static format, absence of generated code and protected installation must be established from the exact artifact, not asserted by the client. The helper still needs protected startup, descriptor cleanup, bounded request handling and process protection before source access.

**A dynamically attached denial program alone is insufficient.** The [unattached BPF hook](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/bpf_lsm.c#L20-L30) returns its default, which is [zero for the exec-admission hooks](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/include/linux/lsm_hook_defs.h#L52-L56). Other enabled policy can still deny exec, but this absent gate supplies no refusal. The [last link reference releases its program](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/syscall.c#L2995-L3054); LSM links use the [tracing release operation](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/syscall.c#L3215-L3275). An unpinned loader can therefore die while the installed helper remains executable. A helper launched through that gap can outlive reattachment with its original fields already lost. Checking that a gate is attached only when the successor accepts a connection does not prove that this helper passed it. Neither the `CONFIG_BPF_LSM` flag nor a bpffs filename is positive per-exec admission evidence.

Existing task-local storage suggests a narrower positive-evidence composition; this is **not** a frozen receipt schema or an implemented protocol:

| Boundary | Candidate mechanism and required refusal |
| --- | --- |
| Original thread and image | The protected exec hook checks the old credentials and fixed file, then records bounded pending admission in that task's storage under an exact policy epoch. Allocation/read failure or an unsupported context denies admission. Other BPF/LSM denials must remain denials. |
| Credential commit | The [committed-credentials hook](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/security/security.c#L1317-L1331) can finalize entry evidence, but is not successful userspace startup or source/effect evidence. Failed exec must leave no usable authorization; new exec must invalidate or replace old evidence. Coherent publication/lookup and nonleader-thread exec must be proved. |
| Kernel subject lookup | [Task-storage lookup accepts a pidfd key](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/bpf_task_storage.c#L90-L122); it is not a PID-number map. A fresh, single-threaded helper connection could provide a [kernel-saved peer pidfd](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/net/core/sock.c#L1856-L1887), paired with the actual message sender and current exec evidence. Opening a PID from an earlier packet, accepting a supplied pidfd or transferring a socket cannot substitute for this binding. |
| Receipt custody | Only the protected gate may create usable evidence. A compatible plain-value map could be [frozen against userspace writes](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/syscall.c#L2060-L2093), with [syscall write permission removed](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/syscall.c#L838-L849). Do not add `BPF_F_RDONLY` to task-storage creation flags as a substitute for freezing: its [creation mask](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/bpf_local_storage.c#L18-L18) and [allocation checks](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/bpf_local_storage.c#L671-L695) restrict flags, require `BPF_F_NO_PREALLOC`, BTF and bounded values. The [freeze interface](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/include/uapi/linux/bpf.h#L604-L614) explicitly permits subsequent BPF writes. Exact map/value compatibility and freezing still require qualification. Client/helper/worker access to program, map, link and pin handles is forbidden. |
| Fork, restart and policy replacement | A [new task starts without task-local storage](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/fork.c#L2338-L2341). Fork does not itself grant a receipt. Replacement policy/map epochs must reject surviving old receipts; missing, pending or stale evidence blocks source access. Pins may retain object references across loader failure, but supply neither reboot continuity nor a replacement policy's authority. |
| Writer and source operation | The helper must receive protected authorization for the exact current request/source/operation before any source-dependent work. The writer retains and verifies the exact approved links, maps and configuration through the operation/delivery guard. Missing or withdrawing policy closes admission before releasing those guards; uncertainty after an effect enters the existing recovery/reconciliation rules. Current enrollment, source permissions and worker scope remain separate checks. |

The [packet adapter](#linux-local-packet-ingress) exposes neither a peer-pidfd admission receipt nor a helper authentication protocol, and mixed-ID automatic message credentials still do not match its existing contract. No API change follows from inspecting these kernel facilities. A kernel receipt would prove only the checked exec entry in its policy epoch—not human intent, account incarnation, permission freshness at a later file access, exact source identity or an accepted result. The helper must use the inherited faithful source context at point of use; it must not read as its protection identity or the writer.

This candidate adds a real operating prerequisite: supported BPF-LSM hooks enabled in the active [LSM order](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/security/Kconfig#L265-L277), appropriate [kernel configuration](https://github.com/torvalds/linux/blob/adc218676eef25575469234709c2d87185ca223a/kernel/bpf/Kconfig#L92-L102), BTF/verifier compatibility, a protected privileged policy loader, protected artifact/map/link custody, and fail-closed boot, restart, removal and update handling. BPF build and GPL-compatible program requirements also belong in exact-artifact qualification, not an invisible new dependency. Sandboxed sessions whose `no_new_privs` forbids the protection-identity transition cannot be made supported by clearing the bit or forwarding into a less restricted frontend. The support/refusal profile needs user approval. A built-in gate trades this dynamic-policy lifecycle for kernel build/distribution custody; it is not a free repair or a selected alternative.

No BPF program was compiled or loaded and no policy, helper or kernel was installed in this assessment. Source inspection is not verifier, installed-kernel, protocol or release qualification. The user has approved one bounded design-only follow-up to examine exact admission evidence and lifecycle, the supported/refused-context matrix and concrete administration costs. This authorizes investigation of the candidate, not final adoption of its support restrictions or operating dependency. The mechanism and its limitations must return for review before adoption or implementation release; installation, privileged experiments and deployment remain separately gated. Ordinary frontend workflows and repository locations remain goals, not proof of this candidate's compatibility. Separately authenticated owner authority is still a different, unselected authority contract. Host/Trace implementation, worker anti-forwarding, account lifecycle, reboot-safe source continuity and the native-analyzer gap remain open.

### Account retirement without assuming a permanent UID ban

A numeric UID and username identify neither a person nor a durable enrollment incarnation. Minting a protected principal ID does not solve authentication if delivery still maps any holder of the same UID to that principal. Even identical `/etc/passwd` fields before and after a delete/recreate can conceal a new account. A watcher or cached account hash is not an interlock.

Two bounded alternatives must be assessed before selecting a permanent UID-nonreuse commitment:

- **Enrolled-account lifecycle interlock:** fence the old enrollment and outstanding delivery/execution authority before account deletion or reassignment, retain that retirement, and require distinct enrollment for a later account. Integrate every supported administrative route; an advisory uninstall hook or best-effort watcher is insufficient. This need not reserve all host UIDs forever, but it does require enforceable coordination for enrolled accounts and safe crash/reboot ordering.
- **Independent principal authentication:** authenticate an enrollment-specific credential in addition to native UID eligibility, with explicit enrollment, revocation, recovery and custody. A token left in files inherited by a replacement UID is not independent proof. This introduces a real secret-management or unlock cost and must not be selected invisibly as “ordinary login.”

Neither alternative is selected or qualified here. Losing the required enrollment/lifecycle proof blocks old-history delivery; it never transfers history, creates a replacement principal or authorizes deletion of retained grounds. Account retirement must reconcile outstanding Work separately from closing a client window. The host/administrator trust boundary does not excuse an unhandled ordinary account-replacement path.

### Evidence and qualification boundary

These findings use [Linux credentials](https://docs.kernel.org/security/credentials.html), [unix(7)](https://man7.org/linux/man-pages/man7/unix.7.html), the Linux v6.12 [`SO_PEERGROUPS`/`SO_PEERPIDFD` implementations](https://github.com/torvalds/linux/blob/v6.12/net/core/sock.c) and [saved UNIX peer credentials](https://github.com/torvalds/linux/blob/v6.12/net/unix/af_unix.c), [Landlock inheritance and descriptor semantics](https://docs.kernel.org/6.12/userspace-api/landlock.html), [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html) and [passwd(5)](https://man7.org/linux/man-pages/man5/passwd.5.html). Kernel credential and Landlock restrictions can be per-thread; saved socket groups and a process handle do not export a complete current authority context. Documentation/source inspection selects no kernel minimum, LSM, service manager, authentication package or new adapter API, and is not an installed test.

Before freezing the host, challenge group-deny/group-grant and ACL ancestors; sending-thread versus leader credentials; restrictions applied after connection; transferred/stale handles; helper tracing/exec/namespace substitution; restricted-worker forwarding; revocation before reply; account deletion/reuse with unchanged public fields; and interrupted retirement/enrollment. Preserve the [source enrollment and continuity boundary](state.md#in-place-source-enrollment-and-continuity) and all existing recovery/qualification gates. A credential-snapshot value cannot by itself satisfy host authorization.

## Linux local packet ingress

The first local host uses a small Linux `AF_UNIX`/`SOCK_SEQPACKET` adapter as the byte-and-peer boundary for its protected control plane. This component is independently implementable before the domain dispatcher and custody writer. It does not create an access-bearing Change endpoint, authenticate a durable account incarnation, authorize a source operation or qualify the service. In particular, `ucred` does not supply supplementary groups, filesystem credentials, capabilities, namespace/LSM restrictions or a faithful source-access context. Native source access, enrollment/revocation, process protection and the complete storage protocol remain separate prerequisites; none may be inferred from successful IPC.

The trusted host supplies an already bound/listening descriptor and a currently eligible native UID for each serialized request. It must protect the endpoint, keep the enrollment/policy guard valid through callback and reply, and resolve the semantic owner independently of payload claims. The installed service process itself creates/listens on the socket and handles replies; socket activation or listener handoff from a different process is not supported by this first component. This is not a service-manager selection. Privileged processes capable of forging credentials and compromise of the trusted host/OS remain outside the stated protection boundary.

The bounded library surface is `changekernel::local_packet`, available only on Linux:

```rust
pub const MAX_PACKET_BYTES: usize = 196_608;

pub struct PeerCredentials {
    pub pid: i32,
    pub uid: u32,
    pub gid: u32,
}

pub enum PacketIssue {
    Denied,
    InvalidInput,
    Unavailable,
}

pub fn serve_one<F>(
    listener: &std::os::fd::OwnedFd,
    expected_uid: u32,
    handler: F,
) -> Result<(), PacketIssue>
where
    F: FnOnce(PeerCredentials, Vec<u8>) -> Result<Vec<u8>, PacketIssue>;

pub fn request(
    endpoint: &std::path::Path,
    expected_service_uid: u32,
    payload: &[u8],
) -> Result<Vec<u8>, PacketIssue>;
```

`PeerCredentials` is a data observation from Linux, not a freely transferable authorization token. `expected_uid` and `expected_service_uid` are trusted configuration/guard inputs, never extracted from a packet. This layer deliberately does not select a JSON schema, command vocabulary, Workspace descriptor, retry namespace or persistent representation. Its callback will be the trusted, closed typed dispatcher, not a raw-append or generic shell/file capability. Existing `container_id` APIs and SQLite profiles remain unchanged.

The adapter has the following exact behavior:

- Validate the supplied descriptor as a listening pathname `AF_UNIX` `SOCK_SEQPACKET` socket with `O_NONBLOCK`, `FD_CLOEXEC` and `SO_PASSCRED` already enabled. The host enables credential receipt before listening, so data queued before `accept` is covered. Invalid/unsupported descriptor configuration is `InvalidInput`; the adapter does not bind, unlink, chmod, change process identity or repair an endpoint. It does not own the borrowed listener's lifetime.
- Each `serve_one` accepts at most one connection, consumes one nonempty packet, invokes its callback at most once and sends at most one nonempty reply. Packet and reply bounds are independently 196,608 bytes. No batching, fragment reassembly, automatic retry, second callback or interpretation of trailing queued packets occurs; the accepted connection closes on every exit. Input exceeding the bound or transport truncation is rejected before callback entry, never accepted as a shorter request.
- Before dispatch, require a positive peer PID and the configured UID from `SO_PEERCRED`, then exactly one complete kernel-validated `SCM_CREDENTIALS` record accompanying the packet. Its PID, UID and GID must equal the connected peer tuple. Missing or mismatched credentials deny dispatch. This rejects a different process sending through an inherited/transferred connection even when the connection's cached credentials still name an allowed user. Payload bytes cannot change the observed tuple. This does not turn a numeric PID into a durable process identity or claim to prevent an authorized client deliberately forwarding its own permitted results.
- Accept no other ancillary capability. Use bounded control storage and `MSG_CMSG_CLOEXEC`; close every delivered descriptor, including descriptor-bearing ancillary forms, before rejecting unsupported control data or `MSG_CTRUNC`. Do not leak `SCM_RIGHTS` or PID descriptors on any failure path. The kernel closes descriptors not delivered because the control buffer was truncated; the application still owns those actually delivered. Unexpected non-credential ancillary data is `InvalidInput` and never reaches the callback.
- The client creates a nonblocking, close-on-exec sequenced-packet socket with credential receipt enabled before connecting. Its endpoint is an explicitly supplied absolute native pathname of at most 107 bytes, without NUL. Preserve native bytes, including non-UTF-8 names; never use display/lossy conversion to address the socket. Abstract endpoints are unsupported; a client-side kernel autobind caused by `SO_PASSCRED` is not an abstract service endpoint. Verify the service UID through `SO_PEERCRED` before sending and verify the reply's credential tuple against that same peer before returning bytes. Do not discover another endpoint or fall back to another transport.
- Socket waits use monotonic deadlines and nonblocking operations. The server has one five-second accept/receive budget and a fresh five-second reply budget after the callback. The client has one five-second connect/send budget and a fresh five-second receive budget. `EINTR` and readiness races do not reset a deadline. The trusted callback's execution is not included in a claimed transport time bound; its domain implementation must establish its own limits. Ensure the supported send-buffer capacity can carry a maximum packet, or return `Unavailable`, rather than silently lower the payload limit. Use `MSG_NOSIGNAL`; peer loss must not terminate the process with `SIGPIPE`.
- `Denied` means a credential check failed. `InvalidInput` means invalid caller arguments, descriptor configuration or packet/control framing. Syscall failures, deadline expiry, EOF and unsupported platform facilities are `Unavailable`, not a fabricated domain permission decision or proof of rollback. A callback error closes the connection and is returned unchanged to the server caller, without an invented wire error envelope; domain outcomes must be encoded by the later typed dispatcher. A successful server return means the response packet was submitted to the socket, not that the client received or accepted a domain result. The client performs no retry; lost replies require the domain's exact-operation reconciliation.

Source acceptance exercises the public adapter with disposable, unprivileged pathname sockets: binary and maximum-size round trips, data queued before accept, native non-UTF-8 endpoint identity, configured-UID and service-UID rejection without callback entry, inherited connection use by a different process, empty/oversized packets, ancillary-descriptor rejection without leaks, peer closure and bounded timeout/cleanup. Test kernel observations rather than caller-constructed credential structs. Same-user fixtures do not qualify cross-UID worker isolation, account lifecycle, source permissions, service installation or reboot recovery. No source-controlled code, installed ChangeKernel controller, privileged action or model call is needed for these checks.

The Linux mechanisms and limits are grounded in [`unix(7)`](https://man7.org/linux/man-pages/man7/unix.7.html), including the distinction between cached peer credentials and per-message credentials, native pathname bounds, socket buffering and descriptor truncation. This selects a mechanism and component contract, not copied implementation code or adoption of another product's trust model.

## Change handoff and continuation

Worker/process custody and active custody of a Change are related but distinct. The [borrowing/forking model](../../product/changekernel.md#routing-borrowing-and-forks) permits the same Change file to travel between users' private folders and Kernels; the originating host need not remain its permanent coordinator. Keep one authoritative logical history and at most one active custodian. Folder sharing, file possession and editable owner fields do not establish this relationship.

Before supporting a transfer, define and qualify exact checkpoint and party authentication, allowed continuation, guarded acceptance/return, stale-holder rejection, interrupted transfer, cancellation and outstanding Work responsibility. Source custody must not remain independently writable after recipient acceptance. An inactive retained copy is evidence, not authority to resume. Neither timeout, copied bytes nor encrypted transport provides exclusivity by itself. Where freshness or custody cannot be established, stop dependent effects rather than accept two live authorities.

The receiving user selects an exact Kernel version and establishes applicable admission before continuation. Historical progress remains attributable; evidence may be reused only within its actual validity. Do not inherit a universal approved flag or silently resume another Kernel's Execution-ready state. A new child/fork starts its own Decision regardless of its parent's stage. Each Work item still belongs to one Change and each attempt retains its own identity and outcome.

Forks create new Changes with explicit origin checkpoints; they do not reset or replay completed/uncertain source operations. Review copies remain read-only. Result adoption preserves provenance without merging authoritative histories. Parallel candidate exploration may be admitted while publication remains waiting on an explicit choice and current resource guards. Budgets, privileges and physical resources are not multiplied by forking or routing.

Active Work is not cancelled by moving a file or creating a fork. Before a dependent continuation, reconcile effects and process/provider custody or transfer responsibility through a qualified protocol that prevents stale effects. Unknown outcomes cannot become assumed absence. A cancellation of one independent pursuit does not automatically cancel another, but revoked native rights remain binding. These [protocol prerequisites](../../product/changekernel.md#dependency-gated-implementation) block handoff/dispatch claims until resolved, implemented and qualified; they are not supplied by the current Pi adapter.

## Producer work versus Check execution

Producers generate missing plans, content or programs and gather observations through authorized tools. Checks receive explicit bounded inputs, compute and optionally call shared semantic operations; they do not mutate State, run experiments or silently gather fresh material. Models called by Checks have no tools or inherited producer conversation. Input omissions, redaction and truncation must remain visible.

Custom Check functions run outside the authoritative host process under qualified controls. Backend and domain evaluators share machinery while retaining distinct owner, assessment scope and implementation/configuration identities. Release-owned questions and bytes come from a verified immutable build; domain definitions come from authenticated adoption. A caller cannot label a Pack as built-in or use a matching hash as proof of governing policy.

The initial language direction is JavaScript/compiled TypeScript; other runners require separate support and qualification. A library declaration, cooperative callback or consistent receipt alone is not containment. Local-only policy covers supporting services and forbids remote fallback, not merely remote-looking endpoint names.

## Model and harness boundaries

The host binds authorized provider/model, settings, transport limits and an opaque credential version before asynchronous execution. Keep credentials and public hashes of them out of portable records. Enforce disclosure policy for every submission. Reject unauthorized redirects; bound decoded response and error bodies before parsing, including framing not exposed as model output. A decoded-body limit does not establish socket/header, decompression or hard-memory bounds.

Current Pi code handles structured-text Check requests without producer tools, inherited conversation, automatic repair, retry or fallback; producer sessions use the existing harness rather than a second agent loop. Native Jev questions/batching require deliberate integration, not an endpoint substitution. Loopback routing proves neither local processing nor provider honesty. The generalized semantic contract remains [provider-independent](../../product/changekernel.md#semantic-operations-and-jev).

Producer models, settings, resource loaders and tool bindings must be explicit. Do not discover ambient project/user extensions, skills, prompts or credentials implicitly. Enable retries or compaction only when their effects and budgets are supported and bound. A resolved prompt promise or idle agent is not successful terminal execution. Private session logs are not accepted Evidence; resume requires exact identity, current authority and custody reconciliation.

Require explicit completion, bounded output and credible usage accounting. Missing/inconsistent usage is an operational failure, not zero cost. Do not double-count provider-reported reasoning already included in output usage. Retain exact request/result identities and operational failures; malformed model output must not become a fabricated passing judgment.

## Programmable strategies and bounded delegation

Keep the producer runtime replaceable. A qualified runtime may combine deterministic computation, model reasoning, generated programs and recursive invocations without prescribing a separate engine workflow for every reasoning strategy. Decision → Planning → Execution governs accepted pursuit and effects, not a fixed sequence of model calls. Generated plans, helpers and orchestration remain proposals or bounded execution within admitted Work; they cannot silently replace its scope or requirements.

Provide explicit named inputs and bounded programmatic access to authorized history, including exact lookup, text search, filtering and inspection of retained grounds where supported. Summaries need not be the agent's only memory. Use the [history and context separation](state.md#structured-history-access-and-context-projections): a producer may construct working context but cannot edit accepted history or treat retrieved source text as governing instructions. Input roles, provenance, versions, omissions and disclosure limits remain explicit even when prompts, data and tools share one programming interface.

Delegated reasoning must preserve original intent and exact instructions/references rather than depend on a model copying them from memory. Account for nested invocations under the admitted Work/attempt, parent relationship, tool/effect scope, aggregate resources and cancellation responsibility. A nested call does not automatically create a new Work item or Change; creating or dispatching additional governed Work still uses the engine's authorized controls. Dynamic scoping is a convenience, not authority inheritance: descendants cannot gain permissions, fresh budgets, credentials or custody by receiving a function or changing configuration. Exact child-run, accounting and recovery contracts remain prerequisites to support.

Across isolation or process boundaries, use bounded data and qualified references/handles, not live authoritative backend objects or an assumption that in-memory references survive restart. Generated code must remain outside the custody writer's privilege boundary. Language-level restrictions, runtime hooks, return-type validation and cooperative resource guards can assist execution but do not replace native authority, mandatory assessment, hard containment or credible cleanup. Producer recursion does not extend the separate read-only Check execution contract.

Self-improvement can inspect authorized outcomes and prepare revised prompts, helpers, strategies or Kernel versions. Bounded experiments and working-context changes remain within their execution admission; publishing reusable guidance or changing adopted definitions requires assessment of the exact candidate and current Change controls. Optimization does not rewrite original intent or authorize its own weaker evaluator or controller replacement. Controller changes retain separate qualification, activation and handoff requirements. Retain failures and changed configurations as attributable evidence rather than presenting later success as the original result.

### Runtime selection and research basis

ChangeKernel owns its Rust core, orchestration and [agent interaction contract](../../product/changekernel.md#intent-and-lifecycle). The design is not a whole-product fork or a stack of adopted agent frameworks. Reuse established mechanisms where they fit, but retain ownership of admission, Work, effects, assessment, continuity and recovery. Ground-up composition does not require rebuilding commodity libraries or discarding accepted source implementations.

Rig, `rust-genai`, `pie` and `pi_agent_rust` are inspiration, not selected framework or provider dependencies. KISS remains reference-only rather than a product dependency. The reviewed `pi_agent_rust` license has a nonstandard rider affecting analysis and use; no further source-derived reuse is released without clearance, and calling it inspiration does not resolve that gate. Any permitted copied or adapted code needs exact source provenance, applicable license/notices, bounded maintenance ownership and tests of the actual integrated contract.

Hermes and OpenClaw are also inspiration-only, not dependencies, product forks or adopted control planes. Useful operating patterns may be reimplemented in Rust under ChangeKernel's contracts; their persistence, recovery and permission assumptions do not transfer with the ideas.

Herdr is a candidate source for selectively reusable Rust mechanisms, not the product architecture or UX to reproduce. Reuse requires a defined component boundary and qualification; terminal/session control cannot stand in for accepted Work outcomes, protected custody, bounded cancellation or recovery. Worker adapters support only qualified capabilities, not universal interchangeability. Keep terminal handling, plugins and untrusted workers outside the protected custody-writer boundary.

Jaz supplies ideas for programmable strategies, recursive computation and addressable history that may be reimplemented in Rust. Do not embed Python Jaz as a substitute for Rust execution, require a Jaz-compatible language, or inherit its benchmark claims. The Rust requirement remains binding; whether any non-Rust external worker is eligible, and the scope of any owned inner loop, remain explicit contract decisions. Owning interaction routing alone does not decide those questions. The retained Pi adapter and historical TypeScript contracts are unchanged; no new public invocation API, runtime replacement, execution language or storage schema is selected here.

[Harness as a Language, v1](https://arxiv.org/html/2609.26891v1) motivates recursive computation and programmatic access to inputs/history. The reviewed [Jaz v0.2.0a4 source](https://github.com/jaz-lang/jaz/tree/0803d4971be785e95b80054b02259664d70fa3da) supplies implementation evidence, not a protected-host qualification. Its [replay hook](https://github.com/jaz-lang/jaz/blob/0803d4971be785e95b80054b02259664d70fa3da/src/jaz/hooks/builtin/replay.py) supplies saved model responses to executable turns, and its [hook dispatcher](https://github.com/jaz-lang/jaz/blob/0803d4971be785e95b80054b02259664d70fa3da/src/jaz/hooks/dispatcher.py) logs ordinary handler exceptions rather than automatically stopping execution. Neither behavior is an authoritative recovery or required-Check failure policy. Benchmark results motivate a [controlled runtime comparison](package.md#runtime-comparison-and-adoption), not adoption or claims about ChangeKernel outcomes.

## Durable attempts and outcome delivery

The file-first Change Trace log owns lifecycle history, including Work/attempt and result references. Protected execution reservations, retained outputs and unresolved/stopped outcomes may use supporting records with distinct responsibilities; they must not create another mutable lifecycle history. Bind the intent/plan/Kernel/procedure versions actually used. The exact Trace-backed versus supporting-store reservation/result protocol must meet the [persistence contract](state.md#file-first-change-trace-custody) before dispatch, without assuming that a post-execution append, a mandatory database or an ordinary private transcript provides equivalent custody.

1. Authenticate current authority and exact evaluator/worker, input and execution binding.
2. Durably reserve that binding before launching tools or model calls; serialize conflicting reservations across processes.
3. Execute under limits and settle provider/process custody and cleanup.
4. Durably publish the exact terminal result or explicit stopped/unknown outcome.
5. Under current continuation authority, reference the retained result in the Change Trace log when policy and source conditions permit.

Where result retention and lifecycle reference are separate steps, a crash between them leaves an unreferenced result, not permission to repeat inference. Restoring conversation context, reconstructing accepted lifecycle views and re-executing saved generated code are different operations. Executable trajectory replay is execution, not a retained-result lookup: saved responses and matching output do not authorize repeating an external effect. The [storage recovery boundary](state.md#protected-accepted-prefix-and-recovery-boundary), current authority and exact source-outcome reconciliation remain binding. Incomplete reservations, failed publication, corrupt state and unknown cleanup block unsafe retry. Do not steal a reservation because a process exited, time elapsed or capacity filled. Reopening must not initialize missing durable history or silently substitute a new store identity. Saturation must not evict necessary attempts or turn the same authorization into new execution.

Completed true and false results remain reusable only under exact input/evaluator/permission bindings and current authority/freshness. Authority checks can be repeated without consuming a one-shot budget or erasing an existing result. Check authority before custody access and again before delivery. Denial or cancellation of delivery does not delete completed execution. A later selection is not itself a reason to rerun inference; retain original authorization provenance.

Operator views derive from retained records with explicit freshness and coverage; inspecting status or reconnecting does not launch workers, Checks or inference. Expose Decision, Planning and Execution plus waiting, approval, custody transfer, applying, verifying and recovery states. Closing a terminal does not silently cancel host-owned Work. Commands bind authenticated actor, exact subject/version and retry identity; distinguish a requested control from its confirmed result.

A retained-result lookup is explicitly non-executing: no reservation, worker or model call on a miss. Operational failures are not Boolean judgments. Shared-store integrity and unresolved custody may restrict delivery according to the qualified binding. Retention authenticates custody only under declared trusted-host assumptions, not source truth, governing-policy authenticity or accepted Evidence.

Referenced results and required grounds must remain recoverable for declared history/retention. Machine-local paths alone cannot support portable continuation. Export respects access restrictions rather than copying private logs wholesale. A Change Trace-backed implementation can provide execution custody only with qualified exclusive reservation, completion, access and recovery guarantees; appending a result after execution is insufficient. Sharing exports only authorized individual material, never the user's entire folder.

## Time bounds, cancellation and output

Enforce authorization and execution deadlines through setup, dispatch, execution and cleanup. Existing local contracts admit at issuance inclusively and expire at the deadline exclusively; observing an already tracked handle is not new execution. Use wall-clock and elapsed-time checks so delayed timers cannot turn late completion into success. Preserve the first cancellation binding and timestamp closure after cleanup, not at earlier model completion.

Cancellation is a request, not proof of termination. Pending or failed cleanup leaves custody nonterminal or unknown, not quiescent. A cancellation during cleanup invalidates successful completion. Reconcile before another attempt; cooperative timers do not replace hard containment. Unknown external effects require trustworthy source-side outcome lookup, never semantic guessing.

Output lookup binds exact run, authorization and terminal receipt, with current access, digest/shape and byte-budget validation. Copy bindings before asynchronous lookup to avoid substitution. Never normalize content to make a receipt match; oversized, missing or evicted bytes are unavailable, not silently truncated. Output eviction does not change receipts or authorize another provider call. Capture required Evidence durably before depending on transient output.

The existing Pi/Git ports, bounded private execution log, session formats and output protocols remain narrower executable contracts with their original identities. Their custody and timing safeguards do not establish generalized producer recovery, physical crash guarantees, all budgets, public lifecycle progression or native Jev support. Exact existing encoding/limits remain in source/tests and Git history; broader claims require [qualification](package.md#qualification).
