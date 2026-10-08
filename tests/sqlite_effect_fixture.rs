//! Real SQLite application-resource fixtures, not JSONL/engine/host qualification.
#![cfg(target_os = "linux")]
#[path = "sqlite_effect_fixture/resource.rs"]
mod resource;
use resource::{
    Actor, Error, Notice, Operation, Outcome, Owner, Rights, Session, MAX_RECEIPTS, MAX_REVISION,
    MAX_TEXT,
};
use std::{
    fs,
    os::unix::fs::DirBuilderExt,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};
static NEXT: AtomicU64 = AtomicU64::new(0);
struct Fixture {
    root: PathBuf,
    owner: Owner,
}
impl Fixture {
    fn new() -> Self {
        Self::at_revision(1)
    }
    fn at_revision(revision: u64) -> Self {
        let root = fs::canonicalize(std::env::temp_dir())
            .unwrap()
            .join(format!(
                "ck-sql-effect-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
        fs::DirBuilder::new().mode(0o700).create(&root).unwrap();
        eprintln!("new SQLite effect fixture: {}", root.display());
        let owner = Owner::create(
            &root.join("resource"),
            Notice {
                revision,
                text: "Maintenance notice: initial".into(),
            },
        )
        .unwrap();
        Self { root, owner }
    }
    fn session(&self, actor: Actor, readonly: bool) -> Session<'_> {
        Session::open_original(&self.owner, actor, readonly).unwrap()
    }
    fn evidence(&self, label: &str) {
        let directory = self.root.join(label);
        fs::create_dir(&directory).unwrap();
        fs::write(directory.join("native-owner.txt"), self.owner.evidence()).unwrap();
        fs::write(
            directory.join("notice.sqlite"),
            self.owner.database_bytes().unwrap(),
        )
        .unwrap();
        for name in ["notice.sqlite-journal", "owner.lock"] {
            let source = self.owner.path().join(name);
            if source.exists() {
                fs::copy(&source, directory.join(name)).unwrap();
            }
        }
        eprintln!(
            "retained native evidence before assertion: {}",
            directory.display()
        );
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if std::thread::panicking() {
            eprintln!("preserved failed fixture: {}", self.root.display());
        } else {
            fs::remove_dir_all(&self.root).unwrap();
        }
    }
}
fn op(key: &str, expected: u64, text: &str) -> Operation {
    Operation {
        key: key.into(),
        expected,
        text: text.into(),
    }
}
fn denied_edit() -> Rights {
    Rights {
        read: true,
        edit: false,
        admin: false,
    }
}

#[test]
fn update_and_immutable_original_receipt_survive_client_close_and_edit_revocation() {
    let f = Fixture::new();
    let mut client = f.session(Actor::Owner, false);
    assert_eq!(client.durability().unwrap(), ("delete".into(), 3));
    let operation = op("apply-a", 1, "Maintenance notice: repaired");
    let receipt = client.invoke(&operation).unwrap();
    assert_eq!(receipt.outcome, Outcome::Applied);
    assert_eq!(receipt.actor, "owner-1");
    assert_eq!(receipt.operation, operation);
    assert_eq!(receipt.notice.revision, 2);
    assert_eq!(client.inspect().unwrap(), receipt.notice);
    f.evidence("committed-original");
    client
        .set_rights(
            Actor::Owner,
            Rights {
                read: true,
                edit: false,
                admin: true,
            },
        )
        .unwrap();
    drop(client);
    let mut readonly = f.session(Actor::Owner, true);
    assert_eq!(readonly.invoke(&operation).unwrap(), receipt); // no renewed native/edit grant
    assert_eq!(readonly.inspect().unwrap().revision, 2);
    let mut native_readonly = f.session(Actor::Writer, true); // policy still permits edit
    let native_denied = native_readonly.invoke(&op("native-denied", 2, "later"));
    f.evidence("native-write-denial");
    assert_eq!(native_denied, Err(Error::Unavailable));
    let mut writable = f.session(Actor::Owner, false);
    assert_eq!(
        writable.invoke(&op("new-denied", 2, "later")),
        Err(Error::Denied)
    );
    assert_eq!(
        writable.lookup(&op("new-denied", 2, "later")).unwrap(),
        None
    );
}

#[test]
fn independent_writer_connections_serialize_and_stale_cas_retains_conflict() {
    let f = Fixture::new();
    let mut a = f.session(Actor::Owner, false);
    let mut b = f.session(Actor::Writer, false);
    let first = op("first", 1, "first notice");
    let stale = op("stale", 1, "stale writer");
    let pending = a.prepare(&first).unwrap();
    assert_eq!(b.inspect().unwrap().revision, 1); // real read isolation, not tentative effect
    let competing = b.invoke(&stale);
    f.evidence("competing-writer-blocked");
    assert_eq!(competing, Err(Error::Busy)); // actual SQLite reserved writer lock
    let applied = pending.commit().unwrap();
    assert_eq!(applied.notice.revision, 2);
    let conflict = b.invoke(&stale).unwrap();
    assert_eq!(conflict.outcome, Outcome::Conflict);
    assert_eq!(conflict.notice, applied.notice);
    let third = a.invoke(&op("third", 2, "newer notice")).unwrap();
    assert_eq!(third.notice.revision, 3);
    assert_eq!(b.invoke(&stale).unwrap(), conflict); // original conflict, not current values
    assert_eq!(a.inspect().unwrap(), third.notice);
}

#[test]
fn operation_identity_binds_exact_input_and_authenticated_actor() {
    let f = Fixture::new();
    let mut owner = f.session(Actor::Owner, false);
    let original = op("stable-key", 1, "original");
    let receipt = owner.invoke(&original).unwrap();
    for changed in [
        op("stable-key", 2, "original"),
        op("stable-key", 1, "changed"),
    ] {
        assert_eq!(owner.invoke(&changed), Err(Error::KeyConflict));
    }
    let mut writer = f.session(Actor::Writer, false);
    assert_eq!(writer.invoke(&original), Err(Error::KeyConflict));
    assert_eq!(owner.invoke(&original).unwrap(), receipt);
    assert_eq!(owner.inspect().unwrap().revision, 2);
}

#[test]
fn grants_and_revocations_serialize_with_effect_and_current_disclosure() {
    let f = Fixture::new();
    let mut admin = f.session(Actor::Owner, false);
    let mut writer = f.session(Actor::Writer, false);
    let operation = op("writer-op", 1, "authorized before revocation");
    let pending = writer.prepare(&operation).unwrap();
    let blocked_revocation = admin.set_rights(Actor::Writer, denied_edit());
    f.evidence("revocation-blocked-by-effect");
    assert_eq!(blocked_revocation, Err(Error::Busy));
    let receipt = pending.commit().unwrap();
    admin.set_rights(Actor::Writer, denied_edit()).unwrap();
    assert_eq!(writer.invoke(&operation).unwrap(), receipt);
    assert_eq!(
        writer.invoke(&op("new-writer", 2, "denied")),
        Err(Error::Denied)
    );
    admin
        .set_rights(
            Actor::Writer,
            Rights {
                read: false,
                edit: false,
                admin: false,
            },
        )
        .unwrap();
    f.evidence("disclosure-revoked");
    assert_eq!(writer.lookup(&operation), Err(Error::Denied));
    assert_eq!(writer.inspect(), Err(Error::Denied));
    let mut reader = f.session(Actor::Reader, false);
    assert_eq!(reader.inspect().unwrap(), receipt.notice);
    assert_eq!(
        reader.invoke(&op("reader-edit", 2, "no")),
        Err(Error::Denied)
    );
    assert_eq!(
        reader.set_rights(
            Actor::Reader,
            Rights {
                read: true,
                edit: true,
                admin: false
            }
        ),
        Err(Error::Denied)
    );
    let mut denied = f.session(Actor::Denied, true);
    assert_eq!(denied.inspect(), Err(Error::Denied));
    assert_eq!(denied.lookup(&operation), Err(Error::Denied));
}

#[test]
fn explicit_rollback_before_commit_is_not_an_applied_effect() {
    let f = Fixture::new();
    let mut writer = f.session(Actor::Owner, false);
    let mut observer = f.session(Actor::Reader, true);
    let operation = op("rollback-cut", 1, "tentative update");
    let pending = writer.prepare(&operation).unwrap();
    f.evidence("staged-before-rollback");
    assert_eq!(observer.inspect().unwrap().revision, 1);
    pending.rollback().unwrap(); // actual checked ROLLBACK, not inferred from an error
    assert_eq!(writer.lookup(&operation).unwrap(), None);
    assert_eq!(writer.inspect().unwrap().revision, 1);
    let applied = writer.invoke(&operation).unwrap();
    assert_eq!(applied.outcome, Outcome::Applied);
    assert_eq!(applied.notice.revision, 2);
}

#[test]
fn committed_effect_with_deliberately_undelivered_result_recovers_from_receipt() {
    let f = Fixture::new();
    let operation = op("lost-return", 1, "committed but not delivered");
    let mut writer = f.session(Actor::Owner, false);
    let committed = writer.prepare(&operation).unwrap().commit().unwrap();
    let expected = committed.clone();
    drop(committed); // deliberate undelivered value, not OS crash or Trace persistence
    f.evidence("effect-committed-result-discarded");
    drop(writer);
    let mut reopened = f.session(Actor::Owner, false); // Owner's real original handles stay live
    assert_eq!(reopened.lookup(&operation).unwrap(), Some(expected.clone()));
    assert_eq!(reopened.invoke(&operation).unwrap(), expected);
    assert_eq!(reopened.inspect().unwrap().revision, 2);
}

#[test]
fn real_busy_commit_is_unresolved_not_an_assumed_rollback() {
    let f = Fixture::new();
    let mut reader = f.session(Actor::Reader, true);
    let mut writer = f.session(Actor::Owner, false);
    let hold = reader.hold_read().unwrap(); // real SQLite SHARED lock
    let pending = writer
        .prepare(&op("commit-busy", 1, "not known committed"))
        .unwrap();
    let commit = pending.commit();
    f.evidence("failed-commit-active-transaction");
    assert_eq!(commit, Err(Error::Unresolved)); // EXCLUSIVE upgrade cannot proceed
    assert!(writer.transaction_active()); // fixture did not silently roll back the failed COMMIT
    hold.release().unwrap();
    assert_eq!(
        writer.lookup(&op("commit-busy", 1, "not known committed")),
        Err(Error::Unresolved)
    );
    assert!(matches!(
        Session::open_original(&f.owner, Actor::Owner, false),
        Err(Error::Unresolved)
    ));
    // Connection close can roll back SQLite's still-active transaction; that is
    // not permission to clear original outcome/custody uncertainty or retry.
    drop(writer);
    assert!(matches!(
        Session::open_original(&f.owner, Actor::Owner, false),
        Err(Error::Unresolved)
    ));
}

#[test]
fn missing_replaced_or_aliased_native_custody_never_creates_another_instance() {
    for damage in ["missing", "copy", "directory", "hardlink", "writer"] {
        let f = Fixture::new();
        let mut session = f.session(Actor::Owner, false);
        let operation = op("old", 1, "accepted first");
        session.invoke(&operation).unwrap();
        drop(session);
        f.evidence("original-before-custody-damage");
        let path = f.owner.path();
        match damage {
            "missing" | "copy" => {
                fs::rename(
                    path.join("notice.sqlite"),
                    path.join("retained-original.sqlite"),
                )
                .unwrap();
                if damage == "copy" {
                    fs::copy(
                        path.join("retained-original.sqlite"),
                        path.join("notice.sqlite"),
                    )
                    .unwrap();
                }
            }
            "directory" => {
                fs::rename(path, f.root.join("retained-directory")).unwrap();
                fs::create_dir(path).unwrap();
                fs::copy(
                    f.root.join("retained-directory/notice.sqlite"),
                    path.join("notice.sqlite"),
                )
                .unwrap();
            }
            "hardlink" => {
                fs::hard_link(path.join("notice.sqlite"), path.join("extra-link.sqlite")).unwrap()
            }
            "writer" => {
                fs::rename(path.join("owner.lock"), path.join("retained-owner.lock")).unwrap();
                fs::write(path.join("owner.lock"), []).unwrap();
            }
            _ => unreachable!(),
        }
        assert!(
            matches!(
                Session::open_original(&f.owner, Actor::Owner, false),
                Err(Error::Unavailable)
            ),
            "{damage}"
        );
        assert!(matches!(
            Owner::create(
                path,
                Notice {
                    revision: 1,
                    text: "must not recreate".into()
                }
            ),
            Err(Error::Unavailable)
        ));
        assert!(path.exists());
        if damage == "missing" {
            assert!(!path.join("notice.sqlite").exists());
        }
    }
}

#[test]
fn receipt_loss_cannot_be_treated_as_absence_even_when_desired_values_match() {
    let f = Fixture::new();
    let mut session = f.session(Actor::Owner, false);
    let operation = op("retained-proof", 1, "desired matching values");
    let receipt = session.invoke(&operation).unwrap();
    assert_eq!(session.inspect().unwrap(), receipt.notice);
    f.evidence("original-before-receipt-loss");
    // Deliberate, fixed corruption of this test's new DB, not a helper SQL API.
    let damage = rusqlite::Connection::open_with_flags(
        f.owner.path().join("notice.sqlite"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )
    .unwrap();
    assert_eq!(
        damage
            .execute("DELETE FROM receipt WHERE key='retained-proof'", [])
            .unwrap(),
        1
    );
    drop(damage);
    assert_eq!(session.lookup(&operation), Err(Error::Unavailable));
    assert_eq!(session.invoke(&operation), Err(Error::Unresolved));
}

#[test]
fn bounded_inputs_receipts_and_revision_overflow_refuse_without_reuse() {
    let f = Fixture::at_revision(MAX_REVISION);
    let mut session = f.session(Actor::Owner, false);
    assert_eq!(
        session.invoke(&op("overflow", MAX_REVISION, "overflow")),
        Err(Error::Capacity)
    );
    assert_eq!(
        session
            .lookup(&op("overflow", MAX_REVISION, "overflow"))
            .unwrap(),
        None
    );
    assert_eq!(session.inspect().unwrap().revision, MAX_REVISION);
    assert_eq!(
        session.invoke(&op("invalid", MAX_REVISION, &"x".repeat(MAX_TEXT + 1))),
        Err(Error::Invalid)
    );
    let f = Fixture::new();
    let mut session = f.session(Actor::Owner, false);
    // Conflict receipts count toward the bound too; no receipt recycling.
    for i in 0..MAX_RECEIPTS {
        let receipt = session
            .invoke(&op(&format!("stale-{i}"), 2, "stale"))
            .unwrap();
        assert_eq!(receipt.outcome, Outcome::Conflict);
        assert_eq!(receipt.notice.revision, 1);
    }
    f.evidence("full-receipt-retention");
    assert_eq!(
        session.invoke(&op("over-capacity", 1, "new")),
        Err(Error::Capacity)
    );
    assert_eq!(
        session.invoke(&op("stale-0", 2, "stale")).unwrap().outcome,
        Outcome::Conflict
    );
    assert_eq!(session.inspect().unwrap().revision, 1);
}

// Concrete cross-process POSIX-lock regression: metadata/evidence must not
// close auxiliary raw DB fds while SQLite holds the real reserved writer lock.
struct ProbeChild(std::process::Child);
impl Drop for ProbeChild {
    fn drop(&mut self) {
        if !matches!(self.0.try_wait(), Ok(Some(_))) {
            let killed = self.0.kill();
            let reaped = self.0.wait();
            eprintln!(
                "SQLite probe cleanup pid={} kill={killed:?} reap={reaped:?}",
                self.0.id()
            );
        }
    }
}
fn probe_writer(f: &Fixture, expected: &str) {
    use std::{
        process::{Command, Stdio},
        time::{Duration, Instant},
    };
    let nonce = format!(
        "{}-{expected}",
        f.root.file_name().unwrap().to_str().unwrap()
    );
    let result = f.root.join(format!("probe-{expected}.json"));
    let mut child = ProbeChild(
        Command::new(std::env::current_exe().unwrap())
            .args([
                "--exact",
                "sqlite_process_writer_probe",
                "--ignored",
                "--nocapture",
            ])
            .env(
                "CK_SQL_EFFECT_PROBE_DB",
                f.owner.path().join("notice.sqlite"),
            )
            .env("CK_SQL_EFFECT_PROBE_NONCE", &nonce)
            .env("CK_SQL_EFFECT_PROBE_EXPECT", expected)
            .env("CK_SQL_EFFECT_PROBE_RESULT", &result)
            .stdout(Stdio::from(
                fs::File::create(f.root.join(format!("probe-{expected}.stdout"))).unwrap(),
            ))
            .stderr(Stdio::from(
                fs::File::create(f.root.join(format!("probe-{expected}.stderr"))).unwrap(),
            ))
            .spawn()
            .unwrap(),
    );
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if let Some(exit) = child.0.try_wait().unwrap() {
            eprintln!(
                "SQLite native writer probe pid={} expected={expected} exit={exit}",
                child.0.id()
            );
            assert!(
                exit.success(),
                "child stderr: {}",
                fs::read_to_string(f.root.join(format!("probe-{expected}.stderr"))).unwrap()
            );
            break;
        }
        assert!(Instant::now() < deadline, "bounded native probe timeout");
        std::thread::sleep(Duration::from_millis(10));
    }
    let observed: serde_json::Value = serde_json::from_slice(&fs::read(result).unwrap()).unwrap();
    assert_eq!(observed["pid"], child.0.id());
    assert_eq!(observed["nonce"], nonce);
    assert_eq!(observed["result"], expected);
}
#[test]
#[ignore = "bounded exact entry invoked only by sqlite_native_writer_lock_survives_metadata_and_evidence"]
fn sqlite_process_writer_probe() {
    use std::io::Write;
    let path = PathBuf::from(std::env::var_os("CK_SQL_EFFECT_PROBE_DB").unwrap());
    let nonce = std::env::var("CK_SQL_EFFECT_PROBE_NONCE").unwrap();
    let expected = std::env::var("CK_SQL_EFFECT_PROBE_EXPECT").unwrap();
    assert_eq!(path.file_name().unwrap(), "notice.sqlite");
    assert!(nonce.starts_with("ck-sql-effect-"));
    let c = rusqlite::Connection::open_with_flags(
        &path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )
    .unwrap();
    c.busy_timeout(std::time::Duration::ZERO).unwrap();
    let result = match c.execute_batch("BEGIN IMMEDIATE") {
        Ok(()) => {
            c.execute_batch("ROLLBACK").unwrap();
            "available"
        }
        Err(e) => {
            assert_eq!(
                e.sqlite_error_code(),
                Some(rusqlite::ErrorCode::DatabaseBusy)
            );
            "busy"
        }
    };
    assert_eq!(result, expected);
    let bytes = serde_json::to_vec(
        &serde_json::json!({"pid":std::process::id(),"nonce":nonce,"result":result}),
    )
    .unwrap();
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(std::env::var_os("CK_SQL_EFFECT_PROBE_RESULT").unwrap())
        .unwrap();
    output.write_all(&bytes).unwrap();
}
#[test]
fn sqlite_native_writer_lock_survives_metadata_and_evidence() {
    let f = Fixture::new();
    let mut writer = f.session(Actor::Owner, false);
    let pending = writer
        .prepare(&op("lock-proof", 1, "pending native write"))
        .unwrap();
    // All custody fstat/fstatat and SQLite-managed closes remain safe. Evidence
    // reads the existing raw pin rather than opening/closing the DB again.
    let mut other = f.session(Actor::Reader, true);
    assert_eq!(other.inspect().unwrap().revision, 1);
    drop(other);
    f.evidence("reserved-lock-after-observation");
    probe_writer(&f, "busy");
    pending.rollback().unwrap();
    probe_writer(&f, "available"); // refuses neither all writes nor every process
    assert_eq!(writer.inspect().unwrap().revision, 1);
}
