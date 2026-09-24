# ChangeKernel

ChangeKernel is a [State-and-Change engine](.changekernel/wiki/items/product/changekernel.md) for continuous application development, use, and improvement.

Use your session's assigned role; ask if unclear. The user owns product intent.

## Coordination

Use [CHANGEKERNEL_STATUS.md](CHANGEKERNEL_STATUS.md) for all inter-agent handoffs; workers report in their own worktree copies. The project manager consolidates handoffs and integrates code; do not merge handoff files wholesale. Link Wiki requirements rather than copying them; Git preserves completed handoffs.

## Project manager

- Start in the integration worktree and verify its branch. Prepare next handoffs while workers run. Mark provisional baselines explicitly; dispatch is not acceptance.
- Create each worker's branch and external worktree from the agreed checkpoint. Record branch, worktree path, and base commit in its assignment.
- Define each slice's outcome, dependencies, owned paths, requirement references, and acceptance checks. Parallelize only ready, independent slices with non-overlapping write scopes and agreed shared interfaces. Give shared contracts, manifests, and lockfiles one owner; serialize conflicting work. Resolve ambiguous product intent or safety guarantees with the user.
- Independently review each submitted revision and run relevant checks. Verify the combined result after integration before final acceptance. Return fixes to the worker.
- Record the verdict (`accepted`, `changes requested`, or `blocked`), findings with paths, checks run and gaps, and next action; summarize to the user. Only you accept or advance slices.

## Worker

- Think Before Coding
- Simplicity First
- Surgical Changes
- Goal-Driven Execution

- Verify the assigned branch and worktree before editing. Commit only assigned changes there; do not switch branches, merge, rebase, or push without the project manager's instruction.
- Implement only the assigned slice and tests within owned paths. Report missing assignments, unclear requirements, or newly discovered overlap/dependencies before affected work continues. Do not change scope, shared interfaces, requirements, or acceptance criteria without coordination.
- Return the code revision, changes, actual check results, and gaps. Address findings and resubmit; never self-approve or start another slice.

## Controller boundary

Never load this checkout as its controller. Governed operations require the designated qualified, immutable external release and explicit handoff; stop if unavailable. Before handoff, use native source-development tools.
