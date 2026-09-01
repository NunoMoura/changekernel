# Semantic Kernel Plan — Intent-First Git

## Status and authority

This is the active CodeWiki architecture and implementation roadmap after Semantic Kernel SK2. It replaces earlier SK3 proposals that used target Candidates, authored Completion Requirements, dispositions, Gate Evaluation Packages, private integration lineage, a canonical global Work Graph, or CodeWiki-owned physical Agent Sessions.

`REFACTORING_PLAN.md`, `BACKEND_V1_PLAN.md`, and `SEMANTIC_KERNEL_SK0_CONTRACTS.md` are qualified historical evidence. They remain unchanged. Current `.codewiki/wiki/**` records accepted design meaning; `src/**` and `tests/**` record executable behavior. Target design and executable behavior must move through governed Changes together. Until an exact documentation proposal is validated, authorized, admitted, implemented, externally qualified, and activated, existing source protocols remain executable truth.

No mutable checkout governs or qualifies itself. Released controller N qualifies exact committed candidate N+1 outside this repository. Every correction creates another candidate, exact-subject qualification, and explicit activation.

## Product thesis

CodeWiki is an intent-first Git workflow for Agentic teams. It validates shared meaning before expensive implementation, then verifies that one exact Project snapshot realizes that meaning.

```text
user intent
  -> Proposed Change
  -> semantic Decision
  -> Change Commit
  -> planned and checked realization
  -> Change Completion Commit
  -> optional Delivery
```

The semantic merge happens at Change Commit. The artifact merge happens at Change Completion Commit. Both are ordinary Git commits over the complete governed Project tree. Change scopes intent, authority, and lineage; it never defines a partial repository snapshot.

CodeWiki does not promise semantic perfection or replace human accountability. It provides bounded process integrity: stable identity, exact subjects, authenticated authority, independent Checks, deterministic Gate reduction, Git compare-and-swap, explicit uncertainty, durable provenance, and recoverable state.

## Current posture

CodeWiki is private pre-production software. Backend v1, SK0, SK1, and corrected SK2 release `adc272d0d9b8f228fc8cedb150c8c6371c823997` passed external exact-subject qualification. SK2 migrated this repository at commit `7b4e5e9021b27ff09f6f93569bb2a93c1fb0ebdf`.

Current semantic roots are:

```text
.codewiki/
  config.json
  wiki/items/**
  changes/TRACE-CHG-<id>.jsonl
  check-packs/<stage>/<pack>/**
  check-packs.lock.json
```

`.codewiki/kb/**`, `.codewiki/traces/**`, `.codewiki/runtime/**`, `.codewiki/views/**`, and generated indexes below `.codewiki/wiki/**` must remain absent. This SK3 design proposal moves all 47 migrated Items to readable paths under preserved `product/**` and `system/**` categories. Stable Item IDs and Git rename history preserve identity; paths remain non-authoritative navigation hints.

Current migrated schema limits remain binding until a governed schema change: each legacy System Component body is at most 10,000 characters and Recovery Flow body is at most 8,000 characters.

Current executable drift is explicit: 27 tests still address removed `.codewiki/kb/**`, `.codewiki/traces/**`, or Domain configuration even though accepted SK2 state removed those owners. Do not recreate forbidden roots or Domain authority to satisfy them. The authorized source/test refactor must replace those assertions before any candidate claims a green full suite.

Package `@nunomoura/codewiki@0.3.0` remains private and unpublished with `"private": true`. Immutable packed installs run only outside this checkout with owner-private state and isolated Pi settings. Rich application UI remains outside Kernel scope.

## Non-negotiable ownership

### Project Server

Project Server is the sole writer of canonical and managed CodeWiki Git refs. It owns Actor authorization, Change admission, lifecycle validation, Gate coordination, Work admission, expected-head compare-and-swap, protected effects, recovery, and public semantic APIs.

### Git Project Store

Git owns exact Project bytes, full trees, commits, ancestry, first-parent canonical state, managed Change refs, expected-old-OID compare-and-swap, replay, and bounded rollback. Every Change revision, Work result, Change Commit, and Completion Commit identifies a full Project snapshot.

### Wiki

Wiki owns accepted descriptive, historical, and normative Project meaning. Wiki may intentionally lead artifact realization between Change Commit and Completion Commit. Stable Wiki Item IDs—not paths, titles, aliases, terms, Git OIDs, installations, or model output—establish identity.

### Change Trace

One append-only Trace owns lifecycle meaning, rationale, accountable Actors, contributor and DSH Run provenance, Gate/Result references, Work facts, exact Git OIDs, protected-effect receipts, and correction/supersession history. Trace does not duplicate project bytes, raw Agent logs, or private execution state.

### DSH and Execution Host

DSH owns Agent execution mechanics: internal Sessions, Agent loop, models, tools, providers, and compaction. Execution Host owns process containment and resource enforcement. CodeWiki authorizes one exact DSH Run and validates its receipt; it does not implement a second Agent Session engine or assign semantic authority to opaque DSH Session bytes.

### Checks and Gates

Project-owned stage Check Packs define available evaluation policy. A Gate freezes the exact subject, policy, type-conditioned active Checks, inputs, and digest. Check Runs execute individual Checks. Results are judgments, not Evidence or lifecycle authority.

### Derived state

WorkState, Work View, Alignment, Dictionary, backlinks, search, history, attribution, semantic diff, graph, lexical, and vector facilities are rebuildable Views. Private indexes and caches accelerate queries but never establish identity, truth, absence, authority, or lifecycle state.

## Truth planes

CodeWiki keeps these planes separate:

1. **Wiki meaning** — accepted intent and governed semantics.
2. **Project artifacts** — exact Git-tracked source, tests, configuration, documentation, and assets.
3. **Evidence** — provenance-bound observations over exact material.
4. **Results** — Check judgments over exact Gate inputs.
5. **Trace** — why, who, lifecycle events, receipts, and exact OIDs.
6. **Derived state** — WorkState, Alignment, search, Dictionary, and other Views.
7. **Private operation** — credentials, DSH internals, leases, sockets, caches, worktrees, raw execution evidence, and provider state outside project Git.

No plane silently upgrades another. A model finding is not Evidence truth. Similarity is not identity. Provider success is not completion. Git authorship is not Actor authority. A Check pass is not a Change transition until Project Server validates a current authenticated command and exact heads.

Digests identify already-complete bytes. No persisted object embeds or searches for its own digest; enclosing or successor records cite completed object identities. CodeWiki performs no cryptographic fixed-point search.

## Change model

### Identity and representation

One Change has:

- one stable Change ID;
- one append-only `.codewiki/changes/TRACE-CHG-<id>.jsonl` file;
- one managed `refs/codewiki/changes/<id>` ref;
- zero or more full-snapshot Trace commits;
- at most one Change Commit;
- when project realization is required, at most one Change Completion Commit.

A Trace commit means any managed-ref version. A Proposed Change is an exact managed-ref tip eligible for Decision. A Committed Change is accepted intent recorded by Change Commit. A Completed Change is accepted intent whose local Project realization is recorded by Change Commit or Completion Commit.

### State vocabulary

Draft material is local and non-authoritative. Persisted lifecycle states are:

- **Proposed**
- **Committed**
- **Completed**
- **Rejected**
- **Deferred**
- **Withdrawn**

Deferral may resume. Rejection and withdrawal apply only before commitment. A Committed Change cannot later be rejected or withdrawn. Wrong or changed accepted intent requires a Superseding Change; accepted history is never rewritten.

### Required classification

Every Proposed Change declares exactly one `changeType`:

- `capability` — add, remove, or materially change externally observable behavior or meaning;
- `correction` — restore behavior or meaning to accepted intent;
- `maintenance` — change realization while preserving intended behavior;
- `policy` — change governance, standards, authority, security posture, or controlled configuration;
- `investigation` — produce an accepted finding, decision, or explanatory model.

All five types may use either realization route when the exact outcome supports it. Protected publication, Delivery, deployment, or other external effects are not a sixth Change type; they remain separately authorized after local lifecycle boundaries.

Every Proposed Change also declares exactly one `realization`:

- `wiki-only` — the Decision-phase full snapshot itself completely realizes the outcome; changed paths are limited to the Change Trace and Wiki meaning allowed by policy;
- `project` — accepted Wiki meaning requires later project-artifact realization and Review.

A `project` Change may have no Wiki file diff when existing accepted Items already state the complete goal. Its proposal and Trace bind those stable Item/facet targets plus rationale; no authored requirement object duplicates them.

SK3 minimum has no second persisted class/tag authority. Check selection may additionally use exact Item types, changed paths, stage subject facts, and Work Unit subtype/scope. New primary types require a governed protocol change, not arbitrary proposal text.

A fixed Decision Check validates type and realization alignment. Misclassification requires a revised Proposed Change and fresh Gate. An Agent, route, Worker, or Check cannot silently reclassify work.

### Proposal admission and collaboration

`proposeChanges` is the primary command; singular submission wraps one proposal. One authenticated request binds an Actor-scoped idempotency key, exact expected project head, bounded proposals with unique request-local keys, authority, and optional correlation metadata. Project Server assigns Change IDs and atomically creates all requested refs/Traces or none. Admitted Changes proceed independently.

Several contributors may revise one Change only while they refine the same independently decidable outcome. Different acceptable outcomes use separate Changes. Revisions advance the managed ref through expected-tip compare-and-swap. Stale submissions return exact base/tip/diff facts for explicit reconciliation. CodeWiki performs no automatic semantic merge, force-push, last-write-wins, or silent Agent write.

Coordination uses optimistic snapshot isolation and short compare-and-swap transactions. No lock spans user deliberation, DSH execution, Check execution, or Review; stale work stops for explicit reconciliation.

Proposal correlation is metadata only. It has no shared lifecycle, Gate, authority, commit, or completion state.

### Git commit graph

Initial proposal history branches from the exact canonical project head. Each revision advances the linear managed Change ref and preserves append-only Trace prefix.

Change Commit has parent order:

1. current canonical project head;
2. exact passed Proposed Change tip.

Project Server validates the current Actor, Gate, Results, Change tip, active-Change compatibility, complete Project tree, Wiki delta, type, realization, and expected project head, then advances canonical and Change refs through expected-old-OID compare-and-swap.

For `wiki-only`, the Change Commit records both `change.committed` and `change.completed`. The full committed snapshot already realizes the outcome.

For `project`, the Change Commit records `change.committed`. Canonical Wiki now expresses accepted future intent; Alignment reports the owned realization gap while Planning and Implementation continue on the Change ref.

Change Completion Commit has parent order:

1. current canonical project head;
2. exact reviewed Change tip.

It applies only the reviewed realization, records `change.completed`, and advances canonical and Change refs under expected-head compare-and-swap. First-parent history remains canonical Project state; second-parent ancestry preserves complete Change collaboration and implementation lineage.

Rejected, deferred, and withdrawn outcomes advance only the managed Change ref, never canonical project history. Delivery, publication, remote push, release, deployment, and observed outcome remain later separately authorized effects.

### External work

Unmatched Git commits are captured without advancing user or canonical refs. If exact bytes match one current Committed Change, Work Unit, base/dependencies, scope, and authority, they may enter the same Implementation Gate as an external-provenance Work result but inherit no DSH receipt. Otherwise they become Change Intake Material. External usefulness, local tests, provider review, or repository access never implies accepted intent, integration, completion, or Delivery.

### Accountability

The final authenticated Actor who executes `commitChange` owns the complete accepted intent. Earlier proposal contributors, producing Agents and DSH Runs, deciding Actor, Check executors, reviewers, and mechanical Project Server committer remain separately attributable through Trace and Git. Attribution grants no permanent lock, veto, or future authority.

## Four lifecycle stages

CodeWiki has exactly four stages:

```text
Decision -> Planning -> Implementation -> Review
```

They are phases of one Change lifecycle, not peer workflow engines.

### Decision

Decision aligns user intent before material implementation. Decision Agent is the only user-facing CodeWiki Agent role. It may query exact current and proposed Wiki/Dictionary Views and prepare proposal bytes, but cannot authenticate itself, select Checks, write refs, or commit a Change.

Decision Gate judges the exact Proposed Change tip. It always includes fixed Change-type/realization alignment and Wiki semantic-alignment Checks plus applicable project Decision Checks. A passed Gate grants eligibility only. Authenticated `commitChange`, `rejectChange`, `deferChange`, `resumeChange`, or `withdrawChange` commands create lifecycle authority.

### Planning

Planning runs only for a Committed Change with `realization: project`. It maps exact committed Wiki Item/facet targets to singly owned Work Units, dependencies, scope, capabilities, custody, and verification. It does not restate accepted outcome prose or select Workers/providers.

Planning retains project-owned Check Packs. Fixed structural validation checks complete ownership, valid target refs, acyclic dependencies, overlap ordering, bounds, and identities. A separate type-conditioned Planning Gate judges decomposition quality, feasibility, risk, parallelism, and Review strategy. Passing planning facts append to Trace.

There is no separately writable canonical Work Graph. Change Trace planning operations own Work Units and edges. Global Work View and readiness derive across active Traces.

### Implementation

Project Server schedules ready Work Units, creates Claims/Assignments and isolated Git worktrees, then authorizes bounded Worker DSH Runs. Workers receive exact committed Wiki targets and read-only Wiki tools. They may modify only admitted project-artifact scope and cannot edit accepted Wiki, Trace, managed refs, authority, or lifecycle.

Each Work result is a full Project commit/tree. Implementation Gate active Checks derive from exact stage Pack snapshots, Change type, Work Unit subtype/scope, and subject facts. Passing current work integrates onto the managed Change ref through expected-tip compare-and-swap. Git ancestry is integration lineage; Trace records semantic admission and exact OIDs. No private integration-lineage authority or duplicate aggregate record exists.

### Review

Review starts after every current required Work Unit is passing, dependency-complete, and integrated. It compares one exact integrated full Project snapshot with the Committed Change and current canonical Project state. Review active Checks cover complete target realization, cross-unit behavior, full build/integration, provenance, scope, and applicable type-specific policy. Authenticated human review may enter as exact Evidence when active Checks require it; it never replaces Gate or Project Server authority.

A failed Gate leaves the Change committed and incomplete. Work defects return to Implementation, decomposition defects to Planning, and meaning defects to a Superseding Change. A passed current Gate makes the exact Change tip eligible for Completion Commit. Delivery remains separate.

## Checks, active selection, and Gates

Project Check Packs remain under:

```text
.codewiki/check-packs/<stage>/<pack>/
  skill/<skill-name>/**        # optional producer guidance
  <check-id>/
    check.json
    CHECK.md | CHECK.mjs
```

Stages are `decision`, `planning`, `implementation`, and `review`. Packs are editable project policy. Installation and adoption are passive; bootstrap/startup/upgrade never silently restore deleted or edited content. Fixed Kernel structural checks remain Build-bound code and are not hidden Packs.

### Active-Check resolver

Gate construction uses one deterministic resolver:

1. load and validate every exact Pack snapshot for the stage;
2. add fixed required Kernel semantic Checks for that stage;
3. treat a Check with no applicability selector as active;
4. evaluate optional positive allowlists over `changeType`, `realization`, Work Unit subtype, and exact subject facts;
5. reject unknown selector fields, values, negative rules, arbitrary expressions, or incomplete subject facts;
6. sort active Check identities canonically;
7. bind resolver Build identity, selector inputs, full available policy, active set, omissions, and digest into Gate.

The minimum selector language is conjunction across declared fields and membership within each field's positive allowlist. No Agent, Worker, route, proposal, or Client selects Checks. Invalid policy stops Gate construction. Decision's fixed type-alignment Check protects against using classification to suppress policy.

### Gate and Check Run

Gate itself binds stage, exact subject commit/tree, Change/ref identity, Pack snapshots, frozen classification, active Checks, declared View/Evidence/configuration inputs, routes/execution identities where relevant, complete coverage, resolver identity, and digest. There is no separate Gate Evaluation Package.

Each attempt to execute one active Check is a Check Run. A retry is a new Run. Completed execution yields at most one immutable `passed` or `failed` Result. Timeout, cancellation, unavailable capability, missing input, malformed output, stale identity, or exhausted retry yields no Result.

Gate outcome is:

- `passed` when every required active Check has a current passing Result;
- `failed` when any required active Check has a current failed Result;
- `stopped` when required operational material or Result is unavailable.

Model Checks run through isolated DSH Runs. Project-authored Model Checks are tool-free in the SK3 minimum. A fixed Kernel semantic Model Check may receive only explicitly Gate-declared bounded read-only Wiki/View tools. Deterministic Code Checks run in separate credential-free, network-denied admitted sandboxes. Checks cannot mutate subjects, choose lifecycle stages, grant exceptions, or perform effects.

## Wiki and document graph

Wiki Item is the sole first-class semantic unit. One common envelope carries `itemId`, `itemType`, title, aliases, attributes, directed relationships, provenance, and body. Stable Item ID establishes identity. Normal authoring uses meaningful lowercase category directories and kebab-case filenames; title changes do not auto-rename files, and explicit moves preserve ID through Git history. Hash-derived paths remain valid historical/import artifacts, while content hashes and Git OIDs provide integrity rather than human navigation.

Definition Items and Claim Items are typed Wiki Items:

- `codewiki.wiki:definition` governs one reusable or ambiguous meaning/sense;
- `codewiki.wiki:claim` governs one independently sourced, temporal, disputed, or mutable assertion.

SK3 minimum does not add a second Definition/Claim store, required profile marker, persisted Term entity, mapping entity, or executable semantic DSL. Definition title/aliases/body/relationships provide minimum meaning. Claim-specific structured subject/predicate/object and valid-time fields remain a later governed extension when concrete query clients require them. Ordinary prose and relationships remain ordinary Wiki Item content; not every noun becomes a Definition and not every sentence becomes a Claim.

Dictionary is a derived View from Definition Items over one exact commit or Proposed Change tip. It returns zero, one, or several senses and never silently treats term equality as identity. Claim is accepted Wiki meaning that may cite Evidence; it is not Evidence itself. Trace lifecycle events are not Claims.

Canonical semantic links target Item IDs. Search, backlinks, history, attribution, semantic diff, graph, lexical, and vector facilities are bounded Views. Every response identifies repository, exact source OID or Change tip, derivation identity, authorization/redaction, coverage, ordering, truncation, freshness, unknowns, citations, and exact versus approximate channel. Approximation retrieves candidates only.

## Agent Wiki enforcement

CodeWiki makes Agents use Wiki through four controls:

1. **Teach** — every governed DSH Run receives an immutable Kernel-owned role contract that project Skills cannot weaken.
2. **Equip** — Project Server supplies exact mandatory target Items/Definitions and bounded read-only tools such as `wiki.get`, `wiki.list`, `wiki.search`, `wiki.resolve`, `wiki.links`, `wiki.history`, `wiki.diff`, `change.get`, and stage-specific status queries.
3. **Constrain** — tools are fixed to exact Project/Change snapshots; role capabilities prevent unauthorized Wiki, Trace, ref, lifecycle, and artifact writes.
4. **Verify** — type-conditioned stage Checks judge actual outputs against committed meaning and exact receipts.

Run authorization binds repository, project commit, Change/ref tip, stage subject, role, authority, relevant Item IDs/blobs, Definitions, relationships, active Checks, capabilities, writable scope, budgets, and feedback. DSH owns internal Session recovery and compaction. Changed semantic input or retry creates another DSH Run. Tool-call theater is not proof of understanding; Results and exact outputs matter.

Decision may propose Wiki changes. Planning maps Work Units to committed targets. Workers modify artifacts only. Review compares realization. Model Checks receive only Gate-declared inputs. Meaning gaps return to Decision or a Superseding Change.

Stage outputs cite Change IDs, Work Unit IDs, Item/facet references, and Git OIDs rather than copying Wiki outcome prose. The ordinary DSH Run receipt already binds exact visible Wiki inputs, queries, outputs, and Gate context; SK3 adds no standalone Wiki Usage Receipt.

Durable learning enters accepted Wiki meaning, project Check policy, or explicit Change feedback. Repeated mistakes never become hidden cross-Run Agent memory or an unreviewed private semantic store.

## Public API and Client SDK

Semantic operation names are version-neutral. Persisted envelopes, adapters, transport profiles, and fixtures carry versions. HTTP/local transports and Client SDKs add no hidden command, authority, or lifecycle state.

### Minimum reusable SK3 read boundary

Implement and externally qualify these authenticated read-only capabilities first:

- Project discovery and capability document;
- operational status and exact canonical/Change heads;
- exact Wiki Item get/list;
- bounded lexical search with exact source receipt;
- outgoing/incoming links;
- Definition resolution and usages;
- Item history and attribution;
- semantic diff between exact commits or one Proposed Change tip and its base;
- pending Proposed Changes, Decisions, Gates, active Checks, Results, Work, and Review status;
- proposed-Change-tip View receipts;
- read-only role/capability discovery.

Every source selector resolves once to an explicit Git OID. Exact ID reads and direct scans fall back to Git when indexes are absent. Stale or incomplete indexes report limitations and cannot answer exact queries silently.

### Mutation boundary

After source contracts adopt the new Change/Gate model, expose authenticated `proposeChanges`, revision, Decision outcome, Planning, Work admission, Review, and protected-effect commands with Actor-scoped idempotency and expected-head/tip compare-and-swap. External applications and Agents never write `.codewiki/**` or managed refs directly.

Initial external reference client is a thin read-only Omarchy Agent Skill and shell panel built in a separate repository. It uses authenticated Client SDK/API only, receives least privilege, and tests only against packed immutable qualified CodeWiki releases. It must not read `.codewiki/**` directly or claim to sandbox arbitrary Omarchy plugins.

## Refactoring map

Target source changes remove duplicated semantic owners while retaining readers for accepted historical protocols where needed.

| Current area | Target |
| --- | --- |
| `src/changes/completion-requirement.ts`, `src/changes/trace/v13-requirements.ts`, and requirement reducers | Delete target requirement authority; derive goal from Committed Change Wiki meaning and stage facts. |
| Candidate schemas plus `src/changes/trace/semantic-kernel.ts` Candidate operations | Replace with exact Proposed Change tips, Work result commits, and reviewed Change tips while retaining historical readers. |
| `src/changes/git-lifecycle.ts`, disposition reducers, `accepted_incomplete`, and confirmation transitions | Implement Change Commit/Completion Commit parent order and Proposed/Committed/Completed/Rejected/Deferred/Withdrawn reduction. |
| `src/checks/gate-package.ts` and Check Invocation bindings | Fold exact inputs and active Checks into Gate; rename target execution attempt to Check Run. |
| `src/loops/planning/work-graph.ts` and `CanonicalWorkGraphBody` | Store Change-owned planning operations in Trace; derive Work View. |
| `src/changes/trace/integration.ts`, `src/project-server/integration/private-lineage.ts`, and private lineage state | Use Git ancestry plus Trace admission facts. |
| Implementation aggregate and Review Attempt duplication | Review exact integrated Change tip directly. |
| `src/runtime/contracts.ts` / `RunSessionBinding` semantic exposure | Replace public semantic boundary with DSH Run authorization/receipt; keep DSH Session mechanics internal. |
| project context snapshot/bundle authority | Use exact Run inputs and receipted bounded queries; caches remain derived. |
| `src/work-state/projector.ts` mutable status/requirement fields | Rebuild from Git, Trace, Gates, Results, Work facts, and receipts. |
| `src/knowledge/wiki-tree.ts` validation-only maps | Add reusable exact lookup/query/View services. |

Minimum code wins. Do not add a generic workflow engine, second Agent runtime, Wiki Store Plugin, backend selector, activation manifest, target Lexicon container, generic graph database, or project-local executable Plugin path.

## Implementation sequence

### SK0 — universal contracts — complete

Qualified stable semantic identity, Change/Trace foundations, and migration contracts. Historical exact schemas remain in `SEMANTIC_KERNEL_SK0_CONTRACTS.md`.

### SK1 — Git-native semantic contracts — complete

Qualified mandatory Git store, universal Wiki Item encoding, native ref/commit validation, and domain-free semantic foundations.

### SK2 — governed KB-to-Wiki migration — complete

Qualified and activated target roots, 47 Wiki Items, append-only Change traces, Domain-free config `2.0.0`, Backend Build `3.0.0`, endpoint-byte recovery, and bounded rollback. Migration machinery is stopped-only historical transition code.

### SK3A — exact design admission

- [ ] Update active plan, Wiki Items, diagrams, and reduced README together.
- [ ] Validate every Item envelope, relationship, link, body limit, diagram, LSP diagnostic, Lens diagnostic, and `git diff --check`; run the full suite, require proposal-relevant checks to pass, and record the 27 stale executable-drift failures without claiming a green suite.
- [ ] Produce one exact documentation diff hash.
- [ ] Obtain explicit exact-byte authorization.
- [ ] Admit the design through normal governed Change lifecycle using an immutable released controller.

No SK3 source implementation begins before this slice completes.

### SK3B — Change, Gate, and Work contract cut

- [ ] Replace stale `.codewiki/kb/**`, `.codewiki/traces/**`, and Domain-config test assertions with current Wiki/Change roots without recreating dual authority.
- [ ] Add new Change type/realization and lifecycle contracts with frozen fixtures.
- [ ] Implement full-snapshot proposal, Change Commit, and Completion Commit validation and expected-head/tip CAS.
- [ ] Remove target Completion Requirements, Candidate authority, dispositions, Gate packages, private integration lineage, and canonical global Work Graph.
- [ ] Implement Gate active-Check resolver and Check Run contracts.
- [ ] Retain explicit historical readers/migration fixtures without dual target writes.
- [ ] Rebuild WorkState and Alignment from new owners.

### SK3C — transactional Wiki and Views

- [ ] Promote validation maps into exact commit/Change-tip Wiki lookup services.
- [ ] Implement Item get/list, bounded lexical search, links/backlinks, Definition resolution, history, attribution, and semantic diff.
- [ ] Bind complete View receipts and exact Git fallback.
- [ ] Preserve and validate readable portable paths for existing and new authoring without making path identity.
- [ ] Prove Item moves preserve stable IDs, relationships, attribution, and Git history.

### SK3D — authenticated read API and Client SDK

- [ ] Publish Project discovery, capabilities, status, Wiki, Change, Gate, Result, Work, and Review read operations.
- [ ] Add local/HTTP transport profiles and versioned envelopes over version-neutral semantics.
- [ ] Enforce Actor/client separation, AuthZ/redaction, source selection, bounds, cursors, and receipt verification.
- [ ] Externally qualify package/API use from disposable projects.

### SK3E — mutation API and lifecycle

- [ ] Publish atomic `proposeChanges` and expected-tip revision operations.
- [ ] Publish authenticated Decision, Planning, Work integration, Review, completion, and protected-effect commands.
- [ ] Prove all-or-none batch admission plus independent later outcomes.
- [ ] Prove stale-write rejection, explicit reconciliation, compensation/supersession, and recovery.

### SK3F — DSH Agent roles and Wiki enforcement

- [ ] Bind explicit Decision, Planning, Worker, Review, and Model Check routes.
- [ ] Implement Kernel-owned role instructions, exact mandatory Wiki context, bounded tools, capability separation, and DSH Run receipts.
- [ ] Prove Workers cannot mutate Wiki/Trace/refs and project Skills cannot weaken role contracts.
- [ ] Qualify deterministic Code Check sandboxes separately from Model Check DSH Runs.

### SK3G — external reference client

- [ ] Build Omarchy read-only Agent Skill and shell panel in a separate repository.
- [ ] Show status, pending Decisions, Gates/Checks, drift/Alignment, and handoff through public API only.
- [ ] Test against packed immutable qualified release with least-privilege credentials.

### SK4 — Plugins and protected external effects

Generalize admitted source, remote, workspace, verification, integration-preparation, and Delivery mechanics through bounded Plugin Request/Receipt contracts. Plugins never write canonical/managed refs, create Results, grant AuthZ, or complete Changes.

### SK5 — Raw Data and temporal Evidence

Add policy-bound private Raw Data revisions, Evidence lineage, freshness, retraction, contradiction, and valid-time query extensions. External connections may open Change Intake but never write Wiki.

### SK6 — DSH/Execution Host qualification

Consolidate legacy Runtime protocols behind the DSH Run boundary, prove exact context/capability/receipt closure, and qualify Linux x64 containment without translating opaque DSH Session bytes.

### SK7 — cross-platform qualification

Support remote Linux clients first. Qualify WSL2/native Windows/macOS only when containment, paths, credentials, recovery, and evidence meet the same contract. Partial support is labeled partial.

## Qualification rules

Every executable slice must:

1. start from one exact clean committed subject and exclude unrelated user files;
2. preserve verified prior-state backup and bounded recovery;
3. add focused invariant, failure, replay, migration, concurrency, and recovery tests;
4. run primary LSP diagnostics before build/test work;
5. pass typecheck, build, focused tests, full tests, production tests, readiness, package installation, and applicable external lifecycle gates;
6. pass diagnostics ratchet and dependency/security audits;
7. regenerate affected protocol, package, Runtime/Kernel Build, and Release identities;
8. prove expected-head/tip stale-write rejection and deterministic restart;
9. run packed installs only in disposable external projects;
10. use released controller N and accepted protected-head policy to govern committed candidate N+1;
11. leave no runtime/views roots, package tarball, credential, DSH Session, socket, cache, daemon, or project-local package link in this checkout;
12. reject cryptographic self-reference or hash fixed-point construction; hash only complete bytes and cite them from enclosing/successor records;
13. preserve the 10,000-character legacy System Component and 8,000-character Recovery Flow body limits until an explicitly governed schema change;
14. ship one reviewed green commit per bounded slice.

## Deliberate deferrals

SK3 minimum does not include:

- rich CodeWiki App UI;
- standalone persisted Dictionary or Term entities;
- mandatory structured Definition/Claim profiles or full valid-time Claim query algebra;
- semantic auto-merge or model-authored conflict resolution;
- generic workflow/ontology/rule engines;
- graph database authority;
- direct external Client filesystem access;
- project-local executable Plugins;
- arbitrary Agent sandbox claims;
- deployment completion coupled to local Change completion.

These remain future governed Changes only when concrete clients and qualification evidence justify added complexity.
