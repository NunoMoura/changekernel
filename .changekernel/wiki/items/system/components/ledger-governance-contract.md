---
title: Ledger Governance Admission Candidate
aliases: []
source-id: cw:design:ledger-governance-contract
---
# Ledger Governance Admission Candidate

## Status and bounded consumer

**Concrete logical candidate for independent review, not an adopted protocol or implementation-ready profile.** The user approved the [identity, policy and feedback choices](ledger-governance-and-admission.md#approved-identity-policy-and-feedback-choices) and proceeding with the employee/employer walkthrough. This page preserves that witness and proposes the required bindings, operation boundaries and refusal behavior. Symbolic names and table labels below are not wire fields, published functions or additional primitives. Under the approved responsibility clarification, custom company policy means adopted Checks, while Ledger-associated authority establishes representation and who may adopt/change requirements. This candidate introduces no separate policy-governor and remains unadopted.

The paper consumer has an employee user and an organization user, each with one logical Ledger. Authorized representatives govern the organization's Ledger; the employee's Ledger references only disclosed company Changes. A trusted host is assumed capable of establishing the actual caller, representation and native resource context for this witness. That assumption is not a selected identity service, authenticated integration or qualification result. Existing single-user source profiles do not acquire organizational support through this draft.

The first implementation candidate should remain model-free and bounded to its explicitly supported operations. Semantic assessment, organizational identity resolution, cross-host policy coordination and arbitrary execution remain unavailable wherever the selected profile cannot establish their contracts. Neither adding a relationship nor reading this page launches Work.

## Employee and employer witness

Both Changes below are independently accountable company pursuits, not personal shadow copies created for the employee's assignment:

- **Change A:** prepare a reusable package.
- **Change B:** deploy a service using that package.
- **A/Build:** produce a candidate artifact.
- **A/Test:** run tests and retain evidence for that exact artifact; the applicable Check assesses that evidence.
- **B/Deploy:** deploy an eligible artifact under current production authority.

In this witness, authorized sponsor adoption and current production authority are actual authority/decision grounds. Adopted company Checks require bounded scope evidence before commitment and exact candidate evidence before deployment; a passing assessment supplies neither sponsor consent nor production permission. Investigation can be admitted under its own resource limits while broader feasibility is unresolved. A shared remaining execution budget of €100 is used only for the contention case; it is not a product default.

| Step | What becomes established | What remains separate |
| --- | --- | --- |
| Propose B without sponsor approval | The proposal and missing requirement can be represented. | Recording a proposal is not commitment or a sponsor's refusal. |
| Commit B under authorized adoption | A bounded pursuit and its actual decision grounds are accepted. | Future implementation, expense and production effects still need their applicable admission. |
| Admit A/Build and produce X | An attributable attempt and supported evidence of artifact X's production. | Existence does not establish suitability or testing. |
| Run A/Test and assess its evidence | Evidence and eligible assessment for exact X, definitions and test conditions. | No claim about Y, untested environments or undeclared coverage. |
| Request B/Deploy for X | Admission evaluates B's requirements, contribution acceptance where required, current authority and native guards. | A's completion label is not the basis; admission is not a completed effect. |
| Observe and reconcile deployment | Supported native evidence establishes completion, partial effects or unresolved outcome. | A worker exit, accepted request or lost reply is not proof of success or rollback. |
| Conclude B | An authorized conclusion refers to evidence for B's applicable completion conditions. | Completing a task list does not conclude B automatically. |

B's requirement on A, Test's dependency on Build, each Change's governing relationship to its Work, and Work's contribution to fulfillment exercise the [four relationship meanings](ledger-governance-and-admission.md#change-and-work-relationship-meanings). Work membership, ordering and dependency remain distinct.

## Proposed minimum logical bindings

Retain each consequential binding once in its authoritative context or through an exact reference. No universal envelope, fixed record count or inline policy/prose payload is proposed. The [fact/material reference candidate](intent-revision-contract.md) still needs a selected exact grammar and interpretation contract.

| Binding | Required meaning and omission test |
| --- | --- |
| Accountable subject and actual actor | Identify the Change/Work, governing user and actual actor, with established representation or delegation where needed. Without it, an employee's action could be mistaken for ownership or unrestricted company authority. |
| Exact action and adopted scope | Identify the decision or native operation being requested and the exact intent, Work specification, subjects and input versions it uses. Without it, pursuit approval could permit an arbitrary implementation or old evidence could certify a new artifact. |
| Applicable relationship, authority and Check grounds | Identify the authoritative adoption, exact Check/settings versions, applicability and effective boundary relevant to this action. Without it, changing a View or citing a convenient old policy could change obligations. |
| Required condition and eligible source grounds | Identify what the consuming action requires, its exact source/result references and applicable coverage/freshness. Without it, producer completion, missing data or circular assertions could manufacture readiness. A pending condition does not require inventing a future result identity. |
| Claim origin and assessment interpretation | Distinguish authorized decisions, source reports, native observations and model/other assessments. Preserve exact question, subject, evaluator/settings, outcome and limitations when consequential. Without it, a favorable semantic judgment could be presented as independently observed truth. |
| Original request, acceptance and effect relationships | Bind the original request and complete relevant inputs to accepted results and any actual attempt/outcome. Without it, historical recovery could repeat effects or native admission could be mistaken for fulfillment. |

Policy/relationship graphs, current applicability lists, readiness summaries and ordinary feedback are derived Views. Required assessment material and acceptance/recovery controls are not disposable. Mere absence from a bounded read does not justify a new authoritative failure or uncertainty record; an actual unresolved attempt or incident retains its consequential meaning.

## Proposed admission procedure

This is a logical procedure for review, not a selected transaction algorithm. Native serialization, multi-source freshness, request matching and storage durability remain review blockers.

1. **Establish the inspection context.** Authenticate the caller through the host, identify the accountable subject and requested operation under the supported interpretation contract, and establish current disclosure permission. Request labels, claimed roles and the caller's selected Ledger View cannot supply authority. Historical delivery does not require renewed mutation authority or availability of the original execution capability.
2. **Resolve the original operation.** Apply the [existing request identity requirements](state.md#record-replay-and-durability-requirements). An established accepted exact-input match permits authorized historical result delivery, not a new mutation, attribution or effect. A differently bound request conflicts; an empty lookup alone does not rule out earlier in-flight acceptance.
3. **Establish the new action's governing basis.** Only for new admission, establish that the requested action is supported. Use the Change/Work's actual scope, authoritative relationship/requirement decisions and native resource context to establish applicable adopted Checks, current authority and native constraints. Do not take a client-filtered checklist or model-selected requirement subset as complete. The supported profile must declare how applicability coverage is established; unsupported or unresolved required coverage blocks dependent admission without claiming knowledge of every real-world constraint.
4. **Validate exact grounds.** Establish current authority, expected relevant versions, material custody, eligible assessments and any recipient acceptance. Apply every mandatory condition that actually governs this action; do not average away failures or promote preferences into mandatory vetoes. Missing evidence, a negative assessment, unsupported evaluation and uncertainty remain distinct.
5. **Close relevant races under the supported binding.** Revalidate or guard the dependencies that can invalidate this action. A read of remaining budget is not concurrency control; an earlier authority check is not a guarded effect. Required guards must hold at their actual acceptance/effect boundary, not become a detached readiness flag between these logical steps. No global freeze or cross-Ledger transaction follows from referencing several histories. Refuse an execution guarantee the binding cannot enforce.
6. **Accept only what this operation establishes.** For a pursuit decision, use the [candidate logical acceptance boundary](intent-revision-contract.md#proposed-acceptance-boundary). For Work, distinguish durable admission/attempt identity, guarded native execution, outcome reconciliation and accepted result delivery under the [execution contract](agent-execution.md#durable-attempts-and-outcome-delivery). Do not collapse them into one atomic success claim. Native execution failure or uncertainty does not erase the earlier decision.

No step launches missing evaluation or evidence collection merely because a read finds a gap. A separately authorized assessment or Work operation may satisfy the need. Eligible retained assessments can be reused; the procedure does not require rerunning a model or every Check on every call. Harness delivery and retry scheduling remain outside ChangeKernel.

## Proposed policy revision and in-flight treatment

A custom-policy revision changes the adopted Check requirements through an authorized decision under current Ledger-associated authority and applicable requirements, not a candidate's self-selected exemption. Preserve its exact scope and effective boundary; apply the approved distinction between completed history, future admission and in-flight responsibility.

For an affected future action, establish which adopted Check/settings and applicability decision govern under that boundary. Referencing older requirements does not choose them. Reuse old assessments only when their exact question/input/coverage remains eligible for the new admission basis; unrelated changes need not invalidate them.

For in-flight Work, establish the authorized continuation, safe-stop or reconciliation treatment supported by the executor/resource contract. A recorded stop or revocation is not observed cessation. If requested timing or containment cannot be guaranteed, preserve the decision and actual uncertainty where appropriate, block unsupported further execution, and do not claim immediate enforcement or rollback. Existing obligations do not disappear through policy revision or relationship termination.

## Proposed feedback contract

Feedback identifies one exact requested decision/action and its evaluated basis. It explains admission rather than granting it. These are semantic distinctions for review, not selected response keys or enum values:

| Feedback dimension | Necessary distinction |
| --- | --- |
| Existing decision | What was actually adopted, with exact decision/scope references; a proposed interpretation is not adoption. |
| Requested action and basis | Which Work/decision, artifact/input versions and applicable policy/requirement grounds were assessed. |
| Admission finding | Eligible only under stated evaluated conditions, blocked by established conditions, required grounds not established, or capability unavailable. None is proof of a completed effect. |
| Ground and claim strength | Separate observations, decisions, reports and qualified assessments; show the bounded question and limitations rather than an unqualified “verified” or “safe” label. |
| Resolution need | Identify eligible evidence, authority, clarification or supported capability needed where disclosure permits. A need is not permission to spend resources satisfying it. |
| Recovery relationship | Refer to the original operation and established historical result or unresolved outcome rather than inventing failure or safe repetition. |

Several findings may coexist. Resolving one does not resolve the others. Missing inputs, uncertain judgment, stale grounds, unsupported evaluation and provider failure cannot be rendered as a semantic pass. An actual failed assessment remains distinct from an assessment never run. Disclosure filtering applies to reasons, policy references and source expansion as well as ordinary content; confidential requirements need not be exposed to explain that admission is unavailable.

For the X/Y counterexample, the View can say: the pursuit is committed; publishing Y is blocked because retained test assessment concerns X; recovery description has received a favorable semantic assessment but required recovery-test evidence is missing. The templates are predefined referenced material. A later action still establishes current authority and relevant guards, even if the earlier View reported no blockers under its evaluated basis.

The [System One direction](ledger-governance-and-admission.md#system-one-judgments-and-predefined-feedback) permits a qualified semantic Check in a future supported profile. This candidate selects no model, numeric threshold, automatic policy classifier or provider invocation. A confidently wrong judgment is a qualification risk, not something a typed response or an uncertainty label eliminates.

## Paper counterexamples and expected behavior

These expected outcomes are author paper analysis, not independently reviewed or executed tests.

| Counterexample | Expected behavior |
| --- | --- |
| Tests cover X; deployment requests Y | Old result remains historical evidence for X. Block the Y-dependent requirement until eligible grounds exist. |
| Two Work items request €60 each with €100 shared remaining budget | Independent passes do not permit €120. Require supported aggregate resource enforcement; do not infer it from two reads or a missing dependency edge. |
| Test succeeded only for part of the required subject | Preserve actual coverage; remaining required coverage is not established. |
| A and B each cite the other's expected success | Do not manufacture prerequisite evidence from the cycle. Supported conditional commitments may exist without actual fulfillment. |
| Employee changes personal View or claims a different role | Neither changes the company's rules or grants actual representation. Only supported current authority applies. |
| Relevant policy changes between validation and effect | Apply its actual effective boundary and supported revalidation/guard; no silent stale execution or fictional cancellation. |
| Commitment reply is lost, then intent is revised | Recover the original committed decision under its identity; do not repeat it over the newer intent. Historical result and current View differ legitimately. |
| Mutation authority is revoked or original execution capability is retired | A separately authorized history reader can retrieve supported historical results without re-admission to mutation or effects. Disclosure denial does not prove original non-acceptance. |
| Native deployment reply is lost | Preserve unresolved effect and reconcile under original identity. Request acceptance or an empty lookup cannot authorize repetition. |
| A semantic assessment is confidently favorable but mandatory evidence is missing | Do not use the model judgment to supply that missing evidence. A profile relying on the semantic judgment itself must qualify its actual error behavior, including confident mistakes. |
| Required semantic evaluator or its input is unavailable | Report unavailable/unready, not passed or an invented substantive rejection. No implicit provider retry or evidence collection. |

## Review blockers and bounded next slice

Before implementation of this candidate, select and independently review:

1. The consumed identity/authentication/representation binding, including how it preserves one logical Ledger per user within its supported scope. No global identity registry is implied.
2. Ledger-associated relationship/adoption authority, Check applicability coverage, effective-boundary representation and native guard/freshness contracts. No general cross-host consistency guarantee is assumed.
3. Exact fact/material references, pending-condition binding, request equivalence, accepted-history control and refusal/in-flight reconciliation for the chosen operations.
4. The smallest model-free producer-to-consumer operation path and its consequential fault cases. This paper company release is not permission to implement an arbitrary deployment connector or all organizational functionality.
5. For later semantic evaluation, the separately authorized question/model/settings, feedback interpretation, disclosure, resources, error and latency qualification scope.

The [plan](../../product/plan.md#relationship-policy-and-admission-design-gate) owns sequencing; the temporary status note owns assignments and review state. No implementation, inference experiment, worker dispatch, migration, qualification or controller handoff is authorized by this candidate.
