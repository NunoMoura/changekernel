---
type: System Component
codewiki_id: cw:component:runtime
title: Runtime
description: Executes immutable Run Requests through exact Runtime Builds and controlled Run Processes, then creates bounded Run Receipts without project authority.
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
---
# Runtime

Runtime is the Project Server-owned execution subsystem. It accepts immutable Run Requests, executes bounded Runs, controls Run Processes, and creates CodeWiki-authored Run Receipts. It owns no project meaning, Client authentication, project authorization, Stage Loop, Candidate admission, Check Result, Gate reduction, lifecycle transition, Workbench custody, or guarded effect.

```text
Project Server
  -> Run Request
  -> Runtime
  -> Run Process
  -> DSH Adapter
  -> DSH Agent + AgentLoop + Agent Session
  -> Runtime
  -> Run Receipt
  -> Project Server
```

Run Request and Run Receipt form the semantic boundary between Project Server and Runtime. Run Process protocol is an internal transport boundary. DSH remains behind the Adapter and receives no canonical storage handle.

## Run lifecycle

Run Process `4.0.0` accepts exact producer snapshot mounts. Run Request `4.0.0` binds stage, subject, custody, Build, Session head and lease, context, inputs, route, workspace, budgets, and Run Continuation `1.0.0`. Project Server decides why it exists and what follows. Run Receipt `3.0.0` binds that execution, resulting raw-log head, ledger, output, and custody. Sessions span Runs under one writer; each Candidate has one producing Run.

Runtime owns acceptance, authenticated process binding, ordered events, cancellation, deadline, quiescence, exit proof, forced termination, evidence, and final receipt. Internal `codewiki.run-process@3.0.0` uses shell-free spawn, private pipes, empty environment, bounded frames, and observed termination.

A Run Process sends one authenticated terminal result after its final event and before quiescence. It is not a receipt. Runtime issues a receipt only after validating request, result, events, custody, logs, ledger, quiescence, and exit. Missing required proof prevents `completed`; delegated custody records visibility gaps.

Run failure cannot mutate accepted project state. Runtime returns a bounded stopped receipt or operational fact; Project Server decides whether to retry from canonical state, resume the exact Agent Session at its expected head under a new lease, roll logical continuity into a new Session with deterministic rehydration, or stop the Stage Loop attempt.

## Runtime Builds

A Runtime Build is the immutable content-addressed DSH execution closure. Its manifest binds protocol, Node, reviewed source commit, executed DSH/Cordis closure, Runtime Plugins, adapters, and artifact bytes. Reviewed source and package closure remain distinct without attestation.

Qualification binds suite and Evidence digests. Runtime privately stores qualified builds; CAS selects one active build for new Runs. Requests permanently bind build and protocol. Same-Session resume requires the original build. Missing, altered, unqualified, or incompatible artifacts stop without fallback; rollback affects future Runs only.

There is no user-facing build selector, Pi fallback, or permanent multi-engine mode. The temporary Pi implementation remains migration evidence under `src/runtime/pi/**` until the DSH path proves semantic parity, then it is deleted.

## DSH Adapter

CodeWiki's in-process DSH Adapter constructs exact DSH Agents from Requests and translates DSH events and terminal output into Runtime facts. DSH remains unmodified upstream code.

DSH owns AgentLoop request, streaming, tool pairing, continuation, cancellation, Session events, compaction mechanics, and delegated plumbing. CodeWiki owns prompts, Skills, local context bindings, provider-broker capability, routes, secrets, budgets, policy, observations, and receipts.

Production disables ambient profiles, settings, Skill discovery, workspace instructions, dynamic plugins, DSH UI/Host API, product MCP, and uncontrolled drivers. CodeWiki mounts DSH Goal state without a model Goal tool or autonomous driver. Project Server authorizes each Run; Candidate output pauses the Goal; Project Server and Gates determine completion. DSH never selects stages, retries, Results, Gates, or effects. Replay is qualification, not fallback.

Each Runtime Plugin contributes one first-party allowlisted capability through the DSH Adapter: tool, context binding, Skill provider, model/delegate adapter, observer, or compaction policy. Project files install no executable Runtime Plugins. Effective capability is the intersection of CodeWiki release ceiling, Project Server authorization, Run Request, and any narrower Skill declaration.

## Run kinds and isolation

Decision and Planning Sessions are Change-scoped, Implementation is Work Unit-scoped, and Review is integration-lineage-scoped and independent. Producer Sessions span bounded Runs without depending on server or process lifetime. Same-Session resume requires original build/protocol; change requires rollover and canonical rehydration. DSH owns no Stage Loop. Each Model Check uses a fresh tool-free Session without producer state.

Code Checks use deterministic admitted sandboxes rather than DSH. A Run Sandbox term is reserved for enforced filesystem, network, process, environment, credential, and resource containment; an ordinary child process is called a Run Process and is not mislabeled as a security sandbox.

Only an Implementation Run may receive a writable Workbench. Project Server owns the Workbench, Assignment, base and resulting tree, command policy, and Integration. Runtime receives only the bounded capability described by the Run Request. Decision, Planning, Review, and Model Check Runs receive no writable Workbench authority.

Delegated Runs use exact adapters. Runtime controls dispatch, admitted task/artifacts, lifecycle, cancellation, and granted Workbench capability. Receipts declare unobserved inner prompts, settings, tools, models, and continuation. External Agent Clients retain their pipelines.

## Context, evaluation, ledger, and compaction

Producer Runs mount immutable content-addressed Project Context Snapshot Protocol `1.0.0` artifacts built from exact WorkState, Knowledge, Alignment, active Changes, Work Graph, repository, Evidence, and Results. Each snapshot is a local query substrate, not canonical state or Gate package. Its reusable semantic context digest excludes capture time; a separate observation digest binds coverage, freshness, and staleness. Sessions switch snapshots only at exact idle boundaries. Typed direct, batch, and cursor queries bind snapshot, engine, arguments, bounds, order, sources, coverage, unknowns, truncation, and staleness, with no live round trip or ambient fallback. Benchmark evidence selects a derived repository index plus explicitly bounded file content over mounting unrelated repository bytes.

Project Server freezes a distinct immutable Gate Evaluation Package only after Candidate checkpoint. Checks receive only declared exact package inputs; Model Checks receive no live Project Server handle, producer context-query tools, producer Session, or memory. Production Run Processes require an exact unexpired authorization and read-only snapshot mount, then expose separate Knowledge, Alignment, Project State, repository, Evidence, Result, and Change-delta tools. `StageContextBundle` and `query_stage_context` remain isolated replay qualification evidence only.

Every controlled model-visible input, context query, replacement, usage, output, and cancellation enters Execution Ledger `4.0.0`. Its header binds Request, Build, continuity, continuation policy, expected Session head, lease, material, feedback, input, route, tools, and Skills. Authenticated header and entry frames persist the canonical digest chain under expected-head CAS; recovery revalidates it.

Stage Efficiency Metrics Protocol `1.0.0` records exact source, cached-input, model-output, and tool-result token accounting plus repeated and new output bytes, Candidate-to-edit amplification, active-Change expansion, and cache-hit rate for each Stage. Metrics bind exact caller-supplied observed inputs and outputs, reject impossible counts, and remain measurement Evidence rather than lifecycle authority.

Raw DSH Agent Session bytes remain evidence, not project state. Bounded authenticated chunks append by digest and offset; interruption resumes idempotently. Runtime revalidates exact retained bytes on each read. A completed Receipt commits only after its ledger, raw log, terminal output, quiescence, and process exit close. Commit is immutable, identity-keyed, atomic, and CAS-guarded; recovery rejects missing, corrupt, mismatched, or misnamed evidence and duplicate Run authority.

Compaction changes model-visible surface only. Run Continuation binds promoted authority, semantic state, feedback, obligations, predictive reserves, retention, and threshold. At resumed idle Sessions, DSH measures and prunes, then invokes deterministic CodeWiki Compaction Summary `1.0.0`; unavailable pressured reduction stops for rollover. Checkpoints cite shadowed sequences and digests while raw history remains. Never compact during open work or before Candidate freezing. Summary text and opaque heap are never canonical.

## Authority and API

Runtime cannot write Change Trace, WorkState, Knowledge, Project Configuration, Gate state, Workbench custody, or protected refs. Runtime Plugins and Run Processes receive no such capability. Project Server alone validates Run Receipt against the exact producer attempt, Assignment, or Check invocation and decides Candidate admission or further action.

Runtime public contracts live at `src/runtime/index.ts` and publish as `@nunomoura/codewiki/runtime`. Core domains import only neutral `src/runtime/contracts.ts`; concrete DSH, Pi, delegate, process, and sandbox implementations remain outer adapters. Runtime is the only unqualified CodeWiki architecture term named Runtime. Upstream names such as `DSH RuntimeContext` remain explicitly DSH-qualified implementation details.
