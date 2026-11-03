//! Private native machinery and guarded commit/publication cuts.
use super::control::{Cut, Kind, Mutation, Pending, Phase, Stage, Subject, Witness};
use super::custody::{CustodyBinding, WriterCustody};
use super::local::{CustodyUse, LedgerIdentity, LocalGuard};
use super::preflight;
use super::register;
use super::schema;
use super::store_error::{StoreError, StoreResult};
#[cfg(test)]
use super::tests;
use crate::adapters::native_profile;
use crate::kernel::change::Identity;
use rusqlite::{Connection, TransactionBehavior};
use std::path::{Path, PathBuf};

/// Private native machinery. The guard must remain borrowed across every commit/publication cut.
pub(super) struct Backend {
    pub(super) connection: Option<Connection>,
    pub(super) custody: WriterCustody,
    pub(super) witness: Witness,
    pub(super) verification: PathBuf,
    pub(super) fenced: bool,
}
impl Drop for Backend {
    fn drop(&mut self) {
        drop(self.connection.take()); /* lease outlives SQLite; never checkpoint/clean here */
    }
}
impl Backend {
    pub(super) fn allocate(
        path: &Path,
        ledger: LedgerIdentity,
        identity: Option<Identity>,
        issuer: Option<CustodyBinding>,
        request: &[u8],
        verification: &Path,
        _guard: &mut impl LocalGuard,
    ) -> StoreResult<Self> {
        native_profile::verify_runtime().map_err(StoreError::Native)?;
        let kind = if identity.is_some() {
            Kind::Original
        } else {
            Kind::Register
        };
        let placeholder = CustodyBinding {
            directory_device: 1,
            directory_inode: 1,
            database_device: 1,
            database_inode: 1,
            lock_device: 1,
            lock_inode: 1,
        };
        let build = |binding: CustodyBinding| {
            let subject = Subject {
                kind,
                ledger: ledger.clone(),
                identity: identity.clone(),
                issuer: issuer.clone().unwrap_or_else(|| binding.clone()),
                binding,
            };
            let mut w = Witness::new(subject);
            w.pending = Some(Pending {
                stage: Stage::Prepared,
                mutation: Mutation::Provision,
                after: Cut {
                    revision: 1,
                    ..Cut::empty()
                },
                request: request.to_vec(),
            });
            w
        };
        // Every nested envelope is sized before irreversible allocation. Actual native values
        // have the exact same fixed encoded widths as these non-authoritative placeholders.
        build(placeholder).encodable()?;
        let custody = WriterCustody::create(path)?;
        let mut allocation = build(custody.binding());
        allocation.publish_allocation(&custody)?;
        let mut witness = build(custody.binding());
        witness.publish(&custody)?;
        Ok(Self {
            connection: None,
            custody,
            witness,
            verification: verification.to_owned(),
            fenced: false,
        })
    }
    fn allocation_pending(
        custody: &WriterCustody,
        expected: &Subject,
        request: &[u8],
    ) -> StoreResult<Pending> {
        let allocation = Witness::read_named(custody, "allocation.ctrl")?;
        if allocation.subject != *expected {
            return Err(StoreError::Custody);
        }
        let pending = allocation.initial_provision()?;
        if pending.stage != Stage::Prepared || pending.request != request {
            return Err(StoreError::Corrupt);
        }
        register::validate_provision(expected, request, custody.directory())?;
        Ok(pending.clone())
    }
    pub(super) fn allocated(
        path: &Path,
        expected: &Subject,
        request: &[u8],
        verification: &Path,
    ) -> StoreResult<Self> {
        let custody = WriterCustody::open(path)?;
        let allocation = Self::allocation_pending(&custody, expected, request)?;
        let witness = match custody.member_object("custody.ctrl")? {
            Some(_) => Witness::read(&custody)?,
            None => {
                // Only a verified unbound reservation can reach this method. No SQLite
                // access was permitted before root binding; unexplained bytes/journals block.
                if custody.member("ledger.sqlite", false)?.metadata()?.len() != 0
                    || custody.journal_objects()?.iter().any(Option::is_some)
                {
                    return Err(StoreError::BlockedOrphan);
                }
                let mut w = Witness::new(expected.clone());
                w.pending = Some(allocation.clone());
                w.publish(&custody)?;
                w
            }
        };
        if witness.subject != *expected {
            return Err(StoreError::Custody);
        }
        if witness.initial_provision()? != &allocation
            || custody.member("ledger.sqlite", false)?.metadata()?.len() != 0
            || custody.journal_objects()?.iter().any(Option::is_some)
        {
            return Err(StoreError::BlockedOrphan);
        }
        Ok(Self {
            connection: None,
            custody,
            witness,
            verification: verification.to_owned(),
            fenced: false,
        })
    }
    pub(super) fn provision(&mut self, _guard: &mut impl LocalGuard) -> StoreResult<()> {
        let result = (|| {
            if self.connection.is_some() {
                return Err(StoreError::Corrupt);
            }
            let pending = self.witness.initial_provision()?;
            if pending
                != &Self::allocation_pending(
                    &self.custody,
                    &self.witness.subject,
                    &pending.request,
                )?
            {
                return Err(StoreError::Corrupt);
            }
            if self
                .custody
                .member("ledger.sqlite", false)?
                .metadata()?
                .len()
                != 0
            {
                return Err(StoreError::Indeterminate);
            }
            // Preparing/Prepared is known-new only. No source SQLite call may inspect or
            // recover artifacts whose creation this allocation did not record.
            if self.custody.journal_objects()?.iter().any(Option::is_some) {
                return Err(StoreError::BlockedOrphan);
            }
            let after = pending.after.clone();
            let mut possible = self.witness.clone();
            possible.pending.as_mut().ok_or(StoreError::Corrupt)?.stage = Stage::CommitPossible;
            self.witness.replace(&self.custody, possible)?;
            let mut c = preflight::open_writer(&mut self.custody, true)?;
            let tx = c.transaction_with_behavior(TransactionBehavior::Immediate)?;
            schema::initialize(&tx, &self.witness.subject, &after)?;
            tx.commit().map_err(|_| StoreError::Indeterminate)?;
            #[cfg(test)]
            tests::cuts::pause("provision-after-commit");
            self.connection = Some(c);
            preflight::finish_open(
                &mut self.custody,
                self.connection.as_ref().ok_or(StoreError::Fenced)?,
            )?;
            if schema::head(self.connection.as_ref().ok_or(StoreError::Fenced)?)? != after {
                return Err(StoreError::Corrupt);
            }
            let mut final_cut = self.witness.clone();
            final_cut.cut = after;
            final_cut.pending = None;
            self.witness.replace(&self.custody, final_cut)?;
            self.publish_live()?;
            Ok(())
        })();
        if result.is_err() {
            self.fenced = true
        }
        result
    }
    fn publish_live(&mut self) -> StoreResult<()> {
        let mut next = self.witness.clone();
        next.phase = Phase::Live;
        next.epoch = next.epoch.checked_add(1).ok_or(StoreError::Limit)?;
        next.journals = self.custody.journal_objects()?;
        self.witness.replace(&self.custody, next)
    }
    pub(super) fn open(
        path: &Path,
        expected: &Subject,
        verification: &Path,
        guard: &mut impl LocalGuard,
        validate_role: impl FnOnce(&preflight::Inspection) -> StoreResult<()>,
    ) -> StoreResult<(Self, preflight::Inspection)> {
        guard.authorize_custody(&expected.ledger, CustodyUse::Verify(verification))?;
        native_profile::verify_runtime().map_err(StoreError::Native)?;
        let custody = WriterCustody::open(path)?;
        let witness = Witness::read(&custody)?;
        if witness.subject != *expected {
            return Err(StoreError::Custody);
        }
        let mut out = Self {
            connection: None,
            custody,
            witness,
            verification: verification.to_owned(),
            fenced: false,
        };
        let journals = out.custody.journal_objects()?;
        let main = match out.witness.phase {
            Phase::Clean => journals[0].is_none(),
            Phase::PreparingOpen => out.witness.journals[0].is_none(),
            Phase::Closing if journals[0].is_none() => {
                guard.authorize_custody(
                    &expected.ledger,
                    CustodyUse::Maintain(expected.identity.as_ref()),
                )?;
                out.custody.sync()?;
                true
            }
            _ => false,
        };
        let inspection = preflight::inspect(
            &out.custody,
            &out.witness,
            verification,
            if main {
                preflight::Proof::Main
            } else {
                preflight::Proof::Journals
            },
        )?;
        validate_role(&inspection)?;
        out.resolve_cut(&inspection, guard)?;
        if out.witness.phase == Phase::Closing && main {
            let mut clean = out.witness.clone();
            clean.phase = Phase::Clean;
            out.witness.replace(&out.custody, clean)?;
        }
        let mut opening = out.witness.clone();
        opening.phase = Phase::PreparingOpen;
        opening.journals = journals;
        out.witness.replace(&out.custody, opening)?;
        let c = preflight::open_writer(&mut out.custody, false)?;
        out.connection = Some(c);
        preflight::finish_open(
            &mut out.custody,
            out.connection.as_ref().ok_or(StoreError::Fenced)?,
        )?;
        if schema::head(out.connection.as_ref().ok_or(StoreError::Fenced)?)? != out.witness.cut {
            return Err(StoreError::Corrupt);
        }
        out.publish_live()?;
        Ok((out, inspection))
    }
    fn resolve_cut(
        &mut self,
        inspection: &preflight::Inspection,
        _guard: &mut impl LocalGuard,
    ) -> StoreResult<()> {
        let mut next = self.witness.clone();
        match self.witness.pending.as_ref() {
            None => {
                if inspection.cut != self.witness.cut {
                    return Err(StoreError::Corrupt);
                }
            }
            Some(p) => {
                register::validate_pending(&self.witness, inspection, self.custody.directory())?;
                if p.mutation == Mutation::Provision {
                    let mut pending = self.witness.initial_provision()?.clone();
                    let allocation = Self::allocation_pending(
                        &self.custody,
                        &self.witness.subject,
                        &pending.request,
                    )?;
                    pending.stage = Stage::Prepared;
                    if pending != allocation {
                        return Err(StoreError::Corrupt);
                    }
                }
                match p.stage {
                    Stage::Prepared => {
                        if inspection.cut != self.witness.cut {
                            return Err(StoreError::Corrupt);
                        }
                        next.pending = None;
                    }
                    Stage::CommitPossible => {
                        if inspection.cut == self.witness.cut {
                            return Err(StoreError::Indeterminate);
                        }
                        if inspection.cut != p.after {
                            return Err(StoreError::Corrupt);
                        }
                        next.cut = p.after.clone();
                        next.pending = None;
                    }
                }
            }
        }
        if next != self.witness {
            self.witness.replace(&self.custody, next)?
        }
        Ok(())
    }
    pub(super) fn live(&mut self) -> StoreResult<()> {
        if self.fenced {
            return Err(StoreError::Fenced);
        }
        let checked = (|| {
            if self.witness.phase != Phase::Live
                || self.witness.pending.is_some()
                || self.connection.is_none()
            {
                return Err(StoreError::Fenced);
            }
            self.custody.check()?;
            if Witness::read(&self.custody)? != self.witness {
                return Err(StoreError::Custody);
            }
            if schema::head(self.connection.as_ref().ok_or(StoreError::Fenced)?)?
                != self.witness.cut
            {
                return Err(StoreError::Corrupt);
            }
            Ok(())
        })();
        if checked.is_err() {
            self.fenced = true;
        }
        checked
    }
    pub(super) fn mutate(
        &mut self,
        mutation: Mutation,
        request: &[u8],
        after: Cut,
        _guard: &mut impl LocalGuard,
        write: impl FnOnce(&Connection) -> StoreResult<()>,
    ) -> StoreResult<()> {
        self.live()?;
        for v in [after.revision, after.count, after.included] {
            schema::integer(v)?;
        }
        let result = (|| {
            let mut prepared = self.witness.clone();
            prepared.pending = Some(Pending {
                stage: Stage::Prepared,
                mutation,
                after: after.clone(),
                request: request.to_vec(),
            });
            prepared.encodable()?;
            #[cfg(test)]
            tests::cuts::mutation_cut(mutation, "before-prepare");
            self.witness.replace(&self.custody, prepared)?;
            #[cfg(test)]
            tests::cuts::mutation_cut(mutation, "prepared");
            let c = self.connection.as_mut().ok_or(StoreError::Fenced)?;
            let tx = c.transaction_with_behavior(TransactionBehavior::Immediate)?;
            if schema::head(&tx)? != self.witness.cut {
                return Err(StoreError::Corrupt);
            }
            write(&tx)?;
            schema::set_head(&tx, &after)?;
            let mut possible = self.witness.clone();
            possible.pending.as_mut().ok_or(StoreError::Corrupt)?.stage = Stage::CommitPossible;
            self.witness.replace(&self.custody, possible)?;
            #[cfg(test)]
            tests::cuts::mutation_cut(mutation, "possible");
            tx.commit().map_err(|_| StoreError::Indeterminate)?;
            #[cfg(test)]
            tests::cuts::mutation_cut(mutation, "after-commit");
            self.custody.check()?;
            if schema::head(self.connection.as_ref().ok_or(StoreError::Fenced)?)? != after {
                return Err(StoreError::Corrupt);
            }
            let mut done = self.witness.clone();
            done.cut = after;
            done.pending = None;
            self.witness.replace(&self.custody, done)?;
            #[cfg(test)]
            tests::cuts::mutation_cut(mutation, "after-final");
            Ok(())
        })();
        if result.is_err() {
            self.fenced = true;
            return Err(StoreError::Indeterminate);
        }
        Ok(())
    }
    pub(super) fn checkpoint(
        &mut self,
        guard: &mut impl LocalGuard,
    ) -> StoreResult<(i32, i32, i32)> {
        self.live()?;
        guard.authorize_custody(
            &self.witness.subject.ledger,
            CustodyUse::Maintain(self.witness.subject.identity.as_ref()),
        )?;
        let result = self
            .connection
            .as_ref()
            .ok_or(StoreError::Fenced)?
            .query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            });
        match result {
            Ok(v) if self.custody.check().is_ok() => Ok(v),
            _ => {
                self.fenced = true;
                Err(StoreError::Indeterminate)
            }
        }
    }
    pub(super) fn close(mut self, guard: &mut impl LocalGuard) -> StoreResult<()> {
        self.live()?;
        guard.authorize_custody(
            &self.witness.subject.ledger,
            CustodyUse::Maintain(self.witness.subject.identity.as_ref()),
        )?;
        guard.authorize_custody(
            &self.witness.subject.ledger,
            CustodyUse::Verify(&self.verification),
        )?;
        let mut closing = self.witness.clone();
        closing.phase = Phase::Closing;
        self.witness.replace(&self.custody, closing)?;
        #[cfg(test)]
        tests::cuts::pause("close-closing");
        let (busy, log, done): (i32, i32, i32) = self
            .connection
            .as_ref()
            .ok_or(StoreError::Fenced)?
            .query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })?;
        if busy != 0 || log < 0 || done != log {
            return Err(StoreError::Indeterminate);
        }
        self.custody.check()?;
        #[cfg(test)]
        tests::cuts::close_boundary("close-checkpointed")?;
        let c = self.connection.take().ok_or(StoreError::Fenced)?;
        c.close().map_err(|(c, _)| {
            drop(c);
            StoreError::Indeterminate
        })?;
        self.custody.connection_closed()?;
        #[cfg(test)]
        tests::cuts::close_boundary("close-closed")?;
        self.custody.sync()?;
        #[cfg(test)]
        tests::cuts::pause("close-synced");
        let proof = preflight::inspect(
            &self.custody,
            &self.witness,
            &self.verification,
            preflight::Proof::Main,
        )?;
        if proof.cut != self.witness.cut {
            return Err(StoreError::Corrupt);
        }
        let mut clean = self.witness.clone();
        clean.phase = Phase::Clean;
        self.witness.replace(&self.custody, clean)?;
        Ok(())
    }
}
