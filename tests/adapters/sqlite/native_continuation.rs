//! Shared baseline only: concrete candidate retention and intent append are separate worker slices.
use changekernel::{
    read_intent, ContinuationStore, Intake, IntentRevision, IntentRevisionRequest, Issue, Proposal,
    Receipt, SqliteIntake,
};
use rusqlite::{params, Connection};
use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicUsize, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let dir = std::env::temp_dir().join(format!(
            "ck-continuation-{}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&dir).unwrap();
        Self(dir.join("store.sqlite"))
    }
    fn setup(&self) -> (Intake<SqliteIntake>, Receipt) {
        let mut intake = Intake::new(SqliteIntake::initialize_continuation(&self.0).unwrap());
        intake.create("c", "owner").unwrap();
        let receipt = intake.propose(&proposal(), "owner").unwrap();
        (intake, receipt)
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(self.0.parent().unwrap()).unwrap();
    }
}
fn proposal() -> Proposal {
    Proposal {
        container_id: "c".into(),
        request_id: "initial".into(),
        what: "  Keep exact e\u{301}\n".into(),
        why: Some(String::new()),
    }
}
fn count(db: &Connection, table: &str) -> i64 {
    db.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
        .unwrap()
}

#[test]
fn explicit_profiles_preserve_original_intake_and_revision_zero_after_restart() {
    let old = Fixture::new();
    let mut legacy = Intake::new(SqliteIntake::initialize(&old.0).unwrap());
    legacy.create("c", "owner").unwrap();
    let original = legacy.propose(&proposal(), "owner").unwrap();
    assert_eq!(
        read_intent(&legacy, "c", &original.change_id, None, "owner"),
        Err(Issue::Unavailable)
    );
    let bytes = fs::read(&old.0).unwrap();
    assert!(matches!(
        SqliteIntake::initialize_continuation(&old.0),
        Err(Issue::Unavailable)
    ));
    assert_eq!(bytes, fs::read(&old.0).unwrap());
    assert_eq!(
        legacy.read("c", &original.change_id, "owner").unwrap(),
        original
    );

    let f = Fixture::new();
    let (mut intake, receipt) = f.setup();
    assert_eq!(receipt, original);
    let zero = read_intent(&intake, "c", &receipt.change_id, None, "owner").unwrap();
    assert_eq!((&zero.what, &zero.why), (&receipt.what, &receipt.why));
    assert_eq!(zero.previous_revision, None);
    assert_eq!(zero.request_id, None);
    assert_eq!(intake.propose(&proposal(), "owner").unwrap(), receipt);
    drop(intake);
    let reopened = Intake::new(SqliteIntake::open_existing(&f.0).unwrap());
    let before = fs::read(&f.0).unwrap();
    assert_eq!(
        read_intent(
            &reopened,
            "c",
            &receipt.change_id,
            Some(&zero.revision_id),
            "owner"
        )
        .unwrap(),
        zero
    );
    assert_eq!(
        read_intent(&reopened, "c", &receipt.change_id, None, "other"),
        Err(Issue::Denied)
    );
    assert_eq!(before, fs::read(&f.0).unwrap());
}

#[test]
fn original_retry_and_revision_zero_are_one_atomic_write() {
    let f = Fixture::new();
    let mut intake = Intake::new(SqliteIntake::initialize_continuation(&f.0).unwrap());
    intake.create("c", "owner").unwrap();
    let db = Connection::open(&f.0).unwrap();
    // Fault injection after opening; production reopening rejects this trigger.
    db.execute_batch("CREATE TRIGGER fail_origin BEFORE INSERT ON ck_native_intent_heads BEGIN SELECT RAISE(ABORT, 'injected'); END;").unwrap();
    assert_eq!(
        intake.propose(&proposal(), "owner"),
        Err(Issue::Unavailable)
    );
    for table in [
        "ck_native_changes",
        "ck_native_retries",
        "ck_native_intent_revisions",
        "ck_native_intent_heads",
    ] {
        assert_eq!(count(&db, table), 0, "{table} partially retained");
    }
    db.execute_batch("DROP TRIGGER fail_origin").unwrap();
    let receipt = intake.propose(&proposal(), "owner").unwrap();
    db.execute_batch("DELETE FROM ck_native_intent_heads")
        .unwrap();
    let before = fs::read(&f.0).unwrap();
    assert_eq!(
        intake.propose(&proposal(), "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(
        before,
        fs::read(&f.0).unwrap(),
        "retry must not repair a missing head"
    );
}

#[test]
fn shared_head_guard_verifies_lineage_and_retry_grounds() {
    let f = Fixture::new();
    let (intake, receipt) = f.setup();
    let zero = read_intent(&intake, "c", &receipt.change_id, None, "owner").unwrap();
    let store = SqliteIntake::open_existing(&f.0).unwrap();
    assert_eq!(
        store
            .check_intent_head("c", &receipt.change_id, &zero.revision_id, "owner")
            .unwrap(),
        zero
    );
    let next = IntentRevision::successor(
        &IntentRevisionRequest {
            container_id: "c".into(),
            change_id: receipt.change_id.clone(),
            request_id: "revision-1".into(),
            expected_revision: zero.revision_id.clone(),
            what: "Changed goal".into(),
            why: None,
        },
        "owner",
    )
    .unwrap();
    let mut db = Connection::open(&f.0).unwrap();
    // Construct a persisted protocol fixture, not an implementation of the future append API.
    let tx = db.transaction().unwrap();
    tx.execute(
        "INSERT INTO ck_native_intent_revisions VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            next.container_id,
            next.change_id,
            next.revision_id,
            next.previous_revision,
            next.request_id,
            next.actor,
            next.what,
            next.why
        ],
    )
    .unwrap();
    tx.execute(
        "INSERT INTO ck_native_intent_retries VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            next.container_id,
            next.actor,
            next.request_id,
            next.change_id,
            next.revision_id
        ],
    )
    .unwrap();
    tx.execute(
        "UPDATE ck_native_intent_heads SET revision_id = ?1",
        [&next.revision_id],
    )
    .unwrap();
    tx.commit().unwrap();
    assert_eq!(
        store.check_intent_head("c", &receipt.change_id, &zero.revision_id, "owner"),
        Err(Issue::Conflict)
    );
    assert_eq!(
        store
            .check_intent_head("c", &receipt.change_id, &next.revision_id, "owner")
            .unwrap(),
        next
    );
    assert_eq!(
        read_intent(
            &intake,
            "c",
            &receipt.change_id,
            Some(&zero.revision_id),
            "owner"
        )
        .unwrap(),
        zero
    );
    assert_eq!(
        intake.read("c", &receipt.change_id, "owner").unwrap(),
        receipt
    );
    db.execute(
        "UPDATE ck_native_intent_revisions SET what_text = 'tampered' WHERE revision_id = ?1",
        [&next.revision_id],
    )
    .unwrap();
    assert_eq!(
        store.check_intent_head("c", &receipt.change_id, &next.revision_id, "owner"),
        Err(Issue::Unavailable)
    );
    db.execute(
        "UPDATE ck_native_intent_revisions SET what_text = ?1 WHERE revision_id = ?2",
        params![next.what, next.revision_id],
    )
    .unwrap();
    db.execute_batch("DELETE FROM ck_native_intent_retries")
        .unwrap();
    assert_eq!(
        store.check_intent_head("c", &receipt.change_id, &next.revision_id, "owner"),
        Err(Issue::Unavailable)
    );
}

#[test]
fn incompatible_continuation_stores_are_refused_without_mutation() {
    for damage in [
        "CREATE TABLE foreign_table (value TEXT)",
        "CREATE INDEX foreign_index ON ck_native_changes(actor)",
        "CREATE TRIGGER foreign_trigger AFTER INSERT ON ck_native_containers BEGIN SELECT 1; END",
        "DROP TABLE ck_native_file_candidate_paths",
        "DROP TABLE ck_native_intake_schema; CREATE VIEW ck_native_intake_schema AS SELECT 'changekernel.native-continuation.sqlite@1' AS version",
        "UPDATE ck_native_intake_schema SET version = 'unknown'",
        "UPDATE ck_native_intake_schema SET version = 'changekernel.native-intake.sqlite@1'",
        "INSERT INTO ck_native_intake_schema SELECT * FROM ck_native_intake_schema",
    ] {
        let f = Fixture::new();
        drop(SqliteIntake::initialize_continuation(&f.0).unwrap());
        let db = Connection::open(&f.0).unwrap();
        db.execute_batch("PRAGMA journal_mode = WAL").unwrap();
        db.execute_batch(damage).unwrap();
        let before = fs::read(&f.0).unwrap();
        assert!(
            matches!(SqliteIntake::open_existing(&f.0), Err(Issue::Unavailable)),
            "{damage}"
        );
        assert!(
            matches!(
                SqliteIntake::initialize_continuation(&f.0),
                Err(Issue::Unavailable)
            ),
            "{damage}"
        );
        assert_eq!(
            db.query_row("PRAGMA journal_mode", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "wal"
        );
        assert_eq!(
            before,
            fs::read(&f.0).unwrap(),
            "rejected store changed: {damage}"
        );
    }
}
