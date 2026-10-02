# ChangeKernel source status

## Current gate — R20 accepted for implementation; R21 not yet dispatched

The user authorized continued core-first development and routine delegation through Herdr. The manager has reviewed the corrected proposal, its independent challenge and the combined integration result. The [consumed opening profile](.changekernel/wiki/items/system/components/state.md#consumed-opening-profile) is now the selected implementation contract for **opening → inspection → restart/reopen → original-key retry**, using one trusted Rust test host, one authenticated fixture user, one provisioned slot and no application effects.

This accepts a bounded contract and dependency baseline, not executable JSONL behavior, host qualification or completion of [Phase 1](.changekernel/wiki/items/product/plan.md#phase-1--a-durable-inspectable-change-without-effects). Revisions, Decision and Planning remain later Phase 1 obligations. No model, privileged service, VM/BPF, generic framework, legacy migration or release activation is introduced. The next ready slice has one cohesive implementation owner; its assignment and external worktree will follow this checkpoint.

The user's history clarification at `aaa81bf809b6de9faa34cc5d441393d8d7ede397` is preserved byte-for-byte in the pre-existing State body. Change history means accepted Trace records, not a separate History entity/database. Native State remains in the application's database/filesystem; supporting custody controls and referenced evidence are not another lifecycle history.

## Manager verdicts

| Exact submission | Verdict and bounded finding | Next action |
| --- | --- | --- |
| R20-V, `00fe2296540dcced9c533f654dc26f3abbd07f6c` | **accepted** as a compatibility/acceptance matrix. Existing Rust meanings and 22 retained-compatibility tests were independently checked; no JSONL conformance follows. | Use the matrix for source review. |
| R20-P, `fa8ed353d587513b183431062dd82d601bf9eb6f`, challenged by R20-V2 `53ce8f1a6a1141dce88cc7cff9e2998fa9b12009` | **changes requested**, superseded by the correction below. Missing anchor-temporary recovery, Workspace/stage naming, derived-ID validation and codec/dependency closure required correction. | Preserve exact findings in Git, not as new open work. |
| R20-P2, `9d5644e3a873ea5bf488175212dd489aa94b254c` | **accepted for bounded implementation**, with the manager-owned dependency resolution below. All five findings are closed at contract level. Allowed anchor cleanup is grounded in the independent grant, authoritative anchor, pinned handles and initial inventory; torn/unrelated/noninitial cases refuse. No abandoned temporary becomes authority. Naming, captured-intent/result identity and concrete duplicate-aware/manual encoding are consistent. | Park the author; no source implementation was included or accepted. |
| R20-V3, `e3de73ae5fa68779acd4213ce8fb973c09d4e6d8` | **accepted** as exact-subject review. The manager independently walked its cutpoint and compatibility conclusions; no remaining protocol blocker for the bounded source fixture. Actual writer, guard, codec and filesystem behavior remain to be implemented and tested. | Park the reviewer for later exact code review. |

The manager integrated only the proposed State section, not either worker's handoff file or old pre-proposal State body. Normalization marks the section as the selected implementation contract and resolves manual Serde trait imports to `serde_core`; request, result, record and recovery semantics are unchanged. Original assignments/verdicts remain at `3c6063945ee805de5326c0d3f7b93182a2d4a521`, `caa4a7065bb2f309a1edcaec6bba9be77e3b7283`, `abcef937e31a0d3b6779fe61a9317f09c6c3c3a5` and `a9859fff05b502e02ccd66df204139b765acff17` in `CHANGEKERNEL_STATUS.md`.

## Manager-owned dependency closure

`Cargo.toml` promotes already pinned `serde_json = "=1.0.145"` to runtime and directly selects `serde_core = { version = "=1.0.229", default-features = false, features = ["std"] }`. The selected codec handwrites traits and uses no derive. Read-only inspection of the installed trait crate's public documentation explicitly permits this use; the `serde` facade re-exports those traits but is not required here. Use `serde_core::Deserialize`, `serde_core::de::{Visitor, MapAccess}` and `serde_core::ser::SerializeStruct` with the selected serde_json parser/formatter.

This is an explicit manager resolution of the proposal's dependency question, not an unreported tool workaround. The initial unfiltered offline Cargo metadata query refused an uncached proc-macro package; the proposed direct `serde` host graph likewise refused uncached `serde 1.0.229`. Neither fetched anything. The trait-only runtime graph then resolved and compiled entirely offline using already available packages. Its active features are `serde_core/std` and `serde_json/default,std`, without derive or extra JSON features. `Cargo.lock` changes only the root direct `serde_core` edge; every existing package, version, checksum and transitive edge is unchanged. No acquisition, tool repair, settings change or package upgrade occurred.

## Independent combined checks and limits

After the dependency resolution and State integration, the manager ran:

- `CARGO_NET_OFFLINE=true cargo tree -e features`: passed; verified the active host feature graph and exact lockfile delta. The two earlier offline refusals above are not reported as successful metadata qualification.
- `CARGO_NET_OFFLINE=true cargo test --locked`: the complete native suite and documentation targets passed. Three ignored packet child-entry helpers were exercised by their parent tests; this is not a skipped capability claim.
- `cargo fmt --check`: passed.
- `CARGO_NET_OFFLINE=true cargo clippy --locked --all-targets -- -D warnings`: passed.
- Scope, pre-existing State-body preservation and `git diff --check`: passed. Active State/Cargo/lib probes had no errors; three informational spelling suggestions concern the valid Rust `ser` module name. `Cargo.lock` has no configured LSP server; Cargo resolution/tests and exact lockfile review supply its check, not a clean diagnostic label.

These checks establish a regression-clean dependency baseline, not the unimplemented JSONL algorithm. No new source test, syscall/failure probe, artifact build claim, reboot, physical power-loss test, installed host, controller operation, privileged experiment or product-provider inference was performed. npm is unnecessary because the retained TypeScript adapter boundary is unchanged. Known native candidate-attribution, frozen writer and analyzer-readiness gaps remain unchanged.

## Coordination and source boundary

R20-P is parked on `work/r20-core-profile` at `/home/canina7/Projects/changekernel-workers/r20-core-profile`, clean report checkpoint `9d5644e3a873ea5bf488175212dd489aa94b254c`. R20-V is parked on `work/r20-core-validation` at `/home/canina7/Projects/changekernel-workers/r20-core-validation`, clean review checkpoint `e3de73ae5fa68779acd4213ce8fb973c09d4e6d8`. Acceptance does not assign another slice. Current pool: these two plus four previously retained sessions, six total, below the ceiling of 15. A new implementation owner will add one ready task, not parallel writers of shared contracts.

Older R19-N/R19-M/R18-N/R18-T worktrees remain parked. Exact prior reports and pending notification history remain at `e0e309dd6f37a4da5e4eadb298bbaa8ab190fccd:CHANGEKERNEL_STATUS.md` and in [research](.changekernel/wiki/items/system/research.md#exact-reports-and-retained-limits); no old work is silently resumed. Manager verifies live recipient process/session cwd, assigned worktree and checkpoint before each identified peer dispatch. Routing/session identifiers and correlated transport acknowledgments stay outside Git; uncertain delivery is never blindly retried.

[AGENTS.md](AGENTS.md) owns source procedure. Use native tools and source tests, not mutable checkout code as controller or governed Wiki operations. Only an exactly qualified immutable external Product release plus required activation and explicit controller handoff can govern a later candidate. A contract, test result, dispatch or release activation does not transfer controller authority.
