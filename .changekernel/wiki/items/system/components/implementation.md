---
title: Implementation
aliases:
  - Implementation
  - Integration
  - Work Unit result
source-id: cw:component:implementation
ownership:
  roles:
    - worker
  sourcePatterns:
    - src/server/lifecycle/implementation/**
  testPatterns:
    - tests/server/lifecycle/implementation/**
  traceEvents:
    - work.assigned
    - work.attempt.recorded
    - work.claimed
    - work.integrated
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:02c3190bbb4c804f0037d2b3e01735632350a7765f5717871c144a6426f232ff
        codewiki.legacy:source-path: system/components/implementation.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:implementation
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Implementation supplies the System responsibility required by this Story.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# Implementation

Implementation attempts authorized transitions from a plan and records exact partial outcomes, observations, failures, and discoveries. It includes changes to knowledge, procedures, experiments, and other team artifacts as well as software. A committed artifact is evidence of a representation, not proof that the intended real-world effect occurred.

Workers receive bounded context, scope, dependencies, shared obligations, and permitted effects. Missing or redacted consequential context must remain visible. Work units, assignments, runs and branches support the Change; they are not additional knowledge primitives or proof of completion.

Agents perform authorized tool use, artifact creation and Evidence collection. Adopted Checks evaluate immutable submitted inputs without changing artifacts, Wiki, policy or Project Server state. Required failures return actionable feedback; unavailable execution is not a fabricated semantic verdict. Use cheap feedback and work-in-progress checkpoints during work. No new Change is required for every command or repair within accepted scope. An implementation defect stays here; a conflicting decomposition returns to Planning; material intent revision returns to Decision. Do not change the acceptance target silently to match produced bytes.

An attempt can fail operationally without refuting its intent. Preserve stopped or unknown effects and truthful partial output. A retry needs reconciled custody and effect state, not only a plausible plan or clean worktree. Worktrees are not process, credential, network, or adversarial filesystem sandboxes.

Integrate only under applicable authority against the actual baseline and resulting candidate. Independently acceptable work can conflict after composition. Review evaluates the whole and remaining obligations; integration is not deployment. See [work execution](../flows/work-unit-execution.md) and [Implementation to Review](../flows/implementation-to-review.md).
