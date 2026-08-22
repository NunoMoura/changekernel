---
type: User Story
codewiki_id: cw:story:agent.retrieve-bounded-context
title: Retrieve Bounded Context
description: An agent wants a content-addressed local Project Context Snapshot that refreshes coherently without live authority or hidden ambient state.
status: stable
codewiki_user: cw:user:agent
tags: [product, story, query]
---
# Retrieve Bounded Context

As an agent, I want compact current-stage context and lazy exact local queries so I can act safely without loading raw project history, blocking on Project Server query round trips, trusting stale conversation memory, or inventing missing facts.

## Acceptance signals

- Project Server builds immutable content-addressed Project Context Snapshots from exact WorkState, Knowledge, Alignment, active Changes, accepted Work Graph, repository content, Evidence, Results, query-engine identity, coverage, and staleness.
- A snapshot is a reusable producer query substrate, not canonical state and not a Gate input package; unchanged content-addressed chunks may be reused.
- Producer Runs mount authorized snapshots read-only and query them locally through typed Knowledge, Alignment, project-state, repository, Evidence, Result, batch, and high-level change-delta services.
- Direct, batch, and admitted programmatic queries preserve deterministic ordering, snapshot and query-engine identity, source references, coverage, unknowns, truncation, cursor position, call and byte budgets, and exact ledger capture.
- A long-lived producer DSH Agent Session may move from snapshot C1 to C2 only at a controlled idle turn boundary. Every query remains bound to the snapshot it used; old snapshots remain reproducible while referenced.
- Producer context permits no ambient live-working-tree fallback, Project Server storage handle, unrestricted network, credentials, environment, or unlogged dynamic context.
- Candidate checkpoint freezes output. Project Server then builds a separate immutable Gate Evaluation Package containing only declared exact Candidate, repository, Change, WorkState, Knowledge, Alignment, Evidence, Result, Check Pack, configuration, and route inputs.
- Formal Model Checks are fresh, isolated, tool-free, and receive no producer Project Context Snapshot handle, query tools, Session, or memory.
- Every CodeWiki-controlled model-visible input and query is bound to Execution Ledger and Run Receipt; delegated routes identify context they cannot prove.
- Run Continuation binds promoted authority, canonical rehydration, Gate feedback, unresolved obligations, and predictive reserves. At safe resumed idle boundaries DSH replaces old model surface with a deterministic non-authoritative CodeWiki summary while preserving exact raw history; unavailable pressured reduction stops for rollover.
- The legacy immutable `StageContextBundle` and generic direct/batch tools remain isolated qualification evidence only; production producer Runs accept only authorized mounted Project Context Snapshots and typed local services.
