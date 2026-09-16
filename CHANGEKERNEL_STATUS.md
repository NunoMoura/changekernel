# ChangeKernel source-development status

This temporary note records unfinished pre-handoff source work. Desired behavior belongs in the [native Wiki](.changekernel/wiki/); Changes and Work take over execution state after a qualified external controller is available and explicitly handed control. Git holds checkpoint history.

## Current checkpoint

- Branch: `audit/clean-baseline`. Backend connection checkpoint `4447285c3` is pushed; the current slice adds durable Check custody and retained results.
- Pi **0.85.1** supplies direct Check model calls and producer sessions. The private Check backend composes one explicitly configured loopback OpenAI-compatible route with the isolated Linux runner. Backend and credential identities are supplied by the trusted host, not verified by their digests alone. No fallback, discovered configuration, automatic retry or implicit Check adoption is enabled. See [Agent execution](.changekernel/wiki/items/system/components/agent-execution.md).
- Check custody now requires explicit one-time `initializeCheckJournal` provisioning, a stable persistent owner-private root outside Project Git, and its configured identity. Reopening missing or mismatched state fails closed. The Linux execution profile is version **2.0.0**, changing its runtime dependency identity; old runtime bindings are not silently admitted.
- Exclusive, synchronized reservations precede execution. Completed true/false results are published only after execution, provider custody and scratch cleanup settle. Known stopped failures remain non-verdicts. Partial records, conflicting bindings, uncertain custody, failed publication or full custody block execution; uncertain execution material is preserved for investigation. Disposal does not delete the journal.
- Fresh processes can deliver retained completed evaluations without another model call. Current selection, exact input/evaluator/permission bindings, result bounds and current authority are checked again. A changed surrounding selection alone does not repeat inference when those evaluation bindings remain unchanged and the new selection is authorized. Original authorization provenance and call count remain recorded; delivery reports zero new model calls. Denied delivery does not erase a completed evaluation.

## Next bounded task and remaining gaps

Build a small first-party Check Pack with meaningful positive and negative fixtures, then connect supported execution and retained results to one complete Change loop with explicit adoption and accepted Evidence. Keep tests local and simulated; no live/paid inference, lifecycle activation or controller handoff is authorized.

This is not complete recovery or release qualification. The journal holds at most 256 attempts and provides no automatic pruning, reset, retry or archival procedure. Physical crash/disk durability, privileged history rollback, operator-authorized reconciliation of unresolved work, producer containment/recovery and actual route/credential qualification remain unresolved. Unchanged stored bytes do not establish freshness of external observations. Public Change-loop integration, first-party Pack adoption and the [operational qualification boundary](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood) remain unfinished.

## Verification

- `npm test`: **583/583 passed**, including type checks and build. Log: `/tmp/changekernel-check-retention-full.log`.
- Candidate bytes were packed and installed only in a disposable external project with isolated home/Pi settings, explicit access to the required user service manager, and dummy credentials. **136/136 adapter tests passed**, including fresh-process result delivery, concurrent reservations, process exit after reservation, failed completion publication, malformed state, full custody, current-authority denial, changed inputs and existing runtime regressions.
- Candidate, dependency lock, log and digest receipt: `/tmp/changekernel-durable-check-proof-R7TCJ0/`. These are development smoke results, not exact-release qualification or controller authority. No live inference or mutable-checkout controller was used.
- Language-server probes reported no errors; some probes were unconfirmed. Source type checks and executable suites passed. Generated state, package artifacts and runtime scratch remain outside project Git.
