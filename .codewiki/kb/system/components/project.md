---
type: System Component
codewiki_id: cw:component:project
title: Project Configuration
description: Owns mandatory Git repository identity/ref policy, routes, budgets, bootstrap, Check paths, source architecture, and project layout.
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

Project Configuration identifies repository root/ID, frozen Git object format and canonical ref, CodeWiki settings, Stage Producer, Implementation Worker, delegate, Check routes, budgets, source architecture, responsibility rules, and bootstrap boundaries. Target configuration may also define Raw Data capture/retention defaults, permitted request ranges, admitted CodeWiki Plugin manifest selections, bounded Plugin configuration, and Evidence freshness/coverage policy references. An authorized intake Request may select within that range; weakening a default additionally requires retention authority, and every selection must satisfy operator/legal minimum-custody and maximum-storage constraints. Without a complete configured or requested policy, intake stops before commit. Project-owned structured configuration errors preserve exact invalid paths, bounded values, recovery guidance, and causes. Configuration digests bind every sensitive attempt; operation payloads, producers, Workers, delegates, installed packages, and Check output cannot override canonical configuration.

Responsibility rules may define domain stewardship, review classes, scoped Authority Grants, independence requirements, and Contribution Routing inputs. Profiles and ownership hints improve matching but grant no authority. Repository-provider access supplies coarse membership only; Project Server still authorizes each exact operation against current project policy/state. CodeWiki App or IdP may own login/token acquisition, but project config trusts only bounded issuer/proof policy; no App role or unsigned identity grants project authority.

Check requirements do not live in `.codewiki/config.json`. They are ordinary tracked files under `.codewiki/check-packs/<stage>/<pack>/<check-id>/`. A Pack may also contain one optional standard Agent Skill under `skill/<skill-name>/`. Folder presence defines the active stage set. There is no protected Check floor, required default, applicability catalog, enforcement tier, or activation transaction. Users may edit or delete all Packs. Project Server snapshots exact Pack Skills for producer attempts and exact Check files and configuration for Gates. Skill and Check identities remain separate so only incompatible attempts or cached Results are invalidated.

Project configuration stores one exact installed Domain Plugin identity plus exact provider/account/credential-reference/model routes, context windows, reasoning and timeout options, one user-selected Harness route, Decision/Planning/Review inheritance or override, an independent Worker route pool, explicit Worker escalation transitions, execution custody, budgets, and policy references. Model Check routes remain Check-owned and have no implicit fallback to Harness, Worker, producer, or delegate models. Planning and models cannot widen these pools or transitions. Project files contain no provider credential, broker capability token, or raw DSH/Cordis configuration.

Backend v1 project may select one admitted Domain Plugin identity but cannot install DSH, Infrastructure Provider, Runtime Bridge, or Client Plugin code; executable composition comes from release/operator admission. Semantic target removes Domain selection, requires local Git as canonical store, and uses one CodeWiki Plugin Protocol only for external mechanics: project files may select admitted manifest digests/capabilities and bounded config, never package roots, executable paths, permissions, admission, or authoritative-ref writers. Unknown Plugin config fails closed. Roles may select only authorized routes and capabilities exposed by that fixed composition while retaining separate context, tools, memory, Sessions, and budgets. Any route, executable Plugin closure, model, or custody change alters execution identity and invalidates incompatible attempts, calibration, and cached Results according to their separate contracts.

Backend v1 canonical layout is:

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
      software-development-default/
        skill/<skill-name>/        # optional
        <check-id>/
      <pack-name>/
    planning/
      software-development-default/
      <pack-name>/
    implementation/
      software-development-default/
      <pack-name>/
    review/
      software-development-default/
      <pack-name>/
  check-packs.lock.json
```

`.codewiki/` contains governed declarations and canonical project meaning only. It never contains daemon endpoints, ownership locks, Client Sessions, Session/Work Continuity journals, DSH Agent Session bytes, caches, sockets, Workbenches, logs, temporary files, publication artifacts, bearer tokens, credentials, or generic runtime residue. Physical `.codewiki/runtime/` and `.codewiki/views/` roots are prohibited. Supported schema-less legacy roots require an explicit stopped-Project-Server migration: declared durable bytes move to their exact external owner, all legacy bytes enter a digest-verified quarantine, undeclared entries and symbolic paths fail closed, and successful migration removes both roots permanently.

Knowledge under `kb/**` is the exact materialized checkpoint of current accepted desired Knowledge State under one bound Domain Plugin and compiler identity; its subjects and independently mutable facets carry immutable path-independent semantic IDs. Change Traces under `traces/**` are append-only Change, judgment, completion, and effect history. The initial Knowledge seed plus confirmed Change Effects and synchronized state commits must reduce to the same Knowledge State digest represented by the checkpoint; mismatch stops mutation and recovery rather than selecting one silently. `config.json` and tracked Pack Skill and Check files remain separate source truth for their domains.

Markdown and YAML under `kb/**` remain portable agent-friendly OKF material. Compact durable intent is canonical there. Repeated indexes, expanded dictionaries, dossiers, expanded narration, status, queues, migration reports, WorkState, Alignment, Changes Backlog, App State, and other Views are deterministic projections produced on demand or cached only in private Backend state; a View is logical and does not imply a project-local file export. Backend-owned DSH Agent Sessions and delegated child traces are execution Evidence referenced by receipts, not project source truth. Compact Evidence metadata enters Change Trace; source payload belongs to policy-bound private Raw Data, while project and execution artifacts remain with their native owners. CodeWiki creates no canonical `.codewiki/evidence/` or `.codewiki/raw-data/` database and no generic `.codewiki/changes.log`. Root `CHANGELOG.md` records package releases, not project Change history.

Bootstrap creates the compact initial Knowledge State with immutable semantic IDs and validates and copies the selected Domain Plugin's `software-development-default` Pack template for each stage. It records exact Domain source and tree identities, invents no Pack Skill, and performs this seed only while creating the first project configuration. Existing projects adopt defaults explicitly; missing, edited, or deleted Packs are never recreated or overwritten by bootstrap, startup, or upgrade. After bootstrap, accepted Knowledge mutation occurs only through confirmed Decision; target creates one exact proposal commit under a managed Change ref, derives its Wiki Item diff, then uses a two-parent disposition commit and canonical-ref CAS. Direct/external Wiki bytes are drift and enter Change Intake. A stage with no Checks remains valid and its Gate passes with a visible warning. Source architecture declarations describe target dependency direction and are checked independently from temporary refactoring progress.

Target bootstraps repository/canonical ref with one config-only commit; empty Wiki has no Item path. Layout uses `wiki/items/**`, one full `changes/TRACE-CHG-<id>.jsonl` dossier per Change, pack-first `check-packs/<pack>/<stage>/<check>/`, lock, and config; no `traces/**` or Change snapshot. It stores no Domain or Pack Skills and installs no defaults. Templates require a Change. Plugins cannot install code or write authoritative CodeWiki refs; empty Wiki implies no Plugin or requirement.

SK2 is a separate stopped cut: it freezes Git object format and canonical ref, rejects dual roots, commits `kb/**` to `wiki/items/**` by expected-old-ref CAS under a backup tag, and removes Domain plus custom state/projection/checkpoint authority. An accepted active legacy Change supplies exact actor/authority/approval binding. External backup matches current canonical/private scopes, state generation, and Build digests without exposing bytes. Receipts bind active-Change plans/ref names; Git binds OIDs. One release compatibility component may retain legacy Packs, Checks, source-provider, or project behavior; active Build binds its generic digests, while legacy Domain identity is Evidence. SK4 migrates stage-first Packs, removes Pack Skills and residual Domain behavior, moves compatibility to fixed rules, Checks, config, or admitted external-mechanics Plugins, and activates Plugin Protocol/SDK. SK5 activates Raw Data custody and `source.observe`; ongoing connections stay external, and admitted Revisions may stale support or open intake but never update Wiki. Every cut has its own backup, collision check, expected Build, recovery transaction, Receipt, and rollback; none dual-reads or dual-writes replaced authority. The first target-only accepted operation is a later accepted Change/work/protected-effect Git commit or Receipt unrepresentable by source protocols; migration and maintenance audit Receipts do not count. Old-Build restore is allowed only before that boundary. Later recovery retains canonical first-parent history, terminal proposal ancestry, and fixed-path Trace blobs or repairs forward.
