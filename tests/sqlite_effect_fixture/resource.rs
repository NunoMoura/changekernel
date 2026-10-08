//! Test-only notice resource. SQLite owns effect/receipt atomicity; this is not
//! Change history. Authority comes from trusted session composition and native
//! access plus transactionally serialized policy, never from request JSON.
//!
//! Original-instance and completeness proof lasts only while Owner keeps its
//! native directory/DB/writer handles and exact committed snapshot. There is no
//! restart adoption, copied UUID, reconstruction, arbitrary SQL or hidden repair.
use rusqlite::{params, Connection, DropBehavior, OpenFlags, Transaction, TransactionBehavior};
use std::{
    cell::{Cell, RefCell},
    ffi::CString,
    fs::{self, File, OpenOptions},
    ops::Deref,
    os::unix::{
        ffi::OsStrExt,
        fs::{DirBuilderExt, FileExt, MetadataExt, OpenOptionsExt},
        io::AsRawFd,
    },
    path::{Path, PathBuf},
    time::Duration,
};

pub const MAX_TEXT: usize = 256;
pub const MAX_RECEIPTS: usize = 32;
pub const MAX_REVISION: u64 = i64::MAX as u64;
const MAX_DB: u64 = 1_048_576;
const DB: &str = "notice.sqlite";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid,
    Denied,
    Busy,
    KeyConflict,
    Capacity,
    Unavailable,
    Unresolved,
}
pub type Result<T> = std::result::Result<T, Error>;
fn sql_error(e: rusqlite::Error) -> Error {
    eprintln!("SQLite fixture error: {e:?}");
    match e.sqlite_error_code() {
        Some(rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked) => {
            Error::Busy
        }
        _ => Error::Unavailable,
    }
}
fn io<T>(r: std::io::Result<T>) -> Result<T> {
    r.map_err(|e| {
        eprintln!("fixture I/O: {e}");
        Error::Unavailable
    })
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Actor {
    Owner,
    Writer,
    Reader,
    Denied,
}
impl Actor {
    fn name(self) -> &'static str {
        match self {
            Self::Owner => "owner-1",
            Self::Writer => "writer-1",
            Self::Reader => "reader-1",
            Self::Denied => "denied-1",
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rights {
    pub read: bool,
    pub edit: bool,
    pub admin: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Notice {
    pub revision: u64,
    pub text: String,
}
impl Notice {
    fn valid(&self) -> bool {
        (1..=MAX_REVISION).contains(&self.revision)
            && !self.text.is_empty()
            && self.text.len() <= MAX_TEXT
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Operation {
    pub key: String,
    pub expected: u64,
    pub text: String,
}
impl Operation {
    fn valid(&self) -> bool {
        !self.key.is_empty()
            && self.key.len() <= 64
            && self
                .key
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
            && Notice {
                revision: self.expected,
                text: self.text.clone(),
            }
            .valid()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    Applied,
    Conflict,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Receipt {
    pub operation: Operation,
    pub actor: String,
    pub outcome: Outcome,
    pub notice: Notice,
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Snapshot {
    notice: Notice,
    policy: Vec<(String, Rights)>,
    receipts: Vec<Receipt>,
}
impl Snapshot {
    fn read(c: &Connection) -> Result<Self> {
        let notice = c
            .query_row("SELECT revision,text FROM notice WHERE id=1", [], |r| {
                Ok(Notice {
                    revision: r.get(0)?,
                    text: r.get(1)?,
                })
            })
            .map_err(sql_error)?;
        let mut stmt = c
            .prepare("SELECT actor,can_read,can_edit,can_admin FROM policy ORDER BY actor LIMIT 5")
            .map_err(sql_error)?;
        let policy = stmt
            .query_map([], |r| {
                Ok((
                    r.get(0)?,
                    Rights {
                        read: r.get(1)?,
                        edit: r.get(2)?,
                        admin: r.get(3)?,
                    },
                ))
            })
            .map_err(sql_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(sql_error)?;
        let mut stmt = c.prepare("SELECT key,actor,expected,input,outcome,revision,text FROM receipt ORDER BY key LIMIT 33").map_err(sql_error)?;
        let receipts = stmt
            .query_map([], |r| {
                let outcome: i64 = r.get(4)?;
                if !matches!(outcome, 0 | 1) {
                    return Err(rusqlite::Error::InvalidQuery);
                }
                Ok(Receipt {
                    operation: Operation {
                        key: r.get(0)?,
                        expected: r.get(2)?,
                        text: r.get(3)?,
                    },
                    actor: r.get(1)?,
                    outcome: if outcome == 1 {
                        Outcome::Applied
                    } else {
                        Outcome::Conflict
                    },
                    notice: Notice {
                        revision: r.get(5)?,
                        text: r.get(6)?,
                    },
                })
            })
            .map_err(sql_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(sql_error)?;
        if !notice.valid()
            || policy.len() != 4
            || receipts.len() > MAX_RECEIPTS
            || receipts
                .iter()
                .any(|r| !r.operation.valid() || !r.notice.valid())
        {
            return Err(Error::Unavailable);
        }
        Ok(Self {
            notice,
            policy,
            receipts,
        })
    }
    fn rights(&self, actor: Actor) -> Result<Rights> {
        self.policy
            .iter()
            .find(|p| p.0 == actor.name())
            .map(|p| p.1)
            .ok_or(Error::Unavailable)
    }
    fn original(&self, actor: Actor, op: &Operation) -> Result<Option<Receipt>> {
        let Some(r) = self.receipts.iter().find(|r| r.operation.key == op.key) else {
            return Ok(None);
        };
        if r.actor != actor.name() || r.operation != *op {
            return Err(Error::KeyConflict);
        }
        Ok(Some(r.clone()))
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Stamp {
    device: u64,
    inode: u64,
}
fn stamp(f: &File) -> Result<Stamp> {
    let m = io(f.metadata())?;
    Ok(Stamp {
        device: m.dev(),
        inode: m.ino(),
    })
}
fn directory(p: &Path) -> Result<File> {
    io(OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW)
        .open(p))
}
// Named metadata never opens a second raw DB descriptor. Closing even a
// read-only auxiliary DB fd can cancel SQLite's process-wide POSIX locks.
fn named(dir: &File, name: &std::ffi::OsStr, kind: libc::mode_t) -> Result<Stamp> {
    let name = CString::new(name.as_bytes()).map_err(|_| Error::Invalid)?;
    let mut metadata = std::mem::MaybeUninit::<libc::stat>::uninit();
    // SAFETY: live directory fd, terminated name, correctly sized output.
    if unsafe {
        libc::fstatat(
            dir.as_raw_fd(),
            name.as_ptr(),
            metadata.as_mut_ptr(),
            libc::AT_SYMLINK_NOFOLLOW,
        )
    } != 0
    {
        return io(Err(std::io::Error::last_os_error()));
    }
    // SAFETY: successful fstatat initialized the output.
    let m = unsafe { metadata.assume_init() };
    if m.st_mode & libc::S_IFMT != kind
        || (kind == libc::S_IFREG
            && (m.st_nlink != 1 || m.st_size < 0 || m.st_size as u64 > MAX_DB))
    {
        return Err(Error::Unavailable);
    }
    Ok(Stamp {
        device: m.st_dev,
        inode: m.st_ino,
    })
}
fn create_file(p: &Path) -> Result<File> {
    let f = io(OpenOptions::new()
        .read(true)
        .write(true)
        .create_new(true)
        .mode(0o600)
        .custom_flags(libc::O_NOFOLLOW)
        .open(p))?;
    let m = io(f.metadata())?;
    if !m.is_file() || m.nlink() != 1 || m.len() > MAX_DB {
        return Err(Error::Unavailable);
    }
    Ok(f)
}
fn connection(p: &Path, readonly: bool, fresh: bool) -> Result<Connection> {
    let flags = if readonly {
        OpenFlags::SQLITE_OPEN_READ_ONLY
    } else {
        OpenFlags::SQLITE_OPEN_READ_WRITE
    } | OpenFlags::SQLITE_OPEN_NO_MUTEX
        | OpenFlags::SQLITE_OPEN_NOFOLLOW;
    let c = Connection::open_with_flags(p, flags).map_err(sql_error)?; // never CREATE
    c.busy_timeout(Duration::ZERO).map_err(sql_error)?;
    if fresh {
        c.pragma_update(None, "journal_mode", "DELETE")
            .map_err(sql_error)?;
    }
    let mode: String = c
        .pragma_query_value(None, "journal_mode", |r| r.get(0))
        .map_err(sql_error)?;
    if mode != "delete" {
        return Err(Error::Unavailable);
    }
    c.pragma_update(None, "synchronous", "EXTRA")
        .map_err(sql_error)?;
    c.pragma_update(None, "foreign_keys", true)
        .map_err(sql_error)?;
    let sync: i64 = c
        .pragma_query_value(None, "synchronous", |r| r.get(0))
        .map_err(sql_error)?;
    if sync != 3 {
        return Err(Error::Unavailable);
    }
    Ok(c)
}
pub struct Owner {
    root: PathBuf,
    parent: File,
    directory: File,
    database: File,
    writer: File,
    expected: RefCell<Snapshot>,
    uncertain: Cell<bool>,
}
impl Owner {
    pub fn create(root: &Path, initial: Notice) -> Result<Self> {
        if !initial.valid() || !root.is_absolute() {
            return Err(Error::Invalid);
        }
        let parent = root.parent().ok_or(Error::Invalid)?;
        if io(fs::canonicalize(parent))? != parent {
            return Err(Error::Invalid);
        }
        io(fs::DirBuilder::new().mode(0o700).create(root))?; // absent only
        let parent = directory(parent)?;
        let dir = directory(root)?;
        let writer = create_file(&root.join("owner.lock"))?;
        // SAFETY: real live descriptor; lock lasts until this unique Owner drops.
        if unsafe { libc::flock(writer.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err(Error::Unavailable);
        }
        let database = create_file(&root.join(DB))?;
        let mut c = connection(&root.join(DB), false, true)?;
        let tx = c
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(sql_error)?;
        tx.execute_batch("CREATE TABLE notice(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CHECK(revision>0),text TEXT NOT NULL CHECK(length(CAST(text AS BLOB)) BETWEEN 1 AND 256)) STRICT;
            CREATE TABLE policy(actor TEXT PRIMARY KEY,can_read INTEGER NOT NULL CHECK(can_read IN(0,1)),can_edit INTEGER NOT NULL CHECK(can_edit IN(0,1)),can_admin INTEGER NOT NULL CHECK(can_admin IN(0,1))) STRICT;
            CREATE TABLE receipt(key TEXT PRIMARY KEY CHECK(length(CAST(key AS BLOB)) BETWEEN 1 AND 64),actor TEXT NOT NULL REFERENCES policy(actor),expected INTEGER NOT NULL CHECK(expected>0),input TEXT NOT NULL CHECK(length(CAST(input AS BLOB)) BETWEEN 1 AND 256),outcome INTEGER NOT NULL CHECK(outcome IN(0,1)),revision INTEGER NOT NULL CHECK(revision>0),text TEXT NOT NULL CHECK(length(CAST(text AS BLOB)) BETWEEN 1 AND 256)) STRICT;").map_err(sql_error)?;
        tx.execute(
            "INSERT INTO notice VALUES(1,?1,?2)",
            params![initial.revision, initial.text],
        )
        .map_err(sql_error)?;
        for (actor, rights) in [
            (
                Actor::Owner,
                Rights {
                    read: true,
                    edit: true,
                    admin: true,
                },
            ),
            (
                Actor::Writer,
                Rights {
                    read: true,
                    edit: true,
                    admin: false,
                },
            ),
            (
                Actor::Reader,
                Rights {
                    read: true,
                    edit: false,
                    admin: false,
                },
            ),
            (
                Actor::Denied,
                Rights {
                    read: false,
                    edit: false,
                    admin: false,
                },
            ),
        ] {
            tx.execute(
                "INSERT INTO policy VALUES(?1,?2,?3,?4)",
                params![actor.name(), rights.read, rights.edit, rights.admin],
            )
            .map_err(sql_error)?;
        }
        tx.commit().map_err(|e| {
            eprintln!("initial COMMIT uncertain: {e:?}");
            Error::Unresolved
        })?;
        let expected = Snapshot::read(&c)?;
        drop(c);
        io(dir.sync_all())?;
        io(parent.sync_all())?;
        let owner = Self {
            root: root.into(),
            parent,
            directory: dir,
            database,
            writer,
            expected: RefCell::new(expected),
            uncertain: Cell::new(false),
        };
        owner.check()?;
        Ok(owner)
    }
    pub fn path(&self) -> &Path {
        &self.root
    }
    // Forensic bytes only, not committed-receipt evidence. Read the held pin;
    // no extra raw DB descriptor may be opened/closed while SQLite is live.
    pub fn database_bytes(&self) -> Result<Vec<u8>> {
        let length = io(self.database.metadata())?.len();
        if length > MAX_DB {
            return Err(Error::Unavailable);
        }
        let mut bytes = vec![0; length as usize];
        let mut offset = 0;
        while offset < bytes.len() {
            let n = io(self.database.read_at(&mut bytes[offset..], offset as u64))?;
            if n == 0 {
                return Err(Error::Unavailable);
            }
            offset += n;
        }
        Ok(bytes)
    }
    pub fn evidence(&self) -> String {
        format!(
            "parent={:?}; dir={:?}; db={:?}; writer={:?}; expected={:?}; uncertain={}",
            stamp(&self.parent),
            stamp(&self.directory),
            stamp(&self.database),
            stamp(&self.writer),
            self.expected.borrow(),
            self.uncertain.get()
        )
    }
    fn check(&self) -> Result<()> {
        if self.uncertain.get() {
            return Err(Error::Unresolved);
        }
        let result = (|| {
            let parent = self.root.parent().ok_or(Error::Unavailable)?;
            if io(fs::canonicalize(parent))? != parent
                || stamp(&directory(parent)?)? != stamp(&self.parent)?
                || named(
                    &self.parent,
                    self.root.file_name().ok_or(Error::Unavailable)?,
                    libc::S_IFDIR,
                )? != stamp(&self.directory)?
                || named(&self.directory, std::ffi::OsStr::new(DB), libc::S_IFREG)?
                    != stamp(&self.database)?
                || named(
                    &self.directory,
                    std::ffi::OsStr::new("owner.lock"),
                    libc::S_IFREG,
                )? != stamp(&self.writer)?
            {
                return Err(Error::Unavailable);
            }
            if io(self.database.metadata())?.nlink() != 1 {
                return Err(Error::Unavailable);
            }
            Ok(())
        })();
        if result.is_err() {
            self.uncertain.set(true);
        }
        result
    }
    fn verify(&self, c: &Connection) -> Result<Snapshot> {
        self.check()?;
        let actual = Snapshot::read(c).inspect_err(|_| self.uncertain.set(true))?;
        if actual != *self.expected.borrow() {
            self.uncertain.set(true);
            return Err(Error::Unavailable);
        }
        Ok(actual)
    }
}
pub struct Session<'o> {
    owner: &'o Owner,
    connection: Connection,
    actor: Actor,
}
impl<'o> Session<'o> {
    pub fn open_original(owner: &'o Owner, actor: Actor, readonly: bool) -> Result<Self> {
        owner.check()?;
        let connection = connection(&owner.root.join(DB), readonly, false)?;
        owner.check()?;
        let mut session = Self {
            owner,
            connection,
            actor,
        };
        let tx = Tx::begin(
            &mut session.connection,
            owner,
            TransactionBehavior::Deferred,
        )?;
        owner.verify(&tx)?;
        tx.commit(None)?;
        Ok(session)
    }
    pub fn durability(&self) -> Result<(String, i64)> {
        Ok((
            self.connection
                .pragma_query_value(None, "journal_mode", |r| r.get(0))
                .map_err(sql_error)?,
            self.connection
                .pragma_query_value(None, "synchronous", |r| r.get(0))
                .map_err(sql_error)?,
        ))
    }
    pub fn inspect(&mut self) -> Result<Notice> {
        let tx = Tx::begin(
            &mut self.connection,
            self.owner,
            TransactionBehavior::Deferred,
        )?;
        let snapshot = self.owner.verify(&tx)?;
        if !snapshot.rights(self.actor)?.read {
            return Err(Error::Denied);
        }
        let notice = snapshot.notice;
        tx.commit(None)?;
        Ok(notice)
    }
    pub fn lookup(&mut self, op: &Operation) -> Result<Option<Receipt>> {
        if !op.valid() {
            return Err(Error::Invalid);
        }
        let tx = Tx::begin(
            &mut self.connection,
            self.owner,
            TransactionBehavior::Deferred,
        )?;
        let snapshot = self.owner.verify(&tx)?;
        if !snapshot.rights(self.actor)?.read {
            return Err(Error::Denied);
        }
        let receipt = snapshot.original(self.actor, op)?;
        tx.commit(None)?;
        Ok(receipt)
    }
    pub fn invoke(&mut self, op: &Operation) -> Result<Receipt> {
        if let Some(r) = self.lookup(op)? {
            return Ok(r);
        }
        self.prepare(op)?.commit()
    }
    pub fn prepare(&mut self, op: &Operation) -> Result<Pending<'_, 'o>> {
        if !op.valid() {
            return Err(Error::Invalid);
        }
        let tx = Tx::begin(
            &mut self.connection,
            self.owner,
            TransactionBehavior::Immediate,
        )?;
        let snapshot = self.owner.verify(&tx)?;
        let rights = snapshot.rights(self.actor)?;
        if !rights.read {
            return Err(Error::Denied);
        }
        if let Some(receipt) = snapshot.original(self.actor, op)? {
            return Ok(Pending {
                tx,
                receipt,
                next: snapshot,
            });
        }
        if !rights.edit {
            return Err(Error::Denied);
        }
        if snapshot.receipts.len() == MAX_RECEIPTS {
            return Err(Error::Capacity);
        }
        if snapshot.notice.revision == MAX_REVISION && op.expected == MAX_REVISION {
            return Err(Error::Capacity);
        }
        let rows=tx.execute("UPDATE notice SET revision=revision+1,text=?1 WHERE id=1 AND revision=?2 AND revision<?3",params![op.text,op.expected,MAX_REVISION]).map_err(sql_error)?;
        if rows > 1 {
            return Err(Error::Unavailable);
        }
        let notice = tx
            .query_row("SELECT revision,text FROM notice WHERE id=1", [], |r| {
                Ok(Notice {
                    revision: r.get(0)?,
                    text: r.get(1)?,
                })
            })
            .map_err(sql_error)?;
        let receipt = Receipt {
            operation: op.clone(),
            actor: self.actor.name().into(),
            outcome: if rows == 1 {
                Outcome::Applied
            } else {
                Outcome::Conflict
            },
            notice,
        };
        if tx
            .execute(
                "INSERT INTO receipt VALUES(?1,?2,?3,?4,?5,?6,?7)",
                params![
                    op.key,
                    self.actor.name(),
                    op.expected,
                    op.text,
                    i64::from(rows == 1),
                    receipt.notice.revision,
                    receipt.notice.text
                ],
            )
            .map_err(sql_error)?
            != 1
        {
            return Err(Error::Unavailable);
        }
        let next = Snapshot::read(&tx)?;
        Ok(Pending { tx, receipt, next })
    }
    pub fn set_rights(&mut self, actor: Actor, rights: Rights) -> Result<()> {
        let tx = Tx::begin(
            &mut self.connection,
            self.owner,
            TransactionBehavior::Immediate,
        )?;
        let snapshot = self.owner.verify(&tx)?;
        if !snapshot.rights(self.actor)?.admin {
            return Err(Error::Denied);
        }
        if tx
            .execute(
                "UPDATE policy SET can_read=?1,can_edit=?2,can_admin=?3 WHERE actor=?4",
                params![rights.read, rights.edit, rights.admin, actor.name()],
            )
            .map_err(sql_error)?
            != 1
        {
            return Err(Error::Unavailable);
        }
        let next = Snapshot::read(&tx)?;
        tx.commit(Some(next))
    }
    pub fn hold_read(&mut self) -> Result<ReadHold<'_, 'o>> {
        let tx = Tx::begin(
            &mut self.connection,
            self.owner,
            TransactionBehavior::Deferred,
        )?;
        let snapshot = self.owner.verify(&tx)?;
        if !snapshot.rights(self.actor)?.read {
            return Err(Error::Denied);
        }
        Ok(ReadHold { tx })
    }
    pub fn transaction_active(&self) -> bool {
        !self.connection.is_autocommit()
    }
}
struct Tx<'c, 'o> {
    tx: Option<Transaction<'c>>,
    owner: &'o Owner,
}
impl<'c, 'o> Tx<'c, 'o> {
    fn begin(
        c: &'c mut Connection,
        owner: &'o Owner,
        behavior: TransactionBehavior,
    ) -> Result<Self> {
        owner.check()?;
        let mut tx = c.transaction_with_behavior(behavior).map_err(sql_error)?;
        tx.set_drop_behavior(DropBehavior::Ignore); // Our Drop observes rollback errors.
        Ok(Self {
            tx: Some(tx),
            owner,
        })
    }
    fn commit(mut self, next: Option<Snapshot>) -> Result<()> {
        self.owner.check()?;
        let tx = self.tx.take().unwrap();
        let result = tx.execute_batch("COMMIT");
        drop(tx); // Ignore, including errors: COMMIT error is not rollback evidence.
        if let Err(e) = result {
            eprintln!("COMMIT unresolved: {e:?}");
            self.owner.uncertain.set(true);
            return Err(Error::Unresolved);
        }
        if let Some(next) = next {
            *self.owner.expected.borrow_mut() = next;
        }
        Ok(())
    }
    fn rollback(mut self) -> Result<()> {
        let tx = self.tx.take().unwrap();
        let result = tx.execute_batch("ROLLBACK");
        let ended = tx.is_autocommit();
        drop(tx);
        if result.is_err() || !ended {
            self.owner.uncertain.set(true);
            return Err(Error::Unresolved);
        }
        Ok(())
    }
}
impl Deref for Tx<'_, '_> {
    type Target = Connection;
    fn deref(&self) -> &Connection {
        self.tx.as_ref().unwrap()
    }
}
impl Drop for Tx<'_, '_> {
    fn drop(&mut self) {
        if let Some(tx) = self.tx.take() {
            if !tx.is_autocommit() && (tx.execute_batch("ROLLBACK").is_err() || !tx.is_autocommit())
            {
                self.owner.uncertain.set(true);
            }
        }
    }
}
pub struct Pending<'c, 'o> {
    tx: Tx<'c, 'o>,
    receipt: Receipt,
    next: Snapshot,
}
impl Pending<'_, '_> {
    pub fn commit(self) -> Result<Receipt> {
        self.tx.commit(Some(self.next))?;
        Ok(self.receipt)
    }
    pub fn rollback(self) -> Result<()> {
        self.tx.rollback()
    }
}
pub struct ReadHold<'c, 'o> {
    tx: Tx<'c, 'o>,
}
impl ReadHold<'_, '_> {
    pub fn release(self) -> Result<()> {
        self.tx.rollback()
    }
}
