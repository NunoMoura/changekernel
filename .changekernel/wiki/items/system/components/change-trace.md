---
title: Change
aliases:
  - Change Trace
source-id: cw:component:change-trace
ownership:
  sourcePatterns:
    - src/kernel/changes/**
  testPatterns:
    - tests/kernel/changes/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:84d3c6c55f7cd03c165cfe6f628789568b0114350b3d8f1cb264bce1df91cb64
        codewiki.legacy:source-path: system/components/change-trace.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:change-trace
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Change Trace supplies the System responsibility required by this Story.
          target: cw:story:maintainer.recover-history
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.recover-history
---
# Change

Change is the durable unit of inquiry and the governed creation and evolution point for accepted Wiki knowledge. It preserves intent, desired effects, motivation, scope, relevant assumptions, alternatives, tradeoffs, deliberation, plans, attempts, evidence and outcomes across inputs, sessions and contributors. It can begin before a complete Wiki candidate exists. [Wiki](wiki.md) records the resulting current accepted meaning, with adopted consequences linked to their grounds. No separate State, Archive, Sources or intake-ticket authoring primitive is required.

## From intent to structured knowledge

A Change turns intent and relevant source material into explicit Project-specific consequences in natural language before and during realization. It can consolidate several sources, revise existing Items, introduce useful new Items or document types, or conclude that no knowledge change is warranted. Preserve the original input and make the actual proposed transformation attributable; do not repeatedly summarize prior summaries while discarding their grounds or uncertainty.

Direct human authoring and agent-generated drafts enter the same [intake](change-intake.md), Gate Checks and acceptance path. Already adequate content need not be rewritten merely to demonstrate synthesis. Missing intent, conflicting sources or unavailable required checks may leave a proposal unresolved. Check the actual resulting candidate against the relevant baseline; an earlier draft's Check results or approval do not transfer automatically to changed bytes.

The agent runtime owns sessions, transcripts, compaction and temporary working context. Change retains relevant attributable rationale and evidence, not a transcript mirror or a requirement to retain private model reasoning. The accepted Wiki outcome must remain understandable without replaying a conversation. Introducing a reusable type is itself governed knowledge work, not permission for that type to waive existing acceptance obligations.

## Proposed Changes and the pool

A `proposed` Change is a pending intent-bearing inquiry, not an accepted commitment or a running process. Native Git-backed records under `.changekernel/changes/` form the durable ledger, including retained proposed history. The proposals pool, filtering, sorting and readiness displays are views over those Changes, not another authoritative backlog or knowledge store. A proposal's presence, rank or repeated appearance cannot promote its contents into current Wiki.

Proposed Changes support asynchronous Gate Checks, refinement, clarification and an eventual user decision to accept, reject or defer. [Project Server](project-server.md#continuous-inquiry) schedules bounded work; closing a conversation does not discard the inquiry. Operational queue, lease and retry state is distinct from Change's semantic disposition.

## Versioned inquiry and recorded identity

The early-inquiry representation is the same Change, not a new category. Its body binds protocol, Change/repository identity, revision, actual baseline, document-format identity (`profile`), intent and source basis, nullable rationale/scope/classification/realization, acceptance/questions/assumptions, source records, existing-kind relationships, Wiki consequences and the semantic digest. Revision starts at 1 and increments exactly once under the same Change/repository/recorded-format identity. The `profile` field is an internal record identity; representation and interpretation changes are versioned with the Kernel, not an independent profile release. A revision records the full replacement body and nonblank reason without rewriting earlier sources or event prefixes.

`wikiConsequences` distinguishes `{kind: "unresolved"}`, `{kind: "none", reason}` and `{kind: "profile", reference}`. None is a proposed conclusion, not a passed check. A profile attachment uses the existing exact reference contract and nonempty endpoint set; targets are derived, not fabricated for early intent. Its complete before snapshot equals the revision baseline; responsible path, profile and build grounds must match. Changed baseline/build requires explicit removal or reattachment. An intent revision cannot inherit an earlier Gate verdict even if its candidate bytes remain unchanged.

The successor contract is Change `3.0.0`, Event `3.0.0`, Trace `16.0.0` under the common protocol IDs. It admits only `change.proposed` and `change.revised`, producing proposed state without Gate, approval or Work facts. Its Kernel owner binding is `{kind: "kernel", profile, kernelBuildDigest}`; transaction grounds are present only through a real attachment. Initial events have a null prior tip; revisions bind the prior persistence tip and event digest. Actual persistence-tip/source authenticity is verified by the runtime, not established by pure decoding. Retain the existing containing-commit marker rather than self-embedding an OID. Inquiry Trace is bounded to 64 events / 1 MiB including framing; the runtime also bounds cumulative recovery and returned data.

Recorded bytes and their meanings must not be rewritten or relabeled. This does not require permanent executable support for every pre-release grammar. The current server persists and recovers concrete-proposal Change/Event `2.0.0`, Trace `15.0.0` and reference `1.0.0`; Trace 15 is proposal-only with one event. Early-inquiry contracts remain internal work, not an enabled second lifecycle. The old Change/Work contracts, event catalog, Trace 14 execution, binary Gate engine and their reducers are removed. Current reduction returns only implemented proposal state, without empty placeholders for Gates, Work, completion or protected effects. Concrete and early-inquiry traces share bounded framing and own-data validation. Any supported historical decoding is explicit, never inferred from a missing field or a fallback parser. Future Gate/decision persistence needs a declared current contract and complete recovery evidence, not the removed legacy Gate engine.

## Derived proposals

Relationships among proposals can reveal overlap, conflict, composition, dependencies, missing prerequisites or a better alternative. Linking existing Changes may be sufficient. A materially new combined intention or tradeoff can instead enter intake as another proposed Change, with its own Gate Checks and decision.

Record the exact source Change versions and relevant evidence, what the derivation preserves, revises or discards, and which assumptions or commitments it adds. Bind each source by repository, Change ID, protocol, revision/digest, exact Trace prefix/event and containing commit; reload and retain those grounds rather than trusting a claimed digest. Keep source proposals and their disagreements recoverable. Semantic synthesis is not a Git merge and does not silently delete, accept, reject or supersede its sources. Any supersession or disposition must be explicit and authorized; acceptance of the derived Change covers only its actual scoped consequences.

Tentative premises yield conditional proposals, not established facts. Model-generated synthesis is not a deductive proof, and repeated derivatives of one unsupported source are not independent evidence. Generation and Gate Checks remain distinct: a checker cannot silently change its subject and transfer its verdict to the rewrite. Bound comparison and recursive derivation, avoid redundant or circular chains, and prioritize useful decisions over proposal volume. No separate incubator primitive or inference-based authority is introduced.

## Adoption and retirement

An introduced Change proposes a transition. Only an authorized, accepted scoped transition promotes information into Wiki knowledge, revises or retires knowledge, or adopts it again. This can concern a passage or commitment rather than an entire file. Preserve the exact prior/resulting subjects, reasons and disposition so native Git history can later explain what applied and why it changed.

Knowledge-to-Change lineage is many-to-many: one Change can establish or revise several Items, and an Item or passage can have several creating/adopting, revising and superseding/retiring Changes. Cleanup must keep that relationship recoverable when old content leaves the active Wiki. Stale support prompts reassessment rather than silent retirement; preserve still-applicable obligations and the distinction between uncertainty, contradiction and supersession.

Retrieval, indexing, context packing and authorized observation are not semantic promotion. A useful RAG answer remains an interpretation until adopted through a Change. Retired knowledge is available as information, not automatically current policy. An ordinary file move, deletion or commit cannot fabricate acceptance of a retirement.

## User decision and delegated work

The user commits a Change at the level of intent, desired consequences, scope and consequential design or structure. Within that authorization, agents own decomposition into Work units, implementation details, intermediate checkpoints, technical validation and repairs. Work units are means to the Change's outcome, not separate Changes requiring repeated user approval. The user can inspect or intervene without becoming the routine validator of every step.

Backend-enforced adopted Checks and acceptance still bind the actual candidate and its authorized effects; they do not require a human gate-checker or a new confirmation for each Work unit. The joined result must satisfy the Change's obligations. Material changes to intent, design, scope or authority return to the user; independently protected effects retain their own authority requirements. Routine implementation discoveries and repairs within the approved design remain delegated work.

## Evolving inquiry

The [four loops](../flows/change-lifecycle.md) preserve the original intent while developing credible paths and evidence. Material changes to intent, scope or authority explicitly revisit Decision. Repairs within accepted scope need not create a new Change for every command or checkpoint.

Classification follows actual semantic effects, which may combine knowledge correction, investigation, commitment revision and realization. Author-selected labels cannot remove applicable obligations. Shared and rejected alternatives remain attributable rather than being overwritten to fit produced work.

## Evaluation records and desired-state links

Structured evaluation binds exact inputs, adopted Check/Pack versions, configuration, results, feedback and retained Evidence. Check implementations may mix code and model inference; there is no separate Finding or Obligation authoring object. A pass report is a view of those records, not approval or an independent policy store. It supplies a concise Decision commit explanation and the bounded context for a fresh next-stage session. Do not make commit prose or a private transcript the only surviving grounds.

A Change can propose realizing, investigating, preserving or revising an exact desired Wiki outcome, wholly or partially. Links are attributable coverage claims, not inferred proof from names. Preserve many-to-many relationships and source revisions so [Alignment](alignment.md) can show what is wanted, observed and being addressed. Proposed work, accepted work, completed tasks and demonstrated realization remain distinct. A new assessment must not silently inherit earlier support after relevant inputs or desired outcomes change.

New persistence for unified Checks and handoff must have an explicit bounded current contract with recovery. Existing prerelease protocol numbers and historical records below are not automatically extended or renamed by this design update. Replace obsolete executable scaffolding deliberately rather than shipping parallel lifecycle engines.

## Outcomes and exact history

A Change can span many commits and parallel work lines. Checkpointed, assessed, accepted and realized are distinct. Intermediate knowledge adoption does not imply the whole intent is complete. A normative target can be adopted while its realization gap remains visible; an adopted lesson from rejected work does not realize its original goal.

Git natively preserves Change records and exact Wiki outcomes. A Change Trace is append-only lifecycle history, not a competing knowledge system. Records bind baseline, candidate, relevant evidence, authority and interpretation conditions. Host UI data or private sessions cannot be the only surviving grounds.

Reconstruct exact retained states and recorded judgments, never rerun models or external effects to recreate them. A record cannot assert its own enclosing commit OID before it exists. Rewritten, joined or derived subjects must not inherit Gate Check results by label alone; transport and retention must preserve the source versions and references needed for recovery. Historical acceptance remains evidence about its recorded context, not present-day endorsement.
