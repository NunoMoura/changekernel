---
title: Change Lifecycle
aliases: []
source-id: cw:flow:change-lifecycle
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:e7a8556fdc48492d58e44e7417f82cf8b45edd4d1a4daaffafd341cf88cf7904
        codewiki.legacy:source-path: system/flows/change-lifecycle.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:flow:change-lifecycle
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Change Lifecycle preserves accepted meaning from intake through verified completion.
          target: cw:story:maintainer.maintain-intent
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.maintain-intent
    - attributes:
        codewiki.legacy:relationship:
          rationale: Change Lifecycle advances exact state through Gate-controlled stages.
          target: cw:story:maintainer.automate-safe-work
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.automate-safe-work
---
# Change Lifecycle

A Change carries intentional evolution through four stages: Decision, Planning, Implementation and Review. Gates control progression between stages. A feedback loop is the interaction between an agent preparing or revising work and the gate returning assessment feedback; it is not another name for a stage. The backend evaluates its [release-owned stage contract](../components/changekernel.md#backend-validation-across-four-stages) together with adopted [domain Checks](../components/checks.md). Validation common to all domains belongs to ChangeKernel; field-specific conditions belong to adopted project policy and Checks. Either may use computation or bounded semantic assessment. Shared execution and result mechanisms do not detach questions from stages or make their verdicts interchangeable.

The normal feedback loop is: the agent prepares work → the gate assesses exact submitted versions → the agent responds to actionable feedback → the gate reassesses eligible revised inputs or reuses exact retained results. A stage may pass its first assessment or require several repair rounds. Feedback may return work to an earlier stage when the cause lies there. Operational uncertainty stops for investigation rather than triggering an automatic retry. Passing assessments remain separate from approval and permission to perform the transition.

Common [intake](../components/change-intake.md) admits attributed proposals from conversation, documents, discoveries, external signals or other Changes. Unfinished inquiry may be retained before concrete effects are known. Evaluation requires a fixed structured Proposed Change and selected inputs; missing inputs make Checks unready, not inactive. A derived proposal preserves exact source relationships and needs its own current evaluation and authority.

| Stage | Purpose and assessment boundary |
| --- | --- |
| Decision | Backend validates justified pursuit of exact intent and effects; domain Checks assess the required field-specific grounds. Do not claim a completed plan or realized benefit. |
| Planning | Backend validates a credible decomposition with dependencies, intermediate obligations and Evidence needs; domain Checks assess the chosen methods and procedures. |
| Implementation | Backend validates authorized, attributable contributions and truthful partial outcomes; domain Checks assess actual execution/artifact standards. Evaluators do not perform the worker's edits. |
| Review | Backend validates the actual combined outcome, supported realization and remaining gaps; domain Checks assess field-specific outcome criteria for that exact join. |

Run applicable ready backend validations and domain Checks on immutable inputs, retain their distinct results and send failures to their cause. Continue with repair or inquiry, pause for clarification/budget/unavailable execution, or terminate by rejection/withdrawal. Only successful progression requires all applicable required valid passes from both owners and separate transition authority. Empty domain selection cannot satisfy backend requirements or be presented as domain assurance. Required missing assessments remain blockers. Execution errors are not semantic counterevidence; approval cannot turn a failed Check into a pass. No routine human Check verdict or new approval is needed for every delegated Work unit.

Backend requirements come from the immutable ChangeKernel release, not project adoption. Domain Check selection comes from current authorized adopted state, not the Proposed Change's proposed replacement. Agents cannot reduce scrutiny by labels, omitted data or installing a Pack. Cheap preconditions and required-input checks precede expensive work; independent Checks can run concurrently within limits. Reuse retained evaluations only under verified input and execution equivalence, not by stage name, confidence or repeated retries.

A pass report explains stage-specific backend validation and adopted domain coverage, reasons, Evidence, uncertainty and what comes next. After applicable acceptance it supplies the concise commit explanation and a fresh next-stage session's context; it does not grant permission or replace canonical records. [Decision to Planning](decision-to-planning.md) specifies the first handoff. Meaningful source changes can invalidate readiness; starting a fresh session alone does not require rerunning judgments.

Only accepted scoped transitions promote, revise, retire or re-adopt Wiki. Checkpointing, checking, approval, adoption, realization and external delivery are distinct. An accepted desired outcome can remain unrealized with its [gap and related work](../components/alignment.md) visible. Branches and commits are not stage flags or a mandatory four-commit protocol.

Feedback routes artifact defects to Implementation, path conflicts to Planning and material intent/design/scope/authority changes to Decision. Assess joined artifacts rather than inheriting isolated successes. Preserve original reasons, actual source versions and stopped or unknown effects. Git retains exact accepted outcomes and history; recovery does not repeat a model or protected effect to invent the old result. See [Planning to Implementation](planning-to-implementation.md), [Implementation to Review](implementation-to-review.md), and [recovery](recovery.md).
