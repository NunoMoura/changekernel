#![cfg(target_os = "linux")]
#[path = "file_first_assessment/alloc.rs"]
mod allocation;
#[global_allocator]
static ALLOCATOR: allocation::AssessmentAllocator = allocation::AssessmentAllocator;
use changekernel::{
    AssessmentHost, AssessmentPolicy, IntentHost, OpeningError, OpeningGuard, OpeningHost,
    OpeningIoFault, OpeningIoHook, OpeningMode, OpeningPermission, OpeningSlot,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    },
};
static CUSTODY: Mutex<()> = Mutex::new(());
static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Guard {
    permission: OpeningPermission,
    final_permission: Option<OpeningPermission>,
    principal: &'static str,
    calls: usize,
}
impl Guard {
    fn allow() -> Self {
        Self {
            permission: OpeningPermission::Allow,
            final_permission: None,
            principal: "owner-1",
            calls: 0,
        }
    }
}
impl OpeningGuard for Guard {
    fn principal(&self) -> &str {
        self.principal
    }
    fn current_permission(&mut self) -> OpeningPermission {
        self.calls += 1;
        if self.calls > 1 {
            self.final_permission.unwrap_or(self.permission)
        } else {
            self.permission
        }
    }
}
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!(
            "ck-assessment-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&p).unwrap();
        Self(p)
    }
    fn slot(&self) -> OpeningSlot {
        OpeningSlot {
            directory: self.0.join("slot"),
            anchor: self.0.join("anchor.json"),
        }
    }
    fn path(&self, n: &str) -> PathBuf {
        self.0.join("slot").join(n)
    }
    fn bytes(&self, n: &str) -> Vec<u8> {
        fs::read(self.path(n)).unwrap()
    }
    fn host(
        &self,
        mode: OpeningMode,
        hook: Option<OpeningIoHook>,
    ) -> Result<AssessmentHost, OpeningError> {
        AssessmentHost::connect(
            self.slot(),
            mode,
            AssessmentPolicy::NoticeWhat80,
            &mut Guard::allow(),
            hook,
        )
    }
    fn start(&self, what: &str) -> AssessmentHost {
        let mut h = self.host(OpeningMode::FreshProvision, None).unwrap();
        let r = h.open_change(&open(what, None), &mut Guard::allow());
        assert_eq!(value(&r)["kind"], "opened");
        h
    }
    fn blocked(&self) {
        assert!(matches!(
            self.host(OpeningMode::Reopen, None),
            Err(OpeningError::Unavailable)
        ));
    }
    fn child(&self, action: &str) -> std::process::ExitStatus {
        Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "process_entry", "--nocapture"])
            .env("CK_ASSESSMENT_CHILD", &self.0)
            .env("CK_ASSESSMENT_ACTION", action)
            .status()
            .unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn value(b: &[u8]) -> serde_json::Value {
    serde_json::from_slice(b).unwrap()
}
fn reference(n: u64) -> String {
    if n == 1 {
        "change-1:origin".into()
    } else {
        format!("change-1:op:{n}")
    }
}
fn open(what: &str, why: Option<&str>) -> Vec<u8> {
    format!("{{\"v\":1,\"op\":\"open_change\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"open-1\",\"what\":{},\"why\":{}}}",serde_json::to_string(what).unwrap(),serde_json::to_string(&why).unwrap()).into_bytes()
}
fn revise(key: &str, expected: u64, what: &str, why: Option<&str>) -> Vec<u8> {
    format!("{{\"v\":3,\"op\":\"revise_intent\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"{key}\",\"expected_intent\":\"{}\",\"what\":{},\"why\":{}}}",reference(expected),serde_json::to_string(what).unwrap(),serde_json::to_string(&why).unwrap()).into_bytes()
}
fn assess(key: &str, expected: u64) -> Vec<u8> {
    assess_check(key, expected, "notice-what@1")
}
fn assess_check(key: &str, expected: u64, check: &str) -> Vec<u8> {
    format!("{{\"v\":3,\"op\":\"assess_intent\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"{key}\",\"expected_intent\":\"{}\",\"check\":\"{check}\"}}",reference(expected)).into_bytes()
}
fn inspect(op: &str, at: Option<u64>) -> Vec<u8> {
    format!("{{\"v\":3,\"op\":\"{op}\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"at\":{}}}",serde_json::to_string(&at.map(reference)).unwrap()).into_bytes()
}
fn error(b: Vec<u8>, e: OpeningError) {
    assert_eq!(b, e.json());
}
fn four(h: &mut AssessmentHost) -> Vec<Vec<u8>> {
    let a = h.assess_intent(&assess("assess-1", 1), &mut Guard::allow());
    assert_eq!(value(&a)["passed"], false);
    let r = h.revise_intent(
        &revise("rev-1", 1, "Trim local defaults", None),
        &mut Guard::allow(),
    );
    assert_eq!(value(&r)["previous_intent"], reference(1));
    error(
        h.inspect_assessment(&inspect("inspect_assessment", None), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    let b = h.assess_intent(&assess("assess-2", 3), &mut Guard::allow());
    assert_eq!(value(&b)["passed"], true);
    vec![a, r, b]
}
#[test]
fn exact_example_and_interleaving() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    let mut h = f.start(&"x".repeat(81));
    let results = four(&mut h);
    let trace = f.bytes("trace.jsonl");
    assert_eq!(
        trace
            .split_inclusive(|b| *b == b'\n')
            .map(|l| l.len())
            .collect::<Vec<_>>(),
        [488, 727, 548, 694]
    );
    assert_eq!(
        format!("{:x}", Sha256::digest(&trace)),
        "6dea1f4924958354357011cbc6e54749b2437866886f7ff528a742be97122e74"
    );
    let current = value(&h.inspect_intent(&inspect("inspect_intent", None), &mut Guard::allow()));
    assert_eq!(current["tip"], reference(4));
    assert_eq!(current["current_intent"], reference(3));
    assert_eq!(current["record"]["seq"], 3);
    let historical =
        value(&h.inspect_assessment(&inspect("inspect_assessment", Some(2)), &mut Guard::allow()));
    assert_eq!(historical["applicability"], "historical");
    assert_eq!(historical["record"]["result"], value(&results[0]));
    assert_eq!(historical["coverage"]["last"], 4);
    for (key, subject, text, why, expected) in [
        ("r2", 3, "é".repeat(40), Some(""), true),
        ("r3", 5, "é".repeat(41), Some("irrelevant"), false),
        ("r4", 7, "x".repeat(80), None, true),
    ] {
        let r = h.revise_intent(&revise(key, subject, &text, why), &mut Guard::allow());
        let n = value(&r)["seq"].as_u64().unwrap();
        error(
            h.inspect_assessment(&inspect("inspect_assessment", None), &mut Guard::allow()),
            OpeningError::Unavailable,
        );
        for suffix in ["a", "b"] {
            let a = value(
                &h.assess_intent(&assess(&format!("{key}-{suffix}"), n), &mut Guard::allow()),
            );
            assert_eq!(a["passed"], expected);
            assert_eq!(a["evidence"]["utf8_bytes"], text.len());
        }
        // Each revision follows two assessments, not its subject operation.
        if key == "r2" {
            assert_eq!(n, 5);
        }
        if key == "r3" {
            break;
        }
    }
    // Third actual revision after the second pair of runs.
    let r = h.revise_intent(&revise("r4", 8, "Cafe\u{301}", None), &mut Guard::allow());
    assert_eq!(value(&r)["seq"], 11);
    let a = value(&h.assess_intent(&assess("final", 11), &mut Guard::allow()));
    assert_eq!(a["evidence"]["utf8_bytes"], 6);
    for n in [1, 3, 5, 8, 11] {
        assert_eq!(
            value(&h.inspect_intent(&inspect("inspect_intent", Some(n)), &mut Guard::allow()))
                ["selected_intent"],
            reference(n)
        );
    }
    error(
        h.inspect_intent(&inspect("inspect_intent", Some(2)), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    error(
        h.inspect_assessment(&inspect("inspect_assessment", Some(3)), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    let null = value(&h.inspect_intent(&inspect("inspect_intent", Some(1)), &mut Guard::allow()));
    assert!(null["record"]["input"]["why"].is_null());
    let empty = value(&h.inspect_intent(&inspect("inspect_intent", Some(5)), &mut Guard::allow()));
    assert_eq!(empty["record"]["input"]["why"], "");
    let before = f.bytes("trace.jsonl");
    assert_eq!(
        h.assess_intent(&assess("assess-1", 1), &mut Guard::allow()),
        results[0]
    );
    assert_eq!(
        h.revise_intent(
            &revise("rev-1", 1, "Trim local defaults", None),
            &mut Guard::allow()
        ),
        results[1]
    );
    error(
        h.assess_intent(&assess("assess-1", 11), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    error(
        h.assess_intent(&assess("rev-1", 11), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    assert_eq!(f.bytes("trace.jsonl"), before);
}
#[test]
fn fresh_policy_profiles_decode_and_authority() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    assert!(matches!(
        AssessmentHost::connect(
            f.slot(),
            OpeningMode::FreshProvision,
            AssessmentPolicy::Unavailable,
            &mut Guard::allow(),
            None
        ),
        Err(OpeningError::Unavailable)
    ));
    assert!(!f.0.join("slot").exists());
    let mut h = f.start("x");
    let anchor = value(&fs::read(f.0.join("anchor.json")).unwrap());
    for (k, v) in [
        ("policy", "fixture-notice@1"),
        ("check", "notice-what@1"),
        ("evaluator", "utf8-length@1"),
        ("adopter", "owner-1"),
    ] {
        assert_eq!(anchor[k], v);
    }
    let req = String::from_utf8(assess("a", 1)).unwrap();
    for forged in [
        req.replace("\"check\":", "\"actor\":\"owner-1\",\"check\":"),
        req.replace("\"check\":", "\"passed\":false,\"check\":"),
        req.replace("\"check\":", "\"evaluator\":\"utf8-length@1\",\"check\":"),
        req.replace("\"check\":\"notice-what@1\"", "\"check\":null"),
        req.replace("\"key\":\"a\"", "\"key\":null,\"key\":\"a\""),
        req.replace("\"v\":3", "\"v\":2"),
        format!("{req} []"),
        "[]".into(),
    ] {
        let mut deny = Guard::allow();
        deny.permission = OpeningPermission::Deny;
        error(
            h.assess_intent(forged.as_bytes(), &mut deny),
            OpeningError::InvalidInput,
        );
        assert_eq!(deny.calls, 0);
    }
    for old in [
        String::from_utf8(revise("r", 1, "x", None))
            .unwrap()
            .replace("\"v\":3", "\"v\":2"),
        String::from_utf8(inspect("inspect_intent", None))
            .unwrap()
            .replace("\"v\":3", "\"v\":2"),
    ] {
        error(
            h.assess_intent(old.as_bytes(), &mut Guard::allow()),
            OpeningError::Unsupported,
        );
    }
    error(
        h.revise_intent(req.as_bytes(), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    for (permission, e) in [
        (OpeningPermission::Deny, OpeningError::Denied),
        (OpeningPermission::Unavailable, OpeningError::Unavailable),
    ] {
        let mut g = Guard::allow();
        g.permission = permission;
        error(h.assess_intent(req.as_bytes(), &mut g), e);
    }
    let mut g = Guard::allow();
    g.principal = "other";
    error(
        h.assess_intent(req.as_bytes(), &mut g),
        OpeningError::Denied,
    );
    error(
        h.assess_intent(
            req.replace("change-1:origin", "change-2:origin").as_bytes(),
            &mut Guard::allow(),
        ),
        OpeningError::Denied,
    );
    error(
        h.assess_intent(
            req.replace("change-1:origin", "change-1:op:01").as_bytes(),
            &mut Guard::allow(),
        ),
        OpeningError::InvalidInput,
    );
    error(
        h.assess_intent(&assess_check("a", 2, "other@1"), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    error(
        h.assess_intent(&assess_check("a", 1, "other@1"), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    let mut g = Guard::allow();
    g.final_permission = Some(OpeningPermission::Deny);
    error(
        h.assess_intent(req.as_bytes(), &mut g),
        OpeningError::Denied,
    );
    assert_eq!(h.work().codecs.discarded_replies, 1);
    let retained = h.assess_intent(req.as_bytes(), &mut Guard::allow());
    assert_eq!(value(&retained)["passed"], true);
    assert_eq!(value(&f.bytes("checkpoint.json"))["generation"], 2);
    drop(h);
    assert!(matches!(
        IntentHost::connect(f.slot(), OpeningMode::Reopen, &mut Guard::allow(), None),
        Err(OpeningError::Unavailable)
    ));
    assert!(matches!(
        OpeningHost::connect(f.slot(), OpeningMode::Reopen, &mut Guard::allow(), None),
        Err(OpeningError::Unavailable)
    ));
    let old = Fixture::new();
    let h = IntentHost::connect(
        old.slot(),
        OpeningMode::FreshProvision,
        &mut Guard::allow(),
        None,
    )
    .unwrap();
    drop(h);
    old.blocked();
}
#[test]
fn process_entry() {
    let Some(root) = std::env::var_os("CK_ASSESSMENT_CHILD") else {
        return;
    };
    let _gate = CUSTODY.lock().unwrap();
    let root = PathBuf::from(root);
    let slot = OpeningSlot {
        directory: root.join("slot"),
        anchor: root.join("anchor.json"),
    };
    let action = std::env::var("CK_ASSESSMENT_ACTION").unwrap();
    if action == "four" {
        let mut h = AssessmentHost::connect(
            slot,
            OpeningMode::FreshProvision,
            AssessmentPolicy::NoticeWhat80,
            &mut Guard::allow(),
            None,
        )
        .unwrap();
        assert_eq!(
            value(&h.open_change(&open(&"x".repeat(81), None), &mut Guard::allow()))["kind"],
            "opened"
        );
        four(&mut h);
        return;
    }
    let marker = root.join("hook-hit");
    let selected = action.clone();
    let hook: OpeningIoHook = Box::new(move |e| {
        let cut = match selected.as_str() {
            "reservation-temp" => {
                e.phase == "reserve" && e.object == "checkpoint.tmp" && e.step == "before_rename"
            }
            "reserve" => {
                e.phase == "reserve" && e.object == "checkpoint.tmp" && e.step == "renamed"
            }
            "half" => e.phase == "append" && e.object == "trace.jsonl" && e.step == "short_written",
            "full" => e.phase == "append" && e.object == "trace.jsonl" && e.step == "written",
            "successor" => {
                e.phase == "checkpoint" && e.object == "checkpoint.tmp" && e.step == "before_rename"
            }
            "lost" => e.phase == "deliver" && e.object == "reply" && e.step == "before",
            _ => false,
        };
        if cut {
            fs::write(&marker, format!("{}:{}:{}", e.phase, e.object, e.step)).unwrap();
            std::process::exit(77);
        }
        if selected == "half"
            && e.phase == "append"
            && e.object == "trace.jsonl"
            && e.step == "before_write"
        {
            OpeningIoFault::ShortWrite
        } else {
            OpeningIoFault::Continue
        }
    });
    let mut h = AssessmentHost::connect(
        slot,
        OpeningMode::Reopen,
        AssessmentPolicy::NoticeWhat80,
        &mut Guard::allow(),
        Some(hook),
    )
    .unwrap();
    let reply = h.assess_intent(&assess("pending", 3), &mut Guard::allow());
    panic!(
        "selected cut not reached: {}",
        String::from_utf8_lossy(&reply)
    );
}
#[test]
fn confirmed_process_exit_exact_retry_and_suffix_recovery() {
    let _gate = CUSTODY.lock().unwrap();
    for cut in ["reserve", "half", "full", "successor", "lost"] {
        let f = Fixture::new();
        assert!(f.child("four").success()); // No local owning host during spawn.
        let before = f.bytes("trace.jsonl");
        let original = before.split_inclusive(|b| *b == b'\n').nth(1).unwrap();
        let original_result = value(original)["result"].clone();
        assert_eq!(f.child(cut).code(), Some(77));
        assert!(f.0.join("hook-hit").is_file());
        let interrupted = f.bytes("trace.jsonl");
        assert!(interrupted.starts_with(&before));
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        let retry = h.assess_intent(&assess("assess-1", 1), &mut Guard::allow());
        assert_eq!(value(&retry), original_result);
        assert_eq!(
            value(&h.open_change(&open(&"x".repeat(81), None), &mut Guard::allow()))["seq"],
            1
        );
        assert_eq!(
            value(&h.revise_intent(
                &revise("rev-1", 1, "Trim local defaults", None),
                &mut Guard::allow()
            ))["seq"],
            3
        );
        assert_eq!(f.bytes("trace.jsonl"), interrupted); // Reads/retries do not finish pending.
        if cut != "lost" {
            error(
                h.assess_intent(&assess("other", 3), &mut Guard::allow()),
                OpeningError::Unavailable,
            );
            error(
                h.assess_intent(&assess_check("pending", 3, "other@1"), &mut Guard::allow()),
                OpeningError::Conflict,
            );
            assert_eq!(f.bytes("trace.jsonl"), interrupted);
        }
        let result = h.assess_intent(&assess("pending", 3), &mut Guard::allow());
        assert_eq!(value(&result)["seq"], 5);
        assert_eq!(value(&result)["intent"], reference(3));
        assert_eq!(value(&f.bytes("checkpoint.json"))["generation"], 5);
        assert_eq!(f.bytes("trace.jsonl").split(|b| *b == b'\n').count(), 6);
        assert!(f.bytes("trace.jsonl").starts_with(&before));
        let accepted = f.bytes("trace.jsonl");
        assert_eq!(
            h.assess_intent(&assess("pending", 3), &mut Guard::allow()),
            result
        );
        assert_eq!(f.bytes("trace.jsonl"), accepted);
    }
}
fn replace(f: &Fixture, name: &str, from: &str, to: &str) {
    let s = String::from_utf8(f.bytes(name)).unwrap();
    assert!(s.contains(from), "missing replacement {from}");
    fs::write(f.path(name), s.replace(from, to)).unwrap();
}
#[test]
fn consumer_damage_pending_and_temporaries() {
    let _gate = CUSTODY.lock().unwrap();
    for damage in [
        "count",
        "boolean",
        "subject",
        "key",
        "digest",
        "definition",
        "missing-middle",
        "noncanonical",
    ] {
        let f = Fixture::new();
        let mut h = f.start(&"x".repeat(81));
        four(&mut h);
        drop(h);
        let before = f.bytes("trace.jsonl");
        match damage {
            "count" => replace(&f, "trace.jsonl", "\"utf8_bytes\":81", "\"utf8_bytes\":80"),
            "boolean" => replace(&f, "trace.jsonl", "\"passed\":false", "\"passed\":true"),
            "subject" => replace(
                &f,
                "trace.jsonl",
                "\"intent\":\"change-1:origin\"",
                "\"intent\":\"change-1:op:2\"",
            ),
            "key" => replace(&f, "trace.jsonl", "assess-2", "assess-1"),
            "definition" => replace(&f, "trace.jsonl", "utf8-length@1", "utf8-length@2"),
            "digest" => replace(
                &f,
                "checkpoint.json",
                "6dea1f4924958354357011cbc6e54749b2437866886f7ff528a742be97122e74",
                &"0".repeat(64),
            ),
            "missing-middle" => {
                let bytes = before
                    .split_inclusive(|b| *b == b'\n')
                    .enumerate()
                    .filter(|(n, _)| *n != 2)
                    .flat_map(|(_, b)| b.to_vec())
                    .collect::<Vec<_>>();
                fs::write(f.path("trace.jsonl"), bytes).unwrap();
            }
            "noncanonical" => replace(&f, "trace.jsonl", "\"passed\":false", "\"passed\": false"),
            _ => unreachable!(),
        }
        // For semantic/canonical challenges, adjust the negative checkpoint only
        // so the validator reaches the altered record rather than stopping at hash.
        if !matches!(damage, "digest" | "missing-middle") {
            let bytes = f.bytes("trace.jsonl");
            replace(
                &f,
                "checkpoint.json",
                &format!("\"end\":{}", before.len()),
                &format!("\"end\":{}", bytes.len()),
            );
            replace(
                &f,
                "checkpoint.json",
                "6dea1f4924958354357011cbc6e54749b2437866886f7ff528a742be97122e74",
                &format!("{:x}", Sha256::digest(&bytes)),
            );
        }
        let trace = f.bytes("trace.jsonl");
        let checkpoint = f.bytes("checkpoint.json");
        f.blocked();
        assert_eq!(f.bytes("trace.jsonl"), trace);
        assert_eq!(f.bytes("checkpoint.json"), checkpoint);
    }
    for invalid in ["subject", "actor", "check", "key", "count"] {
        let f = Fixture::new();
        assert!(f.child("four").success());
        assert_eq!(f.child("reserve").code(), Some(77));
        match invalid {
            "subject" => replace(
                &f,
                "checkpoint.json",
                "\"expected_intent\":\"change-1:op:3\"",
                "\"expected_intent\":\"change-1:op:4\"",
            ),
            "actor" => replace(
                &f,
                "checkpoint.json",
                "\"actor\":\"owner-1\"",
                "\"actor\":\"other-1\"",
            ),
            "check" => replace(&f, "checkpoint.json", "notice-what@1", "other@1"),
            "key" => replace(
                &f,
                "checkpoint.json",
                "\"key\":\"pending\"",
                "\"key\":\"assess-1\"",
            ),
            "count" => replace(
                &f,
                "checkpoint.json",
                "\"generation\":4",
                "\"generation\":128",
            ),
            _ => unreachable!(),
        }
        fs::write(f.path("checkpoint.tmp"), f.bytes("checkpoint.json")).unwrap();
        let evidence = f.bytes("checkpoint.tmp");
        f.blocked();
        assert_eq!(f.bytes("checkpoint.tmp"), evidence);
    }
    for relationship in [
        "equal",
        "reservation",
        "successor",
        "partial",
        "backward",
        "unrelated",
    ] {
        let f = Fixture::new();
        assert!(f.child("four").success());
        if matches!(relationship, "successor" | "partial") {
            assert_eq!(f.child("successor").code(), Some(77));
            if relationship == "partial" {
                let mut bytes = f.bytes("checkpoint.tmp");
                bytes.truncate(bytes.len() / 2);
                fs::write(f.path("checkpoint.tmp"), bytes).unwrap();
            }
        } else if relationship == "reservation" {
            assert_eq!(f.child("reservation-temp").code(), Some(77));
        } else {
            let mut bytes = f.bytes("checkpoint.json");
            if relationship == "backward" {
                bytes = String::from_utf8(bytes)
                    .unwrap()
                    .replace("\"generation\":4", "\"generation\":3")
                    .into_bytes();
            }
            if relationship == "unrelated" {
                bytes = String::from_utf8(bytes)
                    .unwrap()
                    .replace("custody-1", "custody-2")
                    .into_bytes();
            }
            fs::write(f.path("checkpoint.tmp"), bytes).unwrap();
        }
        let before = f.bytes("trace.jsonl");
        if matches!(relationship, "partial" | "backward" | "unrelated") {
            let remnant = f.bytes("checkpoint.tmp");
            f.blocked();
            assert_eq!(f.bytes("checkpoint.tmp"), remnant);
        } else {
            let mut h = f.host(OpeningMode::Reopen, None).unwrap();
            assert!(!f.path("checkpoint.tmp").exists());
            assert_eq!(f.bytes("trace.jsonl"), before);
            let result = h.assess_intent(&assess("pending", 3), &mut Guard::allow());
            assert_eq!(value(&result)["seq"], 5);
        }
    }
}
#[test]
fn unexplained_suffix_and_observed_incident_latch() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    let mut h = f.start("x");
    let before = f.bytes("trace.jsonl");
    use std::io::Write;
    fs::OpenOptions::new()
        .append(true)
        .open(f.path("trace.jsonl"))
        .unwrap()
        .write_all(b"unexplained")
        .unwrap();
    let response = value(&h.inspect_intent(&inspect("inspect_intent", None), &mut Guard::allow()));
    assert_eq!(response["progress"], "blocked_unaccepted_tail");
    error(
        h.assess_intent(&assess("a", 1), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert!(f.bytes("trace.jsonl").starts_with(&before));
    drop(h);
    let f = Fixture::new();
    let h = f.start("x");
    drop(h);
    let hit = std::sync::Arc::new(AtomicUsize::new(0));
    let selected = hit.clone();
    let hook: OpeningIoHook = Box::new(move |e| {
        if e.phase == "append" && e.object == "trace.jsonl" && e.step == "before_write" {
            selected.fetch_add(1, Ordering::SeqCst);
            OpeningIoFault::ShortWrite
        } else {
            OpeningIoFault::Continue
        }
    });
    let mut h = f.host(OpeningMode::Reopen, Some(hook)).unwrap();
    error(
        h.assess_intent(&assess("a", 1), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert_eq!(hit.load(Ordering::SeqCst), 1);
    assert_eq!(value(&f.bytes("incident.json"))["issue"], "short_write");
    assert_eq!(h.work().retention_attempts, 1);
    let bytes = f.bytes("trace.jsonl");
    error(
        h.inspect_intent(&inspect("inspect_intent", None), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert_eq!(h.work().codecs.passes, 0);
    assert_eq!(f.bytes("trace.jsonl"), bytes);
    drop(h);
    f.blocked();
    let f = Fixture::new();
    let h = f.start("x");
    drop(h);
    fs::write(f.path("incident.tmp"), f.bytes("incident.json")).unwrap();
    f.blocked();
    assert!(f.path("incident.tmp").is_file());
}
fn history(h: &mut AssessmentHost, n: u64) -> u64 {
    let mut current = 1;
    for seq in 2..=n {
        let key = format!("{seq:064}");
        if seq % 4 == 0 {
            let r = h.revise_intent(
                &revise(&key, current, if seq % 8 == 0 { "x" } else { "é" }, None),
                &mut Guard::allow(),
            );
            assert_eq!(value(&r)["seq"], seq);
            current = seq;
        } else {
            let a = h.assess_intent(&assess(&key, current), &mut Guard::allow());
            assert_eq!(value(&a)["seq"], seq);
        }
    }
    current
}
fn budget(w: changekernel::AssessmentWork) {
    let c = w.codecs;
    let p = c.passes;
    let n = w.max_pass_count;
    assert!(p <= 4 && n <= 128);
    assert!(c.record_decode_attempts <= p * n);
    assert!(c.trace_read_bytes <= p * 17_825_792);
    assert!(c.accepted_hash_bytes <= p * 16_777_216);
    assert!(c.successor_hash_bytes <= 2 * 1_048_576);
    assert!(c.control_decode_attempts <= 4 * p + 2);
    let r = &w.comparisons;
    assert!(r.record_canonical.attempts <= p * n);
    assert!(r.record_semantic.attempts <= p * n);
    assert!(r.key_uniqueness.attempts <= p * n * n.saturating_sub(1) / 2);
    assert!(r.key_lookup.attempts <= p * n);
    assert!(r.key_feasibility.attempts <= (p + 2) * n + 1);
    assert!(r.control_typed.attempts <= 6 * p + 2);
    assert!(r.original_input.attempts <= 3);
    assert!(r.control_canonical.attempts <= 4 * p + 2);
    assert!(r.record_canonical.operand_bytes <= p * 17_825_792);
    assert!(r.control_canonical.operand_bytes <= (4 * p + 2) * 1_048_576);
    assert!(r.record_semantic.operand_bytes <= 2 * 1_048_576 * p * n);
    assert!(r.record_semantic.schema_words <= 64 * p * n);
    assert!(r.original_input.operand_bytes <= 3 * 1_048_576);
    assert!(r.original_input.schema_words <= 3 * 16);
    assert!(r.control_typed.operand_bytes <= 2 * 1_048_576 * (6 * p + 2));
    assert!(r.control_typed.schema_words <= 64 * (6 * p + 2));
    assert!(r.key_uniqueness.operand_bytes <= 64 * p * n * n.saturating_sub(1) / 2);
    assert!(r.key_lookup.operand_bytes <= 64 * p * n);
    assert!(r.key_feasibility.operand_bytes <= 64 * ((p + 2) * n + 1));
    assert!(
        r.suffix_prefix.operand_bytes + r.suffix_complete.operand_bytes + r.candidate.operand_bytes
            <= (p + 4) * 1_048_576
    );
    assert!(r.suffix_prefix.attempts <= p + 2);
    assert!(r.candidate.attempts <= 1);
    assert!(r.suffix_complete.attempts <= 1);
    let d = 1 + p * n + 4 * p + 2;
    let k = p * n + 2 * p + 4;
    let s = 41 * p * n + 20 * (4 * p + 2) + 11;
    let b = 128 * (d + k) + 256 * (p + 1);
    assert!(r.member_selector.attempts <= s);
    assert!(r.member_selector.operand_bytes <= 17 * 1_048_576 * d + 512 * s);
    assert!(r.field_groups.attempts <= b);
    assert!(r.field_groups.operand_bytes <= 8192 * b);
    assert!(w.trace_buffer_capacity_peak <= 2 * (17_825_792 + 1));
    assert!(w.key_vectors_peak <= 1);
    assert!(w.key_payload_capacity_peak <= 8192);
    assert!(w.key_vector_metadata_peak <= 128 * std::mem::size_of::<String>() as u64);
    for comparison in [
        r.record_canonical,
        r.control_canonical,
        r.record_semantic,
        r.original_input,
        r.key_uniqueness,
        r.key_lookup,
        r.key_feasibility,
        r.control_typed,
        r.suffix_prefix,
        r.suffix_complete,
        r.candidate,
        r.member_selector,
        r.field_groups,
        r.initial_raw,
        r.supplied_path,
    ] {
        assert!(comparison.attempts >= comparison.completions);
        assert_eq!(
            comparison.matches + comparison.no_matches,
            comparison.completions
        );
        assert_eq!(
            comparison.accounting_updates,
            6 * comparison.completions + 4 * (comparison.attempts - comparison.completions)
        );
        assert!(comparison.accounting_updates <= 6 * comparison.attempts);
    }
}
#[test]
fn count_equality_overflow_and_whole_call_work() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    let mut h = f.start("x");
    let current = history(&mut h, 127);
    assert_eq!(current, 124);
    let result = h.assess_intent(&assess("limit", current), &mut Guard::allow());
    assert_eq!(value(&result)["seq"], 128);
    let mutation = h.work();
    budget(mutation);
    assert_eq!(mutation.codecs.passes, 3);
    assert_eq!(mutation.max_pass_count, 128);
    assert_eq!(mutation.comparisons.key_uniqueness.attempts, 24_257);
    assert_eq!(mutation.comparisons.record_semantic.attempts, 383);
    h.inspect_intent(&inspect("inspect_intent", None), &mut Guard::allow());
    let query = h.work();
    budget(query);
    assert_eq!(query.comparisons.key_uniqueness.attempts, 16_256);
    assert_eq!(query.comparisons.key_lookup.attempts, 256);
    assert_eq!(query.comparisons.key_lookup.operand_bytes, 0);
    assert_eq!(query.comparisons.original_input.attempts, 0);
    assert_eq!(
        h.assess_intent(&assess("limit", current), &mut Guard::allow()),
        result
    );
    let retry = h.work();
    budget(retry);
    assert_eq!(retry.comparisons.original_input.attempts, 1);
    let before = f.bytes("checkpoint.json");
    error(
        h.assess_intent(&assess("overflow", current), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    budget(h.work());
    assert_eq!(f.bytes("checkpoint.json"), before);
    println!("R25 count-127 mutation {mutation:?}\nR25 count-128 query {query:?}\nR25 count-128 retry {retry:?}");
    drop(h);
    let input = String::from_utf8(assess("impossible", current)).unwrap();
    replace(
        &f,
        "checkpoint.json",
        "\"pending\":null",
        &format!("\"pending\":{{\"input\":{input},\"actor\":\"owner-1\"}}"),
    );
    let checkpoint = f.bytes("checkpoint.json");
    fs::write(f.path("checkpoint.tmp"), &checkpoint).unwrap();
    f.blocked();
    assert_eq!(f.bytes("checkpoint.tmp"), checkpoint);
}
const CAP: usize = 16_777_216;
fn predicted_revision(
    last: &serde_json::Value,
    n: u64,
    current: u64,
    key: &str,
    what: &str,
    why: &str,
) -> usize {
    let mut r = last.clone();
    r["seq"] = n.into();
    r["prev"] = reference(n - 1).into();
    r["input"] = value(&revise(key, current, what, Some(why)));
    r["result"]["key"] = key.into();
    r["result"]["result"] = reference(n).into();
    r["result"]["seq"] = n.into();
    r["result"]["intent"] = reference(n).into();
    r["result"]["previous_intent"] = reference(current).into();
    serde_json::to_vec(&r).unwrap().len() + 1
}
fn predicted_assessment(
    last: &serde_json::Value,
    n: u64,
    current: u64,
    key: &str,
    what: &str,
) -> usize {
    let mut r = last.clone();
    r["seq"] = n.into();
    r["prev"] = reference(n - 1).into();
    r["input"] = value(&assess(key, current));
    r["result"]["key"] = key.into();
    r["result"]["result"] = reference(n).into();
    r["result"]["seq"] = n.into();
    r["result"]["intent"] = reference(current).into();
    r["result"]["passed"] = (what.len() <= 80).into();
    r["result"]["feedback"] = if what.len() <= 80 {
        "fits"
    } else {
        "shorten_or_use_other_channel"
    }
    .into();
    r["result"]["evidence"]["intent"] = reference(current).into();
    r["result"]["evidence"]["utf8_bytes"] = what.len().into();
    serde_json::to_vec(&r).unwrap().len() + 1
}
#[test]
fn byte_equality_overflow_and_scoped_allocation_requests() {
    let _gate = CUSTODY.lock().unwrap();
    for extra in [0, 1] {
        let f = Fixture::new();
        let mut h = f.start("x");
        let a = h.assess_intent(&assess("sample", 1), &mut Guard::allow());
        assert_eq!(value(&a)["seq"], 2);
        let assessment = value(
            f.bytes("trace.jsonl")
                .split_inclusive(|b| *b == b'\n')
                .nth(1)
                .unwrap(),
        );
        let r = h.revise_intent(&revise("r00003", 1, "x", Some("")), &mut Guard::allow());
        assert_eq!(value(&r)["seq"], 3);
        let template = value(
            f.bytes("trace.jsonl")
                .split_inclusive(|b| *b == b'\n')
                .nth(2)
                .unwrap(),
        );
        let big = "\u{1}".repeat(65_536);
        let mut current = 3;
        let mut seq = 4;
        loop {
            let e = f.bytes("trace.jsonl").len();
            let key = format!("r{seq:05}");
            let l = predicted_revision(&template, seq, current, &key, &big, &big);
            if CAP - e < l + 2000 {
                break;
            }
            let result = h.revise_intent(
                &revise(&key, current, &big, Some(&big)),
                &mut Guard::allow(),
            );
            assert_eq!(value(&result)["seq"], seq);
            assert_eq!(f.bytes("trace.jsonl").len(), e + l);
            current = seq;
            seq += 1;
        }
        let e = f.bytes("trace.jsonl").len();
        let what = "Trim local defaults";
        let al = predicted_assessment(&assessment, seq + 1, seq, "finish", what);
        let key = format!("r{seq:05}");
        let base = predicted_revision(&template, seq, current, &key, what, "");
        let padding = CAP + extra - e - al - base;
        let why = format!("{}{}", "\u{1}".repeat(padding / 6), "z".repeat(padding % 6));
        assert!(why.len() <= 65_536);
        let result = h.revise_intent(
            &revise(&key, current, what, Some(&why)),
            &mut Guard::allow(),
        );
        assert_eq!(value(&result)["seq"], seq);
        assert_eq!(f.bytes("trace.jsonl").len() + al, CAP + extra);
        let before = f.bytes("checkpoint.json");
        let input = assess("finish", seq);
        allocation::begin();
        let result = h.assess_intent(&input, &mut Guard::allow());
        let peak = allocation::finish();
        let w = h.work();
        budget(w);
        assert!(peak <= input.len() + 53_477_056);
        if extra == 0 {
            assert_eq!(value(&result)["seq"], seq + 1);
            assert_eq!(f.bytes("trace.jsonl").len(), CAP);
        } else {
            error(result, OpeningError::Unsupported);
            assert_eq!(f.bytes("checkpoint.json"), before);
        }
        let input = inspect("inspect_intent", None);
        allocation::begin();
        let query = h.inspect_intent(&input, &mut Guard::allow());
        let query_peak = allocation::finish();
        assert_eq!(value(&query)["current_intent"], reference(seq));
        budget(h.work());
        assert!(query_peak <= input.len() + 53_477_056);
        println!("R25 byte boundary extra={extra} accepted={} candidate={al} operation_peak={peak} query_peak={query_peak} trace_capacity_peak={} work={w:?}",f.bytes("trace.jsonl").len(),w.trace_buffer_capacity_peak);
        drop(h);
        if extra == 1 {
            // Negative installed reservation at CAP+1: a matching physical
            // suffix or identical temporary cannot make it feasible.
            let input = String::from_utf8(assess("finish", seq)).unwrap();
            replace(
                &f,
                "checkpoint.json",
                r#""pending":null"#,
                &format!(r#""pending":{{"input":{input},"actor":"owner-1"}}"#),
            );
            let checkpoint = f.bytes("checkpoint.json");
            let accepted = f.bytes("trace.jsonl");
            let sample = accepted.split_inclusive(|b| *b == b'\n').nth(1).unwrap();
            let candidate = String::from_utf8(sample.to_vec())
                .unwrap()
                .replace(r#""key":"sample""#, r#""key":"finish""#)
                .replace("change-1:op:2", &reference(seq + 1))
                .replace("change-1:origin", &reference(seq))
                .replace(r#""seq":2"#, &format!(r#""seq":{}"#, seq + 1))
                .replace(r#""utf8_bytes":1"#, r#""utf8_bytes":19"#);
            assert_eq!(candidate.len(), al);
            for suffix in [
                &candidate.as_bytes()[..0],
                &candidate.as_bytes()[..al / 2],
                candidate.as_bytes(),
            ] {
                let mut physical = accepted.clone();
                physical.extend_from_slice(suffix);
                fs::write(f.path("trace.jsonl"), &physical).unwrap();
                fs::write(f.path("checkpoint.tmp"), &checkpoint).unwrap();
                f.blocked();
                assert_eq!(f.bytes("checkpoint.tmp"), checkpoint);
                assert_eq!(f.bytes("trace.jsonl"), physical);
            }
        }
    }
}
#[test]
fn cleanup_maximum_whole_call_and_connection_refusal_work() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    let mut h = f.start("x");
    let current = history(&mut h, 127);
    drop(h);
    // Admission writes a producer-built reservation temporary, then refuses
    // its rename without changing installed incident or checkpoint. The selected hook is
    // independently witnessed; local owner is dropped before reopening.
    let hit = std::sync::Arc::new(AtomicUsize::new(0));
    let selected = hit.clone();
    let retention = std::sync::Arc::new(AtomicUsize::new(0));
    let retained_hook = retention.clone();
    let hook: OpeningIoHook = Box::new(move |e| {
        if e.phase == "reserve" && e.object == "checkpoint.tmp" && e.step == "before_rename" {
            selected.fetch_add(1, Ordering::SeqCst);
            OpeningIoFault::Io
        } else if e.object == "incident.tmp" && e.step == "before_write" {
            retained_hook.fetch_add(1, Ordering::SeqCst);
            OpeningIoFault::Io
        } else {
            OpeningIoFault::Continue
        }
    });
    let mut h = f.host(OpeningMode::Reopen, Some(hook)).unwrap();
    let input = assess("pending-max", current);
    error(
        h.assess_intent(&input, &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert_eq!(hit.load(Ordering::SeqCst), 1);
    assert_eq!(retention.load(Ordering::SeqCst), 1);
    assert_eq!(value(&f.bytes("incident.json"))["state"], "clear");
    assert!(value(&f.bytes("checkpoint.json"))["pending"].is_null());
    drop(h);
    // Remove only a proven selected-failure temporary: incident.tmp may remain
    // from the deliberately refused retention write, and is itself dangerous.
    assert!(f.path("incident.tmp").is_file());
    let retained = f.bytes("incident.tmp");
    assert!(retained.is_empty());
    fs::remove_file(f.path("incident.tmp")).unwrap();
    // Restore the proven producer reservation only after connection; the idle
    // fixture owner is local, not forked or active during this setup write.
    let checkpoint = f.bytes("checkpoint.tmp");
    let temp = f.path("checkpoint.tmp");
    fs::remove_file(&temp).unwrap();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    fs::write(&temp, &checkpoint).unwrap();
    allocation::begin();
    let result = h.assess_intent(&input, &mut Guard::allow());
    let peak = allocation::finish();
    assert_eq!(value(&result)["seq"], 128);
    let w = h.work();
    budget(w);
    assert_eq!(w.codecs.passes, 4);
    assert_eq!(w.comparisons.key_uniqueness.attempts, 32_258);
    assert_eq!(w.comparisons.record_semantic.attempts, 510);
    assert_eq!(w.cleanups, 1);
    assert!(peak <= input.len() + 53_477_056);
    println!("R25 max-cleanup peak={peak} work={w:?}");
    drop(h);
    // Unknown inventory is retained. Connection metrics survive returned error.
    fs::write(f.path("unexpected"), b"evidence").unwrap();
    let (result, work) = AssessmentHost::connect_observed(
        f.slot(),
        OpeningMode::Reopen,
        AssessmentPolicy::NoticeWhat80,
        &mut Guard::allow(),
        None,
    );
    assert!(matches!(result, Err(OpeningError::Unavailable)));
    assert_eq!(work.retention_attempts, 0);
    assert!(work.codecs.control_read_bytes > 0);
    assert!(work.comparisons.field_groups.no_matches > 0);
    assert_eq!(value(&f.bytes("incident.json"))["state"], "clear");
    assert_eq!(fs::read(f.path("unexpected")).unwrap(), b"evidence");
    println!("R25 refused-connection work={work:?}");
}
#[test]
fn pinned_custody_adoption_and_failed_overlapping_read() {
    let _gate = CUSTODY.lock().unwrap();
    for damage in [
        "policy",
        "adopter",
        "inode",
        "tag",
        "symlink",
        "unknown",
        "anchor-temp",
    ] {
        let f = Fixture::new();
        let h = f.start("x");
        drop(h);
        match damage {
            "policy" | "adopter" | "tag" => {
                let path = f.0.join("anchor.json");
                let s = String::from_utf8(fs::read(&path).unwrap()).unwrap();
                let (from, to) = match damage {
                    "policy" => ("fixture-notice@1", "fixture-notice@2"),
                    "adopter" => ("owner-1", "owner-2"),
                    _ => ("ck-assessment-anchor@3", "ck-intent-anchor@2"),
                };
                fs::write(path, s.replace(from, to)).unwrap();
            }
            "inode" => {
                let saved = f.path("saved-trace");
                fs::rename(f.path("writer.lock"), &saved).unwrap();
                fs::write(f.path("writer.lock"), b"").unwrap();
                fs::remove_file(saved).unwrap();
            }
            "symlink" => {
                let bytes = f.bytes("checkpoint.json");
                let external = f.0.join("external");
                fs::write(&external, bytes).unwrap();
                fs::remove_file(f.path("checkpoint.json")).unwrap();
                std::os::unix::fs::symlink(external, f.path("checkpoint.json")).unwrap();
            }
            "unknown" => fs::write(f.path("unknown"), b"retain").unwrap(),
            "anchor-temp" => {
                let bytes = fs::read(f.0.join("anchor.json")).unwrap();
                fs::write(
                    f.0.join("anchor.tmp"),
                    String::from_utf8(bytes)
                        .unwrap()
                        .replace("fixture-notice@1", "fixture-notice@2"),
                )
                .unwrap();
            }
            _ => unreachable!(),
        }
        let before = f.bytes("trace.jsonl");
        f.blocked();
        assert_eq!(f.bytes("trace.jsonl"), before);
    }
    let f = Fixture::new();
    let h = f.start("x");
    drop(h);
    let armed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let active = armed.clone();
    let reads = std::sync::Arc::new(AtomicUsize::new(0));
    let reached = reads.clone();
    let retention = std::sync::Arc::new(AtomicUsize::new(0));
    let retained = retention.clone();
    let hook: OpeningIoHook = Box::new(move |e| {
        if active.load(Ordering::SeqCst) && e.object == "trace.jsonl" && e.step == "read" {
            let n = reached.fetch_add(1, Ordering::SeqCst);
            assert_eq!(e.phase, if n == 0 { "recover" } else { "deliver" });
            if n == 1 {
                return OpeningIoFault::Io;
            }
        }
        if active.load(Ordering::SeqCst) && e.object == "incident.tmp" && e.step == "before_write" {
            assert_eq!(e.phase, "deliver");
            retained.fetch_add(1, Ordering::SeqCst);
        }
        OpeningIoFault::Continue
    });
    // Successful prerequisite connection is distinct from the armed API cut.
    let mut h = f.host(OpeningMode::Reopen, Some(hook)).unwrap();
    assert_eq!(reads.load(Ordering::SeqCst), 0);
    assert_eq!(retention.load(Ordering::SeqCst), 0);
    armed.store(true, Ordering::SeqCst);
    let len = f.bytes("trace.jsonl").len();
    let input = inspect("inspect_intent", None);
    allocation::begin();
    let result = h.inspect_intent(&input, &mut Guard::allow());
    let peak = allocation::finish();
    error(result, OpeningError::Unavailable);
    let w = h.work();
    assert_eq!(reads.load(Ordering::SeqCst), 2);
    assert_eq!(retention.load(Ordering::SeqCst), 1);
    assert_eq!(w.codecs.trace_read_bytes, 2 * len as u64);
    assert_eq!(w.trace_buffers_peak, 2);
    assert_eq!(w.trace_buffer_capacity_peak, 2 * (len + 1) as u64);
    assert_eq!(w.codecs.discarded_replies, 1);
    assert_eq!(w.retention_attempts, 1);
    assert!(peak < 53_477_056);
    println!("R25 injected post-complete-read failure peak={peak} work={w:?}");
    drop(h);
    f.blocked();
}

// R25-I2: refusal is not enough; its reached logical predicate must be visible.
fn observation_totals(work: &changekernel::AssessmentWork) {
    let c = &work.comparisons;
    for c in [
        c.record_canonical,
        c.control_canonical,
        c.record_semantic,
        c.original_input,
        c.key_uniqueness,
        c.key_lookup,
        c.key_feasibility,
        c.control_typed,
        c.suffix_prefix,
        c.suffix_complete,
        c.candidate,
        c.member_selector,
        c.field_groups,
        c.initial_raw,
        c.supplied_path,
    ] {
        assert!(c.attempts >= c.completions);
        assert_eq!(c.matches + c.no_matches, c.completions);
        assert_eq!(
            c.accounting_updates,
            6 * c.completions + 4 * (c.attempts - c.completions)
        );
        assert!(c.accounting_updates <= 6 * c.attempts);
    }
}
fn observation_connect(
    f: &Fixture,
    mode: OpeningMode,
) -> (
    Result<AssessmentHost, OpeningError>,
    changekernel::AssessmentWork,
) {
    AssessmentHost::connect_observed(
        f.slot(),
        mode,
        AssessmentPolicy::NoticeWhat80,
        &mut Guard::allow(),
        None,
    )
}
#[test]
fn observation_initial_association_stage_and_anchor_temporary() {
    let _gate = CUSTODY.lock().unwrap();
    let mut association = None;
    let mut stage = None;
    for case in ["workspace", "profile", "stage", "resume-installed"] {
        let f = Fixture::new();
        let h = f.host(OpeningMode::FreshProvision, None).unwrap();
        drop(h);
        let anchor = fs::read(f.0.join("anchor.json")).unwrap();
        let trace = f.bytes("trace.jsonl");
        let checkpoint = f.bytes("checkpoint.json");
        let incident = f.bytes("incident.json");
        let negative = String::from_utf8(anchor.clone()).unwrap();
        let negative = match case {
            "workspace" => negative.replace("workspace-1", "workspace-2"),
            "profile" => negative.replace("ck-assessment-anchor@3", "ck-assessment-anchor@4"),
            "stage" => negative.replace("\"stage\":\"installed\"", "\"stage\":\"invalid\""),
            _ => negative,
        };
        fs::write(f.0.join("anchor.json"), &negative).unwrap();
        let (answer, work) = observation_connect(
            &f,
            if case == "resume-installed" {
                OpeningMode::ResumeProvision
            } else {
                OpeningMode::Reopen
            },
        );
        assert!(matches!(answer, Err(OpeningError::Unavailable)), "{case}");
        observation_totals(&work);
        assert_eq!(work.codecs.passes, 0);
        assert_eq!(work.retention_attempts, 0);
        // One false fresh-mode selector, then the actual failed association or
        // mode/stage gate. An association failure never enters the stage gate.
        assert_eq!(work.comparisons.field_groups.no_matches, 2, "{case}");
        if case == "workspace" {
            association = Some(work.comparisons.field_groups);
        }
        if case == "resume-installed" {
            stage = Some(work.comparisons.field_groups);
        }
        assert_eq!(
            fs::read(f.0.join("anchor.json")).unwrap(),
            negative.as_bytes()
        );
        assert_eq!(f.bytes("trace.jsonl"), trace);
        assert_eq!(f.bytes("checkpoint.json"), checkpoint);
        assert_eq!(f.bytes("incident.json"), incident);
        println!("R25-I2 initial {case}: {work:?}");
        fs::write(f.0.join("anchor.json"), &anchor).unwrap();
        let (restored, restored_work) = observation_connect(&f, OpeningMode::Reopen);
        let h = restored.unwrap();
        assert_eq!(restored_work.codecs.passes, 2);
        observation_totals(&restored_work);
        drop(h);
    }
    let association = association.unwrap();
    let stage = stage.unwrap();
    assert_eq!(stage.attempts, association.attempts + 1);
    assert_eq!(stage.matches, association.matches + 1);
    assert_eq!(stage.schema_words, association.schema_words + 64);
    assert_eq!(stage.operand_bytes, association.operand_bytes + 18);

    let f = Fixture::new();
    let h = f.host(OpeningMode::FreshProvision, None).unwrap();
    drop(h);
    let anchor = fs::read(f.0.join("anchor.json")).unwrap();
    let negative = String::from_utf8(anchor.clone())
        .unwrap()
        .replace("\"stage\":\"installed\"", "\"stage\":\"preparing\"");
    fs::write(f.0.join("anchor.tmp"), &negative).unwrap();
    let (answer, work) = observation_connect(&f, OpeningMode::Reopen);
    assert!(matches!(answer, Err(OpeningError::Unavailable)));
    observation_totals(&work);
    // The equal-anchor arm failed, so installed custody actually reached and
    // rejected the preparing-only alternative. No second typed equality runs.
    assert_eq!(work.comparisons.control_typed.attempts, 2);
    assert_eq!(work.comparisons.control_typed.no_matches, 1);
    assert_eq!(work.comparisons.field_groups.no_matches, 3);
    assert_eq!(work.cleanups, 0);
    assert_eq!(
        fs::read(f.0.join("anchor.tmp")).unwrap(),
        negative.as_bytes()
    );
    assert_eq!(fs::read(f.0.join("anchor.json")).unwrap(), anchor);
    println!("R25-I2 refused anchor alternative: {work:?}");

    let preparing = Fixture::new();
    // No parent owning host exists. The child owns the entire provisioning
    // lifetime and exits at the actual producer's installed-anchor temporary.
    let status = Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "observation_preparing_process_entry",
            "--nocapture",
        ])
        .env("CK_I2_PREPARING_ROOT", &preparing.0)
        .status()
        .unwrap();
    assert_eq!(status.code(), Some(77));
    assert_eq!(
        fs::read(preparing.0.join("i2-cut")).unwrap(),
        b"provision:anchor.tmp:before_rename"
    );
    let (resumed, work) = observation_connect(&preparing, OpeningMode::ResumeProvision);
    let h = resumed.unwrap();
    observation_totals(&work);
    assert_eq!(work.cleanups, 1);
    assert_eq!(work.comparisons.control_typed.no_matches, 1);
    assert_eq!(
        value(&fs::read(preparing.0.join("anchor.json")).unwrap())["stage"],
        "installed"
    );
    println!("R25-I2 preparing successor: {work:?}");
    drop(h);
}
#[test]
fn observation_preparing_process_entry() {
    let Some(root) = std::env::var_os("CK_I2_PREPARING_ROOT") else {
        return;
    };
    let _gate = CUSTODY.lock().unwrap();
    let root = PathBuf::from(root);
    let slot = OpeningSlot {
        directory: root.join("slot"),
        anchor: root.join("anchor.json"),
    };
    let marker = root.join("i2-cut");
    let hook: OpeningIoHook = Box::new(move |e| {
        if e.object == "anchor.tmp" && e.step == "before_rename" {
            assert_eq!(e.phase, "provision");
            fs::write(&marker, b"provision:anchor.tmp:before_rename").unwrap();
            std::process::exit(77);
        }
        OpeningIoFault::Continue
    });
    let answer = AssessmentHost::connect(
        slot,
        OpeningMode::FreshProvision,
        AssessmentPolicy::NoticeWhat80,
        &mut Guard::allow(),
        Some(hook),
    );
    assert!(
        answer.is_ok(),
        "prerequisite provisioning refused before selected cut"
    );
    panic!("actual provisioning cut was not reached");
}
#[test]
fn observation_incident_duplicate_presence_and_shape() {
    let _gate = CUSTODY.lock().unwrap();
    for case in ["duplicate", "extra-phase", "state", "format", "custody"] {
        let f = Fixture::new();
        let h = f.host(OpeningMode::FreshProvision, None).unwrap();
        drop(h);
        let original = f.bytes("incident.json");
        let text = String::from_utf8(original.clone()).unwrap();
        let negative = match case {
            "duplicate" => text.replace(
                "{\"format\":",
                "{\"format\":\"ck-assessment-incident@3\",\"format\":",
            ),
            "extra-phase" => text.replace(
                "\"state\":\"clear\"}",
                "\"state\":\"clear\",\"phase\":\"recover\"}",
            ),
            "state" => text.replace(",\"state\":\"clear\"", ""),
            "format" => text.replace("\"format\":\"ck-assessment-incident@3\",", ""),
            "custody" => text.replace("\"custody\":\"custody-1\",", ""),
            _ => unreachable!(),
        };
        let trace = f.bytes("trace.jsonl");
        let checkpoint = f.bytes("checkpoint.json");
        fs::write(f.path("incident.json"), &negative).unwrap();
        let (answer, work) = observation_connect(&f, OpeningMode::Reopen);
        assert!(matches!(answer, Err(OpeningError::Unavailable)), "{case}");
        observation_totals(&work);
        // False fresh/preparing/absent-anchor-temp selectors, the failed codec
        // duplicate/presence/shape gate, and damage-only retention disposition.
        assert_eq!(work.comparisons.field_groups.no_matches, 5, "{case}");
        assert_eq!(work.comparisons.control_canonical.attempts, 3);
        assert_eq!(work.codecs.control_decode_attempts, 4);
        assert_eq!(work.codecs.control_decodes, 3);
        assert_eq!(work.codecs.passes, 1);
        assert_eq!(work.max_pass_count, 0);
        assert_eq!(work.retention_attempts, 0);
        assert_eq!(f.bytes("incident.json"), negative.as_bytes());
        assert_eq!(f.bytes("trace.jsonl"), trace);
        assert_eq!(f.bytes("checkpoint.json"), checkpoint);
        println!("R25-I2 incident {case}: {work:?}");
        fs::write(f.path("incident.json"), original).unwrap();
        let (restored, restored_work) = observation_connect(&f, OpeningMode::Reopen);
        let h = restored.unwrap();
        observation_totals(&restored_work);
        assert_eq!(restored_work.codecs.passes, 2);
        drop(h);
    }
}
#[test]
fn observation_missing_request_and_result_discriminators() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    let mut h = f.start("x");
    let original = String::from_utf8(assess("sample", 1)).unwrap();
    let trace = f.bytes("trace.jsonl");
    let checkpoint = f.bytes("checkpoint.json");
    for (case, request, groups) in [
        ("v", original.replace("\"v\":3,", ""), 8),
        ("op", original.replace("\"op\":\"assess_intent\",", ""), 9),
        (
            "both",
            original
                .replace("\"v\":3,", "")
                .replace("\"op\":\"assess_intent\",", ""),
            7,
        ),
    ] {
        let mut guard = Guard::allow();
        error(
            h.assess_intent(request.as_bytes(), &mut guard),
            OpeningError::InvalidInput,
        );
        let work = h.work();
        observation_totals(&work);
        assert_eq!(guard.calls, 0);
        assert_eq!(work.codecs.request_decode_attempts, 1);
        assert_eq!(work.codecs.request_decodes, 0);
        assert_eq!(work.codecs.passes, 0);
        assert_eq!(work.comparisons.field_groups.attempts, groups);
        assert_eq!(work.comparisons.field_groups.no_matches, 1);
        assert_eq!(work.comparisons.field_groups.operand_bytes, 0);
        assert_eq!(work.comparisons.field_groups.schema_words, 64 * groups);
        assert_eq!(f.bytes("trace.jsonl"), trace);
        assert_eq!(f.bytes("checkpoint.json"), checkpoint);
        println!("R25-I2 request discriminator {case}: {work:?}");
    }
    let result = h.assess_intent(&assess("sample", 1), &mut Guard::allow());
    assert_eq!(value(&result)["seq"], 2);
    drop(h);
    let original_trace = f.bytes("trace.jsonl");
    let original_checkpoint = f.bytes("checkpoint.json");
    let mut missing = None;
    let mut unknown = None;
    for case in ["missing", "unknown"] {
        let trace = String::from_utf8(original_trace.clone()).unwrap();
        let negative = trace.replace(
            "\"result\":{\"v\":3,\"kind\":\"intent_assessed\",",
            if case == "missing" {
                "\"result\":{\"v\":3,"
            } else {
                "\"result\":{\"v\":3,\"kind\":\"unknown_result\","
            },
        );
        let checkpoint = String::from_utf8(original_checkpoint.clone())
            .unwrap()
            .replace(
                &format!("\"end\":{}", original_trace.len()),
                &format!("\"end\":{}", negative.len()),
            )
            .replace(
                &format!("{:x}", Sha256::digest(&original_trace)),
                &format!("{:x}", Sha256::digest(negative.as_bytes())),
            );
        fs::write(f.path("trace.jsonl"), &negative).unwrap();
        fs::write(f.path("checkpoint.json"), &checkpoint).unwrap();
        let (answer, work) = observation_connect(&f, OpeningMode::Reopen);
        assert!(matches!(answer, Err(OpeningError::Unavailable)));
        observation_totals(&work);
        assert_eq!(work.codecs.record_decode_attempts, 2);
        assert_eq!(work.codecs.record_decodes, 1);
        assert_eq!(work.comparisons.record_canonical.attempts, 1);
        assert_eq!(work.comparisons.record_semantic.attempts, 1);
        assert_eq!(f.bytes("trace.jsonl"), negative.as_bytes());
        assert_eq!(f.bytes("checkpoint.json"), checkpoint.as_bytes());
        println!("R25-I2 result discriminator {case}: {work:?}");
        if case == "missing" {
            missing = Some(work.comparisons.field_groups);
        } else {
            unknown = Some(work.comparisons.field_groups);
        }
    }
    let missing = missing.unwrap();
    let unknown = unknown.unwrap();
    // Unknown kind reaches one additional member duplicate guard and the
    // variant selector. Missing kind refuses at presence, before that selector.
    assert_eq!(unknown.no_matches, missing.no_matches);
    assert_eq!(unknown.attempts, missing.attempts + 2);
    assert_eq!(unknown.matches, missing.matches + 2);
    assert_eq!(unknown.operand_bytes, missing.operand_bytes + 64);
    assert_eq!(unknown.schema_words, missing.schema_words + 128);
    fs::write(f.path("trace.jsonl"), original_trace).unwrap();
    fs::write(f.path("checkpoint.json"), original_checkpoint).unwrap();
    let h = f.host(OpeningMode::Reopen, None).unwrap();
    drop(h);
}
#[test]
fn observation_dispatch_empty_tail_capacity_and_retention() {
    let _gate = CUSTODY.lock().unwrap();
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    error(
        h.assess_intent(&assess("empty", 1), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    let empty = h.work();
    observation_totals(&empty);
    budget(empty);
    assert_eq!(empty.comparisons.field_groups.no_matches, 6);
    assert_eq!(empty.codecs.passes, 1);
    assert_eq!(empty.max_pass_count, 0);
    error(
        h.inspect_intent(&inspect("inspect_intent", None), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    let read = h.work();
    observation_totals(&read);
    assert_eq!(read.comparisons.field_groups.no_matches, 4);
    assert_eq!(
        value(&h.open_change(&open("x", None), &mut Guard::allow()))["seq"],
        1
    );
    use std::io::Write;
    fs::OpenOptions::new()
        .append(true)
        .open(f.path("trace.jsonl"))
        .unwrap()
        .write_all(b"unexplained")
        .unwrap();
    let physical = f.bytes("trace.jsonl");
    let checkpoint = f.bytes("checkpoint.json");
    error(
        h.assess_intent(&assess("tail", 1), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    let tail = h.work();
    observation_totals(&tail);
    budget(tail);
    assert_eq!(tail.comparisons.field_groups.no_matches, 7);
    assert_eq!(f.bytes("trace.jsonl"), physical);
    assert_eq!(f.bytes("checkpoint.json"), checkpoint);
    println!("R25-I2 empty {empty:?}\nR25-I2 absent selection {read:?}\nR25-I2 tail {tail:?}");
    drop(h);

    let f = Fixture::new();
    let mut h = f.start("x");
    let current = history(&mut h, 128);
    let checkpoint = f.bytes("checkpoint.json");
    error(
        h.assess_intent(
            &assess_check("overflow", current, "other@1"),
            &mut Guard::allow(),
        ),
        OpeningError::Unsupported,
    );
    let check = h.work();
    error(
        h.assess_intent(&assess("overflow", current), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    let capacity = h.work();
    observation_totals(&capacity);
    budget(capacity);
    assert_eq!(
        capacity.comparisons.field_groups.no_matches,
        check.comparisons.field_groups.no_matches
    );
    assert_eq!(
        capacity.comparisons.field_groups.attempts,
        check.comparisons.field_groups.attempts + 2
    );
    assert_eq!(
        capacity.comparisons.field_groups.matches,
        check.comparisons.field_groups.matches + 2
    );
    assert_eq!(f.bytes("checkpoint.json"), checkpoint);
    println!("R25-I2 count refusal: {capacity:?}");
    drop(h);

    let mut temporary_work = None;
    let mut clear_work = None;
    for case in ["clear", "temporary", "malformed"] {
        let f = Fixture::new();
        let h = f.start("x");
        drop(h);
        let original = f.bytes("incident.json");
        let incident_path = f.path("incident.json");
        let temp = f.path("incident.tmp");
        let malformed = String::from_utf8(original.clone()).unwrap().replace(
            "{\"format\":",
            "{\"format\":\"ck-assessment-incident@3\",\"format\":",
        );
        let armed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let active = armed.clone();
        let hit = std::sync::Arc::new(AtomicUsize::new(0));
        let selected = hit.clone();
        let hook: OpeningIoHook = Box::new(move |e| {
            if active.load(Ordering::SeqCst)
                && e.phase == "deliver"
                && e.object == "trace.jsonl"
                && e.step == "read"
            {
                assert_eq!(selected.fetch_add(1, Ordering::SeqCst), 0);
                if case == "temporary" {
                    fs::write(&temp, b"retained evidence").unwrap();
                }
                if case == "malformed" {
                    fs::write(&incident_path, &malformed).unwrap();
                }
                return OpeningIoFault::Io;
            }
            OpeningIoFault::Continue
        });
        let mut h = f.host(OpeningMode::Reopen, Some(hook)).unwrap();
        assert_eq!(hit.load(Ordering::SeqCst), 0);
        armed.store(true, Ordering::SeqCst);
        error(
            h.inspect_intent(&inspect("inspect_intent", None), &mut Guard::allow()),
            OpeningError::Unavailable,
        );
        let work = h.work();
        observation_totals(&work);
        budget(work);
        assert_eq!(hit.load(Ordering::SeqCst), 1);
        assert_eq!(work.retention_attempts, 1);
        assert_eq!(work.codecs.discarded_replies, 1);
        assert_eq!(work.trace_buffers_peak, 2);
        if case == "temporary" {
            assert_eq!(
                fs::read(f.path("incident.tmp")).unwrap(),
                b"retained evidence"
            );
            assert_eq!(f.bytes("incident.json"), original);
            temporary_work = Some(work);
        } else if case == "clear" {
            assert_eq!(value(&f.bytes("incident.json"))["state"], "blocked");
            clear_work = Some(work);
        } else {
            assert_eq!(
                f.bytes("incident.json"),
                String::from_utf8(original)
                    .unwrap()
                    .replace(
                        "{\"format\":",
                        "{\"format\":\"ck-assessment-incident@3\",\"format\":"
                    )
                    .as_bytes()
            );
        }
        println!("R25-I2 retention {case}: {work:?}");
        drop(h);
        f.blocked();
    }
    let clear = clear_work.unwrap();
    let temporary = temporary_work.unwrap();
    assert_eq!(
        temporary.comparisons.field_groups.no_matches,
        clear.comparisons.field_groups.no_matches + 1
    );
    assert_eq!(
        clear.comparisons.field_groups.attempts,
        temporary.comparisons.field_groups.attempts + 14
    );
    assert_eq!(
        clear.comparisons.field_groups.matches,
        temporary.comparisons.field_groups.matches + 15
    );
    assert_eq!(
        clear.codecs.control_decode_attempts,
        temporary.codecs.control_decode_attempts + 1
    );
}

#[test]
fn observation_evaluator_scalar_false_is_completed() {
    let _gate = CUSTODY.lock().unwrap();
    let mut passing = None;
    let mut failing = None;
    for (bytes, passed) in [(80, true), (81, false)] {
        let f = Fixture::new();
        let mut h = f.start(&"x".repeat(bytes));
        let result = h.assess_intent(&assess("predicate", 1), &mut Guard::allow());
        let result = value(&result);
        assert_eq!(result["kind"], "intent_assessed");
        assert_eq!(result["passed"], passed);
        assert_eq!(result["evidence"]["utf8_bytes"], bytes);
        let work = h.work();
        observation_totals(&work);
        budget(work);
        assert_eq!(work.evaluator_constructions, 4);
        assert_eq!(work.retained_assessment_validations, 2);
        assert_eq!(work.comparisons.record_semantic.attempts, 5);
        assert_eq!(work.comparisons.record_semantic.matches, 5);
        assert_eq!(work.codecs.error_replies, 0);
        println!("R25-I2 completed predicate bytes={bytes}: {work:?}");
        if passed {
            passing = Some(work.comparisons.field_groups);
        } else {
            failing = Some(work.comparisons.field_groups);
        }
        drop(h);
    }
    let passing = passing.unwrap();
    let failing = failing.unwrap();
    // The same scalar predicate is reached in production, reservation
    // feasibility and both retained validations. False is not a refusal.
    assert_eq!(failing.attempts, passing.attempts);
    assert_eq!(failing.completions, passing.completions);
    assert_eq!(failing.no_matches, passing.no_matches + 4);
    assert_eq!(failing.matches + 4, passing.matches);
    assert_eq!(failing.operand_bytes, passing.operand_bytes);
    assert_eq!(failing.schema_words, passing.schema_words);
}
