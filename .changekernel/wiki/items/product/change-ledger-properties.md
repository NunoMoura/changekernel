---
title: Defining Change and Ledger Properties
aliases: []
source-id: cw:design:change-ledger-properties
---
# Defining Change and Ledger Properties

## Adopted product intent, not a wire schema

**The user accepted the defining-property and accepted-opportunity sections as product intent on 12 October 2026, and subsequently explicitly accepted all six interaction refinements below.** This does not adopt every earlier creative idea, claim implemented support, choose exact protocols or authorize execution. The earlier workflow-first coding proposal is not the organizing principle. Start with user value, then derive the representations and access patterns that make it possible.

The central proposition is: **user intent becomes a durable, portable, collaboratively actionable pursuit rather than disposable chat or an application-local task.** A Change is one accountable pursuit; a Ledger is the owner's collection and coordination/disclosure context. Applications retain native State and rights, harnesses supply execution and context mechanics, and ChangeKernel owns the supported meaning and progression of these primitives. There is no additional canonical Goal store, general memory system or required new runtime.

Original source expressions on 9 October listed transferable, forkable, consolidated and API-decomposable Changes, with personal, secure and agent-agnostic Ledgers. Across the 10–11 October messages, the user emphasized local ownership of intent across applications, the lifecycle/form of Change, high-signal lossless navigation and user ownership rather than application ownership. The initial 12 October acceptance includes the subsequent property/value map and exploratory opportunities, not every earlier proposal in those conversations. The later acceptance, “I accept your proposed interaction refinements,” adopts the six refinements presented in the table below. Exact expression, proposal and acceptance passages are retained as external evidence; they are not retroactive consent or source-profile migration.

The [product](changekernel.md#ownership-model-and-responsibilities) owns authority boundaries; the [format requirements](../system/components/change-format.md) own lifecycle and code-use semantics. [Research](../system/research/change-ledger-property-gaps.md) supports specific opportunity hypotheses without proving universal novelty or implementation.

## Reference-based pursuit context

**User-directed responsibility boundary:** different models, harnesses and applications help users in different ways. ChangeKernel tracks user-decided intent, attributable revisions and consequential operations, and exposes the context needed to continue that pursuit. It does not prescribe one assistant's reasoning, conversation style or way of helping. Recommendations and delegated decisions remain distinguishable from the user's own decisions and from each other.

The successor Ledger, Changes and their operation records must be compact structured accountability data, **without embedded prose or artifact payloads**. Intent expressions, supporting acceptance passages, narrative plans or explanations, documents, code and detailed evidence are retained as exact referenced material, not copied into the canonical records. The records preserve the typed facts and relationships needed to establish what was decided, by whom, against which versions, and what happened. This is not a transcript archive or a collection of opaque links whose adoption meaning must be guessed.

Complete pursuit context means the accepted structure **plus its resolvable required references**, within a declared scope. A fresh authorized agent supporting the relevant contracts should be able to retrieve the grounds needed to continue without replaying the originating session or depending on unrecorded harness-private state. It need not load every referenced byte at once. Exact source meaning must survive outside the records; excluding inline prose is not permission to discard it or replace it with lossy labels. Missing, undisclosed, stale or unsupported material remains an explicit gap, not apparently complete context or permission to proceed.

High signal and low noise are design requirements, and improved efficiency over session-based reconstruction is the target, not an already measured result. Bounded selection, exact expansion, revision comparison and incremental access must consider reference-resolution and payload costs as well as model context. The [format boundary](../system/components/change-format.md#canonical-records-evidence-and-views) owns these distinctions; exact schemas, resolvers, storage and performance bounds remain unselected. This direction does not rewrite existing accepted profiles or adopt the four innovation proposals below.

### Minimal lossless core; derived Views

**User-directed minimality criterion:** retain only the essentials for lossless preservation of intent and the evolution of its pursuit. Everything that can be reconstructed from those retained grounds belongs in a derived View, consumed by any supported agent or directly by a UI. This is a minimal authoritative core, not a compressed conversation or a lossy summary of the user's decisions.

For each proposed canonical fact or reference, identify the required distinction a supported use case would lose if it were removed. If nothing necessary is lost, omit it; if the same fact can be reconstructed exactly from retained authoritative grounds under the declared interpretation, derive it instead. Reconstruction must not depend on guessing consent, rerunning a model judgment, replaying a private session or assuming today's native reality is the historical one. Attribution, decision/version bindings, consequential history and required uncertainty are signal when their omission would change the account.

Current-intent selections, status/progress presentations, timelines, dependency navigation, summaries and purpose-specific context are Views, not separately writable truths. An adopted priority change or decision to stop remains a consequential fact; its displayed ordering or stopped label is a projection. A View may be cached or tailored to an agent or UI without becoming authority or the only surviving copy of required grounds. Direct UI consumption of structured facts requires no model intermediary. Referenced source content and necessary acceptance/recovery controls are not disposable Views merely because they sit outside the compact records.

This criterion guides the forthcoming use-case-to-structure distillation. It does not establish globally optimal encoding, eliminate reference-resolution cost or authorize deleting existing history. Exact structures and operations still require design and review.

## Defining properties and value

These properties apply at the product-design level. Not every first supported profile needs to implement all of them, but its limitations must not silently redefine the long-term value.

| Property | Value to the owner | Necessary semantic distinction; not selected fields |
| --- | --- | --- |
| User-owned identity and continuity | A pursuit survives changing apps, agents, sessions, devices or hosts without starting its explanation again. | Owning commitments versus hosting records, originating versus current governing ownership where supported, actual actors and continuation custody. |
| Transferable pursuit | Another authorized party can continue the remaining intent with adequate context and responsibility, not merely receive task text. | Disclosure, bounded delegation, custody handoff and ownership transfer are different; exact transfer protocols remain open. |
| Forkable intent | People explore alternatives from shared grounds and compare their contributions against the relevant intent. | A new independent pursuit with exact lineage; no permission inheritance, native rollback or duplicated continuing source history. |
| Consolidatable pursuits | Compatible requests can become a collective undertaking without losing each origin or silently accepting every objective. | Selected adopted objectives, source treatment, conflicts, contributions and remaining responsibility; a combined View is not consolidation. |
| Capability decomposition | Translate intent into supported operations across applications while keeping the original pursuit meaningful. | Work specifications versus independently accountable related Changes; native operation/version, authority and outcome boundaries versus high-level desired result. |
| Compositional collaboration | A specialist contributes to a broader pursuit without receiving the whole Ledger or unrestricted control. | Producer result versus recipient acceptance, exact dependency grounds and limited disclosure/acting scope. |
| Evolving intent | Clarification redirects future work without rewriting the original expression or pretending earlier effects disappeared. | Expressed intent, interpretation, adoption, revision, supersession and actual delivery. |
| Personal and shared coordination | A personal Ledger follows its owner across systems; a shared Ledger coordinates explicitly adopted commitments. | Personal references versus shared governing decisions, contextual priority versus eligibility, authorized contributions versus a union of private histories. |
| Agent-independent understanding | A fresh agent or deterministic client can establish what applies and what happened without a private conversation. | Retained accepted facts and evidence versus purpose-specific context and model-written summaries; explicit coverage/gaps. |
| Code-use efficiency | Agent-written code navigates, compares, composes and incrementally retrieves exact grounds with high signal and low context cost. | Stable references, bounded structured results, selected versions and partial results; script completion versus operation success or fulfillment. |
| Secure contextual participation | Ownership does not disclose unrelated material or give an agent authority merely because it knows a Change ID. | Current disclosure, Change authorization, bounded delegation and native resource rights; portable records do not transport credentials or guarantee host enforcement. |

Local-first storage is the selected deployment direction, not the definition of user ownership or a guarantee of secure custody. Agent independence preserves underlying user authority; a new agent still needs current admission and its own supported execution context. Portability can preserve meaning without promising that every recipient has the capabilities or rights to act.

## Accepted opportunities grounded in those properties

| Opportunity | User value and boundary |
| --- | --- |
| Intent portability | Continue an identified pursuit through another supported application surface, with explicit capability, permission and evidence differences. Historical possession is not permission to execute. |
| Demand convergence | Independent users can propose a collective Change around compatible remaining objectives without silently equating their intentions or exposing private Ledgers. Similarity proposes; authorized adoption establishes the commitment. |
| Capability-gap feedback | A genuinely unsupported pursuit can produce an authorized, grounded development request. Shipping support enables renewed admission of the originating pursuit; it does not itself fulfill that pursuit. Denial or transient failure is not a capability gap. |
| Contribution reuse | Reuse exact accepted results in another pursuit under current applicability, rights and evidence retention rather than rerunning effects or inheriting old approval. |
| Owner-controlled continuity | Replacing an agent or host changes the means of work, not silently the owner's commitments, attribution, history or scope. Any policy, custody or ownership change remains explicit. |

These opportunities do not create new top-level primitives. Relationships and accepted decisions in Changes, with Ledger-level coordination where appropriate, should explain them before any additional entity or subsystem is proposed.

## Adopted interaction refinements

The user accepted these six refinements as product intent: independent pursuits can cooperate without surrendering ownership. The [brainstorming witness](independent-pursuits.md) retains the earlier ten experience ideas as proposals, illustrates the adopted refinements with three independent events and one shared contribution, and names what a fresh reader must be able to explain. Adoption establishes the value and distinctions, not a selected schema/protocol or executable support. The [semantic closure pass](change-ledger-semantic-closure.md) reconciles existing rules and proposes two defaults that still require user adoption; reference retention is addressed there alongside the six questions below.

| Property | User value | Concrete example | Necessary distinctions | Question and disposition |
| --- | --- | --- | --- | --- |
| Owner-preserving cooperation | Collaborate without handing another party control of the entire pursuit. | Two organizers accept one venue assessment while retaining different event objectives. | Personal source pursuits, exact shared contribution, recipient adoption, disclosure and any independently owned shared Change. | When is a contribution enough versus a separate pursuit? [Reconciled: independent accountability](change-ledger-semantic-closure.md#1-contribution-versus-separate-change). |
| Partial convergence | Combine the compatible part without pretending every objective agrees. | Several events share an accessibility survey but retain different dates, budgets and suppliers. | Adopted overlap, excluded/conflicting objectives and source treatment; similarity versus compatibility. | How is exact adopted overlap preserved? [Reconciled: scoped adoption; explanation is a View](change-ledger-semantic-closure.md#2-partial-convergence). |
| Negotiable contribution commitments | Make cooperation understandable before either party relies on it. | A surveyor offers a specific inspection scope and delivery window; each recipient decides whether that is adequate. | Offered versus adopted contribution, exact conditions, required evidence, producer/recipient actors and independent completion conditions. | Which decisions establish reciprocal agreement across interruption? [Decision A proposed; adoption pending](change-ledger-semantic-closure.md#3-reciprocal-commitments). |
| Dependency-impact visibility | Discover which commitments need reconsideration when a relied-on result changes. | A revised accessibility finding affects three venue decisions but not their unrelated catering choices. | Exact referenced version, declared applicability, historical acceptance and affected future admission. | What impact can disclosed relationships establish? [Reconciled: bounded, version-bound knowledge](change-ledger-semantic-closure.md#4-dependency-impact-visibility). |
| Graceful separation | Leave cooperation without erasing completed work or unresolved responsibility. | One event withdraws from a shared venue exploration after another has already incurred an admitted cost. | Withdrawal of future participation, existing adopted obligations/effects, retained contribution rights and unknowns. | What may an owner withdraw versus release? [Decision B proposed; adoption pending](change-ledger-semantic-closure.md#5-graceful-separation). |
| Selective compatibility disclosure | Find adequate common ground without revealing irrelevant private intent. | Organizers disclose attendance/access needs but retain unrelated private budgets and negotiations. | Selected disclosure, sufficient decision grounds, omitted context and native rights; absent evidence versus evidence of compatibility. | When are disclosed grounds sufficient? [Reconciled: scoped reads versus consequential admission](change-ledger-semantic-closure.md#6-selective-context-sufficiency). |

The adopted combination is partial convergence with independently accepted contributions, supported by negotiated commitments, selective disclosure, dependency-impact visibility and graceful separation. A shared contribution need not consolidate its recipients' whole pursuits. The hypothetical witness is not empirical validation or a claim of novel invention.

## Further innovation directions under consideration

The user asked that the following four proposals be considered before distilling the properties. This is not their adoption as requirements. They may sharpen existing properties rather than become four additional ones; retain only distinctions that add user value or preserve accountability. The examples are hypothetical, not implemented or empirically validated.

| Direction under consideration | User possibility | Example | Distinctions to preserve |
| --- | --- | --- | --- |
| Complementary intent discovery | Find cooperation between different wants, not only similar objectives. | A café wants afternoon customers while a teacher needs an affordable classroom; an arrangement might help both. | Inferred opportunity, proposed arrangement and independently adopted commitments; similarity is not the only relationship, and discovery is not consent. |
| Conditional, reason-aware commitments | Cooperate on explicit conditions and reconsider commitments when their applicable grounds change. | An owner offers €100 if four others join before Friday, or accepts a venue only while its access conditions hold. | Explanation versus binding condition, conditional commitment versus active obligation, and satisfied condition versus permission to execute; no implied atomic group transaction or erased consequences. |
| Whole-Ledger coherence | Expose how individually useful pursuits support or undermine the owner's broader intent. | Two €600 trips each meet an individual limit but exceed an adopted €1,000 combined budget. | Local success, cross-pursuit compatibility, preferences, adopted constraints and limited visibility; no universal priority score or new scheduler. |
| Fulfillment without executing the plan | Recognize when further work is unnecessary without inventing causal credit or settlement. | An upstream release fixes a defect while an agent is still preparing a patch; applicability must be checked. | Desired condition holds, our Work caused it, the owner no longer wants it, and remaining obligations are settled are different facts. |

## Ledger-supported deliberation — direction to fine-tune

**User-expressed product direction:** an agent must be able to query the Ledger to understand whether a proposed new Change or a revision makes sense in the context of existing Changes' intent. This extends the Ledger's value before adoption, rather than treating it only as a record of work already chosen. The Ledger supplies structured facts and retrievable grounds; different consuming agents and applications may reason about them differently. These are consumer questions, not a requirement for ChangeKernel to become a universal intent judge. This does not adopt all four proposals above or select a query schema, inference mechanism or autonomous decision policy.

The questions below are a proposed way to fine-tune that direction, not a frozen result taxonomy or operation catalogue:

| Deliberation question | Useful distinction |
| --- | --- |
| What would this advance? | Contribution to applicable intent versus superficial topic similarity. |
| Does something already cover the need? | A genuinely new pursuit versus extending an existing one, reusing a contribution or recognizing an already satisfied condition. |
| What new cooperation could it enable? | Complementary opportunities versus relationships and commitments already adopted. |
| What would it compete or conflict with? | Preferences and tradeoffs versus adopted constraints, including combined commitments where relevant grounds are available. |
| What does this revision change for others? | The candidate delta against an exact existing version, affected reliance and responsibilities that survive the revision. |
| What cannot yet be established? | Missing, stale, undisclosed or unexamined grounds versus actual evidence of compatibility. |

A useful design witness would compare a draft new pursuit or a proposed revision with a bounded, authorized view of current applicable intent. Revision assessment should compare the current and proposed meanings, not treat the revised text as unrelated new work. Relevant earlier consequences can remain applicable even when the intent that led to them has changed.

Keep retrieved accepted facts separate from inferred relationships, evaluative judgments and recommendations. A fresh reader should be able to inspect why a finding is relevant through exact source versions and evidence, without treating a model's interpretation as an accepted relationship. Discovery and relevance selection may be incomplete; a bounded result is not proof that no other conflicts exist. Querying need not create a Change, adopt the candidate, reserve resources or start Work. The decision context is a derived View, not another writable authority or canonical Goal store.

The useful result may support a new Change, a revision, a contribution, a deliberate alternative, a request for more context or no further work. These are possibilities to explain, not preselected public operations or automatic dispositions. A conflict does not give every old preference a permanent veto; changing an adopted constraint still needs the appropriate decision. Favorability is not authorization, and any later consequential transition must establish its then-applicable grounds under the supported contract.

Before choosing representation, fine-tune what constitutes sufficient context, which candidate alternatives are worth comparing, how to expose partial coverage and changed grounds, and how to distinguish an owner decision from an authorized delegated one. No whole-Ledger scan, global optimization, automatic approval or matching algorithm is selected here.

## Brainstorming method: value before representation

For each property, work through:

1. **User benefit:** describe something a person can accomplish that is painful or ambiguous today.
2. **Concrete pursuit:** include the original expression, actual actors, relevant application boundaries and what counts as success.
3. **Changed meaning:** show what a share, transfer, fork, consolidation, correction or reuse changes and what remains true.
4. **Fresh reader:** identify the exact facts needed to explain adopted intent, authority, responsibility, outcomes and next permitted actions without a model reconstructing consent.
5. **Agent-written code:** show bounded retrieval, comparison and supported transition requests; count backend validation, data movement and context costs as well as tool turns.
6. **Consequential failure:** include missing evidence, conflicting revisions, unavailable capabilities or uncertain effects; state where the proposed benefit becomes unavailable.
7. **Representation options:** only then compare record/reference grammar, projection and coordination placement. Select the smallest structure that preserves the required distinctions.

Use [Pi coding](../system/components/pi-coding-change.md) and the [worked streams](../system/components/change-streams.md) as witnesses, not as limits on the imagination. The research questions below should produce explanatory examples before becoming schema requirements. A format can carry decisions, provenance and responsibilities; it cannot alone authenticate a host, exclude competing executors, enforce native rights, resolve an unknown effect or recall disclosed plaintext.

## Next research-backed questions

The [initial gap investigation](../system/research/change-ledger-property-gaps.md) identifies client-managed artifact acceptance, operation/task completion versus pursuit fulfillment, and portable memory versus adopted intent as useful boundaries. Its sources also show that task durability, memory portability and code-use efficiency already have prior art. The innovation hypothesis is their coherent use around user-owned accountable pursuits, not first invention of JSONL, task handles or exported context.

The next brainstorming pass should test:

- **Decision continuity:** can a fresh agent distinguish the owner's actual acceptance from an agent's recommendation, with the exact accepted version and any later correction?
- **Responsibility continuity:** what must travel with a supported handoff or transfer when work has effects, missing evidence or unresolved outcomes?
- **Composition compatibility:** what does it mean to combine objectives without erasing conflicts, source attribution, rights or source responsibilities?
- **Context adequacy:** how can compact, selectively disclosed context remain useful without hiding mandatory constraints, failed assessments or unknowns?
- **Capability continuity:** how does a pursuit stay meaningful across changing APIs and available executors without treating a stored plan as current permission?

These are refinements to investigate, not newly frozen operations or proof that every external system lacks them. Exact protocol adoption, implementation assignments, benchmarks, model experiments, qualification and controller handoff remain separate steps under the [plan](plan.md#format-first-design-and-pi-first-delivery).
