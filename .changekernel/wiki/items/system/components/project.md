---
title: Project and Git Substrate
aliases:
  - Git Project Store
  - Project Configuration
source-id: cw:component:project
ownership:
  sourcePatterns:
    - .changekernel/config.json
    - src/adapters/git/**
    - src/ports/project-store.ts
  testPatterns:
    - tests/adapters/git/**
    - tests/ports/project-store.test.mjs
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:a204a65c2254b0b68d9a400ff44377236b770d262a693573a520ff39d5818d49
        codewiki.legacy:source-path: system/components/project.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:project
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Project Configuration supplies the System responsibility required by this Story.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
---
# Project and Git Substrate

A Project is the scoped Git-backed collaboration context, not the Project Server service operating over it. It can concern software, research, operations or other intentional work. Git is mandatory infrastructure for exact artifacts, current Wiki, intent-bearing Change records and their history. Its internal storage adapter is not an optional external-data connector.

A repository already containing tracked Markdown has a source corpus before adoption. Record observed baseline assurance honestly; do not fabricate previous Changes, reasons or validation. Discovery and binding do not authorize initialization, mutation, disclosure or execution.

## Source scope and managed knowledge

The Project is the source and effect boundary; [Wiki](wiki.md) is consolidated accepted knowledge with a predictable managed home. Sources need not move into that home or acquire Wiki metadata merely to be considered. `.changekernel/wiki/` and `.changekernel/wiki/types/` are structural locations; other Wiki folders are optional Project-specific groupings introduced through Changes. Existing source files, authored drafts and proposed knowledge remain distinguishable from accepted outcomes.

Changes govern synthesis, adoption, revision and retirement, including the evolution of document types. Runtime sessions and temporary working context are not another Project knowledge ledger. A file's location or an ordinary Git commit does not authenticate its acceptance, and a local actor with write access is not constrained by a naming convention alone.

## Check-model settings

The current internal `runtime.checkModel` bridge is a partial foundation for the unified Check model-call primitive, not an operational Check Pack system. Its optional configuration section selects the permitted model used for inference inside Checks. Its value can be `{ "modelRoute": "cw:route:local-checks" }`. An absent section, `{}` or `{ "modelRoute": "inherit" }` inherits the explicitly observed interface model. The check-model bridge rejects old `runtime.modelRouting.roleRoutes` and other unsupported runtime fields rather than silently inheriting a model. Current project configuration accepts project identity, its protocol and optional runtime data; bootstrap emits only identity and protocol, with no speculative runtime, policy or automation defaults.

A route names a backend-authorized provider/model pair; it does not register a provider, grant access or store credentials. The backend supplies accepted configuration bytes for the correct Project and a freshly authorized route catalogue. Candidate-controlled settings cannot grant themselves authority. Missing or unapproved routes fail without fallback, including when a different interface model is available.

The internal `authorizeProjectDecisionModelCheckRun` bridge combines those configuration bytes with an explicit interface route snapshot and existing Decision model check authorization. Inheritance verifies the full observed provider/model identity against the catalogue, not just a reusable route name. A selected override can work without an interface snapshot; every supplied snapshot must still be valid. The resolved route is bound to the run and cannot be changed by later settings or interface mutations.

Adopted Check/Pack identity, activation policy and execution limits also require exact versioned Project bindings; current configuration support does not implement that adoption contract. Installing a Pack or editing proposed settings cannot activate policy or authorize a model route. Local/private-only restrictions cover supporting services and forbid silent remote fallback.

This bridge neither discovers files nor observes a live interface. It does not change Store parsing, enable the read-only Console, execute a provider or activate lifecycle commands. Automatic host integration and qualified local-model execution remain separate requirements. See [ChangeKernel configuration](changekernel.md#check-execution-configuration).

## Native hot and cold paths

Accepted Changes preserve exact outcomes in Git. They can revise or remove active knowledge while retaining prior text, disposition and links to the Changes that created, revised or retired it for on-demand native history queries. Both ongoing and completed Changes can have still-applicable accepted consequences. No archive database, special historical ingestion pipeline or duplicate source corpus is needed. A file move into an archive-named directory is not semantic retirement; [Change](change-trace.md) governs that distinction.

Native history and optional external information can share bounded retrieval while preserving origin, version and authority context. Cold information is not re-adopted by being read. Current Wiki remains persistent accepted state, not merely a context cache.

## Snapshots and joins

A Change can span many commits and independent work lines; a branch is not a stage flag. Commits bind related knowledge, artifacts and records to exact snapshots. Checkpointed, accepted, realized, published and deployed are different acts. Worktrees share repository mechanisms and are not security sandboxes.

Validate the actual combined candidate against its baseline and obligations. Expected-old-OID updates reject stale writes. Do not promise stronger multi-ref observation guarantees than Git supplies. Created objects and attempted ref updates are distinct from observed acceptance; reconcile unknown outcomes before retry.

Retain reachable exact snapshots and required record references. Squash, rebase, cherry-pick or branch deletion must not discard the only surviving grounds or transfer judgments to rewritten subjects. Empty approval commits or host UI data cannot be the sole durable record; Git notes need explicit transport/rewrite handling. Retrieval cannot recover objects that were not retained, and model inference cannot replace them.

## Repository identity and purity

Root location, observed storage object format, configured Project identity, selected refs and exact source identity must agree. A path, local branch convention or cached remote ref does not identify an approved baseline. The binding safeguard below applies independently of evaluation or execution availability.

### Repository binding

Opening a Git Project Store establishes the actual repository location and Git-reported storage object format through bounded, noninteractive observation. A working-tree selection identifies that tree's root, not an arbitrary descendant or an ancestor discovered after malformed local Git state was ignored. Supported Git-file layouts, including linked worktrees, retain Git's explicit administrative-directory relationship. A bare-store selection identifies the bare repository itself; support in a storage adapter does not imply support in every Client composition.

Composition and subsequent Store operations use the same validated location and object-format binding. They do not independently guess the format, default failed observation to SHA-1, or rediscover a different repository for later commands. Empty and unborn repositories still have an observable storage format; absence of commits is not permission to invent one. This observed storage binding does not replace configured Project identity, exact snapshot identity, authorization, or semantic readiness.

The Git execution profile supplies an explicit executable, fixed arguments, isolated environment/configuration policy, and finite time/output bounds. Ambient repository-selection variables, executable search paths, hooks, helpers, or configuration overlays cannot retarget the binding or widen effects. Required local Git metadata is observed under that profile, not repaired. Failed, unsupported, malformed, ambiguous, or over-limit observation returns a typed failure without constructing a usable Store. Opening and inspection never initialize semantic state, refresh the index, run project hooks, fetch objects, or change refs.

A binding is a validated observation, not physical custody. Protecting storage against concurrent replacement, alternate writers, and direct filesystem access requires the separately qualified host/storage boundary; a path check or receipt alone does not establish it.
