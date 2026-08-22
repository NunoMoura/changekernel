---
type: System Component
codewiki_id: cw:component:review
title: Review
description: Owns exact aggregate Change review, accepted-Knowledge realization proof, Review-stage context, and feedback handoff before guarded delivery.
status: stable
tags: [system, component]
codewiki_component: cw:component:review
codewiki_source_patterns: ["src/loops/review/**"]
codewiki_test_patterns: ["tests/loops/review/**", "tests/loops/contracts.test.mjs"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Review supplies the final repeatable stage between integrated realization and guarded delivery.
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Review applies project-owned delivery Checks to one exact aggregate Change lineage.
---
# Review

Review is the fourth semantic Stage Loop. It starts only after every required Work Unit for one Change has a current passing Implementation Gate, integrates successfully into the Change-owned private lineage, satisfies dependency closure, and covers every accepted Knowledge Effect and Planning obligation. Review assesses that exact immutable aggregate tree and head, normally correlated with one integrated pull request when a provider is configured. Pull requests are common review membranes, not required transports or authority.

Review Attempt `3.0.0` binds one ratified Change revision and Knowledge transition, resulting accepted Knowledge State and projection, accepted Planning delta IDs and Work Graph, every contributing Work Unit, Candidate, Implementation Gate Report, Evidence identity, and Result digest, the exact frozen aggregate and private integration lineage, target base, current Project Material Generation, Gate Evaluation Package and Review Check Pack snapshot, optional Review Pack Skill, producer Session and Run receipt, provider Check receipts, and admitted Review Evidence. The Review producer uses a fresh independent continuity scope and never reuses an Implementation Session. Code Checks inspect deterministic receipts and exact bytes without producer memory. Every Model Check uses its own fresh tool-free session. Human Review Submissions are optional Evidence unless project Checks require them.

The editable default Review Pack starts with six independent Checks for complete aggregate acceptance, cross-unit behavior, full build, integration behavior, provenance integrity, and scope discipline. Review proves what independent Work Unit Gates cannot: the complete aggregate realization of the ratified Change's Knowledge Effects and acceptance requirements, cross-unit interactions, full build and integration behavior, stable Knowledge-to-source/test traceability, scope discipline, provenance, and delivery readiness. Review does not mutate source or accepted Knowledge. Each failed Result receives one Project Server-owned typed ownership classification. Unit defects reopen only exact affected Work Unit IDs; decomposition defects require explicit Planning amendment; meaning defects require Decision. The failed route invalidates delivery authority for that aggregate. Checks and models report evidence-linked failure but never choose lifecycle authority. Any new aggregate head or accepted semantic target invalidates affected Review Results.

A passed Review Gate permits Project Server to apply `delivery.applied` only when the exact Review Attempt, Gate Report, aggregate, target base, Delivery Authority `1.0.0`, protected target ref, and current target head still match. Delivery uses target-head compare-and-swap and records the exact delivered commit and tree; a pass alone never mutates protected state. The resulting Git tree and commit provide exact realized bytes and lineage; they do not replace Knowledge as desired-state authority. A stopped Gate preserves state and exposes recovery. Out-of-scope findings become bounded Change Intake Material. Post-Gate Outcome Diagnostics may propose ordinary Changes to Skills, Checks, queries, context, routes, or configuration; they cannot mutate the reviewed head or reinterpret its Gate. Full automation comes from prior User-configured authority plus an exact passed Review Gate, never Agent identity or provider metadata.
