---
type: System Flow
codewiki_id: cw:flow:remote-state-synchronization
title: Remote State Synchronization
description: Reconciles mandatory local canonical Git history with external remotes through authenticated expected-head mechanics.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.recover-history
    rationale: Remote State Synchronization provides the stable cross-component behavior required by this Story.
---
# Remote State Synchronization

Backend v1 fetches/pushes Git refs directly and verifies reduced Knowledge against materialized checkpoint. Target keeps local Git repository/configured canonical ref as authority and reaches remote hosts only through admitted `remote.observe | remote.publish` Plugin Requests.

`remote.observe` returns authenticated provider head/object facts and no local-write authority. Project Server imports objects through sanitized Git plumbing, verifies complete ancestry/object types, accepted Change/Trace operations, Wiki Item tree/retirements, signatures or provider proof required by policy, and expected local head before any canonical-ref CAS. Divergent accepted histories stop for explicit reconciliation.

`remote.publish` is a separately authorized external effect over one exact canonical commit and expected remote head. Plugin Receipt plus follow-up observation proves provider outcome; status alone never means accepted publication, Change completion, or local mutation. Network failure, malformed/incomplete objects, unsupported protocol/object format, stale head, or contradictory history rejects synchronization. Project Server never resolves disagreement by silently choosing local bytes, remote refs, Trace, or Wiki.
