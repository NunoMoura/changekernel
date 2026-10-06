---
title: ChangeKernel Plan
aliases:
  - Phased Capability Plan
source-id: cw:design:plan
---
# ChangeKernel Plan

## Purpose and authority

Deliver **intent-carrying, accountable Change over native State**, starting with one useful transition. The [product contract](changekernel.md) defines what we intend to own. This plan defines capability dependencies and the bounded evidence required to advance. [Research](../system/research.md) records candidate mechanisms, counterexamples and inspected evidence separately.

This is the durable plan inside Wiki, not a standalone refactoring roadmap or an execution tracker. Assignments, exact revisions, checks run, review verdicts and current blockers belong in the short [temporary status note](../../../../CHANGEKERNEL_STATUS.md), then in Changes and Work after qualified adoption. Do not mark phases complete here merely because their prose, interfaces or tests exist. Historical [native contracts](../system/components/native-profiles.md) retain their meanings; exact file-first implementation and acceptance checkpoints belong in the status note and Git, not a competing progress account here.

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

## Foundations before agent integration

The selected delivery priority is a robust **user-owned ledger/folder, individual Change files, typed Change operations and an efficient backend for navigation, Views and derived Change context**. Product agents come only after these foundations are supported by evidence. This is a dependency direction, not a claim that JSONL or a successful one-record fixture already supplies scalable retrieval. Ordinary developer Pi use and independent source review remain allowed under `AGENTS.md`; deferring the product agent layer does not defer source development.

Build the smallest useful file path first, then extend it into the collection and operation capabilities it can support:

1. Establish the consumed provision/open/inspect/reopen/original-key retry witness for one file, including useful recovery and specified refusal.
2. Extend the same accountable pursuit through attributable intent revision and a concrete deterministic Check assessment consumer, selecting subsequent decision, attempt/outcome and conclusion contracts only when consumed. Keep expressed intent, proposed interpretation and actual adoption distinct under the [intent provenance contract](changekernel.md#intent-capture-and-refinement). Preserve original results and operation references rather than imposing Decision/Planning stages or layering a conversation store on top.
3. Establish explicit user-owned ledger operations over multiple Changes: creation, bounded authorized listing/selection and reopening the selected Change, with independent identities, original creation-key resolution and no implied cross-file transaction or folder-wide sharing.
4. Establish deterministic origin/tip/cursor navigation, bounded head/tail/range access and purpose-specific Change context for actual consumers. Start with a fresh person or deterministic client understanding a selected Change version, including original/current intent, applicable Check assessments, exact references and honest gaps. Combining richer histories with the opening-only ledger needs an explicit successor contract; old profiles do not silently gain operations or migrate. Do not require a rich UI, model summary, generic query engine or speculative indexing framework.
5. Measure representative cold and warm backend workloads, including both many small Change files and longer operation histories, before choosing extra caches/indexes. Include authorization and accepted-prefix validation costs, bytes read/decoded, memory and projection work, not only the final rendering time.

These are successive cohesive capability increments, not parallel writers of the same persistence contract. The first opening assignment remains bounded to its selected single-slot profile; later operations, ledger/navigation/context work requires its own consumed interfaces and acceptance. There is no retrospective requirement that the opening fixture implement the whole foundation gate. The [workflow-independent semantics](changekernel.md#intent-and-lifecycle) replace the former universal three-stage assumption, not the frozen opening wire/recovery rules or retained native meanings. Do not freeze a complete primitive enum, mandatory Stage field, workflow engine or physical archive layout while settling the next consumed operation.

Before integrating product agents, demonstrate a useful model-free ledger workflow, exact and bounded operation retrieval, context reconstruction from accepted history and retained references, restart/retry correctness and measured behavior under a declared workload. Rebuildable acceleration may be lost without changing accepted truth; missing acceptance control cannot be treated as an absent cache. Publish limits and counterexamples rather than an unmeasured claim of efficiency. Multi-user transfer, hostile-host protection and remote custody retain separate qualification gates.

The two focused research questions are **operation-record layout/addressability** and **navigation/projection access paths**. The [Pi comparison](../system/research.md#pi-jsonl-sessions-as-a-trace-design-reference) supplies inspected reference behavior, not a storage implementation to copy. Resolve concrete format/navigation tradeoffs with their consumers and the [State read contract](../system/components/state.md#structured-history-access-and-context-projections), rather than freezing a universal schema or waiting for an agent framework.

### Semantic navigation model selection

Read-only candidate research can proceed while the deterministic foundation is developed; selecting a model is not a prerequisite for known-reference navigation or context reconstruction. Record agreed product semantics before choosing an adapter, and keep candidate evidence in [research](../system/research.md#semantic-and-discovery-references). The preferred first semantic consumer is bounded ledger discovery, not automatic intent adoption, a general agent loop or binding generation. This is an optional consumer of the [State read/discovery contract](../system/components/state.md#bounded-semantic-discovery), not a relaxation of the starting profile or release gates.

Compare a small constrained JEV-like model with a deterministic baseline before spending general-purpose LLM work on navigation. Define the exact query/candidate/context producer, answer meanings, no-match/ambiguity behavior and coverage limits first. Shortlisting a candidate is not adopting it. Before an experiment, settle target hardware, local versus hosted disclosure, artifact/runtime/license eligibility, approved inputs and cost/time bounds. Pin model/tokenizer/runtime/precision and question/label/projection versions; verify format compliance separately from semantic correctness and calibration.

Use representative discovery and same-topic/different-pursuit cases, missing candidates, paraphrases/negation, stale or unauthorized context, misleading instructions inside retrieved data and explicit ambiguity. Measure missed pursuits, wrong selections/revision recommendations, abstention/clarification, retrieval plus inference cold/warm latency, memory, aggregate round cost and LLM work avoided. Set acceptance criteria before evaluating held-out cases; a smaller parameter count or a provider benchmark is not selection evidence. Do not add a permanent test suite merely to restate this document.

Model downloads, runtime installs, live inference (including local inference), external disclosure, integration and release qualification retain their applicable separate authorization and evidence gates. Documentation research grants none of them and cannot waive the model-free foundation. No particular model, general custom-Check runtime or new wire format is selected here.

## Selected starting profile

- One trusted host integration, one authenticated user and one Workspace binding.
- One fixed versioned Kernel policy, trusted deterministic Checks and one precisely specified typed operation, without mandatory planning/review stages.
- Native State remains native. JSONL is the accepted Change history, with explicit acceptance control and evidence custody.
- Host-established identity/native context is not supplied by client JSON. Current native rights, delegated scope and Change authorization all apply.
- No arbitrary generated-code workers, custom evaluator runtime, model inference, privileged standalone service, collaboration, automatic monitoring or semantic discovery.
- The trusted host and its integration are inside the security boundary. Compromise of that host and hostile processes sharing its effective storage/execution authority are not covered. Do not claim otherwise or use this profile to relax existing frozen APIs.

The complete initial witness is a conditional update of one resource in a disposable external project: observe value/version, retain intent, admit the exact operation and preconditions, perform it through the supported native binding, retain actual outcome and inspect/reopen without repetition. The binding must really support its claimed writer/concurrency and outcome semantics. A read followed by an unrestricted write is not a conditional update. Select the actual fixture/binding before freezing its interfaces; this example is not a public schema or universal filesystem guarantee.

### First dogfood target and initial sharing scope

The first self-development target is a trusted local **Linux/btrfs** host, with Omarchy as the user's current Linux setup. Btrfs is the storage filesystem, not an additional operating system or a qualified deployment merely because it is in use. The target requires ledger continuity across ordinary clean process restart, reboot and supported remount at the same configured namespace. Persistent custody association must remain distinguishable from a live mount/device observation; a changed volatile observation neither proves replacement nor permits automatic adoption of another copy. The [ledger continuity requirements](../system/components/ledger-continuity.md) constrain the next consumed custody design. They do not change any frozen profile or establish reboot qualification.

Initial sharing is **read-only, explicitly authorized individual Change material**. Preserve the originating ledger/owner, actual attribution, exact accepted-prefix references and honest coverage/gaps. A recipient obtains inspection material, not continuation custody, ownership, native access or a portable permission lease. Original history is not rewritten to name the recipient's ledger. Active borrowing, ownership transfer, forks, cross-ledger import and authoritative-log merging remain separate later capabilities; read-only material does not enroll another continuing copy. The supported disclosure and inability to recall already disclosed plaintext must be stated before claiming that sharing path.

Further comparative and additional performance benchmarks are deferred until the first dogfood-ready candidate. Existing bounded measurements remain evidence for their recorded conditions, not a competitive efficiency or release-performance claim. This prioritization does not defer consequential correctness, authorization, recovery, actual native-effect or exact-release qualification checks. No new acceleration, model, privileged setup or controller authority follows from it.

## Phase 1 — A durable, inspectable Change without effects

**Proposition H1:** typed Change histories in a user-owned ledger can preserve original/revised intent and exact applicable assessment/decision grounds across restart, and support useful bounded inspection/context reconstruction without a second lifecycle database, mandatory pipeline or agent session.

Start with the consumed opening → inspection/reopen/retry path, then extend the same history through attributable intent revision and an exact deterministic assessment before broadening the ledger and read/projection capabilities selected in the foundation gate. Give the authorized host, evaluator and custody writer actual consumers. They can record refusal and unready states as well as supported progression. Include one fixed versioned policy and deterministic requirements; no native mutation yet. Intent grounding is not repeated evaluation on every operation, and an accepted proposal is not permission for effects.

Resolve the minimal versioned operation/result encoding, identities/bounds, original-key scope, single-writer behavior and joint JSONL/checkpoint initialization/acceptance/recovery contract for this profile. Do not freeze a universal schema, extend legacy SQLite, or wait for deferred original-thread/BPF/VM protocols. The retained historical recovery proposal is input to this work, not a qualified implementation.

**Positive witness:** capture an intent, revise it attributably, record a supported assessment with exact question/inputs and applicable authority, close the process, reopen and inspect the same accepted results and next permitted action. Repeating an accepted request returns its original result without a new history entry or identity allocation. An earlier assessment cannot silently certify changed intent or an unknown subject; malformed/unavailable evaluation is not a passing result.

**Required challenges:** forged caller identity/approval/result, wrong Change or source association, conflicting reuse of a key, malformed/oversized input, changed intent with stale admission, missing required assessment, interrupted initialization/append/checkpoint replacement, competing writer, accepted corruption versus unaccepted tail, retained storage incidents and denied historical disclosure. Reopening cannot guess missing acceptance control or execute work.

**Advance only with:** native unit and real filesystem integration evidence for the consumed path, reviewed encoding/recovery assumptions and an honest supported-profile description. The complete foundation also needs authorized multi-Change collection behavior, origin/tip/range retrieval, grounded context Views and measured cold/warm read costs for the selected workloads. A one-record fixture cannot supply that evidence. This establishes supported lifecycle/storage/read behavior, not native effects, hostile-process protection or a qualified release.

## Phase 2 — One guarded effect and honest reconciliation

**Proposition H2:** the admitted operation changes only its supported subject under current authority and expected version, with actual outcome distinct from intent.

**Proposition H3:** interruption or repeated delivery cannot turn an unresolved operation into a duplicate effect or fabricated success.

Extend the same Phase 1 path through one real native binding. Durably record an exact attempt before invocation. Bind required Checks, source version, operation input and authority. Retain observed success, failure, partial or unresolved outcome, then establish any conclusion against exact intent and the selected completion conditions. A separate Review stage is required only where adopted policy promises it; required outcome evidence and honest uncertainty are not optional. No generic worker scheduler or arbitrary command API is needed.

**Positive witness:** observe a known version, admit its exact intended update, perform it through the native guard, inspect the real result and retain the corresponding history. Repeat the original request after losing its reply; deliver the original result without another effect. Demonstrate at least one supported interruption recovery, as well as explicit refusal when evidence cannot settle an outcome.

**Required challenges:** native denial with Change approval, Change denial with native access, narrower delegated scope, source changed after operation admission, a forged passing Check, changed operation/inputs or adopted plan under an old key, effect success followed by Trace/result failure, unknown native outcome and revoked disclosure. An outside writer must be handled according to the binding's actual contract; do not claim global serializability. Matching desired bytes alone is not proof of which attempt applied them.

**Advance only with:** real adapter/storage evidence, fault-point tests around the effect/Trace gap, truthful limits on idempotency/atomicity/recovery, and independent review of the combined Phase 1–2 behavior. A fake adapter is useful for unit tests but cannot qualify native effects. An implementation that refuses all useful operations or every restart fails the positive witness.

## Phase 3 — Qualify the bounded engine release

**Proposition H4:** exact installed candidate bytes deliver the complete supported path outside the development checkout, with understandable inspection and declared restart/recovery behavior.

Freeze the candidate and its host/binding/dependency/configuration subjects. Provide the minimal library/host integration and thin client needed to operate and inspect the path. Use the [release contract](../system/components/package.md#qualification); do not require a rich terminal console or autonomous development workflow.

**Positive witness:** in a disposable external project, perform the Phase 1–2 lifecycle, stop/restart, exercise ordinary reboot under the supported host/storage profile, reopen from a fresh client and explain intent, actual outcome, uncertainty and next permitted action without private conversation memory.

**Required challenges:** unsupported profile/invocation, wrong artifact/configuration or custody identity, stale client views, rejected/retried controls, interrupted storage/effect cases, missing retained evidence and no execution during history lookup. State explicitly which threats, rollback/loss cases and native operations are unsupported.

**Advance only with:** exact-subject qualification evidence and independent verdict. Source tests alone are insufficient. Fixes produce new candidate bytes and applicable requalification. This can be a useful engine release without being a self-development controller. Installation, activation and any real deployment need their applicable authorization; this plan does not supply it.

## Phase 4 — Add execution for a concrete development workflow

**Proposition H5:** an eligible worker/executor can produce a useful development result while ChangeKernel retains intent, current authority, exact assessments and durable continuation.

Start only after the foundation gate is evidenced and a concrete workflow needs a worker beyond the typed path. Agents consume the existing typed operations and authorized context Views; they do not become the ledger, another context authority or a prerequisite for basic retrieval. Prefer a suitable existing harness/executor over building an owned model loop. Define exact inputs, scope, attempt/result identity, disclosure, limits, cancellation and cleanup. Qualify the additional host/containment obligations before untrusted execution. If no available executor supplies them, either keep the capability unavailable or explicitly approve a bounded new host-profile hypothesis.

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
| Related Changes and aggregate conclusions | Can typed relationships identify exact required results without directory hierarchy, implied cross-file atomicity, hidden access grants or automatic parent completion? Missing dependent grounds and native conflicts remain explicit. |
| Archive and restore | Can an explicitly configured storage relocation preserve accepted bytes, custody, retry associations and retained grounds through interruption? Restore is not execution or automatic resumption; active-only Views come first and no archive layout is selected. |
| Borrowing, forks and confidential sharing | Can exact individual material and continuation transfer without two active authorities, lost attribution or expanded disclosure? Qualify custody/revocation limits, not merely transport. |
| Monitoring and automation | Can authorized observations trigger bounded Changes without duplicate effects, stale delegation or hidden event gaps? A source event is not approval. |
| Learning and reusable procedures | Does adopted evidence-backed guidance improve a later independent task without rewriting intent or self-authorizing policy? Compare against a relevant baseline and retain contrary outcomes. |
| Hardened standalone host or new platform | Does the exact deployment provide the stronger claimed identity, isolation and lifecycle guarantees while doing useful work? Prior Landlock/BPF/VM analysis is research, not a pass. |

A capability that fails its proposition returns to revision or remains unavailable. It must not impose untested machinery on the supported core. Record accepted durable changes in the relevant Wiki contract; retain experiment limits in research/evidence and execution state in Change/Work or the temporary note.

## Validation discipline and non-goals

Use ordinary `#[test]` functions and `cargo test --locked`; run `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings` before native acceptance. Use real integration tests for storage, processes and native effects. Run `npm test` only for retained adapter changes or their integration boundary. The [testing policy](../system/components/package.md#testing-policy) governs tool selection and exact scope.

No test-count target, documentation-wording test, blanket coverage quota, speculative framework, broad mechanism survey or mandatory live inference follows from this plan. Retain regressions for consequential authorization, identity, retry/recovery and cleanup failures. Evidence records distinguish passed, failed, unavailable and untested; an empty diagnostic cache is not proof of a ready analyzer.

This plan is not evidence of an implemented schema, host, sandbox, migration, adapter or release. It authorizes no privileged setup, external artifact acquisition, paid inference, activation or controller handoff. Each source slice must consume its selected profile contract and return actual evidence before the dependent capability advances.
