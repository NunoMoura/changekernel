# Semantic Kernel Refactoring Plan

## Current entry

**Exact profile-source integration complete.** The parent reviewed the Luna implementation and tightened pre-allocation UTF-8 budgets and native history/read-only tests. The private query joins exact canonical/Change/commit resolution to profile decoding and type-context admission. It is a lifecycle input seam, not a new lifecycle or an integrated dogfood release. Next bounded Work is target/transaction continuity and lifecycle attachment, below.

Starting subject: `/home/canina7/Projects/codewiki`, branch `audit/clean-baseline`, HEAD `6510b791cedb432a1cbf8cc1973945feeb1a95bc`, empty index. Unrelated dirty Wiki alignment, project settings and four output documents remain preserved.

The maintainer clarified the operating model: subagents implement bounded Work; the parent scopes it, reviews actual code and tests, fixes findings and decides readiness. There is no reviewer-subagent gate. Routine Work decomposition and technical fixes do not need new owner approval. Material design, scope or authority changes do. Current subagents use OpenAI Luna; the parent remains Astra. On delegation failure, preserve partial state and use the authorized parent takeover, not blind retries or unapproved provider/executor changes.

## Delivery sequence

| Milestone | Status |
| --- | --- |
| Passive material foundation | SC-2A/2R and SC-2B-R complete. Last repair checkpoint: `791109494268e38b7d6952f1d1ef9b308ade4456`. |
| Internal Wiki interpretation | **P1-R complete.** Explicit profile selection, bounded restricted YAML/Markdown, lexical lineage, exact type-context subjects and private import fences. Legacy readers unchanged. |
| Change-first backend | **Next.** Join profile-selected exact candidates to existing proposal, Gate/decision, Work, consequential assessment, persistence and restart mechanisms. Include direct-authored adoption, revision/retirement and historical grounds; do not create a parallel lifecycle. |
| External first dogfood | Not qualified. Freeze immutable candidate bytes and exercise the integrated path in a disposable external Project with isolated settings before any required activation/handoff. |

Prioritize the smallest complete truthful backend path. Desired representation stays in [Wiki](.codewiki/wiki/items/system/components/wiki.md); Change-level commitment and delegated execution stay in [Change](.codewiki/wiki/items/system/components/change-trace.md) and [Planning](.codewiki/wiki/items/system/components/planning.md). Structural parsing and type resolution are not semantic assessment, acceptance, truth or permission. Joined assessment must retain consequential and honestly unresolved results, not substitute headings, keywords or an empty policy.

## Exact profile-source closeout

Parent tracing confirmed the concrete seams: `loadMarkdownMaterialSource` resolves canonical/Change/commit selectors to passive exact corpus data; `loadCanonical` / `loadLifecycleChange` still call the legacy Wiki loader. `prepareWikiPatch` requires legacy `WikiMaterialization`, Item IDs and transactions; `commitDecision` already checks a persisted Gate and moves canonical/Change refs by CAS. Gate evaluation already accepts typed materials and persists bundles and trace events. Do not fabricate legacy Item IDs from paths/titles, coerce new files into old envelopes, or claim a parser swap completes lifecycle integration.

Implemented private `loadProfiledWikiSource`, composing the exact material resolver with the explicit profile decoder and `bindWikiTypes`. It returns the resolved snapshot, unchanged passive corpus, parsed managed Wiki files and their bound type context. Resolve once; use that exact commit for all reads and context. Re-encode exact lossless corpus text without normalization to feed the byte decoder; independently check managed file/count/aggregate budgets before parsing or exposing partial success. Only Markdown under `.codewiki/wiki/` is interpreted; other source remains passive. Profile selection is mandatory and rejected before Store I/O when unsupported. Propagate structured material/profile/budget/binding causes rather than collapsing them into generic failures. No process-local cache or remembered interpretation may affect restart/historical reads.

Reviewed checkpoint paths:

- `src/server/queries/profile-source.ts` (new): the composition boundary and named immutable outcome/error shapes.
- `tests/server/queries/profile-source.test.mjs` (new): fake-Store adversaries plus native disposable Git selector/reopen/history tests.
- `tests/kernel/invariants/architecture.test.mjs`: exact inventories/import ownership and private closure. Permit only the new intended imports; keep parser packages adapter-only and existing public/legacy fences intact.
- This ledger, parent-owned. No other executable paths or dependencies change without parent disposition of a concrete finding.

Acceptance: complete core/custom fixtures from native SHA-1 and SHA-256 repositories; canonical, managed Change and explicit commit selectors; current versus historical type definitions after reopening; exact non-NFC/body/lineage/subjects preserved; arbitrary Markdown outside Wiki remains passive even when nonconforming. Reject unsupported profiles before I/O, invalid managed files, missing/ambiguous definitions, mixed identities, drifted tree/blob responses and managed budget overflow without partial output. Preserve exact material-loader failure causes. Verify no writes/ref movement/config or index changes and no second source resolution. Existing resolver/reader/lifecycle tests must remain unchanged and pass. A missing lifecycle trace in a raw commit is not invented or silently interpreted as acceptance.

Parent review fixed a real admission gap: actual UTF-8 bytes are now counted within the remaining per-file/context budgets before an encoded copy is allocated; tests observe that offending text is never encoded. Exact aggregate limits remain inclusive. Native history fixtures now change a custom type's core base while leaving its instance bytes unchanged, verify old/new bindings and defining blobs, then reopen again and recover the old context. Ref/config/index baselines precede every query, not merely the final repeated read. Source responses retain resolved subjects; a Store-supplied tree identity is preserved, not independently authenticated by this query.

Final validation: **166/166 focused tests; `npm test` typecheck/build/test-smoke and 448/448 tests, zero failures/skips.** Active primary LSP has no errors. Scoped multi-runner scan has no blocking errors; remaining unused private-seam/type warnings and boundary style hints are intentional, and the existing architecture deprecation hint is unchanged. Detailed rationale, coverage limits, commands/exits, tested hashes, preservation and checkpoint receipt live in `~/.local/state/codewiki/evidence/profile-source-k66u0rke/parent-review/`. The writer's 446-test gate is earlier evidence, superseded by this final-byte gate. Parent review owns acceptance; no independent reviewer or release qualification is claimed.

## Next bounded Work: target/transaction continuity and lifecycle attachment

Trace the exact legacy coupling in `ChangeTarget`, `WikiPatchInput`, `validateWikiTransaction`, `validateProposalScope`, event ownership, and Gate material persistence. Define the smallest explicit old/new file-subject target and transaction input that lets a profile-selected candidate use the existing proposal/commit/Work/review path without fabricated Item IDs or a second lifecycle. Include additions, revisions, retirement and explicit rename/split/merge continuity; do not infer continuity from titles or Git similarity. Bind profile selection and defining type subjects in assessment/history, including type-only changes affecting unchanged instance bytes.

This step is read-only except for the ledger until the parent records exact implementation paths, protocol compatibility, authority checks and restart tests. Routine implementation choices remain delegated; material intent/design/scope/authority changes require the maintainer. The complete path must still join assessment and persisted consequences; a passing structural decoder or empty Check policy is not sufficient.

## P1-R closeout

Reviewed checkpoint paths:

- `src/kernel/wiki/profile.ts` — immutable profile/limits, bounded inert field admission, lexical Change references and supplied type-context checks.
- `src/adapters/git/wiki-profile.ts` — exact UTF-8 snapshot, bounded frontmatter, maintained restricted YAML/Markdown parsers and H1/primary-content structure.
- `tests/kernel/wiki/profile.test.mjs`, `tests/adapters/git/wiki-profile.test.mjs`.
- `tests/kernel/invariants/architecture.test.mjs` — exact inventories, adapter-only parser dependencies and private reachability fences.
- `tests/package/composition.test.mjs` — exact inventory for the two approved parser dependencies, preserving existing package assertions.
- `package.json`, `package-lock.json` — `yaml@2.9.0` and `mdast-util-from-markdown@2.0.3`, originally installed with lifecycle scripts disabled.
- `AGENTS.md` — the explicitly requested delegation, parent acceptance and high-signal writing guidance.
- This plan — parent-owned scope, status and evidence.

Parent fixes include the exact opening delimiter, spoof-resistant native byte lengths and bounded snapshots, rejection of shared/detached storage, dense own-data context arrays without getter/iterator invocation, early metadata/text size admission, exact body slicing and header bounds, and rejection of comment-only primary content. Own-data extraction returns a validated property shape while its field value remains untrusted until field-specific checks. No lint suppression is required for that boundary.

Tests now include exact UTF-8/file/header budgets, inert-data and accessor adversaries, mutation isolation, SHA-256 core/custom contexts decoded from real profile bytes, legacy compatibility and private closure. The parent corrected its own test mistakes: lookup must use the documented sorted binding/item shape, and lexical-reference fixtures must use the matching directory depth. Earlier failures and their actual exits remain in evidence; no production policy was weakened to make them pass.

Type-context validation rechecks supplied parser results, metadata and subjects. It does not independently parse YAML/Markdown, hash Git blobs or prove snapshot membership. Integration must decode exact files through the selected adapter first and separately establish source binding and authority. Parser byte/tree budgets are finite input bounds, not an OS sandbox or a universal allocation guarantee. Domain identifiers carry no proposal/version prefix; versions belong in explicit profile data.

Validation on final executable bytes: **101/101 focused tests; `npm test` typecheck/build and 435/435 tests, no failures or skips; active primary LSP has no errors.** Scoped multi-runner diagnostics have no blocking errors; retained complexity, intrinsic/index assertions, admission-boundary style hints and private-module/export findings are not a project-wide clean verdict. The existing TypeScript deprecation hint is unchanged. Scanner coverage/exclusions and rationale are recorded with parent review evidence. No independent review or release qualification is claimed or required for this checkpoint.

## Preservation and authority

One writer per checkout. Use native coding tools and ordinary tests; never CodeWiki `wiki_*` tools or `/wiki-*` commands, mutable-package controllers, project-local CodeWiki installs/links/skills/pins or dogfood state. Preserve unrelated work, Wiki envelopes/IDs/provenance, `.codewiki/changes/**`, repository-binding safeguards and all source/tests outside the explicit Work scope. No reset/stash/transplant or competing writer.

Ordinary reviewed local checkpoints are authorized; stage only owned reviewed paths. Push/fetch, canonical-ref movement, live conversion, credentials, paid Product experiments, activation and controller handoff require applicable separate authority. Pack/test releases only in disposable external Projects with isolated settings. Generated/private/runtime/package artifacts are not source truth and do not belong in Git.

## Evidence and cold history

- P1-R parent review and final gate: `~/.local/state/codewiki/evidence/p1-reader-6q45akhe/parent-review-fm2ircgg/` (review report, tested hashes, exact logs, preservation and checkpoint receipt).
- P1-R baseline and recovery: `~/.local/state/codewiki/evidence/p1-reader-6q45akhe/`. OpenRouter credit failures, owner-stopped Flash execution, Luna's 1800000 ms timeout and the unnecessary reviewer tool-contract failure are retained there, not active gates. The timeout recovery's 426-test result is superseded by the 435-test parent gate.
- SC-2B-R evidence: `~/.local/state/codewiki/evidence/change-first-execution-mbmnl26f/parent-takeover/`.
- Compatibility audit: `~/.local/state/codewiki/evidence/wiki-profile-design-v5vlimyr/`; corrected inventory is 47 Markdown Items.
- Historical ledger: `git show c04c00786c242e7fa32522d6b1eb902751af6d99:SEMANTIC_KERNEL_PLAN.md`. Consult only for a specific historical question; cold pauses are not current instructions.
