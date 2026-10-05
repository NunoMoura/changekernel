#![cfg(target_os = "linux")]
use changekernel::{
    LedgerCollectionPermission as CP, LedgerGrant, LedgerGrantSpec, LedgerGuard, LedgerHost,
    LedgerInput, LedgerIoEvent, LedgerIoFault, LedgerIoHook, LedgerMemberPermission as MP,
    LedgerPair, LedgerPermission as P, LedgerWork, OpeningError as E, OpeningMode as Mode,
};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::atomic::{AtomicUsize, Ordering},
};
static SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());
static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!(
            "ck-ledger-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&p).unwrap();
        Self(p)
    }
    fn pairs() -> [LedgerPair; 16] {
        std::array::from_fn(|i| LedgerPair {
            change: format!("change-{}", (b'a' + i as u8) as char),
            custody: format!("custody-{}", (b'a' + i as u8) as char),
        })
    }
    fn grant_with(&self, pairs: &[LedgerPair; 16]) -> LedgerGrant {
        LedgerGrant::new(LedgerGrantSpec {
            profile: "ck-ledger@4",
            ledger: "ledger-1",
            custody: "ledger-custody",
            owner: "owner-1",
            workspace_id: "workspace-1",
            binding: "fixture@1",
            directory: &self.0.join("ledger"),
            anchor: &self.0.join("anchor.json"),
            grants: pairs,
        })
        .unwrap()
    }
    fn grant(&self) -> LedgerGrant {
        self.grant_with(&Self::pairs())
    }
    fn host(&self, mode: Mode, hook: Option<LedgerIoHook>) -> Result<LedgerHost, E> {
        LedgerHost::connect(self.grant(), mode, &mut Guard::allow(), hook)
    }
    fn provision(&self) {
        drop(self.host(Mode::FreshProvision, None).unwrap());
    }
    fn path(&self, name: &str) -> PathBuf {
        self.0.join("ledger").join(name)
    }
    fn member(&self, slot: usize, name: &str) -> PathBuf {
        self.path(&format!("members/m-{slot}/{name}"))
    }
    fn child(&self, action: &str, cut: Option<LedgerIoEvent>) -> std::process::ExitStatus {
        let mut cmd = Command::new(std::env::current_exe().unwrap());
        cmd.args(["--exact", "ledger_process_entry", "--nocapture"])
            .env("CK_LEDGER_ROOT", &self.0)
            .env("CK_LEDGER_ACTION", action);
        if let Some(e) = cut {
            cmd.env(
                "CK_LEDGER_CUT",
                format!("{}:{}:{}:{}", e.scope, e.phase, e.object, e.step),
            );
        }
        cmd.status().unwrap() // Wait confirms exit; parent owns no custody fds.
    }
    fn two(&self) {
        self.provision();
        let mut h = self.host(Mode::Reopen, None).unwrap();
        assert_created(
            &h.create_change(
                &create("a", "Record settings cleanup", Some("Keep original reason")),
                &mut Guard::allow(),
            ),
            "change-a",
        );
        assert_created(
            &h.create_change(
                &create("b", "Record backup cleanup", None),
                &mut Guard::allow(),
            ),
            "change-b",
        );
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
struct Guard {
    denied: Option<String>,
    unavailable: Option<String>,
    collection: P,
    final_deny: bool,
    calls: usize,
}
impl Guard {
    fn allow() -> Self {
        Self {
            denied: None,
            unavailable: None,
            collection: P::Allow,
            final_deny: false,
            calls: 0,
        }
    }
}
impl LedgerGuard for Guard {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: CP) -> P {
        self.calls += 1;
        if self.final_deny && self.calls > 1 {
            P::Deny
        } else {
            self.collection
        }
    }
    fn member(&mut self, _: &str, c: &str, _: MP) -> P {
        if self.denied.as_deref() == Some(c) {
            P::Deny
        } else if self.unavailable.as_deref() == Some(c) {
            P::Unavailable
        } else {
            P::Allow
        }
    }
}
fn create(key: &str, what: &str, why: Option<&str>) -> LedgerInput {
    LedgerInput::new(serde_json::to_vec(&json!({"v":4,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":format!("create-{key}"),"what":what,"why":why})).unwrap())
}
fn select(change: &str, op: &str) -> LedgerInput {
    LedgerInput::new(serde_json::to_vec(
        &json!({"v":4,"op":op,"ledger":"ledger-1","workspace_id":"workspace-1","change":change}),
    )
    .unwrap())
}
fn list(limit: u64, cursor: Value) -> LedgerInput {
    LedgerInput::new(serde_json::to_vec(&json!({"v":4,"op":"list_changes","ledger":"ledger-1","workspace_id":"workspace-1","limit":limit,"cursor":cursor})).unwrap())
}
fn value(b: &[u8]) -> Value {
    serde_json::from_slice(b).unwrap()
}
fn assert_created(b: &[u8], change: &str) {
    assert_eq!(
        value(b)["kind"],
        "created",
        "{}",
        String::from_utf8_lossy(b)
    );
    assert_eq!(value(b)["change"], change);
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
fn fault(at: LedgerIoEvent, f: LedgerIoFault) -> LedgerIoHook {
    Box::new(move |e| if e == at { f } else { LedgerIoFault::Continue })
}
fn snapshot(path: &std::path::Path) -> Vec<(PathBuf, Vec<u8>)> {
    fn walk(root: &std::path::Path, p: &std::path::Path, out: &mut Vec<(PathBuf, Vec<u8>)>) {
        let mut entries = fs::read_dir(p)
            .unwrap()
            .map(Result::unwrap)
            .collect::<Vec<_>>();
        entries.sort_by_key(|e| e.file_name());
        for e in entries {
            let path = e.path();
            if path.is_dir() {
                walk(root, &path, out)
            } else {
                out.push((
                    path.strip_prefix(root).unwrap().to_owned(),
                    fs::read(path).unwrap(),
                ));
            }
        }
    }
    let mut out = vec![];
    walk(path, path, &mut out);
    out
}
fn bounds(w: LedgerWork, create: bool) {
    for boundary in [
        w.reads,
        w.ingress,
        w.controls,
        w.origins,
        w.constructions,
        w.emissions,
        w.control_emissions,
        w.origin_emissions,
        w.input_emissions,
        w.candidate_emissions,
        w.reply_emissions,
        w.canonical,
        w.semantic,
        w.typed_input,
        w.relationships,
        w.identifiers,
        w.ordering,
        w.fields,
        w.cleanup,
        w.retention,
        w.outputs,
        w.errors,
    ] {
        assert!(boundary.completions <= boundary.attempts, "{w:?}");
        assert_eq!(
            boundary.matches + boundary.no_matches,
            boundary.completions,
            "{w:?}"
        );
    }
    let c = 1_048_576u64;
    let t = 2_097_152u64;
    let s = w.shared_passes;
    let m = w.member_passes;
    assert!(s <= 16, "{w:?}");
    assert!(m <= if create { 16 } else { 64 }, "{w:?}");
    assert!(w.named_payload_peak <= 64 * c, "{w:?}");
    assert!(w.trace_buffers_peak <= 2, "{w:?}");
    assert!(w.trace_capacity_peak <= 2 * (t + 1), "{w:?}");
    assert!(
        w.buffered_bytes <= s * 4 * (c + 1) + m * (4 * (c + 1) + t + 1) + 32 * (c + 1),
        "{w:?}"
    );
    assert!(w.trace_bytes <= m * (t + 1), "{w:?}");
    assert!(w.accepted_hash_bytes <= m * c, "{w:?}");
    assert!(w.candidate_hash_bytes <= 32 * c, "{w:?}");
    assert!(w.constructions.attempts <= 256, "{w:?}");
    let auxiliary =
        w.control_emissions.attempts + w.input_emissions.attempts + w.candidate_emissions.attempts;
    for emission in [
        w.control_emissions,
        w.origin_emissions,
        w.input_emissions,
        w.candidate_emissions,
    ] {
        assert!(emission.operand_bytes <= emission.attempts * c, "{w:?}");
        assert!(emission.schema_words <= 32 * emission.attempts, "{w:?}");
    }
    assert!(w.origin_emissions.attempts <= m, "{w:?}");
    assert!(auxiliary <= 4 * s + 4 * m + 32, "{w:?}");
    assert!(
        auxiliary + w.origin_emissions.attempts <= 1 + 4 * s + 5 * m + 32,
        "{w:?}"
    );
    assert_eq!(
        w.emissions.attempts,
        auxiliary + w.origin_emissions.attempts + w.reply_emissions.attempts,
        "{w:?}"
    );
    assert!(w.canonical.attempts <= 4 * s + 5 * m + 32, "{w:?}");
    assert!(w.semantic.attempts <= m + 32, "{w:?}");
    assert!(w.typed_input.attempts <= 16, "{w:?}");
    assert!(w.relationships.attempts <= 16 * s + 16 * m + 64, "{w:?}");
    assert!(w.identifiers.attempts <= 152 * s + 512, "{w:?}");
    assert!(w.ordering.attempts <= 256, "{w:?}");
    assert!(
        w.fields.attempts <= 512 * (1 + 4 * s + 5 * m + 32 + 256),
        "{w:?}"
    );
    assert!(w.outputs.attempts <= 1, "{w:?}");
    assert!(w.errors.attempts <= 1, "{w:?}");
    assert!(w.retention.attempts <= 1, "{w:?}");
    let x = w.ingress.attempts + w.controls.attempts + w.origins.attempts;
    let d = 1 + 4 * s + 5 * m + 32 + 256;
    assert!(
        w.ingress.operand_bytes + w.controls.operand_bytes + w.origins.operand_bytes <= x * c,
        "{w:?}"
    );
    assert!(
        w.ingress.schema_words + w.controls.schema_words + w.origins.schema_words <= 32 * x,
        "{w:?}"
    );
    assert!(
        w.canonical.operand_bytes <= w.canonical.attempts * c,
        "{w:?}"
    );
    assert!(w.semantic.operand_bytes <= w.semantic.attempts * c, "{w:?}");
    assert!(w.semantic.schema_words <= 64 * w.semantic.attempts, "{w:?}");
    assert!(
        w.typed_input.operand_bytes <= w.typed_input.attempts * c,
        "{w:?}"
    );
    assert!(
        w.typed_input.schema_words <= 32 * w.typed_input.attempts,
        "{w:?}"
    );
    assert!(
        w.relationships.operand_bytes <= 16 * (s + m) * c + 128 * c,
        "{w:?}"
    );
    assert!(
        w.relationships.schema_words <= 64 * w.relationships.attempts,
        "{w:?}"
    );
    assert!(w.identifiers.operand_bytes <= 64 * (152 * s + 512), "{w:?}");
    assert!(
        w.identifiers.schema_words <= w.identifiers.attempts,
        "{w:?}"
    );
    assert!(w.ordering.operand_bytes <= 64 * 256, "{w:?}");
    assert!(w.ordering.schema_words <= 256, "{w:?}");
    assert!(w.fields.operand_bytes <= 4096 + 320 * d, "{w:?}");
    assert!(w.fields.schema_words <= 96 * d, "{w:?}");
    assert!(
        w.records_peak <= 2 && w.metadata_vectors_peak <= 1 && w.metadata_entries_peak <= 16,
        "{w:?}"
    );
    assert!(
        w.accepted_vectors_peak <= 1 && w.accepted_entries_peak <= 16,
        "{w:?}"
    );
    assert_eq!(w.grant_vectors_peak, 1);
    assert!(
        w.descriptor_handles_peak > 0 && w.named_fixed_bytes_peak > 0,
        "{w:?}"
    );
}

#[test]
fn ledger_process_entry() {
    let Some(root) = std::env::var_os("CK_LEDGER_ROOT") else {
        return;
    };
    let f = Fixture(PathBuf::from(root));
    let action = std::env::var("CK_LEDGER_ACTION").unwrap();
    let cut = std::env::var("CK_LEDGER_CUT").ok();
    let second = action == "accept-a";
    let mut matches = 0;
    let hook: LedgerIoHook = Box::new(move |e| {
        if cut.as_deref() == Some(&format!("{}:{}:{}:{}", e.scope, e.phase, e.object, e.step)) {
            matches += 1;
            if !second || matches == 2 {
                std::process::exit(71);
            }
        }
        LedgerIoFault::Continue
    });
    let mode = match action.as_str() {
        "fresh" => Mode::FreshProvision,
        "resume" => Mode::ResumeProvision,
        _ => Mode::Reopen,
    };
    let connected = f.host(mode, Some(hook));
    if action == "contender" {
        assert!(matches!(connected, Err(E::Unavailable)));
        std::mem::forget(f);
        return;
    }
    let mut h = connected.unwrap();
    assert_eq!(h.connection_work().member_passes, 0);
    match action.as_str() {
        "create-a" | "accept-a" => {
            assert_created(
                &h.create_change(
                    &create("a", "Record settings cleanup", Some("Keep original reason")),
                    &mut Guard::allow(),
                ),
                "change-a",
            );
            bounds(h.last_work(), true);
        }
        "create-b" => {
            assert_created(
                &h.create_change(
                    &create("b", "Record backup cleanup", None),
                    &mut Guard::allow(),
                ),
                "change-b",
            );
            bounds(h.last_work(), true);
        }
        "inspect" => {
            for c in ["change-a", "change-b"] {
                let selected =
                    value(&h.select_change(&select(c, "select_change"), &mut Guard::allow()));
                assert_eq!(selected["member"]["change"], c);
                let inspected =
                    value(&h.inspect_change(&select(c, "inspect_change"), &mut Guard::allow()));
                assert_eq!(inspected["change"], c);
                assert_eq!(inspected["coverage"]["complete"], true);
                assert_eq!(inspected["record"]["result"]["actor"], "owner-1");
            }
            let page = value(&h.list_changes(&list(1, Value::Null), &mut Guard::allow()));
            assert_eq!(page["members"][0]["change"], "change-a");
            assert_eq!(
                value(&h.list_changes(&list(1, page["next"].clone()), &mut Guard::allow()))
                    ["members"][0]["change"],
                "change-b"
            );
        }
        "fresh" | "resume" => (),
        _ => panic!("unknown action"),
    }
    drop(h);
    std::mem::forget(f); // Parent owns test-directory cleanup.
}
#[test]
fn public_process_pages_selection_original_retry_and_nonmutation() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    assert!(f.child("fresh", None).success());
    assert!(f.child("create-a", None).success());
    assert!(f.child("create-b", None).success());
    let before = snapshot(&f.0);
    assert!(f.child("inspect", None).success());
    assert!(f.child("create-a", None).success());
    assert_eq!(snapshot(&f.0), before);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let page = h.list_changes(&list(1, Value::Null), &mut Guard::allow());
    let v = value(&page);
    use sha2::{Digest, Sha256};
    assert_eq!(
        v["members"][0]["accepted"]["sha256"],
        format!(
            "{:x}",
            Sha256::digest(fs::read(f.member(1, "trace.jsonl")).unwrap())
        )
    );
}
#[test]
fn closed_input_authorization_cursor_and_final_suppression() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    for b in [br#"{"v":4,"v":4}"#.as_slice(),br#"{"v":1,"op":"list_changes"}"#,br#"[]"#,br#"{"v":4,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"x","what":"ok","why":null,"why":null}"#]{assert_eq!(h.create_change(&LedgerInput::new(b.to_vec()),&mut Guard::allow()),E::InvalidInput.json());assert_eq!(h.last_work().shared_passes,0);}
    assert_eq!(
        h.create_change(&list(1, Value::Null), &mut Guard::allow()),
        E::Unsupported.json()
    );
    let mut g = Guard::allow();
    g.denied = Some("change-a".into());
    let p = value(&h.list_changes(&list(4, Value::Null), &mut g));
    assert_eq!(p["members"].as_array().unwrap().len(), 1);
    assert_eq!(p["members"][0]["change"], "change-b");
    let cursor = json!({"v":4,"ledger":"ledger-1","workspace_id":"workspace-1","after":"change-a","limit":1});
    assert_eq!(
        h.list_changes(&list(1, cursor.clone()), &mut g),
        E::Denied.json()
    );
    assert_eq!(h.last_work().member_passes, 0);
    assert_eq!(
        h.list_changes(&list(2, cursor), &mut Guard::allow()),
        E::InvalidInput.json()
    );
    let mut g = Guard::allow();
    g.unavailable = Some("change-a".into());
    assert_eq!(
        h.list_changes(&list(1, Value::Null), &mut g),
        E::Unavailable.json()
    );
    let mut g = Guard::allow();
    g.final_deny = true;
    assert_eq!(
        h.inspect_change(&select("change-a", "inspect_change"), &mut g),
        E::Denied.json()
    );
    assert_eq!(h.last_work().outputs.completions, 1);
    assert_eq!(
        h.create_change(
            &create("a", "changed", Some("Keep original reason")),
            &mut Guard::allow()
        ),
        E::Conflict.json()
    );
    assert_eq!(snapshot(&f.0), before);
}
#[test]
fn scoped_damage_and_observed_read_incident_keep_b_usable() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let before = fs::read(f.path("creation.json")).unwrap();
    let hook = fault(
        event(1, "recover", "trace.jsonl", "before_read"),
        LedgerIoFault::Io,
    );
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    assert_eq!(
        h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().retention.attempts, 1);
    assert_eq!(h.last_work().retention.matches, 1);
    assert_eq!(
        value(&h.inspect_change(&select("change-b", "inspect_change"), &mut Guard::allow()))
            ["kind"],
        "inspection"
    );
    drop(h);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(
        h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_created(
        &h.create_change(
            &create("b", "Record backup cleanup", None),
            &mut Guard::allow(),
        ),
        "change-b",
    );
    assert_eq!(fs::read(f.path("creation.json")).unwrap(), before);
    let f = Fixture::new();
    f.two();
    fs::remove_file(f.member(1, "checkpoint.json")).unwrap();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(
        h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(
        value(&h.select_change(&select("change-b", "select_change"), &mut Guard::allow()))["kind"],
        "selection"
    );
    let mut g = Guard::allow();
    g.denied = Some("change-a".into());
    assert_eq!(
        value(&h.list_changes(&list(4, Value::Null), &mut g))["members"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    assert_eq!(snapshot(&f.0), before);
}
#[test]
fn producer_cuts_reconnect_shared_only_and_deferred_original_proof() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for cut in [
        event(0, "associate", "creation.tmp", "synced"),
        event(0, "associate", "creation.tmp", "before_rename"),
    ] {
        let f = Fixture::new();
        f.provision();
        assert_eq!(f.child("create-a", Some(cut)).code(), Some(71));
        let before = snapshot(&f.0);
        let mut h = f.host(Mode::Reopen, None).unwrap();
        assert_eq!(h.connection_work().member_passes, 0);
        for op in ["select_change", "inspect_change"] {
            let b = select("change-a", op);
            let response = if op == "select_change" {
                h.select_change(&b, &mut Guard::allow())
            } else {
                h.inspect_change(&b, &mut Guard::allow())
            };
            assert_eq!(response, E::Unavailable.json());
            assert_eq!(h.last_work().member_passes, 0);
        }
        assert_eq!(
            h.list_changes(&list(1, Value::Null), &mut Guard::allow()),
            E::Unavailable.json()
        );
        assert_eq!(h.last_work().member_passes, 0);
        assert_eq!(
            h.create_change(&create("b", "other", None), &mut Guard::allow()),
            E::Unavailable.json()
        );
        assert_eq!(h.last_work().member_passes, 0);
        let mut g = Guard::allow();
        g.denied = Some("change-a".into());
        assert_eq!(
            h.create_change(
                &create("a", "Record settings cleanup", Some("Keep original reason")),
                &mut g
            ),
            E::Denied.json()
        );
        assert_eq!(h.last_work().member_passes, 0);
        assert_eq!(
            h.create_change(&create("a", "changed", None), &mut Guard::allow()),
            E::Conflict.json()
        );
        assert_eq!(snapshot(&f.0), before);
        assert_created(
            &h.create_change(
                &create("a", "Record settings cleanup", Some("Keep original reason")),
                &mut Guard::allow(),
            ),
            "change-a",
        );
        bounds(h.last_work(), true);
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
fn capacity_sixteen_large_text_and_competing_writer() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert!(f.child("contender", None).success());
    let what = "\u{0001}".repeat(65535) + "x";
    for i in 0..16 {
        assert_created(
            &h.create_change(
                &create(&i.to_string(), &what, Some(&"\u{0002}".repeat(65536))),
                &mut Guard::allow(),
            ),
            &format!("change-{}", (b'a' + i as u8) as char),
        );
        bounds(h.last_work(), true);
    }
    assert_eq!(
        h.create_change(&create("overflow", "ok", None), &mut Guard::allow()),
        E::Unsupported.json()
    );
    for slot in 1..=16 {
        fs::copy(
            f.member(slot, "checkpoint.json"),
            f.member(slot, "checkpoint.tmp"),
        )
        .unwrap();
    }
    let before = snapshot(&f.0);
    let p = value(&h.list_changes(&list(4, Value::Null), &mut Guard::allow()));
    assert_eq!(p["members"].as_array().unwrap().len(), 4);
    assert_eq!(snapshot(&f.0), before);
    bounds(h.last_work(), false);
    eprintln!("R27 full-ledger list work: {:?}", h.last_work());
    assert_eq!(h.last_work().origin_emissions.attempts, 32);
    assert_eq!(h.last_work().input_emissions.attempts, 0);
    assert_eq!(h.last_work().control_emissions.attempts, 150);
    assert_eq!(h.last_work().reply_emissions.attempts, 1);
    assert_created(
        &h.create_change(
            &create("0", &what, Some(&"\u{0002}".repeat(65536))),
            &mut Guard::allow(),
        ),
        "change-a",
    );
    bounds(h.last_work(), true);
}

#[test]
fn producer_acceptance_cut_and_lost_reply_retain_one_original() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (action, cut) in [
        ("accept-a", event(0, "associate", "creation.tmp", "synced")),
        ("create-a", event(0, "deliver", "reply", "before")),
    ] {
        let f = Fixture::new();
        f.provision();
        assert_eq!(f.child(action, Some(cut)).code(), Some(71));
        let trace = fs::read(f.member(1, "trace.jsonl")).unwrap();
        let mut h = f.host(Mode::Reopen, None).unwrap();
        assert_eq!(h.connection_work().member_passes, 0);
        if action == "accept-a" {
            let before = snapshot(&f.0);
            assert_eq!(
                h.list_changes(&list(1, Value::Null), &mut Guard::allow()),
                E::Unavailable.json()
            );
            assert_eq!(h.last_work().member_passes, 0);
            assert_eq!(
                h.create_change(&create("a", "changed", None), &mut Guard::allow()),
                E::Conflict.json()
            );
            assert_eq!(snapshot(&f.0), before);
        }
        assert_created(
            &h.create_change(
                &create("a", "Record settings cleanup", Some("Keep original reason")),
                &mut Guard::allow(),
            ),
            "change-a",
        );
        bounds(h.last_work(), true);
        assert_eq!(fs::read(f.member(1, "trace.jsonl")).unwrap(), trace);
        assert_eq!(trace.iter().filter(|&&b| b == b'\n').count(), 1);
    }
}
#[test]
fn crossed_ready_witness_cannot_bootstrap_or_cleanup() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    assert_eq!(
        f.child(
            "create-a",
            Some(event(0, "associate", "creation.tmp", "synced"))
        )
        .code(),
        Some(71)
    );
    // Producer-derived ready temporary remains valid; authoritative installed
    // member state is independently made unknown. No proof may repair it first.
    let mut bytes = fs::read(f.member(1, "checkpoint.json")).unwrap();
    bytes.push(b' ');
    fs::write(f.member(1, "checkpoint.json"), bytes).unwrap();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(h.connection_work().member_passes, 0);
    assert_eq!(
        h.create_change(
            &create("a", "Record settings cleanup", Some("Keep original reason")),
            &mut Guard::allow()
        ),
        E::Unavailable.json()
    );
    assert!(h.last_work().member_passes > 0);
    assert_eq!(h.last_work().cleanup.attempts, 0);
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
}
#[test]
fn local_append_and_checkpoint_cuts_resume_without_second_origin() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for cut in [
        event(1, "reserve", "checkpoint.tmp", "synced"),
        event(1, "append", "trace.jsonl", "written"),
        event(1, "checkpoint", "checkpoint.tmp", "synced"),
        event(1, "checkpoint", "checkpoint.tmp", "renamed"),
    ] {
        let f = Fixture::new();
        f.provision();
        assert_eq!(f.child("create-a", Some(cut)).code(), Some(71));
        assert!(f.child("create-a", None).success());
        let trace = fs::read(f.member(1, "trace.jsonl")).unwrap();
        assert_eq!(trace.iter().filter(|&&b| b == b'\n').count(), 1);
    }
    // Actual partial write, retained local incident, no fictitious success.
    let f = Fixture::new();
    f.provision();
    let mut h = f
        .host(
            Mode::Reopen,
            Some(fault(
                event(1, "append", "trace.jsonl", "before_write"),
                LedgerIoFault::ShortWrite,
            )),
        )
        .unwrap();
    assert_eq!(
        h.create_change(
            &create("a", "Record settings cleanup", Some("Keep original reason")),
            &mut Guard::allow()
        ),
        E::Unavailable.json()
    );
    let w = h.last_work();
    assert_eq!(w.retention.attempts, 1);
    assert_eq!(w.retention.matches, 1);
    assert_eq!(
        value(&fs::read(f.member(1, "incident.json")).unwrap())["issue"],
        "short_write"
    );
    assert!(!fs::read(f.member(1, "trace.jsonl")).unwrap().is_empty());
}
#[test]
fn preparing_resume_and_orphan_refusal_are_process_witnesses() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    assert_eq!(
        f.child("fresh", Some(event(0, "provision", "anchor.tmp", "synced")))
            .code(),
        Some(71)
    );
    assert!(f.child("resume", None).success());
    assert_eq!(
        value(&fs::read(f.0.join("anchor.json")).unwrap())["stage"],
        "installed"
    );
    let f = Fixture::new();
    assert_eq!(
        f.child("fresh", Some(event(0, "provision", "directory", "created")))
            .code(),
        Some(71)
    );
    let before = snapshot(&f.0);
    assert!(matches!(
        f.host(Mode::FreshProvision, None),
        Err(E::Unavailable)
    ));
    assert!(matches!(
        f.host(Mode::ResumeProvision, None),
        Err(E::Unavailable)
    ));
    assert_eq!(snapshot(&f.0), before);
}
#[test]
fn tail_damage_physical_copy_and_shared_failure_scope() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    use std::io::Write;
    fs::OpenOptions::new()
        .append(true)
        .open(f.member(1, "trace.jsonl"))
        .unwrap()
        .write_all(b"unaccepted and not decoded\n")
        .unwrap();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let inspected =
        value(&h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()));
    assert_eq!(inspected["progress"], "blocked_unaccepted_tail");
    assert_eq!(inspected["coverage"]["complete"], true);
    assert_eq!(snapshot(&f.0), before);
    drop(h);
    let anchor = fs::read(f.path("members/m-1.anchor.json")).unwrap();
    fs::write(f.path("members/m-2.anchor.json"), anchor).unwrap();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(
        h.select_change(&select("change-b", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(
        value(&h.select_change(&select("change-a", "select_change"), &mut Guard::allow()))["kind"],
        "selection"
    );
    assert_eq!(snapshot(&f.0), before);
    drop(h);
    let f = Fixture::new();
    f.two();
    assert!(matches!(
        f.host(
            Mode::Reopen,
            Some(fault(
                event(0, "recover", "creation.json", "before_read"),
                LedgerIoFault::Io
            ))
        ),
        Err(E::Unavailable)
    ));
    let w = LedgerWork::last_call();
    assert_eq!(w.member_passes, 0);
    assert_eq!(w.retention.attempts, 1);
    assert_eq!(
        value(&fs::read(f.path("incident.json")).unwrap())["state"],
        "blocked"
    );
    assert!(matches!(f.host(Mode::Reopen, None), Err(E::Unavailable)));
}
#[test]
fn failed_barrier_retention_failure_and_post_io_refusal_differ() {
    // Avoid cross-fixture fork/exec custody overlap in parallel test threads.
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let hook: LedgerIoHook = Box::new(|e| {
        if e == event(1, "deliver", "trace.jsonl", "before_sync")
            || e == event(1, "deliver", "incident.tmp", "before_write")
        {
            LedgerIoFault::Io
        } else {
            LedgerIoFault::Continue
        }
    });
    let mut h = f.host(Mode::Reopen, Some(hook)).unwrap();
    assert_eq!(
        h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    let w = h.last_work();
    assert_eq!(w.outputs.completions, 1);
    assert_eq!(w.retention.attempts, 1);
    assert_eq!(w.retention.no_matches, 1);
    assert!(f.member(1, "incident.tmp").exists());
    assert_eq!(
        value(&h.inspect_change(&select("change-b", "inspect_change"), &mut Guard::allow()))
            ["kind"],
        "inspection"
    );
    drop(h);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(
        h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    drop(h);
    let f = Fixture::new();
    f.two();
    let before = snapshot(&f.0);
    let mut h = f
        .host(
            Mode::Reopen,
            Some(fault(
                event(1, "recover", "trace.jsonl", "read"),
                LedgerIoFault::Refuse,
            )),
        )
        .unwrap();
    assert_eq!(
        h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
}

#[test]
fn exact_published_origin_and_compact_cursor_bytes() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_created(
        &h.create_change(
            &create("a", "Record settings cleanup", Some("Keep original reason")),
            &mut Guard::allow(),
        ),
        "change-a",
    );
    let origin=b"{\"v\":4,\"custody\":\"custody-a\",\"ledger\":\"ledger-1\",\"workspace_id\":\"workspace-1\",\"binding\":\"fixture@1\",\"change\":\"change-a\",\"seq\":1,\"prev\":null,\"kind\":\"created\",\"input\":{\"v\":4,\"op\":\"create_change\",\"ledger\":\"ledger-1\",\"workspace_id\":\"workspace-1\",\"key\":\"create-a\",\"what\":\"Record settings cleanup\",\"why\":\"Keep original reason\"},\"result\":{\"v\":4,\"kind\":\"created\",\"ledger\":\"ledger-1\",\"workspace_id\":\"workspace-1\",\"change\":\"change-a\",\"key\":\"create-a\",\"actor\":\"owner-1\",\"result\":\"change-a:origin\",\"seq\":1}}\n";
    assert_eq!(fs::read(f.member(1, "trace.jsonl")).unwrap(), origin);
    assert_eq!(
        value(&h.select_change(&select("change-a", "select_change"), &mut Guard::allow()))
            ["member"]["accepted"]["sha256"],
        "caf5870bfa76cb94b8e7a380a5e530468272f73a1950740dfbab66e2d0e93b6f"
    );
}
#[test]
fn oversized_ingress_tail_and_changed_visibility_fail_closed() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let before = snapshot(&f.0);
    assert_eq!(
        h.create_change(
            &LedgerInput::new(vec![b' '; 1_048_577]),
            &mut Guard::allow()
        ),
        E::InvalidInput.json()
    );
    assert_eq!(h.last_work().ingress.attempts, 0);
    assert_eq!(h.last_work().shared_passes, 0);
    for b in [
        create("too-long", &"x".repeat(65537), None),
        create("blank", " \t\n", None),
        list(5, Value::Null),
    ] {
        assert_eq!(
            h.create_change(&b, &mut Guard::allow()),
            E::InvalidInput.json()
        );
        assert_eq!(h.last_work().shared_passes, 0);
    }
    struct Expanding(usize);
    impl LedgerGuard for Expanding {
        fn principal(&self) -> &str {
            "owner-1"
        }
        fn collection(&mut self, _: &str, _: CP) -> P {
            P::Allow
        }
        fn member(&mut self, _: &str, c: &str, p: MP) -> P {
            if c == "change-a" && p == MP::Metadata {
                self.0 += 1;
                if self.0 == 1 {
                    return P::Deny;
                }
            }
            P::Allow
        }
    }
    assert_eq!(
        h.list_changes(&list(4, Value::Null), &mut Expanding(0)),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().outputs.completions, 1);
    assert_eq!(snapshot(&f.0), before);
    drop(h);
    fs::OpenOptions::new()
        .write(true)
        .open(f.member(1, "trace.jsonl"))
        .unwrap()
        .set_len(2_097_153)
        .unwrap();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(
        h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
}

#[test]
fn live_keyset_pagination_survives_allocation_order_mutation() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    let mut pairs = Fixture::pairs();
    pairs.swap(0, 3);
    pairs.swap(2, 5);
    let grant = f.grant_with(&pairs);
    let mut h = LedgerHost::connect(
        grant.clone(),
        Mode::FreshProvision,
        &mut Guard::allow(),
        None,
    )
    .unwrap();
    assert_created(
        &h.create_change(&create("first-d", "D", None), &mut Guard::allow()),
        "change-d",
    );
    assert_created(
        &h.create_change(&create("first-b", "B", None), &mut Guard::allow()),
        "change-b",
    );
    let page = value(&h.list_changes(&list(1, Value::Null), &mut Guard::allow()));
    assert_eq!(page["members"][0]["change"], "change-b");
    let cursor = page["next"].clone();
    drop(h);
    let mut h =
        LedgerHost::connect(grant.clone(), Mode::Reopen, &mut Guard::allow(), None).unwrap();
    assert_created(
        &h.create_change(&create("later-f", "F", None), &mut Guard::allow()),
        "change-f",
    );
    assert_created(
        &h.create_change(&create("later-a", "A", None), &mut Guard::allow()),
        "change-a",
    );
    drop(h);
    let mut h = LedgerHost::connect(grant, Mode::Reopen, &mut Guard::allow(), None).unwrap();
    let next = value(&h.list_changes(&list(1, cursor.clone()), &mut Guard::allow()));
    assert_eq!(next["members"][0]["change"], "change-d");
    let terminal = value(&h.list_changes(&list(1, next["next"].clone()), &mut Guard::allow()));
    assert_eq!(terminal["members"][0]["change"], "change-f");
    assert_eq!(terminal["next"], Value::Null);
    let restart = value(&h.list_changes(&list(4, Value::Null), &mut Guard::allow()));
    let names = restart["members"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["change"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(names, ["change-a", "change-b", "change-d", "change-f"]);
    let mut g = Guard::allow();
    g.denied = Some("change-b".into());
    assert_eq!(h.list_changes(&list(1, cursor), &mut g), E::Denied.json());
    assert_eq!(h.last_work().member_passes, 0);
}
#[test]
fn deferred_cleanup_real_syscall_failure_retains_shared_incident() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    assert_eq!(
        f.child(
            "accept-a",
            Some(event(0, "associate", "creation.tmp", "synced"))
        )
        .code(),
        Some(71)
    );
    let trace = fs::read(f.member(1, "trace.jsonl")).unwrap();
    let mut h = f
        .host(
            Mode::Reopen,
            Some(fault(
                event(0, "recover", "creation.tmp", "before_unlink"),
                LedgerIoFault::Io,
            )),
        )
        .unwrap();
    assert_eq!(h.connection_work().member_passes, 0);
    assert_eq!(
        h.create_change(
            &create("a", "Record settings cleanup", Some("Keep original reason")),
            &mut Guard::allow()
        ),
        E::Unavailable.json()
    );
    let w = h.last_work();
    assert_eq!(w.cleanup.attempts, 1);
    assert_eq!(w.cleanup.completions, 0);
    assert_eq!(w.retention.attempts, 1);
    assert_eq!(w.retention.matches, 1);
    bounds(w, true);
    assert!(f.path("creation.tmp").exists());
    assert_eq!(fs::read(f.member(1, "trace.jsonl")).unwrap(), trace);
    assert_eq!(
        value(&fs::read(f.path("incident.json")).unwrap())["state"],
        "blocked"
    );
}

#[test]
fn reconnect_preserves_installed_equal_and_reserved_shared_remnants() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    fs::copy(f.path("creation.json"), f.path("creation.tmp")).unwrap();
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(h.connection_work().member_passes, 0);
    assert_eq!(h.connection_work().cleanup.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    assert_eq!(
        value(&h.list_changes(&list(1, Value::Null), &mut Guard::allow()))["kind"],
        "changes"
    );
    assert_eq!(h.last_work().cleanup.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(h.last_work(), false);
    drop(h);
    let f = Fixture::new();
    f.provision();
    assert_eq!(
        f.child(
            "create-a",
            Some(event(0, "reserve", "creation.tmp", "synced"))
        )
        .code(),
        Some(71)
    );
    let before = snapshot(&f.0);
    let mut h = f.host(Mode::Reopen, None).unwrap();
    assert_eq!(h.connection_work().member_passes, 0);
    assert_eq!(h.connection_work().cleanup.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    let mut denied = Guard::allow();
    denied.denied = Some("change-a".into());
    assert_eq!(
        h.create_change(
            &create("a", "Record settings cleanup", Some("Keep original reason")),
            &mut denied
        ),
        E::Denied.json()
    );
    assert_eq!(snapshot(&f.0), before);
    assert_created(
        &h.create_change(
            &create("a", "Record settings cleanup", Some("Keep original reason")),
            &mut Guard::allow(),
        ),
        "change-a",
    );
    assert!(!f.path("creation.tmp").exists());
    bounds(h.last_work(), true);
}

#[test]
fn actual_shared_parent_failures_latch_shared_not_member() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for cut in [
        event(1, "deliver", "anchor_parent", "before_sync"),
        event(3, "provision", "anchor_parent", "before_sync"),
        event(3, "provision", "anchor.json", "before_create"),
        event(1, "provision", "anchor.tmp", "before_unlink"),
    ] {
        let f = Fixture::new();
        if cut.object == "anchor.tmp" {
            f.provision();
            assert_eq!(
                f.child(
                    "create-a",
                    Some(event(1, "provision", "anchor.tmp", "synced"))
                )
                .code(),
                Some(71)
            );
        } else {
            f.two();
        }
        let mut h = f
            .host(Mode::Reopen, Some(fault(cut, LedgerIoFault::Io)))
            .unwrap();
        let result = if cut.phase == "deliver" {
            h.select_change(&select("change-a", "select_change"), &mut Guard::allow())
        } else if cut.scope == 3 {
            h.create_change(&create("c", "Third member", None), &mut Guard::allow())
        } else {
            h.create_change(
                &create("a", "Record settings cleanup", Some("Keep original reason")),
                &mut Guard::allow(),
            )
        };
        assert_eq!(result, E::Unavailable.json(), "{cut:?}");
        assert_eq!(h.last_work().retention.attempts, 1, "{cut:?}");
        assert_eq!(h.last_work().retention.completions, 1, "{cut:?}");
        let incident = value(&fs::read(f.path("incident.json")).unwrap());
        assert_eq!(incident["state"], "blocked", "{cut:?}");
        assert_eq!(incident["custody"], "ledger-custody");
        assert_eq!(incident["phase"], cut.phase);
        if f.member(cut.scope as usize, "incident.json").exists() {
            assert_eq!(
                value(&fs::read(f.member(cut.scope as usize, "incident.json")).unwrap())["state"],
                "clear"
            );
        }
        assert_eq!(
            h.select_change(&select("change-b", "select_change"), &mut Guard::allow()),
            E::Unavailable.json()
        );
        assert_eq!(h.last_work().member_passes, 0);
    }
}

#[test]
fn freshly_pinned_delivery_barriers_have_current_local_justification() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for object in ["anchor.json", "trace.jsonl"] {
        let f = Fixture::new();
        f.two();
        let mut h = f
            .host(
                Mode::Reopen,
                Some(fault(
                    event(1, "deliver", object, "before_sync"),
                    LedgerIoFault::Io,
                )),
            )
            .unwrap();
        assert_eq!(
            h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
            E::Unavailable.json()
        );
        let w = h.last_work();
        assert_eq!(w.member_passes, 2);
        assert_eq!(w.retention.attempts, 1);
        assert_eq!(w.retention.completions, 1);
        bounds(w, false);
        let incident = value(&fs::read(f.member(1, "incident.json")).unwrap());
        assert_eq!(incident["state"], "blocked");
        assert_eq!(incident["custody"], "custody-a");
        assert_eq!(incident["phase"], "deliver");
        assert_eq!(
            value(&fs::read(f.path("incident.json")).unwrap())["state"],
            "clear"
        );
        assert_eq!(
            value(&h.select_change(&select("change-b", "select_change"), &mut Guard::allow()))
                ["member"]["change"],
            "change-b"
        );
        drop(h);
        let mut reopened = f.host(Mode::Reopen, None).unwrap();
        assert_eq!(
            reopened.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
            E::Unavailable.json()
        );
        assert_eq!(
            value(
                &reopened.select_change(&select("change-b", "select_change"), &mut Guard::allow())
            )["kind"],
            "selection"
        );
    }
}

#[test]
fn bounded_owning_grant_and_ingress_do_not_adopt_oversized_backings() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for path_case in [false, true] {
        let f = Fixture::new();
        let pairs = Fixture::pairs();
        let mut profile = String::with_capacity(if path_case { 11 } else { 80 * 1_048_576 });
        profile.push_str("ck-ledger@4");
        let mut directory = PathBuf::with_capacity(if path_case { 80 * 1_048_576 } else { 128 });
        directory.push(f.path(""));
        let grant = LedgerGrant::new(LedgerGrantSpec {
            profile: &profile,
            ledger: "ledger-1",
            custody: "ledger-custody",
            owner: "owner-1",
            workspace_id: "workspace-1",
            binding: "fixture@1",
            directory: &directory,
            anchor: &f.0.join("anchor.json"),
            grants: &pairs,
        })
        .unwrap();
        let mut h =
            LedgerHost::connect(grant, Mode::FreshProvision, &mut Guard::allow(), None).unwrap();
        bounds(h.connection_work(), true);
        let mut bytes = Vec::with_capacity(80 * 1_048_576);
        bytes.extend_from_slice(create("a", "ok", None).as_bytes());
        let refused = LedgerInput::new(bytes);
        assert_eq!(refused.capacity(), 0);
        let before = snapshot(&f.0);
        assert_eq!(
            h.create_change(&refused, &mut Guard::allow()),
            E::InvalidInput.json()
        );
        assert_eq!(h.last_work().ingress.attempts, 0);
        assert_eq!(h.last_work().shared_passes, 0);
        assert_eq!(snapshot(&f.0), before);
        bounds(h.last_work(), true);
        let request = create("a", "ok", None);
        assert_created(&h.create_change(&request, &mut Guard::allow()), "change-a");
        assert!(h.last_work().named_payload_peak >= request.capacity() as u64);
        bounds(h.last_work(), true);
    }
}

#[test]
fn failed_partial_decode_and_canonical_emitter_keep_real_capacities() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let mut bytes = format!("{{\"what\":\"{}\"}}", "\\n".repeat(100_000)).into_bytes();
    bytes.shrink_to_fit();
    let request = LedgerInput::new(bytes);
    let before = snapshot(&f.0);
    assert_eq!(
        h.create_change(&request, &mut Guard::allow()),
        E::InvalidInput.json()
    );
    assert!(h.last_work().named_payload_peak >= request.capacity() as u64 + 200_000);
    assert_eq!(h.last_work().constructions.attempts, 1);
    assert_eq!(h.last_work().constructions.completions, 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(h.last_work(), true);
    // Known field values still allocate bounded partial strings. Impossible long
    // names now fail before a scanner/key copy, while owning ingress stays counted.
    let request = LedgerInput::new(format!("{{\"{}\":1}}", "x".repeat(65_536)).into_bytes());
    assert_eq!(
        h.create_change(&request, &mut Guard::allow()),
        E::InvalidInput.json()
    );
    assert!(h.last_work().named_payload_peak >= request.capacity() as u64);
    bounds(h.last_work(), true);
    let control = format!(
        "{{\"format\":\"ck-ledger-incident@4\",\"custody\":\"{}\",\"state\":\"clear\"}}\n",
        "\\n".repeat(200_000)
    );
    fs::write(f.path("incident.json"), control.as_bytes()).unwrap();
    let before = snapshot(&f.0);
    assert_eq!(
        h.list_changes(&list(1, Value::Null), &mut Guard::allow()),
        E::Unavailable.json()
    );
    let w = h.last_work();
    assert!(w.emissions.attempts > w.emissions.completions);
    assert!(w.named_payload_peak >= 1_048_576 + 2 * 400_000, "{w:?}");
    assert_eq!(w.retention.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(w, false);
}

#[test]
fn wrong_canonical_digest_and_failed_acquisition_are_observed() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let original = fs::read_to_string(f.member(1, "checkpoint.json")).unwrap();
    let digest = value(original.as_bytes())["sha256"]
        .as_str()
        .unwrap()
        .to_owned();
    let wrong = if digest == "0".repeat(64) {
        "1".repeat(64)
    } else {
        "0".repeat(64)
    };
    fs::write(
        f.member(1, "checkpoint.json"),
        original.replace(&digest, &wrong),
    )
    .unwrap();
    let at_trace = std::sync::Arc::new(std::sync::Mutex::new(None));
    let captured = at_trace.clone();
    let mut h = f
        .host(
            Mode::Reopen,
            Some(Box::new(move |e| {
                if e == event(1, "recover", "trace.jsonl", "read") {
                    *captured.lock().unwrap() = Some(LedgerWork::last_call().fields);
                }
                LedgerIoFault::Continue
            })),
        )
        .unwrap();
    let before = snapshot(&f.0);
    assert_eq!(
        h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    let at_trace = at_trace.lock().unwrap().unwrap();
    let w = h.last_work();
    assert!(w.fields.attempts > at_trace.attempts);
    assert!(w.fields.no_matches > at_trace.no_matches);
    assert!(w.fields.operand_bytes >= at_trace.operand_bytes + 64);
    assert_eq!(w.origins.attempts, 0);
    assert_eq!(w.retention.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(w, false);
    fs::remove_file(f.member(2, "writer.lock")).unwrap();
    assert_eq!(
        h.select_change(&select("change-b", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert_eq!(h.last_work().member_passes, 1);
    assert_eq!(h.last_work().origins.attempts, 0);
    bounds(h.last_work(), false);
}

#[test]
fn unicode_and_malformed_string_edges_preserve_closed_wire_semantics() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let request=LedgerInput::new(br#"{"v":4,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-a","what":"\ud83d\ude00\n\"\\","why":"\u0061"}"#.to_vec());
    assert_created(&h.create_change(&request, &mut Guard::allow()), "change-a");
    let inspected =
        value(&h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()));
    assert_eq!(inspected["record"]["input"]["what"], "😀\n\"\\");
    assert_eq!(inspected["record"]["input"]["why"], "a");
    bounds(h.last_work(), false);
    let before = snapshot(&f.0);
    for what in [r"\ud800", r"\udc00", r"\ud800\u0000", r"\q"] {
        let request=LedgerInput::new(format!(r#"{{"v":4,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"create-b","what":"{what}","why":null}}"#).into_bytes());
        assert_eq!(
            h.create_change(&request, &mut Guard::allow()),
            E::InvalidInput.json()
        );
        assert_eq!(h.last_work().shared_passes, 0);
        bounds(h.last_work(), true);
    }
    assert_eq!(snapshot(&f.0), before);
}

#[test]
fn refused_version_and_missing_checkpoint_publish_false_predicates() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.two();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let mut request = value(create("c", "valid shape", None).as_bytes());
    request["v"] = json!(3);
    assert_eq!(
        h.create_change(
            &LedgerInput::new(serde_json::to_vec(&request).unwrap()),
            &mut Guard::allow()
        ),
        E::InvalidInput.json()
    );
    assert_eq!(h.last_work().ingress.attempts, 1);
    assert_eq!(h.last_work().ingress.completions, 0);
    assert!(h.last_work().fields.no_matches > 0);
    assert_eq!(h.last_work().shared_passes, 0);
    drop(h);
    fs::remove_file(f.member(1, "checkpoint.json")).unwrap();
    let captured = std::sync::Arc::new(std::sync::Mutex::new(None));
    let capture = captured.clone();
    let mut h = f
        .host(
            Mode::Reopen,
            Some(Box::new(move |e| {
                if e == event(1, "recover", "anchor.json", "read") {
                    *capture.lock().unwrap() = Some(LedgerWork::last_call().fields);
                }
                LedgerIoFault::Continue
            })),
        )
        .unwrap();
    let before = snapshot(&f.0);
    assert_eq!(
        h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    let captured = captured.lock().unwrap().unwrap();
    assert!(h.last_work().fields.no_matches > captured.no_matches);
    assert_eq!(h.last_work().origins.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(h.last_work(), false);
}

#[test]
fn changed_anchor_directory_charges_actual_available_grant_rhs() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let owner = Fixture::new();
    let mut base = owner.0.clone();
    for _ in 0..23 {
        base.push("x".repeat(80));
    }
    fs::create_dir_all(&base).unwrap();
    let f = Fixture(base);
    f.provision();
    let directory = f.0.join("ledger");
    assert!(directory.as_os_str().len() > 1800);
    let text = fs::read_to_string(f.0.join("anchor.json")).unwrap();
    let needle = format!("\"directory\":\"{}\"", directory.to_str().unwrap());
    assert!(text.contains(&needle));
    fs::write(
        f.0.join("anchor.json"),
        text.replace(&needle, "\"directory\":\"\""),
    )
    .unwrap();
    let captured = std::sync::Arc::new(std::sync::Mutex::new(None));
    let capture = captured.clone();
    assert!(matches!(
        f.host(
            Mode::Reopen,
            Some(Box::new(move |e| {
                if e == event(0, "recover", "anchor.json", "read") {
                    *capture.lock().unwrap() = Some(LedgerWork::last_call().relationships);
                }
                LedgerIoFault::Continue
            }))
        ),
        Err(E::Unavailable)
    ));
    let captured = captured.lock().unwrap().unwrap();
    let w = LedgerWork::last_call();
    assert!(w.relationships.no_matches > captured.no_matches);
    assert!(
        w.relationships.operand_bytes - captured.operand_bytes
            >= directory.as_os_str().len() as u64
    );
    bounds(w, false);
}

#[test]
fn borrowed_canonical_input_hash_handles_escaped_structure_and_checks_association() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let text = " }\n\"input\":{\"what\":\"braces{}\"} 😀 \0\\";
    assert_created(
        &h.create_change(&create("a", text, Some(text)), &mut Guard::allow()),
        "change-a",
    );
    let inspected =
        value(&h.inspect_change(&select("change-a", "inspect_change"), &mut Guard::allow()));
    assert_eq!(inspected["record"]["input"]["what"], text);
    assert_eq!(inspected["record"]["input"]["why"], text);
    assert_eq!(h.last_work().input_emissions.attempts, 0);
    bounds(h.last_work(), false);
    let accepted = fs::read_to_string(f.path("creation.json")).unwrap();
    let digest = value(accepted.as_bytes())["entries"][0]["input_sha256"]
        .as_str()
        .unwrap()
        .to_owned();
    let wrong = if digest == "0".repeat(64) {
        "1".repeat(64)
    } else {
        "0".repeat(64)
    };
    fs::write(f.path("creation.json"), accepted.replace(&digest, &wrong)).unwrap();
    let before = snapshot(&f.0);
    assert_eq!(
        h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
        E::Unavailable.json()
    );
    assert!(h.last_work().relationships.no_matches > 0);
    assert_eq!(h.last_work().input_emissions.attempts, 0);
    assert_eq!(h.last_work().retention.attempts, 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(h.last_work(), false);
}

#[test]
fn absent_required_request_fields_and_empty_discriminator_are_observed() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let before = snapshot(&f.0);
    for name in ["v", "op", "ledger", "workspace_id"] {
        let mut request = value(create("a", "valid", None).as_bytes());
        request.as_object_mut().unwrap().remove(name);
        assert_eq!(
            h.create_change(
                &LedgerInput::new(serde_json::to_vec(&request).unwrap()),
                &mut Guard::allow()
            ),
            E::InvalidInput.json()
        );
        assert!(
            h.last_work().fields.no_matches > 0,
            "missing {name}: {:?}",
            h.last_work()
        );
        assert_eq!(h.last_work().ingress.completions, 0);
        assert_eq!(h.last_work().shared_passes, 0);
        bounds(h.last_work(), true);
    }
    assert_eq!(
        h.create_change(
            &LedgerInput::new(br#"{"":4}"#.to_vec()),
            &mut Guard::allow()
        ),
        E::InvalidInput.json()
    );
    assert!(h.last_work().fields.operand_bytes >= 12);
    assert!(h.last_work().fields.no_matches > 0);
    assert_eq!(snapshot(&f.0), before);
    bounds(h.last_work(), true);
}

#[test]
fn incident_required_fields_short_state_and_temporary_refusal_are_observed() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for missing in ["state", "format", "custody", "short-state", "temporary"] {
        let f = Fixture::new();
        f.two();
        let captured = std::sync::Arc::new(std::sync::Mutex::new(None));
        let capture = captured.clone();
        let cut = if missing == "temporary" {
            event(1, "recover", "anchor.json", "read")
        } else {
            event(1, "recover", "incident.json", "read")
        };
        let mut h = f
            .host(
                Mode::Reopen,
                Some(Box::new(move |e| {
                    if e == cut {
                        *capture.lock().unwrap() = Some(LedgerWork::last_call().fields);
                    }
                    LedgerIoFault::Continue
                })),
            )
            .unwrap();
        if missing == "temporary" {
            fs::write(f.member(1, "incident.tmp"), b"").unwrap();
        } else {
            let mut control = value(&fs::read(f.member(1, "incident.json")).unwrap());
            if missing == "short-state" {
                control["state"] = json!("q");
            } else {
                control.as_object_mut().unwrap().remove(missing);
            }
            fs::write(
                f.member(1, "incident.json"),
                serde_json::to_vec(&control).unwrap(),
            )
            .unwrap();
        }
        let before = snapshot(&f.0);
        assert_eq!(
            h.select_change(&select("change-a", "select_change"), &mut Guard::allow()),
            E::Unavailable.json()
        );
        let previous = captured.lock().unwrap().unwrap();
        assert!(
            h.last_work().fields.no_matches > previous.no_matches,
            "{missing}: {:?}",
            h.last_work()
        );
        if missing == "short-state" {
            assert!(h.last_work().fields.operand_bytes - previous.operand_bytes >= 7);
        }
        assert_eq!(h.last_work().retention.attempts, 0);
        assert_eq!(snapshot(&f.0), before);
        bounds(h.last_work(), false);
        assert_eq!(
            value(&h.select_change(&select("change-b", "select_change"), &mut Guard::allow()))
                ["kind"],
            "selection"
        );
    }
}

#[test]
fn short_workspace_uses_complete_available_association_rhs() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    let f = Fixture::new();
    f.provision();
    let mut h = f.host(Mode::Reopen, None).unwrap();
    let mut request = value(create("a", "valid", None).as_bytes());
    request["workspace_id"] = json!("w");
    // Keep the comparison's exact pre-guard prefix observable: this scope is
    // resolved immediately after the failed pair, before any private lookup.
    struct Capture {
        fields: Option<changekernel::LedgerBoundary>,
    }
    impl LedgerGuard for Capture {
        fn principal(&self) -> &str {
            "owner-1"
        }
        fn collection(&mut self, _: &str, _: CP) -> P {
            self.fields = Some(LedgerWork::last_call().fields);
            P::Allow
        }
        fn member(&mut self, _: &str, _: &str, _: MP) -> P {
            P::Allow
        }
    }
    let mut capture = Capture { fields: None };
    assert_eq!(
        h.create_change(
            &LedgerInput::new(serde_json::to_vec(&request).unwrap()),
            &mut capture
        ),
        E::Denied.json()
    );
    let fields = capture.fields.unwrap();
    // Known decoder discriminator/presence/schema charges are independently
    // observed using the same decoded request, but an earlier unsupported lane.
    let mut guard = Guard::allow();
    assert_eq!(
        h.list_changes(
            &LedgerInput::new(serde_json::to_vec(&request).unwrap()),
            &mut guard
        ),
        E::Unsupported.json()
    );
    let before_pair =
        h.last_work().fields.operand_bytes - "list_changes".len().max("create_change".len()) as u64;
    assert!(fields.operand_bytes - before_pair - "create_change".len() as u64 >= 19);
    assert!(fields.no_matches > 0);
    assert_eq!(h.last_work().shared_passes, 0);
}

#[test]
fn mode_stage_refusals_publish_their_own_false_boundary() {
    let _serial = SERIAL.lock().unwrap_or_else(|e| e.into_inner());
    for (mode, preparing) in [(Mode::Reopen, true), (Mode::ResumeProvision, false)] {
        let f = Fixture::new();
        f.provision();
        if preparing {
            let anchor = f.0.join("anchor.json");
            let original = fs::read_to_string(&anchor).unwrap();
            fs::write(
                anchor,
                original.replace("\"stage\":\"installed\"", "\"stage\":\"preparing\""),
            )
            .unwrap();
        }
        let before = snapshot(&f.0);
        assert!(matches!(f.host(mode, None), Err(E::Unavailable)));
        let w = LedgerWork::last_call();
        assert_eq!(w.controls.matches, 1);
        assert_eq!(w.relationships.matches, 17);
        assert_eq!(w.fields.no_matches, 1, "{w:?}");
        assert_eq!(w.shared_passes, 0);
        assert_eq!(w.member_passes, 0);
        assert_eq!(w.retention.attempts, 0);
        assert_eq!(snapshot(&f.0), before);
        bounds(w, false);
        if preparing {
            drop(f.host(Mode::ResumeProvision, None).unwrap());
        }
        drop(f.host(Mode::Reopen, None).unwrap());
        let installed = snapshot(&f.0);
        for refused in [Mode::ResumeProvision, Mode::FreshProvision] {
            assert!(matches!(f.host(refused, None), Err(E::Unavailable)));
            assert_eq!(LedgerWork::last_call().fields.no_matches, 1);
            assert_eq!(snapshot(&f.0), installed);
        }
    }
}
