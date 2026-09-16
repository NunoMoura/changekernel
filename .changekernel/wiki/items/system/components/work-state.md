---
title: Work State
aliases:
  - WorkState
source-id: cw:component:work-state
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:fe5f253c85ec39a77fd0750019ac3cfc9c8098fcab9a64fe4adb9a7343ac173b
        codewiki.legacy:source-path: system/components/work-state.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:work-state
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: WorkState supplies current stage truth for bounded Agent context and deterministic rehydration.
          target: cw:story:agent.retrieve-bounded-context
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:agent.retrieve-bounded-context
---
# Work State

Work state is a derived view of a Change's plan, dependencies, attempts, retained Evidence, accepted partial outcomes, and remaining commitments. [Alignment](alignment.md) links that work to desired Wiki outcomes and scoped current-state assessments; a queued or completed task does not itself establish realization. It is not a third primitive, an independent task database, or a source of authority.

Readiness depends on exact current facts and shared obligations, not only a queue label or a predecessor marked done. One task can invalidate another's preconditions without touching its files. Individually accepted work does not establish validity of the resulting join.

Expose scope, responsibility, blockers, uncertainty, custody and next permitted action. Distinguish planned, attempted, checkpointed, integrated, accepted and realized work. An owned gap remains a gap. An operational stop or unknown effect is not a semantic rejection or permission to replay.

Rebuild views from exact retained Git/Change records and authoritative observations, with private live custody reconciled separately. Missing, stale, redacted and truncated context must be explicit. The view cannot repair its sources, launch work, or manufacture completion.
