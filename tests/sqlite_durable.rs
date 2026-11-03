//! Real external Linux/Btrfs behaviors, not storage/authentication qualification.
use changekernel as api;
#[path = "sqlite_durable/creation.rs"]
mod creation;
#[path = "sqlite_durable/guards.rs"]
mod guards;
#[path = "sqlite_durable/independence.rs"]
mod independence;
#[path = "sqlite_durable/integrity.rs"]
mod integrity;
#[path = "sqlite_durable/recovery.rs"]
mod recovery;
#[path = "sqlite_durable/staging.rs"]
mod staging;
#[path = "sqlite_durable/support.rs"]
mod support;
use api::adapters::ids;
use api::adapters::sqlite::{
    CreationIntent, CreationProgress, LedgerIdentity, Original, OriginalReference, Register,
    StoreError, WriterCustody,
};
use api::unqualified_change::{Access, Error, GrantId, GrantUse, Identity, Query};
use std::fs;
use std::os::unix::fs::{self as unix_fs, MetadataExt, PermissionsExt};
use std::path::{Path, PathBuf};
static CHILD_PROCESS_SERIAL: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn root() -> PathBuf {
    staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE")))
        .expect("required absolute external Linux/Btrfs fixture stage")
}
fn directory(label: &str) -> PathBuf {
    let nonce: String = ids::candidate()
        .unwrap()
        .iter()
        .map(|v| format!("{v:02x}"))
        .collect();
    root().join(format!("p33-{label}-{nonce}"))
}
fn included(
    label: &str,
) -> (
    Original<support::Local>,
    Identity,
    OriginalReference,
    support::Local,
    PathBuf,
) {
    let id = support::identity(31);
    let reg = directory(&format!("{label}-reg"));
    let path = directory(label);
    let verify = root();
    let local = support::local(&id, &reg, &path, &verify);
    let mut register = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &verify,
    )
    .unwrap();
    let initial = support::start(&local, &id);
    let intent =
        CreationIntent::try_new(register.reference(), id.clone(), path.clone(), initial).unwrap();
    let reference = match register.create(&intent, &mut local.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => *reference,
        _ => panic!("not ready"),
    };
    drop(register);
    (
        Original::open(&reference, local.clone(), &verify).unwrap(),
        id,
        reference,
        local,
        path,
    )
}
#[test]
fn explicit_creation_and_opening_preserve_private_files_and_lifetime_writer_exclusion() {
    let _process = CHILD_PROCESS_SERIAL.lock().unwrap();
    let path = directory("custody");
    assert!(WriterCustody::open(&path).is_err());
    let lease = WriterCustody::create(&path).unwrap();
    assert_eq!(fs::metadata(&path).unwrap().mode() & 0o777, 0o700);
    for name in ["writer.lock", "ledger.sqlite"] {
        assert_eq!(fs::metadata(path.join(name)).unwrap().mode() & 0o777, 0o600)
    }
    assert!(WriterCustody::create(&path).is_err());
    assert!(matches!(WriterCustody::open(&path), Err(StoreError::Busy)));
    lease.check().unwrap();
    let binding = lease.binding();
    drop(lease);
    let reopened = WriterCustody::open(&path).unwrap();
    assert_eq!(reopened.binding(), binding);
    reopened.check().unwrap();
}
#[test]
fn detectable_database_directory_lock_and_private_mode_replacements_refuse() {
    for subject in ["ledger.sqlite", "writer.lock", "directory", "mode"] {
        let path = directory(subject);
        let lease = WriterCustody::create(&path).unwrap();
        if subject == "mode" {
            fs::set_permissions(
                path.join("ledger.sqlite"),
                fs::Permissions::from_mode(0o644),
            )
            .unwrap()
        } else if subject == "directory" {
            fs::rename(&path, path.with_extension("original")).unwrap();
            drop(WriterCustody::create(&path).unwrap())
        } else {
            fs::rename(path.join(subject), path.join(format!("{subject}.original"))).unwrap();
            fs::write(path.join(subject), b"replacement").unwrap();
            fs::set_permissions(path.join(subject), fs::Permissions::from_mode(0o600)).unwrap()
        }
        assert!(matches!(lease.check(), Err(StoreError::Custody)))
    }
}
#[test]
fn symlinks_missing_controls_and_loose_sidecars_are_not_silently_repaired() {
    let path = directory("symlink");
    let lease = WriterCustody::create(&path).unwrap();
    let alias = path.with_extension("alias");
    unix_fs::symlink(&path, &alias).unwrap();
    assert!(WriterCustody::open(&alias).is_err());
    fs::write(path.join("ledger.sqlite-wal"), b"scratch").unwrap();
    fs::set_permissions(
        path.join("ledger.sqlite-wal"),
        fs::Permissions::from_mode(0o644),
    )
    .unwrap();
    assert!(matches!(lease.check(), Err(StoreError::Custody)));
    fs::rename(
        path.join("ledger.sqlite-wal"),
        path.join("preserved-invalid-wal"),
    )
    .unwrap();
    drop(lease);
    fs::rename(path.join("writer.lock"), path.join("preserved.lock")).unwrap();
    assert!(WriterCustody::open(&path).is_err());
    assert!(!path.join("writer.lock").exists())
}
#[test]
fn unsupported_filesystem_is_refused_without_creating_storage() {
    assert!(matches!(
        WriterCustody::verify_profile(Path::new("/proc")),
        Err(StoreError::UnsupportedProfile)
    ))
}
#[test]
fn separate_process_cannot_take_writer_lock_until_original_handle_closes() {
    let _process = CHILD_PROCESS_SERIAL.lock().unwrap();
    let path = directory("process-lock");
    let lease = WriterCustody::create(&path).unwrap();
    let attempt = || {
        std::process::Command::new("/usr/bin/flock")
            .args(["--nonblock", "--exclusive"])
            .arg(path.join("writer.lock"))
            .arg("/usr/bin/true")
            .status()
            .unwrap()
    };
    assert_eq!(attempt().code(), Some(1));
    lease.check().unwrap();
    drop(lease);
    assert!(attempt().success())
}
#[test]
fn authorized_creation_includes_two_independent_started_changes_without_implicit_grants() {
    let verify = root();
    let reg = directory("two-reg");
    let a = support::identity(41);
    let b = support::identity(42);
    let pa = directory("two-a");
    let pb = directory("two-b");
    let la = support::local(&a, &reg, &pa, &verify);
    let lb = support::local(&b, &reg, &pb, &verify);
    for permit in [
        support::Permit::Reserve(b.clone()),
        support::Permit::Bind(b.clone()),
        support::Permit::Include(b.clone()),
    ] {
        la.0.lock().unwrap().custody.insert(permit);
    }
    let mut register = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: a.owner.clone(),
            ledger: a.ledger.clone(),
        },
        la.clone(),
        &verify,
    )
    .unwrap();
    let ia = CreationIntent::try_new(register.reference(), a.clone(), pa, support::start(&la, &a))
        .unwrap();
    let ib = CreationIntent::try_new(register.reference(), b.clone(), pb, support::start(&lb, &b))
        .unwrap();
    let ra = match register.create(&ia, &mut la.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => reference,
        _ => panic!("A pending"),
    };
    let rb = match register.create(&ib, &mut lb.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => reference,
        _ => panic!("B pending"),
    };
    drop(register);
    let mut sa = Original::open(&ra, la.clone(), &verify).unwrap();
    let mut sb = Original::open(&rb, lb, &verify).unwrap();
    assert!(sa
        .read(
            Query::Status,
            Access::Grant(GrantUse {
                id: GrantId::from_bytes([88; 16]).unwrap(),
                generation: 1
            })
        )
        .is_err());
    // Same local operation/grant leaves in independent containers are not collisions.
    sa.submit(&support::grant(&a, 77)).unwrap();
    sb.submit(&support::grant(&b, 77)).unwrap();
    assert_ne!(
        fs::metadata(ra.location().join("ledger.sqlite"))
            .unwrap()
            .ino(),
        fs::metadata(rb.location().join("ledger.sqlite"))
            .unwrap()
            .ino()
    );
}
#[test]
fn custody_authorization_and_inclusion_do_not_default_from_disclosure_or_represented_owner() {
    let id = support::identity(51);
    let reg = directory("denied-reg");
    let path = directory("denied-original");
    let verify = root();
    let local = support::local(&id, &reg, &path, &verify);
    let ledger = LedgerIdentity {
        owner: id.owner.clone(),
        ledger: id.ledger.clone(),
    };
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Bootstrap(reg.clone()));
    assert!(matches!(
        Register::bootstrap_new(&reg, ledger.clone(), local.clone(), &verify),
        Err(StoreError::Refused(Error::Denied))
    ));
    assert!(!reg.exists());
    local
        .0
        .lock()
        .unwrap()
        .custody
        .insert(support::Permit::Bootstrap(reg.clone()));
    let mut register = Register::bootstrap_new(&reg, ledger, local.clone(), &verify).unwrap();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Reserve(id.clone()));
    let intent = CreationIntent::try_new(
        register.reference(),
        id.clone(),
        path.clone(),
        support::start(&local, &id),
    )
    .unwrap();
    assert!(matches!(
        register.create(&intent, &mut local.clone()),
        Err(StoreError::Refused(Error::Denied))
    ));
    assert!(!path.exists());
    local
        .0
        .lock()
        .unwrap()
        .custody
        .insert(support::Permit::Reserve(id.clone()));
    let reference = match register.create(&intent, &mut local.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => reference,
        _ => panic!("not ready"),
    };
    drop(register);
    let mut original = Original::open(&reference, local.clone(), &verify).unwrap();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Maintain);
    assert!(matches!(
        original.passive_checkpoint(),
        Err(StoreError::Refused(Error::Denied))
    ));
    assert!(matches!(
        original.close(),
        Err(StoreError::Refused(Error::Denied))
    ));
}
fn sidecar_loss(suffix: &str, replace: bool) {
    let (mut store, _, _, _, path) = included("sidecar");
    let target = path.join(format!("ledger.sqlite{suffix}"));
    // Preserve native SHM by pathname, never by opening/copying a SHM descriptor.
    fs::rename(&target, path.join(format!("preserved{suffix}"))).unwrap();
    if replace {
        fs::write(&target, b"replacement must survive").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o600)).unwrap();
    }
    assert!(store.passive_checkpoint().is_err());
    assert!(matches!(
        store.passive_checkpoint(),
        Err(StoreError::Fenced)
    ));
    assert!(store.close().is_err());
    if replace {
        assert_eq!(fs::read(&target).unwrap(), b"replacement must survive")
    } else {
        assert!(!target.exists())
    }
}
#[test]
fn live_wal_unlink_is_detected_and_fences_before_checkpoint() {
    sidecar_loss("-wal", false)
}
#[test]
fn live_shm_unlink_is_detected_and_fences_before_checkpoint() {
    sidecar_loss("-shm", false)
}
#[test]
fn live_wal_replacement_is_detected_and_fences_before_checkpoint() {
    sidecar_loss("-wal", true)
}
#[test]
fn live_shm_replacement_is_detected_and_fences_before_checkpoint() {
    sidecar_loss("-shm", true)
}
#[test]
fn fenced_implicit_drop_does_not_checkpoint_or_delete_replacement_sidecars() {
    let (mut store, _, _, _, path) = included("fenced-drop");
    for suffix in ["-wal", "-shm"] {
        let target = path.join(format!("ledger.sqlite{suffix}"));
        fs::rename(&target, path.join(format!("preserved{suffix}"))).unwrap();
        fs::write(&target, b"replacement must survive").unwrap();
        fs::set_permissions(&target, fs::Permissions::from_mode(0o600)).unwrap();
    }
    assert!(store.passive_checkpoint().is_err());
    drop(store);
    for suffix in ["-wal", "-shm"] {
        assert_eq!(
            fs::read(path.join(format!("ledger.sqlite{suffix}"))).unwrap(),
            b"replacement must survive"
        );
        assert!(path.join(format!("preserved{suffix}")).exists())
    }
}
#[test]
fn required_fixture_staging_refuses_missing_relative_project_and_unsupported_locations() {
    let missing = directory("missing-required-stage");
    assert!(!missing.exists());
    assert!(staging::root(&missing).is_err());
    assert!(!missing.exists());
    assert!(staging::root(Path::new("relative-stage")).is_err());
    assert!(staging::root(Path::new(env!("CARGO_MANIFEST_DIR"))).is_err());
    assert!(staging::root(Path::new("/proc")).is_err());
}
