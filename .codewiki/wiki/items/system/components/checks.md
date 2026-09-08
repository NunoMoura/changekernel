---
{"aliases":["Active Check","Check","Check Output","Check Pack","Check Result","Check Run","Check SDK","Code Check","Gate","Gate outcome","Model Check","Pack Skill","Probe","User Standard"],"attributes":{"codewiki.component:ownership":{"roles":["model-check"],"sourcePatterns":[".codewiki/check-packs.lock.json",".codewiki/check-packs/**","check-packs/**","src/adapters/checks/**","src/kernel/gates/**","src/ports/check-runner.ts"],"testPatterns":["tests/adapters/checks/**","tests/kernel/gates/**","tests/ports/check-runner.test.mjs"],"traceEvents":["gate.recorded"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:checks","codewiki_id":"cw:component:checks","codewiki_relationships":[{"rationale":"Checks supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"},{"rationale":"Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}],"codewiki_source_patterns":["src/checks/**","check-packs/**",".codewiki/check-packs/**"],"codewiki_test_patterns":["tests/checks/**"],"description":"Owns Check, Check Pack, Pack Skill snapshot, Check SDK, bounded execution, Result, Gate Report, caching, and fail-fast contracts.","status":"stable","tags":["system","component"],"title":"Checks","type":"System Component"},"codewiki.legacy:source-path":"system/components/checks.md"},"itemId":"cw:component:checks","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:fb89bf701229b71d05e2309877708207de655916d76a8bd18212cd1766704cca","codewiki.legacy:source-path":"system/components/checks.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:checks"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Checks supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:check-author.author-composable-checks"}],"title":"Checks"}
---
# Checks

Checks are project-owned, stage-specific judgments over one exact Git subject. Check Packs define available policy. A Gate freezes the exact stage subject, Check Pack identities, Change type, realization route, type-conditioned active Checks, declared inputs, resolver identity, and Gate digest. One Check Run executes one active Check; completed execution may produce one Result. Gate reduction yields `passed`, `failed`, or `stopped` and grants no lifecycle authority by itself.

## Project files

```text
.codewiki/check-packs/<stage>/<pack>/
  skill/                       # optional producer guidance
    <skill-name>/
      SKILL.md
      <Agent Skill resources>
  <check-id>/
    check.json
    CHECK.md | CHECK.mjs
.codewiki/check-packs.lock.json
```

Stages are `decision`, `planning`, `implementation`, and `review`. A Pack directory contains Checks and at most one optional standard Agent Skill. Copied/adopted Pack bytes are ordinary project policy: users may edit or delete them, and bootstrap/startup/upgrade never silently restores them. CodeWiki ships Check mechanics, not concrete default or internal judgments. Bootstrap creates an explicit empty lock and no Check definitions. Custom policy adoption, editing, and removal update the exact lock and corresponding files together through authorized policy changes; startup never silently repairs a mismatch.

Project Server validates and snapshots every Pack for the stage. A Check with no applicability selector is active. An optional selector contains only positive allowlists over `changeType`, `realization`, Work Unit subtype, and exact subject facts; declared fields combine by conjunction and values within one field by membership. Unknown fields/values, negative rules, arbitrary expressions, or incomplete facts stop Gate construction. Exact stage and frozen subject deterministically select the canonically sorted `Gate.activeChecks`. Agents, routes, models, Workers, and proposal bytes cannot choose or suppress that set. The Gate binds complete available policy, selector inputs, resolver identity, active set, omissions, and digest so selection can be replayed.

Decision has no mandatory Product-authored semantic rubric. Projects may explicitly adopt alignment or other judgments, but a model judgment cannot prove classification correct or replace deterministic safety validation. Any safety-critical Check is either universal for its stage or selected only from deterministic exact-subject facts independent of producer-declared classification. Structural Git, Trace, Item, AuthZ, and state-machine validation is deterministic release code invoked before Gate creation; this Kernel Validation is not a Check and supplements rather than replaces stage Checks. Planning retains its own project Check Packs and Gate.

## One Check, one contract

Each registered top-level Check declares one atomic requirement, pass/fail or finite quantitative condition, stable failure code, bounded inputs, execution limits, applicability, and remediation contract. Its implementation may compose internal helpers, but only the registered boundary receives one Check Run and at most one Result.

Model Checks use `CHECK.md` and run through fresh isolated DSH Runs on separately authorized routes. Model Checks receive only declared Gate inputs, no tools, and no producer memory. They cannot mutate the subject, grant exceptions, choose transitions, or treat model judgment as deterministic truth. A Model Check may consume immutable Preview Evidence captured before its Run, but it cannot launch Preview or inherit producer memory.

Code Checks use self-contained `CHECK.mjs` inside admitted hermetic, credential-free, network-denied sandboxes. They receive only declared Gate inputs and return bounded output through the Check SDK. Project Server authorizes time, resource, filesystem, process, output, and cancellation limits and validates receipts; the Check Runner adapter and qualified execution host physically enforce those limits. No host fallback or canonical-write capability exists.

An active Check may request `preview.verify` only when its frozen declaration and Gate inputs require it. Check Runner invokes the Preview port on the exact immutable subject, independent of producer Sessions and `preview.work` observations. Preview adapter returns an untrusted observation and quiescence receipt; Project Server validates and admits exact Evidence before the Check judges it. Preview never returns a Result or Gate outcome.

## Gate, Check Runs, and Results

Gate itself owns the exact shared evaluation context; no separate Gate Evaluation Package exists. A Gate binds stage, subject commit/tree, Change/ref identity, Pack policy, frozen active Checks, declared input/View/Evidence refs, routes/execution identities where relevant, complete coverage, and Gate digest.

Each execution attempt is one Check Run. Transport reconciliation of unchanged authorization stays inside that Check Run and idempotency identity. A semantic retry creates a new Check Run only after the predecessor execution has a terminal receipt or independently proven quiescence. Model Check Runs may delegate to one DSH Run; Code Check Runs delegate to one sandbox execution. Operational timeout, cancellation, unavailable capability, missing input, stale identity, malformed output, or exhausted retry yields no Result. A completed Run yields exactly one immutable `passed` or `failed` Result bound to its Gate, Check, exact input, implementation, executor, and measurement.

Gate outcome is `passed`, `failed`, or `stopped`. Any required failed Result fails. Missing required operational Result stops. All required active Checks passing yields pass. Advisory/observe Results remain visible without blocking according to Check policy. Zero active Checks may pass with an explicit warning only after complete deterministic selection and successful Kernel validation. This is not a semantic Check verdict. A missing or malformed lock, unresolved policy, unavailable required executor, missing required input, or invalid Result never becomes an empty pass.

Gates do not select stages, commit Changes, integrate work, complete Changes, or perform effects. Project Server validates a current Gate and exact expected heads before any transition. Failed Results return bounded feedback to the responsible phase; stopped Runs return operational recovery without fabricating judgment.

## Producer guidance and SDK

A Pack Skill may guide the work-producing Agent but never judges output, chooses active Checks, or grants capabilities. Managed DSH Runs disable ambient Skills and bind only exact admitted Skill bytes. Check executors receive no producer memory or Pack Skill.

The Check SDK exposes bounded read-only operations over the Gate's declared exact Project/Wiki/Trace, Work, Alignment, Evidence, and Result inputs. Queries retain stable source identities, ordering, coverage, unknowns, truncation, freshness, and receipts. It exposes no live mutation, credentials, network, producer context, or lifecycle handle.
