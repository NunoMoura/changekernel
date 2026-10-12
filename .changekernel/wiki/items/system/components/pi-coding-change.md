---
title: Pi Coding Change Consumer Proposal
aliases: []
source-id: cw:design:pi-coding-change
---
# Pi Coding Change Consumer Proposal

## Proposal boundary

**Draft for product-scope and independent design review, not an adopted successor profile or execution assignment.** The user selected Pi coding Change as the consumer for this proposal. The proposed first outcome is a reviewed, exact local code candidate that a fresh authorized reader can understand without the producing conversation. Repository publication is a separate later capability, not silently included or reported as accomplished.

This proposal consumes the [Change-format requirements](change-format.md), [worked streams](change-streams.md), [State contract](state.md), [Checks](checks.md) and [Pi-first plan](../../product/plan.md#format-first-design-and-pi-first-delivery). It narrows the next specification questions; it does not replace existing profiles, choose a wire schema or bypass their capability dependencies. Documentation work authorizes no source implementation, candidate execution, inference, installation, migration or controller handoff. Current execution scope remains in the [temporary status note](../../../../../CHANGEKERNEL_STATUS.md).

## First useful outcome and exclusions

An existing Pi user asks for one bounded repository change, adopts its intent and preparation scope, receives an exact candidate with applicable assessment evidence and explicitly concludes whether that artifact satisfies the adopted conditions. The same Change can retain a correction and reassessment. A person or deterministic client must be able to inspect these grounds after a clean restart without a model or private session.

**Proposed completion condition:** deliver and review an identified candidate against the exact adopted requirement, with required evidence available and preparation/cleanup outcomes settled. Acceptance of that artifact does not mean it was merged, installed, deployed or observed working in a published application. If the user requires an accepted repository change rather than a reviewed artifact, this smaller outcome is insufficient: select the repository publication contract before specifying that effect path, rather than narrowing the user's intent retroactively.

| Proposed first boundary | Excluded claim |
| --- | --- |
| One authenticated owner, one trusted host, one Ledger/Change and one fixed repository Workspace association. | Multi-user ownership transfer, cross-Workspace rights or remote custody. |
| Sequential bounded preparation, assessment and correction under one continuation custodian. | Parallel workers, durable scheduling, live handoff or automatic continuation after restart. |
| An exact observed clean tracked baseline and an explicit regular-file edit allowlist; the first fixture excludes symlinks, submodules and source-file creation/deletion. | Arbitrary filesystem editing, ignored/private inputs silently included, or a Git commit proving all local State. |
| An immutable retained candidate and independently established assessment grounds. | A producer's success message, model summary or unchanged working directory proving candidate quality. |
| Explicit candidate acceptance and an evidence-backed artifact conclusion. | Guarded branch/ref publication, working-tree replacement, push, deployment, rollback or self-development controller authority. |

The exact executor, fixture, file/input/output bounds, permitted commands, evaluator definitions and retention policy must be selected before this becomes a consumed profile. The proposal does not grant arbitrary shell access. A manual or deterministic producer can demonstrate the lifecycle before model-driven preparation is supported.

## Authority and native boundary

The host establishes the actor, Ledger/Change association, repository binding and current rights independently of client JSON or transcript labels. The owner adopts the exact requirement, constraints, expected deliverable and bounded delegation; a request to pursue does not approve arbitrary commands, network access, credentials or publication.

Preparation writes only to an explicitly admitted candidate environment. Repository observations, candidate writes and command execution are native actions with their own admission and evidence obligations, even though publication is excluded. Read-only Change inspection must never dispatch them. All candidate tools, helpers and descendants must share the selected executor's actual boundary. Pi's working directory, project trust, prompt instructions, tool hooks and a disposable directory are not containment; Pi tools and extensions otherwise use the process account's permissions.

The [trusted-host limit](agent-execution.md#first-trusted-host-profile) remains explicit. Trusted lifecycle storage does not make generated programs trusted or isolate them from custody. If the consumer needs an untrusted coding executor, select and qualify it under [admission and containment](agent-execution.md#admission-and-containment) before running that path. No suitable boundary means preparation is unavailable, not permission to run generated code with the authoritative host's privileges.

Git supplies source/checkpoint evidence, not lifecycle authority or a native publication guarantee. Baseline capture binds the actual repository association, exact revision/tree and admitted file bytes/modes with capture coverage. A changed, dirty, missing or ambiguously associated subject refuses this initial capture; do not stash, reset or clean user work automatically. Native rights and disclosure remain current even when historical candidate evidence is retained.

## Minimum consequential facts

The following are semantic obligations, not record names, enums, API signatures or one-record-per-row requirements. Supported typed operations let the backend construct accepted JSONL facts under the selected successor acceptance protocol. Several facts can be accepted together where that protocol establishes one atomic acceptance unit; native execution may still require separate durable attempt and outcome facts.

| Fact consumed by this workflow | Exact grounds a reader needs |
| --- | --- |
| Expression and adoption | Original captured request, actual provenance and absent information; separately attributable adopted intent, scope, completion conditions and delegation. |
| Baseline and Work specification | Repository/Workspace association, exact baseline and capture boundary, permitted candidate edits/actions, required inputs, expected output, applicable policy/Checks and interruption limits. |
| Preparation admission and attempt | Applicable intent/Work versions, current authority, executor/configuration, exact authorized inputs, original request/attempt association and resource/disclosure limits before execution. |
| Preparation outcome | Actual retained candidate or failure/uncertainty, input-to-output attribution, declared coverage and executor/descendant cleanup evidence. A candidate digest alone is insufficient. |
| Assessment | Exact candidate/baseline/requirement and adopted evaluator versions, authorized supplied observations, actual completed pass/nonpass or distinct operational unavailability, feedback and limits. |
| Correction and reassessment | Attributable scope/Work revision, relationship to prior candidate and findings, newly admitted attempt and exact replacement artifact. Prior results remain intact and do not certify changed bytes. |
| Candidate decision and conclusion | Current authorized actor, accepted/rejected exact artifact, applicable intent and required evidence, remaining responsibilities, conclusion meaning and limits. |

Large candidates and command outputs can be referenced evidence rather than duplicated in lifecycle records. Retain exact required originals, provenance, interpretation, coverage and disclosure/retention duties. Missing required output is unavailable, not a truncation represented as complete. Private transcripts, credentials and hidden reasoning are not required canonical payloads or a second lifecycle store.

Request identity resolves the original operation before another attempt or artifact identity is allocated. Exact repeated input returns the original retained result under current disclosure; changed relevant input under that key conflicts. An interrupted preparation with unresolved effects is not reissued under a fresh key. A separately admitted correction follows established outcome and cleanup, not a disguised retry.

## Worked consumer path

These walkthrough positions are hypothetical until the host, executor, evidence and successor acceptance contracts are supported. They do not freeze wire types or claim current executable behavior.

1. **Capture and decide.** The user requests a small code correction and adopts artifact-only delivery, a concrete requirement, a clean baseline, permitted files and required assessment. Preserve the original request separately; no producer may invent missing consent. The repository is not changed by lifecycle adoption.
2. **Specify and admit preparation.** Establish current rights and source capture, sufficiently precise Work and the selected execution boundary. Durably retain the original admitted attempt before native preparation. No model call is mandatory; no required collection or command is hidden inside a Check.
3. **Retain the candidate.** Establish exact output association and coverage, then settle preparation and descendant cleanup. A worker exit or desired file contents alone does not establish these facts. If required output or cleanup cannot be established, dependent assessment/fulfillment stays blocked.
4. **Assess independently of the producer's assertion.** Authorized Work supplies exact bounded test/inspection observations; an adopted Check assesses its supplied inputs without collecting evidence or mutating State. Where policy requires independent review, retain the reviewer and exact reviewed subject. Human approval does not rewrite a mandatory nonpass or operational failure.
5. **Correct within the same pursuit.** A finding leads to an attributable Work revision and new admitted candidate preparation. Retain the earlier completed nonpass separately from any unavailable run. Assess the new candidate against current grounds; changed scope that exceeds delegation needs new owner adoption.
6. **Accept and conclude the artifact.** The owner accepts the exact candidate only when required conditions and cleanup evidence hold, then explicitly concludes the artifact-only pursuit against its adopted intent. An automatic conclusion would require separately adopted bounded conditional authority; none is presumed here. Repository baseline/branch remains unpublished.
7. **Inspect from a fresh context.** A person or deterministic client retrieves bounded origin/tip/range and current context, explains the request, revisions, exact accepted artifact, failed and passing evidence, omissions and next permitted action. Reopening, Pi restoration, lookup and history replay perform no preparation, assessment or publication.

An alternative stop retains the produced artifacts, known effects, unknowns and outstanding responsibility without claiming fulfillment. A canceled attempt is not confirmed cleanup. Neither stopping nor losing the Pi session makes repetition safe.

## Acceptance propositions and consequential challenges

These are proposed acceptance conditions for the eventual consumed path, not tests run by this documentation change. Native acceptance and exact-release qualification retain the [plan's advancement rule](../../product/plan.md#advancement-rule) and [package gates](package.md#qualification).

| Proposition | Useful positive witness and failure boundary |
| --- | --- |
| Intent and artifact accountability survive the conversation. | A fresh model-free reader explains original/adopted intent, baseline, correction, exact reviewed candidate and conclusion. Missing required grounds remain gaps, not inferred approval. |
| Assessment binds the actual subject. | A known defective candidate produces the applicable nonpass; a corrected candidate can pass on its own retained evidence. Changed candidate, requirement or evaluator cannot inherit the old pass. An unavailable run stays operationally unavailable. |
| Admission excludes unsupported native actions. | Permitted bounded preparation succeeds under the selected executor. Wrong repository association, denied rights, stale baseline, out-of-scope input, unsupported setup or unauthorized publication refuses before that action. Test actual enforcement, not a simulated allowlist. |
| Original identity survives interruption. | Losing the accepted result reply returns the original retained result without reexecution. Loss during execution preserves pending/unknown status until supported reconciliation establishes output and cleanup; a new key, missing receipt or matching bytes cannot cure uncertainty. |
| History is non-executing and authoritative. | Supported clean restart preserves original identities and context. Missing/corrupt acceptance control or indispensable retained evidence blocks dependent progression; extra parseable lines, a Pi branch or a summary cannot select a newer accepted tip. |
| Conclusion says only what evidence supports. | An artifact-only success requires exact accepted candidate, required assessment and settled preparation. It cannot certify publication, deployment or residual unknown effects. A publication-requiring request remains unfulfilled in this profile. |

Before execution, select finite bounds for request/candidate/evidence bytes, history reads, command time/output, descendants, cleanup and retention, with an oversize/unavailable behavior for each. No performance or universal restart claim follows from this document; ordinary reboot/remount, adversarial containment and exact installed Pi/native closure still need their applicable qualification evidence.

## Decisions for the next specification

1. **Product outcome:** approve artifact-only delivery as the first increment, or require repository publication and its additional binding first. This is an explicit scope decision, not an implementation shortcut.
2. **Native fixture and execution trust:** select the exact repository fixture, capture/regular-file preparation contract, eligible executor, assessment observations and cleanup/reconciliation evidence. Specify which threats are excluded; do not substitute a prompt for missing enforcement.
3. **Consumed successor grammar:** map only the facts above to exact bounded operation/result/record envelopes, references, request identity and atomic acceptance/recovery units. Reuse supported foundations where their exact semantics fit; do not append new operations to frozen profiles.
4. **Evidence and read contract:** choose required originals, retention/disclosure, unavailable-reference behavior and minimal deterministic context/range consumption. A session link can help inspect runtime evidence but is never the sole authority or required private memory.

No new Ledger ranking, collaboration protocol, universal scheduler, public SDK catalogue or migration is needed to answer this consumer's first question. Those remain deferred, not discarded. The [worked streams](change-streams.md) continue to test their desired meanings without making them prerequisites for this sequential artifact increment. Software publication and later ChangeKernel self-development retain the [separate controller gate](package.md#minimum-local-dogfood).

The immediate deliverable is independent review of this proposal and an explicit outcome decision. Exact schema adoption, implementation assignments, native checks, runtime experiments and release activation remain later, separately authorized steps.
