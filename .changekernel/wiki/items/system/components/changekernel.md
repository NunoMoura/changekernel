---
title: ChangeKernel Core
aliases:
  - Kernel
source-id: cw:component:semantic-kernel
ownership:
  sourcePatterns:
    - src/kernel/data-contracts/**
    - src/kernel/identity/**
  testPatterns:
    - tests/kernel/data-contracts/**
    - tests/kernel/identity/**
    - tests/kernel/invariants/**
source-history:
  provenance: []
  relationships:
    - attributes:
        codewiki.system:rationale: The Semantic Kernel gives intent-bearing Changes and adopted knowledge stable meanings, justified revision, and explicit transition consequences.
      predicate: codewiki.system:realizes
      targetItemId: cw:story:maintainer.maintain-intent
    - attributes:
        codewiki.system:rationale: The Semantic Kernel defines context-bound validation from applicable commitments and actual effects without a separate project-authored Check Pack policy.
      predicate: codewiki.system:realizes
      targetItemId: cw:story:maintainer.enforce-project-standards
    - attributes:
        codewiki.system:rationale: The Semantic Kernel makes canonical state replayable without trusting private process memory.
      predicate: codewiki.system:realizes
      targetItemId: cw:story:maintainer.recover-history
---
# ChangeKernel Core

The ChangeKernel core gives [Change](change-trace.md) and [Wiki](wiki.md) stable meanings and transition consequences. Change is the primary mechanism of evolution; Wiki is current accepted knowledge. Support, uncertainty, authority and historical disposition are semantic distinctions, not extra authoring primitives. Git is the native foundation for exact accepted state and intent-bearing history.

## Product and implementation boundary

The ChangeKernel product is a **semantic workflow layer on Git**, not a modification of Git or a hosted service prerequisite. Its usable local distribution includes the pure Kernel, native Git persistence, the [Project Server runtime](project-server.md), backend Gate execution and an agent-facing interface. The pure Kernel alone is not an operational product: it intentionally performs none of that I/O.

The [Hub](../../product/changekernel.md) adds shared hosting, team access and collaboration interfaces. It uses these same contracts rather than redefining Change acceptance or replacing native history. Product separation does not require premature repository, package or process separation. The local product's [minimum dogfood loop](package.md#minimum-local-dogfood) can be qualified independently.

## Versioning and document contract

ChangeKernel has one public `x.y.z` release version. The managed Wiki representation and interpretation contract, historically called the Wiki profile, belongs to that version. There is no independently released profile, user-selected profile version or second compatibility schedule. In the current distribution, Kernel and Product package share the release version exported as `CHANGEKERNEL_VERSION`.

| Bump | Contract rule |
| --- | --- |
| Major | Breaking representation, interpretation or lifecycle changes. Previously valid documents or supported operations may require an explicitly authorized migration or reinterpretation. |
| Minor | Compatible additions that preserve the declared meaning of existing valid documents and supported operations. |
| Patch | Implementation corrections within the declared contract, not silent changes to that contract. |

A Wiki edit creates a new Wiki revision, not a new Kernel version. This includes changes to type definitions: their effect on particular Items is governed knowledge evolution under the existing Kernel rules. Changing how the Kernel represents, resolves or interprets those definitions is a Kernel contract change. Prerelease identifiers label development candidates; they do not grant qualification or weaken historical protections. Updating this source does not publish a release.

A release version is not a complete execution identity. Retain the exact Kernel Build, Wiki subject and type-definition snapshot. Kernel Build already binds Product Build and its package version. Corrections may justify a new check against current grounds, but upgrading never rewrites a recorded interpretation, Check result or accepted outcome. Historical decoding uses retained format/protocol markers and declared reader support, never a mutable latest definition or guessed compatibility from a version range.

Current code maps its exact Kernel version to `KERNEL_WIKI_CONTRACT`. The internal `codewiki.wiki-profile@1.0.0` format marker is not an independently selected release. Server compositions default to the running Kernel's contract; an explicit `kernelVersion` must match it exactly. The `wikiProfile` selector and legacy mode are removed. Unknown versions and obsolete configuration fields fail before source access; omission never enables another lifecycle or representation.

Before the first qualified release, preserve desired Wiki intent, relevant provenance and genuine recorded history, not every experimental implementation. Unused formats, bootstrap defaults, policy digests and test fingerprints are not permanent compatibility promises. Remove obsolete code and its tests rather than maintaining a second lifecycle. Tests must protect current behavior, necessary safety properties or components needed for the minimum complete loop, not obsolete bytes, unused exports or frozen file inventories. Test discovery is direct and recursive; shared fixtures do not register other suites. Any compatibility obligation must identify an actual supported deployment and its declared support boundary. This does not authorize rewriting retained records, inventing adoption or changing an installed immutable controller.

## Check execution configuration

The product supplies one [Check library](checks.md#check-library-and-execution) for custom functions that can compute and optionally request bounded model inference. The public programming model is unified; the pure Kernel does not call providers, inspect files or execute extensions. An isolated runner and authorized host perform effects through a versioned language-neutral contract. TypeScript/JavaScript is the first supported authoring/runtime pair; Python follows demonstrated need and qualification, not a duplicate initial implementation.

Configuration can select one permitted Check model independently of the authoring interface. Inheritance uses an explicitly observed and authorized interface route; an override can select a supported company-private or local deployment. Neither configuration nor a Pack registers credentials or grants access. Resolve and record the actual model/deployment, settings, Check implementation and input identity before execution. No silent fallback, automatic reviewer fleet or mandatory voting is required. Changed settings do not rewrite prior results.

Model calls have no tools or producer session. The host enforces data-location restrictions, resource/time/output/model-call limits and cancellation. Unsupported locality, containment or capabilities remain unavailable. A smaller model or bounded task does not establish sufficient reasoning quality; qualify supported input bounds and expected failure behavior. Credentials and live custody stay outside Wiki and portable Change records.

The existing internal route selector and `runtime.checkModel` bridge provide partial source foundations, not the unified Check runtime or live qualified composition. [Project configuration](project.md#check-model-settings) describes that current bridge. The new Check contract and extensions require a deliberate versioned implementation, not renaming or restoring old code/model engines or reinterpreting historical Gate/findings records.

## Interpretation and authority

Interpret assertions within their scope, conditions and time. Obligations differ from preferences, observations, hypotheses and quoted material. A commitment can be explicitly revised under authority; a candidate cannot authorize its own waiver. Promotion, revision, retirement and re-adoption follow accepted scoped Change transitions, not retrieval or an index's ranking.

Projects explicitly adopt semantic Checks and Packs; first-party definitions have no privileged execution path. The Kernel supplies no hidden business-value, intent-fit or feasibility judge. Humans supply intent, context, policy adoption and approval rather than routine Check verdicts; agents prepare arguments and Evidence without authenticating themselves. The Kernel enforces exact subjects, adopted selection, result integrity, permissions and durable progression. Reports state only what selected Checks established; a generic pass flag or an axis label is not universal semantic assurance.

The service applies authorization and performs effects. Deterministic kernel mechanisms enforce representational contracts, subject/authority binding and declared transition invariants using explicit inputs and typed outcomes. They have no ambient filesystem, Git, process, network, provider, clock or randomness access. Effectful inference stays outside this pure boundary without removing semantic ownership from the kernel.

Change Trace events have common Kernel-defined meanings across Projects; they are not project-specific Change types. Broad Change classifications and the actual intent, context and commitments can condition Work and scrutiny without redefining event kinds or waiving obligations. Managed-document events bind their wire protocol to the exact Kernel Build, recorded document-format marker and source grounds, rather than requiring a project-declared Wiki owner for each event kind. This is semantic provenance, not Actor authorization or proof that an effect was permitted. Historical event schemas and their recorded grounds remain attributable without rewriting their identities.

## Knowledge and transition reasoning

The [Check contract](checks.md) governs Boolean results, Evidence, corrective feedback and adopted selection across all four loops. Axes organize questions in Packs rather than imposing a universal Kernel catalogue. Compatible, credible to pursue and actually realized are different claims. [Desired/current-state and related-Change primitives](alignment.md) are bounded read-only projections of retained Wiki, Evidence and work, not a separate State entity or a built-in semantic judgment.

Support is revisable: identical conclusions with different grounds may respond differently to a failed assumption. Independent support can preserve a conclusion; missing support is not falsity. Preserve disagreement and reconsideration conditions rather than artificial consensus.

A valid baseline and invariant-preserving transitions, including joins, establish only faithfully enforced invariants within the model. They do not prove arbitrary natural-language truth or prevent unobserved external drift. Information can challenge a current belief without silently rewriting accepted state.

Investigation, enabling work, risk reduction and preserved options can justify detours. No universal distance must decrease at every step. Maintenance obligations constrain the journey; a safe destination does not excuse forbidden effects.

## Derived context

Current Wiki is the hot validation basis; model context is a bounded working selection. Native history and optional external information can be retrieved on demand. Neither context eviction nor loading cold material changes adoption status. Caches, rankings and generated views are not authority; canonical encodings and digests establish identity, not truth. See [evidence](evidence.md).
