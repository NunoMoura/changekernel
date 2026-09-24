//! Private intent revisions in the explicit continuation profile.
use super::{container_intake::SqliteIntake, continuation};
use crate::{
    kernel::{
        changes::intent::{IntentRevision, IntentRevisionRequest, MAX_INTENT_REVISIONS},
        containers::intake::{Issue, Result},
    },
    ports::continuation::IntentRevisionStore,
};
use rusqlite::{params_from_iter, OptionalExtension, TransactionBehavior};
pub(super) const SCHEMA: [(&str, &str); 3] = [
    ("ck_native_intent_revisions", "CREATE TABLE ck_native_intent_revisions (container_id TEXT NOT NULL, change_id TEXT NOT NULL, revision_id TEXT NOT NULL, previous_revision TEXT, request_id TEXT, actor TEXT NOT NULL, what_text TEXT NOT NULL, why_text TEXT, PRIMARY KEY (container_id, change_id, revision_id), UNIQUE (container_id, actor, request_id), FOREIGN KEY (container_id, change_id) REFERENCES ck_native_changes(container_id, change_id), FOREIGN KEY (container_id, change_id, previous_revision) REFERENCES ck_native_intent_revisions(container_id, change_id, revision_id))"),
    ("ck_native_intent_heads", "CREATE TABLE ck_native_intent_heads (container_id TEXT NOT NULL, change_id TEXT NOT NULL, revision_id TEXT NOT NULL, PRIMARY KEY (container_id, change_id), FOREIGN KEY (container_id, change_id, revision_id) REFERENCES ck_native_intent_revisions(container_id, change_id, revision_id))"),
    ("ck_native_intent_retries", "CREATE TABLE ck_native_intent_retries (container_id TEXT NOT NULL, actor TEXT NOT NULL, request_id TEXT NOT NULL, change_id TEXT NOT NULL, revision_id TEXT NOT NULL, PRIMARY KEY (container_id, actor, request_id), UNIQUE (container_id, change_id, revision_id), FOREIGN KEY (container_id, change_id, revision_id) REFERENCES ck_native_intent_revisions(container_id, change_id, revision_id))"),
];

impl IntentRevisionStore for SqliteIntake {
    fn revise_intent(
        &mut self,
        request: &IntentRevisionRequest,
        actor: &str,
    ) -> Result<IntentRevision> {
        self.require_continuation()?;
        let proposed = IntentRevision::successor(request, actor)?;
        let tx = self
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| Issue::Unavailable)?;
        // Recheck owner and the entire retained chain within this write snapshot, even for retries.
        continuation::load_intent(&tx, &request.container_id, &request.change_id, None, actor)?;
        let bound: Option<(String, String)> = tx
            .query_row(
                "SELECT change_id, revision_id FROM ck_native_intent_retries WHERE container_id = ?1 AND actor = ?2 AND request_id = ?3",
                params_from_iter([request.container_id.as_str(), actor, request.request_id.as_str()]),
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|_| Issue::Unavailable)?;
        if let Some((change, revision)) = bound {
            // Verify the binding's own chain before reporting a conflict or returning custody.
            let retained = continuation::load_intent(
                &tx,
                &request.container_id,
                &change,
                Some(&revision),
                actor,
            )?;
            return if change != request.change_id || retained != proposed {
                Err(Issue::Conflict)
            } else {
                Ok(retained)
            };
        }
        // A surviving revision with a lost retry is not a fresh operation (even if it
        // belongs to another Change in the same container).
        let orphan: bool = tx
            .query_row(
                "SELECT EXISTS (SELECT 1 FROM ck_native_intent_revisions WHERE container_id = ?1 AND actor = ?2 AND request_id = ?3)",
                params_from_iter([request.container_id.as_str(), actor, request.request_id.as_str()]),
                |r| r.get(0),
            )
            .map_err(|_| Issue::Unavailable)?;
        if orphan {
            return Err(Issue::Unavailable);
        }
        // Retry lookup precedes both new-append conditions. guard_head repeats the shared
        // ownership and full-history verification inside this IMMEDIATE transaction.
        continuation::guard_head(
            &tx,
            &request.container_id,
            &request.change_id,
            &request.expected_revision,
            actor,
        )?;
        let size: i64 = tx
            .query_row(
                "SELECT count(*) FROM ck_native_intent_revisions WHERE container_id = ?1 AND change_id = ?2",
                params_from_iter([request.container_id.as_str(), request.change_id.as_str()]),
                |r| r.get(0),
            )
            .map_err(|_| Issue::Unavailable)?;
        if size >= MAX_INTENT_REVISIONS as i64 {
            return Err(Issue::Unavailable);
        }
        continuation::insert_revision(&tx, &proposed)?;
        tx.execute(
            "INSERT INTO ck_native_intent_retries VALUES (?1, ?2, ?3, ?4, ?5)",
            params_from_iter([
                request.container_id.as_str(),
                actor,
                request.request_id.as_str(),
                request.change_id.as_str(),
                proposed.revision_id.as_str(),
            ]),
        )
        .map_err(|_| Issue::Unavailable)?;
        let advanced = tx
            .execute(
                "UPDATE ck_native_intent_heads SET revision_id = ?1 WHERE container_id = ?2 AND change_id = ?3 AND revision_id = ?4",
                params_from_iter([
                    proposed.revision_id.as_str(),
                    request.container_id.as_str(),
                    request.change_id.as_str(),
                    request.expected_revision.as_str(),
                ]),
            )
            .map_err(|_| Issue::Unavailable)?;
        if advanced != 1 {
            return Err(Issue::Unavailable);
        }
        tx.commit().map_err(|_| Issue::Unavailable)?;
        Ok(proposed)
    }
}
