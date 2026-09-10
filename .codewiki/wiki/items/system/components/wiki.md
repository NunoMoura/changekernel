---
{"aliases":["Knowledge"],"attributes":{"codewiki.component:ownership":{"generatedViews":["dictionary","wiki-attribution","wiki-graph","wiki-history","wiki-search","wiki-semantic-diff"],"sourcePatterns":["src/kernel/wiki/**"],"testPatterns":["tests/kernel/wiki/**"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:knowledge","codewiki_id":"cw:component:knowledge","codewiki_relationships":[{"rationale":"Knowledge supplies the System responsibility required by this Story.","target":"cw:story:maintainer.maintain-intent","type":"realizes"},{"rationale":"Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}],"codewiki_source_patterns":["src/knowledge/**"],"codewiki_test_patterns":["tests/knowledge/**"],"description":"Owns Backend-v1 Knowledge and target Git-versioned Wiki Item identity, accepted meaning, relationships, and provenance.","status":"stable","tags":["system","component"],"title":"Knowledge","type":"System Component"},"codewiki.legacy:source-path":"system/components/knowledge.md"},"itemId":"cw:component:knowledge","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:22f19eb1fcbb39f3f912abba6df80f0ee8acaa5d61695044d5f1c20baab7de57","codewiki.legacy:source-path":"system/components/knowledge.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:knowledge"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Knowledge supplies the System responsibility required by this Story.","target":"cw:story:maintainer.maintain-intent","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:check-author.author-composable-checks"}],"title":"Wiki"}
---
# Wiki

Wiki is authoritative recorded Project knowledge at an exact accepted revision: scoped meanings, assertions, obligations, procedures, their grounds and uncertainty. [Change](change-trace.md) is its governed creation and evolution point. Wiki stores consolidated accepted consequences of intent, not copies of session conversations or a disposable model-generated cache. Exact accepted outcomes are preserved in Git, not reconstructed by repeating inference.

## Sources and managed knowledge

The [Project](project.md) is the source and collaboration boundary; the managed Wiki is its consolidated knowledge representation. Tracked Markdown, notes, other Project artifacts and explicitly scoped external material can supply context without first adopting a Wiki profile or moving into its directory. Source discovery is not acceptance, and a source's wording is not automatically an authoritative Project commitment.

A Change assesses intent and relevant sources, then proposes the minimum sufficient knowledge needed to express their Project-specific consequences. Preserve essential conditions, exceptions, uncertainty and relationships rather than optimizing for the shortest summary. Keep exact inputs and the resulting proposal attributable; synthesis may reorganize or consolidate meaning but must not silently overwrite source evidence or manufacture agreement.

Humans may write documents directly using ordinary tools. Those drafts enter the same governed assessment and acceptance path as agent-generated proposals; already adequate content need not be rewritten merely to pass through it. Discovery never silently stages, adopts or uploads work. Runtime sessions, transcripts, compaction and temporary working context belong to the agent runtime, not the Wiki.

## Structural and optional folders

`.codewiki/wiki/` is the structural home for managed Wiki knowledge. `.codewiki/wiki/types/` is the structural home for TypeDefinition documents. These predictable locations do not limit which Project sources can inform a Change or establish acceptance merely by containing a file.

Other folders, such as `project/`, `fieldwork/` or `system/`, are optional domain groupings introduced through Changes. A small Wiki may keep content directly under its root. No directory per Change or document type, mandatory navigation index, session mirror or separate archive is required. Reorganization must preserve references and recorded continuity; directory placement is not a substitute for an Item's declared meaning or type.

## Item types and representation

Wiki uses six core Item-type categories. Their common representation and type-specific content serve consistent interpretation while preserving enough natural language to express Project context. A Project may concern research, operations, planning or other work; software artifacts and tests are examples, not universal prerequisites.

| Type | Purpose |
| --- | --- |
| Definition | Establish the Project-specific meaning and distinctions of a term or concept. |
| Entity | Describe a named thing, actor or system element, its relevant properties, boundaries and relationships. |
| Contract | Express obligations or constraints, their applicability and important exceptions. |
| Procedure | Describe how to perform a scoped activity, including relevant preconditions, outcomes and failure handling. |
| Claim | Preserve an assertion whose grounds, uncertainty or independent lifecycle justify separate treatment. |
| TypeDefinition | Define a reusable Project-specific document form and the conditions for interpreting and using it. |

An Item's type is declared by its document profile, not inferred from its folder. Reuse existing types before introducing a new distinction; do not require a Definition for every noun, a Claim for every sentence or a TypeDefinition for every Change. A Claim can be an explicitly qualified hypothesis or observation; its acceptance is not proof of truth. Draft, stale, superseded and retired are dispositions, not separate Item types.

Changes also govern the introduction and evolution of reusable types. A type definition is knowledge, not an executable plugin or an independent authority that can waive the obligations governing its own adoption. Profile and type interpretation must retain the relevant accepted source context. Structural conformance does not prove semantic adequacy or alignment; [validation](checks.md) preserves that distinction.

## Hot knowledge and cold information

Hot means accepted knowledge that still applies, whether its originating Changes are ongoing or completed; it does not mean every page is loaded into a model context. Unaccepted proposals do not become governing knowledge because their Changes are active. Accepted normative targets may precede realization, but the gap remains explicit. Completed Changes do not make their superseded consequences current.

Promotion, revision, retirement and re-adoption require an authorized, accepted scoped Change transition. Reading history, generating an answer, rebuilding an index or evicting context does not perform one. A rarely consulted obligation remains binding until explicitly revised or retired. Stale support prompts reassessment, not automatic revocation; distinguish stale, contradicted, superseded and retired knowledge.

Cleanup removes obsolete detail from active guidance without losing exact prior text, grounds or disposition. Preserve links to creating/adopting, revising and superseding/retiring Changes where recorded: one Change can affect several Items, and one Item or passage can evolve through several Changes. The relationship must remain recoverable after old content leaves the hot tree. Git preserves exact history; no second archive store or permanent duplicate historical page is required. A file move into an archive-named directory is not itself retirement.

Cold information can include previously accepted knowledge, rejected alternatives and other sources. Cold does not mean false, unprocessed or never accepted. [Evidence](evidence.md) defines how retrieved material supports particular claims. Retrieval does not re-adopt an old rule, and missing origins require honest observed-baseline provenance rather than invented historical Changes.

## Grounds and bounded retrieval

Preserve what matters to action and reconsideration: purpose, support, assumptions, alternatives and attribution. These are questions, not mandatory fields on every paragraph. Support dependencies differ from topical links; independent support may survive the loss of one assumption. Do not erase disagreement or mistake a linked quotation, fixture or historical account for an applicable obligation. Normative targets and observed reality remain distinct, and reality can change without a commit.

Preserve exact source bytes and exact accepted outcomes. Ordinary source/editor syntax may include declared Markdown links, wikilinks, heading/block references, embeds or frontmatter; report ambiguous or unsupported syntax. Format extraction must not execute imports, scripts, document instructions or editor plugins. Source format tolerance does not waive the managed Wiki's declared profile or authorize live conversion.

Repository scope and disclosure permissions apply to current and historical reads. Ignore rules do not remove tracked files. Do not follow links, symlinks, submodules or attachments into unrelated private material, or let machine-local settings redefine accepted historical meaning. Revision, path and passage context identify exact material; optional identifiers or rename interpretation cannot replace reliable provenance. The core works without external data connectors.

Search, graph, dictionary, attribution, alignment and diff are derived views of retained knowledge and grounds, not additional authoritative stores. Report source version, current/proposed/historical role, disposition, omissions, redaction, staleness and unavailable material. Bounded on-demand retrieval must not change acceptance or retention. Indexes are rebuildable; missing sources cannot be recreated from embeddings. A semantic diff exposes changed commitments, assumptions and realization obligations, not merely changed prose.
