# ChangeKernel source-development status

This is a temporary pre-dogfood gap note, not a second design specification or roadmap. Wiki owns desired state; qualified Change/Work will replace this note after explicit adoption and controller handoff. Read `AGENTS.md` before coding. Never load this mutable checkout as its own controller or invoke ChangeKernel lifecycle tools here.

## Current checkpoint

- Branch: `audit/clean-baseline`. The preceding pushed checkpoint is `3691efa50`. Source contracts, runner/model bridge and Wiki/reuse design remain development checkpoints, not a qualified operational release or controller handoff.
- Step 1 defines versioned Check, Pack, adoption, input and Boolean-result contracts. Step 2 is partial: one private Linux JavaScript runner, a bounded model port and a DSH-backed model bridge. TypeScript is compiled ahead of execution. Checks receive frozen inputs and cannot import into the Project Server process, write Project sources, access host credentials or use the network directly.
- The runner verifies kernel memory/swap/task controls, bounds execution and output, and stops after uncertain cleanup. DSH owns model dispatch and stream assembly without producer history, tools, retries or fallback. The host currently admits one execution at a time; attempt tracking and temporary files do not provide durable replay protection.
- The approved Wiki refinement keeps synthesized knowledge in document bodies with contextual links and minimal metadata. Checks remain one function model, with explicit input requirements and ordinary Boolean consumption. Complete bound-input result reuse is distinct from favorable-source caching or permanent Wiki verification flags. No editor integration, automatic parameter extraction or composition framework is required. Durable design is in [Wiki](.changekernel/wiki/items/system/components/wiki.md), [Checks](.changekernel/wiki/items/system/components/checks.md), [Evidence](.changekernel/wiki/items/system/components/evidence.md) and the [minimum release](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood).

## Next bounded source task

The user approved comparing Pi as a replacement rather than treating DSH as mandatory. Both bounded Pi paths passed an external proof with `pi-ai` and `pi-coding-agent` pinned to **0.85.1**: a tool-free Check call and a controlled producer session. The supported request-scoped `fetch` hook allowed redirect rejection and decoded response-body limits without global patching, copied provider internals or another model client. Production dependencies and adapters are unchanged.

Next: align runtime-facing Wiki design with the Pi replacement, then migrate the existing model and agent ports while preserving Check, Evidence, authorization and execution-host contracts. Use `pi-ai` for Check model calls and the Pi session interface for producers; remove superseded DSH wiring/tests as each replacement is verified rather than build a permanent dual-runtime framework. Carry the proof cases into source tests. Keep this separate from durable result reuse and the later first-party Pack.

Integration details to retain: explicitly allowlist custom tool names; disable ambient resource/configuration discovery, retry and automatic compaction; inspect terminal state because `prompt()` may resolve after failure; reject missing/ambiguous usage rather than charge zero. Translate cached/reasoning usage according to the chosen provider's semantics. The proof covers one simulated OpenAI-compatible route, not every Pi provider or complete port implementation.

Hard process/resource containment, non-cooperative cleanup, private routing, credentials and live-provider behavior still need qualification under the [provider boundary](.changekernel/wiki/items/system/components/provider-boundary.md#effects-and-host-trust). No live/paid inference is authorized. The earlier upstream request is superseded: the redirect issue is already reported in [DSH discussion 4221](https://github.com/deepseek-ai/deepseek-harness/discussions/4221); nothing was submitted.

## Remaining gaps

Checkpointed source resolution, authenticated current adoption/grants, durable Evidence/results and source validity remain unfinished. The durable-result slice must implement conservative reuse over the entire declared supplied input snapshot, Check/dependency identity and relevant governing/execution settings, including scope membership, source roles and freshness. Git makes retained Wiki/artifact comparisons cheap; unchanged citations or an old enclosing commit verdict are insufficient. Keep this out of the provider-only slice.

Exact Decision acceptance/reports, fresh-session Planning, bounded Work/Review and immutable external release qualification follow those foundations. Activation and explicit controller handoff remain separate. Python, marketplaces, Hub, broad connectors, parallel workers, automatic routing, selective passage-level dependency caching and a composition framework are not first-release work. No live or paid execution is authorized by this note.

## Verification and preserved material

The Pi proof passed **33/33 tests**, repeated **33/33** after a fresh offline installation from its exact dependency lock. It used loopback-only simulated responses, dummy credentials, isolated home/Pi directories and explicit in-memory session configuration; no mutable ChangeKernel code was loaded. Coverage includes settings, structured output, usage, redirects, response/error/compression limits, deadline/cancellation, tool execution/rejection, session resume and exclusion of fixture ambient configuration. These are development results, not release qualification or hard containment evidence.

Proof source, lockfile, scope/limitations and logs remain outside Git at `/tmp/changekernel-pi-proof-Kvz73f/` (`README.md`, `proof.log`). Independent repeat: `/tmp/changekernel-pi-proof-repeat-RMIj2e/proof.log`. Node syntax checks passed; language-server probes for the external JavaScript files were inconclusive, not confirmed clean. Repository regression also passed **513/513**, including type checks and build (`/tmp/changekernel-pi-proof-source-regression.log`). Earlier native-provider rejection evidence remains in checkpoint history. The portable external bundle is `proof.zip` beside the proof sources.

Preserve both existing stashes, untracked `outputs/` and historical Change records. This update performs no lifecycle operation, Project installation, operational release qualification, activation or controller handoff. The user authorized the source-design commit/push and the bounded next source task.
