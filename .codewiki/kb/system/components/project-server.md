---
type: System Component
codewiki_id: cw:component:project-server
title: Project Server
description: Owns transport, AuthN, project AuthZ, canonical state, Stage Loops, Workbenches, transitions, effects, and one subordinate Runtime for a governed project.
status: stable
tags: [system, component]
codewiki_component: cw:component:project-server
codewiki_source_patterns: ["src/project-server/**", "src/git/**", "src/utils/**"]
codewiki_test_patterns: ["tests/project-server/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Project Server keeps accepted work reachable, authorized, recoverable, and safely progressing.
  - type: realizes
    target: cw:story:maintainer.account-for-drift
    rationale: Project Server classifies every observed Candidate and Git state by positive provenance proof.
---
# Project Server

Project Server is the sole authoritative semantic control plane and long-lived owner for one governed project. It combines the former protocol edge and project control plane: transport, authentication, project authorization, canonical project state, Stage Loops, Checks, Workbenches, transitions, guarded effects, and recovery share one owner. Each Project Server owns one subordinate Runtime for bounded execution. Runtime cannot authorize project operations or mutate canonical state.

A CodeWiki process may host several Project Servers behind one shared listener. The listener performs only connection acceptance and project lookup; it is not a semantic Gateway and owns no identity, policy, project state, or lifecycle. Client disconnection never stops accepted work.

## Request boundary

Every request follows one fixed order:

```text
Client transport
  -> Project Server AuthN
  -> Project Server project AuthZ
  -> command or query
  -> optional Run Request to Runtime
  -> Run Receipt
  -> Candidate admission and deterministic materialization
  -> Checks, Gate, confirmation, and transition
```

Authentication proves the Actor connecting now. Pairing durably enrolls one Client installation for one Actor. A Client Session represents one temporary authenticated connection. Project authorization independently decides whether that Actor may perform one exact project operation. Pairing, Client kind, repository access, job title, model identity, and transport never imply project authority.

AuthN remains a narrow internal component rather than a separately deployed service. Local mode verifies ephemeral local proof and stable private identity mapping. Team mode may use provider-neutral OIDC adapters. Trusted adapters own authorization-code exchange, PKCE, redirect validation, discovery, signature, algorithm, and key checks before returning bounded claims. Project Server derives stable identity only from immutable issuer and subject. Credentials never enter project files, Run Requests, model context, Pairing records, or Runtime state.

Client Sessions use digest-only credential bindings, bounded lifetimes, rotation, revocation, generation compare-and-swap, and endpoint policy that never receives raw credentials. AuthN, Pairing, Client Sessions, repository-access observation, and project AuthZ remain distinct internal responsibilities. Browser App requests use secure same-origin, `HttpOnly`, and `SameSite=Strict` session handling; installed CLI, Pi, and MCP Clients require explicit enrollment according to policy.

## Project authority

Project Server owns Actor and delegation binding, idempotency, identity, admission, time, digests, freshness, compare-and-swap, provenance, stable Knowledge identity and transition compilation, Candidate attempts, accepted active Changes, canonical Work Graph, scheduling, Claims, Assignments, private Change integration, persistence, recovery, transitions, and effects. It authorizes the accountable Actor, not the Client, Runtime, or executor.

Git owns content-addressed artifact history. A commit, branch, pull request, author, trailer, note, or provider status may identify Evidence or part of an immutable subject; none is a lifecycle transition by itself. External Git state is captured without changing accepted head and receives no inherited execution proof. Divergence pauses guarded effects; Project Server never silently adopts, overwrites, discards, or certifies it.

Project Server invokes exactly four Stage Loops under `src/loops/**`: Decision, Planning, Implementation, and Review. Checks separately owns Check Packs, Results, coordination, and Gate Reports. Stage Loops own subjects, Candidates, attempts, and feedback meaning. Project Server owns Project Context Snapshot `1.0.0` construction, authorization, retention, and idle refresh; it freezes separate Gate Evaluation Packages for Checks.

Project Server applies one fixed authority model with Work Unit-granular Implementation:

```text
Decision approve passed + exact-Candidate confirmation + Knowledge/WorkState CAS -> atomically apply Knowledge Effects -> Planning
Decision reject | defer | withdraw passed + confirmation                           -> typed terminal/deferred state without Knowledge mutation
Decision failed                                                                  -> Decision
Planning delta passed + Work Graph CAS                                            -> Implementation
Planning failed                                                                  -> Planning
Work Unit Implementation passed                                                   -> integration pending
Work Unit integration stale | conflicted                                          -> same Work Unit Implementation
All required Work Units passed + integrated                                       -> Review
Review passed                                                                     -> separately guarded delivery
Review failed: unit defect                                                        -> affected Work Unit Implementation
Review failed: decomposition defect                                               -> explicit Planning amendment
Review failed: meaning defect                                                     -> Decision
Any Gate stopped                                                                  -> preserve state and stop attempt
```

Gate pass means the exact Candidate meets current Checks; it is not semantic acceptance, integration, or delivery. Before immutable Change revision identity, Project Server expands any revision-authoring context handles. Before a Decision Gate, it resolves the revision's stable Knowledge targets, validates expected prior state or absence, and compiles the complete `set | retire` Effect set. Candidate and Gate package bind base and projected Knowledge, compiler, plan, and projection identities. Compilation failure rejects admission before Checks.

An authorized Actor confirms the exact passed Decision Candidate and Gate digest against current WorkState, Knowledge, and `acceptedActiveChanges` heads. Confirmed `approve` atomically records the Change, applies its compiled Knowledge transition, commits resulting heads, and advances to Planning. Planning applies only a Change-scoped Work Graph delta. Work Unit pass advances only that unit; all required units must integrate before Review. Review Attempt `4.0.0` binds current aggregate, Knowledge, Planning, Candidate, Gate, Evidence, Result, Project Context Snapshot, Session, and Run identities. Project Server owns typed failure routing. Only a current passed Review plus Delivery Authority `1.0.0` may target-head-CAS protected Git and record `delivery.applied`. Checks, Runtime, and models cannot perform transitions or effects.

## Runtime ownership

Project Server authorizes immutable Run Requests and validates returned Run Receipts against persisted attempts or Assignments before Candidate admission. Runtime owns bounded Run Process mechanics only, never project meaning, retry, admission, Results, Gates, transitions, Workbench custody, effects, or canonical storage. Project Server reconstructs pending work from canonical state and durable receipts after restart.

Only Implementation uses Workbenches. For each ready unit, Project Server matches Offers and policy, then CAS-binds one Claim, Assignment, source base, lease, and isolated Workbench. Runtime and generic mutation expose no Claim, queue, placement, or integration authority. Project Server admits exact fresh passing Candidates through `integration.candidate_admitted`, lineage-head CAS, and dependency, custody, and byte checks. Git stores private commits and trees, Change Trace stores receipts, and WorkState derives Private Change Integration Lineage `1.0.0`. `implementation.aggregate_frozen` records Aggregate `1.0.0` only after all-unit and acceptance coverage; no per-unit protected merge occurs.

## Custody and recovery

Controlled provenance requires exact persisted custody appropriate to the stage. Backend-owned custody adds a complete Run Receipt and CodeWiki-controlled Execution Ledger. Backend-delegated custody binds exact dispatch, delegate identity, configuration policy, process lifecycle, Workbench when applicable, final output, admitted artifacts, and explicit unknown child internals. External-client provenance binds only authenticated CodeWiki operations and any admitted Workbench custody. Candidate-supplied receipts or Gate claims are untrusted.

On restart, Project Server reloads accepted Knowledge State checkpoints, Change Effects and Trace, active Change revisions and relationships, accepted Change-scoped Work Graph deltas, synchronized Git facts, configuration, current Skills and Checks, jobs, Claims, Assignments, private integration lineages, Workbenches, Run Receipts and Ledgers, Gate receipts, and guarded-effect records. It verifies that the initial Knowledge seed plus globally ordered confirmed Effects reduce to the checkpointed Knowledge State, then deterministically rebuilds WorkState and Alignment. It reconciles interrupted work by exact identity and never fabricates a Knowledge transition, Result, integration, completion, or lifecycle transition when authority or execution evidence is missing.

The supported operational package surface is `src/project-server/index.ts`, published as `@nunomoura/codewiki/project-server`. Its public API exposes bounded commands, queries, operations, and events. Internal coordination remains under `src/project-server/coordinator/**`; this implementation detail is not a second product owner. Project Server imports no DSH, Cordis, or delegated-harness implementation; those remain behind Runtime contracts.
