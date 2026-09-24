---
title: Checks
aliases:
  - Check
  - Gate Checks
source-id: cw:component:checks
ownership:
  sourcePatterns:
    - src/kernel/gates/**
    - src/adapters/checks/**
    - src/server/lifecycle/decision/**
    - src/server/lifecycle/implementation/**
    - src/server/lifecycle/review/**
  testPatterns:
    - tests/kernel/gates/**
    - tests/adapters/checks/**
    - tests/server/lifecycle/decision/**
    - tests/server/lifecycle/implementation/**
    - tests/server/lifecycle/review/**
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

A Check is a bounded, read-only assessment with explicit inputs, one reportable question, a passing condition and a Boolean completed result with actionable feedback and Evidence references. It can combine computation and authorized semantic operations. **Decision + Execution are the public lifecycle phases.** Proposal admission, prepared-effect/contribution assessment and observed-outcome assessment remain distinct internal responsibilities, called Decision, Implementation and Review here.

A gate controls progression or a protected effect using applicable requirements, current inputs and separate authority. Assessment scope identifies the subject, question and required timing, not a mandatory public screen, model call, transaction or commit. Planning and review coordination are engine machinery; deployment performs effects through a binding and is never a Check side effect. Typed edits can satisfy suitable responsibilities directly in code. Existing stage fields/results retain their original interpretation until an explicit qualified transition.

## Common assessment requirements

The release owns these requirements; they are not optional Packs. Applicability follows actual supported subjects, not caller labels. Exact computation and eligible retained results may satisfy suitable conditions without mandatory inference on every small edit.

Decision assesses:

| Condition | Required conclusion |
| --- | --- |
| Intent clarity | The outcome and scope are clear enough for bounded pursuit. |
| Assessment coverage | Consequential visible effects, premises and commitments are accounted for; omissions remain explicit. |
| Claim support | Claims do not exceed attributable grounds or required domain assurance. |
| Intent fit | Action credibly serves the purpose rather than substituting an easier objective. |
| Comparative justification | Pursuit is defensible against material alternatives, including doing nothing. |
| Commitment preservation | Intermediate and resulting states preserve obligations or explicitly pursue authorized revision. |
| Credible feasibility | A plausible permitted path exists; unknown prerequisites are investigated. |
| Uncertainty handling | Consequential uncertainty has inquiry, containment or appropriate limits. |
| Outcome assessability | Later observations can distinguish success, failure and incomplete realization. |
| Justification coherence | Grounds use compatible premises, scope and conditions. |

Decision admission establishes readiness for bounded planning/pursuit, not blanket readiness to execute. Recording a proposal is not admission; conversation or an automated origin supplies neither permission nor a requirement for manual approval by itself. Valid retained discussion, findings and exact-subject approval may satisfy applicable requirements without another interview. Common judgments that depend on domain findings must use those exact retained findings and limitations. Material intent, scope or authority changes reopen Decision.

Implementation assesses relevant methods, dependency and parent-outcome coverage, exact prepared effects, authorized execution custody, actual contributions, deviations and truthful partial outcomes. Former Planning-stage method scrutiny belongs here and in factory preparation, not a fourth gate. Checks inspect collected observations; authorized workers gather them and repair defects.

Review assesses the reconciled combined outcome within Execution, consistency with prior grounds, commitments, supported realization, remaining obligations and lawful completion. Child passes, a closed task or a successful write do not prove the whole outcome. Missing required results cannot be hidden as optional follow-ups. Pre-delivery candidate assessment is not evidence that delivery succeeded. Desired-target adoption, realized behavior, publication and deployment remain distinct; later effects require their own current authority and observations. A Change promising only a reviewed artifact can end before a separately governed deployment; one promising deployed behavior cannot.

## Internal intake feedback and classification

Intake is capture/refinement machinery supporting Decision, not a third public phase or independently customizable gate. Code validates shape, identity, scope, permissions and durable retry consistency. Bounded semantic judgments can help assess coherent intent, missing consequential grounds and suitable decomposition, but cannot invent authority or silently change intended outcomes. Domain-specific admission criteria remain available through the shared Check contract; internal coordination does not make all criteria release-owned.

Feedback binds the exact proposal revision, condition, affected location/scope, grounds, uncertainty and correction or collection need. Separate a mandatory blocker from a suggested improvement. Identify next permitted actions and commitments that must survive refinement. A rough or large proposal can be retained without being admitted. Missing information may permit bounded inquiry; missing authority requires permission or a stop. Preserve original/rejected input and attributable revisions. Changed input needs a new retry identity, not another attempt under a conflicting binding.

The loop is bounded: retain still-valid results, reassess affected conditions after material changes, account for total cost, and support clarification, deferral, rejection, cancellation or escalation. An unchanged failure is not resampled until it passes. An agent can produce corrections but cannot mark its own proposal compliant or reduce its intent to satisfy a validator. Both terminal and agent clients receive the same authoritative findings with appropriate visibility.

Classification is an input to applicability and routing, not permission to select a weaker pipeline. Use a small versioned profile of purpose, affected meaning, scope/consequences, recovery support, knowledge readiness and established-procedure fit. Purpose examples include learning, creation, adjustment, repair and retirement with mixed/unresolved cases; the initial exact vocabulary remains to be specified. Domain labels may extend the profile, not replace common requirements. Code supplies exact operations, identities, permissions and qualified binding capabilities. Jev supplies focused semantic judgments where needed; exact typed operations do not require a redundant classification call.

Jev's per-question 255-option capacity is not a target universal taxonomy. Preserve uncertainty, exact input and definition/model/settings identity; confidence is not correctness. Derive actual effects and aggregate coverage through supported bindings instead of classifying an unverified prose summary of unbounded work. Material candidate changes, new relationships or revised observations require reassessment. A single permission edit can be consequential; a large bounded batch need not require a separate semantic judgment for every record. Splitting Changes cannot evade common commitments, aggregate limits or required approval.

## Ownership, policy and activation

ChangeKernel owns common [assessment requirements](../../product/changekernel.md#assessment-responsibilities). Existing authoritative schemas, constraints, validators and handlers retain their force. Container-adopted domain Checks and procedures supply additional scoped requirements for proposal admission, exact effects and observed outcomes—not only pre-effect execution. Discovery should reuse supported rules instead of asking developers to restate them. Either owner can use code and bounded judgment. Packs distribute evaluators, not orchestration or authority over engine invariants.

| Term | Meaning |
| --- | --- |
| Check adoption record | Attributable adoption of exact definitions/settings, scope and reasons. Structure and hashes alone do not authenticate adoption. |
| Check policy | Current accepted rules determining required domain assessments and applicability. |
| Governing Check policy | The accepted policy applicable to this subject and assessment responsibility, not a caller-selected override. |
| Check result | Exact retained outcome, feedback, inputs/evaluator identity and limitations. |
| Check execution log | Protected durable reservations and outcomes, including incomplete attempts; not a second policy store. |

Adoption and activation differ. The backend determines applicability from actual subject, affected scope, prepared differences/effects and governing rules. A producer label cannot hide contrary effects; unknown applicability remains unresolved. A candidate cannot activate its own weaker evaluator or omission rule. Legitimate policy revision follows current authorized transition rules rather than freezing every old rule forever.

Adopt executable policies by exact reference where appropriate, avoiding competing prose copies. Policy lives in versioned container State; source-backed Markdown is one possible representation, not a required Wiki subsystem. Installation, marketplace listing, skill text or repeated behavior does not adopt a rule. Shared definition updates and local policy revisions need their respective authority.

## Evaluation boundary

Before assessment, resolve authorized exact inputs, source roles, current candidate/observations, relevant commitments, policy and omissions. Derive actual differences through supported bindings rather than trust an agent summary. A digest authenticates neither source custody nor truth. Checks receive bounded captures, not ambient producer conversations, unrestricted databases or private credentials.

Each definition declares identity/version, owner, assessment responsibility, subject, question, passing condition, input/output shapes, applicability/input-selection rules, dependencies and execution limits. Expose requirements early so people and workers can supply missing material. Presence, authenticity, relevance, adequacy and substantive judgment are distinct; preflight must not pretend to prove all of them.

An applicable Check with missing input is unready, not inactive. A missing required evaluator is a coverage gap. No additional domain requirement can be a valid explicitly bounded case; no selected Checks cannot be presented as universal domain assurance. Built-in and existing authoritative constraints still apply.

## Check library and execution

Use small JavaScript functions, with TypeScript compiled ahead of execution. Python and other runners remain later qualified support. Ordinary helpers are enough; no separate composition language, nested autonomous scheduler or provider client per Pack is required.

The library supplies bounded input access, computation, result construction and ChangeKernel-owned [semantic operations](../../product/changekernel.md#semantic-operations-and-jev). The host owns routing, exact input/result identity, budget enforcement and retention. Jev can provide suitable judgments; producers generate missing content elsewhere. Model judgments do not grant effects or replace exact facts. No mandatory stronger-model verification of every answer or silent provider fallback is required.

Custom evaluators run outside the authoritative host process under qualified filesystem, network, credential, process, memory, time, output and model-call controls. The library, Node permissions or a receipt alone is not containment. Models called by Checks have no tools or inherited producer session. Missing fresh observations return collection needs; authorized Work gathers them separately. Local-only policy covers supporting services and disclosure, not just a loopback URL.

Backend and domain evaluators share execution machinery while retaining distinct authority origin, assessment scope and implementation/configuration identity. Backend definitions come from immutable release bytes; domain definitions from current authorized adoption. A Pack cannot label itself built-in. [Execution](agent-execution.md) defines custody and containment obligations; the existing narrower Linux/Pi implementation and its recorded identities are not silently replaced by this desired provider-independent surface.

## Results, feedback and progression

Completed results contain `passed: true | false`, feedback, Evidence references and limits. False distinguishes contradiction from insufficient support. Missing input, stale sources, malformed output and operational failures block relevant progression but are not fabricated completed semantic refutations.

Feedback identifies the condition, location/scope, grounds, uncertainty, possible correction or collection need and intent/constraints that must not be weakened. Successful feedback can be concise and source-linked. Source-provided next steps are data, not permissions. Humans clarify or approve where needed; they need not manually execute routine Checks.

Successful progression requires current valid passing required results from every applicable owner, adequate coverage and separate transition/effect authority. A score average, model confidence or human approval cannot rewrite a failed requirement. Missing execution cannot disappear from aggregation. The system can repair, pause, reject, defer or withdraw; it must not retry until every proposal passes.

Advisory procedures are not required Checks merely because they appear in the same feedback. [Frontend guidance](../../product/changekernel.md#frontend-guidance-and-responsiveness) distinguishes advice, blockers and approval/evidence needs. Frontend evaluation improves feedback; final backend validation and authorization remain authoritative.

## Efficient evaluation and reuse

Resolve applicability, cheap structure, current authority and input readiness before expensive work. Schedule independent ready judgments within shared bounds and sequence dependent ones. Questions in one Jev request cannot consume each other's answers. Share exact Evidence without counting it as independent corroboration. A failed prerequisite should explain waiting dependents rather than create a wall of duplicate failures.

Distinguish source caches, still-valid Evidence and reusable complete evaluations. Conservative reuse binds the entire declared supplied input capture, source roles, selection/membership, omissions, assessment question/scope, ownership, evaluator/dependencies, relevant policy/model/settings, permissions and freshness. Unchanged favorable citations are not the full dependency set; new applicable sources or changed external reality can invalidate reuse despite unchanged bytes.

Qualified source identities and retained captures support comparison. Git commit/tree/blob identities serve that binding, not every source. Unrelated changes need not invalidate proven equivalent inputs; missing trustworthy dependencies require conservative invalidation. Undeclared time, randomness, network or filesystem dependence prevents assuming purity.

Retain false results as well as passes, including feedback and exact grounds. Do not resample an unchanged failure or reconstruct historical results with inference. A retained-result lookup launches no missing execution. Operational retries are separately bounded and require reconciled custody. Changing evaluator wording/settings can change identity; old results stay historical, not valid under revised criteria.

No per-Save repository discovery, unnecessary semantic rebinding or generation is required. Measure first actionable feedback, ordinary-save latency, slow-tail latency, total cost through repair, incorrect acceptance/rejection and reuse. These are design targets, not current measurements. Automatic fine-grained dependency tracking is not required for an initial conservative implementation.

## First-party software-development Pack

The software Pack remains a domain example and source-development qualification aid, not the universal foundation or a requirement for every application. It uses the same adoption and execution contracts as other Packs.

| Internal responsibility | Domain assessment |
| --- | --- |
| Decision | Proposed behavior/interfaces respect adopted compatibility rules or explicitly address a permitted break. |
| Implementation | Engineering and test methods can distinguish intended behavior from relevant failures; dependencies and affected consumers are covered. |
| Implementation | Actual build, type, test and analysis observations meet the rules for this exact subject; evaluators inspect authorized observations rather than run tools. |
| Implementation | Changed code, tests and dependencies meet applicable architecture and maintenance requirements. |
| Review | Integration/regression Evidence establishes the claimed combined behavior and compatibility, within explicit limits. |

Split independently reportable conditions rather than hide unrelated judgments under one Boolean. Domain thresholds belong to adopted policy. A “documentation-only” label cannot suppress actual relevant effects; neither does every small edit require the same expensive catalogue. Former Planning-stage method assessment belongs in Implementation/factory preparation, not a fourth gate or a lost requirement.

## Qualification and compatibility

Qualify good, defective, ambiguous and adversarial cases for each supported question family, including omitted effects, counterevidence, source instructions, legitimate policy revision and forged evaluator ownership. Classification tests must measure missed obligations and unsafe omissions, not only label agreement. Challenge misleading repair/documentation labels, mixed intent, changed batch scope and attempts to obtain a lower-ceremony route through decomposition. Structural conformance and signatures prove neither judgment quality nor containment.

Before changing persisted contracts for the two-phase lifecycle, prove the mapping preserves proposal, pre-effect and outcome requirements and current authority. Include domain admission constraints, simple typed updates, passing candidates with failed deployment, successful units with incomplete combined results, self-weakening memory proposals and interrupted effects with unknown outcomes. A simpler display is not evidence of cheaper execution; measure operator comprehension and duplicated work without silently relabeling old results. See [qualification](package.md#qualification).

This is desired architecture. Private selection/execution/retention exists for narrower Git/Wiki contracts; complete public progression and a general Pack service do not. Decision + Execution is not a migration of historical stage fields. Historical Planning results and `planning.evaluate` / `planning.admit` names must not be relabeled as new assessment results. Explicit versioned implementation will replace superseded code and tests without restoring a parallel historical engine or inventing adoption.
