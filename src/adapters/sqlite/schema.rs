//! Sole native SQL layout. Exact original frames remain authoritative with the witness.
//! The stored `materials` table and `material` column spellings belong to the unchanged (3,3,3)
//! format; source-level Content naming does not rename or migrate them.
use super::control::{Cut, Kind, Reader, Subject, Writer, FRAME};
use super::store_error::{StoreError, StoreResult};
use crate::kernel::change::OperationId;
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection};
use std::collections::BTreeMap;

const COMMON:&str = "
CREATE TABLE header (singleton INTEGER PRIMARY KEY CHECK(singleton=1), kind INTEGER NOT NULL CHECK(kind IN (0,1)), layout INTEGER NOT NULL CHECK(layout=1), codec INTEGER NOT NULL CHECK(codec=3), schema_version INTEGER NOT NULL CHECK(schema_version=3), semantic INTEGER NOT NULL CHECK(semantic=3), subject BLOB NOT NULL CHECK(length(subject)<=8192)) STRICT;
CREATE TABLE head (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL CHECK(revision>0), count INTEGER NOT NULL CHECK(count>=0), included INTEGER NOT NULL CHECK(included>=0 AND included<=count), last BLOB CHECK(last IS NULL OR length(last)=16)) STRICT;
";
const REGISTER:&str = "
CREATE TABLE entries (change BLOB PRIMARY KEY CHECK(length(change)=16 AND change!=zeroblob(16)), state INTEGER NOT NULL CHECK(state IN (0,1,2)), intent BLOB NOT NULL CHECK(length(intent)<=16785408), binding BLOB CHECK(binding IS NULL OR length(binding)=48), CHECK((state=0 AND binding IS NULL) OR (state>0 AND binding IS NOT NULL))) STRICT;
CREATE TABLE intent_integrity (change BLOB PRIMARY KEY REFERENCES entries(change), intent BLOB NOT NULL CHECK(length(intent)<=16785408)) STRICT;
CREATE TABLE receipts (change BLOB PRIMARY KEY REFERENCES entries(change), receipt BLOB NOT NULL CHECK(length(receipt)<=16785408)) STRICT;
CREATE TABLE receipt_integrity (change BLOB PRIMARY KEY REFERENCES entries(change), receipt BLOB NOT NULL CHECK(length(receipt)<=16785408)) STRICT;
";
const ORIGINAL:&str = "
CREATE TABLE records (operation BLOB PRIMARY KEY CHECK(length(operation)=16 AND operation!=zeroblob(16)), sequence INTEGER UNIQUE NOT NULL CHECK(sequence>0), predecessor BLOB REFERENCES records(operation), frame BLOB NOT NULL CHECK(length(frame)>8 AND length(frame)<=16777216), CHECK((sequence=1 AND predecessor IS NULL) OR (sequence>1 AND predecessor IS NOT NULL))) STRICT;
CREATE TABLE record_integrity (operation BLOB PRIMARY KEY REFERENCES records(operation), frame BLOB NOT NULL CHECK(length(frame)>8 AND length(frame)<=16777216)) STRICT;
CREATE TABLE requests (operation BLOB PRIMARY KEY REFERENCES records(operation), frame BLOB NOT NULL CHECK(length(frame)>8 AND length(frame)<=16777216)) STRICT;
CREATE TABLE request_integrity (operation BLOB PRIMARY KEY REFERENCES records(operation), frame BLOB NOT NULL CHECK(length(frame)>8 AND length(frame)<=16777216)) STRICT;
CREATE TABLE creations (kind INTEGER NOT NULL CHECK(kind BETWEEN 0 AND 7), identity BLOB NOT NULL CHECK(length(identity)=16 AND identity!=zeroblob(16)), operation BLOB NOT NULL REFERENCES records(operation), PRIMARY KEY(kind,identity)) STRICT;
CREATE TABLE materials (key BLOB PRIMARY KEY CHECK(length(key)=64), payload BLOB NOT NULL CHECK(length(payload)<=1048576)) STRICT;
CREATE TABLE establishments (key BLOB PRIMARY KEY REFERENCES materials(key), operation BLOB NOT NULL REFERENCES records(operation), fresh INTEGER NOT NULL CHECK(fresh IN (0,1)), source_record BLOB NOT NULL REFERENCES records(operation)) STRICT;
CREATE TABLE memberships (operation BLOB NOT NULL REFERENCES records(operation), material BLOB NOT NULL REFERENCES materials(key), intake INTEGER NOT NULL CHECK(intake IN (0,1,2)), PRIMARY KEY(operation,material)) STRICT;
CREATE TABLE grounds (ground BLOB NOT NULL CHECK(length(ground)=16), version BLOB NOT NULL CHECK(length(version)=16), PRIMARY KEY(ground,version)) STRICT;
CREATE TABLE record_grounds (operation BLOB NOT NULL REFERENCES records(operation), ground BLOB NOT NULL, version BLOB NOT NULL, PRIMARY KEY(operation,ground), FOREIGN KEY(ground,version) REFERENCES grounds(ground,version)) STRICT;
CREATE TABLE results (operation BLOB PRIMARY KEY REFERENCES records(operation), actor BLOB NOT NULL CHECK(length(actor)=16), owner BLOB NOT NULL CHECK(length(owner)=16), effect BLOB NOT NULL CHECK(length(effect)<=64), context BLOB NOT NULL CHECK(length(context)=16), used_grant BLOB CHECK(used_grant IS NULL OR length(used_grant)=24)) STRICT;
CREATE TABLE grant_events (operation BLOB PRIMARY KEY REFERENCES records(operation), identity BLOB NOT NULL CHECK(length(identity)=16), generation INTEGER NOT NULL CHECK(generation>0), revoked INTEGER NOT NULL CHECK(revoked IN (0,1)), UNIQUE(identity,generation)) STRICT;
CREATE TABLE activation (singleton INTEGER PRIMARY KEY CHECK(singleton=1), receipt BLOB NOT NULL CHECK(length(receipt)<=16785408)) STRICT;
CREATE TABLE activation_integrity (singleton INTEGER PRIMARY KEY CHECK(singleton=1), receipt BLOB NOT NULL CHECK(length(receipt)<=16785408)) STRICT;
";
pub(super) fn definitions(kind: Kind) -> BTreeMap<String, String> {
    let mut out = BTreeMap::new();
    for sql in [
        COMMON,
        if kind == Kind::Register {
            REGISTER
        } else {
            ORIGINAL
        },
    ]
    .into_iter()
    .flat_map(|s| s.split(';'))
    .map(str::trim)
    .filter(|s| !s.is_empty())
    {
        // Names here are fixed source literals, never names supplied by an input database.
        let name = sql.split_whitespace().nth(2).expect("fixed DDL table name");
        out.insert(name.to_owned(), sql.to_owned());
    }
    out
}
pub(super) fn initialize(connection: &Connection, subject: &Subject, cut: &Cut) -> StoreResult<()> {
    for sql in definitions(subject.kind).values() {
        connection.execute_batch(sql)?;
    }
    let mut w = Writer::new(8192);
    w.subject(subject)?;
    connection.execute(
        "INSERT INTO header VALUES(1,?1,1,3,3,3,?2)",
        params![
            if subject.kind == Kind::Register { 0 } else { 1 },
            w.finish()
        ],
    )?;
    connection.execute(
        "INSERT INTO head VALUES(1,?1,?2,?3,?4)",
        params![
            integer(cut.revision)?,
            integer(cut.count)?,
            integer(cut.included)?,
            cut.last.as_ref().map(|i| i.as_bytes().as_slice())
        ],
    )?;
    connection.pragma_update(None, "user_version", 1)?;
    Ok(())
}
pub(super) fn validate(connection: &Connection, subject: &Subject) -> StoreResult<Cut> {
    validate_inner(connection, subject, usize::MAX)
}
pub(super) fn validate_for_read(connection: &Connection, subject: &Subject) -> StoreResult<Cut> {
    validate_inner(connection, subject, definitions(subject.kind).len())
}
fn validate_inner(
    connection: &Connection,
    subject: &Subject,
    maximum_schema_entries: usize,
) -> StoreResult<Cut> {
    let version: i64 = connection.pragma_query_value(None, "user_version", |r| r.get(0))?;
    let mode: String = connection.pragma_query_value(None, "journal_mode", |r| r.get(0))?;
    if version != 1 || mode != "wal" {
        return Err(StoreError::UnsupportedProfile);
    }
    let mut actual = BTreeMap::new();
    let mut statement = connection.prepare(
        "SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
    )?;
    let mut rows = statement.query([])?;
    while let Some(row) = rows.next()? {
        if actual.len() >= maximum_schema_entries {
            return Err(StoreError::Limit);
        }
        let kind = text(row.get_ref(0)?, 16)?;
        let name = text(row.get_ref(1)?, 64)?;
        let sql = text(row.get_ref(2)?, 16384)?;
        if kind != "table" || actual.insert(name.to_owned(), sql.to_owned()).is_some() {
            return Err(StoreError::UnsupportedProfile);
        }
    }
    if actual != definitions(subject.kind) {
        return Err(StoreError::UnsupportedProfile);
    }
    let mut rows = connection.prepare(
        "SELECT kind,layout,codec,schema_version,semantic,subject FROM header WHERE singleton=1",
    )?;
    let mut rows = rows.query([])?;
    let row = rows.next()?.ok_or(StoreError::Corrupt)?;
    for (column, expected) in [
        (0, if subject.kind == Kind::Register { 0 } else { 1 }),
        (1, 1),
        (2, 3),
        (3, 3),
        (4, 3),
    ] {
        if row.get::<_, i64>(column)? != expected {
            return Err(StoreError::UnsupportedProfile);
        }
    }
    let bytes = blob(row.get_ref(5)?, 8192)?;
    let mut reader = Reader::new(bytes);
    let stored = reader.subject()?;
    reader.end()?;
    if &stored != subject || rows.next()?.is_some() {
        return Err(StoreError::Custody);
    }
    let integrity: String = connection.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if integrity != "ok" {
        return Err(StoreError::Corrupt);
    }
    if connection
        .prepare("PRAGMA foreign_key_check")?
        .query([])?
        .next()?
        .is_some()
    {
        return Err(StoreError::Corrupt);
    }
    head(connection)
}
pub(super) fn head(c: &Connection) -> StoreResult<Cut> {
    let mut stmt = c.prepare("SELECT revision,count,included,last FROM head WHERE singleton=1")?;
    let mut rows = stmt.query([])?;
    let row = rows.next()?.ok_or(StoreError::Corrupt)?;
    let last = optional_id(row.get_ref(3)?)?;
    let cut = Cut {
        revision: unsigned(row.get(0)?)?,
        count: unsigned(row.get(1)?)?,
        included: unsigned(row.get(2)?)?,
        last,
    };
    if rows.next()?.is_some() {
        return Err(StoreError::Corrupt);
    }
    Ok(cut)
}
pub(super) fn set_head(c: &Connection, cut: &Cut) -> StoreResult<()> {
    if c.execute(
        "UPDATE head SET revision=?1,count=?2,included=?3,last=?4 WHERE singleton=1",
        params![
            integer(cut.revision)?,
            integer(cut.count)?,
            integer(cut.included)?,
            cut.last.as_ref().map(|i| i.as_bytes().as_slice())
        ],
    )? != 1
    {
        return Err(StoreError::Corrupt);
    }
    Ok(())
}
pub(super) fn integer(v: u64) -> StoreResult<i64> {
    i64::try_from(v).map_err(|_| StoreError::Limit)
}
pub(super) fn unsigned(v: i64) -> StoreResult<u64> {
    u64::try_from(v).map_err(|_| StoreError::Corrupt)
}
pub(super) fn blob(v: ValueRef<'_>, max: usize) -> StoreResult<&[u8]> {
    match v {
        ValueRef::Blob(b) if b.len() <= max => Ok(b),
        ValueRef::Blob(_) => Err(StoreError::Limit),
        _ => Err(StoreError::Corrupt),
    }
}
fn text(v: ValueRef<'_>, max: usize) -> StoreResult<&str> {
    match v {
        ValueRef::Text(b) if b.len() <= max => {
            std::str::from_utf8(b).map_err(|_| StoreError::Corrupt)
        }
        _ => Err(StoreError::Corrupt),
    }
}
pub(super) fn optional_id(v: ValueRef<'_>) -> StoreResult<Option<OperationId>> {
    match v {
        ValueRef::Null => Ok(None),
        other => Ok(Some(OperationId::from_bytes(
            blob(other, 16)?
                .try_into()
                .map_err(|_| StoreError::Corrupt)?,
        )?)),
    }
}
pub(super) fn paired(
    c: &Connection,
    table: &str,
    integrity: &str,
    key: &[u8],
    max: usize,
) -> StoreResult<Option<Vec<u8>>> {
    // Only private fixed source table names reach this helper.
    let a = read_blob(c, table, key, max)?;
    let b = read_blob(c, integrity, key, max)?;
    if a != b {
        return Err(StoreError::Corrupt);
    }
    Ok(a)
}
fn read_blob(c: &Connection, table: &str, key: &[u8], max: usize) -> StoreResult<Option<Vec<u8>>> {
    let (column, k) = match table {
        "requests" | "request_integrity" | "records" | "record_integrity" => ("frame", "operation"),
        "entries" | "intent_integrity" => ("intent", "change"),
        "receipts" | "receipt_integrity" => ("receipt", "change"),
        _ => return Err(StoreError::Corrupt),
    };
    let sql = format!("SELECT {column} FROM {table} WHERE {k}=?1");
    let mut stmt = c.prepare(&sql)?;
    let mut rows = stmt.query([key])?;
    match rows.next()? {
        None => Ok(None),
        Some(row) => Ok(Some(blob(row.get_ref(0)?, max)?.to_vec())),
    }
}
pub(super) fn limits(c: &Connection) -> StoreResult<()> {
    use rusqlite::limits::Limit;
    c.set_limit(Limit::SQLITE_LIMIT_LENGTH, (FRAME + 65536) as i32)?;
    c.set_limit(Limit::SQLITE_LIMIT_SQL_LENGTH, 65536)?;
    Ok(())
}
