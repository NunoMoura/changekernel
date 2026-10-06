---
title: Linux and Btrfs Ledger Continuity
aliases: []
source-id: cw:component:ledger-continuity
---
# Linux and Btrfs Ledger Continuity

## Authority and selected outcome

The [first dogfood target](../../product/plan.md#first-dogfood-target-and-initial-sharing-scope) is a trusted local Linux/btrfs host. This page selects user-facing continuity requirements for a source-informed custody successor. It does not yet select a persistent identity mechanism, public API, wire/control version or migration. Existing [ledger-history](ledger-history.md) and [historical profiles](native-profiles.md) retain their exact meanings. Source implementation requires a consumed, independently reviewed contract; deployment and exact-release qualification remain separate.

An independently provisioned user-owned ledger must retain the same Changes, originating ownership, attribution, exact accepted histories, intent/assessment applicability and original request/result associations across clean process restart and ordinary reboot or supported remount at the same configured namespace. Authorized historical reads must not start Work, append assessments, repair anchors or adopt another copy. A useful supported successor must reopen the actual original custody rather than refusing every post-reboot ledger.

## Obligations before mechanism selection

1. Separate persistent filesystem/object identity and independently protected custody association from live descriptor/mount/device observations. Do not assume a volatile identifier is persistent, or substitute a path, label, byte hash or inode alone as proof of authority.
2. Preserve independent grant/owner/Workspace binding, no-follow namespace validation, actual object type/handle identity, current authorization, permanent writer exclusion, accepted-prefix controls and mandatory durability/recovery barriers. A more available reopen path must not turn copied or replaced material into continuing authority.
3. Establish what a supported btrfs primitive actually identifies and requires: filesystem/subvolume/object scope, lifetime, snapshot/clone behavior, inode reuse, hard-link/alias treatment, privilege and failure conditions. Unsupported or ambiguous identity must refuse without private delivery or cleanup.
4. Preserve exact accepted bytes and original-key results. A successor may not reinterpret old tags or silently rewrite old anchors. Any changed identity/control interpretation needs an explicit version boundary and fresh fixture; migration and old-custody repair are not implied.
5. Retain incidents, pending acceptance, unaccepted tails and unknown outcomes under their existing honest meanings. Correct identity is not proof of intact acceptance control or absence of prior effects. No local mechanism can detect complete rollback of all protected evidence from identical surviving bytes alone.
6. State the supported host/storage and threat assumptions. Compromised trusted hosts, hostile same-privilege processes, arbitrary filesystem image cloning, complete evidence rollback, storage repair, remote/network filesystems and unqualified snapshot restoration are not covered by an ordinary-reboot witness.

The historical changed-device observation motivates investigation but does not establish its cause or demonstrate an SDK reopen failure. Source analysis, documented kernel semantics, current mount inspection, a fake identifier or a clean-process test cannot substitute for actual ordinary-reboot/remount qualification of the eventual exact subject.

## Required consumer and failure boundary

The minimal consumer remains model-free: fresh provision, create a Change, directly revise intent, execute the trusted deterministic Check, obtain bounded current/historical Views, exit, then reopen with current authorization and retry the original keys. The same retained references and results must remain observable without new accepted operations. Separate ledgers must remain isolated even when printable Change names are equal.

Consequential negative cases include wrong grant/owner/Workspace; changed namespace or original object; copied custody presented as continuation; missing/replaced lock, control, anchor or accepted bytes; unauthorized read; malformed/unsupported identity; unresolved incident/pending proof; concurrent contender; stale or changed-key request. Select concrete native regression cases against the chosen mechanism rather than tests of documentation wording or file inventories.

Read-only sharing follows the [State disclosure boundary](state.md#git-sharing-and-encryption). It does not transfer ownership or active custody, merge logs, reinterpret the source-ledger namespace or permit effect replay. A positive cross-owner sharing interface and multi-tenant isolation are separate consumed capabilities, not prerequisites to closing this continuity contract.

## Mechanism and evidence still to settle

A proposal must identify one concrete native identity strategy, its exact supported Linux/btrfs requirements, storage/control mapping and producer-to-consumer use. It must enumerate every affected persistent and live identity comparison in the retained source, name required compatibility decisions, and define bounded success/refusal and interruption cases. If an unprivileged useful strategy cannot satisfy the selected guarantees, expose that blocker for product/safety selection rather than silently adopting privileged setup or weaker copy acceptance.

Normal source development may review code and public kernel/btrfs documentation. Actual host reboot/remount, loop devices, snapshots, namespace/VM setup, privileged commands and release qualification need separately scoped authorization. Qualification uses newly provisioned disposable external projects and isolated Pi settings, never the mutable checkout as controller or historical experiment custody as a repaired fixture.
