use changekernel::adapters::sqlite::{Original, StoreError};
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::Path;
fn tamper(path: &Path, sql: &str) {
    // Deliberate closed-fixture corruption, not a product connection or mutation API.
    fs::copy(
        path.join("ledger.sqlite"),
        path.join("preserved-pre-tamper-db"),
    )
    .unwrap();
    fs::copy(
        path.join("ledger.sqlite-wal"),
        path.join("preserved-pre-tamper-wal"),
    )
    .unwrap();
    let c = rusqlite::Connection::open_with_flags(
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
    c.execute_batch(sql).unwrap();
    c.close().unwrap();
}
#[test]
fn raw_pair_normalized_controls_and_gapped_prefixes_refuse_instead_of_rebuilding() {
    for (label, sql) in [
        (
            "raw-pair",
            "UPDATE record_integrity SET frame=zeroblob(length(frame))",
        ),
        ("normalized", "DELETE FROM memberships"),
        ("gap", "PRAGMA foreign_keys=OFF; DELETE FROM requests"),
        ("intake", "UPDATE memberships SET intake=0"),
        (
            "ground-extra",
            "INSERT INTO grounds VALUES(zeroblob(16),zeroblob(16))",
        ),
    ] {
        let (original, _, reference, local, path) = super::included(label);
        drop(original);
        tamper(&path, sql);
        let db = fs::read(path.join("ledger.sqlite")).unwrap();
        let wal = fs::read(path.join("ledger.sqlite-wal")).unwrap();
        assert!(Original::open(&reference, local, &super::root()).is_err());
        assert_eq!(fs::read(path.join("ledger.sqlite")).unwrap(), db);
        assert_eq!(fs::read(path.join("ledger.sqlite-wal")).unwrap(), wal);
    }
}
#[test]
fn unsupported_profile_refuses_without_mode_conversion_or_source_mutation() {
    let (original, _, reference, local, path) = super::included("unsupported-profile");
    drop(original);
    tamper(
        &path,
        "PRAGMA ignore_check_constraints=ON; UPDATE header SET codec=2",
    );
    let db = fs::read(path.join("ledger.sqlite")).unwrap();
    let wal = fs::read(path.join("ledger.sqlite-wal")).unwrap();
    assert!(matches!(
        Original::open(&reference, local, &super::root()),
        Err(StoreError::UnsupportedProfile)
    ));
    assert_eq!(fs::read(path.join("ledger.sqlite")).unwrap(), db);
    assert_eq!(fs::read(path.join("ledger.sqlite-wal")).unwrap(), wal);
}
#[test]
fn missing_control_and_copied_original_never_become_empty_or_writable() {
    use std::os::unix::fs::DirBuilderExt;
    let (original, _, reference, local, path) = super::included("missing-control");
    drop(original);
    fs::rename(path.join("custody.ctrl"), path.join("preserved-control")).unwrap();
    assert!(Original::open(&reference, local.clone(), &super::root()).is_err());
    assert!(!path.join("custody.ctrl").exists());
    // A copied directory is not the referenced native object, regardless of valid contents.
    let copy = super::directory("non-authoritative-copy");
    fs::DirBuilder::new().mode(0o700).create(&copy).unwrap();
    for name in ["ledger.sqlite", "ledger.sqlite-wal", "writer.lock"] {
        fs::copy(path.join(name), copy.join(name)).unwrap();
    }
    assert_ne!(
        fs::metadata(copy.join("ledger.sqlite")).unwrap().ino(),
        fs::metadata(path.join("ledger.sqlite")).unwrap().ino()
    );
    assert!(!copy.join("custody.ctrl").exists());
}
