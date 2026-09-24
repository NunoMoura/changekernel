# ChangeKernel source-development status

**Target:** the smallest qualified Rust product for external self-development, not TypeScript feature parity. [Primary design](.changekernel/wiki/items/product/changekernel.md) owns intent; [first-release acceptance](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) owns delivery criteria. Existing Changes and archives remain historical evidence.

## Current handoff

**Status:** R0-A and R0-B are accepted. Their combined implementation passed independent checks at `53b2567f10b8a984007415963ff42a9bfce8256b`.

**Integration:** branch `integration/rust-kickoff-01`, worktree `/home/canina7/Projects/changekernel-workers/integration`. The original `audit/clean-baseline` checkout remains at `de55797fc2e565639a635f345124407f42da73e1`; its existing source changes and staging area were preserved. The project manager did not modify either worker branch or merge worker handoff files wholesale.

**Next:** the project manager must define the first bounded durable Rust intake contract and its storage/retry responsibilities in Wiki, then assign work from the integrated checkpoint. Agree on shared interfaces and ownership before parallel implementation. Both workers wait for new assignments; neither may advance itself. No engine implementation is assigned yet.

Worker locations remain:

| Worker | Branch | Worktree |
| --- | --- | --- |
| A | `work/rust-bootstrap` | `/home/canina7/Projects/changekernel-workers/rust-bootstrap` |
| B | `work/intake-conformance` | `/home/canina7/Projects/changekernel-workers/intake-conformance` |

## Accepted reviews

| Slice | Implementation | Worker return | Project-manager verdict |
| --- | --- | --- | --- |
| R0-A: native bootstrap | `c259c87128f9288478afa121450ccac1aeb6905b` | `eccca9fd9e5fbb92f6e4a9e51c63fc8017e83ec9` | accepted |
| R0-B: intake reference cases | `89bb3a03ff35a4d463bd59a686535609a8286bee` | `b2a5be5f80a69e7740d3523290459a2122a67230` | accepted |

**Findings:** no blocking findings. R0-A's `Cargo.toml`, lockfile, toolchain pin, `src/lib.rs`, `src/main.rs`, native tests and `tests/kernel/invariants/architecture.test.mjs` satisfy the bounded bootstrap assignment. Wiki changes only add ownership mappings. R0-B's `tests/adapters/sqlite/intake-conformance.json` and reference runner retain the required intake safeguards. Both implementations remain byte-identical to their reviewed revisions in the combined result; no fixes are requested.

Original assignments are retained in `0cddf5144e2a51b5cf640508e35127f9aa6db378:CHANGEKERNEL_STATUS.md`. The earlier R0-B review is retained in `383495d1d75af49c54bfa6b807b1a483d3861a84:CHANGEKERNEL_STATUS.md`.

## Independent verification

- At the exact R0-A implementation and again after integration: `cargo build --locked`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, and `cargo test --locked --all-targets` passed. There is one native integration test; library and executable unit-test targets contain no tests.
- `npm test` passed type checking, build and all 656 tests at R0-A, then all 655 tests in the combined result, without skips. R0-B combines two previous process tests, explaining the count difference. JavaScript syntax and `git diff --check` checks passed.
- A separate native-only external project built and tested offline without JavaScript assets or Node/Pi on its command path. Fourteen launcher probes with an empty command path passed, including invalid Unicode arguments; external application source/storage fixture bytes and entries remained unchanged.
- Four deliberate guard violations were rejected: an unlisted Rust source, an unknown source language, an unlisted Rust test, and a TypeScript kernel import of Node filesystem functionality. All temporary files were removed.
- The earlier independent R0-B review passed 5/5 focused tests and 653/653 full-suite tests. All seven altered expected-result fields caused assertion failures; exact original bytes were restored. Those reviewed files were preserved during integration.
- Active language-server probes reported no diagnostics for the five changed code files but could not confirm they were clean. Compiler, linter and executable checks provide the confirmed results above.

**Review environment:** Linux; rustup `1.29.1`, rustc `1.88.0` (`6b00bc388`), cargo `1.88.0` (`873a06493`), clippy `0.1.88`, rustfmt `1.8.0-stable`; Node `v24.14.0`, npm `11.9.0`. Review dependencies were installed separately with `npm ci --no-audit --no-fund`. The manager installed the pinned Rust toolchain outside the repository without administrator access or global-default changes; the temporary environment setup is `/tmp/changekernel-r0a-review-tools.5VMgXF/env.sh`. Recreate an isolated installation if that temporary setup is unavailable.

**Limits:** this accepts a non-operational native bootstrap and TypeScript reference cases, not Rust intake conformance, an engine lifecycle, physical crash/power-loss recovery, cross-platform support or release qualification. No release packaging, activation, live inference or controller handoff occurred. Never load this mutable checkout as its controller. Qualification, activation and explicit external-controller handoff remain separate decisions.
