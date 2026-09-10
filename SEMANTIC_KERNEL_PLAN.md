# Semantic Kernel Refactoring Plan

## Current entry

**SC-0 second pass complete, documentation only. Next: SC-1 contract probes. Source implementation remains paused.** The maintainer approved decluttering active documentation and adopting the Git-native hot/cold model. This file is the sole active roadmap, procedure/status ledger, qualification record and archive checklist. Wiki owns stable desired behavior; old implementation packets do not authorize current work.

## Baseline and protected work

- Checkout: `/home/canina7/Projects/codewiki`; branch: `audit/clean-baseline`; capture HEAD: `e8587493759a564e2b92ceb0e1912cbf74c1ce54`. It is a documentation checkpoint over source ancestry `53b17a023beeb8edde48b7cf488dcdfe95639e7a`; selected audit ancestry remains `7fe04257d2a18d5d16130c45f5919e49bb84f92d`. Verify current Git state; none of these is an instruction to reset.
- Sole canonical remote: `origin`, `git@github.com:NunoMoura/codewiki.git`. No remote baseline or controller authority is inferred from a cached ref, timestamp or historical receipt.
- D4 remains incomplete and unaccepted. Preserve `src/adapters/git/project-store.ts`, `src/adapters/git/local-server.ts` and `tests/adapters/git/project-store.test.mjs` unchanged. Its infrastructure/provider failures do not authorize another executor, provider, paid call or lane retry. Reassess the patch under SC-2, not the old packet.
- Preserve the frozen `tests/adapters/git/local-read-purity.test.mjs`, user `.pi/settings.json`, existing `outputs/`, `AGENTS.md`, governed `.codewiki/changes/**`, existing archived documents and all unrelated work. The Project Wiki repository-binding safeguard and current Wiki envelopes/IDs/provenance/ownership remain unchanged in this pass.
- Private capture/validation artifacts: `~/.local/state/codewiki/evidence/semantic-hot-cold-u5ep4_nb/`. `state-before.json` covers 194 tracked/output paths plus branch, HEAD, refs and the prior plan blob. These artifacts are not source truth or release qualification.

## Native working procedure

1. Work in the single active source checkout on the selected proposal branch. Reconcile unique work before baseline changes or cleanup; do not create competing development checkouts or transplant donor trees wholesale.
2. Follow the current SC queue. Before a source slice, record resolved design choices, exact file/test scope, preserved-work disposition and bounded acceptance here. Unscheduled gaps enter this plan first. R1's native working method and data-contracts naming amendment remain; its superseded destination, queues and internal Check rubrics do not.
3. Ordinary native edits, diagnostics, tests and reviewed Git checkpoints within approved scope require no separate Change admission, release, prospective-OID permission or controller swap. Record actual command outcomes and exact subjects; missing evidence is not success. Use proactive diagnostics, inspect exit status, and stage only reviewed owned changes.
4. Do not load CodeWiki from mutable code or this checkout's `.pi/`, or invoke CodeWiki `wiki_*` tools or `/wiki-*` commands here. Do not add package links, duplicate skills, executable Plugin paths or controller pins. Candidate N+1 never governs itself.
5. Push, canonical-ref movement, live conversion, credentials, paid model calls, activation and controller handoff need applicable explicit authority. Pack/test candidates only in disposable external projects with isolated Pi settings. Worktrees are not sandboxes; unknown external effects require reconciliation before retry.
6. Preserve supported source-checkout storage and provenance. `.codewiki/wiki/**` is desired-state truth, `.codewiki/changes/**` lifecycle truth, and `src/**`/`tests/**` executable truth. Keep `.codewiki/kb/**` and `.codewiki/traces/**` absent; never dual-read/write. Future implicit Markdown behavior does not authorize stripping envelopes, re-bootstrap, live migration or reclassifying every Markdown file here as governing policy.
7. Qualification requires an exact committed, uniquely versioned immutable candidate, supported profile, frozen budgets and replacement guidance. Post-freeze corrections require a new subject/version and qualification. Resolve actual independent controller authority and state compatibility; activation alone is not handoff. Required handoff needs quiescence and no overlap. Higher-priority truth/safety/source-checkout restrictions do not sunset with bootstrap procedure.

## Design entry points

- [Change](.codewiki/wiki/items/system/components/change-trace.md) is the primary mechanism of evolution; [Wiki](.codewiki/wiki/items/system/components/wiki.md) is current accepted knowledge, not a folder or disposable model output.
- [Project/Git](.codewiki/wiki/items/system/components/project.md) supplies native intent-bearing records, exact Wiki outcomes and history. It is foundational, not an optional connector. Retired knowledge stays available through native history; there is no separate Archive or Sources knowledge system.
- [Evidence/information](.codewiki/wiki/items/system/components/evidence.md) defines on-demand material and its scoped evidential use. [External connectors](.codewiki/wiki/items/system/components/provider-boundary.md) optionally add users' data; the core must work with none configured. Retrieval/context eviction does not promote or retire knowledge.
- [Semantic validation](.codewiki/wiki/items/system/components/checks.md) and the [four loops](.codewiki/wiki/items/system/flows/change-lifecycle.md) govern transitions. Decluttering must preserve current grounds and obligations, not merely conclusions.

Do not turn the RAM/disk analogy into a literal architecture: model context is transient, Wiki is persistent accepted knowledge, and cold material can be previously analyzed. Git preserves exact outcomes; neither a new LLM pass nor a RAG index reconstructs historical acceptance.

## Implementation disposition and gaps

The existing source/test map was inspected at the capture lineage, not re-audited or requalified in this documentation pass. Regression assets are evidence to reuse, not newly passing acceptance results.

| Area / existing evidence | Disposition and remaining gap | Slice |
| --- | --- | --- |
| `src/kernel/data-contracts/`, `src/kernel/identity/`, matching tests | **Retain** bounded typed contracts and exact/digest identities. **Adapt** Build binding: a policy digest does not identify all executable bytes. | SC-2/4/7 |
| `src/kernel/wiki/`, `src/adapters/git/wiki.ts`, `src/server/queries/wiki.ts`, Wiki tests | **Adapt** exact reads, atomic post-state validation, citations, ownership and isolated legacy provenance. **Replace** special-root/envelope enrollment requirements. Add current-role/adoption boundaries, passage retirement, native historical retrieval with disposition, and bounded cold-context access. Existing field/body diff is not consequential semantic interpretation. | SC-2/3/4/6 |
| `src/kernel/changes/`, Change/lifecycle tests | **Adapt** intent/rationale, exact snapshots and append-only outcomes. Replace fixed type/realization and passed-Gate assumptions where necessary. Bind promotion, revision, retirement and re-adoption to accepted scoped transitions; retain historical grounds without making retrieval a transition. | SC-1/4 |
| `src/kernel/gates/`, `src/ports/check-runner.ts`, `src/server/commands/gates.ts`, Gate tests | **Replace** authored Pack selection as policy; retain useful exact-subject, evidence, stale-result and failure mechanics. Add supported/contradicted/unresolved judgments, applicability and coverage. Empty Gates and relabeled Packs are not the new evaluator. | SC-3/4 |
| `src/kernel/work/`, `src/server/commands/lifecycle.ts`, `src/server/queries/project.ts`, Work/lifecycle tests | **Adapt** dependency, assignment and transition mechanisms for shared obligations, uncertain paths, partial outcomes and actual join assessment. Planning applies to knowledge work too. | SC-4/5 |
| `src/adapters/git/project-store.ts`, `src/ports/project-store.ts`, `src/server/commands/repository.ts`, Git tests | **Retain/adapt** native snapshots/history and expected-old-OID writes; no optional Git connector or duplicate archive store. Define retention, subject binding and rewrite/transport behavior before changing it. Reassess D4 separately for roots, redirects, linked worktrees, object formats, bounds and read purity. | SC-2/4/5/6 |
| `src/server/index.ts`, `src/server/authorization/policy.ts`, `src/server/queries/source.ts`, `src/api/`, `bin/codewiki.mjs`, auth/transport tests | **Retain/adapt** authorization, redaction, once-resolved sources and honest capabilities. Distinguish current knowledge, pending work and historical/external information in responses. Resolve Server/Git layering deliberately. External data connectors are optional, not a replacement for native storage or acceptance. | SC-2/3/4/6 |
| `src/server/recovery/facts.ts`, `src/kernel/evidence/reference.ts`, recovery/evidence tests | **Adapt** immutable subject/evidence binding; process-local facts do not supply durable judgments or restart custody. RAG indexes remain rebuildable, not source truth. Preserve exact source versions, adoption/retirement provenance, availability/permission limits and independently supported claims. | SC-4/6 |
| `src/ports/agent-runtime.ts`, `src/adapters/dsh/`, runtime tests | **Adapt** a bounded observation/execution boundary; defer selecting DSH as the executor. Injected/replay tests do not establish real tools, containment or quiescence. One enforceable execution profile is enough. | SC-1/3/5/6 |
| `src/ports/preview.ts`, `src/adapters/preview/local.ts`, Preview tests | **Defer** supported execution until workspace/generation/custody/output/cancellation gaps are qualified. No first-dogfood dependency. | Later scope |
| `src/product.ts`, `src/adapters/git/bootstrap.ts`, `src/adapters/git/project-config.ts`, `src/index.ts`, Product/package tests | **Adapt/replace** coupled root, role, Check-policy and bootstrap declarations. Existing repositories have a corpus; capture honest baseline assurance. Change readers/writers/config/exports coherently without live conversion or invented past acceptance. | SC-2/4/7 |
| `tests/kernel/invariants/architecture.test.mjs`, remaining scripts/tests | **Retain/adapt** purity, export/source closure, ownership and historical-state guards. Review allowlist changes; do not weaken tests to hide changes. Change/Gate/Work/Evidence suites are imported by architecture tests even where absent from direct globs. | Every source slice |

Defer full hosted UI, broad format/plugin ecosystems, optional external database connectors and delivery features until demanded by a bounded use case. No separate Skills/Check Pack/Archive/Sources ontology or second authoritative database belongs in the successor design. Historical converters are donor evidence, not ready migration tools.

## Current queue

Every source slice remains gated on its preceding design/validation dependencies and a concrete packet. No source changes are authorized by completing this documentation pass.

| ID | Work and dependencies | Exit / status |
| --- | --- | --- |
| SC-0 | Second-pass Wiki/plan hardening and history decluttering. | **Complete, docs only.** Prior ledger verified in exact Git history; envelopes/ownership, links, diagrams, decision coverage, safety boundaries, protected work and diagnostics checked. No new archive copy or runtime migration. |
| SC-1 | **Next:** software/non-software and historical contract probes; resolve implementation-critical questions below. | **Unstarted.** Compare good prose/Git against minimal explicit grounds/dependencies. Select only justified structure, stage subjects and transition rules; publish a bounded SC-2 packet. The cases below are specifications, not executed acceptance tests. |
| SC-2 | Native current corpus and honest adoption; depends on SC-1. | **Blocked.** Plain tracked Markdown without required IDs/frontmatter; exact sources, roles, scoped links, malformed/private-input behavior, no index execution or implicit bootstrap. Retain supported old-envelope fixtures; separately review D4. |
| SC-3 | Consequential evaluator and diff; depends on SC-1/2. | **Blocked.** Actual changed commitments/assumptions; scoped supported/contradicted/unresolved findings; no empty-policy, label/waiver, hidden-context or ranking bypass. Evidence can challenge current belief without silently overwriting Wiki. |
| SC-4 | Change transitions and durable Git-linked checkpoints; depends on SC-1–3. | **Blocked.** Explicit adoption/revision/retirement/re-adoption, intent changes, exact baselines and authority; checkpointed ≠ accepted ≠ realized. Native edits outside the service do not invent acceptance. Preserve real outcomes through clone/restart and reject rewritten-subject/self-OID claims. |
| SC-5 | Planning, attempts and semantic joins; depends on SC-4. | **Blocked.** Shared maintenance obligations survive decomposition; assess actual joins. Route defects/path conflicts/intent revisions correctly. Enforce supported tool/effect scope and observe cancellation/custody; reconcile unknown effects. |
| SC-6 | Native historical information retrieval, durable judgments/custody and fresh-context continuation; depends on SC-3–5. | **Blocked.** Recover exact retired material and its disposition without an external connector, archive database or rerun model. Retrieval is not re-adoption. Preserve current obligations through context limits; show missing/private/stale inputs; reconcile restart cut points without duplicate effects. |
| SC-7 | Immutable external first-dogfood qualification; depends on SC-2–6. | **Blocked.** Frozen corpus/profile/budgets and real semantic feedback → inquiry/repair → accepted outcome → restart. Native Git/Wiki/Change loop works with zero external data connectors. Exclude unsupported Preview/format/hosting breadth; resolve actual release/controller authority and state compatibility. |

## Questions to resolve before implementation

These remain open unless explicitly settled in a scoped design decision. The agreed Git foundation, Change-controlled transitions and optional nature of external data connectors are not open alternatives.

| ID | Remaining decision |
| --- | --- |
| P-O1 | Minimal effect classification and passage/file role representation; how to recognize adopted assertions versus quotes, proposals and imported material without mandatory universal metadata. |
| P-O2 | Exact stage-level/intermediate promotion, revision and retirement rules; distinguish acceptance to proceed, adopted knowledge, partial realization and completion. |
| P-O3 | Intent amendment versus successor Change, preserving original reasons and approved scope. |
| P-O4 | Minimal durable Git-linked judgment/checkpoint/evidence records and historical disposition references; exact subject binding, access, retention and no self-referential commit claims. |
| P-O5 | Branch/join default and assurance behavior under squash, rebase, cherry-pick, deletion and native writes outside CodeWiki. No mandatory branch per stage. |
| P-O6 | Existing-repository baseline: discovered, classified, adopted, supported and unknown knowledge without fictional genesis or retroactive validation. |
| P-O7 | Markdown/vault/link scope, ambiguous/malformed input, rename identity, historical lookup and privacy/retention; optional annotations only where justified. No extra archive tree required. |
| P-O8 | Evaluator context/coverage/evidence thresholds, disagreement/adjudication and deterministic enforcement; observation and interpretation versions. |
| P-O9 | Context allocation and cold RAG behavior without omitting binding obligations, counting derivative summaries as independent evidence, or confusing retrieval with adoption. No mandatory global score or vector DB. |
| P-O10 | Minimal Hub authority/client surface and optional external-data access contract; no connector required for native Git history. |
| P-O11 | Per-hunk/module disposition of retained code, especially D4, against the new bounded scope and real tests. |
| P-O12 | First enforceable execution profile, numeric budgets, qualification subject and independent controller/compatibility path. |

## Hardening cases for SC-1

Use these as adversarial design probes, not claims of executed runtime tests. Record exact assumptions, observations and unresolved protocol choices rather than converting expected answers into test receipts.

| Case | Required distinction |
| --- | --- |
| Software: UI/backend/observability work changes authentication. | A shared no-secret-logging obligation survives parallel decomposition and context selection; individually passing tasks do not approve a conflicting join. |
| Non-software: improve onboarding using interview/measurement data. | Connected observations inform a Change; committing a revised procedure does not prove adoption or improved outcomes. A connector supplies material, not authority. |
| Original reasons still hold. | Reuse accepted grounds without unnecessary re-inquiry; do not retire an obligation because it is rarely retrieved. |
| One assumption fails. | New evidence can contradict support or block proposed work before a Wiki revision; independent support may preserve the conclusion. |
| Rejected alternative becomes appropriate. | Native history reveals its original conditions and rejection reasons. Retrieval alone does not re-adopt it; an accepted scoped Change must. |
| Move text to `archive/`; unload text from a prompt. | A directory name or cache eviction is not semantic retirement. Retirement of a statement/commitment is explicit, attributable, and retains exact prior material. |
| Promote a plausible RAG answer or retrieve an obsolete rule. | Neither synthesis nor historical acceptance silently becomes current knowledge. Preserve source version, former disposition, conditions and evidence limits. |
| No connectors; missing history; private data. | Native core/history still works without external data connectors. Unavailable objects or unauthorized material produce honest bounded limitations, not fabricated reconstruction, permission bypass or an unconditional coverage claim. |

Measure quality and effort against a well-written prose/Git baseline before adding metadata machinery. Freeze time, memory/output, latency, token/cost/retry, omission/false-acceptance and intervention limits before qualification. Binding safety failures cannot be averaged away. The memory-hierarchy analogy and [Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) motivate persistent synthesis and on-demand sources; they do not prove performance, mandate LLM-only authorship or turn a prompt schema into project policy.

## Validation and next action

Second-pass native documentation checks passed: 50 explicit-file primary LSP checks; all 47 Wiki envelopes/IDs/provenance and 21 ownership records unchanged; 86 local links, 34 source paths and all four diagram reference/flow graphs checked; the full prior ledger recovered byte-for-byte from its commit and blob. The 27 edited Wiki bodies, README and this plan form the 29-file scope. All 165 other tracked/output paths, including AGENTS, source/tests, user settings and existing archives, matched capture bytes/modes; the Project repository-binding text is unchanged. `git diff --check` passed. Detailed results are in private `documentation-review.json` and `verify-docs.py` under the capture directory above.

Cross-page desk review covered Change-controlled adoption/retirement, Git as native foundation, optional connectors, historical disposition, RAG non-promotion, retained grounds, privacy/availability and context eviction. The SC-1 cases remain specifications, not executed runtime tests or proof of semantic/model quality. No source tests, builds, package/model/connector execution, live migration, qualification, activation, handoff or push ran. The docs checkpoint does not close implementation gaps.

After documentation review/checkpoint, continue with SC-1 only. Do not retry D4, start SC-2, configure providers/connectors or infer source, release or effect authority from this cleanup.

## Historical evidence: cold Git path

The full prior ledger, brainstorm rationale, research sources, predecessor audits, failure records and qualification lineage remain byte-for-byte at commit `e8587493759a564e2b92ceb0e1912cbf74c1ce54`, path `SEMANTIC_KERNEL_PLAN.md`, blob `63e33716f3b692f139bb1a52295838a6103fd710`. No duplicate archive file is needed. Retrieve only when the current question requires its evidence:

```bash
git show e8587493759a564e2b92ceb0e1912cbf74c1ce54:SEMANTIC_KERNEL_PLAN.md
```

Old “current”, “next”, queue and authority wording describes those historical subjects, not present instructions. Existing `docs/archive/**` and governed lifecycle records remain unchanged. This native documentation checkpoint neither rewrites their outcomes nor claims a CodeWiki-governed admission, retirement, release, activation or controller handoff.
