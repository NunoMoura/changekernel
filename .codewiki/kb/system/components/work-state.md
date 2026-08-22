---
type: System Component
codewiki_id: cw:component:work-state
title: WorkState
description: Projects deterministic current coordination state for Project Server guards, accepted Knowledge transition binding, scheduling, stage context, and bounded reads.
status: stable
tags: [system, component]
codewiki_component: cw:component:work-state
codewiki_source_patterns: ["src/work-state/**"]
codewiki_test_patterns: ["tests/work-state/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:agent.retrieve-bounded-context
    rationale: WorkState supplies current stage truth for bounded Agent context and deterministic rehydration.
---
# WorkState

WorkState is the deterministic current coordination projection of accepted Change operations and exact synchronized Git facts. It references the current accepted Knowledge State and projection identities without replacing Knowledge authority. Project Server derives the complete accepted Effect and invariant index from these exact revisions; the index is a digest-bound compatibility projection, not another canonical store. It exposes current Change revisions and relationships, proposed and accepted Knowledge Effect commitments, accepted Change-scoped Planning deltas, the canonical global Work Graph and its digest, Work Unit dependency and derived `accepted | claimed | assigned | completed | blocked | retired` status, Claims, Assignments, Decision, Planning, Work Unit Implementation, aggregate Review attempts, Private Change Integration Lineage `1.0.0` reductions, frozen Implementation Aggregate `1.0.0` projections, Review Attempt `4.0.0` identities, typed Review failure ownership, guarded `delivery.applied` commit and tree projections, Evidence obligations, Check Results, Gate Reports, atomic feedback, stopped reasons, empty-stage warnings, and pending authority. Reconstructible blocker, semantic-target overlap, conflict, Gate-readiness, trace-board, work-graph, and execution-queue reductions live under `src/work-state/**`; they are current projection, not canonical history or Project Server authority.

Each stage view derives from one exact WorkState snapshot. Decision groups the proposed Change, its exact Knowledge transition, compiled target identity, and accepted active Changes compatibility. Planning groups one ratified Change and its proposed Work Graph delta while retaining effect-to-requirement coverage. Implementation groups one Work Unit Candidate while preserving its owning Change, accepted Knowledge targets, requirements, and aggregate lineage status. Review groups one exact aggregate Change head and every contributing Work Unit, Candidate, effect, and requirement. This organization is a projection for Agents and Clients, not another workflow graph or source of truth.

WorkState supplies canonical inputs to Project Context Snapshots, Gate Evaluation Packages, deterministic DSH rehydration, scheduler readiness, and completion reducers. Scheduling reduction binds content-addressed Worker Offers and policy to one atomic Claim and Assignment pair, records one isolated Workbench and lease, and derives status without moving Worker Offers, capacity, consent, privacy, custody, budget, queue jobs, or placement authority into Runtime. Session summaries may reference WorkState identity but cannot replace or amend it. Every consumer binds one exact snapshot digest together with required Knowledge State, accepted active Changes, and repository identities; stale projections cannot authorize Knowledge application, graph application, Assignment, Candidate admission, integration, progression, or delivery.
