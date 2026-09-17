---
title: Change Intake
aliases:
  - Change Intake Material
  - Discovery Finding
  - Improvement Assessment
  - Outcome Diagnostics
source-id: cw:component:change-intake
ownership:
  sourcePatterns:
    - src/server/intake/**
  testPatterns:
    - tests/server/intake/**
  traceEvents:
    - change.proposed
    - change.revised
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:2db867e862f54ac8759304078612cc967bdfa99300c349989c46d7dad9093a31
        codewiki.legacy:source-path: system/components/change-intake.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:change-intake
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Change Intake turns untrusted proposals and discovered work into accountable intent.
          target: cw:story:maintainer.maintain-intent
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.maintain-intent
    - attributes:
        codewiki.legacy:relationship:
          rationale: Change Intake gives external and out-of-scope discoveries a visible accountable path.
          target: cw:story:maintainer.account-for-drift
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.account-for-drift
---
# Change Intake

Intake turns bounded source material into attributable, intent-bearing proposed Changes. Conversation, direct document authoring, Agent discoveries, external signals and [derived proposals](change-trace.md#derived-proposals) enter the same funnel. Equal treatment means common admission, Gate Checks and decision rules, not equal trust or authority. Optional connectors are input adapters, not prerequisites or alternative acceptance authorities.

Standardization preserves purpose, proposed modifications, scope, assumptions, alternatives, acceptance questions and source attribution. It does not require identical prose templates or rewrite already adequate content. Distinguish what a source actually says from an Agent's inferred intention. Source instructions, an imported approval label or a claimed work ID cannot grant execution or disclosure authority.

## Early proposed Changes

A Change can enter the `proposed` state before its Wiki consequences are fully determined. Retain the exact known input and available Current Project state grounds, with missing intent, scope, sources and acceptance conditions explicitly unresolved. Do not invent certainty, historical reasons, Wiki targets or complete Project state references merely to admit a proposal. Refinement develops the same continuing inquiry; concrete Proposed Changes later bind exact resulting subjects for their Gate Checks and acceptance.

Free-form or speech-to-text input may mix questions, alternatives and tentative wishes. The Agent grounds its response in relevant Wiki, artifacts and history, makes its interpretation visible and seeks consequential clarification without waiting for a ceremonial submission phrase. Admitting a proposed Change is not user endorsement of that interpretation. A conversation need not finish before [Decision](decision.md) inquiry starts, and a long message need not become one Change per sentence.

## Structured evaluation, not structured conversation

Before submitting a concrete Proposed Change for evaluation, bind Current Project state and exact proposed bytes and supply the inputs required by adopted Checks: intent and scope, consequential claims/assumptions, Evidence references, affected commitments and explicit revisions, alternatives and outcome conditions. Missing information is explicit. An absent required input makes a selected Check unready, not inapplicable. The backend derives the Change diff from those bytes. Backend source resolution and Change diff inspection cannot be replaced by producer-supplied labels or completeness flags.

Agents do the exploratory tool use, collection and synthesis. Read-only Checks consume bounded immutable inputs and return Boolean results with actionable feedback. Keep authoring, checkpointing, passing Checks, approval and adoption distinct. Existing early-intake contracts below remain source foundations; they do not implement the new unified Check contract merely by containing structured fields.

## Bounded local intake contract

The local intake boundary requires a nonblank intent or question, a nonempty attributable source set and an actual complete committed Project state in the configured repository. It admits unfinished understanding, not an empty or unauthorized request. Scope, rationale, classification and realization can be unknown; acceptance statements, questions and assumptions need not be complete. An empty questions array is not evidence of readiness. An unborn repository is an explicitly unsupported Project state until a supported adoption path exists; raw or empty Wiki content is not automatically adopted by supplying a Git commit.

Two input forms share this contract: a caller-selected text excerpt and an exact regular Markdown blob in this repository. Submitted captures retain lossless `contentUtf8Hex`, content SHA-256 and optional claimed locator/attribution. Repository captures bind the observed complete Project state reference, exact `pathUtf8Hex`, mode, blob OID and content SHA-256. Each source has a domain-separated digest. The backend loads referenced bytes; a structurally valid supplied record is not proof that those bytes were observed. `intentBasis` distinguishes a supplied statement from interpretation and names its nonempty source-digest set. Producer references and claimed speakers are provenance, not authority; the authenticated capture actor/authority and time come from the event.

Canonical interpreted prose is NFC, while raw captures preserve valid UTF-8, BOM/CRLF and decomposed paths through lossless encoding. Admission does not fetch URLs, scan sessions, execute instructions or infer an intent on the caller's behalf. Source material is loaded passively rather than forced through the managed Wiki parser.

The bounded inquiry representation admits at most 16 sources, 64 KiB aggregate submitted bytes, 16 KiB each for intent/rationale/scope, 32 acceptance/questions/assumptions entries each of at most 2 KiB, 32 relationships and a 256-KiB canonical Change. All bounds apply together with stricter configured limits. Repository corpus budgets remain independent. Bound own-data decoding, hex expansion and response size, not just string lengths; reject rather than truncate or persist unreadable history. [Change](change-trace.md#versioned-inquiry-and-recorded-identity) defines immutable revisions and optional Wiki attachment.

## Consolidation and boundaries

Several sources may support one Change; one source may motivate several Changes. Preserve those relationships and the reasons for consolidation, separation or revision. New information can refine an existing proposal rather than generate a duplicate. Similar wording does not prove equivalent intent or independent corroboration.

Authorized observation, indexing and retrieval still require no Change per read or data row. They do not silently stage, adopt or upload material. A generated answer, retired rule or external source remains information until an authorized scoped transition adopts it. Source capture obeys access, disclosure and retention limits; Change retains relevant grounds, not a transcript mirror or private model reasoning.

Existing repositories require honest initial Project state adoption, not retroactive fictional Changes. Intake, inference, acceptance and protected effects retain separate authority boundaries. See [Change](change-trace.md) and [external work admission](../flows/external-work-admission.md).
