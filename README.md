# ChangeKernel

**A redistributable State-and-Change engine for applications.**

Developers expose native resources and abilities. Users own goals and adopt Checks expressing their custom requirements. Agents and other workers compose paths. ChangeKernel is designed to govern Changes to Workspaces, retain attributable history and support recovery within declared limits.

The intended product connects application development, ordinary use and improvement through the same actor-neutral primitives. Users own intent; supported hosts and bindings enforce native permissions; observed effects do not automatically prove the intended benefit. Automation and agent-mediated use are later capabilities, not permission to change software, deploy releases or alter policy.

**This is source development, not a qualified operational release.** The approved direction is a new Rust product with narrow TypeScript integrations, not a feature-parity port of the historical prototype. Bounded native intake, committed-source observations, Linux JSONL opening/intent/fixed assessment, ledger collection/history/continuity and the trusted referenced-intent native/Pi bridge are implemented as source capabilities. General custom Check definition/adoption/applicability, required-pass dependent-transition enforcement, application effects and the complete lifecycle remain unfinished. See [temporary status](CHANGEKERNEL_STATUS.md).

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
| [Research](.changekernel/wiki/items/system/research.md) | Inspected alternatives, counterexamples and unproven mechanisms—not an implementation queue. |
| [Retained native profiles](.changekernel/wiki/items/system/components/native-profiles.md) | Existing frozen API/storage/packet contracts, their limits and known gaps. |

A phase advances only on actual bounded evidence and independent acceptance. Failed hypotheses are revised or rejected, not disguised as successful implementation. A useful core engine release precedes autonomous self-development; activation and explicit controller handoff remain separate gates. No phase is completed by this documentation.

Future capabilities include richer clients, agent execution, domain Packs, additional bindings, collaboration, automation and learning through the same Change mechanism. Jev/Jaz, automatic discovery, recursive runtimes and Linux containment proposals are optional mechanisms to evaluate against concrete needs, not core dependencies. Sharing a Change file does not grant authority or exclusive continuation.

Wiki stores durable design and the phased capability plan. Execution state stays in the short temporary status note until qualified Change/Work can own it. The retained `wiki/` name does not require a runtime Wiki or Markdown State. Prior committed design and archived plans are historical evidence, not parallel active specifications.

## Executable foundation

The private supporting package is `@nunomoura/changekernel`; the native executable is `changekernel`. The npm entrypoint exports only Pi model/provider/session/runtime bridges and their required protocol/codec dependencies. It does not export an engine, Project Server, intake/candidate client or launcher.

Historical TypeScript lifecycle, Git/Wiki, console and SQLite scaffolding has been removed. Git preserves its implementation and retired tests; neither is a native feature-parity target. Native SQLite intent revision appends are implemented; concrete file-candidate custody remains blocked and unintegrated. Existing SQLite profiles stay unchanged for the file-first delivery; there is no new schema extension, automatic migration or candidate-writer integration. The shared retained-attribution defect is not repaired or accepted by choosing a new architecture. The [private continuation profile](.changekernel/wiki/items/system/components/native-profiles.md#native-private-continuation-profile) defines their bounded contract, not release qualification.

The Rust library separately exposes `Intake`, `SqliteIntake`, `Proposal`, `Receipt`, and `Issue` for the [bounded native intake contract](.changekernel/wiki/items/system/components/native-profiles.md#native-rust-intake). A host must authenticate the actor, protect storage, and explicitly initialize or reopen an absolute persistent SQLite path; this library boundary grants no effect authority. Native intake preserves exact What and optional Why, and reconciles retries without application effects. Its existing container terminology and SQLite layout remain a bounded profile, not the new Workspace/file-first lifecycle or a migration target selected by this documentation.

The continuation profile adds explicit `SqliteIntake::initialize_continuation`, atomic revision-zero custody and verified current/historical intent reads via `read_intent`. `revise_intent` now supports atomic SQLite revision/retry/head writes, exact historical retries and bounded decoding of stored retry references. Existing intake-only files are not upgraded. Candidate types, ports and generic coordination are present, but their SQLite writer is not yet integrated. These interfaces do not grant execution authority.

`GitSourceObserver` and `observe_committed_source` implement [bounded committed-source reads](.changekernel/wiki/items/system/components/native-profiles.md#native-committed-source-observations). They recheck container access and return exact selected file bytes/modes/identities or verified absence from an explicit commit. Captured commit/tree/blob bytes must match their Git identities; child execution and cleanup are bounded. Unsupported or corrupt sources and operational failures remain unavailable, not inferred absence or denial. This is neither a live workspace view nor retained assessment grounds, candidate custody, publication or OS containment.

`OpeningHost` implements the [consumed opening profile](.changekernel/wiki/items/system/components/state.md#consumed-opening-profile): one independently provisioned Linux fixture slot, host-established identity/current policy, accepted-prefix authority, useful inspection and original-key replay after writer exit and fresh-process reopen. The library exposes no raw append, public actor/approval/result input, source capture or application effects. Tests exercise real files/process cuts, deterministic recovery or specified refusal, and incident preservation; they do not qualify power loss, hostile writers, relocation, archive/transfer or an operational release. Existing SQLite APIs, schemas and tests remain unchanged.

`IntentHost` implements the separate [fresh-only intent profile](.changekernel/wiki/items/system/components/intent-trace.md): repeated exact What/Why replacement, origin/historical/current inspection and original-key retries after later revisions and fresh-process reopen. Current authority still governs disclosure; null Why is not inheritance, and every prior intent remains in accepted history. The fixture bounds accepted history to 128 records and 16 MiB, with measured whole-call validation/read/hash/codec/buffer costs. Profile-1 custody is not migrated or copied into continuing profile-2 custody. Neither profile authorizes application effects or qualifies a general ledger or operational host.

`AssessmentHost` implements the separate [fresh-only assessment profile](.changekernel/wiki/items/system/components/assessment-trace.md): an optional, independently selected fixture Check asks whether exact What fits 80 raw UTF-8 bytes. Assessment is an ordinary typed Change operation, not a mandatory stage. Completed true and false results enter history; assessments advance the operation tip without replacing current intent. Current/historical result inspection and original-key retries preserve the original subject and outcome across revisions and restart. Unavailability is not a fabricated false result; passing grants neither application effects nor Change completion. Existing opening/intent profiles remain unchanged, with no migration, arbitrary evaluator runtime or actual notice delivery.

`LedgerHost`, `LedgerHistoryHost` and `LedgerContinuityHost` implement bounded [collection](.changekernel/wiki/items/system/components/ledger-selection.md), [history/context](.changekernel/wiki/items/system/components/ledger-history.md) and [continuity](.changekernel/wiki/items/system/components/ledger-continuity.md) profiles (v4–v6), not a general collaborative ledger. The v5/v6 fixed optional notice assessment is not user-defined requirement enforcement.

The Linux executable supports `--referenced-intent-bridge` for the separately adopted [referenced-intent prototype](.changekernel/wiki/items/system/components/referenced-intent-prototype.md). Its trusted Pi host targets Pi 1.2.0 and supports exact local approval, referenced What/Why revision, bounded inspection and original-result recovery under a closed no-domain-Check, no-effect policy. It does not widen the retained Pi 0.85.1 bridge contracts. Source integration is not real-human TUI smoke, diagnostic benchmarking, release qualification or controller handoff; see [host limits](src/adapters/pi/referenced-intent/README.md).

General Check definition/adoption/revision/retirement, applicability and required-pass dependent-transition enforcement remain unimplemented. Fixed optional assessments and the referenced-intent profile's empty domain-requirements array are not those capabilities. General semantic discovery, guarded effects and complete continuation remain unfinished. Broader discovery, model integration, worker coordination, rich clients, borrowing/forks, encrypted sharing and cross-Workspace dependencies are unsupported later capabilities, not initial release prerequisites. Draft persistence and passing source tests do not establish qualified adoption.

## Development and repository truth

The primary `changekernel/` checkout on **`main`** is the accepted development baseline. Its Wiki and source are the versions to read for current adopted design and integrated implementation. Sibling `changekernel-workers/<assignment>/` folders are isolated Git worktrees, each with its own branch snapshot; they are not separately maintained products or automatically synchronized Wikis. Reviewed changes return to `main`. Archived task checkouts preserve history or unaccepted work, not another current source of truth. See [checkout and branch procedure](AGENTS.md#canonical-checkout-and-branches).

Native builds require Rust 1.88.0 and a C compiler for bundled SQLite, but neither Node nor Pi. Use the standard Rust harness:

```bash
cargo test --locked
# Before native acceptance:
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
```

`cargo test` compiles and runs unit, integration and documentation tests. Compilation owns type/borrow/exhaustiveness checks; tests cover runtime behavior and consequential failures, not compiler guarantees. No extra testing framework is required. Use `cargo build --locked` when checking a native build artifact.

For changes to retained Pi adapters or their dependencies, use Node.js 22.19.0 or newer and `npm ci --ignore-scripts`, then `npm test`. This checks the narrow TypeScript adapter closure and runs its model/provider/session/protocol tests with controlled fixtures. It does not build the historical TypeScript engine or run Rust tests. Rust-only work does not require npm checks. `npm run build` builds only the supporting Pi adapter package, not the historical engine or a native artifact. The npm package no longer installs a `changekernel` launcher; the native Cargo binary is the only launcher.

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
