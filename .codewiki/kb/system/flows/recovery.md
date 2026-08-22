---
type: System Flow
codewiki_id: cw:flow:recovery
title: Recovery
description: Reconstructs authority and execution continuity from canonical state, retained DSH Sessions, and durable evidence without trusting private memory.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.recover-history
    rationale: Recovery provides the stable cross-component behavior required by this Story.
---
# Recovery

Project Server reloads accepted Change Trace, accepted active Changes, accepted Change-scoped Work Graph deltas, synchronized Git facts, private integration lineages, configuration, current Pack Skill and Check files, jobs, Claims, Assignments, Workbenches, custody-scoped Run Receipts and Ledgers, retained DSH Agent Sessions, Gate receipts, and guarded effects. It deterministically rebuilds WorkState and Alignment and reconciles interrupted producers, workers, integration, Review, Checks, and effects by exact identity. Missing evidence never fabricates a Result, integration, completion, transition, or effect.

A logical producer continuity may resume its retained DSH Agent Session only under an exclusive Project Server lease and expected Session-head compare-and-swap. Project Server recovers Session Continuity `1.0.0`, rejects stale writers, and advances the head only from the lease-bound Receipt. Exact resume requires the retained Build, protocol, plugin closure, route, prompts, Skills, tools, snapshots, ledger, budgets, isolation, and custody. DSH Goal activation is process-local: Project Server authorizes one round per Run, Candidate output pauses it, and no model tool can complete it. Process lifetime does not define Session lifetime.

A Runtime Build or protocol change, corruption, repeated summary drift, role change, unrecoverable compaction lock, or qualified quality decline forces Session rollover. Project Server starts a fresh Session and injects deterministic canonical rehydration from current Change, Work Graph, Work Unit or aggregate lineage, Gate feedback, snapshot identity, and unresolved obligations. It never treats delegated-product memory, a conversation summary, persistent code heap, or ambient file as canonical truth.

DSH owns compaction event mechanics and retains exact raw history. Run Continuation `1.0.0` binds authority promotion, canonical rehydration, obligations, feedback, and predictive reserves. At resumed idle boundaries CodeWiki supplies deterministic Compaction Summary `1.0.0` projections and records exact replacement provenance; unavailable pressured reduction stops for rollover. It never compacts during open work or before Candidate freezing. Checkpoints are model-surface projections, not recovery prerequisites.

Completed pass/fail Results remain reusable only when Candidate, Check, configuration, selected package input, Evidence, and execution identities match. Interrupted or stale Check Runs produce no Result and may receive one bounded fresh retry when eligible. Every Model Check retry uses a fresh isolated session. Exhausted retry, unavailable capability, contradictory receipt, incomplete material, or unverifiable effect becomes visible stopped state.
