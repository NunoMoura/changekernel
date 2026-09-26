# ChangeKernel source-development handoff

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns procedure, and Git preserves completed reviews. Never govern this checkout with mutable checkout bytes.

Manager worktree: `/home/canina7/Projects/changekernel-workers/integration`; branch: `integration/rust-kickoff-01`. Latest executable integration: `0b1b434ab`. The operational host, file-first Trace writer and new Workspace/Kernel lifecycle are not implemented or qualified.

## Approved direction and remaining gates

The user authorized the clarified backend-only write boundary and stronger protection. Canonical [State](.changekernel/wiki/items/system/components/state.md#backend-only-authoritative-writes), [execution](.changekernel/wiki/items/system/components/agent-execution.md#admission-and-containment), [Checks](.changekernel/wiki/items/system/components/checks.md#results-feedback-and-progression) and [qualification](.changekernel/wiki/items/system/components/package.md#qualification) now own the requirements; README summarizes them. This supersedes the provisional blanket exclusion of unrelated same-account writers in the previous handoff: ordinary clients/workers must be separated from the authoritative writer's effective privileges. The trusted host/OS remains an explicit boundary, not a claim to withstand its compromise.

Clients request typed domain operations; the backend establishes identity, current custody/authority and exact subjects, constructs records, serializes durable writes and reconciles retries. JSONL is not an editing API; client assertions cannot manufacture assessments or source outcomes. The selected first-local authority direction is protected JSONL history plus non-rebuildable accepted-prefix control, with Git as evidence/transport rather than local acceptance. Ordinary restart, stale-copy rejection, explicit restore and whole-custody rollback have separate guarantees. Whole-domain rollback-resistant continuation and automatic restore remain unavailable without qualified surviving authority; a matching old pair does not prove freshness. See the [recovery boundary](.changekernel/wiki/items/system/components/state.md#protected-accepted-prefix-and-recovery-boundary).

The [dependency gates](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation) still block production identity, command, record and persistence interfaces until concrete host/binding, encoding, creation/commit/recovery and Kernel/lifecycle contracts are reviewed. Typed-only custody may be an intermediate foundation, not a replacement for complete self-development delivery. No new runtime dependency, storage migration, release qualification, activation or controller handoff is authorized by design approval.

## Existing source disposition

For the first file-first delivery, **freeze existing SQLite profiles and their tests**: no schema extension, automatic migration, JSONL dual-writing or R5-A integration. The new profile gets its own explicit version/meaning. Any later legacy extension, migration or retirement requires a separate decision; this is not permission to maintain two writable histories for one Change.

| Slice | Reviewed repair / report | Retained verdict |
| --- | --- | --- |
| R5-A | `5f674977162a3c7bd0b52617caec24bcdd875381` / `fc7351314cdf14802a9bbfa2f40e378cdffdf60f` | A1 repair accepted; A/overall R5 blocked. Candidate source unintegrated. Handoff: `f65d52a2587405c283ca485c72ac8da86549beed`. |
| R5-B | `2454cae3ecb6624f4a8f9da6849b6177f5e45ea6` / `be342869c381408a576f89249297258d987cd222` | Accepted/integrated as `a31694929` and `0b1b434ab`. Handoff: `7420ba2b8ac05e1471d010c183cb3059dc3aa9f9`. |

The [path-only retained-attribution defect](.changekernel/wiki/items/system/components/state.md#change-attribution-under-partial-custody-loss) remains real: deliberate partial damage can leave unattributed candidate rows while permitting changed-intent original recreation. It is not demonstrated ordinary crash partial-commit failure, and changing architecture does not repair or accept it. Old R5 branches/worktrees remain stopped and preserved, not repurposed. Reopening candidate work would require the manager-owned successor attribution contract and combined acceptance.

Historical checks are recorded in `2728e8c4d:CHANGEKERNEL_STATUS.md`: repaired A/B/combined 35/33/43 native tests, fmt/clippy, bounded-allocation and history/race probes; integrated source 33 tests. Old `/tmp/changekernel-r5-resume.d3jiQN/` evidence is unavailable. Do not claim fresh reruns. R4-A/B remain accepted/finished; history is at `9abfac4b2:CHANGEKERNEL_STATUS.md`.

## R6 investigations — accepted and stopped

Both reports were independently reviewed from base `5ca3a90e7c6cd46f70ec51e3db7b77dd2f271323`; only worker handoffs changed. Accepted investigation is not accepted production code, frozen schema or qualification. No R6 resubmission is owed.

| Worker | Branch / worktree | Report and manager verdict |
| --- | --- | --- |
| R6-A | `work/workspace-boundary-contract` — `/home/canina7/Projects/changekernel-workers/workspace-boundary-contract` | Report `0fb24d57521c630b6b41d633f4c1be4f5191f1f8`; verdict `fda89ef533ce3391f360b4932fa49b47dd52a963`. [Handoff](../workspace-boundary-contract/CHANGEKERNEL_STATUS.md). |
| R6-B | `work/file-trace-protocol` — `/home/canina7/Projects/changekernel-workers/file-trace-protocol` | Report `99184942f99ff4f52b6ecd535f47cec177b5aa65`; verdict `1c29f5eb00956c1cbb834d45d207a3344416e6cd`. [Handoff](../file-trace-protocol/CHANGEKERNEL_STATUS.md). |

Review checkpoint `8dea13d2d` retains exact commands, source identities, findings and gaps. Evidence is at `/home/canina7/.local/state/ck-r6-manager-review.pTkbUp/`: `A-results.txt`, `B-results.txt`, `git-results.txt`, `limits-results.txt`, `sources.sha256` and `platform.txt`. The manager reproduced A's same-UID overwrite/peer-credential/path/dirfd observations, all five B process/fixture tests and backward Git CAS. Additional probes showed B's stub does not bind changed expected-head retry input and accepts a changed-payload request after both log and checkpoint are restored to the original pair. That is full-custody rewrite, not an ordinary crash or demonstrated source effect. The stub is not production code to adopt.

No power-loss, storage-error, backup, authentication, containment or source-effect qualification followed. Rust/Cargo 1.88.0 compiled the external B probe; no project Cargo/npm suite was run for the handoff-only review. Historical tool results must not be presented as current whole-project diagnostics.

## R7 — ready concrete contract-closure assignments

Two fresh external worktrees were created from safety checkpoint `201ac299bea4f12fcfa6ff52d24899cd9af33430`. They are ready for **report/probe-only contract closure**, not production implementation or qualification. The manager has not launched worker processes. Each worker owns only its own `CHANGEKERNEL_STATUS.md`; old R5/R6 trees remain untouched and stopped.

| Worker | Branch / worktree | Starting assignment and outcome |
| --- | --- | --- |
| R7-A | `work/protected-host-contract` — `/home/canina7/Projects/changekernel-workers/protected-host-contract` | `fafe97e0cf266e4b4b29a9f702fc08b1031632c9`; [full assignment](../protected-host-contract/CHANGEKERNEL_STATUS.md). One concrete native host/identity/typed-command profile, enforced writer separation, setup/request/restart flow and acceptance cases. |
| R7-B | `work/trace-commit-contract` — `/home/canina7/Projects/changekernel-workers/trace-commit-contract` | `e4a6ee35c9a1a2ebb51d4775613c7cf106e803f8`; [full assignment](../trace-commit-contract/CHANGEKERNEL_STATUS.md). Exact proposed frame/control shapes, creation/commit algorithm, complete retry/result binding, failure/recovery matrix and acceptance cases. |

Reuse R6 evidence, not another generic backend/framework comparison. Shared assumption: only the protected backend supplies authenticated bounded identity and typed operation material. A owns identity/authentication/delegation and host protection; B treats identities as opaque and owns storage representation/commit/recovery. A storage stub proves neither authentication nor isolation. Reports may propose interface constraints but cannot freeze shared encodings or public lifecycle schemas; conflicts return to the manager. Probe sources and artifacts stay in disposable external directories. No privileged host setup, live effects, dependency adoption, Wiki/source edits or controller loading is assigned.

The manager owns reconciliation, immutable identity/reference and Kernel/lifecycle contracts, manifests/lockfiles and final acceptance. Require complete recommended protocols and implementation-ready acceptance cases before adopting the combined contract in Wiki and freezing code interfaces. Then split only genuinely ready implementation scopes. Up to ten agents are available, not a target; no production worker should invent missing interfaces to stay busy.

## Current change checks

Safety checkpoint `201ac299b` changed seven documentation/handoff files only. Active Markdown diagnostics passed for all seven files; 83 local links/anchors across those files and AGENTS resolved; `git diff --check` passed. All five Wiki frontmatter/provenance blocks and the entire State text from `Native Rust intake` onward were preserved exactly. Handoff commit references were checked against Git. Source, tests, manifests, AGENTS, archives and governed records are unchanged. No project Cargo/npm suite was rerun, and no runtime robustness or qualification claim follows from documentation updates.

R7 setup checks passed: three active Markdown checks with zero diagnostics, 22 local handoff links/anchors, valid commit references, exact branch/base ancestry, assignment-only commits and clean worker trees. Source and governed records still match the pre-change checkpoint. Worker processes have not been launched by the manager.
