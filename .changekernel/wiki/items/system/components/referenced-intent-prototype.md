---
title: Referenced Intent Prototype Contract Candidate
aliases: []
source-id: cw:design:referenced-intent-prototype
---
# Referenced Intent Prototype Contract Candidate

## Adopted version terminology correction

The user clarified: “we decided to use version for everything.” Use **ChangeKernel version** consistently. Do not introduce a separate “native profile” abstraction or the assistant-proposed split into independently versioned software and native contracts. The software, request/data interpretation and native behavior are described under the applicable ChangeKernel version. Historical accepted bytes keep their original meaning; this correction does not migrate or relabel them.

The `ck-referenced-intent@1` profile designation and separate versioning explanation below are superseded proposals, not adopted machinery. The reviewed body is retained here pending a focused alignment of its identifiers/envelopes to the agreed version scheme. Do not implement its `profile:P` fields or independently advance its component `@1` markers as a new version system. This correction does not select the next ChangeKernel version number or change the current package version. The remaining prototype scope, safety boundaries and diagnostic plan are unchanged; their concrete packet still requires adoption after the version alignment.

## Status and review subject

**R62 candidate, with the version correction above taking precedence: remaining concrete choices below are proposed/unadopted.** This is one implementation packet for the [approved first prototype](intent-revision-contract.md#approved-first-prototype-scope) and [diagnostic measurements](intent-revision-contract.md#approved-diagnostic-benchmark-plan), not adoption, executable support or qualification. Independent review and user adoption of this packet still precede source implementation. Conditional execution authority is tracked in [the status note](../../../../../CHANGEKERNEL_STATUS.md).

The useful outcome is Friday → Saturday, fresh-reader explanation after closing the original Pi session, then Sunday and recovery of the original Saturday result without another revision. One person, one Ledger, one Change; no external effects, organization execution, model judgments or domain Check. Plan wording is an assertion/adopted intent, not proof that dinner is feasible or arranged. Changing it releases no reservation, expense or responsibility.

Select the new, fresh-only native profile `ck-referenced-intent@1` (abbreviated P). Do not assign a v7 meaning to it, migrate v1–v6, change their inventory, or reinterpret their inline What/Why. An “existing Change” here means an accepted opening under P, not imported legacy custody. This packet also specifies the actual first provisioning/opening path. It excludes reboot/remount/power-loss claims, relocation, copies as continuing custody, hostile rollback detection, repair, all-sender-state-loss recovery and automatic retransmission. Clean process close/reopen and the specified interrupted process cuts are the prototype's recovery claim; stronger [State recovery obligations](state.md#first-local-recovery-profile) remain qualification gates.

This packet consumes [State's acceptance/replay obligations](state.md#record-replay-and-durability-requirements), the [harness responsibility boundary](sdk.md#harness-responsibility-boundary) and [action-governed policy/admission](ledger-governance-and-admission.md#approved-identity-policy-and-feedback-choices). Narrow profile exclusions do not revise those wider requirements or qualify stronger hosts.

## 1. B1: supported authority and closed policy

### Trust and calling boundary

The local operator deliberately starts the reviewed Pi host under their OS login, supplies its independent installation grant, and is the configured `person-1`. This is the **trusted-local-operator premise**, not authentication derived from a transcript role, RPC sender, account string or hidden pipe. No enrollment service or proof of global person uniqueness is claimed. It is one installation of that person's logical `ledger-1`, not an extra Ledger per application.

| Actor/boundary | Authority and limit |
| --- | --- |
| Operator/local terminal | Supplies actual affirmative approval of the immutable subject using the supported TUI below. Terminal automation, unattended terminals and compromised local accounts are outside the premise. |
| Trusted Pi extension/host | Validates agent input, selects the pinned slot, obtains the actual UI result, constructs approval evidence, and supplies a current authorization lease to its Rust child. Its integrity and correct operator mapping are premises. |
| Rust child/native engine | Owns descriptors and lock; independently validates every typed request, installation grant, approval subject, complete fixed policy, exact material, prefix and request identity. It does not independently authenticate terminal keystrokes. |
| Agent/Codemode/client fields | Proposals and references only. Cannot set actor, grant, policy, approval receipt, passing assessment, custody path, result or raw record. No other mutation endpoint is exposed. |

Private stdin/stdout is the transport, **not hostile-same-account isolation**. Arbitrary extensions, subprocesses or unrestricted tools sharing the OS/storage privileges could bypass or compromise this host. The supported prototype instance loads only the inspected adapter and built-in Codemode, exposes only its bounded domain tools, disables MCP and arbitrary shell/file tools, and runs no untrusted native code while custody is owned. This narrows ordinary input routes; it does not turn Pi's allowlist, project trust, QuickJS or private pipes into an OS security perimeter. A deployment requiring hostile extension/process resistance is unsupported by P and needs a separately adopted host boundary. No remote/RPC/print/JSON approval fallback.

Current host authorization is a serialized lease `{principal:"person-1", disclose:"allow|deny|unavailable", mutate:"allow|deny|unavailable"}`. The two enums are independent. The host freezes the lease for one native call and excludes relevant local grant changes until completion; Rust checks it at ingress and immediately before prefix installation. Changes requested during a call take effect for the next call. No stronger asynchronous external revocation guarantee is claimed. After receiving a result, the host freshly checks disclosure before forwarding it to Pi. It may suppress an accepted result. Reads and accepted retries need disclose, not mutate. Opening/new revision/pending resumption require both. If that lease serialization cannot be established, new acceptance is unavailable.

### Authoritative fixed policy

A deliberate trusted first-use grant declares that this subject is only a personal plan-text edit, with **complete** policy coverage `closed-personal-plan@1`. It is not inferred from a context page or empty assessment array. The host must refuse configuration with unknown coverage, another policy, a relationship/resource obligation, a mandatory semantic/domain Check, or an external action. An operator requiring any such condition must not provision P. P cannot discover undisclosed real-world obligations; correctness of this closed-scope installation declaration is an explicit premise.

The exact policy material is UTF-8 compact JSON followed by LF, with the following ordered fields and fixed values (it is material, not an additional lifecycle fact):

```json
{"format":"ck-plan-policy@1","owner":"person-1","ledger":"ledger-1","change":"change-1","coverage":"closed-personal-plan@1","actions":["open_intent","revise_intent"],"approval":"local-tui-exact@1","domain_requirements":[],"relationships":[],"external_effects":false}
```

The native grant pins its material reference; native provisioning verifies bytes against this exact compiled descriptor. Opening approval adopts this policy for the slot. The installed anchor pins it forever; every accepted opening/revision inherits it. No policy-edit, relationship, assessment or Work operation exists in P. Foreign facts, unknown fields/tags, extra requirements or a descriptor mismatch are unsupported/damage, never optional. Native admission always checks current authority, exact approval, expected intent, material custody and limits. The empty domain-requirements array is a closed authoritative policy selection, not “no validation.”

### Exact approval presentation and retention

Agent-visible `open_intent`/`revise_intent` tools accept only the request schema in §2. For a new key they ask the operator to review; reads, retention and accepted-result retrieval never prompt as a mutation approval. Non-TUI modes may inspect already accepted history but cannot adopt or resume pending mutations. A pending resumption requires a fresh affirmative UI review of the **same** request; it authorizes completion of the retained decision, not replacement of its historical approval receipt.

Use `ctx.mode === "tui"` and `ctx.ui.custom()` with a fresh component per interaction, built from Pi's scrolling/layout/input components. Do not treat `ctx.hasUI` as sufficient: RPC has UI but cannot supply this local-terminal profile. Freeze a deep-copied validated request before review. Rust prepares the exact presentation from custody-resolved bytes; the host displays that supplied presentation, not a model-generated summary.

Presentation material `ck-intent-review@1` is an ordered fixed JSON object with fields `format, input, policy_text, previous, instruction_text, what_text, why_text`. `input` is the entire typed request; `previous` is null for opening or `{fact,what_text,why_text}` for revision. Text values are exact decoded strings, not markdown. Policy text includes the exact material's terminal LF. The presentation's JSON bytes use §2's emitter, including one final LF; store them as whole-text material. The deterministic screen displays **every byte** of that presentation as printable ASCII: quotes/backslashes escaped; ASCII 0x20–0x7e otherwise literal; every non-ASCII UTF-8 byte and every control byte shown as lowercase `\xhh`. Hard-wrap between encoded byte tokens with explicit continuation marks outside the data. Never interpret ANSI, bidi controls, Markdown, hyperlinks or source instructions. Label encoding, byte length and material identity, null Why versus empty Why, target/key/expected fact, previous and replacement, instruction, and full fixed policy. This exact byte view is authoritative; any optional readable preview is not approval evidence.

No ellipsis/truncation is permitted. ScrollView bounds visible rows, not data. Affirmation is disabled until the operator has navigated all pages; then a separate explicit “Adopt this exact subject” selection is required. Escape, signal, timeout (120 seconds), close, render/layout failure, unsupported terminal mode or incomplete traversal cancels with no approval. Traversal is not proof of comprehension. The operator's affirmative selection adopts the displayed instruction and replacement now; it does not authenticate a quoted prior conversation or backdate its authorship. The instruction's exact bytes remain referenced separately from the replacement and from the host's actual affirmative adoption; no original transcript authorship is inferred.

After affirmative return, the trusted host sends the prepared subject back with a host-only confirmation. Rust verifies exact equality with its prepared subject and constructs receipt material:

```text
Receipt = {format:"ck-local-approval@1", principal:"person-1",
           subject_sha256:H(canonical input including LF),
           presentation:MaterialRef, decision:"adopt", ui:"local-tui-exact@1"}
```

Fields are ordered as shown; no timestamp, transcript pointer, session ID or nonce is necessary under the fixed lease/no-expiry policy. The receipt is a trusted-host assertion of the actual UI event, not a signature independently verifying a human. The presentation and receipt are retained before reservation/acceptance. Native validates the receipt's exact subject, presentation contents and installed principal; the ordinary agent tool schema rejects receipt/actor/approval fields. Host-only confirmation is reachable only inside the trusted adapter's approval continuation; it is not registered as a Pi tool. Exposing it or forwarding agent objects into it violates P. Raw wire forgery by a hostile same-privilege actor remains excluded, not “prevented by hidden fields.”

## 2. B2: closed native values, references and limits

### Encoding and identities

All schemas below are closed: every listed field is required, other/duplicate/missing fields are invalid; nullable fields must be present. JSON member order/whitespace and equivalent legal string escapes do not change client typed equality. Retained JSON is canonical: ordered fields as listed, compact UTF-8, decimal unsigned integers, literal non-control Unicode, quote/backslash escaped, U+0000–U+001F as lowercase `\u00hh`, unescaped solidus, and exactly one LF. No BOM, CRLF, floats, integer strings, lone surrogates, arbitrary nesting or trailing data. Parse bounded bytes with manual `serde_core` visitors/seen bits plus `serde_json::Deserializer::end()`; compare retained bytes to re-emission. No generic Value tree or schema framework is required. Existing manual decoder/emitter patterns and dependencies can be reused.

Installation identifiers are fixed ASCII `custody-1`, `ledger-1`, `change-1`, `person-1`; keys are `[A-Za-z0-9_-]{1,64}`. A key's namespace is the entire Change across opening/revision and callers. Never allocate a new Change or key on retry. Fact reference is `{ledger:"ledger-1",change:"change-1",seq:N}` with N in 1–128, identifying a record **in the established accepted prefix**, not a physical line or merely parseable tail. Result identity is that FactRef. Location is not identity.

`MaterialRef = {custody:"custody-1",sha256:HEX,bytes:B,text:"utf8-exact@1"}`; HEX is lowercase 64-hex SHA-256 over raw bytes (no implicit LF), B is 0–65,536. It selects the whole bytes only. The material's identity is custody plus digest; byte length and interpretation must agree. A digest provides integrity under the trusted custody, not authorship. File names use only validated hex. All materials are valid UTF-8, including empty text; no normalization, trimming, newline conversion or model interpretation. Same bytes may be shared across roles but cannot change the consuming role. What must contain at least one scalar outside ASCII space/tab/CR/LF (and be nonempty); Why is null or any valid UTF-8, including empty. Instruction must be nonempty; it is a proposed source expression until the approval above adopts it. No ranges, remote locators, artifacts or source prose inline in canonical records.

### Agent-visible requests

The following schema notation defines exact field order and alternatives; `P` is the literal profile tag and is emitted literally. It is not executable code.

```text
Intent = {what:MaterialRef, why:MaterialRef|null}
Open = {profile:P,op:"open_intent",ledger:"ledger-1",change:"change-1",
        key:Key,instruction:MaterialRef,replacement:Intent}
Revise = {profile:P,op:"revise_intent",ledger:"ledger-1",change:"change-1",
          key:Key,expected:FactRef,instruction:MaterialRef,replacement:Intent}
Retain = {profile:P,op:"retain_text",ledger:"ledger-1",change:"change-1",text:UTF8}
Context = {profile:P,op:"read_context",ledger:"ledger-1",change:"change-1",
           at:FactRef|null}
History = {profile:P,op:"read_history",ledger:"ledger-1",change:"change-1",
           through:FactRef|null,after:Integer,limit:Integer}
Resolve = {profile:P,op:"resolve_text",ledger:"ledger-1",change:"change-1",
           material:MaterialRef}
Query = {profile:P,op:"inspect_operation",ledger:"ledger-1",change:"change-1",key:Key}
```

`after` is 0–128, `limit` 1–8. `through:null` snapshots the current accepted tip for that call; a subsequent page supplies that returned FactRef. `after` must not exceed the selected tip. `at:null` selects current intent; a nonnull at selects context after that exact accepted record. Unknown operations/profile return unsupported without a fallback. Retention requires disclose and mutate but is not an intent adoption and has no original-key/result association. Rust computes a material reference after durable retention; clients cannot claim author/provenance there.

Open/Revise equality includes every typed field, operation/profile/key, exact fact selectors, material identities/length/interpretation, roles, and explicit null versus empty Why. Same text retained in other custody is different input. The approval receipt and current caller lease are **not client input**; original receipt remains bound to the original operation. Different receipt from a later fresh review cannot replace a retained pending/accepted receipt. Duplicate-key lookup precedes new approval generation, material retention for adoption, sequence allocation or new admission. Accepted exact match delivers its original result under current disclosure. Changed input conflicts even if text looks equivalent. A revision on the same text still creates a new fact for a new approved key, invalidating the old expected basis.

### Finite budgets

| Resource | Proposed hard limit / treatment |
| --- | --- |
| Raw UTF-8 source text per item | 4,096 bytes for instruction/What/Why; 65,536 for generated policy/review/receipt material. Retain tool limit is 4,096. |
| Native/client JSON request | 262,144 encoded bytes; reject before allocation/decoding beyond limit. |
| Record, pending control, anchor or individual structured reply | 262,144 encoded bytes including LF; preflight exact encoded size before reservation, including a one-record history reply and every required material-resolution reply. |
| Accepted records / accepted trace | 128 records / 4,194,304 bytes; opening counts. No key expiry or pruning. |
| Physical trace including interrupted suffix | 4,456,448 bytes; suffix at most one record when pending. |
| Installed material store | 768 items / 16,777,216 raw bytes, including policy, reviews, receipts and orphan proposals. No GC. Admission fails unsupported when full; existing accepted reads remain available. |
| Material staging | One `material.tmp`, at most 65,536 bytes, counted against material budget. Unknown/oversized/torn entries block mutation. |
| History page | 8 records and 262,144 encoded bytes, whichever is reached first; return at least one fitting record or unavailable, never silently omit a required record. |
| Resolution | One item/call; reply at most 262,144 bytes. Near-limit generated material whose escaping exceeds reply size returns unavailable, not truncated “complete.” Source fields always fit. |
| Owner ingress/concurrency | One in-flight call; no queued native work. Busy requests fail unavailable before dispatch. |
| Native preparation | One frozen subject/owner, in memory only, no key allocation; cleared at completion/cancel/timeout/close. |
| Host composition | At most 64 calls, 8 MiB returned encoded bytes and 60 seconds native/bridge time per explicit composition; stop with partial coverage. Approval waiting separately capped at 120 seconds/decision. No implicit load-all loop. |
| Host/child message waits | Startup 10 seconds; each native call 30 seconds; deadlines produce unknown, not rollback. |
| Stderr retention | 64 KiB ring, no material/credentials; truncation counted. |

Stored material raw-byte totals and item count include all final objects, not just accepted references. Reopen enumerates bounded inventory once; each acceptance verifies all required material. No whole-history material cache or unbounded vectors. All numeric API values fit JavaScript safe integers; persistent native file identity uses hex rather than u64 numbers at the bridge. Bounds compose: a large source set can exceed the 65,536-byte presentation budget after escaping, in which case review is unsupported **before** affirmation/reservation. Retaining a proposal does not promise that it fits an adoption. Normal dinner examples fit.

### Minimal accepted record and stable result

```text
Record = {profile:P,custody:"custody-1",seq:N,prev:FactRef|null,
          input:Open|Revise,approval:MaterialRef}
```

At N=1 input must be Open, prev null. At N>1 input must be Revise, prev and input.expected must equal the preceding FactRef; no intervening non-intent lifecycle kinds exist in P. Validate key uniqueness across all accepted records, inherited installation policy/owner, receipt subject/presentation, exact material and canonical bytes. Input supplies Ledger/Change and replacement; do not repeat these as another body. Approval is the decision grounds, presentation binds instruction and complete intended replacement. There is no extra “approved” lifecycle fact. Every sequence in P is an intent fact. Unknown facts block parsing/admission rather than establishing a partial apparently closed policy.

The **retained result binding** is fixed by P's immutable result interpretation `ck-intent-result@1`:

```text
Result = {format:"ck-intent-result@1",profile:P,kind:"opened"|"intent_revised",
          key:record.input.key,actor:"person-1",fact:FactRef(record.seq),
          previous:record.prev}
```

Kind follows the accepted input op. Actor comes from the pinned installation and validated approval receipt. Result is deterministic from the accepted record and this profile, not regenerated prose, current intent or a fresh actor. Do not persist a duplicate result object: record plus immutable profile definition permanently binds the exact original result. Reopen verifies reconstruction; unknown result interpretations are unavailable. A source upgrade must preserve this interpretation rather than alter old results. Accepted history/request/result associations and required material are retained for the slot's entire lifetime; P exposes no expiry/deletion.

## 3. B2: custody, provisioning and acceptance protocol

### Supported files and roles

The intended first prototype/test host is the available development host reported by the manager's read-only inventory as **Linux `7.2.5-4-omarchy` x86_64 GNU/Linux**, with proposed little-endian LP64/local-btrfs support. Linux 6.12 is historical context for the retained `btrfs-fsid-fh@1` primitives, **not an exact kernel requirement or evidence that P works on this available host**. Reuse that held-fd identity mechanism without downgrading to pathname or device/inode alone. Compatibility of the actual kernel/filesystem/syscall combination and the new profile remains to be established by the later authorized native/bridge checks before diagnostic measurements; release/storage qualification is separate. No compatibility test has run for this proposal. No different kernel/VM, installation, privileges or handle-based reopening is requested. Securely open normal descriptors, reject symlinks/nonregular files, hard-linked files and foreign inventory, then acquire/compare fsid and file handle from those descriptors. If unavailable or a different filesystem/topology, refuse. Identity object I is exactly `{mechanism:"btrfs-fsid-fh@1",fsid:32_lower_hex,handle_type:77,handle_bytes:20,handle:40_lower_hex}` with nonzero fsid/handle; same filesystem for root, lock and materials directory.

The native child exclusively owns this inventory; host JS does not append files:

```text
trusted-parent/slot-anchor.json       independent trusted installation anchor
trusted-parent/slot-anchor.tmp        at most one bounded anchor replacement
slot/writer.lock                      permanent exclusive flock; never replaced
slot/trace.jsonl                      sole lifecycle history
slot/checkpoint.json                  sole accepted-prefix/pending control
slot/incident.json                    monotonic observed-mutation-failure control
slot/materials/HEX.txt                immutable whole UTF-8 bytes
slot/materials/material.tmp           at most one bounded retention temporary
slot/checkpoint.tmp, slot/incident.tmp  bounded replacement remnants
```

Anchor fields/order are `{format:"ck-ref-anchor@1",profile:P,custody:"custody-1",ledger:"ledger-1",change:"change-1",owner:"person-1",policy:MaterialRef,coverage:"closed-personal-plan@1",directory:AbsolutePath,root:I,lock:I,materials:I,stage:"preparing"|"installed"}`. AbsolutePath is an explicit UTF-8 path up to 4,096 bytes, no controls, symlinks or dot/parent components. An independent host grant pins the logical values, directory and anchor path before first use; it compares the anchor, never trusts discovery from a filename. Identity fields are established during explicit preparation and later checked through held descriptors. Anchor is protected by trusted-host premises, not client fields. Stage is internal installation state, not a Change stage.

Checkpoint fields/order are `{format:"ck-ref-prefix@1",custody:"custody-1",generation:G,end:E,sha256:H|null,pending:Pending|null}`. G=0 requires E=0 and H=null. Otherwise G=1–128 and H hashes exact trace bytes `[0,E)` including each LF. Pending is `{input:Open|Revise,approval:MaterialRef}`. Its prospective sequence is G+1; actor/policy derive from the anchor. The checkpoint does not repeat accepted requests/results. Installed controls, not arbitrary JSONL lines, choose acceptance.

Incident is `{format:"ck-ref-incident@1",custody:"custody-1",state:"clear"}` or `{format:"ck-ref-incident@1",custody:"custody-1",state:"blocked",phase:"provision"|"material"|"reserve"|"append"|"checkpoint"|"recover"|"close",issue:"io"|"short_write"|"barrier"|"inconsistent"}`. Missing/malformed permanent controls are unavailable, not an initial state. Blocked incident or any incident.tmp blocks delivery and mutation. No incident repair/reset endpoint.

One non-reentrant owner holds root/lock/materials descriptors and nonblocking exclusive flock for its connected lifetime. No forks or inherited custody descriptors; child spawns no children. Host starts no successor until it has confirmed the predecessor process exited and handles are excluded. Flock alone does not prove no inherited descriptors remain. The installed path is checked against held identities at call boundaries; copied/moved/replaced directories or locks refuse. Same-user attackers and consistent rollback of all evidence are not detectable guarantees.

### First provisioning versus reopening

Provisioning is a trusted explicit host command, never inferred from an empty directory and never an agent field. It prepares this one unused slot but does **not** create an accepted Friday fact.

1. Exclusively create slot, permanent lock and materials directory, capture I values under the lock, and sync new files/directories and changed parents. Exclusively write/sync the preparing anchor and its parent. Before an anchor survives, a crash needs explicit host reconciliation/refusal; neither absent path nor anchor.tmp authorizes automatic first use.
2. Under the preparing anchor, construct only the deterministic initial inventory: empty trace, G=0/E=0/null pending checkpoint, clear incident, and exact policy material. Sync each file and each changed directory. Resume preparation only with matching grant/identities and matching initial bytes; missing initial entries can be exclusively created. Any pending request, accepted bytes, incident or unrelated entries block.
3. Replace anchor using exclusive same-parent temp, file sync, rename and parent sync to installed; validate installed anchor and complete initial inventory. Only now permit client calls. Loss after preparation still yields no accepted opening.
4. Reopen requires installed anchor, permanent controls and identities. It initializes nothing, does no migration, creates no missing control and completes no pending operation. Validate prefix/schema/material/inventory; perform fresh required file/directory barriers before acceptance-bearing historical delivery.

Anchor.tmp housekeeping is supported only under the pinned lock and complete valid initial inventory: preparing anchor with canonical temp identical or differing only to installed stage, or installed anchor with identical installed temp. Revalidate grant/identities; unlink the known abandoned temp, sync parent, then perform the normal procedure with a fresh exclusive temp. Never promote temp or let it replace a missing anchor. Installed/preparing reversed-stage, partial, foreign, malformed or noninitial temp refuses and preserves evidence. Unlink-before-parent-sync cuts revalidate absence/presence and sync parent; observed failure latches incident. This is the retained opening profile's restricted cleanup shape, not general storage repair.

The first `open_intent` request retains Friday/instruction/Why, reviews target plus policy with previous=null, and accepts sequence 1 under §4. An interrupted opening has the same durable original key/pending binding as a revision; retry does not allocate a second Change. A second opening with a different key in an occupied slot is unsupported; reusing an accepted revision key for opening conflicts.

### Immutable material retention

Under the same writer, validate text, roles, limits and current authority before retention. Hash exact bytes; if final HEX.txt exists, securely read and verify all bytes/length/hash/UTF-8, then synchronize file and directory before returning its reference. A differing same-hash object is damage, not overwritten. Otherwise exclusively create material.tmp, write exact bytes, sync file, rename to the absent final name under sole-writer exclusion, sync materials directory, and reread/validate. No hard-link/cross-device fallback. Required policy, replacement, instruction, previous text, presentation and receipt must all pass before reservation and again before accepted-prefix installation. No metadata database or universal content service: digest/interpretation plus inherited anchor custody supplies integrity/retention; consuming record/receipt supplies role and provenance. Unadopted retained text is caller-supplied data; actual approval attribution comes only from the receipt.

Crash with a complete valid UTF-8 material.tmp whose digest's final object is absent permits **explicit retention retry only** to finish that exact item after revalidation and barriers; if final exists and equals it, explicit retry may unlink the duplicate temp and sync directory. It never adopts intent. A partial tmp, foreign bytes, symlink, over-budget item or mismatch is unavailable and preserved; no automatic GC/repair. A read can still deliver an intact accepted prefix if the temp is bounded, regular and no required accepted object is damaged, marking readiness `blocked_material_temp`. New acceptance blocks until supported exact retention recovery. A failed material write/barrier latches incident; process interruption without observed failure is distinct. Missing accepted material is never recovered from temp, transcript or another same-digest location without an adopted custody transition.

Orphan complete final materials remain retained/count against limits; they are not accepted facts. Enumeration/counting is bounded; rehash required accepted objects, rather than assuming a final filename is integrity. No separate redundant per-item manifest, material provenance log, garbage collector or second lifecycle store.

## 4. Accepted-prefix cuts and recovery

The logical acceptance unit is record + required durable material + original request/result binding + installed synchronized prefix. There is no external effect transaction.

For a new operation, under the single owner and frozen authority lease:

1. Validate complete typed input and current disclosure; validate installed custody/incident/prefix. Resolve original key first. Accepted exact match returns original Result; changed input conflicts. A different pending key blocks new operations. Unknown control never means absent.
2. For a new key, require mutate, fixed policy closure, supported empty/open or exact current expected fact, and all material budgets/encoded sizes. Prepare/read the exact subject and obtain authentic affirmative UI. Recheck current lease and exact subject after review. For a matching pending key, require exact input, original receipt/material, fresh completion approval and current mutation authority; do not replace its original receipt.
3. Durably retain required presentation/receipt and material. Replace checkpoint with unchanged accepted G/E/H plus Pending: temp exclusive create → full write → file sync → rename → slot directory sync → re-read. Pending reserves original input/evidence but is not accepted lifecycle history.
4. Emit the one deterministic prospective record. Validate any suffix is an exact byte-prefix of it. Append only missing bytes; sync trace and slot directory; verify complete prospective bytes and required material. No truncation, rebasing or sequence reallocation.
5. Recheck authority/policy/expected subject under lease. Replace checkpoint with G+1, new E, SHA-256 of complete prefix, pending=null, using the same file/rename/directory barrier protocol. Revalidate installed control, accepted bytes and required material.
6. **Only after step 5's directory sync and revalidation may the native engine emit `accepted` with Result.** Host fresh disclosure may still suppress it; a delivered tool result is not the native commit point. No acknowledgment at reservation, append, trace sync, temp sync or rename alone.

The digest covers complete prefix, not merely the last record. Full validation scans are acceptable initially; no unmeasured index/cache is a prerequisite. Every acceptance/material I/O short write, genuine I/O error, failed barrier or uncertain replacement sets the owner unavailable immediately and attempts monotonic incident replacement/sync. Failed incident retention does not clear the in-memory latch; a successor cannot recover an observation that never survived. No later successful barrier, new key or clean shutdown clears retained failure evidence. Corruption refuses non-destructively. Expected contention/invalid client input is not a storage incident.

| Process-cut surviving evidence, no retained incident | Allowed behavior |
| --- | --- |
| Initial/accepted checkpoint, no pending, exact trace end | Reads/retries of accepted results; fresh admission if within bounds. No accepted opening at G=0. |
| Complete orphan materials, no pending | Count them; no adopted fact. No automatic mutation. |
| Installed Pending, empty or exact partial prospective suffix | Read prefix/pending without writes. Only current-authorized exact resubmission with fresh completion approval may append missing bytes and commit. |
| Installed Pending, full prospective record, acceptance temp | Still pending, not accepted. Exact resubmission may remove only the validated temp under lock, sync directory, and rerun commitment; never promote temp. |
| No installed Pending, canonical reservation temp, exact accepted trace end | Read reports `blocked_control_temp`/no installed binding. Explicit exact resubmission matching temp may remove it after validation/barrier and run normal reservation. A different request does not clear it. |
| Installed accepted checkpoint, exact accepted trace, matching obsolete checkpoint temp | Read and exact accepted retry deliver accepted history; readiness remains blocked. P does not clean this nonessential remnant or claim mutation readiness until separately authorized recovery outside P. |
| Installed accepted checkpoint plus bounded unexplained extra suffix | Deliver intact accepted prefix with `blocked_unaccepted_tail`; no new mutation or tail removal. Extra parseable record is unaccepted. |
| Pending mismatch/extra suffix; unexplained/partial checkpoint temp; missing control; accepted-prefix damage | Unavailable, preserve evidence. No guessed input, checkpoint, acceptance or repair. |
| Installed accepted checkpoint after rename but before directory sync | On reopen, whichever installed checkpoint survives is authoritative only after matching all grounds and fresh barriers. It may establish acceptance although no acknowledgment was sent; earlier pending control permits only exact resumption. No universal power-loss claim. |
| Lost reply or post-acceptance delivery denial | Later authorized read-only query returns original Result; acceptance is not undone. |

Checkpoint temp validation compares only these supported relationships: identical installed control; prospective Pending at unchanged G/E/H and no suffix; or accepted successor derived from installed Pending and full exact suffix. The original receipt must be valid in every pending/temp case. No temp chosen as authority. Partial/ambiguous temps refuse rather than promise unsupported recovery. Cleanup only in explicit mutation-capable resubmission/retention/provisioning paths, never a read.

## 5. B3: read-only query, historical navigation and delivery

`inspect_operation` performs only authorization, secure reads, deterministic validation and required synchronization of already existing files/parents. **It does not write, reserve, append, clean temps, repair, run Checks, display an adoption UI or finish Pending.** A read failure quarantines the connected owner in memory without persisting an incident from that read; it returns unavailable. P's genuinely write-free reads deliberately do not claim retention of that unsaved observation across process loss. Missing/corrupt installed controls and retained incidents still refuse on reopen. This distinction from mutation incident retention is explicit, not reuse of a mutation dispatcher renamed “inspect.”

Structured tool responses are the following closed variants (field order as shown):

```text
Accepted = {profile:P,kind:"accepted",result:Result}
Operation = {profile:P,kind:"operation",key:Key,
             status:"accepted"|"pending"|"not_found_now",
             result:Result|null,tip:FactRef|null,readiness:Readiness}
Error = {profile:P,kind:"error",code:"invalid_input"|"unsupported"|"conflict"|
         "denied"|"unavailable",acceptance:"not_established"}
TransportUnknown = {profile:P,kind:"transport_unknown",reason:"timeout"|"cancelled"|
                    "closed"|"protocol"|"cleanup_unconfirmed",acceptance:"not_established"}
Readiness = [zero to four unique tokens in this fixed order:
             "blocked_pending","blocked_control_temp",
             "blocked_material_temp","blocked_unaccepted_tail"]
```

Empty readiness means ready; include every established blocker, not just a favored one. This derived bounded array is not lifecycle state. Permanent control/incident/material corruption still yields unavailable rather than a partial apparently valid prefix.

Operation result is nonnull only for accepted; no request prose/material is leaked by pending. Under an authorized valid prefix, pending means the **installed** Pending binds that key; not_found_now means no installed accepted/pending association for that key at this inspection. Valid uninstalled temp still blocks readiness and may hide a future exact recovery. Empty lookup does not establish permanent non-acceptance: an unsent/delayed host request may still arrive later, or another authorized exact invocation may accept. There is no tombstone/cancel primitive, outbox, scheduler or negative-result history. Code `conflict` describes the submitted attempt, not the outcome of an earlier input under the key. Error intentionally makes no blanket definitive-original-nonacceptance claim, even for a refusal; transport loss and failure-after-acceptance cannot be flattened into rollback.

At ingestion and final delivery check current disclosure before exposing key existence, result, tip, metadata, material or denial details. Denied/unavailable do not reveal whether the key exists. Already accepted exact retries/query need no new mutation permission or human approval. They preserve original actor and Saturday fact even after Sunday. Current context is a separate query; never label an original result as current intent. If prefix is valid but readiness blocked, historical reads of the intact accepted prefix may proceed with that readiness; retained incident or required accepted material damage returns unavailable, not a fabricated complete view.

Read outputs use these schemas:

```text
Retained = {profile:P,kind:"retained",material:MaterialRef}
Resolved = {profile:P,kind:"resolved",material:MaterialRef,text:UTF8}
ContextResult = {profile:P,kind:"context",tip:FactRef|null,at:FactRef|null,
                 intent:Intent|null,approval:MaterialRef|null,policy:MaterialRef,
                 coverage:{first:Integer,last:Integer,through:FactRef|null},
                 readiness:Readiness}
HistoryResult = {profile:P,kind:"history",tip:FactRef|null,through:FactRef|null,
                 records:[Record],coverage:{first:Integer,last:Integer},
                 next_after:Integer|null,readiness:Readiness}
```

At G=0 context has null tip/at/intent/approval, coverage first=last=0/through=null, explaining a provisioned but unopened slot; policy is configured installation material, not yet an adopted opening policy. History is empty with through=null, first=last=0, next_after=null. Never fabricate Friday. Otherwise context's at is the selected fact, coverage first=1/last=at.seq/through=at; tip reports actual latest accepted fact. Context returns references, not resolved text. History pages have first/last actual returned sequences; empty page first=last=0; next_after equals last returned seq if more remain through the fixed selected tip, else null. Reading an older prefix still reports current tip separately. Snapshot pagination concerns this one monotonic accepted prefix, not a multi-Change transaction.

Resolve returns exact whole text only, under current disclosure, verifying reference/custody/hash/length/interpretation and item budget. It is data, not executable instruction. Fresh-reader composition: reopen → context or bounded history → resolve instruction/replacement/receipt → resolve receipt.presentation and policy as needed. The screen and receipt contain enough historical explanation without originating-session access. Bound the composition and report remaining pages rather than asserting complete history after one page. Sender manually retains outgoing request bytes/key in its own external fixture/application file before dispatch when it claims lost-reply recovery. Pi transcript/appendEntry/Codemode.store are not required authority; no kernel-owned sender durability is introduced.

## 6. Thin bridge and native child lifecycle

### Proposed concrete framing

Select one host-owned child running a new opt-in native bridge mode `changekernel --referenced-intent-bridge`. **It does not exist today:** `src/main.rs` implements help/version only. Startup never occurs in the extension factory; start on explicit trusted provision/connect or first tool use. Use Node child_process spawn with an explicit executable path, no shell, piped stdin/stdout/stderr, no inherited custody fd and no child descendants. Packaging is subordinate to P and separately qualified; retained Pi 0.85.1 adapter dependencies remain unchanged. An external disposable Pi 1.2.0 adapter can consume the installed host API without pretending to migrate that retained package.

Every frame is 4-byte unsigned big-endian byte length followed by that many UTF-8 JSON bytes, no framing LF. Length 1–262,144; bound before buffering. Payload is canonical JSON including its terminal LF on native-emitted frames; inbound client wrappers may use equivalent legal JSON. One request and one reply at a time, IDs 1–1,000,000 monotonically per child; no multiplex/reuse. A partial/oversized/bad-UTF8/duplicate-field/trailing/wrong-ID/wrong-profile frame closes the connection fail-closed. Stdout is protocol only; diagnostic text must stay on bounded stderr.

Startup host envelope fields/order:

```text
Connect = {bridge:"ck-intent-bridge@1",id:1,kind:"connect",
           mode:"fresh_provision"|"resume_provision"|"reopen",
           grant:{profile:P,custody:"custody-1",ledger:"ledger-1",change:"change-1",
                  owner:"person-1",coverage:"closed-personal-plan@1",
                  policy:MaterialRef,directory:AbsolutePath,anchor:AbsolutePath},
           authorization:Lease}
Connected = {bridge:"ck-intent-bridge@1",id:1,kind:"connected",profile:P}
Call = {bridge:"ck-intent-bridge@1",id:Integer,kind:"call",
        authorization:Lease,request:AgentRequest}
Reply = {bridge:"ck-intent-bridge@1",id:Integer,kind:"reply",value:ToolResponse}
Prepare = {bridge:"ck-intent-bridge@1",id:Integer,kind:"prepare",
           authorization:Lease,request:Open|Revise}
Prepared = {bridge:"ck-intent-bridge@1",id:Integer,kind:"prepared",
            input:Open|Revise,presentation:UTF8}
Confirm = {bridge:"ck-intent-bridge@1",id:Integer,kind:"confirm",
           authorization:Lease,input:Open|Revise,confirmed:true}
Discard = {bridge:"ck-intent-bridge@1",id:Integer,kind:"discard"}
Close = {bridge:"ck-intent-bridge@1",id:Integer,kind:"close"}
Closed = {bridge:"ck-intent-bridge@1",id:Integer,kind:"closed"}
```

AgentRequest is exactly the seven request variants in §2; ToolResponse is exactly Accepted, Operation, Error, Retained, Resolved, ContextResult, HistoryResult or the host-only Discarded response `{profile:P,kind:"discarded"}`. TransportUnknown is adapter-generated when no trustworthy native reply is deliverable. No arbitrary payload variant is allowed.

Lease is §1's exact object; modes/grant/authorization/confirm are host-only. The child knows the configured owner from its independent grant, not a forwarded agent actor. Call allows retain/context/history/resolve/query and accepted exact Open/Revise retrieval only. New/pending Open/Revise through Call return unavailable with no mutation, forcing Prepare/Confirm. Prepare resolves key first: an accepted match returns Reply/Accepted directly; changed input Reply/Error; new/pending prepares the immutable review without reservation. It rejects another active prepared subject. Confirm compares complete frozen typed input and the active preparation, validates true literal and lease, constructs original receipt if new, then invokes native acceptance. A prepared pending subject (including a validated prospective reservation temp) uses its retained original receipt and **that receipt's exact retained presentation**, reviewed again. Confirm must reuse those original grounds: it cannot mint a different receipt when cleaning/re-reserving a prospective temp. Confirmation is not durable until native reserve/acceptance. Discard clears in-memory preparation and replies with `{profile:P,kind:"discarded"}` in Reply; creates no history. A host abort between Prepare and Confirm cannot create native Pending, though proposals already retained remain.

Connect/Prepare/Confirm/Call failures use Reply/Error with the matching ID; an invalid frame may instead close without a reply. Close/Discard are host lifetime operations and require no mutation grant, but do not disclose private data. Exhausted IDs require an explicit clean reconnect; never wrap them.

No secret approval token is claimed. The call split prevents **ordinary tool parameters** bypassing the UI in the trusted adapter; malicious code with access to the host pipe can confirm, which is excluded by the supported trust premise. The adapter must not register a generic “send envelope” tool. Tool schema validation and Rust validation both apply; host lease/receipt injection is explicit and never spread/merged from request objects.

### Pi mapping and shutdown

Register one typed tool per agent-visible operation in §2, with outputSchema matching the response variants, matching structuredContent and human content/details. Mark errors/transport_unknown with isError=true; a returned object/resolved promise alone is not success. Annotate reads as readOnlyHint for ergonomics, not enforcement. Codemode invokes these tools without importing Node/SDK; it cannot spawn the child directly. Host serializes all calls including reads and review continuations; concurrent calls get bounded busy/unavailable, not a hidden waiting queue.

On cancellation before frame dispatch, send nothing; after dispatch, report transport_unknown unless an actual final response is retained/deliverable. Do not forward AbortSignal as a native rollback. Confirm in flight may commit despite signal/timeout. Stop accepting calls on connection failure. Native EOF exits without completing Pending; if acceptance already occurred it remains. No automatic reconnect/resend or new key. Operator/application can explicitly reconnect only after predecessor exit is confirmed and then query or exact-resubmit.

Install idempotent session_shutdown cleanup (also used by explicit disconnect/reload/session replacement). Stop ingress, discard unconfirmed preparation, wait at most 2 seconds for a running call, then send Close if protocol is usable. Close performs no pending completion; it closes every descriptor and releases lock before Closed. Wait 2 seconds for exit; if needed send SIGTERM, wait 2 seconds, then SIGKILL and wait 2 seconds. Treat `kill()` success as a signal, not proof of exit or fd release. Until exit is actually observed, retain blocked owner state, return cleanup_unconfirmed and do not start a replacement. Shutdown handler promises cannot cover uncatchable Pi death. Stdin EOF/host death requests child exit at next bounded safe point; a blocked syscall may require externally confirmed termination. A child left after abrupt host death is not silently adopted by a new session. These timeouts bound waiting/reporting, not OS syscall duration or guaranteed cleanup.

## 7. Exact-source examples and demo

Illustrative aliases below stand for the fully expanded MaterialRef/FactRef objects above, **not accepted wire encodings**. Bytes shown inside backticks have no terminal LF unless explicitly stated. Rust computes each digest; no invented hex is evidence.

| Alias | Exact bytes/meaning |
| --- | --- |
| I0 / W0 | `Organize dinner Friday`; instruction and initial What may share bytes, with different consuming roles. |
| I1 | `Move dinner to Saturday` |
| W1 | `Organize dinner Saturday` |
| I2 / W2 | `Move dinner to Sunday` / `Organize dinner Sunday` |
| F1, F2, F3 | `{ledger:"ledger-1",change:"change-1",seq:1|2|3}` respectively. |

For example, the fully expanded Saturday request is the following JSON. Hashes were calculated from the exact illustrative UTF-8 bytes above; they are byte-identity examples, not claims that any material is enrolled or a fact accepted:

```json
{"profile":"ck-referenced-intent@1","op":"revise_intent","ledger":"ledger-1","change":"change-1","key":"saturday-1","expected":{"ledger":"ledger-1","change":"change-1","seq":1},"instruction":{"custody":"custody-1","sha256":"2f2a619fb0e22ff4fd7271d7b2653b15f7f7f241fcc509bb1550810a592ea59d","bytes":23,"text":"utf8-exact@1"},"replacement":{"what":{"custody":"custody-1","sha256":"cb615c78e42b51322fa47879b94efe8580ca0e631874efabac6e1f0d1fca7e7c","bytes":24,"text":"utf8-exact@1"},"why":null}}
```

Its accepted original result, if acceptance is actually established, is exactly:

```json
{"format":"ck-intent-result@1","profile":"ck-referenced-intent@1","kind":"intent_revised","key":"saturday-1","actor":"person-1","fact":{"ledger":"ledger-1","change":"change-1","seq":2},"previous":{"ledger":"ledger-1","change":"change-1","seq":1}}
```

1. Explicit provision (no accepted fact), retain I0/W0. Submit Open key `friday-1`, replacement What=W0/Why=null. Review includes policy and unopened previous=null; affirmative acceptance yields Result opened/F1. Read/retain alone never creates F1.
2. Read context at null → at=F1. Retain I1/W1, submit Revise key `saturday-1`, expected F1, instruction I1, replacement What=W1/Why=null. Full frozen review and affirmative selection yield Record seq2/prev F1 and original Result intent_revised/F2. Receipt references the exact presentation; Friday and Saturday bytes remain resolvable.
3. Close and confirm producer exit. Start a different Pi session/child with Reopen and disclosure authorization; retrieve history 1–2 and exact grounds. No original transcript is read or approval synthesized.
4. Accept independently reviewed Revise `sunday-1` expected F2 with I2/W2 → F3. Query `saturday-1` → accepted original Result F2/previous F1/actor person-1; current context still at F3. Accepted exact resubmission also returns F2 without review, append or mutate permission. Query itself does not test supplied-input equality; explicit resubmission does.
5. `saturday-1` with Why=empty reference rather than null conflicts; `monday-1` based on F1 conflicts. Same W1 but changed material interpretation/custody, instruction, expected subject or key binding after approval fails. No automatic rebase/new key.

## 8. Focused implementation acceptance and diagnostic benchmark

**These are proposed future checks, not runs or results.** Use ordinary native unit/integration tests at consequential boundaries, real btrfs custody and actual child framing. Do not require another test framework, count target, model evaluator, inventory-wording test suite or generic policy engine.

| Check | Required observable outcome / actual boundary |
| --- | --- |
| Positive dinner and fresh reader | Real Pi TUI approval → real Rust acceptance, clean owner exit/new session reopen, exact instruction/What/Why/policy/review/receipt resolution. Sunday then original Saturday query leaves F3 current and trace unchanged. A human smoke confirms the supported local approval profile; simulated UI is not real-user adoption. |
| Exact-source and forged approval | Tool actor/approval/receipt/lease/unknown fields rejected; mutation Call cannot bypass Prepare/Confirm; altered text/ref/expected after Prepare cannot confirm. No native record; direct forged host pipe demonstrates excluded compromised-host premise, not a claimed isolation test. |
| Stale subject and input equality | Two Friday-based keys cannot both replace F1; null/empty, non-ASCII, controls, escapes, same-text new fact, changed op/reference under existing key. Accepted original Result/actor stable across reopen. |
| Closed policy and authority | Wrong/extra mandatory policy, unknown coverage/relationship/evaluator, unsupported filesystem/identity, unavailable/disallow mutate refuse. Disclosure allowed/mutate denied still permits accepted query, not pending completion. |
| Material integrity/cuts | Fault write/file-sync/rename/directory-sync and before reservation/commit; orphan material never adopts. Missing/corrupt accepted policy/text/receipt/review blocks dependent reads/acceptance. Complete material.tmp exact retry only; partial/foreign temp refuses. |
| Prefix and provisioning cuts | Initial controls versus reopened missing controls; anchor temp restrictions; reservation temp, installed Pending, partial/full suffix, checkpoint temp, rename/barrier and accepted lost reply. Query byte-snapshot unchanged and no cleanup/adoption. Exact authorized retry recovers supported deterministic cuts, never unexplained/torn controls. |
| Reply denial/loss and read-only | Deny host disclosure after native commit, drop reply frame, timeout/cancel and delayed dispatch after not_found_now. Error/unknown never displayed as rollback. Query pending/absent/accepted causes zero writes, revision/Check attempts or cleanup. Original request retained by sender fixture, not kernel outbox. |
| Bounds, transport and lifetime | Max/control-escaped source sets, size preflight, page limits, duplicate/malformed frame/IDs, bounded stderr, competing writer, reload/shutdown twice, active-call signal/EOF, actual process exit/lock release. No replacement owner while cleanup uncertain. |

### Repeatable finite measurement setup

Use deterministic ASCII fixtures only, no inference. Three paired scale points (history count includes accepted opening): **short 3 records with 32-byte What**, **medium 32 with 512-byte What**, **near-limit 127 with 4,096-byte What**. Instruction is 32 bytes, Why=null, unique monotonically numbered keys and ASCII suffixes; pad What with ASCII `x` to exact size. Each setup preserves real P approval receipts/presentations and stays within 768 items/16 MiB raw material/4 MiB trace. Native new-revision sample grows near-limit 127 → 128, never measures unsupported overflow as a “fast acceptance.” Also test an opening with instruction, What and nonnull Why each containing 4,096 U+0001 bytes outside timing: its escaped three-field presentation exceeds the 65,536-byte review-material budget and must refuse before approval/reservation. Report actual trace/material bytes/items at each point.

For each scale/path/mode plan **exactly 100 measured attempts, never a target of 100 successes**. Each planned attempt consumes one slot even if setup fails, the call is refused, times out, returns an incorrect outcome or cannot be verified; never replace it, retry it for timing or append extra attempts. Retain attempted index, setup/dispatch/completion status, available timings and correctness evidence for every attempt. Report planned/attempted/successful/failed/unverified/unattempted counts and reasons; mark the cell incomplete if any of the 100 lacks a successful validated outcome or execution stops early. Stop early for blocked custody, unresolved cleanup or another safety condition; preserve the unfinished count, not inferred zeros. Existing per-call/composition deadlines apply. Publish headline p50/p95 only when all 100 planned attempts completed correctly, using nearest-rank 50th/95th ordered samples; otherwise quantiles are unavailable, not calculated from a success-only replacement pool. Report raw observations and min/max for any successful subset explicitly as incomplete diagnostics; failures/refusals are separate outcomes, not low-latency success samples.

Warm mode: same Pi host with OS cache allowed, **at most five untimed warmup attempts** then the 100 planned measured attempts. Record warmup failures separately; do not replace failed warmups, and stop the cell if they leave custody/cleanup unsafe. Queries/history use the same connected child; reopen necessarily closes and confirms the previous child then opens a new child in that warm Pi host. New acceptance uses at most 105 independently explicitly provisioned disposable slots (5 warmup attempts plus 100 measured attempts), connected one at a time, each at the stated baseline count; it is not repeated accepted retry. Synthetic fixed identities are scoped to each isolated test installation, never treated as replicas of live user custody. Cold mode: fresh Pi process/extension plus fresh native child per planned attempt, no application caches, at most 100 attempts and no warmups; **process-cold, OS cache uncontrolled**, not OS cache-cold. Do not drop global caches or require privileged setup. Preserve initialized fixtures by legitimate native setup, not copying enrolled custody. Cleanly stop/confirm exit between independent instances; report connection/setup cost separately where excluded.

Paths and timing windows:

| Path | Native window | UI-excluded Pi/host window and work |
| --- | --- | --- |
| Connect/reopen | Entry before secure opens through connected validated owner | Explicit Pi model-free command start through connected response; cold also reports Pi launch-to-ready separately. |
| New revision | Confirm ingress through acceptance response, with required material checks/barriers | Prepare + test-fixture affirmative handoff + Confirm + host final disclosure. Include native presentation generation, subject/lease validation and bridge encoding; **exclude actual terminal rendering, page traversal, UI gating and human dwell**, whose cost is not measured by the automated fixture. Label this UI-excluded host/native timing, not full TUI end-to-end latency. Separately report preceding three retain calls (instruction/What/optional Why; two with Why=null) and their bytes/cost, and UI-excluded total preparation+acceptance cost. |
| History/resolve | Each history/resolve ingress through validated response | Entire bounded history drain and resolution of each record's instruction/What/Why(if any)/receipt plus each distinct presentation and policy; report calls and total, not merely first-page latency. Split into explicit compositions when 64-call/8-MiB/60-second budget reached, preserve continuation and sum completed segments; no claim of single-composition full near-limit history. |
| Original-result recovery | Read-only query ingress through Operation/Result | Query an earlier key after a later accepted revision, validate original fact and independently verify unchanged current context; time query separately from verification. No renewed approval or acceptance. |

Instrument native entry/exit and logical file I/O/accounting boundaries following retained `LedgerContinuityWork` patterns; host monotonic timings enclose actual framing and host/native subject validation, not excluded terminal UI work. CPU: per-process user/system deltas for Pi and Rust; memory: per-sample high-water RSS for both (warm lifetime HWM labeled, not falsely operation-local). Record actual file bytes read/written, bridge payload/framing bytes returned, validation/hash/copy counts where supported, and bridge-call count. State whether counters count logical syscall bytes rather than physical device I/O; unavailable metrics stay gaps, not zeros. Report eligible p50/p95 native versus UI-excluded Pi/host timing under the complete-cell rule above; their difference is composite measured overhead, not a pure causal Pi cost or the omitted UI cost. Setup/history generation and correctness verification are outside timed windows except explicitly counted preparation above. Every successful sample must validate result/prefix/material and no duplicate acceptance; retain all other attempted outcomes under the bounded attempt/incomplete rules above.

Model-free automated measurements use a **test-only trusted UI fixture** invoking the same host Prepare/Confirm/framing/native path, with a fake affirmative event explicitly labeled simulated. This fixture **does not execute the actual TUI renderer or traversal/affirmation gates**; its measurements are UI-excluded host/native mechanics, not terminal performance or authentic approval evidence. It is compiled/composed only into the external test driver, not an environment variable or flag permitting production bypass. Production adapter has no `autoApprove`/benchmark mode. The separate human-TUI smoke executes the actual renderer, complete deterministic presentation traversal and affirmative selection through the production approval path and checks the retained subject/result; report it as correctness/feasibility evidence without benchmark quantiles or a measured UI-cost claim. Simulated fixture acceptance is not real-user adoption. Measure actual bridge/native paths; mocks alone do not count.

Candidate execution, after the review/adoption gate, belongs to disposable external projects with isolated `PI_CODING_AGENT_DIR`, explicit external session directory, `--offline --no-approve --no-extensions --no-mcp --no-skills --no-prompt-templates --no-themes --no-context-files`, and only the reviewed external adapter plus explicitly loaded `builtin:codemode` and domain tool allowlist. No project-local installs/links/skills, live credentials, mutable-checkout controller or retained old custody. Record exact Git/native/adapter bytes, installed Pi 1.2.0 identity, Rust/toolchain, Linux/kernel/btrfs/mount/device, Node version, flags and instrumentation before measurement. Pi settings/resource isolation is reproducibility, not OS isolation. Thresholds are diagnostic only: investigate scans/round trips/copying/growth after baseline; no invented latency pass/fail, production claim or deployment/qualification from these measurements.

## 9. Reuse, missing support and implementation handoff proposal

Inspected source/test text at base `85153b2773df9d9aa402911bb92c78eca6d110a9` is shape/evidence, not freshly executed behavior:

| Existing path | Proposed reuse; what is not supplied |
| --- | --- |
| `src/application/ledger_continuity.rs` | Guard-owned bounded ingress/current disclosure/mutation distinction and one owner composition; fixed `owner-1` fixture is not person authentication or exact UI approval. P needs new closed host/types, not altered v6 semantics. |
| `src/adapters/jsonl/ledger/history/operations.rs` | Key-first exact accepted return, expected-intent conflicts, reserve/append/sync/checkpoint and final disclosure separation. Existing mutation can complete pending; cannot be reused as read-only query. |
| `src/adapters/jsonl/ledger/history/sequential.rs` | Sequential prefix hash/schema/semantic validation and bounded spans/key lookup; existing inline normalized requests and built-in 80-byte Check are not P's references/policy. |
| `src/adapters/jsonl/ledger/storage.rs`; `src/adapters/jsonl/opening/storage.rs` | Secure descriptor opens, exclusive flock, full writes/file+parent barriers, same-parent replacement and monotonic mutation incidents. New material directory/inventory and write-free reads require explicit new profile integration. |
| `src/adapters/jsonl/ledger/continuity/identity.rs`, `receipt.rs` | Existing held-fd btrfs identity grammar/acquisition and live binding checks; apply to P root/lock/material directory without weakening identities or making receipt authority client-writable. |
| `tests/ledger_continuity.rs` (final authorization/pending/process-cut cases); `tests/ledger_history.rs` | Extend observable lost/denied accepted reply, prefix inspection and exact retry/fresh-reader patterns. None proves new material/UI/framing support. |
| `Cargo.toml`; current manual codecs | Already pinned serde_core/serde_json/sha2/libc suffice for closed native codec, SHA-256 and local I/O; no dependency change proposed. |
| `src/main.rs`; `package.json` | CLI is help/version stub; retained TS adapters pin Pi 0.85.1. Real bridge and isolated 1.2.0 consuming adapter are missing, not silently supplied by docs. |

Installed Pi 1.2.0 `README.md`, `docs/extensions.md`, `tui.md`, `rpc-extension-ui.md`, `codemode.md`, `packages.md`, `configuration.md`, `settings.md`, `cli.md`, `security.md`, `environment-variables.md`, and complete `hello.ts`, `tools.ts`, `confirm-destructive.ts`, `timed-confirm.ts` examples were read as API feasibility evidence. Relevant guidance: custom UI in actual TUI only, structuredContent/outputSchema/isError for code-use, parallel tools need host serialization, factory must not start children, idempotent session_shutdown, isolated agent settings and explicit built-ins. They are not authentication, rendering qualification or proof cleanup always runs. No model primitive is selected.

**Proposed cohesive native owner slice:** new P-specific kernel/application/JSONL modules and integration tests, with private shared storage/identity reuse kept behaviorally unchanged for old profiles. That owner controls schemas/material/prefix/query and bridge native dispatch together. After native contract tests, a thin external Pi-host owner implements the exact UI/lease/framing/lifetime mapping against those frozen messages; no shared-envelope parallel ownership. End-to-end review and approved diagnostic runs follow. Manager alone assigns actual paths/owners and integration sequence; this is not a competing roadmap or worker dispatch.

**B1–B3 author disposition:** closed on paper by the precise trusted-local premise/policy/UI, referenced format/material-prefix protocol, and separate query/retry/error/bridge contracts above. All require independent challenge and user adoption; no self-acceptance. User-owned choices presented for that gate are the honest local-host trust limitation, closed personal-plan policy, fixed finite limits/whole-text encoding, fail-closed unsupported/torn-cut treatment, and deliberately limited clean/process recovery claim. If stronger authentication, policy coverage or repair/reboot guarantees are mandatory, this packet is blocked for that requirement rather than silently “ready” under a weaker premise. No further product scope decision is hidden behind a generic TODO.
