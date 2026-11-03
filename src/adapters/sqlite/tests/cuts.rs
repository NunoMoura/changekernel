//! Separate-process crash cuts over real SQLite transactions. No production hook API.
use super::{staging, support};
use crate::adapters::sqlite::control::{self, Mutation};
use crate::adapters::sqlite::custody::WriterCustody;
use crate::adapters::sqlite::local::LedgerIdentity;
use crate::adapters::sqlite::original::{Original, OriginalOutcome, OriginalReference};
use crate::adapters::sqlite::register::{
    CreationIntent, CreationProgress, Register, RegisterSelection,
};
use crate::adapters::sqlite::store_error::{StoreError, StoreResult};
use crate::kernel::change::OperationId;
use rusqlite::Connection;
use std::ffi::{c_char, c_int, c_void};
use std::fs;
use std::io::{BufRead, Write};
use std::os::unix::fs::DirBuilderExt;
use std::path::{Path, PathBuf};
pub(in crate::adapters::sqlite) fn pause(label: &str) {
    if std::env::var("CK_P33_CHILD_CUT").ok().as_deref() == Some(label) {
        println!("CK_P33_CUT_REACHED");
        std::io::stdout().flush().unwrap();
        loop {
            std::thread::park();
        }
    }
}
unsafe extern "C" fn wal_cut(
    _: *mut c_void,
    _: *mut libsqlite3_sys::sqlite3,
    _: *const c_char,
    _: c_int,
) -> c_int {
    pause("wal-commit");
    libsqlite3_sys::SQLITE_OK
}
fn private_file(path: &Path, bytes: &[u8]) {
    use std::os::unix::fs::OpenOptionsExt;
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .unwrap();
    f.write_all(bytes).unwrap();
    f.sync_all().unwrap();
}
#[test]
fn separate_process_commit_cuts_preserve_honest_outcomes() {
    if let Ok(path) = std::env::var("CK_P33_CHILD_REFERENCE") {
        let reference = OriginalReference::from_frame(&fs::read(path).unwrap()).unwrap();
        let id = reference.identity().clone();
        let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
        let local = support::local(
            &id,
            &root.join("not-used-by-original"),
            reference.location(),
            &root,
        );
        let _ = support::start(&local, &id);
        let mut original = Original::open(&reference, local, &root).unwrap();
        if std::env::var("CK_P33_CHILD_CUT").unwrap() == "wal-commit" {
            // SAFETY: private live test connection, synchronous callback, no context pointer.
            unsafe {
                libsqlite3_sys::sqlite3_wal_hook(
                    original.store.connection.as_ref().unwrap().handle(),
                    Some(wal_cut),
                    std::ptr::null_mut(),
                );
            }
        }
        let _ = original.submit(&support::grant(&id, 61));
        panic!("selected cut did not stop child");
    }
    for cut in [
        "before-prepare",
        "prepared",
        "possible",
        "wal-commit",
        "after-commit",
        "after-final",
        "pending-raw-mismatch",
    ] {
        let (original, id, path, reference, local, root) = super::provision();
        drop(original);
        let request = support::grant(&id, 61);
        let reference_path = path.join("caller-retained-reference");
        private_file(&reference_path, &reference.to_frame().unwrap());
        private_file(&path.join("caller-retained-request"), request.frame());
        let mut child=std::process::Command::new(std::env::current_exe().unwrap())
            .args(["--exact","adapters::sqlite::tests::cuts::separate_process_commit_cuts_preserve_honest_outcomes","--nocapture","--test-threads=1"])
            .env("CK_P33_CHILD_REFERENCE",&reference_path).env("CK_P33_CHILD_CUT",if cut=="pending-raw-mismatch"{"after-commit"}else{cut})
            .stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::inherit()).spawn().unwrap();
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        let reader = std::thread::spawn(move || {
            let mut output = Vec::new();
            for line in std::io::BufReader::new(stdout).lines() {
                let line = line.unwrap();
                let done = line.contains("CK_P33_CUT_REACHED");
                output.extend_from_slice(line.as_bytes());
                output.push(b'\n');
                if done {
                    let _ = tx.send(true);
                    break;
                }
            }
            output
        });
        let reached = rx.recv_timeout(std::time::Duration::from_secs(30)).is_ok();
        let _ = child.kill();
        let status = child.wait().unwrap();
        private_file(
            &path.join(format!("child-{cut}.log")),
            &reader.join().unwrap(),
        );
        assert!(reached, "child failed before {cut}: {status}");
        if cut == "pending-raw-mismatch" {
            let changed = super::noncanonical_request(request.frame());
            let c = raw_writer(&path);
            for table in ["requests", "request_integrity"] {
                c.execute(
                    &format!("UPDATE {table} SET frame=?1 WHERE operation=?2"),
                    rusqlite::params![
                        &changed,
                        request
                            .operation_request()
                            .operation
                            .id
                            .as_bytes()
                            .as_slice()
                    ],
                )
                .unwrap();
            }
            c.close().unwrap();
            assert!(matches!(
                Original::open(&reference, local, &root),
                Err(StoreError::Corrupt)
            ));
            continue;
        }
        let reopened = Original::open(&reference, local, &root);
        if cut == "possible" {
            assert!(matches!(reopened, Err(StoreError::Indeterminate)));
            continue;
        }
        let mut reopened = reopened.unwrap();
        let outcome = reopened.resolve_original(&request).unwrap();
        if matches!(cut, "before-prepare" | "prepared") {
            assert_eq!(outcome, OriginalOutcome::NotAccepted);
            assert_eq!(reopened.store.witness.cut.count, 1);
        } else {
            let OriginalOutcome::Accepted(original) = outcome else {
                panic!("committed request lost at {cut}")
            };
            assert_eq!(reopened.submit(&request).unwrap(), original);
            assert_eq!(reopened.store.witness.cut.count, 2);
        }
    }
}

pub(in crate::adapters::sqlite) fn mutation_cut(mutation: Mutation, label: &str) {
    pause(label);
    let prefix = match mutation {
        Mutation::Provision => "provision",
        Mutation::Append => "append",
        Mutation::Reserve => "reserve",
        Mutation::Bind => "bind",
        Mutation::Include => "include",
        Mutation::Activate => "activate",
    };
    pause(&format!("{prefix}-{label}"));
}
fn interrupt(mut command: std::process::Command, log: &Path) {
    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let (tx, rx) = std::sync::mpsc::channel();
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        for line in std::io::BufReader::new(stdout).lines() {
            let line = line.unwrap();
            let stop = line.contains("CK_P33_CUT_REACHED");
            bytes.extend_from_slice(line.as_bytes());
            bytes.push(b'\n');
            if stop {
                let _ = tx.send(());
                break;
            }
        }
        bytes
    });
    let reached = rx.recv_timeout(std::time::Duration::from_secs(30)).is_ok();
    let _ = child.kill();
    let status = child.wait().unwrap();
    private_file(log, &reader.join().unwrap());
    assert!(reached, "child failed before cut: {status}");
}
fn raw_writer(path: &Path) -> Connection {
    let c = Connection::open_with_flags(
        path.join("ledger.sqlite"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )
    .unwrap();
    c.set_db_config(
        rusqlite::config::DbConfig::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE,
        true,
    )
    .unwrap();
    c.pragma_update(None, "wal_autocheckpoint", 0).unwrap();
    c
}
#[test]
fn creation_initialization_and_allocation_loss_cuts_reconcile_only_the_same_objects() {
    let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
    let id = support::identity(22);
    if let Ok(reg) = std::env::var("CK_P33_CREATION_REG") {
        let reg = PathBuf::from(reg);
        let original = PathBuf::from(std::env::var("CK_P33_CREATION_ORIGINAL").unwrap());
        let local = support::local(&id, &reg, &original, &root);
        let _ = support::start(&local, &id);
        if std::env::var("CK_P33_CREATION_CASE")
            .unwrap()
            .starts_with("provision")
        {
            let _ = Register::bootstrap_new(
                &reg,
                LedgerIdentity {
                    owner: id.owner.clone(),
                    ledger: id.ledger.clone(),
                },
                local,
                &root,
            );
        } else {
            let selection = RegisterSelection {
                location: reg,
                ledger: LedgerIdentity {
                    owner: id.owner.clone(),
                    ledger: id.ledger.clone(),
                },
            };
            let mut registry = Register::open(&selection, local.clone(), &root).unwrap();
            let intent = CreationIntent::from_frame(
                &fs::read(std::env::var("CK_P33_CREATION_INTENT").unwrap()).unwrap(),
            )
            .unwrap();
            let _ = registry.reconcile(&intent, &mut local.clone());
        }
        panic!("creation cut not reached");
    }
    for case in [
        "provision",
        "provision-magic",
        "provision-subject",
        "reserve",
        "reserve-raw",
        "bind",
        "bind-raw",
        "allocated-loss",
        "allocated-wal",
        "allocated-shm",
        "allocated-shape-canonical",
        "allocated-shape-both",
        "original-provision",
        "original-provision-subject",
        "original-provision-allocation",
        "original-provision-manifest-phase",
        "original-provision-manifest-epoch",
        "original-provision-manifest-journal",
        "original-provision-manifest-generation",
        "start-possible",
        "start-after-commit",
        "include",
        "activate",
    ] {
        let nonce = control::hex(&crate::adapters::ids::candidate().unwrap());
        let reg = root.join(format!("p33-creation-reg-{nonce}"));
        let path = root.join(format!("p33-creation-original-{nonce}"));
        let caller = root.join(format!("p33-caller-{nonce}"));
        fs::DirBuilder::new().mode(0o700).create(&caller).unwrap();
        let local = support::local(&id, &reg, &path, &root);
        let selection = RegisterSelection {
            location: reg.clone(),
            ledger: LedgerIdentity {
                owner: id.owner.clone(),
                ledger: id.ledger.clone(),
            },
        };
        let intent = if case.starts_with("provision") {
            None
        } else {
            let registry =
                Register::bootstrap_new(&reg, selection.ledger.clone(), local.clone(), &root)
                    .unwrap();
            let intent = CreationIntent::try_new(
                registry.reference(),
                id.clone(),
                path.clone(),
                support::start(&local, &id),
            )
            .unwrap();
            private_file(&caller.join("intent"), &intent.to_frame().unwrap());
            drop(registry);
            Some(intent)
        };
        let cut = if case.starts_with("provision") {
            "provision-after-commit"
        } else if case.starts_with("reserve") {
            "reserve-after-commit"
        } else if case.starts_with("bind") {
            "bind-after-commit"
        } else if case.starts_with("allocated-") {
            "allocated-before-bind"
        } else if case.starts_with("original-provision") {
            "provision-after-commit"
        } else if case == "start-possible" {
            "append-possible"
        } else if case == "start-after-commit" {
            "append-after-commit"
        } else if case == "include" {
            "include-after-commit"
        } else {
            "activate-after-commit"
        };
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        command.args(["--exact","adapters::sqlite::tests::cuts::creation_initialization_and_allocation_loss_cuts_reconcile_only_the_same_objects","--nocapture","--test-threads=1"]).env("CK_P33_CREATION_REG",&reg).env("CK_P33_CREATION_ORIGINAL",&path).env("CK_P33_CREATION_INTENT",caller.join("intent")).env("CK_P33_CREATION_CASE",case).env("CK_P33_CHILD_CUT",cut);
        interrupt(command, &caller.join(format!("{case}.log")));
        if case == "provision-magic" || case == "provision-subject" {
            let custody = WriterCustody::open(&reg).unwrap();
            for name in ["allocation.ctrl", "custody.ctrl"] {
                control::Witness::rewrite_pending_for_test(&custody, name, |raw| {
                    if case == "provision-magic" {
                        raw[0] ^= 1
                    } else {
                        let n = raw.len();
                        raw[n - 16..].fill(99)
                    }
                });
            }
            drop(custody);
            assert!(Register::open(&selection, local, &root).is_err());
            continue;
        }
        if case.starts_with("allocated-shape-") || case.starts_with("original-provision-manifest-")
        {
            let custody = WriterCustody::open(&path).unwrap();
            let names = if case == "allocated-shape-both" {
                vec!["allocation.ctrl", "custody.ctrl"]
            } else if case == "allocated-shape-canonical" {
                vec!["custody.ctrl"]
            } else {
                vec!["allocation.ctrl"]
            };
            for name in names {
                control::Witness::rewrite_for_test(&custody, name, |w| {
                    if case.starts_with("allocated-shape-") {
                        let after = &mut w.pending.as_mut().unwrap().after;
                        after.count = 1;
                        after.last = Some(OperationId::from_bytes([121; 16]).unwrap());
                    } else if case.ends_with("phase") {
                        w.phase = control::Phase::PreparingOpen
                    } else if case.ends_with("epoch") {
                        w.epoch = 1
                    } else if case.ends_with("journal") {
                        w.journals = [Some((1, 1)), None]
                    } else {
                        w.generation = 2;
                        w.parent = 1;
                    }
                });
            }
            drop(custody);
            let before = support::native_snapshot(&path);
            let mut registry = Register::open(&selection, local.clone(), &root).unwrap();
            assert!(
                registry
                    .reconcile(intent.as_ref().unwrap(), &mut local.clone())
                    .is_err(),
                "{case} accepted malformed initialization control"
            );
            assert_eq!(
                support::native_snapshot(&path),
                before,
                "{case} mutated source"
            );
            continue;
        }
        if case == "original-provision-subject" {
            let custody = WriterCustody::open(&path).unwrap();
            for name in ["allocation.ctrl", "custody.ctrl"] {
                control::Witness::rewrite_pending_for_test(&custody, name, |raw| {
                    let length = u32::from_be_bytes(raw[16..20].try_into().unwrap()) as usize;
                    let agent = 164 + length;
                    raw[agent..agent + 16].fill(99);
                });
            }
            drop(custody);
            let mut registry = Register::open(&selection, local.clone(), &root).unwrap();
            assert!(matches!(
                registry.reconcile(intent.as_ref().unwrap(), &mut local.clone()),
                Err(StoreError::Corrupt)
            ));
            continue;
        }
        if case == "original-provision-allocation" {
            let custody = WriterCustody::open(&path).unwrap();
            control::Witness::rewrite_pending_for_test(&custody, "custody.ctrl", |raw| {
                let incoming = intent.as_ref().unwrap();
                let alternate = super::noncanonical_request(incoming.start().frame());
                let offset = raw.len() - alternate.len();
                raw[offset..].copy_from_slice(&alternate);
                assert_eq!(
                    CreationIntent::from_frame(raw)
                        .unwrap()
                        .start()
                        .operation_request(),
                    incoming.start().operation_request()
                );
            });
            drop(custody);
            let before = support::native_snapshot(&path);
            let mut registry = Register::open(&selection, local.clone(), &root).unwrap();
            assert!(matches!(
                registry.reconcile(intent.as_ref().unwrap(), &mut local.clone()),
                Err(StoreError::Corrupt)
            ));
            assert_eq!(support::native_snapshot(&path), before);
            continue;
        }
        if case.ends_with("-raw") {
            let original = intent.as_ref().unwrap();
            let mut raw = original.to_frame().unwrap();
            let alternate = super::noncanonical_request(original.start().frame());
            let offset = raw.len() - alternate.len();
            raw[offset..].copy_from_slice(&alternate);
            assert_eq!(
                CreationIntent::from_frame(&raw)
                    .unwrap()
                    .start()
                    .operation_request(),
                original.start().operation_request()
            );
            let c = raw_writer(&reg);
            for table in ["entries", "intent_integrity"] {
                c.execute(
                    &format!("UPDATE {table} SET intent=?1 WHERE change=?2"),
                    rusqlite::params![&raw, id.change.as_bytes().as_slice()],
                )
                .unwrap();
            }
            c.close().unwrap();
            assert!(matches!(
                Register::open(&selection, local, &root),
                Err(StoreError::Corrupt)
            ));
            continue;
        }
        let mut registry = Register::open(&selection, local.clone(), &root).unwrap();
        if case == "provision" {
            assert_eq!(registry.reference().selection(), &selection);
            continue;
        }
        let intent = intent.unwrap();
        if case == "start-possible" {
            let before = support::native_snapshot(&path);
            for _ in 0..2 {
                assert!(matches!(
                    registry.reconcile(&intent, &mut local.clone()),
                    Err(StoreError::Indeterminate)
                ));
                assert_eq!(support::native_snapshot(&path), before);
            }
            continue;
        }
        if case == "reserve" {
            assert!(!path.exists());
            assert!(matches!(
                registry.reconcile(&intent, &mut local.clone()),
                Err(StoreError::BlockedOrphan)
            ));
            assert!(!path.exists());
            continue;
        }
        if case == "allocated-wal" || case == "allocated-shm" {
            let name = if case == "allocated-wal" {
                "ledger.sqlite-wal"
            } else {
                "ledger.sqlite-shm"
            };
            private_file(&path.join(name), b"preserved unexplained sidecar");
            let ctrl = fs::read(path.join("custody.ctrl")).unwrap();
            let before = support::native_snapshot(&path);
            assert!(matches!(
                registry.reconcile(&intent, &mut local.clone()),
                Err(StoreError::BlockedOrphan)
            ));
            assert_eq!(
                fs::read(path.join(name)).unwrap(),
                b"preserved unexplained sidecar"
            );
            assert_eq!(fs::read(path.join("custody.ctrl")).unwrap(), ctrl);
            assert_eq!(support::native_snapshot(&path), before);
            assert_eq!(fs::metadata(path.join("ledger.sqlite")).unwrap().len(), 0);
            continue;
        }
        if case == "allocated-loss" {
            let saved = path.with_extension("preserved-allocation");
            fs::rename(&path, &saved).unwrap();
            assert!(matches!(
                registry.reconcile(&intent, &mut local.clone()),
                Err(StoreError::BlockedOrphan)
            ));
            assert!(!path.exists());
            fs::rename(saved, &path).unwrap();
        }
        let result = registry.reconcile(&intent, &mut local.clone()).unwrap();
        assert!(
            matches!(result, CreationProgress::Ready { .. }),
            "{case} did not recover"
        );
        if case == "start-after-commit" {
            let CreationProgress::Ready { reference, start } = result else {
                unreachable!()
            };
            let mut original = Original::open(&reference, local.clone(), &root).unwrap();
            assert_eq!(
                original.resolve_original(intent.start()).unwrap(),
                OriginalOutcome::Accepted(start)
            );
            for table in ["records", "materials", "establishments"] {
                let count: i64 = original
                    .store
                    .connection
                    .as_ref()
                    .unwrap()
                    .query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))
                    .unwrap();
                assert_eq!(count, 1, "initial Start duplicated {table}");
            }
        }
    }
}

thread_local! {static CLOSE_FAILURE:std::cell::RefCell<Option<&'static str>>=const{std::cell::RefCell::new(None)};}
pub(in crate::adapters::sqlite) fn close_boundary(step: &'static str) -> StoreResult<()> {
    pause(step);
    // Narrow operation-boundary refusal injection; this is not a real filesystem EIO
    // or power-loss simulation. Production close/sync calls remain unchanged.
    let fail = CLOSE_FAILURE.with(|slot| {
        let mut s = slot.borrow_mut();
        if *s == Some(step) {
            s.take();
            true
        } else {
            false
        }
    });
    if fail {
        Err(std::io::Error::from_raw_os_error(5).into())
    } else {
        Ok(())
    }
}
#[test]
fn close_refusals_and_interrupted_closing_never_guess_a_clean_main_cut() {
    let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
    if let Ok(frame) = std::env::var("CK_P33_CLOSE_REFERENCE") {
        let reference = OriginalReference::from_frame(&fs::read(frame).unwrap()).unwrap();
        let id = reference.identity();
        let local = support::local(
            id,
            &root.join("unused-close-register"),
            reference.location(),
            &root,
        );
        let original = Original::open(&reference, local, &root).unwrap();
        let _ = original.close();
        panic!("close cut not reached");
    }
    for cut in [
        "close-closing",
        "close-checkpointed",
        "close-closed",
        "close-synced",
    ] {
        let (mut original, id, path, reference, local, root) = super::provision();
        let request = support::grant(&id, 112);
        let accepted = original.submit(&request).unwrap();
        drop(original);
        let caller = root.join(format!(
            "p33-close-caller-{}",
            control::hex(&crate::adapters::ids::candidate().unwrap())
        ));
        fs::DirBuilder::new().mode(0o700).create(&caller).unwrap();
        private_file(&caller.join("reference"), &reference.to_frame().unwrap());
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        command.args(["--exact","adapters::sqlite::tests::cuts::close_refusals_and_interrupted_closing_never_guess_a_clean_main_cut","--nocapture","--test-threads=1"]).env("CK_P33_CLOSE_REFERENCE",caller.join("reference")).env("CK_P33_CHILD_CUT",cut);
        interrupt(command, &caller.join("child.log"));
        let custody = WriterCustody::open(&path).unwrap();
        assert_eq!(
            control::Witness::read(&custody).unwrap().phase,
            control::Phase::Closing
        );
        drop(custody);
        for name in ["ledger.sqlite-wal", "ledger.sqlite-shm"] {
            if path.join(name).exists() {
                fs::rename(path.join(name), caller.join(name)).unwrap();
            }
        }
        if cut == "close-closing" {
            let before = support::native_snapshot(&path);
            assert!(Original::open(&reference, local.clone(), &root).is_err());
            assert_eq!(support::native_snapshot(&path), before);
            for name in ["ledger.sqlite-wal", "ledger.sqlite-shm"] {
                if caller.join(name).exists() {
                    fs::rename(caller.join(name), path.join(name)).unwrap();
                }
            }
        }
        let mut reopened = Original::open(&reference, local, &root).unwrap();
        assert_eq!(
            reopened.resolve_original(&request).unwrap(),
            OriginalOutcome::Accepted(accepted)
        );
    }
    for step in ["close-checkpointed", "close-closed"] {
        let (original, _, path, reference, local, root) = super::provision();
        CLOSE_FAILURE.with(|slot| *slot.borrow_mut() = Some(step));
        assert!(original.close().is_err());
        let custody = WriterCustody::open(&path).unwrap();
        assert_eq!(
            control::Witness::read(&custody).unwrap().phase,
            control::Phase::Closing
        );
        drop(custody);
        assert!(Original::open(&reference, local, &root).is_ok());
    }
}
