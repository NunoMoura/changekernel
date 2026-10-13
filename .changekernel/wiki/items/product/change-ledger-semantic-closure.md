---
title: Change and Ledger Semantic Closure
aliases: []
source-id: cw:design:change-ledger-semantic-closure
---
# Change and Ledger Semantic Closure

## Scope and decision status

This pass answers the [property map's open interaction questions](change-ledger-properties.md#adopted-interaction-refinements) before structural distillation. It reconciles existing adopted design and identifies two proposed defaults requiring a user decision. Authorization to investigate is not adoption of those defaults. The examples below are hypothetical, not executed tests or qualified capabilities; independent design review remains pending.

The [minimal lossless core](change-ledger-properties.md#minimal-lossless-core-derived-views) remains the criterion: preserve only essential facts and references; derive presentations as Views for agents or direct UI consumption. Prose and artifact payloads stay outside canonical records. None of the answers introduces a canonical Agreement object, a global optimizer, a new runtime or a frozen operation catalogue.

| Topic | Semantic disposition | What remains open |
| --- | --- | --- |
| Contribution versus separate Change | Reconciled from existing independent-accountability rule. | Exact representation and supported ownership/coordination protocols. |
| Partial convergence | Reconciled from exact scoped adoption and preserved source histories. | Scope-reference encoding and explanatory Views. |
| Reciprocal commitments | **Decision A proposed; user adoption required.** | Exact reciprocal acceptance, revision and interruption protocol. |
| Dependency-impact visibility | Reconciled within known, authorized, version-bound relationships. | Query/index mechanics and any separately supported notifications. |
| Graceful separation | Existing preservation rules apply; **Decision B proposed for unilateral withdrawal versus release.** | Concrete exit terms and supported cancellation/reconciliation mechanisms. |
| Selective-context sufficiency | Reconciled by separating scoped explanation from consequential admission. | Purpose-specific input contracts, retrieval and coverage representation. |
| Reference retention and availability | Reconciled from existing evidence, provenance and retention obligations. | Storage/resolution mechanisms and capability-specific retention periods. |

“Reconciled” closes the general product-meaning question under existing rules, not every protocol detail or implementation claim. Decisions A and B below are proposals, not newly adopted requirements.

## 1. Contribution versus separate Change

**Existing rule:** use a related Change when a pursuit becomes independently accountable: independently adoptable, rejectable, scoped, transferable, continuable or concluded. Otherwise use Work or an accepted contribution/reference within the existing pursuit. More participants, elapsed time or extra API calls do not alone require a new Change. See [Work and granularity](../system/components/change-format.md#work-granularity-and-coordination).

**Example:** Ana can adopt an existing venue report as evidence in her event Change. Commissioning a new inspection with its own scope, responsible owner and completion decision can be a related Change. Neither requires consolidating all recipients' events or inventing a shared owner merely because they use the report.

**Failure case:** treating every use of one report as the same pursuit loses recipient-specific acceptance; creating a new Change for every read adds no accountable distinction.

**Essential distinction:** independently owned pursuit versus contribution to one; exact producer/result identity and recipient adoption where consequential. A combined list or relationship diagram is a View. This reconciles the question without choosing a shared-ownership protocol.

## 2. Partial convergence

**Existing rule:** preserve the exact scope actually adopted, its source/version grounds and consequential treatment of source commitments. Similarity or an aggregate summary does not adopt all source objectives. See [consolidation versus combined Views](../system/components/change-format.md#consolidation-versus-combined-views) and [intent provenance](changekernel.md#intent-capture-and-refinement).

**Example:** Ana and Ben accept an inspection covering step-free access and capacity. Cora's quiet-room objective remains outside that shared scope unless separately adopted. The scoped adoption may reference identified source material; it need not embed prose or invent a universal objective grammar.

**Failure case:** a summary says “all venue requirements accepted” when only access and capacity were accepted. Conversely, lack of adoption does not prove an explicit rejection.

**Essential distinction:** adopted scope, actual rejection or exclusion decisions where consequential, and what remains unadopted or unknown. Do not record an exhaustive universe of things nobody accepted. The compact overlap explanation is a View derived from those grounds, not another accepted intent document.

## 3. Reciprocal commitments

**Existing boundary:** proposals, adoption, delegation, result production and recipient acceptance are distinct; one actor cannot manufacture another's authority. See [intent adoption](changekernel.md#intent-capture-and-refinement) and [collaboration rules](../system/components/change-format.md#collaboration-and-composition-rules).

**Decision A — proposed default:** a decision establishes only commitments within its actor's authority. Claim a reciprocal agreement only when applicable adoption is established for every party whose consent the particular shared terms require, each bound to those exact terms and versions. This does not require unanimity among unrelated participants or identical completion conditions for every recipient. An authenticated direct instruction or established scoped delegation may supply adoption without an extra confirmation ceremony.

One party's decision can remain valid on its own terms without proving mutual agreement. An offer generated by an assistant, transport acknowledgment or missing reply does not supply another party's decision. A revision of shared terms does not inherit acceptance of an older version. Unilateral acceptance of an already available report under current rights is not a reciprocal undertaking and does not require a new producer vote merely because the report is reused.

**Example:** a surveyor adopts the inspection undertaking and Ana adopts the matching scope and cost terms. If delivery is interrupted after only the surveyor's decision is visible, Ana's View can establish that visible decision, not invent the other side. Missing evidence of adoption differs from an established refusal. If both applicable decisions are later established, a View can explain their relationship without creating a second writable agreement history.

**Failure case:** two old approvals for different quote versions are combined into a current agreement; or a timed-out response is treated as proof that no decision or effect occurred.

**Essential distinction:** exact shared terms, required parties, actual attributable decisions and their applicability, plus any consequential unresolved outcome. Known unilateral facts survive incomplete mutual knowledge. The label “agreed” is a derived explanation, not proof of an atomic multi-owner transaction, current permission, delivery or fulfillment. The successor protocol must still establish current validity and concurrency/interruption behavior before supporting effects; local records alone cannot promise globally simultaneous commitment.

## 4. Dependency-impact visibility

**Existing rule:** explain impact through known, authorized relationships and exact relied-on versions. Preserve historical acceptance while reassessing affected future admission. Do not claim to know every downstream recipient or automatically notify them. See the [adopted dependency-impact property](change-ledger-properties.md#adopted-interaction-refinements), [revision rules](../system/components/change-format.md#lifecycle-milestones-and-execution-admission) and [bounded navigation](../system/components/state.md#structured-history-access-and-context-projections).

**Example:** a corrected capacity report affects Ben's known reliance on capacity. Ana's separately supported access condition is not automatically invalidated. A query can expose those grounds within its coverage without asserting that no other affected pursuit exists.

**Failure case:** a limited search returns no dependent Change and is presented as proof of zero downstream impact. A model's inferred relationship is also not an already adopted dependency.

**Essential distinction:** actual version-bound reliance versus inferred relevance, and historical facts versus future applicability. Impact graphs and lists are Views. Coverage reporting must respect disclosure boundaries; it need not reveal the existence or contents of unauthorized Changes.

## 5. Graceful separation

**Existing boundary:** stopping, cancellation and supersession do not undo effects or erase accepted responsibilities and unknown outcomes. See [lifecycle conclusions](../system/components/change-format.md#lifecycle-milestones-and-execution-admission) and [separation in the cooperation witness](independent-pursuits.md#worked-imagination-three-events-one-useful-contribution).

**Decision B — proposed default:** an owner can decide to stop pursuing its own future participation and withdraw future delegation within its authority. This does not by itself release an existing accepted responsibility or change another owner's commitments. Release follows applicable, previously adopted exit terms; otherwise it requires the relevant affected parties' authorized decisions. If release is not established, retain the responsibility as unresolved rather than force continued participation or pretend settlement. Established fulfillment or settlement can separately discharge a responsibility under its applicable terms; an already discharged responsibility does not need an extra release ceremony.

A stop instruction, effective revocation, confirmed cessation and reconciliation of earlier effects remain different facts under their supported contracts. No promise is made that an executor has stopped merely because the owner asked. ChangeKernel records supported decisions and consequences; it does not determine legal enforceability, override native rights or recall disclosed plaintext.

**Example:** Ben stops future venue exploration after accepting a cost share that has already been incurred. He need not authorize additional work, but his departure does not prove that the prior cost responsibility was released. A release permitted by the adopted exit terms, or later accepted by the required parties, can establish that separate fact.

**Failure case:** removing Ben from an active-participant View deletes his outstanding responsibility; or an agent continues spending on the theory that unresolved responsibility preserves revoked permission.

**Essential distinction:** participation, authority, existing responsibility, release and actual effect/cleanup outcomes. The representation need not be selected now, but a single “withdrawn” label cannot substitute for these meanings.

## 6. Selective-context sufficiency

**Existing rule:** a read may return useful bounded context with explicit limits. A consequential operation or claim cannot proceed as fully grounded when its required inputs, authority or evidence are unavailable. Required grounds come from the supported consuming contract and applicable adopted decisions, not from a universal model score. See [source/evidence rules](../system/components/state.md#sources-observations-and-retained-research), [structured context](../system/components/state.md#structured-history-access-and-context-projections) and [execution admission](../system/components/change-format.md#lifecycle-milestones-and-execution-admission).

**Example:** disclosed access findings can support an access comparison without disclosing private catering negotiations. They cannot also establish that Cora's noise condition is satisfied if the needed observation is missing. An agent can explain the limitation, request authorized grounds or propose a different scope; it cannot silently weaken the adopted condition.

**Failure case:** a relevance filter removes a required failed assessment or unavailable reference, and a small result is labeled complete. A successful read is not a favorable decision or permission to act.

**Essential distinction:** the purpose and scope actually supported, applicable required grounds, and authorized coverage/gaps. Different agents can make different recommendations from the same facts. Views expose limits without leaking protected material or fabricating consent. Exact requirement declarations and read/result encoding belong to the consuming structure/protocol design.

## 7. Reference retention and availability

**Existing rule:** retain the exact necessary source passages and supporting material, or qualified source custody that keeps them available, for the historical explanation or dependent operation being promised. References do not retain bytes, authenticate authors or grant access. See [intent commitment provenance](../system/components/state.md#intent-commitment-provenance) and [different retention lifetimes](../system/components/state.md#different-retained-things-have-different-lifetimes).

**Example:** an acceptance of “yes” identifies the exact proposal and required source context through retained references. A future reader can resolve the needed passages without loading the entire session. That context cannot survive solely in a disposable private session or cache.

**Failure case:** only a digest or mutable URL remains; a later model regenerates similar wording and claims that it was the accepted proposal. A retained decision fact may still be readable while its necessary supporting material is unavailable; those are different limitations.

**Essential distinction:** exact identity, role, provenance, promised availability and actual authorized resolvability. Retain only necessary material, not every conversation turn. If required grounds cannot be retained or disclosed under the supported policy, do not promise complete reconstruction or authorize dependent progression. Legitimately limited retention remains an explicit limitation, not a guarantee of perpetual availability. Storage locations, resolution protocols and durations are deferred details that must be selected before their dependent capability is supported.

## Disposition of the four further proposals

These remain under consideration, not silently adopted by this closure pass. The following are recommendations for avoiding speculative growth of the core:

| Proposal | Recommended treatment before distillation |
| --- | --- |
| Complementary intent discovery | Use as a consumer/View witness. An inferred opportunity is not an adopted relationship; any later arrangement must earn its own necessary decision/reference facts. No new discovery record family is justified yet. |
| Conditional, reason-aware commitments | Keep general automatic activation and arbitrary condition evaluation deferred. Decisions A and B concern accountable consent and exit semantics, not adoption of this entire proposal or a new condition engine. Consider exact adopted condition references only where a supported use case requires them. |
| Whole-Ledger coherence | Use as a bounded View/consumer witness over relevant retained decisions and constraints. If a user adopts a genuinely new cross-pursuit constraint, preserve that decision; do not manufacture it from a derived score or assume global visibility. |
| Fulfillment without executing the plan | Challenge the existing conclusion semantics with external fulfillment. Separate evidence that the desired condition holds, causal attribution and remaining responsibilities. This does not yet justify automatic closure or another top-level primitive. |

## What can close now and what comes next

The five reconciled topics need no newly invented product rule. Decisions A and B require explicit user adoption or correction before their defaults are treated as settled. This page does not itself supply that adoption, an independent review verdict or a runtime guarantee.

After those decisions, the first structural draft can map each accepted use case to the indispensable fact/reference, its owning primitive, required reads/writes and derived Views. A field must identify the accountable distinction lost if removed. Reference grammar, operation envelopes, exact multi-party protocols, storage layout, indexes, caching, numeric bounds and View presentation remain design work; their deferral permits a draft, not a claim of supported execution. Ownership transfer and live handoff also retain their separately unresolved contracts rather than inheriting an answer from this pass.

No implementation, experiment, migration, qualification, activation or controller handoff is authorized here. The mutable source checkout does not govern itself.
