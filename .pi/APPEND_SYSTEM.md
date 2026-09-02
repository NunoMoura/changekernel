# CodeWiki Source Repository Boundary

This repository develops CodeWiki as a normal source package. It must never load or dogfood mutable CodeWiki code from this checkout.

- `.codewiki/wiki/**` is desired-state design truth.
- `.codewiki/changes/**` is governed lifecycle truth.
- `SEMANTIC_KERNEL_PLAN.md` is the sole active refactoring roadmap and status ledger.
- `src/**` and `tests/**` are executable truth.
- Git is history and checkpoint evidence.
- Use Pi-native coding tools, pi-lens, normal file edits, tests, and Pi-native compaction.
- Do not call CodeWiki `wiki_*` tools or `/wiki-*` commands in this checkout.
- Do not install CodeWiki under this repository's `.pi/` directory or create project-local package links, duplicate skills, executable Plugin paths, controller pins, or dogfood state.
- Only an immutable externally installed Product release that passed exact-subject qualification, activation, and any required explicit controller handoff may govern a later candidate. Release activation alone does not transfer controller authority.
- Pack and test candidate bytes only in disposable external projects with isolated Pi settings.
- Generated Views, private DSH/Preview state, runtime scratch, credentials, caches, sockets, worktrees, and package artifacts are not source truth and do not belong in project Git.
