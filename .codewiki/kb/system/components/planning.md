---
type: System Component
codewiki_id: cw:component:planning
title: Planning
description: Owns Change-scoped Work Graph deltas, accepted-effect realization obligations, Planning Candidate semantics, and Planning attempt interpretation.
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

Planning decomposes one ratified Change into one immutable Change-scoped Work Graph delta. Its Candidate contains Work Units, internal and cross-Change dependency edges, exact acceptance-coverage mappings, accepted Knowledge Effect and stable-subject realization obligations, technical and integration requirements, and explicit non-executable resolutions. It references accepted meaning rather than restating or amending it. It reads the accepted global Work Graph but never regenerates a project-wide plan or silently replaces unrelated accepted work. Project Server owns the canonical global graph as the union of accepted Change-scoped deltas.

Every Work Unit has exactly one owning Change and declares outcome, scope, covered Effect and acceptance requirement IDs, dependency requirements, required capabilities, tools, Skills, custody, consent, privacy class, budget class, and verification. Planning declares strategic parallelism and resource requirements; it never selects a person, Implementation Worker, machine, Run Process, delegated harness, Model Provider, live capacity, or schedule. Cross-Change reuse uses explicit dependency edges. Shared foundational work normally becomes its own Change rather than a multi-owned Work Unit.

A Planning Gate validates exact coverage of every ratified semantic Effect, unchanged-Knowledge obligation, and acceptance requirement; right-sized independently judgeable units; an acyclic dependency graph; explicit ordering for overlapping scopes; cross-Change compatibility; declarative resources; and aggregate Review obligations. Planning Candidate `2.0.0` carries exact obligation IDs and mappings rather than prose acceptance copies. One Change-scoped Planning DSH Agent Session uses continuity key `planning:<change-id>` and may span several bounded Runs and material refreshes across Candidate feedback. Skills may guide decomposition but cannot alter ratified meaning, choose placement, or affect authority. Backend v1 currently runs editable Planning Checks through the shared Gate. SK4 removes custom Planning Checks and the empty Planning Gate: mandatory coverage, dependency, overlap, budget, critical-path, and safe-parallelism rules become Kernel Validation with ordered objectives. Any discovery that changes accepted Knowledge meaning returns to Decision instead of becoming a Planning amendment.

A passed Planning Candidate is a proposed graph delta, not a new global plan. Project Server emits `planning.delta_accepted` only from the exact passed Gate Report and applies it only when the ratified Change revision, accepted Knowledge State, WorkState, and observed Work Graph head still match. Application uses expected-head compare-and-swap and deterministic graph reduction. Accepted deltas and Work Unit identities remain immutable; current unit status is derived separately. Changing, replacing, or superseding existing accepted work requires an explicit traced Planning amendment bound to the current Change delta. Only unclaimed accepted units may retire; claimed, assigned, blocked, or completed work is never silently rewritten. After successful application, Project Server reduces canonical Work Graph `2.0.0`, derives ready Work Units, and owns durable scheduling, Claims, Assignments, persistence, and placement. Runtime executes only exact admitted Runs.
