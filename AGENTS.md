# ChangeKernel

ChangeKernel is a [State-and-Change engine](.changekernel/wiki/items/product/changekernel.md) for continuous application development, use, and improvement.

Use your session's assigned role; ask if unclear. The user owns product intent.

## Coordination

Use [CHANGEKERNEL_STATUS.md](CHANGEKERNEL_STATUS.md) for all inter-agent handoffs; workers report in their own worktree copies. The project manager consolidates handoffs and integrates code; do not merge handoff files wholesale. Link Wiki requirements rather than copying them; Git preserves completed handoffs.

Direct notifications must be identified as peer messages and point to exact assignments, reports or verdicts. Verify the current recipient session and assigned worktree before sending; correlate acknowledgments and do not blindly retry uncertain delivery. A message, process exit or idle label is not user intent, acceptance or permission to expand scope. Keep transient routing identities and transport acknowledgments outside project Git.

## Project manager

- Start in the integration worktree and verify its branch. Prepare next handoffs while workers run. Mark provisional baselines explicitly; dispatch is not acceptance.
- Create each worker's branch and external worktree from the agreed checkpoint. Record branch, worktree path, and base commit in its assignment. Launch or relaunch its Pi process from that worktree and verify the native process cwd, session cwd and Git checkpoint before dispatch; absolute paths or `git -C` do not relocate tool defaults, instructions or project-resource discovery.
- Define each slice's outcome, dependencies, owned paths, requirement references, and acceptance checks. Parallelize only ready, independent slices with non-overlapping write scopes and agreed shared interfaces. Give shared contracts, manifests, and lockfiles one owner; serialize conflicting work. Resolve ambiguous product intent or safety guarantees with the user.
- Keep the managed developer-worker pool at or below 15 agents, including delegated workers and parked sessions retained for reuse. This is a ceiling, not a target or a product-runtime limit. Choose the active count from ready independent work, bottlenecks and review/integration capacity; do not invent assignments to occupy workers. Pause dependent work when its baseline fails review.
- Drive routine assignment, review and integration within the approved scope without seeking approval for every scheduling decision. Bring unresolved product intent, safety guarantees and separately gated experiments or deployment back to the user; more workers do not waive those gates.
- Independently review each submitted revision and run relevant checks. Verify the combined result after integration before final acceptance. Return fixes to the worker.
- Record the verdict (`accepted`, `changes requested`, or `blocked`), findings with paths, checks run and gaps, and next action; summarize to the user. Only you accept or advance slices.

## Worker

- Think Before Coding
- Simplicity First
- Surgical Changes
- Goal-Driven Execution

- Verify the assigned branch, worktree and Pi process cwd before editing. If the session is rooted elsewhere, stop for manager-led relaunch rather than relying on absolute paths or `git -C`. Commit only assigned changes there; do not switch branches, merge, rebase, or push without the project manager's instruction.
- Implement only the assigned slice and tests within owned paths. Report missing assignments, unclear requirements, or newly discovered overlap/dependencies before affected work continues. Do not change scope, shared interfaces, requirements, or acceptance criteria without coordination.
- Return the code revision, changes, actual check results, and gaps. Address findings and resubmit; never self-approve or start another slice. Do not spawn or reassign workers without the project manager's instruction.

## Source testing

- Use `cargo test --locked` for native unit, integration and documentation tests. Use ordinary `#[test]` functions; colocate small unit tests under `#[cfg(test)]` and keep filesystem/process/storage boundaries in Cargo integration tests.
- Before native acceptance, run `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings`. A separate build is needed for an artifact/build claim, not as a duplicate prerequisite to every test run.
- Run `npm test` only for retained TypeScript adapter changes, their dependencies or a changed integration boundary. It typechecks the narrow Pi adapter closure and runs its tests; Rust-only slices do not require Node, npm or a legacy TypeScript build.
- Test observable behavior and consequential failure boundaries. Retain regressions for authorization, exact source identity, recovery/idempotency and cleanup; do not test compiler guarantees, file inventories, documentation wording or duplicate implementations for parity. No test-count target, blanket coverage quota, mandatory mutation ritual or extra testing framework.
- Independent review may use focused disposable probes. Add a tool or a permanent test only for a concrete risk not already covered. Release qualification is separate from routine source checks; see the [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy).

## Controller boundary

Never load this checkout as its controller. Governed operations require the designated qualified, immutable external release and explicit handoff; stop if unavailable. Before handoff, use native source-development tools.
