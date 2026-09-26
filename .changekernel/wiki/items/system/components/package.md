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

The [primary design](../../product/changekernel.md#hosting-distribution-and-evolution) owns distribution and hosting choices: one redistributable engine, library interface and standard launcher, with no mandatory end-user platform account, Docker deployment or separate database. This contract owns supported upgrades, qualification and controller authority.

## Versioning and historical interpretation

An immutable release binds exact build/source/dependency closure and common interpretation/transition semantics. Workspace/resource bindings, user Kernel versions, adopted evaluators, source versions and model/execution settings have distinct exact identities. Matching labels or hashes do not prove qualification or grant authority.

Supported operational upgrades require explicit scope, exact mapping, backup, collision rejection and interruption recovery. Preserve historical meanings, retained grounds, current authority and unresolved custody; do not silently reinterpret records, dual-write authoritative State or invent adoption. Source-development cleanup may remove obsolete experimental code and documents without maintaining unsupported parallel engines.

Historical `ProjectSnapshot`, `codewiki.*` protocols, managed-document fields and Planning-stage records retain their original meanings until an explicit versioned transition. They do not gain generalized State/recovery guarantees through terminology changes. Committed versions of retired design pages remain historical evidence in Git; retained source metadata is not managed adoption. Changes, existing archives and changelog entries are not rewritten to claim new capabilities.

The retired TypeScript Git/Wiki foundation, private Decision execution, console and SQLite candidate implementation remain in Git history, not the supporting package. Their historical tests and records do not establish native capabilities, operational qualification, candidate Check success or State publication. Native intake and committed-source profiles are bounded contracts; retained Pi bridges do not supply the missing lifecycle, generalized creation or native Jev operations.

The approved desired model uses Workspaces, user-owned versioned Kernels, file-first Change Trace logs and Decision → Planning → Execution. It preserves proposal, plan, pre-effect and observed-outcome responsibilities without automatically migrating stored fields or the earlier two-phase design. Existing native `container_id`/SQLite profiles keep their exact meanings. Resolve the affected [dependency-gated contracts](../../product/changekernel.md#dependency-gated-implementation) before new formats/interfaces or source assignments that freeze them. Any supported persisted transition requires explicit mapping and interruption/recovery proof; a non-migration disposition must also be explicit. Design approval does not activate JSONL authority, encrypted transfer, shared custody or generalized membership.

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

The first delivery remains the smallest complete, enforced self-development path. Once an exact immutable external release is qualified, activated and explicitly handed controller authority, use that pipeline to improve later candidates incrementally. The engine's promised quality controls cannot prove their own initial correctness or authorize the mutable checkout to govern itself. Keep routine source checks small while preserving the separate, bounded qualification obligations below.

### Research basis

- The [Rust Book's test organization](https://doc.rust-lang.org/book/ch11-03-test-organization.html) describes both unit and integration tests and explicitly distinguishes compile-time protections from logic correctness. The [Cargo test reference](https://doc.rust-lang.org/cargo/commands/cargo-test.html) defines the default harness, documentation tests and target selection.
- The [Rust Book on shared-state concurrency](https://doc.rust-lang.org/book/ch16-03-shared-state.html) notes that mutexes can still deadlock; language safety does not establish all concurrency behavior.
- [Proptest](https://proptest-rs.github.io/proptest/intro.html) complements example tests with generated inputs and shrinking; [cargo-fuzz](https://rust-fuzz.github.io/book/cargo-fuzz.html) drives a fuzzer. Use either for a specific input-space risk, not by default.
- [Miri](https://github.com/rust-lang/miri/blob/master/README.md) detects supported undefined behavior in executions, not general correctness. [Nextest](https://nexte.st/docs/design/how-it-works/) changes execution scheduling and process isolation; it does not supply missing test cases. These are options, not an adopted toolchain expansion.

## Qualification

Qualify exact immutable bytes for declared subjects, bindings, models, configuration and deployment conditions. Structural tests, replay and injected workers provide bounded engineering evidence, not proof of semantic quality, physical containment or durable continuation.

Start with one enforced application integration and a complete bounded path: Workspace binding/opening, authenticated user-bound custody, honest discovery/baseline, internal intake and Decision admission, checked Planning, Execution with exact pre-effect assessment, guarded effects/receipts, observed-outcome Review and fresh-session continuation. Include a goal not encoded as a dedicated workflow, ambiguity and repair, supported recoverable failure, retained research and useful learning, and another agent continuing from records. Broader claims then require equivalent semantics on a substantially different source/backend and frontend plus replaceable agent clients.

| Boundary | Required challenges |
| --- | --- |
| Ownership and definitions | Original owner and intent retained across custodians; each contribution attributable; native permissions enforced, descriptor/file possession confers no rights, Kernel updates cannot self-authorize, and existing-data baselines remain honest. |
| Backend-only write boundary | Typed operations rather than raw Trace/event writes; forged actor/approval/outcome fields, unauthorized retries and wrong custody rejected; filesystem/alias/handle/process/IPC bypasses denied for clients and workers. A privileged host cannot substitute its own native rights for the acting user's. |
| Discovery | Missed resources/rules, wrong grouping, invented relationships, unresolved dynamic behavior, version invalidation and disclosure restrictions. |
| Decision | Ambiguous purpose, unsupported premises, counterevidence, omitted effects, consequence-sensitive approval and legitimate commitment revision. |
| Three-stage lifecycle | Recorded proposal versus admitted pursuit; exact Kernel versions and mandatory requirements; Planning pass versus executable Work; pre-effect/outcome obligations preserved; material changes re-admitted without rewriting history. |
| Classification and granularity | Mixed/misleading labels, unknown coverage, new effects, independent outcomes, coupled batches, cumulative limits and attempts to gain authority by splitting. |
| Planning and coordination | Non-covering plans, unsafe interfaces/parallel routes, unsuitable workers, missing prerequisites, blocked-but-valid plans, shared results, aggregate overspend, fairness and bounded refinement. |
| Checks | Packs cannot waive backend requirements; common passes cannot replace required domain assurance; candidates cannot activate their own exemptions. |
| Effects | Stale State, changed collections/aggregates, duplicate requests, lost replies, atomic mutation/receipt integration and outside writes. |
| Observed-outcome Review | Passing units with a failing join, passing candidate with failed deployment, misleading outside-effect claims and required outcomes hidden as follow-ups. |
| File-first custody and recovery | Joint Trace/checkpoint creation and acknowledgment, directory-entry durability, writer/control-inode protection, exact retry inputs and original result references, interrupted tails versus accepted corruption, and explicit I/O-error recovery. Distinguish ordinary restart, stale log with surviving current control, explicit restoration and whole-domain rollback. Never reconstruct authority from a matching old pair or claim rollback-resistant continuation without surviving freshness evidence. |
| Research and source custody | New source acquisition, exact captures/derived inputs, changed query membership, denied/partial observations, expiring references, disclosure limits and source instructions that must not gain authority. |
| Intent and memory | Original versus revised intent, source-backed gaps/conflicts, pinned historical support versus current dependencies, exact procedure use, retired guidance, self-weakening proposals and attempted adoption through internal maintenance. |
| Frontend and operator control | Advice versus requirement, acknowledgment versus performance, privacy, freshness, human/agent parity, clear blockers, uncertain control outcomes and optimistic-display limits. |
| Cross-Workspace work | Scoped sharing, defer/reject/cancel, changed visibility, actual capability availability and fresh authorized continuation without retargeting original identity. |
| Borrowing and forks, when supported | One active continuation, exact-checkpoint transfer, interrupted acceptance/return, stale-holder rejection, in-flight effects, independent fork identity/ownership, explicit dependencies and checked result adoption without history merging. |
| Confidential sharing, when supported | Individual authorized material rather than folder access, authenticated keys/transport, ciphertext and metadata limits, tampering/replay, revocation behavior and no claims to recall disclosed plaintext. |

Freeze question definitions, quality thresholds, fixtures, supported capabilities and budgets before held-out testing. Use independently reviewed good, defective, ambiguous and adversarial cases for binding, discovery, Checks, ranking, worker fit and guidance retrieval. Challenge source instructions, persuasive unsupported claims, omitted qualifications and unchanged retries that must not become a pass lottery. Model confidence and external benchmark claims are not verified correctness.

Measure missed constraints, incorrect acceptance, unnecessary rejection/escalation, time to useful feedback and realized outcome, human attention, approval waits, ordinary-save latency, slow-tail latency, rework, recovery and total cost. Count coordination, workers, handoffs, review and failures against relevant direct-work/application baselines. Evaluate instruction, procedure, evaluator and model changes against representative retained incidents and independently reviewed cases; a regression test supports its covered case rather than proving general correctness. Cheap calls or completed subagents do not establish overall savings. Preserve false results across restart; changes to assessment scope, inputs, evaluators, permissions or external freshness must invalidate inappropriate reuse.

Exercise real denied writes, network/credential leaks, redirects, source substitution, output/resource exhaustion, descendants, cancellation, timeout and orphan cleanup. Missing enforcement means unavailable capability, not simulated success. Qualify any local-only route and its supporting services without remote fallback. No local alternative, hosted Jev deployment or platform control is qualified by documentation alone.

Broader claims require broader proof. Applications whose bindings do not need Git/Wiki must work without them. Linux-first does not establish equivalent Windows/macOS or machine-wide controls; Bandwagon and Omarchy are generality tests, not simultaneous first-release prerequisites. Do not resume a paused slice unchanged where it would entrench superseded Container/database-default or two-phase assumptions. Unimplemented borrowing, encryption, generic State or additional source profiles remain unavailable until their own contracts and proof are complete.

## Minimum local dogfood

This repository develops ChangeKernel as a normal source package and **must never load mutable checkout code as its controller**. Later repository governance requires:

1. **Pinned external controller:** immutable qualified bytes and exact dependency/build identity installed outside this checkout, verified at activation/restart. An unavailable controller never falls back to source.
2. **Explicit adoption and authority:** bind scope, observed baseline, desired design, release, adopted rules/evaluators, execution configuration and permitted effects without fabricated history.
3. **Complete enforced lifecycle:** Decision → Planning → Execution with meaningful proposal/plan, pre-effect and outcome assessments, exact candidates and Evidence, separate necessary approval and actual observed outcomes. Review and optional deployment do not add a fourth stage or remove domain criteria. A small worker configuration suffices without a fleet or fixed commit count.
4. **Durable continuation/recovery:** fresh process and worker continuation without repeated inference or duplicate effects, plus tested repair within declared limits. Preserve original/revised intent, candidates, research grounds, exact procedure versions, results, commitments, receipts and next permitted actions.
5. **Exact-release qualification and handoff:** pack/test the same candidate bytes only in disposable external projects with isolated Pi settings. Activation alone does not transfer controller authority; explicit handoff and reconciliation of prior custody are required.
6. **Usable operator control:** the terminal interface supports Workspace selection, proposal entry, Decision/Planning/Execution and attention views, private Change/Work tracking, exact candidate/assessment inspection, intent/history/current-guidance inspection, policy-permitted decisions, execution controls and controller health. Views derive from authoritative records, not a second task store. Qualify stale/disconnected views, rejected/retried commands, restart/reconnect, pending cancellation and safe continuation. Stages must not hide waiting, custody, verification or recovery states. Operator approval never substitutes for required passing Checks.

Freeze the candidate before qualification; fixes require new bytes and qualification. A later candidate cannot govern itself. Paid/live inference, deployment, activation and handoff need their applicable explicit authorization. An instruction pointing to a controller does not enforce permissions or execution custody.

## First self-development delivery focus

The next delivery objective is the smallest useful, qualified Rust product that can govern development of a later ChangeKernel candidate, with the operator console usable throughout that path. This is a new implementation of the desired architecture, not a requirement to port every unfinished TypeScript feature or preserve every prototype interface. Reuse applicable safeguards and tests; retain historical records without automatically importing them. This takes priority over accumulating disconnected infrastructure slices or completing every generalized application capability first. Existing intake and candidate custody are reference foundations, not the adoption milestone.

Bound the first supported application to software development with an explicit Workspace/resource binding, a qualified repository/files source, protected user-bound file-first Change Trace custody, a small worker configuration and meaningful Decision, Planning, pre-effect and outcome assessments. Source files remain native State; software-domain Checks do not become universal rules. Resolve the first Trace/Git, identity, lifecycle and execution contracts before their implementations. A local single-custodian profile need not claim remote borrowing or encryption, but must qualify its own writer exclusion and recovery. Scope limitations reduce supported surface, not the force of authority, assessment, containment or durability. Missing capabilities remain unavailable. A typed-only custody/observation milestone may precede qualified worker execution and publication, but is not this complete delivery. Protect authoritative storage from ordinary clients and workers before real execution; a successful API call or same-account file mode is not the protection proof. Whole-custody rollback resistance and automatic backup continuation require their own surviving-authority protocol and may remain explicitly unavailable rather than being simulated.

A representative acceptance exercise starts with operator proposal entry, clarifies an ambiguous requirement, admits bounded pursuit, inspects a checked Work/dependency plan, prepares and inspects a multi-file candidate, observes bounded worker execution and actionable Check feedback, obtains any required exact-subject approval, publishes through guarded source operations, and reviews the actual result. Acquire a new research source, retain necessary exact grounds and distinguish its assertions from adopted knowledge. Interrupt the host or worker and reconnect the terminal; another worker must continue from retained intent, candidates, procedure versions, results and custody records without duplicate effects or fabricated success. Demonstrate a supported repair, a lesson adopted through normal Change controls and a later use with fresh required observations. Include a goal not encoded as a dedicated workflow, rather than qualifying only a scripted happy path.

Validate the three-stage contracts before persisted-protocol changes: simple typed edits avoid redundant machinery; domain admission constraints still apply; blocked Work does not become executable through a Planning pass; failed deployment cannot follow candidate success into false completion; successful batches cannot conceal incomplete combined outcomes; memory proposals cannot relax their own guards; unknown effects cannot be retried blindly. Preserve meaningful protection while comparing operator comprehension and duplicated work. Implement the approved [repository layout](../../product/changekernel.md#repository-representation) in cohesive modules with corresponding ownership and test changes, not an initial blanket move.

The operator must be able to explain what is being pursued and why, what is running or blocked, what needs a decision, what actually changed, what remains uncertain, and what can safely happen next without raw storage inspection. Record limits and measured feedback latency, including unavailable cost information rather than presenting it as zero. The broader qualification obligations still apply to every claimed capability; additional backends, application generality, large worker fleets and visual polish are not simultaneous prerequisites for this bounded release.

This first application proves a bounded part of the actor-neutral continuous development, use and improvement lifecycle, with user-owned Changes and native authorization enforced by the system. Preserve interfaces for external tool integration and agent-mediated product use without making a browser protocol, a broad integration catalogue, cloud synchronization, machine-wide governance, a generalized AI-restriction layer or new model-serving infrastructure prerequisites. The initial surface is narrow; supported authority, assessment, custody and recovery guarantees are not weakened to reach the first release.

This is a delivery criterion, not controller adoption or permission for live inference. Before that release exists, native source-development tools remain in use. No feature work, repository restructure or terminal client may load the mutable checkout as the governing controller. Qualification, activation and explicit handoff remain separate actions with their required authority.

## First-release capability dependencies

Delivery is a dependency graph, not a prototype-parity checklist. The [canonical dependency plan](../../product/changekernel.md#dependency-gated-implementation) owns unresolved protocol prerequisites and their blocking claims. The table below relates those gates to delivery acceptance; it does not create a parallel queue. Current assignments and provisional work belong in the temporary handoff.

| Capability | Prerequisites and acceptance boundary |
| --- | --- |
| Durable intent and continuation | Agreed Workspace/user identity, backend-only write boundary and file-first Trace/checkpoint profile precede new authoritative records and retry/custody interfaces. For this delivery, current SQLite profiles remain unchanged and are not extended or migrated into the new history. |
| Source observations and exact candidates | Declared read scope and native versions precede protected custody of exact multi-resource proposals. Observation and preparation do not grant approval or publication authority. |
| Decision, Planning and bounded Work | Agreed Kernel/Check version, intent/plan and reference contracts precede new stage formats, Work graphs, routing and execution eligibility. Required source rules cannot be weakened by user Kernel selection. |
| Producer and Check execution | Protected inputs, bounded Runs, shared supervision/cancellation and retained outputs must be agreed first. Pi production and deterministic Check adapters may then be built independently against those contracts. |
| Guarded effects and recovery | Exact candidate custody, applicable assessments, current authority, freshness and protected grounds precede publication. Source outcome protocols and serialized aggregate admission precede safe retry/shared-commitment claims. |
| Multi-user borrowing/forks and confidential sharing | Exact identity/prefix provenance, protected continuation and result-adoption contracts precede multi-user routing. Encrypted transfer additionally requires authenticated key/disclosure protocols; neither copying nor encryption supplies exclusive authority. |
| Operator visibility and controls | Authoritative operation/query contracts precede terminal integration. Displays may evolve in parallel with their backend only when supported/unavailable states and version semantics are agreed. |
| Qualified external self-development | The complete bounded path, meaningful Checks, custody/containment and recovery must pass exact-subject qualification in external projects. Packaging, activation and explicit controller handoff remain separate gates. |

Freeze shared boundaries before parallel writes and give shared composition/metadata one owner. Provisional implementation may start from an explicitly identified submitted snapshot while earlier review continues; this does not accept that snapshot. Review failures remain integration and acceptance blockers, and affected dependent work must be revised or paused rather than silently inheriting a defect.

## Native Rust bootstrap

The initial native build is one private Cargo package named `changekernel`, with `src/lib.rs` and a thin `src/main.rs`. Its development version matches the supporting JavaScript package; matching versions do not establish release identity or qualification. Pin the exact tested Rust toolchain and retain `Cargo.lock`. The metadata-only bootstrap uses only the Rust standard library. Native builds and execution do not require Node or Pi.

During bootstrap, no arguments or `--help` prints usage, identifies the build as unqualified, and exits successfully. `--version` prints `changekernel <package-version>` followed by a newline and exits successfully. Other arguments, including unsupported combinations, produce a diagnostic on standard error and a nonzero exit. No invocation starts a host or worker, opens application storage, modifies application sources, or transfers authority. Library exports are limited to build metadata until a separately reviewed engine capability exists.

The first separately reviewed library capability is [native Rust intake](state.md#native-rust-intake). Its approved direct dependencies are `rusqlite` with bundled SQLite and `sha2` for retained-data integrity; `serde_json` is permitted only as a test dependency for the shared case data. Select and lock versions compatible with the existing toolchain; do not bundle unrelated upgrades. Bundled SQLite locks its database source with the crate dependency instead of relying on a separately installed SQLite library; source builds also require a compatible C compiler. This dependency allowance does not introduce a host, transport, terminal framework or worker runtime. The native launcher retains its non-operational bootstrap behavior until a later explicit capability changes that contract.

The [native committed-source observer](state.md#native-committed-source-observations) additionally requires an explicitly configured, trusted Git executable when that capability is used. It uses the existing approved Rust dependencies; it does not add a Git framework, a worker runtime or a build/launcher dependency on Git. Record the tested Git version and supported repository forms; this is not cross-version qualification.

The supporting npm package exposes only the retained Pi bridges and their transitive wire/codec dependencies. It does not install a launcher or expose historical engine APIs; the Cargo binary is the native launcher. Historical TypeScript engine sources may be deliberately removed without migrating their unsupported behavior or retaining their retired test suites. Removing scaffolding does not implement replacement native capabilities. The testing policy above owns the active test scope. Native launcher, intake persistence and source-observation fixtures run in disposable external directories. Build and test success proves only the exercised behavior, not the first self-development delivery or controller adoption.

## Source-development boundary

Use [AGENTS.md](../../../../../AGENTS.md), Pi-native tools, normal edits, diagnostics, tests and native compaction. Never call ChangeKernel `wiki_*` tools or `/wiki-*` commands here, install this candidate under repository `.pi/`, or add local package links, duplicate skills, executable Plugin paths, controller pins or dogfood state. Do not promote a normal build or documentation checkpoint into operational authority.

The five active design files under `.changekernel/wiki/`, including the dependency-gated implementation plan, own desired behavior; that retained location is not a mandatory runtime subsystem. `.changekernel/changes/` owns governed lifecycle history, source/tests own executable truth and Git owns checkpoint history. Only the short temporary status note carries unfinished work before adoption; Change/Work replaces it afterward. Existing archives are historical evidence, not active plans. Generated views, private execution/Preview state, caches, credentials, sockets, worktrees and package artifacts do not belong in source Git.
