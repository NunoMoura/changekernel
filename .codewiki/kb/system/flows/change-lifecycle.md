---
type: System Flow
codewiki_id: cw:flow:change-lifecycle
title: Change Lifecycle
description: Carries one Git-backed Change proposal through Decision acceptance, conditional work, completion, and guarded Delivery.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.maintain-intent
    rationale: Change Lifecycle preserves accepted meaning from intake through verified completion.
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Change Lifecycle advances exact state through Gate-controlled stages.
---
# Change Lifecycle

User/service acts through Kernel API Client. App/IdP may own login/proof acquisition; Project Server validates proof, maps Actor, authorizes operation, and admits exact expected canonical Git commit. Change Intake or direct authoring produces bounded proposal payload plus optional Wiki Item files. Project Server validates them and creates one proposal commit whose first parent is canonical, optional second parent is prior managed tip, and delta is limited to `.codewiki/changes/TRACE-CHG-<id>.jsonl` plus Item paths. It appends complete `change.proposed` and advances managed Change ref by CAS. That commit OID is version; first-parent/tree identity derives Wiki change. Proposal owns intent, rationale, outcomes, authority intent, explicit Completion Requirements, and completion rationale; it remains inert before Decision.

Decision uses Change-scoped Work Continuity. Candidate binds exact proposal commit/ref tip, canonical commit, derived Item diff, active Changes, WorkState, and requirements. Kernel Validation proves Git object types, Item bytes/IDs/relationships/provenance/retirements, expected canonical head, and complete resulting Wiki tree before Checks. Passed Gate only makes exact Candidate eligible.

Authorized Actor confirms unchanged Candidate/Gate. Project Server revalidates authority, active Changes, expected canonical commit, derived Wiki tree, proposal commit, and managed-ref tip, then creates one disposition commit whose parents are expected canonical and exact proposal tip. Acceptance uses validated proposed Wiki; rejection/defer/withdraw retains first-parent Wiki. Expected-old-ref CAS makes disposition atomic and second-parent ancestry retains complete proposal history. Each Trace blob byte-prefixes its predecessor; file order plus Git commit/path/blob identity replaces custom digest tips. No target compaction, truncation, replacement, or summary can remove full history.

Explicit `completionRequirements: []` makes a non-empty-diff Wiki-only Change complete in acceptance commit. Non-empty diff with requirements continues to work. Empty diff with non-empty Item-targeted requirements supports conformance repair when Wiki already states correct desired meaning; empty diff plus no work is rejected. Failed work leaves explicit Alignment gaps. After acceptance, correction, cancellation, compensation, or supersession uses a new Change proposal and disposition commit, never semantic rollback.

Planning maps non-empty requirements into one immutable Change-scoped Work Graph delta. Fixed Kernel Validation—not custom Planning Gate—enforces complete requirement coverage, judgeable units, acyclic dependencies, overlap order, resources, budgets, and aggregate Review needs. Project Server CAS-applies delta without replacing unrelated work, derives readiness, creates Claims/Assignments, and dispatches Runs.

Implementation evaluates each required Work Unit independently. One stage-wide Check Pack applies to exact Candidate inputs. Project Server owns isolated Git worktree/Workbench, integrates passing proposed artifacts into exact Change lineage, and alone advances canonical Git when guarded integration is admitted. Plugins may prepare external workspaces, observe verification, or prepare integration but cannot write authoritative CodeWiki refs, judge Results, or complete Change. Meaning changes return to Decision as a new Change with its own proposal version.

Review judges exact aggregate Git lineage and complete requirement coverage. Failed Review reopens exact unit, Planning amendment, or Decision according to typed owner. Passed Review permits only separately authorized fresh Delivery through `delivery.apply`. Required Delivery Receipt enters completion reduction. Project Server alone records `change.completed`.

Every terminal producer Run Receipt closes its physical DSH Session. Later work in same Work Continuity replays canonical/proposal commits, Wiki/Trace bytes, authority, feedback, requirements, Evidence, Results, capabilities, and predecessor Receipt; Project Server rebuilds WorkState, materializes one Run Context Bundle, and starts a fresh Session bound to it. Only same unreceipted Run crash recovery may resume Session.

Formal Model Checks remain fresh/tool-free/isolated. Gate snapshots exact subject, proposal or Candidate, Packs, declared inputs, Evidence, model routes, and execution config. Failed Results remain immutable feedback. Operational inability stops without Result; zero Checks passes with warning. Canonical Git writes/effects occur only after Project Server revalidates identity, authority, freshness, custody, requirements, and expected heads.
