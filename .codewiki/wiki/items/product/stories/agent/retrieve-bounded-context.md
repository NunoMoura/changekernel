---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:agent.retrieve-bounded-context","codewiki_user":"cw:user:agent","description":"An agent wants one immutable authorized Run Context Bundle with bounded local queries and no live authority or hidden ambient state.","status":"stable","tags":["product","story","query"],"title":"Retrieve Bounded Context","type":"User Story"},"codewiki.legacy:source-path":"product/stories/agent/retrieve-bounded-context.md"},"itemId":"cw:story:agent.retrieve-bounded-context","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:2a1297f7c00e1bf4c62774de32db94f76212b6dfe1ed67af241488c9846752db","codewiki.legacy:source-path":"product/stories/agent/retrieve-bounded-context.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:agent.retrieve-bounded-context"}],"relationships":[],"title":"Retrieve Bounded Context"}
---
# Retrieve Bounded Context

As an Agent, I want exact relevant Wiki and Project context plus bounded on-demand queries so I can act safely without loading whole history, trusting stale conversation memory, or inventing missing facts.

## Acceptance signals

- Every CodeWiki-controlled DSH Run binds one exact project commit, managed Change tip when relevant, stage subject, role, authority, Change type, capabilities, and input digest.
- Project Server deterministically supplies mandatory target Wiki Items/Definitions from Change, Work Unit, relationships, and active Check selectors rather than dumping the whole Wiki.
- Role-specific read-only tools query exact Wiki Items, links, Dictionary View, history/diff, Alignment, Project state, Evidence, Results, and Change facts under bounded ordering, coverage, unknown, truncation, freshness, and receipt rules.
- A source selector resolves once to an explicit Git OID or Change tip; queries never silently follow moving `head` or mix snapshots.
- Project Server may materialize immutable local chunks/cache for one Run, but they are derived input/evidence, not a peer Run Context Bundle authority or cross-Run memory system.
- Changed semantic input, authority, role, route, tools, active Checks, Project/Change head, or feedback creates another DSH Run. DSH owns internal Session and compaction mechanics.
- Every model-visible input and Wiki query is receipt-bound. Direct filesystem access cannot widen scope or substitute path/title for stable Item identity.
- Decision may propose Wiki changes; Planning, Worker, Review, and Check roles cannot mutate accepted Wiki. Worker source writes remain isolated Work Unit scope.
- Gate itself freezes exact subject, Pack identities, type-conditioned active Checks, declared inputs, and digest. Check Runs receive only that Gate context, not producer memory or live mutation handles.
- Stage Checks verify output alignment with committed Wiki; mandatory tool-call theater is not treated as proof of understanding.
- Missing, stale, contradictory, or incomplete context becomes explicit stop/feedback rather than fabricated meaning.
