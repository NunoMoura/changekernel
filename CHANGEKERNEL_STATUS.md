# ChangeKernel source-development status

This is the temporary handoff before qualified adoption. [Wiki](.changekernel/wiki/items/product/changekernel.md) owns desired design, [AGENTS.md](AGENTS.md) owns source procedure, and Git preserves completed reviews. Change and Work own execution state after adoption.

## Accepted checkpoint

- **Manager:** `/home/canina7/Projects/changekernel-workers/integration`, branch `integration/rust-kickoff-01`.
- **Native code:** `c1c0e54ad0d29a77e7910cf36fcf1edc3a3fc29a`: accepted corrected intake plus committed-source observation. R2-A was accepted only with the manager's object-identity, process-cleanup and error-classification repairs; R2-B was accepted at `853fcf65e`. Detailed verdicts/checks are preserved at `4250a9c36:CHANGEKERNEL_STATUS.md`.
- **Actual source checks:** 20 native tests, fmt, clippy and active LSP checks passed; independent corruption, lock, descendant and blocked-stdin probes passed. Evidence: `/tmp/changekernel-r4-manager-probes.I0J4eI/`. This is bounded local Git/Linux source evidence, not operational qualification.
- **Supporting package:** `416c79d8211580fec5e5ec1b8cb425ba58f76d21` freezes the adapter-only entrypoint/build and removes the Node launcher/historical engine exports. Its 70 adapter tests, artifact build and active LSP checks passed. Test retirement is `114a099bd`; [testing policy](.changekernel/wiki/items/system/components/package.md#testing-policy) requires no JS campaign for Rust-only work or tests of compiler guarantees.

## Active worker assignments: R4

The user confirms both worker sessions are running. Their branches still had only the assignment commits when preparation of the next slices began; no submitted implementation has been reviewed or accepted. Do not redirect them to R5 or edit their owned paths while they finish R4.

Both worktrees use exact base `416c79d8211580fec5e5ec1b8cb425ba58f76d21`, independently of the Rust fixes.

| Worker | Branch and worktree | Assignment-only revision | Exclusive outcome |
| --- | --- | --- | --- |
| A / R4-A | `work/retire-ts-host`, `/home/canina7/Projects/changekernel-workers/retire-ts-host` | `e17b4a24992802b3b1913f128435ee6e0d5d839e` | Remove historical TS server/API, non-Pi adapters, product policy and four unused host/storage ports. |
| B / R4-B | `work/retire-ts-kernel`, `/home/canina7/Projects/changekernel-workers/retire-ts-kernel` | `2a6de5c0d93bc60faa8635f28d93650f4637c0c8` | Remove obsolete TS kernel/identity machinery, three Pi-named engine compositions and the agent-output port. |

Their own `CHANGEKERNEL_STATUS.md` files own the exact write scopes, frozen adapter closure and requirement references. Checks remain retained import-closure review, `npm test`, `npm run build` and `git diff --check`. All Rust, retained adapters/ports/codecs, tests, shared metadata and documentation are read-only to workers. Stop on retained callers of a proposed removal; never delete a mixed-language directory. Return exact revisions, actual checks and gaps; no self-approval or automatic next slice.

The manager independently reviews each return and the combined result, reconciles unused dependencies/active references, and owns integration, manifests, lockfiles, exports and consolidated status. Do not merge worker handoff files wholesale. Old R3 worktrees remain stopped; their repairs are complete and the duplicate suite remains withdrawn.

## Prepared next slices: R5 — blocked pending contract approval and shared baseline

The [proposed native private-continuation profile](.changekernel/wiki/items/system/components/state.md#native-private-continuation-profile-proposed) narrows the next increment to durable exact intent and file-candidate custody. This is a design proposal, not adopted policy, implementation, dispatch or acceptance. Planning uses the accepted native checkpoint above; **no R5 branch/worktree has been created and no dispatch base is pinned yet**. The manager will create them from the agreed post-R4/shared-contract checkpoint, recording its exact hash before dispatch.

### R5-A — native file-candidate custody

- **Reserved branch/worktree:** `work/native-file-candidates`, `/home/canina7/Projects/changekernel-workers/native-file-candidates` (not created).
- **Outcome:** prepare and inspect immutable multi-file candidates with exact verified prior grounds, binary proposed bytes/modes or deletion, an exact intent revision and a stable retry binding. No Git/source writes, freshness/approval claim, inference or publication.
- **Planned owned writes:** `src/kernel/state/file_candidate.rs`, `src/application/file_candidate.rs`, `src/adapters/sqlite/file_candidate.rs`, associated focused native tests and its own handoff. Test placement/registration will be pinned with the shared baseline; no separate challenge suite. Shared types, ports, schema, composition and metadata remain manager-owned/frozen.
- **Dependencies:** accepted source observer; approved retention/delivery policy; frozen intent-reference/head transaction guard, source-binding/grant semantics and richer native store profile. The candidate implementation must not depend on Worker B inventing an interface during execution.
- **Acceptance:** multi-file create/replace/delete and binary round-trip; exact grounds survive restart and live-object loss; exact retry reconciles before recapture, conflicting retry rejects; missing/corrupt grounds and current denial/unavailability fail closed; no partial batch on failure; new preparation cannot commit against a changed intent head. Use a small set of ordinary Rust runtime cases, not a port of the old TS suite.

### R5-B — native attributable intent revisions

- **Reserved branch/worktree:** `work/native-intent-revisions`, `/home/canina7/Projects/changekernel-workers/native-intent-revisions` (not created).
- **Outcome:** preserve original intake and append exact attributable What/Why revisions with atomic expected-head comparison, history and retry reconciliation. This is private refinement custody, not Decision admission, a new public phase or a mutable copy of accepted intent.
- **Planned owned writes:** `src/kernel/changes/intent.rs`, `src/application/intent.rs`, `src/adapters/sqlite/intent.rs`, associated focused native tests and its own handoff. Shared intent-reference types, storage guards/schema and metadata remain manager-owned/frozen; Worker A consumes those agreed contracts, not unreviewed changes here.
- **Dependencies:** approved owner-only private-refinement scope and retention policy; frozen initial-revision identity, retry domain, exact encoding and shared store profile. No candidate implementation dependency after those boundaries are fixed.
- **Acceptance:** unchanged original receipt; exact text and absent/present-empty Why preserved through restart; competing revisions have one current-head winner; exact lost-reply retry returns the original result after later revisions; changed request input conflicts; corrupt/missing head/history/retry grounds remain unavailable and cross-container/actor access is denied. Revisions never silently retarget existing candidates.

### Manager pre-dispatch work

1. Obtain confirmation of the proposed scope: one authenticated owner, private intent/candidate custody only, explicit host source-retention/delivery grants (standing scoped grants allowed), protected retention without automatic expiry/eviction, no admission/delegation/execution authority. Unsupported retention obligations must block custody, not be waived. Do not turn this into a mandatory human prompt per operation.
2. Freeze the minimal Rust operation/port/type shapes, versioned identities/encodings, retry domains, result meanings and source-binding/current-grant contract. Keep the existing source-observation API and native intake meanings intact. No new framework, transport, dependency or placeholder success path.
3. Implement/review the shared SQLite initialization/schema and transaction guards once, under manager ownership. **Current `SqliteIntake::open_existing` rejects extra tables**, so the two workers cannot independently add tables or relax validation. Opening must remain non-mutating; foreign/partial schemas and unknown triggers/indexes still fail without journal changes. A deliberately initialized richer profile is distinct from existing intake-only stores; there is no implicit upgrade/import.
4. Establish the revision-zero/head and candidate expected-head checks in the same database transaction boundary. Git capture stays outside transactions. Freeze the required interfaces before parallel implementation; if dependencies remain, serialize rather than dispatch a worker against missing behavior.
5. Review R4, pin the combined/shared-contract base, create both external worktrees and their exact handoffs. Routine native acceptance is `cargo test --locked`, fmt, clippy and `git diff --check`, with active diagnostics and honest gaps. No npm gate for these Rust-only slices. The manager additionally checks the combined candidate-preparation/intent-revision race and unchanged intake regressions.

## Later gates

Decision/Work still needs an explicit versioned admission, assessment and authorization/delegation contract. Operator transport/toolkit, producer/Check execution, publication/recovery and research/memory adoption remain separate supported capabilities, not fields silently added to private custody. Prioritize the [smallest complete self-development path](.changekernel/wiki/items/system/components/package.md#first-self-development-delivery-focus), not prototype parity or disconnected scaffolding.

Qualification, activation and explicit controller handoff remain separate exact-subject gates. No live inference, packaging, activation or controller operation is authorized by these task plans. Never govern this checkout with mutable checkout bytes.
