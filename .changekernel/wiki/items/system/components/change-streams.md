---
title: Worked Change Streams
aliases: []
source-id: cw:design:change-streams
---
# Worked Change Streams

## Status and reading key

**Hypothetical design witnesses, not an adopted successor schema or executable acceptance.** The fictional band *Paper Lantern* is preparing a release called *Low Tide*; dates below are in its fictional 2027 release calendar. Neither the band nor any connector is a selected application consumer. These examples exercise the [format/lifecycle requirements](change-format.md), [ownership model](../../product/changekernel.md#ownership-model-and-responsibilities), [State read contract](state.md#structured-history-access-and-context-projections), [Checks](checks.md) and [execution boundaries](agent-execution.md). Existing profiles, inventories, authority and recovery meanings remain unchanged.

The steps are semantic walkthrough positions, **not record types, wire enums, sequence numbers or one record per milestone**. Consequential facts would be retained through supported typed backend operations in authoritative JSONL; exact acceptance units, encodings and storage remain open. No JSON envelope, persistent filename layout or public API is proposed here.

Each step distinguishes:

- **C / E:** canonically retained facts / exact referenced evidence with its interpretation and custody.
- **V / =:** derived View / things the step does not change.
- **Reader / ?:** what a new authorized reader can establish at the selected accepted prefix / what remains unknown. Reader access is bounded and purpose-specific; it never confers execution permission.

Names below are stable illustrative logical references, not authenticated identifiers. `A`, `R`, `T`, `F` and `C` expand to Changes in fictional Ledger `Band/L`; `M` expands to Change `Vale/L/Master`. An `i`, `p`, `w`, `d`, `a`, `o`, `q` or `e` suffix names an exact illustrative intent, plan, Work, decision, attempt, outcome, Check definition or evidence item defined at the cited step; it is mnemonic, not an enum catalogue. `L` denotes Ledger `Band/L`, not another Change. `h` names a selected accepted prefix, not a physical offset or necessarily one appended record. Evidence names stand for exact retained inputs/outputs, not a hash-only promise. Their authenticity, availability and disclosure require the premises below.

| Change | Originating owner; fixed Workspace | Accountable pursuit; origin and last illustrated prefix |
| --- | --- | --- |
| `A` — announcement | Band; Band release Workspace | Correct one existing public announcement; `A.h1` → `A.h3`. |
| `R` — release | Band; Band release Workspace | Prepare and announce *Low Tide*; `R.h1` → `R.h8`. |
| `T` — rehearsal | Band; Band rehearsal Workspace | Confirm a rehearsal slot; `T.h1` → `T.h2`. |
| `M` — mastering | Vale; Vale audio Workspace | Deliver a specified master to the Band; `M.h1` → `M.h2`. |
| `F` — listening page | Band; Band release Workspace | A new listening-page pursuit after release effects; `F.h1` → `F.h2`. |
| `C` — press kit | Band; Band release Workspace | Consolidate selected remaining promotional objectives; `C.h1` → `C.h2`. |

`M` and `T` have separate Changes because they are independently adoptable and accountable in separate scopes, not because a different worker or app participates. Shared topic, copied bytes and a personal reference to `R` do not create a second writable `R`. No ownership transfer occurs.

## Conditional capability premises

**These are assumptions for the fictional walkthrough, not claims about current ChangeKernel or requirements silently adopted by this page.** Without the corresponding qualified capability, stop at proposal/preparation/refusal. API names alone supply none of these guarantees.

| Premise | What this witness conditionally assumes; absence blocks |
| --- | --- |
| `P-custody` | A qualified host establishes actors/current policy independently of inputs; a selected persistence protocol protects one accepted progression, original request/result identity, required durability and prefix validation. Missing acceptance control, corrupt required history or incompatible custody blocks dependent steps; extra parseable lines cannot select a new tip. |
| `P-evidence` | Referenced source passages, native observations, candidates, assessments and receipts have exact identity, interpretation, coverage, authenticated provenance and declared retention/disclosure. Required missing bytes block the dependent claim; a digest or producer assertion is insufficient. |
| `P-page` | The fictional binding `Band/page-binding@1` supports guarded updates of existing pages: it enforces current authority and an exact-resource version condition at publication, and provides durable original-operation outcome lookup attributing a revision to that attempt. Its declared retention covers this walkthrough. It supplies no conditional creation/absence guarantee, permanent content, global rollback or unrelated-resource atomicity. |
| `P-work` | Bounded preparation can run on independent copy/art scopes without native publication authority. One continuation custodian admits and reconciles Work; cancellation/termination and output custody are established, not inferred from worker exit. Any calls sharing a custody-bearing native owner, including reads, are serialized; parallel preparation is not competing acceptance. |
| `P-mail` | The fictional mail binding authenticates a bounded recipient scope and durably admits an attempt, but can lose its delivery receipt and cannot prove non-delivery afterward. This permits illustrating uncertainty, **not safe resend**. Without even these admission/evidence grounds, no send is allowed. |
| `P-book` | The fictional rehearsal binding enforces current booking rights and slot availability at reservation, and supplies a durable original-operation result establishing the exact confirmed slot. Without it, rehearsal confirmation cannot be claimed. It supplies no transaction with the release binding. |
| `P-priority` | A hypothetical successor accepts attributable Ledger active-selection decisions against an exact prior planning-context version, rejecting conflicting reorders without overwriting. Closed existing selection/custody controls are not priority storage. Without a selected protocol, these remain proposals, not accepted ranking. |
| `P-share` | A separately supported disclosure protocol authenticates an exact source prefix and selected evidence, declares omissions and checks current disclosure/retention rights. It conveys neither custody nor credentials, and cannot recall received plaintext. Without it, no qualified export claim is made. |
| `P-handoff` | A separately supported, authenticated safe-boundary protocol proves predecessor exclusion, successor custody, quiescence, retained pending/unknown responsibility and interruption recovery, without two active custodians. Recipient rights/admission are separately established. A failed or interrupted transfer cannot be inferred complete from timeout or file possession. |

The extended family assumes bounded Band delegation under exact policy `Band/K1`, with resource obligations retained; Vale uses `Vale/K1`. Named people below are host-established fictional actors: Mira may adopt Band commitments, Ivo initially holds continuation, and Noor may later receive bounded continuation. Role prose is not itself a grant. Checks assess supplied inputs; any collection is separately authorized Work.

## Trivial Change — one announcement update

### A1 — direct expression and bounded adoption

Mira's authenticated direct request `A.e-request` says: “Change the existing public announcement title from ‘Low Tdie’ to ‘Low Tide’; leave the body and publication date unchanged.” Why is absent, not invented. In this one interaction Mira adopts `A.i1` and exact operation specification `A.p1`: conditionally replace that title on resource `Band/page/announcement` observed at revision `ann-v7`, with unchanged body/date; success requires an attributable native revision and observed title/body/date. This uses no planning agent or redundant confirmation.

Previously adopted policy `Band/K1` contains an explicit bounded title-correction rule authorizing evidence-conditional backend closure. Initial decision `A.d1` retains its applicability here: automatic fulfillment requires the attributable effect and unchanged-body/date evidence to satisfy exact `A.i1`/`A.p1`, with current conclusion authority and applicable policy still valid. Exact prior adoption evidence `A.e-policy-adoption` authenticates that rule. This authority is not inferred by adding words to `A.e-request`, and there is no later human approval.

- **C / E:** Retain expression/provenance, attributable initial decision `A.d1`, `A.i1`, `A.p1`, exact policy/binding grounds including `A.e-policy-adoption`, and request association at `A.h1`. `A.e-before` is the authorized revision-`ann-v7` observation including the fields needed to validate the unchanged-body/date condition.
- **V / =:** “Title correction adopted; not yet published” is derived. Adoption changes no native State and grants no general editing scope.
- **Reader / ?:** The reader can distinguish source expression, initial adoption, minimal specification and prior evidence-conditional closure authority, and see why this operation needs `P-page`. Current permission and whether `ann-v7` still holds at effect time remain unestablished.

### A2 — current admission and evidenced effect

Under `P-custody`, `P-evidence` and `P-page`, resolve the original request first. Current native rights, Mira's still-valid delegation, `A.i1`/`A.p1`, `Band/K1`, exact subject and applicable deterministic constraints admit `A.a-title`. This bounded example requires no additional domain Check or formal independent Review, not universal assurance. The backend durably retains the admitted attempt before the conditional native operation. Original-operation lookup establishes `A.o-title`: that attempt produced revision `ann-v8`; retained observation confirms the title and unchanged body/date.

- **C / E:** `A.h2` retains admission, attempt/input identity and established outcome. `A.e-receipt` binds `A.a-title` to `ann-v8`; `A.e-after` supplies the scoped field observation. Neither an API success string nor equal desired bytes supplies that attribution.
- **V / =:** “Correction applied; conclusion pending” is a View. Original intent/actor/retry identity remain unchanged. Reopening or retrying exact input delivers the retained result under current disclosure, not another edit; changed input under that key conflicts.
- **Reader / ?:** The reader can establish the observed effect within these versions and coverage, not permanence or unseen external changes. If current authority is denied or the version is stale, refuse publication; if the effect/reply gap cannot be reconciled, retain uncertainty and block repetition/conclusion instead of this success step.

### A3 — explicit narrow conclusion

The backend accepts conclusion operation `A.d-close` under the conditional authority retained in `A.d1` and previously adopted `Band/K1`, against `A.i1`/`A.p1`, `A.o-title`, `A.e-receipt` and `A.e-after`, producing `A.h3`. It establishes current conclusion authority, applicable policy and exact evidence before closure; missing/contradicted grounds, revocation or uncertainty blocks fulfillment. The bounded correction is fulfilled automatically within the original interaction, not by a fictional new decision from Mira; no later confirmation or separate Review is required by this example's policy.

- **C / E:** Retain explicit backend conclusion, actual authenticated operation context, prior conditional authority/adoption references, exact completion grounds and limits. Mira remains attributable for `A.d1` and the earlier policy adoption, not a newly invented `A.d-close` approval. Reference existing receipt/observation rather than duplicating them.
- **V / =:** “Fulfilled at `ann-v8`” is a View. Conclusion changes neither the source request nor the native resource; it is not a perpetual lock or future editing grant.
- **Reader / ?:** Another reader can reconstruct why fulfillment was accepted without the conversation. Later native drift is unknown unless separately observed. Missing required receipt/observation, prior conditional authority or current conclusion permission would have blocked this claim; no later “done” message is presumed to fill a gap.

## Extended family — prepare, revise and encounter effects

### R1 — proposal is not adoption

Source passage `R.e-request` says: “Release *Low Tide* on 10 June. Put up the approved cover and listening page, and notify our opted-in mailing list once. Keep the budget below the agreed cap.” An app agent proposes a fuller plan; it cannot supply Mira's consent. Mira then adopts exact `R.i1` at decision `R.d1`: date 10 June, approved cover/master, public page and one mailing-list notification, budget cap and rights constraints specified in retained evidence `R.e-constraints`. The canonical expression and adopted completion conditions remain separate.

- **C / E:** `R.h1` retains captured expression, proposed interpretation and actual adoption/attribution; exact source passages and accepted proposal context remain available under `P-evidence`. For this illustration `R.e-constraints` fixes a 500 EUR aggregate release-Work cap, licensed cover/master only, and one notification of the authorized opted-in list as captured at mail admission. These exact adopted grounds, not an inferred summary of “agreed cap,” must remain retained.
- **V / =:** “Release adopted; Work not yet admitted” derives from these facts. No native effect, queue position or blanket approval follows.
- **Reader / ?:** The reader can establish what Mira adopted and when, not every possible plan or prior private intention. Missing adopted constraints block the affected admission; reconstructing a convenient cap from a summary is not allowed.

### R2 — parallel preparation and an exact contribution dependency

Mira adopts `R.p1`: copy preparation `R.w-copy@1` and cover preparation `R.w-art@1` may run concurrently under `P-work`; publication `R.w-page@1` awaits exact acceptable cover, copy and master results. The plan specifies scoped candidate outputs, budget accounting, result evidence and recovery limits before any publication. The page operation targets `Band/page/low-tide`, publishing only exact accepted copy/cover/master references; applicable current version conditions are bound before the effect. Independent contributor Vale adopts `M.i1`/`M.p1` at `M.h1` in the audio Workspace: produce one exact-format master from licensed source `M.e-source`, delivering specified quality evidence to the Band. This is a separate pursuit, not authority over `R`.

- **C / E:** `R.h2` retains `R.p1`, Work grounds/admission and exact dependency conditions: publication needs accepted copy/cover versions and recipient acceptance of the delivered master plus licensing evidence. `M.h1` retains Vale's distinct expression, decision, plan and bounds. Candidates and native source observations are referenced evidence, not published State.
- **V / =:** Parallel preparation and “publication waiting for grounds” are Views; private queue state is not canonical progression. One `R` custodian remains Ivo. No permission to publish, broaden budget, read Vale's private Ledger or create a fresh native owner per call is implied.
- **Reader / ?:** A reader with appropriate access can establish which results each dependency requires, not readiness from task completion labels. Contributor delivery, recipient acceptance and future point-of-use authority remain unknown. Shared native scopes without qualified concurrency guards block parallel effects regardless of this plan.

### R3 — intent and plan revision while Work is in flight

Copy candidate `R.e-copy-old` and completed assessment `R.e-copy-check-old` address `R.i1`/`R.p1` and 10 June. Cover preparation remains in flight. Mira explicitly continues the same pursuit, adopting `R.i2` at `R.d2`: date moves to 17 June; budget, licensed-material conditions and one-notification obligation remain. New plan `R.p2` withdraws future admission for date-bearing copy/publication under `R.p1`; it specifies replacement copy Work `R.w-copy@2` and publication `R.w-page@2`. Original copy is retained as an older candidate, not silently edited or certified for the new date.

For in-flight `R.w-art@1`, `R.d2` explicitly permits only its already-bounded preparation to finish under old grounds: art contains no date, has no publication rights and stays within the unchanged budget. A later assessment must establish applicability to `R.i2` before reuse. No widening of that Work occurs. If its scope had included scheduled publication, request stop and establish actual quiescence/effects before new admission; a cancellation request alone would not establish it.

- **C / E:** `R.h3` retains original and revised intent, adoption time, `R.p2`, affected-Work decisions and old candidate/assessment references. The exact old copy and Check question/subject are retained; their pass remains a historical pass about old grounds.
- **V / =:** “17 June; copy rework; cover finishing bounded old Work” is derived. Prior admission, results and budget usage are not rewritten; actual completed effects would survive even if undesirable.
- **Reader / ?:** The reader can compare revisions and establish which future admissions were withdrawn and what in-flight responsibility remains. Art result suitability and any unobserved effect are unknown until evidenced. The old Check cannot certify `R.i2` merely because its Boolean was true.

### R4 — completed-false licensing assessment, operational unavailability and accepted contribution

Cover candidate `R.e-art-bad` completes old bounded preparation. Required licensing Check `R.q-license1` asks whether all image elements in the exact candidate have retained permission for this public use. It completes with a false result on `R.e-art-bad`: that candidate contains an unlicensed image. This is a completed licensing judgment, not evaluator execution failure. No publication is admitted. Correction Work produces `R.e-art-good`; new licensing assessment `R.e-license-pass` completes true on that exact corrected candidate under `R.i2`/`R.p2`. Separately, a required copy assessment cannot run because its exact input is unavailable; this is operationally unavailable, not false and not a pass. Authorized collection restores exact candidate `R.e-copy-new` and a fresh applicable assessment `R.e-copy-pass` checks its 17 June content. Collection is Work, not a Check secretly fetching data.

Vale concludes `M` fulfilled at `M.h2`, with exact result `M.o-master` and evidence `M.e-master`, `M.e-quality`, `M.e-license`. The Band receives those selected items under `P-share`. Recipient acceptance `R.d-master` evaluates that exact master and disclosure/licensing scope against `R.i2`/`R.p2`, retaining `R.e-master-assessment`. A producer's “mastering complete” label alone would not unblock publication; a different byte version or missing license would require refusal/collection/reassessment.

- **C / E:** `R.h4` retains the completed-false licensing judgment and the separate operationally unavailable copy-assessment facts, correction/collection Work grounds, applicable completed assessments and attributable contribution acceptance. `M.h2` retains Vale's own conclusion; Band references its authenticated delivered result and required evidence, never concatenates Vale's history into `R`.
- **V / =:** “Exact assets accepted; publication awaiting current admission” is a View. The completed nonpass and its evidence, operational-unavailability grounds, old Work/intent identities and producer attribution remain intact. Recipient acceptance neither grants Vale custody nor creates native rights.
- **Reader / ?:** The reader can establish how exact dependency conditions became satisfied and distinguish false judgment from missing-input failure. Undisclosed unrelated Vale material remains outside coverage; present delivery grounds do not prove complete knowledge of Vale's Ledger or future native freshness.

### R5 — Ledger selection and a conflicting reorder

Mira adopts rehearsal `T.i1`/`T.p1` at `T.h1`: confirm the Cedar room slot on 16 June, 18:00–20:00 in the rehearsal calendar's declared local timezone, under `P-book` with its own current rights, guarded booking and original-outcome evidence. This independently accountable Change stays in its rehearsal Workspace; `R` gains no cross-Workspace authority. Ledger decision `L.d1` selects the small active set `[R, T]` in planning context `Band/L:allocation1`, referencing the adopted release/rehearsal grounds. No total ranking of retained Changes or numerical active cap is chosen.

Two authorized reorder requests cite that same prior context. Mira's `L.d2` moves `T` ahead of `R` because its booking deadline comes first; under `P-priority`, it accepts context `Band/L:allocation2` with `[T, R]`. Ivo's concurrent proposal to retain `[R, T]` conflicts against the old context; it does not overwrite `L.d2`. A later resolution would need current grounds and a new attributable decision, not last-writer-wins. If no qualified successor selection protocol exists, retain these as proposals only.

- **C / E:** Retain Ledger coordination decisions/grounds, exact prior/resulting contexts and the consequential rejected reorder request/conflict as supported by the eventual protocol. They are not a second lifecycle history of `R` or fields added to frozen custody controls. `T.h1` separately retains rehearsal adoption.
- **V / =:** The ordered active-set View shows `[T, R]`. Historical order, running Work, budget/rights obligations, deadlines and unresolved effects remain unchanged. A personal authorized View putting `R` first cannot override Band allocation.
- **Reader / ?:** The reader can establish the allocation decision and conflicting input, not that priority forces execution order. If `T` is unready, eligible `R` Work may proceed; the actual allocation effect and later reorders are unknown at this prefix.

### R6 — one established publication and one uncertain send

With `R.i2`/`R.p2`, accepted dependencies and freshly established rights, observation `R.e-page-before` binds `Band/page/low-tide` at `rel-v3`. Exact publication input `R.e-page-input` binds the accepted copy/cover/master references and 17 June date, with expected revision `rel-v3`. Publication attempt `R.a-page` is durably admitted and performed under `P-page`. Native outcome `R.o-page` and receipt `R.e-page-receipt` attribute public revision `rel-v4` to that exact attempt; scoped observation `R.e-page-after` confirms approved assets/date. A stale page version would refuse publication, not be overridden by the successful asset Checks.

Notification attempt `R.a-mail` then receives separate current admission under `P-mail`, bound to exact message `R.e-mail-input`, authorized recipient scope, once-only condition and original operation identity. The process loses its reply after invocation. Recovery looks up **that original attempt**; required delivery evidence is unavailable. Retain `R.o-mail-unknown`: delivery may be none, partial or complete. Neither matching public-page contents nor a lack of local receipt proves mail delivery/absence. No new send identity is allocated and no resend is allowed.

- **C / E:** `R.h5` retains separate durable attempts, the established page outcome and mail uncertainty, original inputs/actors and actual reconciliation limits. `R.e-mail-lookup` retains the bounded failed lookup/coverage, not an invented receipt or native after-State.
- **V / =:** “Page published; notification unknown; unsafe repetition blocked” is derived. The earlier completed-false licensing result, operational unavailability and adoption remain intact; page success is not aggregate fulfillment. Priority reduction would not hide or discharge mail responsibility.
- **Reader / ?:** The reader can establish attributable publication at `rel-v4` and the consequential unknown send. Actual mail delivery, later native drift and external activity beyond observations are unknown. If required attempt custody or native admission evidence were missing, the send itself would have been blocked, not merely relabeled uncertain afterward.

## Extended family — disclosure, continuation and distinct pursuits

### R7 — selected disclosure and refused handoff

Mira authorizes snapshot `R.e-share1` at exact prefix `R.h5`: revised public intent, approved cover/master references, page evidence, relevant Work/admission/outcome grounds and explicit mail unknown. Private mailing addresses and financial source material are omitted under declared coverage; required custodial originals remain under their existing retention obligations. Noor receives an authenticated, bounded inspection View under `P-share`, with gaps and expansion rights stated. If the missing material is indispensable for a requested continuation, that operation stays blocked; redact-and-label is not a safety proof.

Noor's initial handoff request is refused: Noor lacks native mail/reconciliation rights, and no qualified exclusive-transfer protocol has yet been established. The refused proposal can be retained as an attributable decision without changing custody. Reading the snapshot, setting a “borrowed” label or copying records to another Ledger does not enable continuation.

- **C / E:** `R.h6` retains disclosure decision/coverage, exact source-prefix association and refused handoff grounds. Export bytes/View are referenced evidence; `R.e-share1` is not acceptance control or an independently writable source history.
- **V / =:** “Shared for review; transfer refused” is derived. Band remains originating owner, Ivo remains custodian, native rights/credentials do not travel, and unknown mail remains unknown. Previously disclosed plaintext cannot be recalled by later revocation.
- **Reader / ?:** Noor can establish the selected grounds, omissions and refusal, not private recipient details, latest source tip after `R.h5`, or current continuation eligibility. If provenance is only a hash, even source authenticity remains unestablished.

### R8 — conditionally admissible safe-boundary handoff

This continuation is admissible **only if `P-handoff` is separately selected and qualified**. In its absence the progression stops at `R.h6`, not at a purported transfer-success label. In the conditional witness, a trusted coordinator establishes preparation/publication workers quiescent, no continuing executor capable of another mail invocation, exact original attempts and retained unknown responsibility. Possible downstream mail delivery remains unknown; the supported transfer must account for it without needing to reissue or cancel the send. Executor quiescence does not resolve native delivery. Required disclosure and bounded native reconciliation rights are separately granted to Noor under exact policy `Band/K1`; no permission to resend is granted.

Authenticated transfer `R.d-transfer` binds exact checkpoint `R.h6`, parties and responsibility. The consumed protocol durably excludes Ivo from further continuation, establishes Noor as the sole custodian and supports interruption reconciliation without both parties resuming. It accepts `R.h7` only at its proven safe boundary. Interrupted/ambiguous transfer blocks further effects until custody is established; timeout is not predecessor death. Noor separately establishes current admission for bounded original-attempt lookup, not inherited effect authority.

- **C / E:** Retain transfer decision/result, continuation segment attribution, exact predecessor grounds, pending/unknown responsibilities and protocol evidence `R.e-transfer`. Preserve original actor/request/result identities and exact source evidence, including confidential required material in authorized custody; none is reconstructed from the review View.
- **V / =:** “Noor holds bounded continuation; mail remains unknown” is derived. Band ownership/Workspace, old attribution, established publication and all obligations stay unchanged. This is not ownership transfer, a new history, permission inheritance or live handoff.
- **Reader / ?:** The reader can establish who may continue within the demonstrated segment and which original attempt needs reconciliation, not mail outcome. A capability lacking predecessor exclusion, custody recovery, recipient rights or indispensable evidence blocks this step. Portable history alone cannot prove any of them.

### F1 — fork after effects, not rollback

After `R.h7`, Mira adopts independent listening-page Change `F` from exact source grounds `R.h3` (the date revision) **and** retained consequential later grounds `R.h5` (page effect/mail unknown) and `R.h7` (custody). `F.i1`/`F.p1` pursue a date-free update to the pre-existing listening page at distinct resource `Band/page/listen` through `Band/page-binding@1` under `P-page`, using the accepted assets; they explicitly exclude sending mail and making a claim that the original release was fully announced. `F.h1` retains adoption, lineage and applicable contribution/rights grounds. Forking from earlier intent does not restore native State to before `R.a-page`.

- **C / E:** Retain new pursuit identity, original lineage/checkpoints, independent decision and specification, established source effects/unknowns relevant to admission. Fresh scoped observation `F.e-before` establishes that `Band/page/listen` exists at `listen-v1`; `F.p1` specifies a guarded update of that version, not resource creation. Old historical observation is not substituted for these current grounds.
- **V / =:** “Independent listening-page update planned; release unchanged” is a View. `R` remains authoritative for its own history and unknown mail; `F` receives no right to replay `R.a-page`/`R.a-mail`. Lineage is not automatically a dependency, compensation or rollback.
- **Reader / ?:** The reader can establish what future work is independently adopted and the relevant changed native reality, not absence of old effects. Missing relevant effect/unknown grounds or fresh rights would block admission; a historical cursor alone is not effect-ready.

### F2 and T2 — scoped success without erasing source uncertainty

Under separately established current admission, `F.a-page` uses `Band/page-binding@1` to conditionally update existing `Band/page/listen` only if its version remains `listen-v1`. Exact input `F.e-page-input` binds that subject/version and the date-free page candidate using accepted assets. Attributable outcome `F.o-page` and receipt/observation `F.e-page-result` establish revision `listen-v2` from that attempt. Absence, stale version or missing current rights refuses this update; `P-page` supplies no permission or guarantee to create a missing page. Mira concludes `F` fulfilled at `F.h2` against `F.i1`/`F.p1`. Separately, rehearsal operation `T.a-book` yields exact confirmed slot `T.o-book` with binding evidence `T.e-book-result`; Mira concludes `T` fulfilled at `T.h2` against `T.i1`/`T.p1`. Neither operation shares a transaction with `R`.

- **C / E:** Each Change retains its own admission, original attempt/result and evidence-backed conclusion; outcome evidence names the scoped native subject and versions. If the rehearsal binding cannot supply guarded booking/outcome evidence, its illustrated success is unavailable, regardless of rank.
- **V / =:** “Listening page and rehearsal fulfilled; release notification unknown” is a combined View. Success does not alter `R`, undo its mail invocation or certify obligations outside either completion condition.
- **Reader / ?:** An authorized reader can establish each narrow success and exact contribution available for reuse. Later slot/page drift and the unresolved mail delivery remain unknown; a combined success count cannot conclude `R`.

### C1 — combined View is not consolidation

A dashboard combines `R.h7`, `M.h2`, `T.h2` and `F.h2`; it records no new commitment. Mira instead explicitly adopts new press-kit pursuit `C.i1`/`C.p1` at `C.h1`: publish an approved digital kit comprising selected release narrative, licensed cover/master excerpt and the accepted listening-page reference. `C.p1` names pre-existing resource `Band/page/press-kit` and fictional binding `Band/page-binding@1` under `P-page`: only a guarded update of the observed version is admissible, not creation of a missing subject. This explicitly consolidates selected public-listening intentions from `R.i2` and `F.i1` and adds a new remaining objective, the kit. The already-produced page/assets are accepted contributions, not fictitious undone work. It does not adopt rehearsal scheduling, private recipients, Vale's entire intent or an assertion that the mail succeeded; the kit is not a substitute fulfillment of `R`'s once-notification condition. Source rights evidence must specifically permit excerpt reuse; mastering delivery alone is insufficient. If that permission is unavailable, kit preparation/publication stays blocked pending authorized collection or scope revision.

Mira expressly leaves source conclusions unchanged and retains `R`'s reconciliation responsibility; consolidation does not cancel sources or automatically supersede them. The request does not concatenate logs. Ledger decision `L.d3`, against `Band/L:allocation2`, selects `[C, R]` as context `Band/L:allocation3`, leaving fulfilled `T` and `F` retained but inactive. Kit rank is explicit, not an average of source ranks; it cannot waive the unknown mail obligation.

- **C / E:** Retain new intent/adoption, selected source identities/prefixes and exact contributions, omitted/conflicting objectives and required rights/Checks; Ledger selection is a distinct coordination decision. `C.e-reuse-rights` is qualified excerpt-use evidence, not an inferred consequence of shared topic.
- **V / =:** Combined dashboard and kit-planning summary are Views. Source histories, owners, Work attribution, conclusions and effects remain intact. Consolidation supplies neither cross-Workspace authority nor a distributed transaction.
- **Reader / ?:** The reader can distinguish presentation from new accountable adoption, establish selected scope and source treatment, and see why current contribution acceptance is required. Unavailable source context is a gap, not evidence of compatibility across whole Ledgers.

### C2 and R9 — separate conclusions with honest residual responsibility

`C.d-contributions` accepts exact received/reused cover, master excerpt, narrative and `F.o-page` against `C.i1`/`C.p1`, after applicable licensing/content assessments on those versions. The old `R` or `M` passes cannot silently certify a newly composed kit. Current scoped observation `C.e-before` establishes `Band/page/press-kit` at `kit-v1`. Exact input `C.e-kit-input` retains that subject, binding `Band/page-binding@1`, expected version `kit-v1`, and the exact composed kit candidate with accepted contribution versions and rights/assessment grounds. Current admission binds `C.i1`/`C.p1`, those inputs, native rights, delegation and required Checks before durable attempt `C.a-kit`. Under `P-page`, outcome `C.o-kit` and receipt/observation `C.e-kit-result` attribute revision `kit-v2` and the approved kit contents to that attempt. Missing subject, stale version, denied rights or unavailable required evidence blocks the dependent operation/conclusion; no kit creation guarantee is inferred. Mira concludes `C` fulfilled at `C.h2` only for that kit and its observed version.

Noor's authorized original-attempt reconciliation still cannot establish `R.a-mail` delivery. Mira accepts `R.d-stop` at `R.h8`: **stopped, not fulfilled**, against `R.i2`, with page effect retained and notification condition unresolved. This is no retroactive narrowing to “page only.” Mail uncertainty and responsibility for any later supported reconciliation remain discoverable and consequential; stopping, lower rank, archive or a new kit cannot make resend safe or erase recipient/resource obligations. No compensating action is claimed; one would need separate admission and its own evidence.

- **C / E:** Retain exact kit contribution acceptance, applicable assessments/admission/effect/conclusion, and `R`'s separate stop decision with original unknown and follow-up responsibility. Reference existing source evidence under retention duties; do not replace it with the dashboard.
- **V / =:** “Kit fulfilled; release stopped with unresolved notification” is derived. `R.i1`, `R.i2`, the effect/unknown identities, custodian segment and prior source conclusions remain unchanged.
- **Reader / ?:** A new authorized reader can explain both conclusions, inspect the original unknown and distinguish stopped pursuit from resolved effects. Mail delivery and later native drift remain unknown. An unavailable required kit receipt would block fulfillment rather than be cured by Mira's approval.

## Reader walkthrough and unresolved specification questions

At the last illustrated prefixes, a fresh reader can retrieve original expression and applicable adopted intent, compare revisions, expand the exact completed-false licensing judgment, operational unavailability and outcomes, follow accepted contributions, and distinguish current allocation from execution eligibility. At `R.h8`, the origin remains `R.h1`; a cursor at `R.h3` sees the revision but does not move the tip, revoke later effects or reactivate Ivo. A shared snapshot at `R.h5` is authentic only under its disclosure contract and does not prove it is latest. Live paginated reads must identify their coverage/version; unrelated pages are not an atomic whole-Ledger snapshot. Restricted or missing grounds stay visible as gaps, not summarized into invented consent or safe continuation. None of these reads execute a plan.

Open questions exposed by this witness, **not newly adopted requirements or selected answers**:

1. Which exact record/envelope/reference grammar and atomic acceptance units carry expression, adoption, Work revisions, attempts and conclusions without a redundant record per milestone? How are the symbolic prefix/evidence references encoded and bounded?
2. What selected authority/scope and native binding contracts make the fictional Band, contributor and rehearsal boundaries real? What authenticated contribution and excerpt-license evidence is sufficient, and for how long must it remain available?
3. How does a successor store/admit Ledger selection and conflicts without repurposing closed custody controls or making another Change-history database? How do intent changes invalidate allocation grounds, and what bounded active-set limits fit a real consumer?
4. Which in-flight revision and safe-boundary transfer protocol actually establishes termination/exclusion, custody, confidential grounds, unknown responsibility and interruption recovery? Without that evidence the conditional `R8` path is blocked. Live handoff and ownership transfer remain unselected.
5. What disclosure/redaction protocol preserves meaning and retention while reporting unavailable grounds? Which operations can continue with omitted confidential material, and which must refuse? Plaintext recall is not promised.
6. What real native operation/recovery evidence can resolve the mail unknown? The example deliberately supplies none. What separately authorized reconciliation or compensation is supportable must be decided with that consumer; neither stopped status nor a fork is an answer.
7. What reconstruction, pagination, bounds and retention behavior makes these histories inspectable after interruption? Existing native acceptance controls cannot be inferred from this illustrative successor. Compatibility/migration and release qualification remain separate decisions.

The next specification should resolve these against a selected consumer and the [open contracts](change-format.md#successor-specification-work), not promote this story's premises into a profile by naming APIs. No experiment, native implementation, model dependency, migration or controller handoff is implied.
