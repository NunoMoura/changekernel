---
{"aliases":["Knowledge"],"attributes":{"codewiki.component:ownership":{"generatedViews":["dictionary","wiki-attribution","wiki-graph","wiki-history","wiki-search","wiki-semantic-diff"],"sourcePatterns":["src/kernel/wiki/**"],"testPatterns":["tests/kernel/wiki/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:knowledge","codewiki_id":"cw:component:knowledge","codewiki_relationships":[{"rationale":"Knowledge supplies the System responsibility required by this Story.","target":"cw:story:maintainer.maintain-intent","type":"realizes"},{"rationale":"Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}],"codewiki_source_patterns":["src/knowledge/**"],"codewiki_test_patterns":["tests/knowledge/**"],"description":"Owns Backend-v1 Knowledge and target Git-versioned Wiki Item identity, accepted meaning, relationships, and provenance.","status":"stable","tags":["system","component"],"title":"Knowledge","type":"System Component"},"codewiki.legacy:source-path":"system/components/knowledge.md"},"itemId":"cw:component:knowledge","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:22f19eb1fcbb39f3f912abba6df80f0ee8acaa5d61695044d5f1c20baab7de57","codewiki.legacy:source-path":"system/components/knowledge.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:knowledge"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Knowledge supplies the System responsibility required by this Story.","target":"cw:story:maintainer.maintain-intent","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:check-author.author-composable-checks"}],"title":"Wiki"}
---
# Wiki

Wiki is consolidated project knowledge at an exact revision. It includes scoped assertions, adopted decisions, obligations, procedures, rationale, support, and uncertainty. Change owns pending intent and the deliberation that produces revisions; Wiki preserves adopted consequences and enough provenance to reconsider them responsibly. A Wiki state is a revision of this knowledge, not a separate State entity.

## Implicit corpus, explicit distinctions

Tracked Markdown is eligible wherever it lives: README files, documentation, notes, and other project paths. No special directory, mandatory document ID, or proprietary frontmatter is required for authorship. A committed tree defines an exact historical corpus. Working edits and new files can contribute proposed knowledge without silently entering the index, becoming accepted, or being uploaded.

Corpus membership does not establish truth or governing force. Current commitments, pending Change records, quotations, fixtures, historical decisions, hypotheses, and observations retain different roles. One file may contain passages with different scope and authority. Ambiguous role or relevant missing context remains an explicit uncertainty rather than silently becoming active policy or being ignored.

Git ignore rules concern intentionally untracked files; they do not remove tracked files from a historical corpus. Repository/vault scope and disclosure permissions remain explicit. Discovery must not follow links, symlinks, submodules, editor configuration, or attachments into unrelated private material without declared scope and authority. Machine-local configuration cannot silently redefine accepted historical policy.

## Knowledge worth preserving

Consequential knowledge should make clear what is asserted or adopted, where it applies, why it was accepted, its support and assumptions, alternatives considered, and conditions for reconsideration. These are useful questions, not mandatory metadata fields on every paragraph. Preserve concise attributable rationale, not a transcript or invented historical explanation.

Support/dependency relationships have different meaning from topical links. If an assumption fails, reassess affected conclusions while preserving independent support. A rejected alternative can become appropriate under changed conditions. Historical acceptance remains recoverable without implying present-day endorsement. An unresolved disagreement must not be flattened into artificial consensus.

Accepted normative commitments are not observations of reality. An owned realization gap is accountable but not realized. The world can change without a repository commit, and a newly recorded observation can challenge previously supported knowledge.

## Interoperability and identity

Preserve ordinary Markdown source and formatting. Read-only extraction supports standard links and wikilinks, heading/block references, embeds, and optional YAML properties within a declared syntax and vault scope. Obsidian-specific block syntax is not standard Markdown; ambiguous, unsupported, or unresolved references must be visible. An index must not execute MDX imports, scripts, document instructions, or editor plugins.

Additional formats use bounded extractors over original bytes, not a second normalized authoring corpus. Editor workspace layouts and caches are not project knowledge. Discovery does not imply that every available file format or remote attachment can be interpreted safely.

Revision plus path identifies exact source. Optional identifiers and interpreted rename continuity can improve linking, but resemblance or a filename change alone does not establish identity. Retain exact source spans, resolution context, and uncertainty when references cannot be resolved reliably.

## Queries and history

List, search, graph, dictionary, attribution, history, alignment, and semantic-diff views are bounded projections, not additional primitives. They identify exact sources and report redaction, truncation, unsupported extraction, stale support, and unresolved dependencies. Caches are disposable and must not overrule retained bytes or authoritative records.

A semantic diff exposes changed commitments, assumptions, affected paths and dependencies, alternatives, and realization obligations—not merely changed prose. Reconstruct historical files and recorded judgments from retained snapshots and outcomes, never by rerunning a model. Adoption of an existing repository records honest baseline assurance without fabricating historical Changes or accepted reasons.

See [validation](checks.md), [alignment](alignment.md), and [recovery](../flows/recovery.md).
