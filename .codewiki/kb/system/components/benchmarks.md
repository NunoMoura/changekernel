---
type: System Component
codewiki_id: cw:component:benchmarks
title: Benchmarks
description: Measures externally-oracled product outcomes with and without CodeWiki under controlled execution conditions.
status: stable
tags: [system, component]
codewiki_component: cw:component:benchmarks
codewiki_source_patterns: ["benchmarks/**"]
codewiki_test_patterns: ["tests/benchmarks/**"]
codewiki_relationships:
  - type: realizes
    target: cw:story:maintainer.automate-safe-work
    rationale: Benchmarks independently measure whether CodeWiki improves safe accountable delivery.
---
# Benchmarks

Repository-root Benchmarks compare the same supported Agent, model route, task, repository snapshot, tools, network, budget, timeout, concurrency, retries, environment, and trial count in paired `alone` and `codewiki` modes. Their TypeScript is checked with product source but excluded from the production build and package; no `src/benchmarks/**` production root exists.

External fixtures and oracles determine truth. Benchmarks measure task success, intent coverage, false Gate passes and failures, stopped attempts, Evidence completeness, feedback-guided revision success, interventions, recovery, time, and cost. Knowledge encoding benchmark `1.0.0` additionally compares full-document rewriting, unified diff, byte splice, structural section replacement, and semantic Effect encoding over representative terminology, architecture, and explicit no-Knowledge-effect Changes. It reports exact encoded, repeated, and new bytes plus payload identity and execution duration without granting policy authority. Project Context access benchmark `1.0.0` compares full read-only repository mounting with a derived metadata index plus explicitly selected bounded files; exact selected results match while unrelated mounted bytes, materialized-file count, and query duration remain measured. Current evidence selects the derived-index strategy.

Code Mode benchmark `1.0.0` compares native direct calls, native batch calls, and secure Code Mode over the same snapshot-bound workload. It records source, cached-input, model-output, and tool-result tokens; repeated- and new-byte ratios; Candidate-to-edit amplification; turns; request, result, and ledger bytes; latency; compaction; quality; and a deterministic trace digest. Selection is workload-specific rather than global: native direct remains the baseline for one small query, native batch for a fixed independent query set, and secure Code Mode is eligible only when bounded local composition reduces model/tool traffic without crossing the configured quality floor. Worker-thread execution is benchmark evidence only and never a production security fallback.

Operational discovery uses Discovery Findings or explicit Improvement Assessments instead. Benchmarks cannot generate canonical Candidates, mutate product source, select Changes, schedule Stage Loops, promote releases, or duplicate project Check Packs and Gate policy.
