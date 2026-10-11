---
title: Pi and ChangeKernel Capability Matrix
aliases: []
---
# Pi and ChangeKernel capability matrix

## Decision principle

**Reuse reliable mechanisms; retain responsibility for ChangeKernel's meaning and promises.** We should not own an agent harness, database engine, model gateway or terminal framework merely because our product needs one. Nor does a gap in Pi automatically become a feature we must build: an application, operating system or another existing library may already own it.

This matrix evaluates the user's reuse-first direction. It is a research recommendation, not implementation approval, source acceptance or controller handoff. The [product boundary](../../product/changekernel.md#product-boundary) supplies the obligations; the [Pi 1.0.4 assessment](pi-runtime-1-0.md) supplies the detailed upstream findings. Execution state remains in `CHANGEKERNEL_STATUS.md`.

### Fixed integration compatibility boundary

**Pi integration preserves existing ledger/Change structures, accepted history and supported operation meanings.** The later [format-first design](../components/change-format.md) explicitly adds successor lifecycle, coordination and composition requirements. It does not retroactively widen old profiles, select a new wire schema or move lifecycle authority into Pi storage. Separate successor adoption is distinct from compatible runtime integration.

| Preserve | May improve or replace where compatible |
| --- | --- |
| Ledger and Change-file layout, canonical JSONL schemas and existing accepted history. | Runtime orchestration, tool/model access, context management and presentation. |
| Supported typed operations, versions, input/result contracts and their admission, authorization and recovery semantics. | Internal implementation and generic runtime bookkeeping that demonstrably preserve those contracts. |
| ChangeKernel's authority over accepted lifecycle records. | Pi's private transcripts, task checkpoints and runtime storage, kept distinct from that authority. |

No new operation type or format migration follows from adopting Pi facilities. Durable's SQLite/JSONL files are not replacements for the authoritative Change files, and a later export is not equivalent to authoritative acceptance. This narrows the earlier research alternatives; broader format-replacement options are outside this integration direction. Compatibility must still be checked rather than inferred from old qualifications.

### Selected format-first and Pi-user direction

The user selected owner-controlled, app-independent Ledgers and the [Change language](../components/change-format.md) as the primary design focus, followed by a narrow [JS/TS client](../components/sdk.md) of supported Rust contracts and a qualified [Pi-user integration](../components/package.md#user-distribution-and-deployment). The SDK serves software; users install the product integration. A navigator remains a useful consumer, not the primary design sequence or a separate backend. The [Wiki plan](../../product/plan.md#format-first-design-and-pi-first-delivery) owns dependencies; this matrix retains mechanism evidence and gaps rather than becoming an implementation roadmap.

[Native bindings](../components/state.md#native-bindings-not-a-separate-state-subsystem) expose application observations and permitted operations with explicit guarantees. State remains a domain concept, not another independently managed object, universal CRUD surface or runtime store alongside Ledger and Change. Codemode can compose different typed interfaces without such a universal State schema; Pi/Durable mechanics do not establish native authority or attributable outcomes.

### How to read the matrix

| Disposition | Meaning |
| --- | --- |
| **Reuse Pi** | Prefer Pi's existing mechanism over a ChangeKernel duplicate. Preserve only necessary domain integration. This is a target ownership decision, not a claim that the new release integration has passed. |
| **Adapt Durable** | A substantial replacement candidate exists, but the selected composition must close identified gaps. Do not finish equivalent custom infrastructure by default while evaluating it. |
| **Own semantics** | ChangeKernel remains accountable for the rule and its observable outcome. The implementation may still be ordinary functions, Pi documents/tasks or a native binding; ownership does not require a new framework. |
| **Delegate elsewhere** | Reuse the application, OS, Git, database, CI or another established provider. Own the narrow binding and the evidence we consume, not their whole mechanism. |

**Evidence notation:** **D** means inspected documentation/specification; **S** means relevant implementation or example bodies inspected; **T** means selected upstream test bodies inspected, **not executed**. None means runtime-qualified here. A documented absence or boundary is also evidence; an empty cell would mean unknown, not safe.

The upstream subject is **Pi 1.0.4**, commit `7c10bd4337495ee613f2224843ecdf349b80d1df`, not moving `main`. Ordinary Pi and the separate experimental Durable library are different integration surfaces. Our supporting [`package.json`](../../../../../package.json) currently pins Pi **0.85.1**; installing a later CLI did not upgrade or validate those bridges. The [1.1.0 session-format follow-up](../research.md#pi-110-session-format-follow-up) is a separate scoped inspection, not an update of this matrix's Durable/runtime findings or selection of a qualified target version. Some rows are already delegated, some have accepted primitives, and others are desired capabilities rather than shipped features.

## 1. Reuse Pi rather than build another harness

| ID / capability | Pi provision and evidence | Local mechanism to avoid or reduce | What remains ours / decisive check |
| --- | --- | --- | --- |
| **R1 — Model calls, agent loop and routing** | **Reuse Pi.** pi-ai, `ModelRuntime`, ordinary SDK sessions, virtual-model dispatch and branch-local router state. **D/S:** [SDK][sdk], [routing][routing], [existing bridge](../../../../../src/adapters/pi/session-runner.ts). | A second provider registry, streaming loop, retry engine or routing-state store. Session execution is already delegated in the bridge; count only additional duplication actually removed. | Authorized routes, disclosure, request/usage budgets and attributable responses. Check 0.85.1→1.0.4 compatibility, fallback behavior and accounting for retries, classification and compaction. Jev judgment quality is a separate question from successful dispatch. |
| **R2 — Tool composition and result reduction** | **Reuse Pi.** Codemode runs JavaScript in QuickJS, composes tools and supported non-chat models, and reduces results before returning them. **D:** [Codemode][codemode]. | A ChangeKernel scripting language, orchestration DSL or duplicate model-facing aggregation tool. | Typed domain operations, error interpretation, allowed tool surface and retained evidence. Script success is not nested-call success; script failure does not undo effects. Successful-script `store()` is not an outcome journal. |
| **R3 — Tool/resource transport and discovery** | **Reuse Pi.** Built-in MCP client, stdio/HTTP transport, discovery, exposure and OAuth support. **D/S:** [MCP][mcp], [SDK example][sdk-example]. | A bespoke Pi-only transport or a second MCP client/discovery layer. This does not supply a ChangeKernel MCP server automatically. | Domain schemas and a guarded endpoint in a qualified release. Check direct/deferred/Codemode exposure, errors and startup behavior. Schemas, OAuth and server hints are not native operation authority; a restricted `--tools` list alone does not disable MCP. |
| **R4 — Transcripts, branching and model context** | **Reuse Pi.** Ordinary sessions, branch navigation and compaction; Durable has its own persisted conversation/compaction model. **D:** [SDK][sdk], [Durable][durable]. | A parallel conversation tree, generic transcript store or bespoke compaction engine. | Keep private execution context distinct from Change Trace. Select authorized inputs and preserve evidence outside summaries. A session fork must not clone Change authority; resuming context must not adopt new intent. |
| **R5 — Human console and presentation** | **Reuse Pi.** Dialogs, status, widgets, tool renderers, terminal components and SDK/CLI integration surfaces. **D/S:** [TUI][tui], [widget example][widget], [SDK][sdk]. | A new terminal renderer, text editor, transcript browser or full standalone console before a concrete unmet requirement exists. | Thin Change/Work/Check views and explicit domain actions. Check headless operation, disclosure and honest pending/unknown states. Ordinary extensions are not drop-in Durable extensions; the prototype is not feature-complete normal Pi. |
| **R6 — Resource discovery and packaging conventions** | **Reuse Pi.** Extensions, skills, prompts, settings and packages provide reusable loading/discovery conventions. **D:** [Pi README][pi-readme], [SDK][sdk], [security][security]. | Another plugin discovery system or duplicate skill/prompt catalog. | Explicitly select authorized resources and immutable code. Project trust is not confinement. The existing bridge deliberately disables ambient discovery; reuse does not mean re-enabling it or installing this mutable checkout as a controller. |

## 2. Adapt Durable where it can retire substantive infrastructure

All six rows concern an **experimental** library. Source evidence makes them serious candidates, not automatic substitutes. These are not features gained merely by updating the normal Pi executable.

| ID / capability | Pi provision and evidence | Potential replacement | What remains ours / decisive check |
| --- | --- | --- | --- |
| **A1 — Atomic runtime state and checkpoints** | **Adapt Durable.** One commit can update typed documents, append immutable entries, create tasks and advance a task checkpoint. **D/S:** [specification][spec], [storage source][jsonl]. | Custom coordination of private runtime documents, transcripts and task phases, not the authoritative ledger acceptance protocol. | Preserve unchanged Change record/admission contracts and original S1 evidence across later S2 state. A Durable commit does not atomically append the existing Change files or include a native effect. A runtime checkpoint cannot substitute for required ledger preparation or outcome evidence. |
| **A2 — Task graph and subagent orchestration** | **Adapt Durable.** Owned tasks/conversations, waits, completion holds, foreground/background children and restartable reporter tasks. **D/S:** [Durable][durable], [subagent example][subagents]. | Generic worker queues, task registries, report-delivery loops and hand-written restart bookkeeping. | Scope assignments, select safe parallelism, verify environment identity and decide acceptance. Task ownership is not Change ownership. Show correct parent/child behavior, missing-code handling and bounded concurrency without importing the source-development worker limit as a product-runtime limit. |
| **A3 — Durable admission and message deduplication** | **Adapt Durable.** Submissions, inboxes, steer/follow-up and retained `requestId` lookup. **D/S:** [submission source][submissions]. | Custom generic durable mailboxes and delivery acknowledgments. | Keep exact-input conflict detection and original-result identity. Same-type `requestId` currently returns the earlier submission without comparing content. Demonstrate duplicate delivery, lost reply and changed-payload refusal; transport acknowledgment must not mean acceptance. |
| **A4 — Resume, cancellation and shutdown** | **Adapt Durable.** Persisted phases, pending recovery, bottom-up abort, background boundaries and close/reopen. **D/S:** [specification][spec], [tool source][tool]. | Generic resumable task runners and cooperative cancellation traversal. | Define pause versus abort versus close, authorized resume and proven cleanup. Cancelling a wait does not stop work; background tasks can outlive parent abort. Check that inspection does not dispatch, pause survives restart, and uncooperative code remains contained by a host boundary. |
| **A5 — Projections and live presentation** | **Adapt Durable.** Typed documents, historical state options, conversation views, watches and task-graph state. **D:** [Durable][durable], [specification][spec]. | Generic state projection/watch plumbing and duplicate live-task models. | Domain projections still derive from accepted Change Traces, with stable result cursors and current disclosure. Watches coalesce overflow into snapshots and are not audit feeds. Demonstrate that a slow consumer or fork cannot lose required facts or gain authority. |
| **A6 — Runtime storage and reopening** | **Adapt Durable.** SQLite and JSONL backends, recovery and conformance facilities. **D/S/T:** [SQLite][sqlite], [JSONL][jsonl], [flush-order tests][jsonl-tests]. | Private agent/task storage and its recovery machinery, not existing ledger/Change formats or acceptance controls. | Select an explicit runtime process/host-failure claim and single-writer owner. SQLite `NORMAL` can lose recent commits on host failure; JSONL `fsync: true` does not flush every ordinary main marker after append; storage itself provides no cross-process ownership lock. Runtime tail repair must not become permission to repair authoritative Change history. Verify custody loss, corruption and non-executing inspection; prefer an existing suitable runtime backend over a new one. |

## 3. Own ChangeKernel semantics, not necessarily their machinery

“Specifically ours” means product accountability, not that authorization, checks or receipts are novel inventions. Pi can execute or store these rules without defining their meaning for us.

| ID / responsibility | What Pi can contribute | What ChangeKernel must continue to define and ensure | Evidence / mismatch |
| --- | --- | --- | --- |
| **O1 — Intent and adoption** | Conversations, structured input, documents and presentation. | Which intent was proposed and explicitly adopted, by whom, within which scope; preserve questions and partial intent without silently inventing approval. | [Product](../../product/changekernel.md#intent-capture-and-refinement); **D:** a message, queue admission or model answer is not domain adoption. |
| **O2 — Change/Work identity and typed progression** | Entries, documents, tasks, IDs and serialized commits. | Exact subject/revision and operation identity; legal typed progression, immutable accepted facts, conflict rejection and dependencies. Meaningful identity survives retries and is not merely a session/task name. | [Product](../../product/changekernel.md#typed-requests-operations-and-records); **D/S:** [admission][submissions] and generic task states do not supply these domain predicates. |
| **O3 — Checks and policy evaluation** | Model/evaluator execution, tool calls and result storage. | Versioned criteria, authorized inputs, evaluator identity, applicable observations and honest uncertainty. Check execution remains non-publishing; a typed model output is not truth or permission. | [Checks](../components/checks.md); **D:** [TypeSafe Choice][choice] and [confidence][confidence] describe judgments, not authority. Use existing evaluators where suitable rather than inventing a general rule language. |
| **O4 — Delegated authority and disclosure** | Call metadata, tool hooks, configurable surfaces and host integration. | Intersect delegated scope with native rights; enforce current authority at execution, reconciliation and disclosure, including retries and cached results. | [Agent execution](../components/agent-execution.md), [State](../components/state.md); **D/S:** replay skips `beforeTool`, registry selections are mutable and trusted code can read documents. A hook is not a mandatory security boundary. |
| **O5 — Attributable effects and uncertainty** | Persist intent/checkpoint/outcome around an effect and orchestrate recovery. | Link an attempt to the native operation and its attributable receipt; distinguish known application, unresolved outcome, nonfinal absence and final absent closure. Reconciliation must not invoke the effect again. | [Guarded effect](../components/guarded-effect-fixture.md); **D/S:** the [effect sandwich][spec] leaves a crash interval outside the journal transaction. Replay-safe declarations or desired-value equality are not outcome proof. |
| **O6 — Completion and accountable review** | Task terminal states, submission receipts and progress views. | Define what completes a Change, which Checks and permissions apply, who accepts evidence, and what remains incomplete. A completed worker/task is evidence, not a verdict. | [Product](../../product/changekernel.md#completion-and-other-conclusions); **S:** [existing receipt validation](../../../../../src/adapters/pi/agent-runtime.ts) already distinguishes terminal status from authorized completion and custody closure. |
| **O7 — Exclusive continuation and controller authority** | Process/package/session identifiers and persistent configuration. | Bind the permitted continuation to its exact subject and owner; keep qualification, activation and explicit controller handoff distinct. A restart, fork or extension reload cannot silently take authority. | [Continuity](../components/ledger-continuity.md), [package policy](../components/package.md); **D/S:** registry names and the prototype's directory lock are not immutable controller/custody evidence. Reuse locking/identity primitives rather than inventing an OS. |

## 4. Delegate what belongs neither to Pi nor to our domain kernel

| ID / capability | Proper owner | Narrow ChangeKernel responsibility | Evaluation boundary |
| --- | --- | --- | --- |
| **E1 — Business State and transactions** | The application and its native DB/service/filesystem. | Bind exact observations, permitted operations, guards and receipts at the boundary enforcing application rules; retain enough history to explain governed changes. | No separate managed State primitive or universal persistence API is needed. Pi documents do not become an application mirror. Native COMMIT and Change journal acceptance remain separate unless the actual composition establishes otherwise. [Native bindings](../components/state.md#native-bindings-not-a-separate-state-subsystem). |
| **E2 — Identity, isolation and resource enforcement** | Native IAM, OS/container/VM, secret store and execution host. | Constrain delegated access, select a qualified boundary and report its actual guarantees. | Pi runs with its host permissions; `cwd`, project trust, hooks and usage totals are not confinement or hard aggregate limits. Do not create a replacement IAM or sandbox. [Pi security][security], [agent execution](../components/agent-execution.md). |
| **E3 — Source history, code intelligence and tests** | Git, compiler/test tools, language servers and established extensions such as pi-lens. | Select the exact reviewed subject, retain consequential evidence and make the domain verdict. | Pi-lens is an extension, not Pi core or an automatic Durable facility. Reuse the tools; do not infer acceptance from a successful command, idle process or empty diagnostic cache. [Package testing policy](../components/package.md#testing-policy). |
| **E4 — Artifact production and distribution** | Existing build, package and CI mechanisms; Pi packaging where appropriate. | Identify the exact released closure and apply qualification/activation/handoff policy. | An available package, successful update or installation is not qualified controller authority. Do not build another package manager. [Package policy](../components/package.md). |

## How to decide that a replacement is reliable enough

Use the required observable contract, not a feature-name match or a weighted popularity score:

1. **Match the promise.** Identify the row's actual consumer, threat/failure scope and non-negotiable semantic conditions. Ledger/Change formats and supported operation contracts are fixed for this integration; internal techniques can change only while preserving their promises. A format, operation or supported-guarantee change requires separate explicit authorization, not an inference from reuse-first intent. Do not demand a power-loss proof for a widget or accept a process-restart example as proof of host-failure durability.
2. **Close the consequential gap on the selected composition.** Use pinned source/docs, relevant existing tests and only the missing boundary evidence. For an authorized trial, record exact versions, backend/options and actual outcomes; include failures such as lost replies, changed payload, revoked access or interrupted effects where that row depends on them. Read tests are not executed tests, and executed dependency tests alone are not integration qualification.
3. **Show net removal of responsibility.** Identify the local mechanism retired or avoided, the thin binding retained, and new upgrade/operations costs. Reject a design that keeps two schedulers for the same work or two authorities for the same lifecycle merely to wrap the old system in the new one. Do not claim savings from code we never had or from deleting a necessary guard.

A missing reliability result leaves a row **unproven**, not automatically rejected. A confirmed mismatch blocks that use, not every use of Pi. Prefer configuration or a small binding; consider a custom mechanism only for a concrete remaining obligation.

No new runtime comparison was executed for this matrix. Routine source acceptance, exact-subject runtime qualification and controller handoff remain separate. Any later experiment needs its own approved scope; use isolated external projects and deterministic tasks or an explicitly fake provider unless live inference is separately authorized.

## Where this changes our evaluation

| Current or contemplated area | Reuse-first implication |
| --- | --- |
| Change format, SDK and Pi-user integration | Design lifecycle/composition semantics from worked streams first; then expose supported Rust operations through a shared model-free client and qualified Pi tools/Views. Do not create another engine, navigator backend or scripting language. Successor schemas, SDK transport and end-user support remain unimplemented/unqualified. |
| `src/adapters/pi/` | Already bridges to Pi. Audit for necessary exact authorization, usage, context and cleanup semantics before reducing it; do not replace the bridge with ambient SDK defaults. Version migration is still unproven. |
| `src/adapters/jsonl/{opening,intent_trace,ledger}` | Preserve on-disk layouts, schemas and operation contracts. Reuse/refactor implementation machinery only where it demonstrably preserves authoritative append/recovery semantics; do not swap Change storage for Durable DB/JSONL files. A1/A6 primarily concern private runtime state. |
| Native application/permission/effect bindings and SQLite fixture | Keep the observable authorization, effect-attribution and uncertainty requirements. Their tests remain useful comparisons even if a substrate changes. Keep only the adapters needed for the selected supported application profile. |
| Proposed console, agent coordination and context machinery | Start with R1–R6 and A2–A5; do not commission another harness or console first. Normal Pi and Durable integration costs must be counted separately. |
| Future monitoring, learning or automatic binding generation | Defer a generic platform until a concrete application need demonstrates a gap. Reuse existing schedulers, semantic primitives and tools; avoid speculative frameworks. |

The division remains **Pi for execution/interaction, native applications for State and enforcement, and ChangeKernel for accountable Change semantics and accepted history**. Format-first successor design and initial Pi-user delivery are now explicit product decisions; this research neither freezes their protocols nor qualifies them. Durable remains an optional candidate for a demonstrated runtime need, not replacement lifecycle storage or a required rewrite. No migration follows from updating Pi.

[pi-readme]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/README.md
[sdk]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/sdk.md
[routing]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/virtual-models.md
[codemode]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/codemode.md
[mcp]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/mcp.md
[sdk-example]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/examples/sdk/14-codemode-mcp.ts
[tui]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/tui.md
[widget]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/examples/extensions/widget-placement.ts
[security]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/coding-agent/docs/security.md
[durable]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/README.md
[spec]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/docs/spec.md
[subagents]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/examples/23-subagent-background.ts
[submissions]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/harness/submissions.ts
[tool]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/harness/tool.ts
[sqlite]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/storage/sqlite/node.ts
[jsonl]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/src/storage/jsonl/storage.ts
[jsonl-tests]: https://github.com/earendil-works/pi/blob/7c10bd4337495ee613f2224843ecdf349b80d1df/packages/durable/test/jsonl-storage.test.ts
[choice]: https://docs.typesafe.ai/primitives/choice
[confidence]: https://docs.typesafe.ai/confidence
