---
title: Composable SDK and Integration Boundary
aliases: []
source-id: cw:component:sdk
---
# Composable SDK and Integration Boundary

## Selected direction and compatibility

Design a robust, efficient JavaScript/TypeScript SDK over the existing Rust engine before integrating product-agent capabilities. The SDK serves ordinary applications and deterministic clients as well as Pi adapters. A read-only navigator is the first composition consumer, not a separate backend or the limit of the SDK's intended scope. The [Wiki plan](../../product/plan.md#sdk-first-integration-direction) owns delivery dependencies; the [temporary status note](../../../../../CHANGEKERNEL_STATUS.md) owns assignments and implementation permission.

This is adopted design direction, not a frozen JavaScript API, selected transport, implemented SDK or qualified release. Select the native profile, host lifetime, operation mappings and concrete client signatures with the first consuming slice. A contract or preserved implementation checkpoint alone does not establish accepted executable support.

Preserve ledger/folder and Change-file structures, canonical JSONL schemas, accepted history, supported operation versions and their complete input/result, admission, authorization, retry, recovery, ownership, limits and accounting contracts. The SDK must not silently widen a profile or translate one profile into another. Existing operations remain the semantic units; client convenience does not introduce new accepted operation types. Format migration, new native operations and changed guarantees require separate adoption.

There is no demonstrated storage-layout change required by this direction. Optimize access and composition within the existing contracts first. Rebuildable indexes or caches need a measured consumer and correct source/version and disclosure boundaries; acceptance controls and original creation/retry associations are not disposable caches.

## Responsibilities

```text
Ordinary JavaScript/TypeScript application
                  |
                  v
          Shared composable SDK <--- Pi tool adapter <--- Codemode
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

The diagram describes responsibilities, not a selected IPC mechanism or a required process per box. Direct Rust clients remain supported by their own native contracts without Node, Pi or a model. The JavaScript client must be usable without creating a Pi session or importing an agent runtime merely to invoke the engine.

| Boundary | Responsibility |
| --- | --- |
| SDK and composition helpers | Construct exact requests, encode/decode the selected boundary, preserve structured results and errors, and provide bounded iteration and composition. |
| Native bridge and trusted host | Establish configured profile, custody and native owner lifetime; obtain authenticated context independently of client fields; serialize calls and protect the exposed endpoint under the selected host contract. |
| Rust engine | Enforce native operation contracts, admission, authorization, exact identity, acceptance, accounting and supported recovery. The SDK is not a second lifecycle implementation. |
| Native application and binding | Establish actual resource identity, authority, observations, constraints, effects and outcome evidence under the [binding contract](state.md#native-bindings-not-a-separate-state-subsystem). |
| Pi adapters | Expose the same SDK operations through compatible tools and presentation. Pi supplies execution mechanics, not domain acceptance or native authority. |

## Composable operation surface

The [ledger](ledger-selection.md) and [history](ledger-history.md) contracts identify the initial operation families. Their names below are native operations, not newly frozen JavaScript signatures. Each SDK slice must map only the operations implemented and accepted for its explicitly selected profile.

| Surface | Existing operation families | Client boundary |
| --- | --- | --- |
| Ledger | `create_change`, `list_changes`, `select_change` | Explicit ledger identity, bounded authorized listing/selection and original creation-key semantics. Selection is not ambient permission for later calls. |
| Change | `inspect_history`, `inspect_context`, `revise_intent`, `run_check` | Explicit Change and applicable version references, exact history/context, attributable intent revisions and supported Check assessments. |
| Native binding | Only the observations/effects supported by the selected native profile | No generic State CRUD, arbitrary SQL/shell execution or effect capability inferred from a tool schema. |

Use typed data and ordinary JavaScript control flow instead of a query DSL, ORM, workflow language or bespoke endpoint for every question. Helpers may iterate authorized pages, join exact references or compare selected contexts. They are compositions of existing operations, not new transactions or authority paths. No generic delete, raw append or accepted-record editor is implied.

Requests must not depend on hidden mutable selection. Preserve explicit identities, original request keys, expected revisions and nullable/absent distinctions. Specify lossless handling of native integers, strings and bytes at the JavaScript boundary; do not trim intent, coerce unsupported values or regenerate a key after failure. Trusted grants, actors, credentials and custody controls are not agent-authored request fields. Client types are ergonomic checks, not a substitute for native validation.

Results must remain programmatically usable without parsing explanatory prose. Preserve native error distinctions, exact result references and projection coverage/gaps. Distinguish a known native refusal from transport loss or cancellation that leaves acceptance unknown; do not invent a native outcome when no result was received. Client error representation must map the frozen native results rather than change their wire meaning. Unsupported operations/profile versions stay explicit, with no silent fallback to a weaker host.

## Bounded composition and lifecycle

- **Bound reads at both levels.** Preserve native per-call limits and accounting. Page helpers also need explicit total call/item/byte budgets, incremental processing and visible partial coverage or a continuation cursor. Do not implement an unbounded implicit "load everything" loop.
- **Preserve navigation meaning.** Origin, accepted tip and historical cursor remain distinct. Reads do not accept pending work, run a new Check assessment or execute effects. Deterministic validation of retained assessments retains its existing meaning. Live pagination does not promise a cross-Change snapshot.
- **Serialize ownership correctly.** Calls sharing a custody-bearing native owner, including reads, follow its serialized non-reentrant contract. Parallel composition is permitted only for independently supported scopes. Do not open a fresh owner per method or introduce a second lock to evade the selected lifetime rules.
- **Keep failure boundaries visible.** Several accepted calls are not one transaction. Cancellation, client disconnect or script failure is not rollback, proven cleanup or proof that no call was accepted. Retry only where the selected native contract permits it, with the original exact request/key; native-effect uncertainty uses supported reconciliation, never blind repetition.
- **Keep authority current.** A saved handle, cursor, result reference or successful earlier call grants no ongoing permission. Cached/private material needs its applicable current disclosure checks. Cleanup and native resource lifetime remain host obligations, not consequences of garbage collection alone.
- **Preserve consequential evidence.** Result reduction must not hide required failures, unknown outcomes, applicable Check results, missing grounds or limited coverage. A summary is not an accepted record or a complete result merely because it is small.

A useful first read composition lists an authorized bounded working set, inspects selected histories/contexts, and returns relevant records with exact references and coverage. A model-free mutation consumer then creates/selects a Change, revises intent and runs a supported deterministic Check, closes/reopens the supported host, and recovers the original result after a lost reply. These are consumer scenarios, not new compound native operations or claims that every existing profile supports the entire sequence.

## State through explicit native bindings

State remains a scoped concept and a source of evidence, not a third independently managed object alongside Ledger and Change. Historical navigation consumes accepted records and retained grounds; it must not require fresh native access merely to replace historical observations. A concrete source-dependent operation can still require the current native access specified by its profile.

Bind to application capabilities at the boundary that enforces their business rules, whether an application API, filesystem or appropriate persistence operation. A direct database adapter must not bypass those rules merely because storage is reachable. Each binding declares its supported subset and limits; a read-only binding does not need a fictional write or reconciliation implementation. Shared abstractions should emerge from actual integrations rather than a universal State schema, registry, synchronization engine or event service. The [State contract](state.md#native-bindings-not-a-separate-state-subsystem) owns the evidence and authority requirements; this SDK direction adds no native capability by itself.

## Pi integration after the model-free boundary

Pi Codemode runs QuickJS scripts against exposed tools; installing an npm SDK does not make it directly importable inside that sandbox. The ordinary host imports the SDK, and the Pi adapter registers operation tools that delegate to it. Use discoverable names, concise TypeScript declarations and namespace guidance. For data tools, declare `outputSchema` and return matching `structuredContent` instead of requiring scripts to parse rendered text. The adapter must preserve failures in the structured value as well as the human-facing result; a resolved promise or completed script is not sufficient success evidence. MCP result wrappers have their own `isError`/`structuredContent` handling if that transport is later selected.

Codemode supplies loops, independent batches, joins and output reduction. Its `store()` can retain small cursors/references after successful scripts, not authoritative operation outcomes. Tool effects are real and are not rolled back by script failure. Sandbox memory limits do not bound all invoked native work; preserve per-call and aggregate bounds explicitly.

Integrate direct tools/Codemode first. Add MCP only for a concrete transport consumer, model routing only for a semantic task, and Durable only for demonstrated persistent execution needs. Do not implement duplicate discovery, model loops or task schedulers. Ordinary Pi and experimental Durable are separate APIs, not an automatically integrated runtime. Durable documents, transcripts and checkpoints remain private runtime state or derived aids; they neither replace JSONL authority nor supply native effect receipts.

The [capability matrix](../research/pi-capability-matrix.md) retains pinned Pi 1.0.4 evidence and reliability gaps. The current supporting npm package exports Pi bridges and pins Pi 0.85.1; it is not this SDK. Dependency migration, runtime selection and qualification remain explicit work rather than consequences of the design.

## Evidence required for a supported SDK slice

Use the [testing policy](package.md#testing-policy) and phased gates, not a new test framework or a permanent documentation/shape test suite. Demonstrate observable behavior through the real JavaScript-to-Rust boundary, including exact result identity and lossless input/output handling. Controlled transport faults and simulated peers can isolate cases, but mocks alone cannot establish native storage, authority, owner lifetime or recovery.

The selected slice needs a useful model-free path plus consequential cases for denied/unavailable authority, malformed or oversized input, unsupported profiles, conflicting key reuse, stale references, partial pagination, lost replies, interruption and cleanup. Exercise only capabilities actually claimed; a ledger-only SDK witness does not qualify native effects, whole-process native Owner reconstruction or reboot continuity. Source acceptance, exact-release qualification, activation and controller handoff remain separate.

Efficiency evidence must distinguish model/tool round trips and returned context size from native I/O, validation, decoding, copying, memory and ownership costs. Fewer model calls do not prove fewer ledger scans. Use the same bounded consumer workload for comparisons, preserve accounting meanings, and propose an optimization only for an observed cost without weakening the contract. This design neither runs benchmarks nor expands an authorized measurement scope.
