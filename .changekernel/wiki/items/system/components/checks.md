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

A Check is a bounded, read-only assessment with explicit inputs, one reportable question, a passing condition and a Boolean completed result with actionable feedback and Evidence references. It can combine computation and authorized semantic operations. **Decision → Planning → Execution are the three public Kernel stages**, each with customized Checks at its boundaries. Prepared-effect/contribution assessment and observed-outcome Review remain distinct responsibilities within Execution, not additional public stages.

A gate controls progression or a protected effect using applicable requirements, current inputs and separate authority. Assessment scope identifies the subject, question and required timing, not a mandatory screen, model call, transaction or commit. Planning Checks assess decomposition, dependencies, routes and parallelism; the engine performs authorized dispatch, custody transfer, effects and review coordination. Typed edits can satisfy suitable boundaries directly in code. Historical stage fields/results retain their original interpretation until an explicit qualified transition.

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

Assessment uses the accountable user's intent and the applicable system requirements; it does not choose whose preferences should prevail. Intended improvement is not a guaranteed effect or a prerequisite claim of future success. Preserve intended benefit, performed effects and observations that support success, failure or uncertainty separately. Existing authorization resolves who may decide, including in shared scopes; model judgment cannot replace it.

Decision admission establishes readiness for bounded planning/pursuit, not blanket readiness to execute. Recording a proposal is not admission; conversation or an automated origin supplies neither permission nor a requirement for manual approval by itself. Valid retained discussion, findings and exact-subject approval may satisfy applicable requirements without another interview. Common judgments that depend on domain findings must use those exact retained findings and limitations. Material intent, scope or authority changes reopen Decision.

Planning assesses:

| Condition | Required conclusion |
| --- | --- |
| Intent and result coverage | Proposed Work and acceptance conditions cover the bounded pursuit without substituting an easier goal. |
| Decomposition and interfaces | Contributions are coherent, dependencies and shared interfaces are explicit, and required methods can distinguish consequential failures. |
| State and effect coverage | Relevant observations, proposed read dependencies/effects and unresolved coverage are identified, including unchanged constraints. |
| Authority and routing | Proposed recipients and operations have appropriate authority or explicit waiting/request conditions; routing itself grants none. |
| Parallelism and commitments | Interactions, shared budgets and competing alternatives have supported coordination rather than independent stale approvals. |
| Dependency readiness | Blocking dependencies are acyclic and bind actual result conditions; references and fork derivation alone do not imply readiness. |
| Bounds and uncertainty | Resources, investigation, refinement, cancellation and result/recovery needs are bounded; unknowns are not invented guarantees. |

A plan can be valid while some Work is blocked or delegated. Passing Planning does not authorize every future effect or certify unknown candidates. Progressive refinement and separately governed children/forks avoid requiring a complete world model or enormous graph upfront. Jev may assess semantic interactions; code owns exact identities, arithmetic, eligibility and serialized commitment guards. Checks report missing grounds and proposed routes rather than collecting observations, sending files or launching workers themselves.

Execution pre-effect/contribution assessment covers exact prepared effects, current intent/plan/dependency versions, native authority, authorized custody, actual contributions, deviations and truthful partial outcomes. New information requires explicit replanning or a new Change; material intent/authority changes reopen Decision. Checks inspect collected observations; authorized workers gather them and repair defects.

Review assesses the reconciled combined outcome within Execution, consistency with prior grounds, commitments, supported realization, remaining obligations and lawful completion. Child passes, a closed task or a successful write do not prove the whole outcome. Missing required results cannot be hidden as optional follow-ups. Pre-delivery candidate assessment is not evidence that delivery succeeded. Desired-target adoption, realized behavior, publication and deployment remain distinct; later effects require their own current authority and observations. A Change promising only a reviewed artifact can end before a separately governed deployment; one promising deployed behavior cannot.

## Internal intake feedback and classification

Intake is capture/refinement machinery within Decision, not a fourth public stage or a substitute for custom Decision Checks. Code validates shape, identity, scope, permissions and durable retry consistency. Bounded semantic judgments can help assess coherent intent, missing consequential grounds and suitable decomposition, but cannot invent authority or silently change intended outcomes. Domain-specific admission criteria remain available through the shared Check contract; internal coordination does not make all criteria release-owned.

Feedback binds the exact proposal revision, condition, affected location/scope, grounds, uncertainty and correction or collection need. Separate a mandatory blocker from a suggested improvement. Identify next permitted actions and commitments that must survive refinement. A rough or large proposal can be retained without being admitted. Missing information may permit bounded inquiry; missing authority requires permission or a stop. Preserve original/rejected input and attributable revisions. Changed input needs a new retry identity, not another attempt under a conflicting binding.

The loop is bounded: retain still-valid results, reassess affected conditions after material changes, account for total cost, and support clarification, deferral, rejection, cancellation or escalation. An unchanged failure is not resampled until it passes. An agent can produce corrections but cannot mark its own proposal compliant or reduce its intent to satisfy a validator. Both terminal and agent clients receive the same authoritative findings with appropriate visibility.

Classification is an input to applicability and routing, not permission to select a weaker pipeline. Use a small versioned profile of purpose, affected meaning, scope/consequences, recovery support, knowledge readiness and established-procedure fit. Purpose examples include learning, creation, adjustment, repair and retirement with mixed/unresolved cases; the initial exact vocabulary remains to be specified. Domain labels may extend the profile, not replace common requirements. Code supplies exact operations, identities, permissions and qualified binding capabilities. Jev supplies focused semantic judgments where needed; exact typed operations do not require a redundant classification call.

Jev's per-question 255-option capacity is not a target universal taxonomy. Preserve uncertainty, exact input and definition/model/settings identity; confidence is not correctness. Derive actual effects and aggregate coverage through supported bindings instead of classifying an unverified prose summary of unbounded work. Material candidate changes, new relationships or revised observations require reassessment. A single permission edit can be consequential; a large bounded batch need not require a separate semantic judgment for every record. Splitting Changes cannot evade common commitments, aggregate limits or required approval.

## Ownership, policy and activation

ChangeKernel owns common [assessment requirements](../../product/changekernel.md#assessment-responsibilities). Existing authoritative schemas, constraints, validators and handlers retain their force. User Kernel versions bind reusable Check versions at their stage boundaries; Workspace/resource-adopted requirements supply mandatory scoped conditions for intent, plans, exact effects and observed outcomes. Selecting a different personal Kernel cannot omit those conditions. Discovery should reuse supported rules instead of asking developers to restate them. Either owner can use code and bounded judgment. Packs distribute evaluators, not orchestration or authority over engine invariants.

A user may own multiple Kernels; shared immutable versions may serve multiple users and Workspaces without transferring the author's permissions. Bind each assessment to the actual executing identity, exact Kernel/Check versions, stage, Change/intent/plan/candidate as applicable, relevant State and required policy. A default Kernel preference is not authority. Receiving a borrowed Change or creating a fork requires applicable admission under the selected Kernel; inherited evidence is not a portable Execution-ready flag. Kernel/Check updates use already-established authority and do not revise past results.

| Term | Meaning |
| --- | --- |
| Check adoption record | Attributable adoption of exact definitions/settings, scope and reasons. Structure and hashes alone do not authenticate adoption. |
| Check policy | Current accepted rules determining required domain assessments and applicability. |
| Governing Check policy | The accepted policy applicable to this subject and assessment responsibility, not a caller-selected override. |
| Check result | Exact retained outcome, feedback, inputs/evaluator identity and limitations. |
| Check execution log | Protected durable reservations and outcomes, including incomplete attempts; not a second policy store. |

Adoption and activation differ. The backend determines applicability from actual subject, affected scope, prepared differences/effects and governing rules. A producer label cannot hide contrary effects; unknown applicability remains unresolved. A candidate cannot activate its own weaker evaluator or omission rule. Legitimate policy revision follows current authorized transition rules rather than freezing every old rule forever.

Adopt executable policies by exact reference where appropriate, avoiding competing prose copies. Policy is represented in versioned Workspace State; source-backed Markdown is one possible representation, not a required Wiki subsystem. Installation, marketplace listing, skill text or repeated behavior does not adopt a rule. Shared definition updates and local policy revisions need their respective authority.

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

The backend constructs authoritative assessment records from the qualified Check execution and its exact inputs, identity and result; a client cannot manufacture one by submitting a passing flag or appending JSONL. A permitted human approval remains an attributable decision, not an invented Check result or waiver of mandatory requirements. Deterministic validation/serialization supplies consistent recording, not a guarantee of semantic correctness or actual source-effect success. See [backend-only authoritative writes](state.md#backend-only-authoritative-writes).

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

| Stage/responsibility | Domain assessment |
| --- | --- |
| Decision | Proposed behavior/interfaces respect adopted compatibility rules or explicitly address a permitted break. |
| Planning | Engineering/test methods distinguish intended behavior from relevant failures; dependencies, interfaces, affected consumers, authority and parallel routes are covered. |
| Execution: pre-effect | Actual build, type, test and analysis observations meet the rules for this exact subject; evaluators inspect observations rather than run tools. |
| Execution: contribution | Changed code, tests and dependencies meet applicable architecture and maintenance requirements. |
| Execution: Review | Integration/regression Evidence establishes the claimed combined behavior and compatibility, within explicit limits. |

Split independently reportable conditions rather than hide unrelated judgments under one Boolean. Domain thresholds belong to adopted policy. A “documentation-only” label cannot suppress actual relevant effects; neither does every small edit require the same expensive catalogue. Planning method scrutiny is explicit; outcome Review and deployment do not create a fourth public stage.

## Qualification and compatibility

Qualify good, defective, ambiguous and adversarial cases for each supported question family, including omitted effects, counterevidence, source instructions, legitimate policy revision and forged evaluator ownership. Classification tests must measure missed obligations and unsafe omissions, not only label agreement. Challenge misleading repair/documentation labels, mixed intent, changed batch scope and attempts to obtain a lower-ceremony route through decomposition. Structural conformance and signatures prove neither judgment quality nor containment.

Before freezing new lifecycle records/interfaces or changing persisted contracts, resolve the [Kernel/lifecycle gate](../../product/changekernel.md#dependency-gated-implementation). Prove Decision, Planning and Execution preserve proposal, plan, pre-effect and outcome requirements and current authority. Include blocked-but-valid plans, unsafe parallel routes, shared commitments, borrowed/forked inputs with stale approvals, domain admission constraints, simple typed updates, passing candidates with failed deployment, successful units with incomplete combined results, self-weakening memory proposals and interrupted effects. Measure operator comprehension and duplicated work without silently relabeling old results. See [qualification](package.md#qualification).

This is desired architecture. Retained Pi bridges supply narrower model/session contracts, not complete public progression or a general Pack service. Historical Git/Wiki selection/execution/retention remains in Git with its original meanings. Decision → Planning → Execution is not an automatic migration of historical stage fields, the earlier two-phase design, or `planning.evaluate` / `planning.admit` results. Explicit versioned implementation must resolve compatibility without restoring a parallel historical engine or inventing adoption.
