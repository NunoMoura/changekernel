# ChangeKernel temporary status

## Current gate — R23 accounting correction submitted; acceptance blocked

R21's bounded opening source remains accepted at `b6bbee2f63998873bbceac17d3ea918e7d8c9008`. R22's fresh-only successor contract was adopted at `10aa1e5ea5dd71fd676768805196db0ce2169d70`; [the consumed intent profile](.changekernel/wiki/items/system/components/intent-trace.md) is normative. Neither milestone completes [Phase 1](.changekernel/wiki/items/product/plan.md#phase-1--a-durable-inspectable-change-without-effects), qualifies a release/host or transfers controller authority.

**Verdict: blocked pending exact-subject re-review and combined-result checks on R23-I2.** The correction is submitted, not accepted. Its author is parked. No dependent slice is released. Integration still contains the original nine R23 source/test paths provisionally; worker handoffs are not merged.

| Subject | Exact revision / disposition |
| --- | --- |
| Original implementation assignment | `d933824c600f64234916fe6b57c11f68229093a8:CHANGEKERNEL_STATUS.md` |
| Original code / report | `21ca93aac5bd606d65bfb5d0851955ae9bcdb096` / `cde90af17b58df181a99a9dd0a065f11561820a6` |
| Independent challenge / wording erratum | `a8125efa63a0621a9b13984f0f5ae6fbbcf03233` / `1d7a859943c70059472f38471e4a680eb0549952`; accepted as reports, not source |
| Manager changes-requested verdict / correction assignment | `0757e23e0a663741d1be7028bac22b6762e065b6:CHANGEKERNEL_STATUS.md` |
| Correction dispatch evidence | `9dd649f5ebd129d745d177bbeb61546b0f33f0f1:CHANGEKERNEL_STATUS.md` |
| R23-I2 correction code | `800a9cde0e4836b427bb83c53ef91b99573423d2` |
| R23-I2 report-only successor / new review subject | `93ac076ed32f7b7904bdf1dedbd5cd7085b513ee` |

The manager read the complete correction report and source delta, verified the report-only successor and five-path correction scope. No new acceptance follows from the author's passing tests or clean checkpoint. Original implementation, correction assignment and previous review remain in Git; this note replaces completed handoff detail rather than creating another roadmap.

## Findings and evidence to close

The original subject passed full offline locked native tests, fmt/clippy, active changed-path diagnostics and a disposable 25-child production-consumer probe with confirmed predecessor exit. Current/historical intent, exact retries, partial-tail recovery, denied final disclosure, lost replies and incident refusal passed within the declared trusted-host profile. The manager and independent reviewer found no in-profile custody/retry blocker, but required whole-call accounting was false:

- Storage work was snapshotted before incident retention, omitting the later incident read/canonical emission and construction.
- Early public errors were uncounted; final denial omitted the additional error response after a private reply had been constructed.
- Newly constructed controls had no distinct emission counter.
- Canonical re-emission was inferred from decoder invocation, overcounting after failed decoding.

The manager independently reproduced those cases, including a 72-byte omitted clear-incident read and malformed `incident.json` with two reported re-emissions but only one actual emission. Evidence used inspected deterministic read sites and exact fixture file lengths, not nonexistent read hooks or syscall tracing. Exact findings/checks remain in the correction assignment above.

The author reports that the correction counts actual attempts/completions separately, snapshots after retention, includes errors/discards and constructed controls, and measures bytes appended to bounded read buffers even on failure. Five new production-consuming accounting regressions were appended; existing test bytes, R21 API/behavior, profile-2 wire/control schemas, manifests, lockfiles and Wiki are reported unchanged. Reported focused/full native, fmt/clippy and available diagnostics passed. These claims are the re-review subject, not manager conclusions.

## R23-V2 — Exact correction re-review

**Prepared, not yet dispatched.** Reuse the parked R23 reviewer only after verified graceful exit, shell relocation and fresh offline/no-approve process launch. Verify native process cwd, actual session-header cwd, assigned branch and clean exact subject before dispatch. The pool remains eight; no extra worker is needed.

- **Branch:** `work/r23-accounting-review`.
- **Worktree:** `/home/canina7/Projects/changekernel-workers/r23-accounting-review`.
- **Base and exact subject:** `93ac076ed32f7b7904bdf1dedbd5cd7085b513ee`, whose executable correction is `800a9cde0e4836b427bb83c53ef91b99573423d2`. This is provisional candidate source, not accepted R23.
- **Owned writes:** only the reviewer's `CHANGEKERNEL_STATUS.md`. No source/test, Wiki, manifest/lockfile, package/settings, controller or other-worktree writes. Focused disposable probes may live outside Git; do not add a framework, tool or second backend.
- **Read:** the exact correction report; previous challenge and erratum; manager correction assignment; [intent contract](.changekernel/wiki/items/system/components/intent-trace.md), especially [bounded work](.changekernel/wiki/items/system/components/intent-trace.md#version-2-controls-bounds-and-acceptance) and [acceptance witnesses](.changekernel/wiki/items/system/components/intent-trace.md#required-acceptance-witnesses); [opening contract](.changekernel/wiki/items/system/components/state.md#consumed-opening-profile); [native compatibility](.changekernel/wiki/items/system/components/native-profiles.md) and [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy).
- **Correction paths:** `src/adapters/jsonl/intent_trace.rs`, `src/adapters/jsonl/opening/codec.rs`, `src/adapters/jsonl/opening/storage.rs`, `src/application/intent_trace.rs`, `tests/file_first_intent.rs`. Inspect the complete delta and relevant full functions/callers, including unchanged delivery, failed-retention and old-profile paths; do not rely only on printed counters or repeated test success.
- **Outcome:** independently decide whether all four F1 aspects are closed without introducing authority, custody, retry, error-precedence, byte/shape or R21 compatibility regressions. Confirm whole-dispatch reset/snapshot timing, actual retained decode/emission boundaries, construction versus retained re-emission, early errors, discarded private replies, delivery-cut/latched calls and failed incident retention. Audit the new counted read helper for unchanged bounds/error semantics and honest buffer-byte/partial-I/O limits. Confirm no hidden traversal or persistent accounting state controls acceptance.
- **Work witnesses:** exercise concrete negative and successful production paths. Check attempts versus completed decoding/emission, exact observed control-read equations and constructed-control events; do not demand unsupported syscall/RSS instrumentation or infer unobserved lower-level work. Recheck successful pass/read/hash/buffer budgets and the scope of heap measurements. A completed codec operation is not canonical equality, validated authority, installation or disclosure.
- **Checks:** focused `CARGO_NET_OFFLINE=true cargo test --locked --test file_first_intent accounting_ -- --nocapture`; the complete intent suite and unchanged opening/native compatibility through `CARGO_NET_OFFLINE=true cargo test --locked` (one complete run suffices); `cargo fmt --check`; `CARGO_NET_OFFLINE=true cargo clippy --locked --all-targets -- -D warnings`; exact scope/whitespace and available changed-path diagnostics. The author reports about 195 seconds for full native tests: allow adequate time; timeout is not a demonstrated source failure. No duplicate build/npm ritual or blanket test-count quota.
- **Return:** exact report revision, recommendation (`no remaining blocker`, `changes requested` or `blocked`), concrete findings with paths/lines/reproduction, actual checks and limitations. Commit only the report with `git -c core.hooksPath=/dev/null commit`, then stop. No self-acceptance, source fix, merge/rebase/push, other-pane message, worker spawning/reassignment or next slice. Manager rechecks the combined result and alone accepts/advances source.

No dependency acquisition, settings/tool repair, controller operation, provider/model/Check/privileged or power-loss experiment is authorized. Maintain one cooperative owner on the trusted Linux fixture, no owning-host fork, confirmed predecessor exit before successor custody. A fresh-process fixture is not reboot/hostile-host/release qualification. Legacy v1 **inspection**, not supported v1 opening, is the privately recognized unsupported shape on profile 2.

## Retained limits and coordination

The profile is fresh-only, one fixed trusted owner/Workspace/binding/slot, at most 128 accepted records and 16 MiB accepted bytes. Original/intervening What/Why and exact retries remain preserved. Existing R21 custody is not migrated, copied into continuing custody, rewritten or dual-written. No native effects, models, Check execution, ledger collection, archive, transfer or mandatory Stage/workflow is included. Native State stays native; accepted Trace records are Change history.

Manager: `/home/canina7/Projects/changekernel-workers/integration`, `integration/rust-kickoff-01`. Author: `work/r23-intent-trace` at submitted `93ac076ed32f7b7904bdf1dedbd5cd7085b513ee`, parked. Reviewer: parked `work/r23-intent-review` at `1d7a859943c70059472f38471e4a680eb0549952`, awaiting verified relaunch for R23-V2. R20-P/R20-V and four older sessions remain parked. Historical worktrees are not extra live workers. Transient routing and acknowledgments remain outside Git.

Active integration probes on the previous subject confirmed all nine changed paths and `tests/file_first_opening.rs` clean; earlier unresolved-root-export findings were not reproduced. No cause or repair claim is made. The separate graph was stale and cannot establish current source health; probe the newly selected correction paths afresh.

After accepted correction, prepare the next consumed Phase-1 contract under the [foundation gate](.changekernel/wiki/items/product/plan.md#foundations-before-agent-integration). No dependent assignment exists yet. Never load this checkout as its controller; ordinary Pi-native source development remains the only authorized development path here.
