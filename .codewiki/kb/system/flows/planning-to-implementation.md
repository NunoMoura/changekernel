---
type: System Flow
codewiki_id: cw:flow:planning-to-implementation
title: Planning to Implementation
description: Gates one Change-scoped Work Graph delta, applies it by CAS, and schedules ready Work Units without global replanning.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Planning to Implementation turns one ratified Change into accountable parallel realization.
---
# Planning to Implementation

Project Server runs the Planning Gate over one exact Change-scoped Planning Candidate and the resolved `.codewiki/check-packs/planning/**` snapshot. The Gate verifies complete ratified-Change coverage, one owning Change per Work Unit, independently judgeable outcomes, acyclic internal and cross-Change dependencies, ordering for overlapping scopes, declarative resource and custody requirements, and explicit aggregate Review obligations. Failure returns atomic feedback to that Change's Planning continuity; stopped execution preserves current state.

A passed Candidate remains only a proposed Work Graph delta. Project Server revalidates the ratified Change revision and observed global Work Graph digest, rejects mutation of unrelated accepted or active Work Units, and CAS-appends the new immutable units and edges. A stale graph triggers deterministic revalidation and, when relevant, another Planning attempt. No planning horizon, Sprint replacement, or rolling whole-project Planning epoch exists.

Project Server derives readiness exclusively from canonical Work Graph `2.0.0` and WorkState: a unit must be accepted, owned by a current non-withdrawn Change, free of active Claim or Assignment authority, and have completed dependencies. Planning Candidate `2.0.0` supplies explicit capability, tool, Skill, custody, consent, privacy, budget, and isolation requirements; it does not select workers or placement.

Project Server snapshots content-addressed Worker Offers and one content-addressed scheduling policy, then deterministically matches eligibility, validity, capacity, custody, consent, privacy, budget, and isolation. It atomically writes one exact Claim and one exact Assignment with one digest-bound isolated Workbench under WorkState, Work Graph, source-head, and policy compare-and-swap. Claim leases and all placement inputs remain Project Server state. Generic distributed mutation cannot acquire, release, or take over Work Unit Claims. On restart, accepted Claims and Assignments rebuild derived status and suppress duplicate admission; stale or unpaired operations fail closed. Runtime receives only the admitted Assignment or resulting Run Request and owns no queue, Worker Offer, Claim, Assignment, placement, policy, or canonical scheduling state. Independent ready Work Units may execute concurrently; dependency and overlap edges constrain admission.
