# ChangeKernel temporary status

## Format-first direction — documentation only

**Design verdict: accepted as user-approved desired state, not executable acceptance.** The reviewed direction is now owned by the [product](.changekernel/wiki/items/product/changekernel.md), [Change-format and lifecycle requirements](.changekernel/wiki/items/system/components/change-format.md), [format-first plan](.changekernel/wiki/items/product/plan.md#format-first-design-and-pi-first-delivery) and [Pi-user distribution contract](.changekernel/wiki/items/system/components/package.md#user-distribution-and-deployment). These replace SDK-first sequencing; the [SDK](.changekernel/wiki/items/system/components/sdk.md) remains a downstream client of supported native semantics. Exact successor schemas, collaboration/priority protocols, deployment/runtime selection and migration remain open, not silently added to existing profiles.

**Implementation remains paused.** This authorization covers Wiki/status updates only. No R38 resume, worker relaunch/dispatch, source acceptance, builds/tests, benchmarks, inference, prototype execution, dependency migration, activation or controller handoff is authorized. No source, tests, manifests, lockfiles, runtime configuration or governed Change record is changed. One stopped worker session/checkpoint was last retained for possible reuse; this update neither recontacts nor relaunches it.

**Next design work:** develop the successor specification from a trivial Change and an extended family covering revisions, parallel Work, failures, uncertain outcomes, priority and collaboration, following the [open contracts](.changekernel/wiki/items/system/components/change-format.md#successor-specification-work). No concrete app consumer, public SDK signature, persistent inventory or new profile version is selected by this documentation adoption.

**Documentation checks:** the 12-path documentation-only scope, 260 local links/anchors across 20 Markdown files and `git diff --check` passed. Active diagnostics across all 12 changed paths found no errors/warnings; State retains three pre-existing informational spelling hints on correct Serde identifiers. The consumed opening contract in State remains byte-identical to the baseline. No source tests or runtime qualification were run, and historical analyzer/cache disagreement remains unresolved. Review evidence: `/home/canina7/.local/state/changekernel-source-review/format-design-docs.dzulvwp3/`.

## Runtime research and tooling boundaries

The [Pi 1.1.0 follow-up](.changekernel/wiki/items/system/research.md#pi-110-session-format-follow-up) records pinned source `abe508e1b89912adde45528136c3221eb69acdd7` and five matching installed-document byte comparisons. The [Pi 1.0.4 report](.changekernel/wiki/items/system/research/pi-runtime-1-0.md) and [capability matrix](.changekernel/wiki/items/system/research/pi-capability-matrix.md) retain their earlier subjects and limits. Supporting TypeScript bridges still pin Pi 0.85.1. None of these inspections or the user's extension updates qualify a new runtime/bridge combination or approve install scripts. No upstream code, test, model call or package installation was executed for this update.

Codemode is available and used here for read-only composition and documentation tooling. [AGENTS.md](AGENTS.md#pi-native-tooling) retains the procedure; reverify exposure and process/session/worktree identity before any later authorized dispatch. No user/project settings were changed. Earlier pause/research evidence remains at `/home/canina7/.local/state/changekernel-source-review/pi-release-reassessment.o5dcgo5m/`; tooling configuration evidence remains at `/home/canina7/.local/state/changekernel-source-review/pi-codemode-setup.r_a9d9a0/`.

## Preserved R38-E WIP — unreviewed and unaccepted

- Assignment: `31fc96235eb3e18a73893ae628d0dc808b7ac505:CHANGEKERNEL_STATUS.md`, R38-E.
- Worker branch/worktree: `work/r38-notice-engine`, `/home/canina7/Projects/changekernel-workers/r38-notice-engine`.
- Exact checkpoint/source/report: `4006de3e84381ec444588c7e05f21f2cec8b09ef:CHANGEKERNEL_STATUS.md`, “R38-E pause checkpoint — WIP UNREVIEWED/UNACCEPTED”. Preservation was acknowledged only; no R38 source was integrated.
- Last reported focused run: 19 engine and 11 primitive tests passed, with one child-only top-level ignore. Later authorization/test edits were **not rerun**; earlier clippy predates them. The full suite timed out. Final fmt/full tests/clippy/comprehensive active diagnostics remain outstanding. Exact logs and gaps are in the report.
- Source base: `8ca5b27c8380876febf830b95d652c311346c38a`. Pending-observation correction: `f3523ebee2921659a0319008e1562c2ec07a6052`; verdict: `04c8e93aa7b86737112313746cf68587359a23e9`. It resolved blocker `c30360b4f02abf0f8bd3e5c6d6524283fc5c0b9e` without accepting the unfinished implementation.

The [v7 contract](.changekernel/wiki/items/system/components/guarded-effect-fixture.md) remains adopted desired state, not accepted executable behavior. Whole-process native Owner continuation, COMMIT-error reset/settlement and reboot continuity remain unqualified. No relaunch or resume is authorized. Original assignments and completed handoffs remain in Git and external evidence.

## Accepted baseline and safety gates

Accepted source remains R35 continuity (`6d1851291e19c4a6bc06607f0634fd3f7701ec35`), R36 consumer (`70abd2a400bb79ad9e29206fd54925321822a52b`) and R37 SQLite fixture (`47f5885578be9d904f05e006e64a02fb41dd5110`), with verdicts `18c4b03cd37f8a05821c1fc45f7e00179eefd882`, `1a24ff4a97d978235d529f65ac983b21673b7cbd` and `f4690c5ea4e32a4a6356653eba9dec81b6e75e93`. This documentation update replaces none of their evidence or retained failures.

JSONL remains lifecycle authority; SQLite is the application validation fixture. Frozen v1–v6 and legacy SQLite APIs, schemas, limits, ownership, accounting and recovery remain unchanged. Mutable checkout never governs itself. No old-custody reopening/repair, standalone effect/continuity execution, privileged setup, reboot/remount, dependency fetch, installation/activation or controller handoff is authorized. R33 `de481b543aed494749c2e619bd8d8de9f9f2b971` remains consumed/CLOSED.

Any later approved native checks use Rust 1.88.0, locked/offline dependencies, external targets and short external btrfs TMPDIR under `AGENTS.md`. Preserve analyzer/cache disagreement and failing evidence; no timestamp workaround or cache reset. At most 15 retained workers, including stopped/parked sessions retained for reuse.
