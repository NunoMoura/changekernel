---
type: System Component
codewiki_id: cw:component:knowledge
title: Knowledge
description: Owns stable semantic identity, accepted desired Knowledge State, deterministic transition materialization, OKF projections, and realization metadata.
status: stable
tags: [system, component]
codewiki_component: cw:component:knowledge
codewiki_source_patterns: ["src/knowledge/**"]
codewiki_test_patterns: ["tests/knowledge/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.maintain-intent
    rationale: Knowledge supplies the System responsibility required by this Story.
  - type: realizes
    target: cw:story:check-author.author-composable-checks
    rationale: Knowledge supplies exact OKF concepts, relationships, and realization metadata to repository-aware Checks.
---
# Knowledge

Knowledge is the authoritative current accepted desired state for Product, System, and Design meaning: active vocabulary, Users, User-owned Stories, visual design, topology, Components, Flows, contracts, and invariants. It answers what the project should mean and do. Source and tests establish realized behavior, Git establishes exact artifact history, Change explains accepted transitions, and Alignment compares desired and realized state without collapsing them.

The Knowledge kernel owns stable identity, accepted state, Effects, checkpoints, provenance, and deterministic projection boundaries. [Domains](domains.md) supply admitted meaning: the built-in Software Development Domain Plugin owns the current concept vocabulary, relationship rules, validation, context projection, and software realization semantics. Domain meaning is therefore an exact admitted Plugin contribution rather than a hard-coded claim that every governed domain uses Product/System/Design or Git. Domain source Providers may project versioned observations, but imported or model-suggested subjects and links remain non-authoritative Change Intake Material until exact policy admits their proposed Effects.

Every independently addressable Knowledge subject owns an immutable path-independent `codewiki_id` in the canonical `cw:<kind>:<stable-key>` namespace. A subject may declare `codewiki_facets`, a strict non-overlapping map from stable facet keys to current lossless structural locators, when one complete post-state can change independently. Subject ID plus facet key forms facet identity; locators affect only projection identity. Semantic IDs are not labels, paths, headings, aliases, locators, or content digests. Labels, aliases, and Markdown locations may change without changing identity. Retired IDs remain resolvable as tombstones and are never reused; splits, merges, replacement, and supersession are explicit semantic relationships rather than path inference.

Bootstrap establishes the initial accepted Knowledge State. Thereafter, only an authorized confirmed `approve` Decision may change accepted Knowledge. Its exact Change revision carries either an atomic set of Knowledge Effects or explicit unchanged-Knowledge references and rationale. Each Effect targets one semantic subject or facet, binds an expected prior digest or explicit expected absence, and uses only `set` with one complete post-state artifact or `retire`. `set` may create an absent target or replace an existing target; `retire` requires an existing target. A revision-authoring harness supplies irreducible semantic content once and may use snapshot-bound context handles; Project Server expands those handles before revision identity and derives Effect identity, canonical references, digests, affected projections, byte spans, and result identity. Effects contain no model-owned offsets, repeated current bytes, fuzzy search instructions, or ordered transform program.

At Candidate checkpoint, Project Server resolves the revision's expanded semantic IDs against the exact base, rejects duplicate targets and mismatched expected state or absence, and deterministically compiles the complete Effect set into a projected Knowledge State and any required structural Markdown or YAML edits. The immutable checkpoint binds the base Knowledge State, Effect set, compiler identity, application-plan digest, resulting Knowledge State, and resulting projection. Checks judge that exact projected result. Confirmation revalidates the unchanged checkpoint and applies the Knowledge transition atomically with its Change Trace and WorkState commitments. Rejected, deferred, or withdrawn Candidates never change Knowledge; semantic reversal requires another explicit Change. Direct or external bytes that disagree with accepted Knowledge are drift and enter Change Intake rather than silently redefining intent.

Knowledge State identity is separate from materialized projection identity. The state digest commits stable subjects, facets, relationships, and accepted content. A projection digest additionally commits the renderer and exact Markdown or YAML bytes. Renderer-only formatting changes therefore do not masquerade as semantic changes. Markdown with YAML frontmatter remains the portable agent-friendly OKF interchange and current-state checkpoint. Knowledge Fact Inventory Protocol `1.0.0` deterministically classifies every current semantic cell and projection file as durable seed, accepted semantic cell, deterministic `views/**` projection, or Git-derived realization, with complete coverage and exact digests. Compact durable intent remains canonical; repeated indexes, expanded dictionaries, overviews, dossiers, status logs, migration notes, and drift reports are deterministic or non-authoritative projections under `views/**`.

Knowledge exposes immutable bounded subject, facet, bundle, relationship, source-ownership, test-ownership, and context-handle facts for snapshot-bound consumers. Project Server materializes those facts into authorized Project Context Snapshots for producers and declared Gate Evaluation Package inputs for Checks. Queries retain exact Knowledge State and projection digests, stable IDs, source references, deterministic ordering, coverage, unknowns, truncation, cursor position, query-engine identity, and staleness. Consumers cannot mutate Knowledge, infer missing desired state, or treat generated narration, conversation summaries, execution scratch, source bytes, or model output as accepted truth.
