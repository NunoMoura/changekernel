use changekernel::{
    read_intent, revise_intent, Intake, IntentRevision, IntentRevisionRequest, Issue, Proposal,
    Receipt, SqliteIntake,
};
use rusqlite::{params_from_iter, types::Value, Connection};
use std::{
    fs,
    path::PathBuf,
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
        let dir = std::env::temp_dir().join(format!(
            "ck-intent-revision-{}-{}-{}",
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
    fn setup(&self) -> (Intake<SqliteIntake>, Receipt, IntentRevision) {
        let mut intake = Intake::new(SqliteIntake::initialize_continuation(&self.0).unwrap());
        intake.create("c", "owner").unwrap();
        let receipt = intake
            .propose(&proposal("first", " Original ", None), "owner")
            .unwrap();
        let zero = read_intent(&intake, "c", &receipt.change_id, None, "owner").unwrap();
        (intake, receipt, zero)
    }
    fn reopen(&self) -> Intake<SqliteIntake> {
        Intake::new(SqliteIntake::open_existing(&self.0).unwrap())
    }
    fn db(&self) -> Connection {
        Connection::open(&self.0).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        fs::remove_dir_all(self.0.parent().unwrap()).unwrap();
    }
}
fn proposal(request: &str, what: &str, why: Option<&str>) -> Proposal {
    Proposal {
        container_id: "c".into(),
        request_id: request.into(),
        what: what.into(),
        why: why.map(str::to_owned),
    }
}
fn revision(
    change: &str,
    request: &str,
    expected: &str,
    what: &str,
    why: Option<&str>,
) -> IntentRevisionRequest {
    IntentRevisionRequest {
        container_id: "c".into(),
        change_id: change.into(),
        request_id: request.into(),
        expected_revision: expected.into(),
        what: what.into(),
        why: why.map(str::to_owned),
    }
}
fn counts(db: &Connection) -> (i64, i64, i64) {
    db.query_row(
        "SELECT (SELECT count(*) FROM ck_native_intent_revisions), (SELECT count(*) FROM ck_native_intent_retries), (SELECT count(*) FROM ck_native_intent_heads)",
        [],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    )
    .unwrap()
}

// Raw fixture insertion deliberately bypasses the append API to construct damaged/maximal custody.
fn raw_revision(db: &Connection, revision: &IntentRevision) {
    let optional = |text: &Option<String>| text.clone().map(Value::Text).unwrap_or(Value::Null);
    db.execute(
        "INSERT INTO ck_native_intent_revisions VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params_from_iter([
            Value::Text(revision.container_id.clone()),
            Value::Text(revision.change_id.clone()),
            Value::Text(revision.revision_id.clone()),
            optional(&revision.previous_revision),
            optional(&revision.request_id),
            Value::Text(revision.actor.clone()),
            Value::Text(revision.what.clone()),
            optional(&revision.why),
        ]),
    )
    .unwrap();
}

#[test]
fn append_reopen_history_retry_conflicts_and_original_receipt() {
    let f = Fixture::new();
    let (mut intake, receipt, zero) = f.setup();
    let first = revision(
        &receipt.change_id,
        "rev-1",
        &zero.revision_id,
        "  e\u{301}\n",
        None,
    );
    let one = revise_intent(&mut intake, &first, "owner").unwrap();
    assert_eq!(one, IntentRevision::successor(&first, "owner").unwrap());
    assert_eq!(
        one.previous_revision.as_deref(),
        Some(zero.revision_id.as_str())
    );
    assert_eq!(one.request_id.as_deref(), Some("rev-1"));
    assert_eq!(one.actor, "owner");
    let second = revision(
        &receipt.change_id,
        "rev-2",
        &one.revision_id,
        "New goal",
        Some(""),
    );
    let two = revise_intent(&mut intake, &second, "owner").unwrap();
    assert_eq!(two.why.as_deref(), Some(""));
    assert_ne!(one.revision_id, two.revision_id);
    drop(intake);
    let mut intake = f.reopen();
    assert_eq!(
        intake.read("c", &receipt.change_id, "owner"),
        Ok(receipt.clone())
    );
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "owner"),
        Ok(two.clone())
    );
    assert_eq!(
        read_intent(
            &intake,
            "c",
            &receipt.change_id,
            Some(&one.revision_id),
            "owner"
        ),
        Ok(one.clone())
    );
    assert_eq!(
        read_intent(
            &intake,
            "c",
            &receipt.change_id,
            Some(&zero.revision_id),
            "owner"
        ),
        Ok(zero.clone())
    );
    assert_eq!(revise_intent(&mut intake, &first, "owner"), Ok(one)); // stale head: exact retry still works
    assert_eq!(
        revise_intent(&mut intake, &second, "owner"),
        Ok(two.clone())
    );
    let mut changed = first.clone();
    changed.why = Some(String::new()); // absent is not present-empty
    assert_eq!(
        revise_intent(&mut intake, &changed, "owner"),
        Err(Issue::Conflict)
    );
    changed = first.clone();
    changed.expected_revision = two.revision_id.clone();
    assert_eq!(
        revise_intent(&mut intake, &changed, "owner"),
        Err(Issue::Conflict)
    );
    let stale = revision(
        &receipt.change_id,
        "fresh",
        &zero.revision_id,
        "Stale",
        None,
    );
    assert_eq!(
        revise_intent(&mut intake, &stale, "owner"),
        Err(Issue::Conflict)
    );
    let other = intake
        .propose(&proposal("other", "Other Change", None), "owner")
        .unwrap();
    let other_zero = read_intent(&intake, "c", &other.change_id, None, "owner").unwrap();
    let reused = revision(
        &other.change_id,
        "rev-1",
        &other_zero.revision_id,
        "Other revision",
        None,
    );
    assert_eq!(
        revise_intent(&mut intake, &reused, "owner"),
        Err(Issue::Conflict)
    );
    assert_eq!(counts(&f.db()), (4, 2, 2));
    // Request identity is container-scoped, not global.
    intake.create("d", "owner").unwrap();
    let mut other_proposal = proposal("first", "Container d", None);
    other_proposal.container_id = "d".into();
    let in_d = intake.propose(&other_proposal, "owner").unwrap();
    let d_zero = read_intent(&intake, "d", &in_d.change_id, None, "owner").unwrap();
    let mut in_d_request = revision(&in_d.change_id, "rev-1", &d_zero.revision_id, "New", None);
    in_d_request.container_id = "d".into();
    assert!(revise_intent(&mut intake, &in_d_request, "owner").is_ok());
    assert_eq!(counts(&f.db()), (6, 3, 3));
}

#[test]
fn access_profile_and_lock_fail_closed_without_creating_custody() {
    let f = Fixture::new();
    let (mut intake, receipt, zero) = f.setup();
    let request = revision(
        &receipt.change_id,
        "rev",
        &zero.revision_id,
        "Changed",
        None,
    );
    assert_eq!(
        revise_intent(&mut intake, &request, "outsider"),
        Err(Issue::Denied)
    );
    assert_eq!(revise_intent(&mut intake, &request, ""), Err(Issue::Denied));
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "outsider"),
        Err(Issue::Denied)
    );
    let db = f.db();
    db.execute_batch("BEGIN IMMEDIATE").unwrap();
    assert_eq!(
        revise_intent(&mut intake, &request, "owner"),
        Err(Issue::Unavailable)
    );
    db.execute_batch("ROLLBACK").unwrap();
    assert_eq!(counts(&db), (1, 0, 1));
    assert!(revise_intent(&mut intake, &request, "owner").is_ok());

    let legacy = Fixture::new();
    let mut old = Intake::new(SqliteIntake::initialize(&legacy.0).unwrap());
    old.create("c", "owner").unwrap();
    let original = old
        .propose(&proposal("first", " Original ", None), "owner")
        .unwrap();
    let old_request = revision(
        &original.change_id,
        "rev",
        &zero.revision_id,
        "Changed",
        None,
    );
    let before: i64 = legacy
        .db()
        .query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0))
        .unwrap();
    assert_eq!(
        revise_intent(&mut old, &old_request, "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(
        read_intent(&old, "c", &original.change_id, None, "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(
        legacy
            .db()
            .query_row("SELECT count(*) FROM sqlite_master", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        before
    );
    drop(old);
    assert_eq!(
        read_intent(&legacy.reopen(), "c", &original.change_id, None, "owner"),
        Err(Issue::Unavailable)
    );
}

#[test]
fn append_is_atomic_on_late_failure_and_can_retry_after_repair() {
    let f = Fixture::new();
    let (mut intake, receipt, zero) = f.setup();
    let request = revision(
        &receipt.change_id,
        "rev",
        &zero.revision_id,
        "Changed",
        None,
    );
    let db = f.db();
    db.execute_batch("CREATE TRIGGER fail_head BEFORE UPDATE ON ck_native_intent_heads BEGIN SELECT RAISE(ABORT, 'injected'); END").unwrap();
    assert_eq!(
        revise_intent(&mut intake, &request, "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(counts(&db), (1, 0, 1));
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "owner"),
        Ok(zero.clone())
    );
    db.execute_batch("DROP TRIGGER fail_head").unwrap();
    let one = revise_intent(&mut intake, &request, "owner").unwrap();
    assert_eq!(counts(&db), (2, 1, 1));
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "owner"),
        Ok(one)
    );
}

#[test]
fn racing_new_heads_and_racing_retries_never_duplicate_history() {
    for same_request in [false, true] {
        let f = Fixture::new();
        let (intake, receipt, zero) = f.setup();
        drop(intake);
        let gate = Arc::new(Barrier::new(3));
        let joins: Vec<_> = (0..2)
            .map(|i| {
                let path = f.0.clone();
                let gate = gate.clone();
                let req = revision(
                    &receipt.change_id,
                    if same_request || i == 0 { "one" } else { "two" },
                    &zero.revision_id,
                    "Changed",
                    None,
                );
                thread::spawn(move || {
                    let mut intake = Intake::new(SqliteIntake::open_existing(path).unwrap());
                    gate.wait();
                    revise_intent(&mut intake, &req, "owner")
                })
            })
            .collect();
        gate.wait();
        let outcomes: Vec<_> = joins.into_iter().map(|join| join.join().unwrap()).collect();
        if same_request {
            assert_eq!(outcomes[0], outcomes[1]);
            assert!(outcomes[0].is_ok());
        } else {
            assert_eq!(outcomes.iter().filter(|result| result.is_ok()).count(), 1);
            assert_eq!(
                outcomes
                    .iter()
                    .filter(|result| **result == Err(Issue::Conflict))
                    .count(),
                1
            );
        }
        assert_eq!(counts(&f.db()), (2, 1, 1));
        assert_eq!(
            read_intent(&f.reopen(), "c", &receipt.change_id, None, "owner"),
            Ok(outcomes.into_iter().find_map(Result::ok).unwrap())
        );
    }
}

#[test]
fn missing_or_damaged_history_blocks_reads_and_writes() {
    for damage in [
        "origin",
        "head",
        "revision",
        "retry",
        "content",
        "binding",
        "detached",
        "detached_retry",
        "receipt",
        "missing_receipt",
    ] {
        let f = Fixture::new();
        let (mut intake, receipt, zero) = f.setup();
        let request = revision(
            &receipt.change_id,
            "rev-1",
            &zero.revision_id,
            "Changed",
            None,
        );
        let one = revise_intent(&mut intake, &request, "owner").unwrap();
        let db = f.db();
        db.execute_batch("PRAGMA foreign_keys = OFF").unwrap(); // external custody damage
        match damage {
            "origin" => {
                db.execute(
                    "DELETE FROM ck_native_intent_revisions WHERE revision_id = ?1",
                    [&zero.revision_id],
                )
                .unwrap();
            }
            "head" => {
                db.execute("DELETE FROM ck_native_intent_heads", [])
                    .unwrap();
            }
            "revision" => {
                db.execute(
                    "DELETE FROM ck_native_intent_revisions WHERE revision_id = ?1",
                    [&one.revision_id],
                )
                .unwrap();
            }
            "retry" => {
                db.execute("DELETE FROM ck_native_intent_retries", [])
                    .unwrap();
            }
            "content" => {
                db.execute("UPDATE ck_native_intent_revisions SET what_text = 'tampered' WHERE revision_id = ?1", [&one.revision_id]).unwrap();
            }
            "binding" => {
                db.execute(
                    "UPDATE ck_native_intent_retries SET revision_id = ?1",
                    [&zero.revision_id],
                )
                .unwrap();
            }
            "detached" => {
                let extra = IntentRevision::successor(
                    &revision(
                        &receipt.change_id,
                        "detached",
                        &zero.revision_id,
                        "Detached",
                        None,
                    ),
                    "owner",
                )
                .unwrap();
                raw_revision(&db, &extra);
            }
            "detached_retry" => {
                db.execute(
                    "INSERT INTO ck_native_intent_retries VALUES (?1, ?2, ?3, ?4, ?5)",
                    params_from_iter([
                        "c",
                        "owner",
                        "unbound",
                        receipt.change_id.as_str(),
                        zero.revision_id.as_str(),
                    ]),
                )
                .unwrap();
            }
            "receipt" => {
                db.execute("UPDATE ck_native_changes SET what_text = 'tampered'", [])
                    .unwrap();
            }
            "missing_receipt" => {
                db.execute("DELETE FROM ck_native_changes", []).unwrap();
            }
            _ => unreachable!(),
        }
        let before = counts(&db);
        for selected in [
            None,
            Some(zero.revision_id.as_str()),
            Some(one.revision_id.as_str()),
        ] {
            assert_eq!(
                read_intent(&intake, "c", &receipt.change_id, selected, "owner"),
                Err(Issue::Unavailable),
                "{damage} selected={selected:?}"
            );
        }
        assert_eq!(
            revise_intent(&mut intake, &request, "owner"),
            Err(Issue::Unavailable),
            "{damage} exact retry"
        );
        let fresh = revision(&receipt.change_id, "fresh", &one.revision_id, "Fresh", None);
        assert_eq!(
            revise_intent(&mut intake, &fresh, "owner"),
            Err(Issue::Unavailable),
            "{damage} new append"
        );
        assert_eq!(
            read_intent(&intake, "c", &receipt.change_id, None, "outsider"),
            Err(Issue::Denied),
            "{damage} leaked damaged custody"
        );
        assert_eq!(counts(&db), before, "{damage} changed custody");
    }
}

#[test]
fn lost_retry_on_another_change_does_not_create_new_identity() {
    let f = Fixture::new();
    let (mut intake, receipt, zero) = f.setup();
    let request = revision(
        &receipt.change_id,
        "shared",
        &zero.revision_id,
        "Changed",
        None,
    );
    revise_intent(&mut intake, &request, "owner").unwrap();
    let other = intake
        .propose(&proposal("second", "Other", None), "owner")
        .unwrap();
    let other_zero = read_intent(&intake, "c", &other.change_id, None, "owner").unwrap();
    let db = f.db();
    db.execute(
        "DELETE FROM ck_native_intent_retries WHERE request_id = 'shared'",
        [],
    )
    .unwrap();
    let before = counts(&db);
    assert_eq!(
        revise_intent(
            &mut intake,
            &revision(
                &other.change_id,
                "shared",
                &other_zero.revision_id,
                "Other revision",
                None
            ),
            "owner"
        ),
        Err(Issue::Unavailable)
    );
    assert_eq!(counts(&db), before);
}

#[test]
fn full_history_keeps_exact_retry_but_refuses_fresh_append() {
    let f = Fixture::new();
    let (intake, receipt, zero) = f.setup();
    drop(intake);
    let mut db = f.db();
    let tx = db.transaction().unwrap();
    let mut prior = zero.revision_id;
    let mut last_request = None;
    let mut last_revision = None;
    // One transaction builds a valid maximal lineage without quadratic per-append verification.
    for index in 1..1024 {
        let request = revision(
            &receipt.change_id,
            &format!("r{index}"),
            &prior,
            "Same text",
            None,
        );
        let next = IntentRevision::successor(&request, "owner").unwrap();
        raw_revision(&tx, &next);
        tx.execute(
            "INSERT INTO ck_native_intent_retries VALUES (?1, ?2, ?3, ?4, ?5)",
            params_from_iter([
                next.container_id.as_str(),
                next.actor.as_str(),
                request.request_id.as_str(),
                next.change_id.as_str(),
                next.revision_id.as_str(),
            ]),
        )
        .unwrap();
        prior = next.revision_id.clone();
        last_request = Some(request);
        last_revision = Some(next);
    }
    tx.execute(
        "UPDATE ck_native_intent_heads SET revision_id = ?1",
        [&prior],
    )
    .unwrap();
    tx.commit().unwrap();
    let mut intake = f.reopen();
    let last = last_revision.unwrap();
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "owner"),
        Ok(last.clone())
    );
    assert_eq!(
        revise_intent(&mut intake, &last_request.unwrap(), "owner"),
        Ok(last.clone())
    );
    let fresh = revision(
        &receipt.change_id,
        "beyond",
        &last.revision_id,
        "Beyond",
        None,
    );
    assert_eq!(
        revise_intent(&mut intake, &fresh, "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(counts(&db), (1024, 1023, 1));
    assert_eq!(
        read_intent(&intake, "c", &receipt.change_id, None, "owner"),
        Ok(last)
    );
}
