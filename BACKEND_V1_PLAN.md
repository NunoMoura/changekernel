# CodeWiki Backend v1 Plan

## Purpose and status

This is the active implementation roadmap after completion of the deletion-first refactoring recorded in `REFACTORING_PLAN.md`. Its goal is one stable, production-ready CodeWiki Backend v1 that can support the first product frontend without reopening canonical ownership, execution-engine, or credential boundaries.

Current green base: `9b6e1ef` (`feat: complete product integration surfaces`). Slices 1 through 17 in the completed plan are green. Backend v1 work starts from that checkpoint and does not reinterpret those slices as unfinished migration work.

The Knowledge Base remains intended Product and System truth. Source and tests remain executable truth. This plan orders delivery; it is not canonical runtime input or a compatibility promise.

## Product objective

Backend v1 is reached when a released, independently installed CodeWiki controller can govern a software project through exact Knowledge, Change, Candidate, Gate, Review, provider, recovery, and guarded-effect boundaries; expose one authenticated and versioned frontend contract; and safely govern development of the next CodeWiki release from outside the source checkout.

The first product frontend begins only after that backend contract freezes. Disposable protocol and DSH client-slot spikes may run earlier to validate architecture, but they are not product frontend implementation and create no compatibility obligation.

Initial production scope is software development on explicitly qualified platforms. Unsupported providers, authentication methods, operating systems, containment substrates, and deployment modes fail closed and remain outside the advertised support matrix.

## Fixed architecture

- Project Server remains the sole owner of project meaning, canonical state, admission, Stage Loops, Checks, Gates, authorization, scheduling, integration, Review routing, and protected effects.
- DSH remains the sole first-party managed execution engine.
- DSH owns execution mechanics: Agent loops, provider and authorization plugins, tools, Sessions, Goals, compaction mechanics, subagent mechanisms, generic sandbox primitives, SDK/ACP transport, and web-client composition.
- CodeWiki owns the governance moat: accepted Knowledge, Change identity, Work Graph, Candidate custody, frozen Gate inputs, policy, provenance, route admission, Review authority, exact effects, delivery, replay, and recovery.
- DSH records never become canonical CodeWiki state. An upstream upgrade may change mechanics but cannot change accepted project meaning.
- `.codewiki/` remains the only project-local CodeWiki footprint. It contains declarative project material, never executable plugin packages, credentials, daemon binaries, sockets, or mutable controller state.
- Project Server imports no concrete DSH implementation. Runtime and trusted broker hosts compose DSH behind CodeWiki-owned contracts.
- External harnesses remain Clients or explicitly admitted lower-assurance delegated execution. They do not become a hidden second managed engine.

## Plugin vocabulary

CodeWiki uses the DSH extension vocabulary:

- **Plugin**: an installable lifecycle unit that contributes one bounded capability.
- **Service Definition or seam**: the stable contract for a capability.
- **Provider**: a concrete implementation of a Service Definition.
- **Consumer**: a plugin that uses a capability without owning its provider.
- **Bundle or profile**: a release-managed DSH composition selecting plugins.
- **Bridge**: a cross-process or cross-protocol connection between separately owned systems.
- **Domain Plugin**: a CodeWiki plugin that supplies bounded domain meaning without extending kernel authority.

`adapter` is not a CodeWiki product extension category. The word may remain in private implementation details or upstream API names where an object literally translates protocols, but public CodeWiki composition uses Plugin, Provider, Consumer, Bundle, Profile, or Bridge.

A Domain Plugin may contain separately admitted contributions for three planes:

1. a deterministic Project Server contribution defining domain vocabulary, relationships, validation, context projections, and domain-specific Candidate, Check, and effect bindings;
2. DSH plugins supplying model-facing context or tools under one exact Run capability ceiling;
3. optional DSH client plugins supplying domain views after the frontend phase begins.

No contribution may add a Stage Loop, alter fixed transitions, authenticate itself, grant authority, bypass expected-head compare-and-swap, create a Check Result outside Checks, or apply a protected effect outside Project Server.

The first and only Backend v1 Domain Plugin is Software Development. It owns the existing Product/System/Design Knowledge vocabulary, source and test realization, Git lineage, software Checks, Workbenches, integration, and delivery semantics. Other domains remain deferred until the software plugin and one infrastructure-as-code extension prove the kernel boundary.

## DSH upstream research baseline

The initial capability review on 2026-08-23 inspected DeepSeek Harness repository commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` and published packages at `0.1.1-rc.2`. A 2026-08-24 B3 refresh selected the 26-package managed-Run family at that exact version with Cordis `4.0.1` and Cordis Plugin Loader `1.0.2`. B4 added the seven exact DSH credential/provider packages required by the trusted Broker Host and pinned `@earendil-works/pi-ai` to `0.82.1`, producing one 33-package DSH closure. Every artifact URL and integrity is frozen by package-lock v3. npm does not attest that the tarballs were built from the reviewed commit, so Runtime provenance keeps the package/source relationship explicitly `unattested`.

Primary upstream evidence:

- package hierarchy and capability seams: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/README.md>
- Cordis-backed Loader lifecycle and configuration: <https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/loader/README.md>
- profile boot and composition: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.md>
- profile plugin bundles: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/README.md>
- read-only Host Plugin Inventory: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/host/plugin-inventory/README.md>
- authorization flows: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/credentials/authorization/README.md>
- credentials and local-store security boundary: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/credentials/credentials-local/README.md>
- multi-provider and OAuth-capable LLM plugin: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/llm/llm-pi-ai/README.md>
- web client plugins and UI slots: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/README.md>
- subagent providers: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/subagent/README.md>
- process sandbox plugins: <https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sandbox/README.md>
- current OAuth/provider defect report: <https://github.com/deepseek-ai/deepseek-harness/discussions/4006>
- reported custom OpenAI-compatible credential-routing defect: <https://github.com/deepseek-ai/deepseek-harness/discussions/4252>
- current MCP OAuth-refresh gap: <https://github.com/deepseek-ai/deepseek-harness/discussions/3997>

The exact package lock and Runtime provenance are the executable pin. Research links remain qualification evidence, and every later DSH-facing slice must re-check registry state, source, defects, and closure before changing that pin.

## DSH capability ledger

| Capability | Upstream state at research baseline | Disposition | CodeWiki boundary and required proof |
| --- | --- | --- | --- |
| Cordis Plugin lifecycle, DSH Loader, and Service Definition/Provider/Consumer seams | First-party product surface | Adopt | DSH Loader remains the sole executable Plugin lifecycle authority. CodeWiki qualifies exact profile composition and failure behavior but does not duplicate import, dependency injection, update, disposal, rollback, or Fiber state. |
| DSH profile and ordered bundle composition | First-party product surface | Adopt | Backend release or operator owns exact qualified profile bytes. Project files cannot patch profiles, install executable code, or select entrypoints. |
| DSH Host Plugin Inventory and Settings inventory UI | First-party point-in-time projection | Adopt read-only | Use Loader entry ID, exact module specifier, effective enablement, and Fiber phase for observation. Do not create a competing live inventory; the upstream projection intentionally supplies no provenance, history, trust admission, or mutation path. |
| `dsh plugin` package installation and package-manager closure | First-party CLI over pnpm and package metadata | Adopt outside governed projects | Installation and dependency resolution remain package-manager concerns. CodeWiki qualification binds exact lockfile provenance and rejects repository-local executable roots; it does not model dependencies or package entrypoints again. |
| Community marketplaces, profile doctors, static audits, quarantine, and rollback tools | Community surfaces with varying maturity and trust | Qualify selectively | Use as discovery, test, or failure-fixture inputs only after exact source, integrity, maintenance, license, and security review. Do not add a second runtime manager or grant community code authority by default. |
| Agent and AgentLoop mechanics | First-party product surface | Adopt | Keep behind Runtime Bridge; preserve Run Request, receipt, cancellation, Session lease, and Candidate boundaries. |
| Sessions, Goals, and compaction mechanics | First-party product surface | Compose | DSH owns mechanics; CodeWiki retains logical continuity, authority promotion, deterministic rehydration, and rollover policy. |
| `dsh-llm-pi-ai` and provider catalog | First-party product surface with API-key, native-provider, custom-gateway, and OAuth support | Adopt behind broker | Bind exact route and plugin identities; force SDK retries to zero where broker owns retry; no direct Run egress or credentials. |
| `dsh-authorization` | First-party plugin-owned human authorization flows | Adopt and qualify | CodeWiki supplies the trusted interaction surface and route/account authorization; no model sees a flow, prompt, token, or credential record. |
| `dsh-credentials` | First-party reference and opaque-record seam with serialized mutation | Adopt | Use as capability contract. Credential payload semantics stay owned by provider plugin. |
| `dsh-credentials-local` | First-party file provider, owner-only permissions, explicitly not a same-UID model boundary | Conditional | May qualify for isolated single-user deployment only when outside every Run mount. Multi-user deployment requires a stronger credential Provider such as keychain, KMS, or secret manager. |
| Provider settings, model discovery, and model-selection UI | First-party host/client plugins | Reuse in frontend | Do not duplicate provider forms or OAuth interaction UI unless CodeWiki policy requires a narrower projection. |
| Web client shell, modules, connection service, primitives, and typed UI slots | First-party product plugins | Spike, then adopt if qualified | First CodeWiki frontend should be DSH client plugins and a release-managed profile bundle, while all authority continues through CodeWiki frontend API. |
| DSH profile plugin bundles | First-party product surface | Adopt | CodeWiki release owns exact bundle composition. Project files may select admitted Domain Plugin identity but cannot install DSH code. |
| TypeScript SDK, JSON-RPC, and ACP | First-party product surfaces | Evaluate as frontend bridges | Preserve CodeWiki authentication, API versioning, redaction, idempotency, and event ordering; do not expose raw DSH authority. |
| MCP client | First-party plugin; OAuth refresh not fully connected at baseline | Defer unsupported auth paths | No static-token workaround for expiring enterprise endpoints. Re-evaluate after upstream support or provide a qualified credential Provider plugin without duplicating protocol logic. |
| Claude Code, Codex, ACP, and DSH SDK subagents | First-party optional profile bundles | Defer for managed Backend v1 | If later admitted, label as DSH-supervised external execution with explicit custody gaps; never present as native Backend-owned DSH provenance. |
| Hook bridges for Claude Code and Codex | First-party plugin family | Evaluate later | Observation may improve external assurance but cannot capture chain-of-thought or upgrade external custody. |
| DSH sandbox and filesystem-policy plugins | First-party product surface | Compare and qualify | Do not replace CodeWiki's exact Bubblewrap/`prlimit` inner and outer policies until adversarial evidence proves equal or stronger containment. |
| DSH worker-thread Code Runtime | First-party product surface | Reject as hostile-code boundary | It may remain benchmark evidence only. Secure Code Mode continues using a qualified fresh process and operating-system boundary. |
| DSH extension self-modification and model-written plugin mounting | First-party product surface | Prohibit in managed Runs | Model code receives no plugin-install, lifecycle, persistence, credential, scheduling, or authority capability. |
| Generic workflows, Ralph loops, and experimental agent teams | First-party or experimental surfaces | Defer | They cannot replace CodeWiki Stage Loops, Work Graph, scheduler, Gate meaning, or Project Server coordination. Adopt only mechanics proven not to duplicate governance. |
| Session query, SQLite projection, telemetry, LSP, web, attachment, spill, and jobs plugins | First-party capability families | Evaluate per requirement | Adopt rather than duplicate when their exact semantics fit, but keep canonical CodeWiki state and evidence identities independent. |

## Known upstream risks

- DSH remains release-candidate software and may change package topology quickly.
- `0.1.1-rc.2` has a reported OAuth grant-rotation serialization defect and model availability-filtering defect. OAuth remains unsupported until a selected release proves refresh, entitlement filtering, cancellation, redaction, account binding, forget, revocation posture, and failures.
- A custom OpenAI-compatible report says `baseURL` can replace the bearer key. B4's exact `pi-ai@0.82.1` deterministic wire fixture proves the resolved key, never `baseURL`, on the pinned closure; package or request-wire drift must fail this gate.
- Authorization attempts are process-local and not resumable after browser or host loss.
- Current sign-out deletes local state but does not guarantee issuer-side revocation.
- The local credential provider explicitly permits same-UID reads and therefore cannot be the model-isolation boundary.
- Some provider-native ambient authentication reads host credential files outside the generic credential seam.
- Arbitrary configured headers may bypass credential redaction if a deployment puts secrets there.
- MCP OAuth refresh is incomplete at the research baseline.
- Community plugins may close gaps sooner than first-party packages, but adoption requires exact source, version, integrity, maintenance, license, credential-custody, containment, and protocol qualification.

## Upstream adoption discipline

Before each DSH-facing slice:

1. inspect the latest published DSH release, official package map, implemented notes, open defects, and relevant community plugins;
2. update this ledger with `adopt`, `compose`, `wrap`, `qualify`, `defer`, `prohibit`, or `codewiki-owned` disposition;
3. select an exact published package closure and record version, source commit where known, integrity, and transitive dependency lock;
4. prefer first-party plugins, then qualified community plugins, then minimal CodeWiki code only when authority or security requires ownership;
5. delete CodeWiki duplication only after parity, replay, failure, custody, and security proof;
6. never track DSH `master` in a production Runtime Build or silently upgrade an active Session;
7. bind every admitted DSH plugin and profile identity into Runtime Build, Run, receipt, and qualification evidence.

An upstream addition strengthens CodeWiki when it improves execution beneath the governance boundary. It does not move accepted meaning, policy, evidence interpretation, or effect authority into DSH.

## Delivery sequence

### B0 — Architecture ratification and capability ledger

- [x] Close `REFACTORING_PLAN.md` at completed Slice 17 checkpoint `9b6e1ef`.
- [x] Ratify Backend-first delivery and frontend-entry gate.
- [x] Replace Knowledge Profile terminology with Domain Plugin.
- [x] Adopt DSH Plugin/Provider/Consumer/Bundle/Profile/Bridge vocabulary.
- [x] Record the initial DSH capability ledger, upstream risks, and adoption discipline.
- [x] Keep repository dogfood disabled.

Success: intended architecture and active roadmap agree before executable migration begins.

### B1 — Switchyard deletion — complete

- [x] Remove the passthrough mode from provider contracts, broker binding evidence, tests, documentation, and package closure.
- [x] Delete the backend selector and retain one brokered DSH provider-Plugin path.
- [x] Advance the private provider broker protocol to `2.0.0` because canonical binding bytes changed; keep receipts bound to the resulting exact broker digest.
- [x] Preserve authenticated Unix-domain broker transport, exact route binding, bounded broker-owned retry, replay, and evidence closure.
- [x] Prove no active Switchyard surface remains outside historical records.

Success: one provider path remains and no dormant dynamic router can widen exact Run authorization.

### B2 — Executable Plugin vocabulary and trust planes — complete

- [x] Replace fragmented legacy executable categories with DSH Plugin, Infrastructure Provider, Runtime Bridge, and Client Plugin contracts.
- [x] Define Executable Plugin Admission Closure `1.0.0` over exact Plugin identity, kind, trust plane, sorted capability ceiling, and closure digest.
- [x] Keep DSH Loader/profile state, package versions, integrity, dependencies, entrypoints, installation, and live inventory with DSH and the package manager rather than duplicating them in CodeWiki.
- [x] Reject repository-local executable Plugin source roots after realpath resolution, including symlink aliases; reject local entrypoints in project configuration.
- [x] Keep upstream names and private translator classes internal.
- [x] Advance Runtime Build Manifest to `2.0.0`, replace fragmented closure fields with one executable Plugin admission-closure digest, and bind receipts transitively through the immutable Runtime Build digest.
- [x] Clean-cut the public Runtime Bridge API to `runDshRuntimeBridge`, `DshModelProviderInstaller`, and related Runtime Bridge types.

Success: DSH owns executable lifecycle and composition mechanics, while CodeWiki binds only trust admission and capability ceilings without granting Plugin authority over canonical state.

### B3 — Qualified DSH baseline migration — complete

- [x] Re-run upstream source, registry, release, defect, and community research; select exact DSH `0.1.1-rc.2` at reviewed commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
- [x] Migrate the atomic 26-package DSH release family together; retain exact Cordis `4.0.1` and bind Cordis Plugin Loader `1.0.2` as DSH support provenance.
- [x] Preserve replay fixtures, Session continuity, controlled Goals, compaction provenance, secure Code Mode, process protocol, broker evidence, and receipt identity.
- [x] Gate exact package versions and integrity, build-time LLM pinning, TypeScript compatibility, replay/session events, provider brokerage, composition identities, Loader activation, and inventory state.
- [x] Compile one release-managed Run composition into the Runtime artifact, delegate import/apply/dispose and Fiber state to DSH Loader, and fail closed unless the read-only DSH Host Plugin Inventory exactly matches every expected enabled entry.
- [x] Bind all possible managed-Run Plugin identities to Executable Plugin Admission Closure policy; Runtime Build `2.0.0` binds that closure directly and the exact composition transitively through Runtime artifact bytes.
- [x] Keep DSH package/source equivalence explicitly unattested and retain all Project Server authority boundaries.

Success: CodeWiki uses one current, pinned, replay-qualified DSH plugin baseline without importing DSH authority into Project Server.

### B4 — Provider, authorization, and credential plugins — complete

- [x] Compose official DSH LLM, authorization, local credential, and Host Plugin Inventory seams through DSH Loader inside the trusted Broker Host.
- [x] Qualify API-key OpenAI, Anthropic, DeepSeek, and custom OpenAI-compatible wire paths against deterministic local provider fixtures under exact `@earendil-works/pi-ai@0.82.1`.
- [x] Bind exact account and credential references into project route policy, Work Unit Model Assignments, Run routes, broker authorization, provider selection, and authenticated receipts without recording token bytes.
- [x] Advance Work Unit Model Assignment to `2.0.0`, Run Process and Run Request to `6.0.0`, and Private Provider Broker to `3.0.0`; bind exact per-Run route and model-request/input/output budgets into the broker capability.
- [x] Qualify the local credential Provider only for isolated single-user deployment, owner-only storage, no ambient shadow, and paths outside every declared project or Run root.
- [x] Keep deterministic mock qualification mandatory and live-provider qualification opt-in and credential-free by default.
- [x] Fail closed for Bedrock, Vertex, Azure, OAuth, revocation, ambient credentials, secret-bearing provider headers, unsupported protocols, account drift, repository/Run-root credential storage, and multi-user local-file custody.
- [x] Retain OAuth as unsupported because refresh serialization, entitlement filtering, process-loss recovery, and issuer revocation are not qualified at `0.1.1-rc.2`.

Success: CodeWiki owns route authority and custody evidence while DSH plugins own provider and authorization protocols.

### B5 — Domain Plugin kernel and Software Development plugin

- Define Domain Plugin manifest and deterministic Project Server contribution contract.
- Extract current software-specific Knowledge vocabulary, relationship rules, context compilation, source/test realization, Checks, Git integration, and delivery bindings into the built-in Software Development Domain Plugin.
- Keep the governance kernel, four Stage Loops, authority, Gate reduction, and effect application fixed.
- Bind exact Domain Plugin identity to Knowledge checkpoints, Candidates, Gate Evaluation Packages, Runtime Builds where applicable, and frontend projections.
- Treat Domain Plugin upgrades as explicit migrations with recomputation and compatibility checks, never hot mutation.
- Keep connector-derived observations non-authoritative until exact policy admits their proposed Knowledge Effects.

Success: software behavior remains unchanged while domain meaning becomes one exact admitted plugin rather than hard-coded generic-engine assumptions.

### B6 — Frontend contract freeze and DSH client-slot qualification

- Freeze authenticated frontend API `1.0.0`, event ordering, resumability, idempotency, redaction, error taxonomy, and capability discovery.
- Expose only canonical CodeWiki commands, queries, operations, and projections; no raw DSH or Project Server storage handles.
- Build a disposable DSH web/client plugin spike for Change navigation, one stage view, provider settings reuse, and authorization interaction.
- Decide from evidence whether frontend v1 uses DSH web profile composition; do not retain a second shell if DSH slots satisfy accessibility, lifecycle, and security requirements.

Success: frontend implementation can begin without driving backend contract churn or duplicating generic DSH UI infrastructure.

### B7 — Backend packaging, lifecycle, and state evolution

- Qualify standalone install, bootstrap, start, stop, restart, upgrade, rollback, uninstall, and multi-project lifecycle.
- Define durable state locations, ownership, schema migration, backup, restore, retention, and corruption recovery.
- Keep `.codewiki/` as the only project-local footprint and controller state outside the governed checkout.
- Bind Backend Build, DSH profile bundles, Domain Plugin closure, database or file schemas, and protocol versions into operational status.

Success: operators can recover or roll back without losing canonical meaning, duplicating authority, or trusting mutable project code.

### B8 — Production security, reliability, and observability

- Publish the supported platform/provider/authentication matrix.
- Requalify exact Bubblewrap, `prlimit`, Node, DSH, plugin, and provider identities.
- Exercise crash, cancellation, timeout, quota, credential rotation, stale Session, broker loss, filesystem corruption, process orphan, and partial-effect recovery.
- Provide structured health, audit export, metrics, logs, receipt inspection, and privacy-preserving diagnostics without chain-of-thought.
- Complete threat-model, dependency, secret, vulnerability, package, performance, and adversarial gates.

Success: supported deployments fail closed, explain failures, and recover deterministically under production faults.

### B9 — Safe dogfood and Backend v1 release candidate

- Install reviewed release N outside the source repository with isolated controller state and credentials.
- Use release N to govern development of N+1 without resolving or loading mutable N+1 controller code.
- Prove controller upgrade, rollback, emergency disable, cleanup, independent CI, packed external tests, and guarded effects.
- Freeze Backend v1 API, plugin contracts, support matrix, release manifest, and qualification evidence.
- Remove the repository no-dogfood restriction only through a separate explicit Change after all external gates pass.

Success: CodeWiki safely governs itself as a subject while the released controller remains an independent trusted application.

## Backend v1 release gate

Frontend v1 product implementation may begin only when all of these are true:

- one exact DSH baseline and profile closure is pinned and qualified;
- Switchyard and engine-selection surfaces are absent;
- Software Development Domain Plugin identity and migration rules are stable;
- provider and authentication support matrix is explicit and tested;
- credentials remain outside every Run authority and evidence surface;
- frontend API and event protocol are versioned, authenticated, resumable, and frozen;
- install, upgrade, rollback, backup, restore, and crash recovery pass in disposable external environments;
- supported containment fails closed and passes adversarial qualification;
- operational status, audit evidence, and diagnostics are sufficient for production support;
- release N safely governs N+1 under independent-controller dogfood;
- full tests, packed installs, audits, benchmarks, and manifest verification are green;
- no unresolved critical security, authority, data-loss, or provider-custody defect remains.

## Verification rules

Every executable slice keeps the completed refactoring discipline:

1. capture an exhaustive clean HEAD manifest before structural work;
2. state exact deletion, adoption, and retained-authority dispositions;
3. add focused invariant, replay, failure, and recovery tests;
4. run primary LSP diagnostics before builds;
5. run typecheck, build, relevant full tests, packed-install tests where closure changes, and dependency audits;
6. inspect dead exports and all edited-file diagnostics;
7. verify clean diff and manifest integrity;
8. ship one reviewed green commit per slice;
9. push or release only after explicit review and authority.
