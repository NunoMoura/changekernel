---
okf_version: "0.2"
type: Lexicon
codewiki_id: cw:lexicon:codewiki
title: CodeWiki Lexicon
description: Active vocabulary for CodeWiki desired state, public contracts, and cross-boundary project explanations.
status: stable
tags: [system, vocabulary]
---
# CodeWiki Lexicon

Backend v1 retains this table. Target migration folds terms into linked Items and derives any glossary; it emits no Lexicon Item.

| Term | Definition | Owner |
| --- | --- | --- |
| CodeWiki | Product, currently Backend v1 and ultimately headless Semantic Kernel plus Clients. | [Package](system/components/package.md) |
| Backend Build | Package, support, DSH, Domain, schema, and protocol identity. | [Package](system/components/package.md) |
| Project Server | Sole authority for proof/AuthZ, canonical Git admission, Changes, Work, Gates, effects, and recovery. | [Project Server](system/components/project-server.md) |
| Runtime | Executes bounded Run Requests and emits Receipts without project/lifecycle authority. | [Runtime](system/components/runtime.md) |
| Run | One bounded execution attempt for a Stage Producer, Implementation Worker, Check, or delegated harness under one immutable Run Request. | [Runtime](system/components/runtime.md) |
| Run Request | Immutable Run binding to subject, inputs, identities, limits, custody, and lease. | [Runtime](system/components/runtime.md) |
| Run Process | Runtime-controlled OS process for one Run; process separation alone is not a security sandbox. | [Runtime](system/components/runtime.md) |
| Run Port | Neutral internal contract through which Project Server or Checks requests bounded execution without importing DSH or a delegated harness. | [Runtime](system/components/runtime.md) |
| Run Receipt | Immutable CodeWiki account of one Run's provable inputs, outputs, custody, and gaps. | [Runtime](system/components/runtime.md) |
| Runtime Build | Execution closure binding protocol, Node, containment, DSH Plugins, bytes, and Evidence. | [Runtime](system/components/runtime.md) |
| Execution Host Contract | OS-neutral guarantees for supervising and containing one exact DSH Run. | [Runtime](system/components/runtime.md) |
| DSH Plugin | Trusted release-managed DSH capability admitted for one exact trust plane; project files cannot install it or extend its authority. | [Runtime](system/components/runtime.md) |
| Plugin Protocol / SDK | Language-neutral Plugin contract plus non-authoritative libraries, manifests, fixtures, and test kit. | [Package](system/components/package.md) |
| Runtime Bridge | Maps one Run Request to exact DSH composition and its output to Runtime facts. | [Runtime](system/components/runtime.md) |
| DSH AgentLoop | DSH model/tool/stream/continuation mechanism inside one model-driven Run. | [Runtime](system/components/runtime.md) |
| DSH Agent Session | DSH-owned execution epoch under Runtime byte custody and Project Server Work Continuity. | [Runtime](system/components/runtime.md) |
| Work Continuity | Project Server-owned durable stage-work sequence across fresh physical Sessions, bound by canonical Git/semantic state and predecessor Receipts. | [Project Server](system/components/project-server.md) |
| Session Lease | Exclusive grant for one Run to write one expected Session head until commit, cancellation, or expiry. | [Project Server](system/components/project-server.md) |
| AI Gateway | Credential, account-route, networking, budget, retry, and AI Provider request boundary without project authority. | [Provider Boundary](system/components/provider-boundary.md) |
| Client Session | Temporary authenticated Client connection, distinct from Pairing and DSH Agent Session. | [Project Server](system/components/project-server.md) |
| Check Run Process | Runtime-controlled isolated process for a Code Check or tool-free Model Check; it reports bounded facts without owning Check Result or Gate authority. | [Runtime](system/components/runtime.md) |
| Change completion | Project Server-derived state proving every frozen Completion Requirement from exact Results, Evidence, lineage, Plugin Receipts, and required Delivery. | [Change Trace](system/components/change-trace.md) |
| Actor | Accountable authenticated User/service, distinct from Client, executor, harness, and model. | [Project Server](system/components/project-server.md) |
| Actor Profile | Non-authoritative skills, interests, preferences, and availability used only to suggest fit. | [Project Server](system/components/project-server.md) |
| Alignment | Derived support/satisfaction relation among Raw Data, Wiki, Change requirements, project artifacts, Evidence, Results, and Delivery. | [Alignment](system/components/alignment.md) |
| Alignment Graph | Disposable exact-input projection of relationships, impact, and provenance. | [Alignment](system/components/alignment.md) |
| Approval | Authenticated acceptance of one exact policy-scoped subject that implies no other approval. | [Project Server](system/components/project-server.md) |
| Assignment | Exact Project Server binding among one accepted Work Unit, one Implementation Worker, and one Workbench. | [Project Server](system/components/project-server.md) |
| Authority Grant | Project-controlled capability grant scoped to an Actor or team, exact subjects, policy identity, and optional validity interval. | [Project Server](system/components/project-server.md) |
| Backend-delegated provenance | Proof over launched task, Workbench, lifecycle, output, artifacts, and child-custody gaps. | [Runtime](system/components/runtime.md) |
| Backend-owned provenance | Controlled provenance with complete Run Receipt and input Ledger. | [Runtime](system/components/runtime.md) |
| Benchmark | Controlled externally-oracled comparison of the same product task without and with CodeWiki. | [Benchmarks](system/components/benchmarks.md) |
| Candidate | Immutable role proposal from one Run, completed with Project Server-derived bindings before Checks. | [Decision](system/components/decision.md) |
| Candidate Manifest | Candidate identity binding project, canonical/proposal commits, derived Wiki tree, scope, custody, and provenance. | [Project Server](system/components/project-server.md) |
| Change | Accountable primitive leading one intention through accepted Wiki change and frozen requirements to completion. | [Change Trace](system/components/change-trace.md) |
| Change Completion Requirement | Frozen provider-neutral condition Project Server must prove before accepted Change completes. | [Change Trace](system/components/change-trace.md) |
| Change Intake Material | Bounded untrusted suggestion, finding, provider issue, or external code capture that may propose or reinforce a Change. | [Change Intake](system/components/change-intake.md) |
| Change proposal version | Exact proposal commit OID under one Change ID; its tree contains appended proposal operation and any Wiki Item changes. | [Decision](system/components/decision.md) |
| Change Trace | Sole append-only JSONL dossier and typed operation history for one Change. | [Change Trace](system/components/change-trace.md) |
| Check | Composable binary or quantitative judgment that becomes one project-owned Gate boundary when registered as a top-level Pack Check. | [Checks](system/components/checks.md) |
| Check Author | Developer who builds reusable Probes and composable Checks against exact CodeWiki project snapshots. | [Checks](system/components/checks.md) |
| Check Input | Versioned bounded data supplied to one Code or Model Check for an exact stage subject. | [Checks](system/components/checks.md) |
| Check Output | Bounded Code or Model Check response containing one boolean or quantitative measurement and optional factual detail. | [Checks](system/components/checks.md) |
| Check Pack | Project-owned Check group, stage-first with a Skill in v1 and pack-first with Checks only in target. | [Checks](system/components/checks.md) |
| Check Result | Immutable completed `passed/failed` judgment binding package, Check, input, measurement, threshold, execution, and optional failure. | [Checks](system/components/checks.md) |
| Check Run | One bounded execution attempt that either produces a Check Result or stops for an operational reason. | [Checks](system/components/checks.md) |
| Check SDK | Author-facing read-only primitives for Probes, composable Checks, exact project queries, diagnostics, bundling, fixtures, and replay. | [Checks](system/components/checks.md) |
| Client | Software endpoint that speaks CodeWiki Client-Project Server Protocol without becoming the accountable Actor or gaining Project Server authority. | [Clients](system/components/clients.md) |
| CodeWiki Console | Minimal first-party scriptable/terminal Client over public APIs, read-only by default and without implicit privilege. | [Clients](system/components/clients.md) |
| Code Check | Sandboxed JavaScript program returning one binary or quantitative Check Output. | [Checks](system/components/checks.md) |
| Compaction Checkpoint | DSH model-surface replacement retaining raw history, restricted to one in-flight Run in the target. | [Runtime](system/components/runtime.md) |
| Controlled provenance | Candidate provenance proven by exact stage-appropriate Project Server custody. | [Project Server](system/components/project-server.md) |
| Contribution Routing | Read-only projection of eligible reviewers, contributors, and Implementation Workers with match reasons, coverage, unknowns, and staleness. | [Alignment](system/components/alignment.md) |
| CodeWiki Plugin | Admitted implementation of one bounded external or namespaced mechanic. | [Package](system/components/package.md) |
| Decision | Stage Loop that evaluates accepted intent and desired-Knowledge impact. | [Decision](system/components/decision.md) |
| Default Pack | Domain-supplied stage Pack copied once into project policy; editable, removable, and never auto-restored. | [Checks](system/components/checks.md) |
| Delegated Run | CodeWiki-launched Claude Code, Codex, ACP, or future harness run for which CodeWiki owns dispatch and admitted artifacts while the child harness owns its inner Turn Loop. | [Runtime](system/components/runtime.md) |
| Delivery effect | Separately authorized change to a protected delivery boundary. | [Project Server](system/components/project-server.md) |
| Development stage | User-facing Decision, Planning, Implementation, or Review stage backed by its semantic Stage Loop. | [Project Server](system/components/project-server.md) |
| Discovery Finding | Producer-neutral bounded report of new or out-of-scope work that carries no Check or Change authority. | [Change Intake](system/components/change-intake.md) |
| Domains | Backend v1 semantic Plugin registry deleted in target; universal schemas, Checks, config, CodeWiki Plugins, and DSH Plugins retain narrow owners. | [Domains](system/components/domains.md) |
| Evidence Record | Observation metadata citing exact material; not payload custody or Result. | [Evidence](system/components/evidence.md) |
| Raw Data Source | Mutable external/local origin represented through immutable observed Revisions. | [Evidence](system/components/evidence.md) |
| Raw Data Policy | Frozen capture/retention selection resolved within operator/legal constraints. | [Evidence](system/components/evidence.md) |
| Execution Ledger | Append-only retained record of exact CodeWiki-controlled Run inputs, queries, provider receipts, compaction, usage, cancellation, and output. | [Runtime](system/components/runtime.md) |
| External Agent Client | Independent MCP harness owning its prompts, tools, reads, models, subagents, runtime, and memory. | [Clients](system/components/clients.md) |
| External Candidate Capture | Fingerprint/material for observed Git state lacking Project Server custody. | [Project Server](system/components/project-server.md) |
| External-client provenance | Authenticated CodeWiki operations and Workbench custody without claiming Client internals. | [Project Server](system/components/project-server.md) |
| External provenance | Fail-closed Candidate provenance assigned when exact Project Server custody cannot be proven. | [Project Server](system/components/project-server.md) |
| Gate | Runs resolved stage policy over exact Candidate/package and returns Gate Report without routing. | [Checks](system/components/checks.md) |
| Gate Report | Immutable `passed/failed/stopped` outcome binding package, Results, execution, warnings, and stop reason. | [Checks](system/components/checks.md) |
| Implementation | Stage Loop satisfying accepted Work Units and Completion Requirements through exact Candidates and integration. | [Implementation](system/components/implementation.md) |
| Improvement Assessment | Explicit deliberate process for producing Discovery Findings outside failed-Check feedback. | [Change Intake](system/components/change-intake.md) |
| Integration | Project Server-owned expected-Git-head admission of passing Candidates/proposed artifacts into one Change lineage whose aggregate becomes Review subject. | [Implementation](system/components/implementation.md) |
| Knowledge | Backend v1 accepted desired meaning generalized into the mandatory Git-versioned Wiki in target. | [Knowledge](system/components/knowledge.md) |
| Git Project Store | Mandatory local repository with canonical first-parent history and managed active-Change refs for artifacts, Wiki, and traces. | [Project](system/components/project.md) |
| Wiki | Singular Git-versioned materialization of agreed descriptive, historical, and normative project knowledge. | [Knowledge](system/components/knowledge.md) |
| Wiki Item | Sole Wiki semantic unit: immutable ID, aliases, relations, provenance, attributes, body. | [Knowledge](system/components/knowledge.md) |
| Change disposition commit | Two-parent Git commit retaining exact proposal ancestry and accepting or excluding proposed Wiki bytes under canonical-ref CAS. | [Change Trace](system/components/change-trace.md) |
| Knowledge Effect | One atomic `set` or `retire` operation targeting a stable Knowledge subject or facet, binding expected prior state or absence, and carrying complete post-state once when required. | [Knowledge](system/components/knowledge.md) |
| Knowledge Projection | Deterministic Markdown, YAML, OKF, dossier, index, or other materialized view of one exact Knowledge State under one exact renderer identity. | [Knowledge](system/components/knowledge.md) |
| Knowledge State | Current accepted desired semantic subjects, facets, relationships, and content produced from the initial seed plus confirmed Knowledge Effects. | [Knowledge](system/components/knowledge.md) |
| Knowledge Subject ID | Immutable path-independent `cw:<kind>:<stable-key>` connecting Knowledge through Change, project artifacts, Evidence, and Review. | [Knowledge](system/components/knowledge.md) |
| Model Check | Tool-free isolated model run over exact bounded input through a separately configured Check model route. | [Checks](system/components/checks.md) |
| AI Provider | External model supplier or local inference service reached through qualified DSH mechanics and AI Gateway, without CodeWiki authority. | [Provider Boundary](system/components/provider-boundary.md) |
| Outcome Diagnostics | Post-Gate bounded analysis of repeated outcomes that may propose ordinary Change Intake Material for Skills, Checks, context APIs, routes, or configuration without mutating them. | [Change Intake](system/components/change-intake.md) |
| Pack Skill | Backend v1 producer guidance removed from target Check Pack and Run contracts. | [Checks](system/components/checks.md) |
| Pairing | Durable Project Server enrollment of one Client installation for one Actor; it grants connection eligibility, not project authority. | [Project Server](system/components/project-server.md) |
| Planning | Change-scoped Stage Loop that turns one ratified Change into an immutable Work Graph delta without regenerating a global plan. | [Planning](system/components/planning.md) |
| Probe | Reusable Check SDK function that returns bounded package-bound facts with provenance and coverage without deciding pass or fail. | [Checks](system/components/checks.md) |
| Review | Independent Change-scoped Stage Loop that judges the exact aggregate integrated Work Unit lineage against complete acceptance and delivery standards. | [Review](system/components/review.md) |
| Review Claim | Current responsibility for one exact Review Requirement and Change version; it is not approval. | [Change Trace](system/components/change-trace.md) |
| Review Requirement | Policy-bound review class, scope, minimum approvals, and independence rule for one exact Change version. | [Change Trace](system/components/change-trace.md) |
| Review Submission | Immutable authenticated disposition and rationale for one exact Review Requirement and Change version. | [Change Trace](system/components/change-trace.md) |
| Source ownership | Component-declared intended boundary for source and test responsibility. | [Knowledge](system/components/knowledge.md) |
| Run Context Bundle | Immutable authorized read-only local query materialization built for one Run after canonical replay and WorkState reduction; never continuity authority. | [Runtime](system/components/runtime.md) |
| Gate Evaluation Package | Immutable Candidate-checkpoint package containing only declared exact Check and Gate inputs; it is separate from producer context and provides no live Project Server handle. | [Checks](system/components/checks.md) |
| Stage Loop | One of Decision, Planning, Implementation, or Review and no other CodeWiki capability. | [Project Server](system/components/project-server.md) |
| Stage Producer | Agent or deterministic service that proposes one Decision, Planning, Implementation, or Review Candidate without owning Gate judgment or lifecycle authority. | [Runtime](system/components/runtime.md) |
| Stopped Gate | Gate attempt that produced no valid complete outcome because execution, capability, input, budget, cancellation, or freshness failed operationally. | [Checks](system/components/checks.md) |
| Turn Loop | Harness-owned model-request, tool-execution, and continuation cycle inside one Run; it owns no CodeWiki Stage Loop transition. | [Runtime](system/components/runtime.md) |
| User | Human operating CodeWiki through a User Interface. | [Clients](system/components/clients.md) |
| CodeWiki App | Separate rich Client product over public Kernel API/Client SDK; may own login UX but no project AuthZ or canonical authority. | [Clients](system/components/clients.md) |
| User Standard | Project expectation expressed directly as one or more editable Checks. | [Checks](system/components/checks.md) |
| Work Graph | Canonical Project Server-owned dependency graph formed from accepted immutable Change-scoped Planning deltas and current Work Unit state. | [Planning](system/components/planning.md) |
| Work Unit | Immutable singly owned Planning unit with judgeable outcome, requirement coverage, dependencies, scope, resources, and verification. | [Planning](system/components/planning.md) |
| Workbench | Project Server-owned isolated Git worktree/repository and command environment for one exact Assignment. | [Project Server](system/components/project-server.md) |
| Worker | Implementation Worker: Agent, process, or service executing one accepted Work Unit through one bounded Assignment in one Project Server-owned Workbench. | [Runtime](system/components/runtime.md) |
| Worker Offer | Bounded Implementation Worker capabilities, tools, model-route labels, availability, concurrency, custody class, ownership, and allowed projects. | [Runtime](system/components/runtime.md) |
| WorkState | Deterministic current-state projection used for guards, Work Graph readiness, snapshot construction, integration completion, and state-aware rehydration. | [WorkState](system/components/work-state.md) |
