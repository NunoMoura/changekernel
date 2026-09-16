---
title: Review
aliases:
  - Review
  - Review Gate
source-id: cw:component:review
ownership:
  roles:
    - review
  sourcePatterns:
    - src/server/lifecycle/review/**
  testPatterns:
    - tests/server/lifecycle/review/**
  traceEvents:
    - review.reconciled
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:dec0e210d6e9ba5e0c1d0b3ce481e7eb143485fcca0402d3cfb341a0e690fe29
        codewiki.legacy:source-path: system/components/review.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:review
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Review supplies the final repeatable stage between integrated work and guarded Delivery.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
    - attributes:
        codewiki.legacy:relationship:
          rationale: Review applies project-owned delivery Checks to one exact aggregate Change lineage.
          target: cw:story:maintainer.enforce-project-standards
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
---
# Review

Review evaluates the exact reconciled outcome: whether intent survived decomposition and recomposition, what is realized, what remains uncertain or unfulfilled, and whether acceptance is authorized. It uses the same adopted custom Check contract as Decision, Planning, and Implementation, with Evidence about the combined candidate rather than only promised effects. The selected Pack determines semantic coverage; neither lifecycle closure nor a generic pass establishes every desired outcome.

Bind the assessment to its actual baseline, candidate artifacts and knowledge, retained commitments, evidence, and scope. Individually passing tasks or old branch-head results do not establish validity of a different join. Every resulting artifact or knowledge change must be accounted for; no unreviewed residue can enter acceptance through an unrelated merge step.

Distinguish supported, contradicted, and unresolved claims. Required assurance cannot be replaced by an empty check set, an author's classification, a host merge flag, or a model's confidence. Normative adoption, observed realization, owned gaps, and completion of this Change are different claims. Partial knowledge can be accepted under an explicit scoped decision without declaring all intended effects realized.

Route feedback to its cause: artifact defects to Implementation, path/dependency problems to Planning, and unclear or materially revised intent to Decision. Rejection or supersession preserves reasons and reusable discoveries rather than erasing the investigation.

Acceptance records exact outcomes and remaining obligations with their grounds. Publication, remote synchronization, deployment and other protected effects are separately authorized. Later external drift can require reassessment without altering historical acceptance. See [evidence](evidence.md), [alignment](alignment.md), and [recovery](../flows/recovery.md).
