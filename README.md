# CodeWiki

CodeWiki is an intent-first Git workflow for Agentic teams.

It lets collaborators commit shared meaning before implementation begins, then verifies that one exact Project snapshot realizes that meaning.

```text
user intent
  -> Proposed Change
  -> semantic Decision
  -> Change Commit
  -> planned and checked realization
  -> Change Completion Commit
  -> optional Delivery
```

The Change Commit is the semantic merge. The Change Completion Commit is the reviewed artifact merge. Git stores complete Project snapshots and ancestry. Wiki stores accepted meaning. Change Trace stores why, who, lifecycle facts, Results, receipts, and exact object IDs.

CodeWiki does not promise perfect model judgment. It provides bounded process integrity: stable identity, authenticated authority, exact subjects, independent Checks, deterministic Gate reduction, compare-and-swap, explicit uncertainty, durable provenance, and recovery.

## Current posture

CodeWiki is private pre-production software. Package `@nunomoura/codewiki@0.3.0` is unpublished and retains `"private": true`.

Backend v1 and Semantic Kernel SK0/SK1/SK2 passed external exact-subject qualification. SK2 migrated this repository at `7b4e5e9021b27ff09f6f93569bb2a93c1fb0ebdf`. SK3A's exact desired-state Wiki and roadmap were qualified, authorized, admitted, and activated at `927e21f863ca954ba7826d771b8556dfe236827e`.

Current truth boundaries:

- `.codewiki/wiki/**` and `.codewiki/changes/**` — accepted semantic and lifecycle truth;
- `src/**` and `tests/**` — executable truth;
- Git — exact Project bytes, history, ancestry, refs, and checkpoint evidence;
- external owner-private state — DSH/Preview internals, credentials, caches, leases, sockets, worktrees, and raw execution evidence;
- generated Views — rebuildable, never source truth.

`.codewiki/kb/**`, `.codewiki/traces/**`, `.codewiki/runtime/**`, `.codewiki/views/**`, and generated indexes below `.codewiki/wiki/**` must remain absent.

The Wiki defines desired stable behavior, while source and tests define current executable behavior. `SEMANTIC_KERNEL_PLAN.md` is the sole active refactoring roadmap, status ledger, and archive checklist between those states; README does not duplicate its progress claims.

## Ownership

```text
Clients / CodeWiki App / external Agents
                 |
   authenticated Product UAPI (Kernel API)
                 |
          Project Server
   /          /          |          |          \
Semantic  Project     Check      Agent       Preview
 Kernel   Store port  Runner port Runtime port port
             |           |          |           |
        Git adapter Check adapter DSH adapter Preview adapter
                                  |
                            Execution Host
```

- **Semantic Kernel** owns deterministic canonical validation, identity, Wiki/Change/Work/Gate/Evidence mechanisms, reductions, and transition preconditions.
- **Project Server** owns Actor authorization, Change lifecycle, Gate coordination, Work admission, protected-effect authorization, and recovery. Every managed Git write runs through Project Store.
- **Git Project Store** owns complete trees, commits, ancestry, canonical first-parent history, managed Change refs, and expected-old-OID compare-and-swap through its port/adapter boundary.
- **Wiki** owns accepted descriptive, historical, and normative Project meaning through stable Wiki Item IDs.
- **Change Trace** owns rationale, contributors, lifecycle events, Work facts, Results/receipts, and exact Git OIDs.
- **Checks** judge one exact stage subject. Change type and subject facts deterministically select Gate active Checks from exact stage Pack snapshots.
- **DSH** implements the Agent Runtime port and owns Agent execution mechanics, internal Sessions, models, tools, AI/model providers, and compaction. CodeWiki authorizes exact DSH Runs and validates receipts.
- **Preview** is a separate bounded capability and port. `preview.work` gives one Worker producer feedback; `preview.verify` captures independent exact-subject observations for Checks. Preview grants no Result or lifecycle authority.
- **WorkState, Alignment, Dictionary, search, backlinks, history, and attribution** are derived Views.

No Agent, Client, Check, provider, Plugin, or project file directly writes managed refs or grants lifecycle authority.

## Work and project control plane

Backlog is a derived view over persisted pending Change revisions; it grants no selection, Check, or lifecycle authority. Project Server derives current Work from exact Git and Trace owners.

### Change model

One Change has one stable ID, one append-only Trace, and one managed ref:

```text
.codewiki/changes/TRACE-CHG-<id>.jsonl
refs/codewiki/changes/<id>
```

Every revision is a full Project snapshot. Persisted states are Proposed, Committed, Completed, Rejected, Deferred, and Withdrawn. Accepted corrections use a Superseding Change; history is never rewritten.

Every proposal declares exactly one Change type and one realization route:

```text
changeType: capability | correction | maintenance | policy | investigation
realization: wiki-only | project
```

A true Wiki-only Change completes in its Change Commit. A project-realization Change continues through Planning, independently gated Work Units, explicit reconciliation with current canonical history, Review of the exact prospective Completion project-artifact tree, and Change Completion Commit. Operations embedded in a commit use a fixed `containing_commit` marker; native Git context supplies that commit's OID.

CodeWiki retains exactly four stages:

```text
Decision -> Planning -> Implementation -> Review
```

All four retain project-owned Check Packs. Gate itself freezes exact subject, Pack identities, type-conditioned active Checks, declared inputs, resolver identity, and digest. Each execution attempt is a Check Run; completed Runs may yield immutable Results.

## Wiki

Wiki Item is the sole first-class semantic unit. Stable `itemId` establishes identity; path, title, alias, term, Git OID, and model output do not.

Definition Items and Claim Items are typed Wiki Items, not peer stores. Dictionary, graph, lexical, vector, history, attribution, and semantic-diff facilities are read-only Views over one exact commit or Proposed Change tip. Approximate retrieval finds candidates only; it never establishes identity, truth, or authority.

The active Wiki contains 47 Items under readable `product/**` and `system/**` paths. Stable `itemId` and Git rename history preserve identity; paths remain non-authoritative navigation hints.

## Agent boundary

Every CodeWiki-controlled Agent runs through DSH with:

- immutable Product-fixed role instructions supplied as validated Kernel input;
- exact Project/Change/stage subject;
- mandatory relevant Wiki Items and Definitions;
- bounded snapshot-fixed Wiki and status tools;
- role-specific capability and writable scope;
- one exact DSH Run/idempotency identity and receipt;
- independent stage Checks.

Decision may propose Wiki changes. Planning maps Work Units to committed targets. Workers modify project artifacts only and may receive an explicit scoped `preview.work` handle. Review compares the reconciled prospective Completion tree with committed meaning. Model Checks receive only Gate-declared inputs and may consume prior immutable `preview.verify` Evidence; they cannot launch Preview or inherit Worker observations.

## Repository rules

- Never load CodeWiki from this checkout, a mutable package path, or this repository's `.pi/` directory.
- Dogfood only an immutable release that passed external exact-subject qualification and explicit activation.
- Immutable released Product N qualifies exact committed candidate N+1 in a disposable external project.
- Release activation does not automatically promote a semantic controller; controller handoff requires explicit quiescence, backup, qualification, human authority, and zero overlap.
- Every correction after candidate freeze requires a new candidate, qualification, approval, and activation.
- Use Pi-native tools and compaction as independent repair paths.
- Do not add project-local CodeWiki links, duplicate Skills, controller pins, or executable Plugin paths.
- Keep credentials, DSH state, generated Views, caches, and runtime scratch outside project Git.
- Fully exit and restart Pi when changing an activated packed artifact; never hot-switch a mutable package.

See [`AGENTS.md`](AGENTS.md) for repository-agent constraints.

## Development

Requirements:

- Node.js `>=22.19.0` for package tooling; Agent Runtime support is exact-build qualified rather than inferred from this floor;
- Product and adapter builds emitted to `dist/**`;
- exact DSH/Execution Host combinations qualify before Agent-capable release;
- external smoke tests use disposable projects with isolated Pi settings.

Core commands:

```bash
npm run typecheck
npm run build
npm test
npm run test:production
npm run test:pack
npm run test:readiness
npm run diagnostics:ratchet
npm run audit:codewiki
```

Do not run packed lifecycle tests against this source checkout.

## Documentation

- [Semantic Kernel refactoring plan](SEMANTIC_KERNEL_PLAN.md) — sole active roadmap, completion ledger, and archive checklist
- [Backend v1 plan](BACKEND_V1_PLAN.md) — completed historical evidence
- [Refactoring plan](REFACTORING_PLAN.md) — completed historical evidence
- [SK0 contracts](SEMANTIC_KERNEL_SK0_CONTRACTS.md) — qualified historical contract freeze
- [System architecture](.codewiki/wiki/items/system/diagrams/system-architecture.md)
- [Semantic Kernel](.codewiki/wiki/items/system/components/semantic-kernel.md)
- [Change lifecycle](.codewiki/wiki/items/system/flows/change-lifecycle.md)
- [Wiki](.codewiki/wiki/items/system/components/wiki.md)
- [Change Trace](.codewiki/wiki/items/system/components/change-trace.md)
- [Checks](.codewiki/wiki/items/system/components/checks.md)
- [Project Server](.codewiki/wiki/items/system/components/project-server.md)
- [DSH Run Execution](.codewiki/wiki/items/system/components/dsh-run-execution.md)
- [Preview](.codewiki/wiki/items/system/components/preview.md)
- [Alignment](.codewiki/wiki/items/system/components/alignment.md)
