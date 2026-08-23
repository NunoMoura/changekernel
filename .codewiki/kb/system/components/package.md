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
  - "src/error-handling/codewiki-error.ts"
  - "src/error-handling/operation-errors.ts"
codewiki_test_patterns: ["tests/project-server/package-*.mjs", "tests/scaffold*.test.mjs"]
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

CodeWiki is one standalone local-first product with an independently installed Backend and replaceable Clients. One Backend process may host several authoritative Project Servers, each owning one governed project and one subordinate Runtime. Backend v1 also owns trusted provider-broker hosts, durable operational state, admitted Plugin inventory, shared package assets, and release-managed Runtime Builds. It may run quietly as a local daemon or later as a hosted product, but it runs behind projects rather than inside Claude Code, Codex, Pi, or another Agent product. `.codewiki/` remains the only project-local footprint.

DSH is an exact pinned upstream Plugin ecosystem composed behind CodeWiki contracts. Release-managed DSH profile bundles select separate trusted-host, Run Process, and future client contributions. The Runtime Bridge maps admitted Run Requests to DSH Agent, AgentLoop, Agent Session, and DSH Plugin composition inside isolated Run Processes; the private broker may separately compose provider, authorization, and credential Plugins outside those sandboxes. DSH owns no Project Server, accepted Knowledge, Client authority, Check Result, Gate, transition, or protected effect.

The broad product API remains `src/index.ts`. Project Server publishes at `@nunomoura/codewiki/project-server` from `src/project-server/index.ts`. Runtime publishes at `@nunomoura/codewiki/runtime` from `src/runtime/index.ts`. Internal Project Server coordination remains under `src/project-server/coordinator/**`; Run Process protocol and process management remain under `src/runtime/processes/**`. No legacy `src/server/**`, `src/execution/**`, `./coordinator`, or old `./runtime` Project Server compatibility surface survives.

`src/pi-extension.ts` is an optional Pi Client integration, not CodeWiki bootstrap or Runtime. Pi-specific code remains only in the Client integration and package entrypoint. Project Server owns its standalone daemon lifecycle, DSH is the sole first-party execution engine, and no Pi executor, `./pi-sdk` subpath, backend selector, compatibility shell, or fallback survives.

## Plugin taxonomy

CodeWiki exposes five distinct categories:

- **Domain Plugins** are release- or operator-installed semantic packages defining bounded domain vocabulary, deterministic interpretation, context, realization, and plane-specific contributions. Backend v1 ships only the built-in Software Development Domain Plugin.
- **DSH Plugins** are trusted executable capabilities admitted into one exact trusted-host, Run Process, or client trust plane through a release-managed DSH profile. Raw DSH or Cordis packages cannot load from project files.
- **Infrastructure Providers** implement trusted CodeWiki seams such as repository, Workbench, persistence, transport, authentication, credential custody, provider brokerage, or delivery. They are release- or operator-owned infrastructure, not project policy.
- **Client Plugins and Integrations** implement App, CLI, Agent-product, channel, or collaboration surfaces over CodeWiki protocol. They own presentation or transport, never Project Server authority.
- **Check Packs** are project-owned policy files containing direct Checks and at most one optional Pack Skill. Installation is passive; later Check or Skill execution occurs only through separately admitted boundaries.

The Project Server governance kernel is not extensible by Plugins. A Domain Plugin may define bounded domain meaning but cannot add a stage, alter fixed transitions, authenticate itself, grant authority, bypass expected-head compare-and-swap, create a Check Result outside Checks, or apply a protected effect outside Project Server. DSH's reversible Plugin lifecycle applies only to in-process resources and registrations; it cannot reverse committed history or external effects.

Runtime Builds are release artifacts, not project extensions. Every build binds the exact Runtime Bridge, DSH and Cordis package closure, DSH Plugins and Providers, protocol, Node version, executable bytes, and qualification Evidence. Domain Plugin and DSH profile identities remain explicit even when bundled first-party. Project files cannot install Runtime code. Activation uses CodeWiki-owned expected-generation compare-and-swap and affects new Runs only.

Shared error handling stays lean under `src/error-handling/**`: CodeWiki error envelope, serialization, type guards, and stable cross-owner operation-failure contracts belong to Package. Configuration and Change Trace define specialized errors with their owners rather than growing a cross-domain error catalog.

## Check Pack transport

Discovery searches npm packages carrying the `codewiki-check-pack` keyword. Installation accepts an exact npm version, Git source and revision, or local package path. Each source uses either `package.json` `codewiki.checkPacks` resources or conventional `check-packs/` directories, and one package may transport Packs for several stages. `package.json` is transport metadata and never replaces a Check's `check.json`.

A Pack contains direct Check directories plus at most one optional standard Agent Skill under `skill/<skill-name>/`. Domain Plugins, DSH Plugins, Client Plugins, Infrastructure Providers, Runtime Builds, DSH profiles, Cordis Plugins, prompt templates, themes, harness settings, and lifecycle hooks are outside Pack contract.

CodeWiki resolves selected source without lifecycle scripts, validates declared Pack content, and vendors optional Skill and Check files into `.codewiki/check-packs/<stage>/<pack-name>/`. Author source, dependencies, and build tooling do not enter active project Pack. `.codewiki/check-packs.lock.json` records source, resolved version or revision, integrity, separate Skill and Check digests, complete installed-package digest, and local divergence; it does not make files immutable.

Package sources are transport, not execution environments. Installation runs no package, Skill, Check, DSH Plugin, Cordis code, or Runtime Build; imports no credentials; and grants no lifecycle or effect authority. Skill scripts may run later only through capabilities admitted for one exact producer Run or Implementation Assignment. Code Checks later run only in admitted sandboxes; Model Checks run only through isolated configured routes.

Users may edit or delete installed Check Pack files immediately. Updates are explicit and never overwrite local changes silently. Default Packs materialize only once at project bootstrap; deleting them is supported and upgrades do not restore them. Package installation cannot introduce credentials, telemetry, install hooks, canonical writes, unsandboxed execution, protected Check floors, lifecycle changes, or Run Process code. Benchmarks, private state, and source-checkout dogfood machinery do not ship. Packed candidates are tested only in disposable external projects.
