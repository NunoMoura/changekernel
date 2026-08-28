---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.maintain-intent","codewiki_user":"cw:user:maintainer","description":"A maintainer wants accepted desired state captured and challenged before source changes commit the project to an implementation.","status":"stable","tags":["product","story","decision"],"title":"Maintain Intent","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/maintain-intent.md"},"itemId":"cw:story:maintainer.maintain-intent","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:80803921801c827da396658bdc918ba27abff3dd122b9d2a00710f46efc43a5f","codewiki.legacy:source-path":"product/stories/maintainer/maintain-intent.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.maintain-intent"}],"relationships":[],"title":"Maintain Intent"}
---
# Maintain Intent

As a maintainer, I want CodeWiki to preserve accepted intent as stable Git-versioned Wiki Items so project work realizes an understood target rather than transient conversation, mutable paths, or ungoverned diffs.

## Acceptance signals

- A Decision Candidate binds one exact proposal commit OID whose first-parent/tree derive the Wiki Item diff.
- Changed meaning targets immutable path-independent Wiki Item IDs through ordinary Item files; independently governed assertions are separate Items.
- Project Server validates the proposal commit and derives exact Item add/edit/move/retire before Checks; Gate judges that commit and tree.
- The default Decision policy checks for unresolved semantic contradiction against an exact complete accepted active Changes snapshot; overlap, dependency, supersession, duplication, and conflict remain distinct.
- Gate pass certifies only exact Candidate/proposal/tree and frozen inputs.
- An authenticated authorized maintainer confirms unchanged Candidate/Gate before Project Server creates one two-parent disposition commit and advances canonical ref by expected-old-OID CAS.
- Acceptance makes proposed Wiki bytes canonical before realization; rejection/defer/withdraw retains first-parent Wiki while preserving proposal ancestry.
- Planning, Work Units, Candidates, Evidence, Review, and Git lineage remain traceable to accepted proposal version, Item IDs, and frozen requirements and cannot rewrite them.
- Realization and delivery status derive from Change Trace, Alignment, Evidence, and exact Git commits rather than being written back into desired-state prose.
- Any Candidate edit requires a fresh Gate, and Implementation discoveries that change meaning route back to Decision.
- Native Git versions canonical bytes and supplies atomic ref CAS, but commit authorship/provider status never substitutes for Actor authority, Decision confirmation, Result, or completion.
