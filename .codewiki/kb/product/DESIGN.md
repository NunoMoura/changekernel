---
version: alpha
type: Design System
codewiki_id: cw:design:product
title: CodeWiki Operator Console
description: Interaction rules for minimal, truthful, terminal-first Semantic Kernel operations.
status: stable
tags: [product, design, operations]
---
# CodeWiki Operator Console

## Purpose

CodeWiki Semantic Kernel is headless. It does not own the end-user experience of products built on top of it. Core presentation is limited to a small first-party Operator Console: scriptable commands plus an optional terminal user interface for observing and recovering the Kernel.

The Console is analogous to `systemctl`, `journalctl`, `top`, `htop`, or Task Manager. It shows exact operational state and invokes narrow authenticated operations. It is not a Wiki editor, project-management product, IDE, agent chat, marketplace, or semantic desktop.

Backend v1 requires this legacy Design System item. The universal Wiki migration removes that imposed scaffold; this item may then remain an ordinary Operator Console specification. It never becomes a visual standard for external applications.

## Product boundary

The CodeWiki repository owns:

- the headless Semantic Kernel;
- Kernel API and Wire Protocol;
- an application SDK and conformance suite;
- scriptable operator commands;
- a minimal terminal-first Operator Console;
- schemas, lifecycle tooling, and recovery operations.

External applications own web, desktop, IDE, chat, mobile, workflow, autonomous-service, and rich project experiences. A full Semantic Desktop is a separate product even when maintained by the CodeWiki team. It consumes the same public APIs and receives no privileged imports, storage access, hidden commands, or lifecycle authority.

## Non-goals

The Operator Console does not provide:

- Wiki or Raw Data authoring;
- rich Change drafting or semantic review workspaces;
- visual Planning boards or Workbench editing;
- Check, Check Pack, Skill, route, or provider editors;
- agent chat or model interaction;
- source, media, diagram, or dataset editing;
- package or Plugin marketplaces;
- customer branding or product navigation;
- a configurable workflow graph;
- a desktop environment.

Those capabilities belong to external applications or ordinary project tooling.

## Surfaces

The Console has two equivalent thin-client surfaces:

1. scriptable commands for automation and precise inspection;
2. an optional interactive terminal view for live observation and narrow operator actions.

A target command family may include:

```text
codewiki status
codewiki ps
codewiki changes
codewiki work
codewiki gates
codewiki effects
codewiki inspect <identity>
codewiki events
codewiki backup
codewiki recover
codewiki top
```

Names remain provisional until the Kernel API and Operations API freeze. Commands and the TUI use those versioned APIs rather than importing Project Server internals or reading canonical files directly.

## Authority model

The Console is read-only by default. Being shipped with CodeWiki grants no authority. Every operation binds an authenticated actor or operator, exact repository, target identity, expected head, requested capability, and bounded payload.

Safe inspection and protected mutation remain visually and mechanically distinct. A protected action must show:

- the exact subject and current head;
- requested operation and consequence;
- authority basis;
- stale or conflicting state;
- whether external effects may occur;
- the expected Receipt;
- the confirmation required before dispatch.

The Console never manufactures lifecycle state, Check Results, acceptance, activity, custody, causality, or recovery success. It presents Kernel facts and the exact authority that produced them.

## Information hierarchy

The default view answers five operational questions:

1. Is the Semantic Kernel healthy?
2. What accepted Wiki checkpoint is current?
3. What realization and Delivery checkpoint is active?
4. Which Changes, Work Units, Runs, Gates, or Effects need attention?
5. Can the operator safely stop, inspect, retry, or recover the affected operation?

A compact header shows:

- project and repository identity;
- Backend or Kernel Build identity;
- Project Server generation and health;
- qualified host profile;
- Wiki checkpoint;
- current realization and Delivery binding;
- Alignment summary;
- event-stream freshness.

The primary body contains bounded tables for active Changes, Work Units, DSH Runs, failed or stopped Gates, pending Effects, and faults. Exact identities remain inspectable without forcing full digests into every row.

## Operational views

### Overview

Shows component health, current heads, active workload, attention count, host enforcement profile, and bounded resource use. Process availability never appears as semantic acceptance.

### Changes and Work

Shows active Change identity, semantic checkpoint, current stage, realization status, ready or blocked Work Units, dependencies, and stale conditions. It does not offer rich authoring or silently reinterpret a blocked Change.

### Runs and custody

Shows exact Run, Runtime Build, DSH Session continuity reference, route identity without secrets, Assignment, Workbench, process-tree state, budgets, cancellation, terminal evidence, quiescence, and Receipt state. Partial custody never appears complete.

### Gates and Evidence

Shows exact subject, Gate state, selected Check count, required failures, advisory findings, observations, operational unavailability, Evidence coverage, and stable failure codes. It exposes no hidden model reasoning or undeclared inputs.

### Effects and Delivery

Shows pending, authorized, executing, completed, failed, or recovery-required effects with exact idempotency and target-head bindings. Passing Review does not appear as completed Delivery.

### Faults, backups, and recovery

Shows one owner, bounded diagnosis, affected state, last verified checkpoint, available recovery action, expected head, and recovery Receipt. The Console never retries protected effects speculatively.

### Event stream

Shows bounded redacted state transitions ordered by stable cursor. A gap or generation change forces snapshot refresh rather than guessed replay. Raw DSH Session bytes, raw model outputs, credentials, and chain-of-thought never appear.

## Terminal layout

A representative layout is:

```text
 CODEWIKI  project: codewiki              Kernel Build: sha256:…
 Wiki: K17       Realization: R14         Alignment: GAP (3)
 Host: linux-x64 DSH: healthy             Project Server: ready

 CHANGES                    RUNS
 C42  Implementation  4/6   R91 running   memory 61%
 C43  Decision        wait  R92 paused    Candidate ready
 C39  Review          fail  R89 stopped   quota

 ATTENTION
 ! Required Review Check failed
 ! Delivery effect awaits authorization
 ! Raw source revision became stale
 ! Work Unit W18 is blocked by W14

 [Enter] inspect   [c] cancel Run   [r] recover   [q] quit
```

This is an information model, not a promise of exact styling or keybindings.

## Interaction rules

- Prefer one-screen operational summaries and progressive detail.
- Preserve exact identity, authority, freshness, and status at every drill-down.
- Keep selection separate from authorization.
- Require explicit confirmation for destructive or externally visible actions.
- Disable unavailable actions with one exact reason.
- Never use a generic trust score or aggregate semantic score.
- Never hide required failures behind advisory findings.
- Never infer activity from elapsed time or process existence alone.
- Never equate `wiki.head` with active Delivery.
- Never mutate Wiki, Checks, configuration, or project artifacts through local file access.
- Return every operation to a durable status and Receipt that another Client can inspect.

## Degraded operation

The Console must remain useful when models, providers, DSH Runs, drivers, external applications, or the live Project Server are unavailable. Release-managed offline inspection may verify bounded state through the Operations API or explicit maintenance operations, but it does not bypass quiescence, authentication, expected-head comparison, backup, or recovery rules.

Degraded mode clearly distinguishes:

- unavailable live state;
- last verified durable state;
- unverified filesystem observations;
- safe read-only diagnostics;
- operations requiring the Project Server to remain stopped;
- actions prohibited until authority or custody is restored.

The Console itself requires no model, DSH client UI, repository Plugin, project executable, or network service for local inspection.

## Security and redaction

The Console shows only bounded operational metadata required for diagnosis. It excludes:

- credentials, bearer tokens, and secret values;
- raw provider headers;
- raw DSH Agent Session bytes;
- raw model outputs and chain-of-thought;
- unauthorized Raw Data Source or claim existence;
- private Workbench content outside the operator's grant;
- unredacted logs;
- canonical storage handles.

Terminal escape sequences and untrusted display text are sanitized. Paths, labels, errors, and model-originated strings cannot inject control sequences, commands, links, or confirmation state. Copy operations preserve exact text without executing it.

## Accessibility and portability

The Console works without color, pointer input, Unicode decoration, animation, or a large terminal. Text labels accompany status and severity. Focus order, keyboard navigation, screen-reader-compatible command output, reduced motion, high contrast, terminal resize, and bounded line wrapping are first-class requirements.

Color may reinforce state but never define it. Default output remains deterministic enough for tests and automation. Platform path spelling is presentation only and never changes semantic identity.

## Semantic Desktop boundary

A future Semantic Desktop may combine Wiki exploration, Change workspaces, agent interaction, Workbenches, notifications, multi-project navigation, driver management, and the same operational monitor. That product owns its architecture, visual language, release cadence, threat model, and user research in a separate repository or independently versioned product boundary.

The Semantic Desktop must prove that it can operate exclusively through public CodeWiki APIs and SDKs. The Kernel remains complete, testable, recoverable, and operable without it.
