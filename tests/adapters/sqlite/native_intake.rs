use changekernel::{Intake, Issue, Proposal, Receipt, SqliteIntake};
use rusqlite::Connection;
use serde_json::Value;
use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicUsize, Ordering},
        mpsc, Arc, Barrier,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
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
fn recovery() -> Value {
    serde_json::from_str(include_str!("intake-recovery-conformance.json")).unwrap()
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
    if let Ok(mode) = std::env::var("CK_INTAKE_RECOVERY_MODE") {
        let file = PathBuf::from(path);
        let input: Value =
            serde_json::from_str(&std::env::var("CK_INTAKE_RECOVERY_INPUT").unwrap()).unwrap();
        let actor = std::env::var("CK_INTAKE_RECOVERY_ACTOR").unwrap();
        let mut command = String::new();
        let mut stdin = BufReader::new(std::io::stdin());
        let send = |message: &str| {
            println!("{message}");
            std::io::stdout().flush().unwrap();
        };
        if mode == "lock" {
            let db = Connection::open(&file).unwrap();
            db.execute_batch("BEGIN IMMEDIATE").unwrap();
            send("ready");
            stdin.read_line(&mut command).unwrap();
            assert_eq!(command.trim(), "release");
            db.execute_batch("ROLLBACK").unwrap();
            send("released");
        } else {
            let mut c = client(&file);
            send("ready");
            stdin.read_line(&mut command).unwrap();
            assert_eq!(command.trim(), "go");
            let outcome = c.propose(&proposal(&input), &actor);
            let result = match outcome {
                Ok(r) => {
                    serde_json::json!({"ok": true, "change": r.change_id, "container": r.container_id, "request": r.request_id, "actor": r.actor, "what": r.what, "why": r.why, "state": r.state})
                }
                Err(e) => {
                    serde_json::json!({"ok": false, "issue": format!("{e:?}").to_lowercase()})
                }
            };
            send(&format!(
                "{}:{}",
                if mode == "lost" {
                    "committed"
                } else {
                    "result"
                },
                result
            ));
            if mode == "lost" {
                stdin.read_line(&mut String::new()).unwrap();
            }
        }
        return;
    }
    let f = fixtures();
    let input = proposal(&f["fixtures"]["proposal"]);
    let mut c = client(&PathBuf::from(path));
    let r = c
        .propose(&input, f["fixtures"]["owner"].as_str().unwrap())
        .unwrap();
    println!("CHILD_CHANGE={}", r.change_id);
}
const WAIT: Duration = Duration::from_secs(10);
struct RecoveryChild {
    process: Child,
    messages: mpsc::Receiver<String>,
}
impl RecoveryChild {
    fn start(path: &PathBuf, mode: &str, actor: &str, input: &Value) -> Self {
        let mut process = Command::new(std::env::current_exe().unwrap())
            .args(["--exact", "subprocess_entry", "--nocapture"])
            .env("CK_INTAKE_CHILD_PATH", path)
            .env("CK_INTAKE_RECOVERY_MODE", mode)
            .env("CK_INTAKE_RECOVERY_INPUT", input.to_string())
            .env("CK_INTAKE_RECOVERY_ACTOR", actor)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        let (tx, messages) = mpsc::channel();
        let stdout = process.stdout.take().unwrap();
        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                if tx.send(line.unwrap()).is_err() {
                    break;
                }
            }
        });
        let child = Self { process, messages };
        child.next("ready");
        child
    }
    fn next(&self, event: &str) -> Option<Value> {
        let deadline = Instant::now() + WAIT;
        loop {
            let line = self
                .messages
                .recv_timeout(deadline.saturating_duration_since(Instant::now()))
                .unwrap_or_else(|e| panic!("child {event} wait failed: {e}"));
            if let Some((name, data)) = line.split_once(':') {
                if name == event {
                    return Some(serde_json::from_str(data).unwrap());
                }
            } else if line == event {
                return None;
            }
        }
    }
    fn command(&mut self, command: &str) {
        writeln!(self.process.stdin.as_mut().unwrap(), "{command}").unwrap();
    }
}
impl Drop for RecoveryChild {
    fn drop(&mut self) {
        let _ = self.process.kill();
        let deadline = Instant::now() + WAIT;
        while self.process.try_wait().unwrap().is_none() {
            assert!(Instant::now() < deadline, "child failed to exit after kill");
            thread::sleep(Duration::from_millis(10));
        }
    }
}
fn fresh(path: &PathBuf, actor: &str, input: &Value) -> Value {
    let mut child = RecoveryChild::start(path, "propose", actor, input);
    child.command("go");
    child.next("result").unwrap()
}
fn result_receipt(value: &Value, input: &Value, expect: &Value) {
    assert_eq!(value["ok"], true);
    assert_eq!(value["container"], input["containerId"]);
    assert_eq!(value["request"], input["requestId"]);
    assert_eq!(value["state"], expect["state"]);
    assert_eq!(value["what"], expect["what"]);
    assert_eq!(value["why"], expect["why"]);
    assert!(value["actor"].as_str().is_some());
    assert_eq!(value["change"].as_str().unwrap().len(), 64);
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
fn recovery_cases_across_processes() {
    let corpus = recovery();
    let f = &corpus["fixtures"];
    let owner = f["owner"].as_str().unwrap();
    let other_owner = f["otherOwner"].as_str().unwrap();
    let container = f["container"]["containerId"].as_str().unwrap();
    let other = f["otherContainer"]["containerId"].as_str().unwrap();
    let input = &f["proposal"];
    let competitor = &f["competitor"];
    let other_input = &f["otherProposal"];
    let mut seen = Vec::new();
    for case in corpus["cases"].as_array().unwrap() {
        let id = id_for_case(case);
        seen.push(id);
        let mut expect = case["expect"].clone();
        if std::env::var_os("CK_MUTATE_RECOVERY_EXPECTATION").is_some()
            && id == "lost-reply-after-commit"
        {
            expect["what"] = Value::String("wrong expected intent".into());
        }
        let file = Fixture::new();
        let mut c = Intake::new(SqliteIntake::initialize(&file.0).unwrap());
        c.create(container, owner).unwrap();
        match id {
            "lost-reply-after-commit" => {
                let mut worker = RecoveryChild::start(&file.0, "lost", owner, input);
                worker.command("go");
                let committed = worker.next("committed").unwrap();
                assert_eq!(committed["ok"], true);
                drop(worker); // Committed; reply not delivered to caller.
                let retry = fresh(&file.0, owner, input);
                result_receipt(&retry, input, &expect);
                assert_eq!(committed, retry);
                assert_eq!(fresh(&file.0, owner, input), retry);
                assert_eq!(
                    c.read(container, retry["change"].as_str().unwrap(), owner)
                        .unwrap()
                        .what,
                    retry["what"]
                );
            }
            "competing-first-proposals" => {
                let mut first = RecoveryChild::start(&file.0, "propose", owner, input);
                let mut second = RecoveryChild::start(&file.0, "propose", owner, competitor);
                first.command("go");
                second.command("go");
                let outcomes = [
                    first.next("result").unwrap(),
                    second.next("result").unwrap(),
                ];
                assert_eq!(outcomes.iter().filter(|v| v["ok"] == true).count(), 1);
                let winner = if outcomes[0]["ok"] == true { 0 } else { 1 };
                let inputs = [input, competitor];
                let receipt = &outcomes[winner];
                assert!(expect["allowedWhy"]
                    .as_array()
                    .unwrap()
                    .contains(&receipt["why"]));
                let mut expected = expect.clone();
                expected["why"] = inputs[winner]["why"].clone();
                result_receipt(receipt, inputs[winner], &expected);
                assert_eq!(outcomes[1 - winner]["issue"], expect["loser"]);
                assert_eq!(fresh(&file.0, owner, inputs[winner]), *receipt);
                assert_eq!(
                    fresh(&file.0, owner, inputs[1 - winner])["issue"],
                    expect["loser"]
                );
                assert_eq!(
                    c.read(container, receipt["change"].as_str().unwrap(), owner)
                        .unwrap()
                        .why
                        .as_deref(),
                    receipt["why"].as_str()
                );
            }
            "lock-timeout-and-retry" => {
                let mut lock = RecoveryChild::start(&file.0, "lock", owner, input);
                let started = Instant::now();
                assert_eq!(
                    c.propose(&proposal(input), owner),
                    Err(code(expect["first"].as_str().unwrap()))
                );
                assert!(
                    started.elapsed() < WAIT,
                    "lock wait exceeded bounded deadline"
                );
                lock.command("release");
                lock.next("released");
                drop(lock);
                let receipt = fresh(&file.0, owner, input);
                result_receipt(&receipt, input, &expect);
                assert_eq!(fresh(&file.0, owner, input), receipt);
                assert_eq!(
                    c.read(container, receipt["change"].as_str().unwrap(), owner)
                        .unwrap()
                        .what,
                    receipt["what"]
                );
            }
            "independent-containers" => {
                c.create(other, other_owner).unwrap();
                let first = fresh(&file.0, owner, input);
                let second = fresh(&file.0, other_owner, other_input);
                let one = serde_json::json!({"state": expect["state"], "what": expect["firstWhat"], "why": expect["firstWhy"]});
                let two = serde_json::json!({"state": expect["state"], "what": expect["secondWhat"], "why": expect["secondWhy"]});
                result_receipt(&first, input, &one);
                result_receipt(&second, other_input, &two);
                assert_ne!(first["change"], second["change"]);
                assert_eq!(first["actor"], owner);
                assert_eq!(second["actor"], other_owner);
                assert_eq!(
                    c.read(container, first["change"].as_str().unwrap(), owner)
                        .unwrap()
                        .what,
                    first["what"]
                );
                assert_eq!(
                    c.read(other, second["change"].as_str().unwrap(), other_owner)
                        .unwrap()
                        .what,
                    second["what"]
                );
                for (scope, change, actor) in [
                    (container, &first["change"], other_owner),
                    (other, &second["change"], owner),
                ] {
                    assert_eq!(
                        c.read(scope, change.as_str().unwrap(), actor),
                        Err(code(expect["denied"].as_str().unwrap()))
                    );
                }
                assert_eq!(
                    c.propose(&proposal(other_input), owner),
                    Err(code(expect["denied"].as_str().unwrap()))
                );
                assert_eq!(
                    c.propose(&proposal(input), other_owner),
                    Err(code(expect["denied"].as_str().unwrap()))
                );
                assert_eq!(fresh(&file.0, owner, input), first);
                assert_eq!(fresh(&file.0, other_owner, other_input), second);
            }
            _ => panic!("unknown recovery case {id}"),
        }
        assert_eq!(count(&file.0), expect["rows"].as_i64().unwrap());
    }
    assert_eq!(
        seen,
        [
            "lost-reply-after-commit",
            "competing-first-proposals",
            "lock-timeout-and-retry",
            "independent-containers"
        ]
    );
}
#[test]
fn missing_retry_binding_is_unavailable_not_denied() {
    let f = fixtures();
    let p = proposal(&f["fixtures"]["proposal"]);
    let owner = f["fixtures"]["owner"].as_str().unwrap();
    let file = Fixture::new();
    let mut c = Intake::new(SqliteIntake::initialize(&file.0).unwrap());
    c.create(&p.container_id, owner).unwrap();
    let r = c.propose(&p, owner).unwrap();
    Connection::open(&file.0)
        .unwrap()
        .execute("DELETE FROM ck_native_retries", [])
        .unwrap();
    assert_eq!(
        c.read(&p.container_id, &r.change_id, owner),
        Err(Issue::Unavailable)
    );
    assert_eq!(c.propose(&p, owner), Err(Issue::Unavailable));
    assert_eq!(count(&file.0), 1);
}
#[test]
fn rejected_store_preserves_persistent_journal_setting() {
    for existing in [false, true] {
        let file = Fixture::new();
        let db = Connection::open(&file.0).unwrap();
        db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE foreign_data (value TEXT); INSERT INTO foreign_data VALUES ('keep');").unwrap();
        drop(db);
        if existing {
            assert_eq!(
                SqliteIntake::open_existing(&file.0).err(),
                Some(Issue::Unavailable)
            );
        } else {
            assert_eq!(
                SqliteIntake::initialize(&file.0).err(),
                Some(Issue::Unavailable)
            );
        }
        let mode: String = Connection::open(&file.0)
            .unwrap()
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .unwrap();
        assert_eq!(mode, "wal");
        let value: String = Connection::open(&file.0)
            .unwrap()
            .query_row("SELECT value FROM foreign_data", [], |r| r.get(0))
            .unwrap();
        assert_eq!(value, "keep");
    }
    let file = Fixture::new();
    SqliteIntake::initialize(&file.0).unwrap();
    let db = Connection::open(&file.0).unwrap();
    db.execute_batch(
        "UPDATE ck_native_intake_schema SET version = 'future'; PRAGMA journal_mode=WAL;",
    )
    .unwrap();
    drop(db);
    assert_eq!(
        SqliteIntake::open_existing(&file.0).err(),
        Some(Issue::Unavailable)
    );
    assert_eq!(
        SqliteIntake::initialize(&file.0).err(),
        Some(Issue::Unavailable)
    );
    let db = Connection::open(&file.0).unwrap();
    let mode: String = db
        .query_row("PRAGMA journal_mode", [], |r| r.get(0))
        .unwrap();
    let version: String = db
        .query_row("SELECT version FROM ck_native_intake_schema", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(mode, "wal");
    assert_eq!(version, "future");
}
#[test]
fn failed_retry_insert_rolls_back_change() {
    let f = fixtures();
    let p = proposal(&f["fixtures"]["proposal"]);
    let owner = f["fixtures"]["owner"].as_str().unwrap();
    let file = Fixture::new();
    let mut c = Intake::new(SqliteIntake::initialize(&file.0).unwrap());
    c.create(&p.container_id, owner).unwrap();
    let db = Connection::open(&file.0).unwrap();
    db.execute_batch("CREATE TRIGGER refuse_retry BEFORE INSERT ON ck_native_retries BEGIN SELECT RAISE(ABORT, 'fault'); END").unwrap();
    assert_eq!(c.propose(&p, owner), Err(Issue::Unavailable));
    assert_eq!(count(&file.0), 0);
    let retries: i64 = db
        .query_row("SELECT count(*) FROM ck_native_retries", [], |r| r.get(0))
        .unwrap();
    assert_eq!(retries, 0);
    db.execute_batch("DROP TRIGGER refuse_retry").unwrap();
    let receipt = c.propose(&p, owner).unwrap();
    assert_eq!(
        c.read(&p.container_id, &receipt.change_id, owner),
        Ok(receipt)
    );
    assert_eq!(count(&file.0), 1);
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
