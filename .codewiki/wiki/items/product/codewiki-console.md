---
{"aliases":["CodeWiki","CodeWiki Console"],"attributes":{"codewiki.legacy:media-type":"text/markdown","codewiki.legacy:metadata":{"codewiki_id":"cw:design:product","description":"Interaction rules for minimal, truthful, terminal-first Semantic Kernel operations.","status":"stable","tags":["product","design","operations"],"title":"CodeWiki Console","type":"Design System","version":"alpha"},"codewiki.legacy:source-path":"product/DESIGN.md"},"itemId":"cw:design:product","itemType":"codewiki.legacy:design-system","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dde8b062975e50edb38aa1962c5aede69723cfbfb757c30792f62c790eeb0c35","codewiki.legacy:source-path":"product/DESIGN.md"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:design:product"}],"relationships":[],"title":"CodeWiki Hub"}
---
# CodeWiki Hub

CodeWiki is a knowledge-and-change collaboration hub for humans and AI Agents across teams. It helps people preserve enough justified, revisable knowledge that they do not restart inquiry from memory alone. Software, operations, research, and other team work use the same core; their evidence and execution methods differ.

Git supplies exact content, snapshots, ancestry, branches, merges, and transport. CodeWiki supplies semantic interpretation, validation, authority, deliberation, and continuity above that substrate. GitHub is a competing collaboration product and an optional integration, not the definition of a Change or its acceptance. Participants need not understand Git staging or refs to use the Hub.

## Two primitives

- **Wiki** is consolidated project knowledge: scoped assertions, adopted decisions, obligations, procedures, their grounds, and explicit uncertainty. A Wiki state is the Wiki at a revision, not another managed entity.
- **Change** carries intent and its evolution: desired effects, motivation, assumptions, alternatives, deliberation, planning, attempts, evidence, and outcome. It links adopted consequences back to their reasons.

A pending intention does not need an independently maintained desired-state document. An adopted consequence must still be discoverable in Wiki. Knowledge, intent, and observed realization are related but distinct: committing a procedure does not prove adoption, and merging an implementation does not prove deployment.

## Collaboration through inquiry

A person or Agent proposes a Change. Decision tests its purpose, tradeoffs, authority, and credible feasibility. Planning develops paths, dependencies, shared obligations, and safe parallel work. Implementation attempts authorized transitions and records discoveries. Review evaluates the reconciled whole against intent and remaining obligations. Feedback returns to its cause; material intent revision must be explicit rather than moving the target to fit an outcome.

The semantic kernel gives these activities one foundation. Validation considers intent fit, consistency, reachability, preservation, justification, and authority in context. It distinguishes supported, contradicted, and unresolved findings with reasons and evidence. Neither an empty test set nor an unqualified model judgment establishes semantic success.

## Knowledge without an authoring silo

Tracked Markdown participates wherever it lives. Ordinary editors and Obsidian-compatible files do not require proprietary frontmatter, stable IDs on every document, or a special import directory. Format extensions extract knowledge without executing document instructions or plugins. Discovery is not acceptance: quotations, fixtures, historical decisions, and proposed rules do not acquire equal governing force merely by being found.

Procedural knowledge belongs in this shared corpus. Tests, observations, research, and verification tools support it. Separate project-authored Skills and Check Packs must not duplicate meaning or become a parallel policy system.

## Durable, revisable continuity

A fresh participant can recover what is accepted, why, under which assumptions, which alternatives were rejected, what remains uncertain, and which action is next permitted. Preserve concise attributable rationale rather than every conversation. Missing historical reasons remain missing; historical acceptance is not present-day endorsement.

Contextual attention directs scrutiny toward consequential dependencies and uncertainty, not a universal importance score. Binding obligations cannot be averaged away or weakened by the candidate seeking approval. Progress may include investigation, risk reduction, or preserving options, not only immediate implementation.

## Boundaries

Checkpoints, judgments, acceptance, realization, publication, and deployment are different events. Git records exact outcomes; replay must not rerun model reasoning or external effects to recreate history. Integrations and generated views do not become authority through presentation. Worktrees separate work but are not security sandboxes. Protected effects require applicable authority before execution.

The Hub can grow through replaceable clients and execution integrations without requiring a full hosting platform, marketplace, or domain-specific framework to express its core loop.

See [Wiki](../system/components/wiki.md), [Change](../system/components/change-trace.md), [semantic kernel](../system/components/semantic-kernel.md), and [lifecycle](../system/flows/change-lifecycle.md).
