---
title: Product Package and Release Boundary
aliases:
  - ChangeKernel Package
  - Package
source-id: cw:component:package
ownership:
  sourcePatterns:
    - package-lock.json
    - package.json
    - src/index.ts
    - src/product.ts
    - tsconfig*.json
  testPatterns:
    - tests/package/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:1df869bff380ff305c5aef30af2bf64c679d695ff1c0faed2572b4b0305dbd73
        codewiki.legacy:source-path: system/components/package.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:package
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Package supplies CodeWiki, Project Servers, Runtime, first-party Clients, and isolated Run Process entry contracts.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Package transports inspectable npm, Git, and local Check Packs into ordinary project files.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.legacy:relationship:
          rationale: Package transports self-contained authored Checks and optional Pack Skills without making installation an execution environment.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
---
# Product Package and Release Boundary

The local ChangeKernel product supplies pure semantics plus the Git adapters, runtime, backend Gate execution and agent interface needed to operate Wiki, Change and Work. It is usable without a Hub. The Hub is a separate collaboration product boundary, not a requirement for separate repositories or deployment units now. The package supplies the semantic service over native Git-backed Wiki and Change. Git/history are foundational; external data connectors, hosting/editor integrations and supported execution profiles are separate concerns. Optional connectors must not become prerequisites for native knowledge or history. Public interfaces expose semantic operations, not private writers, credentials or custody.

An immutable release binds exact source and dependency/package closure and the Kernel's semantic contract, including managed document representation and interpretation. The current package and Kernel share one release version; there is no separately versioned Wiki profile. [Kernel version rules](changekernel.md#versioning-and-document-contract) distinguish breaking changes, compatible additions and implementation fixes. A policy digest or version label alone does not identify all executable bytes or transfer qualification. [Benchmarks](benchmarks.md) define outcome and evidence expectations.

Develop with native edits, diagnostics and tests under approved scope. Pack/test candidates only in disposable external projects with isolated settings, never as governors loaded from their own mutable checkout. Private runtime state, generated views, credentials, caches, sockets and package artifacts are not Project source truth.

Existing operational state needs separately authorized conversion with exact mapping, backup, collision rejection and recovery. A new reader does not grant migration support; do not dual-read/write or invent historical acceptance. Pre-release source cleanup may replace unused experimental implementations without preserving their behavior, while retaining desired Wiki intent and genuine history. Compatibility is required for identified supported deployments, not inferred from old test fixtures or version labels. See the [source Wiki boundary](wiki.md#source-repository-design-documents).

Bootstrap creates empty `.changekernel/wiki/` and `.changekernel/changes/` roots plus minimal project identity configuration at `.changekernel/config.json`. It does not create an Item-envelope tree, Check Pack lock, domain-specific Check catalogue, automation settings or adoption records. The read-only Console reports unavailable projections honestly; successful composition does not imply a complete operational release.

## Product identity

The product name is ChangeKernel. The source repository is `NunoMoura/changekernel`, the package is `@nunomoura/changekernel`, and the executable is `changekernel`. Current public exports use `ChangeKernel` names. The complete product includes the pure semantic core, Project Server, Wiki, Git management and four-stage Change lifecycle; it is not an agent or harness.

The current managed root is `.changekernel/`, not a second root beside `.codewiki/`. Bootstrap refuses retained `.codewiki/` or `.codewiki.bootstrap/` state rather than silently starting a parallel project. Both names remain excluded from direct Agent and Preview writable scopes. This source-directory relocation preserves historical Change bytes, source identifiers and provenance; it is not an operational converter, adoption or controller handoff. Existing `codewiki.*` protocol identifiers, `codewiki-` document fields and `cw:` identities remain unchanged until an explicitly scoped contract transition.

## Minimum local dogfood

The first dogfood release supports one truthful local Change loop over a narrow supported source-development case: attributable proposal and checkpointed candidate → release-owned Decision validation and explicitly adopted software-domain Checks → approval of exact intent/consequences → bounded Planning/Implementation/Review work with each stage's backend and domain evaluations → demonstrated scoped outcome, fresh-session handoff and restart/history. Transversal validation is a mandatory backend responsibility. The selected first-party software Pack supplies domain assessment under ordinary extension adoption; it cannot substitute for that responsibility. Acceptance is not realization; code, Wiki and actual behavior remain distinguishable.

Five requirements remain non-negotiable:

1. **Pinned external controller.** Bind an immutable installed package and its dependency/build closure. Editing this checkout cannot change the active controller or redirect imports to candidate code. Verify identity at activation and restart; an unavailable release never falls back to source.
2. **Explicit adoption and authority.** Bind the repository, actual baseline, desired Wiki, backend release/build and stage requirements, exact adopted domain Check/Pack definitions, execution configuration and permitted operations. Initial trust and Pack adoption require explicit maintainer authority, not an empty project's self-certification. Preserve real history; any operational conversion requires separate scope, backup and recovery. Qualification and activation do not transfer controller authority: explicit handoff and reconciled prior custody are required.
3. **One complete enforced loop.** The agent produces work and Evidence; read-only backend validators and domain Checks return attributable Boolean results and actionable feedback. Backend stage contracts require both kinds of applicable assessment and separate approval before successful progression. Every supported transition remains backend-validated, including repair, pause or rejection without pretending its failed assessments passed. Models, Packs, source text and passing results grant no effects. Approval cannot rewrite failures. A bounded single worker and one tracked-artifact outcome suffice; no worker fleet or fixed number of commits is required.
4. **Durable continuation and gap visibility.** Retain fixed inputs, evaluator ownership and stage, backend and domain policy/implementation identities, results, Evidence, acceptance and unfinished Work. A fresh process recovers without another model call or duplicate effect. A fresh Planning session receives the accepted report and required sources rather than private conversation. Show at least one explicit desired outcome, scoped realization assessment and related Change, preserving unknown or partial coverage rather than inferring success from closure.
5. **Exact-release qualification.** Pack and test those same immutable bytes only in disposable external projects with isolated settings. Demonstrate a supported pass and a consequential blocked/unready proposal followed by clarification/repair, actual artifact assessment, live bounded inference, restart and fresh-session continuation. Exercise denied authority, stale sources, candidate-controlled policy changes, malicious extension effects, limits, caching/retry behavior and unknown acknowledgements. Record backend-validator, domain-Check and model quality alongside containment limitations; injected/replay tests alone do not qualify real execution. Paid runs, activation and controller handoff still require applicable explicit authority.

### Smallest supported execution configuration

Use one isolated TypeScript/JavaScript Check runner and one host-mediated structured model primitive, with no model tools, project writes or direct provider credentials. Allow an explicit authorized model override, including one supported local/company-private route, and enforce no remote fallback where locality is required. Freeze finite inputs, output, time, memory, model-call and repair budgets. Reject unsupported containment rather than simulating it. Qualification applies to that exact model, runtime and configuration; it is not a promise that all local models or platforms work or a separately selectable lifecycle version.

Implement the applicable release-owned backend validations and a small adopted [first-party software Pack](checks.md#first-party-software-development-pack) across the supported loop. Demonstrate both computational validation and genuine bounded semantic assessment through shared execution mechanisms, retaining distinct ownership and stage questions. Do not package universal intent, path or realization validation as optional project extensions. Adopt policy deliberately; bootstrap or installation does not activate examples. Prove missing-input fail-fast, honest activation, conservative result reuse over complete declared input snapshots, exact-input replay and retained failure feedback. Compare retained source identities without treating unchanged favorable citations as the whole dependency set or copying an old stage verdict onto a new candidate. Reuse eligibility includes evaluator/configuration identity, source roles, scope membership and Evidence validity. Advanced batching, automatic read tracking, selective passage-level dependency caching, a Check-composition framework and automatic model routing are not required. Declare limited supported subject scope rather than executing every domain's prospective catalogue or weakening applicable backend/domain requirements.

The minimum read surface includes exact Change/report reads, bounded desired/current/related-work inputs, and the next permitted action. Simple explicit links and retained assessments suffice; no universal knowledge graph, outcome registry or background semantic scan is needed. Report and commit explanations derive from retained records rather than extra model calls. Keep release-owned transversal validation distinct from adopted domain policy, without confusing that ownership boundary with computation versus semantic assessment.

Python, other runners, public marketplace infrastructure, Hub, optional external connectors, parallel work, recursive proposal synthesis and general-purpose scheduling remain outside this first boundary. Implement the narrow path directly and remove superseded prerelease helpers/tests instead of preserving dual Check or lifecycle engines. Self-improvement begins only after qualification and explicit controller handoff; it does not make missing foundations optional.

## Guidance versus enforcement

An AGENTS.md instruction is an entry point, not the implementation of these guarantees. After qualification and explicit handoff, it can say: “Use the designated external ChangeKernel release for this repository's Change and Work operations; never load its mutable candidate, and stop governed operations if that controller is unavailable.” The actual package identity, repository grant and handoff live in their verified binding/receipt, not an ambiguous prose alias. Before that point, source development continues through native tools.

The loader enforces release selection; runtime authorization and exact-subject checks enforce permissions; common reduction, native retention and CAS enforce recorded transitions. Qualification exercises these boundaries. A one-liner cannot substitute for any of them, and finite process/tool budgets do not prove OS containment. Declare unsupported enforcement honestly.

Prepare the small guidance change before freezing a uniquely versioned candidate. Corrections after freeze require new bytes/version and qualification. Activation and a required quiescent handoff can be acknowledged together explicitly, but neither is inferred from installation. Candidate N+1 never governs itself; bootstrap ending does not end the immutable-controller boundary.
