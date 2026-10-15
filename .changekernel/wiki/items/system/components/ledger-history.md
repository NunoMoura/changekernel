---
title: Combined Ledger History and Understanding Profile
aliases: []
source-id: cw:component:ledger-history
---
# Combined Ledger History and Understanding Profile

**Historical v5 contract; executable semantic host retired.** Start with the [current referenced-intent prototype](referenced-intent-prototype.md) and [SDK/Pi boundary](sdk.md). This page preserves its consumed schemas, authority, custody, retry and accounting meanings and existing anchors. Implementation-era status, reuse instructions and old-API/test preservation statements below are historical, not an active assignment or perpetual support promise; see the [support disposition and exact source checkpoint](native-profiles.md#historical-compatibility-reference). No old-custody operation or current semantic change is authorized.

**Status: selected contract after correction, independent review and manager adoption.** This is a fresh, bounded producer-to-consumer successor for the [deterministic foundation](../../product/plan.md#foundations-before-agent-integration). Source implementation requires a separate assignment against this contract. This document is not evidence of implementation, release qualification, activation or controller authority.

The [opening](state.md#consumed-opening-profile), [revision](intent-trace.md), [assessment](assessment-trace.md) and [opening-only ledger](ledger-selection.md) profiles remain frozen, including their public APIs, bytes, errors, observation meanings and ceilings. None automatically composes into this profile. Native State remains native; there are no effects, agent runtime, inference, migration, archive, sharing, generic evaluator/query framework, index or cache.

## Consumer, authority and separation

One authenticated fixture owner on one trusted local Linux host creates two independent Changes in one user-owned ledger, directly adopts revised intent and runs the fixed notice-fit Check on one Change. After process exit and fresh reopen, a deterministic client can explain original/current intent and adoption, retained false and true Check assessments, their applicability, a historical position, a bounded operation range and unresolved custody/read limits. The other Change and its creation retry remain independent. This is a Phase-1 witness, not completion of the entire foundation or demonstrated scalable retrieval.

Trusted composition selects `ck-ledger-history@5` before fresh provisioning. Selected public library host: `LedgerHistoryHost`, with the seven dispatchers and closed native construction/guard/fault/work signatures below. The new `run_check` name is subject-first; it does not rename the frozen assessment host's `assess_intent` operation. This is a fixture boundary, not a new executable or transport. Existing hosts refuse the new tags. This host refuses old controls/tags; it does not enroll/copy an old Change, fall back, rewrite versions, dual-write or migrate. Fresh, interrupted-first-use resume and reopen retain the explicit [ledger provisioning modes](ledger-selection.md#durable-controls-and-physical-layout); mode selection never authorizes replacement of missing accepted control.

The trusted grant has exactly these ordered members: `profile,ledger,custody,owner,workspace_id,binding,directory,anchor,grants,policy,check,evaluator,adopter`. The first nine have the [ledger grant](ledger-selection.md#trusted-identities-and-allocation) types/constraints: absolute configured directory and external anchor paths, fixed `owner-1`, `workspace-1`, `fixture@1`, and exactly 16 pregranted `(change,custody)` pairs with independently unique Change and member-custody identifiers, every member custody distinct from ledger custody. They are independent of request data, physical slot and key. `profile` is the new tag. Each grant pair is exactly `change,custody`, both nonnullable identifiers. Configured anchor path is <=4,096 bytes and directory length plus 13 is <=4,096 bytes. The last four are required nonnullable strings, exactly `fixture-notice@1,notice-what@1,utf8-length@1,owner-1`. The authenticated fixture owner explicitly opts into this immutable policy for this new ledger and its pregranted members before first use; reconnect independently supplies the same adoption. Listing, request JSON, matching hashes and this design selection do not adopt policy.

The adopted Check is exactly the [notice-fit definition](assessment-trace.md#one-question-not-a-semantic-intent-judge): exact adopted What has at most 80 raw UTF-8 bytes, without normalization/truncation, excluding Why, JSON framing and LF. The trusted built-in evaluator constructs `passed`, feedback and evidence; a caller cannot supply them. False is a completed result, not failed execution. This policy neither judges goal quality nor requires Why, sends a notice or authorizes effects. General policy definition/adoption, custom execution and session provenance remain unsupported.

Creation and revision are **direct authenticated adoption** of the complete supplied What/Why. The retained input is the exact expression; the backend-established actor and `adoption:"authenticated_direct"` result identify adoption. There is no imported quotation, model interpretation, proposal/consent record or evidence of session authorship. An authenticated caller adopting quoted text adopts that supplied expression, not the claimed author or authenticity of the quote. See [provenance](state.md#intent-commitment-provenance) and [intent adoption](../../product/changekernel.md#intent-capture-and-refinement).

## Concrete source composition boundary

Read-only source inspection identifies mechanisms, not a ready composition. `src/application/ledger.rs` supplies the independently granted collection/member guards and final delivery boundary; `src/adapters/jsonl/ledger/{storage,members,operations,codec,work}.rs` supply concrete namespace/lock/descriptor/incident custody, deferred creation proof, bounded fixed codecs and named-owner accounting. Extend this ledger-selected path cohesively for the fresh profile instead of copying another filesystem backend. Preserve old entry points and select new schemas/semantics privately by trusted profile.

Actual blockers are explicit: `members::member_mode` currently accepts generation only 0/1, compares origin hash/end to the member prefix, and materializes one origin; `metadata` fixes first/last to 1; `operations::read_member` fixes origin/tip/current intent together. The new validator must instead prove an immutable origin slice plus the full longer prefix, then derive current intent and transient record spans. `src/adapters/jsonl/intent_trace.rs::{construct_inner,pass,feasible}` supplies a sequential semantic pattern, but hard-codes `change-1/custody-1` and a different single-slot custody/codec. `src/kernel/changes/intent_trace.rs::logical` also hard-codes Change identity. Those are not reusable by wrapping their public hosts or replacing a JSON tag. Parameterize the concrete new constructor/codec against the independently selected ledger member; factor only consumed shared primitives, retaining old meanings. New mixed-operation decoders, direct-adoption fields, purpose projection and complete-call accounting must be implemented/tested together. No separate context store or generic persistence layer is selected.

## Closed public native composition surface

This is the selected Linux-only library seam at the `changekernel` crate root, not an implementation or executable. It adds only `LedgerHistoryGrantSpec`, `LedgerHistoryGrant`, `LedgerHistoryInput`, `LedgerHistoryMemberPermission`, `LedgerHistoryGuard`, `LedgerHistoryCall`, `LedgerHistoryWork` and `LedgerHistoryHost`. New owning fields are private; no public raw custody, decoded-record constructor, append, policy mutation or generic dispatch is exposed.

Reuse **unchanged** root types `LedgerPair`, `OpeningMode`, `OpeningError`, `LedgerPermission`, `LedgerCollectionPermission`, `LedgerBoundary`, `LedgerIoEvent`, `LedgerIoFault` and `LedgerIoHook`. Their field/variant definitions and old-host behavior stay frozen. In particular, reuse only the three-state decision and collection-permission enums, not `LedgerGuard` or its old member enum; reuse the six-counter boundary value, not `LedgerWork`/`AssessmentWork` or their observer resets. Do not use `LedgerGrant`, `LedgerGrantSpec`, `LedgerInput` or any old public host as a v5 wrapper. `OpeningError` is the native error classification only: its frozen `json()` emits v1 and **must not serialize this profile's v5 dispatch errors**.

### Grant, owning ingress and current guard

The borrowed native installation specification has exactly the following public fields. The ordered grant description above supplies their value constraints; this Rust value is trusted composition input, not JSON ingress.

```rust
pub struct LedgerHistoryGrantSpec<'a> {
    pub profile: &'a str,
    pub ledger: &'a str,
    pub custody: &'a str,
    pub owner: &'a str,
    pub workspace_id: &'a str,
    pub binding: &'a str,
    pub directory: &'a std::path::Path,
    pub anchor: &'a std::path::Path,
    pub grants: &'a [LedgerPair; 16],
    pub policy: &'a str,
    pub check: &'a str,
    pub evaluator: &'a str,
    pub adopter: &'a str,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerHistoryMemberPermission {
    Create,
    Metadata,
    History,
    AdoptIntent,
    RunCheck,
}

pub trait LedgerHistoryGuard {
    fn principal(&self) -> &str;
    fn collection(
        &mut self,
        ledger: &str,
        permission: LedgerCollectionPermission,
    ) -> LedgerPermission;
    fn member(
        &mut self,
        ledger: &str,
        change: &str,
        permission: LedgerHistoryMemberPermission,
    ) -> LedgerPermission;
}
```

`LedgerHistoryGrant` and `LedgerHistoryInput` are opaque, Debug but not Clone, with exactly these public construction/access signatures:

| Type | Signature | Boundary |
| --- | --- | --- |
| Grant | `pub fn new(spec: LedgerHistoryGrantSpec<'_>) -> Result<Self, OpeningError>` | Validate every scalar length before scanning/copying supplied strings/path bytes. Invalid profile/adoption/identities/path/grants ->Unavailable, without filesystem access. Copy only validated bounded values into one independent normalized owning grant; do not clone oversized caller backing capacities or store spec borrows. |
| Input | `pub fn new(bytes: &mut Vec<u8>) -> Self` | Check both caller vector length and capacity <=C before ownership transfer. Success takes that vector without copying, leaving caller vector empty with capacity zero. Failure leaves caller vector unchanged and returns an invalid marker containing only the two supplied-size scalars, no rejected bytes/allocation. This borrow-before-transfer signature lets rejected external capacity be observed without enrolling it into the bounded owning input. |
| Input | `pub fn as_bytes(&self) -> &[u8]` | Accepted owning bytes, or empty slice for invalid marker. Empty accepted input is still invalid JSON at dispatch. |
| Input | `pub fn capacity(&self) -> usize` | Retained vector capacity, or zero for invalid marker. |

Input construction does not parse JSON or authorize. Dispatch of an invalid marker produces the selected v5 invalid_input error without decoding or private access. Caller-owned rejected buffers and spec backing remain external; their sizes and scalar rejection work are observable, not a promise to bound process RSS. Guard/hook captures are trusted-fixture provider state outside the named backend payload; the held callback's Box/trait-object header is separately observed. Holding a boxed hook does not turn arbitrary provider captures/internals into a whole-process bound. After successful transfer/normalization, every participating owning allocation and constructor temporary is charged within the named envelope. No alternate slice constructor hides an oversized owning backing, and no constructor copies unbounded rejected data.

The guard is mutable, synchronous and queried again at each required cut. `Allow` is usable only after checking the guard's **then-current** principal against the bound grant owner; Deny ->Denied, Unavailable ->Unavailable. Invalid principal on an Allow ->Denied. Request/grant/expected-actor binding is stable; returned permission decisions are not. This API creates no lease object, immutable permission snapshot or new external-provider guarantee. A fixture can independently deny AdoptIntent while allowing History/RunCheck, and can change a later decision to revoke final delivery. Trusted guard/hook callbacks must not fork or reenter a new-profile constructor/connect/dispatch on the same thread; passive observation access is allowed.

### Host calls and the fault boundary

`LedgerHistoryHost` is opaque and not Clone. These are its complete public signatures:

| Method | Signature |
| --- | --- |
| Connect | `pub fn connect(grant: LedgerHistoryGrant, mode: OpeningMode, guard: &mut dyn LedgerHistoryGuard, hook: Option<LedgerIoHook>) -> Result<Self, OpeningError>` |
| Connection observation | `pub fn connection_work(&self) -> LedgerHistoryWork` |
| Latest host observation | `pub fn last_work(&self) -> LedgerHistoryWork` |
| Create | `pub fn create_change(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |
| List | `pub fn list_changes(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |
| Select | `pub fn select_change(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |
| Adopt | `pub fn revise_intent(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |
| Run Check | `pub fn run_check(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |
| Range | `pub fn inspect_history(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |
| Context | `pub fn inspect_context(&mut self, json: &LedgerHistoryInput, guard: &mut dyn LedgerHistoryGuard) -> Vec<u8>` |

Each dispatcher enforces its exact named wire variant and returns one canonical LF-terminated v5 success/error Vec, bounded by C, L or Q as selected below. No separate native success/error schema is introduced. Connect consumes the grant, checks current Connect/principal before private custody, uses exactly FreshProvision/ResumeProvision/Reopen, and performs the selected shared-only finish/final authorization. Success preserves an immutable connection snapshot; `last_work()` initially equals it, then preserves that host's latest dispatcher snapshot, including errors/discard, independently of other calls. Failed connect returns only OpeningError, releases reached temporary/owning descriptors/grant/hook before sealing observations, and exposes its full reached work through `LedgerHistoryWork::last_call()` without a host.

The reused hook is exactly `Box<dyn FnMut(LedgerIoEvent) -> LedgerIoFault>`: event fields `scope:u8,phase:&'static str,object:&'static str,step:&'static str`; faults Continue/Io/ShortWrite/Refuse. Scope 0 is shared, 1–16 the private physical slots, never client selectors. Preserve the ledger storage's existing lifecycle cuts: provision/reserve/append/checkpoint/associate/deliver/recover phases; named directory/anchor/control/trace/temporary/barrier objects; before_read/read, before_write/written/short_written, before_sync/synced, before_create/created, before_rename/renamed, before_unlink/unlinked. New history uses those same file cuts, not a second I/O framework. For a would-be private success, `object="reply",step="before",phase="deliver",scope=0` is the whole-response cut **before the final fresh guard checks**, so a hook-driven policy revocation cannot occur after the last check and leak a private Vec. Early invalid/unsupported/denied error paths do not introduce a private-success cut or override the declared error precedence; a discarded success followed by an error does not run this cut twice. Hook Io at a supported before-syscall cut observes an actual I/O failure; Refuse and post-success refusal are deterministic, not permission to retain an incident. ShortWrite is interpreted only at before_write; unsupported fault/cut combinations are deterministic refusal, not observed I/O or incident authority. A trusted test hook may terminate its own process at a cut; returned snapshots cannot establish work after such an exit. None of these hook values is accepted in JSON or grants custody.

### Complete native observations

The new public work value is Clone, Copy, Debug, Default and has exactly the following fields. `LedgerBoundary` is reused solely with its unchanged attempts/completions/matches/no_matches/operand_bytes/schema_words meanings. New-profile field names identify their boundary; there is no old-work aggregate to add or reset. These are trusted-fixture native observations, not JSON Views, disclosure capabilities or permission to expose counters from a suppressed private response to an untrusted client.

```rust
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerHistoryCall {
    Grant,
    Input,
    Connect,
    CreateChange,
    ListChanges,
    SelectChange,
    ReviseIntent,
    RunCheck,
    InspectHistory,
    InspectContext,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct LedgerHistoryWork {
    pub call: Option<LedgerHistoryCall>,
    pub grant_admission: LedgerBoundary,
    pub input_admission: LedgerBoundary,
    pub supplied_input_bytes: u64,
    pub supplied_input_capacity: u64,
    pub permissions: LedgerBoundary,
    pub principals: LedgerBoundary,
    pub permission_denied: u64,
    pub permission_unavailable: u64,
    pub shared_passes: u64,
    pub member_passes: u64,
    pub reads: LedgerBoundary,
    pub buffered_bytes: u64,
    pub trace_bytes: u64,
    pub accepted_hash_bytes: u64,
    pub candidate_hash_bytes: u64,
    pub ingress: LedgerBoundary,
    pub controls: LedgerBoundary,
    pub records: LedgerBoundary,
    pub constructions: LedgerBoundary,
    pub emissions: LedgerBoundary,
    pub control_emissions: LedgerBoundary,
    pub record_emissions: LedgerBoundary,
    pub input_emissions: LedgerBoundary,
    pub candidate_emissions: LedgerBoundary,
    pub reply_emissions: LedgerBoundary,
    pub canonical: LedgerBoundary,
    pub semantic: LedgerBoundary,
    pub typed_input: LedgerBoundary,
    pub relationships: LedgerBoundary,
    pub identifiers: LedgerBoundary,
    pub key_uniqueness: LedgerBoundary,
    pub key_lookup: LedgerBoundary,
    pub key_feasibility: LedgerBoundary,
    pub ordering: LedgerBoundary,
    pub fields: LedgerBoundary,
    pub evaluator_calculations: LedgerBoundary,
    pub check_attempts: u64,
    pub check_acceptances: u64,
    pub projection: LedgerBoundary,
    pub applicability: LedgerBoundary,
    pub copied_record_bytes: u64,
    pub cleanup: LedgerBoundary,
    pub retention: LedgerBoundary,
    pub outputs: LedgerBoundary,
    pub errors: LedgerBoundary,
    pub records_peak: u64,
    pub metadata_vectors_peak: u64,
    pub accepted_vectors_peak: u64,
    pub metadata_entries_peak: u64,
    pub accepted_entries_peak: u64,
    pub grant_vectors_peak: u64,
    pub span_entries_peak: u64,
    pub key_entries_peak: u64,
    pub assessment_entries_peak: u64,
    pub descriptor_handles_peak: u64,
    pub stack_bindings_peak: u64,
    pub inventory_visits: u64,
    pub inventory_buffer_peak: u64,
    pub named_payload_peak: u64,
    pub named_fixed_bytes_peak: u64,
    pub hash_state_bytes_peak: u64,
    pub trace_buffers_peak: u64,
    pub trace_capacity_peak: u64,
    pub accounting_updates: u64,
}
```

Its sole associated access signature is `pub fn last_call() -> Self`. Before any new-profile entry it is Default (`call=None`). Each grant/input constructor, connect and dispatcher starts one independent observed entry and seals a snapshot after its reached failure/disposal or success work. `last_call()` returns the latest completed entry on that thread; it does not reset, perform I/O or mutate lifecycle state. Constructor admission/fields/constructions/normalized owners are included, with S=M=0 and no filesystem/permission work. Rejected input records the supplied size scalars without copying/owning the caller's refused allocation. Constructor and later connect/dispatch are **separate calls**, not added observer totals: later calls rebase the actual retained grant/input/host allocations and account their own reached work; they do not silently drop those capacities or fabricate a second construction. Completed host snapshots remain stable across later constructor calls and out-of-call drops.

Record/control counters are codec boundaries, not canonical/semantic equality. Emissions is the aggregate of the distinct control/record/input/candidate/reply emission categories, counted once per actual emission, not added again as work. Candidate hashing includes selected-prefix, successor and typed-input hashing. Projection counts reached span/size/coverage decisions; applicability counts assessment-subject predicates; copied_record_bytes counts actual borrowed canonical-span copies. Evaluator_calculations includes retained/pending/candidate reconstruction, while check_attempts/acceptances count only the explicitly requested new/resumed Check producer path. Permission boundaries count decisions (matches only Allow); denied/unavailable scalars distinguish its non-Allow outcomes; principal comparisons are separately charged. Outputs/errors distinguish final private delivery/suppression/native or wire errors; a native error return does not imply JSON emission. Inventory, cleanup, incident-retention, failed/partial visitors/emissions, fixed headers/hash state, descriptor disposal and capacity peaks retain the complete-call meanings and ceilings selected below. External guard/hook internals are not a backend RSS/CPU guarantee.

An independent fixture can construct the sixteen public LedgerPair values and this spec, inspect `LedgerHistoryWork::last_call()` after `LedgerHistoryGrant::new`, transfer a mutable bounded request Vec with `LedgerHistoryInput::new` and inspect its constructor snapshot, implement the three-method guard with independent member decisions, then invoke connect with None or the reused boxed hook. On connection Err it can inspect the new static snapshot; on success it can invoke all seven named methods and copy the two host observations. It needs no private constructor, old host, second custody lock, decoded record type, source stub or additional API agreement. The selected surface still requires implementation and independent native witness; this document does not compile or run a producer.

## Identities, serialization and closed values

Ledger/Change/custody/key identifiers use ASCII `[A-Za-z0-9_-]{1,64}`. They are opaque. A Change reference is `<change>:origin` for sequence 1 or `<change>:op:<n>` for canonical decimal `n` from 2 through 128, with no leading zeros; maximum length is 71 bytes. Type and existence come from validated accepted records, not spelling. A grammar-valid foreign Change reference is denied before private lookup.

Ledger creation keys have a permanent ledger-wide namespace across all accepted entries and the one shared reservation. Mutation keys within each accepted Change have one namespace across **creation, revision and Check execution**, including all actors (only the owner is supported). Thus the creation key occupies sequence 1 in that member; the same literal key may be used in another member, but another creation with that ledger key cannot create it. Retry compares the entire typed original request, including version, operation, subjects, predecessor, Check selection, exact What and nullable Why. Null and empty Why differ. Accepted origin/operation references and original attribution never change after subsequent appends or restart. Concretely: A's `create-a` cannot be reused for A revision/Check (conflict); A's `check-a` cannot be reused for A revision (conflict); the same `check-a` literal can identify an independent B mutation; a new collection creation can use literal `rev-a` because member mutation keys do not occupy the collection creation namespace. The original `create-a` remains reserved ledger-wide and occupies A's member namespace permanently.

Every schema below is closed and ordered as listed. Every listed field is required; only explicitly marked fields are nullable. Integers are unsigned JSON integers, not floats/strings/coercions; booleans are JSON booleans. Arrays exist only where declared with finite limits. Reject duplicates (including nullable fields), unknown fields, missing/forbidden fields, incorrect types/bounds, arbitrary nesting, unknown operation/version pairs and trailing non-whitespace input. Bound the whole request before decoding; decide the complete variant mask without early return on `v` or `op`. Supported variants on the wrong dispatcher are unsupported. Old-profile pairs are not recognized variants on this host and are invalid_input. No input accepts actor, adoption, policy, evaluator, passing flag, feedback, evidence, physical paths, result or raw append.

Canonical retained bytes use the [opening formatter/codec](state.md#implementation-boundary-and-evidence-gate): explicit ordered structs, compact UTF-8 JSON, unescaped solidus, unsigned minimal decimal, every control escape as lowercase `\u00xx`, ordinary required quote/backslash escapes, exactly one terminal LF. Valid requests may have different member order/JSON spelling; compare decoded values, not raw ingress. Retained controls/records must equal exact canonical re-emission. Canonical input digests hash complete canonical requests including LF. Prefix digests hash exact canonical record lines including each LF; SHA-256 is lowercase 64-hex byte evidence under custody, never permission/authentication by itself. Reuse existing pinned dependencies; no new runtime dependency is selected.

### Request variants

All have `v:5`. Exact ordered schemas:

| Dispatcher | Fields after `v,op,ledger,workspace_id` | Values/constraints |
| --- | --- | --- |
| `create_change` | `key,what,why` | Valid key; nonblank What <=65,536 UTF-8 bytes; Why required null or string <=65,536 bytes. Backend chooses the next unused grant/slot, not request Change. |
| `list_changes` | `cursor,limit` | Cursor required null or `ListCursor`; limit 1–4. |
| `select_change` | `change` | Valid opaque Change identifier; metadata selection, not a continuation grant. |
| `revise_intent` | `change,key,expected_intent,what,why` | Valid key/reference/text; directly adopts exact replacement What/Why. |
| `run_check` | `change,key,expected_intent,check` | Valid key/reference; Check name ASCII `[A-Za-z0-9_@-]{1,64}`; only adopted `notice-what@1` can execute. |
| `inspect_history` | `change,at,from,limit` | `at` and `from` required null or Change reference; limit 1–4. Null at selects current accepted tip; null from selects origin. |
| `inspect_context` | `change,at,purpose` | At required null or Change reference; purpose exactly `understanding`. |

`ListCursor` is exactly `v,ledger,workspace_id,after,limit`, all nonnullable, v5, valid accepted Change `after`, limit 1–4 equal to parent limit. Foreign ledger/Workspace is denied; mismatched limits invalid_input. It is a live authorized keyset seek, not a capability or historical snapshot. All other request subjects must match the trusted ledger/Workspace. No old `open_change`, `inspect_change`, `inspect_intent` or `inspect_assessment` dispatcher is added; range/context are their minimal new consumed read boundary.

### Results and operation records

All result fields are required nonnullable, except where a nested shape explicitly allows null. `CommonResult` denotes ordered fields `v,kind,ledger,workspace_id,change,key,actor,result,seq`; v5, actor from the trusted authenticated owner, result the deterministic logical operation reference, seq 1–128. This notation is schema composition, not a JSON field/base object.

- Created result: `CommonResult,adoption`, kind `created`, seq 1/result `<change>:origin`, adoption `authenticated_direct`.
- Revised result: `CommonResult,intent,previous_intent,adoption`, kind `intent_revised`; result/intent is the new operation reference; previous_intent is the current adopted intent **before** this operation; adoption `authenticated_direct`.
- Check assessment result: `CommonResult,intent,policy,check,evaluator,passed,feedback,evidence`, kind `intent_assessed`. Intent is the current adopted intent at this historical operation. Policy/Check/evaluator are the adopted exact identities. Feedback is `fits` iff true, otherwise `shorten_or_use_other_channel`. Evidence is exactly `intent,field,utf8_bytes,limit`, with the same intent, field `what`, unsigned exact historical What byte count, limit 80. No uncertainty/confidence/effect receipt is invented.

An operation record is exactly `v,custody,ledger,workspace_id,binding,change,seq,prev,kind,input,result`, v5 throughout. Custody and subjects match the independently granted member. `prev` is required null only at seq 1, otherwise the immediately preceding operation reference, **not necessarily previous intent**. Kind/result/request agree: created embeds the complete create request (no Change field); revision/assessment embed their complete mutation request. Reconstruct every result from retained input, actor and sequential historical state and compare every field. Created/revised set current intent; assessment does not. Every accepted operation has a unique key in this member. Only seq 1 is created.

Error envelope is exactly `{"v":5,"kind":"error","code":<code>}`, code one of `invalid_input,unsupported,denied,conflict,unavailable`. Errors are not accepted operations or proof that no earlier acceptance occurred. Never accompany an error with private result/count/progress/text.

## Controls, permanent creation association and writer discipline

Reuse the ledger's concrete namespace/provisioning/custody machinery, not its single-origin validator. New tags are `ck-ledger-history-anchor@5`, `ck-ledger-history-incident@5`, `ck-ledger-history-creations@5`, `ck-ledger-history-member-anchor@5`, `ck-ledger-history-member-prefix@5`, `ck-ledger-history-member-incident@5`. Do not reinterpret any old tag.

The new shared anchor has exactly ordered fields `format,ledger,custody,workspace_id,binding,owner,directory,directory_device,directory_inode,lock_device,lock_inode,members_device,members_inode,grants,stage,policy,check,evaluator,adopter`. Compare anchor grants sequentially against the independent array and borrow it for canonical re-emission; do not allocate a second owning grant vector. Member anchor has exactly `format,custody,ledger,workspace_id,binding,change,owner,key,directory,directory_device,directory_inode,lock_device,lock_inode,stage,policy,check,evaluator,adopter`. Types/physical/path/stage/provisioning relationships are the [ledger controls](ledger-selection.md#durable-controls-and-physical-layout) under these new tags; last four fields equal the trusted adoption. Neither grant/tag/path nor content alone proves custody: descriptor-pinned directory/lock/parent identities and independent associations must agree.

Shared creation control is exactly `format,custody,ledger,generation,entries,pending`. Generation is exactly `3*entries.len()` with pending null, plus 1 for reserved or 2 for ready (0–48 for 16 creations), not member operation count. Any other generation/phase combination is damage. Entries is at most 16 permanent associations; pending is required null or one creation reservation. An association is exactly `slot,key,change,custody,actor,input_sha256,origin_end,origin_sha256,physical`; a reservation is exactly `slot,input,actor,phase,physical`. Slot is 1–16; phase `reserved` with physical null or `ready` with physical present. Physical is exactly `directory_device,directory_inode,lock_device,lock_inode`, all unsigned. Input is a complete create request; actor owner-1; installed entries are contiguous granted slots with globally unique key/Change/custody and pinned physical tuple. Shared control only accepts completed, validated creation; it never grows for revision/assessment.

**Association selects the immutable origin slice `[0,origin_end)`, not the later member tip.** Origin_end is positive <=C and origin_sha256 hashes that one LF-inclusive origin line. It must agree with seq-1 record, original typed-input digest, creation result, key, Change/custody/actor, independent grant/installed member anchor/physical tuple and inclusion in the validated member prefix. After longer appends it is valid for member checkpoint generation >1, end >origin_end and full-prefix digest different from origin_sha256. Never update the association to the tip, reconstruct it from an unassociated file, or compare its origin digest to the whole-history digest. Creation retry finds the shared accepted key, opens that exact authorized member, validates its entire accepted prefix/pending and returns its **original seq-1 result** after final barriers; it neither appends nor rewrites origin grounds.

Member checkpoint is exactly `format,custody,change,generation,end,sha256,pending`. Generation is accepted operation count 0–128. At zero, end 0/hash null; above zero, positive end <=A and required lowercase SHA-256 of `[0,end)`. Pending is required null or exactly `input,actor`; input is the complete reserved create/revise/assess request, actor independently established owner-1. Pending does not alter count/end/hash. Accepted replacement adds one exact canonical reserved record and clears pending. No current-intent pointer, retry table or context cache becomes acceptance control.

Shared/member incidents use exactly the [ledger clear and blocked incident shapes and enums](ledger-selection.md#durable-controls-and-physical-layout) under their new tags: clear `format,custody,state`; blocked `format,custody,state,phase,issue`. Clear/blocked strings, phase `provision,reserve,append,checkpoint,associate,deliver,recover` and issue `io,short_write,barrier,inconsistent` retain their meanings. A blocked/malformed incident or incident temporary refuses private operations monotonically in that scope. No clear overwrite, reset, repair or incident deletion is supported.

Namespace remains external anchor plus ledger `writer.lock,creation.json,incident.json,members/` and known `creation.tmp,incident.tmp`; each member has its external `m-<slot>.anchor.json` and `m-<slot>/writer.lock,trace.jsonl,checkpoint.json,incident.json`, with known checkpoint/incident temporaries. Initial anchor temporaries are only legal at their declared initial-only proof boundaries. Unknown entries, copied/moved directories, missing locks/controls or replaced physical identities refuse. Hold permanent cooperative ledger exclusion; acquire at most one scoped member lock/descriptor set at a time, close it before another. Trusted owning processes must not fork, and successor connection requires predecessor exit. This is not hostile same-user protection or a multi-file transaction.

### Creation and subsequent acceptance

Creation retains the ledger's original sequence: durably reserve original key/input/actor in shared control; provision the independently assigned member and justify its physical tuple; install ready reservation; durably reserve/append/accept the origin in member custody; freshly validate member/shared/anchors and barriers; finally install shared accepted association and clear shared pending. Member origin alone is not ledger membership. Lost acknowledgment returns the old result on an authorized original-key retry. A new creation key cannot bypass an unresolved reservation or allocate a second identity for the old request.

Shared `creation.tmp` relationships remain equal, prospective reserve, ready, or accept as in the ledger protocol. Connect performs shared structural classification only (no member access); a ready/accept temporary remains deferred, not promoted or erased. Ordinary reads/unrelated mutations refuse unresolved physical/acceptance proof. Only exact authorized creation retry may prove the reserved member/origin, run independent barriers and revalidation, clean the known temporary with parent synchronization, then continue using installed control. A temporary never becomes selected truth. Even an old accepted retry cannot bypass this unresolved shared-proof gate. Proven equal/reserve shared remnants remain untouched by reads.

For an accepted member's new revision/assessment: validate all accepted grounds and pending feasibility, establish current permissions, resolve accepted key first, then pending key, then new predecessor/Check/capacity. Durably replace checkpoint to reserve exact input/actor before append; append only missing bytes of its canonical next record; synchronize trace/directory; validate the full candidate; replace checkpoint selecting that exact successor; synchronize checkpoint/directory; freshly revalidate installed shared/member/anchor conjunction and current guards before delivery. Revision/assessment changes no shared association or other member. There is no ledger-wide atomic lifecycle commit.

Installed pending must be feasible **before private reads, retries, cleanup or append**: unused member key; valid complete mutation and pinned subjects/actor; count <128; expected_intent equals historical current intent (for assessment the adopted Check matches); checked deterministic next record <=C and end+length<=A; physical suffix empty or its exact byte-prefix. Generation-zero create pending additionally requires the matching installed shared ready reservation; accepted shared entries require generation >=1 and pending may only be revision/assessment. A reservation at exhausted count/byte capacity, malformed/foreign input, already accepted key, impossible result or mismatching suffix is damaged custody, even if a temporary equals installed bytes. Preserve evidence, disclose nothing, do not clean. Feasible count 127 ->128 and exact byte equality are supported.

Only an exact authorized pending retry can finish it. Known member checkpoint temporary must be equal installed control, a feasible prospective reservation against intact installed prefix, or the exact accepted successor of feasible installed pending plus complete canonical suffix. It is not selected. **Reads and accepted-result retries never clean it.** Cleanup requires current mutation permission and successful request feasibility before touching names. A prospective reservation temporary may be removed only for the exact incoming input/actor it contains; an accepted-successor temporary or an equal control with installed pending may be removed only by the exact installed-pending retry. An equal installed control with pending null may be removed by an otherwise feasible authorized new mutation. Another input cannot erase a prospective reservation: return unavailable. After authorized removal, synchronize parent and freshly validate installed custody; prospective reservation cleanup does not adopt its input, which must be reserved through the normal installed-control sequence. Unexplained temporary refuses all private responses. Creation/revision/assessment cleanup shares the full-call budget, with no loop until stable.

A bounded suffix without pending after positive accepted count does not become history. Intact accepted reads/old exact retries may be delivered with `blocked_unaccepted_tail`; new mutation is unavailable. Feasible pending permits accepted reads/old retries with `blocked_pending`, taking precedence over suffix. At generation zero there is no accepted private view. Changed/missing accepted bytes, failed semantic validation, impossible pending, oversized retained storage or incident are unavailable, not partial historical disclosure or repair.

Short writes, genuine observed I/O/barrier faults or uncertain replacement latch unavailable immediately in their scope, before acceptance-bearing response. Attempt at most one bounded scope-correct blocked incident replacement/parent sync; failure leaves the live latch. Shared damage/incident blocks collection and every member; member damage/incident blocks that member and permitted listing, not independent authorized selection of an intact other member. Denied member custody is not accessed. Expected lock contention is not automatically an incident. Full coherent rollback or lost incident observations cannot be detected if all evidence disappears; ordinary source tests do not prove power-loss durability or hostile rollback protection.

## Authorization and error precedence

Use trusted current collection gates `Connect,Create,List` and member gates `Create,Metadata,History,AdoptIntent,RunCheck`. Deny/wrong authenticated principal yields denied; unavailable policy yields unavailable. Collection creation requires Create; collection list requires List; targeted requests require Connect. New creation/completion additionally requires member Create and History; list/selection require Metadata and History; history/context require History; new revision/pending completion additionally AdoptIntent; new Check/pending completion additionally RunCheck. Old result retry requires current History, not reauthorization to perform an already accepted adoption/Check. Creation retry retains collection Create to match its dispatcher. No permission is inferred from history, a Check pass, an adopted policy or a returned selector. Fixture grants do not add general delegation/multi-user behavior.

Bind immutable authorization grounds throughout each call: the independently granted expected owner/ledger/Workspace/Change, validated typed request and original actor selected for any reservation. These grounds are not a permission lease or cached Allow. Query the guard anew at every declared authorization cut, check its current principal against the expected owner after each Allow decision, and suppress private delivery on fresh Deny, wrong principal or Unavailable. No stronger atomic lease/external-provider freshness guarantee is selected. Authorize before any member private lookup/custody. Recheck relevant guards immediately before reservation/acceptance and before delivery. Check history authorization before returning conflict/existence information. For list, denied members are excluded without opening them; any unavailable gate or permitted damaged member suppresses the entire page. Recheck every candidate's Metadata/History decision, including excluded/out-of-page members: previously permitted ->deny yields denied, unavailable yields unavailable, denied ->permitted yields unavailable rather than an internal rescan. A targeted request need not inspect another accepted member.

Ordered dispatch boundaries:

1. Bound/decode/end-check complete closed input ->invalid_input. Valid recognized variant on wrong dispatcher ->unsupported, before private work.
2. Current collection/principal/ledger/Workspace gates, embedded reference/cursor association checks ->denied/unavailable before private lookup. Resolve target/granted member and current disclosure before its access; no accepted target ->unavailable. For create, resolve accepted/shared-pending key before allocating.
3. Shared custody/control/incident/inventory and deferred-proof gate, then authorized member custody, full prefix and complete pending/remnant relationships ->unavailable on damage/uncertainty. No private bytes escape a failed conjunction. Known remnants are validated, not automatically cleaned.
4. Accepted key comparison precedes new predecessor, Check selection, pending, suffix and capacity. Exact original request ->original retained result after final validation/gates, even with later operations, full capacity, feasible pending or bounded unexplained suffix. Changed input/kind ->conflict. Never relabel attribution or reevaluate into a new result.
5. Pending same key changed input ->conflict; exact original input alone may complete with mutation permission. Any other new key ->unavailable. Shared unresolved proof restrictions from step 3 still apply.
6. For genuinely new revision/Check establish its current mutation permission, then require accepted origin and exact current intent; stale/nonintent expected reference ->conflict. Then unknown well-formed Check ->unsupported, unaccepted suffix ->unavailable, exhausted count/byte capacity ->unsupported before reservation. New creation similarly rejects shared capacity before reserve; installed impossible pending is damage, not unsupported client input.
7. Read of absent/out-of-range accepted position ->unavailable. A historical assessment reference is valid as a **cursor/version**, but not an intent predecessor. A range starting after its selected version ->unavailable. Context oversized required material ->explicit limited context below, not guessed completeness.
8. Fresh barriers/full revalidation and final current guards/delivery cut ->error only if denied/unavailable; destroy private output. Acceptance already installed is not undone by denied delivery. A later authorized exact retry obtains its original result. Failed/discarded/error/incident work is included in observations.

## Version-bound navigation and understanding

`origin` always means seq-1 grounds. `tip` means the latest accepted operation in the **live installed member checkpoint** of this serialized call. `cursor` means the requested historical boundary (`at`, or live tip when null). Neither read moves tip, finishes pending, accepts a temporary, runs/accepts a new Check or executes work. Full-prefix validation does recompute the fixed deterministic expected outcome for retained Check assessments (and feasible pending/candidate proof); count every such calculation. This proves recorded semantics, not a newly executed/accepted assessment, a model call or reconstruction of a missing decision. Reads, reconnect, list and selection never initialize/clean lifecycle files or change names/bytes/generation; synchronization/locks are allowed. Only genuinely observed I/O/barrier failure may attempt the bounded incident-only mutation described above.

Define `Prefix` exactly `first,last,end,sha256`, all nonnullable unsigned/string; first 1, last accepted count, end exact byte end, digest exact LF-inclusive prefix. Every successful `inspect_history` or `inspect_context` response carries both `accepted:Prefix` for the full installed checkpoint and `selected:Prefix` for records 1 through cursor. Metadata-only `select_change` and list members carry only their declared `member.accepted`/`Metadata.accepted`; they select no historical cursor or second prefix. Historical selected digest/end are computed from validated immutable record spans; they are derived read evidence, not an older checkpoint selected for writing. Validate the **entire live accepted prefix** even for an old cursor; later corruption is not ignored. Original identities make a nonnull cursor stable after appends; disclosure remains current. No token authenticates custody. A repeated historical request reproduces selected facts/digest under the same interpretation but may show a newer live tip/progress.

`progress` is exactly `ready,blocked_pending,blocked_unaccepted_tail` (pending first). It describes append custody only, not admission/completion/effects. All response references share pinned ledger/Workspace/Change. All returned records are complete canonical accepted operations; no unaccepted tail or fabricated native/session evidence enters a View.

### Metadata, list and selection

`Metadata` is exactly `change,origin,actor,accepted,progress`, all nonnullable, accepted the live Prefix from full member validation, actor from original creation. No What/Why, private key/custody/path, hidden count or current-intent text is metadata. `Selection` is exactly `v,kind,ledger,workspace_id,member`, v5/kind `selection`, member Metadata. `Page` is exactly `v,kind,ledger,workspace_id,order,members,next`, v5/kind `change_page`, order `change_asc`, members <=4 Metadata, next required null or ListCursor. Use the [ledger's live keyset semantics](ledger-selection.md#authorized-working-set-pages-and-cursors): scan all <=16 currently permitted accepted members, **now validate their entire longer histories**, sort bytewise Change identifier, return authorized entries strictly after cursor.after, emit next only for a further permitted entry. Terminal page may be empty. No total/denied identities/pending counts/global snapshot digest. Full permitted-member validation cost is explicit, not claimed cheap listing.

### Bounded range

`HistoryView` is exactly `v,kind,ledger,workspace_id,change,projection,origin,tip,cursor,accepted,selected,records,coverage,next,progress`. V5/kind `history_view`, projection `ck-ledger-history-range@1`; records is an ordered array of at most four complete records. `coverage` is exactly `first,last,returned,complete`, all nonnullable: first/last are the actual first/last returned sequence, returned their count, complete means **the requested suffix from resolved from through selected.last has no further records**, not a complete Change/ledger/native snapshot. No empty range is returned; absent origin/start or start>cursor ->unavailable.

Resolve null from to origin. Return the longest contiguous prefix of that suffix satisfying limit and `sum(record_line_lengths)<=Q-16,384`; each individual record fits, so at least one is returned. This conservative fixed envelope allowance is part of the profile, not arbitrary truncation. Copy validated complete record objects (omit their individual LF inside the JSON array); preserve every field. If more remain, next is the complete `inspect_history` request schema with at set to the resolved **nonnull cursor**, from set to the next operation reference, same subjects/limit. Otherwise next is null and complete true. Pagination never silently follows a newer tip. Failed applicability is not a range filter. Navigation coverage tells exactly what was returned; accepted/selected tell what was validated/bound.

### One understanding purpose

`ContextView` is exactly `v,kind,ledger,workspace_id,change,projection,purpose,origin,tip,cursor,current_intent,accepted,selected,adoption_scope,adopted_check,records,assessments,coverage,gaps,progress`. V5/kind `change_context`, projection `ck-ledger-understanding@1`, purpose `understanding`. Current_intent is the last created/revised record **at cursor**, not necessarily the live current intent; tip/accepted still describe live custody. Adoption_scope exactly `authenticated_direct_only`.

`adopted_check` is exactly `policy,check,evaluator,adopter,field,limit`, all nonnullable; values from independent/pinned policy adoption, field what/limit 80. It describes this fixture adoption, not arbitrary executable policy or actor consent imported from a session.

The minimal projector requires **all supported records 1 through cursor**, including original/current text, every attributable direct adoption and every true/false Check assessment. There is no relevance filter, favorable-only summary or hidden intermediate revision. It is intentionally a bounded sequential baseline, not a compact semantic summary. Assessments is an ordered array <=127 of exactly `assessment,intent,applicability`, all nonnullable refs/string; applicability `current` iff that result.intent equals current_intent at cursor and pinned policy/check/evaluator match, otherwise `historical`. Multiple assessments of one intent stay distinct. Revision invalidates prior applicability even if replacement text is identical. A historical cursor before revision can legitimately show an assessment current there without certifying live intent. Later operations remain outside this selected View, accessible via a new request; not falsely included as cursor facts.

`coverage` is exactly `required,returned,complete`, nonnullable count/count/bool. Required equals selected.last, returned equals records.len(). `gaps` is an array of at most one `Gap`, exactly `code,first,last,required_bytes,budget`, all nonnullable. Normally all required record lines total <=B, where B=`Q-65,536`; return all required records and all assessment entries, returned=required/complete=true/gaps empty. The fixed 65,536 allowance covers all bounded references/applicability entries/envelope; it is explicitly larger than the range allowance.

If selected.end>B, return **no records or assessment entries**, returned 0/complete false, and one gap code `required_material_limit`, first 1/last selected.last/required_bytes selected.end/budget B. Preserve the version-bound references/descriptor/coverage/progress, not partial text labeled complete. A client can obtain exact material via range pages, but must assemble every required record under that same cursor before claiming complete understanding. Limit is not absent evidence, false Check or authority to drop failures. Missing/corrupt accepted grounds yields unavailable, not this size-limit response. Unknown external/session/native evidence is unsupported by this closed profile and excluded by adoption_scope/purpose; neither an empty gaps array nor complete=true promises it. The client must state that limitation when explaining provenance.

## Finite work and named owners

Selected bounds (not measurements or inherited successor permissions): C=1,048,576 for each request/result/record/control; A=16,777,216 accepted bytes/member; T=17,825,792 total trace/member including suffix; Q=2,097,152 history/context response; L=65,536 page/selection. Each includes final LF where emitted. What/Why <=65,536 bytes each; at most 128 accepted records/member, 16 nonrecyclable ledger slots, one shared creation pending, one member pending/member, page/range limit 1–4. The host's bounded owning ingress rejects both length and backing allocation capacity above C before decoding; a short slice backed by an oversized owning buffer is not an unobserved allocation exemption. New construction/control feasibility must hold before reservation; exact equality is allowed. Oversized existing storage refuses/preserves. Read buffers stop at limit+1 sentinel. No retry-until-stable, unbounded EINTR/short-read loop, implicit evaluator run, recursive inventory or revalidation hidden outside the call.

Use ledger-style complete-call logical observations, separately named for this profile, without changing old counters/meaning. Attempts, completions, matches/nonmatches, one-sided available operand bytes and schema words are distinct. A false comparison is reached work; a failed decode/emission/construction still charges reached buffers/owners. Canonical equality charges max operand length; typed equality charges max summed string/byte payload plus scalar/schema words; suffix proof charges only its guarded compared range. These are conservative available ranges, not actually scanned bytes, CPU instructions, disk traffic or RSS. No extra passes, clones or emissions merely to pad/account work.

Let S and M be entered shared/member validation passes across the **whole call**, including cleanup, candidate and delivery/failure passes. Chosen conservative ceilings: S<=16; M<=64 total; non-list create/targeted mutation/read/retry M<=16 on one member. List normally has two sequential sweeps of <=16; creation includes deferred proof/provisioning, reserve/ready/member acceptance/shared acceptance and delivery inside its ceilings. Connection has S<=16/M=0 and never opens a member. Ordinary deferred-proof refusal has M=0. These are maxima to verify against source, not a demand to perform that many passes.

| Work/owner | Finite whole-call bound and required charge |
| --- | --- |
| Ingress / authority | <=1 complete closed ingress decode attempt and <=256 current collection/member permission-decision attempts per call, including cursor and every permitted/excluded/out-of-page member's final decision. Charge reached false/denied/unavailable outcomes and disposal. Owning ingress/partial visitor/bound-authorization-ground payload belongs to the named capacity envelope; this is not a bound on arbitrary external policy-provider internals. |
| File reads | <=`4*S*(C+1)+M*(4*(C+1)+(T+1))+32*(C+1)` buffered bytes. Include independent anchor/control/temp/trace, limit sentinel, failed partial reads and <=32 extra provisioning/remnant/incident reads. Incident-temp refusal does not continue normal validation. |
| Hashing | Accepted <=`M*A`; selected/candidate/successor/input hashing <=`M*(A+4*C)+32*C`. Hash historical selected spans in the existing sequential pass where possible; additional traversal is counted, not hidden as metadata. |
| Controls / record codecs | Control decode/re-emission attempts each <=`4*S+4*M+32`; accepted/candidate record decode/re-emission attempts each <=`128*M+32`. Rejected shapes/canonical mismatch count attempts; emissions only if reached. Final output copying validated record spans charges actual copied bytes <=Q, not an uncounted codec/reconstruction. |
| Domain/result constructions | <=`2*128*M+16*(S+M)+256` whole owning assemblies, including decode assemblies, reconstructed expected records, producer/pending candidate, independent clones, outputs/errors/incident. Sequential expected result validation is distinct from accepted evaluator execution; count deterministic validation calculations separately from new/resumed Check attempts. Accepted retry produces no new accepted run. |
| Key/association predicates | Shared <=`152*S+512` bounded identifier predicates plus <=256 ordering predicates. Member uniqueness <=8,128/pass (128*127/2), lookup/feasibility <=256/pass, total <=`8,384*M+512`. Do not inherit the ledger's one-record key bound. Typed original input comparisons <=`16*M+32` on payload operands <=C, separate from key equality. |
| Canonical/semantic/relationship predicates | Canonical <=`4*S+(128+4)*M+64`; reconstructed semantic <=`128*M+32`; pending/temp/control/physical relations <=`16*S+16*M+64`. Small schema/map/presence/field checks <=`512*(1+4*S+132*M+32+256)`. Include actual reached scalar/array-element loops and refused name ranges. |
| Fixed evaluator calculations | <=`128*M+32` attempted deterministic outcome calculations, including retained assessment reconstruction, feasible pending/prospective/successor proof and new candidate. Record their reached completions independently. One requested new/resumed Check operation attempt and at most one acceptance per dispatch; zero such attempts/acceptances on reads or accepted retries, even when retained validation performs calculations. No inferred run count from a codec or calculation completion. |
| Projection | Track <=128 canonical spans/key entries/current-intent state and <=127 assessment descriptors for one member, never all decoded prose. No rescan of earlier text to validate each Check: running current What byte count reconstructs every historical result. Context/range size predicates and copying <=128 spans; descriptor applicability <=127 comparisons/call. Selected prefix hashes and copied response bytes are separately charged. |
| Output/error | One private result/page/range/context emission <=its declared ceiling, optionally discarded, plus one error emission <=C. Decide context limit/range packing from validated lengths before emission; no overflow-emission/retry loop, truncation or private/error mix. Canonical control/candidate emissions remain separately charged above. |
| Inventory / cleanup / incident | Root <=7 entry visits, members parent <=34, scoped member <=7 per pass, counting first refusal; bounded OS names <=255 bytes. At most one cleanup per known control/anchor per call at its authorized proof boundary, then fresh validation; no read cleanup. At most one nonrecursive incident-retention attempt per failed call; all its reads/constructs/codecs/comparisons are already included above. |
| Named live allocation capacities | <=64 MiB across caller ingress, pinned grant/anchor/path strings, partial visitors, decoded shared/control/pending/input, deferred candidate <=C plus its reread overlap, <=two traces each <=T+1, <=two owning selected/producer/expected records total, canonical candidates, output/error, inventory strings, span/key/assessment descriptors and metadata. One grant vector exactly16, one accepted vector<=16, one metadata vector<=16/L; span/key/assessment metadata <=65,536 bytes. Reserve growth/slack and clones count; Vec.clear is not deallocation. Release member/pass objects before another member; stream response from validated spans rather than clone every decoded record. |

The 64-MiB selection requires an explicit owner schedule, not a sum of old observers: at most `2*(T+1)` trace capacity (about 34 MiB), Q private output plus C error plus C ingress (4 MiB), at most `24*C` for all other live decoded/partial-visitor/record/pending/control/deferred/read/emitter/candidate owners, and <=`2*L` for remaining bounded path/grant/key/span/assessment/metadata/inventory payload. This conservative envelope is below 64 MiB; sentinel/slack/clone capacity must remain charged within it. Sequentially release expected/decoded record owners and control scratch before delivery reread; emit records from validated borrowed spans rather than retain a decoded context vector. An implementation must demonstrate the real simultaneous schedule, including refused malformed values and discarded responses; this arithmetic is not evidence that existing source already satisfies it.

Observe fixed object/visitor/mask/hash headers, descriptor handles, local bindings and counter updates separately; no whole-process stack/RSS/allocator/latency guarantee. Newly enlarged trace buffers must fit the explicit simultaneous capacity budget including preflight retained during delivery and discarded output/incident error paths, not rely on single-buffer arithmetic. Connection charges initial controls/adoption validation/candidate input hash and any failed-host disposal within S/M=0 and extra allowances; later deferred physical proof belongs to exact create, not connection. Raise a failed ceiling only through contract review, never silent relabeling.

Publish actual complete-call permission decisions, reads, hashes, codecs, construction owners, retained/candidate evaluator calculations versus requested/accepted Check operations, comparisons/outcomes, projection/copy bytes, passes, inventory, cleanup/retention and simultaneous capacities. Include cold/warm reopen/read, full permitted 16-member list with longer histories, maximum valid text, near count/byte capacity, old retry, pending/remnant recovery, false/stale/denied/malformed/oversized and final-response-suppressed paths. Latency is measured separately under declared host/filesystem/artifact/workload. Full validation is O(accepted bytes) per pass; sequential key uniqueness can be quadratic within 128. No scalable/constant-time/cheap-tail claim follows from finite ceilings.

## Lifecycle example and falsifiers

These are complete illustrative canonical values, not runtime evidence. Each shown JSON line has one terminal LF. The independent grant assigns slot 1 to `alpha-c/member-a`, slot 2 to `beta-c/member-b`, plus fourteen other distinct unused pairs; ledger custody is `ledger-custody`. The host pins physical identities and explicit owner adoption before dispatch.

### 1. Create A

```json
{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-a","what":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","why":"Keep original reason"}
{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"create-a","actor":"owner-1","result":"alpha-c:origin","seq":1,"adoption":"authenticated_direct"}
{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":1,"prev":null,"kind":"created","input":{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-a","what":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","why":"Keep original reason"},"result":{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"create-a","actor":"owner-1","result":"alpha-c:origin","seq":1,"adoption":"authenticated_direct"}}
```

### 2. Create independent B

```json
{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-b","what":"Record backup cleanup","why":null}
{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"beta-c","key":"create-b","actor":"owner-1","result":"beta-c:origin","seq":1,"adoption":"authenticated_direct"}
{"v":5,"custody":"member-b","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"beta-c","seq":1,"prev":null,"kind":"created","input":{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-b","what":"Record backup cleanup","why":null},"result":{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"beta-c","key":"create-b","actor":"owner-1","result":"beta-c:origin","seq":1,"adoption":"authenticated_direct"}}
```

### 3. Run Check on original A: completed false

```json
{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","expected_intent":"alpha-c:origin","check":"notice-what@1"}
{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","actor":"owner-1","result":"alpha-c:op:2","seq":2,"intent":"alpha-c:origin","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":false,"feedback":"shorten_or_use_other_channel","evidence":{"intent":"alpha-c:origin","field":"what","utf8_bytes":81,"limit":80}}
{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":2,"prev":"alpha-c:origin","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","expected_intent":"alpha-c:origin","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","actor":"owner-1","result":"alpha-c:op:2","seq":2,"intent":"alpha-c:origin","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":false,"feedback":"shorten_or_use_other_channel","evidence":{"intent":"alpha-c:origin","field":"what","utf8_bytes":81,"limit":80}}}
```

### 4. Directly adopt revised A

```json
{"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","expected_intent":"alpha-c:origin","what":"Trim local defaults","why":null}
{"v":5,"kind":"intent_revised","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","actor":"owner-1","result":"alpha-c:op:3","seq":3,"intent":"alpha-c:op:3","previous_intent":"alpha-c:origin","adoption":"authenticated_direct"}
{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":3,"prev":"alpha-c:op:2","kind":"intent_revised","input":{"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","expected_intent":"alpha-c:origin","what":"Trim local defaults","why":null},"result":{"v":5,"kind":"intent_revised","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","actor":"owner-1","result":"alpha-c:op:3","seq":3,"intent":"alpha-c:op:3","previous_intent":"alpha-c:origin","adoption":"authenticated_direct"}}
```

### 5. Run Check on revised A: completed true

```json
{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","expected_intent":"alpha-c:op:3","check":"notice-what@1"}
{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","actor":"owner-1","result":"alpha-c:op:4","seq":4,"intent":"alpha-c:op:3","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":true,"feedback":"fits","evidence":{"intent":"alpha-c:op:3","field":"what","utf8_bytes":19,"limit":80}}
{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":4,"prev":"alpha-c:op:3","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","expected_intent":"alpha-c:op:3","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","actor":"owner-1","result":"alpha-c:op:4","seq":4,"intent":"alpha-c:op:3","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":true,"feedback":"fits","evidence":{"intent":"alpha-c:op:3","field":"what","utf8_bytes":19,"limit":80}}}
```

A record lengths including LF: 584, 772, 633, 739; accepted end 2728; SHA-256 `936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b`. Origin-only association end 584/digest `099d715384f574290ea0c713157eaa5dfdcdd33e0b236f11afafef73c9ab844e` remain unchanged after all appends. Canonical creation-input digest is `96667ba547be290393ac260ac0146db48b886a44850147845b6f3cb28f696134`. B remains one record/end 503/digest `fa7df6d45e7c58380f03113a572c6bede2ebc35abd80bfb5411b4d4a33a4119c`.

### 6. Exit, reopen and understand

Close every owning descriptor and confirm predecessor process exit. A fresh host connects using the same independent profile/grant/adoption/physical custody; it performs no member scan/cleanup/Check on connect. Dispatch this context request. Its complete response retains the original 81-byte expression, the exact 19-byte revision, both attributable direct adoptions and both Check results:

```json
{"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","at":null,"purpose":"understanding"}
{"v":5,"kind":"change_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","projection":"ck-ledger-understanding@1","purpose":"understanding","origin":"alpha-c:origin","tip":"alpha-c:op:4","cursor":"alpha-c:op:4","current_intent":"alpha-c:op:3","accepted":{"first":1,"last":4,"end":2728,"sha256":"936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b"},"selected":{"first":1,"last":4,"end":2728,"sha256":"936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b"},"adoption_scope":"authenticated_direct_only","adopted_check":{"policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","adopter":"owner-1","field":"what","limit":80},"records":[{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":1,"prev":null,"kind":"created","input":{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-a","what":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","why":"Keep original reason"},"result":{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"create-a","actor":"owner-1","result":"alpha-c:origin","seq":1,"adoption":"authenticated_direct"}},{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":2,"prev":"alpha-c:origin","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","expected_intent":"alpha-c:origin","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","actor":"owner-1","result":"alpha-c:op:2","seq":2,"intent":"alpha-c:origin","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":false,"feedback":"shorten_or_use_other_channel","evidence":{"intent":"alpha-c:origin","field":"what","utf8_bytes":81,"limit":80}}},{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":3,"prev":"alpha-c:op:2","kind":"intent_revised","input":{"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","expected_intent":"alpha-c:origin","what":"Trim local defaults","why":null},"result":{"v":5,"kind":"intent_revised","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","actor":"owner-1","result":"alpha-c:op:3","seq":3,"intent":"alpha-c:op:3","previous_intent":"alpha-c:origin","adoption":"authenticated_direct"}},{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":4,"prev":"alpha-c:op:3","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","expected_intent":"alpha-c:op:3","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","actor":"owner-1","result":"alpha-c:op:4","seq":4,"intent":"alpha-c:op:3","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":true,"feedback":"fits","evidence":{"intent":"alpha-c:op:3","field":"what","utf8_bytes":19,"limit":80}}}],"assessments":[{"assessment":"alpha-c:op:2","intent":"alpha-c:origin","applicability":"historical"},{"assessment":"alpha-c:op:4","intent":"alpha-c:op:3","applicability":"current"}],"coverage":{"required":4,"returned":4,"complete":true},"gaps":[],"progress":"ready"}
```

The fresh client explains: original notice payload did not fit; original Why `Keep original reason` remains retained; owner directly adopted `Trim local defaults` with absent Why; Check on that exact revision fits. The false result remains historical, not erased. The true result is current only for the selected intent/policy/Check/evaluator, not a native effect, permission or goal-quality verdict. Session authorship/proposal provenance and native outcome are unsupported, not inferred. Storage progress ready is not lifecycle fulfillment.

### 7. Historical navigation without moving tip

At `alpha-c:op:2`, selected prefix end 1356/digest `c923d8e578f08f7ab5fac3bd57f9d37d82dfffd7dca8ccbd31011bdbcc779850`. Current intent in context at that cursor is origin; false assessment op:2 is current there, not for live op:3. Live tip remains op:4. A one-record page and its version-bound next request are:

```json
{"v":5,"op":"inspect_history","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","at":"alpha-c:op:2","from":null,"limit":1}
{"v":5,"kind":"history_view","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","projection":"ck-ledger-history-range@1","origin":"alpha-c:origin","tip":"alpha-c:op:4","cursor":"alpha-c:op:2","accepted":{"first":1,"last":4,"end":2728,"sha256":"936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b"},"selected":{"first":1,"last":2,"end":1356,"sha256":"c923d8e578f08f7ab5fac3bd57f9d37d82dfffd7dca8ccbd31011bdbcc779850"},"records":[{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":1,"prev":null,"kind":"created","input":{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-a","what":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","why":"Keep original reason"},"result":{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"create-a","actor":"owner-1","result":"alpha-c:origin","seq":1,"adoption":"authenticated_direct"}}],"coverage":{"first":1,"last":1,"returned":1,"complete":false},"next":{"v":5,"op":"inspect_history","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","at":"alpha-c:op:2","from":"alpha-c:op:2","limit":1},"progress":"ready"}
```

Following next returns op:2 only, coverage first/last 2/returned 1/complete true/next null, same selected prefix and cursor even if later appends advance live tip. A context at that cursor must include records 1–2 and classify op:2 current; a context at null includes all four and classifies it historical.

Selecting the old assessment as a returned record under prefix op:4 differs from projecting context as of op:2. Both complete requests/responses are:

```json
{"v":5,"op":"inspect_history","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","at":"alpha-c:op:4","from":"alpha-c:op:2","limit":4}
{"v":5,"kind":"history_view","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","projection":"ck-ledger-history-range@1","origin":"alpha-c:origin","tip":"alpha-c:op:4","cursor":"alpha-c:op:4","accepted":{"first":1,"last":4,"end":2728,"sha256":"936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b"},"selected":{"first":1,"last":4,"end":2728,"sha256":"936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b"},"records":[{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":2,"prev":"alpha-c:origin","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","expected_intent":"alpha-c:origin","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","actor":"owner-1","result":"alpha-c:op:2","seq":2,"intent":"alpha-c:origin","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":false,"feedback":"shorten_or_use_other_channel","evidence":{"intent":"alpha-c:origin","field":"what","utf8_bytes":81,"limit":80}}},{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":3,"prev":"alpha-c:op:2","kind":"intent_revised","input":{"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","expected_intent":"alpha-c:origin","what":"Trim local defaults","why":null},"result":{"v":5,"kind":"intent_revised","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"rev-a","actor":"owner-1","result":"alpha-c:op:3","seq":3,"intent":"alpha-c:op:3","previous_intent":"alpha-c:origin","adoption":"authenticated_direct"}},{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":4,"prev":"alpha-c:op:3","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","expected_intent":"alpha-c:op:3","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-b","actor":"owner-1","result":"alpha-c:op:4","seq":4,"intent":"alpha-c:op:3","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":true,"feedback":"fits","evidence":{"intent":"alpha-c:op:3","field":"what","utf8_bytes":19,"limit":80}}}],"coverage":{"first":2,"last":4,"returned":3,"complete":true},"next":null,"progress":"ready"}
{"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","at":"alpha-c:op:2","purpose":"understanding"}
{"v":5,"kind":"change_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","projection":"ck-ledger-understanding@1","purpose":"understanding","origin":"alpha-c:origin","tip":"alpha-c:op:4","cursor":"alpha-c:op:2","current_intent":"alpha-c:origin","accepted":{"first":1,"last":4,"end":2728,"sha256":"936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b"},"selected":{"first":1,"last":2,"end":1356,"sha256":"c923d8e578f08f7ab5fac3bd57f9d37d82dfffd7dca8ccbd31011bdbcc779850"},"adoption_scope":"authenticated_direct_only","adopted_check":{"policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","adopter":"owner-1","field":"what","limit":80},"records":[{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":1,"prev":null,"kind":"created","input":{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-a","what":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx","why":"Keep original reason"},"result":{"v":5,"kind":"created","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"create-a","actor":"owner-1","result":"alpha-c:origin","seq":1,"adoption":"authenticated_direct"}},{"v":5,"custody":"member-a","ledger":"ledger-1","workspace_id":"workspace-1","binding":"fixture@1","change":"alpha-c","seq":2,"prev":"alpha-c:origin","kind":"intent_assessed","input":{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","expected_intent":"alpha-c:origin","check":"notice-what@1"},"result":{"v":5,"kind":"intent_assessed","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","key":"check-a","actor":"owner-1","result":"alpha-c:op:2","seq":2,"intent":"alpha-c:origin","policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","passed":false,"feedback":"shorten_or_use_other_channel","evidence":{"intent":"alpha-c:origin","field":"what","utf8_bytes":81,"limit":80}}}],"assessments":[{"assessment":"alpha-c:op:2","intent":"alpha-c:origin","applicability":"current"}],"coverage":{"required":2,"returned":2,"complete":true},"gaps":[],"progress":"ready"}
```

The range returns exactly op:2–op:4 under the bound op:4 prefix, excluding origin from its returned coverage. It is not complete understanding. The historical context returns original adoption and op:2 only, current_intent origin and that assessment current at op:2; live accepted/tip remain op:4, and no future adoption is imported into the historical explanation.

### 8. Original retry and other-member independence

Repeat the exact `create-a` request, or exact `check-a` request, after reopen. Deliver their displayed seq-1/seq-2 results unchanged; A end/digest/count stay fixed, the shared origin association stays fixed, no Check is newly executed or accepted. A new key carrying expected origin after revision conflicts without reservation. B still selects as:

```json
{"v":5,"op":"select_change","ledger":"ledger-1","workspace_id":"workspace-1","change":"beta-c"}
{"v":5,"kind":"selection","ledger":"ledger-1","workspace_id":"workspace-1","member":{"change":"beta-c","origin":"beta-c:origin","actor":"owner-1","accepted":{"first":1,"last":1,"end":503,"sha256":"fa7df6d45e7c58380f03113a572c6bede2ebc35abd80bfb5411b4d4a33a4119c"},"progress":"ready"}}
```

Shared accepted creation associations remain two; A history count is four, B one. All physical tuples and complete controls must independently validate; these JSON values alone cannot manufacture acceptance. Successful read/reconnect/accepted-retry byte-and-name snapshots must stay identical, excluding advisory locking/barriers and a genuinely observed incident-only I/O-fault path.

### 9. Explicit material limit, not absent failure

This separate illustrative extension (not an extra positive-witness requirement or a producer run) adds 20 direct revisions, seq 5–24, keys `large-5` through `large-24`, each What exactly 65,536 ASCII `x` bytes and Why exactly 65,536 ASCII `y` bytes. Seq 5 names op:3 as previous intent; every subsequent revision names the preceding revision. All original records remain. Its 24 canonical record lines total 2636540 bytes, below A but above B=2,031,616. An understanding request at null yields this complete, bounded **limited** response:

```json
{"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","at":null,"purpose":"understanding"}
{"v":5,"kind":"change_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"alpha-c","projection":"ck-ledger-understanding@1","purpose":"understanding","origin":"alpha-c:origin","tip":"alpha-c:op:24","cursor":"alpha-c:op:24","current_intent":"alpha-c:op:24","accepted":{"first":1,"last":24,"end":2636540,"sha256":"73dad98d092e639aac7b811afcbb5157f5e470a0894dec1bbc32235c2f4a407a"},"selected":{"first":1,"last":24,"end":2636540,"sha256":"73dad98d092e639aac7b811afcbb5157f5e470a0894dec1bbc32235c2f4a407a"},"adoption_scope":"authenticated_direct_only","adopted_check":{"policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1","adopter":"owner-1","field":"what","limit":80},"records":[],"assessments":[],"coverage":{"required":24,"returned":0,"complete":false},"gaps":[{"code":"required_material_limit","first":1,"last":24,"required_bytes":2636540,"budget":2031616}],"progress":"ready"}
```

The accepted/selected prefix is still fully validated. No records or applicability entries are selectively returned; the gap covers all required operations, including both earlier Check assessments. Exact range pages at op:24 can supply required material for a deterministic client, but complete false cannot be ignored. A broken/missing accepted control would instead produce unavailable, not this limit envelope.


Required source witnesses after contract adoption use the actual host dispatch and real disposable filesystem, not format-wording tests or a parallel permanent validator. Under the four-operation example, these are concrete counterexamples with observable outcomes (current guards/custody must first permit reaching the stated boundary):

| Challenge | Required outcome |
| --- | --- |
| New `run_check` key `check-c`, expected origin after A4; or new revision expecting assessment A4 | conflict, no reservation; current intent is A3, not origin or live operation tip. |
| Exact old `check-a` or `create-a` after A4/full capacity/lost acknowledgment/final delivery denial | Original displayed A2/A1 result, unchanged actor/reference; no append, new Check or creation-association movement. Validation calculations still count. Changed typed input or cross-kind key reuse conflicts first. |
| Re-adopt identical A3 text under a new valid key | A new intent identity; A4 is historical for that version despite equal text. Two explicit Check runs on one intent remain two results, not overwritten/implicitly aggregated. |
| A request naming B's expected/cursor/from reference, even with a matching key | denied before private member lookup; no imported subject/retry state. A mutation cannot touch B's controls/bytes. A copied/moved directory or altered custody/grant refuses continuation. |
| Range from A2 through A4 versus context at A4 versus context as of A2 | First returns only A2–A4 under selected prefix A4, not complete understanding. Context at A4 retains A1/A3 and both assessments, A2 historical/A4 current. Context as of A2 includes only A1/A2, A2 current there; live tip still A4. Prefix A3 has no assessment applicable to A3. |
| Valid required material above B, or a hidden failed Check far from tip | Explicit limited context, no returned record shortlist, complete false/gap; range navigation remains bounded. Corrupt/missing accepted required grounds instead produce unavailable, never an invented pass, “no earlier failure” or consent. |
| Omit Why, duplicate Why:null, insert actor/evaluator/passed, unknown purpose/projection field, old request pair | invalid_input at the declared complete shape boundary; no mutation or private output. Null versus empty Why stays distinct. A well-formed unknown Check on a genuinely new current-intent request is unsupported. |
| Old/corrupt/missing anchor/checkpoint, changed origin slice under a valid-looking later tip, unexplained temporary or impossible installed pending | unavailable/preserve; no association/receipt reconstruction, prefix salvage, cleanup or invented complete context. Replacing origin association with tip end/hash is not a repair. |
| Successful reconnect/read/context/range/metadata/accepted retry with a feasible pending or proven remnant | Byte/name/generation snapshots unchanged; accepted coverage plus explicit progress, no completion/cleanup/acceptance/new Check/effect. Prospective/successor proof is not selected truth. Only the declared exact authorized mutation path can clean it. |
| Initial History denial/unavailability; final revocation after private output construction | denied/unavailable error only; private output discarded, no error-plus-record mixture. Earlier accepted operations stay accepted; listing/context/cursors never confer later disclosure. |
| Denied A in list; permitted unavailable A; damaged member A with intact independently authorized B | Denied A is never opened or exposed as a missing count. Permitted unavailable A suppresses the whole page. B can still select/read if shared custody/proof is intact. Shared incident/damage blocks all. |
| Deterministic damage/denial/invalid input/contention versus genuine observed read/barrier fault | Deterministic refusal writes no incident or lifecycle state. Genuine fault suppresses response/latches scope, attempts at most one bounded incident-only retention. Failed retention leaves a live guarantee and explicit restart lost-observation risk, not claimed durable refusal. |

Retain process-exit, competing cooperative writer, reservation/append/control/namespace/barrier/cleanup failure cuts, short/partial/full matching pending suffix, bounded unexplained tail, failed incident retention, and equality/overflow of every selected count/byte/work capacity. An impossible pending defeats equal temporary/candidate proof even at exhausted capacity. Full valid capacity remains readable/exact-retryable. Counter-observations must include rejected/discarded output paths, complete permitted-member listing sweeps and retained evaluator validation; this contract does not establish a source implementation or test result.

Routine source checks and [release qualification](package.md#qualification) remain separate. Contract adoption alone authorizes neither source implementation nor live model/privileged experiments, installs, controller use or release activation.
