---
title: Implementation to Review
aliases: []
source-id: cw:flow:implementation-to-review
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:8197f5d65cb91e13c22b33209aefff64fdeea3da7d4e3bc349e217852e0a7ab2
        codewiki.legacy:source-path: system/flows/implementation-to-review.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:flow:implementation-to-review
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Implementation to Review provides accountable unit completion and aggregate delivery proof.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Implementation and Review apply stage-wide project policy at unit and aggregate scopes.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
---
# Implementation to Review

Provide the exact reconciled candidate, baseline, work/attempt history, observations, changed assumptions and remaining obligations. Review must see the whole outcome and its relevant grounds, not only isolated worker successes or a passing branch-head test.

Distinguish produced artifacts, adopted knowledge and observed real-world realization. Unknown effects, missing support, stale evidence, redaction and truncation remain explicit. An owned gap is not realized merely because an attempt ended.

Review uses current applicable authority and semantic obligations, then routes defects, path conflicts or intent changes to their proper stage. Acceptance of this subject cannot silently cover later edits, publication, deployment or another rewritten/merged candidate.
