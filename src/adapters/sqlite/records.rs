//! Original-byte verification and redundant normalized controls; no live kernel execution.
use super::control::{Cut, Writer, FRAME};
use super::schema;
use super::store_error::{StoreError, StoreResult};
use crate::adapters::codec;
use crate::application::change::Change;
use crate::application::operation_request::CURRENT_PROFILE;
use crate::application::read_budget::ReadBudget;
use crate::application::records::{CreatedIdentity, HistoryHead, StoredOperation};
use crate::kernel::change::{
    Command, ContentEstablishment, ContentKey, ContentReference, Effect, GrantUse, Identity,
    IntakeCase, OperationId, RecordedContent, Settlement,
};
use rusqlite::types::ValueRef;
use rusqlite::{params, Connection};
use std::collections::{BTreeMap, BTreeSet};

pub(super) struct Retained {
    pub bytes: Vec<u8>,
    pub establishment: ContentEstablishment,
    pub fresh: Option<RecordedContent>,
}
pub(super) type Catalog = BTreeMap<ContentKey, Retained>;
pub(super) struct History {
    pub records: Vec<StoredOperation>,
    pub public_sizes: BTreeMap<OperationId, usize>,
    pub requests: BTreeMap<OperationId, Vec<u8>>,
    pub pursuit: Change,
    pub catalog: Catalog,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
enum Cell {
    Null,
    Int(i64),
    Bytes(Vec<u8>),
}
type Controls = BTreeMap<&'static str, BTreeSet<Vec<Cell>>>;
const TABLES: [&str; 8] = [
    "creations",
    "materials",
    "establishments",
    "memberships",
    "grounds",
    "record_grounds",
    "results",
    "grant_events",
];
fn b(v: &[u8]) -> Cell {
    Cell::Bytes(v.to_vec())
}
fn i(v: u64) -> StoreResult<Cell> {
    Ok(Cell::Int(schema::integer(v)?))
}
fn put(out: &mut Controls, table: &'static str, row: Vec<Cell>) -> StoreResult<()> {
    if !out.get_mut(table).ok_or(StoreError::Corrupt)?.insert(row) {
        return Err(StoreError::Corrupt);
    }
    Ok(())
}
pub(super) fn key(k: &ContentKey) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(64);
    for part in [
        k.establishing.owner.as_bytes(),
        k.establishing.ledger.as_bytes(),
        k.establishing.change.as_bytes(),
        k.id.as_bytes(),
    ] {
        bytes.extend_from_slice(part)
    }
    bytes
}
fn grant(g: &GrantUse) -> StoreResult<Vec<u8>> {
    let mut w = Writer::new(24);
    w.raw(g.id.as_bytes())?;
    w.u64(g.generation)?;
    Ok(w.finish())
}
fn effect(e: &Effect) -> StoreResult<Vec<u8>> {
    let mut w = Writer::new(64);
    match e {
        Effect::Initiated => w.byte(0)?,
        Effect::Proposed(id) => {
            w.byte(1)?;
            w.raw(id.as_bytes())?
        }
        Effect::Assessed(id) => {
            w.byte(2)?;
            w.raw(id.as_bytes())?
        }
        Effect::Decision {
            decision,
            activated,
        }
        | Effect::Reaffirmed {
            decision,
            activated,
        } => {
            w.byte(if matches!(e, Effect::Decision { .. }) {
                3
            } else {
                5
            })?;
            w.raw(decision.as_bytes())?;
            match activated {
                None => w.byte(0)?,
                Some(id) => {
                    w.byte(1)?;
                    w.raw(id.as_bytes())?
                }
            }
        }
        Effect::Retracted(id) => {
            w.byte(4)?;
            w.raw(id.as_bytes())?
        }
        Effect::Grant(g) | Effect::Revoked(g) => {
            w.byte(if matches!(e, Effect::Grant(_)) { 6 } else { 7 })?;
            w.raw(&grant(g)?)?
        }
        Effect::Admitted(id) | Effect::Dispatched(id) | Effect::Reconciled(id) => {
            w.byte(match e {
                Effect::Admitted(_) => 8,
                Effect::Dispatched(_) => 9,
                _ => 12,
            })?;
            w.raw(id.as_bytes())?
        }
        Effect::Recorded => w.byte(10)?,
        Effect::Settled(s) => {
            w.byte(11)?;
            match s {
                Settlement::Withdrawn => w.byte(0)?,
                Settlement::Fulfilled(id) => {
                    w.byte(1)?;
                    w.raw(id.as_bytes())?
                }
            }
        }
    }
    Ok(w.finish())
}
fn creation(c: &CreatedIdentity) -> (i64, &[u8; 16]) {
    match c {
        CreatedIdentity::Operation(id) => (0, id.as_bytes()),
        CreatedIdentity::Proposal(id) => (1, id.as_bytes()),
        CreatedIdentity::Agreement(id) => (2, id.as_bytes()),
        CreatedIdentity::Assessment(id) => (3, id.as_bytes()),
        CreatedIdentity::Decision(id) => (4, id.as_bytes()),
        CreatedIdentity::Grant(id) => (5, id.as_bytes()),
        CreatedIdentity::Action(id) => (6, id.as_bytes()),
        CreatedIdentity::Criterion(id) => (7, id.as_bytes()),
    }
}
fn controls(records: &[StoredOperation]) -> StoreResult<(Controls, Catalog)> {
    let mut out: Controls = TABLES.into_iter().map(|t| (t, BTreeSet::new())).collect();
    let mut catalog = Catalog::new();
    let mut content_bytes: BTreeMap<ContentKey, Vec<u8>> = BTreeMap::new();
    for record in records {
        let op = record.operation.id.as_bytes();
        for c in &record.creations {
            let (kind, id) = creation(c);
            put(&mut out, "creations", vec![Cell::Int(kind), b(id), b(op)])?;
        }
        for (k, bytes) in &record.checks.content_items {
            if let Some(old) = content_bytes.get(k) {
                if old != bytes {
                    return Err(StoreError::Corrupt);
                }
            } else {
                content_bytes.insert(k.clone(), bytes.clone());
            }
            let snapshot = record.checks.intakes.get(k).ok_or(StoreError::Corrupt)?;
            let case = match snapshot.case {
                IntakeCase::Fresh => 0,
                IntakeCase::FirstRetention => 1,
                IntakeCase::KnownReuse => 2,
            };
            put(
                &mut out,
                "memberships",
                vec![b(op), b(&key(k)), Cell::Int(case)],
            )?;
        }
        for k in &record.establishments {
            let snapshot = record.checks.intakes.get(k).ok_or(StoreError::Corrupt)?;
            put(
                &mut out,
                "establishments",
                vec![
                    b(&key(k)),
                    b(op),
                    Cell::Int(i64::from(snapshot.case == IntakeCase::Fresh)),
                    b(op),
                ],
            )?;
            let establishment = ContentEstablishment {
                binding: ContentReference {
                    identity: record.checks.identity.clone(),
                    operation: record.operation.id.clone(),
                    content: k.clone(),
                },
                original: snapshot.clone(),
                recorder: record.accepted.actor.clone(),
                represented_owner: record.accepted.represented_owner.clone(),
                grant: record.used_grant.clone(),
                target: record
                    .grant_snapshot
                    .as_ref()
                    .map(|g| g.spec.target.clone()),
            };
            let retained = Retained {
                bytes: record
                    .checks
                    .content_items
                    .get(k)
                    .ok_or(StoreError::Corrupt)?
                    .clone(),
                establishment,
                fresh: record
                    .checks
                    .creation
                    .as_ref()
                    .and_then(|c| c.content_items.get(k))
                    .cloned(),
            };
            if catalog.insert(k.clone(), retained).is_some() {
                return Err(StoreError::Corrupt);
            }
        }
        for (g, v) in &record.checks.grounds {
            out.get_mut("grounds")
                .ok_or(StoreError::Corrupt)?
                .insert(vec![b(g.as_bytes()), b(v.as_bytes())]);
            put(
                &mut out,
                "record_grounds",
                vec![b(op), b(g.as_bytes()), b(v.as_bytes())],
            )?;
        }
        put(
            &mut out,
            "results",
            vec![
                b(op),
                b(record.accepted.actor.as_bytes()),
                b(record.accepted.represented_owner.as_bytes()),
                b(&effect(&record.accepted.effect)?),
                b(record.checks.context.version.as_bytes()),
                match &record.used_grant {
                    None => Cell::Null,
                    Some(g) => b(&grant(g)?),
                },
            ],
        )?;
        match &record.accepted.effect {
            Effect::Grant(g) | Effect::Revoked(g) => put(
                &mut out,
                "grant_events",
                vec![
                    b(op),
                    b(g.id.as_bytes()),
                    i(g.generation)?,
                    Cell::Int(i64::from(matches!(
                        record.accepted.effect,
                        Effect::Revoked(_)
                    ))),
                ],
            )?,
            _ => {}
        }
    }
    for (k, bytes) in content_bytes {
        put(&mut out, "materials", vec![b(&key(&k)), b(&bytes)])?;
    }
    Ok((out, catalog))
}
fn actual_controls(c: &Connection) -> StoreResult<Controls> {
    let mut out = Controls::new();
    for table in TABLES {
        let mut values = BTreeSet::new();
        let mut statement = c.prepare(&format!("SELECT * FROM {table}"))?;
        let columns = statement.column_count();
        let mut rows = statement.query([])?;
        while let Some(row) = rows.next()? {
            let mut cells = Vec::new();
            for column in 0..columns {
                cells.push(match row.get_ref(column)? {
                    ValueRef::Null => Cell::Null,
                    ValueRef::Integer(v) => Cell::Int(v),
                    ValueRef::Blob(bytes) => b(schema::blob(
                        ValueRef::Blob(bytes),
                        if table == "materials" && column == 1 {
                            1024 * 1024
                        } else {
                            64
                        },
                    )?),
                    _ => return Err(StoreError::Corrupt),
                });
            }
            if !values.insert(cells) {
                return Err(StoreError::Corrupt);
            }
        }
        out.insert(table, values);
    }
    Ok(out)
}
pub(super) fn load(c: &Connection, identity: &Identity, cut: &Cut) -> StoreResult<History> {
    load_inner(c, identity, cut, VerificationMode::Ordinary, None)
}
#[derive(Clone, Copy)]
enum VerificationMode {
    Ordinary,
    Read,
}
pub(super) fn load_bounded(
    c: &Connection,
    identity: &Identity,
    cut: &Cut,
    budget: &mut ReadBudget,
) -> StoreResult<History> {
    read_preflight(c, cut)?;
    load_inner(c, identity, cut, VerificationMode::Read, Some(budget))
}
fn read_preflight(c: &Connection, cut: &Cut) -> StoreResult<()> {
    if cut.count > 256 {
        return Err(StoreError::Limit);
    }
    // SQLite's native read budget is installed by the caller before these queries. Count
    // and length preflight precedes pair copying, protobuf decode and reconstruction.
    for table in [
        "records",
        "record_integrity",
        "requests",
        "request_integrity",
    ] {
        let mut statement = c.prepare(&format!("SELECT length(frame) FROM {table} LIMIT 257"))?;
        let mut rows = statement.query([])?;
        let mut count = 0usize;
        let mut bytes = 0usize;
        while let Some(row) = rows.next()? {
            count += 1;
            let size = usize::try_from(row.get::<_, i64>(0)?).map_err(|_| StoreError::Corrupt)?;
            bytes = bytes.checked_add(size).ok_or(StoreError::Limit)?;
            if count > 256 || size > FRAME || bytes > 32 * 1024 * 1024 {
                return Err(StoreError::Limit);
            }
        }
    }
    let mut controls = 0u64;
    for table in TABLES {
        let count: i64 = c.query_row(
            &format!("SELECT count(*) FROM (SELECT 1 FROM {table} LIMIT 16385)"),
            [],
            |row| row.get(0),
        )?;
        controls = controls
            .checked_add(schema::unsigned(count)?)
            .ok_or(StoreError::Limit)?;
        if controls > 16384 {
            return Err(StoreError::Limit);
        }
    }
    Ok(())
}
fn load_inner(
    c: &Connection,
    identity: &Identity,
    cut: &Cut,
    mode: VerificationMode,
    mut budget: Option<&mut ReadBudget>,
) -> StoreResult<History> {
    let mut representation_cost = 0u64;
    let mut historical_copy_passes = 0u64;
    let mut expected_controls = 0usize;
    let mut records = Vec::new();
    let mut public_sizes = BTreeMap::new();
    let mut requests = BTreeMap::new();
    let mut last = None;
    let mut count = 0u64;
    let mut stmt =
        c.prepare("SELECT operation,sequence,predecessor FROM records ORDER BY sequence")?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        count = count.checked_add(1).ok_or(StoreError::Corrupt)?;
        if count > cut.count
            || schema::unsigned(row.get(1)?)? != count
            || schema::optional_id(row.get_ref(2)?)? != last
        {
            return Err(StoreError::Corrupt);
        }
        let op = OperationId::from_bytes(
            schema::blob(row.get_ref(0)?, 16)?
                .try_into()
                .map_err(|_| StoreError::Corrupt)?,
        )?;
        let raw = schema::paired(c, "records", "record_integrity", op.as_bytes(), FRAME)?
            .ok_or(StoreError::Corrupt)?;
        let request = schema::paired(c, "requests", "request_integrity", op.as_bytes(), FRAME)?
            .ok_or(StoreError::Corrupt)?;
        if let Some(b) = &mut budget {
            let a = codec::record_read_cost(&raw, b).map_err(|error| {
                if error == codec::CodecError::Limit {
                    StoreError::Limit
                } else {
                    StoreError::Corrupt
                }
            })?;
            let q = codec::request_read_cost(&request, b).map_err(|error| {
                if error == codec::CodecError::Limit {
                    StoreError::Limit
                } else {
                    StoreError::Corrupt
                }
            })?;
            representation_cost = representation_cost
                .checked_add(a)
                .and_then(|n| n.checked_add(q))
                .ok_or(StoreError::Limit)?;
        }
        let record = codec::decode_record(&raw).map_err(|_| StoreError::Corrupt)?;
        if matches!(mode, VerificationMode::Read) {
            // SetGrant clones keys explicitly in its current spec/checks, but origin/reuse
            // validation only borrows historical state; it does not implicitly expand history.
            // RevokeGrant likewise borrows prior state. Own-data copies on validation/failure
            // and transition paths are in eight fixed passes. Others reserve full history.
            if !matches!(
                &record.operation.command,
                Command::SetGrant { .. } | Command::RevokeGrant { .. }
            ) {
                historical_copy_passes = historical_copy_passes
                    .checked_add(1)
                    .ok_or(StoreError::Limit)?;
            }
            let cost = 2
                + record.creations.len()
                + 2 * record.checks.content_items.len()
                + record.establishments.len()
                + 2 * record.checks.grounds.len();
            expected_controls = expected_controls
                .checked_add(cost)
                .ok_or(StoreError::Limit)?;
            if expected_controls > 16384 {
                return Err(StoreError::Limit);
            }
        }
        let operation_request = codec::decode_request(&request).map_err(|_| StoreError::Corrupt)?;
        if record.sequence != count
            || record.operation.id != op
            || record.checks.expected_operation != last
            || record.operation_request()? != operation_request
            || operation_request.target != identity.change_key()
        {
            return Err(StoreError::Corrupt);
        }
        if matches!(mode, VerificationMode::Read) {
            public_sizes.insert(
                op.clone(),
                codec::public_record_weight(&raw).map_err(|_| StoreError::Corrupt)?,
            );
        }
        requests.insert(op.clone(), request);
        last = Some(op);
        records.push(record);
    }
    if count != cut.count || last != cut.last {
        return Err(StoreError::Corrupt);
    }
    for table in ["record_integrity", "requests", "request_integrity"] {
        let total: i64 = c.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))?;
        if schema::unsigned(total)? != count {
            return Err(StoreError::Corrupt);
        }
    }
    if let Some(b) = &mut budget {
        // Prefix/state/catalog/control and per-record own-data copies need eight passes.
        // Only potentially history-expanding commands add a full-history allocation pass;
        // work still reserves every record's possible history scan. Sixteen slots cover
        // underfull B-tree nodes and Vec growth; this does not lower object/byte costs.
        let allocation_passes = historical_copy_passes
            .checked_add(8)
            .ok_or(StoreError::Limit)?;
        let passes = cut.count.checked_add(8).ok_or(StoreError::Limit)?;
        b.allocate(
            representation_cost
                .checked_mul(allocation_passes)
                .and_then(|n| n.checked_mul(16))
                .ok_or(StoreError::Limit)?,
        )?;
        b.work(
            representation_cost
                .checked_mul(passes)
                .ok_or(StoreError::Limit)?,
        )?;
    }
    let pursuit = Change::reconstruct(
        HistoryHead {
            profile: CURRENT_PROFILE,
            identity: identity.clone(),
            accepted_operations: cut.count,
            last_operation: cut.last.clone(),
        },
        records.clone(),
    )?;
    let (expected, catalog) = controls(&records)?;
    if actual_controls(c)? != expected {
        return Err(StoreError::Corrupt);
    }
    Ok(History {
        records,
        public_sizes,
        requests,
        pursuit,
        catalog,
    })
}
pub(super) struct PreparedRecord<'a> {
    record: &'a StoredOperation,
    request: &'a [u8],
    frame: Vec<u8>,
    added: Vec<(&'static str, Vec<Cell>)>,
    catalog: Catalog,
}
pub(super) fn prepare<'a>(
    record: &'a StoredOperation,
    request: &'a [u8],
    prefix: &[StoredOperation],
) -> StoreResult<PreparedRecord<'a>> {
    if codec::decode_request(request).map_err(|_| StoreError::Corrupt)?
        != record.operation_request()?
    {
        return Err(StoreError::Corrupt);
    }
    let frame = codec::encode_record(record).map_err(|_| StoreError::Limit)?;
    let (before, _) = controls(prefix)?;
    let mut all = prefix.to_vec();
    all.push(record.clone());
    let (after, catalog) = controls(&all)?;
    let mut added = Vec::new();
    for table in TABLES {
        for row in after
            .get(table)
            .ok_or(StoreError::Corrupt)?
            .difference(before.get(table).ok_or(StoreError::Corrupt)?)
        {
            added.push((table, row.clone()));
        }
    }
    Ok(PreparedRecord {
        record,
        request,
        frame,
        added,
        catalog,
    })
}
impl PreparedRecord<'_> {
    pub fn into_catalog(self) -> Catalog {
        self.catalog
    }
}
pub(super) fn append(c: &Connection, prepared: &PreparedRecord<'_>) -> StoreResult<()> {
    let record = prepared.record;
    let raw_request = prepared.request;
    let frame = &prepared.frame;
    let id = record.operation.id.as_bytes();
    c.execute(
        "INSERT INTO records VALUES(?1,?2,?3,?4)",
        params![
            id.as_slice(),
            schema::integer(record.sequence)?,
            record
                .checks
                .expected_operation
                .as_ref()
                .map(|i| i.as_bytes().as_slice()),
            frame
        ],
    )?;
    c.execute(
        "INSERT INTO record_integrity VALUES(?1,?2)",
        params![id.as_slice(), frame],
    )?;
    c.execute(
        "INSERT INTO requests VALUES(?1,?2)",
        params![id.as_slice(), raw_request],
    )?;
    c.execute(
        "INSERT INTO request_integrity VALUES(?1,?2)",
        params![id.as_slice(), raw_request],
    )?;
    // The size-proportional derivation happened before the final guard/SQL write cut.
    // Insert only new controls. Existing accepted rows are never deleted/rebuilt/repaired.
    for (table, row) in &prepared.added {
        let values: Vec<rusqlite::types::Value> = row
            .iter()
            .map(|v| match v {
                Cell::Null => rusqlite::types::Value::Null,
                Cell::Int(v) => rusqlite::types::Value::Integer(*v),
                Cell::Bytes(v) => rusqlite::types::Value::Blob(v.clone()),
            })
            .collect();
        let slots = (1..=row.len())
            .map(|i| format!("?{i}"))
            .collect::<Vec<_>>()
            .join(",");
        c.execute(
            &format!("INSERT INTO {table} VALUES({slots})"),
            rusqlite::params_from_iter(values),
        )?;
    }
    Ok(())
}
