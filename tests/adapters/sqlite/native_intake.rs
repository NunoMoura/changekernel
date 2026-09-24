use changekernel::{Intake, Issue, Proposal, Receipt, SqliteIntake};
use rusqlite::Connection;
use serde_json::Value;
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Barrier,
    },
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "ck-native-intake-{}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        Self(root.join("store.db"))
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(self.0.parent().unwrap()).unwrap();
    }
}
fn client(path: &PathBuf) -> Intake<SqliteIntake> {
    Intake::new(SqliteIntake::open_existing(path).unwrap())
}
fn fixtures() -> Value {
    serde_json::from_str(include_str!("intake-conformance.json")).unwrap()
}
fn proposal(value: &Value) -> Proposal {
    Proposal {
        container_id: value["containerId"].as_str().unwrap().into(),
        request_id: value["requestId"].as_str().unwrap().into(),
        what: value["what"].as_str().unwrap().into(),
        why: value["why"].as_str().map(str::to_owned),
    }
}
fn code(code: &str) -> Issue {
    match code {
        "conflict" => Issue::Conflict,
        "denied" => Issue::Denied,
        "unavailable" => Issue::Unavailable,
        _ => panic!("unknown expectation {code}"),
    }
}
fn assert_intent(r: &Receipt, expected: &Value) {
    assert_eq!(r.state, expected["state"].as_str().unwrap());
    assert_eq!(r.what, expected["what"].as_str().unwrap());
    assert_eq!(r.why.as_deref(), expected["why"].as_str());
}
fn id_for_case(case: &Value) -> &str {
    case["id"].as_str().unwrap()
}
fn count(path: &PathBuf) -> i64 {
    Connection::open(path)
        .unwrap()
        .query_row("SELECT count(*) FROM ck_native_changes", [], |r| r.get(0))
        .unwrap()
}

// Native test binary re-entry: distinct process, no shared connections or in-memory state.
#[test]
fn subprocess_entry() {
    let Ok(path) = std::env::var("CK_INTAKE_CHILD_PATH") else {
        return;
    };
    let f = fixtures();
    let input = proposal(&f["fixtures"]["proposal"]);
    let mut c = client(&PathBuf::from(path));
    let r = c
        .propose(&input, f["fixtures"]["owner"].as_str().unwrap())
        .unwrap();
    println!("CHILD_CHANGE={}", r.change_id);
}
fn child(path: &PathBuf) -> String {
    let output = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "subprocess_entry", "--nocapture"])
        .env("CK_INTAKE_CHILD_PATH", path)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .find_map(|line| {
            line.split_once("CHILD_CHANGE=")
                .map(|(_, id)| id.to_owned())
        })
        .unwrap()
}
#[test]
fn shared_semantic_cases() {
    let f = fixtures();
    let data = &f["fixtures"];
    let owner = data["owner"].as_str().unwrap();
    let outsider = data["outsider"].as_str().unwrap();
    let container = data["container"]["containerId"].as_str().unwrap();
    let other = data["otherContainer"]["containerId"].as_str().unwrap();
    let p = proposal(&data["proposal"]);
    let conflict = proposal(&data["conflictingProposal"]);
    let mut seen = Vec::new();
    for case in f["cases"].as_array().unwrap() {
        let file = Fixture::new();
        let mut c = Intake::new(SqliteIntake::initialize(&file.0).unwrap());
        let mut expected = case["expect"].clone();
        if std::env::var_os("CK_MUTATE_INTAKE_EXPECTATION").is_some()
            && id_for_case(case) == "reopen-and-retry"
        {
            expected["state"] = Value::String("wrong-state".into());
        }
        let expected = &expected;
        c.create(container, owner).unwrap();
        let id = case["id"].as_str().unwrap();
        seen.push(id);
        match id {
            "reopen-and-retry" => {
                let first = c.propose(&p, owner).unwrap();
                assert_intent(&first, expected);
                drop(c);
                let mut c = client(&file.0);
                c.open(container, owner).unwrap();
                c.create(container, owner).unwrap();
                assert_eq!(
                    c.read(container, &first.change_id, owner),
                    Ok(first.clone())
                );
                assert_eq!(c.propose(&p, owner), Ok(first.clone()));
                assert_eq!(
                    c.propose(&conflict, owner),
                    Err(code(expected["conflictingRetry"].as_str().unwrap()))
                );
                assert_eq!(c.read(container, &first.change_id, owner), Ok(first));
                assert_eq!(count(&file.0), 1);
            }
            "trusted-actor-and-container-isolation" => {
                let first = c.propose(&p, owner).unwrap();
                for actor in [outsider, ""] {
                    let denied = code(expected["unauthorized"].as_str().unwrap());
                    assert_eq!(c.open(container, actor), Err(denied.clone()));
                    assert_eq!(c.create(container, actor), Err(denied.clone()));
                    assert_eq!(c.propose(&p, actor), Err(denied.clone()));
                    assert_eq!(c.read(container, &first.change_id, actor), Err(denied));
                }
                c.create(other, outsider).unwrap();
                assert_eq!(
                    c.read(other, &first.change_id, outsider),
                    Err(code(expected["unauthorized"].as_str().unwrap()))
                );
                assert_eq!(
                    c.read("missing", &first.change_id, owner),
                    Err(Issue::Denied)
                );
                assert_eq!(c.read(container, &first.change_id, owner), Ok(first));
            }
            "fresh-process-and-concurrent-retry" => {
                drop(c);
                let gate = Arc::new(Barrier::new(3));
                let joins: Vec<_> = (0..2)
                    .map(|_| {
                        let gate = gate.clone();
                        let path = file.0.clone();
                        let p = p.clone();
                        let owner = owner.to_owned();
                        thread::spawn(move || {
                            let mut c = client(&path);
                            gate.wait();
                            c.propose(&p, &owner)
                        })
                    })
                    .collect();
                gate.wait();
                let a = joins
                    .into_iter()
                    .map(|j| j.join().unwrap().unwrap())
                    .collect::<Vec<_>>();
                assert_eq!(a[0], a[1]);
                assert_eq!(child(&file.0), a[0].change_id);
                let mut c = client(&file.0);
                assert_eq!(
                    c.propose(&conflict, owner),
                    Err(code(expected["conflictingRetry"].as_str().unwrap()))
                );
                assert_eq!(count(&file.0), 1);
            }
            "failed-insertion-and-repair" => {
                let db = Connection::open(&file.0).unwrap();
                db.execute_batch("CREATE TRIGGER refuse_native BEFORE INSERT ON ck_native_changes BEGIN SELECT RAISE(ABORT, 'fault'); END").unwrap();
                assert_eq!(
                    c.propose(&p, owner),
                    Err(code(expected["failedInsertion"].as_str().unwrap()))
                );
                assert_eq!(count(&file.0), 0);
                db.execute_batch("DROP TRIGGER refuse_native").unwrap();
                let r = c.propose(&p, owner).unwrap();
                assert_eq!(c.read(container, &r.change_id, owner), Ok(r));
                assert_eq!(count(&file.0), 1);
            }
            _ => panic!("unknown shared case {id}"),
        }
    }
    assert_eq!(seen.len(), 4);
}
#[test]
fn bounded_lock_wait_then_same_identity_retry() {
    let f = fixtures();
    let p = proposal(&f["fixtures"]["proposal"]);
    let owner = f["fixtures"]["owner"].as_str().unwrap();
    let file = Fixture::new();
    let mut c = Intake::new(SqliteIntake::initialize(&file.0).unwrap());
    c.create(&p.container_id, owner).unwrap();
    let lock = Connection::open(&file.0).unwrap();
    lock.execute_batch("BEGIN IMMEDIATE").unwrap();
    assert_eq!(c.propose(&p, owner), Err(Issue::Unavailable));
    lock.execute_batch("ROLLBACK").unwrap();
    let receipt = c.propose(&p, owner).unwrap();
    assert_eq!(
        c.read(&p.container_id, &receipt.change_id, owner),
        Ok(receipt)
    );
    assert_eq!(count(&file.0), 1);
}
#[test]
fn corrupted_records_and_incompatible_storage_fail_closed() {
    let f = fixtures();
    let p = proposal(&f["fixtures"]["proposal"]);
    let owner = f["fixtures"]["owner"].as_str().unwrap();
    let file = Fixture::new();
    assert_eq!(
        SqliteIntake::open_existing(&file.0).err(),
        Some(Issue::Unavailable)
    );
    assert!(!file.0.exists(), "opening must not create missing storage");
    let mut c = Intake::new(SqliteIntake::initialize(&file.0).unwrap());
    c.create(&p.container_id, owner).unwrap();
    let r = c.propose(&p, owner).unwrap();
    let db = Connection::open(&file.0).unwrap();
    db.execute("UPDATE ck_native_changes SET what_text = 'tampered'", [])
        .unwrap();
    assert_eq!(
        c.read(&p.container_id, &r.change_id, owner),
        Err(Issue::Unavailable)
    );
    assert_eq!(c.propose(&p, owner), Err(Issue::Unavailable));
    assert_eq!(count(&file.0), 1);
    db.execute("UPDATE ck_native_changes SET what_text = 123", [])
        .unwrap();
    assert_eq!(
        c.read(&p.container_id, &r.change_id, owner),
        Err(Issue::Unavailable)
    );
    db.execute("DELETE FROM ck_native_changes", []).unwrap();
    assert_eq!(
        c.read(&p.container_id, &r.change_id, owner),
        Err(Issue::Unavailable)
    );
    assert_eq!(c.propose(&p, owner), Err(Issue::Unavailable));
    assert_eq!(count(&file.0), 0);
    drop(c);
    db.execute("UPDATE ck_native_intake_schema SET version = 'other'", [])
        .unwrap();
    assert_eq!(
        SqliteIntake::open_existing(&file.0).err(),
        Some(Issue::Unavailable)
    );
    assert_eq!(
        SqliteIntake::initialize(&file.0).err(),
        Some(Issue::Unavailable)
    );
    let partial = Fixture::new();
    let db = Connection::open(&partial.0).unwrap();
    db.execute_batch("CREATE TABLE ck_native_intake_schema (version TEXT NOT NULL)")
        .unwrap();
    assert_eq!(
        SqliteIntake::open_existing(&partial.0).err(),
        Some(Issue::Unavailable)
    );
    let prototype = Fixture::new();
    let db = Connection::open(&prototype.0).unwrap();
    db.execute_batch("CREATE TABLE ck_intake_schema (version TEXT)")
        .unwrap();
    assert_eq!(
        SqliteIntake::open_existing(&prototype.0).err(),
        Some(Issue::Unavailable)
    );
    let unexpected = Fixture::new();
    SqliteIntake::initialize(&unexpected.0).unwrap();
    Connection::open(&unexpected.0)
        .unwrap()
        .execute_batch("CREATE TABLE extra (value TEXT)")
        .unwrap();
    assert_eq!(
        SqliteIntake::open_existing(&unexpected.0).err(),
        Some(Issue::Unavailable)
    );
    let empty = Fixture::new();
    Connection::open(&empty.0).unwrap();
    assert_eq!(
        SqliteIntake::open_existing(&empty.0).err(),
        Some(Issue::Unavailable)
    );
    assert_eq!(
        SqliteIntake::initialize(":memory:").err(),
        Some(Issue::Unavailable)
    );
    assert_eq!(
        SqliteIntake::initialize("file:test?mode=memory").err(),
        Some(Issue::Unavailable)
    );
}
