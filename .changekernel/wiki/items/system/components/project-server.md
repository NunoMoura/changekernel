---
title: Project Server
aliases:
  - Actor
  - Assignment
  - Authority Grant
  - Client Session
  - Project Server
  - Workbench
source-id: cw:component:project-server
ownership:
  sourcePatterns:
    - src/server/authorization/**
    - src/server/commands/**
    - src/server/effects/**
    - src/server/index.ts
    - src/server/queries/**
    - src/server/recovery/**
  testPatterns:
    - tests/server/authorization/**
    - tests/server/commands/**
    - tests/server/effects/**
    - tests/server/index.test.mjs
    - tests/server/queries/**
    - tests/server/recovery/**
  traceEvents:
    - change.completed
    - change.superseded
    - effect.recorded
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:ee961feb76f6e5c0a0cd3ec4f33b9b63d6e9bd81f18a193ec36ab244e0c8fd32
        codewiki.legacy:source-path: system/components/project-server.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:project-server
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Project Server keeps accepted work reachable, authorized, recoverable, and safely progressing.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Project Server classifies every observed Candidate and Git state by positive provenance proof.
          target: cw:story:maintainer.account-for-drift
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.account-for-drift
---
# Project Server

Project Server applies authorization and orchestrates ChangeKernel's semantic service over a scoped Project. Git-backed Wiki, Change and history are native requirements; external data connectors and hosting integrations are optional inputs or effects, not alternative acceptance authorities.

This runtime is part of the usable local ChangeKernel product; it does not require a Hub, hosting service or separate server deployment. The Hub may expose the same contracts to teams. The service authenticates actors, enforces project/data/effect scope, resolves sources once, binds baseline/candidate identities and validates bounded replay-safe requests. It orchestrates the four stages, their feedback loops and accepted scoped knowledge transitions. The backend owns common record meanings and transversal validation of every supported lifecycle transition. Adopted domain Checks supply field-specific policy assessments, not replacements for common validation. Judgments and provider receipts do not grant authority.

## Information and effects

Expose current knowledge separately from pending proposals and historical/external information. Native Git queries supply retained history even with no external connectors. Bounded retrieval does not adopt or retire knowledge, relax disclosure rules or execute source instructions. Useful interpretations enter accepted Wiki only through Change.

Git storage, inference/observation, Agent work, Preview and optional integrations use narrow effect boundaries. Credentials, raw writers/refs, concrete adapters and private custody are not normal client capabilities. Unsupported enforcement is unavailability, not successful execution. See [client protocol](client-project-server-protocol.md) and [integrations](provider-boundary.md).

## Check orchestration and state views

The agent prepares structured candidates and attributable Evidence. Project Server binds the release-owned [backend stage contract](changekernel.md#backend-validation-across-four-stages), current adopted domain Checks/Packs, actual sources and bounded per-evaluation inputs. Backend validators are explicit product requirements, not project-selected extensions. Domain activation follows actual effects and accepted policy, not candidate-selected exemptions. Inactive and unready are distinct. Technical validation, permission enforcement and missing-input rejection precede inference; subsequent semantic assessment can belong to either owner.

Share bounded execution, model dispatch, retention and reuse mechanisms where appropriate, while preserving backend versus domain ownership, stage question and exact implementation identity. Do not fabricate a project adoption to run a release-owned validator, accept caller-declared ownership or run a second inference engine merely because ownership differs. Domain assessments may supply grounds to a backend judgment under explicit dependencies; a final transition verdict is not a substitute for either evaluation.

Use the same isolated execution contract for first-party and company-authored domain Checks. Code can compute or inspect permitted read-only snapshots and request host-mediated structured inference; models have no tools. The library is not containment: enforce process, data, credential, network and resource boundaries outside Project Server. Checks cannot mutate source, artifacts, Wiki, policy or lifecycle state. Agent tool use and fresh collection remain separately authorized.

Retain exact backend and domain results, feedback, Evidence and execution conditions before consequential progression. Verify all applicable backend requirements and required domain passes for the current stage; a domain-only aggregate cannot enable a lifecycle transition. A pass report derives its justification, commit explanation and fresh-session handoff from those records, without adding claims or becoming a new ledger. Required valid passes and applicable approval remain separate. Reauthorize reads before cache use and reject stale readiness before effects even if scheduling missed an input change. See [Checks](checks.md) for replay and budgets.

Expose [desired outcomes, observed current state and related Changes](alignment.md) through bounded snapshots. Keep realization and work coverage separate; records, freshness, omissions and Check coverage are explicit. Do not run models just to render status or infer realization from a closed Change. Missing scope or source data is not proof that no gap or related work exists.

## Local proposal operations and persistence

The early-intake API uses explicit `changes.intake` and `changes.refine` capabilities with `codewiki.change-intake-input@1.0.0` inputs. These are target intake/refinement contracts, not currently enabled lifecycle operations. The implemented managed-document proposal operation is `changes.propose-profile`. Intake names command/Change identity, expected Project head, profile/build and proposal; refinement also binds expected Change tip/digest and a reason. The backend supplies revisions, source records and semantic digests, and reconstructs attachments from exact `afterCommit`/mappings rather than caller-certified references. An unsupported operation or attachment returns unavailability, not a pretend success.

Server compositions use the current Kernel document contract by default, or explicitly pin the same `kernelVersion`. The old `wikiProfile` selector, retirement-reservation settings, legacy lifecycle engine, Wiki projections and process-memory Gate store are removed. Unknown versions and obsolete fields fail before Store access. Current public availability is Project discovery/capabilities, managed-document proposal and `changes.read` with `view: "get"`; other operations report unavailable. No unsupported operation falls back to an old implementation. Proposal/inquiry `profile` fields are internal format identities, not independently selected releases. Intake requires unrestricted Change/Wiki scopes and its own capability. Refinement requires its own capability, unrestricted Wiki scope and access to the named Change. Reads retain their existing scopes. Check availability and authority before Store/facts access or cache lookup; no automatic grants from older operations or recovery into general-read permission. `changes.read` with `view: "get"` verifies the current concrete-proposal Trace and its exact retained source after authorized source binding. It does not promise recovery of every experimental Trace format. Cache/replay includes authorization identity and rechecks the current grant.

Use the common managed Change ref/path, append writer, native Store and atomic CAS. An unattached proposal copies its actual baseline; an attached one copies its exact candidate. Write only the responsible Trace onto that base and preserve other paths/history. Reject an occupied Trace path on creation or a rewritten prior prefix during revision. Retain the previous tip and required baseline/source/candidate commits as deduplicated parents, within the eight-parent snapshot bound; retain older grounds transitively. CAS advances only the Change ref and guards canonical unchanged. Intake/refinement never adopts Wiki, runs checks or executes Work by itself.

Reopening verifies each append's actual containing snapshot, retained parents, prefix and complete allowed delta. Per operation, bound recovery to 128 distinct snapshots, 1,048,576 inventoried entries and 64 MiB aggregate source/Trace/path bytes, alongside the stricter record/Trace/configured limits. Reuse immutable reads within the authorized request; do not re-resolve a mutable selector. Preflight the resulting history before preparation. Native paths retain exact bytes without widening mutation permissions or accepting hidden unrepresentable trees.

Replay locates retained command identity even after refinement, checks input digest plus actor/authority and returns the original event/actual persistence commit separately from current tip. Recover an existing command before imposing new-work current-head/build requirements. Observation failure is not a fabricated stale-head result. Pre-preparation denial or invalid source writes no objects; authorized preparation/CAS failure may leave unreachable objects, with no rollback promise. An uncertain response cannot become terminal success/failure through cache reuse; reconcile native history before retrying effects.

## Concrete profile Decision grounds

The internal Decision preparation path reuses the verified concrete-proposal loader. It checks the `decision.evaluate` capability, unrestricted Wiki scope and the named Change scope before reading sources. It resolves the canonical head and managed Change ref once each, requires the requested heads and the proposal's actual baseline to agree, and rejects a different interpretation build. Historical reads remain available under their existing rules; preparing a new evaluation does not silently rebase or reinterpret them.

A bounded `codewiki.profile-decision-grounds@1.0.0` manifest binds the current Project and containing snapshots, proposal, Trace, reduced state, transaction, Kernel build and configuration. Each before/after source inventories all loaded Markdown using exact UTF-8 path hex, Git blob identity, mode, byte count and raw-content digest. Non-Markdown exclusions remain explicit with their paths, modes, identities and reasons. Descriptor order is canonical, and raw source text remains available separately without normalization. Exceeding manifest bounds fails rather than truncating grounds.

This manifest is a material inventory, not proof of relevant semantic coverage. The loader does not produce a completeness flag, select checks, execute inference or accept a verdict. Applicable obligations, observed behavior, authority and evidence provenance still require explicit verification. The observed heads do not lock mutable refs: execution and eventual recording must reject changed grounds independently. This internal preparation does not enable `decision.evaluate`. New Gate recording and recovery still need complete retained grounds and end-to-end verification; the removed binary Gate engine is not a shortcut.

## Continuous inquiry

Common [intake](change-intake.md) admits proposed Changes into durable inquiry independent of a particular client session. The backend schedules Gate Checks and authorized refinement, and can generate attributed alternatives from related proposals. Generation does not certify its result; derived proposals re-enter the same checks and user-decision path. Filtering and sorting expose useful decisions without becoming acceptance authorities.

Verification is bounded and event-driven, not a permanently running model per Change. New proposals, meaningful revisions, new evidence or relevant baseline changes can justify work. Apply explicit access, inference, concurrency and resource budgets, backpressure, cancellation and replay-safe recovery. Avoid redundant comparisons and unbounded recursive derivation. Missing execution remains unavailable or unresolved; it is not a semantic rejection or pass.

Retain exact proposal revisions, Check results and derivation grounds in Git-backed Change history. Reopening reads recorded outcomes rather than rerunning inference. Reuse requires compatible exact subjects, inputs and interpretation conditions; changed authority is checked independently. A late result may remain evidence about its recorded older subject, but cannot mark a newer revision checked. Decision check subjects bind proposal revision/digest and Trace prefix, baseline commit/tree, source digests, applicable adopted knowledge and omissions, optional transaction/type context, build and execution configuration. Missing artifacts stay absent, not filled with fake OIDs. Runtime failure is distinct from unsupported or contradicted claims; empty domain Check selection establishes no domain assurance and cannot remove backend validation requirements. Current readiness and consequential acceptance reject stale grounds even if background scheduling missed a dependency. Queue position, caches, leases and live worker state remain private operational machinery, not a second authoritative ledger.

## Continuity

Preserve exact outcomes and accepted grounds in Git-linked records, not solely process-local maps or host UI state. Live leases, credentials, sockets and scratch remain private. [Recovery](../flows/recovery.md) reconciles custody, stopped work and unknown effects; request replay does not promise unobserved exactly-once external execution.

Read-only binding and queries never initialize, repair, convert or execute a project. Missing/malformed state produces honest errors or declared bounded limitations, not guessed success. [Project](project.md) defines repository binding; physical containment remains a separately enforced boundary.
