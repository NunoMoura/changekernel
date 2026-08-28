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

Backend v1 Continuity `1.0.0` may resume across Runs. Target `2.0.0` closes each physical Session at its terminal producer Receipt. Same-Session recovery preserves the unreceipted Run semantic digest and all execution bindings; each dispatch has a new Request digest bound to retained raw log and repaired head. Cancellation or lease expiry removes authority but invents no Receipt.

A successor verifies predecessor head and Receipt, then freezes exact authority, Wiki, Trace, WorkState, Candidate, failed Gates and Results, Evidence, obligations, work lineage, capabilities, and context into Snapshot and Continuation `2.0.0`. Changed bindings require a fresh Session after valid closure. Missing terminal evidence enters `recovery_stopped`; only authenticated Ledger, raw-log, head, and quiescence repair may yield a stopped Receipt. Irrecoverable closure remains quarantined without waiver. DSH bytes or summaries never reconstruct project meaning.

DSH owns opaque Session and compaction mechanics and retains raw history. Backend v1 Compaction Summary remains current until cutover; the target retires it and permits DSH compaction only within one long in-flight producer Run, never for Model Checks or across terminal Runs. Exact canonical records and authorization-bound handles preserve feedback and continuity. Unsafe reduction stops; summary text is not recovery state.

Completed pass/fail Results remain reusable only when Candidate, Check, configuration, selected package input, Evidence, and execution identities match. Interrupted or stale Check Runs produce no Result and may receive one bounded fresh retry when eligible. Every Model Check retry uses a fresh isolated session. Exhausted retry, unavailable capability, contradictory receipt, incomplete material, or unverifiable effect becomes visible stopped state.

## State ownership

| Datum | Owner and class | External location | Recovery |
| --- | --- | --- | --- |
| Configuration, Knowledge, Traces, Check Packs | Named semantic owner; canonical meaning | Governed `.codewiki/**` roots | Replay and checkpoint verification |
| Raw Data manifests, payload, policy, and Receipts | Raw Data Intake; private custody | `projects/<id>/raw-data/` | Honor current policy; never restore retired payload |
| Backend State | Project Server; durable `codewiki.backend-state@1.0.0` generation head | `projects/<id>/state.json` | Exact backup only; quarantine corrupt bytes |
| Endpoint, token, ownership lock | Project Server; ephemeral process control | `project-server/process-control/` | Discard or quarantine stale generation; never back up |
| Session Continuity and leases | Project Server; durable expected-head journal | `project-server/continuity/` | Verify journal, lease, and Receipt CAS; resume or roll over |
| DSH Agent Session | DSH format with Runtime opaque-byte custody | `runtime/dsh-agent-sessions/` | Copy exact bytes and verify digest; never rewrite internals |
| Ledgers, Receipts, evidence | Runtime; durable authority evidence | `runtime/execution-evidence/` and typed stores | Require complete digest closure or stop |
| Assignment packets, Worker reports | Project Server admission and Runtime evidence | `project-server/worker-assignments/`, `runtime/worker-reports/` | Reconcile exact active Claim; never infer completion |
| Synchronization snapshots and Views | Project Server; derived projection | On demand or `project-server/synchronization/` | Recompute; discard stale cache |
| Workbenches and integration scratch | Project Server; disposable custody | `project-server/workbenches/`, `project-server/integration/` | Reconcile exact project/Claim/Plugin Receipt or recreate |
| Publication artifact and effect manifest | Runtime artifact custody and Project Server effect authority | `runtime/publications/`, `project-server/effects/` | Verify bytes and provider state before retry |
| Logs and temporary files | Producing Backend owner; disposable | `project-server/logs/`, `project-server/tmp/` | Bounded deletion; never authority |
| Backups and quarantine | Backend operator boundary; immutable digest manifest | `backups/<id>/`, `quarantine/<id>/` | Verify every file; protect referenced recovery points |

Recovery requires quiescence. Backend State `1.0.0` and backup `1.0.0` bind repository, generation, Build, four separate scopes, and every regular path, mode, size, and digest. Backup rejects links, unsupported types, limits, live process control, incomplete restore, and undeclared roots. Target Raw Data payload copies inherit policy: transient or absent payload is excluded and backup expiry cannot exceed `ttl`. Verification precedes deletion of oldest excess backups.

Restore binds current private State plus repository ID/object format, canonical ref/current commit, immutable backup tag/ref, scopes, Build choice, prior snapshots, and time. Migration status disables rename pairing: each NUL record has one prefixed path; paired paths are never parsed as records. Backend-v1 roots stage/exchange locally; target restores canonical Git only by stopped expected-current-ref CAS to an allowed backup commit and restores private scopes through one exact recovery transaction. Bytes verify before Receipt and generation advance. Backend v1 never rolls append-only audit backward. Target restore reconciles Raw Data policy/heads/Receipts and cannot reactivate expired, revoked, deleted, or retired bytes. Stale support stays stale; backup cannot accept Change or mutate Wiki. Old-Build/ref restore is allowed only before first later target-only accepted commit; afterward backup must preserve current accepted Git/Wiki/Trace history under target-compatible Build, or recovery repairs forward.

A corrupt Backend State manifest is never replaced with an invented empty manifest. Recovery requires an exact verified backup, expected corrupt-byte digest, and expected current canonical snapshot. Corrupt bytes enter immutable quarantine, private scopes restore from the backup, a recovery Receipt binds the operation, and the recovered state advances beyond the backup generation. Schema-less legacy `.codewiki/runtime/` and `.codewiki/views/` roots follow the same fail-closed rule: known durable paths copy to declared external owners, disposable paths remain available only in digest-bound quarantine, unknown or symbolic residue is rejected, and successful completion removes both local roots. Normal bootstrap, startup, synchronization, Workbench, Preview, publication, and Session operation never recreate them.

## Production fault closure

Backend Fault Recovery `1.0.0` closes crash, cancellation, timeout, quota, credential rotation, stale Session, Broker Host loss, filesystem corruption, orphan, and partial effect. Target calls provider boundary AI Gateway, durable stage sequence Work Continuity, and host boundary Execution Host. Runtime recovers only complete Evidence, proves cancellation closure, and terminates descendants. AI Gateway owns bounded transport retry/credential replacement; admitted CodeWiki Plugin reconciles only its scoped Request/effect. Project Server requests user authority, rolls Sessions, validates Receipts, and reconciles idempotent effects. No fault changes meaning, satisfies Completion Requirement, completes Change, fabricates authority, selects route silently, or repeats protected effect without exact proof.
