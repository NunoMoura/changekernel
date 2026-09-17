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

The same release version owns the transversal validation contract for all four loops. A project cannot select a separate lifecycle profile or disable that contract through a Pack. Supported subject scope and execution configuration describe qualification limits, not another version schedule. Exact domain Check/Pack versions identify adopted extensions, not alternative Kernel semantics.

A release version is not a complete execution identity. Retain the exact Kernel Build, Wiki subject and type-definition snapshot. Kernel Build already binds Product Build and its package version. Corrections may justify a new check against current grounds, but upgrading never rewrites a recorded interpretation, Check result or accepted outcome. Historical decoding uses retained format/protocol markers and declared reader support, never a mutable latest definition or guessed compatibility from a version range.

Current code maps its exact Kernel version to `KERNEL_WIKI_CONTRACT`. The internal `codewiki.wiki-profile@1.0.0` format marker is not an independently selected release. Server compositions default to the running Kernel's contract; an explicit `kernelVersion` must match it exactly. The `wikiProfile` selector and legacy mode are removed. Unknown versions and obsolete configuration fields fail before source access; omission never enables another lifecycle or representation.

Before the first qualified release, preserve desired Wiki intent, relevant provenance and genuine recorded history, not every experimental implementation. Unused formats, bootstrap defaults, policy digests and test fingerprints are not permanent compatibility promises. Remove obsolete code and its tests rather than maintaining a second lifecycle. Tests must protect current behavior, necessary safety properties or components needed for the minimum complete loop, not obsolete bytes, unused exports or frozen file inventories. Test discovery is direct and recursive; shared fixtures do not register other suites. Any compatibility obligation must identify an actual supported deployment and its declared support boundary. This does not authorize rewriting retained records, inventing adoption or changing an installed immutable controller.

## Check execution configuration

The product supplies one [Check library](checks.md#check-library-and-execution) for domain functions that can compute and optionally request bounded model inference. Backend-owned validators can use the same bounded execution mechanisms without pretending to be project-adopted extensions or creating a second inference system. Their authority origins, stage requirements and result identities remain distinct. The public programming model is unified; the pure Kernel does not call providers, inspect files or execute extensions. An isolated runner and authorized host perform effects through a versioned language-neutral contract. TypeScript/JavaScript is the first supported authoring/runtime pair; Python follows demonstrated need and qualification, not a duplicate initial implementation.

Configuration can select one permitted Check model independently of the authoring interface. Inheritance uses an explicitly observed and authorized interface route; an override can select a supported company-private or local deployment. Neither configuration nor a Pack registers credentials or grants access. Resolve and record the actual model/deployment, settings, Check implementation and input identity before execution. No silent fallback, automatic reviewer fleet or mandatory voting is required. Changed settings do not rewrite prior results.

Model calls have no tools or producer session. The host enforces data-location restrictions, resource/time/output/model-call limits and cancellation. Unsupported locality, containment or capabilities remain unavailable. A smaller model or bounded task does not establish sufficient reasoning quality; qualify supported input bounds and expected failure behavior. Credentials and live custody stay outside Wiki and portable Change records.

The existing internal route selector and `runtime.checkModel` bridge provide partial source foundations, not the unified Check runtime or live qualified composition. [Project configuration](project.md#check-model-settings) describes that current bridge. The new Check contract and extensions require a deliberate versioned implementation, not renaming or restoring old code/model engines or reinterpreting historical Gate/findings records.

## Interpretation and authority

Interpret assertions within their scope, conditions and time. Obligations differ from preferences, observations, hypotheses and quoted material. A commitment can be explicitly revised under authority; a candidate cannot authorize its own waiver. Promotion, revision, retirement and re-adoption follow accepted scoped Change transitions, not retrieval or an index's ranking.

Validation ownership follows whether a condition is transversal to all domains or specific to a project domain, not whether its implementation is mechanical or semantic. The ChangeKernel backend owns the common lifecycle validation contract. Projects explicitly adopt domain Checks and Packs; first-party Packs use the same extension contract as company-authored ones. Domain policy cannot replace or waive backend validation. Humans supply intent, context, domain-policy adoption and applicable approval rather than routine evaluator verdicts; agents prepare arguments and Evidence without authenticating themselves. Reports identify both backend validation and domain Check coverage, with their exact grounds and limits.

The service applies authorization and performs effects. Deterministic kernel mechanisms enforce representational contracts, subject/authority binding and declared transition invariants using explicit inputs and typed outcomes. They have no ambient filesystem, Git, process, network, provider, clock or randomness access. Effectful inference stays outside this pure boundary without removing semantic ownership from the kernel.

Change Trace events have common Kernel-defined meanings across Projects; they are not project-specific Change types. Broad Change classifications and the actual intent, context and commitments can condition Work and scrutiny without redefining event kinds or waiving obligations. Managed-document events bind their wire protocol to the exact Kernel Build, recorded document-format marker and source grounds, rather than requiring a project-declared Wiki owner for each event kind. This is semantic provenance, not Actor authorization or proof that an effect was permitted. Historical event schemas and their recorded grounds remain attributable without rewriting their identities.

## Backend validation across four loops

The backend validates every supported lifecycle transition, including revisions, pauses, rejection and withdrawal. Successful progression requires the applicable backend validations and required adopted domain Checks to have current valid passing results, plus separate authority for the exact transition. Recording a failed assessment, repairing a candidate or stopping inquiry does not require turning a failure into a pass. Unsupported validation or unresolved custody blocks unsafe progression; it never silently removes a requirement.

Backend validation is explicit, inspectable and owned by the ChangeKernel release, not a hidden optional Pack. Each evaluation names its stage, question, passing condition, required grounds, implementation and execution identity, result, feedback and limitations. Backend semantic assessment may use bounded inference outside the pure Kernel. Record and transition reduction remain deterministic over supplied validated results; inference does not become proof of truth or authority to act.

| Loop | Transversal backend validation | Domain-specific assessment supplied by adopted Checks |
| --- | --- | --- |
| Decision | Assess clear intent and scope, actual proposed effects, grounds and alternatives, retained versus revised commitments, credible pursuit, consequential uncertainty and later outcome assessability. Validate exact proposal, current baseline, required assessments and approval. | Assess field-specific premises, compatibility, scientific methods, benefits, risks and applicable professional or organizational criteria. |
| Planning | Assess coverage of accepted intent, credible work decomposition, prerequisites and dependencies, maintained intermediate obligations, responsibility, permitted effects and Evidence needs. Bind Work to the accepted Decision. | Assess engineering/test strategy, study protocols, domain procedures and their specific adequacy conditions. |
| Implementation | Assess actual contributions against assigned work and accepted scope; account for deviations, discoveries and partial outcomes. Enforce execution authority, custody, exact artifact/observation identity and safe integration. | Assess code and regression requirements, experimental conduct, manufacturing procedures or other domain execution standards. |
| Review | Assess the exact combined outcome against accepted intent, retained commitments, prior grounds and required domain results. Distinguish realized, contradicted and unresolved claims; preserve gaps and route corrective work. Enforce current approval and durable acceptance. | Assess integrated software behavior, scientific conclusions or other domain outcomes under their adopted methods, thresholds and Evidence standards. |

A common question does not make every domain's passing criteria universal. The backend requires support for consequential claims, exposes contradictions and prevents conclusions exceeding their grounds. Domain Checks establish whether particular measurements, methods or thresholds provide adequate support in that field. Their results can be required inputs to backend assessment, but cannot replace it; dependency ordering must be explicit. Backend reasoning cannot overrule a failed required domain Check or invent missing professional assurance. Changing a project value or domain threshold is policy evolution; changing the common validation contract follows ChangeKernel version rules.

Stage contracts are not interchangeable. Decision's credible pursuit is not Planning's credible detailed path, Implementation's valid contribution or Review's demonstrated combined outcome. A Pack may distribute definitions for multiple stages, and ordinary helpers or retained Evidence may be shared. Each result still binds its actual stage question and exact subject; a previous stage's verdict cannot be relabeled as a later one. Full [reuse conditions](checks.md#efficient-evaluation-and-reuse) apply to backend evaluations and domain Checks alike, including the authority origin and stage condition.

## Knowledge and transition reasoning

The [Check contract](checks.md) defines domain evaluation and common bounded execution/result mechanisms. Backend-owned stage validation and adopted domain evaluation preserve Boolean outcomes, actionable feedback and Evidence without collapsing their different ownership. Compatible, credible to pursue and actually realized are different claims. [Desired/current-state and related-Change primitives](alignment.md) are bounded read-only projections of retained Wiki, Evidence and evaluation records, not a separate State entity or a new model judgment during status rendering.

Support is revisable: identical conclusions with different grounds may respond differently to a failed assumption. Independent support can preserve a conclusion; missing support is not falsity. Preserve disagreement and reconsideration conditions rather than artificial consensus.

A valid baseline and invariant-preserving transitions, including joins, establish only faithfully enforced invariants within the model. They do not prove arbitrary natural-language truth or prevent unobserved external drift. Information can challenge a current belief without silently rewriting accepted state.

Investigation, enabling work, risk reduction and preserved options can justify detours. No universal distance must decrease at every step. Maintenance obligations constrain the journey; a safe destination does not excuse forbidden effects.

## Derived context

Current Wiki is the hot validation basis; model context is a bounded working selection. Native history and optional external information can be retrieved on demand. Neither context eviction nor loading cold material changes adoption status. Caches, rankings and generated views are not authority; canonical encodings and digests establish identity, not truth. See [evidence](evidence.md).
