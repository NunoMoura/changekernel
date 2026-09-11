# Repository Agent Guidance

- Start at the current entry in `SEMANTIC_KERNEL_PLAN.md`. Verify branch, exact HEAD and worktree state; preserve existing work. Follow only its current bounded scope. The plan owns procedures, sequencing, status and validation requirements.
- `.codewiki/wiki/**` defines desired behavior; `src/**` and `tests/**` define executable behavior. Keep refactoring progress in the plan. Preserve `.codewiki/changes/**` as lifecycle history.
- Delegate implementation by default with clear scope, requirements and acceptance criteria. Parallelize independent work; isolate concurrent writers.
- The parent owns routine Work decisions, thoroughly reviews actual code and tests, fixes valid findings and validates final bytes before checkpointing. Review and acceptance are parent responsibilities, not a separate reviewer-subagent gate. Take over when delegation fails; escalate material design, scope or authority changes, not routine implementation choices.
- Keep guidance and Wiki Items high-signal, low-noise. Preserve essential meaning, rationale, evidence, uncertainty, exceptions and disagreement; omit boilerplate, duplication and progress chatter.
- This source checkout never governs itself. Use native coding tools, not CodeWiki `wiki_*` tools or `/wiki-*` commands. Never load CodeWiki from mutable code or install it under this repository’s `.pi/`. Pack and test candidates only in disposable external projects with isolated settings.
- Push, canonical-ref movement, live state conversion, credentials, paid model calls, activation and controller handoff require applicable explicit authority.
