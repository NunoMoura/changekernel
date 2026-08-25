---
type: System Component
codewiki_id: cw:component:domains
title: Domains
description: Registry of admitted Domain Plugins; each plugin supplies one bounded domain's vocabulary, deterministic interpretation, and plane-specific contributions without extending kernel authority.
status: stable
tags: [system, component]
codewiki_component: cw:component:domains
codewiki_source_patterns:
  - "src/domains/**"
codewiki_test_patterns: ["tests/domains/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.maintain-intent
    rationale: Domains supply the bounded vocabulary and deterministic compilation rules through which accepted intent becomes linked Knowledge.
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Admitted Domain Plugins contribute domain context, Checks inputs, realization, and guarded-effect bindings without owning Stage Loop authority.
---
# Domains

CodeWiki organizes governed meaning through **Domains**: each domain is one admitted Domain Plugin, a release- or operator-installed CodeWiki Plugin that supplies one bounded domain vocabulary and its deterministic interpretation. A Domain Plugin is neither a workflow engine, project script, Check Pack, DSH profile, nor authority extension. Backend v1 ships exactly one Domain Plugin — Software Development — as the first member of the Domains registry; additional domains remain deferred until the software plugin and one infrastructure-as-code extension prove the boundary.

CodeWiki kernel always owns stable subject identity, accepted Knowledge State, Change, four Stage Loops, Candidate custody, Gate reduction, expected-head compare-and-swap, authorization, provenance, Review, and protected effects. A Domain Plugin cannot add a stage, change a transition, authenticate itself, grant authority, select a model, create a Check Result outside Checks, write canonical state directly, or apply an effect outside Project Server.

One Domain Plugin package may declare separately admitted contributions for three trust planes:

- a deterministic Project Server contribution defining concept types, relationship predicates, schemas, link constraints, context projections, domain-specific Candidate fields, Check input projections, realization classes, and effect bindings;
- DSH Plugins defining model-facing context or tools under the exact capability ceiling of one Run;
- optional DSH client plugins defining domain views through the authenticated CodeWiki frontend contract.

These contributions share one Domain Plugin identity but not authority or process context. Project Server does not expose canonical storage to DSH or client contributions. DSH lifecycle disposal cannot reverse accepted history or external effects.

Every admitted Domain Plugin binds an immutable ID, version, package integrity, implementation digest, declared entrypoints, dependency closure, supported CodeWiki and DSH contract ranges, data limits, and qualification Evidence. Project configuration selects only an exact installed and allowlisted identity. `.codewiki/` cannot install executable Plugin code, name a local executable path, widen capabilities, or replace an operator floor. A Plugin change affects new work only after explicit admission; incompatible Knowledge, Candidate, Gate, Session, or frontend state fails closed.

The Project Server contribution is deterministic over declared canonical inputs. It performs no provider networking, credential access, ambient filesystem reads, model calls, scheduling, or protected effects. Domain source Providers may produce versioned observations with stable source identity, revision, provenance, classification, and authorization metadata, but those observations remain non-authoritative Change Intake Material until exact policy admits proposed Knowledge Effects. Explicit source links are preferred; deterministic derived links retain compiler provenance; model-suggested links remain Candidates until independently judged and accepted.

A Domain Plugin upgrade is an explicit compiler migration. Project Server binds old and new Plugin identities, recomputes affected projections, validates reference closure and semantic identity, exposes exact differences, and requires normal authority before accepted meaning changes. It never hot-swaps a compiler inside a Candidate, Gate Evaluation Package, active Run, or retained Session.

The Software Development Domain Plugin owns the current Product, System, and Design Knowledge vocabulary; source and test ownership; repository and Git realization; Workbenches; software Evidence and Checks; private integration; aggregate Review; guarded software delivery; and one versioned default Check Pack template for each fixed stage. Default Packs are passive release resources, not hidden policy: bootstrap or explicit adoption copies their validated bytes once into project ownership and binds exact Domain and tree identity. Domain or Backend upgrades never overwrite adopted Packs. Git and source artifacts remain software-domain facts rather than assumptions embedded in the domain-neutral governance kernel.

Identity binding: `domainPluginIdentity(admission)` binds Plugin ID, version, admission digest, and implementation digest as `codewiki.domain-plugin-identity@1.0.0`. `domainCompilerIdentity(admission)` embeds that exact identity in Knowledge Compiler `2.0.0`; Knowledge Projection and Checkpoint `2.0.0` therefore reject a foreign Plugin even when it reuses the same compiler ID and version. `assertCheckpointBoundToDomain` validates both the exact Domain identity and compiler digest. Project configuration persists `pluginId`, `pluginVersion`, and `admissionDigest`; config-file loading preserves all three, and real configuration resolution fails closed on unknown or drifted admissions. A missing project file uses the exact release default, but an existing legacy file with omitted or null selection fails closed until `migrateLegacyWikiConfigDomainSelection` writes an explicit binding.

`src/domains/contracts.ts` defines admission protocol `codewiki.domain-plugin-admission@2.0.0`: one deeply immutable manifest binding Plugin ID/version, package integrity, implementation digest, declared entrypoints, dependency closure, exact CodeWiki/DSH contract versions, data limits, qualification Evidence, contribution names, and deterministic compiler ID. Registry admission recomputes canonical bytes and rejects forged digests, duplicate IDs, and unknown selection. Built-in closure tests recompute package, implementation, and qualification digests from declared reviewed source paths.

`src/domains/project-server.ts` is the deterministic Project Server contribution seam. Non-domain modules consume source realization and ownership through this bound service rather than importing Software Development internals. `src/domains/software-development/` hosts software meaning — KB vocabulary, diagrams, fact classification, source maps, ownership, and OKF extensions — while `src/knowledge/**` retains domain-neutral parsing, subject identity, checkpoint, materialization, and alignment machinery. Checks, Git, integration, Review, and delivery retain Project Server authority; their software interpretation is declared by the admitted contribution and cannot create authority.

Exact Domain identity now propagates through Decision Candidate `8.0.0`, Planning Candidate `3.0.0`, Work Unit Candidate `2.0.0`, Review Attempt `5.0.0`, Check Invocation `4.0.0`, Gate Evaluation Package `2.0.0`, Runtime Build Manifest `4.0.0`, Backend Build `2.0.0`, Runtime Production Qualification `1.0.0`, and bounded frontend effective-configuration projections. `migrateLegacyKnowledgeCheckpointToDomain` validates historical unbound Knowledge Compiler/Projection/Checkpoint `1.0.0` bytes and explicitly emits Domain-bound `2.0.0` bytes. `createDomainPluginMigration` binds old/new admissions, deterministically recomputes a checkpoint, exposes source/target compiler and projection digests, validates semantic-state preservation and reference closure, and rejects no-op, cross-domain, or active Candidate/Gate/Run/Session hot swaps. Resulting meaning changes still require normal Candidate, Check, Decision, and expected-head authority.
