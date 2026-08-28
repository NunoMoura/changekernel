---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:check-author.author-composable-checks","codewiki_user":"cw:user:check-author","description":"A Check Author wants reusable read-only project intelligence and composition primitives that build into one deterministic Gate boundary.","status":"stable","tags":["product","story","checks","sdk"],"title":"Author Composable Checks","type":"User Story"},"codewiki.legacy:source-path":"product/stories/check-author/author-composable-checks.md"},"itemId":"cw:story:check-author.author-composable-checks","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:f919bd73495e458c91b4ad35d9c5b6f81f7d2cb797bdc02566d941d70b8f1f11","codewiki.legacy:source-path":"product/stories/check-author/author-composable-checks.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:check-author.author-composable-checks"}],"relationships":[],"title":"Author Composable Checks"}
---
# Author Composable Checks

As a Check Author, I want to compose repository-aware Checks from reusable Probes and Checks so I can validate both individual project layers and vertical alignment among Knowledge, code, tests, revisions, commits, and accepted work.

## Acceptance signals

- Author source, tests, fixtures, and dependencies remain in the author's package or repository; an installed project Check contains only `check.json` and one self-contained `CHECK.mjs`.
- The Check SDK supplies a Probe primitive for bounded package-bound facts and a Check primitive for binary or quantitative judgment; no separate Verification abstraction is required.
- Checks may import pure libraries, Probes, and Checks through ordinary source dependencies, and the build bundles that closure into one readable deterministic artifact.
- A top-level Check registered by `check.json` is the only Result, cache, retry, failure-code, feedback, and Gate boundary; composed Checks inherit its context, limits, and cancellation and create no independent platform Results.
- Read-only SDK queries cover OKF Knowledge, repository content, code, tests, local revisions, commits, exact pull-request Evidence, Change state, and Alignment Graph facts.
- Horizontal and vertical queries report exact package/commit identity, provenance, coverage, truncation, and staleness.
- SDK diagnostics retain bounded references from Knowledge through source, tests, commits, and accepted work.
- Check Authors can validate, bundle, test with fixtures, preview in an admitted sandbox, and replay historical Invocations without mutating active Packs or canonical project state.
- Missing input or execution capability stops the affected Gate without fabricating a failed semantic Result.
