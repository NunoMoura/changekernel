---
title: Change and Ledger Property Gap Investigation
aliases: []
source-id: cw:research:change-ledger-property-gaps
---
# Change and Ledger Property Gap Investigation

## Scope and evidence status

**Initial read-only research on 12 October 2026; independent review pending.** This report supports brainstorming around the user-adopted [defining properties](../../product/change-ledger-properties.md). It distinguishes inspected source statements from our opportunity hypotheses. Four sources are not an exhaustive market survey, proof of unique invention, implementation evaluation or qualified integration. No upstream package, SDK, model, benchmark, agent or candidate was executed.

Public documentation URLs below are moving sources except the versioned preprint. Exact extracted passages, query/fetch receipts and the relevant original user-expression/acceptance entries are retained outside Git at `/home/canina7/.local/state/changekernel-source-review/r43-property-research.6BGfdUHV/`. These are readable captures, not original HTML-byte reproduction, signed provenance or immutable source-code subjects. The current pages may change; this report describes the inspected passages, not all versions of those protocols. Quoted excerpts normalize typography and mathematical markup; ellipses mark omitted material.

## Inspected sources and what they actually establish

### A2A: task interoperability and client-owned artifact decisions

Source: [A2A, Life of a Task](https://a2a-protocol.org/latest/topics/life-of-a-task/), sections “Task Immutability” and “Tracking Artifact Mutation.”

> “Once a task reaches a terminal state (completed, canceled, rejected, or failed), it cannot restart.”
>
> …
>
> “The client decides what counts as an acceptable result and can accept or reject new versions. So the serving agent shouldn't track artifact mutations, and this linkage is not part of the A2A protocol specification.”

**Observation:** this page already supports tasks, related context, parallel follow-ups and references. It explicitly leaves artifact version linkage and acceptance to the client, while refinements of terminal tasks initiate new tasks.

**Opportunity hypothesis:** a user-owned Change could retain the accountable pursuit across such tasks, including exact artifact adoption, changed intent and accepted contributions. A Ledger could let another authorized client retrieve those decisions rather than recreate them from its own private state. This complements the task protocol; it does not imply that A2A applications cannot implement those semantics themselves.

### MCP Tasks: durable operation handles and cooperative cancellation

Source: [MCP Tasks overview](https://modelcontextprotocol.io/extensions/tasks/overview), sections “How Tasks work,” “Task lifecycle” and “Implementation guide.”

> “The task is durably created before the response is sent.”
>
> …
>
> “Cancellation is cooperative — the server acknowledges the intent but is not obligated to stop the work.”

The inspected overview describes a task ID, initial status, TTL and polling interval, and exposes the original request's result or error at completion.

**Observation:** operation durability, reconnect/polling and asynchronous execution already have a protocol mechanism. Cancellation acknowledgment is explicitly weaker than confirmed stopping. A status/result is scoped to the underlying request; it must be interpreted through that operation's contract.

**Opportunity hypothesis:** a Change can distinguish the owner's completion conditions from the completion of one operation, and retain original attempts, required evidence, known consequences and unresolved responsibility across operation handles. Reuse MCP's supported mechanism where appropriate rather than build a general task runtime. This report has not inspected server implementations or established their side-effect/idempotency guarantees; TTL does not by itself prove what evidence is lost.

### Code execution with MCP: a known efficiency mechanism, not a new primitive

Source: [Anthropic, Code execution with MCP: Building more efficient agents](https://www.anthropic.com/engineering/code-execution-with-mcp), sections “Benefits of code execution with MCP,” “Progressive disclosure” and “State persistence and skills.”

> “Code execution with MCP enables agents to use context more efficiently by loading tools on demand, filtering data before it reaches the model, and executing complex logic in a single step.”
>
> …
>
> “Intermediate results stay in the execution environment by default.”

**Observation:** code-based composition, progressive tool discovery and local filtering already have a published rationale and examples. The article also acknowledges the infrastructure and secure execution costs of code execution. Its illustrative token reduction is not a ChangeKernel benchmark or a general performance guarantee.

**Opportunity hypothesis:** Change/Ledger access should make meaningful, bounded selection and expansion possible before data enters either script memory or model context. A script should retrieve applicable adopted decisions and required exceptions, not merely filter a whole transcript. The authoritative retained facts must remain independent of that script's private files or output. Code execution efficiency alone does not establish accountable ownership, adequate disclosure or safe native effects.

### Portable Agent Memory: direct prior art for ownership and portability

Source: [Portable Agent Memory: A Protocol for Provenance-Verified Memory Transfer Across Heterogeneous LLM Agents](https://arxiv.org/html/2605.11032v1), version 1; abstract, sections 3.4, 6.1 and 6.3. This is a preprint and its evaluation/security claims were not independently reproduced here.

> “Portable Agent Memory's design takes the position that the human operator (not the model provider or platform) owns the memory.”
>
> …
>
> “Our pilot evaluation uses N=50 tasks across three model pairs.”

The paper describes episodic, semantic, procedural, working and identity memory, provenance and scoped access. Its context pipeline ranks/compresses selected material; the limitations discuss possible loss of nuance and the need for broader validation.

**Observation:** user-controlled portable context, provenance and scoped disclosure are not unique ideas. This is relevant prior art, not evidence that the memory protocol lacks every accountability capability or that its claims are qualified. No claimed injection defense, plaintext-recall property, test count or continuity metric is adopted as ChangeKernel evidence.

**Opportunity hypothesis:** ChangeKernel should focus on exact adopted pursuits and consequential decisions rather than become a general-purpose agent memory store. Context selection cannot drop required intent, applicable constraints, failed assessments or unknown outcomes and still imply complete grounds. Compare semantic recall with model-free reconstruction of attributable adoption and responsibility, not with an invented claim that other systems never preserve them.

## Gap-to-value questions for brainstorming

The gaps below are boundaries exposed by the inspected sources, or explicitly labeled hypotheses about our consumers. They are not a blanket competitor comparison.

| Boundary | Concrete user problem to explore | Change/Ledger leverage | What must not be assumed |
| --- | --- | --- | --- |
| Client-managed artifact acceptance | A user changes clients and loses which exact version they accepted and why. | Accepted decisions, references and revision lineage in the same owner-controlled pursuit. | A2A cannot be extended, or a digest establishes consent. |
| Task completion versus pursuit fulfillment | Several operations finish, but an adopted objective or required observation remains unsatisfied. | Exact intent/completion conditions, accepted contributions and explicit conclusion across Work. | Every task completion is weak evidence; interpretation remains binding-specific. |
| Cooperative cancellation versus settled responsibility | A user stops or transfers work while a native result or executor cleanup remains uncertain. | Preserve attempt/outcome distinctions and responsibility in the continuation grounds. | A file or cancellation reply proves termination, delivery or safe repetition. |
| Portable memory versus exact adoption | A fresh agent recalls a recommendation as if the owner approved it. | Separate original expression, interpretation, adoption, revisions and applicable authority. | Other memory systems cannot encode decisions, or relevance ranking is adequate acceptance. |
| Compact context versus consequential omissions | A script or model saves tokens by hiding a required failed assessment or unresolved effect. | Bounded purpose-specific Views with exact expansion refs and explicit coverage/required gaps. | Filtering guarantees completeness, or this report measures the cost of a proposed projector. |
| Similar demand versus compatible commitments | Several people want related outcomes but differ on scope, rights or completion. | Propose convergence; explicitly adopt selected objectives into a new Change, retaining origins and source treatment. | Similarity establishes equivalent intent or allows automatic consolidation. This is a user-value hypothesis, not a surveyed market absence. |
| API steps versus portable pursuit | An application's capability changes and the stored plan no longer applies. | Separate adopted intent from version-bound Work/native operations and re-establish admission. | Portable meaning grants new native rights or removes integration contracts. |

## Novelty discipline and next evidence

The strongest current hypothesis is a coherent **user-owned accountability layer** combining accepted intent, transferable responsibility, collaborative composition and efficient agent-readable structure. None of these claims requires inventing another harness, general memory service, blockchain or scheduler. Neither JSONL nor ownership labels alone provide the value.

Before freezing representations, create small hypothetical examples for decision continuity, handoff with an unknown outcome, conflicting demand convergence, selective disclosure and capability change. For each, show a fresh deterministic reader's answer and a bounded code-use retrieval path. Compare at least a transcript plus Git/manual notes and the existing protocol mechanism relevant to that case; make the additional semantics and costs explicit.

This report authorizes no execution of those examples. Provider calls, runtime probes, paid inference, privileged experiments and benchmarks need their own selected scope and authorization. Source review and concrete design review can refine the hypotheses first. Later acceptance must use useful positive witnesses and consequential failures, not documentation wording tests or an inability to find a competitor.
