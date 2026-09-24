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
    - src/ports/source_observer.rs
    - src/application/intake.rs
    - src/application/source_observation.rs
    - src/kernel/containers/**
    - src/kernel/state/**
  testPatterns:
    - tests/adapters/git/**
    - tests/adapters/sqlite/**
    - tests/kernel/containers/**
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

State is the current authoritative representation of identified values, adopted obligations and supported knowledge within a container's authorized scope, with relevant gaps, conflicts and unknowns explicit. Authoritative representation does not make every assertion verified reality. Observations describe what a source establishes at a particular version or time, with explicit coverage and consistency. Desired outcomes and continuing requirements can also be State, but their existence does not establish fulfillment. Changes can fill gaps, resolve contradictions or revise unsupported knowledge; absence of knowledge does not establish absence of a resource. No universal giant snapshot, Markdown representation or duplicate current-state database is required.

## One authoritative current representation

Existing application rows, files and service resources remain authoritative in place. Qualified bindings expose observation, identity/version checks, preparation, publication, outcome lookup and any supported recovery. Managed generic records, documents and relationships use ChangeKernel's configured store when no native resource supplies that meaning. Once a native source owns an entity, do not maintain a second independently writable generic copy.

The application's supported database is the default ChangeKernel store, using protected storage through an adapter. SQLite remains an optional local/new-application or fallback choice, not a mandatory sidecar. Store initialization, access protection and upgrades require appropriate host authority. Writable storage lives in persistent application data, not the installed package or an ephemeral container filesystem. Physical placement and logical ownership are separate choices.

ChangeKernel owns the persistence contracts and machinery; existing database engines hold the bytes. Database-per-container, process-per-container and repository-per-container are not requirements. Selective isolation, export and recovery must be qualified for the chosen shared or dedicated placement.

## Sources, observations and retained research

Read on demand, retain what decisions rely on, and recheck what actions depend on. Sources hold native material; adapters report attributable observations; Evidence establishes what those observations support or challenge; Change memory records their use; adopted State knowledge records the current accepted conclusion and limits. A connected source can expose governed resources, read-only evidence or both. Connection, capture, a trustworthy publisher or a matching digest alone does not adopt its assertions as governing truth.

Need is derived from intent, applicable procedures, constraints and affected dependencies, not only an agent's preferred searches. Catalogs and binding metadata may be known upfront without loading all contents. Obtain bounded authorized material, expand when dependencies or uncertainty require it, and expose missing, denied, partial, truncated or outdated coverage. Checks consume exact supplied inputs; authorized Work gathers missing observations. No-result searches do not prove nonexistence. Explicit scoped monitoring is also a legitimate need; it does not require mirroring every source or authorizing subsequent effects.

Authorized research may discover and retain a new source resource during a Change. Bind its stable identity, original location/publisher where available, acquisition time, exact captured version, content identity, transformation history, discovering Change/Work, scope, visibility, retention and permitted use. Preserve source bytes or qualified exact native history where required; a derived extract identifies its original capture and transformation. Treat later retrieval as another version/observation, not an overwrite of historical grounds. New retained material is subsequently consumable through ordinary qualified source interfaces; no separate research-memory authority is needed.

Raw research may be retained in protected custody before its conclusions are assessed, like a private candidate. Retention does not publish adopted knowledge. Reuse or broader visibility requires applicable authority; private capture is not an implicit shared library. Registering material is distinct from installing an adapter, granting credentials or enabling a new capability. Source text cannot execute instructions, load plugins, confer permissions or revise procedures. Such configuration and authority changes follow their own protected transition requirements.

| Material needed | Custody rule |
| --- | --- |
| Exploratory material not relied upon | May remain temporary or cached within its declared policy. |
| Required grounds with protected native history | Pin exact versions and establish that access/retention obligations are supported. |
| Required grounds from mutable or expiring sources | Retain an authorized exact bounded capture rather than rely on a live link. |
| Recovery input | Protect necessary prior values, differences or supported compensating instructions before effects. |

Bind observations to source/binding identity, actor-authorized scope, resource/version, observation time and relevant query parameters, projections, selection/membership, consistency, coverage and omissions. For derived results, retain the method and necessary inputs or qualified references. Preserve exact supplied assessment context and relevant counterevidence, not merely favorable citations from an answer. A path, timestamp or digest cannot recreate deleted bytes. If required retention or access cannot be supported, block the dependent guarantee or progression rather than silently weaken it.

Reading permission does not automatically authorize retention, sharing or disclosure to a model. Copies, summaries, indexes and learned guidance can carry sensitive information too. Apply current custody/delivery policy to them and their metadata. Source revocation, permitted historical custody and authorized redaction/deletion need explicit policy; no cached copy may invent a new access route. Distinguish denied access from absent data. Historical captures establish what was observed then, not what remains true now.

Freshness follows link meaning. New live data does not rewrite old evidence. A changed execution dependency, selection membership or governing assumption can invalidate readiness or require procedure reassessment; unrelated source changes need not invalidate proven equivalent inputs. If a consumer is added after an interface assessment, unchanged previously observed files do not establish complete current coverage. Where bindings cannot support suitable comparison or guards, required freshness remains unresolved. Observing native outside writes exposes current values and drift rather than fabricating approved Changes or allowing stale memory to override the source.

## Different retained things have different lifetimes

| Material | Retention responsibility |
| --- | --- |
| Re-fetchable observation or derived index | May be cached or rebuilt if its loss does not destroy required grounds. |
| Retained research resource | Preserve exact captured material or qualified native reference with provenance, visibility and declared retention; later observations do not overwrite it. |
| Intent and decision history | Preserve original request, interpreted/admitted revisions, attributable decisions and exact references to continuing State obligations. |
| Pending candidate | Retain exact approved/generated values or patches durably until execution, reconciliation, Review and retention obligations permit removal. |
| Assessment input and result | Preserve exact inputs, evaluator/settings, source roles, outcome and limits needed to explain and verify decisions. |
| Effect receipt | Retain source identity, stable operation identity, actual outcome and exact effect/history references. |
| Recovery grounds | Protect needed prior values, differences, native versions or compensating instructions before effects occur. |
| Trace | Link intent, attempts, assessments, authority and receipts without duplicating every payload. |
| Adopted procedure or rule | Keep a versioned current artifact with scope and adoption/revision/retirement history. |

A transaction identifier alone is not a historical archive. A row that changed from €900 to €1,200 and later to €1,500 no longer reveals the earlier assessed values. PostgreSQL [removes obsolete row versions](https://www.postgresql.org/docs/current/routine-vacuuming.html); its [transaction identifiers](https://www.postgresql.org/docs/current/transaction-id.html) do not replace retained historical values. Reuse qualified native history where available, otherwise retain the differences or prior values needed for the declared guarantees. A universal full-version mirror is not required.

Thin traces need durable, authorized targets. A local path or expiring provider link is insufficient for promised continuation. Preserve reference integrity, access restrictions and explicit retention limits. Cache deletion must not erase an unexecuted approved candidate or the only recovery grounds.

## Intent, Change memory and procedural State

The Change record owns the immediate pursuit: original request, interpreted intent with stated/inherited/inferred/unknown provenance, outcome and success observations, scope/exclusions, commitments, material alternatives, decisions and attributable revisions. Preserve original input and supersession relationships; do not rewrite accepted intent to fit delivered output. Work and related Changes reference the relevant versions instead of producing competing intent documents. Continuing goals, requirements and preferences belong in State, referenced by the Change. Current design describes desired behavior; Change history explains its adoption and revision. Release changelog entries are not this record.

Change memory retains case-specific experience: selected assumptions and source versions, attempts and rejected hypotheses, exact procedures and assessment inputs/results, candidates, effects, outcomes, failures, repairs, proposed lessons and unresolved consequences. Keep concise rationale and durable references rather than every conversation or private reasoning transcript. Retention and access rules apply to summaries and to their targets. A fresh worker must recover what was intended and known then, what happened, and what remains safe now; reconstruction must not rerun inference or effects.

State memory retains current adopted knowledge and guidance with identity/version, owner/scope, purpose/applicability, content or exact native reference, preconditions, limits, supporting grounds and adoption/revision/retirement history. An authoritative runbook or executable policy stays in its native source when that source owns its meaning. State is logical authority, not a demand to copy all procedure text into generic storage. A reference to current adopted content and its meaning must not silently advance when an outside file changes.

| Link role | Required meaning |
| --- | --- |
| Historical support | Pinned Changes, observations, standards and counterevidence explain why this procedure version was adopted. |
| Required operational input | A parameterized observation requirement describes what a particular future use must collect under current scope and freshness rules. |
| Applicability dependency | A governing assumption, rule or source relationship can make guidance stale or inapplicable when it changes. |
| Actual use | A Change identifies the exact procedure and observations it relied upon, not whatever is current when history is read. |

Adopting, revising or retiring knowledge/procedures is a semantic State effect governed by the same Change pipeline. Internal learning code can collect experience, suggest improvements and prepare candidates, but has no alternative publication authority. A memory update can be part of an existing Change; learning after closure can become a linked Change. Collection/custody records, indexes, caches and derived freshness indicators can be maintained internally without adopting new meaning. There is no nested Change for each download or lookup and no mandatory model or human call for every exact update.

Automatic learning needs delegated authority and applicable assessments, not mere repetition. Preserve failures as well as successes; useful learning does not retrospectively complete a failed goal. Proposed guidance cannot weaken its own governing adoption rules. Own summaries are not independent corroboration. Reliable mechanical lessons can become code/tests rather than additional prose. A privacy-sensitive finding is not automatically safe to generalize or share.

Retrieve within permissions before relevance ranking, then distinguish historical context, proposed improvements and current adopted guidance. Required observations must be obtained for the actual use rather than copied from an old incident. Retired guidance remains available only as authorized history, not an active instruction. A bounded generated brief is a view, not another independently editable intent or memory store. Typed references and scoped queries suffice for an initial implementation; no separate memory database, universal index or semantic-search service is required. Memory can guide recovery but cannot replace protected prior values, receipts, current source observations or process custody.

## Native Rust intake

The first native intake capability is a library boundary for retaining original intent, not admitting pursuit or publishing State. It supports a single authenticated owner per container and multiple containers in one application-chosen store. SQLite is the first local/new-application binding, not a mandatory sidecar or the engine-wide database choice. Source files remain authoritative in place; intake writes only its own protected bookkeeping.

The host authorizes store initialization, supplies a persistent file path, authenticates the actor on every call, and protects storage against ordinary worker access. An actor value or a Rust type does not authenticate anyone. Actor context is supplied separately from proposal content; no request field, natural-language instruction, guessed identifier or implicit membership grants access. This boundary does not yet support ownership transfer, delegated membership or a network transport.

| Operation | Required meaning |
| --- | --- |
| Create a container | Bind its supplied identity to the trusted actor. Repeating this for the same owner returns the same container; another actor cannot take it over. |
| Open a container | Verify current owner access without creating missing containers or adopting anything. |
| Propose intake | Retain the trusted actor, container, stable request identity, exact What and available Why; return a stable container-scoped Change reference and the retained intent. |
| Read retained intake | Recheck actor/container access and return the exact retained record, or report denied/unavailable access without reconstructing or repairing it. |

Container, actor and request identifiers are opaque, nonblank text of at most 256 UTF-8 bytes, without control characters; namespace prefixes are not required. What is nonblank text of at most 65,536 UTF-8 bytes. Why is optional text with the same size bound; absent and present-empty remain distinct. Accepted text is retained exactly, including whitespace and Unicode representation, without trimming, normalization or an invented rationale. These are bounds for this native capability, not a retroactive change to the TypeScript prototype's validation rules.

Retry identity binds container, trusted actor and request identifier. An identical retry reconciles the retained outcome and returns the same Change reference and intent, even after a lost reply or process restart. Different What or Why under that identity conflicts without overwrite or a second record. Distinct containers do not share retry bindings. Concurrent first submissions must converge to one retained outcome: identical proposals receive it, while different proposals produce one winner and a conflict. No particular contender must win. Change references are opaque and container-scoped; prototype hashes and globally unique bare identifiers are not required.

The persistence binding owns atomic container ownership and retry constraints. A successful proposal is returned only after its record and retry binding commit together. Keep transactions short and perform no model calls, worker launches or application-source effects. A storage error can leave the outcome unresolved; it is not proof of rollback or permission to invent another request identity. Retrying the same intake identity must reconcile before inserting. A known failed insertion can be repaired externally and retried without reserving a false success or creating duplicates.

The SQLite binding uses an explicitly supplied persistent file, bounded lock waiting and full synchronous writes with transactional journaling. It rejects in-memory/URI shortcuts and implicit storage discovery. Initialization and reopening are distinct caller intents: opening an existing store fails on a missing file or schema rather than creating a replacement. Authorized initialization accepts only an empty store. The binding identifies its native schema separately from prototype storage and refuses unsupported, partial or unrecognized schemas rather than resetting or silently migrating them. Validate retained field types, identity/context and a stable integrity digest before returning a retained record; detected corruption or missing grounds under a retained identity remain unavailable, not reconstructed. The digest encoding must be explicit and versioned, not a language's default hash or debug formatting. A digest detects inconsistent retained data; it does not protect a database from an attacker who can rewrite both data and digest. File protection remains a host obligation.

The result means only retained intake awaiting assessment. It grants no Decision approval, execution eligibility, Check success, publication or completion. Original intent is immutable in this boundary; later clarification/revision, candidate custody, Work, publication, retention cleanup and recovery of application effects require separately supported capabilities. Process-interruption, lock-contention and retry tests establish only their declared local behavior, not physical power-loss durability, backup qualification or cross-store recovery.

Keep native types and validation in the Kernel, coordination in Application, the atomic persistence contract in Ports and SQLite machinery in its Adapter. Expose only the bounded library operations needed here. No generalized repository framework, speculative modules or second authoritative copy of source State is required. The existing plain-JSON intake cases are shared semantic evidence; SQLite fault injection and schema inspection stay in implementation-specific runners. Additional recovery cases cover a committed intake whose reply is lost, competing first submissions with different content, contention followed by retry, and the same request identifier in independently owned containers. TypeScript reference success does not establish Rust conformance.

## Native committed-source observations

The first native source observer captures a bounded, explicitly selected Git commit view. This is a read-only library capability that supplies possible grounds for later candidates and assessments, not a live working-tree reader, automatic discovery, baseline adoption or a second authoritative source store. Dirty and untracked files are outside this view; never describe a committed snapshot as the current workspace or as fresh enough for an effect merely because it was readable.

The host supplies the authenticated actor, owning container, source identity, approved repository and Git executable paths, allowed file paths and exact full commit identifier. Source bindings and tool selection are trusted host configuration, not fields inferred from What/Why or instructions in repository content. Reuse the intake container-access boundary before observing; a guessed source identity or commit grants no access. Preserve operational unavailability as distinct from authorization denial; a locked or failed store does not prove a permission decision. Returned observations bind the container, source identity and exact commit. The host must protect configuration and source access; this library is not operating-system containment.

Support only ordinary repositories with an in-place `.git` directory and locally available objects. Linked-worktree indirection, external alternate object stores, partial/promisor repositories, symlink traversal and submodules are unsupported in this first profile. Use the explicitly configured Git executable without a shell. Repository hooks, aliases, filters, pagers, replacement objects, inherited Git configuration/environment overrides and automatic fetching must not redirect observation or execute source-selected code. Missing objects or an unsupported reader/configuration produce unavailable results, not a fetch, fallback or reconstructed source.

An observation request contains at most 64 distinct, explicitly allowed, forward-slash relative paths. Each path is valid UTF-8, at most 1,024 bytes, and contains no control characters, empty segments, `.` or `..` segments; preserve accepted spelling without normalization. A present ordinary file returns its exact bytes, executable/non-executable mode, native object identity and a versioned SHA-256 content fingerprint. Support binary contents without text conversion. Capture at most 1,048,576 bytes per file and 8,388,608 bytes in total. Metadata and diagnostic output also need finite bounds. These are bounds for this profile, not universal limits on application State.

Readable Git objects are not proof of their advertised identities. Verify the exact captured commit, each selected tree edge and each returned blob against its native object identity before using those bytes. Derive lookups from the verified tree bytes, not a second potentially different read. This verifies the selected chain, not the entire repository or its history.

Absence is a distinct result, supported only by successful lookup in the selected immutable tree. A failed lookup, denied access, missing object, unsupported entry or unsupported ancestor is not evidence of absence. Every returned path belongs to the same selected commit. Return the complete requested result or a failure, not a misleading partial success or silently omitted path. Results cover only the requested paths; they do not assert whole-repository completeness or current-ref freshness.

Child execution has a finite deadline, bounded input/output and explicit cleanup on every exit, including success, nonzero status and cancellation. Leader exit or closed output streams do not prove descendant cleanup. Settle the owned process group and I/O workers before reporting success; if cleanup cannot be confirmed within a bounded grace period, report unavailability rather than successful custody. Observation must not alter repository files, references, index, configuration or source bookkeeping, and must not create a durable capture archive or modify intake storage. Permission to read is not permission to retain, disclose, adopt or publish. Later use as assessment grounds requires separately supported retention, disclosure and freshness checks. Test in disposable external repositories, including hostile configuration, unsupported source forms, oversized output, missing/corrupt objects and attempted path/scope escapes. No successful capture is a Check result, approval, publication or completed Change.

## Native private continuation profile (proposed)

**Design proposal for user confirmation, not an approved contract or implemented capability.** This is a bounded continuation of native intake and committed-source observations for the first software-development application. It does not reinterpret `changekernel.container-candidate-batch@1.0.0`, historical TypeScript records or lifecycle stages. Decision admission, delegation, Work, Checks, publication and completion remain separate capabilities.

### Proposed authority and retention policy

Keep the native intake profile's single authenticated container owner. That owner may revise private intent and prepare or inspect private candidates under the host's current applicable permissions; this grants no execution or approval authority. Source-read permission alone does not authorize keeping a copy. The trusted host must separately authorize retention and historical delivery for the exact source binding, container and paths. These permissions are supplied outside proposal content and are rechecked on every operation, including retries and historical reads. A host may configure a standing grant for the declared scope; this does not require a human confirmation on every call. A missing or revoked permission cannot be replaced by a previously retained grant.

Retain accepted intent revisions, candidates and required grounds in protected durable storage without automatic expiry or eviction in this first profile. Accept only a host policy that permits that retention; expiry, purge, redaction and sharing requirements that this profile cannot enforce are unsupported, not silently waived. Current denial of delivery does not erase protected history or permit disclosure. Host policy unavailability and damaged custody remain unavailable, distinct from an explicit denial. Backup, physical power-loss durability and complete retention administration are not established by this profile.

### Attributable intent revisions

The original intake receipt remains immutable and keeps its existing interpretation and identity. It anchors revision zero. Later revisions retain exact What and optional Why, authenticated actor, request identity, expected prior revision and a stable revision identity. They do not infer an absent Why, normalize text, rewrite the original receipt or claim admission. The existing identifier and text bounds apply. Additional interpretation, commitments and adopted State references are not fabricated from these two text fields.

An append compares the expected current revision and retains the new revision, head and retry binding atomically. Concurrent different requests against one head have at most one winner. An exact retry returns its retained result even if the head has since advanced; changed input under the same operation-scoped request identity conflicts. Current access is still required. Reads return the current head or an explicitly identified historical revision without replaying work. Missing or corrupt revision/head/retry grounds are unavailable, not reconstructed from a different surviving record. Material revisions cannot silently retarget an existing candidate or carry forward future approval by changing a head pointer.

### Exact file-candidate custody

A private file batch binds one container, Change, exact intent revision, trusted source-binding identity/revision and explicit full Git commit. It contains whole-file proposed bytes and mode, or deletion, for distinct explicitly allowed relative paths. Creation versus replacement follows verified prior presence/absence. Rename is a declared deletion and creation, not an inferred operation. Explicit read-only dependencies may be retained from the same commit; this does not discover all relevant dependencies or prove domain correctness.

Use the native observer's path, file and capture bounds: at most 64 selected paths across effects and dependencies, at most 1 MiB per file, and at most 8 MiB of captured prior file bytes. Proposed file bytes have a separate 8 MiB total bound. Retain exact verified prior bytes/modes/identities or verified absence alongside the immutable proposed values and provenance. Retained grounds must survive loss of the live Git objects; a digest or commit identifier alone is not custody. An unknown, denied, unsupported or corrupt observation is never absence. Source text remains data.

The application obtains grounds through the trusted observation boundary, not a caller's assertion that a `CommittedObservation` value is authentic. The host must version binding identity when its interpretation or resource mapping changes. Historical delivery requires a current authorized binding/grant, but does not reopen Git to reconstruct a missing retained capture or claim that the historical commit is current.

Preparation reads Git outside short database transactions. Before a new batch commits, its atomic store operation verifies container/Change ownership and the expected intent head, then retains the complete batch, grounds and retry binding together. An exact retry reconciles an existing batch before attempting another capture or applying the new-preparation head condition; it returns historical custody, not renewed eligibility. Different input under the same operation-scoped retry identity conflicts. A different request may prepare another immutable batch. No candidate operation writes source files, refs, the index or generic application State.

Inspection returns exact retained material and its bound intent/source versions. A historical candidate remains historical after intent changes; this first custody boundary does not label it currently approved, fresh for publication or executed. Missing retained grounds block delivery rather than trigger recollection. Later guarded effects must recheck current intent, policy, source state, required assessments and authority.

### Shared native persistence boundary

Use one explicit protected SQLite bookkeeping profile for original intake, revision heads/history and candidate custody. The profile is initialized deliberately in an empty store; opening never performs DDL or upgrades. Existing native intake-only stores remain supported as intake-only stores, with richer operations unavailable until a separately supported transition exists. There is no automatic import of historical TypeScript storage or native intake-only data into the richer profile.

The richer schema has its own exact version and full schema validation. Adding capabilities must not make foreign tables, triggers, indexes, partial schemas or unexpected journal changes acceptable. Original intake hashes and retry meanings remain unchanged. Transaction guards, schema selection and the minimum shared Rust contracts need one coordinated implementation before independent feature implementations. No generalized repository framework, new runtime dependency or separate authoritative task store is implied.

## Change-owned multi-entity candidates

A Change can carry multiple immutable candidate batches, not just one record. Each batch retains the complete declared effects for its step: whole-entity creations, replacements or deletions, explicit relationships, and version-bound dependencies. Existing related entities remain authoritative in their sources; retain only the exact observations needed as grounds, not a second writable current copy. New entity values are durable private candidate material before assessment and become authoritative State only through a later permitted publication.

The bounded `changekernel.container-candidate-batch@1.0.0` contract uses source-qualified entity identities, versioned host-declared entity types, whole values and explicit links. A null expected version means required observed absence. A non-null expected version binds an existing entity; a null proposed value then means deletion. Every proposed link must point to a surviving entity in the batch or an explicit versioned dependency. This checks the declared graph only: it does not discover hidden dependencies, enforce incoming relationships outside that graph, or establish domain or aggregate constraints.

The host installs a bounded type definition with an expected prior digest. This declares draft interpretation, not adopted Check policy, native schema migration or permission to publish. Definitions and candidate grounds remain retained when later definitions change. The first type declaration supports named fields with JSON value kinds; it does not claim full native-schema or nested-domain validation. Canonical input limits reject unsupported values and non-normalized Unicode rather than silently modifying them. Effects and dependencies are sorted and unique; each batch permits at most 64 effects, 64 dependencies and 1 MiB of admitted text, with a separate 1 MiB bound for retained observations.

The SQLite adapter retains the entire batch, its initial authorized observations and retry binding atomically. Retry identity covers container, authenticated actor and request identifier; different Change, values, relationships or dependencies conflict under that identity. A new request may retain another batch under the same Change without erasing or adopting earlier ones. Exact retries return retained bytes even when current observations make them stale. Draft rows do not create or modify rows in the generic entity store or a native source.

Freshness is `current`, `stale` or `unknown`, assessed over the installed definition, source binding identities and the exact observed versions/values. It is not Check success, acceptance, a global snapshot, a reservation or a guarantee that State will remain unchanged until publication. An absent source or revoked source access blocks delivery; an explicitly authorized source returning unknown coverage permits historical retrieval but not a new preparation. Corrupt or missing retained grounds block retrieval, never trigger reconstruction. Trusted host observation bindings are synchronous, bounded and read-only; they must enforce actor and container scope on every call. They are not discovered or invoked from submitted content and provide no mutation capability.

Inspection reports unknown generic coverage before definition installation and observed empty or present generic storage afterward. It says nothing about emptiness of native sources. Candidate inspection advertises no Check or publication capability. The candidate schema is separately versioned and additive to intake v1; incompatible, partial or unversioned draft storage is refused rather than reset or silently migrated. Indefinite retained custody is currently limited by available storage, with no automatic eviction or completed retention/backup policy. Process-interruption tests are not qualification of physical power-loss durability or cross-store transactions.

## Guarded publication

1. Observe relevant State, relationships, constraints and commitments under authorized scope.
2. Prepare a durable exact candidate and any required recovery grounds.
3. Complete applicable assessment and approval outside long-held locks.
4. Begin a short supported publication transaction; recheck authority, relevant versions and aggregate/relationship conditions.
5. Apply the authorized effects and retain their receipt in the same transaction where the binding genuinely supports it.
6. Commit, reconcile the outcome and obtain observations needed for Review.

Sharing a database is not enough: native handlers and ChangeKernel receipts must actually use the same transaction context. Do not approve prepared effects and then rerun an unconstrained program against live State assuming identical effects. Private draft persistence, requests and Work can have earlier transactions with their own rules; publication is not the first possible write.

Row versions alone do not guard collection membership, aggregate budgets or semantic conflicts. Bind relevant dependencies and use supported locking, constraints, reservations or equivalent guards. Three €400 commitments exceed a €1,000 limit even when pairwise checks appear compatible. Reservations represent authorized commitments; worker leases only coordinate execution. Long-running Changes do not hold months-long transactions or broad locks.

## Separate stores and uncertain outcomes

Where mutation and ChangeKernel storage cannot commit together, durably retain intent, candidate and recovery grounds first. The source mutation and a trustworthy source-side receipt must commit atomically, or the binding must provide an equivalent qualified outcome protocol. ChangeKernel then records the receipt reference. Reconcile that operation identity before any retry after a lost response.

A [transactional-outbox-style](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) receipt does not require a message broker. Without trustworthy outcome lookup or equivalent protection, no metadata sidecar can promise safe automatic replay. Unsupported guarantees remain explicit. Containers do not make unrelated stores one atomic transaction; external effects need their own outcome and recovery protocols.

## History, protection and recovery

Git-inspired immutable identities, versions, candidates, differences and guarded references are useful mechanisms, not a mandate to put every resource in Git. A Change can span many attempts, transactions and external effects. History supports recovery from a bad Change; backups address storage loss. Protect both against ordinary worker mutation and test restoration.

Recovery normally makes a new guarded transition. Reverting a budget should preserve a later valid rename where possible, then reassess dependent constraints. Bind covered failures, retention, concurrency assumptions and exclusions. Restoring data, compensating an external action and containing further harm are different outcomes. The following recovery obligations apply to the declared binding, not every possible outside consequence.

## Recovery and continuation obligations

Declare covered resources/effects, failure assumptions, retention, concurrency conditions, backup/restore support and exclusions. Protect required grounds before effects and preserve independent recovery/operator access when work can disable its controller. Whole-database restoration can destroy later valid work even within one container; conflicts with later changes require investigation or authorized choice, not blind inverse patches.

Distinguish authorization, launch, observation, retained execution result, attempted write, committed receipt and observed State. Reconcile source outcomes and live process/provider custody separately. An expired lease, absent process-local tracking or a worktree is not proof of quiescence. Unsupported outcome lookup prevents claims of safe automatic replay. Record original failure, attempted repair, actual resulting observations and unresolved consequences; recovery success need not complete the original goal.

A fresh worker recovers intent and purpose, relevant definitions/policy, exact assessments, candidates, commitments, Work, outcomes and adopted guidance. Verify current access and freshness before continuing. Historical retrieval does not adopt policy or launch missing work. Missing, private, expired or corrupt grounds limit assurance; never recreate them by rerunning models or effects.

Initial adoption of an existing source records an honest baseline, not fictional prior Changes. Supported outside writes are drift. Synchronization binds source-specific versions, scope and coverage; it does not turn unrelated stores into one transaction. Git bindings retain required objects/refs and account for history rewriting or missing remote metadata. A host merge flag is not semantic acceptance, and incoming artifacts need assessment of the actual combined candidate. Reads do not silently repair State; remote disclosure, publication and deployment require their applicable authority.

Retain exact Evidence subject, source/version/passage, method, observation time, assumptions and limits. Trace references need durable authorized custody; export cannot copy private execution storage indiscriminately. Authorized redaction/deletion can limit later verification and must be reported honestly. Rebuildable indexes or embeddings cannot recreate missing source bytes. Assessment reuse follows the [Check contract](checks.md#efficient-evaluation-and-reuse), not merely byte equality or the presence of a favorable citation.

The richer source, intent-revision and memory contracts above describe desired behavior, not capabilities silently added to the current adapters. The retired TypeScript reference intake used an application-supplied SQLite file, separately from its candidate-batch interface. Its implementation and tests remain in Git history, not the current package. `changekernel.container-intake@1.0.0` retains an explicit owner, exact What/Why text and one retry-bound proposal per request. Its `awaiting-assessment` state is not Decision approval, a managed value or a publication receipt. Transactions bind intake and its retry identity in one row; reopening never clears it. The host authenticates the actor for each call and protects the file; no self-asserted actor or inferred membership grants access. This is not a generalized native-source adapter, qualified physical crash guarantee, complete retention policy or engine-wide store selection. Other storage interfaces, upgrades and broader transaction integration remain unselected and unqualified. This document does not generalize existing Git-shaped ports by name alone. The [primary design](../../product/changekernel.md) owns the overall model; [execution](agent-execution.md) owns worker custody and [release qualification](package.md#qualification) owns the required proof.
