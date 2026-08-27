---
type: System Component
codewiki_id: cw:component:alignment
title: Alignment
description: Projects source support, project satisfaction, impact, provenance, and contribution routing without inventing authority.
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
    rationale: Alignment supplies the horizontal and vertical exact-input facts required by repository-aware Checks.
---
# Alignment

Alignment connects relevant accepted meaning to source support, project artifacts, active Change requirements, and explicit unknowns. Knowledge/Wiki is authoritative for agreed meaning; Raw Data Revisions, exact project commits, Evidence, Results, and Delivery bindings establish observed facts. Alignment compares categories and never treats one as proof of another.

Decision may accept Wiki tree `K1` at a canonical Git commit while project reality remains `P0`. Alignment reports pending, partial, blocked, stale, or unknown support/satisfaction until exact Evidence proves compatible `P1`; it never delays Change acceptance to make heads look synchronized. Source support, current requirement satisfaction, Change completion, and Delivery are derived projections, not Wiki edits. New source Revision never rewrites historical Result or Completion Record; it may make support stale, block reuse, and open new Change Intake. The target Semantic Kernel extends the same lineage from exact Raw Data Revisions through Wiki Items to Git Project Artifacts, Evidence, and Delivery without making the graph canonical authority.

Alignment Graph Projector `5.0.0` is a disposable snapshot-bound projection keyed by stable Knowledge subject and facet IDs. It connects every Knowledge Effect and acceptance requirement through accepted Planning obligations, Work Units, Work Unit Candidates, exact changed source and test paths, Evidence, Results, private integration receipts, trees, commits, frozen aggregate, Review, protected-ref delivery, and Git-derived artifact satisfaction. Vertical traversal can begin at one stable Knowledge subject or Effect and reach exact observed bytes without treating any edge as semantic proof. A Markdown path, source path, label, or renderer version may change while semantic identity remains stable. Renderer-only Knowledge projection changes therefore update artifact provenance without fabricating semantic drift. Graph projection, Knowledge augmentation, and bounded queries live under `src/alignment/**`; Change Trace supplies canonical transition and lineage inputs but does not own this disposable projection. Alignment cannot create canonical facts, infer causality, or grant authority.

Alignment publishes bounded read-only facts for target Run Context Bundles, frozen Gate Evaluation Packages, the Check SDK, and Client projections. Horizontal queries inspect one layer. Vertical queries traverse exact relationships from stable Knowledge identity through Change, requirements, Work Units, source ownership, tests, Evidence, Results, integrated project state, and Delivery. Every response identifies query/graph digests, repository and canonical/proposal commits, derived fixed-path Wiki tree, immutable underlying inputs, source references, deterministic ordering, provenance, coverage, unknowns, truncation, cursor position, query-engine identity, and staleness. Alignment is the shared projection owner; producer context and the Check SDK do not duplicate its graph. A Check may judge frozen returned facts, but Alignment itself never passes a Check or creates feedback.

Contribution Routing is a read-only Alignment projection over one exact Change proposal version, project responsibility rules, Actor Profiles, Authority Grants, active Claims, availability, and Worker Offers. It returns eligible reviewers, contributors, and Implementation Workers with exact match reasons, coverage, unknowns, and staleness. Profiles indicate likely fit; only Authority Grants permit decisions; Claims indicate current responsibility; immutable operations prove who acted.

Reviewer, contributor, Stage Producer, Implementation Worker, and machine allocation remain outside immutable Change meaning. Changing availability or responsibility therefore updates projections and Claims without creating a new semantic Change proposal version. Initial routing suggests eligible participants and requires explicit Claims; automatic assignment remains opt-in future behavior.

Alignment Graph `6.0.0` has no canonical edge store. Inputs are Raw Data Source/Revision/Slice refs and source-observation Plugin Receipts, Wiki Item IDs at exact Git commits, Change proposal commit/Completion Requirement IDs, Git project artifacts, Evidence/Results, Plugin integration/Delivery Receipts, Actor/authority routing facts, and declared relationship rules. Projection binds projector and every source identity, coverage, unknowns, freshness, support state `current | stale | missing | revoked | contradicted`, and graph digest.

Dirty-set reduction starts from changed input IDs, retracts prior edges they produced, follows declared dependency indexes, recomputes affected components stably, and verifies full rebuild equality. Every Revision-bound provenance ref is automatically trackable. An admitted observation may produce a new immutable Revision or no-change Plugin Receipt; ongoing connection mechanics remain external. Identical slices may gain revalidation Evidence; changed, missing, expired, revoked, or inaccessible material stales support and invalidates affected context/Result reuse. Project policy may open Change Intake, but neither Alignment, an external connection, nor source Plugin mutates Wiki. Model-suggested relations remain Candidate material; Alignment never invents cause or authority.
