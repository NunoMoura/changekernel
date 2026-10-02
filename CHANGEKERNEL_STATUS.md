# ChangeKernel source status

## Current gate — R20, Phase 1 contract closure

The user authorized continued core-first development and routine delegation through Herdr. The reviewed documentation baseline is `e0e309dd6f37a4da5e4eadb298bbaa8ab190fccd`. [Phase 1](.changekernel/wiki/items/product/plan.md#phase-1--a-durable-inspectable-change-without-effects) is not implemented or accepted. The immediate increment is **opening → inspection → restart/reopen**; revisions, Decision and Planning remain subsequent Phase 1 obligations.

The user's history clarification is recorded in `aaa81bf809b6de9faa34cc5d441393d8d7ede397:.changekernel/wiki/items/system/components/state.md`: Change history means accepted Trace records, not a separate History entity/database. Native State remains in the application's database/filesystem; persisted custody controls and referenced evidence support acceptance/recovery rather than form another lifecycle history. The manager owns this clarification outside the worker's proposed section and will preserve it during integration.

The manager selects the bounded **single-slot, trusted Rust test-host witness** as the direction for the next implementation, not as a qualified application host. No agent, application effects, privileged service, VM/BPF, generic framework or legacy migration is required. Its concrete protocol remains unaccepted pending the corrections below. Production implementation is blocked until the corrected exact revision passes review. One later owner will implement producer, consumer, storage and integration evidence together; the manager owns contract adoption and manifest/lockfile changes.

## Manager review verdicts

| Slice and exact revision | Verdict and boundary | Next action |
| --- | --- | --- |
| R20-V baseline challenge, `00fe2296540dcced9c533f654dc26f3abbd07f6c` | **accepted** as a bounded compatibility/acceptance report, not JSONL implementation evidence. The manager inspected the referenced Rust boundaries and independently reproduced the 22 retained-compatibility tests. | Retain its behavioral matrix as review input. |
| R20-V2 exact-proposal review, `53ce8f1a6a1141dce88cc7cff9e2998fa9b12009` | **accepted** as a bounded review report. The manager independently confirmed B1 against the exact proposal: a preparing anchor plus synchronized installed-stage `anchor.tmp` has no specified cleanup/refusal path. | Reviewer parks after report; a corrected exact proposal needs fresh review. |
| R20-P proposal, `fa8ed353d587513b183431062dd82d601bf9eb6f` | **changes requested**. The consumed fixture is suitably bounded, but the following naming and recovery decisions must close before adoption. | R20-P2 correction assignment below. |

Findings refer to `fa8ed353d587513b183431062dd82d601bf9eb6f:.changekernel/wiki/items/system/components/state.md`:

1. **Missing anchor-temporary recovery decision, lines 230–234.** Preparing anchor → complete initial controls → write/synchronize installed-stage `anchor.tmp` → interruption before rename leaves the reserved exclusive-create name occupied. Checkpoint and incident temporary rules at lines 246–253 do not cover this case. Specify supported removal/resume versus refusal, including partial, unrelated and interrupted-cleanup cases. A temporary is never selected as authority. See exact R20-V2 B1 for the bounded counterexample; no new registry or witness is requested.
2. **Workspace contract mismatch, lines 196–228.** New envelopes and anchor use `workspace`, contrary to the product's explicit `workspace_id` convention. Use `workspace_id` consistently in the proposed new shapes and examples; retained `container_id` contracts stay untouched.
3. **Fourth public stage, lines 205–218.** `stage: "opened"` conflicts with [Decision → Planning → Execution](.changekernel/wiki/items/product/changekernel.md#intent-and-lifecycle). Opening is captured intent, not another public stage or admission. Remove the redundant stage field, or distinguish capture status from the three-stage vocabulary without claiming Decision admission.
4. **Identifier validation ambiguity, lines 200–208.** The blanket `[A-Za-z0-9_-]{1,64}` rule conflicts with derived `change-1:origin`. State which opaque identifiers follow the rule and give the derived result identity's exact construction/bound; the installed binding version is already separately constrained.
5. **Decoder/dependency closure, line 265.** Select a concrete duplicate-rejecting decoder and deterministic emitter rather than relying on `serde_json::Value` or its default control-character escapes. Propose any direct Serde dependency/features actually needed at pinned versions; this is a closure decision, not permission to edit manifests or fetch/install packages. The manager will adopt the minimal justified manifest/lockfile change separately.

### Independent checks and limits

At integration checkpoint `caa4a7065bb2f309a1edcaec6bba9be77e3b7283`, source/manifests were unchanged from the reviewed baseline. The manager ran:

- `CARGO_NET_OFFLINE=true cargo test --locked --test native_intake --test native_intake_sqlite --test native_continuation --test native_intent_revision`: 22 passed.
- `CARGO_NET_OFFLINE=true cargo test --locked`: full native suite passed, including packet/source regressions and documentation targets. Three ignored packet child-entry helpers are exercised by their parent tests; this is not a skipped capability claim.
- `cargo fmt --check`: passed.
- `CARGO_NET_OFFLINE=true cargo clippy --locked --all-targets -- -D warnings`: passed.
- Submitted scope and whitespace checks: passed. Active probes for `src/application/intake.rs` and `src/lib.rs` reported zero diagnostics; native document-symbol navigation returned the expected intake operations. These observations do not close the separate analyzer-readiness investigation.

Source review confirms that existing intake/continuation identities, schemas and retry meanings remain unchanged; candidate path-only attribution and the unintegrated candidate writer remain known gaps. No JSONL runtime, reboot, physical power loss, host installation, controller operation, acquisition, privileged experiment or product-provider inference was tested. npm is unnecessary for these Rust-boundary reports. No source code was loaded as its own controller.

## R20-P2 — Bounded correction assignment

- **Branch/worktree:** `work/r20-core-profile`; `/home/canina7/Projects/changekernel-workers/r20-core-profile`.
- **Continuation checkpoint:** clean HEAD `fa8ed353d587513b183431062dd82d601bf9eb6f`. Continue only after native process cwd, actual session cwd, branch and checkpoint match; stop for manager-led relaunch on mismatch.
- **Owned writes:** only the existing explicitly proposed/unaccepted R20 section in `.changekernel/wiki/items/system/components/state.md` and this worker's `CHANGEKERNEL_STATUS.md`. No other Wiki changes, production code, tests, public interface implementations, manifests/lockfiles or tool settings.
- **Outcome:** resolve findings 1–5 above surgically. Preserve the selected one-user/one-slot fixture, original-key semantics, no-effects boundary, useful clean restart and honest refusal/lost-evidence limits. Anchor-temp handling must compare the independently supplied grant, installed/preparing anchor, initial inventory and pinned directory/lock identities, run under the same writer boundary, synchronize permitted cleanup and never enroll a new identity from absence. Explicit refusal is acceptable for unsupported/torn cases; do not claim those cases resume. Keep checkpoint/incident rules consistent with this decision.
- **Checks:** walk the named anchor-temp cutpoints and useful fresh provision/open/inspect/restart/exact-retry path. Verify all examples use the chosen field/stage/identity rules. Explain the actual bounded decoder/emitter and proposed direct dependency closure. Use ordinary read-only inspection and necessary unprivileged disposable probes only; no duplicate permanent codec or test framework. Do not acquire dependencies or repair tools to answer a prose closure question.
- **Return:** commit only owned changes, report the exact revision, corrected cases, actual checks and remaining gaps, then stop. Do not self-approve, merge/rebase/push, spawn workers or start implementation. The manager independently reviews the corrected exact subject and combined result before any adoption or implementation handoff.
- **Requirements:** [product identity and stages](.changekernel/wiki/items/product/changekernel.md), [State acceptance/recovery](.changekernel/wiki/items/system/components/state.md), [first trusted-host profile](.changekernel/wiki/items/system/components/agent-execution.md#first-trusted-host-profile), [Phase 1](.changekernel/wiki/items/product/plan.md#phase-1--a-durable-inspectable-change-without-effects). Original assignments remain at `3c6063945ee805de5326c0d3f7b93182a2d4a521:CHANGEKERNEL_STATUS.md`; exact-review assignment remains at `caa4a7065bb2f309a1edcaec6bba9be77e3b7283:CHANGEKERNEL_STATUS.md`.

## R20-V3 — Corrected exact-subject review

R20-P2 is submitted at `9d5644e3a873ea5bf488175212dd489aa94b254c`, clean and within its two owned paths. Its correction report and proposed State section are the exact review subject; the manager separately preserves the user's accepted history clarification at `aaa81bf809b6de9faa34cc5d441393d8d7ede397`. No implementation is dispatched by this review assignment.

- **Reviewer branch/worktree/checkpoint:** `work/r20-core-validation`; `/home/canina7/Projects/changekernel-workers/r20-core-validation`; clean `53ce8f1a6a1141dce88cc7cff9e2998fa9b12009`. Verify current native/session cwd and branch before work.
- **Owned writes:** only the reviewer's `CHANGEKERNEL_STATUS.md`. No Wiki, code/tests, manifests, lockfiles, tool settings or permanent probes.
- **Outcome:** check the exact corrected proposal against all five manager findings, the prior B1 counterexample, retained contracts and the user's history clarification. Verify that allowed anchor-temporary cleanup is independently grounded, bounded and repeatable across the named cuts without erasing incidents or treating a temporary as authority. Check the selected decoder/emitter and dependency proposal for implementable fixed-profile closure. Do not widen this into a general survey or require deferred host/power-loss qualification for a source fixture.
- **Return:** concise concrete remaining blockers with exact lines/counterexamples, or no remaining blockers for bounded implementation; distinguish that recommendation from implementation conformance or manager acceptance. State actual checks/gaps, commit the report and stop. The manager independently reviews and owns adoption/manifest changes.

## Coordination and boundary

R20-V continues only the exact-subject review above from `53ce8f1a6a1141dce88cc7cff9e2998fa9b12009`. R20-P remains parked at its submitted correction until an explicit next assignment. Current pool: two R20 workers plus four previously retained sessions, six total, below the ceiling of 15. Older R19-N/R19-M/R18-N/R18-T worktrees remain parked; their exact reports and pending prior notification history remain at `e0e309dd6f37a4da5e4eadb298bbaa8ab190fccd:CHANGEKERNEL_STATUS.md` and in [research](.changekernel/wiki/items/system/research.md#exact-reports-and-retained-limits). No old work is silently resumed.

Manager verifies the current recipient session and worktree before every peer dispatch, identifies exact assignment/report/verdict revisions and correlates acknowledgments without blind retries. Routing/session identifiers and transport acknowledgments stay outside Git. Startup's per-run `--offline --no-approve` flags change no saved trust/settings and make no analyzer-readiness claim.

[AGENTS.md](AGENTS.md) owns source procedure. Use native tools and source tests; never load mutable ChangeKernel code as controller or invoke governed Wiki operations in this checkout. Only an exactly qualified immutable external Product release plus required activation and explicit controller handoff can govern a later candidate. Dispatch, documentation adoption and release activation are not implementation acceptance or controller authority.
