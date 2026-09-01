---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:check-author.author-composable-checks","codewiki_user":"cw:user:check-author","description":"A Check Author wants reusable read-only project intelligence and composition primitives that build into one deterministic Gate boundary.","status":"stable","tags":["product","story","checks","sdk"],"title":"Author Composable Checks","type":"User Story"},"codewiki.legacy:source-path":"product/stories/check-author/author-composable-checks.md"},"itemId":"cw:story:check-author.author-composable-checks","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:f919bd73495e458c91b4ad35d9c5b6f81f7d2cb797bdc02566d941d70b8f1f11","codewiki.legacy:source-path":"product/stories/check-author/author-composable-checks.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:check-author.author-composable-checks"}],"relationships":[],"title":"Author Composable Checks"}
---
# Author Composable Checks

As a Check Author, I want to compose repository-aware Checks from reusable pure libraries and bounded queries so one registered Check can judge horizontal project facts or vertical alignment without creating another policy engine.

## Acceptance signals

- Author source, tests, fixtures, and dependencies remain in the author's package/repository; an installed Check contains `check.json` plus one self-contained `CHECK.mjs` or `CHECK.md`.
- `check.json` declares one atomic requirement, bounded inputs, implementation kind, limits, measurement, stable failure/remediation contract, and optional positive applicability allowlists.
- Gate active selection supports only deterministic conjunction across declared stage subject fields such as Change type, realization, Work Unit subtype, and exact subject facts; arbitrary expressions and proposal-controlled selection are rejected.
- Libraries and helper probes may compose internally, but only registered top-level Check receives one Check Run, cache identity, retry policy, and at most one Result.
- SDK queries cover exact Wiki Items/Definitions, Git/project content, Trace, Change, Work, Evidence, Results, and Alignment with source identity, authorization, coverage, ordering, truncation, freshness, and unknowns.
- Code Checks execute in admitted deterministic sandboxes; Model Checks execute through isolated DSH Runs with no producer memory or mutation capability.
- Missing input or execution capability stops the affected Gate without fabricating semantic failure.
- Authors can validate, bundle, fixture-test, sandbox-preview, and replay historical Runs without mutating active Packs or canonical Project state.
