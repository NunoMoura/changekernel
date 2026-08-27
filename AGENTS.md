# Repository Agent Guidance

## Working rules

- Think before coding. State assumptions, surface tradeoffs, push back when warranted.

- Simplicity first. Minimum code that solves the problem. Nothing speculative.

- Surgical changes. Touch only what you must. Clean up only your own mess.

- Goal-driven execution. Define success criteria. Loop until verified.

## Repository boundaries

- Dogfood only an immutable release that passed external exact-subject qualification and explicit activation.
- Never load CodeWiki from this checkout, a local package path, or this repository’s `.pi/`. Candidate N+1 never governs itself.
- Use CodeWiki tools only from the activated release; otherwise use Pi-native tools and compaction.
- Released controller N qualifies exact committed candidate N+1 outside this checkout. Any correction requires a new candidate and qualification.
- Pack and test candidates only in disposable external projects with isolated Pi settings.
- Do not add project-local CodeWiki package links, duplicate skills, executable Plugin paths, or controller pins.
- `.codewiki/kb/**` is intended truth until governed KB→Wiki migration; `.codewiki/wiki/**` is authoritative afterward. Never dual-read or dual-write.
- `src/**` and `tests/**` are executable truth. Git is history and checkpoint evidence.
- Governed Changes and CodeWiki refs are workflow evidence. Generated views and private runtime state are not source truth.
- Update KB and source/tests together. Surface drift instead of silently choosing one side.
