# ChangeKernel source-development status

This temporary note records unfinished pre-handoff source work. Desired behavior belongs in the [native Wiki](.changekernel/wiki/); Changes and Work take over execution state after a qualified external controller is available and explicitly handed control. Git holds checkpoint history.

## Current checkpoint

- Branch: `audit/clean-baseline`. The checkpoint before this migration is `846760e4f`.
- The user selected Pi to replace DeepSeek Harness. Active adapters, private execution/output protocols, tests, dependencies and Wiki design now use Pi; no compatibility layer or second runtime is retained. Historical Change records, archived notes and changelog entries were not rewritten.
- `pi-ai` and `pi-coding-agent` are pinned to **0.85.1**, with the related Pi dependency closure pinned in the development lockfile. Checks call `pi-ai` directly; producer execution uses Pi sessions. Core ports and semantic authority remain runtime-neutral. See [Agent execution](.changekernel/wiki/items/system/components/agent-execution.md).
- The explicit OpenAI-compatible provider helper uses Pi's public request transport hook for endpoint/method checks, redirect rejection, decoded response/error byte limits, request count, timeout and disposal. This does not establish private routing or hard memory containment. Other protocols, live providers and credential arrangements are not qualified by the simulated tests.
- Producer sessions use explicit resources/settings/credentials, no discovered project configuration, no automatic retry or compaction, and exact authorized system prompts. Private Pi history can be resumed explicitly with format/identity checks; older runtime logs are not converted. The current execution host still rejects unimplemented producer tool bindings.
- The existing isolated Linux Check runner retains memory/swap/task, read/network, time/output and model-call controls. It admits one execution at a time. Platform dependencies and effective host controls remain deployment requirements; attempt tracking is not durable replay protection. Model calls retain complete usage where available, reject missing usage and poison reuse after uncertain cleanup.

## Next bounded task and remaining gaps

Wire and qualify the chosen backend configuration through the existing execution host before treating it as operational. Keep tests local and simulated; no live/paid inference, lifecycle activation or controller handoff is authorized by this migration.

Process containment, non-cooperative cleanup, route/credential qualification, restart-safe custody and replay defense remain unfinished. The first-party Pack, explicit Check adoption and durable exact-input result reuse follow supported wiring; they are not completed features. Passing source or package tests does not satisfy the [operational qualification boundary](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood).

## Verification

- `npm test`: **554/554 passed**, including type checks and build. Log: `/tmp/changekernel-pi-migration-full.log`.
- The built candidate was copied, packed and installed only in a disposable external project with isolated home/Pi settings and dummy credentials. Its **85/85 adapter tests passed**, including real Pi parsing of loopback model fixtures, cancellation/disposal, usage, exact prompt scope, private session resume and custody/output regressions.
- Candidate, dependency lock, test log and digest receipt: `/tmp/changekernel-pi-candidate-ZCgjL7/`. All eight installed Pi package instances are **0.85.1**; no DeepSeek dependencies or old adapter files remain in the candidate. These are development smoke results, not exact-release qualification or controller authority.
- Language-server probes reported no errors; some JavaScript checks were inconclusive. The full source type check and executable suites passed. Generated package and runtime artifacts remain outside project Git.
