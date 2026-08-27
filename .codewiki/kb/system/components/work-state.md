---
type: System Component
codewiki_id: cw:component:work-state
title: WorkState
description: Projects deterministic coordination for guards, accepted Knowledge or native Git bindings, scheduling, stage context, and bounded reads.
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

WorkState is the deterministic current coordination projection of accepted Change operations and exact project facts (Git artifacts in Backend v1; canonical Git commit/tree plus external Plugin Receipts in target). It references current accepted Knowledge identity or target repository/canonical commit and derived Wiki tree without replacing Knowledge authority. Project Server derives the complete accepted Effect and invariant index from these exact revisions; the index is a digest-bound compatibility projection, not another canonical store. It exposes Backend-v1 Change revisions or target proposal commit OIDs and relationships, proposed/accepted Knowledge Effects or derived Git Item changes, accepted Change-scoped Planning deltas, the canonical global Work Graph and its digest, Work Unit dependency and derived `accepted | claimed | assigned | completed | blocked | retired` status, Claims, Assignments, Decision, Planning, Work Unit Implementation, aggregate Review attempts, Private Change Integration Lineage `1.0.0` reductions, frozen Implementation Aggregate `1.0.0` projections, Backend Review Attempt `5.0.0` or target `6.0.0` identities, typed Review failure ownership, guarded `delivery.applied` artifact projections, Evidence requirements, Check Results, Gate Reports, atomic feedback, stopped reasons, empty-stage warnings, and pending authority. Reconstructible blocker, semantic-target overlap, conflict, Gate-readiness, trace-board, work-graph, and execution-queue reductions live under `src/work-state/**`; they are current projection, not canonical history or Project Server authority.

Each stage view derives from one exact WorkState snapshot. Decision groups proposed Change, current Knowledge transition or target proposal commit/derived Item diff, and active-Change compatibility. Planning groups one ratified Change and its proposed Work Graph delta while retaining effect-to-requirement coverage. Implementation groups one Work Unit Candidate while preserving its owning Change, accepted Knowledge targets, requirements, and aggregate lineage status. Review groups one exact aggregate Change head and every contributing Work Unit, Candidate, effect, and requirement. This organization is a projection for Agents and Clients, not another workflow graph or source of truth.

WorkState supplies a derived coordination input to Run Context Bundles and Gate Evaluation Packages, plus deterministic scheduling and completion reductions. Canonical replay rebuilds it before each target bundle is materialized. Scheduling reduction binds content-addressed Worker Offers and policy to one atomic Claim and Assignment pair, records one isolated Workbench and lease, and derives status without moving Worker Offers, capacity, consent, privacy, custody, budget, queue jobs, or placement authority into Runtime. Session summaries may reference WorkState identity but cannot replace or amend it. Every consumer binds one exact projection digest with required Knowledge state or canonical/proposal Git commits, derived Wiki tree, active Changes, and project identities; stale projections cannot authorize canonical-ref advance, graph application, Assignment, Candidate admission, integration, progression, completion, or Delivery.

Semantic Kernel target references exact repository identity, canonical/proposal commits, managed-ref tip, derived Wiki Item diff, Completion Requirement, Plugin Receipt, and `change.completed` identities. Failed/stopped Gate keeps immutable Gate Report/Result in Change Trace while WorkState derives typed owner, affected Candidate, unresolved requirement/Work Unit IDs, route, and heads. Run Context Bundle `1.0.0` carries exact records or authorization-bound handles into one fresh Work Continuity Run/Session; its retained bytes are execution Evidence, not rollover authority. Rollover never clears feedback, satisfies a requirement, or converts operational stop into semantic failure; generated summaries remain navigation only.
