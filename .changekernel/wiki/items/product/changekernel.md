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
| Policy-governed typed progression and applicable Check enforcement | Approval, execution and success must have precise, distinct meanings without imposing a universal workflow. |
| State references, observations and evidence lineage | Plans and worker claims must not become invented actual outcomes. |
| Bounded execution coordination and reconciliation | Lost replies and partial effects must not cause blind repetition or false completion. |
| Host and binding contracts, including authority and custody obligations | Integration must expose supported guarantees and refuse unsupported ones. |

The user owns goals and accepted commitments. Resource owners and applications own native permissions, business rules and valid domain operations. Native systems retain their actual State. Qualified hosts supply authentication, native execution context and custody protection under a declared threat model. Harnesses supply session/inference mechanics. ChangeKernel validates and enforces the contracts it consumes; an interface declaration alone does not prove that a host meets them.

A mechanism belongs behind a replaceable boundary when it can change without weakening these invariants. Reuse suitable storage, transport, model, execution and OS facilities. Do not build a new runtime, semantic compiler, identity system or sandbox merely to own its implementation.

## Contract map and truth boundaries

| Document | Responsibility |
| --- | --- |
| [State and persistence](../system/components/state.md) | Native State, explicit bindings, evidence, JSONL acceptance, retries and recovery. |
| [Composable SDK](../system/components/sdk.md) | Shared JavaScript/TypeScript access to the Rust engine, bounded composition and subsequent Pi integration without new lifecycle semantics. |
| [Checks](../system/components/checks.md) | Engine invariants, configurable assessment policy, exact subjects and results. |
| [Execution](../system/components/agent-execution.md) | Trusted-host integration first; later worker coordination and containment contracts. |
| [Release and qualification](../system/components/package.md) | Supported capability claims, source tests, exact-release qualification and controller authority. |
| [Phased plan](plan.md) | Dependencies, falsifiable propositions and evidence required to advance. |
| [Research](../system/research.md) | Investigated mechanisms and limits, not an implementation queue. |
| [Retained native profiles](../system/components/native-profiles.md) | Frozen SQLite/native/packet behavior and known implementation gaps. |

Wiki owns durable intent and capability gates. Source/tests own executable behavior. Git retains history and completed review evidence. The [temporary status note](../../../../CHANGEKERNEL_STATUS.md) owns unfinished source-development work until qualified Changes and Work can own execution state. No standalone refactoring roadmap or second lifecycle database is required. The retained `wiki/` name does not make Wiki a runtime primitive or require application State to be Markdown. Legacy metadata is historical provenance, not managed adoption.

## Subject-first terminology

Use subject-qualified names: **Change navigation**, **ledger navigation**, **Change context**, **intent revision** and **Check assessment**. A Check defines a question; running it produces a Check assessment of an exact subject. Prefer operation names such as “run Check” over an ambiguous “assess” or “assess Check.” This terminology does not rename frozen wire operations or reinterpret retained results.

Use **subject identity + exact version** consistently, qualified as Change version, intent version, Check version, policy version or schema version. These references are not interchangeable and need not share a numeric representation. A new Check assessment advances Change history without necessarily changing intent. A host, storage or protocol **profile** describes supported operations, assumptions and limits; a profile version identifies that definition, not a product release, workflow stage or necessarily a superset of another profile.

## First supported scope

The first target is a **trusted-host, single-user engine profile with one binding and one bounded typed operation**. Its useful witness is an intent-bearing transition that can be inspected, refused when unauthorized or stale, executed through the native binding, reconciled after interruption and reopened without repeating effects. It needs no agent, model, custom evaluator runtime or rich console.

The host supplies authenticated identity and a supported native operation context independently of request payloads. It must enforce its declared access/custody boundary. Input remains untrusted; host compromise and hostile processes sharing the host's storage/execution authority are outside this initial profile. Do not market this as protection against them. A standalone adversarial-client host, including faithful original calling-thread admission, is a **deferred stronger profile**, not a prerequisite and not satisfied by the narrower one.

This scope change does not relax existing frozen native APIs, authorize a privileged fallback, or qualify any installed host. [Phase-specific evidence](plan.md) must precede the corresponding capability claim. The initial engine release is distinct from a later autonomous self-development release.

## Ownership model and responsibilities

**Users participate in Workspaces. Their Kernels govern Changes to those Workspaces. State represents a Workspace at particular versions and scope.**

| Concept | Meaning |
| --- | --- |
| Workspace | The persistent, identified subject with explicit resource boundaries and established authorities. Use `workspace_id` in the new contracts. It is not a mandatory process, database or directory. |
| State | Native reality within declared scope, represented by version-/time-bound observations. It is not a separately managed State object, store or lifecycle; retained observations are evidence, not necessarily complete snapshots. |
| Change | One user-owned, accountable pursuit whose understanding can evolve, preserving original intent, adopted revisions and actual outcomes separately. A proposal is already a Change. |
| Ledger | A user-owned collection of Changes with explicit identity and authorized navigation, not another lifecycle database. |
| Kernel | A user's versioned governance policy and selected requirements/Checks. It may adopt a workflow; it is neither a universal stage sequence nor the engine implementation. |
| Work | An attributable unit of pursuit belonging to one Change. The first effect path needs one precisely specified operation, not a mandatory planning stage or generalized scheduler. |

Each Change has one originating owner and one fixed Workspace. Contributions remain attributable to their actual actors; borrowing cannot rewrite earlier attribution. Original intent is not overwritten to fit eventual delivery. Owning a Change never grants rights over its target resources.

### State access and Change authorization

A permitted effect requires **native resource rights ∩ current delegated scope ∩ Change authorization**, plus applicable subject/freshness, Check, custody and outcome guards. A passing Check or user approval cannot override native denial. Native write access does not approve every transformation.

The host/binding must name and establish the authenticated acting subject and native authorization context it actually supports. Do not accept a caller's actor field as proof, retry with broader broker rights, or treat a prior permission Boolean as point-of-use authorization. The initial profile trusts the qualified host integration; it does not claim to reconstruct an arbitrary Linux client's original thread context. The deferred stronger proposal and its failed shortcuts remain [research evidence](../system/research.md#deferred-host-profile-evidence).

### Relationship cardinalities

A user may own multiple Kernels and join multiple Workspaces. A Workspace may have multiple users and State representations; each representation has explicit coverage and visibility. A Change can reference multiple State observations and Work items; each Work item belongs to one Change. Kernel versions are immutable. A Change may use different Kernel versions in attributable continuation segments, not through retroactive replacement.

A Change has at most one active continuation custodian. Dependencies form a graph, not a mandatory tree. Fork lineage does not itself create a dependency. These are long-term logical relationships, not requirements to implement multi-user custody or a graph scheduler in the first profile.

Relationships use stable Change identities and explicit meanings, not directory nesting. Informational relatedness, dependence on a specific result/condition, contribution to a broader pursuit and supersession have distinct semantics; their wire names are not selected here. A dependency needs exact adequate grounds, not merely another Change's closed label. Contribution does not automatically complete the broader pursuit, and supersession does not erase earlier outcomes. Unavailable or undisclosable required grounds remain unresolved. Linking another user's Change grants neither access nor authority.

A relationship assertion is attributable in the asserting Change. It does not require an unqualified atomic update of both files; reverse links and graph navigation may be derived indexes. Required reciprocal agreement needs its own explicit contract. Shared-resource conflicts still require native concurrency guards even when no relationship was recorded.

### User Kernels and version selection

Bind progression to exact intent, Kernel, applicable Check, operation/subject and any adopted plan or workflow versions. New versions do not rewrite old decisions. Explicitly assess a continuation under changed policy before it authorizes new effects. The first profile can use one fixed, versioned policy; user authoring and distribution are later capabilities.

## Workspaces, membership and boundaries

Connect to native files, records and services through declared bindings. Tracking is not write permission; read-only resources can constrain a Change, and a creation scope can cover future resources without pre-enumerating filenames. Workspace membership does not disclose every user's private Changes. A user-bound Change folder is not a sharing unit.

### Owner-directed automation

Automation is an intended later capability under adopted intent and current delegation. Human approval is required where policy requires it, not at every deterministic operation. Standing permission is bounded by subject, scope, allowed effects and revocation; it is not blanket authority to change software, deploy or alter policy.

### State-triggered automation

Future triggers consume authorized scoped observations and create or continue Changes through the same typed-operation and authority boundaries. Observation is not authorization. Version/cursor identity, duplicates, gaps, reset, revocation and uncertain outcomes need binding-specific evidence before a trigger is supported. No universal monitoring service, complete event stream or automatic repair guarantee follows from the product goal.

## Developer experience

An application exposes observations and typed operations with native constraints, authority, version/concurrency semantics, result evidence and recovery limits. Prefer explicit bindings to concrete capabilities over a universal State interface. The same engine must remain useful without semantic inference.

The selected client direction is a robust, efficient [composable JavaScript/TypeScript SDK](../system/components/sdk.md) over the Rust engine, serving both ledger and individual Change operations. Design the SDK around actual native guarantees and model-free consumers, then integrate Pi's existing capabilities through adapters using the same SDK path. A read-only navigator is the first consumer, not a special-purpose backend. Existing supported mutations remain typed operations; client composition does not introduce new lifecycle semantics.

SDK ergonomics, transport and bounded helpers may improve without changing ledger/Change-file structures or operation contracts. Rust retains acceptance, authorization and recovery authority. No Pi session, model call or generic State subsystem is required for the deterministic path; direct Rust clients remain independent of JavaScript. Concrete SDK signatures and host/transport selection must be settled with the first consuming slice, not inferred from this design direction.

### Nothing exists

A developer can provide a creation boundary and a native constructor. An empty system is not permission to invent arbitrary resources or schemas. Unsupported creation remains unavailable.

### Structures exist without records

Declared structures and operations can support creation before records exist. Validate native constraints; do not require synthetic seed data or infer existing State from a schema.

### Structures and records already exist

Observe only necessary authorized scope in place. The engine does not require moving a repository, copying a database or generating a universal State mirror.

### Reopen and inspect

A fresh client can inspect retained intent, decisions, actual outcomes, unknowns and next permitted operations. Reopening history does not execute a plan or restore authority from possession of a file.

## Discovery and bindings

ChangeKernel owns the **versioned integration contract**, not mandatory discovery machinery. A binding identifies supported queries/effects, input/output types, resource scope, native authority, version guards, outcome evidence and reconciliation limits. Preserve the exact binding interpretation needed to understand historical actions. [Native bindings are first-class integration contracts](../system/components/state.md#native-bindings-not-a-separate-state-subsystem); State does not become another independently managed primitive alongside Ledger and Change.

Bind at the application boundary that enforces the required business rules. That may be a domain API or an appropriate direct persistence operation; database access alone does not justify bypassing application invariants. Read-only bindings need not pretend to support effects or recovery. Historical navigation does not acquire fresh native State merely to replace retained observations.

Prefer authoritative native declarations and explicit adapters. Automatic source analysis, semantic classification and binding synthesis are possible future developer conveniences. Generated bindings must satisfy the same contract and be independently validated; inferred concepts are not observed resources or new permissions. A compile-time synthesis pipeline, particular model or dynamic JavaScript artifact is not required by the core.

“Any system” means extensibility through qualified bindings. It does not mean universal CRUD, identical transactions, exact replay of arbitrary external systems or uniform rollback. A genuine capability gap may become a later development Change; lack of an autogenerated binding alone does not prove such a gap.

## State, evidence and recovery

The [State contract](../system/components/state.md) separates observed, desired and candidate State. It retains the baseline and confirmed effects needed to explain a transition, while acknowledging external changes, incomplete observations and uncertainty. History reconstruction rebuilds lifecycle views; it never blindly replays effects.

JSONL is the canonical durable Change language, not an export after another database accepts lifecycle decisions. Typed backend operations construct authoritative records. Clients cannot append arbitrary events, fabricate passing assessments or replace accepted history. Necessary acceptance controls and native receipts have explicit roles; they do not become competing Change histories.

Sharing information and transferring active continuation are distinct. Git and file copies can transport evidence but cannot grant execution authority or prove that a copy is latest.

## Ledger, Change files and derived context

Build the foundations before integrating a product AI-agent layer: **user-owned Change ledger → individual Change file → typed lifecycle operations → efficient backend navigation, Views and context**. The engine must be useful through human and deterministic clients without an agent session. The [foundation gate](plan.md#foundations-before-agent-integration) selects the evidence needed before optional agents become consumers of this backend.

A user's Changes folder provides their Change ledger for a system. The ledger is an owned collection of individual Changes, not a second lifecycle database or an automatically shared Workspace folder. Each Change has its own authoritative JSONL Trace; each accepted line is a bounded, attributable lifecycle-operation record. Recording an attempt and observing an effect's outcome remain distinct boundaries. Physical directory layout and transport do not establish ownership, authority or cross-file atomicity by themselves.

Integration with improved Pi infrastructure preserves the existing ledger and Change-file structure, canonical JSONL schemas, supported typed operations and their admission, authorization and recovery semantics. Reuse compatible execution, tool/model access, context, presentation and generic task mechanisms rather than duplicate them. Pi conversations, task checkpoints and runtime storage remain private execution state or derived aids, not replacement lifecycle authority. Internal implementation changes must preserve the consumed contracts; format migration or new operation types require separate explicit adoption and are not part of this integration direction.

The primary navigation model is **origin + accepted tip + navigable middle**. Origin preserves the pursuit's original intent; the tip identifies the latest accepted operation; a reader's cursor selects the point being inspected. Moving the cursor neither changes the accepted tip nor grants active continuation. Stable operation identities/references are distinct from physical byte offsets. Timelines, current lifecycle Views and contextual projections are different consumers of the same accepted records.

**Change context is an authorized, purpose-specific View of a particular Change version and its referenced grounds.** The Trace anchors it; a versioned projector assembles it for purposes such as understanding, planning, assessment, execution or continuation, not for mandatory public stages. Native State remains native, and externally referenced evidence retains its own version, custody, disclosure and retention requirements. Context identifies the selected prefix, projection interpretation, coverage and gaps; exact reproduction requires the relevant original inputs to remain available. A model summary can be a derived convenience, not replacement authority for intent, decisions, results or missing evidence. File content does not become executable policy or grant native permissions.

This gives a fresh person, deterministic executor or later agent continuity without making a conversation the Change's memory store. Rebuildable indexes and projection caches may accelerate access when justified by measured workloads; they do not replace accepted Traces or the distinct non-rebuildable acceptance controls. The [State contract](../system/components/state.md#structured-history-access-and-context-projections) defines the corresponding read and projection obligations. Both Change and ledger navigation retain deterministic lookup, authorized listing and bounded retrieval. [Semantic discovery](../system/components/state.md#bounded-semantic-discovery) assists when the user cannot name the desired subject; it is not a prerequisite for navigating known references or a source of continuation authority.

## Intent and lifecycle

**The Change format is independent of a fixed pipeline.** Decision, Planning, Execution and Review may be activities or stage names in a selected workflow, but are not universal Change stages. A proposal, refusal or withdrawn pursuit is already a Change without execution. A direct authorized action need not manufacture a plan or separate approval artifact; a stricter workflow may require both. Removing ceremony never removes current authority, exact operation/subject binding, required evidence or honest outcome handling.

### Intent capture and refinement

Capture What and the supplied Why without inventing missing intent. Natural language is first-class, not the sole intended representation: later profiles may consume typed desired conditions or identified source material. Preserve supplied content and provenance separately from derived summaries or proposed formalizations. Adopted clarification, scope, constraints or success conditions become attributable revisions; they do not silently replace the original. The consumed opening profile remains exact UTF-8 What plus nullable Why; no additional input fields are introduced here.

An intent revision continues the same accountable pursuit. A replacement pursuit or independently accountable commitment can instead use an explicitly related superseding Change. The owner or an appropriately scoped delegate adopts that distinction; a semantic model may recommend it, not silently decide it. Topic similarity is not pursuit identity. An agent's improved wording or interpretation is not an adopted revision. Neither revision nor supersession erases earlier commitments, effects or unresolved outcomes, and narrowing intent cannot make earlier work fulfillment of the original goal.

Keep **expressed source intent**, **agent interpretation or proposal** and **actual adoption** distinguishable. For session-originated commitments, retain per-intent or per-decision provenance to the source system/session, stable entry and relevant passage, exact accepted proposal/version and attributed actors. Preserve the supporting material needed to interpret an acceptance such as “yes”; a timestamp, content hash or session filename alone is insufficient. One Change may span sessions and one session may discuss several Changes. Direct commands, forms and APIs need appropriate source/request provenance, not fabricated session identities. Source expression and durable acceptance are distinct moments. The [State evidence rules](../system/components/state.md#intent-commitment-provenance) govern retention and disclosure; a transcript is not a second lifecycle authority.

A direct authenticated request or current scoped delegation may establish adoption without a mandatory extra confirmation dialog. An agent-authored citation cannot establish user consent. A later correction, dispute or ratification names the earlier interpretation and records its actual adoption time and scope; it cannot manufacture earlier permission, erase misinterpretation or rewrite prior actions. Evidence supports what was expressed and adopted, not a claim to know the user's private mental state. These are desired provenance semantics for a separately consumed contract, not retroactive fields or authority in existing profiles.

Pursuit-affecting operations are grounded in the relevant intent version, not required to reassess the whole intent on every call. Bind admission to exact scope and applicable policy; an intent reference alone does not prove alignment or grant effect authority. A result about an earlier revision cannot silently certify a later one. Give each consumer only the authorized relevant inputs. Inspection/navigation remain queries, not automatic lifecycle mutations or evaluation requests.

### Typed requests, operations and records

The backend identifies an operation before recording through its explicit supported type/version and validated contract, not through natural-language classification, a tool name, filename or inferred stage. Clients request operations; the host establishes identity/authority; the backend binds exact inputs/definitions, resolves retries, performs or refuses supported work, and constructs accepted records from the established grounds. The Trace is not a raw command inbox, and reading it does not execute instructions.

A Check defines an assessment question; running one is a typed operation that produces a **Check assessment** bound to the exact definition, question and subject. Intent completeness, candidate behavior and observed outcomes are different assessment questions, not one universal validator of worthy goals. Checks may be requested directly or required by applicable policy. Callers cannot supply authoritative actor, approval or passing-result bytes. Unsupported definitions and missing inputs remain explicit rather than being guessed or accepted.

Change is the unit of purpose; domain action is the unit of native work; a Trace record is the accepted lifecycle account. They need not be one-to-one. One action can require separate attempt and outcome records, while one native transaction can contain several statements without a record per statement. Candidate families such as opening, intent revision, assessment, decision, attempt, outcome and conclusion guide design; they are not a frozen universal opcode list. Each supported profile selects closed schemas and precise semantics with its consumer. Unknown semantics cannot count as understood success or permission.

### Workflows outside the Change primitive set

A Stage is not a universal Change primitive, required field or required context on every operation. Workflows and their stages are reusable procedures outside the intrinsic Change model. A user, application, harness or agent may propose their definitions; authorship is not authority to adopt them. Preserve exact policy/workflow references wherever needed to explain a consequential operation, without embedding an entire workflow or recording every private UI step. Such provenance is not a portable stage-ready permission flag.

Workflow definitions must not depend on stage folders in the Change ledger, and file placement or movement cannot manufacture approval, weaken obligations or trigger execution. Definitions, adoption and optional workflow participation need their own supported contracts; no generic workflow designer, arbitrary-code registry or scheduler is implied.

### Assessment responsibilities

The engine enforces authority, exact subject/version bindings, valid typed transitions, retained evidence and honest uncertainty. Selected Kernel and resource policies supply quality criteria and goal-specific passing conditions. Comparative value, feasibility judgments and engineering rigor may be useful defaults; they are not a universal release-owned verdict on which goals deserve pursuit.

Checks are read-only assessments. Only the authorized backend admits progression and records authoritative outcomes. The [Checks contract](../system/components/checks.md) distinguishes completed true/false assessments from unavailable, canceled or failed evaluation. Planning and formal review are optional unless applicable policy requires them; knowing the concrete operation, scope, preconditions and supported outcome/recovery limits before effects is not optional.

### Change granularity and native actions

A Change preserves one coherent accountable pursuit, not every file or incidental tool call. It can encompass database operations, API invocations, tool-mediated work, file/document edits and manual contributions within its fixed Workspace and declared scope. Native applications retain their State, permissions, transaction semantics and business rules. A tool name or generic command string does not establish a qualified operation; a binding must expose its actual authority, input/subject, concurrency, result and recovery contract.

A person's or agent's completion report remains an attributable claim unless the promised observation/evidence establishes more. External activity can be reconciled with honest provenance, not invented prior authorization. Retain consequential commitments, attempts and outcomes at their authority/recovery boundaries, with larger evidence referenced under retention/disclosure rules. Sharing one Change ID supplies neither a distributed transaction nor global rollback or exactly-once execution. Cross-Workspace work uses explicit coordination or linked Changes, not silently broadened scope.

Ordinary typed input needs no natural-language routing. Later semantic routing may propose a query, clarification or Change, but cannot turn a read into an authorized effect or replace the owner's commitments.

### Completion and other conclusions

Completion is an explicit accepted conclusion against an exact intent revision, applicable completion conditions and supporting outcomes/evidence, with the responsible actor and limits retained. Success of an operation, a worker exit or exhaustion of a task list does not itself complete the pursuit. Required unresolved outcomes cannot silently become success. Conditions may permit an authorized human acceptance or require stronger observations; human acceptance does not masquerade as independent verification or waive native/resource obligations.

Distinguish fulfillment from stopping, declining or superseding a pursuit. Their final record names are not selected here. Withdrawal neither undoes effects nor erases unresolved attempts. Narrowing intent requires an attributable revision rather than retrospective proof of the original goal. Completion concerns the supported subjects/versions and evidence, not a promise that native reality will remain unchanged forever. Applicable policy determines required assessment, not a universal final Review stage. [Storage restoration](../system/components/state.md#ledger-working-set-archive-and-restore) is separate from both conclusion and authorized continuation.

## Work coordination

The first path has one operation and one durable attempt at a time. Work preserves inputs, authority, attempt identity, results and unresolved outcomes across process loss. A worker exit is not completion, and a retry is not a new opportunity to bypass an unresolved effect.

Future parallel Work requires independently admissible scopes, explicit dependencies, conflict rules and aggregate outcome review. The engine owns dispatch/continuation semantics; a harness owns its session mechanics. Do not build a universal task scheduler before a concrete multi-Work capability needs it.

## Routing, borrowing and forks

These are intended later collaboration capabilities, not initial delivery dependencies. Borrowing transfers an individual Change's active continuation, not its ownership or native permissions. The recipient establishes current admission under its applicable Kernel. Returning a result requires attributable provenance and current acceptance; it does not merge arbitrary authoritative logs.

The Rust borrowing analogy distinguishes inspection of an exact version from exclusive active continuation of an individual Change. A read snapshot is not a competing writer. Allowing readers of an immutable accepted prefix while a writer extends it is versioned-snapshot behavior, not an automatic consequence of Rust's same-value borrowing rules. Its actual custody, concurrency and interrupted-transfer protocol needs separate evidence; the first single-user file witness does not implement multi-user lending.

Forking creates a new Change from an exact checkpoint for an alternative pursuit. Retained copies, encryption and file movement do not enforce single-custodian continuation, revoke plaintext or prove freshness. Their protocols must be qualified separately before use. Dependencies across Changes do not imply atomic cross-Workspace effects.

## Semantic operations and Jev

Models can help interpret requests, propose plans, assess selected semantic criteria or discover useful bindings. They remain replaceable producers/evaluators with declared inputs, outputs, cost and authority boundaries. Typed core operations must not depend on them.

When semantic judgment is needed, prefer a small constrained, JEV-like model before a general-purpose LLM. Use deterministic operations where the subject and requested operation are already explicit. Local open-weight models are candidates, not automatically qualified or assured to be faster end to end. Prefer bounded semantic ledger discovery as the first model consumer; broader reasoning or synthesis may justify an LLM, but ordinary navigation should often need none.

Jev itself is a potential integration, not a central mandatory service, frozen model choice or authority source. Select a model only against the [bounded discovery contract](../system/components/state.md#bounded-semantic-discovery) and measured total retrieval/inference/repair cost, wrong selections, missed pursuits, ambiguity and general-purpose LLM work avoided. Uncertainty does not automatically trigger a larger model: missing information, another bounded candidate page or a focused user clarification may be the correct next step. The [candidate research](../system/research.md#semantic-and-discovery-references) is separate from adoption, artifact acquisition, live inference and integration permission. No model recommendation creates an intent revision, relaxes a required Check or grants execution authority.

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

Distribute one Rust engine with library integration and a standard launcher/client path, complemented by the composable JavaScript/TypeScript SDK and optional Pi adapters. The SDK does not become another engine or make Node/Pi dependencies mandatory for direct native clients. No mandatory cloud account, Docker deployment or database service is implied. The first profile integrates with a trusted host; a standalone hardened service is a separate future deployment profile with additional evidence obligations.

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
