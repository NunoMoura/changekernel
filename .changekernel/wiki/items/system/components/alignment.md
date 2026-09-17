---
title: Alignment
aliases:
  - Alignment
  - Alignment View
  - Contribution Routing
source-id: cw:component:alignment
ownership:
  generatedViews:
    - alignment
  sourcePatterns: []
  testPatterns: []
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:775ff8481e19c3a4ff0a48fbbe2ba09fab2916b9785576cc7b8edbbbde4a6fc2
        codewiki.legacy:source-path: system/components/alignment.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:component:alignment
  relationships:
    - attributes:
        codewiki.legacy:relationship:
          rationale: Alignment supplies bounded impact and provenance facts for accountable decisions.
          target: cw:story:maintainer.account-for-drift
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:maintainer.account-for-drift
    - attributes:
        codewiki.legacy:relationship:
          rationale: Alignment supplies the horizontal and vertical exact-input facts required by repository-aware Checks.
          target: cw:story:check-author.author-composable-checks
          type: realizes
      predicate: codewiki.legacy:realizes
      targetItemId: cw:story:check-author.author-composable-checks
---
# Alignment

Alignment is a derived view answering: **What do we want, what can we demonstrate, and what are we doing about the difference?** It connects accepted Wiki outcomes, retained Evidence about actual artifacts or external conditions, and related Changes. It is not another authoritative State, task, outcome or observation database.

## Desired, observed and related work

| View | Meaning |
| --- | --- |
| Desired state | Accepted outcomes and commitments in exact Wiki passages, with scope, timing, conditions and exceptions. A proposed target is not yet adopted. |
| Observed current state | What retained Evidence, backend validations and applicable domain Check results establish about a subject, environment and time. It is not an omniscient inventory of reality. |
| Related Changes | Proposed, accepted, ongoing, paused or completed work claiming to realize, investigate, preserve or revise those outcomes. Presence is not delivery. |

A desired outcome is not Evidence of its realization. Wiki can require 30-day retention while an actual process retains data for 60 days. A Change may fix implementation or explicitly revise the target; neither a policy edit nor a configuration edit alone proves production deletion. Desired knowledge can be adopted before realization, with the remaining gap visible.

Separate continuing constraints from future targets and deadlines. An accepted improvement target can be unmet without being an immediate violation. The backend preserves that common distinction using exact adopted Wiki and retained assessments; domain policy supplies the particular conditions and measurements, not a universal business threshold. External reality can change without a commit.

## Realization and coverage are independent

Report realization as established, contradicted, or not established within declared scope, using plain presentation such as met, not met or unknown. This is a derived explanation of backend/domain evaluation and Evidence records, not another multi-valued Check-result primitive. Boolean false still distinguishes observed mismatch, inadequate Evidence and operational inability through feedback.

Report related work independently: which exact Changes claim to cover all or part of the outcome, a prerequisite, an investigation or an explicit target revision. Several Changes can contribute to one outcome and one Change to several outcomes. A backlog link is a coverage claim, not proof. Agents propose links; backend validation assesses common contribution and coverage claims using applicable domain assessments; the backend retains the exact grounds and limitations. Similar names, a closed Change or generic passing Checks do not establish realization.

No recent measurement means unestablished, not necessarily unmet. A completed investigation can establish a gap without closing it. A scheduler update can leave historical data cleanup uncovered. No Change found is meaningful only within declared authorized search coverage; do not infer absence from redacted or truncated results.

## Bounded read primitives

The Check library and agent-facing reads expose desired outcomes in scope, relevant Evidence, Changes linked to an outcome and their declared contributions. Outcomes may be referenced as exact Wiki passages; mandatory new identifiers or a separate outcome registry are unnecessary. Preserve passage continuity across authorized revisions rather than guessing from title similarity.

For evaluation, supply bounded projections from the frozen authorized snapshot with exact Wiki, Evidence, artifact, Change and configuration identities, source roles, timestamps and omissions. Code can inspect its permitted snapshot; models receive bounded data without tools. A read does not adopt knowledge, repair sources, execute work or grant authority. Changing relevant sources, policy or validity conditions invalidates dependent reuse.

Backend Review validation owns common realization and coverage accounting, informed by adopted domain Checks whose questions address the specific outcome criteria. A common judgment cannot replace required scientific, engineering or other domain support. Neither path infers semantic success from formatting, lifecycle closure or an axis label. Rebuild views from retained records without rerunning models merely to render status. Exact identity proves neither completeness nor factual truth.

## Directed improvement

Within granted authority an agent can identify uncovered gaps, suggest or create proposals, connect existing work, expose duplicate effort, gather missing Evidence and reconsider work after changed targets or new counterevidence. Detection does not itself authorize acceptance, implementation or protected effects. A self-improving project still needs scoped permission, budgets, containment and [immutable controller qualification](package.md#minimum-local-dogfood); naming a factory or backlog is not enforcement.
