# ChangeKernel

**An owner-controlled ledger of pursuits, preserving intent, decisions, evidence and accountable progress across sessions and agents.**

A **Change** holds developing intent and its history; a **Ledger** is its owner's collection. Native apps retain their data, rules and permissions. ChangeKernel is an **unqualified Rust foundation with bounded local persistence, elementary local reads and a fixture-only structured read adapter**, not an operational product, supported SDK or authenticated host service.

## Documentation and source

- [System](CHANGEKERNEL_SYSTEM.md): desired architecture, [philosophical foundations](CHANGEKERNEL_SYSTEM.md#philosophical-foundations), authority, operations and read contracts. The implemented [P34 profile](CHANGEKERNEL_SYSTEM.md#p34-first-delivery-boundary) is the local-owner delivery subset, not the complete read API.
- [Status](CHANGEKERNEL_STATUS.md): implemented slices, gaps, approvals, checks, preserved work and resumption.
- [AGENTS](AGENTS.md): development/review procedure, documentation limits and Rust style.

| Source | Responsibility |
| --- | --- |
| `src/kernel/change/` | Pure domain types, Content authority and rules |
| `src/application/` | Guarded coordination, retained OperationRequests, public read types and supplied Ports |
| `src/adapters/codec/`, `src/adapters/sqlite/` | Bounded Protobuf, guarded persistence and nonmutating local reads |
| `src/adapters/read_adapter/` | Fixture-only JSON request validation, framed calls and faithful public projection |
| `src/lib.rs`, `src/unqualified_change.rs` | Routing and explicitly unqualified exports |
| `tests/` | Behavioral and failure-boundary checks, not qualification |

P34 exposes `sqlite::{read_local, read_local_framed}` from one Included `OriginalReference`, using supplied owner/disclosure/custody checks. `ReadCall` covers cursor resolution, history pages and exact retained Content; codec helpers handle read framing. See `src/application/read*.rs` and `src/adapters/sqlite/cold_read.rs`.

`adapters::read_adapter::read_fixture` accepts bounded JSON request bytes, makes one framed P34 read and returns `Result<serde_json::Value, AdapterError>`. It preserves qualified identities, exact bytes, wide integers, provenance, coverage and cursors. Semantic refusals remain structured results, distinct from adapter failures and empty success. The [public function documentation](src/adapters/read_adapter/fixture_read.rs) defines the request representation and example; [System](CHANGEKERNEL_SYSTEM.md#fixture-only-read-adapter-core) defines the fixture boundary and limits. Trusted Rust wiring supplies owner/disclosure/custody observations; JSON grants no authority. There is no automatic paging, retry or hidden fetching. The live agent-facing host adapter remains unimplemented.

Legacy CLI, ordinary-Pi adapter, persistence path and npm package machinery are retired. No replacement CLI, durable service or native execution implementation exists. Naming changes preserve stored tags, bytes and SQL names without aliases or migration; they establish no general style conformance. Pi Durable is the first intended host, not the exclusive one; [host qualification](CHANGEKERNEL_SYSTEM.md#host-boundary) remains separate.

## Controlled source checks (Linux)

Use the [pinned build/encoding profile](CHANGEKERNEL_SYSTEM.md#adopted-trusted-port-durable-records), not ambient SQLite or a relaxed IDE configuration. Prerequisites: Python 3.11+, Rust 1.99.1 with rustfmt/clippy, `/usr/bin/cc`, `ar`, `readelf` and `nm`. Do not install OS packages as part of a build.

Use isolated external Cargo home/target and disposable external native staging. Explicitly fetch locked crates once before the offline checks:

```sh
export CARGO_HOME=/absolute/external/cargo-home
export CARGO_TARGET_DIR=/absolute/external/cargo-target
rustup run 1.99.1 cargo fetch --locked
native=/absolute/external/native-staging
```

Stage official `sqlite-amalgamation-3540100.zip` (2,990,966 bytes) at `$native/`, with unmodified `sqlite3.c`, `sqlite3.h` and `sqlite3ext.h` under `$native/source/`. The helper verifies archive SHA3-256 `92281c86e2957f9b9305890f9ac04204caa7b677cc868dc326d942689df28e30`, source bytes, version and source ID. It never downloads source.

```sh
python3 -I -B tests/native_dependency_guard.py
python3 scripts/native_sqlite.py build "$native"
python3 scripts/native_sqlite.py verify "$native"
python3 scripts/native_sqlite.py cargo "$native" fmt --check
python3 scripts/native_sqlite.py cargo "$native" clippy --locked --all-targets -- -D warnings
python3 scripts/native_sqlite.py cargo "$native" test --locked
```

The helper supplies explicit include/library paths, static linkage, offline Cargo and `SQLITE3_NO_PKG_CONFIG=1`; the sys crate otherwise probes despite an explicit library path. Compiler/linker overrides and unreviewed lock changes are refused. The build guard independently reproduces the static archive from verified source; a supplied report/hash is insufficient. Wrong/missing profiles fail, never silently link ambient SQLite. Native probes/tests check actual version, source ID, options, linkage, thread safety and disabled extension loading/double-quoted strings; opening calls `adapters::native_profile::verify_runtime()` before engine use.

Fixtures use `$native/sqlite-fixtures`, derived from the verified `CHANGEKERNEL_SQLITE_STAGE` build setting. Unit/integration tests require absolute external Linux/Btrfs staging and a private mode-0700 fixture root. Missing, unsupported or project-local staging fails; no temporary-directory fallback or automatic cleanup of existing fixtures. An IDE running build scripts needs the same controlled environment; never bypass the guard to silence missing-`OUT_DIR` diagnostics.

The 26 locked external crates permit MIT and/or Apache-2.0 licensing, using memchr's reviewed MIT option, with Unicode-3.0 additionally required by `unicode-ident`. The adapter's exact Serde/JSON profile preserves the existing native and Protobuf dependency versions/features. Preserve upstream licenses/copyright notices on distribution. Build separately for artifact claims; checks do not establish host, storage, power-loss or release qualification.

## Source safety

Never load this mutable checkout as its controller or install/link ChangeKernel into its `.pi/`. Use Pi-native development tools. Pack/test candidate bytes only in disposable external projects with isolated Pi/HOME/settings. Controller authority requires a qualified immutable external release, activation and explicit handoff; see the [qualification boundary](CHANGEKERNEL_SYSTEM.md#qualification-and-controller-boundary) and repository boundary in `.pi/APPEND_SYSTEM.md`.

## License

MIT
