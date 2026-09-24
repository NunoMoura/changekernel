# ChangeKernel source-development handoff

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns procedure, and Git preserves completed reviews. Never govern this checkout with mutable checkout bytes.

## R5 independent review — no source integrated

Manager worktree: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Shared source base remains `552cab992b5efdd8fffebeaea97d42042bc95957`. Both implementations were reviewed exactly and composed only in a disposable external directory. Passing tests do not override the findings below.

| Slice | Exact code / submitted handoff | Verdict / latest manager handoff |
| --- | --- | --- |
| R5-A: file-candidate custody | `460fdb198ff6fc137506f72188e0f0063c134620` / `f74f1a614868b51eb9f98298f125c80c7ae360e1` | **changes requested**, incremental aggregate budgets; shared policy also blocks acceptance; `f609713d382bafc9517ba5677d319876c2389c2c` |
| R5-B: intent append | `386af3d0e1d34950ad84fab600f2b6abe4c3adf2` / `fc19cc3085eb2918e26929d0fcc98e857893b232` | **changes requested**, bounded retry-reference decoding; `f1b817cd888d022676a973739cc0269226fab465` |

Worker branches/worktrees remain `work/native-file-candidates` at `/home/canina7/Projects/changekernel-workers/native-file-candidates` and `work/native-intent-revisions` at `/home/canina7/Projects/changekernel-workers/native-intent-revisions`. Their local status files contain the full review and next action. No rebase, branch switch, merge, push, self-approval or new slice is authorized.

## Finding A1 — aggregate allocation before validation

`load` in `src/adapters/sqlite/file_candidate.rs` collects proposed/prior byte vectors before aggregate validation. Its per-cell/path limits permit a damaged 64-path record to allocate approximately 128 MiB, even though valid custody has separate 8 MiB proposed/prior budgets. An independent read probe aborted under an 80 MiB address-space limit (exit 134, `memory allocation of 1048576 bytes failed`). An isolated running-budget check returned unavailable under the same limit; all eight candidate tests still passed.

A is authorized to enforce both budgets incrementally while reconstructing the record and add ordinary proposed/prior aggregate-overflow regressions. No public/schema/encoding change, permanent OOM harness or extra framework is needed. Evidence: `/tmp/changekernel-r5-review/candidate-bounds-before.log`, `candidate-bounds-after.log`, `bounded-aggregate-candidate-tests.log`; probe at `combined/examples/candidate_bounds.rs`. The manager will repeat the resource probe on the exact resubmission. This owned-path fix is independent of B1 and need not wait for the orphan-policy decision.

## Finding shared — path-only orphan custody

`src/adapters/sqlite/continuation.rs:41-50` can recognize Change-bound evidence but cannot associate orphan candidate paths after their header/retry bindings are lost. Independent reproduction erased original intake/retry, intent and candidate header/retry rows while retaining candidate path rows. Candidate read and direct retry lookup correctly returned unavailable without capture; public preparation stopped earlier with denial. However, original intake could be recreated under the same request identity with changed What. This is a manager-owned shared policy boundary, not permission for A to change schema/intake or infer lost bindings.

**User decision requested, not adopted:** when a container has candidate path rows with no header, conservatively refuse new intake creation and classify missing Change lookups as unavailable in that container. Leave intact custody usable, preserve all bytes, and do not infer ownership, reconstruct history, delete rows or perform recovery. This contains the unprovable association without adding a new schema. Broader quarantine or another recovery policy requires explicit agreement. Shared-boundary work and combined acceptance are held pending that decision; A1/B1 repairs may proceed independently.

Evidence: `/tmp/changekernel-r5-review/orphan-path-probe.log`; the assertion expecting unavailable reproduced an incorrect successful replacement receipt. Probe source: `combined/tests/manager_r5_probe.rs` within that evidence directory. The worker's report was confirmed, not dismissed as a hypothetical.

## Finding B1 — unbounded persisted retry references

`src/adapters/sqlite/intent.rs:31-38` decodes retry `change_id` and `revision_id` directly into Rust strings. The requested Change's preflight does not protect a reused request bound to another Change. A damaged 48 MiB text reference caused process abort (exit 134; `memory allocation of 50331648 bytes failed`) under an 80 MiB address-space limit, rather than unavailable.

B must bound both cells before Rust allocation while preserving existing-row versus no-row semantics. Malformed data must not become a cache miss, stale-head conflict or new append. A disposable SQL CASE projection retained row presence and returned unavailable under the same limit; the seven intent tests still passed. This illustrative modification is not integrated or accepted. B is authorized to repair its own implementation and add a small ordinary cross-Change malformed-reference regression, including surviving retry/missing revision grounds. No permanent OOM harness, large fixture, dependency or framework is required.

Evidence: `/tmp/changekernel-r5-review/retry-bounds-before.log`, `retry-bounds-after.log`, `bounded-query-intent-tests.log`; resource probe at `combined/examples/retry_bounds.rs`. The disposable composition now contains illustrative A and B modifications and manager probes; it is no longer an exact unmodified A+B source tree and must not be merged wholesale.

## Independent checks actually run

- Exact code commits modify only their two assigned source/test files. Frozen schema arrays are byte-identical to the shared base. No public API, manifest, dependency, lockfile or shared-code change was submitted.
- Exact A: **33 tests passed**, fmt/clippy and diff checks passed. Exact B: **32 tests passed**, fmt/clippy and diff checks passed.
- Exact A+B composition, before diagnostic probe modifications: **40 tests passed**, fmt/clippy passed.
- Replacing A's raw head fixture in a disposable probe with B's actual `revise_intent` passed historical retry after head advancement/source loss and head advancement during capture. These verify real writer interaction, not only SQL fixtures.
- Compiler: system Rust/Cargo **1.88.0**, matching the intended version. The old `/tmp/changekernel-r0a-review-tools.5VMgXF/env.sh` is absent; no claim that it was used.
- Active LSP: B's changed paths clean. A and unchanged baseline report rusqlite E0605 / let-else findings; cross-worktree test probes additionally report trait-resolution failures inconsistent with exact Cargo compilation. This remains a tooling/context gap; do not claim globally clean LSP or rewrite valid baseline macros just to silence it.
- Logs: `/tmp/changekernel-r5-review/{native-file-candidates,native-intent-revisions,combined}.log`, `combined-history-probe.log`, `combined-race-probe.log`.
- A's original test-fixture assertion failure was explained and corrected in its submission. B's missing environment script and formatting failures were disclosed. Neither is being hidden by passing reruns. No npm checks were needed for Rust-only changes.

## Next actions

1. Obtain the user decision on shared orphan handling. Do not silently adopt quarantine or weaken the no-reconstruction contract. Once agreed, the manager owns its Wiki clarification, shared implementation and focused regression.
2. Send both workers their local manager-review handoffs for the independent A1/B1 repairs and resubmissions on their same assigned branches. Neither worker may change shared custody policy or schema; no worker source has been accepted.
3. Review both exact new revisions and repeat the relevant bounded-resource probes against those exact bytes. Recheck any approved shared repair and the real combined writer boundaries before integration/acceptance. Do not merge status files wholesale.
4. After integrating reviewed code, run the combined native gates, update current-capability documentation, record explicit verdicts and preserve analyzer/qualification gaps. Source acceptance does not grant release qualification, activation or controller authority.

The [private continuation profile](.changekernel/wiki/items/system/components/state.md#native-private-continuation-profile) and [v1 API/storage contract](.changekernel/wiki/items/system/components/state.md#native-continuation-api-and-storage-v1) remain the governing design references. Shared schema, intake, continuation guards, ports, manifests and Wiki remain manager-owned. Decision/Work, execution, publication/recovery and exact external-controller handoff remain separate capabilities.

R4-A/B remain accepted and finished. Historical R4 verdicts and the still-unexplained initial A test summary are preserved at `9abfac4b2:CHANGEKERNEL_STATUS.md`; do not reopen that investigation without new actionable evidence.
