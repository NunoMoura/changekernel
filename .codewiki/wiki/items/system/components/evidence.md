---
{"aliases":["Evidence Record","Raw Data Policy","Raw Data Source"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/kernel/evidence/**"],"testPatterns":["tests/kernel/evidence/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:evidence","codewiki_id":"cw:component:evidence","codewiki_relationships":[{"rationale":"Evidence supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}],"codewiki_source_patterns":["src/evidence/**"],"codewiki_test_patterns":["tests/evidence/**"],"description":"Defines immutable observation metadata, authority levels, obligations, provenance, and bounded format importers.","status":"stable","tags":["system","component"],"title":"Evidence","type":"System Component"},"codewiki.legacy:source-path":"system/components/evidence.md"},"itemId":"cw:component:evidence","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:bd1462af61f0ece1ba4cfd0c3972c5b44d2598aa2b60b7b3087f1b2c329ed649","codewiki.legacy:source-path":"system/components/evidence.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:evidence"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Evidence supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"}],"title":"Evidence"}
---
# Evidence

Evidence is information used to support or challenge a particular assertion, judgment, realization claim or effect outcome. The material and its evidential use differ: a test log is material; what it supports under tested conditions is a scoped relationship recorded in Wiki or Change. Not every source supports every claim, and derivative summaries do not supply independent corroboration.

## One information path

On-demand information includes prior Wiki knowledge and Change outcomes in native Git history, local observations, and material from optional external data connectors. It can be previously analyzed or not yet understood. Archive and Sources are not separate knowledge systems, and the logical information pool does not require another authoritative database.

Git remains foundational rather than a user-configured connector. Native historical reads reuse exact records already preserved there. External connectors optionally extend available inputs from users' databases, document systems or services; absence of connectors must not disable native history or the core Change loop. Shared retrieval does not erase these different architectural roles.

## Provenance, retention and access

Identify exact source/version/passage, origin, observed conditions, method or producer, scope and limitations. For retired knowledge, preserve former applicability and the Change/disposition explaining retirement. Historical acceptance and a new source's assertion carry different grounds; neither automatically establishes current truth or authority.

Preserve source material rather than overwriting it with synthesis. Corrections or new observations are distinguishable versions. Retention, authorized redaction/deletion and access restrictions apply to current and historical material. Large or sensitive data need not be copied into Project Git. A hash proves identity, not availability or truth; missing, stale, redacted or inaccessible material limits assurance explicitly.

## Retrieval and adoption

Bounded retrieval/RAG selects material for inquiry, with citations and declared omissions. Indexes, embeddings and extraction caches remain rebuildable, not replacements for original bytes. Discovery must not execute source instructions, broaden permissions or silently ingest private data.

A retrieved answer is an interpretation. [Change](change-trace.md) governs adoption, revision, retirement and re-adoption; [validation](checks.md) governs support and uncertainty. Accepted judgments are retained, not recreated by rerunning models. Execution receipts describe observed effects and custody, not authority; unknown outcomes require [reconciliation](../flows/recovery.md).
