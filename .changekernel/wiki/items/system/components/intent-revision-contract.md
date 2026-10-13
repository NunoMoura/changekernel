---
title: Intent Revision Contract Candidate
aliases: []
source-id: cw:design:intent-revision-contract
---
# Intent Revision Contract Candidate

## Status and purpose

**User-approved small-path design work; candidate contract, not an adopted schema or executable support.** Following the TUI proposal and its Friday-to-Saturday explanation, the user authorized defining this path precisely before implementation. The approval covers the walkthrough and design work, not unseen field encodings, storage protocols, tool signatures or isolation guarantees. Independent design review and concrete-contract adoption remain required.

The user value is simple: change a plan without losing what was decided before, silently overwriting another decision, or repeating an action because its confirmation disappeared. This narrows the [structural draft](change-ledger-structure.md) to one existing Change and one intent revision, using [Pi as the first consuming environment](sdk.md#harness-targets-and-code-use-bindings). It does not implement booking, cancellation, spending, ownership transfer or cross-owner agreement.

Existing profiles, including exact UTF-8 What and nullable Why, remain unchanged. This page selects no migration, physical inventory or new native operation version. Candidate names below describe logical contracts, not published wire tags or callable tools.

## Approved walkthrough

The hypothetical current intent is “Organize dinner Friday”; the owner's instruction is “Move dinner to Saturday”. The exact replacement proposal can be “Organize dinner Saturday”. The original instruction and replacement have distinct roles and remain preserved; the replacement becomes accepted only when the decision grounds establish its authorization. These sentences illustrate referenced material, not inline successor-record payloads.

| Step | What must happen | What does not follow |
| --- | --- | --- |
| Read | Retrieve the current accepted intent and relevant requirements with explicit coverage. | A recent page is not proof that no older requirement applies. |
| Preserve the proposal | Keep the exact replacement and any presentation needed to understand its adoption. | Saving or displaying Saturday does not adopt Saturday. |
| Establish approval | Bind an authenticated instruction or applicable delegated decision to that exact replacement and scope. | An agent-provided actor label or unattached “yes” is not authority. |
| Admit the revision | Recheck the previous intent, current authority, applicable requirements, exact assessment subjects and required material custody. | A previous pass or a saved context handle does not grant current permission. |
| Accept | Retain the attributable revision and its original-request/result association under a supported acceptance unit. | Friday history and existing restaurant responsibilities do not disappear. |
| Recover a lost reply | Establish whether that same request was accepted and retrieve its original result where authorized. | Timeout, missing lookup data or cancellation proves neither rejection nor rollback. |

If another authorized revision has already changed Friday to Sunday, the Saturday request cannot silently overwrite it. Resolving the conflict requires a new decision on the actual current basis; the adapter must not silently rebase or generate a new request identity.

## Candidate references and minimal fact

### Exact references

| Reference | Logical bindings | Resolution obligation |
| --- | --- | --- |
| Fact reference | Authoritative history identity and immutable fact identity, interpreted under the history's supported contract. | Establish acceptance, not just the presence of a parseable record. A qualified copy can preserve the same identity without becoming another writable history. |
| Material reference | Immutable material identity/version, exact selection and interpretation contract. | Resolve authorized exact material plus required provenance and retention/custody grounds. A URL, digest or session filename alone is insufficient. |

For this text witness, the proposed selector is the whole material or a half-open UTF-8 byte range `[start, end)`, within the exact version and on character boundaries. Do not trim, normalize, substitute rendered text or silently expand the selected passage. Necessary surrounding acceptance context is referenced as well; selecting the word “yes” alone cannot identify what was approved. Non-text selector contracts are outside this witness. Integer/byte encoding at the language boundary remains to be specified losslessly.

Locations are resolution hints, not identity. Material roles belong to the consuming fact: identical bytes used as a proposal and as evidence are not interchangeable meanings. Provenance and retention grounds may be inherited or referenced rather than repeated. Missing or unauthorized material limits reconstruction and dependent admission; externally visible errors must not disclose otherwise hidden existence or metadata.

### Revision fact and omission test

The proposed fact kind is `intent.revised`. Its body carries the following logical bindings, with exact physical encoding still open:

| Binding | Meaning | Why it cannot simply disappear |
| --- | --- | --- |
| `replaces` | Exact previous accepted intent fact being revised. | Prevents an unnoticed overwrite and preserves revision lineage. |
| `replacement` | Exact replacement intent material under its declared interpretation. | Prevents later wording or a regenerated summary from changing the adopted subject. |
| `decisionGrounds` | Role-bound exact instruction/adoption evidence and applicable decision grounds. | Distinguishes the owner's or delegate's actual decision from an assistant's proposal. |
| `assessments`, where required | Exact eligible assessment facts supporting this admission, bound to their definitions/settings, subjects and inputs. | Makes the required admission grounds attributable and reconstructible without rerunning an evaluator. |

Accepted context supplies history/fact identity, meaning/version, established actor and authority, and original operation association. Those bindings must survive somewhere under a supported contract; they are not optional merely because this body does not repeat them. Time evidence is also required when authority, freshness or other governing terms depend on it. An earlier fact or enclosing accepted context can supply a binding without creating a second authoritative copy.

The revision fact is the actual revision decision; a second generic “approved” fact is not mandatory. The replacement must identify the complete intended subject for this witness, not an instruction for a model to invent a patch later. Its precise intent-material interpretation, including expression roles and absence distinctions, is a remaining contract decision. No source prose or artifact payload appears inline in successor canonical records.

“Current intent is Saturday” is a derived View. Reading, retaining a proposal or expanding a reference need not create lifecycle facts. Conversely, required acceptance, custody and recovery controls cannot be discarded as caches. There is no fixed record count per interaction.

## Candidate request, admission and result

A revision request identifies the target Change, original request identity, expected previous intent, exact replacement, decision grounds and applicable submitted evidence. Caller-supplied evidence is input for validation, not a declaration that admission passed. The exact input-equivalence rule and request-identity namespace must be defined before retries are supported.

The trusted backend must establish the following at admission:

1. The caller and actual decision authority, independently of agent-authored attribution fields.
2. The binding between the decision, exact replacement and governed scope.
3. The expected previous intent still being the applicable revision basis.
4. The complete applicable requirements under governing rules, including requirements absent from the client's page or filtered list.
5. Eligible passing assessments for the exact definitions, settings, subjects and inputs, with supported freshness and dependency coverage.
6. Required material resolution/custody and a supported acceptance/recovery boundary.

A read neither runs missing Checks nor silently makes them optional. A revision with missing, unavailable or unsupported required evaluation is blocked; that is not an invented completed false assessment. This witness does not select evaluator execution tools.

Concurrency follows semantic dependencies rather than every history-tip change. An unrelated Ledger priority change need not invalidate an assessment whose contract has no such dependency. Changed relevant requirements or inputs require the supported conflict/re-admission treatment; unknown dependencies cannot be assumed irrelevant. Current authority is always established separately. Exact dependency representation and the mechanism preventing a change between validation and acceptance remain review blockers.

The proposed acceptance unit establishes the revision and its original-request/result association together. A client cannot implement this guarantee by two unprotected appends. Required material must already have supported custody when acceptance relies on it; this is not an atomic transaction across arbitrary external material providers. The underlying native protocol remains unselected and unqualified.

Results preserve three distinctions without selecting enum spellings:

| Established disposition | Consumer meaning |
| --- | --- |
| Accepted | Exact accepted fact/result references and original operation association, under current disclosure permission. |
| Proven non-acceptance of the submitted input, or conflict | A supported native result establishes the submitted request's disposition. A key/input conflict does not establish that an earlier request under that key failed or was never accepted. Reasons are disclosed only as authorized; a native refusal is not automatically a human rejection of the proposal. |
| Not established | Acceptance cannot currently be established. Keep the original identity and use supported reconciliation; do not substitute success, refusal or a fresh operation. |

A transport failure is not itself a native disposition. Definitive non-acceptance of the original operation requires evidence that an older in-flight attempt cannot still accept; an empty lookup or rejection of different inputs alone is insufficient.

## Lost-reply and fresh-reader requirements

- The harness or consuming application preserves outgoing request identity and exact inputs if the integration claims recovery across sender failure. A temporary script variable, `Codemode.store()` or disposable originating transcript is insufficient for that claim. ChangeKernel preserves its own request/result associations at the supported native acceptance boundary; it does not own the sender's pending delivery.
- Reuse of an established request identity with different inputs is a conflict, not a new operation. Exact request matching must not normalize away meaningful differences.
- If the request was accepted, recovery returns the original result rather than performing a new revision. Historical result access needs current disclosure permission, not a new grant to mutate intent.
- If acceptance is unresolved, neither a new key nor a plausible history tail makes repetition safe. Reconcile through the supported controls; missing controls block the recovery claim.
- A fresh authorized reader must recover the accepted revision, previous intent, exact replacement, attribution/decision grounds, applicable admission evidence and remaining coverage gaps without originating-session replay.

**Responsibility correction:** retaining a proposal alone does not durably bind a later dispatch to its request identity, but pre-dispatch persistence is a harness/application concern, not a missing ChangeKernel subsystem. Follow the [harness responsibility boundary](sdk.md#harness-responsibility-boundary). The integration must identify the sender's actual capability or limit its recovery claim; do not add a kernel-owned outgoing queue, session checkpoint manager or retry scheduler to fill that gap.

The kernel contract still needs its own acceptance point, request matching, native in-flight serialization, retention/expiry of request/result associations and treatment of definitive refusals. Required accepted facts, material custody and original-result recovery remain kernel/native contract obligations; moving delivery outside the kernel does not weaken them. These controls are not a second business history or an inbox whose replay executes commands. No automatic resend or blanket exactly-once guarantee is selected here.

## Proposed Pi-facing responsibilities

The following names remain illustrative. They are five responsibilities for this witness, not a universal tool catalogue or five mandatory round trips. The [integration boundary](sdk.md#pi-integration-after-the-model-free-boundary) owns the host/engine separation; Pi does not supply domain acceptance.

| Illustrative function | Input/output responsibility | Limit |
| --- | --- | --- |
| `read_context` | Explicit Change, purpose and bounds; return facts/references, historical positions, coverage/gaps and continuation information. | Navigation position, accepted prefix and semantic subject version remain distinct. No implicit adoption or evaluation. |
| `resolve_references` | Expand selected fact/material references within authorized per-call and aggregate budgets. | Do not reveal hidden material through listings, errors, counts or caches. Do not turn partial resolution into complete coverage. |
| `retain_material` | Preserve exact authorized proposal/evidence material and return references with supported provenance/custody meaning. | Retention is not adoption, authentication of arbitrary source claims or a permanent-availability promise. |
| `revise_intent` | Submit the exact typed revision request and return its structured disposition and references. | No raw append, writable View or caller-supplied “approved/passed” shortcut. |
| `inspect_operation` | Inspect an original request/operation under current authorization; recover established disposition or explicit uncertainty. | An identifier grants no access; an absent result does not authorize a retry. |

Results must be code-usable without parsing explanatory prose. Per-call and aggregate call/item/byte/time limits, supported owner serialization and meaningful cancellation/cleanup rules still apply. A context View is not a permission token. Concrete types, discovery metadata, binding mechanism and numeric limits remain to be selected; this page runs no adapter or host experiment.

## Author paper analysis against the twelve cases

This is a design comparison against the [twelve structural cases](change-ledger-structure.md#paper-stress-cases), not executed tests, independent review or proof of complete representation. The narrow revision path must preserve the wider distinctions without claiming to implement their operations.

| Case | Consequence for this candidate | Coverage limit |
| --- | --- | --- |
| Different parties adopt different terms | Exact material/version and decision bindings prevent treating Q1 and Q2 as the same subject. | Reciprocal agreement and party-specific adoption operations remain outside this slice. |
| Interrupted consent | Missing decision evidence cannot be fabricated from a timeout. | This does not resolve another owner's actual decision or delivery protocol. |
| Withdrawal after incurred cost | Replacing intent neither releases existing responsibility nor proves executor cessation. | Withdrawal, revocation, release and settlement need distinct operations. |
| Stale transfer Check | Assessments bind exact subjects and inputs; a different recipient/material is not the checked subject. | Transfer and exclusive custody are not supplied by this revision operation. |
| Unrelated priority versus changed intent | Relevant semantic dependencies govern reuse; a pass for I1 does not silently cover I2. | Exact dependency encoding and concurrent admission mechanism remain open. |
| Adopted generated presentation | Preserve V1 as the accepted subject; V2 cannot replace it by regeneration. | Exact material interpretation and custody must be supported. |
| Qualified copy versus digest-only material | Qualified resolution may preserve the same source identity; a digest alone cannot reconstruct required grounds. | Retention/resolution mechanism and failure behavior remain unqualified. |
| Conflicting revisions | Both requests name their previous intent; a stale second request cannot overwrite the accepted first one. | Atomic compare/admit and retry protocol still need a native contract. |
| Older requirement missing from a page | Backend admission derives applicable requirements; a client page is not the authoritative requirement list. | Completeness evidence and dependency tracking need specification. |
| Unaccepted tail claims completion | Only accepted facts and supported recovery controls establish outcomes. | No fork or native-effect recovery capability is claimed. |
| Corrected contribution affects some reliance | Revision preserves earlier decisions and cannot infer complete downstream knowledge or erase unaffected grounds. | Contribution adoption, scoped impact and notifications are not implemented by this slice. |
| Condition fulfilled externally | A revised intent is not an observation of fulfillment, causal credit, conclusion or settlement. | Those meanings need their own typed facts and supported operations. |

## Decisions still needed before adoption

The candidate is ready to discuss, not ready to implement. Independent review must examine at least:

- The reference/material interpretation and full intent shape, exact selector encoding, provenance and retention contract.
- Which accepted context supplies every omitted binding, including authority and applicable assessment grounds.
- The complete relevant-dependency basis and native compare/validate/accept boundary.
- Kernel-side request identity scope, exact input equality, acceptance point, refusal/in-flight handling, retention and recovery access; separately, the integration's supported sender-side correlation and delivery guarantees.
- Structured result/error and coverage contracts that preserve uncertainty without leaking unauthorized information.

New choices must return to the TUI before adoption. Independent review is still pending; current authorization and dispatch state belong in the [temporary status note](../../../../../CHANGEKERNEL_STATUS.md), not this desired-state page. No implementation, worker launch, native test/build, experiment, migration, qualification or controller handoff follows from this draft.
