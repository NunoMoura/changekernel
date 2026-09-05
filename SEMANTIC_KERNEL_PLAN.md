# Semantic Kernel Refactoring Plan — Active Ledger

## Authority

This file is the sole active CodeWiki refactoring roadmap, status ledger, qualification record, and archive checklist. `.codewiki/wiki/**` is desired-state design truth. `src/**` and `tests/**` are executable truth. Git is history and checkpoint evidence. `README.md` is orientation only. Historical plans remain unchanged.

Wiki does not directly authorize source work. Every implementation change must map to an incomplete item below. Unscheduled gaps enter this ledger before source changes. Wiki records stable behavior; this plan alone records cutover mechanics, temporary gaps, sequencing, evidence, and deferrals.

No mutable checkout governs or qualifies itself. Native Pi, Git, deterministic checks, and human authority are bootstrap and recovery paths. After bootstrap, immutable externally installed Product N governs exact committed release candidate N+1. Candidate N+1 never enters Product N's module graph or qualification authority.

The transitional bootstrap distinguishes engineering checkpoints from release candidates. SK3C–SK3F land as ordinary immutable commits with clean exact-commit checks and one bounded CI receipt; they receive no admission, completion, package activation, or controller claim. Product N remains the sole semantic controller. Only an intentionally frozen release candidate receives external Product N qualification and one exact human activation decision. Controller promotion occurs only at the explicit SK3G quiescent handoff below; source and target controllers never overlap.

Creating a commit or moving an unprotected development ref is not a lifecycle effect and needs no prospective-OID authorization. Every packed identity is nevertheless immutable: one package name/version maps to exactly one archive digest, source commit/tree, Product Build, and Kernel Build. A correction receives a new commit and, after release-candidate freeze, a new package version.

A checklist implementation item may be marked complete when its exact engineering checkpoint and CI receipt pass. Release, activation, handoff, and dogfood items additionally require their stated external qualification and human authority. Activation alone never implies controller promotion.

## Activated baseline

CodeWiki remains private pre-production software. Released controller N is unpublished private package `@nunomoura/codewiki@0.3.0`, source commit `adc272d0d9b8f228fc8cedb150c8c6371c823997`, package SHA-256 `63e926d638e0f74f0e785cf8ab6222bb45ee04abfb6e848501b29de99726489d`. Transitional checkpoint and release-candidate packages must use unique prerelease versions; `0.3.0` may never identify different bytes.

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

Immutable activated Product N remains the only semantic controller throughout SK3B–SK3F. Exact engineering checkpoints receive clean committed-subject CI receipts but no release lifecycle. Product N performs full external qualification only for an intentionally frozen SK3G release candidate. Checkpoint commits, packages, or passing tests never transfer project authority to the candidate.

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

- [x] Qualify and activate the exact Wiki/roadmap cutover amendment before source work. Qualification must also preflight the released-controller-generated admission and completion Trace snapshots against candidate tests; a candidate test may enforce one Trace per Change and exact closed historical seeds, but never freeze the repository-wide Trace count. An accepted-incomplete Trace may freeze only its immutable prefix and reducer-valid state, never its total operation count.
- [x] Seal activated legacy commit/tree, tags, release artifacts, qualification evidence, and verified Git bundle.
- [x] Preserve the uncommitted exploratory overlay externally; retain no overlay byte by default.
- [x] Freeze subsystem donor manifests with structural search, LSP references, dependency graphs, public exports, tests, and dynamic-entrypoint analysis.
- [x] Freeze the target file/export/test allowlist and architecture rules.
- [x] Replace the active source/test tree with the minimal target skeleton; do not relocate obsolete code into active archive directories.
- [x] Implement canonical values, typed outcomes, identity/digest primitives, Product-fixed policy value containers, target package composition, and architecture gates.
- [x] Implement native `codewiki.component:ownership`; assign semantic roles to lifecycle/check owners and exact ownership to `.codewiki/config.json`, `.codewiki/check-packs.lock.json`, `package-lock.json`, and their target readers/tests.
- [x] Remove target fallback to legacy ownership metadata and prove every `codewiki.legacy:*` attribute is provenance-only outside normal semantic retrieval.
- [x] Make bootstrap create only versioned Domain-free config, empty Wiki/Change state, and passive Check Pack resources.
- [x] Prove normal target entrypoints cannot reach Domain, KB/OKF, old Trace roots, Backend/Runtime Build compatibility, project-local extensions, or migration code.
- [x] Remove obsolete root exports, scripts, test globs, source ownership, runtime hooks, and package metadata; preserve `.pi` safety/governance instructions that remain true.
- [x] Qualify and activate one exact private development checkpoint containing only the clean foundation; retain Product N as sole controller.

Success: active Product source has only target roots/layers, current Wiki/Change ownership, and no executable pre-stable semantic owner. Historical bytes remain recoverable through Git, not production imports. Checkpoint activation does not promote its controller.

### SK3C — semantic lifecycle Kernel

Accepted requirement: `cw:codewiki:requirement:xej4slpzn4cnbpoo6dsxshnacedgqbm5limjncdofnqhvl5hec7a`.

- [x] Close the bootstrap validation gap before further source work: permanent tests must pass in a clean checkout of the exact checkpoint commit; one-time migration scope checks compare explicit base and candidate identities outside the shipped suite. Abandon unpromoted commit `9e54196ff1add946ebb93e2a81a16b95c1d3f7bb`, whose clean checkout exposed the dirty-HEAD-dependent Wiki mutation test.
- [x] Assign the replacement checkpoint a unique prerelease package version so released Product N and checkpoint N+1 cannot share `@nunomoura/codewiki@0.3.0` with different bytes.
- [x] Implement canonical Wiki Item, Change Trace, Work, Gate, Check Run, Result, Evidence-reference, Product Build, and Kernel Build contracts with bounded decoders.
- [x] Define exact semantic-event ownership separately from Trace encoding/segment ownership, populate native `traceEvents` metadata atomically, and reject duplicate or unowned current events.
- [x] Implement deterministic reducers and exhaustive Proposed/Committed/Completed/Rejected/Deferred/Withdrawn transitions.
- [x] Implement full-snapshot Change/Completion parent and ordering validation. An operation inside a commit binds exact input OIDs plus fixed `containing_commit`; Git context supplies the containing result OID.
- [x] Implement Project Store port and Git adapter with complete-object validation and expected-old-OID CAS. No other target path writes canonical or managed refs.
- [x] Implement active-Check resolution, typed Gate outcomes, and Check Runner port. Safety-critical activation is universal or derived only from deterministic exact-subject facts independent of producer classification.
- [x] Define the host-neutral Preview port values and `preview.work`/`preview.verify` capability identities without importing an adapter.
- [x] Derive WorkState/Work View from Git, Trace, Gates, Results, Work facts, and receipts.
- [x] Remove target Candidate, Completion Requirement, disposition, Gate package, canonical global Work Graph, private integration lineage, and Review Attempt authority.
- [x] Model/property-test containing-commit identity, exact event ownership, replay determinism, stale-writer rejection, idempotence, conflict behavior, and crash recovery.

Implementation checkpoint facts (not completion or activation):

- Exact engineering checkpoint `ecccedede7de671e79dbc9ed042ec160a64ed583` with tree `7ab3d5fe312c0f439c5bb5dcfc527c03f7629af3` is retained on unprotected branch `bootstrap/semantic-kernel` at unique prerelease `0.4.0-sk3c.1`; Product N, `main`, governed refs, Trace, and controller state did not move.
- One clean detached-checkout receipt at `~/.local/state/codewiki/checkpoints/ecccedede7de671e79dbc9ed042ec160a64ed583/ci-receipt.json` (SHA-256 `cdab7ee1895fe9d63e4c71217f4f99478a98c4823f6d7c5996c3ece10c71c00f`) binds 158 passing tests, build, reproducible package SHA-256 `8ef9fef9cd95d777c0c04a6723966bfc5972a49eac2d2a271cc2a8b9ec7dba24`, disposable packed import, zero production vulnerabilities, diagnostics, and exact Wiki migration scope.
- Abandoned prospective commit `9e54196ff1add946ebb93e2a81a16b95c1d3f7bb` retains no ref and receives no qualification or activation.
- Pure Kernel contracts now cover native Wiki Items, Change-owned Work and planning, Change Trace `14.0.0`, semantic events and reduction, exact snapshots, Check Definitions, active-Check selection, Gates, Check Runs, Results, Evidence references, Product/Kernel Build identities, Preview values, and disposable WorkState.
- The Git Project Store adapter now uses bounded fixed plumbing, complete-object checks, deterministic commit creation, request-bound authorization digests, and expected-old-OID compare-and-swap for managed refs.
- Exactly seven native ownership records assign all 17 current semantic events once; no target Candidate, Completion Requirement, disposition, Gate package, mutable global Work Graph, private integration ref, Review Attempt, Domain contract, or Trace `13.0.0` compatibility reader was introduced.
- Root package exports, governed Change Traces, canonical refs, and controller state remain outside this implementation mutation; the replacement intentionally changes only package/Product version identity and the scheduled Wiki/process contract in addition to the bounded Kernel checkpoint.

- [x] Land one exact semantic-lifecycle engineering checkpoint with a clean committed-subject CI receipt; do not admit, complete, activate, or promote it. Retain Product N as sole controller.

### SK3D — transactional Wiki and bounded Views

Accepted requirement: `cw:codewiki:requirement:4arr3gvualjet5fk4tq2w6xqzrrsuk4jcgclvqovnh7fr5ll37aq`.

- [x] Implement exact commit/Change-tip Wiki get/list and validated transaction post-state.
- [x] Implement bounded lexical search, links/backlinks, Definition resolution, history, attribution, and semantic diff.
- [x] Bind source OID, derivation identity, authorization, coverage, ordering, truncation, freshness, unknowns, and citations into every View response.
- [x] Provide exact Git fallback when private indexes are absent or stale.
- [x] Exclude `codewiki.legacy:*` attributes from normal term resolution, search ranking, semantic diff, ownership, applicability, authorization, Agent context, and generated Views; expose them only through exact provenance inspection.
- [x] Prove Item moves preserve IDs, relationships, attribution, and history.
- [x] Property/fuzz test Item envelopes, paths, relationships, Unicode, limits, malformed repository input, and adversarial provenance fields.
- [x] Land one exact Wiki/View engineering checkpoint with a clean committed-subject CI receipt; retain Product N as sole controller.

SK3D checkpoint facts:

- Exact commit `d7835ba4ac1ff0b0fdab87876e97166d8a93bcdb` packaged uniquely as `@nunomoura/codewiki@0.4.0-sk3d.1`; 182/182 clean committed-subject tests, build, byte-identical double-pack, external packed import, production dependency audit, primary diagnostics, and fresh structural/security diagnostics passed.
- Package SHA-256 `fb45f6e9c8431b06b3e6536af0ac134261253fceadf6b74da926d62fd792a890`; the sole retained checkpoint receipt is `/home/canina7/.local/state/codewiki/checkpoints/d7835ba4ac1ff0b0fdab87876e97166d8a93bcdb/ci-receipt.json` with SHA-256 `5f6eb5fe6f590d50cb5a7ae8bc78102ccce7a4792db122f2a1df1addd90bee41`.
- No release was admitted, completed, activated, or promoted; `main` and Product N controller state did not move.

### SK3E — Project Server and authenticated read API

Accepted requirement: `cw:codewiki:requirement:bdr2py6syqr74steqtfrxaz2k6hn6tyzyjmvlwlho77upknke6nq`.

- [x] Compose Kernel with Project Store and Check Runner ports under Project Server authority; expose Agent Runtime and Preview only as unavailable typed capabilities until their qualified adapters exist.
- [x] Implement Project discovery, capability/status, exact Wiki, Change, Gate, Result, Work, Review, and Alignment reads.
- [x] Publish curated version-neutral Product UAPI/Client SDK operations, historically named Kernel API, plus explicit versioned transport envelopes.
- [x] Project user-facing reads and messages through Change, status, Work, Checks, Decisions, next action, and required user action. Keep builds, digests, refs, receipts, protocol identities, controller generations, DSH internals, and storage mechanics out of normal interaction; expose bounded technical evidence only through explicit audit or troubleshooting operations.
- [x] Enforce Client/Actor separation, AuthZ/redaction, exact source resolution, bounds, cursors, idempotence, and stable errors.
- [x] Prove no Client receives direct pure-Kernel invocation, Git writer, port/adapter handle, private-state path, credential, or moving View handle.
- [x] Land one exact API engineering checkpoint with clean committed-subject checks, including packed use from a disposable external project; do not activate it.

SK3E checkpoint facts:

- Exact commit `f71d083a1dbc8e30bf95cf3ac0487a9d8ca8e2f9` packaged uniquely as `@nunomoura/codewiki@0.4.0-sk3e.2`; 204/204 clean committed-subject tests, build, byte-identical double-pack, external packed Project Server/Client/transport use, production dependency audit, primary diagnostics, and fresh structural/security diagnostics passed.
- The diagnostic-rejected `0.4.0-sk3e.1` identity remains abandoned without a receipt. Qualified package SHA-256 is `a10d435514eedee18360c90859a2ad7504ff8473419e611241d1226d09b1b63a`; the sole retained checkpoint receipt is `/home/canina7/.local/state/codewiki/checkpoints/f71d083a1dbc8e30bf95cf3ac0487a9d8ca8e2f9/ci-receipt.json` with SHA-256 `6131e914d126186c7180472ea3ff54f76de078ff76975ce3c8b62773f9d2f93d`.
- No release was admitted, completed, activated, or promoted; `main` and Product N controller state did not move.

### SK3F — governed mutation and local lifecycle

Accepted requirement: `cw:codewiki:requirement:2jzn73ks7jsma7qrn6yatbaour2gs25uvu4z6vfj52wdemlslspq`.

- [x] Publish atomic `proposeChanges`, expected-tip revision, and Decision outcome commands.
- [x] Publish Planning, Work admission/integration, canonical reconciliation, Review, completion, and protected-effect commands.
- [x] Prove all-or-none batch proposal admission and independent later outcomes.
- [x] Before Review, reconcile the admitted Change artifact delta with current canonical history on the managed Change ref; conflicts or changed bytes invalidate affected Results and require fresh Checks.
- [x] Prove Review qualifies the exact prospective Completion project-artifact tree, Completion preserves every reviewed project-artifact byte, embedded Trace uses `containing_commit`, and canonical drift restarts reconciliation/Review.
- [x] Prove expected-head/tip rejection, explicit reconciliation, supersession, and no silent semantic auto-merge.
- [x] Fault-inject every object-write/ref-CAS/private-state boundary and prove deterministic restart.
- [x] Stress concurrent Changes, Work integration, recovery, and idempotent lifecycle commands through qualified deterministic test adapters.
- [ ] Land one exact mechanism-complete local-lifecycle engineering checkpoint with a clean committed-subject CI receipt; retain Product N as sole controller.

Current SK3F candidate evidence covers complete Wiki-only and project-realization flows through real Git storage, deterministic passed and stopped Check execution, stale-source rejection, conflicting replay rejection, multi-file Wiki mutation, lost blob/tree/commit/batch-CAS/private-facts read/write response reconciliation, independent batch outcomes after explicit revision, concurrent non-overlapping Work integration, overlapping-artifact conflict rejection, Work scope admission, canonical-drift Review restart, exact Review/Completion, accepted supersession, and atomic protected-effect recording. Exact committed-subject qualification remains before candidate sealing.

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
- [ ] Make the terminal-first Console default to plain user language: what changed, why it matters, what happens next, and whether the user must act. Technical identities remain absent unless the user explicitly requests audit or troubleshooting detail.
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

### Engineering checkpoint

Run for bounded commits while SK3 remains on Product N:

1. record unscheduled gaps in this ledger before source changes;
2. preserve unrelated user files and keep development in an isolated worktree or ordinary unprotected branch;
3. run primary LSP diagnostics, architecture/import/export checks, typecheck, build, and risk-relevant focused/property/fault tests;
4. create a normal commit without prospective-OID or commit-creation authorization;
5. rerun the complete applicable suite from a clean checkout of that exact commit;
6. emit one machine-readable CI receipt binding commit, tree, package version when packed, commands, outcomes, and toolchain; and
7. delete disposable installs, copied repositories, `node_modules`, successful raw logs, and other scratch after receipt generation.

Engineering checkpoints are not release candidates and receive no admission, completion, activation, or controller claim. One-time diff/history assertions belong in checkpoint qualification with explicit base and candidate identities, not in permanent current-state tests.

### Immutable release candidate

Only when an Agent-capable SK3G or stable SK3H outcome is coherent:

1. assign a unique package version and freeze one candidate manifest binding controller N, exact source commit/tree, package SHA-256, Product Build, Kernel Build, and policy;
2. run clean exact-commit tests plus only the architecture, security, supply-chain, recovery, and hostile-input gates applicable to changed risk;
3. reproduce the package and install those exact bytes only in disposable external projects with isolated settings and owner-private state;
4. use immutable Product N to qualify the exact manifest and emit one qualification receipt;
5. retain exactly one content-addressed package/bundle, candidate manifest, qualification receipt, exact human authorization bytes, and activation receipt—never copied per attempt;
6. obtain one exact human decision only for activation, then execute the backup-first compare-and-swap activation or SK3G controller handoff; and
7. retain Product N and its verified backup through the stated rollback cutoff.

A failed or corrected release candidate receives a new commit and package version. Failed scratch is retained only when needed to diagnose the bounded failure; all other attempt state has a short cleanup TTL. Release activation never silently changes the controller.

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

This plan remains active until every non-deferred implementation item is bound to an exact clean-checkpoint receipt, the SK3G and SK3H release items are externally qualified and activated, the final exact Alignment audit finds no unowned gap between Wiki and executable behavior, the package/API surface is intentionally frozen, and repeated Product N→N+1 dogfood proves recovery without candidate self-governance.

Closure records checkpoint commit/tree receipts, unique released package digests, final qualification/authorization/activation receipts, explicit deferrals, supported predecessor/host matrices, and archive identity. Generated summaries are views, not additional authority. The plan is then archived as historical evidence and removed from active navigation. Wiki remains desired-state authority; source/tests remain executable truth; roadmap status never migrates into Wiki.
