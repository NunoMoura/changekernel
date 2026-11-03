//! Real post-WAL-commit cuts and explicit close. Test hooks never enter the public API.
use super::control;
use super::custody::WriterCustody;
use super::local::LedgerIdentity;
use super::original::{Original, OriginalOutcome, OriginalReference};
use super::prepared_operation_request::PreparedOperationRequest;
use super::register::{CreationIntent, CreationProgress, Register};
use super::store_error::StoreError;
use crate as api;
use crate::application::change::OperationRequestError;
use crate::application::operation_request::{OperationRequest, CURRENT_PROFILE};
use crate::application::ports::Query;
use crate::kernel::change::{
    Accepted, Access, Attribution, Command, ContentId, ContentKey, ContextVersion, Disposition,
    Effect, Error, Evidence, Finding, Identity, Operation, OperationId,
};
#[path = "../../../tests/sqlite_durable/staging.rs"]
pub(super) mod staging;
#[path = "../../../tests/sqlite_durable/support.rs"]
pub(super) mod support;
use std::ffi::{c_char, c_int, c_void};
use std::fs;
use std::path::{Path, PathBuf};
#[path = "tests/cold_reads.rs"]
mod cold_reads;
#[path = "tests/cuts.rs"]
pub(super) mod cuts;
#[path = "tests/reads.rs"]
mod reads;
#[path = "tests/reads_fixture.rs"]
mod reads_fixture;
#[path = "tests/review_reads.rs"]
mod review_reads;

pub(super) fn provision() -> (
    Original<support::Local>,
    Identity,
    PathBuf,
    OriginalReference,
    support::Local,
    PathBuf,
) {
    let id = support::identity(21);
    let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
    let nonce = control::hex(&super::super::ids::candidate().unwrap());
    let reg = root.join(format!("p33-reg-{nonce}"));
    let path = root.join(format!("p33-original-{nonce}"));
    let local = support::local(&id, &reg, &path, &root);
    let mut register = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &root,
    )
    .unwrap();
    let first = support::start(&local, &id);
    let intent =
        CreationIntent::try_new(register.reference(), id.clone(), path.clone(), first).unwrap();
    let reference = match register.create(&intent, &mut local.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => *reference,
        _ => panic!("inclusion not ready"),
    };
    drop(register);
    let original = Original::open(&reference, local.clone(), &root).unwrap();
    (original, id, path, reference, local, root)
}
struct Cut {
    target: PathBuf,
    saved: PathBuf,
    fired: bool,
    error: Option<std::io::Error>,
}
unsafe extern "C" fn after_commit(
    raw: *mut c_void,
    _: *mut libsqlite3_sys::sqlite3,
    _: *const c_char,
    _: c_int,
) -> c_int {
    // SAFETY: exclusive synchronous test callback; context outlives its installation.
    let cut = unsafe { &mut *raw.cast::<Cut>() };
    cut.fired = true;
    cut.error = (|| {
        use std::os::unix::fs::OpenOptionsExt;
        fs::rename(&cut.target, &cut.saved)?;
        fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&cut.target)?;
        Ok::<_, std::io::Error>(())
    })()
    .err();
    libsqlite3_sys::SQLITE_OK
}
fn post_commit_replacement(suffix: &str) {
    let (mut store, id, path, reference, local, root) = provision();
    let mut cut = Cut {
        target: path.join(format!("ledger.sqlite{suffix}")),
        saved: path.join(format!("preserved{suffix}")),
        fired: false,
        error: None,
    };
    let request = support::grant(&id, 40);
    // SAFETY: live private connection, synchronous callback with stable exclusive context.
    unsafe {
        libsqlite3_sys::sqlite3_wal_hook(
            store.store.connection.as_ref().unwrap().handle(),
            Some(after_commit),
            (&mut cut as *mut Cut).cast(),
        );
    }
    let result = store.submit(&request);
    // SAFETY: remove hook before its context is accessed or dropped.
    unsafe {
        libsqlite3_sys::sqlite3_wal_hook(
            store.store.connection.as_ref().unwrap().handle(),
            None,
            std::ptr::null_mut(),
        );
    }
    assert!(cut.fired);
    assert!(cut.error.is_none());
    assert_eq!(result, Err(OperationRequestError::Indeterminate));
    assert_eq!(store.submit(&request), Err(OperationRequestError::Fenced));
    fs::rename(
        &cut.target,
        path.join(format!("replacement-evidence{suffix}")),
    )
    .unwrap();
    fs::rename(&cut.saved, &cut.target).unwrap();
    drop(store);
    // Fresh validated original reopening independently proves the real transaction committed.
    let mut reopened = Original::open(&reference, local, &root).unwrap();
    assert!(matches!(
        reopened.resolve_original(&request).unwrap(),
        OriginalOutcome::Accepted(Accepted {
            effect: Effect::Grant(_),
            ..
        })
    ));
}
#[test]
fn post_commit_wal_replacement_is_indeterminate_not_nonacceptance() {
    post_commit_replacement("-wal")
}
#[test]
fn post_commit_shm_replacement_is_indeterminate_not_nonacceptance() {
    post_commit_replacement("-shm")
}
#[test]
fn checkpoint_preserves_live_inodes_and_explicit_close_allows_a_normal_restart() {
    use std::os::unix::fs::MetadataExt;
    let (mut store, id, path, reference, local, root) = provision();
    let identities = || {
        ["-wal", "-shm"].map(|s| {
            let m = fs::metadata(path.join(format!("ledger.sqlite{s}"))).unwrap();
            (m.dev(), m.ino())
        })
    };
    let pins = identities();
    store.passive_checkpoint().unwrap();
    assert_eq!(identities(), pins);
    let request = support::grant(&id, 41);
    store.submit(&request).unwrap();
    assert_eq!(identities(), pins);
    assert!(matches!(
        Original::open(&reference, local.clone(), &root),
        Err(StoreError::Busy)
    )); // A live writer still excludes the exact same original.
    store.close().unwrap();
    assert_eq!(identities(), pins); // Automatic cleanup is NOT selected.
                                    // Zero-wait lease acquisition does not promise immediate availability at this
                                    // scheduling instant. Explicit caller retries only Busy, never another original,
                                    // a new operation/ID, or any other error. Persistent Busy must fail the deadline.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
    let mut reopened = loop {
        assert!(
            std::time::Instant::now() < deadline,
            "same-original reopen stayed Busy after close"
        );
        match Original::open(&reference, local.clone(), &root) {
            Ok(original) => break original,
            Err(StoreError::Busy) => std::thread::sleep(std::time::Duration::from_millis(5)),
            Err(error) => panic!("same-original reopen failed without Busy: {error:?}"),
        }
    };
    assert!(matches!(
        reopened.resolve_original(&request).unwrap(),
        OriginalOutcome::Accepted(_)
    ));
}

#[test]
fn final_callback_head_change_blocks_status_retry_and_absence() {
    for lookup in ["read", "accepted", "negative"] {
        let (mut original, id, _, _, local, _) = provision();
        let request = support::grant(&id, 103);
        if lookup != "negative" {
            original.submit(&request).unwrap();
        }
        // SAFETY: test-only handle of this same private connection. No statement/SQLite call
        // is active when LocalGuard::disclose runs. The synchronous callback injects a native
        // head disagreement; no second DB/SHM descriptor or production mutation route exists.
        let handle = unsafe { original.store.connection.as_ref().unwrap().handle() } as usize;
        local.0.lock().unwrap().disclose_hook = Some(Box::new(move |_| {
            let sql = std::ffi::CString::new("UPDATE head SET revision=revision+1").unwrap();
            // SAFETY: same live connection on its owning test thread, no concurrent SQLite use.
            let code = unsafe {
                libsqlite3_sys::sqlite3_exec(
                    handle as *mut libsqlite3_sys::sqlite3,
                    sql.as_ptr(),
                    None,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            };
            assert_eq!(code, libsqlite3_sys::SQLITE_OK);
        }));
        let refused = if lookup == "read" {
            original.read(Query::Status, Access::Owner).is_err()
        } else {
            original.resolve_original(&request).is_err()
        };
        assert!(refused);
        assert!(matches!(
            original.passive_checkpoint(),
            Err(StoreError::Fenced)
        ));
    }
}
fn noncanonical_request(frame: &[u8]) -> Vec<u8> {
    let mut out = frame.to_vec();
    assert_eq!(&out[8..14], &[8, 3, 16, 3, 24, 3]);
    out[8..14].copy_from_slice(&[24, 3, 16, 3, 8, 3]);
    assert_eq!(
        PreparedOperationRequest::from_frame(&out)
            .unwrap()
            .operation_request(),
        PreparedOperationRequest::from_frame(frame)
            .unwrap()
            .operation_request()
    );
    out
}
#[test]
fn first_raw_bytes_are_not_replaced_by_legal_typed_equivalent_retries() {
    let (mut original, id, _, _, _, _) = provision();
    let canonical = support::grant(&id, 104);
    let first =
        PreparedOperationRequest::from_frame(&noncanonical_request(canonical.frame())).unwrap();
    let accepted = original.submit(&first).unwrap();
    assert_eq!(original.submit(&canonical).unwrap(), accepted);
    let c = original.store.connection.as_ref().unwrap();
    for table in ["requests", "request_integrity"] {
        let raw: Vec<u8> = c
            .query_row(
                &format!("SELECT frame FROM {table} WHERE operation=?1"),
                [canonical
                    .operation_request()
                    .operation
                    .id
                    .as_bytes()
                    .as_slice()],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(raw, first.frame());
    }
}
#[test]
fn receipt_first_start_bytes_detect_a_coherently_changed_request_pair() {
    let (original, id, _, reference, local, root) = provision();
    let initial = support::start(&local, &id);
    let changed = noncanonical_request(initial.frame());
    let c = original.store.connection.as_ref().unwrap();
    for table in ["requests", "request_integrity"] {
        c.execute(
            &format!("UPDATE {table} SET frame=?1 WHERE operation=?2"),
            rusqlite::params![
                &changed,
                initial
                    .operation_request()
                    .operation
                    .id
                    .as_bytes()
                    .as_slice()
            ],
        )
        .unwrap();
    }
    drop(original);
    assert!(matches!(
        Original::open(&reference, local, &root),
        Err(StoreError::Corrupt)
    ));
}

#[test]
fn prepared_new_provisioning_blocks_unexplained_wal_and_shm_before_sqlite() {
    use std::io::Write;
    use std::os::unix::fs::OpenOptionsExt;
    for name in ["ledger.sqlite-wal", "ledger.sqlite-shm"] {
        let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
        let id = support::identity(25);
        let nonce = control::hex(&crate::adapters::ids::candidate().unwrap());
        let path = root.join(format!("p33-unexplained-{nonce}"));
        let local = support::local(&id, &path, &root.join("unused-original"), &root);
        control::observe_publication_for_test(path.clone(), 1, move |custody| {
            // No SQLite connection exists. This is an unexplained pre-provisioning artifact,
            // not an application descriptor to live SHM.
            let mut file = fs::OpenOptions::new()
                .create_new(true)
                .write(true)
                .mode(0o600)
                .open(custody.directory().join(name))
                .unwrap();
            file.write_all(b"preserve unexpected journal").unwrap();
            file.sync_all().unwrap();
        });
        assert!(matches!(
            Register::bootstrap_new(
                &path,
                LedgerIdentity {
                    owner: id.owner,
                    ledger: id.ledger
                },
                local,
                &root
            ),
            Err(StoreError::BlockedOrphan)
        ));
        assert_eq!(fs::metadata(path.join("ledger.sqlite")).unwrap().len(), 0);
        assert_eq!(
            fs::read(path.join(name)).unwrap(),
            b"preserve unexpected journal"
        );
        let custody = WriterCustody::open(&path).unwrap();
        let witness = control::Witness::read(&custody).unwrap();
        assert_eq!(witness.pending.unwrap().stage, control::Stage::Prepared);
    }
}
#[test]
fn actual_commit_and_final_publication_keep_the_current_guard_until_revocation_can_run() {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};
    let (mut original, id, path, _, local, _) = provision();
    let observed = Arc::new(AtomicBool::new(false));
    let marked = observed.clone();
    let thread = Arc::new(Mutex::new(None));
    let slot = thread.clone();
    let boundary = local.clone();
    control::observe_publication_for_test(path, 3, move |_| {
        // Third publication is the stable after-cut: real COMMIT has already completed.
        assert!(matches!(
            boundary.0.try_lock(),
            Err(std::sync::TryLockError::WouldBlock)
        ));
        marked.store(true, Ordering::SeqCst);
        *slot.lock().unwrap() = Some(std::thread::spawn(move || {
            let mut inputs = boundary.0.lock().unwrap();
            inputs.disclosure = false;
            inputs.context.version = ContextVersion::from_bytes([31; 16]).unwrap();
        }));
    });
    let request = support::grant(&id, 111);
    let accepted = original.submit(&request).unwrap();
    assert!(observed.load(Ordering::SeqCst));
    thread.lock().unwrap().take().unwrap().join().unwrap();
    assert!(matches!(
        original.resolve_original(&request),
        Err(StoreError::Refused(Error::Denied))
    ));
    local.0.lock().unwrap().disclosure = true;
    assert_eq!(
        original.resolve_original(&request).unwrap(),
        OriginalOutcome::Accepted(accepted)
    );
}
#[test]
fn partial_passive_checkpoint_and_failed_clean_publication_never_certify_clean() {
    let (mut original, id, path, reference, local, root) = provision();
    // Deliberate external reader is a defensive failure case, not the supported custody
    // topology. Use only SQLite-owned descriptors, never an extra application SHM fd.
    let reader = rusqlite::Connection::open_with_flags(
        path.join("ledger.sqlite"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .unwrap();
    reader
        .set_db_config(
            rusqlite::config::DbConfig::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE,
            true,
        )
        .unwrap();
    reader.execute_batch("BEGIN").unwrap();
    let _: i64 = reader
        .query_row("SELECT count(*) FROM records", [], |r| r.get(0))
        .unwrap();
    let request = support::grant(&id, 113);
    let accepted = original.submit(&request).unwrap();
    let (busy, log, done) = original.passive_checkpoint().unwrap();
    assert_eq!(busy, 0);
    assert!(done < log);
    assert!(matches!(original.close(), Err(StoreError::Indeterminate)));
    reader.execute_batch("ROLLBACK").unwrap();
    reader.close().unwrap();
    let custody = WriterCustody::open(&path).unwrap();
    assert_eq!(
        control::Witness::read(&custody).unwrap().phase,
        control::Phase::Closing
    );
    drop(custody);
    let mut reopened = Original::open(&reference, local, &root).unwrap();
    assert_eq!(
        reopened.resolve_original(&request).unwrap(),
        OriginalOutcome::Accepted(accepted)
    );
    drop(reopened);
    let (original, _, path, reference, local, root) = provision();
    control::observe_publication_for_test(path.clone(), 2, |custody| {
        for entry in fs::read_dir(custody.directory()).unwrap() {
            let entry = entry.unwrap();
            if entry
                .file_name()
                .to_string_lossy()
                .starts_with(".custody-next-")
            {
                fs::remove_file(entry.path()).unwrap();
            }
        }
    });
    assert!(original.close().is_err());
    let custody = WriterCustody::open(&path).unwrap();
    assert_eq!(
        control::Witness::read(&custody).unwrap().phase,
        control::Phase::Closing
    );
    drop(custody);
    assert!(Original::open(&reference, local, &root).is_ok());
}

#[test]
fn complete_valid_byte_copy_with_permitted_location_cannot_activate_the_original_binding() {
    use std::os::unix::fs::{DirBuilderExt, MetadataExt};
    let (original, id, path, reference, local, root) = provision();
    drop(original);
    let source_before = support::native_snapshot(&path);
    let copy = root.join(format!(
        "p33-complete-copy-{}",
        control::hex(&crate::adapters::ids::candidate().unwrap())
    ));
    fs::DirBuilder::new().mode(0o700).create(&copy).unwrap();
    // Quiescent original: include every valid byte/control, not an intentionally incomplete
    // copy. No extra descriptors to a live source's DB/WAL/SHM are opened.
    for entry in fs::read_dir(&path).unwrap() {
        let entry = entry.unwrap();
        fs::copy(entry.path(), copy.join(entry.file_name())).unwrap();
    }
    let copy_before = support::native_snapshot(&copy);
    for name in source_before.keys() {
        if name != std::ffi::OsStr::new(".") {
            assert_eq!(
                fs::read(path.join(name)).unwrap(),
                fs::read(copy.join(name)).unwrap()
            );
            assert_ne!(
                fs::metadata(path.join(name)).unwrap().ino(),
                fs::metadata(copy.join(name)).unwrap().ino()
            );
        }
    }
    local
        .0
        .lock()
        .unwrap()
        .custody
        .insert(support::Permit::Open(id, copy.clone()));
    // Private unit fixture mutation only; public references remain immutable. Every
    // authority/binding field is unchanged, and the location is explicitly permitted.
    let mut copied = reference.clone();
    copied.path = copy.clone();
    assert!(matches!(
        Original::open(&copied, local, &root),
        Err(StoreError::Custody)
    ));
    assert_eq!(support::native_snapshot(&copy), copy_before);
    assert_eq!(support::native_snapshot(&path), source_before);
}

#[test]
fn concrete_content_bytes_or_source_fact_race_before_final_guard_cannot_append_or_establish() {
    use std::collections::BTreeSet;
    for race in ["bytes", "claim"] {
        let (mut original, id, _, _, local, _) = provision();
        let key = ContentKey {
            establishing: id.change_key(),
            id: ContentId::from_bytes([122; 16]).unwrap(),
        };
        support::source(&local, &key, b"original observed material");
        let first = local.0.lock().unwrap().sources[&key].clone();
        let changed_key = key.clone();
        let agent = id.agent.clone();
        let request = PreparedOperationRequest::from_operation_request(&OperationRequest {
            profile: CURRENT_PROFILE,
            target: id.change_key(),
            actor: id.owner_actor.clone(),
            represented_owner: id.owner.clone(),
            operation: Operation {
                id: OperationId::from_bytes([123; 16]).unwrap(),
                command: Command::Finding {
                    finding: Finding {
                        agreement: None,
                        claim: key.clone(),
                        evidence: vec![Evidence {
                            source: id.owner_actor.clone(),
                            content: key.clone(),
                            limitations: key.clone(),
                        }],
                        disposition: Disposition::Unknown,
                    },
                    access: Access::Owner,
                },
                fresh: vec![],
                first_retention: BTreeSet::from([key.clone()]),
            },
        })
        .unwrap();
        let counts = |original: &Original<support::Local>| {
            ["records", "materials", "establishments"].map(|table| {
                original
                    .store
                    .connection
                    .as_ref()
                    .unwrap()
                    .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| {
                        r.get::<_, i64>(0)
                    })
                    .unwrap()
            })
        };
        let before = counts(&original);
        let witness = original.store.witness.clone();
        local.0.lock().unwrap().after_intake_hook = Some(Box::new(move |inputs| {
            let observed = inputs.sources.get_mut(&changed_key).unwrap();
            if race == "bytes" {
                observed.bytes = b"changed observed material".to_vec();
            } else {
                observed.source_claim.attribution = Attribution::Actor(agent);
            }
        }));
        assert_eq!(
            original.submit(&request),
            Err(OperationRequestError::Refused(Error::Conflict)),
            "{race} was not revalidated"
        );
        assert_eq!(counts(&original), before);
        assert_eq!(original.store.witness, witness);
        assert_eq!(
            original.resolve_original(&request).unwrap(),
            OriginalOutcome::NotAccepted
        );
        local.0.lock().unwrap().sources.insert(key, first);
        let accepted = original.submit(&request).unwrap();
        assert_eq!(counts(&original), before.map(|n| n + 1));
        assert_eq!(
            original.resolve_original(&request).unwrap(),
            OriginalOutcome::Accepted(accepted)
        );
    }
}
