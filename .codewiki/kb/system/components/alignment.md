---
type: System Component
codewiki_id: cw:component:alignment
title: Alignment
description: Projects snapshot-bound relationships among accepted semantic identity, realization, impact, provenance, and contribution routing without inventing authority.
status: stable
tags: [system, component]
codewiki_component: cw:component:alignment
codewiki_source_patterns: ["src/alignment/**"]
codewiki_test_patterns: ["tests/alignment/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.account-for-drift
    rationale: Alignment supplies bounded impact and provenance facts for accountable decisions.
  - type: realizes
    target: cw:story:check-author.author-composable-checks
    rationale: Alignment supplies the horizontal and vertical snapshot-bound facts required by repository-aware Checks.
---
# Alignment

Alignment is the condition where relevant accepted desired state and realized executable state are connected, bound to an active Change, or explicitly unknown. Knowledge State is authoritative for desired meaning; source, tests, and exact Git trees establish realized behavior and bytes. Alignment compares those categories and never treats either one as proof of the other.

Alignment Graph Projector `5.0.0` is a disposable snapshot-bound projection keyed by stable Knowledge subject and facet IDs. It connects every Knowledge Effect and acceptance requirement through accepted Planning obligations, Work Units, Work Unit Candidates, exact changed source and test paths, Evidence, Results, private integration receipts, trees, commits, frozen aggregate, Review, protected-ref delivery, and Git-derived realization. Vertical traversal can begin at one stable Knowledge subject or Effect and reach exact realized bytes without treating any edge as semantic proof. A Markdown path, source path, label, or renderer version may change while semantic identity remains stable. Renderer-only Knowledge projection changes therefore update artifact provenance without fabricating semantic drift. Graph projection, Knowledge augmentation, and bounded queries live under `src/alignment/**`; Change Trace supplies canonical transition and lineage inputs but does not own this disposable projection. Alignment cannot create canonical facts, infer causality, or grant authority.

Alignment publishes bounded read-only facts for Project Server-built Project Context Snapshots, frozen Gate Evaluation Packages, the Check SDK, and Client projections. Horizontal queries inspect one layer. Vertical queries traverse exact relationships from stable Knowledge identity through Change, requirements, Work Units, source ownership, tests, Evidence, Results, integrated Git state, and delivery. Every response identifies query and graph digests, Knowledge State and projection identities, immutable underlying snapshots, source references, deterministic ordering, provenance, coverage, unknowns, truncation, cursor position, query-engine identity, and staleness. Alignment is the shared projection owner; context snapshots and the Check SDK do not duplicate its graph. A Check may judge frozen returned facts, but Alignment itself never passes a Check or creates feedback.

Contribution Routing is a read-only Alignment projection over one exact Change revision, project responsibility rules, Actor Profiles, Authority Grants, active Claims, availability, and Worker Offers. It returns eligible reviewers, contributors, and Implementation Workers with exact match reasons, coverage, unknowns, and staleness. Profiles indicate likely fit; only Authority Grants permit decisions; Claims indicate current responsibility; immutable operations prove who acted.

Reviewer, contributor, Stage Producer, Implementation Worker, and machine allocation remain outside immutable Change meaning. Changing availability or responsibility therefore updates projections and Claims without creating a semantic Change revision. Initial routing suggests eligible participants and requires explicit Claims; automatic assignment remains opt-in future behavior.
