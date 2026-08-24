---
type: System Component
codewiki_id: cw:component:project
title: Project Configuration
description: Owns repository discovery, execution routes, budgets, bootstrap, Check Pack paths, source architecture declarations, and canonical project layout.
status: stable
tags: [system, component]
codewiki_component: cw:component:project
codewiki_source_patterns: ["src/project/**"]
codewiki_test_patterns: ["tests/project/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Project Configuration supplies the System responsibility required by this Story.
---
# Project Configuration

Project Configuration identifies the repository root, CodeWiki settings, Stage Producer, Implementation Worker, delegate, and Check routes, budgets, source architecture, responsibility rules, and bootstrap boundaries. Project-owned structured configuration errors preserve exact invalid paths, bounded values, recovery guidance, and causes. Configuration digests bind every sensitive attempt; operation payloads, producers, Workers, delegates, installed packages, and Check output cannot override canonical configuration.

Responsibility rules may define domain stewardship, review classes, scoped Authority Grants, independence requirements, and Contribution Routing inputs. Profiles and ownership hints improve matching but grant no authority. Repository-provider access supplies coarse membership only; Project Server still authorizes each exact operation against current project policy and state.

Check requirements do not live in `.codewiki/config.json`. They are ordinary tracked files under `.codewiki/check-packs/<stage>/<pack>/<check-id>/`. A Pack may also contain one optional standard Agent Skill under `skill/<skill-name>/`. Folder presence defines the active stage set. There is no protected Check floor, required default, applicability catalog, enforcement tier, or activation transaction. Users may edit or delete all Packs. Project Server snapshots exact Pack Skills for producer attempts and exact Check files and configuration for Gates. Skill and Check identities remain separate so only incompatible attempts or cached Results are invalidated.

Project configuration stores one exact installed Domain Plugin identity plus exact provider/account/credential-reference/model routes, context windows, reasoning and timeout options, one user-selected Harness route, Decision/Planning/Review inheritance or override, an independent Worker route pool, explicit Worker escalation transitions, execution custody, budgets, and policy references. Model Check routes remain Check-owned and have no implicit fallback to Harness, Worker, producer, or delegate models. Planning and models cannot widen these pools or transitions. Project files contain no provider credential, broker capability token, or raw DSH/Cordis configuration.

A project may select one exact admitted Domain Plugin identity but cannot select or install executable DSH Plugins, Infrastructure Providers, Runtime Bridge code, or Client Plugins. Those executable compositions come only from Backend release or operator admission and qualified DSH profiles. Project files cannot name package roots or executable entrypoints, and unknown Plugin configuration fails closed. Roles may select only authorized routes and capabilities exposed by that fixed composition while retaining separate context, tools, memory, Sessions, and budgets. Any route, executable Plugin closure, model, or custody change alters execution identity and invalidates incompatible attempts, calibration, and cached Results according to their separate contracts.

Canonical project-local layout is:

```text
.codewiki/
  config.json
  kb/
    product/
    system/
  traces/
    TRACE-CHG-<id>.jsonl
  check-packs/
    decision/
      default/
        skill/<skill-name>/        # optional
        <check-id>/
      <pack-name>/
    planning/
      default/
      <pack-name>/
    implementation/
      default/
      <pack-name>/
    review/
      default/
      <pack-name>/
  check-packs.lock.json
  views/
  runtime/
```

Knowledge under `kb/**` is the exact materialized checkpoint of current accepted desired Knowledge State under one bound Domain Plugin and compiler identity; its subjects and independently mutable facets carry immutable path-independent semantic IDs. Change Traces under `traces/**` are the append-only transition and realization history. The initial Knowledge seed plus confirmed Change Effects and synchronized state commits must reduce to the same Knowledge State digest represented by the checkpoint; mismatch stops mutation and recovery rather than selecting one silently. `config.json` and tracked Pack Skill and Check files remain separate source truth for their domains.

Markdown and YAML under `kb/**` remain portable agent-friendly OKF material. Compact durable intent is canonical there; repeated indexes, expanded dictionaries, dossiers, expanded narration, status and migration reports, and other generated surfaces belong under disposable `views/**`. `runtime/**` contains private operational state recoverable from canonical project truth and exact receipts. Backend-owned DSH sessions and delegated child traces are execution Evidence referenced by receipts, not project source truth. Compact Evidence metadata enters Change Trace while large or private artifact bytes remain in their existing authority boundary; CodeWiki creates no canonical `.codewiki/evidence/` database or generic `.codewiki/changes.log`. Root `CHANGELOG.md` records package releases, not project Change history.

Bootstrap creates the compact initial Knowledge State with immutable semantic IDs and one empty bare-bones editable `default/` Pack directory per stage, without inventing a Skill or Check. This happens once. After bootstrap, accepted Knowledge mutation occurs only through a confirmed Decision transition; direct or external Knowledge bytes are observed as drift and enter Change Intake. Missing or deleted defaults are never recreated on startup or upgrade. A stage with no Checks remains valid and its Gate passes with a visible warning. Source architecture declarations describe target dependency direction and are checked independently from temporary refactoring progress.
