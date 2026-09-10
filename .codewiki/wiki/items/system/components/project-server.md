---
{"aliases":["Actor","Assignment","Authority Grant","Client Session","Project Server","Workbench"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/server/authorization/**","src/server/commands/**","src/server/effects/**","src/server/index.ts","src/server/queries/**","src/server/recovery/**"],"testPatterns":["tests/server/authorization/**","tests/server/commands/**","tests/server/effects/**","tests/server/index.test.mjs","tests/server/queries/**","tests/server/recovery/**"],"traceEvents":["change.completed","change.superseded","effect.recorded"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:project-server","codewiki_id":"cw:component:project-server","codewiki_relationships":[{"rationale":"Project Server keeps accepted work reachable, authorized, recoverable, and safely progressing.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"},{"rationale":"Project Server classifies every observed Candidate and Git state by positive provenance proof.","target":"cw:story:maintainer.account-for-drift","type":"realizes"}],"codewiki_source_patterns":["src/project-server/**","src/git/**","src/utils/**"],"codewiki_test_patterns":["tests/project-server/**"],"description":"Owns proof validation, project AuthZ, canonical state, Change acceptance/completion, Work, Gates, Plugin admission, effects, recovery, and subordinate Runtime.","status":"stable","tags":["system","component"],"title":"Project Server","type":"System Component"},"codewiki.legacy:source-path":"system/components/project-server.md"},"itemId":"cw:component:project-server","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:ee961feb76f6e5c0a0cd3ec4f33b9b63d6e9bd81f18a193ec36ab244e0c8fd32","codewiki.legacy:source-path":"system/components/project-server.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:project-server"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Project Server keeps accepted work reachable, authorized, recoverable, and safely progressing.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.automate-safe-work"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Project Server classifies every observed Candidate and Git state by positive provenance proof.","target":"cw:story:maintainer.account-for-drift","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.account-for-drift"}],"title":"Project Server"}
---
# Project Server

Project Server is the service-side authorization and orchestration boundary for CodeWiki Hub. It applies the semantic kernel to exact Git-backed subjects and authorized observations. A local composition, remote service, CLI, or other client can present this boundary without making one hosting provider the owner of acceptance.

## Responsibilities

- Authenticate actors and enforce operation, project, data, and effect scope before disclosure or execution.
- Resolve an input source once, bind baseline/candidate identity, validate request bounds and replay identity, and return attributable outcomes.
- Orchestrate proposal, semantic assessment, the four stage loops, checkpointing, review, and separately authorized effects.
- Preserve semantic reasons and outcomes in portable Wiki/Change history, while maintaining private live-operation custody and recovery state at their proper boundary.
- Expose honest capabilities, missing context, operational stops, and next permitted actions rather than infer readiness from a configured interface.

The kernel owns semantic distinctions and transition consequences. Models, humans, and tools contribute interpretations or observations; neither a result nor a provider receipt grants authority. The server must not silently treat an absent verifier, empty test set, or successful host merge as semantic approval.

## Narrow effect boundaries

Git storage, observation/evaluation execution, Agent work, Preview, and external integrations use bounded effect interfaces according to the supported profile. Their concrete adapters, credentials, raw writers, refs and private custody handles are not normal client capabilities. Procedure knowledge stays in Wiki, not separately managed Skills or Check Packs.

Exact authenticated requests do not establish physical containment. If an executor cannot enforce required path/tool/network/resource scope or observe quiescence, that capability must be unavailable. Protect execution before it occurs; accepting an eventual output cannot retroactively authorize a forbidden effect.

## Continuity and recovery

Committed outcomes and judgments must survive a process or Agent restart; process-local maps alone are insufficient. Live leases, sockets, credentials, scratch and tracking remain private runtime state, not a second semantic truth store. Distinguish reusable observations from stale judgments and unknown effects. Reconcile before retry; request replay does not promise exactly-once behavior in an unobserved external system.

Read-only binding and queries must not initialize, repair, convert, or execute a project. Missing/malformed state receives honest errors or explicitly bounded degraded reads, never guessed success. See [Project](project.md), [client protocol](client-project-server-protocol.md), and [recovery](../flows/recovery.md).
