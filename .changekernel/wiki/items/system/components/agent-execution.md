---
title: Agent Execution
aliases:
  - Agent Runtime
  - Pi Run Execution
source-id: cw:component:runtime
ownership:
  sourcePatterns:
    - src/adapters/pi/**
    - src/ports/agent-runtime.ts
    - src/ports/check-model.ts
  testPatterns:
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

The first operational path must separate ordinary client/worker privileges from the trusted custody writer. A protected native application host, dedicated service identity or qualified OS confinement can provide that boundary; an embedded library, another process under identical privileges or mode `0600` alone cannot. Containment must prevent applicable filesystem, handle, process and IPC bypasses, not merely hide filenames. Native source permissions must still be checked for the acting user rather than inherited from a more privileged service. The trusted host/OS remains an explicit trust boundary; this does not promise protection after that boundary or valid user credentials are compromised. Missing required isolation makes execution unavailable, not an invitation to trust an otherwise untrusted worker.

Typed mutations, native capabilities and restricted generated programs remain candidate execution representations; their exact supported combinations are unresolved. Composition is not permission to expose an unrestricted shell or database connection. A Preview is an optional bounded observation method, not a phase or authority; bind its exact artifact/environment, consumers, expiry, output and resource limits and report what the observation actually establishes.

Delegation must retain the originating request, owner, authenticated acting identity, Change/intent/plan and Kernel versions, scope, commitments and relevant limits. Changing workers or custodians does not transfer Change ownership or grant another actor's permissions. A recipient independently authorizes its attributable effects under current native policy, including legitimate contributions the originating user cannot perform directly; a message from another worker is not permission or a substitute for required approval. A restricted investigator cannot obtain an otherwise unauthorized effect by asking a more privileged worker. Legitimate escalation must establish the necessary authority explicitly. Separate contexts can reduce contamination, but neither separate agents nor different prompts prove independent evidence or independent mistakes.

Research Work can acquire and retain new source material under explicit access, disclosure, retention and resource limits. Retained artifacts become ordinary authorized source inputs with exact provenance, not executable instructions or automatically adopted facts. Bind exact procedure versions, required fresh observations and relevant history in the continuation context. Gather missing grounds separately from Check execution and retain the actual supplied inputs and omissions. [State](state.md#sources-observations-and-retained-research) owns source and memory custody; private session content is not a replacement for those records.

A Change may span many bounded attempts and batches without preallocating an enormous task graph or holding a long transaction. Classification and decomposition do not multiply budgets or authority. Preserve aggregate commitments across related Changes and Work, and expose partial results and unresolved obligations. Autonomous learning can prepare memory updates, but publishing adopted knowledge or procedures uses the same protected Change path. No internal learner gains an alternative write route or permission to revise its own governing rules.

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
