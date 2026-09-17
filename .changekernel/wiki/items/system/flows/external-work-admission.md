---
title: External Work Admission
aliases:
  - External Candidate Admission
  - External Work Admission
source-id: cw:flow:external-candidate-admission
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:f40a8168c23a009cc63e7d5724e1473f74586e308fb08d089f36565780312b40
        codewiki.legacy:source-path: system/flows/external-candidate-admission.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:flow:external-candidate-admission
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: External Candidate Admission prevents unaccounted Git divergence from inheriting CodeWiki certification.
          target: cw:story:maintainer.account-for-drift
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.account-for-drift
    - attributes:
        codewiki.legacy:relationship:
          rationale: External Candidate Admission provides a safe path for useful work created outside controlled execution.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# External Work Admission

Incoming commits, patches or host events are observations of work, not proof of a valid Change, authority, producer identity or custody. Preserve exact received subjects and provenance without invented reasons or retrospective approval.

External source retrieval is not itself work admission or knowledge adoption. Material can inform inquiry; changing accepted Wiki requires an accepted scoped Change. Git history remains native rather than imported through an optional connector.

Determine whether work fits existing authorized scope or needs a proposal. Labels, branch names and PR links cannot bypass actual-effect assessment. Evaluate the true combined Proposed Change; a host merge flag or isolated old-head result is not its acceptance receipt.

Observation, acceptance, publication and deployment retain their own authority boundaries. Do not execute incoming instructions or untrusted code during discovery, especially with privileged hosting credentials. See [intake](../components/change-intake.md).
