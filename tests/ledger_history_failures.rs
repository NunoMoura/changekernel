#![cfg(target_os = "linux")]
//! Contract-first R30-F witnesses. Execute only against a manager-selected source revision.
use changekernel::{
    LedgerCollectionPermission as CP, LedgerHistoryGrant, LedgerHistoryGrantSpec,
    LedgerHistoryGuard, LedgerHistoryHost, LedgerHistoryInput, LedgerHistoryMemberPermission as MP,
    LedgerIoEvent, LedgerIoFault, LedgerIoHook, LedgerPair, LedgerPermission as P,
    OpeningError as E, OpeningMode as Mode,
};
use serde_json::{json, Value};
use std::{
    cell::{Cell, RefCell},
    fs,
    path::{Path, PathBuf},
    process::{Command, ExitStatus, Stdio},
    rc::Rc,
    sync::atomic::{AtomicUsize, Ordering},
    time::{Duration, Instant},
};

const C: usize = 1_048_576;
const T: u64 = 17_825_792;
static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());
static NEXT: AtomicUsize = AtomicUsize::new(0);

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "ck-history-failures-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        Self(root)
    }
    fn pairs() -> [LedgerPair; 16] {
        std::array::from_fn(|i| LedgerPair {
            change: format!("change-{}", (b'a' + i as u8) as char),
            custody: format!("custody-{}", (b'a' + i as u8) as char),
        })
    }
    fn grant(&self) -> LedgerHistoryGrant {
        LedgerHistoryGrant::new(LedgerHistoryGrantSpec {
            profile: "ck-ledger-history@5",
            ledger: "ledger-1",
            custody: "ledger-custody",
            owner: "owner-1",
            workspace_id: "workspace-1",
            binding: "fixture@1",
            directory: &self.0.join("ledger"),
            anchor: &self.0.join("anchor.json"),
            grants: &Self::pairs(),
            policy: "fixture-notice@1",
            check: "notice-what@1",
            evaluator: "utf8-length@1",
            adopter: "owner-1",
        })
        .unwrap()
    }
    fn host(&self, mode: Mode, hook: Option<LedgerIoHook>) -> Result<LedgerHistoryHost, E> {
        LedgerHistoryHost::connect(self.grant(), mode, &mut Guard::allow(), hook)
    }
    fn path(&self, name: &str) -> PathBuf {
        self.0.join("ledger").join(name)
    }
    fn member(&self, slot: usize, name: &str) -> PathBuf {
        self.path(&format!("members/m-{slot}/{name}"))
    }
    fn two(&self) {
        let mut h = self.host(Mode::FreshProvision, None).unwrap();
        success(
            &call(
                &mut h,
                create("create-a", "Private original A"),
                &mut Guard::allow(),
            ),
            "created",
        );
        success(
            &call(
                &mut h,
                create("create-b", "Private original B"),
                &mut Guard::allow(),
            ),
            "created",
        );
    }
    fn child(&self, action: &str, cut: Option<LedgerIoEvent>, partial: bool) -> ExitStatus {
        // Parent has no owning host here. Logs live outside the custody snapshot.
        let n = NEXT.fetch_add(1, Ordering::Relaxed);
        let out = self.0.join(format!("child-{n}.stdout"));
        let err = self.0.join(format!("child-{n}.stderr"));
        let mut cmd = Command::new(std::env::current_exe().unwrap());
        cmd.args(["--exact", "history_failure_process_entry", "--nocapture"])
            .env("CK_R30_F_ROOT", &self.0)
            .env("CK_R30_F_ACTION", action)
            .env("CK_R30_F_PARTIAL", if partial { "1" } else { "0" })
            .stdout(Stdio::from(fs::File::create(&out).unwrap()))
            .stderr(Stdio::from(fs::File::create(&err).unwrap()));
        if let Some(e) = cut {
            cmd.env(
                "CK_R30_F_CUT",
                format!("{}:{}:{}:{}", e.scope, e.phase, e.object, e.step),
            );
        } else {
            cmd.env_remove("CK_R30_F_CUT");
        }
        let mut child = cmd.spawn().unwrap();
        let deadline = Instant::now() + Duration::from_secs(30);
        let status = loop {
            if let Some(status) = child.try_wait().unwrap() {
                break status;
            }
            if Instant::now() >= deadline {
                let kill = child.kill();
                let reap = child.wait();
                panic!("child timeout action={action} cut={cut:?}; kill={kill:?}; reap={reap:?}; stdout={} stderr={}", fs::read_to_string(&out).unwrap(), fs::read_to_string(&err).unwrap());
            }
            std::thread::sleep(Duration::from_millis(10));
        };
        eprintln!(
            "child action={action} cut={cut:?} exit={status}; stdout={} stderr={}",
            fs::read_to_string(&out).unwrap(),
            fs::read_to_string(&err).unwrap()
        );
        status
    }
    fn snapshot(&self) -> Vec<(PathBuf, Vec<u8>)> {
        fn walk(root: &Path, path: &Path, out: &mut Vec<(PathBuf, Vec<u8>)>) {
            let mut entries: Vec<_> = fs::read_dir(path)
                .unwrap()
                .map(|e| e.unwrap().path())
                .collect();
            entries.sort();
            for p in entries {
                if p.file_name()
                    .unwrap()
                    .to_string_lossy()
                    .starts_with("child-")
                {
                    continue;
                }
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
        walk(&self.0, &self.0, &mut out);
        out
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if !std::thread::panicking() {
            fs::remove_dir_all(&self.0).unwrap();
        } else {
            eprintln!("failure fixture retained: {}", self.0.display());
        }
    }
}

struct Guard {
    principal_wrong: bool,
    collection: Option<(CP, P)>,
    member: Option<(MP, P)>,
    change: Option<(String, P)>,
    // Whole-response hook can revoke the operation's permission or change its principal.
    revoke_permission: MP,
    revoke: Rc<Cell<u8>>,
}
impl Guard {
    fn allow() -> Self {
        Self {
            principal_wrong: false,
            collection: None,
            member: None,
            change: None,
            revoke_permission: MP::History,
            revoke: Rc::new(Cell::new(0)),
        }
    }
}
impl LedgerHistoryGuard for Guard {
    fn principal(&self) -> &str {
        if self.principal_wrong || self.revoke.get() == 3 {
            "other-owner"
        } else {
            "owner-1"
        }
    }
    fn collection(&mut self, _: &str, permission: CP) -> P {
        self.collection
            .filter(|(p, _)| *p == permission)
            .map_or(P::Allow, |(_, d)| d)
    }
    fn member(&mut self, _: &str, change: &str, permission: MP) -> P {
        if permission == self.revoke_permission {
            match self.revoke.get() {
                1 => return P::Deny,
                2 => return P::Unavailable,
                _ => {}
            }
        }
        if let Some((c, d)) = &self.change {
            if c == change {
                return *d;
            }
        }
        self.member
            .filter(|(p, _)| *p == permission)
            .map_or(P::Allow, |(_, d)| d)
    }
}
fn input(v: &Value) -> LedgerHistoryInput {
    raw(serde_json::to_vec(v).unwrap())
}
fn raw(mut bytes: Vec<u8>) -> LedgerHistoryInput {
    let input = LedgerHistoryInput::new(&mut bytes);
    assert!(bytes.is_empty());
    assert_eq!(bytes.capacity(), 0);
    input
}
fn create(key: &str, what: &str) -> Value {
    json!({"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":key,"what":what,"why":null})
}
fn revise(key: &str, expected: &str, what: &str) -> Value {
    json!({"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-a","key":key,"expected_intent":expected,"what":what,"why":null})
}
fn check(key: &str, expected: &str, check: &str) -> Value {
    json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-a","key":key,"expected_intent":expected,"check":check})
}
fn context(change: &str) -> Value {
    json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":change,"at":null,"purpose":"understanding"})
}
fn history(change: &str) -> Value {
    json!({"v":5,"op":"inspect_history","ledger":"ledger-1","workspace_id":"workspace-1","change":change,"at":null,"from":null,"limit":4})
}
fn select(change: &str) -> Value {
    json!({"v":5,"op":"select_change","ledger":"ledger-1","workspace_id":"workspace-1","change":change})
}
fn list(limit: u64) -> Value {
    json!({"v":5,"op":"list_changes","ledger":"ledger-1","workspace_id":"workspace-1","cursor":null,"limit":limit})
}
fn call(h: &mut LedgerHistoryHost, request: Value, g: &mut Guard) -> Vec<u8> {
    let bytes = input(&request);
    match request["op"].as_str().unwrap() {
        "create_change" => h.create_change(&bytes, g),
        "revise_intent" => h.revise_intent(&bytes, g),
        "run_check" => h.run_check(&bytes, g),
        "inspect_context" => h.inspect_context(&bytes, g),
        "inspect_history" => h.inspect_history(&bytes, g),
        "select_change" => h.select_change(&bytes, g),
        "list_changes" => h.list_changes(&bytes, g),
        _ => panic!("test request has no selected dispatcher"),
    }
}
fn value(bytes: &[u8]) -> Value {
    serde_json::from_slice(bytes).unwrap()
}
fn success(bytes: &[u8], kind: &str) -> Value {
    assert_eq!(bytes.last(), Some(&b'\n'));
    let v = value(bytes);
    assert_eq!(v["v"], 5, "{}", String::from_utf8_lossy(bytes));
    assert_eq!(v["kind"], kind, "{}", String::from_utf8_lossy(bytes));
    v
}
fn error(bytes: &[u8], code: &str) {
    // Exact bytes exclude private count/result/record fields and v1 native serialization.
    assert_eq!(
        bytes,
        format!("{{\"v\":5,\"kind\":\"error\",\"code\":\"{code}\"}}\n").as_bytes()
    );
}
fn event(
    scope: u8,
    phase: &'static str,
    object: &'static str,
    step: &'static str,
) -> LedgerIoEvent {
    LedgerIoEvent {
        scope,
        phase,
        object,
        step,
    }
}
fn fault(at: LedgerIoEvent, f: LedgerIoFault) -> (LedgerIoHook, Rc<Cell<usize>>) {
    let hits = Rc::new(Cell::new(0));
    let count = Rc::clone(&hits);
    (
        Box::new(move |e| {
            if e == at {
                count.set(count.get() + 1);
                f
            } else {
                LedgerIoFault::Continue
            }
        }),
        hits,
    )
}

#[test]
fn history_failure_process_entry() {
    let Ok(root) = std::env::var("CK_R30_F_ROOT") else {
        return;
    };
    let f = Fixture(PathBuf::from(root));
    let cut = std::env::var("CK_R30_F_CUT").ok();
    let partial = std::env::var("CK_R30_F_PARTIAL").unwrap() == "1";
    let hook: LedgerIoHook = Box::new(move |e| {
        let identity = format!("{}:{}:{}:{}", e.scope, e.phase, e.object, e.step);
        if cut.as_deref() == Some(&identity) {
            eprintln!("reached process cut {identity}");
            std::process::exit(71);
        }
        if partial && e == event(1, "append", "trace.jsonl", "before_write") {
            LedgerIoFault::ShortWrite
        } else {
            LedgerIoFault::Continue
        }
    });
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    let action = std::env::var("CK_R30_F_ACTION").unwrap();
    match action.as_str() {
        "revise" => {
            success(
                &call(
                    &mut h,
                    revise("pending-a", "change-a:origin", "Private revision A"),
                    &mut Guard::allow(),
                ),
                "intent_revised",
            );
        }
        "check" => {
            success(
                &call(
                    &mut h,
                    check("pending-check", "change-a:origin", "notice-what@1"),
                    &mut Guard::allow(),
                ),
                "intent_assessed",
            );
        }
        "create" => {
            success(
                &call(
                    &mut h,
                    create("create-a", "Private original A"),
                    &mut Guard::allow(),
                ),
                "created",
            );
        }
        _ => panic!("unknown child action"),
    }
    drop(h);
    // Parent owns the fixture. Do not run its recursive cleanup from this child.
    std::mem::forget(f);
}

#[test]
fn ingress_admission_and_wrong_dispatch_never_touch_custody() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let (hook, hits) = fault(
        event(0, "deliver", "reply", "before"),
        LedgerIoFault::Refuse,
    );
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    let before = f.snapshot();
    for bytes in [
        br#"{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"bad","what":"private"}"#.to_vec(),
        br#"{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"bad","what":"private","why":null,"why":null}"#.to_vec(),
        br#"{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"bad","what":"private","why":null,"actor":"owner-1"}"#.to_vec(),
        br#"{"v":4,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"bad","what":"private","why":null}"#.to_vec(),
        br#"{"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-a","at":null,"purpose":"unknown"}"#.to_vec(),
        b"{} trailing".to_vec(),
    ] {
        error(&h.create_change(&raw(bytes), &mut Guard::allow()), "invalid_input");
        assert_eq!(h.last_work().member_passes, 0);
        assert_eq!(h.last_work().retention.attempts, 0);
    }
    error(
        &h.create_change(&input(&context("change-a")), &mut Guard::allow()),
        "unsupported",
    );
    let mut oversized = Vec::with_capacity(C + 1);
    oversized.extend_from_slice(b"{}");
    let old_capacity = oversized.capacity();
    let refused = LedgerHistoryInput::new(&mut oversized);
    assert_eq!(oversized, b"{}");
    assert_eq!(oversized.capacity(), old_capacity);
    assert_eq!(refused.capacity(), 0);
    assert!(refused.as_bytes().is_empty());
    error(
        &h.inspect_context(&refused, &mut Guard::allow()),
        "invalid_input",
    );
    let mut too_long = vec![b' '; C + 1];
    let refused = LedgerHistoryInput::new(&mut too_long);
    assert_eq!(too_long.len(), C + 1);
    error(
        &h.inspect_context(&refused, &mut Guard::allow()),
        "invalid_input",
    );
    // Exactly C owning bytes/capacity are admitted. JSON whitespace is not a new API.
    let mut exact = Vec::with_capacity(C);
    exact.extend_from_slice(&serde_json::to_vec(&context("change-a")).unwrap());
    exact.resize(C, b' ');
    let exact = LedgerHistoryInput::new(&mut exact);
    assert_eq!(exact.capacity(), C);
    assert_eq!(exact.as_bytes().len(), C);
    // Refuse the success cut after decoding, proving equality was admitted.
    error(
        &h.inspect_context(&exact, &mut Guard::allow()),
        "unavailable",
    );
    assert_eq!(hits.get(), 1);
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(f.snapshot(), before);
}

#[test]
fn independent_permissions_and_accepted_retry_precedence() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    for (permission, req) in [
        (
            MP::AdoptIntent,
            revise("rev-a", "change-a:origin", "Adopted A"),
        ),
        (
            MP::RunCheck,
            check("check-a", "change-a:origin", "notice-what@1"),
        ),
        (MP::History, context("change-a")),
        (MP::Metadata, select("change-a")),
    ] {
        for (decision, code) in [(P::Deny, "denied"), (P::Unavailable, "unavailable")] {
            let before = f.snapshot();
            let mut g = Guard::allow();
            g.member = Some((permission, decision));
            error(&call(&mut h, req.clone(), &mut g), code);
            assert_eq!(h.last_work().retention.attempts, 0);
            assert_eq!(f.snapshot(), before);
        }
    }
    let original = check("check-a", "change-a:origin", "notice-what@1");
    let accepted = call(&mut h, original.clone(), &mut Guard::allow());
    success(&accepted, "intent_assessed");
    let mut g = Guard::allow();
    g.member = Some((MP::RunCheck, P::Deny));
    success(
        &call(
            &mut h,
            revise("rev-a", "change-a:origin", "Adopted A"),
            &mut g,
        ),
        "intent_revised",
    );
    let before = f.snapshot();
    assert_eq!(call(&mut h, original, &mut g), accepted); // Old predecessor and denied RunCheck do not rerun it.
    assert_eq!(h.last_work().check_attempts, 0);
    assert_eq!(h.last_work().check_acceptances, 0);
    assert!(h.last_work().evaluator_calculations.completions > 0);
    error(
        &call(
            &mut h,
            check("check-a", "change-a:op:3", "unknown@1"),
            &mut g,
        ),
        "conflict",
    );
    error(
        &call(
            &mut h,
            check("new-check", "change-a:origin", "unknown@1"),
            &mut g,
        ),
        "denied",
    );
    g.member = None;
    error(
        &call(
            &mut h,
            check("new-check", "change-a:origin", "unknown@1"),
            &mut g,
        ),
        "conflict",
    );
    error(
        &call(
            &mut h,
            check("new-check", "change-a:op:3", "unknown@1"),
            &mut g,
        ),
        "unsupported",
    );
    let mut foreign = history("change-a");
    foreign["at"] = json!("change-b:origin");
    error(&call(&mut h, foreign, &mut g), "denied");
    assert_eq!(h.last_work().member_passes, 0);
    g.member = Some((MP::History, P::Deny));
    error(
        &call(
            &mut h,
            check("check-a", "change-a:origin", "notice-what@1"),
            &mut g,
        ),
        "denied",
    );
    g.member = None;
    g.principal_wrong = true;
    error(&call(&mut h, context("change-a"), &mut g), "denied");
    assert_eq!(h.last_work().member_passes, 0);
    assert_eq!(f.snapshot(), before);
}

#[test]
fn denied_connect_collection_and_new_creation_have_no_private_access() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let before = f.snapshot();
    for (decision, expected) in [(P::Deny, E::Denied), (P::Unavailable, E::Unavailable)] {
        let mut g = Guard::allow();
        g.collection = Some((CP::Connect, decision));
        let result = LedgerHistoryHost::connect(f.grant(), Mode::Reopen, &mut g, None);
        assert!(matches!(result, Err(e) if e == expected));
        assert_eq!(f.snapshot(), before);
    }
    let mut h = f.host(Mode::Reopen, None).unwrap();
    for (permission, req) in [
        (CP::List, list(1)),
        (CP::Create, create("new-c", "new")),
        (CP::Connect, context("change-a")),
    ] {
        let mut g = Guard::allow();
        g.collection = Some((permission, P::Deny));
        error(&call(&mut h, req, &mut g), "denied");
        assert_eq!(h.last_work().member_passes, 0);
    }
    let mut g = Guard::allow();
    g.member = Some((MP::Create, P::Deny));
    error(&call(&mut h, create("new-c", "new"), &mut g), "denied");
    assert_eq!(h.last_work().member_passes, 0);
    assert_eq!(f.snapshot(), before);
}

#[test]
fn whole_response_hook_revocation_precedes_fresh_final_authorization() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (mode, code) in [(1, "denied"), (2, "unavailable"), (3, "denied")] {
        for (permission, req) in [
            (MP::History, context("change-a")),
            (MP::History, history("change-a")),
            (MP::Metadata, select("change-a")),
            (MP::Metadata, list(1)),
            (MP::History, select("change-a")),
            (MP::History, list(1)),
            (
                MP::History,
                revise("lost-rev", "change-a:origin", "Private accepted revision"),
            ),
        ] {
            let f = Fixture::new();
            f.two();
            let before = f.snapshot();
            let mut g = Guard::allow();
            g.revoke_permission = permission;
            let revoke = Rc::clone(&g.revoke);
            let hits = Rc::new(Cell::new(0));
            let count = Rc::clone(&hits);
            let hook: LedgerIoHook = Box::new(move |e| {
                if e == event(0, "deliver", "reply", "before") {
                    count.set(count.get() + 1);
                    revoke.set(mode);
                }
                LedgerIoFault::Continue
            });
            let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
            error(&call(&mut h, req.clone(), &mut g), code);
            assert_eq!(hits.get(), 1);
            assert_eq!(h.last_work().retention.attempts, 0);
            if req["op"] == "revise_intent" {
                assert_eq!(
                    value(&fs::read(f.member(1, "checkpoint.json")).unwrap())["generation"],
                    2
                );
                drop(h);
                let before_retry = f.snapshot();
                let mut h = f.host(Mode::Reopen, None).unwrap();
                let result = success(&call(&mut h, req, &mut Guard::allow()), "intent_revised");
                assert_eq!(result["result"], "change-a:op:2");
                assert_eq!(f.snapshot(), before_retry);
            } else {
                assert_eq!(f.snapshot(), before);
            }
        }
    }
}

#[test]
fn selection_and_listing_require_both_gates_history_context_require_history() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for permission in [MP::Metadata, MP::History] {
        let f = Fixture::new();
        f.two();
        let before = f.snapshot();
        let events = Rc::new(RefCell::new(Vec::new()));
        let record = Rc::clone(&events);
        let hook: LedgerIoHook = Box::new(move |e| {
            record.borrow_mut().push(e);
            LedgerIoFault::Continue
        });
        let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
        let first = success(&call(&mut h, list(1), &mut Guard::allow()), "change_page");
        assert!(!first["next"].is_null());
        events.borrow_mut().clear();
        let mut g = Guard::allow();
        g.member = Some((permission, P::Deny));
        error(&call(&mut h, select("change-a"), &mut g), "denied");
        let mut cursor = list(1);
        cursor["cursor"] = first["next"].clone();
        error(&call(&mut h, cursor, &mut g), "denied");
        let page = success(&call(&mut h, list(1), &mut g), "change_page");
        assert_eq!(page["members"], json!([]));
        assert!(page["next"].is_null());
        assert!(!events.borrow().iter().any(|e| e.scope != 0));
        if permission == MP::History {
            error(&call(&mut h, context("change-a"), &mut g), "denied");
            error(&call(&mut h, history("change-a"), &mut g), "denied");
        } else {
            success(&call(&mut h, context("change-a"), &mut g), "change_context");
            success(&call(&mut h, history("change-a"), &mut g), "history_view");
        }
        assert_eq!(f.snapshot(), before);
    }
}

#[test]
fn denied_member_unopened_unavailable_out_of_page_suppresses_everything() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    fs::remove_file(f.member(1, "checkpoint.json")).unwrap();
    let before = f.snapshot();
    let events = Rc::new(RefCell::new(Vec::new()));
    let record = Rc::clone(&events);
    let hook: LedgerIoHook = Box::new(move |e| {
        record.borrow_mut().push(e);
        LedgerIoFault::Continue
    });
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    let mut g = Guard::allow();
    g.change = Some(("change-a".into(), P::Deny));
    let page = success(&call(&mut h, list(1), &mut g), "change_page");
    assert_eq!(page["members"].as_array().unwrap().len(), 1);
    assert_eq!(page["members"][0]["change"], "change-b");
    assert!(page["next"].is_null());
    assert!(!events.borrow().iter().any(|e| e.scope == 1));
    events.borrow_mut().clear();
    error(&call(&mut h, context("change-a"), &mut g), "denied");
    assert!(!events.borrow().iter().any(|e| e.scope == 1));
    g.change = Some(("change-a".into(), P::Unavailable));
    error(&call(&mut h, list(1), &mut g), "unavailable");
    g.change = None;
    error(&call(&mut h, list(1), &mut g), "unavailable");
    success(&call(&mut h, context("change-b"), &mut g), "change_context");
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(f.snapshot(), before);
    drop(h);
    let f = Fixture::new();
    f.two();
    let before = f.snapshot();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let mut g = Guard::allow();
    g.change = Some(("change-b".into(), P::Unavailable));
    // B lies beyond a limit-one page but remains a required candidate.
    error(&call(&mut h, list(1), &mut g), "unavailable");
    assert_eq!(f.snapshot(), before);
}

#[test]
fn final_list_membership_change_never_rescans_or_returns_partial_page() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for initially_denied in [false, true] {
        let f = Fixture::new();
        f.two();
        let before = f.snapshot();
        struct Visibility {
            changed: Rc<Cell<bool>>,
            initially_denied: bool,
        }
        impl LedgerHistoryGuard for Visibility {
            fn principal(&self) -> &str {
                "owner-1"
            }
            fn collection(&mut self, _: &str, _: CP) -> P {
                P::Allow
            }
            fn member(&mut self, _: &str, c: &str, _: MP) -> P {
                if c == "change-b" && (self.initially_denied != self.changed.get()) {
                    P::Deny
                } else {
                    P::Allow
                }
            }
        }
        let changed = Rc::new(Cell::new(false));
        let hook_changed = Rc::clone(&changed);
        let hook: LedgerIoHook = Box::new(move |e| {
            if e == event(0, "deliver", "reply", "before") {
                hook_changed.set(true);
            }
            LedgerIoFault::Continue
        });
        let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
        let mut g = Visibility {
            changed: Rc::clone(&changed),
            initially_denied,
        };
        error(
            &h.list_changes(&input(&list(1)), &mut g),
            if initially_denied {
                "unavailable"
            } else {
                "denied"
            },
        );
        assert!(changed.get());
        assert_eq!(f.snapshot(), before);
    }
}

#[test]
fn process_pending_and_proved_temporaries_are_read_only_exact_mutation_recovers() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (cut, partial, expected_progress) in [
        (
            event(1, "reserve", "checkpoint.tmp", "synced"),
            false,
            "ready",
        ),
        (
            event(1, "reserve", "checkpoint.tmp", "renamed"),
            false,
            "blocked_pending",
        ),
        (
            event(1, "append", "trace.jsonl", "short_written"),
            true,
            "blocked_pending",
        ),
        (
            event(1, "append", "trace.jsonl", "written"),
            false,
            "blocked_pending",
        ),
        (
            event(1, "checkpoint", "checkpoint.tmp", "synced"),
            false,
            "blocked_pending",
        ),
        (
            event(1, "checkpoint", "checkpoint.tmp", "renamed"),
            false,
            "ready",
        ),
    ] {
        for action in ["revise", "check"] {
            let f = Fixture::new();
            f.two();
            let shared = fs::read(f.path("creation.json")).unwrap();
            let original_trace = fs::read(f.member(1, "trace.jsonl")).unwrap();
            assert_eq!(f.child(action, Some(cut), partial).code(), Some(71));
            let before = f.snapshot();
            let mut h = f.host(Mode::Reopen, None).unwrap();
            assert_eq!(h.connection_work().member_passes, 0);
            assert_eq!(f.snapshot(), before);
            let ctx = success(
                &call(&mut h, context("change-a"), &mut Guard::allow()),
                "change_context",
            );
            assert_eq!(ctx["progress"], expected_progress);
            assert_eq!(h.last_work().check_attempts, 0);
            assert_eq!(h.last_work().check_acceptances, 0);
            success(
                &call(&mut h, history("change-a"), &mut Guard::allow()),
                "history_view",
            );
            success(
                &call(&mut h, select("change-a"), &mut Guard::allow()),
                "selection",
            );
            success(&call(&mut h, list(1), &mut Guard::allow()), "change_page");
            success(
                &call(
                    &mut h,
                    create("create-a", "Private original A"),
                    &mut Guard::allow(),
                ),
                "created",
            );
            assert_eq!(h.last_work().cleanup.attempts, 0);
            assert_eq!(f.snapshot(), before);
            let request = if action == "revise" {
                revise("pending-a", "change-a:origin", "Private revision A")
            } else {
                check("pending-check", "change-a:origin", "notice-what@1")
            };
            let permission = if action == "revise" {
                MP::AdoptIntent
            } else {
                MP::RunCheck
            };
            // Installed acceptance may be retried without mutation permission; otherwise denial preserves every remnant.
            let accepted = cut.step == "renamed" && cut.phase == "checkpoint";
            if !accepted {
                let mut g = Guard::allow();
                g.member = Some((permission, P::Deny));
                error(&call(&mut h, request.clone(), &mut g), "denied");
                assert_eq!(h.last_work().cleanup.attempts, 0);
                assert_eq!(f.snapshot(), before);
                let other = if action == "revise" {
                    revise("other-a", "change-a:origin", "other")
                } else {
                    check("other-check", "change-a:origin", "notice-what@1")
                };
                error(&call(&mut h, other, &mut Guard::allow()), "unavailable");
                assert_eq!(f.snapshot(), before);
            }
            let reply = call(&mut h, request.clone(), &mut Guard::allow());
            let result = success(
                &reply,
                if action == "revise" {
                    "intent_revised"
                } else {
                    "intent_assessed"
                },
            );
            assert_eq!(result["seq"], 2);
            assert_eq!(result["result"], "change-a:op:2");
            let trace = fs::read(f.member(1, "trace.jsonl")).unwrap();
            assert!(trace.starts_with(&original_trace));
            assert_eq!(trace.iter().filter(|&&b| b == b'\n').count(), 2);
            assert_eq!(fs::read(f.path("creation.json")).unwrap(), shared);
            assert!(!f.member(1, "checkpoint.tmp").exists());
            let before_retry = f.snapshot();
            assert_eq!(call(&mut h, request, &mut Guard::allow()), reply);
            assert_eq!(h.last_work().check_attempts, 0);
            assert_eq!(f.snapshot(), before_retry);
        }
    }
}

#[test]
fn lost_reply_after_real_acceptance_returns_original_without_second_append() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for action in ["revise", "check"] {
        let f = Fixture::new();
        f.two();
        assert_eq!(
            f.child(action, Some(event(0, "deliver", "reply", "before")), false)
                .code(),
            Some(71)
        );
        let before = f.snapshot();
        let mut h = f.host(Mode::Reopen, None).unwrap();
        let request = if action == "revise" {
            revise("pending-a", "change-a:origin", "Private revision A")
        } else {
            check("pending-check", "change-a:origin", "notice-what@1")
        };
        let mut g = Guard::allow();
        g.member = Some((
            if action == "revise" {
                MP::AdoptIntent
            } else {
                MP::RunCheck
            },
            P::Deny,
        ));
        let reply = success(
            &call(&mut h, request, &mut g),
            if action == "revise" {
                "intent_revised"
            } else {
                "intent_assessed"
            },
        );
        assert_eq!(reply["seq"], 2);
        assert_eq!(reply["actor"], "owner-1");
        assert_eq!(h.last_work().check_attempts, 0);
        assert_eq!(h.last_work().check_acceptances, 0);
        assert_eq!(f.snapshot(), before);
    }
}

#[test]
fn deferred_shared_creation_proof_cannot_be_read_or_cleaned_by_other_input() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for cut in [
        event(0, "reserve", "creation.tmp", "synced"),
        event(0, "associate", "creation.tmp", "synced"),
    ] {
        let f = Fixture::new();
        drop(f.host(Mode::FreshProvision, None).unwrap());
        assert_eq!(f.child("create", Some(cut), false).code(), Some(71));
        let before = f.snapshot();
        let mut h = f.host(Mode::Reopen, None).unwrap();
        assert_eq!(h.connection_work().member_passes, 0);
        if cut.phase == "associate" {
            error(&call(&mut h, list(1), &mut Guard::allow()), "unavailable");
            assert_eq!(h.last_work().member_passes, 0);
            error(
                &call(&mut h, context("change-a"), &mut Guard::allow()),
                "unavailable",
            );
            assert_eq!(h.last_work().member_passes, 0);
        } else {
            let page = success(&call(&mut h, list(1), &mut Guard::allow()), "change_page");
            assert_eq!(page["members"], json!([]));
        }
        error(
            &call(&mut h, create("unrelated", "other"), &mut Guard::allow()),
            "unavailable",
        );
        let mut g = Guard::allow();
        g.member = Some((MP::Create, P::Deny));
        error(
            &call(&mut h, create("create-a", "Private original A"), &mut g),
            "denied",
        );
        assert_eq!(h.last_work().cleanup.attempts, 0);
        assert_eq!(f.snapshot(), before);
        success(
            &call(
                &mut h,
                create("create-a", "Private original A"),
                &mut Guard::allow(),
            ),
            "created",
        );
        assert!(!f.path("creation.tmp").exists());
        assert_eq!(
            value(&fs::read(f.path("creation.json")).unwrap())["entries"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
}

#[test]
fn missing_controls_origin_damage_and_unaccepted_tail_never_reconstruct_truth() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for name in ["checkpoint.json", "incident.json", "writer.lock"] {
        let f = Fixture::new();
        f.two();
        fs::remove_file(f.member(1, name)).unwrap();
        let before = f.snapshot();
        let mut h = f.host(Mode::Reopen, None).unwrap();
        error(
            &call(&mut h, context("change-a"), &mut Guard::allow()),
            "unavailable",
        );
        success(
            &call(&mut h, context("change-b"), &mut Guard::allow()),
            "change_context",
        );
        assert_eq!(h.last_work().retention.attempts, 0);
        assert_eq!(f.snapshot(), before);
    }
    let f = Fixture::new();
    f.two();
    let installed = fs::read(f.member(1, "checkpoint.json")).unwrap();
    assert_eq!(
        f.child(
            "revise",
            Some(event(1, "append", "trace.jsonl", "written")),
            false
        )
        .code(),
        Some(71)
    );
    // Real producer wrote a complete canonical successor, but no installed reservation
    // now selects it. This controlled custody alteration must not bootstrap acceptance.
    fs::write(f.member(1, "checkpoint.json"), installed).unwrap();
    let before = f.snapshot();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let ctx = success(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "change_context",
    );
    assert_eq!(ctx["progress"], "blocked_unaccepted_tail");
    assert_eq!(ctx["records"].as_array().unwrap().len(), 1);
    success(
        &call(
            &mut h,
            create("create-a", "Private original A"),
            &mut Guard::allow(),
        ),
        "created",
    );
    error(
        &call(
            &mut h,
            revise("new", "change-a:origin", "new"),
            &mut Guard::allow(),
        ),
        "unavailable",
    );
    assert_eq!(f.snapshot(), before);
    drop(h);
    // An old cursor does not excuse corrupting a later accepted record.
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    success(
        &call(
            &mut h,
            revise("rev-a", "change-a:origin", "Later private revision"),
            &mut Guard::allow(),
        ),
        "intent_revised",
    );
    drop(h);
    let path = f.member(1, "trace.jsonl");
    let mut bytes = fs::read(&path).unwrap();
    let i = bytes
        .windows(b"Later private revision".len())
        .position(|w| w == b"Later private revision")
        .unwrap();
    bytes[i] = b'X';
    fs::write(path, bytes).unwrap();
    let before = f.snapshot();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let mut old = context("change-a");
    old["at"] = json!("change-a:origin");
    error(&call(&mut h, old, &mut Guard::allow()), "unavailable");
    success(
        &call(&mut h, context("change-b"), &mut Guard::allow()),
        "change_context",
    );
    assert_eq!(f.snapshot(), before);
    drop(h);
    let f = Fixture::new();
    f.two();
    fs::remove_file(f.path("creation.json")).unwrap();
    let before = f.snapshot();
    assert!(matches!(f.host(Mode::Reopen, None), Err(E::Unavailable)));
    assert_eq!(f.snapshot(), before);
}

#[test]
fn real_faults_retain_scope_correct_incident_refusal_does_not() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (cut, fault_kind, request, issue) in [
        (
            event(1, "recover", "trace.jsonl", "before_read"),
            LedgerIoFault::Io,
            context("change-a"),
            "io",
        ),
        (
            event(1, "append", "trace.jsonl", "before_write"),
            LedgerIoFault::ShortWrite,
            revise("fault-a", "change-a:origin", "real partial append"),
            "short_write",
        ),
        (
            event(1, "reserve", "checkpoint.tmp", "before_rename"),
            LedgerIoFault::Io,
            revise("fault-a", "change-a:origin", "real rename failure"),
            "io",
        ),
        (
            event(1, "deliver", "trace.jsonl", "before_sync"),
            LedgerIoFault::Io,
            context("change-a"),
            "barrier",
        ),
    ] {
        let f = Fixture::new();
        f.two();
        let shared = fs::read(f.path("creation.json")).unwrap();
        let b = fs::read(f.member(2, "trace.jsonl")).unwrap();
        let (hook, hits) = fault(cut, fault_kind);
        let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
        error(&call(&mut h, request, &mut Guard::allow()), "unavailable");
        assert!(hits.get() > 0);
        assert_eq!(h.last_work().retention.attempts, 1);
        assert_eq!(h.last_work().retention.matches, 1);
        let incident = value(&fs::read(f.member(1, "incident.json")).unwrap());
        assert_eq!(incident["state"], "blocked");
        assert_eq!(incident["issue"], issue);
        success(
            &call(&mut h, context("change-b"), &mut Guard::allow()),
            "change_context",
        );
        drop(h);
        let mut h = f.host(Mode::Reopen, None).unwrap();
        error(
            &call(&mut h, context("change-a"), &mut Guard::allow()),
            "unavailable",
        );
        error(&call(&mut h, list(1), &mut Guard::allow()), "unavailable");
        success(
            &call(&mut h, context("change-b"), &mut Guard::allow()),
            "change_context",
        );
        assert_eq!(fs::read(f.path("creation.json")).unwrap(), shared);
        assert_eq!(fs::read(f.member(2, "trace.jsonl")).unwrap(), b);
    }
    for (cut, fault_kind) in [
        (
            event(1, "recover", "trace.jsonl", "before_read"),
            LedgerIoFault::Refuse,
        ),
        (
            event(1, "recover", "trace.jsonl", "read"),
            LedgerIoFault::Io,
        ),
    ] {
        let f = Fixture::new();
        f.two();
        let before = f.snapshot();
        let (hook, hits) = fault(cut, fault_kind);
        let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
        error(
            &call(&mut h, context("change-a"), &mut Guard::allow()),
            "unavailable",
        );
        assert!(hits.get() > 0);
        assert_eq!(h.last_work().retention.attempts, 0);
        assert_eq!(f.snapshot(), before);
    }
    let f = Fixture::new();
    f.two();
    let (hook, hits) = fault(
        event(0, "recover", "creation.json", "before_read"),
        LedgerIoFault::Io,
    );
    assert!(matches!(
        f.host(Mode::Reopen, Some(hook)),
        Err(E::Unavailable)
    ));
    assert!(hits.get() > 0);
    assert_eq!(
        value(&fs::read(f.path("incident.json")).unwrap())["state"],
        "blocked"
    );
    assert_eq!(
        value(&fs::read(f.member(2, "incident.json")).unwrap())["state"],
        "clear"
    );
    assert!(matches!(f.host(Mode::Reopen, None), Err(E::Unavailable)));
}

#[test]
fn authorized_cleanup_io_failure_and_failed_retention_preserve_limits() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    assert_eq!(
        f.child(
            "revise",
            Some(event(1, "reserve", "checkpoint.tmp", "synced")),
            false
        )
        .code(),
        Some(71)
    );
    let (hook, hits) = fault(
        event(1, "recover", "checkpoint.tmp", "before_unlink"),
        LedgerIoFault::Io,
    );
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    error(
        &call(
            &mut h,
            revise("pending-a", "change-a:origin", "Private revision A"),
            &mut Guard::allow(),
        ),
        "unavailable",
    );
    assert!(hits.get() > 0);
    assert_eq!(h.last_work().retention.attempts, 1);
    assert!(f.member(1, "checkpoint.tmp").exists());
    assert_eq!(
        value(&fs::read(f.member(1, "incident.json")).unwrap())["state"],
        "blocked"
    );
    drop(h);
    let f = Fixture::new();
    f.two();
    let hits = Rc::new(Cell::new(0));
    let count = Rc::clone(&hits);
    let hook: LedgerIoHook = Box::new(move |e| {
        if e == event(1, "deliver", "trace.jsonl", "before_sync")
            || e == event(1, "deliver", "incident.tmp", "before_create")
        {
            count.set(count.get() + 1);
            LedgerIoFault::Io
        } else {
            LedgerIoFault::Continue
        }
    });
    let before = f.snapshot();
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    error(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "unavailable",
    );
    assert_eq!(hits.get(), 2);
    assert_eq!(h.last_work().retention.attempts, 1);
    assert_eq!(h.last_work().retention.no_matches, 1);
    assert_eq!(f.snapshot(), before); // Retention failed before creating any incident evidence.
    error(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "unavailable",
    );
    assert_eq!(h.last_work().retention.attempts, 0); // Live latch; no recursive retention.
    success(
        &call(&mut h, context("change-b"), &mut Guard::allow()),
        "change_context",
    );
    drop(h);
    // This controlled observation was lost, not an unconditional durable restart refusal.
    let mut h = f.host(Mode::Reopen, None).unwrap();
    success(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "change_context",
    );
    assert_eq!(f.snapshot(), before);
}

#[test]
fn count_equality_full_retry_and_oversized_retained_storage_refuse_without_mutation() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let original = create("create-a", "Private original A");
    let original_reply = call(&mut h, original.clone(), &mut Guard::allow());
    let mut expected = "change-a:origin".to_owned();
    for seq in 2..=128 {
        let req = revise(&format!("count-{seq}"), &expected, "same exact text");
        let result = success(&call(&mut h, req, &mut Guard::allow()), "intent_revised");
        assert_eq!(result["seq"], seq);
        expected = format!("change-a:op:{seq}");
    }
    let before = f.snapshot();
    error(
        &call(
            &mut h,
            revise("overflow", &expected, "new"),
            &mut Guard::allow(),
        ),
        "unsupported",
    );
    assert_eq!(call(&mut h, original, &mut Guard::allow()), original_reply);
    let ctx = success(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "change_context",
    );
    assert_eq!(ctx["accepted"]["last"], 128);
    error(
        &call(
            &mut h,
            revise("create-a", &expected, "cross-kind"),
            &mut Guard::allow(),
        ),
        "conflict",
    );
    assert_eq!(f.snapshot(), before);
    drop(h);
    // Refuse oversized existing storage, preserving its installed acceptance and suffix.
    fs::OpenOptions::new()
        .write(true)
        .open(f.member(1, "trace.jsonl"))
        .unwrap()
        .set_len(T + 1)
        .unwrap();
    let checkpoint = fs::read(f.member(1, "checkpoint.json")).unwrap();
    let shared = fs::read(f.path("creation.json")).unwrap();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    error(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "unavailable",
    );
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(
        fs::metadata(f.member(1, "trace.jsonl")).unwrap().len(),
        T + 1
    );
    assert_eq!(
        fs::read(f.member(1, "checkpoint.json")).unwrap(),
        checkpoint
    );
    assert_eq!(fs::read(f.path("creation.json")).unwrap(), shared);
    success(
        &call(&mut h, context("change-b"), &mut Guard::allow()),
        "change_context",
    );
}

#[test]
fn equal_remnants_and_impossible_pending_are_validated_before_any_cleanup() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    fs::copy(
        f.member(1, "checkpoint.json"),
        f.member(1, "checkpoint.tmp"),
    )
    .unwrap();
    fs::copy(f.path("creation.json"), f.path("creation.tmp")).unwrap();
    let before = f.snapshot();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    success(
        &call(&mut h, context("change-a"), &mut Guard::allow()),
        "change_context",
    );
    success(
        &call(
            &mut h,
            create("create-a", "Private original A"),
            &mut Guard::allow(),
        ),
        "created",
    );
    assert_eq!(h.last_work().cleanup.attempts, 0);
    assert_eq!(f.snapshot(), before);
    let mut g = Guard::allow();
    g.member = Some((MP::AdoptIntent, P::Deny));
    error(
        &call(&mut h, revise("new-a", "change-a:origin", "new"), &mut g),
        "denied",
    );
    assert_eq!(h.last_work().cleanup.attempts, 0);
    assert_eq!(f.snapshot(), before);
    success(
        &call(
            &mut h,
            revise("new-a", "change-a:origin", "new"),
            &mut Guard::allow(),
        ),
        "intent_revised",
    );
    assert!(!f.member(1, "checkpoint.tmp").exists());
    // Revision does not own shared equal-remnant cleanup.
    assert!(f.path("creation.tmp").exists());
    drop(h);

    let f = Fixture::new();
    f.two();
    assert_eq!(
        f.child(
            "revise",
            Some(event(1, "reserve", "checkpoint.tmp", "renamed")),
            false
        )
        .code(),
        Some(71)
    );
    let path = f.member(1, "checkpoint.json");
    let installed = fs::read_to_string(&path).unwrap();
    assert_eq!(
        installed
            .matches("\"expected_intent\":\"change-a:origin\"")
            .count(),
        1
    );
    // Preserve canonical shape/field order while making the pending predecessor foreign.
    let impossible = installed.replace(
        "\"expected_intent\":\"change-a:origin\"",
        "\"expected_intent\":\"change-b:origin\"",
    );
    fs::write(&path, &impossible).unwrap();
    fs::write(f.member(1, "checkpoint.tmp"), &impossible).unwrap();
    let before = f.snapshot();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    for request in [
        context("change-a"),
        create("create-a", "Private original A"),
        revise("pending-a", "change-a:origin", "Private revision A"),
    ] {
        error(&call(&mut h, request, &mut Guard::allow()), "unavailable");
        assert_eq!(h.last_work().cleanup.attempts, 0);
        assert_eq!(h.last_work().retention.attempts, 0);
    }
    success(
        &call(&mut h, context("change-b"), &mut Guard::allow()),
        "change_context",
    );
    assert_eq!(f.snapshot(), before);
}

#[test]
fn member_anchor_and_unknown_namespace_refusal_keep_scope_and_evidence() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for anchor_missing in [false, true] {
        let f = Fixture::new();
        f.two();
        if anchor_missing {
            fs::remove_file(f.path("members/m-1.anchor.json")).unwrap();
        } else {
            fs::write(f.member(1, "unknown.json"), b"{}\n").unwrap();
        }
        let before = f.snapshot();
        let mut h = f.host(Mode::Reopen, None).unwrap();
        error(
            &call(&mut h, context("change-a"), &mut Guard::allow()),
            "unavailable",
        );
        assert_eq!(h.last_work().retention.attempts, 0);
        success(
            &call(&mut h, context("change-b"), &mut Guard::allow()),
            "change_context",
        );
        assert_eq!(f.snapshot(), before);
    }
    let f = Fixture::new();
    f.two();
    fs::write(f.path("unknown.json"), b"{}\n").unwrap();
    let before = f.snapshot();
    assert!(matches!(f.host(Mode::Reopen, None), Err(E::Unavailable)));
    assert_eq!(f.snapshot(), before);
}

#[test]
fn text_limit_equality_and_overflow_do_not_change_original_adoption() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let text = "x".repeat(65_536);
    let mut request = revise("max-text", "change-a:origin", &text);
    request["why"] = json!("y".repeat(65_536));
    let accepted = success(
        &call(&mut h, request.clone(), &mut Guard::allow()),
        "intent_revised",
    );
    assert_eq!(accepted["seq"], 2);
    let before = f.snapshot();
    let mut overflow = request.clone();
    overflow["key"] = json!("overflow-text");
    overflow["expected_intent"] = json!("change-a:op:2");
    overflow["what"] = json!("x".repeat(65_537));
    error(
        &call(&mut h, overflow, &mut Guard::allow()),
        "invalid_input",
    );
    assert_eq!(h.last_work().member_passes, 0);
    let retry = success(
        &call(&mut h, request, &mut Guard::allow()),
        "intent_revised",
    );
    assert_eq!(retry, accepted);
    assert_eq!(f.snapshot(), before);
}

#[test]
fn ledger_slot_equality_and_creation_retry_precede_capacity_and_member_create() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let original = create("create-a", "Private original A");
    let accepted = call(&mut h, original.clone(), &mut Guard::allow());
    for slot in 3..=16 {
        let req = create(&format!("create-{slot}"), "independent");
        let result = success(&call(&mut h, req, &mut Guard::allow()), "created");
        assert_eq!(
            result["change"],
            format!("change-{}", (b'a' + slot as u8 - 1) as char)
        );
    }
    let before = f.snapshot();
    error(
        &call(&mut h, create("seventeenth", "new"), &mut Guard::allow()),
        "unsupported",
    );
    let mut g = Guard::allow();
    g.member = Some((MP::Create, P::Deny));
    assert_eq!(call(&mut h, original.clone(), &mut g), accepted);
    let mut changed = original;
    changed["why"] = json!("");
    error(&call(&mut h, changed, &mut g), "conflict");
    assert_eq!(f.snapshot(), before);
}
