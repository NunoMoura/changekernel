# ChangeKernel source-development status

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns source procedure, and Git preserves completed reviews. Change and Work own execution state after adoption.

## Current accepted source checkpoint

- **Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.
- **Accepted native code:** `c1c0e54ad0d29a77e7910cf36fcf1edc3a3fc29a` integrates corrected committed-source observations with intake previously accepted at `853fcf65e7ebfee85b87225e4f01d95cbc676e5f`. No release qualification or controller authority is implied.
- **Testing policy:** `114a099bd` removed 72 obsolete JS suite/helper files; only 70 Pi adapter cases remain. Rust behavior uses ordinary Cargo tests; the compiler owns type/borrow/exhaustiveness guarantees. No blanket JS gate for Rust-only work, extra framework, duplicate permanent review suite, coverage quota or mandatory mutation ritual. See [policy](.changekernel/wiki/items/system/components/package.md#testing-policy).
- **Supporting package:** `416c79d8211580fec5e5ec1b8cb425ba58f76d21` freezes the adapter-only entrypoint/build closure and removes the Node launcher and historical engine exports. Its 70 adapter tests, adapter artifact build and active LSP checks passed. Remaining unsupported TS sources are assigned for deletion below; historical capabilities are not a native parity backlog.

## Source-observation repair verdict: accepted with correction

The original R2-A revision `28c02e65c12da3c8e0c792e9832cd1177e01ef61` was not accepted as submitted. The manager composed only its native observation files with corrected intake and repaired F1–F3 in `c1c0e54ad`; old intake code, retired Node tests, the trivial enum/constructor test and the duplicate fingerprint mutation test were not restored. The full prior R2 findings remain at `ba0129c7f:CHANGEKERNEL_STATUS.md`.

| Finding | Correction and evidence |
| --- | --- |
| F1: readable, hash-mismatched Git objects accepted | Verify exact captured commit/tree/blob bytes using read-only Git hashing; derive path/absence lookups from those same verified tree bytes. Regressions cover commit, root/nested tree and blob substitution, read-only behavior and a packed-object positive case. |
| F2: exited leader leaves closed-stream descendant running | Every exit settles the owned process group and I/O workers within bounded cleanup grace. Success requires confirmed cleanup; timeout, cancellation, overflow and unconfirmed cleanup remain unavailable. Focused regression covers leader exit 0 and 1. |
| F3: store outage converted into permission denial | Preserve unavailable, denied and invalid-input distinctions at the application boundary. Exclusive-lock regression verifies the outage and real denial separately. |

- **Checks:** all three focused regressions failed on the original code and pass after repair. `cargo test --locked` passes all 20 native tests, including 10 source-observation cases; documentation tests are enabled, currently none. `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings`, active LSP diagnostics on all seven native/config paths, active Markdown links and `git diff --check` pass. No native dependency or Cargo lockfile change.
- **Independent probes:** original corruption, lock and descendant repros pass against the corrected library in a disposable external Cargo project. An additional 1 MiB blocked-stdin cancellation probe returns unavailable in about 62 ms with the child gone. Evidence: `/tmp/changekernel-r4-manager-probes.I0J4eI/`; regression logs: `/tmp/changekernel-r4-repair-before.log` and `/tmp/changekernel-r4-source-repair-tests.log`.
- **Limits:** evidence covers the declared ordinary local Git/Linux profile, not hostile process containment, every repository/OS form, live workspace freshness, retained grounds or publication. No live inference, packaging, activation or controller operation occurred.
- R3-A was reassigned to the manager; R3-B's duplicate suite remains withdrawn. Old worker trees were clean before reassignment, with stop/redirect notices at `50e9f7d5e` and `e3fa9a521`. Do not resume repairs there.

## Ready worker assignments: R4

Both worktrees were created from exact base `416c79d8211580fec5e5ec1b8cb425ba58f76d21`, independently of the Rust fixes. No worker session was launched by this handoff; these are committed ready assignments, not submitted or accepted implementations.

| Worker | Branch and worktree | Assignment-only revision | Exclusive outcome |
| --- | --- | --- | --- |
| A / R4-A | `work/retire-ts-host`, `/home/canina7/Projects/changekernel-workers/retire-ts-host` | `e17b4a24992802b3b1913f128435ee6e0d5d839e` | Remove historical TS server/API, non-Pi adapters, product policy and four unused host/storage ports. |
| B / R4-B | `work/retire-ts-kernel`, `/home/canina7/Projects/changekernel-workers/retire-ts-kernel` | `2a6de5c0d93bc60faa8635f28d93650f4637c0c8` | Remove obsolete TS kernel/identity machinery, three Pi-named engine compositions and the agent-output port. |

Their own `CHANGEKERNEL_STATUS.md` files enumerate exact owned paths and the frozen 14-file adapter dependency closure plus entrypoint. All Rust files, retained adapters/ports/codecs, tests, manifests, lockfiles and documentation are read-only to workers. Never delete a mixed-language directory. Stop on any retained import of a proposed removal; do not widen scope or change wire semantics. Retired cross-slice callers disappear when both disjoint slices are combined.

Requirements: [historical retirement](.changekernel/wiki/items/system/components/package.md#versioning-and-historical-interpretation), [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy), [supporting package boundary](.changekernel/wiki/items/system/components/package.md#native-rust-bootstrap). Checks: retained import-closure review, `npm test`, `npm run build`, `git diff --check`; no native campaign for unchanged Rust or new inventory tests. Return exact revisions, actual checks and gaps; no self-approval.

## Next manager actions and remaining gates

- Independently review each R4 return and the combined result. The manager alone owns shared contracts, composition, manifests, lockfiles, test registration and consolidated status; do not merge worker handoff files wholesale. Remove unused package dependencies and stale active references as part of that combined review.
- Source-observation acceptance is complete. Native candidate custody still needs an agreed ownership/retention/current-authority contract before dispatch; passing read-only observation tests does not supply it.
- Native intent revision/Decision/Work still needs an explicit versioned two-phase contract and authorization/delegation policy. Resolve ambiguous product intent with the user rather than porting historical stage policy silently.
- Prioritize the [smallest complete bounded self-development path](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus), not a broad catalogue or general framework. Qualification, activation and explicit controller handoff remain separate exact-subject gates. Never govern this checkout with mutable checkout bytes.
