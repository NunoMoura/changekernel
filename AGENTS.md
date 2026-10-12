# ChangeKernel

ChangeKernel is a [State-and-Change engine](.changekernel/wiki/items/product/changekernel.md) for continuous application development, use, and improvement.

Use your session's assigned role; ask if unclear. The user owns product intent.

## Canonical checkout and branches

The primary `changekernel/` checkout on `main` is the accepted development baseline. Read its Wiki for current adopted design and its source/tests for the integrated implementation; neither implies release qualification. Keep this checkout current when accepted work is integrated.

Sibling `changekernel-workers/<assignment>/` directories are isolated Git worktrees for assigned changes or review, not additional canonical repositories or independently synchronized Wikis. Their contents belong to their exact branches/checkpoints. Integrate reviewed changes into `main`; do not maintain a permanently newer manager branch hidden among worker directories or copy Wiki files between checkouts to simulate synchronization.

Preserve uncommitted work and unique commits before changing or retiring a checkout. Historical worktrees and their ignored artifacts may be archived outside the project, with checkpoint/path evidence retained; do not treat archival as acceptance, custody transfer or permission to reopen old runtime state. Relaunch the manager or worker when its working directory changes, then verify native cwd, session cwd, branch and checkpoint before continuing.

## Coordination

Use [CHANGEKERNEL_STATUS.md](CHANGEKERNEL_STATUS.md) for all inter-agent handoffs; workers report in their own worktree copies. The project manager consolidates handoffs and integrates code; do not merge handoff files wholesale. Link Wiki requirements rather than copying them; Git preserves completed handoffs.

Direct notifications must be identified as peer messages and point to exact assignments, reports or verdicts. Verify the current recipient session and assigned worktree before sending; correlate acknowledgments and do not blindly retry uncertain delivery. A message, process exit or idle label is not user intent, acceptance or permission to expand scope. Keep transient routing identities and transport acknowledgments outside project Git.

## Project manager

- Start in the primary `changekernel/` checkout on `main` and verify its branch. Use a separate temporary integration candidate only when explicitly identified; accepted work must return to the primary checkout. Prepare next handoffs while workers run. Mark provisional baselines explicitly; dispatch is not acceptance.
- Create each worker's branch and external worktree from the agreed checkpoint. Record branch, worktree path, and base commit in its assignment. Launch or relaunch its Pi process from that worktree and verify the native process cwd, session cwd and Git checkpoint before dispatch; absolute paths or `git -C` do not relocate tool defaults, instructions or project-resource discovery.
- Define each slice's outcome, dependencies, owned paths, requirement references, and acceptance checks. Parallelize only ready, independent slices with non-overlapping write scopes and agreed shared interfaces. Give shared contracts, manifests, and lockfiles one owner; serialize conflicting work. Resolve ambiguous product intent or safety guarantees with the user.
- Keep the managed developer-worker pool at or below 15 agents, including delegated workers and parked sessions retained for reuse. This is a ceiling, not a target or a product-runtime limit. Choose the active count from ready independent work, bottlenecks and review/integration capacity; do not invent assignments to occupy workers. Pause dependent work when its baseline fails review.
- Decide when to reuse a session or start a fresh one. Reuse verified sessions when their context and worktree remain suitable; prefer fresh sessions for a different worktree, independent investigation or stale/confounding state. A new conversation does not relocate the native process: relaunch from the assigned worktree when it changes. Preserve retired session/checkpoint evidence, and count every retained parked worker toward the pool limit.
- Drive routine assignment, review and integration within the approved scope without seeking approval for every scheduling decision. Bring unresolved product intent, safety guarantees and separately gated experiments or deployment back to the user; more workers do not waive those gates.
- On a worker submission or blocker notification, acknowledge the exact report and drive the next review, correction or ready assignment without waiting for the user to relay completion. Do not acknowledge acknowledgments or treat notification as acceptance. Pause only for a real dependency, unavailable authority or a user-owned decision.
- Independently review each submitted revision and run relevant checks. Verify the combined result after integration before final acceptance. Return fixes to the worker.
- Record the verdict (`accepted`, `changes requested`, or `blocked`), findings with paths, checks run and gaps, and next action; summarize to the user. Only you accept or advance slices.

## Worker

- Think Before Coding
- Simplicity First
- Surgical Changes
- Goal-Driven Execution

- Verify the assigned branch, worktree and Pi process cwd before editing. If the session is rooted elsewhere, stop for manager-led relaunch rather than relying on absolute paths or `git -C`. Commit only assigned changes there; do not switch branches, merge, rebase, or push without the project manager's instruction.
- Implement only the assigned slice and tests within owned paths. Report missing assignments, unclear requirements, or newly discovered overlap/dependencies before affected work continues. Do not change scope, shared interfaces, requirements, or acceptance criteria without coordination.
- Return the code revision, changes, actual check results, and gaps. After committing a submission, or recording a material blocker, send the manager one direct peer notification with the assignment, exact report revision/path, source revision when applicable, and completion or blocker summary. Follow the recipient-verification and acknowledgment rules above; do not send completion notifications for acknowledgment-only turns or blindly retry uncertain delivery. Remain parked until the manager responds.
- Address findings and resubmit; never self-approve or start another slice. Do not spawn or reassign workers without the project manager's instruction.

## Source testing

- Use `cargo test --locked` for native unit, integration and documentation tests. Use ordinary `#[test]` functions; colocate small unit tests under `#[cfg(test)]` and keep filesystem/process/storage boundaries in Cargo integration tests.
- Before native acceptance, run `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings`. A separate build is needed for an artifact/build claim, not as a duplicate prerequisite to every test run.
- Run `npm test` only for retained TypeScript adapter changes, their dependencies or a changed integration boundary. It typechecks the narrow Pi adapter closure and runs its tests; Rust-only slices do not require Node, npm or a legacy TypeScript build.
- Test observable behavior and consequential failure boundaries. Retain regressions for authorization, exact source identity, recovery/idempotency and cleanup; do not test compiler guarantees, file inventories, documentation wording or duplicate implementations for parity. No test-count target, blanket coverage quota, mandatory mutation ritual or extra testing framework.
- Independent review may use focused disposable probes. Add a tool or a permanent test only for a concrete risk not already covered. Release qualification is separate from routine source checks; see the [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy).
- When analyzer and native results disagree, compare exact source, worktree, toolchain, targets/features and Cargo-cache provenance before changing code. Preserve failing cache/log evidence before scoped invalidation; verify rebuilds against unchanged source bytes. Cold workspace findings, Cargo push diagnostics and semantic pull results are distinct signals: wait for the relevant work to complete, and do not treat an empty pull or Cargo's `Fresh` label as proof of the whole subject.

## Pi-native tooling

- Prefer Codemode for tool composition, independent batches and reducing large results before they enter context. Preserve the source bodies and evidence needed for the decision, inspect each nested result, and do not treat script completion as operation success or cancellation as rollback. Use direct tools when Codemode is unavailable or adds no benefit.
- Verify Codemode is exposed before manager/worker dispatch. Pi supports `defaultTools: ["+codemode"]`; existing sessions need `/reload`. Launches using `--no-extensions` must explicitly include `-e builtin:codemode`, and explicit tool allowlists must include `codemode`. Use the installed built-in capability, not a duplicate project-local plugin.
- Use other available Pi capabilities where they help the assigned work. Tool availability does not expand scope, resume paused implementation, authorize separately gated inference/experiments or transfer controller authority.

## TypeSafe development

For TypeSafe/Jev design, experiments and integration work, load the globally installed `typesafe-ai` skill and follow its current documentation index, relevant API/primitive guidance and closest cookbook. Keep the skill outside this checkout; do not add project-local copies or package links. Project contracts, authorized experiment scope, credential handling and controller boundaries still govern; provider examples do not authorize extra calls or change frozen APIs.

## Controller boundary

Never load this checkout as its controller. Governed operations require the designated qualified, immutable external release and explicit handoff; stop if unavailable. Before handoff, use native source-development tools.
