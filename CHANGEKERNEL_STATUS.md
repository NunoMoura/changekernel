# ChangeKernel source-development status

This temporary note records unfinished pre-handoff source work. Desired behavior belongs in the [native Wiki](.changekernel/wiki/); Changes and Work take over execution state after a qualified immutable external controller is available and explicitly handed control. Git holds checkpoint history.

## Current checkpoint

- Branch: `audit/clean-baseline`; executable checkpoint `1a5a39c16` is pushed. Pi **0.85.1**, the private bounded Check backend and durable exact-attempt retention remain in place. See [Agent execution](.changekernel/wiki/items/system/components/agent-execution.md).
- The current design correction assigns transversal validation to ChangeKernel's versioned backend and domain-specific policy assessment to adopted stage-bound Checks. Both may use computation or bounded semantic assessment. The four loops remain Decision, Planning, Implementation and Review; there is no separate selectable Wiki or lifecycle profile. See [backend stage contracts](.changekernel/wiki/items/system/components/changekernel.md#backend-validation-across-four-loops) and the [first-party software Pack](.changekernel/wiki/items/system/components/checks.md#first-party-software-development-pack).
- This checkpoint updates desired design, not executable validation. `src/kernel/gates/checks.ts` currently selects and reduces adopted Check results only; its aggregate is not the revised combined lifecycle gate. `src/server/commands/lifecycle.ts` still rejects unimplemented lifecycle operations. Existing experimental Decision helpers do not constitute the complete backend contract.

## Next bounded task and remaining gaps

Implement release-owned, stage-specific backend validation and result admission, beginning with Decision. Preserve the ownership distinction when sharing the existing bounded execution and retention machinery; do not manufacture Pack adoption for backend validators or enable progression from domain results alone. Develop the software Pack's focused positive/negative cases against the agreed stage matrix, then connect one complete Change loop with explicit domain adoption and retained Evidence.

Public loop integration, backend semantic quality, Pack adoption, producer containment/recovery and exact external qualification remain unfinished. Check custody is limited to 256 attempts, with no automatic archival, reset or retry. Physical crash/disk durability, privileged history rollback and operator-authorized reconciliation remain outside demonstrated recovery. Actual model deployment, routing and credentials still require qualification; unchanged stored bytes do not establish external freshness. No live/paid inference, activation or controller handoff is authorized by this source-development work.

## Verification

- Design checkpoint: **583/583 repository tests passed**, including type checks and build; log `/tmp/changekernel-validation-ownership-full.log`. Language-server checks confirmed all **22** changed Markdown files clean. Local validation checked **107** links, **27** heading references and the architecture diagram's connected paths; all **20** Wiki source-metadata blocks remain byte-for-byte unchanged. No executable source or test contract was changed.
- Previous executable checkpoint: **583/583 repository tests** and **136/136 installed-candidate adapter tests** passed. The earlier external candidate, dependency lock and smoke receipt remain at `/tmp/changekernel-durable-check-proof-R7TCJ0/`; they are not qualification of this revised design or a controller release.
- Generated state, package artifacts and runtime scratch remain outside project Git. Existing untracked `outputs/`, stashes and historical Change records are preserved.
