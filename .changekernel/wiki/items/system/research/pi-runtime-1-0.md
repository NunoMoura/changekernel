---
title: Pi 1.0.4 Runtime Reassessment
aliases: []
---
# Pi 1.0.4 runtime reassessment

## Status and evidence boundary

**This is research, not an adopted architecture, runtime qualification, migration instruction or permission to resume implementation.** The user paused R38 to reassess Pi's Codemode, MCP, model routing and Durable capabilities. Execution state and the preserved worker checkpoint belong in `CHANGEKERNEL_STATUS.md` and Git, not this report.

The installed `pi --version` reports **1.0.4**. Upstream tag `v1.0.4` resolves to commit **`7c10bd4337495ee613f2224843ecdf349b80d1df`**. The npm metadata for `@earendil-works/pi-durable@1.0.4` reports the same `gitHead`, an MIT license and Node `>=22.19.0`. This review inspected the installed Pi documentation, the complete pinned Durable specification and its linked design/Chord guides, relevant implementation bodies, examples and selected upstream test bodies. Public text captures and hashes are preserved outside Git. No downloaded code, upstream test, demo, model request, MCP server, package installation or crash experiment was executed. Source correspondence to metadata is not a build, package-signature or installed-binary qualification claim. [Release][release] [Durable package][npm]

The release subject matters: the inspected `main` README additionally advertises a Cloudflare Durable Object backend that the 1.0.4 README and package exports do not contain. That later capability is not included in this assessment's released-feature claims.

## Executive conclusion

**The pause is justified. Pi now supplies enough execution infrastructure that ChangeKernel should reassess what it needs to implement, not merely add another adapter after finishing the current plan.** Durable is the strategically important part: it has an actual transactional state/task substrate, not just a saved conversation.

There are two credible reuse boundaries:

1. Keep the Rust engine and its authoritative Change JSONL; use Pi/Durable for optional orchestration, model/session mechanics and delivery.
2. Build more of the engine over Durable's Session/Task/storage substrate while retaining ChangeKernel's domain rules and native bindings.

The second option deserves a real comparison. It could eliminate more custom persistence and recovery machinery, including mechanisms resembling the current preparation-reservation work. It also changes current Rust distribution and Trace-representation choices and cannot inherit the existing profiles' guarantees by declaration. Neither option makes a task completion, tool result, model judgment or transcript into accepted Change authority automatically.

This is consistent with the [product boundary](../../product/changekernel.md#product-boundary): ChangeKernel is not a harness or database engine, and replaceable mechanisms should be reused when the consumed guarantees fit. Existing implementation cost is not a reason to exclude the deeper option; an attractive upstream abstraction is not evidence that its defaults satisfy our contracts.

## What is actually available

| Capability | Inspected 1.0.4 surface | Consequence for ChangeKernel |
| --- | --- | --- |
| Codemode | Built-in tool running JavaScript in QuickJS, calling registered tools and non-chat models, with output reduction and small branch-persisted state. | A reusable programmable tool-composition layer; no need to invent a similar language merely for retrieval, aggregation or bounded semantic operations. |
| MCP | Built-in stdio/streamable-HTTP client, resources, OAuth, tool exposure/discovery, extension registration and normal tool-pipeline hooks. | A standard transport/discovery option for qualified typed operations and evidence readers. It does not establish their native authority or outcome semantics. |
| Virtual models | A selected virtual model routes each request to a physical model/thinking level; branch-local router state survives compaction. Custom provider registration remains a separate API. | Reuse model selection, provenance and provider mechanics rather than embedding a mandatory model router in the engine. |
| Durable | Separately published experimental library with atomic commits, persisted task phases, submissions/inboxes, ownership, cancellation, compaction, observations and storage backends. | A serious candidate for execution and possibly engine infrastructure, not just an agent convenience. |

Sources: [Codemode][codemode], [MCP][mcp], [virtual models][virtual], [Durable README][durable]. The ordinary coding-agent package does **not** depend on `pi-durable`. Updating normal Pi does not convert its current sessions into Durable sessions.

## Codemode: useful composition, not a transaction

Codemode's QuickJS VM has no direct Node, filesystem, network or timer APIs. External activity goes through tools and the model gateway. The VM has a 256 MB memory limit; a whole-script deadline is optional and unset by default. These are VM properties, not aggregate bounds or isolation guarantees for the tools it invokes. [Codemode][codemode]

The valuable change is that a script can retrieve, parallelize, join and reduce data before returning it to the language model. Deferred declarations and tool discovery can reduce schema/context overhead. This could simplify bounded history retrieval, evidence assembly and classifier-driven discovery without feeding every intermediate result into the conversation. Benefit and cost still need measurement on our workloads.

The failure boundaries remain important:

- Effects completed before script failure are **not rolled back**. Cancelling pending calls does not establish that remote/native effects did not occur.
- `store()` values persist only after a successful script. A failed script can therefore leave real effects without its intended saved script state. This store is not an authoritative attempt/outcome journal.
- MCP `CallToolResult.isError` can resolve rather than reject inside scripts. `bash` structured results include nonzero exit codes; classifier/image calls report `stopReason`. `Script completed` is not proof that every nested operation succeeded.
- The gateway runs classifier and image models, not chat models directly. Codemode is not itself a durable recursive-agent scheduler.
- Output reduction is a presentation choice. Required evidence must remain retained and attributable outside the generated summary.

Use it as a producer/client of guarded operations, not as the guard. A read-only Check must not inherit a producer's mutating tools simply because both can be called from the same VM.

## MCP: replace transport plumbing, preserve semantic boundaries

Pi supports stdio and streamable HTTP, not legacy SSE. Tools can be direct, deferred, codemode-accessible or hidden. Nested Codemode calls traverse Pi's tool pipeline and carry `parentToolCallId`, which is useful for provenance and permission integrations. The documentation explicitly declines automatic tool-call retries because an effect may already have happened; resource reads have separate retry behavior. [MCP][mcp]

This makes MCP a plausible exposure boundary for a future qualified immutable ChangeKernel release. It could avoid a bespoke Pi-only adapter for typed queries and operations. A tool schema, OAuth token or `idempotentHint` is not, by itself, our operation identity, current delegated scope, native authorization proof, immutable receipt or reconciliation contract. Broad filesystem/shell/database tools must not bypass the promised guarded publication route.

Two operational details matter:

- `pi mcp list` connects to enabled servers; it is not a passive configuration inspection. Enabled servers also connect at session startup. This review did not run it or add servers.
- In 1.0.4, `--tools` does not remove MCP tools unless an entry starts with `mcp__`; `--no-mcp` disables built-in MCP for one run. A restricted-looking ordinary tool list is not sufficient evidence of a closed tool surface.

The standard SDK does not load built-in extensions automatically. Its [MCP/Codemode example][sdk-example] explicitly adds the extension factories. A Durable host uses a different extension/tool API, so this example is not a drop-in Durable integration.

## Model routing and Jev

Virtual routing cleanly separates **selection** from **dispatch**. Pi retains the selected virtual model and records the physical provider/model/thinking level on each response. Router state is persisted before the request, follows the branch and survives compaction. Routes can distinguish new user input, continuation, retry and direct requests such as compaction. Physical context limits are checked before dispatch. [Virtual models][virtual]

Pi's [Jev router example][jev-router] already demonstrates the general idea we discussed: classify demand, use a stronger planning model, then switch to a cheaper implementation model. It is an example, not an established policy for this project. It switches after the first successful tool result named `edit` or `write`; a status-file or documentation edit qualifies. Its threshold and one-way phase transition have not been evaluated for our recovery/authorization work. A classifier call adds disclosure, latency and cost; changing models can lose prompt-cache reuse.

The installed global TypeSafe skill and current [Choice guidance][choice] and [routing/cascade examples][intent-routing] [cascade] were consulted. Typed answers and distribution confidence are judgments, not execution authority. Benchmark classification mistakes, fallback behavior, total cost and quality together. Pi's classifier wrapper is a new adapter surface, not automatic compatibility with our frozen provider request/receipt contracts. No new inference or routing configuration was authorized or performed.

## Durable: the material architectural change

Durable supplies a Session containing immutable entries, typed JSON documents, task records and submissions. A single serialized commit can update documents, append entries, create children and advance the executing task's checkpoint together. Publication follows storage settlement. The guarantee is relative to that backend's failure model, not universally to power loss. [Specification §§3–5][spec]

Its useful mechanisms include:

- Durable phases with saved input/checkpoints and terminal receipts; surviving running tasks are reconciled for resumption.
- Durable request-ID admission, inboxes, steer/follow-up behavior and awaitable submission outcomes.
- Owned tasks and conversations, `waiting`, `allSettled`/`failFast`, and a `completing` hold until ordinary owned work drains.
- Bottom-up abort, explicit background boundaries, and close/reopen distinct from cancellation.
- Per-conversation model/tool/extension/cwd selection and execution environments built at use time.
- Atomic entry/document state, lazy migration, historical conversation documents and explicit fork policies.
- Committed progress/views, compaction that retains raw history, and task-graph inspection.

These are concrete matches for our manual worker delivery, restart, queue, ownership and context-maintenance concerns. The [background-subagent example][background-example] includes persistent reporter tasks and request-ID-based delivery in both directions. It still needs application rules for assignment identity, changed-payload conflicts, resource bounds, worktree isolation and manager acceptance. Its generic stop and report behavior is not a complete implementation of our pause policy.

Durable is also usable below a chat-agent workflow: deterministic task/document operations do not require a live model call. A possible Durable-backed engine should be evaluated as a library composition, not rejected merely because a prototype UI is a coding agent.

### Why the recent preparation blocker is relevant

The R38 blocker concerned losing historical S1 observation while only input+actor survived in pending control. Durable explicitly supports retaining derived values in task input, checkpoints or memos, and atomically advancing those with entries/documents. This is the class of mechanism we were implementing ourselves.

A Durable composition could retain the observation and its interpretation in one atomic state transition rather than invent another application-level partial-append protocol. But it must actually capture S1; replay cannot reconstruct it from today's S2. It also does not make the later native effect atomic with the journal:

```text
commit admitted intent and stable evidence
perform the native operation
commit its attributable outcome
```

A crash between the last two steps still requires the binding's native receipt or explicit uncertainty. This is Durable's own **effect sandwich**, not a gap hidden by its name. [Specification §5.2][spec]

## Guarantees we must not infer

| Inspected behavior | Implication |
| --- | --- |
| A tool reruns only when its stored intent policy and current declaration both say `safe`; unsafe defaults produce an interrupted result. | This is a replay decision, not proof of idempotency or exactly-once external effects. A later model-generated new call is another decision that still needs domain admission. |
| Recovery uses stored arguments without rerunning `beforeTool`. | Revocable authority and exact-subject checks must execute inside the actual effect/reconciliation boundary. A pre-call hook alone cannot protect recovery. |
| Tools/extensions resolve by name against current registry state; execution environment is rebuilt from current conversation configuration. | Names, replay flags and schema versions do not pin immutable controller bytes, worktree identity or native custody. Reload/restart requires an explicit supported-subject policy. |
| Trusted Session code can access documents by token/ID, and guard extensions can be omitted from a selection. | This is not a mandatory authorization system or hostile-extension security boundary. |
| Existing same-type `requestId` returns the earlier submission without comparing new content. | Durable delivery deduplication is weaker than ChangeKernel's same-key/exact-input conflict rule. Preserve the domain rule separately. |
| Watches/events coalesce overflow into a current snapshot after 100 pending frames. | They are convergent presentation streams, not a complete audit log. Persist consequential facts as entries and scan retained history. |
| Cancelling a wait does not cancel work; ordinary abort skips background subtrees; close preserves resumable work. | Define pause, cancel, shutdown and authorized resume separately. Idle or a returned cancellation request is not accepted completion or rollback. |
| The environment is trusted, not confinement; built-in file-edit serialization does not lock out bash or other processes. | Separate processes/qualified sandboxes and native concurrency guards remain needed where the selected profile promises them. |

Conversation ownership and fork lineage are also not Change ownership, adopted intent or exclusive continuation authority. Raw task receipts, stored tool output and watches do not supply ChangeKernel's current-disclosure checks; a governed client still needs the appropriate authorized result boundary.

These are documented contracts, not allegations of upstream defects. The replay and deduplication observations were also checked in [tool execution][tool-source] and [submission admission][submission-source]. The selected upstream [tool tests][tool-tests] cover implementation retention across reload and durable-versus-buffered output; they were read, not run.

### Storage durability is narrower than the name suggests

The supplied Node SQLite adapter selects WAL and `synchronous = NORMAL`. The README promises ordinary process-crash survival but permits loss of recent commits on host/power failure. Its storage layer assumes one owner; the library supplies no cross-process ownership lock. The experimental TUI separately uses a directory lock, which is not an immutable native-object custody mechanism. [SQLite source][sqlite-source] [TUI session source][tui-sessions]

The JSONL backend is **not** our per-Change Trace format. It has `main.jsonl` commit markers plus document/task sidecars, its own decoding and reclamation rules, and recovery that removes torn lines and unconfirmed tails. Its `fsync` option defaults to false. Importantly, **even `fsync: true` flushes affected sidecars before ordinary marker append, not the main marker after every accepted commit**. Main-file flushing authorizes later destructive reclamation; it is not a general acknowledge-after-marker-fsync contract. This is explicit in the specification and implementation and is asserted by the [flush-order test][jsonl-tests]. [JSONL source][jsonl-source]

Consequently, neither backend is an automatic substitution for the frozen acceptance/custody/barrier contract. A new profile could deliberately choose different supported guarantees, or qualify a suitable storage composition. It must not quietly inherit the old claim or build a new custom backend before showing why an existing one is insufficient.

The previous [Pi 0.87.1 SessionManager comparison](../research.md#pi-jsonl-sessions-as-a-trace-design-reference) cannot be applied wholesale to Durable. Durable directly addresses several earlier concerns with commit-before-publication, atomic state changes and durable admission. It is genuinely different code, not the old session file with a stronger marketing label.

### Examples are evidence of API shape, not our qualification

The inspected recovery example stores a `printed` memo before `console.log`. That can prevent a duplicate print after recovery, but a death between the memo and the print can omit the print. It illustrates why marking an effect in advance is not an actual effect receipt. The child-payment example uses an in-memory fake bank and closes/reopens the Harness within one process; it is not proof of an external native resource surviving whole-process loss. [Recovery example][recovery-example] [Child-task example][child-example]

Our useful native fixture, permission/revocation cases and honest uncertain-outcome tests therefore remain valuable even if the surrounding implementation changes.

## Integration maturity and costs

The library explicitly says its API may change without notice between releases. Its prototype coding-agent UI is source-launched and lists missing ordinary Pi features, including normal extensions, prompt templates, images and the session picker. Normal Pi extensions such as pi-lens are not automatically compatible with Durable's `defineExtension` API. Shared pi-ai/model-runtime components are useful integration points, not evidence that Codemode, MCP, virtual routers and Durable already form one fully integrated product. [Prototype README][prototype] [Prototype runtime][prototype-runtime]

A proposed host must own single-writer exclusion, environment identity, controlled extension loading, external process cleanup and lifecycle shutdown. Close joins cooperative invocations; arbitrary JavaScript that ignores cancellation needs process isolation for forced termination. Dependencies and migrations would need an exact supported closure; the package's semver dependency ranges are not an immutable release qualification.

No end-to-end cost, performance, compatibility, confidentiality, reboot durability or migration benefit was measured in this inspection.

## The architectural choice

| Option | What we reuse or retire | What stays ours | Main cost or unresolved question |
| --- | --- | --- | --- |
| **A. Optional Durable host around the Rust/JSONL engine** | Session mechanics, queues, subagent coordination, model calls, context management and delivery can move to upstream facilities. | Authoritative Change acceptance, exact-input identity, policy/Checks, native bindings, outcome reconciliation and existing formats. | Less disruption, but most current engine persistence machinery remains. Keep runtime state distinct from Change authority rather than dual-writing lifecycle decisions. |
| **B. ChangeKernel domain layer on a Durable substrate** | More atomic persistence, task transitions, projections and recovery machinery could be reused instead of maintained as custom engine infrastructure. | User intent/adoption, typed domain progression, native authorization/guards, attributable receipts, uncertainty, exact version/subject binding and release/controller authority. | Requires reopening Rust-only distribution and canonical physical Trace choices, supported storage guarantees, API churn and migration. Generic task receipts are not enough. |

**Recommendation:** compare both boundaries before resuming R38. Do not automatically finish the old custom protocol first, and do not assume a wholesale TypeScript/Durable rewrite is already justified. Retain the existing source as a control and extract its proven domain obligations from its current implementation choices.

If Rust and the current per-Change authoritative JSONL representation remain non-negotiable product requirements, A is the straightforward fit. If they are replaceable mechanisms, B deserves an equal evaluation. That is a user-owned product decision; this report does not make it implicitly.

## Questions that require evidence beyond this inspection

A later, explicitly authorized disposable comparison should answer only the consequential unknowns:

- Can the selected composition retain an exact preparation and original-result identity across restart and changed native state, without repeating an effect or treating changed input as the original request?
- After a real native commit but before outcome retention, can it reconcile truthfully under current rights, including revocation, missing receipts and loss of custody?
- Can pending tasks resume only under the authorized code, environment and delegation, including after registry/cwd changes and a user pause?
- Does its actual storage configuration and ownership protocol meet the chosen process/host-failure claim, and does a read-only inspection remain non-executing?
- Does it remove enough code and operational burden while keeping the public engine useful without model calls or a mandatory interactive Pi session?

That comparison must not rely on the examples' credential-sensitive choice of a real provider. Use an explicitly selected fake provider or deterministic tasks and isolated settings if such a trial is approved. No live inference, controller handoff, repository dogfood, storage migration or installation follows from this report. The user pause remains active.

[release]: https://pi.dev/changelog/releases/1.0.4
[npm]: https://registry.npmjs.org/@earendil-works/pi-durable/1.0.4
[codemode]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/codemode.md
[mcp]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/mcp.md
[virtual]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/virtual-models.md
[sdk-example]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/examples/sdk/14-codemode-mcp.ts
[jev-router]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/examples/extensions/jev-router.ts
[choice]: https://docs.typesafe.ai/primitives/choice
[intent-routing]: https://docs.typesafe.ai/patterns/intent-routing
[cascade]: https://docs.typesafe.ai/cookbooks/sde_cascade
[durable]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/README.md
[spec]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/docs/spec.md
[tool-source]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/harness/tool.ts
[submission-source]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/harness/submissions.ts
[sqlite-source]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/storage/sqlite/node.ts
[jsonl-source]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/storage/jsonl/storage.ts
[tool-tests]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/harness-tools.test.ts
[jsonl-tests]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/jsonl-storage.test.ts
[background-example]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/examples/23-subagent-background.ts
[recovery-example]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/examples/13-recovery.ts
[child-example]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/examples/24-child-tasks.ts
[prototype]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/src/experimental/durable/README.md
[prototype-runtime]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/src/experimental/durable/runtime.ts
[tui-sessions]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/src/experimental/durable/sessions.ts
