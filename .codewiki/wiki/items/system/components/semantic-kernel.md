---
{"aliases":["Kernel"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/kernel/canonical/**","src/kernel/identity/**","src/kernel/index.ts"],"testPatterns":["tests/kernel/canonical/**","tests/kernel/identity/**","tests/kernel/invariants/**"]}},"itemId":"cw:component:semantic-kernel","itemType":"codewiki.system:component","protocol":"codewiki.wiki-item@1.0.0","provenance":[],"relationships":[{"attributes":{"codewiki.system:rationale":"The Semantic Kernel preserves accepted meaning through deterministic validation and transition invariants."},"predicate":"codewiki.system:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.system:rationale":"The Semantic Kernel freezes exact Check and Gate semantics independently of execution adapters."},"predicate":"codewiki.system:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"},{"attributes":{"codewiki.system:rationale":"The Semantic Kernel makes canonical state replayable without trusting private process memory."},"predicate":"codewiki.system:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Semantic Kernel"}
---
# Semantic Kernel

Semantic Kernel is CodeWiki's small deterministic mechanism layer. It validates canonical values, stable identities, Wiki Items, Change operations, Work facts, Gates, Results, Evidence references, and lifecycle transition preconditions. It reduces exact immutable inputs to typed state, decisions, required effects, or explicit failures. It is not a daemon, Project Server, Client, Agent runtime, scheduler, provider, persistence engine, or second semantic controller.

## Dependency boundary

Kernel code imports only bounded deterministic Kernel modules. It does not import filesystem, Git process, network, DSH, provider, UI, Preview, package-manager, environment, credential, wall-clock, randomness, or adapter implementations. Time, identity, limits, Product-fixed role/check policy, Project policy, and external observations enter as explicit validated values. Product-fixed policy is immutable build-bound data, not executable prompts or effectful Checks inside the pure Kernel. Mutable globals, ambient configuration, dynamic Plugins, and moving source selectors are forbidden.

Project Server owns AuthZ, orchestration, current expected heads, effect ordering, and recovery policy. It supplies canonical exact inputs to Kernel mechanisms, receives typed outcomes, revalidates current authority and freshness, then invokes narrow ports. Project Store, Check Runner, Agent Runtime, and Preview adapters implement effects without changing Kernel meaning. No adapter, Client, Check, DSH Run, Preview handle, or project file can call an internal Kernel path to grant itself authority.

## Determinism and bounds

Every external value is decoded, normalized, and bounded before use. Canonical serialization, digest inputs, ordering, identifier comparison, reduction, and transition output are deterministic for the same explicit inputs. State variants are exhaustive. Expected failures are typed outcomes rather than inferred success or incidental process exceptions. Unknown protocol, unsupported schema, excess input, missing closure, ambiguous identity, stale source, or contradictory evidence fails closed.

Kernel transition mechanisms never write Git refs or external state. They describe exact preconditions and outputs. Project Server and the Git adapter execute expected-old-OID compare-and-swap only after complete object, authority, Gate, Trace-prefix, and freshness closure. Replay from canonical Git and append-only Trace must produce the same semantic state without private memory.

## Public and internal contracts

Only curated version-neutral semantic operations and explicit versioned envelopes are public. The historically named Kernel API is the Product UAPI served by Project Server; it does not expose direct pure-Kernel invocation or storage/authority bypass. Internal TypeScript types, reducers, helpers, and module paths are private and may evolve without compatibility promises. Public and persisted contracts advertise exact support ranges; unsupported pre-stable internals remain in Git/release history, not active readers.

A System Component's current machine-readable source ownership lives in `codewiki.component:ownership`. Legacy namespaced attributes are provenance available only through exact provenance inspection; normal term resolution, search ranking, semantic diff, ownership, applicability, authorization, Agent context, and generated Views exclude them. Architecture checks enforce the dependency graph, public export manifest, and absence of Kernel-to-adapter edges.

## Hardening obligations

Kernel claims require repeatable evidence over the applicable threat and failure model: examples, properties, model/state-machine exploration, replay, mutation testing of authority branches, malformed and adversarial inputs, concurrency/CAS conflict, crash/fault injection, bounded resource behavior, and deterministic recovery. Structure, line count, typechecking, or test count alone cannot establish correctness.
