//! Concrete v5 orchestration; filesystem effects remain in the shared ledger path.
use super::super::{members::MemberState, *};
use super::{projection, sequential};
use crate::application::ledger_history::{
    self as auth, LedgerHistoryGuard as Guard, LedgerHistoryMemberPermission as Permission,
    SharedGuard,
};
fn disclosure(
    guard: &mut dyn Guard,
    ledger: &str,
    change: &str,
    metadata: bool,
) -> Result<(), OpeningError> {
    if metadata {
        auth::member(guard, ledger, change, Permission::Metadata)?;
    }
    auth::member(guard, ledger, change, Permission::History)
}
fn mutation_gate(
    guard: &mut dyn Guard,
    ledger: &str,
    change: &str,
    op: &str,
) -> Result<(), OpeningError> {
    auth::collection(guard, ledger, policy::LedgerCollectionPermission::Connect)?;
    disclosure(guard, ledger, change, false)?;
    auth::member(
        guard,
        ledger,
        change,
        if op == "revise_intent" {
            Permission::AdoptIntent
        } else {
            Permission::RunCheck
        },
    )
}
impl<P: Layout> Custody<P> {
    pub(crate) fn history_dispatch(
        &mut self,
        input: &Request,
        guard: &mut dyn Guard,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        self.ctx.phase = "recover";
        let state = self.read_shared()?;
        let unresolved = state
            .temp
            .as_ref()
            .is_some_and(|t| matches!(t.kind, Kind::Ready | Kind::Accept));
        if !work::test(
            B::Fields,
            if unresolved {
                input.op.len().max(13)
            } else {
                0
            },
            3,
            || {
                !unresolved
                    || input.op == "create_change"
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
                        })
            },
        ) {
            return Err(OpeningError::Unavailable);
        }
        match input.op.as_str() {
            "create_change" => self.create(input, &mut SharedGuard(guard), state),
            "list_changes" => self.history_list(input, guard, state),
            "select_change" | "inspect_history" | "inspect_context" | "revise_intent"
            | "run_check" => self.history_target(input, guard, state),
            _ => Err(OpeningError::Unsupported),
        }
    }
    fn history_target(
        &mut self,
        input: &Request,
        guard: &mut dyn Guard,
        state: State<P>,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        let change = input.change.as_deref().unwrap();
        let a = state
            .control
            .entries
            .0
            .iter()
            .find(|a| {
                work::test(B::Identifiers, a.change.len().max(change.len()), 1, || {
                    a.change == change
                })
            })
            .ok_or(OpeningError::Unavailable)?;
        let mutation = input.history().mutation();
        let mut needs_mutation = false;
        let result = self.member_run(a.slot, false, |s, n| {
            let m = s.accepted_member(n, a)?;
            let result = if mutation {
                s.history_mutation(input, guard, n, a, m, &mut needs_mutation)?
            } else {
                let output = if input.op == "select_change" {
                    Ok(s.history_selection(&m)?)
                } else {
                    s.history_view(input, &m)
                };
                drop(m);
                output
            };
            let bytes = match result {
                Ok(v) => v,
                Err(e) => return Ok(Err(e)),
            };
            s.ctx.phase = "deliver";
            s.accepted_member_barrier(n, a)?;
            Ok(Ok(bytes))
        })??;
        drop(state);
        self.shared_sync()?;
        self.read_shared()?;
        self.ctx.phase = "deliver";
        self.delivery_event()?;
        auth::collection(guard, self.ledger(), auth::permission(&input.op))?;
        disclosure(guard, self.ledger(), change, input.op == "select_change")?;
        if needs_mutation {
            auth::member(
                guard,
                self.ledger(),
                change,
                if input.op == "revise_intent" {
                    Permission::AdoptIntent
                } else {
                    Permission::RunCheck
                },
            )?;
        }
        Ok(result)
    }
    fn history_mutation(
        &mut self,
        input: &Request,
        guard: &mut dyn Guard,
        n: &Node<P>,
        a: &Association<P>,
        mut m: MemberState,
        needs_mutation: &mut bool,
    ) -> Result<Result<Owned<Vec<u8>>, OpeningError>, Failure> {
        let key = input.key.as_ref().unwrap();
        let change = &self.grant.grants[n.scope as usize - 1].change;
        let state = m.history.as_ref().unwrap();
        if let Some(index) = state.keys.iter().position(|prior| {
            work::test(B::KeyLookup, key.len().max(prior.len()), 1, || key == prior)
        }) {
            let span = state.spans[index];
            let (record, _) = codec::retained_origin(&m.trace[span.start..span.end])
                .map_err(|_| Failure::damage())?;
            if !work::test(
                B::TypedInput,
                input.payload().max(record.input.payload()),
                32,
                || record.input == *input,
            ) {
                return Ok(Err(OpeningError::Conflict));
            }
            work::attempt(B::Outputs, 0, 1);
            let bytes = codec::emit_reply(&record.result, C).map_err(|_| Failure::damage())?;
            return Ok(Ok(bytes));
        }
        if let Some(p) = &m.prefix.pending {
            if !work::test(
                B::KeyLookup,
                key.len().max(p.input.key.as_ref().map_or(0, String::len)),
                1,
                || p.input.key.as_ref() == Some(key),
            ) {
                return Ok(Err(OpeningError::Unavailable));
            }
            if !work::test(
                B::TypedInput,
                input.payload().max(p.input.payload()),
                32,
                || p.input == *input,
            ) {
                return Ok(Err(OpeningError::Conflict));
            }
        }
        if let Err(e) = mutation_gate(guard, self.ledger(), change, &input.op) {
            return Ok(Err(e));
        }
        *needs_mutation = true;
        let current = Owned::new(sequential::reference(change, state.current));
        if !work::test(
            B::TypedInput,
            input
                .history()
                .expected_intent
                .as_ref()
                .map_or(0, String::len)
                .max(current.len()),
            1,
            || input.history().expected_intent.as_deref() == Some(current.as_str()),
        ) {
            return Ok(Err(OpeningError::Conflict));
        }
        if input.op == "run_check"
            && !work::test(
                B::Fields,
                input
                    .history()
                    .check
                    .as_ref()
                    .map_or(0, String::len)
                    .max(self.grant.adoption.as_ref().unwrap().check.len()),
                1,
                || {
                    input.history().check.as_deref()
                        == Some(self.grant.adoption.as_ref().unwrap().check.as_str())
                },
            )
        {
            return Ok(Err(OpeningError::Unsupported));
        }
        if m.prefix.pending.is_none()
            && !work::test(B::Fields, 0, 1, || m.trace.len() as u64 == m.prefix.end)
        {
            return Ok(Err(OpeningError::Unavailable));
        }
        if !work::test(B::Fields, 0, 1, || m.prefix.generation < 128) {
            return Ok(Err(OpeningError::Unsupported));
        }
        let record = self.history_record(
            n,
            input,
            m.prefix.generation + 1,
            state.current,
            state.what_bytes,
        )?;
        let candidate = codec::emit_origin(&record).map_err(|_| Failure::damage())?;
        if !work::test(B::Fields, 0, 1, || {
            m.prefix.end as usize + candidate.len() <= sequential::A
        }) {
            return Ok(Err(OpeningError::Unsupported));
        }
        if let Some(prospective) = &state.prospective {
            if !work::test(
                B::TypedInput,
                input.payload().max(prospective.payload()),
                32,
                || **prospective == *input,
            ) {
                return Ok(Err(OpeningError::Unavailable));
            }
        }
        drop(record);
        drop(candidate);
        drop(current);
        if input.op == "run_check" {
            work::update(|w| w.check_attempts += 1);
        }
        if m.temporary {
            if let Err(e) = mutation_gate(guard, self.ledger(), change, &input.op) {
                return Ok(Err(e));
            }
            drop(m);
            self.ctx.phase = "recover";
            n.cleanup(&mut self.ctx, "checkpoint.tmp", false)?;
            m = self.accepted_member(n, a)?;
            if !work::test(B::Fields, 0, 1, || !m.temporary) {
                return Err(Failure::damage());
            }
        }
        if m.prefix.pending.is_none() {
            if let Err(e) = mutation_gate(
                guard,
                self.ledger(),
                &self.grant.grants[n.scope as usize - 1].change,
                &input.op,
            ) {
                return Ok(Err(e));
            }
            let pending = Owned::constructed(|| Prefix {
                pending: Some(Pending {
                    input: input.clone(),
                    actor: self.grant.owner.clone(),
                }),
                format: m.prefix.format.clone(),
                custody: m.prefix.custody.clone(),
                change: m.prefix.change.clone(),
                generation: m.prefix.generation,
                end: m.prefix.end,
                sha256: m.prefix.sha256.clone(),
            });
            self.ctx.phase = "reserve";
            n.replace(
                &mut self.ctx,
                "checkpoint.json",
                "checkpoint.tmp",
                &*pending,
                false,
            )?;
            drop(pending);
            drop(m);
            m = self.accepted_member(n, a)?;
        }
        let state = m.history.as_ref().unwrap();
        let record = self.history_record(
            n,
            input,
            m.prefix.generation + 1,
            state.current,
            state.what_bytes,
        )?;
        let bytes = codec::emit_origin(&record).map_err(|_| Failure::damage())?;
        self.ctx.phase = "append";
        let missing = m.trace.len() - m.prefix.end as usize;
        if missing < bytes.len() {
            n.append(&mut self.ctx, &bytes[missing..])?;
        }
        n.sync_name(&mut self.ctx, "trace.jsonl")?;
        n.sync(&mut self.ctx, &n.dir, "directory")?;
        drop(record);
        drop(bytes);
        drop(m);
        m = self.accepted_member(n, a)?;
        let state = m.history.as_ref().unwrap();
        let record = self.history_record(
            n,
            input,
            m.prefix.generation + 1,
            state.current,
            state.what_bytes,
        )?;
        let bytes = codec::emit_origin(&record).map_err(|_| Failure::damage())?;
        if !work::test(
            B::Relationships,
            m.trace.len() - m.prefix.end as usize,
            1,
            || m.trace[m.prefix.end as usize..] == **bytes,
        ) {
            return Err(Failure::damage());
        }
        if let Err(e) = mutation_gate(
            guard,
            self.ledger(),
            &self.grant.grants[n.scope as usize - 1].change,
            &input.op,
        ) {
            return Ok(Err(e));
        }
        let accepted = Owned::constructed(|| Prefix {
            format: m.prefix.format.clone(),
            custody: m.prefix.custody.clone(),
            change: m.prefix.change.clone(),
            generation: m.prefix.generation + 1,
            end: m.trace.len() as u64,
            sha256: Some(sequential::successor_hash(
                &m.trace[..m.prefix.end as usize],
                &bytes,
            )),
            pending: None,
        });
        self.ctx.phase = "checkpoint";
        n.replace(
            &mut self.ctx,
            "checkpoint.json",
            "checkpoint.tmp",
            &*accepted,
            false,
        )?;
        if input.op == "run_check" {
            work::update(|w| w.check_acceptances += 1);
        }
        work::attempt(B::Outputs, 0, 1);
        let result = codec::emit_reply(&record.result, C).map_err(|_| Failure::damage())?;
        drop(record);
        drop(bytes);
        drop(accepted);
        drop(m);
        self.accepted_member(n, a)?;
        Ok(Ok(result))
    }
    fn history_list(
        &mut self,
        input: &Request,
        guard: &mut dyn Guard,
        state: State<P>,
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
            match disclosure(guard, self.ledger(), &a.change, true) {
                Err(OpeningError::Denied) => continue,
                Err(e) => return Err(e),
                Ok(()) => allowed[i] = true,
            };
            let value = self.member_run(a.slot, false, |s, n| {
                let m = s.accepted_member(n, a)?;
                projection::metadata(&m)
            })?;
            metadata.push(value);
            metadata.refresh();
        }
        metadata.sort_unstable_by(|a, b| {
            work::attempt(B::Ordering, a.change.len().max(b.change.len()), 1);
            let cmp = a.change.cmp(&b.change);
            work::complete(B::Ordering, cmp == std::cmp::Ordering::Equal);
            cmp
        });
        let after = input
            .cursor
            .as_ref()
            .and_then(Option::as_ref)
            .map(|c| c.after.as_str());
        let start = metadata
            .iter()
            .position(|m| {
                after.is_none_or(|a| {
                    work::test(B::Ordering, m.change.len().max(a.len()), 1, || {
                        m.change.as_str() > a
                    })
                })
            })
            .unwrap_or(metadata.len());
        let end = (start + input.limit.unwrap() as usize).min(metadata.len());
        let next = if end < metadata.len() {
            Some(metadata[end - 1].change.as_str())
        } else {
            None
        };
        let bytes = self.history_page(input, &metadata[start..end], next)?;
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
        let generation = state.control.generation;
        drop(state);
        self.shared_sync()?;
        let state = self.read_shared()?;
        if !work::test(B::Fields, 0, 1, || state.control.generation == generation) {
            return Err(OpeningError::Unavailable);
        }
        self.delivery_event()?;
        auth::collection(
            guard,
            self.ledger(),
            policy::LedgerCollectionPermission::List,
        )?;
        for (i, a) in state.control.entries.0.iter().enumerate() {
            match (
                allowed[i],
                disclosure(guard, self.ledger(), &a.change, true),
            ) {
                (true, Ok(())) | (false, Err(OpeningError::Denied)) => (),
                (false, Ok(())) => return Err(OpeningError::Unavailable),
                (_, Err(e)) => return Err(e),
            }
        }
        if let Some(Some(cursor)) = &input.cursor {
            disclosure(guard, self.ledger(), &cursor.after, true)?;
        }
        Ok(bytes)
    }
}
