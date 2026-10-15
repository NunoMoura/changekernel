# ChangeKernel

**A redistributable State-and-Change engine for applications.**

Developers expose native resources and abilities. Users own goals and adopt Checks expressing their custom requirements. Agents and other workers compose paths. ChangeKernel is designed to govern Changes to Workspaces, retain attributable history and support recovery within declared limits.

The intended product connects application development, ordinary use and improvement through the same actor-neutral primitives. Users own intent; supported hosts and bindings enforce native permissions; observed effects do not automatically prove the intended benefit. Automation and agent-mediated use are later capabilities, not permission to change software, deploy releases or alter policy.

**This is source development, not a qualified operational release.** The approved direction is a new Rust product with narrow TypeScript integrations, not a feature-parity port of the historical prototype. The active path is the `0.5.0-prototype.1` referenced-intent native engine and thin Pi 1.2 host/TUI, with the private custody mechanisms it requires. Predecessor executable support is approved for withdrawal; removal and combined source acceptance remain pending integration, not accomplished by this documentation. General custom Check definition/adoption/applicability, required-pass dependent-transition enforcement, application effects and the complete lifecycle remain unfinished. See [temporary status](CHANGEKERNEL_STATUS.md).

## Design and plan

**Change carries intent. State describes observed reality. History connects them with evidence.** ChangeKernel owns the [adopted Ledger/Change semantics](.changekernel/wiki/items/product/change-ledger-properties.md#defining-properties-and-value), applicable Check enforcement and Ledger-associated AuthN/AuthZ—not merely storage integrity. This includes owner-controlled continuity, revision/composition, supported transfer, typed progression, authoritative JSONL history, exact requirement/subject bindings, execution coordination and truthful outcomes. Native applications retain State, business rules and permissions; trusted hosts and replaceable adapters supply their declared mechanisms.

The first target is one trusted-host, single-user, single-binding typed transition with deterministic Checks, durable history and honest retry/recovery. No agent, model, custom evaluator runtime, rich console or privileged standalone service is required. This profile does not claim protection from compromise of its trusted host or hostile processes sharing that host's authority. A later hardened profile must prove its stronger guarantees separately.

**Change is independent of a fixed pipeline.** Custom policy is expressed through adopted Checks, without a separate user Kernel policy-governor. Packs are reusable collections of Checks, not independent authority or automatic requirement activation. Planning and formal review are required where applicable requirements call for them, not universal stages; actual approval remains an attributable decision under current authority. Explicit typed requests identify operations before the backend records them; operations remain grounded in exact intent without reassessing the whole pursuit on every call. Native applications retain their domain semantics. The engine enforces exact subjects, current authority, valid progression and evidence; substantive feasibility, comparative value and quality criteria belong in applicable Checks, not a hidden universal engine veto.

The ledger is a stable collection of intent-bearing Changes, not a workflow directory tree. Relationships use explicit references; completion is an evidenced conclusion; default active-only Views and optional later archival are separate storage concerns. Restore or file transfer does not replay effects or grant continuation authority. [Product semantics](.changekernel/wiki/items/product/changekernel.md#intent-and-lifecycle) and the [storage contract](.changekernel/wiki/items/system/components/state.md#ledger-working-set-archive-and-restore) define these boundaries without freezing a universal opcode list or archive layout.

| Document | Purpose |
| --- | --- |
| [Product](.changekernel/wiki/items/product/changekernel.md) | Intended responsibilities, core boundaries and explicitly later capabilities. |
| [ChangeKernel plan](.changekernel/wiki/items/product/plan.md) | Small phases, falsifiable propositions, useful witnesses and evidence required to advance. |
| [Change Format and Lifecycle](.changekernel/wiki/items/system/components/change-format.md), [Worked Change Streams](.changekernel/wiki/items/system/components/change-streams.md) | Adopted semantic requirements and conditional design witnesses, not a frozen successor wire schema or implemented capability. |
| [State](.changekernel/wiki/items/system/components/state.md), [Checks](.changekernel/wiki/items/system/components/checks.md), [Execution](.changekernel/wiki/items/system/components/agent-execution.md), [Release](.changekernel/wiki/items/system/components/package.md) | Desired contracts and capability-specific qualification. |
| [Current prototype](.changekernel/wiki/items/system/components/referenced-intent-prototype.md), [SDK and Pi boundary](.changekernel/wiki/items/system/components/sdk.md) | The adopted `0.5.0-prototype.1` contract and thin integration direction; not a general SDK or qualified release. |
| [Research](.changekernel/wiki/items/system/research.md) | Inspected alternatives, counterexamples and unproven mechanisms—not an implementation queue. |
| [Historical profiles and support disposition](.changekernel/wiki/items/system/components/native-profiles.md) | Frozen predecessor meanings, source checkpoints, limits and known gaps; not active product APIs. |

A phase advances only on actual bounded evidence and independent acceptance. Failed hypotheses are revised or rejected, not disguised as successful implementation. A useful core engine release precedes autonomous self-development; activation and explicit controller handoff remain separate gates. No phase is completed by this documentation.

Future capabilities include richer clients, agent execution, domain Packs, additional bindings, collaboration, automation and learning through the same Change mechanism. Jev/Jaz, automatic discovery, recursive runtimes and Linux containment proposals are optional mechanisms to evaluate against concrete needs, not core dependencies. Sharing a Change file does not grant authority or exclusive continuation.

Wiki stores durable design and the phased capability plan. Execution state stays in the short temporary status note until qualified Change/Work can own it. The retained `wiki/` name does not require a runtime Wiki or Markdown State. Prior committed design and archived plans are historical evidence, not parallel active specifications.

## Executable foundation

The native executable is `changekernel`. On Linux, `--referenced-intent-bridge` serves the [current referenced-intent prototype](.changekernel/wiki/items/system/components/referenced-intent-prototype.md): exact local approval, referenced What/Why revision, bounded inspection and original-result recovery under a closed no-domain-Check, no-effect policy. Its thin [Pi 1.2 host/TUI](src/adapters/pi/referenced-intent/README.md) provides readable preview plus complete authoritative exact review, default Cancel and separate affirmative adoption. Source integration is not real-human TUI smoke, diagnostic benchmarking, release qualification or controller handoff.

The [approved retirement boundary](.changekernel/wiki/items/system/components/native-profiles.md#approved-executable-retirement-boundary) withdraws future-build support for container/intake, SQLite continuation/candidate APIs, committed Git observations, Linux local-packet ingress, JSONL v1–v6 semantic hosts and Pi 0.85.1/root TypeScript exports. Their contracts and exact pre-retirement source remain [historically navigable](.changekernel/wiki/items/system/components/native-profiles.md#historical-compatibility-reference), not a feature-parity target or a permanent legacy library. Required private filesystem/identity/accounting mechanisms must be extracted and reviewed before native semantic retirement. This worker checkpoint still contains predecessor implementations; the [temporary status](CHANGEKERNEL_STATUS.md) and integrated source determine completion.

Historical compatibility means preserving original bytes, attribution, retry, authority and custody interpretation—not promising that future builds continue to expose those APIs. Withdrawal does not repair known defects, authorize old-store migration/recovery/cleanup or change the current prototype's policy, approval, disclosure or recovery guarantees. The independent SQLite application-effect fixture remains a later-capability witness, not a current effect API.

General Check definition/adoption/revision/retirement, applicability and required-pass dependent-transition enforcement remain unimplemented. Fixed optional assessments and the referenced-intent profile's empty domain-requirements array are not those capabilities. General semantic discovery, guarded effects and complete continuation remain unfinished. Broader discovery, model integration, worker coordination, rich clients, borrowing/forks, encrypted sharing and cross-Workspace dependencies are unsupported later capabilities, not initial release prerequisites. Draft persistence and passing source tests do not establish qualified adoption.

## Development and repository truth

The primary `changekernel/` checkout on **`main`** is the accepted development baseline. Its Wiki and source are the versions to read for current adopted design and integrated implementation. Sibling `changekernel-workers/<assignment>/` folders are isolated Git worktrees, each with its own branch snapshot; they are not separately maintained products or automatically synchronized Wikis. Reviewed changes return to `main`. Archived task checkouts preserve history or unaccepted work, not another current source of truth. See [checkout and branch procedure](AGENTS.md#canonical-checkout-and-branches).

Native checks use the pinned Rust 1.88.0 toolchain and require a C compiler for the retained bundled-SQLite fixture dependency, but neither Node nor Pi. Exact dependency placement follows the integrated Cargo manifests. Use the standard Rust harness:

```bash
cargo test --locked
# Before native acceptance:
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
```

`cargo test` compiles and runs unit, integration and documentation tests. Compilation owns type/borrow/exhaustiveness checks; tests cover runtime behavior and consequential failures, not compiler guarantees. No extra testing framework is required. Use `cargo build --locked` when checking a native build artifact.

For current Pi adapter/dependency changes, use Node.js 22.19.0 or newer. Stage candidate bytes in a disposable external project with isolated Pi/HOME/settings, then install dependencies there with `npm ci --ignore-scripts` and run `npm test`; never install dependencies in this checkout. The approved root source-tooling target is private: typecheck the existing Pi 1.2 adapter closure and run `tests/adapters/pi/referenced-intent/*.test.mjs` with the exact existing consumer pins, not the Pi 0.85.1 model/provider/session suite. Root manifest/lock reconciliation is implementation-pending here; until integrated, use the dedicated [external consumer checks](src/adapters/pi/referenced-intent/README.md#external-checks) for the current closure. Its final instruction to run a separate legacy root suite describes the pre-retirement split, not a perpetual support requirement.

Real-native and installed-Pi tests remain conditional on explicitly supplied supported artifacts and fresh isolated test configuration; skipped tests are not integration evidence. Source checks do not select a public SDK, release package, legacy exports, `prepack` or `dist` library build. They do not run Rust tests; Rust-only work does not require npm checks. The Cargo executable remains the native entry point.

Use [AGENTS.md](AGENTS.md) and the researched [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy). Passing tests/builds are not operational qualification. Pack/test candidates only in disposable external projects with isolated Pi settings.

**Never load this mutable checkout as its own controller.** Do not call ChangeKernel `wiki_*` tools or `/wiki-*` commands here, install it under repository `.pi/`, or create local package links, duplicate skills or controller pins. Later governed Changes/Work require a qualified immutable external release, activation and explicit handoff; an unavailable designated controller never falls back to source.

- [`.changekernel/wiki/`](.changekernel/wiki/) owns desired design, not fabricated managed adoption.
- [`.changekernel/changes/`](.changekernel/changes/) owns governed lifecycle history; existing records remain unchanged.
- [`src/`](src/) and [`tests/`](tests/) own executable truth; Git preserves history/checkpoints.
- [`CHANGEKERNEL_STATUS.md`](CHANGEKERNEL_STATUS.md) is a short temporary gap note, not a roadmap. Change/Work replaces it after qualified adoption.
- [Archives](docs/archive/README.md) are historical evidence, not active plans.

Generated views, private runtime state, credentials, caches, sockets, worktrees and package artifacts are not source truth. Documentation approval is not implementation, release activation or controller handoff.

## License

MIT
