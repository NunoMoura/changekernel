---
title: ChangeKernel
aliases:
  - ChangeKernel Hub
  - ChangeKernel Console
source-id: cw:design:product
ownership:
  sourcePatterns:
    - src/application/**
    - src/kernel/changes/**
    - src/kernel/data-contracts/**
    - src/kernel/identity/**
  testPatterns: []
  traceEvents:
    - change.proposed
    - change.revised
    - change.planned
    - change.completed
    - change.superseded
    - effect.recorded
  roles:
    - planning
source-history:
  provenance:
    - attributes:
        codewiki.legacy:source-digest: sha256:dde8b062975e50edb38aa1962c5aede69723cfbfb757c30792f62c790eeb0c35
        codewiki.legacy:source-path: product/DESIGN.md
      kind: codewiki.legacy:knowledge
      subjectId: cw:design:product
  relationships: []
---
# ChangeKernel

**ChangeKernel is a redistributable State-and-Change engine for applications.** Developers provide structures and native abilities; users choose goals; agents and other workers compose paths. ChangeKernel governs State evolution, supports recovery within declared limits and retains useful learning for people and agents. It is not an agent, a harness, a database engine or an operating-system kernel.

This is the primary desired-state design, not a statement of implemented capabilities or release qualification. Four supporting contracts retain substantial detail without a separate document for every role, stage or flow:

| Contract | Detail owned there |
| --- | --- |
| [State and persistence](../system/components/state.md) | Source authority, research custody, intent/memory provenance, candidates, receipts, concurrency and recovery. |
| [Checks](../system/components/checks.md) | Assessment responsibilities, admission feedback, adoption, read-only evaluation and reuse. |
| [Execution](../system/components/agent-execution.md) | Worker containment, model transport, durable attempts and output custody. |
| [Release and qualification](../system/components/package.md) | Version transitions, required proof and external-controller boundaries. |

The `wiki/` path is retained for source development; it does not make Wiki a runtime primitive or require application State to be Markdown. Prior committed design pages remain in Git history, not an active parallel specification. Uncommitted draft material is consolidated here and in the four contracts. Execution progress belongs in Changes and Work after qualified adoption, with only a short [temporary status note](../../../../CHANGEKERNEL_STATUS.md) beforehand.

## Continuous development, use and improvement

ChangeKernel governs systems throughout their lives, not only while their software is being developed. Its foundation is actor-neutral: the same State and Change primitives support human actions, delegated agents and automation during development, integration, ordinary use after launch and ongoing improvement. Users bring goals and experience; developers provide and evolve structures and abilities; agents can both help users pursue goals and perform authorized development. These roles collaborate without acquiring one another's authority automatically.

“Better” describes an intention, not an effect that the engine guarantees. Preserve what the owner intended, what actually changed and what observations support success, failure or uncertainty. Correct execution may still fail to realize the intended benefit. ChangeKernel verifies outcomes against the applicable intent and requirements; it does not arbitrate whose goals or preferences deserve to prevail.

```text
Develop and integrate capabilities → pursue user goals → observe actual outcomes
    → propose improvements to capabilities, structures or procedures
    → assess, authorize and realize supported Changes → use and learn again
```

This is an open-world approach to goals, not a requirement to enumerate a workflow for every outcome. Workers compose supported abilities, acquire needed observations and expose unresolved knowledge or capability gaps. Open-world pursuit does not imply unrestricted effects, automatic policy changes or invented capabilities. Existing abilities may satisfy a goal without software development; genuine gaps can lead to separately authorized development and deployment through [cross-container development](#cross-container-development).

ChangeKernel provides one authoritative boundary for governed product operations, with human interfaces, agents and other integrations as clients. A user request is not permission to modify the product's code, deploy a release or change governing policy. Shared experience can ground improvement proposals, but adoption and realization require the same controls as other Changes. Keep user and developer scopes, private data, commitments and Evidence distinct throughout the cycle.

## Ownership model and responsibilities

**Container definition → Container → Changes to State.**

A **Container definition** describes permitted structure, meaning, rules and supported capabilities. It can be discovered, supplied explicitly or assembled from both. A **Container** is its durable identified ownership and collaboration scope. State, Changes, commitments and procedural memory belong to that scope.

A band workspace contains members, songs, recordings, contacts, venues, tours, budgets, files and procedures together. It is not one container per entity, user-table identifier, database, repository or process. Independent logical ownership is required; physical separation is optional. One host/database may serve many containers. Shared resources require explicit relationships and authority, not ownership inferred from a reference.

Each Change has an accountable user on whose behalf it is pursued. An agent is an executor, not the Change owner or an independent source of authority. Retain worker, configuration and delegation provenance without transferring ownership when workers change. Owning a Change does not grant rights over its targets: the existing system determines resource ownership, membership, sharing and permitted operations. Bind that authority through trusted host context, not agent-supplied identity or a parallel independently administered ChangeKernel ACL.

Products and workspaces are the initial experience, not a one-product/one-container restriction. A product may serve many tenant scopes; a scope may involve several products or hosts. Shared application code and schemas can remain developer-owned while tenant data follows native tenant permissions. OS resources may participate through qualified bindings, but a machine is neither a universal ownership boundary nor an implicit grant over everything it hosts. The longer-term direction is cooperation between independently owned systems, not one controller owning them all.

Definitions are inspectable and version-bound. A shared definition update must not silently migrate or reinterpret existing containers. Container-local structures and learning do not automatically rewrite other containers or developer policy. Schema analysis may be shared without sharing private State. Code supplied for discovery does not become writable customer State; developer-owned code and release configuration can belong to a separate development container.

| Responsibility | Owner |
| --- | --- |
| Structures, meaning, native business behavior and binding configuration | Application developers, reusing existing authoritative declarations. |
| Goals, accepted commitments and scoped delegation | Authorized users and teams. |
| Accountability for a Change, including an agent's actions on the user's behalf | The responsible user, bound through trusted system identity. |
| Native resource permissions, membership and sharing | The owning application's existing authorization rules. |
| Path composition, production and observation collection | People, agents or services acting as workers, without replacing the Change owner. |
| Permission enforcement at the integration boundary, consistent transitions, Checks, durable coordination, memory and declared recovery | ChangeKernel and its application host through qualified source/execution bindings. |
| Process hosting, credentials, durable storage and enforcement support | Application-owned host and its deployment. |

Kernel names the internal engine; Server names a host role, not another State owner. Product, Project and World are no longer formal public subjects. Container means a state container, not a Docker container.

### Owner-directed automation

Proactive pursuit and automatic continuation are configurable, not compulsory. A user may authorize their agent to act within the user's existing rights, including editing shared State, and remains accountable for those Changes. Agent origin alone does not require a second resource-owner approval. Existing system approval rules, business constraints and any explicitly adopted restrictions still apply; automation neither enlarges permissions nor removes required verification or history.

An optional additional layer may later restrict AI use where traditional permissions do not express a needed distinction. It must narrow existing authority, not grant a route around it. Designing a generalized AI-restriction layer is deferred, not a prerequisite for the first enforced application integration. Existing custody, containment and exact-effect safeguards remain necessary to substantiate the capabilities that an integration actually claims.

The system enforces its supported boundary independently of model cooperation. A read-only interface is not containment if an agent can write through an unrestricted shell, database credential or another route. An integration that only observes outside writes must say so; logging afterward is not equivalent to mediating them.

## Developer experience

**Connect → discover → govern → learn.** Create a real durable container rather than requiring a handwritten entity/action catalogue first. Sources and explicit overrides are optional. Opening an existing identity never resets it.

These examples are **illustrative, not implemented exports**. TypeScript illustrates the application binding, not the language of the authoritative engine. PostgreSQL demonstrates an adapter shape, not a selected or qualified first adapter. `actor` comes from trusted authentication; `team` and source scope come from authorized application policy. Setup happens once per application, not on every Save:

```ts
const ck = createChangeKernel({ storage: postgresStore(database) });
await ck.start();
```

### Nothing exists

```ts
const container = await ck.createContainer({
  id: "band-atlas",
  owner: team,
  actor,
});

const change = await container.change({
  actor,
  what: "Create a draft Summer Tour with a €1,200 budget.",
  why: "Start planning our summer shows.",
});
```

Generic managed records, documents and relationships allow useful local structure without a Tour database table. Governance and procedural-memory machinery exist from creation, but useful domain content does not appear automatically. A producer can propose missing shape and values under current rules. Native schema introduction or migration is a separate authorized structural change.

### Structures exist without records

Assume deployed `tours`, `contacts` and `venues` tables whose owned rows have `workspace_id`:

```ts
const appData = databaseSource({
  connection: database,
  schema: "app",
  scopeBy: "workspace_id",
  discovery: { repository: "./" },
});

const container = await ck.createContainer({
  id: "band-atlas",
  owner: team,
  actor,
  sources: [appData.forScope("workspace-42")],
});
```

The same tour request prepares a native insert, such as `budget_minor: 120000` and `currency: "EUR"`, rather than a competing generic Tour copy. Trusted policy injects scope; a naming convention or generated filter is not isolation. Schema files alone prove neither deployed tables nor empty data. Authorized observation must establish emptiness; discovery does not perform migrations.

### Structures and records already exist

Use the same source configuration and creation interface. Existing records remain authoritative in place; observe an honest scoped baseline without inventing earlier governed Changes or reasons.

```ts
const change = await container.change({
  actor,
  what: "Raise the Summer Tour budget to €1,200.",
  why: "Allow for higher transport costs.",
});
```

If the current budget is €900, prepare and assess that exact transition, recheck relevant conditions, update the authoritative row and retain its outcome/recovery grounds. Unrelated data remains unchanged. Unknown or unobserved data is not empty; outside writes are drift, not retrospective approvals.

### Reopen and inspect

```ts
const container = await ck.openContainer({ id: "band-atlas", actor });
const description = await container.describe({ actor });
```

`change` returns a durable reference, not necessarily synchronous completion. Inspection exposes definitions, supported capabilities, rules, source versions, observation coverage and unresolved bindings. Creation collisions/retries must not reset existing State or Work. No required empty/import mode substitutes for observing the actual situation.

## Discovery and bindings

Reuse authoritative sources instead of duplicating their contracts:

| Source | Contribution and limit |
| --- | --- |
| Database catalogs | Actual tables, fields, types, keys, defaults, relations and native constraints; not all application behavior. |
| Runtime schemas and generated metadata | Executable structure; erased language types alone are insufficient. |
| Supported handlers, validators and framework declarations | Operations, inputs/outputs, business rules and authoritative execution paths. |
| Comments and documentation | Source-backed meaning candidates, not automatically governing instructions. |

A binding declares supported observation, identity/scope, comparison, preparation, publication, concurrency guards, outcome lookup, history and recovery. Not every binding supports every ability. Expose unresolved coverage rather than bypass existing business logic with generic writes. Common State operations come from reusable bindings; native business abilities can reuse existing typed functions. Developers fill exceptions, not recreate every entity or endpoint for each goal.

Developers can integrate external tools, services and agent-facing interfaces through supported bindings and the shared public boundary. Each integration declares its inputs, outputs, effects, permissions, limits and supported outcome/recovery behavior. Connecting a tool neither adopts its output as truth nor gives it a route around guarded effects. No particular browser-tool protocol or external tool framework is a kernel dependency.

Rust types constrain engine contracts; versioned runtime definitions describe application-specific entities without compiling every application's domain into the kernel. Validate model and client inputs at runtime, preserve native validators and derive typed client interfaces from public contracts rather than duplicate governing rules. Semantic interpretation proposes bindings and values; it does not confer authority.

Repository discovery follows:

```text
Versioned sources → syntax/dependency units → exact schema extraction
  → bounded parallel Jev classification → evidence-backed grouping
  → producer synthesis of missing meaning → source/binding validation
  → inspectable version-bound definition
```

Keep source locations, enclosing context, imports and relevant dependencies. A whole function is not necessarily whole context; oversized units require explicit subdivision or another route. Roles include resources, input/output/value structures, validators, capabilities, helpers and unresolved units; roles can overlap. Preserve uncertainty rather than drop ambiguous candidates. Code extracts exact fields/types; generation must not invent replacements or unsupported relationships.

Use incremental analysis of changed units and affected dependencies, not repository rediscovery on every Save. Discovery can identify resources without loading every row into memory or sending a database to a model. Repository text is untrusted data: never execute discovered instructions, imports, scripts or plugins. Hosted analysis requires disclosure authority. Discovering structure neither deploys capability nor grants mutation permission.

## State, evidence and recovery

State is the current authoritative representation of owned values, adopted obligations and supported knowledge, with relevant gaps, conflicts and unknowns explicit. It is not an assertion that every recorded claim is verified reality. Source observations, accepted requirements, desired outcomes and observed realization have different meanings. Changes progressively resolve gaps or revise unsupported knowledge; absence of knowledge is not knowledge of absence.

Existing native rows/files remain authoritative in place. Generic managed State owns values only where no native source supplies that meaning; there is no competing current-state mirror. A connected source may expose writable resources, read-only evidence or both. Its connection does not adopt every assertion it contains. The application's supported database is the default protected ChangeKernel store; SQLite is optional for local/new applications or fallback, not a mandatory sidecar.

Read sources on demand, retain what decisions rely on, and recheck what actions depend on. Need follows intent, applicable procedures, constraints and affected dependencies, not only what an agent happens to search for. Authorized research can discover and retain new source resources, subsequently consumed through ordinary bindings with provenance, permissions and retention limits. Historical support and current execution dependencies are different links. Detailed acquisition, observation and memory rules belong in [State and persistence](../system/components/state.md#sources-observations-and-retained-research).

**Observed current State + exact candidate → proposed difference.** Resource identity is distinct from value and version. Not every source offers a global snapshot. The backend derives actual differences under supported semantics rather than trust an agent's effect summary. Candidates may be patches; generated/approved content is durable until execution, reconciliation, Review and retention obligations allow disposal. Re-fetchable observations may be caches, but unique candidates and recovery grounds are not.

A trace connects intent, assessments, attempts, authority and receipts through durable references rather than embedding every payload. A transaction identifier alone is not historical custody. Reuse qualified native history or retain needed previous values/differences; do not mandate a full historical mirror. Mutation and receipt can be atomic only when they actually share a supported transaction. Separate stores need trustworthy source-side outcome reconciliation before retrying a lost response.

Evidence supports or challenges a scoped claim; it is not automatic proof. Preserve subject, source/version, method, observation time, assumptions, counterevidence and limits. A pass is not approval, approval is not execution, and execution is not necessarily realization. Several summaries of one source are not independent corroboration. Historical retrieval cannot rerun a model to recreate missing grounds or re-adopt an old rule.

Desired requirements and observed realization remain distinct: adopting a 30-day retention rule does not prove deletion happens. Views relate desired outcomes, observations and ongoing Changes without another authoritative task or outcome database. A future target need not be an immediate violation; an owned gap is still a gap. Missing, private, stale and truncated coverage remains explicit.

Recovery is normally a new guarded transition that preserves later valid work where possible. History supports repair of bad Changes; backups protect storage loss. Restoration, compensation and containment differ, and no data rollback undoes disclosure. Each binding declares covered failures, retention, assumptions and exclusions. Detailed publication and recovery obligations live in [State and persistence](../system/components/state.md).

## Intent and lifecycle

**Decision + Execution** are the two public lifecycle phases. Decision determines whether to pursue an outcome within stated commitments and authority. Execution carries that pursuit through planning, preparation, guarded effects, observation, recovery and verified completion. Intake is internal capture and refinement machinery, not a third phase. Phase names do not limit the number of visible runtime states, attempts, assessments or transactions.

Intake accepts **What** and available **Why**, or exact structured edits. **How** develops internally. Trusted transport binds actor, scope, source references, expected versions and stable retry identity; natural language supplies no authority. Same retry identity with different input must not execute another operation. Reads and inquiries can remain reads; “yes” binds an exact proposal and “stop” identifies active work.

The Change owns the immediate pursuit's original request, interpreted intent, desired outcome and success observations, scope, exclusions, commitments, consequential decisions and material alternatives. Distinguish stated, inherited, inferred-but-unconfirmed and unknown meaning. Preserve attributable revisions instead of rewriting accepted intent to match delivered output. Work inherits exact intent and relevant State versions; continuing goals, requirements and adopted procedures belong in State. No independently writable `intent.md` at each task boundary is required. A Change log means its durable record and trace, not the release `CHANGELOG.md`; current design is not replaced by its revision history.

Missing information remains explicit rather than becoming mandatory paperwork before an idea can be retained. “Edited in frontend” is origin, not rationale. Routine steps can inherit purpose; consequential ambiguity warrants clarification, not an invented default or a reason dialog for every minor edit. Setting font size to 16 does not establish a permanent preference or prove improved readability.

### Decision admission and refinement

Decision includes proposal clarification, justification, applicability assessment and required approval or delegation. Its admission boundary is **ready for bounded planning and pursuit**, not ready for every future effect. Rough proposals can be recorded before admission. The backlog is a permissioned view of proposals awaiting decision, clarification or priority; accepted Work queues are separate views of the same durable records, not independently editable task stores.

The engine owns a bounded refinement loop: identify missing or contradictory material, return targeted feedback, collect authorized observations or propose a revision, then reassess affected conditions. Feedback binds the exact revision and identifies the requirement or advisory suggestion, affected scope, grounds, missing information or authority, permitted next actions and intent/constraints that correction must preserve. Large or unfamiliar proposals are not automatically invalid; suggested decomposition is not automatically a mandatory blocker. A changed proposal gets an attributable revision and new retry identity rather than reusing an old request with different content.

Internal intake mechanics are not a new customizable Check stage. They reuse shared feedback and assessment machinery. Domain-specific admission and outcome criteria remain available; internal orchestration does not make every criterion universal. Missing knowledge can permit bounded investigation; missing authority requires permission or a stop. Preserve rejected input, bound refinement attempts and cost, and allow waiting, deferral or rejection rather than resampling until acceptance.

Conversation can already perform Decision work. Retain and reuse applicable conclusions and exact-subject approval instead of repeating an interview. Conversation itself is not approval, and an automated origin is not a requirement for human approval. An automated proposal without suitable delegation waits for the required decision; a proposal within delegation may proceed once applicable requirements hold. Explicit user instruction still does not waive failed requirements or preapprove unknown effects.

### Assessment responsibilities

The two-phase model preserves these internal responsibilities. The names Decision, Implementation and Review identify assessment meaning here, not three mandatory public phases or a new interpretation of existing protocol fields.

| Public phase | Internal responsibility |
| --- | --- |
| Decision | Establish justified bounded pursuit, clear intent, commitments, feasible next steps, uncertainty, assessable outcomes and approval needs. |
| Execution: Implementation assessment | Continuously assess methods/dependencies, exact prepared effects, actual contributions, custody and truthful partial outcomes. |
| Execution: Review assessment | Assess reconciled combined results, remaining obligations, supported realization and lawful completion. |

```text
Internal intake → Decision: clarify, assess, admit or wait
  → Execution: continuous planning and bounded Work
    → exact candidate + required assessment and authority
    → fresh publication guards → effect and receipt → observation
    → refine, repair or continue as needed
    → assess combined outcome → complete only when justified
```

Planning, scheduling, deployment where applicable, review coordination and recovery are engine machinery; domain Checks supply scoped judgments without owning orchestration. Customization is not restricted to pre-effect assessment: relevant domain requirements can apply to proposals, candidates and observed outcomes. Either backend or domain evaluation can use code and bounded judgment. Private drafts, requests and Work may be persisted before protected publication under their own rules. Long reasoning or approval waits stay outside short publication transactions.

Publication/application of effects generalizes; a single final deployment stage does not. Software may prepare privately, assess release readiness, deploy, then observe and review results. Other Changes update records or adopt guidance directly, or perform multiple outside effects over time. A pre-delivery aggregate assessment does not establish subsequent delivery success. If the promised outcome is a reviewed release artifact, deployment may be a separate linked Change; if the promise is availability to users, deployment and its observation precede completion. Checks do not deploy or collect fresh observations themselves.

Built-in requirements, authoritative source constraints and adopted domain policy retain distinct ownership. A Pack distributes evaluators, not another authority. Passing, readiness, approval and acceptance are separate; a candidate cannot activate its own weaker policy. Legitimate revision follows current authorized rules. Required failures cannot be averaged away or waived by treating approval as a pass.

Consequences such as reach, sensitivity, reversibility, others' interests and uncertainty inform policy-derived approval. Policy determines who can approve and what cannot be delegated. Model-assessed severity alone does not set ceremony or override ownership. Autonomous self-improvement additionally needs scoped delegation, containment, limits, current guards, protected custody and recovery; good user Checks alone are insufficient. Controller replacement retains release qualification and required handoff.

Defects return to refinement within Execution, material intent/scope/authority changes to Decision, missing observations to collection and provider failures to operational handling. Pause, reject, defer, withdraw or cancel when appropriate. Completing individual tasks, producing a booking row or delivering a feature does not establish the combined user outcome. Optional improvements must not conceal unmet required outcomes. See [Checks](../system/components/checks.md).

### Change granularity and classification

A Change is a coherent, bounded, assessable commitment, not a commit, worker session, task, record count or one transaction. A proposal is that same Change in its proposed state, not a separate entity promoted into a new Change after approval. Planning decomposes its pursuit into Work, where actual edits and other contributions are defined. Exact candidates/effect batches retain the material for particular steps, not a second proposal lifecycle. A Change can retain multiple immutable multi-entity batches without knowing every future effect upfront.

A million record effects need not mean a million Changes. A bounded bulk goal can use staged Work and supported batches; an indefinite objective such as improving a product forever belongs in continuing State pursued through multiple Changes. Prefer related Changes when outcomes can independently be accepted, deferred or cancelled, need distinct intent/commitments or approval decisions, or have independent completion/recovery boundaries. Keep tightly coupled effects together where splitting hides correctness. Preserve shared constraints and dependencies: splitting creates no additional authority or aggregate budget. Large-scale execution remains a qualification target, not an implemented claim.

Use a small versioned classification profile, not an exhaustive universal type-to-pipeline switch. Useful dimensions are purpose, affected meaning, scope/consequences, recovery support, knowledge readiness and applicability of an established procedure. Purpose can distinguish learning, creation, adjustment, repair or retirement while admitting mixed and unresolved cases. These examples do not freeze an exhaustive vocabulary. Exact operations, permissions and qualified binding capabilities come from code; Jev assists genuine bounded semantic judgments. Domain Packs may add labels without replacing universal requirements.

Jev's [255-option Choice limit](https://docs.typesafe.ai/primitives/choice) is per question, not a target number of Change types. Ask focused questions and compose answers in code; do not ask a model to select a supposedly safe pipeline from an unverified summary of unbounded effects. Classifications bind exact inputs, definitions, model/settings and uncertainty handling. Intake classification is provisional: material candidate effects or new observations require reassessment. Actual effects and policy determine applicable requirements, not a repair/documentation label, averaged risk or model confidence. Qualify against missed obligations and unsafe omissions, not merely label agreement.

## Continuous factory and Work

The factory is durable ordinary coordination code. Its routes are direct typed operations, deterministic expansion of a known procedure, or producer-generated missing plans/content/programs/Work graphs. Configuration is the main customization route for concurrency, budgets and refinement limits; domain obligations may still require executable rules.

Choose coherent Work, not the smallest possible units. Retain inherited purpose, scope, prerequisites, shared obligations, expected outcomes, observation needs, allowed tools/effects and limits. Child successes do not prove parent coverage. Missing knowledge needs information; missing authority needs permission or a stop; indivisible difficulty may need a stronger worker rather than endless splitting. Research can justify detours without a universal distance-to-goal score decreasing on every step.

Persist attempts, assignments, dependencies, waiting reasons, budgets, cancellation and partial outcomes across processes. Code determines eligibility, conflicts, limits, fairness and reservations before Jev ranking or worker-fit judgment. Confidence is not worker success probability. Bound retries, decomposition, concurrency and total cost; do not starve eligible work or resample unchanged failures.

Dependencies include intermediate conditions and commitments, not only final artifacts. Disjoint rows or files do not prove independence: three €400 commitments exceed €1,000, and early disclosure can violate an embargo elsewhere. Authorized reservations differ from worker leases and tentative ideas. Resolve conflicts through ordering, prerequisites, scope revision, pause, supersession or authorized choice. Long-running Changes do not hold months-long locks. Unknown effects or custody block unsafe retry even after lease expiry.

## Semantic operations and Jev

ChangeKernel owns a provider-independent semantic service for binding, context/support judgments, Checks, discovery classification, Work ranking/fit and experience/guidance retrieval. Packs do not supply independent provider clients, credentials or schedulers. Jev is central intended machinery for suitable bounded judgments, not the whole model or an authorization replacement.

Code handles exact identities, permissions, literals, dates, arithmetic, schemas, transitions and outcome lookup. Copy supplied text. Use a producer only for genuinely missing text, plans, programs or definitions; no mandatory generative verification of every Jev answer is required. Exact structured edits bypass unnecessary rebinding.

For “Set our summer tour budget to €1,200,” retrieve authorized target candidates, resolve meaning and construct typed input in code:

```json
{
  "target": "tour:17",
  "operation": "set",
  "field": "budgetLimit",
  "value": { "currency": "EUR", "minorUnits": 120000 }
}
```

An operation binds exact question, input/source roles, declared options/result interpretation, uncertainty route, provider/model/settings, limits and retained outcome. Filter permissions before retrieval. Include applicable inherited obligations, exceptions and relevant relationships; topical similarity alone is insufficient. Detect overflow rather than truncate critical context. Labels inside a shared request are not access isolation.

Jev's documented [primitives](https://docs.typesafe.ai/primitives) supply bounded Choice, Score and yes-probability judgments, not unconstrained extraction or generation. Choice's 255-option maximum is per question, not per application. The [model documentation](https://docs.typesafe.ai/models) reviewed during design lists `jev-1.13.0`, 64k total request tokens and 32k State-plus-longest-question tokens; verify these version-specific limits during qualification. Prefer small coherent context. Batch independent questions; questions in one request cannot consume one another's answers.

Code owns thresholds, aggregation and scheduling facts; required prohibitions cannot be averaged away. Retain false as well as true results. Confidence is not verified correctness. Escalation follows uncertainty/consequence policy rather than routine stronger-model review. Local hosting does not imply local inference; disclosure, retention, total cost and full-path latency require qualification, not reliance on provider claims. Native Jev questions require deliberate integration with the current text-oriented model port.

## Change memory and procedural State

Memory has two complementary homes, not two competing current copies. **Change memory** retains what happened in a particular pursuit and why: original and revised intent, decisions, material alternatives, assumptions, attempts, exact procedure/assessment/candidate references, effects, observed outcomes, failures, repairs and unresolved consequences. **State memory** retains what currently applies: adopted procedures, continuing goals/preferences/constraints and supported knowledge with scope, uncertainty and adoption/revision/retirement history. Preserve concise attributable rationale and necessary grounds, not every conversation or private reasoning transcript.

The engine owns representation, custody, versioning, retrieval and transitions; each container owns contents and visibility. Tools are executable abilities; procedures are reusable strategies, not permission grants. An authoritative native runbook or executable policy can be adopted by exact reference rather than copied into another writable store. Developer-supplied guidance can seed proposals; installation alone does not adopt it.

```text
Change experience → proposed lesson → assessment and authorized adoption
  → versioned procedure in State → later Work uses exact version
  → later Change records usefulness, failure and proposed improvement
```

Adopting, revising or retiring State memory uses the same Change controls as other semantic State updates. Internal learning machinery may collect, compare, draft and prepare; it is not a second publication authority. Memory updates may be effects of an existing Change, while learning after closure can become a linked Change. Automatic adoption within delegation is possible, without mandatory model calls or human dialogs for every observation. Protected research custody and derived index/freshness maintenance do not silently change governing meaning.

A procedure identifies purpose/applicability, instructions or exact code/configuration reference, preconditions/limits, version and adoption status. It has two different source relationships: pinned historical support explaining its adoption, and parameterized observation requirements to obtain when using it. A current execution dependency or governing assumption may require reassessment when it changes; historical evidence remains historical. Each later Change records the exact procedure versions actually used, so both past decisions and current guidance are explainable. The [State contract](../system/components/state.md#intent-change-memory-and-procedural-state) owns retained identities, source links and access rules.

| Material | Durable home |
| --- | --- |
| Immediate pursuit and its intent revisions | Change record and trace. |
| Case-specific observations and outcomes | Retained grounds referenced from Change memory. |
| Continuing goal, preference or constraint | Scoped adopted State. |
| Supported knowledge or reusable strategy | Versioned State with evidence and applicability limits. |
| Reliable mechanics | Code/configuration or tests rather than redundant prose. |
| Unadopted improvement | Proposal or candidate, not active guidance. |

Repetition and correlation can justify a proposal, not automatic policy or proof of causation. A memory update cannot weaken the rules authorizing its own adoption. Local success must not silently become a prohibition, global preference or shared developer policy. Purpose may transfer while its implementation does not: readability is not always font size 16. Failed or recovered work can teach without completing its original goal. Not every observation needs a procedure or backlog item.

Retrieve within current permissions before judging relevance; include applicable obligations, exact versions and uncertainty rather than just similar prose. Return whether material is historical context, proposed learning or current adopted guidance. Summaries and indexes are derived, not replacement sources or independent corroboration. Context eviction does not retire policy. Generate bounded human/agent briefs or exports when useful, not another independently editable intent or memory file. Cross-container reuse and derived knowledge require authorized sharing. Memory guides investigation and repair but never replaces exact effect receipts, recovery grounds or current observations.

The [Anthropic playbook](https://claude.com/blog/the-ai-native-sdlc-playbook), its [on-call account](https://claude.com/blog/ai-ci-cd-on-call) and [security account](https://claude.com/blog/how-anthropic-secures-its-ai-native-software-development-lifecycle) informed this direction: durable handoffs, incident-to-procedure learning, early feedback, evaluation of agent configuration and attention to delegated authority. They combine guidance and reported experience, not qualification evidence for ChangeKernel. Their Markdown layouts, fixed workflow sequences and sample hooks are not adopted as universal contracts. More explicit architecture is not proof of greater efficiency; compare useful outcomes, human attention, missed constraints, rework, recovery and total cost.

## Frontend guidance and responsiveness

Forms, agents, external tools and automation use permission-aware domain reads and the same authoritative backend mutation boundary. A human Save or external tool call is not a bypass. Presentation and local draft interaction need not become governed effects. Portable checks can run locally; permissions, shared-State/aggregate constraints and semantic conditions may require server assessment. Reuse supported rules rather than maintain separate frontend/backend policy copies. Not every custom Check or database rule belongs in a browser.

Shared feedback exposes blockers, required approval or Evidence, advisory guidance, suggested next steps, source/adoption/version, exact assessed input/scope, freshness and unresolved coverage. Filter explanations as well as values by permission; hidden information must not be presented as absent requirements. Guidance can appear on editor opening, consequential edits, publication preparation and confirmation, not only after rejection.

```text
Publish tour announcement
Team guidance · Event announcements, version 3
Include accessibility information and a ticket link.
This draft has no ticket link.
[Edit draft]                         [Publish]
```

Advice leaves Publish available subject to other rules. An adopted requirement blocks until satisfied or legitimately changed. “I understand” proves acknowledgment, not completion. Dismissal never silently changes policy. Jev can select relevant guidance; retained wording/templates render it without mandatory generation.

Local typing is not a Change per keystroke; debounce/coalesce coherent edits. Private draft persistence and publication can have different requirements. Optimistic presentation must not expose unapproved values to others or trigger effects. Preserve input on conflict/rejection; slow assessment or approval remains visibly pending.

Fetch guidance early, reuse assessments only while exact input and relevant versions/conditions remain valid, and refresh affected results rather than everything after unrelated memory changes. Final backend checks remain authoritative against stale or modified clients. Target no per-Save repository discovery, generation for exact edits or inference for exact facts. Ordinary-save and slow-tail latency remain unmeasured and must be reported separately.

## Operator console for development

The first viable self-development release includes a practical terminal interface, not merely a read-only log viewer or a later visual-polish milestone. It must let a person direct product outcomes and manage execution through the same authoritative backend used by workers. A terminal client neither owns lifecycle policy nor gains a privileged mutation route. Keep it separate from the worker harness and expose it through the standard launcher/shared backend, not only a harness-specific view. Terminal toolkit and transport remain implementation choices requiring review.

| Operator responsibility | Required visibility and controls |
| --- | --- |
| Product direction | Submit What/Why; inspect intended outcomes, scope, commitments and supporting grounds; clarify or revise intent; prioritize, defer or reject pursuit within current authority. |
| Project execution | Inspect eligible, active, waiting and blocked Work, dependencies, worker attempts, elapsed time and known resource use; set supported execution limits and request pause, continuation or cancellation. |
| Consequential decisions | Inspect the exact candidate difference, applicable Checks, stale or missing grounds and required approval; approve or reject the identified subject within policy, never waive failed requirements through approval. |
| Outcome review | Distinguish planned, attempted, published and observed results; inspect remaining obligations and recovery status instead of treating completed Work as proof of the desired outcome. |
| Operational control | See the controlling immutable release, supported capabilities, connection/freshness state, unavailable services and unresolved custody; understand the next permitted action and why other actions are blocked. |

The minimum surface provides proposal entry, an attention queue, Decision and Execution views, Change details, Work/attempt tracking, candidate/Check/Evidence inspection and controller health. The two public phases do not hide planning, waiting, approval, applying, verifying, cancellation or recovery states. Operators can inspect why a Change exists, what happened, what guidance currently applies and what remains unresolved; exact historical and current references must remain distinguishable. Product priorities and execution priorities are governed revisions or views of existing records, not a second independently editable backlog. A small initial worker configuration and simple presentation are sufficient; unsupported controls must be visibly unavailable rather than cosmetic buttons.

Observability is part of backend contracts from the start. Retain attributable state transitions, attempts, waiting reasons, assessment and effect references, operator decisions and available usage. Views derive from durable records with explicit freshness and coverage; reconnecting must recover current status without inventing missing progress or rerunning work. Reading or rendering a view does not launch workers, Checks or inference. Private logs and secrets are not automatically operator-visible Evidence.

Operator commands bind actor, exact subject/version and retry identity. Revisions invalidate affected assessments; reprioritization does not bypass dependencies or accepted commitments. Pause does not imply that an active process has stopped, cancellation is not confirmed termination, and retry requires outcome/custody reconciliation. Closing the terminal does not silently cancel host-owned Work. The interface must show pending requests, confirmed outcomes and uncertainty separately, preserve rejected input, and explain safe recovery without requiring the operator to inspect raw database rows.

## Cross-container development

A user goal can depend on authorized development elsewhere without merging State, permissions, memory or transactions. First compose existing capabilities and generic State: a missing predefined entity is not necessarily a capability gap. Native integrations, shared schemas, application behavior or release changes may require developer-owned work.

For “Book three weekend shows near Porto within €1,200”:

1. Pursue what existing authorized abilities support and identify the genuine missing capability, such as booking-request/confirmation tracking.
2. Share only authorized unmet-need material through a request visible in user and developer intake; use permissioned views, not divergent ticket copies.
3. Developers accept, defer or reject. Accepting consideration is not an automatic implementation commitment; promised results and limits are explicit.
4. Authorized development and separately authorized deployment establish actual capability availability, not merely a merged commit.
5. Verify the required version/result, then recheck current user intent, authority, State, requirements and commitments before resuming.
6. Review actual bookings, not feature delivery alone.

A dependency binds specific results/capabilities and satisfaction conditions, not whole containers globally. One developer Change may support several user requests without merging private scopes. Request submission authorizes asking, not implementation/deployment. Rejection, deferral, cancellation, supersession, revoked visibility and unavailable capabilities remain inspectable; permission does not create feasibility or outside cooperation.

## Hosting, distribution and evolution

One engine supports a library interface and standard launcher; applications bundle a pinned release without separate end-user platform accounts or manual setup. Docker is optional. Prefer a long-lived application-owned host initially; in-process use must supply equivalent durability, shutdown/restart and execution guarantees. Runtime outage blocks affected governed operations, not necessarily unrelated application functions.

The internal core remains pure and deterministic; the host performs storage, inference and effects through qualified bindings. Placement, ownership, authority and enforcement are separate. Installing a library, service, skill or operating-system package governs nothing until scoped resources and write routes are enforced. A local host cannot prevent remote-source bypass with a client filter alone.

Build the first useful self-development product in Rust: the authoritative kernel, application coordination, host and terminal client share one engine implementation. Retain TypeScript only for application bindings, controlled Pi integration and JavaScript/compiled-TypeScript Check execution where needed. JavaScript runtimes and workers remain explicit capabilities, not dependencies of pure kernel use. Git history preserves retired TypeScript behavior and useful safeguards; reproducing every prototype feature or interface is not a release requirement. Preserve historical records and meanings without automatically importing them into the new runtime.

Bandwagon and Omarchy test generality, not the product boundary. Linux-first qualification is acceptable without positioning ChangeKernel as Linux-only. Machine integration starts with bounded supported resources and independent recovery access, not whole-machine guarantees. Friendly Check authoring, team administration and a Packs marketplace remain deferred Hub work; ordinary collaborative containers do not require Hub.

One immutable release owns common interpretation and transitions. Definitions, source revisions, adopted evaluators and execution/model settings retain their own exact identities. Upgrades require explicit supported transition, not silent reinterpretation, migration or authority transfer. Detailed release and qualification obligations live in the [release contract](../system/components/package.md).

## Repository representation

Source structure must make ownership and dependency boundaries visible. Retain the pure-kernel/ports/adapters split and meaningful boundary checks. The retired TypeScript prototype mixed Git-specific host composition, terminal rendering and server coordination; Git preserves that implementation and its review evidence. Its removal does not establish the native operator path, and Git/Wiki-specific concepts must not define universal State.

The following depth-three target is approved design, not a claim that Rust implementation or relocation has occurred. Directory names alone establish no boundary: ownership mappings, import direction, package reachability and tests must agree. Tests follow source responsibilities; Rust unit tests may live beside their modules, with broader suites under `tests/`.

```text
Cargo.toml                     # One Rust library/executable package
Cargo.lock
rust-toolchain.toml
package.json                   # Supporting TypeScript bindings and workers
package-lock.json
tsconfig.json
tsconfig.build.json
src/
├── lib.rs                     # Curated Rust library interface
├── main.rs                    # Thin standard launcher
├── kernel/
│   ├── data_contracts/
│   ├── identity/
│   ├── containers/
│   ├── state/
│   ├── changes/
│   ├── work/
│   ├── checks/
│   ├── evidence/
│   └── memory/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── factory/
│   ├── assessment/
│   ├── publication/
│   └── recovery/
├── ports/
├── adapters/
│   ├── sqlite/
│   ├── git/
│   ├── linux/
│   ├── jev/
│   └── node/
├── api/
│   ├── contracts/
│   └── transport/
├── host/
│   ├── configuration/
│   └── composition/
├── clients/
│   └── terminal/
├── bindings/
│   └── typescript/
├── workers/
│   ├── pi/
│   └── checks/
└── packs/
    └── software-development/

tests/
├── contracts/
├── integration/
├── recovery/
├── qualification/
├── package/
└── fixtures/
docs/
└── archive/
.changekernel/
├── wiki/
└── changes/
```

The kernel imports only pure kernel contracts/rules. Application coordination uses kernel contracts and ports rather than concrete bindings or presentation. Adapters implement external capabilities; the host owns configuration, wiring and process lifetime. Clients use the shared public boundary rather than private storage or execution internals. Native Git/filesystem behavior stays in its binding. The first-party software Pack uses ordinary Check adoption/execution, not privileged universal policy. Public exports remain curated.

Keep one Rust package and one supporting JavaScript package in one source repository, released as one qualified product. Bind the Rust artifacts, JavaScript assets and required runtime/dependency versions in the release identity. Do not introduce a multi-package workspace, service fleet, empty future folders or blanket file shuffle. Build cohesive working paths with tests and ownership mappings, selecting applicable safeguards rather than requiring prototype feature parity. Current frontmatter still maps actual source paths until replacement; target folders do not grant import allowances or delete existing safeguards. Retire obsolete implementation deliberately while preserving historical protocol interpretation, not a permanent parallel engine or mandatory historical-data conversion.

Design remains in these canonical documents, governed lifecycle history in its existing records, and implementation in source/tests. Generated views, private execution storage, caches, worktrees and package artifacts are not source structure. The temporary status note describes unfinished implementation, not another roadmap.

## Current implementation and historical meanings

Current source implements bounded native SQLite intake and verified committed-source observations, plus narrow TypeScript Pi bridges and their required protocol/codec dependencies. The historical TypeScript engine, console, Git/Wiki orchestration and SQLite candidate implementation have been removed; their capabilities are not native exports. The native private-continuation contract is approved, with explicit schema initialization, revision-zero custody, verified intent reads and atomic SQLite intent appends with exact retry reconciliation. Concrete SQLite file-candidate custody remains unintegrated pending the shared retained-attribution repair; its generic ports and data types are not a completed write capability. Decision + Execution is approved desired lifecycle, not an implemented replacement for stored stage protocols. Full progression, generalized discovery, source publication, native Jev operations, durable factory/recovery, memory adoption, operator controls and cross-container dependencies remain unfinished. Examples above are not current exports.

`ProjectSnapshot`, `readSnapshot`, `snapshotDigest`, existing `codewiki.*` protocols, managed-document fields and historical Planning operations retain their original meanings until explicit versioned implementation. They are not generalized snapshots, acceptance certificates or new-stage results. Git history retains the old Git/Wiki implementation and tests; its document/type hierarchy is not part of this new universal model. Markdown knowledge may be ordinary source-backed State through a suitable binding, not a separate required Wiki subsystem.

Source design metadata is not managed adoption. Consolidated `ownership` mappings preserve source/test coverage and existing implementation role/event names; they neither activate those roles nor define extra Check stages. Retained `source-history` is historical provenance, including references to retired pages; it is not an active relationship graph or an acceptance receipt. Existing `.changekernel/changes/` records and archives are not rewritten. This mutable checkout must never govern itself; qualification, activation and explicit external-controller handoff are separate from documentation approval.

## Unresolved contracts and proof

Before implementation, specify:

- Generalized creation/opening, Decision/Execution, intent-revision, candidate custody, inspection, feedback and retry contracts beyond bounded native intake and committed-source reads; membership and shared-resource relationships.
- First database/execution bindings, transaction integration, history/retention, backup and declared recovery guarantees.
- Supported discovery languages/frameworks, validation of derived definitions, incremental invalidation and unresolved coverage.
- Typed mutations, native capabilities and any restricted generated programs; their execution isolation and limits.
- Concrete binding of existing system identity/permissions and owner-configured delegation; exact intent, memory, research-custody and procedure-input representations, retention/visibility and local versus shared evolution. A generalized additional AI-restriction layer remains deferred.
- Work refinement, worker selection, budgets, fairness, cancellation, reservations and uncertain-outcome reconciliation.
- Jev deployment, operation contracts, initial classification vocabulary and quality thresholds; terminal toolkit/transport, frontend freshness/privacy and cross-container dependency semantics.
- Evidence that the two-phase interface preserves admission, pre-effect and outcome obligations, exposes actionable states and reduces duplicated work before any persisted-contract transition.

Prove one complete enforced path with a goal not already encoded as a dedicated workflow, ambiguity/repair, recoverable failure, durable learning and another worker continuing from retained records. Then prove the same semantics with a substantially different source/backend and frontend plus replaceable agent clients. Measure end-to-end correctness, missed constraints, escalation, cost and ordinary/slow-path latency. [Qualification](../system/components/package.md#qualification) defines the challenge matrix; this section is not a parallel implementation roadmap.
