# ChangeKernel temporary source status

## Current handoff — requirements and authority alignment audit

The user requested a check of documentation and code against the clarified separation: Checks express custom requirements at decision/execution boundaries; Ledger-associated AuthN/AuthZ governs identity and authority; native identity/version, concurrency, durability and retry safeguards remain internal integrity mechanics, not another user-facing policy layer. This is the audit criterion, not adoption of a replacement wire contract or permission to edit the implementation.

Two independent report-only audits use accepted subject `c5083f496042c98e1c3ab3013485941b3c71c478`:

| Assignment | Branch / external worktree | Assignment checkpoint / scope |
| --- | --- | --- |
| R78 documentation | `work/r78-requirements-doc-audit` / `/home/canina7/Projects/changekernel-workers/r78-requirements-doc-audit` | `96185252da9dff3259cb649bfa11632b1ba091fd`; current Wiki semantics, proposals and frozen-profile distinctions |
| R79 source/tests | `work/r79-requirements-code-audit` / `/home/canina7/Projects/changekernel-workers/r79-requirements-code-audit` | `35c30b0b57866fc1a545817d30b4d09b40754179`; actual Check/adoption/gating, authority and integrity paths |

Each worker owns only its `CHANGEKERNEL_STATUS.md` report. Source, tests, Wiki and manifests are frozen. The manager separately checks the protected primary Wiki edit without altering or copying it. Findings must distinguish terminology drift, actual extra requirement semantics, missing desired capability and preserved historical/current profile contracts; names alone are not defects. Correction options remain proposals until reviewed and approved at the appropriate scope.

Native/session cwd, branch/checkpoint, clean tree and working Codemode were verified before substantive dispatch. Current manager identity was reverified after detecting historical routing metadata; fresh routes and evidence are outside Git at `/home/canina7/.local/state/changekernel-source-review/r78-r79-requirements-audit.GxW6nbkp/`. The manager will inspect exact reports and consolidate findings before proposing corrections. No source acceptance, runtime experiment, schema migration or new implementation follows from dispatch. Human TUI smoke remains outstanding while this audit is addressed.

## Accepted prerequisite — human TUI smoke remains open

**Manager verdict: `accepted` for the bounded referenced-intent native and Pi host source.** Primary `main` contains the integrated host at `0a25702dc0ef7a50da4696b7a46b2dcb88565ef1`. This is source acceptance only: no real-human TUI smoke, release qualification, deployment or controller handoff has occurred.

The frozen [referenced-intent contract](.changekernel/wiki/items/system/components/referenced-intent-prototype.md) and [plan](.changekernel/wiki/items/product/plan.md#format-first-design-and-pi-first-delivery) govern the next steps. Prepare a fresh disposable external supported instance for actual human TUI approval and Friday/Saturday/reopen/Sunday/original-Saturday retrieval/lifetime smoke. Human traversal and the separate affirmative action cannot be supplied by an automated fixture. Diagnostic measurements follow the smoke. No repeated general direction-approval gate is open; bring only genuinely new product intent or safety choices to the user.

## R76 / R77 acceptance evidence

| Subject | Exact evidence |
| --- | --- |
| R76 implementation | `7f2e07cd81e7985d98bb7d352280c3943327c6ff`; report `974ffe45abc3587793a859568bd4dffa3006d95d:CHANGEKERNEL_STATUS.md` |
| Independent R77 review | `840ae296816635812622ce81955416f618c241b7:CHANGEKERNEL_STATUS.md`; recommendation accepted, no concrete supported-path blocker |
| Integrated scope | The 19 new paths under `src/adapters/pi/referenced-intent/` and `tests/adapters/pi/referenced-intent/`, byte-identical to the reviewed subject; no Rust, existing adapter or root manifest/lockfile change |
| Manager checks before integration | Fresh external locked native build with explicit Rust/Cargo 1.88.0, Pi 1.2 strict typecheck, 23 focused tests and retained typecheck/70 tests; all exit 0 |
| Combined checks after integration | Fresh archive of `0a25702dc0ef7a50da4696b7a46b2dcb88565ef1`; new-closure typecheck, 23 focused tests and retained typecheck/70 tests pass, no skips/failures; all 191 tracked archive hashes unchanged |
| Process evidence | Real disposable btrfs/native reopen and installed Pi RPC lifetime tests observe exits; manager process-group scans find no remaining check processes and no denied entries |

**F1 closed:** the author corrected per-call counters to shared composition budgets. R77's independently inspected actual installed Pi 1.2/builtin Codemode probe, with a deterministic provider and framed peer but no inference, verifies 64 successes, 65th refusal before dispatch, and one successful explicit continuation. The manager inspected the drivers and checked actual event parentage, 65 total native dispatches and observed exit. This is real runtime routing evidence, not human approval or real native custody in that probe; separate tests cover real native custody with simulated UI.

**Diagnostics:** fresh strict tsc passes in the correct external Pi 1.2 closure. Active staged LSP is inconclusive for seven files, not clean; R77's probe was unavailable. The primary-path probe collected 47 auxiliary findings. Manager review dispositioned the fixed-schema RegExp audit warning and guarded boundary/style findings as non-blocking; no concrete defect was established and no suppressions/cache resets were added. No wholly-clean editor claim follows.

**Provenance and gaps:** manager and reviewer artifacts were independently built with explicit Rust 1.88.0; the author's artifact used ambient 1.99.0 and retains that provenance. Retained dependencies remain Pi 0.85.1; the new host has a separate external Pi 1.2 closure, not a migration. Approval and time fixtures remain simulated; real-human TUI smoke and diagnostic benchmarks remain open. No terminal qualification, new pending-cut/larger-material crash-cut witness or unchanged-native fault campaign is claimed for this TypeScript-only slice.

Full commands, subjects, hashes, logs, diagnostic dispositions and cleanup:
- Manager: `/home/canina7/.local/state/changekernel-source-review/r76-manager-checks.x4ICSDjG/EVIDENCE.md` (post-integration evidence under `combined/`).
- Reviewer: `/home/canina7/.local/state/changekernel-source-review/r77-review.HXRsCfix/EVIDENCE.md`.
- Author: `/home/canina7/.local/state/changekernel-source-review/r76-worker-checks.3qsWa6oA/EVIDENCE.md`.
- Coordination/checkpoint evidence: `/home/canina7/.local/state/changekernel-source-review/r76-pi-host.XGkmccKy/`. Routing identities and acknowledgments remain outside Git; reverify before contact.

## Accepted native prerequisite and preserved boundaries

Native integration is `47f51b5fe14fe9656bdbad00b1b5b0ca859c276b`; complete native acceptance is `f27d413404cc4a75a54b2f918bc43c04b9f41368:CHANGEKERNEL_STATUS.md`. Prior R75 fresh external checks under explicit Rust 1.88.0 passed `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings` and `cargo test --locked` (264 passes, five ignored helpers, referenced-intent 32/32). These are preserved native evidence, not newly repeated checks or human approval. Evidence remains at `/home/canina7/.local/state/changekernel-source-review/r75-native-integration.q20hq86d/`.

Eight historical rust-analyzer E0308 array-to-slice findings in unchanged `src/adapters/jsonl/ledger/parser.rs` were dispositioned false positives against exact blob `ae3bcb7941b126158ab27a41600a8e1da7c60d74` and successful fresh pinned all-target compilation. Their analyzer/cache mechanism remains undiagnosed. Preserve evidence; do not alter valid source or reset caches to hide findings. Informational Rust2024 suggestions do not authorize migration.

Contract subject: `7b0f779f9ea16e50fcd602cd24e029b1dfef7aec`; focused review: `da01564f3cf51dec73a8ba4c44e024769fb0256f`; version `0.5.0-prototype.1`. Current source has the opt-in bridge; old CLI-stub wording describes the preimplementation state. Existing native test gaps and R69/R72 historical evidence limits remain in the accepted native handoff. Never reopen, repair, resume or clean old custody for this work.

R38 remains paused. No product-model/Jev call, dependency migration, other harness, external effect, power-loss/reboot qualification, hostile-same-account guarantee, release activation or controller transfer is authorized by this source acceptance. Candidate execution stays in disposable external projects with isolated Pi settings and explicit inspected resources. Never load this checkout as its controller or install project-local ChangeKernel resources.

## Parked pool and protected work

Seven managed workers are retained: R78 and R79 are active on the report-only audits above; these five prior workers remain parked with no new assignment. Preserve all worktrees, commits and evidence. Under `/home/canina7/Projects/changekernel-workers/`:

| Worktree | Branch | Report/checkpoint |
| --- | --- | --- |
| `r69-referenced-intent-native` | `work/r69-referenced-intent-native` | `f1696e5012640e842dc05c70b7be81af63f74fdb` |
| `r74-native-review` | `work/r74-native-review` | `451175558859e5482b802b6bb25492c7dd9850b2` |
| `r75-native-comment` | `work/r75-native-comment` | `46439c3ebddecd52c063e61a5a780d2b1b622e12` |
| `r76-referenced-intent-pi` | `work/r76-referenced-intent-pi` | `974ffe45abc3587793a859568bd4dffa3006d95d` |
| `r77-referenced-intent-pi-review` | `work/r77-referenced-intent-pi-review` | `840ae296816635812622ce81955416f618c241b7` |

The protected user edit `.changekernel/wiki/items/system/components/pi-coding-change.md` remains unstaged/uncommitted and unchanged: SHA256 `28342862c170012be9c2cb38a3136b1e9659233edddcffe3234c2057d26939fd`. Do not stage, overwrite or copy it into worker checkouts. Generated/runtime artifacts, sessions, credentials, caches and candidate packages remain outside source Git.
