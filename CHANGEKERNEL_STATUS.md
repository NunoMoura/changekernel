# ChangeKernel source-development status

**Target:** the smallest qualified Rust product for external self-development, not prototype parity. [Primary design](.changekernel/wiki/items/product/changekernel.md), [release criteria](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) and [capability dependencies](.changekernel/wiki/items/system/components/package.md#first-release-capability-dependencies) own requirements. This note owns current handoffs.

## Coordination and provisional startup

The user requested immediate next-worker dispatch while the manager reviews previous submissions afterward. **R2 is authorized source development on a provisional snapshot, not acceptance of R1.** A confirmed earlier defect remains an integration/acceptance blocker. The manager may require a correction or pause affected work; workers must not silently change agreed interfaces.

**Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Start the manager session there. The previous session's default directory was `/home/canina7/Projects/changekernel`, branch `audit/clean-baseline` at `de55797fc2e565639a635f345124407f42da73e1`; commands explicitly targeted external worktrees. Preserve that checkout's existing changes and staging; do not switch/reset/clean it to relocate the session.

**Accepted implementation:** R0 only, reviewed at `5f71878da3a68cc8492b8c0b3973c4a6dbdf0d18`. R1 startup/assignments are retained at `bee0e93f157c5d486f758c5420ff7846e97dcbec:CHANGEKERNEL_STATUS.md`.

**R2 code baseline:** A implementation `a84a121c5084509ff6a1f641288a62c3c129f312` plus B implementation `46c7670d3a2ed593bf0c3dbec3a678bfa672d7e8`, without either worker's handoff commit. The manager assembles these with the current requirements/assignments on **unaccepted** branch `staging/r2-startup` at `/home/canina7/Projects/changekernel-workers/r2-startup`. Both new worker branches start at its same exact commit, supplied in launch prompts; record it before editing. No R1 code is thereby accepted into the manager's integration branch.

**Agreed provisional boundary:** preserve `Intake::new/create/open/propose/read`, `SqliteIntake::initialize/open_existing`, and the existing `Proposal`, `Receipt` and `Issue` public shapes/meanings. B may fix persistence internals to satisfy the existing contract without changing schema or receipt identity/digest encoding. A may add observer exports but must not change intake modules. Freeze both JSON corpora and all existing TypeScript production/reference runners. A alone owns Rust composition, manifests, lockfile and architecture/package guards; B uses existing native test targets and adds no source/test file requiring shared registration.

## R1 review in progress

- **A:** implementation `a84a121c5084509ff6a1f641288a62c3c129f312`, return `1fc0fecabbd4b86823c55483f62fd79caea995ef`. The manager read all submitted Rust code/tests and scope changes, then independently passed build, formatting, clippy and six native test functions (including the child-entry helper). Full JavaScript verification and adversarial review remain unfinished. No acceptance verdict yet.
- **B:** implementation `46c7670d3a2ed593bf0c3dbec3a678bfa672d7e8`, return `85e997f5d92bbd4bd305821881c0c4aba4f156b8`. The manager read all three added files and independently passed syntax checks and `npm test`: type checking, build, 659/659 tests without skips. Independent negative control/final review remain unfinished. No acceptance verdict yet.
- Clean detached review worktrees: `/home/canina7/Projects/changekernel-workers/review-r1-rust-intake` and `/home/canina7/Projects/changekernel-workers/review-r1-intake-recovery`, each at its implementation revision with separate dependencies. Logs: `/tmp/changekernel-r1a-review-rust.dW2EYY.log`, `/tmp/changekernel-r1b-review-js.AJN2Re.log`. Eleven active code diagnostics probes were inconclusive, not confirmed clean.
- Review questions already passed to B below are hypotheses to reproduce, not confirmed defects or permission to weaken guarantees. The manager continues independent review after dispatch and reviews any corrections at their exact new revisions.

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
