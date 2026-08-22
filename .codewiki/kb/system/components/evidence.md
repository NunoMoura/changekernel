---
type: System Component
codewiki_id: cw:component:evidence
title: Evidence
description: Defines immutable observation metadata, authority levels, obligations, provenance, and bounded format adapters.
status: stable
tags: [system, component]
codewiki_component: cw:component:evidence
codewiki_source_patterns: ["src/evidence/**"]
codewiki_test_patterns: ["tests/evidence/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Evidence supplies the System responsibility required by this Story.
---
# Evidence

Evidence Records bind exact observations to Candidate, accepted Knowledge Effect and requirement IDs, stable subject identity, realized source and test artifacts, producer, execution custody, tool, configuration, Git tree, freshness, and authority. This lineage lets Review prove which exact desired-state obligation an observation supports without making Evidence a second copy of Knowledge. DSH-backed Run receipts may reference immutable raw DSH log bytes; delegated receipts may reference optional opaque child traces while declaring unavailable internals. Neither form becomes canonical meaning or complete custody merely by being retained. Authority remains `asserted`, `observed`, `verified`, or `approved`; sharing a record transfers neither applicability nor acceptance.

CodeWiki supports bounded adapters for SARIF, JUnit XML, LCOV, Cobertura, CycloneDX, SPDX, Pact, OpenAPI, and provider-check receipts. Compact immutable metadata enters the Change Trace while large or private bytes remain in their existing authority boundary.
