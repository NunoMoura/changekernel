# CodeWiki

CodeWiki develops Git-compatible version control for humans and Agents: stock Git owns exact artifacts and history, Wiki owns desired meaning, a deterministic Semantic Kernel validates semantic contracts, and Project Server owns authorization and orchestration. This repository contains tested mechanisms for that design, not yet an operationally qualified dogfood release. Maintainer-approved R1 in [SEMANTIC_KERNEL_PLAN.md](SEMANTIC_KERNEL_PLAN.md) governs the current native cleanup.

The package remains `@nunomoura/codewiki`. This foundation deliberately removes the previous Domain, KB/OKF, Backend compatibility, Runtime Build compatibility, provider, and Pi-extension implementation rather than carrying those systems behind aliases. Git history and sealed release evidence preserve the obsolete implementation.

## Current foundation

The active source tree contains:

- shared [data contracts](src/kernel/data-contracts/): bounded canonical JSON, field/protocol validation, and typed success/failure values;
- pure SHA-256, lowercase Base32, semantic digest, and semantic identity primitives;
- native `codewiki.component:ownership` interpretation;
- explicit provenance isolation for every `codewiki.legacy:*` attribute;
- append-only Change reduction, Work planning, active Check selection, Gate reduction, and disposable Work status;
- a versioned Project Store for exact snapshots, trees, blobs, commit creation, and expected-head updates, alongside narrow Check Runner, Agent Runtime, and Preview ports;
- canonical Wiki files, complete relationship and retired-ID validation, atomic transaction post-state, and deterministic bounded list, get, dictionary, search, graph, history, attribution, provenance-inspection, and semantic-diff Views;
- exact Git fallback whenever optional private Wiki indexes are absent, stale, invalid, or forged;
- immutable Product policy that binds semantic roots, lifecycle stages and roles, port identities, and project-owned Check selection;
- an authenticated Project Server that composes Project Store, Check Runner, and Gate-facts ports, with memory-backed facts in the local composition; resolves one exact source; applies Actor authorization and redaction; retains bounded request replay; serves Project, Wiki, Change, Decision, Check, Result, Work, Review, Alignment, and explicit audit reads; and owns bounded local lifecycle mutation;
- atomic Change proposal and revision, Decision, Planning, Work admission and integration, Review reconciliation, completion, supersession, and separately authorized protected-effect commands with exact expected-head binding and deterministic recovery;
- a version-neutral Client SDK over digest-bound `codewiki.product-request@1.1.0` and `codewiki.product-response@1.1.0` envelopes, with normal results restricted to Changes, status, Work, Checks, Decisions, next actions, and required user actions;
- host-neutral Agent Runtime and Preview ports with partial local adapters and replay/injected-runner tests, not operational qualification; and
- an atomic bootstrap adapter that creates Domain-free project configuration, empty Wiki and Change state, and an explicit empty Check Pack lock without seeded definitions.

Wiki mutation and lifecycle transition mechanisms have ordinary test coverage. The shipped local composition has no available Check Runner or coding Worker; DSH tool-enabled execution, durable recovery, and safe Preview execution remain incomplete. Custom policy selection and empty-policy warnings have native tests; actual Check execution remains an injected test boundary. Bundled/internal Check definitions and the historical handoff helper are absent from normal shipping. Passing tests, historical release reports, and package version labels do not establish current operational readiness or controller authority.

## Install and import

The package is private during this transition. Its single curated entrypoint exposes Product policy, bootstrap, Project Server composition, access-policy construction, and the semantic Client SDK; pure Kernel operations and adapter/store handles remain internal.

```ts
import {
  CODEWIKI_PRODUCT,
  CODEWIKI_PRODUCT_POLICY_DIGEST,
  bootstrapCodewikiProject,
  createCodewikiClient,
  createProductTransportRequest,
  createMemoryProjectServerFacts,
  createProjectAccessPolicy,
  createProjectServer,
  decodeProductTransportResponse,
} from "@nunomoura/codewiki";
```

Custom transport Clients can use `createProductTransportRequest` and `decodeProductTransportResponse` without importing Kernel internals. Normal Client reads are `discover`, `capabilities`, `status`, `wiki`, `changes`, `checks`, `work`, `review`, and `alignment`; lifecycle methods cover proposal through completion, supersession, and protected effects. `audit` is the explicit technical-evidence read. Every call supplies a repository identity, request identity, expiry, and authenticated proof; state reads additionally select an exact or once-resolved source and carry operation-specific bounds. No `./project-server`, `./runtime`, `./checks`, or Pi extension subpath is published.

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
├── changes/
└── wiki/items/
```

This is the current executable layout. The desired flat `.codewiki/wiki/**` Item tree is documented in Wiki; reader/writer changes and separately authorized existing-state conversion remain R1-5 work. Do not flatten an existing project manually or infer migration support from the design.

The Wiki and Change directories are semantically empty. The lock explicitly contains `packages: {}`; no Check Pack files are copied. Bootstrap never executes package lifecycle code, Skills, Checks, Agents, or arbitrary commands. Existing managed state causes a typed conflict and remains untouched.

Custom Checks require explicit project adoption with matching files and lock digests. Editing or removing policy must update both coherently; bootstrap is not a policy-repair operation. A fully resolved empty Gate reports `empty_check_policy` and explains that no semantic Check verdict was produced. Missing/malformed policy or unavailable required execution fails closed.

The bootstrap never creates `.codewiki/kb/`, `.codewiki/traces/`, `.codewiki/runtime/`, `.codewiki/views/`, generated indexes, project-local executable Plugin paths, or controller state.

`createLocalProjectServer` and the read-only CLI do not initialize or repair projects. Composition requires an existing non-symbolic root with its own non-symbolic `.git` directory or file, and binds read interfaces without creating `.codewiki`. Initialize a new project explicitly through `bootstrapCodewikiProject` when intended. Binding availability—and current empty-state status projections—does not establish resolved Check policy or operational readiness. Reads retain exact-source validation; malformed state is never an instruction to re-bootstrap. Read-only authorization grants, not executor unavailability alone, prevent lifecycle mutations.

## Architecture boundary

The Kernel imports only bounded deterministic Kernel modules. `src/kernel/data-contracts/` owns data representation and validation, not canonical Git authority or lifecycle policy. It has no filesystem, Git, process, network, provider, UI, clock, randomness, adapter, or environment access. Expected validation failures return typed outcomes.

The Project Server is the sole semantic control plane. It binds Project Store, Check Runner, and owner-private immutable Gate facts internally while reporting Agent Runtime and Preview as unavailable; no Client receives any port, fact-store, adapter, credential, ref, or raw writer handle. Ports report or perform bounded effects but never grant lifecycle authority:

1. Project Store
2. Check Runner
3. Agent Runtime
4. Preview

Gate facts remain a separate Project Server recovery boundary rather than a Client capability or authority source.

Project Server enforces capability policy; Gates report facts rather than authorize transitions. R1 permits native development checkpoints without controller swaps or inherited rubric execution. Independent exact-subject qualification and explicitly authorized handoff remain required before dogfooding; this mutable checkout never governs or qualifies itself.

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

See [`SEMANTIC_KERNEL_PLAN.md`](SEMANTIC_KERNEL_PLAN.md) for approved R1 scope, incomplete work, and the acceptance matrix. Desired Product and System behavior lives under [`.codewiki/wiki/`](.codewiki/wiki/). Executable behavior lives under [`src/`](src/) and [`tests/`](tests/). [Archived plans](docs/archive/README.md) are byte-preserved historical evidence, not current guidance.

## License

MIT
