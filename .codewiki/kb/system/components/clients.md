---
type: System Component
codewiki_id: cw:component:clients
title: Clients
description: Owns software endpoints and deterministic User Interfaces without Project Server or CodeWiki execution authority.
status: stable
tags: [system, component]
codewiki_component: cw:component:clients
codewiki_source_patterns: ["src/clients/**"]
codewiki_test_patterns: ["tests/clients/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:agent.retrieve-bounded-context
    rationale: Clients present bounded project truth and exact Project Server operations.
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Clients provide direct user-controlled Check Pack editing, npm, Git, and local installation, preview, and inspection.
  - type: realizes
    target: cw:story:check-author.author-composable-checks
    rationale: Clients expose Skill, Check SDK, bundle, snapshot, preview, and replay diagnostics without granting execution authority.
---
# Clients

A Client is a software endpoint that speaks the CodeWiki Client-Project Server Protocol. A User Interface is the human-facing surface implemented by a Client. Deterministic CLI and the future browser App are primary first-party Clients. The browser App begins only after every Backend v1 release gate passes. Its frozen backend surface is Frontend API `1.0.0` over the authenticated CodeWiki App Server; DSH supplies only specifically qualified presentation mechanics, never transport authentication or CodeWiki authority.

B6 externally qualified thirteen exact DSH `0.1.1-rc.2` client packages. Typed slots, recursive lifecycle disposal, layout, and primitives passed for later Client Plugin composition. The stock DSH Web profile and Connection did not qualify because their trusted-host policy is explicitly not an authentication layer. Stock Provider settings and authorization interaction did not qualify because they call DSH settings and credential mutation directly rather than CodeWiki's exact route/account authorization and custody seams. Frontend v1 therefore retains the authenticated CodeWiki App Server host; any DSH presentation reuse requires a release-managed CodeWiki Frontend API Client Plugin and grants no product-implementation authority before the Backend v1 release gate.

Optional Pi, Claude Code, Codex, and future Agent-product integrations connect as External Agent Clients through MCP. Headless automation is a Client without a User Interface. Collaboration channels enter through Project Server channel Plugins. A CodeWiki-launched Claude Code, Codex, or ACP process is a Delegated Run, not a Client. The same product may also run independently as an MCP Client, but the two operations retain different initiators, custody, receipts, and authority. Clients never gain process-lifecycle access merely because a matching delegation Provider exists.

Each Client Plugin or Integration declares the commands, queries, events, attachments, confirmations, and redaction classes it can represent. Client kind and Client instance describe only software and paired installation or process; they are never the accountable Actor. The same Actor may use App, CLI, Pi, MCP, or channel Clients without changing identity. An Agent or service Client requires explicit delegation when acting for a User and otherwise acts only as its own limited service Actor. Effective capability is the intersection of Client declaration, Actor Authority Grant, explicit delegation where applicable, project policy, and current Project Server guards.

Clients render persisted Project Server truth and never infer readiness, provenance, activity, causality, completion, impact, next action, or authority. Browser and channel Clients call neither models nor Git directly. High-authority Candidate confirmation, Integration, publication, and deployment actions require a User Interface capable of exact digest-bound confirmation, normally the App or CLI. Submitting Change Intake Material never accepts a Change or grants protected authority.

The App organizes work by Decision, Planning, Implementation, and Review. Each stage workspace derives from one WorkState snapshot and presents subject, proposed transition, producer route, execution custody, exact context and Skills, Checks, attempt history, Gate feedback, pending authority, and permitted fixed transition. Decision renders current Knowledge from the bound base, desired Knowledge from the compiled target, and their diff from Project Server artifacts; it does not ask a model to repeat those bytes. Confirmation binds the exact Candidate, Gate, compiler, plan, and projected-state identities shown. The App distinguishes Runs, Delegated Runs, and External Agent Client activity without converting partial custody into complete provenance. This organization is a projection, not a configurable workflow graph or activation manifest.

The first-party interactive Harness Agent is a DSH-backed Runtime role surfaced through a Client, not a Client, Actor, fifth Stage Loop, Check, Worker, or Project Server coordinator. The user selects its exact model route. By default Decision and Planning producer Runs use that route; separately configured stage routes may override it. The same route may be inherited by Review, but Review remains a fresh independent producer Session and the Harness Agent itself submits only Decision and Planning Candidates. Implementation Workers use the independent authorized Worker pool, while Model Checks use Check-owned routes.

Harness Agent may inspect canonical current Implementation and Review outcomes so it can answer user questions and receive exact Review feedback when work returns to Decision or Planning. Observation is selective: the App and Project Server automatically provide coalesced Work Unit progress, stop or conflict facts, compact stage-boundary outcomes, and exact report references; full current reports remain available through bounded reads. They do not inject every successful unit report, superseded failure, Worker private memory, raw Check reasoning, uncommitted Workbench state, or Check Session. Harness Agent never authors, rewrites, or forwards Check feedback, and its availability or acknowledgement never blocks execution.

External Agent Clients receive typed bounded views over authorized Project Context Snapshots plus submission, status, and confirmation operations through the reserved CodeWiki MCP namespace. They may use direct, batch, and optional fresh bounded programmatic queries when supported, but receive no canonical storage handle or Gate Evaluation Package authority. CodeWiki receipts cover only authenticated CodeWiki calls and admitted Candidates or Workbench operations; Clients must not display them as proof of complete external prompts, tools, Skills, local reads, subagents, models, code runtime, or memory.

Optional Pi integration exposes bounded reads and explicit User operations through the same Project Server and Runtime contracts. It does not own, import, or launch CodeWiki, Project Server, Runtime, Run Process, or Check Run Process lifecycle implementations, dynamically activate Stage Loop tools, or schedule semantic work from ambient chat, tool-result, startup, or resume events. Pi is one Client Integration rather than the product host or DSH-backed Run engine.

Check Packs have no dedicated lifecycle-management CLI. Users may edit `.codewiki/check-packs/**` directly, including through a user-controlled External Agent Client following public documentation. The App exposes the same source files through stage and Pack navigation. It can inspect and edit one optional `skill/<skill-name>/` Agent Skill, show exact effective stage Skill composition and digests, and distinguish Skill guidance from Gate Checks. A Model Check form captures requirement, pass, fail, feedback, input, measurement, threshold, model profile, and budget and writes `check.json` plus `CHECK.md`. A Code Check form captures common fields, accepts one self-contained `CHECK.mjs` upload, validates it, and may preview it in an admitted sandbox. Developer mode shows Check SDK input coverage, horizontal and vertical query facts, bundle provenance, sandbox diagnostics, and historical replay. Users may create, rename, edit, or delete any Pack, including every default.

Check Author build and fixture commands may exist as SDK development tooling but never install, activate, or mutate active Pack files. The App marketplace follows npm package-gallery ergonomics: search npm packages tagged `codewiki-check-pack`, accept exact npm, Git, or local package sources, inspect optional standard Agent Skills and Code or Model Checks, install selected Pack runtime files into `.codewiki/check-packs/**`, record resolved source integrity and separate Skill and Check base digests, and show exact update diffs. It does not load Domain Plugins, DSH or Cordis Plugins, Infrastructure Providers, prompt templates, themes, harness settings, or package hooks. Installation and update are explicit User actions. CodeWiki never invokes a model to author or alter Skill or Check files autonomously.
