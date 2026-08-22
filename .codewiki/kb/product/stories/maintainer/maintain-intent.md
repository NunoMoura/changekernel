---
type: User Story
codewiki_id: cw:story:maintainer.maintain-intent
title: Maintain Intent
description: A maintainer wants accepted desired state captured and challenged before source changes commit the project to an implementation.
status: stable
codewiki_user: cw:user:maintainer
tags: [product, story, decision]
---
# Maintain Intent

As a maintainer, I want CodeWiki to preserve current accepted intent as stable desired Knowledge so source changes realize an understood target rather than transient conversation, mutable paths, or raw diffs.

## Acceptance signals

- A Decision Candidate binds one exact proposed transition from accepted Knowledge State to intended Knowledge State, or explicitly records unchanged-Knowledge references.
- Changed meaning targets immutable path-independent Knowledge subject or facet IDs and carries complete reducible post-state once rather than repeating current bytes or relying on model-owned offsets.
- Project Server deterministically resolves and compiles the Candidate before Checks, and the Gate judges the exact projected Knowledge result.
- The default Decision policy checks for unresolved semantic contradiction against an exact complete accepted active Changes snapshot; overlap, dependency, supersession, duplication, and conflict remain distinct.
- Gate pass certifies only that exact Candidate, compiled transition, and present inputs.
- An authenticated authorized maintainer separately confirms the unchanged passed Candidate and Gate digest before Project Server atomically accepts the semantic transition through expected-head compare-and-swap.
- Planning, Work Units, Implementation Candidates, tests, Evidence, Review, and Git lineage remain traceable to the accepted Knowledge Effects and requirements they realize.
- Any Candidate edit requires a fresh Gate, and Implementation discoveries that change meaning route back to Decision.
- Git commits preserve exact artifact states but never substitute for accepted intent, Decision confirmation, or a Project Server lifecycle transition.
