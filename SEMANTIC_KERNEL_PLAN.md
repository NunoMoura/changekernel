# CodeWiki Semantic Kernel Plan

## Purpose and status

This is the active architecture and implementation roadmap after completion of Backend v1. Backend v1 culminated in the independently governed release candidate at commit `559331a1af9cc89f0d8ab3305ea129ef4b2489cb`; `BACKEND_V1_PLAN.md` and `REFACTORING_PLAN.md` remain completed historical evidence.

The objective is to evolve the qualified Backend v1 into the CodeWiki Semantic Kernel without weakening deterministic identity, expected-head compare-and-swap, provenance, replay, recovery, bounded execution, or one-writer authority.

This plan orders delivery. It is not canonical runtime input or a compatibility promise. During the transition:

- `.codewiki/kb/**` remains the current Backend v1 intended Product and System truth;
- `.codewiki/wiki/**` is the target canonical path and must not appear through an ad hoc rename;
- `src/**` and `tests/**` remain executable truth;
- Git remains history and checkpoint evidence;
- released controller N governs committed candidate N+1 from outside this checkout;
- CodeWiki is never installed or loaded from this repository's `.pi/` directory;
- generated views and private runtime state remain outside canonical project meaning.

Semantic Kernel slice SK0 is active and documentation-only. No source behavior, protocol identity, canonical path, Plugin composition, or support claim changes during SK0.

## Product objective

CodeWiki becomes a headless semantic operating kernel for governed agentic work. It owns shared project meaning, controlled semantic evolution, work admission, independent evaluation, realization lineage, protected effects, and exact recovery. It exposes a stable Kernel API and Wire Protocol to external applications without owning an end-user product interface.

First-party presentation is limited to scriptable operator commands and a small terminal-first Operator Console analogous to `systemctl`, `journalctl`, `top`, or Task Manager. It observes health, Wiki and realization heads, Changes, Work, Runs, Gates, Effects, and recovery through public versioned APIs; it is read-only by default and owns no rich authoring experience. A full Semantic Desktop remains a separate external product even when maintained by the CodeWiki team. It receives no privileged imports or hidden authority.

The governing principle is:

> Host OS governs resources. DSH governs agent execution. CodeWiki Semantic Kernel governs shared meaning and change. Applications govern experience.

Linux x64 remains the first and only currently qualified production host. Portability is a contract goal, not an inferred support claim.

## Fixed vocabulary

| Term | Meaning |
| --- | --- |
| CodeWiki Semantic Kernel | Headless authority owning Wiki state, Changes, Work, Gates, Alignment, authorization, compare-and-swap, replay, and guarded effects. |
| Wiki | Singular canonical filesystem-resident interlinked synthesis owned by one project and evolved only through accepted Wiki Transitions. |
| Wiki Item | Stable addressable unit of accepted project meaning whose identity is independent from path, title, or content digest. |
| Wiki facet or claim | Independently addressable semantic content owned by one Wiki Item and carrying exact lineage where material. |
| Wiki Checkpoint | Exact accepted Wiki state with canonical bytes, stable identities, deterministic traversal, and one tree digest. |
| Wiki Transition | Exact proposed semantic change from one expected Wiki Checkpoint to another. |
| Wiki Effect | Atomic `set` or `retire` operation over one stable Wiki Item or facet identity. |
| Semantic acceptance | Authorized expected-head commit of one exact Wiki Transition during Decision. |
| Realization obligation | Frozen requirement to make project artifacts realize one accepted Wiki target. |
| Realization closure | Proven state in which a reviewed project snapshot satisfies the applicable obligations of an accepted Wiki Checkpoint. |
| Raw Data Source | External or local information origin that may mutate, disappear, conflict, or restrict access. |
| Raw Data Revision | Exact immutable source version consumed by CodeWiki. |
| Raw Data Intake Adapter | Trusted executable capability that reads one source and emits bounded observations without Wiki mutation authority. |
| Project Realization | Capability family for versioned project storage, Workbenches, verification, integration, and delivery. |
| Check | User-custom independent evaluation unit. Non-negotiable lifecycle correctness is Kernel Validation, never a Check. |
| Check Pack | Grouping and transport of Checks only, with no inherited activation, enforcement, lifecycle, or execution authority. |
| Kernel API | Versioned command and query surface used by applications and agents. |
| Wire Protocol | Exact transport encoding, envelopes, ordering, errors, and subscription semantics for the Kernel API. |
| Run Host Contract | OS-neutral guarantees required to supervise and contain one exact DSH Run. |
| Operator Console | Minimal first-party scriptable and terminal UI for exact Kernel observation, lifecycle operations, and recovery through public APIs. |
| Semantic Desktop | Separate rich application product built over the public Kernel API and SDK without privileged authority. |

“Knowledge Base,” “Project Oracle,” and “Oracle” are not target subsystem names. Systems that users call knowledge bases enter CodeWiki as Raw Data Sources unless an explicit governed bootstrap adopts their meaning into the Wiki.

## Fixed architecture

```text
Applications
    │
    │ CodeWiki Kernel API / Wire Protocol
    ▼
CodeWiki Semantic Kernel
├── filesystem Wiki
├── canonical Change Traces
├── Change transaction engine
├── bounded semantic context
├── Alignment lineage
├── Work scheduler
├── Kernel Validation
├── Check and Gate runtime
├── Candidate and Evidence custody
├── AuthN / AuthZ / expected-head CAS / replay
└── guarded effects
    │
    ├── DSH Agent Runtime
    ├── Raw Data Intake drivers
    ├── Project Realization drivers
    └── Delivery drivers
            │
            ▼
Qualified Run Host
            │
            ▼
Host OS
```

The Semantic Kernel is small by authority, not by capability. Replaceable execution and external-system mechanics remain outside its fixed authority surface. Wiki storage remains a filesystem/Markdown contract rather than a storage Plugin or database authority.

## Authority ledger

| Owner | Exclusive authority | Explicit exclusions |
| --- | --- | --- |
| Project Server | Project meaning, authentication context, project authorization, canonical state, semantic admission, scheduling, Gate reduction, integration, delivery authorization, replay, and recovery. | Provider mechanics, DSH Session internals, host resource enforcement, application experience. |
| Wiki | Accepted semantic meaning and exact history-addressable checkpoints. | Runtime status, deployment status, raw source custody, generated indexes, credentials. |
| Change Trace | Append-only accepted transition, realization, judgment, authority, and effect history. | Current-state encyclopedia, raw execution log, duplicate Wiki content. |
| Alignment | Derived relation among Raw Data Revisions, Wiki targets, project artifacts, Evidence, and delivery. | Canonical meaning, causal invention, authority grants. |
| Runtime | Bounded execution, raw Session custody, execution Evidence, Receipts, Runtime Build custody, and production qualification. | Project authorization, semantic acceptance, Gate reduction, integration, delivery. |
| DSH | Agent Session internals, provider mechanics, tools, compaction, model history, Plugin lifecycle, and live Agent execution. | CodeWiki project meaning, lifecycle transitions, Check Results, protected effects. |
| Broker Host | Provider authentication, credentials, networking, and delegated enforcement. | Project authorization or semantic meaning. |
| Host OS | Processes, memory, CPU, I/O, filesystem and network enforcement, handles, and resource isolation. | Agent semantics, project meaning, application experience. |
| Applications | User experience, workflow presentation, and authenticated Kernel API use. | Direct canonical writes, lifecycle validity, protected effects without authorization. |
| Drivers and adapters | One admitted external capability under a narrow contract. | Canonical state ownership, self-admission, ambient authority. |

No component receives source observation, semantic acceptance, and protected mutation authority together.

## Semantic acceptance and realization closure

Wiki mutation belongs to Decision, not to the end of the realization lifecycle.

```text
Wiki K0 ───── realized by ───── Project R0
   │
   │ Decision evaluates and confirms K0 → K1
   ▼
Wiki K1 ───── realization gap ─ Project R0
   │
   │ Planning binds exact K1 and creates obligations
   ▼
Implementation produces Project Candidate R1
   │
   │ Review proves aggregate realization
   ▼
Wiki K1 ───── realized by ───── Project R1
   │
   └── Delivery binds K1, reviewed R1, and protected target
```

The Wiki is authoritative about accepted project meaning and target state. A project realization snapshot is authoritative about artifacts that currently exist. Alignment is authoritative only about the proven relation between them. Delivery identifies the reviewed realization currently active or published.

Rules:

1. A Decision Harness authors one exact Wiki Transition Candidate.
2. Decision Checks judge the frozen Candidate; they never author accepted bytes.
3. Project Server alone authorizes and expected-head-commits the accepted transition.
4. Planning, Implementation, and Review consume the immutable accepted Wiki Checkpoint and cannot rewrite it.
5. Discoveries that change meaning create a new Decision Candidate.
6. Failed realization leaves an explicit gap; it does not silently roll back accepted meaning.
7. Reversal, cancellation after semantic acceptance, or supersession requires another explicit Wiki Transition.
8. Pure semantic transitions with zero realization obligations complete after Decision; they do not create empty Planning, Implementation, or Review ceremony.
9. Realization and delivery statuses are derived from Change Trace, Alignment, Evidence, project snapshots, and delivery bindings rather than written into Wiki prose.
10. Applications must not treat `wiki.head` as deployed configuration or current physical behavior.

## Canonical, private, and derived state

Target canonical project layout:

```text
.codewiki/
├── wiki/                       # accepted Wiki Checkpoint
├── traces/                     # canonical per-Change append-only history
├── check-packs/                # project Check declarations
├── check-packs.lock.json
└── config.json
```

Canonical filesystem invariants:

- UTF-8 and LF canonical text;
- stable IDs independent from paths;
- POSIX-style project-relative canonical paths;
- no symlinks, reparse points, case collisions, reserved names, trailing spaces, or trailing dots;
- deterministic lexical traversal with explicit comparators;
- canonical bytes and exact tree digests;
- one Project Server writer;
- atomic replacement and expected-head compare-and-swap;
- external-drift detection;
- tombstones and non-reused IDs;
- arbitrary folders and open namespaced item types;
- no generated index or database representation as canonical authority.

Private state remains below one external `$CODEWIKI_STATE_ROOT` contract. Raw Data Revision bytes, credentials, DSH Sessions, caches, sockets, Workbenches, indexes, embeddings, graph stores, temporary files, and operational residue never enter `.codewiki/`.

Derived Views include indexes, backlinks, activity pages, summaries, embeddings, graph databases, hierarchical source indexes, freshness dashboards, WorkState, and Alignment projections. They are reproducible or disposable and never define semantic identity.

## Raw-data compilation

```text
Raw Data Source
    │
    │ exact immutable Raw Data Revision
    ▼
capture → normalize → correlate → synthesize
    │
    ▼
Wiki Transition Candidate
    │
    ▼
Decision evaluation and semantic acceptance
    │
    ├── zero realization obligations → complete
    └── obligations → Planning → Implementation → Review → Delivery
```

Raw sources are Evidence, not guaranteed truth. Mutable sources produce new immutable revisions. When a source cannot guarantee durable revision retrieval, CodeWiki retains the exact consumed bytes privately.

Material claims require source-slice lineage. Supporting, contradicting, superseding, generator, verification, freshness, and access facts must be separately attributable. Generated answers do not silently become their own evidence. One authoritative Wiki Item or facet owns each claim; other items reference its stable identity or add genuinely new synthesis.

ACL filtering occurs before model context. Mixed-access synthesis is split or inherits the most restrictive supporting access unless an explicit authorized declassification exists. Source revocation or permission drift stops retrieval leakage immediately, then creates governed retraction or recompilation work.

## Check and Gate target

- Only Decision, Implementation, and Review accept custom Checks.
- Planning uses Kernel Validation and user configuration, not custom Checks or an empty Gate.
- A Check without activation conditions is active by default.
- Activation uses frozen deterministic facts, never model claims, routes, Workbench configuration, mutable labels, or proposed Check bytes.
- Effects are exactly `required | advisory | observe`; omission means `required`.
- Required failure fails the Gate; required operational unavailability stops it.
- Advisory failure emits warning and feedback without failing the Gate.
- Observe records evaluation only.
- Quantitative measurements become binary after threshold comparison; Gates have no score, weight, or aggregate ranking.
- Evaluator kinds are `code | model | evidence | human`.
- Human evaluation is authenticated subject-bound Evidence with actor, role, independence, disposition, head, and time.
- Packs contain Checks only. No Pack Skills, inherited activation, enforcement override, hidden defaults, ordering, or conflict resolver survives.
- Pack composition is deterministic union. Qualified identity is `<pack-id>/<stage>/<check-id>`.
- Installing starter Packs is always explicit. Deleting all custom Checks cannot weaken Kernel Validation.

## Project Realization target

Project Realization is a capability family, not one god adapter:

| Port | Responsibility |
| --- | --- |
| Versioned Project Store | Exact project snapshots, history, expected-head operations, and content identity. |
| Workbench Provider | Isolated realization space for one Assignment. |
| Project Verification Provider | Exact-snapshot observations and Evidence without integration authority. |
| Integration Provider | Expected-head-safe admission of reviewed Candidates into private or protected lineage. |
| Delivery Target | Deploy, publish, submit, export, promote, or synchronize one authorized reviewed realization. |

Git is the first Versioned Project Store, not a software-only assumption. Workbenches may contain source, prose, images, datasets, diagrams, policies, configuration, or research assets. Project Verification replaces “CI” as the universal concept. Integration and Delivery remain separately authorized.

## Run Host target

The Run Host Contract states guarantees rather than Linux syscall names:

- spawn one exact Runtime Build;
- grant exact filesystem capabilities;
- enforce declared network policy;
- enforce CPU, memory, process, I/O, output, and time budgets;
- isolate credentials;
- transfer immutable context;
- identify and observe the complete process tree;
- cancel or kill the complete tree;
- prove quiescence;
- close Evidence before Receipt commit;
- return one exact host-bound Receipt.

Linux may realize those guarantees with Bubblewrap, namespaces, Landlock, cgroup v2, `pidfd`, `openat2`, sealed `memfd`, Unix sockets, and descriptor passing. Windows may use ProcessContainer or AppContainer, Job Objects, process handles, reparse-safe opens, read-only mappings, Named Pipes, and duplicated handles. Shared TypeScript does not imply equivalent qualification.

Containment has two layers: CodeWiki Runtime confines the complete DSH Run, while DSH confines tools and subprocesses within the Agent Session. Neither substitutes for the other.

One exact host implementation binds each Runtime Build. Partial enforcement never falls back silently. Windows applications may use a remote Linux Kernel immediately; WSL2 or a remote Linux Run Host is the first local execution bridge. Native Windows production support requires separate qualification of equivalent guarantees. DSH's cross-platform sandbox work is the primary collaboration path. Microsoft MXC remains a watch candidate, not a qualified security boundary. AIOS remains research input at the same conceptual layer as DSH and does not enter the execution closure.

## Contract freeze inventory

| Contract family | Required freeze | First slice |
| --- | --- | --- |
| Wiki Item, facet, claim, alias, relationship, tombstone | Schema, canonical Markdown/YAML, stable identity, bounds, open namespacing | SK1 |
| Wiki Checkpoint, Transition, Effect | Canonical bytes, tree identity, compare-and-swap, replay, drift, atomicity | SK1 |
| Semantic acceptance and realization obligations | State machine, zero-obligation closure, compensation, staleness | SK1 |
| Raw Data Source, Revision, slice, cursor, ACL, receipt | Private custody, source identity, deletion, permission drift, retention | SK1 then SK5 |
| Alignment lineage | Canonical inputs, derived edges, dirty-set reduction, freshness, retraction | SK1 then SK5 |
| Kernel API and Wire Protocol | Commands, queries, subscriptions, consistency, handles, errors, capability discovery | SK1 then SK3 |
| Check, Pack, activation, Result, Gate Report | Effects, evaluators, binary reduction, composition, protected-head identity | SK1 then SK4 |
| Project Realization ports | Capability ceilings, snapshot identity, Evidence, integration, delivery | SK1 then SK4 |
| Run Host Contract | Enforcement facts, Build binding, process custody, quiescence, Receipts | SK1 then SK6 |

No executable slice invents its contract while simultaneously trying to prove that contract stable.

## Current-to-target transformation matrix

| Current Backend v1 surface | Target owner | Disposition | Planned slice |
| --- | --- | --- | --- |
| Product described as intent-to-production runtime | Semantic Kernel | Rename and narrow to headless governed semantic kernel | SK0/SK3 |
| `.codewiki/kb/**` | Wiki | Backup-first migration to `.codewiki/wiki/**`; reject dual active roots | SK2 |
| Product/System/Design-only Knowledge profile | Wiki | Replace with universal open envelope and valid empty Wiki | SK1/SK2 |
| Path-constrained document kinds | Wiki | Replace with stable IDs, arbitrary folders, open namespaced types | SK1/SK2 |
| Page-level source metadata | Wiki and Alignment | Extend to material facet/claim source-slice lineage | SK1/SK5 |
| Domain Plugin semantic ownership | Kernel, Wiki, configuration, Packs, and drivers | Prove complete responsibility mapping, then delete or retain only a thinner internal boundary if unavoidable | SK4 |
| Software Development Domain bootstrap | Explicit project bootstrap | Remove imposed scaffold; empty Wiki becomes valid | SK2/SK4 |
| Seeded default Packs | Explicit Pack installation | Delete automatic defaults and restoration behavior | SK4 |
| Stage-first Pack layout | Checks | Migrate to pack-first `.codewiki/check-packs/<pack>/<stage>/<check>/` | SK4 |
| Pack Skills | External producer Skills | Delete from Pack contract | SK4 |
| Planning Checks and Planning Gate | Planning Kernel Validation | Delete custom Planning evaluation | SK4 |
| Hidden `codewiki.implementation.kernel` quality Pack | Kernel Validation plus explicit user Checks | Split non-negotiable invariants from user preferences, then delete hidden Pack | SK4 |
| Code/Model, blocking-only Checks | Checks | Add Code/Model/Evidence/Human and required/advisory/observe | SK4 |
| Browser Frontend plan and in-core product UI | External applications | Remove rich product UI ownership from core; retain public Kernel contracts only | SK3/SK4 |
| Current operational dashboard and lifecycle controls | Operator Console | Reduce to scriptable commands and a terminal-first, read-only-by-default system monitor using public APIs | SK3/SK4 |
| Full Semantic Desktop concept | Separate external product | Keep outside the Kernel repository and privilege boundary even when CodeWiki-team-owned | outside this roadmap |
| Frontend API naming | Kernel API and Wire Protocol | Generalize app-facing boundary without exposing internal authority | SK3 |
| Git-specific project assumptions | Project Realization | Keep Git as first Versioned Project Store behind universal ports | SK4 |
| CI terminology | Project Verification | Generalize exact-snapshot Evidence production | SK4 |
| Deployment terminology | Delivery Target | Generalize deploy/publish/submit/export/promote/synchronize | SK4 |
| Knowledge-to-source Alignment | Alignment lineage spine | Extend to Raw Data Revision → Wiki facet → Project Artifact → Evidence/Delivery | SK5 |
| No Raw Data subsystem | Raw Data Intake | Add source, revision, slice, adapter, receipt, ACL, retraction, and private custody contracts | SK5 |
| Project Context Snapshot | Semantic context | Retain checkpoint-bound bounded context and add provenance-preserving handles | SK3/SK5 |
| Linux-specific Runtime production binding | Run Host | Encapsulate behind exact guarantee contract while retaining Linux reference host | SK6 |
| DSH execution closure | DSH Agent Runtime | Retain as sole first-party engine; adopt upstream mechanics only after exact qualification | SK6 |
| CodeWiki App/CLI/Pi surfaces | External applications and minimal clients | Preserve protocol clients where useful; remove kernel ownership of end-user experience | SK3/SK4 |
| Backend Build and Release Manifest | Kernel Build and qualification | Advance identities for every protocol, path, Plugin, or host-boundary change | every executable slice |

The detailed SK0 inventory must map every affected source module, test, protocol, persisted identity, migration edge, rollback path, and release gate before SK1 begins.

## Universal conformance scenarios

Contract fixtures must cover:

1. an empty Wiki with no source, item, relationship, Check, or realization obligation;
2. software development with source, tests, Git integration, and deployment;
3. research and content with citations, contradiction, publication, and revision;
4. product and design with visual assets, requirements, and delivery;
5. legal or policy work with restricted sources, approvals, and supersession;
6. music management with recordings, rights, release assets, and distribution;
7. logistics with plans, providers, events, and operational handoff.

Adversarial fixtures must include stale heads, path moves, case collisions, source revocation, mixed ACL synthesis, contradictory revisions, adapter compromise, migration crash, incomplete Evidence, hostile symbolic paths, process-tree escape, and partial delivery.

A universal contract fails if any scenario requires a hidden domain branch in Project Server lifecycle authority.

## Delivery rules

1. Prefer deletion and ownership cuts over compatibility layers.
2. Keep one authoritative writer and one canonical representation.
3. Never dual-write `kb/` and `wiki/`.
4. Preserve canonical bytes, stable identity, expected-head compare-and-swap, provenance, replay, recovery, and guarded effects.
5. Separate protected accepted controller policy from Candidate policy.
6. Keep controller, subject, state, credentials, Runtime Build, DSH closure, and host enforcement separately attributable.
7. Treat research and conversation summaries as navigation until claims are reverified against exact sources.
8. Parse unknown input at boundaries and keep open semantic payloads inside named bounded envelopes.
9. Keep every slice releasable, migratable, rollback-capable, and externally governable.
10. Use Pi-native tools in this checkout; test packed CodeWiki only in disposable external projects.
11. Do not add a Wiki Store Plugin, generic workflow engine, second Session engine, backend selector, project-local executable Plugin path, or repository dogfood state.
12. Do not claim a platform, provider, or containment mode merely because installation succeeds.

## Roadmap

```text
SK0 Architecture consolidation
  ↓
SK1 Contract laboratory and universal fixtures
  ↓
SK2 Universal Wiki and qualified kb→wiki migration
  ↓
SK3 Kernel API, Wire Protocol, and application boundary
  ↓
SK4 Universal lifecycle, Checks, and Project Realization
  ↓
SK5 Raw Data compilation and Alignment lineage
  ↓
SK6 Run Host Contract and Linux capability qualification
  ↓
SK7 Windows bridges and separately qualified native host
```

SK6 capability experiments may run beside SK1–SK5 but cannot change production support or Runtime authority before their own qualification.

### SK0 — Architecture consolidation — active

- [x] Establish the CodeWiki Semantic Kernel name and headless product boundary.
- [x] Limit first-party presentation to scriptable operations and a terminal-first Operator Console.
- [x] Place any full Semantic Desktop in a separate external product and privilege boundary.
- [x] Replace app-facing ABI terminology with Kernel API and Wire Protocol.
- [x] Establish Host OS, DSH, Semantic Kernel, and application authority layers.
- [x] Clarify semantic acceptance versus realization closure.
- [x] Preserve Decision as the only Wiki mutation stage.
- [x] Establish target Wiki, Raw Data, Check, Project Realization, and Run Host vocabulary.
- [x] Establish the high-level current-to-target transformation matrix and roadmap dependency order.
- [ ] Complete file- and protocol-level mapping for every transformation row.
- [ ] Freeze exact authority and state machines for every contract family.
- [ ] Reverify external architecture claims against exact retained sources.
- [ ] Resolve every SK1-blocking open decision below.
- [ ] Govern and qualify the completed architecture checkpoint with released controller N.

Success: every current responsibility has exactly one target owner and disposition; every target contract has one authority, state machine, canonicalization plan, migration edge, rollback path, and proof strategy; no unresolved authority overlap enters SK1.

### SK1 — Contract laboratory and universal fixtures

Implement schemas, pure normalizers, canonical encoders, parsers, digest functions, state-machine reducers, valid and invalid golden fixtures, migration fixtures, replay fixtures, and cross-platform path fixtures without changing canonical project state.

Success: deterministic fixtures cover all universal and adversarial scenarios; no schema relies on Product/System/Design, software, Git, Linux, a model claim, or a mutable path for semantic identity.

### SK2 — Universal Wiki and qualified migration

Implement the universal Wiki envelope and one backup-first, quiescent, expected-head-safe migration from `.codewiki/kb/**` to `.codewiki/wiki/**`. Validate the old tree, generate the new tree deterministically, verify exact identity mapping and digests, atomically cut over, advance protocol and Build identities, reject dual roots, preserve rollback, and qualify the committed candidate externally.

Success: the empty Wiki and migrated CodeWiki Wiki both replay exactly; old state remains backup-readable but cannot activate as current canonical state; no raw data or runtime residue enters `.codewiki/`.

### SK3 — Kernel API and application boundary

Expose versioned commands, bounded queries, subscriptions, handles, errors, capability discovery, consistency semantics, and redaction for Wiki, Changes, Work, Candidates, Evidence, Raw Data requests, and Effects. External applications command the Kernel and cannot write canonical files directly. Remove end-user frontend implementation from kernel scope. Retain scriptable operator commands and a minimal terminal-first Operator Console that consumes the same public Kernel and Operations APIs, remains useful in degraded mode, and receives no storage or lifecycle authority from being bundled.

Success: an external application can govern a complete Change without importing internal Project Server modules, DSH internals, filesystem authority, or protected effect capabilities; the Operator Console can inspect, stop, and recover the Kernel without becoming a product workflow or privileged presentation path.

### SK4 — Universal lifecycle, Checks, and Project Realization

Introduce universal Kernel Validation, Planning constraints and ordered objectives, target Check semantics, pack-first layout, and separate Project Realization ports. Migrate or delete Domain Plugins, seeded defaults, Pack Skills, Planning Checks, hidden quality policy, software-only branches, and UI assumptions without weakening current correctness.

Success: unlike project scenarios use identical Decision, Planning, Implementation, Review, Work Unit, Candidate, Evidence, Gate, Integration, and Delivery contracts; deleting all custom Checks leaves every kernel invariant intact.

### SK5 — Raw Data compilation and Alignment lineage

Add private immutable Raw Data Revision custody, source adapters, source slices, cursors, intake receipts, lineage, correlation, synthesis Candidates, claim-level provenance, ACL propagation, contradiction, freshness, retraction, recompilation, and deterministic dirty-set reduction. Query Wiki first and raw revisions only for drill-down, unsupported questions, freshness, contradiction, or missing coverage.

Success: source mutation, deletion, revocation, and permission drift update retrieval safety immediately and generate exact governed repair work without erasing independently supported synthesis.

### SK6 — Run Host Contract and Linux qualification

Prototype one DSH Run using only inherited sealed or scoped capabilities: control socket, immutable context handle, Candidate output handle, Evidence channel, and scoped Workbench handle. Remove ambient project paths, credentials, network, canonical writes, and child-lifecycle authority. Evaluate whether Node plus qualified external tools can enforce the required Linux invariants before adding a small native helper.

Success: terminal Evidence, DSH exit, complete process-tree quiescence, event closure, and Evidence closure precede Receipt commit; exact host enforcement facts bind the Runtime Build and production qualification.

### SK7 — Windows and cross-platform qualification

Support Windows applications against remote Linux first, then qualify WSL2 or another Linux Run Host bridge. Implement a native Windows host only if ProcessContainer or AppContainer, Job Objects, safe path handling, immutable context transfer, network controls, credential custody, quiescence, recovery, and evidence closure meet the same contract. macOS receives its own separately bound host implementation and qualification.

Success: support is reported independently for Client, Kernel, DSH core, inner tool sandbox, outer Run Host, and production qualification; no partial layer is advertised as complete Windows support.

## Open decisions blocking SK1

- Exact Wiki Item, facet, claim, relationship, alias, tombstone, provenance, checkpoint, transition, and effect schemas.
- Exact canonical Markdown/YAML serialization, portable filename subset, media handling, and open type namespacing.
- Exact modality for descriptive facts, normative targets, historical facts, and realization-bearing claims.
- Exact realization-obligation declaration, deterministic impact derivation, zero-obligation closure, compensation, and supersession semantics.
- Exact Raw Data Source, Revision, slice, cursor, ACL, deletion, and receipt schemas.
- Exact private Raw Data Revision path and retention layout below `$CODEWIKI_STATE_ROOT`.
- Exact ACL inheritance, mixed-access synthesis, declassification, non-disclosure, revocation, and retraction behavior.
- Exact canonical versus derived split for Alignment edges and dirty-set computation.
- Exact Kernel API consistency, pagination, subscriptions, handle expansion, redaction, and capability discovery.
- Exact Kernel Validation rules, especially Planning coverage, dependency, overlap, budgets, critical path, and safe parallelism.
- Exact Check activation facts, evaluator contracts, Result states, Gate reduction, composition validation, and migration.
- Proof that Domain Plugins can be deleted rather than reduced to a thinner release-managed internal seam.
- Exact Project Realization driver admission and capability ceilings.
- Placement of maintenance findings or an Error Book in Change Trace, Wiki state, or private operational state.
- Whether current Node and qualified external tools can enforce the Run Host contract without a small native supervisor.
- Exact Windows support profile and dependency on DSH, WSL2, Microsoft MXC, or native host primitives.

## Qualification rules

Every executable slice must:

1. begin from an exact clean committed subject, excluding unrelated user files;
2. preserve a readable and rollback-capable prior state;
3. add focused invariant, failure, replay, migration, and recovery tests;
4. pass primary LSP diagnostics before build and test work;
5. pass typecheck, build, focused tests, full tests, production tests, readiness, package installation, and applicable external lifecycle gates;
6. pass the unfiltered diagnostics ratchet and dependency audits;
7. regenerate every affected protocol, package, Runtime Build, Backend Build, and Release Manifest identity;
8. prove expected-head stale-write rejection and deterministic recovery;
9. run packed installs only in disposable external projects;
10. use released controller N and protected-head policy to govern committed candidate N+1;
11. verify no `.codewiki/runtime/`, `.codewiki/views/`, package tarball, credential, Session, socket, cache, or daemon residue remains in the source checkout;
12. ship one reviewed green commit per bounded slice.
