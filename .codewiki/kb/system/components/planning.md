---
type: System Component
codewiki_id: cw:component:planning
title: Planning
description: Owns Change-scoped Work Graph deltas, Completion Requirement decomposition, Planning Candidate semantics, and attempt interpretation.
status: stable
tags: [system, component]
codewiki_component: cw:component:planning
codewiki_source_patterns: ["src/loops/planning/**"]
codewiki_test_patterns: ["tests/loops/planning/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Planning supplies the System responsibility required by this Story.
---
# Planning

Planning decomposes one accepted Change into one immutable Change-scoped Work Graph delta. Backend v1 Candidate maps Knowledge Effects and acceptance requirements; Semantic Kernel Candidate maps every frozen Change Completion Requirement to Work Units, internal/cross-Change dependency edges, technical and integration requirements, and explicit non-executable resolutions. It references accepted meaning rather than restating or amending it. It reads the accepted global Work Graph but never regenerates a project-wide plan or silently replaces unrelated accepted work. Project Server owns the canonical global graph as the union of accepted Change-scoped deltas.

Every Work Unit has exactly one owning Change and declares outcome, scope, covered current Effect or target Completion Requirement IDs, dependencies, required generic capabilities, tools, Skills, custody, consent, privacy class, budget class, and verification. Planning declares strategic parallelism and resource requirements; it never selects a person, Implementation Worker, machine, Run Process, delegated harness, AI Provider, live capacity, or schedule. Cross-Change reuse uses explicit dependency edges. Shared foundational work normally becomes its own Change rather than a multi-owned Work Unit.

Backend v1 Planning Gate validates Effect/acceptance coverage. Target SK4 removes that custom Gate: Kernel Validation requires exact Completion Requirement coverage, independently judgeable units, acyclic dependencies, explicit overlap order, cross-Change compatibility, declarative resources, budgets, and aggregate Review requirements. Planning Candidate carries exact requirement IDs/mappings, not prose copies. Backend v1 uses continuity key `planning:<change-id>` across bounded Runs; target Work Continuity retains that work key but starts a fresh physical Session after each terminal Receipt, rehydrating exact accepted requirements, proposed graph, validation feedback, unresolved coverage, Work Graph head, and predecessor Receipt. Same-Session resume is only same-Run crash recovery.

Skills may guide decomposition but cannot alter ratified meaning, choose placement, or affect authority. Backend v1 currently runs editable Planning Checks through the shared Gate. SK4 removes custom Planning Checks and the empty Planning Gate: mandatory coverage, dependency, overlap, budget, critical-path, and safe-parallelism rules become Kernel Validation with ordered objectives. Any discovery changing accepted Wiki meaning returns to Decision as a new Change with its own proposal commit and optional Wiki Item changes instead of becoming a Planning amendment.

A Planning Candidate is a proposed graph delta, not a new global plan. Backend v1 emits `planning.delta_accepted` only from an exact passed Gate Report. Target emits it only after fixed Kernel Validation succeeds over the exact Candidate and applies it only when accepted Change proposal commit, canonical commit, derived Wiki tree, WorkState, and observed Work Graph heads still match. Application uses expected-head compare-and-swap and deterministic graph reduction. Accepted deltas and Work Unit identities remain immutable; current unit status is derived separately. Changing, replacing, or superseding existing accepted work requires an explicit traced Planning amendment bound to the current Change delta. Only unclaimed accepted units may retire; claimed, assigned, blocked, or completed work is never silently rewritten. After successful application, Project Server reduces canonical Work Graph `2.0.0`, derives ready Work Units, and owns durable scheduling, Claims, Assignments, persistence, and placement. Runtime executes only exact admitted Runs.
