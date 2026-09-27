# ChangeKernel

**A redistributable State-and-Change engine for applications.**

Developers expose native resources and abilities. Users choose goals and versioned Kernels. Agents and other workers compose paths. ChangeKernel is designed to govern Changes to Workspaces, retain attributable history and support recovery within declared limits.

The same actor-neutral State and Change primitives connect software development, ordinary product use after launch, and ongoing integration and improvement. Users own their Changes and remain accountable when agents act on their behalf; the system enforces existing application permissions and retains verifiable outcomes. Automation is configurable, including within shared-editing rights. Intended improvement is not a guaranteed result. External tools use supported bindings and the shared authoritative boundary; no particular browser-tool framework is required. User goals can lead to authorized development without automatically granting permission to change software, deploy releases or alter policy.

**This is source development, not a qualified operational release.** The approved direction is a new Rust product with narrow TypeScript integrations, not a feature-parity port of the historical prototype. Bounded native intake and committed-source observations are implemented; the Workspace/user-Kernel model, file-first Trace authority and complete lifecycle are not implemented. See [temporary status](CHANGEKERNEL_STATUS.md).

## Design

Start with the [primary architecture](.changekernel/wiki/items/product/changekernel.md): the complete agreed model, developer examples, responsibilities, boundaries and unresolved decisions.

**Users participate in Workspaces. Their Kernels govern Changes to those Workspaces. State represents a Workspace at particular versions and scope.** Use `workspace_id` consistently; a Workspace is a persistent resource/authority boundary, not an execution directory or mandatory server. Connect existing applications, accounts and repositories without a Container-definition ceremony. Native files, rows and services remain authoritative in place; discovery and tracking grant no permissions.

**Decision → Planning → Execution** are the three public Kernel stages, each with custom Checks and mandatory native requirements. Intake remains within Decision. Planning explicitly assesses Work, dependencies, aggregate effects, parallelism and routing; runtime code performs authorized dispatch and effects. Execution includes pre-effect assessment, observation, recovery and outcome Review. Deployment is a supported activity, not a fourth stage. Simple operations need not invoke a model or human at every boundary.

[Producer strategies](.changekernel/wiki/items/system/components/agent-execution.md#programmable-strategies-and-bounded-delegation) may use bounded computation and recursive reasoning over explicit inputs and authorized structured history. Change Trace authority, runtime transcripts and working context stay separate. Pi is the retained adapter; Jaz is an optional evaluation candidate, not an adopted dependency. The first operational profile must support clean restart/reboot and authorized history reopening; restoring context never authorizes blindly replaying effects.

A user may own multiple Kernels and join multiple Workspaces. The private user folder holds one authoritative append-only JSONL **Change Trace log per Change**, possibly spanning several Workspaces across its files. Each Change has one owner and one fixed Workspace; history preserves intent/revisions, assessments, Work/attempts and actual outcomes. Large artifacts and private transcripts may be referenced. Git can support diffs, collaboration and transport without itself granting execution authority, and no mandatory database service or competing current-State mirror is implied.

Human and agent clients request typed operations through the authorized backend; they never edit authoritative JSONL or supply their own passing assessments/outcomes. The backend constructs records, enforces current authority and owns serialized durable writes and retries. Protected storage and qualified isolation must prevent API bypass. The first local direction pairs the Trace with protected accepted-prefix control; Git supplies checkpoint evidence/transport, not live acceptance. Matching old files do not prove freshness after whole-custody rollback. These are requirements for the new path, not implemented or qualified capabilities.

Borrowing transfers an individual Change's active continuation, never the whole folder, ownership or native permissions. One Change has at most one active custodian; receiving Kernels establish applicable admission. Forking creates a new Change from an exact checkpoint for an alternative or independent pursuit. Dependencies are a graph, not a strict tree; fork lineage alone creates no dependency. Adopt results with provenance and current Checks rather than merging authoritative histories. Encrypted transfer, retained copies and file movement alone do not enforce exclusivity or revoke disclosed plaintext.

The [cardinality model](.changekernel/wiki/items/product/changekernel.md#relationship-cardinalities) and [dependency-gated implementation plan](.changekernel/wiki/items/product/changekernel.md#dependency-gated-implementation) distinguish settled requirements from open protocols. Resolve each identity, Trace/Git, lifecycle, custody, effect or sharing contract before its dependent implementation; unsupported capabilities stay unavailable. Source [layout](.changekernel/wiki/items/product/changekernel.md#repository-representation) and [first-delivery criteria](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) do not authorize relocation, migration or controller adoption.

Four focused contracts carry substantial detail:

- [State, persistence and recovery](.changekernel/wiki/items/system/components/state.md)
- [Checks and assessment reuse](.changekernel/wiki/items/system/components/checks.md)
- [Execution and custody](.changekernel/wiki/items/system/components/agent-execution.md)
- [Release qualification and controller boundaries](.changekernel/wiki/items/system/components/package.md)

The retained `wiki/` path stores source design; it does not require a runtime Wiki subsystem or Markdown State. Prior committed pages remain in Git history; uncommitted draft material is folded into the consolidated design, not a parallel active specification. Examples are illustrative, not exported interfaces or measured performance claims.

## Executable foundation

The private supporting package is `@nunomoura/changekernel`; the native executable is `changekernel`. The npm entrypoint exports only Pi model/provider/session/runtime bridges and their required protocol/codec dependencies. It does not export an engine, Project Server, intake/candidate client or launcher.

Historical TypeScript lifecycle, Git/Wiki, console and SQLite scaffolding has been removed. Git preserves its implementation and retired tests; neither is a native feature-parity target. Native SQLite intent revision appends are implemented; concrete file-candidate custody remains blocked and unintegrated. Existing SQLite profiles stay unchanged for the file-first delivery; there is no new schema extension, automatic migration or candidate-writer integration. The shared retained-attribution defect is not repaired or accepted by choosing a new architecture. The [private continuation profile](.changekernel/wiki/items/system/components/state.md#native-private-continuation-profile) defines their bounded contract, not release qualification.

The Rust library separately exposes `Intake`, `SqliteIntake`, `Proposal`, `Receipt`, and `Issue` for the [bounded native intake contract](.changekernel/wiki/items/system/components/state.md#native-rust-intake). A host must authenticate the actor, protect storage, and explicitly initialize or reopen an absolute persistent SQLite path; the launcher remains non-operational. Native intake preserves exact What and optional Why, and reconciles retries without application effects. Its existing container terminology and SQLite layout remain a bounded profile, not the new Workspace/file-first lifecycle or a migration target selected by this documentation.

The continuation profile adds explicit `SqliteIntake::initialize_continuation`, atomic revision-zero custody and verified current/historical intent reads via `read_intent`. `revise_intent` now supports atomic SQLite revision/retry/head writes, exact historical retries and bounded decoding of stored retry references. Existing intake-only files are not upgraded. Candidate types, ports and generic coordination are present, but their SQLite writer is not yet integrated. These interfaces do not grant execution authority.

`GitSourceObserver` and `observe_committed_source` implement [bounded committed-source reads](.changekernel/wiki/items/system/components/state.md#native-committed-source-observations). They recheck container access and return exact selected file bytes/modes/identities or verified absence from an explicit commit. Captured commit/tree/blob bytes must match their Git identities; child execution and cleanup are bounded. Unsupported or corrupt sources and operational failures remain unavailable, not inferred absence or denial. This is neither a live workspace view nor retained assessment grounds, candidate custody, publication or OS containment.

File-first custody, public Kernel stages and candidate Checks, publication, generalized storage/discovery, native Jev operations, durable coordination/recovery, frontend feedback, borrowing/forks, encrypted sharing and cross-Workspace dependencies remain unfinished. Draft persistence and passing source tests do not establish qualified adoption.

## Development and repository truth

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
