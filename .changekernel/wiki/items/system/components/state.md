---
title: State and Persistence
aliases: []
source-id: cw:component:state
ownership:
  sourcePatterns:
    - .changekernel/config.json
    - src/adapters/git/**
    - src/adapters/sqlite/**
    - src/ports/project-store.ts
    - src/ports/container-intake-store.ts
    - src/ports/container-candidate-store.ts
    - src/kernel/containers/**
    - src/kernel/evidence/**
    - src/kernel/wiki/**
  testPatterns:
    - tests/adapters/git/**
    - tests/adapters/sqlite/**
    - tests/ports/project-store.test.mjs
    - tests/kernel/containers/**
    - tests/kernel/evidence/**
    - tests/kernel/wiki/**
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

The richer source, intent-revision and memory contracts above describe desired behavior, not capabilities silently added to the current adapters. Implemented intake uses an application-supplied SQLite file, separately from the candidate-batch interface described above. `changekernel.container-intake@1.0.0` retains an explicit owner, exact What/Why text and one retry-bound proposal per request. Its `awaiting-assessment` state is not Decision approval, a managed value or a publication receipt. Transactions bind intake and its retry identity in one row; reopening never clears it. The host authenticates the actor for each call and protects the file; no self-asserted actor or inferred membership grants access. This is not a generalized native-source adapter, qualified physical crash guarantee, complete retention policy or engine-wide store selection. Other storage interfaces, upgrades and broader transaction integration remain unselected and unqualified. This document does not generalize existing Git-shaped ports by name alone. The [primary design](../../product/changekernel.md) owns the overall model; [execution](agent-execution.md) owns worker custody and [release qualification](package.md#qualification) owns the required proof.
