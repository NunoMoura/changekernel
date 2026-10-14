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

The engine owns Work eligibility, attempt identity, dependency/continuation semantics and accepted outcomes. Hosts and native bindings supply authenticated execution and effects; Pi is the selected initial user interaction and agent runtime. The [lifecycle milestones](change-format.md#lifecycle-milestones-and-execution-admission) bind decisions, sufficiently specified Work, execution admission and evidenced conclusions without a mandatory Stage field or sequence of model calls. A person or deterministic native operation can perform Work without an agent.

The [initial Pi-user distribution](package.md#user-distribution-and-deployment) follows supported native/client contracts; it does not make private sessions, task queues or checkpoints authoritative Change history. A durable Change can wait for months while agents stop or change. Reuse suitable scheduling/execution mechanisms rather than build a general-purpose scheduler, and do not treat ordinary session persistence as a durable work queue.

This contract distinguishes the **first trusted-host profile** from **later untrusted-worker and standalone-host profiles**. [Research](../research.md) retains investigated mechanisms without making them dependencies. Existing [Linux packet ingress](native-profiles.md#linux-local-packet-ingress) and Pi adapters keep their unchanged narrower contracts.

## First trusted-host profile

Start with one authenticated user, one trusted host integration, one binding and one bounded typed operation. No arbitrary generated-code worker, custom evaluator code, model provider or recursive runtime is required. A thin operation/inspection client is enough. The host may be embedded in an existing application; building a new privileged service is not a core prerequisite.

The trusted host must establish identity independently of request data, supply a supported native operation context, protect custody from its untrusted clients, serialize accepted progression and expose real outcome/recovery evidence. The engine validates requests and enforces current Change/Check/subject rules through that integration. A declaration that the host is trusted is not an implementation or qualification result.

**Threat-model limit:** this first profile does not protect against compromise of the trusted host or hostile processes with the same effective storage/execution authority. Do not run untrusted programs with that authority or claim that an API convention prevents direct file/process bypass. A future multi-user or adversarial-client service must qualify its stronger isolation and identity premises before claiming them.

The native subject is the one explicitly established by this host/binding contract. This does not claim to reconstruct every arbitrary client's original Linux calling-thread credentials. It is not a privileged source-reader fallback for old contracts: frozen interfaces retain their original premises, and the [stronger historical host proposal](../research.md#ordinary-client-host-direction) remains deferred and unqualified.

## Admission and containment

Before a supported operation, establish current native rights, delegated scope and Change authorization, exact subject/version, applicable Checks and a bounded recovery path. Unsupported authority or evidence blocks the operation. Client-supplied identity, a matching hash, a model's confidence or a passing Check alone cannot supply these grounds.

The initial adapter invokes only declared native operations. It must not expose an unrestricted command, file proxy or dynamic plugin route disguised as a typed operation. Publish under the binding's actual concurrency and native authorization guarantees, not a preliminary permission check followed by an unguarded write.

When a later capability executes untrusted code, all its tools, editors, shell routes, generated helpers and descendants must share its qualified boundary. Protect authoritative custody and required evaluators from it. Candidate preparation is separate from guarded publication where that workflow promises independent pre-publication review. Writable scope alone does not prove semantic safety inside that scope.

Containment, native source authority, result evidence and Trace acceptance are distinct responsibilities. A sandbox does not authenticate the original input or prove a reported effect. An existing qualified executor may supply containment; a custom ChangeKernel launcher is not required merely to own dispatch. If no suitable executor meets the contract, keep that capability unavailable or explicitly propose a new profile.

## Durable attempts and outcome delivery

The Change Trace owns lifecycle history. Supporting attempt reservations, outputs and native receipts have explicit custody/recovery roles, not independent Work histories. Bind the relevant intent, adopted Check/settings and applicability grounds, operation/subject and any adopted plan/workflow versions, input, actor and retry identity before effects. These are accountability grounds, not a required Stage field.

For the first effect path:

1. Validate current authority, exact input/subject and applicable progression requirements.
2. Resolve the original request before allocating a new attempt; durably retain the admitted attempt under the consumed storage protocol.
3. Invoke the one supported native operation with its required version/concurrency guard and operation identity where available.
4. Reconcile the actual outcome using qualified native evidence; retain completed, failed, partial or unresolved status honestly.
5. Deliver the retained result only after required durability and current disclosure checks.

The [State contract](state.md#separate-stores-and-uncertain-outcomes) governs interruption between native effect and Trace completion. Do not repeat an unresolved effect, infer causality from matching final values, or relabel an old attempt under a new identity. Reopening or inspecting a Change is non-executing. A result lookup on a miss does not launch missing work.

Later provider/worker execution may need a separate protected reservation and retained output before the Trace references it. A crash after result retention is not permission to repeat inference. Conversation restoration, history reconstruction and saved-program execution are different actions. Executable replay requires fresh admission and reconciliation even when no model call occurs.

## Producer work versus Check execution

Producers prepare plans/content and gather observations through authorized tools. Checks assess explicit bounded inputs and report results; they do not mutate State, launch workers or silently gather missing evidence. Missing inputs produce a collection need, not an implicit permission to obtain them.

Initially, trusted deterministic validation and existing native constraints are sufficient. A user-authored evaluator is not trusted merely because it implements the Check interface. Later custom code runs outside authoritative host privileges under qualified filesystem, network, credentials, process, time, memory and output limits. The previously proposed JavaScript/compiled-TypeScript runner is a possible adapter, not a prerequisite. Other languages require their own support, not a new universal execution language.

Engine/native validators enforce supported semantics and integrity; custom domain criteria belong in adopted Checks. Release-owned and other supported evaluators retain distinct provenance and qualification, not independent authority to impose goal-quality vetoes. A Pack is a reusable collection of Checks: a caller cannot label it built-in, and obtaining it does not adopt requirements or trust its evaluators. A human approval is an attributable decision, not an invented passing evaluator result.

## Model and harness boundaries

Pi supplies the selected initial agent/user host; models and harness mechanics remain replaceable adapters rather than mandatory dependencies of deterministic native access. Product integration consumes the [ledger/file/operation/backend foundation gate](../../product/plan.md#foundations-before-agent-integration) only after its claims have evidence. They consume typed operations and [purpose-specific Change context Views](state.md#structured-history-access-and-context-projections), not a private conversation promoted to lifecycle authority. Human and deterministic clients must already be able to inspect and continue the supported core path. Bind authorized provider/model/settings, input disclosure, transport and resource limits before asynchronous execution. Keep credentials and public hashes of them out of portable records. A loopback URL does not establish local processing; unsupported redirects or fallback routes must not bypass disclosure policy.

Do not load ambient project extensions, tools, prompts or secrets implicitly. Explicitly qualify any compaction, retries, generated code and tool bindings. Missing usage is unknown, not zero cost; a completed prompt promise or idle session is not successful Work. Models used by read-only Checks do not inherit producer tools or conversation.

Current Pi adapters remain bounded integrations with their existing identities and tests, not the selected end-user product, a complete native lifecycle or a native Jev service. Host tools can use the future shared SDK; Codemode composes exposed tools rather than importing that npm client inside QuickJS. A script's success is not proof of nested-call success, and its failure/cancellation does not roll back effects. The supporting package's Pi 0.85.1 dependency is distinct from later installed or inspected releases. Do not replace an endpoint and infer equivalent semantic, authority or recovery guarantees. A future model adapter needs a concrete consuming capability and [bounded comparative evidence](../research.md#runtime-and-integration-research).

## Programmable strategies and bounded delegation

Programmable and recursive workers are intended later capabilities, not the core execution model. Reuse an eligible harness first. Own only the admission, inputs, scope, budgets, custody, result and continuation contract needed across its boundary. An owned model inner loop or Jaz-compatible language is not selected.

Expose authorized bounded history and explicit inputs without treating retrieved source text as governing instructions. Preserve original instructions and exact references across delegation rather than relying on a model's memory. Descendants cannot obtain broader permissions, fresh independent budgets or custody by receiving a function or configuration.

Nested reasoning need not create a new Change or Work item; actual governed Work creation and dispatch still use authorized operations. Account for aggregate resources, parent/child attempts, cancellation and unresolved results. Across process boundaries, use bounded data and qualified references rather than live backend objects.

Self-improvement can propose revised procedures, prompts or policies, but adoption uses normal Change controls. A proposal cannot activate its own weaker evaluator or replace its controller. Useful runtime ideas and applicable license gates remain in [research](../research.md#runtime-selection-and-research-basis), not a new mandatory evolution layer.

## Work selection and parallelism

[Ledger priority](change-format.md#ledger-working-set-and-prioritization) guides allocation but does not override readiness, dependencies, authority or native guards. A blocked high-priority Change can wait while eligible lower-priority Work proceeds; reprioritization does not undo running work. Planning and assessment may overlap with independent execution, with each Work unit bound to its actual intent/plan grounds.

Parallelism requires independently supported scopes and explicit conflict/aggregate limits. Calls sharing a custody-bearing native owner remain serialized, including reads; no fresh owner per method or competing continuation writer can evade that contract. A worker exit, queue exhaustion or successful API reply does not establish the Change's conclusion.

## Change handoff and continuation

[Sharing, handoff, fork, consolidation and contribution acceptance](change-format.md#collaboration-and-composition-rules) have distinct desired semantics and separately qualified protocols. Multi-user borrowing and forks are later capabilities. A Change has one logical authoritative history and at most one active continuation custodian. Authenticate the exact checkpoint and parties, current rights, recipient admission, in-flight Work responsibility and interrupted transfer before supporting them. A pathname, copied file, timeout or encrypted transport does not establish exclusive custody.

A recipient establishes current admission with exact applicable Check/settings and requirement-adoption grounds under current authority. Historical progress stays attributable; no portable effect-ready flag or folder placement bypasses new requirements. A fork has its own Change identity and does not repeat completed or uncertain effects. Result adoption preserves provenance without merging authoritative logs.

Moving a file does not cancel active Work. Reconcile effects and cleanup or transfer responsibility through a qualified protocol before dependent continuation. Unknown outcomes cannot become assumed absence. Retained review copies remain evidence, not independent authority to resume.

## State-triggered runtime responsibilities

Future automation consumes authorized observations under adopted standing intent. The runtime owns occurrence identity, deduplication, scheduling and bounded dispatch; Checks only assess supplied grounds. Native cursor gaps, reset, drift and revocation must be explicit. An observed condition is neither a passing Check nor a blanket effect grant. Trigger support is not part of the first operation path.

## Time bounds, cancellation and output

Every supported execution profile declares deadlines, output limits, cancellation semantics and cleanup responsibility. Cancellation is a request, not proof that a process or native effect stopped. Pending or failed cleanup remains nonterminal or unknown; it must not permit unsafe repetition. Native compensation is a separately admitted effect, not cancellation by relabeling.

When workers are supported, account for setup, descendants, provider activity and cleanup, not only leader exit. Cooperative timers alone cannot establish hostile-process containment. Required controls must refuse unsupported contexts before starting the payload rather than silently degrade.

Output lookup binds exact attempt/result, current disclosure, shape/digest and byte limits. Oversized, missing or evicted required bytes are unavailable, not silently normalized or truncated to fit a receipt. Output loss does not authorize another provider call. Retain evidence before depending on transient output.

Existing Pi/Git deadline, encoding, reservation and cleanup semantics remain unchanged in source/tests. The trusted-host milestone does not broaden them into arbitrary crash recovery or worker isolation claims. Each additional execution profile needs the [qualification](package.md#qualification) applicable to its actual threats and guarantees.
