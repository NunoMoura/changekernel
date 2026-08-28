# CodeWiki Semantic Kernel Plan

## Purpose and status

This is the active architecture and implementation roadmap after completion of Backend v1. Backend v1 culminated in the independently governed release candidate at commit `559331a1af9cc89f0d8ab3305ea129ef4b2489cb`; `BACKEND_V1_PLAN.md` and `REFACTORING_PLAN.md` remain completed historical evidence.

The objective is to evolve the qualified Backend v1 into the CodeWiki Semantic Kernel without weakening deterministic identity, expected-head compare-and-swap, provenance, replay, recovery, bounded execution, or one-writer authority.

This plan orders delivery. It is not canonical runtime input or a compatibility promise. During the transition:

- `.codewiki/kb/**` remains the current Backend v1 intended Product and System truth;
- `.codewiki/wiki/**` is the target canonical path and must not appear through an ad hoc rename;
- `src/**` and `tests/**` remain executable truth;
- Git remains history and checkpoint evidence;
- released controller N governs committed candidate N+1 from outside this checkout;
- this source repository may dogfood only an externally installed immutable release that passed exact-subject qualification and explicit activation; released N still governs N+1 and never loads mutable candidate code;
- CodeWiki is never installed or loaded from this repository's `.pi/` directory;
- generated views and private runtime state remain outside canonical project meaning.

The exact SK0 baseline `e3e06723242b4115c28a9a716fd817ae23f439f7` and SK1 contract laboratory `5735315aa6d220115f033f863a4fc5c63ed2694b` passed external governance. Dogfood-readiness successor `32752d604e26ed7f759e6fa0bbf529097c537360` passed exact-subject qualification under activated controller `ed85062f181652e5083210ac666bdb5fb74e46a8` and was explicitly activated for private local external installation. SK2 implementation is in progress at its read-only migration-readiness boundary; no target protocol or `.codewiki/wiki/**` root is active. `SEMANTIC_KERNEL_SK0_CONTRACTS.md` records the contract ledger, transformation inventory, protocol versions, migration and rollback edges, release gates, scenario fixtures, and retained evidence.

## Product objective

CodeWiki becomes a headless semantic operating kernel for governed agentic work. It owns shared project meaning, mandatory Git-backed canonical state, controlled semantic evolution, work admission, independent evaluation, Change completion, protected effects, and exact recovery. It exposes one stable Kernel API with canonical transport bindings, Client SDK, and Plugin Protocol without owning an end-user product interface or provider-specific remote mechanics.

First-party presentation is limited to scriptable commands and a small terminal-first CodeWiki Console analogous to `systemctl`, `journalctl`, `top`, or Task Manager. It observes health, canonical Git/Wiki and Change heads, Work, Runs, Gates, effects, Plugins, and recovery through public versioned APIs; it is read-only by default and owns no rich authoring experience. A rich CodeWiki App remains a separate external product even when maintained by the CodeWiki team. It receives no privileged imports or hidden authority.

The governing principle is:

> Git versions canonical project state. Host OS governs resources. DSH governs agent execution. CodeWiki Semantic Kernel governs shared meaning, Change, authorization, and completion. CodeWiki Plugins govern only admitted external mechanics. Applications govern experience.

Linux x64 remains the first and only currently qualified production host. Portability is a contract goal, not an inferred support claim.

## Fixed vocabulary

| Term | Meaning |
| --- | --- |
| CodeWiki Semantic Kernel | Headless authority owning canonical Git admission, Wiki meaning, Changes, Work, Gates, Alignment, AuthZ, replay, completion, and guarded effects. |
| Git Project Store | Mandatory local repository and configured canonical ref for every governed Project/domain; native commit/tree/ref identity versions project artifacts, Wiki, and append-only Change traces. |
| Change | Accountable primitive leading one intention from proposal through accepted Wiki change and frozen Completion Requirements to completion. |
| Change proposal version | One exact proposal commit OID; its tree contains the appended `change.proposed` operation and any proposed Wiki Item bytes. |
| Wiki | Singular Git-versioned materialization of agreed descriptive, historical, and normative project knowledge. |
| Wiki Item | Sole first-class Wiki semantic unit, with stable in-content identity independent of path, title, body, or Git OID. |
| Change disposition commit | Authorized two-parent Git commit retaining exact proposal ancestry, applying or excluding proposed Wiki bytes by disposition, appending terminal Trace, and advancing canonical ref by CAS. |
| Change Completion Requirement | Frozen provider-neutral condition that must be satisfied before accepted Change completes. |
| Change completion | Project Server-derived state proving every frozen requirement; an explicit empty list completes in acceptance commit. |
| Raw Data Source | External/local information origin that may mutate, disappear, conflict, or restrict access. |
| Raw Data Revision | Exact immutable source version observed by CodeWiki, with payload custody determined independently by policy. |
| Raw Data Policy | Frozen capture/retention rule resolved within operator/legal constraints before intake. |
| Evidence Record | Immutable provenance-bound observation over exact Raw Data or native protocol records; neither payload custody nor Result. |
| CodeWiki Plugin | Admitted implementation of one bounded external source, remote, workspace, verification, integration-preparation, Delivery, or namespaced capability. |
| Plugin Protocol / SDK | Language-neutral Plugin contract and non-authoritative developer libraries/manifests/fixtures/test kit. |
| Check | User-custom independent evaluation. Non-negotiable lifecycle correctness is Kernel Validation. |
| Check Pack | Grouping/transport of Checks only; no inherited activation, enforcement, lifecycle, or execution authority. |
| Kernel API / Client SDK | One versioned operation/event/error contract, its canonical transport bindings, and non-authoritative client libraries. |
| Execution Host Contract | OS-neutral guarantees required to supervise and contain one exact DSH Run. |
| Work Continuity | Project Server-owned durable producer-Run sequence for one exact stage subject across fresh physical Sessions. |
| Physical DSH Session | One DSH-owned execution epoch belonging to one in-flight producer Run and closing with terminal Receipt. |
| Run Context Bundle | Immutable authorized read-only local query materialization built for one Run after canonical replay and WorkState reduction; execution input/evidence, never continuity authority. |
| Canonical rehydration | Deterministic replay of canonical/proposal Git commits, fixed-path Wiki/Trace blobs, authority, feedback, requirements, Evidence, Results, capabilities, and predecessor Receipt; rebuilds WorkState, then materializes a Run Context Bundle for a fresh Session. |
| AI Gateway | Credential/account-route/network/budget/retry/provider-request boundary; owns no project authority. |
| AI Provider | External model supplier or local inference service reached through AI Gateway and qualified DSH mechanics. |
| CodeWiki Console | Minimal first-party scriptable/terminal Client over public Kernel API. |
| CodeWiki App | Separate rich application using public Kernel API/SDK without privileged authority. |

“Knowledge Base,” “Project Oracle,” and “Oracle” are not target subsystem names. Systems users call knowledge bases enter as Raw Data Sources unless an accepted Change adopts their meaning into Wiki Items.

## Fixed architecture

```text
CodeWiki App / Console / other Clients
    │ Kernel API + transport binding / Client SDK
    ▼
CodeWiki Semantic Kernel
├── mandatory local Git Project Store
│   ├── ordinary project artifacts
│   ├── .codewiki/wiki/items/**
│   └── .codewiki/changes/** append-only Change traces
├── Change lifecycle and completion engine
├── bounded context, Alignment, Work, Checks, and Gates
├── identity-proof validation / AuthZ / Git-ref CAS / replay
└── guarded effects
    ├── DSH Agent Runtime ── AI Gateway ── AI Provider
    └── CodeWiki Plugin Protocol
            ├── source.observe
            ├── remote.observe / remote.publish
            ├── workspace.prepare / verification.observe
            ├── integration.prepare / delivery.apply
            └── namespaced capabilities
                    ▼
             admitted CodeWiki Plugins
                    ▼
              external systems

Execution Host Contract
    ▼
Host OS
```

Git is mandatory Kernel infrastructure for every domain, not a project-store Plugin. Kernel Build binds supported Git implementation/version and sanitized plumbing profile; hooks, filters, notes, replace refs, ambient credentials, and worktree transforms cannot influence authoritative operations. Project Server alone validates complete objects/history/diffs and writes canonical or managed CodeWiki refs. Canonical first-parent history is accepted project state; `refs/codewiki/changes/**` retain active proposal history until a two-parent disposition commit makes it reachable from canonical history. Reflogs and unreachable objects are never retention. Replaceable remote hosts, external workspaces, source systems, verifiers, object services, collaboration products, and Delivery providers remain outside fixed authority behind Plugin Protocol. Public Client, Plugin, and Check SDKs are non-authoritative.

## Authority ledger

| Owner | Exclusive authority | Explicit exclusions |
| --- | --- | --- |
| Project Server | Identity-proof validation, Actor mapping, project AuthZ, canonical Git-ref admission, Change acceptance/completion, scheduling, Gate reduction, integration/Delivery authorization, replay, recovery. | Login UX, identity issuance, provider mechanics, DSH internals, host enforcement, app experience. |
| Git Project Store | Native object, commit, tree, worktree, ancestry, and ref-CAS versioning for canonical project bytes. | Actor authority, semantic validity, Results, completion, external-effect truth. |
| Change | Stable intention/accountability plus proposal rationale, derived Wiki change, authority intent, outcomes, Completion Requirements, and lifecycle. | Git version identity, canonical-ref write, Plugin execution, self-completion. |
| Wiki Item | One unit of accepted meaning with aliases, relationships, provenance, and body. | Runtime, completion, deployment, raw-source custody, indexes, credentials. |
| Change Trace | Sole append-only dossier for proposal versions, feedback, judgment, authority, acceptance, work, completion, retirement, and protected effects. | Peer Change snapshot, raw execution log, duplicate Wiki body, lossy-summary authority. |
| Raw Data | Source/Revision/Slice manifests, payload custody, ACL, capture/retention policy, availability/deletion Receipts. | Ongoing source connections, interpretation, accepted meaning, Result/Gate judgment. |
| Evidence | Immutable bounded observations with provenance, method, authority, coverage, freshness, and limitations. | Payload custody, Change acceptance, Result/Gate judgment. |
| Alignment | Derived support/satisfaction among Raw Data, Wiki Items, Git artifacts, Evidence, requirements, and Delivery. | Canonical meaning, causal invention, authority grants. |
| Runtime | Bounded execution, opaque Session custody, execution Evidence/Receipts, Runtime Build custody/qualification. | Project AuthZ, acceptance/completion, Gate reduction, integration, Delivery. |
| DSH | Session internals, provider mechanics, tools, compaction, model history, DSH Plugin lifecycle, live Agent execution. | Project meaning, CodeWiki Plugin admission, Results, protected effects. |
| AI Gateway | Provider credentials, account routes, network, request budgets/retry, delegated transport enforcement. | Project AuthZ, semantic meaning, completion. |
| CodeWiki Plugin | One admitted external capability request and its observations/proposed artifacts/provider effects/Receipt. | Canonical Git-ref write, self-admission, ambient authority, Results, acceptance/completion. |
| Host OS | Process, memory, CPU, I/O, filesystem/network enforcement, handles, isolation. | Agent semantics, project meaning, application experience. |
| Applications / IdP | Experience, login/SSO/MFA/token acquisition, authenticated API use. | Unsigned identity authority, direct canonical writes, lifecycle validity, unauthorized protected effects. |

No component receives source observation, semantic acceptance, and protected mutation authority together. Login UI is not AuthZ: Project Server validates configured proof and enforces every command, query, redaction, canonical-ref advance, and protected effect.

## Change lifecycle and completion

Change is one normal primitive represented by one append-only JSONL trace across native Git commits. Proposal edits create immutable commits under one stable Change ID. Decision always evaluates one exact proposal commit.

```text
canonical B ────────────────┐
  └─ proposal P → Decision D│  managed Change ref
                            ▼
                   disposition commit X
                   parents: [B, D]
                   canonical-ref CAS B→X
                            │
             accepted + [] → completed
             accepted + requirements → Planning → work → completed
             reject/defer/withdraw → first-parent Wiki retained
```

Proposal commit `P` contains one appended `change.proposed` operation plus any proposed Wiki Item bytes. Project Server derives Item changes from `P` versus its parent. Non-empty Wiki diff with no requirements is a Wiki-only Change. Non-empty diff with requirements continues to realization. Empty diff with non-empty Item-targeted requirements is conformance repair. Empty diff plus empty requirements is invalid.

Rules:

1. One `.codewiki/changes/TRACE-CHG-<id>.jsonl` dossier is the sole semantic Change representation. Typed operations own proposals, feedback, Decisions, acceptance, requirements, work, Results, effects, and completion; current state is reduced, not duplicated.
2. Each `change.proposed` operation owns intent, rationale, authority intent, outcomes, relationships, complete requirements, and completion rationale. Its containing proposal commit OID is the version; native first-parent/tree/path/blob identity supplies all other version facts.
3. Every proposal commit's first parent is exact canonical base. A later proposal uses prior managed tip as second parent, carries its Trace prefix, and expresses the complete proposal against current canonical bytes. Other branch commits append Trace only. Project Server derives Item add/edit/move/retire from first-parent/proposal trees and stable IDs; no authored impact mode, shadow operation, rename heuristic, or compiler plan exists.
4. Active history is reachable through a deterministic managed Change ref. Complete backups and publication refspecs include these refs; proposal or rejected bytes are visible to all repository readers and never carry selective secrets.
5. Decision Checks judge exact Candidate/proposal/tree. They never author accepted bytes or complete Change.
6. Confirmation revalidates Actor, authority, Candidate, Gate, proposal commit, managed-ref tip, expected canonical commit, derived Wiki diff, and active Changes.
7. Terminal disposition creates one commit with first parent equal to expected canonical and second parent equal to exact managed-ref tip. Acceptance uses proposed Wiki; rejection, deferral, or withdrawal retains first-parent Wiki. All retain complete proposal ancestry and terminal Trace.
8. Each new Trace blob preserves its predecessor as an exact byte prefix. File order supplies operation order; Git commit/path/blob identity replaces record-digest chains and custom Trace tips.
9. Trace compaction, truncation, replacement, and deletion are forbidden. Rehydration projections/summaries bind exact source commit/path/blob/range, remain non-authoritative, and never replace full history. Planning, Implementation, and Review consume immutable accepted proposal commit, canonical commit, derived Wiki tree, and requirements; they cannot rewrite them.
10. Plugins return observations, proposed artifacts, effects, and Receipts. Checks return Results. Project Server alone derives satisfaction and `change.completed`.
11. Empty requirements are explicit and Decision-validated; required Delivery blocks completion; failed work leaves unresolved requirements and Alignment gaps.
12. After acceptance, correction/supersession is a new Change proposal and disposition commit. Applications must not treat Wiki head as current physical behavior or Delivery.

## Canonical, private, and derived state

Target canonical Git tree:

```text
.codewiki/
├── wiki/items/**               # one canonical Wiki Item per file
├── changes/
│   └── TRACE-CHG-<id>.jsonl    # sole append-only dossier per Change
├── check-packs/**              # project Check declarations
├── check-packs.lock.json
└── config.json                 # repository ID, object format, canonical-ref policy, project config
```

Canonical invariants:

- one mandatory local Git repository and configured canonical ref;
- Project Server is sole canonical and managed CodeWiki ref writer and uses expected-old-commit CAS;
- accepted Wiki, append-only Change traces, and ordinary project artifacts are Git-versioned files;
- bootstrap creates canonical config commit; exact Wiki is derived from `.codewiki/wiki/items` at that commit, with absent path meaning empty; no snapshot wrapper or custom State/Projection/Checkpoint;
- UTF-8/LF canonical Item bytes, stable IDs independent of paths/OIDs, portable paths, no symlinks/reparse points/case collisions/reserved names;
- one Item per file; aliases, relationships, provenance, attributes, and body belong to Item;
- retired IDs remain reserved through Git/Trace history; no tombstone file;
- no generated index/database as canonical authority;
- provider Plugin cannot write canonical or managed CodeWiki refs.

Private state remains below one external `$CODEWIKI_STATE_ROOT`. Raw Data payloads, credentials, DSH Sessions, caches, sockets, leases, indexes, embeddings, graph stores, temporary files, and operational residue never enter canonical Git. Derived Views—indexes, backlinks, summaries, embeddings, graph databases, source indexes, freshness dashboards, WorkState, Alignment—are reproducible/disposable.

## Raw-data observation and use

```text
external connection implementation
    │ authorized source.observe Plugin
    ▼
immutable Revision → capture/custody → Evidence + Alignment + Change Intake
    │
    ▼
proposal commit with appended Change operation and optional Wiki Item diff
    │
    ▼
Decision + confirmation → two-parent Git disposition commit
    ├── empty requirements → completed
    └── requirements → Planning → Implementation → Review
                         → required Delivery, if any → completed
```

Raw sources are material, not Evidence and not guaranteed truth. Before intake commit, operator/legal constraints, source/project defaults, and authorized Request resolve `metadata_only | cited_slices | full_revision` capture plus `transient | ttl | while_referenced | pinned` retention. Evidence records bounded observation over exact Revision/Slice; Results separately judge it.

Watching, polling, webhooks, provider cursors, retries, extraction, normalization, entity resolution, reconciliation, apply, verification, and connection health remain external. CodeWiki admits exact observations and no-change Receipts through `source.observe`; project policy and Checks judge freshness/coverage. New, missing, revoked, or expired support stales Alignment and reusable context/Results and may open Change Intake. No external connection or Plugin mutates Git Wiki files.

Web pages, documents, provider responses, and deterministic extractions enter Raw Data under policy. Unretained/expired/revoked/deleted material remains unavailable provenance. Refetch creates new Revision. Material assertions cite source slices; supporting, contradicting, superseding, generator, verification, freshness, and access facts remain separately attributable. Independently governed assertions become Wiki Items; otherwise they remain content of one owning Item.

ACL filtering occurs before model context. Mixed-access synthesis splits or inherits strictest supporting access unless authorized declassification exists. Revocation stops retrieval leakage, marks support unavailable, invalidates affected context, and may create governed intake.

## Check and Gate target

- Only Decision, Implementation, and Review accept custom Checks.
- Planning uses Kernel Validation and user configuration, not custom Checks or an empty Gate.
- A Check without activation conditions is active by default.
- Activation uses frozen deterministic facts, never model claims, routes, Workbench configuration, mutable labels, or proposed Check bytes.
- Effects are exactly `required | advisory | observe`; omission means `required`.
- Required failure fails the Gate; required operational unavailability stops it.
- Advisory failure emits warning and feedback without failing the Gate.
- Observe records evaluation only.
- Quantitative measurements become binary after threshold comparison; Gates have no score, weight, or aggregate ranking.
- Evaluator kinds are `code | model | evidence | human`.
- Human evaluation is authenticated subject-bound Evidence with actor, role, independence, disposition, head, and time.
- Packs contain Checks only. No Pack Skills, inherited activation, enforcement override, hidden defaults, ordering, or conflict resolver survives.
- Pack composition is deterministic union. Qualified identity is `<pack-id>/<stage>/<check-id>`.
- Installing starter Packs is always explicit. Deleting all custom Checks cannot weaken Kernel Validation.

## CodeWiki Plugin target

CodeWiki has one provider-neutral Plugin Protocol for external mechanics, not separate source, remote-host, CI, deployment, or domain-specific driver subsystems. Mandatory local Git remains Kernel infrastructure rather than a Plugin. A Plugin Manifest declares immutable implementation/dependency identity, protocol range, configuration schema, permissions, host/isolation requirements, qualification Evidence, and bounded capabilities. Project configuration may select only operator- or release-admitted manifests and cannot install executable code or widen authority.

Standard capability contracts are:

| Capability                        | Responsibility                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `source.observe`                  | Admit one bounded external observation and immutable Revision material/Receipt without Wiki authority. |
| `remote.observe` / `remote.publish` | Observe or publish exact provider heads without canonical-ref authority.                              |
| `workspace.prepare`                 | Prepare one isolated Assignment workspace under Project Server custody.                              |
| `verification.observe`              | Return exact-Git-snapshot observations without Result or completion authority.                       |
| `integration.prepare`               | Return one reviewed proposed patch/artifact lineage for Project Server Git validation and admission. |
| `delivery.apply`                    | Deploy, publish, submit, export, promote, or synchronize one authorized reviewed lineage.            |

Namespaced extension capabilities may add mechanics but never Stages, canonical writers, authority sources, Result kinds, completion rules, or protected-effect classes. Ongoing source connection state and scheduling remain external. Plugin Request binds exact subject/snapshot handles, expected external head, authority, configuration, budgets, deadline, capability, and idempotency key. Plugin Receipt binds observations/artifacts, effect facts, before/after heads, status, provider references, custody gaps, and immutable identity. Only Project Server can interpret admitted Receipts against Change Completion Requirements.

The Plugin Protocol is language-neutral. First-party Plugin SDKs, manifests, conformance fixtures, and test kits maximize developer access but grant no authority. Public applications use Kernel API/Client SDK; Checks use Check SDK; DSH provider/runtime extensions remain DSH Plugins. Git object/ref/worktree mechanics are mandatory and Project Server alone admits integration into canonical Git. Plugins may interact with remotes, external workspaces, object services, verification systems, and Delivery providers. Workspaces may contain source, prose, images, datasets, diagrams, policies, configuration, or research assets. Integration and Delivery remain separately authorized.

## Execution Host target

The Execution Host Contract states guarantees rather than Linux syscall names:

- spawn one exact Runtime Build;
- grant exact filesystem capabilities;
- enforce declared network policy;
- enforce CPU, memory, process, I/O, output, and time budgets;
- isolate credentials;
- transfer immutable context;
- identify and observe the complete process tree;
- cancel or kill the complete tree;
- prove quiescence;
- close Evidence before Receipt commit;
- return one exact host-bound Receipt.

Linux may realize those guarantees with Bubblewrap, namespaces, Landlock, cgroup v2, `pidfd`, `openat2`, sealed `memfd`, Unix sockets, and descriptor passing. Windows may use ProcessContainer or AppContainer, Job Objects, process handles, reparse-safe opens, read-only mappings, Named Pipes, and duplicated handles. Shared TypeScript does not imply equivalent qualification.

Containment has two layers: CodeWiki Runtime confines the complete DSH Run, while DSH confines tools and subprocesses within the Agent Session. Neither substitutes for the other.

One exact host implementation binds each Runtime Build. Partial enforcement never falls back silently. Windows applications may use a remote Linux Kernel immediately; WSL2 or a remote Linux Execution Host is the first local execution bridge. Native Windows production support requires separate qualification of equivalent guarantees. DSH's cross-platform sandbox work is the primary collaboration path. Microsoft MXC remains a watch candidate, not a qualified security boundary. AIOS remains research input at the same conceptual layer as DSH and does not enter the execution closure.

## Work Continuity target

Canonical project state, not accumulated conversation or a derived context artifact, provides durable Work Continuity. Every terminal producer Run Receipt closes its physical DSH Session epoch. Another Run for the same stage subject replays exact predecessor Receipt, authority, repository identity, canonical and active proposal commits, fixed-path Wiki/Trace bytes, Candidate/Gate feedback, unresolved Completion Requirements, Evidence/Results, route, Runtime Build, tools, capabilities, and budgets. Project Server rebuilds WorkState from those owners, materializes one authorized Run Context Bundle, and starts a fresh Session bound to its digest.

Same-Session resume is limited to exact recovery of the same unreceipted in-flight Run under an exclusive lease and expected Session-head compare-and-swap. The immutable Run semantic digest remains exact while each recovery dispatch receives a new Request digest bound to the repaired head and retained raw log. Any changed semantic input, role, subject, authority, route, Build, capability closure, Candidate, Gate result, assignment, or integration lineage requires a fresh Session. Missing terminal evidence enters `recovery_stopped`; only exact closure-evidence repair can produce a stopped Receipt, and no operator may waive it or let a successor skip the ambiguous predecessor.

DSH remains the sole Session engine and owns opaque Session bytes, model surface, tools, provider mechanics, and compaction. Runtime retains exact bytes and execution Evidence without parsing them for project meaning. DSH compaction is optional only inside one long in-flight Run; CodeWiki Compaction Summary `1.0.0` retires at target cutover. Cross-Run recovery and feedback survival use exact canonical records and provenance-preserving handles, never a generated summary.

The cutover is conditional on the paired continuity benchmark frozen in `SEMANTIC_KERNEL_SK0_CONTRACTS.md`: deterministic safety and authority fixtures must all pass; the predeclared intention-to-treat, equal-cell paired-bootstrap analysis must satisfy exact quality, loss, repair, cost, and latency bounds over every universal scenario and route; and unavailable or invalid measurements cannot become zero or disappear. Failure retains Backend v1 continuity and returns the hypothesis to architecture review.

## Contract freeze inventory

| Contract family | Required freeze | First slice |
| --- | --- | --- |
| Git Project Store and Wiki Item | Repository/object/ref rules, Item schema/bytes/identity, commit-bound Wiki derivation, retirement, replay, drift, atomic CAS | SK1/SK2 |
| Change proposal/disposition and Completion Requirements | Native proposal commit/managed ref, derived Wiki diff, two-parent disposition, explicit empty-list completion, compensation, staleness | SK1/SK2 |
| Raw Data Source, Revision, slice, ACL, policy, receipt | Custody, identity, capture/retention resolution, observation admission, deletion, permission drift, freshness | SK1/SK5 |
| Evidence Record | Observation/material separation, native refs, migration gaps, availability, replay requirements | SK1/SK5 |
| Alignment lineage | Canonical inputs, support states, dirty-set reduction, freshness, retraction | SK1/SK5 |
| Kernel API and Client SDK | Commands, queries, identity proof, AuthZ, subscriptions, transport bindings, handles, errors, capabilities | SK1/SK3 |
| Check, Pack, activation, Result, Gate Report | Effects, evaluators, binary reduction, composition, protected-head identity | SK1/SK4 |
| CodeWiki Plugin Protocol and SDK | Admission/capability ceilings, Requests/Receipts, remote/source/workspace/verification/integration-preparation/Delivery | SK1/SK4/SK5 |
| Execution Host Contract | Enforcement facts, Build binding, process custody, quiescence, Receipts | SK1/SK6 |
| Work Continuity and canonical rehydration | Complete Git/semantic binding, lease/CAS, predecessor Receipt, feedback survival, failure closure, benchmark | SK1/SK6 |

No executable slice invents its contract while simultaneously trying to prove that contract stable.

Executable source uses stable semantic-owner names. Protocol versions belong in persisted protocol identifiers, compatibility dispatch, migration adapters, and version-specific fixture labels; they do not appear in ordinary source filenames or exported type, function, variable, service, or test-helper names. For example, the target API is `createChangeTraceOperation`, not `createChangeTraceV13Operation`. A clean-break activation replaces the semantic owner rather than creating a parallel version-branded API.

## Current-to-target transformation matrix

| Current Backend v1 surface                                                       | Target owner                                               | Disposition                                                                                                                                                                                         | Planned slice          |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Product described as intent-to-production runtime                                | Semantic Kernel                                            | Rename and narrow to headless governed semantic kernel                                                                                                                                              | SK0/SK3                |
| `.codewiki/kb/**`; `.codewiki/traces/**`                                        | Git Project Store / Wiki Items / Change traces             | Backup-tagged migration to `.codewiki/wiki/items/**` and complete `.codewiki/changes/**` dossiers; reject dual roots or retention stubs                                                             | SK2                    |
| Product/System/Design Knowledge profile and Lexicon container                    | Wiki Items                                                 | Use one universal Item schema; move legacy terms into owning Items; derive any glossary                                                                                                              | SK1/SK2                |
| Path-constrained document kinds                                                  | Wiki Items                                                 | Replace with stable Item IDs, portable files, open namespaced Item types                                                                                                                            | SK1/SK2                |
| Page-level source metadata                                                       | Wiki Items, Evidence, Raw Data, Alignment                  | Convert to Item provenance and independently governed assertion Items with exact source-slice lineage                                                                                               | SK1/SK5                |
| Domain Plugin semantic ownership                                                 | Kernel, Wiki, configuration, Checks, and CodeWiki Plugins  | Remove semantic/Build authority at SK2; bridge unavoidable legacy Check subjects only through verified temporary Receipts; move bounded mechanics to Plugins and delete bridge/Domain Plugin in SK4 | SK2/SK4                |
| Software Development Domain bootstrap                                            | Explicit project bootstrap                                 | Remove imposed scaffold; empty Wiki becomes valid                                                                                                                                                   | SK2/SK4                |
| Seeded default Packs                                                             | Explicit Pack installation                                 | Delete automatic defaults and restoration behavior                                                                                                                                                  | SK4                    |
| Stage-first Pack layout                                                          | Checks                                                     | Migrate to pack-first `.codewiki/check-packs/<pack>/<stage>/<check>/`                                                                                                                               | SK4                    |
| Pack Skills                                                                      | External producer Skills                                   | Delete from Pack contract                                                                                                                                                                           | SK4                    |
| Planning Checks and Planning Gate                                                | Planning Kernel Validation                                 | Delete custom Planning evaluation                                                                                                                                                                   | SK4                    |
| Hidden `codewiki.implementation.kernel` quality Pack                             | Kernel Validation plus explicit user Checks                | Split non-negotiable invariants from user preferences, then delete hidden Pack                                                                                                                      | SK4                    |
| Code/Model, blocking-only Checks                                                 | Checks                                                     | Add Code/Model/Evidence/Human and required/advisory/observe                                                                                                                                         | SK4                    |
| Browser Frontend plan and in-core product UI                                     | External applications                                      | Remove rich product UI ownership from core; retain public Kernel contracts only                                                                                                                     | SK3/SK4                |
| Current operational dashboard and lifecycle controls                             | CodeWiki Console                                           | Reduce to scriptable commands and a terminal-first, read-only-by-default monitor using public APIs                                                                                                  | SK3/SK4                |
| Full Semantic Desktop concept                                                    | CodeWiki App                                               | Keep rich App outside Kernel repository and privilege boundary even when CodeWiki-team-owned                                                                                                        | outside this roadmap   |
| Frontend API naming                                                              | Kernel API and Client SDK                                  | Generalize one app-facing API with canonical transport bindings; delegate login UX while Project Server retains proof validation/AuthZ                                                            | SK3                    |
| Scattered Git/project-store assumptions                                          | Git Project Store + CodeWiki Plugins                       | Make local Git mandatory and centralize canonical/managed-ref CAS; move only remote/provider mechanics behind universal Plugin Protocol                                                             | SK1/SK2/SK4            |
| CI terminology                                                                   | `verification.observe` Plugin capability                   | Generalize exact-commit observations while Checks and Project Server retain judgment/completion                                                                                                     | SK4                    |
| Deployment terminology                                                           | `delivery.apply` Plugin capability                         | Generalize deploy/publish/submit/export/promote/synchronize while Project Server retains Delivery authorization                                                                                     | SK4                    |
| Knowledge-to-source Alignment                                                    | Alignment lineage spine                                    | Extend observed Raw Data Revision → Wiki Item → Git artifact → Evidence/Delivery with explicit support freshness                                                                                     | SK5                    |
| No Raw Data subsystem                                                            | Raw Data and CodeWiki Plugins                              | Add source, revision, slice, capture/retention policy, Receipt, ACL, availability, retraction, custody, and `source.observe`                                                                         | SK5                    |
| Project Context Snapshot                                                         | Run Context Bundle                                         | Rebuild WorkState from canonical owners; materialize one authorized read-only query bundle per Run; retain prior bundles only as execution Evidence                                                  | SK3/SK5                |
| Linux-specific Runtime production binding                                        | Execution Host Contract                                    | Encapsulate behind exact guarantees while retaining Linux reference host                                                                                                                            | SK6                    |
| DSH execution closure                                                            | DSH Agent Runtime                                          | Retain as sole first-party engine; adopt upstream mechanics only after exact qualification                                                                                                          | SK6                    |
| Producer Sessions spanning terminal Runs and CodeWiki-owned compaction summaries | Work Continuity, canonical state, Runtime custody, and DSH | Start a fresh physical Session after each terminal Receipt; same-Session resume only repairs that unreceipted Run; retain DSH compaction only within one Run                                        | SK1/SK6                |
| CodeWiki App/CLI/Pi surfaces                                                     | CodeWiki App, Console, and external Clients                | Preserve public protocol clients where useful; keep rich experience outside Kernel and Console minimal                                                                                              | SK3/SK4                |
| Backend Build and Release Manifest                                               | Kernel Build and qualification                             | Advance identities for every protocol, path, Plugin, or host-boundary change                                                                                                                        | every executable slice |

The completed detailed inventory in `SEMANTIC_KERNEL_SK0_CONTRACTS.md` maps all 28 transformation rows to source and test closures, protocol and persisted identities, migration and rollback edges, and release gates. Executable slices must expand and verify their assigned closure against the clean parent commit before editing.

## Universal conformance scenarios

Contract fixtures must cover:

1. an empty Wiki with no source, item, relationship, Check, Plugin, or Completion Requirement;
2. software development with source, tests, Git integration, and deployment;
3. research and content with citations, contradiction, publication, and revision;
4. product and design with visual assets, requirements, and delivery;
5. legal or policy work with restricted sources, approvals, and supersession;
6. music management with recordings, rights, release assets, and distribution;
7. logistics with plans, providers, events, and operational handoff.

Adversarial fixtures must include stale heads, path moves, case collisions, source revocation, mixed ACL synthesis, contradictory and successive Revisions, Plugin compromise, migration crash, incomplete Evidence, hostile symbolic paths, process-tree escape, and partial Delivery.

A universal contract fails if any scenario requires a hidden domain branch in Project Server lifecycle authority.

## Delivery rules

1. Prefer deletion and ownership cuts over compatibility layers.
2. Keep one authoritative writer and one canonical representation.
3. Never dual-write `kb/` and `wiki/`.
4. Preserve canonical bytes, stable identity, expected-head compare-and-swap, provenance, replay, recovery, and guarded effects.
5. Separate protected accepted controller policy from Candidate policy.
6. Keep controller, subject, state, credentials, Runtime Build, DSH closure, and host enforcement separately attributable.
7. Treat research and conversation summaries as navigation until assertions are reverified against exact sources.
8. Parse unknown input at boundaries and keep open semantic payloads inside named bounded envelopes.
9. Keep every slice releasable, migratable, rollback-capable, and externally governable.
10. Candidate implementation and qualification use Pi-native tools; an activated immutable release may dogfood this checkout but never qualify its successor. Test candidates only in disposable external projects.
11. Do not add a Wiki Store Plugin, generic workflow engine, second Session engine, backend selector, project-local executable Plugin path, or mutable-source dogfood path.
12. Do not claim a platform, provider, or containment mode merely because installation succeeds.

## Roadmap

```text
SK0 Architecture consolidation
  ↓
SK1 Contract laboratory and universal fixtures
  ↓
SK2 Mandatory Git store, universal Wiki Items, qualified kb→wiki migration
  ↓
SK3 Kernel API, transport bindings, SDK, and application boundary
  ↓
SK4 Universal lifecycle, Checks, and external-mechanics Plugins
  ↓
SK5 Raw Data observation, custody, and Alignment lineage
  ↓
SK6 Work Continuity, Execution Host Contract, and Linux qualification
  ↓
SK7 Windows bridges and separately qualified native host
```

SK6 capability experiments may run beside SK1–SK5 but cannot change production support or Runtime authority before qualification.

### SK0 — Architecture consolidation — complete and qualified

- [x] Establish headless Semantic Kernel and separate rich CodeWiki App boundary.
- [x] Limit first-party presentation to scriptable operations and terminal-first CodeWiki Console.
- [x] Establish mandatory Git Project Store for every domain and retain provider remotes as external Plugin mechanics.
- [x] Replace app-facing ABI terminology with one Kernel API, canonical transport bindings, and Client SDK.
- [x] Establish Host OS, Execution Host, DSH, AI Gateway/Provider, Kernel, Plugin, and application authority layers.
- [x] Make Wiki Item the sole Wiki semantic entity and native Git commit/tree/ref identity the version/snapshot mechanism.
- [x] Model one stable Change with native proposal commit versions, derived Wiki diffs, and Completion Requirements.
- [x] Make terminal Decision disposition one two-parent Git commit; accepted empty requirements complete there.
- [x] Preserve empty-diff, Item-targeted conformance Changes without synthetic Wiki edits.
- [x] Establish Raw Data observation/custody, Checks, Plugins, Work Continuity, and Execution Host vocabulary.
- [x] Complete file/protocol mapping, migration/rollback edges, release gates, and universal scenarios.
- [x] Reverify retained external architecture evidence.
- [x] Govern and qualify completed architecture checkpoint with released controller N.

Success: every current responsibility has one target owner/disposition; each target contract has authority, state machine, canonical form, migration, rollback, and proof strategy; no unresolved overlap enters SK1.

### SK1 — Contract laboratory and universal fixtures — complete and qualified

Implement mandatory Git store profile, Wiki Item and append-only Change Trace schemas, native proposal/disposition commit and managed-ref validators, canonical encoders/parsers, reducers, valid/invalid goldens, migration/replay fixtures, and cross-platform path fixtures without changing canonical project state. Keep protocol-version literals at persistence and compatibility boundaries; source modules and semantic APIs retain version-neutral owner names.

Success: all universal/adversarial fixtures use identical Git/Wiki/Change contracts; semantic Item identity never derives from Product/System/Design, software, path, title, model assertion, or Git OID; no scenario needs a hidden domain branch; no target protocol version leaks into ordinary source filenames or semantic API identifiers.

### SK2 — Mandatory Git store, universal Wiki Items, and qualified migration

Freeze repository identity/object format/canonical ref. Implement one backup-tagged, quiescent, expected-old-ref migration commit from compiled `.codewiki/kb/**` to `.codewiki/wiki/items/**` and Backend-v1 `.codewiki/traces/**` to target `.codewiki/changes/**`. Hydrate and verify every retention stub first; preserve every source record through an identity/digest map. The Migration Receipt binds each active Change's conversion plan and expected managed-ref name, not resulting proposal OIDs that depend on the candidate commit; Project Server materializes and validates those proposals after the candidate exists, and native Git refs and ancestry provide exact OID proof. Activate Change schema `4`, Trace `13.0.0`, native proposal commits, managed Change refs, explicit Completion Requirements, and two-parent disposition commits. Map independently mutable facets/assertions to Items, fold legacy Lexicon terms into owning Items without emitting a Lexicon container, convert active requirements, preserve legacy Trace evidence, verify exact identity/provenance/retirement/WorkState equivalence, and remove Domain from new semantic/Build authority. Bridge unavoidable old Check subjects only through verified temporary Receipts. Reject dual roots. Permit old-Build/ref restore only before first later target-only accepted commit.

Execution order:

- [x] Add a read-only production preflight that binds stopped Backend state, released ownership, repository/object format, exact canonical commit, clean legacy roots, absent target/backup/managed refs, and prohibited-residue checks without writing Git or project state.
- [x] Build the exact read-only legacy semantic snapshot from canonical Git KB bytes, source-Build compilation, hydrated retention history, complete Trace reduction, accepted active Changes, and a revalidated quiescence receipt.
- [x] Bind one accepted active legacy Change as migration authority and verify a byte-exact, current external Backend backup across canonical, Project Server, Runtime, and audit scopes without exposing private bytes.
- [ ] Stage and verify the backup ref, target Item/Trace objects, Receipt, migration commit, and active proposal commits without advancing authoritative refs.
- [ ] Atomically activate canonical and managed refs, replay the full closure, activate the Domain-free target Build/private generation, and retain bounded rollback.
- [ ] Qualify empty, migrated, crash/recovery, rollback, old-reader refusal, universal-domain, package, security, and release-N-governs-N+1 gates before migrating this repository.

Success: empty and migrated Wiki replay from native Git; Item files and complete `.codewiki/changes/**` traces agree; Git commit/tree/ref identity replaces custom Wiki state/projection/checkpoint/update machinery; no Raw Data or Runtime residue enters canonical Git. Legacy migration code is stopped-only transition machinery, is absent from normal target lifecycle routing, and remains available only through a bounded qualified upgrade/rollback window before explicit retirement.

### SK3 — Kernel API, SDK, and application boundary

Expose versioned commands, bounded queries, subscriptions, handles, errors, capability discovery, consistency, redaction, and canonical HTTP/local transport profiles for commit-bound Wiki Items, Changes, Work, Candidates, Evidence, Raw Data requests, and protected effects. Publish Client SDKs over this same Kernel API contract. App/Clients own login UX and acquire IdP proof; Project Server validates proof, maps Actors, and enforces AuthZ. External applications cannot write canonical Git directly. Remove rich frontend from Kernel; retain scriptable commands and minimal Console.

Success: an external application governs a complete Change using public API/SDK without internal imports, DSH/filesystem authority, AuthZ logic, or protected-effect capability; alternate Clients cannot bypass App policy; transport binding adds no hidden operation.

### SK4 — Universal lifecycle, Checks, and CodeWiki Plugins

Generalize Completion Requirement reduction across Kernel Validation, Planning constraints, target Check semantics, pack-first layout, and Plugin Manifest/Request/Receipt plus source, remote, workspace, verification, integration-preparation, and Delivery capabilities. Publish Plugin SDK conformance fixtures without granting authority. Migrate residual Domain behavior to fixed rules, namespaced Item types, config, Checks, or admitted Plugins; close/retire legacy bridges before deleting Domain/defaults/Pack Skills/Planning Checks/hidden policy/software-only branches.

Success: unlike project scenarios use identical native proposal/disposition, commit-bound Wiki, requirements, Decision, Planning, Implementation, Review, Work Unit, Candidate, Evidence, Gate, Plugin Receipt, integration, and Delivery contracts; deleting custom Checks leaves Kernel invariants; new provider implements Plugin Protocol without canonical-ref access or core branch.

### SK5 — Raw Data observation, custody, and Alignment lineage

Add private immutable Raw Data Revision manifests and policy custody, `source.observe`, Slices/Receipts, Evidence `2.0.0`, lineage, Item-level provenance, ACL propagation, contradiction, freshness, retraction, and dirty-set reduction. Resolve capture/retention before intake. External connection implementations own watching, transport, cursors, retries, extraction, normalization, entity resolution, reconciliation, apply, verification, and connection health. Query Wiki first and Raw Data for drill-down, unsupported questions, freshness, contradiction, or missing coverage.

Success: Evidence cites exact policy-bound material; unavailable material is never reported replayable; admitted source change/expiry/deletion/revocation/permission drift updates retrieval safety/support. Project policy may open Change Intake, but no source, external connection, or Plugin advances canonical Git.

### SK6 — Work Continuity, Execution Host Contract, and Linux qualification

Qualify fresh semantic-boundary Sessions against frozen benchmark, then migrate Work Continuity/Run/Receipt/Ledger and activate Runtime Build/Execution Host over Run Context Bundle `1.0.0` without translating DSH bytes. Prototype one DSH Run with only inherited sealed/scoped capabilities: control socket, immutable context, Candidate output, Evidence channel, scoped Workbench. Remove ambient project paths, credentials, network, canonical writes, and child-lifecycle authority. Determine whether Node plus qualified Linux tools suffice before native helper.

Success: fresh Sessions preserve exact canonical/proposal commit authority, fixed-path Wiki/Trace identity, feedback, unresolved requirements, and quality while meeting context objective; same-Session recovery cannot cross terminal Receipt; quiescence/evidence closure precede Receipt; host facts bind Runtime Build.

### SK7 — Windows and cross-platform qualification

Support Windows applications against remote Linux first, then qualify WSL2/another Linux bridge. Implement native Windows host only if containment, Job Objects, safe paths, immutable context, network, credentials, quiescence, recovery, and Evidence closure meet same contract. macOS receives separately bound implementation/qualification.

Success: support is independent for Client, Kernel, DSH core, inner sandbox, outer Execution Host, and production; partial layer is never complete Windows support.

## SK0 decisions resolved for SK1

`SEMANTIC_KERNEL_SK0_CONTRACTS.md` freezes exact schemas, encoding, bounds, protocol ledger, and state machines:

- Every domain uses one mandatory local Git repository/configured canonical ref. Project Server alone advances it by expected-old-OID CAS; remote/provider mechanics are Plugins.
- Wiki Item is sole first-class Wiki semantic unit. Independently mutable assertions become Items; aliases/relationships/provenance remain Item fields. Stable Item IDs never derive from path or Git OID. Target has no Lexicon container; any glossary is a derived View.
- Canonical Item files are deterministic UTF-8 Markdown/YAML. Binary assets remain Git artifacts or Raw Data.
- Exact Wiki identity is stable repository ID, frozen object format, and one native commit OID; Kernel Build also binds interpretation when needed. Fixed-path Wiki tree/blob OIDs are derived only when needed. No snapshot wrapper, custom Wiki State, Projection, Checkpoint, Update Operation, application plan, tombstone file, or canonical State Commit duplicates Git.
- Change has one stable ID and one append-only JSONL trace. Each immutable proposal version is one proposal commit containing `change.proposed`, optional Wiki Item changes, and complete intention, authority, outcomes, compensation/supersession, and Completion Requirements.
- Confirmation creates a two-parent disposition commit: expected canonical first parent, exact managed proposal tip second parent. Acceptance uses derived proposed Wiki; other dispositions preserve first-parent Wiki; all retain complete proposal ancestry and terminal Trace.
- File order and exact predecessor-byte prefix define Trace order. Git commit/path/blob identity replaces per-record digest chains and custom Trace tips; traces are never compacted, truncated, replaced, or deleted.
- The KB-to-Wiki Receipt binds active-Change conversion plans and expected managed-ref names, never candidate-dependent proposal OIDs. Resulting proposal commits are validated against those plans and obtain exact identity from native Git refs and retained ancestry.
- Wiki diff plus empty requirements completes at acceptance; Wiki diff plus requirements continues to realization; empty diff plus Item-targeted requirements repairs conformance; empty diff plus no requirements is invalid.
- Compensation/supersession uses a new Change proposal and disposition commit—never semantic rollback.
- Raw Data owns policy-bound material; Evidence owns provenance-bound observations; Results own judgments. Admitted source observations change derived support and may open intake, never Wiki directly; ongoing connection mechanics remain external.
- App/IdP owns login/proof acquisition. Project Server validates proof and owns AuthZ/redaction/protected effects/audit.
- Kernel API includes canonical transport bindings; Client SDK wraps it. No separate Wire Protocol authority/family exists.
- Kernel Validation owns lifecycle/Git/Item safety; Checks own explicit project evaluation. Packs grant no inherited authority.
- Domain Plugin authority is deleted. Temporary SK2–SK3 Check bridge exposes only verified Receipt; SK4 retires it.
- One CodeWiki Plugin Protocol covers external source/remote/workspace/verification/integration-preparation/Delivery mechanics. Plugins cannot write canonical or managed CodeWiki refs, create Results, grant AuthZ, accept/complete Changes, or invent lifecycle transitions.
- Transient maintenance findings stay private; actionable findings enter intake; durable meaning enters Wiki only through accepted Change commit.
- Execution Host remains implementation-neutral. Production stays Linux x64 until separately qualified profiles pass.
- Fresh physical DSH Sessions begin after terminal producer Receipts and rehydrate from exact Git/canonical state; DSH compaction remains intra-Run.
- Same-Run recovery preserves semantic digest but records new dispatch Request per repaired head; irrecoverable closure remains quarantined without waiver.
- Old-Build/ref restore ends at first target-only accepted commit; later recovery preserves current accepted Git/Trace history or repairs forward.

No unresolved architecture choice may change an SK1 schema or golden fixture. Empirical SK6/SK7 implementation selections remain qualification outcomes, not schema blockers.

## Qualification rules

Every executable slice must:

1. begin from an exact clean committed subject, excluding unrelated user files;
2. preserve a verified prior-state backup, permit old-Build restore only before the first target-only accepted operation, and preserve target-compatible current-head recovery afterward;
3. add focused invariant, failure, replay, migration, and recovery tests;
4. pass primary LSP diagnostics before build and test work;
5. pass typecheck, build, focused tests, full tests, production tests, readiness, package installation, and applicable external lifecycle gates;
6. pass the unfiltered diagnostics ratchet and dependency audits;
7. regenerate every affected protocol, package, Runtime Build, Backend Build, and Release Manifest identity;
8. prove expected-head stale-write rejection and deterministic recovery;
9. run packed installs only in disposable external projects;
10. use released controller N and protected-head policy to govern committed candidate N+1;
11. verify no `.codewiki/runtime/`, `.codewiki/views/`, package tarball, credential, Session, socket, cache, or daemon residue remains in the source checkout;
12. ship one reviewed green commit per bounded slice.
