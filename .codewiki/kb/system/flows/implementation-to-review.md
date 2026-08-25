---
type: System Flow
codewiki_id: cw:flow:implementation-to-review
title: Implementation to Review
description: Completes independently gated Work Units, freezes one aggregate Change lineage, and repeats exact-head Review until guarded delivery or stop.
status: stable
tags: [system, flow]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Implementation to Review provides accountable unit completion and aggregate delivery proof.
  - type: realizes
    target: cw:story:maintainer.enforce-project-standards
    rationale: Implementation and Review apply stage-wide project policy at unit and aggregate scopes.
---
# Implementation to Review

Implementation Gates run as Work Unit Candidates become ready; they do not wait for every Worker. Each uses the same resolved stage-wide Implementation Check Pack policy with Work Unit-specific immutable inputs. Project Server integrates only passing, fresh, compatible Candidates into the Change-owned private lineage. A passing Gate advances that Work Unit, not the whole Change. Harness Agent observes only a coalesced current progress projection by default; exact canonical reports remain bounded reads and Harness availability never gates execution.

Project Server freezes an aggregate Review subject only when all required Work Units have current passing Gates, all required outputs integrate, dependency closure and acceptance coverage hold, and no required Candidate is stale. When configured, it creates or updates one integrated pull request for that exact Change lineage and correlates provider Checks, authenticated reviews, and admitted Evidence to its head.

Review Attempt `5.0.0` runs the resolved `.codewiki/check-packs/review/**` policy over the exact aggregate tree, ratified Change and Knowledge transition, Knowledge State and projection, Planning delta, contributing Work Units, Candidates, Implementation Gate Reports, Evidence and Results, private lineage, target base, Project Context Snapshot, and producer Run receipt. The adopted editable `software-development-default` Pack supplies aggregate acceptance, cross-unit behavior, full-build, integration, provenance, and scope Checks. It verifies complete Change acceptance and cross-unit integration rather than repeating only local unit policy. Automated Code and independently isolated Model Checks may supply the complete basis; human Review Evidence remains optional unless a Check requires it.

Project Server classifies every failed Result through typed ownership. Unit defects return only to exact affected Work Unit Implementation, decomposition defects require explicit Planning amendment, and meaning defects require Decision; no Check or model chooses lifecycle authority. Harness Agent receives the compact Review outcome for user interaction and exact relevant Results only when the classified route returns work to its Decision or Planning producer role. It does not mediate unit feedback or Review judgment. A failed route or new aggregate head invalidates delivery authority and prior Review Results. A stopped Gate preserves state. A passed Gate permits `delivery.applied` only with exact current Review, Delivery Authority `1.0.0`, protected target ref, and target-head compare-and-swap.
