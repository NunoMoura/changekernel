# ChangeKernel

**The semantic foundation for project change.**

ChangeKernel is a shared project layer for people, agents, harnesses and applications across any domain. Change is its organizing primitive; Wiki retains accepted project knowledge. ChangeKernel is not an agent, a harness or an operating-system kernel.

The local product combines a pure semantic core, Project Server runtime, Wiki, semantic Git management and the Decision, Planning, Implementation and Review lifecycle. It works without a Hub. The optional **Hub** adds shared hosting, team access and collaboration using the same semantic foundation; a GitHub alternative is a longer-term ambition, not an initial feature-parity claim.

**This is source development, not an operationally qualified dogfood release.** Wiki defines desired behavior; source/tests define what exists. The [temporary status](CHANGEKERNEL_STATUS.md) preserves unfinished work, not a separate architectural roadmap.

## Core model

- **Change** is the primary mechanism of evolution, carrying intent, reasons, alternatives, inquiry and outcomes. Accepted scoped transitions govern adoption, revision, retirement and re-adoption.
- **Wiki** is current accepted knowledge in tracked Project Markdown, wherever it lives—not a special authoring folder or disposable model output. It retains concise grounds, conditions and uncertainty.
- **Git is foundational**, preserving exact Wiki outcomes, intent-bearing Change records and native history. It is not an optional data connector. GitHub is an optional hosting integration and competing collaboration product.

Hot Wiki is the current validation basis, not every page loaded into every prompt. Retired knowledge remains available as cold information through native Git history. Optional external connectors extend available material from users' databases and services. No separate Archive/Sources knowledge system or duplicate history database is required; the core works without external data connectors. Retrieval and context eviction do not change adoption status.

Desired design: **Wiki holds what we agree; agents propose and produce changes; ChangeKernel validates the four stages; adopted domain Checks assess project-specific requirements; ChangeKernel controls acceptance and remembers why.** Validation common to all domains belongs to the backend's versioned stage contracts. Domain-specific policy belongs to explicitly adopted Checks and Packs. Either may use computation or bounded semantic assessment; this is an ownership boundary, not a code-versus-model split.

Checks are custom read-only functions; Packs distribute reusable domain evaluators, not a second policy authority or replacements for backend validation. Shared execution machinery preserves distinct ownership, stage, exact inputs and results. The pure core remains deterministic; effectful inference runs outside it under enforced limits. TypeScript/JavaScript comes first; Python and marketplace distribution come later.

Desired/current-state and related-Change views connect accepted outcomes, scoped Evidence and ongoing work. An observation is one way to obtain Evidence, not another product object. Git retains exact Project sources and history; large or sensitive Evidence may use authorized immutable external custody. Neither a commit nor a model assessment proves truth or realization. These revised contracts are desired state, not completed executable capabilities.

See [product](.changekernel/wiki/items/product/changekernel.md), [Wiki](.changekernel/wiki/items/system/components/wiki.md), [Change](.changekernel/wiki/items/system/components/change-trace.md), [validation](.changekernel/wiki/items/system/components/checks.md), and [information/evidence](.changekernel/wiki/items/system/components/evidence.md).

## Executable foundation

The private package is `@nunomoura/changekernel`; its executable is `changekernel`. Source includes bounded deterministic contracts/identities, managed Wiki transactions, Change reduction and Work dependencies, semantic Checks, a [Git Project Store](src/adapters/git/project-store.ts), authenticated [Project Server](src/server/index.ts), [Client SDK](src/api/client/index.ts), and partial execution/recovery adapters. [src/index.ts](src/index.ts), [package.json](package.json) and tests define actual exports.

Concrete profile-native proposals and recovery are checkpointed; the early-inquiry Kernel work is not accepted as complete. The full new-path gated Change lifecycle and external qualification remain unfinished. Structural validation, process-local facts and injected/replay tests do not establish consequential judgment or durable operational continuation.

One [Kernel release version](.changekernel/wiki/items/system/components/changekernel.md#versioning-and-document-contract) owns managed document rules and common stage-validation contracts; there is no separately selectable Wiki or lifecycle profile. `createProjectServer` uses the running `CHANGEKERNEL_VERSION` by default; an explicit `project.kernelVersion` must match it. The `wikiProfile` selector, legacy lifecycle engine, old Wiki envelopes/projections, binary Gate/Work engines, Check Runner port and memory-only Gate store are removed. Obsolete tests and the unused Kernel export file are removed with them; remaining suites run directly through recursive discovery. Available operations are Project discovery/capabilities, managed-document proposal and Changes get. Other operations, including Console status/list projections, report unavailable rather than falling back to old behavior.

Bootstrap creates empty `.changekernel/wiki/` and `.changekernel/changes/` roots plus minimal identity configuration. It seeds no Check Pack, automation policy or adoption record. This source repository's Wiki uses readable source metadata while preserving desired intent and relevant historical information; it is not automatically an adopted Wiki conforming to the new Kernel. Genuine Change traces and Git history remain unchanged. Pre-release implementations can be replaced without permanent compatibility promises; an actual supported deployment requires an explicitly scoped transition.

## Development

Requires Node.js 22.19.0 or newer. Within an approved native scope:

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Use proactive diagnostics and actual exit status. Native tests prove their asserted conditions, not release readiness. Architecture guards and imported suites must evolve deliberately rather than be weakened to hide changes.

Pack/test candidates only in disposable external projects with isolated Pi settings. This mutable checkout never governs itself: do not load ChangeKernel from it or its `.pi/`, invoke `wiki_*` tools or `/wiki-*` commands here, or add local package links, duplicate skills or controller pins. Protected effects and release/controller transitions need applicable explicit authority. A build or documentation checkpoint does not grant them. [Minimum local dogfood](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood) requires a pinned external controller, explicit adoption/authority, one complete governed lifecycle, durable recovery and qualification of the same release bytes. A short agent instruction points to that controller; it cannot replace enforcement.

Work directly in the main session, using [AGENTS.md](AGENTS.md). Product Planning belongs in Change/Work, not standalone plan documents.

## Repository truth

- [`.changekernel/wiki/`](.changekernel/wiki/): stable desired behavior; readable source metadata and historical provenance do not fabricate qualified adoption.
- [`.changekernel/changes/`](.changekernel/changes/): governed lifecycle history.
- [`CHANGEKERNEL_STATUS.md`](CHANGEKERNEL_STATUS.md): short temporary pre-dogfood gap note. Change/Work replaces it after qualified adoption.
- [`src/`](src/) and [`tests/`](tests/): executable truth. Git preserves exact history; [existing archives](docs/archive/README.md) are historical evidence, not active queues.

Private runtime state, generated views, caches, credentials and package artifacts are not source truth. Future implicit Markdown discovery does not reclassify every file in this source checkout as governing policy.

## License

MIT
