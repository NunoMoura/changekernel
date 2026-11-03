//! Quiescent private evidence copy. Never opens source SQLite or copies/opens source SHM.
use super::control::{self, Kind, Phase, Witness};
use super::custody::WriterCustody;
use super::records::{self, History};
use super::schema;
use super::store_error::{StoreError, StoreResult};
use crate::application::read_budget::ReadBudget;
use rusqlite::config::DbConfig;
use rusqlite::{Connection, OpenFlags};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::os::unix::fs::{DirBuilderExt, MetadataExt, OpenOptionsExt};
use std::path::{Path, PathBuf};

#[derive(Clone, Copy)]
pub(super) enum Proof {
    Journals,
    Main,
}
pub(super) struct Inspection {
    pub cut: super::control::Cut,
    pub history: Option<History>,
    pub activation: Option<Vec<u8>>,
    pub entries: Option<super::register::Entries>,
}
pub(super) fn configure(c: &Connection, readonly: bool) -> StoreResult<()> {
    // FIRST configuration, before any SQL/pager read. Never disable this flag.
    if !c.set_db_config(DbConfig::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE, true)?
        || !c.db_config(DbConfig::SQLITE_DBCONFIG_NO_CKPT_ON_CLOSE)?
    {
        return Err(StoreError::UnsupportedProfile);
    }
    c.busy_timeout(std::time::Duration::ZERO)?;
    if !c.set_db_config(DbConfig::SQLITE_DBCONFIG_DEFENSIVE, true)?
        || c.set_db_config(DbConfig::SQLITE_DBCONFIG_TRUSTED_SCHEMA, false)?
    {
        return Err(StoreError::UnsupportedProfile);
    }
    schema::limits(c)?;
    c.pragma_update(None, "query_only", readonly)?;
    if !readonly {
        c.pragma_update(None, "synchronous", "FULL")?;
        c.pragma_update(None, "foreign_keys", "ON")?;
        c.pragma_update(None, "wal_autocheckpoint", 0)?;
        if c.pragma_query_value(None, "synchronous", |r| r.get::<_, i64>(0))? != 2
            || c.pragma_query_value(None, "foreign_keys", |r| r.get::<_, i64>(0))? != 1
        {
            return Err(StoreError::UnsupportedProfile);
        }
    }
    Ok(())
}
pub(super) fn open_writer(custody: &mut WriterCustody, new: bool) -> StoreResult<Connection> {
    custody.begin_connection()?;
    let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
        | OpenFlags::SQLITE_OPEN_FULL_MUTEX
        | OpenFlags::SQLITE_OPEN_NOFOLLOW;
    let c = Connection::open_with_flags(custody.database_path(), flags)?;
    configure(&c, false)?;
    if new {
        c.pragma_update(None, "journal_mode", "WAL")?;
    } else if c.pragma_query_value(None, "journal_mode", |r| r.get::<_, String>(0))? != "wal" {
        return Err(StoreError::UnsupportedProfile);
    }
    Ok(c)
}
pub(super) fn finish_open(custody: &mut WriterCustody, c: &Connection) -> StoreResult<()> {
    let _: i64 = c.query_row("SELECT count(*) FROM sqlite_schema", [], |r| r.get(0))?;
    custody.connection_opened()?;
    Ok(())
}
struct DirectoryPin {
    path: PathBuf,
    file: File,
    private: bool,
}
struct CopyPin {
    name: String,
    source: File,
    copy: File,
    source_object: (u64, u64),
    copy_object: (u64, u64),
    length: u64,
}
struct ProtectedCopy {
    directory: PathBuf,
    owner: u32,
    directories: Vec<DirectoryPin>,
    files: Vec<CopyPin>,
}
fn same_object(a: &fs::Metadata, b: &fs::Metadata) -> bool {
    a.dev() == b.dev() && a.ino() == b.ino()
}
impl DirectoryPin {
    fn open(path: &Path, owner: u32, private: bool) -> StoreResult<Self> {
        let file = OpenOptions::new()
            .read(true)
            .custom_flags(0x20000)
            .open(path)?;
        let out = Self {
            path: path.to_owned(),
            file,
            private,
        };
        out.check(owner)?;
        Ok(out)
    }
    fn check(&self, owner: u32) -> StoreResult<()> {
        let held = self.file.metadata()?;
        let current = fs::symlink_metadata(&self.path)?;
        for m in [&held, &current] {
            if !m.is_dir()
                || (self.private && (m.uid() != owner || m.mode() & 0o7777 != 0o700))
                || (!self.private && ((m.uid() != 0 && m.uid() != owner) || m.mode() & 0o022 != 0))
            {
                return Err(StoreError::Custody);
            }
        }
        if !same_object(&held, &current) {
            return Err(StoreError::Custody);
        }
        Ok(())
    }
}
impl ProtectedCopy {
    fn try_new(custody: &WriterCustody, root: &Path) -> StoreResult<Self> {
        // Runtime authority is explicit native custody, never a build-time source pathname.
        if !root.is_absolute() || root.canonicalize()? != root {
            return Err(StoreError::Custody);
        }
        let owner = fs::symlink_metadata(custody.directory())?.uid();
        let mut directories = Vec::new();
        for (index, path) in root.ancestors().enumerate() {
            directories.push(DirectoryPin::open(path, owner, index == 0)?);
        }
        WriterCustody::verify_profile(root)?;
        let directory = root.join(format!(
            "verify-{}",
            control::hex(&super::super::ids::candidate()?)
        ));
        fs::DirBuilder::new().mode(0o700).create(&directory)?;
        directories.push(DirectoryPin::open(&directory, owner, true)?);
        let out = Self {
            directory,
            owner,
            directories,
            files: Vec::new(),
        };
        out.check(custody)?;
        out.directories
            .first()
            .ok_or(StoreError::Custody)?
            .file
            .sync_all()?;
        Ok(out)
    }
    fn copy_member(&mut self, custody: &WriterCustody, name: &str) -> StoreResult<()> {
        self.copy_member_length(custody, name, None)
    }
    fn copy_member_length(
        &mut self,
        custody: &WriterCustody,
        name: &str,
        expected: Option<u64>,
    ) -> StoreResult<()> {
        self.check(custody)?;
        let mut source = custody.member(name, false)?;
        let source_object = custody.file_object(&source)?;
        let length = source.metadata()?.len();
        if expected.is_some_and(|expected| expected != length) {
            return Err(StoreError::Custody);
        }
        let mut copy = OpenOptions::new()
            .read(true)
            .write(true)
            .create_new(true)
            .mode(0o600)
            .custom_flags(0x20000)
            .open(self.directory.join(name))?;
        let copy_object = custody.file_object(&copy)?;
        copy_length(&mut source, &mut copy, length)?;
        copy.sync_all()?;
        self.files.push(CopyPin {
            name: name.to_owned(),
            source,
            copy,
            source_object,
            copy_object,
            length,
        });
        self.check(custody)?;
        self.compare(custody)
    }
    fn check(&self, custody: &WriterCustody) -> StoreResult<()> {
        custody.check()?;
        for d in &self.directories {
            d.check(self.owner)?;
        }
        for f in &self.files {
            if custody.file_object(&f.source)? != f.source_object
                || custody.member_object(&f.name)? != Some(f.source_object)
                || custody.file_object(&f.copy)? != f.copy_object
            {
                return Err(StoreError::Custody);
            }
            let current = fs::symlink_metadata(self.directory.join(&f.name))?;
            if !current.is_file()
                || current.uid() != self.owner
                || current.mode() & 0o7777 != 0o600
                || current.nlink() != 1
                || (current.dev(), current.ino()) != f.copy_object
                || current.len() != f.length
                || f.copy.metadata()?.len() != f.length
                || f.source.metadata()?.len() != f.length
            {
                return Err(StoreError::Custody);
            }
        }
        Ok(())
    }
    fn compare(&mut self, custody: &WriterCustody) -> StoreResult<()> {
        self.check(custody)?;
        let mut a = [0; 65536];
        let mut b = [0; 65536];
        for f in &mut self.files {
            f.source.seek(SeekFrom::Start(0))?;
            f.copy.seek(SeekFrom::Start(0))?;
            let mut remaining = f.length;
            while remaining != 0 {
                let take = remaining.min(a.len() as u64) as usize;
                f.source.read_exact(&mut a[..take])?;
                f.copy.read_exact(&mut b[..take])?;
                if a[..take] != b[..take] {
                    return Err(StoreError::Custody);
                }
                remaining -= take as u64;
            }
            let mut extra = [0];
            if f.source.read(&mut extra)? != 0 || f.copy.read(&mut extra)? != 0 {
                return Err(StoreError::Custody);
            }
        }
        self.check(custody)
    }
}
// Bound by the pinned initial length, never a producer's moving EOF. Growth is an error,
// not more copy work; even a nonterminating producer can supply at most length + one byte.
fn copy_length(source: &mut impl Read, target: &mut impl Write, length: u64) -> StoreResult<()> {
    let mut bytes = [0; 65536];
    let mut remaining = length;
    while remaining != 0 {
        let take = remaining.min(bytes.len() as u64) as usize;
        let n = source.read(&mut bytes[..take])?;
        if n == 0 {
            return Err(StoreError::Custody);
        }
        target.write_all(&bytes[..n])?;
        remaining -= n as u64;
    }
    if source.read(&mut bytes[..1])? != 0 {
        return Err(StoreError::Custody);
    }
    Ok(())
}
pub(super) fn inspect(
    custody: &WriterCustody,
    witness: &Witness,
    root: &Path,
    proof: Proof,
) -> StoreResult<Inspection> {
    custody.check()?;
    if Witness::read(custody)? != *witness {
        return Err(StoreError::Custody);
    }
    let before = proof_journals(custody, witness, proof)?;
    let main = matches!(proof, Proof::Main);
    let mut copy = ProtectedCopy::try_new(custody, root)?;
    copy.copy_member(custody, "ledger.sqlite")?;
    if !main && before[0].is_some() {
        copy.copy_member(custody, "ledger.sqlite-wal")?;
    }
    copy.directories
        .last()
        .ok_or(StoreError::Custody)?
        .file
        .sync_all()?;
    copy.compare(custody)?;
    if custody.journal_objects()? != before || Witness::read(custody)? != *witness {
        return Err(StoreError::Custody);
    }
    #[cfg(test)]
    self::copy_cut(false, custody, &copy.directory);
    copy.check(custody)?;
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY
        | OpenFlags::SQLITE_OPEN_FULL_MUTEX
        | OpenFlags::SQLITE_OPEN_NOFOLLOW;
    let c = Connection::open_with_flags(copy.directory.join("ledger.sqlite"), flags)?;
    copy.check(custody)?;
    configure(&c, true)?;
    let cut = schema::validate(&c, &witness.subject)?;
    let (history, activation, entries) = match witness.subject.kind {
        Kind::Register => (
            None,
            None,
            Some(super::register::validate(&c, &witness.subject, &cut)?),
        ),
        Kind::Original => {
            let identity = witness
                .subject
                .identity
                .as_ref()
                .ok_or(StoreError::Corrupt)?;
            let history = records::load(&c, identity, &cut)?;
            let activation = activation(&c)?;
            if let Some(bytes) = &activation {
                super::register::validate_receipt(
                    bytes,
                    &witness.subject,
                    &history.records,
                    &history.requests,
                )?;
            }
            (Some(history), activation, None)
        }
    };
    // A scratch snapshot can never itself select/declare a complete authoritative cut.
    // Its caller must compare this cut and mutation descriptor to the independent witness.
    c.close().map_err(|(_, e)| StoreError::Database(e))?;
    // Same pinned files that SQLite inspected; no source/copy DB fd closes while SQLite is live.
    #[cfg(test)]
    self::copy_cut(true, custody, &copy.directory);
    copy.compare(custody)?;
    if custody.journal_objects()? != before || Witness::read(custody)? != *witness {
        return Err(StoreError::Custody);
    }
    custody.check()?;
    Ok(Inspection {
        cut,
        history,
        activation,
        entries,
    })
}
fn proof_journals(
    custody: &WriterCustody,
    witness: &Witness,
    proof: Proof,
) -> StoreResult<[Option<(u64, u64)>; 2]> {
    let before = custody.journal_objects()?;
    let main = matches!(proof, Proof::Main);
    if main
        && !matches!(
            witness.phase,
            Phase::Clean | Phase::Closing | Phase::PreparingOpen
        )
    {
        return Err(StoreError::Custody);
    }
    if main
        && witness.journals[0].is_some()
        && before[0].is_some()
        && before[0] != witness.journals[0]
    {
        return Err(StoreError::Custody);
    }
    if !main {
        match witness.phase {
            Phase::Preparing => {} // New-only provisioning, never normal original activation.
            Phase::Clean => {
                if before[0].is_some() && before[0] != witness.journals[0] {
                    return Err(StoreError::Custody);
                }
            }
            _ => {
                if witness.journals[0].is_none() || before[0] != witness.journals[0] {
                    return Err(StoreError::Custody);
                }
            }
        }
    } else if witness.phase == Phase::PreparingOpen && witness.journals[0].is_some() {
        return Err(StoreError::Custody);
    }
    Ok(before)
}
/// A bounded read's pinned physical evidence. It outlives scratch SQLite, packing and final
/// disclosure callbacks. Nothing opens SQLite on the source or publishes lifecycle evidence.
pub(super) struct ReadCopy {
    copy: ProtectedCopy,
    journals: [Option<(u64, u64)>; 2],
}
impl ReadCopy {
    pub fn capture(
        custody: &WriterCustody,
        witness: &Witness,
        root: &Path,
        proof: Proof,
        budget: &mut ReadBudget,
    ) -> StoreResult<Self> {
        if root.as_os_str().len() > 4096 || root.ancestors().count() > 64 {
            return Err(StoreError::Limit);
        }
        budget.work(64 * 64 * 16)?;
        budget.allocate((4 * 65536 + 64 * (4096 + std::mem::size_of::<DirectoryPin>())) as u64)?;
        if Witness::read_bounded(custody, budget)? != *witness {
            return Err(StoreError::Custody);
        }
        let journals = proof_journals(custody, witness, proof)?;
        let mut source_bytes = 0u64;
        let mut lengths = Vec::with_capacity(2);
        for name in [
            Some("ledger.sqlite"),
            if matches!(proof, Proof::Journals) && journals[0].is_some() {
                Some("ledger.sqlite-wal")
            } else {
                None
            },
        ]
        .into_iter()
        .flatten()
        {
            let length = custody.member(name, false)?.metadata()?.len();
            source_bytes = source_bytes.checked_add(length).ok_or(StoreError::Limit)?;
            lengths.push((name, length));
        }
        budget.source(source_bytes)?;
        // Reserve all fixed copy/compare passes, including the final after-packing pass.
        // Main is copied once and compared at most five times; WAL at most four times.
        budget.io(source_bytes
            .checked_mul(16)
            .ok_or(StoreError::Limit)?
            .checked_add(65536)
            .ok_or(StoreError::Limit)?)?;
        budget.work(source_bytes.checked_mul(8).ok_or(StoreError::Limit)?)?;
        let mut copy = ProtectedCopy::try_new(custody, root)?;
        for (name, length) in lengths {
            copy.copy_member_length(custody, name, Some(length))?;
        }
        copy.compare(custody)?;
        Ok(Self { copy, journals })
    }
    pub fn directory(&self) -> &Path {
        &self.copy.directory
    }
    pub fn images(&mut self, budget: &mut ReadBudget) -> StoreResult<(Vec<u8>, Option<Vec<u8>>)> {
        let mut main = None;
        let mut wal = None;
        for member in &mut self.copy.files {
            budget.allocate(member.length)?;
            budget.io(member.length)?;
            let length = usize::try_from(member.length).map_err(|_| StoreError::Limit)?;
            member.copy.seek(SeekFrom::Start(0))?;
            let mut bytes = vec![0; length];
            member.copy.read_exact(&mut bytes)?;
            if member.name == "ledger.sqlite" {
                main = Some(bytes);
            } else {
                wal = Some(bytes);
            }
        }
        Ok((main.ok_or(StoreError::Corrupt)?, wal))
    }
    pub fn check(&self, custody: &WriterCustody) -> StoreResult<()> {
        self.copy.check(custody)
    }
    pub fn verify_source(
        &mut self,
        custody: &WriterCustody,
        witness: &Witness,
        budget: &mut ReadBudget,
    ) -> StoreResult<()> {
        self.copy.compare(custody)?;
        if custody.journal_objects()? != self.journals
            || Witness::read_bounded(custody, budget)? != *witness
        {
            return Err(StoreError::Custody);
        }
        self.copy.check(custody)
    }
}
pub(super) fn activation(c: &Connection) -> StoreResult<Option<Vec<u8>>> {
    let read = |table: &str| -> StoreResult<Option<Vec<u8>>> {
        let mut stmt = c.prepare(&format!("SELECT receipt FROM {table} WHERE singleton=1"))?;
        let mut rows = stmt.query([])?;
        match rows.next()? {
            None => Ok(None),
            Some(row) => Ok(Some(
                schema::blob(row.get_ref(0)?, super::control::DESCRIPTOR)?.to_vec(),
            )),
        }
    };
    let a = read("activation")?;
    if a != read("activation_integrity")? {
        return Err(StoreError::Corrupt);
    }
    Ok(a)
}

#[cfg(test)]
type CopyCut = Box<dyn FnOnce(&WriterCustody, &Path)>;
#[cfg(test)]
thread_local! {
    static BEFORE_INSPECTION:std::cell::RefCell<Option<CopyCut>>=const{std::cell::RefCell::new(None)};
    static AFTER_INSPECTION:std::cell::RefCell<Option<CopyCut>>=const{std::cell::RefCell::new(None)};
}
#[cfg(test)]
fn copy_cut(after: bool, custody: &WriterCustody, path: &Path) {
    let hook = if after {
        AFTER_INSPECTION.with(|h| h.borrow_mut().take())
    } else {
        BEFORE_INSPECTION.with(|h| h.borrow_mut().take())
    };
    if let Some(hook) = hook {
        hook(custody, path)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::sqlite::Original;
    fn verification(root: &Path) -> PathBuf {
        let path = root.join(format!(
            "p33-private-verify-{}",
            control::hex(&crate::adapters::ids::candidate().unwrap())
        ));
        fs::DirBuilder::new().mode(0o700).create(&path).unwrap();
        path
    }
    #[test]
    fn copying_stops_at_initial_length_even_when_source_never_reaches_eof() {
        struct Growing {
            read: usize,
        }
        impl Read for Growing {
            fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
                self.read += output.len();
                output.fill(7);
                Ok(output.len())
            }
        }
        let mut source = Growing { read: 0 };
        let mut target = Vec::new();
        assert!(matches!(
            copy_length(&mut source, &mut target, 65537),
            Err(StoreError::Custody)
        ));
        assert_eq!(source.read, 65538, "only one extra byte is inspected");
        assert_eq!(target.len(), 65537, "growth is never copied or accepted");
        let mut short = std::io::Cursor::new([1, 2]);
        assert!(matches!(
            copy_length(&mut short, &mut Vec::new(), 3),
            Err(StoreError::Custody)
        ));
        let mut exact = std::io::Cursor::new([1, 2]);
        let mut output = Vec::new();
        copy_length(&mut exact, &mut output, 2).expect("unchanged copy");
        assert_eq!(output, [1, 2]);
    }
    #[test]
    fn replaced_scratch_directory_or_copied_file_cannot_change_inspected_subject() {
        for file in [false, true] {
            let (original, _, _, reference, local, root) =
                crate::adapters::sqlite::tests::provision();
            drop(original);
            let verify = verification(&root);
            local.0.lock().unwrap().custody.insert(
                crate::adapters::sqlite::tests::support::Permit::Verify(verify.clone()),
            );
            BEFORE_INSPECTION.with(|h| {
                *h.borrow_mut() = Some(Box::new(move |_, path| {
                    if file {
                        fs::rename(path.join("ledger.sqlite"), path.join("preserved.sqlite"))
                            .unwrap();
                        fs::copy(path.join("preserved.sqlite"), path.join("ledger.sqlite"))
                            .unwrap();
                    } else {
                        let saved = path.with_extension("preserved");
                        fs::rename(path, &saved).unwrap();
                        fs::DirBuilder::new().mode(0o700).create(path).unwrap();
                        for name in ["ledger.sqlite", "ledger.sqlite-wal"] {
                            if saved.join(name).exists() {
                                fs::copy(saved.join(name), path.join(name)).unwrap();
                            }
                        }
                    }
                }))
            });
            assert!(matches!(
                Original::open(&reference, local, &verify),
                Err(StoreError::Custody)
            ));
        }
    }
    #[test]
    fn post_inspection_same_length_source_change_is_not_missed_by_metadata_checks() {
        let (original, _, _, reference, local, root) = crate::adapters::sqlite::tests::provision();
        drop(original);
        AFTER_INSPECTION.with(|h| {
            *h.borrow_mut() = Some(Box::new(|custody, _| {
                let path = custody.directory().join("ledger.sqlite");
                fs::copy(
                    &path,
                    custody.directory().join("preserved-before-inspection-cut"),
                )
                .unwrap();
                let mut file = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(path)
                    .unwrap();
                let mut byte = [0];
                file.read_exact(&mut byte).unwrap();
                byte[0] ^= 1;
                file.seek(SeekFrom::Start(0)).unwrap();
                file.write_all(&byte).unwrap();
                file.sync_all().unwrap();
            }))
        });
        assert!(matches!(
            Original::open(&reference, local, &root),
            Err(StoreError::Custody)
        ));
    }
    #[test]
    fn writable_scratch_ancestor_refuses_without_mutating_the_original() {
        use std::os::unix::fs::PermissionsExt;
        let (original, _, path, reference, local, root) =
            crate::adapters::sqlite::tests::provision();
        drop(original);
        let parent = verification(&root);
        let verify = verification(&parent);
        fs::set_permissions(&parent, fs::Permissions::from_mode(0o777)).unwrap();
        local.0.lock().unwrap().custody.insert(
            crate::adapters::sqlite::tests::support::Permit::Verify(verify.clone()),
        );
        let db = fs::read(path.join("ledger.sqlite")).unwrap();
        assert!(matches!(
            Original::open(&reference, local, &verify),
            Err(StoreError::Custody)
        ));
        assert_eq!(fs::read(path.join("ledger.sqlite")).unwrap(), db);
        // Only our fresh fault fixture is restored; no global settings/old trees change.
        fs::set_permissions(parent, fs::Permissions::from_mode(0o700)).unwrap();
    }
}
