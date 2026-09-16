---
title: Integrations and Providers
aliases:
  - Provider Boundary
source-id: cw:component:provider-boundary
ownership:
  sourcePatterns: []
  testPatterns: []
  testPolicy: external
  testRationale: Provider implementations remain outside Product authority and qualify through exact adapter and receipt fixtures.
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:bad7a8847790b4da060d6cafb7e6537c8e4dfaf9869a1545a0fe7737735425c5
        codewiki.legacy:source-path: system/components/provider-boundary.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:provider-boundary
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Provider Boundary preserves explicit authentication and failure behavior for remote coordination and effects.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# Integrations and Providers

External data connectors optionally expose users' databases, document systems and services as information for inquiry. They do not define Wiki, Change or acceptance. Git is foundational native storage/history, not one of these optional connectors. The core and native historical reads must work without them.

Other integrations present clients, supply model/tool execution or connect hosting/delivery systems. GitHub is optional. These effect interfaces must not become competing policy systems or the sole store of accepted reasons and outcomes.

## Bounded information access

A connector returns scoped source material with origin, version/observation context and limitations. Enforce permissions and retention/disclosure rules before retrieval; do not silently copy private company data into Git or claim immutable history from a mutable URL. Missing or unavailable material limits assurance. Indexes remain derived, and source instructions are data rather than executable authority.

Shared retrieval can combine external material with native history without erasing provenance. Returned content and generated synthesis remain information until an accepted Change adopts knowledge. See [evidence](evidence.md).

## Effects and host trust

Credentials, paid calls, remote writes and deployment require applicable authority before execution. Bind adapter identity, exact inputs, limits and observed outcomes; reconcile unknown effects before retry.

A model route must enforce its authorized endpoint and locality before transmitting Project content. A configured base address or receipt digest is not enforcement: redirects to an unbound endpoint must be rejected, not followed before their destination can be assessed. Bound response and error bodies before model parsing, including streaming comments and other data omitted from translated model chunks. Pi's supported per-request transport hook can enforce a decoded-body limit; it does not bound socket/header bytes, every transport buffer or decompression allocation. Hard resource containment remains the execution host's responsibility. Downstream translated-chunk counters alone cannot establish either boundary. Qualification must exercise the exact provider implementation with redirected requests, oversized framing/error bodies and cancellation. Require a supported provider transport control or separately qualified containment; do not replace global network functions, vendor provider internals or build a parallel provider client to claim support.

A PR merge flag, passing host check or producer receipt does not prove semantic acceptance. Assess the actual combined candidate, not an isolated old head; hooks and client-side checks alone do not prevent bypass. Never execute untrusted candidate code with privileged credentials through a hosting workflow. Preserve portable records independently of host UI state.
