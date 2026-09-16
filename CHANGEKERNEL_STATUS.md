# ChangeKernel source-development status

This temporary note records unfinished pre-handoff source work. Desired behavior belongs in the [native Wiki](.changekernel/wiki/); Changes and Work take over execution state after a qualified external controller is available and explicitly handed control. Git holds checkpoint history.

## Current checkpoint

- Branch: `audit/clean-baseline`. Pi migration checkpoint `8ab91b32e` is pushed; the current source slice connects the Check backend.
- The user selected Pi to replace DeepSeek Harness. Active adapters, private execution/output protocols, tests, dependencies and Wiki design now use Pi; no compatibility layer or second runtime is retained. Historical Change records, archived notes and changelog entries were not rewritten.
- `pi-ai` and `pi-coding-agent` are pinned to **0.85.1**, with the related Pi dependency closure pinned in the development lockfile. Checks call `pi-ai` directly; producer execution uses Pi sessions. Core ports and semantic authority remain runtime-neutral. See [Agent execution](.changekernel/wiki/items/system/components/agent-execution.md).
- The explicit OpenAI-compatible provider helper uses Pi's public request transport hook for endpoint/method checks, redirect rejection, decoded response/error byte limits, request count, timeout and disposal. This does not establish private routing or hard memory containment. Other protocols, live providers and credential arrangements are not qualified by the simulated tests.
- Producer sessions use explicit resources/settings/credentials, no discovered project configuration, no automatic retry or compaction, and exact authorized system prompts. Private Pi history can be resumed explicitly with format/identity checks; older runtime logs are not converted. The current execution host still rejects unimplemented producer tool bindings.
- `src/adapters/pi/check-backend.ts` now privately composes that provider, the tool-free Check model bridge and the isolated Linux runner. It snapshots one literal-loopback configuration, binds all public provider settings plus host-supplied backend and credential-version identities, and exposes only the model binding and existing host operations. It does not verify those identities, adopt Checks or grant permission. Construction performs no inference; exact adopted inputs and current backend authorization remain required. Public Change-loop integration is still unfinished.
- The existing isolated Linux Check runner retains memory/swap/task, read/network, time/output and model-call controls. It admits one execution at a time. Platform dependencies and effective host controls remain deployment requirements; attempt tracking is not durable replay protection. Model calls retain complete usage where available, reject missing usage and poison reuse after uncertain cleanup.

## Next bounded task and remaining gaps

Make Check attempts and completed results durable, with restart reconciliation and current-authority checks before reuse. Then connect the supported Check execution path to one complete Change loop with a small first-party Pack and explicit adoption. Keep tests local and simulated; no live/paid inference, lifecycle activation or controller handoff is authorized.

Producer containment, non-cooperative cleanup, route/credential qualification, restart-safe custody and replay defense remain unfinished. The first-party Pack, explicit Check adoption and durable exact-input result reuse are not completed features. Passing source or package tests does not satisfy the [operational qualification boundary](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood).

## Verification

- `npm test`: **563/563 passed**, including type checks and build. Log: `/tmp/changekernel-pi-backend-full.log`.
- The built candidate was copied, packed and installed only in a disposable external project with isolated home/Pi settings and dummy credentials. Its **94/94 adapter tests passed**, including actual isolated Check execution through Pi, pass/false outcomes, denied/missing/mismatched inputs, bound configuration, body limits and cancellation, plus the previous adapter regressions.
- Candidate, dependency lock, test logs and digest receipt: `/tmp/changekernel-pi-backend-candidate-hx9eQu/`. All eight installed Pi package instances are **0.85.1**. The initial stripped environment lacked access to the user service manager and execution failed closed; the passing repeat explicitly supplies `XDG_RUNTIME_DIR` for that required host service while retaining isolated home/Pi settings. The initial failure log remains available; no containment fallback was added.
- These are development smoke results, not exact-release qualification or controller authority. Changed-file language-server checks, source type checks and executable suites passed. Generated package and runtime artifacts remain outside project Git.
