---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"itemId":"cw:diagram:architecture","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:dcdf7b7ed4fddb54270e4d0e254de3c0224f21e0f67db39e0565daf428f8e82c","codewiki.legacy:source-path":"system/diagrams/architecture.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:architecture"}],"relationships":[],"title":"cw:diagram:architecture"}
---
codewiki_id: cw:diagram:architecture
id: architecture
purpose: Show Backend v1 owners plus target mandatory Git, Kernel API, Plugin, Runtime, Wiki Item, and AI Gateway boundaries; detailed behavior belongs to lifecycle and Runtime diagrams.
components:
  - { id: clients, concept: cw:component:clients, label: CodeWiki App / Console / Clients, zone: client }
  - { id: project-server, concept: cw:component:project-server, label: Project Server, zone: core }
  - { id: protocol, concept: cw:component:protocol, label: Kernel API + Transport Bindings, zone: core }
  - { id: intake, concept: cw:component:change-intake, label: Change Intake, zone: core }
  - { id: runtime, concept: cw:component:runtime, label: Runtime, zone: execution }
  - { id: domains, concept: cw:component:domains, label: Domains (Backend v1 only), zone: core }
  - { id: plugins, concept: cw:component:package, label: CodeWiki Plugins, zone: execution }
  - { id: decision, concept: cw:component:decision, label: Decision, zone: core }
  - { id: planning, concept: cw:component:planning, label: Planning, zone: core }
  - { id: implementation, concept: cw:component:implementation, label: Implementation, zone: core }
  - { id: review, concept: cw:component:review, label: Review, zone: core }
  - { id: checks, concept: cw:component:checks, label: Checks, zone: core }
  - { id: evidence, concept: cw:component:evidence, label: Evidence, zone: core }
  - { id: work-state, concept: cw:component:work-state, label: WorkState, zone: core }
  - { id: alignment, concept: cw:component:alignment, label: Alignment, zone: core }
  - { id: preview, concept: cw:component:preview, label: Preview, zone: execution }
  - { id: knowledge, concept: cw:component:knowledge, label: Knowledge / Git-versioned Wiki Items, zone: repository }
  - { id: change-trace, concept: cw:component:change-trace, label: Change Trace, zone: repository }
  - { id: project, concept: cw:component:project, label: Git Project Store / Configuration, zone: repository }
  - { id: package, concept: cw:component:package, label: CodeWiki Package, zone: repository }
  - { id: benchmarks, concept: cw:component:benchmarks, label: Benchmarks, zone: repository }
  - { id: provider, concept: cw:component:provider-boundary, label: AI Gateway / AI Provider, zone: provider }
connections:
  - { id: project-server-uses-protocol, from: project-server, to: protocol, type: invokes, label: validates configured identity proof and authorizes transport-neutral requests }
  - id: project-server-invokes-runtime
    from: project-server
    to: runtime
    type: invokes
    label: submits one immutable Run Request
    boundary: { type: authority, failure: Reject unauthorized, stale, malformed, or unsupported Run Request. }
  - { id: project-server-invokes-intake, from: project-server, to: intake, type: invokes, label: normalizes untrusted intent, observed source changes, external captures, and diagnostics }
  - id: project-server-invokes-codewiki-plugin
    from: project-server
    to: plugins
    type: invokes
    label: submits one capability-scoped Plugin Request
    boundary: { type: authority, failure: Reject unadmitted manifest, excess capability, stale head, or unauthorized effect. }
  - id: codewiki-plugin-returns-project-server
    from: plugins
    to: project-server
    type: returns
    label: returns observations, artifacts, effects, and immutable Plugin Receipt
    boundary: { type: trust, failure: Reject mismatched Receipt; Plugin cannot assert Result, AuthZ, canonical Git write, or completion. }
  - { id: project-server-reads-domain-plugin, from: project-server, to: domains, type: reads, label: validates exact installed domain contract and compiler identity }
  - id: domain-plugin-produces-knowledge
    from: domains
    to: knowledge
    type: produces
    label: defines bounded vocabulary, relationships, and deterministic projection rules
    boundary: { type: trust, failure: Stop compilation when Plugin identity, integrity, contract, or deterministic output is unavailable or mismatched. }
  - { id: project-server-invokes-decision, from: project-server, to: decision, type: invokes, label: starts exact Decision attempt }
  - { id: project-server-invokes-planning, from: project-server, to: planning, type: invokes, label: starts exact Planning attempt }
  - { id: project-server-invokes-implementation, from: project-server, to: implementation, type: invokes, label: starts exact Implementation attempt }
  - { id: project-server-invokes-review, from: project-server, to: review, type: invokes, label: starts exact-head Review attempt }
  - { id: project-server-invokes-checks, from: project-server, to: checks, type: invokes, label: Backend v1 loads Pack Skills; target runs exact Decision, Implementation, or Review Gate }
  - { id: checks-consume-evidence, from: checks, to: evidence, type: consumes, label: binds exact admitted Evidence inputs }
  - { id: checks-read-alignment, from: checks, to: alignment, type: reads, label: obtains bounded Check SDK facts }
  - { id: project-server-reads-work-state, from: project-server, to: work-state, type: reads, label: freezes stage context and evaluates guards and scheduling }
  - { id: alignment-returns-project-server, from: alignment, to: project-server, type: returns, label: returns bounded context, provenance, and impact }
  - { id: runtime-invokes-preview, from: runtime, to: preview, type: invokes, label: captures bounded Run observations }
  - id: runtime-invokes-provider
    from: runtime
    to: provider
    type: invokes
    label: uses one authenticated exact-Run AI Gateway capability
    boundary: { type: trust, failure: Stop on unavailable transport, route mismatch, unauthenticated receipt, quota, or malformed provider evidence. }
  - id: provider-returns-runtime
    from: provider
    to: runtime
    type: returns
    label: returns normalized stream and authenticated receipt
    boundary: { type: trust, failure: Reject mismatched target, digest, usage, outcome, or receipt authentication. }
  - { id: knowledge-reads-project, from: knowledge, to: project, type: reads, label: validates Backend Domain or target repository/object-format/canonical-ref config }
  - id: knowledge-returns-project-server
    from: knowledge
    to: project-server
    type: returns
    label: returns exact Knowledge identity or target repository/commit-derived Wiki tree
    boundary: { type: persistence, failure: Stop when current Knowledge or target Git object/ref identity is unavailable or mismatched. }
  - { id: change-trace-reads-project, from: change-trace, to: project, type: reads, label: binds repository identity }
  - { id: package-reads-project, from: package, to: project, type: reads, label: composes CodeWiki and passive Check Pack resources }
  - { id: benchmarks-read-package, from: benchmarks, to: package, type: reads, label: executes packed candidate }
flows:
  - concept: cw:flow:change-lifecycle
    paths:
      - connections: [domain-plugin-produces-knowledge, knowledge-returns-project-server]
      - connections: [project-server-invokes-codewiki-plugin, codewiki-plugin-returns-project-server]
  - concept: cw:flow:work-unit-execution
    paths:
      - connections: [project-server-invokes-runtime, runtime-invokes-provider, provider-returns-runtime, runtime-invokes-preview]
