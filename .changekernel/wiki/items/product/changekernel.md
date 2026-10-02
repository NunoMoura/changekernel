---
title: ChangeKernel
aliases:
  - ChangeKernel Hub
  - ChangeKernel Console
source-id: cw:design:product
ownership:
  sourcePatterns:
    - src/application/**
    - src/kernel/changes/**
    - src/kernel/data-contracts/**
    - src/kernel/identity/**
  testPatterns: []
  traceEvents:
    - change.proposed
    - change.revised
    - change.planned
    - change.completed
    - change.superseded
    - effect.recorded
  roles:
    - planning
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:dde8b062975e50edb38aa1962c5aede69723cfbfb757c30792f62c790eeb0c35
        codewiki.legacy:source-path: product/DESIGN.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:design:product
  relationships: []
---
# ChangeKernel

**ChangeKernel carries intent through accountable changes to the State of a system.** It is a redistributable State-and-Change engine: users choose goals, applications expose native abilities, and people, agents or automation perform authorized work. It is not an agent, a harness, a database engine or an operating-system security platform.

**Change carries intent. State describes observed reality within declared scope. History connects them with evidence.** Prior Changes explain how State evolved; they do not automatically justify its correctness. Rejected proposals have no intended effects, failed operations can have partial effects, and external changes need explicit reconciliation. Start an existing system from an acknowledged baseline rather than inventing its prehistory.

This page defines intended product responsibilities. A desired capability is not an implemented or qualified capability. The [ChangeKernel plan](plan.md) sequences small, testable capability increments. [Research](../system/research.md) retains hypotheses, inspected alternatives and counterexamples without turning them into product commitments. [Retained native profiles](../system/components/native-profiles.md) describe existing compatibility contracts, not the future API.

## Product boundary

| ChangeKernel owns | Why |
| --- | --- |
| Change identity, intent, revisions, scope and attribution | Intent and accountability must survive tools, sessions and failures. |
| Typed lifecycle operations and authoritative JSONL history | There must be one coherent account of accepted decisions, attempts and outcomes. |
| Decision → Planning → Execution progression and applicable Check enforcement | Approval, execution and success must have precise, distinct meanings. |
| State references, observations and evidence lineage | Plans and worker claims must not become invented actual outcomes. |
| Bounded execution coordination and reconciliation | Lost replies and partial effects must not cause blind repetition or false completion. |
| Host and binding contracts, including authority and custody obligations | Integration must expose supported guarantees and refuse unsupported ones. |

The user owns goals and accepted commitments. Resource owners and applications own native permissions, business rules and valid domain operations. Native systems retain their actual State. Qualified hosts supply authentication, native execution context and custody protection under a declared threat model. Harnesses supply session/inference mechanics. ChangeKernel validates and enforces the contracts it consumes; an interface declaration alone does not prove that a host meets them.

A mechanism belongs behind a replaceable boundary when it can change without weakening these invariants. Reuse suitable storage, transport, model, execution and OS facilities. Do not build a new runtime, semantic compiler, identity system or sandbox merely to own its implementation.

## Contract map and truth boundaries

| Document | Responsibility |
| --- | --- |
| [State and persistence](../system/components/state.md) | Native State, evidence, JSONL acceptance, retries and recovery. |
| [Checks](../system/components/checks.md) | Engine invariants, configurable assessment policy, exact subjects and results. |
| [Execution](../system/components/agent-execution.md) | Trusted-host integration first; later worker coordination and containment contracts. |
| [Release and qualification](../system/components/package.md) | Supported capability claims, source tests, exact-release qualification and controller authority. |
| [Phased plan](plan.md) | Dependencies, falsifiable propositions and evidence required to advance. |
| [Research](../system/research.md) | Investigated mechanisms and limits, not an implementation queue. |
| [Retained native profiles](../system/components/native-profiles.md) | Frozen SQLite/native/packet behavior and known implementation gaps. |

Wiki owns durable intent and capability gates. Source/tests own executable behavior. Git retains history and completed review evidence. The [temporary status note](../../../../CHANGEKERNEL_STATUS.md) owns unfinished source-development work until qualified Changes and Work can own execution state. No standalone refactoring roadmap or second lifecycle database is required. The retained `wiki/` name does not make Wiki a runtime primitive or require application State to be Markdown. Legacy metadata is historical provenance, not managed adoption.

## First supported scope

The first target is a **trusted-host, single-user engine profile with one binding and one bounded typed operation**. Its useful witness is an intent-bearing transition that can be inspected, refused when unauthorized or stale, executed through the native binding, reconciled after interruption and reopened without repeating effects. It needs no agent, model, custom evaluator runtime or rich console.

The host supplies authenticated identity and a supported native operation context independently of request payloads. It must enforce its declared access/custody boundary. Input remains untrusted; host compromise and hostile processes sharing the host's storage/execution authority are outside this initial profile. Do not market this as protection against them. A standalone adversarial-client host, including faithful original calling-thread admission, is a **deferred stronger profile**, not a prerequisite and not satisfied by the narrower one.

This scope change does not relax existing frozen native APIs, authorize a privileged fallback, or qualify any installed host. [Phase-specific evidence](plan.md) must precede the corresponding capability claim. The initial engine release is distinct from a later autonomous self-development release.

## Ownership model and responsibilities

**Users participate in Workspaces. Their Kernels govern Changes to those Workspaces. State represents a Workspace at particular versions and scope.**

| Concept | Meaning |
| --- | --- |
| Workspace | The persistent, identified subject with explicit resource boundaries and established authorities. Use `workspace_id` in the new contracts. It is not a mandatory process, database or directory. |
| State | A scoped, version-/time-bound representation of a Workspace. Retained observations are evidence, not necessarily complete snapshots. |
| Change | A user-owned pursuit of a transition, preserving intended and actual outcomes separately. A proposal is already a Change. |
| Kernel | A user's versioned Decision → Planning → Execution definition and selected Checks. It is not the engine implementation. |
| Work | An attributable unit of pursuit belonging to one Change. The first path needs one planned operation, not a generalized scheduler. |

Each Change has one originating owner and one fixed Workspace. Contributions remain attributable to their actual actors; borrowing cannot rewrite earlier attribution. Original intent is not overwritten to fit eventual delivery. Owning a Change never grants rights over its target resources.

### State access and Change authorization

A permitted effect requires **native resource rights ∩ current delegated scope ∩ Change authorization**, plus applicable subject/freshness, Check, custody and outcome guards. A passing Check or user approval cannot override native denial. Native write access does not approve every transformation.

The host/binding must name and establish the authenticated acting subject and native authorization context it actually supports. Do not accept a caller's actor field as proof, retry with broader broker rights, or treat a prior permission Boolean as point-of-use authorization. The initial profile trusts the qualified host integration; it does not claim to reconstruct an arbitrary Linux client's original thread context. The deferred stronger proposal and its failed shortcuts remain [research evidence](../system/research.md#deferred-host-profile-evidence).

### Relationship cardinalities

A user may own multiple Kernels and join multiple Workspaces. A Workspace may have multiple users and State representations; each representation has explicit coverage and visibility. A Change can reference multiple State observations and Work items; each Work item belongs to one Change. Kernel versions are immutable. A Change may use different Kernel versions in attributable continuation segments, not through retroactive replacement.

A Change has at most one active continuation custodian. Dependencies form a graph, not a mandatory tree. Fork lineage does not itself create a dependency. These are long-term logical relationships, not requirements to implement multi-user custody or a graph scheduler in the first profile.

### User Kernels and version selection

Bind progression to exact intent, Kernel, applicable Check and plan versions. New versions do not rewrite old decisions. Explicitly assess a continuation under changed policy before it authorizes new effects. The first profile can use one fixed, versioned policy; user authoring and distribution are later capabilities.

## Workspaces, membership and boundaries

Connect to native files, records and services through declared bindings. Tracking is not write permission; read-only resources can constrain a Change, and a creation scope can cover future resources without pre-enumerating filenames. Workspace membership does not disclose every user's private Changes. A user-bound Change folder is not a sharing unit.

### Owner-directed automation

Automation is an intended later capability under adopted intent and current delegation. Human approval is required where policy requires it, not at every deterministic operation. Standing permission is bounded by subject, scope, allowed effects and revocation; it is not blanket authority to change software, deploy or alter policy.

### State-triggered automation

Future triggers consume authorized scoped observations and create or continue Changes through the same pipeline. Observation is not authorization. Version/cursor identity, duplicates, gaps, reset, revocation and uncertain outcomes need binding-specific evidence before a trigger is supported. No universal monitoring service, complete event stream or automatic repair guarantee follows from the product goal.

## Developer experience

An application exposes observations and typed operations with native constraints, authority, version/concurrency semantics, result evidence and recovery limits. A small explicit binding is acceptable and preferred for the first witness. The same engine must remain useful without semantic inference.

### Nothing exists

A developer can provide a creation boundary and a native constructor. An empty system is not permission to invent arbitrary resources or schemas. Unsupported creation remains unavailable.

### Structures exist without records

Declared structures and operations can support creation before records exist. Validate native constraints; do not require synthetic seed data or infer existing State from a schema.

### Structures and records already exist

Observe only necessary authorized scope in place. The engine does not require moving a repository, copying a database or generating a universal State mirror.

### Reopen and inspect

A fresh client can inspect retained intent, decisions, actual outcomes, unknowns and next permitted operations. Reopening history does not execute a plan or restore authority from possession of a file.

## Discovery and bindings

ChangeKernel owns the **versioned integration contract**, not mandatory discovery machinery. A binding identifies supported queries/effects, input/output types, resource scope, native authority, version guards, outcome evidence and reconciliation limits. Preserve the exact binding interpretation needed to understand historical actions.

Prefer authoritative native declarations and small explicit adapters. Automatic source analysis, semantic classification and binding synthesis are possible future developer conveniences. Generated bindings must satisfy the same contract and be independently validated; inferred concepts are not observed resources or new permissions. A compile-time synthesis pipeline, particular model or dynamic JavaScript artifact is not required by the core.

“Any system” means extensibility through qualified bindings. It does not mean universal CRUD, identical transactions, exact replay of arbitrary external systems or uniform rollback. A genuine capability gap may become a later development Change; lack of an autogenerated binding alone does not prove such a gap.

## State, evidence and recovery

The [State contract](../system/components/state.md) separates observed, desired and candidate State. It retains the baseline and confirmed effects needed to explain a transition, while acknowledging external changes, incomplete observations and uncertainty. History reconstruction rebuilds lifecycle views; it never blindly replays effects.

JSONL is the canonical durable Change language, not an export after another database accepts lifecycle decisions. Typed backend operations construct authoritative records. Clients cannot append arbitrary events, fabricate passing assessments or replace accepted history. Necessary acceptance controls and native receipts have explicit roles; they do not become competing Change histories.

Sharing information and transferring active continuation are distinct. Git and file copies can transport evidence but cannot grant execution authority or prove that a copy is latest.

## Ledger, Change files and derived context

Build the foundations before integrating a product AI-agent layer: **user-owned Change ledger → individual Change file → typed lifecycle operations → efficient backend navigation, Views and context**. The engine must be useful through human and deterministic clients without an agent session. The [foundation gate](plan.md#foundations-before-agent-integration) selects the evidence needed before optional agents become consumers of this backend.

A user's Changes folder provides their Change ledger for a system. The ledger is an owned collection of individual Changes, not a second lifecycle database or an automatically shared Workspace folder. Each Change has its own authoritative JSONL Trace; each accepted line is a bounded, attributable lifecycle-operation record. Recording an attempt and observing an effect's outcome remain distinct boundaries. Physical directory layout and transport do not establish ownership, authority or cross-file atomicity by themselves.

The primary navigation model is **origin + accepted tip + navigable middle**. Origin preserves the pursuit's original intent; the tip identifies the latest accepted operation; a reader's cursor selects the point being inspected. Moving the cursor neither changes the accepted tip nor grants active continuation. Stable operation identities/references are distinct from physical byte offsets. Timelines, current lifecycle Views and contextual projections are different consumers of the same accepted records.

**Change context is an authorized, purpose-specific View of a particular Change version and its referenced grounds.** The Trace anchors it; a versioned projector assembles it for understanding, Decision, Planning, Execution, review or continuation. Native State remains native, and externally referenced evidence retains its own version, custody, disclosure and retention requirements. Context identifies the selected prefix, projection interpretation, coverage and gaps; exact reproduction requires the relevant original inputs to remain available. A model summary can be a derived convenience, not replacement authority for intent, decisions, results or missing evidence. File content does not become executable policy or grant native permissions.

This gives a fresh person, deterministic executor or later agent continuity without making a conversation the Change's memory store. Rebuildable indexes and projection caches may accelerate access when justified by measured workloads; they do not replace accepted Traces or the distinct non-rebuildable acceptance controls. The [State contract](../system/components/state.md#structured-history-access-and-context-projections) defines the corresponding read and projection obligations.

## Intent and lifecycle

**Decision → Planning → Execution are the three public Kernel stages.** Review of actual outcomes remains within Execution. Deployment is a possible governed activity, not a fourth stage. Typed operations may satisfy boundaries without a model call or repeated human prompt.

### Decision admission and refinement

Capture What and the supplied Why without inventing missing intent. Clarification or revision is attributable and does not erase the original. Bind admission to the exact proposal, scope and applicable policy; refusal, deferral and withdrawal remain inspectable. Admission to pursue is not blanket effect authorization.

### Planning admission and refinement

Describe the admitted operation, exact subject/preconditions, expected outcome and recovery limits. A one-operation plan is sufficient for the first path. Later decomposition and routing are supported only when their coordination contracts are qualified. A changed plan or source can invalidate earlier assessments.

### Assessment responsibilities

The engine enforces authority, exact subject/version bindings, valid transitions, retained evidence and honest uncertainty. Selected Kernel and resource policies supply quality criteria and goal-specific passing conditions. Comparative value, feasibility judgments and engineering rigor may be useful defaults; they are not a universal release-owned verdict on which goals deserve pursuit.

Checks are read-only assessments. Only the authorized backend admits progression and records authoritative outcomes. The [Checks contract](../system/components/checks.md) distinguishes completed true/false assessments from unavailable, canceled or failed evaluation.

### Change granularity and classification

A Change should preserve one accountable pursuit, not mirror every file or tool call. Ordinary typed input need not be routed through natural-language classification. Later semantic routing can propose a query, clarification or Change, but cannot turn a read into an authorized effect or replace the owner's commitments.

## Planning and Work coordination

The first path has one operation and one durable attempt at a time. Work preserves inputs, authority, attempt identity, results and unresolved outcomes across process loss. A worker exit is not completion, and a retry is not a new opportunity to bypass an unresolved effect.

Future parallel Work requires independently admissible scopes, explicit dependencies, conflict rules and aggregate outcome review. The engine owns dispatch/continuation semantics; a harness owns its session mechanics. Do not build a universal task scheduler before a concrete multi-Work capability needs it.

## Routing, borrowing and forks

These are intended later collaboration capabilities, not initial delivery dependencies. Borrowing transfers an individual Change's active continuation, not its ownership or native permissions. The recipient establishes current admission under its applicable Kernel. Returning a result requires attributable provenance and current acceptance; it does not merge arbitrary authoritative logs.

The Rust borrowing analogy distinguishes inspection of an exact version from exclusive active continuation of an individual Change. A read snapshot is not a competing writer. Allowing readers of an immutable accepted prefix while a writer extends it is versioned-snapshot behavior, not an automatic consequence of Rust's same-value borrowing rules. Its actual custody, concurrency and interrupted-transfer protocol needs separate evidence; the first single-user file witness does not implement multi-user lending.

Forking creates a new Change from an exact checkpoint for an alternative pursuit. Retained copies, encryption and file movement do not enforce single-custodian continuation, revoke plaintext or prove freshness. Their protocols must be qualified separately before use. Dependencies across Changes do not imply atomic cross-Workspace effects.

## Semantic operations and Jev

Models can help interpret requests, propose plans, assess selected semantic criteria or discover useful bindings. They remain replaceable producers/evaluators with declared inputs, outputs, cost and authority boundaries. Typed core operations must not depend on them.

Jev is a potential integration, not a central mandatory service, frozen model choice or authority source. Its operation set, routing accuracy and utility need concrete evidence before adoption. Prior Jev/Jaz/runtime ideas remain [research](../system/research.md#runtime-and-integration-research), not prerequisites for the JSONL path.

## Change memory and procedural State

Future learning reuses retained evidence and proposes improvements through the same Change mechanism. Distinguish original intent, accepted history, private working context, research claims and adopted procedures. A transcript is not a second lifecycle authority, and useful feedback is not automatic policy adoption.

Procedures and reusable knowledge require provenance, visibility, applicable version/scope and an explicit adoption boundary. Revocation, stale sources and contradictory evidence constrain reuse. A fresh worker can receive authorized context without inheriting authority from a previous conversation. Learning machinery is not required to demonstrate the first transition.

## Frontend guidance and responsiveness

Clients request typed operations and present current status, intended/actual differences, evidence, blockers and next permitted actions. Progress feedback cannot precede the acceptance it claims. Read-only inspection does not trigger execution. Responsiveness targets are capability-specific measurements, not untested latency promises or permission to bypass Checks.

## Operator console for development

A thin inspection/operation client is enough for the first engine path. A richer ChangeKernel-owned Rust terminal console remains intended for later supported workflows, separate from backend authority. Pi is a source-development harness and retained adapter, not a mandatory engine dependency or the product's lifecycle owner. Console breadth does not gate core correctness.

## Cross-workspace development

An application-use Change may expose a need for authorized development in another Workspace. Preserve the original unmet requirement and use explicit linked Changes, applicable actors, native rights and result adoption. User intent to improve an application does not itself authorize source edits or deployment. Cross-Workspace coordination is later scope and never an implicit global transaction.

## Hosting, distribution and evolution

Distribute one Rust engine with library integration and a standard launcher/client path. No mandatory cloud account, Docker deployment or database service is implied. The first profile integrates with a trusted host; a standalone hardened service is a separate future deployment profile with additional evidence obligations.

Release only supported capability/profile combinations. Adding a model, binding, worker, host or platform requires evidence for the claims it adds, not repeating every unrelated investigation. Supported updates preserve historical meanings and unresolved outcomes. [Release qualification](../system/components/package.md) is separate from source tests and from controller handoff.

## Repository representation

- `.changekernel/wiki/**` is desired product design, phased capability gates and explicitly labeled research/compatibility references.
- `.changekernel/changes/**` is governed lifecycle truth; this design edit does not rewrite or migrate it.
- `src/**` and `tests/**` are executable truth; manifests and lockfiles bind actual dependencies.
- `AGENTS.md` owns source-development procedure; `CHANGEKERNEL_STATUS.md` is the short temporary unfinished-work note.
- Git preserves history and checkpoint evidence. Generated Views, runtime state, credentials, caches, sockets, worktrees and package artifacts do not belong in project Git.

No proposed diagram or filename layout is a migration instruction. Do not load this mutable checkout as its own controller.

## Current implementation and historical meanings

The current launcher is not an operational file-first host. Bounded native intake/revisions, committed-source observations and Linux packet ingress exist; candidate custody and the complete lifecycle remain unintegrated or unfinished. Their [retained contracts](../system/components/native-profiles.md) stay unchanged. No automatic SQLite migration, terminology reinterpretation, dual-writing or inferred qualification follows from the new design.

The retired TypeScript engine is historical evidence, not a feature-parity target. Retained Pi adapters do not implement the Rust lifecycle. Known defects do not disappear when scope changes.

## Unresolved contracts and proof

### Dependency-gated implementation

The [ChangeKernel plan](plan.md) owns the single phased capability plan. Resolve only contracts consumed by the next coherent slice, including its actual input/output producers and failure boundaries. Do not require speculative future host, collaboration, model or discovery protocols to be settled before a typed trusted-host transition can be tested.

### First dogfood delivery sequence

A useful core engine release comes before autonomous self-development. The [later self-development gate](../system/components/package.md#first-self-development-delivery-focus) remains distinct: it needs qualified execution/publication, actual workflow evidence and an immutable external controller with explicit handoff. Documentation approval, release activation or a working core fixture alone does not supply that authority.
