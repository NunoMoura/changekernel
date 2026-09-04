# CodeWiki

CodeWiki is a governed development system built around a deterministic Semantic Kernel and one authoritative Project Server. This repository currently contains the clean Kernel foundation, semantic lifecycle reducers, exact Git-backed Wiki reading, bounded derived Views, Product policy, four narrow port contracts, a Project Server binding shell, and a bounded project bootstrap adapter.

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
- a Project Server shell that binds exactly four explicit capabilities without granting transition authority; and
- an atomic bootstrap adapter that creates Domain-free project configuration, empty Wiki and Change state, and digest-verified passive Check Packs.

Check execution, Wiki write commands, lifecycle mutation authority, the public Project Server API, Stage Loops, Preview effects, DSH execution, and Client surfaces remain intentionally unavailable until their governed roadmap milestones are implemented and activated.

## Install and import

The package is private during this transition. Its only executable public entrypoint exposes Product policy and bootstrap; pure Kernel operations remain internal.

```ts
import {
  CODEWIKI_PRODUCT,
  CODEWIKI_PRODUCT_POLICY_DIGEST,
  bootstrapCodewikiProject,
} from "@nunomoura/codewiki";
```

No `./project-server`, `./runtime`, `./checks`, or Pi extension subpath is published by this foundation.

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

The Project Server is the sole future semantic control plane. Ports report or perform bounded effects but never grant lifecycle authority:

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
