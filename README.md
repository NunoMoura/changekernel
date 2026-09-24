# ChangeKernel

**A redistributable State-and-Change engine for applications.**

Developers provide structures and native abilities. Users choose goals. Agents and other workers compose paths. ChangeKernel is designed to govern State evolution, support recovery within declared limits and retain useful learning for people and agents.

The same State and Change primitives connect software development, agent-mediated product use after launch, and ongoing integration and improvement. External tools use supported bindings and the shared authoritative boundary; no particular browser-tool framework is required. User goals can lead to authorized development without automatically granting permission to change software, deploy releases or alter policy.

**This is source development, not a qualified operational release.** The approved direction is a new Rust product with narrow TypeScript integrations, not a feature-parity port of the historical prototype. Bounded native intake and committed-source observations are implemented; generalized containers and the complete lifecycle are not implemented. See [temporary status](CHANGEKERNEL_STATUS.md).

## Design

Start with the [primary architecture](.changekernel/wiki/items/product/changekernel.md): the complete agreed model, developer examples, responsibilities, boundaries and unresolved decisions.

**Container definition → Container → Changes to State.** A container is a durable ownership and collaboration scope, not one entity, database or Docker container. Existing application data remains authoritative; the application's supported database is the default ChangeKernel store. Discovery reuses schemas and native handlers.

**Decision + Execution** are the approved public lifecycle phases. Intake captures and refines proposals internally; Decision admits bounded planning and pursuit. Execution includes planning, guarded effects, observation, recovery and outcome review. Proposal, pre-effect and observed-outcome assessments remain distinct; domain Checks can apply to all of them. Deployment is a supported activity where needed, not a universal final stage.

Changes retain exact intent, revisions and experience; State retains current adopted knowledge and procedures with uncertainty and provenance. Sources are consumed on demand, and required research/assessment grounds are retained rather than replaced by competing `intent.md` files or a current-state mirror. Memory adoption uses the same Change controls. The [approved repository layout](.changekernel/wiki/items/product/changekernel.md#repository-representation) and [first self-development release criteria](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus) prioritize one qualified external controller with practical terminal visibility and controls. Neither source relocation nor lifecycle migration is implied by these design decisions.

Four focused contracts carry substantial detail:

- [State, persistence and recovery](.changekernel/wiki/items/system/components/state.md)
- [Checks and assessment reuse](.changekernel/wiki/items/system/components/checks.md)
- [Execution and custody](.changekernel/wiki/items/system/components/agent-execution.md)
- [Release qualification and controller boundaries](.changekernel/wiki/items/system/components/package.md)

The retained `wiki/` path stores source design; it does not require a runtime Wiki subsystem or Markdown State. Prior committed pages remain in Git history; uncommitted draft material is folded into the consolidated design, not a parallel active specification. Examples are illustrative, not exported interfaces or measured performance claims.

## Executable foundation

The private supporting package is `@nunomoura/changekernel`; the native executable is `changekernel`. The npm entrypoint exports only Pi model/provider/session/runtime bridges and their required protocol/codec dependencies. It does not export an engine, Project Server, intake/candidate client or launcher.

Historical TypeScript lifecycle, Git/Wiki, console and SQLite scaffolding has been removed. Git preserves its implementation and retired tests; neither is a native feature-parity target. Native candidate custody is not implemented; the [candidate contract](.changekernel/wiki/items/system/components/state.md#change-owned-multi-entity-candidates) describes desired behavior, not an exported native capability.

The Rust library separately exposes `Intake`, `SqliteIntake`, `Proposal`, `Receipt`, and `Issue` for the [bounded native intake contract](.changekernel/wiki/items/system/components/state.md#native-rust-intake). A host must authenticate the actor, protect storage, and explicitly initialize or reopen an absolute persistent SQLite path; the launcher remains non-operational. Native intake preserves exact What and optional Why, and reconciles retries without application effects. It is not the TypeScript reference interface or a generalized container lifecycle.

`GitSourceObserver` and `observe_committed_source` implement [bounded committed-source reads](.changekernel/wiki/items/system/components/state.md#native-committed-source-observations). They recheck container access and return exact selected file bytes/modes/identities or verified absence from an explicit commit. Captured commit/tree/blob bytes must match their Git identities; child execution and cleanup are bounded. Unsupported or corrupt sources and operational failures remain unavailable, not inferred absence or denial. This is neither a live workspace view nor retained assessment grounds, candidate custody, publication or OS containment.

Full lifecycle progression, Checks on these candidates, publication, generalized storage/discovery, native Jev operations, durable factory/recovery, frontend feedback and cross-container dependencies remain unfinished. Draft persistence and passing source tests do not establish qualified adoption.

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
