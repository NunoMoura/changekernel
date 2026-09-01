---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.recover-history","codewiki_user":"cw:user:maintainer","description":"A maintainer wants hot coordination state to remain compact while immutable accountable history stays recoverable and auditable.","status":"stable","tags":["product","story","recovery"],"title":"Recover History","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/recover-history.md"},"itemId":"cw:story:maintainer.recover-history","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:8f049ecac6a342f4281892f4c7b3b5625b08f0c199b627bf96b0985885006144","codewiki.legacy:source-path":"product/stories/maintainer/recover-history.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.recover-history"}],"relationships":[],"title":"Recover History"}
---
# Recover History

As a maintainer, I want accepted Wiki, Change, Work, Check, and completion history to remain exactly replayable while disposable coordination state stays cheap to rebuild.

## Acceptance signals

- Git commits, trees, blobs, refs, and append-only Change Trace retain exact accepted bytes, ancestry, lifecycle facts, Actors, Results, receipts, and OIDs.
- No lossy compaction, generated summary, cache, archive manifest, or model output replaces canonical Git/Trace history.
- WorkState, Work View, Alignment, Dictionary, search, backlinks, and attribution rebuild from exact owners after process loss or index deletion.
- Private DSH/provider evidence follows explicit retention, backup, redaction, and deletion policy without silently changing semantic history.
- Backup, restore, and rollback verify repository identity, complete object/private-state closure, expected generation, and digest-bound receipts before activation.
- Missing, corrupt, stale, or inaccessible material remains explicit unknown or stopped state; recovery never fabricates proposal, Result, integration, completion, or external effect.
- Correcting accepted meaning uses a Superseding Change. Operational ref repair may restore exact proven refs only inside a qualified recovery boundary.
