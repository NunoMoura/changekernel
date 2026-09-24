# ChangeKernel source-development status

**Target:** the smallest qualified Rust product for external self-development, not TypeScript feature parity. [Primary design](.changekernel/wiki/items/product/changekernel.md) owns intent; [first-release acceptance](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) owns the delivery criteria. Existing Changes and archives remain historical evidence. Intake and candidate preparation are not assessment, publication, or adoption.

## Kickoff baseline

**Responsible:** project manager. **Assignments:** R0-B is accepted on the integration branch below; R0-A remains unreviewed.

**Source checkpoint:** `9706fda00c31169cec07761cb679ea84e069337d` (`bootstrap/rust-kickoff-01`). This preserves the current source and design without moving the original branch or changing its staging area. Both worker branches start at the same documentation-only child containing these assignments; record that initial `HEAD` before editing.

**Verification:** baseline code passed `npm test`: type checking, build, and 654 tests with no skips. After the bootstrap design addition, the source-design, architecture, and package suites passed all 26 tests; `git diff --check` passed. No Rust toolchain was found on the session command path. This is engineering evidence, not release qualification.

**Integration:** `integration/rust-kickoff-01` at `/home/canina7/Projects/changekernel-workers/integration` contains the reviewed R0-B implementation, `89bb3a03ff35a4d463bd59a686535609a8286bee`, and this consolidated handoff. The original checkout's branch and staging area are unchanged; neither worker branch was modified. R0-A is not integrated, and the combined R0-A/R0-B result remains unverified.

## R0-A — Rust build and native launcher

**Worker:** A. **Branch:** `work/rust-bootstrap`. **Worktree:** `/home/canina7/Projects/changekernel-workers/rust-bootstrap`. **Depends on:** source checkpoint only; not R0-B.

**Outcome:** a reproducible native library/executable build with honest bootstrap commands, ready for the first engine capability.

**Requirements:** [repository representation](.changekernel/wiki/items/product/changekernel.md#repository-representation), [native bootstrap](.changekernel/wiki/items/system/components/package.md#native-rust-bootstrap), and the source-development boundary in that release contract.

**Owned paths:** `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`, `.gitignore`, `src/lib.rs`, `src/main.rs`, `tests/package/native_bootstrap.rs`, `tests/package/native-bootstrap.test.mjs`, and `tests/kernel/invariants/architecture.test.mjs`. You also own additions to the release contract's ownership frontmatter for these actual paths, not its requirements, plus this assignment's return section.

**Acceptance:**

- One private Cargo package, exact tested toolchain pin, retained lockfile, and no third-party Rust dependencies. Add only necessary files, not future module shells. Ignore build outputs.
- Library/build metadata and launcher behavior match the linked bootstrap contract. Test supported arguments, unsupported combinations, and absence of application-source/storage effects in disposable external directories.
- Preserve existing TypeScript guards. Separate language-specific analysis explicitly; do not parse Rust as TypeScript or silently leave new Rust files without ownership and bounded bootstrap coverage. No generalized Rust analyzer is requested.
- Pass `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, `cargo test --locked --all-targets`, `npm test`, and `git diff --check`. Document exact setup and tool versions. An isolated toolchain installation outside the repository is permitted; do not use administrator access or change global toolchain defaults.

**Excluded:** engine/domain implementation, database selection, terminal framework, JavaScript launcher or dependency changes, packaging, activation, and controller handoff.

**Return:** pending.

## R0-B — Reusable intake conformance cases

**Worker:** B. **Branch:** `work/intake-conformance`. **Worktree:** `/home/canina7/Projects/changekernel-workers/intake-conformance`. **Depends on:** source checkpoint only; no Rust toolchain or R0-A changes required.

**Outcome:** a small language-neutral intake case set exercised by the existing TypeScript SQLite reference, reusable when the Rust intake slice is assigned.

**Requirements:** [State and persistence](.changekernel/wiki/items/system/components/state.md#recovery-and-continuation-obligations), [release challenge matrix](.changekernel/wiki/items/system/components/package.md#qualification), and the existing `tests/adapters/sqlite/container-intake.test.mjs` safeguards.

**Owned paths:** `tests/adapters/sqlite/container-intake.test.mjs`, `tests/adapters/sqlite/intake-conformance.json`, optional `tests/adapters/sqlite/intake-conformance.mjs`, and this assignment's return section.

**Acceptance:**

- Extract reusable scenario data into plain JSON and exercise it through a thin reference runner. Do not add a test framework or workflow language, or merely duplicate the existing suite.
- Cover exact What/Why retention and reopening, trusted-actor/container isolation, identical-request retries without duplicate records, conflicting retry content without overwrite, fresh-process/concurrent retry, and failed insertion followed by repair and retry. Preserve existing malformed-input, corruption, and unsupported-schema tests.
- Keep trusted actor context separate from submitted proposal content. Express shared expectations semantically; do not freeze prototype hashes, table layouts, error prose, or every prototype input restriction as Rust requirements. Keep implementation-specific checks distinct.
- Demonstrate that changing a case's expected result makes its check fail, then restore it. Run the focused intake tests, `npm test`, and `git diff --check`; report coverage and remaining gaps. Do not claim Rust conformance from a TypeScript run.

**Excluded:** production-code changes, Rust interfaces or storage schemas, historical protocol changes, new intake features, and weakened checks.

**Return:** Worker B submitted implementation `89bb3a03ff35a4d463bd59a686535609a8286bee` and return `b2a5be5f80a69e7740d3523290459a2122a67230`, from startup `0cddf5144e2a51b5cf640508e35127f9aa6db378`.

**Review (project manager): accepted.** No blocking findings in `tests/adapters/sqlite/intake-conformance.json` or `tests/adapters/sqlite/container-intake.test.mjs`. Required safeguards remain exercised; the two process scenarios were combined without dropping their checks. No production or dependency changes, prototype hashes, table layouts, or error prose were added to the shared JSON expectations.

**Independent checks:** Node `v24.14.0`, npm `11.9.0`, separate dependencies installed with `npm ci --no-audit --no-fund`. Focused intake tests passed 5/5; `node --check` passed. All seven expected-result fields were individually changed to wrong values; each caused an assertion failure, and exact original bytes were restored. `npm test` passed type checking, build, and 653/653 tests without skips both at the exact submitted implementation and after integration. `git diff --check` passed.

**Gaps:** This accepts only the TypeScript reference-case slice, not Rust conformance or release qualification. Physical crash/power-loss durability and broader recovery are not established. Active language-server probes of the two changed files returned no diagnostics but could not confirm clean files.

**Next:** Worker B waits for another assignment; no fixes requested. Review R0-A separately and verify the combined result after integration before advancing the Rust implementation.

## Return and review

Use each worktree's own dependencies and temporary test resources; do not modify or link another checkout's generated files. Preserve the pinned JavaScript dependencies, including Pi 0.85.1. Commit implementation first, then commit a return here naming the implementation revision, startup revision, actual checks/results, and gaps. Edit only your return section; stop for review or record a blocker there. Do not merge, rebase, push, or start another slice.

The project manager reviews each exact revision, integrates code without replacing the main handoff note, and verifies the combined result before acceptance. These are source-development assignments only: no mutable-checkout controller, live inference, deployment, activation, or authority handoff is authorized. Changes and Work replace this temporary note after qualified external-controller handoff.
