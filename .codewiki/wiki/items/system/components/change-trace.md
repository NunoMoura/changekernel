---
{"aliases":["Change Trace"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/kernel/changes/**"],"testPatterns":["tests/kernel/changes/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:change-trace","codewiki_id":"cw:component:change-trace","codewiki_relationships":[{"rationale":"Change Trace supplies the System responsibility required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}],"codewiki_source_patterns":["src/changes/trace/**","src/changes/command.ts","src/changes/completion-requirement.ts","src/changes/digest.ts","src/changes/git-lifecycle.ts","src/changes/normalize.ts","src/changes/records.ts","src/changes/schema.ts","src/changes/store.ts","src/changes/types.ts","src/changes/validation-view.ts"],"codewiki_test_patterns":["tests/changes/**"],"description":"Owns append-only Change proposal, derived Wiki change, judgment, completion, effect, replay, retirement, and archive history.","status":"stable","tags":["system","component"],"title":"Change Trace","type":"System Component"},"codewiki.legacy:source-path":"system/components/change-trace.md"},"itemId":"cw:component:change-trace","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:84d3c6c55f7cd03c165cfe6f628789568b0114350b3d8f1cb264bce1df91cb64","codewiki.legacy:source-path":"system/components/change-trace.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:change-trace"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Trace supplies the System responsibility required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Change"}
---
# Change

Change is the governed creation and evolution point for accepted Wiki knowledge. It preserves intent, desired effects, motivation, scope, relevant assumptions, alternatives, tradeoffs, deliberation, plans, attempts, evidence and outcomes. [Wiki](wiki.md) records the resulting current accepted meaning, with adopted consequences linked to their grounds. No separate State, Archive or Sources authoring primitive is required.

## From intent to structured knowledge

A Change turns intent and relevant source material into explicit Project-specific consequences in natural language before and during realization. It can consolidate several sources, revise existing Items, introduce useful new Items or document types, or conclude that no knowledge change is warranted. Preserve the original input and make the actual proposed transformation attributable; do not repeatedly summarize prior summaries while discarding their grounds or uncertainty.

Direct human authoring and agent-generated drafts enter the same assessment and acceptance path. Already adequate content need not be rewritten merely to demonstrate synthesis. Missing intent, conflicting sources or unavailable assessment may leave a proposal unresolved. Assess the actual resulting candidate against the relevant baseline; an earlier draft's approval does not transfer automatically to changed bytes.

The agent runtime owns sessions, transcripts, compaction and temporary working context. Change retains relevant attributable rationale and evidence, not a transcript mirror or a requirement to retain private model reasoning. The accepted Wiki outcome must remain understandable without replaying a conversation. Introducing a reusable type is itself governed knowledge work, not permission for that type to waive existing acceptance obligations.

## Adoption and retirement

An introduced Change proposes a transition. Only an authorized, accepted scoped transition promotes information into Wiki knowledge, revises or retires knowledge, or adopts it again. This can concern a passage or commitment rather than an entire file. Preserve the exact prior/resulting subjects, reasons and disposition so native Git history can later explain what applied and why it changed.

Knowledge-to-Change lineage is many-to-many: one Change can establish or revise several Items, and an Item or passage can have several creating/adopting, revising and superseding/retiring Changes. Cleanup must keep that relationship recoverable when old content leaves the active Wiki. Stale support prompts reassessment rather than silent retirement; preserve still-applicable obligations and the distinction between uncertainty, contradiction and supersession.

Retrieval, indexing, context packing and authorized observation are not semantic promotion. A useful RAG answer remains an interpretation until adopted through a Change. Retired knowledge is available as information, not automatically current policy. An ordinary file move, deletion or commit cannot fabricate acceptance of a retirement.

## Evolving inquiry

The [four loops](../flows/change-lifecycle.md) preserve the original intent while developing credible paths and evidence. Material changes to intent, scope or authority explicitly revisit Decision. Repairs within accepted scope need not create a new Change for every command or checkpoint.

Classification follows actual semantic effects, which may combine knowledge correction, investigation, commitment revision and realization. Author-selected labels cannot remove applicable obligations. Shared and rejected alternatives remain attributable rather than being overwritten to fit produced work.

## Outcomes and exact history

A Change can span many commits and parallel work lines. Checkpointed, assessed, accepted and realized are distinct. Intermediate knowledge adoption does not imply the whole intent is complete. A normative target can be adopted while its realization gap remains visible; an adopted lesson from rejected work does not realize its original goal.

Git natively preserves Change records and exact Wiki outcomes. A Change Trace is append-only lifecycle history, not a competing knowledge system. Records bind baseline, candidate, relevant evidence, authority and interpretation conditions. Host UI data or private sessions cannot be the only surviving grounds.

Reconstruct exact retained states and recorded judgments, never rerun models or external effects to recreate them. A record cannot assert its own enclosing commit OID before it exists. Rewritten or joined subjects must not inherit assessments by label alone; transport and retention must preserve references needed for recovery. Historical acceptance remains evidence about its recorded context, not present-day endorsement.
