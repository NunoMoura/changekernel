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

The [consumed opening profile](#consumed-opening-profile), [consumed intent-revision profile](intent-trace.md) and [consumed deterministic assessment profile](assessment-trace.md) define concrete producer/consumer contracts. Each successor is explicitly selected for fresh custody, not an upgrade of an existing profile. The assessment profile separates operation tip from current intent under one optional fixed fixture policy. These bounded contracts do not establish implementation, general ledger formats or release qualification by themselves.

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

The desired lifecycle authority is **one append-only JSONL Change Trace per Change**. Bounded, versioned typed records retain original/revised intent, exact policy/operation/Check subjects and any adopted plan/workflow grounds, decisions, attempts, failures and actual outcomes with attributable actors. The format does not impose a Stage primitive or universal pipeline. A proposed or attempted effect is not a receipt for its completion. Large artifacts and private runtime transcripts may be referenced under explicit retention and disclosure rules.

**Change history** means the accepted records in these Traces, not a separate History entity, database or storage subsystem. Native State remains authoritative in the application's own database/filesystem; Change lifecycle history remains authoritative in the JSONL Traces. JSONL is not an audit export after a second lifecycle database commits.

Acceptance checkpoints and other custody/recovery controls may also be persisted, as may Trace-referenced evidence and artifacts. These support acceptance, review and recovery; they do not form another authoritative lifecycle history. Native effect receipts retain their binding-specific evidentiary role. Views and indexes are derived from retained authoritative grounds, not independently writable histories. A hash identifies bytes under its stated interpretation; it does not prove authenticity, authorization, completeness or latest custody.

### Backend-only authoritative writes

Clients request explicit supported typed operations; the operation/version and its contract identify the requested meaning before recording, not a filename, stage label or natural-language inference. Only the authorized backend constructs accepted Trace records and their results from validated inputs, independently established attribution/authority and supported execution. Raw append, replacement logs and caller-constructed passing assessments are not public mutation interfaces. Parse and validate bounded input before it can affect custody or native resources. Inspection and record replay do not execute commands; one user request/native action can require separate accepted attempt and outcome records.

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

## Ledger working set, archive and restore

The [proposed ledger collection and selection profile](ledger-selection.md) scopes the next contract-selection gate. It does not yet select a wire/storage protocol or authorize implementation; the existing single-slot profiles remain unchanged.

The logical user-owned ledger is the collection of Changes, including retained inactive history. Begin with stable flat Change identity/storage and an active-only default View, not folders for workflow stages. Use authorized bounded/paginated listing and, when justified by measured workloads, rebuildable metadata indexes rather than decoding every complete Trace for every list. Flatness alone proves neither scalability nor reliability. Supporting custody controls and referenced evidence keep their distinct roles; this is not a requirement that the physical directory contain only JSONL files.

Relationships, lifecycle disposition and physical location are independent. A completed Change may remain in the working set; moving it to an archive does not establish completion. Physical archive storage is optional and requires its own consumed protocol and explicit configured location. A separate flat archive root is a possible layout, not a selected public format or current relocation capability. Directory placement must not authorize an effect, adopt a workflow, transfer ownership or create a new Change.

A supported archive/restore path preserves stable identity, originating ownership, actual contributor attribution, exact accepted history, acceptance/custody grounds, original creation/request/result associations and required referenced evidence. It must settle active writer/executor responsibility and interruption/recovery without creating two continuation authorities or losing an old retry association. Unresolved effects remain explicit, not erased or hidden as successful completion. Derived indexes can locate authorized retained material but cannot supply missing non-rebuildable acceptance control.

Restoration retrieves the same Change under current disclosure and a supported custody association. Validate identity, accepted bytes and required grounds; detect duplicate/conflicting copies rather than blindly overwrite or merge logs. Restoring storage neither replays effects, reverses a recorded conclusion nor automatically resumes pursuit. New continuation requires its own authorized operation; a file copy or ordinary rename is not that handoff. Retention/deletion is a separate explicit decision, constrained by promised evidence and honest gaps. The single-slot opening profile below deliberately refuses relocation/copied custody and implements none of this later archive or transfer protocol.

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

Expose authorized, bounded reads over accepted history and retained evidence. The collection boundary is a user's Change ledger; the file boundary is one Change; the record boundary is one typed lifecycle-operation record. A ledger is not another lifecycle database, and listing a collection does not authorize disclosure of every member. The first single-slot opening profile below is a smaller witness, not an implementation of collection queries or longer histories.

Use **origin** for the initial accepted grounds, **tip** for the latest accepted position and **cursor** for the reader's selected position. Navigation must not move the tip, confer continuation or execute work. Logical Change/operation identity and physical byte offsets serve different roles. Selected head/tail/range/follow and at-position reads must preserve exact identity, ordering, coverage, current disclosure and explicit gaps. Tail navigation ends at the selected accepted prefix, not at an arbitrary parseable file end. The most recent operation does not necessarily contain the complete current lifecycle View.

**Change context is an authorized, purpose-specific View of a particular Change version and its referenced grounds.** Identify the selected prefix, projection version/interpretation, purpose, authorized scope and relevant evidence or native observation versions. Common grounded facts may support purpose-specific understanding, planning, assessment, execution and continuation projections without mandatory stage templates or a separately writable context history. A fresh person or deterministic client must be able to consume these Views without a model or prior conversation. The initial opening context needs only the recorded What/Why, attribution, association and origin/result references; later operations supply additional grounds through their own contracts.

Native State remains authoritative in native resources. References may select necessary evidence and observations outside the file; a hash or reference does not guarantee that the bytes remain available. Exact historical context reproduction requires the original inputs and interpretation to be retained or the exact context material to be retained as identified evidence where promised. Missing or stale grounds stay explicit. Current disclosure still applies. Model-written summaries are optional derived material, not a substitute for exact facts or acceptance; retrieved file content is data, not an executable policy or authority grant.

Choose read mechanisms against actual workloads. One record per line gives framing and sequential access, not automatic indexed lookup or constant-cost projection. Compare simple scans with bounded backward reads and, only where justified, rebuildable sequence/identity-to-offset indexes or projection snapshots. Measure authorization, custody and prefix-validation work as well as bytes read/decoded, memory, cold/warm latency and reconstruction work. A fast tail parser does not make an operation cheap if every query must revalidate the entire file. Cached validation reuse needs a justified custody/version boundary; it cannot silently replace required checks.

Indexes and projection snapshots are derived accelerators with exact source/interpretation coverage. Losing or invalidating one may increase read cost but must not alter accepted history or result identity. An acceptance checkpoint is different: it selects authority and cannot be guessed from plausible records when missing. Additional index/caching formats, concurrency and scaling limits are selected only with a consuming capability; this design does not amend the fixed opening wire/storage profile below.

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

## Consumed opening profile

This is the selected implementation contract for the first opening → inspection → restart/retry increment. It fixes one bounded source-test fixture, not a universal public API, executable conformance, qualified storage profile or completion of Phase 1. Intent revision, assessment and other supported lifecycle operations need subsequent records and checks; this increment does not manufacture them or select a universal pipeline.

### Actual producer, consumer and supported fixture

The first host is the ordinary Rust integration-test driver in `tests/file_first_opening.rs`; the evidence gate below requires its real implementation. It composes the new opening library with a private disposable directory on a local Linux filesystem. The driver supplies one authenticated fixture principal `owner-1`, one Workspace binding `workspace-1` at binding version `fixture@1`, and a current authorization guard independently of request bytes. Authentication here means identity asserted by the trusted test host, not a qualified login service or socket credential protocol. A deny/unavailable guard exercises those outcomes. No model, Pi extension, source observer, shell operation or application write is consumed.

The producer is that host's closed `open_change` dispatcher. The consumer is its `inspect_change` dispatcher and a fresh driver instance using the same provisioned custody after the writer exits. Both consume the same accepted record, not a second intake database. Inspection explains original What/Why, original actor/request/result, accepted coverage and the next capability boundary without reopening a native source. The positive witness is useful durable intent, not admission or execution. This fixture is the selected concrete integration for source evidence; a real application's authentication and installation remain later qualification subjects.

One provisioned slot supports one Change and its original opening key. This removes a creation registry, random allocation during retries and cross-Change lookup from this increment. The host pins `custody-1`, `change-1`, `open-1`, owner, Workspace and binding version before client dispatch. A different key cannot silently allocate another slot. Supporting multiple Changes or new operations requires an explicit successor assignment, not an inferred capability. The key's namespace is the entire Change, not `(actor, operation)`; eventual successor operations must check the opening key too. This single-slot limit is deliberate, not a universal public format.

The trusted host owns all custody descriptors and I/O, holds policy valid throughout an operation and returns only bounded values. It runs no untrusted code or subprocess with those descriptors, does not fork while custody is open, and closes every descriptor before clean restart. A crashed process is confirmed exited before the successor starts. An exclusive nonblocking `flock` on the pinned permanent lock excludes a competing cooperative writer; the lock is never replaced or removed. Missing predecessor termination/handle exclusion is unsupported. Lock acquisition alone does not prove either condition. This profile excludes hostile same-privilege writers, network filesystems, storage that cannot synchronize directories, namespace replacement by external writers and filesystem repair. Ordinary reboot support remains subject to later exact-host/storage evidence.

### Consumed request, result and encoding

Only these client JSON objects are accepted. All shown fields are required, `why` uses explicit `null` for absence, unknown/duplicate fields are invalid, and no actor, approval, binding, digest or result field is client-writable:

```json
{"v":1,"op":"open_change","workspace_id":"workspace-1","change":"change-1","key":"open-1","what":"Record the settings cleanup","why":"Keep the reason across restart"}
{"v":1,"op":"inspect_change","workspace_id":"workspace-1","change":"change-1"}
```

The host compares Workspace/Change with its installed slot and checks current permission before any private key lookup or disclosure. A guessed association is denied; policy failure is unavailable rather than denial. Opaque custody, Workspace (`workspace_id`), Change (`change`), request key (`key`) and actor/owner identifiers use ASCII `[A-Za-z0-9_-]{1,64}`. The derived result identifier is exactly the validated Change identifier followed by the seven ASCII bytes `:origin`, hence 8–71 bytes; `change-1:origin` is valid under this separate rule, not the opaque-identifier rule. The installed binding version is exactly `fixture@1` for this fixture, not a client-selected identifier. What is nonblank UTF-8, 1–65,536 bytes; Why is null or UTF-8 up to 65,536 bytes (empty and absent differ). No text normalization occurs. Input is bounded to 1,048,576 bytes before decoding; accepted records and results have the same bound. UTF-8, duplicate-field, integer/version, depth and field-count checks occur before custody mutation. Objects have fixed schemas, no arbitrary nested data. Invalid input produces no record.

The retained success result is exactly:

```json
{"v":1,"kind":"opened","workspace_id":"workspace-1","change":"change-1","key":"open-1","actor":"owner-1","result":"change-1:origin","seq":1}
```

`kind: "opened"` describes capture of intent, not admission to effects. No public `stage` field is emitted or required; workflow stages are not intrinsic Change primitives. `result` is the deterministic slot-local original result identity defined above, not a hash or authority token. Exact opening retries deliver this original result, never a result attributed to the current caller. The request's entire typed value, including operation, version, subjects, key, exact What and null/present Why, is compared with retained input; JSON whitespace/member order do not change typed identity. A changed field under the original key conflicts. This decoder rejects unsupported operation kinds without mutation; any later supported operation must conflict if it reuses the opening key, not allocate a new namespace. A different key is unsupported for this occupied slot; it cannot bypass damage or uncertainty. Error envelopes are `{"v":1,"kind":"error","code":"invalid_input"}`, with code alternatively `denied`, `conflict`, `unavailable` or `unsupported`; they are not accepted lifecycle results. Storage errors are never presented as proof of nonacceptance.

The origin JSONL record holds the complete original request and result:

```json
{"v":1,"custody":"custody-1","workspace_id":"workspace-1","binding":"fixture@1","change":"change-1","seq":1,"prev":null,"kind":"opened","input":{"v":1,"op":"open_change","workspace_id":"workspace-1","change":"change-1","key":"open-1","what":"Record the settings cleanup","why":"Keep the reason across restart"},"result":{"v":1,"kind":"opened","workspace_id":"workspace-1","change":"change-1","key":"open-1","actor":"owner-1","result":"change-1:origin","seq":1}}
```

Retained bytes have deterministic encoding: shown member order, no whitespace outside strings, decimal integers, UTF-8 non-control characters emitted directly, quote/backslash escaped, every U+0000–U+001F encoded as lowercase `\u00xx`, solidus unescaped, and one terminal LF. No BOM or CRLF. No lone surrogates. Host constructs these bytes from validated values; callers cannot submit record bytes. SHA-256 covers the exact record bytes **including LF**. It detects mismatches under this trust boundary, not authenticity. The decoder verifies schema, associations, sequence, null predecessor, original key, host-pinned actor and exact reconstructed result as well as digest/length. An internally inconsistent result is damage even when its digest matches.

Successful inspection returns `{"v":1,"kind":"inspection","origin":<complete origin record>,"coverage":{"first":1,"last":1},"progress":"ready"}`. `progress` is alternatively `blocked_unaccepted_tail` when the accepted origin is intact but extra bytes exist. It denotes custody readiness within this opening-only profile, not execution admission. No accepted origin yields unavailable, not fabricated empty history. Inspection does not reserve a key, accept a tail, invoke a source or execute work. Original What/Why remain author's assertions, not native observations. Later intent revision, assessment and other lifecycle operations remain explicitly unimplemented by this profile.

### Retained controls and provisioning

Change history here means the accepted records in `trace.jsonl`, not a separate History entity/database. Native State stays in the application; this fixture performs no native State mutation. There are three supporting custody/recovery control roles, none a second lifecycle history:

- A trusted host provisioning **anchor**, outside the slot directory and explicitly supplied to the host, pins format `ck-opening-anchor@1`, custody/Workspace/binding/Change/owner/original key, absolute installed directory, directory and lock `(device,inode)` identities and stage `preparing` or `installed`. It is protected host installation state, not client JSON or discovery from a filename. An administrator/service is unnecessary: the fixture host deliberately creates it in its owned disposable parent. Tests must explicitly distinguish fresh provision, resume provision and reopen.
- Permanent `checkpoint.json` selects the accepted prefix. Its exact schema is `{"format":"ck-opening-prefix@1","custody":"custody-1","change":"change-1","generation":0,"end":0,"sha256":null,"pending":null}` initially. Reservation replaces it with generation/end unchanged and `pending` equal to the complete validated opening input plus host actor, encoded as `{"input":<opening request>,"actor":"owner-1"}`. The accepted form is generation 1, end equal to the origin record's UTF-8 byte length, SHA-256 equal to its lowercase 64-hex digest and pending null. Generation 0 is authoritative evidence of no accepted origin, not permission to infer an erased Change never existed. Reservation is prepared input custody for creation recovery, not accepted lifecycle history.
- Permanent `incident.json` is `{"format":"ck-opening-incident@1","custody":"custody-1","state":"clear"}` initially. A retained failure has state `blocked` and adds `phase` (one of `provision`, `reserve`, `append`, `checkpoint`, `deliver`, `recover`) and `issue` (one of `io`, `short_write`, `barrier`, `inconsistent`). No plaintext intent or arbitrary OS error string is required. Malformed/missing incident control is damage, not clear.

The anchor's exact members, in encoding order, are `format`, `custody`, `workspace_id`, `binding`, `change`, `owner`, `key`, `directory`, `directory_device`, `directory_inode`, `lock_device`, `lock_inode`, `stage`; identifiers/associations have the pinned values above, filesystem identity fields are unsigned 64-bit decimal integers, and directory is the installed absolute UTF-8 path (at most 4,096 bytes, no symlinks, dot/parent components or control characters). Directory identity is checked through opened handles, not path spelling alone. The host's supplied fixture grant pins this anchor's associations independently of its contents.

All controls are bounded to 1,048,576 bytes and use the same fixed-schema deterministic JSON rules plus LF. Trace is bounded to 2,097,152 bytes including any unaccepted suffix; larger storage is unavailable, not silently truncated. The slot inventory is exactly `writer.lock`, `trace.jsonl`, `checkpoint.json` and `incident.json`, plus at most `checkpoint.tmp` and `incident.tmp`. The explicitly configured anchor path in the trusted parent has at most its reserved sibling `anchor.tmp`; temporary creation is exclusive under the same writer boundary. Temporary names are reserved host implementation details, never authority; reopen does not choose them over installed controls. Unknown entries or symlink/nonregular controls block. The lock and directory identities are checked against the independent anchor; each control also checks its pinned logical associations. Moving/copying a slot or changing the mounted device is unsupported rather than silently re-enrolled.

Deliberate fresh provisioning has an explicit trusted host grant of first use; an empty path is not that grant. The host creates the directory and permanent lock exclusively, pins their identities in the `preparing` anchor and synchronizes changed namespace parents before constructing controls. A crash before that anchor survives cannot be auto-resumed from absence: explicit host provisioning reconciliation must establish the same unused subject or refuse. With a surviving preparing anchor, resume verifies the pinned identities, existing inventory and deterministic initial controls, exclusively creates only missing initial controls, synchronizes files and changed parents, then atomically installs and synchronizes the `installed` anchor. No client request runs before this finishes. Unexpected bytes, reservation or history during preparation block; resume is not a method to erase prior use. Failure while provisioning latches an incident; failed/uncertain initialization does not become a fresh identity.

Reopen requires an installed anchor and every permanent control; it performs no initialization or migration. Missing anchor, lock, trace, checkpoint or incident refuses progress. Generation 0 with pending null permits the first request because intact installed acceptance control and host provisioning establish the initial state together, not because trace happens to be empty. Anchor replacement uses a synchronized same-parent temporary, atomic rename and parent synchronization; uncertainty is not success. A surviving preparing anchor after interrupted final installation can resume only the complete valid initial inventory, not an opened Change. The anchor `stage` field is internal provisioning state, not a public Kernel stage.

**Reserved anchor-temporary recovery.** Before any exclusive creation of `anchor.tmp`, under the same policy/writer boundary, compare the independently supplied grant with the authoritative anchor, validate pinned directory/lock handle identities and inspect the bounded temporary and entire slot inventory. A temporary never supplies a missing anchor, a new identity or permission to initialize. Missing/invalid authoritative anchor requires the already specified host reconciliation/refusal; no temporary is promoted. Supported automatic cleanup is limited to a complete deterministic initial inventory: empty trace, generation-0 checkpoint with pending null, clear incident, no checkpoint/incident temporary and all permanent files/identities intact. In particular, an incident or pending/accepted opening forbids this provisioning cleanup.

| Authoritative anchor and `anchor.tmp` | Decision under the pinned writer boundary |
| --- | --- |
| Preparing anchor; no temporary | Continue the existing same-identity preparation procedure, including its checks for any still-missing initial controls. Synchronize the anchor parent before creating a new temporary; absence is not first-use authority. |
| Preparing anchor; complete canonical temporary equal to that anchor or to its expected installed-stage successor (only `stage` differs) | Require the complete initial inventory above and independent grant/handle agreement. Unlink the validated abandoned temporary, synchronize its parent, then rerun normal validation and create a fresh installed-stage temporary exclusively. Do not rename/promote the abandoned bytes. |
| Installed anchor; complete canonical temporary identical to that installed anchor | Require the same complete initial inventory and grant/handle agreement, then unlink and synchronize the anchor parent before normal installed reopen. No initialization occurs. |
| Installed anchor; preparing-stage temporary, even with otherwise matching associations | Refuse automatic cleanup/resume: this is not a supported preparing → installed replacement remnant. Preserve evidence. |
| Either anchor; partial, oversized, malformed, noncanonical, symlink/nonregular, unrelated or otherwise differing temporary; or incomplete/noninitial inventory with a temporary | Unavailable; preserve temporary and inventory. No blind removal, selection or re-enrollment. |

If process interruption happens before unlink, the same surviving valid temporary can be revalidated and cleaned again. If it happens after unlink but before parent synchronization, the successor may see either absence or the old temporary: validate the authoritative anchor/grant/inventory again, synchronize the parent in the absent case, or repeat the validated cleanup in the present case. If it happens after cleanup synchronization but before fresh creation, the no-temporary path resumes the same identity. A partial **fresh** temporary after resumed creation refuses under the torn-case rule; it is not claimed recoverable. An observed unlink/parent-barrier failure takes the monotonic incident path, not a successful cleanup retry. These rules do not recover an incident observation lost before retention. Checkpoint and incident temporary rules below remain distinct; an incident temporary is never discarded by anchor housekeeping.

### Acceptance, interruption and retained incidents

All operations serialize under the pinned lock and host policy guard. Reopen validates controls, inventory and the exact selected prefix before any private delivery; fresh trace/control/required parent synchronization and revalidation precede an acceptance-bearing historical response. Synchronization success is current custody evidence, not proof of an earlier acknowledgment or an absent prior error.

For the first opening: authorize and validate → resolve the original key/reservation → durably replace checkpoint with generation-0 pending input → construct origin bytes → append those bytes → synchronize trace → write/synchronize the checkpoint temporary → rename it over checkpoint → synchronize slot directory → revalidate installed generation-1 checkpoint/prefix → recheck disclosure → deliver the retained result. Never acknowledge at append, trace sync, temporary creation or rename alone. Losing the response after acceptance is resolved by the original key. A denied response after commitment does not undo acceptance; a later authorized exact retry can deliver it.

Crash interruption, without a retained incident, has these specific outcomes:

| Surviving evidence | Permitted recovery |
| --- | --- |
| Installed initial checkpoint, empty trace | Accept the original request normally. An uninstalled reservation temporary is not acceptance; validate its known shape/association before discarding it under the lock and synchronizing the parent. |
| Generation 0 with intact pending input, trace empty or an exact byte-prefix of its deterministic origin | Inspection reports unavailable. Only an authorized **exact original request retry** may finish missing bytes and run the full acceptance sequence. A complete parseable origin is still unaccepted until that sequence commits. Changed input conflicts; no new identity or source capture occurs. |
| Generation 0, no pending input, nonempty trace; or pending input with mismatching/extra trace bytes | Block as inconsistent custody. Do not infer the request from the tail, truncate it or select a temporary checkpoint. |
| Generation 1 and exact accepted end | Inspect/retry returns original grounds after fresh barriers. Restart does not append. |
| Generation 1 with bounded extra bytes | Validate the entire accepted origin independently; disclose it with `blocked_unaccepted_tail` after barriers if no incident applies. Opening retry returns the original result, not the suffix. No mutation or automatic tail cleanup is allowed. |
| Generation 1 with missing/changed accepted bytes or result/request grounds | Unavailable. Never rebuild checkpoint from trace or regenerate lost accepted text/results. |

Known checkpoint temporaries are inspected against installed control and pending/accepted origin. A valid abandoned temporary is not selected. It can be removed with directory synchronization once its installed-control relationship is proven; an unexplained temporary blocks. Incident temporaries indicating a blocked state are conservatively treated as retained incident evidence even if replacement did not finish. A malformed incident temporary blocks, never vanishes through housekeeping. The writer never deletes a blocked incident or overwrites it with clear.

A short write, failed synchronization, genuine I/O error or uncertain replacement immediately latches unavailable in memory before further acceptance-bearing response. Through the same writer, attempt bounded replacement of incident with the blocked shape and synchronization of its parent; preservation failure does not clear the latch. Already retained blocked evidence blocks both opening and private historical delivery in this minimal profile. An expected competing lock/exclusive-create result is contention, not automatically an I/O incident. Deterministic accepted corruption blocks without destructive repair. No fresh key, clean close, subsequent successful barrier or restart erases a retained incident. Incident repair is unsupported; a separately reviewed host recovery process is required.

If a process dies before observed incident evidence survives, the successor cannot recover that observation. Likewise, complete anchor/control/history loss or an internally consistent rollback of all surviving evidence cannot be distinguished from identical legitimate bytes. This profile claims neither hostile rollback detection, universal physical power-loss safety nor recovery of an erased acknowledgment. Simulated crash cutpoints prove only their observed process/filesystem behavior. Reboot and exact filesystem durability qualification remain separate requirements.

### Historical mechanisms retained or excluded

Keep explicit first-use versus reopen, independent custody association, permanent writer exclusion/handle discipline, original-key reservation, accepted-prefix selection, file and directory barriers, original-result delivery and monotonic incident refusal. They close actual opening failure windows. This profile deliberately avoids a global registry, principal enrollment service, per-Change lock hierarchy, active association catalogue, source-result receipts, inference-output reservations, clean-close witness, multi-file admission transaction, OS-isolated broker and BPF/VM machinery. The single provisioned slot, deterministic origin and no effects remove their immediate consumers; they do not invalidate the deferred profiles' counterexamples. No historical SQLite retry namespace or receipt is reinterpreted.

### Implementation boundary and evidence gate

Implement the cohesive opening producer/inspection consumer and storage protocol together: new `src/kernel/changes/opening.rs`, `src/application/opening.rs`, `src/adapters/jsonl/opening.rs`, their module/reexports in `src/lib.rs`, and `tests/file_first_opening.rs`. Keep host composition/provisioning fixture code in that integration test; no new executable, transport, public raw append or generic backend framework. Existing intake/continuation/source/packet APIs remain untouched. The concrete decoder/emitter and selected direct dependencies are specified below. Existing `sha2` and Linux `libc` cover digest and local lock/syscalls. No additional runtime dependency or generic backend framework is required for this profile.

**Selected decoder:** `serde_json::Deserializer::from_slice` over the bounded UTF-8 input, with manually implemented `serde_core::Deserialize`, `serde_core::de::Visitor` and `serde_core::de::MapAccess` for each fixed request, result, record and control shape. No `serde_json::Value`, intermediate map or untagged retry parsing is used. Each field name maps to one seen bit and typed slot; a second occurrence fails immediately (including duplicate `why: null`), an unknown field fails, and missing required fields fail at map end. For required nullable fields use an outer presence slot/bit separate from the inner nullable value; null never counts as absent. Integer fields deserialize as unsigned integers, not floating point/string conversions; versions and enums are then checked for their exact supported values. The request visitor requires or forbids What/Why according to `op`, so inspection cannot carry opening fields. Only declared nested structs are parsed; arrays/arbitrary nesting are rejected, and the standard JSON recursion limit remains enabled. Check decoded string bounds/identifier grammar and complete domain associations before custody mutation. `Deserializer::end()` rejects non-whitespace trailing input; retained bytes additionally must equal deterministic re-emission including the one LF, so alternative spellings/whitespace cannot masquerade as canonical retained records. Duplicate/shape errors in accepted controls/history are unavailable, not client invalid-input results.

**Selected emitter:** use `serde_json::Serializer::with_formatter` and explicit `serde_core::ser::SerializeStruct` calls in the specified member order (not a map), with a profile-specific `serde_json::ser::Formatter` based on compact formatting. Override `write_char_escape` for the public `serde_json::ser::CharEscape` variants (confirmed by read-only inspection of the already installed 1.0.145 source): quotes/backslashes retain their required two-byte escapes; every control escape variant, including newline, tab, backspace, form feed and carriage return, emits its lowercase six-byte `\u00xx` spelling, never `\n`, `\t`, `\b`, `\f` or `\r`. Unescaped UTF-8 string fragments are copied as supplied, solidus stays unescaped, and only unsigned decimal integers, null and declared structs are emitted. Append exactly one LF after the root. Use the same emitter for origin, controls and reconstructed-result validation with bounded output, not default `to_string` escapes. This is one consumed fixed-profile codec, not a second permanent validator or general canonical-JSON framework.

**Selected direct dependencies:** `serde_json = "=1.0.145"` is a runtime dependency with its default `std` feature; `serde_core = { version = "=1.0.229", default-features = false, features = ["std"] }` supplies the manual Deserialize/Serialize traits. The trait-only crate explicitly supports handwritten implementations; neither the `serde` facade nor derive support is consumed. No `derive`, `preserve_order`, `arbitrary_precision`, `raw_value` or `unbounded_depth` feature is needed. Preserve these pins and the existing package/checksum graph. A future derive consumer or dependency change needs separate review; a transitive lockfile entry alone does not establish an active feature or available package.

Required future checks consume the real dispatchers and filesystem: provision → open → inspect → writer exit → fresh reopen → exact retry; denied disclosure; forged/unknown fields; wrong binding/custody/slot; null/empty Why conflict; all reserve/append/checkpoint/namespace barrier cuts; anchor-temporary pre-rename, partial/unrelated, post-unlink and post-cleanup cuts; partial deterministic origin continuation; lost response; competing writer; accepted corruption versus suffix; retained incident and failed incident retention. Assertions cover original attribution/result and unchanged accepted bytes on retry, not merely validator success. Later revision/admission/effect checks are outside this increment. No format description or fault table substitutes for those tests or manager acceptance.
