# ChangeKernel source-development status

This temporary note records unfinished pre-handoff source work. Desired behavior belongs in the [native Wiki](.changekernel/wiki/); Changes and Work take over execution state only after a qualified immutable external controller is explicitly handed control. Git holds checkpoint history.

## Current checkpoint

- Branch: `audit/clean-baseline`; this terminology alignment follows `d5f2e2aae`. Pi **0.85.1** remains pinned. The [backend/domain boundary](.changekernel/wiki/items/system/components/changekernel.md#backend-validation-across-four-stages) is unchanged.
- [Current Project state + Proposed Change → Change diff](.changekernel/wiki/items/system/components/project.md#current-project-state-proposed-change-and-change-diff) now governs current documentation, diagrams, assessment-facing names and diagnostics. State references identify committed bytes, not acceptance. Check adoption, Check policy and execution authorization remain distinct. Historical records, metadata, stored field names and protocols are preserved; intentional compatibility names are documented rather than silently reinterpreted.
- Private backend Decision validation has ten release-owned conditions, separate backend/domain identities, bounded execution and retained outcomes. Updated evaluator wording changes definition identities; earlier results remain decodable but cannot satisfy changed definitions. Domain Check adoption/input/result identity compatibility is tested against pre-change values for both Git object formats.
- Private Wiki source assembly preserves full bodies and exclusions, copies request/configuration before asynchronous work, and rechecks current access and observed heads. It does not authenticate governing Check policy, prove semantic coverage or enable public assessment. Retained Check lookup never launches missing work. Passing assessment is neither approval nor accepted Evidence.

## Paused for brainstorming and remaining gaps

The requested terminology alignment is complete. Feature implementation remains paused for the user's discussion of newly released technology. No technology evaluation, live/paid inference, release activation or controller handoff was authorized or performed by this work.

The previously planned next slice remains subject to that discussion: authenticate accepted Wiki Check policy declarations, derive activation from stage, Change type, scope and backend-derived Change diff/effect classifications, then join exact retained Check results. Existing Check adoption record decoding verifies supplied consistency, not acceptance. A file inventory does not establish complete grounds or commitments.

Public lifecycle integration, the software-domain Pack, remaining backend stage contracts, semantic judgment quality, producer containment/recovery and exact external qualification remain unfinished. Check execution retention precedes separately authorized Change-trace references; that publication, transport and archival integration is not complete. Custody remains limited to 256 attempts, with no automatic archival, reset or retry. Physical crash durability, privileged rollback protection and operator-authorized reconciliation remain unqualified. Model deployment, routing and credentials require separate qualification.

## Verification

- **628/628 repository tests passed**, including type checks and build: `/tmp/changekernel-state-terminology-full.log`. Compatibility regressions preserve stored Check identities and reject reuse of a result bound to the earlier backend evaluator.
- **198/198 installed-package tests passed** in an external disposable project with isolated Pi settings, dummy credentials and loopback fixtures. All **136** distribution files match tested build bytes; eight Pi dependency instances remain **0.85.1**. Package, lock and development receipt: `/tmp/changekernel-state-terminology-proof-jp2ICz/`.
- Documentation verification checked 129 local links across 35 Markdown files, preserved metadata in 33 Wiki files and verified unchanged topology and valid references in three diagrams. All 35 Markdown files passed scoped language-server checks. Source probes reported no errors, with 17 of 21 checks unable to confirm clean; compilation and executable tests passed. These are development checks, not release, semantic-quality or controller qualification.
- Historical Change records, Wiki provenance and unrelated files remain untouched. Generated artifacts and runtime state remain outside source Git.
