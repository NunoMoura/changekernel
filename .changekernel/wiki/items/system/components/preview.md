---
title: Preview
aliases: []
source-id: cw:component:preview
ownership:
  sourcePatterns:
    - src/adapters/preview/**
    - src/ports/preview.ts
  testPatterns:
    - tests/adapters/preview/**
    - tests/ports/preview.test.mjs
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:9e4351b072b6500fa46d5cfb002e1ebee78a1a7ac2c6c99993b17c673bd10353
        codewiki.legacy:source-path: system/components/preview.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:preview
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Preview supplies the System responsibility required by this Story.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
---
# Preview

Preview is an optional bounded observation method for a Change, not a stage, acceptance authority, or general-purpose runtime. It can help a person or Agent inspect a candidate, but a demonstration is evidence only about its exact subject and observed conditions.

Bind the artifact/workspace, environment, generation, allowed consumers, expiry, output and resource limits before execution. Reject stale or substituted observations. Observing a candidate's UI or procedure does not establish broader correctness, authority, deployment, or real-world adoption.

Preview must enforce its declared process, filesystem, credential and network scope, then observe cancellation and quiescence. A worktree or callback receipt alone does not prove containment. If required enforcement or custody cannot be established, Preview is unavailable; absence of that optional capability need not prevent unrelated knowledge work.

Leases, processes, URLs, caches and scratch remain private runtime state. Preserve bounded useful evidence under appropriate disclosure rules, not a second source of accepted truth. Shareable or remote previews require separate applicable authority and effect reconciliation. See [integrations](provider-boundary.md) and [recovery](../flows/recovery.md).
