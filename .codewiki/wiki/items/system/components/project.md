---
{"aliases":["Git Project Store","Project Configuration"],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:project","codewiki_id":"cw:component:project","codewiki_relationships":[{"rationale":"Project Configuration supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}],"codewiki_source_patterns":["src/project/**"],"codewiki_test_patterns":["tests/project/**"],"description":"Owns mandatory Git repository identity/ref policy, routes, budgets, bootstrap, Check paths, source architecture, and project layout.","status":"stable","tags":["system","component"],"title":"Project Configuration","type":"System Component"},"codewiki.legacy:source-path":"system/components/project.md","codewiki.legacy:terms":[{"aliases":[],"definition":"Mandatory local repository with canonical first-parent history and managed active-Change refs for artifacts, Wiki, and traces.","term":"Git Project Store"}]},"itemId":"cw:component:project","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:a204a65c2254b0b68d9a400ff44377236b770d262a693573a520ff39d5818d49","codewiki.legacy:source-path":"system/components/project.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:project"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Project Configuration supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"}],"title":"Project"}
---
# Project

Project is one governed local Git repository plus its small tracked CodeWiki configuration. Git is the mandatory Project Store for exact artifacts, Wiki Items, Change Traces, Check Packs, commits, trees, blobs, ancestry, and refs. Configuration declares how Project Server interprets that repository; it is not a peer state database or semantic owner.

## Git Project Store

Every Change revision, Work result, Change Commit, and Change Completion Commit identifies a full governed Project snapshot. Change scope limits semantic delta, authority, and admission; it never defines a partial repository. The configured canonical project ref records first-parent accepted state. `refs/codewiki/changes/<id>` records one Change's proposal and realization history.

Project Server is the sole writer of canonical and managed CodeWiki refs. Mutations use optimistic snapshot isolation, complete-object/tree validation, and short expected-old-OID compare-and-swap transactions. No lock spans user deliberation, DSH execution, Check execution, or Review. Stale work stops with exact reconciliation facts; CodeWiki never force-pushes, silently merges semantics, or applies last-write-wins.

Git stores bytes and ancestry. Change Trace stores why, who, lifecycle facts, Results/receipts, and exact OIDs. WorkState, Alignment, Dictionary, search, and other indexes are derived. Operational Git recovery may restore exact proven refs inside qualified rollback bounds; changed accepted meaning requires another Change.

## Tracked layout and configuration

`.codewiki/config.json` uses Domain-free format `2.0.0`. Mandatory semantic roots are `.codewiki/wiki/items/**` and `.codewiki/changes/**`. Project Check policy lives under `.codewiki/check-packs/<stage>/<pack>/**` plus exact transport lock identity. `.codewiki/kb/**`, `.codewiki/traces/**`, `.codewiki/runtime/**`, `.codewiki/views/**`, and generated Wiki indexes are invalid target state.

Configuration selects repository identity, frozen Git object format, canonical project ref, semantic roots, public API/AuthZ policy references, exact admitted Plugin identities/config, DSH role routes, budgets, and retention/qualification policy. It cannot add lifecycle stages/statuses, semantic owners, arbitrary Change types, automatic merges, proposal-selected Checks, credentials, executable project-local Plugin paths, or authority grants.

Change type taxonomy and realization routes are fixed Kernel protocol. Check Packs are editable project-owned files, not config fields. Target DSH route config binds explicit Decision, Planning, Worker, Review, and Model Check routes plus provider/account/credential references and ceilings. No role silently inherits a generic route; DSH owns internal Session/provider/tool mechanics.

Credentials, private DSH state, leases, sockets, caches, worktrees, raw logs, execution evidence, Plugin state, and generated Views remain below an external repository-identity-bound owner-private State Root. Project files contain references and policy only. Symlinks, path escape, ambient secrets, and in-repository private state fail closed.

Admitted Plugins bind exact immutable manifest/implementation/dependency identities, protocol ranges, configuration schema, capabilities, permissions, isolation, and qualification Evidence. Project config may select an installed allowlisted identity and bounded options. It cannot install code, widen operator floors, grant managed-ref writes, create Results, or define stages.

Bootstrap is passive and explicit. It may create initial config, a valid empty Wiki/Trace state, and one-time release Check Pack templates only in a new Project. Existing Projects adopt resources through reviewed operations. Startup validates bytes but never repairs, restores, compiles, migrates, calls providers, runs Agents/Checks/Plugins, or changes refs silently.

Current migrated schema limits remain fixed: each legacy System Component body is at most 10,000 characters and Recovery Flow body is at most 8,000 characters. A limit change requires a governed schema/protocol Change.

Legacy Backend-v1 config, Domain identity, Runtime Build, and `quality.review` fields remain readable only through explicit compatibility/migration boundaries. Unknown, drifted, or mixed semantic-root state stops. Migration is backup-first, exact, and one-way; target operation never dual-reads or dual-writes old owners.
