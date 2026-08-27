---
type: System Component
codewiki_id: cw:component:checks
title: Checks
description: Owns Check, Check Pack, Pack Skill snapshot, Check SDK, bounded execution, Result, Gate Report, caching, and fail-fast contracts.
status: stable
tags: [system, component]
codewiki_component: cw:component:checks
codewiki_source_patterns: ["src/checks/**", "check-packs/**", ".codewiki/check-packs/**"]
codewiki_test_patterns: ["tests/checks/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Checks supplies the System responsibility required by this Story.
  - type: realizes
    target: cw:story:check-author.author-composable-checks
    rationale: Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.
---
# Checks

Backend v1 owns Checks, Pack Skills, Results, Gate reduction. Target Check `2.0.0` adds four evaluators/three modes; no condition means active, Packs grant no policy, Results stay binary, inability stops. At SK4 Planning uses Kernel Validation. During SK2–SK3 Package `3.0.0` reaches legacy artifacts only through verified Bridge Receipt; raw status has no authority. SK4 retires bridge and activates target Checks.

## Project files

```text
.codewiki/check-packs/<stage>/<pack>/
  skill/                       # optional
    <skill-name>/
      SKILL.md
      <Agent Skill resources>
  <check-id>/
    check.json
    CHECK.md | CHECK.mjs
.codewiki/check-packs.lock.json
```

A Pack is its stage-local directory; it has no extra `checks/` level or local manifest. Optional `skill/` contains one standard Agent Skill directory. Every other root directory is one Check with `check.json` and exactly one `CHECK.mjs` or `CHECK.md`. Code dependencies are bundled into self-contained `CHECK.mjs`.

The Software Development Domain ships one versioned `software-development-default` Pack per stage. Bootstrap validates and copies them once; `check-packs.lock.json` binds Domain identity, trees, and installed paths. Existing projects adopt explicitly. Copied bytes are editable project policy; deletion is supported and never reversed by bootstrap, startup, or upgrade. Zero Checks, including Skill-only Packs, passes with `selectedCheckCount: 0`, `no_checks_configured`, and no synthetic Results.

After adoption, only direct edits or authenticated CodeWiki App/Client commands change Packs; Project Server still enforces AuthZ. Folder presence defines policy; no protected floor, tier, activation ceremony, or hidden catalog exists. CodeWiki tracks separate Check-only `codewiki-project-server` Packs absent from shipped defaults. Release N loads their accepted protected-head snapshots to judge N+1, so Candidate bytes cannot select their judge.

Project Server resolves each stage's active Packs into one deterministic policy snapshot. Implementation Stage Policy `1.0.0` binds it once; every Work Unit package contains that exact Check Pack snapshot while Candidate, declared inputs, and stage lineage vary. Planning, workers, routes, and models cannot select bespoke subsets. Editing an Implementation Pack stales affected remaining Results uniformly.

## Pack Skills

A Pack Skill guides production but never judges output. Project Server supplies exact current stage Skills in stable Pack-ID order. Each bounded snapshot binds stage, Pack, name, complete file manifest, and digests to producer attempt and receipt. Ambient Skills stay disabled; delegated routes qualify only when their custody receipts prove supplied bytes.

Pack Skills are harness-neutral Agent Skills, not plugins or settings. Their files run only through tools already admitted for the attempt. `allowed-tools` creates no capability. Check executors receive no Skill, producer memory, or tool.

Skill changes stale affected production but stay outside Result cache identity. Conflicts remain visible configuration. Outcome Diagnostics may propose an exact Skill diff only as ordinary Change Intake.

## One Check, one contract

Each registered top-level Check declares one atomic requirement, pass condition, fail condition, stable failure code, and feedback contract. Its implementation may inspect several facts or compose several Checks internally, but only the registered boundary returns one measurement and at most one failure object. Multiple supporting locations are allowed; different authoritative failure codes or feedback responses require separate registered Checks.

Checks have independent implementation and measurement axes:

```text
implementation: code | model
measurement:    binary | quantitative
```

A binary Check returns one boolean. A quantitative Check returns one finite number, while `check.json` defines its minimum, maximum, or both. Checks derives pass or fail and rejects contradictory verdicts. Each completed Result retains exact measurement, threshold, Check and configuration digests, input digest, execution identity, and either no feedback or one failure.

Model `CHECK.md` defines ordered Requirement, Pass, Fail, and Feedback sections. Checks supplies the fixed bounded structured-output protocol. Every top-level Model Check invocation runs in its own fresh isolated tool-free DSH Agent Session over exact declared Gate Evaluation Package input; independent Checks may run in bounded parallel. A Decision Model Check receives the already-materialized Candidate, exact current and projected Knowledge, and complete declared compatibility coverage. It judges and returns only bounded Check Output; it never authors Knowledge Effects, replacement bytes, Candidate amendments, or transitions. Lack of proof follows the authored fail condition. Its route is independent from producer and Implementation Worker routes, with no inherited tools, Skill, memory, context query, programmatic runtime, compaction continuation, other Check result, or fallback.

Code `CHECK.mjs` consumes language-neutral Check Input and returns bounded Check Output through an admitted sandbox. It is deterministic and hermetic over declared package-bound input. Project Server enforces time, resource, output, filesystem, and process bounds plus network denial. No host credentials, canonical-write authority, package installation, or host fallback enters the sandbox. Marketplace Code Checks arrive self-contained and prebundled.

## Check Author SDK and composition

A Probe gathers bounded facts without judging; a Check returns binary or quantitative judgment. Probes may be memoized within one Invocation while retaining provenance and coverage. Checks compose through deterministic all, any, none, count, iteration, and score semantics.

Only the registered top-level Check beside `check.json` receives Result, cache, retry, failure-code, feedback, and Gate identity. Nested Checks inherit immutable context and limits and return local findings only. Installed Checks never resolve another installed Check by Pack identity.

Authors retain source, tests, fixtures, and dependencies externally and bundle active Code Checks into readable self-contained `CHECK.mjs`. Developer tooling may validate, bundle, sandbox-preview, and replay Invocations, but cannot mutate or route Packs.

The reserved read-only `codewiki` binding queries only declared Gate Evaluation Package inputs: Knowledge, repository, revisions, Evidence, Change and Work Unit state, and Alignment. Horizontal and vertical queries retain package/input digests, sources, order, provenance, coverage, unknowns, truncation, cursor, engine, and staleness. Host records each query. SDK returns fixed Check Output and exposes no producer context, live mutation, network, credential, lifecycle, effect, or persistent state.

## Execution and Gate outcomes

Project Server freezes Gate Evaluation Package `2.0.0` in Backend v1 and Domain-free target `3.0.0` at Candidate checkpoint. Target binds exact subject, Pack, WorkState, repository identity, canonical commit, proposal commit and managed-ref tip, derived fixed-path Wiki tree and Item diff, Alignment, Evidence/Results, config/routes, declared selections, execution identities, and active-Change coverage. Other stages bind accepted proposal/Item targets, Completion Requirements, Git base/tree, Plugin Receipts, and integration lineage. Producer snapshots never become implicit Check input. Construction rejects unresolved handles, unknown Checks, incomplete/stale selections, stage mismatch, and identity drift.

Execution reads only package-derived subject and selections; it neither resolves inputs again nor exposes live Project Server access. Check Invocation `4.0.0`, Check Result `2.0.0`, cache `2.0.0`, and Gate Report/reduction `2.0.0` bind the package digest. Any package drift creates distinct Invocation, cache, Result, and Gate identities. Only completed Results are cacheable.

Installed Checks declare no runtime dependencies. Pack order cannot create prerequisites. Source-level composition is permitted because the complete closure is bundled before installation. Execution resolves exact cache hits, runs uncached Code Checks in bounded parallel, stops before Model Checks after Code failure or stop, otherwise runs Model Checks in bounded parallel, and stops launching queued work after a conclusive outcome. Running work receives best-effort cancellation; stable registered Check identity orders persisted output.

A Result exists only when one registered Check completes `passed` or `failed`. Timeout, cancellation, unavailable execution, invalid output, exhausted budget, failed input collection, incomplete snapshot query, or unrecoverable staleness produces no Result. Project Server may retry transient failure within bounds; exhaustion stops the Gate while preserving canonical state.

A Gate Report is `passed`, `failed`, or `stopped`. It passes only when all present Checks pass, fails when any Check fails, and stops when a required valid Result cannot be produced. Zero Checks is the explicit passing warning case. Malformed Check or Pack Skill content stops only the affected stage operation that requires it and never crashes another project or read-only inspection.

Gate Reports carry the exact Gate Evaluation Package digest, Results, execution and cancellation facts, cache use, warnings, stage and subject identity, and any stop reason. A stop before complete package construction carries no package digest and creates no Result. Every completed Result in a Report must bind the Report's exact package. Gates never choose stages or perform effects. Project Server applies fixed lifecycle transitions. Failed Results return exact semantic feedback to the responsible Stage Loop; stopped runs return operational recovery to the User.
