---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:agent.retrieve-bounded-context","codewiki_user":"cw:user:agent","description":"An agent wants one immutable authorized Run Context Bundle with bounded local queries and no live authority or hidden ambient state.","status":"stable","tags":["product","story","query"],"title":"Retrieve Bounded Context","type":"User Story"},"codewiki.legacy:source-path":"product/stories/agent/retrieve-bounded-context.md"},"itemId":"cw:story:agent.retrieve-bounded-context","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:2a1297f7c00e1bf4c62774de32db94f76212b6dfe1ed67af241488c9846752db","codewiki.legacy:source-path":"product/stories/agent/retrieve-bounded-context.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:agent.retrieve-bounded-context"}],"relationships":[],"title":"Retrieve Bounded Context"}
---
# Retrieve Bounded Context

As an agent, I want compact current-stage context and lazy exact local queries so I can act safely without loading raw project history, blocking on Project Server query round trips, trusting stale conversation memory, or inventing missing facts.

## Acceptance signals

- Project Server replays canonical owners, rebuilds WorkState, then materializes one immutable authorized Run Context Bundle from exact Git/Wiki/Trace bytes, WorkState, Alignment, active Changes, Work Graph, repository content, Evidence, Results, query-engine identity, coverage, and staleness.
- Bundle is producer execution input/evidence, not canonical state, continuity source, or Gate package. Unchanged content-addressed chunks may be reused, but every Run binds one exact bundle digest.
- Producer Run mounts its bundle read-only and queries it locally through typed Wiki, Alignment, project-state, repository, Evidence, Result, batch, and high-level change-delta services.
- Direct, batch, and admitted programmatic queries preserve deterministic ordering, bundle and query-engine identity, source references, coverage, unknowns, truncation, cursor position, call and byte budgets, and exact ledger capture.
- Programmatic queries run only through a fresh fail-closed inner operating-system sandbox with typed lossless-JSON bindings, no recursion, no ambient filesystem, network, environment, credentials, child processes, persistence, DSH Session access, or canonical authority, and exact configuration, substrate, call, byte, output, resource, timeout, and cancellation evidence.
- Native direct, native batch, and secure Code Mode remain workload-specific choices selected by benchmarked traffic reduction and a Candidate-quality floor; Code Mode is not a universal replacement for native tools.
- Bundle never changes inside its Run. Changed canonical input, WorkState, authorization, freshness, engine, capabilities, or handles requires a fresh Run and physical Session. Every query binds its bundle; retained prior bundles are reproducible execution Evidence only.
- Producer context permits no ambient live-working-tree fallback, Project Server storage handle, unrestricted network, credentials, environment, or unlogged dynamic context.
- Candidate checkpoint freezes output. Project Server then builds a separate immutable Gate Evaluation Package containing only declared exact Candidate, canonical/proposal Git commits, derived Wiki tree, Change, WorkState, Alignment, Evidence, Result, Check Pack, configuration, and route inputs.
- Formal Model Checks are fresh, isolated, tool-free, and receive no producer Run Context Bundle handle, query tools, Session, or memory.
- Every CodeWiki-controlled model-visible input and query is bound to Execution Ledger and Run Receipt; delegated routes identify context they cannot prove.
- Run Continuation binds authority, canonical rehydration, Gate feedback, unresolved Completion Requirements, and reserves. DSH may compact model surface only inside one in-flight Run while preserving raw history; cross-Run memory comes only from exact canonical state and predecessor Receipt.
- Backend-v1 Project Context Snapshot and legacy `StageContextBundle` artifacts remain isolated qualification/evidence only; target producer Runs accept only their authorized mounted Run Context Bundle and typed local services.
