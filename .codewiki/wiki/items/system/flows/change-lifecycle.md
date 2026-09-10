---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:flow:change-lifecycle","codewiki_relationships":[{"rationale":"Change Lifecycle preserves accepted meaning from intake through verified completion.","target":"cw:story:maintainer.maintain-intent","type":"realizes"},{"rationale":"Change Lifecycle advances exact state through Gate-controlled stages.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}],"description":"Carries one Git-backed Change proposal through Decision acceptance, conditional work, completion, and guarded Delivery.","status":"stable","tags":["system","flow"],"title":"Change Lifecycle","type":"System Flow"},"codewiki.legacy:source-path":"system/flows/change-lifecycle.md"},"itemId":"cw:flow:change-lifecycle","itemType":"codewiki.legacy:system-flow","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:e7a8556fdc48492d58e44e7417f82cf8b45edd4d1a4daaffafd341cf88cf7904","codewiki.legacy:source-path":"system/flows/change-lifecycle.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:flow:change-lifecycle"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Lifecycle preserves accepted meaning from intake through verified completion.","target":"cw:story:maintainer.maintain-intent","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Lifecycle advances exact state through Gate-controlled stages.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.automate-safe-work"}],"title":"Change Lifecycle"}
---
# Change Lifecycle

One Change preserves intent and its evolution through four inquiry loops. The same semantic foundation applies to knowledge, operations, research and software; evidence and execution methods depend on actual effects rather than an author-selected bypass category.

| Loop | Question and boundary |
| --- | --- |
| Decision | Is the intent, scope, tradeoff and transition hypothesis justified, authorized and credibly feasible? This is not a completed reachability proof. |
| Planning | Which paths, intermediate outcomes, dependencies and shared obligations make execution credible and safe to parallelize? |
| Implementation | What exact authorized attempts, partial outcomes and discoveries occurred? |
| Review | Does the recomposed candidate preserve intent, support its realization claims and account for remaining obligations? |

The loops are not mandatory branches or exactly four commits. WIP checkpoints remain cheap; selected assessments bind their actual baseline and candidate. Checkpointed, assessed, accepted, realized, published and deployed are distinct. Explicit scoped knowledge adoption or intermediate progress must not imply the original intent is complete.

Feedback returns to its cause: implementation defect, planning conflict, or unclear/materially revised intent. Preserve explicit intent revisions and the original grounds. An investigation can yield valuable knowledge even if an implementation is rejected; adopting a lesson does not retroactively realize a rejected goal.

Semantic validation distinguishes intent fit, consistency, reachability, preservation, justification and authority. Supported, contradicted and unresolved findings preserve scope and evidence. Binding obligations cannot be excluded by relabeling a Change, proposing a waiver, or hiding relevant corpus material.

Parallel work is evaluated again at its actual join. Historical checkpoints and judgments remain reconstructible from retained states and outcomes, not rerun models or effects. Protected actions need applicable authority before execution; acceptance does not grant publication or deployment.

See [Decision to Planning](decision-to-planning.md), [Planning to Implementation](planning-to-implementation.md), [Implementation to Review](implementation-to-review.md), and [recovery](recovery.md).
