---
title: Change Format and Lifecycle
aliases:
  - Collaborative Change Semantics
source-id: cw:component:change-format
---
# Change Format and Lifecycle

## Adoption and compatibility boundary

**This is adopted desired-state design, not a frozen wire schema, implemented capability or migration instruction.** The product's core is the representation of Change and the lifecycle, revision, composition and navigation semantics that make it usable across people, agents, applications and time. JSONL is the encoding; its line framing alone establishes neither acceptance nor collaborative behavior.

The [product](../../product/changekernel.md) owns positioning, ownership and authority boundaries. This page owns the successor-format design requirements. The [State contract](state.md) owns native evidence, acceptance and recovery obligations; the [plan](../../product/plan.md#format-first-design-and-pi-first-delivery) orders design and qualification dependencies. Execution permission remains in the [temporary status note](../../../../../CHANGEKERNEL_STATUS.md).

Existing accepted records, ledger/Change layouts, closed inventories, schemas, operation versions, ownership, bounds, accounting and retry/recovery meanings remain unchanged. These requirements do not inject new fields into the retained profiles, repurpose their custody controls, reinterpret historical stages or add a new operation merely because its meaning is described here. New semantics require an explicitly adopted successor contract and, where needed, a separately supported migration. Documentation adoption, source acceptance, release qualification, activation and controller handoff remain distinct.

Retained profile pages preserve contract-adoption evidence, including historical implementation-status labels; those labels are not a rolling executable-status verdict. Exact source/test revisions and their acceptance evidence in Git establish source acceptance. Neither a contract label nor source acceptance qualifies a release or changes the retained profile's semantics.

## Ledger and Change remain the primary primitives

The user-adopted [defining properties](../../product/change-ledger-properties.md) own the value proposition and brainstorming questions. Derive structure from owner-controlled continuity, transferable responsibility, collaborative composition and efficient agent access, not from a guessed envelope or a delivery workflow. The [initial gap research](../research/change-ledger-property-gaps.md) supports specific opportunity hypotheses and records prior art; it is not universal novelty or qualification evidence.

A **Ledger** is an owned collection and coordination/disclosure context for Changes. A **Change** is one accountable pursuit, including expressed intent, its adoption or refusal, decisions, Work and consequences. Its duration and number of operations do not determine its identity.

There is no separate canonical Goal object, Goal store or Goal lifecycle. A goal is the desired outcome expressed by a Change's intent and may be prominent in a user-facing View. Supporting concepts such as Work, plans, Checks, Workspace and State retain their distinct meanings; they are not competing pursuit histories.

Preserve original expression, adopted intent and subsequent revisions separately from actual delivery. Topic similarity does not establish pursuit identity. The owner or a currently authorized delegate adopts whether clarification continues the same pursuit or warrants a related replacement. A model may recommend that distinction, not silently decide it.

One Change has one authoritative history. Referencing it from several authorized contexts does not create several independently writable copies. Dependencies and contributions form explicit relationships, not a mandatory directory tree. Consequential assertions are durable; reverse links and navigation indexes can be derived.

## Canonical records, evidence and Views

A complete Change spans **typed JSONL records, one record per line**. It is neither one giant mutable snapshot nor a transcript of every agent utterance. The successor Ledger, Change and operation records contain compact typed facts and exact references, **not embedded prose or artifact payloads**. The exact record catalogue, envelope, reference encoding and atomic acceptance boundaries remain to be selected with worked consumers; retained profiles are unchanged.

| Layer | Meaning |
| --- | --- |
| Canonical records | Typed identities, relationships and consequential facts establishing attributable adoption/decisions, revisions, exact Work/operation grounds, attempts, errors, outcomes, uncertainty and conclusions. Prose and artifact payloads are references only. |
| Referenced material | Exact intent expressions and supporting acceptance passages, narrative plans/explanations, observations, artifacts and detailed inputs/outputs with identity, interpretation, coverage, availability and retention/disclosure obligations. These are supporting grounds, not a second writable adoption history. |
| Derived Views | Bounded structured selections of applicable intent/decision relationships, plan references, priorities, progress, blockers, unresolved outcomes and expandable source references. Consumers may render explanations without making those explanations canonical records. |

Record selection should maximize signal, not record every incidental tool event, exploratory recommendation or private thought. The no-inline-payload boundary applies regardless of payload size; it is not merely a rule to move large artifacts elsewhere. Reference the exact supplied meaning rather than replacing it with lossy shorthand. References are not permission to discard required originals, and a content digest alone establishes neither authenticity nor continued availability.

The accepted structure and required referenced material must together supply sufficient pursuit context for a fresh authorized consumer within declared coverage. No originating session replay or unrecorded harness-private state may be necessary to reconstruct the retained intent, decisions and continuation grounds. This does not mean placing all payloads in the core, loading all of them on each read, observing every external fact or carrying current native execution rights.

References must preserve their semantic role and exact subject/version or source passage where applicable, permit authorized resolution and bounded expansion through supported contracts, and expose unavailable, stale, undisclosed, mismatched or unsupported grounds explicitly. A mutable URL, opaque hash or session filename alone is not sufficient continuation context. Retain the necessary acceptance context when a short source expression such as “yes” depends on a referenced proposal. Required material cannot silently depend on a disposable private session or cache for its only surviving copy. Exact resolution, fragment, storage and retention mechanisms remain successor design work, not selected APIs or a new general-purpose content service.

**Lossless means preserving the exact captured data and its meaning within a declared capture boundary.** It does not mean observing all external activity or retaining every confidential input in every shared copy. Reported, observed and governed activity remain distinguishable. Excluded, missing or unavailable material must not silently appear as complete coverage. Referenced payloads and private runtime transcripts have their own retention and disclosure rules; the latter are not the canonical continuation record.

An accepted operation may need separate attempt and outcome records. A native transaction may perform several statements without one lifecycle record per statement. A UI interaction may establish several semantic milestones without a record per screen. The consumed contract, not the newline or a status label, establishes the acceptance unit.

Only the authorized backend constructs accepted records from validated operations and independently established attribution, authority and evidence. Agents request supported operations; arbitrary JSONL append, caller-supplied approval or a passing flag cannot manufacture acceptance. Reading or replaying history reconstructs Views, never effects.

Borrow [Pi's history/context separation](../research.md#pi-110-session-format-follow-up), not its conversation-specific acceptance behavior. Compaction and summaries may improve context; they cannot replace authoritative records. Conversational branching, permissive loading and automatic rewrites are not Change repair, rollback or migration protocols.

## Lifecycle milestones and execution admission

The default lifecycle is described by the following semantic milestones. These labels are not frozen wire enums, a universal Stage primitive or a requirement for separate artifacts or tool calls.

| Milestone | Required meaning |
| --- | --- |
| Proposed | Capture expressed intent and its grounds without implying adoption or execution authority. A declined or withdrawn proposal is still a Change. |
| Decided | An authorized owner or delegate adopts the pursuit, scope, constraints and completion conditions, or declines it. |
| Planned | The next Work has sufficiently precise inputs, operations, dependencies, applicable Checks, expected evidence and supported outcome/recovery behavior. |
| Executing | Admitted Work runs; attempted operations, established effects and uncertain outcomes remain distinct. |
| Assessed / reviewed | Evaluate results against exact adopted intent and requirements. Perform separate human or independent review where applicable policy requires it. |
| Concluded | Record an explicit conclusion with its grounds, attribution, scope and unresolved outcomes. Fulfillment, stopping, declining and supersession have different meanings. |

**Decision to pursue is not approval of every possible plan.** Before Work executes, admission establishes the applicable intent and adopted plan/Work versions, current authority and delegated scope, required Checks and native preconditions. A prior decision can contain sufficient bounded delegation; otherwise further adoption is required. A successful Check does not itself establish adoption or override native denial.

A trivial Change may establish intent, decision and its minimal operation specification in one interaction. It needs no planning agent, queue or redundant confirmation dialog. A separate planning ceremony is optional; an adequately specified operation before effects is not. A formal Review ceremony can be optional; evidence supporting a success claim cannot be optional. The [Checks contract](checks.md) preserves distinct assessment questions, human decisions and operational failures.

Long-running Changes can repeat planning, execution, assessment and revision. Different Work units may be at different points simultaneously; the entire pursuit need not have a complete months-long plan before the next bounded unit is admitted. The current phase is a projection of accepted facts, not a mutable field capable of manufacturing approval.

Revisions preserve previous decisions and their exact grounds. Reassess affected future admission and handle affected in-flight Work explicitly; do not pretend previous effects disappeared. A result about an older intent or plan cannot silently certify a later one. Paused or blocked conditions can occur during several phases, and a failed attempt need not conclude the pursuit.

Completion requires an explicit accepted conclusion against the applicable intent and completion conditions. A successful API reply, worker exit, task count or Codemode invocation is not by itself fulfillment. Cancellation does not reverse completed effects, and required unresolved outcomes cannot become success. Applicable obligations, constraints and unresolved effects survive suspension, archive and changes to the working set; retaining old intent does not make every historical preference a current commitment.

## Work, granularity and coordination

Work is an attributable, schedulable unit within one Change, not another top-level pursuit primitive. The same model covers one immediate operation, dependent operations and months of parallel work, waiting and revision. A durable Change does not require a continuously running agent or one permanent conversation.

Dependencies name required results or conditions and exact adequate grounds, not merely a producer's completed label. A received contribution still needs applicable acceptance. Shared resources need native concurrency guards even when no dependency or conflict was declared in the Ledger.

Make a portion a separately identified, related Change when it becomes independently accountable: independently adoptable, rejectable, scoped, transferable, continuable or concluded. Elapsed time, a different worker or several API calls alone do not justify another Change. Decomposition is an adopted decision, not an implicit authorization to broaden scope or evade cumulative obligations.

Independent Work may proceed concurrently only where the supported host/resource contracts permit it. Maintain one active continuation custodian per Change and the selected native-owner rules. Calls sharing a custody-bearing native owner remain serialized, **including reads**. More workers do not create competing accepted histories or bypass custody by opening a fresh owner per call.

ChangeKernel owns eligibility, dependency, continuation and outcome semantics. Reuse suitable execution/queue mechanisms rather than build a new general-purpose scheduler. Queue state and private runtime checkpoints are execution bookkeeping, not lifecycle authority. Partial failure does not automatically invalidate independent successful work; original operation identities and supported reconciliation remain necessary after interruption.

## Ledger working set and prioritization

| Order | Meaning |
| --- | --- |
| Historical order | The order of accepted records; preference changes do not rearrange it. |
| Priority order | The owner's current allocation preference in a defined planning context. |
| Execution order | The order permitted by readiness, dependencies, current authority, native guards and available resources. |

Prefer a **small, explicitly ordered active set** over opaque scores or a mandatory total ranking of every retained Change. Bound active count and granularity without selecting a numerical cap here. A high-priority blocked Change can wait while eligible lower-priority Work proceeds; priority does not force serial execution.

Priority belongs to the Ledger's planning context, not to Change as an intrinsic globally portable property. A person's authorized View may prioritize a shared Change differently from the owning organization's adopted allocation. That personal choice neither acquires ownership nor overwrites the organization's decisions. A reference is not a second canonical membership or history.

Retain attributable decisions about active selection and consequential reprioritization, including revisions and grounds. Agent recommendations require adoption by an authorized actor or bounded delegation. Concurrent reordering must not silently overwrite an accepted decision; significant intent revision may invalidate earlier priority grounds. Exact request, record and conflict-resolution forms remain open.

Reordering changes future allocation, not the fact of running or completed work. Deadlines, commitments, mandatory constraints and unresolved effects remain distinct from rank. Handoff and fork do not automatically inherit the recipient's queue position; consolidation needs an explicit priority decision rather than an average of source ranks.

These are **Ledger-level coordination facts**, not another history of each Change's lifecycle. Active lists and sorted Views derive from accepted grounds, not from file order, creation time or model summaries. Placement and custody controls in the existing profiles cannot be repurposed as priority storage. The successor must specify where these decisions live and how they are accepted without a competing source of truth.

## Collaboration and composition rules

| Operation | Preserved grounds and changed meaning |
| --- | --- |
| Share | Disclose authorized individual material and necessary grounds with exact origin, coverage and omissions. Sharing does not confer continuation, native access or ownership. |
| Handoff / borrow | Preserve Change identity, original ownership, history and attribution while explicitly transferring supported continuation responsibility. The recipient establishes current admission. |
| Ownership transfer | Under a separately supported successor protocol, preserve pursuit identity, origin and history while explicitly changing governing ownership and accepted responsibilities. This is not disclosure, delegation or custody handoff; the exact protocol remains open. |
| Fork | Create a new independent pursuit from exact source grounds. Source decisions are evidence, not automatic permission for the fork. |
| Consolidate | Explicitly adopt selected intentions, contributions and remaining objectives into a new pursuit with its own scope, decisions, priority and applicable Checks. |
| Accept a contribution | Evaluate the exact received result against the recipient's requirements before adopting it; the producer's completion label is insufficient. |
| Decompose | Identify independently accountable portions as related Changes while retaining their origins, obligations and acceptance boundaries. |
| Reuse | Use prior plans, decisions and results as grounded material for new work; completed effects are not instructions to replay. |

### Handoff during execution

Retain exact intent/plan versions, decisions and Checks, completed contributions, pending Work, unresolved effects and the continuation boundary. Prevent competing execution custodians. Use a safe handoff point or a separately supported live-handoff protocol; copying a file is neither. Unknown outcomes travel as unknowns and continue to block unsafe repetition. Recipient capability or permission differences may require refusal, replanning or a linked successor rather than assumed continuation.

Ownership transfer is distinct from active custody handoff and remains an unresolved contract. No existing fixed-owner or fixed-Workspace profile gains that operation through this description. Credentials and native resource rights do not travel with portable records, and disclosure cannot recall plaintext already received.

### Fork after effects

Fork the future pursuit, not native reality. An exact historical checkpoint identifies source grounds but does not restore the application to that earlier State. Preserve established effects and relevant unknowns, obtain current observations where the new operation requires them, and establish the fork's own admission. Fork lineage does not itself imply a dependency, transaction or rollback.

### Consolidation versus combined Views

A combined View changes presentation without creating a new commitment. A consolidated pursuit requires explicit adoption; topic similarity does not prove equivalent intent. Individually acceptable plans can conflict when combined.

Source histories remain intact. Consolidation does not concatenate authoritative logs, merge away failures, stop source execution silently or automatically supersede source commitments. After effects, consolidate retained evidence and remaining objectives, not a fictional single execution history. Cross-Workspace work continues through explicit supported coordination, never widened authority by association.

### Capability escalation

An unsupported pursuit may produce an explicitly shared capability request linked to its originating Change. Share only selected authorized context. Developers can adopt separate development Changes and explicitly consolidate compatible requests; they do not acquire the originator's whole Ledger. Shipping support enables continuation, not automatic fulfillment of the originating pursuit. Missing tool registration, permission denial and temporary failure are not proof of missing product functionality.

## Agent reading, navigation and interaction

Agents should navigate current intent and applicable plans, compare revisions, expand claims into exact records/evidence, follow dependencies and contributions, find unresolved outcomes and propose the next supported operation. They should not reconstruct authority from prose scattered across a transcript.

Ledger queries must also provide the structured facts and referenced grounds an agent needs to deliberate about whether a proposed new Change or a revision makes sense against existing applicable intent, before adoption. Different models, harnesses and applications may help and reason differently; ChangeKernel preserves decided intent and accountable operations rather than prescribing that reasoning. The [product direction and fine-tuning questions](../../product/change-ledger-properties.md#ledger-supported-deliberation--direction-to-fine-tune) are consumer questions, not an engine-owned verdict or frozen assessment taxonomy. Expose exact grounds and coverage without treating a recommendation as adoption, a read as a write, or favorability as execution permission. No matching algorithm, mandatory whole-Ledger scan, query signature or automatic decision policy is selected.

Use exact logical identities and references rather than local paths or conversation names as the sole identity. Retain origin, accepted tip and historical cursor as distinct concepts under the [read contract](state.md#structured-history-access-and-context-projections). Navigation is authorized and bounded, exposes coverage and unavailable grounds, and neither moves the accepted tip nor grants future execution permission. Live pagination is not an atomic snapshot.

Agent-facing retrieval exposes high-signal structured Views with expandable references and explicit qualifications. Applications may render prose explanations, but those are not canonical Ledger/Change/operation payloads. Preserve full captured intent, exact inputs and consequential evidence as referenced material. Human, deterministic and agent readers consume the same accepted-fact semantics; no particular model or private conversation is required to establish the retained decisions.

Reason against **current, applicable, authorized commitments**, not a literal sum of every past intention. Preferences guide choices; explicitly adopted constraints bound them. New requests do not silently erase prior consequences, and old preferences are not invisible permanent vetoes. Missing context is not evidence of consistency with the entire Ledger. Keep contribution, conflicts, mandatory constraints and unknowns distinct rather than hide them in one alignment score.

Explanations should precede consequential work where needed and name relevant intent versions, decisions, expected contribution, assumptions, conflicts and evidence. Preserve actual outcomes separately instead of constructing only a post-hoc success narrative. Interpretations and confidence never replace adoption, authority or required Checks.

Structured commands bypass unnecessary inference. Ordinary queries need not create Changes. Ambiguous language may use selectable constrained interpretation; arbitrary arguments still need grounding and validation. Open-ended investigation/composition may use Pi. Unknown requests clarify, report unsupported capability or decline instead of forcing a dispatch. No mandatory model hop, zero-overhead promise or inference-based weakening of a required guard follows from the format.

## Agent-facing structure and code use

Design the Change/Ledger representation and its programmatic access together. An agent must be able to write a bounded script that navigates, compares and composes structured data, then returns only the useful explanation to its model. It must not need to parse prose, scan Git messages or reconstruct adoption from a private conversation. Direct tools, code-use adapters and model-free clients consume the same supported semantics; Pi Codemode is an initial consumer, not the canonical storage or a required execution language.

The [three layers](#canonical-records-evidence-and-views) remain distinct. Accepted history preserves consequential facts; retained evidence supplies exact supporting material; compact Views expose applicable facts with expandable grounds. A View is not a separately writable current-State document or the only surviving decision evidence. Change is accountability data, not an executable script; inspection never replays effects.

| Structural responsibility | Required distinctions; exact schema remains open |
| --- | --- |
| Change identity and authority | Logical Ledger/Change association, originating ownership and historical actors; current governing ownership, delegation and continuation custody where supported. A directory, Git author or session name is insufficient. |
| Intent and decisions | Exact references distinguish original expression, proposed interpretation, adopted intent and attributable revisions. Typed decision facts distinguish accepted, refused, superseded and still-pending decisions without inferring consent from prose. |
| Work and consequences | Applicable intent/Work/policy grounds, admission, original attempts, established results, uncertainty and conclusions. Proposed actions and successful script execution do not prove effects. |
| Evidence | Exact reference, provenance, interpretation, capture coverage, availability and retention/disclosure obligations. Required missing material remains a gap. |
| Ledger coordination | Attributable active-selection/priority decisions and their planning context; references and explicit relationships without another writable Change history. Priority is not permission. |
| Navigation and context | Origin, selected accepted tip and reader cursor; purpose/version/coverage of projections, changes since an exact position and inspectable source grounds. |

Use these agent questions as design witnesses, not a guessed public API catalogue:

1. What decisions were actually adopted recently, by whom, against which expression and scope? Which recommendations remain proposals?
2. What intent, constraints, policy and delegation currently apply, and which earlier decisions were superseded rather than erased?
3. What changed since this exact accepted position, including failed assessments and unresolved outcomes?
4. Which Work is pending, blocked or potentially eligible, and what exact grounds or additional admission does the next action require?
5. Who owns this pursuit, who may act or continue, and what would change under an authorized share, handoff, transfer or fork?
6. Which evidence supports this claim, what can the reader disclose, and what is absent, stale or outside coverage?
7. What existing intent and consequences are relevant when considering this new Change or exact proposed revision, and which parts of that assessment are retained facts versus interpretation or recommendation?

Code-use access needs structured bounded results, stable logical references and explicit domain failures. Support selective fields/expansion and bounded paging or incremental access where the consuming contract establishes them. Local script filtering can reduce model context, but cannot silently omit mandatory blockers or label partial results complete. Queries must expose the selected version and coverage; live pages are not an atomic snapshot, and an old eligible-action View is not effect admission.

Composed calls retain their own request/result identity and authorization. A script may report partial success: its completion is not aggregate fulfillment, exception/cancellation is not rollback, and a lookup miss must not start missing Work. Independent operations may batch only under the selected host/resource guarantees. Calls sharing a custody-bearing native owner remain serialized, including reads; code-use parallelism cannot evade this boundary. Authoritative writes remain explicit backend-validated transitions, never arbitrary JSONL append or caller-constructed approval.

Optimize total cost: custody/authorization validation, reference-resolution fan-out, payload bytes read/decoded/copied, projection work, script memory, calls and model context. Moving text behind references alone does not establish an efficiency improvement over session reconstruction. Bounded native retrieval is preferable to repeatedly returning the entire history and filtering afterward. Scans, indexes, cached projections and batching are mechanisms to compare against representative consumers, not selected infrastructure or constant-cost promises. Harness-private stores and summaries are optional context support, never acceptance control or the sole source of user decisions.

## Successor specification work

The [format-first plan](../../product/plan.md#format-first-design-and-pi-first-delivery) uses the [worked Change streams](change-streams.md) as hypothetical design witnesses: a trivial Change completed in one interaction and an extended family of Changes covering parallel Work, plan revision, failure, uncertain outcome, reprioritization, handoff, fork and consolidation. Each step distinguishes retained facts, evidence, Views, unchanged grounds, reader knowledge and unknowns. The stated capability premises remain conditional; these examples select no real connector and are neither executed prototypes nor native qualification.

The successor specification must settle:

1. Record grammar, envelope, reference encoding, operation identity and acceptance boundaries.
2. Intent/plan/Work revisions, lifecycle admission and conclusion meanings.
3. Ledger active-selection and priority decisions, storage and conflict handling.
4. Handoff, fork, consolidation, contribution and any ownership-transfer protocols.
5. Scope and authority bindings for personal, shared and cross-application use.
6. Evidence retention, selective disclosure, redaction and unavailable-reference behavior.
7. Capacity, pagination, reconstruction and supported failure/recovery guarantees.
8. Compatibility with old profiles and any explicitly selected migration.

Select the first real application/capability consumer before implementing universal abstractions. The user-selected [Pi coding Change consumer proposal](pi-coding-change.md) is a worked consumer for the structure and code-use design, not a replacement delivery-first agenda. First compare how Change/Ledger structure retains user-owned decisions, revisions, relationships and evidence and supports the agent questions above. Artifact-only completion versus repository publication remains unresolved, but is not a prerequisite for this structural design work. The workflow proposal is a draft, not successor adoption or supported execution. The [SDK](sdk.md) follows these semantics; [distribution](package.md#user-distribution-and-deployment) supplies an initial Pi-user experience. A read-only navigator remains useful but does not replace this design focus. Do not freeze guessed signatures, new persistent filenames or unsupported collaborative operations during documentation adoption.
