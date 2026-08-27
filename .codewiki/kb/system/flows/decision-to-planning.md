---
type: System Flow
codewiki_id: cw:flow:decision-to-planning
title: Decision to Planning
description: Accepts one exact proposal commit and derived Wiki change atomically, then transfers non-empty Completion Requirements into one Work Graph delta.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.maintain-intent
    rationale: Decision to Planning preserves accepted meaning and active-Change compatibility before decomposition.
---
# Decision to Planning

Project Server runs Decision Gate over exact proposal-commit Candidate and frozen Gate Evaluation Package. Active-Change compatibility accounts for every accepted nonterminal Change using changed/covered Wiki Item IDs, invariants, explicit relationships, requirement digests, and unknown semantics. Shared targets/invariants or unknown meaning trigger bounded expansion. Invariant is no unresolved semantic contradiction, not no overlap.

Failed Gate returns atomic feedback; stopped Gate preserves state. Passed Gate only makes exact Candidate eligible. Authorized Actor confirms unchanged Candidate/Gate against current WorkState, active-Change digest, canonical commit, and Wiki tree. Another accepted commit invalidates affected Results.

Target confirmation creates one disposition commit whose first parent is expected canonical and second parent is exact managed proposal tip. It appends acceptance Trace, uses validated proposed Wiki Item bytes, advances canonical ref by expected-old-OID CAS, and freezes requirements. Empty list completes only a non-empty-diff Change; only non-empty list advances to Planning.

Planning decomposes frozen requirements into immutable Work Graph delta containing singly owned Work Units, coverage, dependencies, resources, verification, and aggregate Review needs. Ambiguous intent, changed risk/authority, or Wiki meaning returns through a new Change with its own proposal version and Decision.
