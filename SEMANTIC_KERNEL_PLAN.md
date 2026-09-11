# Semantic Kernel Refactoring Plan

## Current entry

**P1-R complete: internal profile-selected Wiki reader and type-context boundary.** The parent reviewed the Luna implementation, corrected admission bugs and test oracles, and validated the final executable bytes. This is a foundation checkpoint, not an integrated dogfood release.

Starting subject: `/home/canina7/Projects/codewiki`, branch `audit/clean-baseline`, HEAD `791109494268e38b7d6952f1d1ef9b308ade4456`, empty index. Git records the resulting checkpoint; external evidence records tested hashes and preservation. Unrelated dirty Wiki alignment, project settings and four output documents remain preserved.

The maintainer clarified the operating model: subagents implement bounded Work; the parent scopes it, reviews actual code and tests, fixes findings and decides readiness. There is no reviewer-subagent gate. Routine Work decomposition and technical fixes do not need new owner approval. Material design, scope or authority changes do. Current subagents use OpenAI Luna; the parent remains Astra. On delegation failure, preserve partial state and use the authorized parent takeover, not blind retries or unapproved provider/executor changes.

## Delivery sequence

| Milestone | Status |
| --- | --- |
| Passive material foundation | SC-2A/2R and SC-2B-R complete. Last repair checkpoint: `791109494268e38b7d6952f1d1ef9b308ade4456`. |
| Internal Wiki interpretation | **P1-R complete.** Explicit profile selection, bounded restricted YAML/Markdown, lexical lineage, exact type-context subjects and private import fences. Legacy readers unchanged. |
| Change-first backend | **Next.** Join profile-selected exact candidates to existing proposal, Gate/decision, Work, consequential assessment, persistence and restart mechanisms. Include direct-authored adoption, revision/retirement and historical grounds; do not create a parallel lifecycle. |
| External first dogfood | Not qualified. Freeze immutable candidate bytes and exercise the integrated path in a disposable external Project with isolated settings before any required activation/handoff. |

Prioritize the smallest complete truthful backend path. Desired representation stays in [Wiki](.codewiki/wiki/items/system/components/wiki.md); Change-level commitment and delegated execution stay in [Change](.codewiki/wiki/items/system/components/change-trace.md) and [Planning](.codewiki/wiki/items/system/components/planning.md). Structural parsing and type resolution are not semantic assessment, acceptance, truth or permission. Joined assessment must retain consequential and honestly unresolved results, not substitute headings, keywords or an empty policy.

## Next bounded Work: integration seam selection

Trace the existing `loadMarkdownMaterialSource`, `readExactWiki`, `prepareWikiPatch`, `commitDecision`, Gate/Change/Work persistence and restart paths using native source tools. Select the smallest internal route from exact source bytes through the explicit profile decoder and type context into a persisted candidate and Change-level commitment. Identify exact source/test owners, assessment inputs and expected failure/restart behavior before delegating implementation. Record that bounded implementation scope here; do not open a separate design programme or change public contracts speculatively.

This discovery is read-only except for this ledger. It does not authorize live conversion, release qualification, activation, controller handoff or a second source of lifecycle truth. Existing mechanisms are real and must be reused; broad claims that decision commands or historical citation data are absent were already disproved.

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
