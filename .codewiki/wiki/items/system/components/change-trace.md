---
{"aliases":["Change Trace"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/kernel/changes/**"],"testPatterns":["tests/kernel/changes/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:change-trace","codewiki_id":"cw:component:change-trace","codewiki_relationships":[{"rationale":"Change Trace supplies the System responsibility required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}],"codewiki_source_patterns":["src/changes/trace/**","src/changes/command.ts","src/changes/completion-requirement.ts","src/changes/digest.ts","src/changes/git-lifecycle.ts","src/changes/normalize.ts","src/changes/records.ts","src/changes/schema.ts","src/changes/store.ts","src/changes/types.ts","src/changes/validation-view.ts"],"codewiki_test_patterns":["tests/changes/**"],"description":"Owns append-only Change proposal, derived Wiki change, judgment, completion, effect, replay, retirement, and archive history.","status":"stable","tags":["system","component"],"title":"Change Trace","type":"System Component"},"codewiki.legacy:source-path":"system/components/change-trace.md"},"itemId":"cw:component:change-trace","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:84d3c6c55f7cd03c165cfe6f628789568b0114350b3d8f1cb264bce1df91cb64","codewiki.legacy:source-path":"system/components/change-trace.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:change-trace"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Trace supplies the System responsibility required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Change"}
---
# Change

Change carries intentional evolution of project knowledge and its realization. It preserves motivation, desired effects, scope, assumptions, alternatives, tradeoffs, deliberation, plans, attempts, evidence, and outcome. Wiki consolidates adopted knowledge and links it to these grounds. Neither a separate State object nor a second independently maintained intent representation is required.

## Evolving inquiry

An initial proposal may be uncertain. Decision accepts a justified transition hypothesis, not a universal reachability proof. Planning, Implementation, and Review refine understanding while retaining the original intent and explicit revisions. Material changes to intent, scope, or authority revisit Decision. A repair within approved work need not become a new Change merely because it uses another tool or commit.

Classification follows actual semantic effects and selects applicable obligations. A Change may correct knowledge, revise a commitment, investigate uncertainty, or realize an outcome; these effects can coexist. An author-selected label cannot bypass a consequence evident in the proposed delta.

## Lifecycle and checkpoints

The four loops have [distinct evidence boundaries](../flows/change-lifecycle.md). A Change can span many commits and parallel work lines. Checkpointed, assessed, accepted, and realized are different claims. A useful intermediate discovery can be retained without declaring the original intent complete. Promotion of knowledge and disposition of remaining obligations require explicit scoped acceptance, not inference from a commit's existence.

An accepted commitment can establish a target before reality conforms. Its gap and responsible work stay visible. A rejected proposal may leave reusable knowledge; adopting that lesson does not mark the rejected intent realized. Supersession preserves the predecessor's reasons, unresolved obligations, and relationship to its successor rather than rewriting history.

## Durable history, not a third primitive

A Change Trace is the append-only lifecycle record of a Change, not another independently authored project ontology. Git binds retained records to exact snapshots and ancestry. Assessment records identify their baseline, candidate subject, relevant knowledge and evidence, authority, interpretation conditions, and outcome sufficiently to distinguish stale or substituted claims.

Use exact retained states and outcomes for reconstruction. An event cannot assert its own containing commit OID before that commit exists; bind such context through an explicit enclosing record or reference rather than a fabricated self-hash. Rewritten commits and merged candidates must not inherit assessments by label alone. Host discussions, PR statuses, or private sessions cannot be the only durable source of accepted reasons.

The external world is not replayed by Git. Historical judgments retain their recorded meaning even when support later fails. Observations and protected-effect outcomes must distinguish success, failure, and unknown state; missing receipts are not permission to re-execute an effect.
