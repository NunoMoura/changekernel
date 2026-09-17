---
title: Planning
aliases:
  - Planning
  - Work Unit
  - Work View
source-id: cw:component:planning
ownership:
  roles:
    - planning
  sourcePatterns:
    - src/server/lifecycle/planning/**
  testPatterns:
    - tests/server/lifecycle/planning/**
  traceEvents:
    - change.planned
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:c644d4c2dd94e3ef57e10161aaa6ea03d7f16bce6096130b253ab19e808b0d2f
        codewiki.legacy:source-path: system/components/planning.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:planning
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Planning supplies the System responsibility required by this Story.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# Planning

Planning turns accepted intent into a credible path, with intermediate outcomes, dependencies, shared commitments, work boundaries, and Evidence needs. A fresh session receives the accepted Decision report and exact source references, not a replayed private conversation. Backend-owned Planning validation assesses common path and decomposition requirements; adopted stage-specific domain Checks assess the methods and criteria particular to the project. Both return attributable targeted feedback through bounded read-only evaluation. Planning is a stage for knowledge work as well as implementation, not optional ceremony reserved for code changes. Its agent–gate feedback loop develops and repairs the plan without making the stage itself a loop.

Work units are the agent-managed decomposition of a committed Change, not independently user-approved Changes. Agents choose and revise technical steps, assignments and local validation within the accepted design and effect boundary. Completion of a Work unit is an intermediate result; Review assesses the actual joined outcome. Ask the user again for material intent, design, scope or authority changes, not routine implementation choices.

Planning is recorded through the Change's Work items, dependencies, shared obligations and evidence requirements, not a mandatory standalone plan document. A rendered plan is a view of that state, not another authoritative roadmap. Wiki holds reusable design and procedures; Change/Work holds execution progress. Before the product can govern that state, a short temporary development status note is sufficient and must not fabricate lifecycle history.

The Work decomposition preserves meaning. It distinguishes prerequisites that must hold before a step, consequences expected afterward, and obligations maintained throughout. Independent files or individually acceptable destinations do not prove independent execution: one worker can invalidate another's assumptions or a shared control.

Parallel work identifies dependencies and shared contracts before launch, then requires validation of the actual integrated Proposed Change. For example, UI, backend, and observability tasks share a no-secret-logging obligation even when they edit different files. A plan may be concise for small work, but its applicability and evidence boundary cannot be bypassed by labeling a Change “knowledge-only.”

Inquiry, enabling work, and risk reduction can justify detours. There is no universal distance-to-target metric every step must decrease. Consequential uncertainty can create an investigation step rather than a falsely certain schedule. An efficient plan cannot excuse a forbidden intermediate effect.

## Planning validation boundary

The backend requires the plan to cover accepted intent and exclusions, identify responsible work and usable prerequisites, order dependencies, preserve shared commitments through intermediate states, and specify the Evidence needed to assess outcomes. It validates Work relationships and authority as well as the credibility of the proposed path. A mere list of tasks or individually plausible steps is not sufficient support for the combined plan. Consequential unknowns require explicit investigation, containment or a narrower undertaking rather than a guessed schedule.

Domain Checks assess whether chosen engineering/test techniques, experimental protocols or other field-specific procedures can meet their adopted criteria. The backend does not supply universal scientific methods, software testing thresholds or professional standards. Domain assessments inform the common path judgment without replacing it. Decision readiness cannot be relabeled as a validated detailed plan; this stage binds its actual Work and sources.

Feedback revises the decomposition when paths conflict; unclear or materially changed intent returns to Decision. Assignment, execution and protected effects still need applicable authority. See [Planning to Implementation](../flows/planning-to-implementation.md) and [Work state](work-state.md).
