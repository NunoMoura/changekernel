---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:flow:recovery","codewiki_relationships":[{"rationale":"Recovery provides the stable cross-component behavior required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}],"description":"Reconstructs authority and execution continuity from canonical state, retained DSH Sessions, and durable evidence without trusting private memory.","status":"stable","tags":["system","flow"],"title":"Recovery","type":"System Flow"},"codewiki.legacy:source-path":"system/flows/recovery.md"},"itemId":"cw:flow:recovery","itemType":"codewiki.legacy:system-flow","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:fe8878d3c3ceb7a1acd2310ce9f2dc429acb4d270a5815764b51012faa021f90","codewiki.legacy:source-path":"system/flows/recovery.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:flow:recovery"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Recovery provides the stable cross-component behavior required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Recovery and Continuation"}
---
# Recovery and Continuation

Recovery reconciles exact retained state, judgments and live effects. Continuation lets a fresh person or Agent act without private conversational memory. Both rely on native Git-backed records, not rerun models or effects.

## Current state and cold history

Restore exact Wiki and Change outcomes with their original grounds. Keep active guidance concise while exposing prior knowledge, intent revisions, rejected alternatives and retirement reasons through bounded native history queries. No external connector or separate archive database is required. Historical retrieval does not re-adopt a rule; a new interpretation is not its original judgment.

Retain required reachable objects and references across transport and history rewriting. Missing, redacted, stale or inaccessible material is an explicit limit, not an instruction to regenerate it. Caches and RAG indexes are rebuildable views, not surviving substitutes for lost bytes.

## Effect reconciliation

Distinguish authorization, launch, observed execution, retained result, attempted write and observed state. Created Git objects do not prove ref advancement; a lost reply does not prove no write occurred. Verify exact identities before retrying.

Reconcile private processes, leases, credentials and live tracking separately from semantic history. Process-local memory or a worktree does not prove custody. Cancellation/quiescence require observation; missing or contradictory custody blocks unsafe replay. Do not repeat a possibly completed external action merely to discover its outcome.

## Fresh-context boundary

A fresh participant must identify current knowledge, concise reasons and conditions, relevant historical grounds, uncertainty, in-flight work and next permitted action. Context eviction does not retire an obligation, and retrieval cannot silently promote information. Report consequential omissions rather than treating them as irrelevance.

Reassess failed assumptions and changed rejection conditions without discarding independent support or rewriting historical outcomes. [Change](../components/change-trace.md) governs explicit revisions. Existing-repository adoption needs honest baseline assurance; live conversion additionally needs exact mapping/backup, collision and interruption recovery, and applicable authority—not fictional genesis or dual stores.
