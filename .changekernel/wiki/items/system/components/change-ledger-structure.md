---
title: Change and Ledger Structural Draft
aliases: []
source-id: cw:design:change-ledger-structure
---
# Change and Ledger Structural Draft

## Status and design basis

**First structural proposal for review, not an adopted schema or implemented capability.** The [defining properties](../../product/change-ledger-properties.md), [semantic closure including adopted Decisions A and B](../../product/change-ledger-semantic-closure.md), [lifecycle-wide Check requirements](checks.md#user-defined-requirements-across-the-lifecycle) and [format requirements](change-format.md) supply the requirements. Approval of A and B does not adopt the organization proposed here. The four further innovation directions remain under consideration.

The question is what must survive so that an authorized fresh consumer can understand the user's decided intent and its accountable evolution without the originating session. Start with necessary distinctions, not a delivery pipeline. Every proposed element below has an omission test; no claim of globally optimal encoding or measured efficiency follows.

The draft concerns logical structure and operation responsibilities. JSONL remains the desired encoding. Record tags, field names, envelopes, reference grammar, storage paths, public APIs, acceptance units and multi-party protocols remain unselected. Existing profiles, including exact UTF-8 What plus nullable Why, remain unchanged.

## Proposed logical structure

**Two owned contexts; operation facts within their accountable histories; referenced material outside the records; Views over the retained grounds.** This proposes no additional canonical Goal, Agreement, discovery store or conversation runtime.

| Structure | Proposed responsibility | What it must not duplicate |
| --- | --- | --- |
| Ledger | Retain its identity/governing grounds, references to Changes and attributable decisions specific to its coordination or disclosure context, including adopted active selection and priority. | A second copy of each Change's decisions, Work or current status. A personal reference to another owner's Change is not acquisition of ownership. |
| Change | Retain one authoritative pursuit history: identity/origin and lineage, actual decisions and revisions, adopted relationships and requirements, accountable Work/operation facts and consequences. | Independently writable current-intent, plan, agreement, checklist or progress documents. Work remains within a Change unless independently accountable as another pursuit. |
| Operation request and accepted facts | A request identifies the supported action and exact subject/grounds. The authorized backend establishes what may be accepted and which consequences are known. Accepted facts belong to the governed Ledger/Change context, referencing other authoritative sources where needed. | A third competing business history or a command inbox whose contents execute on replay. Requested action, acceptance and established outcome are different. |
| Required referenced material | Preserve exact expressions, acceptance context, definitions, terms, plans, inputs, artifacts and detailed evidence under declared resolution, retention and disclosure contracts. | Another writable adoption history. A source proposal or native success receipt does not supply a missing owner decision. |
| Views | Derive bounded current intent, applicability, relationships, readiness, priority displays, progress and explanations for agents or direct UI consumption. | New authority, replacement decision evidence or the only surviving copy of required material. |

One fact has one authoritative home under its supported contract. Related histories retain exact references, not competing editable copies. This does not prescribe a file per category or a transaction across several histories. Native State remains native. Non-rebuildable acceptance, custody and recovery controls are required where the supported contract needs them; they are not disposable Views merely because they are outside the compact lifecycle records.

### Conditional bindings, not a mandatory universal envelope

The following are logical needs to satisfy where applicable, not fields to repeat on every record. An enclosing accepted context or exact authoritative reference may already supply a binding. Retain that binding rather than a second authoritative copy of the same fact.

| Binding | Distinction lost if absent and not supplied elsewhere |
| --- | --- |
| Subject identity and accepted position | Which Ledger/Change and historical state the fact concerns; a filename or a reader's current cursor is insufficient. |
| Typed meaning and interpretation contract | A proposal, adoption, refusal, revision, attempt, assessment and established effect could be confused. Meaning cannot depend on an agent classifying prose later. |
| Actual actor, decision source and applicable authority | A user's decision, a scoped delegate's decision, an assistant proposal and a producer's report could be mistaken for one another. Caller-provided attribution alone is not established authority. |
| Exact target, scope and prior grounds | A decision or result could silently move to different terms, inputs, subjects or revisions. Supersession must identify what it changes; earlier consequences remain. |
| Relevant operation, attempt and outcome relationships | A retry, new action and reconciliation of an old uncertain attempt could become indistinguishable, permitting duplicate effects or invented rollback. |
| Material references with semantic roles | Exact content might remain somewhere, but the consumer would not know which expression, terms, acceptance passage or evidence grounded the fact. |

These bindings are necessary when their omission changes the account, not justification for storing every timestamp, tool call or temporary routing identity. Time evidence is retained where consent timing, freshness, deadlines or another supported obligation requires it; accepted order or filesystem modification time cannot substitute for such evidence. A typed native receipt can supply a historical native fact under its supported interpretation, but cannot supply an independent decision that never occurred.

## Use-case distillation and omission tests

The owning context below is logical authority, not selected filenames. A decision is retained where its scope is governed; cross-context use references that exact decision. Shared and multi-party cases still need a supported authority and acceptance protocol before execution. The matrix includes the original properties, adopted interaction refinements and user-defined requirements; it does not turn the four exploratory directions into requirements.

| User use case | Indispensable facts and references | Owning context | Derived View | Loss or failure boundary |
| --- | --- | --- | --- | --- |
| Express, adopt, refuse and revise a pursuit | Exact source expression and necessary acceptance context; actual attributable disposition and adopted scope/version; the earlier decision affected by a revision. | Change. | Current intent, decision timeline, proposed-versus-adopted comparison. | Without actual adoption and version binding, a better-worded proposal or a bare “yes” can become invented consent. Absence of adoption is not refusal. |
| Delegate help without surrendering ownership | Actual bounded delegation/revocation decisions, relevant authority grounds and attribution of later actions. | The governed Change or Ledger scope. | Who may act for which purpose, subject to current admission. | Knowing an ID, hosting bytes or inheriting an old authorization record does not establish current native rights. |
| Coordinate personal or shared pursuits | Exact Change references and attributable active-selection/priority or other adopted coordination decisions in the applicable planning context. | Ledger; Change history remains referenced. | Active set, sorted priorities, bounded responsibility overview. | File order or an agent recommendation cannot establish owner priority. Priority does not supply effect permission or erase obligations. |
| Decompose intent into supported Work across applications | Adopted operation/specification grounds, exact capability/subject bindings, consequential attempts and outcomes/unknowns; lineage for independently accountable related Changes. | Pursuing Change; related Changes own their own decisions. | Work graph, eligible next actions, capability gaps. | A stored plan is not current admission. Genuine unsupported capability differs from denial or temporary failure; a linked development request does not fulfill its originating pursuit. |
| Add or revise requirements across the lifecycle | Exact Check/settings references, attributable requirement adoption and applicability scope; actual assessments bound to definition, subject, inputs and coverage. | Requirement's governing Ledger/Change; each assessment has one supported authoritative source. | Applicable, pending, failed and satisfied checklists; readiness by purpose. | Definition is not adoption; adoption is not execution; missing or stale evaluation is not a pass. Changing a requirement preserves its history and cannot waive another owner's guards. |
| Accept and reuse a contribution; understand corrections | Exact producer/result version and provenance; recipient's scoped adoption or refusal; adopted reliance and any later correction/revision grounds. | Producer owns its result account; recipient Change owns its decision and reliance. | Contribution/dependency graph and bounded impact explanation. | Producer completion is not recipient acceptance. Reuse under existing rights needs no new producer vote. Unknown or undisclosed dependents cannot become “no impact”. |
| Establish reciprocal commitments — Decision A | Exact shared terms/version and required-party/scope binding, retained directly or exactly derivable under the supported terms contract; actual applicable authorized decisions; unresolved decision/delivery outcomes. | One authoritative place for each decision in the relevant governed histories, linked by exact references. | Whether the required decisions are established within the selected coverage. | Different term versions, a transport acknowledgment or silence cannot make an agreement. An “agreed” display is not an atomic multi-owner transaction or current permission. |
| Withdraw future participation; discharge responsibility — Decision B | Participation/stop decisions, effective delegation changes, prior responsibility grounds, established release/fulfillment/settlement and unresolved effects or reconciliation. | Each affected pursuit retains its authoritative decisions and consequences, referencing applicable terms and other parties' decisions. | Active participation, outstanding responsibility and cleanup needs. | A stop request is not confirmed cessation. Withdrawal does not itself release prior responsibility; outstanding responsibility does not preserve revoked spending permission. |
| Fork an alternative | New pursuit identity, exact source checkpoint/scope and lineage; the fork's own decisions and relevant retained consequences. | New Change; source Change remains intact. | Alternative comparison and lineage graph. | A copy cannot inherit native permissions or restore historical native State. Lineage alone is not a dependency or rollback. |
| Consolidate compatible remaining intent | New pursuit and exact selected source scopes/contributions; actual consolidated adoption and consequential decisions about source commitments. | New Change for consolidated pursuit; source decisions remain in their own histories; Ledger owns any new priority decision. | Adopted overlap, excluded or undecided scope, combined navigation. | A combined display or similarity finding is not consolidation. Silence cannot stop source execution, erase unknowns or prove rejection of unselected objectives. |
| Disclose only useful context | Applicable disclosure authority, exact selected source versions and scope; consequential disclosure facts and retention/custody obligations where promised. | Governing Ledger/Change context and qualified native evidence as applicable. | Authorized partial context with visible limits. | Disclosure is not delegation or ownership transfer. A limited View must not expose unrelated private material or imply completeness; disclosed plaintext cannot be recalled. |
| Hand off continuation | Exact pursuit/Work boundary, accepted continuation decisions, required Checks and relevant outcome/unknown/custody grounds. | Same Change and its supported custody controls. | Continuation context and remaining responsibilities. | Passing a handoff Check is not recipient consent or exclusive custody. Unknown outcomes block unsafe repetition; interrupted handoff needs a qualified protocol, not inferred success. |
| Transfer governing ownership | Actual authorized transfer decisions and exact transferred scope/responsibilities, origin/history bindings and established transfer/custody outcomes under a supported protocol. | Same pursuit identity; affected Ledger associations reference it without creating competing histories. | Current governing owner and transfer account. | Copied records or hosting changes do not establish ownership transfer. Native rights and credentials do not travel with intent. The exact protocol remains open. |
| Conclude honestly | Actual conclusion against exact adopted intent/conditions, supporting assessments/outcomes and responsibility or uncertainty that survives. | Change. | Fulfilled, stopped, declined or superseded presentation with grounds. | Operation success, a finished plan or a passed Check is not automatically fulfillment. No conclusion erases unresolved effects or supplies missing settlement. |
| Deliberate or continue with a fresh agent or UI | Reuse the relevant retained facts and resolvable material above. Preserve a new consequential decision only if one is actually made. | No additional deliberation history is required; any later decision belongs to its governing context. | Bounded context, revision comparison, relevant commitments and explicit gaps. | A query neither adopts a candidate nor launches Work. Inferred relevance and recommendations remain distinct from accepted relationships; bounded search cannot prove global compatibility. |

The matrix is not a record catalogue: several rows use the same decision or reference mechanism. A new record family is justified only if an existing typed mechanism cannot preserve a necessary distinction. Conversely, collapsing all of these into an untyped payload would make fresh consumers infer accountability from prose again.

## Operation responsibilities and failure boundaries

These are candidate semantic groups for the eventual operation catalogue, not API names or a required sequence of tool calls. Direct authenticated instructions or bounded delegation can establish several meanings in one interaction. The supported contract must choose acceptance units and retry/recovery behavior before effects are admitted.

| Responsibility | Read or write meaning | Required failure distinction |
| --- | --- | --- |
| Navigate and resolve | Select authorized histories at identified positions; expand exact references and retrieve bounded changes since a known position. | Unavailable, undisclosed, unsupported and mismatched grounds are not silently replaced by a model summary. Reads do not adopt or run missing Work. |
| Capture a proposal | Retain an exact expression/proposal reference and source role when accountable capture is needed. Private brainstorming need not all enter the core. | Proposal capture does not grant effect authority or invent an owner's interpretation. |
| Adopt, revise, refuse or withdraw a decision | Validate current authority and exact scope/grounds for intent, requirements, reliance, participation, delegation, coordination or conclusion. | Stale/conflicting grounds require supported conflict handling, not silent last-writer-wins. A candidate cannot authorize its own weaker policy. |
| Assess | Run a supported Check against exact definition/settings, subject and authorized inputs; retain the actual assessment and evidence binding. | Completed nonpass differs from missing input, unavailable evaluation, cancellation or malformed output. A caller's passing flag is not an assessment. |
| Admit and attempt Work | Establish exact operation/intent/Work grounds and current native guards, then account for admitted attempts under the selected binding. | Accepted request, started attempt and established native effect are distinct. Cancellation or script failure is not rollback. |
| Establish or reconcile an outcome | Attach supported observations to the original operation/attempt and preserve unresolved consequences. | A timeout is not proof of no effect; an arbitrary new operation key cannot make repetition safe. A later reconciliation does not erase the earlier unknown interval. |
| Coordinate a cross-context transition | Establish each necessary decision and supported outcome for fork, consolidation, handoff or ownership transfer without rewriting another history. | Local facts alone do not promise global atomicity or exclusive continuation. Unsupported protocol steps remain unsupported even when all desired semantics can be described. |

Readiness, agreement and outstanding-responsibility Views combine these facts; they are not operations that simply set a successful label. Producer evidence, user adoption, human review and release of responsibilities remain different even when they share a typed decision or result mechanism.

## Reference and retention obligations

An exact reference needs enough supported meaning to establish **role, identity/version, relevant scope or passage, interpretation and authorized resolution**, together with necessary provenance and retention/disclosure grounds under the [State contract](state.md#sources-observations-and-retained-research). This is a shared reference contract, not another business primitive or a chosen universal content service. Identical bytes can have different roles or provenance; a matching digest alone is insufficient.

No successor canonical record embeds source prose or artifact payloads, even short ones. A brief acceptance such as “yes” must resolve to the exact proposal/context it accepted. Plans, Check definitions, terms, detailed feedback, code and evidence stay referenced. Required originals cannot survive solely in a disposable transcript, cache or model-generated reconstruction.

The retention promise must cover the material needed for the supported continuation or reconstruction claim, directly or through qualified custody. Retaining the entire originating conversation is not the default. If necessary material becomes unavailable or cannot be disclosed, the retained decision fact may still be readable, but the consumer must expose the missing grounds and decline dependent claims or transitions. This is not a promise of perpetual availability.

## Bounded agent and direct-UI consumption

A consumer should first retrieve a compact selection of facts with exact historical positions, purpose/interpretation and coverage; expand only the required referenced material; then, if appropriate, request a separately authorized transition. This describes an access pattern, not an implementation or public signature. Current native admission is checked at the consequential boundary, not inherited from the retrieved View.

| Question | Small initial selection | Expansion when needed |
| --- | --- | --- |
| What applies now? | Decisions determining applicable intent, requirements, delegation and unresolved consequences at the selected position. | Exact expressions, definitions, authority grounds and evidence. |
| What changed? | Accepted facts since the chosen cursor, with revision and outcome relationships. | Changed source passages or exact candidate/result material. |
| Can these parties rely on the same terms? | Exact terms references and relevant party decisions, including unresolved outcomes and coverage. | Required consent/authority grounds; no unbounded scan or guessed missing approval. |
| What remains after stopping or transfer? | Relevant withdrawal, authority, responsibility, custody and reconciliation facts. | Exact exit/transfer terms, release decisions and native evidence. |
| Which requirements govern this operation? | Adopted scope and exact relevant assessments or explicit missing grounds. | Definitions, input versions, feedback and current native prerequisites. |

Each history retains its own selected position. A join across Ledgers/Changes or a sequence of live pages is not an atomic global snapshot. Filters must not hide applicable mandatory blockers within the consuming contract's required coverage. Unauthorized context is neither silently treated as known nor disclosed to justify a limitation.

Agent scripts and UIs consume the same facts without a required model intermediary. Inferred relationships and prose explanations remain labeled interpretations; they do not manufacture accepted relationships. Rebuildable indexes and caches can accelerate selection, but are not chosen infrastructure here. Later evaluation must count authorization/validation, reference fan-out, bytes, projection work, script memory and model context rather than claim that moving payloads behind references is sufficient optimization.

## Hypothetical counterexamples for review

These are design challenges, not executed tests or qualification evidence.

| Challenge | Distinction the draft must preserve |
| --- | --- |
| Two approvals refer to different quote versions. | Both actual decisions remain visible; no current reciprocal agreement is inferred. |
| Delivery fails after only one party's decision is established. | Preserve the known decision and uncertainty about the other; do not invent refusal, cancellation or atomic rollback. |
| An owner withdraws after an admitted cost was incurred. | Future participation, effective revocation, cessation and prior cost responsibility remain separate; release needs its own applicable grounds. |
| A required transfer Check passed for another recipient or older material. | That result does not certify the new transfer. Re-establish applicable assessment coverage, consent, native rights and custody separately. |
| A contribution is corrected after several recipients relied on it. | Preserve prior versions and recipient-specific adoption. Expose known affected reliance without claiming every recipient is discoverable. |
| A required acceptance passage is lost, although its digest remains. | Retain the recorded decision while reporting incomplete supporting grounds; do not regenerate historical consent. |
| A fork follows an operation whose native outcome is unknown. | Preserve the relevant uncertainty; a new Change ID does not reset native State or permit unsafe repetition. |
| Two revisions are proposed from the same old position. | Neither proposal silently overwrites an accepted decision; the eventual supported contract must establish conflict/adoption behavior. |
| External work appears to satisfy the desired condition. | Inspect exact applicability and any authorized conclusion while separating causal credit and responsibility settlement. This challenges existing semantics without adopting automatic external-fulfillment machinery. |

## Remaining representation decisions

Review whether the proposed ownership placement and conditional bindings retain every necessary distinction with no duplicate authority. Use the [independent-pursuits witness](../../product/independent-pursuits.md), [worked streams](change-streams.md) and [Pi coding consumer proposal](pi-coding-change.md) to challenge the draft, not to force all Changes into one delivery workflow.

Next representation choices include the smallest typed fact/operation catalogue, exact reference resolution and retention contract, acceptance/concurrency units, bounded read/coverage grammar and the first supported collaboration/native failure protocols. Independent review and user adoption of the concrete proposal remain separate from this draft. No API, benchmark, runtime experiment, implementation, migration, release qualification, activation or controller handoff is authorized here.
