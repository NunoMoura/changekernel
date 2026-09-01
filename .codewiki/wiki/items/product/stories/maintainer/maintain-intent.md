---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.maintain-intent","codewiki_user":"cw:user:maintainer","description":"A maintainer wants accepted desired state captured and challenged before source changes commit the project to an implementation.","status":"stable","tags":["product","story","decision"],"title":"Maintain Intent","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/maintain-intent.md"},"itemId":"cw:story:maintainer.maintain-intent","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:80803921801c827da396658bdc918ba27abff3dd122b9d2a00710f46efc43a5f","codewiki.legacy:source-path":"product/stories/maintainer/maintain-intent.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.maintain-intent"}],"relationships":[],"title":"Maintain Intent"}
---
# Maintain Intent

As a maintainer, I want collaborators and Agents to commit shared meaning before implementation so accepted intent remains exact, attributable, queryable, and independently verifiable throughout realization.

## Acceptance signals

- Mutable conversation/drafts carry no authority. Authenticated `proposeChanges` creates one independently decidable Change with one append-only Trace, one managed ref, and full Project snapshots.
- Every proposal declares exactly one governed Change type and one `wiki-only | project` realization route. A fixed Decision Check validates alignment so classification cannot suppress policy.
- Wiki Item is the only first-class semantic unit. Stable Item IDs—not paths, titles, aliases, terms, Git OIDs, or models—establish identity.
- Definition and Claim Items are typed Wiki Items. Dictionary and proposed-tip overlays are derived Views; no separate Term/Dictionary/Claim store exists.
- Decision Agent receives exact relevant Wiki context and bounded snapshot-fixed tools. It may prepare proposal bytes but cannot authenticate itself, choose active Checks, or write refs.
- Project Server derives exact Wiki additions, edits, moves, retirements, relationships, and semantic diff from Git trees and validates complete closure before Gate.
- Decision Gate freezes exact Proposed Change tip, Pack policy, type-conditioned active Checks, inputs, resolver identity, and digest. Feedback revision advances expected Change tip and reruns affected Checks.
- Authenticated `commitChange` creates a two-parent Change Commit under expected-head CAS. Final committer owns accepted intent; earlier contributors, producing DSH Runs, Check executors, and mechanical committer remain attributable.
- A true Wiki-only Change completes in Change Commit. Project realization proceeds through Planning, checked Work Units, Review, and Completion Commit without restating Wiki meaning as authored requirements.
- Workers cannot mutate accepted Wiki. Meaning gaps return through Decision or a Superseding Change.
- Search/vector similarity retrieves possible Items only. Exact ID/commit/Trace facts establish identity and authority.
- Changed accepted meaning never overwrites history; correction is another accountable Change.
