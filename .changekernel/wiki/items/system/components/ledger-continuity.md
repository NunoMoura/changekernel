---
title: Linux and Btrfs Ledger Continuity
aliases: []
source-id: cw:component:ledger-continuity
---
# Linux and Btrfs Ledger Continuity

**Historical v6 contract; executable semantic host retired.** Start with the [current referenced-intent prototype](referenced-intent-prototype.md) and [SDK/Pi boundary](sdk.md). This page preserves its consumed schemas, authority, custody, retry and accounting meanings and existing anchors. Implementation-era status, reuse instructions and old-API/test preservation statements below are historical, not an active assignment or perpetual support promise; see the [support disposition and exact source checkpoint](native-profiles.md#historical-compatibility-reference). No old-custody operation or current semantic change is authorized.

## Authority, outcome and status

**Adopted source contract; not qualification evidence.** Implementation acceptance and current execution state are recorded in the temporary status note and Git, not maintained on this requirements page. This page selects one consumed continuity contract for the [first Linux/btrfs dogfood target](../../product/plan.md#first-dogfood-target-and-initial-sharing-scope). It does not authorize implementation, installation, host events or controller use. The [ledger-history](ledger-history.md), [opening-only collection](ledger-selection.md) and [historical native profiles](native-profiles.md) remain frozen, including APIs, bytes, errors, counter meanings and ceilings.

An independently provisioned user-owned ledger must retain the same Changes, originating ownership, attribution, exact accepted histories, intent/assessment applicability and original request/result associations across clean process restart and ordinary reboot or supported remount at the same configured namespace. Authorized historical reads must not start Work, append assessments, repair anchors or adopt another copy. A useful successor must reopen the actual original custody, not refuse every post-reboot ledger.

The contract replaces **persistent** device/inode equality with a btrfs filesystem ID and bounded native object handle. It retains independent grant/owner/Workspace associations and separate **live** named/held device/inode equality. Paths, labels, hashes, mount IDs, inode numbers alone and copied controls never become continuation authority. Identity is neither permission nor accepted-history integrity nor durability evidence.

The earlier changed-device observation motivates this proposal but its cause remains unexplained. Source analysis, upstream semantics, a fake identifier and a clean-process test are not actual reboot/remount qualification. Failure of the useful positive witness blocks advancement; no weaker fallback is selected.

## Support domain and finite identity guarantee

The first concrete native binding is Linux **x86_64, little-endian, LP64**, ordinary local btrfs, with the reviewed Linux v6.12 syscall/UAPI and non-parent btrfs-export semantics. This pins the reviewed mechanism, not a claim that the installed kernel is v6.12 or qualified. A different kernel build with those semantics requires exact-subject support evidence; another ABI/encoder needs a separately reviewed binding. Unsupported ABI/build admission refuses before private filesystem work. Filesystem type/facility/descriptor availability is learned from held objects, possibly after exclusive first-use creation; the failure aftermath below must not be confused with a call-level zero-mutation promise. Reuse the pinned `libc = 0.2.189`, Serde and SHA-256 dependencies; no new dependency, privileged service, executable or transport is selected.

Supported custody objects are actual directories (including a btrfs subvolume-root directory when its exact subject passes the same handle contract) and permanent regular writer-lock files. Normal readable directory descriptors and normal read/write lock descriptors are used, not `O_PATH`. All persisted objects of a ledger must report the same FSID; root IDs inside their opaque handles may differ. Ordinary single-device and multi-device filesystems, existing subvolumes and the metadata-UUID feature are not categorically excluded. Each deployment must qualify its actual configuration and unchanged ordinary mount behavior; mutable metadata UUID is never an alternative key. No filesystem/subvolume discovery, feature repair or fallback is performed.

These are **configuration/threat exclusions**, not conditions this pair of APIs can fully detect: compromised trusted host; hostile same-privilege/privileged writers; arbitrary image cloning, duplicate-image registration/temporary-FSID configurations, snapshot restoration into continuing custody, complete protected-evidence rollback/loss, filesystem repair/UUID replacement and arbitrary external namespace substitution. They are outside the already selected ordinary-continuity boundary, not permission to weaken it. Upstream `volumes.c::find_fsid_by_device` can cause an in-memory temporary FSID in a particular single-device non-seeding registered-device collision; the selected acquisition does not attest that this configuration is absent. Trusted composition and exact-host qualification must establish the ordinary configuration. A whole filesystem image clone mounted alone can reproduce every observed identity; this contract does not detect it. A proposal or implementation that needs another exclusion from ordinary continuity must report that blocker for product/safety review.

The export token contains an inode object ID, subvolume root object ID and **32-bit exported generation** in native opaque bytes. It is a finite generation-qualified token, not an infinite birth nonce or cryptographically unique identifier. Ordinary copied/reflinked objects and snapshots normally change object/root identity; matching bytes alone do not justify them. Arbitrary generation collision, coherent identity/evidence rewriting and complete rollback are not claimed detectable. Cross-endian transport, cross-architecture migration and arbitrary future encoder changes are unsupported. A configured-path rename is not supported relocation even when a handle stays equal. Hardlinks and mount aliases can preserve native identity; existing no-follow path validation, regular-file `nlink == 1`, fixed grant spelling and live binding remain mandatory. No hostile mount-namespace defense is inferred.

The external anchor parent retains its existing role: independently configured, protected, securely opened, held and synchronized local custody. It is **not a sixth persisted object**. It may be on another supported local filesystem; only ledger/member objects require btrfs identity. Its configured namespace/protection must remain intact across the event. The anchor file, parent, Trace and replaceable checkpoint/creation/incident files do not acquire permanent inode/handle pins. Their contents, relationships, regular/no-follow checks, accepted bytes and barriers remain the controls. Ordinary control replacement intentionally changes its inode. Parent relocation/replacement or lost independent anchor custody is not silently repaired or re-enrolled.

## Closed fresh profile and native API

Select fresh-only **`ck-ledger-continuity@6`**. It carries the complete model-free v5 collection/direct-adoption/fixed-Check/history/context semantics, with the explicit substitutions below. This is not automatic composition, migration, import, copying of an accepted slot into new enrollment, tag rewriting or an old host wrapper. Fresh provisioning requires an independently unused grant and absent installation; old existing paths/controls refuse unchanged. Resume is interrupted first use with intact surviving preparing enrollment only. Reopen never captures replacement identities or initializes missing controls. Old hosts refuse v6; this host refuses all v1–v5 controls/requests. Frozen hosts and `opening/storage.rs::id` must not change.

### Installation, input and current guard

The following new types are exported at the `changekernel` root on Linux. Grant/input/host have private owning fields, are Debug but not Clone, and expose no raw custody, append, decoded-record constructor, policy mutation or generic dispatcher. The new observer is independent of all old thread-local observers.

```rust
pub struct LedgerContinuityGrantSpec<'a> {
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
pub enum LedgerContinuityMemberPermission {
    Create, Metadata, History, AdoptIntent, RunCheck,
}

pub trait LedgerContinuityGuard {
    fn principal(&self) -> &str;
    fn collection(&mut self, ledger: &str,
                  permission: LedgerCollectionPermission) -> LedgerPermission;
    fn member(&mut self, ledger: &str, change: &str,
              permission: LedgerContinuityMemberPermission) -> LedgerPermission;
}
```

Reuse unchanged `LedgerPair`, `LedgerPermission`, `LedgerCollectionPermission`, `OpeningMode`, `OpeningError`, `LedgerBoundary` and `LedgerIoEvent`. Do not reuse `LedgerHistoryGrant/Input/Host/Guard/Work` as public wrappers. Grants have exactly the [v5 constraints](ledger-history.md#grant-owning-ingress-and-current-guard), with profile replaced: sixteen distinct unused Change/custody pairs, owner/adopter `owner-1`, Workspace `workspace-1`, binding `fixture@1`, policy `fixture-notice@1`, Check `notice-what@1`, evaluator `utf8-length@1`; directory length plus 13 <=4,096 and external anchor length <=4,096. Path spellings are unchanged canonical absolute UTF-8/no-control/no-dot/no-symlink inputs. Scalar size checks precede scanning/copying. No trust assertion or credentials enter JSON.

Exact constructors/accessors:

```rust
impl LedgerContinuityGrant {
    pub fn new(spec: LedgerContinuityGrantSpec<'_>) -> Result<Self, OpeningError>;
}
impl LedgerContinuityInput {
    pub fn new(bytes: &mut Vec<u8>) -> Self;
    pub fn as_bytes(&self) -> &[u8];
    pub fn capacity(&self) -> usize;
}
impl LedgerContinuityHost {
    pub fn connect(grant: LedgerContinuityGrant, mode: OpeningMode,
                   guard: &mut dyn LedgerContinuityGuard,
                   hook: Option<LedgerContinuityIoHook>) -> Result<Self, OpeningError>;
    pub fn connection_work(&self) -> LedgerContinuityWork;
    pub fn last_work(&self) -> LedgerContinuityWork;
    pub fn create_change(&mut self, json: &LedgerContinuityInput,
                         guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
    pub fn list_changes(&mut self, json: &LedgerContinuityInput,
                        guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
    pub fn select_change(&mut self, json: &LedgerContinuityInput,
                         guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
    pub fn revise_intent(&mut self, json: &LedgerContinuityInput,
                         guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
    pub fn run_check(&mut self, json: &LedgerContinuityInput,
                     guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
    pub fn inspect_history(&mut self, json: &LedgerContinuityInput,
                           guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
    pub fn inspect_context(&mut self, json: &LedgerContinuityInput,
                           guard: &mut dyn LedgerContinuityGuard) -> Vec<u8>;
}
```

The semicolon signatures describe the selected surface, not compiled implementations. Input preserves the v5 borrow-before-transfer rule: admit length **and capacity** <=C, then take without copying, leaving an empty capacity-zero caller Vec; rejection leaves it untouched and retains only size scalars in an invalid marker. Dispatch of that marker is v6 invalid_input with no decode/private work. Grant validation normalizes bounded owning values rather than cloning oversized backing capacities. Constructors perform no native acquisition or filesystem/permission work.

### Wire and interpretation mapping

The [v5 closed schemas](ledger-history.md#identities-serialization-and-closed-values), ordered masks, text/reference bounds, null-versus-empty distinction, typed-input retry comparison, canonical formatter and LF rules apply **exactly after this finite mapping**. The new host recognizes only these mapped schemas; it never tries a v5 decoder fallback.

| Boundary | v6 value/meaning |
| --- | --- |
| Profile / all wire `v` fields, including embedded input/result/cursor/next | `ck-ledger-continuity@6` / unsigned integer 6 |
| Dispatchers | The seven named methods above; the same seven `op` strings and exact variant field masks as v5 |
| Created/revised/assessment result and operation-record schemas | Same ordered fields as v5, every embedded `v` 6; direct adoption `authenticated_direct` remains exact |
| References/key namespaces | Unchanged `<change>:origin`, `<change>:op:<2..128>`, ledger-wide creation keys and per-member mixed-operation keys; identities belong to fresh v6 custody, not old namespaces |
| ListCursor, Metadata, Prefix, Page, Selection, HistoryView, ContextView, coverage/gaps/applicability/progress | Same ordered fields and semantics as v5, with nested wire version 6; no new private identity field in Views |
| Range projection | `ck-ledger-history-range@2` |
| Understanding projection | `ck-ledger-understanding@2`; purpose `understanding`, adoption_scope `authenticated_direct_only` |
| Error | Exactly `{"v":6,"kind":"error","code":CODE}` plus LF; CODE is `invalid_input,unsupported,denied,conflict,unavailable`; no private mixture |
| Native construction/connect errors | Reuse `OpeningError` classification only; never serialize its frozen v1 `json()` as a v6 response |

The fixed trusted notice Check still counts adopted What's exact raw UTF-8 bytes against 80, excludes Why/framing, retains both false and true results and does not judge intent quality or effects. Creation/revision directly adopt supplied expression; they do not prove session authorship, quoted provenance or consent beyond authenticated adoption. Complete context requires all accepted records 1..cursor, not favorable-only selection. Range pagination pins its nonnull resolved cursor; context above B returns no records/assessments, complete false and the exact required_material_limit gap. Accepted tip, selected historical prefix and current intent at cursor remain distinct. Metadata/list keep all-or-nothing permitted-member validation and live keyset semantics, not snapshot pagination or a metadata cache.

## Persistent representation and control mapping

Every native identity has this **exact ordered** JSON object. Values below show spelling/length only, not an enrollment receipt:

```json
{"mechanism":"btrfs-fsid-fh@1","fsid":"0123456789abcdef0123456789abcdef","handle_type":77,"handle_bytes":20,"handle":"00112233445566778899aabbccddeeff00112233"}
```

All five fields are required and nonnullable. Mechanism is the literal `btrfs-fsid-fh@1`; FSID is exactly 32 lowercase hex characters representing the 16 bytes from FS_INFO in byte order; handle is exactly 40 lowercase hex characters representing the returned 20 native bytes without endian conversion or decoding. Type is unsigned JSON integer **77**, byte count unsigned integer **20**. Reject uppercase, UUID punctuation, alternate spelling/length/type/mechanism, floats/coercions, missing/duplicate/unknown fields or noncanonical retained spelling. FSID and handle must not be all-zero. This is a closed token, not arbitrary hex text or a general handle registry. The `128` below is scratch capacity only, not an admitted handle length. A later encoder change requires a successor, not admission of another successful type.

Internally use a private fixed raw identity with only `[u8;16]` FSID and `[u8;20]` opaque handle (36 bytes). Mechanism/type/length are closed constants, checked before constructing that type, not owning strings or mutable per-token alternatives. Do not retain owning hex Strings or a Vec per identity. For v6 identity values specifically, a consumed fixed-text parser/seed reads unescaped mechanism/hex values from bounded borrowed input; require the exact literal/length, refuse an escape or excess character before copying, and decode directly to the fixed arrays. Ordinary retained field names still use the existing <=96-byte key path. This is a required v6-only parser change: current `Parser::string` allocates an extent-sized temporary String before a generic visitor sees it, so a generic String visitor is not this bounded identity decoder. Stack hex formatting and all reached/refused predicates/scratch remain charged; no frozen parser behavior changes. Full raw equality compares all 36 bytes plus fixed schema/type/length words. Mount ID, st_dev, inode-only, metadata UUID, filesystem generation, device count and UAPI reserved bytes are never persistent fields or fallback keys.

New format tags are exactly:

```text
ck-ledger-continuity-anchor@6
ck-ledger-continuity-creations@6
ck-ledger-continuity-incident@6
ck-ledger-continuity-member-anchor@6
ck-ledger-continuity-member-prefix@6
ck-ledger-continuity-member-incident@6
```

All controls retain the v5 namespace, stages, generation equations, acceptance/pending relationships and canonical formatter, with these exact field substitutions:

| Control | Exact ordered fields / substitution |
| --- | --- |
| Shared anchor | `format,ledger,custody,workspace_id,binding,owner,directory,directory_identity,lock_identity,members_identity,grants,stage,policy,check,evaluator,adopter`. Each identity is the closed object above; grant array stays independently compared/borrowed, not a second owning vector. |
| Member anchor | `format,custody,ledger,workspace_id,binding,change,owner,key,directory,directory_identity,lock_identity,stage,policy,check,evaluator,adopter`. |
| Physical pair inside shared reservation/association | Exactly `directory,lock`, each the closed identity; replaces the old four-scalar physical tuple everywhere. |
| Shared creations | `format,custody,ledger,generation,entries,pending`; accepted entry stays `slot,key,change,custody,actor,input_sha256,origin_end,origin_sha256,physical`; reservation stays `slot,input,actor,phase,physical`. Reserved physical null; ready physical the pair. All embedded inputs v6. |
| Member prefix | `format,custody,change,generation,end,sha256,pending`; pending null or exactly `input,actor`, input v6. |
| Incidents | Clear `format,custody,state`; blocked adds `phase,issue`. Existing phase/issue/state enums and monotonic scope semantics remain exact. |

Shared root, permanent shared lock and permanent members directory are the three shared persisted objects. Each member adds exactly its directory and permanent lock. All three shared FSIDs agree; each member pair's FSIDs agree with the enrolled shared FSID. The latter relation is a detectable admission/revalidation predicate, not a guessed common-filesystem assumption. Distinct objects are not merged because FSIDs match. The entire member pair agrees between member anchor, installed ready reservation/accepted association and independently acquired current descriptors. Generation/prefix hashes and original typed input/actor/results must independently agree.

Association still selects the immutable **origin slice**, not the current tip. Longer revisions/assessments do not rewrite origin_end/origin_sha256 or physical pair. A parseable origin, matching digest or available Git copy cannot rebuild missing creation/anchor/checkpoint controls. Identity failure is unavailable, never absence or a reusable slot.

## Descriptor acquisition, sites and ordering

After secure no-follow opens, object-kind/link checks and the required nonblocking writer locks, acquire each persistent object from **that held normal fd**, with no pathname lookup inside acquisition:

1. One initialized `fstatfs(fd, ...)` attempt; require `f_type == 0x9123683e` (btrfs). A mismatch refuses before ioctl/handle. Existing fd/type checks also reject O_PATH, non-directory directory roles and nonregular/multiply linked lock roles.
2. One `ioctl(fd, BTRFS_IOC_FS_INFO, &args)` attempt. On this ABI the request is **`0x8400941f`** (`_IOR(0x94,31,1024)`). Use a zero-initialized `repr(C)` 1024-byte struct: ordered `u64 max_id,num_devices; [u8;16] fsid; u32 nodesize,sectorsize,clone_alignment; u16 csum_type,csum_size; u64 flags,generation; [u8;16] metadata_uuid; [u8;944] reserved`. Flags are zero. Copy only the exact FSID; no metadata-UUID request/fallback or mutable ancillary field participates in persistent equality.
3. One `name_to_handle_at(fd, "", &handle, &mount_id, AT_EMPTY_PATH)` attempt. Use aligned initialized storage with `u32 handle_bytes=128`, `i32 handle_type=0`, `[u8;128]` zero scratch and a separate initialized `i32` mount-ID cell. Flags are only `AT_EMPTY_PATH` (`0x1000`), not FID, parent, symlink-follow or unique-mount-ID variants. Require successful return, type77/length20 and valid nonzero payload. Discard mount ID and unused bytes. Never resize/retry on EOVERFLOW.

No `open_by_handle_at`, capabilities, shell, `btrfs` command, mount command, object search, fd handoff, auto-discovery, size negotiation or retry on EINTR/EAGAIN occurs. Failed/malformed acquisition produces no identity. This bounds application attempts/buffers, **not syscall latency, kernel internal work, CPU time or RSS**. Kernel/seccomp/LSM denial and absent facilities can make the operational result unavailable; they do not authenticate or deny the user in the domain.

The ordinary ioctl path includes `security_file_ioctl`; ordinary file/directory operations route FS_INFO into btrfs, whose reviewed branch has no capability/write gate. Empty-path identification has no capability requirement in the reviewed syscall path. This supports an unprivileged mechanism hypothesis, not universal installed-host availability. Normal secure opens and trusted current domain authorization remain separate prerequisites.

### Acquisition cuts

| Site | Required scope, order and use |
| --- | --- |
| Fresh shared provisioning | Current Connect/principal before private paths. Exclusive root/lock/members creation and ledger lock precede native capture; complete three-object identity precedes writing preparing anchor or initial controls. If capture fails after exclusive creation, preserve orphan bytes/names, do not return an installed host. |
| Resume shared / Reopen / every entered shared validation pass | Current collection gate first. Secure current root/lock/members and live binding, then one fresh three-object set against surviving preparing/installed anchor. No recapture as enrollment. Structural creation.tmp proof follows intact shared control; M=0 and no member handle/acquisition on connect. |
| Fresh member provisioning | Installed shared reservation, exact input/key, current member Create+History, exclusive directory/lock and ledger→member lock precede two-object capture. Capture precedes preparing member anchor; installed anchor+initial custody must validate before pinning ready pair. |
| Member resume / every member validation pass | Current required member permissions before private open/acquisition. Live member directory/lock binding, fresh pair, exact member anchor and ready/accepted shared pair precede prefix/history/pending/remnant delivery or cleanup. Preparing initial-only resume uses its original anchored pair, never a newly enrolled replacement. |
| Deferred ready/acceptance shared temporary | Connect classifies only bounded installed/shared structural relationship. Exact original authorized create alone acquires/proves the pending member, including physical pair and initial or complete-origin state; repeat shared/member/barrier proofs before unlink/sync and after cleanup. Never promote candidate identity into authority. |
| Original accepted creation retry / revision/Check retry / historical projection | Fresh shared/member proof and full accepted prefix/pending feasibility precede original-result equality/disclosure. No new key/result, Check acceptance or control rewrite. Old origin association stays pinned independently of later prefix. |
| Reservation, ready advancement, accepted replacement and final delivery | Fresh identity/namespace/control grounds in the declared validation passes and required barriers, then current guards at the existing cuts; no cached prior-call identity success replaces a pass. Whole-response hook cut occurs before final fresh guards; denied/unavailable final permission discards all private output. |

One fresh identity set may be reused only **inside that entered proof pass** for anchor, association, origin and related predicates, while the same pinned descriptors/locks remain held; it is not an inter-pass or inter-call validation cache. This avoids the existing repeated raw `physical()` acquisitions becoming hidden native calls. Any additional reached acquisition, including provisioning outside passes, is charged to the complete call. Live named/held dev/ino checks at the existing boundaries stay separate and freshly reached; device renumbering across hosts is allowed, within-host substitution is not.

## Lifecycle, refusal and incident discipline

The [v5 acceptance/writer/authorization protocol](ledger-history.md#controls-permanent-creation-association-and-writer-discipline) remains binding after the mappings above. Hold one permanent ledger flock through each serialized call; acquire at most one member lock/set in ledger→member order, dispose it before another member. No fork/reentry while custody is owned. A successor requires confirmed predecessor exit and no inherited handles, not merely lock success. Connection is nondisclosing and shared-only; list validates all permitted members sequentially, excluded members are not opened/acquired, unavailable/damaged permitted members suppress the whole page. A local A failure does not mark intact B blocked; shared damage/incident or unresolved member-dependent shared remnant blocks ordinary dispatch globally.

Retain current independent guards and error precedence: full bound/decode/mask/end check; valid wrong dispatcher unsupported; current principal/collection/subjects/references/cursor/member disclosure before private work; shared controls/deferred gate; required member acceptance/prefix/pending/remnant proof; accepted key before pending/new predecessor/Check/capacity; declared mutation permissions; fresh barrier/revalidation/final guards. A denied selector or excluded list member does no private identity acquisition. Operational primitive denial is unavailable, not a fabricated domain denied result. There is no identity detail/count/path in an error.

Shared reserved→ready→accepted and member reserve→append→accepted remain separate durable replacements, not a cross-file transaction. Matching partial/full suffix is only the exact pending candidate. Only exact authorized mutation retry can finish or clean a supported pending/remnant cut; reads and old accepted retries never do. Full-prefix canonical/semantic validation, all false/true fixed Check results and current/historical applicability remain necessary even when identity matches. Successful reads/reconnect/retries leave bytes/names/generations unchanged, except locks/barriers; only genuinely observed I/O permits the bounded incident exception.

| Native result / condition | Classification and permitted consequence |
| --- | --- |
| Unsupported ABI/filesystem; ENOSYS, ENOTTY, EOPNOTSUPP; unsupported successful handle type/size | unavailable, deterministic/configuration refusal; no fallback/incident/cleanup or further unjustified advancement. Pre-filesystem ABI/admission refusal creates nothing. An installed read/reopen preserves existing bytes; fresh provisioning can already have created exclusive names or a reservation as explained below. |
| EACCES or EPERM from primitive/LSM/seccomp | unavailable, operational permission refusal; not domain denied, no incident. |
| EOVERFLOW or ENOSPC from handle acquisition; wrong length/type/zero output; invalid/noncanonical stored identity; changed FSID/handle or same-FSID relation failure | unavailable, inconsistent/unsupported proof; preserve without incident or re-enrollment. No output from a failing syscall is promoted. |
| ESTALE, ENOENT, ENOTDIR, EBADF, EFAULT, EINVAL during acquisition; disappeared/wrong live binding | unavailable, stale/configuration/integrity refusal; preserve without incident. |
| EINTR, EAGAIN, ENOMEM, EMFILE, ENFILE, ENOBUFS | unavailable, interrupted/transient-resource refusal; one attempt, no application retry or invented I/O incident. |
| EIO, EUCLEAN or EREMOTEIO actually returned by a required native proof syscall | genuine observed scope I/O: immediately latch unavailable, discard private bytes, one bounded justified incident-retention attempt with issue `io`. |
| Another errno, injected Refuse, invalid hook/cut combination, or malformed post-success fixture output | unavailable, deterministic refusal unless one of the explicit observed-I/O cases applies; no blanket syscall-error→incident conversion. |
| Process exit during capture before preparing anchor | No enrollment authority; fresh/resume refuses any unanchored orphan. No capture of a new pair on successor. |
| Exit after anchored preparation / ready / append / accepted replacement / lost reply | Original v5 cut rules, with original v6 pair required. Only exact authorized retry resumes supported installed pending; accepted retry returns original result. A failed response is not rollback evidence. |

Ordinary existing file-write/short-write/barrier failure semantics remain unchanged; the table is the new **identity primitive** classifier, not a reinterpretation of old `Failure` or a license to ignore existing observed storage failures.

**First-use mutation versus refusal aftermath:** `connect_inner` creates root, permanent lock and members before it can identify those nonexistent objects; `create` installs the shared reservation before `member_node/provision_member` creates and identifies the member directory/lock. A later unsupported/malformed/resource/operational refusal can therefore leave those earlier names and the original reservation. No preparing anchor, ready pair, new accepted record or later lifecycle advancement may be justified by failed acquisition. Preserve the orphan/cut and refuse blind cleanup or enrollment on a successor; only intact independently anchored supported preparation can resume under the existing rules. Installed-custody reads/reopen have no earlier first-use creation; they refuse without lifecycle mutation (apart from the separately justified genuine-I/O incident). This selects no new precreation probe and promises neither rollback nor zero mutation of an already-started fresh call. A stronger first-use zero-mutation guarantee would require separate product/safety review.

### Safe retention after an identity I/O failure

A scope is retention-ready only after an independent complete enrolled identity/anchor/grant relationship was proved while its current pinned descriptors and permanent lock remained continuously held. For shared custody this includes all three objects; for a member it includes its pair, installed/preparing anchor and applicable independent reservation/association. A freshly verified identity in the current pass can establish these grounds before later Trace/control I/O; an earlier fully justified pass on the continuously held host can supply them after a later native I/O failure. Partial acquisition or plausible path/printable IDs do not suffice. For a freshly opened member whose first identity proof fails there is no earlier member justification: latch locally and report retention not established, without writing through guessed grounds.

Readiness is a private fixed receipt tied to the still-held descriptors, sealed grant/slot/key, last proved anchor stage and complete enrolled token set, not an owning second grant vector or a success flag on an arbitrary path. Normal proof entry first checks live bindings and the sealed grant/anchor selectors; namespace, grant, stage, key, association or anchor contradiction clears the receipt before returning refusal. Successful preparing→installed replacement updates its stage only after the declared durable proof. A newly opened member starts with no receipt; closing its scope destroys it.

After an observed identity fault, do **not** rerun native identity acquisition to enable retention. Quarantine prior readiness, perform fresh live binding checks, and boundedly reread the current anchor through the held parent. Compare its complete selectors/stage/tokens to the prior receipt and immutable grant (and the already independently proved shared reservation/association for a member); this is an anchor-to-prior-proof comparison, not a substitute proof of current native identity. For a member this includes the live shared root/lock/members chain, not merely a member still named in an orphaned held members directory. Only an unchanged continuously held scope passes. Any mismatch, missing/noncanonical anchor, changed namespace or failed reread invalidates readiness and skips all incident writes; do not recursively classify/retain that failure. Drop anchor read/visitor/canonical scratch before reading the clear canonical incident/no incident.tmp. Recheck live bindings before the first incident create. Then attempt once: exclusive incident.tmp, bounded blocked write/sync, rename over proved-clear incident.json and parent sync. Namespace/grant/anchor contradiction invalidates retention readiness; skip writes. Do not acquire another member, overwrite blocked/malformed/missing evidence, reset an incident, repeat/recursively retain a retention failure, or mutate lifecycle/acceptance/pending/anchor files. A shared fault uses only shared retention; a member fault uses only that member. Retention work is charged even when refused or partial. A failure before complete shared justification returns unavailable without a host and observes inability to retain safely.

The live latch survives failed retention. Successful retained incident/incident.tmp blocks the same scope on a successor even if identity and later barriers succeed. If no incident evidence survived, a successor cannot infer the lost observation from otherwise legitimate bytes; no unconditional restart-refusal promise is made. Complete coherent rollback or loss of all protected evidence remains indistinguishable from legitimate identical state. Ordinary reboot qualification and physical power-loss qualification are different claims.

## Concrete fault and observation surface

The new trusted hook extends file cuts without changing old public hooks. It is supplied only by composition, never request JSON. All enum types below derive Clone, Copy, Debug, PartialEq, Eq; the boxed hook itself is not Clone.

```rust
pub enum LedgerIdentityObject {
    LedgerDirectory, LedgerLock, MembersDirectory, MemberDirectory, MemberLock,
}
pub enum LedgerIdentityStep {
    BeforeFsType, AfterFsType, BeforeFsInfo, AfterFsInfo, BeforeHandle, AfterHandle,
}
pub enum LedgerContinuityIoEvent {
    File(LedgerIoEvent),
    Identity { scope: u8, object: LedgerIdentityObject, step: LedgerIdentityStep },
}
pub enum LedgerContinuityIoFault {
    Continue, Io, ShortWrite, Refuse, NativeErrno(i32), MalformedIdentity,
}
pub type LedgerContinuityIoHook =
    Box<dyn FnMut(LedgerContinuityIoEvent) -> LedgerContinuityIoFault>;
```

File events retain the exact [v5 lifecycle cuts](ledger-history.md#host-calls-and-the-fault-boundary) and Continue/Io/ShortWrite/Refuse meanings. NativeErrno/MalformedIdentity on a File event refuse deterministically. Identity scope is 0 for shared or private slot1..16 for member; it never exposes a selector in JSON. BeforeFsType/FsInfo/Handle occurs immediately before the corresponding attempted syscall. NativeErrno with a positive Linux errno1..4095 substitutes one failed native attempt with that errno; an out-of-range value is deterministic Refuse without a syscall attempt. Io substitutes EIO. ShortWrite is invalid on identity events. After events occur only after a successful syscall. MalformedIdentity there forces failed output validation without a second syscall; no candidate token is delivered. Refuse/post-success Io/NativeErrno or any incompatible cut combination is deterministic refusal. Injected failures are fixture evidence only, never real-host support/qualification. A normal host uses None. Callback internals are trusted external state, must not fork/reenter, and cannot authorize disclosure.

For private success, File event `scope=0,phase="deliver",object="reply",step="before"` remains before the final fresh permission checks. No hook runs after those checks to revoke permission and still leak the constructed Vec. Invalid/unsupported/early denied errors introduce no private-success cut. Error after suppressed output does not run it twice.

`LedgerContinuityCall` derives Clone, Copy, Debug, PartialEq, Eq and has exactly `Grant,Input,Connect,CreateChange,ListChanges,SelectChange,ReviseIntent,RunCheck,InspectHistory,InspectContext`. `LedgerContinuityWork` derives Clone, Copy, Debug, Default. Its exact fields are all fields listed in [Complete native observations](ledger-history.md#complete-native-observations), in that order, substituting only `call: Option<LedgerContinuityCall>`, followed by these new public fields:

```rust
pub identity_acquisitions: LedgerBoundary,
pub native_fstype: LedgerBoundary,
pub native_fsinfo: LedgerBoundary,
pub native_handle: LedgerBoundary,
pub identity_format: LedgerBoundary,
pub identity_comparisons: LedgerBoundary,
pub native_buffer_bytes: u64,
pub identity_raw_operand_bytes: u64,
pub identity_text_operand_bytes: u64,
pub identity_scratch_bytes_peak: u64,
pub identity_io_failures: u64,
pub identity_refusals: u64,
```

Its sole associated accessor is `pub fn last_call() -> Self`. A new observer begins Default(call=None). Constructor/connect/dispatch entries start and seal separately; failed connect releases reached owners/descriptors before sealing and exposes last_call without a host. Successful connection_work is immutable, last_work initially equals it then retains the latest dispatcher, including disposal/discard/error/retention, independently of later calls. Old last_call/host snapshots are untouched. Constructors have S=M=N=0; later entries rebase actual retained capacities, not earlier constructor totals. External rejected backing/providers are observed sizes, not secretly owned payload or process bounds.

Each native boundary charges an attempt at the reached syscall/substituted attempt, completion when it returns (including failed return), match for success, no_match for errno. Hook Refuse before syscall does not manufacture a syscall completion. Its operand_bytes is zero with fixed argument/schema words; native exchange capacities are separate native_buffer_bytes. Identity acquisition attempts begin on object entry; completion occurs when it resolves success/refusal, match only for a fully validated token. A process exit has no fabricated completion. identity_io_failures counts explicit observed errno cuts; identity_refusals counts other failed object acquisitions, not domain denial before entry.

Identity-format predicates charge available raw/hex/mechanism ranges and scalar words at actual reached sites; an overlong stored token is charged by its bounded available operand before rejection. identity_comparisons is the diagnostic subcategory of full relationships/fields/temporary predicates that compare native raw tokens, not another acquisition or extra traversal. Raw/text operand scalars report those respective reached charges; they are **not added again** to the parent boundary's operand totals. Canonical whole-control byte equality continues to charge the whole LF-inclusive text buffer, not 36 raw bytes. False/failed predicates and partial visitors/emissions/constructors remain work.

## Complete-call ceilings, owners and pre-reservation feasibility

Keep C=1,048,576; A=16,777,216 accepted bytes/member; T=17,825,792 trace/member including suffix; Q=2,097,152 range/context; L=65,536 page/selection; B=Q-65,536. Each emitted bound includes LF. Keep <=16 nonrecyclable slots, <=128 accepted records/member, page/range1..4, one shared pending and one pending/member, What/Why<=65,536 bytes. **No capacity is increased.** Unchanged v5 complete-call read/hash/record/control/construction/key/projection/permission and owner ceilings apply to the mapped history/lifecycle work. In particular S<=16, M<=64 total, non-list M<=16 on one member, connection M=0; <=256 permission decisions, one ingress decode, at most one private output plus one error, one nonrecursive incident attempt, no retry-until-stable or hidden acquisition/proof pass.

New native work is explicitly additional, not relabeled file read traffic or old observer totals. Define entered object acquisitions N, including failures, provisioning and any capture outside a validation pass:

| New work | Whole-call ceiling / charge |
| --- | --- |
| Acquisitions | `N <= 3*S + 2*M + 64`; the 64 extra object allowance covers fresh/initial/anchor/remnant/provisioning and reached failures outside shared/member passes. Each pass acquires at most its three/two objects once; inline within-pass reuse must be implemented, not assumed from current source. Max N240; targeted M16 maxN144; connect M0 maxN112. No incident acquisition retry. |
| Syscall attempts/completions | Each of fstatfs/FS_INFO/handle <=N; combined <=3*N (max720). A refusal stops later stages. Failed/substituted attempts and validation/disposal count within these limits. Grant/input have zero. |
| Native exchange capacity | Per attempt fstatfs storage <=256 bytes, FS_INFO exactly1024, handle header+128 scratch+mount cell140; charge <=`1420*N` total, including failures. This is a conservative ABI buffer-capacity charge, not read/disk bytes or actual kernel copies. |
| Native scratch | One object's aligned scratch at a time, <=1,536 bytes, including ABI padding/output cells. Observe actual fixed struct size, initialized stack slots, pointer/argument temporaries and object work headers. No per-object heap scratch/vector, growth or overlap with another object's scratch. |
| Identity codec predicates | At most **34** identity occurrences per top-level control decode or re-emission, including rejection. Sixteen accepted pairs plus a decoded ready pending pair can reach34 before `valid_control` rejects the impossible seventeenth slot. Write `F=2*(4*S+4*M+32)` for their combined bound: each of decoding and control emission independently retains the inherited `4*S+4*M+32` ceiling. Each valid token has87 bytes of textual material (mechanism15+hex72), not a claim only87 bytes are charged across all reached predicates. Bound identity-format attempts/schema checks separately by `128*34*F+128*N`; no extra top-level decode/emission or heap owner is introduced to count them. A malformed token charges its actual available range<=C before refusing; stop its visitor at the first invalid field, do not scan/copy an overlength string. |
| Raw equality | At most `64*(S+M)+512` object-equality predicates, counting every object in whole entry/pending/anchor/remnant comparisons. Each well-shaped token compares36 bytes plus scalar words; pair72, shared set108. Codec/whole-control text equality still uses its full operands. Never hide `[u8;N]` behind generic zero-payload `Heap for u8`. |
| Native/output validation | All successful/failed returned size/type/FSID/handle predicates are reached and separately charged. Maximum inspected native payload available on refusal is144 bytes (16+128), not assumed36; scalar returned-length checks precede any slice indexing. Fixed support/argument checks fit the `128*N` allowance above. |
| Token operand ceilings | With F as above, `identity_text_operand_bytes <= 128*87*34*F + C*F`; the C term covers the first malformed textual field on each stopped top-level visitor. `identity_raw_operand_bytes <= 128*144*N + 128*36*34*F + 128*36*(64*(S+M)+512)`, covering native validation, parsed-token support checks and full raw equalities respectively. These are deliberately conservative complete charged-operand bounds, not disk bytes or new application traversal quotas. |
| File/lifecycle work | Unchanged `4*S*(C+1)+M*(4*(C+1)+(T+1))+32*(C+1)` read ceiling; accepted hashing<=M*A; selected/candidate/input hashing<=M*(A+4*C)+32*C. No native ioctl storage is mislabeled buffered_bytes or Trace hashing. |

The existing v5 small field/relationship work bounds cover their same schemas. New compound token-schema predicates remain inside the same parent boundaries, adding at most `128*34*F+128*N` schema words for codec/native format validation and `128*(64*(S+M)+512)` for raw support/equality. Parent operand totals add the reached raw/text operands subject to the named ceilings above, not zero generic-array lengths. New identity field-name predicates also add at most `6*5*96*34*F + C*F` available byte operands in Fields: six reached keys, at most five discriminator comparisons each, key extent<=96; the C term covers the first overlength key on a stopped decode. This is separate from mechanism/hex identity_text_operand_bytes, not unobserved string work. The new diagnostic subcategory is not an extra workload to add again to that parent. Unchanged historical work is not relabeled as v6 performance evidence. A failed source ceiling is a contract-review blocker, not permission to raise it or drop a reached path.

### Source-cut acquisition schedule

The table defines the **v6 scheduling change**, derived from the indicated current source cuts; it is not a claim current repeated `physical()` calls already share native tokens. A proof-round producer owns a fixed shared triple/member pair. Helpers receive borrowed tokens; none calls acquisition behind that producer. The listed post-barrier, cleanup, stage-replacement or later validation cut starts its next fresh round. Inner primitive hooks/fsyncs of one declared bootstrap or initial-control batch do not create hidden rounds or authorize reuse in a later pass. Live binding checks remain separately reached. A failure stops that producer/call; partial tokens are not reused to retry it.

| Source symbol/cut | Producer and consumer assignment | Complete-call bound |
| --- | --- | --- |
| `ledger.rs::shared`; `members.rs::read_shared`; `operations.rs::finish_connect` | One shared triple per entered S, used by `anchor_matches`, retained-anchor comparison and shared/deferred predicates. `shared_sync/replace_shared` themselves do not reacquire; their required successor proof is the next `shared`. | 3S objects. Connection's two `shared` calls plus `finish_connect` are S, not outside allowance. |
| `members.rs::{member_run,member_mode,justify_member}`; `history/sequential.rs::history_member` | First member acquisition is charged by `member_run`; each subsequent `member_mode` on that node is another M. One pair per M is borrowed by anchor matching, ready/accepted comparison and the seq1 origin predicate. No fresh pair per accepted record or per `physical()` expression. | 2M objects, including initial provision scope. |
| `ledger.rs::connect_inner` preparation | One triple after secure opens/lock and, if fresh, exclusive creation **and the bootstrap writer-lock/members/root/parent syncs**. Move fresh native capture after those syncs, immediately before preparing construction/`anchor_matches`/anchor write; do not reuse a pre-bootstrap token. Those immediate consumers borrow this same triple. Resume/Reopen read original anchor and compare, not enroll. | One outside round =3 objects. |
| `ledger.rs::{initial_shared,install_shared}` | A fresh triple/current anchor proof at each `initial_shared` cut: incomplete initial; if anchor.tmp, complete pre-cleanup and post-cleanup; final complete before barriers. Preparing→installed replacement gets a separate post-barrier triple. Initial controls contain no identities; their reads/emissions do not create another producer. | At most four initial rounds plus one post-barrier round =15 outside objects. With preparation, connection outside<=18. |
| `members.rs::provision_member` preparing/installed anchor | First capture/expected anchor uses the provision scope's M pair. Each `initial_member` cut has its own pair/current anchor proof: first; optional pre/post anchor.tmp cleanup; optional complete after initial control creation; final after barriers. The preparing→installed post-barrier replacement has one separate pair proof. Final actual-anchor comparison and returned Physical borrow the final initial round, not a new capture. | At most five initial rounds plus one post-barrier round =12 outside objects; at most one provisioned member per call. Existing helper calls are not assumed fresh for free. |
| `members.rs::member_mode(barriers=true)` with newly opened, unproved node | Bootstrap `justify_member` owns a pair before barriers; the M round after barriers owns a different pair. Same held node with a prior complete receipt needs no bootstrap, but its post-barrier M pair is still fresh. | <=16 bootstraps in the list delivery sweep =32 outside objects. Non-list: <=2 (deferred barrier proof plus new final-delivery node); targeted/accepted retries normally have zero. |
| `operations.rs::{proof_state,proof_member,deferred,create}`; `history/operations.rs` cleanup/reread/append/delivery | Every `read_shared/proof_state` enters S; every normal/post-cleanup/post-reservation/post-append/post-acceptance/final member validation enters M. Deferred's three shared/member rounds and its one fresh barrier bootstrap are already assigned above. No new producer for candidate copy, permission, physical export or emission. | No additional outside acquisition category. |
| `Node::retain`, failure/discard, hooks, grant/input | No acquisition during retention or cleanup of an unproved scope. Before/after-hook refusals terminate the current producer; disposal does not restart it. Grant/input do no native work. | Zero additional objects. |

**Bounded control reuse, not a dropped proof:** ordinary installed `member_mode` first proves and canonically emits its current installed anchor. If member anchor.tmp exists, compare its whole bounded raw buffer to that same borrowed canonical buffer (then drop both before prefix/history validation). Exact equality proves the same closed fields/stage/native pair; unknown/duplicate/escaped/noncanonical/changed fields cannot equal it. No redundant decode/re-emission or second anchor owner is needed. Initial preparing installation still checks its two declared preparing/installed alternatives using the outside rounds above. This v6-only scheduling change keeps a normal member pass to anchor+incident+prefix+optional prefix.tmp =four top-level control decodes/emissions; the temporary raw byte predicate/read remains fully observed. It changes no frozen decoder and weakens no temporary proof.

Summing even the mutually exclusive connection/provision/list maxima gives **18+12+32=62 <=64** outside objects. Thus the original conservative `3S+2M+64` allowance does not rely on unidentified sites. No extra round is added to pad that allowance. Required new initial/retention anchor reads fit the existing outside control/read allowance: their maximum additional anchor reads are five shared installation, six member installation and one retention reread; they use the same codec/read owners, not a new inventory/pass loop. Each controls/emission bound remains `4S+4M+32`. Connection installation emits at most19 outside controls: initial_shared's four two-control batches8, fresh control creation2, preparing/installed/temporary/original anchor emissions<=4 and five added proof-anchor emissions5; retention adds<=3, within32. Member installation emits at most30: five three-control initial batches15, creation batch3, initial/expected/temporary/replacement/final anchor emissions<=6 and six added proof-anchor emissions6. A fresh creation additionally has<=8 reserve/prospective-count/ready/acceptance/member-prefix control emissions and retention<=3: total41. Its provision M has no ordinary four-control load (four budget slots free), at least five shared passes have no creation.tmp after any deferred cleanup (five free), and at least three subsequent normal member rounds have no prefix.tmp (three free). Thus `41 <=32+4+5+3=44`; a failure before reaching a later round stops its later emits, not a use of unreached budget. Initial-installation and repeated-remnant list maxima are separate calls; normal list/target rounds use at most four controls per S/M, leaving the outside32 for replacements/retention. These are scheduling constraints for v6's extra proof reads and temporary-byte reuse, not a claim old repeated decoding was free.

### Rejected codecs and predicate coefficients

`Node::control` calls `codec::retained` (decode, canonical emit, equality) before `shared::valid_control`. Therefore sixteen accepted pairs plus one ready pending pair reaches34 tokens in **both** decode and emit before semantic refusal. `codec::temporary` permits at most sixteen installed/matching-plus-successor entries and an independent pending pair, also34; when installed entries already number16 its Extra seed refuses a seventeenth entry before decoding that value. Duplicate map fields refuse before a second value, unknown fields refuse without parsing their value, identity duplicates stop their token, and the single pending field gives at most two further tokens regardless of field order. A partial last token and semantically impossible generation/slot still count. These are rejected-work ceilings, not permission to accept seventeen slots, keep two accepted vectors or extend a frozen profile. A closed 13,601-byte rejected example is below C; successful-phase maxima are not a substitute for this path.

| Reached work/source cut | Derived coefficient |
| --- | --- |
| V6 fixed identity visitor/parser and emission, called by installed/temporary/shared/member anchor codecs | At most six field discriminators (five valid plus one rejected unknown/duplicate key) at five schema words each30; duplicate/presence checks<=11 (six duplicate decisions plus five required-field words, even if implemented with a bitmask); length/literal/type/count/nonzero/support masks<=15; each of72 hex characters is validated/decoded in one grouped step. Total<=128 checks/words per token, including a fully parsed token followed by a rejected sixth field. Encoding uses<=72 nibble steps plus fixed five-field framing/support, also<=128. Field-name byte predicates remain in the enclosing Fields boundary; identity_text_operand_bytes concerns mechanism/hex values, not a hidden second name scan. Native output/support checks are<=128 per entered object with<=144 available raw bytes. |
| `shared` full raw comparisons | Acquired→anchor3, current anchor→retained3, current triple common-FSID2; temporary's at most16 entry pairs32; classify's equal pending and possible accepted-candidate pair comparisons<=4; `proof_state` pair<=2. Total<=46 object/range equality predicates per S, hence<=64. Common-FSID relations for members are checked on the actual acquired pair; stored association agreement follows from full member equality, not a hidden all-member/native sweep inside shared control. |
| `member_mode/justify_member/history_member` | Pair common-FSID/root relation2, member anchor2, reservation/association2, seq1 origin association2, member-anchor temporary alternatives<=4. Total<=12, conservatively<=16 per M, hence<=64. Prefix equality has no native tokens. The 128-record loop contributes native equality only at seq1. |
| Outside connection/provision/bootstrap and retention | <=12 raw predicates per six outside connection rounds72; <=12 per six outside provision rounds72; <=6 per sixteen barrier bootstraps96; retention prior-anchor/pair/selectors<=12; final exported/deferred pair relationships outside the round-local rows<=16. Even their mutually exclusive sum **268 <=512**. Live dev/ino predicates retain their separate old field charges; cloning a raw pair is construction/copy work, not an invented equality. |

This derives `64*(S+M)+512`. Each raw equality predicate charges at most36 available bytes/object (FSID-only relation16, pair72 over two objects); each native/token-format check is bounded by128 reached checks, yielding the stated raw/text coefficients with34F occurrences. Overlength/malformed value refusal adds at most one available C-sized textual operand per stopped top-level decode. No failed visitor loops to another invalid field. Whole canonical controls charge their complete LF-inclusive buffers separately and remain bounded by C. The new subcategory diagnostics are not added again to parent predicates.

### Simultaneous owner and release schedule

The named payload cap remains **64 MiB**. Its unchanged outer envelope is `2*(T+1)` traces + Q private output + C error + C retained ingress + `24*C` other owners + `2*L` remaining payload = **65,142,786 bytes**, margin **1,966,078** below64MiB. The following schedule establishes a feasible design within it, not a measured peak or a claim current v5 already implements this normalization/disposal. All owner measures use actual capacity, including partial visitors and transfers. Fixed arrays do not remove heap-resident vector/Box headers from the count.

Partition the 24C region into these *possible live-owner classes*, with the cut table below restricting which can coexist. A C class bounds its total owning string/read/emission capacities, not each field independently. `Parser::string` reserves the field's disjoint encoded extent; all string extents in one bounded decoded value sum<=C. Clones/normalized producer values reserve from admitted bounded lengths; boxed headers and vector allocations are in the 2L table, not omitted.

| Group | C-sized classes (not always occupied) |
| --- | --- |
| H: seven persistent/call holds | Decoded ingress; installed shared control; one exact/deferred reservation clone; deferred raw marker; current shared temporary raw bytes; decoded temporary pending/successor fields; host enrolled anchor fields. Independent grant vector is borrowed by anchors. |
| P: six member/installation holds | Installed member prefix; member temporary prefix; prospective normalized pending input; proposed replacement prefix; current member/preparing anchor fields; expected installed/preparing anchor fields. No owning array of historical records. |
| R: seven record/read/emission holds | At most two decoded/expected/producer record string payloads; canonical record buffer; canonical input buffer; pending/candidate bytes; replacement emitter; one current control/anchor read buffer. Trace buffers belong only to the outer 2(T+1) region. |
| V: four temporary decode/initialization holds | Partial visitor fields/key scratch; canonical retained-control emitter; one extra decoded anchor/retention reread value; initial fixed-control emission batch. Initial empty trace/prefix/clear batches together are<1,024 bytes, not three hypothetical C-sized pending controls. |

| Cut/source lifetime | H/P/R/V occupied-class upper bounds | Release/borrow condition |
| --- | --- | --- |
| `connect_inner/install_shared/finish_connect` | 4/2/2/4 =12 | No ingress/record/member. Initial emitted batches are tiny. Temporary anchor/read/emitter are dropped before next initial proof. Installed-anchor replacement transfers/moves the anchor; it does not retain a second baseline/grant. |
| `shared/classify/proof_state/deferred` | 7/2/5/4 =18 | One accepted vector. Temporary entries are visited/compared one at a time against borrowed installed entries; only last/pending survives. Origin feasibility/expected association and emit scratch are dropped before the next proof. Deferred clone p survives but old State is dropped before `deferred`/reread. |
| `member_mode/history_member` validation | 7/5/6/2 =20 | No new replacement prefix or initial batch; anchor expected/visitor transfers do not duplicate string allocations. Canonical record then canonical input and at most decoded+expected records; drop expected/record per iteration before next. Prefix temp and pending candidate are bounded, not a second Trace or accepted vector. |
| `provision_member/initial_member` | 7/4/2/4 =17 | No long history, producer records or prospective revision. At most original/expected/temporary installed-anchor values occupy the anchor classes; initial prefix/clear/batch is tiny. Release each read/canonical/temporary proof before next helper. Final Physical borrows the final pair. |
| `history_mutation` or create reservation/append/acceptance | 7/6/7/2 =22 | No initial batch/extra anchor reread; at most two record owners. `history_mutation` explicitly drops record/candidate/current before cleanup, drops pending/m before reread, drops record/bytes/m before append revalidation, then record/bytes/accepted/m before delivery. Creation likewise drops origin/bytes/m before checkpoint, and state before shared rereads. Preserve this disposal or earlier disposal in v6. |
| Response constructed, delivery/reread/discard | 7/5/5/2 =19 | Response has Q outside this region. Prior MemberState/metadata/record/candidate dropped before final member/shared proof; borrowed validated spans, never decoded context Vec. List releases each member before next and metadata before barrier sweep. Destroy suppressed response before error return; both Q+C remain conservatively reserved. |
| Observed fault/retention, including failure before caller unwinds | 7/2/4/4 =17 | Outer shared state/reservation/response can still be held. Member closure's partial record/trace/emitter drops before `member_run` retains. Anchor reread scratch drops before incident decode; clear/blocked values are tiny; one read/visitor/canonical/replace emitter, no recursive retention/revalidation. Shared failure while caller holds output uses the same reserved Q. |

Maximum is **22C**, not all24 classes at once. At most eight control-read sentinel bytes/slack beyond the C class bounds fit the remaining `2C` reserve; actual read capacities must still be observed. Thus `22C+8 <=24C` without relying on legal inputs or discarding failed allocation work. The two trace allowances cover old/current read overlap where genuinely live; explicit drop-before-reread normally uses only one. Emission limits/capacity clamps and zero-copy owner transfer are required, not `Vec.clear()` as release. A construction whose actual allocator capacity exceeds its class must be normalized/disposed before entering another cut or block source acceptance; no named cap is raised.

| Remaining payload in 2L | Derived allocation/capacity bound and mutual exclusion |
| --- | --- |
| First L: grant/vector/key/span/metadata/assessment allocations | Grant16 <=2,816 bytes (48-byte pair header+128 bounded name bytes each); v6 Association header<=256, accepted16 allocation<=4,096 (its strings are already H control payload); spans128*32<=4,096; keys128*(24+64)<=11,264. Metadata16*(192 header+256 bounded strings)<=7,168; assessments128*(72 header+160 bounded strings)<=29,696, conservatively32,768. Metadata and assessments never coexist: list versus context. `storage::inventory` also owns a32,768-byte getdents scratch Vec. It drops inside that function before `history_member` constructs spans/keys/assessments; on a delivery/reread, prior member/assessment owners must already be dropped. Inventory can overlap earlier list metadata, so its phase is32,768+2,816+4,096+7,168=46,848<L (returned/name vectors use the second L). Largest context vector phase is **2,816+4,096+4,096+11,264+32,768=55,040 <L** with no inventory scratch; list validation phase29,440. No two inventory scratch buffers coexist. Raw identity/Physical are36/72 bytes, inline in the enlarged Association, not a second heap allocation. |
| Second L: paths, bounded Box headers, inventories and small strings | Grant directory/anchor paths<=8,192; independent anchor basename<=4,096; bounded construction path+C-string<=8,193 (no unobserved PathBuf growth); subtotal20,481. At most three inventory allocations<=2,048 each =6,144 (max33 permitted bounded names plus vector header; refused name is borrowed, never pushed). Request/result Box headers: H<=4, P<=4, R's two records<=4, V partial/transfer<=2, hence<=14 live boxes. Reserve28*1,024=28,672 bytes conservatively (including construction transfers), with each header<=1,024; small field keys/scope basenames/digests/scalars<=4,096. Sum **59,393 <L**. Large/malformed value string payloads are in H/P/R/V, not counted here as small scalars. |
| Fixed/native, not payload zero | Host/Node/readiness receipts, raw sets on stack, parser/visitor/Owned/FFI/hex/hook binding headers are in named_fixed_bytes_peak with actual sizeof/overlap; array bytes in vector/Box allocations above remain payload. One native object's scratch<=1,536 with no other FFI scratch live; <=two record owners, <=64 descriptors/stack bindings and inherited hash-state bounds remain source gates. |

The new private raw representation and bounded path/Box layout above are part of the selected implementation schedule; ordinary source acceptance must verify their actual sizes/capacities and complete dropped/error overlaps. `Custody::{payload,rebase}`, `Owned/Allocation/Fixed`, parser visitor transfers and baselines must charge these physical owners exactly once, including larger inline headers, not infer zero byte work from `Heap for u8/[T;N]`. Provider captures, whole stack/RSS, allocator overhead and latency remain outside the named schedule.

### Source-backed feasibility before mutation

The source canonical formatter escapes a control character as six bytes and quote/backslash as two. Thus two maximum What/Why payloads use at most `6*131,072 = 786,432` encoded bytes. U+0001 is not trimmed whitespace, so a What containing65,536 such bytes is nonblank under the actual source predicate; no literal-byte discount is assumed. Identifiers are unescaped ASCII<=64, version/count/length scalars have bounded decimal widths, policy/adoption are fixed, arrays<=16 and each identity is exactly **160 canonical bytes** without LF; a physical pair is **342 bytes** without LF. Identity sizes are known **before** native enrollment, so prospective ready/accepted controls can be size-checked using the fixed worst-case token without inventing an identity or retaining a false success.

Closed-schema pure arithmetic yields these conservative maxima, including LF. Path rows allow each admitted path byte to double; they are byte upper bounds, not a claim a single 4,096-byte component can be created. Pending rows allow independent maximum scalar widths even where simultaneous producer state would be smaller.

| Construction | Upper bytes |
| --- | ---: |
| Complete maximum create input | 786,658 |
| Complete maximum revision input | 786,826 |
| Shared ready pending with15 prior accepted entries | 799,234 |
| Full shared accepted control with16 entries | 12,969 |
| Shared anchor with maximum escaped directory and16 grants | 11,595 |
| Member anchor with maximum escaped directory | 9,106 |
| Member prefix with maximum revision pending/scalar widths | 787,175 |
| Maximum revision record envelope/input/result | 787,852 |

These dominate valid reserved-ready size changes, new member input/record/prefix and fixed Check/incident controls; shared acceptance removes the large pending input. Every admissible produced control/result/origin fits C with margin; a maximum ready pending is <800,000, leaving >248,576 bytes. Rejected controls/partial visitors are still charged by the separate34-token/C bounds, not these legal-phase examples. Prefix and canonical record feasibility, checked end+length<=A and count<=128, remain mandatory before reservation. An exhausted/impossible installed pending refuses even with a matching temporary. A legitimate count/byte boundary is not widened.

Before the shared reservation, emit/check the **actual** bounded creation input/origin and reserved control with physical null. For future ready/accepted controls, derive their **prospective size** from the actual already-validated entry/input bytes plus the fixed342-byte pair shape and fixed hash/reference widths; this may use scalar length arithmetic or a private counting writer, not a fabricated NativeIdentity or a purported canonical ready-control emission. The new member does not yet exist or have custody evidence. After exclusive enrollment/anchor proof succeeds, form the ready control using the **actual acquired pair**, canonically emit/check it before ready replacement, and likewise emit/check the actual acceptance control before replacement. The pre-reservation shape margin ensures that valid enrollment cannot first discover a representational overflow after committing its reservation. Mutation prefix/input/record feasibility uses actual bounded canonical values before its reservation. All reached counting/emission/input constructors and owners are observed; none installs a placeholder, new operation, grant or reenrollment authority.

## Source consumer and accounting crosswalk

This proposal is based on the unchanged accepted Rust source, not a generic storage rewrite. Extend the concrete privately selected ledger/history path for a new profile, factoring only consumed mechanisms. Do not globally replace raw identity, clone a filesystem backend, wrap old public hosts or add an unconsumed framework/index/cache.

| Source boundary | Required successor consequence |
| --- | --- |
| `src/adapters/jsonl/opening/storage.rs::id` and older opening/intent/assessment consumers | Keep raw dev/ino helper and all old persisted fields/semantics unchanged. It still supplies new-profile live named/held equality. |
| `src/adapters/jsonl/ledger/selection.rs::{Profile,Installation}`; kernel grant/input; application host; `src/lib.rs` | New closed v6 selection/admission/export/guard/input/work path; no hidden reinterpretation of History. New tags and exact mapped schemas at every embedded version. |
| `ledger.rs::{connect_inner,anchor_matches,shared,install_shared}` | Replace only persistent root/lock/members fields; acquire complete per-pass set and validate all grant/adoption/path/stage identities. Keep independent live root/lock/members comparisons. |
| `ledger/storage.rs::Node::{physical,binding}` | New-profile persistent pair acquisition; retain live named/held `binding` checks. Keep object-kind/link/secure-open/lock discipline. Ordinary old Node::physical remains raw for frozen profiles. |
| `ledger/members.rs::{member_anchor,matches_member_anchor,justify_member,provision_member,member_mode}` | Carry pair in preparing/installed member anchors and compare against reservation/association. Propagate full operands, readiness and authorized initial-only resume before any cleanup/advancement. |
| `ledger.rs::{association,classify}` and `ledger/operations.rs::{create,proof_state,proof_member,deferred}` | Same pair in ready/accepted control/candidate/clone/whole-entry equality and deferred proof. Preserve structural M0 connection versus exact-create member proof. No promotion or new pair allocation. |
| `ledger/history/sequential.rs::history_member` origin association predicate | Compare association pair to that pass's acquired pair as well as immutable origin input/hash/end/actor; never compare origin association hash to whole tip or acquire uncounted duplicate native tokens. |
| `ledger/codec.rs::{Physical,Anchor,AnchorWire,MemberAnchorBase,MemberAnchor,Association,Reservation,Temporary}` and custom anchor visitor | New closed identities, field order/masks/required rules, canonical bytes and complete comparisons. Keep independent borrowed grant vector and bounded arrays. |
| `ledger/history/codec.rs::MemberAnchorWire` and conversion | The separate flattened v5 adoption wire is another persistent-field consumer; supply new v6 wire rather than changing old fields or omitting its identity. |
| `ledger/work.rs::{Heap,Owned,Fixed,Measures,history_begin,history_seal}`, `Custody::{payload,rebase}` and host baselines | Independently selected v6 observer, full raw logical lengths, vector element capacities, larger fixed/FFI/visitor/callback headers, constructor/rebase/disposal and retention overlap. Generic u8/[T;N] zero logical charge cannot account native byte equality. Preserve old totals. |
| `ledger/storage.rs::{Context,Node::retain}`, application dispatch/final gates | Explicit identity events/classifier, justified one-attempt retention and scope latch, no recursive acquisition or writes through unproved custody; suppress private response before final delivery. |

## Minimal consumer, falsifiers and evidence gates

The fresh fixture independently assigns `alpha-c/member-a`, `beta-c/member-b` and14 other unused distinct pairs, shared custody `ledger-custody`, owner/Workspace/binding/adoption as above. A Rust client constructs the public new spec/grant, mutable bounded ingress, current guard and connect(None hook); it needs no private constructor or old public host. The [v5 four-operation example](ledger-history.md#lifecycle-example-and-falsifiers) supplies exact field values after mapping every v to6 and projections to@2: create A with81-byte What/original Why; create B; run explicit Check A at origin (false); directly revise A to `Trim local defaults`/Why null; run explicit Check on revised intent (true); read current context and historical cursor/range; exit with all handles closed; fresh Reopen and repeat create-a/check-a/rev-a keys. Do not reuse the v5 illustrative hashes: recompute digests over v6 canonical records. Result references/actor/text/false-true/applicability remain identical across successor reads/retries, with no new accepted line or rewritten association. A stale new-key expected origin conflicts. B stays independent.

Required falsifiers are future **observable native behavior**, not documentation wording or another permanent validator:

| Challenge | Required outcome |
| --- | --- |
| Same exact-subject custody across process exit; separate ledger with same printable names | Fresh host reads same enrolled tokens, original/results/prefix and current/historical applicability. Separate independent custody shares no authority/retry binding. |
| Each root/shared-lock/members/member-dir/member-lock replacement; copied/reflinked/snapshot slot; wrong grant/anchor; changed FSID/handle | Shared or local unavailable as appropriate; no recapture, blind cleanup or copied continuation. Intact authorized B works after local A damage unless unresolved shared proof applies. |
| Live named root/members/member/lock replacement while held; symlink/nonregular/nlink>1 lock; path rename/alias | Live binding/type/link/path refusal survives equal persistent token or cached proof. No privileged/native handle reopen. Trusted alias limitations remain stated. |
| Unsupported ABI/filesystem/primitive, operational denial, overflow, malformed/unknown/type-length/zero identity and noncanonical controls | Explicit nondisclosing unavailable; no fallback, incident, cleanup or further unjustified advancement for deterministic/configuration/resource refusal. Pre-filesystem ABI/admission refusal creates nothing; installed reads/reopen preserve bytes. Already-started fresh calls retain earlier exclusive names/reservation, without fabricated enrollment or rollback. Codec rejects closed-schema extras/duplicates. |
| Denied collection/target/cursor or excluded member; final hook-induced revocation | Zero private acquisition before relevant authorization; list exclusion without counts/holes; final error only after destroying constructed private bytes. A read never becomes permission. |
| Every capture/provision/anchor/reserve/ready/append/acceptance/delivery cut | Anchored supported exact retry preserves pair/key/actor/result; unanchored orphan refuses. Ready/acceptance temporary reconnect M0; unrelated dispatch M0 unavailable; only original create proves/cleans/syncs before installed-state continuation. |
| Feasible pending/partial-full matching suffix; known equal/prospective/successor temporary; unaccepted tail/full capacity | Successful read/old retry snapshots unchanged with honest blocked progress; exact authorized mutation alone completes/cleans. Impossible pending defeats equality. Full accepted capacity remains readable/retryable. |
| Native actual EIO versus deterministic/malformed/EINTR/resource/configuration refusal | Scope-correct latch, at most one justified incident-only attempt for genuine I/O; zero incident for other native refusals. No recursive acquisition; partial/unproved enrollment skips writes. Retention failure keeps live latch and explicit lost-observation risk. |
| Maximum controls/text/all16 permitted members with long histories, old retry, malformed token, deferred proof, discarded reply/incident | Actual complete counters/capacities respect all ceilings, raw/text operands and exchange/scratch distinct from file reads; no hidden per-origin acquisition or zero-byte identity comparison. |
| Longer-history context and old cursor; false Check far from tip | Full accepted prefix and all required selected facts remain validated; false assessments retained, version-bound applicability honest; above B gives explicit limited context, corruption instead unavailable. |

Advancement gates are separate:

1. **Contract review/adoption:** the project manager owns independent review of the exact author revision, source/requirements/feasibility/error/retention assessment, the verdict and integration. Additional reviewer findings are supporting evidence, not delegated acceptance or a substitute for the manager’s review. Current source/native documentation supplies a mechanism hypothesis, not implementation or host evidence.
2. **Source assignment/acceptance:** separately assign cohesive v6 producer→consumer implementation and consequential ordinary `#[test]` filesystem/process regressions. Run `cargo test --locked`, `cargo fmt --check`, `cargo clippy --locked --all-targets -- -D warnings` under the [testing policy](package.md#testing-policy). Fake/injected identity tests cover classification only; a useful disposable real btrfs fixture and actual primitive outcome are still required. No source assignment follows from this proposal itself.
3. **Exact-subject native support:** separately authorize isolated external project/immutable candidate qualification; record candidate/package/dependency hashes, exact kernel/config/ABI/filesystem/features/namespace/grant/protection/provider conditions and unprivileged acquisition. Full positive lifecycle and refusals must run with real native descriptors/FSID/handle, not a mocked backend. Unsupported facilities block the supported claim rather than triggering privileges or weaker fallbacks.
4. **Real ordinary reboot/remount:** separately authorize the actual host event on freshly provisioned disposable custody, preserve before/after canonical files/names/enrollment/FSID/handle and live dev/ino observations, sync-confirmed acceptance, process/handle exit, exact event/artifact/configuration evidence and fresh successor reads/original retries. Changed st_dev is allowed only with unchanged persistent tokens and every independent proof. Same-process fake values, child exit/restart, source reading or another namespace cannot substitute. No requirement to manufacture a device renumbering or infer its prior cause. If useful original custody cannot reopen, this proposition fails.
5. **Power loss, release and authority:** physical power-loss/backup/repair claims require distinct explicit experiments. [Exact-release qualification](package.md#qualification), immutable activation and any explicit controller handoff are separate; activation alone does not transfer authority. Never load this mutable checkout as controller.

Read-only sharing follows the [State disclosure boundary](state.md#git-sharing-and-encryption). It preserves origin/owner/attribution/references/coverage and current permission; it grants no continuation, ownership transfer, native access, replay or active borrowing. A positive sharing/multi-tenant interface remains a separate consumed capability. This contract adds no sharing transport, agents, models, effects, migration, archive or discovery.

## Native semantic grounding and current limits

Pinned upstream Linux v6.12 sources ground the mechanism: [`fs/fhandle.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/fhandle.c) and [`fs/namei.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/namei.c) for held-fd empty-path identification; [`fs/exportfs/expfs.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/exportfs/expfs.c), [`include/linux/exportfs.h`](https://raw.githubusercontent.com/torvalds/linux/v6.12/include/linux/exportfs.h) and [`btrfs/export.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/btrfs/export.c)/[`export.h`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/btrfs/export.h) for type77/20-byte non-parent token and128 scratch limit; [`fs/ioctl.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/ioctl.c), [`btrfs/ioctl.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/btrfs/ioctl.c) and [`btrfs.h`](https://raw.githubusercontent.com/torvalds/linux/v6.12/include/uapi/linux/btrfs.h) for LSM/FS_INFO/1024-byte ABI; [`btrfs/volumes.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/btrfs/volumes.c) for normal versus temporary FSID; [`btrfs/inode.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/btrfs/inode.c), [`fs.h`](https://raw.githubusercontent.com/torvalds/linux/v6.12/include/linux/fs.h) and [`btrfs/transaction.c`](https://raw.githubusercontent.com/torvalds/linux/v6.12/fs/btrfs/transaction.c) for persisted finite generation and snapshot root identity. [`open_by_handle_at(2)`](https://man7.org/linux/man-pages/man2/open_by_handle_at.2.html) explains opaque/alias/mount-ID/privileged-open limits; privileged opening is not selected.

The corrected independent source investigation supports these statements, not installed-kernel observations. Current gaps: implementation and actual complete-call schedule; unprivileged exact-host primitive/configuration support; useful real successor fixture; actual reboot/remount/power-loss evidence; earlier changed-device cause. Arbitrary clone/rollback detection is outside the stated guarantee, not an unfinished repair feature. Failure or a newly necessary exclusion must return to contract/product review; no self-adoption, host experiment, source implementation or controller authority follows from writing this page.
