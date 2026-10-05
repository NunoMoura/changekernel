use super::*;

pub(super) struct MemberState {
    pub(super) prefix: Owned<Prefix>,
    pub(super) trace: Owned<Vec<u8>>,
    pub(super) record: Option<Owned<Origin>>,
    pub(super) temporary: bool,
    pub(super) anchor_temporary: bool,
}
impl Custody {
    pub(super) fn member_node(&mut self, slot: u64, fresh: bool) -> Result<Node, Failure> {
        let name = Owned::new(format!("m-{slot}"));
        if fresh {
            if let Err(e) = storage::mkdir(&self.members, &name) {
                if e.observed {
                    self.ctx.failure_scope = Some(0);
                }
                return Err(e);
            }
            self.ctx.event(slot as u8, "directory", "created")?;
        }
        let dir = storage::subdir(&self.members, &name)?;
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
        let anchor_name = Owned::new(format!("m-{slot}.anchor.json"));
        let custody = Owned::new(self.grant.grants[slot as usize - 1].custody.clone());
        let node = Node {
            dir,
            lock,
            parent: self.members.try_clone().map_err(|_| Failure::io())?,
            anchor_name: anchor_name.into_inner(),
            scope: slot as u8,
            custody: custody.into_inner(),
            justified: Cell::new(false),
            passes: Cell::new(0),
        };
        work::buffered_capacity(node.heap(), false);
        Ok(node)
    }
    pub(super) fn member_run<R>(
        &mut self,
        slot: u64,
        fresh: bool,
        f: impl FnOnce(&mut Self, &Node) -> Result<R, Failure>,
    ) -> Result<R, OpeningError> {
        work::update(|w| w.member_passes += 1);
        if !work::test(B::Fields, 0, 2, || {
            !(self.ctx.latched[0] || self.ctx.latched[slot as usize])
        }) {
            return Err(OpeningError::Unavailable);
        }
        let node = match self.member_node(slot, fresh) {
            Ok(n) => Owned::new(n),
            Err(e) => {
                if e.observed {
                    if self.ctx.failure_scope == Some(0) {
                        self.root.retain(&mut self.ctx, &e);
                    } else {
                        self.ctx.latched[slot as usize] = true;
                        work::attempt(B::Retention, 0, 1);
                        work::complete(B::Retention, false);
                    }
                }
                return Err(OpeningError::Unavailable);
            }
        };
        let result = f(self, &node);
        match result {
            Ok(v) => Ok(v),
            Err(e) => {
                if self.ctx.failure_scope == Some(0) {
                    self.root.retain(&mut self.ctx, &e);
                } else {
                    node.retain(&mut self.ctx, &e);
                }
                Err(OpeningError::Unavailable)
            }
        }
    }
    pub(super) fn member_anchor(
        &self,
        n: &Node,
        key: &str,
        stage: &str,
    ) -> Result<MemberAnchor, Failure> {
        let p = n.physical()?;
        let pair = &self.grant.grants[n.scope as usize - 1];
        let mut path = Owned::new(self.grant.directory.clone());
        path.push("members");
        path.refresh();
        let basename = Owned::new(format!("m-{}", n.scope));
        path.push(&*basename);
        path.refresh();
        let value = MemberAnchor {
            format: "ck-ledger-member-anchor@4".into(),
            custody: pair.custody.clone(),
            ledger: self.grant.ledger.clone(),
            workspace_id: self.grant.workspace_id.clone(),
            binding: self.grant.binding.clone(),
            change: pair.change.clone(),
            owner: self.grant.owner.clone(),
            key: key.into(),
            directory: path.to_str().ok_or_else(Failure::damage)?.into(),
            directory_device: p.directory_device,
            directory_inode: p.directory_inode,
            lock_device: p.lock_device,
            lock_inode: p.lock_inode,
            stage: stage.into(),
        };
        // The raw aggregate and path scratch really overlap before adoption.
        work::buffered_capacity(value.heap(), false);
        Ok(value)
    }
    fn matches_member_anchor(
        &self,
        n: &Node,
        a: &MemberAnchor,
        key: &str,
    ) -> Result<bool, Failure> {
        let physical = n.physical()?;
        let pair = &self.grant.grants[n.scope as usize - 1];
        let mut path = Owned::new(self.grant.directory.clone());
        path.push("members");
        path.refresh();
        let basename = Owned::new(format!("m-{}", n.scope));
        path.push(&*basename);
        path.refresh();
        let path = path.to_str().ok_or_else(Failure::damage)?;
        let expected_bytes = 24
            + pair.custody.len()
            + self.grant.ledger.len()
            + self.grant.workspace_id.len()
            + self.grant.binding.len()
            + pair.change.len()
            + self.grant.owner.len()
            + key.len()
            + path.len()
            + 9;
        Ok(work::test(
            B::Relationships,
            a.logical().max(expected_bytes),
            18,
            || {
                a.format == "ck-ledger-member-anchor@4"
                    && a.custody == pair.custody
                    && a.ledger == self.grant.ledger
                    && a.workspace_id == self.grant.workspace_id
                    && a.binding == self.grant.binding
                    && a.change == pair.change
                    && a.owner == self.grant.owner
                    && a.key == key
                    && a.directory == path
                    && a.directory_device == physical.directory_device
                    && a.directory_inode == physical.directory_inode
                    && a.lock_device == physical.lock_device
                    && a.lock_inode == physical.lock_inode
                    && a.stage == "installed"
            },
        ))
    }
    fn justify_member(
        &mut self,
        n: &Node,
        key: &str,
        p: Option<&Reservation>,
        accepted: Option<&Association>,
    ) -> Result<Owned<MemberAnchor>, Failure> {
        let a = n.anchor::<MemberAnchor>(&mut self.ctx)?;
        if !self.matches_member_anchor(n, &a, key)? {
            return Err(Failure::damage());
        }
        let physical = n.physical()?;
        if !work::test(B::Fields, 0, 4, || {
            p.and_then(|p| p.physical.as_ref())
                .or_else(|| accepted.map(|a| &a.physical))
                == Some(&physical)
        }) {
            return Err(Failure::damage());
        }
        n.justified.set(true);
        Ok(a)
    }
    pub(super) fn initial_prefix(&self, n: &Node) -> Prefix {
        Prefix {
            format: "ck-ledger-member-prefix@4".into(),
            custody: n.custody.clone(),
            change: self.grant.grants[n.scope as usize - 1].change.clone(),
            generation: 0,
            end: 0,
            sha256: None,
            pending: None,
        }
    }
    pub(super) fn initial_member(&mut self, n: &Node, complete: bool) -> Result<(), Failure> {
        let names = storage::inventory(&n.dir, 6, |s| {
            storage::allowed(
                s,
                &[
                    "writer.lock",
                    "trace.jsonl",
                    "checkpoint.json",
                    "incident.json",
                ],
            )
        })?;
        if !storage::present(&names, "writer.lock") {
            return Err(Failure::damage());
        }
        let prefix = Owned::constructed(|| self.initial_prefix(n));
        let clear = Owned::constructed(|| n.clear());
        let controls = [
            ("trace.jsonl", Ok(Owned::new(Vec::new()))),
            ("checkpoint.json", codec::emit(&*prefix, C)),
            ("incident.json", codec::emit(&*clear, C)),
        ];
        for (name, bytes) in controls {
            let bytes = bytes.map_err(|_| Failure::damage())?;
            if storage::exists_at(&n.dir, name)? {
                let actual = n.read(&mut self.ctx, name, C)?;
                if !work::test(B::Canonical, bytes.len().max(actual.len()), 1, || {
                    *actual == *bytes
                }) {
                    return Err(Failure::damage());
                }
            } else if !work::test(B::Fields, 0, 1, || !complete) {
                return Err(Failure::damage());
            }
        }
        Ok(())
    }
    pub(super) fn provision_member(&mut self, p: &Reservation) -> Result<Physical, OpeningError> {
        let name = Owned::new(format!("m-{}", p.slot));
        let anchor = Owned::new(format!("m-{}.anchor.json", p.slot));
        let dir = storage::exists_at(&self.members, &name).map_err(|e| self.shared_failure(e))?;
        let anchored =
            storage::exists_at(&self.members, &anchor).map_err(|e| self.shared_failure(e))?;
        if !work::test(B::Fields, 0, 2, || dir == anchored) {
            return Err(OpeningError::Unavailable);
        }
        self.ctx.phase = "provision";
        self.member_run(p.slot, !dir, |s, n| {
            let a = if !dir {
                n.sync(&mut s.ctx, &n.lock, "writer.lock")?;
                n.sync(&mut s.ctx, &n.dir, "directory")?;
                n.sync(&mut s.ctx, &n.parent, "anchor_parent")?;
                let a = Owned::try_constructed(|| {
                    s.member_anchor(n, p.input.key.as_deref().unwrap(), "preparing")
                })?;
                let bytes = codec::emit(&*a, C).map_err(|_| Failure::damage())?;
                n.create_anchor(&mut s.ctx, &bytes)?;
                a
            } else {
                n.anchor::<MemberAnchor>(&mut s.ctx)?
            };
            let expected = Owned::try_constructed(|| {
                s.member_anchor(n, p.input.key.as_deref().unwrap(), &a.stage)
            })?;
            if !work::test(
                B::Relationships,
                a.logical().max(expected.logical()),
                64,
                || *a == *expected && matches!(a.stage.as_str(), "preparing" | "installed"),
            ) {
                return Err(Failure::damage());
            }
            n.justified.set(true);
            let complete = work::test(B::Fields, a.stage.len().max("installed".len()), 1, || {
                a.stage == "installed"
            });
            s.initial_member(n, complete)?;
            if storage::exists_at(&n.parent, "anchor.tmp")? {
                s.initial_member(n, true)?;
                let bytes =
                    n.read_at(&mut s.ctx, &n.parent, "anchor.tmp", "anchor.tmp", C, false)?;
                let t: Owned<MemberAnchor> =
                    codec::retained(&bytes, B::Controls).map_err(|_| Failure::damage())?;
                let installed = Owned::try_constructed(|| {
                    s.member_anchor(n, p.input.key.as_deref().unwrap(), "installed")
                })?;
                if !work::test(B::Relationships, t.logical().max(a.logical()), 64, || {
                    *t == *a || (a.stage == "preparing" && *t == *installed)
                }) {
                    return Err(Failure::damage());
                }
                n.cleanup(&mut s.ctx, "anchor.tmp", true)?;
                s.initial_member(n, true)?;
            }
            if work::test(B::Fields, a.stage.len().max("preparing".len()), 1, || {
                a.stage == "preparing"
            }) {
                let prefix = Owned::constructed(|| s.initial_prefix(n));
                let clear = Owned::constructed(|| n.clear());
                for (name, bytes) in [
                    ("trace.jsonl", Ok(Owned::new(Vec::new()))),
                    ("checkpoint.json", codec::emit(&*prefix, C)),
                    ("incident.json", codec::emit(&*clear, C)),
                ] {
                    if !storage::exists_at(&n.dir, name)? {
                        n.create(&mut s.ctx, name, &bytes.map_err(|_| Failure::damage())?)?;
                    }
                }
                drop(prefix);
                drop(clear);
                s.initial_member(n, true)?;
                n.barriers(&mut s.ctx)?;
                let installed = Owned::try_constructed(|| {
                    s.member_anchor(n, p.input.key.as_deref().unwrap(), "installed")
                })?;
                n.replace(&mut s.ctx, "anchor.json", "anchor.tmp", &*installed, true)?;
            }
            n.barriers(&mut s.ctx)?;
            s.initial_member(n, true)?;
            let actual: Owned<MemberAnchor> = n.anchor(&mut s.ctx)?;
            let installed = Owned::try_constructed(|| {
                s.member_anchor(n, p.input.key.as_deref().unwrap(), "installed")
            })?;
            if !work::test(
                B::Relationships,
                actual.logical().max(installed.logical()),
                64,
                || *actual == *installed,
            ) {
                return Err(Failure::damage());
            }
            n.physical()
        })
    }
    pub(super) fn member(
        &mut self,
        n: &Node,
        p: Option<&Reservation>,
        accepted: Option<&Association>,
    ) -> Result<MemberState, Failure> {
        self.member_mode(n, p, accepted, false)
    }
    pub(super) fn member_mode(
        &mut self,
        n: &Node,
        p: Option<&Reservation>,
        accepted: Option<&Association>,
        barriers: bool,
    ) -> Result<MemberState, Failure> {
        // Acquisition counted the first pass; another validation on the same
        // scoped node is another pass, including barrier-only failures.
        if n.passes.replace(n.passes.get() + 1) > 0 {
            work::update(|w| w.member_passes += 1);
        }
        n.binding(&self.members)?;
        let key = p
            .and_then(|p| p.input.key.as_deref())
            .or_else(|| accepted.map(|a| a.key.as_str()))
            .ok_or_else(Failure::damage)?;
        if barriers {
            // Newly pinned handles need current independent grant/anchor/tuple
            // proof before any barrier. Earlier closed sweep handles grant none.
            if !n.justified.get() {
                self.justify_member(n, key, p, accepted)?;
            }
            n.barriers(&mut self.ctx)?;
        }
        let a = self.justify_member(n, key, p, accepted)?;
        let physical = n.physical()?;
        let anchor_temporary = accepted.is_none() && storage::exists_at(&n.parent, "anchor.tmp")?;
        let names = storage::inventory(&n.dir, 6, |s| {
            storage::allowed(
                s,
                &[
                    "writer.lock",
                    "trace.jsonl",
                    "checkpoint.json",
                    "incident.json",
                    "checkpoint.tmp",
                    "incident.tmp",
                ],
            )
        })?;
        for name in [
            "writer.lock",
            "trace.jsonl",
            "checkpoint.json",
            "incident.json",
        ] {
            if !storage::present(&names, name) {
                return Err(Failure::damage());
            }
        }
        n.incident(&mut self.ctx)?;
        let prefix: Owned<Prefix> = n.control(&mut self.ctx, "checkpoint.json")?;
        if !work::test(B::Fields, 0, 3, || {
            prefix.format.len() == "ck-ledger-member-prefix@4".len()
                && prefix.custody.len() == n.custody.len()
                && prefix.change.len() == self.grant.grants[n.scope as usize - 1].change.len()
        }) {
            return Err(Failure::damage());
        }
        if !work::test(
            B::Fields,
            prefix.format.len()
                + prefix.custody.len().max(n.custody.len())
                + prefix
                    .change
                    .len()
                    .max(self.grant.grants[n.scope as usize - 1].change.len()),
            3,
            || {
                prefix.format == "ck-ledger-member-prefix@4"
                    && prefix.custody == n.custody
                    && prefix.change == self.grant.grants[n.scope as usize - 1].change
            },
        ) {
            return Err(Failure::damage());
        }
        let trace = n.read(&mut self.ctx, "trace.jsonl", T)?;
        let record = match prefix.generation {
            0 => {
                work::test(B::Fields, 0, 1, || p.is_some());
                let p = p.ok_or_else(Failure::damage)?;
                if !work::test(B::Fields, 0, 3, || {
                    accepted.is_none() && prefix.end == 0 && prefix.sha256.is_none()
                }) {
                    return Err(Failure::damage());
                }
                if let Some(pending) = &prefix.pending {
                    if !work::test(
                        B::TypedInput,
                        (pending.input.payload() + pending.actor.len())
                            .max(p.input.payload() + p.actor.len()),
                        32,
                        || pending.input == p.input && pending.actor == p.actor,
                    ) {
                        return Err(Failure::damage());
                    }
                    let origin = self.origin(p)?;
                    let bytes = codec::emit_origin(&origin).map_err(|_| Failure::damage())?;
                    if !work::test(B::Fields, 0, 1, || trace.len() <= bytes.len())
                        || !work::test(B::Relationships, trace.len(), 1, || {
                            bytes[..trace.len()] == **trace
                        })
                    {
                        return Err(Failure::damage());
                    }
                } else if !work::test(B::Fields, 0, 1, || trace.is_empty()) {
                    return Err(Failure::damage());
                }
                None
            }
            1 => {
                if !work::test(B::Fields, 0, 4, || {
                    prefix.pending.is_none()
                        && prefix.end > 0
                        && prefix.end <= C as u64
                        && prefix.end <= trace.len() as u64
                }) {
                    return Err(Failure::damage());
                }
                if !work::test(B::Fields, 0, 1, || {
                    accepted.is_some() || trace.len() as u64 == prefix.end
                }) {
                    return Err(Failure::damage());
                }
                let bytes = &trace[..prefix.end as usize];
                let digest = Owned::new(hash(bytes, true));
                if !work::test(
                    B::Fields,
                    prefix
                        .sha256
                        .as_ref()
                        .map_or(0, String::len)
                        .max(digest.len()),
                    1,
                    || prefix.sha256.as_deref() == Some(digest.as_str()),
                ) {
                    return Err(Failure::damage());
                }
                let (record, canonical_input) =
                    codec::retained_origin(bytes).map_err(|_| Failure::damage())?;
                let pair = &self.grant.grants[n.scope as usize - 1];
                if !self.valid_input(&record.input) {
                    return Err(Failure::damage());
                }
                if let Some(p) = p {
                    if !work::test(
                        B::TypedInput,
                        record.input.payload().max(p.input.payload()),
                        32,
                        || record.input == p.input,
                    ) {
                        return Err(Failure::damage());
                    }
                }
                let origin_id = Owned::new(format!("{}:origin", pair.change));
                let expected_payload = record.input.payload()
                    + pair.custody.len()
                    + 2 * self.grant.ledger.len()
                    + 2 * self.grant.workspace_id.len()
                    + self.grant.binding.len()
                    + 2 * pair.change.len()
                    + 2 * key.len()
                    + 2 * "created".len()
                    + "owner-1".len()
                    + origin_id.len();
                if !work::test(
                    B::Semantic,
                    record.logical().max(expected_payload),
                    64,
                    || {
                        record.v == 4
                            && record.custody == pair.custody
                            && record.ledger == self.grant.ledger
                            && record.workspace_id == self.grant.workspace_id
                            && record.binding == self.grant.binding
                            && record.change == pair.change
                            && record.seq == 1
                            && record.prev.is_none()
                            && record.kind == "created"
                            && record.input.key.as_deref() == Some(key)
                            && record.result.v == 4
                            && record.result.kind == "created"
                            && record.result.ledger == self.grant.ledger
                            && record.result.workspace_id == self.grant.workspace_id
                            && record.result.change == pair.change
                            && record.result.key == key
                            && record.result.actor == "owner-1"
                            && record.result.result == *origin_id
                            && record.result.seq == 1
                    },
                ) {
                    return Err(Failure::damage());
                }
                if let Some(a) = accepted {
                    let input_digest = Owned::new(canonical_input.digest());
                    let expected_payload = record.result.key.len()
                        + record.change.len()
                        + record.custody.len()
                        + record.result.actor.len()
                        + input_digest.len()
                        + digest.len();
                    if !work::test(
                        B::Relationships,
                        a.logical().max(expected_payload),
                        32,
                        || {
                            a.slot == u64::from(n.scope)
                                && a.key == record.result.key
                                && a.change == record.change
                                && a.custody == record.custody
                                && a.actor == record.result.actor
                                && a.input_sha256 == *input_digest
                                && a.origin_end == prefix.end
                                && a.origin_sha256 == *digest
                                && a.physical == physical
                        },
                    ) {
                        return Err(Failure::damage());
                    }
                }
                Some(record)
            }
            _ => {
                work::test(B::Fields, 0, 1, || false);
                return Err(Failure::damage());
            }
        };
        let temporary = storage::present(&names, "checkpoint.tmp");
        if temporary {
            let t: Owned<Prefix> = n.control(&mut self.ctx, "checkpoint.tmp")?;
            let equal = work::test(
                B::Relationships,
                t.logical().max(prefix.logical()),
                32,
                || *t == *prefix,
            );
            if !equal {
                if !work::test(B::Fields, 0, 2, || {
                    !(accepted.is_some() || prefix.generation != 0)
                }) {
                    return Err(Failure::damage());
                }
                work::test(B::Fields, 0, 1, || p.is_some());
                let p = p.ok_or_else(Failure::damage)?;
                if work::test(B::Fields, 0, 2, || {
                    prefix.pending.is_none() && trace.is_empty()
                }) {
                    let expected = Owned::constructed(|| Prefix {
                        pending: Some(Pending {
                            input: p.input.clone(),
                            actor: p.actor.clone(),
                        }),
                        format: prefix.format.clone(),
                        custody: prefix.custody.clone(),
                        change: prefix.change.clone(),
                        generation: prefix.generation,
                        end: prefix.end,
                        sha256: prefix.sha256.clone(),
                    });
                    if !work::test(
                        B::Relationships,
                        t.logical().max(expected.logical()),
                        32,
                        || *t == *expected,
                    ) {
                        return Err(Failure::damage());
                    }
                } else if work::test(B::Fields, 0, 1, || prefix.pending.is_some()) {
                    let origin = self.origin(p)?;
                    let bytes = codec::emit_origin(&origin).map_err(|_| Failure::damage())?;
                    let expected = Owned::constructed(|| Prefix {
                        generation: 1,
                        end: bytes.len() as u64,
                        sha256: Some(hash(&bytes, false)),
                        pending: None,
                        format: prefix.format.clone(),
                        custody: prefix.custody.clone(),
                        change: prefix.change.clone(),
                    });
                    if !work::test(
                        B::Relationships,
                        trace.len().max(bytes.len()) + t.logical().max(expected.logical()),
                        32,
                        || *trace == *bytes && *t == *expected,
                    ) {
                        return Err(Failure::damage());
                    }
                } else {
                    return Err(Failure::damage());
                }
            }
        }
        if anchor_temporary {
            if !work::test(B::Fields, 0, 4, || {
                !(temporary
                    || prefix.generation != 0
                    || prefix.pending.is_some()
                    || !trace.is_empty())
            }) {
                return Err(Failure::damage());
            }
            let bytes = n.read_at(
                &mut self.ctx,
                &n.parent,
                "anchor.tmp",
                "anchor.tmp",
                C,
                false,
            )?;
            let candidate: Owned<MemberAnchor> =
                codec::retained(&bytes, B::Controls).map_err(|_| Failure::damage())?;
            if !work::test(
                B::Relationships,
                candidate.logical().max(a.logical()),
                64,
                || *candidate == *a,
            ) {
                return Err(Failure::damage());
            }
        }
        n.binding(&self.members)?;
        Ok(MemberState {
            prefix,
            trace,
            record,
            temporary,
            anchor_temporary,
        })
    }
    // Accepted input is obtained from independently selected bytes, not from the
    // association digest. The normal member pass then proves the whole conjunction.
    pub(super) fn accepted_member(
        &mut self,
        n: &Node,
        a: &Association,
    ) -> Result<MemberState, Failure> {
        self.member(n, None, Some(a))
    }

    pub(super) fn accepted_member_barrier(
        &mut self,
        n: &Node,
        a: &Association,
    ) -> Result<MemberState, Failure> {
        self.member_mode(n, None, Some(a), true)
    }
    pub(super) fn shared_failure(&mut self, e: Failure) -> OpeningError {
        self.root.retain(&mut self.ctx, &e);
        OpeningError::Unavailable
    }
    pub(super) fn read_shared(&mut self) -> Result<State, OpeningError> {
        self.shared().map_err(|e| self.shared_failure(e))
    }
    pub(super) fn shared_sync(&mut self) -> Result<(), OpeningError> {
        self.shared_barriers().map_err(|e| self.shared_failure(e))
    }
    pub(super) fn replace_shared(&mut self, c: &Creations) -> Result<(), OpeningError> {
        self.root
            .replace(&mut self.ctx, "creation.json", "creation.tmp", c, false)
            .map_err(|e| self.shared_failure(e))
    }
    pub(super) fn member_permission(
        &self,
        guard: &mut dyn LedgerGuard,
        change: &str,
        create: bool,
        metadata: bool,
    ) -> Result<(), OpeningError> {
        if create {
            policy::member(
                guard,
                &self.grant.ledger,
                change,
                LedgerMemberPermission::Create,
            )?;
        }
        if metadata {
            policy::member(
                guard,
                &self.grant.ledger,
                change,
                LedgerMemberPermission::Metadata,
            )?;
        }
        policy::member(
            guard,
            &self.grant.ledger,
            change,
            LedgerMemberPermission::History,
        )
    }
    pub(super) fn metadata(m: &MemberState) -> Result<Metadata, Failure> {
        work::attempt(B::Constructions, 0, 16);
        let record = m.record.as_ref().ok_or_else(Failure::damage)?;
        let metadata = Metadata {
            change: record.change.clone(),
            origin: record.result.result.clone(),
            actor: record.result.actor.clone(),
            accepted: Accepted {
                first: 1,
                last: 1,
                sha256: m.prefix.sha256.clone().ok_or_else(Failure::damage)?,
            },
            progress: if m.trace.len() as u64 > m.prefix.end {
                "blocked_unaccepted_tail"
            } else {
                "ready"
            }
            .into(),
        };
        work::complete(B::Constructions, true);
        Ok(metadata)
    }
}
