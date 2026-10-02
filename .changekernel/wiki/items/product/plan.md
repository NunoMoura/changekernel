---
title: ChangeKernel Plan
aliases:
  - Phased Capability Plan
source-id: cw:design:plan
---
# ChangeKernel Plan

## Purpose and authority

Deliver **intent-carrying, accountable Change over native State**, starting with one useful transition. The [product contract](changekernel.md) defines what we intend to own. This plan defines capability dependencies and the bounded evidence required to advance. [Research](../system/research.md) records candidate mechanisms, counterexamples and inspected evidence separately.

This is the durable plan inside Wiki, not a standalone refactoring roadmap or an execution tracker. Assignments, exact revisions, checks run, review verdicts and current blockers belong in the short [temporary status note](../../../../CHANGEKERNEL_STATUS.md), then in Changes and Work after qualified adoption. Do not mark phases complete here merely because their prose, interfaces or tests exist. Current native code has [bounded retained contracts](../system/components/native-profiles.md); those do not implement the new file-first lifecycle.

## Advancement rule

A proposition is **supported for stated conditions**, not universally proved by a passing test. Keep desired outcomes, proposed mechanisms, observed evidence and qualified capability claims distinct. User intent selects what matters; experiments cannot decide it on the user's behalf. Formal proof is claimed only when an actual proof exists.

For each small increment:

1. State the user-relevant outcome and a falsifiable proposition. Name the exact subject, supported host/binding assumptions and excluded claims.
2. Choose the smallest useful positive witness and consequential failures that could disprove it. Set expected outcomes before running the experiment; do not redefine success around a result.
3. Settle only interfaces consumed by this slice. Implement a cohesive producer-to-consumer path rather than an unused schema, validator, framework or compatibility layer.
4. Run the relevant native tests and inspect the actual outcome. Retain exact revision/artifact/configuration, commands, results, counterexamples and limits. Mocks prove only their simulated boundary; real storage/effects need real integration evidence.
5. Obtain independent review with `accepted`, `changes requested` or `blocked`. Only accepted evidence can release dependent implementation. Qualification and deployment remain separate gates where applicable.
6. If the proposition fails, revise or reject the mechanism, narrow the supported claim explicitly, or bring a product/safety tradeoff to the user. Update Wiki when intended behavior changes. Do not silently weaken an invariant, hide the counterexample or continue dependent work unchanged.

Each phase can take several such loops. Failure is useful information, not a reason to add unrelated infrastructure. Prior acceptance is bounded by the tested bytes and assumptions; changed semantics or assumptions require applicable revalidation. No need to settle all future product contracts before advancing the current supported slice.

## Selected starting profile

- One trusted host integration, one authenticated user and one Workspace binding.
- One fixed versioned Kernel policy, trusted deterministic Checks and one planned typed operation.
- Native State remains native. JSONL is the accepted Change history, with explicit acceptance control and evidence custody.
- Host-established identity/native context is not supplied by client JSON. Current native rights, delegated scope and Change authorization all apply.
- No arbitrary generated-code workers, custom evaluator runtime, model inference, privileged standalone service, collaboration, automatic monitoring or semantic discovery.
- The trusted host and its integration are inside the security boundary. Compromise of that host and hostile processes sharing its effective storage/execution authority are not covered. Do not claim otherwise or use this profile to relax existing frozen APIs.

The complete initial witness is a conditional update of one resource in a disposable external project: observe value/version, retain intent, admit an exact plan, perform the supported native operation, retain actual outcome and inspect/reopen without repetition. The binding must really support its claimed writer/concurrency and outcome semantics. A read followed by an unrestricted write is not a conditional update. Select the actual fixture/binding before freezing its interfaces; this example is not a public schema or universal filesystem guarantee.

## Phase 1 — A durable, inspectable Change without effects

**Proposition H1:** one typed Change history can preserve original/revised intent, exact decisions and a bounded plan across restart without a second lifecycle database or an agent session.

Implement one consumed opening → revision/Decision/Planning → inspection/reopen path. Give the authorized host and custody writer real consumers. It can record refusal and unready states as well as admission. Include one fixed versioned policy and deterministic requirements; no native mutation yet.

Resolve the minimal versioned operation/result encoding, identities/bounds, original-key scope, single-writer behavior and joint JSONL/checkpoint initialization/acceptance/recovery contract for this profile. Do not freeze a universal schema, extend legacy SQLite, or wait for deferred original-thread/BPF/VM protocols. The retained historical recovery proposal is input to this work, not a qualified implementation.

**Positive witness:** capture an intent, revise it attributably, record exact admission/plan, close the process, reopen and inspect the same accepted results and next permitted action. Repeating an accepted request returns its original result without a new history entry or identity allocation.

**Required challenges:** forged caller identity/approval/result, wrong Change or source association, conflicting reuse of a key, malformed/oversized input, changed intent with stale admission, missing required assessment, interrupted initialization/append/checkpoint replacement, competing writer, accepted corruption versus unaccepted tail, retained storage incidents and denied historical disclosure. Reopening cannot guess missing acceptance control or execute work.

**Advance only with:** native unit and real filesystem integration evidence for the consumed path, reviewed encoding/recovery assumptions and an honest supported-profile description. This establishes durable lifecycle behavior, not native effects, hostile-process protection or a qualified release.

## Phase 2 — One guarded effect and honest reconciliation

**Proposition H2:** the admitted operation changes only its supported subject under current authority and expected version, with actual outcome distinct from intent.

**Proposition H3:** interruption or repeated delivery cannot turn an unresolved operation into a duplicate effect or fabricated success.

Extend the same Phase 1 path through one real native binding. Durably record an exact attempt before invocation. Bind required Checks, source version, operation input and authority. Retain observed success, failure, partial or unresolved outcome, then perform outcome review inside Execution. No generic worker scheduler or arbitrary command API is needed.

**Positive witness:** observe a known version, admit its exact intended update, perform it through the native guard, inspect the real result and retain the corresponding history. Repeat the original request after losing its reply; deliver the original result without another effect. Demonstrate at least one supported interruption recovery, as well as explicit refusal when evidence cannot settle an outcome.

**Required challenges:** native denial with Change approval, Change denial with native access, narrower delegated scope, source changed after planning, a forged passing Check, changed plan/inputs under an old key, effect success followed by Trace/result failure, unknown native outcome and revoked disclosure. An outside writer must be handled according to the binding's actual contract; do not claim global serializability. Matching desired bytes alone is not proof of which attempt applied them.

**Advance only with:** real adapter/storage evidence, fault-point tests around the effect/Trace gap, truthful limits on idempotency/atomicity/recovery, and independent review of the combined Phase 1–2 behavior. A fake adapter is useful for unit tests but cannot qualify native effects. An implementation that refuses all useful operations or every restart fails the positive witness.

## Phase 3 — Qualify the bounded engine release

**Proposition H4:** exact installed candidate bytes deliver the complete supported path outside the development checkout, with understandable inspection and declared restart/recovery behavior.

Freeze the candidate and its host/binding/dependency/configuration subjects. Provide the minimal library/host integration and thin client needed to operate and inspect the path. Use the [release contract](../system/components/package.md#qualification); do not require a rich terminal console or autonomous development workflow.

**Positive witness:** in a disposable external project, perform the Phase 1–2 lifecycle, stop/restart, exercise ordinary reboot under the supported host/storage profile, reopen from a fresh client and explain intent, actual outcome, uncertainty and next permitted action without private conversation memory.

**Required challenges:** unsupported profile/invocation, wrong artifact/configuration or custody identity, stale client views, rejected/retried controls, interrupted storage/effect cases, missing retained evidence and no execution during history lookup. State explicitly which threats, rollback/loss cases and native operations are unsupported.

**Advance only with:** exact-subject qualification evidence and independent verdict. Source tests alone are insufficient. Fixes produce new candidate bytes and applicable requalification. This can be a useful engine release without being a self-development controller. Installation, activation and any real deployment need their applicable authorization; this plan does not supply it.

## Phase 4 — Add execution for a concrete development workflow

**Proposition H5:** an eligible worker/executor can produce a useful development result while ChangeKernel retains intent, current authority, exact assessments and durable continuation.

Start only with a concrete workflow that needs a worker beyond the typed path. Prefer a suitable existing harness/executor over building an owned model loop. Define exact inputs, scope, attempt/result identity, disclosure, limits, cancellation and cleanup. Qualify the additional host/containment obligations before untrusted execution. If no available executor supplies them, either keep the capability unavailable or explicitly approve a bounded new host-profile hypothesis.

Use one repository binding, a small Work configuration and meaningful adopted software Checks. Independent candidate assessment and guarded publication are required where promised. Broaden to multi-file effects only with their native concurrency and partial-outcome contract. A planning pass or sandbox exit is not publication success.

**Positive witness:** pursue a real bounded development intent, prepare and assess the candidate, publish through the supported route, review actual outcomes, handle a relevant repair and continue from a fresh worker/person using retained grounds rather than copied conversation authority.

**Required challenges:** scope and credential escapes relevant to the chosen executor, denied/changed source, failed required evaluator, setup refusal, descendant cancellation/cleanup, lost output, stale candidate, incomplete combined outcome and interrupted publication. Source-input authentication, containment and accepted Trace are assessed separately; one cannot stand in for the others.

**Advance only with:** combined workflow and exact-profile evidence under the [self-development gate](../system/components/package.md#first-self-development-delivery-focus). A self-development controller must be an immutable external qualified release, activated and explicitly handed authority to govern a later candidate. This checkout never governs itself. Privileged or live-model experiments remain separately authorized; neither old research acceptance nor this phase label permits them.

## Phase 5 — Generalize only from demonstrated need

**Proposition H6:** the core contract transfers to an additional use case without hidden lifecycle authority or invented native guarantees.

This is a set of independent capability increments, not a requirement to implement the entire future product at once. Each depends on Phases 1–3 and only the additional capabilities it actually consumes; it need not wait for Phase 4 when it uses no worker.

| Intended capability | First falsifiable question and evidence boundary |
| --- | --- |
| Another native backend/application | Can a substantially different native operation use the same Change contract while preserving its own authority, concurrency and recovery limits? Test the real binding, not a second mock. |
| User Kernel/domain Check authoring | Can adopted policy vary without weakening engine/native invariants or changing old result meanings? Test legitimate revision and attempted self-exemption; custom code adds containment obligations. |
| Semantic routing or automatic binding discovery | Does it improve a concrete workflow over explicit typed input/bindings without missed obligations, invented resources or unauthorized effects? Retain wrong/ambiguous cases and total cost. |
| Parallel Work or richer console | Does it reduce a measured coordination/operator problem while preserving exact authority, dependencies, conflicts and understandable unknowns? Do not build a scheduler or UI for an unobserved bottleneck. |
| Borrowing, forks and confidential sharing | Can exact individual material and continuation transfer without two active authorities, lost attribution or expanded disclosure? Qualify custody/revocation limits, not merely transport. |
| Monitoring and automation | Can authorized observations trigger bounded Changes without duplicate effects, stale delegation or hidden event gaps? A source event is not approval. |
| Learning and reusable procedures | Does adopted evidence-backed guidance improve a later independent task without rewriting intent or self-authorizing policy? Compare against a relevant baseline and retain contrary outcomes. |
| Hardened standalone host or new platform | Does the exact deployment provide the stronger claimed identity, isolation and lifecycle guarantees while doing useful work? Prior Landlock/BPF/VM analysis is research, not a pass. |

A capability that fails its proposition returns to revision or remains unavailable. It must not impose untested machinery on the supported core. Record accepted durable changes in the relevant Wiki contract; retain experiment limits in research/evidence and execution state in Change/Work or the temporary note.

## Validation discipline and non-goals

Use ordinary `#[test]` functions and `cargo test --locked`; run `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings` before native acceptance. Use real integration tests for storage, processes and native effects. Run `npm test` only for retained adapter changes or their integration boundary. The [testing policy](../system/components/package.md#testing-policy) governs tool selection and exact scope.

No test-count target, documentation-wording test, blanket coverage quota, speculative framework, broad mechanism survey or mandatory live inference follows from this plan. Retain regressions for consequential authorization, identity, retry/recovery and cleanup failures. Evidence records distinguish passed, failed, unavailable and untested; an empty diagnostic cache is not proof of a ready analyzer.

This plan is not evidence of an implemented schema, host, sandbox, migration, adapter or release. It authorizes no privileged setup, external artifact acquisition, paid inference, activation or controller handoff. Each source slice must consume its selected profile contract and return actual evidence before the dependent capability advances.
