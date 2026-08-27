# Semantic Kernel SK0 Contract Freeze

## Status and authority

This document is the architecture-complete SK0 freeze candidate developed from clean baseline `62bb34d450b51bc0f9cfb26c37cd3af48e68a077`. It resolves the contract questions that must be settled before executable SK1 work. `SEMANTIC_KERNEL_PLAN.md` remains the roadmap, `.codewiki/kb/**` remains the canonical product and system design, and Backend v1 source and tests remain executable truth until a qualified slice explicitly migrates them. This file is the cross-owner inventory and exact target-contract ledger; any conflict with a canonical KB owner blocks review and must be corrected rather than resolved by precedence at runtime.

Nothing in this document activates `.codewiki/wiki/**`, changes a persisted protocol, or permits dual authority. Every target version below is reserved for a future executable slice. SK0 is complete only after this document and the corresponding canonical KB changes are reviewed and checkpointed under the external N-governs-N+1 rule.

Normative terms such as MUST, MUST NOT, SHOULD, and MAY have their RFC 2119 meanings.

## Resolved architecture decisions

1. **One semantic kernel.** Project Server remains the only writer and authority for accepted project meaning, Changes, Work, Gates, authorization, compare-and-swap, replay, recovery, and guarded effects.
2. **One mandatory Git project store.** Every governed Project and domain uses Git for canonical project artifacts, Wiki Items, and one append-only JSONL trace per Change. `.codewiki/kb/**` remains canonical until one quiescent, backup-first Git commit activates `.codewiki/wiki/**`; both roots MUST NOT be active or dual-written. Provider remotes remain Plugin mechanics, never canonical authority.
3. **One Session engine.** DSH remains the only first-party Agent Session engine. CodeWiki does not parse, translate, normalize, fork, or assign project meaning to opaque DSH Session bytes.
4. **Fresh physical Sessions at semantic Run boundaries.** Each terminal producer Run Receipt closes one physical DSH Session epoch. A later producer Run in the same Work Continuity starts a fresh DSH Session from an exact CodeWiki rehydration binding and cites the predecessor Receipt. Same-Session resume is permitted only while recovering the same in-flight Run identity.
5. **Canonical continuity, derived execution context.** Git Wiki/Change-trace history, Evidence, Results, Receipts, and retained execution evidence provide durable continuity. Fresh Runs deterministically rebuild WorkState, then materialize one authorized read-only Run Context Bundle. Neither derived artifact is cross-Run authority. Change traces never compact; DSH compaction remains optional intra-Run pressure control.
6. **One Wiki semantic unit.** Wiki Item is the only first-class Wiki entity. Independently mutable facets or assertions become separate Items; claim is an Item type, not a peer schema. Stable Item IDs are path-independent. Aliases and relationships are bounded Item fields, never inferred from titles, paths, headings, or Markdown links.
7. **Canonical Wiki files.** Wiki Items are ordinary canonical UTF-8 Markdown or YAML files committed in Git. Binary and provider assets remain Git project artifacts or policy-bound Raw Data and enter Wiki through exact refs.
8. **Git-native Change proposal versions.** Change has one stable ID and one JSONL dossier. One exact proposal commit OID is the proposal version; that commit contains the appended `change.proposed` operation and any proposed Wiki Item bytes. Git first-parent/tree identity derives the Wiki change, so no composite proposal-version ref, authored Wiki-impact union, peer Wiki Update lifecycle, or operation protocol exists.
9. **Conditional downstream lifecycle.** Decision is mandatory. A non-empty derived Wiki diff with explicitly empty Completion Requirements completes in the same Git acceptance commit. Non-empty requirements continue through Planning and work. An empty Wiki diff with non-empty Item-targeted requirements supports conformance repair without synthetic Wiki edits; empty diff plus empty requirements is an invalid no-op.
10. **Git-native disposition and no semantic rollback.** Acceptance, rejection, deferral, or withdrawal produces one two-parent disposition commit whose first parent is the expected canonical commit and whose second parent is the exact managed proposal-branch tip. Accepted Git history is corrected, compensated, or superseded by a new Change proposal commit. Stopped restore is operationally valid only when it preserves accepted history or restores an exact pre-target ref before any target-only acceptance. Older controllers never reinterpret newer commits.
11. **One neutral Plugin boundary.** Local Git object/ref semantics are Kernel infrastructure. Operator- or release-admitted CodeWiki Plugins contribute bounded remote, source, workspace, verification, collaboration, object-service, and Delivery mechanics without writing canonical or managed CodeWiki refs or extending Kernel authority. DSH Plugins remain Runtime-internal.
12. **No rich in-core application.** Scriptable operations and minimal terminal-first CodeWiki Console remain first party. Rich CodeWiki App remains separate and uses only public Kernel API and Client SDK.
13. **Evidence is not payload custody.** Raw Data owns exact source material under frozen capture/retention policy. Evidence is immutable observation metadata citing exact material or protocol records; Results remain separate judgments.
14. **Identity proof is delegated; authorization is not.** App or IdP may own login, SSO, OIDC, MFA, and token acquisition. Project Server validates cryptographic proof, maps Actor, and owns AuthZ, redaction, protected effects, and audit.
15. **Source change never writes Wiki.** Admitted observations may advance Raw Data Revision heads, stale support and reusable records, and open Change Intake. Ongoing connections remain external; only an authorized accepted Change commit may alter Wiki files.
16. **One public API contract.** Kernel API defines operations, events, errors, versioning, and canonical transport bindings. Client SDK wraps it. “Wire Protocol” is not a separate authority or contract family.

## Material ambiguities surfaced and resolved

- **Git scope:** prior source-agnostic storage wording conflicted with the universal-Git decision. Git is mandatory local canonical substrate for every domain; only remotes and external mechanics remain provider-neutral Plugins. Private/retention-controlled state remains outside Git.
- **Wiki identity:** Git versions bytes but does not provide stable semantic identity across edits and moves. Wiki Item therefore retains immutable in-content ID; facet and claim peer entities are deleted.
- **Git-bound Wiki version:** exactness means replayable input identity, not correctness. Stable repository ID, frozen Git object format, and one native commit OID identify Wiki bytes; exact Kernel Build also binds interpretation when needed. Fixed-path Wiki tree/blob OIDs derive from that commit. No snapshot wrapper, separate Wiki State, Projection, Checkpoint, application plan, or State Commit duplicates Git.
- **Change version:** Decision must bind exact proposal bytes while one Change survives feedback edits. One proposal commit OID is the version; its ordered parents, tree, fixed Trace path, and managed ref provide all other identity. Revision and composite proposal-version refs are not peer objects.
- **Wiki-only and repair work:** derived Wiki diff and explicit Completion Requirements form four cases: meaning-only acceptance, accepted meaning plus realization, conformance repair without synthetic Wiki edits, or invalid no-op.
- **Change disposition:** acceptance/rejection/defer/withdraw is one two-parent Git commit plus expected-old canonical-ref CAS. First-parent history is accepted project history; second-parent ancestry retains exact proposal, Decision, Result, and feedback commits without making rejected Wiki bytes canonical.
- **API transport:** external processes still need encoded requests, but transport is a Kernel API binding consumed by SDKs rather than a separate Wire Protocol family.
- **Physical Session lifetime:** every terminal producer Receipt closes one physical epoch; only unchanged unreceipted Run recovery may resume it.
- **Compaction authority:** optional compaction stays inside one Run. Exact canonical rehydration is the only cross-Run continuity path.
- **Check activation and outcomes:** installation is the policy act; Results remain `passed | failed`; invocation error or stop yields no Result.
- **Domain deletion ordering:** SK2 removes Domain from new semantic/Build bindings; receipt-bound compatibility may survive until SK4 deletes residual behavior.
- **Evidence and retention:** Evidence cites exact Raw Data or other immutable material. Missing or expired bytes remain explicit; no refetch rewrites history.
- **Plugin neutrality:** one Plugin Protocol covers bounded external mechanics. Plugins cannot mutate canonical Git refs, create Results, accept or complete Changes, or grant authority.
- **Authentication boundary:** App/IdP owns login UX and proof acquisition; Project Server validates proof and enforces every command, query, redaction, and protected effect.
- **Source observation:** admitted new source Revisions change current support and may open intake, never accepted Wiki history directly. Ongoing connection mechanics remain external.
- **History reversal:** semantic compensation, operational restore, and external-effect reconciliation remain distinct. Accepted Git commits are never erased by semantic rollback.

No unresolved ambiguity may change an SK1 schema. Remaining questions are empirical qualification outcomes: continuity benchmark acceptance, Linux supervisor necessity, and exact Windows host support.

## Target protocol ledger

Target identities are clean breaks. Existing records remain readable only where migration says so; readability never implies activation or resume eligibility.

| Family | Backend v1 identity | Reserved target identity | Activation slice |
| --- | --- | --- | --- |
| Git project store | repository/Git assumptions spread across project and provider code | mandatory Git store profile `1.0.0`; native commit/tree/ref identities | SK1/SK2 |
| Wiki Item | Knowledge subjects/facets in state/projection protocols | `codewiki.wiki-item@1.0.0` | SK1/SK2 |
| Git-bound Wiki identity | Knowledge state/projection/checkpoint `1.0.0`/`2.0.0` | stable repository ID + frozen object format + native commit OID; fixed-path Wiki tree/blob OIDs are derived | SK1/SK2 |
| Change proposal and Trace | Change schema `3`; `codewiki.change-trace@12.0.0` | Change schema `4`; native proposal/disposition commits and managed refs; Trace `13.0.0`; Completion Requirement/Record `1.0.0` | SK1/SK2 |
| Qualified KB migration | legacy Domain migration `1.0.0` | `codewiki.kb-to-wiki-migration@1.0.0` producing one Git migration commit | SK2 |
| Stage Candidates | Decision `8.0.0`, Planning `3.0.0`, Work Unit `2.0.0`, Review Attempt `5.0.0` | Decision `9.0.0`, Planning `4.0.0`, Work Unit `3.0.0`, Review Attempt `6.0.0` | SK2 |
| Work Graph and WorkState | Work Graph `2.0.0`; reducer `8.0.0`; WorkState schema `4` | Work Graph `3.0.0`; reducer `9.0.0`; WorkState schema `5` | SK2 |
| Gate Evaluation Package | `codewiki.gate-evaluation-package@2.0.0` | `codewiki.gate-evaluation-package@3.0.0` | SK2 |
| Temporary legacy Check bridge | none | `codewiki.legacy-check-bridge-receipt@1.0.0`; retired at SK4 | SK2/SK4 |
| Evidence | Evidence schema `1.4.0` | `codewiki.evidence-record@2.0.0` | SK5 |
| Private state and recovery | State Commit Manifest `1.0.0`; Backend State/backup/migration/restore/recovery `1.0.0` | canonical State Commit retired in favor of Git; Kernel private-state/backup/migration/restore/recovery `1.0.0` | SK2 |
| Alignment | graph projector `5.0.0` | `codewiki.alignment-graph@6.0.0` | SK1/SK5 |
| Producer context | `codewiki.project-context-snapshot@1.0.0` | `codewiki.run-context-bundle@1.0.0` | SK1/SK5 |
| Work Continuity | `codewiki.session-continuity@1.0.0` | `codewiki.work-continuity@1.0.0` | SK1/SK6 |
| Run Continuation | `codewiki.run-continuation@1.0.0` | `codewiki.run-continuation@2.0.0` | SK1/SK6 |
| CodeWiki compaction summary | `codewiki.compaction-summary@1.0.0` | retired; DSH owns summary mechanics | SK6 |
| Run Process and Request | `codewiki.run-process@6.0.0`, Run Request `6.0.0` | `codewiki.run-process@7.0.0`, Run Request `7.0.0` | SK6 |
| Run Receipt | `codewiki.run-receipt@4.0.0` | `codewiki.run-receipt@5.0.0` | SK6 |
| Execution Ledger | `codewiki.execution-ledger@5.0.0` | `codewiki.execution-ledger@6.0.0` | SK6 |
| Runtime Build Manifest | `4.0.0` with explicit Domain identity | `5.0.0` with Git/protocol/capability/host closure | SK2 |
| Kernel API | Frontend API/capabilities/events `1.0.0`; Client-Project Server `1.0.0` | `codewiki.kernel-api@1.0.0` including capabilities, events, and transport bindings | SK1/SK3 |
| Check definition, invocation, Result, Gate | Check `1.0.0`, invocation `4.0.0`, Result/Gate `2.0.0` | Check `2.0.0`, invocation `5.0.0`, Result/Gate `3.0.0` | SK1/SK4 |
| Check Pack | snapshot `2.0.0` | `codewiki.check-pack-snapshot@3.0.0` | SK4 |
| Raw Data | none | Source, Revision, Slice, ACL, capture/retention Policy, Intake Receipt `1.0.0` | SK1/SK5 |
| CodeWiki Plugins | Infrastructure Providers and software-specific current contracts | Manifest/Request/Receipt and standard external-capability contracts `1.0.0` | SK1/SK4/SK5 |
| Execution Host | Linux qualification `1.0.0` | `codewiki.execution-host-contract@1.0.0`, host qualification `2.0.0` | SK1/SK6 |
| Backend/Kernel Build | `codewiki.backend-build@2.0.0` | `codewiki.kernel-build@1.0.0` | first executable cut |
| Release Manifest | `codewiki.backend-v1-release-manifest@1.0.0` | `codewiki.semantic-kernel-release-manifest@1.0.0` | first executable cut |

## Universal Wiki and Git contracts

### Mandatory Git project store

Every governed Project, regardless of domain, has one mandatory local Git repository and one configured canonical ref. Git owns canonical versioning for project artifacts, `.codewiki/wiki/**`, and Change traces under `.codewiki/changes/**`. Canonical first-parent history is accepted project history; managed `refs/codewiki/changes/**` retain in-flight proposal history, and terminal disposition commits retain that history as second-parent ancestry. Project Server is the sole writer of canonical and managed CodeWiki refs and uses native expected-old-OID compare-and-swap. GitHub, GitLab, other remotes, LFS/object services, and collaboration products remain provider mechanics reached through admitted CodeWiki Plugins; none replaces local Git history or writes authoritative refs directly.

A repository freezes Git object format `sha1 | sha256`. `GitOid` is `{ algorithm, hex }`, where `hex` is lowercase and exactly 40 characters for SHA-1 or 64 for SHA-256. Object type is verified rather than inferred from an OID. Repository identity is a stable configured ID, not a path or remote URL. Git commit authorship is transport metadata, not CodeWiki Actor authentication or authorization; accepted Trace content carries those facts. Kernel Build binds supported Git implementation/version and canonical-operation configuration. Project Server uses sanitized plumbing/object access with hooks, aliases, external filters/diffs, replace/graft overrides, and ambient credential helpers disabled; Wiki bytes come from committed blobs, never worktree transforms. Missing objects, shallow/incomplete required history, unadmitted alternates, collision warnings, or unsupported object format stop admission/replay.

Canonical Git excludes credentials, Raw Data payloads subject to custody/retention, Runtime scratch, leases, private indexes, and provider tokens. Git LFS or another object service may hold ordinary project artifacts, but a committed pointer and its exact content identity remain project state. Raw Data policy still controls evidence material independently. Proposal and rejected-branch bytes retained in commit ancestry are visible to every repository reader and cannot satisfy selective confidentiality or erasure; sensitive material must remain outside this repository.

Reflogs, dangling objects, Git notes, replace refs, commit authors/messages, signatures, and remote-provider status are never lifecycle authority. A verified signature authenticates an object/key binding only; Project Server still maps Actor and authorizes the exact operation. Every accepted or active object is reachable from canonical or a managed CodeWiki ref; complete backup and publication include both ref classes explicitly. Authoritative replay requires complete relevant object closure and fails closed for missing shallow/partial-clone objects. Multi-ref updates may be observed in parts, so canonical-ref ancestry alone decides terminal disposition and stale managed refs grant no accepted authority.

### Common values and digests

Strings and keys are NFC UTF-8. Identifiers, namespaced types/capabilities, text, maps, and arrays use the bounded scalar rules frozen here: IDs and type names are 1–256 bytes; labels and aliases 1–512; rationale/outcome text 1–16,384; ordinary maps have at most 128 entries; ordinary arrays at most 256 unless a schema sets another bound. Floats, unsafe integers, duplicate keys, invalid Unicode, and silent normalization are forbidden.

Non-Git semantic digests use RFC 8785 JSON Canonicalization over the restricted model, UTF-8 without BOM or trailing LF, and domain-separated SHA-256: `H(P,V) = sha256(UTF8(P) || 0x00 || JCS(V))`. The digest field being computed is omitted. Git object identity always uses native Git framing and the repository's frozen object format, never `H`.

### Wiki Item

Wiki `1.0.0` has one semantic unit: `WikiItem`. Facet, Claim, and Lexicon are not peer entity classes. An independently mutable or independently sourced assertion is another Item; a claim may use a namespaced Item type such as `codewiki.claim`. Titles, aliases, bodies, and relationships carry terms; any glossary is a derived View. This keeps identity, provenance, conflict, and retirement at one granularity.

```text
WikiItem {
  protocol: codewiki.wiki-item@1.0.0
  itemId: StableId
  itemType: NamespacedType
  title: string
  aliases: string[0..64]
  attributes: Map<NamespacedKey, JsonValue>[0..128]
  relationships: WikiRelationship[0..256]
  provenance: ProvenanceRef[0..128]
  body: string
}

WikiRelationship {
  predicate: NamespacedType
  targetItemId: StableId
  attributes: Map<NamespacedKey, JsonValue>[0..32]
}
```

`itemId` is immutable, path-independent, globally unique within the Project, and never derived from label, title, alias, path, body, Git OID, or digest. Aliases are exact lookup aids and grant no identity. Relationships are ordered Item content owned by the source Item; they have no separate lifecycle or authority. Reverse or symmetric meaning must be explicit policy, not inferred. Every target resolves in the proposed Wiki tree or accepted retirement history as allowed by its predicate.

Aliases are exact NFC and duplicate-free after case-sensitive comparison. Attribute keys and relationship predicates are open namespaced values; unknown values are preserved and surfaced as unknown, never executed. Provenance references exact accepted Change, Evidence, Raw Data Revision/Slice, project artifact, or Git object identities. Provenance describes origin and support, not truth or Result authority.

Removing an Item retires its ID. Accepted Trace records the retired ID and prior blob OID; derived indexes accelerate lookup, but Git history and Trace remain authority. A retired ID cannot be reused. Split, merge, replacement, and supersession are explicit relationships in surviving/new Items and accepted Change rationale.

### Canonical Wiki files

Canonical Wiki Items are ordinary Git-versioned UTF-8 Markdown or YAML files under `.codewiki/wiki/items/**`, one Item per file. The file is canonical state, not a projection of another Wiki database. There is no `_wiki.yaml`, `_tombstones.yaml`, Wiki State object, Wiki Projection, or Wiki Checkpoint file. Project bootstrap creates one canonical Git commit containing repository/config identity and no Wiki Item files; `.codewiki/wiki/items` is absent. This valid empty Wiki implies no scaffold, Change, Check, Work, Plugin, or Completion Requirement.

Paths are portable relative POSIX paths: lowercase ASCII generated segments, no empty/dot segments, backslashes, controls, Windows device names, links, or special files; each segment is at most 64 UTF-8 bytes and the relative path at most 240. Path moves do not change Item identity. Qualified migration/default generation uses `.codewiki/wiki/items/<p2>/item-<b52>.md`, where `<b52>` is the 52-character lowercase unpadded Base32 SHA-256 of NFC `itemId` and `<p2>` its first two characters. Collision stops generation. Users may later move/rename to any valid path; path is never authority.

Text is NFC, LF-only, no BOM, no trailing whitespace, and exactly one final LF. YAML uses the fixed JSON-compatible subset: no aliases, tags, duplicate keys, merge keys, custom types, timestamps, binary scalars, floats, unsafe integers, or implicit non-string keys. Markdown frontmatter follows the same subset. Binary media remains a Git-versioned project artifact or policy-bound Raw Data object referenced by an Item.

Kernel Validation parses every changed Item and enough unchanged closure to prove unique IDs, schema, relationship closure, provenance shape, path portability, canonical bytes, retired-ID non-reuse, and complete resulting-tree validity. Kernel Build binds the parser and validator version. Because files themselves are canonical, no renderer/compiler or application plan sits between accepted meaning and Git bytes.

### Git-bound Wiki identity

Exact consumers bind stable repository ID, frozen Git object format, and one native Git commit OID. This identifies replayable input bytes, not correctness of any judgment. At that commit, `.codewiki/wiki/items` either is absent or resolves to the exact Wiki tree; individual Item paths resolve to exact blobs. Tree and blob OIDs are derived facts used only when comparison, caching, or Evidence needs them, never a snapshot-wrapper protocol or peer checkpoint. Candidate, Result, Run, Evidence query, and API responses also bind exact Kernel Build when interpretation matters. Two commits may resolve to the same Wiki tree while differing in Trace or project artifacts.

### Change proposal commits and derived Wiki change

A Change has one stable `changeId` and one dossier path `.codewiki/changes/TRACE-CHG-<id>.jsonl`. The first line is an immutable `codewiki.change-trace@13.0.0` header binding trace, Change, repository, and creation facts. Every later LF-terminated canonical-JSON line is one bounded typed operation with unique `operationId` plus Actor/authority references required by its schema. Operation order is file order; line ordinal is derived rather than stored as another sequence. Every successor blob must preserve its predecessor as an exact byte prefix and append only complete canonical lines. Unknown authority-bearing operation types fail closed.

The trace is the Change dossier and sole semantic representation: proposals, feedback, Decisions, acceptance, requirements, work, Results, protected effects, completion, compensation, and retirement append there. Current Change state is deterministic reduction of the trace blob at one exact commit and fixed path, never a peer snapshot or custom tip. Target trace compaction, truncation, replacement, and deletion are forbidden. Bounded rehydration projections or lossy summaries bind source commit, path, blob, and line range and remain non-authoritative; full Git history stays canonical. Any future segmentation requires a separately qualified Git-backed layout and is outside this target.

Project Server stores active proposal history under `refs/codewiki/changes/<p2>/<b52>`, where `<b52>` is the 52-character lowercase unpadded Base32 SHA-256 of NFC `changeId` and `<p2>` is its first two characters. Exactly one managed ref may exist per active Change. It is durable in-flight reachability, not accepted project state or a new version protocol. Ref/hash-to-header mismatch or hash collision stops. Complete backups and explicit remote refspecs include it. Project Server is its sole writer.

Every proposal commit has the exact expected canonical commit as first parent. The first version has no other parent. A later version has the prior managed-ref tip as second parent, starts from current canonical project bytes, carries the exact prior Trace prefix, and appends a new `change.proposed` operation. Its delta from first parent is limited to the one Change trace path plus optional `.codewiki/wiki/items/**` changes; project artifacts, config, Packs, other Change traces, and other paths reject admission. This structure permits canonical-base refresh without losing prior proposal, feedback, Decision, or Result ancestry.

The proposal commit OID is the proposal version. Repository identity and frozen object format supply context; first-parent, tree, fixed paths, native blob OIDs, and optional second-parent history derive every other identity. No composite proposal-version protocol, proposal-record digest, separate Wiki proposal commit, or containing-commit self-reference exists.

The proposal operation owns intent, rationale, desired outcomes, authority intent, relationships to active Changes, compensation/supersession intent, complete `completionRequirements`, and completion rationale. Project Server derives the Wiki add/edit/move/retire set by comparing the proposal commit's first-parent and proposal trees and parsing stable Item IDs; producer-authored impact modes, tree OIDs, move claims, or shadow operations reject. Git rename similarity is never semantic identity.

| Derived Wiki diff | Completion Requirements | Outcome |
| --- | --- | --- |
| non-empty | empty | Meaning-only Wiki Change; acceptance also completes it. |
| non-empty | non-empty | Accept desired meaning, then continue to realization. |
| empty | non-empty | Conformance repair; `targetRefs` identify accepted Items and rationale explains the project/Wiki mismatch. |
| empty | empty | Invalid no-op. |

Editing intent, Wiki files, requirements, authority intent, or relationships appends a new `change.proposed` operation and creates a new proposal commit on the same managed ref. Decision, feedback, Candidate, Gate, and Result operations append through later commits while preserving the exact Trace prefix; Wiki bytes may change only in another proposal commit. Candidate, Results, confirmation, and downstream work bind one exact proposal commit OID. Any proposal commit, base, managed-ref tip, active-Change, authority, or relevant Wiki-tree change invalidates affected Results.

### Change Completion Requirements

A Completion Requirement is a frozen provider-neutral outcome condition, not a task, Check, Plugin command, or provider success claim. `completionRequirements` is always present and contains `0..1024` ordered requirements. Empty is explicit, not omission: Decision must validate completion rationale that no downstream project or Delivery work remains. A Change with a non-empty derived Wiki diff and an empty list completes in its acceptance commit. A non-empty list continues into Planning and later work. A Change with an empty Wiki diff requires at least one Item-targeted requirement.

```text
ChangeCompletionRequirement {
  requirementId: StableId
  ordinal: UInt32
  kind: artifact | evidence | check | integration | delivery | manual_confirmation
  requiredOutcome: string
  targetRefs: StableId[1..128]
  requiredEvidenceSchemas: NamespacedType[0..64]
  requiredCheckRefs: StableId[0..128]
  pluginCapability: NamespacedCapability | null
  dependencyIds: StableId[0..128]
  accountableActorId: StableId
  deliveryRequired: boolean
  requirementDigest: Digest
}
```

Requirement ID is `cw:<project-id>:requirement:<base32-sha256(change-id NUL ordinal)>`. Target refs, Evidence schemas, Check refs, and dependency IDs are each canonical sorted and duplicate-free; dependencies resolve within the same proposal version. `requirementDigest = H("codewiki.change-completion-requirement@1.0.0", preceding fields)`. Requirements name outcomes and standard capabilities, never provider brands. Decision may refine requirements only by producing a new proposal version before acceptance; accepted requirements are frozen. Later change requires explicit superseding/compensating Change authority, never in-place mutation.

The accountable Actor confirms the exact Candidate, Gate, proposal commit, derived Wiki diff, and requirement set. Project Server validates and freezes them. Planning decomposes non-empty requirements; Checks judge exact Candidates; Plugins return artifacts, observations, effects, and Receipts. None may declare Change completion.

### Atomic Change disposition commit

Decision disposition is one canonical Git transaction, not the entire Change lifecycle. Project Server:

1. revalidates Actor proof, authority, Candidate, Gate, exact proposal commit, active Changes, expected canonical commit, expected Wiki tree, and expected managed proposal-ref tip;
2. verifies that the proposal commit is an ancestor of that tip, every branch Trace blob preserves its predecessor prefix, and Wiki bytes changed only in proposal commits;
3. derives the exact Wiki add/edit/move/retire set and runs Kernel Validation over the accepted result, or verifies an empty diff and complete repair targets;
4. appends the terminal acceptance, rejection, deferral, or withdrawal operation and constructs one disposition commit whose first parent is the expected canonical commit and second parent is the exact managed proposal-branch tip;
5. for acceptance, uses the validated proposed Wiki plus terminal Trace; for other dispositions, retains first-parent Wiki/project bytes while carrying the complete terminal Trace; and
6. advances the configured canonical ref by expected-old-commit CAS and retires the managed proposal ref.

The terminal operation binds expected first parent, exact proposal commit and proposal-branch tip, Decision/Gate/Actor/authority facts, derived accepted/retired Item IDs, and frozen requirements when accepted. Native commit ancestry and fixed-path blobs supply exact version identity; the operation does not embed its containing commit OID. Admission freezes commit author/message/time inputs so crash retry can reproduce or locate the same object.

The canonical ref is the sole terminal commit point. A stale proposal ref observed during a multi-ref update grants no accepted authority once its terminal disposition is reachable from canonical first-parent history. Before canonical-ref CAS, created objects and proposal refs grant no accepted Wiki authority. After successful CAS, disposition, Wiki choice, Trace, and retained proposal ancestry are atomic in one commit. Crash recovery reads the canonical ref and ancestry. Remote publication, Delivery, and provider effects are separate guarded operations and cannot redefine local acceptance. No custom Wiki Update, application plan, checkpoint, State Commit, snapshot ref, or proposal-version protocol duplicates Git.

### Change lifecycle and completion

A Change proposal commit progresses through appended `decision_running -> decision_passed | decision_failed | decision_stopped` operations on its managed branch. Failure or feedback may produce a later proposal commit under the same Change. Authorized confirmation of an unchanged passed Candidate creates the two-parent acceptance commit. `reject | defer | withdraw` creates a two-parent disposition commit that retains branch ancestry and Trace while preserving first-parent Wiki bytes.

An accepted Change with zero Completion Requirements enters `completed` in the same acceptance Trace operation. An accepted Change with requirements enters `accepted_incomplete`; Project Server reduces each requirement through `pending | ready | running | satisfied | failed | stopped | superseded`. `satisfied` requires exact Evidence, Results, artifact/integration lineage, accountable confirmation when required, qualifying Plugin Receipts, and Delivery Receipt when `deliveryRequired:true`.

`change.completed` is Project Server-derived. For non-empty requirements it is a later immutable Trace operation whose Completion Record binds exact accepted proposal version, acceptance commit/Wiki tree, frozen requirements, reviewed aggregate where required, Evidence/Results, integration lineage, qualifying Plugin Receipts, and required Delivery Receipts. For an empty list, the acceptance operation also carries completion; `acceptanceCommitOid` is absent and the fixed `containing_commit` marker enters its Completion Record because embedding the containing OID would self-reference. The containing Git commit is then the acceptance/completion anchor. In both forms `completionDigest = H("codewiki.change-completion-record@1.0.0", preceding fields)`. Completion cannot be inferred from missing work, Wiki acceptance alone when requirements exist, raw provider success, artifact existence, or model output.

Feedback remains stage-local and append-only. Decision feedback targets a proposal version; Planning feedback targets requirement coverage/graph delta; Implementation feedback targets Work Unit/Candidate; Review feedback targets aggregate lineage; Delivery feedback targets exact external effect. Rehydration carries unresolved requirements and latest atomic feedback without rewriting accepted meaning.

Correction, compensation, or supersession is a new Change and proposal version. It may update Wiki or explicitly retain current Wiki while repairing conformance. Accepted Git history and historical Results/Completion Records remain immutable. Operational rollback restores execution capability; it never erases accepted meaning or pretends an external effect did not occur.

## Work Continuity

### Ownership boundary

DSH owns Session format, event log, surface projection, provider/model replay state, tool history, crash repair, AgentLoop, and optional compaction. Runtime stores DSH artifacts as opaque digest-checked evidence. Project Server owns Work Continuity: the durable journal, semantic boundary selection, rehydration construction, predecessor linkage, authorization, leases, expected-head CAS, and recovery choice.

CodeWiki MUST NOT deserialize DSH raw Session artifacts to recover project state. It may consume typed live Runtime events already admitted by the Run protocol for ledger and Receipt evidence. Backup copies opaque artifacts exactly. Unsupported or corrupt Session bytes stop same-Run recovery and never trigger translation.

### Physical and logical identity

One Work Continuity is scoped exactly as Backend v1 scopes producers: Decision and Planning by Change, Implementation by Work Unit Assignment lineage, and Review by frozen integration lineage. It names durable project work, not Project Server process uptime. A physical DSH Session belongs to one Run epoch in that Work Continuity.

`Work Continuity 1.0.0` binds:

- Work Continuity ID, generation, role, stage, and custody;
- physical Session ID and expected opaque head;
- exact subject ID and digest;
- Actor, Authority Grant, delegation, and Run authorization digests;
- provider, model, account, credential reference, route, and options digests;
- Runtime Build, Run protocol, DSH Plugin closure, tool/capability closure, and Workbench capability digest;
- canonical Git commit, exact proposal commit/managed-ref tip when active, fixed-path Change Trace blob, rebuilt WorkState, Candidate, Evidence set, Result set, and Run Context Bundle digests;
- Run Continuation and rehydration digests;
- predecessor Session ID, terminal head, and Run Receipt digest, or explicit genesis;
- active lease, journal predecessor, rollover reason, and record digest.

A fresh Session is inadmissible if any required binding is absent. Credential bytes never enter the record.

### Target Run Request, Receipt, and rollover cause

Run Request `7.0.0` retains the current bounded execution fields and separates immutable Run semantics from a dispatch attempt. Its canonical body contains:

- `semantic`: `runId`, `operationId`, custody, role, stage, exact subject ID and digest, Run creation time, deadline, authority, checkpoint, runtime, continuity, inputs, workspace, allowed effects, read/write scopes, budget policy, cancellation policy, containment bindings, and `runSemanticDigest`;
- `semantic.authority`: Actor, authentication context, Authority Grant, optional delegation, and operation-authorization digests;
- `semantic.snapshot`: repository identity, canonical Git commit, exact accepted or active proposal commit, managed-ref tip when active, derived Wiki Item diff, fixed-path Trace blob, WorkState, accepted-active-Change set, Candidate or null, Gate Report set, Evidence set, Result set, and unresolved-requirement-set digests;
- `semantic.runtime`: Runtime Build, Run protocol, DSH Plugin closure, provider, model, account, credential reference, route/options, tool set, execution-capability closure, and optional Workbench capability digests;
- `semantic.continuity`: Work Continuity ID and generation, physical Session ID, Run Continuation digest, predecessor binding, boundary kind, and rollover cause;
- `semantic.inputs`: Run Context Bundle, material, exact feedback, system prompt, producer prompt, and model-visible rehydration digests;
- `dispatch`: unique dispatch ID, `create | resume` mode, dispatch creation time, expected Session head or `absent`, lease digest, retained raw-log reference or null, and recovery reason or null;
- `requestDigest` over the complete normalized body except `requestDigest`.

`runSemanticDigest` is `H("codewiki.run-request-semantic@7.0.0", semantic without runSemanticDigest)`. `boundaryKind` is exactly `genesis | fresh_rollover` and describes creation of the Run, not a recovery dispatch. `genesis` requires no predecessor and null rollover cause. `fresh_rollover` requires the immediately preceding physical Session ID, terminal head, and Receipt digest plus a rollover cause. An initial dispatch requires `create`, expected head `absent`, and null raw-log and recovery references. A same-Run recovery dispatch preserves the exact semantic object, Run ID, semantic digest, and physical Session ID but has a new dispatch ID and Request digest, uses `resume`, binds a retained raw-log reference and concrete expected head, and states the recovery reason. Every accepted dispatch Request is retained in order; recovery never rewrites the creation Request.

A rollover cause is `{ primary, triggerFields }`. `primary` is exactly `terminal_successor | feedback_revision | semantic_input_change | execution_binding_change | recovery_reconciliation | operator_requested`; `triggerFields` is the sorted unique list of changed canonical field paths. `terminal_successor` is the default when no more specific change applies. The cause explains why a new Run exists; it never relaxes the mandatory fresh epoch after the predecessor terminal Receipt.

Run Receipt `5.0.0` preserves outcomes `completed | failed | cancelled | stopped` and binds the immutable Run semantic digest, ordered accepted dispatch Request digests, final Request, authority, Work Continuity generation, physical Session, predecessor, accepted handle, final event sequence, start and finish, exact resulting Session head, Ledger, raw log, output, usage, cancellation, quiescence, custody and operational gaps, and `receiptDigest`. Every valid producer Receipt is terminal for that Run and closes that physical Session regardless of outcome. `completed` reports execution completion only; Candidate admission, Gate judgment, Change acceptance, integration, Change completion, and Delivery remain separate Project Server facts. A missing required Ledger/log/quiescence closure or contradictory Session head cannot be upgraded to a terminal Receipt and therefore blocks successor creation until fail-closed recovery.

### Deterministic semantic boundaries

A fresh physical Session is mandatory:

1. after every terminal producer Run Receipt before another producer Run starts;
2. after Candidate freeze and external Gate evaluation when revision work continues;
3. when canonical Git commit, Wiki tree, Change Trace, WorkState, Planning, Assignment, integration lineage, Review aggregate, Evidence, Result, or unresolved-requirement identity changes;
4. when role, stage, subject, custody, Actor authority, delegation, provider, model, account, route, Runtime Build, Run protocol, Plugin/tool/capability closure, or Workbench capability changes;
5. after cancellation, explicit operator rollover, corruption, unavailable exact resume, compaction lock, summary drift, quality decline, or recovery reconciliation.

One Run binds one immutable Run Context Bundle. Changed canonical input, WorkState reduction, authorization, freshness, query engine, capability closure, or handle catalog requires a fresh Run and physical Session; no in-Run bundle replacement is allowed.

Same physical Session resume is permitted only for the same in-flight Run ID and `runSemanticDigest` after exact DSH persistence repair, with the same Build, route, authority, subject, canonical Git inputs, Run Context Bundle digest, capabilities, workspace, and budget policy. Its new recovery dispatch Request binds the repaired concrete Session head and retained raw log. A terminal Receipt forbids further resume of that Session. Missing or contradictory terminal evidence stops Work Continuity until exact evidence repair permits a valid stopped Receipt; operator authority cannot waive Receipt closure, and a successor cannot skip an unreceipted predecessor.

### Rehydration contract

After canonical replay, Project Server deterministically rebuilds WorkState and materializes `Run Context Bundle 1.0.0` for one authorized Run. The immutable read-only bundle binds repository identity, exact canonical commit, active proposal commit/ref tip where relevant, fixed-path Wiki/Trace bytes, WorkState reduction, Alignment, active Changes, Work Graph, Candidate set, Evidence, Results, Receipts, authorization, query-engine and capability closure, coverage, unknowns, freshness, staleness, bounds, and deterministic handle catalog. Its digest excludes capture time. Content-addressed chunks may be reused, but the bundle is not canonical state, a continuity source, or a Gate package. Run Request and Receipt bind its exact digest; retained prior bundles are execution Evidence only.

`Run Continuation 2.0.0` carries one canonical rehydration manifest in this order:

1. protocol, Work Continuity generation, boundary kind, and predecessor Receipt;
2. role, stage, exact subject, objective, and accountable authority;
3. Runtime Build, provider/model/account/route, tools, capabilities, and budgets;
4. repository identity, canonical Git commit, accepted or active proposal commit, and derived Wiki Item diff;
5. fixed-path Change Trace blob and WorkState facts;
6. current Candidate, Gate feedback, Results, and Evidence;
7. unresolved Change Completion Requirements, Work Units, dependencies, and typed failure ownership;
8. Run Context Bundle construction inputs, expected digest, and deterministic handle catalog;
9. explicit unknowns, truncation, staleness, and required drill-down.

Exact bounded source material is embedded when it fits the declared route budget. Remaining material is represented by provenance-preserving handles to retained exact bytes. Selection is deterministic over stage, subject, changed-since-predecessor sets, unresolved work, and configured bounds. A model-generated summary is an optional non-authoritative View and is never the only representation of a required fact.

Runtime injects the manifest through ordinary DSH Session input and records exact model-visible bytes in Execution Ledger. DSH remains free to store and project that input according to its Session contract; CodeWiki does not write DSH internals.

### Work Continuity state machine and failures

```text
genesis_ready
  -> lease_acquired
  -> physical_session_created
  -> run_active
  -> same_run_recovery? -> run_active
  -> terminal_receipt_committed
  -> boundary_closed
  -> successor_prepared
  -> successor_lease_acquired

any pre-receipt state
  -> cancelling -> stopped_receipt_committed | recovery_stopped

recovery_stopped
  -> cancelling only after exact evidence repair and expected-head authorization

any idle state
  -> quarantined | operator_stopped
```

Every journal transition uses expected record and Session-head CAS. One lease grants one writer. Expiry or cancellation removes authority but does not imply a Receipt. Stale writers, mismatched predecessor Receipts, changed bindings, duplicate authority, missing exact context, unsupported Session format, corrupt evidence, incomplete quiescence, and ambiguous tool effects fail closed. `recovery_stopped` authorizes no successor. It can re-enter cancellation only after authenticated repair restores the exact Ledger, raw log, Session head, and quiescence evidence required for a valid stopped Receipt. If that evidence is irrecoverable, the Work Continuity remains quarantined permanently; operator action may stop or investigate it but cannot synthesize closure. Recovery never fabricates Candidate completion, Gate Result, Receipt, or protected effect success.

### Local DSH compaction

Compaction remains useful only when one in-flight Run is long enough to approach its model context window before a safe Candidate boundary, especially tool-heavy Implementation. DSH should prune eligible tool results before model summarization and must preserve its own balanced surface and raw event history.

CodeWiki binds the allowed pressure policy and records DSH compaction observations and artifact digests in the Execution Ledger. It does not author, parse, or semantically validate summary text. `codewiki.compaction-summary@1.0.0` therefore retires at target cutover; retained v1 logs remain evidence. Compaction is disabled for Model Checks and is not used between terminal producer Runs. If safe intra-Run reduction is unavailable, the Run stops; a fresh successor is allowed only after terminal Receipt and exact rehydration.

## Work Continuity benchmark and qualification

### Compared strategies

The benchmark runs four paired strategies over identical subjects:

- `long-no-compaction`: one long DSH Session until context failure or completion;
- `long-compaction`: Backend v1-style cross-Run Session continuity with DSH compaction;
- `fresh-boundary`: fresh physical Session after each terminal producer Run with exact rehydration and no intra-Run compaction;
- `fresh-boundary-local-compaction`: target strategy with DSH compaction available only inside one Run.

The four strategies run as isolated policy modules inside one non-production benchmark Build so provider, DSH, prompt, tool, oracle, and measurement code remain common. `long-compaction` binds the exact Backend v1 continuity and CodeWiki Compaction Summary implementation digests and must reproduce frozen baseline goldens before comparison. Each strategy separately binds its Work Continuity and compaction-policy digest; the target strategy freezes its intra-Run pressure thresholds. Each pair otherwise binds the same provider, model, account, route, benchmark Build, prompt/tool versions, context window, task, repository or project snapshot, authority, budget, timeout, retries, concurrency, and trial ordering. Provider cache telemetry is used only when authenticated and available; absence is recorded as unknown, never zero.

### Workloads

Fixtures include multi-attempt Decision with changed sources, Planning decomposition with rejected coverage, tool-heavy Implementation, Review feedback routed to each owner, stale Wiki head, changed Assignment and integration lineage, crash before and after tool side effects, corrupted Session bytes, route/Build/authority rollover, source revocation, and every universal domain scenario. An external oracle identifies all facts and Completion Requirements that must survive each boundary.

### Measurements

For every Run and Work Continuity, the benchmark records:

- task success, completion-requirement coverage, Candidate correctness, Gate outcome, and Change completion;
- required-fact recall, unsupported-fact invention, stale-reference rate, wrong-head operations, and context-loss incidents;
- Gate feedback uptake, unresolved-requirement retention, repair-loop count, interventions, stopped attempts, and recovery time;
- source, cached-input, uncached-input, output, tool-result, rehydration, and compaction-call tokens;
- request, first-token, Run, boundary, recovery, and end-to-end latency;
- provider cache reads/writes/hits, stable-prefix length, and invalidation point where reported;
- ledger, Receipt, raw Session, exact retained material, handle, and summary bytes.

### Qualification rule

Deterministic safety, CAS, replay, provenance, recovery, and authority fixtures require 100% pass and zero protected-effect or stale-head violations. A model-quality cell is one predeclared scenario-family, workload, and route tuple. Each cell has at least 30 valid paired trials. Before target outcomes are unblinded, the benchmark freezes trial seeds and ordering, cell membership, strategy-policy digests, retry and timeout policy, bootstrap algorithm and seed, metric extraction, invalid-trial rules, and any latency-quality exception. Paired bootstrap resamples pairs within each cell; overall estimates weight eligible cells equally and trials equally within a cell, while scenario-family estimates weight that family's eligible cells equally. Reported intervals are 95% percentile intervals over each predeclared paired contrast: signed rate or quantile differences use target minus `long-compaction`, reductions use `(baseline estimator - target estimator) / baseline estimator`, and latency increase uses `(target median - baseline median) / baseline median`.

Every admitted trial is intention-to-treat: timeout, stop, recovery failure, missing required fact, or missing required measurement counts against the applicable target metric. A pair may be marked infrastructure-invalid only when authenticated evidence proves that neither strategy reached a model-visible or effectful event; the retained invalid record is replaced under the frozen ordering rule. Unknown provider billing makes the token branch unavailable rather than zero. A relative-improvement branch whose baseline denominator is zero is unavailable. No route or scenario may be silently dropped.

The target strategy qualifies only when:

1. the overall task-success difference has lower bound at least -3 percentage points and every scenario-family difference has lower bound at least -5 percentage points;
2. the upper bound for each overall stale-reference and required-fact-loss difference is at most +1 percentage point, with zero observed authority-critical losses;
3. the upper bound for the paired median repair-loop difference is at most zero and for the paired p95 difference is at most one loop;
4. either the lower bound for median billed-input-token reduction is at least 15% or the lower bound for p95 context-loss-incident reduction is at least 25%;
5. the upper bound for median end-to-end-latency increase is at most 10%, unless a separate G10-governed authorization was frozen before unblinding, binds the candidate Build, routes, fixtures, minimum quality gain, maximum latency ceiling, accountable approver, and Evidence digest, and the observed quality-gain lower bound meets that frozen minimum;
6. recovery completes from canonical state without reading project meaning from DSH bytes.

Failure keeps Backend v1 continuity in production and returns the hypothesis to SK0. Results bind complete fixture, route, Build, code, policy, trial, invalidation, raw measurement, estimator, weighting, bootstrap, exception, and analysis digests.

## Universal conformance fixtures

| Scenario | Minimum Wiki Items | Project artifacts and Evidence | Required adversarial case |
| --- | --- | --- | --- |
| Empty | no Item files | explicit empty Completion Requirements | bootstrap/replay on Windows and POSIX path rules |
| Software | behavior-policy and architecture Items with source/test relationships | Git snapshot/worktree, build/test Evidence, integration, Delivery | stale source head and overlapping Work Units |
| Research | descriptive-result and historical-context Items citing supporting/contradicting slices | manuscript or dataset artifact, reproducibility Evidence, publication | later source Revision withdrawn after acceptance |
| Legal | normative-clause and jurisdiction Items with approval relationship and restricted provenance | reviewed document and authenticated Human/Evidence Check | mixed ACL synthesis and superseding policy |
| Design | design-rule, token-set, and rationale Items with visual-asset provenance | exported design artifact and visual-review Evidence | binary asset changes while Wiki text remains unchanged |
| Music | recording, rights, and contributor Items with release requirement | master/release assets, rights Evidence, distribution Receipt | revoked license and conflicting ownership assertion |
| Logistics | plan, provider, and handoff-history Items with operational requirements | schedule/export artifact, handoff Evidence, Delivery target | delayed provider revision and partial Delivery |

All scenarios use identical Git, Wiki Item, Change lifecycle, and Kernel contracts. Scenario meaning appears only in namespaced Item types, relationships, Checks, project configuration, and admitted Plugins.

### SK0 applicability desk-check

SK0 applied the frozen contracts to one end-to-end paper fixture per scenario. Each non-empty fixture had to admit exact Raw Data where applicable, create one proposal commit containing an appended `change.proposed` operation and any proposed Wiki Item files, derive the Item diff from first-parent/tree identity, declare Completion Requirements, survive one failed Gate and fresh-Session rehydration, complete or retain every requirement, and express correction through compensation or supersession. This is an architecture conformance check; SK1 must encode the same fixtures as protocol goldens and reducer tests.

- **Empty:** canonical Git commit has no Wiki Item files and implies no Check, Plugin, Change, or Work. A later Change can add one prose Item with explicit empty requirements and complete in its acceptance commit.
- **Software:** separate policy and architecture Items relate exact behavior to source/test ownership. Two requirements demand implementation and verification. Stale Git/source heads reject integration; overlapping Work Units serialize. Failed Results, Gate Report, Assignment, and predecessor Receipt rehydrate into a fresh Implementation Session.
- **Research:** separate result and historical-context Items cite supporting and contradicting Revision slices. Metadata-only source remains visible but cannot satisfy reproducibility. Source withdrawal revokes handles and creates repair intake without erasing accepted history; a later Change may qualify or retire affected Items.
- **Legal:** clause and jurisdiction Items carry explicit approval/supersession relationships. Mixed-ACL synthesis inherits strictest policy. Human and Evidence Checks bind authenticated subject and exact document. New policy uses a new Change/proposal version that carries, replaces, waives with authority, or leaves prior requirements unresolved.
- **Design:** token-set and rationale Items cite visual masters stored as Git artifacts or Raw Data. Export and visual-review requirements bind immutable artifact identities. Changed binary with unchanged Wiki text creates an empty-Wiki-diff repair Change rather than synthetic Item edit.
- **Music:** recording, rights, and contributor Items relate to release requirements. Masters/artwork remain Git artifacts; rights documents remain Raw Data. Revoked access invalidates context and Delivery authority. Conflicting ownership becomes a separate assertion Item requiring Decision.
- **Logistics:** plan, provider, and handoff-history Items bind schedule/export and Delivery Receipts. Delayed provider Revision creates stale support and intake; partial Delivery leaves requirements open. Local restore cannot undo external handoff.

Every fixture uses proposed version → Candidate → Gate → confirmation → Git acceptance commit → completed-or-work state, expected-head/authority checks, standard Plugin boundary, and fresh physical Sessions. No scenario requires facet/claim peer schemas, Domain Plugin, extra Stage, binary Wiki content, inferred relationship, direct canonical-ref Plugin write, custom checkpoint, provider-specific core lifecycle, or rollback of accepted history.

## Resolved contract-family decisions

These decisions remove the prior SK1 blockers.

### Evidence and material

Evidence Record `2.0.0` is compact immutable observation metadata, not a byte store and not a Check Result:

```text
EvidenceRecord {
  protocol: codewiki.evidence-record
  version: 2.0.0
  evidenceId: stable string
  subjectRefs: EvidenceSubjectRef[1..128]
  observation: { schemaId, schemaVersion, body, observationDigest }
  materialRefs: EvidenceMaterialRef[1..64]
  producer: { kind, id, identityDigest }
  method: { tool, version, configurationDigest, runReceiptDigest? }
  observedAt: RFC3339 UTC
  authority: asserted | observed | verified | approved
  coverage: complete | partial | unknown
  freshnessBoundary: RFC3339 UTC | null
  sensitivity: public | project | private
  limitations: string[0..64]
  predecessorEvidenceDigest: sha256 | null
  evidenceDigest: sha256
}

EvidenceSubjectRef {
  kind: wiki-item | change-proposal-version | candidate | work-unit |
        git-snapshot | delivery-target | namespaced
  id: stable string
  digest: sha256
  refDigest: sha256
}

EvidenceMaterialRef {
  kind: raw-data-revision | raw-data-slice | project-artifact | run-receipt |
        change-operation | provider-receipt | actor-attestation | migration-receipt
  id: stable string
  digest: sha256
  custodyReceiptDigest: sha256 | null
  refDigest: sha256
}
```

`observation.body` is canonical JSON of at most 64 KiB under an exact schema and contains bounded interpreted facts, measurements, stance, and limitations, never copied source payload or opaque execution bytes. Open namespaced observation schemas add no lifecycle or acceptance authority. Subject and material refs sort by `refDigest`, reject duplicates, and contain no ambient path, URL, credential, or bearer handle. Raw Data refs require a non-null custody Receipt digest. Authorized expansion resolves a material ref through its owner and current access state. `observationDigest`, each `refDigest`, and `evidenceDigest` use domain-separated canonical hashes `codewiki.evidence-observation@2.0.0`, `codewiki.evidence-subject-ref@2.0.0` or `codewiki.evidence-material-ref@2.0.0`, and `codewiki.evidence-record@2.0.0` respectively; each excludes its own digest field. A Result remains a separate immutable judgment over exact Evidence, Candidate, Check, and configuration identities.

Web research ingests each page, response, document, provider result, or deterministic extraction as a Raw Data Source/Revision under the resolved policy. An extraction is a derived Revision bound to its source Revision and extractor digest. Research Evidence records the bounded finding, stance, method, limitations, query/provider Receipt where applicable, and exact Revision or Slice refs. Model synthesis is not source Evidence by itself. Human approvals, Run observations, project artifacts, and signed provider facts may cite their native immutable operations or Receipts without duplicating them into Raw Data.

Evidence is immutable even when material availability changes. Current availability derives from Raw Data access, retention, and deletion Receipts or the corresponding native owner; it is not edited into the Evidence Record. A Check that requires replayable material must bind a current `retained_exact` availability proof: exact policy, custody, access, and payload-state head Receipts plus successful digest verification of every referenced retained chunk or Slice. `metadata_only`, expired, revoked, deleted, or otherwise unavailable material remains explicit provenance but cannot satisfy that requirement. Loss of material never rewrites accepted Wiki meaning or a historical Result; it invalidates affected snapshots and reusable Results and creates governed repair work where policy requires.

Evidence `1.4.0` records remain immutable. SK5 migration may emit linked `2.0.0` records and a migration Receipt while preserving the predecessor digest. Existing artifact and Receipt refs map to their native owners. A legacy web citation without retained bytes becomes a `metadata_only` Raw Data revision with explicit unavailable payload state; migration preserves its locator and passage-digest facts but never refetches or invents custody. Any later fetch is a new Revision and new Evidence.

### Raw Data

Raw Data is private and immutable by revision. Exact target protocols are `codewiki.raw-data-source@1.0.0`, `codewiki.raw-data-revision@1.0.0`, `codewiki.raw-data-slice@1.0.0`, `codewiki.raw-data-acl@1.0.0`, `codewiki.raw-data-policy@1.0.0`, and `codewiki.raw-data-intake-receipt@1.0.0`. Source identity is stable. Revision identity commits admitted Plugin Manifest and exact `source.observe` capability, external revision, observed metadata and payload identity, complete observed chunk manifest, ACL, initial resolved policy, and derivation source/extractor when applicable, whether or not payload chunks remain retained. It excludes Intake Receipt and Source-head digests. Slices use a typed coordinate (`bytes`, `records`, `pages`, `time`, or namespaced Plugin coordinate) plus exact slice digest.

```text
RawDataPolicy {
  protocol: codewiki.raw-data-policy
  version: 1.0.0
  capture: metadata_only | cited_slices | full_revision
  retention: transient | ttl | while_referenced | pinned
  expiresAt: RFC3339 UTC | null
  operatorConstraintDigest: sha256
  projectDefaultDigest: sha256 | null
  sourceDefaultDigest: sha256 | null
  requestOverrideDigest: sha256 | null
  authorityDigest: sha256
  policyDigest: sha256
}
```

`policyDigest = H("codewiki.raw-data-policy@1.0.0", every preceding policy field)`. `metadata_only` requires `transient`; `ttl` requires a future `expiresAt`; all other retention modes require null. Operator and legal constraints first define the allowed capture/retention envelope, including minimum custody and maximum permitted storage. Project/source configuration supplies defaults within it. An authorized intake Request may strengthen them within that envelope; weakening a default requires explicit retention-policy authority. If neither configuration nor the Request selects a complete policy, intake stops with `retention_policy_required` before payload commit. Project configuration changes affect future intake only. Project Server freezes the resolved policy before intake commit and the Intake Receipt binds its digest, Source, Revision, selected cited slices, staged-payload verification, authority, and deletion deadline. The one-way identity order is Policy → observed payload/chunk manifest → Revision → Slices → Intake Receipt → Source-registry heads → Evidence. `cited_slices` commits an exact sorted non-empty Slice set before unstored staging bytes are removed.

CodeWiki admits bounded observations but owns no ongoing third-party connection. Watching, polling, webhooks, provider cursors, retries, backfill, extraction, normalization, entity resolution, reconciliation, apply, verification, and connection health belong to an external connection implementation. It may trigger an authorized `source.observe` Plugin Request, but its scheduling and connection state never enter CodeWiki authority.

Each completed `source.observe` Receipt binds exact external revision/head facts where available, observation time, payload identity, coverage, availability/freshness claims, custody gaps, and either admitted material or explicit no-change. Project policy and Checks judge whether those facts are current and sufficient; no provider claim creates Evidence, a Result, intake, or Wiki authority by itself. Every Wiki Item provenance ref and Evidence material ref remains trackable by Source and Revision. New, changed, missing, revoked, or stale support may create bounded Change Intake, but no external connection or Plugin writes Wiki.

Private layout is `$CODEWIKI_STATE_ROOT/projects/<project-id>/raw-data/sources/<source-id>/revisions/<revision-digest>/`, with canonical `manifest.json`, optional content-addressed retained chunks, and immutable policy/custody receipts. The private Source registry stores CAS-guarded current Revision, capture/retention-policy, last-observation-Receipt, custody, access, and payload-state heads; those heads are not part of immutable Revision identity. Links and special files are prohibited. `metadata_only` retains manifests and receipts but no payload; `cited_slices` retains only selected exact Slice bytes; `full_revision` retains the complete observed chunk set. `transient` retires selected payload at intake completion. At `expiresAt` for `retention: ttl`, Project Server denies new handles and `retained_exact` proofs immediately and requires payload/backup retirement; delayed physical cleanup grants no access. `while_referenced` blocks retirement while active policy, accepted provenance, unresolved work, or backup references it, and `pinned` blocks retirement until an authorized release. Accepted provenance does not otherwise imply permanent payload retention.

Backup is custody, not a retention bypass. A payload-bearing backup is admitted only when policy permits it; its expiry cannot exceed a `ttl`, and `transient`, `not_retained`, or retired payload is omitted. `while_referenced` counts a live backup until that backup's governed retirement. Restore reconciles the latest append-only policy, access, payload, and deletion Receipts and never reactivates bytes that became unauthorized after backup creation.

ACL is an ordered set of principals, classifications, purposes, and policy digest. Synthesis inherits the intersection of permitted audiences and the most restrictive classification. Mixed-access output is not declassified by summarization. Declassification requires explicit authority, a new Evidence-backed intake operation, and a new revision. Revocation immediately denies new handles, invalidates affected snapshots, retracts derived Alignment edges, and creates Change Intake repair work without silently rewriting accepted Wiki.

A Source head moves by expected-head CAS from `absent` to one immutable current Revision and then to newer Revisions or an access/deletion tombstone. Each older Revision becomes `superseded` but its manifest and receipts remain addressable. An admitted observation with unchanged exact material creates a new Revision only when external revision or committed metadata identity changed; otherwise it records a no-change observation Receipt. A newer Revision triggers deterministic dependency analysis. An unchanged referenced Slice may receive new Evidence that revalidates support; changed, removed, inaccessible, or expired material marks affected support `stale | missing | revoked` and invalidates reusable derived context and Results. Project policy may create bounded intake citing old and new Revisions. Neither an external connection nor a Plugin may write Wiki. Access state `active | revoked` and payload state `retained_full | retained_slices | not_retained | retired` are independent receipt-reduced state, never edits to Revision identity. Intake is `staged -> verified -> committed` or `staged -> stopped`; recovery completes or removes only that exact transaction.

An authorized on-demand operation may strengthen retention for exact bytes still staged or retained and advances the policy/custody receipt head by expected-head CAS. It cannot promise or reconstruct bytes already absent. Refetch after non-retention, retirement, deletion, or source change creates a new Revision and new Evidence even when content happens to match. Retirement or deletion preserves manifests, policy history, deletion Receipt, and access tombstone; revocation denies new handles immediately. Retired bytes never reappear under the same Revision digest.

### Alignment

Alignment edges are derived only. Canonical inputs are Raw Data Source/Revision/Slice refs and source-observation Plugin Receipts, Wiki Item IDs at an exact repository/commit, Change/Completion Requirement IDs, Git artifact identities, Evidence/Result digests, Plugin integration/Delivery Receipts, and declared relationship rules. Graph `6.0.0` records complete source identities, projector identity, coverage, unknowns, freshness, support state `current | stale | missing | revoked | contradicted`, and graph digest.

Dirty-set reduction begins from changed canonical input IDs, follows only declared dependency indexes, retracts prior edges from changed inputs, recomputes affected components in stable order, and verifies that a full rebuild yields the same digest. Source change invalidates current support/freshness and reuse, never accepted Wiki bytes, historical Results, or a historical Completion Record. If policy requests action, Project Server opens Change Intake and a later Decision may reaffirm, qualify, supersede, or retire meaning through a new Change with its own proposal version and accepted Git commit. No model or Plugin may invent a canonical edge or automatically rewrite Wiki.

### Kernel API and transport bindings

Kernel API `1.0.0` is the single public contract for commands, queries, events, capabilities, errors, canonical request/response encoding, and supported HTTP/local-socket transport profiles. Client SDKs wrap this contract; transport adds no operation, authority, or independently versioned Wire family.

Commands carry configured cryptographic identity proof, are Project Server-authorized, idempotency-keyed, expected-Git-head operations with linearizable admission by the one Project Server writer. Queries are commit-consistent and return repository identity, canonical commit, derived fixed-path Wiki identity, coverage, unknowns, truncation, and cursor. Cursors bind query, snapshot, filter, order, page bound, and expiry; they are not offsets into mutable state. Events are generation- and cursor-ordered, at-least-once, bounded, resumable, and require a fresh snapshot on a proven gap.

Handles bind subject, authorization, source snapshot, target, byte or item bounds, expiry, and digest. Expansion rechecks authorization and source availability. Capability discovery binds exact Kernel Build and exposes only public operations. Redaction omits unauthorized values while preserving explicit unknown/withheld coverage; it never substitutes misleading empty data.

CodeWiki App or another Client and an external identity provider may own login UX, SSO, OIDC, MFA, and token acquisition. Project Server accepts only proof from configured issuers, mutually authenticated peers, or scoped local capabilities; it validates signature or channel binding, issuer, subject, audience, expiry, nonce/replay state, and delegation before mapping an Actor. It never trusts an unsigned actor header or an app's hidden-button policy. Project Server alone authorizes every command and query, applies field redaction, admits protected effects, and records audit identity. An external policy evaluator may advise, but Project Server remains the enforcement point and fails closed when proof or policy is unavailable.

CodeWiki Console is the minimal first-party scriptable and terminal Client over those same public APIs, read-only by default and granted no implicit privilege. CodeWiki App is any separate rich product over Kernel API/Client SDK. AI Gateway is the target name for the credential, account-route, networking, budget, retry, and provider-request boundary; AI Provider is the external model supplier or local inference service. Persisted Backend v1 Private Provider Broker and Broker Host names remain historical protocol evidence. AI Gateway and DSH provider Plugins do not become CodeWiki Plugins or project authority.

API responses are `{ protocol, requestId, snapshot, outcome }` under every transport binding. Successful command outcomes carry operation and resulting-head digests; successful query outcomes carry ordered items, coverage, unknowns, truncation, and next cursor. Error codes are exactly `invalid_request | unauthenticated | unauthorized | not_found | gone | conflict | stale_head | unsupported_protocol | unsupported_capability | resource_exhausted | stopped | internal`. No error authorizes automatic mutation retry. An unchanged request may reuse its idempotency key only when `resource_exhausted`, `stopped`, or a declared transport failure carries `safeToRetry: true`. `conflict` and `stale_head` require current-state discovery and a new accountable operation and key; authentication, authorization, protocol, capability, `gone`, and internal failures stop.

### Kernel Validation

Kernel Validation is fixed release code, not a Check. It enforces canonical Git object/ref type, expected-old-ref CAS, proposal/Wiki tree diff, Wiki Item schema/bytes, stable-ID uniqueness and retirement, relationship/provenance closure, identity-proof validation, authorization, legal state transitions, explicit Completion Requirements and coverage, Work Graph acyclicity and dependency closure, finite budgets, Claim/Assignment exclusivity, artifact custody, Gate reduction, integration lineage, Delivery authority, Plugin Request/Receipt integrity, and replay equivalence. Parallel Work Units require proven disjoint writable scopes or explicit serialization; absence of overlap data means unsafe, not parallel.

Planning has no custom Gate. Kernel Validation requires complete Completion Requirement coverage, valid dependencies, bounded objectives, budget feasibility, and explicit overlap handling. User preferences may still be advisory Checks in Decision, Implementation, or Review.

### Checks and Packs

A Check has evaluator kind `code`, `model`, `evidence`, or `human`, enforcement `required`, `advisory`, or `observe`, and optional deterministic activation conditions. Installing a Check in the project-owned pack-first path is the explicit policy act; absent conditions means active for its declared stage and scope. Conditions bind frozen deterministic facts only. A Pack is transport/grouping only and grants no activation, enforcement, ordering, Skill, or authority.

Check Result states are exactly `passed` or `failed` and are reusable only under complete input identity. Check Invocation records operational `completed`, `error`, or `stopped`; `error` and `stopped` produce no Result. Any required failure fails the Gate, any required operational inability stops it, and no required Checks yields pass after Kernel Validation. Advisory and observe Results never block. Model Checks remain fresh isolated Sessions. Human Results require authenticated authority and exact subject. Pack composition rejects duplicate qualified Check identity or incompatible configuration.

Gate Evaluation Package `3.0.0` binds the Domain-free target subject and Candidate, repository identity, canonical and proposal commit OIDs, derived fixed-path Wiki tree, WorkState/Alignment/Evidence/Result/configuration/route heads, stage bindings, complete declared selections, Check policy, and coverage. During SK2–SK3 its Check policy is `{ kind: legacy-bridge, checkPackDigest, bridgeImplementationDigest }` for every stage that still has Backend v1 Checks. From SK4, Decision, Implementation, and Review use `{ kind: target, checkPackDigest }`, while Planning uses Kernel Validation and emits no Gate package. Neither policy form contains Domain identity.

Current Invocation `4.0.0`, Result `2.0.0`, and Gate Report `2.0.0` require a Domain-bearing legacy Check subject even though their `gatePackageDigest` accepts any exact package digest. The temporary compatibility component therefore emits:

```text
LegacyCheckBridgeReceipt {
  protocol: codewiki.legacy-check-bridge-receipt
  version: 1.0.0
  targetGatePackageDigest: sha256
  targetCandidateDigest: sha256
  targetSubjectDigest: sha256
  legacySubjectDigest: sha256
  legacyDomainIdentityDigest: sha256
  legacyPackSnapshotDigest: sha256
  mappingDigest: sha256
  bridgeImplementationDigest: sha256
  runtimeBuildDigest: sha256
  invocationDigests: sha256[0..256]
  resultDigests: sha256[0..256]
  legacyGateReportDigest: sha256 | null
  status: passed | failed | stopped
  stoppedReasonDigest: sha256 | null
  receiptDigest: sha256
}
```

The deterministic mapping derives legacy-shaped subject and input selections solely from the target package, immutable KB-to-Wiki Item maps, and bridge implementation; it never reads the inactive `kb/**` root. It preserves stage, stable subject ID, Candidate, declared inputs, and target refs, adding only the exact frozen legacy Domain identity needed to validate the old subject schema. `mappingDigest` binds every mapped subject field and ordered input-selection digest. Every legacy Invocation, Result, and non-null Gate Report must bind `targetGatePackageDigest`; every digest in the Receipt is ordered and duplicate-free. `receiptDigest` is `H("codewiki.legacy-check-bridge-receipt@1.0.0", every preceding field)`. Project Server derives bridge status from the verified legacy artifacts and accepts only the Receipt as target lifecycle input; raw legacy status has no target authority. `passed | failed` requires a non-null same-status Gate Report and null stopped reason. `stopped` requires a reason and permits only a null or stopped Gate Report. Result digests correspond exactly to completed Invocations, never errors or stops. Unmappable input, mismatched package/subject, partial Result, stale identity, or adapter failure yields `stopped`. Compatibility caching is disabled. The legacy Domain identity and raw artifacts remain execution Evidence only. Before SK4 activation, every bridge package must have a terminal Bridge Receipt and every legacy Check process, lease, and cache entry must be closed or removed under the old Build; missing closure blocks migration. SK4 then retires bridge creation and activates target Invocation/Result/Gate contracts. Historical Receipts remain readable but never enter a new Gate; continued work freezes a new target-policy package.

### Domain Plugins

The target deletes Domain Plugin semantic ownership and its identity from Wiki Item, Candidate, Gate, Run, Runtime Build, and Kernel Build contracts. Open namespaced Item types replace knowledge vocabulary contributions. Checks replace evaluation contributions. Mandatory local Git replaces project-store abstraction; CodeWiki Plugins replace external source, remote, workspace, verification, collaboration, integration-preparation, and Delivery adapters. DSH Plugins remain release-managed Runtime capabilities behind a different trust boundary. No thinner Domain Plugin authority seam is retained.

### CodeWiki Plugins

One language-neutral CodeWiki Plugin boundary replaces separate provider-specific driver families. Exact common protocols are `codewiki.plugin-manifest@1.0.0`, `codewiki.plugin-request@1.0.0`, and `codewiki.plugin-receipt@1.0.0`. The Plugin Protocol is the wire contract; first-party SDKs are convenience implementations plus conformance fixtures and grant no authority. Public applications use Kernel API and Client SDK, Checks use Check SDK, and DSH execution uses DSH Plugins; none is silently admitted as a CodeWiki Plugin.

A Plugin Manifest binds stable Plugin ID and version, implementation and dependency-closure digests, supported Plugin Protocol range, sorted capability declarations, configuration-schema digest, capability ceiling, required host/isolation facts, permissions, qualification Evidence, and `manifestDigest`. Standard target capabilities are `source.observe`, `remote.observe`, `remote.publish`, `workspace.prepare`, `verification.observe`, `integration.prepare`, and `delivery.apply`, each at `1.0.0`. `source.observe` admits one bounded observation; ongoing connection scheduling and provider state remain external. Namespaced extension capabilities are valid but cannot add a Stage, state transition, canonical writer, authority source, Result kind, completion rule, or protected-effect class.

Each Plugin is operator- or release-admitted. Project files select only admitted manifest digests and bounded configuration; they cannot name executable paths, install code, widen permissions, or alter admission. A Plugin receives one immutable capability-scoped Request binding operation and idempotency IDs, exact subject and snapshot handles, expected external head when applicable, configuration and authority digests, budgets, deadline, allowed effect, and Request digest. It receives neither canonical storage nor general Project Server credentials.

A Plugin Receipt binds Request, manifest, capability, `completed | failed | stopped` status, exact observations or proposed artifacts, before/after external heads, performed-effect facts, provider-native receipt refs, custody and operational gaps, start/finish, and Receipt digest. Manifest, Request, and Receipt digests are respectively `H("codewiki.plugin-manifest@1.0.0", preceding fields)`, `H("codewiki.plugin-request@1.0.0", preceding fields)`, and `H("codewiki.plugin-receipt@1.0.0", preceding fields)`; arrays are canonical ordered and duplicate-free. Provider-specific metadata is bounded under namespaced fields and never enters generic authority. Only a complete verified Receipt can establish an observation or external mutation; it cannot create Evidence payload custody, a Check Result, canonical Git commit/ref update, Change acceptance, `change.completed`, authorization, or a lifecycle transition by assertion.

Plugin execution is `requested -> admitted -> running -> completed | failed | stopped`. Lease expiry removes authority and leads to stopped reconciliation, not completion. `remote.observe`, `remote.publish`, `integration.prepare`, and `delivery.apply` bind expected-head semantics where the provider exposes a head; Workbench freeze is immutable; verification is Git-commit-bound; integration is lineage-bound. Retry reuses one idempotency key only when the Receipt or provider query proves no conflicting effect. External Delivery is reconciled or compensated and cannot be undone by local rollback. Git object, commit, tree, worktree, and canonical-ref mechanics are mandatory Kernel infrastructure. Plugins may interact with remotes, external workspaces, and providers, but only Project Server validates proposed bytes and advances canonical Git. Provider implementations remain replaceable without changing Change or Wiki semantics.

### Maintenance findings

Transient faults and diagnostics remain private operational state. A finding requiring accountable work enters Change Intake with Evidence. A durable statement worth accepting enters Wiki only through Decision. There is no privileged Error Book or maintenance side channel in canonical state.

### Execution Host and Windows

Execution Host Contract `1.0.0` is implementation-neutral. Node orchestrates protocol and policy but is not assumed to prove path-safe launch, process-tree custody, sealed capability transfer, or quiescence by itself. SK6 first composes qualified external Linux primitives; if they cannot emit complete enforcement facts, a small native supervisor becomes mandatory. This implementation choice does not change the frozen host contract.

Production remains Linux x64. Windows Clients may use a remote Linux Kernel/Execution Host. WSL2 is a separately qualified Linux bridge, not native Windows support. Microsoft MXC, AppContainer/ProcessContainer, Job Objects, and native handles remain SK7 candidates. No Windows production claim exists until the complete outer Execution Host, inner tool sandbox, credential custody, network, path, quiescence, recovery, and Evidence contract passes on exact Windows builds.

## Transformation inventory

### Source and test closure sets

The following path sets are exact inventory closures for planning. A future slice MUST expand its assigned set at the clean parent commit and fail review if an affected file lies outside the declared expansion.

- **F0 — product/build:** `README.md`, `package.json`, `src/index.ts`, `src/pi-extension.ts`, `src/project-server/index.ts`, `src/runtime/index.ts`, `src/error-handling/**`, `scripts/build-dsh-runtime.mjs`, and release/package scripts selected by `package.json`.
- **F1 — Wiki/Knowledge:** `src/knowledge/**`; `src/domains/{binding,defaults,migration,project-server}.ts`; `src/domains/software-development/**`; `src/project/{bootstrap,config,config-file,root,snapshot,state-file}.ts`.
- **F2 — Change/Work/State:** `src/changes/**`, `src/loops/decision/**`, `src/loops/planning/**`, `src/work-state/**`, `src/project/private-state.ts`, `src/project-server/{admission,commands,coordinator,effects,lifecycle,persistence,queries,scheduling,claims}/**`, `src/project-server/operations/**`, and `src/project-server/api.ts`.
- **F3 — Alignment/Evidence/Raw Data:** `src/alignment/**`, `src/evidence/**`, `src/changes/{intake,triage}/**`, `src/project-server/project-context/**`, `src/runtime/context/**`, `src/runtime/dsh/{context-tools,project-context-tools,provenance}.ts`, plus target `src/raw-data/**`.
- **F4 — Checks/Packs:** `src/checks/**`, `src/runtime/checks/**`, `src/project-server/lifecycle/**`, `src/loops/implementation/{policy,iteration,work-unit-candidate}.ts`, `src/loops/review/**`, `check-packs/**`, and `src/domains/software-development/check-packs.ts`.
- **F5 — mandatory Git/project integration and CodeWiki Plugins:** `src/git/**`, `src/project-server/{claims,delivery,integration,review,scheduling,workbenches,workers}/**`, artifact-effect modules in `src/project-server/effects/**`, `src/loops/{implementation,review}/**`, `src/runtime/review/**`, and `src/preview/**`.
- **F6 — Kernel API/applications:** `src/protocol/**`, `src/clients/**`, `src/pi-extension.ts`, `src/project-server/{app,frontend,harness,mcp,pairing,authentication,queries,repository-access}/**`, `src/project-server/api.ts`, and `src/project-server/sessions/contracts.ts`.
- **F7 — Runtime/continuity:** `src/runtime/**`, `src/project-server/sessions/**`, `src/project-server/operations/**`, and `src/project-server/workers/{implementation-run,execution-recovery,model-assignment}.ts`.
- **F8 — configuration/plugins:** `src/domains/**`, `src/plugins/**`, `src/project/{bootstrap,config,config-file,model-routing,root,source-architecture,state-file}.ts`, `src/runtime/dsh/{managed-loader,plugins,core-plugins,broker-plugins}.ts`, `package.json`, and package lock/build scripts.

Test closures mirror these owners: **Q1** `tests/{knowledge,domains,project}/**`; **Q2** `tests/{changes,work-state,loops}/**`, `tests/project-server/{admission,commands,coordinator,effects,lifecycle,queries,scheduling}/**`, and `tests/project-server/operations/**`; **Q3** `tests/{alignment,evidence}/**`, `tests/runtime/context/**`, `tests/runtime/dsh/{context-tools,project-context-tools,provenance}.test.mjs`, and target `tests/raw-data/**`; **Q4** `tests/checks/**`, `tests/runtime/checks/**`, and Check/Gate tests under `tests/loops/**` and `tests/project-server/lifecycle/**`; **Q5** `tests/project-server/{integration,workers,workbenches,review}/**`, `tests/project-server/{claims,work-unit-claims,work-unit-claim-selection,product-publication,product-release,project-branch-merge,project-branch-push}.test.mjs`, `tests/loops/implementation/**`, and `tests/runtime/review/**`; **Q6** `tests/{protocol,clients}/**`, `tests/project-server/{app,frontend,harness}/**`, and `tests/project-server/mcp-binding.test.mjs`; **Q7** `tests/runtime/**`, `tests/project-server/continuity/**`, `tests/project-server/execution-recovery.test.mjs`, and `tests/project-server/operations/**`; **Q8** `tests/benchmarks/**` and `benchmarks/**`; **Q9** `tests/project-server/readiness-checklist.test.mjs`, `tests/project/source-architecture.test.mjs`, `tests/scaffold-core.test.mjs`, `tests/project-server/{package-install-smoke,project-local-install-smoke,external-package-lifecycle-smoke,external-dogfood-smoke}.mjs`, diagnostics-ratchet tests or scripts, and disposable packed-install programs.

### Release gates

- **G0 Contract:** schema invalid/valid goldens, canonical bytes, JSONL framing/prefix/record-chain vectors, bounds, and cross-platform paths.
- **G1 State:** Git object/ref validation, expected-old-ref CAS, trace-tip reduction, replay, acceptance-commit atomicity, crash, compensation, supersession, and explicit empty-requirement completion fixtures.
- **G2 Migration:** backup, dry run, identity/legacy-record maps, retention-stub hydration, quiescence, crash points, no dual roots, restore, and old-reader refusal.
- **G3 Authority:** identity-proof validation, Actor mapping, AuthZ, one writer, Plugin ceiling, provenance, ACL, redaction, and protected-effect denial.
- **G4 Universal:** empty, software, research, legal, design, music, logistics, and adversarial fixtures.
- **G5 API:** Kernel API transport-binding compatibility, idempotency, pagination, event gap recovery, handles, and capability discovery.
- **G6 Runtime:** Build/route/account/model binding, Work Continuity, Receipts, opaque-byte custody, containment, quiescence, and fault recovery.
- **G7 Benchmark:** continuity and context benchmark qualification above.
- **G8 Package:** typecheck, build, full tests, production tests, package/install, disposable external lifecycle, dependency/security audit.
- **G9 Architecture:** readiness, source architecture, LSP, Pi-Lens, diagnostics ratchet, `git diff --check`, and no forbidden residue.
- **G10 Governance:** released controller N governs exact candidate N+1 and preserves rollback Evidence.

### Row mapping

| ID | Transformation | Files/tests | Protocol and persisted identity | Migration and rollback | Required gates |
| --- | --- | --- | --- | --- | --- |
| T01 | Runtime product → Semantic Kernel | F0, F6; Q6, Q9 | Frontend `1.0.0`, Backend Build `2.0.0`, release manifest → Kernel API/Build/release target | Clean API/product rename; prior package remains installable; no state rewrite solely for branding | G5, G8, G9, G10 |
| T02 | `.codewiki/kb/**` + `.codewiki/traces/**` → Wiki Items + `.codewiki/changes/**` | F1, F2; Q1, Q2, Q9 | Knowledge State/Projection/Checkpoint and Trace `12.0.0` → Wiki Item, native proposal/disposition commits, managed refs, and Trace `13.0.0` | One quiescent backup-tagged `kb-to-wiki@1.0.0` Git commit after exact stub hydration; preserve legacy record map; pre-target-acceptance ref restore, then target-compatible restore or forward repair only; reject dual roots | G0–G4, G8–G10 |
| T03 | Product/System/Design/Lexicon profile → universal Wiki Items | F1, F2; Q1, Q2, Q8 | Domain-bound compiler/Candidates → Item and commit-bound Git target | Map legacy terms into owning Items; emit no Lexicon container; preserve IDs/bytes/maps; restore backup ref on pre-activation failure | G0–G4, G8–G10 |
| T04 | Path-constrained kinds → stable Item IDs/portable files | F1, F3; Q1, Q3 | OKF v0.2/path rules → Wiki Item/Git tree target | Validate portable destination map before commit; case/path conflicts stop; rollback with T02 backup ref | G0, G2, G4, G8–G10 |
| T05 | Page source metadata → Item provenance | F1, F3; Q1, Q3 | Evidence `1.4.0` and current context identities → Evidence `2.0.0`, Item provenance, Raw Data, Alignment `6.0.0`, Run Context Bundle `1.0.0` | Existing source becomes explicit observation/material refs; absent bytes migrate as metadata-only unavailable provenance, never invented custody | G0, G2–G5, G8–G10 |
| T06 | Domain Plugin semantic ownership → explicit owners | F1, F4, F5, F7, F8; Q1, Q4, Q5, Q7, Q9 | Domain admission `2.0.0` and identity `1.0.0` leave semantic/Build bindings at SK2 | SK2 removes authority identity and uses a generic compatibility digest plus temporary Check Bridge Receipt; SK4 migrates residual behavior, retires the bridge, and deletes the Domain Plugin; common rollback applies | G0–G6, G8–G10 |
| T07 | Software bootstrap → explicit/empty Wiki | F1, F8; Q1, Q9 | Current bootstrap/Domain checkpoint → empty-or-Item Git tree | No Wiki Item path is valid empty state; optional templates enter through a normal Change; old scaffold migrates as ordinary Items | G0, G2, G4, G8–G10 |
| T08 | Seeded default Packs → explicit installation | F4, F8; Q4, Q9 | Pack snapshot `2.0.0` → `3.0.0`; project config digest changes | Record exact installed Packs; stop automatic restoration; backup old files; downgrade refuses new layout | G0, G2–G4, G8–G10 |
| T09 | Stage-first → pack-first layout | F4; Q4, Q9 | `.codewiki/check-packs/<stage>/<pack>` → `<pack>/<stage>`; Pack `3.0.0` | Quiescent collision-checked move with byte/digest equality; no dual lookup; exact restore on failure | G0, G2–G4, G8–G10 |
| T10 | Pack Skills → external producer Skills | F4, F7, F8; Q4, Q7, Q9 | Pack Skill receipts `1.0.0`, Run Request/Ledger bindings → target external capability binding or null | Remove Pack Skill fields atomically with Pack/Run protocol advance; retained Runs cannot resume | G0, G2, G3, G6, G8–G10 |
| T11 | Planning Checks/Gate → Planning Kernel Validation | F2, F4; Q2, Q4 | Planning Candidate `3.0.0`, Gate package `2.0.0`, Check invocation `4.0.0` advance | Preserve historical Results; new Planning uses no Check activation; old-Build downgrade is allowed only before target-only records | G0–G4, G8–G10 |
| T12 | Hidden implementation quality Pack → Kernel Validation + explicit Checks | F4, F5; Q4, Q5 | hidden Pack ID and stage policy `1.0.0` → Check/Kernel target | Map invariants to fixed validation and preferences to explicit Checks; prove no enforcement loss before deleting Pack | G0–G4, G8–G10 |
| T13 | Code/Model blocking Checks → four evaluators/three enforcement modes | F4, F7; Q4, Q7 | Check `1.0.0`, invocation `4.0.0`, Result/Gate `2.0.0`, temporary bridge → target versions | Bridge raw legacy outcomes only through verified Receipts; historical Results remain readable but never mix into new Gates; migrate installation as explicit activation and retire bridge atomically | G0–G4, G6, G8–G10 |
| T14 | Browser/in-core product UI → external applications | F0, F6; Q6, Q9 | Frontend API/capabilities/events `1.0.0` → Kernel API with transport bindings | Remove internal application only after public operation parity; old package rollback, no canonical migration | G3, G5, G8–G10 |
| T15 | Dashboard/lifecycle UI → CodeWiki Console | F6; Q6, Q9 | Operations `1.0.0` and Kernel API target | Console consumes public APIs; no storage migration; previous CLI package is rollback | G3, G5, G8–G10 |
| T16 | Semantic Desktop → CodeWiki App | documentation and F6 exclusion tests; Q6, Q9 | no in-repository persisted identity | No migration; release manifest proves absent privileged App code | G3, G5, G8–G10 |
| T17 | Frontend naming → Kernel API/Client SDK | F6; Q6, Q9 | frontend and client protocols `1.0.0` → one Kernel API target with canonical transport profiles | Clean endpoint/capability cut, configured identity proof, Project Server AuthZ, explicit unsupported-version error; package rollback | G0, G3, G5, G8–G10 |
| T18 | Scattered Git assumptions → mandatory Git store + external Plugins | F2, F5, F8; Q2, Q5 | current Git/Workbench/integration/delivery schemas → Git store profile plus Plugin Manifest/Request/Receipt capabilities `1.0.0` | Preserve repository/object format and commit/tree identities; centralize canonical-ref CAS in Project Server; migrate only remote/external mechanics behind Plugins | G0–G6, G8–G10 |
| T19 | CI terminology → `verification.observe` | F4, F5; Q4, Q5 | Evidence adapters and Check inputs → Plugin capability `1.0.0` | Existing CI Evidence maps to exact-commit generic Evidence; Plugin output grants no Result or completion authority | G0, G3–G5, G8–G10 |
| T20 | Deployment terminology → `delivery.apply` | F2, F5, F6; Q2, Q5, Q6 | Delivery Authority `1.0.0`, release/publication records → Plugin capability `1.0.0` and advanced Trace | Preserve provider receipts and protected heads; no replayed effect; rollback cannot undo external Delivery | G0–G6, G8–G10 |
| T21 | Knowledge-to-source Alignment → full lineage spine | F1, F2, F3, F5; Q1–Q5 | current projector `5.0.0` → Alignment `6.0.0` | Rebuild derived graph from canonical inputs; never migrate cached edges as authority; discard on rollback | G0–G5, G8–G10 |
| T22 | No Raw Data subsystem → private Raw Data + source observations | F2, F3, F8 plus new `src/raw-data/**`; Q2, Q3, Q9 plus new fixtures | Raw Data/Policy `1.0.0`, `source.observe`, Evidence `2.0.0`; private state and Build advance | Resolve capture/retention before Receipt; externalize connection state; no automatic Wiki commit; expiry/revoke/delete fail closed | G0–G6, G8–G10 |
| T23 | Project Context Snapshot → Run Context Bundle | F3, F7; Q3, Q7, Q8 | Snapshot/Auth/Mount/Store `1.0.0` → Bundle `1.0.0` family | v1 snapshots expire/read-only; rebuild WorkState from canonical owners, then materialize one authorized bundle per Run; retained bundles are Evidence only | G0, G1, G3–G7, G8–G10 |
| T24 | Linux-specific production binding → Execution Host | F7; Q7, Q8, Q9 | Runtime qualification `1.0.0` and active Build closure → Execution Host Contract `1.0.0`, qualification `2.0.0`, and new Runtime Build Manifest `5.0.0` | Keep Linux reference; no activation without exact host Evidence; prior qualified Build may reactivate only when it supports current protocols and heads | G0, G3, G6–G10 |
| T25 | DSH execution closure retained/qualified | F0, F7, F8; Q7–Q9 | Run `6.0.0`, Receipt `4.0.0`, Ledger `5.0.0`, DSH closure → target Run/Receipt/Ledger/Build | No DSH byte translation; retained Sessions evidence-only when closure changes; prior Build rollback cannot resume target Sessions | G0, G3, G6–G10 |
| T26 | App/CLI/Pi → external/minimal clients | F0, F6; Q6, Q9 | client/pairing/frontend protocols `1.0.0` → Kernel API transport profiles/Client SDK | Preserve explicit pairing where useful; uninstall internal UI without deleting canonical state; packed external rollback | G3, G5, G8–G10 |
| T27 | Backend Build/Release → Kernel Build/qualification | F0, F7, F8; Q7, Q9 | Backend Build `2.0.0`, release `1.0.0` → Kernel Build/release `1.0.0` | Expected-build transition, exact backup, inactive prior Build retention, forward-only persisted protocols | G0–G10 |
| T28 | Long-lived cross-Run Sessions/CodeWiki summary → Work Continuity/fresh Sessions | F2, F3, F7; Q2, Q3, Q7, Q8, Q9 | Session Continuity `1.0.0`, Continuation/summary `1.0.0`, Run `6.0.0`, Receipt `4.0.0`, Ledger `5.0.0` → Work Continuity `1.0.0` and target Run versions; summary retired | v1 journals readable but inactive; create Work Continuity from canonical state and last valid Receipt; retain opaque DSH bytes; rollback only to target-compatible current-head backup | G0–G3, G6–G10 |

## Exact migration and rollback policy

### Sequenced cuts

Persisted changes follow roadmap dependency order and do not share one oversized activation:

1. **SK2 Git/Wiki cut:** freeze repository/object format and canonical ref; migrate compiled Knowledge and `kb/**` to ordinary Wiki Item files in one backup-tagged Git commit; convert active Change proposal, Candidate, Gate package, Work Graph, WorkState, private-state, and Build identities to native proposal commit/managed-ref and canonical commit identities. New target records omit Domain authority and custom Wiki state/projection/checkpoint/application-plan identities. Until SK4, one release-managed compatibility component may execute old Domain-contributed Check behavior and emit the verified temporary Bridge Receipt that alone enters target lifecycle reduction.
2. **SK3 API cut:** activate one Kernel API with canonical transport bindings and Client SDK plus external/minimal Client surfaces, configured identity-proof validation, and Project Server AuthZ. This changes protocol/Build identity but not Git Wiki history.
3. **SK4 policy and Plugin cut:** migrate stage-first Packs to pack-first layout; remove Pack Skills, Planning Checks, hidden quality policy, remaining Domain identity, and provider-specific remote/CI/deployment mechanics from core; activate target Checks, Plugin Protocol/SDK, external capability contracts, and Plugin-backed requirement reduction. Mandatory local Git and Project Server canonical-ref authority remain core.
4. **SK5 context cut:** activate Raw Data/Policy `1.0.0`, `source.observe`, Evidence `2.0.0`, Alignment `6.0.0`, and Run Context Bundle `1.0.0`; migrate active Evidence refs without inventing bytes, then rebuild WorkState/indexes/graphs and materialize bundles from canonical inputs.
5. **SK6 continuity and host cut:** activate Work Continuity `1.0.0`, Run Continuation `2.0.0`, Run `7.0.0`, Receipt `5.0.0`, Ledger `6.0.0`, and Execution Host versions only after qualification; activate a new Runtime Build Manifest `5.0.0` instance binding that exact closure. DSH artifacts are retained, never translated.
6. **SK7 platform cut:** add no persisted support marker until an exact Windows profile independently passes the complete contract.

Each cut has its own migration ID, quiescence proof, complete backup, expected source and target Builds, dry-run output, recovery transaction, Receipt, release gate, and rollback point. Within a cut, the replaced authority is never dual-read or dual-written. Cross-slice compatibility is explicit in the active Build rather than inferred from whichever files happen to exist.

### KB-to-Wiki transformation

`codewiki.kb-to-wiki-migration@1.0.0` consumes exact source Git repository/object format/canonical commit, compiled Knowledge State `1.0.0`, Projection/Checkpoint `2.0.0`, canonical KB tree, Domain/compiler identity, Change Trace head, and source Build. Source compilation remains migration evidence; target semantics come from emitted Item files and Git objects, not filename/heading rediscovery.

Before generation it stops Project Server, proves quiescence, and creates an immutable backup tag/ref naming the exact source commit plus a complete private-state backup. It freezes `migrationIntentDigest = H("codewiki.kb-to-wiki-migration-intent@1.0.0", { repositoryId, objectFormat, sourceCommit, sourceBuild, sourceCheckpoint, sourceState, sourceProjection, sourceTraceHead, itemIdentityMap, pathMap, authority, implementation })`. Target commit OID and Receipt digest are excluded to avoid self-reference.

- Every current Knowledge subject except a structural `type: Lexicon` container becomes one Wiki Item and keeps exact `codewiki_id` when valid. Invalid IDs map permanently to `cw:<project-id>:item:<base32-sha256(old-id)>`; collisions stop migration.
- A legacy Lexicon container emits no target Lexicon Item. Each term, exact definition, alias, and owner link enters its referenced owning Item; a term without an owner becomes an ordinary Item. Ambiguous ownership stops migration. The source bytes and term-to-Item map remain migration evidence, and any glossary is a derived View.
- Each current independently mutable facet becomes a separate Item because target has no facet schema. Its ID is `cw:<project-id>:item:<base32-sha256(subject-id NUL facet-key)>`; an explicit namespaced relationship links it to its former owner. Uncovered accepted page body remains in the subject Item, so no bytes disappear.
- Current claim-like cells that need independent provenance or mutation become namespaced Items such as `codewiki.claim`; otherwise their text remains ordinary owning-Item content. Migration never creates a peer Claim class.
- Current accepted relationships become bounded relationship fields on source Items. Duplicate tuples retain stable source order. Unknown predicates remain namespaced opaque values. Explicit aliases become Item aliases; titles/paths do not fabricate aliases.
- Current source metadata becomes exact provenance refs after validation. Unresolved metadata becomes immutable Evidence `1.4.0` migration record with inaccessible status/reason; target provenance cites that record and never claims unavailable bytes as support.
- Remaining bounded frontmatter fields enter `codewiki.legacy:frontmatter` attributes after secrets, generated indexes, and mapped fields are excluded. Project-requirement metadata belonging to an active Change becomes exact Completion Requirements; satisfaction rebuilds as derived Alignment.
- Item paths under `.codewiki/wiki/items/**` are deterministic, portable, collision-free, and non-authoritative. Accepted current retirements become retirement facts in converted Change Trace; no tombstone file is emitted. Missing or ambiguous retirement stops migration rather than freeing an ID.
- Every Backend-v1 retention stub is first hydrated from its exact verified Git restore ref. Missing, mismatched, or partial archive history stops migration; no stub or summary substitutes for operations.
- Source record order becomes exact target file order. Original record IDs, parent IDs, source digests, and operation bytes remain bound through an immutable legacy-record map and Receipt; target operations add no duplicate digest chain.

The migration creates one candidate canonical commit that removes active `kb/**`, adds Wiki Item files, converts each Backend-v1 `.codewiki/traces/TRACE-CHG-<id>.jsonl` dossier into its target `.codewiki/changes/TRACE-CHG-<id>.jsonl` trace, and creates one dedicated migration Change trace. Historical accepted operations remain immutable legacy evidence rather than fabricated proposal versions; converted terminal traces remain terminal and receive no synthetic append. From that candidate commit, each active Change gets one managed-ref proposal commit containing one complete migration-authored `change.proposed` operation, its proposed Wiki bytes when different, and preserved intent, authority, outcomes, relationships, and unresolved requirements. The proposal commit OID is its version.

The Receipt binds source commit/state/projection/Trace, every identity/path/provenance/retirement map, emitted Item blob/tree OIDs, every converted fixed-path Trace blob, every active proposal commit/ref, the migration Change trace's pre-operation blob, Kernel Build, migration intent, and implementation. `migration.applied` then binds Receipt digest as the final migration Trace operation; neither it nor the Receipt contains the candidate canonical commit OID. A legacy-equivalence reader reconstructs every compiled current subject, independently mutable cell, relationship, accepted body, and retirement from target Items plus maps. Kernel Validation reparses the candidate tree, checks Git object types and Item/reference/retirement closure, and proves WorkState equivalence before Project Server atomically advances canonical ref and creates every active managed Change ref with expected-old-OID checks while stopped.

Crash before ref transaction leaves unreachable staging objects and source ref authoritative. Crash after the transaction is complete and recoverable from canonical plus managed Git refs. Before any later target-only accepted commit, stopped rollback may restore the backup ref and old Build. Afterward, only target-compatible current-history restore or forward repair is valid.

### Pack, Domain, context, and continuity transformations

SK4 maps `.codewiki/check-packs/<stage>/<pack>/<check>/` to `.codewiki/check-packs/<pack>/<stage>/<check>/` after portable case-fold collision checks. Installed Check identity and bytes remain exact. Existing Pack Skills stay only in the verified backup and historical Run Evidence unless the operator separately installs equivalent external producer guidance; migration cannot grant that capability automatically. Absence of activation conditions remains active-for-declared-stage behavior. Automatic defaults stop, but installed editable Checks are not deleted.

The SK2 authority-separation report must map every old Domain contribution either to fixed Kernel validation, universal Wiki Item schema, project configuration, or the explicitly bounded compatibility component above; any unmapped authority blocks SK2. From SK2 onward, new Candidate, Gate-package, configuration, Runtime Build, and Kernel Build records omit Domain identity, and Run records add no direct Domain field. SK4 then proves that every compatibility contribution has moved to fixed Kernel Validation, an explicit Check, project configuration, an admitted CodeWiki Plugin, or a release-managed DSH Plugin before deleting the component and residual Domain behavior. Historical Domain-bound records remain readable but inactive.

SK5 imports no ambient files into Raw Data. Each source enters through an authorized `source.observe` Plugin Request/Receipt and immutable Revision; ongoing connection state remains with the external implementation. Project Context Snapshot v1 artifacts become expired read-only evidence. Target WorkState, Alignment graph `6.0.0`, and Run Context Bundles rebuild or rematerialize from exact current owners. Rollback discards derived caches/bundles and restores private source/custody heads from backup.

SK6 verifies the last valid Session Continuity v1 journal, terminal Run Receipt, canonical Git head/fixed-path Trace blobs, Build, and retained opaque DSH digest set. It creates Work Continuity `1.0.0` with a new physical Session generation from canonical rehydration. V1 Sessions remain evidence-only and cannot resume. If the last Run lacks unambiguous terminal closure, migration may record a stopped recovery Receipt only after exact Ledger, raw-log, Session-head, and quiescence evidence is recovered. Otherwise it enters `recovery_stopped` and blocks until exact evidence repair; operator authority cannot waive closure or guess completion.

### Common transaction template

Every persisted cut follows one template:

1. stop Project Server and prove process-tree quiescence;
2. bind repository ID/object format, canonical commit/ref, private-state generation, current Build, and migration implementation;
3. create and verify immutable backup tag/ref plus complete Project Server-private and Runtime-private backup without rolling back append-only audit;
4. generate target files and Git objects under an unreachable temporary ref/tree;
5. verify identity/path maps, Item/reference/retirement closure, canonical bytes, target replay, protocol closure, and collisions;
6. durably record migration intent, expected canonical commit, private-state head, and recovery action;
7. create the exact migration commit/Receipt and atomically advance canonical ref plus active managed Change refs with expected-old-OID checks while stopped;
8. replay and compare canonical/managed Git refs, Wiki/Trace blobs, WorkState, private state, and Build identities;
9. activate target Build/private generation and record completion;
10. retain backup ref and old bytes read-only until governed deletion.

Before ref activation, failure removes staging refs and leaves canonical ref untouched. Recovery after activation recognizes the exact Git commit or restores the backup only when rollback rules permit. A `target-only canonical operation` is the first later accepted Change/work/protected-effect commit or Receipt that source protocols cannot represent; migration/Build/recovery/rollback audit records do not count. Before it, stopped restore may return canonical ref and old Build to exact backup because accepted history is equivalent. After it, only target-compatible backup containing current accepted Git/Trace history or forward repair may become current. Old binaries MUST refuse target protocols. Remote publication, external Delivery, and append-only audit are reconciled, never rolled backward.

## Exact retained architecture evidence

The SK0 conclusions above were checked against these exact sources:

| Source | Exact identity | SHA-256 or integrity | Accepted conclusion |
| --- | --- | --- | --- |
| [`node_modules/@deepseek-ai/dsh-session/README.md`](node_modules/@deepseek-ai/dsh-session/README.md) | `@deepseek-ai/dsh-session@0.1.1-rc.2` | `b5f411d00e2a43f8f4476270502a98139a0eec621b2de0a6a3f1c160bcaeaff6` | Session log is DSH source of truth; model surface is derived; replacement invalidates cache from first shadowed message |
| [`node_modules/@deepseek-ai/dsh-compaction/README.md`](node_modules/@deepseek-ai/dsh-compaction/README.md) | `@deepseek-ai/dsh-compaction@0.1.1-rc.2` | `735682bc5a7175bb324f9e382930358ef73bbd9dc317a62174f5353c9a0c65f4` | DSH owns compaction transaction, surface replacement, raw-history retention, and lock semantics |
| [`node_modules/@deepseek-ai/dsh-compaction-basic/README.md`](node_modules/@deepseek-ai/dsh-compaction-basic/README.md) | `@deepseek-ai/dsh-compaction-basic@0.1.1-rc.2` | `b5320d10dc4097f2f2274c7d2d7ea95848a727e59d6b93219f875edb6f6a5170` | Summarization is an auxiliary provider call; exact cache and token effects require measurement |
| [`node_modules/@deepseek-ai/dsh-agent/README.md`](node_modules/@deepseek-ai/dsh-agent/README.md) | `@deepseek-ai/dsh-agent@0.1.1-rc.2` | `20b88d9f41abe515b2da6f18a264a21337efed7cd7a348f37e9fd20c6fba926d` | DSH factory exclusively owns create/resume mechanics and process-local Agent lifecycle |
| [`package-lock.json`](package-lock.json) | repository checkpoint | `7063cd05415a695500de51ab5704b93429ef63b4e318074b2519236aba43a554` | exact executable package closure remains distinct from reviewed upstream source |
| [Microsoft MXC README](https://github.com/microsoft/mxc/blob/b497fd48653e01c846c6ef225e0af1c859b70122/README.md) | commit `b497fd48653e01c846c6ef225e0af1c859b70122` | `7e7f508e7f2d3c5a77fe6f31ed06cfeeb9593ba294d8e1c84bc904fd6f6e672e` | MXC is a policy abstraction with platform- and backend-specific guarantees, not automatic equivalence |
| [MXC Windows support matrix](https://github.com/microsoft/mxc/blob/b497fd48653e01c846c6ef225e0af1c859b70122/docs/process-container/os-version-support.md) | same commit | `bb0412017744e947c303a23af9b5e590ba7112d978c291837bdf842beffd143d` | Windows tiers and fallbacks vary by exact build and policy; CodeWiki must qualify an exact profile |
| [MXC schema](https://github.com/microsoft/mxc/blob/b497fd48653e01c846c6ef225e0af1c859b70122/docs/schema.md) | same commit | `bfb64a5b75df2bab32fdcd96001e7138dd6f14515fbb5dbe0673960ceb2c3fa0` | versioned configuration and fallback controls still require adversarial host proof |
| [AIOS README](https://github.com/agiresearch/AIOS/blob/292d98f78c835499df18cdb6de6325bba1895862/README.md) | commit `292d98f78c835499df18cdb6de6325bba1895862` | `b830a4338058247c5739e035e67e419793a5275d8d6c84dd3a12f52883d02c5a` | AIOS supports application/kernel separation as research precedent but overlaps DSH and is not adopted |
| [AIOS paper](https://arxiv.org/html/2403.16971v5) | arXiv `2403.16971v5` | versioned source | scheduling, context, memory, storage, tool, and access management are conceptual evidence, not CodeWiki authority or qualification |
| [Linux Landlock documentation](https://github.com/torvalds/linux/blob/v6.6/Documentation/userspace-api/landlock.rst) | Linux `v6.6` tag, commit `ffc253263a1375a65fa6c9f62a893e9767fbebfa` | `ae68d850cf5f51b42d1c314a74e12a28ff1f77edff5e653731f7a100e8f7b64a` | Landlock only adds scoped restrictions and has ABI/coverage limits; it cannot alone realize Execution Host guarantees |

Installed package and lock hashes were rechecked locally. External raw bytes were re-fetched from the immutable commits or tag and reproduced every listed hash. Moving `main` pages are navigation only. MXC remains a watch candidate, AIOS remains research input, and Linux/Windows primitives remain separately qualified mechanisms.

## External N-governs-N+1 checkpoint

SK0 cannot self-approve. After local review, the documentation candidate must be committed as one bounded N+1 checkpoint whose governance packet binds baseline and candidate commits, complete changed-file and diff digests, this contract-ledger digest, retained-source hashes, ambiguity resolutions, test and diagnostics Receipts, and an explicit declaration that no `src/**`, protocol bytes, canonical root, Plugin closure, or support claim changed.

A released CodeWiki controller N installed outside this checkout in a disposable project governs that exact commit and packet under protected-head policy. N records Decision, required Checks, Gate, confirmation, and immutable outcome Evidence without loading N+1 as this repository's Pi extension or writing dogfood state here. Only a passing external Receipt permits SK1 to start from the reviewed commit. Rejection amends documentation in another bounded candidate; it does not silently waive a gate. The external project and credentials are cleaned after Evidence retention, while this repository retains only reviewed source and Git checkpoint evidence.

## SK0 exit gate

Architecture work is ready for review when:

- every transformation row maps to files, protocols, persisted identity, migration, rollback, tests, and release gates;
- every contract family above has one authority, canonical form, state machine, failure rule, and first executable slice;
- all universal scenarios are representable without a hidden lifecycle branch;
- no open decision can change an SK1 schema or golden fixture;
- canonical KB components agree with this freeze while clearly identifying Backend v1 as executable truth;
- Knowledge/bootstrap, readiness, source-architecture, LSP, Pi-Lens, and diff checks pass;
- released controller N governs and qualifies the architecture checkpoint for N+1.

Empirical choices that cannot change SK1 contracts remain later qualification questions: whether the continuity hypothesis passes G7, whether SK6 needs a native Linux supervisor, and which exact Windows host can pass SK7. Failure of those experiments selects another implementation behind the frozen boundary; it does not reopen Kernel authority.
