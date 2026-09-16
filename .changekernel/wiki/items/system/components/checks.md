---
title: Gate Checks
aliases:
  - Checks
  - Semantic Validation
  - Validation
source-id: cw:component:checks
ownership:
  roles:
    - model-check
  sourcePatterns:
    - src/kernel/gates/**
    - src/adapters/checks/**
  testPatterns:
    - tests/kernel/gates/**
    - tests/adapters/checks/**
  traceEvents:
    - gate.recorded
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
# Gate Checks

A Check is a small executable function with declared inputs, one independently reportable question, a defined passing condition, and a Boolean result with actionable feedback and [Evidence](evidence.md) references. It may combine deterministic computation and bounded model inference. Code and model use are operations inside the same Check, not separate Check types. A Gate controls stage progression using the applicable adopted Checks; passing never supplies approval or protected-effect authority.

All semantic Checks and Check Packs are explicitly adopted project extensions. First-party Packs use the same contract as company-authored Packs. The Kernel has no hidden intent-fit, feasibility or business-value judge. It enforces identity, permission, exact input binding, execution limits, result contracts, aggregation, persistence and recovery. These are runtime guarantees, not another semantic Check catalogue.

## Policy, evaluation and distribution

[Wiki](wiki.md) defines accepted meaning, purposes, scope, conditions and exceptions. A Check implements how one condition is evaluated. A Pack distributes versioned Check definitions, implementations and execution requirements. Installation, a marketplace listing or an axis label does not adopt policy, authorize execution or establish evaluator quality.

Prefer accepted policy supplying parameters and Checks supplying evaluation methods. An inherently executable policy can instead be explicitly adopted by reference to its exact definition; do not maintain conflicting prose and executable copies. Source documents are data, not executable plugins. Accepted Pack selection and execution configuration remain attributable to Wiki and Change, not a competing policy ledger.

Current adopted state governs selection and the authorization of policy/Check changes. A candidate cannot activate its own weaker evaluator, omit a required Check or grant itself a waiver. Legitimate policy revision remains possible through an explicit authorized transition; it is not a requirement to preserve every old policy forever. Pack updates are pinned, assessed changes rather than mutable latest-version lookups.

ChangeKernel reports what the configured Checks established. A structurally valid Check can still be inadequate or dishonest; no universal justification follows from running arbitrary extensions. No configured Checks means no validation, not an automatic validated pass. Any policy permitting unchecked acceptance must be explicit and must retain that limitation. The first dogfood loop requires meaningful adopted validation.

## Evaluation boundary

Conversation and [early intake](change-intake.md) remain free-form. Before evaluation, the agent submits a structured candidate with exact baseline and proposed effects, intent/scope, consequential claims and assumptions, source/Evidence references, affected commitments and proposed revisions, relevant alternatives and outcome conditions. Missing information remains explicit; representation is not proof of completeness. Required fields and actual selection follow the adopted Check definitions and supported subject, not an author's convenient label.

The backend resolves authorized sources, actual changed artifacts and current adopted rules into an immutable bounded evaluation snapshot. Each selected Check receives only its required inputs and declared omissions. Model input contains no producer's private conversation. Agent-supplied quotations, reports and classifications do not authenticate themselves; binding their bytes does not prove their relevance or truth. Agents perform research, tool use, experiments, synthesis and repairs. Checks evaluate the submitted case without performing those producer activities.

Each Check definition declares its identity/version, question and passing condition, input/output structures, activation and input-selection rules, implementation/dependency identity, and execution requirements/limits. Expose the applicable adopted definitions' input requirements before expensive execution so the agent can prepare explicit bindings or report missing material. A binding can select an exact Wiki passage, artifact or retained observation; no universal typed Wiki parameter catalogue is required. The backend verifies source roles, actual scope and exact identities rather than accepting the producer's selection as proof of coverage. Activation and readiness differ: demonstrably inapplicable Checks are recorded as such; missing required input makes an applicable Check unready. Unknown applicability must not be treated as exclusion. A Pack cannot turn missing Evidence into a reason not to run its Check.

## Check library and execution

Checks execute as JavaScript in one isolated runner; authors can also use TypeScript compiled ahead of execution. Python is a later supported runner over the same versioned, language-neutral message contract, not a requirement for locally hosted inference. Avoid two initial runtime ecosystems or a provider-specific library in each Pack.

The Check library exposes bounded input access, computation, result construction and an optional model-call primitive. A developer can reject missing inputs with code, request one structured assessment, validate its response and return feedback. Authors own the evaluation logic; the runtime owns containment, exact input/result binding and reuse integrity. One Check still answers one condition, not an opaque collection of unrelated questions. Multiple operations require explicit bounded resources; a Check must not become another autonomous agent.

A completed result's `passed` field is an ordinary Boolean that callers can use without losing the retained feedback, Evidence and evaluation identity. Prefer small functions and ordinary JavaScript helpers; compose only where an actual shared condition justifies it. No separate composition language, nested Check scheduler or additional Check kind is required. Existing Gate aggregation combines independently attributable required results. Parallelism is an execution choice for independent ready Checks within host limits, not a reason to combine unrelated questions or a promise that every Check runs concurrently.

Model calls go through the authorized execution host with declared inputs/output structure, permitted route, budgets, cancellation and retained execution identity. The host delegates model dispatch to [DSH execution](dsh-run-execution.md); it does not introduce a separate provider transport or agent harness. Models have no tools, ambient session, project writer or arbitrary provider credentials. One configurable Check model, including a supported local/private route, is sufficient initially. No silent provider fallback, reviewer fleet, repeated voting or automatic routing is required. A fixed resource envelope bounds spending, not reasoning difficulty; inadequate capability or exhausted budget cannot fabricate support.

Checks cannot modify Wiki, artifacts, sources, policy, lifecycle state or Project Server code. Custom code executes outside the Project Server process, with only supplied data or explicitly scoped read-only snapshots. The library itself is not a security boundary: enforce process, filesystem, network, credential, memory and time restrictions in the host. Inference is a mediated capability, not general network access. Missing required fresh information returns actionable feedback for authorized collection outside the Check.

The initial Linux execution profile uses an external owner-private working directory, pinned runtime and library bytes, a read-only filesystem, isolated process and network namespaces, and service-level memory, swap, task and wall-time controls. The trusted worker must wait for the host to verify effective kernel limits before importing custom code. Node permissions are additional restrictions, not a replacement for operating-system containment. Missing controls must stop execution without an in-process fallback. Cancellation must close the process group; unresolved provider or process custody blocks further execution in that host. Transient attempt tracking is not durable replay protection across host restarts.

Local-only execution is a deployment restriction covering supporting services and disclosure as well as model choice. No remote fallback, telemetry leak or external research is implied. A company-controlled server can be an authorized private route. Locality and small model size do not establish Check quality; qualify the declared model, runtime and input bounds.

## Results, feedback and progression

Every completed Check returns `passed: true | false`, natural-language feedback, and the relevant Evidence references and limitations. `false` must distinguish contradiction from insufficient support. An execution error, missing input, stale source or malformed output prevents progression but is recorded as operational inability, not a fabricated completed semantic refutation. There is no separate Finding or Obligation authoring object: the required condition belongs in the Check; support and limits belong in Evidence and feedback.

Failure feedback identifies what condition failed, where it applies, why it failed, what correction/clarification/Evidence could resolve it, and what accepted intent or constraints must not be silently weakened. Do not promise a repair when none is known. Successful feedback can be concise and source-linked. A human clarification is new input; humans are not required to manually execute routine Checks.

Progression requires all applicable required Checks to have current valid passing results under the adopted selection, with necessary input/Evidence coverage, plus separate authority for the exact transition. Missing execution cannot disappear from aggregation. No weighted average, model confidence or user approval rewrites a false result. Same retained results produce the same Boolean progression decision; this does not make model inference deterministic or prove arbitrary claims true.

A stage may continue with targeted repair, pause for missing input or budget, or terminate by rejection/withdrawal. Only successful progression requires the passing condition; the system must not force every proposal to eventually pass. Returned feedback goes to the cause rather than encouraging cosmetic retries. Material revisions of approved intent or scope return for the applicable decision.

## Efficient evaluation and reuse

Activate from actual effects and adopted policy; check cheap structure, freshness and required inputs before expensive work. Run independent ready Checks concurrently within shared limits. Stop launching dependent or expensive work after a blocker while retaining completed results and useful cheap independent feedback. Do not evaluate every conversational fragment. Optimize cost and time through repair rounds, not just one attempt.

Share collected Evidence and bounded context across applicable Checks without duplicating corroboration. Preserve decisive source passages and declared omissions; do not truncate away constraints. Provider prefix caching and optional batching of related questions are execution optimizations, not evidence of independence or correctness. Batching must retain separate Check results and needs quality evaluation before use.

Distinguish caches of exact source bytes, Evidence whose scope/freshness still applies, and Check evaluations whose complete bound inputs and execution conditions match. The initial result-reuse boundary is the entire declared, supplied input snapshot, including the evaluated subject, relevant desired Wiki and artifacts, source roles, scope, input-selection rules and membership, and declared omissions. Supporting citations returned by a passing Check are not a complete dependency declaration. A newly applicable source can invalidate reuse without editing previously supplied files.

Resolve inputs and validate readiness and reuse eligibility before scheduling expensive execution. Git commit/tree/blob and passage identities provide cheap, deterministic comparisons of retained Wiki and other Project artifacts. The enclosing commit alone is not the reuse key: unrelated commits need not force reevaluation when the full relevant binding is demonstrably equivalent. Conversely, an unchanged report cannot justify reuse when its evaluated implementation changed. Bind Check implementation/dependencies, governing configuration and relevant model/execution settings alongside the complete inputs. A new candidate still needs verified equivalence and a new attributable binding, not relabeling an old stage verdict. Permission, source-role, freshness or availability changes can invalidate reuse despite unchanged bytes. Material outside Git requires an exact authorized retained capture or other verified immutable custody; merely residing on a Project Server is not enough.

Retain the Boolean, feedback, Evidence references, limitations and evaluation identity together. Reuse is a backend decision over those records, not a Check's authority to cache its own unsupported success or set a permanent Wiki truth flag. Preserve semantic failures as well as passes; an unchanged unsupported argument must not get repeated chances for a lucky model answer. Execution errors and other operational inability are not completed false judgments. Operational retries remain separately bounded. Recovery reads retained results and does not resample models.

Start with conservative reuse over all supplied inputs rather than model-inferred dependencies, automatic paragraph-level read tracking or a general dependency engine. Undeclared clock, randomness, filesystem or network dependencies prevent assuming a function is pure; changing external reality requires explicit observations and validity conditions. Reusing a recorded model judgment does not claim deterministic inference or continuing factual truth. Finer-grained cross-revision reuse is optional later work and requires trustworthy dependencies; otherwise invalidate conservatively.

Measure time to actionable feedback, total cost through acceptance/repair, reuse, unnecessary activation, false acceptance/rejection and fresh-session reconstruction. Budget exhaustion pauses with progress preserved. The [minimum release](package.md#minimum-local-dogfood) requires bounded activation, fail-fast behavior and exact-input replay, not an advanced scheduler or generalized dependency engine.

## Axes and qualification

Axes group questions; they are not scores, mandatory Kernel semantics or proof supplied by a label. The [first-party Decision Pack design](decision.md#first-party-decision-pack) uses purpose, intent fit, comparative justification, commitment accounting, credible feasibility, and uncertainty/outcome assessment. Other adopted Packs can express other project needs. Evidence quality applies across families rather than forming a compensating axis.

Test Check definitions against independently reviewed acceptable, defective, ambiguous and adversarial cases. Include unsupported persuasive claims, omitted effects, counterevidence, legitimate policy revisions, source instructions and cosmetic rewrites. Exact receipts and schema conformance prove neither containment nor assessment quality. [Qualification](benchmarks.md) measures both false acceptance and unnecessary rejection under a declared profile; a marketplace signature proves artifact identity, not semantic adequacy.

These are desired contracts, not implemented release claims. Existing experimental internal semantic Gate/findings and Decision helpers are migration inputs, not permanent second Check types or a qualified extension system. Replace obsolete prerelease code and tests deliberately, preserving genuine historical bytes and meanings. The unified library, adopted Packs and Boolean contract need explicit versioned implementation; do not relabel old records or restore the deleted historical engine.
