---
type: System Component
codewiki_id: cw:component:evidence
title: Evidence
description: Defines immutable observation metadata, authority levels, obligations, provenance, and bounded format importers.
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

Evidence, material, and judgment are separate. Raw Data or another native subsystem owns exact bytes and immutable protocol records. An Evidence Record owns compact provenance-bound observation metadata over those materials. A Check Result separately judges exact Evidence against one Candidate and configuration. Evidence therefore binds subject, observation schema and digest, material refs, producer, method, tool/configuration, custody Receipt, time, freshness, authority, coverage, sensitivity, and limitations without becoming a second copy of Wiki meaning or source payload. Authority remains `asserted`, `observed`, `verified`, or `approved`; sharing a record transfers neither applicability nor acceptance.

Backend v1 Evidence `1.4.0` may carry direct research citation and artifact references. Target `codewiki.evidence-record@2.0.0` replaces payload-bearing or ambient locators with sorted exact refs to Raw Data Revisions/Slices, project artifacts, Run or provider Receipts, Change operations, actor attestations, or migration Receipts. Its bounded observation body may contain interpreted facts, measurements, stance, and limitations, but no copied source payload or opaque execution bytes. Existing records remain immutable; SK5 may emit linked target records while preserving predecessor identity and declaring every unavailable legacy material gap.

Web pages, PDFs, provider responses, search results, and deterministic extractions enter Raw Data before target Evidence cites them. An extraction is a derived Revision bound to source Revision and extractor identity. Model synthesis alone is not source Evidence. Human approvals, execution observations, and native provider facts may cite their authenticated operations or Receipts without redundant Raw Data copies. Bounded importers for SARIF, JUnit XML, LCOV, Cobertura, CycloneDX, SPDX, Pact, OpenAPI, and provider receipts follow the same material/observation split.

Raw Data policy resolves capture as `metadata_only | cited_slices | full_revision` and payload retention as `transient | ttl | while_referenced | pinned`. Operator/legal constraints define allowed minimum custody and maximum storage before project/source defaults and an authorized intake Request select policy; absent a complete selection, intake stops before commit. The resolved digest enters the Intake Receipt. Requests may strengthen retention while exact bytes remain staged or retained. Missing bytes cannot be resurrected: refetch creates a new Revision and Evidence. Accepted provenance pins payload only under `while_referenced`, `pinned`, or another applicable constraint.

Evidence never mutates when material expires, is deleted, changes, or becomes inaccessible. Current availability/support derives from owner and source-observation Receipts. Every Revision-bound material ref is automatically trackable. New Revision may revalidate unchanged Slice through new Evidence; changed, missing, expired, revoked, or inaccessible material stales support, cannot satisfy `retained_exact`, and invalidates affected context/Result reuse. Project policy may open Change Intake, but ongoing connection mechanics remain external and never rewrite Evidence or Wiki. Work Continuity rollover cites exact Evidence/Result set digests, not summaries. DSH Session bytes remain opaque Runtime-owned execution Evidence, never Wiki provenance by retention and never a substitute for canonical authority or feedback records.
