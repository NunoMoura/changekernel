//! Shared schema selection, genesis custody and transaction-local intent guards.
use super::container_intake::{authorized_receipt, SqliteIntake};
use crate::{
    kernel::{
        changes::intent::{self, IntentRevision, MAX_INTENT_REVISIONS},
        containers::intake::{Issue, Receipt, Result},
    },
    ports::continuation::ContinuationStore,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::collections::HashSet;

pub(super) const VERSION: &str = "changekernel.native-continuation.sqlite@1";

pub(super) fn extra_schema() -> impl Iterator<Item = (&'static str, &'static str)> {
    super::intent::SCHEMA
        .into_iter()
        .chain(super::file_candidate::SCHEMA)
}

/// Caller owns the surrounding write transaction. Never upsert missing custody.
pub(super) fn insert_revision(db: &Connection, revision: &IntentRevision) -> Result<()> {
    intent::validate_record(revision)?;
    db.execute(
        "INSERT INTO ck_native_intent_revisions VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            revision.container_id,
            revision.change_id,
            revision.revision_id,
            revision.previous_revision,
            revision.request_id,
            revision.actor,
            revision.what,
            revision.why,
        ],
    )
    .map_err(|_| Issue::Unavailable)?;
    Ok(())
}

pub(super) fn has_artifacts(db: &Connection, container: &str, change: &str) -> Result<bool> {
    db.query_row(
        "SELECT EXISTS (SELECT 1 FROM ck_native_intent_revisions WHERE container_id = ?1 AND change_id = ?2 UNION ALL SELECT 1 FROM ck_native_intent_heads WHERE container_id = ?1 AND change_id = ?2 UNION ALL SELECT 1 FROM ck_native_intent_retries WHERE container_id = ?1 AND change_id = ?2 UNION ALL SELECT 1 FROM ck_native_file_candidates WHERE container_id = ?1 AND change_id = ?2 UNION ALL SELECT 1 FROM ck_native_file_candidate_retries WHERE container_id = ?1 AND change_id = ?2)",
        params![container, change], |row| row.get(0),
    ).map_err(|_| Issue::Unavailable)
}

pub(super) fn seed(db: &Connection, receipt: &Receipt) -> Result<()> {
    if has_artifacts(db, &receipt.container_id, &receipt.change_id)? {
        return Err(Issue::Unavailable);
    }
    let revision = intent::origin(receipt);
    insert_revision(db, &revision)?;
    db.execute(
        "INSERT INTO ck_native_intent_heads VALUES (?1, ?2, ?3)",
        params![
            revision.container_id,
            revision.change_id,
            revision.revision_id
        ],
    )
    .map_err(|_| Issue::Unavailable)?;
    Ok(())
}

fn revision_row(
    db: &Connection,
    container: &str,
    change: &str,
    revision: &str,
) -> Result<IntentRevision> {
    // Bound text before allocating it from a damaged store. Original intake is separately checked.
    let row = db.query_row(
        "SELECT container_id, change_id, revision_id, previous_revision, request_id, actor, what_text, why_text FROM ck_native_intent_revisions WHERE container_id = ?1 AND change_id = ?2 AND revision_id = ?3 AND length(CAST(actor AS BLOB)) <= 256 AND (request_id IS NULL OR length(CAST(request_id AS BLOB)) <= 256) AND (previous_revision IS NULL OR length(CAST(previous_revision AS BLOB)) = 64) AND length(CAST(what_text AS BLOB)) <= 65536 AND (why_text IS NULL OR length(CAST(why_text AS BLOB)) <= 65536)",
        params![container, change, revision], |r| Ok(IntentRevision {
            container_id: r.get(0)?, change_id: r.get(1)?, revision_id: r.get(2)?,
            previous_revision: r.get(3)?, request_id: r.get(4)?, actor: r.get(5)?, what: r.get(6)?, why: r.get(7)?,
        }),
    ).optional().map_err(|_| Issue::Unavailable)?.ok_or(Issue::Unavailable)?;
    intent::validate_record(&row)?;
    Ok(row)
}

/// Call inside one read/write transaction so lineage and retry checks see one snapshot.
/// Complete history is bounded to MAX_INTENT_REVISIONS; no synthesized missing origin/head.
pub(super) fn load_intent(
    db: &Connection,
    container: &str,
    change: &str,
    selected: Option<&str>,
    actor: &str,
) -> Result<IntentRevision> {
    let original = authorized_receipt(db, container, change, actor, true)?;
    let origin = intent::origin(&original);
    let head: String = db.query_row("SELECT revision_id FROM ck_native_intent_heads WHERE container_id = ?1 AND change_id = ?2 AND length(CAST(revision_id AS BLOB)) = 64", params![container, change], |r| r.get(0))
        .map_err(|_| Issue::Unavailable)?;
    let target = selected.unwrap_or(&head);
    let mut current = head.clone();
    let mut seen = HashSet::new();
    let mut result = None;
    loop {
        if seen.len() >= MAX_INTENT_REVISIONS
            || !intent::valid_digest(&current)
            || !seen.insert(current.clone())
        {
            return Err(Issue::Unavailable);
        }
        let row = revision_row(db, container, change, &current)?;
        if row.container_id != container || row.change_id != change || row.actor != original.actor {
            return Err(Issue::Unavailable);
        }
        if current == target {
            result = Some(row.clone());
        }
        match (&row.previous_revision, &row.request_id) {
            (None, None) => {
                if row != origin {
                    return Err(Issue::Unavailable);
                }
                break;
            }
            (Some(previous), Some(request)) => {
                let matched: bool = db.query_row("SELECT EXISTS (SELECT 1 FROM ck_native_intent_retries WHERE container_id = ?1 AND actor = ?2 AND request_id = ?3 AND change_id = ?4 AND revision_id = ?5)", params![container, actor, request, change, current], |r| r.get(0))
                    .map_err(|_| Issue::Unavailable)?;
                if !matched {
                    return Err(Issue::Unavailable);
                }
                current = previous.clone();
            }
            _ => return Err(Issue::Unavailable),
        }
    }
    let (revisions, retries): (i64, i64) = db.query_row(
        "SELECT (SELECT count(*) FROM ck_native_intent_revisions WHERE container_id = ?1 AND change_id = ?2), (SELECT count(*) FROM ck_native_intent_retries WHERE container_id = ?1 AND change_id = ?2)", params![container, change], |r| Ok((r.get(0)?, r.get(1)?)),
    ).map_err(|_| Issue::Unavailable)?;
    if revisions != seen.len() as i64 || retries != seen.len() as i64 - 1 {
        return Err(Issue::Unavailable);
    }
    result.ok_or(Issue::Unavailable)
}

/// The candidate writer and revision writer both call this inside their IMMEDIATE transaction.
pub(super) fn guard_head(
    db: &Connection,
    container: &str,
    change: &str,
    expected: &str,
    actor: &str,
) -> Result<IntentRevision> {
    let head = load_intent(db, container, change, None, actor)?;
    if head.revision_id != expected {
        return Err(Issue::Conflict);
    }
    Ok(head)
}

impl ContinuationStore for SqliteIntake {
    fn intent_revision(
        &self,
        container: &str,
        change: &str,
        revision: Option<&str>,
        actor: &str,
    ) -> Result<IntentRevision> {
        self.require_continuation()?;
        let tx = self
            .db
            .unchecked_transaction()
            .map_err(|_| Issue::Unavailable)?;
        let value = load_intent(&tx, container, change, revision, actor)?;
        tx.commit().map_err(|_| Issue::Unavailable)?;
        Ok(value)
    }
    fn check_intent_head(
        &self,
        container: &str,
        change: &str,
        expected: &str,
        actor: &str,
    ) -> Result<IntentRevision> {
        self.require_continuation()?;
        let tx = self
            .db
            .unchecked_transaction()
            .map_err(|_| Issue::Unavailable)?;
        let value = guard_head(&tx, container, change, expected, actor)?;
        tx.commit().map_err(|_| Issue::Unavailable)?;
        Ok(value)
    }
}
