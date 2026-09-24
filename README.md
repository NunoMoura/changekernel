# ChangeKernel

**A redistributable State-and-Change engine for applications.**

Developers provide structures and native abilities. Users choose goals. Agents and other workers compose paths. ChangeKernel is designed to govern State evolution, support recovery within declared limits and retain useful learning for people and agents.

The same State and Change primitives connect software development, agent-mediated product use after launch, and ongoing integration and improvement. External tools use supported bindings and the shared authoritative boundary; no particular browser-tool framework is required. User goals can lead to authorized development without automatically granting permission to change software, deploy releases or alter policy.

**This is source development, not a qualified operational release.** The approved direction is a new Rust product with narrow TypeScript integrations, not a feature-parity port of the current prototype. Rust implementation, generalized containers and the complete lifecycle are not implemented. See [temporary status](CHANGEKERNEL_STATUS.md).

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

The private package is `@nunomoura/changekernel`; the executable is `changekernel`. [Source exports](src/index.ts), [package metadata](package.json) and tests define what exists. Current foundations include deterministic identities/contracts, managed Wiki transactions, Git-backed proposals, private Decision Check execution/retention and an authenticated limited [Project Server](src/server/index.ts).

The historical Project Server supports discovery/capabilities, managed-document proposal and Changes get. Its other operations report unavailable; the console remains read-only. Those Git/Wiki protocol meanings are unchanged.

Separate library interfaces now support owned intake and Change-owned multi-entity candidate batches in application-supplied SQLite storage. `createContainerIntakeClient` retains What/Why; `createContainerCandidateClient` installs draft definitions, describes generic coverage, prepares batches and reads them by candidate identity. A batch retains exact proposed values, relationships and version-bound source observations without writing managed values. Repeated requests reconcile across restart; a Change can retain multiple immutable batches. See the [candidate contract](.changekernel/wiki/items/system/components/state.md#change-owned-multi-entity-candidates) and [executable examples](tests/adapters/sqlite/container-candidate.test.mjs). Node's built-in SQLite interface is experimental; hosts authenticate callers and protect database access.

Full lifecycle progression, Checks on these candidates, publication, generalized storage/discovery, native Jev operations, durable factory/recovery, frontend feedback and cross-container dependencies remain unfinished. Draft persistence and passing source tests do not establish qualified adoption.

## Development and repository truth

Requires Node.js 22.19.0 or newer. Within approved source-development scope:

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Use [AGENTS.md](AGENTS.md), native coding tools, diagnostics and tests. Architecture guards evolve deliberately; passing tests/builds are not operational qualification. Pack/test candidates only in disposable external projects with isolated Pi settings.

**Never load this mutable checkout as its own controller.** Do not call ChangeKernel `wiki_*` tools or `/wiki-*` commands here, install it under repository `.pi/`, or create local package links, duplicate skills or controller pins. Later governed Changes/Work require a qualified immutable external release, activation and explicit handoff; an unavailable designated controller never falls back to source.

- [`.changekernel/wiki/`](.changekernel/wiki/) owns desired design, not fabricated managed adoption.
- [`.changekernel/changes/`](.changekernel/changes/) owns governed lifecycle history; existing records remain unchanged.
- [`src/`](src/) and [`tests/`](tests/) own executable truth; Git preserves history/checkpoints.
- [`CHANGEKERNEL_STATUS.md`](CHANGEKERNEL_STATUS.md) is a short temporary gap note, not a roadmap. Change/Work replaces it after qualified adoption.
- [Archives](docs/archive/README.md) are historical evidence, not active plans.

Generated views, private runtime state, credentials, caches, sockets, worktrees and package artifacts are not source truth. Documentation approval is not implementation, release activation or controller handoff.

## License

MIT
