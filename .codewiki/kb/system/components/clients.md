---
type: System Component
codewiki_id: cw:component:clients
title: Clients
description: Defines external Client boundaries and minimal operator tooling without Project Server or execution authority.
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

A Client is a software endpoint that speaks an authenticated CodeWiki protocol. A User Interface is a human-facing surface implemented by an external application, not by the Semantic Kernel. Backend v1 retains the deterministic CLI, optional Pi integration, authenticated App Server, and frozen Frontend API `1.0.0` as qualified executable surfaces. The target Kernel API generalizes that boundary for web, desktop, IDE, chat, mobile, CLI, and autonomous-service applications; no Client receives transport authentication or CodeWiki authority from presentation mechanics.

B6 externally qualified thirteen exact DSH `0.1.1-rc.2` client packages. Typed slots, recursive lifecycle disposal, layout, and primitives remain admissible presentation inputs. The stock DSH Web profile and Connection did not qualify because their trusted-host policy is not authentication. Stock Provider settings and authorization interaction did not qualify because they mutate DSH settings and credentials rather than CodeWiki's exact route, account, authorization, and custody seams. Any DSH presentation reuse remains release-managed and grants no kernel or product authority.

Optional Pi, Claude Code, Codex, and future Agent-product integrations connect as External Agent Clients through MCP. Headless automation is a Client without a User Interface. Collaboration channels enter through Project Server channel Plugins. A CodeWiki-launched Claude Code, Codex, or ACP process is a Delegated Run, not a Client. The same product may also run independently as an MCP Client, but the two operations retain different initiators, custody, receipts, and authority. Clients never gain process-lifecycle access merely because a matching delegation Provider exists.

Each Client Plugin or Integration declares the commands, queries, events, attachments, confirmations, and redaction classes it can represent. Client kind and Client instance describe only software and paired installation or process; they are never the accountable Actor. The same Actor may use App, CLI, Pi, MCP, or channel Clients without changing identity. An Agent or service Client requires explicit delegation when acting for a User and otherwise acts only as its own limited service Actor. Effective capability is the intersection of Client declaration, Actor Authority Grant, explicit delegation where applicable, project policy, and current Project Server guards.

Clients render persisted Project Server truth and never infer readiness, provenance, activity, causality, completion, impact, next action, or authority. Browser and channel Clients call neither models nor project stores directly. High-authority Candidate confirmation, Integration, publication, and Delivery require an external application or explicit CLI capable of exact digest-bound confirmation. Submitting Change Intake Material never accepts a Change or grants protected authority.

External product applications may organize Decision, Planning, Implementation, Review, Wiki exploration, Workbenches, and authoring according to their users. CodeWiki does not prescribe those workflows or visual language. Its first-party Operator Console presents only bounded operational state for health, heads, Changes, Work, Runs, Gates, Effects, and recovery. It consumes public APIs, remains read-only by default, and never becomes a privileged workflow path.

The first-party interactive Harness Agent is a DSH-backed Runtime role surfaced through a Client, not a Client, Actor, fifth Stage Loop, Check, Worker, or Project Server coordinator. The user selects its exact model route. By default Decision and Planning producer Runs use that route; separately configured stage routes may override it. The same route may be inherited by Review, but Review remains a fresh independent producer Session and the Harness Agent itself submits only Decision and Planning Candidates. Implementation Workers use the independent authorized Worker pool, while Model Checks use Check-owned routes.

Harness Agent may inspect canonical current Implementation and Review outcomes so it can answer user questions and receive exact Review feedback when work returns to Decision or Planning. Observation is selective: Project Server provides authenticated bounded projections of coalesced Work Unit progress, stop or conflict facts, compact stage-boundary outcomes, and exact report references; full current reports remain available through bounded reads. It does not inject every successful unit report, superseded failure, Worker private memory, raw Check reasoning, uncommitted Workbench state, or Check Session. Harness Agent never authors, rewrites, or forwards Check feedback, and its availability or acknowledgement never blocks execution.

External Agent Clients receive typed bounded views over authorized Project Context Snapshots plus submission, status, and confirmation operations through the reserved CodeWiki MCP namespace. They may use direct, batch, and optional fresh bounded programmatic queries when supported, but receive no canonical storage handle or Gate Evaluation Package authority. CodeWiki receipts cover only authenticated CodeWiki calls and admitted Candidates or Workbench operations; Clients must not display them as proof of complete external prompts, tools, Skills, local reads, subagents, models, code runtime, or memory.

Optional Pi integration exposes bounded reads and explicit User operations through the same Project Server and Runtime contracts. It does not own, import, or launch CodeWiki, Project Server, Runtime, Run Process, or Check Run Process lifecycle implementations, dynamically activate Stage Loop tools, or schedule semantic work from ambient chat, tool-result, startup, or resume events. Pi is one Client Integration rather than the product host or DSH-backed Run engine.

Project owners may manage Check Packs through canonical project files or authenticated public commands. External applications may provide rich editors, developer diagnostics, catalogs, or marketplace experiences. The Operator Console may inspect effective policy, Results, Gate failures, and stale configuration but cannot author, install, update, or remove Packs. Installation and update remain explicit User actions, package hooks never execute, and CodeWiki never invokes a model to author or alter Check files autonomously.
