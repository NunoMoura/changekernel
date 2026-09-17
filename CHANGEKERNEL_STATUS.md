# ChangeKernel source-development status

This temporary note records unfinished pre-handoff source work. Desired behavior belongs in the [native Wiki](.changekernel/wiki/); Changes and Work take over execution state after a qualified immutable external controller is available and explicitly handed control. Git holds checkpoint history.

## Current checkpoint

- Branch: `audit/clean-baseline`; this source slice follows pushed Decision checkpoint `726f450ab`. Pi **0.85.1** remains pinned. The [transversal/backend and domain/Check boundary](.changekernel/wiki/items/system/components/changekernel.md#backend-validation-across-four-loops) is unchanged.
- Private [Decision validation](.changekernel/wiki/items/system/components/decision.md#bounded-assessment-material-and-execution) now has ten release-owned conditions, explicit source roles, separate backend input/result identities and combined result admission. All ten and the required adopted domain assessment must pass. Missing material, other stages, stale bindings, caller replacements and domain-result relabeling are rejected. Admission is not approval or a lifecycle mutation.
- Backend conditions use the existing isolated worker, bounded model route and [durable Check execution log](.changekernel/wiki/items/system/components/agent-execution.md#durable-check-attempts-and-completed-results), without fabricated Pack adoption. The trusted host must supply its verified Kernel Build; input and prompt budgets are checked before reservation. True and false results survive a fresh process without inference, under current delivery authority. The internal Linux runtime dependency identity is now `@3.0.0`; this is not a second public lifecycle version.
- Retained domain results can now be read without launching work: `readRetainedCheck` checks current authority and exact bindings, returns missing results as unavailable and preserves false results and stopped failures. The component is named **Check execution log**; stored paths and protocol identifiers are unchanged. Source assembly still needs separate authentication of current material and adoption policy.
- This is private execution/admission infrastructure, not a complete Decision service. Callers still owe authenticated current source material, domain-result provenance and exact authority. The public lifecycle remains unconnected to this path. Existing experimental Decision helpers are not a substitute for the new contract.

## Next bounded task and remaining gaps

Authenticate and assemble Decision material from current stored sources and retained domain evaluations before connecting public admission. Develop the software Pack's meaningful, independently reviewed positive/negative and adversarial cases, qualify common judgment quality, and implement the remaining stage contracts. Connect one complete loop only with explicit domain adoption, retained Evidence and separate approval.

Public loop integration, semantic quality, Pack adoption, producer containment/recovery and exact external qualification remain unfinished. Custody is limited to 256 attempts, with no automatic archival, reset or retry. Physical crash/disk durability, privileged history rollback and operator-authorized reconciliation remain outside demonstrated recovery. Actual model deployment, routing and credentials still require qualification; unchanged stored bytes do not establish external freshness. No live/paid inference, activation or controller handoff is authorized by this source-development work.

## Verification

- **609/609 repository tests passed**, including type checks and build; log `/tmp/changekernel-execution-log-full.log`. **161/161 installed-candidate tests passed**, using isolated settings, dummy credentials and loopback fixtures. All **134** installed distribution files match tested source build bytes; eight Pi dependency instances remain **0.85.1**. Candidate, lock and receipt: `/tmp/changekernel-execution-log-proof-wZuWxC/`.
- These tests cover contracts, execution, restart reuse, ownership rejection and failure handling. They do not qualify semantic judgments, private routing, physical crash durability or controller authority. Scoped language-server probes reported no errors; some silent-on-clean checks remained inconclusive. Type checks and executable tests passed.
- Generated state, package artifacts and runtime scratch remain outside project Git. Existing untracked `outputs/`, stashes and historical Change records are preserved.
