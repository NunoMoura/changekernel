# ChangeKernel source-development status

This is a temporary pre-dogfood gap note, not a second design specification or roadmap. Wiki owns desired state; qualified Change/Work will replace this note after explicit adoption and controller handoff. Read `AGENTS.md` before coding. Never load this mutable checkout as its own controller or invoke ChangeKernel lifecycle tools here.

## Current checkpoint

- Branch: `audit/clean-baseline`. Unified Check contracts were committed as `0e9d4c27a`; the isolated runner and DSH model bridge as `c60509dfb`; the Wiki/reuse design and updated next steps as `7af0d073b`, pushed to `origin/audit/clean-baseline`. These are source-development checkpoints, not a qualified operational release or controller handoff.
- Step 1 defines versioned Check, Pack, adoption, input and Boolean-result contracts. Step 2 is partial: one private Linux JavaScript runner, a bounded model port and a DSH-backed model bridge. TypeScript is compiled ahead of execution. Checks receive frozen inputs and cannot import into the Project Server process, write Project sources, access host credentials or use the network directly.
- The runner verifies kernel memory/swap/task controls, bounds execution and output, and stops after uncertain cleanup. DSH owns model dispatch and stream assembly without producer history, tools, retries or fallback. The host currently admits one execution at a time; attempt tracking and temporary files do not provide durable replay protection.
- The approved Wiki refinement keeps synthesized knowledge in document bodies with contextual links and minimal metadata. Checks remain one function model, with explicit input requirements and ordinary Boolean consumption. Complete bound-input result reuse is distinct from favorable-source caching or permanent Wiki verification flags. No editor integration, automatic parameter extraction or composition framework is required. Durable design is in [Wiki](.changekernel/wiki/items/system/components/wiki.md), [Checks](.changekernel/wiki/items/system/components/checks.md), [Evidence](.changekernel/wiki/items/system/components/evidence.md) and the [minimum release](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood).

## Next bounded source task

Provider integration is blocked pending an enforceable transport boundary. An external, exact-version probe of `@deepseek-ai/dsh-llm-deepseek@0.1.1-rc.2` confirmed a successful local baseline and three separate gaps: forwarding a prompt after a redirect to a second origin, consuming 131,339 wire bytes while exposing only 363 translated bytes to bridge counters, and retaining a 131,072-byte error body before yielding any chunk. These violate this route's endpoint/raw-byte requirements, not necessarily the adapter's own advertised contract. No production dependency or installer was added. Static inspection of `0.1.5-rc.2` still found direct fetch without redirect controls, and it requires a wider DSH upgrade; it was not executed or qualified. The alternative adapter has not been qualified either.

Follow-up inspection found no explicit response-body limit or fetch injection in the alternative adapter's public constructor/profile declarations; custom compositions remain unqualified. Native `0.1.6-alpha.1` rejects redirects on its Messages path, but still reads whole error bodies without a limit; its Chat Completions path still lacks redirect rejection. This was static inspection, not execution or qualification of that alpha release.

Recommended next action: request provider-owned controls upstream rather than introduce a larger containment system. A portable request, exact dependency lock and standalone reproduction are prepared at `/tmp/dsh-transport-request-SyJNsv/UPSTREAM_REQUEST.md`; public submission requires user approval. A fresh isolated installation reproduced all three gaps and passed baseline and cancellation controls (**5/5 assertions**, not qualification); `probe.log` is beside the draft. Cancellation rejected with `ABORTED` and closed the observed response, not proof of complete host cleanup.

Only after supported controls or separate containment meet the [provider boundary](.changekernel/wiki/items/system/components/provider-boundary.md#effects-and-host-trust), pin the production dependency and wire its installer. Do not monkey-patch globals, vendor internals or write another client. Keep tests local and simulated, without live/paid inference. A small first-party Pack follows supported wiring.

The bridge requests and validates canonical structured output, not provider-constrained decoding. Scripted providers do not establish a deployment route. Linux runtime preparation and local-only enforcement still require qualification.

## Remaining gaps

Checkpointed source resolution, authenticated current adoption/grants, durable Evidence/results and source validity remain unfinished. The durable-result slice must implement conservative reuse over the entire declared supplied input snapshot, Check/dependency identity and relevant governing/execution settings, including scope membership, source roles and freshness. Git makes retained Wiki/artifact comparisons cheap; unchanged citations or an old enclosing commit verdict are insufficient. Keep this out of the provider-only slice.

Exact Decision acceptance/reports, fresh-session Planning, bounded Work/Review and immutable external release qualification follow those foundations. Activation and explicit controller handoff remain separate. Python, marketplaces, Hub, broad connectors, parallel workers, automatic routing, selective passage-level dependency caching and a composition framework are not first-release work. No live or paid execution is authorized by this note.

## Verification and preserved material

At `c60509dfb`, focused model-bridge, runner and architecture tests passed **65/65**; full `npm test` passed **513/513**, including type checks and build. Active language-server probes found no errors; advisory findings remained. Logs: `/tmp/changekernel-dsh-check-focused.log` and `/tmp/changekernel-dsh-check-test.log`. Earlier checkpoint evidence remains documented in Git history. These are development results, not exact-release qualification.

The Wiki/reuse design update also passed `npm test` (**513/513**, including type checks and build; `/tmp/changekernel-wiki-reuse-test.log`), frontmatter/title and local-link validation for all seven changed Markdown files, active language-server probes with no warnings/errors, and `git diff --check`.

The external provider probe ran one successful control and three blocker reproductions (**4/4 reproduced**), using loopback-only simulated servers, dummy credentials and isolated home/Pi directories. Package version, lockfile, probe source and output remain outside Git at `/tmp/changekernel-dsh-provider-probe-5P3aSV/`; its log is `probe.log`. This is rejection evidence for that integration candidate, not a passing release qualification. No live inference occurred. The follow-up documentation also passed `npm test` (**513/513**, including type checks and build; `/tmp/changekernel-provider-boundary-test.log`), with no production dependency or source-code changes.

Preserve both existing stashes, untracked `outputs/` and historical Change records. This update performs no lifecycle operation, Project installation, operational release qualification, activation or controller handoff. The user authorized the source-design commit/push and the bounded next source task.
