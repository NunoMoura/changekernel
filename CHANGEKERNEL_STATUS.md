# ChangeKernel source-development handoff

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns procedure, and Git preserves completed reviews. Never govern this checkout with mutable checkout bytes.

## Direction confirmed; native work resumed

The user's ownership/accountability clarification is recorded in [ownership](.changekernel/wiki/items/product/changekernel.md#ownership-and-responsibilities), [owner-directed automation](.changekernel/wiki/items/product/changekernel.md#owner-directed-automation), [multi-tenant scope](.changekernel/wiki/items/system/components/state.md#multi-tenant-scope-and-ownership), execution and Checks. Documentation commit: `de5331e5e`. The first delivery remains one enforced application integration; cloud synchronization, machine-wide governance and a generalized additional AI-restriction layer are not prerequisites.

The [existing storage contract](.changekernel/wiki/items/system/components/state.md#one-authoritative-current-representation) remains in force: protected application-supported storage, SQLite as the bounded native binding, and one authoritative Change history. No universal backend, migration, new permission system or parallel trace store was selected. Native work resumes without waiting for another broad architecture comparison. The required successor-profile [retained attribution](.changekernel/wiki/items/system/components/state.md#change-attribution-under-partial-custody-loss) is manager-owned; the current v1 layout and historical meanings were not silently changed.

## Reviewed and integrated source

Manager worktree: `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`. Original shared source base: `552cab992b5efdd8fffebeaea97d42042bc95957`. Latest executable integration checkpoint: `0b1b434ab`.

| Slice | Exact reviewed repair / submitted report | Manager verdict and integration |
| --- | --- | --- |
| R5-A: file-candidate custody | `5f674977162a3c7bd0b52617caec24bcdd875381` / `fc7351314cdf14802a9bbfa2f40e378cdffdf60f` | **A1 repair accepted; slice blocked** on shared attribution. Candidate code is not integrated. Latest manager handoff: `f65d52a2587405c283ca485c72ac8da86549beed`. |
| R5-B: intent appends | `2454cae3ecb6624f4a8f9da6849b6177f5e45ea6` / `be342869c381408a576f89249297258d987cd222` | **Accepted and integrated.** Original code `386af3d0e1d34950ad84fab600f2b6abe4c3adf2` and repair are integrated as `a31694929` and `0b1b434ab`. Latest manager handoff: `7420ba2b8ac05e1471d010c183cb3059dc3aa9f9`. |

Worker branches/worktrees remain `work/native-file-candidates` at `/home/canina7/Projects/changekernel-workers/native-file-candidates` and `work/native-intent-revisions` at `/home/canina7/Projects/changekernel-workers/native-intent-revisions`. Both have manager verdicts in their own status copies. No further worker implementation, rebase, branch switch, merge, push or next slice is assigned. Worker status files were not merged into integration.

The integrated intent writer preserves immutable original/revised intent, atomic revision/retry/head updates, exact historical retries and capacity/concurrency guards. B1 bounds both stored retry-reference cells before Rust allocation while preserving malformed-row versus no-row semantics. A1 enforces separate proposed/prior budgets during candidate reconstruction; no further worker defect is currently requested.

## Shared attribution finding still blocks R5-A

The repeated disposable probe disabled foreign keys and erased original intake/retry, intent and candidate header/retry rows while retaining five candidate path rows. Candidate delivery/direct retry still refused without recapture, but original intake was recreated under its old identity with changed What. The probe expecting `Unavailable` fails with an incorrect successful replacement receipt. This is detectable partial custody damage, not demonstrated ordinary SQLite crash failure.

Current path rows lack a direct Change binding. The manager must specify and implement the explicit successor profile, retain consistent Change attribution, extend original-intake/read guards and test affected-Change refusal while preserving unrelated intact custody. Keep v1 meanings, original identities and retry semantics; do not fabricate Work, guess erased relationships, introduce automatic migration or adopt broad quarantine. Exact worker APIs/encodings remain the reviewed inputs to that integration.

## Independent evidence

Fresh review directory: `/tmp/changekernel-r5-resume.d3jiQN/`.

- Exact source archives: A **35 tests**, B **33 tests**, combined A+B **43 tests** passed with `cargo test --locked`, `cargo fmt --check` and `cargo clippy --locked --all-targets -- -D warnings`. Allowed source/test scope and byte-identical frozen schema arrays were verified. No manifests, lockfiles, dependencies or TypeScript changed.
- Rebuilt examples against exact repaired combined source: a 64-path record with 64 MiB proposed plus 64 MiB prior bytes returned unavailable under an 80 MiB address-space limit. Separate 48 MiB corrupt retry `change_id` and `revision_id` fixtures also returned unavailable without aborting. Logs: `resource-build.log`, `resource-fixtures.log`, `candidate-bounds.log`, `retry-change-bounds.log`, `retry-revision-bounds.log`.
- Real intent-writer historical-retry and head-advancement-during-capture probes passed: `interaction-probes.log`. The remaining shared custody defect reproduced: `orphan-probe.log`. These disposable probes are not a permanent duplicate suite or source to merge wholesale.
- Post-integration **33 tests**, fmt, clippy and diff checks passed: `integration.log`. Integrated B files match the reviewed revision exactly. System Rust/Cargo **1.88.0** compiled and executed all reviewed code; npm gates were not needed.
- Active B worktree diagnostics were clean. An initial integration scan reported trait-resolution findings inconsistent with successful compilation and one timeout; a subsequent active scan confirmed both changed integration files clean. A still reports rusqlite macro/let-else/cross-worktree findings despite successful compilation. No globally clean analyzer claim.
- Manager probe setup first omitted its mode argument, then used a nonexistent candidate-fixture column. Both harness errors were identified and corrected without product-source changes; they are not unexplained product failures. Original failing allocation evidence and earlier reviews remain in `/tmp/changekernel-r5-review/` and Git.

## Next action — manager-owned shared correction

1. Implement and document the explicit successor storage profile for retained Change attribution, with no implicit upgrade and focused storage-boundary regressions. Shared schema/intake/continuation, public contracts, exports/manifests and Wiki retain one owner.
2. Integrate A's reviewed original `460fdb198ff6fc137506f72188e0f0063c134620` plus repair `5f674977162a3c7bd0b52617caec24bcdd875381` with that correction. Repeat exact retry/source-loss, real-writer race and damaged-custody checks; run the combined native gates before the R5-A/overall R5 verdict.
3. Only then advance the next bounded capability toward the [first self-development delivery](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus). Intent/candidate custody is not Decision admission, planning/Work, delegated execution, publication or completion. Source acceptance does not grant qualification, activation or controller authority.

R4-A/B remain accepted and finished. Their verdicts and the unexplained initial A test summary remain at `9abfac4b2:CHANGEKERNEL_STATUS.md`; reopen only with new actionable evidence.
