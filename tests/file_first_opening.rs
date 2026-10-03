#![cfg(target_os = "linux")]
use changekernel::{
    OpeningError, OpeningGuard, OpeningHost, OpeningIoEvent, OpeningIoFault, OpeningIoHook,
    OpeningMode, OpeningPermission, OpeningSlot,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    os::unix::fs::{symlink, DirBuilderExt},
    path::PathBuf,
    process::{Command, ExitStatus},
    sync::atomic::{AtomicUsize, Ordering},
};

const INPUT: &str = r#"{"v":1,"op":"open_change","workspace_id":"workspace-1","change":"change-1","key":"open-1","what":"  Café / cleanup  ","why":null}"#;
const INSPECT: &str =
    r#"{"v":1,"op":"inspect_change","workspace_id":"workspace-1","change":"change-1"}"#;
const RESULT: &str = "{\"v\":1,\"kind\":\"opened\",\"workspace_id\":\"workspace-1\",\"change\":\"change-1\",\"key\":\"open-1\",\"actor\":\"owner-1\",\"result\":\"change-1:origin\",\"seq\":1}\n";
static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());
static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let dir = std::env::temp_dir().join(format!(
            "ck-opening-{}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::DirBuilder::new().mode(0o700).create(&dir).unwrap();
        Self(dir)
    }
    fn slot(&self) -> OpeningSlot {
        OpeningSlot {
            directory: self.0.join("slot"),
            anchor: self.0.join("anchor.json"),
        }
    }
    fn path(&self, name: &str) -> PathBuf {
        self.0.join("slot").join(name)
    }
    fn host(
        &self,
        mode: OpeningMode,
        hook: Option<OpeningIoHook>,
    ) -> Result<OpeningHost, OpeningError> {
        OpeningHost::connect(self.slot(), mode, &mut Guard::allow(), hook)
    }
    fn provision(&self) {
        drop(self.host(OpeningMode::FreshProvision, None).unwrap());
    }
    fn opened(&self) {
        self.provision();
        let mut host = self.host(OpeningMode::Reopen, None).unwrap();
        assert_eq!(
            host.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
    }
    fn bytes(&self, name: &str) -> Vec<u8> {
        fs::read(self.path(name)).unwrap()
    }
    fn child(&self, action: &str, cut: Option<OpeningIoEvent>, short: bool) -> ExitStatus {
        // Parent owns no custody descriptors while spawning; children never fork a host.
        let mut cmd = Command::new(std::env::current_exe().unwrap());
        cmd.args(["--exact", "opening_process_entry", "--nocapture"])
            .env("CK_OPENING_ROOT", &self.0)
            .env("CK_OPENING_ACTION", action);
        if let Some(c) = cut {
            cmd.env(
                "CK_OPENING_CUT",
                format!("{}:{}:{}", c.phase, c.object, c.step),
            );
        }
        if short {
            cmd.env("CK_OPENING_SHORT", "1");
        }
        cmd.status().unwrap() // wait confirms exit before successor starts
    }
    fn blocked(&self) {
        match self.host(OpeningMode::Reopen, None) {
            Err(e) => assert_eq!(e, OpeningError::Unavailable),
            Ok(mut h) => assert_eq!(
                h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow()),
                OpeningError::Unavailable.json()
            ),
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
struct Guard {
    principal: &'static str,
    permission: OpeningPermission,
    final_permission: Option<OpeningPermission>,
    calls: usize,
}
impl Guard {
    fn allow() -> Self {
        Self {
            principal: "owner-1",
            permission: OpeningPermission::Allow,
            final_permission: None,
            calls: 0,
        }
    }
    fn denied() -> Self {
        Self {
            permission: OpeningPermission::Deny,
            ..Self::allow()
        }
    }
    fn unavailable() -> Self {
        Self {
            permission: OpeningPermission::Unavailable,
            ..Self::allow()
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
fn cut(phase: &'static str, object: &'static str, step: &'static str) -> OpeningIoEvent {
    OpeningIoEvent {
        phase,
        object,
        step,
    }
}
fn fail(
    at: OpeningIoEvent,
    fault: OpeningIoFault,
    retention: Option<OpeningIoEvent>,
) -> OpeningIoHook {
    Box::new(move |event| {
        if event == at || retention == Some(event) {
            fault
        } else {
            OpeningIoFault::Continue
        }
    })
}
fn inspection(h: &mut OpeningHost) -> serde_json::Value {
    serde_json::from_slice(&h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow())).unwrap()
}

#[test]
fn opening_process_entry() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let Some(root) = std::env::var_os("CK_OPENING_ROOT") else {
        return;
    };
    let slot = OpeningSlot {
        directory: PathBuf::from(&root).join("slot"),
        anchor: PathBuf::from(&root).join("anchor.json"),
    };
    let action = std::env::var("CK_OPENING_ACTION").unwrap();
    let stop = std::env::var("CK_OPENING_CUT").ok();
    let short = std::env::var_os("CK_OPENING_SHORT").is_some();
    let hook: OpeningIoHook = Box::new(move |e| {
        if stop.as_deref() == Some(&format!("{}:{}:{}", e.phase, e.object, e.step)) {
            std::process::exit(71);
        }
        if short && e.step == "before_write" && e.object == "trace.jsonl" && e.phase == "append" {
            OpeningIoFault::ShortWrite
        } else {
            OpeningIoFault::Continue
        }
    });
    let mode = match action.as_str() {
        "fresh" => OpeningMode::FreshProvision,
        "resume" => OpeningMode::ResumeProvision,
        _ => OpeningMode::Reopen,
    };
    let connected = OpeningHost::connect(slot, mode, &mut Guard::allow(), Some(hook));
    if action == "contender" {
        assert!(matches!(connected, Err(OpeningError::Unavailable)));
        return;
    }
    let mut host = connected.unwrap();
    if action == "fresh" || action == "resume" {
        return;
    }
    let view = inspection(&mut host);
    if action == "retry" {
        assert_eq!(view["kind"], "inspection");
        assert_eq!(view["origin"]["input"]["what"], "  Café / cleanup  ");
        assert!(view["origin"]["input"]["why"].is_null());
        assert_eq!(view["origin"]["result"]["actor"], "owner-1");
        assert_eq!(view["coverage"], serde_json::json!({"first":1,"last":1}));
    }
    assert_eq!(
        host.open_change(INPUT.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
}

#[test]
fn useful_open_inspect_writer_exit_fresh_process_exact_retry() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    {
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        assert_eq!(
            h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow()),
            OpeningError::Unavailable.json()
        );
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
        let v = inspection(&mut h);
        assert_eq!(
            v["origin"]["input"],
            serde_json::from_str::<serde_json::Value>(INPUT).unwrap()
        );
        assert_eq!(
            v["origin"]["result"],
            serde_json::from_str::<serde_json::Value>(RESULT).unwrap()
        );
        assert_eq!(v["progress"], "ready");
    }
    let trace = f.bytes("trace.jsonl");
    let prefix = f.bytes("checkpoint.json");
    assert!(f.child("retry", None, false).success());
    assert_eq!(trace, f.bytes("trace.jsonl"));
    assert_eq!(prefix, f.bytes("checkpoint.json"));
}

#[test]
fn ingress_is_closed_bounded_duplicate_aware_and_typed() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let initial = f.bytes("checkpoint.json");
    let mut invalid = vec![
        INPUT.replace("\"why\":null", "\"why\":null,\"why\":null"),
        INPUT.replace("\"why\":null", "\"why\":null,\"wh\\u0079\":null"),
        INPUT.replace(",\"why\":null", ""),
        INPUT.replace("\"why\":null", "\"why\":null,\"actor\":\"owner-1\""),
        INPUT.replace("\"why\":null", "\"why\":null,\"approval\":true"),
        INPUT.replace("\"why\":null", "\"why\":null,\"result\":{}"),
        INPUT.replace("\"v\":1", "\"v\":1,\"v\":1"),
        INPUT.replace("\"v\":1", "\"v\":1.0"),
        INPUT.replace("\"v\":1", "\"v\":-1"),
        INPUT.replace("\"v\":1", "\"v\":\"1\""),
        INPUT.replace("\"v\":1", "\"v\":2"),
        INPUT.replace("open_change", "raw_append"),
        INPUT.replace("open-1", "bad:key"),
        INPUT.replace("\"what\":\"  Café / cleanup  \"", "\"what\":\"  \""),
        INPUT.replace("\"why\":null", "\"why\":{}"),
        INPUT.replace("\"why\":null", "\"why\":[]"),
        INPUT.replace("\"why\":null", "\"why\":\"\\ud800\""),
        format!("{INPUT}{{}}"),
        INPUT.replace("  Café / cleanup  ", &"x".repeat(65_537)),
        INPUT.replace(
            "\"why\":null",
            &format!("\"why\":\"{}\"", "x".repeat(65_537)),
        ),
        INPUT.replace("open-1", &"a".repeat(65)),
        INPUT.replace(
            "\"why\":null",
            &format!("\"why\":{}0{}", "[".repeat(140), "]".repeat(140)),
        ),
        " ".repeat(1_048_577),
    ];
    invalid.push(INSPECT.replace("change-1\"", "change-1\",\"why\":null"));
    for json in invalid {
        let answer = h.open_change(json.as_bytes(), &mut Guard::allow());
        assert_eq!(
            answer,
            OpeningError::InvalidInput.json(),
            "input: {}",
            &json[..json.len().min(200)]
        );
        assert_eq!(initial, f.bytes("checkpoint.json"));
        assert!(f.bytes("trace.jsonl").is_empty());
    }
    assert_eq!(
        h.open_change(&[0xff], &mut Guard::allow()),
        OpeningError::InvalidInput.json()
    );
    assert_eq!(
        h.inspect_change(INPUT.as_bytes(), &mut Guard::allow()),
        OpeningError::Unsupported.json()
    );
    assert_eq!(
        h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
}

#[test]
fn current_policy_association_and_final_disclosure_gate() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.opened();
    let bytes = f.bytes("trace.jsonl");
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert_eq!(
        h.open_change(INPUT.as_bytes(), &mut Guard::denied()),
        OpeningError::Denied.json()
    );
    assert_eq!(
        h.inspect_change(INSPECT.as_bytes(), &mut Guard::unavailable()),
        OpeningError::Unavailable.json()
    );
    assert_eq!(
        h.inspect_change(
            INSPECT.as_bytes(),
            &mut Guard {
                principal: "intruder",
                ..Guard::allow()
            }
        ),
        OpeningError::Denied.json()
    );
    assert_eq!(
        h.inspect_change(
            INSPECT.replace("workspace-1", "workspace-2").as_bytes(),
            &mut Guard::allow()
        ),
        OpeningError::Denied.json()
    );
    assert_eq!(
        h.open_change(
            INPUT.replace("change-1", "change-2").as_bytes(),
            &mut Guard::allow()
        ),
        OpeningError::Denied.json()
    );
    assert_eq!(
        h.inspect_change(
            INSPECT.as_bytes(),
            &mut Guard {
                final_permission: Some(OpeningPermission::Deny),
                ..Guard::allow()
            }
        ),
        OpeningError::Denied.json()
    );
    assert_eq!(bytes, f.bytes("trace.jsonl"));
    drop(h);
    let fresh = Fixture::new();
    fresh.provision();
    let mut h = fresh.host(OpeningMode::Reopen, None).unwrap();
    assert_eq!(
        h.open_change(
            INPUT.as_bytes(),
            &mut Guard {
                final_permission: Some(OpeningPermission::Deny),
                ..Guard::allow()
            }
        ),
        OpeningError::Denied.json()
    );
    assert_eq!(
        h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
}

#[test]
fn exact_typed_identity_conflicts_and_different_key_cannot_allocate() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.opened();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let bytes = f.bytes("trace.jsonl");
    for changed in [
        INPUT.replace("\"why\":null", "\"why\":\"\""),
        INPUT.replace("cleanup", "clean up"),
    ] {
        assert_eq!(
            h.open_change(changed.as_bytes(), &mut Guard::allow()),
            OpeningError::Conflict.json()
        );
    }
    assert_eq!(
        h.open_change(
            INPUT.replace("open-1", "open-2").as_bytes(),
            &mut Guard::allow()
        ),
        OpeningError::Unsupported.json()
    );
    let reordered = r#" { "why": null, "what":"  Café / cleanup  ","key":"open-1","change":"change-1","workspace_id":"workspace-1","op":"open_change","v":1 } "#;
    assert_eq!(
        h.open_change(reordered.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
    assert_eq!(bytes, f.bytes("trace.jsonl"));
    drop(h);
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert_eq!(
        h.open_change(
            INPUT.replace("open-1", "open-2").as_bytes(),
            &mut Guard::allow()
        ),
        OpeningError::Unsupported.json()
    );
    assert!(f.bytes("trace.jsonl").is_empty());
}

#[test]
fn canonical_all_controls_exact_lf_digest_and_max_text() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let what = format!("é/\"\\{}", (0u8..32).map(char::from).collect::<String>());
    let json = INPUT.replace(
        "\"what\":\"  Café / cleanup  \"",
        &format!("\"what\":{}", serde_json::to_string(&what).unwrap()),
    );
    assert_eq!(
        h.open_change(json.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
    let bytes = f.bytes("trace.jsonl");
    let text = std::str::from_utf8(&bytes).unwrap();
    for n in 0..32 {
        assert!(text.contains(&format!("\\u00{n:02x}")));
    }
    assert!(text.contains("é/\\\"\\\\"));
    assert!(!text.contains("\\n"));
    assert!(!text.contains("\\t"));
    assert_eq!(bytes.iter().filter(|b| **b == b'\n').count(), 1);
    assert_eq!(bytes.last(), Some(&b'\n'));
    let p: serde_json::Value = serde_json::from_slice(&f.bytes("checkpoint.json")).unwrap();
    assert_eq!(p["end"], bytes.len());
    assert_eq!(p["sha256"], format!("{:x}", Sha256::digest(&bytes)));
    assert_eq!(inspection(&mut h)["origin"]["input"]["what"], what);
    drop(h);
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    let json = INPUT
        .replace("  Café / cleanup  ", &"x".repeat(65_536))
        .replace(
            "\"why\":null",
            &format!("\"why\":\"{}\"", "\\u0000".repeat(65_536)),
        );
    assert_eq!(
        h.open_change(json.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
    assert!(
        h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow())
            .len()
            <= 1_048_576
    );
}

#[test]
fn cooperative_writer_contention_then_useful_successor() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.opened();
    let h = f.host(OpeningMode::Reopen, None).unwrap();
    // Same-process lock contender also cannot proceed; no fork/spawn with owning fds.
    assert!(matches!(
        f.host(OpeningMode::Reopen, None),
        Err(OpeningError::Unavailable)
    ));
    drop(h);
    // Actual process contention: owning child signals via a non-custody test rendezvous.
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "holding_writer_entry", "--nocapture"])
        .env("CK_OPENING_ROOT", &f.0)
        .spawn()
        .unwrap();
    while !f.0.join("ready").exists() {
        assert!(child.try_wait().unwrap().is_none());
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
    assert!(f.child("contender", None, false).success());
    fs::write(f.0.join("release"), b"go").unwrap();
    assert!(child.wait().unwrap().success());
    assert!(f.child("retry", None, false).success());
}
#[test]
fn holding_writer_entry() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let Some(root) = std::env::var_os("CK_OPENING_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    let _host = OpeningHost::connect(
        OpeningSlot {
            directory: root.join("slot"),
            anchor: root.join("anchor.json"),
        },
        OpeningMode::Reopen,
        &mut Guard::allow(),
        None,
    )
    .unwrap();
    fs::write(root.join("ready"), b"ready").unwrap();
    while !root.join("release").exists() {
        std::thread::sleep(std::time::Duration::from_millis(5));
    }
}

#[test]
fn opening_crash_cuts_reconcile_only_supported_installed_evidence() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (event, recoverable) in [
        (cut("reserve", "checkpoint.tmp", "before_create"), true),
        (cut("reserve", "checkpoint.tmp", "created"), false),
        (cut("reserve", "checkpoint.tmp", "written"), true),
        (cut("reserve", "checkpoint.tmp", "synced"), true),
        (cut("reserve", "checkpoint.tmp", "before_rename"), true),
        (cut("reserve", "checkpoint.tmp", "renamed"), true),
        (cut("reserve", "directory", "before_sync"), true),
        (cut("reserve", "directory", "synced"), true),
        (cut("append", "trace.jsonl", "before_write"), true),
        (cut("append", "trace.jsonl", "written"), true),
        (cut("append", "trace.jsonl", "before_sync"), true),
        (cut("append", "trace.jsonl", "synced"), true),
        (cut("checkpoint", "checkpoint.tmp", "created"), false),
        (cut("checkpoint", "checkpoint.tmp", "written"), true),
        (cut("checkpoint", "checkpoint.tmp", "synced"), true),
        (cut("checkpoint", "checkpoint.tmp", "before_rename"), true),
        (cut("checkpoint", "checkpoint.tmp", "renamed"), true),
        (cut("checkpoint", "directory", "before_sync"), true),
        (cut("checkpoint", "directory", "synced"), true),
        (cut("deliver", "reply", "before"), true),
    ] {
        let f = Fixture::new();
        f.provision();
        assert_eq!(
            f.child("open", Some(event), false).code(),
            Some(71),
            "{event:?}"
        );
        let before = f.bytes("trace.jsonl");
        if !recoverable {
            f.blocked();
            assert_eq!(before, f.bytes("trace.jsonl"));
            continue;
        }
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        let prefix: serde_json::Value =
            serde_json::from_slice(&f.bytes("checkpoint.json")).unwrap();
        if prefix["generation"] == 0 {
            assert_eq!(
                h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow()),
                OpeningError::Unavailable.json()
            );
            if !prefix["pending"].is_null() {
                assert_eq!(
                    h.open_change(
                        INPUT.replace("cleanup", "changed").as_bytes(),
                        &mut Guard::allow()
                    ),
                    OpeningError::Conflict.json()
                );
            }
        }
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes(),
            "{event:?}"
        );
        let accepted = f.bytes("trace.jsonl");
        if prefix["generation"] == 1 {
            assert_eq!(accepted, before);
        }
        drop(h);
        assert!(f.child("retry", None, false).success());
        assert_eq!(accepted, f.bytes("trace.jsonl"));
    }
}

#[test]
fn crash_during_real_partial_append_continues_only_exact_reserved_origin() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    assert_eq!(
        f.child(
            "open",
            Some(cut("append", "trace.jsonl", "short_written")),
            true
        )
        .code(),
        Some(71)
    );
    let partial = f.bytes("trace.jsonl");
    assert!(!partial.is_empty());
    let mut h = f.host(OpeningMode::Reopen, None).unwrap();
    assert_eq!(
        h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow()),
        OpeningError::Unavailable.json()
    );
    assert_eq!(
        h.open_change(
            INPUT.replace("\"why\":null", "\"why\":\"\"").as_bytes(),
            &mut Guard::allow()
        ),
        OpeningError::Conflict.json()
    );
    assert_eq!(partial, f.bytes("trace.jsonl"));
    assert_eq!(
        h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
        RESULT.as_bytes()
    );
    assert!(f.bytes("trace.jsonl").starts_with(&partial));
    drop(h);
    assert!(f.child("retry", None, false).success());
}

#[test]
fn initial_without_reservation_or_mismatched_reserved_tail_never_infers_request() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for pending in [false, true] {
        let f = Fixture::new();
        f.provision();
        if pending {
            assert_eq!(
                f.child(
                    "open",
                    Some(cut("append", "trace.jsonl", "before_write")),
                    false
                )
                .code(),
                Some(71)
            );
        }
        fs::write(f.path("trace.jsonl"), b"unrelated\n").unwrap();
        let bytes = f.bytes("trace.jsonl");
        f.blocked();
        assert_eq!(bytes, f.bytes("trace.jsonl"));
    }
}

#[test]
fn accepted_suffix_is_not_history_and_never_cleaned() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for suffix in [
        b"torn".as_slice(),
        b"{\"v\":1,\"kind\":\"opened\"}\n".as_slice(),
    ] {
        let f = Fixture::new();
        f.opened();
        let mut bytes = f.bytes("trace.jsonl");
        bytes.extend_from_slice(suffix);
        fs::write(f.path("trace.jsonl"), &bytes).unwrap();
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        let view = inspection(&mut h);
        assert_eq!(view["progress"], "blocked_unaccepted_tail");
        assert_eq!(view["coverage"]["last"], 1);
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
        assert_eq!(bytes, f.bytes("trace.jsonl"));
    }
}

#[test]
fn provisioning_crash_paths_distinguish_fresh_resume_and_reopen() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (event, supported) in [
        (cut("provision", "directory", "created"), false),
        (cut("provision", "writer.lock", "created"), false),
        (cut("provision", "writer.lock", "before_sync"), false),
        (cut("provision", "writer.lock", "synced"), false),
        (cut("provision", "directory_parent", "before_sync"), false),
        (cut("provision", "directory_parent", "synced"), false),
        (cut("provision", "anchor.json", "written"), true),
        (cut("provision", "anchor.json", "synced"), true),
        (cut("provision", "anchor.json", "before_parent_sync"), true),
        (cut("provision", "anchor.json", "parent_synced"), true),
        (cut("provision", "trace.jsonl", "before_create"), true),
        (cut("provision", "trace.jsonl", "synced"), true),
        (cut("provision", "checkpoint.json", "created"), false),
        (cut("provision", "checkpoint.json", "written"), true),
        (cut("provision", "incident.json", "before_create"), true),
        (cut("provision", "incident.json", "written"), true),
        (cut("provision", "anchor.tmp", "created"), false),
        (cut("provision", "anchor.tmp", "written"), true),
        (cut("provision", "anchor.tmp", "synced"), true),
        (cut("provision", "anchor.tmp", "before_rename"), true),
        (cut("provision", "anchor.tmp", "renamed"), true),
        (cut("provision", "anchor.tmp", "before_parent_sync"), true),
        (cut("provision", "anchor.tmp", "parent_synced"), true),
    ] {
        let f = Fixture::new();
        assert_eq!(
            f.child("fresh", Some(event), false).code(),
            Some(71),
            "{event:?}"
        );
        // Neither absence nor a half-created store grants first use again.
        assert!(matches!(
            f.host(OpeningMode::FreshProvision, None),
            Err(OpeningError::Unavailable)
        ));
        if !supported {
            assert!(matches!(
                f.host(OpeningMode::ResumeProvision, None),
                Err(OpeningError::Unavailable)
            ));
            f.blocked();
            continue;
        }
        let a: serde_json::Value =
            serde_json::from_slice(&fs::read(f.0.join("anchor.json")).unwrap()).unwrap();
        if a["stage"] == "preparing" {
            assert!(matches!(
                f.host(OpeningMode::Reopen, None),
                Err(OpeningError::Unavailable)
            ));
            assert!(f.child("resume", None, false).success(), "{event:?}");
        }
        let mut h = f.host(OpeningMode::Reopen, None).unwrap();
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            RESULT.as_bytes()
        );
    }
}

#[test]
fn reserved_anchor_temporary_cleanup_revalidates_after_each_interruption() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for event in [
        cut("provision", "anchor.tmp", "before_unlink"),
        cut("provision", "anchor.tmp", "unlinked"),
        cut("provision", "anchor_parent", "synced"),
        cut("provision", "anchor.tmp", "created"),
    ] {
        let f = Fixture::new();
        assert_eq!(
            f.child(
                "fresh",
                Some(cut("provision", "anchor.tmp", "before_rename")),
                false
            )
            .code(),
            Some(71)
        );
        assert_eq!(f.child("resume", Some(event), false).code(), Some(71));
        if event.step == "created" {
            // Fresh torn temporary after supported cleanup refuses, not promoted.
            assert!(matches!(
                f.host(OpeningMode::ResumeProvision, None),
                Err(OpeningError::Unavailable)
            ));
        } else {
            assert!(f.child("resume", None, false).success());
            let mut h = f.host(OpeningMode::Reopen, None).unwrap();
            assert_eq!(
                h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
                RESULT.as_bytes()
            );
        }
    }
    // Installed + identical installed temporary is supported only for initial inventory.
    let f = Fixture::new();
    f.provision();
    fs::copy(f.0.join("anchor.json"), f.0.join("anchor.tmp")).unwrap();
    drop(f.host(OpeningMode::Reopen, None).unwrap());
    assert!(!f.0.join("anchor.tmp").exists());
    let f = Fixture::new();
    f.opened();
    fs::copy(f.0.join("anchor.json"), f.0.join("anchor.tmp")).unwrap();
    let bytes = f.bytes("trace.jsonl");
    f.blocked();
    assert!(f.0.join("anchor.tmp").exists());
    assert_eq!(bytes, f.bytes("trace.jsonl"));
}

#[test]
fn anchor_temporary_torn_unrelated_noncanonical_or_backwards_preserves_evidence() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for case in [
        "torn",
        "unrelated",
        "noncanonical",
        "backwards",
        "oversize",
        "symlink",
        "missing_authority",
        "incomplete",
    ] {
        let f = Fixture::new();
        f.provision();
        let a = fs::read(f.0.join("anchor.json")).unwrap();
        let text = String::from_utf8(a.clone()).unwrap();
        match case {
            "torn" => fs::write(f.0.join("anchor.tmp"), b"{\"format\":").unwrap(),
            "unrelated" => fs::write(
                f.0.join("anchor.tmp"),
                text.replace("custody-1", "custody-2"),
            )
            .unwrap(),
            "noncanonical" => fs::write(f.0.join("anchor.tmp"), format!(" {text}")).unwrap(),
            "backwards" => fs::write(
                f.0.join("anchor.tmp"),
                text.replace("installed", "preparing"),
            )
            .unwrap(),
            "oversize" => fs::write(f.0.join("anchor.tmp"), vec![b' '; 1_048_577]).unwrap(),
            "symlink" => symlink(f.0.join("anchor.json"), f.0.join("anchor.tmp")).unwrap(),
            "missing_authority" => {
                fs::write(f.0.join("anchor.tmp"), a).unwrap();
                fs::remove_file(f.0.join("anchor.json")).unwrap();
            }
            "incomplete" => {
                fs::write(f.0.join("anchor.tmp"), a).unwrap();
                fs::remove_file(f.path("incident.json")).unwrap();
            }
            _ => unreachable!(),
        }
        let temp = fs::read(f.0.join("anchor.tmp")).unwrap();
        f.blocked();
        assert_eq!(temp, fs::read(f.0.join("anchor.tmp")).unwrap(), "{case}");
    }
}

#[test]
fn checkpoint_temporary_relationship_cleanup_and_unexplained_refusal() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    // Installed accepted prefix plus an identical canonical temp is not new authority.
    let f = Fixture::new();
    f.opened();
    fs::copy(f.path("checkpoint.json"), f.path("checkpoint.tmp")).unwrap();
    let before = f.bytes("trace.jsonl");
    drop(f.host(OpeningMode::Reopen, None).unwrap());
    assert!(!f.path("checkpoint.tmp").exists());
    assert_eq!(before, f.bytes("trace.jsonl"));
    for case in ["torn", "unrelated", "future", "symlink"] {
        let f = Fixture::new();
        f.provision();
        let p = String::from_utf8(f.bytes("checkpoint.json")).unwrap();
        match case {
            "torn" => fs::write(f.path("checkpoint.tmp"), b"{").unwrap(),
            "unrelated" => fs::write(
                f.path("checkpoint.tmp"),
                p.replace("custody-1", "custody-2"),
            )
            .unwrap(),
            "future" => fs::write(
                f.path("checkpoint.tmp"),
                p.replace("\"generation\":0", "\"generation\":2"),
            )
            .unwrap(),
            "symlink" => symlink(f.path("checkpoint.json"), f.path("checkpoint.tmp")).unwrap(),
            _ => unreachable!(),
        }
        let before = f.bytes("checkpoint.tmp");
        f.blocked();
        assert_eq!(before, f.bytes("checkpoint.tmp"));
    }
    // Cleanup itself is interruptible. A validated absent remnant remains same identity.
    for event in [
        cut("recover", "checkpoint.tmp", "before_unlink"),
        cut("recover", "checkpoint.tmp", "unlinked"),
        cut("recover", "directory", "before_sync"),
    ] {
        let f = Fixture::new();
        f.opened();
        fs::copy(f.path("checkpoint.json"), f.path("checkpoint.tmp")).unwrap();
        assert_eq!(f.child("retry", Some(event), false).code(), Some(71));
        assert!(f.child("retry", None, false).success());
    }
}

#[test]
fn missing_damaged_controls_history_and_self_consistent_forged_result_block() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for case in [
        "anchor",
        "lock",
        "trace",
        "prefix",
        "incident",
        "truncate",
        "changed",
        "result",
        "prev",
        "key",
        "owner",
        "binding",
        "duplicate_null",
        "missing_null",
        "crlf",
        "noncanonical",
        "oversized_trace",
        "unknown_inventory",
        "symlink",
    ] {
        let f = Fixture::new();
        f.opened();
        let original = f.bytes("trace.jsonl");
        match case {
            "anchor" => fs::remove_file(f.0.join("anchor.json")).unwrap(),
            "lock" => fs::remove_file(f.path("writer.lock")).unwrap(),
            "trace" => fs::remove_file(f.path("trace.jsonl")).unwrap(),
            "prefix" => fs::remove_file(f.path("checkpoint.json")).unwrap(),
            "incident" => fs::remove_file(f.path("incident.json")).unwrap(),
            "truncate" => {
                fs::write(f.path("trace.jsonl"), &original[..original.len() / 2]).unwrap()
            }
            "changed" => fs::write(
                f.path("trace.jsonl"),
                String::from_utf8(original.clone())
                    .unwrap()
                    .replace("cleanup", "changed"),
            )
            .unwrap(),
            "oversized_trace" => fs::write(f.path("trace.jsonl"), vec![b'x'; 2_097_153]).unwrap(),
            "unknown_inventory" => fs::write(f.path("foreign"), b"x").unwrap(),
            "symlink" => {
                fs::remove_file(f.path("checkpoint.json")).unwrap();
                symlink(f.0.join("anchor.json"), f.path("checkpoint.json")).unwrap();
            }
            _ => {
                let mut text = String::from_utf8(original.clone()).unwrap();
                text = match case {
                    "result" => text.replace("change-1:origin", "change-1:forged"),
                    "prev" => text.replace("\"prev\":null", "\"prev\":\"head\""),
                    "key" => text.replace("open-1", "open-2"),
                    "owner" => text.replace("owner-1", "owner-2"),
                    "binding" => text.replace("fixture@1", "fixture@2"),
                    "duplicate_null" => {
                        text.replace("\"prev\":null", "\"prev\":null,\"prev\":null")
                    }
                    "missing_null" => text.replace("\"prev\":null,", ""),
                    "crlf" => text.replace('\n', "\r\n"),
                    "noncanonical" => format!(" {text}"),
                    _ => unreachable!(),
                };
                fs::write(f.path("trace.jsonl"), text.as_bytes()).unwrap();
                // Match digest/end too: logical and canonical checks must still refuse.
                let prefix = String::from_utf8(f.bytes("checkpoint.json"))
                    .unwrap()
                    .replace(
                        &format!("{:x}", Sha256::digest(&original)),
                        &format!("{:x}", Sha256::digest(text.as_bytes())),
                    )
                    .replace(
                        &format!("\"end\":{}", original.len()),
                        &format!("\"end\":{}", text.len()),
                    );
                fs::write(f.path("checkpoint.json"), prefix).unwrap();
            }
        }
        let before = fs::read(f.path("trace.jsonl")).ok();
        f.blocked();
        assert_eq!(before, fs::read(f.path("trace.jsonl")).ok(), "{case}");
    }
    // Logical control associations are independently validated, not just trace digests.
    for file in ["checkpoint.json", "incident.json"] {
        let f = Fixture::new();
        f.opened();
        let text = String::from_utf8(f.bytes(file)).unwrap();
        fs::write(f.path(file), text.replace("custody-1", "custody-2")).unwrap();
        f.blocked();
    }
}

#[test]
fn copied_custody_and_replaced_lock_or_directory_are_not_reenrolled() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let original = Fixture::new();
    original.opened();
    let copy = Fixture::new();
    fs::create_dir(copy.slot().directory).unwrap();
    for n in [
        "writer.lock",
        "trace.jsonl",
        "checkpoint.json",
        "incident.json",
    ] {
        fs::copy(original.path(n), copy.path(n)).unwrap();
    }
    fs::copy(original.0.join("anchor.json"), copy.0.join("anchor.json")).unwrap();
    copy.blocked();
    // Even rewriting path spelling cannot forge pinned handle identities.
    let a = fs::read_to_string(copy.0.join("anchor.json"))
        .unwrap()
        .replace(
            original.slot().directory.to_str().unwrap(),
            copy.slot().directory.to_str().unwrap(),
        );
    fs::write(copy.0.join("anchor.json"), a).unwrap();
    copy.blocked();
    let f = Fixture::new();
    f.opened();
    fs::rename(f.path("writer.lock"), f.0.join("old-lock")).unwrap();
    fs::write(f.path("writer.lock"), b"").unwrap();
    f.blocked();
    let f = Fixture::new();
    f.opened();
    fs::rename(f.slot().directory, f.0.join("old-slot")).unwrap();
    fs::create_dir(f.slot().directory).unwrap();
    for n in [
        "writer.lock",
        "trace.jsonl",
        "checkpoint.json",
        "incident.json",
    ] {
        fs::copy(f.0.join("old-slot").join(n), f.path(n)).unwrap();
    }
    f.blocked();
    let f = Fixture::new();
    f.provision();
    fs::rename(f.slot().directory, f.0.join("real-slot")).unwrap();
    symlink(f.0.join("real-slot"), f.slot().directory).unwrap();
    f.blocked();
}

#[test]
fn observed_io_short_write_barrier_and_replacement_latch_retained_incident() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (at, fault) in [
        (
            cut("reserve", "checkpoint.tmp", "before_write"),
            OpeningIoFault::ShortWrite,
        ),
        (
            cut("reserve", "checkpoint.tmp", "before_sync"),
            OpeningIoFault::Io,
        ),
        (
            cut("reserve", "checkpoint.tmp", "before_rename"),
            OpeningIoFault::Io,
        ),
        (
            cut("reserve", "directory", "before_sync"),
            OpeningIoFault::Io,
        ),
        (
            cut("append", "trace.jsonl", "before_write"),
            OpeningIoFault::ShortWrite,
        ),
        (
            cut("append", "trace.jsonl", "before_sync"),
            OpeningIoFault::Io,
        ),
        (
            cut("checkpoint", "checkpoint.tmp", "before_write"),
            OpeningIoFault::Io,
        ),
        (
            cut("checkpoint", "checkpoint.tmp", "renamed"),
            OpeningIoFault::Io,
        ),
        (
            cut("checkpoint", "directory", "before_sync"),
            OpeningIoFault::Io,
        ),
        (
            cut("deliver", "trace.jsonl", "before_sync"),
            OpeningIoFault::Io,
        ),
        (cut("deliver", "reply", "before"), OpeningIoFault::Io),
    ] {
        let f = Fixture::new();
        f.provision();
        let mut h = f
            .host(OpeningMode::Reopen, Some(fail(at, fault, None)))
            .unwrap();
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            OpeningError::Unavailable.json(),
            "{at:?}"
        );
        assert_eq!(
            h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow()),
            OpeningError::Unavailable.json()
        );
        let incident: serde_json::Value =
            serde_json::from_slice(&f.bytes("incident.json")).unwrap();
        assert_eq!(incident["state"], "blocked", "{at:?}");
        let bytes = f.bytes("trace.jsonl");
        drop(h);
        f.blocked();
        assert_eq!(bytes, f.bytes("trace.jsonl"));
    }
}

#[test]
fn failed_incident_retention_never_clears_live_latch_or_surviving_evidence() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for step in [
        "before_create",
        "created",
        "before_write",
        "before_sync",
        "before_rename",
        "renamed",
    ] {
        let f = Fixture::new();
        f.provision();
        let mut h = f
            .host(
                OpeningMode::Reopen,
                Some(fail(
                    cut("append", "trace.jsonl", "before_sync"),
                    OpeningIoFault::Io,
                    Some(cut("append", "incident.tmp", step)),
                )),
            )
            .unwrap();
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            OpeningError::Unavailable.json()
        );
        assert_eq!(
            h.open_change(INPUT.as_bytes(), &mut Guard::allow()),
            OpeningError::Unavailable.json()
        );
        assert_eq!(
            h.inspect_change(INSPECT.as_bytes(), &mut Guard::allow()),
            OpeningError::Unavailable.json()
        );
        drop(h);
        if step == "before_create" {
            // No retained observation survived. Profile explicitly cannot recover it.
            let mut successor = f.host(OpeningMode::Reopen, None).unwrap();
            assert_eq!(
                successor.open_change(INPUT.as_bytes(), &mut Guard::allow()),
                RESULT.as_bytes()
            );
        } else {
            f.blocked();
        }
    }
}

#[test]
fn provision_and_validated_cleanup_failures_retain_monotonic_incident() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for at in [
        cut("provision", "checkpoint.json", "before_write"),
        cut("provision", "anchor.tmp", "before_rename"),
        cut("provision", "anchor_parent", "before_sync"),
    ] {
        let f = Fixture::new();
        assert!(matches!(
            f.host(
                OpeningMode::FreshProvision,
                Some(fail(at, OpeningIoFault::Io, None))
            ),
            Err(OpeningError::Unavailable)
        ));
        let incident: serde_json::Value =
            serde_json::from_slice(&f.bytes("incident.json")).unwrap();
        assert_eq!(incident["state"], "blocked");
        assert!(matches!(
            f.host(OpeningMode::ResumeProvision, None),
            Err(OpeningError::Unavailable)
        ));
        f.blocked();
    }
    let f = Fixture::new();
    f.provision();
    fs::copy(f.0.join("anchor.json"), f.0.join("anchor.tmp")).unwrap();
    assert!(matches!(
        f.host(
            OpeningMode::Reopen,
            Some(fail(
                cut("provision", "anchor.tmp", "unlinked"),
                OpeningIoFault::Io,
                None
            ))
        ),
        Err(OpeningError::Unavailable)
    ));
    f.blocked();
    let f = Fixture::new();
    f.opened();
    fs::copy(f.path("checkpoint.json"), f.path("checkpoint.tmp")).unwrap();
    assert!(matches!(
        f.host(
            OpeningMode::Reopen,
            Some(fail(
                cut("recover", "checkpoint.tmp", "unlinked"),
                OpeningIoFault::Io,
                None
            ))
        ),
        Err(OpeningError::Unavailable)
    ));
    f.blocked();
}

#[test]
fn no_first_use_from_absence_or_client_policy_and_no_reopen_initialization() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    assert!(matches!(
        f.host(OpeningMode::Reopen, None),
        Err(OpeningError::Unavailable)
    ));
    assert!(matches!(
        f.host(OpeningMode::ResumeProvision, None),
        Err(OpeningError::Unavailable)
    ));
    assert!(!f.slot().directory.exists());
    assert!(matches!(
        OpeningHost::connect(
            f.slot(),
            OpeningMode::FreshProvision,
            &mut Guard::denied(),
            None
        ),
        Err(OpeningError::Denied)
    ));
    assert!(matches!(
        OpeningHost::connect(
            f.slot(),
            OpeningMode::FreshProvision,
            &mut Guard::unavailable(),
            None
        ),
        Err(OpeningError::Unavailable)
    ));
    assert!(!f.slot().directory.exists());
    fs::create_dir(f.slot().directory).unwrap();
    assert!(matches!(
        f.host(OpeningMode::FreshProvision, None),
        Err(OpeningError::Unavailable)
    ));
    assert!(!f.0.join("anchor.json").exists());
}

#[test]
fn accepted_control_null_presence_duplicates_and_digest_spelling_are_validated() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for case in [
        "duplicate_pending",
        "missing_pending",
        "duplicate_sha",
        "missing_sha",
        "upper_digest",
        "oversize",
        "float",
        "trailing",
    ] {
        let f = Fixture::new();
        f.opened();
        let prefix = String::from_utf8(f.bytes("checkpoint.json")).unwrap();
        let corrupted = match case {
            "duplicate_pending" => {
                prefix.replace("\"pending\":null", "\"pending\":null,\"pending\":null")
            }
            "missing_pending" => prefix.replace(",\"pending\":null", ""),
            "duplicate_sha" => prefix.replace("\"sha256\":", "\"sha256\":null,\"sha256\":"),
            "missing_sha" => {
                let value: serde_json::Value = serde_json::from_str(&prefix).unwrap();
                prefix.replace(
                    &format!(",\"sha256\":\"{}\"", value["sha256"].as_str().unwrap()),
                    "",
                )
            }
            "upper_digest" => {
                let value: serde_json::Value = serde_json::from_str(&prefix).unwrap();
                let digest = value["sha256"].as_str().unwrap();
                prefix.replace(digest, &digest.to_uppercase())
            }
            "oversize" => " ".repeat(1_048_577),
            "float" => prefix.replace("\"generation\":1", "\"generation\":1.0"),
            "trailing" => format!("{prefix}{{}}"),
            _ => unreachable!(),
        };
        fs::write(f.path("checkpoint.json"), &corrupted).unwrap();
        let trace = f.bytes("trace.jsonl");
        f.blocked();
        assert_eq!(trace, f.bytes("trace.jsonl"));
        assert_eq!(corrupted.as_bytes(), f.bytes("checkpoint.json"));
    }
}
