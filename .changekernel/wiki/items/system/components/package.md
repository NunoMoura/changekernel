---
title: Package and Release Boundary
aliases: []
source-id: cw:component:package
ownership:
  sourcePatterns:
    - Cargo.toml
    - Cargo.lock
    - rust-toolchain.toml
    - src/lib.rs
    - src/main.rs
    - package-lock.json
    - package.json
    - src/index.ts
    - tsconfig*.json
  testPatterns:
    - tests/package/**
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:1df869bff380ff305c5aef30af2bf64c679d695ff1c0faed2572b4b0305dbd73
        codewiki.legacy:source-path: system/components/package.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:package
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Package supplies CodeWiki, Project Servers, Runtime, first-party Clients, and isolated Run Process entry contracts.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Package transports inspectable npm, Git, and local Check Packs into ordinary project files.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.legacy:relationship:
          rationale: Package transports self-contained authored Checks and optional Pack Skills without making installation an execution environment.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
---
# Package and Release Boundary

The product is one redistributable Rust engine with host/binding integrations and clients. This contract distinguishes routine source checks, evidence for a capability, exact-release qualification, activation and controller handoff. None substitutes for the others.

The first target is a useful **trusted-host engine release**, not a complete autonomous development platform. The [phased plan](../../product/plan.md) owns the single sequence of capability gates. Research, interfaces and documentation do not implement those capabilities.

## Versioning and historical interpretation

An immutable release identifies exact source/build/dependency bytes, protocol interpretation, supported bindings/configuration and host assumptions. Kernel/Check/plan versions and native source identities have separate meanings. Matching labels or hashes do not establish qualification or grant authority.

New JSONL interfaces are explicitly versioned and do not silently replace [retained native profiles](native-profiles.md). Existing SQLite files, `container_id` semantics, retry namespaces, attribution behavior and packet contracts stay unchanged. No schema extension, automatic migration, dual-writing or candidate-writer integration follows from this design review. Known defects and unintegrated paths remain visible.

A supported migration needs exact scope/mapping, collision handling, backup and interruption/recovery evidence. Historical `ProjectSnapshot`, `codewiki.*` and Planning-stage records retain their original interpretation until such a transition. Source cleanup can remove unsupported scaffolding without claiming feature parity or rewriting historical Changes, archives and changelogs.

## Testing policy

Test the implementation that the product will retain: the Rust engine and a small TypeScript boundary to external systems such as Pi. The retired TypeScript engine is historical reference material, not a second implementation to maintain or a parity target. Its Git/Wiki, lifecycle, storage, CLI and engine-composition suites may be removed without claiming that their capabilities have been implemented or qualified in Rust. Git preserves useful incidents and prior cases; recover an applicable case when implementing the corresponding native behavior instead of porting the whole suite.

The default native harness is `#[test]` plus `cargo test --locked`, including unit, integration and documentation tests. Use `#[cfg(test)]` for colocated unit tests and Cargo integration tests for real storage, filesystem, process and cross-module behavior. `--all-targets` is not the default test command: it selects additional build targets but does not include documentation tests. Formatting and clippy are inexpensive pre-acceptance checks; a separate build proves an artifact claim rather than adding another mandatory step to every test loop.

Rust's type, ownership and borrowing checks eliminate classes of invalid state and memory misuse; do not duplicate these guarantees with runtime tests. They do not prove application authorization, hash-to-byte identity, transaction/retry correctness, cancellation, cleanup or desired outcomes. Keep a small set of representative success, important boundary/failure and known-regression cases for those risks. A table of cases inside one test is sufficient when failures identify the case. Test counts and coverage percentages are not quality goals. Routine independent review does not require a parallel permanent suite, custom runner, negative-control mutation or full qualification campaign.

| Active test scope | Retention rule |
| --- | --- |
| Rust engine | Native behavior and consequential failures, using the standard harness. Keep the bounded intake/recovery case data already consumed by Rust; its former JavaScript runner is unnecessary. |
| TypeScript integrations | Test the retained Pi model/provider/session/protocol bridges: exact inputs, response/error decoding, usage, resource isolation and cancellation/cleanup. Use controlled providers and loopback fixtures, not live inference. Test incoming host contracts without executing retired engine authorization policy. |
| Retired prototype | Remove its tests and orphan helpers, including Pi-named compositions that actually exercise TypeScript orchestration, Decision or persistence. This removes unsupported scope, not required native guarantees. Transitional wire/codec dependencies remain explicit until a separately agreed native boundary replaces them. |
| Structural ceremony | Remove source-file inventories, exact import-list snapshots, manifest-text/version duplication and documentation-wording tests. Compilation, lockfiles, review and exact-release qualification own those concerns. A future architectural check must enforce a concrete maintained boundary, not freeze a file layout. |

`npm test` typechecks only the retained adapter import closure and runs its TypeScript-implementation tests with Node's built-in runner. It does not build or test the legacy engine. Native-only slices do not require Node or npm; run adapter checks when changing adapters, their dependencies or the integration boundary. The retained TypeScript sources are Pi bridges and their required protocol/codec dependencies, not a parallel engine. The supporting package is not the Rust product.

Add ecosystem tools only when a measured problem calls for them: property testing for difficult input invariants, fuzzing for untrusted parsers, Miri for relevant unsafe/undefined-behavior risks, or nextest for demonstrated scheduling/isolation needs. None is a baseline dependency or a replacement for assertions about application behavior. There is no need to invent a test framework for this project.

The first delivery is the smallest complete trusted-host engine path. A later self-development release has additional capability and controller gates. The engine's quality controls cannot prove their own initial correctness or authorize the mutable checkout to govern itself. Keep routine source checks small while preserving the separate, bounded qualification obligations below.

### Research basis

The [retained testing-policy sources](../research.md#testing-policy-research) explain this practice. They are not additional frameworks or evidence that a candidate passed its tests.

## Qualification

Qualify exact immutable bytes for a declared capability and host/binding profile. Use a useful positive path and consequential failure cases. State what was observed, under which conditions, what remains unknown and which claim the evidence supports. A fixture, source inspection, passing suite or review is not universal proof.

The first core release must demonstrate one complete intent-bearing transition through a real supported binding in a disposable external project, not only mocked components:

| Boundary | Required evidence |
| --- | --- |
| Host and native authority | Authenticated context cannot be supplied by request fields; native denial and Change denial independently prevent effects. The trusted-host premise and excluded same-privilege threats are explicit. |
| Intent and policy | Original/revised intent, exact policy/operation/subject and any adopted plan binding, and required deterministic Checks survive restart without a universal workflow. Changed intent or source cannot silently inherit stale admission. |
| JSONL acceptance | Joint Trace/checkpoint initialization, one writer, acceptance-bearing durability, original-key retry and exact retained result delivery work under the supported storage profile. |
| Native effect | A real permitted bounded operation succeeds under its point-of-use version/concurrency guard. Unauthorized or stale operations do not apply. |
| Interruption | Lost replies, storage faults and effect/Trace gaps do not cause duplicate effects, invented results or silently repaired accepted history. Reconcile where supported; otherwise expose unresolved status and stop dependent work. |
| Inspection and continuation | Clean restart, ordinary reboot and history reopening preserve coverage, attribution and next permitted action without executing on read. Retained incidents and lost-evidence limits are separately stated and exercised where claimed. |
| Distribution | The tested installed artifact, host integration, configuration and dependency closure are the claimed subject; unsupported invocations and profiles remain unavailable. |

The initial release does not claim hostile-process isolation, semantic judgment quality, multi-tenant sharing, arbitrary repository publication or universal recovery. These require their own contracts and evidence when added. Do not inherit the old standalone-host claim while dropping its enforcement.

### Additional capability qualification

Apply additional obligations only when the corresponding capability is supported:

- **Untrusted workers/custom evaluators:** exact admitted inputs, native rights, scope/handle/process/network/credential boundaries, setup refusal, resource bounds, descendants and cleanup. Passing containment tests does not authenticate source results or qualify publication.
- **Semantic routing/Checks/discovery:** exact definitions/models/settings, representative positive/negative/ambiguous cases, false acceptance and missed obligations, source-instruction resistance, useful feedback and total cost against an appropriate direct/explicit baseline. Confidence or upstream benchmarks are not correctness.
- **Parallel or cross-Workspace Work:** dependencies, shared commitments, conflicts, aggregate limits, partial joins, cancellation and uncertain effects. No global transaction is inferred.
- **Borrowing/forks/confidential sharing:** exact party/prefix provenance, current rights, exclusive continuation, stale-holder refusal, interrupted transfer, result adoption and disclosure/revocation limits. Encryption cannot recall plaintext or supply custody exclusivity.
- **Monitoring/learning:** duplicate/gapped observations, standing intent, current delegation, evidence freshness and normal adoption of procedures. Feedback cannot activate its own weaker controls.
- **Additional hosts/platforms/backends:** actual supported native semantics, failure boundaries and artifact/deployment assumptions. Linux or one file fixture does not qualify other systems.

Avoid qualification by refusal: a profile must perform its stated useful operation as well as reject unsafe ones. Unknown controls or evidence mean unavailable capability, not simulated success. Paid/live inference, privileged installation, sandbox/VM/device experiments and external effects need their applicable explicit authorization and budgets; a plan is not permission to perform them.

## Minimum local dogfood

This repository must never load mutable checkout code as its controller. A later self-development controller needs:

1. Exact immutable qualified product bytes installed outside this checkout, verified at activation and restart. An unavailable controller never falls back to source.
2. Explicit adopted scope, observed baseline, definitions, host/execution configuration and permitted effects without fabricated history.
3. A complete supported development workflow with exact adopted commitments, meaningful pre-effect and actual-outcome assessment, native rights, custody and recovery. Its planning/approval/review obligations remain required where promised; the Change format imposes no universal stage sequence.
4. Exact-candidate qualification in disposable external projects with isolated Pi settings. Fixes produce a new candidate requiring the applicable requalification.
5. Separate activation and explicit controller handoff with prior custody reconciled. Release activation alone does not transfer authority.

A core library release or typed fixture may precede this gate but cannot satisfy it merely by being useful. Native source-development tools remain in use beforehand. Controller changes are governed effects, not automatic consequences of test success.

## First self-development delivery focus

Self-development is a later capability milestone, after the core engine path is supported. It is not the first core-release acceptance gate and does not require a new privileged service merely because a prior investigation explored one. Select one qualified repository binding and eligible executor/host for the actual development workflow. If an adversarial local-worker profile is needed and unavailable, that capability remains blocked; the trusted-host core claim remains narrower.

A representative self-development exercise captures a real requirement, clarifies it where needed, admits an exact plan, prepares a bounded code candidate, obtains applicable deterministic/domain assessment and approval, publishes through guarded native operations and reviews actual results. Exercise a relevant failure/repair and fresh-person or fresh-worker continuation without duplicate effects. Preserve source identities, plan/Check versions, attempt/results and remaining obligations across interruption.

A usable operator surface must explain intent, actual changes, running/blocked work, required decisions, uncertainty and next permitted actions. It can be thin; a full custom terminal application is not a substitute for the backend path. Source inspection, client disconnect and result lookup must not implicitly start work or turn cancellation requests into confirmed cleanup.

Multi-file publication, custom evaluator code, model-driven open-ended goals, retained research, learned procedures or recursive workers require the extra evidence for those capabilities when promised. They are not bundled into every earlier engine release. Learning remains an intended product direction, through normal Change adoption rather than another governance loop.

A qualified external self-development release can govern only a later candidate after explicit handoff. It cannot qualify or install itself from this mutable checkout. This criterion changes neither historical release authority nor existing source-development boundaries.

## First-release capability dependencies

The [Wiki plan](../../product/plan.md) is the sole phased capability plan. Each phase specifies a proposition, useful witness, failure boundaries and required evidence; status and assignments stay in the temporary handoff, later in Changes/Work. Settle only interfaces actually consumed by the next cohesive slice. A future host, model, transfer or discovery protocol is not a dependency merely because it is documented.

Give shared interfaces and manifests one owner. Parallel work needs agreed non-overlapping boundaries and explicit provisional baselines. Failed review pauses affected dependent work; dispatch or documentation does not constitute acceptance.

## Native Rust bootstrap

The native package is `changekernel`, with `src/lib.rs`, a thin `src/main.rs`, a pinned Rust toolchain and retained `Cargo.lock`. Its matching supporting-npm version does not establish identical artifact identity or release qualification. Native builds do not require Node or Pi; bundled SQLite also requires a compatible C compiler.

The launcher remains non-operational: no arguments or `--help` shows unqualified usage; `--version` prints the package version; unsupported arguments fail. It does not start a host or worker, open application storage, mutate sources or transfer authority. Bounded library capabilities beyond metadata are documented in [retained native profiles](native-profiles.md), not inferred from the launcher.

Existing direct dependency and tool requirements remain defined by the actual manifests/lockfiles and bounded contracts: `rusqlite` with bundled SQLite, `sha2`, runtime `serde_json` plus manual `serde_core` traits for the consumed opening codec, Linux `libc`, and an explicitly configured trusted Git executable for the committed-source observer. This prose revision adopts no new dependency, model, toolchain, sandbox or runtime and does not remove compatibility code.

The supporting npm package exports retained Pi bridges and required protocol/codec dependencies, not a parallel engine or native launcher. Run its checks only when that boundary changes. Source tests and normal builds do not establish installed capability or controller authority.

## Source-development boundary

Use [AGENTS.md](../../../../../AGENTS.md), Pi-native tools, ordinary edits, diagnostics, tests and native compaction. Never call ChangeKernel `wiki_*` tools or `/wiki-*` commands here, install this candidate under repository `.pi/`, or add project-local package links, duplicate skills, executable Plugin paths, controller pins or dogfood state.

Wiki separates intended product, phased capability gates, research and retained compatibility references. `.changekernel/changes/` owns governed lifecycle history; source/tests own executable truth; Git owns history/checkpoint evidence. Only the short temporary status note holds unfinished execution state before qualified adoption; Change/Work owns it afterward. Existing archives are historical, not parallel plans. Generated views, private agent/Preview state, credentials, caches, sockets, worktrees and package artifacts do not belong in source Git.
