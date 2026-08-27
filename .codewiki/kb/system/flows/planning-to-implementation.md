---
type: System Flow
codewiki_id: cw:flow:planning-to-implementation
title: Planning to Implementation
description: Kernel-validates one Change-scoped Work Graph delta, applies it by CAS, and schedules ready Work Units without global replanning.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Planning to Implementation turns one accepted Change into accountable parallel work.
---
# Planning to Implementation

Backend v1 runs Planning Gate over Candidate and Planning Pack. Target SK4 deletes custom Planning Checks/Gate: fixed Kernel Validation verifies complete Completion Requirement coverage, one owning Change per Work Unit, judgeable outcomes, acyclic dependencies, overlap ordering, bounded resources/custody, budgets, and aggregate Review requirements. Failure returns atomic feedback to Change Work Continuity; operational stop preserves state.

A passed Candidate remains only a proposed Work Graph delta. Project Server revalidates accepted Change proposal commit, canonical commit, derived Wiki tree, frozen requirement coverage, and observed Work Graph digest, rejects mutation of unrelated accepted or active Work Units, and CAS-appends the new immutable units and edges. A stale graph triggers deterministic revalidation and, when relevant, another Planning attempt. No planning horizon, Sprint replacement, or rolling whole-project Planning epoch exists.

Project Server derives readiness exclusively from canonical Work Graph `2.0.0` and WorkState: a unit must be accepted, owned by a current non-withdrawn Change, free of active Claim or Assignment authority, and have completed dependencies. Planning Candidate supplies explicit generic capabilities, tools, Skills, custody, consent, privacy, budgets, isolation, and requirement mappings; it selects no Worker, provider, CodeWiki Plugin, or placement.

Project Server snapshots content-addressed Worker Offers and one content-addressed scheduling policy, then deterministically matches eligibility, validity, capacity, custody, consent, privacy, budget, and isolation. It atomically writes exact Claim/Assignment and digest-bound isolated Workbench under WorkState, Work Graph, project-head, and policy CAS. Target may request `workspace.prepare` from one admitted CodeWiki Plugin, but Project Server retains Workbench custody and only verified Receipt enters state. Claim leases and all placement inputs remain Project Server state. Generic distributed mutation cannot acquire, release, or take over Work Unit Claims. On restart, accepted Claims and Assignments rebuild derived status and suppress duplicate admission; stale or unpaired operations fail closed. Runtime receives only the admitted Assignment or resulting Run Request and owns no queue, Worker Offer, Claim, Assignment, placement, policy, or canonical scheduling state. Independent ready Work Units may execute concurrently; dependency and overlap edges constrain admission.
