//! Bounded mutable outside-WAL witness. Not a second history, MAC or rollback oracle.
use super::custody::{CustodyBinding, WriterCustody};
use super::local::LedgerIdentity;
use super::store_error::{StoreError, StoreResult};
use crate::application::change::Change;
use crate::application::operation_request::CURRENT_PROFILE;
use crate::application::read_budget::ReadBudget;
use crate::kernel::change::{ActorId, ChangeId, Identity, LedgerId, OperationId, OwnerId};
use std::fs;
use std::io::{Read, Write};
use std::path::Path;

pub(super) const FRAME: usize = 16 * 1024 * 1024;
pub(super) const DESCRIPTOR: usize = FRAME + 8192;
const PAYLOAD: usize = FRAME + 16384;
const HEADER: usize = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Kind {
    Register,
    Original,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Phase {
    Preparing,
    PreparingOpen,
    Live,
    Closing,
    Clean,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Stage {
    Prepared,
    CommitPossible,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Mutation {
    Provision,
    Append,
    Reserve,
    Bind,
    Include,
    Activate,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Cut {
    pub revision: u64,
    // Register: reservations/included. Original: operation count/zero.
    pub count: u64,
    pub included: u64,
    pub last: Option<OperationId>,
}
impl Cut {
    pub fn empty() -> Self {
        Self {
            revision: 0,
            count: 0,
            included: 0,
            last: None,
        }
    }
    pub fn advance(&self) -> StoreResult<Self> {
        let mut next = self.clone();
        next.revision = next.revision.checked_add(1).ok_or(StoreError::Corrupt)?;
        Ok(next)
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Subject {
    pub kind: Kind,
    pub ledger: LedgerIdentity,
    pub identity: Option<Identity>,
    pub issuer: CustodyBinding,
    pub binding: CustodyBinding,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Pending {
    pub stage: Stage,
    pub mutation: Mutation,
    pub after: Cut,
    pub request: Vec<u8>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Witness {
    pub subject: Subject,
    pub generation: u64,
    pub parent: u64,
    pub epoch: u64,
    pub phase: Phase,
    pub journals: [Option<(u64, u64)>; 2],
    pub cut: Cut,
    pub pending: Option<Pending>,
    object: (u64, u64),
}
impl Witness {
    /// Only the two initial provisioning cuts are meaningful. The immutable allocation
    /// manifest must be the Prepared one; canonical CommitPossible differs only by stage.
    pub fn initial_provision(&self) -> StoreResult<&Pending> {
        let p = self.pending.as_ref().ok_or(StoreError::Corrupt)?;
        let generation = match p.stage {
            Stage::Prepared => 1,
            Stage::CommitPossible => 2,
        };
        if self.phase != Phase::Preparing
            || self.epoch != 0
            || self.cut != Cut::empty()
            || self.journals.iter().any(Option::is_some)
            || self.generation != generation
            || self.parent != generation - 1
            || p.mutation != Mutation::Provision
            || p.after
                != (Cut {
                    revision: 1,
                    ..Cut::empty()
                })
        {
            return Err(StoreError::Corrupt);
        }
        Ok(p)
    }
    pub fn new(subject: Subject) -> Self {
        Self {
            subject,
            generation: 0,
            parent: 0,
            epoch: 0,
            phase: Phase::Preparing,
            journals: [None; 2],
            cut: Cut::empty(),
            pending: None,
            object: (0, 0),
        }
    }
    pub fn read(custody: &WriterCustody) -> StoreResult<Self> {
        Self::read_named(custody, "custody.ctrl")
    }
    pub fn read_bounded(custody: &WriterCustody, budget: &mut ReadBudget) -> StoreResult<Self> {
        Self::read_named_inner(custody, "custody.ctrl", Some(budget))
    }
    pub fn read_named(custody: &WriterCustody, name: &str) -> StoreResult<Self> {
        Self::read_named_inner(custody, name, None)
    }
    fn read_named_inner(
        custody: &WriterCustody,
        name: &str,
        mut budget: Option<&mut ReadBudget>,
    ) -> StoreResult<Self> {
        if !matches!(name, "custody.ctrl" | "allocation.ctrl") {
            return Err(StoreError::Custody);
        }
        custody.check()?;
        let mut file = custody.member(name, false)?;
        let object = custody.file_object(&file)?;
        let length = file.metadata()?.len();
        let mut header = [0; HEADER];
        if let Some(b) = &mut budget {
            b.source(length)?;
            b.io(HEADER as u64)?;
            b.work(8192)?;
        }
        file.read_exact(&mut header)?;
        let (kind, generation, size) = parse_header(&header, b"CKLC")?;
        if length != 128 + 2 * u64::try_from(size).map_err(|_| StoreError::Corrupt)? {
            return Err(StoreError::Corrupt);
        }
        if let Some(b) = &mut budget {
            b.io((size * 2 + HEADER) as u64)?;
            b.allocate((size * 2 + std::mem::size_of::<Self>()) as u64)?;
            b.work((size * 2 + 8192) as u64)?;
        }
        let mut bytes = vec![0; size]; // Fixed header/tuple/length validated first.
        file.read_exact(&mut bytes)?;
        let mut at = 0;
        let mut chunk = [0; 65536];
        while at < size {
            let take = (size - at).min(chunk.len());
            file.read_exact(&mut chunk[..take])?;
            if chunk[..take] != bytes[at..at + take] {
                return Err(StoreError::Corrupt);
            }
            at += take;
        }
        let mut footer = [0; HEADER];
        file.read_exact(&mut footer)?;
        let parsed = parse_header(&footer, b"CKLE")?;
        if parsed != (kind, generation, size) || header[4..] != footer[4..] {
            return Err(StoreError::Corrupt);
        }
        let mut r = Reader::new(&bytes);
        let subject = r.subject()?;
        let parent = r.u64()?;
        let epoch = r.u64()?;
        let phase = match r.byte()? {
            0 => Phase::Preparing,
            1 => Phase::PreparingOpen,
            2 => Phase::Live,
            3 => Phase::Closing,
            4 => Phase::Clean,
            _ => return Err(StoreError::Corrupt),
        };
        let stored_object = (r.u64()?, r.u64()?);
        let journals = [r.object()?, r.object()?];
        let cut = r.cut()?;
        let pending = match r.byte()? {
            0 => None,
            1 => Some(Pending {
                stage: match r.byte()? {
                    0 => Stage::Prepared,
                    1 => Stage::CommitPossible,
                    _ => return Err(StoreError::Corrupt),
                },
                mutation: match r.byte()? {
                    0 => Mutation::Provision,
                    1 => Mutation::Append,
                    2 => Mutation::Reserve,
                    3 => Mutation::Bind,
                    4 => Mutation::Include,
                    5 => Mutation::Activate,
                    _ => return Err(StoreError::Corrupt),
                },
                after: r.cut()?,
                request: r.bytes(DESCRIPTOR)?.to_vec(),
            }),
            _ => return Err(StoreError::Corrupt),
        };
        r.end()?;
        let value = Self {
            subject,
            generation,
            parent,
            epoch,
            phase,
            journals,
            cut,
            pending,
            object: stored_object,
        };
        value.validate()?;
        if stored_object != object
            || value.subject.kind != kind
            || value.subject.binding != custody.binding()
        {
            return Err(StoreError::Custody);
        }
        custody.check()?;
        #[cfg(test)]
        if name == "custody.ctrl" {
            continuity_cut(true, custody);
        }
        if custody.member_object(name)? != Some(object) {
            return Err(StoreError::Custody);
        }
        Ok(value)
    }
    fn validate(&self) -> StoreResult<()> {
        if self.generation == 0 || self.parent.checked_add(1) != Some(self.generation) {
            return Err(StoreError::Corrupt);
        }
        let s = &self.subject;
        match (&s.kind, &s.identity) {
            (Kind::Register, None) => {}
            (Kind::Original, Some(id))
                if id.owner == s.ledger.owner && id.ledger == s.ledger.ledger =>
            {
                Change::try_new(id.clone())?;
            }
            _ => return Err(StoreError::Corrupt),
        }
        let valid_cut = |c: &Cut| match s.kind {
            Kind::Register => c.last.is_none() && c.included <= c.count,
            Kind::Original => {
                c.included == 0
                    && ((c.count == 0 && c.last.is_none()) || (c.count > 0 && c.last.is_some()))
            }
        };
        if !valid_cut(&self.cut) {
            return Err(StoreError::Corrupt);
        }
        if let Some(p) = &self.pending {
            if !valid_cut(&p.after)
                || self.cut.revision.checked_add(1) != Some(p.after.revision)
                || matches!(self.phase, Phase::Closing | Phase::Clean)
            {
                return Err(StoreError::Corrupt);
            }
            if (p.mutation == Mutation::Append && s.kind != Kind::Original)
                || (matches!(
                    p.mutation,
                    Mutation::Reserve | Mutation::Bind | Mutation::Include
                ) && s.kind != Kind::Register)
                || (p.mutation == Mutation::Activate && s.kind != Kind::Original)
            {
                return Err(StoreError::Corrupt);
            }
        }
        if matches!(self.phase, Phase::Live | Phase::Closing)
            && self.journals.iter().any(Option::is_none)
        {
            return Err(StoreError::Corrupt);
        }
        Ok(())
    }
    fn payload(&self) -> StoreResult<Vec<u8>> {
        let mut w = Writer::new(PAYLOAD);
        w.subject(&self.subject)?;
        w.u64(self.parent)?;
        w.u64(self.epoch)?;
        w.byte(match self.phase {
            Phase::Preparing => 0,
            Phase::PreparingOpen => 1,
            Phase::Live => 2,
            Phase::Closing => 3,
            Phase::Clean => 4,
        })?;
        w.u64(self.object.0)?;
        w.u64(self.object.1)?;
        for j in self.journals {
            w.object(j)?;
        }
        w.cut(&self.cut)?;
        match &self.pending {
            None => w.byte(0)?,
            Some(p) => {
                w.byte(1)?;
                w.byte(match p.stage {
                    Stage::Prepared => 0,
                    Stage::CommitPossible => 1,
                })?;
                w.byte(match p.mutation {
                    Mutation::Provision => 0,
                    Mutation::Append => 1,
                    Mutation::Reserve => 2,
                    Mutation::Bind => 3,
                    Mutation::Include => 4,
                    Mutation::Activate => 5,
                })?;
                w.cut(&p.after)?;
                w.bytes(&p.request, DESCRIPTOR)?;
            }
        }
        Ok(w.finish())
    }
    /// Validate the entire next envelope BEFORE creating a temp or changing SQL state.
    pub fn encodable(&self) -> StoreResult<()> {
        self.payload().map(|_| ())
    }
    pub fn publish(&mut self, custody: &WriterCustody) -> StoreResult<()> {
        custody.check()?;
        if self.generation != 0 && Self::read(custody)? != *self {
            return Err(StoreError::Custody);
        }
        // Callers mutate a clone via replace(); never publish edited current state directly.
        let expected = (self.generation != 0).then(|| self.clone());
        self.write_next(custody, "custody.ctrl", expected.as_ref())
    }
    pub fn publish_allocation(&mut self, custody: &WriterCustody) -> StoreResult<()> {
        if self.generation != 0 || self.phase != Phase::Preparing {
            return Err(StoreError::Corrupt);
        }
        self.write_next(custody, "allocation.ctrl", None)
    }
    pub fn replace(&mut self, custody: &WriterCustody, mut next: Self) -> StoreResult<()> {
        if Self::read(custody)? != *self || next.subject != self.subject {
            return Err(StoreError::Custody);
        }
        self.transition(&next)?;
        next.generation = self.generation;
        next.parent = self.parent;
        next.write_next(custody, "custody.ctrl", Some(self))?;
        *self = next;
        Ok(())
    }
    fn transition(&self, next: &Self) -> StoreResult<()> {
        let valid = match (&self.pending, &next.pending) {
            (None, None) => self.cut == next.cut,
            (None, Some(p)) => p.stage == Stage::Prepared && self.cut == next.cut,
            (Some(old), Some(new)) => {
                self.cut == next.cut
                    && old.mutation == new.mutation
                    && old.request == new.request
                    && old.after == new.after
                    && (old.stage == new.stage
                        || (old.stage == Stage::Prepared && new.stage == Stage::CommitPossible))
            }
            (Some(p), None) => match p.stage {
                Stage::Prepared => next.cut == self.cut,
                Stage::CommitPossible => next.cut == p.after,
            },
        };
        if !valid {
            return Err(StoreError::Corrupt);
        }
        let lifecycle = match (self.phase, next.phase) {
            (a, b) if a == b => true,
            (Phase::Preparing, Phase::Live)
            | (Phase::Preparing, Phase::PreparingOpen)
            | (Phase::PreparingOpen, Phase::Live)
            | (Phase::Live, Phase::PreparingOpen)
            | (Phase::Clean, Phase::PreparingOpen)
            | (Phase::Live, Phase::Closing)
            | (Phase::Closing, Phase::Clean)
            | (Phase::Closing, Phase::PreparingOpen) => true,
            _ => false,
        };
        if !lifecycle
            || (self.phase == Phase::Live
                && next.phase == Phase::Live
                && (self.journals != next.journals || self.epoch != next.epoch))
        {
            return Err(StoreError::Corrupt);
        }
        Ok(())
    }
    fn write_next(
        &mut self,
        custody: &WriterCustody,
        canonical: &str,
        expected: Option<&Self>,
    ) -> StoreResult<()> {
        let parent = self.generation;
        let generation = parent.checked_add(1).ok_or(StoreError::Corrupt)?;
        let mut next = self.clone();
        next.parent = parent;
        next.generation = generation;
        // Fixed object fields have the same encoded size as the eventual inode.
        next.validate()?;
        next.encodable()?;
        let nonce = super::super::ids::candidate()?;
        let name = format!(".custody-next-{}", hex(&nonce));
        let mut file = custody.member(&name, true)?;
        next.object = custody.file_object(&file)?;
        let payload = next.payload()?;
        let header = make_header(next.subject.kind, generation, payload.len(), b"CKLC")?;
        file.write_all(&header)?;
        file.write_all(&payload)?;
        file.write_all(&payload)?;
        file.write_all(&make_header(
            next.subject.kind,
            generation,
            payload.len(),
            b"CKLE",
        )?)?;
        file.sync_all()?;
        custody.check()?;
        #[cfg(test)]
        if canonical == "custody.ctrl" {
            continuity_cut(false, custody);
        }
        if parent == 0 {
            // The private new directory and exclusive lease exclude cooperating publishers.
            // Even a malformed canonical remnant blocks initial publication. Hostile same-UID
            // pathname races are outside this profile; no global absence claim is made.
            match fs::symlink_metadata(custody.directory().join(canonical)) {
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                _ => return Err(StoreError::Custody),
            }
        } else if expected.is_none_or(|old| old.generation != parent)
            || Self::read_named(custody, canonical)? != *expected.ok_or(StoreError::Custody)?
        {
            return Err(StoreError::Custody);
        }
        fs::rename(
            custody.directory().join(&name),
            custody.directory().join(canonical),
        )?;
        custody.sync_directory()?;
        let actual = Self::read_named(custody, canonical)?;
        if actual != next {
            return Err(StoreError::Corrupt);
        }
        *self = next;
        Ok(())
    }
}
fn parse_header(h: &[u8; 64], magic: &[u8; 4]) -> StoreResult<(Kind, u64, usize)> {
    if &h[..4] != magic
        || h[4..8] != 1u32.to_be_bytes()
        || h[16..20] != CURRENT_PROFILE.codec.to_be_bytes()
        || h[20..24] != CURRENT_PROFILE.schema.to_be_bytes()
        || h[24..28] != CURRENT_PROFILE.semantic.to_be_bytes()
        || h[28..32] != [0; 4]
        || h[40..] != [0; 24]
    {
        return Err(StoreError::UnsupportedProfile);
    }
    let n = u32::from_be_bytes(h[8..12].try_into().map_err(|_| StoreError::Corrupt)?) as usize;
    if n > PAYLOAD {
        return Err(StoreError::Limit);
    }
    let kind = match u32::from_be_bytes(h[12..16].try_into().map_err(|_| StoreError::Corrupt)?) {
        0 => Kind::Register,
        1 => Kind::Original,
        _ => return Err(StoreError::UnsupportedProfile),
    };
    let generation = u64::from_be_bytes(h[32..40].try_into().map_err(|_| StoreError::Corrupt)?);
    Ok((kind, generation, n))
}
fn make_header(kind: Kind, generation: u64, size: usize, magic: &[u8; 4]) -> StoreResult<[u8; 64]> {
    if size > PAYLOAD {
        return Err(StoreError::Limit);
    }
    let mut h = [0; 64];
    h[..4].copy_from_slice(magic);
    h[4..8].copy_from_slice(&1u32.to_be_bytes());
    h[8..12].copy_from_slice(&(size as u32).to_be_bytes());
    h[12..16].copy_from_slice(&(if kind == Kind::Register { 0u32 } else { 1 }).to_be_bytes());
    h[16..20].copy_from_slice(&CURRENT_PROFILE.codec.to_be_bytes());
    h[20..24].copy_from_slice(&CURRENT_PROFILE.schema.to_be_bytes());
    h[24..28].copy_from_slice(&CURRENT_PROFILE.semantic.to_be_bytes());
    h[32..40].copy_from_slice(&generation.to_be_bytes());
    Ok(h)
}
pub(super) fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|v| format!("{v:02x}")).collect()
}

// Shared strict private descriptor codec. No Debug strings, serde/defaults, or Rust layout.
pub(super) struct Writer {
    bytes: Vec<u8>,
    limit: usize,
}
impl Writer {
    pub fn new(limit: usize) -> Self {
        Self {
            bytes: Vec::new(),
            limit,
        }
    }
    pub fn raw(&mut self, v: &[u8]) -> StoreResult<()> {
        if self
            .bytes
            .len()
            .checked_add(v.len())
            .ok_or(StoreError::Limit)?
            > self.limit
        {
            return Err(StoreError::Limit);
        }
        self.bytes.extend_from_slice(v);
        Ok(())
    }
    pub fn byte(&mut self, v: u8) -> StoreResult<()> {
        self.raw(&[v])
    }
    pub fn u64(&mut self, v: u64) -> StoreResult<()> {
        self.raw(&v.to_be_bytes())
    }
    pub fn bytes(&mut self, v: &[u8], max: usize) -> StoreResult<()> {
        if v.len() > max {
            return Err(StoreError::Limit);
        }
        self.raw(
            &u32::try_from(v.len())
                .map_err(|_| StoreError::Limit)?
                .to_be_bytes(),
        )?;
        self.raw(v)
    }
    pub fn path(&mut self, p: &Path) -> StoreResult<()> {
        use std::os::unix::ffi::OsStrExt;
        self.bytes(p.as_os_str().as_bytes(), 4096)
    }
    pub fn binding(&mut self, b: &CustodyBinding) -> StoreResult<()> {
        for v in [
            b.directory_device,
            b.directory_inode,
            b.database_device,
            b.database_inode,
            b.lock_device,
            b.lock_inode,
        ] {
            self.u64(v)?
        }
        Ok(())
    }
    pub fn identity(&mut self, id: &Identity) -> StoreResult<()> {
        for v in [
            id.owner.as_bytes(),
            id.ledger.as_bytes(),
            id.change.as_bytes(),
            id.owner_actor.as_bytes(),
            id.agent.as_bytes(),
        ] {
            self.raw(v)?
        }
        Ok(())
    }
    pub fn subject(&mut self, s: &Subject) -> StoreResult<()> {
        self.byte(if s.kind == Kind::Register { 0 } else { 1 })?;
        self.raw(s.ledger.owner.as_bytes())?;
        self.raw(s.ledger.ledger.as_bytes())?;
        match &s.identity {
            None => self.byte(0)?,
            Some(id) => {
                self.byte(1)?;
                self.identity(id)?
            }
        }
        self.binding(&s.issuer)?;
        self.binding(&s.binding)
    }
    pub fn cut(&mut self, c: &Cut) -> StoreResult<()> {
        self.u64(c.revision)?;
        self.u64(c.count)?;
        self.u64(c.included)?;
        match &c.last {
            None => self.byte(0),
            Some(id) => {
                self.byte(1)?;
                self.raw(id.as_bytes())
            }
        }
    }
    pub fn object(&mut self, o: Option<(u64, u64)>) -> StoreResult<()> {
        match o {
            None => self.byte(0),
            Some((a, b)) => {
                self.byte(1)?;
                self.u64(a)?;
                self.u64(b)
            }
        }
    }
    pub fn finish(self) -> Vec<u8> {
        self.bytes
    }
}
pub(super) struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}
impl<'a> Reader<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        Self { bytes, at: 0 }
    }
    pub fn raw(&mut self, n: usize) -> StoreResult<&'a [u8]> {
        let end = self.at.checked_add(n).ok_or(StoreError::Corrupt)?;
        let out = self.bytes.get(self.at..end).ok_or(StoreError::Corrupt)?;
        self.at = end;
        Ok(out)
    }
    pub fn byte(&mut self) -> StoreResult<u8> {
        Ok(self.raw(1)?[0])
    }
    pub fn u64(&mut self) -> StoreResult<u64> {
        Ok(u64::from_be_bytes(
            self.raw(8)?.try_into().map_err(|_| StoreError::Corrupt)?,
        ))
    }
    pub fn id(&mut self) -> StoreResult<[u8; 16]> {
        self.raw(16)?.try_into().map_err(|_| StoreError::Corrupt)
    }
    pub fn bytes(&mut self, max: usize) -> StoreResult<&'a [u8]> {
        let n =
            u32::from_be_bytes(self.raw(4)?.try_into().map_err(|_| StoreError::Corrupt)?) as usize;
        if n > max {
            return Err(StoreError::Limit);
        }
        self.raw(n)
    }
    pub fn path(&mut self) -> StoreResult<std::path::PathBuf> {
        use std::os::unix::ffi::OsStringExt;
        Ok(std::ffi::OsString::from_vec(self.bytes(4096)?.to_vec()).into())
    }
    pub fn binding(&mut self) -> StoreResult<CustodyBinding> {
        Ok(CustodyBinding {
            directory_device: self.u64()?,
            directory_inode: self.u64()?,
            database_device: self.u64()?,
            database_inode: self.u64()?,
            lock_device: self.u64()?,
            lock_inode: self.u64()?,
        })
    }
    pub fn identity(&mut self) -> StoreResult<Identity> {
        Ok(Identity {
            owner: OwnerId::from_bytes(self.id()?)?,
            ledger: LedgerId::from_bytes(self.id()?)?,
            change: ChangeId::from_bytes(self.id()?)?,
            owner_actor: ActorId::from_bytes(self.id()?)?,
            agent: ActorId::from_bytes(self.id()?)?,
        })
    }
    pub fn subject(&mut self) -> StoreResult<Subject> {
        let kind = match self.byte()? {
            0 => Kind::Register,
            1 => Kind::Original,
            _ => return Err(StoreError::Corrupt),
        };
        let ledger = LedgerIdentity {
            owner: OwnerId::from_bytes(self.id()?)?,
            ledger: LedgerId::from_bytes(self.id()?)?,
        };
        let identity = match self.byte()? {
            0 => None,
            1 => Some(self.identity()?),
            _ => return Err(StoreError::Corrupt),
        };
        Ok(Subject {
            kind,
            ledger,
            identity,
            issuer: self.binding()?,
            binding: self.binding()?,
        })
    }
    pub fn cut(&mut self) -> StoreResult<Cut> {
        Ok(Cut {
            revision: self.u64()?,
            count: self.u64()?,
            included: self.u64()?,
            last: match self.byte()? {
                0 => None,
                1 => Some(OperationId::from_bytes(self.id()?)?),
                _ => return Err(StoreError::Corrupt),
            },
        })
    }
    pub fn object(&mut self) -> StoreResult<Option<(u64, u64)>> {
        match self.byte()? {
            0 => Ok(None),
            1 => Ok(Some((self.u64()?, self.u64()?))),
            _ => Err(StoreError::Corrupt),
        }
    }
    pub fn end(self) -> StoreResult<()> {
        if self.at == self.bytes.len() {
            Ok(())
        } else {
            Err(StoreError::Corrupt)
        }
    }
}

#[cfg(test)]
type ContinuityCut = Box<dyn FnOnce(&WriterCustody)>;
#[cfg(test)]
thread_local! {
    static READ_CUT: std::cell::RefCell<Option<ContinuityCut>> = const {std::cell::RefCell::new(None)};
    static PUBLISH_CUT: std::cell::RefCell<Option<ContinuityCut>> = const {std::cell::RefCell::new(None)};
}
#[cfg(test)]
fn continuity_cut(read: bool, custody: &WriterCustody) {
    let hook = if read {
        READ_CUT.with(|v| v.borrow_mut().take())
    } else {
        PUBLISH_CUT.with(|v| v.borrow_mut().take())
    };
    if let Some(hook) = hook {
        hook(custody)
    }
}
#[cfg(test)]
pub(super) fn observe_publication_for_test(
    directory: std::path::PathBuf,
    n: usize,
    observe: impl FnOnce(&WriterCustody) + 'static,
) {
    fn arm(directory: std::path::PathBuf, n: usize, observe: ContinuityCut) {
        PUBLISH_CUT.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move |custody| {
                if custody.directory() != directory {
                    arm(directory, n, observe)
                } else if n > 1 {
                    arm(directory, n - 1, observe)
                } else {
                    observe(custody)
                }
            }))
        });
    }
    assert!(n > 0);
    arm(directory, n, Box::new(observe));
}

#[cfg(test)]
impl Witness {
    /// Closed-fixture corruption only. Not compiled into the library's production surface.
    pub(super) fn rewrite_pending_for_test(
        custody: &WriterCustody,
        name: &str,
        change: impl FnOnce(&mut Vec<u8>),
    ) {
        Self::rewrite_for_test(custody, name, |value| {
            change(&mut value.pending.as_mut().unwrap().request)
        });
    }
    pub(super) fn rewrite_for_test(
        custody: &WriterCustody,
        name: &str,
        change: impl FnOnce(&mut Self),
    ) {
        let mut value = Self::read_named(custody, name).unwrap();
        change(&mut value);
        let payload = value.payload().unwrap();
        let mut file = custody.member(name, false).unwrap();
        file.set_len((128 + 2 * payload.len()) as u64).unwrap();
        file.write_all(
            &make_header(value.subject.kind, value.generation, payload.len(), b"CKLC").unwrap(),
        )
        .unwrap();
        file.write_all(&payload).unwrap();
        file.write_all(&payload).unwrap();
        file.write_all(
            &make_header(value.subject.kind, value.generation, payload.len(), b"CKLE").unwrap(),
        )
        .unwrap();
        file.sync_all().unwrap();
        custody.sync_directory().unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Seek, SeekFrom};

    fn fixture() -> (WriterCustody, Witness) {
        let root = crate::adapters::sqlite::tests::staging::root(Path::new(env!(
            "CHANGEKERNEL_SQLITE_STAGE"
        )))
        .expect("required external Linux/Btrfs fixture stage");
        let path = root.join(format!(
            "p33-control-{}",
            super::hex(&crate::adapters::ids::candidate().unwrap())
        ));
        let custody = WriterCustody::create(&path).unwrap();
        let binding = custody.binding();
        let mut witness = Witness::new(Subject {
            kind: Kind::Register,
            ledger: LedgerIdentity {
                owner: OwnerId::from_bytes([1; 16]).unwrap(),
                ledger: LedgerId::from_bytes([2; 16]).unwrap(),
            },
            identity: None,
            issuer: binding.clone(),
            binding,
        });
        witness.publish(&custody).unwrap();
        (custody, witness)
    }
    #[test]
    fn paired_witness_roundtrips_and_replaces_only_the_exact_current_generation() {
        let (custody, mut witness) = fixture();
        assert_eq!(Witness::read(&custody).unwrap(), witness);
        let stale = witness.clone();
        let mut next = witness.clone();
        next.phase = Phase::PreparingOpen;
        witness.replace(&custody, next).unwrap();
        assert_eq!(witness.generation, 2);
        assert_eq!(witness.parent, 1);
        assert_eq!(Witness::read(&custody).unwrap(), witness);
        let mut stale_writer = stale.clone();
        assert!(matches!(
            stale_writer.replace(&custody, stale),
            Err(StoreError::Custody)
        ));
    }
    #[test]
    fn possible_commit_cannot_be_downgraded_cleared_at_before_cut_or_retargeted() {
        let (custody, mut witness) = fixture();
        let mut next = witness.clone();
        next.pending = Some(Pending {
            stage: Stage::Prepared,
            mutation: Mutation::Provision,
            after: witness.cut.advance().unwrap(),
            request: b"retained original descriptor".to_vec(),
        });
        witness.replace(&custody, next).unwrap();
        let mut next = witness.clone();
        next.pending.as_mut().unwrap().stage = Stage::CommitPossible;
        witness.replace(&custody, next).unwrap();
        let original = witness.clone();
        let mut bad = witness.clone();
        bad.pending.as_mut().unwrap().stage = Stage::Prepared;
        assert!(matches!(
            witness.replace(&custody, bad),
            Err(StoreError::Corrupt)
        ));
        let mut bad = witness.clone();
        bad.pending = None;
        assert!(matches!(
            witness.replace(&custody, bad),
            Err(StoreError::Corrupt)
        ));
        let mut bad = witness.clone();
        bad.pending.as_mut().unwrap().request.push(0);
        assert!(matches!(
            witness.replace(&custody, bad),
            Err(StoreError::Corrupt)
        ));
        assert_eq!(Witness::read(&custody).unwrap(), original);
    }
    #[test]
    fn prepared_can_clear_only_at_before_and_possible_only_at_exact_after() {
        let (custody, mut witness) = fixture();
        let mut next = witness.clone();
        next.pending = Some(Pending {
            stage: Stage::Prepared,
            mutation: Mutation::Provision,
            after: witness.cut.advance().unwrap(),
            request: vec![],
        });
        witness.replace(&custody, next).unwrap();
        let mut bad = witness.clone();
        bad.cut = bad.pending.as_ref().unwrap().after.clone();
        bad.pending = None;
        assert!(matches!(
            witness.replace(&custody, bad),
            Err(StoreError::Corrupt)
        ));
        let mut next = witness.clone();
        next.pending = None;
        witness.replace(&custody, next).unwrap();
        assert_eq!(witness.cut, Cut::empty());
        let mut next = witness.clone();
        next.pending = Some(Pending {
            stage: Stage::Prepared,
            mutation: Mutation::Provision,
            after: witness.cut.advance().unwrap(),
            request: vec![],
        });
        witness.replace(&custody, next).unwrap();
        let mut next = witness.clone();
        next.pending.as_mut().unwrap().stage = Stage::CommitPossible;
        witness.replace(&custody, next).unwrap();
        let mut next = witness.clone();
        next.cut = next.pending.take().unwrap().after;
        witness.replace(&custody, next).unwrap();
        assert_eq!(witness.cut.revision, 1);
    }
    #[test]
    fn unsupported_envelopes_and_oversized_lengths_refuse_before_payload_allocation() {
        for (offset, value, limit) in [
            (4, 2u32, false),
            (16, 2u32, false),
            (28, 1u32, false),
            (8, (PAYLOAD + 1) as u32, true),
        ] {
            let (custody, _) = fixture();
            let mut file = custody.member("custody.ctrl", false).unwrap();
            file.seek(SeekFrom::Start(offset)).unwrap();
            file.write_all(&value.to_be_bytes()).unwrap();
            file.sync_all().unwrap();
            drop(file);
            let result = Witness::read(&custody);
            if limit {
                assert!(matches!(result, Err(StoreError::Limit)))
            } else {
                assert!(matches!(result, Err(StoreError::UnsupportedProfile)))
            }
        }
    }
    #[test]
    fn damaged_pair_missing_canonical_and_higher_temp_are_not_repaired_or_selected() {
        let (custody, mut witness) = fixture();
        let mut file = custody.member("custody.ctrl", false).unwrap();
        file.seek(SeekFrom::Start(HEADER as u64)).unwrap();
        file.write_all(&[7]).unwrap();
        file.sync_all().unwrap();
        drop(file);
        assert!(matches!(Witness::read(&custody), Err(StoreError::Corrupt)));
        assert!(witness.replace(&custody, witness.clone()).is_err());
        fs::rename(
            custody.directory().join("custody.ctrl"),
            custody.directory().join("preserved-control"),
        )
        .unwrap();
        let file = custody.member(".custody-next-ffff", true).unwrap();
        file.sync_all().unwrap();
        drop(file);
        assert!(Witness::read(&custody).is_err());
        assert!(!custody.directory().join("custody.ctrl").exists());
        assert!(custody.directory().join("preserved-control").exists());
    }
    #[test]
    fn native_binding_replacement_cannot_activate_a_copied_control() {
        let (custody, _) = fixture();
        let bytes = fs::read(custody.directory().join("custody.ctrl")).unwrap();
        fs::rename(
            custody.directory().join("custody.ctrl"),
            custody.directory().join("preserved-control"),
        )
        .unwrap();
        let mut replacement = custody.member("custody.ctrl", true).unwrap();
        replacement.write_all(&bytes).unwrap();
        replacement.sync_all().unwrap();
        drop(replacement);
        assert!(matches!(Witness::read(&custody), Err(StoreError::Custody)));
        assert!(custody.member("ledger.sqlite-shm", false).is_err());
    }
    #[test]
    fn canonical_control_replacement_during_read_is_detected_after_the_read() {
        let (custody, _) = fixture();
        let bytes = fs::read(custody.directory().join("custody.ctrl")).unwrap();
        READ_CUT.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move |custody| {
                fs::rename(
                    custody.directory().join("custody.ctrl"),
                    custody.directory().join("preserved-read-control"),
                )
                .unwrap();
                let mut file = custody.member("custody.ctrl", true).unwrap();
                file.write_all(&bytes).unwrap();
                file.sync_all().unwrap();
            }))
        });
        assert!(matches!(Witness::read(&custody), Err(StoreError::Custody)));
        assert!(custody.directory().join("preserved-read-control").exists());
    }
    #[test]
    fn divergent_same_generation_parent_after_temp_sync_is_not_silently_repaired() {
        let (custody, mut witness) = fixture();
        let mut divergent = witness.clone();
        divergent.epoch = 77;
        let expected = divergent.clone();
        PUBLISH_CUT.with(|slot| {
            *slot.borrow_mut() = Some(Box::new(move |custody| {
                let original = fs::read(custody.directory().join("custody.ctrl")).unwrap();
                let mut saved = custody.member("preserved-parent-bytes", true).unwrap();
                saved.write_all(&original).unwrap();
                saved.sync_all().unwrap();
                drop(saved);
                let payload = divergent.payload().unwrap();
                let mut file = custody.member("custody.ctrl", false).unwrap();
                file.write_all(
                    &super::make_header(
                        divergent.subject.kind,
                        divergent.generation,
                        payload.len(),
                        b"CKLC",
                    )
                    .unwrap(),
                )
                .unwrap();
                file.write_all(&payload).unwrap();
                file.write_all(&payload).unwrap();
                file.write_all(
                    &super::make_header(
                        divergent.subject.kind,
                        divergent.generation,
                        payload.len(),
                        b"CKLE",
                    )
                    .unwrap(),
                )
                .unwrap();
                file.sync_all().unwrap();
            }))
        });
        let mut next = witness.clone();
        next.phase = Phase::PreparingOpen;
        assert!(matches!(
            witness.replace(&custody, next),
            Err(StoreError::Custody)
        ));
        assert_eq!(Witness::read(&custody).unwrap(), expected);
        assert!(fs::read_dir(custody.directory()).unwrap().any(|entry| entry
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".custody-next-")));
    }
    #[test]
    fn descriptor_bounds_and_strict_consumption_include_nested_overhead() {
        let mut w = Writer::new(4);
        assert!(matches!(w.bytes(&[1], FRAME), Err(StoreError::Limit)));
        let mut r = Reader::new(&[0, 0, 0, 3, 1]);
        assert!(matches!(r.bytes(2), Err(StoreError::Limit)));
        assert!(Reader::new(&[0]).end().is_err());
        assert!(Reader::new(&[2]).object().is_err());
        assert!(Reader::new(&[0; 15]).identity().is_err());
    }
}
