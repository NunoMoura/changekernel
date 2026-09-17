---
title: Decision
aliases:
  - Semantic Decision
source-id: cw:component:decision
ownership:
  roles:
    - decision
  sourcePatterns:
    - src/server/lifecycle/decision/**
  testPatterns:
    - tests/server/lifecycle/decision/**
  traceEvents:
    - change.committed
    - change.deferred
    - change.rejected
    - change.resumed
    - change.withdrawn
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:2d95dc68636a8e4dce52dc0e2827e701e08868dd1bb0340d256ff67e54328862
        codewiki.legacy:source-path: system/components/decision.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:decision
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Decision supplies the System responsibility required by this Story.
          target: cw:story:maintainer.maintain-intent
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.maintain-intent
---
# Decision

Decision develops an attributable proposal into a scoped acceptance decision. The [ChangeKernel backend](changekernel.md#backend-validation-across-four-loops) owns the transversal validation that pursuing the exact proposed effects is justified by stated purposes, retained grounds, credible feasibility and explicitly handled consequences. Adopted [domain Checks](checks.md) assess the field-specific premises, methods, thresholds and policy conditions needed for that decision. Neither replaces the other, and neither supplies approval.

Justified pursuit is stronger than consistency with current Wiki and weaker than guaranteed future improvement or a completed implementation plan. Compare relevant alternatives, normally including doing nothing and its costs. Preferences may legitimately define value; do not invent numerical benefits. Tests and models cannot prove universal optimality. An uncertain full deployment may be unjustified while a genuinely bounded experiment is justified by useful information and limited consequences.

## Backend Decision validation

The ChangeKernel release owns these common validation responsibilities. They are not an optional first-party Pack, a project-selected lifecycle profile or hidden model preferences. Questions and passing conditions are explicit and independently reportable, not scores or one mandatory model call per family:

| Axis | Question |
| --- | --- |
| Purpose | Is the intended outcome sufficiently clear to evaluate? |
| Intent fit | Would the proposed effects credibly serve that purpose? |
| Comparative justification | Why pursue this rather than do nothing or choose a relevant alternative? |
| Commitment accounting | What remains binding and what is explicitly proposed for revision? |
| Credible feasibility | Is there a plausible permitted path to the outcome? |
| Uncertainty and outcome assessment | Are consequential uncertainties handled, and can later success or failure be assessed? |

The catalogue below defines backend questions, not ten unconditional inference calls per revision. Applicability and bounded instances follow the actual subject and release-owned Decision contract, not a candidate-selected waiver. Deterministic facts, retained eligible evaluations and bounded inference can supply results through shared execution machinery. Missing required material leaves a validation unready. Shared Evidence does not make independent corroboration, and source binding alone does not establish semantic support.

| Backend validation | Required conclusion and corrective feedback |
| --- | --- |
| Intent clarity | Outcome and scope are sufficiently clear. Identify the material ambiguity and required clarification. |
| Assessment coverage | Decision-relevant effects, premises and commitments visible within supported scope are accounted for. Identify omissions and unjustified exclusions; never claim universal completeness. |
| Claim support | Consequential claims have attributable grounds and do not exceed them. Respect required domain assessments of methods, measurements and sufficiency; do not invent domain standards. Identify irrelevant support, unsupported inference, counterevidence or missing observation. |
| Intent fit | Proposed effects have a credible connection to intent. Identify a broken causal connection or substituted objective. |
| Comparative justification | Pursuit is defensible against relevant alternatives. Identify ignored costs, alternatives or unsupported advantages. |
| Commitment preservation | A retained commitment can hold during transition and at the destination. Identify conflicts or unsafe intermediate conditions; explicitly proposed revisions remain separate. |
| Credible feasibility | At least one plausible permitted path exists. Identify fatal prerequisites, unavailable means or unsupported steps without demanding the full Planning decomposition. |
| Uncertainty handling | Consequences of a consequential uncertainty are adequately handled within scope. Identify needed inquiry, containment or scope revision; naming an assumption does not waive it. |
| Outcome assessability | Later Evidence can distinguish success, failure and incomplete realization. Identify missing assessment conditions or misleading measures. |
| Justification coherence | Supporting arguments use compatible premises, scope and conditions. Identify contradictions between locally plausible answers. |

Domain Checks supply specific assessments such as software compatibility or scientific support under adopted study standards. Their methods, limits and value criteria come from project policy, not universal Kernel preferences. Correct arithmetic does not prove estimates accurate. Managed-document parsing, transition reconstruction, permissions and exact-source validation remain backend prerequisites; the same backend also owns the common semantic validation above. Existing experimental integrity and intent-fit helpers do not establish this complete contract or justify restoring their superseded Gate engine.

The first dogfood undertaking is narrow enough to evaluate meaningfully, not exempt from applicable backend requirements. Qualify both a legitimate pass and a consequential blocked case. Projects explicitly adopt exact domain Check definitions and execution configuration; publishing a first-party software Pack does not activate it. Reports retain the backend release and the selected domain coverage rather than attributing all assurance to an optional Decision Pack.

## Inquiry, feedback and acceptance

Admission into `proposed` starts inquiry before a conversation or Wiki candidate is complete. Agents perform research, tool use, synthesis and repairs, then submit fixed structured candidates for bounded evaluation. Do not execute expensive Checks on every fragment. Missing consequential inputs leave the relevant backend validation or domain Check unready and return specific feedback rather than fabricating Evidence or hiding activation.

Backend orchestration selects its release-owned Decision validations and the current adopted domain Checks, enforces input boundaries and execution, and retains their distinct results. Feedback distinguishes contradiction, insufficient support and operational inability, identifies the affected condition and suggests what could resolve it without silently weakening intent. A stage can repair, pause, reject, defer or withdraw rather than retry until a lucky pass.

The user approves exact intent, consequential design, scope and permitted effects, not routine Work details or a manually supplied Check verdict. Passing does not supply approval; approval cannot relabel a false result. Before recording acceptance, verify applicable authority, current subject, the release-owned Decision requirements, adopted domain Check selection and all required valid results. Independent proposals can conflict or compose; a derived Change needs its own current evaluation.

## Pass report and Decision record

A pass report presents retained results, not another source of authority. Bind the exact proposal/baseline, backend release/build and validation identities, adopted domain Check and Pack versions, execution configuration, input/Evidence references, applicability decisions and limitations. Explain purpose/scope, the supported reasons by applicable axis, alternatives, retained and revised commitments, consequential assumptions, expected outcomes and the Evidence later stages still need. A report can be ready while user acceptance remains pending.

Generate a concise Decision commit explanation from those records: what was accepted, why pursuit is justified under backend Decision validation and the selected domain Checks, what remains excluded or uncertain, and references to the exact Change, report and approval. A generated summary must not add claims, imply implementation is complete or turn conditional support into certainty. The commit message is navigation, not the sole surviving approval or Evidence record. Persist results and acceptance with reachable sources and recoverable effect state before claiming success.

Acceptance to pursue, adoption of Wiki targets, realization, integration, publication and deployment are distinct. A desired outcome may be accepted before artifacts realize it; preserve the [gap and related work](alignment.md). Rejected or deferred proposals do not promote candidate Wiki. Material changes to intent, consequential design, scope or authority revisit Decision, retaining original reasons. [Planning starts fresh](../flows/decision-to-planning.md) from the accepted report and sources, not private conversation or another round of model judgments.
