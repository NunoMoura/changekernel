---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:flow:change-lifecycle","codewiki_relationships":[{"rationale":"Change Lifecycle preserves accepted meaning from intake through verified completion.","target":"cw:story:maintainer.maintain-intent","type":"realizes"},{"rationale":"Change Lifecycle advances exact state through Gate-controlled stages.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}],"description":"Carries one Git-backed Change proposal through Decision acceptance, conditional work, completion, and guarded Delivery.","status":"stable","tags":["system","flow"],"title":"Change Lifecycle","type":"System Flow"},"codewiki.legacy:source-path":"system/flows/change-lifecycle.md"},"itemId":"cw:flow:change-lifecycle","itemType":"codewiki.legacy:system-flow","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:e7a8556fdc48492d58e44e7417f82cf8b45edd4d1a4daaffafd341cf88cf7904","codewiki.legacy:source-path":"system/flows/change-lifecycle.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:flow:change-lifecycle"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Lifecycle preserves accepted meaning from intake through verified completion.","target":"cw:story:maintainer.maintain-intent","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Lifecycle advances exact state through Gate-controlled stages.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.automate-safe-work"}],"title":"Change Lifecycle"}
---
# Change Lifecycle

Change carries intentional evolution through four inquiry loops for knowledge, operations, research and software. Its actual effects determine obligations; an author-selected category cannot bypass them.

| Loop | Question and boundary |
| --- | --- |
| Decision | Are intent, scope, tradeoffs and authority justified with credible feasibility, not a completed reachability proof? |
| Planning | Which paths, intermediate outcomes, dependencies and shared obligations make execution credible and safe to parallelize? |
| Implementation | Which exact authorized attempts, partial outcomes and discoveries occurred? |
| Review | Does the actual recomposed candidate preserve intent, support realization claims and account for remaining obligations? |

Only accepted scoped transitions promote, revise, retire or re-adopt Wiki knowledge. Proposing a Change, retrieving information or saving a checkpoint does not perform acceptance. Partial knowledge adoption is distinct from completion of the whole intent. Branches and commits organize work, not stage flags or a mandatory four-commit protocol.

Feedback returns to Implementation for defects, Planning for path conflicts and Decision for material intent revision. Preserve original reasons and explicit target changes. An adopted lesson from rejected work does not realize the original goal.

Apply [semantic validation](../components/checks.md) at the actual joined subject; isolated successes do not establish composition. Git retains exact outcomes and retired knowledge for native cold retrieval. Protected effects need prior authority and remain distinct from acceptance.

See [Decision to Planning](decision-to-planning.md), [Planning to Implementation](planning-to-implementation.md), [Implementation to Review](implementation-to-review.md), and [recovery](recovery.md).
