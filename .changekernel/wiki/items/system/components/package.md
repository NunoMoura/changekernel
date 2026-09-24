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
    - src/product.ts
    - tsconfig*.json
    - benchmarks/**
  testPatterns:
    - tests/package/**
    - tests/benchmarks/**
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

The [primary design](../../product/changekernel.md#hosting-distribution-and-evolution) owns distribution and hosting choices: one redistributable engine, library interface and standard launcher, with no mandatory end-user platform account, Docker deployment or separate database. This contract owns supported upgrades, qualification and controller authority.

## Versioning and historical interpretation

An immutable release binds exact build/source/dependency closure and common interpretation/transition semantics. Container definitions, adopted evaluators, source versions and model/execution settings have distinct exact identities. Matching labels or hashes do not prove qualification or grant authority.

Supported operational upgrades require explicit scope, exact mapping, backup, collision rejection and interruption recovery. Preserve historical meanings, retained grounds, current authority and unresolved custody; do not silently reinterpret records, dual-write authoritative State or invent adoption. Source-development cleanup may remove obsolete experimental code and documents without maintaining unsupported parallel engines.

Historical `ProjectSnapshot`, `codewiki.*` protocols, managed-document fields and Planning-stage records retain their original meanings until an explicit versioned transition. They do not gain generalized State/recovery guarantees through terminology changes. Committed versions of retired design pages remain historical evidence in Git; retained source metadata is not managed adoption. Changes, existing archives and changelog entries are not rewritten to claim new capabilities.

Current source includes a private partial Git/Wiki foundation and separate bounded SQLite intake/candidate storage, not the complete container engine. Private Decision execution/retention, limited historical proposal/read operations and durable drafts do not establish operational qualification, candidate Check success or State publication. Bootstrap's empty Wiki/Changes roots and current private Pi/loopback path are existing implementation details, not generalized `createContainer` or native Jev contracts.

Decision + Execution is the approved public lifecycle direction. It does not erase proposal, pre-effect and observed-outcome assessment responsibilities or automatically migrate stored stage fields. First validate a two-phase interface against those responsibilities, current authority and actionable operator visibility. Preserve meaningful architecture guards and historical evidence; fewer labels alone establish neither simpler implementation nor lower cost. Any necessary persisted-contract change requires an explicit versioned mapping and interruption/recovery proof, not renamed old results.

## Qualification

Qualify exact immutable bytes for declared subjects, bindings, models, configuration and deployment conditions. Structural tests, replay and injected workers provide bounded engineering evidence, not proof of semantic quality, physical containment or durable continuation.

Start with one enforced application integration and a complete bounded path: creation/opening, honest discovery/baseline, internal intake and Decision admission, Execution with continuous planning, pre-effect assessment, guarded effects/receipts, observed-outcome Review and fresh-session continuation. Include a goal not encoded as a dedicated workflow, ambiguity and repair, supported recoverable failure, retained research and useful learning, and another agent continuing from records. Broader claims then require equivalent semantics on a substantially different source/backend and frontend plus replaceable agent clients.

| Boundary | Required challenges |
| --- | --- |
| Ownership and definitions | Cross-container access, trusted source scope, shared resources, local learning versus shared-definition updates, honest existing-data baseline. |
| Discovery | Missed resources/rules, wrong grouping, invented relationships, unresolved dynamic behavior, version invalidation and disclosure restrictions. |
| Decision | Ambiguous purpose, unsupported premises, counterevidence, omitted effects, consequence-sensitive approval and legitimate commitment revision. |
| Two-phase lifecycle | Rough recorded proposal versus admitted pursuit; domain admission criteria; preserved pre-effect and outcome requirements; changing scope returns to Decision without rewriting history. |
| Classification and granularity | Mixed/misleading labels, unknown coverage, new effects, independent outcomes, coupled batches, cumulative limits and attempts to gain authority by splitting. |
| Execution coordination and pre-effect assessment | Non-covering plans, unsuitable workers, missing prerequisites, intermediate conflicts, aggregate overspend, fairness and bounded refinement. |
| Checks | Packs cannot waive backend requirements; common passes cannot replace required domain assurance; candidates cannot activate their own exemptions. |
| Effects | Stale State, changed collections/aggregates, duplicate requests, lost replies, atomic mutation/receipt integration and outside writes. |
| Observed-outcome Review | Passing units with a failing join, passing candidate with failed deployment, misleading outside-effect claims and required outcomes hidden as follow-ups. |
| Recovery | Restart, uncertain custody, selective repair preserving later work, protected grounds, retention expiry, backup restoration and declared exclusions. |
| Research and source custody | New source acquisition, exact captures/derived inputs, changed query membership, denied/partial observations, expiring references, disclosure limits and source instructions that must not gain authority. |
| Intent and memory | Original versus revised intent, source-backed gaps/conflicts, pinned historical support versus current dependencies, exact procedure use, retired guidance, self-weakening proposals and attempted adoption through internal maintenance. |
| Frontend and operator control | Advice versus requirement, acknowledgment versus performance, privacy, freshness, human/agent parity, clear blockers, uncertain control outcomes and optimistic-display limits. |
| Cross-container work | Scoped sharing, defer/reject/cancel, changed visibility, actual capability availability and fresh authorized continuation. |

Freeze question definitions, quality thresholds, fixtures, supported capabilities and budgets before held-out testing. Use independently reviewed good, defective, ambiguous and adversarial cases for binding, discovery, Checks, ranking, worker fit and guidance retrieval. Challenge source instructions, persuasive unsupported claims, omitted qualifications and unchanged retries that must not become a pass lottery. Model confidence and external benchmark claims are not verified correctness.

Measure missed constraints, incorrect acceptance, unnecessary rejection/escalation, time to useful feedback and realized outcome, human attention, approval waits, ordinary-save latency, slow-tail latency, rework, recovery and total cost. Count coordination, workers, handoffs, review and failures against relevant direct-work/application baselines. Evaluate instruction, procedure, evaluator and model changes against representative retained incidents and independently reviewed cases; a regression test supports its covered case rather than proving general correctness. Cheap calls or completed subagents do not establish overall savings. Preserve false results across restart; changes to assessment scope, inputs, evaluators, permissions or external freshness must invalidate inappropriate reuse.

Exercise real denied writes, network/credential leaks, redirects, source substitution, output/resource exhaustion, descendants, cancellation, timeout and orphan cleanup. Missing enforcement means unavailable capability, not simulated success. Qualify any local-only route and its supporting services without remote fallback. No local alternative, hosted Jev deployment or platform control is qualified by documentation alone.

Broader claims require broader proof. Applications whose bindings do not need Git/Wiki must work without them. Linux-first does not establish equivalent Windows/macOS or machine-wide controls; Bandwagon and Omarchy are generality tests, not simultaneous first-release prerequisites. Do not continue a paused Wiki-only slice unchanged where it would entrench superseded universal Git or fourth-stage assumptions.

## Minimum local dogfood

This repository develops ChangeKernel as a normal source package and **must never load mutable checkout code as its controller**. Later repository governance requires:

1. **Pinned external controller:** immutable qualified bytes and exact dependency/build identity installed outside this checkout, verified at activation/restart. An unavailable controller never falls back to source.
2. **Explicit adoption and authority:** bind scope, observed baseline, desired design, release, adopted rules/evaluators, execution configuration and permitted effects without fabricated history.
3. **Complete enforced lifecycle:** Decision + Execution with meaningful proposal, pre-effect and outcome assessments, exact candidates and Evidence, separate necessary approval and actual observed outcomes. Internal planning/review coordination and optional deployment do not add mandatory public phases or remove domain criteria. A small worker configuration suffices without a fleet or fixed commit count.
4. **Durable continuation/recovery:** fresh process and worker continuation without repeated inference or duplicate effects, plus tested repair within declared limits. Preserve original/revised intent, candidates, research grounds, exact procedure versions, results, commitments, receipts and next permitted actions.
5. **Exact-release qualification and handoff:** pack/test the same candidate bytes only in disposable external projects with isolated Pi settings. Activation alone does not transfer controller authority; explicit handoff and reconciliation of prior custody are required.
6. **Usable operator control:** the terminal interface supports proposal entry, Decision/Execution and attention views, Change/Work tracking, exact candidate/assessment inspection, intent/history/current-guidance inspection, policy-permitted decisions, execution controls and controller health. Its views come from durable authoritative records, not a second task store. Qualify stale/disconnected views, rejected or retried commands, restart/reconnect, pending cancellation and safe continuation. Two phases must not hide detailed waiting, verification or recovery states. Operator approval never substitutes for required passing Checks.

Freeze the candidate before qualification; fixes require new bytes and qualification. A later candidate cannot govern itself. Paid/live inference, deployment, activation and handoff need their applicable explicit authorization. An instruction pointing to a controller does not enforce permissions or execution custody.

## First self-development delivery focus

The next delivery objective is the smallest useful, qualified Rust product that can govern development of a later ChangeKernel candidate, with the operator console usable throughout that path. This is a new implementation of the desired architecture, not a requirement to port every unfinished TypeScript feature or preserve every prototype interface. Reuse applicable safeguards and tests; retain historical records without automatically importing them. This takes priority over accumulating disconnected infrastructure slices or completing every generalized application capability first. Existing intake and candidate custody are reference foundations, not the adoption milestone.

Bound the first supported application to software development with an explicit source definition, a qualified repository/files binding, protected durable bookkeeping, a small worker configuration and meaningful proposal, pre-effect and outcome assessments within Decision + Execution. Source files remain native State; software-domain Checks do not become universal rules. Scope limitations reduce the supported surface, not the force of required assessments, source authority, containment, recovery or release qualification. Missing capabilities remain unavailable.

A representative acceptance exercise starts with operator proposal entry, clarifies an ambiguous requirement, admits bounded pursuit, prepares and inspects a multi-file candidate, observes bounded worker execution and actionable Check feedback, obtains any required exact-subject approval, publishes through guarded source operations, and reviews the actual result. Acquire a new research source, retain necessary exact grounds and distinguish its assertions from adopted knowledge. Interrupt the host or worker and reconnect the terminal; another worker must continue from retained intent, candidates, procedure versions, results and custody records without duplicate effects or fabricated success. Demonstrate a supported repair, a lesson adopted through normal Change controls and a later use with fresh required observations. Include a goal not encoded as a dedicated workflow, rather than qualifying only a scripted happy path.

Validate the two-phase mapping before persisted-protocol changes: simple typed edits must avoid redundant machinery; domain admission constraints still apply; failed deployment cannot follow candidate success into false completion; successful batches cannot conceal incomplete combined outcomes; memory proposals cannot relax their own guards; unknown effects cannot be retried blindly. Preserve meaningful protection while comparing operator comprehension and duplicated work. Implement the approved [repository layout](../../product/changekernel.md#repository-representation) in cohesive modules with corresponding ownership and test changes, not an initial blanket move.

The operator must be able to explain what is being pursued and why, what is running or blocked, what needs a decision, what actually changed, what remains uncertain, and what can safely happen next without raw storage inspection. Record limits and measured feedback latency, including unavailable cost information rather than presenting it as zero. The broader qualification obligations still apply to every claimed capability; additional backends, application generality, large worker fleets and visual polish are not simultaneous prerequisites for this bounded release.

This first application proves a bounded part of the continuous development, use and improvement lifecycle. Preserve interfaces for external tool integration and agent-mediated product use without making a browser protocol, a broad integration catalogue or new model-serving infrastructure prerequisites. The initial surface is narrow; supported authority, assessment, custody and recovery guarantees are not weakened to reach the first release.

This is a delivery criterion, not controller adoption or permission for live inference. Before that release exists, native source-development tools remain in use. No feature work, repository restructure or terminal client may load the mutable checkout as the governing controller. Qualification, activation and explicit handoff remain separate actions with their required authority.

## Native Rust bootstrap

The initial native build is one private Cargo package named `changekernel`, with `src/lib.rs` and a thin `src/main.rs`. Its development version matches the supporting JavaScript package; matching versions do not establish release identity or qualification. Pin the exact tested Rust toolchain and retain `Cargo.lock`. The metadata-only bootstrap uses only the Rust standard library. Native builds and execution do not require Node or Pi.

During bootstrap, no arguments or `--help` prints usage, identifies the build as unqualified, and exits successfully. `--version` prints `changekernel <package-version>` followed by a newline and exits successfully. Other arguments, including unsupported combinations, produce a diagnostic on standard error and a nonzero exit. No invocation starts a host or worker, opens application storage, modifies application sources, or transfers authority. Library exports are limited to build metadata until a separately reviewed engine capability exists.

The first separately reviewed library capability is [native Rust intake](state.md#native-rust-intake). Its approved direct dependencies are `rusqlite` with bundled SQLite and `sha2` for retained-data integrity; `serde_json` is permitted only as a test dependency for the shared case data. Select and lock versions compatible with the existing toolchain; do not bundle unrelated upgrades. Bundled SQLite locks its database source with the crate dependency instead of relying on a separately installed SQLite library; source builds also require a compatible C compiler. This dependency allowance does not introduce a host, transport, terminal framework or worker runtime. The native launcher retains its non-operational bootstrap behavior until a later explicit capability changes that contract.

Keep the existing JavaScript launcher and reference implementation unchanged until deliberate replacement. Native launcher and intake persistence tests run in disposable external directories. Build and test success proves only the exercised bootstrap/intake behavior, not the first self-development delivery or controller adoption.

## Source-development boundary

Use [AGENTS.md](../../../../../AGENTS.md), Pi-native tools, normal edits, diagnostics, tests and native compaction. Never call ChangeKernel `wiki_*` tools or `/wiki-*` commands here, install this candidate under repository `.pi/`, or add local package links, duplicate skills, executable Plugin paths, controller pins or dogfood state. Do not promote a normal build or documentation checkpoint into operational authority.

The five active design files under `.changekernel/wiki/` own desired behavior; that retained location is not a mandatory runtime subsystem. `.changekernel/changes/` owns governed lifecycle history, source/tests own executable truth and Git owns checkpoint history. Only the short temporary status note carries unfinished work before adoption; Change/Work replaces it afterward. Existing archives are historical evidence, not active plans. Generated views, private execution/Preview state, caches, credentials, sockets, worktrees and package artifacts do not belong in source Git.
