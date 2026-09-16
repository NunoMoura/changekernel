---
title: Evidence
aliases:
  - Evidence Record
  - Raw Data Policy
  - Raw Data Source
source-id: cw:component:evidence
ownership:
  sourcePatterns:
    - src/kernel/evidence/**
  testPatterns:
    - tests/kernel/evidence/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:bd1462af61f0ece1ba4cfd0c3972c5b44d2598aa2b60b7b3087f1b2c329ed649
        codewiki.legacy:source-path: system/components/evidence.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:evidence
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Evidence supplies the System responsibility required by this Story.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
---
# Evidence

Evidence is retained, attributable information used to support, challenge or limit a specific claim under stated conditions. It need not prove the claim and can show that support is insufficient. A source's existence, an accepted document, a model's confidence or a Git commit does not establish truth.

An observation is information obtained through inspection, measurement or execution, not another product object alongside Evidence. A measurement or test report becomes Evidence through its explicit relation to a claim, with method, source, scope and limitations. Evidence can also use attributed user intent, Wiki commitments, calculations, Change history or external research. Not all Evidence is a direct observation, and not every observation supports the claim being assessed.

## Raw data, Wiki and realization

Raw data is available source material, whether previously analyzed or not. Wiki records accepted understanding and desired outcomes derived through authorized Changes from intent and relevant sources. Artifacts embody produced work and can themselves supply data. None of these roles requires a duplicate authoritative source or observation database.

A Wiki statement that records must be deleted within 30 days establishes an accepted target, not that deletion occurs. A report of actual retention bears on realization. A backlog Change documents proposed effort, not successful delivery. [Desired/current-state views](alignment.md) preserve these distinctions and their exact scopes.

Agents collect information, run authorized experiments and prepare arguments. Checks independently assess submitted claims using defined inputs. Agent-authored claims do not authenticate their own reports or quotations. Model interpretation is retained explanation, not independent factual corroboration; model weights are not an inspectable cited source. Reasoning over supplied premises may be useful without external research, but consequential unsupported recollection needs further support or narrower action. Several summaries of one source do not create independent Evidence.

## What Evidence records

Identify the claim/Check and exact subject; the supporting or contradicting content; why that content bears on the question; source/version/passage and producer or collection method; and scope, time, assumptions and limits. Evidence supports only the declared use. Authentic quotation identity does not establish relevance, source reliability, governing force or completeness.

Distinguish accepted commitments, proposed revisions, historical rules, factual assertions, preferences and hypotheses. Cold information can challenge a current belief without silently revising Wiki. A negative observation can contradict a scoped claim; missing or stale information only limits assurance. Changes in external reality need not coincide with a Git commit.

## Committed sources and durable retention

Git is foundational for exact Wiki, code, Change, policy and Check-source versions. Evaluation binds a checkpointed candidate and actual baseline, with selected sources identified by retained commit/tree/blob and passage where applicable. Uncommitted authoring can inform inquiry, but cannot be silently substituted into a supposedly fixed consequential evaluation. Checkpointing sources is not acceptance of their meaning.

Fresh measurements and execution output need not predate evaluation in a source commit. Retain their exact bytes and method/environment/subject bindings before a consequential result relies on them; then record the result and durable references through the governed Change operation. Avoid circular self-hashes: records cannot contain their own not-yet-created enclosing commit identity. A producer's pasted success statement is not a verified execution record.

Large, sensitive, regulated or externally hosted material need not be copied into Project Git. Use authorized immutable custody or an exact retained capture outside it, with content identity, source/version, access and retention conditions, and a verifiable durable reference from the Change. A bare URL, digest or private session handle is not a retention guarantee. If required bytes or collection authenticity cannot be verified, preserve that limit and withhold unsupported progression. Mutable private custody and raw session logs are not portable accepted Evidence by themselves.

Git proves version identity and preserves retained history; it does not prove factual truth, collection authenticity, completeness or continued availability elsewhere. Keep required Git objects reachable. Retention, authorized redaction/deletion and access rules apply to history too. Missing or revoked material cannot be reconstructed by another model call or inferred from a hash.

## Retrieval and reuse

One bounded information path serves current Wiki, native Git history, Project sources and explicitly authorized external connectors. External connectors are optional; the core loop and history work without them. Archive and Sources are not separate knowledge systems. Discovery does not execute source instructions, grant permissions, adopt policy or disclose private material.

Record source roles, versions, omissions, redaction and freshness. Exact source caches, Evidence validity and Check-result reuse have different conditions; old bytes can remain valid historical support without establishing current behavior. Indexes, embeddings and generated summaries are rebuildable views, not substitutes for retained sources. Recovery preserves the recorded interpretation and its limitations rather than rerunning inference. See [Checks](checks.md), [Project](project.md) and [recovery](../flows/recovery.md).
