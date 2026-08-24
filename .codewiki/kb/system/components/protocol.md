---
type: System Component
codewiki_id: cw:component:protocol
title: Client-Project Server Protocol
description: Defines transport-neutral Client and Project Server commands, queries, operations, events, pairing messages, bounds, and normalization.
status: stable
tags: [system, component]
codewiki_component: cw:component:protocol
codewiki_source_patterns: ["src/protocol/**"]
codewiki_test_patterns: ["tests/protocol/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:agent.retrieve-bounded-context
    rationale: Protocol supplies bounded snapshot-bound project queries.
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Protocol supplies typed idempotent access to authoritative Project Server operations.
---
# Client-Project Server Protocol

Protocol defines stable typed commands, bounded queries, durable operation responses, projected events, pairing messages, envelope limits, transport contexts, and exact normalization through `codewiki.client-project-server@1.0.0` and `codewiki.client-pairing@1.0.0`. Project Server transports and Clients use the same contract; no binding invents independent commands or lifecycle state.

The browser-facing subset is frozen as Frontend API `codewiki.frontend-api@1.0.0`, capability document `codewiki.frontend-capabilities@1.0.0`, and event protocol `codewiki.frontend-events@1.0.0`. Every `/api/v1/**` endpoint requires Project Server session authorization and binds the supplied Actor, App Client, delegation, and repository identity to the authenticated request context. Capability discovery advertises only `codewiki.app-state.read`, `codewiki.changes.read`, `codewiki.configuration.read`, `codewiki.decision-attention.read`, `codewiki.decision.select`, and `codewiki.projection.invalidated`. Unknown names fail closed; private dashboard and lifecycle routes outside `/api/v1/**` are not Frontend API compatibility surfaces.

Request context keeps accountable actor identity separate from Client transport identity. `actorId` and `authenticatedIdentityRef` answer whom Project Server authorizes. `clientKind`, `clientInstanceId`, and `authenticationRef` answer how the request arrived. `delegationRef` records an explicit grant when an Agent or service acts for an actor. A Client is never itself the actor and cannot silently inherit actor authority.

Command envelopes bind repository identity, target, expected digest, actor-scoped semantic idempotency key, expiry, requested capability, and bounded payload. Payloads cannot supply identity, authentication, delegation, authority, Project Server time, Gate outcome, Check Result, or effect receipt. Accepted asynchronous commands return durable operation identity. Project Server transport deduplication is scoped to Client instance and transport request, while Project Server semantic idempotency is scoped to actor and complete command meaning; changing Clients does not change accountable command identity.

Queries and events identify exact snapshot and query digests, source references, deterministic ordering, provenance, coverage, unknowns, truncation, cursor position, query-engine identity, staleness, and redaction. One bounded declarative batch may combine independent stage-context reads without weakening per-item limits or provenance. Frontend event delivery is at-least-once and idempotent by stable event identity, ordered by ascending cursor, and resumed by exact generation plus `afterCursor`. Generation drift or a journal gap returns an empty reset batch at the latest cursor and requires fresh bounded snapshots rather than guessed replay. Frontend events expose projection invalidation only; internal messages, Client IDs, transport idempotency keys, raw DSH state, credentials, provider secrets, canonical storage handles, and chain-of-thought are omitted.

Stage submission binds exact project, stage, subject, Change revision, expected WorkState, context snapshot, Candidate digest, producer-custody class, and actor-scoped idempotency. Confirmation binds one already-passed exact Candidate and Gate digest plus current authority and expected state; editing the Candidate requires a fresh Gate. A payload cannot assert a trusted Backend-owned or delegated Run Receipt, Gate outcome, lifecycle transition, canonical time, or delivery authority. Protocol delegates semantics and authority to owners and never becomes a scheduler, store, Check runner, Stage Loop, or execution engine.

Frontend errors use the fixed `authentication_required | authorization_denied | conflict | expired | internal | invalid_request | payload_too_large | rate_limited | stale_snapshot | unavailable | unsupported_capability` taxonomy. Unknown failures receive generic copy; stack traces and provider or credential material never cross the boundary.

Only shared Client-Project Server wire contracts belong under `src/protocol/**`. Change Trace, Evidence, Checks, registry persistence, Project Server API, and MCP binding protocols remain with `src/changes/trace/**`, `src/evidence/**`, `src/checks/**`, `src/project-server/registry/**`, `src/project-server/**`, and `src/project-server/mcp/**` respectively. This keeps Protocol from becoming a miscellaneous schema directory.
