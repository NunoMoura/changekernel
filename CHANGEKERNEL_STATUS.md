# ChangeKernel source-development handoff

Role: project manager in `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. The user owns product intent. [AGENTS.md](AGENTS.md) owns procedure; [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design. Use native source-development tools; never load this checkout as controller.

## First-host choices approved — shared contracts next

The user explicitly approved both choices proposed at `80c05d5d330654bae33652ef847863ad6be3eb3c:CHANGEKERNEL_STATUS.md`. Canonical desired design now selects an [administrator-installed local custody service](.changekernel/wiki/items/system/components/agent-execution.md#admission-and-containment) with a dedicated protection identity and the [first local recovery profile](.changekernel/wiki/items/system/components/state.md#first-local-recovery-profile), including its explicit lost-incident limit. The [delivery sequence](.changekernel/wiki/items/product/changekernel.md#first-dogfood-delivery-sequence) and [qualification requirements](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) are aligned. These are adopted design choices, not implementation or release acceptance. Do not ask the user to choose them again.

Next manager work is concrete contract composition for the protected opening/history increment: select the minimum native credential and isolation route; define installed root/enrollment/source identity, bounded typed requests and exact historical retry/result references; settle the versioned Trace/checkpoint/control inventory, sole-writer and first-root ordering, acknowledgment, recovery admission, and live/retained-incident handling under the newly approved limit. Resolve those shared interfaces before dependent implementation, then dispatch ready non-overlapping source slices to the existing workers. Do not mechanically adopt all R9-A operating mechanisms or copy the old witness-dependent R8-B state machine. No further generic proposal report is owed.

Four retained workers remain stopped. The manager retains shared contracts, Wiki, composition, manifests and lockfiles. Approval covers design only: no installation, privileged/device experiment, live inference, deployment, activation or controller handoff is authorized.

## Worker session cwd alignment — completed

The user authorized correcting the worker sessions' working directories. A, C and D were gracefully stopped and relaunched in their latest assigned worktrees, preserving history through Pi-native session forks. B was already aligned and was left unchanged. The managed pool remains four; no extra pane or implementation assignment was created.

| Worker | Actual Pi cwd under `/home/canina7/Projects/changekernel-workers/` | Assigned branch |
| --- | --- | --- |
| A | `host-admission-closure` | `work/host-admission-closure` |
| B | `restart-trace-contract` | `work/restart-trace-contract` |
| C | `linked-source-observer` | `work/linked-source-observer` |
| D | `attempt-supervision-contract` | `work/attempt-supervision-contract` |

The manager independently verified native process cwd, the new session headers, exact Git checkpoints and clean worker trees. A/C/D returned correlated acknowledgments confirming their actual tool cwd and exposed pi-lens tools; they remain parked. Routing identities, session paths and receipts are retained only in private state under `/home/canina7/.local/state/ck-session-reanchor.82feqa6y/`. Project resource autoloading was disabled for the relaunched sessions; the existing installed pi-lens and source-boundary instructions were supplied explicitly, without creating project-local package links or loading ChangeKernel. [AGENTS.md](AGENTS.md) now requires native/session cwd verification before dispatch; absolute paths and `git -C` are not substitutes.

Shared opening/history contracts remain the next implementation gate, not an assignment implied by session relocation. In particular, composition must distinguish the frozen [native continuation retry scope](.changekernel/wiki/items/system/components/state.md#native-continuation-api-and-storage-v1) from the desired file-first per-Change history: reusing data types cannot silently change retry identity or custody meaning. No new public/persistence format, source stub or operational host was introduced by this coordination repair.

## R10-S — completed

Accepted and integrated at `2bbfc98666a34dd6d9f2e2e2879614eef2c9524c`; final worker submission `e78deff1f3ffbd5dcd8a998c0cca813ecaaef99e`. The [explicit linked-source reader](.changekernel/wiki/items/system/components/state.md#explicit-linked-worktree-observation) and inherited lossy-native-path F1 repair passed independent review, the unchanged wrong-source probe, 38 native tests, fmt and clippy, including separate combined-source checks. Only the two exact code/test files were imported; the worker handoff was not merged wholesale. C acknowledged acceptance and stopped. Full verdict and checks are in that integration commit's handoff; this remains an unqualified read-only library extension, not a dogfood release. Seven Rust-analyzer errors were classified as false positives against pinned compiler evidence; analyzer root cause remains unresolved, so no clean-LSP claim. Private review, dispatch and correlated acceptance evidence remain under `/home/canina7/.local/state/ck-r10-review.fgvnwzap/`.

## Settled delivery scope

The first release remains local-only on the sole developer's machine. Service-backed collaboration/borrowing remains the second-release direction. Selective Herdr reuse is settled; it does not adopt Herdr's same-user trust, session snapshots as acceptance control or pane completion as Work acceptance. The manager owns Wiki, shared interfaces/composition, manifests and lockfiles. The four retained worker sessions are sufficient; verify current recipients and assigned worktrees before any later handoff.

## Manager-owned operational gates

R10-S remains an explicitly unqualified read-only library extension. The newly approved first-host direction and recovery limit remove the pending product choices, not the need for reviewed, executable shared contracts. The following remain manager-owned before dependent implementation:

- Specify and justify the dedicated-identity service's actual credential, process/IPC/handle protection, source-access and enrollment/lifecycle mechanisms. Administrator installation is approved as a design cost; managed ingress, repository relocation and a UID ledger are not automatically selected. Preserve the acting user's real native rights rather than substituting service rights or a guessed group vector.
- Settle the local recovery protocol, predecessor exclusion and first-root ordering under the approved lost-incident limit. The R8-B identical-visible-state counterexample remains valid evidence of the limitation; v1 no longer promises to distinguish an error whose evidence did not survive. This does not make a marker or re-fsync proof of past success, qualify a new protocol, allow routine clearing of retained incidents, or justify a permanently unavailable successor. No external witness or TPM dependency is selected.
- Compose identity, declaration/definition custody, references, retries, creation/reentry, lifecycle, operations/queries and source-outcome contracts. Resolve worker-language eligibility/owned runtime scope and protected attempts/results/accounting/cleanup before their slices. Selectively reuse proven-fit mechanisms with exact provenance and applicable notices; do not copy whole architecture or invent disconnected scaffolding.

No installation, privileged experiment, live inference, deployment, activation or controller handoff is authorized. R5-A stays frozen/unintegrated; R8-B Phase 2 stays unreleased. Do not reopen completed report assignments or commission another generic report round. Independently review every submission and the integrated path before acceptance.

## Preserved review evidence

Full prior handoff: `68084365221f87579cb7dbb3c97eea812b8460fc:CHANGEKERNEL_STATUS.md`. Completed reviews remain in Git rather than being copied into new assignments:

- R9-A: assignment `b8a26dfb4ffb39c5a0158d85d82186c97474e146`, submission `8e2430b16876605785be90ce5f036482ebd577a5`, verdict `5f60963c4eb8d4071da7bdbc1b365e5b173a24ae`: [bounded decision preparation accepted; host blocked](../host-admission-closure/CHANGEKERNEL_STATUS.md#manager-review--accepted-decision-preparation-host-blocked). No further report owed.
- R9-C: assignment `063eb6962982bd7fbb28d808baf8e61c71c58eca`, submission `8b20d8b079c4d680ad9c1a6ebab3afc47afc48de`, verdict `975f8348a8c686230eb7071369c836c76b638bb9`: [bounded compiler scope accepted; source unreleased](../binding-compiler-contract/CHANGEKERNEL_STATUS.md#manager-review--accepted-bounded-compiler-scope-source-unreleased). R10-S does not release that compiler or change its definition/custody gates.
- R8-A repair `e0539453d2a322665b892969ddf5a8cc8a40b872`, R8-C logical view `fd9cae5faf6000cec1685f58ce44e98aa514cf21`, R8-D attempt proposal `5421254d4563de3176d964eb18bca79d6786a56f`: accepted within their proposal scopes; no duplicate repairs owed.
- R8-B verdict `9aa6d02a8c436a9ae130c478ea3b086d19f9e285`; concrete witness investigation/limits `22e5a93ec8edaca56c2ffc5083e263b4e35ac276`: not operational implementations or selected dependencies.
- R5-B stays accepted. R10-S now adds reviewed executable source-reader behavior and F1 repair in this integration; it is not a native dogfood release.

## Actual checks

R10-S source checks and diagnostic limits are preserved at `2bbfc98666a34dd6d9f2e2e2879614eef2c9524c:CHANGEKERNEL_STATUS.md`; baseline preparation is at `41e8bb9dd8e3b06deddb10b993378b65e63c5893:CHANGEKERNEL_STATUS.md`; the rejected submission/F1 evidence is at `bcc3a038d5b6dc095a693b5a7431b6323f3f7131:CHANGEKERNEL_STATUS.md`. Approval-recording checks are preserved at `91143c65437b8a7126ff9539bc3e2a4a3fd2515d:CHANGEKERNEL_STATUS.md`. The subsequent session-alignment repair changes only `AGENTS.md` and this handoff; its checks are recorded below. Native source, tests, manifests and locks remain unchanged. No native tests, hardware/host experiment, installation or controller operation is implied by this coordination-only repair; no new operational qualification is claimed.

Session-alignment checks: native process/session cwd and exact branch/HEAD checks passed for the managed workers; A/C/D acknowledgments were correlated with their replacement sessions, and B's original process was verified unchanged. All worker trees remained clean and no project npm directory was created in the relaunched worktrees. Active Markdown diagnostics checked both changed files with zero findings; 14 local links/anchors and `git diff --check` passed. The source/test/manifests/lockfile comparison against the approved-design checkpoint was empty. Cargo/npm were not rerun for this procedure/handoff-only change.
