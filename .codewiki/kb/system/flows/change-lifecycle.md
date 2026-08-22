---
type: System Flow
codewiki_id: cw:flow:change-lifecycle
title: Change Lifecycle
description: Carries natural-language intent through an exact Knowledge transition, Change-scoped Planning, Work Unit realization, aggregate Review, and guarded Git effects.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.maintain-intent
    rationale: Change Lifecycle preserves accepted meaning from intake through realization.
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Change Lifecycle advances exact state through Gate-controlled stages.
---
# Change Lifecycle

A User or service acts through a Client and may express desired meaning in natural language. Project Server authenticates the connection, authorizes the Actor for one exact project operation, admits expected state, normalizes Change Intake, and records one proposed transition from accepted Knowledge State `S0` to intended state `S1`. A harness may translate the request into context handles, stable Knowledge targets, complete post-state Effects, rationale, outcomes, and acceptance requirements; Project Server expands handles before immutable revision identity, but the result remains proposed intent. Accepting intake starts accountable evaluation; it does not accept `S1`.

Decision uses one Change-scoped producer continuity. The Stage Producer directly submits its disposition and rationale for one exact Change revision without repeating that revision's complete Knowledge Effects or explicit unchanged-Knowledge references. Project Server materializes the Candidate from that revision, derives machine-owned fields, resolves stable subject and facet IDs, validates expected prior state or absence, and deterministically compiles the transition before freezing an immutable Gate Evaluation Package. That package contains the exact Candidate, current and projected Knowledge State identities, compiler and application-plan identities, accepted active Changes, relationships, accepted Work Graph projection, comparison coverage, Check Pack, and execution configuration. Clients and Checks consume Project Server-derived current, desired, and diff projections; no model regenerates accepted bytes.

A passed Decision Gate makes only the unchanged exact Candidate eligible for confirmation and accepts no meaning. An authorized actor confirms it against current accepted active Changes, WorkState, and Knowledge State heads. Project Server uses expected-head compare-and-swap so stale or incompatible transitions cannot both take authority. Only confirmed `approve` atomically records the accepted Change operation, applies its already-compiled Knowledge Effects, commits resulting Knowledge and WorkState identities, and advances to Planning. Confirmed `reject`, `defer`, or `withdraw` records typed disposition without mutating Knowledge.

Planning uses one Change-scoped producer continuity and proposes one immutable Work Graph delta for that ratified Change. Its Work Units map exact accepted Effect and requirement IDs to source, test, Evidence, and integration obligations without restating or changing desired meaning. The Planning Gate judges complete acceptance coverage, independently judgeable Work Units, dependency and overlap ordering, resource requirements, and aggregate Review obligations. Project Server CAS-applies a passing delta to the canonical global Work Graph without regenerating or replacing unrelated accepted work. It then derives ready Work Units, creates Claims and Assignments, and dispatches exact Runs through Runtime.

Implementation repeats the Candidate and Gate pattern independently for each required Work Unit. One resolved stage-wide Implementation Check Pack policy applies to every Work Unit Candidate; only immutable evaluation inputs vary. Each Candidate binds changed source and test artifacts to the stable Knowledge targets and requirements it realizes. Passing Candidates enter the Change-owned private integration lineage through expected-head compare-and-swap. A unit failure returns to that Work Unit loop. A stale or conflicting integration requires a new Candidate. A discovery that changes desired meaning returns to Decision. The Change remains in Implementation until every required unit has a current passing Gate, integrates successfully, dependency closure holds, and one exact aggregate lineage head can be frozen.

Review uses a fresh independent continuity and judges that exact aggregate Change lineage through the Review Check Pack. It proves complete realization of the ratified Knowledge Effects and requirements, cross-unit behavior, full integration, provenance, scope, and delivery readiness. A failed Review Gate normally reopens affected Work Unit Implementation; a decomposition defect requires an explicit Planning amendment and a meaning defect requires Decision. Project Server owns these typed transitions. A passed Review Gate permits only separately authorized, fresh, expected-head-safe delivery. Git records the exact realized tree and history; Alignment connects that realization back through Evidence, Candidates, Work Units, requirements, Effects, and stable Knowledge identity.

Producer Runs may span several bounded processes through persistent DSH Agent Sessions, but every Candidate has exactly one producing Run. Formal Model Checks remain fresh, isolated, tool-free, and one session per top-level Check; they judge Candidates and never produce project changes. Each Gate snapshots exact subject, Packs, declared inputs, Evidence, model routes, and execution configuration. Operational inability stops without fabricating a Result; zero Checks passes with a visible warning. Canonical writes and effects occur only after Project Server revalidates identity, authority, provenance, Candidate and Pack freshness, required completion state, and expected heads.
