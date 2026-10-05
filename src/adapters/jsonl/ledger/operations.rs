use super::*;

impl Custody {
    pub fn finish_connect(&mut self, guard: &mut dyn LedgerGuard) -> Result<(), OpeningError> {
        let mut state = self.read_shared()?;
        if let Some(temp) = state.temp.as_mut() {
            if matches!(temp.kind, Kind::Ready | Kind::Accept) {
                self.deferred = temp.bytes.take();
            }
        }
        policy::collection(
            guard,
            &self.grant.ledger,
            policy::LedgerCollectionPermission::Connect,
        )
    }
    pub fn dispatch(
        &mut self,
        input: &Request,
        guard: &mut dyn LedgerGuard,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        self.ctx.phase = "recover";
        let state = self.read_shared()?;
        let unresolved = state
            .temp
            .as_ref()
            .is_some_and(|t| matches!(t.kind, Kind::Ready | Kind::Accept));
        let opcode_bytes = if unresolved {
            input.op.len().max("create_change".len())
        } else {
            0
        };
        if !work::test(B::Fields, opcode_bytes, 3, || {
            !(unresolved
                && !(input.op == "create_change"
                    && state.control.pending.as_ref().is_some_and(|p| {
                        work::test(
                            B::Identifiers,
                            p.input
                                .key
                                .as_ref()
                                .map_or(0, String::len)
                                .max(input.key.as_ref().map_or(0, String::len)),
                            1,
                            || p.input.key == input.key,
                        )
                    })))
        }) {
            return Err(OpeningError::Unavailable);
        }
        match input.op.as_str() {
            "create_change" => self.create(input, guard, state),
            "list_changes" => self.list(input, guard, state),
            "select_change" | "inspect_change" => self.read_member(input, guard, state),
            _ => Err(OpeningError::Unsupported),
        }
    }
    fn final_collection(
        &self,
        input: &Request,
        guard: &mut dyn LedgerGuard,
    ) -> Result<(), OpeningError> {
        policy::collection(
            guard,
            &self.grant.ledger,
            match input.op.as_str() {
                "create_change" => policy::LedgerCollectionPermission::Create,
                "list_changes" => policy::LedgerCollectionPermission::List,
                _ => policy::LedgerCollectionPermission::Connect,
            },
        )
    }
    fn output<T: serde_core::Serialize + Heap>(
        &mut self,
        v: &T,
        limit: usize,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        work::attempt(B::Outputs, 0, 1);
        let bytes = codec::emit_reply(v, limit).map_err(|_| OpeningError::Unavailable)?;
        work::complete(B::Outputs, true);
        Ok(bytes)
    }
    fn delivery_event(&mut self) -> Result<(), OpeningError> {
        match self.ctx.event(0, "reply", "before") {
            Ok(LedgerIoFault::Io) | Err(_) => Err(OpeningError::Unavailable),
            _ => Ok(()),
        }
    }
    fn read_member(
        &mut self,
        input: &Request,
        guard: &mut dyn LedgerGuard,
        state: State,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        let change = input.change.as_ref().unwrap();
        let a = state
            .control
            .entries
            .0
            .iter()
            .find(|a| {
                work::test(B::Identifiers, a.change.len().max(change.len()), 1, || {
                    a.change == *change
                })
            })
            .ok_or(OpeningError::Unavailable)?;
        let selection = input.op == "select_change";
        let result = self.member_run(a.slot, false, |s, n| {
            let m = s.accepted_member(n, a)?;
            work::attempt(B::Outputs, 0, 1);
            let bytes = if selection {
                let value = Owned::try_constructed(|| {
                    Ok::<_, Failure>(Selection {
                        v: 4,
                        kind: "selection".into(),
                        ledger: s.grant.ledger.clone(),
                        workspace_id: s.grant.workspace_id.clone(),
                        member: Self::metadata(&m)?,
                    })
                })?;
                codec::emit_reply(&*value, L).map_err(|_| Failure::damage())?
            } else {
                let record = m.record.as_ref().ok_or_else(Failure::damage)?;
                let copy = Owned::constructed(|| (**record).clone());
                let id = Owned::new(record.result.result.clone());
                let value = Owned::constructed(|| Inspection {
                    v: 4,
                    kind: "inspection".into(),
                    ledger: s.grant.ledger.clone(),
                    workspace_id: s.grant.workspace_id.clone(),
                    change: change.clone(),
                    projection: "ck-ledger-origin-view@1".into(),
                    purpose: "intent".into(),
                    origin: (*id).clone(),
                    tip: (*id).clone(),
                    current_intent: (*id).clone(),
                    record: copy.into_inner(),
                    coverage: Coverage {
                        first: 1,
                        last: 1,
                        sha256: a.origin_sha256.clone(),
                        selected: 1,
                        returned: 1,
                        complete: true,
                    },
                    progress: if m.trace.len() as u64 > m.prefix.end {
                        "blocked_unaccepted_tail"
                    } else {
                        "ready"
                    }
                    .into(),
                });
                codec::emit_reply(&*value, T).map_err(|_| Failure::damage())?
            };
            work::complete(B::Outputs, true);
            drop(m);
            s.ctx.phase = "deliver";
            s.accepted_member_barrier(n, a)?;
            Ok(bytes)
        })?;
        drop(state);
        self.shared_sync()?;
        self.read_shared()?;
        self.final_collection(input, guard)?;
        self.member_permission(guard, change, false, selection)?;
        self.delivery_event()?;
        Ok(result)
    }
    fn list(
        &mut self,
        input: &Request,
        guard: &mut dyn LedgerGuard,
        state: State,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        if let Some(Some(cursor)) = &input.cursor {
            if !state.control.entries.0.iter().any(|a| {
                work::test(
                    B::Identifiers,
                    a.change.len().max(cursor.after.len()),
                    1,
                    || a.change == cursor.after,
                )
            }) {
                return Err(OpeningError::Unavailable);
            }
        }
        let mut allowed = [false; 16];
        let mut metadata = Owned::new(Vec::with_capacity(16));
        for (i, a) in state.control.entries.0.iter().enumerate() {
            match self.member_permission(guard, &a.change, false, true) {
                Err(OpeningError::Denied) => continue,
                Err(e) => return Err(e),
                Ok(()) => allowed[i] = true,
            }
            let m = self.member_run(a.slot, false, |s, n| {
                let m = s.accepted_member(n, a)?;
                Self::metadata(&m)
            })?;
            metadata.push(m);
            metadata.refresh();
        }
        metadata.sort_by(|a, b| {
            work::attempt(B::Ordering, a.change.len().max(b.change.len()), 1);
            let order = a.change.cmp(&b.change);
            work::complete(B::Ordering, order == std::cmp::Ordering::Equal);
            order
        });
        let after = input
            .cursor
            .as_ref()
            .and_then(Option::as_ref)
            .map(|c| c.after.as_str());
        let start = metadata
            .iter()
            .position(|m| {
                after.is_none_or(|c| {
                    work::test(B::Ordering, m.change.len().max(c.len()), 1, || {
                        m.change.as_str() > c
                    })
                })
            })
            .unwrap_or(metadata.len());
        let limit = input.limit.unwrap() as usize;
        let end = (start + limit).min(metadata.len());
        work::attempt(B::Constructions, 0, 1);
        let page = PageRef {
            ledger: &input.ledger,
            workspace: &input.workspace_id,
            entries: &metadata[start..end],
            after: if end < metadata.len() {
                Some(&metadata[end - 1].change)
            } else {
                None
            },
            limit: limit as u64,
        };
        work::complete(B::Constructions, true);
        let bytes = self.output(&page, L)?;
        drop(metadata);
        self.ctx.phase = "deliver";
        for (i, a) in state.control.entries.0.iter().enumerate() {
            if allowed[i] {
                self.member_run(a.slot, false, |s, n| {
                    s.accepted_member_barrier(n, a)?;
                    Ok(())
                })?;
            }
        }
        let count = state.control.entries.0.len();
        let generation = state.control.generation;
        drop(state);
        self.shared_sync()?;
        let state = self.read_shared()?;
        if !work::test(B::Fields, 0, 2, || {
            state.control.entries.0.len() == count && state.control.generation == generation
        }) {
            return Err(OpeningError::Unavailable);
        }
        self.final_collection(input, guard)?;
        for (i, a) in state.control.entries.0.iter().enumerate() {
            match (
                allowed[i],
                self.member_permission(guard, &a.change, false, true),
            ) {
                (true, Err(e)) => return Err(e),
                (false, Ok(())) => return Err(OpeningError::Unavailable),
                (false, Err(OpeningError::Denied)) | (true, Ok(())) => (),
                (_, Err(e)) => return Err(e),
            }
        }
        if let Some(Some(cursor)) = &input.cursor {
            self.member_permission(guard, &cursor.after, false, true)?;
        }
        self.delivery_event()?;
        Ok(bytes)
    }
    fn proof_member(
        &mut self,
        p: &Reservation,
        kind: Kind,
        barriers: bool,
    ) -> Result<(), OpeningError> {
        self.member_run(p.slot, false, |s, n| {
            let m = s.member_mode(n, Some(p), None, barriers)?;
            let known = if kind == Kind::Ready {
                m.prefix.generation == 0 && m.prefix.pending.is_none() && m.trace.is_empty()
            } else {
                m.prefix.generation == 1
                    && m.record.is_some()
                    && m.trace.len() as u64 == m.prefix.end
            };
            if !work::test(B::Relationships, 0, 4, || known) {
                return Err(Failure::damage());
            }
            Ok(())
        })
    }
    fn proof_state(&mut self, p: &Reservation, kind: Kind) -> Result<State, OpeningError> {
        let state = self.read_shared()?;
        let original = state
            .control
            .pending
            .as_ref()
            .ok_or(OpeningError::Unavailable)?;
        let temp = state.temp.as_ref().ok_or(OpeningError::Unavailable)?;
        let tuple = if kind == Kind::Ready {
            temp.candidate
                .pending
                .as_ref()
                .and_then(|p| p.physical.as_ref())
        } else {
            temp.candidate.last.as_ref().map(|a| &a.physical)
        };
        if !work::test(
            B::Relationships,
            p.logical().max(original.logical()),
            32,
            || {
                temp.kind == kind
                    && original.slot == p.slot
                    && original.input == p.input
                    && original.actor == p.actor
                    && tuple == p.physical.as_ref()
            },
        ) {
            return Err(OpeningError::Unavailable);
        }
        Ok(state)
    }
    fn deferred(
        &mut self,
        p: &Reservation,
        kind: Kind,
        input: &Request,
        guard: &mut dyn LedgerGuard,
    ) -> Result<State, OpeningError> {
        self.ctx.phase = "recover";
        self.proof_state(p, kind)?;
        self.proof_member(p, kind, false)?;
        self.shared_sync()?;
        self.proof_state(p, kind)?;
        self.proof_member(p, kind, true)?;
        self.final_collection(input, guard)?;
        let change = &self.grant.grants[p.slot as usize - 1].change;
        self.member_permission(guard, change, true, false)?;
        self.root
            .cleanup(&mut self.ctx, "creation.tmp", false)
            .map_err(|e| self.shared_failure(e))?;
        self.deferred = None;
        let state = self.read_shared()?;
        if state.temp.is_some() {
            return Err(OpeningError::Unavailable);
        }
        self.proof_member(p, kind, false)?;
        Ok(state)
    }
    fn create(
        &mut self,
        input: &Request,
        guard: &mut dyn LedgerGuard,
        mut state: State,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        let key = input.key.as_ref().unwrap();
        if let Some(a) = state.control.entries.0.iter().find(|a| {
            work::test(B::Identifiers, a.key.len().max(key.len()), 1, || {
                a.key == *key
            })
        }) {
            self.member_permission(guard, &a.change, false, false)?;
            let mut conflict = false;
            let bytes = self.member_run(a.slot, false, |s, n| {
                let m = s.accepted_member(n, a)?;
                let record = m.record.as_ref().ok_or_else(Failure::damage)?;
                conflict = !work::test(
                    B::TypedInput,
                    input.payload().max(record.input.payload()),
                    32,
                    || record.input == *input,
                );
                if conflict {
                    return Ok(None);
                }
                work::attempt(B::Outputs, 0, 1);
                let bytes = codec::emit_reply(&record.result, C).map_err(|_| Failure::damage())?;
                work::complete(B::Outputs, true);
                drop(m);
                s.ctx.phase = "deliver";
                s.accepted_member_barrier(n, a)?;
                Ok(Some(bytes))
            })?;
            if conflict {
                return Err(OpeningError::Conflict);
            }
            let change = Owned::new(a.change.clone());
            drop(state);
            self.shared_sync()?;
            self.read_shared()?;
            self.final_collection(input, guard)?;
            self.member_permission(guard, &change, false, false)?;
            self.delivery_event()?;
            return bytes.ok_or(OpeningError::Unavailable);
        }
        let slot = state.control.entries.0.len() as u64 + 1;
        if let Some(p) = &state.control.pending {
            if !work::test(
                B::Identifiers,
                p.input
                    .key
                    .as_ref()
                    .map_or(0, String::len)
                    .max(input.key.as_ref().map_or(0, String::len)),
                1,
                || p.input.key == input.key,
            ) {
                return Err(OpeningError::Unavailable);
            }
            let change = &self.grant.grants[p.slot as usize - 1].change;
            self.member_permission(guard, change, true, false)?;
            if !work::test(
                B::TypedInput,
                input.payload().max(p.input.payload()),
                32,
                || p.input == *input,
            ) {
                return Err(OpeningError::Conflict);
            }
        } else {
            if !work::test(B::Fields, 0, 1, || state.control.entries.0.len() != 16) {
                return Err(OpeningError::Unsupported);
            }
            self.member_permission(
                guard,
                &self.grant.grants[slot as usize - 1].change,
                true,
                false,
            )?;
        }
        if let Some(temp) = &state.temp {
            match temp.kind {
                Kind::Ready | Kind::Accept => {
                    let kind = temp.kind;
                    let mut p =
                        Owned::constructed(|| state.control.pending.as_ref().unwrap().clone());
                    if kind == Kind::Ready {
                        p.physical = temp.candidate.pending.as_ref().unwrap().physical.clone();
                        p.phase = "ready".into();
                    }
                    drop(state);
                    state = self.deferred(&p, kind, input, guard)?;
                }
                Kind::Reserve => {
                    let p = temp.candidate.pending.as_ref().unwrap();
                    self.member_permission(
                        guard,
                        &self.grant.grants[p.slot as usize - 1].change,
                        true,
                        false,
                    )?;
                    if !work::test(
                        B::TypedInput,
                        p.input.payload().max(input.payload()),
                        32,
                        || p.input == *input,
                    ) {
                        return Err(OpeningError::Unavailable);
                    }
                    self.shared_sync()?;
                    self.final_collection(input, guard)?;
                    self.root
                        .cleanup(&mut self.ctx, "creation.tmp", false)
                        .map_err(|e| self.shared_failure(e))?;
                    drop(state);
                    state = self.read_shared()?;
                }
                Kind::Equal => {
                    self.shared_sync()?;
                    self.final_collection(input, guard)?;
                    self.root
                        .cleanup(&mut self.ctx, "creation.tmp", false)
                        .map_err(|e| self.shared_failure(e))?;
                    drop(state);
                    state = self.read_shared()?;
                }
            }
        }
        if state.control.pending.is_none() {
            let p = Owned::constructed(|| Reservation {
                slot,
                input: input.clone(),
                actor: "owner-1".into(),
                phase: "reserved".into(),
                physical: None,
            });
            let origin = self.origin(&p).map_err(|_| OpeningError::Unsupported)?;
            codec::emit_origin(&origin).map_err(|_| OpeningError::Unsupported)?;
            drop(origin);
            self.ctx.phase = "reserve";
            state.control.pending = Some(Owned::constructed(|| (*p).clone()).into_inner());
            state.control.generation += 1;
            state.control.refresh();
            // Check full prospective canonical control before any replacement.
            codec::emit(&*state.control, C).map_err(|_| OpeningError::Unsupported)?;
            self.replace_shared(&state.control)?;
            drop(state);
            state = self.read_shared()?;
        }
        let phase = &state.control.pending.as_ref().unwrap().phase;
        if work::test(B::Fields, phase.len().max("reserved".len()), 1, || {
            phase == "reserved"
        }) {
            let p = Owned::constructed(|| state.control.pending.as_ref().unwrap().clone());
            let physical = self.provision_member(&p)?;
            self.ctx.phase = "associate";
            let pending = state.control.pending.as_mut().unwrap();
            pending.phase = "ready".into();
            pending.physical = Some(physical);
            state.control.generation += 1;
            state.control.refresh();
            self.replace_shared(&state.control)?;
            drop(state);
            state = self.read_shared()?;
        }
        let p = Owned::constructed(|| state.control.pending.as_ref().unwrap().clone());
        self.ctx.phase = "recover";
        let result = self.member_run(p.slot, false, |s, n| {
            let mut m = s.member(n, Some(&p), None)?;
            if m.anchor_temporary {
                drop(m);
                n.cleanup(&mut s.ctx, "anchor.tmp", true)?;
                m = s.member(n, Some(&p), None)?;
                if !work::test(B::Fields, 0, 1, || !m.anchor_temporary) {
                    return Err(Failure::damage());
                }
            }
            if m.temporary {
                drop(m);
                n.cleanup(&mut s.ctx, "checkpoint.tmp", false)?;
                m = s.member(n, Some(&p), None)?;
                if !work::test(B::Fields, 0, 1, || !m.temporary) {
                    return Err(Failure::damage());
                }
            }
            if m.prefix.generation == 0 {
                if m.prefix.pending.is_none() {
                    s.ctx.phase = "reserve";
                    let pending = Owned::constructed(|| Prefix {
                        pending: Some(Pending {
                            input: p.input.clone(),
                            actor: p.actor.clone(),
                        }),
                        format: m.prefix.format.clone(),
                        custody: m.prefix.custody.clone(),
                        change: m.prefix.change.clone(),
                        generation: m.prefix.generation,
                        end: m.prefix.end,
                        sha256: m.prefix.sha256.clone(),
                    });
                    n.replace(
                        &mut s.ctx,
                        "checkpoint.json",
                        "checkpoint.tmp",
                        &*pending,
                        false,
                    )?;
                    drop(m);
                    m = s.member(n, Some(&p), None)?;
                }
                let origin = s.origin(&p)?;
                let bytes = codec::emit_origin(&origin).map_err(|_| Failure::damage())?;
                s.ctx.phase = "append";
                if m.trace.len() < bytes.len() {
                    n.append(&mut s.ctx, &bytes[m.trace.len()..])?;
                }
                n.sync_name(&mut s.ctx, "trace.jsonl")?;
                let prefix = Owned::constructed(|| Prefix {
                    generation: 1,
                    end: bytes.len() as u64,
                    sha256: Some(hash(&bytes, false)),
                    pending: None,
                    format: m.prefix.format.clone(),
                    custody: m.prefix.custody.clone(),
                    change: m.prefix.change.clone(),
                });
                drop(origin);
                drop(bytes);
                drop(m);
                s.ctx.phase = "checkpoint";
                n.replace(
                    &mut s.ctx,
                    "checkpoint.json",
                    "checkpoint.tmp",
                    &*prefix,
                    false,
                )?;
                m = s.member(n, Some(&p), None)?;
            }
            let record = m.record.as_ref().ok_or_else(Failure::damage)?;
            let a = s.association(&p, record, &m.trace, None)?;
            work::attempt(B::Outputs, 0, 1);
            let result = codec::emit_reply(&record.result, C).map_err(|_| Failure::damage())?;
            work::complete(B::Outputs, true);
            Ok((a, result))
        })?;
        let (a, result) = result;
        self.ctx.phase = "associate";
        state
            .control
            .entries
            .0
            .push(Owned::constructed(|| (*a).clone()).into_inner());
        state.control.pending = None;
        state.control.generation += 1;
        state.control.refresh();
        self.replace_shared(&state.control)?;
        drop(state);
        state = self.read_shared()?;
        self.shared_sync()?;
        let a = state
            .control
            .entries
            .0
            .last()
            .ok_or(OpeningError::Unavailable)?;
        self.ctx.phase = "deliver";
        self.member_run(p.slot, false, |s, n| {
            s.accepted_member_barrier(n, a)?;
            Ok(())
        })?;
        let bytes = result;
        let change = Owned::new(a.change.clone());
        drop(state);
        self.read_shared()?;
        self.final_collection(input, guard)?;
        self.member_permission(guard, &change, true, false)?;
        self.delivery_event()?;
        Ok(bytes)
    }
}
