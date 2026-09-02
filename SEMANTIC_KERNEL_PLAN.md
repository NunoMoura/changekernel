# Semantic Kernel Refactoring Plan — Active Ledger

## Authority

This file is the sole active CodeWiki refactoring roadmap, status ledger, qualification record, and archive checklist. `.codewiki/wiki/**` is desired-state design truth. `src/**` and `tests/**` are executable truth. Git is history and checkpoint evidence. `README.md` is orientation only. Historical plans remain unchanged.

Wiki does not directly authorize source work. Every implementation change must map to an incomplete item below. Unscheduled gaps enter this ledger before source changes. Wiki records stable behavior; this plan alone records cutover mechanics, temporary gaps, sequencing, evidence, and deferrals.

No mutable checkout governs or qualifies itself. Native Pi, Git, deterministic checks, and human authority are bootstrap and recovery paths. After bootstrap, immutable externally installed Product N governs exact committed candidate N+1. Candidate N+1 never enters Product N's module graph or qualification authority.

Release activation and controller promotion are distinct. SK3B–SK3F may activate immutable qualified checkpoint packages, but Product N remains the sole semantic controller. Controller promotion occurs only at the explicit SK3G quiescent handoff below; source and target controllers never overlap.

A checklist item is marked complete only when its bound release subject is externally qualified, explicitly authorized, and activated. Inner-loop commits and green development checks are evidence, not release completion. Activation alone never implies controller promotion.

## Activated baseline

CodeWiki remains private pre-production software. Package `@nunomoura/codewiki@0.3.0` is unpublished and private.

### Completed semantic releases

- **Backend v1, SK0, and SK1** — qualified historical foundations.
- **SK2** — governed KB-to-Wiki migration activated at `7b4e5e9021b27ff09f6f93569bb2a93c1fb0ebdf`; current semantic roots are `.codewiki/wiki/**` and `.codewiki/changes/**`.
- **SK3A** — exact desired-state Wiki and roadmap admission:
  - candidate commit `985bc1bd0a77dece9be08829844bb32da4cfac61`;
  - candidate tree `096a1169de7e49c12db42527e88cf86ede2c9207`;
  - patch SHA-256 `58eb472d9a4cfe7189691288c7eb120487e969f18898f012d669ff1db15a8360`;
  - authorization `sha256:7022ddecf05975ee8db95315fb9be0b00178782008d64a106bf96612efcf787c`;
  - qualification report `sha256:9ac91bbb7fa41762f292509693f687b0662e5da6f69c79fc775afdd87820b0e2`;
  - activation commit `927e21f863ca954ba7826d771b8556dfe236827e`;
  - activation tree `75ecaca3765023c4f0ae5f3848da86227f69d5f5`;
  - activation report `sha256:bc6fa831f089ad1833237d984877cd1a059a2639c13b2cb3dff9fd7e6946188e`.

`CHG-sk3a-exact-design-roadmap` is accepted incomplete. Its SK3B–SK3H outcomes remain binding until a later governed Change explicitly supersedes them. Historical target refs to retired Item IDs remain evidence; retirement never reassigns an ID.

### Current truth boundaries

```text
.codewiki/wiki/**        desired Project meaning
.codewiki/changes/**     append-only lifecycle truth
src/** and tests/**      current executable behavior
Git                      exact bytes, ancestry, refs, history, checkpoints
external private state   credentials, DSH/Preview internals, caches, worktrees, raw evidence
```

`.codewiki/kb/**`, `.codewiki/traces/**`, `.codewiki/runtime/**`, `.codewiki/views/**`, generated Wiki indexes, project-local CodeWiki packages, and controller pins must remain absent.

## Current gap and overlay disposition

A post-SK3A audit found broad executable drift, dead architecture, API sprawl, cycles, duplication, stale source ownership, and compatibility leakage. An uncommitted SK3B overlay explored those cuts. It is not an authorized candidate.

Before source cutover:

- preserve the overlay's exact status, patch, tests, and audit notes outside the governed checkout;
- preserve pre-existing untracked `outputs/` unchanged;
- treat overlay files only as donor/research evidence;
- do not merge or transplant any dependency closure wholesale;
- re-evaluate every behavior against current Wiki and the allowlist below.

The documentation amendment that establishes this cutover must itself be frozen, externally qualified by immutable Product N, authorized, and activated before target source edits begin.

## Cutover rules

1. Keep this repository and package identity. Do not create a replacement Product repository.
2. Preserve obsolete implementation in immutable Git history, release artifacts, and a verified Git bundle.
3. Do not keep active `legacy/**`, `old/**`, archive-source, or dual architecture directories.
4. Build in an isolated clean worktree/branch from the activated baseline.
5. Create the target tree from an allowlist. Old files have no presumption of migration.
6. For each subsystem, freeze old files, exports, references, tests, accepted invariants, and dependency closure before changing it.
7. Classify each behavior as `transplant`, `rewrite`, `defer`, or `delete`. A dependency chain that imports old architecture is a rewrite signal.
8. Retain no pre-stable compatibility reader without an identified external subject, exact predecessor bytes/schema, owner, expiry, and qualification evidence.
9. Normal startup reads only current Wiki/Change roots and never migrates, repairs, or dual-writes semantic state. The sole exception is the explicit one-shot SK3G handoff converter; it is unavailable after handoff.
10. Exclude `codewiki.legacy:*` provenance from normal term resolution, search, semantic diff, ownership, applicability, authorization, Agent context, and generated Views.
11. Keep one Product, one semantic controller, and one release lineage. Do not create Forge, a Dev controller product, a Pi wrapper, or another lifecycle authority.

## Target source architecture

The target production allowlist is:

```text
src/
  kernel/
    canonical/
    identity/
    wiki/
    changes/
    work/
    gates/
    evidence/
    index.ts
  server/
    authorization/
    intake/
    lifecycle/
      decision/
      planning/
      implementation/
      review/
    commands/
    queries/
    projections/
      alignment/
      work/
    recovery/
    effects/
    index.ts
  ports/
    project-store.ts
    check-runner.ts
    agent-runtime.ts
    preview.ts
  adapters/
    git/
    checks/
    dsh/
    preview/
  api/
    contracts/
    transport/
    client/
    index.ts
  product.ts
  index.ts
```

Tests mirror target ownership under `tests/kernel/**`, `tests/server/**`, `tests/ports/**`, `tests/adapters/**`, `tests/api/**`, `tests/product/**`, and `tests/package/**`. Benchmarks remain outside the shipped package.

Required dependency graph:

```text
api -> server -> kernel
server -> ports
ports -> public Kernel values
adapters -> ports + public Kernel values
product composition -> server + adapters
kernel -X-> server, adapters, process, network, UI, providers, DSH, Preview
```

Rules:

- Kernel is deterministic mechanism, never Project Server or runtime. Product-fixed role/check policy enters as immutable validated data rather than executable Kernel behavior.
- Project Server is sole semantic control plane and authorizes every managed-ref write through Project Store.
- Project Store, Check Runner, Agent Runtime, and Preview are separate narrow host-neutral ports; adapters own effects.
- DSH implements Agent Runtime and AI/model-provider mechanics. It does not own semantic authority or Git, Delivery, remote, or Preview effects.
- `preview.work` is scoped producer feedback; `preview.verify` is independent exact-subject observation. Neither Preview mode returns Gate authority.
- Public package exports come from one reviewed manifest. Kernel API is Project Server-served Product UAPI; internal modules are private.
- No generic `utils/**`, broad `runtime/**`, backend selector, dynamic semantic Plugin, or cross-layer barrel may hide ownership.
- System Component Items declare target ownership only through `codewiki.component:ownership`. Semantic roles belong to lifecycle/check owners, singleton config and lock files have exact owners, and target readers never use `codewiki.legacy:*` metadata outside explicit provenance inspection.
- Architecture checks enforce roots, imports, cycles, exports, ownership coverage, and forbidden edges from the first target commit.

## Controller continuity and SK3G handoff

Immutable activated Product N remains the only semantic controller throughout SK3B–SK3F. It externally qualifies each exact committed checkpoint and performs any governed release admission/activation. Checkpoint installation, package activation, or passing tests never transfers project authority to the candidate.

The SK3G handoff must account for exact predecessor state rather than pretending a fresh bootstrap:

```text
.codewiki/config.json                 codewiki.project-config@2.0.0
                                      inherited role routes; worktreeIsolation=none
.codewiki/check-packs.lock.json       codewiki.check-pack-lock@1.0.0
                                      source.kind=domain
three active Trace headers            codewiki.change-trace@13.0.0
active Trace operation protocol       codewiki.change-trace-operation@1.0.0
SK3A Change                           accepted_incomplete; SK3B–SK3H remain open
```

Product N first qualifies one exact SK3G Product/package closure and offline one-shot converter outside the candidate checkout. Exact state conversion is qualified only after handoff freeze. Handoff then proceeds in this order:

1. stop admission of new Runs, Checks, Preview handles, protected effects, and ref writes under Product N;
2. prove all process/effect custody terminal or quiescent and freeze exact project/managed refs;
3. create and verify complete repository, owner-private state, config, lock, and controller-state backups;
4. under immutable Product N, dry-run conversion and replay against the exact frozen subject in a disposable external project, producing a qualification report bound to the exact handoff input, expected output, genesis mapping, Product, and converter;
5. obtain explicit authenticated human authorization for those exact qualified bytes, controller state, and rollback cutoff;
6. terminate Product N and prove no source-controller process or writer remains;
7. with neither controller running, execute the bounded offline converter as a recovery mechanism—not a semantic controller;
8. preserve predecessor Trace bytes in Git, create exact new genesis/handoff facts that link historical Change/requirement identities and carry unresolved SK3H work, and replace obsolete config/Domain-sourced lock semantics atomically;
9. verify converted bytes equal the authorized output, then compare-and-swap external controller state to exact SK3G and start it as sole controller;
10. prove replay, current authority, refs, open requirements, and no source-controller process before permitting new work.

No source/target controller overlap is allowed. Rollback is permitted only before the fixed cutoff and only by restoring the complete verified backup; after the target performs its first authoritative write, recovery is forward-only. Normal SK3G startup cannot invoke the converter or read unsupported predecessor state.

## Milestone ledger

### SK0 — universal contracts — complete

Qualified historical semantic identity and migration foundations. See `SEMANTIC_KERNEL_SK0_CONTRACTS.md`.

### SK1 — Git-native semantic contracts — complete

Qualified mandatory Git storage, universal Wiki Item encoding, ref/commit validation, and Domain-free foundations.

### SK2 — governed Wiki migration — complete

Qualified Wiki/Change roots and repository migration. Historical migration machinery is not target Product architecture.

### SK3A — exact design and roadmap admission — complete

- [x] Establish Wiki as desired-state authority and this file as sole active ledger.
- [x] Qualify exact candidate `985bc1bd...` externally with immutable controller `adc272d0...`.
- [x] Obtain exact-byte authorization and accept `CHG-sk3a-exact-design-roadmap`.
- [x] Activate merge `927e21f...` without changing candidate Wiki/source bytes.

### SK3B — legacy freeze and clean Kernel foundation

Accepted requirement: `cw:codewiki:requirement:xj62wfc6qeqpzvgqqpndu7h4dcrtalsleyerrfptisafmm7zlyha`.

- [ ] Qualify and activate the exact Wiki/roadmap cutover amendment before source work. Qualification must also preflight the released-controller-generated admission and completion Trace snapshots against candidate tests; a candidate test may enforce one Trace per Change and exact closed historical seeds, but never freeze the repository-wide Trace count. An accepted-incomplete Trace may freeze only its immutable prefix and reducer-valid state, never its total operation count.
- [ ] Seal activated legacy commit/tree, tags, release artifacts, qualification evidence, and verified Git bundle.
- [ ] Preserve the uncommitted exploratory overlay externally; retain no overlay byte by default.
- [ ] Freeze subsystem donor manifests with structural search, LSP references, dependency graphs, public exports, tests, and dynamic-entrypoint analysis.
- [ ] Freeze the target file/export/test allowlist and architecture rules.
- [ ] Replace the active source/test tree with the minimal target skeleton; do not relocate obsolete code into active archive directories.
- [ ] Implement canonical values, typed outcomes, identity/digest primitives, Product-fixed policy value containers, target package composition, and architecture gates.
- [ ] Implement native `codewiki.component:ownership`; assign semantic roles to lifecycle/check owners and exact ownership to `.codewiki/config.json`, `.codewiki/check-packs.lock.json`, `package-lock.json`, and their target readers/tests.
- [ ] Remove target fallback to legacy ownership metadata and prove every `codewiki.legacy:*` attribute is provenance-only outside normal semantic retrieval.
- [ ] Make bootstrap create only versioned Domain-free config, empty Wiki/Change state, and passive Check Pack resources.
- [ ] Prove normal target entrypoints cannot reach Domain, KB/OKF, old Trace roots, Backend/Runtime Build compatibility, project-local extensions, or migration code.
- [ ] Remove obsolete root exports, scripts, test globs, source ownership, runtime hooks, and package metadata; preserve `.pi` safety/governance instructions that remain true.
- [ ] Qualify and activate one exact private development checkpoint containing only the clean foundation; retain Product N as sole controller.

Success: active Product source has only target roots/layers, current Wiki/Change ownership, and no executable pre-stable semantic owner. Historical bytes remain recoverable through Git, not production imports. Checkpoint activation does not promote its controller.

### SK3C — semantic lifecycle Kernel

Accepted requirement: `cw:codewiki:requirement:xej4slpzn4cnbpoo6dsxshnacedgqbm5limjncdofnqhvl5hec7a`.

- [ ] Implement canonical Wiki Item, Change Trace, Work, Gate, Check Run, Result, Evidence-reference, Product Build, and Kernel Build contracts with bounded decoders.
- [ ] Define exact semantic-event ownership separately from Trace encoding/segment ownership, populate native `traceEvents` metadata atomically, and reject duplicate or unowned current events.
- [ ] Implement deterministic reducers and exhaustive Proposed/Committed/Completed/Rejected/Deferred/Withdrawn transitions.
- [ ] Implement full-snapshot Change/Completion parent and ordering validation. An operation inside a commit binds exact input OIDs plus fixed `containing_commit`; Git context supplies the containing result OID.
- [ ] Implement Project Store port and Git adapter with complete-object validation and expected-old-OID CAS. No other target path writes canonical or managed refs.
- [ ] Implement active-Check resolution, typed Gate outcomes, and Check Runner port. Safety-critical activation is universal or derived only from deterministic exact-subject facts independent of producer classification.
- [ ] Define the host-neutral Preview port values and `preview.work`/`preview.verify` capability identities without importing an adapter.
- [ ] Derive WorkState/Work View from Git, Trace, Gates, Results, Work facts, and receipts.
- [ ] Remove target Candidate, Completion Requirement, disposition, Gate package, canonical global Work Graph, private integration lineage, and Review Attempt authority.
- [ ] Model/property-test containing-commit identity, exact event ownership, replay determinism, stale-writer rejection, idempotence, conflict behavior, and crash recovery.
- [ ] Qualify and activate one exact semantic-lifecycle checkpoint; retain Product N as sole controller.

### SK3D — transactional Wiki and bounded Views

Accepted requirement: `cw:codewiki:requirement:4arr3gvualjet5fk4tq2w6xqzrrsuk4jcgclvqovnh7fr5ll37aq`.

- [ ] Implement exact commit/Change-tip Wiki get/list and validated transaction post-state.
- [ ] Implement bounded lexical search, links/backlinks, Definition resolution, history, attribution, and semantic diff.
- [ ] Bind source OID, derivation identity, authorization, coverage, ordering, truncation, freshness, unknowns, and citations into every View response.
- [ ] Provide exact Git fallback when private indexes are absent or stale.
- [ ] Exclude `codewiki.legacy:*` attributes from normal term resolution, search ranking, semantic diff, ownership, applicability, authorization, Agent context, and generated Views; expose them only through exact provenance inspection.
- [ ] Prove Item moves preserve IDs, relationships, attribution, and history.
- [ ] Property/fuzz test Item envelopes, paths, relationships, Unicode, limits, malformed repository input, and adversarial provenance fields.
- [ ] Qualify and activate one exact Wiki/View checkpoint; retain Product N as sole controller.

### SK3E — Project Server and authenticated read API

Accepted requirement: `cw:codewiki:requirement:bdr2py6syqr74steqtfrxaz2k6hn6tyzyjmvlwlho77upknke6nq`.

- [ ] Compose Kernel with Project Store and Check Runner ports under Project Server authority; expose Agent Runtime and Preview only as unavailable typed capabilities until their qualified adapters exist.
- [ ] Implement Project discovery, capability/status, exact Wiki, Change, Gate, Result, Work, Review, and Alignment reads.
- [ ] Publish curated version-neutral Product UAPI/Client SDK operations, historically named Kernel API, plus explicit versioned transport envelopes.
- [ ] Enforce Client/Actor separation, AuthZ/redaction, exact source resolution, bounds, cursors, idempotence, and stable errors.
- [ ] Prove no Client receives direct pure-Kernel invocation, Git writer, port/adapter handle, private-state path, credential, or moving View handle.
- [ ] Qualify packed API use from disposable external projects and activate only as a non-controller checkpoint.

### SK3F — governed mutation and local lifecycle

Accepted requirement: `cw:codewiki:requirement:2jzn73ks7jsma7qrn6yatbaour2gs25uvu4z6vfj52wdemlslspq`.

- [ ] Publish atomic `proposeChanges`, expected-tip revision, and Decision outcome commands.
- [ ] Publish Planning, Work admission/integration, canonical reconciliation, Review, completion, and protected-effect commands.
- [ ] Prove all-or-none batch proposal admission and independent later outcomes.
- [ ] Before Review, reconcile the admitted Change artifact delta with current canonical history on the managed Change ref; conflicts or changed bytes invalidate affected Results and require fresh Checks.
- [ ] Prove Review qualifies the exact prospective Completion project-artifact tree, Completion preserves every reviewed project-artifact byte, embedded Trace uses `containing_commit`, and canonical drift restarts reconciliation/Review.
- [ ] Prove expected-head/tip rejection, explicit reconciliation, supersession, and no silent semantic auto-merge.
- [ ] Fault-inject every object-write/ref-CAS/private-state boundary and prove deterministic restart.
- [ ] Stress concurrent Changes, Work integration, recovery, and idempotent lifecycle commands through qualified deterministic test adapters.
- [ ] Qualify and activate one exact mechanism-complete local-lifecycle checkpoint; retain Product N as sole controller.

Success: local lifecycle semantics and effect authorization are complete under qualified deterministic test adapters. This checkpoint is not operationally Agent-capable and cannot become controller.

### SK3G — DSH adapter and first self-dogfood

Accepted requirement: `cw:codewiki:requirement:kjmy5ktiltnicsnne6bzgfbkwrh4n4j5r6sqs4gkhwjsiajsiema`.

- [ ] Implement host-neutral Agent Runtime port and bounded DSH adapter only; do not duplicate DSH Sessions, provider/model loops, tools, compaction, sandboxing, or process supervision.
- [ ] Bind Decision, Planning, Worker, Review, and Model Check roles to exact subjects, Product-fixed role/check policy, context, routes, tools, capabilities, writable scope, budgets, and receipts.
- [ ] Give every immutable authorization one Run/idempotency identity. Prove transport retry/reconciliation reuses it and cannot duplicate semantic execution; new semantic input/attempt receives a new Run only after predecessor terminal receipt or independently proven quiescence.
- [ ] Implement Project Server cancellation requests through Agent Runtime port and qualify DSH/Execution Host enforcement, descendant custody, resource exhaustion, terminal receipts, transport loss, and recovery.
- [ ] Implement the Preview port and bounded local adapter. Qualify scoped `preview.work` handles, independent immutable-subject `preview.verify`, profile-only launch, lease/TTL, loopback/network/resource/output limits, cancellation, process-tree cleanup, and unavailable/stale behavior.
- [ ] Prove Worker Preview remains producer context; Check Preview runs fresh and only validated observation can become Evidence. Model Checks may consume prior immutable Preview Evidence but cannot launch Preview.
- [ ] Qualify every declared Linux/Node version against Secure Code address-space bounds; Node `24.14.0` currently cannot instantiate its TypeScript-stripper WASM under the `8 GiB` sandbox limit, so narrow declared support, replace the transformer, or establish and requalify a safe higher bound before claiming closure.
- [ ] Prove Workers cannot mutate Wiki/Trace/managed refs and project Skills cannot weaken role contracts. DSH AI/model routes cannot invoke Git, Delivery, remote, or other protected Plugin effects.
- [ ] Qualify deterministic Code Check sandboxes separately from Model Check DSH Runs and Preview execution.
- [ ] Run malformed output, malicious repository, path/symlink, environment/command injection, secret, network, duplicate transport, cancellation-race, stale Preview, and resource-exhaustion cases.
- [ ] Use immutable activated Product N plus DSH to develop and externally qualify one exact SK3G candidate, handoff manifest, state conversion, and genesis mapping without loading candidate code as controller.
- [ ] Execute the ordered quiescent, backup-first handoff in this plan. Preserve historical Trace bytes, carry open SK3H identity, atomically retire Product N, and start exact SK3G as sole controller only after explicit human authorization.
- [ ] Use promoted SK3G to govern one bounded SK3H operation and prove no old-controller process or unsupported predecessor reader remains.

Success: first Agent-capable private Product release completes a real Product N→N+1 cycle with exact receipts, independent human activation, one quiescent controller handoff, and zero controller overlap.

### SK3H — public-client proof and stable-development closure

Accepted requirement: `cw:codewiki:requirement:jzsvjec4kalxya5t3qpyvl2hgygje5a24fvi5bxv7qpo7z64kc6q`.

- [ ] Build the bounded read-only Omarchy reference client outside this repository using public API/SDK only.
- [ ] Test only against packed immutable qualified Product bytes with least-privilege credentials.
- [ ] Prove no direct `.codewiki/**`, private-state, internal module, or managed-ref access.
- [ ] Complete final Wiki/source/API ownership and desired-versus-executable Alignment audit, including semantic roles, Trace events, singleton config/locks, ports, adapters, and Product-fixed policy.
- [ ] Reach zero dependency cycles, zero unclassified public exports, zero unclassified unreachable production modules, and no unexplained clone-ratchet regression.
- [ ] Reproduce package bytes, dependency closure, SBOM/provenance, install behavior, backup/restore, and recovery evidence.
- [ ] Complete at least one additional Product N→N+1 dogfood cycle without semantic-state repair.
- [ ] Qualify and activate the first stable development baseline.

## Cross-cutting hardening matrix

Every applicable milestone records bounded evidence in these areas:

| Area | Required evidence |
| --- | --- |
| Architecture | Allowed roots, acyclic imports, forbidden-edge tests, ownership coverage, curated exports, no dynamic Kernel loading. |
| Semantic correctness | Examples, properties, state-machine/model tests, exhaustive outcomes, containing-commit identity, exact Review/Completion subjects, replay and differential projection checks. |
| Persistence/concurrency | Complete-object validation, CAS conflicts, concurrent writers, idempotence, reconciliation drift, crash injection, restart, rollback. |
| Hostile input | Schema/JSON/Markdown/path/Git-ref fuzzing, Unicode, depth/size bounds, malformed/corrupt repositories. |
| Security | Threat model, symlink/path escape, Git config/hooks, command/environment injection, credentials, network, least privilege. |
| Execution | DSH/Check/Preview separation, same-Run transport idempotency, cancellation races, budgets, process-tree custody/quiescence, stale handles, OOM/resource limits, receipt mismatch, and unavailable routes. |
| Supply chain | Exact locks, minimal production dependencies, audit, SBOM/provenance, package allowlist, reproducible pack, no install effects. |
| Operations | Structured non-secret errors, deterministic recovery, backup/restore, external disposable lifecycle, real self-dogfood. |

Line count, file structure, typechecking, coverage percentage, or raw test count alone never closes a hardening claim.

## Development and promotion gates

### Inner development checkpoint

Run for bounded commits while a milestone remains mutable:

1. verify clean intended scope and preserve unrelated user files;
2. run primary LSP diagnostics before build/test work;
3. pass architecture/import/export checks;
4. pass typecheck and build;
5. pass focused tests plus applicable property, replay, fault, or adversarial cases;
6. record known gaps in this ledger before moving to another subsystem.

Inner checkpoints are not candidates and receive no activation claim.

### Immutable promotion candidate

When a milestone outcome is coherent:

1. freeze one exact clean committed subject and patch identity;
2. run full smoke, production, readiness, package-install, and applicable external lifecycle tests;
3. run diagnostics ratchet, dependency/security audit, architecture, fuzz/fault, recovery, and reproducibility gates applicable to the milestone;
4. pack and test only in disposable external projects with isolated Pi settings and owner-private state;
5. prove no source-checkout CodeWiki load, project-local package link, runtime/view scratch, credential, socket, daemon, or package artifact remains;
6. use immutable activated Product N to qualify exact N+1 bytes, construct the prospective admission/completion Trace-only snapshots in a disposable external project, and rerun affected candidate tests against both snapshots;
7. obtain explicit exact-byte authorization and activate the release through protected-head policy;
8. retain Product N as sole controller unless this is the exact SK3G handoff subject and every ordered handoff condition above passes.

Any correction after candidate freeze creates another candidate/package/qualification. Mutable inner-loop corrections do not pretend to be release subjects. Release activation never silently changes the controller.

## Deliberate deferrals

The clean Kernel and first stable development baseline do not require:

- rich CodeWiki App UI;
- remote, shareable, or long-lived Preview and a general Plugin ecosystem or project-local executable Plugins;
- standalone persisted Dictionary/Term authority;
- mandatory structured Definition/Claim profiles or full temporal Claim algebra;
- graph database authority;
- semantic auto-merge or model-authored conflict resolution;
- arbitrary host/platform support beyond exact qualified Linux closure;
- deployment success coupled to local Change completion;
- active readers for unsupported pre-stable formats;
- Forge, Dev controller product, Pi wrapper, or another semantic controller.

SK4+ work remains future governed Changes only after concrete users and evidence justify complexity: bounded remote/shareable Preview Plugins and other effects, Raw Data/temporal Evidence, additional DSH hosts, and additional platforms.

## Stable closure and archive

This plan remains active until every non-deferred checklist item is bound to externally qualified and activated evidence, the final exact Alignment audit finds no unowned gap between Wiki and executable behavior, the package/API surface is intentionally frozen, and repeated Product N→N+1 dogfood proves recovery without candidate self-governance.

Closure records exact milestone commits, trees, package digests, qualification/authorization/activation artifacts, explicit deferrals, supported predecessor/host matrices, and archive identity. The plan is then archived as historical evidence and removed from active navigation. Wiki remains desired-state authority; source/tests remain executable truth; roadmap status never migrates into Wiki.
