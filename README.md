# CodeWiki

CodeWiki is a governed development system built around a deterministic Semantic Kernel and one authoritative Project Server. This repository currently contains the clean Kernel foundation, semantic lifecycle reducers, exact Git-backed Wiki reading, bounded derived Views, Product policy, authenticated read-only Project Server and Client SDK surfaces, four narrow port contracts, and a bounded project bootstrap adapter.

The package remains `@nunomoura/codewiki`. This foundation deliberately removes the previous Domain, KB/OKF, Backend compatibility, Runtime Build compatibility, migration, provider, and Pi-extension implementation rather than carrying those systems behind aliases. Git history and sealed release evidence preserve the obsolete implementation.

## Current foundation

The active source tree contains:

- deterministic canonical-value decoding and encoding with explicit limits and typed failures;
- pure SHA-256, lowercase Base32, semantic digest, and semantic identity primitives;
- native `codewiki.component:ownership` interpretation;
- explicit provenance isolation for every `codewiki.legacy:*` attribute;
- append-only Change reduction, Work planning, active Check selection, Gate reduction, and disposable Work status;
- a versioned Project Store for exact snapshots, trees, blobs, commit creation, and expected-head updates, alongside narrow Check Runner, Agent Runtime, and Preview ports;
- canonical Wiki files, complete relationship and retired-ID validation, atomic transaction post-state, and deterministic bounded list, get, dictionary, search, graph, history, attribution, provenance-inspection, and semantic-diff Views;
- exact Git fallback whenever optional private Wiki indexes are absent, stale, invalid, or forged;
- immutable Product policy that binds semantic roots, lifecycle stages and roles, port identities, and passive Check Pack resources;
- an authenticated Project Server that composes the qualified Project Store and Check Runner, resolves one exact source, applies Actor authorization/redaction, retains bounded request replay, and serves Project, Wiki, Change, Decision, Check, Result, Work, Review, Alignment, and explicit audit reads;
- a version-neutral Client SDK over digest-bound `codewiki.product-request@1.0.0` and `codewiki.product-response@1.0.0` envelopes, with normal results restricted to Changes, status, Work, Checks, Decisions, next actions, and required user actions;
- typed unavailable Agent Runtime and Preview capabilities until qualified adapters exist; and
- an atomic bootstrap adapter that creates Domain-free project configuration, empty Wiki and Change state, and digest-verified passive Check Packs.

Check execution commands, Wiki writes, lifecycle mutation authority, Stage Loops, Preview effects, and DSH execution remain intentionally unavailable until their governed roadmap milestones are implemented and activated.

## Install and import

The package is private during this transition. Its single curated entrypoint exposes Product policy, bootstrap, Project Server composition, access-policy construction, and the semantic Client SDK; pure Kernel operations and adapter/store handles remain internal.

```ts
import {
  CODEWIKI_PRODUCT,
  CODEWIKI_PRODUCT_POLICY_DIGEST,
  bootstrapCodewikiProject,
  createCodewikiClient,
  createProductTransportRequest,
  createProjectAccessPolicy,
  createProjectServer,
  decodeProductTransportResponse,
} from "@nunomoura/codewiki";
```

Custom transport Clients can use `createProductTransportRequest` and `decodeProductTransportResponse` without importing Kernel internals. Normal Client methods are `discover`, `capabilities`, `status`, `wiki`, `changes`, `checks`, `work`, `review`, and `alignment`. `audit` is the explicit technical-evidence read. Every call supplies a repository identity, request identity, expiry, and authenticated proof; state reads additionally select an exact or once-resolved source and carry operation-specific bounds. No `./project-server`, `./runtime`, `./checks`, or Pi extension subpath is published.

## Bootstrap

Bootstrap targets an existing non-symbolic Git project directory whose `.git` state is present and whose `.codewiki` and `.codewiki.bootstrap` paths are both absent.

```ts
const result = await bootstrapCodewikiProject({
  projectRoot: "/absolute/path/to/project",
  project: "example-project",
});

if (!result.ok) {
  console.error(result.error.code, result.error.message);
}
```

A successful bootstrap creates:

```text
.codewiki/
├── config.json
├── check-packs.lock.json
├── check-packs/
├── changes/
└── wiki/items/
```

The Wiki and Change directories are semantically empty. Check Pack files are copied as passive resources only; bootstrap never executes package lifecycle code, Skills, Checks, Agents, or arbitrary commands. Existing managed state causes a typed conflict and remains untouched.

The bootstrap never creates `.codewiki/kb/`, `.codewiki/traces/`, `.codewiki/runtime/`, `.codewiki/views/`, generated indexes, project-local executable Plugin paths, or controller state.

## Architecture boundary

The Kernel imports only bounded deterministic Kernel modules. It has no filesystem, Git, process, network, provider, UI, clock, randomness, adapter, or environment access. Expected validation failures return typed outcomes.

The Project Server is the sole semantic control plane. It currently binds Project Store and Check Runner internally while reporting Agent Runtime and Preview as unavailable; no Client receives any port or adapter handle. Ports report or perform bounded effects but never grant lifecycle authority:

1. Project Store
2. Check Runner
3. Agent Runtime
4. Preview

Product policy and tracked Project configuration authorize capabilities. Gates report facts; they do not authorize transitions. Product N remains the external controller throughout the SK3 transition, so this candidate never governs, qualifies, admits, completes, activates, or promotes itself.

## Development

Requires Node.js 22.19.0 or newer.

```bash
npm ci
npm test
npm run build
npm run test:pack
npm run audit:codewiki
```

Architecture tests enforce the exact source, test, and package-export allowlists; zero dependency cycles; Kernel purity; forbidden legacy reachability; native ownership uniqueness; and unchanged canonical Wiki/Change state.

See [`SEMANTIC_KERNEL_PLAN.md`](SEMANTIC_KERNEL_PLAN.md) for governed milestone order. Desired Product and System behavior lives under [`.codewiki/wiki/`](.codewiki/wiki/). Executable behavior lives under [`src/`](src/) and [`tests/`](tests/).

## License

MIT
