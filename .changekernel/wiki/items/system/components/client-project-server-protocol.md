---
title: Client–Project Server Protocol
aliases:
  - Client SDK
  - Kernel API
  - Protocol
source-id: cw:component:protocol
ownership:
  sourcePatterns:
    - src/api/contracts/**
    - src/api/transport/**
  testPatterns:
    - tests/api/contracts/**
    - tests/api/transport/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:8c16341a02f91746ace20701c677c0fb10f824b628c30139bee34c974435eca7
        codewiki.legacy:source-path: system/components/protocol.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:protocol
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Protocol supplies bounded exact-input project queries.
          target: cw:story:agent.retrieve-bounded-context
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:agent.retrieve-bounded-context
    - attributes:
        codewiki.legacy:relationship:
          rationale: Protocol supplies typed idempotent access to authoritative Project Server operations.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# Client–Project Server Protocol

Clients operate on Wiki knowledge and intent-bearing Changes through the authorized service, without obtaining kernel internals or effect handles. Work, judgments, evidence, alignment and retrieval results are supporting records/views, not additional authoring primitives.

## Exact requests and disclosure

State-dependent requests name a Project and exact or once-resolved source. Assessment and mutation bind baseline and candidate; branch labels alone do not identify reviewed bytes. Authenticate and enforce authorization, request identity, expiry and bounds before disclosure or effects. Replay requires the same actor, operation, content and source; lost replies need outcome reconciliation.

Results distinguish current adopted knowledge, pending work and historical/external information. Native Git history is available without an external connector. Historical results identify exact source and former disposition; retrieval is not re-adoption. Report redaction, truncation, missing context, staleness, unsupported extraction and unavailable material. Hidden obligations do not become absent obligations.

## Operations and boundaries

Clients discover knowledge, inspect grounds, retrieve information, propose/revise Changes, receive semantic feedback, plan work and request review. Promotion, revision, retirement and re-adoption use accepted scoped transitions. Reads and generated answers cannot silently perform them. Checkpoints, acceptance and realization remain distinct in operation names and success messages.

Malformed or incompatible requests and substituted subjects fail clearly. Opaque references do not grant arbitrary resolution or execution. Normal results exclude credentials, raw refs/writers and private custody; separately authorized audit views can expose necessary technical evidence.

Host PRs or Check Runs may display results but cannot be their only durable record. Git is foundational; external data/hosting integrations are optional. See [Project Server](project-server.md), [evidence](evidence.md), and [Clients](clients.md).
