---
title: Wiki
aliases:
  - Knowledge
source-id: cw:component:knowledge
ownership:
  generatedViews:
    - dictionary
    - wiki-attribution
    - wiki-graph
    - wiki-history
    - wiki-search
    - wiki-semantic-diff
  sourcePatterns:
    - src/kernel/wiki/**
  testPatterns:
    - tests/kernel/wiki/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:22f19eb1fcbb39f3f912abba6df80f0ee8acaa5d61695044d5f1c20baab7de57
        codewiki.legacy:source-path: system/components/knowledge.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:knowledge
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Knowledge supplies the System responsibility required by this Story.
          target: cw:story:maintainer.maintain-intent
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.maintain-intent
    - attributes:
        codewiki.legacy:relationship:
          rationale: Knowledge supplies exact OKF concepts, relationships, and requirement metadata to repository-aware Checks.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
---
# Wiki

Wiki is authoritative recorded Project knowledge at an exact accepted revision: scoped meanings, assertions, obligations, procedures, their grounds and uncertainty. [Change](change-trace.md) is its governed creation and evolution point. Wiki stores consolidated accepted consequences of intent, not copies of session conversations or a disposable model-generated cache. Exact accepted outcomes are preserved in Git, not reconstructed by repeating inference.

## Sources and managed knowledge

The [Project](project.md) is the source and collaboration boundary; the managed Wiki is its consolidated knowledge representation. Tracked Markdown, notes, other Project artifacts and explicitly scoped external material can supply context without first adopting a Wiki profile or moving into its directory. Source discovery is not acceptance, and a source's wording is not automatically an authoritative Project commitment.

A Change develops intent and relevant sources through refinement informed by Gate Checks, proposing the minimum sufficient knowledge needed to express their Project-specific consequences. Preserve essential conditions, exceptions, uncertainty and relationships rather than optimizing for the shortest summary. Keep exact inputs and the resulting proposal attributable; synthesis may reorganize or consolidate meaning but must not silently overwrite source evidence or manufacture agreement.

Humans may write documents directly using ordinary tools. Those drafts enter the same governed Gate Checks and acceptance path as agent-generated proposals; already adequate content need not be rewritten merely to pass through it. Discovery never silently stages, adopts or uploads work. Runtime sessions, transcripts, compaction and temporary working context belong to the agent runtime, not the Wiki.

## Desired state, reality and validation policy

Wiki holds what the project agrees and intends, including accepted factual claims with their Evidence and limitations. Raw data supplies information; artifacts embody produced work. Neither source discovery nor agent synthesis makes a statement true or governing. An accepted desired outcome is not proof that it is realized. [Alignment](alignment.md) derives desired outcomes, observed current state and related Changes without a second State or task database.

[Checks](checks.md) evaluate selected claims against exact adopted policy and supplied Evidence. Agents gather information, prepare proposals and repair failures; Checks are read-only functions and may combine code with bounded model inference. An observation is information obtained by inspection, measurement or execution, not an additional authoring object. It becomes Evidence through its attributable use for a particular claim. [Evidence retention](evidence.md#committed-sources-and-durable-retention) binds committed Project sources and authorized external custody without treating Git as a proof of truth.

All semantic Checks and Packs are custom, including first-party offerings. Wiki records which exact policies, Check definitions/Packs and execution settings the project adopts, with scope, reasons and exceptions. Packs distribute evaluation methods, not an automatically governing second policy store. Prefer adopted policy parameters supplied to a reusable evaluator; an inherently executable rule can be adopted by exact reference rather than duplicated in prose. Installation, axis labels, Skills and proposed configuration grant no authority. Changes to policy or evaluator selection follow the previously adopted transition rules, not the candidate's own waiver.

The Kernel's managed-document representation and protected transition rules remain runtime contracts. They are not hidden semantic Checks or a promise that arbitrary adopted Packs establish universal justification. No validation may be reported where none occurred.

## Structural and optional folders

`.changekernel/wiki/` is the structural home for managed Wiki knowledge. `.changekernel/wiki/types/` is the structural home for TypeDefinition documents. These predictable locations do not limit which Project sources can inform a Change or establish acceptance merely by containing a file.

Other folders, such as `project/`, `fieldwork/` or `system/`, are optional domain groupings introduced through Changes. A small Wiki may keep content directly under its root. No directory per Change or document type, mandatory navigation index, session mirror or separate archive is required. Reorganization must preserve references and recorded continuity; directory placement is not a substitute for an Item's declared meaning or type.

## Item types and representation

Wiki uses six core Item-type categories. Their common representation and type-specific content serve consistent interpretation while preserving enough natural language to express Project context. A Project may concern research, operations, planning or other work; software artifacts and tests are examples, not universal prerequisites.

| Type | Required meaning, not mandatory section names |
| --- | --- |
| Definition | Project-specific meaning, scope and distinctions from easily confused concepts. |
| Entity | What the thing is, its role, boundaries and consequential relationships; intended versus observed state where they differ. |
| Contract | Applicable scope, obligations and material exceptions or limits. |
| Procedure | Preconditions, ordered actions, expected outcome and consequential failure or recovery conditions. |
| Claim | Assertion and scope, grounds or their declared absence, uncertainty and material counterevidence. |
| TypeDefinition | Purpose, use/avoid conditions, core relationship, required content and assessment limits. |

An Item's type is declared by its document profile, not inferred from its folder. Reuse existing types before introducing a new distinction; do not require a Definition for every noun, a Claim for every sentence or a TypeDefinition for every Change. A Claim can be an explicitly qualified hypothesis or observation; its acceptance is not proof of truth. Draft, stale, superseded and retired are dispositions, not separate Item types.

Changes also govern the introduction and evolution of reusable types. A type definition is knowledge, not an executable plugin or an independent authority that can waive the obligations governing its own adoption. Kernel-owned document and type interpretation must retain the relevant accepted source context. Structural conformance does not prove semantic adequacy or alignment; [Gate Checks](checks.md) preserve that distinction.

## Managed Markdown contract

Managed document representation and interpretation belong to the [ChangeKernel release version](changekernel.md#versioning-and-document-contract). The historical name “Wiki profile” does not denote an independently released or selectable contract. Kernel rules and the exact type-definition context determine how a subject is read; Kernel Build identifies the implementation, not permission or proof that its interpretation is adequate. Neither the document contract nor conformance to it is an Item type, a stage check or an approval.

Wiki revisions and Kernel versions are distinct. Editing prose or a TypeDefinition changes the Wiki snapshot under the existing rules. Changing those rules requires the corresponding major, minor or patch Kernel bump. Many Wiki revisions therefore use the same Kernel version, while historical interpretation remains bound to its exact recorded build and type-definition snapshot.

Managed output is UTF-8 Markdown with LF line endings, no BOM and a bounded YAML frontmatter mapping. Converting an input into that form is an explicit proposed transformation; source reads preserve the original bytes and do not normalize arbitrary prose Unicode. This is a restricted data contract, not full YAML, OKF or Obsidian round-trip compatibility.

Use JSON-compatible data values, string mapping keys and unique keys. Reject custom tags, anchors/aliases, merge keys, extra YAML documents and unsupported implicit scalar forms. Never execute document code. Parsing has explicit finite byte, depth, node and collection limits; implementation selects and tests those limits and its parser before exposure.

| Field | Managed contract |
| --- | --- |
| `type` | Required declared type name. |
| `title` | Required nonempty title; the first H1 matches it. |
| `codewiki-origin` | Required nonempty list of unique creating/adopting Change paths. |
| `codewiki-revision` | Required path to the Change responsible for the current accepted Item bytes. |
| `description` | Optional string. |
| `aliases`, `tags` | Optional unique string lists. |

Require concise primary meaning and the type's semantic content, not universal H2 labels or boilerplate. Missing consequential grounds must be explicit; plausible fields and headings do not establish adequate support. No universal UUID, status, timestamp, summary or complete history list is required.

Preserve bounded unknown data fields without granting them authority. Reserve `codewiki-*` for declared Kernel meanings; unknown reserved fields fail conformance. `sources` can carry citation data, but this contract does not standardize an OKF source-entry schema. An imported `approved`, `active` or `verified` value remains data, not an acceptance receipt.

### References and continuity

Change paths are Item-relative navigation references into the selected Project's `.changekernel/changes/` namespace. Resolve them lexically within the Project, without filesystem traversal, symlink following or expanded permissions. Preserve creating/adopting origins through ordinary revisions. Document-level origins do not attribute every sentence.

An exact Item is bound by snapshot, path and retained bytes/blob identity. Changes preserve exact prior/resulting subjects and historical Change versions; a path alone is not an immutable receipt. Missing, private or reused historical targets remain unresolved rather than being guessed from the latest same-named path. Missing earlier authorship permits honest adoption of an observed baseline now, not invented ancient origins.

Rename, split, merge and retirement Changes explicitly map their old and resulting subjects and assess affected links. Similar titles, text or Git rename heuristics do not establish continuity. Preserve old IDs and provenance in retained subjects and adoption mappings rather than erasing them during conversion.

### Declarative types and version binding

The six core names are reserved. Additional type names are case-sensitive ASCII PascalCase and resolve to exactly one TypeDefinition under `types/` whose `title` declares that name; aliases do not participate in type resolution. Duplicate or unknown declarations cannot silently select an arbitrary definition. The catalogue is derived from bound documents, not a separate authoritative registry.

A custom TypeDefinition additionally requires `codewiki-base`, naming exactly one of Definition, Entity, Contract, Procedure or Claim, and states added content obligations in prose. It cannot weaken that base or adoption obligations. Deep/multiple inheritance, custom TypeDefinition meta-types and executable validation DSLs are outside this contract.

An authorized initial Change proposes the six core definitions, including TypeDefinition, under the selected immutable Kernel release's document contract. The Kernel supplies the non-waivable bootstrap floor; candidate definitions cannot authorize themselves. A custom type and its first instances may be one assessed candidate under that floor. Type evolution requires impact assessment of affected Items, including byte-unchanged Items whose interpretation or obligations would change.

Bind interpretation to the exact Kernel Build and type-definition snapshot recorded for the subject, rather than repeating a fifth universal field on every Item or managing an independent profile version. Historical reads never substitute mutable latest definitions. A standalone exported file without that context remains material with unresolved version or acceptance. Exact binding/receipt encoding is an integration contract, not authority supplied by the document itself.

Preserve exact historical subjects and meaningful provenance in retained Git history, without promising executable support for every experimental envelope. The current Kernel admits one managed Markdown representation; it does not retry an obsolete reader after failed decoding. Existing `profile` fields are internal record identities, not independent release choices. Genuine supported deployments need an explicitly scoped transition; source-development cleanup does not grant controller authority.

### Source repository design documents

This source repository's Wiki is desired-state design truth, not a newly adopted Project governed by its mutable checkout. Its readable YAML metadata retains titles, aliases, source identifiers and source/test ownership. `source-history` preserves prior provenance and relationship data as historical information, not current commitments or acceptance receipts. Obsolete canonical-JSON envelopes and duplicate imported metadata are removed; exact earlier bytes remain in Git and the cleanup backup. Existing paths remain ordinary groupings to preserve links.

This metadata conversion does not manufacture required TypeDefinitions, origins, revision Changes or accepted outcomes. These design documents remain source material for a later explicitly authorized adoption under a qualified external release. The managed-document conformance rules above are not waived: a source file's location or readable metadata alone cannot satisfy them.

## Hot knowledge and cold information

Hot means accepted knowledge that still applies, whether its originating Changes are ongoing or completed; it does not mean every page is loaded into a model context. Unaccepted proposals, including derived alternatives in the proposals pool, do not become governing knowledge through activity, ranking or repeated inference. An accepted Change can explicitly adopt normative targets before Planning, Implementation and Review establish their realization; the gap remains visible. Approval does not turn a target into an observed fact or prove a Claim true. Completed Changes do not make their superseded consequences current.

Promotion, revision, retirement and re-adoption require an authorized, accepted scoped Change transition. Reading history, generating an answer, rebuilding an index or evicting context does not perform one. A rarely consulted obligation remains binding until explicitly revised or retired. Stale support prompts reassessment, not automatic revocation; distinguish stale, contradicted, superseded and retired knowledge.

Cleanup removes obsolete detail from active guidance without losing exact prior text, grounds or disposition. Preserve links to creating/adopting, revising and superseding/retiring Changes where recorded: one Change can affect several Items, and one Item or passage can evolve through several Changes. The relationship must remain recoverable after old content leaves the hot tree. Git preserves exact history; no second archive store or permanent duplicate historical page is required. A file move into an archive-named directory is not itself retirement.

Cold information can include previously accepted knowledge, rejected alternatives and other sources. Cold does not mean false, unprocessed or never accepted. [Evidence](evidence.md) defines how retrieved material supports particular claims. Retrieval does not re-adopt an old rule, and missing origins require honest observed-baseline provenance rather than invented historical Changes.

## Grounds and bounded retrieval

Preserve what matters to action and reconsideration: purpose, support, assumptions, alternatives and attribution. These are questions, not mandatory fields on every paragraph. Support dependencies differ from topical links; independent support may survive the loss of one assumption. Do not erase disagreement or mistake a linked quotation, fixture or historical account for an applicable obligation. Normative targets and observed reality remain distinct, and reality can change without a commit.

Preserve exact source bytes and exact accepted outcomes. Ordinary source/editor syntax may include declared Markdown links, wikilinks, heading/block references, embeds or frontmatter; report ambiguous or unsupported syntax. Format extraction must not execute imports, scripts, document instructions or editor plugins. Source format tolerance does not waive the Kernel's managed document contract or authorize live conversion.

Repository scope and disclosure permissions apply to current and historical reads. Ignore rules do not remove tracked files. Do not follow links, symlinks, submodules or attachments into unrelated private material, or let machine-local settings redefine accepted historical meaning. Revision, path and passage context identify exact material; optional identifiers or rename interpretation cannot replace reliable provenance. The core works without external data connectors.

Search, graph, dictionary, attribution, alignment and diff are derived views of retained knowledge and grounds, not additional authoritative stores. Report source version, current/proposed/historical role, disposition, omissions, redaction, staleness and unavailable material. Bounded on-demand retrieval must not change acceptance or retention. Indexes are rebuildable; missing sources cannot be recreated from embeddings. A semantic diff exposes changed commitments, assumptions and realization obligations, not merely changed prose.
