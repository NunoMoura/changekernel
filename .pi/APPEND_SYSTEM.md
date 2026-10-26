# ChangeKernel Source Repository Boundary

This repository develops ChangeKernel as a normal source package. It must never load or dogfood mutable ChangeKernel code from this checkout.

- `CHANGEKERNEL_SYSTEM.md` is the living desired-state design document, including adopted contracts, explicit proposals and unresolved mechanisms.
- Development is docs → code: approve desired state, review code for compliance, then implement and test. Existing code does not determine product intent.
- `CHANGEKERNEL_STATUS.md` holds current implementation gaps and unfinished execution state; `AGENTS.md` holds procedure. Do not create a competing roadmap or governed state. After qualified handoff, Change and Work may own execution state.
- `src/**` and `tests/**` are executable truth, not proof that desired capabilities already exist.
- Git preserves history and exact checkpoints. Keep only relevant implementation and valid WIP in the current source tree; preserve unique bytes before removal. Historical lifecycle records remain historically meaningful without keeping a `.changekernel/` source directory.
- Use Pi-native coding tools, pi-lens, normal file edits, tests, and Pi-native compaction.
- Do not call ChangeKernel `wiki_*` tools or `/wiki-*` commands in this checkout.
- Do not install ChangeKernel under this repository's `.pi/` directory or create project-local package links, duplicate skills, executable Plugin paths, controller pins, or dogfood state.
- Only an immutable externally installed Product release that passed exact-subject qualification, activation, and any required explicit controller handoff may govern a later candidate. Release activation alone does not transfer controller authority.
- Pack and test candidate bytes only in disposable external projects with isolated Pi settings.
- Generated Views, private agent/Preview state, runtime scratch, credentials, caches, sockets, worktrees, and package artifacts are not source truth and do not belong in project Git.
