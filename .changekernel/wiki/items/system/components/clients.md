---
title: Clients
aliases:
  - Client
  - ChangeKernel App
  - External Agent Client
source-id: cw:component:clients
ownership:
  sourcePatterns:
    - bin/changekernel.mjs
    - src/api/client/**
  testPatterns:
    - tests/api/client/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:01abbd6b8bdfd2910d4b4e1190dd54fe510ff7adad3b6925668748a796683497
        codewiki.legacy:source-path: system/components/clients.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:clients
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Clients present bounded project truth and exact Project Server operations.
          target: cw:story:agent.retrieve-bounded-context
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:agent.retrieve-bounded-context
    - attributes:
        codewiki.legacy:relationship:
          rationale: Clients provide direct user-controlled Check Pack editing, npm, Git, and local installation, preview, and inspection.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.legacy:relationship:
          rationale: Clients expose Skill, Check SDK, bundle, snapshot, preview, and replay diagnostics without granting execution authority.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
---
# Clients

Clients present knowledge and Change collaboration to humans and Agents through editors, conversation, a CLI or other interfaces. Users need not know Git; GitHub and external data connectors are optional. [Project Server](project-server.md) remains the authorized service boundary.

Present current knowledge with concise grounds and uncertainty, pending intent, and on-demand native history or external information without conflating their roles. A retrieved obsolete rule is not current policy. Proposed promotion, revision or retirement must be explicit; a summary, folder move or cache eviction cannot perform it.

Present the simple model: Wiki holds what is agreed; agents propose and produce changes; ChangeKernel validates the four loops; adopted domain Checks assess project-specific requirements; ChangeKernel controls acceptance and remembers why. Packs distribute domain evaluators, not another agent, automatic policy adoption or a replacement for backend validation. Show stage-specific backend requirements and adopted domain coverage distinctly, alongside desired outcomes, observed realization, related work, actionable failures, reuse/unready status and next permitted action.

Expose in-flight work, missing/redacted/truncated context and next permitted action. A checkpoint is not acceptance, a committed procedure is not real-world realization, and a lost response is not permission to retry an effect.

Conversation is one interface into the continuing [Change inquiry](change-trace.md), not its lifetime or only input. Ground free-form discussion in relevant Wiki, artifacts and history; distinguish user statements from inferred intentions and ordinary explanations from retained Check results and Evidence. No ceremonial submission phrase or finished brainstorming session is required, but an inferred proposal is not approved intent. Do not create a Change for every question, sentence or retrieved row.

Present the proposals pool with source attribution, exact checked versions, derivation relationships, unresolved questions and available user decisions. Async checking need not block conversation; pending or stale Check results must remain visible. The user clarifies, approves, rejects or defers Changes rather than manually performing Gate Checks or approving each Work unit. Filtering and rank cannot hide binding obligations or promote proposals into current Wiki.

Harnesses own prompt packing and in-run compaction, not semantic adoption. Wiki persists beyond model context. Procedural knowledge stays in Wiki; [bounded retrieval](evidence.md) need not load it all at once. Clients never receive raw writers, credentials or a bypass around protected effects.

Preserve ordinary Markdown/Obsidian workflows without mandatory proprietary authoring or plugins. Discovery must not execute source instructions, editor plugins or mutable repository-local ChangeKernel code.
