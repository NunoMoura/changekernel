---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.recover-history","codewiki_user":"cw:user:maintainer","description":"A maintainer wants hot coordination state to remain compact while immutable accountable history stays recoverable and auditable.","status":"stable","tags":["product","story","recovery"],"title":"Recover History","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/recover-history.md"},"itemId":"cw:story:maintainer.recover-history","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:8f049ecac6a342f4281892f4c7b3b5625b08f0c199b627bf96b0985885006144","codewiki.legacy:source-path":"product/stories/maintainer/recover-history.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.recover-history"}],"relationships":[],"title":"Recover History"}
---
# Recover History

As a maintainer, I want CodeWiki to archive completed operation history without losing replay and audit capability so active coordination remains compact.

## Acceptance signals

- Archive acceptance verifies exact immutable segment identity before hot removal.
- Hydration is read-only and digest-bound.
- Reopening creates a new accountable hot segment rather than altering archived history.
