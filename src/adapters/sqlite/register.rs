//! Rare-write authoritative inclusion register. Ordinary Original never retains/opens this DB.
use super::backend::Backend;
use super::control::{
    self, Cut, Kind, Mutation, Phase, Reader, Stage, Subject, Witness, Writer, DESCRIPTOR,
};
use super::custody::{CustodyBinding, WriterCustody};
use super::local::{self, CustodyUse, LedgerIdentity, LocalGuard, TrustedLocal};
use super::original::{Original, OriginalOutcome, OriginalReference};
use super::preflight;
use super::prepared_operation_request::PreparedOperationRequest;
use super::schema;
use super::store_error::{StoreError, StoreResult};
use crate::application::change::{Change, OperationRequestError};
use crate::application::operation_request::CURRENT_PROFILE;
use crate::application::records::StoredOperation;
use crate::kernel::change::{
    Accepted, Access, ChangeId, Command, Error, Identity, LedgerId, OperationId, OwnerId,
};
use rusqlite::{params, Connection};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegisterSelection {
    pub location: PathBuf,
    pub ledger: LedgerIdentity,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RegisterReference {
    selection: RegisterSelection,
    binding: CustodyBinding,
}
impl RegisterReference {
    pub fn selection(&self) -> &RegisterSelection {
        &self.selection
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CreationIntent {
    issuer: RegisterReference,
    identity: Identity,
    path: PathBuf,
    start: PreparedOperationRequest,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum CreationProgress {
    StartAcceptedPendingInclusion(Accepted),
    StartAcceptedPendingActivation(Accepted),
    Ready {
        reference: Box<OriginalReference>,
        start: Accepted,
    },
}
#[derive(Clone)]
pub(super) struct Entry {
    intent: CreationIntent,
    state: i64,
    binding: Option<CustodyBinding>,
    receipt: Option<Vec<u8>>,
}
pub(super) type Entries = BTreeMap<ChangeId, Entry>;
pub struct Register<B: TrustedLocal> {
    store: Backend,
    boundary: B,
    entries: Entries,
    reference: RegisterReference,
}
pub(super) fn write_profile(w: &mut Writer) -> StoreResult<()> {
    for v in [
        CURRENT_PROFILE.codec,
        CURRENT_PROFILE.schema,
        CURRENT_PROFILE.semantic,
    ] {
        w.raw(&v.to_be_bytes())?
    }
    Ok(())
}
pub(super) fn read_profile(r: &mut Reader<'_>) -> StoreResult<()> {
    for v in [
        CURRENT_PROFILE.codec,
        CURRENT_PROFILE.schema,
        CURRENT_PROFILE.semantic,
    ] {
        if r.raw(4)? != v.to_be_bytes() {
            return Err(StoreError::UnsupportedProfile);
        }
    }
    Ok(())
}
fn write_register(w: &mut Writer, r: &RegisterReference) -> StoreResult<()> {
    w.path(&r.selection.location)?;
    w.raw(r.selection.ledger.owner.as_bytes())?;
    w.raw(r.selection.ledger.ledger.as_bytes())?;
    w.binding(&r.binding)
}
fn read_register(r: &mut Reader<'_>) -> StoreResult<RegisterReference> {
    Ok(RegisterReference {
        selection: RegisterSelection {
            location: r.path()?,
            ledger: LedgerIdentity {
                owner: OwnerId::from_bytes(r.id()?)?,
                ledger: LedgerId::from_bytes(r.id()?)?,
            },
        },
        binding: r.binding()?,
    })
}
impl CreationIntent {
    pub fn try_new(
        issuer: RegisterReference,
        identity: Identity,
        path: PathBuf,
        start: PreparedOperationRequest,
    ) -> StoreResult<Self> {
        let out = Self {
            issuer,
            identity,
            path,
            start,
        };
        out.check()?;
        Ok(out)
    }
    fn check(&self) -> StoreResult<()> {
        Change::try_new(self.identity.clone())?;
        if self.identity.owner != self.issuer.selection.ledger.owner
            || self.identity.ledger != self.issuer.selection.ledger.ledger
            || self.start.typed.target != self.identity.change_key()
            || self.start.typed.actor != self.identity.owner_actor
            || self.start.typed.represented_owner != self.identity.owner
            || !matches!(
                self.start.typed.operation.command,
                Command::Initiate {
                    access: Access::Owner,
                    ..
                }
            )
            || !self.path.is_absolute()
            || !self.issuer.selection.location.is_absolute()
        {
            return Err(StoreError::Refused(Error::Invalid));
        }
        // The same complete nested sizing gate applies to constructors, parsed frames and
        // every admission. Fixed placeholder native values confer no authority.
        let raw = self.to_frame()?;
        let binding = CustodyBinding {
            directory_device: 1,
            directory_inode: 1,
            database_device: 1,
            database_inode: 1,
            lock_device: 1,
            lock_inode: 1,
        };
        receipt(&raw, &binding)?;
        let mut bind = Writer::new(DESCRIPTOR);
        bind.binding(&binding)?;
        bind.bytes(&raw, DESCRIPTOR)?;
        Ok(())
    }
    pub fn to_frame(&self) -> StoreResult<Vec<u8>> {
        let mut w = Writer::new(DESCRIPTOR);
        w.raw(b"CKCI")?;
        write_profile(&mut w)?;
        write_register(&mut w, &self.issuer)?;
        w.identity(&self.identity)?;
        w.path(&self.path)?;
        w.bytes(&self.start.raw, control::FRAME)?;
        Ok(w.finish())
    }
    pub fn from_frame(bytes: &[u8]) -> StoreResult<Self> {
        if bytes.len() > DESCRIPTOR {
            return Err(StoreError::Limit);
        }
        let mut r = Reader::new(bytes);
        if r.raw(4)? != b"CKCI" {
            return Err(StoreError::UnsupportedProfile);
        }
        read_profile(&mut r)?;
        let out = Self {
            issuer: read_register(&mut r)?,
            identity: r.identity()?,
            path: r.path()?,
            start: PreparedOperationRequest::from_frame(r.bytes(control::FRAME)?)?,
        };
        r.end()?;
        out.check()?;
        Ok(out)
    }
    pub fn identity(&self) -> &Identity {
        &self.identity
    }
    pub fn start(&self) -> &PreparedOperationRequest {
        &self.start
    }
    fn same(&self, other: &Self) -> bool {
        self.issuer == other.issuer
            && self.identity == other.identity
            && self.path == other.path
            && self.start.typed == other.start.typed
    }
}
fn receipt(raw_intent: &[u8], binding: &CustodyBinding) -> StoreResult<Vec<u8>> {
    let mut w = Writer::new(DESCRIPTOR);
    w.raw(b"CKIR")?;
    write_profile(&mut w)?;
    w.binding(binding)?;
    w.bytes(raw_intent, DESCRIPTOR)?;
    Ok(w.finish())
}
fn read_receipt(bytes: &[u8]) -> StoreResult<(CreationIntent, CustodyBinding)> {
    if bytes.len() > DESCRIPTOR {
        return Err(StoreError::Limit);
    }
    let mut r = Reader::new(bytes);
    if r.raw(4)? != b"CKIR" {
        return Err(StoreError::UnsupportedProfile);
    }
    read_profile(&mut r)?;
    let binding = r.binding()?;
    let intent = CreationIntent::from_frame(r.bytes(DESCRIPTOR)?)?;
    r.end()?;
    Ok((intent, binding))
}
pub(super) fn receipt_reference(bytes: &[u8]) -> StoreResult<OriginalReference> {
    let (i, b) = read_receipt(bytes)?;
    Ok(OriginalReference {
        identity: i.identity,
        issuer: i.issuer.binding,
        binding: b,
        path: i.path,
        start: i.start.typed.operation.id,
    })
}
pub(super) fn validate_receipt(
    bytes: &[u8],
    subject: &Subject,
    records: &[StoredOperation],
    requests: &BTreeMap<OperationId, Vec<u8>>,
) -> StoreResult<()> {
    let (intent, binding) = read_receipt(bytes)?;
    let first = records.first().ok_or(StoreError::Corrupt)?;
    if subject.kind != Kind::Original
        || subject.identity.as_ref() != Some(&intent.identity)
        || subject.issuer != intent.issuer.binding
        || subject.binding != binding
        || first.operation_request()? != intent.start.typed
        || requests.get(&first.operation.id) != Some(&intent.start.raw)
    {
        return Err(StoreError::Corrupt);
    }
    Ok(())
}
/// Read-only receipt verification against an already fully decoded/verified first request.
/// Compare the exact nested request bytes before any second protobuf decode or re-encoding.
/// The fixed envelope/path readers are bounded; this preserves all CreationIntent admission
/// bindings without letting a malicious receipt allocate an unrelated typed request.
pub(super) fn verify_read_receipt(
    bytes: &[u8],
    reference: &OriginalReference,
    subject: &Subject,
    history: &super::records::History,
) -> StoreResult<()> {
    if bytes.len() > DESCRIPTOR {
        return Err(StoreError::Limit);
    }
    let mut r = Reader::new(bytes);
    if r.raw(4)? != b"CKIR" {
        return Err(StoreError::UnsupportedProfile);
    }
    read_profile(&mut r)?;
    let binding = r.binding()?;
    let raw = r.bytes(DESCRIPTOR)?;
    r.end()?;
    let mut i = Reader::new(raw);
    if i.raw(4)? != b"CKCI" {
        return Err(StoreError::UnsupportedProfile);
    }
    read_profile(&mut i)?;
    let issuer = read_register(&mut i)?;
    let identity = i.identity()?;
    let path = i.path()?;
    let request = i.bytes(control::FRAME)?;
    i.end()?;
    let first = history.records.first().ok_or(StoreError::Corrupt)?;
    if subject.kind != Kind::Original
        || subject.identity.as_ref() != Some(&identity)
        || subject.issuer != issuer.binding
        || subject.binding != binding
        || identity.owner != issuer.selection.ledger.owner
        || identity.ledger != issuer.selection.ledger.ledger
        || !issuer.selection.location.is_absolute()
        || !path.is_absolute()
        || reference.identity != identity
        || reference.issuer != issuer.binding
        || reference.binding != binding
        || reference.path != path
        || reference.start != first.operation.id
        || history.requests.get(&first.operation.id).map(Vec::as_slice) != Some(request)
        || first.accepted.actor != identity.owner_actor
        || first.accepted.represented_owner != identity.owner
        || !matches!(
            first.operation.command,
            Command::Initiate {
                access: Access::Owner,
                ..
            }
        )
    {
        return Err(StoreError::Corrupt);
    }
    Ok(())
}
pub(super) fn validate(c: &Connection, subject: &Subject, cut: &Cut) -> StoreResult<Entries> {
    let mut out = Entries::new();
    let mut included = 0u64;
    let mut stmt = c.prepare("SELECT change,state,binding FROM entries")?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let id = ChangeId::from_bytes(
            schema::blob(row.get_ref(0)?, 16)?
                .try_into()
                .map_err(|_| StoreError::Corrupt)?,
        )?;
        let state: i64 = row.get(1)?;
        let raw = schema::paired(c, "entries", "intent_integrity", id.as_bytes(), DESCRIPTOR)?
            .ok_or(StoreError::Corrupt)?;
        let intent = CreationIntent::from_frame(&raw)?;
        if intent.identity.change != id
            || intent.issuer.binding != subject.binding
            || intent.issuer.selection.ledger != subject.ledger
        {
            return Err(StoreError::Corrupt);
        }
        let binding = match row.get_ref(2)? {
            rusqlite::types::ValueRef::Null => None,
            v => {
                let mut r = Reader::new(schema::blob(v, 48)?);
                let b = r.binding()?;
                r.end()?;
                Some(b)
            }
        };
        let saved = schema::paired(
            c,
            "receipts",
            "receipt_integrity",
            id.as_bytes(),
            DESCRIPTOR,
        )?;
        match state {
            0 if binding.is_none() && saved.is_none() => {}
            1 if binding.is_some() && saved.is_none() => {}
            2 if binding.is_some() && saved.is_some() => {
                let (i, b) = read_receipt(saved.as_ref().ok_or(StoreError::Corrupt)?)?;
                if i.to_frame()? != raw || Some(b) != binding {
                    return Err(StoreError::Corrupt);
                }
                included = included.checked_add(1).ok_or(StoreError::Corrupt)?;
            }
            _ => return Err(StoreError::Corrupt),
        }
        if out
            .insert(
                id,
                Entry {
                    intent,
                    state,
                    binding,
                    receipt: saved,
                },
            )
            .is_some()
        {
            return Err(StoreError::Corrupt);
        }
    }
    if u64::try_from(out.len()).map_err(|_| StoreError::Corrupt)? != cut.count
        || included != cut.included
        || cut.last.is_some()
    {
        return Err(StoreError::Corrupt);
    }
    for (table, total) in [
        ("intent_integrity", cut.count),
        ("receipts", included),
        ("receipt_integrity", included),
    ] {
        let n: i64 = c.query_row(&format!("SELECT count(*) FROM {table}"), [], |r| r.get(0))?;
        if schema::unsigned(n)? != total {
            return Err(StoreError::Corrupt);
        }
    }
    Ok(out)
}
pub(super) fn validate_pending(
    w: &Witness,
    i: &preflight::Inspection,
    location: &Path,
) -> StoreResult<()> {
    let p = w.pending.as_ref().ok_or(StoreError::Corrupt)?;
    if i.cut != w.cut && i.cut != p.after {
        return Err(StoreError::Corrupt);
    }
    match p.mutation {
        Mutation::Append => {
            let request = PreparedOperationRequest::from_frame(&p.request)?;
            if w.subject.identity.as_ref().map(Identity::change_key)
                != Some(request.typed.target.clone())
                || p.after.count != w.cut.count.checked_add(1).ok_or(StoreError::Corrupt)?
                || p.after.last.as_ref() != Some(&request.typed.operation.id)
                || p.after.included != 0
            {
                return Err(StoreError::Corrupt);
            }
            let history = i.history.as_ref().ok_or(StoreError::Corrupt)?;
            let present = history
                .records
                .iter()
                .find(|r| r.operation.id == request.typed.operation.id);
            if i.cut == p.after {
                if present.ok_or(StoreError::Corrupt)?.operation_request()? != request.typed
                    || history.requests.get(&request.typed.operation.id) != Some(&p.request)
                {
                    return Err(StoreError::Corrupt);
                }
            } else if present.is_some() {
                return Err(StoreError::Corrupt);
            }
        }
        Mutation::Activate => {
            let h = i.history.as_ref().ok_or(StoreError::Corrupt)?;
            validate_receipt(&p.request, &w.subject, &h.records, &h.requests)?;
            if p.after.count != w.cut.count
                || p.after.last != w.cut.last
                || p.after.included != 0
                || (i.cut == p.after && i.activation.as_ref() != Some(&p.request))
                || (i.cut == w.cut && i.activation.is_some())
            {
                return Err(StoreError::Corrupt);
            }
        }
        Mutation::Provision => {
            if w.cut != Cut::empty()
                || p.after
                    != (Cut {
                        revision: 1,
                        ..Cut::empty()
                    })
            {
                return Err(StoreError::Corrupt);
            }
            validate_provision(&w.subject, &p.request, location)?;
        }
        Mutation::Reserve | Mutation::Bind | Mutation::Include => {
            let entries = i.entries.as_ref().ok_or(StoreError::Corrupt)?;
            let (intent, binding, first_raw) = if p.mutation == Mutation::Include {
                let (a, b) = read_receipt(&p.request)?;
                (a, Some(b), None)
            } else if p.mutation == Mutation::Bind {
                let mut r = Reader::new(&p.request);
                let b = r.binding()?;
                let raw = r.bytes(DESCRIPTOR)?;
                let a = CreationIntent::from_frame(raw)?;
                r.end()?;
                (a, Some(b), Some(raw))
            } else {
                (
                    CreationIntent::from_frame(&p.request)?,
                    None,
                    Some(p.request.as_slice()),
                )
            };
            if intent.issuer.binding != w.subject.binding {
                return Err(StoreError::Corrupt);
            }
            let entry = entries.get(&intent.identity.change);
            if let (Some(entry), Some(raw)) = (entry, first_raw) {
                // Fixed private wrapper is deterministic; embedded Protobuf bytes are copied
                // verbatim. This checks independent originals, NOT incoming retry identity.
                if entry.intent.to_frame()?.as_slice() != raw {
                    return Err(StoreError::Corrupt);
                }
            }
            if i.cut == p.after {
                let entry = entry.ok_or(StoreError::Corrupt)?;
                if !entry.intent.same(&intent)
                    || (p.mutation == Mutation::Reserve && entry.state != 0)
                    || (p.mutation == Mutation::Bind
                        && (entry.state != 1 || entry.binding != binding))
                    || (p.mutation == Mutation::Include
                        && (entry.state != 2 || entry.receipt.as_ref() != Some(&p.request)))
                {
                    return Err(StoreError::Corrupt);
                }
            } else if (p.mutation == Mutation::Reserve && entry.is_some())
                || (p.mutation != Mutation::Reserve
                    && entry.is_none_or(|e| {
                        !e.intent.same(&intent)
                            || e.state != if p.mutation == Mutation::Bind { 0 } else { 1 }
                    }))
            {
                return Err(StoreError::Corrupt);
            }
            let count = w
                .cut
                .count
                .checked_add(u64::from(p.mutation == Mutation::Reserve))
                .ok_or(StoreError::Corrupt)?;
            let included = w
                .cut
                .included
                .checked_add(u64::from(p.mutation == Mutation::Include))
                .ok_or(StoreError::Corrupt)?;
            if p.after.count != count || p.after.included != included || p.after.last.is_some() {
                return Err(StoreError::Corrupt);
            }
        }
    }
    Ok(())
}
pub(super) fn validate_provision(
    subject: &Subject,
    bytes: &[u8],
    location: &Path,
) -> StoreResult<()> {
    match subject.kind {
        Kind::Register => {
            if bytes.len() > 8192 {
                return Err(StoreError::Limit);
            }
            let mut r = Reader::new(bytes);
            if r.raw(6)? != b"CKBOOT" {
                return Err(StoreError::Corrupt);
            }
            read_profile(&mut r)?;
            let path = r.path()?;
            let ledger = LedgerIdentity {
                owner: OwnerId::from_bytes(r.id()?)?,
                ledger: LedgerId::from_bytes(r.id()?)?,
            };
            r.end()?;
            if path.as_os_str() != location.as_os_str()
                || ledger != subject.ledger
                || subject.identity.is_some()
                || subject.issuer != subject.binding
            {
                return Err(StoreError::Corrupt);
            }
        }
        Kind::Original => {
            let intent = CreationIntent::from_frame(bytes)?;
            if intent.path.as_os_str() != location.as_os_str()
                || subject.identity.as_ref() != Some(&intent.identity)
                || intent.issuer.selection.ledger != subject.ledger
                || intent.issuer.binding != subject.issuer
            {
                return Err(StoreError::Corrupt);
            }
        }
    }
    Ok(())
}
impl<B: TrustedLocal> Register<B> {
    pub fn bootstrap_new(
        path: &Path,
        ledger: LedgerIdentity,
        mut boundary: B,
        verification: &Path,
    ) -> StoreResult<Self> {
        let mut w = Writer::new(8192);
        w.raw(b"CKBOOT")?;
        write_profile(&mut w)?;
        w.path(path)?;
        w.raw(ledger.owner.as_bytes())?;
        w.raw(ledger.ledger.as_bytes())?;
        let raw = w.finish();
        let mut store = {
            let mut guard = boundary.lock()?;
            guard.authorize_custody(&ledger, CustodyUse::Bootstrap(path))?;
            guard.authorize_custody(&ledger, CustodyUse::Verify(verification))?;
            local::owner(&guard.context()?, &ledger)?;
            let mut store = Backend::allocate(
                path,
                ledger.clone(),
                None,
                None,
                &raw,
                verification,
                &mut guard,
            )?;
            store.provision(&mut guard)?;
            store
        };
        store.live()?;
        let reference = RegisterReference {
            selection: RegisterSelection {
                location: path.to_owned(),
                ledger,
            },
            binding: store.custody.binding(),
        };
        Ok(Self {
            store,
            boundary,
            entries: Entries::new(),
            reference,
        })
    }
    pub fn open(
        selection: &RegisterSelection,
        mut boundary: B,
        verification: &Path,
    ) -> StoreResult<Self> {
        let (store, inspection) = {
            let mut guard = boundary.lock()?;
            guard.authorize_custody(
                &selection.ledger,
                CustodyUse::OpenRegister(&selection.location),
            )?;
            guard.authorize_custody(&selection.ledger, CustodyUse::Verify(verification))?;
            let peek = WriterCustody::open(&selection.location)?;
            let subject = Witness::read(&peek)?.subject;
            drop(peek);
            if subject.kind != Kind::Register
                || subject.ledger != selection.ledger
                || subject.issuer != subject.binding
            {
                return Err(StoreError::Custody);
            }
            Backend::open(
                &selection.location,
                &subject,
                verification,
                &mut guard,
                |_| Ok(()),
            )?
        };
        let reference = RegisterReference {
            selection: selection.clone(),
            binding: store.custody.binding(),
        };
        Ok(Self {
            store,
            boundary,
            entries: inspection.entries.ok_or(StoreError::Corrupt)?,
            reference,
        })
    }
    pub fn reference(&self) -> RegisterReference {
        self.reference.clone()
    }
    pub fn create<C: TrustedLocal>(
        &mut self,
        intent: &CreationIntent,
        original_boundary: &mut C,
    ) -> StoreResult<CreationProgress> {
        self.reconcile(intent, original_boundary)
    }
    pub fn reconcile<C: TrustedLocal>(
        &mut self,
        incoming: &CreationIntent,
        original_boundary: &mut C,
    ) -> StoreResult<CreationProgress> {
        self.store.live()?;
        incoming.check()?;
        if incoming.issuer != self.reference {
            return Err(StoreError::Custody);
        }
        let id = incoming.identity.change.clone();
        // Only this successful in-call reservation proves allocation was never attempted.
        // Existing Reserved state alone cannot distinguish an absent original from lost objects.
        let fresh_reservation = !self.entries.contains_key(&id);
        if let Some(e) = self.entries.get(&id) {
            if !e.intent.same(incoming) {
                return Err(StoreError::Refused(Error::Conflict));
            }
        } else {
            let raw = incoming.to_frame()?;
            let mut after = self.store.witness.cut.advance()?;
            after.count = after.count.checked_add(1).ok_or(StoreError::Limit)?;
            let mut guard = self.boundary.lock()?;
            guard.authorize_custody(
                &self.reference.selection.ledger,
                CustodyUse::Reserve(&incoming.identity),
            )?;
            local::owner(&guard.context()?, &self.reference.selection.ledger)?;
            self.store
                .mutate(Mutation::Reserve, &raw, after, &mut guard, |c| {
                    c.execute(
                        "INSERT INTO entries VALUES(?1,0,?2,NULL)",
                        params![id.as_bytes().as_slice(), &raw],
                    )?;
                    c.execute(
                        "INSERT INTO intent_integrity VALUES(?1,?2)",
                        params![id.as_bytes().as_slice(), &raw],
                    )?;
                    Ok(())
                })?;
            self.entries.insert(
                id.clone(),
                Entry {
                    intent: incoming.clone(),
                    state: 0,
                    binding: None,
                    receipt: None,
                },
            );
        }
        // Reload FIRST retained bytes, never replace them with incoming noncanonical encoding.
        let mut entry = self.entries.get(&id).ok_or(StoreError::Corrupt)?.clone();
        let raw = entry.intent.to_frame()?;
        let intent = entry.intent.clone();
        let mut pending_store = if entry.state == 0 {
            let mut guard = original_boundary.lock()?;
            guard.authorize_custody(
                &self.reference.selection.ledger,
                CustodyUse::Allocate(&intent.identity, &intent.path),
            )?;
            guard.authorize_custody(
                &self.reference.selection.ledger,
                CustodyUse::Verify(&self.store.verification),
            )?;
            local::owner(&guard.context()?, &self.reference.selection.ledger)?;
            if intent.path.exists() {
                let custody =
                    WriterCustody::open(&intent.path).map_err(|_| StoreError::BlockedOrphan)?;
                let alloc = Witness::read_named(&custody, "allocation.ctrl")
                    .map_err(|_| StoreError::BlockedOrphan)?;
                let subject = alloc.subject;
                drop(custody);
                if subject.kind != Kind::Original
                    || subject.identity.as_ref() != Some(&intent.identity)
                    || subject.issuer != self.reference.binding
                {
                    return Err(StoreError::BlockedOrphan);
                }
                Backend::allocated(&intent.path, &subject, &raw, &self.store.verification)?
            } else {
                if !fresh_reservation {
                    return Err(StoreError::BlockedOrphan);
                }
                Backend::allocate(
                    &intent.path,
                    self.reference.selection.ledger.clone(),
                    Some(intent.identity.clone()),
                    Some(self.reference.binding.clone()),
                    &raw,
                    &self.store.verification,
                    &mut guard,
                )?
            }
        } else {
            let subject = Subject {
                kind: Kind::Original,
                ledger: self.reference.selection.ledger.clone(),
                identity: Some(intent.identity.clone()),
                issuer: self.reference.binding.clone(),
                binding: entry.binding.clone().ok_or(StoreError::Corrupt)?,
            };
            let mut guard = original_boundary.lock()?;
            guard.authorize_custody(
                &subject.ledger,
                CustodyUse::OpenOriginal(&intent.identity, &intent.path),
            )?;
            // Known unactivated preparation may resume only under the bound root request.
            let peek = WriterCustody::open(&intent.path)?;
            let witness = Witness::read(&peek)?;
            drop(peek);
            if witness.phase == Phase::Preparing
                && witness
                    .pending
                    .as_ref()
                    .is_some_and(|p| p.stage == Stage::Prepared)
            {
                Backend::allocated(&intent.path, &subject, &raw, &self.store.verification)?
            } else {
                Backend::open(
                    &intent.path,
                    &subject,
                    &self.store.verification,
                    &mut guard,
                    |i| {
                        if i.cut.count > 1 && i.activation.is_none() {
                            return Err(StoreError::Corrupt);
                        }
                        Ok(())
                    },
                )?
                .0
            }
        };
        #[cfg(test)]
        super::tests::cuts::pause("allocated-before-bind");
        if entry.state == 0 {
            let binding = pending_store.custody.binding();
            let mut bind = Writer::new(DESCRIPTOR);
            bind.binding(&binding)?;
            bind.bytes(&raw, DESCRIPTOR)?;
            let descriptor = bind.finish();
            // Precompute eventual receipt before binding/Start, including all nested overhead.
            receipt(&raw, &binding)?;
            let after = self.store.witness.cut.advance()?;
            let mut guard = self.boundary.lock()?;
            guard.authorize_custody(
                &self.reference.selection.ledger,
                CustodyUse::BindChange(&intent.identity),
            )?;
            local::owner(&guard.context()?, &self.reference.selection.ledger)?;
            let mut w = Writer::new(48);
            w.binding(&binding)?;
            let bytes = w.finish();
            self.store
                .mutate(Mutation::Bind, &descriptor, after, &mut guard, |c| {
                    pending_store.custody.check()?;
                    if Witness::read(&pending_store.custody)? != pending_store.witness {
                        return Err(StoreError::Custody);
                    }
                    if c.execute(
                        "UPDATE entries SET state=1,binding=?1 WHERE change=?2 AND state=0",
                        params![bytes, id.as_bytes().as_slice()],
                    )? != 1
                    {
                        return Err(StoreError::Corrupt);
                    }
                    Ok(())
                })?;
            entry.state = 1;
            entry.binding = Some(binding);
            self.entries.insert(id.clone(), entry.clone());
        }
        if pending_store.connection.is_none() {
            let mut guard = original_boundary.lock()?;
            guard.authorize_custody(
                &self.reference.selection.ledger,
                CustodyUse::OpenOriginal(&intent.identity, &intent.path),
            )?;
            pending_store.provision(&mut guard)?;
        }
        let mut original = Original::pending(pending_store, original_boundary, None)?;
        original.start(&intent.start).map_err(|e| match e {
            OperationRequestError::Refused(e) => StoreError::Refused(e),
            _ => StoreError::Indeterminate,
        })?;
        // Public progress always rechecks current disclosure, even after another phase fails.
        if entry.state == 1 {
            let bytes = receipt(&raw, entry.binding.as_ref().ok_or(StoreError::Corrupt)?)?;
            let mut after = self.store.witness.cut.advance()?;
            after.included = after.included.checked_add(1).ok_or(StoreError::Limit)?;
            let finalization = (|| {
                let mut guard = self.boundary.lock()?;
                guard.authorize_custody(
                    &self.reference.selection.ledger,
                    CustodyUse::Include(&intent.identity),
                )?;
                local::owner(&guard.context()?, &self.reference.selection.ledger)?;
                self.store
                    .mutate(Mutation::Include, &bytes, after, &mut guard, |c| {
                        original.store.live()?;
                        if original.store.witness.cut.count != 1 {
                            return Err(StoreError::Corrupt);
                        }
                        if c.execute(
                            "UPDATE entries SET state=2 WHERE change=?1 AND state=1",
                            [id.as_bytes().as_slice()],
                        )? != 1
                        {
                            return Err(StoreError::Corrupt);
                        }
                        c.execute(
                            "INSERT INTO receipts VALUES(?1,?2)",
                            params![id.as_bytes().as_slice(), &bytes],
                        )?;
                        c.execute(
                            "INSERT INTO receipt_integrity VALUES(?1,?2)",
                            params![id.as_bytes().as_slice(), &bytes],
                        )?;
                        Ok(())
                    })
            })();
            if finalization.is_err() {
                return match original.resolve_original(&intent.start)? {
                    OriginalOutcome::Accepted(a) => {
                        Ok(CreationProgress::StartAcceptedPendingInclusion(a))
                    }
                    OriginalOutcome::NotAccepted => Err(StoreError::Corrupt),
                };
            }
            entry.state = 2;
            entry.receipt = Some(bytes);
            self.entries.insert(id.clone(), entry.clone());
        }
        let saved = entry.receipt.as_ref().ok_or(StoreError::Corrupt)?;
        let activated = original.activate(saved);
        let accepted = match original.resolve_original(&intent.start)? {
            OriginalOutcome::Accepted(a) => a,
            OriginalOutcome::NotAccepted => return Err(StoreError::Corrupt),
        };
        if activated.is_err() {
            return Ok(CreationProgress::StartAcceptedPendingActivation(accepted));
        }
        let reference = receipt_reference(saved)?;
        drop(original);
        Ok(CreationProgress::Ready {
            reference: Box::new(reference),
            start: accepted,
        })
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::sqlite::tests::{staging, support};
    use crate::kernel::change::{ContentId, ContentKey, ContentReference, FreshContent};
    use std::collections::BTreeSet;
    fn content(id: &Identity, n: u8) -> ContentKey {
        ContentKey {
            establishing: id.change_key(),
            id: ContentId::from_bytes([n; 16]).unwrap(),
        }
    }
    #[test]
    fn parsed_intent_checks_all_nested_envelopes_before_any_reservation_or_allocation() {
        let id = support::identity(24);
        let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
        let nonce = control::hex(&crate::adapters::ids::candidate().unwrap());
        let reg = root.join(format!("p33-bounds-reg-{nonce}"));
        let original = root.join(format!("p33-bounds-original-{nonce}"));
        let local = support::local(&id, &reg, &original, &root);
        let mut registry = Register::bootstrap_new(
            &reg,
            LedgerIdentity {
                owner: id.owner.clone(),
                ledger: id.ledger.clone(),
            },
            local.clone(),
            &root,
        )
        .unwrap();
        let mut intent = CreationIntent {
            issuer: registry.reference(),
            identity: id.clone(),
            path: PathBuf::from(format!("/{}", "o".repeat(4095))),
            start: support::start(&local, &id),
        };
        intent.issuer.selection.location = PathBuf::from(format!("/{}", "r".repeat(4095)));
        let overhead = intent.to_frame().unwrap().len() - intent.start.frame().len();
        let target = DESCRIPTOR - overhead - 16;
        assert!(target < control::FRAME);
        // Codec-shape-valid input at the actual ceiling. Owner-fresh semantics are never
        // authorized here: nested encoding must refuse this declaration before any claim.
        let references: BTreeSet<_> = (1u64..=4096)
            .map(|n| {
                let mut bytes = [0; 16];
                bytes[..8].copy_from_slice(&n.to_be_bytes());
                ContentReference {
                    identity: id.clone(),
                    operation: OperationId::from_bytes(bytes).unwrap(),
                    content: content(&id, 80),
                }
            })
            .collect();
        let mut operation_request = intent.start.operation_request().clone();
        operation_request.operation.first_retention.clear();
        operation_request.operation.command = Command::Initiate {
            wish: content(&id, 32),
            access: Access::Owner,
        };
        operation_request.operation.fresh = (0..8)
            .map(|n| FreshContent {
                key: content(&id, 32 + n),
                derived_from: references.clone(),
                bytes: vec![7; 1024 * 1024],
                attributed_source: id.owner_actor.clone(),
            })
            .collect();
        loop {
            let raw = crate::adapters::codec::encode_request(&operation_request).unwrap();
            if raw.len() >= target {
                break;
            }
            let n = operation_request.operation.fresh.len();
            assert!(n < 64);
            operation_request.operation.fresh.push(FreshContent {
                key: content(&id, 32 + n as u8),
                derived_from: references.clone(),
                bytes: Vec::new(),
                attributed_source: id.owner_actor.clone(),
            });
            if crate::adapters::codec::encode_request(&operation_request).is_err() {
                let mut low = 0usize;
                let mut high = 4096usize;
                while low < high {
                    let mid = (low + high).div_ceil(2);
                    operation_request
                        .operation
                        .fresh
                        .last_mut()
                        .unwrap()
                        .derived_from = references.iter().take(mid).cloned().collect();
                    if crate::adapters::codec::encode_request(&operation_request).is_ok() {
                        low = mid
                    } else {
                        high = mid - 1
                    }
                }
                operation_request
                    .operation
                    .fresh
                    .last_mut()
                    .unwrap()
                    .derived_from = references.iter().take(low).cloned().collect();
                break;
            }
        }
        let raw = crate::adapters::codec::encode_request(&operation_request).unwrap();
        assert!(raw.len() >= target, "codec must reach nested boundary");
        let delta = raw.len() - target;
        assert!(delta < 1024 * 1024);
        operation_request.operation.fresh[0]
            .bytes
            .truncate(1024 * 1024 - delta);
        intent.start =
            PreparedOperationRequest::from_operation_request(&operation_request).unwrap();
        assert_eq!(intent.start.frame().len(), target);
        let frame = intent.to_frame().unwrap();
        assert_eq!(frame.len(), DESCRIPTOR - 16);
        assert!(matches!(
            CreationIntent::from_frame(&frame),
            Err(StoreError::Limit)
        ));
        let before = registry.store.witness.cut.clone();
        assert!(matches!(
            registry.reconcile(&intent, &mut local.clone()),
            Err(StoreError::Limit)
        ));
        assert_eq!(registry.store.witness.cut, before);
        assert!(!original.exists());
    }
    #[test]
    fn zero_row_include_cannot_publish_a_receipt_or_included_head() {
        let id = support::identity(26);
        let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE"))).unwrap();
        let nonce = control::hex(&crate::adapters::ids::candidate().unwrap());
        let reg = root.join(format!("p33-zero-include-reg-{nonce}"));
        let original = root.join(format!("p33-zero-include-original-{nonce}"));
        let local = support::local(&id, &reg, &original, &root);
        let mut registry = Register::bootstrap_new(
            &reg,
            LedgerIdentity {
                owner: id.owner.clone(),
                ledger: id.ledger.clone(),
            },
            local.clone(),
            &root,
        )
        .unwrap();
        let intent = CreationIntent::try_new(
            registry.reference(),
            id.clone(),
            original,
            support::start(&local, &id),
        )
        .unwrap();
        // Same private connection, no statement active during this synchronous guard callback.
        let handle = unsafe { registry.store.connection.as_ref().unwrap().handle() } as usize;
        local.0.lock().unwrap().include_hook = Some(Box::new(move || {
            let sql = std::ffi::CString::new("UPDATE entries SET state=0,binding=NULL").unwrap();
            // SAFETY: test-owned live connection on the owning thread; intentional corruption.
            assert_eq!(
                unsafe {
                    libsqlite3_sys::sqlite3_exec(
                        handle as *mut libsqlite3_sys::sqlite3,
                        sql.as_ptr(),
                        None,
                        std::ptr::null_mut(),
                        std::ptr::null_mut(),
                    )
                },
                libsqlite3_sys::SQLITE_OK
            );
        }));
        assert!(matches!(
            registry.create(&intent, &mut local.clone()).unwrap(),
            CreationProgress::StartAcceptedPendingInclusion(_)
        ));
        let c = registry.store.connection.as_ref().unwrap();
        assert_eq!(
            c.query_row("SELECT count(*) FROM receipts", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            0
        );
        assert_eq!(schema::head(c).unwrap().included, 0);
        assert!(registry.store.fenced);
    }
}
