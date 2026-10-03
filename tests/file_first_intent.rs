#![cfg(target_os = "linux")]
use changekernel::{
    IntentHost, OpeningError, OpeningGuard, OpeningHost, OpeningIoEvent, OpeningIoFault,
    OpeningIoHook, OpeningMode, OpeningPermission, OpeningSlot,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    os::unix::fs::{symlink, DirBuilderExt},
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Mutex,
    },
};
const OPEN: &str = r#"{"v":1,"op":"open_change","workspace_id":"workspace-1","change":"change-1","key":"open-1","what":"  Café /\u000a清理  ","why":null}"#;
const RESULT:&str="{\"v\":1,\"kind\":\"opened\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"open-1\",\"actor\":\"owner-1\",\"result\":\"change-1:origin\",\"seq\":1}\n";
const LEGACY: &str =
    r#"{"v":1,"op":"inspect_change","workspace_id":"workspace-1","change":"change-1"}"#;
const CAP: usize = 16_777_216;
static NEXT: AtomicUsize = AtomicUsize::new(0);
// Hold once per entire test, including compatibility/accounting owners and the
// exec'd child entry. Local host drops before spawn remain mandatory: exclusion
// prevents any other test thread from owning custody while a child is created.
// Do not lock per Fixture: a single test can own multiple fixtures.
static CUSTODY_TEST: Mutex<()> = Mutex::new(());
struct Guard {
    permission: OpeningPermission,
    final_permission: Option<OpeningPermission>,
    calls: usize,
}
impl Guard {
    fn allow() -> Self {
        Self {
            permission: OpeningPermission::Allow,
            final_permission: None,
            calls: 0,
        }
    }
}
impl OpeningGuard for Guard {
    fn principal(&self) -> &str {
        "owner-1"
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
            "ck-intent-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::DirBuilder::new().mode(0o700).create(&p).unwrap();
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
    ) -> Result<IntentHost, OpeningError> {
        IntentHost::connect(self.slot(), mode, &mut Guard::allow(), hook)
    }
    fn start(&self) -> IntentHost {
        let mut h = self.host(OpeningMode::FreshProvision, None).unwrap();
        assert_eq!(
            h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
        h
    }
    fn blocked(&self) {
        match self.host(OpeningMode::Reopen, None) {
            Err(e) => assert_eq!(e, OpeningError::Unavailable),
            Ok(mut h) => assert_eq!(
                h.inspect_intent(&inspect(None), &mut Guard::allow()),
                OpeningError::Unavailable.json()
            ),
        }
    }
    fn child(
        &self,
        action: &str,
        request: Option<&[u8]>,
        cut: Option<&str>,
        short: bool,
    ) -> std::process::ExitStatus {
        if let Some(q) = request {
            fs::write(self.0.join("request"), q).unwrap();
        }
        let mut c = Command::new(std::env::current_exe().unwrap());
        c.args(["--exact", "intent_process_entry", "--nocapture"])
            .env("CK_INTENT_ROOT", &self.0)
            .env("CK_INTENT_ACTION", action);
        if let Some(cut) = cut {
            c.env("CK_INTENT_CUT", cut);
        }
        if short {
            c.env("CK_INTENT_SHORT", "1");
        }
        // The whole-test gate excludes other host-owning tests. Callers dropped
        // their own hosts; status confirms this child's exit before reopening.
        c.status().unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn reference(seq: u64) -> String {
    if seq == 1 {
        "change-1:origin".into()
    } else {
        format!("change-1:op:{seq}")
    }
}
fn revise(seq: u64, what: &str, why: Option<&str>) -> Vec<u8> {
    format!("{{\"v\":2,\"op\":\"revise_intent\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"r{seq:03}\",\"expected_intent\":{},\"what\":{},\"why\":{}}}",serde_json::to_string(&reference(seq-1)).unwrap(),serde_json::to_string(what).unwrap(),serde_json::to_string(&why).unwrap()).into_bytes()
}
fn inspect(at: Option<u64>) -> Vec<u8> {
    format!("{{\"v\":2,\"op\":\"inspect_intent\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"at\":{}}}",serde_json::to_string(&at.map(reference)).unwrap()).into_bytes()
}
fn success(b: &[u8]) -> serde_json::Value {
    let v: serde_json::Value = serde_json::from_slice(b).unwrap();
    assert!(v.get("code").is_none(), "{v}");
    v
}
fn error(b: &[u8], e: OpeningError) {
    assert_eq!(b, e.json());
}
fn append_history(h: &mut IntentHost, last: u64) {
    for seq in 2..=last {
        let q = revise(
            seq,
            "same exact text",
            if seq % 2 == 0 { None } else { Some("") },
        );
        let r = success(&h.revise_intent(&q, &mut Guard::allow()));
        assert_eq!(r["seq"], seq);
        assert_eq!(r["previous_intent"], reference(seq - 1));
    }
}
fn checkpoint(f: &Fixture) -> String {
    String::from_utf8(f.bytes("checkpoint.json")).unwrap()
}
fn reserve_control(base: &str, input: &[u8]) -> Vec<u8> {
    base.replace(
        "\"pending\":null",
        &format!(
            "\"pending\":{{\"input\":{},\"actor\":\"owner-1\"}}",
            std::str::from_utf8(input).unwrap()
        ),
    )
    .into_bytes()
}
fn accepted_control(base: &str, count: u64, trace: &[u8]) -> Vec<u8> {
    // Negative/proven temporary remnant construction only; never creates accepted history.
    assert!(base.contains("ck-intent-prefix@2"));
    format!("{{\"format\":\"ck-intent-prefix@2\",\"custody\":\"custody-1\",\"change\":\"change-1\",\"generation\":{count},\"end\":{},\"sha256\":\"{:x}\",\"pending\":null}}\n",trace.len(),Sha256::digest(trace)).into_bytes()
}
#[test]
fn intent_process_entry() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let Ok(root) = std::env::var("CK_INTENT_ROOT") else {
        return;
    };
    let f = Fixture(PathBuf::from(root));
    let cut = std::env::var("CK_INTENT_CUT").ok();
    let short = std::env::var_os("CK_INTENT_SHORT").is_some();
    let hook: OpeningIoHook = Box::new(move |e| {
        let name = format!("{}:{}:{}", e.phase, e.object, e.step);
        if cut.as_deref() == Some(&name) {
            std::process::exit(73);
        }
        if short && e.phase == "append" && e.step == "before_write" {
            OpeningIoFault::ShortWrite
        } else {
            OpeningIoFault::Continue
        }
    });
    let mut h = f.host(OpeningMode::Reopen, Some(hook)).unwrap();
    let action = std::env::var("CK_INTENT_ACTION").unwrap();
    if action == "retry" {
        assert_eq!(
            h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
        for seq in 2..=4 {
            let r = h.revise_intent(
                &revise(
                    seq,
                    "same exact text",
                    if seq % 2 == 0 { None } else { Some("") },
                ),
                &mut Guard::allow(),
            );
            fs::write(f.0.join(format!("retry-{seq}")), r).unwrap();
        }
    } else {
        let q = fs::read(f.0.join("request")).unwrap();
        let r = h.revise_intent(&q, &mut Guard::allow());
        if short {
            error(&r, OpeningError::Unavailable);
        } else {
            success(&r);
        }
    }
    drop(h);
    std::mem::forget(f);
}
#[test]
fn useful_history_and_confirmed_fresh_process_retry() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    let origin = f.bytes("trace.jsonl");
    append_history(&mut h, 4);
    let mut results = Vec::new();
    for seq in 2..=4 {
        results.push(h.revise_intent(
            &revise(
                seq,
                "same exact text",
                if seq % 2 == 0 { None } else { Some("") },
            ),
            &mut Guard::allow(),
        ));
    }
    for at in [Some(1), Some(2), Some(3), None] {
        let v = success(&h.inspect_intent(&inspect(at), &mut Guard::allow()));
        let seq = at.unwrap_or(4);
        assert_eq!(v["selected_intent"], reference(seq));
        assert_eq!(v["current_intent"], reference(4));
        assert_eq!(v["v"], 2);
        assert_eq!(v["kind"], "intent_inspection");
        assert_eq!(v["projection"], "ck-intent-view@1");
        assert_eq!(v["purpose"], "intent");
        assert_eq!(v["origin"], reference(1));
        assert_eq!(v["tip"], reference(4));
        assert_eq!(v["progress"], "ready");
        assert_eq!(v["coverage"]["last"], 4);
        assert_eq!(v["coverage"]["first"], 1);
        assert_eq!(v["coverage"]["selected"], seq);
        assert_eq!(v["coverage"]["returned"], 1);
        assert_eq!(v["coverage"]["complete"], true);
        assert_eq!(
            v["coverage"]["sha256"],
            format!("{:x}", Sha256::digest(f.bytes("trace.jsonl")))
        );
        assert_eq!(v["record"]["result"]["actor"], "owner-1");
        if seq == 1 {
            assert!(v["record"]["prev"].is_null());
            assert_eq!(v["record"]["input"]["what"], "  Café /\n清理  ");
            assert!(v["record"]["input"]["why"].is_null());
        } else {
            assert_eq!(v["record"]["input"]["what"], "same exact text");
            assert_eq!(
                v["record"]["input"]["why"],
                if seq % 2 == 0 {
                    serde_json::Value::Null
                } else {
                    serde_json::Value::String("".into())
                }
            );
        }
    }
    let trace = f.bytes("trace.jsonl");
    let control = f.bytes("checkpoint.json");
    assert!(trace.starts_with(&origin));
    drop(h);
    assert!(f.child("retry", None, None, false).success());
    for seq in 2..=4 {
        assert_eq!(
            fs::read(f.0.join(format!("retry-{seq}"))).unwrap(),
            results[(seq - 2) as usize]
        );
    }
    assert_eq!(f.bytes("trace.jsonl"), trace);
    assert_eq!(f.bytes("checkpoint.json"), control);
}
#[test]
fn closed_union_discriminants_masks_nulls_and_authorization() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    let initial = f.bytes("trace.jsonl");
    let valid = String::from_utf8(revise(2, "x", None)).unwrap();
    let mut invalid = vec![
        valid.replace("\"v\":2", "\"v\":3"),
        valid.replace(",\"why\":null", ""),
        valid.replace("\"why\":null", "\"why\":null,\"why\":null"),
        valid.replace("\"why\":null", "\"why\":[]"),
        valid.replace("\"v\":2", "\"v\":2.0"),
        valid.replace("\"v\":2", "\"v\":\"2\""),
        valid.replace("\"op\":\"revise_intent\"", "\"op\":\"raw_append\""),
        valid.replace("change-1:origin", "other:op:02"),
    ];
    for suffix in ["", ",\"why\":null", ",\"why\":[]"] {
        invalid.push(format!("{{\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"r002\",\"expected_intent\":\"change-1:origin\",\"what\":\"x\"{suffix},\"op\":\"revise_intent\",\"v\":3}}"));
    }
    for q in invalid {
        for dispatcher in 0..3 {
            let r = match dispatcher {
                0 => h.open_change(q.as_bytes(), &mut Guard::allow()),
                1 => h.revise_intent(q.as_bytes(), &mut Guard::allow()),
                _ => h.inspect_intent(q.as_bytes(), &mut Guard::allow()),
            };
            error(&r, OpeningError::InvalidInput);
        }
    }
    for q in [
        LEGACY.to_string(),
        LEGACY.replace(
            "\"change\":\"change-1\"",
            "\"change\":\"change-1\",\"key\":\"x\"",
        ),
        LEGACY.replace(",\"change\":\"change-1\"", ""),
        LEGACY.replace("\"v\":1", "\"v\":1,\"v\":1"),
        LEGACY.replace("\"workspace_id\":\"workspace-1\"", "\"workspace_id\":1"),
    ] {
        for dispatcher in 0..3 {
            let r = match dispatcher {
                0 => h.open_change(q.as_bytes(), &mut Guard::allow()),
                1 => h.revise_intent(q.as_bytes(), &mut Guard::allow()),
                _ => h.inspect_intent(q.as_bytes(), &mut Guard::allow()),
            };
            error(
                &r,
                if q == LEGACY {
                    OpeningError::Unsupported
                } else {
                    OpeningError::InvalidInput
                },
            );
        }
    }
    error(
        &h.open_change(valid.as_bytes(), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    error(
        &h.revise_intent(OPEN.as_bytes(), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    error(
        &h.inspect_intent(OPEN.as_bytes(), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    error(
        &h.open_change(&inspect(None), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    error(
        &h.revise_intent(&inspect(None), &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    for q in [
        OPEN.replace("\"v\":1", "\"v\":2"),
        OPEN.replace("open_change", "raw_append"),
    ] {
        error(
            &h.open_change(q.as_bytes(), &mut Guard::allow()),
            OpeningError::InvalidInput,
        );
    }
    for q in [
        valid.replace("workspace-1", "other"),
        valid.replace("change-1:origin", "other:origin"),
    ] {
        error(
            &h.revise_intent(q.as_bytes(), &mut Guard::allow()),
            OpeningError::Denied,
        );
    }
    error(
        &h.inspect_intent(&inspect(Some(128)), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    error(
        &h.revise_intent(&revise(2, &"x".repeat(65_537), None), &mut Guard::allow()),
        OpeningError::InvalidInput,
    );
    error(
        &h.revise_intent(&[0xff], &mut Guard::allow()),
        OpeningError::InvalidInput,
    );
    error(
        &h.revise_intent(&vec![b' '; 1_048_577], &mut Guard::allow()),
        OpeningError::InvalidInput,
    );
    assert_eq!(f.bytes("trace.jsonl"), initial);
    error(
        &h.open_change(
            OPEN.replace("\"why\":null", "\"why\":\"\"").as_bytes(),
            &mut Guard::allow(),
        ),
        OpeningError::Conflict,
    );
    let q = revise(2, "x\n\t\u{0000}é", Some(""));
    success(&h.revise_intent(&q, &mut Guard::allow()));
    error(
        &h.revise_intent(&revise(2, "x\n\t\u{0000}é", None), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    for permission in [OpeningPermission::Deny, OpeningPermission::Unavailable] {
        let e = if permission == OpeningPermission::Deny {
            OpeningError::Denied
        } else {
            OpeningError::Unavailable
        };
        for at in [Some(1), Some(2), None] {
            let mut g = Guard {
                permission,
                ..Guard::allow()
            };
            error(&h.inspect_intent(&inspect(at), &mut g), e);
            assert_eq!(h.work().passes, 0);
            let mut g = Guard {
                final_permission: Some(permission),
                ..Guard::allow()
            };
            error(&h.inspect_intent(&inspect(at), &mut g), e);
        }
        let mut g = Guard {
            final_permission: Some(permission),
            ..Guard::allow()
        };
        error(&h.open_change(OPEN.as_bytes(), &mut g), e);
    }
    let q = revise(3, "committed despite denial", None);
    let mut g = Guard {
        final_permission: Some(OpeningPermission::Deny),
        ..Guard::allow()
    };
    error(&h.revise_intent(&q, &mut g), OpeningError::Denied);
    success(&h.revise_intent(&q, &mut Guard::allow()));
}
#[test]
fn global_keys_stale_input_and_unreserved_suffix() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    append_history(&mut h, 4);
    let control = f.bytes("checkpoint.json");
    let q = String::from_utf8(revise(5, "x", None)).unwrap();
    error(
        &h.revise_intent(q.replace("r005", "open-1").as_bytes(), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    error(
        &h.open_change(
            OPEN.replace("open-1", "r002").as_bytes(),
            &mut Guard::allow(),
        ),
        OpeningError::Conflict,
    );
    error(
        &h.open_change(
            OPEN.replace("open-1", "unused").as_bytes(),
            &mut Guard::allow(),
        ),
        OpeningError::Unsupported,
    );
    success(&h.revise_intent(&revise(2, "same exact text", None), &mut Guard::allow()));
    error(
        &h.revise_intent(&revise(3, "changed", None), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    error(
        &h.revise_intent(
            q.replace("change-1:op:4", "change-1:origin").as_bytes(),
            &mut Guard::allow(),
        ),
        OpeningError::Conflict,
    );
    assert_eq!(f.bytes("checkpoint.json"), control);
    drop(h);
    let mut trace = f.bytes("trace.jsonl");
    trace.extend_from_slice(b"unaccepted tail");
    fs::write(f.path("trace.jsonl"), &trace).unwrap();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let v = success(&h.inspect_intent(&inspect(Some(2)), &mut Guard::allow()));
    assert_eq!(v["progress"], "blocked_unaccepted_tail");
    assert_eq!(
        h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
    error(
        &h.revise_intent(q.as_bytes(), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert_eq!(f.bytes("trace.jsonl"), trace);
}
#[test]
fn real_later_generation_cuts_pending_and_lost_reply() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let cuts = [
        "reserve:checkpoint.tmp:synced",
        "reserve:checkpoint.tmp:renamed",
        "reserve:directory:synced",
        "append:trace.jsonl:short_written",
        "append:trace.jsonl:written",
        "append:trace.jsonl:synced",
        "checkpoint:checkpoint.tmp:synced",
        "checkpoint:checkpoint.tmp:renamed",
        "checkpoint:directory:synced",
        "deliver:reply:before",
    ];
    for last in [3, 9] {
        for cut in cuts {
            let f = Fixture::new();
            let mut h = f.start();
            append_history(&mut h, last);
            drop(h);
            let prefix = f.bytes("trace.jsonl");
            let q = revise(last + 1, "cut exact text", None);
            assert_eq!(
                f.child("mutate", Some(&q), Some(cut), cut.contains("short_written"))
                    .code(),
                Some(73),
                "{cut}"
            );
            let mut h = f.host(OpeningMode::Reopen, None).unwrap();
            let v = success(&h.inspect_intent(&inspect(Some(2)), &mut Guard::allow()));
            assert_eq!(v["record"]["seq"], 2);
            if v["progress"] == "blocked_pending" {
                error(
                    &h.revise_intent(&revise(last + 1, "changed", None), &mut Guard::allow()),
                    OpeningError::Conflict,
                );
                error(
                    &h.revise_intent(
                        &String::from_utf8(q.clone())
                            .unwrap()
                            .replace(&format!("r{:03}", last + 1), "other")
                            .into_bytes(),
                        &mut Guard::allow(),
                    ),
                    OpeningError::Unavailable,
                );
            }
            assert_eq!(
                h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
                RESULT.as_bytes()
            );
            let response = h.revise_intent(&q, &mut Guard::allow());
            let result = success(&response);
            assert_eq!(result["seq"], last + 1);
            let trace = f.bytes("trace.jsonl");
            assert!(trace.starts_with(&prefix));
            let count = trace.iter().filter(|b| **b == b'\n').count();
            assert_eq!(count, last as usize + 1);
            assert_eq!(h.revise_intent(&q, &mut Guard::allow()), response);
            assert_eq!(f.bytes("trace.jsonl"), trace);
            assert!(h.work().passes <= 4);
            assert!(!f.path("checkpoint.tmp").exists());
        }
    }
}
fn prove_preserved(f: &Fixture, h: &mut IntentHost, q: &[u8]) {
    let before = [f.bytes("trace.jsonl"), f.bytes("checkpoint.json")];
    let temp = fs::read(f.path("checkpoint.tmp")).ok();
    error(
        &h.inspect_intent(&inspect(Some(1)), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    error(
        &h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    error(
        &h.revise_intent(q, &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert_eq!(f.bytes("trace.jsonl"), before[0]);
    assert_eq!(f.bytes("checkpoint.json"), before[1]);
    assert_eq!(fs::read(f.path("checkpoint.tmp")).ok(), temp);
}
fn impossible_matrix(f: &Fixture, last: u64, candidate: &[u8], q: &[u8]) {
    let base = checkpoint(f);
    let prefix = f.bytes("trace.jsonl");
    let pending = reserve_control(&base, q);
    for cut in [0, candidate.len() / 2, candidate.len()] {
        for temp in 0..3 {
            fs::write(f.path("checkpoint.json"), base.as_bytes()).unwrap();
            fs::write(f.path("trace.jsonl"), &prefix).unwrap();
            if f.path("checkpoint.tmp").exists() {
                fs::remove_file(f.path("checkpoint.tmp")).unwrap();
            }
            let mut h = f.host(OpeningMode::Reopen, None).unwrap();
            let mut trace = prefix.clone();
            trace.extend_from_slice(&candidate[..cut]);
            fs::write(f.path("trace.jsonl"), &trace).unwrap();
            fs::write(f.path("checkpoint.json"), &pending).unwrap();
            if temp == 1 {
                fs::write(f.path("checkpoint.tmp"), &pending).unwrap();
            } else if temp == 2 {
                let mut full = prefix.clone();
                full.extend_from_slice(candidate);
                fs::write(
                    f.path("checkpoint.tmp"),
                    accepted_control(&base, last + 1, &full),
                )
                .unwrap();
            }
            prove_preserved(f, &mut h, q);
            drop(h);
            f.blocked();
        }
    }
    fs::write(f.path("checkpoint.json"), base).unwrap();
    fs::write(f.path("trace.jsonl"), prefix).unwrap();
    if f.path("checkpoint.tmp").exists() {
        fs::remove_file(f.path("checkpoint.tmp")).unwrap();
    }
}
#[test]
fn count_capacity_impossible_pending_and_reservation_temporaries() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    append_history(&mut h, 128);
    for at in [Some(1), Some(64), None] {
        success(&h.inspect_intent(&inspect(at), &mut Guard::allow()));
        assert_eq!(h.work().passes, 2);
        assert_eq!(h.work().record_decodes, 256);
    }
    let q = revise(129, "same exact text", Some(""));
    let before = f.bytes("checkpoint.json");
    error(
        &h.revise_intent(&q, &mut Guard::allow()),
        OpeningError::Unsupported,
    );
    assert_eq!(f.bytes("checkpoint.json"), before);
    let trace = f.bytes("trace.jsonl");
    let last =
        std::str::from_utf8(trace.split_inclusive(|b| *b == b'\n').next_back().unwrap()).unwrap();
    let purported = last
        .replace("r128", "r129")
        .replace(":op:127", ":op:128")
        .replace(":op:128\"", ":op:129\"")
        .replace("\"seq\":128", "\"seq\":129");
    drop(h);
    impossible_matrix(&f, 128, purported.as_bytes(), &q);
    let base = checkpoint(&f);
    fs::write(f.path("checkpoint.tmp"), reserve_control(&base, &q)).unwrap();
    f.blocked();
    assert!(f.path("checkpoint.tmp").exists());
    fs::remove_file(f.path("checkpoint.tmp")).unwrap();
    fs::write(f.path("checkpoint.tmp"), base.as_bytes()).unwrap();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert!(!f.path("checkpoint.tmp").exists());
    assert_eq!(
        h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
    // Every historical key retries at the count ceiling before predecessor admission.
    for seq in 2..=128 {
        success(&h.revise_intent(
            &revise(
                seq,
                "same exact text",
                if seq % 2 == 0 { None } else { Some("") },
            ),
            &mut Guard::allow(),
        ));
    }
    error(
        &h.revise_intent(&revise(2, "changed", None), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    error(
        &h.revise_intent(&revise(4, "stale", None), &mut Guard::allow()),
        OpeningError::Conflict,
    );
    assert_eq!(f.bytes("trace.jsonl"), trace);
}
#[test]
fn feasible_count_equality_recovery_with_valid_temporaries() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for cut in [
        "reserve:directory:synced",
        "append:trace.jsonl:short_written",
        "checkpoint:checkpoint.tmp:synced",
    ] {
        let f = Fixture::new();
        let mut h = f.start();
        append_history(&mut h, 127);
        drop(h);
        let prefix = f.bytes("trace.jsonl");
        let q = revise(128, "last supported", None);
        assert_eq!(
            f.child("mutate", Some(&q), Some(cut), cut.contains("short_written"))
                .code(),
            Some(73)
        );
        if !f.path("checkpoint.tmp").exists() {
            fs::write(f.path("checkpoint.tmp"), f.bytes("checkpoint.json")).unwrap();
        }
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        assert!(!f.path("checkpoint.tmp").exists());
        assert_eq!(
            success(&h.inspect_intent(&inspect(None), &mut Guard::allow()))["coverage"]["last"],
            127
        );
        success(&h.revise_intent(&q, &mut Guard::allow()));
        assert!(f.bytes("trace.jsonl").starts_with(&prefix));
        assert_eq!(
            success(&h.inspect_intent(&inspect(None), &mut Guard::allow()))["coverage"]["last"],
            128
        );
        error(
            &h.revise_intent(&revise(129, "full", None), &mut Guard::allow()),
            OpeningError::Unsupported,
        );
    }
}
// Builds positive byte-bound history only through production dispatch. The next
// record has unchanged two-digit sequence/reference/key widths; tune exact text
// using the observed production record length, not a forged accepted prefix.
fn byte_boundary(f: &Fixture) -> (u64, Vec<u8>) {
    let mut h = f.start();
    let maxwhat = format!("x{}", "\0".repeat(65_535));
    let maxwhy = "\0".repeat(65_536);
    let encoded = 1 + 6 * (131_072 - 1);
    let mut seq = 2;
    let mut last_len = 0;
    loop {
        let len = f.bytes("trace.jsonl").len();
        if last_len > 0 && CAP - len <= last_len {
            break;
        }
        let before = len;
        success(&h.revise_intent(&revise(seq, &maxwhat, Some(&maxwhy)), &mut Guard::allow()));
        last_len = f.bytes("trace.jsonl").len() - before;
        seq += 1;
    }
    assert!((12..90).contains(&seq));
    let remaining = CAP - f.bytes("trace.jsonl").len();
    let overhead = last_len - encoded;
    let target = remaining - overhead;
    let nulls = (target - 1) / 6;
    let plain = (target - 1) % 6;
    let mut text = format!("x{}{}", "\0".repeat(nulls), "a".repeat(plain));
    let why = if text.len() > 65_536 {
        text.split_off(65_536)
    } else {
        String::new()
    };
    assert!(why.len() <= 65_536);
    let q = revise(seq, &text, Some(&why));
    drop(h);
    (seq, q)
}
#[test]
fn byte_equality_empty_partial_full_recovery_and_impossible_pending() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for cut in [
        "reserve:directory:synced",
        "append:trace.jsonl:short_written",
        "checkpoint:checkpoint.tmp:synced",
    ] {
        let f = Fixture::new();
        let (seq, q) = byte_boundary(&f);
        let prefix = f.bytes("trace.jsonl");
        assert_eq!(
            f.child("mutate", Some(&q), Some(cut), cut.contains("short_written"))
                .code(),
            Some(73)
        );
        if !f.path("checkpoint.tmp").exists() {
            fs::write(f.path("checkpoint.tmp"), f.bytes("checkpoint.json")).unwrap();
        }
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        let v = success(&h.inspect_intent(&inspect(Some(2)), &mut Guard::allow()));
        assert_eq!(v["progress"], "blocked_pending");
        let peak = heap_peak(|| {
            delivered(h.revise_intent(&q, &mut Guard::allow()));
        });
        eprintln!("BYTE_RECOVERY {cut} peak_heap={peak} {:?}", h.work());
        assert_eq!(f.bytes("trace.jsonl").len(), CAP);
        assert!(f.bytes("trace.jsonl").starts_with(&prefix));
        for at in [Some(1), Some(seq / 2), None] {
            let q = inspect(at);
            let peak = heap_peak(|| {
                delivered(h.inspect_intent(&q, &mut Guard::allow()));
            });
            assert_eq!(h.work().passes, 2);
            assert_eq!(h.work().trace_read_bytes, 2 * CAP as u64);
            assert!(peak < 40_000_000);
            eprintln!("BYTE_BOUND_WORK {at:?} peak_heap={peak} {:?}", h.work());
        }
        let peak = heap_peak(|| {
            assert_eq!(
                h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
                RESULT.as_bytes()
            );
        });
        assert_eq!(h.work().passes, 2);
        eprintln!("BYTE_ORIGIN_RETRY peak_heap={peak} {:?}", h.work());
        let peak = heap_peak(|| {
            delivered(h.revise_intent(&q, &mut Guard::allow()));
        });
        assert_eq!(h.work().passes, 2);
        eprintln!("BYTE_REVISION_RETRY peak_heap={peak} {:?}", h.work());
        let next = revise(seq + 1, "overflow", None);
        let control = f.bytes("checkpoint.json");
        error(
            &h.revise_intent(&next, &mut Guard::allow()),
            OpeningError::Unsupported,
        );
        assert_eq!(f.bytes("checkpoint.json"), control);
        drop(h);
        if cut == "checkpoint:checkpoint.tmp:synced" {
            // Construct candidate through a separate fresh profile with the same
            // logical sequence. No copy/enrollment of authoritative custody.
            let other = Fixture::new();
            let mut h = other.start();
            append_history(&mut h, seq);
            success(&h.revise_intent(&next, &mut Guard::allow()));
            drop(h);
            let bytes = other.bytes("trace.jsonl");
            let candidate = bytes.split_inclusive(|b| *b == b'\n').next_back().unwrap();
            impossible_matrix(&f, seq, candidate, &next);
            let base = checkpoint(&f);
            fs::write(f.path("checkpoint.tmp"), reserve_control(&base, &next)).unwrap();
            f.blocked();
            assert!(f.path("checkpoint.tmp").exists());
        }
    }
}
#[test]
fn profile_writer_physical_custody_and_damage() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    append_history(&mut h, 4);
    assert!(matches!(
        f.host(OpeningMode::Reopen, None),
        Err(OpeningError::Unavailable)
    ));
    drop(h);
    assert!(matches!(
        OpeningHost::connect(f.slot(), OpeningMode::Reopen, &mut Guard::allow(), None),
        Err(OpeningError::Unavailable)
    ));
    assert!(matches!(
        f.host(OpeningMode::FreshProvision, None),
        Err(OpeningError::Unavailable)
    ));
    let old = Fixture::new();
    drop(
        OpeningHost::connect(
            old.slot(),
            OpeningMode::FreshProvision,
            &mut Guard::allow(),
            None,
        )
        .unwrap(),
    );
    assert!(matches!(
        old.host(OpeningMode::Reopen, None),
        Err(OpeningError::Unavailable)
    ));
    let original = f.bytes("trace.jsonl");
    let control = f.bytes("checkpoint.json");
    // Self-consistent hashes cannot authorize forged result/predecessor or duplicate keys.
    for changed in [
        String::from_utf8(original.clone())
            .unwrap()
            .replace("same exact text", "changed accepted text"),
        String::from_utf8(original.clone()).unwrap().replacen(
            "\"result\":\"change-1:op:3\"",
            "\"result\":\"change-1:op:2\"",
            1,
        ),
        String::from_utf8(original.clone())
            .unwrap()
            .replace("r003", "r002"),
        String::from_utf8(original.clone())
            .unwrap()
            .replace("\"seq\":3", "\"seq\":4"),
        String::from_utf8(original.clone())
            .unwrap()
            .replace("\"prev\":\"change-1:op:2\"", "\"prev\":\"change-1:origin\""),
    ] {
        let bytes = changed.into_bytes();
        fs::write(f.path("trace.jsonl"), &bytes).unwrap();
        let cp = if bytes.windows(21).any(|b| b == b"changed accepted text") {
            control.clone()
        } else {
            accepted_control(std::str::from_utf8(&control).unwrap(), 4, &bytes)
        };
        fs::write(f.path("checkpoint.json"), cp).unwrap();
        f.blocked();
    }
    fs::write(f.path("trace.jsonl"), &original).unwrap();
    fs::write(f.path("checkpoint.json"), &control).unwrap();
    let mut truncated = original.clone();
    truncated.truncate(truncated.len() / 2);
    fs::write(f.path("trace.jsonl"), truncated).unwrap();
    f.blocked();
    fs::write(f.path("trace.jsonl"), &original).unwrap();
    for name in [
        "checkpoint.json",
        "incident.json",
        "trace.jsonl",
        "writer.lock",
    ] {
        let bytes = f.bytes(name);
        fs::remove_file(f.path(name)).unwrap();
        f.blocked();
        fs::write(f.path(name), bytes).unwrap();
        if name == "writer.lock" {
            return;
        } // permanent inode replacement is independently refused
    }
}
#[test]
fn unknown_symlink_copy_and_control_tags_refuse() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for what in [
        "unknown",
        "symlink",
        "copy",
        "tag",
        "incident_tmp",
        "anchor_tmp",
    ] {
        let f = Fixture::new();
        let mut h = f.start();
        append_history(&mut h, 3);
        drop(h);
        match what {
            "unknown" => {
                fs::write(f.path("unknown"), b"").unwrap();
            }
            "symlink" => {
                let p = f.path("checkpoint.json");
                fs::rename(&p, f.0.join("saved")).unwrap();
                symlink(f.0.join("saved"), p).unwrap();
            }
            "copy" => {
                let moved = f.0.join("old");
                fs::rename(f.0.join("slot"), &moved).unwrap();
                fs::create_dir(f.0.join("slot")).unwrap();
                for n in [
                    "writer.lock",
                    "trace.jsonl",
                    "checkpoint.json",
                    "incident.json",
                ] {
                    fs::copy(moved.join(n), f.path(n)).unwrap();
                }
            }
            "tag" => {
                let c = checkpoint(&f).replace("ck-intent-prefix@2", "ck-opening-prefix@1");
                fs::write(f.path("checkpoint.json"), c).unwrap();
            }
            "incident_tmp" => {
                fs::write(f.path("incident.tmp"), f.bytes("incident.json")).unwrap();
            }
            "anchor_tmp" => {
                fs::write(
                    f.0.join("anchor.tmp"),
                    fs::read(f.0.join("anchor.json")).unwrap(),
                )
                .unwrap();
            }
            _ => unreachable!(),
        }
        f.blocked();
    }
}
#[test]
fn cleanup_relationships_cuts_and_monotonic_observed_faults() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for last in [0, 4] {
        for relation in ["equal", "reserve", "partial", "unrelated", "backward"] {
            let f = Fixture::new();
            let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
            if last > 0 {
                success(&h.open_change(OPEN.as_bytes(), &mut Guard::allow()));
                append_history(&mut h, last);
            }
            drop(h);
            let base = checkpoint(&f);
            let q = if last == 0 {
                OPEN.as_bytes().to_vec()
            } else {
                revise(last + 1, "temporary", None)
            };
            let bytes = match relation {
                "equal" => base.as_bytes().to_vec(),
                "reserve" => reserve_control(&base, &q),
                "partial" => base.as_bytes()[..base.len() / 2].to_vec(),
                "unrelated" => base.replace("custody-1", "other").into_bytes(),
                "backward" => base
                    .replace(&format!("\"generation\":{last}"), "\"generation\":0")
                    .replace("\"end\":0", "\"end\":1")
                    .into_bytes(),
                _ => unreachable!(),
            };
            fs::write(f.path("checkpoint.tmp"), &bytes).unwrap();
            if matches!(relation, "equal" | "reserve") {
                let mut h = f.host(OpeningMode::Reopen, None).unwrap();
                assert!(!f.path("checkpoint.tmp").exists());
                assert_eq!(f.bytes("checkpoint.json"), base.as_bytes());
                if last == 0 {
                    success(&h.open_change(OPEN.as_bytes(), &mut Guard::allow()));
                } else {
                    success(&h.revise_intent(&q, &mut Guard::allow()));
                }
            } else {
                f.blocked();
                assert_eq!(f.bytes("checkpoint.tmp"), bytes);
            }
        }
    }
    for cut in [
        "recover:checkpoint.tmp:before_unlink",
        "recover:checkpoint.tmp:unlinked",
        "recover:directory:synced",
    ] {
        let f = Fixture::new();
        drop(f.start());
        let cp = f.bytes("checkpoint.json");
        fs::write(f.path("checkpoint.tmp"), cp).unwrap();
        let q = revise(2, "after cleanup", None);
        assert_eq!(
            f.child("mutate", Some(&q), Some(cut), false).code(),
            Some(73)
        );
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        success(&h.revise_intent(&q, &mut Guard::allow()));
        assert!(!f.path("checkpoint.tmp").exists());
    }
    let events = [
        (
            "append",
            "trace.jsonl",
            "before_write",
            OpeningIoFault::ShortWrite,
        ),
        ("append", "trace.jsonl", "before_sync", OpeningIoFault::Io),
        (
            "checkpoint",
            "checkpoint.tmp",
            "before_rename",
            OpeningIoFault::Io,
        ),
        ("reserve", "directory", "before_sync", OpeningIoFault::Io),
        (
            "recover",
            "checkpoint.tmp",
            "before_unlink",
            OpeningIoFault::Io,
        ),
        ("recover", "directory", "before_sync", OpeningIoFault::Io),
    ];
    for (phase, object, step, fault) in events {
        for fail_retention in [false, true] {
            let f = Fixture::new();
            let mut h = f.start();
            append_history(&mut h, 5);
            drop(h);
            // Keep selected I/O and failed-retention observations distinct;
            // an unavailable connection alone does not prove either hook ran.
            let observed = std::sync::Arc::new(Mutex::new((
                Vec::<OpeningIoEvent>::new(),
                Vec::<OpeningIoEvent>::new(),
            )));
            let make_hook = || {
                let observed = observed.clone();
                Box::new(move |e: OpeningIoEvent| {
                    if (e.phase, e.object, e.step) == (phase, object, step) {
                        observed.lock().unwrap().0.push(e);
                        fault
                    } else if fail_retention
                        && e.object == "incident.tmp"
                        && e.step == "before_write"
                    {
                        observed.lock().unwrap().1.push(e);
                        OpeningIoFault::Io
                    } else {
                        OpeningIoFault::Continue
                    }
                }) as OpeningIoHook
            };
            let selected_seen = || !observed.lock().unwrap().0.is_empty();
            let retention_seen = || !observed.lock().unwrap().1.is_empty();
            let diagnostic = || {
                format!(
                "slot={:?}; selected={:?}; failed_retention={fail_retention} at {:?}; observed(selected, failed-retention)={:?}",
                f.0, (phase, object, step, fault),
                (phase, "incident.tmp", "before_write", OpeningIoFault::Io), observed.lock().unwrap(),
            )
            };
            let mut trigger = "dispatch";
            let mut h = f.host(OpeningMode::Reopen, Some(make_hook()));
            if phase == "recover" {
                trigger = "initial recovery connection";
                if h.is_ok() {
                    assert!(
                        !selected_seen() && !retention_seen(),
                        "successful recovery setup already invoked a fault; {}",
                        diagnostic()
                    );
                    // The before-unlink hook needs a real cleanup temporary.
                    // This follows successful setup, not a retry of a refusal.
                    drop(h);
                    fs::write(f.path("checkpoint.tmp"), f.bytes("checkpoint.json")).unwrap();
                    trigger = "temporary recovery connection";
                    h = f.host(OpeningMode::Reopen, Some(make_hook()));
                }
                assert!(
                    selected_seen(),
                    "{trigger} refused/returned before selected hook: error={:?}; {}",
                    h.as_ref().err(),
                    diagnostic(),
                );
                assert!(
                    h.is_err(),
                    "{trigger} succeeded after injected I/O; {}",
                    diagnostic()
                );
            } else {
                assert!(
                    h.is_ok(),
                    "hooked connection refused before non-recovery dispatch: error={:?}; {}",
                    h.as_ref().err(),
                    diagnostic(),
                );
                assert!(
                    !selected_seen() && !retention_seen(),
                    "non-recovery hook ran during connection setup; {}",
                    diagnostic()
                );
            }
            match h {
                Ok(mut h) => {
                    let reply = h.revise_intent(&revise(6, "fault", None), &mut Guard::allow());
                    assert!(
                        selected_seen(),
                        "dispatch never reached selected hook; {}",
                        diagnostic()
                    );
                    assert_eq!(reply, OpeningError::Unavailable.json(), "{}", diagnostic());
                    assert_eq!(
                        h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
                        OpeningError::Unavailable.json(),
                        "live latch opening; {}",
                        diagnostic()
                    );
                    assert_eq!(
                        h.inspect_intent(&inspect(None), &mut Guard::allow()),
                        OpeningError::Unavailable.json(),
                        "live latch inspection; {}",
                        diagnostic()
                    );
                    drop(h);
                }
                Err(error) => {
                    assert_eq!(
                        phase,
                        "recover",
                        "unexpected connection failure; {}",
                        diagnostic()
                    );
                    assert_eq!(
                        error,
                        OpeningError::Unavailable,
                        "{trigger}; {}",
                        diagnostic()
                    );
                }
            }
            assert!(
                selected_seen(),
                "selected fault not reached; {}",
                diagnostic()
            );
            assert_eq!(
                retention_seen(),
                fail_retention,
                "failed-retention hook attribution; {}",
                diagnostic()
            );
            eprintln!("FAULT_WITNESS trigger={trigger}; {}", diagnostic());
            assert!(
                f.path("incident.tmp").exists()
                    || String::from_utf8(f.bytes("incident.json"))
                        .unwrap()
                        .contains("blocked"),
                "incident evidence missing after proven fault; {}",
                diagnostic(),
            );
            f.blocked();
        }
    }
}
// Scoped allocation probe for the concrete whole-call live-memory risk. Counts
// requested heap bytes in this test thread only; allocator bookkeeping, stack,
// filesystem/kernel buffers, and preexisting host/request allocations excluded.
// Payload ownership survives scope exit; tagged deallocations cannot subtract
// from later scopes. No production allocator or additional dependency is used.
struct HeapProbe;
#[derive(Clone, Copy)]
struct Header {
    scope: usize,
}
thread_local! {static HEAP:std::cell::Cell<(usize,usize,usize)>=const {std::cell::Cell::new((0,0,0))};}
static SCOPE: AtomicUsize = AtomicUsize::new(1);
#[global_allocator]
static ALLOCATOR: HeapProbe = HeapProbe;
// SAFETY: System owns all allocations. Extended layouts preserve payload
// alignment and retain the identical base/offset/layout for deallocation.
unsafe impl std::alloc::GlobalAlloc for HeapProbe {
    unsafe fn alloc(&self, layout: std::alloc::Layout) -> *mut u8 {
        let (full, offset) = std::alloc::Layout::new::<Header>().extend(layout).unwrap();
        // SAFETY: valid extended layout delegated to System.
        let base = unsafe { std::alloc::GlobalAlloc::alloc(&std::alloc::System, full) };
        if base.is_null() {
            return base;
        }
        let mut scope = 0;
        let _ = HEAP.try_with(|c| {
            let (id, live, peak) = c.get();
            scope = id;
            if id != 0 {
                let live = live + layout.size();
                c.set((id, live, peak.max(live)));
            }
        });
        // SAFETY: header and payload lie within aligned allocation.
        unsafe {
            base.cast::<Header>().write(Header { scope });
            base.add(offset)
        }
    }
    unsafe fn dealloc(&self, p: *mut u8, layout: std::alloc::Layout) {
        let (full, offset) = std::alloc::Layout::new::<Header>().extend(layout).unwrap();
        // SAFETY: caller supplies this allocation's original payload/layout.
        let base = unsafe { p.sub(offset) };
        let header = unsafe { base.cast::<Header>().read() };
        let _ = HEAP.try_with(|c| {
            let (id, live, peak) = c.get();
            if id != 0 && id == header.scope {
                c.set((id, live - layout.size(), peak));
            }
        });
        // SAFETY: original System allocation and its extended layout.
        unsafe { std::alloc::GlobalAlloc::dealloc(&std::alloc::System, base, full) };
    }
}
fn heap_peak(f: impl FnOnce()) -> usize {
    HEAP.with(|c| c.set((SCOPE.fetch_add(1, Ordering::Relaxed), 0, 0)));
    f();
    HEAP.with(|c| {
        let (_, _, peak) = c.get();
        c.set((0, 0, 0));
        peak
    })
}
#[test]
fn whole_call_cost_128_records_and_ordinary_vs_cleanup_mutation() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    append_history(&mut h, 127);
    let q = revise(128, "bounded final operation", None);
    let peak = heap_peak(|| {
        delivered(h.revise_intent(&q, &mut Guard::allow()));
    });
    let w = h.work();
    assert_eq!(w.passes, 3);
    assert_eq!(w.record_decodes, 127 + 128 + 128);
    assert_eq!(w.trace_buffers_peak, 2);
    eprintln!("COUNT_NEW peak_heap={peak} {w:?}");
    for at in [Some(1), Some(64), None] {
        let q = inspect(at);
        let peak = heap_peak(|| {
            delivered(h.inspect_intent(&q, &mut Guard::allow()));
        });
        let w = h.work();
        assert_eq!(w.passes, 2);
        assert_eq!(w.record_decodes, 256);
        assert_eq!(w.accepted_hash_bytes, w.trace_read_bytes);
        assert_eq!(w.trace_buffers_peak, 2);
        assert!(peak < 2_000_000);
        eprintln!("COUNT_QUERY {at:?} peak_heap={peak} {w:?}");
    }
    let peak = heap_peak(|| {
        assert_eq!(
            h.open_change(OPEN.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
    });
    assert_eq!(h.work().passes, 2);
    eprintln!("COUNT_ORIGIN_RETRY peak_heap={peak} {:?}", h.work());
    let peak = heap_peak(|| {
        delivered(h.revise_intent(&q, &mut Guard::allow()));
    });
    assert_eq!(h.work().passes, 2);
    eprintln!("COUNT_REVISION_RETRY peak_heap={peak} {:?}", h.work());
    drop(h);
    let f = Fixture::new();
    let mut h = f.start();
    append_history(&mut h, 10);
    fs::write(f.path("checkpoint.tmp"), f.bytes("checkpoint.json")).unwrap();
    let peak = heap_peak(|| {
        success(&h.revise_intent(&revise(11, "cleanup admission", None), &mut Guard::allow()));
    });
    assert_eq!(h.work().passes, 4);
    assert_eq!(h.work().record_decodes, 10 + 10 + 11 + 11);
    eprintln!("CLEANUP_NEW peak_heap={peak} {:?}", h.work());
    fs::write(f.path("checkpoint.tmp"), f.bytes("checkpoint.json")).unwrap();
    let peak = heap_peak(|| {
        success(&h.inspect_intent(&inspect(Some(2)), &mut Guard::allow()));
    });
    assert_eq!(h.work().passes, 3);
    eprintln!("CLEANUP_QUERY peak_heap={peak} {:?}", h.work());
}

fn delivered(response: Vec<u8>) {
    assert!(
        !response.windows(6).any(|s| s == b"\"code\""),
        "{}",
        String::from_utf8_lossy(&response)
    );
}
#[test]
fn discriminant_last_cannot_hide_bad_presence_or_types() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    for (v, op) in [
        (3, "revise_intent"),
        (2, "unknown"),
        (1, "revise_intent"),
        (2, "open_change"),
    ] {
        for extra in [
            "",
            ",\"why\":null",
            ",\"why\":null,\"why\":null",
            ",\"why\":[]",
            ",\"foreign\":null",
        ] {
            for last in [false, true] {
                let discriminants = format!("\"v\":{v},\"op\":\"{op}\"");
                let fields=format!("\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"r002\",\"expected_intent\":\"change-1:origin\",\"what\":\"x\"{extra}");
                let q = if last {
                    format!("{{{fields},{discriminants}}}")
                } else {
                    format!("{{{discriminants},{fields}}}")
                };
                for dispatch in 0..3 {
                    let r = match dispatch {
                        0 => h.open_change(q.as_bytes(), &mut Guard::allow()),
                        1 => h.revise_intent(q.as_bytes(), &mut Guard::allow()),
                        _ => h.inspect_intent(q.as_bytes(), &mut Guard::allow()),
                    };
                    error(&r, OpeningError::InvalidInput);
                    assert_eq!(h.work().passes, 0);
                }
            }
        }
    }
    for bad in [
        "change-1:op:1",
        "change-1:op:02",
        "change-1:op:129",
        "change-1:op:2:extra",
        "change-1:origin:extra",
        "change-1:op:+2",
        "change-1:op:0",
    ] {
        let q = String::from_utf8(revise(2, "x", None))
            .unwrap()
            .replace("change-1:origin", bad);
        error(
            &h.revise_intent(q.as_bytes(), &mut Guard::allow()),
            OpeningError::InvalidInput,
        );
    }
    for q in [
        String::from_utf8(inspect(None))
            .unwrap()
            .replace("\"at\":null", "\"at\":[]"),
        String::from_utf8(inspect(None))
            .unwrap()
            .replace(",\"at\":null", ""),
        String::from_utf8(inspect(None))
            .unwrap()
            .replace("\"at\":null", "\"at\":null,\"at\":null"),
    ] {
        error(
            &h.inspect_intent(q.as_bytes(), &mut Guard::allow()),
            OpeningError::InvalidInput,
        );
    }
}
#[test]
fn installed_pending_feasibility_and_control_discriminants() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    append_history(&mut h, 3);
    drop(h);
    let base = checkpoint(&f);
    let trace = f.bytes("trace.jsonl");
    let q = revise(4, "next", None);
    let pending = String::from_utf8(reserve_control(&base, &q)).unwrap();
    for bad in [
        pending.replace("\"actor\":\"owner-1\"", "\"actor\":\"other\""),
        pending.replace("change-1:op:3", "change-1:origin"),
        pending.replace("r004", "r002"),
        pending.replace(
            "\"workspace_id\":\"workspace-1\"",
            "\"workspace_id\":\"other\"",
        ),
        pending.replace(",\"why\":null", ""),
        pending.replace("\"why\":null", "\"why\":[]"),
    ] {
        if bad == pending {
            continue;
        }
        fs::write(f.path("checkpoint.json"), bad.as_bytes()).unwrap();
        fs::write(f.path("checkpoint.tmp"), bad.as_bytes()).unwrap();
        f.blocked();
        assert_eq!(f.bytes("trace.jsonl"), trace);
        assert_eq!(f.bytes("checkpoint.tmp"), bad.as_bytes());
        fs::remove_file(f.path("checkpoint.tmp")).unwrap();
    }
    fs::write(f.path("checkpoint.json"), pending).unwrap();
    let mut mismatched = trace.clone();
    mismatched.extend_from_slice(b"wrong pending suffix");
    fs::write(f.path("trace.jsonl"), &mismatched).unwrap();
    f.blocked();
    assert_eq!(f.bytes("trace.jsonl"), mismatched);
    fs::write(f.path("checkpoint.json"), base).unwrap();
    fs::write(f.path("trace.jsonl"), trace).unwrap();
    for (path, from, to) in [
        (
            f.path("incident.json"),
            "ck-intent-incident@2",
            "ck-opening-incident@1",
        ),
        (
            f.0.join("anchor.json"),
            "ck-intent-anchor@2",
            "ck-opening-anchor@1",
        ),
    ] {
        let original = fs::read(&path).unwrap();
        let bad = String::from_utf8(original.clone())
            .unwrap()
            .replace(from, to);
        fs::write(&path, bad).unwrap();
        f.blocked();
        fs::write(path, original).unwrap();
    }
}
#[test]
fn trace_total_bound_and_empty_change_admission() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.host(OpeningMode::FreshProvision, None).unwrap();
    let initial = f.bytes("checkpoint.json");
    error(
        &h.revise_intent(&revise(2, "not opened", None), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    error(
        &h.inspect_intent(&inspect(None), &mut Guard::allow()),
        OpeningError::Unavailable,
    );
    assert_eq!(f.bytes("checkpoint.json"), initial);
    assert!(f.bytes("trace.jsonl").is_empty());
    success(&h.open_change(OPEN.as_bytes(), &mut Guard::allow()));
    drop(h);
    let mut trace = f.bytes("trace.jsonl");
    trace.resize(17_825_792, b'x');
    fs::write(f.path("trace.jsonl"), &trace).unwrap();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let v = success(&h.inspect_intent(&inspect(None), &mut Guard::allow()));
    assert_eq!(v["progress"], "blocked_unaccepted_tail");
    drop(h);
    trace.push(b'x');
    fs::write(f.path("trace.jsonl"), &trace).unwrap();
    f.blocked();
    assert_eq!(f.bytes("trace.jsonl"), trace);
}

#[test]
fn accounting_includes_incident_retention_and_constructed_controls() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for fault in [OpeningIoFault::Io, OpeningIoFault::ShortWrite] {
        for fail_retention in [false, true] {
            let f = Fixture::new();
            let mut h = f.start();
            append_history(&mut h, 4);
            drop(h);
            let trace = f.bytes("trace.jsonl");
            let checkpoint_len = f.bytes("checkpoint.json").len();
            let incident = f.bytes("incident.json");
            let anchor_len = fs::read(f.0.join("anchor.json")).unwrap().len();
            let creates = std::sync::Arc::new(AtomicUsize::new(0));
            let observed = creates.clone();
            let selected = std::sync::Arc::new(AtomicUsize::new(0));
            let selected_hook = selected.clone();
            let failed_retention = std::sync::Arc::new(AtomicUsize::new(0));
            let retention_hook = failed_retention.clone();
            let diagnostic = || {
                format!(
                "slot={:?}; selected={:?}; fail_retention={fail_retention} at {:?}; observed(selected, failed-retention, control creates)=({},{},{})",
                f.0, ("append", "trace.jsonl", "before_write", fault),
                ("append", "incident.tmp", "before_write", OpeningIoFault::Io),
                selected.load(Ordering::Relaxed), failed_retention.load(Ordering::Relaxed), creates.load(Ordering::Relaxed),
            )
            };
            let hook: OpeningIoHook = Box::new(move |e| {
                if matches!(e.object, "checkpoint.tmp" | "incident.tmp")
                    && e.step == "before_create"
                {
                    observed.fetch_add(1, Ordering::Relaxed);
                }
                if e.phase == "append" && e.object == "trace.jsonl" && e.step == "before_write" {
                    selected_hook.fetch_add(1, Ordering::Relaxed);
                    fault
                } else if fail_retention && e.object == "incident.tmp" && e.step == "before_write" {
                    retention_hook.fetch_add(1, Ordering::Relaxed);
                    OpeningIoFault::Io
                } else {
                    OpeningIoFault::Continue
                }
            });
            let mut h = f
                .host(OpeningMode::Reopen, Some(hook))
                .unwrap_or_else(|error| {
                    panic!(
                        "accounting connection refused before dispatch: {error:?}; {}",
                        diagnostic()
                    )
                });
            let q = revise(5, "accounted fault", None);
            let mut reply = Vec::new();
            let peak = heap_peak(|| {
                reply = h.revise_intent(&q, &mut Guard::allow());
            });
            assert_eq!(
                selected.load(Ordering::Relaxed),
                1,
                "selected accounting fault not reached; {}",
                diagnostic()
            );
            assert_eq!(
                failed_retention.load(Ordering::Relaxed),
                usize::from(fail_retention),
                "failed-retention accounting hook; {}",
                diagnostic()
            );
            eprintln!("ACCOUNT_FAULT_WITNESS {}", diagnostic());
            assert_eq!(reply, OpeningError::Unavailable.json(), "{}", diagnostic());
            let w = h.work();
            // Preflight anchor/clear incident/original prefix, installed pending
            // reread, then clear incident reread for monotonic failure retention.
            let pending_len = f.bytes("checkpoint.json").len();
            assert_eq!(
                w.control_read_bytes,
                (anchor_len + checkpoint_len + pending_len + 2 * incident.len()) as u64
            );
            assert_eq!(w.trace_read_bytes, trace.len() as u64);
            assert_eq!((w.control_decode_attempts, w.control_decodes), (5, 5));
            assert_eq!(
                (w.control_reemission_attempts, w.control_reemissions),
                (5, 5)
            );
            assert_eq!(
                (
                    w.constructed_control_attempts,
                    w.constructed_control_emissions
                ),
                (2, 2)
            );
            assert_eq!(creates.load(Ordering::Relaxed), 2);
            assert_eq!(
                (
                    w.constructed_record_attempts,
                    w.constructed_record_emissions
                ),
                (2, 2)
            );
            assert_eq!((w.request_decode_attempts, w.request_decodes), (1, 1));
            assert_eq!(
                (
                    w.reply_emission_attempts,
                    w.reply_emissions,
                    w.error_replies,
                    w.discarded_replies
                ),
                (1, 1, 1, 0)
            );
            assert_eq!((w.passes, w.validated_prefixes), (1, 1));
            assert_eq!(
                (
                    w.record_decode_attempts,
                    w.record_decodes,
                    w.record_reemission_attempts,
                    w.record_reemissions
                ),
                (4, 4, 4, 4)
            );
            if fail_retention {
                assert_eq!(f.bytes("incident.json"), incident, "{}", diagnostic());
                assert!(f.path("incident.tmp").exists(), "{}", diagnostic());
            } else {
                let retained: serde_json::Value =
                    serde_json::from_slice(&f.bytes("incident.json")).unwrap();
                assert_eq!(retained["state"], "blocked", "{}", diagnostic());
                assert_eq!(retained["phase"], "append", "{}", diagnostic());
            }
            if fault == OpeningIoFault::Io {
                assert_eq!(f.bytes("trace.jsonl"), trace);
            }
            eprintln!("ACCOUNT_INCIDENT {fault:?} retention_failed={fail_retention} peak_heap={peak} {w:?}");
            // A later latched dispatch does not replay old work or try retention.
            error(
                &h.inspect_intent(&inspect(None), &mut Guard::allow()),
                OpeningError::Unavailable,
            );
            let w = h.work();
            assert_eq!(
                (w.reply_emissions, w.error_replies, w.request_decodes),
                (1, 1, 1)
            );
            assert_eq!(
                (
                    w.passes,
                    w.control_read_bytes,
                    w.constructed_control_emissions
                ),
                (0, 0, 0)
            );
            drop(h);
            f.blocked();
        }
    }
}

#[test]
fn accounting_errors_and_discarded_replies_at_dispatch_boundaries() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    let mut h = f.start();
    for (q, permission, expected, decoded) in [
        (
            b"not-json\n".to_vec(),
            OpeningPermission::Allow,
            OpeningError::InvalidInput,
            0,
        ),
        (
            LEGACY.as_bytes().to_vec(),
            OpeningPermission::Allow,
            OpeningError::Unsupported,
            1,
        ),
        (
            String::from_utf8(inspect(None))
                .unwrap()
                .replace("workspace-1", "other")
                .into_bytes(),
            OpeningPermission::Allow,
            OpeningError::Denied,
            1,
        ),
        (
            inspect(None),
            OpeningPermission::Deny,
            OpeningError::Denied,
            1,
        ),
        (
            inspect(None),
            OpeningPermission::Unavailable,
            OpeningError::Unavailable,
            1,
        ),
    ] {
        let mut g = Guard {
            permission,
            ..Guard::allow()
        };
        let mut reply = Vec::new();
        let peak = heap_peak(|| {
            reply = h.inspect_intent(&q, &mut g);
        });
        error(&reply, expected);
        let w = h.work();
        assert_eq!((w.request_decode_attempts, w.request_decodes), (1, decoded));
        assert_eq!(
            (
                w.reply_emission_attempts,
                w.reply_emissions,
                w.error_replies,
                w.discarded_replies
            ),
            (1, 1, 1, 0)
        );
        assert_eq!(
            (
                w.passes,
                w.control_read_bytes,
                w.constructed_control_emissions
            ),
            (0, 0, 0)
        );
        eprintln!("ACCOUNT_EARLY {expected:?} peak_heap={peak} {w:?}");
    }
    let trace = f.bytes("trace.jsonl");
    let checkpoint = f.bytes("checkpoint.json");
    for final_permission in [OpeningPermission::Deny, OpeningPermission::Unavailable] {
        for retry in [false, true] {
            let mut g = Guard {
                final_permission: Some(final_permission),
                ..Guard::allow()
            };
            let q = inspect(None);
            let mut reply = Vec::new();
            let peak = heap_peak(|| {
                reply = if retry {
                    h.open_change(OPEN.as_bytes(), &mut g)
                } else {
                    h.inspect_intent(&q, &mut g)
                };
            });
            error(
                &reply,
                if final_permission == OpeningPermission::Deny {
                    OpeningError::Denied
                } else {
                    OpeningError::Unavailable
                },
            );
            let w = h.work();
            assert_eq!(
                (
                    w.reply_emission_attempts,
                    w.reply_emissions,
                    w.error_replies,
                    w.discarded_replies
                ),
                (2, 2, 1, 1)
            );
            assert_eq!((w.passes, w.validated_prefixes), (2, 2));
            assert_eq!(w.constructed_control_emissions, 0);
            assert_eq!(f.bytes("trace.jsonl"), trace);
            assert_eq!(f.bytes("checkpoint.json"), checkpoint);
            eprintln!("ACCOUNT_FINAL retry={retry} {final_permission:?} peak_heap={peak} {w:?}");
        }
    }
    let q = revise(2, "retained despite denied disclosure", None);
    let mut g = Guard {
        final_permission: Some(OpeningPermission::Deny),
        ..Guard::allow()
    };
    let mut reply = Vec::new();
    let peak = heap_peak(|| {
        reply = h.revise_intent(&q, &mut g);
    });
    error(&reply, OpeningError::Denied);
    let w = h.work();
    assert_eq!(
        (
            w.reply_emission_attempts,
            w.reply_emissions,
            w.error_replies,
            w.discarded_replies
        ),
        (2, 2, 1, 1)
    );
    assert_eq!(
        (
            w.constructed_control_attempts,
            w.constructed_control_emissions
        ),
        (2, 2)
    );
    assert_eq!(
        (
            w.control_decode_attempts,
            w.control_decodes,
            w.control_reemission_attempts,
            w.control_reemissions
        ),
        (10, 10, 10, 10)
    );
    assert_eq!((w.passes, w.validated_prefixes), (3, 3));
    eprintln!("ACCOUNT_COMMITTED_DENIAL peak_heap={peak} {w:?}");
    drop(h);
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert_eq!(success(&h.revise_intent(&q, &mut Guard::allow()))["seq"], 2);
    assert_eq!(
        (
            h.work().reply_emissions,
            h.work().error_replies,
            h.work().discarded_replies,
            h.work().constructed_control_emissions
        ),
        (1, 0, 0, 0)
    );
}

#[test]
fn accounting_malformed_controls_do_not_claim_canonical_emission() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for variant in ["decode", "canonical", "emitter_limit"] {
        let f = Fixture::new();
        let mut h = f.start();
        let anchor_len = fs::read(f.0.join("anchor.json")).unwrap().len();
        let bad = match variant {
            "decode" => b"not-json\n".to_vec(),
            "canonical" => { let mut b = b" ".to_vec(); b.extend_from_slice(&f.bytes("incident.json")); b },
            // Typed decoding succeeds within the input limit, then canonical
            // long-control escaping exceeds the unchanged 1-MiB emitter bound.
            "emitter_limit" => format!("{{\"format\":\"ck-intent-incident@2\",\"custody\":\"custody-1\",\"state\":\"blocked\",\"phase\":\"{}\",\"issue\":\"io\"}}\n", "\\n".repeat(180_000)).into_bytes(),
            _ => unreachable!(),
        };
        fs::write(f.path("incident.json"), &bad).unwrap();
        let q = inspect(None);
        let mut reply = Vec::new();
        let peak = heap_peak(|| {
            reply = h.inspect_intent(&q, &mut Guard::allow());
        });
        error(&reply, OpeningError::Unavailable);
        let w = h.work();
        assert_eq!(w.control_read_bytes, (anchor_len + bad.len()) as u64);
        assert_eq!(w.control_decode_attempts, 2);
        assert_eq!(w.control_decodes, if variant == "decode" { 1 } else { 2 });
        assert_eq!(
            w.control_reemission_attempts,
            if variant == "decode" { 1 } else { 2 }
        );
        assert_eq!(
            w.control_reemissions,
            if variant == "canonical" { 2 } else { 1 }
        );
        assert_eq!(
            (w.passes, w.validated_prefixes, w.trace_read_bytes),
            (1, 0, 0)
        );
        assert_eq!(
            (
                w.constructed_control_attempts,
                w.constructed_control_emissions
            ),
            (0, 0)
        );
        assert_eq!(
            (w.reply_emissions, w.error_replies, w.discarded_replies),
            (1, 1, 0)
        );
        assert_eq!(f.bytes("incident.json"), bad);
        assert!(!f.path("incident.tmp").exists());
        eprintln!("ACCOUNT_BAD_CONTROL {variant} peak_heap={peak} {w:?}");
    }
}

#[test]
fn accounting_record_decode_and_emission_boundaries_are_distinct() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    for (seq, noncanonical) in [(1, false), (2, false), (1, true)] {
        let f = Fixture::new();
        let mut h = f.start();
        append_history(&mut h, 3);
        let original = f.bytes("trace.jsonl");
        let base = checkpoint(&f);
        let mut changed = Vec::new();
        for (i, line) in original.split_inclusive(|b| *b == b'\n').enumerate() {
            if i + 1 == seq {
                if noncanonical {
                    changed.push(b' ');
                    changed.extend_from_slice(line);
                } else {
                    changed.extend_from_slice(b"not-json\n");
                }
            } else {
                changed.extend_from_slice(line);
            }
        }
        fs::write(f.path("trace.jsonl"), &changed).unwrap();
        fs::write(
            f.path("checkpoint.json"),
            accepted_control(&base, 3, &changed),
        )
        .unwrap();
        let q = inspect(None);
        let mut reply = Vec::new();
        let peak = heap_peak(|| {
            reply = h.inspect_intent(&q, &mut Guard::allow());
        });
        error(&reply, OpeningError::Unavailable);
        let w = h.work();
        assert_eq!(w.record_decode_attempts, seq as u64);
        assert_eq!(
            w.record_decodes,
            if noncanonical { 1 } else { seq as u64 - 1 }
        );
        assert_eq!(w.record_reemission_attempts, w.record_decodes);
        assert_eq!(w.record_reemissions, w.record_decodes);
        assert_eq!((w.passes, w.validated_prefixes), (1, 0));
        assert_eq!(w.accepted_hash_bytes, changed.len() as u64);
        assert_eq!(
            (
                w.reply_emissions,
                w.error_replies,
                w.constructed_control_emissions
            ),
            (1, 1, 0)
        );
        assert_eq!(f.bytes("trace.jsonl"), changed);
        eprintln!(
            "ACCOUNT_BAD_RECORD seq={seq} noncanonical={noncanonical} peak_heap={peak} {w:?}"
        );
    }
}

#[test]
fn accounting_delivery_uncertainty_counts_discard_and_incident() {
    let _custody = CUSTODY_TEST.lock().expect("previous custody test failed");
    let f = Fixture::new();
    drop(f.start());
    let trace_len = f.bytes("trace.jsonl").len();
    let checkpoint_len = f.bytes("checkpoint.json").len();
    let incident_len = f.bytes("incident.json").len();
    let anchor_len = fs::read(f.0.join("anchor.json")).unwrap().len();
    let selected = std::sync::Arc::new(AtomicUsize::new(0));
    let observed = selected.clone();
    let diagnostic = || {
        format!(
            "slot={:?}; selected={:?}; observed selected={}",
            f.0,
            ("deliver", "reply", "before", OpeningIoFault::Io),
            selected.load(Ordering::Relaxed),
        )
    };
    let hook: OpeningIoHook = Box::new(move |e| {
        if e.phase == "deliver" && e.object == "reply" && e.step == "before" {
            observed.fetch_add(1, Ordering::Relaxed);
            OpeningIoFault::Io
        } else {
            OpeningIoFault::Continue
        }
    });
    let mut h = f
        .host(OpeningMode::Reopen, Some(hook))
        .unwrap_or_else(|error| {
            panic!(
                "delivery connection refused before dispatch: {error:?}; {}",
                diagnostic()
            )
        });
    let q = inspect(None);
    let mut reply = Vec::new();
    let peak = heap_peak(|| {
        reply = h.inspect_intent(&q, &mut Guard::allow());
    });
    assert_eq!(
        selected.load(Ordering::Relaxed),
        1,
        "delivery fault not reached; {}",
        diagnostic()
    );
    eprintln!("DELIVERY_FAULT_WITNESS {}", diagnostic());
    assert_eq!(reply, OpeningError::Unavailable.json(), "{}", diagnostic());
    let w = h.work();
    assert_eq!(
        (
            w.reply_emission_attempts,
            w.reply_emissions,
            w.error_replies,
            w.discarded_replies
        ),
        (2, 2, 1, 1)
    );
    assert_eq!(
        (
            w.control_decode_attempts,
            w.control_decodes,
            w.control_reemission_attempts,
            w.control_reemissions
        ),
        (7, 7, 7, 7)
    );
    assert_eq!(
        (
            w.constructed_control_attempts,
            w.constructed_control_emissions
        ),
        (1, 1)
    );
    assert_eq!(
        w.control_read_bytes,
        (2 * (anchor_len + checkpoint_len + incident_len) + incident_len) as u64
    );
    assert_eq!(w.trace_read_bytes, (2 * trace_len) as u64);
    assert_eq!((w.passes, w.validated_prefixes), (2, 2));
    eprintln!("ACCOUNT_DELIVERY peak_heap={peak} {w:?}");
    drop(h);
    f.blocked();
}
