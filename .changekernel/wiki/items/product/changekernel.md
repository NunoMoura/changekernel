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

**ChangeKernel is a redistributable State-and-Change engine for applications.** Developers provide structures and native abilities; users choose goals; agents and other workers compose paths. ChangeKernel governs State evolution, supports recovery within declared limits and retains useful learning for people and agents. It is not an agent, a harness, a database engine or an operating-system kernel.

Its integration role is **State-and-Change middleware connecting agents, people and automation to applications**. Qualified bindings expose authorized queries and governed changes while native applications retain their resource authority, business rules and permissions. State is a scoped representation, not a synonym for a backend or database; desired, observed and candidate State remain distinct. “Any backend” describes extensibility, not universal compatibility, unrestricted CRUD, atomic cross-application effects or uniform recovery guarantees. This role does not require a cloud service or replace the library-first engine and qualified-host model.

The Rust core owns orchestration above eligible harness workers and the agent-facing interaction boundary. Change and Work own continuity; harness sessions supply worker context, not lifecycle authority. Build the product around these contracts, selectively reusing suitable mechanisms rather than inheriting another product's architecture. This does not require rewriting accepted code or commodity libraries. The [runtime research disposition](../system/components/agent-execution.md#runtime-selection-and-research-basis) governs the reviewed projects.

This is the primary desired-state design, not a statement of implemented capabilities or release qualification. Four supporting contracts retain substantial detail without a separate document for every role, stage or flow:

| Contract | Detail owned there |
| --- | --- |
| [State and persistence](../system/components/state.md) | Workspace/resource bindings, file-first Change Trace custody, research, candidates, receipts, concurrency and recovery. |
| [Checks](../system/components/checks.md) | Kernel-bound Decision, Planning and Execution assessments, adoption, read-only evaluation and reuse. |
| [Execution](../system/components/agent-execution.md) | Worker containment, model transport, durable attempts, Change handoff and output custody. |
| [Release and qualification](../system/components/package.md) | Version transitions, required proof and external-controller boundaries. |

The `wiki/` path is retained for source development; it does not make Wiki a runtime primitive or require application State to be Markdown. Prior committed design pages remain in Git history, not an active parallel specification. Uncommitted draft material is consolidated here and in the four contracts. Execution progress belongs in Changes and Work after qualified adoption, with only a short [temporary status note](../../../../CHANGEKERNEL_STATUS.md) beforehand.

## Continuous development, use and improvement

ChangeKernel governs systems throughout their lives, not only while their software is being developed. Its foundation is actor-neutral: the same State and Change primitives support human actions, delegated agents and automation during development, integration, ordinary use after launch and ongoing improvement. Users bring goals and experience; developers provide and evolve structures and abilities; agents can both help users pursue goals and perform authorized development. These roles collaborate without acquiring one another's authority automatically.

“Better” describes an intention, not an effect that the engine guarantees. Preserve what the owner intended, what actually changed and what observations support success, failure or uncertainty. Correct execution may still fail to realize the intended benefit. ChangeKernel verifies outcomes against the applicable intent and requirements; it does not arbitrate whose goals or preferences deserve to prevail.

```text
Develop and integrate capabilities → pursue user goals → observe actual outcomes
    → propose improvements to capabilities, structures or procedures
    → assess, authorize and realize supported Changes → use and learn again
```

This is an open-world approach to goals, not a requirement to enumerate a workflow for every outcome. ChangeKernel bridges user input to existing application backends and preserves unmet user requirements as inputs to governed application extension. Workers first compose supported abilities and acquire needed observations; a missing predefined entity or compiled binding does not by itself establish a capability gap. Genuine gaps can reach responsible developers through authorized Change borrowing and linked design/development Changes, followed by separately authorized integration and deployment through [cross-workspace development](#cross-workspace-development). Preserve the original user pursuit through that cycle: delivering a feature enables its continuation, but does not establish the user's outcome. Open-world pursuit does not imply unrestricted effects, automatic policy changes or invented capabilities.

ChangeKernel provides one authoritative boundary for governed product operations, with human interfaces, agents and other integrations as clients. Clients request typed operations; only the current custodian's authorized backend constructs and durably retains authoritative Change Trace records. JSONL is not a raw editing API. Backend-only writes require protected storage and qualified privilege separation, not client cooperation; [State](../system/components/state.md#backend-only-authoritative-writes) defines that contract. A user request is not permission to modify the product's code, deploy a release or change governing policy. Shared experience can ground improvement proposals, but adoption and realization require the same controls as other Changes. Keep user and developer scopes, private data, commitments and Evidence distinct throughout the cycle.

## Ownership model and responsibilities

**Users participate in Workspaces. Their Kernels govern Changes to those Workspaces. State represents a Workspace at particular versions and scope.**

| Primitive | Meaning |
| --- | --- |
| Workspace | The persistent, identified subject with explicit resource boundaries and established authorities. Use `workspace_id` consistently in the desired frontend/backend contracts. |
| State | A transitory, scoped and version-/time-bound representation of a Workspace. Retained representations remain evidence; they are not the persistent subject or necessarily a complete snapshot. |
| Change | A user-owned pursuit of a transition between States of one Workspace, preserving intended and actual outcomes separately. A proposal is already a Change, not a second entity promoted after approval. |
| Kernel | A user's versioned Decision → Planning → Execution pipeline definition, with customized Checks at its boundaries. It is not the engine implementation. |

The engine implements governance and may execute many Kernels for many Workspaces. Server means a host role; an execution directory or worktree is not a Workspace identity. There is no new public `system_id` or `subject_id` alias for `workspace_id`, and no mandatory Container-definition creation ceremony. Historical names in existing APIs and records retain their [original meanings](#current-implementation-and-historical-meanings).

Each Change has one originating user owner. Agents are executors, not independent owners or sources of authority. Record each participant's authenticated contributions, configuration and delegation without transferring ownership or attributing a recipient's earlier actions to the originator. Original intent is not overwritten by a custodian's additions or retrofitted to eventual delivery. Owning or possessing a Change does not grant rights over its targets; every participant's effects require independently established native authority. Bind identities and permissions through trusted host context, not editable metadata or a competing ChangeKernel ACL.

A user's authoritative Change folder is private and strongly bound to authenticated identity. It can contain Changes for many Workspaces. Sharing or borrowing concerns an individual Change file or authorized material, never access to the whole folder. Membership in a Workspace does not reveal all members' Changes. A pathname, copied file or encrypted payload alone proves neither ownership nor active continuation authority.

| Responsibility | Owner |
| --- | --- |
| Structures, meaning, native business behavior and resource bindings | Application developers and resource owners, reusing authoritative declarations. |
| Original intent and accepted commitments of a Change | Its accountable user; each later participant remains attributable for their own contribution. |
| Personal Kernel definitions and preferences | Their user owner; shared versions are usable only within the executing actor's authority. |
| Native resource permissions, membership and sharing | Existing application, organization or operating-system authorities. |
| Path composition, production and observation collection | Authorized people, agents or services acting as workers. |
| Consistent transitions, required Checks, custody, coordination and declared recovery | The engine and host through qualified bindings and protected write routes. |
| Credentials, durable storage, supervision and enforcement support | The host and its declared deployment. |

### Relationship cardinalities

Counts describe logical objects, not physical copies. `0..N` permits none or many. State rows concern representations, not a mandatory stored snapshot of the entire Workspace.

| Relationship A ↔ B | B per A | A per B | Rule |
| --- | --- | --- | --- |
| User ↔ Kernel ownership | 0..N | 1 | One accountable owner per Kernel. |
| User ↔ Kernel use | 0..N | 0..N | Shared versions do not share permissions. |
| User ↔ Workspace membership | 0..N | 0..N | Membership follows established authority, not universal write access. |
| Workspace ↔ Kernel use | 0..N | 0..N | Resource-owner requirements always apply. |
| User ↔ Change ownership | 0..N | 1 | Borrowing does not replace the originating owner. |
| User ↔ Change active custody | 0..N | 0..1 | At most one active custodian per Change. |
| Workspace ↔ Change subject | 0..N | 1 | One fixed `workspace_id` per Change. |
| Kernel ↔ Kernel version | 1..N | 1 | Version contents are immutable. |
| Kernel version ↔ Change historical use | 0..N | 0..N | One selected version per active continuation segment; many may occur in history. |
| Kernel version ↔ configurable Check version | 0..N | 0..N | Bind at named boundaries; common/native requirements are not optional. |
| Workspace ↔ State representation | 0..N | 1 | Coverage, visibility and versions remain explicit. |
| Change ↔ State representation reference | 0..N | 0..N | Reuse only where access and evidence requirements permit. |
| Change ↔ Work | 0..N | 1 | Work has one owning Change. |
| Work ↔ Attempt | 0..N | 1 | Attempts and outcomes remain distinct. |
| Change ↔ Change Trace log | 1 | 1 | One authoritative logical history; copies confer no second authority. |
| Change ↔ prerequisite Change | 0..N | 0..N | Completion-blocking dependencies must be acyclic; references need not be. |
| Change ↔ direct fork | 0..N | 0..1 | Each fork identifies one exact source checkpoint; derivation is not dependency. |

### User Kernels and version selection

A user may maintain different Kernels for personal, development or production work. Published immutable versions can be reused across users and Workspaces; independent customization may fork a definition without acquiring its owner's rights. Each user–Workspace pair may have zero or one default Kernel reference, with an explicit suitable override for a particular Change. Resolve and retain the exact version when used; changing defaults never changes historical meaning.

Selecting a lightweight Kernel cannot waive Workspace/resource requirements. Kernel definitions and adopted Checks may themselves be governed State; a proposed replacement cannot authorize its own adoption. A receiving custodian selects a Kernel version for the new continuation segment and establishes its applicable admission and Checks. Earlier progress and still-valid evidence remain usable, but no universal approval or Execution-ready flag travels between Kernels.

## Workspaces, membership and boundaries

A Workspace can encompass a band's members, songs, bookings, budgets, files and procedures, rather than one Workspace per entity, database or process. A product can expose several tenant Workspaces, and one Workspace can connect several supported resources or hosts. Logical identity, physical placement, authority and visibility are separate. Shared code/schema may remain developer-owned while user data follows native tenant permissions. OS resources participate only through supported bindings; a machine is not an implicit grant over everything it hosts.

Minimal setup establishes four things:

1. A stable `workspace_id` and display name, reusing suitable existing identity through a trusted binding where possible.
2. Exposed resources and operations, including observation, modification and bounded creation of future resources.
3. Existing authenticated authorities and required rules; registration grants no rights the configurator lacks.
4. A local binding, existing application session or authenticated endpoint through which participants connect.

Resource selection can be a directory/repository boundary, application account/tenant or supported API scope. Not every future filename must be enumerated, and not every accessible resource becomes tracked State. Discovery does not grant retention, disclosure or write access. Current permissions and source guards apply at actual effects. Scope changes require versioned, authorized adoption; copying a descriptor, changing an endpoint or finding a resource cannot silently expand the boundary.

Users may join multiple Workspaces through native membership and authorized invitation/acceptance flows. Joining, following updates and being allowed to perform an operation are different relationships. The UI can show a Workspace sidebar and a cross-Workspace My Changes view without sharing the user's folder or creating another task/history authority. Invitation, authentication and membership representations remain [implementation prerequisites](#dependency-gated-implementation), not a selected competing ACL or central-account service.

Names and locators may change without changing Workspace identity. Resource bindings separately identify native source, scope, resource identity and version; same-name recreation may be a different resource. Uncertain relocation requires explicit rebinding, not guessed continuity. Different Workspace IDs do not make overlapping native resources independent or bypass their owners' rules. Schema analysis may be shared without sharing private State, and discovered code does not become writable customer data.

### Owner-directed automation

Proactive pursuit and automatic continuation are configurable, not compulsory. A user may authorize their agent to act within the user's existing rights, including editing shared State, and remains accountable for those Changes. Agent origin alone does not require a second resource-owner approval. Existing system approval rules, business constraints and any explicitly adopted restrictions still apply; automation neither enlarges permissions nor removes required verification or history.

An optional additional layer may later restrict AI use where traditional permissions do not express a needed distinction. It must narrow existing authority, not grant a route around it. Designing a generalized AI-restriction layer is deferred, not a prerequisite for the first enforced application integration. Existing custody, containment and exact-effect safeguards remain necessary to substantiate the capabilities that an integration actually claims.

The system enforces its supported boundary independently of model cooperation. A read-only interface is not containment if an agent can write through an unrestricted shell, database credential or another route. An integration that only observes outside writes must say so; logging afterward is not equivalent to mediating them.

## Developer experience

**Connect → compile bindings → govern → learn.** Connect an existing application/account/repository or establish a bounded new Workspace without a handwritten entity/action catalogue or separate server per Workspace. Prepare reusable binding knowledge during integration, build and deployment rather than inspecting the application anew on ordinary end-user requests. Setup and affected updates are developer-side work, not an entity-by-entity or request-by-request registration ceremony. These scenarios describe desired behavior, not implemented exports or a frozen descriptor/API format.

An authenticated user selects a Workspace and suitable Kernel, then supplies What and available Why. The engine retains a Change in protected user-bound custody and progresses it through Decision, Planning and Execution. A durable reference is not synchronous completion. Inspection exposes the selected Kernel version, native capabilities, scope, requirements, relevant State observations, Work and unresolved conditions.

### Nothing exists

For “Create a draft Summer Tour with a €1,200 budget,” first establish what the exposed bindings can represent. A supported document or generic record capability may suffice without a Tour table; missing a predefined entity is not automatically a software-development requirement. If no suitable native or generic representation exists, retain the need and identify the capability gap rather than inventing support. The generic-State fallback contract must be settled before that capability is implemented or promised. Native schema introduction or migration remains separately authorized work.

### Structures exist without records

If deployed tables or APIs already represent tours, contacts and venues, prepare their native operations rather than a competing generic copy. Trusted bindings resolve the real tenant/account scope; a field named `workspace_id` or a generated filter does not by itself provide isolation. Observe whether the selected scope is empty. Schema files alone prove neither deployed capability nor absence of records, and discovery does not perform migrations.

### Structures and records already exist

Observe an honest scoped baseline without inventing earlier governed Changes or reasons. For “Raise the Summer Tour budget to €1,200,” an observed €900 budget grounds the proposed transition. Planning considers relevant commitments and permissions; Execution rechecks guards, performs the native update and retains outcome/recovery evidence. Unrelated data remains unchanged. Unknown data is not empty, and outside writes are drift rather than retrospective approvals.

### Reopen and inspect

The first operational profile must support clean host restart and ordinary reboot, reopening the same Change without depending on a surviving agent session or process. Reopening verifies identity, current authority and intact custody without resetting State, Work or history. Unexpected interruption, storage incidents and backup rollback have distinct [recovery obligations](../system/components/state.md#protected-accepted-prefix-and-recovery-boundary), not an automatic permission to replay effects. Views can span a user's Workspaces but expose only authorized material. A borrowed Change may be represented locally by a reference or inactive retained checkpoint, never a competing writable history. Reads do not launch missing execution or repair erased grounds. Creation collisions and retries must reconcile rather than initialize a replacement under an old identity.

## Discovery and bindings

The default is ahead-of-time binding compilation: inspect the declared integration scope thoroughly, prepare supported mappings before ordinary application use, and resolve exceptions with developers rather than charging every user request for discovery. Initial source access, authenticated scope and supported native interfaces must still be established; compilation cannot discover its own authority. Source-only inspection does not establish deployed capability, so validate applicable bindings against the actual deployment and native schema before use.

Reuse authoritative sources instead of duplicating their contracts:

| Source | Contribution and limit |
| --- | --- |
| Database catalogs | Actual tables, fields, types, keys, defaults, relations and native constraints; not all application behavior. |
| Runtime schemas and generated metadata | Executable structure; erased language types alone are insufficient. |
| Supported handlers, validators and framework declarations | Operations, inputs/outputs, business rules and authoritative execution paths. |
| Comments and documentation | Source-backed meaning candidates, not automatically governing instructions. |

A binding declares supported observation, identity/scope, comparison, preparation, publication, concurrency guards, outcome lookup, history and recovery. Not every binding supports every ability. Expose unresolved coverage rather than bypass existing business logic with generic writes. Common State operations come from reusable bindings; native business abilities can reuse existing typed functions. Developers fill exceptions, not recreate every entity or endpoint for each goal.

Developers can integrate external tools, services and agent-facing interfaces through supported bindings and the shared public boundary. Each integration declares its inputs, outputs, effects, permissions, limits and supported outcome/recovery behavior. Connecting a tool neither adopts its output as truth nor gives it a route around guarded effects. No particular browser-tool protocol or external tool framework is an engine dependency.

Rust types constrain engine contracts; versioned runtime definitions describe application-specific entities without compiling every application's domain into the engine. Validate model and client inputs at runtime, preserve native validators and derive typed client interfaces from public contracts rather than duplicate governing rules. Semantic interpretation proposes bindings and values; it does not confer authority.

Binding compilation follows:

```text
Versioned sources → syntax/dependency units → exact schema extraction
  → bounded parallel Jev classification → evidence-backed grouping
  → producer synthesis of missing meaning → source/binding validation
  → inspectable version-bound definition → deployment compatibility validation
```

The resulting artifact describes entity types, identities and relationships; supported capabilities and input/output schemas; native handler/validator references; relevant constraints and declared effect/outcome support. It also supplies source-backed semantic descriptions, bounded Jev question/option definitions and candidate-selection metadata. Inspecting a helper or internal structure does not expose it as a public capability. Types and signatures alone do not prove business meaning, authorization, side effects or safe retry behavior. Report unresolved mappings and unsupported operations as developer-facing diagnostics rather than inventing support.

Keep source locations, enclosing context, imports and relevant dependencies. A whole function is not necessarily whole context; oversized units require explicit subdivision or another route. Roles include resources, input/output/value structures, validators, capabilities, helpers and unresolved units; roles can overlap. Preserve uncertainty rather than drop ambiguous candidates. Code extracts exact fields/types; generation must not invent replacements or unsupported relationships.

The ordinary natural-language runtime path uses the prepared definitions:

```text
Request → authorized capability candidates
  → query/Change/mixed interpretation and feature/entity selection
  → authorized entity resolution + exact input parsing/validation
  → applicable query or Change controls → native operation
```

These are semantic responsibilities, not one mandatory model call per arrow. Batch independent judgments; dependent questions cannot consume earlier answers within the same Jev request. Code resolves identities, copies/parses supplied literals and validates typed inputs; [Jev judgments](#semantic-operations-and-jev) do not provide unconstrained extraction or generation. Separate user-supplied parameters from backend-bound actor, scope, credential and control fields. Typed operations bypass unnecessary interpretation. Compiled definitions do not waive current native permissions, relevant State observations, concurrency guards, required Checks or outcome reconciliation.

The catalogue covers types and capabilities, not every live record; new ordinary records do not require recompilation. Fetch only the relevant authorized State at runtime. Preserve unfamiliar requirements instead of forcing them into the nearest compiled capability or rejecting them merely for lacking a binding. A catalogue miss is a coverage question, not proof of native absence. Genuine missing capabilities retain the [development and continuation route](#cross-workspace-development); denied access, operational unavailability and uncertain coverage remain distinct.

Use incremental analysis of changed units and affected dependencies, not repository rediscovery on every Save. Discovery can identify resources without loading every row into memory or sending a database to a model. Stale or unsupported bindings require explicit compatibility handling or developer-side repair, not silent full-source discovery, unrestricted generic writes or guessed execution on the end-user path. Repository text is untrusted data: never execute discovered instructions, imports, scripts or plugins. Hosted analysis requires disclosure authority. Discovering structure neither deploys capability nor grants mutation permission.

This selects preparation and runtime responsibilities, not a compiler implementation, public artifact schema or qualified integration. Compiled definitions follow the [State and custody boundary](../system/components/state.md#one-authoritative-current-representation); native source authority and protected Change continuation remain separate.

## State, evidence and recovery

State represents the persistent Workspace at a declared scope, version/time and coverage. It may express observed values, desired outcomes, adopted obligations or supported knowledge, with relevant gaps, conflicts and unknowns explicit. These roles are distinct: a desired State is not an observed after-State, and an authoritative source is not proof that every assertion is verified reality. A Change can begin before complete before/after representations exist, can reference many intermediate observations and can end with failure or uncertainty. Different authorized views do not automatically denote different Workspaces.

Existing native rows, files and service resources remain authoritative in place; choosing file-first Change history does not require copying them into files. A connected source may expose writable resources, read-only dependencies or both. Unchanged budgets, policies, contracts and consumers can constrain a Change. Generic managed State must not duplicate a native owner of the same meaning; its fallback representation is an explicit open capability contract.

The desired Change history is one protected, append-only JSONL **Change Trace log** per Change in user-bound custody, independent of the native storage used by its Workspace. Each line records one bounded typed operation; retain intent, assessments, Work, attempts, failures and actual outcomes with exact references. Large artifacts and private runtime transcripts may remain referenced material. There is no mandatory database service or competing lifecycle store. Git supports useful diffs, history, collaboration and transport, but its precise acceptance/durability role requires a qualified profile. Existing SQLite profiles remain [bounded executable contracts](../system/components/state.md#native-rust-intake), not the default of this new design.

Read sources on demand, retain what decisions rely on, and recheck what actions depend on. Need follows intent, applicable procedures, constraints and affected dependencies, not only what an agent happens to search for. Authorized research can discover and retain new source resources, subsequently consumed through ordinary bindings with provenance, permissions and retention limits. Historical support and current execution dependencies are different links. Detailed acquisition, observation and memory rules belong in [State and persistence](../system/components/state.md#sources-observations-and-retained-research).

**Observed current State + exact candidate → proposed difference.** Resource identity is distinct from value and version. Not every source offers a global snapshot. The backend derives actual differences under supported semantics rather than trust an agent's effect summary. Candidates may be patches; generated/approved content is durable until execution, reconciliation, Review and retention obligations allow disposal. Re-fetchable observations may be caches, but unique candidates and recovery grounds are not.

A Change Trace log connects intent, assessments, attempts, authority and receipts through durable references rather than embedding every payload. A transaction identifier alone is not historical custody. Reuse qualified native history or retain needed previous values/differences; do not mandate a full historical mirror. Mutation and receipt can be atomic only when they actually share a supported transaction. Separate stores need trustworthy source-side outcome reconciliation before retrying a lost response.

Evidence supports or challenges a scoped claim; it is not automatic proof. Preserve subject, source/version, method, observation time, assumptions, counterevidence and limits. A pass is not approval, approval is not execution, and execution is not necessarily realization. Several summaries of one source are not independent corroboration. Historical retrieval cannot rerun a model to recreate missing grounds or re-adopt an old rule.

Desired requirements and observed realization remain distinct: adopting a 30-day retention rule does not prove deletion happens. Views relate desired outcomes, observations and ongoing Changes without another authoritative task or outcome database. A future target need not be an immediate violation; an owned gap is still a gap. Missing, private, stale and truncated coverage remains explicit.

Recovery is normally a new guarded transition that preserves later valid work where possible. History supports repair of bad Changes; backups protect storage loss. Restoration, compensation and containment differ, and no data rollback undoes disclosure. Each binding declares covered failures, retention, assumptions and exclusions. Detailed publication and recovery obligations live in [State and persistence](../system/components/state.md).

## Intent and lifecycle

**Decision → Planning → Execution** are the three public stages of each Kernel. Decision determines whether to pursue an outcome within stated commitments; Planning establishes bounded Work, dependencies, routes and permissible parallelism; Execution carries admitted Work through guarded effects, observation, recovery and outcome verification. Each stage supports custom Checks at its boundaries, alongside mandatory engine and native requirements. Intake remains capture/refinement within Decision, not another public stage. Three stages do not require three human approvals, model calls or transactions, and do not limit visible waiting, custody or recovery states.

Intake accepts **What** and available **Why**, or exact structured edits. **How** develops internally. Trusted transport binds actor, scope, source references, expected versions and stable retry identity; natural language supplies no authority. Same retry identity with different input must not execute another operation. Reads and inquiries can remain reads; “yes” binds an exact proposal and “stop” identifies active work.

ChangeKernel owns how agents query the system and request changes, rather than delegating that distinction to a harness or prompt convention. For natural-language requests, use bounded Jev judgments to distinguish requests for information from requests for State change, with explicit handling of mixed or unresolved intent. Preserve the original request and interpretation; clarify consequential ambiguity instead of forcing every message into a binary answer. Exact typed queries and commands already declare their operation and bypass unnecessary semantic classification. This is a semantic responsibility, not a frozen API or label vocabulary.

Classification proposes routing, not authority or effect eligibility. The backend authorizes query scope and disclosure, and routes requested State changes through applicable Change controls, current permissions and required Checks. A query route cannot invoke mutation capabilities, and a change label cannot turn an informational request into consent to act. Misclassification, unavailable Jev or malformed output must not unlock effects or silently discard an unresolved change request. Explicit natural-language interpretation is an admitted, bounded model operation; typed reads, historical lookup and view reconstruction do not implicitly invoke it. Internal accounting and custody recording use their own protected operations, not an infinite nested Change for every read or log append.

The Change owns the immediate pursuit's original request, interpreted intent, desired outcome and success observations, scope, exclusions, commitments, consequential decisions and material alternatives. Distinguish stated, inherited, inferred-but-unconfirmed and unknown meaning. Preserve attributable revisions instead of rewriting accepted intent to match delivered output. Work inherits exact intent and relevant State versions; continuing goals, requirements and adopted procedures belong in State. No independently writable `intent.md` at each task boundary is required. The **Change Trace log** is its durable append-only history, not the release `CHANGELOG.md`; current design is not replaced by its revision history.

Missing information remains explicit rather than becoming mandatory paperwork before an idea can be retained. “Edited in frontend” is origin, not rationale. Routine steps can inherit purpose; consequential ambiguity warrants clarification, not an invented default or a reason dialog for every minor edit. Setting font size to 16 does not establish a permanent preference or prove improved readability.

### Decision admission and refinement

Decision includes proposal clarification, justification, applicability assessment and required approval or delegation. Its admission boundary is **ready for bounded planning and pursuit**, not ready for every future effect. Rough proposals can be recorded before admission. The backlog is a permissioned view of proposals awaiting decision, clarification or priority; accepted Work queues are separate views of the same durable records, not independently editable task stores.

The engine owns a bounded refinement loop: identify missing or contradictory material, return targeted feedback, collect authorized observations or propose a revision, then reassess affected conditions. Feedback binds the exact revision and identifies the requirement or advisory suggestion, affected scope, grounds, missing information or authority, permitted next actions and intent/constraints that correction must preserve. Large or unfamiliar proposals are not automatically invalid; suggested decomposition is not automatically a mandatory blocker. A changed proposal gets an attributable revision and new retry identity rather than reusing an old request with different content.

Intake mechanics do not add a fourth public stage. They reuse shared feedback and assessment machinery; custom Checks remain available for Decision, Planning and Execution. Internal orchestration does not make every criterion universal. Missing knowledge can permit bounded investigation; missing authority requires permission or a stop. Preserve rejected input, bound refinement attempts and cost, and allow waiting, deferral or rejection rather than resampling until acceptance.

Conversation can already perform Decision work. Retain and reuse applicable conclusions and exact-subject approval instead of repeating an interview. Conversation itself is not approval, and an automated origin is not a requirement for human approval. An automated proposal without suitable delegation waits for the required decision; a proposal within delegation may proceed once applicable requirements hold. Explicit user instruction still does not waive failed requirements or preapprove unknown effects.

### Planning admission and refinement

Planning is an explicit checked stage, not a hidden execution detail. It develops a bounded Work graph with expected contributions, declared read dependencies and effects, relevant State versions, prerequisites, shared commitments, proposed recipients and required authority, limits, observation needs and result-acceptance conditions. Custom Planning Checks assess coverage of intent, methods, interfaces, aggregate conflicts, parallel safety, routing and unresolved questions. Code owns identities, arithmetic, eligibility and commitment admission; Jev may assist suitable semantic judgments.

A valid plan may contain waiting, delegated or blocked Work. It does not certify that every item is executable. Plan incrementally rather than requiring a complete graph before safe bounded work. Missing knowledge may require authorized inquiry; missing authority requires an appropriate request, routing to an independently authorized participant or a stop. Neither discovery, a route nor a model-selected owner grants rights.

The planner proposes routes and graph revisions, Checks assess them, and the engine records accepted decisions and performs guarded creation, sharing, handoff and dispatch. Those control operations require their own authority and custody checks; they do not authorize application effects or require an infinite nested Change for each log append. A newly created child or fork begins its own Decision even when the parent remains in Planning. Execution-time discoveries require an explicit plan revision, new Change or return to Decision for material intent/authority changes, not silent replacement of admitted Work.

### Assessment responsibilities

The stages preserve distinct assessment subjects and timing. Pre-effect/contribution assessment and observed-outcome Review remain within Execution; neither is a fourth stage. Existing protocol fields and historical Planning results are not renamed by this design.

| Public stage | Responsibility |
| --- | --- |
| Decision | Establish justified bounded pursuit, intent, commitments, uncertainty, assessable outcomes and approval needs. |
| Planning | Assess Work decomposition, methods, interfaces, dependencies, declared effects, aggregate commitments, authority, routes and parallelism. |
| Execution: pre-effect/contribution assessment | Assess exact candidates, current authority and dependencies, execution custody, actual contributions and truthful partial outcomes. |
| Execution: observed-outcome Review | Assess reconciled combined results, remaining obligations, supported realization and lawful completion. |

```text
Decision: capture/refine intent → assess → admit bounded pursuit or wait
  → Planning: decompose → assess dependencies, routes and parallelism → admit plan
    → Execution: dispatch eligible Work
      → exact candidate + required assessment and authority
      → fresh publication guards → effect and receipt → observation
      → replan, repair or continue as required
      → assess combined outcome → complete only when justified
```

Each active continuation segment selects an exact Kernel version. Past assessment remains bound to its subjects, versions and context; it is not a portable blanket approval. Checks supply judgments, while the engine owns scheduling, handoff, effects, review coordination and recovery. Private proposals, drafts and bounded planning activities have their own permitted persistence/execution grounds before protected publication. Long reasoning and approval waits stay outside short publication steps. Simple typed operations may satisfy suitable boundaries directly in code.

Publication/application of effects generalizes; a single final deployment stage does not. Software may prepare privately, assess release readiness, deploy, then observe and review results. Other Changes update records or adopt guidance directly, or perform multiple outside effects over time. A pre-delivery aggregate assessment does not establish subsequent delivery success. If the promised outcome is a reviewed release artifact, deployment may be a separate linked Change; if the promise is availability to users, deployment and its observation precede completion. Checks do not deploy or collect fresh observations themselves.

Built-in requirements, authoritative source constraints and adopted domain policy retain distinct ownership. A Pack distributes evaluators, not another authority. Passing, readiness, approval and acceptance are separate; a candidate cannot activate its own weaker policy. Legitimate revision follows current authorized rules. Required failures cannot be averaged away or waived by treating approval as a pass.

Consequences such as reach, sensitivity, reversibility, others' interests and uncertainty inform policy-derived approval. Policy determines who can approve and what cannot be delegated. Model-assessed severity alone does not set ceremony or override ownership. Autonomous self-improvement additionally needs scoped delegation, containment, limits, current guards, protected custody and recovery; good user Checks alone are insufficient. Controller replacement retains release qualification and required handoff.

Defects return to applicable refinement or Planning, material intent/scope/authority changes to Decision, missing observations to collection and provider failures to operational handling. Pause, reject, defer, withdraw or cancel when appropriate. Completing individual tasks, producing a booking row or delivering a feature does not establish the combined user outcome. Optional improvements must not conceal unmet required outcomes. See [Checks](../system/components/checks.md).

### Change granularity and classification

A Change is a coherent, bounded, assessable commitment, not a commit, worker session, task, record count or one transaction. A proposal is that same Change in its proposed state, not a separate entity promoted into a new Change after approval. Planning decomposes its pursuit into Work, where actual edits and other contributions are defined. Exact candidates/effect batches retain the material for particular steps, not a second proposal lifecycle. A Change can retain multiple immutable multi-entity batches without knowing every future effect upfront.

A million record effects need not mean a million Changes. A bounded bulk goal can use staged Work and supported batches; an indefinite objective such as improving a product forever belongs in continuing State pursued through multiple Changes. Prefer related Changes when outcomes can independently be accepted, deferred or cancelled, need distinct intent/commitments or approval decisions, or have independent completion/recovery boundaries. Keep tightly coupled effects together where splitting hides correctness. Preserve shared constraints and dependencies: splitting creates no additional authority or aggregate budget. Large-scale execution remains a qualification target, not an implemented claim.

Use a small versioned classification profile, not an exhaustive universal type-to-pipeline switch. Useful dimensions are purpose, affected meaning, scope/consequences, recovery support, knowledge readiness and applicability of an established procedure. Purpose can distinguish learning, creation, adjustment, repair or retirement while admitting mixed and unresolved cases. These examples do not freeze an exhaustive vocabulary. Exact operations, permissions and qualified binding capabilities come from code; Jev assists genuine bounded semantic judgments. Domain Packs may add labels without replacing universal requirements.

Jev's [255-option Choice limit](https://docs.typesafe.ai/primitives/choice) is per question, not a target number of Change types. Ask focused questions and compose answers in code; do not ask a model to select a supposedly safe pipeline from an unverified summary of unbounded effects. Classifications bind exact inputs, definitions, model/settings and uncertainty handling. Intake classification is provisional: material candidate effects or new observations require reassessment. Actual effects and policy determine applicable requirements, not a repair/documentation label, averaged risk or model confidence. Qualify against missed obligations and unsafe omissions, not merely label agreement.

## Planning and Work coordination

Factory is no longer a separate user-facing primitive. Planning owns the Work graph and routing decisions; durable runtime code owns scheduling, assignments, attempts, limits, cancellation and recovery. Work may use direct typed operations, deterministic expansion of an established procedure or producer-generated missing plans/content/programs. Configuration controls supported concurrency, budgets and refinement limits; custom Planning Checks and native requirements remain binding.

Reasoning strategy remains programmable within those boundaries. Qualified [producer runtimes](../system/components/agent-execution.md#programmable-strategies-and-bounded-delegation) may combine ordinary computation, model calls and bounded recursive delegation over explicit inputs and authorized structured history. The engine need not hard-code a workflow for each strategy, but retains authority over admitted Work, mandatory assessments, durable acceptance and effects. A runtime transcript or reshaped working context is not the Change Trace log; runtime choice does not select a new public lifecycle or permit self-authorizing improvement.

Each Work item belongs to one Change and may have multiple attributable attempts. Reuse independently governed outcomes through linked Changes/results rather than sharing mutable Work ownership between histories. Different Kernels may govern child Changes in parallel while each Change retains one active continuation authority.

Choose coherent Work, not the smallest possible units. Retain inherited purpose, scope, prerequisites, shared obligations, expected outcomes, observation needs, allowed tools/effects and limits. Child successes do not prove parent coverage. Missing knowledge needs information; missing authority needs permission or a stop; indivisible difficulty may need a stronger worker rather than endless splitting. Research can justify detours without a universal distance-to-goal score decreasing on every step.

Persist attempts, assignments, dependencies, waiting reasons, budgets, cancellation and partial outcomes across processes. Code determines eligibility, conflicts, limits, fairness and reservations before Jev ranking or worker-fit judgment. Confidence is not worker success probability. Bound retries, decomposition, concurrency and total cost; do not starve eligible work or resample unchanged failures.

Dependencies include intermediate conditions and commitments, not only final artifacts. Disjoint rows, files, Workspaces or fork IDs do not prove independence: three €400 commitments exceed €1,000, and early disclosure can violate an embargo elsewhere. Blocking dependencies must be acyclic; one Change may supply several independent user pursuits without merging their private history or authority.

Planning-time aggregate coordination is viable when the qualified boundary controls relevant writes and serializes commitment admission. A native reservation table is not universally required, but independently approving against the same stale budget is not coordination. Uncontrolled writers require source cooperation/guards or explicitly weaker supported guarantees. Native resource identity, not only `workspace_id`, determines overlap. Authorized commitments differ from worker leases and tentative ideas. Resolve conflicts through ordering, prerequisites, scope revision, pause, supersession or authorized choice. Long-running Changes do not hold months-long locks. Unknown effects or custody block unsafe retry even after lease expiry.

## Routing, borrowing and forks

These relationships are complementary, not alternative product architectures. Routing chooses a destination, custody identifies who may continue, dependencies/scheduling determine readiness, and Kernel stages determine current assessment obligations. Forking records derivation. Timing never transfers stage approval or source authority implicitly.

| Operation | Identity and intended use |
| --- | --- |
| Review copy | A read-only copy/reference to an exact Change checkpoint; feedback returns without another writer for that Change. |
| Borrow | The same Change moves active continuation to another authenticated user/Kernel; originating owner, Workspace and history remain intact. |
| Child Change | A new Change delivers a separately governed contribution with explicit result/dependency conditions. |
| Fork | A normal new Change derives an alternative or independent pursuit from one exact retained checkpoint, with a new ID, creator ownership and its own Change Trace log. |

Borrowing is transfer of the Change itself, not merely remote Work with a permanently privileged original coordinator. A returning file is not automatically accepted continuation. The handoff must bind exact identity/checkpoint, parties, allowed continuation and acceptance/return/cancellation conditions, preserve outstanding Work and reject stale continuation by retained copies. An interrupted transfer may leave no active continuation rather than two. The specific authenticated handoff and stale-holder rejection protocol is a prerequisite, not something file movement, signatures, encryption or a timeout supplies by itself.

A recipient establishes admission under its selected Kernel before continuing. Earlier progress remains historical evidence; current requirements determine reuse and the next permitted action. Participants use their own native authority for their attributable contributions, not powers inherited from the originating owner. Sharing the whole file requires authority for every disclosed part; otherwise use authorized material/views or a separately governed request. Private brainstorming and session transcripts must not leak into a returned parent file by default.

A fork retains an exact origin reference and authorized context with attribution. It does not relabel old operations as its own, inherit execution authorization, replay completed Work or assume uncertain source effects did not occur. The creator owns the fork; sending it does not transfer that ownership. The default target can remain the source Workspace, while adaptation to another Workspace selects a new fixed target at creation and requires fresh bindings, observations and authority. The original `workspace_id` is never silently rewritten.

Useful forks include competing designs/implementations, independent adoption after an originator stops, and adapting a prior pursuit to another authorized Workspace. Ordinary review needs only read-only copies; ordinary decomposition needs Work or children. Fork lineage alone does not make the source wait or couple cancellation. A fork can also be a child when the parent plan explicitly depends on its result. Independent cancellation does not revoke another user's lawful pursuit, but native permission revocation and resource constraints still apply.

Do not merge authoritative histories or concatenate Change Trace logs. Adopt selected results with provenance and assess the actual combined candidate against current conditions. For competing alternatives, authorize bounded proposal/candidate work first where appropriate; if only one may publish, enforce selection at the publication boundary. Forks share real budgets, resources and consequences unless a qualified binding actually isolates them.

| Parent stage | Permitted routing/forking purpose and limit |
| --- | --- |
| Decision | Refer consideration or separate alternative intentions; no inherited effect approval. |
| Planning | Select recipients, create children/forks and establish dependencies, commitments and parallelism through guarded control operations. |
| Execution | Dispatch admitted Work; new findings require explicit replanning, referral or new Change without erasing running/uncertain effects. |

A parent can remain in Planning while forked candidate explorations pass through their own Decision, Planning and Execution. Their success means the declared exploration result, not delivery of the parent's feature. The parent then selects or combines results, reassesses affected conditions and executes its own remaining obligations. Each individual Change still has at most one active custodian and one selected Kernel version per active segment.


## Semantic operations and Jev

ChangeKernel owns a provider-independent semantic service for query-versus-Change interpretation at the [interaction boundary](#intent-and-lifecycle), binding, context/support judgments, Checks, discovery classification, Work ranking/fit and experience/guidance retrieval. Packs do not supply independent provider clients, credentials or schedulers. Jev is central intended machinery for suitable bounded judgments, not the whole model or an authorization replacement.

Code handles exact identities, permissions, literals, dates, arithmetic, schemas, transitions and outcome lookup. Copy supplied text. Use a producer only for genuinely missing text, plans, programs or definitions; no mandatory generative verification of every Jev answer is required. Exact structured edits bypass unnecessary rebinding.

For “Set our summer tour budget to €1,200,” retrieve authorized target candidates, resolve meaning and construct typed input in code:

```json
{
  "target": "tour:17",
  "operation": "set",
  "field": "budgetLimit",
  "value": { "currency": "EUR", "minorUnits": 120000 }
}
```

An operation binds exact question, input/source roles, declared options/result interpretation, uncertainty route, provider/model/settings, limits and retained outcome. Filter permissions before retrieval. Include applicable inherited obligations, exceptions and relevant relationships; topical similarity alone is insufficient. Detect overflow rather than truncate critical context. Labels inside a shared request are not access isolation.

Jev's documented [primitives](https://docs.typesafe.ai/primitives) supply bounded Choice, Score and yes-probability judgments, not unconstrained extraction or generation. Choice's 255-option maximum is per question, not per application. The [model documentation](https://docs.typesafe.ai/models) reviewed during design lists `jev-1.13.0`, 64k total request tokens and 32k State-plus-longest-question tokens; verify these version-specific limits during qualification. Prefer small coherent context. Batch independent questions; questions in one request cannot consume one another's answers.

Code owns thresholds, aggregation and scheduling facts; required prohibitions cannot be averaged away. Retain false as well as true results. Confidence is not verified correctness. Escalation follows uncertainty/consequence policy rather than routine stronger-model review. Local hosting does not imply local inference; disclosure, retention, total cost and full-path latency require qualification, not reliance on provider claims. Native Jev questions require deliberate integration with the current text-oriented model port.

## Change memory and procedural State

Memory has two complementary homes, not two competing current copies. **Change memory** retains what happened in a particular pursuit and why: original and revised intent, decisions, material alternatives, assumptions, attempts, exact procedure/assessment/candidate references, effects, observed outcomes, failures, repairs and unresolved consequences. **State memory** retains what currently applies: adopted procedures, continuing goals/preferences/constraints and supported knowledge with scope, uncertainty and adoption/revision/retirement history. Preserve concise attributable rationale and necessary grounds, not every conversation or private reasoning transcript.

The engine owns representation, custody, versioning, retrieval and transitions; Workspace resource authorities and Change owners govern their respective contents and visibility. Tools are executable abilities; procedures are reusable strategies, not permission grants. An authoritative native runbook or executable policy can be adopted by exact reference rather than copied into another writable store. Developer-supplied guidance can seed proposals; installation alone does not adopt it.

```text
Change experience → proposed lesson → assessment and authorized adoption
  → versioned procedure in State → later Work uses exact version
  → later Change records usefulness, failure and proposed improvement
```

Adopting, revising or retiring State memory uses the same Change controls as other semantic State updates. Internal learning machinery may collect, compare, draft and prepare; it is not a second publication authority. Memory updates may be effects of an existing Change, while learning after closure can become a linked Change. Automatic adoption within delegation is possible, without mandatory model calls or human dialogs for every observation. Protected research custody and derived index/freshness maintenance do not silently change governing meaning.

A procedure identifies purpose/applicability, instructions or exact code/configuration reference, preconditions/limits, version and adoption status. It has two different source relationships: pinned historical support explaining its adoption, and parameterized observation requirements to obtain when using it. A current execution dependency or governing assumption may require reassessment when it changes; historical evidence remains historical. Each later Change records the exact procedure versions actually used, so both past decisions and current guidance are explainable. The [State contract](../system/components/state.md#intent-change-memory-and-procedural-state) owns retained identities, source links and access rules.

| Material | Durable home |
| --- | --- |
| Immediate pursuit and its intent revisions | Change Trace log. |
| Case-specific observations and outcomes | Retained grounds referenced from Change memory. |
| Continuing goal, preference or constraint | Scoped adopted State. |
| Supported knowledge or reusable strategy | Versioned State with evidence and applicability limits. |
| Reliable mechanics | Code/configuration or tests rather than redundant prose. |
| Unadopted improvement | Proposal or candidate, not active guidance. |

Repetition and correlation can justify a proposal, not automatic policy or proof of causation. A memory update cannot weaken the rules authorizing its own adoption. Local success must not silently become a prohibition, global preference or shared developer policy. Purpose may transfer while its implementation does not: readability is not always font size 16. Failed or recovered work can teach without completing its original goal. Not every observation needs a procedure or backlog item.

Retrieve within current permissions before judging relevance; include applicable obligations, exact versions and uncertainty rather than just similar prose. Return whether material is historical context, proposed learning or current adopted guidance. Summaries and indexes are derived, not replacement sources or independent corroboration. Context eviction does not retire policy. Generate bounded human/agent briefs or exports when useful, not another independently editable intent or memory file. Cross-Workspace reuse and derived knowledge require authorized sharing. Memory guides investigation and repair but never replaces exact effect receipts, recovery grounds or current observations.

The [Anthropic playbook](https://claude.com/blog/the-ai-native-sdlc-playbook), its [on-call account](https://claude.com/blog/ai-ci-cd-on-call) and [security account](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle) informed this direction: durable handoffs, incident-to-procedure learning, early feedback, evaluation of agent configuration and attention to delegated authority. They combine guidance and reported experience, not qualification evidence for ChangeKernel. Their Markdown layouts, fixed workflow sequences and sample hooks are not adopted as universal contracts. More explicit architecture is not proof of greater efficiency; compare useful outcomes, human attention, missed constraints, rework, recovery and total cost.

## Frontend guidance and responsiveness

Forms, agents, external tools and automation use permission-aware domain reads and the same authoritative backend mutation boundary. A human Save or external tool call is not a bypass. Presentation and local draft interaction need not become governed effects. Portable checks can run locally; permissions, shared-State/aggregate constraints and semantic conditions may require server assessment. Reuse supported rules rather than maintain separate frontend/backend policy copies. Not every custom Check or database rule belongs in a browser.

Shared feedback exposes blockers, required approval or Evidence, advisory guidance, suggested next steps, source/adoption/version, exact assessed input/scope, freshness and unresolved coverage. Filter explanations as well as values by permission; hidden information must not be presented as absent requirements. Guidance can appear on editor opening, consequential edits, publication preparation and confirmation, not only after rejection.

```text
Publish tour announcement
Team guidance · Event announcements, version 3
Include accessibility information and a ticket link.
This draft has no ticket link.
[Edit draft]                         [Publish]
```

Advice leaves Publish available subject to other rules. An adopted requirement blocks until satisfied or legitimately changed. “I understand” proves acknowledgment, not completion. Dismissal never silently changes policy. Jev can select relevant guidance; retained wording/templates render it without mandatory generation.

Local typing is not a Change per keystroke; debounce/coalesce coherent edits. Private draft persistence and publication can have different requirements. Optimistic presentation must not expose unapproved values to others or trigger effects. Preserve input on conflict/rejection; slow assessment or approval remains visibly pending.

Fetch guidance early, reuse assessments only while exact input and relevant versions/conditions remain valid, and refresh affected results rather than everything after unrelated memory changes. Final backend checks remain authoritative against stale or modified clients. Target no per-Save repository discovery, generation for exact edits or inference for exact facts. Ordinary-save and slow-tail latency remain unmeasured and must be reported separately.

## Operator console for development

The first viable self-development release includes a practical terminal interface, not merely a read-only log viewer or a later visual-polish milestone. It must let a person direct product outcomes and manage execution through the same authoritative backend used by workers. A terminal client neither owns lifecycle policy nor gains a privileged mutation route. Keep it separate from the worker harness and expose it through the standard launcher/shared backend, not only a harness-specific view. Terminal toolkit and transport remain implementation choices requiring review.

Own the interaction design around outcomes, Changes, Work and the user's next decision, not a copy of a terminal multiplexer or harness transcript. Selected Herdr mechanisms may support this interface without adopting its pane-centred product model, workspace identities or completion semantics. Improve comprehension and human attention requirements through measured workflows; source reuse alone establishes neither superior UX nor market demand.

| Operator responsibility | Required visibility and controls |
| --- | --- |
| Product direction | Submit What/Why; inspect intended outcomes, scope, commitments and supporting grounds; clarify or revise intent; prioritize, defer or reject pursuit within current authority. |
| Project execution | Inspect eligible, active, waiting and blocked Work, dependencies, worker attempts, elapsed time and known resource use; set supported execution limits and request pause, continuation or cancellation. |
| Consequential decisions | Inspect the exact candidate difference, applicable Checks, stale or missing grounds and required approval; approve or reject the identified subject within policy, never waive failed requirements through approval. |
| Outcome review | Distinguish planned, attempted, published and observed results; inspect remaining obligations and recovery status instead of treating completed Work as proof of the desired outcome. |
| Operational control | See the controlling immutable release, supported capabilities, connection/freshness state, unavailable services and unresolved custody; understand the next permitted action and why other actions are blocked. |

The minimum surface provides proposal entry, an attention queue, Decision, Planning and Execution views, Change details, Work/attempt tracking, candidate/Check/Evidence inspection and controller health. Workspace selection and a private cross-Workspace My Changes view must not expose another user's folder or duplicate history authority. The three stages do not hide waiting, approval, applying, verifying, custody transfer, cancellation or recovery states. Operators can inspect why a Change exists, what happened, what guidance currently applies and what remains unresolved; exact historical and current references must remain distinguishable. Product priorities and execution priorities are governed revisions or views of existing records, not a second independently editable backlog. A small initial worker configuration and simple presentation are sufficient; unsupported controls must be visibly unavailable rather than cosmetic buttons.

Observability is part of backend contracts from the start. Retain attributable state transitions, attempts, waiting reasons, assessment and effect references, operator decisions and available usage. Views derive from durable records with explicit freshness and coverage; reconnecting must recover current status without inventing missing progress or rerunning work. Reading or rendering a view does not launch workers, Checks or inference. Private logs and secrets are not automatically operator-visible Evidence.

Operator commands bind actor, exact subject/version and retry identity. Revisions invalidate affected assessments; reprioritization does not bypass dependencies or accepted commitments. Pause does not imply that an active process has stopped, cancellation is not confirmed termination, and retry requires outcome/custody reconciliation. Closing the terminal does not silently cancel host-owned Work. The interface must show pending requests, confirmed outcomes and uncertainty separately, preserve rejected input, and explain safe recovery without requiring the operator to inspect raw storage.

## Cross-workspace development

A user goal can depend on authorized development elsewhere without merging State, permissions, memory or transactions. First compose existing capabilities and any supported generic representation: a missing predefined entity is not necessarily a capability gap. Missing information, missing instances, unsupported capabilities, operational unavailability and denied access are different conditions; denial is not permission to develop a bypass.

For “Book three weekend shows near Porto within €1,200”:

1. The user creates C0 for the application Workspace, passes applicable Decision Checks and enters Planning under their Kernel.
2. Planning identifies a genuine capability gap. If full-file disclosure and handoff are authorized and supported, the PM borrows the same C0 into private custody; otherwise share only the authorized unmet-need material. The user folder is never shared.
3. The PM's Kernel admits consideration and records attributable refinements without replacing original user intent. Consideration is not an automatic implementation commitment.
4. Planning identifies design/development contributions and routes linked C1/C2 to appropriate owners/Kernels. Each child has its own identity, owner and fixed Workspace; developer-owned resources in another Workspace require that explicit target. Alternative pursuits may use forks instead of complementary children.
5. Each new Change follows its own Decision → Planning → Execution path. The parent consumes authorized results under its dependency conditions. Work, assessments and ownership do not become shared writable histories.
6. Native-authorized integration/publication and separately authorized deployment establish actual capability availability, not merely completed children or a merged commit.
7. Return/continue C0 through the supported custody protocol, verify availability for the intended user, and recheck current intent, permissions, State, requirements and commitments before resuming the original pursuit.
8. Review actual bookings, not feature delivery alone.

Dependencies bind particular results/capabilities and satisfaction conditions, not whole Workspaces globally. One developer Change may support several user requests without merging private scopes. Submission authorizes asking, not implementation or deployment. Rejection, deferral, cancellation, supersession, revoked visibility and unavailable capabilities remain inspectable; permission does not create feasibility or outside cooperation.

## Hosting, distribution and evolution

One engine supports a library interface and standard launcher; applications bundle a pinned release without separate end-user platform accounts or manual setup. Docker is optional. Prefer a long-lived application-owned host initially; in-process use must supply equivalent durability, shutdown/restart and execution guarantees. Runtime outage blocks affected governed operations, not necessarily unrelated application functions.

The internal core remains pure and deterministic; the host performs storage, inference and effects through qualified bindings. Placement, ownership, authority and enforcement are separate. Installing a library, service, skill or operating-system package governs nothing until scoped resources and write routes are enforced. A local host cannot prevent remote-source bypass with a client filter alone.

Build the first useful self-development product in Rust: the pure engine core, application coordination, host and terminal client share one implementation. User Kernel definitions are versioned inputs, not separate engine forks. Retain TypeScript only for application bindings, controlled Pi integration and JavaScript/compiled-TypeScript Check execution where needed. JavaScript runtimes and workers remain explicit capabilities, not dependencies of pure engine-core use. Git history preserves retired TypeScript behavior and useful safeguards; reproducing every prototype feature or interface is not a release requirement. Preserve historical records and meanings without automatically importing them into the new runtime.

Bandwagon and Omarchy test generality, not the product boundary. Linux-first qualification is acceptable without positioning ChangeKernel as Linux-only. Machine integration starts with bounded supported resources and independent recovery access, not whole-machine guarantees. Friendly Check authoring, team administration and a Packs marketplace remain deferred Hub work; ordinary collaborative Workspaces do not require Hub.

One immutable release owns common interpretation and transitions. Definitions, source revisions, adopted evaluators and execution/model settings retain their own exact identities. Upgrades require explicit supported transition, not silent reinterpretation, migration or authority transfer. Detailed release and qualification obligations live in the [release contract](../system/components/package.md).

## Repository representation

Source structure must make ownership and dependency boundaries visible. Retain the pure-kernel/ports/adapters split and meaningful boundary checks. The retired TypeScript prototype mixed Git-specific host composition, terminal rendering and server coordination; Git preserves that implementation and its review evidence. Its removal does not establish the native operator path, and Git/Wiki-specific concepts must not define universal State.

The following depth-three target expresses desired responsibilities, not a claim that Rust implementation or relocation has occurred. `src/kernel/` names the pure source layer; user Kernel definitions are domain data within that layer. Concrete file-store modules and public interfaces must follow the dependency gates below rather than being inferred from this outline. Directory names alone establish no boundary: ownership mappings, import direction, package reachability and tests must agree. Tests follow source responsibilities; Rust unit tests may live beside their modules, with broader suites under `tests/`.

```text
Cargo.toml                     # One Rust library/executable package
Cargo.lock
rust-toolchain.toml
package.json                   # Supporting TypeScript bindings and workers
package-lock.json
tsconfig.json
tsconfig.build.json
src/
├── lib.rs                     # Curated Rust library interface
├── main.rs                    # Thin standard launcher
├── kernel/
│   ├── data_contracts/
│   ├── identity/
│   ├── workspaces/
│   ├── kernels/
│   ├── state/
│   ├── changes/
│   ├── work/
│   ├── checks/
│   ├── evidence/
│   └── memory/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── planning/
│   ├── coordination/
│   ├── assessment/
│   ├── publication/
│   └── recovery/
├── ports/
├── adapters/
│   ├── sqlite/
│   ├── git/
│   ├── linux/
│   ├── jev/
│   └── node/
├── api/
│   ├── contracts/
│   └── transport/
├── host/
│   ├── configuration/
│   └── composition/
├── clients/
│   └── terminal/
├── bindings/
│   └── typescript/
├── workers/
│   ├── pi/
│   └── checks/
└── packs/
    └── software-development/

tests/
├── contracts/
├── integration/
├── recovery/
├── qualification/
├── package/
└── fixtures/
docs/
└── archive/
.changekernel/
├── wiki/
└── changes/
```

The kernel imports only pure kernel contracts/rules. Application coordination uses kernel contracts and ports rather than concrete bindings or presentation. Adapters implement external capabilities; the host owns configuration, wiring and process lifetime. Clients use the shared public boundary rather than private storage or execution internals. Native Git/filesystem behavior stays in its binding. The first-party software Pack uses ordinary Check adoption/execution, not privileged universal policy. Public exports remain curated.

Keep one Rust package and one supporting JavaScript package in one source repository, released as one qualified product. Bind the Rust artifacts, JavaScript assets and required runtime/dependency versions in the release identity. Do not introduce a multi-package workspace, service fleet, empty future folders or blanket file shuffle. Build cohesive working paths with tests and ownership mappings, selecting applicable safeguards rather than requiring prototype feature parity. Current frontmatter still maps actual source paths until replacement; target folders do not grant import allowances or delete existing safeguards. Retire obsolete implementation deliberately while preserving historical protocol interpretation, not a permanent parallel engine or mandatory historical-data conversion.

Design remains in these canonical documents, governed lifecycle history in its existing records, and implementation in source/tests. Generated views, private execution storage, caches, worktrees and package artifacts are not source structure. The temporary status note describes unfinished implementation, not another roadmap.

## Current implementation and historical meanings

Current source implements bounded native SQLite intake and verified committed-source observations, plus narrow TypeScript Pi bridges and their required protocol/codec dependencies. The historical TypeScript engine, console, Git/Wiki orchestration and SQLite candidate implementation have been removed; their capabilities are not native exports. The bounded native private-continuation contract has explicit schema initialization, revision-zero custody, verified intent reads and atomic SQLite intent appends with exact retry reconciliation. Concrete SQLite file-candidate custody remains unintegrated pending shared retained-attribution correction; its generic ports and data types are not a completed write capability.

The Workspace/user-Kernel model, file-first Change Trace authority and Decision → Planning → Execution pipeline are approved desired design, not implemented replacements for those profiles. General membership, portable handoff/fork protocols, encrypted sharing, full progression, publication, native Jev operations, durable coordination/recovery, memory adoption and operator controls remain unfinished. Examples above are not current exports. Existing `container_id` fields and SQLite layouts keep their exact bounded meanings; no rename, automatic migration, JSONL dual-writing or inferred compatibility is authorized. For the first file-first delivery, keep these existing SQLite profiles and their tests unchanged rather than extending their schema or integrating the blocked SQLite candidate writer. Build a separately versioned file-first profile without dual-writing a Change's history. Any later migration, retirement or reopening of SQLite candidate work requires an explicit decision; the retained-attribution finding remains real and the unintegrated source is not accepted by changing architecture. Reusable safeguards do not authorize reinterpreting old identifiers or receipts.

`ProjectSnapshot`, `readSnapshot`, `snapshotDigest`, existing `codewiki.*` protocols, managed-document fields and historical Planning operations retain their original meanings until explicit versioned implementation. They are not generalized snapshots, acceptance certificates or new-stage results. Git history retains the old Git/Wiki implementation and tests; its document/type hierarchy is not part of this new universal model. Markdown knowledge may be ordinary source-backed State through a suitable binding, not a separate required Wiki subsystem.

Source design metadata is not managed adoption. Consolidated `ownership` mappings preserve source/test coverage and existing implementation role/event names; they neither activate those roles nor define extra Check stages. Retained `source-history` is historical provenance, including references to retired pages; it is not an active relationship graph or an acceptance receipt. Existing `.changekernel/changes/` records and archives are not rewritten. This mutable checkout must never govern itself; qualification, activation and explicit external-controller handoff are separate from documentation approval.

## Unresolved contracts and proof

The agreed primitives, cardinalities and required invariants do not depend on selecting a particular transport, cipher, database or orchestration product. No conflict was found between those decisions. However, durable file custody, exclusive borrowing, confidential transfer and safe aggregate commitments **do depend on concrete protocols and proof**. They are requirements, not guarantees established by this document. The open matters below cannot be left until after the interfaces or implementations that depend on them have been committed to.

### Dependency-gated implementation

This is the canonical capability dependency plan, not a separate roadmap or an assignment queue. Resolve and review each affected contract before assigning implementation that freezes it. Bounded disposable probes may inform that decision without claiming operational support. Independent work may proceed only against agreed interfaces. If a feasible supported profile cannot preserve an agreed invariant, stop and return the product tradeoff to the user rather than silently weakening it.

| Gate | Contract to settle | Dependencies and blocked implementation/claim |
| --- | --- | --- |
| Workspace and identity binding | Concrete descriptor/IDs, native identity and membership mapping, authenticated folder ownership, typed operation/delegation boundary, exposed resources/operations, scope revisions and actual writer protection. | Before new public identity/binding formats, persisted associations or access-bearing endpoints. Backend identity and native user authority must not come from client claims; generic file APIs and same-privilege processes cannot bypass protection. |
| File-first Trace profile | Versioned bounded schema, protected accepted-prefix checkpoint, joint creation/commit/recovery, writer arbitration, exact retry/result subjects, interrupted tail versus corruption, retention, clean restart/reboot admission and storage-incident evidence distinct from import/rollback. Git is evidence/transport, not acceptance, in the first local profile. | Requires the identity/custody boundary; precedes new authoritative persistence and continuation. Backend-only API use is not proof of physical protection or freshness. Whole-domain rollback-resistant continuation requires separately qualified surviving authority. |
| Kernel and lifecycle contracts | Kernel/Check version references, stage/intent/plan subjects, effective mandatory requirements, feedback, control operations, evidence reuse and explicit old-profile disposition. | Requires agreed identity and record/reference contracts before new stored stage formats or public APIs. The three-stage model cannot reinterpret historical Planning or two-phase records. |
| Work and execution custody | Work/attempt and parent invocation identities, exact runtime/configuration, named scoped inputs and structured history references, tools/effects, aggregate budgets, bounded delegation, dependency/result conditions, supervision, cancellation and unknown-outcome handling. | Requires lifecycle and protected persistence contracts before worker dispatch. Missing process/provider custody cannot be repaired by inference or a new attempt ID. |
| Publication and shared commitments | Concrete source guards, serialized admission across overlapping resources/Changes, source receipts or equivalent outcome protocol, repair and reconciliation. | Requires exact candidates, applicable Checks, current authority and durable custody before real effects or safe-retry/aggregate-safety claims. Outside writers need cooperation/guards or explicitly weaker declared coverage. |
| Borrowing, forks and routing | Exact checkpoint derivation, authenticated offer/accept/return, one active continuation authority, stale-copy rejection, interrupted transfer, in-flight Work, dependency/selection/cancellation and checked result adoption. | Local fork creation requires agreed identity, Trace and admission contracts; multi-user continuation additionally requires transfer/sharing protocols. No simultaneous authority from copied files or independent approval of conflicting forks. |
| Confidential sharing | Disclosure policy, authenticated encryption/transport formats, key distribution/rotation/revocation, authorized views and metadata visibility. | Before sensitive export/transfer or encrypted collaboration claims. Local protected custody can be qualified without promising a remote encrypted-sharing capability; disclosed plaintext cannot be recalled. |
| Generic State and further bindings | Representation when native structure is absent, discovery coverage, native capability integration, binding-specific retention and recovery. | Before promising that fallback or additional source capability. A first native file/repository binding need not wait for every database/API or generic-record design. |
| Compatibility and qualification | Explicit migration or non-migration disposition, exact artifacts/dependencies, preservation of historical meanings, interruption/backup proof and controller adoption/handoff. | Before format conversion, release claims, activation or controller transfer. Source checks and design approval do not qualify a release. |

For the first bounded file-first path, agree identity/scope and the Trace/Git profile first, then Kernel/lifecycle/reference contracts and protected candidate/Work execution, then guarded effects and recovery. A local single-custodian profile may precede remote borrowing, encryption and cross-Workspace cooperation only by advertising those capabilities as unavailable, not approximating them. Profile contracts must resolve their own writer exclusion and recovery even when broader distributed protocols are deferred. Operator views/controls may develop against agreed supported/unavailable semantics in parallel; no new worker assignment is implied by this plan.

### First dogfood delivery sequence

Deliver the [first self-development release](../system/components/package.md#first-self-development-delivery-focus) through cohesive, usable increments of one complete path. The increments below describe observable exit conditions, not a parallel assignment queue, current implementation acceptance or permission to bypass the dependency gates. The temporary handoff owns assignments, exact baselines, review verdicts and unfinished execution state.

The first dogfood-ready release is **local-only on the sole developer's machine**. Its host control, authoritative custody, restart admission and supported repository/files effects must not require an external coordination, acceptance or restart service. The selected first host is an administrator-installed local custody service with a dedicated protection identity, isolated from ordinary clients and workers. Local-only hosting does not require local model inference; permitted research access and provider calls still need their applicable disclosure, cost and execution authorization. The immutable external controller remains installed outside the mutable checkout on this machine, not supplied by a remote service.

Bound the initial qualification surface to Linux-first software development through one supported repository/files integration, one enrolled developer identity, one active custodian and a small worker configuration. Select one producer route and one bounded Check execution path for that profile rather than qualifying many runtimes concurrently. Preserve the reusable Rust engine and replaceable bindings; the selected host is not a mandatory operating architecture for every application. Remote borrowing, confidential sharing, additional backends, broad automatic discovery, large worker fleets and visual polish are not simultaneous prerequisites.

Service-backed collaboration is the second-release direction, including the [borrowing mechanisms](#routing-borrowing-and-forks) already specified in Wiki. Preserve the distinction between transferring the same Change's active continuation and delegating Work, with one active continuation authority, exact checkpoint provenance, native participant rights and checked result adoption. This sequencing does not select a service architecture, migration or sharing protocol, authorize deployment, qualify borrowing or make those mechanisms prerequisites for the first release.

The first-host administrative deployment cost and the [first local recovery profile](../system/components/state.md#first-local-recovery-profile) are selected product decisions. This recovery profile explicitly does not promise to remember a predecessor's storage error whose evidence did not survive: a successor may resume after such an error only through validated recovery under the declared profile. Live errors and retained incidents remain fenced. This is a deliberate reduction of the lost-incident guarantee, not proof that no earlier error occurred. Ordinary clean restart and reboot remain required; predecessor exclusion, current native authority, source-outcome reconciliation and the separate limits on whole-custody rollback remain unchanged.

Before implementation freezes an affected boundary, settle the exact service credential, process/IPC/handle protection, native source-access, enrollment/lifecycle and custody/recovery contracts. Administrative installation does not automatically select a managed login session, repository relocation, UID ledger, service manager or hardware witness. The protected service must not broaden the acting user's native source rights. The reusable engine remains independent of this one-machine deployment profile. Installation, privileged/device experiments, live inference, deployment, activation and controller handoff retain their separate authorization gates; approval of the design choices grants none of those actions.

| Increment | Prerequisites to settle | Observable exit condition |
| --- | --- | --- |
| Protected opening and history | Workspace/native identity and protection, joint creation, accepted-prefix/reference and exact retry contracts, clean restart admission. | The operator opens a supported repository Workspace, submits a protected proposal, inspects attributable history through the shared backend, retries without recapture or duplicate work, and reopens the same Change after clean shutdown and ordinary reboot. Historical delivery remains distinct from current effect eligibility. |
| Decision and Planning | Exact Kernel/Check and adopted-policy references, intent/stage/plan contracts, assessment validity, Work dependencies and operation/query semantics. | Meaningful assessments provide actionable clarification; the operator inspects original and revised intent, a checked plan, required decisions and explicit eligible/waiting/blocked Work. Planning success alone does not dispatch Work. |
| Bounded development and effects | Protected attempts/results and accounting, qualified producer/Check containment and cancellation, exact multi-file candidates, publication guards and source-outcome reconciliation. | A bounded worker prepares an inspectable candidate; required Checks and any exact-subject approval precede guarded publication; fresh observations and combined-outcome Review establish what actually succeeded, failed or remains uncertain. |
| Qualified external controller | The complete bounded path, declared interruption/incident and repair behavior, durable grounds and learning, a frozen exact release subject. | An external qualification exercise demonstrates fresh-worker continuation, supported repair and a lesson adopted through normal Change controls and reused later. The same candidate bytes are packed and tested only in disposable external projects with isolated Pi settings; immutable activation and explicit controller handoff remain separate authorized steps. |

Introduce authorization, exact retry, stale-subject, interruption, cancellation, cleanup and repair checks with each applicable increment rather than postponing recovery until packaging. A typed-only opening/history milestone is useful but is not the dogfood-ready release. A console backed by fabricated progress, a permanently unavailable successor or an unguarded publication route does not satisfy an increment.

Give shared public/persistence contracts and composition one coordinated owner. Connect binding compilation to an actual preparation path and terminal controls to authoritative backend operations; do not accumulate unused modules, cosmetic controls or a second task store. Parallelize ready producer, Check, presentation or other independent slices only after their shared contracts and supported/unavailable semantics agree. A missing operating or safety decision blocks affected slices rather than creating another equivalent report round.

Use the [minimum local dogfood](../system/components/package.md#minimum-local-dogfood) and [qualification](../system/components/package.md#qualification) contracts as the release acceptance boundary. Include a goal not encoded as a dedicated workflow, consequential ambiguity, a failed Check and meaningful repair, stale-candidate refusal, restart/reboot, another worker continuing without duplicate effects, retained research and useful adopted learning. Measure operator effort, actionable-feedback latency, errors and total cost against relevant direct-development baselines. These observations should inform later Changes after qualified handoff, not expand the first release to anticipate every improvement.

Additional implementation choices remain local to their capability: supported discovery languages/frameworks, incremental invalidation, typed/native/restricted-program execution forms, Jev deployment/questions/quality thresholds, worker ranking/fairness and terminal toolkit/transport. Settle their contracts before affected implementation. A generalized additional AI-restriction layer, marketplace and broad cloud/machine integration remain deferred rather than prerequisites for the first enforced path. No new storage, cryptographic, orchestration or synchronization dependency is selected by the research.

Prove one complete enforced path with a goal not already encoded as a dedicated workflow, ambiguity/repair, recoverable failure, durable learning and another worker continuing from retained records. Qualify each additional custody/transport/source profile before claiming it. Broader generality requires the same semantics with a substantially different source/backend and frontend plus replaceable agent clients. Measure end-to-end correctness, missed constraints, escalation, cost and ordinary/slow-path latency. [Qualification](../system/components/package.md#qualification) owns the challenge matrix; the temporary handoff owns current execution status.
