---
type: System Flow
codewiki_id: cw:flow:recovery
title: Recovery
description: Reconstructs authority and execution continuity from canonical state, retained DSH Sessions, and durable evidence without trusting private memory.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.recover-history
    rationale: Recovery provides the stable cross-component behavior required by this Story.
---
# Recovery

Project Server reloads accepted Change Trace, accepted active Changes, accepted Change-scoped Work Graph deltas, synchronized Git facts, private integration lineages, configuration, current Pack Skill and Check files, jobs, Claims, Assignments, Workbenches, custody-scoped Run Receipts and Ledgers, retained DSH Agent Sessions, Gate receipts, and guarded effects. It deterministically rebuilds WorkState and Alignment and reconciles interrupted producers, workers, integration, Review, Checks, and effects by exact identity. Missing evidence never fabricates a Result, integration, completion, transition, or effect.

A logical producer continuity may resume its retained DSH Agent Session only under an exclusive Project Server lease and expected Session-head compare-and-swap. Project Server recovers Session Continuity `1.0.0`, rejects stale writers, and advances the head only from the lease-bound Receipt. Exact resume requires the retained Build, protocol, plugin closure, route, prompts, Skills, tools, snapshots, ledger, budgets, isolation, and custody. DSH Goal activation is process-local: Project Server authorizes one round per Run, Candidate output pauses it, and no model tool can complete it. Process lifetime does not define Session lifetime.

A Runtime Build or protocol change, corruption, repeated summary drift, role change, unrecoverable compaction lock, or qualified quality decline forces Session rollover. Project Server starts a fresh Session and injects deterministic canonical rehydration from current Change, Work Graph, Work Unit or aggregate lineage, Gate feedback, snapshot identity, and unresolved obligations. It never treats delegated-product memory, a conversation summary, persistent code heap, or ambient file as canonical truth.

DSH owns compaction event mechanics and retains exact raw history. Run Continuation `1.0.0` binds authority promotion, canonical rehydration, obligations, feedback, and predictive reserves. At resumed idle boundaries CodeWiki supplies deterministic Compaction Summary `1.0.0` projections and records exact replacement provenance; unavailable pressured reduction stops for rollover. It never compacts during open work or before Candidate freezing. Checkpoints are model-surface projections, not recovery prerequisites.

Completed pass/fail Results remain reusable only when Candidate, Check, configuration, selected package input, Evidence, and execution identities match. Interrupted or stale Check Runs produce no Result and may receive one bounded fresh retry when eligible. Every Model Check retry uses a fresh isolated session. Exhausted retry, unavailable capability, contradictory receipt, incomplete material, or unverifiable effect becomes visible stopped state.

## State ownership

| Datum | Owner and class | External location | Recovery |
| --- | --- | --- | --- |
| Configuration, Knowledge, Traces, Check Packs | Named semantic owner; canonical meaning | Governed `.codewiki/**` roots | Replay and checkpoint verification |
| Backend State | Project Server; durable `codewiki.backend-state@1.0.0` generation head | `projects/<id>/state.json` | Exact backup only; quarantine corrupt bytes |
| Endpoint, token, ownership lock | Project Server; ephemeral process control | `project-server/process-control/` | Discard or quarantine stale generation; never back up |
| Session Continuity and leases | Project Server; durable expected-head journal | `project-server/continuity/` | Verify journal, lease, and Receipt CAS; resume or roll over |
| DSH Agent Session | DSH format with Runtime opaque-byte custody | `runtime/dsh-agent-sessions/` | Copy exact bytes and verify digest; never rewrite internals |
| Ledgers, Receipts, evidence | Runtime; durable authority evidence | `runtime/execution-evidence/` and typed stores | Require complete digest closure or stop |
| Assignment packets, Worker reports | Project Server admission and Runtime evidence | `project-server/worker-assignments/`, `runtime/worker-reports/` | Reconcile exact active Claim; never infer completion |
| Synchronization snapshots and Views | Project Server; derived projection | On demand or `project-server/synchronization/` | Recompute; discard stale cache |
| Workbenches and integration scratch | Project Server; disposable custody | `project-server/workbenches/`, `project-server/integration/` | Reconcile exact Git/Claim identity or recreate |
| Publication artifact and effect manifest | Runtime artifact custody and Project Server effect authority | `runtime/publications/`, `project-server/effects/` | Verify bytes and provider state before retry |
| Logs and temporary files | Producing Backend owner; disposable | `project-server/logs/`, `project-server/tmp/` | Bounded deletion; never authority |
| Backups and quarantine | Backend operator boundary; immutable digest manifest | `backups/<id>/`, `quarantine/<id>/` | Verify every file; protect referenced recovery points |

Backend recovery runs only while the Project Server is quiescent. Backend State `1.0.0` and backup `1.0.0` identify one repository, exact source generation and Backend Build, four distinct scopes, and every regular file by portable path, mode, size, and SHA-256 digest. Canonical project meaning is never conflated with private Project Server control state, opaque Runtime custody, or append-only Backend audit. Backup rejects links, unsupported file types, excessive files or bytes, live process-control state, incomplete restore transactions, and undeclared roots. Retention verifies every candidate backup before deleting only the oldest excess entries.

Restore requires the exact current Backend State digest and canonical snapshot digest. It durably records the selected backup, scopes, build-activation choice, prior snapshot digests, and timestamp before replacing any managed root. Each root stages and atomically exchanges on its own filesystem, rolls back its current root on immediate replacement failure, and leaves the durable transaction on cross-root interruption. Exact resume may reapply only the same transaction; another maintenance operation remains blocked. Restored bytes and scope digests are verified before a restore Receipt is written and state generation advances. Rollback restores canonical, Project Server-private, and Runtime-private scopes but never rolls append-only audit receipts backward.

A corrupt Backend State manifest is never replaced with an invented empty manifest. Recovery requires an exact verified backup, expected corrupt-byte digest, and expected current canonical snapshot. Corrupt bytes enter immutable quarantine, private scopes restore from the backup, a recovery Receipt binds the operation, and the recovered state advances beyond the backup generation. Schema-less legacy `.codewiki/runtime/` and `.codewiki/views/` roots follow the same fail-closed rule: known durable paths copy to declared external owners, disposable paths remain available only in digest-bound quarantine, unknown or symbolic residue is rejected, and successful completion removes both local roots. Normal bootstrap, startup, synchronization, Workbench, Preview, publication, and Session operation never recreate them.
