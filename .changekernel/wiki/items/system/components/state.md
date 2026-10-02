---
title: State and Persistence
aliases: []
source-id: cw:component:state
ownership:
  sourcePatterns:
    - .changekernel/config.json
    - src/adapters/git/**
    - src/adapters/sqlite/**
    - src/ports/container_intake.rs
    - src/ports/continuation.rs
    - src/ports/source_observer.rs
    - src/application/intake.rs
    - src/application/source_observation.rs
    - src/kernel/containers/**
    - src/kernel/state/**
  testPatterns:
    - tests/adapters/git/**
    - tests/adapters/sqlite/**
    - tests/kernel/containers/**
    - tests/native_intent_revision.rs
  generatedViews:
    - alignment
    - dictionary
    - wiki-attribution
    - wiki-graph
    - wiki-history
    - wiki-search
    - wiki-semantic-diff
---
# State and Persistence

This contract defines the core State/evidence and JSONL custody obligations. [The plan](../../product/plan.md) selects when a capability must prove them. The first profile uses a trusted host, one authenticated user, one binding and a bounded operation. Multi-user sharing, autonomous workers and generalized discovery are later capabilities, not implicit prerequisites.

Native values, desired obligations, observations, candidates and research claims have different meanings. State is scoped and version-/time-bound; it is not necessarily a complete snapshot. A failed or uncertain operation must not produce an invented after-State. Existing systems begin from an acknowledged baseline. Confirmed effects and reconciled external changes explain subsequent State without fabricating earlier intent.

## One authoritative current representation

Native resources remain authoritative in place. The engine can retain observations, versions and evidence needed for decisions and recovery, but does not maintain an independently writable mirror of all application State. Derived lifecycle views are reconstructed from accepted Change history. Cache lifetime and representation do not create authority.

Observe the relevant authorized scope. A schema does not prove that records exist, a pathname does not prove stable resource identity, and a desired value does not prove an effect occurred. Binding declarations identify native operations, constraints, subject/version identity, point-of-use authorization, concurrency limits and result evidence. Preserve the exact interpretation required for historical actions.

### Native authority and delegated access

Native resource rights, current delegated scope and Change authorization are conjunctive. The qualified host supplies authenticated context independently of request fields; the binding establishes the native operation it actually performs. No privileged retry, broader broker identity or cached permission Boolean may substitute for that operation's required authority.

For the first trusted-host profile, the declared host and its integration are inside the trust boundary. Protection from compromise of that host or hostile same-privilege processes is not claimed. The host still must protect custody from its ordinary untrusted inputs and prevent alternate client API routes from bypassing its contract. Do not run arbitrary untrusted code with custody authority.

### Native enforcement and source-result evidence

Each binding must state who obtains an observation, under which native authority, for which exact resource/version, and how the engine can rely on the result. Clients and workers cannot authenticate evidence by attaching a digest to their own claims. Trusted adapters may return authenticated native observations; untrusted output remains a proposal until checked by an appropriate authority.

Separate observation, candidate preparation, publication and Trace acceptance. Observation does not lock out other writers. Writable preparation does not authorize publication. A native operation result does not itself append accepted history. A valid Trace cannot make an unsupported native guarantee true.

The previous faithful-original-thread helper, account enrollment and hostile same-account protection requirements belong to the [deferred standalone host investigation](../research.md#deferred-host-profile-evidence). Their counterexamples remain valid. The new profile neither meets that stronger contract by assumption nor changes the frozen native observer's premises.

### In-place source enrollment and continuity

Prefer existing resource locations. A binding must establish the identity and continuity it claims, including namespace replacement or disappearance relevant to the operation. It may refuse unsupported topology rather than require a universal relocation ceremony. Startup and ongoing source checks are profile-specific; copying a configuration, reusing an account name or reopening a pathname is not sufficient evidence by itself.

## File-first Change Trace custody

The desired lifecycle authority is **one append-only JSONL Change Trace per Change**. Bounded, versioned typed records retain original/revised intent, exact policy/plan/Check subjects, decisions, attempts, failures and actual outcomes with attributable actors. A proposed or attempted effect is not a receipt for its completion. Large artifacts and private runtime transcripts may be referenced under explicit retention and disclosure rules.

**Change history** means the accepted records in these Traces, not a separate History entity, database or storage subsystem. Native State remains authoritative in the application's own database/filesystem; Change lifecycle history remains authoritative in the JSONL Traces. JSONL is not an audit export after a second lifecycle database commits.

Acceptance checkpoints and other custody/recovery controls may also be persisted, as may Trace-referenced evidence and artifacts. These support acceptance, review and recovery; they do not form another authoritative lifecycle history. Native effect receipts retain their binding-specific evidentiary role. Views and indexes are derived from retained authoritative grounds, not independently writable histories. A hash identifies bytes under its stated interpretation; it does not prove authenticity, authorization, completeness or latest custody.

### Backend-only authoritative writes

Clients request typed domain operations. Only the authorized backend constructs accepted Trace records and their results. Raw append, replacement logs and caller-constructed passing assessments are not public mutation interfaces. Parse and validate bounded input before it can affect custody or native resources.

The first profile relies on its trusted host to enforce this boundary. This is not a claim that file permissions can exclude a hostile process with the same effective storage privileges. A later hardened service must prove its additional process/storage separation independently. Acceptance is returned only after the supported protocol's required guards and durability have succeeded.

### File-first domain interface boundary

The new path uses an explicitly versioned domain interface and persistence profile. Existing [native SQLite/continuation/packet contracts](native-profiles.md) remain unchanged; they are not transparently implemented by a JSONL replacement. No automatic migration, dual-writing, receipt reinterpretation or reuse of `container_id` as Workspace authority is authorized.

Settle the minimal operation/result envelopes, identity/bounds, encoding, acceptance and recovery rules with their actual host, storage and binding consumers in the next coherent phase. Do not freeze speculative public formats independently of a useful opening/history/reopen path. The packet adapter's opaque-byte/credential behavior is not a domain acceptance protocol.

### Protected accepted prefix and recovery boundary

The first file-backed direction retains two distinct roles: JSONL holds lifecycle history; a checkpoint identifies its **accepted prefix**. The checkpoint is acceptance control, not another lifecycle history or a rebuildable cache. Its exact representation and joint initialization/commit/recovery protocol must be settled and tested for the first trusted-host profile. It is protected by that profile's host assumptions, not a claimed hostile-same-account perimeter.

Do not choose a newer accepted head merely because extra JSONL lines parse. Do not reconstruct missing acceptance control by guessing from plausible history. Required identity, ordering, retained result and predecessor grounds must agree with the selected prefix. Missing/corrupt accepted grounds block dependent progress. An unaccepted interrupted tail and damage to accepted history require different treatment under the tested protocol; silently skipping either is not recovery.

The earlier multi-file admission and append/sync/checkpoint sequence is a [retained candidate protocol](../research.md#first-local-recovery-admission-protocol), not an implemented codec or a complete selected host algorithm. This distinction replaces the previous ambiguity between a proposed logical ordering and an allegedly frozen commit algorithm.

### First local recovery profile

The first profile must support clean shutdown/restart, ordinary reboot and authorized history inspection within explicit filesystem, locking and durability assumptions. Reopening history does not launch work. A fixture that refuses every successor has not demonstrated supported continuation.

The consumed protocol must establish one writer, stable custody identity, original-key lookup, safe initialization versus reopen, the acceptance-bearing acknowledgment point and handling of interrupted creation/append/checkpoint replacement. Test actual supported storage behavior and deliberate fault points; source inspection or an unused validator is insufficient. Do not infer multi-file atomicity from a series of successful file operations.

A retained storage incident or inconsistency cannot be erased by a fresh retry, new request identity or successful barrier. Supported recovery must either reconcile it with adequate evidence or refuse affected progression. Distinguish deliverable historical results from readiness for new effects. Complete loss or rollback of all local evidence cannot be detected from identical surviving bytes alone; make this limitation explicit. Do not claim universal power-loss, hostile rollback detection or storage repair from ordinary restart tests.

### Record, replay and durability requirements

Before the corresponding file path is accepted, establish and exercise:

- Bounded, versioned encoding and exact identity/sequence/accepted-prefix validation.
- One writer and no acknowledgment before required custody and barriers succeed.
- Original-key resolution before new identity allocation, source capture or effects.
- Exact comparison of the original operation kind, subjects and complete relevant inputs; changed input conflicts rather than creating a disguised retry.
- Retained original actor, decision and result identity on historical delivery, with current disclosure authorization.
- Supported interrupted-tail, corruption, creation, restart and uncertain-result behavior.
- Required retention and explicit behavior when referenced evidence is missing, stale or no longer disclosable.

For an existing Change, a request key names one original operation across operation kinds and actors; an authorized later caller does not acquire attribution for it. The initial single-user profile need not implement collaboration to preserve this invariant. Creation retries must also bind the original request and resulting Change so that interruption does not allocate a second pursuit.

Replaying accepted history reconstructs lifecycle views, not effects. It must not repeat inference to manufacture missing decisions or rebuild lost acceptance control. Historical disclosure can remain independently authorized after source revocation; that does not authorize new source-dependent progress.

### Git, sharing and encryption

Git can retain history, diffs, transport and checkpoint evidence. It is not the initial live acceptance authority. A commit, ref, copied Trace, signature label or merge does not itself authenticate the acting subject, establish current custody or authorize execution. Authoritative logs are not reconciled by text merge.

Borrowing, encrypted transfer and remote custody are later capabilities. Encrypting bytes neither revokes already disclosed plaintext nor enforces exclusive continuation. New storage/custody profiles require separate protocol evidence; none is activated implicitly by the use of JSONL.

### Multi-tenant scope and ownership

Future hosts must preserve per-user attribution, visibility, native rights and Change custody. Workspace membership does not disclose private Change folders. Shared resource access is not shared lifecycle ownership. The initial profile does not claim multi-tenant isolation or qualify a shared server.

## Sources, observations and retained research

Keep observed native facts separate from an author's assertions, model interpretations and unverified research. Retained evidence needs exact provenance, scope, version/time, visibility and limitations sufficient for its dependent decision. When required grounds are unavailable or contradicted, block or revise the dependent claim rather than infer success.

Research may inform a proposal without becoming adopted policy. Core history needs only evidence relevant to the admitted operation. A universal research repository, vector database or autonomous evidence-gathering system is not required.

### Scoped monitoring and trigger grounds

Later monitoring uses a binding's declared observation and cursor semantics. Gaps, duplicates, version resets and revocation remain explicit. A notification is not a complete State snapshot, a retained authority grant or permission to repair the system. Trigger support must prove its own retry and reconciliation boundary.

## Different retained things have different lifetimes

| Retained material | Responsibility |
| --- | --- |
| Change Trace and acceptance control | Preserve accepted history, decisions and original retry/result grounds. |
| Native State and native effect receipts | Remain under the application's authority and supported retention/recovery contract. |
| Exact observations, candidates and Check evidence | Retain as long as dependent assessment, historical interpretation or reconciliation requires. |
| Working context and transcripts | Private runtime support, never independent lifecycle authority. |
| Derived indexes/views/caches | Rebuildable only from adequate retained authoritative grounds; no hidden source of truth. |

Eviction is not allowed to discard evidence still required for a promised operation. If evidence was legitimately not retained, expose that limitation instead of implying reconstructability. Revocation limits new use and disclosure; it cannot retroactively erase plaintext already shared.

## Intent, Change memory and procedural State

Original intent, later clarification and actual delivery remain separately attributable. Future memory and adopted procedures must preserve this distinction, evidence lineage and applicable policy versions. Reusing a procedure requires current applicability and authority, not confidence inherited from a previous conversation.

### Structured history access and context projections

Expose authorized, bounded reads over accepted history and retained evidence. Views may help a new person or worker continue without replaying an entire transcript. A view must identify its coverage and gaps; it cannot silently fill missing history or carry authority past revocation. This supports later learning without adding a second event or task database.

## Change-owned multi-entity candidates

The first path needs one admitted operation, not a universal candidate filesystem. Later multi-resource candidates are private proposals with exact identities and preparation scope. A prepared candidate is not published State, and a worker-created success claim is not an independent assessment. Bind review to the actual candidate and source versions; conflicts or changes require applicable reassessment.

## Guarded publication

Before an effect, establish current authority, exact admitted operation/subject, applicable Check versions, concurrency preconditions and supported outcome/recovery behavior. The native binding must enforce the promised condition at its qualified point of use. An early read followed by an unrestricted write is not an atomic compare-and-set.

Record a durable attempt before invoking an effect under the consumed protocol. Preserve a stable native operation identity where supported. Native idempotency, conditional updates and outcome lookup can support reconciliation; their actual semantics must be qualified, not inferred from an adapter name. Matching desired values alone does not prove which attempt caused them.

Preparation and publication remain distinct when a workflow promises independent review before publication. No generic editor, shell or broker can provide a bypass around that promise. The first typed-operation profile avoids arbitrary-code execution rather than pretending to contain it.

## Separate stores and uncertain outcomes

Trace persistence and an application effect are not automatically one transaction. A crash can leave a native effect applied with no delivered result or completed Trace entry. Reconcile the original attempt through the binding's supported evidence. If its outcome remains uncertain, retain that state and refuse unsafe repetition; do not report success or mint a new identity to conceal it.

Native multi-resource transactions and compensation have application-specific limits. Cancellation or compensation does not make an irreversible effect disappear. A compensating action is a new authorized effect, not historical erasure.

## Change history, protection and recovery

The accepted Change Trace records explain decisions and evidenced effects within their declared coverage. This Change history is not a complete history of the native application: it does not prove that no external actor changed State, that every old copy is latest, or that all prior intentions succeeded. Initial baselines, external drift and uncertainty remain visible.

## Recovery and continuation obligations

The [phased plan](../../product/plan.md) requires concrete positive paths and failures before each supported claim. Preserve exact original-key results, authority/disclosure checks, no blind effect replay, and explicit unknown outcomes across interruption. Stronger host/custody profiles need stronger evidence; a trusted-host fixture cannot qualify them. [Retained native implementations](native-profiles.md) keep their own unchanged persistence and recovery meanings until an explicit supported transition.
