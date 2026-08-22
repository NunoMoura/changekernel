---
type: System Flow
codewiki_id: cw:flow:remote-state-synchronization
title: Remote State Synchronization
description: Synchronizes canonical Change, accepted Knowledge checkpoint, and Git state with expected-head compare-and-swap protection.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.recover-history
    rationale: Remote State Synchronization provides the stable cross-component behavior required by this Story.
---
# Remote State Synchronization

Project Server fetches provider-neutral Git refs, validates canonical bytes and identities, reduces the initial Knowledge seed plus globally ordered confirmed Change Effects, and compares the exact expected remote head before push. The reduced Knowledge State digest must equal the synchronized materialized Knowledge checkpoint. After mutation it resynchronizes and verifies every accepted Change, Knowledge, WorkState, Git, and Alignment identity.

Network failure, unknown required protocol or compiler identity, malformed Change history, irreducible or contradictory Knowledge checkpoint, stale base, or head mismatch rejects the mutation. Local work remains recoverable, but no caller may infer remote acceptance without post-push verification. Project Server never repairs disagreement by choosing Trace, Knowledge bytes, or Git state silently.
