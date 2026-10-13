---
title: ChangeKernel Plan
aliases:
  - Phased Capability Plan
source-id: cw:design:plan
---
# ChangeKernel Plan

## Purpose and authority

Deliver **owner-controlled, accountable Change across application surfaces**, with the Change representation and lifecycle/composition semantics as the primary design artifact. The [product contract](changekernel.md) defines the intended responsibilities. This plan orders format design, supported engine capabilities and initial Pi-user delivery; [research](../system/research.md) retains inspected mechanisms and limits separately. A narrow qualified transition remains the foundation, not the whole product or a substitute for the successor-format design.

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

## Format-first design and Pi-first delivery

The user selected **Ledger and Change as the primary primitives**, app-independent owner control, explicit lifecycle/admission semantics, collaborative Change properties and an initial local-first Pi integration for existing Pi users. There is no separate Goal store or lifecycle. The [Change-format requirements](../system/components/change-format.md) now drive design; the [code-use adapters and optional SDK](../system/components/sdk.md) are downstream software interfaces, not the end-user distribution or the first design task. A read-only navigator remains useful without defining the product's scope.

The approved integration direction is **contract-first, JavaScript/Python-friendly surfaces and thin harness-specific bridges; Pi first, then investigation of Codex, Claude Code and DeepSeek Harness**. Select each bridge from its actual execution environment rather than assuming that a shared language, installable SDK or CLI works in every sandbox. The [harness targets and binding boundary](../system/components/sdk.md#harness-targets-and-code-use-bindings) own this direction; transport, concrete signatures and later compatibility remain open. A CLI is optional, not the organizing contract. Present new choices in the TUI for approval before recording adoption under [the source-development procedure](../../../../AGENTS.md#design-review-and-documentation); use efficient, lossless Wiki/plan structures, including tables.

Before selecting representations, use the user-adopted [property/value map](change-ledger-properties.md) and bounded [gap research](../system/research/change-ledger-property-gaps.md). Brainstorm user benefit, concrete pursuit, changed meaning, fresh-reader needs, code-use access and consequential failure before choosing record grammar. Research must distinguish observed protocol boundaries from opportunity hypotheses and acknowledge relevant prior art; the value is not merely another task handle, memory export or runtime. New refinements remain proposals until adopted. No runtime/model experiment follows from research permission.

Use this dependency order within the capability gates below:

1. **Work through concrete Change streams.** Use and extend the [worked Change streams](../system/components/change-streams.md): a trivial Change completed in one interaction and an extended family covering parallel Work, plan revision, failure, uncertain outcome, reprioritization, handoff, fork and consolidation. At each step identify recorded facts, unchanged grounds, what another reader can establish, and what remains unknown. These are hypothetical design witnesses, not selected connectors, executable prototypes or native qualification. Select the first real application/capability consumer before universal abstractions.
2. **Specify and adopt the smallest sufficient successor contract.** Settle record grammar/envelope/references, lifecycle admission, revisions, Ledger coordination, collaboration and navigation against those witnesses. Keep declared capture/retention/disclosure boundaries and consequential relationships exact. Detailed ownership-transfer, cross-application scope, capacity/recovery and migration rules remain open until consumed. Do not invent persistent filenames or publish guessed wire enums merely to illustrate a stage.
3. **Establish the consumed engine and client boundary.** Map only supported operations of the explicitly selected native profile through the smallest useful client/host bridge and real Rust host. Start with the Pi consuming environment and its JavaScript/TypeScript host tooling; language surfaces follow the shared semantic contract rather than define it. Preserve lossless values, original keys/results, structured errors, bounded reads, exact references, serialized custody and supported recovery. A useful model-free consumer is required before agent convenience can claim that native support exists. Existing accepted foundations need not be reimplemented; unfinished capability cannot become supported through a wrapper.
4. **Qualify initial Pi-user delivery.** Expose the supported path through Pi tools, commands and Views, with Codemode composition where useful. End users install a qualified integration, not an SDK. Identify the exact Rust, bridge, integration, runtime and connector closure, supported storage/host profile and user-visible limits. Preserve controlled resources, disclosure, uncertainty and cleanup; updating the installed Pi executable does not qualify the retained bridges.
5. **Extend from demonstrated need.** Use the Pi design as the first concrete witness, then investigate the named follow-on harnesses before selecting their bridges or claiming support. Additional connectors, independent/parallel Work, collaboration, semantic interpretation, MCP or a durable executor each need their consumed contract and evidence. A standalone consumer client, hosted/self-hosted service and multi-device deployment are later delivery profiles, not simultaneous initial projects. Reuse suitable host and native mechanisms rather than build another agent stack, scheduler or general State subsystem.

The user selected [Pi coding Change](../system/components/pi-coding-change.md) as a worked consumer, then clarified the immediate focus: Change/Ledger requirements and structure optimized for agentic code use, with user ownership and supported transferability as product capabilities. Compare accepted facts, referenced evidence and derived context together with bounded programmatic reads and explicit transitions under the [structure/access requirements](../system/components/change-format.md#agent-facing-structure-and-code-use) and [ownership distinctions](changekernel.md#user-owned-continuity-and-transferability). The workflow draft remains a witness, not a selected release scope. Candidate-only completion versus publication need not be decided before this structural work; exact execution/transfer protocols remain separate contracts. No implementation, repository binding qualification or self-development resumes.

Existing ledger/Change layouts, accepted history, closed inventories, schemas, operation versions, ownership, limits, accounting and admission/recovery meanings remain frozen. This design authorizes specification of successors, not silent widening, automatic migration or replacement of JSONL lifecycle authority with Pi storage. Native bindings remain explicit; State stays native.

Efficiency must count native reads, validation, decoding/copying, memory and total composition work as well as model/tool turns and returned context. Use bounded consumers and measured needs rather than speculative caches or a zero-overhead claim. A design witness grants no benchmark, inference or deployment permission. Current assignments and implementation pause/resume authority remain in the temporary status note; documentation adoption resumes no implementation, dispatch, tests/builds, migration, activation or controller handoff.

## Foundations before agent integration

The engine foundation remains **owner-controlled Ledgers, individual authoritative Change histories, supported typed operations and bounded navigation, Views and context**. The format-first design above determines successor meaning; a product Pi integration must consume supported foundations rather than infer them from JSONL or a one-record fixture. These are capability dependencies, not the current source-development assignment or permission to resume paused work. Ordinary Pi-native source procedure remains in `AGENTS.md`.

Build the smallest useful file path first, then extend it into the collection and operation capabilities it can support:

1. Establish the consumed provision/open/inspect/reopen/original-key retry witness for one file, including useful recovery and specified refusal.
2. Extend the same accountable pursuit through attributable intent revision and a concrete deterministic Check assessment consumer, selecting subsequent decision, attempt/outcome and conclusion contracts only when consumed. Keep expressed intent, proposed interpretation and actual adoption distinct under the [intent provenance contract](changekernel.md#intent-capture-and-refinement). Preserve original results and operation references rather than imposing Decision/Planning stages or layering a conversation store on top.
3. Establish explicit user-owned ledger operations over multiple Changes: creation, bounded authorized listing/selection and reopening the selected Change, with independent identities, original creation-key resolution and no implied cross-file transaction or folder-wide sharing.
4. Establish deterministic origin/tip/cursor navigation, bounded head/tail/range access and purpose-specific Change context for actual consumers. Start with a fresh person or deterministic client understanding a selected Change version, including original/current intent, applicable Check assessments, exact references and honest gaps. Combining richer histories with the opening-only ledger needs an explicit successor contract; old profiles do not silently gain operations or migrate. Do not require a rich UI, model summary, generic query engine or speculative indexing framework.
5. Measure representative cold and warm backend workloads, including both many small Change files and longer operation histories, before choosing extra caches/indexes. Include authorization and accepted-prefix validation costs, bytes read/decoded, memory and projection work, not only the final rendering time.

These are successive cohesive capability increments, not parallel writers of the same persistence contract. The first opening assignment remains bounded to its selected single-slot profile; later operations, ledger/navigation/context work requires its own consumed interfaces and acceptance. There is no retrospective requirement that the opening fixture implement the whole foundation gate. The [lifecycle milestones](../system/components/change-format.md#lifecycle-milestones-and-execution-admission) define commitment and execution boundaries without a universal Stage field or mandatory ceremony. They do not change frozen opening wire/recovery rules or retained native meanings. Select the successor grammar through the worked consumers rather than freeze a speculative complete enum, workflow engine or archive layout.

Before integrating product agents, demonstrate a useful model-free ledger workflow, exact and bounded operation retrieval, context reconstruction from accepted history and retained references, restart/retry correctness and measured behavior under a declared workload. Rebuildable acceleration may be lost without changing accepted truth; missing acceptance control cannot be treated as an absent cache. Publish limits and counterexamples rather than an unmeasured claim of efficiency. Multi-user transfer, hostile-host protection and remote custody retain separate qualification gates.

The original foundation research addressed **operation-record layout/addressability** and **navigation/projection access paths**. The selected format-first design extends that focus to lifecycle, prioritization and composition while preserving existing consumed formats and meanings. Compatible optimizations do not introduce new semantics; successor semantics require their own adopted contract. The [Pi 1.1.0 follow-up](../system/research.md#pi-110-session-format-follow-up) informs history/context separation, not a replacement acceptance backend. Resolve navigation tradeoffs with worked consumers and the [State read contract](../system/components/state.md#structured-history-access-and-context-projections).

### Semantic navigation model selection

Read-only candidate research can proceed while the deterministic foundation is developed; selecting a model is not a prerequisite for known-reference navigation or context reconstruction. Record agreed product semantics before choosing an adapter, and keep candidate evidence in [research](../system/research.md#semantic-and-discovery-references). Bounded ledger discovery is a candidate semantic consumer, not a mandatory first integration or automatic intent adoption mechanism. This is an optional consumer of the [State read/discovery contract](../system/components/state.md#bounded-semantic-discovery), not a relaxation of the starting profile or release gates.

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

### Guarded-effect validation fixture

Use a **fresh, disposable application-owned SQLite notice resource** for the first guarded-effect fixtures. SQLite is the real native resource used for validation, not a replacement for JSONL Change history, a requirement that applications adopt SQLite, or a repository-publication binding. Keep legacy SQLite intake/continuation/candidate profiles frozen. Use the existing dependency rather than introducing another storage package.

The fixture must condition its notice update on the expected revision and atomically retain an attributable native receipt with the resource update. JSONL remains responsible for the durable attempt and observed outcome. Current native access, Change authority and resource policy remain conjunctive. Resource-policy grants/revocations are transactionally serialized; do not claim that chmod revokes an already-open descriptor. Original-resource custody and complete receipt retention must be established before missing receipts permit any retry. Unknown outcome or lost custody stays unresolved, never inferred from matching desired values.

This selection alone does not freeze a public API, persistent profile, byte format or numeric bound. The [guarded-effect fixture contract](../system/components/guarded-effect-fixture.md) selects the fresh source composition and its exact boundaries; consume it with the minimal effect/Trace path before source acceptance. Ordinary source tests may use their own newly created fixtures; standalone qualification, actual host events, release activation and controller handoff retain their separate gates. Passing the fixture is not repository dogfood or exact-release qualification.

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

## Phase 4 — Integrate Pi for a concrete user workflow

**Proposition H5:** a user can pursue a bounded Change through a qualified Pi integration while the native engine retains intent, current authority, exact decisions/evidence and durable continuation independently of the conversation.

Start from supported deterministic operations and an actual consumer. Pi tools/commands/Views use the shared client/host boundary; Codemode composes exposed tools rather than importing the SDK inside QuickJS. Reuse Pi's interaction and execution machinery, not a new agent stack. A model or worker is needed only where that workflow consumes it. Define exact inputs, scope, attempt/result identity, disclosure, limits, cancellation and cleanup. Qualify additional containment before untrusted execution; unavailable enforcement cannot be replaced by a prompt or hook.

Select the application's actual capability/result contract, not a universal connector framework. If the consumer is software development, retain the separately required repository binding, software Checks, independent candidate assessment and guarded publication. Multi-file effects and self-development add their own native concurrency, partial-outcome and controller gates; they are not implied by the initial Pi-user audience.

**Positive witness:** an existing Pi user installs the exact integration in a disposable external project, creates/inspects and continues a supported Change, obtains required decisions, performs the supported bounded work and understands outcomes/unknowns from a fresh authorized context without relying on private conversation memory. No SDK programming is required from the user. The actual witness selects only supported operations and declared interruption behavior.

**Required challenges:** unsupported runtime/profile or tool exposure, stale intent/plan references, denied native or Change authority, misleading/unavailable context, loss after native acceptance, cancellation versus proven cleanup, missing evidence and no effect during inspection. Include executor/credential escape and candidate/publication cases where the selected workflow claims those boundaries.

**Advance only with:** combined native/client/Pi evidence for the exact installed closure and host assumptions under the [distribution contract](../system/components/package.md#user-distribution-and-deployment). If the capability governs software development, the [self-development gate](../system/components/package.md#first-self-development-delivery-focus) additionally requires an immutable external qualified controller, activation and explicit handoff for a later candidate. This checkout never governs itself. No phase label authorizes installation, live inference, privileged setup or a runtime experiment.

## Phase 5 — Generalize only from demonstrated need

**Proposition H6:** the core contract transfers to an additional use case without hidden lifecycle authority or invented native guarantees.

This is a set of independent capability increments, not a requirement to implement the entire future product at once. Each depends on Phases 1–3 and only the additional capabilities it actually consumes; it need not wait for Phase 4 when it uses no worker.

| Intended capability | First falsifiable question and evidence boundary |
| --- | --- |
| Another native backend/application | Can a substantially different native operation use the same Change contract while preserving its own authority, concurrency and recovery limits? Test the real binding, not a second mock. |
| User Kernel/domain Check authoring | Can adopted policy vary without weakening engine/native invariants or changing old result meanings? Test legitimate revision and attempted self-exemption; custom code adds containment obligations. |
| Semantic routing or automatic binding discovery | Does it improve a concrete workflow over explicit typed input/bindings without missed obligations, invented resources or unauthorized effects? Retain wrong/ambiguous cases and total cost. |
| Parallel Work or richer console | Does it reduce a measured coordination/operator problem while preserving exact authority, dependencies, conflicts and understandable unknowns? Do not build a scheduler or UI for an unobserved bottleneck. |
| Related Changes, consolidation and aggregate conclusions | Can typed relationships and explicit adoption preserve selected intentions, required results and source histories without concatenating logs, implied cross-file atomicity, hidden access grants or automatic parent completion? Missing grounds and conflicting combined plans remain explicit. |
| Ledger working set and priority | Can attributable selection/reprioritization revisions guide eligible Work without rewriting history, silently overwriting concurrent decisions or erasing obligations? Priority remains contextual, distinct from dependencies and authority. |
| Archive and restore | Can an explicitly configured storage relocation preserve accepted bytes, custody, retry associations and retained grounds through interruption? Restore is not execution or automatic resumption; active-only Views come first and no archive layout is selected. |
| Borrowing, forks and confidential sharing | Can exact individual material and continuation transfer without two active authorities, lost attribution or expanded disclosure? Qualify custody/revocation limits, not merely transport. |
| Monitoring and automation | Can authorized observations trigger bounded Changes without duplicate effects, stale delegation or hidden event gaps? A source event is not approval. |
| Learning and reusable procedures | Does adopted evidence-backed guidance improve a later independent task without rewriting intent or self-authorizing policy? Compare against a relevant baseline and retain contrary outcomes. |
| Standalone client, hosted/shared deployment or new platform | Does a concrete audience need it, and does the exact deployment establish custody, disclosure, credentials, synchronization/recovery and platform guarantees while doing useful work? A portable format or prior Landlock/BPF/VM analysis is not qualification. |

A capability that fails its proposition returns to revision or remains unavailable. It must not impose untested machinery on the supported core. Record accepted durable changes in the relevant Wiki contract; retain experiment limits in research/evidence and execution state in Change/Work or the temporary note.

## Validation discipline and non-goals

Use ordinary `#[test]` functions and `cargo test --locked`; run `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings` before native acceptance. Use real integration tests for storage, processes and native effects. Run `npm test` only for retained adapter changes or their integration boundary. The [testing policy](../system/components/package.md#testing-policy) governs tool selection and exact scope.

No test-count target, documentation-wording test, blanket coverage quota, speculative framework, broad mechanism survey or mandatory live inference follows from this plan. Retain regressions for consequential authorization, identity, retry/recovery and cleanup failures. Evidence records distinguish passed, failed, unavailable and untested; an empty diagnostic cache is not proof of a ready analyzer.

This plan is not evidence of an implemented schema, host, sandbox, migration, adapter or release. It authorizes no privileged setup, external artifact acquisition, paid inference, activation or controller handoff. Each source slice must consume its selected profile contract and return actual evidence before the dependent capability advances.
