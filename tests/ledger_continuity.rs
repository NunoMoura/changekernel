#![cfg(target_os = "linux")]
//! Ordinary source consumers. Fresh, isolated test-owned btrfs directories only.
use changekernel::*;
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
    sync::{Arc, Mutex},
};
static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Owner;
impl LedgerContinuityGuard for Owner {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
    fn member(
        &mut self,
        _: &str,
        _: &str,
        _: LedgerContinuityMemberPermission,
    ) -> LedgerPermission {
        LedgerPermission::Allow
    }
}
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!(
            "ck-continuity-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&p).unwrap();
        fs::create_dir(p.join("state")).unwrap();
        Self(p)
    }
    fn grant(&self) -> LedgerContinuityGrant {
        self.grant_at(&self.path("anchor.json"))
    }
    fn grant_at(&self, anchor: &Path) -> LedgerContinuityGrant {
        let pairs = std::array::from_fn(|i| LedgerPair {
            change: format!("change-{i}"),
            custody: format!("member-{i}"),
        });
        LedgerContinuityGrant::new(LedgerContinuityGrantSpec {
            profile: "ck-ledger-continuity@6",
            ledger: "ledger-1",
            custody: "ledger-custody",
            owner: "owner-1",
            workspace_id: "workspace-1",
            binding: "fixture@1",
            directory: &self.0.join("state/ledger"),
            anchor,
            grants: &pairs,
            policy: "fixture-notice@1",
            check: "notice-what@1",
            evaluator: "utf8-length@1",
            adopter: "owner-1",
        })
        .unwrap()
    }
    fn host(
        &self,
        mode: OpeningMode,
        hook: Option<LedgerContinuityIoHook>,
    ) -> Result<LedgerContinuityHost, OpeningError> {
        LedgerContinuityHost::connect(self.grant(), mode, &mut Owner, hook)
    }
    fn host_at(
        &self,
        anchor: &Path,
        mode: OpeningMode,
        hook: Option<LedgerContinuityIoHook>,
    ) -> Result<LedgerContinuityHost, OpeningError> {
        LedgerContinuityHost::connect(self.grant_at(anchor), mode, &mut Owner, hook)
    }
    fn path(&self, s: &str) -> PathBuf {
        self.0.join("state").join(s)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if std::thread::panicking() {
            eprintln!("preserved fixture {}", self.0.display())
        } else {
            fs::remove_dir_all(&self.0).unwrap()
        }
    }
}
fn input(v: Value) -> LedgerContinuityInput {
    let mut bytes = serde_json::to_vec(&v).unwrap();
    let i = LedgerContinuityInput::new(&mut bytes);
    assert!(bytes.is_empty());
    i
}
fn create() -> LedgerContinuityInput {
    input(
        json!({"v":6,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-1","what":"alpha","why":null}),
    )
}
fn req(op: &str, extra: Value) -> LedgerContinuityInput {
    let mut v =
        json!({"v":6,"op":op,"ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0"});
    for (k, vv) in extra.as_object().unwrap() {
        v[k] = vv.clone()
    }
    input(v)
}
fn decode(bytes: Vec<u8>) -> Value {
    serde_json::from_slice(&bytes).unwrap()
}
fn assert_rounds(w: LedgerContinuityWork, extra: u64) {
    let expected = 3 * w.shared_passes + 2 * w.member_passes + extra;
    assert_eq!(w.identity_acquisitions.attempts, expected, "{w:?}");
    assert_eq!(w.native_fstype.attempts, expected);
    assert_eq!(w.native_fsinfo.attempts, expected);
    assert_eq!(w.native_handle.attempts, expected);
    assert_eq!(w.identity_acquisitions.completions, expected);
    assert_eq!(w.identity_refusals, 0);
    assert_eq!(w.native_buffer_bytes, expected * 1284);
    assert!(w.identity_scratch_bytes_peak > 0 && w.identity_scratch_bytes_peak <= 1536);
    assert!(w.named_fixed_bytes_peak <= 65536);
    assert!(w.descriptor_handles_peak <= 24);
    assert!(w.stack_bindings_peak <= 64)
}
#[test]
fn continuity_public_history_schedule_and_restart() {
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    assert_rounds(LedgerContinuityWork::last_call(), 12);
    let c = decode(h.create_change(&create(), &mut Owner));
    assert_eq!(c["v"], 6);
    assert_eq!(c["kind"], "created");
    // Four member installation cuts plus one fresh final-delivery bootstrap.
    assert_rounds(LedgerContinuityWork::last_call(), 10);
    let r=decode(h.revise_intent(&req("revise_intent",json!({"key":"revision-1","expected_intent":"change-0:origin","what":"beta","why":null})),&mut Owner));
    assert_eq!(r["kind"], "intent_revised");
    assert_rounds(LedgerContinuityWork::last_call(), 0);
    let r = decode(h.run_check(
        &req(
            "run_check",
            json!({"key":"check-1","expected_intent":"change-0:op:2","check":"notice-what@1"}),
        ),
        &mut Owner,
    ));
    assert_eq!(r["kind"], "intent_assessed");
    assert_rounds(LedgerContinuityWork::last_call(), 0);
    let r = decode(h.inspect_history(
        &req("inspect_history", json!({"at":null,"from":null,"limit":4})),
        &mut Owner,
    ));
    assert_eq!(r["projection"], "ck-ledger-history-range@2");
    assert_eq!(r["v"], 6);
    assert_rounds(LedgerContinuityWork::last_call(), 0);
    let r = decode(h.inspect_context(
        &req(
            "inspect_context",
            json!({"at":null,"purpose":"understanding"}),
        ),
        &mut Owner,
    ));
    assert_eq!(r["projection"], "ck-ledger-understanding@2");
    assert_rounds(LedgerContinuityWork::last_call(), 0);
    drop(h);
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert_rounds(LedgerContinuityWork::last_call(), 3);
    assert_eq!(decode(h.create_change(&create(), &mut Owner))["seq"], 1);
    assert_rounds(LedgerContinuityWork::last_call(), 0);
    let a: Value = serde_json::from_slice(&fs::read(f.path("anchor.json")).unwrap()).unwrap();
    assert_eq!(a["format"], "ck-ledger-continuity-anchor@6");
    assert!(a.get("directory_device").is_none());
    assert_eq!(a["directory_identity"]["mechanism"], "btrfs-fsid-fh@1");
    assert_eq!(
        a["directory_identity"]["handle"].as_str().unwrap().len(),
        40
    );
}
#[test]
fn continuity_identity_errno_and_hook_table() {
    use LedgerIdentityObject as O;
    use LedgerIdentityStep as S;
    for step in [S::BeforeFsType, S::BeforeFsInfo, S::BeforeHandle] {
        for errno in [
            libc::EIO,
            libc::EUCLEAN,
            libc::EREMOTEIO,
            libc::EPERM,
            libc::EACCES,
            libc::ENOENT,
            libc::ESTALE,
            libc::EINVAL,
            libc::ENOTTY,
            libc::ENOSYS,
            libc::EOPNOTSUPP,
            libc::EOVERFLOW,
            libc::ENOSPC,
            libc::EINTR,
            libc::EAGAIN,
            libc::ENOMEM,
            libc::EMFILE,
            libc::ENFILE,
            libc::ENOBUFS,
            libc::EBADF,
            libc::ENOTDIR,
            libc::EFAULT,
            libc::EBUSY,
        ] {
            let f = Fixture::new();
            let h = f.host(OpeningMode::FreshProvision, None).unwrap();
            drop(h);
            let triggered = Arc::new(Mutex::new(false));
            let fired = triggered.clone();
            assert!(matches!(
                f.host(
                    OpeningMode::Reopen,
                    Some(Box::new(move |e| {
                        if e == (LedgerContinuityIoEvent::Identity {
                            scope: 0,
                            object: O::LedgerDirectory,
                            step,
                        }) {
                            *fired.lock().unwrap() = true;
                            LedgerContinuityIoFault::NativeErrno(errno)
                        } else {
                            LedgerContinuityIoFault::Continue
                        }
                    }))
                ),
                Err(OpeningError::Unavailable)
            ));
            assert!(*triggered.lock().unwrap());
            let w = LedgerContinuityWork::last_call();
            assert_eq!(w.identity_acquisitions.attempts, 1);
            assert_eq!(
                w.identity_io_failures,
                u64::from(matches!(errno, libc::EIO | libc::EUCLEAN | libc::EREMOTEIO))
            );
            assert_eq!(
                w.identity_refusals,
                u64::from(!matches!(
                    errno,
                    libc::EIO | libc::EUCLEAN | libc::EREMOTEIO
                ))
            );
            assert_eq!(w.retention.matches, 0);
            let incident: Value =
                serde_json::from_slice(&fs::read(f.path("ledger/incident.json")).unwrap()).unwrap();
            assert_eq!(incident["state"], "clear");
            assert_eq!(w.native_fstype.attempts, 1);
            assert_eq!(w.native_fsinfo.attempts, u64::from(step != S::BeforeFsType));
            assert_eq!(w.native_handle.attempts, u64::from(step == S::BeforeHandle));
        }
    }
}
#[test]
fn continuity_later_shared_identity_io_uses_receipt_not_retry() {
    use LedgerIdentityObject as O;
    use LedgerIdentityStep as S;
    let f = Fixture::new();
    let armed = Arc::new(Mutex::new(false));
    let fault = armed.clone();
    let seen = Arc::new(Mutex::new(Vec::new()));
    let events = seen.clone();
    let mut h = f
        .host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |e| {
                events.lock().unwrap().push(e);
                if *fault.lock().unwrap()
                    && e == (LedgerContinuityIoEvent::Identity {
                        scope: 0,
                        object: O::LedgerDirectory,
                        step: S::BeforeFsType,
                    })
                {
                    LedgerContinuityIoFault::Io
                } else {
                    LedgerContinuityIoFault::Continue
                }
            })),
        )
        .unwrap();
    *armed.lock().unwrap() = true;
    seen.lock().unwrap().clear();
    let r = decode(h.create_change(&create(), &mut Owner));
    assert_eq!(r["code"], "unavailable");
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.identity_acquisitions.attempts, 1);
    assert_eq!(w.identity_io_failures, 1);
    assert_eq!(w.retention.matches, 1);
    assert_eq!(w.native_fstype.attempts, 1);
    assert_eq!(w.native_fsinfo.attempts, 0);
    assert_eq!(w.native_handle.attempts, 0);
    assert_eq!(
        seen.lock()
            .unwrap()
            .iter()
            .filter(|e| matches!(e, LedgerContinuityIoEvent::Identity { .. }))
            .count(),
        1
    );
    let incident: Value =
        serde_json::from_slice(&fs::read(f.path("ledger/incident.json")).unwrap()).unwrap();
    assert_eq!(incident["state"], "blocked");
    let r = decode(h.create_change(&create(), &mut Owner));
    assert_eq!(r["code"], "unavailable");
    assert_eq!(
        LedgerContinuityWork::last_call()
            .identity_acquisitions
            .attempts,
        0
    );
}
#[test]
fn continuity_receipt_reread_contradiction_refuses_retention() {
    use LedgerIdentityObject as O;
    use LedgerIdentityStep as S;
    let f = Fixture::new();
    let armed = Arc::new(Mutex::new(false));
    let fault = armed.clone();
    let path = f.path("anchor.json");
    let mut h = f
        .host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |e| {
                if *fault.lock().unwrap()
                    && e == (LedgerContinuityIoEvent::Identity {
                        scope: 0,
                        object: O::LedgerDirectory,
                        step: S::BeforeFsType,
                    })
                {
                    let bytes = fs::read(&path).unwrap();
                    let mut v: Value = serde_json::from_slice(&bytes).unwrap();
                    v["binding"] = json!("other@1");
                    let mut changed = serde_json::to_vec(&v).unwrap();
                    changed.push(b'\n');
                    fs::write(&path, changed).unwrap();
                    LedgerContinuityIoFault::Io
                } else {
                    LedgerContinuityIoFault::Continue
                }
            })),
        )
        .unwrap();
    *armed.lock().unwrap() = true;
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["code"],
        "unavailable"
    );
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.identity_io_failures, 1);
    assert_eq!(w.retention.matches, 0);
    assert_eq!(w.identity_acquisitions.attempts, 1);
    let i: Value =
        serde_json::from_slice(&fs::read(f.path("ledger/incident.json")).unwrap()).unwrap();
    assert_eq!(i["state"], "clear");
}
#[test]
fn continuity_first_member_identity_io_has_no_receipt() {
    use LedgerIdentityObject as O;
    use LedgerIdentityStep as S;
    let f = Fixture::new();
    let mut h = f
        .host(
            OpeningMode::FreshProvision,
            Some(Box::new(|e| {
                if e == (LedgerContinuityIoEvent::Identity {
                    scope: 1,
                    object: O::MemberDirectory,
                    step: S::BeforeHandle,
                }) {
                    LedgerContinuityIoFault::NativeErrno(libc::EREMOTEIO)
                } else {
                    LedgerContinuityIoFault::Continue
                }
            })),
        )
        .unwrap();
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["code"],
        "unavailable"
    );
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.identity_io_failures, 1);
    assert_eq!(w.retention.matches, 0);
    assert!(!f.path("ledger/members/m-1/incident.json").exists());
    assert!(!f.path("ledger/members/m-1.anchor.json").exists());
    let i: Value =
        serde_json::from_slice(&fs::read(f.path("ledger/incident.json")).unwrap()).unwrap();
    assert_eq!(i["state"], "clear");
}
#[test]
fn continuity_wire_hostile_identity_stays_bounded_and_inert() {
    let f = Fixture::new();
    let h = f.host(OpeningMode::FreshProvision, None).unwrap();
    drop(h);
    let path = f.path("anchor.json");
    let baseline = fs::read(&path).unwrap();
    let token: Value =
        serde_json::from_slice::<Value>(&baseline).unwrap()["directory_identity"].clone();
    let token = serde_json::to_string(&token).unwrap();
    let full = String::from_utf8(baseline.clone()).unwrap();
    // Preserve outer canonical order. Change only one token's handle literal.
    let start = full.find("\"handle\":\"").unwrap() + 10;
    let end = start + 40;
    for value in [
        "a".repeat(900_000),
        "A".repeat(40),
        "0".repeat(40),
        "b".repeat(39),
        "b".repeat(41),
        "\\u0062".repeat(40),
    ] {
        let mut bad = full[..start].to_owned();
        bad.push_str(&value);
        bad.push_str(&full[end..]);
        fs::write(&path, bad).unwrap();
        assert!(matches!(
            f.host(OpeningMode::Reopen, None),
            Err(OpeningError::Unavailable)
        ));
        let w = LedgerContinuityWork::last_call();
        assert!(w.identity_format.no_matches > 0, "{token} {w:?}");
        assert_eq!(w.retention.matches, 0);
        assert!(w.named_payload_peak < 1_150_000, "{w:?}");
        assert!(w.named_fixed_bytes_peak <= 65_536);
    }
    fs::write(&path, baseline).unwrap();
    assert!(f.host(OpeningMode::Reopen, None).is_ok());
}
#[test]
fn continuity_wrong_entry_and_denied_authority_skip_native() {
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    let before = fs::read(f.path("ledger/creation.json")).unwrap();
    let r = decode(h.run_check(&create(), &mut Owner));
    assert_eq!(r["code"], "unsupported");
    assert_eq!(
        LedgerContinuityWork::last_call()
            .identity_acquisitions
            .attempts,
        0
    );
    struct Denied;
    impl LedgerContinuityGuard for Denied {
        fn principal(&self) -> &str {
            "owner-1"
        }
        fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
            LedgerPermission::Deny
        }
        fn member(
            &mut self,
            _: &str,
            _: &str,
            _: LedgerContinuityMemberPermission,
        ) -> LedgerPermission {
            panic!("member guard reached")
        }
    }
    let r = decode(h.create_change(&create(), &mut Denied));
    assert_eq!(r["code"], "denied");
    assert_eq!(
        LedgerContinuityWork::last_call()
            .identity_acquisitions
            .attempts,
        0
    );
    assert_eq!(fs::read(f.path("ledger/creation.json")).unwrap(), before);
}
#[test]
fn continuity_invalid_native_hooks_cannot_be_observations() {
    use LedgerIdentityObject as O;
    use LedgerIdentityStep as S;
    for (step, fault) in [
        (S::BeforeFsType, LedgerContinuityIoFault::Refuse),
        (S::BeforeFsType, LedgerContinuityIoFault::ShortWrite),
        (S::BeforeFsType, LedgerContinuityIoFault::MalformedIdentity),
        (S::BeforeFsType, LedgerContinuityIoFault::NativeErrno(0)),
        (S::BeforeFsInfo, LedgerContinuityIoFault::NativeErrno(4096)),
        (S::AfterFsType, LedgerContinuityIoFault::Io),
        (
            S::AfterFsInfo,
            LedgerContinuityIoFault::NativeErrno(libc::EIO),
        ),
        (S::AfterHandle, LedgerContinuityIoFault::MalformedIdentity),
    ] {
        let f = Fixture::new();
        assert!(matches!(
            f.host(
                OpeningMode::FreshProvision,
                Some(Box::new(move |e| {
                    if e == (LedgerContinuityIoEvent::Identity {
                        scope: 0,
                        object: O::LedgerDirectory,
                        step,
                    }) {
                        fault
                    } else {
                        LedgerContinuityIoFault::Continue
                    }
                }))
            ),
            Err(OpeningError::Unavailable)
        ));
        let w = LedgerContinuityWork::last_call();
        assert_eq!(w.identity_acquisitions.attempts, 1);
        assert_eq!(w.identity_io_failures, 0);
        assert_eq!(w.identity_refusals, 1);
        assert_eq!(w.retention.matches, 0);
        assert!(!f.path("anchor.json").exists());
        assert_eq!(w.native_fstype.attempts, u64::from(step != S::BeforeFsType));
    }
}
#[test]
fn continuity_changed_fixed_token_refuses_without_repair() {
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["kind"],
        "created"
    );
    let path = f.path("ledger/members/m-1.anchor.json");
    let bytes = fs::read(&path).unwrap();
    let mut changed = bytes.clone();
    let marker = b"\"handle\":\"";
    let at = changed
        .windows(marker.len())
        .position(|w| w == marker)
        .unwrap()
        + marker.len();
    changed[at] = if changed[at] == b'f' { b'e' } else { b'f' };
    fs::write(&path, &changed).unwrap();
    let r = decode(h.inspect_context(
        &req(
            "inspect_context",
            json!({"at":null,"purpose":"understanding"}),
        ),
        &mut Owner,
    ));
    assert_eq!(r["code"], "unavailable");
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.identity_io_failures, 0);
    assert_eq!(w.retention.matches, 0);
    assert!(w.identity_comparisons.no_matches > 0);
    assert_eq!(fs::read(&path).unwrap(), changed);
    fs::write(&path, bytes).unwrap();
    drop(h);
    let h = f.host(OpeningMode::Reopen, None).unwrap();
    drop(h);
}
#[test]
fn continuity_file_cut_recovery_keeps_exact_origin() {
    for cut in 1..=3 {
        let f = Fixture::new();
        let count = Arc::new(Mutex::new(0));
        let seen = count.clone();
        let mut h = f
            .host(
                OpeningMode::FreshProvision,
                Some(Box::new(move |e| {
                    if let LedgerContinuityIoEvent::File(LedgerIoEvent {
                        object: "creation.tmp",
                        step: "renamed",
                        ..
                    }) = e
                    {
                        let mut n = seen.lock().unwrap();
                        *n += 1;
                        if *n == cut {
                            return LedgerContinuityIoFault::MalformedIdentity;
                        }
                    }
                    LedgerContinuityIoFault::Continue
                })),
            )
            .unwrap();
        assert_eq!(
            decode(h.create_change(&create(), &mut Owner))["code"],
            "unavailable"
        );
        drop(h);
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        assert_eq!(
            decode(h.create_change(&create(), &mut Owner))["kind"],
            "created"
        );
        let origin = fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap();
        assert_eq!(origin.iter().filter(|b| **b == b'\n').count(), 1);
        assert_eq!(decode(h.create_change(&create(), &mut Owner))["seq"], 1);
        assert_eq!(
            fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap(),
            origin
        );
    }
}

fn assert_complete_ceiling(w: LedgerContinuityWork) {
    let rounds = w.shared_passes + w.member_passes;
    let calls = 3 * w.shared_passes + 2 * w.member_passes + 64;
    assert!(w.identity_acquisitions.attempts <= calls, "{w:?}");
    assert!(w.controls.attempts <= 4 * rounds + 32, "{w:?}");
    assert!(w.control_emissions.attempts <= 4 * rounds + 32, "{w:?}");
    assert!(
        w.record_emissions.attempts <= 128 * w.member_passes + 32,
        "{w:?}"
    );
    assert!(
        w.constructions.attempts <= 256 * w.member_passes + 16 * rounds + 256,
        "{w:?}"
    );
    assert!(
        w.fields.attempts <= 512 * (1 + 4 * w.shared_passes + 132 * w.member_passes + 32 + 256),
        "{w:?}"
    );
    assert!(
        w.identity_comparisons.attempts <= 64 * rounds + 512,
        "{w:?}"
    );
    assert!(w.named_fixed_bytes_peak <= 65_536, "{w:?}");
    assert!(w.named_payload_peak <= 67_108_864, "{w:?}");
    assert!(
        w.descriptor_handles_peak <= 24 && w.stack_bindings_peak <= 64,
        "{w:?}"
    );
    assert!(w.identity_scratch_bytes_peak <= 1536, "{w:?}");
    assert!(w.records_peak <= 2 && w.accepted_vectors_peak <= 1, "{w:?}");
}

#[test]
fn continuity_all_slots_list_bootstraps_and_rejected_full_control() {
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    for slot in 0..16 {
        let what = if slot == 15 {
            "\u{1}".repeat(65_536)
        } else {
            "alpha".into()
        };
        let why = if slot == 15 {
            Some("\u{1}".repeat(65_536))
        } else {
            None
        };
        let i = input(json!({"v":6,"op":"create_change","ledger":"ledger-1",
            "workspace_id":"workspace-1","key":format!("create-{slot}"),"what":what,"why":why}));
        assert_eq!(decode(h.create_change(&i, &mut Owner))["kind"], "created");
        assert_rounds(LedgerContinuityWork::last_call(), 10);
        assert_complete_ceiling(LedgerContinuityWork::last_call());
    }
    let control = f.path("ledger/creation.json");
    let bytes = fs::read(&control).unwrap();
    let value: Value = serde_json::from_slice(&bytes).unwrap();
    let physical = &value["entries"][0]["physical"];
    assert_eq!(
        physical
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect::<Vec<_>>(),
        ["directory", "lock"]
    );
    let list = input(json!({"v":6,"op":"list_changes","ledger":"ledger-1",
        "workspace_id":"workspace-1","limit":4,"cursor":null}));
    assert_eq!(
        decode(h.list_changes(&list, &mut Owner))["kind"],
        "change_page"
    );
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.member_passes, 32);
    assert_rounds(w, 32); // Sixteen fresh final-sweep barrier bootstraps, not M.
    assert_complete_ceiling(w);
    assert_eq!(fs::read(&control).unwrap(), bytes);

    // A seventeenth independently shaped ready pair is parsed/emitted before
    // the semantic slot/generation refusal. This is not an accepted inventory.
    let text = String::from_utf8(bytes.clone()).unwrap();
    let token_json = |v: &Value| {
        format!(
            "{{\"mechanism\":{},\"fsid\":{},\"handle_type\":{},\"handle_bytes\":{},\"handle\":{}}}",
            v["mechanism"], v["fsid"], v["handle_type"], v["handle_bytes"], v["handle"]
        )
    };
    let ready = format!("{{\"slot\":17,\"input\":{},\"actor\":\"owner-1\",\"phase\":\"ready\",\"physical\":{{\"directory\":{},\"lock\":{}}}}}",
        r#"{"v":6,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"overflow","what":"alpha","why":null}"#,
        token_json(&physical["directory"]), token_json(&physical["lock"]));
    let rejected = text.replace("\"pending\":null", &format!("\"pending\":{ready}"));
    fs::write(&control, &rejected).unwrap();
    assert_eq!(
        decode(h.list_changes(&list, &mut Owner))["code"],
        "unavailable"
    );
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.member_passes, 0);
    assert_eq!(w.canonical.no_matches, 0);
    assert!(w.identity_format.attempts > 34 * 5);
    assert_complete_ceiling(w);
    assert_eq!(fs::read(&control).unwrap(), rejected.as_bytes());
    fs::write(&control, bytes).unwrap();
}

#[test]
fn continuity_full_history_has_one_pair_per_pass_not_per_origin() {
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["kind"],
        "created"
    );
    for seq in 2..=128 {
        let previous = if seq == 2 {
            "change-0:origin".into()
        } else {
            format!("change-0:op:{}", seq - 1)
        };
        let i = req(
            "revise_intent",
            json!({"key":format!("revision-{seq}"),"expected_intent":previous,"what":"alpha","why":null}),
        );
        assert_eq!(decode(h.revise_intent(&i, &mut Owner))["seq"], seq);
        assert_rounds(LedgerContinuityWork::last_call(), 0);
        assert_complete_ceiling(LedgerContinuityWork::last_call());
    }
    let trace = fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap();
    let view = req(
        "inspect_context",
        json!({"at":null,"purpose":"understanding"}),
    );
    let result = decode(h.inspect_context(&view, &mut Owner));
    assert_eq!(result["coverage"]["required"], 128);
    assert_eq!(result["coverage"]["complete"], true);
    assert_rounds(LedgerContinuityWork::last_call(), 0);
    assert_complete_ceiling(LedgerContinuityWork::last_call());
    assert_eq!(
        fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap(),
        trace
    );
}

#[test]
fn continuity_later_member_io_requires_live_shared_chain_at_each_retention_cut() {
    for arrangement in ["same-parent", "distinct-parent", "distinct-parent-decoy"] {
        for cut in ["fault", "incident-read", "incident-create"] {
            for object in ["root", "members", "lock", "unchanged"] {
                let f = Fixture::new();
                let anchor = if arrangement == "same-parent" {
                    f.path("anchor.json")
                } else {
                    let parent = f.0.join("anchors");
                    fs::create_dir(&parent).unwrap();
                    if arrangement == "distinct-parent-decoy" {
                        fs::create_dir(parent.join("ledger")).unwrap();
                    }
                    parent.join("anchor.json")
                };
                let armed = Arc::new(Mutex::new(false));
                let arm = armed.clone();
                let count = Arc::new(Mutex::new(0));
                let counter = count.clone();
                let faulted = Arc::new(Mutex::new(false));
                let fault = faulted.clone();
                let moved = Arc::new(Mutex::new(false));
                let change = moved.clone();
                let root = f.path("ledger");
                let mut h = f
                    .host_at(
                        &anchor,
                        OpeningMode::FreshProvision,
                        Some(Box::new(move |event| {
                            if !*arm.lock().unwrap() {
                                return LedgerContinuityIoFault::Continue;
                            }
                            let native = event
                                == LedgerContinuityIoEvent::Identity {
                                    scope: 1,
                                    object: LedgerIdentityObject::MemberDirectory,
                                    step: LedgerIdentityStep::BeforeFsType,
                                };
                            let trigger = if native {
                                let mut n = counter.lock().unwrap();
                                *n += 1;
                                *n == 2
                            } else {
                                false
                            };
                            if trigger {
                                *fault.lock().unwrap() = true;
                            }
                            let file_cut = match event {
                                LedgerContinuityIoEvent::File(e) => {
                                    e.scope == 1
                                        && ((cut == "incident-read"
                                            && e.object == "incident.json"
                                            && e.step == "before_read")
                                            || (cut == "incident-create"
                                                && e.object == "incident.tmp"
                                                && e.step == "before_create"))
                                }
                                _ => false,
                            };
                            if *fault.lock().unwrap()
                                && !*change.lock().unwrap()
                                && ((cut == "fault" && trigger) || file_cut)
                            {
                                match object {
                                    "root" => fs::rename(&root, root.with_file_name("held-ledger"))
                                        .unwrap(),
                                    "members" => {
                                        fs::rename(root.join("members"), root.join("held-members"))
                                            .unwrap()
                                    }
                                    "lock" => {
                                        fs::rename(
                                            root.join("writer.lock"),
                                            root.join("held.lock"),
                                        )
                                        .unwrap();
                                        fs::write(root.join("writer.lock"), b"").unwrap();
                                    }
                                    "unchanged" => {}
                                    _ => unreachable!(),
                                }
                                *change.lock().unwrap() = true;
                            }
                            if trigger {
                                LedgerContinuityIoFault::NativeErrno(libc::EIO)
                            } else {
                                LedgerContinuityIoFault::Continue
                            }
                        })),
                    )
                    .unwrap();
                assert_eq!(
                    decode(h.create_change(&create(), &mut Owner))["kind"],
                    "created"
                );
                let trace = fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap();
                *armed.lock().unwrap() = true;
                let result = decode(h.inspect_history(
                    &req("inspect_history", json!({"at":null,"from":null,"limit":4})),
                    &mut Owner,
                ));
                assert_eq!(
                    result["code"], "unavailable",
                    "{arrangement}/{cut}/{object}"
                );
                let w = LedgerContinuityWork::last_call();
                assert_eq!(
                    w.identity_io_failures, 1,
                    "{arrangement}/{cut}/{object} {w:?}"
                );
                assert_eq!(
                    w.retention.matches,
                    u64::from(object == "unchanged"),
                    "{arrangement}/{cut}/{object} {w:?}"
                );
                assert_eq!(*count.lock().unwrap(), 2); // No retention reacquisition.
                let root = if object == "root" {
                    f.path("held-ledger")
                } else {
                    f.path("ledger")
                };
                let members = root.join(if object == "members" {
                    "held-members"
                } else {
                    "members"
                });
                let incident: Value =
                    serde_json::from_slice(&fs::read(members.join("m-1/incident.json")).unwrap())
                        .unwrap();
                assert_eq!(
                    incident["state"],
                    if object == "unchanged" {
                        "blocked"
                    } else {
                        "clear"
                    }
                );
                assert_eq!(fs::read(members.join("m-1/trace.jsonl")).unwrap(), trace);
                assert!(!members.join("m-1/incident.tmp").exists());
                let shared: Value =
                    serde_json::from_slice(&fs::read(root.join("incident.json")).unwrap()).unwrap();
                assert_eq!(shared["state"], "clear");
            }
        }
    }
}
#[test]
fn continuity_post_barrier_identity_contradiction_never_reenrolls() {
    for scope in [0, 1] {
        let f = Fixture::new();
        let count = Arc::new(Mutex::new(0));
        let seen = count.clone();
        let anchor = if scope == 0 {
            f.path("anchor.json")
        } else {
            f.path("ledger/members/m-1.anchor.json")
        };
        let enrolled = Arc::new(Mutex::new(None::<Vec<u8>>));
        let saved = enrolled.clone();
        let mut h = f.host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |event| {
                if let LedgerContinuityIoEvent::Identity {
                    scope: current,
                    object,
                    step: LedgerIdentityStep::BeforeFsType,
                } = event
                {
                    if current == scope
                        && object
                            == if scope == 0 {
                                LedgerIdentityObject::LedgerDirectory
                            } else {
                                LedgerIdentityObject::MemberDirectory
                            }
                    {
                        let mut n = seen.lock().unwrap();
                        *n += 1;
                        // Preparation, incomplete initial, complete initial, then
                        // the independent post-barrier installation producer.
                        if *n == 4 {
                            let bytes = fs::read(&anchor).unwrap();
                            let mut altered = bytes.clone();
                            let marker = b"\"handle\":\"";
                            let at = altered
                                .windows(marker.len())
                                .position(|w| w == marker)
                                .unwrap()
                                + marker.len();
                            altered[at] = if altered[at] == b'f' { b'e' } else { b'f' };
                            fs::write(&anchor, &altered).unwrap();
                            *saved.lock().unwrap() = Some(altered);
                        }
                    }
                }
                LedgerContinuityIoFault::Continue
            })),
        );
        if scope == 0 {
            assert!(matches!(h, Err(OpeningError::Unavailable)));
        } else {
            assert_eq!(
                decode(h.as_mut().unwrap().create_change(&create(), &mut Owner))["code"],
                "unavailable"
            );
        }
        let w = LedgerContinuityWork::last_call();
        assert_eq!(w.identity_io_failures, 0);
        assert_eq!(w.retention.matches, 0);
        let path = if scope == 0 {
            f.path("anchor.json")
        } else {
            f.path("ledger/members/m-1.anchor.json")
        };
        let bytes = fs::read(&path).unwrap();
        assert_eq!(bytes, enrolled.lock().unwrap().as_ref().unwrap().clone());
        let value: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(value["stage"], "preparing");
    }
}

#[test]
fn continuity_exact_hook_faults_and_non_send_composition() {
    use std::{cell::Cell, rc::Rc};
    for fault in [
        LedgerContinuityIoFault::Refuse,
        LedgerContinuityIoFault::ShortWrite,
    ] {
        let f = Fixture::new();
        let seen = Rc::new(Cell::new(0));
        let observed = seen.clone();
        let mut h = f
            .host(
                OpeningMode::FreshProvision,
                Some(Box::new(move |event| {
                    observed.set(observed.get() + 1);
                    if let LedgerContinuityIoEvent::File(e) = event {
                        if e.scope == 0
                            && e.object == "creation.tmp"
                            && e.step
                                == if fault == LedgerContinuityIoFault::Refuse {
                                    "before_create"
                                } else {
                                    "before_write"
                                }
                        {
                            return fault;
                        }
                    }
                    LedgerContinuityIoFault::Continue
                })),
            )
            .unwrap();
        assert_eq!(
            decode(h.create_change(&create(), &mut Owner))["code"],
            "unavailable"
        );
        assert!(seen.get() > 0);
        let w = LedgerContinuityWork::last_call();
        assert_eq!(w.identity_io_failures, 0);
        assert_eq!(
            w.retention.matches,
            u64::from(fault == LedgerContinuityIoFault::ShortWrite)
        );
        let i: Value =
            serde_json::from_slice(&fs::read(f.path("ledger/incident.json")).unwrap()).unwrap();
        assert_eq!(
            i["state"],
            if fault == LedgerContinuityIoFault::ShortWrite {
                "blocked"
            } else {
                "clear"
            }
        );
    }
}

#[test]
fn continuity_pending_ready_generation_one_reaches_scalar_refusal() {
    let f = Fixture::new();
    let count = Arc::new(Mutex::new(0));
    let seen = count.clone();
    let mut h = f
        .host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |event| {
                if let LedgerContinuityIoEvent::File(e) = event {
                    if e.scope == 1 && e.object == "checkpoint.tmp" && e.step == "renamed" {
                        let mut n = seen.lock().unwrap();
                        *n += 1;
                        if *n == 2 {
                            return LedgerContinuityIoFault::Refuse;
                        }
                    }
                }
                LedgerContinuityIoFault::Continue
            })),
        )
        .unwrap();
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["code"],
        "unavailable"
    );
    let control: Value =
        serde_json::from_slice(&fs::read(f.path("ledger/creation.json")).unwrap()).unwrap();
    assert_eq!(control["pending"]["phase"], "ready");
    assert_eq!(control["entries"].as_array().unwrap().len(), 0);
    let path = f.path("ledger/members/m-1/checkpoint.json");
    let baseline = fs::read(&path).unwrap();
    let prefix: Value = serde_json::from_slice(&baseline).unwrap();
    assert_eq!(prefix["generation"], 1);
    let altered = String::from_utf8(baseline.clone())
        .unwrap()
        .replace(&format!("\"end\":{}", prefix["end"]), "\"end\":0");
    fs::write(&path, &altered).unwrap();
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["code"],
        "unavailable"
    );
    let w = LedgerContinuityWork::last_call();
    assert_eq!(w.relationships.no_matches, 0);
    assert_eq!(w.identity_comparisons.no_matches, 0);
    assert_eq!(w.retention.matches, 0);
    assert_complete_ceiling(w);
    assert_eq!(fs::read(&path).unwrap(), altered.as_bytes());
    fs::write(&path, baseline).unwrap();
    assert_eq!(decode(h.create_change(&create(), &mut Owner))["seq"], 1);
}

#[test]
fn continuity_preparing_anchor_resume_and_orphan_refusal() {
    let f = Fixture::new();
    let result = f.host(
        OpeningMode::FreshProvision,
        Some(Box::new(|event| {
            if let LedgerContinuityIoEvent::File(e) = event {
                if e.scope == 0 && e.object == "creation.json" && e.step == "before_create" {
                    return LedgerContinuityIoFault::Refuse;
                }
            }
            LedgerContinuityIoFault::Continue
        })),
    );
    assert!(matches!(result, Err(OpeningError::Unavailable)));
    let anchor = f.path("anchor.json");
    let preparing: Value = serde_json::from_slice(&fs::read(&anchor).unwrap()).unwrap();
    assert_eq!(preparing["stage"], "preparing");
    let h = f.host(OpeningMode::ResumeProvision, None).unwrap();
    let installed: Value = serde_json::from_slice(&fs::read(&anchor).unwrap()).unwrap();
    assert_eq!(installed["stage"], "installed");
    for field in ["directory_identity", "lock_identity", "members_identity"] {
        assert_eq!(preparing[field], installed[field]);
    }
    assert_complete_ceiling(LedgerContinuityWork::last_call());
    drop(h);

    let f = Fixture::new();
    let result = f.host(
        OpeningMode::FreshProvision,
        Some(Box::new(|event| {
            if event
                == (LedgerContinuityIoEvent::Identity {
                    scope: 0,
                    object: LedgerIdentityObject::LedgerDirectory,
                    step: LedgerIdentityStep::BeforeFsType,
                })
            {
                LedgerContinuityIoFault::NativeErrno(libc::ENOSYS)
            } else {
                LedgerContinuityIoFault::Continue
            }
        })),
    );
    assert!(matches!(result, Err(OpeningError::Unavailable)));
    assert!(!f.path("anchor.json").exists());
    assert!(f.path("ledger/members").is_dir());
    assert!(matches!(
        f.host(OpeningMode::ResumeProvision, None),
        Err(OpeningError::Unavailable)
    ));
    assert_eq!(
        LedgerContinuityWork::last_call()
            .identity_acquisitions
            .attempts,
        3
    );
    assert!(!f.path("anchor.json").exists());
}

#[test]
fn continuity_long_enrolled_path_retains_only_fixed_selectors() {
    let f = Fixture::new();
    let mut base = f.path("nested");
    for _ in 0..24 {
        base.push("d".repeat(100));
    }
    fs::create_dir_all(&base).unwrap();
    let pairs = std::array::from_fn(|i| LedgerPair {
        change: format!("change-{i}"),
        custody: format!("member-{i}"),
    });
    let directory = base.join("ledger");
    let anchor = base.join("anchor.json");
    let grant = LedgerContinuityGrant::new(LedgerContinuityGrantSpec {
        profile: "ck-ledger-continuity@6",
        ledger: "ledger-1",
        custody: "ledger-custody",
        owner: "owner-1",
        workspace_id: "workspace-1",
        binding: "fixture@1",
        directory: &directory,
        anchor: &anchor,
        grants: &pairs,
        policy: "fixture-notice@1",
        check: "notice-what@1",
        evaluator: "utf8-length@1",
        adopter: "owner-1",
    })
    .unwrap();
    let mut h = LedgerContinuityHost::connect(grant, OpeningMode::FreshProvision, &mut Owner, None)
        .unwrap();
    assert_rounds(LedgerContinuityWork::last_call(), 12);
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["kind"],
        "created"
    );
    assert_rounds(LedgerContinuityWork::last_call(), 10);
    assert_complete_ceiling(LedgerContinuityWork::last_call());
}

#[test]
fn continuity_partial_object_sets_cannot_establish_retention() {
    for (scope, object) in [
        (0, LedgerIdentityObject::LedgerLock),
        (0, LedgerIdentityObject::MembersDirectory),
        (1, LedgerIdentityObject::MemberLock),
    ] {
        let f = Fixture::new();
        let result = f.host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |event| {
                if event
                    == (LedgerContinuityIoEvent::Identity {
                        scope,
                        object,
                        step: LedgerIdentityStep::BeforeFsType,
                    })
                {
                    LedgerContinuityIoFault::NativeErrno(libc::EUCLEAN)
                } else {
                    LedgerContinuityIoFault::Continue
                }
            })),
        );
        if scope == 0 {
            assert!(matches!(result, Err(OpeningError::Unavailable)));
            assert!(!f.path("anchor.json").exists());
        } else {
            let mut h = result.unwrap();
            assert_eq!(
                decode(h.create_change(&create(), &mut Owner))["code"],
                "unavailable"
            );
            assert!(!f.path("ledger/members/m-1.anchor.json").exists());
            assert!(!f.path("ledger/members/m-1/incident.json").exists());
        }
        let w = LedgerContinuityWork::last_call();
        assert_eq!(w.identity_io_failures, 1);
        assert_eq!(w.retention.attempts, 1);
        assert_eq!(w.retention.matches, 0);
        assert_eq!(
            w.identity_acquisitions.attempts,
            w.identity_acquisitions.matches + 1
        );
    }
}

#[test]
fn continuity_deferred_ready_cleanup_refusal_preserves_candidate() {
    let f = Fixture::new();
    let writes = Arc::new(Mutex::new(0));
    let count = writes.clone();
    let mut h = f
        .host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |event| {
                if let LedgerContinuityIoEvent::File(e) = event {
                    if e.scope == 0 && e.object == "creation.tmp" {
                        if e.step == "written" {
                            *count.lock().unwrap() += 1;
                        }
                        if e.step == "before_sync" && *count.lock().unwrap() == 2 {
                            return LedgerContinuityIoFault::Refuse;
                        }
                    }
                }
                LedgerContinuityIoFault::Continue
            })),
        )
        .unwrap();
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["code"],
        "unavailable"
    );
    let candidate = fs::read(f.path("ledger/creation.tmp")).unwrap();
    let value: Value = serde_json::from_slice(&candidate).unwrap();
    assert_eq!(value["pending"]["phase"], "ready");
    drop(h);
    let refuse = Arc::new(Mutex::new(true));
    let once = refuse.clone();
    let mut h = f
        .host(
            OpeningMode::Reopen,
            Some(Box::new(move |event| {
                if let LedgerContinuityIoEvent::File(e) = event {
                    if e.scope == 0
                        && e.object == "creation.tmp"
                        && e.step == "before_unlink"
                        && *once.lock().unwrap()
                    {
                        *once.lock().unwrap() = false;
                        return LedgerContinuityIoFault::Refuse;
                    }
                }
                LedgerContinuityIoFault::Continue
            })),
        )
        .unwrap();
    assert_eq!(LedgerContinuityWork::last_call().member_passes, 0);
    assert_rounds(LedgerContinuityWork::last_call(), 3);
    assert_eq!(fs::read(f.path("ledger/creation.tmp")).unwrap(), candidate);
    assert_eq!(
        decode(h.create_change(&create(), &mut Owner))["code"],
        "unavailable"
    );
    assert_eq!(fs::read(f.path("ledger/creation.tmp")).unwrap(), candidate);
    assert_eq!(LedgerContinuityWork::last_call().retention.matches, 0);
    assert_complete_ceiling(LedgerContinuityWork::last_call());
    assert_eq!(decode(h.create_change(&create(), &mut Owner))["seq"], 1);
    assert!(!f.path("ledger/creation.tmp").exists());
    assert_complete_ceiling(LedgerContinuityWork::last_call());
}

fn custody_snapshot(f: &Fixture) -> Vec<(PathBuf, Vec<u8>)> {
    fn walk(root: &Path, at: &Path, out: &mut Vec<(PathBuf, Vec<u8>)>) {
        let mut paths: Vec<_> = fs::read_dir(at)
            .unwrap()
            .map(|e| e.unwrap().path())
            .collect();
        paths.sort();
        for p in paths {
            let relative = p.strip_prefix(root).unwrap().to_path_buf();
            if p.is_dir() {
                out.push((relative, Vec::new()));
                walk(root, &p, out);
            } else {
                out.push((relative, fs::read(p).unwrap()));
            }
        }
    }
    let mut out = Vec::new();
    walk(&f.0, &f.path(""), &mut out);
    out
}
fn create_named(key: &str, what: &str) -> LedgerContinuityInput {
    input(json!({"v":6,"op":"create_change","ledger":"ledger-1",
        "workspace_id":"workspace-1","key":key,"what":what,"why":null}))
}
fn context(change: &str, at: Value) -> LedgerContinuityInput {
    input(json!({"v":6,"op":"inspect_context","ledger":"ledger-1",
        "workspace_id":"workspace-1","change":change,"at":at,"purpose":"understanding"}))
}
fn check_origin() -> LedgerContinuityInput {
    req(
        "run_check",
        json!({"key":"false-check","expected_intent":"change-0:origin","check":"notice-what@1"}),
    )
}

// Only this binary's bounded, exact subprocess entry owns a child host. Parent
// sends fixture/action explicitly; no inherited custody descriptor or host.
struct ContinuityChild(std::process::Child);
impl ContinuityChild {
    fn spawn(f: &Fixture, action: &str) -> Self {
        use std::process::{Command, Stdio};
        let mut cmd = Command::new(std::env::current_exe().unwrap());
        cmd.args([
            "--exact",
            "continuity_process_entry",
            "--ignored",
            "--nocapture",
        ])
        .env("CK_CONTINUITY_CHILD_ROOT", &f.0)
        .env("CK_CONTINUITY_CHILD_ACTION", action)
        .stdout(Stdio::from(
            fs::File::create(f.0.join(format!("{action}.stdout"))).unwrap(),
        ))
        .stderr(Stdio::from(
            fs::File::create(f.0.join(format!("{action}.stderr"))).unwrap(),
        ));
        Self(cmd.spawn().unwrap())
    }
    fn ready(&mut self, f: &Fixture, action: &str) {
        use std::time::{Duration, Instant};
        let deadline = Instant::now() + Duration::from_secs(60);
        let path = f.0.join(format!("{action}.ready"));
        loop {
            if path.exists() {
                let pid: u32 = fs::read_to_string(&path).unwrap().parse().unwrap();
                assert_eq!(pid, self.0.id(), "uncorrelated readiness");
                assert!(
                    self.0.try_wait().unwrap().is_none(),
                    "child exited before contender"
                );
                return;
            }
            if let Some(exit) = self.0.try_wait().unwrap() {
                panic!(
                    "child {action} exited before readiness: {exit}; stderr={}",
                    fs::read_to_string(f.0.join(format!("{action}.stderr"))).unwrap()
                );
            }
            assert!(
                Instant::now() < deadline,
                "child {action} readiness timeout"
            );
            std::thread::sleep(Duration::from_millis(10));
        }
    }
    fn exit(&mut self, f: &Fixture, action: &str) {
        let temporary = f.0.join(format!("{action}.exit.tmp"));
        fs::write(&temporary, self.0.id().to_string()).unwrap();
        fs::rename(temporary, f.0.join(format!("{action}.exit"))).unwrap();
        self.wait_code(f, action, 0);
    }
    fn wait_code(&mut self, f: &Fixture, action: &str, expected: i32) {
        use std::time::{Duration, Instant};
        let deadline = Instant::now() + Duration::from_secs(60);
        loop {
            if let Some(exit) = self.0.try_wait().unwrap() {
                eprintln!("continuity child {action} pid={} exit={exit}", self.0.id());
                assert!(
                    exit.code() == Some(expected),
                    "child {action}; stderr={}",
                    fs::read_to_string(f.0.join(format!("{action}.stderr"))).unwrap()
                );
                return;
            }
            assert!(Instant::now() < deadline, "child {action} exit timeout");
            std::thread::sleep(Duration::from_millis(10));
        }
    }
}
impl Drop for ContinuityChild {
    fn drop(&mut self) {
        if !matches!(self.0.try_wait(), Ok(Some(_))) {
            let kill = self.0.kill();
            let reap = self.0.wait();
            eprintln!(
                "continuity child cleanup pid={} kill={kill:?} reap={reap:?}",
                self.0.id()
            );
        }
    }
}

#[test]
#[ignore = "bounded subprocess entry invoked by continuity process exit and recovery witnesses"]
fn continuity_process_entry() {
    use std::time::{Duration, Instant};
    // Parent owns fixture cleanup. Child exits without running host destructors.
    let f = std::mem::ManuallyDrop::new(Fixture(PathBuf::from(
        std::env::var_os("CK_CONTINUITY_CHILD_ROOT").unwrap(),
    )));
    let action = std::env::var("CK_CONTINUITY_CHILD_ACTION").unwrap();
    if let Some(spec) = action.strip_prefix("cut-") {
        let (op, cut) = spec.split_once('-').unwrap();
        assert!(matches!(op, "run_check" | "revise_intent"));
        let event = recovery_cut(cut);
        let short = cut == "partial";
        let marker = f.0.join(format!("{action}.cut"));
        let correlation = action.clone();
        let mut h = f.host(OpeningMode::Reopen, Some(Box::new(move |seen| {
            if seen == LedgerContinuityIoEvent::File(event) {
                fs::write(&marker, serde_json::to_vec(&json!({"pid":std::process::id(),"action":correlation,"event":format!("{event:?}")})).unwrap()).unwrap();
                std::process::exit(23);
            }
            if short && seen == LedgerContinuityIoEvent::File(LedgerIoEvent { scope:1, phase:"append", object:"trace.jsonl", step:"before_write" }) {
                LedgerContinuityIoFault::ShortWrite
            } else { LedgerContinuityIoFault::Continue }
        }))).unwrap();
        let reply = private_call(&mut h, op, &mut Owner);
        panic!(
            "process recovery cut not reached: {action}; reply={}",
            String::from_utf8_lossy(&reply)
        );
    }
    assert!(matches!(action.as_str(), "provision" | "reopen"));
    let mut h = f
        .host(
            if action == "provision" {
                OpeningMode::FreshProvision
            } else {
                OpeningMode::Reopen
            },
            None,
        )
        .unwrap();
    let initial = input(json!({"v":6,"op":"create_change","ledger":"ledger-1",
        "workspace_id":"workspace-1","key":"original-a","what":"x".repeat(81),
        "why":"Keep original reason"}));
    let original = h.create_change(&initial, &mut Owner);
    assert_eq!(decode(original.clone())["kind"], "created");
    let b = h.create_change(&create_named("original-b", "independent beta"), &mut Owner);
    assert_eq!(decode(b.clone())["kind"], "created");
    let negative = h.run_check(&check_origin(), &mut Owner);
    assert_eq!(decode(negative.clone())["passed"], false);
    let revise = req(
        "revise_intent",
        json!({"key":"revision","expected_intent":"change-0:origin","what":"Trim local defaults","why":null}),
    );
    let revision = h.revise_intent(&revise, &mut Owner);
    assert_eq!(decode(revision.clone())["seq"], 3);
    let positive = h.run_check(
        &req(
            "run_check",
            json!({"key":"true-check","expected_intent":"change-0:op:3","check":"notice-what@1"}),
        ),
        &mut Owner,
    );
    assert_eq!(decode(positive.clone())["passed"], true);
    let current = h.inspect_context(&context("change-0", Value::Null), &mut Owner);
    let historical = h.inspect_context(&context("change-0", json!("change-0:op:2")), &mut Owner);
    let history = h.inspect_history(
        &req("inspect_history", json!({"at":null,"from":null,"limit":4})),
        &mut Owner,
    );
    let beta = h.inspect_context(&context("change-1", Value::Null), &mut Owner);
    let results = json!({"original":decode(original),"beta_create":decode(b),"false":decode(negative),
        "revision":decode(revision),"true":decode(positive),"current":decode(current),
        "historical":decode(historical),"history":decode(history),"beta":decode(beta)});
    let current = &results["current"];
    assert_eq!(current["projection"], "ck-ledger-understanding@2");
    assert_eq!(
        current["coverage"],
        json!({"required":4,"returned":4,"complete":true})
    );
    assert_eq!(current["current_intent"], "change-0:op:3");
    assert_eq!(current["records"][0]["input"]["what"], "x".repeat(81));
    assert_eq!(
        current["records"][0]["input"]["why"],
        "Keep original reason"
    );
    assert_eq!(current["records"][2]["input"]["why"], Value::Null);
    assert_eq!(
        current["assessments"],
        json!([
            {"assessment":"change-0:op:2","intent":"change-0:origin","applicability":"historical"},
            {"assessment":"change-0:op:4","intent":"change-0:op:3","applicability":"current"}
        ])
    );
    let historical = &results["historical"];
    assert_eq!(
        historical["coverage"],
        json!({"required":2,"returned":2,"complete":true})
    );
    assert_eq!(historical["current_intent"], "change-0:origin");
    assert_eq!(
        historical["assessments"],
        json!([
            {"assessment":"change-0:op:2","intent":"change-0:origin","applicability":"current"}
        ])
    );
    let records = current["records"].as_array().unwrap();
    for (index, result) in ["original", "false", "revision", "true"]
        .into_iter()
        .enumerate()
    {
        assert_eq!(records[index]["result"], results[result]);
        assert_eq!(results[result]["actor"], "owner-1");
    }
    assert_eq!(results["history"]["records"], current["records"]);
    assert_eq!(
        results["beta"]["records"][0]["input"]["what"],
        "independent beta"
    );
    let before_stale = custody_snapshot(&f);
    assert_eq!(decode(h.run_check(&req("run_check", json!({"key":"stale-new-key","expected_intent":"change-0:origin","check":"notice-what@1"})), &mut Owner))["code"], "conflict");
    assert_eq!(h.last_work().check_attempts, 0);
    assert_eq!(custody_snapshot(&f), before_stale);
    assert_complete_ceiling(h.last_work());
    fs::write(
        f.0.join(format!("{action}.result")),
        serde_json::to_vec(&results).unwrap(),
    )
    .unwrap();
    // Publish readiness only after result file is closed and full custody held.
    let temporary = f.0.join(format!("{action}.ready.tmp"));
    fs::write(&temporary, std::process::id().to_string()).unwrap();
    fs::rename(temporary, f.0.join(format!("{action}.ready"))).unwrap();
    let deadline = Instant::now() + Duration::from_secs(60);
    let exit = f.0.join(format!("{action}.exit"));
    while !exit.exists() {
        assert!(Instant::now() < deadline, "parent exit instruction timeout");
        std::thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(
        fs::read_to_string(exit).unwrap(),
        std::process::id().to_string()
    );
    // Real process exit, not drop(host): kernel closes all held custody fds.
    std::process::exit(0);
}

#[test]
fn continuity_process_exit_releases_contender_and_preserves_history() {
    let f = Fixture::new();
    let mut original = ContinuityChild::spawn(&f, "provision");
    original.ready(&f, "provision");
    let before = custody_snapshot(&f);
    assert!(matches!(
        f.host(OpeningMode::Reopen, None),
        Err(OpeningError::Unavailable)
    ));
    assert_eq!(custody_snapshot(&f), before);
    original.exit(&f, "provision"); // Confirm exit/reap before successor acquisition.
    let mut successor = ContinuityChild::spawn(&f, "reopen");
    successor.ready(&f, "reopen");
    assert_eq!(custody_snapshot(&f), before);
    assert_eq!(
        fs::read(f.0.join("reopen.result")).unwrap(),
        fs::read(f.0.join("provision.result")).unwrap()
    );
    assert!(matches!(
        f.host(OpeningMode::Reopen, None),
        Err(OpeningError::Unavailable)
    ));
    successor.exit(&f, "reopen");
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert_eq!(
        decode(h.inspect_context(&context("change-0", Value::Null), &mut Owner))["coverage"]
            ["required"],
        4
    );
    assert_eq!(custody_snapshot(&f), before);
}

#[test]
fn continuity_same_printable_names_and_local_member_failure_are_isolated() {
    for io in [false, true] {
        let a = Fixture::new();
        let b = Fixture::new();
        let armed = std::rc::Rc::new(std::cell::Cell::new(false));
        let arm = armed.clone();
        let mut ha = a
            .host(
                OpeningMode::FreshProvision,
                Some(Box::new(move |event| {
                    if arm.get()
                        && event
                            == (LedgerContinuityIoEvent::Identity {
                                scope: 1,
                                object: LedgerIdentityObject::MemberDirectory,
                                step: LedgerIdentityStep::BeforeFsType,
                            })
                    {
                        LedgerContinuityIoFault::NativeErrno(if io {
                            libc::EIO
                        } else {
                            libc::ESTALE
                        })
                    } else {
                        LedgerContinuityIoFault::Continue
                    }
                })),
            )
            .unwrap();
        let mut hb = b.host(OpeningMode::FreshProvision, None).unwrap();
        assert_eq!(
            decode(ha.create_change(&create_named("same-key", "private A"), &mut Owner))["kind"],
            "created"
        );
        assert_eq!(
            decode(hb.create_change(&create_named("same-key", "private B"), &mut Owner))["kind"],
            "created"
        );
        assert_eq!(
            decode(ha.create_change(&create_named("beta", "local beta"), &mut Owner))["kind"],
            "created"
        );
        // Same printable selectors/key do not import original typed input/result.
        assert_eq!(
            decode(hb.create_change(&create_named("same-key", "private A"), &mut Owner))["code"],
            "conflict"
        );
        let independent = custody_snapshot(&b);
        let local_beta = fs::read(a.path("ledger/members/m-2/trace.jsonl")).unwrap();
        if !io {
            fs::rename(a.path("ledger/members/m-1"), a.path("held-m-1")).unwrap();
            fs::create_dir(a.path("ledger/members/m-1")).unwrap();
        }
        armed.set(true);
        assert_eq!(
            decode(ha.inspect_context(&context("change-0", Value::Null), &mut Owner))["code"],
            "unavailable"
        );
        assert_eq!(ha.last_work().retention.matches, 0); // Newly opened A has no prior member proof.
        assert_eq!(
            decode(ha.inspect_context(&context("change-1", Value::Null), &mut Owner))["kind"],
            "change_context"
        );
        assert_eq!(
            fs::read(a.path("ledger/members/m-2/trace.jsonl")).unwrap(),
            local_beta
        );
        assert_eq!(
            decode(hb.inspect_context(&context("change-0", Value::Null), &mut Owner))["kind"],
            "change_context"
        );
        assert_eq!(
            decode(hb.create_change(&create_named("same-key", "private B"), &mut Owner))["kind"],
            "created"
        );
        assert_eq!(custody_snapshot(&b), independent);
        let incident: Value =
            serde_json::from_slice(&fs::read(a.path("ledger/incident.json")).unwrap()).unwrap();
        assert_eq!(incident["state"], "clear");
        assert_complete_ceiling(hb.last_work());
    }
}

struct RevokedGuard {
    state: std::rc::Rc<std::cell::Cell<u8>>,
    permission: Option<LedgerContinuityMemberPermission>,
}
impl LedgerContinuityGuard for RevokedGuard {
    fn principal(&self) -> &str {
        if self.state.get() == 3 {
            "other-owner"
        } else {
            "owner-1"
        }
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        if self.permission.is_none() {
            self.decision()
        } else {
            LedgerPermission::Allow
        }
    }
    fn member(
        &mut self,
        _: &str,
        _: &str,
        p: LedgerContinuityMemberPermission,
    ) -> LedgerPermission {
        if self.permission == Some(p) {
            self.decision()
        } else {
            LedgerPermission::Allow
        }
    }
}
impl RevokedGuard {
    fn decision(&self) -> LedgerPermission {
        match self.state.get() {
            1 => LedgerPermission::Deny,
            2 => LedgerPermission::Unavailable,
            _ => LedgerPermission::Allow,
        }
    }
}
fn private_call(
    h: &mut LedgerContinuityHost,
    op: &str,
    g: &mut dyn LedgerContinuityGuard,
) -> Vec<u8> {
    match op {
        "create_change" => h.create_change(&create_named("original-a", &"x".repeat(81)), g),
        "list_changes" => h.list_changes(&input(json!({"v":6,"op":"list_changes","ledger":"ledger-1","workspace_id":"workspace-1","limit":4,"cursor":null})), g),
        "select_change" => h.select_change(&req(op, json!({})), g),
        "inspect_history" => h.inspect_history(&req(op, json!({"at":null,"from":null,"limit":4})), g),
        "inspect_context" => h.inspect_context(&context("change-0", Value::Null), g),
        "revise_intent" => h.revise_intent(&req(op, json!({"key":"revision","expected_intent":"change-0:origin","what":"revised private text","why":null})), g),
        "run_check" => h.run_check(&check_origin(), g),
        _ => unreachable!(),
    }
}

#[test]
fn continuity_final_fresh_authorization_discards_private_output_and_check_result() {
    use LedgerContinuityMemberPermission as MP;
    for (mode, code) in [(1, "denied"), (2, "unavailable"), (3, "denied")] {
        for (op, permission) in [
            ("create_change", Some(MP::History)),
            ("list_changes", Some(MP::Metadata)),
            ("select_change", Some(MP::History)),
            ("inspect_history", None),
            ("inspect_context", Some(MP::History)),
            ("revise_intent", Some(MP::AdoptIntent)),
            ("run_check", Some(MP::RunCheck)),
        ] {
            let f = Fixture::new();
            let mut seed = f.host(OpeningMode::FreshProvision, None).unwrap();
            assert_eq!(
                decode(
                    seed.create_change(&create_named("original-a", &"x".repeat(81)), &mut Owner)
                )["kind"],
                "created"
            );
            drop(seed);
            let before = custody_snapshot(&f);
            let state = std::rc::Rc::new(std::cell::Cell::new(0));
            let revoke = state.clone();
            let hits = std::rc::Rc::new(std::cell::Cell::new(0));
            let count = hits.clone();
            let mut h = f
                .host(
                    OpeningMode::Reopen,
                    Some(Box::new(move |event| {
                        if event
                            == LedgerContinuityIoEvent::File(LedgerIoEvent {
                                scope: 0,
                                phase: "deliver",
                                object: "reply",
                                step: "before",
                            })
                        {
                            count.set(count.get() + 1);
                            revoke.set(mode);
                        }
                        LedgerContinuityIoFault::Continue
                    })),
                )
                .unwrap();
            let mut g = RevokedGuard { state, permission };
            let result = private_call(&mut h, op, &mut g);
            assert_eq!(
                result,
                format!("{{\"v\":6,\"kind\":\"error\",\"code\":\"{code}\"}}\n").as_bytes(),
                "{mode}/{op}"
            );
            assert_eq!(hits.get(), 1);
            let work = h.last_work();
            assert_eq!(work.outputs.attempts, 1, "{mode}/{op} {work:?}");
            assert_eq!(work.outputs.no_matches, 1, "{mode}/{op} {work:?}");
            assert_eq!(work.retention.attempts, 0);
            assert_complete_ceiling(work);
            if matches!(op, "run_check" | "revise_intent") {
                if op == "run_check" {
                    assert_eq!(work.check_attempts, 1);
                    assert_eq!(work.check_acceptances, 1); // Suppressed reply is not rollback.
                }
                let accepted = custody_snapshot(&f);
                drop(h);
                let mut h = f.host(OpeningMode::Reopen, None).unwrap();
                let retry = decode(private_call(&mut h, op, &mut Owner));
                assert_eq!(retry["seq"], 2);
                if op == "run_check" {
                    assert_eq!(retry["passed"], false);
                    assert_eq!(h.last_work().check_attempts, 0);
                    assert_eq!(h.last_work().check_acceptances, 0);
                    let view =
                        decode(h.inspect_context(&context("change-0", Value::Null), &mut Owner));
                    assert_eq!(view["assessments"].as_array().unwrap().len(), 1);
                }
                assert_eq!(custody_snapshot(&f), accepted);
            } else {
                assert_eq!(custody_snapshot(&f), before);
            }
        }
    }
}

#[test]
fn continuity_check_revocation_before_acceptance_preserves_pending_then_exact_retry() {
    let f = Fixture::new();
    let state = std::rc::Rc::new(std::cell::Cell::new(0));
    let revoke = state.clone();
    let hits = std::rc::Rc::new(std::cell::Cell::new(0));
    let count = hits.clone();
    let mut h = f
        .host(
            OpeningMode::FreshProvision,
            Some(Box::new(move |event| {
                if event
                    == LedgerContinuityIoEvent::File(LedgerIoEvent {
                        scope: 1,
                        phase: "append",
                        object: "trace.jsonl",
                        step: "synced",
                    })
                {
                    count.set(count.get() + 1);
                    revoke.set(1);
                }
                LedgerContinuityIoFault::Continue
            })),
        )
        .unwrap();
    assert_eq!(
        decode(h.create_change(&create_named("original-a", &"x".repeat(81)), &mut Owner))["kind"],
        "created"
    );
    state.set(0);
    hits.set(0);
    let mut guard = RevokedGuard {
        state,
        permission: Some(LedgerContinuityMemberPermission::RunCheck),
    };
    let bytes = h.run_check(&check_origin(), &mut guard);
    assert_eq!(bytes, b"{\"v\":6,\"kind\":\"error\",\"code\":\"denied\"}\n");
    assert_eq!(hits.get(), 2); // Pre-append durability sync, then suffix sync.
    assert_eq!(h.last_work().check_attempts, 1);
    assert_eq!(h.last_work().check_acceptances, 0);
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_complete_ceiling(h.last_work());
    drop(h);
    let pending = custody_snapshot(&f);
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let view = decode(h.inspect_context(&context("change-0", Value::Null), &mut Owner));
    assert_eq!(view["progress"], "blocked_pending");
    assert_eq!(view["assessments"], json!([]));
    assert_eq!(custody_snapshot(&f), pending);
    let retry = decode(h.run_check(&check_origin(), &mut Owner));
    assert_eq!(retry["seq"], 2);
    assert_eq!(retry["passed"], false);
    assert_eq!(h.last_work().check_acceptances, 1);
    let accepted = custody_snapshot(&f);
    assert_eq!(decode(h.run_check(&check_origin(), &mut Owner)), retry);
    assert_eq!(h.last_work().check_attempts, 0);
    assert_eq!(custody_snapshot(&f), accepted);
}

fn recovery_cut(cut: &str) -> LedgerIoEvent {
    let (scope, phase, object, step) = match cut {
        "reserve-tmp" => (1, "reserve", "checkpoint.tmp", "synced"),
        "pending" => (1, "reserve", "checkpoint.tmp", "renamed"),
        "partial" => (1, "append", "trace.jsonl", "short_written"),
        "suffix" => (1, "append", "trace.jsonl", "written"),
        "accept-tmp" => (1, "checkpoint", "checkpoint.tmp", "synced"),
        "accepted" => (1, "checkpoint", "checkpoint.tmp", "renamed"),
        "lost-reply" => (0, "deliver", "reply", "before"),
        _ => panic!("unknown recovery cut"),
    };
    LedgerIoEvent {
        scope,
        phase,
        object,
        step,
    }
}

#[test]
fn continuity_process_cuts_keep_read_only_prefix_and_only_exact_mutation_recovers() {
    use LedgerContinuityMemberPermission as MP;
    for op in ["run_check", "revise_intent"] {
        for cut in [
            "reserve-tmp",
            "pending",
            "partial",
            "suffix",
            "accept-tmp",
            "accepted",
            "lost-reply",
        ] {
            let f = Fixture::new();
            let mut seed = f.host(OpeningMode::FreshProvision, None).unwrap();
            assert_eq!(
                decode(
                    seed.create_change(&create_named("original-a", &"x".repeat(81)), &mut Owner)
                )["kind"],
                "created"
            );
            drop(seed);
            let shared = fs::read(f.path("ledger/creation.json")).unwrap();
            let original = fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap();
            let action = format!("cut-{op}-{cut}");
            let mut child = ContinuityChild::spawn(&f, &action);
            child.wait_code(&f, &action, 23);
            let marker: Value =
                serde_json::from_slice(&fs::read(f.0.join(format!("{action}.cut"))).unwrap())
                    .unwrap();
            assert_eq!(marker["pid"], child.0.id());
            assert_eq!(marker["action"], action);
            assert_eq!(marker["event"], format!("{:?}", recovery_cut(cut)));
            let before = custody_snapshot(&f);
            let mut h = f.host(OpeningMode::Reopen, None).unwrap();
            assert_eq!(h.last_work().member_passes, 0);
            assert_eq!(custody_snapshot(&f), before);
            let accepted = matches!(cut, "accepted" | "lost-reply");
            let view = decode(h.inspect_context(&context("change-0", Value::Null), &mut Owner));
            assert_eq!(
                view["progress"],
                if accepted || cut == "reserve-tmp" {
                    "ready"
                } else {
                    "blocked_pending"
                },
                "{op}/{cut}: {view}"
            );
            assert_eq!(view["coverage"]["required"], if accepted { 2 } else { 1 });
            assert_eq!(h.last_work().check_attempts, 0);
            assert_eq!(h.last_work().cleanup.attempts, 0);
            assert_complete_ceiling(h.last_work());
            assert_eq!(custody_snapshot(&f), before);
            let mut denied = RevokedGuard {
                state: std::rc::Rc::new(std::cell::Cell::new(1)),
                permission: Some(if op == "run_check" {
                    MP::RunCheck
                } else {
                    MP::AdoptIntent
                }),
            };
            if !accepted {
                assert_eq!(
                    decode(private_call(&mut h, op, &mut denied))["code"],
                    "denied"
                );
                assert_eq!(h.last_work().cleanup.attempts, 0);
                assert_eq!(custody_snapshot(&f), before);
            }
            let reply = if accepted {
                private_call(&mut h, op, &mut denied)
            } else {
                private_call(&mut h, op, &mut Owner)
            };
            let result = decode(reply.clone());
            assert_eq!(result["seq"], 2, "{op}/{cut}: {result}");
            assert_eq!(result["result"], "change-0:op:2");
            if op == "run_check" {
                assert_eq!(result["passed"], false);
                assert_eq!(h.last_work().check_acceptances, u64::from(!accepted));
            }
            assert_complete_ceiling(h.last_work());
            let trace = fs::read(f.path("ledger/members/m-1/trace.jsonl")).unwrap();
            assert!(trace.starts_with(&original));
            assert_eq!(trace.iter().filter(|&&b| b == b'\n').count(), 2);
            assert_eq!(fs::read(f.path("ledger/creation.json")).unwrap(), shared);
            assert!(!f.path("ledger/members/m-1/checkpoint.tmp").exists());
            let after = custody_snapshot(&f);
            assert_eq!(private_call(&mut h, op, &mut Owner), reply);
            assert_eq!(h.last_work().check_attempts, 0);
            assert_eq!(h.last_work().check_acceptances, 0);
            assert_eq!(custody_snapshot(&f), after);
            if op == "run_check" {
                assert_eq!(decode(h.run_check(&req("run_check", json!({"key":"false-check","expected_intent":"change-0:op:2","check":"notice-what@1"})), &mut Owner))["code"], "conflict");
                assert_eq!(h.last_work().check_attempts, 0);
                assert_eq!(custody_snapshot(&f), after);
            }
        }
    }
}

#[test]
fn continuity_populated_max_escaped_creation_preflight_refusal_is_observed_and_write_free() {
    for text in ["\u{1}".repeat(65_536), "\"\\".repeat(32_768)] {
        let f = Fixture::new();
        let mut seed = f.host(OpeningMode::FreshProvision, None).unwrap();
        for slot in 0..15 {
            assert_eq!(
                decode(
                    seed.create_change(&create_named(&format!("seed-{slot}"), "small"), &mut Owner)
                )["kind"],
                "created"
            );
        }
        drop(seed);
        let before = custody_snapshot(&f);
        let request = input(json!({"v":6,"op":"create_change","ledger":"ledger-1",
            "workspace_id":"workspace-1","key":"escaped-max","what":text,"why":text}));
        let hits = std::rc::Rc::new(std::cell::Cell::new(0));
        let count = hits.clone();
        let mut h = f
            .host(
                OpeningMode::Reopen,
                Some(Box::new(move |event| {
                    if event
                        == LedgerContinuityIoEvent::File(LedgerIoEvent {
                            scope: 0,
                            phase: "reserve",
                            object: "creation.tmp",
                            step: "before_create",
                        })
                    {
                        count.set(count.get() + 1);
                        LedgerContinuityIoFault::Refuse
                    } else {
                        LedgerContinuityIoFault::Continue
                    }
                })),
            )
            .unwrap();
        assert_eq!(
            decode(h.create_change(&request, &mut Owner))["code"],
            "unavailable"
        );
        assert_eq!(hits.get(), 1); // Preflight allowed real maximum before reservation.
        assert_eq!(custody_snapshot(&f), before);
        let refused = h.last_work();
        assert_eq!(refused.shared_passes, 1);
        assert_eq!(refused.member_passes, 0);
        assert_eq!(refused.candidate_emissions.attempts, 1);
        assert_eq!(refused.candidate_emissions.completions, 1);
        assert!(refused.candidate_emissions.operand_bytes >= 131_072);
        assert_eq!(refused.input_emissions.attempts, 0); // No hidden second sizing traversal.
        assert_eq!(refused.retention.attempts, 0);
        assert_complete_ceiling(refused);
        eprintln!("escaped creation pre-reservation refusal: {refused:?}");
        drop(h);
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        let result = decode(h.create_change(&request, &mut Owner));
        assert_eq!(result["kind"], "created");
        assert_eq!(result["change"], "change-15");
        assert_complete_ceiling(h.last_work());
        eprintln!("escaped creation accepted: {:?}", h.last_work());
        let control = fs::read(f.path("ledger/creation.json")).unwrap();
        assert!(control.len() <= 1_048_576);
        let control: Value = serde_json::from_slice(&control).unwrap();
        assert_eq!(control["pending"], Value::Null);
        assert_eq!(control["entries"].as_array().unwrap().len(), 16);
        let trace = fs::read(f.path("ledger/members/m-16/trace.jsonl")).unwrap();
        assert!(trace.len() <= 1_048_576);
        let origin: Value = serde_json::from_slice(&trace).unwrap();
        assert_eq!(origin["input"]["what"], text);
        assert_eq!(origin["input"]["why"], text);
        assert_eq!(origin["result"], result);
        assert_eq!(trace.iter().filter(|&&b| b == b'\n').count(), 1);
        let accepted = custody_snapshot(&f);
        assert_eq!(decode(h.create_change(&request, &mut Owner)), result);
        assert_complete_ceiling(h.last_work());
        assert_eq!(custody_snapshot(&f), accepted);
    }
}
