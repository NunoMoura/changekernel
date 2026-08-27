---
type: System Component
codewiki_id: cw:component:package
title: Package
description: Owns Backend and Client composition, Plugin trust planes, public entrypoints, Runtime Build closure, and passive Check Pack transport.
status: stable
tags: [system, component]
codewiki_component: cw:component:package
codewiki_source_patterns:
  - "src/index.ts"
  - "src/main.ts"
  - "src/pi-extension.ts"
  - "src/plugins/**"
  - "src/error-handling/codewiki-error.ts"
  - "src/error-handling/operation-errors.ts"
  - "scripts/check-diagnostics-ratchet.mjs"
  - "diagnostics/**"
  - "rules/ast-grep-rules/**"
codewiki_test_patterns: ["tests/plugins/**", "tests/project-server/package-*.mjs", "tests/scaffold*.test.mjs"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Package supplies CodeWiki, Project Servers, Runtime, first-party Clients, and isolated Run Process entry contracts.
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Package transports inspectable npm, Git, and local Check Packs into ordinary project files.
  - type: realizes
    target: cw:story:check-author.author-composable-checks
    rationale: Package transports self-contained authored Checks and optional Pack Skills without making installation an execution environment.
---
# Package

CodeWiki is standalone local-first product with independently installed Backend and replaceable Clients. One Backend may host several Project Servers, each owning one project and subordinate Runtime. Backend v1 owns provider-broker hosts, durable state, Plugin admission, shared assets, and Runtime Builds. It runs behind projects, never inside Claude Code, Codex, Pi, or another Agent product. `.codewiki/` is sole project-local footprint.

DSH is exact pinned upstream Plugin ecosystem behind CodeWiki contracts. Managed Runs use atomic 26-package `0.1.1-rc.2`; Backend v1 Broker Host adds seven credential/provider packages, yielding 33 packages plus Cordis `4.0.1`, Loader `1.0.2`, and `@earendil-works/pi-ai` `0.82.1`. Lockfile binds artifact integrity; reviewed-source equivalence remains unattested. Release profiles separate trusted-host, Run Process, and future client contributions. Runtime Bridge maps admitted Request to DSH Agent/AgentLoop/Session/Plugins in isolated Run Process; private broker composes LLM, authorization, credential, and inventory outside. DSH owns no Project Server, accepted Knowledge, Client authority, Result, Gate, transition, or protected effect.

The broad product API remains `src/index.ts`. Project Server publishes at `@nunomoura/codewiki/project-server` from `src/project-server/index.ts`. Runtime publishes at `@nunomoura/codewiki/runtime` from `src/runtime/index.ts`. Internal Project Server coordination remains under `src/project-server/coordinator/**`; Run Process protocol and process management remain under `src/runtime/processes/**`. No legacy `src/server/**`, `src/execution/**`, `./coordinator`, or old `./runtime` Project Server compatibility surface survives.

`src/pi-extension.ts` is an optional Pi Client integration, not CodeWiki bootstrap or Runtime. Pi-specific code remains only in the Client integration and package entrypoint. Project Server owns its standalone daemon lifecycle, DSH is the sole first-party execution engine, and no Pi executor, `./pi-sdk` subpath, backend selector, compatibility shell, or fallback survives.

## Backend v1 plugin taxonomy

Backend v1 exposes five distinct categories:

- **Domain Plugins** are release- or operator-installed semantic packages defining bounded domain vocabulary, deterministic interpretation, context, project interpretation, and plane-specific contributions. Domains is the registry of admitted plugins; Backend v1 ships exactly one: the built-in Software Development Domain Plugin.
- **DSH Plugins** are trusted executable capabilities admitted into one exact trusted-host, Run Process, or client trust plane through a release-managed DSH profile. Raw DSH or Cordis packages cannot load from project files.
- **Infrastructure Providers** implement trusted CodeWiki seams such as repository, Workbench, persistence, transport, authentication, credential custody, provider brokerage, or delivery. They are release- or operator-owned infrastructure, not project policy.
- **Client Plugins and Integrations** implement current App, CLI, Agent-product, channel, or collaboration surfaces over CodeWiki protocol. They own presentation or transport, never Project Server authority.
- **Check Packs** are project-owned policy files containing direct Checks and at most one optional Pack Skill. Installation is passive; later Check or Skill execution occurs only through separately admitted boundaries.

Project Server governance kernel is not extensible by Plugins. Domain Plugin cannot add Stage, alter fixed transitions, authenticate itself, grant authority, bypass CAS, create Result outside Checks, or apply protected effect outside Project Server. DSH reversible Plugin lifecycle covers only in-process resources/registrations, never committed history or external effects.

Target requires local Git mechanics in Kernel and deletes Domain Plugins. One Plugin Protocol covers external source, remote, workspace, verification, integration-preparation, and Delivery through Manifest, scoped Request, and Receipt `1.0.0`. Standard capabilities are `source.observe`, `remote.observe`, `remote.publish`, `workspace.prepare`, `verification.observe`, `integration.prepare`, and `delivery.apply`; ongoing source connections remain external and namespaced extensions add bounded mechanics only. SDKs grant no authority. Project files may select admitted manifests/config but cannot install code, widen permissions, advance canonical Git ref, issue Results, authorize effects, or complete Change.

Executable Plugin Admission Closure `1.0.0` binds only the CodeWiki policy that upstream composition does not own: one exact Plugin identity, Plugin kind, trust plane, sorted capability ceiling, and closure digest. Allowed trust planes are Project Server, broker host, Run Process, and client. Kind-to-plane admission is closed: Infrastructure Providers may enter Project Server or broker-host planes, DSH Plugins may enter broker-host or Run Process planes, Runtime Bridge enters only Run Process, and Client Plugins enter only client.

DSH Loader/Cordis solely own DSH Plugin import, injection, update, disposal, rollback, and Fiber state. Backend release config owns ordered managed-Run composition; DSH profiles/bundle patches compose trusted-host/client surfaces. Startup verifies Loader entry, module, enablement, and active Fiber through read-only Host Plugin Inventory, then discards observation. Package manifest/lock own versions, integrity, dependencies, exports. CodeWiki keeps no competing lifecycle, manifest, dependency graph, registry, or live inventory. It realpath-validates release/operator source roots, rejects governed-repository aliases, permits no executable project path/entrypoint, and revalidates at import; admission alone grants nothing.

Runtime Builds are release artifacts, not project extensions. Runtime Build Manifest `4.0.0` binds exact Domain, protocol, Node path/version/bytes, outer containment, DSH, Cordis, Plugin admission, Runtime bytes, and qualification Evidence. Requests and Receipts bind its digest. Retained `3.0.0` records remain readable but cannot activate or resume until exact requalification and Session rollover. Package lock and Runtime provenance own package integrity; project files cannot install Runtime code. Activation is generation-CAS and affects new Runs only.

Shared error handling stays lean under `src/error-handling/**`: CodeWiki error envelope, serialization, type guards, and stable cross-owner operation-failure contracts belong to Package. Configuration and Change Trace define specialized errors with their owners rather than growing a cross-domain error catalog.

## Backend packaging and state evolution

Installation is passive; Project Server owns lifecycle. Backend Build `2.0.0` binds package, support, DSH, Domain, schemas, and protocols. Exact `1.0.0` stays readable; upgrades are backup-first, quiescent, and identity preserving. `CODEWIKI_STATE_ROOT` isolates state and backup scopes.

Support Matrix, Runtime Production Qualification, Observability, Fault Recovery, and the unfiltered diagnostics ratchet bind the supported host, containment, Plugins, providers, evidence, recovery, privacy, and warning policy. Candidates cannot select these policies.

Backend Release Manifest `1.0.0` is current. Target Kernel Build/Release `1.0.0` bind supported Git implementation/version/sanitized plumbing profile, mandatory store contract, Wiki Item/parser, Change Completion, API/SDK transport bindings, Checks, Plugin admission/capabilities, Work Continuity, AI Gateway route closure, and Execution Host; they omit Domain authority, Pack Skills, and in-core rich App. Every cut is backup-first; released controller N governs exact N+1 outside this checkout.

## Check Pack transport

Discovery searches npm packages tagged `codewiki-check-pack`. Installation accepts exact npm, Git, local, or admitted Domain release sources using `package.json` `codewiki.checkPacks` resources or conventional `check-packs/` trees. Domain transport binds exact Domain identity without executing Domain code. Transport metadata never replaces a Check's `check.json`.

A Pack contains direct Checks and at most one standard Agent Skill. A Domain may transport passive defaults, but Plugins, Providers, Runtime Builds, DSH profiles, prompts, themes, harness settings, and lifecycle hooks remain outside Pack contract.

CodeWiki resolves selected source without lifecycle scripts, validates declared Pack content, and vendors optional Skill and Check files into `.codewiki/check-packs/<stage>/<pack-name>/`. Author source, dependencies, and build tooling do not enter active project Pack. `.codewiki/check-packs.lock.json` records source, resolved version or revision, integrity, separate Skill and Check digests, complete installed-package digest, and local divergence; it does not make files immutable.

Package sources are transport, not execution environments. Installation runs no package, Skill, Check, DSH Plugin, Cordis code, or Runtime Build; imports no credentials; and grants no lifecycle or effect authority. Skill scripts may run later only through capabilities admitted for one exact producer Run or Implementation Assignment. Code Checks later run only in admitted sandboxes; Model Checks run only through isolated configured routes.

Installed Packs are immediately editable and removable; updates never overwrite silently. Domain defaults materialize once at first bootstrap or explicit adoption and are never restored. Project Packs do not become shipped defaults. Installation cannot add credentials, telemetry, hooks, canonical writes, unsandboxed execution, protected floors, lifecycle changes, or Run Process code. Benchmarks, private state, and source-checkout dogfood machinery do not ship. Packed candidates run only in disposable external projects.
