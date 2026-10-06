#![cfg(target_os = "linux")]
//! Contract-first public consumers for the adopted ck-ledger-history@5 surface.
//! Compile/run only against an exact manager-selected implemented source revision.

use changekernel::{
    LedgerCollectionPermission, LedgerHistoryGrant, LedgerHistoryGrantSpec, LedgerHistoryGuard,
    LedgerHistoryHost, LedgerHistoryInput, LedgerHistoryMemberPermission, LedgerPair,
    LedgerPermission, OpeningMode,
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicUsize, Ordering},
    thread,
    time::{Duration, Instant},
};

static NEXT: AtomicUsize = AtomicUsize::new(0);
const A: &str = "alpha-c";
const B: &str = "beta-c";
const A_HASH: &str = "936eab01d0a2e123c93d82d55ab1e7078fcb392cb118aa0952a84f32ff8ca36b";
const ORIGIN_HASH: &str = "099d715384f574290ea0c713157eaa5dfdcdd33e0b236f11afafef73c9ab844e";
const HISTORICAL_HASH: &str = "c923d8e578f08f7ab5fac3bd57f9d37d82dfffd7dca8ccbd31011bdbcc779850";
const B_HASH: &str = "fa7df6d45e7c58380f03113a572c6bede2ebc35abd80bfb5411b4d4a33a4119c";
const Q: usize = 2_097_152;
const MATERIAL_BUDGET: usize = Q - 65_536;

struct Owner;
impl LedgerHistoryGuard for Owner {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
    fn member(&mut self, _: &str, _: &str, _: LedgerHistoryMemberPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
}

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "ck-history-consumer-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        fs::create_dir(root.join("state")).unwrap();
        Self(root)
    }
    fn state(&self) -> PathBuf {
        self.0.join("state")
    }
    fn member(&self, slot: usize, name: &str) -> PathBuf {
        self.state().join(format!("ledger/members/m-{slot}/{name}"))
    }
    fn host(&self, mode: OpeningMode) -> LedgerHistoryHost {
        connect(&self.0, mode)
    }
    fn child(&self, action: &str) {
        let log = self.0.join(format!("{action}.log"));
        let output = File::create(&log).unwrap();
        let child = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "history_process_entry", "--nocapture"])
            .env("CK_HISTORY_CONSUMER_ROOT", &self.0)
            .env("CK_HISTORY_CONSUMER_ACTION", action)
            .stdout(Stdio::from(output.try_clone().unwrap()))
            .stderr(Stdio::from(output))
            .spawn()
            .unwrap();
        let mut child = ChildCleanup(Some(child));
        let deadline = Instant::now() + Duration::from_secs(120);
        loop {
            if let Some(status) = child.0.as_mut().unwrap().try_wait().unwrap() {
                child.0.take();
                assert!(
                    status.success(),
                    "{action}: {status}; log {}:\n{}",
                    log.display(),
                    fs::read_to_string(&log).unwrap()
                );
                return;
            }
            if Instant::now() >= deadline {
                child.stop();
                panic!(
                    "{action}: 120-second deadline; child killed/reaped; log {}:\n{}",
                    log.display(),
                    fs::read_to_string(&log).unwrap()
                );
            }
            thread::sleep(Duration::from_millis(20));
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        // Failed subjects/logs remain external for diagnosis; successful subjects are removed.
        if thread::panicking() {
            eprintln!("preserved failed fixture: {}", self.0.display());
        } else {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
}
struct ChildCleanup(Option<Child>);
impl ChildCleanup {
    fn stop(&mut self) {
        if let Some(mut child) = self.0.take() {
            let _ = child.kill();
            child.wait().expect("reap history subprocess");
        }
    }
}
impl Drop for ChildCleanup {
    fn drop(&mut self) {
        self.stop();
    }
}

fn connect(root: &Path, mode: OpeningMode) -> LedgerHistoryHost {
    let pairs = std::array::from_fn(|i| LedgerPair {
        change: match i {
            0 => A.to_owned(),
            1 => B.to_owned(),
            _ => format!("other-{i}"),
        },
        custody: match i {
            0 => "member-a".to_owned(),
            1 => "member-b".to_owned(),
            _ => format!("member-{i}"),
        },
    });
    let grant = LedgerHistoryGrant::new(LedgerHistoryGrantSpec {
        profile: "ck-ledger-history@5",
        ledger: "ledger-1",
        custody: "ledger-custody",
        owner: "owner-1",
        workspace_id: "workspace-1",
        binding: "fixture@1",
        directory: &root.join("state/ledger"),
        anchor: &root.join("state/anchor.json"),
        grants: &pairs,
        policy: "fixture-notice@1",
        check: "notice-what@1",
        evaluator: "utf8-length@1",
        adopter: "owner-1",
    })
    .unwrap();
    LedgerHistoryHost::connect(grant, mode, &mut Owner, None).unwrap()
}

fn input(request: Value) -> LedgerHistoryInput {
    let mut bytes = serde_json::to_vec(&request).unwrap();
    LedgerHistoryInput::new(&mut bytes)
}
fn create(key: &str, what: &str, why: Option<&str>) -> LedgerHistoryInput {
    input(json!({"v":5,"op":"create_change","ledger":"ledger-1",
        "workspace_id":"workspace-1","key":key,"what":what,"why":why}))
}
fn reference(change: &str, seq: u64) -> String {
    if seq == 1 {
        format!("{change}:origin")
    } else {
        format!("{change}:op:{seq}")
    }
}
fn revise(
    change: &str,
    key: &str,
    expected: u64,
    what: &str,
    why: Option<&str>,
) -> LedgerHistoryInput {
    input(json!({"v":5,"op":"revise_intent","ledger":"ledger-1",
        "workspace_id":"workspace-1","change":change,"key":key,
        "expected_intent":reference(change,expected),"what":what,"why":why}))
}
fn check(change: &str, key: &str, expected: u64) -> LedgerHistoryInput {
    input(json!({"v":5,"op":"run_check","ledger":"ledger-1",
        "workspace_id":"workspace-1","change":change,"key":key,
        "expected_intent":reference(change,expected),"check":"notice-what@1"}))
}
fn context_request(change: &str, at: Option<u64>) -> LedgerHistoryInput {
    input(json!({"v":5,"op":"inspect_context","ledger":"ledger-1",
        "workspace_id":"workspace-1","change":change,
        "at":at.map(|n| reference(change,n)),"purpose":"understanding"}))
}
fn range_request(change: &str, at: Option<u64>, from: Option<u64>, limit: u64) -> Value {
    json!({"v":5,"op":"inspect_history","ledger":"ledger-1",
        "workspace_id":"workspace-1","change":change,
        "at":at.map(|n| reference(change,n)),"from":from.map(|n| reference(change,n)),
        "limit":limit})
}
fn context(host: &mut LedgerHistoryHost, change: &str, at: Option<u64>) -> Value {
    decode(&host.inspect_context(&context_request(change, at), &mut Owner))
}
fn range(
    host: &mut LedgerHistoryHost,
    change: &str,
    at: Option<u64>,
    from: Option<u64>,
    limit: u64,
) -> Value {
    decode(&host.inspect_history(&input(range_request(change, at, from, limit)), &mut Owner))
}
fn selection(host: &mut LedgerHistoryHost, change: &str) -> Value {
    decode(&host.select_change(
        &input(json!({"v":5,"op":"select_change","ledger":"ledger-1",
            "workspace_id":"workspace-1","change":change})),
        &mut Owner,
    ))
}
fn page(host: &mut LedgerHistoryHost, cursor: Value, limit: u64) -> Vec<u8> {
    host.list_changes(
        &input(json!({"v":5,"op":"list_changes","ledger":"ledger-1",
            "workspace_id":"workspace-1","cursor":cursor,"limit":limit})),
        &mut Owner,
    )
}
fn decode(bytes: &[u8]) -> Value {
    assert_eq!(bytes.last(), Some(&b'\n'), "reply lacks terminal LF");
    assert!(bytes.len() == 1 || bytes[bytes.len() - 2] != b'\n');
    serde_json::from_slice(bytes)
        .unwrap_or_else(|e| panic!("reply decode: {e}; {}", String::from_utf8_lossy(bytes)))
}
fn error(bytes: &[u8], code: &str) {
    assert_eq!(
        bytes,
        format!("{{\"v\":5,\"kind\":\"error\",\"code\":\"{code}\"}}\n").as_bytes()
    );
}
fn sha(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn prefix(last: u64, end: usize, hash: &str) -> Value {
    json!({"first":1,"last":last,"end":end,"sha256":hash})
}
fn keys(value: &Value, expected: &[&str]) {
    let mut actual = value
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect::<Vec<_>>();
    actual.sort_unstable();
    let mut expected = expected.to_vec();
    expected.sort_unstable();
    assert_eq!(actual, expected, "{value}");
}
fn metadata(value: &Value, change: &str, accepted: Value) {
    assert_eq!(
        value,
        &json!({"change":change,"origin":reference(change,1),
        "actor":"owner-1","accepted":accepted,"progress":"ready"})
    );
}

// Include directory names as well as file bytes so read/accepted-retry cleanup is visible.
fn snapshot(root: &Path) -> Vec<(PathBuf, Option<Vec<u8>>)> {
    fn visit(root: &Path, path: &Path, out: &mut Vec<(PathBuf, Option<Vec<u8>>)>) {
        let mut entries = fs::read_dir(path)
            .unwrap()
            .map(Result::unwrap)
            .collect::<Vec<_>>();
        entries.sort_by_key(|entry| entry.file_name());
        for entry in entries {
            let path = entry.path();
            let relative = path.strip_prefix(root).unwrap().to_owned();
            if entry.file_type().unwrap().is_dir() {
                out.push((relative, None));
                visit(root, &path, out);
            } else {
                out.push((relative, Some(fs::read(path).unwrap())));
            }
        }
    }
    let mut out = Vec::new();
    visit(root, root, &mut out);
    out
}

// Results come from the public producer, never from a parallel expected-result backend.
fn four(host: &mut LedgerHistoryHost) -> Vec<Vec<u8>> {
    let a1 = host.create_change(
        &create("create-a", &"x".repeat(81), Some("Keep original reason")),
        &mut Owner,
    );
    assert_eq!(a1, b"{\"v\":5,\"kind\":\"created\",\"ledger\":\"ledger-1\",\"workspace_id\":\"workspace-1\",\"change\":\"alpha-c\",\"key\":\"create-a\",\"actor\":\"owner-1\",\"result\":\"alpha-c:origin\",\"seq\":1,\"adoption\":\"authenticated_direct\"}\n");
    let b1 = host.create_change(
        &create("create-b", "Record backup cleanup", None),
        &mut Owner,
    );
    assert_eq!(decode(&b1)["change"], B);
    let a2 = host.run_check(&check(A, "check-a", 1), &mut Owner);
    let false_result = decode(&a2);
    assert_eq!(false_result["passed"], false);
    assert_eq!(false_result["feedback"], "shorten_or_use_other_channel");
    assert_eq!(
        false_result["evidence"],
        json!({"intent":"alpha-c:origin","field":"what","utf8_bytes":81,"limit":80})
    );
    assert_eq!(host.last_work().check_acceptances, 1);
    let a3 = host.revise_intent(
        &revise(A, "rev-a", 1, "Trim local defaults", None),
        &mut Owner,
    );
    let revised = decode(&a3);
    assert_eq!(revised["intent"], "alpha-c:op:3");
    assert_eq!(revised["previous_intent"], "alpha-c:origin");
    assert_eq!(revised["adoption"], "authenticated_direct");
    let a4 = host.run_check(&check(A, "check-b", 3), &mut Owner);
    let true_result = decode(&a4);
    assert_eq!(true_result["passed"], true);
    assert_eq!(true_result["feedback"], "fits");
    assert_eq!(
        true_result["evidence"],
        json!({"intent":"alpha-c:op:3","field":"what","utf8_bytes":19,"limit":80})
    );
    assert_eq!(host.last_work().check_acceptances, 1);
    vec![a1, a2, a3, a4, b1]
}

fn assert_sample_storage(root: &Path) {
    let ledger = root.join("state/ledger");
    let trace = fs::read(ledger.join("members/m-1/trace.jsonl")).unwrap();
    let lengths = trace
        .split_inclusive(|b| *b == b'\n')
        .map(<[u8]>::len)
        .collect::<Vec<_>>();
    assert_eq!(lengths, [584, 772, 633, 739]);
    assert_eq!(trace.len(), 2728);
    assert_eq!(sha(&trace), A_HASH);
    assert_eq!(sha(&trace[..584]), ORIGIN_HASH);
    let b = fs::read(ledger.join("members/m-2/trace.jsonl")).unwrap();
    assert_eq!(b.len(), 503);
    assert_eq!(sha(&b), B_HASH);
    let creation: Value =
        serde_json::from_slice(&fs::read(ledger.join("creation.json")).unwrap()).unwrap();
    assert_eq!(creation["generation"], 6);
    assert_eq!(creation["entries"].as_array().unwrap().len(), 2);
    assert!(creation["pending"].is_null());
    let association = &creation["entries"][0];
    assert_eq!(association["change"], A);
    assert_eq!(association["origin_end"], 584);
    assert_eq!(association["origin_sha256"], ORIGIN_HASH);
    assert_eq!(
        association["input_sha256"],
        "96667ba547be290393ac260ac0146db48b886a44850147845b6f3cb28f696134"
    );
    let checkpoint: Value =
        serde_json::from_slice(&fs::read(ledger.join("members/m-1/checkpoint.json")).unwrap())
            .unwrap();
    assert_eq!(checkpoint["generation"], 4);
    assert_eq!(checkpoint["end"], 2728);
    assert_eq!(checkpoint["sha256"], A_HASH);
}

fn assert_current_context(view: &Value, receipts: &[Vec<u8>]) {
    keys(
        view,
        &[
            "v",
            "kind",
            "ledger",
            "workspace_id",
            "change",
            "projection",
            "purpose",
            "origin",
            "tip",
            "cursor",
            "current_intent",
            "accepted",
            "selected",
            "adoption_scope",
            "adopted_check",
            "records",
            "assessments",
            "coverage",
            "gaps",
            "progress",
        ],
    );
    assert_eq!(view["v"], 5);
    assert_eq!(view["kind"], "change_context");
    assert_eq!(view["ledger"], "ledger-1");
    assert_eq!(view["workspace_id"], "workspace-1");
    assert_eq!(view["change"], A);
    assert_eq!(view["projection"], "ck-ledger-understanding@1");
    assert_eq!(view["purpose"], "understanding");
    assert_eq!(view["origin"], "alpha-c:origin");
    assert_eq!(view["tip"], "alpha-c:op:4");
    assert_eq!(view["cursor"], "alpha-c:op:4");
    assert_eq!(view["current_intent"], "alpha-c:op:3");
    assert_eq!(view["accepted"], prefix(4, 2728, A_HASH));
    assert_eq!(view["selected"], view["accepted"]);
    assert_eq!(view["adoption_scope"], "authenticated_direct_only");
    assert_eq!(
        view["adopted_check"],
        json!({"policy":"fixture-notice@1","check":"notice-what@1",
        "evaluator":"utf8-length@1","adopter":"owner-1","field":"what","limit":80})
    );
    let records = view["records"].as_array().unwrap();
    assert_eq!(records.len(), 4);
    for (i, record) in records.iter().enumerate() {
        assert_eq!(record["seq"], (i + 1) as u64);
        assert_eq!(record["result"], decode(&receipts[i]));
        assert_eq!(record["custody"], "member-a");
        assert_eq!(record["change"], A);
    }
    assert_eq!(records[0]["input"]["what"], "x".repeat(81));
    assert_eq!(records[0]["input"]["why"], "Keep original reason");
    assert_eq!(records[2]["input"]["what"], "Trim local defaults");
    assert!(records[2]["input"]["why"].is_null());
    // Operation predecessor is op:2; intent predecessor remains origin.
    assert_eq!(records[2]["prev"], "alpha-c:op:2");
    assert_eq!(records[2]["result"]["previous_intent"], "alpha-c:origin");
    assert_eq!(
        view["assessments"],
        json!([
            {"assessment":"alpha-c:op:2","intent":"alpha-c:origin","applicability":"historical"},
            {"assessment":"alpha-c:op:4","intent":"alpha-c:op:3","applicability":"current"}
        ])
    );
    assert_eq!(
        view["coverage"],
        json!({"required":4,"returned":4,"complete":true})
    );
    assert_eq!(view["gaps"], json!([]));
    assert_eq!(view["progress"], "ready");
}

// A deterministic consumer explanation reads actual returned material. It makes no effect,
// general goal-quality, session-authorship, or permission claim from notice-fit evidence.
fn explain(view: &Value) -> String {
    assert_eq!(view["coverage"]["complete"], true);
    assert_eq!(view["adoption_scope"], "authenticated_direct_only");
    let records = view["records"].as_array().unwrap();
    let original = &records[0];
    let current = records
        .iter()
        .find(|r| r["result"]["result"] == view["current_intent"])
        .unwrap();
    let judgments = view["assessments"]
        .as_array()
        .unwrap()
        .iter()
        .map(|entry| {
            let record = records
                .iter()
                .find(|r| r["result"]["result"] == entry["assessment"])
                .unwrap();
            format!(
                "{}: {} bytes, passed={}, applicability={}",
                entry["assessment"].as_str().unwrap(),
                record["result"]["evidence"]["utf8_bytes"],
                record["result"]["passed"],
                entry["applicability"].as_str().unwrap()
            )
        })
        .collect::<Vec<_>>()
        .join("; ");
    format!("Original Why: {}. {} directly adopted {} with Why {}. {}. Direct adoption only; no session authorship or native outcome evidence.",
        original["input"]["why"], current["result"]["actor"].as_str().unwrap(),
        current["input"]["what"], current["input"]["why"], judgments)
}

fn consumer(root: &Path) {
    let state = root.join("state");
    let before = snapshot(&state);
    let receipts: Vec<Vec<u8>> =
        serde_json::from_slice(&fs::read(root.join("receipts.json")).unwrap()).unwrap();
    let mut host = connect(root, OpeningMode::Reopen);
    assert_eq!(host.connection_work().member_passes, 0);
    assert_eq!(host.connection_work().check_attempts, 0);
    assert_eq!(snapshot(&state), before);
    let current = context(&mut host, A, None);
    assert_current_context(&current, &receipts);
    let explanation = explain(&current);
    assert!(explanation.contains("Keep original reason"));
    assert!(explanation.contains("owner-1 directly adopted \"Trim local defaults\" with Why null"));
    assert!(explanation.contains("81 bytes, passed=false, applicability=historical"));
    assert!(explanation.contains("19 bytes, passed=true, applicability=current"));
    println!("{explanation}");
    assert!(host.last_work().evaluator_calculations.completions >= 2);
    assert_eq!(host.last_work().check_attempts, 0);
    assert_eq!(host.last_work().check_acceptances, 0);
    let historical = context(&mut host, A, Some(2));
    assert_eq!(historical["accepted"], current["accepted"]);
    assert_eq!(historical["tip"], "alpha-c:op:4");
    assert_eq!(historical["cursor"], "alpha-c:op:2");
    assert_eq!(historical["current_intent"], "alpha-c:origin");
    assert_eq!(historical["selected"], prefix(2, 1356, HISTORICAL_HASH));
    assert_eq!(
        historical["records"],
        json!([current["records"][0], current["records"][1]])
    );
    assert_eq!(
        historical["assessments"],
        json!([
            {"assessment":"alpha-c:op:2","intent":"alpha-c:origin","applicability":"current"}
        ])
    );
    let at_revision = context(&mut host, A, Some(3));
    assert_eq!(at_revision["current_intent"], "alpha-c:op:3");
    assert_eq!(at_revision["assessments"][0]["applicability"], "historical");
    assert_eq!(at_revision["assessments"].as_array().unwrap().len(), 1);
    let b = selection(&mut host, B);
    keys(&b, &["v", "kind", "ledger", "workspace_id", "member"]);
    assert_eq!(b["kind"], "selection");
    metadata(&b["member"], B, prefix(1, 503, B_HASH));
    let a = selection(&mut host, A);
    metadata(&a["member"], A, prefix(4, 2728, A_HASH));
    let first = decode(&page(&mut host, Value::Null, 1));
    keys(
        &first,
        &[
            "v",
            "kind",
            "ledger",
            "workspace_id",
            "order",
            "members",
            "next",
        ],
    );
    assert_eq!(first["kind"], "change_page");
    assert_eq!(first["order"], "change_asc");
    assert_eq!(first["members"], json!([a["member"]]));
    assert_eq!(
        first["next"],
        json!({"v":5,"ledger":"ledger-1","workspace_id":"workspace-1","after":A,"limit":1})
    );
    let second = decode(&page(&mut host, first["next"].clone(), 1));
    assert_eq!(second["members"], json!([b["member"]]));
    assert!(second["next"].is_null());
    let terminal = decode(&page(
        &mut host,
        json!({"v":5,"ledger":"ledger-1",
        "workspace_id":"workspace-1","after":B,"limit":1}),
        1,
    ));
    assert_eq!(terminal["members"], json!([]));
    assert!(terminal["next"].is_null());
    assert_eq!(
        host.create_change(
            &create("create-a", &"x".repeat(81), Some("Keep original reason")),
            &mut Owner,
        ),
        receipts[0]
    );
    assert_eq!(
        host.run_check(&check(A, "check-a", 1), &mut Owner),
        receipts[1]
    );
    assert_eq!(host.last_work().check_attempts, 0);
    assert_eq!(host.last_work().check_acceptances, 0);
    assert!(host.last_work().evaluator_calculations.completions >= 2);
    assert_eq!(
        host.revise_intent(
            &revise(A, "rev-a", 1, "Trim local defaults", None),
            &mut Owner,
        ),
        receipts[2]
    );
    assert_eq!(
        host.run_check(&check(A, "check-b", 3), &mut Owner),
        receipts[3]
    );
    assert_eq!(host.last_work().check_attempts, 0);
    assert_eq!(host.last_work().check_acceptances, 0);
    assert_eq!(
        host.create_change(
            &create("create-b", "Record backup cleanup", None),
            &mut Owner,
        ),
        receipts[4]
    );
    assert_sample_storage(root);
    drop(host);
    assert_eq!(
        snapshot(&state),
        before,
        "reopen/read/accepted retries changed custody"
    );
}

#[test]
fn history_process_entry() {
    let Some(root) = std::env::var_os("CK_HISTORY_CONSUMER_ROOT") else {
        return;
    };
    let root = PathBuf::from(root);
    match std::env::var("CK_HISTORY_CONSUMER_ACTION")
        .unwrap()
        .as_str()
    {
        "produce" => {
            let mut host = connect(&root, OpeningMode::FreshProvision);
            let receipts = four(&mut host);
            assert_sample_storage(&root);
            fs::write(
                root.join("receipts.json"),
                serde_json::to_vec(&receipts).unwrap(),
            )
            .unwrap();
            drop(host);
        }
        "consume" => consumer(&root),
        action => panic!("unknown history child action {action}"),
    }
}

#[test]
fn producer_exit_then_fresh_consumer_explains_retained_history_and_retries() {
    let fixture = Fixture::new();
    fixture.child("produce"); // Wait/reap proves predecessor exit before consumer construction.
    let before = snapshot(&fixture.state());
    fixture.child("consume");
    assert_eq!(snapshot(&fixture.state()), before);
}

#[test]
fn ranges_bind_head_tail_middle_and_next_to_selected_version() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    four(&mut host);
    let before = snapshot(&fixture.state());
    let full = context(&mut host, A, None);
    let head = range(&mut host, A, None, None, 1);
    keys(
        &head,
        &[
            "v",
            "kind",
            "ledger",
            "workspace_id",
            "change",
            "projection",
            "origin",
            "tip",
            "cursor",
            "accepted",
            "selected",
            "records",
            "coverage",
            "next",
            "progress",
        ],
    );
    assert_eq!(head["kind"], "history_view");
    assert_eq!(head["projection"], "ck-ledger-history-range@1");
    assert_eq!(head["records"], json!([full["records"][0]]));
    assert_eq!(
        head["coverage"],
        json!({"first":1,"last":1,"returned":1,"complete":false})
    );
    assert_eq!(head["next"], range_request(A, Some(4), Some(2), 1));
    let tail = range(&mut host, A, None, Some(4), 4);
    assert_eq!(tail["records"], json!([full["records"][3]]));
    assert_eq!(
        tail["coverage"],
        json!({"first":4,"last":4,"returned":1,"complete":true})
    );
    assert!(tail["next"].is_null());
    let around = range(&mut host, A, Some(4), Some(2), 4);
    assert_eq!(
        around["records"],
        json!([full["records"][1], full["records"][2], full["records"][3]])
    );
    assert_eq!(
        around["coverage"],
        json!({"first":2,"last":4,"returned":3,"complete":true})
    );
    let historical = range(&mut host, A, Some(2), None, 1);
    assert_eq!(historical["selected"], prefix(2, 1356, HISTORICAL_HASH));
    assert_eq!(historical["accepted"], prefix(4, 2728, A_HASH));
    assert_eq!(historical["next"], range_request(A, Some(2), Some(2), 1));
    let last = decode(&host.inspect_history(&input(historical["next"].clone()), &mut Owner));
    assert_eq!(last["records"], json!([full["records"][1]]));
    assert_eq!(
        last["coverage"],
        json!({"first":2,"last":2,"returned":1,"complete":true})
    );
    assert!(last["next"].is_null());
    assert_eq!(last["selected"], historical["selected"]);
    assert_eq!(snapshot(&fixture.state()), before);

    // Advance tip after receiving next; following next must not silently include the new op.
    let revised = host.revise_intent(
        &revise(A, "same-text", 3, "Trim local defaults", None),
        &mut Owner,
    );
    assert_eq!(decode(&revised)["intent"], "alpha-c:op:5");
    let after_append = snapshot(&fixture.state());
    let bound = decode(&host.inspect_history(&input(head["next"].clone()), &mut Owner));
    assert_eq!(bound["cursor"], "alpha-c:op:4");
    assert_eq!(bound["tip"], "alpha-c:op:5");
    assert_eq!(bound["selected"], prefix(4, 2728, A_HASH));
    assert_eq!(bound["accepted"]["last"], 5);
    let old_context = context(&mut host, A, Some(4));
    assert_eq!(old_context["records"], full["records"]);
    assert_eq!(old_context["assessments"], full["assessments"]);
    assert_eq!(old_context["selected"], full["selected"]);
    let new_context = context(&mut host, A, None);
    assert_eq!(new_context["current_intent"], "alpha-c:op:5");
    assert_eq!(new_context["assessments"][1]["applicability"], "historical");
    assert_eq!(snapshot(&fixture.state()), after_append);
}

#[test]
fn key_namespaces_typed_why_and_conflict_order_preserve_original_results() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    let receipts = four(&mut host);
    let before = snapshot(&fixture.state());
    for (key, expected) in [("create-a", 3), ("check-a", 1)] {
        error(
            &host.revise_intent(&revise(A, key, expected, "Changed", None), &mut Owner),
            "conflict",
        );
    }
    error(
        &host.run_check(&check(A, "create-a", 1), &mut Owner),
        "conflict",
    );
    error(
        &host.revise_intent(
            &revise(A, "rev-a", 1, "Trim local defaults", Some("")),
            &mut Owner,
        ),
        "conflict",
    );
    error(
        &host.create_change(
            &create("create-b", "Record backup cleanup", Some("")),
            &mut Owner,
        ),
        "conflict",
    );
    error(
        &host.run_check(&check(A, "new-stale", 1), &mut Owner),
        "conflict",
    );
    error(
        &host.revise_intent(&revise(A, "non-intent", 4, "Changed", None), &mut Owner),
        "conflict",
    );
    assert_eq!(
        host.run_check(&check(A, "check-a", 1), &mut Owner),
        receipts[1]
    );
    assert_eq!(snapshot(&fixture.state()), before);
    let b_before = fs::read(fixture.member(2, "trace.jsonl")).unwrap();
    let revision = host.revise_intent(
        &revise(A, "empty-why", 3, "Quoted \\\"text\\\" /\n é", Some("")),
        &mut Owner,
    );
    assert_eq!(decode(&revision)["adoption"], "authenticated_direct");
    assert_eq!(
        fs::read(fixture.member(2, "trace.jsonl")).unwrap(),
        b_before
    );
    let view = context(&mut host, A, None);
    assert_eq!(view["records"][4]["input"]["why"], "");
    assert_eq!(
        view["records"][4]["input"]["what"],
        "Quoted \\\"text\\\" /\n é"
    );
    assert_eq!(view["records"][0]["input"]["why"], "Keep original reason");
    assert!(view["records"][2]["input"]["why"].is_null());
    let b_check = host.run_check(&check(B, "check-a", 1), &mut Owner);
    assert_eq!(decode(&b_check)["result"], "beta-c:op:2");
    let c = host.create_change(
        &create("rev-a", "Independent creation namespace", None),
        &mut Owner,
    );
    assert_eq!(decode(&c)["change"], "other-2");
    // The original collection key stays occupied despite later A operations.
    let now = snapshot(&fixture.state());
    error(
        &host.create_change(&create("create-a", "Changed", None), &mut Owner),
        "conflict",
    );
    assert_eq!(
        host.revise_intent(
            &revise(A, "empty-why", 3, "Quoted \\\"text\\\" /\n é", Some("")),
            &mut Owner
        ),
        revision
    );
    assert_eq!(snapshot(&fixture.state()), now);
}

#[test]
fn repeated_checks_stay_distinct_and_equal_text_does_not_preserve_applicability() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    four(&mut host);
    let additional = host.run_check(&check(A, "second-on-revision", 3), &mut Owner);
    assert_eq!(decode(&additional)["result"], "alpha-c:op:5");
    let at_five = context(&mut host, A, None);
    assert_eq!(at_five["assessments"].as_array().unwrap().len(), 3);
    assert_eq!(at_five["assessments"][1]["applicability"], "current");
    assert_eq!(at_five["assessments"][2]["applicability"], "current");
    let revision = host.revise_intent(
        &revise(A, "same-again", 3, "Trim local defaults", None),
        &mut Owner,
    );
    assert_eq!(decode(&revision)["intent"], "alpha-c:op:6");
    let before = snapshot(&fixture.state());
    let view = context(&mut host, A, None);
    assert_eq!(view["current_intent"], "alpha-c:op:6");
    for entry in view["assessments"].as_array().unwrap() {
        assert_eq!(entry["applicability"], "historical");
    }
    assert_eq!(
        context(&mut host, A, Some(5))["assessments"],
        at_five["assessments"]
    );
    assert_eq!(
        host.run_check(&check(A, "second-on-revision", 3), &mut Owner),
        additional
    );
    assert_eq!(host.last_work().check_attempts, 0);
    assert_eq!(host.last_work().check_acceptances, 0);
    assert_eq!(snapshot(&fixture.state()), before);
}

#[test]
fn cursor_validation_distinguishes_shape_association_and_absent_positions() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    four(&mut host);
    let before = snapshot(&fixture.state());
    let cursor =
        json!({"v":5,"ledger":"ledger-1","workspace_id":"workspace-1","after":A,"limit":1});
    error(&page(&mut host, cursor.clone(), 2), "invalid_input");
    let mut foreign = cursor.clone();
    foreign["ledger"] = json!("foreign-ledger");
    error(&page(&mut host, foreign, 1), "denied");
    let mut foreign = cursor.clone();
    foreign["workspace_id"] = json!("foreign-workspace");
    error(&page(&mut host, foreign, 1), "denied");
    let mut absent = cursor;
    absent["after"] = json!("other-2");
    error(&page(&mut host, absent, 1), "unavailable");
    for request in [
        range_request(A, Some(3), Some(4), 1),
        range_request(A, Some(5), None, 1),
        range_request(A, None, Some(5), 1),
    ] {
        error(
            &host.inspect_history(&input(request), &mut Owner),
            "unavailable",
        );
    }
    let mut foreign = range_request(A, None, None, 1);
    foreign["at"] = json!("beta-c:origin");
    error(&host.inspect_history(&input(foreign), &mut Owner), "denied");
    let mut foreign = range_request(A, None, None, 1);
    foreign["from"] = json!("beta-c:origin");
    error(&host.inspect_history(&input(foreign), &mut Owner), "denied");
    let mut invalid = range_request(A, None, None, 1);
    invalid["at"] = json!("alpha-c:op:02");
    error(
        &host.inspect_history(&input(invalid), &mut Owner),
        "invalid_input",
    );
    error(
        &host.inspect_context(&context_request(A, Some(5)), &mut Owner),
        "unavailable",
    );
    assert_eq!(snapshot(&fixture.state()), before);
}

#[test]
fn old_cursor_still_validates_corrupt_later_accepted_material() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    four(&mut host);
    drop(host);
    let path = fixture.member(1, "trace.jsonl");
    let mut bytes = fs::read(&path).unwrap();
    let position = bytes
        .windows(b"\"passed\":true".len())
        .rposition(|w| w == b"\"passed\":true")
        .unwrap();
    bytes[position + b"\"passed\":".len()] = b'T';
    fs::write(path, bytes).unwrap();
    let before = snapshot(&fixture.state());
    let mut host = fixture.host(OpeningMode::Reopen); // Connect is shared-only, not a repair.
    error(
        &host.inspect_context(&context_request(A, Some(1)), &mut Owner),
        "unavailable",
    );
    error(
        &host.inspect_history(&input(range_request(A, Some(2), None, 1)), &mut Owner),
        "unavailable",
    );
    metadata(
        &selection(&mut host, B)["member"],
        B,
        prefix(1, 503, B_HASH),
    );
    assert_eq!(
        snapshot(&fixture.state()),
        before,
        "deterministic damage must be preserved"
    );
}

#[test]
fn oversized_required_context_is_explicitly_limited_but_exact_ranges_retain_all_material() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    four(&mut host);
    let what = "x".repeat(65_536);
    let why = "y".repeat(65_536);
    for seq in 5..=24 {
        let expected = if seq == 5 { 3 } else { seq - 1 };
        let result = host.revise_intent(
            &revise(A, &format!("large-{seq}"), expected, &what, Some(&why)),
            &mut Owner,
        );
        assert_eq!(decode(&result)["seq"], seq);
    }
    drop(host);
    let trace = fs::read(fixture.member(1, "trace.jsonl")).unwrap();
    assert_eq!(trace.len(), 2_636_540);
    assert_eq!(
        sha(&trace),
        "73dad98d092e639aac7b811afcbb5157f5e470a0894dec1bbc32235c2f4a407a"
    );
    let before = snapshot(&fixture.state());
    let mut host = fixture.host(OpeningMode::Reopen);
    let bytes = host.inspect_context(&context_request(A, None), &mut Owner);
    assert!(bytes.len() <= Q);
    let limited = decode(&bytes);
    assert_eq!(limited["kind"], "change_context");
    assert_eq!(limited["current_intent"], "alpha-c:op:24");
    assert_eq!(limited["cursor"], "alpha-c:op:24");
    assert_eq!(limited["tip"], "alpha-c:op:24");
    assert_eq!(limited["accepted"], prefix(24, trace.len(), &sha(&trace)));
    assert_eq!(limited["selected"], limited["accepted"]);
    assert_eq!(limited["records"], json!([]));
    assert_eq!(limited["assessments"], json!([]));
    assert_eq!(
        limited["coverage"],
        json!({"required":24,"returned":0,"complete":false})
    );
    assert_eq!(
        limited["gaps"],
        json!([{"code":"required_material_limit","first":1,"last":24,
        "required_bytes":trace.len(),"budget":MATERIAL_BUDGET}])
    );
    assert_eq!(limited["adoption_scope"], "authenticated_direct_only");
    assert_eq!(limited["progress"], "ready");
    assert_eq!(host.last_work().check_attempts, 0);
    assert_eq!(host.last_work().check_acceptances, 0);
    let small = context(&mut host, A, Some(4));
    assert_eq!(small["coverage"]["complete"], true);
    assert_eq!(small["selected"], prefix(4, 2728, A_HASH));
    assert_eq!(small["accepted"], limited["accepted"]);
    assert_eq!(small["assessments"].as_array().unwrap().len(), 2);

    // Assemble every page under the same cursor; compare to actual LF-framed trace objects.
    let expected = trace
        .split_inclusive(|b| *b == b'\n')
        .map(|line| serde_json::from_slice::<Value>(line).unwrap())
        .collect::<Vec<_>>();
    let mut request = range_request(A, Some(24), None, 4);
    let mut gathered = Vec::new();
    for _ in 0..24 {
        let reply = host.inspect_history(&input(request), &mut Owner);
        assert!(reply.len() <= Q);
        let view = decode(&reply);
        assert_eq!(view["cursor"], "alpha-c:op:24");
        assert_eq!(view["selected"], limited["selected"]);
        let records = view["records"].as_array().unwrap();
        assert!(!records.is_empty() && records.len() <= 4);
        assert_eq!(view["coverage"]["first"], (gathered.len() + 1) as u64);
        assert_eq!(view["coverage"]["returned"], records.len() as u64);
        gathered.extend(records.iter().cloned());
        assert_eq!(view["coverage"]["last"], gathered.len() as u64);
        if view["next"].is_null() {
            assert_eq!(view["coverage"]["complete"], true);
            break;
        }
        assert_eq!(view["coverage"]["complete"], false);
        request = view["next"].clone();
        assert_eq!(request["at"], "alpha-c:op:24");
        assert_eq!(request["from"], reference(A, gathered.len() as u64 + 1));
    }
    assert_eq!(
        gathered, expected,
        "limited context cannot erase the distant false Check"
    );
    assert_eq!(gathered[1]["result"]["passed"], false);
    assert_eq!(gathered[3]["result"]["passed"], true);
    assert_eq!(snapshot(&fixture.state()), before);
}

#[test]
fn range_byte_budget_returns_longest_complete_record_prefix_not_truncated_text() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    // Canonical control escapes expand sixfold while raw What/Why remain individually bounded.
    let what = "\u{0001}".repeat(65_536);
    let why = "\u{0002}".repeat(65_536);
    let result = host.create_change(&create("escaped-origin", &what, Some(&why)), &mut Owner);
    assert_eq!(decode(&result)["change"], A);
    for seq in 2..=4 {
        let result = host.revise_intent(
            &revise(A, &format!("escaped-{seq}"), seq - 1, &what, Some(&why)),
            &mut Owner,
        );
        assert_eq!(decode(&result)["seq"], seq);
    }
    let trace = fs::read(fixture.member(1, "trace.jsonl")).unwrap();
    let lines = trace.split_inclusive(|b| *b == b'\n').collect::<Vec<_>>();
    let lengths = lines.iter().map(|line| line.len()).collect::<Vec<_>>();
    assert!(lengths[0] + lengths[1] <= Q - 16_384);
    assert!(lengths[0] + lengths[1] + lengths[2] > Q - 16_384);
    let before = snapshot(&fixture.state());
    let response = host.inspect_history(&input(range_request(A, None, None, 4)), &mut Owner);
    assert!(response.len() <= Q);
    let first = decode(&response);
    assert_eq!(
        first["coverage"],
        json!({"first":1,"last":2,"returned":2,"complete":false})
    );
    assert_eq!(
        first["records"],
        json!([
            serde_json::from_slice::<Value>(lines[0]).unwrap(),
            serde_json::from_slice::<Value>(lines[1]).unwrap()
        ])
    );
    assert_eq!(first["next"], range_request(A, Some(4), Some(3), 4));
    let response = host.inspect_history(&input(first["next"].clone()), &mut Owner);
    assert!(response.len() <= Q);
    let second = decode(&response);
    assert_eq!(
        second["coverage"],
        json!({"first":3,"last":4,"returned":2,"complete":true})
    );
    assert!(second["next"].is_null());
    assert_eq!(second["selected"], first["selected"]);
    assert_eq!(
        second["records"],
        json!([
            serde_json::from_slice::<Value>(lines[2]).unwrap(),
            serde_json::from_slice::<Value>(lines[3]).unwrap()
        ])
    );
    assert_eq!(snapshot(&fixture.state()), before);
}

#[test]
fn fixed_check_counts_raw_utf8_what_not_characters_why_or_json_framing() {
    let fixture = Fixture::new();
    let mut host = fixture.host(OpeningMode::FreshProvision);
    let what = "é".repeat(40);
    let why = "y".repeat(65_536);
    let result = host.create_change(&create("utf8-origin", &what, Some(&why)), &mut Owner);
    assert_eq!(decode(&result)["change"], A);
    let assessment = decode(&host.run_check(&check(A, "fits-exactly", 1), &mut Owner));
    assert_eq!(assessment["passed"], true);
    assert_eq!(assessment["evidence"]["utf8_bytes"], 80);
    let revised = host.revise_intent(
        &revise(A, "utf8-over", 1, &"é".repeat(41), None),
        &mut Owner,
    );
    assert_eq!(decode(&revised)["intent"], "alpha-c:op:3");
    let assessment = decode(&host.run_check(&check(A, "too-many-bytes", 3), &mut Owner));
    assert_eq!(assessment["passed"], false);
    assert_eq!(assessment["evidence"]["utf8_bytes"], 82);
    let before = snapshot(&fixture.state());
    let view = context(&mut host, A, None);
    assert_eq!(view["records"][0]["input"]["what"], what);
    assert_eq!(view["records"][0]["input"]["why"], why);
    assert_eq!(view["assessments"][0]["applicability"], "historical");
    assert_eq!(view["assessments"][1]["applicability"], "current");
    assert_eq!(snapshot(&fixture.state()), before);
}
