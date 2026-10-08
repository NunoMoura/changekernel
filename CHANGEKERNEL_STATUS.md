# ChangeKernel temporary status

## R35 — source integrated for final combined verification

Manager review has resolved M1–M9 on source **`6b7f59a63797894dfb587945681286ce3122bd18`**, worker report **`efb9760bb05d8b34166b84db3e1abc93ff7b02f7`**. The24 owned source/test paths have been integrated byte-for-byte; no worker handoff was imported. **Final acceptance is pending combined verification.** This is ordinary source development, not release qualification or controller activation.

The adopted requirements remain [ledger continuity](.changekernel/wiki/items/system/components/ledger-continuity.md), contract commit **`c929e93a327a6c4eb87cb8da2e639a93b9c7531d`**. Manager independently reviewed the complete implementation across the successive corrections, rather than accepting worker pass counts or relying on a reviewer gate.

### Review and check evidence

- M1–M6: specialized legacy/native owners preserve legacy physical layouts and observations; native proof rounds, post-install comparison, current shared-chain retention, scalar accounting and exact adopted API/schema corrections were reviewed. Existing pre-R35 tests, Cargo manifests/lockfile and toolchain are unchanged.
- M7: retention uses the actual configured ledger directory, independently of the external anchor parent. The expanded36-case same/distinct/decoy-parent and live-chain matrix passes, preserving justified incident-only behavior and no reacquisition.
- M8: real bounded/reaped child exit/reopen/contention, independent-ledger and A/B isolation, final authorization/private-output and Check-discard/retry, and fourteen process-cut witnesses pass. These are source tests, not reboot qualification.
- M9: the unobserved counting formatter and path/basename owners were removed. Sizing borrows already measured canonical origin length, validated entry count and admitted path length; it performs only observed scalar comparisons and concrete fixed-header accounting. Manager independently reproduced the closed constants and a deliberately looser legal maximum: ready802,028, accepted14,436, anchor9,507 bytes, all below C1,048,576. No valid creation is rejected by the conservative bound, no future identity is fabricated, no ceiling is raised and no hidden work is relabeled.

Manager's immutable exact-source checks all exited0 without timeout: `cargo +1.88.0 fmt --check`; `cargo +1.88.0 clippy --locked --offline --all-targets -- -D warnings`; `cargo +1.88.0 test --locked --offline`. Full test run565 seconds: **217 parent tests passed,0 failed,4 ignored helper entries invoked by parents**, with documentation tests passing. Parent summaries were independently correlated with Cargo target labels, excluding filtered child results. Rust1.88, fresh external target and short btrfs TMPDIR; exact101 source/test/Cargo identities remained unchanged. No npm, standalone build or cache reset was needed.

Evidence root: `/home/canina7/.local/state/changekernel-source-review/r35-manager-m9.xj9jouc0/` contains exact subject/worker report, native logs/exit records, independent sizing derivation, parent recount, scoped integration patch and precommit byte comparison. Prior manager review roots `r35-manager-successor.tedpuzfb/` and `r35-manager-candidate._gd_p0tq/`, M7/M9 failing probes, worker failures and separately named corrections remain preserved. See previous verdicts `35a78e43247f8f2993a84b82263027aa8fecaf3c` and `cbdbde60d` for the returned defects. Successful successors do not erase the earlier long-TMPDIR failure, missing-exit gap or preparation/recount mistakes.

### Final verification and remaining gates

Next: verify the committed combined subject against all reviewed executable hashes, run focused native/fmt/clippy checks on its disposable external snapshot, query active diagnostics and record the final manager acceptance/verdict. A full immutable suite already passed on these exact executable bytes; the combined check must establish identity and integration behavior, not infer success from worker status.

No exact immutable Product/host/consumer release qualification, actual reboot/remount/power-loss, installation, activation, explicit controller handoff or application effects are accepted or released. Ordinary btrfs source fixtures are not that evidence. Native support/threat exclusions and finite identity/rollback limits remain unchanged. Before any separately gated host experiment, prepare its exact subject, allowed operations, user-assisted events, custody/evidence preservation and stop conditions for approval. Mutable checkout must never govern itself.

Same manager worktree/branch/session; four retained worker slots. P returned its clean source/report and remains parked pending manager verdict. C/R remain parked; S remains reuse-blocked by its old session-header mismatch. No new worker assignment, relaunch or user session action is needed. Routing/ACK details stay outside Git.

R33 one-shot release `de481b543aed494749c2e619bd8d8de9f9f2b971` remains consumed/CLOSED; no old custody reopening/repair, phase replay, extra Jev calls, credentials, host setup or evidence cleanup is authorized. R25–R34 completed/adopted dispositions remain in Git. This source integration does not transfer controller authority.
