---
title: Checks
aliases:
  - Check
  - Gate Checks
source-id: cw:component:checks
ownership:
  sourcePatterns:
    - src/adapters/pi/check-model.ts
    - src/ports/check-model.ts
  testPatterns:
    - tests/adapters/pi/check-model.test.mjs
  roles:
    - model-check
    - decision
    - worker
    - review
  traceEvents:
    - gate.recorded
    - change.committed
    - change.deferred
    - change.rejected
    - change.resumed
    - change.withdrawn
    - work.assigned
    - work.attempt.recorded
    - work.claimed
    - work.integrated
    - review.reconciled
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:fb89bf701229b71d05e2309877708207de655916d76a8bd18212cd1766704cca
        codewiki.legacy:source-path: system/components/checks.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:checks
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Checks supplies the System responsibility required by this Story.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.legacy:relationship:
          rationale: Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
---
# Checks

A Check is a bounded read-only assessment of explicit inputs, an exact subject and one reportable question. A completed result has a passing condition, Boolean outcome, actionable feedback and evidence references. Missing inputs, failed execution and unavailable evidence are not fabricated Boolean judgments.

Checks support workflow-independent typed operations. Pre-effect assessment and observed-outcome assessment have distinct subjects; neither imposes a universal stage sequence. A Check definition may be reused inside or outside an adopted workflow. Checks do not dispatch Work, mutate native State or grant permissions. The authorized backend owns progression and acceptance.

## Engine invariants and configurable policy

The engine owns the invariants that make an accepted transition meaningful. It does not own every judgment about whether a user's goal is worthwhile.

| Owner | Responsibility |
| --- | --- |
| Engine | Valid typed transitions; exact relevant intent/operation/policy/subject and any adopted plan binding; current authorization and delegated scope; required assessment coverage; attributable retained results; truthful distinction between proposed, attempted, observed and uncertain outcomes. |
| Native application/resource owner | Native permissions, schemas, business constraints and scoped mandatory obligations. |
| User's selected Kernel | Goal-specific admission, planning rigor, success criteria, approval requirements and optional quality assessments within native/resource constraints. |
| Adopted domain Pack | Reusable evaluators and defaults for a domain, not permission to override the other owners. |

The earlier release-wide checklist of comparative justification, feasibility and justification coherence is no longer mandatory engine policy. Such questions can be useful defaults in a selected Kernel or domain Pack. Intent preservation, no self-authorizing policy changes and honest evidence remain core requirements. A resource owner can require domain assurance; selecting a different personal Kernel cannot waive it.

## Common assessment requirements

Applicable requirements come from the actual subject and governing policies, not a producer's label. Required passing results, native rights, Change authorization and effect/custody guards must all hold. A passing Check cannot override native denial or prove an unobserved effect.

- **Intent and admission:** preserve the exact proposal and current authority; establish whatever criteria the selected Kernel and resource policy require. Recording a proposal is not admission to effects. Material intent, scope or authority changes require appropriate re-admission, not automatic reassessment on every query.
- **Operation specification:** bind the pursuit to exact operations, subjects, preconditions, expected outcomes and recovery limits. This does not require a separate plan or Planning stage. Later decomposition, routing and aggregate commitments need their own supported coordination evidence.
- **Before effect:** assess the exact operation/candidate and current guards where required. An earlier planning or assessment result does not certify an unknown candidate or future permission.
- **Observed outcome and conclusion:** distinguish intended benefit, actual effects and remaining uncertainty. Candidate success is not evidence of publication, deployment or fulfillment of the Change. Required outcomes cannot be hidden as optional follow-ups; a formal Review stage is not universally required.

A Change promising a reviewed artifact can finish before a separately authorized deployment; one promising deployed behavior cannot. Intent and acceptance conditions determine which observation is needed. The engine preserves that contract rather than judging which goals should prevail.

Exact computation, current native validation and eligible retained results can satisfy suitable requirements. No inference, interview or human prompt is mandatory at every boundary. The first core profile uses trusted deterministic checks and one fixed versioned policy.

## Internal intake feedback and classification

Intake captures/refines intent without imposing a Decision stage. Validate shape, identity, scope and retry consistency without inventing missing intent. Retain original/rejected input and attributable revisions. Feedback names the exact revision, condition, grounds, uncertainty and next permitted action; advice and mandatory blockers remain distinct.

A proposal can be recorded while unready. Missing information may permit bounded inquiry; missing authority requires permission or refusal. Repeated failure is not resampled until it passes. Changing input requires a distinct operation rather than conflicting reuse of an old key.

Natural-language classification is optional future assistance. It can propose applicability or routing, not choose a weaker pipeline or grant consent. Typed operations need no redundant classification call. Before supporting classification, test misleading labels, omitted effects, mixed intent, uncertain coverage and attempts to evade cumulative obligations through decomposition. Jev-specific vocabulary and model limits are not engine invariants.

## Ownership, policy and activation

Bind each assessment to the actual actor/context, exact Kernel/Check versions, relevant intent/operation/candidate and any adopted plan/workflow, State observations and applicable resource policy. Stage membership is neither a required Check field nor a source of authority. A default preference, matching hash, installed Pack or shared definition does not establish adoption or authority.

A Check definition identifies its question, passing condition, inputs/outputs, applicability, dependencies, evaluator version and execution limits. An adoption record identifies who adopted that exact definition/settings, for which scope and under which current authority. Historical results keep their original interpretation after a definition changes.

Applicability is established from actual scope/effects and governing rules. A candidate cannot activate its own exemption or weaker evaluator. Legitimate policy revision remains possible through the currently authorized transition; the engine does not freeze every old rule forever. Adopt executable policy by exact reference where appropriate instead of maintaining competing prose copies.

Future borrowed or forked Changes establish applicable admission under their selected Kernel; retained evidence is not a portable approved flag. The initial single-user profile need not implement this transport to preserve exact version binding.

## Typed Check requests

Running a Check is an explicit supported operation, distinct from defining or adopting the Check. The operation contract identifies an assessment request before any record is written. Its exact adopted definition supplies the question, passing condition, input/output contract and evaluator; the backend authenticates the caller, validates applicability/inputs, establishes run/retry identity and accepts attributable results from supported execution. It does not infer a Check from prose or accept a caller's passing flag. Unknown definitions or unsupported execution remain unavailable/unsupported under the selected profile, never a guessed validator.

A small closed dispatcher and trusted deterministic definitions are enough initially. User-authored validators and pipelines are later capabilities with adoption and execution obligations; no generic registry, callback loader or workflow runtime is required. Intent completeness, candidate behavior and observed fulfillment can share the assessment mechanism while retaining distinct exact questions and subjects. A Check receives the authorized inputs it needs, not automatically the entire intent or Change history. An intent reference establishes grounding, not proof of alignment or eligibility for reuse after revision.

## Consumed deterministic assessment profile

The [consumed assessment profile](assessment-trace.md) selects one optional trusted fixture question: whether exact adopted What fits an 80-byte raw UTF-8 notice payload. It defines explicit owner adoption, typed requests, completed pass/nonpass results, historical applicability, retries, custody and bounded cost observations. It does not assess general intent quality, require Why, deliver a notice or authorize effects. This fresh-only successor leaves the opening and intent-revision profiles unchanged; selecting its contract is not implementation or release qualification.

## Evaluation boundary

Supply authorized, bounded inputs with source roles, versions, scope, omissions and limitations. Derive actual differences through qualified bindings rather than trust an agent summary. A digest does not authenticate source custody or substantive truth. Source content is data, not instructions granting a Check additional authority.

Missing required input makes a Check unready, not inactive. Missing required evaluator coverage blocks dependent progression. An explicitly bounded case with no additional domain Checks is valid, but cannot be described as universal domain assurance. Existing native constraints and engine invariants still apply.

Expose input and passing conditions early. Presence, authenticity, relevance, adequacy and substantive judgment are different properties; preflight must not pretend to establish all of them.

## Check library and execution

Trusted deterministic validators are sufficient initially. Do not build a custom-code runtime or semantic service before a concrete supported Check requires one. A callback supplied by an untrusted client is not a trusted built-in validator.

Later Packs can supply small functions through a qualified evaluator adapter. JavaScript/compiled TypeScript is a retained possible direction, not a required engine language. Custom evaluators execute outside authoritative host privileges under declared resource/disclosure/containment limits. A language library, Node permission flag or consistent receipt alone is not containment.

Models used by read-only Checks receive no producer tools or inherited conversation. Missing observations return a collection need; authorized Work obtains them separately. The host owns input/result identity, policy selection, limits and retention. Evaluators cannot label themselves release-owned or submit their own authoritative acceptance records. See [Execution](agent-execution.md#producer-work-versus-check-execution).

## Results, feedback and progression

A completed assessment contains `passed: true | false`, feedback, evidence and limits. False may mean contradiction or insufficient support for that question. Operational errors, canceled execution, malformed results, missing input and stale sources block relevant progression but are not invented semantic refutations.

Required evaluator or enforcement failure must block dependent progression. Logging an exception and continuing, a missing callback or a typed return value is not a passing Check. Optional telemetry can have a different failure policy only if its loss cannot bypass an obligation.

The backend constructs authoritative assessment records from qualified execution and exact inputs/results. A caller-provided passing flag or JSONL append cannot manufacture one. Human approval is a distinct attributable decision; it does not rewrite failed mandatory requirements. Scores and confidence are not substitutes for required conditions.

Feedback identifies scope, grounds, uncertainty, collection/correction needs and commitments that must survive repair. An agent may propose corrections but cannot erase intent to satisfy a validator. A supported transition may pause, defer, reject, withdraw or continue; the system is not obligated to make every proposal pass.

## Efficient evaluation and reuse

Perform cheap structure, current authority and input-readiness checks before expensive evaluation. Reuse only when exact subject/input coverage, source roles, policy/evaluator settings, disclosure and freshness requirements still hold. A favorable citation is not the complete dependency set. Unknown dependencies require conservative invalidation.

Retain false results as well as passes. Do not reconstruct historical judgments through new inference or turn unchanged failures into a pass lottery. A result lookup launches no missing execution. Operational retries need their own bounded reconciliation.

Fine-grained automatic dependency tracking, model batching and cache optimization are later improvements driven by measured need. Any claimed savings must count total repair/review cost and incorrect acceptance/rejection, not merely number or price of model calls.

## First-party software-development Pack

The software Pack is a later domain integration, not universal policy or a prerequisite for one typed transition. It can assess compatibility, engineering/test methods, exact candidate quality and combined outcome evidence under adopted rules. Check evaluators inspect authorized tool observations; Work runs builds, tests and experiments.

Domain thresholds belong to the adopted Pack/Kernel/resource policy. A documentation label cannot suppress actual relevant effects, but every small edit need not invoke an expensive catalogue. Distinguish independent questions instead of hiding unrelated judgments under one Boolean.

## Qualification and compatibility

The [plan](../../product/plan.md) requires the smallest meaningful deterministic checks first: refusal on invalid/stale/unauthorized subjects, changed intent invalidating old admission, missing required evidence, forged passing results and honest outcome review. A good-path Boolean alone is insufficient.

Later semantic families require independently reviewed good, defective, ambiguous and adversarial cases, exact model/settings identity and bounded acceptance thresholds. Test missed obligations and unsafe omissions, not only label agreement. Signatures and structural conformance prove neither judgment quality nor containment. A broadened capability requires additional evidence, not retrospective claims about the initial fixture.

Retained Pi bridges and historical stage records retain their original meanings. This design does not migrate the former two-phase pipeline or `planning.evaluate` / `planning.admit` results, qualify a general Pack service, or change existing native persistence. See [release qualification](package.md#qualification).
