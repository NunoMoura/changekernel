# ChangeKernel source-development status

**Target:** the smallest qualified Rust product for external self-development, not TypeScript feature parity. [Primary design](.changekernel/wiki/items/product/changekernel.md) and [first-release acceptance](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) own requirements. This note owns current source-development handoffs only.

## Shared checkpoint and coordination

**Responsible:** project manager. **Assignments:** R1-A and R1-B may run in parallel; neither is accepted or authorized to advance itself.

**Reviewed base:** `5f71878da3a68cc8492b8c0b3973c4a6dbdf0d18` on `integration/rust-kickoff-01`. R0-A/R0-B acceptance, exact submitted revisions and checks are retained in that commit's status note. Both new worker branches start at the same documentation-only child containing these requirements and assignments. The launch prompts identify that exact startup revision; record it before editing.

**Preparation checks:** Rust build, formatting, clippy and the existing native test passed; `npm test` passed type checking, build and 655/655 tests without skips. The three edited Markdown files passed active diagnostics. These are baseline checks, not implementation or conformance evidence for R1.

**Integration worktree:** `/home/canina7/Projects/changekernel-workers/integration`. Preserve the original checkout and the completed R0 worker branches/worktrees. Use only your newly assigned branch and directory below.

**Frozen shared inputs:** `tests/adapters/sqlite/intake-conformance.json` and `tests/adapters/sqlite/container-intake.test.mjs`. Neither worker changes them. R1-A consumes the four existing semantic cases. R1-B adds a separate recovery corpus against the existing TypeScript reference; its new cases are not automatically Rust-conformant or an input dependency of R1-A. Porting them to Rust requires a later assignment against the reviewed native interface, not an unreviewed branch dependency.

R1-A alone owns Rust module composition, persistence interfaces, manifests, lockfile and Rust coverage guards. R1-B owns only its new test files. No shared production interface is being implemented independently by both workers. Report any newly discovered overlap or requirement ambiguity before affected work continues.

## R1-A — First durable native intake

**Worker:** A. **Branch:** `work/rust-intake`. **Worktree:** `/home/canina7/Projects/changekernel-workers/rust-intake`. **Depends on:** the shared checkpoint and frozen cases, not R1-B.

**Outcome:** a bounded Rust library capability that creates/opens owned containers and retains/reads exact retry-bound intent in persistent SQLite, while the native launcher remains non-operational.

**Requirements:** [native Rust intake](.changekernel/wiki/items/system/components/state.md#native-rust-intake), [package/dependency boundary](.changekernel/wiki/items/system/components/package.md#native-rust-bootstrap), and [source layout](.changekernel/wiki/items/product/changekernel.md#repository-representation). The linked contract deliberately permits absent Why and exact Unicode rather than imposing all prototype validation restrictions.

**Owned paths:** `Cargo.toml`, `Cargo.lock`, `README.md`, `src/lib.rs`, `src/kernel/containers/intake.rs`, `src/application/intake.rs`, `src/ports/container_intake.rs`, `src/adapters/sqlite/container_intake.rs`, `tests/kernel/containers/native_intake.rs`, `tests/adapters/sqlite/native_intake.rs`, optional `tests/adapters/sqlite/native_intake_process.rs`, `tests/kernel/invariants/architecture.test.mjs`, and `tests/package/native-bootstrap.test.mjs`. Also own additions to State's ownership frontmatter for actual new paths, not requirement changes, and your return section below. Do not add module shells or another production executable.

**Acceptance:**

- Implement the linked operation, authority, validation, retention, retry and schema-refusal semantics. Keep Kernel effects separate from the persistence adapter; use the smallest typed boundary and curated library exports needed for these operations.
- Exercise the existing four JSON cases through a thin native runner, consuming their input/expected data rather than copying fixture values. Demonstrate that a deliberately wrong expectation fails, using a disposable copy or in-memory mutation without changing the frozen files. Keep SQLite schema inspections and fault mechanisms separate from portable expectations. Cover fresh-process and concurrent identical retries and failed insertion followed by repair/retry.
- Add native-specific tests for absent versus present-empty Why, exact whitespace/non-normalized Unicode, bounds, malformed input, denied access, retained corruption, incompatible/partial/native-versus-prototype schema refusal, existing-store reopen without recreation, and no silent overwrite or repair. A stored digest is not a tamper-proofing claim.
- Select and lock compatible versions of only the direct dependencies allowed by the package contract. Keep Rust `1.88.0`, the package version and JavaScript dependencies unchanged. Preserve TypeScript architecture checks and add explicit ownership/bounded coverage for every new Rust source and test; do not replace guards with blanket Rust exclusions or add a generalized analyzer.
- Update only README capability/build notes for the delivered native intake, preserving the unqualified boundary and TypeScript reference distinctions; link requirements rather than duplicating Wiki.
- Pass `cargo build --locked`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked --all-targets`, `npm test`, and `git diff --check`. Verify that native build/run need no Node or Pi, and that launcher behavior and absence of application effects remain unchanged. Report tool/dependency versions and actual test coverage.

**Excluded:** operational launcher/transport, terminal client, ownership transfer, intent revisions, candidate/Check/Work lifecycle, Pi execution, source publication, historical import/migration, TypeScript production changes, release packaging and controller operations.

**Return R1-A:** pending.

## R1-B — Interrupted and competing intake challenges

**Worker:** B. **Branch:** `work/intake-recovery`. **Worktree:** `/home/canina7/Projects/changekernel-workers/intake-recovery`. **Depends on:** the shared checkpoint and existing TypeScript reference, not R1-A or a Rust toolchain.

**Outcome:** a small portable recovery case set with a thin TypeScript SQLite reference runner, targeting gaps beyond the four frozen cases rather than duplicating them.

**Requirements:** the retry/recovery semantics in [native Rust intake](.changekernel/wiki/items/system/components/state.md#native-rust-intake), [continuation obligations](.changekernel/wiki/items/system/components/state.md#recovery-and-continuation-obligations), and [qualification limits](.changekernel/wiki/items/system/components/package.md#qualification). Prototype-specific validation and schema details are not new Rust requirements.

**Owned paths:** `tests/adapters/sqlite/intake-recovery-conformance.json`, `tests/adapters/sqlite/intake-recovery.test.mjs`, optional `tests/adapters/sqlite/intake-recovery-process.mjs`, and your return section below.

**Acceptance:**

- Cover four concrete scenarios: a committed proposal whose caller reply is lost after child-process termination; concurrent first proposals with one retry identity but different Why, yielding one winner and one conflict; a write-lock timeout followed by release and same-identity retry; and the same request identifier in independently owned containers, with independent retained intent and denied cross-owner access.
- Reopen in a fresh process where relevant. Check stable scoped references, exact retained intent, no duplicates and no loser overwrite. Do not require a particular race winner, globally distinct bare Change identifiers, prototype hashes/table layouts, or exact diagnostic prose in portable JSON.
- Keep trusted actor context separate from submitted content. Use explicit child readiness/release handshakes, bounded waits and reliable child cleanup, not sleeps as proof of ordering. Control storage locks/faults only in the reference runner and only in disposable external directories. Do not claim mid-transaction or physical power-loss coverage from an after-commit termination.
- Exercise every declared case without silent skips. Mutate an expected result to demonstrate a failing assertion, then restore it. Run the focused old/new intake suites, `npm test`, and `git diff --check`; report actual results and coverage gaps. Reference success is not Rust conformance.

**Excluded:** production changes, changes to the frozen cases/runner, Rust code or interfaces, manifests/dependencies, new testing frameworks/workflow languages, native schema design, broadened intake features, and weakened checks. If a reference defect blocks a case, report it with evidence instead of fixing production or weakening the expectation.

**Return R1-B:** pending.

## Return and review

Each worktree uses its own dependencies, generated files and temporary resources; do not link or modify another checkout's generated files. Use an existing external Rust `1.88.0` toolchain or an isolated installation outside the repository without administrator access/global-default changes. R1-B needs no Rust setup. Preserve pinned JavaScript dependencies, including Pi `0.85.1`.

Commit implementation first, then commit only your return section naming the implementation revision, startup revision, actual checks/results and gaps. Stop for project-manager review; do not merge, rebase, push, change branches or start another slice. The project manager consolidates returns, reviews exact revisions and verifies the combined result before acceptance.

These are unqualified source-development assignments. No mutable-checkout controller, live inference, deployment, activation or authority handoff is authorized. Durable requirements belong in Wiki; completed handoffs remain in Git. Changes and Work replace this temporary note only after qualified external-controller handoff.
