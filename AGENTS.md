# Repository Agent Guidance

## Working rules

- Think before coding. State assumptions, surface tradeoffs, push back when warranted.

- Simplicity first. Minimum code that solves the problem. Nothing speculative.

- Surgical changes. Touch only what you must. Clean up only your own mess.

- Goal-driven execution. Define success criteria. Loop until verified.

## Repository boundaries

- Maintain one active source checkout at the repository's normal project path and one canonical GitHub remote. Keep proposals on named branches in that repository, not in long-lived competing clones. External packed-test projects are disposable; immutable releases, recovery backups, and historical evidence are not development checkouts.
- At session start, verify the working branch, exact commit, and the active plan's baseline/audit status. Never assume local `main`, a cached remote-tracking ref, a newer timestamp, or a directory named `worktree` identifies the approved baseline. Reconcile unique work before changing baselines or removing copies.
- Follow maintainer-approved R1 and its naming amendment in `SEMANTIC_KERNEL_PLAN.md`. R1 authorizes bounded native source development, not governed admission, live migration, or activation. Archived overlays and the proposal branch are donor evidence; reconcile meaning against the audited newer tree rather than copying old files wholesale. Inherited internal Check rubrics do not govern this revision.
- Dogfood only an immutable release that passed external exact-subject qualification and explicit activation.
- Never load CodeWiki from this checkout, a mutable package path, or this repository’s `.pi/`. Candidate N+1 never governs itself.
- Use Pi-native tools, pi-lens, normal edits/tests, and native compaction in this source checkout. Do not call CodeWiki `wiki_*` tools or `/wiki-*` commands here. Use any independently activated release only from its approved external environment and declared scope; a recorded historical handoff does not by itself establish current runtime authority.
- Within R1, ordinary implementation, diagnostics, tests, and reviewed Git checkpoints need no separate Change, release, prospective-OID permission, activation, or controller swap. Record exact scope and validation evidence; missing evidence is not success. Push, canonical-ref movement, live state conversion, credentials, paid model calls, and handoff still need applicable explicit authority.
- Prepare and review replacement guidance within the exact handoff candidate before qualification. The temporary bootstrap procedure sunsets before the first task governed by the activated release; truth/safety rules and higher-priority source-checkout restrictions do not expire.
- Released controller N qualifies exact committed release candidate N+1 outside this checkout. Any post-freeze correction requires a new commit, unique package version, and qualification.
- Pack and test release candidates only in disposable external projects with isolated Pi settings.
- Do not add project-local CodeWiki package links, duplicate skills, executable Plugin paths, or controller pins.
- Governed KB→Wiki migration is complete. `.codewiki/wiki/**` and `.codewiki/changes/**` are intended truth; `.codewiki/kb/**` and `.codewiki/traces/**` must remain absent. Never dual-read or dual-write.
- `.codewiki/wiki/**` is desired-state design truth; it contains stable behavior, not refactoring progress or temporary implementation status.
- `SEMANTIC_KERNEL_PLAN.md` is the sole active refactoring roadmap, status ledger, qualification record, and archive checklist. Historical plans remain unchanged.
- `src/**` and `tests/**` are executable truth. Git is history and checkpoint evidence.
- Governed Changes, append-only Traces, and managed CodeWiki refs are semantic/lifecycle authority. Generated Views and private runtime state are not source truth.
- Update Wiki only when desired behavior changes. Track every implementation gap and its sequencing in the active refactoring plan before changing source; do not derive unscheduled work directly from Wiki.
