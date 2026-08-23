---
type: System Component
codewiki_id: cw:component:provider-boundary
title: Provider Boundary
description: Represents external Git, delivery, model, package, and collaboration services outside CodeWiki authority.
status: stable
tags: [system, component, external]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Provider Boundary preserves explicit authentication and failure behavior for remote coordination and effects.
---
# Provider Boundary

Provider Boundary represents Git hosts, delivery services, model providers, delegated Agent products, package registries, and collaboration platforms. Providers own networking, authentication semantics, credentials, billing, and provider-native state. CodeWiki owns user-authorized route policy, exact Run binding, receipt validation, freshness, expected-head policy, custody classification, and interpretation. Provider identity never grants Stage, Candidate, Check, Gate, transition, or effect authority.

The user authorizes one exact Harness route, inherited or overridden Decision, Planning, and Review producer routes, an independent Worker route pool, explicit Worker escalation transitions, exclusions, and budgets. Model Check routes remain separately owned by Check definitions and never inherit Harness or Worker policy. Project Server selects a Work Unit route only from the authorized Worker pool, records one Work Unit Model Assignment, and binds one exact provider, model, options, policy attempt, and Assignment digest to each Run. A model change occurs only between Runs and requires a fresh DSH Agent Session with canonical rehydration.

A private provider broker owns provider credentials, billing integration, provider networking, bounded transport retry or equivalent-endpoint failover, response normalization, and provider request IDs. DSH receives one opaque, expiring, Run- and route-scoped host-local capability rather than provider credentials or unrestricted egress. Unsandboxed qualification may use credential-free TCP loopback; a network-isolated outer Run Sandbox reaches the broker only through one explicitly mounted absolute Unix-domain socket, preserving network namespace denial. Each broker call returns authenticated evidence binding the broker implementation and configuration, exact request and response digests, selected provider and model, transport-attempt count, normalized usage, provider request ID, cancellation or typed failure, and receipt identity. Runtime records the validated receipt in Execution Ledger while trusted broker storage may retain the same receipt independently. Authentication, quota, and budget failures cannot be misclassified as capability problems; Project Server alone interprets typed outcomes and decides whether to rehydrate, select an authorized compatible route, escalate through an authorized transition, request user authority, or stop.

Personal model credentials remain in trusted provider storage, CodeWiki credential services, or existing delegated-product tooling according to the selected route. They never enter project files, prompts, DSH Agent Sessions, Check sandboxes, Workbenches, collaboration messages, broker receipts, or unrestricted child environments. External Agent Client credentials remain entirely external. Channel credentials remain Project Server-side. User Interfaces and channels receive redacted route and receipt metadata only.

NVIDIA NeMo Switchyard is an optional replaceable broker backend, not a CodeWiki authority or required routing layer. Initial qualification permits only an exact pinned build in loopback-only passthrough mode with Switchyard retries disabled, an exact configuration digest, and selected-target evidence equal to the Run route. Dynamic classifier, stage, escalation, and advisor routing remain unauthorized until separately benchmarked and proven to emit exact rewritten-request, selected-model, judge-call, usage, response, and cancellation evidence. Switchyard logs are operational observations and cannot replace CodeWiki receipts, Execution Ledger, Session continuity, or Change Trace.

Unavailable, unauthenticated, stale, contradictory, or malformed provider state cannot imply acceptance or weaken policy. Provider and channel content remains untrusted until bounded validation succeeds. Replay remains the mandatory deterministic CI route; credential-free host-local mock transport separately qualifies TCP-loopback and sandbox-mounted Unix-domain streaming, retry ownership, cancellation, route mismatch rejection, and evidence closure without committed credentials or mandatory paid calls.
