# Semantic Kernel Refactoring Plan — Active Ledger

## Semantic collaboration rebaseline — current entry point

**SC-0 documentation is complete; next scope is SC-1, contract probes and design only. Source implementation remains paused.** The maintainer confirmed native compaction and authorized resumption of the preserved documentation sequence. The existing Wiki and this ledger have been reconciled; do not resume D4 or execute a superseded R1 implementation packet. R1's approved native working method and protected-effect restrictions remain in force, not its superseded product destination or queue. The SC queue below is the only current sequence.

### Baseline and preservation

- Checkout: `/home/canina7/Projects/codewiki`; branch: `audit/clean-baseline`; capture HEAD: `9b24f5a74f9561e3eaf94cd37c69cc216e521d1b`, the documentation-only preservation checkpoint. Source ancestry remains `53b17a023beeb8edde48b7cf488dcdfe95639e7a`, with selected audit ancestry `7fe04257d2a18d5d16130c45f5919e49bb84f92d`. None is an instruction to reset the branch.
- Canonical remote remains `origin`, `git@github.com:NunoMoura/codewiki.git`. No remote refs were refreshed or moved. No current authority is inferred from historical release/handoff evidence.
- Before this pass, the three partial D4 source/test files, coordinator's Project Wiki edit, `.pi/settings.json`, and four `outputs/` documents matched the preservation manifest. The index was empty. D4 remains unaccepted after infrastructure/provider failures; no retry, new executor, paid call, or fallback is authorized by this documentation work.
- Private pre-edit evidence: `~/.local/state/codewiki/evidence/semantic-hub-docs-bcg7occz/`, including tracked-path hashes/modes, refs, the pre-existing patch, and original Markdown bytes. The prior preservation evidence and complete pivot reasoning remain below.
- This pass may update only the 47 existing Wiki documents, this plan, README, and repository guidance. Preserve Wiki envelopes, stable IDs, native source/test/event ownership, and legacy provenance. Limited title/alias/relationship-rationale updates may reconcile names; no storage/protocol conversion is included. Preserve the Project repository-binding safeguard verbatim while reconciling surrounding design.

### SC-0 — coherent documentation rewrite

Status: **complete as native documentation work**, not source implementation or qualification. All 47 existing Wiki bodies were reconciled, including personas, stories, flows and diagrams; supported envelopes, stable IDs, legacy provenance and all 21 native ownership records were retained. Diagram bodies keep their existing JSON representation. Title/alias updates and two native kernel relationship explanations reflect the new meanings without changing identities or ownership. The existing Project repository-binding safeguard is byte-preserved. Stable behavior belongs in Wiki; source support, gaps, ordering and readiness remain here.

The maintainer explicitly required `AGENTS.md` to contain only guidance needed in every prompt. It is reduced from 551 words at capture HEAD to 121 words: startup/current-scope pointer, truth locations, source-checkout safety and protected-effect authority. Generic working advice, refactoring stage details and duplicated release/lifecycle procedures are removed from prompt guidance; this ledger owns those procedures. README distinguishes desired behavior from current executable limitations rather than acting as another roadmap.

The desired contract is CodeWiki Hub over Git, with Wiki and Change as the two primitives. Change carries evolving intent; Wiki consolidates knowledge and adopted consequences with revisable grounds. Decision, Planning, Implementation, and Review share one semantic foundation. Validation distinguishes intent fit, consistency, reachability, preservation, justification, and authority without promising omniscience. Markdown discovery does not confer equal authority. Tests, observations, and model judgments support validation without a separate project-authored Check Pack or Skills ontology.

The remaining implementation choices are deliberately not frozen by this rewrite: exhaustive knowledge/Change classification, mandatory metadata fields, an attention formula, intermediate-promotion rules, intent-amendment boundaries, checkpoint storage, default branch/merge strategy, optional `.gitattributes`, and execution/provider selection. P-O1–P-O12 below retain their reasoning and unresolved details. Wiki records invariants and distinctions, not a pending design survey or refactoring status.

### Source-grounded retain / adapt / replace / defer map

This is a targeted source/test inspection against capture HEAD plus the preserved dirty D4 patch, not a full correctness re-audit or fresh test run. Fresh LSP navigation and exact symbol bodies were used; the pi-lens graph reported stale, low coverage and is not dependency-closure evidence. Test paths below identify reusable regression assets, not newly passing acceptance results.

| Area and executable evidence | Disposition and implementation gap | Successor |
| --- | --- | --- |
| `src/kernel/data-contracts/`, `src/kernel/identity/`; matching tests | **Retain** bounded typed failures, digest domains, exact identities, and deterministic contracts. **Adapt** Build/policy identity wiring; a Product policy digest is not an observed executable Build identity. Do not reintroduce the removed canonical/Domain naming. | SC-2, SC-4, SC-7 |
| `src/kernel/wiki/{file,item,tree,transaction}.ts`; corresponding kernel Wiki tests | **Adapt/replace enrollment assumptions.** `wikiFileFormat` requires `.codewiki/wiki/items` and restricted path spelling; `decodeMarkdownItem` requires one canonical-JSON envelope. Retain exact reads and atomic post-state validation, but ordinary tracked Markdown needs discovery without these authoring prerequisites. File/body authority cannot be inferred from membership alone. | SC-1, SC-2 |
| `src/kernel/wiki/{attributes,ownership}.ts`; ownership/architecture tests | **Retain** isolated legacy provenance and explicit current source ownership. **Adapt** future optional semantic annotations and role handling only with tested behavior; existing ownership allocations are not a universal knowledge schema. | SC-2, SC-4 |
| `src/kernel/wiki/{views,transaction}.ts`, `src/adapters/git/wiki.ts`, `src/server/queries/wiki.ts`; Wiki Views and exact-read tests | **Adapt** exact citation, bounded/redacted views, immutable-source fallback, and transaction deltas. Existing diff compares fields and bodies; it does not assess changed assumptions, commitments, alternatives, paths, or consequence. Support/dependency reasoning, uncertainty/coverage reporting, and semantic-diff interpretation are gaps. | SC-2, SC-3, SC-6 |
| `src/kernel/changes/{contracts,events,trace,reducer,snapshot}.ts`; matching Change tests | **Adapt** intent/rationale, append-only attributable history, exact baseline/snapshot, and stale-assessment rejection. Existing type/realization enums, Item targets, passed-Gate dependencies, and fixed commit/completion semantics do not settle the new Change classification or intermediate-promotion protocol. Preserve historical bytes; do not reinterpret old acceptance with a new model. | SC-1, SC-4 |
| `src/kernel/gates/`, `src/ports/check-runner.ts`, `src/server/commands/gates.ts`; Gate and lifecycle tests | **Replace the authored-policy contract; retain useful evidence mechanics.** `evaluateGate` loads locked Packs and selects registrations; it is not the new consequential semantic evaluator. Reuse exact subject/input binding, typed failure, result provenance, and stale-result defenses. Define supported/contradicted/unresolved judgments and authority-safe obligations without a renamed Pack registry. Empty old Gates are not semantic assurance. | SC-1, SC-3, SC-4 |
| `src/kernel/work/`, `src/server/commands/lifecycle.ts`, `src/server/queries/project.ts`; Work/lifecycle tests | **Adapt** dependency ordering, assignment scope, and deterministic transitions. Add shared obligations, uncertainty-driven replanning, integration-candidate assessment, and distinct partial outcomes. The current two-realization routes are evidence to assess, not a decision to skip Planning for knowledge work. | SC-4, SC-5 |
| `src/adapters/git/project-store.ts`, `src/server/commands/repository.ts`, `src/ports/project-store.ts`; Git store/snapshot tests | **Retain/adapt** exact blobs/trees/commits and expected-old-OID writes. Bind semantic assessments to actual baseline and joined subject; do not invent repository transactions stronger than Git supports. Select checkpoint transport/rewrite policy before changing refs/history behavior. No branch per stage is mandated. | SC-1, SC-4, SC-5 |
| Partial D4 in `src/adapters/git/{project-store,local-server}.ts` and `tests/adapters/git/project-store.test.mjs`; frozen `local-read-purity.test.mjs` | **Adapt only after fresh review; do not resume the old lane.** Preserve useful repository identity/object-format/root validation intent and the three-file patch. Verify real `.git` binding, redirects/symlinks, linked worktrees, SHA-1/SHA-256, read purity, and format/Build identity before accepting or replacing any hunk. No completion or passing new tests are recorded. | SC-2, separately scoped substep |
| `src/server/{index,authorization/policy,queries/source}.ts`, `src/api/`, `bin/codewiki.mjs`; auth/transport/query/Console tests | **Retain/adapt** authentication, redaction, exact once-resolved sources, request bounds, and honest capabilities. Extend semantic effects/feedback and knowledge access without assuming GitHub or software work. Reconcile Server-to-Git helper placement rather than keeping cyclic layer conventions. Local CLI is an adapter, not the product definition. | SC-2, SC-3, SC-4, SC-6 |
| `src/server/recovery/facts.ts`, `src/kernel/evidence/reference.ts`; recovery/evidence tests | **Adapt** immutable evidence binding and replay rejection. `createMemoryProjectServerFacts` is process-local; fresh-process judgments, accepted grounds, and effect reconciliation are not provided by it. Choose durable Git-linked semantic records separately from private live custody; do not build another authoritative project-state database. | SC-1, SC-4, SC-6 |
| `src/ports/agent-runtime.ts`, `src/adapters/dsh/`; Agent Runtime/DSH tests | **Adapt the boundary; defer selection of this particular executor.** A bounded model/tool observation path is needed for the semantic loop; DSH is one partial implementation, not a new primitive or mandatory host. Prior replay/injected-runner tests do not prove tool execution, physical containment, observed quiescence, or restart custody. No paid/provider calls belong to this pass. | SC-1, SC-3, SC-5, SC-6 |
| `src/ports/preview.ts`, `src/adapters/preview/local.ts`; Preview tests | **Defer supported execution.** Keep unavailable unless exact workspace, generation, output/custody and cancellation gaps are repaired and qualified. A callback receipt or worktree does not prove process isolation. Preview is not a first-dogfood prerequisite. | SC-7 exclusion; later demand |
| `src/product.ts`, `src/adapters/git/{bootstrap,project-config}.ts`, `src/index.ts`; Product/bootstrap/package tests | **Adapt/replace coupled policy.** Product currently names two special semantic roots, Check selection and `model-check`; bootstrap creates `wiki/items` and an empty lock. Adopt existing knowledge honestly instead of describing every project as empty. Update public/package/profile declarations with reader/writer changes; do not strip this repository's envelopes or convert historical state. | SC-1, SC-2, SC-4, SC-7 |
| `tests/kernel/invariants/architecture.test.mjs`, scripts and package regression assets | **Retain/adapt** pure Kernel/no ambient effects, source/export closure, ownership and historical-state guards. Allowlist changes must follow intentional source changes, not weaken tests to hide them. The architecture suite imports Change/Gate/Work/Evidence tests omitted from direct globs; no missing-suite finding is claimed. Test names and old counts do not prove semantic or operational coverage. | Each implementation slice |
| Optional Hub UI, remote delivery, editor plugins, formats beyond the declared Markdown subset, and old handoff converter | **Defer breadth.** Retain host-neutral collaboration and effect boundaries, not a mandatory Plugin marketplace, separate Skills corpus, custom Pack authoring, or additional hosting product in the first slice. Qualify any required predecessor conversion separately; never restore a historical converter blindly. | SC-7 boundary; later explicit scope |

### Successor queue and acceptance boundaries

The order below replaces the unfinished R1/D packets and old custom-Check/flat-directory milestone. It schedules gaps before source work, but does not authorize unspecified implementations. Each source slice needs its resolved design choices, exact file/test scope, preserved-work reconciliation, and bounded acceptance recorded here before editing. No further source work occurs during SC-0.

| ID | Scope and dependencies | Exit evidence / current status |
| --- | --- | --- |
| SC-0 | Rewrite the 47 existing Wiki pages coherently; orient README/AGENTS; preserve prior decisions, audit and partial work. | **Complete, documentation only.** Canonical envelopes, identity/provenance/ownership, local links, diagram references, obsolete-prescription scan, historical preservation and explicit-file primary LSP checks passed. A docs checkpoint is not source acceptance. |
| SC-1 | **Next: semantic contract probes and minimal protocol decisions.** Work through one software and one non-software Change plus three historical revision cases. Compare well-written prose/Git history against minimal explicit grounds/dependencies. Resolve implementation-critical P-O1–P-O9 and select bounded execution/profile requirements (P-O10–P-O12). | **Unstarted; documentation/design next.** Specify observable questions, counterexamples, authority and information-loss boundaries. Choose only structure the probes justify. Pin stage subject/judgment scope, provisional versus adopted knowledge, intent amendment, corpus role/scope, portable checkpoint record and rewrite behavior. Publish the bounded SC-2 packet; no schema may be silently inferred from the old implementation. |
| SC-2 | Native corpus and truthful adoption over exact Git. Implement the chosen Markdown/link/role subset, byte-preserving extraction, explicit malformed/private/ambiguous-input behavior, honest baseline assurance, and read-only binding. Reassess D4 separately. Depends on SC-1. | **Blocked on SC-1.** Tracked README/docs/notes without proprietary IDs/frontmatter; modified/new proposals not silently accepted; ignored/untracked distinction; fixture/quote/proposal roles; symlink/path/private-scope rejection; no index execution, writes or implicit bootstrap; old envelope fixtures retained where supported. Explicit target reader/writer/config/export cutover, not dual storage or live conversion. |
| SC-3 | Minimal consequential semantic evaluator and diff. Depends on SC-1 and exact SC-2 subjects. Adapt useful observation/executor contracts while removing project-authored Check policy coupling coherently. | **Blocked on SC-1/2.** Distinguish supported, contradicted and unresolved with reasons, scope, evidence and uncertainty; detect an actual commitment/assumption consequence; no label/waiver bypass, omitted-obligation pass, universal confidence score, or inference of proof from model/test success. Trace context coverage, changed assumptions, unavailable execution and stale support. Ordinary test/model tools remain usable without Pack enrollment. |
| SC-4 | Intent-bearing Change continuity and four-stage transitions with chosen Git-linked checkpoint records. Depends on SC-1–3. | **Blocked.** Persist rationale, rejected alternatives, assumptions, explicit intent revision and stage-specific outcomes; bind exact baselines/subjects and applicable authority; checkpointed ≠ accepted ≠ realized. Review exact recomposition and remaining obligations. Native commits outside the service are observed without fabricated acceptance. Historical assessments survive clone/restart without rerunning models; self-referential OID claims and rewritten-subject reuse are rejected. |
| SC-5 | Planning, authorized attempts, and semantic join validation. Depends on SC-4. Use one explicitly bounded executor only if its effects can be evidenced. | **Blocked.** Shared-maintenance obligations and preconditions survive parallel decomposition; isolated successes do not approve a conflicting merge. Feedback reaches Implementation, Planning, or Decision as appropriate. Deadlines, cancellation, scope/custody, unavailable tools and unknown effects produce honest stops; protected effects require pre-execution authority. |
| SC-6 | Durable judgments/custody, recovery, contextual retrieval, and fresh-Agent continuation. Depends on SC-3–5. | **Blocked.** Restart at each relevant write/effect cut point, exact outcome reconciliation, no duplicate effects or reconstruction from private chat. Fresh Agent explains accepted knowledge, original grounds, rejected alternatives, in-flight work and next permitted action. Missing/redacted/truncated context and external drift stay explicit. Do not recreate a lost assessment by rerunning its original model. |
| SC-7 | Bounded external first-dogfood qualification. Depends on SC-2–6, exact operational profile and resource budgets, replacement guidance, and resolved release/controller evidence. | **Blocked.** One immutable unique-version candidate in isolated external projects; real semantic failure/uncertainty → appropriate repair/evidence → planned/reviewed outcome → restart; software and non-software coverage; measured quality/effort against the prose/Git baseline. Exclude unsupported Preview/host/format breadth. No mutable checkout controller, inherited receipt reuse, live state conversion, or activation/handoff implied. |

SC-1's probes must distinguish: (1) supported reasons still hold; (2) one assumption fails while independent support may remain; (3) a previously rejected alternative becomes appropriate. The non-software case must require real-world observation (for example, onboarding time and retained controls), not count a committed procedure as realized improvement. The software case must include a shared obligation across parallel tasks (for example, no-secret-logging across UI/backend/observability). These are planned probes, not executed acceptance tests.

Quantitative time, memory, output, latency, token/cost/retry, quality, and intervention thresholds remain unset. Freeze them with a declared corpus/profile before SC-7, not after seeing results. Binding safety failures cannot be averaged away. Retain the original research limits and attention distinctions below; no new literature or paid model experiment was run in SC-0.

### Handoff and validation ledger

After SC-0 review, continue with **SC-1 only**. Do not automatically start SC-2, retry D4, change providers, move source baselines, or restore old custom-Pack/flattening goals. Use the Wiki for stable desired behavior, this ledger for scope/status, source/tests for executable behavior, and Git for checkpoint history. R1 permits bounded native work without release bureaucracy; push, canonical-ref movement, live conversion, credentials/paid calls, activation and controller handoff retain explicit authority requirements.

Native documentation validation: all 50 changed Markdown files passed explicit-file primary LSP checks; the directory-only LSP request found no supported files and was not counted as coverage. `verify-docs.py` and `documentation-review.json` in the private evidence directory record 47 canonical envelopes, 21 unchanged ownership records, valid diagram concept/edge/flow references, 62 local documentation links, 43 source-path references, the single SC queue, and a bounded scan for obsolete positive prescriptions. The Wiki decreased from 286,184 to 170,008 bytes without dropping its metadata/provenance. Exact comparisons preserve the complete prior ledger body beneath its renamed pivot heading, the Project binding section, all 144 other tracked/output paths, file modes and protected history. `git diff --check` passed. The index, branch, HEAD and refs were unchanged at this pre-checkpoint review.

Initial native rewrite preflights stopped before Wiki writes on an incorrect evidence path, an incorrect section heading and mismatched story/persona filenames; these were reconciled against the manifest and original files. Review also corrected capture-OID/source-path references, including a README link rejected by the native link scan. The final validation, not those failed attempts, is the completion evidence. No CodeWiki runtime, source tests, builds, package qualification, model/provider execution, live state conversion, activation or handoff ran in this pass. Historical tests/counts below remain unchanged evidence about their named subjects.

Checkpoint scope is the explicit 50-file documentation allowlist only, including the preserved pre-existing Project Wiki clarification. The partial D4 code/tests, user settings and outputs remain untouched and unstaged. The resulting checkpoint identity is recorded in Git and the external checkpoint record, not by a self-referential OID in this file. After this checkpoint, SC-1 remains unstarted and source implementation remains paused.

## Retained pivot and R1 evidence — not an execution queue

Everything below this boundary is preserved capture-time reasoning, audit, work history, or qualification evidence. Earlier “current”, “next”, and checked/unchecked queue wording describes its recorded time and is superseded by the SC entry above. The accepted pivot distinctions have been reconciled into Wiki; its unresolved questions remain references for SC-1, not additional active plans. Do not erase historical outcomes or infer authority from them.

## Semantic collaboration pivot — preserved decision record

> **Implementation is paused.** The maintainer accepted the direction consolidated below and authorized: preserve the brainstorm, compact using native Pi facilities, then rewrite the existing Wiki coherently and rebaseline this plan. The current pass is documentation preservation only. Do not resume D4, launch its Worker, or follow an older “next” implementation instruction below. R1's source-development safeguards and all higher-priority repository boundaries remain in force. The successor implementation queue has not yet been defined or accepted.

This section preserves the decisions, reasons, research, alternatives, and unresolved questions from the maintainer's long-form brainstorm. The approval to perform the preservation plan was: “Okay, great plan. Let's do it!” It is not a claim that the new architecture is implemented, operationally qualified, or activated. It does not convert this conversation into a governed Change, fabricate historical Traces, or transfer controller authority.

This is a temporary consolidation and continuation record in the sole active ledger, not another specification repository or parallel roadmap. Stable desired behavior must next be reconciled into `.codewiki/wiki/**`; implementation gaps, sequencing, status, and qualification remain here. Existing Wiki pages have not yet been rewritten to this direction. Conflicting predecessor design choices are explicitly identified below rather than silently treated as current implementation requirements.

### Pivot workspace and parked work

Capture-start observations:

- Active source checkout: `/home/canina7/Projects/codewiki`.
- Branch: `audit/clean-baseline`; exact HEAD: `53b17a023beeb8edde48b7cf488dcdfe95639e7a`.
- Selected audited source ancestry: `7fe04257d2a18d5d16130c45f5919e49bb84f92d`. This is provenance, not an instruction to reset HEAD or resurrect an older tree.
- Sole configured remote: `origin`, `git@github.com:NunoMoura/codewiki.git`. This pass has not refreshed remote refs or claimed that remote `main` is an approved baseline.
- Nothing was staged at capture. The worktree was already dirty; that work must not be absorbed into a blanket checkpoint or discarded as obsolete.

| Existing path | Capture-start status and preservation requirement |
| --- | --- |
| `src/adapters/git/project-store.ts` | Unaccepted partial D4 implementation; preserve unchanged. |
| `src/adapters/git/local-server.ts` | Unaccepted partial D4 implementation; preserve unchanged. |
| `tests/adapters/git/project-store.test.mjs` | Unaccepted partial D4 tests; no final successful validation is recorded. Preserve unchanged. |
| `.codewiki/wiki/items/system/components/project.md` | Existing coordinator-owned D4 repository-binding clarification; preserve pending reconciliation. |
| `SEMANTIC_KERNEL_PLAN.md` | Existing uncommitted D4 planning/failure record, 94 added lines relative to capture HEAD. Preserve that record beneath this new entry. |
| `.pi/settings.json` | Unrelated user configuration changes; do not edit or stage. |
| `outputs/` | Four existing untracked output documents; do not edit, delete, or add to Git. |

The fourth D4-owned file, `tests/adapters/git/local-server.test.mjs`, was not modified. The accepted read-purity test remains frozen according to the D4 packet. D4 stopped after an infrastructure failure and then an OpenRouter HTTP 402 recovery failure; its source patch is neither complete nor accepted. The preserved provider-cap investigation is not authorization for another paid call. The pivot does not permit a fallback executor or a retry of that lane. The detailed D4 packet and external failure evidence remain below for later retain/adapt/replace/defer review.

Pre-edit preservation evidence is outside Project Git at `~/.local/state/codewiki/evidence/semantic-hub-preservation-v8ikrmjl/`: `state-before.json`, `plan-before.md`, `tracked-before.patch`, `staged-before.patch`, and `status-before.txt`. The manifest covers 189 tracked paths and 194 paths including `outputs/`, with file digests, modes, symlink targets where applicable, branch, HEAD, and refs. The plan's pre-edit SHA-256 is `245edeff7b1083d30684692eac19669674042138adff458a5b64b3d5df318608`. These are private preservation artifacts, not release evidence or source truth. Capture-start HEAD may be followed by a documentation-only checkpoint; inspect current Git history rather than confusing that checkpoint with a source implementation change.

### Pivot decision 1 — product purpose and placement

**Agreed direction:** CodeWiki is a knowledge-and-change collaboration hub for humans and AI Agents across teams, not only software development teams. Git supplies the exact-content and history substrate. CodeWiki adds the semantic layer needed to preserve and evolve understanding. GitHub is an incumbent product category and optional integration, not an architectural dependency or the only place where semantic acceptance can occur.

The motivating failure is institutional amnesia: people and Agents forget why decisions were made, which alternatives failed, and which assumptions made an approach appropriate. Larger context windows cannot recover rationale that was never consolidated. Retaining more documents or conversations without their grounds does not solve continuation. The product should preserve a team's ability to reason and act through Agent resets, personnel changes, interruptions, and evolving intent.

The intended layer split is:

| Layer | Responsibility |
| --- | --- |
| Git | Exact files, snapshots, commit ancestry, branches, merges, and transport. Do not duplicate its version-control machinery. |
| Semantic kernel | The meanings of knowledge, intent-bearing Changes, semantic effects and dependencies, validation obligations, judgments, and acceptance transitions. A small kernel must not become semantically empty plumbing. |
| CodeWiki Hub | Human–Agent proposal, deliberation, delegation, review, scoped acceptance, and shared continuity. Participants need not understand Git staging, refs, or rebasing to use the product. |
| Optional integrations | Editors, Agent harnesses, execution environments, existing Git hosts, and other team tools. They present or execute work without becoming the sole repository of its meaning. |

A general core does not require a universal first release. Do not turn this direction into a combined GitHub/Notion/Jira/Slack replacement backlog, or require a full hosted Hub before proving the semantic loop. Software is a useful test domain, not the definition of the ontology. Operations and research work must be expressible without software-specific primitives.

### Pivot decision 2 — Wiki and Change remain the two primitives

The user proposes a **Change**, carrying intent and expected effects, rather than maintaining a separate desired-state object. The **Wiki** is consolidated project knowledge. A Wiki state is the Wiki at a particular revision, not another top-level entity to manage.

| Primitive | Meaning |
| --- | --- |
| Wiki | What the project currently records as known or adopted, including scoped facts, decisions in force, constraints, procedures, rationale, support, and explicit uncertainty. Historical, hypothetical, and quoted material must retain their distinct roles. |
| Change | Intentional evolution: desired effects, motivation, proposed transformations, alternatives and tradeoffs, assumptions, decisions, execution, observations, validation, and outcome. |

The distinction is motivation versus consolidated consequence, not “facts are allowed but adopted commitments disappear.” A Change may seek safer recovery; the Wiki may retain the adopted rule that recovery requires verified targets, with provenance back to that Change. The motivating debate and pending journey do not need a second independently maintained intent representation in the Wiki. Future participants must nevertheless be able to discover which decisions remain in force without rereading all history.

Intent may initially be fuzzy and may evolve through inquiry. Preserve the original proposal, explicit revisions, and reasons for revision. Do not silently move the acceptance target to fit an implementation. Material intent/scope changes return to Decision under explicit authority; the precise boundary between amending a Change and creating a successor Change remains an open design question, not permission to disregard the current lifecycle contract.

All accepted mutations of the managed knowledge record must be attributable to recorded transitions. This does not mean the external world changes only through CodeWiki. Git captures representations and evidence about reality, not reality itself. Committing a procedure does not prove staff adopted it; merging code does not prove deployment; restoring files does not undo an external action.

An empty Wiki is a possible greenfield initial state, not an assumption about every existing project. With implicit discovery, an existing repository already contains knowledge. Adoption must identify its baseline and uncertainty without inventing earlier intent, retroactive Changes, or semantic validation receipts.

### Pivot decision 3 — preserve grounds for action and revision

Knowledge quality is not document length, elaborate metadata, or a scalar quality score. Consequential knowledge should be clear enough to interpret, challenge, use, and responsibly revise. Useful questions include:

- What is asserted or adopted, and in which scope, conditions, and time?
- Which problem or purpose does it address?
- Why was it accepted, by whom, and with what support?
- Which assumptions and alternatives matter to that judgment?
- What evidence or changed condition would justify reconsideration?
- What other knowledge, commitments, or work depends on it?

These questions are not six mandatory fields on every paragraph. Structure must earn its maintenance cost. Facts, obligations, preferences, procedures, hypotheses, and rationale may require different treatment, but an exhaustive item taxonomy has not been selected. One file can contain assertions with different roles and consequences. A graph of support, assumptions, opposition, and consequences provides different value from a graph of merely related topics.

Preserve concise, attributable public rationale and evidence references rather than every conversational turn or speculative thought. Do not invent plausible historical reasons where records are missing. Losing one supporting assumption calls for reassessment; another independent support may preserve the conclusion. Accepted knowledge must be durable without becoming dogma, and scoped disagreement must not be erased into false organizational consensus.

The three continuation/revision cases are retained as design probes:

1. A Wiki state whose original reasons still hold: retain its supported consequences without redoing settled inquiry unnecessarily.
2. A state whose assumptions later failed: reassess dependent suitability or feasibility, even if its physical realization still exists.
3. A previously rejected state that became appropriate: recover the original rejection conditions and evaluate them against changed intent, conditions, costs, or evidence. Rejection is contextual, not an intrinsic permanent property of a state.

Example: choosing SQLite for an offline, single-user project with low operational burden does not imply that every later collaboration requirement either mandates replacing SQLite or forbids reconsideration. Reassess concurrency/deployment assumptions while retaining still-valid reasons. Similarly, a rejected proposal or failed experiment may leave valuable evidence; promoting a reusable lesson into accepted Wiki knowledge is distinct from declaring the original intent realized.

### Pivot decision 4 — semantic validation is multidimensional and contextual

“Compatible” was rejected as an adequate single definition of validity. Some dimensions concern state descriptions; others concern transitions, their authority, or the quality of their support. The semantic diff must expose changed commitments and consequences, not only changed sentences or touched files.

The validator must distinguish current accepted knowledge, observed realization, and proposed effects. Existing commitments may be deliberately revised under authority; treating every disagreement with the old Wiki as a violation would fossilize it. Conversely, a candidate cannot turn its own proposed waiver into the governing rule used to approve itself.

| Dimension | Question raised by a proposed transition |
| --- | --- |
| Intent fit | Why pursue these effects rather than alternatives, and which tradeoffs serve the expressed intent? |
| Consistency | Can proposed and retained commitments hold together under the same stated scope and conditions? |
| Reachability | Is there a credible admissible path from observed reality to an acceptable realization, with the available means and constraints? |
| Preservation | Which commitments must remain true throughout the transition, not merely at its destination? |
| Justification | Which evidence and assumptions support the proposal, and what consequential uncertainty remains? |
| Authority | Who may approve affected revisions and protected effects? A proposal is not an execution, publication, or policy-change grant. |

These are consolidated semantic distinctions, not a fixed six-Check Pack or an already selected schema. Specific obligations should follow the Change's actual effects, relevant Wiki meaning, and stage. Classification may distinguish knowledge correction, commitment revision, investigation, and implementation effects; those are examples, not a mandatory mutually exclusive enum. An author's chosen label cannot bypass obligations present in the actual delta.

Feedback must distinguish **supported**, **contradicted**, and **unresolved**, with scope, reasons, and evidence. Stale support must be visible. A missing proof is not a counterexample; an open Change accounts for a realization gap but does not make the target realized; a model judgment is not automatically a formal proof. A passing test supports only its tested conditions. An aggregate score must not average away a binding violation.

Desired-state descriptions can still be understood as regions of acceptable realities: intersection expresses joint satisfaction, containment refinement, and union alternatives. Empty intersection indicates contradiction only within an adequate model and shared context. This theoretical lens does not reintroduce a separate State/Intent service or require users to write a formal logic. **Compatible, reachable, and realized remain different claims.**

Transition validation has an inductive structure: establish a baseline and validate preservation of specified invariants at accepted transitions, including joins. It can guarantee faithfully enforced formal invariants, not universal truth of natural-language prose or the absence of unobserved external drift. Historical acceptance remains reconstructible without becoming present-day endorsement.

### Pivot decision 5 — retain the four stage loops

The early suggestion to make Planning optional was rejected. The problem was duplicated policy and prescribed machinery, not the existence of stage-specific reasoning. Keep one semantic foundation with different evaluation contexts and increasing evidence.

| Loop | Purpose and evidence boundary |
| --- | --- |
| Decision | Accept sufficiently clear intent, scope, tradeoffs, and a supported transition hypothesis. Establish credible feasibility, not a completed implementation plan or universal reachability proof. |
| Planning | Make a path concrete: intermediate outcomes, dependencies, shared contracts, obligations, work decomposition, and parallelization. Account for uncertainty that matters to execution. |
| Implementation | Attempt authorized work, collect observations, use cheap feedback, and address discovered constraints or defects. Preserve exact partial subjects and do not overclaim integrated completion. |
| Review | Assess the reconciled whole and its exact artifact/knowledge subject. Check that intent survived recomposition and account for remaining gaps before acceptance. |

Feedback returns to its cause: an artifact defect to Implementation, a bad decomposition to Planning, and changed or incoherent intent to Decision. Investigation can be a valuable Change even before it modifies implementation artifacts. The rules for promoting intermediate knowledge and amending intent remain to be specified.

Planning is semantic decomposition, not only task scheduling. Independent destinations do not prove independent execution: parallel work must not destroy another task's preconditions or shared commitments. For an authentication Change, UI, backend, and observability work can share a no-secret-logging obligation despite touching different files. Separately passing tasks do not establish correctness of their composition.

Efficiency concerns the expected contribution of paths, including information gained, risk reduced, and options preserved. There is no universal semantic distance that every Change must monotonically decrease. Refactoring, investigation, or infrastructure may create useful detours. Distinguish achievement goals at a destination from maintenance/safety goals throughout the path. Efficient execution cannot excuse forbidden effects.

Concentrate expensive assurance at commitment boundaries, retain cheap feedback during work, and enforce authorization before protected effects. Saving a checkpoint, accepting a decision, realizing intent, merging, publishing, and deploying are distinct acts.

### Pivot decision 6 — remove competing project knowledge/policy systems

Project Skills largely package procedural knowledge plus delivery mechanisms. The procedural knowledge belongs in the shared corpus; harness discovery, tool bindings, scripts, and presentation are adapters. Do not require separately maintained project Skills to duplicate Wiki meaning.

Checks and Check Packs are not intended to remain a separately authored project-policy ontology. Verification techniques may still use ordinary tests, CI, source inspection, tools, models, and human judgments. A test is not automatically a CodeWiki Check resource. Preserve useful verification and effect-safety mechanisms without carrying forward custom-Pack authoring/adoption merely because R1 retained them.

This is a real change from the old “empty/custom Check policy” destination. The successor roadmap must replace the old custom-Check failure/repair milestone with an evidenced semantic-feedback/repair loop. It must not simply rename Packs, hide a comparable registry inside an “expressive Wiki,” or treat an empty old Gate as sufficient semantic assurance.

Semantic interpretation remains essential to the kernel contract. Models can propose interpretations, dependency links, counterexamples, and judgments; tools provide observations; the kernel gives these outputs stable meaning and governs their scope, provenance, authority, and transition consequences. Exact internal ownership, inference ports, and assessment persistence still need design. Greater Agent capability supports less prescribed method, not weaker authority or custody boundaries.

### Pivot decision 7 — attention directs consequential inquiry

The transformer analogy is useful for context-dependent activation, not as a literal design for a global truth/authority score. Relative importance is relational: important to which intent, proposed transition, decision, stage, and uncertainty?

Keep separate:

- Relevance: which knowledge matters to this Change?
- Support/confidence: what grounds the claim and how uncertain or stale is it?
- Governing force: which commitments are binding, tradeable, or advisory?
- Revision priority: what should be retained or reconsidered when beliefs conflict?
- Consequence and inquiry value: what further investigation could materially improve the decision, relative to its cost?

A consequential weakly supported assumption may deserve more scrutiny, not less. Distant knowledge can become important through dependencies and effects rather than text similarity. More corpus content must not dilute an applicable binding obligation. Attention is not proof of coverage: unknown relationships or omitted context cannot silently become “irrelevant.” A candidate must not lower its own validation burden by relabeling knowledge or changing discovery rules.

Expected value of information/computation is a research lens for allocating effort, not a calibrated numerical policy already selected for CodeWiki. Avoid a mandatory static `importance` score per item. Preserve reasons for inclusion, dependency uncertainty, and bounded-context omissions. The empirical goal is better decisions and continuity for less unnecessary ceremony, not a larger mandatory metadata system.

### Pivot decision 8 — Git-native checkpoints and optional hosting

Git is the exact-state foundation, not a competitor to reproduce. Git stores snapshots with parent relationships; Change intent alone is insufficient to reconstruct what happened. Preserve exact accepted bytes/deltas and outcomes. Never regenerate historical states by rerunning model reasoning, tests with changed inputs, or external effects. A new parser or model's reinterpretation is not retroactive historical truth.

Research-backed recommendations, not yet hard protocol choices:

- A branch represents an independent line of work, not a stage flag. A reasonable default is one Change branch, an optional associated draft PR, selected stage assessments on its checkpoints, and short-lived worker branches where independent execution needs them. Do not require one branch per stage, exactly four commits, or a new Change for every tool action.
- Let ordinary WIP commits remain cheap. Meaningful checkpoint candidates include handoffs, intent revisions, completed slices, integration points, and immutable assessment subjects. **Checkpointed, assessed, accepted, and realized are not synonyms.**
- The index and commit tree can bind related artifacts, Markdown, and Change records in one exact snapshot. Git's expected-old-OID updates help reject stale baseline advancement. Do not overstate multi-ref transaction guarantees: Git documents that a concurrent reader may observe a subset of updates.
- Linked worktrees separate working directories/indexes while sharing repository mechanisms and many refs. They are not process, credential, network, or adversarial filesystem sandboxes. Do not create another source checkout here to test this product direction.
- Initially prefer preservation of meaningful commit ancestry. Squash/rebase policy remains open. Squash does not retain intermediate commits as separate ancestors on the destination; GitHub rebase-and-merge creates new SHAs and can drop initially empty commits. Empty “stage approved” commits cannot be the only durable semantic record. Do not blindly transfer assessments across rewritten subjects.
- Git notes can annotate objects without changing them, but use separate refs and require deliberate transport/rewrite handling. Durable bounded Change records, evidence references, subject identities, and authority linkage must survive outside a host's UI. Exact storage choice is unresolved; do not add a second event store merely to rediscover Git history.
- Assess the actual integration candidate against its baseline. Independently acceptable branches can conflict semantically when joined. GitHub's merge queues provide a useful pattern but are optional and availability-limited, not kernel infrastructure.

GitHub's documented mechanics were researched as integration patterns, not private server internals or the product's mandatory authority:

- PRs expose mutable discussion/review surfaces and head/simulated-merge refs; the default `pull_request` Actions SHA can be a merge-ref SHA rather than the contributor head. Check Runs attach to a specific commit.
- Merge queues assess the current base plus preceding queued Changes and the incoming PR. Required Actions workflows must handle `merge_group`. Old isolated-head results are not proof about a different combined candidate.
- Branch protections can dismiss stale reviews and pin an expected GitHub App as check source, but bypass settings matter. GitHub may accept `neutral` or `skipped` required-check conclusions; unresolved semantic assurance must not be mapped to those as if positively validated.
- A PR's `merged` flag is not by itself a CodeWiki acceptance receipt; indirect merges can mark a PR merged without its own protection requirements having been satisfied. Local Git hooks are not sufficient enforcement and some are explicitly bypassable.
- Do not run untrusted PR code with privileged credentials via `pull_request_target` or equivalent privileged follow-up paths. Corpus discovery must not execute instructions in incoming documents.
- GitHub Checks can present internal semantic-validator results without reintroducing user-authored CodeWiki Check Packs. GitHub must not be the sole surviving store of intent, judgments, or evidence. Generic Git and non-GitHub operation remain first-class product requirements.

### Pivot decision 9 — implicit Wiki and format interoperability

The agreed destination is that knowledge already present in project files participates without a special Wiki directory or per-document enrollment ceremony. Tracked Markdown should be first-class wherever it lives, including `README.md`, `docs/`, and `notes/`. No mandatory proprietary frontmatter or ID scheme was selected. Other formats can extend the same model without converting everything into duplicated Markdown.

Distinguish corpus discovery, semantic role, and acceptance:

- A committed tree provides an exact historical corpus; modified/new files provide proposed working-state knowledge. Discovering a file must not silently stage, accept, publish, upload, or execute it.
- Follow Git's tracked-file semantics. `.gitignore` governs intentionally untracked files and does not exclude already tracked content. Respect declared repository/vault scope and do not implicitly follow links or symlinks into unrelated private material.
- Equal participation does not mean that archived decisions, quoted examples, deliberately false test fixtures, and proposed Change text all become active governing commitments. In particular, a proposed waiver cannot become policy merely because its Change record is Markdown.
- Path-level exceptions might reuse committed `.gitattributes`; this is a candidate design, not an adopted format. Local/global attributes and other machine configuration must not silently redefine accepted policy or historical interpretation.
- Preserve source bytes, normal editor workflows, and provenance. Use read-only format extraction; do not load MDX imports, scripts, executable plugins, or arbitrary document instructions as a side effect of indexing. Derived indexes and cached Views remain rebuildable, not competing source truth.
- Exact historical identity can use revision and path. Stable identity across renames, passage references, ambiguous link resolution, and optional explicit IDs need deliberate treatment; rename continuity cannot be assumed merely from similar names.

Obsidian interoperability should be structural rather than dependent on installing a plugin: ordinary Markdown in a folder, external edits recognized by the editor, preserved source formatting, standard links and wikilinks, heading/block references, embeds, and optional YAML properties. Vault scope matters to link resolution. Obsidian block references are not standard Markdown. Its workspace layouts and metadata caches are not project knowledge. Supported-format research also identified JSON Canvas, Bases, attachments, PDFs, and media; that inventory is not a promise to implement them all in the first slice.

**Current source-checkout boundary is unchanged.** `.codewiki/wiki/**` is still desired-state design truth, `.codewiki/changes/**` lifecycle truth, and this plan the sole active ledger. Implicit discovery is future product behavior, not permission to treat every Markdown file in this checkout as current governing policy. Keep `.codewiki/kb/**` and `.codewiki/traces/**` absent; no dual reader/writer, auto-migration, or fabricated history is authorized. Existing Wiki envelopes and storage remain until a supported, explicitly sequenced transition is ready.

### Pivot alternatives and corrections to preserve

| Earlier formulation | Consolidated correction and reason |
| --- | --- |
| Make Planning optional to minimize the kernel. | Rejected. Planning preserves meaning through decomposition and enables safe parallelization. Remove duplicated rubrics, not the four loops. |
| Every Wiki statement is true or an open Change makes it acceptable. | Insufficient. Distinguish normative targets, observations, owned gaps, uncertainty, support, and realization. A pending Change is not proof of truth or progress. |
| Wiki is a separately maintained space of intended future states. | Refined. State-space semantics help reasoning, but Change owns pending intent; Wiki records consolidated knowledge and adopted consequences. No extra State primitive. |
| Compatibility is the single validity criterion. | Rejected. Consistency, reachability, intent fit, preservation, justification, and authority answer different questions. |
| Each Change must immediately decrease distance to the target. | Rejected. Inquiry, enabling work, and risk reduction can justify detours; efficiency concerns paths and consequential learning. |
| One permanent weight or attention score represents importance. | Rejected as a sufficient model. Relevance, uncertainty, governing force, revision priority, and consequence must not collapse. |
| Keep custom Check Packs as the final project-policy model. | Superseded as desired product direction. Preserve internal verification techniques without requiring a separate authored policy ontology. Implementation has not yet been changed. |
| Put all heavy validation only at deployment. | Refined. Concentrate assurance at commitments, retain cheap work feedback, and authorize every protected effect. Merge and deployment are distinct. |
| GitHub is the architectural host of acceptance. | Superseded. It is an optional integration and incumbent product comparison; CodeWiki Hub must serve other teams and operate independently. |
| Replay old intent to recreate knowledge state. | Rejected. Reconstruct exact retained snapshots/deltas and outcomes; do not rerun nondeterministic reasoning or effects. |
| Every discovered Markdown passage has equal governing authority. | Rejected. Equal corpus eligibility does not erase semantic roles, proposal status, scope, provenance, or authority. |
| Start over with a new documentation repository or another active plan. | Rejected. Preserve first, then rewrite the existing authoritative Wiki and rebaseline this ledger; retain historical evidence and unique work. |

These corrections should be recoverable after compaction. They are not instructions to delete useful code merely because its original product rationale changed.

### Pivot open decisions — do not silently settle in implementation

| ID | Unresolved question |
| --- | --- |
| P-O1 | What is the smallest useful Change classification and knowledge-role representation? Which distinctions are intrinsic, inferred, explicitly asserted, or needed at passage rather than file level? Avoid a compulsory universal taxonomy. |
| P-O2 | Which claims may an intermediate checkpoint establish or promote? How do provisional discoveries, Decision acceptance, partial realization, and final acceptance coexist without implying completion? |
| P-O3 | When does intent revision amend the current Change versus create a successor? How are approved scope, original reasons, and changed target preserved without moving goalposts? |
| P-O4 | Where do exact Change/checkpoint records and bounded judgment/evidence references live, how are they transported and retained, and how are they bound to immutable subjects without self-referential commit claims? |
| P-O5 | Which branch/join policy is the minimal default, and what guarantees survive squash, rebase, cherry-pick, branch deletion, and native Git commits made outside CodeWiki? Integration strategy and identity/assurance reuse are not yet selected. |
| P-O6 | How does an existing repository adopt its implicit corpus without manufacturing prior intent or retroactive validation? What is considered readable, classified, accepted, supported, or still unknown at baseline? |
| P-O7 | What are the precise corpus scope, format/role overrides, malformed-input behavior, link resolution, rename identity, and privacy rules? Optional `.gitattributes`, frontmatter, and identifiers are candidates, not settled requirements. |
| P-O8 | What is the semantic evaluator's contract, coverage model, evidence threshold, uncertainty handling, disagreement/adjudication path, and relationship to deterministic enforcement? Model/provider independence and assessment-version provenance require design. |
| P-O9 | How is attention allocated and evaluated without losing binding obligations, amplifying unsupported claims, or adding costly metadata ceremony? No global score or quantitative formula has been approved. |
| P-O10 | What collaboration and authority must the Hub own initially, and what stays in existing editors/harnesses/hosts? Preserve scoped team disagreement and portability; do not turn product breadth into a first-release feature mandate. |
| P-O11 | Which current R1 mechanisms, including the parked D4 binding patch, are retained, adapted, replaced, or deferred? Reconcile against actual source/tests before scheduling work; old success or failure counts are not a disposition by themselves. |
| P-O12 | What exact first execution profile, acceptance corpus, quantitative budgets, release subject, and external qualification/controller path can be supported? Historical authority and current-state compatibility gaps remain unresolved. |

### Pivot research trail and evidence limits

These public references preserve the research trail beyond temporary tool-result IDs. They support distinctions and documented mechanics, not a proven CodeWiki architecture or empirical product-performance claim. The hypotheses above remain ours. Some papers were available only as indexed abstracts or secondary descriptions; those limitations must not become claims of full primary-source verification.

| Topic | Sources and bounded finding |
| --- | --- |
| Inquiry and evolving intent | [Stanford Encyclopedia: John Dewey](https://plato.stanford.edu/entries/dewey/). The inspected inquiry account includes problem formulation, hypotheses, reasoning, testing, and return to earlier phases. It motivates preserving uncertainty and evolving purpose; it is not a mandatory software workflow or proof of product effectiveness. |
| Belief revision, entrenchment, possible worlds, belief bases | [Stanford Encyclopedia: Logic of Belief Revision](https://plato.stanford.edu/entries/logic-belief-revision/), especially §§2.2, 4, 5, and 9.1. Identical conclusions can have different bases and revision behavior; consistency is distinct from learning truth. Logical closure/omniscience are idealizations, not capabilities promised for natural-language Wiki validation. |
| Truth maintenance | [Doyle, A Truth Maintenance System](https://www.sciencedirect.com/science/article/pii/0004370279900080) and the SEP history above. Recording reasons and dependencies supports explanation/revision. Direct primary-page retrieval failed; the initial pass used indexed abstract material and SEP context, not a fully inspected implementation. |
| Questions, alternatives, arguments | [Kunz/Rittel source record](https://escholarship.org/uc/item/5cj786v8) and [readable IBIS overview with original references](https://en.wikipedia.org/wiki/Issue-based_information_system). The primary PDF/page was blocked; the readable secondary account establishes the issue/position/support-or-opposition structure. Retain why-not and rejection conditions rather than only conclusions. |
| Extended cognition | [Clark and Chalmers, The Extended Mind](https://consc.net/papers/extended.html). External artifacts can be part of a reliably coupled reasoning process in the authors' philosophical account. This is a design lens, not a claim that a Wiki is conscious or that this architecture is empirically validated. |
| Contextual attention | [Vaswani et al., Attention Is All You Need, §3.2](https://arxiv.org/html/1706.03762v7#S3.SS2). Query/key compatibility weights value combination; multiple heads attend across representation subspaces. This does not supply a project's truth, authority, or calibrated importance metric. |
| Attention and explanations | [Jain and Wallace](https://aclanthology.org/N19-1357/) and [Wiegreffe and Pinter's response](https://aclanthology.org/D19-1002/). The inspected abstracts disagree about assumptions and conditions under which attention explains predictions. Do not generalize one study into “attention never explains” or use weights alone as decision rationale. |
| Value of computation | [Russell and Wefald, Principles of Metareasoning](https://www.sciencedirect.com/science/article/pii/000437029190015C). Indexed abstract material relates computational utility to its effect on external action; full text was not retrieved. Use as a research lead for inquiry allocation, not an already implemented scheduler or numeric policy. |
| Goal-oriented requirements | [van Lamsweerde, Goal-Oriented Requirements Engineering: A Guided Tour](https://ieeexplore.ieee.org/document/948567). Initial search/abstract review covered goal elaboration, refinement, and reasoning; the linked PDF could not be fetched because of certificate failure. Full primary reading remains optional follow-up, not an imported framework requirement. |
| Planning states, actions, and goals | [Poole and Mackworth, §6.1](https://artint.info/3e/html/ArtInt3e.Ch6.S1.html). Preconditions/effects and achievement, maintenance, transient, and resource goals clarify state/path distinctions. The chapter's deterministic setting does not establish real-project reachability under uncertainty. |
| Compositional transition reasoning | [Software Foundations: Hoare Logic](https://softwarefoundations.cis.upenn.edu/plf-current/Hoare.html). Preconditions/postconditions and invariants support composition; partial correctness does not establish termination. Do not mistake a model's postcondition argument for operational success. |
| Exact history and replay | [Git's snapshot model](https://git-scm.com/book/en/v2/Getting-Started-What-is-Git%3F), [Git objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects), and [Fowler: Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html). Preserve exact states and causal records. Fowler's draft also describes external-query/effect and code-version problems in replay; no custom event store is mandated. |
| Git workspaces, refs, annotations, and hooks | [Worktrees](https://git-scm.com/docs/git-worktree), [update-ref](https://git-scm.com/docs/git-update-ref), [notes](https://git-scm.com/docs/git-notes), and [hooks](https://git-scm.com/docs/githooks). Shared/per-worktree state, expected-old-OID updates, separate note refs/rewrite policy, and bypassable hooks constrain implementation claims. |
| Native corpus/configuration mechanics | [gitignore](https://git-scm.com/docs/gitignore), [ls-files](https://git-scm.com/docs/git-ls-files), [gitattributes](https://git-scm.com/docs/gitattributes), and [check-attr](https://git-scm.com/docs/git-check-attr). Tracked files are not excluded by ignore rules; attributes can be path-scoped and inspected against a tree, but configuration precedence must be controlled for reproducible interpretation. |
| GitHub collaboration and exact subjects | [Pull requests](https://docs.github.com/en/pull-requests/reference/pull-requests), [Check Runs](https://docs.github.com/en/rest/checks/runs), and [workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). Publicly documented refs, commit-bound results, merge-group triggers, and privileged-trigger warnings were inspected. No private internals were claimed. |
| GitHub integration acceptance and history | [Merge queues](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches), and [merge strategies](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges). Combined candidates, plan/ownership availability, bypasses, stale reviews, expected check source, neutral/skipped outcomes, rewritten identities, dropped empty commits, and indirect merges all limit what a host status proves. |
| Obsidian storage and syntax | Official source docs: [storage](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Files%20and%20folders/How%20Obsidian%20stores%20data.md), [links](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Linking%20notes%20and%20files/Internal%20links.md), [properties](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Editing%20and%20formatting/Properties.md), and [formats](https://raw.githubusercontent.com/obsidianmd/obsidian-help/master/en/Files%20and%20folders/Accepted%20file%20formats.md). Hosted help extraction failed, so the readable official repository sources were used. Ordinary Markdown files, optional YAML, vault-local links, Obsidian-specific blocks, attachments, and non-source caches inform interoperability. |

### Pivot documentation reconciliation and successor sequencing

The maintainer chose **fresh conceptual prose in the existing authoritative locations**, not another Wiki, `PLAN_V2.md`, duplicate skill collection, or empty-history restart. Preserve this record before reorganizing. Do not attempt to compact the discussion merely into a slogan and then infer its missing decisions later.

The approved documentation sequence is:

1. **Preserve and verify this record.** Capture decisions, corrections, sources, open choices, paused-work identity, and continuation instructions. Verify that pre-existing work and historical ledger content are unchanged except the old entry-point heading. Record actual documentation validation; do not run or claim source tests for this pass.
2. **Use native Pi compaction.** Compaction is not implemented by CodeWiki tools in this checkout. This pass does not claim that compaction has already occurred. The saved record must make the next step independent of conversation memory.
3. **Rewrite the conceptual core of the existing Wiki coherently.** Begin with [product](.codewiki/wiki/items/product/codewiki-console.md), [kernel](.codewiki/wiki/items/system/components/semantic-kernel.md), [Wiki](.codewiki/wiki/items/system/components/wiki.md), [Change/Trace](.codewiki/wiki/items/system/components/change-trace.md), [Checks](.codewiki/wiki/items/system/components/checks.md), [alignment](.codewiki/wiki/items/system/components/alignment.md), the [lifecycle flow](.codewiki/wiki/items/system/flows/change-lifecycle.md), and [Decision](.codewiki/wiki/items/system/components/decision.md), [Planning](.codewiki/wiki/items/system/components/planning.md), [Implementation](.codewiki/wiki/items/system/components/implementation.md), and [Review](.codewiki/wiki/items/system/components/review.md). Inspect dependent stories, diagrams, ownership, and [Project](.codewiki/wiki/items/system/components/project.md)/[Project Server](.codewiki/wiki/items/system/components/project-server.md)/[client protocol](.codewiki/wiki/items/system/components/client-project-server-protocol.md) contracts. Remove contradictory desired-state narratives without erasing useful invariants, unique edits, or historical records. Retain current supported envelopes/storage until their transition is explicitly planned.
4. **Rebaseline this single plan against actual source and tests.** Classify mechanisms as retain/adapt/replace/defer, identify every gap before source changes, and publish one ordered bounded implementation/acceptance queue. Explicitly supersede old custom-Check and special-directory goals where appropriate; do not mark unfinished work implemented or delete it solely because the architecture changed. Keep completed R1 and historical release evidence honest. Review README/AGENTS orientation for consistency while preserving all source-checkout and protected-effect restrictions.
5. **Review documentation coherence and the proposed next slice.** Separate agreed behavior from unresolved design hypotheses. Keep current-work instructions short and unambiguous, with evidence/provenance references rather than competing active queues. The source implementation remains paused until its mapping and bounded successor scope are established; ordinary native development can then proceed within the approved scope without per-edit release bureaucracy.

No historical plan or governed lifecycle record is rewritten by this preservation pass. No package version, release artifact, source API, file layout, reader, writer, policy, or runtime authority is changed here.

### Pivot first dogfood milestone — outcome to specify, not qualification claimed

The first slice should prove a small complete knowledge/Change loop, not every Hub feature or format. Its detailed executable profile and numeric budgets remain P-O12. Required scenario design should include:

- An existing Markdown corpus discovered without a special import workflow, with an honest baseline and preserved source files.
- A human/Agent intent-bearing Change whose actual semantic effects determine relevant validation obligations.
- A meaningful contradiction or consequential unsupported assumption surfaced by the semantic validator, followed by evidence gathering or repair routed to the appropriate retained stage loop. This replaces the old requirement to author a custom Check Pack as the product's defining proof; it does not replace real operational evidence with mocked “semantic” success.
- Planning that demonstrates dependency-aware decomposition and at least a bounded parallel-work/join case, with integrated rather than isolated-head assessment.
- Exact intermediate subjects and a reconciled outcome whose accepted knowledge, realization claims, and remaining uncertainty are distinguishable.
- A restart/fresh-Agent continuation using only durable authorized records: what is known, why, what was rejected, which assumptions are unresolved, which work is in flight, and what action is next permitted. Missing/redacted/truncated context must remain explicit.
- The three reason-preservation/revision cases above, including a formerly rejected approach that becomes appropriate under changed conditions. Compare minimal explicit support/dependency structure against a well-written prose/Git baseline rather than assuming more metadata improves performance.
- One non-software scenario, such as reducing customer onboarding time while preserving required controls. Its plan may involve procedures, training, tooling, and measurement; committing documents alone cannot stand in for evidence of real adoption or improvement.
- Declared supported environments and frozen resource/latency/token/cost/retry budgets before qualification. Measure consequential omissions, false acceptance, unnecessary rejection, context loss, repeated effects, and human interventions. No numerical threshold or improvement claim was established by the brainstorm.

Pack and test candidate bytes only in disposable external projects with isolated Pi settings. Resolve actual qualification/controller authority and any historical-state incompatibility; do not fabricate it from old receipts. Freeze an exact committed candidate with a unique package version and replacement guidance. Post-freeze corrections require a new subject and qualification. Activation alone does not transfer controller authority; any required handoff must be explicit. Candidate N+1 never governs itself, and this source checkout must never load its mutable CodeWiki code or call CodeWiki `wiki_*` tools or `/wiki-*` commands. No project-local package links, duplicate skills, executable Plugin paths, or controller pins are authorized. Higher-priority source-checkout restrictions do not sunset with bootstrap procedure.

### Pivot continuation after compaction

A fresh coordinator should:

1. Read `AGENTS.md` and this entire pivot section first, then verify branch, exact HEAD, index, worktree, and configured remote. Distinguish the capture-start source baseline from any subsequent documentation-only commit. Do not reset or move canonical refs to match a remembered OID.
2. Confirm that the three partial D4 files, existing Project Wiki edit, user settings, and original outputs remain preserved. Use the private preservation manifest and the D4 failure records if reconciliation is needed. Do not retry that lane, change providers, or treat its partial tests as passing.
3. Continue the already approved documentation sequence at the coordinated core-Wiki rewrite and successor-plan rebaseline. Read exact existing bodies before replacing them; inspect the rest of this ledger only for applicable audit/evidence/retention details, not as an independent active queue.
4. Keep settled decisions, research-based recommendations, and P-O1–P-O12 visibly distinct. Resolve implementation-critical ambiguity rather than silently selecting a schema or restoring predecessor assumptions. Preserve the research sources and why the rejected approaches were rejected.
5. Stop before unscheduled source work, state migration, credential/paid-model use, package activation, controller handoff, push, or canonical-ref movement. These are not consequences of having completed a documentation checkpoint.

**Cold-start acceptance test for this record:** a reader without the chat must explain why intent moved into Change, why the four loops remain, why implicit Markdown does not mean equal authority, why Git is the substrate but GitHub optional, how rationale survives changing assumptions, what is unresolved, and why D4 must not resume automatically.

**Preservation validation:** the native Markdown dispatch and explicit primary Marksman LSP check reported clean; session-wide pi-lens diagnostics reported no issues in the one edited file. A native preservation review verified all 14 new local documentation links, the nine decision sections, P-O1–P-O12, and the frozen D2 test digest. Exact byte comparison confirmed the entire pre-pivot ledger body unchanged beneath its renamed entry-point heading. All 193 other tracked/output paths matched the capture manifest, including file bytes/modes and applicable symlink targets; branch, HEAD, refs, and the empty index were unchanged at this pre-checkpoint review. `git diff --check -- SEMANTIC_KERNEL_PLAN.md` passed. Review evidence is `preservation-review.json` in the private preservation directory above. No source tests, builds, semantic qualification, or native compaction have been run by this preservation pass.

**Documentation checkpoint scope:** only `SEMANTIC_KERNEL_PLAN.md`, including its preserved pre-existing D4/coordinator record, belongs in the preservation checkpoint. The partial implementation, existing Project Wiki edit, user settings, and outputs remain unstaged and unaccepted. Any resulting documentation commit changes the audit branch HEAD only; it is not source integration, canonical-ref reconciliation, or release/controller evidence. Its exact identity and final preservation comparison belong in the external checkpoint record and Git history rather than a self-referential commit claim.

## Workspace reconciliation and baseline audit — pre-pivot entry point

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

### Coordinator escalation for delegated slices

Workers escalate any blocker they cannot resolve to the coordinator through the native supervisor channel (`contact_supervisor`, `reason: need_decision`). The coordinator owns resolving requirements, architecture, scope, validation, and integration problems; routine worker blockers do not require another maintainer decision. The escalation includes the exact failure, relevant paths/lines, attempted approaches, current diff/test state, and the smallest decision or intervention needed. Workers must not keep guessing, widen scope, weaken acceptance, or substitute another execution mode.

Before the coordinator edits a worker-owned file, the worker must explicitly pause writes and hand over the current state; ownership returns explicitly before the worker resumes. Small coordinator fixes remain mapped to the active slice and receive normal review/validation. Infrastructure failures retain the stop/report/preserve-state rule and may recover only through an explicit same-protocol action; escalation is not permission for a silent provider/runner/foreground fallback. The coordinator brings back to the maintainer only decisions requiring maintainer authority, not ordinary implementation difficulty.

### R1-2 parallel delegation — CLI preflight slice D1

The maintainer requested coordinator/worker development in two sessions. The coordinator owns Wiki, requirements, scope, architecture, integration, and reviewed checkpoints. Worker D1 owns only `bin/codewiki.mjs` and new `tests/api/client/cli-command.test.mjs`: strict command/flag/positional validation before runtime import or composition, positional relative-root handling, and removal of speculative re-bootstrap recovery advice. Existing supported successful output and exit semantics remain. This is AUDIT-15 work, not a new CLI command surface, initialization implementation, or Git compatibility adapter.

D1 grammar: `status|changes|checks [root]`; `change <changeId> [root]`; `trace [--json] <changeId> [root]`. No arguments, `--help`, or `-h` alone show help. Unknown verbs/flags, repeated or misplaced `--json`, absent required IDs, and extra positionals return a bounded sanitized usage error before loading runtime. `--json` is accepted once for `trace`, before its positional operands. Root selection is positional, never inferred from slashes; omitted root means current directory and bare relative roots resolve against it. ID semantics remain the API's responsibility; preflight enforces presence and shape of the CLI invocation without inventing another ID decoder. No new `init`, `--root`, passthrough, or compatibility syntax is included.

Both sessions share one checkout with disjoint write ownership. D1 must not stage, commit, reset, stash, change branches/refs, build or clean shared `dist`, install dependencies, edit other files, or claim broader validation. Its focused tests may use a disposable copy of the actual bin and an explicitly stubbed runtime module to observe whether import/composition occurred, root selection, and existing output dispatch; these are CLI boundary tests, not Server/extension/executor qualification. The coordinator registers the new test and bin ownership, handles separate Server-composition changes, and runs integration after worker handoff. Neither session runs builds, full suites, or Git mutations while the worker is editing. Unexpected overlapping edits or a dependency outside the two-file boundary stop D1 for coordination. Existing unrelated `outputs/` and all protected state remain untouched.

#### D1 coordinator review — revision required

The first worker submission remains uncommitted and is not accepted for integration. Coordinator reproduction passed its 23 tests and primary LSP found no errors in either assigned file. Independent disposable CLI probes at `~/.local/state/codewiki/evidence/r1-d1-review-KLUi4qjo/` nevertheless found three acceptance gaps:

1. Empty-string Change IDs and an explicitly empty root reach runtime import/composition. An omitted root and an explicitly empty operand are not equivalent. Preflight must reject empty operands without introducing semantic ID decoding.
2. Unknown argument diagnostics echo arbitrarily long inputs: a 20,000-character verb or option produced over 20 KB of stderr. Preflight errors need a concrete output bound; this slice uses at most 2,048 UTF-8 bytes including usage. Prefer fixed category messages without user-input echo rather than another sanitizer or silent argument truncation.
3. The submitted stub records only composition and dispatch, so an empty log does not establish absence of runtime import. Add a top-level import marker and demonstrate the tests reject an early-import mutation in a disposable bin copy. Positive dispatch expectations must include the import event.

Worker revision D1-R1 retains exclusive ownership of the same two files. Preserve the existing successful dispatch/recovery corrections; simplify duplicate sanitization by using fixed preflight errors and the existing runtime sanitizer after the validated import. Add regression cases for empty IDs/roots, long and control-bearing invalid arguments, and independently observed import timing. No integration allowlists, ownership changes, builds, full-suite runs, or Git mutations occur until the revised handoff is reviewed. Source compatibility, physical read-only composition, and operational qualification remain separate R1-2/R1-3 obligations.

#### D1-R1 integration scope

The revised worker has stopped. Coordinator integration resumes exclusive ownership of the checkout. Register `tests/api/client/cli-command.test.mjs` in the frozen test inventory (the existing npm glob already discovers it), enumerate `bin/**` and manifest-declared executable paths in architecture coverage, and bind the bin's literal runtime import to the curated package entrypoint without relaxing the source-module dynamic-loader ban. AUDIT-12 is addressed by adding exactly `bin/codewiki.mjs` to the native Clients ownership declaration; its identity, body, legacy attributes, relationships, and all other envelopes remain unchanged. This is a separately justified native metadata edit, not a donor-envelope transplant. Minor fixture formatting/comment corrections and a direct negative-control assertion are coordinator review changes. The delivered CLI implementation is otherwise retained pending verification. Removing implicit Server bootstrap remains separate work; D1 does not establish that valid reads are physically non-mutating.

#### D1-R1 accepted native integration

Coordinator reproduction passed **88 focused CLI/architecture tests** and then **291 full-suite tests**, zero failures/skips, with typecheck/build passing; the full suite took approximately 159.39 seconds. Evidence is outside Git at `~/.local/state/codewiki/evidence/r1-d1-integration-iU3NO3vw/`; the `r1-d1-integration-current-path` pointer is convenience only. The three first-review gaps are closed: empty operands are rejected before import, preflight errors are fixed bounded text, and a top-level import marker plus a disposable early-import mutant verifies observation sensitivity. The bin reuses the existing exported runtime sanitizer; its test stand-in does not qualify actual terminal sanitization. Coordinator changes register the test and native bin owner, cover the physical bin directory and package manifest, retain the strict source dynamic-loader ban, correct one fixture comment/indent, and assert rejection of the negative control. The worker's unavailable analyzer descriptions are not CVE evidence; no vulnerability clearance is claimed.

D1 and the missing bin-ownership part of AUDIT-12 are complete as native implementation. AUDIT-15 remains partial because valid reads can still reach implicit bootstrap; current memory facts, Build identity substitution, and other R1-2 gaps remain. This is not a release, activated controller, or operational executor qualification.

#### R1-2 next delegation — read-purity regression slice D2

Worker D2 owns only new `tests/adapters/git/local-read-purity.test.mjs`. It authors real-source, disposable-project regression tests for composition/read filesystem purity, not the composition fix. Coordinator retains `src/adapters/git/local-server.ts`, existing adapter/bin fixtures, Wiki, plan, architecture registration, and integration. Import source directly; do not depend on or modify shared `dist`. No builds, full-suite runs, installations, Git mutations in this checkout, or additional file edits are delegated.

Test the declared read-only boundary over fresh Git-only roots, explicitly initialized/committed CodeWiki projects, and committed malformed or partial semantic state. Snapshot exact path sets, file bytes/modes, and symlink targets before and after composition and subsequent bounded Client reads when binding succeeds. Include `.git` and `.codewiki`; do not follow symlinks or ignore new object/ref/index/lock paths. Ignore atime/mtime only; inspection itself must not call Git commands that can refresh the index. Validate legitimate initialized reads; degraded cases test absence of writes, not assumed readiness or success. Expected failures against current implicit bootstrap are useful red evidence and must not be skipped, weakened, or repaired by the worker. Coordinator will implement the fix and evaluate semantic error behavior separately after test handoff. Preserve the same single-checkout, no-staging/commit/ref-change boundary; fixture Git operations are permitted only inside disposable external projects.

#### D2 first review — harness revision required

The first native subagent workflow `49eb5d9a-42a5-43a3-9306-e0cc9556488f` completed with child `617faeb5-125d-49ab-ae04-0f680c815f75`; its durable report is an external subagent artifact. The launched run reported `medium`; it was not retroactively changed when the maintainer requested maximum effort. Fresh `dev`/`worker` launches now use the catalog-supported `max` setting; provider version behind the latest alias remains separate from that effort selection. User Pi configuration is kept separate from source checkpoint evidence.

Coordinator LSP found no error in the delivered test. With fixture Git hooks/global configuration explicitly disabled in the coordinator test process, reproduction produced **4 passed, 1 expected failure**, no skips (~7.47 seconds). The expected failure identifies six `.codewiki` paths created by implicit bootstrap, confirming the targeted read-purity gap without altering production. Evidence: `~/.local/state/codewiki/evidence/r1-d2-review-DQFS1XmG/`.

Two harness blockers were independently reproduced against test SHA-256 `4777782625a5e66f51a700f5e165a74079941a9829b626e0f933f0832ca39cf5`: changing the fixture root mode from 0700 to 0710 was invisible because the snapshot omitted the root; and a harmless fixture post-commit hook still executed through the delivered commit helper because `--no-verify` does not disable all hooks. No user hooks were exercised by these probes. D2-R1 must record root metadata, add a root-mode negative control, and isolate every fixture Git invocation from hooks/signing, inherited Git target/config overrides, and ambient default object format. Unsupported filesystem node kinds must fail the observation rather than collapse into an indistinguishable generic entry. The desired purity tests remain red until coordinator implementation; these fixes may not bootstrap the Git-only case or weaken its assertion.

D2-R1 remains a one-file test-only worker revision with a fresh context at `max`. Coordinator retains production, existing fixtures, architecture registration, Wiki, and final review. No build, full-suite run, staged checkpoint, live migration, or source behavior change is included in this revision.

#### D2 accepted as red regression evidence; D3 next

D2-R1 writer workflow `8f768a28-ac96-4635-9d94-1796d124d15f` failed with generic `Provider finish_reason: error` after producing revised test bytes. Partial state, exact branch/HEAD/refs, tracked diff, and the untracked test were preserved at `~/.local/state/codewiki/evidence/r1-d2-provider-failure-x3c7r644/`. The failed receipt advertised resumability, but the parent `children.list` exposed no retained child; that distinction—not universal non-resumability—motivated one fresh same-protocol report-only retry. Recovery workflow `65e078be-91e7-4c90-98da-822dd1cc7111`, child `bcb24dfc-4a07-4896-9877-36c877d3d4a2`, completed at `max` without changing implementation bytes. No execution-mode/model fallback was used. Cleanup of the failed run's unverified private scratch remains unknown; it was not blindly deleted.

Coordinator review accepted test SHA-256 `0f2fa76f732c4d3cdf8aa9f3c2d92c8176201bace00eb25648ce82e4ce9d661b`: root metadata and negative control are present, fixture Git scrubs inherited overrides and disables hooks/signing/auto-GC, and unsupported filesystem node kinds fail observation. Independent normal-environment reproduction yielded **6 passes and exactly 1 expected red**, for the same six implicit-bootstrap paths. Primary LSP found no errors; after registering the test, **62 architecture tests passed**. Evidence: `~/.local/state/codewiki/evidence/r1-d2-accepted-7XXOyBSV/`. These are final-state filesystem snapshots, not transient-write, uid/gid/xattr, or physical containment proof. D2 test delivery is complete; no green implementation checkpoint or qualification is claimed yet.

**D3 — bounded read-only composition implementation.** The coordinator owns these decisions and delegates their mechanical implementation to one `dev` worker at `max`, exclusively in `src/adapters/git/local-server.ts`, `tests/adapters/git/local-server.test.mjs`, and `tests/adapters/git/codewiki-bin.test.mjs`:

- Composition never bootstraps, copies, repairs, deletes, or rewrites semantic state. Remove its bootstrap import/call, error-message helper, and unreachable `bootstrap_failed` issue variant. Explicit `bootstrapCodewikiProject` remains unchanged as the separate initialization operation; add no new CLI command or auto-init option.
- Removing bootstrap must not remove its root safety preflight: use read-only `lstat` checks to require an existing non-symbolic directory root and a non-symbolic `.git` directory or regular file at that root. Missing/non-Git roots, nested directories without their own `.git`, symbolic roots or Git-state entries, and filesystem inspection failures return `invalid_project_root`. In particular, a nested path lacking its own `.git` must not fall through to ancestor discovery. Preserve Git Store validation after preflight. Do not claim these point-in-time checks establish physical custody.
- A valid Git-only root may bind read interfaces without creating `.codewiki`. Binding availability is not semantic readiness: canonical queries retain existing exact-source validation and typed errors for missing/malformed state. Do not synthesize a ready Project, empty policy, genesis, or successful query to satisfy tests. Existing/uncommitted `.codewiki` and staging leftovers are neither normalized nor consulted as an initialization trigger. `projectName` is a display-name input governed by the existing Server binding validator, not an instruction to serialize bootstrap configuration; introduce no competing name decoder.
- Preserve protocol IDs, read-only grants, unavailable executor ports, exact source/CAS/authorization mechanisms, repository identity, and existing successful CLI output/exit behavior. Correct the composition comment: authorization denies mutations; unavailable executors alone cannot supply that guarantee. Strengthen the existing mutation test with a well-formed request that yields `authorization_denied`, not acceptance of `invalid_request` as equivalent evidence.
- Fixture initialization must be explicit before composition/commits. Keep fixture Git operations isolated from hooks/signing and use deterministic SHA-1/main fixtures. Add root-preflight regressions in the existing local-server test. The accepted D2 purity test is frozen: it must become **7/7 green unchanged**. Coordinator owns its inventory entry, README/ledger, full build/integration, and final review. Worker may run source-focused tests/typecheck, but no shared `dist` writes, build, full suite, staging, commits, or wider file edits.

The existing `detectObjectFormat` helper reads ambient Git configuration and falls back to SHA-1 on every error. That is a separately recorded R1-2 identity/fail-closed gap, along with Product-policy-as-Kernel-Build and memory-only facts; D3 must not claim those resolved or silently broaden into that refactor. If D3 cannot meet the bounded behavior without changing another contract, the worker must ask rather than widen scope.

#### D2/D3 native integration — verified

D3 workflow `8ad0bfae-6de4-49d8-948c-97ecd6110cd5`, child `3a0ab967-b54a-441b-895b-db9773f7e03f`, completed at `max` within its three-file boundary. Coordinator reviewed the production/fixture diff and independently ran a fresh **typecheck, build, and 302-test full suite: all passed, zero failures/skips**, approximately **213.11 seconds**. The delivered D2 test remains byte-identical at SHA-256 `0f2fa76f732c4d3cdf8aa9f3c2d92c8176201bace00eb25648ce82e4ce9d661b` and is **7/7 green**. Fresh-dist bin tests are covered by this full run, not the worker's parse-only check. Primary LSP found no errors in the changed production/test files. Evidence: `~/.local/state/codewiki/evidence/r1-d3-integration-sWg9CHbk/`, including workflow reports/receipts and preservation/checkpoint records.

Accepted behavior: local read composition no longer imports or invokes bootstrap and cannot implicitly seed/repair semantic state; read-only root inspection retains the former bootstrap preflight guards; valid Git-only roots bind without creating `.codewiki`; legitimate fixtures initialize explicitly; and a contract-valid mutation is denied with `authorization_denied`, leaving the canonical head unchanged. The old mutation test only measured client-side malformed-input rejection; its strengthened assertion now measures Server authorization. README distinguishes explicit initialization, read binding, and operational readiness. No desired Wiki behavior or envelope change was necessary for this implementation.

Evidence limits remain explicit: root/symlink rejection tests include typed failures and path-list checks, while the accepted D2 scenarios compare complete recorded filesystem snapshots. Neither proves absence of transient writes or physical custody. Empty/absent Wiki can still project as current empty state; binding/status is not evidence of resolved policy or operational qualification. Object-format guessing/fallback, genuine Kernel Build identity, fact-aware/durable read projections, and Server-to-adapter layering remain R1-2 or R1-4 gaps. D1, D2, and D3 are complete as bounded native slices; R1-2 as a whole remains open. The provider failure/recovery history above is retained rather than rewritten as an uninterrupted successful run.

Source checkpoint scope excludes the user's Pi/subagent configuration, including the separately requested `max` worker effort. All Wiki bytes, five historical Traces, archives, project config/Check lock, dependency lock, and original outputs remain preserved. No push, canonical-ref movement, live conversion, CodeWiki Model Check, release freeze, or activation is implied by this native integration.

### D4 — one verified Git storage binding

**Status:** blocked after the bounded recovery failed with OpenRouter HTTP 402. Three owned files contain preserved, unaccepted partial work. The oversized model output ceiling has a documented configuration correction; effective request-cap verification, implementation completion, fresh review, and acceptance remain pending. No further worker launch has occurred. This is the next bounded R1-2 slice, not completion of repository identity policy or operational qualification. Baseline is `53b17a023beeb8edde48b7cf488dcdfe95639e7a` on `audit/clean-baseline` in `/home/canina7/Projects/codewiki`; the selected audit ancestry remains `7fe04257d2a18d5d16130c45f5919e49bb84f92d`. Baseline source passed the D2/D3 302-test native integration. Current planning observations use Node `24.14.0` and Git `2.55.0`; they do not retrospectively qualify another toolchain.

#### D4 first launch — infrastructure failure, no implementation delta

Workflow `a310e596-ef04-4ee9-b4b7-b596d4cb738f`, child `a1a609a1-0e68-4de2-b5c4-8e199caecef2` (`dev`, fresh context, `max`), failed with exactly `JSON error injected into SSE stream`; no more specific provider/root cause was reported. The child performed read-only exploration and baseline checks; its transcript contains no edits or test execution. Coordinator comparison against the saved launch manifest confirmed all four owned files, every other tracked file, original outputs, and Git refs unchanged, with nothing staged, at the same branch/HEAD and sole checkout. Review never launched. Evidence: `~/.local/state/codewiki/evidence/r1-d4-stream-failure-n_oh_jui/` (receipt/status, child transcript/partial output, tracked diff, refs, and failure record). The receipt advertises resumability, but the current parent `children.list` exposes no retained child; a later retry must validate an available continuation or be explicitly labelled fresh same-protocol recovery. No automatic retry, model/executor fallback, implementation acceptance, or new test success is claimed. The coordinator's subsequent ledger-status edit is separate from the unchanged worker subject.

#### D4 bounded recovery and escalation

Following the maintainer's instruction that unresolved worker issues return to the coordinator, the coordinator will run one fresh same-role/model/protocol recovery attempt, not a claimed resume of an unavailable retained child. The saved four-file baseline, desired contracts, D4-T1–T6 matrix, ownership restrictions, and final review remain unchanged. Workers use the coordinator-escalation rule above rather than independently resolving wider contracts. If the same infrastructure failure recurs, preserve partial state and investigate the subagent/provider path; do not enter an automatic retry loop or substitute an executor. Recovery launch and result evidence remain external until a result is recorded here.

#### D4 recovery result — credit reservation failure and partial patch

Recovery workflow `309a4d4d-f9f7-4d61-95c3-701cc5855c46`, child `becffc0e-6bb1-4b30-8315-90c624793c5f`, failed with OpenRouter HTTP **402**, reporting a requested maximum of approximately **845,665 tokens** beyond the account's available credit authorization. This is a requested ceiling, not actual token consumption; it does not establish the cause of the earlier generic SSE failure. Review did not launch. At the same sole checkout, branch, and HEAD, the coordinator preserved changed `src/adapters/git/project-store.ts`, `src/adapters/git/local-server.ts`, and `tests/adapters/git/project-store.test.mjs`; the fourth owned file is unchanged. All other tracked bytes, the original outputs, and refs matched the recovery input; nothing was staged. Evidence: `~/.local/state/codewiki/evidence/r1-d4-credit-failure-43v899hg/`, including exact partial bytes, diffs, receipt/status, child transcript, and failure record.

The worker ran focused validation attempts, but its latest output still showed fixture setup failures (`spawn git ENOENT`) before a final edit adding missing fixture-root creation. No post-final-edit validation or completed handoff is recorded. Several commands piped tests through `tail`/`grep` without preserving the test process exit status; those wrapper exits are not success evidence. Repeated narrow probes and fixed-name `/tmp` scratch also need handoff review; scratch ownership/cleanup is not inferred or blindly repaired. No D4 acceptance result is claimed.

Read-only configuration investigation found the GLM Latest catalog entry with context window **1,048,576** and `maxTokens: 943718`. The largest reported single-response output in this child transcript was **30,289** tokens. Following the documented Pi per-model override mechanism, the coordinator created external `~/.pi/agent/models.json` with only `openrouter` → `modelOverrides` → `~z-ai/glm-latest` → `maxTokens: 65536`. This is a global Pi override for that one alias, outside Project Git; it does not change credentials, provider routing, account spending limits, context-window metadata, or the requested `max` thinking level. Native subagent metadata still resolves `dev` to the same alias at `max`. JSON and documented field shape are verified; the effective provider request ceiling has not yet been observed after a model-runtime refresh. Verify that cap before further paid worker execution, then reconcile the saved partial patch rather than restarting from a fictitious clean implementation baseline. No automatic retry loop or alternate executor was used; current parent retention exposes no child to resume.

#### D4 context and desired contracts

Read `AGENTS.md`, this complete D4 section, and these Wiki Items by stable identity and current path:

| Desired owner | Required reading | D4 obligation |
| --- | --- | --- |
| `cw:component:project` | [Project](.codewiki/wiki/items/system/components/project.md), especially **Git Project Store / Repository binding** | Actual root and storage format, one shared binding, passive opening, supported Git-file layouts, isolated bounded effects. |
| `cw:component:semantic-kernel` | [Semantic Kernel](.codewiki/wiki/items/system/components/semantic-kernel.md), **Dependency boundary / Determinism and bounds** | Effects remain in the adapter; missing or ambiguous observation never becomes an inferred successful value. |
| `cw:component:project-server` | [Project Server](.codewiki/wiki/items/system/components/project-server.md), **Work and Git / Recovery and queries** | Exact sources and current authorization remain authoritative; a storage observation is not custody or readiness. |
| `cw:component:protocol` | [Client-Project Server Protocol](.codewiki/wiki/items/system/components/client-project-server-protocol.md), **Native CLI and Git compatibility** | Explicit project selection, noninteractive bounded behavior, no raw adapter exposure or compatibility shortcut. |

The coordinator clarified the stable repository-binding behavior in Project's body without changing its envelope. Implementation status and this support/acceptance packet stay here, not in Wiki. These documents and the executable seams below are sufficient cold-start context; older donor branches, historical Check rubrics, previous conversations, and generated graphs are not additional requirements.

Three baseline counterexamples were reproduced through native source in disposable external Git fixtures: (1) a SHA-256 repository plus inherited `GIT_CONFIG_COUNT`/`extensions.objectFormat=sha1` binds a local Server advertising SHA-1; (2) removing Git from ambient `PATH` also turns the composition probe's failure into false SHA-1 success even though the Store opens the real SHA-256 repository through its isolated path; (3) a nested directory containing an invalid empty `.git` directory opens its ancestor through both factories. Direct bare-store opening currently succeeds while local Console composition rejects it; preserve that distinction. Evidence: `~/.local/state/codewiki/evidence/r1-d4-planning-4AiO5BUZ/counterexamples.json`. The owned fixture holder was removed; no source state was initialized or changed by these observations.

#### D4 edit boundary and implementation decisions

One `dev` worker at `max` may edit exactly:

- `src/adapters/git/project-store.ts` — factory observation, internal binding metadata, fixed process argument construction, and reuse of that binding by the existing adapter;
- `src/adapters/git/local-server.ts` — consume the established format and remove independent guessing;
- `tests/adapters/git/project-store.test.mjs` — binding/failure regressions and safe fixture Git setup;
- `tests/adapters/git/local-server.test.mjs` — composition agreement and environment/root regressions.

No new production module, generic process framework, compatibility factory, public export, port method, protocol version, or dependency is needed. Coordinator retains Wiki, plan, README, architecture registration, all other tests, full build/integration, and checkpoints. The accepted `tests/adapters/git/local-read-purity.test.mjs` is frozen at SHA-256 `0f2fa76f732c4d3cdf8aa9f3c2d92c8176201bace00eb25648ce82e4ce9d661b`.

The implementation must meet these decisions; internal helper names and the smallest correct Git plumbing sequence remain the worker's choice:

1. **Single owner of observation.** `createGitProjectStore` establishes the location and actual storage object format before constructing the adapter. Extend its private-module return type with a runtime-readonly `objectFormat` observation backed by the same value used for OID/request validation. Keep its existing successful Store-method shape, so existing internal callers need no wrapper or migration. Do not change `ProjectStorePort` or expose another Git handle through the Client API. Local composition opens the Store once and uses that observation for both the Server configuration and its returned `objectFormat`.
2. **No guessed format.** Remove `detectObjectFormat`, the composition's `execFile`/`promisify` plumbing, and the now-unreachable `object_format_failed` variant. Git must report exactly one supported storage format, `sha1` or `sha256`, even before the first commit. Do not use config absence, failed commands, Git defaults, HEAD availability, caller assertions, or the length of an unrelated OID as a substitute.
3. **Exact opening root.** Require a real existing non-symbolic directory and validate that Git resolves the requested working-tree root itself, not an ancestor, descendant, or administrative directory of a non-bare tree. Reject malformed own Git state that Git would otherwise ignore during discovery. Preserve the existing local preflight rejection of symbolic roots/`.git`, non-Git roots, missing roots, and unsupported filesystem kinds. Direct Store opening must also reject symbolic root or `.git` entries rather than bypass that protection.
4. **Supported layouts.** Keep normal working trees, valid non-symbolic Git files from separate-Git-directory initialization and linked worktrees, and direct bare Store roots working. A linked worktree's own administrative directory and shared common directory have distinct Git meanings: do not reject all external Git-file targets as path escape or collapse per-worktree state into the primary tree. Local Console composition remains non-bare and retains its D3 preflight; do not widen that API. Spaces in valid paths must work. Point-in-time filesystem checks are not a symlink-race or descriptor-custody guarantee.
5. **Reuse location, not discovery.** Capture the validated administrative-directory/worktree selection inside the private adapter and reuse it for subsequent operations. Do not allow a later command's ordinary `-C` ancestor search to choose a different store. Consolidate `#spawn` and factory argument construction through the existing narrow fixed-argument helper where useful. Preserve fixed Git plumbing, literal argument passing, complete-object checks, deterministic commit identities, request-bound authorization digests, no-lazy-fetch behavior, and expected-old-OID CAS.
6. **Bounded effects and failures.** Reuse the Store's explicit executable selection and sterile environment, not ambient `PATH`, `GIT_*`, user/system config, prompts, hooks, credential helpers, or executable aliases. Explicit operator-selected `gitBinary` remains the existing internal option; arbitrary new executable injection is not a feature. Every opening subprocess uses `shell: false`, the validated existing timeout budget, and a fixed metadata-output cap no greater than 16 KiB. Validate process error, signal/nonzero exit, output size, and exact output shape before interpretation. Unknown format or malformed/ambiguous bytes fail. Use existing typed `ProjectStoreIssue` codes: filesystem preflight or observed root-location mismatch → `repository_mismatch`, timeout → `timeout`, excess output → `limit_exceeded`, other failed/unsupported observation (including Git rejecting malformed metadata) → `command_failed`, with existing `read_snapshot` operation. Do not infer an error class by scraping arbitrary stderr. Probe diagnostics must be bounded and must not echo uncontrolled probe output. Local preflight failures remain `invalid_project_root`; other Store-opening failures become existing `store_failed`. No usable partial Store/Server escapes a failure.
7. **No semantic drift.** Opening and reads remain non-initializing and non-mutating. No config repair, index refresh, fetch, bootstrap, migration, or ref write is an identity probe. Keep the path-derived local repository label unchanged in this slice; it is not claimed to be the final configured Project identity. Keep read-only grants, unavailable executors, proof construction, protocol IDs, canonical-ref policy, and current valid CLI behavior unchanged.

#### D4 acceptance matrix

Tests must distinguish an actual target/format from a merely successful factory call. A loop over environments or a passing stub alone does not prove agreement.

| ID | Required evidence |
| --- | --- |
| D4-T1 | Real SHA-1 and SHA-256 roots, both unborn and committed: immutable Store observation matches Git's independently obtained storage format; local composition advertises that same format; exact committed reads return the intended commit/content. Include a SHA-1 repository without an `extensions.objectFormat` setting. SHA-256 support is required on this recorded Linux/Git profile: remove the current broad catch-and-skip that can hide any fixture/adapter error as unsupported Git. |
| D4-T2 | Misleading ambient `PATH`, foreign `GIT_DIR`/`GIT_WORK_TREE`/`GIT_COMMON_DIR`, object-directory overrides, and injected config/global configuration cannot change the selected repository, reported format, or actual read subject. Use distinct disposable repositories/commits as the oracle, not two indistinguishable fixtures. Include the two reproduced SHA-256 composition failures. Preserve/restore environment deterministically in serial cases or use subprocess isolation; do not leak it across tests. |
| D4-T3 | Missing/non-Git roots, ordinary nested paths, nested paths with an invalid own `.git`, malformed Git config/Git files, and symbolic root/`.git` entries fail with the specified typed category. Invalid roots must not bind their valid parent. Existing D3 local preflight cases remain valid; failed probes neither create nor repair state. |
| D4-T4 | Positive normal-root, separate-Git-directory, linked-worktree, and direct bare-store cases establish the intended binding and read the intended commit. Use only disposable external fixture repositories/worktrees, never this source repository. Local bare-root rejection remains unchanged. |
| D4-T5 | Bounded fixture executables exercise failed launch, nonzero exit even with plausible stdout, unknown/malformed format output, timeout, and excessive output. No fallback and no thrown incidental process error. A timeout fixture must not spawn uncontrolled descendants. These are process-boundary tests, not proof that an arbitrary replacement Git binary is trustworthy. |
| D4-T6 | Changing inherited environment after opening does not retarget a Store. Open a genuine nested independent repository, move its `.git` aside in the disposable fixture, and prove subsequent reads fail rather than reading the outer repository; both repositories' saved refs remain intact. Preserve exact reads and existing deterministic write/CAS tests against isolated fixtures; hooks/signing/auto-GC remain disabled in all fixture setup commands. The strengthened authorization-denial test and frozen D2 **7/7** purity suite stay green. |

Fixture helpers must take an explicit disposable root, ignore inherited Git target/config overrides, disable hooks/signing/automatic maintenance, and initialize an explicit branch/object format. A test's adversarial environment must not contaminate setup or oracle Git commands. Use no blanket catch/skip, weakened schema/CAS assertion, hidden bootstrap, or root-specific production exemption to obtain green tests. Unsupported test prerequisites, required edits beyond the four files, or an unresolved contract choice are stop/ask conditions.

#### D4 validation, review, and handoff

Before editing, confirm the exact branch/HEAD and expected unrelated state: user `.pi/settings.json`, original `outputs/`, and coordinator-only Wiki/plan edits. Save/compare the four owned-file baselines. No staging, commits, resets, stashes, branch/ref changes in this checkout, installations, packages, additional agents, shared `dist` writes, builds, or full-suite runs are delegated. Git mutations are allowed only for these disposable external test fixtures. Never load this checkout as a CodeWiki controller or call `wiki_*`/`/wiki-*` surfaces. Keep the frozen D2 test and all other files untouched.

Use primary LSP on the four owned files when directly available; unavailable tooling is reported, not replaced with a homemade compiler runner. Allowed focused commands after fixture safety is established:

```bash
npm run typecheck
node --experimental-strip-types --test tests/adapters/git/project-store.test.mjs tests/adapters/git/local-server.test.mjs tests/adapters/git/local-read-purity.test.mjs
```

Do not run dist-backed tests against stale output. Coordinator runs architecture, additional Store consumers (`tests/adapters/git/wiki.test.mjs`, `tests/server/queries/read-api.test.mjs`, `tests/server/commands/lifecycle.test.mjs`), and fresh-build bin/full integration after the writer stops. LSP references plus AST call search identified these consumers; the stale/incomplete review graph was not treated as exhaustive impact evidence.

Write the durable report through the runtime's external output path. Include the four-file diff, actual commands/counts/skips, a D4-T1–T6 evidence map, root/format observations, frozen D2 hash, branch/HEAD/staging and unrelated-file preservation, temporary-fixture cleanup, and remaining limitations. Save the reviewable patch as `~/.local/state/codewiki/evidence/r1-d4-planning-4AiO5BUZ/worker-diff.patch`; do not stage it. A fresh read-only reviewer compares the patch, baseline files in that directory, current bytes, this packet, and Wiki; it reports concrete blockers separately from speculative/out-of-scope concerns. Reviewer reports are evidence, not acceptance. Coordinator independently reproduces relevant negative cases, dispositions findings, integrates, and records the exact native checkpoint. An infrastructure failure stops the lane with preserved partial state; no implicit executor/model fallback is authorized.

D4 can close the independent format probe, unsafe root discovery, and failure-to-default gaps only. Configured durable Project identity, real Kernel Build binding, fact-aware readiness/recovery, Server-to-adapter layering, hostile local-config closure beyond these plumbing operations, physical process/storage custody, and external release/controller qualification retain their existing R1 owners and sequencing. Do not claim them solved by this binding patch.

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
