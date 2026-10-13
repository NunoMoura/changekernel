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

**ChangeKernel provides owner-controlled continuity of accountable Change across applications, interfaces, agents and time.** It is a redistributable State-and-Change engine whose core is the representation of Change itself: intent, lifecycle, decisions, revisions, Work, consequences and collaborative relationships. JSONL is its durable language; [format and lifecycle semantics](../system/components/change-format.md), not line framing alone, make it useful.

Ledger and Change remain the primary product primitives. Their [defining properties and accepted opportunities](change-ledger-properties.md) make user value the starting point: transferable, forkable, consolidatable and capability-decomposable pursuits, personal/shared secure coordination, evolving intent, contribution reuse and efficient agent-independent access. These are product intent, not implemented capabilities or frozen transfer protocols. A goal is the desired outcome expressed by a Change's intent, not a separate canonical object, store or lifecycle. ChangeKernel is agent-oriented but does not build another agent stack, generic scheduler, database engine or operating-system security platform. Pi supplies the initial user interaction and agent runtime; a qualified integration exposes the engine rather than replacing its authority.

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
| [Change format and lifecycle](../system/components/change-format.md) | Successor-format requirements: milestones, Work, prioritization, revision, composition and lossless navigation; no new frozen wire schema. |
| [Composable SDK](../system/components/sdk.md) | Shared JavaScript/TypeScript access to supported Rust contracts for Pi tools, interfaces and deterministic clients; downstream of format design. |
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

Engine qualification starts with a **trusted-host, single-user profile with one binding and one bounded typed operation**. Its useful witness is an intent-bearing transition that can be inspected, refused when unauthorized or stale, executed through the native binding, reconciled after interruption and reopened without repeating effects. That deterministic foundation needs no agent, model, custom evaluator runtime or rich console. The [initial user distribution](../system/components/package.md#user-distribution-and-deployment) adds a qualified Pi integration; selecting that audience does not expand the foundation's guarantees.

The host supplies authenticated identity and a supported native operation context independently of request payloads. It must enforce its declared access/custody boundary. Input remains untrusted; host compromise and hostile processes sharing the host's storage/execution authority are outside this initial profile. Do not market this as protection against them. A standalone adversarial-client host, including faithful original calling-thread admission, is a **deferred stronger profile**, not a prerequisite and not satisfied by the narrower one.

This scope change does not relax existing frozen native APIs, authorize a privileged fallback, or qualify any installed host. [Phase-specific evidence](plan.md) must precede the corresponding capability claim. The initial engine release is distinct from a later autonomous self-development release.

## Ownership model and responsibilities

**Users participate in Workspaces. Their Kernels govern Changes to those Workspaces. State represents a Workspace at particular versions and scope.**

| Concept | Meaning |
| --- | --- |
| Workspace | The persistent, identified subject with explicit resource boundaries and established authorities. Use `workspace_id` in the new contracts. It is not a mandatory process, database or directory. |
| State | Native reality within declared scope, represented by version-/time-bound observations. It is not a separately managed State object, store or lifecycle; retained observations are evidence, not necessarily complete snapshots. |
| Change | One owner-controlled, accountable pursuit whose understanding can evolve, preserving original intent, adopted revisions and actual outcomes separately. A proposal is already a Change. |
| Ledger | An owned collection and coordination/disclosure context for Changes, with explicit identity and authorized navigation. It is independent of application hosting and is not a second copy of Change lifecycle history. |
| Kernel | A user's versioned governance policy and selected requirements/Checks. It may adopt a workflow; it is neither a universal stage sequence nor the engine implementation. |
| Work | An attributable, schedulable unit within one Change. The first effect path needs one precisely specified operation, not a separate planning ceremony or generalized scheduler. |

Each Change has one originating owner and one fixed Workspace under the retained contracts. Contributions remain attributable to their actual actors; borrowing cannot rewrite earlier attribution. Original intent is not overwritten to fit eventual delivery. Owning a Change never grants rights over its target resources. Broader ownership, scope and continuation semantics need explicit successor contracts rather than reinterpretation of the fixed-owner fixtures.

### Personal-first, app-independent Ledgers

Personal pursuits belong in personal Ledgers; bands, teams and organizations may own shared Ledgers. Shared Ledgers are not unrestricted unions of members' personal histories. A personal View may reference an authorized shared Change without acquiring ownership or creating an independently writable copy. An application does not own an entire pursuit merely because its interface received the original request.

Separate **ownership** of commitments and decisions, **hosting** of records and **custody** of supported continuation/acceptance. Local storage is the default deployment direction, not the definition of ownership. Moving or sharing records transfers none of those responsibilities or native permissions automatically. Personal control does not grant blanket rights to export employer documents, collaborator material or licensed artifacts. Selective disclosure, evidence retention and any ownership transfer need precise supported contracts.

A Ledger may coordinate pursuits over different application surfaces. An app boundary need not be a Change boundary: one supported Workspace can name several resources and authorities. Where one supported scope cannot cover the pursuit, use explicitly linked Changes; app independence never authorizes scope widening. App-native agents can contribute proposals or observations, not declare the user's adoption or gain access to unrelated Ledger material.

### User-owned continuity and transferability

User ownership is a product capability, not merely an author label. A Change belongs to an accountable owner rather than to the application, repository, harness or conversation through which it was expressed. Within established authority, the owner controls adoption and revision of intent, bounded delegation, disclosure, supported continuation and conclusions. These decisions and their grounds must remain understandable when the application or agent session changes; hosting records does not make the host their owner.

The successor design must make owner-directed sharing, delegation, continuation handoff and ownership transfer expressible as distinct relationships and decisions. Sharing changes disclosure; delegation changes bounded acting authority; handoff changes continuation custody; ownership transfer changes who may govern the pursuit within the supported scope. A fork creates a separate pursuit. None is accomplished merely by copying files, changing a Git author, restoring a conversation or relabeling an owner field.

A supported ownership transfer must preserve Change identity, originating ownership and historical attribution while explicitly establishing the new governing owner, accepted responsibilities and the treatment of prior delegation/custody. Existing effects, required constraints and unresolved outcomes remain visible and consequential; transfer cannot erase them or create two competing authorities. The exact party agreement, exclusion, disclosure, interruption and recovery protocol remains to be selected. This requirement neither adds transfer to retained fixed-owner profiles nor grants native resource rights, credentials, intellectual-property rights or permission to disclose third-party material.

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

The [Change representation and composition rules](../system/components/change-format.md) are the primary design artifact. The [code-use integration contract](../system/components/sdk.md) follows those contracts and actual native guarantees: JavaScript/Python-friendly surfaces and thin harness-specific bridges, with an SDK where useful rather than a mandatory package or CLI-first interface. Start with Pi, then investigate Codex, Claude Code and DeepSeek Harness against their actual execution environments. Consumers also include Ledger interfaces, deterministic automation and optional application integrations. Users install a product integration, not an SDK. Applications can expose existing APIs without adopting ChangeKernel; app embedding is an integration mode, not the ownership model.

A read-only navigator remains useful but is not a separate backend or the primary design sequence. Client composition adds no native operations or authority. Rust retains validation, acceptance, authorization, custody and recovery responsibility. No Pi session, model call or generic State subsystem is required for deterministic engine access; direct Rust clients remain independent of the language clients. Exact signatures, host lifetime, transport and each harness's supported subset remain unselected. Existing formats and operations stay frozen; successor semantics require their own adoption.

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

Design the **owner-controlled Ledger and Change language** before SDK APIs or agent orchestration. The [format-first plan](plan.md#format-first-design-and-pi-first-delivery) derives lifecycle and composition rules from worked examples; the [foundation gate](plan.md#foundations-before-agent-integration) still requires a useful deterministic engine and bounded navigation before a product integration can claim support.

Each Change has one authoritative JSONL Trace with typed records, one per line. A complete Change spans records, not one mutable snapshot. The Ledger is an owned collection and coordination context, not a second history of each Change or an automatically shared Workspace folder. Its logical identity must not depend on a Pi conversation, visited application or current project directory. Physical storage is selected explicitly; directory layout and transport establish neither ownership nor cross-file atomicity.

The successor Ledger, Change and operation records are compact structured accountability data, not prose or artifact containers. Preserve user-decided intent and consequential facts through typed records and exact references; keep source expressions, supporting acceptance passages, narrative plans, documents, code and detailed evidence outside those records. The structure plus resolvable required material must provide sufficient pursuit context for a fresh authorized consumer within declared coverage, without replaying the originating session. Different models, harnesses and applications may use that context differently; ChangeKernel does not prescribe one assistant's reasoning or replace the user's decisions with its own. The [reference-based context requirements](change-ledger-properties.md#reference-based-pursuit-context) refine ownership and code-use efficiency without claiming measured performance or selecting a new storage service.

The [successor-format requirements](../system/components/change-format.md) now make lifecycle, revision, collaboration and prioritization the design focus. This does not change existing ledger/Change layouts, closed schemas, accepted records or supported operation meanings. New records, ownership semantics or migration require an explicitly adopted successor; Pi integration alone introduces none. Reuse compatible runtime facilities, but keep Pi conversations, task checkpoints and runtime storage separate from authoritative Change history.

The primary navigation model is **origin + accepted tip + navigable middle**. Origin preserves the pursuit's original intent; the tip identifies the latest accepted operation; a reader's cursor selects the point being inspected. Moving the cursor neither changes the accepted tip nor grants active continuation. Stable operation identities/references are distinct from physical byte offsets. Timelines, current lifecycle Views and contextual projections are different consumers of the same accepted records.

**Change context is an authorized, purpose-specific View of a particular Change version and its referenced grounds.** The Trace anchors it; a versioned projector assembles it for purposes such as understanding, planning, assessment, execution or continuation, not for mandatory public stages. Native State remains native, and externally referenced evidence retains its own version, custody, disclosure and retention requirements. Context identifies the selected prefix, projection interpretation, coverage and gaps; exact reproduction requires the relevant original inputs to remain available. Apply the [minimal lossless core criterion](change-ledger-properties.md#minimal-lossless-core-derived-views): retain only the essential facts and references preserving intent and its accountable evolution; all exactly reconstructible representations are derived Views for agents or direct UI consumption. A model summary can be a derived convenience, not replacement authority for intent, decisions, results or missing evidence. File content does not become executable policy or grant native permissions.

This gives a fresh person, deterministic executor or later agent continuity without making a conversation the Change's memory store. Rebuildable indexes and projection caches may accelerate access when justified by measured workloads; they do not replace accepted Traces or the distinct non-rebuildable acceptance controls. The [State contract](../system/components/state.md#structured-history-access-and-context-projections) defines the corresponding read and projection obligations. Both Change and ledger navigation retain deterministic lookup, authorized listing and bounded retrieval. [Semantic discovery](../system/components/state.md#bounded-semantic-discovery) assists when the user cannot name the desired subject; it is not a prerequisite for navigating known references or a source of continuation authority.

## Intent and lifecycle

The [default lifecycle](../system/components/change-format.md#lifecycle-milestones-and-execution-admission) distinguishes **proposed → decided → planned → executing → assessed/reviewed → concluded** as semantic milestones. It is not a universal Stage field, fixed tool-call sequence or requirement for a separate artifact per milestone. A proposal can be declined without execution; a direct authorized request can establish intent, adoption and its minimal operation specification in one interaction.

Decision to pursue is not approval of every possible plan. Execution admission binds current authority, scope, applicable intent/plan versions, required Checks and native preconditions. A prior bounded delegation may suffice; otherwise further adoption is required. Planning, execution and assessment can repeat or overlap across different Work. Revisions preserve earlier decisions and effects and require reassessment of affected future admission. Formal independent review is required where policy promises it; evidence for a success claim is never replaced by a completed-stage label.

### Intent capture and refinement

Capture What and the supplied Why without inventing missing intent. Natural language remains valid source content, not an inline payload in successor canonical records; preserve its exact meaning and provenance as referenced material rather than requiring a lossy formalization. Later profiles may also consume typed desired conditions or identified source material under explicit contracts. Keep supplied content separate from derived summaries or proposed formalizations. Adopted clarification, scope, constraints or success conditions become attributable revisions; they do not silently replace the original. The consumed opening profile remains exact UTF-8 What plus nullable Why; this successor direction changes neither its fields nor its accepted bytes.

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

Checks are read-only assessments. Only the authorized backend admits progression and records authoritative outcomes. The [Checks contract](../system/components/checks.md) distinguishes completed true/false assessments from unavailable, canceled or failed evaluation. Separate planning and formal-review ceremonies are optional unless applicable policy requires them; knowing the concrete operation, scope, preconditions and supported outcome/recovery limits before effects, and supporting claimed outcomes with evidence, are not optional.

### Change granularity and native actions

A Change preserves one coherent accountable pursuit, not every file or incidental tool call. It can encompass database operations, API invocations, tool-mediated work, file/document edits and manual contributions within its fixed Workspace and declared scope. Native applications retain their State, permissions, transaction semantics and business rules. A tool name or generic command string does not establish a qualified operation; a binding must expose its actual authority, input/subject, concurrency, result and recovery contract.

A person's or agent's completion report remains an attributable claim unless the promised observation/evidence establishes more. External activity can be reconciled with honest provenance, not invented prior authorization. Retain consequential commitments, attempts and outcomes at their authority/recovery boundaries; successor prose and artifact payloads are referenced under retention/disclosure rules, not embedded according to a size threshold. Sharing one Change ID supplies neither a distributed transaction nor global rollback or exactly-once execution. Cross-Workspace work uses explicit coordination or linked Changes, not silently broadened scope.

Ordinary typed input needs no natural-language routing, and ordinary queries need not create Changes. Optional interpretation may propose a query, clarification or Change, but cannot turn a read into an authorized effect, invent arbitrary arguments or replace the owner's commitments. Unknown requests clarify, report unsupported capability or decline rather than force dispatch.

### Completion and other conclusions

Completion is an explicit accepted conclusion against an exact intent revision, applicable completion conditions and supporting outcomes/evidence, with the responsible actor and limits retained. Success of an operation, a worker exit or exhaustion of a task list does not itself complete the pursuit. Required unresolved outcomes cannot silently become success. Conditions may permit an authorized human acceptance or require stronger observations; human acceptance does not masquerade as independent verification or waive native/resource obligations.

Distinguish fulfillment from stopping, declining or superseding a pursuit. Their final record names are not selected here. Withdrawal neither undoes effects nor erases unresolved attempts. Narrowing intent requires an attributable revision rather than retrospective proof of the original goal. Completion concerns the supported subjects/versions and evidence, not a promise that native reality will remain unchanged forever. Applicable policy determines required assessment, not a universal final Review stage. [Storage restoration](../system/components/state.md#ledger-working-set-archive-and-restore) is separate from both conclusion and authorized continuation.

## Work coordination

A Change can contain one immediate operation or months of coordinated Work without requiring a continuously running agent. Work is an attributable, schedulable unit within the pursuit. Dependencies identify required results and evidence, not worker exit status. Make a portion a related Change when it becomes independently accountable, not merely because it takes time, uses several APIs or has a different executor. The [coordination rules](../system/components/change-format.md#work-granularity-and-coordination) retain the exact granularity and failure boundaries.

The first path still has one operation and one durable attempt at a time. Parallel Work needs independently admissible scopes, dependencies, conflict rules and aggregate outcome review. Calls sharing a custody-bearing native owner, including reads, remain serialized under its contract. Reuse execution/queue mechanics; ChangeKernel owns eligibility, continuation and outcome semantics, not a new general-purpose scheduler.

### Ledger working set and priority

[Historical order, priority order and execution order](../system/components/change-format.md#ledger-working-set-and-prioritization) are distinct. Prefer a bounded, explicitly ordered active set rather than opaque scores or ranking every retained Change; no numerical cap is selected. Retain adopted selection/reprioritization decisions and their grounds without rewriting history. Priority is contextual, not a universally portable property of a Change. Deadlines, constraints, commitments and unknown effects survive lower rank, suspension and archive. The record/storage and concurrent-reordering contracts remain open.

## Routing, borrowing and forks

[Collaboration rules](../system/components/change-format.md#collaboration-and-composition-rules) are central successor-format design requirements, not implemented operations or an obligation to ship every capability in the first release. Sharing, handoff, fork, consolidation, decomposition and contribution acceptance have distinct meanings. Borrowing transfers active continuation, not original ownership or native permissions; whole-pursuit ownership transfer needs its own contract. The recipient establishes current admission under its applicable Kernel. Returning a result requires attributable provenance and current acceptance, not merging arbitrary authoritative logs.

The Rust borrowing analogy distinguishes inspection of an exact version from exclusive active continuation of an individual Change. A read snapshot is not a competing writer. Allowing readers of an immutable accepted prefix while a writer extends it is versioned-snapshot behavior, not an automatic consequence of Rust's same-value borrowing rules. Its actual custody, concurrency and interrupted-transfer protocol needs separate evidence; the first single-user file witness does not implement multi-user lending.

Forking creates an independent Change from exact source grounds, with its own current admission. It does not restore native State to that checkpoint or replay historical effects. A handoff during execution needs a safe boundary or a specifically supported live-handoff protocol, preserving pending Work and unknown outcomes while preventing competing custodians.

Consolidation explicitly adopts selected intentions, contributions and remaining objectives into a new pursuit. A combined View is not a new commitment. Preserve source histories; do not concatenate logs, merge away failures, silently stop source execution or automatically supersede source obligations. Retained copies, encryption and file movement enforce neither exclusive continuation nor plaintext recall. These protocols require separate evidence and confer no cross-Workspace transaction.

## Semantic operations and Jev

Models can help interpret requests, propose plans, assess selected semantic criteria or discover useful bindings. They remain replaceable producers/evaluators with declared inputs, outputs, cost and authority boundaries. Typed core operations must not depend on them.

When semantic judgment is needed, prefer a small constrained, JEV-like model before a general-purpose LLM. Use deterministic operations where the subject and requested operation are already explicit. Local open-weight models are candidates, not automatically qualified or assured to be faster end to end. Bounded semantic ledger discovery is a candidate consumer, not the primary product design sequence; broader investigation or synthesis may justify an LLM, while ordinary navigation should often need none.

Jev itself is a potential integration, not a central mandatory service, frozen model choice or authority source. Its inspected API is hosted; local alternatives require their own selection, calibration and disclosure assessment. A provider-selectable interpretation boundary must ground arbitrary arguments and preserve uncertainty rather than treat typed judgments as permission. Select a model against its exact consuming contract and measured total retrieval/inference/repair cost, incorrect results, ambiguity and general-purpose LLM work avoided. The [bounded discovery contract](../system/components/state.md#bounded-semantic-discovery) adds discovery-specific questions such as wrong selections and missed pursuits; it is not a universal interpretation interface. Uncertainty does not automatically trigger a larger model: missing information, another bounded candidate page or a focused user clarification may be the correct next step. The [candidate research](../system/research.md#semantic-and-discovery-references) is separate from adoption, artifact acquisition, live inference and integration permission. No model recommendation creates an intent revision, relaxes a required Check or grants execution authority.

## Change memory and procedural State

Future learning reuses retained evidence and proposes improvements through the same Change mechanism. Distinguish original intent, accepted history, private working context, research claims and adopted procedures. A transcript is not a second lifecycle authority, and useful feedback is not automatic policy adoption.

Procedures and reusable knowledge require provenance, visibility, applicable version/scope and an explicit adoption boundary. Revocation, stale sources and contradictory evidence constrain reuse. A fresh worker can receive authorized context without inheriting authority from a previous conversation. Learning machinery is not required to demonstrate the first transition.

## Frontend guidance and responsiveness

Clients request typed operations and present compact, telegraph-style Views of intent, decisions, applicable plans, progress, blockers and unknowns, with expandable exact references. Preserve full captured intent and consequential evidence underneath. Generated interfaces are clients/Views of the same contract; regenerating a screen cannot change what was approved. Progress feedback cannot precede acceptance, and read-only inspection does not trigger execution.

Reason against current, applicable, authorized commitments rather than every historical intention. Preferences guide choices; adopted constraints bound them. Explain expected contribution, conflicts, assumptions and evidence before consequential work where needed, and retain actual outcomes separately. Missing context is not evidence of consistency with the entire Ledger. Responsiveness avoids unnecessary inference and proxy hops but does not bypass required validation/persistence or promise zero overhead.

## Operator console for development

The initial user surface is a [qualified Pi integration](../system/components/package.md#user-distribution-and-deployment) for existing Pi users: conversation, tools, commands and structured Change/Ledger Views. Reuse Pi's interaction/runtime facilities rather than build a new Rust terminal console or agent stack first. This is a selected delivery direction, not shipped integration. Pi remains separate from lifecycle authority and is not required for deterministic native engine access. A later standalone client or launcher needs a concrete audience and justification.

## Cross-workspace development

An application-use Change may expose a need for authorized development in another Workspace. Preserve the unmet requirement in an explicitly shared capability request linked to the origin. Developers may adopt separate development Changes and consolidate compatible requests with selected authorized context. Shipping support enables continuation, not automatic completion of the originating pursuit.

Missing tool registration, permission denial and temporary failure do not prove missing functionality. User intent to improve an application does not itself authorize source edits or deployment. Cross-Workspace coordination retains explicit actors, native rights and contribution acceptance; it is never an implicit global transaction.

## Hosting, distribution and evolution

The [selected initial distribution](../system/components/package.md#user-distribution-and-deployment) is an installable Pi integration for existing Pi users, with a qualified Rust engine, matching SDK/native bridge, tools/commands/Views and explicitly supported connectors. End users install a product integration, not an SDK. This is not yet a standalone general-consumer application or a qualified package.

Deployment is local-first: an engine on the user's device and explicitly selected owner-controlled Ledger storage independent of applications, project directories and Pi sessions. Credentials stay separate from portable records; multiple clients use supported custody coordination. Local-first does not imply local inference. Later packaged clients, hosted/self-hosted deployments and multi-device support require their own evidence; do not build every channel at once. Native clients remain independent of Node/Pi, and no mandatory cloud account, Docker deployment or database service follows from this direction.

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

The [ChangeKernel plan](plan.md#format-first-design-and-pi-first-delivery) owns design and capability dependencies. First develop the successor-format specification from a trivial Change and an extended family exercising revisions, parallel Work, failures, uncertain outcomes, priorities and collaboration. The [open contract list](../system/components/change-format.md#successor-specification-work) separates adopted meaning from unselected grammar and guarantees. Existing bounded profiles remain evidence, not a reason to skip this design or a claim to implement it. Implementation slices later consume precise producers, results and failure boundaries; documentation does not resume paused work.

### First dogfood delivery sequence

A useful core engine release comes before autonomous self-development. The [later self-development gate](../system/components/package.md#first-self-development-delivery-focus) remains distinct: it needs qualified execution/publication, actual workflow evidence and an immutable external controller with explicit handoff. Documentation approval, release activation or a working core fixture alone does not supply that authority.
