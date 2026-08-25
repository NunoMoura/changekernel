# Repository diagnostics policy

This directory records the reviewed Backend v1 diagnostics baseline. It is not a waiver file. The executable ratchet in `scripts/check-diagnostics-ratchet.mjs` re-runs pinned versions of Pi-Lens, ast-grep, Knip, Madge, and jscpd and fails closed when it sees an unclassified rule, category, finding identity, source cycle, or clone. Counts and duplication metrics may decrease but may not increase.

Run the gate with:

```sh
npm run diagnostics:ratchet
```

The command builds emitted JavaScript first, then verifies:

- every ast-grep finding is a subset of the reviewed per-rule finding multiset;
- every deterministic Pi-Lens tree-sitter, fact-rule, and embedded ast-grep finding is a subset of its independently reviewed per-rule multiset;
- all ten correctness rules that reached zero remain at zero;
- every Knip category and finding remains within its reviewed set;
- the four accepted TypeScript source cycles remain the only Madge cycles;
- emitted JavaScript has no import cycle;
- production-oriented jscpd clone identities, count, duplicated lines, and percentage do not increase; and
- analyzer versions remain exactly pinned.

`baseline.json` gives every retained rule, category, cycle, and clone population a category, disposition, owner, and rationale. Finding identities use file paths plus content digests rather than line numbers, so unrelated line movement does not rewrite the baseline. A new finding cannot replace an old one merely because the aggregate count stayed constant.

## B10 inventory

The clean B10 census began with 59 blocking findings across 31 files: 35 unsafe double casts, 15 unknown returns, and nine bare `object` parameters. Those findings were closed through boundary parsing, named domains, structural validation, and narrowly justified `SAFETY:` invariants. The ten correctness policies retained at zero also cover duplicate object keys, unchecked production parsing, non-null assertions, comparator-free sorting, non-exhaustive switches, delete-based compatibility shaping, and JSON stringify/parse cloning.

The final ast-grep baseline contains 2,943 non-blocking findings across 22 rules. Most are syntax-only false positives in explicit boundary validators: accepting `unknown`, checking runtime types, reading unknown-valued records field by field, and conditionally omitting absent canonical fields are required safety patterns in this codebase. Correct parenthesized await-member expressions and package-relative imports are also project-incompatible advisories. Remaining style findings are non-actionable readability opinions with an explicit Backend maintainer disposition; they do not authorize suppressing LSP, security, authority, or correctness diagnostics.

The independent Pi-Lens lane scans every tracked or non-ignored repository file through Pi-Lens's deterministic in-process scanner. It retains 2,969 findings across 28 rules. Overlap with the raw ast-grep lane is deliberate: raw ast-grep proves project-owned rule corrections and zero-count policies, while Pi-Lens proves that interactive scanner output remains independently governed. B10 removed two unnecessary async wrappers. Reviewed structural residuals include exact complexity and coupling locations, required semantic wrappers, Promise-interface normalization, two already-awaited calls misidentified as detached, non-React methods misidentified as React state, and two deliberate error-propagation boundaries. Every retained identity has an owner and rationale; new identities or count increases fail closed.

Knip retains 478 classified findings: one indirectly loaded Runtime provenance dependency, four pinned diagnostics tools, two external Pi smoke-test binaries, 170 module exports, 297 protocol types, and four compatibility aliases. B10 deleted the three genuinely unused source files and removed the unused `undici-types` dependency. The ratchet rejects a new dependency, binary, export, type, alias, or file identity even if another accepted finding disappears.

Madge reports four source cycles. Every reverse edge is an erased TypeScript type import, and Madge reports zero cycles over emitted JavaScript. Refactoring those contract locations solely to satisfy a source graph that conflates type and runtime edges would add churn without reducing runtime coupling.

The production-oriented jscpd profile scans `src`, `scripts`, and `benchmarks` with a ten-line and eighty-token minimum. It retains 80 clone pairs, 1,736 duplicated lines, and 1.53% duplication. Review found independent protected-effect protocols, language adapters, and validators whose separation preserves authority or failure isolation. Any new clone identity or metric increase fails the ratchet.

## Scanner authority

Pi-Lens remains an independent diagnostic authority for this repository. The existing `.pi-lens.json` disables only automatic formatting; it contains no diagnostic rule filters. Retained findings therefore remain visible during interactive analysis, and classification in this baseline records review state without suppressing the scanner. The ratchet invokes Pi-Lens's pinned project scanner with an explicit Git-derived file list; the exact `@earendil-works/pi-tui` peer required by that standalone scanner is pinned as a development-only diagnostics dependency.

Project ast-grep overrides under `rules/ast-grep-rules/rules/` correct three demonstrated context errors while preserving each production rule:

- controlled tests may parse fixture output without local recovery because a thrown exception correctly fails the test;
- test URLs are fixtures, while production URL literals remain checked unless they are deliberate named constants; and
- test and script console output is an explicit smoke-test or CLI contract, while production logging remains checked.

Finding identities render SHA-256 bytes as space-separated eight-character groups, preserving all 256 bits without resembling bearer credentials to secret scanners. No Gitleaks allowlist, source-wide inline suppression, or Pi-Lens diagnostic filter is present. LSP, Opengrep, secret scanning, vulnerability scanning, zero-count correctness policies, and production release gates remain active. Security findings remain actionable until semantically resolved and independently rescanned.

## Updating the baseline

A baseline update is a reviewed policy change, not an automatic test rewrite. Run:

```sh
npm run build
node scripts/check-diagnostics-ratchet.mjs --write-observed /tmp/codewiki-diagnostics-observed.json
```

Classify every new identity, fix actionable findings first, and update `baseline.json` only when the residual has an explicit owner and durable rationale. Pack or Candidate bytes cannot select this repository policy; protected-head project policy governs later Candidates.
