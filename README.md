# CodeWiki

CodeWiki is a knowledge-and-change collaboration hub for humans and AI Agents across teams. It preserves enough justified, revisable knowledge that people do not restart inquiry from memory alone.

Git supplies exact content, snapshots, ancestry, branches, merges, and transport. CodeWiki adds semantic interpretation, validation, authority, deliberation, and continuity above that substrate. GitHub is an optional integration and a competing collaboration product, not the definition of a Change or its acceptance. Software, operations, research, and other team work share the same core.

**This repository is source development, not an operationally qualified dogfood release.** The desired behavior below is not a claim that the current package implements it. The current documentation/source gap, parked work, and sole active sequence are recorded in [SEMANTIC_KERNEL_PLAN.md](SEMANTIC_KERNEL_PLAN.md).

## Two primitives

- **Wiki** consolidates project knowledge: scoped assertions, adopted decisions, obligations, procedures, their grounds, and explicit uncertainty. A Wiki state is the Wiki at a revision, not another managed entity.
- **Change** carries intent and its evolution: desired effects, motivation, assumptions, alternatives, deliberation, plans, attempts, evidence, and outcomes. Wiki retains adopted consequences with provenance back to their reasons.

Decision, Planning, Implementation, and Review are four retained inquiry loops with one semantic foundation. Validation distinguishes intent fit, consistency, reachability, preservation, justification, and authority. Findings are supported, contradicted, or unresolved with reasons and evidence—not a universal score or a promise that model judgments are proofs.

The target corpus includes tracked Markdown wherever it lives, without mandatory proprietary frontmatter, document IDs, or a special import directory. Ordinary editors and Obsidian-compatible files remain first-class. Discovery does not give quotations, fixtures, proposed rules, and current commitments equal authority. Procedural knowledge belongs in Wiki; tests and other verification methods remain useful without separately authored project Skills or Check Packs.

See the [product contract](.codewiki/wiki/items/product/codewiki-console.md), [Wiki](.codewiki/wiki/items/system/components/wiki.md), [Change](.codewiki/wiki/items/system/components/change-trace.md), [kernel](.codewiki/wiki/items/system/components/semantic-kernel.md), and [validation](.codewiki/wiki/items/system/components/checks.md).

## What exists in source

The private package remains `@nunomoura/codewiki`. Existing mechanisms include:

- bounded deterministic [data contracts](src/kernel/data-contracts/) and [identity primitives](src/kernel/identity/);
- exact Wiki envelopes, ownership/provenance handling, transaction validation, bounded views and immutable Git fallback;
- intent/rationale-bearing Change contracts, append-only lifecycle reduction, Work dependencies, Check selection and Gate reduction;
- a [Git Project Store](src/adapters/git/project-store.ts), expected-head operations, authenticated [Project Server](src/server/index.ts), [Client SDK](src/api/client/index.ts), and read-only CLI;
- partial host-neutral execution/evidence interfaces, DSH and Preview adapters, and process-local recovery facts; and
- native tests for these mechanisms, including replay and injected-runner fixtures rather than operational qualification.

These mechanisms are being assessed for retention, adaptation, replacement, or deferral. Current structural validation and field/body diff are not the target consequential semantic evaluator. The shipped local composition has unavailable Check/Agent execution; durable fresh-process recovery and the new semantic loop are not qualified. An empty legacy Gate is not semantic assurance.

The existing reader still requires canonical envelopes under `.codewiki/wiki/items/`; explicit bootstrap creates that tree, `.codewiki/changes/`, versioned config, and an empty Check Pack lock. This is current executable behavior, **not** the new authoring destination. Do not flatten paths, strip envelopes, re-bootstrap existing state, delete policy files, or fabricate historical Changes. The target reader/writer/adoption transition must be implemented and validated before any separately authorized live conversion. Historical Trace compatibility and controller evidence remain unresolved in the plan.

The curated package entrypoint and exact exported APIs are defined by [src/index.ts](src/index.ts), [package.json](package.json), and their tests. No source-checkout Pi extension or project-local CodeWiki installation is supported. Current API names and package labels do not establish semantic readiness or runtime authority.

## Development and trust boundaries

Requires Node.js 22.19.0 or newer. Ordinary native development uses:

```bash
npm ci --ignore-scripts
npm test
npm run build
```

Use proactive diagnostics and inspect actual exit status. Passing native tests proves only their asserted conditions. The architecture suite includes additional Change, Gate, Work and Evidence suites through imports; its file/export/ownership guards must evolve deliberately with supported behavior, not be weakened to hide changes.

Pack and test release candidates only in disposable external projects with isolated Pi settings. No package freeze, activation or controller handoff follows from a build or documentation checkpoint. Candidate N+1 never governs itself. Do not load CodeWiki from this mutable checkout or its `.pi/`, call CodeWiki `wiki_*` tools or `/wiki-*` commands here, or add local package links, executable Plugin paths, duplicate skills or controller pins.

Protected effects require applicable authority before execution. Worktrees are not sandboxes. Git checkpoints, semantic assessments, acceptance, realization, publication and deployment are distinct. Preserve exact historical states and judgments; do not reconstruct them by rerunning models or external effects.

## Repository truth

- [`.codewiki/wiki/`](.codewiki/wiki/) is desired-state design truth. Its retained envelopes and identities are not a proprietary-authoring requirement for future adopters.
- [`.codewiki/changes/`](.codewiki/changes/) preserves governed lifecycle history; do not rewrite it as refactoring progress.
- [`SEMANTIC_KERNEL_PLAN.md`](SEMANTIC_KERNEL_PLAN.md) is the sole active roadmap, status ledger, qualification record and archive checklist. Start at its current entry point, not an old R1/D4 packet.
- [`src/`](src/) and [`tests/`](tests/) are executable truth; Git is history and checkpoint evidence.
- [Archived plans](docs/archive/README.md) and retained earlier ledger sections are evidence, not competing active queues. Private runtime state, generated views, caches, credentials and package artifacts are not source truth.

## License

MIT
