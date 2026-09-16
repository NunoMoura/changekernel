# ChangeKernel source-development status

This is a temporary pre-dogfood gap note, not a second design specification or roadmap. Wiki owns desired state; qualified Change/Work will replace this note after explicit adoption and controller handoff. Read `AGENTS.md` before coding. Never load this mutable checkout as its own controller or invoke ChangeKernel lifecycle tools here.

## Current checkpoint

- Branch: `audit/clean-baseline`. Unified Check contracts were committed as `0e9d4c27a`; the isolated runner and DSH model bridge were committed as `c60509dfb`. At the start of this update, local HEAD and `origin/audit/clean-baseline` both named the latter checkpoint. These are source-development checkpoints, not a qualified operational release or controller handoff.
- Step 1 defines versioned Check, Pack, adoption, input and Boolean-result contracts. Step 2 is partial: one private Linux JavaScript runner, a bounded model port and a DSH-backed model bridge. TypeScript is compiled ahead of execution. Checks receive frozen inputs and cannot import into the Project Server process, write Project sources, access host credentials or use the network directly.
- The runner verifies kernel memory/swap/task controls, bounds execution and output, and stops after uncertain cleanup. DSH owns model dispatch and stream assembly without producer history, tools, retries or fallback. The host currently admits one execution at a time; attempt tracking and temporary files do not provide durable replay protection.
- The approved Wiki refinement keeps synthesized knowledge in document bodies with contextual links and minimal metadata. Checks remain one function model, with explicit input requirements and ordinary Boolean consumption. Complete bound-input result reuse is distinct from favorable-source caching or permanent Wiki verification flags. No editor integration, automatic parameter extraction or composition framework is required. Durable design is in [Wiki](.changekernel/wiki/items/system/components/wiki.md), [Checks](.changekernel/wiki/items/system/components/checks.md), [Evidence](.changekernel/wiki/items/system/components/evidence.md) and the [minimum release](.changekernel/wiki/items/system/components/package.md#minimum-local-dogfood).

## Next bounded source task

Finish the provider portion of step 2: select and pin one DSH provider implementation for an explicitly configured local/private endpoint, then wire its backend installer with exact settings and bounded transport, usage and cancellation behavior. Test against a local simulated server without live or paid inference. Do not write a parallel provider client or agent harness. Then add a small first-party Pack through the same Check interface and explicit adoption, with independently reviewed cases.

The bridge currently requests and validates canonical structured output; its provider-neutral request contract has no provider-constrained decoding. Scripted providers do not establish a supported deployment route. The Linux runner proof also requires its tested platform libraries, Bubblewrap and effective user-service controls; trusted runtime/provider preparation and local-only enforcement still need qualification.

## Remaining gaps

Checkpointed source resolution, authenticated current adoption/grants, durable Evidence/results and source validity remain unfinished. The durable-result slice must implement conservative reuse over the entire declared supplied input snapshot, Check/dependency identity and relevant governing/execution settings, including scope membership, source roles and freshness. Git makes retained Wiki/artifact comparisons cheap; unchanged citations or an old enclosing commit verdict are insufficient. Keep this out of the provider-only slice.

Exact Decision acceptance/reports, fresh-session Planning, bounded Work/Review and immutable external release qualification follow those foundations. Activation and explicit controller handoff remain separate. Python, marketplaces, Hub, broad connectors, parallel workers, automatic routing, selective passage-level dependency caching and a composition framework are not first-release work. No live or paid execution is authorized by this note.

## Verification and preserved material

At `c60509dfb`, focused model-bridge, runner and architecture tests passed **65/65**; full `npm test` passed **513/513**, including type checks and build. Active language-server probes found no errors; advisory findings remained. Logs: `/tmp/changekernel-dsh-check-focused.log` and `/tmp/changekernel-dsh-check-test.log`. Earlier checkpoint evidence remains documented in Git history. These are development results, not exact-release qualification.

The Wiki/reuse design update also passed `npm test` (**513/513**, including type checks and build; `/tmp/changekernel-wiki-reuse-test.log`), frontmatter/title and local-link validation for all seven changed Markdown files, active language-server probes with no warnings/errors, and `git diff --check`.

Preserve both existing stashes, untracked `outputs/` and historical Change records. This update does not perform lifecycle operations, installation, qualification, activation or controller handoff. The user authorized this source-design commit and push, followed by the bounded next source task.
