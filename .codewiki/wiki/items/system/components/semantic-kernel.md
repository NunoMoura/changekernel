---
{"aliases":["Kernel"],"attributes":{"codewiki.component:ownership":{"sourcePatterns":["src/kernel/data-contracts/**","src/kernel/identity/**","src/kernel/index.ts"],"testPatterns":["tests/kernel/data-contracts/**","tests/kernel/identity/**","tests/kernel/invariants/**"]}},"itemId":"cw:component:semantic-kernel","itemType":"codewiki.system:component","protocol":"codewiki.wiki-item@1.0.0","provenance":[],"relationships":[{"attributes":{"codewiki.system:rationale":"The Semantic Kernel gives intent-bearing Changes and adopted knowledge stable meanings, justified revision, and explicit transition consequences."},"predicate":"codewiki.system:realizes","targetItemId":"cw:story:maintainer.maintain-intent"},{"attributes":{"codewiki.system:rationale":"The Semantic Kernel defines context-bound validation from applicable commitments and actual effects without a separate project-authored Check Pack policy."},"predicate":"codewiki.system:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"},{"attributes":{"codewiki.system:rationale":"The Semantic Kernel makes canonical state replayable without trusting private process memory."},"predicate":"codewiki.system:realizes","targetItemId":"cw:story:maintainer.recover-history"}],"title":"Semantic Kernel"}
---
# Semantic Kernel

The Semantic Kernel owns the meanings and consequences that make CodeWiki more than document storage or orchestration. Its two primitives are [Wiki](wiki.md) and [Change](change-trace.md). Assertions, commitments, support, uncertainty, dependencies, stage judgments, and authorized revisions are semantic distinctions within them, not a requirement to create a new top-level entity for each distinction.

## Meaning, support, and authority

An assertion is interpreted within scope, conditions, and time. An adopted obligation is different from a preference, hypothetical example, or observation. A commitment can be revised under authority; contradiction with an existing commitment is not inherently forbidden if that revision is the explicit proposal. Conversely, a proposal cannot authorize its own waiver.

Support is contextual and revisable. The same conclusion reached for different reasons may require different revision when conditions change. Losing one assumption prompts reassessment, not automatic deletion of every dependent conclusion. Uncertainty and scoped disagreement must remain expressible; lack of support is not falsity.

The kernel defines how these distinctions affect semantic validation and progression. It must not reduce knowledge to arbitrary text payloads plus a generic pass flag while leaving all meaning to an unaccountable model prompt.

## Interpretation and enforcement

Models and humans can supply interpretations, proposed dependencies, counterexamples, and judgments. Tools supply observations. Their outputs are not self-authenticating truth or lifecycle authority. The kernel gives them stable meaning through exact subjects, provenance, declared assumptions, scope, evidence, and explicit limits. A later interpretation does not rewrite the meaning or outcome of a historical assessment.

Deterministic mechanisms enforce representational contracts, subject/authority binding, state-transition rules, and declared invariants. They consume explicit inputs and return typed outcomes without ambient filesystem, Git, process, network, provider, clock, or randomness access. Effectful inference and execution remain behind bounded interfaces; keeping effects outside the kernel does not remove its ownership of the semantic contract.

The service applies authorization and performs effects. A judgment supplies reasons for a decision; it does not itself grant a capability, move a ref, launch a worker, or publish data.

## Transition reasoning

Validation distinguishes intent fit, consistency, reachability, preservation, justification, and authority. The [validation contract](checks.md) defines their use across Decision, Planning, Implementation, and Review. Desired outcomes can denote regions of acceptable realizations without introducing a separate State primitive. Joint satisfaction, refinement, and alternatives depend on explicit conditions; compatibility, reachability, and realization remain different claims.

An accepted baseline and invariant-preserving transitions, including semantic validation at joins, can establish enforced invariants within the model. They cannot establish eternal truth of arbitrary natural-language assertions or prevent external reality from changing unobserved. Historical acceptance and present support are separate.

A path can be useful because it gains information, reduces risk, or preserves options. There is no universal semantic distance every Change must monotonically decrease. Achievement goals concern outcomes; maintenance obligations constrain intermediate steps. A safe endpoint does not excuse a forbidden journey.

## Shared foundation, replaceable machinery

The four stage loops use the same meanings with different questions and evidence thresholds. Project procedures and obligations live in Wiki rather than separately authored Skills or Check Packs. Tests, CI, models, human review, and specialized verification remain useful methods; their availability and success cannot substitute for applicability, coverage, or authority.

Canonical encodings and digests make exact claims inspectable, not true by themselves. Indexes, Work views, alignment summaries, and attention rankings are derived interpretations. A candidate must not gain approval by changing its classification, discovery rules, or relevance ranking to exclude binding obligations.
