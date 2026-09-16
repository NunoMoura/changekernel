# ChangeKernel Source Repository Boundary

This repository develops ChangeKernel as a normal source package. It must never load or dogfood mutable ChangeKernel code from this checkout.

- `.changekernel/wiki/**` is desired-state design truth.
- `.changekernel/changes/**` is governed lifecycle truth.
- Durable design belongs in Wiki, not a standalone refactoring roadmap. Before qualified adoption, retain only a short temporary status note for unfinished work; afterward, Change and Work own execution state. AGENTS.md holds source-development procedure.
- `src/**` and `tests/**` are executable truth.
- Git is history and checkpoint evidence.
- Use Pi-native coding tools, pi-lens, normal file edits, tests, and Pi-native compaction.
- Do not call ChangeKernel `wiki_*` tools or `/wiki-*` commands in this checkout.
- Do not install ChangeKernel under this repository's `.pi/` directory or create project-local package links, duplicate skills, executable Plugin paths, controller pins, or dogfood state.
- Only an immutable externally installed Product release that passed exact-subject qualification, activation, and any required explicit controller handoff may govern a later candidate. Release activation alone does not transfer controller authority.
- Pack and test candidate bytes only in disposable external projects with isolated Pi settings.
- Generated Views, private agent/Preview state, runtime scratch, credentials, caches, sockets, worktrees, and package artifacts are not source truth and do not belong in project Git.
