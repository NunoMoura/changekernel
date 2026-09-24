# ChangeKernel source-development status

**Target:** the smallest qualified Rust product for external self-development, not prototype parity. [Primary design](.changekernel/wiki/items/product/changekernel.md), [release criteria](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) and [capability dependencies](.changekernel/wiki/items/system/components/package.md#first-release-capability-dependencies) own requirements. This note owns current handoffs.

## Coordination and provisional startup

The user requested immediate next-worker dispatch while the manager reviews previous submissions afterward. **R2 is authorized source development on a provisional snapshot, not acceptance of R1.** A confirmed earlier defect remains an integration/acceptance blocker. The manager may require a correction or pause affected work; workers must not silently change agreed interfaces.

**Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Start the manager session there. The previous session's default directory was `/home/canina7/Projects/changekernel`, branch `audit/clean-baseline` at `de55797fc2e565639a635f345124407f42da73e1`; commands explicitly targeted external worktrees. Preserve that checkout's existing changes and staging; do not switch/reset/clean it to relocate the session.

**Accepted implementation:** R0, reviewed at `5f71878da3a68cc8492b8c0b3973c4a6dbdf0d18`, plus R1-B's reference recovery cases, integrated at `9306cb8dbf2a0f4776d1dec099fd3a2e95413757`. R1-A remains unaccepted. R1 startup/assignments are retained at `bee0e93f157c5d486f758c5420ff7846e97dcbec:CHANGEKERNEL_STATUS.md`.

**R2 code baseline:** A implementation `a84a121c5084509ff6a1f641288a62c3c129f312` plus B implementation `46c7670d3a2ed593bf0c3dbec3a678bfa672d7e8`, without either worker's handoff commit. The manager assembles these with the current requirements/assignments on **unaccepted** branch `staging/r2-startup` at `/home/canina7/Projects/changekernel-workers/r2-startup`. Both new worker branches start at **`2109ad945035ff101fd22b03eb4d9dad49fef864`**; record it before editing. Staging confers no acceptance; reviewed components are integrated separately. R2 launch prompts have been delivered, and the manager has not changed either worker's new worktree.

**Agreed provisional boundary:** preserve `Intake::new/create/open/propose/read`, `SqliteIntake::initialize/open_existing`, and the existing `Proposal`, `Receipt` and `Issue` public shapes/meanings. B may fix persistence internals to satisfy the existing contract without changing schema or receipt identity/digest encoding. A may add observer exports but must not change intake modules. Freeze both JSON corpora and all existing TypeScript production/reference runners. A alone owns Rust composition, manifests, lockfile and architecture/package guards; B uses existing native test targets and adds no source/test file requiring shared registration.

## R1 review results

**R1-A — changes requested.** Implementation `a84a121c5084509ff6a1f641288a62c3c129f312`; return `1fc0fecabbd4b86823c55483f62fd79caea995ef`. The manager read all submitted code/tests and scope changes. Independent build, formatting, clippy and six native test functions passed (including the child-entry helper); `npm test` passed type checking, build and 656/656 tests without skips. A deliberately wrong shared expectation failed the native runner. Passing tests did not catch these reproduced defects:

1. **High — rejected foreign stores are modified.** `src/adapters/sqlite/container_intake.rs:32-38`, reached before schema validation in both constructors. Each constructor returns `Unavailable` for an unrelated database, but changes its persistent journal mode from `wal` to `delete` and changes original file bytes. Verify admissible storage before persistent configuration changes; add unchanged-foreign-store regression tests for both constructors.
2. **Medium — missing retained grounds are misclassified.** `src/adapters/sqlite/container_intake.rs:259-266`. With an authorized owner's Change row still present but its retry binding deleted, read returns `Denied`; an identical proposal correctly returns `Unavailable`. Report unavailable retained grounds consistently without recreating them, and preserve denied access for unauthorized callers.

The independent fault at retry-binding insertion, after Change insertion, **passed**: both rows rolled back, and repair plus same-identity retry reconciled correctly. Keep this as regression coverage, not an invented defect. Existing thread concurrency plus a later fresh-process retry remains narrower evidence than racing fresh processes; R2-B supplies that missing coverage. No independent R1 native-only-copy/empty-PATH rebuild was repeated; worker-reported evidence is not manager verification. R1-A is not integrated or accepted. Its two corrections already belong to R2-B; A should continue its separate observer assignment. Acceptance requires independent review of the corrected exact revision, not a retroactive acceptance of this submission.

**R1-B — accepted.** Implementation `46c7670d3a2ed593bf0c3dbec3a678bfa672d7e8`; return `85e997f5d92bbd4bd305821881c0c4aba4f156b8`. All three files were independently reviewed; no blocking findings. Syntax checks, focused old/new intake tests (9/9), and full type checking/build/tests (659/659, no skips) passed. For each of the four cases, changing its expected row count to 99 in an external corpus copy produced an assertion failure; frozen bytes stayed unchanged. Only the implementation was cherry-picked to `9306cb8dbf2a0f4776d1dec099fd3a2e95413757`; a separate integration `npm test` again passed 659/659 and exact added-file comparison/diff checks passed. This accepts reference evidence, not Rust conformance or physical crash durability.

**Evidence and limits:** clean detached review worktrees remain at `/home/canina7/Projects/changekernel-workers/review-r1-rust-intake` and `/home/canina7/Projects/changekernel-workers/review-r1-intake-recovery`, with separate dependencies. A logs: `/tmp/changekernel-r1a-review-rust.dW2EYY.log`, `/tmp/changekernel-r1a-review-js.8RHDFk.log`, `/tmp/changekernel-r1a-review-negative.LYCDdE.log`. The external reproduction source, executable and per-case logs are in `/tmp/changekernel-r1a-review-probes.ISotE2/`. B logs: `/tmp/changekernel-r1b-review-js.AJN2Re.log`, `/tmp/changekernel-r1b-review-controls.ALSb2m.log`, `/tmp/changekernel-r1b-integration.O4e2G4.log`. The initial eleven active code probes in detached review worktrees were inconclusive, not confirmed clean. A fresh active probe of all three integrated B files and the updated manager handoffs confirmed them clean. Review worktree source bytes and all worker branches were preserved.

## R2-A — Native committed-source observations

**Worker:** A. **Branch:** `work/native-source-observation`. **Worktree:** `/home/canina7/Projects/changekernel-workers/native-source-observation`. **Base:** the common provisional R2 startup above; not a dependency on B's ongoing changes.

**Outcome:** a bounded read-only Rust library observer for explicitly selected committed repository files, suitable as possible grounds for later exact candidates, without an operational launcher or publication authority.

**Requirements:** [native committed-source observations](.changekernel/wiki/items/system/components/state.md#native-committed-source-observations), [source layout](.changekernel/wiki/items/product/changekernel.md#repository-representation), [package boundary](.changekernel/wiki/items/system/components/package.md#native-rust-bootstrap). The committed view deliberately does not cover dirty/untracked working-tree data or establish current-source freshness.

**Owned paths:** `src/kernel/state/source_observation.rs`, `src/application/source_observation.rs`, `src/ports/source_observer.rs`, `src/adapters/git/source_observation.rs`, `tests/kernel/state/source_observation.rs`, `tests/adapters/git/source_observation.rs`, `src/lib.rs`, `Cargo.toml`, `Cargo.lock`, `tests/kernel/invariants/architecture.test.mjs`, `tests/package/native-bootstrap.test.mjs`, README capability/build notes, State ownership-frontmatter additions for actual new paths, and your return section. Reuse the agreed intake access boundary; do not edit its modules/schema or B's tests. Add no new direct dependencies, runtime framework or speculative module shells.

**Acceptance:** implement the linked scope/access, exact-byte/version, absence/unavailable, bounded-process and no-effect contract. Test real disposable repositories, binary and Unicode contents, modes, mixed present/absent requested paths, scope/path escapes, denied actors, corrupt/missing objects, unsupported repository/entry forms, hostile configuration, limits and child failure/timeout cleanup. Prove that repository bytes/refs/index/config remain unchanged. Demonstrate a failing negative control. Keep source content inert and the launcher unchanged. Pass Rust build/format/clippy/all-target tests, `npm test` and `git diff --check`; record Git/tool versions and actual limits/gaps. Update bounded ownership/architecture coverage without weakening existing TypeScript or Rust checks.

**Excluded:** working-tree observation, automatic discovery/adoption, archive/candidate persistence, intake changes, lifecycle/Checks/Work, worker execution, transport/terminal, effects/publication and controller operations. If the observation boundary needs an incompatible intake change, stop and report rather than coordinating it informally with B.

**Return R2-A:** pending.

## R2-B — Native intake recovery and bounded hardening

**Worker:** B. **Branch:** `work/native-intake-hardening`. **Worktree:** `/home/canina7/Projects/changekernel-workers/native-intake-hardening`. **Base:** the common provisional R2 startup above; not a dependency on A's observer.

**Outcome:** native execution of the four new recovery cases plus narrowly scoped fixes needed to meet the already approved intake contract. Do not produce another reference-only test layer.

**Requirements:** [native intake](.changekernel/wiki/items/system/components/state.md#native-rust-intake), [continuation obligations](.changekernel/wiki/items/system/components/state.md#recovery-and-continuation-obligations), and both frozen JSON corpora in `tests/adapters/sqlite/`.

**Owned paths:** `src/adapters/sqlite/container_intake.rs`, `tests/adapters/sqlite/native_intake.rs`, `tests/kernel/containers/native_intake.rs`, and your return section. Keep helpers within existing targets. Do not change Kernel/Application/Port interfaces, schema/digest formats, manifests, lockfiles, exports, architecture guards, Wiki requirements, or TypeScript files/corpora.

**Acceptance:**

- Consume every case and expected result from `intake-recovery-conformance.json`: committed-but-lost reply, competing first submissions with different Why, lock timeout then retry, independently owned containers sharing a request identifier. Retain the original four native cases. Use real separate processes, explicit readiness/release handshakes, bounded waits and cleanup; prove stable scoped outcomes, exact intent, no duplicates and no loser overwrite. Mutating a portable expectation must fail the native runner without editing frozen source data.
- Investigate/reproduce the manager's inspection questions: persistent journal configuration occurs before unsupported-schema refusal; read reports denied when a retry binding is missing despite a retained Change; existing concurrency coverage uses threads plus a later fresh-process retry rather than concurrent fresh processes. Add regression tests for confirmed gaps. Rejected existing/foreign stores must not be silently reset, migrated or have persistent settings changed; detected missing retained grounds remain unavailable and unrepaired.
- Fault the retry-binding insertion after the Change row insertion and verify atomic rollback/reconciliation, not only failure before the first insert. Cover both directions of missing retained grounds and exact native validation bounds, including optional Why. Keep fixes minimal and within existing requirements. Preserve the old public behavior except where it contradicts those requirements; report any need for broader changes before proceeding.
- Pass Rust build/format/clippy/all-target tests, the focused old/new TypeScript intake suites, `npm test` and `git diff --check`. Report baseline failures, each repair and its failing-then-passing proof separately. This does not qualify physical power-loss durability or release adoption.

**Excluded:** feature expansion, schema migration, ownership transfer, lifecycle, source observation, new public diagnostic/fault-injection hooks, new dependencies or weakened checks.

**Return R2-B:** pending.

## Return, review and lookahead

Use only the new assigned worktree and its own dependencies/generated files/temporary resources. Both old R1 branches and both manager review worktrees remain untouched. Rust `1.88.0`, package version and JavaScript dependency pins stay unchanged. The manager's isolated tool environment is `/tmp/changekernel-r0a-review-tools.5VMgXF/env.sh`; workers should use their own existing external installation/caches or an isolated setup, not another checkout's generated files.

Commit implementation first, then only your return section with startup and implementation revisions, actual checks, findings and gaps. Stop for manager review. Do not merge, rebase, push, change branches or self-advance. The manager consolidates handoffs rather than merging them wholesale, reviews all prerequisite/correction revisions, and verifies the combined tree before acceptance.

While these slices run, prepare the next bounded candidate-custody and intent/Decision contracts against the Wiki dependency gates. Exact next scope/interfaces remain to be agreed; do not invent a full fixed implementation roadmap or quietly choose authorization/delegation policy for the user.

These are unqualified source-development assignments. No mutable-checkout controller, live inference, deployment, activation or controller handoff is authorized.
