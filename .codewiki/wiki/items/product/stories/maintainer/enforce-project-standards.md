---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:story:maintainer.enforce-project-standards","codewiki_user":"cw:user:maintainer","description":"A maintainer wants open project-owned Checks to gate each development stage with exact outcomes and actionable feedback.","status":"stable","tags":["product","story","checks"],"title":"Enforce Project Standards","type":"User Story"},"codewiki.legacy:source-path":"product/stories/maintainer/enforce-project-standards.md"},"itemId":"cw:story:maintainer.enforce-project-standards","itemType":"codewiki.legacy:user-story","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:b2f66b6e893b76455777eab2cb1231c7839ea4ac8580e7122cadb173c89a8bc5","codewiki.legacy:source-path":"product/stories/maintainer/enforce-project-standards.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:story:maintainer.enforce-project-standards"}],"relationships":[],"title":"Enforce Project Standards"}
---
# Enforce Project Standards

As a maintainer, I want project-owned standards applied independently to exact stage subjects so Agents cannot choose the policy that judges their work.

## Acceptance signals

- Project policy lives in tracked `.codewiki/check-packs/<stage>/<pack>/**` for Decision, Planning, Implementation, and Review.
- Packs are editable/removable project files; bootstrap and upgrade never silently restore changed policy.
- Project Server snapshots every Pack for the stage and deterministically resolves Gate active Checks from required Change type/realization, Work Unit subtype/scope where relevant, and exact subject facts.
- Checks with no selector apply to every subject in their stage. Selectors are positive bounded allowlists; unknown values, negative rules, arbitrary expressions, or incomplete facts stop Gate construction.
- CodeWiki ships Check mechanics without concrete defaults or internal rubrics. Projects explicitly author or adopt their standards; bootstrap writes an empty lock and seeds no Checks.
- Complete empty selection warns and supplies no semantic Check verdict. Missing or malformed policy, required inputs, unavailable execution, or invalid Results cannot become an empty pass.
- Safety-critical Checks are universal for their stage or selected only from deterministic exact-subject facts independent of producer-declared classification.
- Deterministic Kernel Validation remains release code rather than a Check and supplements rather than replaces project Planning or other stage Checks.
- Code Checks run in isolated credential-free network-denied sandboxes. Model Checks use separate DSH Runs and receive no producer context. Independent Preview verification uses `preview.verify`; Worker `preview.work` observations cannot satisfy it.
- One Check Run executes one active Check. Completed Runs may yield one immutable Result; operational failure yields none. Gate outcome is passed, failed, or stopped.
- Gate passage grants eligibility only; Project Server revalidates current Actor, subject, Gate, active Checks, Results, and expected heads before any transition.
- Release N reads accepted protected-head Check Pack snapshots to judge exact committed release candidate N+1. Subject bytes cannot author or activate their own judging policy.
