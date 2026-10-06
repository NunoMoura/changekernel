//! Concrete fresh collection custody. No public raw controls or append API.
#[macro_use]
pub(crate) mod codec;
pub(crate) mod history;
mod members;
mod operations;
mod parser;
mod selection;
mod storage;
pub(crate) mod work;
use crate::{
    adapters::jsonl::opening::{
        storage::{self as raw, Failure},
        OpeningMode,
    },
    application::ledger::{self as policy, LedgerGuard, LedgerMemberPermission},
    kernel::changes::{
        ledger::{Created, LedgerGrant, LedgerInput, C, L, T},
        opening::{identifier, OpeningError},
    },
};
use codec::*;
use selection::{
    Installation, Operation as Origin, Profile, SelectedRequest as Request, SelectedResult,
};
use sha2::{Digest, Sha256};
use std::cell::Cell;
use storage::TrackedFile as File;
use storage::{Context, Node};
pub use storage::{LedgerIoEvent, LedgerIoFault, LedgerIoHook};
use work::{Boundary as B, Heap, Owned};
pub use work::{LedgerBoundary, LedgerWork};

pub(crate) struct Custody {
    grant: Owned<Installation>,
    root: Owned<Node>,
    members: File,
    anchor: Owned<Anchor>,
    ctx: Context,
    deferred: Option<Owned<Vec<u8>>>,
}
impl Custody {
    pub fn payload(&self) -> usize {
        self.anchor.heap()
            + self.grant.adoption.heap()
            + self.grant.grants.heap()
            + self.grant.profile.capacity()
            + self.grant.ledger.capacity()
            + self.grant.custody.capacity()
            + self.grant.owner.capacity()
            + self.grant.workspace_id.capacity()
            + self.grant.binding.capacity()
            + self.grant.directory.capacity()
            + self.grant.anchor.capacity()
            + self.root.anchor_name.capacity()
            + self.root.custody.capacity()
            + self.deferred.as_ref().map_or(0, |b| b.capacity())
    }
    pub fn rebase(&mut self) {
        self.ctx.failure_scope = None;
        self.grant.rebase();
        self.root.rebase();
        self.root.dir.rebase();
        self.root.lock.rebase();
        self.root.parent.rebase();
        self.members.rebase();
        self.anchor.rebase();
        if let Some(v) = self.deferred.as_mut() {
            v.rebase();
        }
    }
    pub fn ledger(&self) -> &str {
        &self.grant.ledger
    }
    pub fn connect(
        grant: LedgerGrant,
        mode: OpeningMode,
        hook: Option<LedgerIoHook>,
    ) -> Result<Self, OpeningError> {
        Self::connect_inner(grant.into(), mode, hook).map_err(|_| OpeningError::Unavailable)
    }
    fn connect_inner(
        grant: Installation,
        mode: OpeningMode,
        hook: Option<LedgerIoHook>,
    ) -> Result<Self, Failure> {
        let grant = if grant.selected == Profile::History {
            Owned::new(grant)
        } else {
            Owned::from_baseline(grant)
        };
        // The grant predicate includes the reached pair-uniqueness comparisons,
        // not merely one visit to each string. Charge each available range in
        // the compound closed installation schema, including both earlier IDs.
        let mut grant_ranges = grant.profile.len().max(11)
            + grant.ledger.len()
            + grant.custody.len()
            + grant.owner.len().max(7)
            + grant.workspace_id.len().max(11)
            + grant.binding.len().max(9);
        for (i, p) in grant.grants.iter().enumerate() {
            grant_ranges +=
                p.change.len() + p.custody.len() + p.custody.len().max(grant.custody.len());
            for q in &grant.grants[..i] {
                grant_ranges +=
                    q.change.len().max(p.change.len()) + q.custody.len().max(p.custody.len());
            }
        }
        if !work::test(B::Fields, grant_ranges, 512, || grant.valid()) {
            return Err(Failure::damage());
        }
        let parent_path = grant.anchor.parent();
        work::test(B::Fields, 0, 1, || parent_path.is_some());
        let parent_path = parent_path.ok_or_else(Failure::damage)?;
        let anchor_name = grant.anchor.file_name().and_then(|n| n.to_str());
        work::test(B::Fields, 0, 2, || anchor_name.is_some());
        let anchor_name = Owned::new(anchor_name.ok_or_else(Failure::damage)?.to_owned());
        let (path_bytes, path_words) = connection_path_work(&grant.directory, &grant.anchor);
        if !work::test(B::Fields, path_bytes, path_words, || {
            *anchor_name != "anchor.tmp"
                && !parent_path.starts_with(&grant.directory)
                && grant.directory.file_name().is_some()
                && grant.anchor.as_os_str().len() <= 4096
                && grant.directory.as_os_str().len() + 13 <= 4096
        }) {
            return Err(Failure::damage());
        }
        let parent = storage::directory(parent_path)?;
        let root_parent =
            storage::directory(grant.directory.parent().ok_or_else(Failure::damage)?)?;
        let mut ctx = Context {
            profile: grant.selected,
            hook,
            phase: if mode == OpeningMode::Reopen {
                "recover"
            } else {
                "provision"
            },
            latched: [false; 17],
            failure_scope: None,
        };
        let fresh = mode == OpeningMode::FreshProvision;
        if fresh {
            work::attempt(B::Fields, 0, 2);
            let vacant = !(storage::exists_at(&parent, &anchor_name)?
                || storage::exists_at(&parent, "anchor.tmp")?);
            work::complete(B::Fields, vacant);
            if !vacant {
                return Err(Failure::damage());
            }
            storage::mkdir(
                &root_parent,
                grant
                    .directory
                    .file_name()
                    .unwrap()
                    .to_str()
                    .ok_or_else(Failure::damage)?,
            )?;
            ctx.event(0, "directory", "created")?;
        }
        let dir = storage::directory(&grant.directory)?;
        let lock = storage::regular(
            &dir,
            "writer.lock",
            if fresh {
                libc::O_RDWR | libc::O_CREAT | libc::O_EXCL
            } else {
                libc::O_RDWR
            },
        )?;
        storage::lock(&lock)?;
        let root = Owned::new(Node {
            dir,
            lock,
            parent,
            anchor_name: anchor_name.into_inner(),
            scope: 0,
            profile: grant.selected,
            custody: grant.custody.clone(),
            justified: Cell::new(false),
            passes: Cell::new(0),
        });
        let prepared = (|| {
            if fresh {
                storage::mkdir(&root.dir, "members")?;
                ctx.event(0, "members", "created")?;
            }
            let members = storage::subdir(&root.dir, "members")?;
            let anchor = if fresh {
                let physical = root.physical()?;
                let (members_device, members_inode) = raw::id(&members)?;
                Owned::try_constructed(|| {
                    Ok::<_, Failure>(Anchor {
                        format: grant.selected.tag("anchor").into(),
                        ledger: grant.ledger.clone(),
                        custody: grant.custody.clone(),
                        workspace_id: grant.workspace_id.clone(),
                        binding: grant.binding.clone(),
                        owner: grant.owner.clone(),
                        directory: grant.directory.to_str().ok_or_else(Failure::damage)?.into(),
                        directory_device: physical.directory_device,
                        directory_inode: physical.directory_inode,
                        lock_device: physical.lock_device,
                        lock_inode: physical.lock_inode,
                        members_device,
                        members_inode,
                        stage: "preparing".into(),
                        adoption: grant.adoption.clone(),
                    })
                })?
            } else {
                read_anchor(&root, &mut ctx, &grant.grants)?
            };
            Self::anchor_matches(&grant, &root, &members, &anchor)?;
            if !fresh {
                root.justified.set(true);
            }
            if !work::test(
                B::Fields,
                anchor.stage.len().max("preparing".len()),
                5,
                || {
                    !((mode == OpeningMode::Reopen && anchor.stage != "installed")
                        || (!fresh
                            && mode == OpeningMode::ResumeProvision
                            && anchor.stage != "preparing"))
                },
            ) {
                return Err(Failure::damage());
            }
            if fresh {
                root.sync(&mut ctx, &root.lock, "writer.lock")?;
                root.sync(&mut ctx, &members, "members")?;
                root.sync(&mut ctx, &root.dir, "directory")?;
                root.sync(&mut ctx, &root_parent, "directory_parent")?;
                let bytes = codec::emit(&AnchorWire(&anchor, &grant.grants), C)
                    .map_err(|_| Failure::damage())?;
                root.create_anchor(&mut ctx, &bytes)?;
                root.justified.set(true);
            }
            Ok((members, anchor))
        })();
        let (members, anchor) = match prepared {
            Ok(v) => v,
            Err(e) => {
                root.retain(&mut ctx, &e);
                return Err(e);
            }
        };
        let mut s = Self {
            grant,
            root,
            members,
            anchor,
            deferred: None,
            ctx,
        };
        let result = (|| {
            if work::test(
                B::Fields,
                s.anchor.stage.len().max("preparing".len()),
                1,
                || s.anchor.stage == "preparing",
            ) {
                s.install_shared()?;
            }
            s.ctx.phase = "recover";
            s.shared()?;
            s.shared_barriers()?;
            s.shared()?;
            Ok(())
        })();
        if let Err(e) = result {
            s.root.retain(&mut s.ctx, &e);
            return Err(e);
        }
        Ok(s)
    }
    fn anchor_matches(
        grant: &Installation,
        root: &Node,
        members: &File,
        a: &Anchor,
    ) -> Result<(), Failure> {
        let p = root.physical()?;
        let m = raw::id(members)?;
        if !work::test(
            B::Relationships,
            a.logical().max(
                grant.selected.tag("anchor").len()
                    + grant.ledger.len()
                    + grant.custody.len()
                    + grant.workspace_id.len()
                    + grant.binding.len()
                    + grant.owner.len()
                    + grant.directory.as_os_str().len()
                    + grant.adoption.logical()
                    + "preparing".len(),
            ),
            64,
            || {
                a.format == grant.selected.tag("anchor")
                    && a.ledger == grant.ledger
                    && a.custody == grant.custody
                    && a.workspace_id == grant.workspace_id
                    && a.binding == grant.binding
                    && a.owner == grant.owner
                    && a.adoption == grant.adoption
                    && Some(a.directory.as_str()) == grant.directory.to_str()
                    && matches!(a.stage.as_str(), "preparing" | "installed")
                    && (a.directory_device, a.directory_inode)
                        == (p.directory_device, p.directory_inode)
                    && (a.lock_device, a.lock_inode) == (p.lock_device, p.lock_inode)
                    && (a.members_device, a.members_inode) == m
            },
        ) {
            return Err(Failure::damage());
        }
        Ok(())
    }
    fn initial(&self) -> Creations {
        Creations {
            format: self.grant.selected.tag("creations").into(),
            custody: self.grant.custody.clone(),
            ledger: self.grant.ledger.clone(),
            generation: 0,
            entries: Items(Vec::with_capacity(16)),
            pending: None,
        }
    }
    fn initial_shared(&mut self, complete: bool) -> Result<(), Failure> {
        let names = storage::inventory(&self.root.dir, 6, |n| {
            storage::allowed(
                n,
                &["writer.lock", "members", "creation.json", "incident.json"],
            )
        })?;
        if !storage::present(&names, "writer.lock") || !storage::present(&names, "members") {
            return Err(Failure::damage());
        }
        let members = storage::inventory(&self.members, 33, |_| false)?;
        if !work::test(B::Fields, 0, 1, || members.is_empty()) {
            return Err(Failure::damage());
        }
        drop(members);
        let initial = Owned::constructed(|| self.initial());
        let clear = Owned::constructed(|| self.root.clear());
        for (name, bytes) in [
            ("creation.json", codec::emit(&*initial, C)),
            ("incident.json", codec::emit(&*clear, C)),
        ] {
            let bytes = bytes.map_err(|_| Failure::damage())?;
            if storage::exists_at(&self.root.dir, name)? {
                let retained = self.root.read(&mut self.ctx, name, C)?;
                if !work::test(B::Canonical, retained.len().max(bytes.len()), 1, || {
                    *retained == *bytes
                }) {
                    return Err(Failure::damage());
                }
            } else if !work::test(B::Fields, 0, 1, || !complete) {
                return Err(Failure::damage());
            }
        }
        Ok(())
    }
    fn install_shared(&mut self) -> Result<(), Failure> {
        self.initial_shared(false)?;
        if storage::exists_at(&self.root.parent, "anchor.tmp")? {
            self.initial_shared(true)?;
            let bytes = self.root.read_at(
                &mut self.ctx,
                &self.root.parent,
                "anchor.tmp",
                "anchor.tmp",
                C,
                false,
            )?;
            let temp = codec::anchor(&bytes, &self.grant.grants).map_err(|_| Failure::damage())?;
            let mut installed = Owned::constructed(|| self.anchor.clone());
            installed.stage = "installed".into();
            if !work::test(
                B::Relationships,
                temp.logical().max(installed.logical()),
                64,
                || *temp == *self.anchor || *temp == *installed,
            ) {
                return Err(Failure::damage());
            }
            self.root.cleanup(&mut self.ctx, "anchor.tmp", true)?;
            self.initial_shared(true)?;
        }
        let initial = Owned::constructed(|| self.initial());
        let clear = Owned::constructed(|| self.root.clear());
        for (name, bytes) in [
            ("creation.json", codec::emit(&*initial, C)),
            ("incident.json", codec::emit(&*clear, C)),
        ] {
            if !storage::exists_at(&self.root.dir, name)? {
                self.root
                    .create(&mut self.ctx, name, &bytes.map_err(|_| Failure::damage())?)?;
            }
        }
        drop(initial);
        drop(clear);
        self.initial_shared(true)?;
        self.shared_barriers()?;
        let mut installed = Owned::constructed(|| self.anchor.clone());
        installed.stage = "installed".into();
        self.root.replace(
            &mut self.ctx,
            "anchor.json",
            "anchor.tmp",
            &AnchorWire(&installed, &self.grant.grants),
            true,
        )?;
        self.anchor = installed;
        Ok(())
    }
    fn shared_barriers(&mut self) -> Result<(), Failure> {
        self.root.barriers(&mut self.ctx)?;
        self.root.sync(&mut self.ctx, &self.members, "members")
    }
    fn shared(&mut self) -> Result<State, Failure> {
        work::update(|w| w.shared_passes += 1);
        let a = read_anchor(&self.root, &mut self.ctx, &self.grant.grants)?;
        Self::anchor_matches(&self.grant, &self.root, &self.members, &a)?;
        if !work::test(
            B::Relationships,
            a.logical().max(self.anchor.logical()),
            64,
            || *a == *self.anchor && a.stage == "installed",
        ) {
            return Err(Failure::damage());
        }
        let anchor_temporary = storage::exists_at(&self.root.parent, "anchor.tmp")?;
        if !work::test(B::Fields, 0, 1, || !anchor_temporary) {
            return Err(Failure::damage());
        }
        let held = raw::id(&self.root.dir)?;
        let named = raw::id(&*storage::directory(&self.grant.directory)?)?;
        if !work::test(B::Fields, 0, 2, || held == named) {
            return Err(Failure::damage());
        }
        let held = raw::id(&self.root.lock)?;
        let named = raw::id(&*storage::regular(
            &self.root.dir,
            "writer.lock",
            libc::O_RDWR,
        )?)?;
        if !work::test(B::Fields, 0, 2, || held == named) {
            return Err(Failure::damage());
        }
        let held = raw::id(&self.members)?;
        let named = raw::id(&*storage::subdir(&self.root.dir, "members")?)?;
        if !work::test(B::Fields, 0, 2, || held == named) {
            return Err(Failure::damage());
        }
        let names = storage::inventory(&self.root.dir, 6, |n| {
            storage::allowed(
                n,
                &[
                    "writer.lock",
                    "members",
                    "creation.json",
                    "incident.json",
                    "creation.tmp",
                    "incident.tmp",
                ],
            )
        })?;
        for n in ["writer.lock", "members", "creation.json", "incident.json"] {
            if !storage::present(&names, n) {
                return Err(Failure::damage());
            }
        }
        self.root.incident(&mut self.ctx)?;
        let control: Owned<Creations> = self.root.control(&mut self.ctx, "creation.json")?;
        self.valid_control(&control)?;
        let slots = control.entries.0.len() + usize::from(control.pending.is_some());
        let inventory = storage::inventory(&self.members, 33, |n| {
            if work::test(B::Fields, n.len().max("anchor.tmp".len()), 1, || {
                n == "anchor.tmp"
            }) {
                return control.pending.is_some();
            }
            (1..=slots).any(|i| {
                let directory = Owned::new(format!("m-{i}"));
                let anchor = Owned::new(format!("m-{i}.anchor.json"));
                work::test(
                    B::Fields,
                    n.len().max(directory.len()).max(anchor.len()),
                    2,
                    || n == *directory || n == *anchor,
                )
            })
        })?;
        let temp = if storage::present(&names, "creation.tmp") {
            let bytes = self.root.read(&mut self.ctx, "creation.tmp", C)?;
            let candidate = codec::temporary(&bytes, &control).map_err(|_| Failure::damage())?;
            let mut temp = self.classify(&control, candidate, &inventory)?;
            temp.bytes = Some(bytes);
            if let Some(marker) = &self.deferred {
                if !work::test(
                    B::Canonical,
                    marker.len().max(temp.bytes.as_ref().unwrap().len()),
                    1,
                    || **marker == **temp.bytes.as_ref().unwrap(),
                ) {
                    return Err(Failure::damage());
                }
            }
            Some(temp)
        } else {
            None
        };
        Ok(State { control, temp })
    }
    fn valid_control(&self, c: &Creations) -> Result<(), Failure> {
        if !work::test(B::Fields, 0, 3, || {
            c.format.len() == self.grant.selected.tag("creations").len()
                && c.custody.len() == self.grant.custody.len()
                && c.ledger.len() == self.grant.ledger.len()
        }) {
            return Err(Failure::damage());
        }
        if !work::test(
            B::Fields,
            c.format.len() + c.custody.len() + c.ledger.len(),
            5,
            || {
                c.format == self.grant.selected.tag("creations")
                    && c.custody == self.grant.custody
                    && c.ledger == self.grant.ledger
                    && c.entries.0.len() <= 16
            },
        ) {
            return Err(Failure::damage());
        }
        for (i, e) in c.entries.0.iter().enumerate() {
            let p = &self.grant.grants[i];
            if !work::test(B::Fields, 0, 6, || {
                e.change.len() == p.change.len()
                    && e.custody.len() == p.custody.len()
                    && e.actor.len() == 7
                    && e.key.len() <= 64
                    && e.input_sha256.len() == 64
                    && e.origin_sha256.len() == 64
            }) {
                return Err(Failure::damage());
            }
            if !work::test(B::Fields, e.logical().max(p.logical()), 20, || {
                e.slot == i as u64 + 1
                    && e.change == p.change
                    && e.custody == p.custody
                    && e.actor == "owner-1"
                    && identifier(&e.key)
                    && hex(&e.input_sha256)
                    && hex(&e.origin_sha256)
                    && (1..=C as u64).contains(&e.origin_end)
            }) {
                return Err(Failure::damage());
            }
            for earlier in &c.entries.0[..i] {
                if work::test(
                    B::Identifiers,
                    e.key.len().max(earlier.key.len()),
                    1,
                    || e.key == earlier.key,
                ) {
                    return Err(Failure::damage());
                }
            }
        }
        let extra = if let Some(p) = &c.pending {
            if !work::test(B::Fields, 0, 2, || p.actor.len() == 7 && p.phase.len() <= 8)
                || !work::test(
                    B::Fields,
                    p.actor.len().max("owner-1".len()) + p.phase.len().max("reserved".len()),
                    5,
                    || {
                        c.entries.0.len() < 16
                            && p.slot == c.entries.0.len() as u64 + 1
                            && p.actor == "owner-1"
                            && matches!(
                                (p.phase.as_str(), p.physical.is_some()),
                                ("reserved", false) | ("ready", true)
                            )
                    },
                )
                || !self.valid_input(&p.input)
            {
                return Err(Failure::damage());
            }
            for e in &c.entries.0 {
                if work::test(
                    B::Identifiers,
                    e.key.len().max(p.input.key.as_ref().unwrap().len()),
                    1,
                    || Some(&e.key) == p.input.key.as_ref(),
                ) {
                    return Err(Failure::damage());
                }
            }
            let origin = self.origin(p)?;
            codec::emit_origin(&origin).map_err(|_| Failure::damage())?;
            if work::test(B::Fields, p.phase.len().max("reserved".len()), 1, || {
                p.phase == "reserved"
            }) {
                1
            } else {
                2
            }
        } else {
            0
        };
        if !work::test(B::Fields, 0, 2, || {
            c.generation == 3 * c.entries.0.len() as u64 + extra
        }) {
            return Err(Failure::damage());
        }
        Ok(())
    }
    fn valid_input(&self, input: &Request) -> bool {
        // Closed text/identifier grammar was already checked in owning decode.
        // This reached comparison checks only installed association selectors.
        work::test(
            B::Fields,
            input.op.len().max("create_change".len())
                + input.ledger.len().max(self.grant.ledger.len())
                + input.workspace_id.len().max(self.grant.workspace_id.len()),
            3,
            || {
                input.op == "create_change"
                    && input.ledger == self.grant.ledger
                    && input.workspace_id == self.grant.workspace_id
            },
        )
    }
    fn origin(&self, p: &Reservation) -> Result<Owned<Origin>, Failure> {
        work::attempt(B::Constructions, p.input.payload(), 32);
        let pair = self
            .grant
            .grants
            .get(p.slot as usize - 1)
            .ok_or_else(Failure::damage)?;
        let result = Created {
            v: self.grant.selected.version(),
            kind: "created".into(),
            ledger: self.grant.ledger.clone(),
            workspace_id: self.grant.workspace_id.clone(),
            change: pair.change.clone(),
            key: p.input.key.clone().ok_or_else(Failure::damage)?,
            actor: p.actor.clone(),
            result: format!("{}:origin", pair.change),
            seq: 1,
        };
        let origin = Owned::new(Origin {
            v: self.grant.selected.version(),
            custody: pair.custody.clone(),
            ledger: self.grant.ledger.clone(),
            workspace_id: self.grant.workspace_id.clone(),
            binding: self.grant.binding.clone(),
            change: pair.change.clone(),
            seq: 1,
            prev: None,
            kind: "created".into(),
            input: p.input.clone(),
            result: if self.grant.selected == Profile::History {
                SelectedResult::History(Box::new(history::codec::HistoryResult::created(result)))
            } else {
                SelectedResult::Ledger(result)
            },
        });
        work::complete(B::Constructions, true);
        Ok(origin)
    }
    fn association(
        &self,
        p: &Reservation,
        origin: &Origin,
        bytes: &[u8],
        selected_digest: Option<&str>,
    ) -> Result<Owned<Association>, Failure> {
        work::attempt(B::Constructions, 0, 32);
        let input = codec::emit_input(&p.input).map_err(|_| Failure::damage())?;
        let a = Owned::new(Association {
            slot: p.slot,
            key: origin.result.key.clone(),
            change: origin.change.clone(),
            custody: origin.custody.clone(),
            actor: p.actor.clone(),
            input_sha256: hash(&input, false),
            origin_end: bytes.len() as u64,
            origin_sha256: selected_digest.map_or_else(|| hash(bytes, false), str::to_owned),
            physical: p.physical.clone().ok_or_else(Failure::damage)?,
        });
        work::complete(B::Constructions, true);
        Ok(a)
    }
    fn classify(
        &self,
        c: &Creations,
        candidate: Owned<Temporary>,
        names: &[String],
    ) -> Result<Temp, Failure> {
        let equal = work::test(
            B::Relationships,
            candidate.logical().max(c.pending.logical()),
            32,
            || {
                candidate.generation == c.generation
                    && candidate.pending == c.pending
                    && candidate.last.is_none()
            },
        );
        if equal {
            return Ok(Temp {
                kind: Kind::Equal,
                candidate,
                bytes: None,
            });
        }
        if !work::test(B::Fields, 0, 1, || candidate.generation == c.generation + 1) {
            return Err(Failure::damage());
        }
        let kind = match (&c.pending, &candidate.pending, &candidate.last) {
            (None, Some(p), None) => {
                if !work::test(B::Fields, 0, 2, || p.phase.len() == 8 && p.actor.len() == 7)
                    || !work::test(
                        B::Fields,
                        p.phase.len().max("reserved".len()) + p.actor.len().max("owner-1".len()),
                        5,
                        || {
                            c.entries.0.len() < 16
                                && p.slot == c.entries.0.len() as u64 + 1
                                && p.phase == "reserved"
                                && p.physical.is_none()
                                && p.actor == "owner-1"
                        },
                    )
                    || !self.valid_input(&p.input)
                {
                    return Err(Failure::damage());
                }
                let directory = Owned::new(format!("m-{}", p.slot));
                let anchor = Owned::new(format!("m-{}.anchor.json", p.slot));
                if storage::present(names, &directory)
                    || storage::present(names, &anchor)
                    || storage::present(names, "anchor.tmp")
                {
                    return Err(Failure::damage());
                }
                for e in &c.entries.0 {
                    if work::test(
                        B::Identifiers,
                        e.key.len().max(p.input.key.as_ref().unwrap().len()),
                        1,
                        || Some(&e.key) == p.input.key.as_ref(),
                    ) {
                        return Err(Failure::damage());
                    }
                }
                let origin = self.origin(p)?;
                codec::emit_origin(&origin).map_err(|_| Failure::damage())?;
                Kind::Reserve
            }
            (Some(p), Some(q), None)
                if work::test(B::Fields, p.phase.len().max("reserved".len()), 1, || {
                    p.phase == "reserved"
                }) =>
            {
                if !work::test(B::Relationships, p.logical().max(q.logical()), 32, || {
                    p.slot == q.slot
                        && p.input == q.input
                        && p.actor == q.actor
                        && q.phase == "ready"
                        && q.physical.is_some()
                }) {
                    return Err(Failure::damage());
                }
                Kind::Ready
            }
            (Some(p), None, Some(a))
                if work::test(B::Fields, p.phase.len().max("ready".len()), 1, || {
                    p.phase == "ready"
                }) =>
            {
                let origin = self.origin(p)?;
                let bytes = codec::emit_origin(&origin).map_err(|_| Failure::damage())?;
                let expected = self.association(p, &origin, &bytes, None)?;
                if !work::test(
                    B::Relationships,
                    a.logical().max(expected.logical()),
                    32,
                    || *a == *expected,
                ) {
                    return Err(Failure::damage());
                }
                Kind::Accept
            }
            _ => {
                work::test(B::Fields, 0, 1, || false);
                return Err(Failure::damage());
            }
        };
        Ok(Temp {
            kind,
            candidate,
            bytes: None,
        })
    }
}
#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Equal,
    Reserve,
    Ready,
    Accept,
}
struct Temp {
    kind: Kind,
    candidate: Owned<Temporary>,
    bytes: Option<Owned<Vec<u8>>>,
}
struct State {
    control: Owned<Creations>,
    temp: Option<Temp>,
}
fn hex(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn hash(bytes: &[u8], accepted: bool) -> String {
    let _state = work::Fixed::new(std::mem::size_of::<Sha256>());
    work::update(|w| {
        w.hash_state_bytes_peak = w
            .hash_state_bytes_peak
            .max(std::mem::size_of::<Sha256>() as u64)
    });
    work::update(|w| {
        if accepted {
            w.accepted_hash_bytes += bytes.len() as u64
        } else {
            w.candidate_hash_bytes += bytes.len() as u64
        }
    });
    format!("{:x}", Sha256::digest(bytes))
}

fn hash_input(bytes: &[u8]) -> String {
    let _state = work::Fixed::new(std::mem::size_of::<Sha256>());
    work::update(|w| {
        w.hash_state_bytes_peak = w
            .hash_state_bytes_peak
            .max(std::mem::size_of::<Sha256>() as u64);
        w.candidate_hash_bytes += (bytes.len() + 1) as u64;
    });
    let mut hash = Sha256::new();
    hash.update(bytes);
    hash.update(b"\n");
    format!("{:x}", hash.finalize())
}

pub(crate) fn begin_connection(g: &LedgerGrant) {
    work::begin(
        g.grants.heap()
            + g.ledger.capacity()
            + g.custody.capacity()
            + g.profile.capacity()
            + g.owner.capacity()
            + g.workspace_id.capacity()
            + g.binding.capacity()
            + g.directory.capacity()
            + g.anchor.capacity(),
    );
    work::fixed_baseline(std::mem::size_of::<LedgerGrant>());
    work::descriptor_baseline(0);
}
pub(crate) fn begin_dispatch(_ingress: usize, persistent: usize) {
    work::begin(persistent + _ingress);
    work::fixed_baseline(std::mem::size_of::<Custody>());
    work::descriptor_baseline(4);
}
pub(crate) fn schema(bytes: usize, words: usize, f: impl FnOnce() -> bool) -> bool {
    work::test(B::Fields, bytes, words, f)
}
pub(crate) fn request(input: &LedgerInput) -> Result<Owned<Request>, OpeningError> {
    if !schema(0, 1, || input.bytes.is_some()) {
        return Err(OpeningError::InvalidInput);
    }
    codec::decode::<crate::kernel::changes::ledger::Request>(input.as_bytes(), B::Ingress)
        .map(|r| Owned::new(Request::Ledger(r.into_inner())))
        .map_err(|_| OpeningError::InvalidInput)
}
pub(crate) fn reply(result: Result<Owned<Vec<u8>>, OpeningError>) -> Vec<u8> {
    match result {
        Ok(bytes) => bytes.into_inner(),
        Err(e) => {
            work::attempt(B::Errors, 0, 1);
            let b = Owned::new(e.json());
            work::complete(B::Errors, true);
            b.into_inner()
        }
    }
}

fn connection_path_work(directory: &std::path::Path, anchor: &std::path::Path) -> (usize, usize) {
    // The anchor span covers its parent and copied basename. The independent
    // RHS group contains the directory and anchor.tmp, even for short paths.
    // Six words cover five conjuncts and the directory-length addition.
    (
        directory.as_os_str().len() + anchor.as_os_str().len().max("anchor.tmp".len()),
        6,
    )
}

fn read_anchor(
    n: &Node,
    ctx: &mut Context,
    grants: &[crate::kernel::changes::ledger::LedgerPair; 16],
) -> Result<Owned<Anchor>, Failure> {
    let bytes = n.read_at(ctx, &n.parent, &n.anchor_name, "anchor.json", C, false)?;
    codec::anchor(&bytes, grants).map_err(|_| Failure::damage())
}

#[cfg(test)]
mod connection_path_tests {
    use super::connection_path_work;
    use std::path::Path;

    #[test]
    fn short_paths_cover_independent_literal_and_complete_schema() {
        for (directory, anchor, bytes) in [
            ("/a", "/Z", 12),
            ("/", "/Z", 11),
            ("/a", "/anchor.tmp", 13),
            ("/custody", "/long-anchor-name", 25),
        ] {
            assert_eq!(
                connection_path_work(Path::new(directory), Path::new(anchor)),
                (bytes, 6)
            );
        }
    }
}
