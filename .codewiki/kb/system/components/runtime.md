---
type: System Component
codewiki_id: cw:component:runtime
title: Runtime
description: Executes immutable Run Requests through exact Runtime Builds, DSH Plugin composition, and controlled Run Processes without project authority.
status: stable
tags: [system, component]
codewiki_component: cw:component:runtime
codewiki_source_patterns: ["src/runtime/**"]
codewiki_test_patterns: ["tests/runtime/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Runtime supplies isolated accountable execution for Project Server-issued Runs.
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Runtime supplies isolated Code and Model Check execution without Result authority.
  - type: realizes
    target: cw:story:check-author.author-composable-checks
    rationale: Runtime supplies immutable input and sandbox boundaries for authored Code Checks.
  - type: realizes
    target: cw:story:agent.retrieve-bounded-context
    rationale: Runtime mounts exact Project Context Snapshots and receipts local queries, session continuity, and DSH compaction.
  - type: realizes
    target: cw:story:maintainer.contain-model-code
    rationale: Runtime supplies separately qualified outer Run Process and inner model-code containment.
---
# Runtime

Runtime is the Project Server-owned execution subsystem. It accepts immutable Run Requests, executes bounded Runs, controls Run Processes, and creates CodeWiki-authored Run Receipts. It owns no project, lifecycle, Gate, Workbench, or effect authority.

```text
Project Server
  -> Run Request
  -> Runtime
  -> qualified outer Run Sandbox
  -> Run Process
  -> Runtime Bridge
  -> DSH Agent + AgentLoop + Agent Session + admitted DSH Plugins
  -> admitted inner Code Runtime
  -> Runtime
  -> Run Receipt
  -> Project Server
```

Run Request and Run Receipt form the semantic boundary between Project Server and Runtime. Run Process protocol is an internal transport boundary. DSH remains behind the Runtime Bridge and receives no canonical storage handle.

## Run lifecycle

Run Process and Run Request `6.0.0` bind snapshot or replay/broker inputs, subject, Build, Session lease, provider/account/credential/model route, workspace, budgets, and Run Continuation `1.0.0`. Run Receipt `4.0.0` binds execution, route, raw-log head, ledger, output, and custody. Sessions span Runs under one writer; each Candidate has one producing Run.

Runtime owns authenticated acceptance, ordered events, cancellation, deadline, quiescence, exit proof, evidence, and receipt. Internal channel protocol `3.0.0` uses shell-free spawn, private pipes, empty environment, bounded frames, and observed termination. A terminal process result is not a receipt: only complete validated closure can become `completed`; delegated custody records gaps.

Run failure cannot mutate accepted state. Project Server alone chooses canonical retry, exact-head Session resume under a new lease, explicit rollover with rehydration, or stop.

## Runtime Builds

Runtime Build Manifest `3.0.0` binds protocol, exact Domain Plugin identity, Node, packages, executable Plugin admission closure, bytes, suite, and Evidence. Pins are 33 DSH `0.1.1-rc.2` packages, Cordis `4.0.1`, Loader `1.0.2`, `pi-ai` `0.82.1`, and reviewed source `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`; package integrity is locked and source equivalence unattested.

Runtime privately stores qualified builds; CAS activates new-Run selection. Requests and Session resume bind the original build and protocol. Missing, changed, unqualified, or incompatible artifacts stop; rollback affects future Runs only.

There is no build selector, Pi fallback, multi-engine mode, or Runtime Pi implementation. DSH is the sole first-party engine; Pi remains Client-only and cannot execute Runs.

## DSH composition and Runtime Bridge

Public `runDshRuntimeBridge` maps one Request to the exact DSH Agent and release composition, then returns Runtime facts. Stable Loader entry IDs and module specifiers compile into Runtime bytes. Loader owns lifecycle and Fiber state; startup requires every expected upstream inventory entry enabled and active. The model Provider installer remains a narrow seam.

DSH owns mechanics and live inventory; CodeWiki owns release admission and capability ceilings. Project Server owns route, account, budget, and lifecycle policy. Private Provider Broker `3.0.0` binds exact Run authorization, account route, request/token budgets, host composition, retry, and receipt. Broker Host mounts official DSH LLM, authorization, local credential, and inventory seams; Run Processes receive neither credentials nor project authority. Local files qualify only for isolated single-user deployment outside project/Run roots. OAuth, ambient credentials, secret headers, unsupported protocols, and multi-user local files fail closed.

Managed Runs disable ambient settings, discovery, installation, UI/Host APIs, product MCP, self-modification, and uncontrolled drivers. Trusted broker and future client profiles remain outside Run sandboxes and gain no Project Server authority.

Project Server authorizes each Run and mounts DSH Goal state without a model completion tool or autonomous driver. Candidate output pauses the Goal; Project Server and Gates determine completion. Replay is qualification, not fallback.

Each DSH Plugin contributes an allowlisted capability in one trust plane. Project files install no executable Plugins. Effective Run capability intersects release ceiling, Project Server authorization, Run Request, and any narrower Skill declaration.

## Run kinds and isolation

Decision and Planning Sessions are Change-scoped, Implementation is Work Unit-scoped, and Review is integration-lineage-scoped and independent. Producer Sessions span bounded Runs without depending on process lifetime. Same-Session resume requires the original build, protocol, role, and model route; change requires rollover and canonical rehydration. Each Model Check uses a fresh tool-free Session without producer state. DSH owns no Stage Loop.

DSH and Code Checks use distinct sandboxes. Production DSH requires qualified outer and inner boundaries; see [Contain Model-Authored Code](../../product/stories/maintainer/contain-model-code.md).

Only an Implementation Run may receive a writable Workbench. Project Server owns the Workbench, Assignment, base and resulting tree, command policy, and Integration. Runtime receives only the bounded capability described by the Run Request. Decision, Planning, Review, and Model Check Runs receive no writable Workbench authority.

Delegated Runs use exact delegation Providers. Runtime controls dispatch, admitted task/artifacts, lifecycle, cancellation, and granted Workbench capability. Receipts declare unobserved inner prompts, settings, tools, models, and continuation. External Agent Clients retain their pipelines.

## Context, evaluation, ledger, and compaction

Producer Runs mount immutable content-addressed Project Context Snapshot Protocol `1.0.0` artifacts built from exact WorkState, Knowledge, Alignment, active Changes, Work Graph, repository, Evidence, and Results. Each snapshot is a local query substrate, not canonical state or Gate package. Its reusable semantic context digest excludes capture time; a separate observation digest binds coverage, freshness, and staleness. Sessions switch snapshots only at exact idle boundaries. Typed direct, batch, and cursor queries bind snapshot, engine, arguments, bounds, order, sources, coverage, unknowns, truncation, and staleness, with no live round trip or ambient fallback. Benchmark evidence selects a derived repository index plus explicitly bounded file content over mounting unrelated repository bytes.

Project Server freezes a distinct immutable Gate Evaluation Package only after Candidate checkpoint. Checks receive only declared exact package inputs; Model Checks receive no live Project Server handle, producer context-query tools, producer Session, or memory. Production Run Processes require an exact unexpired authorization and read-only snapshot mount, then expose separate Knowledge, Alignment, Project State, repository, Evidence, Result, and Change-delta tools. `StageContextBundle` and `query_stage_context` remain isolated replay qualification evidence only.

Every controlled model-visible input, context query, replacement, provider receipt, usage, output, and cancellation enters Execution Ledger `5.0.0`. Its header binds Request, Build, continuity, lease, material, feedback, route, tools, and Skills. Provider entries bind broker, request, response, selected provider, account and model, attempts, request ID, usage, budget-bound authorization, and outcome. Authenticated frames persist the digest chain under expected-head CAS.

Stage Efficiency Metrics Protocol `1.0.0` records exact source, cached-input, model-output, and tool-result token accounting plus repeated and new output bytes, Candidate-to-edit amplification, active-Change expansion, and cache-hit rate for each Stage. Metrics bind exact caller-supplied observed inputs and outputs, reject impossible counts, and remain measurement Evidence rather than lifecycle authority.

Agent Session bytes are evidence, not project state. DSH owns format and behavior, Runtime owns opaque byte custody and Receipt evidence, and Project Server owns continuity, resume, and rollover. Backup copies exact bytes and verifies digests without interpreting internals; incompatibility forces rollover.

Bounded authenticated chunks append by digest and offset; interruption resumes idempotently. Runtime revalidates exact retained bytes on each read. A completed Receipt commits only after its ledger, raw log, terminal output, quiescence, and process exit close. Commit is immutable, identity-keyed, atomic, and CAS-guarded; recovery rejects missing, corrupt, mismatched, or misnamed evidence and duplicate Run authority.

Compaction changes model-visible surface only. Run Continuation binds promoted authority, semantic state, feedback, obligations, predictive reserves, retention, and threshold. At resumed idle Sessions, DSH measures and prunes, then invokes deterministic CodeWiki Compaction Summary `1.0.0`; unavailable pressured reduction stops for rollover. Checkpoints cite shadowed sequences and digests while raw history remains. Never compact during open work or before Candidate freezing. Summary text and opaque heap are never canonical.

## Authority and API

Runtime cannot write Change Trace, WorkState, Knowledge, Project Configuration, Gate state, Workbench custody, or protected refs. DSH Plugins and Run Processes receive no such capability. Project Server alone validates Run Receipt against the exact producer attempt, Assignment, or Check invocation and decides Candidate admission or further action.

Runtime public contracts live at `src/runtime/index.ts` and publish as `@nunomoura/codewiki/runtime`. Core domains import only neutral `src/runtime/contracts.ts`; concrete DSH, Pi, delegation, process, and sandbox implementations remain outside those contracts. Runtime is the only unqualified CodeWiki architecture term named Runtime. Upstream names such as `DSH RuntimeContext` remain explicitly DSH-qualified implementation details.
