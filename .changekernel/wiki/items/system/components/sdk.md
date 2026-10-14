---
title: Composable SDK and Integration Boundary
aliases: []
source-id: cw:component:sdk
---
# Composable SDK and Integration Boundary

## Selected direction and compatibility

The adopted direction is **one semantic integration contract, JavaScript/Python-friendly code-use surfaces and thin harness-specific bridges**, downstream of the [Change-format and lifecycle design](change-format.md). Start with Pi, then investigate Codex, Claude Code and DeepSeek Harness. SDKs can supply reusable client helpers, but an installable package, CLI or common language is not the universal execution boundary. The contract serves harness tools, Ledger/Change interfaces, deterministic automation and optional application integrations. It is not the end-user distribution: the initial audience installs a [qualified Pi integration](package.md#user-distribution-and-deployment), not an SDK. A read-only navigator remains useful without becoming a separate backend or the primary design sequence. The [Wiki plan](../../product/plan.md#format-first-design-and-pi-first-delivery) owns dependencies; the [temporary status note](../../../../../CHANGEKERNEL_STATUS.md) owns implementation permission.

This is adopted design direction, not frozen signatures, a selected transport, implemented language clients, universal harness compatibility or a qualified release. Select the native profile, host lifetime, operation mappings and concrete client signatures with the first consuming slice. A contract or preserved implementation checkpoint alone does not establish accepted executable support.

Preserve ledger/folder and Change-file structures, canonical JSONL schemas, accepted history, supported operation versions and their complete input/result, admission, authorization, retry, recovery, ownership, limits and accounting contracts. Clients and adapters must not silently widen a profile or translate one profile into another. Existing operations remain the semantic units; client convenience does not introduce new accepted operation types. Format migration, new native operations and changed guarantees require separate adoption.

The successor-format design may require explicitly adopted new semantics; clients cannot invent or silently map them onto older profiles. No new physical layout or migration is selected here. Rebuildable indexes/caches need a measured consumer and correct source/version/disclosure boundaries; acceptance controls and original creation/retry associations are not disposable caches. Independent reading of the published format should remain possible without a proprietary SDK decoder.

## Harness targets and code-use bindings

The common contract includes authorized bounded queries, exact reference resolution and typed operation requests, not only an API over Views. Language surfaces should make these contracts discoverable and composable with ordinary JavaScript or Python. They may be injected or registered functions rather than npm/pip imports. An API does not imply HTTP or a daemon; a CLI may be a structured bridge where the consuming environment supports it, without becoming a required subprocess capability in every sandbox. All bridges preserve the same authority, identity, result and recovery meanings.

| Environment | Approved place in the sequence | Binding question and evidence limit |
| --- | --- | --- |
| Pi | First concrete consuming design and initial delivery target. | QuickJS Codemode calls exposed host tools; an ordinary host adapter supplies engine access. Installing an npm package does not make it importable by generated QuickJS. The exact supported runtime/profile still needs selection and qualification. |
| Codex | Follow-on compatibility investigation. | Inspect the actual target version's execution and tool interfaces; no JavaScript environment or specific bridge is assumed supported. |
| Claude Code | Follow-on compatibility investigation. | Inspect Claude Code itself. Claude API programmatic tool calling is a different environment, not evidence that Claude Code supplies the same Python surface. |
| [DeepSeek Harness (`dsh`)](https://github.com/deepseek-ai/deepseek-harness) | Follow-on compatibility investigation, explicitly added by the user. | Inspect this harness's actual code-use and plugin boundary. Access to DeepSeek models through another agent does not establish harness compatibility. |

For each candidate, determine discovery/types, execution language and available imports/tools, structured decoding, cancellation/replay/retry, lifetime, concurrency, authorization and disclosure before selecting a bridge. Thin adapters translate supported calls; they do not reimplement lifecycle rules or promise identical facilities across hosts. No target has been qualified by this selection, and neither simultaneous delivery nor a new agent runtime is required.

## Responsibilities

```text
Ledger interface / automation           User / agent / code-use environment
             |                                        |
   Optional language client                    Harness-specific adapter
             |                                        |
             +-- Typed operation/query contract ------+
                              |
                      Selected native bridge
                              |
                      Trusted native host
                              |
                         Rust engine
                          /       \
                         v         v
                 Ledger/Change   Explicit native bindings
                 JSONL + custody         |
                                         v
                                Application-owned State
```

The diagram describes responsibilities, not a selected IPC mechanism, mandatory SDK, network proxy or process per box. An adapter may use shared SDK helpers or bind directly to the supported host boundary. Direct Rust clients remain supported by their own native contracts without Node, Python, Pi or a model. Reusable language clients must be usable without creating a Pi session or importing an agent runtime merely to invoke the engine.

An agent host can use this contract for accountable Change operations while supported bindings use existing application APIs. Applications need not install ChangeKernel merely to participate; optional app-side integration can expose stronger capabilities or evidence. A generated UI is another client/View, not another lifecycle implementation. SDK ergonomics do not manufacture guarantees absent from an application's authority, effect or recovery contract.

| Boundary | Responsibility |
| --- | --- |
| Language surfaces and optional SDK helpers | Construct exact requests, encode/decode the selected boundary, preserve structured results and errors, and provide bounded iteration and composition. |
| Native bridge and trusted host | Establish configured profile, custody and native owner lifetime; obtain authenticated context independently of client fields; serialize calls and protect the exposed endpoint under the selected host contract. |
| Rust engine | Enforce native operation contracts, admission, authorization, exact identity, acceptance, accounting and supported recovery. Clients are not second lifecycle implementations. |
| Native application and binding | Establish actual resource identity, authority, observations, constraints, effects and outcome evidence under the [binding contract](state.md#native-bindings-not-a-separate-state-subsystem). |
| Harness adapters, initially Pi | Expose the supported contract through the harness's available functions/tools and presentation. The harness supplies execution mechanics, not domain acceptance or native authority. |

## Composable operation surface

The [ledger](ledger-selection.md) and [history](ledger-history.md) contracts identify the initial operation families. Their names below are native operations, not newly frozen JavaScript or Python signatures. Each integration slice must map only the operations implemented and accepted for its explicitly selected profile.

| Surface | Existing operation families | Client boundary |
| --- | --- | --- |
| Ledger | `create_change`, `list_changes`, `select_change` | Explicit ledger identity, bounded authorized listing/selection and original creation-key semantics. Selection is not ambient permission for later calls. |
| Change | `inspect_history`, `inspect_context`, `revise_intent`, `run_check` | Explicit Change and applicable version references, exact history/context, attributable intent revisions and supported Check assessments. |
| Native binding | Only the observations/effects supported by the selected native profile | No generic State CRUD, arbitrary SQL/shell execution or effect capability inferred from a tool schema. |

Use typed data and ordinary JavaScript or Python control flow instead of a query DSL, ORM, workflow language or bespoke endpoint for every question. Helpers may iterate authorized pages, join exact references or compare selected contexts. They are compositions of existing operations, not new transactions or authority paths. No generic delete, raw append or accepted-record editor is implied.

Requests must not depend on hidden mutable selection. Preserve explicit identities, original request keys, expected revisions and nullable/absent distinctions. Specify lossless handling of native integers, strings and bytes at each language boundary; do not trim intent, coerce unsupported values or regenerate a key after failure. Trusted grants, actors, credentials and custody controls are not agent-authored request fields. Client types are ergonomic checks, not a substitute for native validation.

Results must remain programmatically usable without parsing explanatory prose. Preserve native error distinctions, exact result references and projection coverage/gaps. Distinguish a known native refusal from transport loss or cancellation that leaves acceptance unknown; do not invent a native outcome when no result was received. Client error representation must map the frozen native results rather than change their wire meaning. Unsupported operations/profile versions stay explicit, with no silent fallback to a weaker host.

## Bounded composition and lifecycle

- **Bound reads at both levels.** Preserve native per-call limits and accounting. Page helpers also need explicit total call/item/byte/time budgets under the supported host contract, incremental processing and visible partial coverage or a continuation cursor. Do not implement an unbounded implicit "load everything" loop.
- **Preserve navigation meaning.** Origin, accepted tip and historical cursor remain distinct. Reads do not accept pending work, run a new Check assessment or execute effects. Deterministic validation of retained assessments retains its existing meaning. Live pagination does not promise a cross-Change snapshot.
- **Serialize ownership correctly.** Calls sharing a custody-bearing native owner, including reads, follow its serialized non-reentrant contract. Parallel composition is permitted only for independently supported scopes. Do not open a fresh owner per method or introduce a second lock to evade the selected lifetime rules.
- **Keep failure boundaries visible.** Several accepted calls are not one transaction. Cancellation, client disconnect or script failure is not rollback, proven cleanup or proof that no call was accepted. Retry only where the selected native contract permits it, with the original exact request/key; native-effect uncertainty uses supported reconciliation, never blind repetition.
- **Keep authority current.** A saved handle, cursor, result reference or successful earlier call grants no ongoing permission. Cached/private material needs its applicable current disclosure checks. Cleanup and native resource lifetime remain host obligations, not consequences of garbage collection alone.
- **Preserve consequential evidence.** Result reduction must not hide required failures, unknown outcomes, applicable Check results, missing grounds or limited coverage. A summary is not an accepted record or a complete result merely because it is small.

Candidate model-free compositions include bounded authorized listing and exact history/context inspection, or creation, intent revision, a supported deterministic Check and original-result recovery after a lost reply across a supported close/reopen. Select the actual consumer after the format work and native profile decision. These examples are not new compound operations, a mandatory navigator-first delivery sequence or claims that every profile supports the full path.

## Harness responsibility boundary

ChangeKernel must not implement the harness's or agent runtime's responsibilities. The shared contract separates domain acceptance and recovery semantics from execution and delivery mechanics; it is not a reason to build another runtime inside the engine or disguise one as an adapter.

| Owner | Responsibility |
| --- | --- |
| Harness or consuming application | Agent/model loops, sessions, scheduling, execution checkpoints, outgoing delivery, retry timing and cancellation signaling. If an integration promises recovery across sender failure, the sender's supported facilities must preserve the outgoing request identity and exact inputs. |
| Thin adapter | Map supported calls, structured values and errors; carry established host context and original request identity without inventing authority or silently generating a replacement request. Reuse the host's delivery/lifetime facilities rather than duplicate a session manager, outbox or retry scheduler. |
| ChangeKernel and its supported native host/bindings | Enforce the supported adopted Ledger/Change semantics, applicable Check requirements and Ledger-associated authority; validate requests, enforce accepted-history and native ownership rules, establish exact request/result associations at the contract's acceptance boundary, and expose authorized established outcomes or uncertainty. Native in-flight safety, custody and cleanup duties remain governed by their supported contracts. |
| Integration profile | Declare the boundary, required host capabilities and actual end-to-end recovery limits; qualify the combined path before claiming it works across failures. Missing harness facilities limit the claim rather than create a kernel-owned runtime requirement. |

Before ChangeKernel receives a request, preserving its pending delivery is a sender responsibility. Receipt alone is not durable acceptance; the native contract must still specify when request bindings and outcomes become recoverable. Engine-side request matching and original-result recovery are not a harness retry loop. A missing result does not prove that a delayed request cannot arrive or that no earlier call was accepted.

Harness cancellation is a signal, not an accepted stop decision, confirmed native cessation or rollback. Conversely, this boundary does not delegate authoritative history or required adoption evidence to disposable session state: exact consequential material must still meet its declared retention/resolution contract. ChangeKernel needs the relevant grounds, not a copy of the harness's entire conversation, checkpoint system or work queue.

## Authorization and disclosure boundary

The trusted backend establishes the authenticated caller, current delegation, governing authorization, applicable native rights, exact subjects/versions, required Checks and retry/outcome identity. Caller-supplied actor, approval or pass fields cannot manufacture authority. Bypassing a client helper must not bypass validation, and a code-use client must not append authoritative records or edit Views as an alternative write path. Bounded delegation need not require a new human prompt for every call.

Apply authorization before material reaches the code-use environment, including listings, reference expansion, errors and caches. Result reduction can save model context; it is not a disclosure check. Provider-hosted execution receives its intermediate inputs even when only a summary reaches the model, so that disclosure also needs authorization. Disclosed plaintext cannot be recalled by revoking later access.

An SDK, CLI, hidden tool description or language choice is not a security boundary. The existing trusted-host design does not protect storage or credentials from hostile processes with unrestricted same-privilege access. Any stronger isolation claim must cover actual filesystem, process, credential, tool/extension, subprocess, MCP and network paths under the [agent-execution boundary](agent-execution.md), rather than only the visible sandbox or chosen wrapper. This direction selects no isolation mechanism or newly qualified guarantee.

## State through explicit native bindings

State remains a scoped concept and a source of evidence, not a third independently managed object alongside Ledger and Change. Historical navigation consumes accepted records and retained grounds; it must not require fresh native access merely to replace historical observations. A concrete source-dependent operation can still require the current native access specified by its profile.

Bind to application capabilities at the boundary that enforces their business rules, whether an application API, filesystem or appropriate persistence operation. A direct database adapter must not bypass those rules merely because storage is reachable. Each binding declares its supported subset and limits; a read-only binding does not need a fictional write or reconciliation implementation. Shared abstractions should emerge from actual integrations rather than a universal State schema, registry, synchronization engine or event service. The [State contract](state.md#native-bindings-not-a-separate-state-subsystem) owns the evidence and authority requirements; this SDK direction adds no native capability by itself.

## Pi integration after the model-free boundary

Pi Codemode runs QuickJS scripts against exposed tools; installing an npm SDK does not make it directly importable inside that sandbox. The Pi adapter registers tools that delegate through the selected native bridge, optionally using a shared host SDK. Generated code need not import that SDK or access Node/process APIs. A CLI bridge is another host-side option if later selected; it is not direct subprocess access inside QuickJS. Use discoverable names, concise TypeScript declarations and namespace guidance. For data tools, declare `outputSchema` and return matching `structuredContent` instead of requiring scripts to parse rendered text. The adapter must preserve failures in the structured value as well as the human-facing result; a resolved promise or completed script is not sufficient success evidence. MCP result wrappers have their own `isError`/`structuredContent` handling if that transport is later selected.

Codemode supplies loops, independent batches, joins and output reduction. Its `store()` can retain small cursors/references after successful scripts, not authoritative operation outcomes. Tool effects are real and are not rolled back by script failure. Sandbox memory limits do not bound all invoked native work; preserve per-call and aggregate bounds explicitly.

Integrate direct tools/Codemode first. Add MCP only for a concrete transport consumer, model routing only for a semantic task, and Durable only for demonstrated persistent execution needs. Do not implement duplicate discovery, model loops or task schedulers. Ordinary Pi and experimental Durable are separate APIs, not an automatically integrated runtime. Durable documents, transcripts and checkpoints remain private runtime state or derived aids; they neither replace JSONL authority nor supply native effect receipts.

The [capability matrix](../research/pi-capability-matrix.md) retains pinned Pi 1.0.4 evidence and reliability gaps; the [Pi 1.1.0 follow-up](../research.md#pi-110-session-format-follow-up) is scoped session-format inspection, not qualification of the combined stack. The supporting npm package exports retained Pi bridges and pins Pi 0.85.1; it is not this general SDK. The separately integrated [referenced-intent Pi host](../../../../../src/adapters/pi/referenced-intent/README.md) targets Pi 1.2.0 for its closed native contract, not general Check authoring or enforcement. Exact runtime selection, dependency migration and qualification remain explicit work rather than consequences of an installed update or this design.

## Evidence required for a supported SDK slice

Use the [testing policy](package.md#testing-policy) and phased gates, not a new test framework or a permanent documentation/shape test suite. Demonstrate observable behavior through the real selected language/host-to-Rust boundary, including exact result identity and lossless input/output handling. Initial Pi evidence does not qualify a Python surface or another harness; each claimed adapter needs its actual boundary exercised. Controlled transport faults and simulated peers can isolate cases, but mocks alone cannot establish native storage, authority, owner lifetime or recovery.

The selected slice needs a useful model-free path plus consequential cases for denied/unavailable authority, malformed or oversized input, unsupported profiles, conflicting key reuse, stale references, partial pagination, lost replies, interruption and cleanup. Exercise only capabilities actually claimed; a ledger-only SDK witness does not qualify native effects, whole-process native Owner reconstruction or reboot continuity. Source acceptance, exact-release qualification, activation and controller handoff remain separate.

Efficiency evidence must distinguish model/tool round trips and returned context size from native I/O, validation, decoding, copying, memory and ownership costs. Fewer model calls do not prove fewer ledger scans. Use the same bounded consumer workload for comparisons, preserve accounting meanings, and propose an optimization only for an observed cost without weakening the contract. This design neither runs benchmarks nor expands an authorized measurement scope.
