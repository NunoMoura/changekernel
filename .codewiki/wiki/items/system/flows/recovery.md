---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:flow:recovery","codewiki_relationships":[{"rationale":"Recovery provides the stable cross-component behavior required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}],"description":"Reconstructs authority and execution continuity from canonical state, retained DSH Sessions, and durable evidence without trusting private memory.","status":"stable","tags":["system","flow"],"title":"Recovery","type":"System Flow"},"codewiki.legacy:source-path":"system/flows/recovery.md"},"itemId":"cw:flow:recovery","itemType":"codewiki.legacy:system-flow","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:fe8878d3c3ceb7a1acd2310ce9f2dc429acb4d270a5815764b51012faa021f90","codewiki.legacy:source-path":"system/flows/recovery.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:flow:recovery"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Recovery provides the stable cross-component behavior required by this Story.","target":"cw:story:maintainer.recover-history","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Recovery"}
---
# Recovery

Recovery preserves exact authority and uncertainty. Project Server never infers a semantic transition from process exit, filesystem presence, provider status, elapsed time, model output, or partial receipt. It restores only facts proven by Git, append-only Trace, current Gates/Results, durable Work records, verified receipts, and explicit operator authority.

## Restart

On restart, Project Server reloads repository/config identity, canonical and managed refs, full Git ancestry, fixed Wiki/Trace blobs, Check Pack/Kernel Build policy, Gates, Check Runs/Results, durable Claims/Assignments, DSH Run and Plugin receipt references, protected-effect records, and private operational manifests. It validates object closure, append-only Trace prefixes, expected refs, and owner-private state before rebuilding WorkState, Work View, Alignment, and indexes.

Generated Views and caches may be discarded. Missing/stale indexes trigger exact Git fallback or explicit unavailable coverage. Project Server does not read meaning from opaque DSH internal Sessions or raw logs.

## DSH Runs and Checks

DSH owns internal Session recovery. CodeWiki sees one authorized DSH Run and requires a bound result/receipt or explicit operational stop. Changed semantic input, authority, role, route, tools, capability, Project/Change head, active Checks, or feedback creates another Run. A retry cannot inherit proposal, Work, Review, or Result authority from an incomplete process.

Completed Results remain reusable only when Gate, Check, implementation, exact subject/input, policy/resolver, route where relevant, and Evidence identities all match. Interrupted/stale Check Runs produce no Result. Eligible retry creates a new Check Run; unavailable capability, contradictory closure, or exhausted retry yields stopped Gate.

## Work and Git

Accepted planning facts in Trace reconstruct Work Units and dependencies. Git ancestry plus Trace reconstructs integrated Work results. Durable Claim/Assignment records prove custody; stale leases may be reclaimed only after process/effect closure. Orphan worktrees and private refs are quarantined until exact ownership is known.

A passing Work result integrates only under current expected Change tip. Review and Completion Commit require exact integrated tip and current canonical head. Crash between object creation and ref CAS is resolved from refs: unreachable objects grant no authority. Crash after verified CAS is recovered by replaying exact commit/Trace state without rerunning Agent or Check.

## Protected effects

Every external effect uses an idempotency-bound request and receipt. Unknown or partial provider outcome enters reconciliation; CodeWiki never speculatively repeats publication, push, release, deployment, deletion, or credential-sensitive operation. Local Change completion remains distinct from later Delivery state.

## Backup, restore, and rollback

Owner-private state backup stores canonical-project, Project-Server-private, DSH-private, and audit scopes separately with portable path, mode, size, and SHA-256 identity. Backup/restore never interprets or rewrites DSH internals. Restore requires stopped/quiescent services, repository identity match, complete verified closure, expected generation, and post-restore replay. Corrupt or foreign state is quarantined.

Operational rollback may restore exact refs and private state only within a qualified boundary and preserves append-only audit receipts. It does not erase accepted semantic history. Wrong accepted meaning requires a Superseding Change; recovered external effects remain reconciled, not forgotten.

Repository migration/upgrade is backup-first, exact-subject, and expected-state CAS. Unknown schema, mixed Wiki roots, path escape, symlink, drifted executable/Build, incomplete backup, or unsupported conversion fails closed. `.codewiki/runtime/**` and `.codewiki/views/**` are never recreated.

Backend-v1 Session Continuity, Run Request/Receipt, Runtime Build, private integration, and fault-recovery protocols remain accepted historical evidence only through explicit compatibility readers or internal adapters. They cannot dual-write, expose obsolete semantic owners, or upgrade old records by inference.
