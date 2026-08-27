---
type: System Component
codewiki_id: cw:component:change-intake
title: Change Intake
description: Accepts bounded untrusted natural-language intent, Discovery Findings, provider issues, and external Git Candidate material for accountable triage.
status: stable
tags: [system, component]
codewiki_component: cw:component:change-intake
codewiki_source_patterns: ["src/changes/intake/**", "src/changes/triage/**", "src/changes/defect-profile.ts"]
codewiki_test_patterns: ["tests/changes/change-intake*.test.mjs", "tests/changes/backlog-triage.test.mjs"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.maintain-intent
    rationale: Change Intake turns untrusted proposals and discovered work into accountable intent.
  - type: realizes
    target: cw:story:maintainer.account-for-drift
    rationale: Change Intake gives external and out-of-scope discoveries a visible accountable path.
---
# Change Intake

Change Intake accepts bounded authenticated material from natural-language user requests, people, channels, provider issues, Discovery Findings, Implementation Workers, regressions, security findings, delivery observations, Knowledge drift, Outcome Diagnostics, and External Candidate Captures. Submitted content is untrusted and cannot supply canonical identity, authority, time, priority, destination, scope acceptance, Knowledge mutation, or Check outcome.

A harness may submit a bounded `change.proposed` payload plus optional proposed Wiki Item bytes containing intent, rationale, alternatives, outcomes, authority intent, and explicit Completion Requirements. Project Server resolves handles, verifies expected canonical commit, constructs one proposal commit whose delta is limited to that Change trace plus optional Wiki Item paths, and advances its deterministic managed Change ref by expected-old-OID CAS. That commit OID is the proposal version; parent/tree identity derives the Item diff. A model, Client, provider, or intake record never writes Wiki, Trace, or refs directly.

Project Server authenticates, sanitizes, normalizes, deduplicates, and sends material to its bounded destination. An external code capture already matching one accepted Change may enter Candidate admission directly; missing intent or out-of-scope material enters intake, triage, proposed Change, and explicit Decision before implementation. Existing source or Git state may reveal desired-state drift but cannot silently redefine Knowledge. Intake never selects Decision attention or silently expands current scope.

Outcome Diagnostics run only after a Gate or across bounded retained outcome history. They may identify repeated failure patterns or propose exact diffs to Skills, Checks, stage-context queries, model routes, budgets, or project configuration. They never repair the current Candidate, reinterpret a Result, mutate project files, or gain privileged self-evolution authority. Every suggestion remains ordinary Change Intake Material and must traverse Decision, Planning, Implementation, Review, and normal expected-head authorization before taking effect.

In Semantic Kernel target, source observations first enter private Raw Data as immutable authorized Revisions plus policy-selected bytes/Slices; intake may cite exact handles when proposing Wiki meaning. Ongoing connection mechanics remain external, while Project policy and Checks judge admitted freshness and coverage. New, changed, missing, revoked, or stale support may create bounded intake citing old/new Revision and affected targets. Sources, external connections, Alignment, and Plugins never write Wiki or canonical Git ref; only confirmed Change proposal enters one Project Server two-parent disposition commit. Transient diagnostics remain private operational state. A finding that requires accountable action enters Change Intake with Evidence; a durable statement worth accepting enters Wiki only through Decision. There is no privileged Error Book or maintenance side channel.
