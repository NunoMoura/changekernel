# ChangeKernel temporary source status

## Current handoff — alignment audit complete; corrections not adopted

**Manager verdict: `accepted` for the R78/R79 audit reports. Overall alignment is partial.** The user asked whether documentation and code follow the separation of custom decision/execution requirements (Checks), Ledger-associated AuthN/AuthZ, and internal integrity mechanics. The audits reviewed exact subject `c5083f496042c98e1c3ab3013485941b3c71c478`; this turn changes no Wiki, source, tests or manifests. Existing bounded prototype source acceptance remains unchanged, not extended to a general Check lifecycle.

| Report | Exact report and scope |
| --- | --- |
| R78 documentation | `ffd3fcbb3e44b42520d706cded01aa487b527b81:CHANGEKERNEL_STATUS.md`; desired-state wording, proposals and frozen-profile distinctions |
| R79 code/tests | `dbdf253f3ec19f44b000f4cb9f8f480482c03ba8:CHANGEKERNEL_STATUS.md`; actual assessment, authority, consent, integrity and capability boundaries |

### Consolidated findings

- **Documentation has an extra governance layer.** `.changekernel/wiki/items/product/changekernel.md:89–97,126–136` gives a separately versioned Kernel responsibility for governance and selected Checks. `checks.md:65–72,148–152` and `README.md:5,17` retain that indirection. User-adopted Check requirements are already described at `checks.md:76–105`, so the desired-state descriptions are not consistently simplified.
- **Some obligations need classification, not deletion.** Grounded-feasibility wording (`checks.md:72`; `ledger-governance-and-admission.md:60–62`) does not clearly distinguish an adopted substantive Check from honest-evidence mechanics or optional guidance. Native/resource obligations and release-owned evaluator “policy authority” (`checks.md:68,99,204`; `agent-execution.md:110`) must not create hidden goal-quality vetoes, but native permissions, business/data validity, consent and integrity cannot be waived or relabeled as Boolean assessment results. These pages contain earlier adopted direction; semantic correction needs explicit approval.
- **General custom Check requirements are not implemented.** Native assessment fixes one optional notice-fit question (`src/kernel/changes/assessment.rs:3–5`; `src/adapters/jsonl/intent_trace.rs:352–395`). The inspected retained profiles have no general definition/adoption/revision/retirement/applicability or required-pass dependent-transition lifecycle. `tests/ledger_history.rs:289–327` intentionally permits revision after the optional Check reports false. This is a missing desired capability, not a demonstrated bypass of the consumed contract.
- **Existing fixed descriptors are not a generic goal-policy engine.** `src/kernel/changes/referenced_intent.rs:14,163–176` pins the closed personal-plan scope, exact approval and absence of domain requirements/effects. Lease checks, Prepare/Confirm and storage guards separately enforce authority, consent and integrity. Removing `policy` fields would change retained contracts, not merely simplify terminology. Retained TypeScript role/stage and `policyDigest` identities also remain compatibility constraints, not the new native lifecycle.
- **README inventory is stale.** It omits later bounded Ledger support and describes the launcher as non-operational (`README.md:9,42,48–54`), although `src/main.rs:12–17` exposes the opt-in trusted referenced-intent bridge. General Checks/effects and release qualification are still unfinished.

In the first two bullets, abbreviated Wiki paths are under `.changekernel/wiki/items/system/components/`. Full citations, aligned areas, coverage and limits are in the exact worker reports.

### Next action and review evidence

**Proposed correction scope, not adopted or dispatched:** reconcile desired-state product/Checks/governance/plan/README wording around Checks and Ledger authority, without a separate owner of custom requirements; classify feasibility, native constraints and evaluator provenance explicitly; refresh bounded capability descriptions. If bundles/defaults remain useful, they must not gain independent authority. Preserve consent, exact evidence and all frozen profile bytes/guards. Any general Check-gated decision/execution implementation requires its own minimal consumed successor contract and assignment. No blanket rename, schema migration or guard deletion is authorized by this audit.

The manager independently read both reports, inspected consequential document clauses and source/test bodies, and verified report-only deltas and clean worker trees. Static review only: no Cargo/npm tests, build, live inference or runtime probe was run. No supported-path authority/Check bypass was established in the inspected code; this is not an exhaustive security audit or whole-workspace diagnostic claim. Manager status Markdown active diagnostics and whitespace checks pass.

Evidence and fresh routing remain outside Git at `/home/canina7/.local/state/changekernel-source-review/r78-r79-requirements-audit.GxW6nbkp/`, including `manager-audit-verdict.json`. Historical manager routing was detected and corrected before substantive dispatch; verify current recipients before future contact. The manager separately inspected the protected primary draft: it adds no separate Kernel primitive, but its general policy wording inherits this clarification. Its publication-scope differences are outside this audit and were not adopted.

## Accepted source and remaining runtime gate

Referenced-intent native integration: `47f51b5fe14fe9656bdbad00b1b5b0ca859c276b`. Pi host integration: `0a25702dc0ef7a50da4696b7a46b2dcb88565ef1`. Full prior acceptance, exact tests/provenance/gaps and preserved native handoffs: `c5083f496042c98e1c3ab3013485941b3c71c478:CHANGEKERNEL_STATUS.md`. R77 independent source review is `840ae296816635812622ce81955416f618c241b7:CHANGEKERNEL_STATUS.md`; F1 aggregate-budget routing evidence is closed. Manager candidate/combined evidence remains at `/home/canina7/.local/state/changekernel-source-review/r76-manager-checks.x4ICSDjG/EVIDENCE.md`.

Actual human TUI approval/reopen/lifetime smoke is still outstanding; component approvals and time fixtures remain simulated. Diagnostic benchmarks follow that smoke, not source acceptance alone. The frozen [referenced-intent contract](.changekernel/wiki/items/system/components/referenced-intent-prototype.md) and [plan](.changekernel/wiki/items/product/plan.md#format-first-design-and-pi-first-delivery) remain unchanged. No release qualification, deployment or controller handoff follows from either source acceptance or this audit.

Historical rust-analyzer E0308 findings in unchanged `src/adapters/jsonl/ledger/parser.rs`, their pinned-compiler disposition and undiagnosed cache/analyzer mechanism remain in the prior handoff. Preserve evidence; do not change valid source or reset caches to hide findings. Prior native test gaps are not cleared by this static audit.

R38 remains paused. No product-model/Jev call, dependency migration, other harness implementation, old-custody recovery/cleanup, external effect or source-controller loading is authorized. Candidate execution stays in fresh disposable external projects with isolated Pi settings and explicit resources. Do not install project-local ChangeKernel resources.

## Parked pool and protected work

Seven workers are parked; no further assignment is active. Preserve their worktrees, commits and evidence. Under `/home/canina7/Projects/changekernel-workers/`:

| Worktree | Branch | Report/checkpoint |
| --- | --- | --- |
| `r69-referenced-intent-native` | `work/r69-referenced-intent-native` | `f1696e5012640e842dc05c70b7be81af63f74fdb` |
| `r74-native-review` | `work/r74-native-review` | `451175558859e5482b802b6bb25492c7dd9850b2` |
| `r75-native-comment` | `work/r75-native-comment` | `46439c3ebddecd52c063e61a5a780d2b1b622e12` |
| `r76-referenced-intent-pi` | `work/r76-referenced-intent-pi` | `974ffe45abc3587793a859568bd4dffa3006d95d` |
| `r77-referenced-intent-pi-review` | `work/r77-referenced-intent-pi-review` | `840ae296816635812622ce81955416f618c241b7` |
| `r78-requirements-doc-audit` | `work/r78-requirements-doc-audit` | `ffd3fcbb3e44b42520d706cded01aa487b527b81` |
| `r79-requirements-code-audit` | `work/r79-requirements-code-audit` | `dbdf253f3ec19f44b000f4cb9f8f480482c03ba8` |

Protected user edit `.changekernel/wiki/items/system/components/pi-coding-change.md` remains unstaged/uncommitted and unchanged: SHA256 `28342862c170012be9c2cb38a3136b1e9659233edddcffe3234c2057d26939fd`. Do not stage, overwrite or copy it into worker checkouts. Generated/runtime artifacts, sessions, credentials, caches and candidate packages remain outside source Git.
