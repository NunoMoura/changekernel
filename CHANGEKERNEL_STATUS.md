# ChangeKernel temporary source status

## Current handoff — R81 Pi review TUI implementation

The user approved implementing the minimal Pi-hosted TUI for `0.5.0-prototype.1` and explicitly deferred general Check implementation. The [approved UI](.changekernel/wiki/items/system/components/sdk.md#initial-pi-review-tui) and [sequence](.changekernel/wiki/items/product/plan.md#format-first-design-and-pi-first-delivery) are recorded at `2034e4e043d2de8c337c35b86d2f535b40a4a2f4`. This approval is implementation permission, not evidence that human runtime smoke has already happened.

**R81 is assigned, not accepted.** One implementation owner works at `/home/canina7/Projects/changekernel-workers/r81-prototype-tui`, branch `work/r81-prototype-tui`, from base `2034e4e043d2de8c337c35b86d2f535b40a4a2f4`. Exact assignment: `29af5a78be4514d0a81f6b826ccd1e4beb035e14:CHANGEKERNEL_STATUS.md`. Owned source is `src/adapters/pi/referenced-intent/review.ts` and its README, focused host/review tests and worker status. A fixture-only correction to the existing timeout test in `tests/adapters/pi/referenced-intent/delivery.test.mjs` is also authorized after the blocker below. No Rust, wire/profile, manifest, dependency or generic Check changes. The manager owns Wiki and integration. Reuse the accepted native/host foundation; make intent/grounds readable without replacing exact evidence or weakening adoption gates.

Acceptance requires independent source review, active diagnostics with honest coverage, external consumer typecheck/focused real-boundary tests, retained external `npm test`, exact-byte/scope verification and observed cleanup. Actual human approval/reopen smoke follows source review; benchmarks follow that smoke. Candidate execution stays external and isolated. Coordination evidence: `/home/canina7/.local/state/changekernel-source-review/r81-prototype-tui.umyWJ0fd/`.

### R81 fixture blocker disposition

Worker blocker report `a44b8901ce24124c92c3efbb30c5ec11bf4373c9:CHANGEKERNEL_STATUS.md` is acknowledged. Manager independently inspected the timeout test and proposed preview: the test directly supplied invalid literal `"data"` rather than a canonical prepared presentation, so the new preview correctly refused before the timeout assertion. The manager authorizes a fixture-only correction in `delivery.test.mjs`, retaining the 120-second assertions and production validation. Resume R81 and rerun the full affected checks; the initial 29-pass/1-fail consumer run remains preserved failure evidence, not acceptance. No product scope or interface change is authorized.

## R80 accepted documentation baseline

**Manager verdict: `accepted` for the documentation-only R80 slice after independent review and combined verification.** The approved responsibility split and Pack direction are now recorded in the [product](.changekernel/wiki/items/product/changekernel.md), [Checks](.changekernel/wiki/items/system/components/checks.md#engine-invariants-and-configurable-policy), [Pack section](.changekernel/wiki/items/system/components/checks.md#packs-and-first-party-software-development-checks), [property map](.changekernel/wiki/items/product/change-ledger-properties.md) and their dependent desired-state descriptions. The existing property/interaction tables, proposal status and frozen profile semantics remain intact. A possible marketplace is recorded only as a future opportunity, not an implementation assignment.

| Subject | Exact revision |
| --- | --- |
| R80 assignment | `80c72c5f2ead53af4afb78df16df68a8b336965d:CHANGEKERNEL_STATUS.md` |
| Submitted documentation | `873ec393af9c545fa7a93225d8ba71ba4515be7e` |
| Worker report | `7e6a26d2cd7578b4c3d36377a7b2d4a574e907c6:CHANGEKERNEL_STATUS.md` |
| Primary integration | `153077b633d921f530ddc772692709c85b86d759` |

### Review and actual checks

- Independently reviewed all 12 final documentation diffs against the user's approved model. No blocking finding remains. The earlier provisional README concern was already corrected in the submitted revision: only v5/v6 are described as supporting the optional notice assessment; v4 remains opening-only. Capability descriptions preserve the difference between bounded source support, a general Check lifecycle and qualification.
- Manager static checks resolved **238 local inline Markdown links**, including their tracked targets and heading references, with no missing target/anchor. Seven external URLs were not fetched. These were disposable review checks, not permanent documentation-wording tests or a general Markdown parser claim.
- Pre-integration and combined whitespace checks passed. All 12 integrated files exactly match the reviewed subject. Only the assigned documentation paths changed; source/tests, manifests, frozen/consumed profiles, research/archive evidence, AGENTS and the protected draft remain unchanged.
- An active primary-checkout diagnostic probe on all 12 integrated documents reported **12 clean, zero findings or inconclusive/unavailable outcomes**. The worker's separate final probe had 10 clean and 3 unavailable across its 13 changed paths; its limitations remain preserved rather than retrospectively relabeled. No whole-workspace or executable-source diagnostic claim is made.
- No Cargo/npm tests or builds were run for this documentation-only slice. No product runtime, live model call, dependency change, old-custody operation, release qualification, activation or controller handoff occurred.

Evidence remains outside Git at `/home/canina7/.local/state/changekernel-source-review/r78-r79-requirements-audit.GxW6nbkp/`: `r80-manager-preintegration-checks.json`, `r80-manager-combined-checks.json`, `r80-main-active-markdown.txt`, and the worker's `docs/R80_CHECKS.md`.

The manager native-cwd mismatch interrupted review before integration. A subsequent relaunch was verified with native process, session and tool cwd all in the primary checkout on `main`; routing was refreshed before review resumed. The worker's routing-blocker report is historical, not a remaining blocker. Transient identities and transport acknowledgments stay outside Git; reverify them before future contact.

## Remaining work and accepted source

General custom Check definition/adoption/revision/retirement, applicability and required-pass dependent-transition support remain unimplemented. Existing optional fixed assessments and closed referenced-intent scope do not establish that capability. Any implementation needs a separately selected minimal successor contract and assignment; no schema migration or guard deletion follows from this documentation acceptance.

Actual human TUI approval/reopen/lifetime smoke remains outstanding: Friday → Saturday → reopen → Sunday → original-Saturday retrieval/lifetime. Simulated component approvals/time fixtures are not human traversal or affirmative consent. Diagnostic benchmarks follow that smoke. The frozen [referenced-intent contract](.changekernel/wiki/items/system/components/referenced-intent-prototype.md) remains unchanged.

Referenced-intent native integration: `47f51b5fe14fe9656bdbad00b1b5b0ca859c276b`. Pi host integration: `0a25702dc0ef7a50da4696b7a46b2dcb88565ef1`. Full source acceptance, checks/provenance/gaps and preserved native handoffs: `c5083f496042c98e1c3ab3013485941b3c71c478:CHANGEKERNEL_STATUS.md`. R77 source review: `840ae296816635812622ce81955416f618c241b7:CHANGEKERNEL_STATUS.md`; F1 aggregate-budget routing evidence is closed. Candidate/combined evidence remains at `/home/canina7/.local/state/changekernel-source-review/r76-manager-checks.x4ICSDjG/EVIDENCE.md`.

The prior R78/R79 static audit and independent source-capability gap analysis remain at `414af845f9e166ef20868e65f1e88c4084e6bf0e:CHANGEKERNEL_STATUS.md`, with reports `ffd3fcbb3e44b42520d706cded01aa487b527b81` and `dbdf253f3ec19f44b000f4cb9f8f480482c03ba8`. R80 corrects the approved documentation findings, not the missing implementation.

Historical rust-analyzer E0308 findings in unchanged `src/adapters/jsonl/ledger/parser.rs`, their pinned-compiler disposition and undiagnosed cache/analyzer mechanism remain in the prior handoff. Preserve evidence; do not change valid source or reset caches to hide findings. Neither native test gaps nor unrelated analyzer findings are cleared by these Markdown checks.

R38 remains paused. No product-model/Jev call, dependency migration, other harness implementation, old-custody recovery/cleanup, external effect or source-controller loading is authorized. Candidate execution stays in fresh disposable external projects with isolated Pi settings and explicit resources. Do not install project-local ChangeKernel resources. Source/documentation acceptance grants no release qualification, deployment or controller handoff.

## Worker pool and protected work

Eight workers are retained: R81 is assigned; the previous seven remain parked. No other assignment is active. Preserve worktrees, commits and evidence. Under `/home/canina7/Projects/changekernel-workers/`:

| Worktree | Branch | Report/checkpoint |
| --- | --- | --- |
| `r69-referenced-intent-native` | `work/r69-referenced-intent-native` | `f1696e5012640e842dc05c70b7be81af63f74fdb` |
| `r74-native-review` | `work/r74-native-review` | `451175558859e5482b802b6bb25492c7dd9850b2` |
| `r75-native-comment` | `work/r75-native-comment` | `46439c3ebddecd52c063e61a5a780d2b1b622e12` |
| `r76-referenced-intent-pi` | `work/r76-referenced-intent-pi` | `974ffe45abc3587793a859568bd4dffa3006d95d` |
| `r77-referenced-intent-pi-review` | `work/r77-referenced-intent-pi-review` | `840ae296816635812622ce81955416f618c241b7` |
| `r78-requirements-doc-audit` (R80 reuse) | `work/r78-requirements-doc-audit` | `7e6a26d2cd7578b4c3d36377a7b2d4a574e907c6` |
| `r79-requirements-code-audit` | `work/r79-requirements-code-audit` | `dbdf253f3ec19f44b000f4cb9f8f480482c03ba8` |
| `r81-prototype-tui` | `work/r81-prototype-tui` | assignment `29af5a78be4514d0a81f6b826ccd1e4beb035e14` |

Protected user edit `.changekernel/wiki/items/system/components/pi-coding-change.md` remains unstaged/uncommitted and unchanged: SHA256 `28342862c170012be9c2cb38a3136b1e9659233edddcffe3234c2057d26939fd`. Do not stage, overwrite or copy it into worker checkouts. Generated/runtime artifacts, sessions, credentials, caches and candidate packages remain outside source Git.
