# Referenced-intent Pi host (source candidate)

ChangeKernel `0.5.0-prototype.1`, targeting Pi **1.2.0**. This is the new host closure, not an upgrade of the retained Pi 0.85.1 adapters. Governing contract: `.changekernel/wiki/items/system/components/referenced-intent-prototype.md`.

Do not load this directory from the development checkout. Copy/pack candidate bytes to a fresh disposable external project; use isolated HOME, Pi settings/session directories and no credentials. A source test is not release qualification or controller authority.

## Operator entry points

- `/ck-connect /absolute/config.json`: explicit startup only. Configuration is the closed `Configuration` schema in `schema.ts`: absolute executable, mode (`fresh_provision`, `resume_provision`, `reopen`), independent grant, authorization. The grant pins the fixed policy reference exported as `policyRef` in `review.ts`; no discovered/default custody. A successful connection adopts nothing.
- `/ck-authorization DISCLOSE MUTATE`: each permission is `allow`, `deny` or `unavailable`. Updates during one native exchange apply after that exchange, before final disclosure and the next exchange. These are trusted-operator commands, not model tools.
- `/ck-disconnect`: stop ingress and observe predecessor exit. Reload/session replacement/shutdown uses the same cleanup. Unconfirmed cleanup blocks a successor; no reconnect/resend is automatic.

Only seven closed domain tools are registered. Grant, lease, Prepare, Confirm and lifetime envelopes remain private. Non-TUI modes can retrieve accepted results, never approve/resume adoption. Approval uses a fresh Pi custom component, complete ASCII-encoded byte traversal, then a separate selection defaulting to Cancel. Resize cancels rather than transferring traversal coverage to a new layout. Terminals below 40 columns/12 rows (or above the bounded layout ceiling) refuse. Timeout is 120 seconds. No production approval bypass exists.

## Review interaction

The first phase is a **non-authoritative readable preview** of the same validated native prepared presentation: target/action/key, previous intent (or unopened), instruction, proposed What/Why and the fixed closed personal-plan requirements. Absent Why (`null`) and present empty text (`""`) are labeled separately. The policy explanation is not an assessment: no user-defined Checks have run or passed, and native admission still checks authority, exact approval, expected intent, custody and limits.

Source fields are quoted inert data in Pi `Text`, never Markdown or terminal instructions. Every wrapped data row has a `| ` prefix; JSON escapes expose controls/newlines/backslashes, and non-ASCII UTF-16 units appear as `\uXXXX` (including surrogate pairs). This word-wrapped preview is only a readability aid, not exact-byte evidence or a claim about transcript authorship.

Use Space/Right to advance and Left to revisit pages; Esc cancels. At the end of the preview, exact review starts at its first row with **zero traversal credit**. The unchanged authoritative byte encoding, material digest, byte length and entire prepared presentation follow. Only complete exact traversal enables the separate Pi selection: **Cancel** by default, or explicitly select **Adopt this exact subject** and confirm. The same 120-second deadline covers both phases; switching phases does not restart it. Resize, abort, close and unsupported layout still cancel. No preview content changes input, policy, presentation or receipt bytes.

## Compositions and coverage

Pi's trusted `tool_call.parentToolCallId` links every nested call to the enclosing Codemode invocation. One shared budget covers that entire script and is retired at its `tool_execution_end`; caller parameters cannot select/reset it. A standalone direct tool invocation has its own composition. Missing parent provenance refuses rather than guessing an ID prefix. Scope bookkeeping is bounded and session-local.

One composition permits at most **64 native exchanges, 8 MiB returned encoded payload, 60 seconds native/bridge time**. Prepare/Confirm/Discard count; UI dwell does not. Before dispatch the host reserves capacity for a maximum-size reply (two for a potential review continuation), so it may stop conservatively before using every last byte. Refusal does not queue work or silently allocate another composition. Keep the last returned `through`/`next_after` and explicitly continue in a new script. Never call a partial history drain complete. Startup and cleanup are separate trusted lifetime operations, not history composition calls.

## External checks

`tests/adapters/pi/referenced-intent/consumer.package.json` is the dedicated **external consumer** manifest. Copy it to a fresh external root as `package.json`, copy this source subtree and its test subtree preserving their paths, and install there with `npm install --ignore-scripts`. Do not install it in this checkout.

In that external consumer:

```sh
npm run typecheck
CK_TEST_ROOT=/absolute/fresh-btrfs-test-parent \
CK_NATIVE_TEST_BINARY=/absolute/checked/changekernel \
CK_PI_TEST_EXECUTABLE=/absolute/pi-1.2.0/pi npm test
```

Native/Pi checks skip when their explicit executable variables are absent; skipped runs are not integration evidence. `CK_TEST_ROOT` must already exist on the intended filesystem. Tests preserve disposable custody/evidence and verify child exits; do not point them at old custody. Approval input is explicitly simulated, including when production traversal code runs. The RPC lifecycle check sends only discovered operator commands, never a model prompt. Codemode budget tests use the real Pi sandbox with a simulated documented event pipeline and a framed test peer. The 60-second accounting boundary uses simulated elapsed time, not a benchmark.

Separately run the repository's retained `npm test` in an external staged full candidate with its unchanged lockfile. That narrow legacy typecheck does **not** cover this new closure. Real-human TUI smoke, diagnostic benchmarks and release qualification remain separate gates.
