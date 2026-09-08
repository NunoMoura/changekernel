---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:flow:change-lifecycle","codewiki_relationships":[{"rationale":"Change Lifecycle preserves accepted meaning from intake through verified completion.","target":"cw:story:maintainer.maintain-intent","type":"realizes"},{"rationale":"Change Lifecycle advances exact state through Gate-controlled stages.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}],"description":"Carries one Git-backed Change proposal through Decision acceptance, conditional work, completion, and guarded Delivery.","status":"stable","tags":["system","flow"],"title":"Change Lifecycle","type":"System Flow"},"codewiki.legacy:source-path":"system/flows/change-lifecycle.md"},"itemId":"cw:flow:change-lifecycle","itemType":"codewiki.legacy:system-flow","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:e7a8556fdc48492d58e44e7417f82cf8b45edd4d1a4daaffafd341cf88cf7904","codewiki.legacy:source-path":"system/flows/change-lifecycle.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:flow:change-lifecycle"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Lifecycle preserves accepted meaning from intake through verified completion.","target":"cw:story:maintainer.maintain-intent","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Change Lifecycle advances exact state through Gate-controlled stages.","target":"cw:story:maintainer.automate-safe-work","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.automate-safe-work"}],"title":"Change Lifecycle"}
---
# Change Lifecycle

CodeWiki's Git-compatible version-control interface exposes an intent-first lifecycle: semantic merge first, artifact merge second. A Change is one stable intention, one append-only Trace, and one managed Git ref. Every ref tip is a full Project snapshot; Project Server alone writes canonical and managed CodeWiki refs.

```text
Draft Change
  -> Proposed Change
  -> Decision Gate
      -> commit
      -> reject
      -> defer / resume
      -> withdraw
```

The four stages are domain-neutral. Decision accepts intended meaning; Planning bounds work and verification; Implementation produces project artifacts; Review judges complete integrated realization. Checks apply throughout. Software tests and builds are domain-specific mechanisms, and Review is not necessarily a human meeting or deployment approval. Passing local obligations does not establish complete combined coverage or consistency.

New governed improvements share intake regardless of destination, including CodeWiki itself. Explicit proposal capability may be held by human, service, or Agent-backed Actors; it grants no acceptance authority. Existing authorized Work and routine checkpoints do not each repeat the lifecycle.

Draft conversation is non-authoritative. `proposeChanges` admits one authenticated, idempotent batch of independently decidable proposals atomically while preserving separate Change IDs and later outcomes. Each Proposed Change binds an expected project head and expected Change tip. Stale input returns exact reconciliation facts; CodeWiki never performs silent semantic merge or last-write-wins.

Project Server validates the complete Project tree, append-only Trace, Wiki result, authority, Change type, realization route, and active-Change compatibility. It resolves exact Decision Check Packs and freezes the Gate's type-conditioned active Checks. Check Runs judge the exact Proposed Change tip. A passed Gate grants eligibility only; an authenticated `commitChange` command and final expected-head CAS create authority.

`changeType` describes purpose; `realization` describes whether the accepted snapshot already achieves the complete outcome. A terminology clarification may be Wiki-only. Requiring a new project capability is project realization even when its initial proposal edits only Wiki. Small or Wiki-only policy changes can require stringent Decision Checks. There are no arbitrary producer-selected stage-skipping flags.

The Change Commit has the current project head and exact Change tip as parents. It commits accepted Wiki intent and records `change.committed`. If the full snapshot is a true Wiki-only realization, the same commit records `change.completed`. Otherwise it creates an explicit, owned Alignment gap and the Committed Change continues.

```text
Committed Change
  -> Planning Gate
  -> independently gated Work Units
  -> integration on Change ref
  -> Review Gate
  -> Change Completion Commit
  -> Completed Change
```

Planning maps committed Wiki target Items/facets to singly owned Work Units, dependencies, scope, capabilities, and verification without restating outcome prose. The Planning Gate uses project-owned, Change-type-conditioned Checks in addition to fixed structural validation. Accepted planning facts enter Trace; a derived Work View exposes graph/readiness.

Workers execute exact Work Units through DSH Runs and isolated Git worktrees. Each result is a full Project snapshot. Type- and Work-Unit-conditioned Implementation active Checks judge it; passing current commits integrate onto the managed Change ref. Workers cannot edit accepted Wiki or managed refs. Meaning defects return to Decision as another Change.

Before Review, Project Server explicitly reconciles the integrated Change artifact delta with current canonical history on the managed Change ref. Conflict, interaction ambiguity, or changed bytes returns work for repair and fresh affected Checks. Review compares that exact prospective Completion project-artifact tree with the Committed Change and unchanged canonical parent. A passed current Gate allows Project Server to create the Completion Commit under expected-head CAS while preserving every reviewed project-artifact entry and appending only the bounded containing-commit Trace operation. Canonical drift restarts reconciliation and affected Review. Failure returns work to the responsible Work Unit, Planning, or a Superseding Change; stop preserves state. Delivery follows as a separately authorized protected effect and does not redefine local completion.

Before commitment, rejection, withdrawal, or deferral changes only managed Change history. After commitment, intent cannot be rejected or withdrawn. Implementation failure leaves the Change active, blocked, or superseded; only reviewed realization or a Wiki-only Change Commit completes it. Accepted history is corrected only through a new Change.

Native and supported Git-compatible commands preserve the same authorization and exact-subject rules. An ordinary Git commit is a development checkpoint, not `commitChange`, passing Checks, completion, or activation. Protected writes remain enforced independently of the compatibility executable; system Git and operator-authorized recovery remain available.

In the qualified DSH execution profile, every controlled Agent uses a DSH Run with exact Project/Wiki/Trace inputs, role-specific read-only Wiki tools, bounded capabilities, and receipt evidence. Stage Check Packs define available policy; frozen Change type and exact subject determine Gate active Checks. Project Server validates all transitions and derives state from Git, Trace, Results, and Receipts.
