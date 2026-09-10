# CodeWiki

CodeWiki is a knowledge-and-change collaboration hub for humans and AI Agents across software, operations, research and other teams. It preserves justified, revisable understanding rather than requiring participants to restart inquiry from memory alone.

**This is source development, not an operationally qualified dogfood release.** Desired behavior is not a claim of current implementation. [SEMANTIC_KERNEL_PLAN.md](SEMANTIC_KERNEL_PLAN.md) owns the active scope, gaps, procedures and validation status.

## Core model

- **Change** is the primary mechanism of evolution, carrying intent, reasons, alternatives, inquiry and outcomes. Accepted scoped transitions govern adoption, revision, retirement and re-adoption.
- **Wiki** is current accepted knowledge in tracked Project Markdown, wherever it lives—not a special authoring folder or disposable model output. It retains concise grounds, conditions and uncertainty.
- **Git is foundational**, preserving exact Wiki outcomes, intent-bearing Change records and native history. It is not an optional data connector. GitHub is an optional hosting integration and competing collaboration product.

Hot Wiki is the current validation basis, not every page loaded into every prompt. Retired knowledge remains available as cold information through native Git history. Optional external connectors extend available material from users' databases and services. No separate Archive/Sources knowledge system or duplicate history database is required; the core works without external data connectors. Retrieval and context eviction do not change adoption status.

Decision, Planning, Implementation and Review share one semantic foundation. Findings distinguish supported, contradicted and unresolved claims with scope and evidence. Tests and model judgments have limits; committing a procedure does not prove adoption. Ordinary Markdown/Obsidian workflows need no proprietary frontmatter, mandatory IDs or parallel Skills/Check Pack policy system.

See [product](.codewiki/wiki/items/product/codewiki-console.md), [Wiki](.codewiki/wiki/items/system/components/wiki.md), [Change](.codewiki/wiki/items/system/components/change-trace.md), [validation](.codewiki/wiki/items/system/components/checks.md), and [information/evidence](.codewiki/wiki/items/system/components/evidence.md).

## Executable foundation

The private package remains `@nunomoura/codewiki`. Source includes bounded deterministic contracts/identities, exact Wiki transactions/views, Change reduction and Work dependencies, legacy Check/Gate mechanics, a [Git Project Store](src/adapters/git/project-store.ts), authenticated [Project Server](src/server/index.ts), [Client SDK](src/api/client/index.ts), and partial execution/recovery adapters. [src/index.ts](src/index.ts), [package.json](package.json) and tests define actual exports.

Current structural validation and field/body diff are not the target consequential evaluator. Local Check/Agent execution is unavailable; process-local facts and injected/replay tests do not establish durable semantic continuation or operational qualification. The new hot/cold adoption and retrieval contracts remain implementation work in the plan.

The reader still requires canonical envelopes under `.codewiki/wiki/items/`; explicit bootstrap creates that tree, `.codewiki/changes/`, config and an empty Check Pack lock. This is executable behavior, not the authoring destination. Do not flatten paths, strip envelopes, delete policy, re-bootstrap existing state or invent historical Changes. Reader/writer changes and separately authorized live conversion need their own evidence; current controller/state compatibility remains unresolved.

## Development

Requires Node.js 22.19.0 or newer. Within an approved native scope:

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Use proactive diagnostics and actual exit status. Native tests prove their asserted conditions, not release readiness. Architecture guards and imported suites must evolve deliberately rather than be weakened to hide changes.

Pack/test candidates only in disposable external projects with isolated Pi settings. This mutable checkout never governs itself: do not load CodeWiki from it or its `.pi/`, invoke `wiki_*` tools or `/wiki-*` commands here, or add local package links, duplicate skills or controller pins. Protected effects and release/controller transitions need applicable explicit authority; the plan supplies the procedure. A build or documentation checkpoint does not grant them.

## Repository truth

- [`.codewiki/wiki/`](.codewiki/wiki/): stable desired behavior; supported envelopes and provenance remain until a scoped transition changes them.
- [`.codewiki/changes/`](.codewiki/changes/): governed lifecycle history.
- [`SEMANTIC_KERNEL_PLAN.md`](SEMANTIC_KERNEL_PLAN.md): the sole active roadmap and status ledger, with exact Git references for cold historical evidence.
- [`src/`](src/) and [`tests/`](tests/): executable truth. Git preserves exact history; [existing archives](docs/archive/README.md) are historical evidence, not active queues.

Private runtime state, generated views, caches, credentials and package artifacts are not source truth. Future implicit Markdown discovery does not reclassify every file in this source checkout as governing policy.

## License

MIT
