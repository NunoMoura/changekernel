---
{"aliases":[],"attributes":{"codewiki.legacy:media-type":"application/yaml","codewiki.legacy:metadata":{},"codewiki.legacy:source-path":"system/diagrams/lifecycle.yaml"},"itemId":"cw:diagram:lifecycle","itemType":"codewiki.legacy:knowledge","protocol":"codewiki.wiki-item@1.0.0","provenance":[{"attributes":{"codewiki.legacy:source-digest":"sha256:6b58e2834ba1e678ce882b6e16963a487c385de43e0c1a948a309df07ec2a63f","codewiki.legacy:source-path":"system/diagrams/lifecycle.yaml"},"kind":"codewiki.legacy:knowledge","subjectId":"cw:diagram:lifecycle"}],"relationships":[],"title":"cw:diagram:lifecycle"}
---
codewiki_id: cw:diagram:lifecycle
id: lifecycle
purpose: Show one Git proposal commit reaching Decision and one two-parent disposition commit before conditional work and Delivery.
components:
  - { id: clients, concept: cw:component:clients, label: Clients, zone: client }
  - { id: project-server, concept: cw:component:project-server, label: Project Server, zone: core }
  - { id: protocol, concept: cw:component:protocol, label: Kernel API + Transport, zone: core }
  - { id: runtime, concept: cw:component:runtime, label: Runtime, zone: execution }
  - { id: intake, concept: cw:component:change-intake, label: Change Intake, zone: core }
  - { id: decision, concept: cw:component:decision, label: Decision, zone: core }
  - { id: planning, concept: cw:component:planning, label: Planning, zone: core }
  - { id: implementation, concept: cw:component:implementation, label: Implementation, zone: core }
  - { id: review, concept: cw:component:review, label: Review, zone: core }
  - { id: checks, concept: cw:component:checks, label: Checks, zone: core }
  - { id: knowledge, concept: cw:component:knowledge, label: Git-versioned Wiki Items, zone: repository }
  - { id: change-trace, concept: cw:component:change-trace, label: Change Trace, zone: repository }
connections:
  - id: clients-request-project-server
    from: clients
    to: project-server
    type: invokes
    label: submits bounded request with configured identity proof
    boundary: { type: trust, failure: Reject invalid proof, unauthorized Actor, malformed, expired, or oversized input. }
  - { id: project-server-uses-protocol, from: project-server, to: protocol, type: invokes, label: validates one versioned contract }
  - { id: protocol-returns-project-server, from: protocol, to: project-server, type: returns, label: returns normalized Actor and Client request context }
  - { id: project-server-invokes-intake, from: project-server, to: intake, type: invokes, label: normalizes proposed intent }
  - { id: intake-returns-project-server, from: intake, to: project-server, type: returns, label: returns proposal payload and optional Wiki Item bytes }
  - id: project-server-appends-proposal-trace
    from: project-server
    to: change-trace
    type: writes
    label: creates proposal commit and advances managed Change ref by CAS
    boundary: { type: persistence, failure: Reject malformed, stale, non-prefix, or non-Wiki proposal deltas. }
  - id: change-trace-returns-proposal-version
    from: change-trace
    to: project-server
    type: returns
    label: returns exact proposal commit OID and derived Item diff
    boundary: { type: persistence, failure: Stop Decision when proposal commit, Trace prefix, managed ref, or Git objects cannot be verified. }
  - { id: project-server-invokes-decision, from: project-server, to: decision, type: invokes, label: starts selected exact proposal version }
  - id: decision-invokes-runtime
    from: decision
    to: runtime
    type: invokes
    label: requests one bounded Decision producer Run
    boundary: { type: authority, failure: Stop Decision attempt when exact execution is unavailable. }
  - id: runtime-returns-decision
    from: runtime
    to: decision
    type: returns
    label: returns producer output and Run Receipt
    boundary: { type: authority, failure: Reject incomplete or mismatched receipt. }
  - { id: decision-returns-project-server, from: decision, to: project-server, type: returns, label: returns Candidate with proposal commit and derived Wiki Item diff }
  - { id: project-server-runs-decision-gate, from: project-server, to: checks, type: invokes, label: runs policy over exact proposed Git/Wiki tree }
  - { id: checks-return-decision-gate, from: checks, to: project-server, type: returns, label: returns exact Decision Gate Report }
  - id: project-server-offers-decision-confirmation
    from: project-server
    to: clients
    type: returns
    label: presents exact passed Candidate, Gate digest, and consequence
    boundary: { type: trust, failure: Hide confirmation when its exact binding is stale or unavailable. }
  - id: clients-return-decision-confirmation
    from: clients
    to: project-server
    type: returns
    label: returns authenticated exact-Candidate confirmation
    boundary: { type: trust, failure: Reject changed, stale, unauthorized, or mismatched confirmation. }
  - id: project-server-writes-knowledge
    from: project-server
    to: knowledge
    type: writes
    label: creates two-parent disposition commit under canonical-ref CAS
    boundary: { type: persistence, failure: Preserve prior canonical commit on validation, object, commit, or ref-CAS failure. }
  - id: knowledge-returns-project-server
    from: knowledge
    to: project-server
    type: returns
    label: returns disposition commit and derived canonical Wiki tree
    boundary: { type: persistence, failure: Stop progression when canonical Git/Wiki state cannot be confirmed. }
  - id: project-server-appends-acceptance-trace
    from: project-server
    to: change-trace
    type: writes
    label: appends terminal disposition and requirements in same Git commit
    boundary: { type: persistence, failure: Never advance canonical ref with missing or mismatched accepted Trace. }
  - { id: project-server-invokes-planning, from: project-server, to: planning, type: invokes, label: starts Planning when Completion Requirements exist }
  - id: planning-invokes-runtime
    from: planning
    to: runtime
    type: invokes
    label: requests one bounded Planning producer Run
    boundary: { type: authority, failure: Stop Planning attempt when exact execution is unavailable. }
  - id: runtime-returns-planning
    from: runtime
    to: planning
    type: returns
    label: returns producer output and Run Receipt
    boundary: { type: authority, failure: Reject incomplete or mismatched receipt. }
  - { id: planning-returns-project-server, from: planning, to: project-server, type: returns, label: returns Work Graph delta for fixed Kernel Validation and CAS }
  - { id: project-server-invokes-implementation, from: project-server, to: implementation, type: invokes, label: starts one eligible Kernel-validated Work Unit }
  - id: implementation-invokes-runtime
    from: implementation
    to: runtime
    type: invokes
    label: requests one bounded Run per assigned Implementation Worker
    boundary: { type: authority, failure: Stop affected Assignment without changing canonical state. }
  - id: runtime-returns-implementation
    from: runtime
    to: implementation
    type: returns
    label: returns worker output and Run Receipt
    boundary: { type: authority, failure: Reject output lacking exact Assignment and Workbench custody. }
  - { id: implementation-returns-project-server, from: implementation, to: project-server, type: returns, label: returns one exact Work Unit Candidate }
  - { id: project-server-runs-implementation-gate, from: project-server, to: checks, type: invokes, label: runs same stage-wide Implementation policy with Work Unit-specific inputs }
  - { id: checks-return-implementation-gate, from: checks, to: project-server, type: returns, label: returns exact Work Unit Gate Report for private-lineage admission }
  - { id: project-server-invokes-review, from: project-server, to: review, type: invokes, label: starts aggregate Review after all required Work Units pass and integrate }
  - id: review-invokes-runtime
    from: review
    to: runtime
    type: invokes
    label: requests one bounded Review producer Run
    boundary: { type: authority, failure: Stop Review attempt when exact execution is unavailable. }
  - id: runtime-returns-review
    from: runtime
    to: review
    type: returns
    label: returns Review output and Run Receipt
    boundary: { type: authority, failure: Reject incomplete or mismatched receipt. }
  - { id: review-returns-project-server, from: review, to: project-server, type: returns, label: returns exact-head Review Candidate }
  - { id: project-server-runs-review-gate, from: project-server, to: checks, type: invokes, label: runs Review Check Packs }
  - { id: checks-return-review-gate, from: checks, to: project-server, type: returns, label: returns exact Review Gate Report }
  - id: project-server-writes-change-trace
    from: project-server
    to: change-trace
    type: writes
    label: appends completion, Plugin Receipt, Gate, and effect history
    boundary: { type: persistence, failure: Reject append and retain prior accepted head. }
flows:
  - concept: cw:flow:change-lifecycle
    paths:
      - connections: [clients-request-project-server, project-server-uses-protocol, protocol-returns-project-server, project-server-invokes-intake, intake-returns-project-server, project-server-appends-proposal-trace, change-trace-returns-proposal-version, project-server-invokes-decision, decision-invokes-runtime, runtime-returns-decision, decision-returns-project-server, project-server-runs-decision-gate, checks-return-decision-gate, project-server-offers-decision-confirmation, clients-return-decision-confirmation, project-server-writes-knowledge, knowledge-returns-project-server]
      - connections: [clients-return-decision-confirmation, project-server-appends-acceptance-trace]
      - connections: [implementation-returns-project-server, project-server-runs-implementation-gate, checks-return-implementation-gate, project-server-invokes-review, review-invokes-runtime, runtime-returns-review, review-returns-project-server, project-server-runs-review-gate, checks-return-review-gate, project-server-writes-change-trace]
  - concept: cw:flow:decision-to-planning
    paths:
      - connections: [project-server-appends-proposal-trace, change-trace-returns-proposal-version, project-server-invokes-decision, decision-invokes-runtime, runtime-returns-decision, decision-returns-project-server, project-server-runs-decision-gate, checks-return-decision-gate, project-server-offers-decision-confirmation, clients-return-decision-confirmation, project-server-writes-knowledge, knowledge-returns-project-server, project-server-invokes-planning]
  - concept: cw:flow:planning-to-implementation
    paths:
      - connections: [project-server-invokes-planning, planning-invokes-runtime, runtime-returns-planning, planning-returns-project-server, project-server-invokes-implementation]
  - concept: cw:flow:implementation-to-review
    paths:
      - connections: [project-server-invokes-implementation, implementation-invokes-runtime, runtime-returns-implementation, implementation-returns-project-server, project-server-runs-implementation-gate, checks-return-implementation-gate, project-server-invokes-review, review-invokes-runtime, runtime-returns-review, review-returns-project-server, project-server-runs-review-gate, checks-return-review-gate]
      - connections: [checks-return-review-gate, project-server-invokes-implementation]
