//! Fixed, quarantinable prior-proof receipt. No persisted identity, handle query,
//! authorization inference, or formatted token storage in retention.
use super::super::layout::{Layout, Value};
use super::{
    super::{
        codec::{Anchor, MemberAnchor},
        storage::{directory, regular, subdir, Context, Node},
        work::{self, Boundary as B},
    },
    identity::{Pair, Shared},
};
use crate::adapters::jsonl::opening::storage::{self as raw, Failure};
#[derive(Clone, Copy, PartialEq, Eq)]
enum Identities {
    Shared(Shared),
    Member(Pair),
}
impl Identities {
    fn logical(self) -> usize {
        match self {
            Self::Shared(_) => 108,
            Self::Member(_) => 72,
        }
    }
}
pub(in crate::adapters::jsonl::ledger) struct SharedGrounds<'a, P: Layout> {
    pub root: &'a Node<P>,
    pub directory: &'a std::path::Path,
    pub members: &'a super::super::storage::TrackedFile,
}
impl<P: Layout> SharedGrounds<'_, P> {
    pub(in crate::adapters::jsonl::ledger) fn binding(&self) -> Result<(), Failure> {
        use super::super::layout::Slot;
        let receipt = self.root.receipt.get().ok_or_else(Failure::damage)?;
        let held = raw::id(self.members)?;
        if !work::test(B::Fields, 0, 2, || receipt.live_members == Some(held)) {
            return Err(Failure::damage());
        }
        // The external anchor parent is independent custody, not the ledger's
        // namespace. Borrow the immutable grant spelling and securely traverse
        // its actual chain before comparing with the continuously held root.
        let dir = directory(self.directory)?;
        let lock = regular(&self.root.dir, "writer.lock", libc::O_RDONLY)?;
        let members = subdir(&self.root.dir, "members")?;
        let live = (raw::id(&dir)?, raw::id(&lock)?, raw::id(&members)?);
        let held = (
            raw::id(&self.root.dir)?,
            raw::id(&self.root.lock)?,
            raw::id(self.members)?,
        );
        if !work::test(B::Fields, 0, 6, || live == held) {
            return Err(Failure::damage());
        }
        Ok(())
    }
}
#[derive(Clone, Copy)]
pub(crate) struct Receipt {
    selectors: [u8; 5120],
    len: u16,
    stage: [u8; 9],
    stage_len: u8,
    identities: Identities,
    live_members: Option<(u64, u64)>,
}
impl Receipt {
    fn new(
        selectors: &[&str],
        stage: &str,
        identities: Identities,
        live_members: Option<(u64, u64)>,
    ) -> Result<Self, Failure> {
        let mut r = Self {
            selectors: [0; 5120],
            len: 0,
            stage: [0; 9],
            stage_len: 0,
            identities,
            live_members,
        };
        let mut pos = 0;
        for s in selectors {
            if pos + s.len() + 1 > r.selectors.len() {
                return Err(Failure::damage());
            }
            r.selectors[pos..pos + s.len()].copy_from_slice(s.as_bytes());
            pos += s.len() + 1;
        }
        if stage.len() > 9 {
            return Err(Failure::damage());
        }
        r.len = pos as u16;
        r.stage[..stage.len()].copy_from_slice(stage.as_bytes());
        r.stage_len = stage.len() as u8;
        Ok(r)
    }
    pub(in crate::adapters::jsonl::ledger) fn shared<P: Layout>(
        a: &Anchor<P>,
        members: &super::super::storage::TrackedFile,
    ) -> Result<Self, Failure> {
        let adoption = a.adoption.as_ref().ok_or_else(Failure::damage)?;
        Self::new(
            &[
                &a.format,
                &a.ledger,
                &a.custody,
                &a.workspace_id,
                &a.binding,
                &a.owner,
                &a.directory,
                &adoption.policy,
                &adoption.check,
                &adoption.evaluator,
                &adoption.adopter,
            ],
            &a.stage,
            Identities::Shared(a.identity.value().ok_or_else(Failure::damage)?),
            Some(raw::id(members)?),
        )
    }
    pub(in crate::adapters::jsonl::ledger) fn member<P: Layout>(
        a: &MemberAnchor<P>,
    ) -> Result<Self, Failure> {
        let adoption = a.adoption.as_ref().ok_or_else(Failure::damage)?;
        let pair = a.identity.value().ok_or_else(Failure::damage)?;
        Self::new(
            &[
                &a.format,
                &a.custody,
                &a.ledger,
                &a.workspace_id,
                &a.binding,
                &a.change,
                &a.owner,
                &a.key,
                &a.directory,
                &adoption.policy,
                &adoption.check,
                &adoption.evaluator,
                &adoption.adopter,
            ],
            &a.stage,
            Identities::Member(pair),
            None,
        )
    }
    fn matches(&self, other: &Self) -> bool {
        work::test(
            B::Relationships,
            (self.len as usize).max(other.len as usize)
                + usize::from(self.stage_len).max(usize::from(other.stage_len))
                + self.identities.logical().max(other.identities.logical()),
            16,
            || {
                self.len == other.len
                    && self.selectors[..self.len as usize] == other.selectors[..other.len as usize]
                    && self.stage_len == other.stage_len
                    && self.stage[..self.stage_len as usize]
                        == other.stage[..other.stage_len as usize]
                    && self.identities == other.identities
            },
        )
    }
    pub(in crate::adapters::jsonl::ledger) fn binding<P: Layout>(
        &self,
        n: &Node<P>,
    ) -> Result<(), Failure> {
        if n.scope == 0 {
            let path = self.selectors[..self.len as usize]
                .split(|b| *b == 0)
                .nth(6)
                .ok_or_else(Failure::damage)?;
            let path = std::str::from_utf8(path).map_err(|_| Failure::damage())?;
            let named = directory(std::path::Path::new(path))?;
            let held = raw::id(&n.dir)?;
            let live = raw::id(&named)?;
            if !work::test(B::Fields, 0, 2, || live == held) {
                return Err(Failure::damage());
            }
            let members = subdir(&n.dir, "members")?;
            let current = raw::id(&members)?;
            if !work::test(B::Fields, 0, 2, || Some(current) == self.live_members) {
                return Err(Failure::damage());
            }
        } else {
            n.binding(&n.parent)?;
        }
        let named = regular(&n.dir, "writer.lock", libc::O_RDWR)?;
        let live = raw::id(&named)?;
        let held = raw::id(&n.lock)?;
        if !work::test(B::Fields, 0, 2, || live == held) {
            return Err(Failure::damage());
        }
        Ok(())
    }
    pub(in crate::adapters::jsonl::ledger) fn grounds<P: Layout>(
        &self,
        n: &Node<P>,
        ctx: &mut Context<P>,
        grants: Option<&[crate::LedgerPair; 16]>,
    ) -> Result<(), Failure> {
        let _scratch = work::Fixed::new(std::mem::size_of::<Self>() * 2);
        self.binding(n)?;
        let bytes = n.read_at(
            ctx,
            &n.parent,
            &n.anchor_name,
            "anchor.json",
            crate::kernel::changes::ledger::C,
            false,
        )?;
        if n.scope == 0 {
            // The independent grant remains owned by custody. Anchor decoding
            // borrows its sealed grant, never reconstitutes it from disk.
            let grants = grants.ok_or_else(Failure::damage)?;
            let a =
                super::super::codec::anchor::<P>(&bytes, grants).map_err(|_| Failure::damage())?;
            let named = directory(std::path::Path::new(&a.directory))?;
            let held = raw::id(&n.dir)?;
            let live = raw::id(&named)?;
            if !work::test(B::Fields, 0, 2, || live == held) {
                return Err(Failure::damage());
            }
            let members = subdir(&n.dir, "members")?;
            let current = raw::id(&members)?;
            if !work::test(B::Fields, 0, 2, || Some(current) == self.live_members) {
                return Err(Failure::damage());
            }
            let fresh = Self::shared(&a, &members)?;
            if !self.matches(&fresh) {
                return Err(Failure::damage());
            }
        } else {
            n.binding(&n.parent)?;
            let a: work::Owned<MemberAnchor<P>> =
                super::super::codec::retained(&bytes, B::Controls)
                    .map_err(|_| Failure::damage())?;
            let fresh = Self::member(&a)?;
            if !self.matches(&fresh) {
                return Err(Failure::damage());
            }
        }
        let named = regular(&n.dir, "writer.lock", libc::O_RDWR)?;
        let live = raw::id(&named)?;
        let held = raw::id(&n.lock)?;
        if !work::test(B::Fields, 0, 2, || live == held) {
            return Err(Failure::damage());
        }
        Ok(())
    }
}
