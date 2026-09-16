---
title: Work Unit Execution
aliases: []
source-id: cw:flow:work-unit-execution
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:8c2d0d5bb658fa0b9c59687a8f5d09fd53ebe715f0c8ebef80e96797d8d6fb5d
        codewiki.legacy:source-path: system/flows/work-unit-execution.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:flow:work-unit-execution
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Work Unit Execution provides isolated accountable implementation with immediate unit feedback.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# Work Unit Execution

A work unit is a bounded part of a Change's plan, not another knowledge primitive. Bind its exact input context, dependency assumptions, shared obligations, allowed paths/tools/effects, resource limits and expected observations before launch.

A worker can be human, service or Agent. The execution adapter enforces required isolation and observes custody; a worktree is only a working-directory mechanism. Missing enforcement or tools must be reported as unavailable rather than replaced by optimistic receipts.

Record truthful partial results, failures, discoveries and checkpoints. Do not silently revise intent or exceed scope. Reconcile unknown effects before retrying; process-local tracking alone does not establish restart safety or quiescence.

Judge output in its exact context and assess the integrated candidate against the actual baseline. One unit's success does not approve a conflicting join. Feedback can return to Implementation, Planning, or Decision, preserving the reasons for that route.
