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
    rationale: Runtime mounts exact Run Context Bundles and receipts local queries, Work Continuity execution, and DSH compaction.
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

Backend v1 Request `6.0.0`, Receipt `4.0.0`, and Continuation `1.0.0` permit Sessions across Runs. Target Request `7.0.0` has one immutable semantic digest plus distinct creation and recovery dispatch digests; recovery binds repaired head. Receipt `5.0.0` orders dispatches and closes the Session. Continuation `2.0.0` and Ledger `6.0.0` retain canonical and execution bindings.

Runtime owns authenticated acceptance, ordered events, cancellation, deadline, quiescence, exit proof, evidence, and receipt. Internal channel protocol `3.0.0` uses shell-free spawn, private pipes, empty environment, bounded frames, and observed termination. A terminal process result is not a receipt: only complete validated closure can become `completed`; delegated custody records gaps.

Run failure cannot mutate accepted state. Project Server chooses retry, same-Run recovery, rollover after valid Receipt, or stop. Missing closure enters `recovery_stopped`; only authenticated Ledger, raw-log, head, and quiescence repair may yield the stopped Receipt required by a successor. Irrecoverable closure remains quarantined without waiver.

## Runtime Builds

Runtime Build Manifest `4.0.0` binds Domain, protocol, Node path/version/bytes, outer sandbox, DSH/Cordis, Plugins, Runtime bytes, suite, and Evidence. Runtime rehashes executable bytes before activation and launch. Retained `3.0.0` records require requalification and Session rollover; drift stops.

Pins remain DSH `0.1.1-rc.2`, Cordis `4.0.1`, Loader `1.0.2`, `pi-ai` `0.82.1`, and reviewed source `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`; source equivalence is unattested. No selector, fallback engine, or Runtime Pi exists.

Runtime Production Qualification `1.0.0` binds host, containment, DSH, Plugins, routes, Domain, and Evidence without authority. `RuntimeOperationsInspectionPort` exposes verified Build and Receipt metadata only.

## DSH composition and Runtime Bridge

`runDshRuntimeBridge` maps Request to exact DSH Agent/release composition and returns Runtime facts. Loader IDs/modules compile into Runtime bytes; Loader owns lifecycle/Fiber, and startup requires expected inventory active. AI Provider installer is narrow DSH seam.

DSH owns mechanics/inventory; CodeWiki owns release admission/ceilings; Project Server owns route, account, budget, lifecycle. Private Provider Broker `3.0.0` binds Run authorization, account route, request/token budgets, host composition, retry, Receipt. Broker Host mounts DSH LLM, authorization, credential, inventory; Run receives no credentials/project authority. Target names boundary AI Gateway and inference endpoint AI Provider; persisted names remain Backend evidence. Local files qualify only isolated single-user use outside project/Run roots. OAuth, ambient credentials/secret headers, unsupported protocols, multi-user local files fail closed.

Managed Runs disable ambient settings/discovery/install, UI/Host APIs, product MCP, self-modification, and uncontrolled drivers. Trusted AI Gateway/client profiles stay outside Run sandboxes without Project Server authority.

Project Server authorizes each Run and mounts DSH Goal state without a model completion tool or autonomous driver. Candidate output pauses the Goal; Project Server and Gates determine completion. Replay is qualification, not fallback.

Each DSH Plugin contributes an allowlisted capability in one trust plane. Project files install no executable Plugins. Effective Run capability intersects release ceiling, Project Server authorization, Run Request, and any narrower Skill declaration.

## Run kinds and isolation

Work Continuity is Change-scoped for Decision/Planning, Assignment-scoped for Implementation, and lineage-scoped for Review. Each target Session belongs to one in-flight Run. Same-Session recovery preserves semantic and execution bindings; a new dispatch binds repaired head and raw log. Semantic change or terminal Receipt requires fresh rehydration. Model Checks stay fresh and tool-free; DSH owns no Stage Loop.

DSH and Code Checks use distinct sandboxes. Production DSH requires qualified outer and inner boundaries; see [Contain Model-Authored Code](../../product/stories/maintainer/contain-model-code.md).

Only an Implementation Run may receive a writable Workbench. Project Server owns the Workbench, Assignment, base and resulting tree, command policy, and Integration. Runtime receives only the bounded capability described by the Run Request. Decision, Planning, Review, and Model Check Runs receive no writable Workbench authority.

Delegated Runs use exact delegation Providers. Runtime controls dispatch, admitted task/artifacts, lifecycle, cancellation, and granted Workbench capability. Receipts declare unobserved inner prompts, settings, tools, models, and continuation. External Agent Clients retain their pipelines.

## Context, evaluation, ledger, and compaction

Backend-v1 producer Runs mount immutable Project Context Snapshot `1.0.0` artifacts. Target Project Server replays canonical owners, rebuilds WorkState, then materializes one immutable authorized `codewiki.run-context-bundle@1.0.0` per Run from exact repository/canonical/proposal commits, fixed-path Wiki/Trace bytes, WorkState, Alignment, active Changes, Work Graph, Evidence, Results, authorization, query-engine/capability closure, coverage, freshness, staleness, bounds, and handles. Bundle is read-only local query input/evidence, never canonical state, continuity source, or Gate package. Its digest excludes capture time; chunks may be reused. Changed input requires a fresh Run/Session. Typed local queries bind bundle, engine, arguments, bounds, order, sources, coverage, unknowns, truncation, and staleness, with no live round trip or ambient fallback.

Project Server freezes a distinct immutable Gate Evaluation Package only after Candidate checkpoint. Checks receive only declared exact package inputs; Model Checks receive no live Project Server handle, producer context-query tools, producer Session, or memory. Production Run Processes require an exact unexpired authorization and read-only Run Context Bundle mount, then expose separate Wiki Item, Alignment, Git Project State, Evidence, Result, and Change-delta tools. `StageContextBundle` and `query_stage_context` remain isolated replay qualification evidence only.

Every controlled model-visible input, context query, replacement, provider receipt, usage, output, and cancellation enters Execution Ledger `5.0.0`. Its header binds Request, Build, Work Continuity, lease, material, feedback, route, tools, and Skills. Provider entries bind broker, request, response, selected provider, account and model, attempts, request ID, usage, budget-bound authorization, and outcome. Authenticated frames persist the digest chain under expected-head CAS.

Stage Efficiency Metrics `1.0.0` records source/cached/output/tool tokens, repeated/new bytes, Candidate amplification, active-Change expansion, and cache hits. It binds observed inputs/outputs, rejects impossible counts, and remains Evidence without lifecycle authority.

Session bytes are Evidence, not project state. DSH owns opaque mechanics; Runtime owns custody/Receipts; Project Server owns Work Continuity. Backup parses no meaning. Corruption blocks same-Run recovery. A successor requires independent Ledger, raw-log, head, and quiescence closure; otherwise Work Continuity remains `recovery_stopped`.

Bounded authenticated chunks append by digest and offset; interruption resumes idempotently. Runtime revalidates exact retained bytes on each read. A completed Receipt commits only after its ledger, raw log, terminal output, quiescence, and process exit close. Commit is immutable, identity-keyed, atomic, and CAS-guarded; recovery rejects missing, corrupt, mismatched, or misnamed evidence and duplicate Run authority.

Backend v1 Compaction Summary `1.0.0` remains current until cutover. Target retires it; canonical records own cross-Run Work Continuity. DSH may compact only within one in-flight producer Run, never for Model Checks or across terminal Runs. Raw history remains, summaries have no authority, and unsafe reduction stops.

## Authority and API

Runtime cannot write canonical Git ref, Change Trace, WorkState, Knowledge/Wiki, Project Configuration, Gate state, Workbench custody, Change completion, or protected refs. DSH Plugins and Run Processes receive no such capability. CodeWiki Plugins are a separate Project Server-admitted protocol boundary; DSH Plugin identity never grants CodeWiki Plugin admission. Project Server alone validates Run Receipt against the exact producer attempt, Assignment, or Check invocation and decides Candidate admission or further action.

Runtime contracts publish from `src/runtime/index.ts` as `@nunomoura/codewiki/runtime`. Core imports neutral `src/runtime/contracts.ts`; DSH, Pi, delegation, process, and sandbox implementations stay outside. Runtime is sole unqualified CodeWiki Runtime term; upstream names remain DSH-qualified.
