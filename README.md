# ChangeKernel

**An owner-controlled ledger of pursuits, preserving intent, decisions, evidence and accountable progress across sessions and agents.**

A **Change** holds a developing intent contract and its pursuit history. A **Ledger** is its owner's collection of Changes. These are the two core primitives. WHY, WHAT and HOW are dimensions of intent, not required fields or a prescribed workflow.

The foundation should let agents work intelligently and creatively within agreed authority. Explicit obligations remain distinct from context and provisional tactics. Native applications retain their data, business rules and permissions; ChangeKernel is not their database or a universal workflow engine.

## Current source

The current implementation is an **unqualified, in-process Rust foundation**, not an operational product:

- Pure agreement, authority, adaptation and settlement rules.
- Explicit binding/context selections, exact operation/material references and immutable criterion links.
- Grant-bounded fresh-material recording, immutable origins, separate reuse/disclosure and original-result recovery.
- Application coordination over trusted fixture ports, with behavioral and failure-boundary tests; no durable acceptance or authentic host/source enforcement yet.

The legacy referenced-intent CLI, ordinary-Pi adapter, persistence path and npm package machinery have been retired. There is no replacement CLI, durable service, authenticated host or native execution implementation. Bounded agreement rules now permit incomplete drafts and term-scoped progress without criteria, but refuse criterion-free fulfillment. General composed/temporal completion remains open.

| Path | Responsibility |
| --- | --- |
| `src/kernel/change/pursuit.rs` and `pursuit/{rules,material}.rs` | Domain types, pure rules and material authority |
| `src/application/pursuit.rs` | Guarded operation coordination and original-result recovery |
| `src/application/pursuit_ports.rs` | Explicit trusted boundary contracts, not production implementations |
| `src/lib.rs` | Unqualified source exports, not a supported SDK |
| `tests/adaptive_pursuit*`, `tests/adaptive_authority_adversarial.rs` | Model-free behavioral and adversarial checks |

## Controlled source checks (Linux)

Build preparation now pins Rust **1.99.1** (edition 2021), rusqlite **0.41.0** with only `backup`/`limits`, libsqlite3-sys **0.39.0** and prost **0.14.4** with `derive`/`std`. A bounded current-development Protobuf codec is implemented; the SQLite store is not. No protoc or bundled SQLite is used.

Use an isolated external Cargo home/target and a disposable external native staging directory. Prerequisites are Python 3.11+, Rust 1.99.1 with rustfmt/clippy, `/usr/bin/cc`, `ar`, `readelf` and `nm`; do not install OS packages as part of a build. Explicitly fetch the locked crates once before offline checks:

```sh
export CARGO_HOME=/absolute/external/cargo-home
export CARGO_TARGET_DIR=/absolute/external/cargo-target
rustup run 1.99.1 cargo fetch --locked
native=/absolute/external/native-staging
```

Stage the official `sqlite-amalgamation-3540100.zip` (2,990,966 bytes) at `$native/`, with its unmodified `sqlite3.c`, `sqlite3.h` and `sqlite3ext.h` under `$native/source/`. The helper verifies archive SHA3-256 `92281c86e2957f9b9305890f9ac04204caa7b677cc868dc326d942689df28e30`, source bytes, version and source ID before building. It never downloads source.

```sh
python3 scripts/native_sqlite.py build "$native"
python3 scripts/native_sqlite.py verify "$native"
python3 scripts/native_sqlite.py cargo "$native" fmt --check
python3 scripts/native_sqlite.py cargo "$native" clippy --locked --all-targets -- -D warnings
python3 scripts/native_sqlite.py cargo "$native" test --locked
```

The helper supplies explicit include/library paths, static linkage, offline Cargo and `SQLITE3_NO_PKG_CONFIG=1` (the sys crate otherwise probes even with a library path). Compiler/linker overrides and unreviewed lock changes are refused. The package build guard rejects absent/wrong profiles rather than successfully linking ambient SQLite. It independently reproduces the static archive from checksum-verified source; a supplied report/hash alone is insufficient. The native probe and tests verify the actual version/source ID/options and linkage, thread safety, disabled extension loading and disabled double-quoted string literals. Future storage opening must call `adapters::native_profile::verify_runtime()` before using the engine.

The 18 locked crates use MIT/Apache-2.0 licensing, with Unicode-3.0 additionally required by `unicode-ident`. Preserve applicable upstream licenses/copyright notices on distribution. Source checks and native build verification are not release, host, storage or power-loss qualification. An IDE running build scripts also needs the controlled environment; do not bypass the guard to silence missing-`OUT_DIR` diagnostics.

## Product direction and development

**Related Changes organize intent; optional work units organize execution within a Change.** Pursuits can reveal new related Changes without forming a decomposition tree. Work preparation can be separated from resource allocation and dispatch, with distinct execution attempts—not mandatory planning/execution phases. Completing work does not itself fulfill intent. These are adopted design directions, not implemented queue or parallel-execution capabilities; see the [relationship](CHANGEKERNEL_SYSTEM.md#related-changes) and [work-unit](CHANGEKERNEL_SYSTEM.md#work-units-and-execution) operation matrices.

**Pi Durable is the only target product host.** Agents will use typed tools and authorized Views over one service protocol, composable from code mode. Host admission and outcome recording must happen below agent-authored scripts; schemas, integration and recovery still require qualification. No new CLI is planned.

- [System](CHANGEKERNEL_SYSTEM.md): adopted design, constraints and unresolved mechanisms.
- [Status](CHANGEKERNEL_STATUS.md): implementation gaps, assignments, checkpoints and evidence.
- [AGENTS](AGENTS.md): development, review and check procedure.

Development is intent → approved docs → code review → implementation/tests → qualification. Existing code does not override design. Keep current implementation and valid WIP in the tree; Git preserves retired code and historical records without making them current interfaces.

## Source safety

Never load this mutable checkout as its controller or install ChangeKernel under its `.pi/` directory. Use Pi-native development tools. Pack and test candidate packages only in disposable external projects with isolated Pi/HOME/settings.

Source tests do not establish release qualification or controller authority. Dogfooding requires a qualified immutable external release, activation and explicit handoff. See the [qualification boundary](CHANGEKERNEL_SYSTEM.md#qualification-and-controller-boundary).

## License

MIT
