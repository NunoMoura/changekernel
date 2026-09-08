# Semantic Kernel Refactoring Plan — Active Ledger

## Workspace reconciliation and baseline audit — current entry point

The maintainer authorized consolidation to one active source checkout before the deeper cleanup audit. The working baseline is `7fe04257d2a18d5d16130c45f5919e49bb84f92d`, observed on both GitHub and local `bootstrap/semantic-kernel`, now inspected through local branch `audit/clean-baseline`. Selecting it for audit is not acceptance of every inherited design, proof of its release claims, or controller activation.

### Reconciled source inventory

- GitHub `main` was observed at `c4331500bb977e4ffa17e520e41908c6da054929`; local `main` remains `5b6460dca1e69019498997cab9b7747ee147bde8`, 68 commits ahead. The selected bootstrap branch is another 15 commits ahead. Neither `main` nor remote refs were moved by consolidation.
- The earlier documentation effort used the older local `main` and missed the newer bootstrap branch. Its three commits and latest mechanics-only Check proposal are preserved at `94fabb5c5da7ef77f1a432e6bc8c8e27abde6f30` on `proposal/continuity-dogfood` in this same repository. They are proposal/donor evidence, not a second active roadmap or an already admitted replacement for this tree. Reconcile meaning explicitly; do not cherry-pick whole files over newer ownership or source contracts.
- Five working-tree snapshots, original Git metadata, refs, staged/unstaged patches, and ignored files were backed up outside project Git. Restore checks covered exact bytes, permission modes, symlinks, ref identities, and Git object connectivity. Active Pi dependency/cache directories were retained in place rather than deleted. Backup index: `~/.local/state/codewiki/workspace-reconciliation-GRyZ3sD2/inventory.json`; archive digests: its `SHA256SUMS`.
- Three clean linked worktrees and the imported amendment clone were removed only after recovery verification. The old dirty overlay is retained in a private cold archive, not another active source checkout. Four pre-existing `outputs/` documents remain unchanged in place. Release, qualification, activation, and private runtime state were not deleted.
- Historical amendment logs/artifacts moved to `~/.local/state/codewiki/evidence/historical-amendment-94fabb5c/`; the relocation mapping is in the backup's `reconciliation-actions.json`. Original paths inside historical evidence are provenance, not instructions to recreate source copies.

### Audit queue before further feature work

- [x] Compare live remote refs with local branches and working copies; preserve unique work, restore-test backups, and consolidate to one active source checkout and one GitHub remote.
- [x] Index and classify all 232 tracked paths in the selected implementation, including Wiki, tests, package/bootstrap/lock resources, scripts, and governing documents. Audit pass 2 records a complete disposition map, not proof that every implementation is correct.
- [ ] Close the retained contracts through the acceptance matrix below. A passing test that enforces obsolete policy does not justify retaining that policy; replay and injected-runner tests do not close operational requirements.
- [ ] Verify the exact `b97a03fcdc54d3ebd966011f429679a14a5fe948` release evidence and the handoff claims recorded by `a37a22f63`; distinguish their scope from later `7fe04257` bytes. Reconcile the old-controller wording and checked handoff items below. No historical claim is silently erased, extended to changed bytes, or converted into current execution authority.
- [ ] Resolve the explicit discrepancy between the target-tree disposition, which says every composition has an unavailable Check Runner, and the checked SK3G Code Check sandbox qualification item. Separate framework/test-adapter evidence from operational custom-Check execution required by the first failed-Check/repair dogfood proof.
- [ ] Reconcile the maintainer-directed native pre-dogfood protocol, required guidance sunset/rewrite, mechanics-only Checks, flat Wiki target, continuity/query ownership, and bounded product direction from the proposal branch against this newer tree. Remove the applicability of obsolete internal rubrics through the explicit governing policy revision, not by asserting that installed packs govern the audit or that absent runtime execution has passed.
- [ ] Produce one retained baseline and ordered cleanup/implementation queue here, with a requirement-to-implementation-to-test-to-external-evidence matrix for the bounded dogfood outcome. Include deterministic safety, real custom Check failure/repair, recovery, fresh-Agent continuation, supported environment, and measurable efficiency budgets. Do not restore removed optional breadth merely because historical checklists mention it.
- [ ] After review and applicable authority, reconcile the selected baseline into canonical local/remote `main` without a blind reset, force-push, or loss of unique work. Until then, use the explicitly named audit branch and keep canonical refs unchanged.

This section records workspace operations and audit work only. It creates no semantic admission, Check Result, qualification receipt, release activation, or controller promotion. Later historical/status sections remain evidence to reconcile, not a claim that this audit has already passed.

### Audit pass 1 — implementation versus operational evidence

Scope: runtime source at `7fe04257d2a18d5d16130c45f5919e49bb84f92d` (unchanged by the workspace-only `ae6a4dc02ad6dcfb10e05cd0ea009e137acee09f` checkpoint), current tests/package, and the named SK3G release/handoff records. This is a partial audit, not closure of the inventory or a new qualification. No source, Check policy, Trace, release artifact, or controller state was changed during this pass.

Fresh native evidence: locked dependencies installed with lifecycle scripts disabled; Node `24.14.0`; typecheck/build and all **251 tests passed**, with zero failures/skips and approximately 99 seconds reported test duration. Production dependency audit reported zero vulnerabilities. Primary source LSP scanned 60 files and reported one unnecessary-`await` hint in `local-server.ts`, not a type error. The old pi-lens review graph identifies commit `927e21f8` and is unusable for this baseline; it was not used as current dependency or dead-code evidence. A fresh, explicitly limited static runtime-import analysis reaches 52 of 60 source files from `src/index.ts`; its eight remaining files are candidates for classification, not automatic deletion.

Raw logs, structural inventory, counterexample output, and checksum observations are outside Git at `~/.local/state/codewiki/evidence/baseline-audit-XWCdVJ40/`. Private JSON artifacts were parsed normally; JSON LSP analysis was unavailable and is not claimed clean.

| ID | Evidence and finding | Disposition / required closure |
| --- | --- | --- |
| AUDIT-01 | `src/ports/check-runner.ts` defines a port; there is no `src/adapters/checks/`. `createLocalProjectServer` binds unavailable Check and Agent executors. Lifecycle tests inject `passingCheckRunner()` and an Agent Runtime that must not be invoked. | **Operational dogfood blocker.** Retain useful contracts/reducers, but do not call mocked lifecycle coverage real Check/Agent execution. Build and independently validate at least the explicitly declared custom-Check execution profile and its Project Server composition. |
| AUDIT-02 | Thirteen concrete project Check definitions and nine packaged copies remain. In addition, `fixedRegistrations` in `src/server/commands/gates.ts` manufactures two mandatory Decision model Checks. `decodeLock` rejects an empty stage, while the pure selector can represent an empty active set. | **Remove under the reconciled mechanics-only scope.** Cut assets, package/Product bindings, bootstrap seeding, fixed registration code, empty-policy rejection, and obsolete test expectations coherently. Retain deterministic validation and explicitly adopted custom policy; do not merely delete directories and leave broken bindings. |
| AUDIT-03 | `session-runner.ts` rejects every authorization with nonempty `toolIds`. The supplied local DSH host is in-process, keeps tracking only in a Map, always starts with `resume: false`, and `closeRun` writes all four custody-closure booleans as `true`. Session disposal is implemented, but this is not independent descendant/resource custody observation. | **Worker/recovery qualification blocker.** Preserve bounded DSH integration as a partial mechanism. Provide the declared tool/host bindings, durable recovery, deadline/resource enforcement, and evidenced quiescence before claiming an operational coding Worker or process containment. No inference from replay-provider tests to live tool or sandbox safety. |
| AUDIT-04 | `src/adapters/preview/local.ts` has no default process runner. Its injected runner receives neither the exact subject nor an explicit workspace binding. An audit fixture returned 1,024 output bytes despite a four-byte profile bound; the adapter accepted them. Generation 1 was accepted after generation 2 and its observation was Gate-eligible. `createPreviewSubject` puts generation into the lease identity, and completed leases are deleted, defeating the advertised cross-generation rejection. | **Reproduced safety/claim gap.** The probe launched no process and called no model. Fix or explicitly exclude unsupported Preview execution from the supported profile; do not present callback-envelope tests as process, exact-workspace, output-limit, or stale-generation qualification. |
| AUDIT-05 | `src/adapters/git/handoff-converter.ts` is still shipped and hardcodes predecessor/version plus this repository's Change/requirement identities. It accepts a project root rather than an exact frozen-input/CAS manifest; removes residue before a final direct lock write; preserves predecessor Trace bytes; and returns a genesis mapping without writing target genesis Trace state. Its rewritten lock is built from fixed Product resources rather than preserved custom policy. | **Do not use as a proven transactional handoff.** Audit outer orchestration and actual converted state separately. Remove it from normal product shipping; retain a separately qualified offline converter only if an explicitly supported predecessor still requires it. Historical artifacts remain byte-preserved. |
| AUDIT-06 | `createMemoryProjectServerFacts` and the public local composition provide process-local Gate storage. The local DSH host likewise has no persisted tracking reload. | **Fresh-process continuation gap.** Same-process idempotence and derived Views do not prove recovery of in-flight work, Results, or effects after restart. Specify the owner and durable storage boundary without introducing another semantic truth store. |
| AUDIT-07 | The retained `b97a03f...` tarball matches its recorded SHA-256. `release.txt` points to an engineering-checkpoint receipt explicitly stating `releaseCandidate: false`, `packageActivated: false`, and `controllerPromoted: false`. Separate later qualification/handoff reports and `AUTHORIZATION_CONSUMED.txt` do exist, but their summaries do not establish the exact protected-input manifest, authenticated authorization bytes, independent executions, or current running-controller custody. | **Evidence linkage remains unresolved, not declared absent or fraudulent.** Preserve all records and verify the referenced conversion/authorization/effect chain before using the handoff as current authority. The supplied backup checksum file verifies its payload entries but also includes its own checksum, which fails; distinguish that manifest defect from payload corruption. |
| AUDIT-08 | Current runtime/package differs from `b97a03f...` in six files (659 insertions, two deletions), while still naming package version `0.4.0-sk3g.1`. Existing release evidence covers only its exact archived subject. | **Identity boundary.** Ordinary mutable development need not release every commit, but the next intentionally frozen artifact needs its own version/manifest and exact qualification. Do not transfer the old receipt to current Console/API bytes. |
| AUDIT-09 | `createLocalProjectServer` calls bootstrap on a read-first path, thereby installing passive policy into an uninitialized project. It also supplies the Product policy digest as `kernelBuildDigest`. | **Composition review.** Separate explicit initialization from ordinary reads and bind actual Product/Kernel identity semantics. Check repository/config identity and canonical-ref selection before treating this convenience composition as the production service. |
| AUDIT-10 | The Preview test named “rejects unknown profile and stale generation” asserts only unknown-profile rejection. Other reviewed execution tests use replay providers or injected runners. The current plan both defers the Check adapter until post-stable demand and marks sandbox qualification complete. | **Test and ledger cleanup.** Keep useful fixture tests, relabel their scope, add the missing counterexamples, and stop counting test names/checkmarks as coverage. A required custom-Check dogfood proof cannot depend on a subsystem deferred until after that milestone. |
| AUDIT-11 | All five current `.codewiki/changes/*.jsonl` headers identify Trace `13.0.0`. A fresh pure-decoder probe against the target Trace `14.0.0` decoder rejects every header with `missing_field` at `$.headerDigest`. The reviewed converter preserves those bytes rather than producing compatible current Trace state. | **Reproduced repository-state incompatibility.** This source repository cannot be presumed ready for target normal lifecycle reads. Preserve historical bytes; require an exact, authorized current-state transition with replay/continuation proof rather than adding a legacy fallback or fabricating genesis facts. This does not disprove a handoff on some other external project; the report must identify and prove its actual scope. |

A subsequent bounded project-wide diagnostic pass refreshed jscpd, knip, gitleaks, madge, and structural/security runners. Its aggregate reported 551 warnings, mixing current findings with stale call-graph notices for deleted `src/project-server/**` files and false positives such as a React rule on pure SHA-256 code and `unknown`/`typeof` warnings inside actual decoders. This is not a clean result or a list of 551 verified defects. Triage current coupling/duplication/unused-surface findings against exact paths and intended contracts; do not restore deleted callers or weaken input decoders to satisfy heuristics. Trivy was not enabled, and this pass does not establish comprehensive vulnerability or dead-code closure.

Provisional retained floor: pure canonical/identity/contract mechanisms, native Wiki handling, lifecycle/Gate reducers, bounded Git/store and API mechanisms, and useful deterministic tests. Passing tests provide bounded evidence, not blanket proof. DSH/Preview adapters require repair or narrowed availability; historical converter/default-rubric policy has no automatic claim to retention. The remaining 232-file inventory (60 source, 56 tests/fixtures, 47 Wiki, 44 concrete Check resource files, 25 other files) is not yet individually closed.

Ordered next work, still subject to explicit governing scope rather than inherited Check enforcement:

1. Finish the evidence/authority and retained-contract audit; reconcile the proposal branch against newer native ownership and source, not whole-file transplantation.
2. Establish the native pre-dogfood protocol and precise support/acceptance matrix, including guidance sunset, user-authored Checks, exact truth boundaries, and no optional-feature expansion.
3. Remove obsolete policy/converter shipping and coupled bindings; replace tests that enforce those defaults with empty/custom-policy and negative mechanics tests.
4. Complete actual Check/Worker execution and durable recovery for the declared profile; repair or exclude unsafe Preview capability, with failure/cancellation/hostile-input evidence.
5. Measure real workflow latency, tokens/cost, repeated effects, and interventions. The 99-second test run is not an Agent-workflow benchmark. Set explicit budgets before declaring efficiency closure.
6. Freeze one coherent candidate, independently qualify exact bytes and the real failed-Check/repair/fresh-Agent scenario, then perform only the explicitly authorized handoff and canonical-main reconciliation.

### Audit pass 2 — retained-contract map and reconciled cleanup proposal

Subject: `8dab88411aa6abe26013d1a5b5f58e42e4b933e4`, with runtime/source selection still `7fe04257d2a18d5d16130c45f5919e49bb84f92d`. The complete private inventory is `~/.local/state/codewiki/evidence/baseline-audit-pass2-rxDlS1SV/inventory.json`, reproduced by its adjacent read-only `inventory.mjs`. Every tracked path has a byte digest, explicit disposition, reason, and applicable native ownership. This closes structural inventory coverage, not semantic admission, per-function verification, or operational qualification. No source, policy resource, Wiki envelope, Trace, package, or controller state changed in this pass.

The retained baseline remains the selected newer tree plus native documentation checkpoints; do not reset to either older `main`. Retain mechanisms justified by the contracts below, not all inherited bytes. The inventory assigns 44 concrete Check resource files to proposed removal, three old root plans to byte-preserved archival, the converter and its fixture to removal from normal shipping, and the unconsumed internal Kernel barrel to proposed deletion. Other code/tests are assigned bounded retention, repair, wiring, or policy-coupled revision. Historical Traces and the existing project config/lock require explicit transition disposition, not opportunistic deletion. The 47 Wiki Items retain stable identities and newer native ownership.

Fresh findings and corrections:

| ID | Evidence | Required disposition |
| --- | --- | --- |
| AUDIT-12 | Native ownership resolves every existing production path covered by the architecture test, but `bin/codewiki.mjs` has no owner and is omitted from that test's production-path enumeration. | Add the shipped CLI to the ownership/architecture contract and its regression coverage. Do not assume a green allowlist test covers unenumerated entry points. |
| AUDIT-13 | LSP confirms `readExactWiki` is called by `src/server/queries/source.ts`. The current import graph also has Server-to-Git-adapter edges from lifecycle and Wiki queries. These helpers consume `ProjectStorePort`, but their adapter placement violates the declared port-only Server dependency boundary. | Retain the exact-read mechanics; move orchestration to its proper owner rather than adding compatibility forwarding layers. Make the dependency rule cover Server as well as Kernel and Client. The local composition's reverse adapter-to-Server import is a composition responsibility, not evidence that all directions are allowed. |
| AUDIT-14 | `deriveWorkState` and Product/Kernel Build decoders are tested but absent from the public runtime closure. `readWork` projects reduced Trace work directly, without invoking the fact-aware WorkState projection; capabilities are partially hardcoded. The local composition substitutes Product policy digest for Kernel Build identity. | Wire or explicitly narrow these surfaces. Do not delete required fact/identity mechanisms as dead code, equate a Trace-only work list with full readiness, or advertise injected execution bindings without accurate availability. |
| AUDIT-15 | `bin/codewiki.mjs` composes the Server before validating the verb or required arguments. Root parsing recognizes slash-containing paths or `.`, but not an ordinary bare relative directory. Its invalid-state advice offers re-bootstrap without an exact conversion procedure. Combined with automatic bootstrap, malformed reads can reach initialization before rejection. | Parse strictly before effects; separate explicit initialization from reads; preserve project state on help, invalid commands, and degraded reads. Remove re-bootstrap as generic recovery advice. This is a source-path finding, not a new process execution or migration. |
| AUDIT-16 | The proposal branch differs from current Wiki in 23 bodies and 11 envelopes; the latter include newer native ownership/event bindings. | Reconcile meaning body-by-body and make separately justified native metadata edits. A whole-file cherry-pick would discard newer contract information. Legacy provenance is not a reason to restore retired code or to erase accepted history. |

The apparent test-selection gap was checked and **not confirmed**: `test:smoke` selects 42 test files directly, and the architecture suite imports the other 12. All 54 tracked `.test.mjs` files are reachable. Keep this distinction from the real assertion-quality gaps in AUDIT-10. A fresh focused run of canonical/lifecycle/Gate/Work invariants, Git store, project queries, and authorization passed **71 tests**, zero failures/skips, in approximately 2.4 seconds on Node `24.14.0`. Primary LSP checked all 60 source files with no errors. These are local test/structural observations, not executed semantic Checks or handoff evidence.

Historical evidence reconciliation is bounded: `a37a22f63` changes this plan only; it does not itself record a project-state conversion. The private qualification/handoff reports and consumed-authorization marker exist, and the archived package checksum matches, but they do not identify a complete independently replayable effect chain for this repository. The backup registry contains multiple projects. Neither those summaries nor finding the same Trace bytes proves a handoff on every project, or disproves an external handoff on a different scope. Current controller authority and this repository's Trace 13-to-14 transition remain unresolved release/handoff blockers, not reasons to execute inherited rubrics during the native audit.

### R1 — approved native cleanup and bounded dogfood scope

**Status: maintainer-approved for native source development.** The maintainer explicitly directed: “data contracts is a better name let's change that and proceed with or R1 cleanup proposal.” This approves R1 and the `data-contracts/` naming amendment against the audited newer tree. It does not constitute a governed Change admission, Gate, authorization receipt, controller activation, or live migration. Historical SK3A–SK3H records remain intact; inherited internal rubrics do not govern this native development revision.

R1 now governs the bounded native development workflow and queue, replacing conflicting predecessor per-checkpoint/activation instructions for this work only. Protected effects and external exact-subject qualification retain their explicit safeguards. Approval covers ordinary implementation, diagnostics, tests, and checkpoints without repeated permission requests. The approved scope is:

1. **Retain the product and invariant floor.** CodeWiki is Git-compatible version control for humans and Agents: stock Git owns exact artifacts/history, Wiki owns accepted desired meaning, append-only Change facts own semantic lifecycle, a pure Kernel validates/reduces, and Project Server owns authorization and orchestration over narrow effect ports. Keep native ownership, stable IDs, explicit `containing_commit`, full-snapshot Review/Completion subjects, expected-old-OID CAS, fail-closed missing evidence, and independently evidenced quiescence/recovery. Retention is by invariant, not by predecessor module names or test counts.
2. **Ship Check mechanics, not internal judgments.** Remove packaged software defaults, project-internal rubrics/copies, Product/manifest/bootstrap/lock bindings, and both manufactured mandatory Decision Checks in a coordinated change. Preserve custom definition/adoption/selection/execution, code/model boundaries, exact inputs, immutable Results, negative validation, and ordinary automated tests. Complete empty policy may yield a warned empty Gate; unresolved policy, unavailable required execution, malformed output, or missing inputs stops. No semantic rubric becomes mandatory because it shipped historically or because a model can execute it.
3. **Retain the four domain-neutral stages and two realization routes.** Decision accepts meaning, Planning binds realization work, Implementation produces and validates artifacts, and Review judges the reconciled whole outcome. Wiki-only completion remains distinct from project realization. A repair within admitted Work does not automatically need another Change; changed intent or scope does. Humans, services, and Agents may propose under explicit identity/capability; proposal grants no acceptance, execution, or publication authority.
4. **Make durable continuation a product contract.** Required task facts belong to Wiki, Trace/Work, Git, Results/Evidence, or private live-operation state according to ownership. CodeWiki supplies exact authorized semantic queries, provenance, relationships, bounded Views, and explicit missing/redacted/truncated context. A harness owns prompt packing and in-run compaction, not semantic authority. Fresh-Agent continuation must work without importing conversation or inferring success from missing records.
5. **Separate target layout from live migration.** The target Wiki layout is `.codewiki/wiki/**` without a redundant `items/` segment. Preserve IDs and newer native ownership, exact predecessor mappings, collision rejection, and recovery. Change readers/writers/tests together with a single supported target layout. Existing accepted state, including all five historical Traces, is preserved until an exact separately authorized transition; no dual read/write, auto-migration, or opportunistic genesis reconstruction. Move the three historical root plans to `docs/archive/` byte-for-byte with provenance; this file stays the only active queue.
6. **Use one bounded execution profile for initial dogfood.** Propose Linux, Node `24.14.0`, pinned Git/DSH/dependency/package closure, one local Project Server, one physically enforced Code Check sandbox profile, and one scoped coding-Worker route. Prove a user-authored Check failing, repair, re-evaluation, reviewed completion, restart, and a fresh Agent. A repository-level test fixture is not a shipped project default. Model Check contracts remain, but live model-Check support requires its own declared executor/quality evidence; it is not an automatic admission rubric. Preview, richer App/Omarchy/IDE surfaces, global Git replacement, extra execution hosts, and refinement/Hashline are outside this initial profile. Unsafe excluded adapters must not remain advertised as qualified capabilities.
7. **Keep a cheap native development path with an explicit sunset.** Pi-native analysis, edits, tests, and reviewed Git checkpoints proceed within this single scope; no new Change, release, activation, prospective-OID permission, or controller swap per checkpoint. Resolve inherited controller authority before relying on it for qualification. Prepare and review replacement `AGENTS.md` within the exact handoff candidate, before qualification; it takes effect before the first task governed by the activated release. This sunsets temporary bootstrap procedure only. It does not expire truth/safety rules or higher-priority restrictions against loading CodeWiki from this checkout.
8. **Keep protected decisions explicit.** No push, canonical-main movement, live policy/state conversion, credential use, paid model call, publication, or controller handoff is implied by native cleanup approval. Qualification remains independent and exact-subject; intentionally frozen changed artifacts receive unique identities and fresh evidence. Promotion needs verified backup, stopped effects, exact scope, and explicit authority. Missing predecessor authority must be resolved, not invented or worked around by treating the candidate as its own controller.

### R1 acceptance matrix — requirements, current support, and closure

Evidence labels: **local** means observed source or ordinary tests on the named source; **reproduced gap** means a concrete local counterexample; **external pending** means the operational proof is absent or its exact linkage remains unresolved. None of these labels means semantic admission. All rows must be resolved for the declared profile before a dogfood-ready claim; optional features may be explicitly excluded rather than silently counted complete.

| Requirement / owner | Current implementation and ordinary tests | Required acceptance evidence |
| --- | --- | --- |
| Pure, bounded deterministic Kernel | `src/kernel/{data-contracts,identity,changes,gates,work,wiki,evidence}/`; matching kernel tests, including the 12 transitive suites. **Local.** | Preserve canonical/digest/replay properties and hostile-input limits; mutation/state-machine tests must reject altered authority branches. Extend architectural guards to all shipped entry points and intended layer directions. |
| Exact Git effects and whole-outcome Review/Completion | `src/adapters/git/project-store.ts`, `src/server/commands/{repository,lifecycle}.ts`; Git store, lifecycle, two-parent snapshot tests. **Local with doubles for execution.** | Independent stale canonical/Change head, concurrent CAS, cancellation, replay, and crash tests; zero partial ref transactions or unreviewed artifact changes. Preserve `containing_commit` semantics and exact reviewed artifact tree. |
| Mechanics-only custom Checks | Kernel selection/reducer and Check Runner port exist; concrete/fixed policy is removed, explicit custom/empty policy is tested, and the shipped Runner remains unavailable. **Local mechanics; operational gap.** | Empty versus unresolved policy tests; explicit custom adoption/edit/removal; package/bootstrap free of seeded rubrics. Real sandbox execution on exact declared inputs, pass/fail/malformed/unavailable/timeout/cancel cases, zero forged Results, and stopped operational failures. |
| Scoped coding Worker and custody | DSH adapters, replay provider, authorization/receipt/containment validation tests. Tool-enabled execution and observed custody are missing. **Gap.** | External packed runtime executes only authorized tools/paths; attempts at protected refs, credentials, network, undeclared files, or surviving descendants fail. Receipt validation must not replace physical enforcement. |
| Durable recovery and idempotence | Memory facts/host tracking and Git lifecycle replay are partial mechanisms. **Gap.** | Restart after authorization, launch, Check completion, fact persistence, and CAS; reload exact canonical facts and private custody without duplicate effects. Lost/contradictory evidence stops; quiescence permits safe retry, not invented completion. |
| Fact-aware reads and fresh-Agent continuation | Exact Wiki reads/Views and bounded API queries exist; WorkState/build identities are disconnected and full mandatory-context workflow is unproven. **Gap.** | Independent Agent reconstructs target, rationale, current Work, failed Check, exact source, blockers, and next permitted action from durable authorized records only. Truncation/redaction/missing required context must be explicit and cannot authorize advancement. |
| Read-only CLI and honest capabilities | Console/API tests exist; AUDIT-09/12/14/15 remain. **Gap.** | Help/invalid/unknown/missing-argument/bare-relative-root/degraded reads produce no project writes. Explicit initialization is separate. Capability output reflects actual bound and qualified support rather than broad role grants or hardcoded optimism. |
| Single Wiki layout and preserved history | Current readers use `wiki/items`; five current Trace headers fail target decoder. **Reproduced gap.** | Exact old/new Item mapping, unchanged identities/accepted facts, collisions and interruptions rejected, one target reader/writer layout, verified backup/recovery. Independently validate converted current state and continuation; no fallback or fabricated genesis/receipts. |
| Minimal public/package/dependency closure | 22 runtime and 65 type exports in `src/index.ts`; tests pin curated exports, purity, and package paths. **Local; post-release bytes differ.** | Reconcile approved exports, dependencies, bin ownership, policy-free resources, and internal non-exports. Two clean external builds of the frozen subject reproduce packed bytes; fresh isolated consumer uses only declared public support. No mutable/self controller or private-state inclusion. |
| Efficiency with bounded resource use | Approximately 99-second full test run and 2.4-second focused run are engineering measurements only. **Workflow budgets pending.** | Before operational workflow qualification, freeze corpus/host/profile plus numeric time, memory, output, token, cost, and retry caps. Report cold/warm p50/p95, at least 30 local-read samples, full failed-Check/repair duration, tokens/cost, and human interventions. Zero unauthorized writes, duplicate effects, false passes from missing evidence, or silent mandatory-context loss are hard acceptance criteria; do not claim workflow efficiency from test duration. |
| Independent handoff and real dogfood correction | Immutable old archive and historical reports exist; subject/authority/current-state chain remains unresolved. **External pending.** | Verify actual controller and protected-input identities, authorization, conversion/recovery and stopped-effects chain. Qualify one exact new candidate containing replacement guidance, explicitly activate its declared scope, then complete one real correction. Canonical reconciliation remains separately authorized. |

### R1 ordered work queue

These are development work items, not fresh admissions or renamed historical completions. Ordinary implementation maps to this approved queue instead of reviving old per-checkpoint activation clauses.

- [x] **R1-0 — Scope decision and protocol reconciliation.** The maintainer approved R1 for native development, including the naming amendment. This plan and AGENTS distinguish native source-work authority from pending semantic admission and live handoff. Historical receipts are not rewritten.
- [x] **R1-0a — Data-contract naming amendment.** Rename `src/kernel/canonical/` to `src/kernel/data-contracts/`, `json.ts` to `canonical-json.ts`, and `contract.ts` to `validation.ts`; move the corresponding tests and update imports, ownership, active architecture guidance, and build/test discovery. Keep `outcome.ts`, exported symbols, protocol IDs, validation behavior, and digest semantics unchanged. No compatibility forwarding files. All 60 source files were verified byte-identical to the audited base after only the declared import-path substitutions. Typecheck/build and all 251 native tests passed; source LSP reported no errors. Initial validation caught unsorted renamed allowlist entries; the entries were reordered without weakening the assertion, then the full suite passed.
- [x] **R1-1 — Coherent policy/document cleanup.** Reconcile 23 donor Wiki bodies, preserve 11 newer envelopes unless a separately reviewed native metadata edit is required, archive three historical plans, remove concrete Check assets and coupled Product/manifest/bootstrap/registration/test assumptions, and make empty/custom policy behavior explicit. Treat working-branch project-policy changes as proposed target bytes, not mutation of live controller policy. Do not delete the old lock by itself or regenerate accepted state implicitly.
- [ ] **R1-2 — Honest composition and query ownership.** Eliminate implicit initialization, fix CLI parsing/recovery/ownership, remove the redundant barrel and normal converter shipping, enforce layer directions, and bind real Build/fact-aware query identities. Keep useful mechanisms rather than wrapper compatibility shims.
- [ ] **R1-3 — Actual bounded Check/Worker execution.** Implement and qualify the declared sandbox/Worker bindings, with explicit custom input/output/limits, hostile cases, truthful custody, failure and repair. Exclude unsupported Preview from the profile or repair it before claiming support. Credentials and model budgets still need applicable authorization.
- [ ] **R1-4 — Durable recovery, continuation, and efficiency.** Persist/reload facts and custody at their rightful boundaries, test every effect cut point and idempotent retry, prove fresh-Agent continuation, and freeze/measure the numeric resource and efficiency budgets before qualification.
- [ ] **R1-5 — Exact state/layout transition and candidate qualification.** Resolve historical authority/input scope, prepare exact mapping and independently recoverable conversion, freeze the single-layout policy-free package plus replacement guidance, and obtain new external exact-subject evidence. No current-state conversion or promotion is implied by implementing/testing a converter.
- [ ] **R1-6 — Explicit handoff and canonical reconciliation.** Apply only separately authorized protected effects after quiescence and qualification; prove one real governed correction. Retain native recovery and all historical evidence. Do not automatically push, merge, or move `main` when a checklist turns green.

### R1 first implementation checkpoint

R1-0 and R1-0a are complete as native development work, not governed lifecycle completion. Evidence is outside Git at `~/.local/state/codewiki/evidence/r1-data-contracts-uUatzGap/`: exact source-equivalence record, initial/final test logs, and archive-preservation manifest. `r1-data-contracts-current-path` is a convenience pointer, not the evidence identity. R1-1 has begun: the three root plans now reside under `docs/archive/` with their original Git blob identities, and README qualification overclaims are corrected. Concrete Check assets, bootstrap/manifest bindings, fixed registrations, and their test expectations remain unchanged in this checkpoint; their coordinated removal is the next R1-1 source slice. The old project lock and five Trace files remain unchanged. No live migration, package freeze, controller activation, or canonical-ref movement occurred.

### R1-1 Check-policy removal slice — locally verified

This slice removes all 44 concrete Check resource files, package/Product resource declarations, bootstrap copying, and both manufactured Decision registrations. Fresh bootstrap writes an explicit empty Check Pack lock; the development branch's old lock is replaced by that proposed empty target policy together with resource removal, not deleted alone. Existing canonical refs, five historical Traces, releases, and live controller state are not changed.

The historical handoff converter and its fixture are brought forward from R1-2 because they regenerate the removed Product resources and would otherwise preserve a broken shipping dependency. Their deletion is not a replacement conversion or authorization to migrate anything. Preserve their exact history and external evidence.

Acceptance: explicit custom test policy replaces implicit fixture defaults; fully resolved empty Gates warn without invoking a Runner; missing/malformed locks, invalid stage resources, unregistered files, changed digests, empty locked packs, and unavailable selected execution fail closed. Removing optional policy must not weaken Kernel validation, CAS, authorization, or whole-outcome completion. Keep the generic Check contracts, custom authoring/adoption, and code/model executor port; operational executor qualification remains R1-3. Update coupled desired-state guidance without overwriting newer native envelopes.

Local evidence at `~/.local/state/codewiki/evidence/r1-check-policy-lzw1fujf/` covers this slice against ancestor `6fd451cf80e75388989091f95800df464aaba61e`. Typecheck/build and **264 tests passed**, zero failures/skips, approximately 163.9 seconds. The initial resumed run exposed stale resource-directory scans and a canonical null-prototype comparison in tests; expectations were corrected rather than restoring defaults. A subsequent ownership guard correction limits optional-directory handling to an absent root, not errors while walking adopted policy; **65 focused architecture/package tests passed** afterward. Primary LSP checked all 59 remaining source files without errors. Package dry-run inspection uses the fresh build, creates no release archive, and verifies no bundled Check resources, converter, source-checkout controller, or private project state in the file list. Private evidence JSON is parsed directly; unavailable JSON language analysis is not claimed clean.

Regression coverage includes fresh empty policy, explicit custom adoption/removal, evaluation and replay warnings, failed custom judgments, unavailable execution, missing required input despite an injected passing Runner, missing/malformed lock and definitions, invalid lock resources, unlocked definitions, changed valid definition bytes, packs without definitions, missing locked packs, stray stage files, and symbolic policy files. Empty Gates retain the existing Kernel `passed` outcome for successful invariant validation; command responses and their replay expose `empty_check_policy` and state that no semantic Check verdict was produced. No new Gate/Trace schema or historical Trace rewrite is introduced.

README and 11 Check-related Wiki bodies are reconciled surgically; all existing Wiki envelopes remain byte-identical. This does not close the other donor-body reconciliation in R1-1. The three archived plans, five Traces, project config, dependency lock, and original outputs remain preserved. Ordinary test fixtures explicitly adopt their own policy and use injected execution; these are not shipped defaults, semantic Results for this repository, or operational qualification. Missing-input coverage proves blocked advancement, not yet pre-execution refusal or Result-free operational failure; exact input/executor enforcement remains R1-3. Durable warning/read projection, honest composition, and fresh-process recovery remain R1-2/R1-4 work. No release freeze, migration, push, canonical-ref movement, model call, or activation occurred.

### R1-1 donor reconciliation — locally verified

Against development checkpoint `6d69ffde8534e9a2928a2134c653097d24f9411b`, all 23 differing donor bodies and 12 differing envelopes from `94fabb5c5da7ef77f1a432e6bc8c8e27abde6f30` have an explicit disposition. Twenty-one current Wiki bodies receive selected additions or targeted replacements. The two maintainer stories about standards and intent retain the stronger Check-policy text from the preceding checkpoint; their donor meaning is already represented. Alignment and WorkState have envelope-only differences, so their current bytes remain intact. Every current Wiki envelope remains byte-identical; no legacy or native ownership metadata is transplanted. The original audit counted 11 envelope differences; the approved `data-contracts/` rename adds the twelfth at Semantic Kernel. The preservation check caught the stale count, which is corrected here without changing the historical audit.

Reconciled meaning covers Git-compatible product positioning and scoped command contracts; project-first, authenticated clients; domain-neutral stages and realization routes; ordinary proposal and checkpoint boundaries; mandatory task context and safe conversation-independent continuation; exact host-profile and custody claims; prospective Check policy; and the flat Wiki target with exact one-shot conversion safeguards. The current executable layout and all existing files remain nested. README distinguishes that reality from the desired layout. This is documentation closure, not implementation or permission to move live state.

Donor regressions are explicitly rejected: stale bootstrap/template language and weaker empty-policy wording do not replace the locally tested policy contract; the newer `data-contracts/` explanation, canonical Item byte/encoding/tree/link bounds, unique package-version/archive identity, and protected-head qualification rules remain. Console keeps plain-language default navigation and explicit technical audit rather than exposing backend internals as its ordinary vocabulary. Its new compatibility requirements do not qualify a Git adapter. Omarchy, additional hosts, refinement, and hash-anchored editing remain optional breadth, not initial dogfood gates.

Evidence: `~/.local/state/codewiki/evidence/r1-wiki-reconciliation-oaopw1h1/` contains the exact donor/baseline inventory, selected-edit and final per-file dispositions, preservation verification, and focused test log. **101 architecture, Wiki, and query tests passed**, zero failures/skips, approximately 20.85 seconds. Explicit-file primary LSP checked all 21 changed Wiki documents without errors; the initial directory request did not expand Markdown and is not counted as evidence. Source, tests, package/config/lock bytes, three archived plans, five historical Traces, and four original outputs are unchanged. No new full-suite, executor, release, or activation qualification is claimed for this documentation checkpoint.

R1-1 is complete as approved native cleanup, including the prior archive and Check-policy slices. R1-2 is next: first separate explicit initialization from reads and validate CLI arguments before effects; then resolve remaining ownership/layering/Build/fact-aware query gaps. Converter removal was already completed in R1-1. R1-3 through R1-6 remain open, with the same protected-effect and external qualification requirements.

## Authority

This file is the sole active CodeWiki refactoring roadmap, status ledger, qualification record, and archive checklist. `.codewiki/wiki/**` is desired-state design truth. `src/**` and `tests/**` are executable truth. Git is history and checkpoint evidence. `README.md` is orientation only. Historical plans remain unchanged.

Wiki does not directly authorize source work. Every implementation change must map to an incomplete item below. Unscheduled gaps enter this ledger before source changes. Wiki records stable behavior; this plan alone records cutover mechanics, temporary gaps, sequencing, evidence, and deferrals.

No mutable checkout governs or qualifies itself. Native Pi, Git, deterministic checks, and human authority are bootstrap and recovery paths. After bootstrap, immutable externally installed Product N governs exact committed release candidate N+1. Candidate N+1 never enters Product N's module graph or qualification authority.

The current native bootstrap follows approved R1: reviewed Git checkpoints with scoped validation are not releases, admissions, completions, or activations. Historical SK3C–SK3F and SK3G controller claims below are retained records, not verified current runtime authority or new per-checkpoint permission requirements. Resolve the actual independent controller's authority before relying on it. Only an intentionally frozen release candidate receives external exact-subject qualification and an explicit activation decision; any controller handoff requires quiescence and no overlap. Replacement guidance belongs inside the exact qualified handoff subject, not a post-qualification rewrite.

Creating a commit or moving an unprotected development ref is not a lifecycle effect and needs no prospective-OID authorization. Every packed identity is nevertheless immutable: one package name/version maps to exactly one archive digest, source commit/tree, Product Build, and Kernel Build. A correction receives a new commit and, after release-candidate freeze, a new package version.

A checklist implementation item may be marked complete when its exact engineering checkpoint and CI receipt pass. Release, activation, handoff, and dogfood items additionally require their stated external qualification and human authority. Activation alone never implies controller promotion.

## Historical activated baseline — current authority unresolved

The following records describe the predecessor lineage; they do not establish current controller custody or override R1's native workflow. CodeWiki remains private pre-production software. The historical released controller N is unpublished private package `@nunomoura/codewiki@0.3.0`, source commit `adc272d0d9b8f228fc8cedb150c8c6371c823997`, package SHA-256 `63e926d638e0f74f0e785cf8ab6222bb45ee04abfb6e848501b29de99726489d`. Transitional checkpoint and release-candidate packages must use unique prerelease versions; `0.3.0` may never identify different bytes.

### Completed semantic releases

- **Backend v1, SK0, and SK1** — qualified historical foundations.
- **SK2** — governed KB-to-Wiki migration activated at `7b4e5e9021b27ff09f6f93569bb2a93c1fb0ebdf`; current semantic roots are `.codewiki/wiki/**` and `.codewiki/changes/**`.
- **SK3A** — exact desired-state Wiki and roadmap admission:
  - candidate commit `985bc1bd0a77dece9be08829844bb32da4cfac61`;
  - candidate tree `096a1169de7e49c12db42527e88cf86ede2c9207`;
  - patch SHA-256 `58eb472d9a4cfe7189691288c7eb120487e969f18898f012d669ff1db15a8360`;
  - authorization `sha256:7022ddecf05975ee8db95315fb9be0b00178782008d64a106bf96612efcf787c`;
  - qualification report `sha256:9ac91bbb7fa41762f292509693f687b0662e5da6f69c79fc775afdd87820b0e2`;
  - activation commit `927e21f863ca954ba7826d771b8556dfe236827e`;
  - activation tree `75ecaca3765023c4f0ae5f3848da86227f69d5f5`;
  - activation report `sha256:bc6fa831f089ad1833237d984877cd1a059a2639c13b2cb3dff9fd7e6946188e`.

`CHG-sk3a-exact-design-roadmap` is accepted incomplete. Its SK3B–SK3H outcomes remain binding until a later governed Change explicitly supersedes them. Historical target refs to retired Item IDs remain evidence; retirement never reassigns an ID.

### Current truth boundaries

```text
.codewiki/wiki/**        desired Project meaning
.codewiki/changes/**     append-only lifecycle truth
src/** and tests/**      current executable behavior
Git                      exact bytes, ancestry, refs, history, checkpoints
external private state   credentials, DSH/Preview internals, caches, worktrees, raw evidence
```

`.codewiki/kb/**`, `.codewiki/traces/**`, `.codewiki/runtime/**`, `.codewiki/views/**`, generated Wiki indexes, project-local CodeWiki packages, and controller pins must remain absent.

## Historical SK3B gap and overlay disposition

A post-SK3A audit found broad executable drift, dead architecture, API sprawl, cycles, duplication, stale source ownership, and compatibility leakage. An uncommitted SK3B overlay explored those cuts. It is not an authorized candidate.

Before source cutover:

- preserve the overlay's exact status, patch, tests, and audit notes outside the governed checkout;
- preserve pre-existing untracked `outputs/` unchanged;
- treat overlay files only as donor/research evidence;
- do not merge or transplant any dependency closure wholesale;
- re-evaluate every behavior against current Wiki and the allowlist below.

The original SK3B procedure required the documentation cutover amendment to be frozen, externally qualified, authorized, and activated before its target source edits. That historical requirement does not impose new per-checkpoint activation on maintainer-approved R1; current native work follows the R1 queue and boundaries above.

## Cutover rules

1. Keep this repository and package identity. Do not create a replacement Product repository.
2. Preserve obsolete implementation in immutable Git history, release artifacts, and a verified Git bundle.
3. Do not keep active `legacy/**`, `old/**`, archive-source, or dual architecture directories.
4. Develop in the single active source checkout on the explicitly selected unprotected branch. Preserve unique work; use disposable external projects for packed-candidate testing, not competing long-lived source clones.
5. Create the target tree from an allowlist. Old files have no presumption of migration.
6. For each subsystem, freeze old files, exports, references, tests, accepted invariants, and dependency closure before changing it.
7. Classify each behavior as `transplant`, `rewrite`, `defer`, or `delete`. A dependency chain that imports old architecture is a rewrite signal.
8. Retain no pre-stable compatibility reader without an identified external subject, exact predecessor bytes/schema, owner, expiry, and qualification evidence.
9. Normal startup reads only current Wiki/Change roots and never migrates, repairs, or dual-writes semantic state. Explicit offline conversion requires an exact manifest, independent qualification, recoverability, and separate live-effect authority. The audited historical helper is not a qualified exception to this rule.
10. Exclude `codewiki.legacy:*` provenance from normal term resolution, search, semantic diff, ownership, applicability, authorization, Agent context, and generated Views.
11. Keep one Product, one semantic controller, and one release lineage. Do not create Forge, a Dev controller product, a Pi wrapper, or another lifecycle authority.

## Target source architecture

The target production allowlist is:

```text
src/
  kernel/
    data-contracts/
      canonical-json.ts
      validation.ts
      outcome.ts
    identity/
    wiki/
    changes/
    work/
    gates/
    evidence/
    index.ts
  server/
    authorization/
    intake/
    lifecycle/
      decision/
      planning/
      implementation/
      review/
    commands/
    queries/
    projections/
      alignment/
      work/
    recovery/
    effects/
    index.ts
  ports/
    project-store.ts
    check-runner.ts
    agent-runtime.ts
    preview.ts
  adapters/
    git/
    checks/
    dsh/
    preview/
  api/
    contracts/
    transport/
    client/
    index.ts
  product.ts
  index.ts
```

Tests mirror target ownership under `tests/kernel/**`, `tests/server/**`, `tests/ports/**`, `tests/adapters/**`, `tests/api/**`, `tests/product/**`, and `tests/package/**`. Benchmarks remain outside the shipped package.

Required dependency graph:

```text
api -> server -> kernel
server -> ports
ports -> public Kernel values
adapters -> ports + public Kernel values
product composition -> server + adapters
kernel -X-> server, adapters, process, network, UI, providers, DSH, Preview
```

Rules:

- Kernel is deterministic mechanism, never Project Server or runtime. Role/capability policy and explicitly adopted project Check policy enter as validated data; R1 removes Product-fixed semantic judgments, not deterministic safety validation.
- Project Server is sole semantic control plane and authorizes every managed-ref write through Project Store.
- Project Store, Check Runner, Agent Runtime, and Preview are separate narrow host-neutral ports; adapters own effects.
- DSH implements Agent Runtime and AI/model-provider mechanics. It does not own semantic authority or Git, Delivery, remote, or Preview effects.
- `preview.work` is scoped producer feedback; `preview.verify` is independent exact-subject observation. Neither Preview mode returns Gate authority.
- Public package exports come from one reviewed manifest. Kernel API is Project Server-served Product UAPI; internal modules are private.
- No generic `utils/**`, broad `runtime/**`, backend selector, dynamic semantic Plugin, or cross-layer barrel may hide ownership.
- System Component Items declare target ownership only through `codewiki.component:ownership`. Semantic roles belong to lifecycle/check owners, singleton config and lock files have exact owners, and target readers never use `codewiki.legacy:*` metadata outside explicit provenance inspection.
- Architecture checks enforce roots, imports, cycles, exports, ownership coverage, and forbidden edges from the first target commit.

## Historical SK3H target-tree disposition

The following snapshot is retained for audit provenance, not as the current R1 work queue. In particular, Check execution, durable recovery tests, and bounded efficiency evidence are R1 dogfood prerequisites, not post-stable deferrals. R1 controls current scope and evidence labels; historical claims of mechanism completeness are not fresh qualification.

The SK3H desired-versus-executable alignment audit found that SK3C–SK3F implemented the mechanism-complete minimal Kernel while the target tree above and the Wiki `codewiki.component:ownership` attributes encode the full vision. The divergence was incremental and was not recorded per subsystem at the time. This section is the governing disposition: every deviation from the target tree is classified as `permanent re-home` (Wiki amended), `dogfood backlog` (desired state stays; a future governed Change builds it when demand exists), or `deferred` (explicitly not built). The Unix rule applies to every primitive: do one thing only and do it well; new surface arrives only as a dogfed Change with concrete demand.

| Target-tree entry | Executable truth | Disposition |
| --- | --- | --- |
| `server/lifecycle/{decision,planning,implementation,review}/` | Stage semantics complete in kernel reducers plus flat `src/server/commands/lifecycle.ts` and `gates.ts` | **dogfood backlog** — stage-scoped modules extracted when lifecycle operations grow beyond one command module per concern; Wiki patterns stay |
| `server/intake/` | Mechanism core exists (`change.proposed`/`change.revised`, atomic batch `proposeChanges`, revision with expected-tip) inside `commands/lifecycle.ts`; producer/normalize/dedupe/route machinery from Product N was clean-cut in SK3B and not transplanted | **dogfood backlog** — Intake is its own concept, never part of Decision: funnel untrusted material from all actors into the Proposed backlog, where authorized Decision validation admits Changes into the pipeline. Restore as `src/server/intake/` when real actors demand producers and deduplication; Wiki patterns stay |
| `server/projections/work/` | Deterministic WorkState/Work View derivation lives in `src/kernel/work/state.ts` | **permanent re-home** — deterministic mechanism belongs in the Kernel; Wiki `work-state` claims `src/kernel/work/**` only |
| `server/projections/alignment/` | Alignment read composed inside `src/server/queries/project.ts` (owned by `project-server`); Definition resolution lives in `src/kernel/wiki/**` (owned by `knowledge`) | **permanent re-home** — `alignment` owns no source paths today; extraction becomes a dogfed backlog entry |
| `adapters/checks/` | Check Runner port exists; every composition reports it unavailable; no deterministic sandbox adapter shipped | **dogfood backlog** — Wiki patterns stay; sandbox adapter arrives as a governed Change |
| `api/index.ts` | Public exports are the reviewed manifest `src/index.ts`; `src/api/**` split into `client/contracts/transport` | **permanent re-home** — Wiki `protocol` claims only the three real roots |
| `tests/product/**` | Package/product composition tested in `tests/package/**` | **permanent re-home** — Wiki `package` claims `tests/package/**` only |
| `benchmarks/**` | Deleted in the SK3B clean foundation; plan keeps benchmarks outside the shipped package | **deferred** — Wiki patterns stay; benchmarks return only with concrete evidence they pay |
| `tests/server/recovery/**` | Recovery-fact reads exercised via `tests/server/index.test.mjs` and `tests/server/queries/read-api.test.mjs` | **dogfood backlog** — dedicated recovery tests return when recovery work resumes |

Post-stable dogfood backlog (each entry becomes its own governed Change with concrete demand, never scheduled speculatively): intake module and producer/deduplication machinery, stage-scoped lifecycle modules, deterministic Check sandbox adapter, alignment read extraction, dedicated recovery test scope, benchmarks.

## Controller continuity and SK3G handoff

Immutable activated Product N remains the only semantic controller throughout SK3B–SK3F. Exact engineering checkpoints receive clean committed-subject CI receipts but no release lifecycle. Product N performs full external qualification only for an intentionally frozen SK3G release candidate. Checkpoint commits, packages, or passing tests never transfer project authority to the candidate.

The SK3G handoff must account for exact predecessor state rather than pretending a fresh bootstrap:

```text
.codewiki/config.json                 codewiki.project-config@2.0.0
                                      inherited role routes; worktreeIsolation=none
.codewiki/check-packs.lock.json       codewiki.check-pack-lock@1.0.0
                                      source.kind=domain
three active Trace headers            codewiki.change-trace@13.0.0
active Trace operation protocol       codewiki.change-trace-operation@1.0.0
SK3A Change                           accepted_incomplete; SK3B–SK3H remain open
```

Product N first qualifies one exact SK3G Product/package closure and offline one-shot converter outside the candidate checkout. Exact state conversion is qualified only after handoff freeze. Handoff then proceeds in this order:

1. stop admission of new Runs, Checks, Preview handles, protected effects, and ref writes under Product N;
2. prove all process/effect custody terminal or quiescent and freeze exact project/managed refs;
3. create and verify complete repository, owner-private state, config, lock, and controller-state backups;
4. under immutable Product N, dry-run conversion and replay against the exact frozen subject in a disposable external project, producing a qualification report bound to the exact handoff input, expected output, genesis mapping, Product, and converter;
5. obtain explicit authenticated human authorization for those exact qualified bytes, controller state, and rollback cutoff;
6. terminate Product N and prove no source-controller process or writer remains;
7. with neither controller running, execute the bounded offline converter as a recovery mechanism—not a semantic controller;
8. preserve predecessor Trace bytes in Git, create exact new genesis/handoff facts that link historical Change/requirement identities and carry unresolved SK3H work, and replace obsolete config/Domain-sourced lock semantics atomically;
9. verify converted bytes equal the authorized output, then compare-and-swap external controller state to exact SK3G and start it as sole controller;
10. prove replay, current authority, refs, open requirements, and no source-controller process before permitting new work.

No source/target controller overlap is allowed. Rollback is permitted only before the fixed cutoff and only by restoring the complete verified backup; after the target performs its first authoritative write, recovery is forward-only. Normal SK3G startup cannot invoke the converter or read unsupported predecessor state.

## Milestone ledger

### SK0 — universal contracts — complete

Qualified historical semantic identity and migration foundations. See [archived SK0 contracts](docs/archive/SEMANTIC_KERNEL_SK0_CONTRACTS.md).

### SK1 — Git-native semantic contracts — complete

Qualified mandatory Git storage, universal Wiki Item encoding, ref/commit validation, and Domain-free foundations.

### SK2 — governed Wiki migration — complete

Qualified Wiki/Change roots and repository migration. Historical migration machinery is not target Product architecture.

### SK3A — exact design and roadmap admission — complete

- [x] Establish Wiki as desired-state authority and this file as sole active ledger.
- [x] Qualify exact candidate `985bc1bd...` externally with immutable controller `adc272d0...`.
- [x] Obtain exact-byte authorization and accept `CHG-sk3a-exact-design-roadmap`.
- [x] Activate merge `927e21f...` without changing candidate Wiki/source bytes.

### SK3B — legacy freeze and clean Kernel foundation

Accepted requirement: `cw:codewiki:requirement:xj62wfc6qeqpzvgqqpndu7h4dcrtalsleyerrfptisafmm7zlyha`.

- [x] Qualify and activate the exact Wiki/roadmap cutover amendment before source work. Qualification must also preflight the released-controller-generated admission and completion Trace snapshots against candidate tests; a candidate test may enforce one Trace per Change and exact closed historical seeds, but never freeze the repository-wide Trace count. An accepted-incomplete Trace may freeze only its immutable prefix and reducer-valid state, never its total operation count.
- [x] Seal activated legacy commit/tree, tags, release artifacts, qualification evidence, and verified Git bundle.
- [x] Preserve the uncommitted exploratory overlay externally; retain no overlay byte by default.
- [x] Freeze subsystem donor manifests with structural search, LSP references, dependency graphs, public exports, tests, and dynamic-entrypoint analysis.
- [x] Freeze the target file/export/test allowlist and architecture rules.
- [x] Replace the active source/test tree with the minimal target skeleton; do not relocate obsolete code into active archive directories.
- [x] Implement canonical values, typed outcomes, identity/digest primitives, Product-fixed policy value containers, target package composition, and architecture gates.
- [x] Implement native `codewiki.component:ownership`; assign semantic roles to lifecycle/check owners and exact ownership to `.codewiki/config.json`, `.codewiki/check-packs.lock.json`, `package-lock.json`, and their target readers/tests.
- [x] Remove target fallback to legacy ownership metadata and prove every `codewiki.legacy:*` attribute is provenance-only outside normal semantic retrieval.
- [x] Make bootstrap create only versioned Domain-free config, empty Wiki/Change state, and passive Check Pack resources.
- [x] Prove normal target entrypoints cannot reach Domain, KB/OKF, old Trace roots, Backend/Runtime Build compatibility, project-local extensions, or migration code.
- [x] Remove obsolete root exports, scripts, test globs, source ownership, runtime hooks, and package metadata; preserve `.pi` safety/governance instructions that remain true.
- [x] Qualify and activate one exact private development checkpoint containing only the clean foundation; retain Product N as sole controller.

Success: active Product source has only target roots/layers, current Wiki/Change ownership, and no executable pre-stable semantic owner. Historical bytes remain recoverable through Git, not production imports. Checkpoint activation does not promote its controller.

### SK3C — semantic lifecycle Kernel

Accepted requirement: `cw:codewiki:requirement:xej4slpzn4cnbpoo6dsxshnacedgqbm5limjncdofnqhvl5hec7a`.

- [x] Close the bootstrap validation gap before further source work: permanent tests must pass in a clean checkout of the exact checkpoint commit; one-time migration scope checks compare explicit base and candidate identities outside the shipped suite. Abandon unpromoted commit `9e54196ff1add946ebb93e2a81a16b95c1d3f7bb`, whose clean checkout exposed the dirty-HEAD-dependent Wiki mutation test.
- [x] Assign the replacement checkpoint a unique prerelease package version so released Product N and checkpoint N+1 cannot share `@nunomoura/codewiki@0.3.0` with different bytes.
- [x] Implement canonical Wiki Item, Change Trace, Work, Gate, Check Run, Result, Evidence-reference, Product Build, and Kernel Build contracts with bounded decoders.
- [x] Define exact semantic-event ownership separately from Trace encoding/segment ownership, populate native `traceEvents` metadata atomically, and reject duplicate or unowned current events.
- [x] Implement deterministic reducers and exhaustive Proposed/Committed/Completed/Rejected/Deferred/Withdrawn transitions.
- [x] Implement full-snapshot Change/Completion parent and ordering validation. An operation inside a commit binds exact input OIDs plus fixed `containing_commit`; Git context supplies the containing result OID.
- [x] Implement Project Store port and Git adapter with complete-object validation and expected-old-OID CAS. No other target path writes canonical or managed refs.
- [x] Implement active-Check resolution, typed Gate outcomes, and Check Runner port. Safety-critical activation is universal or derived only from deterministic exact-subject facts independent of producer classification.
- [x] Define the host-neutral Preview port values and `preview.work`/`preview.verify` capability identities without importing an adapter.
- [x] Derive WorkState/Work View from Git, Trace, Gates, Results, Work facts, and receipts.
- [x] Remove target Candidate, Completion Requirement, disposition, Gate package, canonical global Work Graph, private integration lineage, and Review Attempt authority.
- [x] Model/property-test containing-commit identity, exact event ownership, replay determinism, stale-writer rejection, idempotence, conflict behavior, and crash recovery.

Implementation checkpoint facts (not completion or activation):

- Exact engineering checkpoint `ecccedede7de671e79dbc9ed042ec160a64ed583` with tree `7ab3d5fe312c0f439c5bb5dcfc527c03f7629af3` is retained on unprotected branch `bootstrap/semantic-kernel` at unique prerelease `0.4.0-sk3c.1`; Product N, `main`, governed refs, Trace, and controller state did not move.
- One clean detached-checkout receipt at `~/.local/state/codewiki/checkpoints/ecccedede7de671e79dbc9ed042ec160a64ed583/ci-receipt.json` (SHA-256 `cdab7ee1895fe9d63e4c71217f4f99478a98c4823f6d7c5996c3ece10c71c00f`) binds 158 passing tests, build, reproducible package SHA-256 `8ef9fef9cd95d777c0c04a6723966bfc5972a49eac2d2a271cc2a8b9ec7dba24`, disposable packed import, zero production vulnerabilities, diagnostics, and exact Wiki migration scope.
- Abandoned prospective commit `9e54196ff1add946ebb93e2a81a16b95c1d3f7bb` retains no ref and receives no qualification or activation.
- Pure Kernel contracts now cover native Wiki Items, Change-owned Work and planning, Change Trace `14.0.0`, semantic events and reduction, exact snapshots, Check Definitions, active-Check selection, Gates, Check Runs, Results, Evidence references, Product/Kernel Build identities, Preview values, and disposable WorkState.
- The Git Project Store adapter now uses bounded fixed plumbing, complete-object checks, deterministic commit creation, request-bound authorization digests, and expected-old-OID compare-and-swap for managed refs.
- Exactly seven native ownership records assign all 17 current semantic events once; no target Candidate, Completion Requirement, disposition, Gate package, mutable global Work Graph, private integration ref, Review Attempt, Domain contract, or Trace `13.0.0` compatibility reader was introduced.
- Root package exports, governed Change Traces, canonical refs, and controller state remain outside this implementation mutation; the replacement intentionally changes only package/Product version identity and the scheduled Wiki/process contract in addition to the bounded Kernel checkpoint.

- [x] Land one exact semantic-lifecycle engineering checkpoint with a clean committed-subject CI receipt; do not admit, complete, activate, or promote it. Retain Product N as sole controller.

### SK3D — transactional Wiki and bounded Views

Accepted requirement: `cw:codewiki:requirement:4arr3gvualjet5fk4tq2w6xqzrrsuk4jcgclvqovnh7fr5ll37aq`.

- [x] Implement exact commit/Change-tip Wiki get/list and validated transaction post-state.
- [x] Implement bounded lexical search, links/backlinks, Definition resolution, history, attribution, and semantic diff.
- [x] Bind source OID, derivation identity, authorization, coverage, ordering, truncation, freshness, unknowns, and citations into every View response.
- [x] Provide exact Git fallback when private indexes are absent or stale.
- [x] Exclude `codewiki.legacy:*` attributes from normal term resolution, search ranking, semantic diff, ownership, applicability, authorization, Agent context, and generated Views; expose them only through exact provenance inspection.
- [x] Prove Item moves preserve IDs, relationships, attribution, and history.
- [x] Property/fuzz test Item envelopes, paths, relationships, Unicode, limits, malformed repository input, and adversarial provenance fields.
- [x] Land one exact Wiki/View engineering checkpoint with a clean committed-subject CI receipt; retain Product N as sole controller.

SK3D checkpoint facts:

- Exact commit `d7835ba4ac1ff0b0fdab87876e97166d8a93bcdb` packaged uniquely as `@nunomoura/codewiki@0.4.0-sk3d.1`; 182/182 clean committed-subject tests, build, byte-identical double-pack, external packed import, production dependency audit, primary diagnostics, and fresh structural/security diagnostics passed.
- Package SHA-256 `fb45f6e9c8431b06b3e6536af0ac134261253fceadf6b74da926d62fd792a890`; the sole retained checkpoint receipt is `/home/canina7/.local/state/codewiki/checkpoints/d7835ba4ac1ff0b0fdab87876e97166d8a93bcdb/ci-receipt.json` with SHA-256 `5f6eb5fe6f590d50cb5a7ae8bc78102ccce7a4792db122f2a1df1addd90bee41`.
- No release was admitted, completed, activated, or promoted; `main` and Product N controller state did not move.

### SK3E — Project Server and authenticated read API

Accepted requirement: `cw:codewiki:requirement:bdr2py6syqr74steqtfrxaz2k6hn6tyzyjmvlwlho77upknke6nq`.

- [x] Compose Kernel with Project Store and Check Runner ports under Project Server authority; expose Agent Runtime and Preview only as unavailable typed capabilities until their qualified adapters exist.
- [x] Implement Project discovery, capability/status, exact Wiki, Change, Gate, Result, Work, Review, and Alignment reads.
- [x] Publish curated version-neutral Product UAPI/Client SDK operations, historically named Kernel API, plus explicit versioned transport envelopes.
- [x] Project user-facing reads and messages through Change, status, Work, Checks, Decisions, next action, and required user action. Keep builds, digests, refs, receipts, protocol identities, controller generations, DSH internals, and storage mechanics out of normal interaction; expose bounded technical evidence only through explicit audit or troubleshooting operations.
- [x] Enforce Client/Actor separation, AuthZ/redaction, exact source resolution, bounds, cursors, idempotence, and stable errors.
- [x] Prove no Client receives direct pure-Kernel invocation, Git writer, port/adapter handle, private-state path, credential, or moving View handle.
- [x] Land one exact API engineering checkpoint with clean committed-subject checks, including packed use from a disposable external project; do not activate it.

SK3E checkpoint facts:

- Exact commit `f71d083a1dbc8e30bf95cf3ac0487a9d8ca8e2f9` packaged uniquely as `@nunomoura/codewiki@0.4.0-sk3e.2`; 204/204 clean committed-subject tests, build, byte-identical double-pack, external packed Project Server/Client/transport use, production dependency audit, primary diagnostics, and fresh structural/security diagnostics passed.
- The diagnostic-rejected `0.4.0-sk3e.1` identity remains abandoned without a receipt. Qualified package SHA-256 is `a10d435514eedee18360c90859a2ad7504ff8473419e611241d1226d09b1b63a`; the sole retained checkpoint receipt is `/home/canina7/.local/state/codewiki/checkpoints/f71d083a1dbc8e30bf95cf3ac0487a9d8ca8e2f9/ci-receipt.json` with SHA-256 `6131e914d126186c7180472ea3ff54f76de078ff76975ce3c8b62773f9d2f93d`.
- No release was admitted, completed, activated, or promoted; `main` and Product N controller state did not move.

### SK3F — governed mutation and local lifecycle

Accepted requirement: `cw:codewiki:requirement:2jzn73ks7jsma7qrn6yatbaour2gs25uvu4z6vfj52wdemlslspq`.

The first committed candidate, `5fc845982c80341bf78853060fcc5e99b0f0e560` packaged as `@nunomoura/codewiki@0.4.0-sk3f.1`, is abandoned without qualification or receipt. Fresh security diagnostics rejected its dynamic writable-path regular expression after its archive identity had been frozen; the bounded non-regular-expression matcher and every later correction therefore use the distinct `0.4.0-sk3f.2` identity.

- [x] Publish atomic `proposeChanges`, expected-tip revision, and Decision outcome commands.
- [x] Publish Planning, Work admission/integration, canonical reconciliation, Review, completion, and protected-effect commands.
- [x] Prove all-or-none batch proposal admission and independent later outcomes.
- [x] Before Review, reconcile the admitted Change artifact delta with current canonical history on the managed Change ref; conflicts or changed bytes invalidate affected Results and require fresh Checks.
- [x] Prove Review qualifies the exact prospective Completion project-artifact tree, Completion preserves every reviewed project-artifact byte, embedded Trace uses `containing_commit`, and canonical drift restarts reconciliation/Review.
- [x] Prove expected-head/tip rejection, explicit reconciliation, supersession, and no silent semantic auto-merge.
- [x] Fault-inject every object-write/ref-CAS/private-state boundary and prove deterministic restart.
- [x] Stress concurrent Changes, Work integration, recovery, and idempotent lifecycle commands through qualified deterministic test adapters.
- [x] Land one exact mechanism-complete local-lifecycle engineering checkpoint with a clean committed-subject CI receipt; retain Product N as sole controller.

SK3F checkpoint facts:

- Exact commit `33cabfe4480285dcf47ce60eba9a0335d63eae45` with tree `ccd553318a18e13a69ab24c37814d51c25fca8fc` is packaged uniquely as `@nunomoura/codewiki@0.4.0-sk3f.2`.
- Clean detached-checkout typecheck, 210/210 tests, build, production dependency audit, fresh warning-or-error diagnostics, byte-identical double-pack, and external packed runtime/type use passed. Package SHA-256 is `91641218e3671bd33b6ba5dce8505a7aa70561e7d15cea6c4fac161b9f5ea022`.
- The sole retained receipt is `/home/canina7/.local/state/codewiki/checkpoints/33cabfe4480285dcf47ce60eba9a0335d63eae45/ci-receipt.json` with SHA-256 `867d79d3fb791f1c25d529b07bd629f84ec71f5030c79901dbfd81c7ab784e69`.
- Product N remains sole controller. No release admission, activation, promotion, governed ref, or `main` movement occurred.

Success: local lifecycle semantics and effect authorization are complete under qualified deterministic test adapters. This checkpoint is not operationally Agent-capable and cannot become controller.

### SK3G — DSH adapter and first self-dogfood

Accepted requirement: `cw:codewiki:requirement:kjmy5ktiltnicsnne6bzgfbkwrh4n4j5r6sqs4gkhwjsiajsiema`.

SK3G implementation sequence, frozen against SK3F commit `33cabfe4480285dcf47ce60eba9a0335d63eae45`:

1. Replace the Agent Runtime capability marker with strict host-neutral Run authorization, dispatch, observation, cancellation, terminal receipt, and quiescence contracts. Add only the Project Server orchestration and private operational-fact boundaries required to consume them.
2. Implement the thin DSH adapter and qualified Execution Host mapping. DSH continues to own Sessions, provider/model loops, tools, compaction, and internal recovery; CodeWiki validates only exact Run inputs and bounded receipts.
3. Implement the local Preview adapter and extend its port with scoped handles, repeated bounded observation, cancellation, closure, and stale-generation behavior. Keep producer Preview distinct from independently captured verification Evidence.
4. Connect Decision, Planning, Worker, Review, and Model Check scheduling to exact lifecycle subjects and Product-fixed role policy. Add adversarial, retry, cancellation, resource, authority, and process-custody qualification before freezing a candidate.
5. Build and externally qualify the one-shot predecessor-state converter, handoff manifest, exact SK3G package, and backup/restore evidence under immutable Product N. Activation and controller handoff remain a separate human decision.

- [x] Implement host-neutral Agent Runtime port and bounded DSH adapter only; do not duplicate DSH Sessions, provider/model loops, tools, compaction, sandboxing, or process supervision.
- [x] Bind Decision, Planning, Worker, Review, and Model Check roles to exact subjects, Product-fixed role/check policy, context, routes, tools, capabilities, writable scope, budgets, and receipts.
- [x] Give every immutable authorization one Run/idempotency identity. Prove transport retry/reconciliation reuses it and cannot duplicate semantic execution; new semantic input/attempt receives a new Run only after predecessor terminal receipt or independently proven quiescence.
- [x] Implement Project Server cancellation requests through Agent Runtime port and qualify DSH/Execution Host enforcement, descendant custody, resource exhaustion, terminal receipts, transport loss, and recovery.
- [x] Implement the Preview port and bounded local adapter. Qualify scoped `preview.work` handles, independent immutable-subject `preview.verify`, profile-only launch, lease/TTL, loopback/network/resource/output limits, cancellation, process-tree cleanup, and unavailable/stale behavior.
- [x] Prove Worker Preview remains producer context; Check Preview runs fresh and only validated observation can become Evidence. Model Checks may consume prior immutable Preview Evidence but cannot launch Preview.
- [x] Qualify every declared Linux/Node version against Secure Code address-space bounds; Node `24.14.0` runs with native Node execution without the legacy WASM transformer.
- [x] Prove Workers cannot mutate Wiki/Trace/managed refs and project Skills cannot weaken role contracts. DSH AI/model routes cannot invoke Git, Delivery, remote, or other protected Plugin effects.
- [x] Qualify deterministic Code Check sandboxes separately from Model Check DSH Runs and Preview execution.
- [x] Run malformed output, malicious repository, path/symlink, environment/command injection, secret, network, duplicate transport, cancellation-race, stale Preview, and resource-exhaustion cases.
- [x] Use immutable activated Product N plus DSH to develop and externally qualify one exact SK3G candidate, handoff manifest, state conversion, and genesis mapping without loading candidate code as controller.
- [x] Execute the ordered quiescent, backup-first handoff in this plan. Preserve historical Trace bytes, carry open SK3H identity, atomically retire Product N, and start exact SK3G as sole controller only after explicit human authorization.
- [ ] Use promoted SK3G to govern one bounded SK3H operation and prove no old-controller process or unsupported predecessor reader remains.

Success: first Agent-capable private Product release completes a real Product N→N+1 cycle with exact receipts, independent human activation, one quiescent controller handoff, and zero controller overlap.

### SK3H — public-client proof and stable-development closure

Accepted requirement: `cw:codewiki:requirement:jzsvjec4kalxya5t3qpyvl2hgygje5a24fvi5bxv7qpo7z64kc6q`.

- [ ] Build the bounded read-only Omarchy reference client outside this repository using public API/SDK only.
- [ ] Ship the terminal-first Console as a `codewiki` bin with the established lifecycle verbs (`status`, `changes`, `checks`, `trace`, `change`) over a public bounded local Project Server composition; deterministic plain-language output is the default, technical identities only via explicit audit reads, and the Project Server (never an agent daemon) remains the only service vocabulary.
- [ ] Make the terminal-first Console default to plain user language: what changed, why it matters, what happens next, and whether the user must act. Technical identities remain absent unless the user explicitly requests audit or troubleshooting detail.
- [ ] Test only against packed immutable qualified Product bytes with least-privilege credentials.
- [ ] Prove no direct `.codewiki/**`, private-state, internal module, or managed-ref access.
- [ ] Complete final Wiki/source/API ownership and desired-versus-executable Alignment audit, including semantic roles, Trace events, singleton config/locks, ports, adapters, and Product-fixed policy.
- [ ] Reach zero dependency cycles, zero unclassified public exports, zero unclassified unreachable production modules, and no unexplained clone-ratchet regression.
- [ ] Reproduce package bytes, dependency closure, SBOM/provenance, install behavior, backup/restore, and recovery evidence.
- [ ] Complete at least one additional Product N→N+1 dogfood cycle without semantic-state repair.
- [ ] Qualify and activate the first stable development baseline.

## Cross-cutting hardening matrix

Every applicable milestone records bounded evidence in these areas:

| Area | Required evidence |
| --- | --- |
| Architecture | Allowed roots, acyclic imports, forbidden-edge tests, ownership coverage, curated exports, no dynamic Kernel loading. |
| Semantic correctness | Examples, properties, state-machine/model tests, exhaustive outcomes, containing-commit identity, exact Review/Completion subjects, replay and differential projection checks. |
| Persistence/concurrency | Complete-object validation, CAS conflicts, concurrent writers, idempotence, reconciliation drift, crash injection, restart, rollback. |
| Hostile input | Schema/JSON/Markdown/path/Git-ref fuzzing, Unicode, depth/size bounds, malformed/corrupt repositories. |
| Security | Threat model, symlink/path escape, Git config/hooks, command/environment injection, credentials, network, least privilege. |
| Execution | DSH/Check/Preview separation, same-Run transport idempotency, cancellation races, budgets, process-tree custody/quiescence, stale handles, OOM/resource limits, receipt mismatch, and unavailable routes. |
| Supply chain | Exact locks, minimal production dependencies, audit, SBOM/provenance, package allowlist, reproducible pack, no install effects. |
| Operations | Structured non-secret errors, deterministic recovery, backup/restore, external disposable lifecycle, real self-dogfood. |

Line count, file structure, typechecking, coverage percentage, or raw test count alone never closes a hardening claim.

## Development and promotion gates

### Engineering checkpoint

Run for bounded commits while SK3 remains on Product N:

1. record unscheduled gaps in this ledger before source changes;
2. preserve unrelated user files and keep development in an isolated worktree or ordinary unprotected branch;
3. run primary LSP diagnostics, architecture/import/export checks, typecheck, build, and risk-relevant focused/property/fault tests;
4. create a normal commit without prospective-OID or commit-creation authorization;
5. rerun the complete applicable suite from a clean checkout of that exact commit;
6. emit one machine-readable CI receipt binding commit, tree, package version when packed, commands, outcomes, and toolchain; and
7. delete disposable installs, copied repositories, `node_modules`, successful raw logs, and other scratch after receipt generation.

Engineering checkpoints are not release candidates and receive no admission, completion, activation, or controller claim. One-time diff/history assertions belong in checkpoint qualification with explicit base and candidate identities, not in permanent current-state tests.

### Immutable release candidate

Only when an Agent-capable SK3G or stable SK3H outcome is coherent:

1. assign a unique package version and freeze one candidate manifest binding controller N, exact source commit/tree, package SHA-256, Product Build, Kernel Build, and policy;
2. run clean exact-commit tests plus only the architecture, security, supply-chain, recovery, and hostile-input gates applicable to changed risk;
3. reproduce the package and install those exact bytes only in disposable external projects with isolated settings and owner-private state;
4. use immutable Product N to qualify the exact manifest and emit one qualification receipt;
5. retain exactly one content-addressed package/bundle, candidate manifest, qualification receipt, exact human authorization bytes, and activation receipt—never copied per attempt;
6. obtain one exact human decision only for activation, then execute the backup-first compare-and-swap activation or SK3G controller handoff; and
7. retain Product N and its verified backup through the stated rollback cutoff.

A failed or corrected release candidate receives a new commit and package version. Failed scratch is retained only when needed to diagnose the bounded failure; all other attempt state has a short cleanup TTL. Release activation never silently changes the controller.

## Deliberate deferrals

The clean Kernel and first stable development baseline do not require:

- rich CodeWiki App UI;
- remote, shareable, or long-lived Preview and a general Plugin ecosystem or project-local executable Plugins;
- standalone persisted Dictionary/Term authority;
- mandatory structured Definition/Claim profiles or full temporal Claim algebra;
- graph database authority;
- semantic auto-merge or model-authored conflict resolution;
- arbitrary host/platform support beyond exact qualified Linux closure;
- deployment success coupled to local Change completion;
- active readers for unsupported pre-stable formats;
- Forge, Dev controller product, Pi wrapper, or another semantic controller.

SK4+ work remains future governed Changes only after concrete users and evidence justify complexity: bounded remote/shareable Preview Plugins and other effects, Raw Data/temporal Evidence, additional DSH hosts, and additional platforms.

## Stable closure and archive

This plan remains active until every non-deferred implementation item is bound to an exact clean-checkpoint receipt, the SK3G and SK3H release items are externally qualified and activated, the final exact Alignment audit finds no unowned gap between Wiki and executable behavior, the package/API surface is intentionally frozen, and repeated Product N→N+1 dogfood proves recovery without candidate self-governance.

Closure records checkpoint commit/tree receipts, unique released package digests, final qualification/authorization/activation receipts, explicit deferrals, supported predecessor/host matrices, and archive identity. Generated summaries are views, not additional authority. The plan is then archived as historical evidence and removed from active navigation. Wiki remains desired-state authority; source/tests remain executable truth; roadmap status never migrates into Wiki.
