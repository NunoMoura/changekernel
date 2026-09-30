# ChangeKernel source-development handoff

Role: project manager in `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. The user owns product intent. [AGENTS.md](AGENTS.md) owns procedure; [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design. Never load this mutable checkout as controller.

## User alignment and R12 preparation

The user approved correcting the frontend wording, documenting state-triggered automation with the existing lexicon, and audited cleanup followed by bounded worker assignments. This continues from clean `b2b30b86d8783d0bd7727f4855b7ea49fe44fef5`; branch and native Pi cwd were verified. It does not approve a Pi-first product, a new tracked-container definition, source/host implementation with unresolved contracts or any separately gated experiment/deployment.

The Wiki now makes these decisions explicit:

- The [ChangeKernel-owned Rust terminal client](.changekernel/wiki/items/product/changekernel.md#operator-console-for-development), shared backend and orchestration remain the target. Ordinary workflow preservation is not replacement by Pi. Pi remains a development harness and retained adapter; client compatibility grants no worker authority.
- [State-triggered automation](.changekernel/wiki/items/product/changekernel.md#state-triggered-automation) inherits adopted standing intent and current delegation, uses scoped source observations, and enters the existing lifecycle. [Occurrence/retention grounds](.changekernel/wiki/items/system/components/state.md#scoped-monitoring-and-trigger-grounds), [runtime responsibilities](.changekernel/wiki/items/system/components/agent-execution.md#state-triggered-runtime-responsibilities) and ordinary Checks retain their separate roles. No new lexicon entity, automatic trading support or first-release scope expansion is selected.
- The local custody service, [lost-incident limit and recovery admission](.changekernel/wiki/items/system/components/state.md#first-local-recovery-profile), source permissions, qualification, activation and explicit controller-handoff gates remain unchanged.

**Verdict: accepted design clarification; cleanup/tooling dispatch not yet released at this preparation checkpoint.** Two independent slices are being prepared for retained workers A and C; B and D remain parked. Exact baselines, worktrees, ownership and acceptance checks will be recorded before dispatch. No worker may infer an assignment from this preparation note. The five-path documentation diff passed whitespace/scope review and active Markdown diagnostics with zero findings; no executable implementation changed.

## Cleanup audit and permitted direction

The manager inspected tracked/local layout, Cargo/npm entry points, module registration, TypeScript compiler-resolved imports and the candidate-schema reference. All 15 retained TypeScript source files are in the adapter closure; the 19 native source files contain the registered Rust foundation, not a restored TypeScript engine. `src/adapters/sqlite/file_candidate.rs::SCHEMA` is consumed by continuation initialization even though its writer is unintegrated. File names and the stale low-coverage review graph do not establish dead code.

The concrete initial hygiene allowlist is `README.md` (frontend/runtime wording and stale Jaz evaluation description), `.pi/.gitignore` (obsolete controller-file exception), and the obsolete assignment comment in `src/adapters/sqlite/file_candidate.rs` (comment only; schema bytes stay exact). Review other suspected obsolete implementation for evidence before requesting a wider removal scope. Preserve frozen SQLite semantics, retained Pi adapters, tests, historical records and archives. No wholesale rename/shuffle, new future folders, migration or candidate-writer integration.

Local empty directories and ignored generated output are distinct from tracked source. Only verified-empty source/test/bin directories may be removed with nonrecursive `rmdir`; do not sweep private runtime state, dependency installs, active tool caches or other worktrees. Shared manifests, lockfiles, Wiki, `AGENTS.md` and project Pi resources remain manager-owned unless a later assignment says otherwise; the narrow ignore-file hygiene exception will be explicit.

Fresh manager audit at `b2b30b86d` passed `cargo test --locked`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings` and the retained adapter TypeScript no-emit check. npm runtime tests were not run for this documentation/structure audit. Evidence: `/home/canina7/.local/state/ck-clarification-audit.0DJA3m/`. An active 41-file LSP sweep reported 76 errors, eight disposition/policy suppressions and 11 unconfirmed outcomes despite compiler success; reconcile exact tool/configuration behavior rather than rewriting valid source or suppressing categories to manufacture green. This does not repair the known retained-attribution defect or establish operational qualification.

## Remaining host/Trace blockers

**Verdict: blocked for dependent host/Trace implementation.** The complete helper credential establishment/launch, process/IPC/handle protection, enrollment/retirement and persistent source-identity mechanisms remain unselected. Numeric credentials or saved socket groups are insufficient. Managed login, repository relocation, permanent UID nonreuse, another authentication secret, an LSM/service manager or a witness must not be silently adopted. Present unavoidable costs with concrete alternatives if narrower mechanisms cannot satisfy the guarantees.

The manager still owns the closed opening/history operations, exact references/retries and complete Trace/checkpoint/control encoding, bounds, initialization, arbitration, acknowledgment and recovery composition. Keep the [file-first domain boundary](.changekernel/wiki/items/system/components/state.md#file-first-domain-interface-boundary) separate from frozen native continuation. R5-A remains frozen/unintegrated; R8-B Phase 2 remains unreleased. No generic repeat proposal report or disconnected authorization scaffold is owed.

The first complete delivery remains Linux-first software development on the sole developer's machine with one supported source, one active custodian, a small worker configuration and the owned operator console. Service-backed collaboration/borrowing remains the second-release direction. No installation, privilege/device experiment, product model call, deployment, release activation or controller handoff is authorized by these source assignments. Only a qualified immutable external release with explicit authority handoff may govern a later candidate.

## Retained pool and accepted evidence

Four developer workers are retained; the managed ceiling is 15, not a target. Reuse the existing pane pool without increasing active count beyond ready independent work. Every new assignment requires a manager-created branch/worktree, native and session cwd verification, exact checkpoint and correlated peer receipt; do not rely on `git -C` to relocate tool defaults. Transient routing and acknowledgments stay outside Git.

| Worker | Current worktree under `/home/canina7/Projects/changekernel-workers/` | Branch | Retained checkpoint |
| --- | --- | --- | --- |
| A | `local-packet-ingress` | `work/local-packet-ingress` | `9714ed0c59a6dec2f241c9c8059785269434e326` |
| B | `restart-trace-contract` | `work/restart-trace-contract` | `9aa6d02a8c436a9ae130c478ea3b086d19f9e285` |
| C | `linked-source-observer` | `work/linked-source-observer` | `e78deff1f3ffbd5dcd8a998c0cca813ecaaef99e` |
| D | `attempt-supervision-contract` | `work/attempt-supervision-contract` | `5421254d4563de3176d964eb18bca79d6786a56f` |

R11-L remains accepted as a bounded, unqualified local-packet library component, not a host or source-authority mechanism. The exact accepted code is `8f6679fcc703c057fc18707d5bde13f138205781`, report `9714ed0c59a6dec2f241c9c8059785269434e326`. Independent and combined native checks passed; qualification limits and prior accepted R10/R9/R8 evidence are preserved in `b2b30b86d8783d0bd7727f4855b7ea49fe44fef5:CHANGEKERNEL_STATUS.md`. R11 acceptance delivery was already correlated; no resend is needed. Private review/routing evidence remains under the recorded `ck-r11-*` and `ck-session-reanchor.*` state directories.
