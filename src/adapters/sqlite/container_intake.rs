//! Explicit-file SQLite custody. Opening never creates or migrates storage.
use crate::kernel::containers::intake::{self, Issue, Proposal, Receipt, Result};
use crate::ports::container_intake::ContainerIntakeStore;
use rusqlite::{params, Connection, OpenFlags, OptionalExtension, TransactionBehavior};
use std::{path::Path, time::Duration};

const SCHEMA: [(&str, &str); 4] = [
    ("ck_native_intake_schema", "CREATE TABLE ck_native_intake_schema (version TEXT NOT NULL)"),
    ("ck_native_containers", "CREATE TABLE ck_native_containers (container_id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL)"),
    ("ck_native_changes", "CREATE TABLE ck_native_changes (container_id TEXT NOT NULL, change_id TEXT NOT NULL, actor TEXT NOT NULL, request_id TEXT NOT NULL, what_text TEXT NOT NULL, why_text TEXT, state TEXT NOT NULL, integrity TEXT NOT NULL, PRIMARY KEY (container_id, change_id), UNIQUE (container_id, actor, request_id), FOREIGN KEY (container_id) REFERENCES ck_native_containers(container_id))"),
    ("ck_native_retries", "CREATE TABLE ck_native_retries (container_id TEXT NOT NULL, actor TEXT NOT NULL, request_id TEXT NOT NULL, change_id TEXT NOT NULL, PRIMARY KEY (container_id, actor, request_id), UNIQUE (container_id, change_id), FOREIGN KEY (container_id) REFERENCES ck_native_containers(container_id))"),
];
const VERSION: &str = "changekernel.native-intake.sqlite@1";

pub struct SqliteIntake {
    db: Connection,
}
impl SqliteIntake {
    fn connect(path: &Path, initialize: bool) -> Result<Self> {
        let name = path.to_str().ok_or(Issue::Unavailable)?;
        if name.is_empty() || name == ":memory:" || name.starts_with("file:") || !path.is_absolute()
        {
            return Err(Issue::Unavailable);
        }
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_NO_MUTEX
            | if initialize {
                OpenFlags::SQLITE_OPEN_CREATE
            } else {
                OpenFlags::empty()
            };
        let db = Connection::open_with_flags(path, flags).map_err(|_| Issue::Unavailable)?;
        db.busy_timeout(Duration::from_millis(500))
            .map_err(|_| Issue::Unavailable)?;
        db.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|_| Issue::Unavailable)?;
        Ok(Self { db })
    }
    fn configure(&self) -> Result<()> {
        self.db
            .execute_batch("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;")
            .map_err(|_| Issue::Unavailable)
    }
    /// Host-authorized creation. Only empty SQLite files (or missing files) are accepted.
    pub fn initialize(path: impl AsRef<Path>) -> Result<Self> {
        let mut store = Self::connect(path.as_ref(), true)?;
        let initial_count: i64 = store
            .db
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
                [],
                |r| r.get(0),
            )
            .map_err(|_| Issue::Unavailable)?;
        if initial_count != 0 {
            return Err(Issue::Unavailable);
        }
        store.configure()?;
        let tx = store
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| Issue::Unavailable)?;
        let count: i64 = tx
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
                [],
                |r| r.get(0),
            )
            .map_err(|_| Issue::Unavailable)?;
        if count != 0 {
            return Err(Issue::Unavailable);
        }
        for (_, sql) in SCHEMA {
            tx.execute(sql, []).map_err(|_| Issue::Unavailable)?;
        }
        tx.execute("INSERT INTO ck_native_intake_schema VALUES (?1)", [VERSION])
            .map_err(|_| Issue::Unavailable)?;
        tx.commit().map_err(|_| Issue::Unavailable)?;
        Ok(store)
    }
    pub fn open_existing(path: impl AsRef<Path>) -> Result<Self> {
        let store = Self::connect(path.as_ref(), false)?;
        let mut stmt = store.db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .map_err(|_| Issue::Unavailable)?;
        let rows: Vec<(String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(|_| Issue::Unavailable)?
            .collect::<rusqlite::Result<_>>()
            .map_err(|_| Issue::Unavailable)?;
        let mut expected: Vec<_> = SCHEMA
            .iter()
            .map(|(n, s)| (n.to_string(), s.to_string()))
            .collect();
        expected.sort();
        if rows != expected {
            return Err(Issue::Unavailable);
        }
        let other: i64 = store.db.query_row("SELECT count(*) FROM sqlite_master WHERE type NOT IN ('table', 'index') AND name NOT LIKE 'sqlite_%'", [], |r| r.get(0)).map_err(|_| Issue::Unavailable)?;
        if other != 0 {
            return Err(Issue::Unavailable);
        }
        let indices: i64 = store.db.query_row("SELECT count(*) FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%'", [], |r| r.get(0)).map_err(|_| Issue::Unavailable)?;
        if indices != 0 {
            return Err(Issue::Unavailable);
        }
        let version: String = store
            .db
            .query_row("SELECT version FROM ck_native_intake_schema", [], |r| {
                r.get(0)
            })
            .map_err(|_| Issue::Unavailable)?;
        let n: i64 = store
            .db
            .query_row("SELECT count(*) FROM ck_native_intake_schema", [], |r| {
                r.get(0)
            })
            .map_err(|_| Issue::Unavailable)?;
        if version != VERSION || n != 1 {
            return Err(Issue::Unavailable);
        }
        drop(stmt);
        store.configure()?;
        Ok(store)
    }
}

fn owner(db: &Connection, container: &str, actor: &str) -> Result<()> {
    let found: Option<String> = db
        .query_row(
            "SELECT owner FROM ck_native_containers WHERE container_id = ?1",
            [container],
            |r| r.get(0),
        )
        .optional()
        .map_err(|_| Issue::Unavailable)?;
    if found.as_deref() == Some(actor) {
        Ok(())
    } else {
        Err(Issue::Denied)
    }
}
fn retained(db: &Connection, container: &str, change: &str) -> Result<Receipt> {
    let raw = db.query_row("SELECT change_id, container_id, request_id, actor, what_text, why_text, state, integrity FROM ck_native_changes WHERE container_id = ?1 AND change_id = ?2", params![container, change], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?, r.get::<_, String>(4)?, r.get::<_, Option<String>>(5)?, r.get::<_, String>(6)?, r.get::<_, String>(7)?))
    }).optional().map_err(|_| Issue::Unavailable)?.ok_or(Issue::Unavailable)?;
    let (change_id, container_id, request_id, actor, what, why, state, stored) = raw;
    let receipt = Receipt {
        change_id,
        container_id,
        request_id,
        actor,
        what,
        why,
        state: "awaiting-assessment",
    };
    if state != receipt.state
        || intake::validate(&Proposal {
            container_id: receipt.container_id.clone(),
            request_id: receipt.request_id.clone(),
            what: receipt.what.clone(),
            why: receipt.why.clone(),
        })
        .is_err()
        || !intake::identifier(&receipt.actor)
        || receipt.change_id
            != intake::change_id(&receipt.container_id, &receipt.actor, &receipt.request_id)
        || receipt.container_id != container
        || receipt.change_id != change
        || stored != intake::integrity(&receipt)
    {
        return Err(Issue::Unavailable);
    }
    Ok(receipt)
}
impl ContainerIntakeStore for SqliteIntake {
    fn create(&mut self, container: &str, actor: &str) -> Result<()> {
        let tx = self
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| Issue::Unavailable)?;
        let existing: Option<String> = tx
            .query_row(
                "SELECT owner FROM ck_native_containers WHERE container_id = ?1",
                [container],
                |r| r.get(0),
            )
            .optional()
            .map_err(|_| Issue::Unavailable)?;
        if let Some(existing) = existing {
            return if existing == actor {
                Ok(())
            } else {
                Err(Issue::Denied)
            };
        }
        tx.execute(
            "INSERT INTO ck_native_containers VALUES (?1, ?2)",
            params![container, actor],
        )
        .map_err(|_| Issue::Unavailable)?;
        tx.commit().map_err(|_| Issue::Unavailable)
    }
    fn open(&self, container: &str, actor: &str) -> Result<()> {
        owner(&self.db, container, actor)
    }
    fn propose(&mut self, proposal: &Proposal, actor: &str) -> Result<Receipt> {
        let tx = self
            .db
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| Issue::Unavailable)?;
        owner(&tx, &proposal.container_id, actor)?;
        let change = intake::change_id(&proposal.container_id, actor, &proposal.request_id);
        let existing: Option<String> = tx.query_row("SELECT change_id FROM ck_native_retries WHERE container_id = ?1 AND actor = ?2 AND request_id = ?3", params![proposal.container_id, actor, proposal.request_id], |r| r.get(0)).optional().map_err(|_| Issue::Unavailable)?;
        if let Some(existing) = existing {
            if existing != change {
                return Err(Issue::Unavailable);
            }
            let record = retained(&tx, &proposal.container_id, &change)?;
            if record.actor != actor {
                return Err(Issue::Unavailable);
            }
            return if record.what == proposal.what && record.why == proposal.why {
                Ok(record)
            } else {
                Err(Issue::Conflict)
            };
        }
        // A retained change with missing retry grounds is corruption, never a new success.
        let collision: i64 = tx
            .query_row(
                "SELECT count(*) FROM ck_native_changes WHERE container_id = ?1 AND change_id = ?2",
                params![proposal.container_id, change],
                |r| r.get(0),
            )
            .map_err(|_| Issue::Unavailable)?;
        if collision != 0 {
            return Err(Issue::Unavailable);
        }
        let record = Receipt {
            change_id: change,
            container_id: proposal.container_id.clone(),
            request_id: proposal.request_id.clone(),
            actor: actor.to_owned(),
            what: proposal.what.clone(),
            why: proposal.why.clone(),
            state: "awaiting-assessment",
        };
        tx.execute(
            "INSERT INTO ck_native_changes VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                record.container_id,
                record.change_id,
                record.actor,
                record.request_id,
                record.what,
                record.why,
                record.state,
                intake::integrity(&record)
            ],
        )
        .map_err(|_| Issue::Unavailable)?;
        tx.execute(
            "INSERT INTO ck_native_retries VALUES (?1, ?2, ?3, ?4)",
            params![
                record.container_id,
                record.actor,
                record.request_id,
                record.change_id
            ],
        )
        .map_err(|_| Issue::Unavailable)?;
        tx.commit().map_err(|_| Issue::Unavailable)?;
        Ok(record)
    }
    fn read(&self, container: &str, change: &str, actor: &str) -> Result<Receipt> {
        owner(&self.db, container, actor)?;
        let binding: Option<(String, String)> = self.db.query_row("SELECT actor, request_id FROM ck_native_retries WHERE container_id = ?1 AND change_id = ?2", params![container, change], |r| Ok((r.get(0)?, r.get(1)?))).optional().map_err(|_| Issue::Unavailable)?;
        let Some((bound_actor, request)) = binding else {
            // Missing retry grounds for a retained Change are corruption, not denial.
            let exists: i64 = self.db.query_row("SELECT count(*) FROM ck_native_changes WHERE container_id = ?1 AND change_id = ?2", params![container, change], |r| r.get(0)).map_err(|_| Issue::Unavailable)?;
            return if exists != 0 {
                Err(Issue::Unavailable)
            } else {
                Err(Issue::Denied)
            };
        };
        if bound_actor != actor {
            return Err(Issue::Denied);
        }
        let record = retained(&self.db, container, change)?;
        if record.actor != actor || record.request_id != request {
            return Err(Issue::Unavailable);
        }
        Ok(record)
    }
}
