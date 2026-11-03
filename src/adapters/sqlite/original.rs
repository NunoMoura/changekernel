//! Included same-original ownership and exact outcome lookup. No register discovery dependency.
use super::backend::Backend;
use super::control::{Kind, Mutation, Reader, Subject, Writer, DESCRIPTOR};
use super::custody::CustodyBinding;
use super::local::{CustodyUse, LedgerIdentity, LocalGuard, TrustedLocal};
use super::ports;
use super::preflight;
use super::prepared_operation_request::PreparedOperationRequest;
use super::records;
use super::register;
use super::store_error::{StoreError, StoreResult};
use crate::application::change::{Change, OperationRequestError};
use crate::application::ports::{Checks, Query, Read, ReadScope};
use crate::application::records::StoredOperation;
use crate::kernel::change::{Accepted, Access, Command, Error, Identity, OperationId};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OriginalReference {
    pub(super) identity: Identity,
    pub(super) issuer: CustodyBinding,
    pub(super) binding: CustodyBinding,
    pub(super) path: PathBuf,
    pub(super) start: OperationId,
}
impl OriginalReference {
    pub fn identity(&self) -> &Identity {
        &self.identity
    }
    pub fn location(&self) -> &Path {
        &self.path
    }
    pub fn to_frame(&self) -> StoreResult<Vec<u8>> {
        let mut w = Writer::new(8192);
        w.raw(b"CKOR")?;
        register::write_profile(&mut w)?;
        w.identity(&self.identity)?;
        w.binding(&self.issuer)?;
        w.binding(&self.binding)?;
        w.path(&self.path)?;
        w.raw(self.start.as_bytes())?;
        Ok(w.finish())
    }
    pub fn from_frame(bytes: &[u8]) -> StoreResult<Self> {
        if bytes.len() > 8192 {
            return Err(StoreError::Limit);
        }
        let mut r = Reader::new(bytes);
        if r.raw(4)? != b"CKOR" {
            return Err(StoreError::UnsupportedProfile);
        }
        register::read_profile(&mut r)?;
        let value = Self {
            identity: r.identity()?,
            issuer: r.binding()?,
            binding: r.binding()?,
            path: r.path()?,
            start: OperationId::from_bytes(r.id()?)?,
        };
        r.end()?;
        Ok(value)
    }
    pub(super) fn subject(&self) -> Subject {
        Subject {
            kind: Kind::Original,
            ledger: LedgerIdentity {
                owner: self.identity.owner.clone(),
                ledger: self.identity.ledger.clone(),
            },
            identity: Some(self.identity.clone()),
            issuer: self.issuer.clone(),
            binding: self.binding.clone(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum OriginalOutcome {
    Accepted(Accepted),
    NotAccepted,
}
enum Role {
    Pending,
    Included,
}
pub struct Original<B: TrustedLocal> {
    pub(super) store: Backend,
    pub(super) boundary: B,
    pursuit: Change,
    pub(super) records: Vec<StoredOperation>,
    requests: std::collections::BTreeMap<OperationId, Vec<u8>>,
    catalog: records::Catalog,
    role: Role,
}
impl<B: TrustedLocal> Original<B> {
    pub fn open(
        reference: &OriginalReference,
        mut boundary: B,
        verification: &Path,
    ) -> StoreResult<Self> {
        let subject = reference.subject();
        let (store, inspection) = {
            let mut guard = boundary.lock()?;
            guard.authorize_custody(
                &subject.ledger,
                CustodyUse::OpenOriginal(&reference.identity, &reference.path),
            )?;
            guard.authorize_custody(&subject.ledger, CustodyUse::Verify(verification))?;
            Backend::open(&reference.path, &subject, verification, &mut guard, |i| {
                let bytes = i
                    .activation
                    .as_ref()
                    .ok_or(StoreError::Refused(Error::Denied))?;
                if register::receipt_reference(bytes)? != *reference {
                    return Err(StoreError::Custody);
                }
                Ok(())
            })?
        };
        let h = inspection.history.ok_or(StoreError::Corrupt)?;
        Ok(Self {
            store,
            boundary,
            pursuit: h.pursuit,
            records: h.records,
            requests: h.requests,
            catalog: h.catalog,
            role: Role::Included,
        })
    }
    pub(super) fn pending(
        store: Backend,
        boundary: B,
        history: Option<records::History>,
    ) -> StoreResult<Self> {
        let h = match history {
            Some(h) => h,
            None => records::load(
                store.connection.as_ref().ok_or(StoreError::Fenced)?,
                store
                    .witness
                    .subject
                    .identity
                    .as_ref()
                    .ok_or(StoreError::Corrupt)?,
                &store.witness.cut,
            )?,
        };
        Ok(Self {
            store,
            boundary,
            pursuit: h.pursuit,
            records: h.records,
            requests: h.requests,
            catalog: h.catalog,
            role: Role::Pending,
        })
    }
    pub fn submit(
        &mut self,
        request: &PreparedOperationRequest,
    ) -> std::result::Result<Accepted, OperationRequestError> {
        if !matches!(self.role, Role::Included) {
            return Err(OperationRequestError::Refused(Error::Denied));
        }
        self.submit_inner(request)
    }
    pub(super) fn start(
        &mut self,
        request: &PreparedOperationRequest,
    ) -> std::result::Result<Accepted, OperationRequestError> {
        if !matches!(
            request.typed.operation.command,
            Command::Initiate {
                access: Access::Owner,
                ..
            }
        ) || (self.records.len() > 1
            && !self
                .records
                .iter()
                .any(|r| r.operation.id == request.typed.operation.id))
        {
            return Err(OperationRequestError::Refused(Error::Invalid));
        }
        self.submit_inner(request)
    }
    fn submit_inner(
        &mut self,
        request: &PreparedOperationRequest,
    ) -> std::result::Result<Accepted, OperationRequestError> {
        if self.store.live().is_err() {
            return Err(OperationRequestError::Fenced);
        }
        let mut ports = ports::StorePorts {
            store: &mut self.store,
            boundary: &mut self.boundary,
            catalog: &self.catalog,
            records: &self.records,
            prepared: Some(request),
            readonly: false,
            resolving: self
                .records
                .iter()
                .any(|r| r.operation.id == request.typed.operation.id)
                .then_some(&request.typed),
            committed: None,
        };
        let result = self.pursuit.execute(request.typed.clone(), &mut ports);
        if let Some((record, catalog)) = ports.committed.take() {
            self.requests
                .insert(record.operation.id.clone(), request.raw.clone());
            self.records.push(record);
            self.catalog = catalog;
        }
        result
    }
    pub fn read(&mut self, query: Query, access: Access) -> StoreResult<Read> {
        self.store.live()?;
        if !matches!(self.role, Role::Included) {
            return Err(StoreError::Refused(Error::Denied));
        }
        let mut ports = ports::StorePorts {
            store: &mut self.store,
            boundary: &mut self.boundary,
            catalog: &self.catalog,
            records: &self.records,
            prepared: None,
            readonly: true,
            resolving: None,
            committed: None,
        };
        Ok(self.pursuit.read(query, access, &mut ports)?)
    }
    pub fn resolve_original(
        &mut self,
        request: &PreparedOperationRequest,
    ) -> StoreResult<OriginalOutcome> {
        self.store.live()?;
        let identity = self
            .store
            .witness
            .subject
            .identity
            .as_ref()
            .ok_or(StoreError::Corrupt)?;
        if request.typed.target != identity.change_key() || !request.typed.profile.is_current() {
            return Err(StoreError::Refused(Error::Conflict));
        }
        // Absence never enters execute. This one guard retains Resolve, disclosure and the
        // exact current native cut through the authoritative negative result.
        if !self
            .records
            .iter()
            .any(|r| r.operation.id == request.typed.operation.id)
        {
            let identity = identity.clone();
            let mut guard = self.boundary.lock()?;
            let context = guard.context()?;
            if context.authority.actor != request.typed.actor
                || context.authority.represented_owner != request.typed.represented_owner
            {
                return Err(StoreError::Refused(Error::Denied));
            }
            let scope = ReadScope::Operation(request.typed.operation.id.clone());
            if !context.disclosure.contains(&scope)
                && !context
                    .disclosure
                    .contains(&ReadScope::Change(identity.change.clone()))
            {
                return Err(StoreError::Refused(Error::Denied));
            }
            let checks = Checks {
                identity,
                expected_operation: self.store.witness.cut.last.clone(),
                context,
                disclosure: scope,
                disclosure_origin: None,
                creation: None,
                content_items: Default::default(),
                intakes: Default::default(),
                grounds: Default::default(),
                adaptation: None,
                native: None,
            };
            ports::disclose_checked(
                &mut self.store,
                &mut guard,
                &checks,
                &self.catalog,
                Some(&request.typed),
            )?;
            return Ok(OriginalOutcome::NotAccepted);
        }
        // Presence is independently verified before entering P31's existing exact-retry branch.
        // The wrapper cannot append even if a future coordinator regression misses that branch.
        let mut ports = ports::StorePorts {
            store: &mut self.store,
            boundary: &mut self.boundary,
            catalog: &self.catalog,
            records: &self.records,
            prepared: Some(request),
            readonly: true,
            resolving: Some(&request.typed),
            committed: None,
        };
        match self.pursuit.execute(request.typed.clone(), &mut ports) {
            Ok(a) => Ok(OriginalOutcome::Accepted(a)),
            Err(OperationRequestError::Refused(e)) => Err(StoreError::Refused(e)),
            _ => Err(StoreError::Indeterminate),
        }
    }
    pub(super) fn activate(&mut self, receipt: &[u8]) -> StoreResult<()> {
        if receipt.len() > DESCRIPTOR {
            return Err(StoreError::Limit);
        }
        register::validate_receipt(
            receipt,
            &self.store.witness.subject,
            &self.records,
            &self.requests,
        )?;
        if let Some(old) =
            preflight::activation(self.store.connection.as_ref().ok_or(StoreError::Fenced)?)?
        {
            if old != receipt {
                return Err(StoreError::Corrupt);
            }
            self.role = Role::Included;
            return Ok(());
        }
        let after = self.store.witness.cut.advance()?;
        let identity = self
            .store
            .witness
            .subject
            .identity
            .as_ref()
            .ok_or(StoreError::Corrupt)?
            .clone();
        let mut guard = self.boundary.lock()?;
        guard.authorize_custody(
            &self.store.witness.subject.ledger,
            CustodyUse::Activate(&identity),
        )?;
        self.store
            .mutate(Mutation::Activate, receipt, after, &mut guard, |c| {
                c.execute("INSERT INTO activation VALUES(1,?1)", [receipt])?;
                c.execute("INSERT INTO activation_integrity VALUES(1,?1)", [receipt])?;
                Ok(())
            })?;
        self.role = Role::Included;
        Ok(())
    }
    pub fn passive_checkpoint(&mut self) -> StoreResult<(i32, i32, i32)> {
        let mut guard = self.boundary.lock()?;
        self.store.checkpoint(&mut guard)
    }
    pub fn close(self) -> StoreResult<()> {
        let Self {
            store,
            mut boundary,
            ..
        } = self;
        let mut guard = boundary.lock()?;
        store.close(&mut guard)
    }
}
