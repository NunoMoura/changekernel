---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:design:product","description":"Interaction rules for minimal, truthful, terminal-first Semantic Kernel operations.","status":"stable","tags":["product","design","operations"],"title":"CodeWiki Console","type":"Design System","version":"alpha"},"codewiki.legacy:source-path":"product/DESIGN.md"},"itemId":"cw:design:product","itemType":"codewiki.legacy:design-system","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dde8b062975e50edb38aa1962c5aede69723cfbfb757c30792f62c790eeb0c35","codewiki.legacy:source-path":"product/DESIGN.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:design:product"}],"relationships":[],"title":"CodeWiki Console"}
---
# CodeWiki Console

## Purpose

CodeWiki Semantic Kernel is headless. Core presentation is a small terminal-first Console and scriptable commands for exact inspection, recovery, and narrow authenticated operations. Rich Wiki authoring, Agent chat, project planning, IDE, desktop, and product experiences belong to external applications over public APIs.

Console behaves like an operations tool: it shows persisted Project Server facts and invokes explicit capabilities. It never reads `.codewiki/**` as an independent authority, calls models directly, fabricates state, or receives privileged imports unavailable to another Client.

## Product boundary

CodeWiki repository owns Kernel API/Client SDK, operator commands, optional terminal monitor, conformance fixtures, backup/recovery operations, and safe degraded inspection. External CodeWiki App, IDE, mobile, web, chat, and desktop products own their UX, releases, threat model, and identity acquisition. Project Server still validates proof and project AuthZ for every operation.

Initial external reference client is a separate read-only Omarchy Agent Skill and shell panel. It consumes authenticated API status, pending Decisions, Gates/Checks, Alignment, and handoff. It receives no direct project-file access or privileged mutation path.

## Default information

Console answers:

1. Is Project Server healthy and which immutable Kernel Build is active?
2. Which repository, canonical commit, Wiki tree, and managed Change tips are exact?
3. Which Proposed, Committed, blocked, or Completed Changes need attention?
4. Which Gates, active Checks, Check Runs, Results, Work Units, DSH Runs, or effects are failed, stopped, stale, or awaiting authority?
5. Which exact recovery or reconciliation action is safe?

A compact header shows Project/repository identity, Project Server generation, Kernel Build, canonical commit, current Wiki identity, managed-ref state, host qualification, Alignment summary, and event freshness. Tables show active Changes, Work Units, Gates, DSH Runs, Plugin effects, and faults with inspectable stable IDs.

## Views

### Changes and Work

Show exact Proposed Change tip or Change/Completion Commit, `changeType`, realization route, current stage, committed Wiki targets, Work Unit/dependency state, blockers, and stale conditions. Do not restate Wiki meaning as a mutable requirement list.

### Gates and Evidence

Show stage, exact subject, policy/resolver identity, active Checks, passed/failed/missing Results, advisory findings, Evidence coverage, and stop reason. Hide no required failure and expose no hidden model reasoning.

### DSH Runs and custody

Show exact Run authorization, role, route identity without secrets, Assignment/worktree, budgets, process closure, cancellation, output/receipt state, and known custody gaps. DSH internal Session bytes remain opaque.

### Effects and Delivery

Show requested, authorized, executing, completed, failed, unknown, or recovery-required external effects with exact request, idempotency, expected provider head, and receipt. Local Change completion never appears contingent on later Delivery unless an explicit future policy says so.

### Recovery

Show one owner, exact affected refs/state, last verified checkpoint, available bounded action, expected heads, backup identity, and recovery receipt. Never retry protected effects speculatively.

## Interaction rules

- Read-only by default; shipping Console grants no authority.
- Resolve moving source selectors once and display explicit OIDs.
- Keep selection separate from authenticated authorization.
- Show exact subject, consequence, authority basis, expected heads, conflicts, external effects, and expected receipt before protected action.
- Disable unavailable actions with one stable reason.
- Refresh after event gap or generation change instead of guessing replay.
- Never infer activity, readiness, causality, acceptance, or completion from process existence or elapsed time.
- Sanitize terminal escapes and untrusted text.
- Exclude credentials, provider headers, raw DSH data, raw model output, hidden reasoning, private worktree content, and unauthorized Item existence.
- Work without color, pointer, animation, or large terminal; deterministic command output remains automation-friendly.

## Degraded operation

Console remains useful when AI providers, DSH, Plugins, external apps, or live Project Server are unavailable. It distinguishes last verified durable state, unverified filesystem observations, safe read-only diagnosis, stopped-server maintenance, and operations prohibited until authority/custody returns. Offline inspection never bypasses quiescence, authentication, expected-head comparison, backup, or recovery rules.
