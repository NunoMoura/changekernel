# CodeWiki Refactoring Plan

## Purpose and current checkpoint

This plan ratifies the deletion-first path from the current replay-qualified DSH Runtime slice to the production CodeWiki architecture. It is the implementation roadmap, not a compatibility promise and not canonical runtime input.

Current green base: `6c80222` (`refactor: secure DSH code mode`). Slices 3B through 15 prove stable path-independent Knowledge identity, reducible Knowledge Effects, deterministic materialization and atomic desired-state application, immutable Change-scoped Planning and canonical Work Graph, Work Unit Candidates and private integration, aggregate Review and guarded delivery, Project Context Snapshots, frozen Gate Evaluation Packages, persistent Session continuity, durable DSH completion, controlled Goals, stage-aware compaction, user-authorized role routes, Work Unit Model Assignments, typed recovery, a private provider broker, authenticated provider-call evidence, credential-free live qualification, secure Code Mode, qualified inner and outer containment, adversarial qualification, and workload-specific execution benchmarks. The Slice 16 candidate proves temporary Pi/DSH parity, moves standalone daemon ownership into Project Server, deletes the Pi execution tree and `./pi-sdk`, and retains Pi only as an optional Client integration. Credential-bearing provider adapters, optional Switchyard external qualification, and final product completion remain.

The Knowledge Base is intended design truth. Source and tests remain executable truth until each slice lands. Every temporary mismatch must be explicit and short-lived.

## Delivery rules

1. Create an exhaustive HEAD-anchored clean-cut manifest before each structural slice. Manifests are audit-only and never runtime or package inputs.
2. Prefer breaking ownership cuts. Do not retain aliases, compatibility barrels, duplicate contracts, selectors, route fallbacks, `Work Item` terminology, rolling-planning adapters, or a permanent Pi/DSH engine switch.
3. Ship one green commit per slice. Every changed line must belong to the slice.
4. Preserve canonical bytes, deterministic identity, expected-head compare-and-swap, authority, provenance, replay, recovery, and effect boundaries.
5. Update Knowledge, source, tests, README, exports, package smoke, and changelog together when executable behavior changes.
6. Use Pi-native development tools in this repository. Never load or dogfood CodeWiki here. Test the packaged extension only in disposable external projects.
7. Stop rather than fabricate a Candidate, Result, integration, transition, receipt, or effect when required evidence is absent or stale.

## Ratified architecture

```text
CodeWiki Project Server
  -> Runtime
    -> qualified outer Run Sandbox
      -> authenticated Run Process
        -> CodeWiki DSH Adapter
          -> exact pinned DSH AgentLoop
            -> admitted qualified inner Code Runtime
            -> authenticated host-local private provider broker
              -> exact model provider route
```

Project Server owns project meaning and authority. Runtime owns bounded execution and Runtime-authored receipts. DSH remains an in-process library inside authenticated empty-environment Run Processes and never speaks the Runtime protocol directly.

### Four Stage Loops

```text
Decision(change)
  -> Planning(change)
    -> Implementation(work-unit-1..N)
      -> Review(exact aggregate change lineage)
```

Decision, Planning, Implementation, and Review produce Candidates. Checks independently judge exact Candidates. Gates reduce completed Results. Project Server alone applies canonical Knowledge and graph changes, Claims, Assignments, model-route authorization, integrations, lifecycle transitions, and protected effects.

### Harness Agent and role routes

The user-selected Harness Agent is the primary interactive DSH-backed Agent, not a fifth Stage Loop, Worker, Check, Review authority, or Project Server coordinator. It submits Decision and Planning Candidates through exact role-scoped Runs. Decision and Planning inherit its route by default. Review may inherit the same provider/model configuration but always uses a fresh independent producer Session. Implementation Workers use a separate user-authorized route pool and explicit escalation graph; Model Checks use Check-owned routes.

Harness Agent may inspect canonical Implementation and Review outcomes for user explanation, but observation is selective and asynchronous. Project Server supplies coalesced current Work Unit progress, stop or conflict facts, compact Review outcomes, and exact report references rather than injecting every passing report or superseded failure. Exact relevant Review Results are rehydrated into Harness producer context only when typed ownership returns work to Decision or Planning. Harness Agent never authors, rewrites, or forwards Check feedback, and its availability never blocks Workers, Checks, integration, Review, or delivery.

### Top-down Knowledge and realization

Knowledge is authoritative for current accepted desired Product, System, and Design meaning. Source and tests establish realized behavior, Git establishes exact artifact history, Change explains accepted transitions and realization lineage, and Alignment compares these categories without collapsing them.

```text
User natural language
  -> harness-authored Change revision
  -> exact Decision Candidate
  -> independent Checks and authorized confirmation
  -> accepted Knowledge State
  -> Planning obligations
  -> Work Unit source and test realization
  -> aggregate Review
  -> exact Git and delivery lineage
```

Every independently addressable Knowledge subject has one immutable path-independent semantic ID; independently mutable facets may also have stable IDs. Labels, aliases, headings, Markdown locations, source paths, and renderer versions are locators or presentation, not semantic identity. IDs remain resolvable after retirement and are never reused. Splits, merges, replacement, and supersession are explicit transitions.

A Change revision carries either an atomic reducible Knowledge transition or explicit unchanged-Knowledge references. A transition uses only `set` with one complete post-state artifact or `retire`, targets stable subject or facet identity, and binds an exact prior digest or expected absence without copying current bytes. The harness supplies irreducible semantic content once. Project Server derives handles, canonical references, effect and content digests, affected projections, byte spans, application-plan identity, and resulting state. Markdown and YAML remain the agent-friendly OKF interchange; generated narration and indexes remain disposable projections.

### Decision

Decision evaluates one exact proposed Change against accepted Knowledge State and the accepted active Changes. The Stage Producer directly submits its irreducible disposition and rationale for the exact revision without repeating the revision's Knowledge Effects; Project Server materializes the complete Candidate. Model Checks judge the admitted Candidate and never author or mutate it. The required invariant is no unresolved semantic contradiction, not no overlap.

Project Server expands any revision-authoring context handles before immutable revision identity. Before any Decision Check runs, it resolves the exact revision, derives machine-owned fields, validates stable Knowledge targets and prior-state preconditions, and deterministically compiles the complete Effect set. The immutable Candidate checkpoint binds base and projected Knowledge State digests, compiler identity, application-plan digest, exact Markdown or YAML projection identity, accepted active Changes, WorkState, producer Run, and receipt. Compilation failure rejects Candidate admission before model tokens are spent. Clients and Checks render or consume current state, desired state, and diff from these artifacts rather than model-authored repetition.

The default Decision policy includes an `active_change_compatibility` Model Check over:

- the exact Decision Candidate and projected Knowledge result;
- every semantically relevant accepted nonterminal Change revision;
- deterministic complete accounting for all other accepted active Changes;
- explicit `depends_on`, `coordinated_with`, `duplicates`, `supersedes`, and conflict relationships;
- stable Effect targets and shared invariant relationships;
- the accepted Work Graph projection;
- complete comparison coverage;
- exact accepted active Changes, Knowledge State, and WorkState digests.

Stable Effect targets permit deterministic overlap indexing and bounded expansion, but disjoint targets alone cannot prove semantic compatibility. The model Check adds semantic comparison and cannot replace explicit relationships, compare-and-swap, Planning graph validation, or integration proof. Incomplete or uncertain coverage stops or expands the Gate input rather than silently passing.

A passed Decision Gate grants no semantic authority. An authorized actor confirms the unchanged Candidate and Gate digest against current accepted active Changes, Knowledge State, and WorkState heads. On confirmed `approve`, Project Server atomically appends the accepted Change operation, applies the already-compiled Knowledge Effects, commits resulting Knowledge and WorkState identities, and advances to Planning by expected-head compare-and-swap. `reject`, `defer`, and `withdraw` never apply proposed Effects. If any bound Candidate, compiler, target, or accepted-state input changes after evaluation, affected Results become stale.

Conflict ownership is layered:

| Conflict | Owner |
| --- | --- |
| Contradictory intended states, duplication, supersession | Decision |
| Dependencies, path overlap, execution ordering | Planning |
| Live workers, machines, consent, privacy, budget | Project Server scheduler |
| Actual patch, merge, build, and cross-unit interaction | Integration and Review |

### Planning

Planning operates on one ratified Change. It produces one immutable Change-scoped Work Graph delta, not a whole-project replacement plan.

A Planning Candidate contains:

- exact ratified Change revision;
- observed Work Graph digest;
- singly owned Work Units;
- internal and cross-Change dependency edges;
- explicit accepted Knowledge Effect and acceptance-requirement coverage;
- independently judgeable outcomes;
- component and path scope;
- technical and Knowledge obligations;
- required capabilities, tools, Skills, custody, and verification;
- strategic parallelism and declarative resource requirements;
- aggregate Review obligations.

Project Server owns the canonical global Work Graph as the union of accepted Change-scoped deltas. A passing Planning Candidate is CAS-appended only when its Change revision and graph head remain current. Planning never selects a worker, machine, provider, live capacity, or schedule. It cannot rewrite unrelated accepted, claimed, or executing units.

Changing accepted decomposition requires an explicit Planning amendment owned by that Change. Shared foundational work should normally become its own Change with dependency edges rather than a multi-owned Work Unit.

Delete rolling multi-Change Planning, planning horizons, Sprints as canonical execution plans, participant-Change epochs, active-work disposition rewrites, and the project-scoped planner Session. Optional future cross-Change optimization is advisory and may propose explicit traced amendments; it never silently replaces the graph.

### Work Unit Implementation

Every Work Unit has exactly one owning Change and one logical Implementation continuity. Independent ready units may execute and be judged concurrently. Project Server resolves each scheduled Assignment against only the user-authorized Worker route pool and records Work Unit Model Assignment `1.0.0`, binding exact provider/model/options, policy snapshot, prior typed attempts, remaining budgets, and rationale. Planning declares requirements and risk but cannot select a model. A route change occurs only between Runs and requires a fresh Session with canonical rehydration; broker-owned transport retries do not consume Project Server escalation attempts.

Each Work Unit Candidate binds:

- exact owning Change and Work Unit;
- Assignment, Claim, Workbench, and custody;
- dependency outputs and pinned base;
- resulting tree or patch and changed paths;
- realized source and tests, covered Knowledge Effect and requirement IDs, configuration, and expected heads;
- Evidence, usage, Execution Ledger, raw artifact, and Run Receipt;
- exactly one producing Run.

One resolved stage-wide Implementation Check Pack policy applies to every Work Unit Candidate. Planning, workers, routes, and models cannot select Work Unit-specific Packs. Candidate-specific evaluation packages vary only through exact owning Change acceptance slice, Work Unit obligations, base, dependency outputs, changed paths, Evidence, and receipts. Deterministic applicability may report `not_applicable`; it does not create another policy.

A failed Gate returns the exact Project Server-recorded Results and Gate Report directly to the same Work Unit continuity. A passed Gate qualifies only that Candidate. Each completed Work Unit produces and gates its own immutable Candidate immediately; Checks never wait for all Workers. Unit Gates prove local realization, while final aggregate Review proves cross-unit and integration behavior. Project Server then attempts expected-head-safe admission to the Change-owned private integration lineage. Gate pass, integration pending, integrated, stale, and conflicted are distinct states. Changed bytes, base drift, claim loss, custody loss, or merge conflict requires a new Candidate and Gate.

No long-lived Change-level model coordinator owns Implementation. Project Server, WorkState, and the canonical Work Graph coordinate units. If several agents collaborate on one unit, split the unit or make one Run the sole Candidate producer while subordinate outputs remain contributions and Evidence.

### Aggregate Review

A Change remains in Implementation until all required Work Units:

- have current passing Gates;
- integrate successfully;
- satisfy dependency closure;
- cover accepted Knowledge Effects, acceptance requirements, and Planning obligations;
- yield one exact immutable aggregate Change lineage head.

Review uses a fresh independent Session and judges that exact aggregate head. It proves complete realization of the ratified Change's Knowledge Effects and acceptance requirements, cross-unit behavior, aggregate-only criteria, full build and integration behavior, scope discipline, provenance, and delivery readiness. Work Unit Gates cannot certify merged bytes.

A Review failure normally reopens affected Work Unit Implementation. A decomposition defect requires an explicit Planning amendment. Changed or contradictory meaning requires Decision. Project Server owns these typed routes; Checks and models do not select lifecycle transitions. Harness Agent observes the compact Review boundary and receives exact relevant Results only when work returns to Decision or Planning; it does not mediate Review or Work Unit feedback.

Only a fresh passed Review Gate plus separate current authority permits protected delivery.

## Canonical ownership

### Project Server owns

- Actor, project, delegation, authorization, and confirmation;
- accepted active Changes and semantic relationships;
- immutable Knowledge subject and facet identity, the initial seed, and accepted Knowledge State;
- Change Trace, globally ordered Knowledge Effect reduction, and canonical WorkState;
- producer context-handle expansion, deterministic Knowledge transition compilation, projected-state preview, and atomic confirmed application;
- Project Context Snapshot construction and authorization;
- Gate Evaluation Package construction;
- canonical global Work Graph and Change-scoped delta application;
- readiness, durable queueing, Worker Offers, Claims, Assignments, placement, custody, and policy;
- private Change integration lineages and aggregate completion;
- DSH logical-continuity bindings, exclusive Session leases, and expected-head CAS;
- Candidate admission, Gates, typed feedback routes, transitions, and guarded effects;
- durable evidence retention and receipt admission.

### Runtime owns

- exact Runtime Build resolution and admission;
- authenticated Run Process launch and supervision;
- bounded process lifetime, cancellation, quiescence, and exit observation;
- authorized context snapshot mounts and private protocol transport;
- Execution Ledger and raw-log capture;
- Runtime-authored Run Receipt creation from validated terminal facts;
- no project meaning, Work Graph, queue, Claim, Assignment, Gate, transition, or effect.

### DSH owns

- AgentLoop request, streaming, tool pairing, and continuation mechanics;
- persistent Agent Session event history;
- checkpoint and compaction mechanics;
- cancellation convergence;
- optional controlled Goal continuation and within-Run ephemeral fan-out;
- no CodeWiki lifecycle, canonical state, scheduling, judgment, or authority.

### Checks owns

- Check and Pack contracts;
- deterministic resolved stage-wide policy snapshots;
- Code and Model Check execution coordination;
- completed Results and exact cache identity;
- Gate Reports;
- no production, route selection, lifecycle transition, or effect.

## Context and evaluation boundary

### Project Context Snapshot

A `ProjectContextSnapshot` is an immutable content-addressed locally queryable producer substrate built by Project Server. It contains normalized OKF Knowledge State and projection identities, stable subject and facet IDs, bounded current-content handles, Alignment and provenance, active Changes and their Effect targets, accepted Work Graph and WorkState projections, prior Gate feedback, repository content, Evidence and Results, complete manifest and coverage, and exact query-engine identity. Semantic context identity excludes observation time and freshness metadata so identical bytes can reuse content-addressed caches; a separate observation envelope binds capture time, coverage, and staleness.

A producer Session may switch from snapshot C1 to C2 only at controlled idle turn boundaries. Every query records its snapshot digest. Old snapshots and chunks remain reproducible while referenced. Runs mount context read-only and receive no live Project Server storage handle, ambient working-tree fallback, environment, credentials, or unrestricted network.

Typed local services should express CodeWiki semantics rather than arbitrary SQL or graph languages:

- `knowledge_query`;
- `alignment_query`;
- `project_state_query`;
- `repository_query`;
- `project_query_batch`;
- bounded high-level change-delta discovery.

`knowledge_query` returns stable semantic identity, exact content and Knowledge State digests, and short snapshot-bound handles that revision-authoring submissions may reuse without echoing paths, old bytes, or full digests. Project Server expands handles before immutable revision identity. Direct and batch primitives remain available to trusted composition. DSH Code Mode may expose only generated typed SDK bindings once a secure Code Runtime qualifies.

### Gate Evaluation Package

A `GateEvaluationPackage` is a separate immutable authoritative Check input package frozen only after Candidate checkpoint. For Decision it binds the exact Candidate, Change revision and Knowledge Effects, base and projected Knowledge State, compiler and application plan, exact current-to-projected view, accepted active Changes coverage, WorkState, Alignment, Evidence, Results, Check Pack files, configuration, routes, and declared inputs. Other stages bind their exact repository tree, base, accepted Knowledge targets, requirements, and realization lineage as applicable.

Checks receive no producer context handle, producer Session, live Project Server handle, or undeclared input. Model Checks remain tool-free. The current `StageContextBundle`, `query_stage_context`, and batch replay path are qualification evidence, not the final production context contract.

## Sessions, Runs, Candidates, and checks

```text
Stage != logical continuity != DSH Agent Session != Run != process/container
```

Provisional continuity keys are now ratified as:

```text
decision:<change-id>
planning:<change-id>
implementation:<work-unit-id>
review:<change-id>:<implementation-lineage>
```

A producer Session may span several bounded Runs and Candidate attempts. Every Candidate has exactly one producing Run. The Stage Producer submits its Candidate directly; Check Runs are independent consumers and cannot create or amend it. A Run may instead terminate `blocked`, `cancelled`, or `failed` without a Candidate.

Only one writer may execute against a DSH Agent Session. Project Server must issue an exclusive lease and expected Session head. Run Request and Receipt must bind logical continuity, Session ID, expected head, resulting head, exact Runtime Build and protocol, context snapshot, stage and subject, feedback, raw artifact digest, ledger head, usage, and terminal state.

Same-Session resume requires the original Runtime Build and protocol. Build or protocol change requires Session rollover with deterministic canonical rehydration.

Every top-level Model Check invocation uses one fresh isolated tool-free Agent Session. Independent Model Checks may run in bounded parallel. A retry always uses another fresh Session. Model Checks do not compact, continue producer conversation, share results, or use DSH production tools. Code Checks do not use DSH.

## Compaction and continuity

DSH owns token measurement, pressure detection, oversized tool-result pruning, event replacement, and retained raw Session history. CodeWiki owns stage-aware semantic summarization, authority promotion, deterministic rehydration, predictive pressure policy, and rollover.

Authority-relevant facts must leave model conversation state before compaction. Predict pressure from current envelope plus expected next-Run input, tool-result reserve, and Candidate-output reserve. Compact only while idle, especially after durable Candidate/Results/feedback, after distilled fan-out, before material or Session-head switches, or before pressured continuation.

Never compact during an open turn, unmatched tool pair, pending child work, before Candidate freezing, solely because a process exits, or unconditionally after every Candidate.

Session rollover is required for build/protocol incompatibility, corruption, repeated summary drift, role change, unrecoverable compaction lock, or benchmarked quality decline.

## Isolation and provider boundary

Production requires two separately qualified boundaries:

1. Outer whole-DSH Run Process containment protecting host, canonical repository, Project Server, credentials, protocol descriptors, and protected effects.
2. Inner model-authored Code Mode process/container protecting trusted DSH Adapter, Session state, material, evidence stream, and protocol from model code.

The outer sandbox permits read-only Runtime Build, authorized material, and one exact host-local provider-broker Unix socket, bounded private scratch, and an Implementation-only Workbench. It denies canonical writes, protected refs, ambient environment, credentials, unrestricted network, inherited authority, and unbounded resources.

The inner sandbox permits no filesystem, network, environment, inherited descriptors, DSH Session files, or protocol pipes. It exposes only host-admitted typed async bindings and enforces hard termination plus cumulative call and byte budgets.

DSH's worker-thread Code Runtime is containment, not a security boundary, and cannot qualify. Official DSH filesystem sandboxing also does not solve network or whole-process isolation. CodeWiki therefore supplies a fresh-process TypeScript Code Runtime behind an exact pinned Bubblewrap and `prlimit` policy, with Node's Permission Model used only as defense in depth. Production admission revalidates real executable paths, versions, and SHA-256 digests; unavailable or drifted containment fails closed without a worker-thread or in-process fallback.

DSH receives no provider credentials or unrestricted provider egress. Runtime supplies one opaque expiring Run- and route-scoped capability to a host-local provider-neutral broker. Unsandboxed qualification may use TCP loopback; network-isolated production Run Processes use one explicitly mounted Unix-domain socket. The broker owns credentials, billing integration, provider networking, bounded transport retry or equivalent-endpoint failover, normalization, provider request IDs, and host-side receipt retention. Authenticated receipts bind broker implementation/configuration, exact request and response digests, selected provider/model, transport attempts, usage, cancellation or typed failure, and receipt identity. Project Server alone interprets those outcomes.

Replay remains mandatory deterministic CI. Credential-free host-local mock infrastructure separately qualifies TCP-loopback and sandbox-mounted Unix-domain streaming, retry ownership, cancellation, route mismatch rejection, Run Process transport, and Execution Ledger closure without committed credentials or paid calls. Optional NVIDIA NeMo Switchyard remains a replaceable backend and begins only as exact pinned loopback passthrough with Switchyard retries disabled and selected-target equality. Dynamic classifier, stage, escalation, and advisor routes remain deferred.

## Completed foundation

- [x] Four Stage Loop and Checks/Gate ownership cuts.
- [x] Exact Candidate, Result, Gate, Change Trace, authority, and expected-head foundations.
- [x] Project Server/Runtime ownership cut.
- [x] Exact DSH `0.1.0-rc.6` pin and reviewed-source provenance.
- [x] Authenticated DSH Run Process and isolated replay Session vertical slice.
- [x] Self-contained content-addressed Runtime Builds and handshake admission.
- [x] Runtime-authored receipt contracts and process supervision.
- [x] Durable Runtime Build, Execution Ledger, raw-log, evidence-CAS, and receipt stores.
- [x] Immutable replay `StageContextBundle`, direct and batch DSH tools, budgets, cursor integrity, and ledger capture.
- [x] Packed-install, production audit, typecheck, build, package smoke, and replay qualification for checkpoint `833f838`.
- [x] Ratified incremental Change-scoped Planning, Work Unit Implementation, shared Implementation policy, and aggregate Review in Knowledge and this plan.
- [x] Ratified top-down stable Knowledge identity, reducible Change Effects, direct Stage Producer Candidate submission, deterministic Project Server materialization, and end-to-end realization lineage in Knowledge and this plan.

## Refactoring sequence

### Slice 1 — Ratified Knowledge and clean-cut audit

- [x] Replace rolling Planning intent with one Change-scoped Work Graph delta.
- [x] Ratify Decision accepted active Changes compatibility and CAS admission.
- [x] Ratify Work Unit-granular Implementation and same stage-wide Implementation policy.
- [x] Ratify private Change integration lineage and aggregate Review.
- [x] Ratify Change-scoped Planning and Work Unit-scoped Session continuity.
- [x] Ratify Project Context Snapshot versus Gate Evaluation Package.
- [x] Rename Knowledge terminology from `Work Item` to `Work Unit` without alias.
- [x] Validate all Knowledge links, limits, diagrams, and source-pattern coverage.
- [x] Commit documentation-only green checkpoint.

### Slice 2A — Executable Work Unit vocabulary

- [x] Create an exhaustive HEAD-anchored vocabulary manifest after Slice 1.
- [x] Rename executable `WorkItem`, `workItem`, `work_item`, `work-item`, and user-facing terms to `WorkUnit`, `workUnit`, `work_unit`, and `work-unit` in one breaking cut.
- [x] Rename Change Trace operation kinds, payload fields, graph facts, query families, Claims, Assignments, effects, projections, fixtures, tests, and UI vocabulary without aliases.
- [x] Advance affected Change Trace, Planning, WorkState, Alignment, Change Intake, Review, Assignment, dispatch, integration, effect, and coordinator schema identities.
- [x] Regenerate exact canonical fixture bytes and identities.
- [x] Commit one green executable vocabulary checkpoint.

Success: no active executable or Knowledge `Work Item` spelling or parser survives; historical changelog prose remains history rather than a compatibility surface.

### Slice 2B — Rolling-planning deletion

Create a new exhaustive HEAD-anchored deletion manifest after Slice 2A commit.

- [x] Delete `src/changes/trace/rolling-planning.ts` and rolling epoch contracts, reducers, views, active-work dispositions, planning horizons, participant-Change semantics, Sprint execution-plan ownership, and obsolete tests.
- [x] Replace multi-Change Planning Candidate schemas with one Change-scoped graph-delta schema.
- [x] Remove contributing ownership fields; enforce exactly one owning Change per Work Unit.
- [x] Preserve cross-Change dependencies through explicit graph edges.
- [x] Update exports, package smoke, fixtures, and canonical protocol versions where bytes change.
- [x] Commit one green rolling-planning deletion checkpoint.

Success: no rolling-planning, horizon, participant, or canonical Sprint-plan compatibility surface remains.

### Slice 3 — Decision active-Change compatibility

- [x] Add exact accepted active Changes and accepted Work Graph projection to Decision Candidate evaluation inputs.
- [x] Add structured compatibility relationships and complete coverage.
- [x] Add default `active_change_compatibility` Model Check and deterministic overlap/accounting Check.
- [x] Bind affected Results to Candidate, accepted active Changes, relationship, graph, pack, route, and configuration identity.
- [x] Require accepted active Changes expected-head CAS during confirmation.
- [x] Test concurrent conflicting Decision Candidates so only one stale-free confirmation can commit.
- [x] Commit one green Decision accepted active Changes checkpoint.

Success: unresolved semantic contradiction cannot pass or race through stale confirmation; dependencies and resource contention remain outside Decision authority.

### Slice 3B — Stable Knowledge identity and reducible Change revisions

- [x] Capture a clean-cut manifest for current path-derived Knowledge identity, `ChangeRevisionIntent.currentState` and `desiredState`, `ChangeRevisionKnowledgeImpact`, Decision Candidate materialization, OKF indexing, source ownership, trace protocol fixtures, and all consumers.
- [x] Introduce immutable path-independent `codewiki_id` identity for every addressable Knowledge subject, using one canonical human-readable `cw:<kind>:<stable-key>` namespace, and stable facet keys where one complete post-state can change independently. Migrate the native Knowledge bundle, diagrams, indexes, source maps, queries, fixtures, and tests in one breaking cut. Labels, aliases, headings, and paths remain mutable presentation; retired IDs remain tombstoned and cannot be reused.
- [x] Define optional `codewiki_facets` frontmatter as a strict non-overlapping map from stable facet key to one current lossless structural locator such as a heading path, frontmatter pointer, or YAML pointer. Canonical facet identity is subject ID plus facet key; the locator belongs only to projection identity and may change without changing semantic identity. Candidates target IDs and keys, never locators.
- [x] Replace prose-only Knowledge impact with one strict `KnowledgeTransition` union: either a canonical atomic non-empty Effect set or explicit unchanged-Knowledge references plus rationale. Each Effect targets one subject or facet, binds an exact prior digest or explicit expected absence, and uses only `set` with one complete post-state artifact or `retire`. `set` may create or replace; `retire` requires existing state.

```ts
type KnowledgeTransition =
  | {kind: "effects"; effects: readonly KnowledgeEffect[]}
  | {kind: "unchanged"; refs: readonly KnowledgeTargetRef[]; rationale: string};

type KnowledgeEffect =
  | {action: "set"; target: KnowledgeTargetRef; expected: Sha256Digest | "absent"; postState: CanonicalInlineSemanticArtifact}
  | {action: "retire"; target: KnowledgeTargetRef; expected: Sha256Digest};

interface KnowledgeTargetRef {
  readonly subjectId: string;
  readonly facetId?: string;
}
```

- [x] Define a strict versioned Knowledge post-state artifact inside `CanonicalInlineSemanticArtifact`: one declared `text/markdown`, `application/yaml`, or canonical JSON media type plus the complete bounded semantic-cell content. Project Server derives wrapper ID and digest; authoring input supplies only media type and irreducible content.
- [x] Canonical revisions store stable IDs, expected-state digests, and exact post-state artifacts, never transient context handles. Initial authoring APIs accept those canonical references directly. Slice 9 may add snapshot-bound handles as input shorthand expanded before revision identity. Effect IDs, content digests, topic sets, propagation closure, byte spans, plans, and result identities remain derived.
- [x] Replace `ChangeRevisionIntent.currentState` and `desiredState` with bounded human `problem` and `objective` summaries. Retain rationale, non-goals, alternatives, outcomes, and acceptance requirements where irreducible, but prohibit these fields from copying current Knowledge bytes or substituting for complete post-state Effects.
- [x] Delete authored `topicRefs` and `propagationRefs` from Effect transitions. Effect targets derive impacted topics and the compiler derives projection propagation. Keep stable Knowledge references only in the explicit unchanged variant.
- [x] Advance Change Trace Protocol directly from `5.0.0` to the Slice 3B contract `6.0.0`, Decision Candidate schema from the executable Slice 3 baseline `4.0.0` to the Slice 3B contract `5.0.0`, and every affected revision, WorkState, Alignment, query, operation, fixture, and digest identity in one clean cut without parser aliases.
- [x] Keep Change Trace JSONL and OKF Markdown/YAML storage boundaries. Store each bounded new post-state artifact once as a `CanonicalInlineSemanticArtifact`. Do not add Agent Notes, a second current-state store, model-owned byte offsets, fuzzy patches, generated propagation lists, or storage-format migration.
- [x] Make revision and Candidate schemas reject duplicate targets, ordered transform dependence, missing post-state for `set`, post-state for `retire`, no-op transitions, malformed prior-digest or absence bindings, invalid new IDs, and Effects combined with unchanged-Knowledge declarations. Preserve exact expected bindings for Slice 3C comparison with base Knowledge State.
- [x] Preserve the Stage Producer as direct Candidate source. Project Server materializes canonical Candidate identity from the exact revision and producer submission; Model Checks remain consumers only.

Success: every Change revision contains enough exact semantic information for deterministic reduction or explicitly proves no desired-state change; moving or relabeling Knowledge does not change semantic identity; arbitrary new prose appears once; current bytes and machine-owned fields do not appear in producer output; existing path-derived and prose-only contracts are deleted.

### Slice 3C — Deterministic Knowledge materialization and atomic acceptance

- [x] Implement a Project Server-owned pure Knowledge reducer and lossless materialization compiler over exact base Knowledge State, canonical Effect set, and compiler identity. Resolve stable subject and facet targets to current semantic cells and then to structural Markdown/YAML regions or generated projections; never grant canonical write authority to Runtime.
- [x] Derive Effect IDs, prior and post-state artifact digests, affected projection closure, exact byte spans, application-plan digest, resulting Knowledge State digest, and resulting projection digest. Apply same-file byte splices from the original base without overlap or parse-and-reserialize drift.
- [x] Separate semantic `KnowledgeStateDigest` from renderer-bound `KnowledgeProjectionDigest`. Formatting-only renderer changes may alter projections and provenance but not desired semantic identity.
- [x] Compile and validate the complete transition before Decision Checks. Freeze base and projected Knowledge States, compiler identity, application plan, exact current-to-projected view, and projection identity into Candidate checkpoint and Gate Evaluation Package. Expose Client current/desired/diff views from those artifacts outside model conversation history. Compilation failure stops admission before model execution.
- [x] Advance Change Trace Protocol from `6.0.0` to `7.0.0` and Decision Candidate schema from `5.0.0` to `6.0.0`. Extend Decision confirmation so authorized `approve` atomically appends the accepted Change operation, applies the unchanged compiled Effects, writes the resulting Knowledge checkpoint, advances WorkState, and records all synchronized heads under expected-head compare-and-swap. Other dispositions record meaning without Knowledge mutation.
- [x] Revalidate every target's expected prior digest or absence and all bound state at confirmation. Reject target, base, compiler, plan, or projection drift, overlap, fuzzy matching, partial application, and silent merge. An unchanged semantic transition may be deterministically recompiled only as a new Candidate checkpoint with fresh affected Results; never mutate a passed checkpoint in place.
- [x] Verify restart by reducing the initial seed plus globally ordered confirmed Effects and comparing it to the materialized Knowledge checkpoint. A mismatch stops recovery and mutation. Semantic reversal is a new Change; rejected, deferred, withdrawn, merely passed, and failed Candidates never enter accepted reduction.
- [x] Add deterministic admission limits for Effect count, post-state bytes, target authority, Markdown/YAML/OKF validity, reference closure, path and symlink safety, canonical ordering, and byte-reproducible output.
- [x] Replay representative history: the Project Server/Runtime ownership cut at `0d3b852`, the accepted active Changes terminology cut at `c433150`, one broad architecture ratification, and one defect fix with explicit unchanged Knowledge. Prove exact reconstruction, conflict rejection, and no model call after confirmation.

Success: an authorized confirmed Candidate applies exactly the bytes and semantic state judged by its Gate; no post-approval model interpretation exists; current and desired UI views come from bound artifacts; restart reproduces state byte-for-byte; stale or ambiguous targets fail closed; Project Server remains sole canonical effect owner.

### Slice 4 — Change-scoped Planning delta and canonical Work Graph

- [x] Add immutable Work Graph delta Candidate and exact accepted Knowledge Effect, unchanged-Knowledge, and acceptance-requirement coverage contracts.
- [x] Persist one accepted Planning delta per Change revision with explicit amendment lineage.
- [x] Build canonical global Work Graph from accepted deltas and current statuses.
- [x] Validate ownership, dependency existence, acyclicity, overlap ordering, resource declarations, active-work immutability, complete Effect and requirement realization, and aggregate Review coverage.
- [x] CAS-apply deltas against exact Change, Knowledge State, and graph heads.
- [x] Allow disjoint Change-scoped Planning producers to run concurrently; serialize only graph application.
- [x] Replace project-scoped Planning continuity with `planning:<change-id>`.

Success: accepting a new Change appends only its validated graph delta, covers every accepted semantic obligation, and never regenerates unrelated work or amends accepted Knowledge meaning.

### Slice 5 — Project Server readiness and scheduling cut

- [x] Derive ready Work Units from accepted Work Graph plus WorkState.
- [x] Keep Worker Offers, Claims, Assignments, placement, consent, privacy, custody, budget, and queue jobs exclusively in Project Server.
- [x] Remove Sprint and planning-session scheduling authority.
- [x] Preserve one exact Assignment per Work Unit attempt and one isolated Workbench.
- [x] Prove restart recovery and stale Claim/Assignment rejection.

Success: Runtime receives exact admitted Run Requests and owns no queue or placement state.

### Slice 6 — Work Unit Candidate and shared Implementation policy

- [x] Make Implementation subject one exact Work Unit and owning Change acceptance slice, including covered stable Knowledge Effect and requirement IDs.
- [x] Use one persistent `implementation:<work-unit-id>` DSH Session across bounded attempts.
- [x] Enforce exactly one producing Run per Candidate.
- [x] Resolve one stage-wide Implementation Check Pack policy and prohibit Work Unit-specific selection.
- [x] Build Work Unit-specific Gate Evaluation Packages under that shared policy.
- [x] Track `gate_failed`, `gate_passed`, `integration_pending`, `integrated`, `stale`, and `conflicted` separately.
- [x] Run independent Work Unit Code and Model Checks with bounded parallelism; keep one fresh Session per Model Check.

Success: unit Checks begin as each Candidate arrives, while Pack policy remains identical across units.

### Slice 7 — Private Change integration lineage and completion

- [x] Add content-addressed private integration lineage per Change.
- [x] Admit only fresh passing Work Unit Candidates by expected-head CAS.
- [x] Reject changed bytes, stale bases, missing custody, dependency drift, and conflicts.
- [x] Persist integration receipts and exact contributing Candidate identities.
- [x] Add deterministic all-required-unit completion reducer.
- [x] Freeze aggregate head only when Gates, integration, dependency closure, and accepted Knowledge Effect and requirement coverage are complete.

Success: no single unit Gate advances the Change; no partial lineage mutates protected target state.

### Slice 8 — Aggregate Review and feedback ownership

- [x] Bind Review to exact aggregate Change lineage, target base, ratified Change and Knowledge transition, resulting Knowledge State, accepted Planning delta, all Work Units, Candidates, Evidence, and Results.
- [x] Use fresh independent `review:<change-id>:<implementation-lineage>` Session.
- [x] Add default aggregate acceptance, cross-unit, full-build, integration, provenance, and scope Checks.
- [x] Invalidate all Review Results on aggregate-head change.
- [x] Route unit defects to affected Implementation, decomposition defects to explicit Planning amendment, and meaning defects to Decision through Project Server-owned typed rules.
- [x] Guard delivery with current authority and target-head CAS.

Success: Review proves the complete Change and no Work Unit Result is misrepresented as aggregate proof.

### Slice 8B — Top-down realization lineage and projection reduction

- [x] Project accepted Knowledge Effect and requirement IDs through WorkState, Planning coverage, Work Units, Implementation Candidates, source/test ownership, Evidence, aggregate Review, integrated trees, commits, delivery, and Alignment queries. Meaning changes return to Decision; later stages cannot amend accepted Effects.
- [x] Build an accepted-Effect target and invariant index. Mechanically account for every accepted active Change, expand full revisions only for overlaps, shared invariants, explicit relationships, and unknowns, and preserve complete coverage proof for the Decision Gate.
- [x] Classify every current `kb/**` fact as durable seed, accepted semantic cell, deterministic projection, or Git-derived realization. Keep compact Product/System/Design intent and contractual relationships in Knowledge; move repeated indexes, expanded dictionaries, expanded dossiers, status narration, migration notes, and drift reports to deterministic `views/**` projections.
- [x] Make retries, Review, and later stages reference immutable Candidate, Effect, requirement, and material digests instead of repeating prose.
- [x] Instrument source tokens, cached input tokens, model output tokens, tool-result tokens, repeated-byte ratio, new-byte ratio, Candidate-to-edit amplification, active-Change expansion, and cache hit rate per stage.
- [x] Benchmark full-document rewriting, unified diff, byte splice, structural section replacement, and semantic Effect encoding over representative terminology, architecture, and no-Knowledge-effect Changes.

Success: model output contains zero current-state bytes and one copy of each irreducible new fragment; one semantic Effect may update any number of deterministic projections; complete active-Change compatibility remains fail-closed with bounded expanded context; generated views remain rich while canonical authored Knowledge and repeated model context shrink materially.

### Slice 9 — Project Context Snapshot

- [x] Specify normalized context manifest, chunking, digest, retention, authorization, and query-engine contracts.
- [x] Include exact Knowledge State and projection identities, stable subject/facet IDs, current semantic-cell content, accepted Effect targets, source/test realization refs, and short snapshot-bound context handles.
- [x] Separate reusable semantic context digest from observation envelope identity containing `capturedAt`, freshness, coverage, and staleness; identical context observed later must remain cache-addressable without weakening fresh admission.
- [x] Decide full read-only repository mount versus derived index plus bounded file content through benchmark evidence.
- [x] Build Project Server snapshot construction and content-addressed reuse over Git blobs, lossless Knowledge parses, semantic cells, query results, and generated projections.
- [x] Mount authorized snapshots read-only in Run Processes.
- [x] Replace producer `StageContextBundle` transport and generic route lookup with typed local context services.
- [x] Preserve direct, batch, cursor, bounds, coverage, source refs, staleness, snapshot identity, and exact inner-result ledger capture.
- [x] Allow revision-authoring submissions to use short handles and expand them only against their exact snapshot before immutable revision identity; reject foreign or stale handles.
- [x] Add controlled idle-boundary snapshot refresh.

Success: producer queries are local, immutable, snapshot-bound, cache-efficient, and never proxy each read through Project Server; producer output can reference exact current context without repeating it.

### Slice 10 — Gate Evaluation Package

- [x] Define immutable Candidate-checkpoint package and declared Check-input projections.
- [x] For Decision, freeze exact Change revision and Effect set, base and projected Knowledge State, compiler and application plan, current-to-projected semantic view, accepted active Changes coverage, WorkState, Alignment, Evidence, Results, Check files, configuration, and routes.
- [x] For Planning, Implementation, and Review, freeze exact accepted Knowledge target and requirement lineage together with repository tree, base, WorkState, Evidence, and stage-specific realization inputs.
- [x] Resolve all producer context handles before package creation; prohibit handles and live Project Server access from Checks.
- [x] Bind Check cache and Gate identity to all package inputs, including compiler and projected-state identities where applicable.
- [x] Prove tamper, omission, staleness, compiler drift, target drift, and unknown-coverage failures.

Success: producer inquiry may refresh; Candidate judgment remains exact, immutable, and bound to the same semantic and byte result later eligible for application.

### Slice 11 — Persistent Session leases and multi-Run receipts

- [x] Persist logical continuity to DSH Session binding independently of process lifetime.
- [x] Add exclusive lease acquisition, expiry, cancellation, and expected Session-head CAS.
- [x] Extend Run Request and Receipt with continuity key, Session ID, expected/resulting heads, material digest, feedback, raw artifact, ledger head, and build/protocol identity.
- [x] Prove process restart, Project Server restart, same-build resume, competing writer rejection, and build-change rollover.
- [x] Keep Review separate from Implementation and Model Checks fresh.

Success: one Session may span Runs without hidden warm-process state or concurrent writers.

### Slice 12 — Durable DSH completion

- [x] Connect Run Process ledger and raw log to durable evidence stores during execution.
- [x] Validate terminal Candidate or stopped outcome, raw artifacts, quiescence, process exit, and evidence closure.
- [x] Atomically commit Runtime-authored Run Receipt only after all required evidence is durable.
- [x] Recover interrupted append and receipt commit without duplicate authority.

Success: Project Server never receives an admitted Candidate without complete durable receipt evidence.

### Slice 13 — DSH Goal and stage-aware compaction

- [x] Spike controlled Goal activation for bounded same-Session continuation.
- [x] Withhold `complete_goal` authority from models; Candidate submission pauses an attempt and Project Server/Gates determine completion.
- [x] Implement authority promotion, predictive pressure, safe semantic checkpoints, CodeWiki summarizer, exact history retention, and deterministic rehydration.
- [x] Qualify Candidate pause/resume, Gate feedback, restart, compaction, and rollover for Decision, Planning, Work Unit Implementation, and Review.

Success: long-running continuity survives compaction without moving project authority into conversation state.

### Slice 14 — Provider broker and live-model qualification

- [x] Separate one user-selected Harness route with Decision, Planning, and Review inheritance or override from the independent user-authorized Worker pool and Check-owned Model Check routes.
- [x] Add explicit Worker escalation transitions and context-window capabilities; routes omitted from the Worker pool cannot be assigned or entered by escalation.
- [x] Activate deterministic Work Unit model selection through Work Unit Model Assignment `1.0.0`, binding scheduled Assignment, Work Unit, route-policy digest, selected route, prior typed attempts, budgets, rationale, and exact Run route.
- [x] Bind route ID, provider, model, reasoning effort, context window, timeout, policy attempt, model Assignment, options, and route digest in Run Request `5.0.0`; force model changes through fresh-Session rollover.
- [x] Add typed recovery for broker transport retry, canonical rehydration, compatible-route selection, capability escalation, user authorization, and terminal stop.
- [x] Implement an authenticated host-local provider-neutral private model capability with TCP-loopback and sandbox-mounted Unix-domain transports and no provider credential in DSH, project files, prompts, Sessions, Workbenches, ledgers, or receipts.
- [x] Bind broker implementation/configuration, exact request/response, selected target, transport attempts, provider request ID, usage, cancellation or typed failure, and receipt identity into Execution Ledger `5.0.0` and Run Receipt `4.0.0` lineage.
- [x] Qualify credential-free live streaming, bounded broker-owned retry, cancellation, selected-target mismatch rejection, and isolated Run Process transport without committed credentials or mandatory paid calls.
- [x] Preserve replay as the deterministic CI route and prohibit fallback from failed live transport.
- [x] Constrain optional Switchyard admission to pinned loopback passthrough, zero Switchyard retries, exact configuration/build identity, and exact selected-target evidence; defer dynamic routing.

Success: Harness, Worker, and Check model authority stays distinct; every Work Unit Run uses one user-authorized exact route; transport retry remains broker-owned; live transport is separately qualified; credentials stay outside DSH; and provider or broker identity grants no CodeWiki authority.

### Slice 15 — Secure Code Mode and sandbox qualification

- [x] Benchmark native direct, native batch, and Code Mode for source tokens, cached input tokens, model output tokens, tool-result tokens, repeated-byte ratio, new-byte ratio, Candidate-to-edit amplification, turns, bytes, latency, ledger size, compaction, and Candidate quality.
- [x] Select only a qualified fresh-process TypeScript Code Runtime exposing typed async CodeWiki bindings through DSH `run_code`.
- [x] Select and pin a qualified Bubblewrap plus `prlimit` outer whole-process sandbox policy.
- [x] Run adversarial filesystem, network, process, descriptor, credential, resource, escape, orphan, cancellation, malformed-protocol, and evidence-integrity tests across separate inner and outer boundaries.
- [x] Fail closed when either boundary is unavailable, unsupported, malformed, or version or executable identity changes.
- [x] Bind normalized Code Mode configuration, sandbox profile, Node executable identity, static material, nested binding calls, termination, and output into authenticated Run Process and Execution Ledger evidence.

Success: model-authored code has no ambient authority and production cannot start without both qualified boundaries.

### Slice 16 — Pi parity and deletion

- [x] Compare Decision, Change-scoped Planning, Work Unit Implementation, aggregate Review, Skills, Checks, material queries, cancellation, compaction, receipts, and failure behavior across temporary Pi evidence and DSH.
- [x] Pack reviewed candidate and test only in disposable external projects with isolated Pi settings.
- [x] Delete `src/runtime/pi/**`, temporary `./pi-sdk`, Pi execution adapters, selectors, fallbacks, and migration-only tests in one clean cut.
- [x] Retain Pi only as optional Client integration where still product-required.

Success: one DSH execution engine remains; no selector or compatibility shell survives.

### Slice 17 — Product completion

- Implement first-party Harness Agent interaction continuity, Decision/Planning submission, and selective canonical Implementation/Review observer projections.
- Implement reserved MCP material-query, submission, status, confirmation, Work Unit, and Review operations.
- Finish Check Author SDK and sandboxed Code Checks.
- Finish Outcome Diagnostics through ordinary Change Intake.
- Finish Pack transport, dashboard projections, external Candidate admission, remote synchronization, and recovery UX.
- Run full packed-install, adversarial, performance, benchmark, audit, and release qualification.

## Required verification for every executable slice

1. Manifest validation against anchored HEAD and declared dispositions.
2. Focused tests proving new invariant, deterministic replay or materialization where applicable, and stale/tamper/failure behavior.
3. Primary LSP diagnostics before build.
4. Full typecheck and build.
5. Relevant complete test suite.
6. Package-install smoke from packed artifact when exports or runtime closure change.
7. Production dependency audit; full development advisories remain separately reported.
8. Knip or equivalent dead-export check for touched surfaces.
9. `lens_diagnostics mode=all` with no blocking edited-file findings.
10. Clean Git diff, one green commit, and push only after review.

## Release blockers

- Credential-bearing provider adapters and optional pinned Switchyard deployment are not externally qualified.
- First-party Harness Agent, reserved MCP operations, remaining Check Author and Pack transport surfaces, dashboard completion, remote synchronization, and recovery UX remain incomplete.
- Final release qualification has not run against the completed product.

No production release, protected effect, or Pi deletion may bypass these gates.
