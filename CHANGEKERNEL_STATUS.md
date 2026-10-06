# ChangeKernel temporary status

## Accepted baseline

- Integration branch: `integration/rust-kickoff-01`. R30 executable: `3aeabda651fb7f44fe86394aa82be30a18f07164`; bounded source verdict: `e4c7711805e15d15ca6a2acffc20d0bc132e247a:CHANGEKERNEL_STATUS.md`.
- R31 diagnosis and metadata-only integration cache repair are complete at `f0b646af808e9f4115ec01941256c22909278515:CHANGEKERNEL_STATUS.md`. That checkpoint retains the actual checks, first failures, evidence roots, unresolved cache-creation cause and diagnostic-readiness limits. Product source/configuration bytes did not change. Do not redispatch R31 or repeat the repair.
- Four existing worker slots remain parked; no new assignment is released. Their accepted reports are R30-S `88b93fe6a8d454673707f63daf272ede34f49f04`, R30-L `741c65b2d4f8a020dffba4342263d990d4a9243e`, R30-F `82ae16fbf28c13b8a7ce37ef89d536bf9c357b4e`, and R31-D `d7e6a40e3e356b3ae71799709cdd62d34bea7f57`. Reverify live identities before any reuse or notification.

## Next gate — proposed real-request, no-application-effects trial

**Proposal only.** The user has authorized proceeding with preparation, not trial execution. The actual task, adopted text, success criterion and storage scope still need selection and approval. This consumes the [selected ledger-history profile](.changekernel/wiki/items/system/components/ledger-history.md#consumer-authority-and-separation) without changing its contract or claiming [Phase 1](.changekernel/wiki/items/product/plan.md#phase-1--a-durable-inspectable-change-without-effects) complete.

**Proposed user outcome:** after recording and refining one real development request, a fresh reader can recover what was originally requested, what the owner actually adopted, which assessments apply, and what remains unverified, without relying on this Pi conversation.

### Proposed path and expected evidence

1. Obtain the user's actual task and optional Why. Freeze original and explicitly adopted revised What/Why, the exact requests and expected byte-count results before execution. A proposed interpretation is not adoption. Do not pad text, silently change the goal or choose wording merely to manufacture a false/true pair.
2. Use the accepted source archive as an ordinary library in one disposable external consumer with isolated empty Pi settings, pinned dependencies and an external Cargo target. Provision one fresh ledger under the trusted Linux fixture with explicit owner adoption of its fixed policy; never use an existing project ledger or install a controller.
3. Create one Change, run the fixed Check on its exact original intent, directly adopt the approved revision, and run the Check on that exact revision. Retain every actual result, including any false result; preserve the original Change and intent identities.
4. Close the owning process, confirm exit, and reopen from a fresh consumer. Inspect both current and historical context plus bounded history pages. An independent reader must explain the original request, revision, attribution, exact assessment subjects and applicability, coverage and unsupported claims using only authorized returned material.
5. Retry the exact original creation and Check requests: require their original results with no new accepted operation. Challenge a new mutation using the stale original predecessor and a History-denied read: require conflict and denied respectively, no private disclosure or lifecycle mutation. Compare accepted counts/digests and storage byte/name snapshots around the reads, refusals and accepted retries.

The existing Check measures only whether exact adopted **What is at most 80 raw UTF-8 bytes**, as defined by [notice-fit](.changekernel/wiki/items/system/components/assessment-trace.md#one-question-not-a-semantic-intent-judge). It does not assess software correctness, goal quality, startup behavior or actual notice delivery. The trial does not implement the chosen development task or inspect/change its application files. Extending assessment to application correctness requires a separate consumed contract and source assignment, not an improvised evaluator.

### Scope, recovery and decision gate

- Proposed writes are limited to the named disposable consumer/build area and its fresh ledger plus independently located custody anchor. Exact absolute paths, process/time limits and read inputs must be frozen before execution. No source worktree, existing user ledger, credential, package installation, network/model call or application mutation is included.
- Preserve the immutable subject, inputs, requests/results, exits, snapshots and first failures externally. Reads never repair custody. On unexpected refusal, damage, timeout or uncertain acceptance, stop; retain evidence without deleting incidents, guessing controls or retrying until green. Preserve the original physical ledger for any authorized exact retry rather than copying it into new custody.
- Close owned processes/descriptors before cleanup. Retain trial evidence and ledger until review; deletion needs its named scope approved in advance or a later explicit cleanup decision.
- The manager independently reviews the result and records `accepted`, `changes requested` or `blocked`. A useful result supports only this declared lifecycle/read trial; [release qualification](.changekernel/wiki/items/system/components/package.md#qualification), activation, effects and controller handoff remain separate.

**Needed from the user:** select the real task and original expression, approve the revision/adopted fixture policy, agree on the fresh-reader success criterion, and authorize the exact disposable storage/build scope. No worker dispatch or execution precedes that scope.

Jev's twelve-request budget remains exhausted. No credential access or further inference is authorized. Use native source-development tools under [AGENTS.md](AGENTS.md); never load the mutable checkout as its controller.
