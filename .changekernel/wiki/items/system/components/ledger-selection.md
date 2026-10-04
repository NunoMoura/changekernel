---
title: Proposed Ledger Collection and Selection Profile
aliases: []
source-id: cw:component:ledger-selection
---
# Proposed Ledger Collection and Selection Profile

## Status and requirement authority

This page scopes the next consumed contract; it does not select wire formats, storage controls or an implemented profile. Implementation must wait for a complete, independently reviewed producer-to-consumer contract. Existing opening, intent-revision and assessment profiles remain unchanged.

The requirements come from the [foundation-first collection increment](../../product/plan.md#foundations-before-agent-integration), [ledger ownership](../../product/changekernel.md#ledger-change-files-and-derived-context), [working-set and archive boundary](state.md#ledger-working-set-archive-and-restore), [retry and durability requirements](state.md#record-replay-and-durability-requirements) and [authorized structured reads](state.md#structured-history-access-and-context-projections). These require explicit user-owned ledger operations, multiple independent Change identities, original creation-key resolution, bounded authorized listing/selection and reopening the selected Change. They confer neither folder-wide sharing nor cross-file transactions.

## Outcome and falsifiable proposition

An authenticated fixture owner can create two distinct intent-bearing Changes in one explicitly provisioned ledger, list an authorized bounded working set, select either stable identity and inspect its accepted intent from a fresh process. An exact original creation retry resolves the same original Change and result after restart or loss of the response, without another allocation or history entry. Selection and inspection perform no effects, evaluation or lifecycle append.

The proposition fails if creation retries produce another pursuit, selection resolves another Change, listing discloses an unauthorized member, missing acceptance control is reconstructed from plausible files, or a page hides incomplete validation as a complete collection result. Damage to one member must not silently become absence or erase its creation association; the contract must define which unrelated operations remain supported and where shared control damage necessarily blocks them.

## Supported scope and exclusions

Retain the trusted local Linux host, one authenticated owner, one fixed Workspace/binding, cooperative writer exclusion, independently supplied custody grants and declared filesystem assumptions. Use a model-free Rust library host and real disposable filesystem consumers; this is not an installed service, launcher, controller or qualified authentication system. No untrusted process receives custody descriptors. Predecessor exit and descriptor exclusion remain required before restart.

Start with stable flat logical identities and an active-only working-set View. This slice has no archive, restore, deletion, completion or disposition mutation; it must state exactly which accepted fresh Changes belong to that View. Directory placement cannot assert completion, ownership or permission. Supporting controls may have separate physical locations without becoming another lifecycle history.

Do not upgrade or enroll existing single-slot custody, import SQLite, copy historical traces into continuing custody or weaken old profile refusal. The [assessment profile](assessment-trace.md#concrete-reuse-boundary) is a reuse input, not an API that already supports arbitrary members: its current fixture pins the Change, custody and opening key. Select only the fresh successor behavior needed by this collection witness. Assessment policy must not become a prerequisite for creating or listing unrelated intent-bearing Changes; do not broaden Check execution in this slice.

Excluded: product agents, native effects, general query engines, relationships, multi-user sharing/transfer, remote custody, archive layout, workflow stages, origin/tip/range navigation beyond the selected inspection consumer, general context projectors, speculative indexes/caches, performance qualification, release activation and controller handoff.

## Contract that must be settled before implementation

### Creation and independent identity

Define closed creation input/result schemas, stable ledger/member/custody identities, independently supplied owner/Workspace association, exact text semantics and finite bounds. Decide whether the host supplies an explicit unused member identity or allocates one; describe its consumer and why that mechanism is sufficient. Client-supplied identity is a selector, not authority. Different accepted creations produce distinct members; independently provisioned ledgers do not accidentally share authority or retry state.

Define the creation-key namespace and full typed-input equality. Resolve an accepted or reserved original creation key before any new member allocation, provisioning, source access or effects. Preserve original attribution/result. Reusing a key with changed input conflicts; a later authorized caller does not acquire original authorship. Existing member operation keys retain their Change-wide meaning and cannot be silently reinterpreted as ledger creation keys.

Identify where the original creation-to-Change association is durably held, what selects its acceptance and how it agrees with the member's origin. Any indispensable reservation/acceptance association is custody control, not a rebuildable navigation index. Do not create a second authoritative lifecycle history. Define initialization, interrupted reservation/member provisioning/origin acceptance, lost response and exact retry against surviving evidence. No series of successful renames establishes a cross-file transaction. Missing or contradictory required grounds must refuse, not allocate another pursuit or guess from filenames. Detectable partial loss and complete indistinguishable evidence loss need different claims.

### Bounded authorized listing

Define closed list request/result schemas, deterministic order, page limit, cursor association/validation and termination semantics. Bound total inventory work, bytes read/decoded, response size and simultaneous buffers, not only the number of returned entries. A finite collection-cap fixture is permissible if explicit; a scalable or constant-cost claim requires later measured workloads.

Authorize the collection request before private lookup, then independently establish current permitted member metadata disclosure. Collection access and Workspace membership do not disclose every member. Define denied/unavailable member handling, whether counts/cursors expose identities and how final revocation suppresses a constructed response. Never report completeness when a required authorization or custody check was unavailable. Specify page behavior under intervening creation, damage and restart; do not imply a cross-file snapshot that the protocol cannot establish.

Return only consumed selection metadata and its exact accepted grounds. Specify treatment of reserved/unaccepted creations, blocked members, unknown inventory, duplicate/conflicting identities and missing member controls. A parseable origin or derived catalogue cannot substitute for acceptance control. Avoid decoding every complete member history as an unexamined permanent design; a bounded scan may be selected with honest costs for this fixture. Extra indexes require a measured consumer, not an efficiency label.

### Explicit selection and reopen

Select a stable Change identity under an independently established ledger/member association, not a caller-selected path. Reauthorize selection and historical disclosure even if listing previously returned that identity. Possession of a page, cursor or copied Trace grants no continuation authority.

Reopen the selected member with intact custody/acceptance controls and validate the accepted prefix. Define absent, denied, damaged, incident-blocked and competing-writer outcomes without leaking another member's private result. Retain the exact original intent, actor, creation request/result and accepted coverage. Inspection and reopening neither complete pending creation nor append, assess, move the tip or replay work; only the exact authorized mutation retry can complete its supported pending protocol.

### Shared custody and compatibility

Select one concrete lock/handle discipline and any shared creation controls. State which operations serialize and which independent members remain usable after a member failure. Shared control corruption may require broader refusal, but ordinary member damage must not justify an unspecified blanket quarantine. Neither per-member locks nor a ledger lock establish native application serializability or folder-wide sharing.

Specify fresh provisioning versus resume/reopen, permanent identities, temporary relationships, namespace/file barriers, acceptance-bearing acknowledgment and monotonic incident handling. Preserve uncertain evidence; no blind temporary promotion, tail truncation, re-enrollment or checkpoint reconstruction. Old profile APIs, accepted bytes, error precedence, wire tags and accounting meanings remain unchanged. New consumed schemas and work ceilings need their own explicit interpretation rather than relabeling R25 measurements as ledger performance.

## Acceptance evidence for the selected successor

The implementation witness must use real public typed dispatchers and filesystem custody, including a fresh process after confirmed predecessor exit:

- Create A and B with distinct identities and exact What/Why; list across a page boundary, select both and inspect their independent original grounds after restart.
- Retry A's original creation after B exists and after a lost response; return the same original result with unchanged accepted bytes and no new allocation. Changed typed input conflicts. Exercise creation-key scope across independently provisioned ledgers.
- Deny collection access, deny one member's disclosure, revoke after list/before selection and deny final delivery. Unavailable authorization is not denial, an empty page or fabricated absence. Challenge forged actor/approval/path fields, duplicate/unknown fields, foreign ledger/member/cursor associations and malformed/oversized inputs.
- Exercise consequential creation reservation, provisioning, origin and association acceptance cuts. Prove exact original recovery or specified refusal without a second identity. Challenge competing creators/writers, partial member loss, shared-control loss, duplicate identity/custody, accepted corruption, unaccepted tail and retained incidents. Preserve evidence on refusal and demonstrate the declared usability of an intact unrelated member.
- Exercise page and collection/byte capacity equality and overflow, stale/mismatched cursors, interrupted pagination and authorized selection independent of previous listing. Verify reads do not initialize missing custody or mutate history.
- Publish actual full-call read/decode/validation and buffer costs for the bounded fixture, including refusal/recovery. These are source observations, not RSS, physical disk traffic, CPU instructions, cold/warm scaling or release qualification.

Use locked native tests, formatting and all-target clippy under the repository testing policy. Independent review must inspect the exact submitted contract/source and real outcomes; manager acceptance releases dependent implementation only for the stated profile. Preserve historical lost-evidence, unexplained actor/mutation, tooling, cooperative-host and rollback limits. Source acceptance never establishes exact-host reboot/power-loss qualification, deployment or controller authority.
