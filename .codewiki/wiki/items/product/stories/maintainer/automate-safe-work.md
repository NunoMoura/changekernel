---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.automate-safe-work","codewiki_user":"cw:user:maintainer","description":"A maintainer wants compatible work to continue across Clients while authority, provenance, Checks, Evidence, and effect boundaries remain explicit.","status":"stable","tags":["product","story","automation"],"title":"Automate Safe Work","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/automate-safe-work.md"},"itemId":"cw:story:maintainer.automate-safe-work","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:d56f82084cf355ecd812cd442c6ed1b88529b9670d69fe29994d5634dea4f4a8","codewiki.legacy:source-path":"product/stories/maintainer/automate-safe-work.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.automate-safe-work"}],"relationships":[],"title":"Automate Safe Work"}
---
# Automate Safe Work

As a maintainer, I want CodeWiki to carry one accepted Change from shared intent through checked realization without granting Agents silent authority or losing exact recovery state.

## Acceptance signals

- User and Decision Agent may explore mutable drafts, but only authenticated `proposeChanges` creates a full-snapshot Proposed Change on one managed ref.
- Project Server validates exact Git/Wiki/Trace closure, Change type and realization route, authority, and expected heads before any Gate or ref update.
- Decision, Planning, Implementation, and Review retain separate project-owned Check Packs. Gate active Checks derive deterministically from stage, required Change type, Work Unit subtype/scope where relevant, and exact subject facts.
- Gate passage grants eligibility only. Authenticated commands plus current expected-head/tip compare-and-swap create Change Commit, Work integration, Completion Commit, or protected effects.
- A true Wiki-only Change completes in Change Commit. A project-realization Change proceeds through a checked plan, isolated Work Units, full-snapshot result commits, integrated Change-ref ancestry, and Review.
- Planning facts live in Change Trace; global Work View and WorkState are derived. Git ancestry plus Trace replaces a second integration-lineage authority.
- Every CodeWiki Agent executes through an exact DSH Run with mandatory relevant Wiki context, bounded tools/capabilities, role separation, and a receipt. DSH owns internal Sessions and execution mechanics.
- Workers cannot mutate Wiki, Trace, managed refs, authority, or lifecycle. Meaning defects return to Decision or a Superseding Change.
- Failed Results route bounded feedback; operational missing material stops without fabricated Result. Recovery rebuilds from Git, Trace, Gates, Results, Work facts, and verified receipts.
- Delivery remains separately authorized after local completion. Network or provider success never redefines accepted local state.
