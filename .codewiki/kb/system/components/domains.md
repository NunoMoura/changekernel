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

The Software Development Domain Plugin owns the current Product, System, and Design Knowledge vocabulary; source and test ownership; repository and Git realization; Workbenches; software Evidence and Checks; private integration; aggregate Review; and guarded software delivery. Git and source artifacts remain software-domain facts rather than assumptions embedded in the domain-neutral governance kernel.

`src/domains/contracts.ts` defines the admission protocol `codewiki.domain-plugin-admission@1.0.0`: an immutable manifest (Plugin ID, version, contribution names, deterministic compiler ID) plus an admission digest over canonical bytes. `createDomainRegistry` admits plugins uniquely and fails closed on unknown selection. `src/domains/software-development/` hosts the extracted software-meaning modules — KB vocabulary profile, system diagrams, fact classification, source map, source ownership, and OKF source-map extensions — while `src/knowledge/**` retains only the domain-neutral kernel: OKF parsing/validation, subject identity, checkpoints, materialization, and alignment seams. The built-in `codewiki.domain.software-development@1.0.0` admission covers all nine contribution classes.
