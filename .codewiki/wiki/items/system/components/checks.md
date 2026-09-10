---
{"aliases":["Checks","Validation"],"attributes":{"codewiki.component:ownership":{"roles":["model-check"],"sourcePatterns":[".codewiki/check-packs.lock.json",".codewiki/check-packs/**","check-packs/**","src/adapters/checks/**","src/kernel/gates/**","src/ports/check-runner.ts"],"testPatterns":["tests/adapters/checks/**","tests/kernel/gates/**","tests/ports/check-runner.test.mjs"],"traceEvents":["gate.recorded"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:checks","codewiki_id":"cw:component:checks","codewiki_relationships":[{"rationale":"Checks supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"},{"rationale":"Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}],"codewiki_source_patterns":["src/checks/**","check-packs/**",".codewiki/check-packs/**"],"codewiki_test_patterns":["tests/checks/**"],"description":"Owns Check, Check Pack, Pack Skill snapshot, Check SDK, bounded execution, Result, Gate Report, caching, and fail-fast contracts.","status":"stable","tags":["system","component"],"title":"Checks","type":"System Component"},"codewiki.legacy:source-path":"system/components/checks.md"},"itemId":"cw:component:checks","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:fb89bf701229b71d05e2309877708207de655916d76a8bd18212cd1766704cca","codewiki.legacy:source-path":"system/components/checks.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:checks"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Checks supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:check-author.author-composable-checks"}],"title":"Semantic Validation"}
---
# Semantic Validation

Semantic validation assesses the proposed evolution of knowledge and realization, not just prose syntax or compliance with a separately maintained rubric. The semantic kernel owns the meanings of findings and their consequences across the four stage loops. Tools, models, tests, CI, research, and human review supply evidence and interpretations without becoming independent acceptance authorities.

## Context and dimensions

A validation context distinguishes the accepted baseline, observed reality, candidate effects, expressed intent, applicable authority, and current stage. It preserves exact sources, assumptions, evidence scope, and relevant omissions.

| Dimension | Question |
| --- | --- |
| Intent fit | Do the effects and tradeoffs serve the expressed purpose compared with relevant alternatives? |
| Consistency | Can proposed and retained commitments hold together under the same conditions and scope? |
| Reachability | Is there a credible admissible path from observed reality with the means and constraints available? |
| Preservation | Which commitments must remain true during the journey, not only at the destination? |
| Justification | What supports the claims and which consequential uncertainties remain? |
| Authority | Who may approve affected revisions and protected effects? |

These distinctions are not a required six-test Pack or a universal fixed scoring formula. Applicability follows actual semantic effects. Accepted policy may be explicitly revised under authority; a proposed waiver cannot supply the authority or evaluation rules for its own approval.

Decision requires sufficiently justified intent and credible feasibility. Planning tests paths, dependencies, shared obligations, and decomposition. Implementation supplies exact observations about attempts and partial outcomes. Review assesses the combined candidate and remaining obligations. An implementation defect returns to Implementation, a decomposition conflict to Planning, and changed intent to Decision.

## Findings, not omniscience

Findings distinguish **supported**, **contradicted**, and **unresolved**, with reasons, scope, evidence, assumptions, and attribution. Stale support and changed conditions must remain visible. Unsupported is not false; a missing proof is not a counterexample; a model's confident statement is not a formal proof. Tests support their tested conditions, not every interpretation of a natural-language requirement.

Binding contradictions, missing authority, or unavailable required assurance cannot be averaged away or relabeled as success. An unresolved nonblocking question may remain open only with explicit scope, treatment, and responsible acceptance; recording an owner does not realize the target. Operational failure, such as a provider timeout, is not a negative semantic finding about the proposal.

A valid baseline plus invariant-preserving transitions and join validation can establish faithfully enforced invariants. It does not guarantee arbitrary assertions remain true forever or that no external drift occurred.

## Contextual scrutiny

Relevance, confidence, governing force, revision priority, consequence, and value of further inquiry are distinct. Ask whether knowledge could change acceptability, feasibility, value, or evidential sufficiency. A consequential weakly supported assumption may deserve more attention, not less. Dependency effects can matter despite low text similarity.

Attention rankings do not prove coverage. More documents must not dilute a binding obligation. Retain reasons for relevant context selection and report bounded-context omissions or uncertain relationships. A candidate cannot lower its burden by changing its label, corpus scope, or ranking. Further investigation should earn its cost without replacing hard obligations with an aggregate utility score.

## Supporting machinery

There is no separately authored project Check Pack policy system. Procedures and obligations belong in Wiki; verification implementations remain ordinary tools and evidence-producing work. Code-level checks, result envelopes, and host Check Runs can support the evaluator without requiring project enrollment in a parallel ontology. The word “check” does not itself imply a CodeWiki resource.

Reuse exact-subject, input-provenance, executor-identity, stale-result and recovery protections. Missing or malformed material and unavailable required execution remain explicit. A warned empty legacy Gate is not evidence that consequential semantic questions were answered. Never rerun nondeterministic reasoning to reconstruct an accepted historical judgment.

See [kernel](semantic-kernel.md), [evidence](evidence.md), and [Review](review.md).
