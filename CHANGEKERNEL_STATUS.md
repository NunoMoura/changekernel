# ChangeKernel temporary status

## R35 — M7/M8 resolved; sizing-accounting correction required

**Manager verdict: changes requested.** Candidate source **`ea8921d15d1ca65a5bf1e1111138435587e5fa88`**, report **`32d5d2719f261f778ca336696305b56441c6e172`**, are not integrated or accepted. Manager independently reviewed the repair and broader implementation, completed the required native suite, and reproduced an additional complete-accounting defect. Passing the existing suite is not contract compliance.

Adopted contract: **`c929e93a327a6c4eb87cb8da2e639a93b9c7531d`**, [ledger continuity](.changekernel/wiki/items/system/components/ledger-continuity.md). Accepted executable remains **`3aeabda651fb7f44fe86394aa82be30a18f07164`**. The manager owns source review, acceptance, integration and combined verification; no reviewer or worker self-approval substitutes for that responsibility.

### Reviewed repair dispositions

- **M7 resolved for source behavior.** `SharedGrounds` now borrows the actual immutable grant directory and securely opens that path rather than combining the external anchor parent with the ledger basename. Held/named root, members and shared-lock equality, receipt/anchor proof, and pre-write rechecks remain. The manager's passing suite exercised the expanded36-case same-parent/distinct-parent/decoy-parent matrix at fault, incident-read and incident-create cuts, including missing/replaced live shared objects. Successful justified incident retention and zero writes on contradicted custody are distinguished; retention does not reacquire native identities.
- **M8 source witnesses supplied.** Manager read the new bounded child protocol, correlated readiness/cut markers, timeout/kill/reap fallback and assertions. Tests now cover actual process exit/fresh reopen with identical history/retries, contender refusal/release, independent custody with the same printable names, local A/B isolation, final permission/principal revocation across all seven operations, accepted Check reply suppression versus pre-acceptance pending/discard, and fourteen Check/revision process cuts. These passed independently. Process exit is not reboot, and these tests are not external exact-release qualification.
- **M1–M6 review continued.** Manager inspected specialized legacy/native layouts, closed native identity and pair/anchor codecs, capture/borrow/installation rounds, retained proof, parser, selected history/projection/dispatch consumers, public admission/hooks and observations. The earlier scalar-guard correction and frozen profile behavior remain. Complete actual-work/owner accounting is still open through M9 below; no blanket accounting acceptance is claimed.

### M9 — unobserved pre-reservation sizing work and temporary owner

`src/adapters/jsonl/ledger/continuity/size.rs::scalar` calls `serde_json::to_writer` into `Count`. `Count::write` advances only its private byte count. Neither function records the reached formatting work. `fits` serializes the actual input, installed entries and other values through this helper; it has no enclosing emission/construction observation for those traversals, only a fixed charge and three zero-byte final size predicates. This is not merely arithmetic over previously measured canonical lengths.

Manager's disposable private-source test invoked that exact helper on65,536 U+0001 bytes. It returned **393,218 serialized bytes**, while emissions, input emissions, control emissions, fields and constructions all remained **zero**. The focused Cargo test exited **101**, without timeout. Production caller inspection connects this helper to the public create pre-reservation path. This is a private-helper witness, not an asserted whole-call byte total or benchmark.

The same helper also uses `path.push(format!("m-{}", p.slot))`: that allocating temporary is dropped before `path.refresh()` and has no `Owned`/allocation charge. Charging the PathBuf does not charge this separate String owner. Review the helper's other fixed/temporary overlaps as part of the same correction.

Requirement: [source-backed feasibility before mutation](.changekernel/wiki/items/system/components/ledger-continuity.md#source-backed-feasibility-before-mutation) explicitly requires **all reached counting/emission/input constructors and owners to be observed**. Actual capacity/ownership, not adjusted counters, is required by the owner schedule. This continues M5's original complete-accounting requirement; it is not a new API, performance experiment or test-count target.

**Required correction:** observe actual reached sizing work/operands and real owners with the adopted boundaries, or eliminate repeated formatting by reusing already validated, observed canonical extents. Preserve genuine attempts/failures and allocation overlap. Do not add fictitious work, normalize totals, invent identity tokens, serialize a placeholder native control, introduce a compatibility schema, add public counters or raise ceilings. The probe's per-helper assertion demonstrates the current missing observation; it does not mandate one control-emission event per scalar or forbid a correctly observed caller-owned group/pure-arithmetic design. Derive and test the resulting complete-call bounds rather than hiding extra traversals to meet them.

Evidence: `/home/canina7/.local/state/changekernel-source-review/r35-manager-sizing-successor.w5i83md3/` contains the exact test append, source-prefix verification, command, stdout/stderr and exit result. All101 production/original-test/Cargo paths match the candidate after removing only the retained `#[cfg(test)]` appendix in that disposable snapshot. An earlier archive preparation used an incorrect manually transcribed hash and failed before any source archive/test; that separate failure directory is preserved, not treated as execution evidence. No permanent manager probe or candidate production change was made.

### Actual independent manager checks

Exact immutable snapshot and review: `/home/canina7/.local/state/changekernel-source-review/r35-manager-successor.tedpuzfb/` (`subject.json`, `manager-review.json`, retained diffs, logs and `checks-result.json`). All required commands used Rust1.88, locked/offline dependencies, fresh external target and sufficiently short btrfs TMPDIR, with explicit exit/timeout supervision:

- `cargo +1.88.0 fmt --check`: exit0.
- `cargo +1.88.0 clippy --locked --offline --all-targets -- -D warnings`: exit0.
- `cargo +1.88.0 test --locked --offline`: exit0,555 seconds, no timeout; exact subject unchanged.
- Manager recount: **215 parent tests passed,0 failed,4 ignored subprocess entries**. The latter are exercised by parent tests. Unfiltered summaries were correlated with19 Cargo target/doc-test labels; filtered nested results were excluded. The first incorrect result-nesting parser assumption is preserved separately, not silently reported as a count.
- Current active LSP checks on sizing, receipt, members and continuity tests completed with no errors/warnings; two informational Rust2024 let-chain suggestions do not authorize changing the pinned edition.

The previous candidate's manager long-TMPDIR socket failure, its separately named focused correction, earlier missing-exit partial check, worker failures and all old probes remain historical evidence. These successful checks neither erase those records nor make the new M9 probe pass. No npm, standalone build, cache reset or historical SDK replay was used.

### R35-P corrective continuation

- **Branch/worktree/base:** `work/r35-ledger-continuity-source`, `/home/canina7/Projects/changekernel-workers/r35-ledger-continuity-source`, clean report **`32d5d2719f261f778ca336696305b56441c6e172`** (source `ea8921d15d1ca65a5bf1e1111138435587e5fa88`). Current native/session/worktree identity matches; reuse this same suitable session after dispatch verification, not the retired R34 context. No manager or worker restart is needed.
- **Outcome:** Correct M9, retain M7/M8 and all earlier repaired behavior. Audit the complete sizing path and actual new owners, not only the demonstrated scalar case. Add focused behavioral observation regressions, including escaped maximum legal text/nonempty accepted entries and relevant refusal/owner overlap. Demonstrate honest work within the adopted ceilings. No new framework, inventory/wording test or test quota.
- **Owned writes:** Relevant `src/**`, R35 `tests/ledger_continuity*.rs` and support under `tests/ledger_continuity/**`, small colocated unit tests, own handoff and separately named external evidence. Do not rewrite/remove pre-R35 tests, change Wiki/API/schema/bounds, manifests/lockfile/dependencies/toolchain/config, switch branches, rebase or push. Correcting unaccepted implementation to the adopted contract remains authorized.
- **Checks/return:** Use available source navigation/LSP; focused regression first, then final `cargo test --locked`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings` with existing Rust1.88/offline dependencies and isolated external target/short TMPDIR. Record exact source and actual exits/timeouts. Preserve first failures and append corrections. Return source/report commits, work/owner derivation, actual tests and gaps, then wait. Manager reviews the final delta and combined subject before acceptance/integration.

Normal fresh-fixture Cargo source tests only. No SDK/standalone native experiment, host reboot/remount/mount/VM/namespace/loop/snapshot setup, privilege, old-custody reopen/repair/migration, effects, release installation/activation, controller handoff, credentials/product inference, new workers, tooling/cache reset or old-evidence cleanup is released. Unsupported facilities cannot be hidden by fake positive qualification. Mutable checkout never governs itself.

### Pool and next action

Same manager integration worktree/branch/session and four retained slots. P is parked pending this exact committed corrective dispatch; C/R remain parked; S remains reuse-blocked by its earlier session-header mismatch. Verify native/persisted-session/tool cwd, branch and clean base before sending; correlate ACK, do not blindly retry. Routing identities/transport records remain external. No user session action is needed.

R34 adoption remains; R35 source is not integrated. R33 one-shot release `de481b543aed494749c2e619bd8d8de9f9f2b971` remains consumed/CLOSED under verdict `99d23512c2cf2d513f63a08f8322c9dd54e11556`. R25–R32 completed dispositions stay in Git. Earlier device30→58 cause remains unproved; old anchors were never reopened/repaired. Jev12 budget remains exhausted. Completed compactions are history, not pending commands to replay.
