---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:flow:recovery","codewiki_relationships":[{"rationale":"Recovery provides the stable cross-component behavior required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}],"description":"Reconstructs authority and execution continuity from canonical state, retained DSH Sessions, and durable evidence without trusting private memory.","status":"stable","tags":["system","flow"],"title":"Recovery","type":"System Flow"},"codewiki.legacy:source-path":"system/flows/recovery.md"},"itemId":"cw:flow:recovery","itemType":"codewiki.legacy:system-flow","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:fe8878d3c3ceb7a1acd2310ce9f2dc429acb4d270a5815764b51012faa021f90","codewiki.legacy:source-path":"system/flows/recovery.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:flow:recovery"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Recovery provides the stable cross-component behavior required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Recovery and Continuation"}
---
# Recovery and Continuation

Recovery reconciles exact retained state, judgments and live effects after interruption. Continuation gives a fresh person or Agent enough justified context to act without private conversational memory. Neither process recreates history by rerunning models, deployments or external effects.

## Durable semantic record

Wiki preserves accepted knowledge and grounds; Change preserves intent revisions, deliberation, plans, attempts, judgments and outcomes; Git preserves exact snapshots and ancestry. Retrieve the original states and recorded interpretations. A new model's explanation cannot substitute for a missing historical reason or receipt.

Reconstruct projections such as Work state and alignment from exact records. Caches, generated views, host UI statuses and private sessions are not additional semantic authority. A referenced artifact may be unavailable or redacted; report that limitation rather than invent its contents or assume support.

## Effect reconciliation

Distinguish authorization, launch, observed execution, retained result, attempted write and observed accepted state. Created Git objects do not prove a ref advanced; a lost response does not prove it did not. Inspect exact expected/observed identities before retrying a bounded write.

Private live custody includes processes, leases, credentials, sockets and tracking needed to stop or reconcile effects. Process-local memory alone cannot prove restart safety. Cancellation and quiescence require observation; unsupported, contradictory or missing custody stops unsafe replay. A worktree or validated receipt does not itself establish physical containment.

Do not replay a possibly completed external action to discover its result. Preserve success, failure and unknown outcomes honestly and request applicable human authority where safe automatic reconciliation cannot be established.

## Fresh-context acceptance

A fresh participant must recover what is known or adopted, why and under which assumptions, which alternatives were rejected, what evidence supports the current conclusion, which work is in flight, and what action is next permitted. Redaction, truncation, absent context and uncertainty stay explicit; omitted obligations cannot be treated as irrelevant.

Reassess when conditions change: retain conclusions whose reasons still hold, revisit dependent suitability when an assumption fails, and reconsider previously rejected options whose rejection conditions changed. Independent grounds may preserve a conclusion even when one support is lost. Historical acceptance is retained, not automatically endorsed today.

Existing repository adoption and supported state conversion must preserve original history and honest baseline assurance. Exact backup/mapping, collision checks, interrupted-transition recovery and applicable authority precede any live conversion; no fabricated genesis or dual authoritative store is a recovery shortcut.
