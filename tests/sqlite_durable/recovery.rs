use super::support;
use changekernel::adapters::sqlite::{Original, OriginalReference, StoreError};
use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
fn checkpointed_with_later_wal(label: &str) -> (OriginalReference, support::Local, PathBuf) {
    let (mut original, id, reference, local, path) = super::included(label);
    original.passive_checkpoint().unwrap();
    original.submit(&support::grant(&id, 71)).unwrap();
    drop(original);
    (reference, local, path)
}
fn sqlite_copy_count(path: &Path) -> u64 {
    use std::os::unix::fs::DirBuilderExt;
    let copy = super::directory("sqlite-fallback-probe");
    fs::DirBuilder::new().mode(0o700).create(&copy).unwrap();
    for name in ["ledger.sqlite", "ledger.sqlite-wal"] {
        fs::copy(path.join(name), copy.join(name)).unwrap();
    }
    // Engine-only inspection of an explicitly non-authoritative test copy, never normal open.
    let c = rusqlite::Connection::open_with_flags(
        copy.join("ledger.sqlite"),
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NOFOLLOW,
    )
    .unwrap();
    c.set_db_config(
        rusqlite::config::DbConfig::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE,
        true,
    )
    .unwrap();
    c.query_row("SELECT count FROM head", [], |r| r.get::<_, i64>(0))
        .unwrap() as u64
}
#[test]
fn cold_missing_wal_refuses_even_when_main_contains_an_older_consistent_prefix() {
    let (reference, local, path) = checkpointed_with_later_wal("cold-missing-wal");
    let main = fs::read(path.join("ledger.sqlite")).unwrap();
    fs::rename(
        path.join("ledger.sqlite-wal"),
        path.join("preserved-required-wal"),
    )
    .unwrap();
    assert!(Original::open(&reference, local, &super::root()).is_err());
    assert_eq!(fs::read(path.join("ledger.sqlite")).unwrap(), main);
    assert!(!path.join("ledger.sqlite-wal").exists());
}
#[test]
fn invalid_wal_silently_ignored_by_sqlite_cannot_certify_the_current_cut() {
    let (reference, local, path) = checkpointed_with_later_wal("invalid-wal");
    let wal = path.join("ledger.sqlite-wal");
    fs::copy(&wal, path.join("preserved-valid-wal")).unwrap();
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(&wal)
        .unwrap();
    let mut byte = [0];
    file.read_exact(&mut byte).unwrap();
    byte[0] ^= 0xff;
    file.seek(SeekFrom::Start(0)).unwrap();
    file.write_all(&byte).unwrap();
    file.sync_all().unwrap();
    drop(file);
    assert_eq!(sqlite_copy_count(&path), 1);
    let main = fs::read(path.join("ledger.sqlite")).unwrap();
    assert!(Original::open(&reference, local, &super::root()).is_err());
    assert_eq!(fs::read(path.join("ledger.sqlite")).unwrap(), main);
}
#[test]
fn valid_commit_boundary_truncation_disagrees_with_independently_later_cut() {
    let (mut original, id, reference, local, path) = super::included("valid-prefix-truncation");
    original.passive_checkpoint().unwrap();
    original.submit(&support::grant(&id, 72)).unwrap();
    original.submit(&support::grant(&id, 73)).unwrap();
    drop(original);
    let wal = path.join("ledger.sqlite-wal");
    let bytes = fs::read(&wal).unwrap();
    fs::copy(&wal, path.join("preserved-full-wal")).unwrap();
    let page = u32::from_be_bytes(bytes[8..12].try_into().unwrap()) as usize;
    assert!(page.is_power_of_two());
    let frame = 24 + page;
    let salts = &bytes[16..24];
    let boundary = bytes[32..]
        .chunks_exact(frame)
        .enumerate()
        .find_map(|(i, f)| {
            if &f[8..16] == salts && u32::from_be_bytes(f[4..8].try_into().unwrap()) > 0 {
                Some(32 + (i + 1) * frame)
            } else {
                None
            }
        })
        .expect("native committed WAL frame");
    fs::OpenOptions::new()
        .write(true)
        .open(&wal)
        .unwrap()
        .set_len(boundary as u64)
        .unwrap();
    assert_eq!(sqlite_copy_count(&path), 2);
    assert!(Original::open(&reference, local, &super::root()).is_err());
}
#[test]
fn unexplained_rollback_journal_is_preserved_and_refused_before_source_sqlite_access() {
    use std::os::unix::fs::OpenOptionsExt;
    let (original, _, reference, local, path) = super::included("unexplained-rollback");
    drop(original);
    let db = fs::read(path.join("ledger.sqlite")).unwrap();
    let wal = fs::read(path.join("ledger.sqlite-wal")).unwrap();
    let journal = path.join("ledger.sqlite-journal");
    let mut f = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .mode(0o600)
        .open(&journal)
        .unwrap();
    f.write_all(b"uninspected rollback journal").unwrap();
    f.sync_all().unwrap();
    drop(f);
    let before = support::native_snapshot(&path);
    assert!(matches!(
        Original::open(&reference, local, &super::root()),
        Err(StoreError::UnsupportedProfile)
    ));
    assert_eq!(support::native_snapshot(&path), before);
    assert_eq!(fs::read(&journal).unwrap(), b"uninspected rollback journal");
    assert_eq!(fs::read(path.join("ledger.sqlite")).unwrap(), db);
    assert_eq!(fs::read(path.join("ledger.sqlite-wal")).unwrap(), wal);
}
