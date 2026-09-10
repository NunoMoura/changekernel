---
{"aliases":["Checks","Validation"],"attributes":{"codewiki.component:ownership":{"roles":["model-check"],"sourcePatterns":[".codewiki/check-packs.lock.json",".codewiki/check-packs/**","check-packs/**","src/adapters/checks/**","src/kernel/gates/**","src/ports/check-runner.ts"],"testPatterns":["tests/adapters/checks/**","tests/kernel/gates/**","tests/ports/check-runner.test.mjs"],"traceEvents":["gate.recorded"]},"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_component":"cw:component:checks","codewiki_id":"cw:component:checks","codewiki_relationships":[{"rationale":"Checks supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"},{"rationale":"Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}],"codewiki_source_patterns":["src/checks/**","check-packs/**",".codewiki/check-packs/**"],"codewiki_test_patterns":["tests/checks/**"],"description":"Owns Check, Check Pack, Pack Skill snapshot, Check SDK, bounded execution, Result, Gate Report, caching, and fail-fast contracts.","status":"stable","tags":["system","component"],"title":"Checks","type":"System Component"},"codewiki.legacy:source-path":"system/components/checks.md"},"itemId":"cw:component:checks","itemType":"codewiki.legacy:system-component","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:fb89bf701229b71d05e2309877708207de655916d76a8bd18212cd1766704cca","codewiki.legacy:source-path":"system/components/checks.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:component:checks"}],"relationships":[{"attributes":{"codewiki.legacy:relationship":{"rationale":"Checks supplies the System responsibility required by this Story.","target":"cw:story:maintainer.enforce-project-standards","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:maintainer.enforce-project-standards"},{"attributes":{"codewiki.legacy:relationship":{"rationale":"Checks supplies the portable authoring, composition, input, output, and sandbox contracts required by this Story.","target":"cw:story:check-author.author-composable-checks","type":"realizes"}},"predicate":"codewiki.legacy:realizes","targetItemId":"cw:story:check-author.author-composable-checks"}],"title":"Semantic Validation"}
---
# Semantic Validation

Validation assesses a proposed transition against intent, current accepted knowledge, observed reality, evidence and authority at an exact stage and subject. The kernel owns its semantic meaning; tools, tests, models and humans supply support without becoming independent acceptance authorities.

## Dimensions and stage context

| Dimension | Question |
| --- | --- |
| Intent fit | Do these effects and tradeoffs serve the purpose compared with relevant alternatives? |
| Consistency | Can proposed and retained commitments hold together under the same conditions and scope? |
| Reachability | Is there a credible admissible path from observed reality with available means and constraints? |
| Preservation | Which commitments must remain true during the journey, not only at the destination? |
| Justification | What supports the claims and which consequential uncertainties remain? |
| Authority | Who may approve affected revisions and protected effects? |

These are distinctions, not a mandatory six-test Pack or fixed scoring formula. Applicability follows actual effects. An explicitly proposed commitment revision can be assessed, but its own waiver cannot supply governing authority.

[Decision, Planning, Implementation and Review](../flows/change-lifecycle.md) share this foundation with different evidence boundaries. Feedback returns to the cause: artifact defects, path/dependency conflicts or materially changed intent.

## Findings and grounds

Findings are **supported**, **contradicted** or **unresolved**, with reasons, scope, evidence, assumptions and attribution. Report stale support and changed conditions. Unsupported is not false; a missing proof is not a counterexample; model confidence is not formal proof. Tests support their tested conditions, not every interpretation of a requirement.

Missing authority, binding contradictions and unavailable required assurance cannot be averaged away or relabeled as success. Nonblocking uncertainty needs explicit scoped treatment and responsible acceptance; an owned gap remains unrealized. Operational failure is not a semantic refutation. Enforced invariants do not establish eternal truth of arbitrary prose.

Cold information can reveal a counterexample or defeat an assumption before Wiki is revised. It can challenge or block proposed work, but does not silently replace current commitments. A historically accepted rule remains historical until an accepted Change adopts it again. Multiple summaries of one source do not constitute independent support.

## Contextual scrutiny

Separate relevance, confidence, governing force, revision priority, consequence and value of inquiry. Ask whether material could change acceptability, feasibility, value or evidential sufficiency. Consequential weak support can deserve more scrutiny; low text similarity does not imply an irrelevant dependency.

Hot Wiki is not an instruction to load every page into every prompt. Context selection and bounded RAG must preserve applicable obligations and expose omissions, redaction, uncertain relationships and unavailable sources. More content cannot dilute a binding rule. A candidate cannot reduce its burden by renaming files, relabeling knowledge, hiding scope or changing rankings. Retrieval is not coverage proof.

## Verification machinery

Procedures and obligations belong in Wiki, not a separately authored Skills/Check Pack policy system. Ordinary tests, CI, observations and host Check Runs remain useful. Preserve exact-subject/input binding, attribution, stale-result rejection and [recovery](../flows/recovery.md). Missing required execution or an empty set of checks supplies no semantic assurance. See [evidence](evidence.md).
