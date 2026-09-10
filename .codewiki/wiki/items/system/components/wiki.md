---
{"aliases":["Knowledge"],"attributes":{"codewiki.component:ownership":{"generatedViews":["dictionary","wiki-attribution","wiki-graph","wiki-history","wiki-search","wiki-semantic-diff"],"sourcePatterns":["src/kernel/wiki/**"],"testPatterns":["tests/kernel/wiki/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:knowledge","codewiki_id":"cw:component:knowledge","codewiki_relationships":[{"rationale":"Knowledge supplies the System responsibility required by this Story.","target":"cw:story:maintainer.maintain-intent","type":"realizes"},{"rationale":"Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}],"codewiki_source_patterns":["src/knowledge/**"],"codewiki_test_patterns":["tests/knowledge/**"],"description":"Owns Backend-v1 Knowledge and target Git-versioned Wiki Item identity, accepted meaning, relationships, and provenance.","status":"stable","tags":["system","component"],"title":"Knowledge","type":"System Component"},"codewiki.legacy:source-path":"system/components/knowledge.md"},"itemId":"cw:component:knowledge","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:22f19eb1fcbb39f3f912abba6df80f0ee8acaa5d61695044d5f1c20baab7de57","codewiki.legacy:source-path":"system/components/knowledge.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:knowledge"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Knowledge supplies the System responsibility required by this Story.","target":"cw:story:maintainer.maintain-intent","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:check-author.author-composable-checks"}],"title":"Wiki"}
---
# Wiki

Wiki is current accepted project knowledge at an exact revision: scoped assertions, adopted decisions, obligations, procedures, their grounds and uncertainty. [Change](change-trace.md) governs its evolution. Wiki is neither a folder nor a disposable model-generated cache; its accepted outcomes are preserved in Git, not reconstructed by repeating inference.

## Hot knowledge and cold information

Hot means current knowledge available for applicable validation, not every page loaded into a model context. Retired knowledge, prior decisions and other sources remain on a cold, on-demand information path. Cold does not mean unprocessed, false or never accepted. [Evidence](evidence.md) defines how retrieved material supports particular claims.

Promotion, revision, retirement and re-adoption require an authorized, accepted scoped Change transition. Reading history, generating an answer, rebuilding an index or evicting context does not perform one. A rarely consulted obligation remains binding until explicitly revised or retired; an old rule does not regain authority when retrieved.

Keep current conclusions with concise reasons, applicable conditions, important uncertainty and links to deeper grounds. Move obsolete detail out of active guidance without losing exact prior text or its disposition. Git already preserves that history; no second archive store is required. Moving Markdown into an `archive/` directory inside the current corpus does not itself retire its commitments.

## Corpus and applicability

Tracked Markdown participates across the scoped Project: README files, documentation, notes and other paths. No proprietary frontmatter, document ID or special enrollment directory is required. Working edits and new files remain proposals until accepted; discovery never silently stages, adopts or uploads them.

A file can contain adopted assertions, quotations, hypotheses, fixtures, pending proposals and historical accounts with different roles. File membership or extension alone does not establish truth or governing force. Ambiguous role, scope or missing context stays explicit; neither a proposal's waiver nor an external source becomes current policy by appearing in Markdown.

Ignore rules do not remove tracked files. Repository/vault scope and disclosure permissions apply to current and historical reads. Do not follow links, symlinks, submodules or attachments into unrelated private material, or let machine-local settings redefine accepted historical meaning. Existing repositories need honest baseline assurance, not fabricated earlier Changes or validation.

## Revisable grounds

Preserve what matters to action and reconsideration: purpose, support, assumptions, alternatives and attribution. These are questions, not mandatory fields on every paragraph. Do not invent missing historical reasons or erase scoped disagreement.

Support dependencies differ from topical links. Losing one assumption calls for reassessment; independent support may preserve a conclusion. A rejected alternative can become appropriate when its conditions change. Normative targets, owned gaps and observed reality remain distinct, and reality can change without a commit.

## Format and retrieval

Preserve original Markdown bytes and normal editor workflows. Support declared standard links, wikilinks, heading/block references, embeds and optional YAML within explicit vault scope; report ambiguous or unsupported syntax. Optional format extraction is read-only and must not execute MDX imports, scripts, document instructions or editor plugins.

Revision, path and passage context identify exact material. Optional identifiers or rename interpretation cannot replace reliable provenance. Native history and optional external sources can feed bounded retrieval/RAG without becoming equivalent storage authorities. The core works without external data connectors.

Search, graph, dictionary, attribution, alignment and diff are derived views. Report source version, current/historical role, disposition, omissions, redaction, staleness and unavailable material. Indexes are rebuildable; missing source data cannot be recreated from embeddings. A semantic diff exposes changed commitments, assumptions, affected paths and realization obligations, not merely changed prose. See [validation](checks.md) and [Project](project.md).
