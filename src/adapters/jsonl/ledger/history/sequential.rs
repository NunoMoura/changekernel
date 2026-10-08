//! One bounded sequential validator and deterministic producer, on shared custody.
use super::super::{members::MemberState, *};
use super::codec::{Evidence, HistoryResult};
pub(in crate::adapters::jsonl::ledger) const A: usize = 16_777_216;
pub(in crate::adapters::jsonl::ledger) const Q: usize = 2_097_152;
#[derive(Clone, Copy, Debug)]
pub(in crate::adapters::jsonl::ledger) struct Span {
    pub start: usize,
    pub end: usize,
    pub intent: u64,
    pub assessment: bool,
}
impl Heap for Span {
    fn heap(&self) -> usize {
        0
    }
}
pub(in crate::adapters::jsonl::ledger) struct HistoryState {
    pub spans: Owned<Vec<Span>>,
    pub keys: Owned<Vec<String>>,
    pub current: u64,
    pub what_bytes: usize,
    pub prospective: Option<Owned<Request>>,
}
pub(in crate::adapters::jsonl::ledger) fn reference(change: &str, seq: u64) -> String {
    if seq == 1 {
        format!("{change}:origin")
    } else {
        format!("{change}:op:{seq}")
    }
}
fn subjects<P: Layout>(c: &Custody<P>, n: &Node<P>, input: &Request) -> bool {
    let pair = &c.grant.grants[n.scope as usize - 1];
    work::test(
        B::Fields,
        input.ledger.len().max(c.grant.ledger.len())
            + input.workspace_id.len().max(c.grant.workspace_id.len())
            + input
                .change
                .as_ref()
                .map_or(0, String::len)
                .max(pair.change.len()),
        4,
        || {
            input.v == work::version()
                && input.ledger == c.grant.ledger
                && input.workspace_id == c.grant.workspace_id
                && (input.op == "create_change" && input.change.is_none()
                    || input.change.as_deref() == Some(pair.change.as_str()))
        },
    )
}
impl<P: Layout> Custody<P> {
    pub(in crate::adapters::jsonl::ledger) fn history_record(
        &self,
        n: &Node<P>,
        input: &Request,
        seq: u64,
        current: u64,
        what_bytes: usize,
    ) -> Result<Owned<Origin>, Failure> {
        work::attempt(B::Constructions, input.payload(), 32);
        let pair = &self.grant.grants[n.scope as usize - 1];
        work::attempt(B::Fields, input.op.len().max(13), 3);
        let kind = match input.op.as_str() {
            "create_change" if seq == 1 => "created",
            "revise_intent" if seq > 1 => "intent_revised",
            "run_check" if seq > 1 => "intent_assessed",
            _ => {
                work::complete(B::Fields, false);
                return Err(Failure::damage());
            }
        };
        work::complete(B::Fields, true);
        let id = Owned::new(reference(&pair.change, seq));
        let previous_intent = Owned::new(reference(&pair.change, current));
        let base = Created {
            v: work::version(),
            kind: kind.into(),
            ledger: self.grant.ledger.clone(),
            workspace_id: self.grant.workspace_id.clone(),
            change: pair.change.clone(),
            key: input.key.clone().ok_or_else(Failure::damage)?,
            actor: self.grant.owner.clone(),
            result: (*id).clone(),
            seq,
        };
        let mut result = HistoryResult::created(base);
        if input.op == "revise_intent" {
            result.intent = Some((*id).clone());
            result.previous_intent = Some((*previous_intent).clone());
        }
        if input.op == "run_check" {
            let adoption = self.grant.adoption.as_ref().ok_or_else(Failure::damage)?;
            work::attempt(B::EvaluatorCalculations, 0, 2);
            let passed = what_bytes <= 80;
            work::complete(B::EvaluatorCalculations, true);
            result.adoption = None;
            result.intent = Some((*previous_intent).clone());
            result.policy = Some(adoption.policy.clone());
            result.check = Some(adoption.check.clone());
            result.evaluator = Some(adoption.evaluator.clone());
            result.passed = Some(passed);
            result.feedback = Some(
                if passed {
                    "fits"
                } else {
                    "shorten_or_use_other_channel"
                }
                .into(),
            );
            result.evidence = Some(Evidence {
                intent: (*previous_intent).clone(),
                field: "what".into(),
                utf8_bytes: what_bytes as u64,
                limit: 80,
            });
        }
        // Canonical expected selectors are built from the pinned installation and
        // running intent state. One whole-record semantic comparison verifies
        // these fields; no duplicate accepted-input comparisons are needed.
        let scratch = work::Allocation::new(false);
        scratch.resize(result.heap());
        let mut normalized = input.clone();
        if let Request::History(r) = &mut normalized {
            r.base.v = work::version();
            r.base.ledger = self.grant.ledger.clone();
            r.base.workspace_id = self.grant.workspace_id.clone();
            r.base.change = if seq == 1 {
                None
            } else {
                Some(pair.change.clone())
            };
            r.expected_intent = if seq == 1 {
                None
            } else {
                Some((*previous_intent).clone())
            };
            r.check = if input.op == "run_check" {
                Some(self.grant.adoption.as_ref().unwrap().check.clone())
            } else {
                None
            };
        }
        scratch.resize(result.heap() + normalized.heap());
        let value = Origin {
            v: work::version(),
            custody: pair.custody.clone(),
            ledger: self.grant.ledger.clone(),
            workspace_id: self.grant.workspace_id.clone(),
            binding: self.grant.binding.clone(),
            change: pair.change.clone(),
            seq,
            prev: if seq == 1 {
                None
            } else {
                Some(reference(&pair.change, seq - 1))
            },
            kind: kind.into(),
            input: normalized,
            result: SelectedResult::History(Box::new(result)),
        };
        scratch.resize(value.heap());
        let value = scratch.adopt(value);
        work::complete(B::Constructions, true);
        Ok(value)
    }
    fn feasible_pending(
        &self,
        n: &Node<P>,
        prefix: &Prefix,
        trace: &[u8],
        state: &HistoryState,
        pending: &Pending,
    ) -> Result<Owned<Vec<u8>>, Failure> {
        let input = &pending.input;
        let h = input.history();
        let pair = &self.grant.grants[n.scope as usize - 1];
        if !work::test(B::KeyFeasibility, 0, 1, || prefix.generation < 128)
            || !work::test(
                B::KeyFeasibility,
                pending.actor.len().max(self.grant.owner.len()),
                1,
                || pending.actor == self.grant.owner,
            )
            || !work::test(
                B::KeyFeasibility,
                input
                    .op
                    .len()
                    .max("revise_intent".len())
                    .max("run_check".len()),
                1,
                || matches!(input.op.as_str(), "revise_intent" | "run_check"),
            )
            || !subjects(self, n, input)
        {
            return Err(Failure::damage());
        }
        let key = input.key.as_ref().ok_or_else(Failure::damage)?;
        for prior in state.keys.iter() {
            if work::test(B::KeyFeasibility, key.len().max(prior.len()), 1, || {
                key == prior
            }) {
                return Err(Failure::damage());
            }
        }
        let current = Owned::new(reference(&pair.change, state.current));
        if !work::test(
            B::KeyFeasibility,
            h.expected_intent
                .as_ref()
                .map_or(0, String::len)
                .max(current.len()),
            1,
            || h.expected_intent.as_deref() == Some(current.as_str()),
        ) {
            return Err(Failure::damage());
        }
        if input.op == "run_check" {
            let check = &self.grant.adoption.as_ref().unwrap().check;
            if !work::test(
                B::KeyFeasibility,
                h.check.as_ref().map_or(0, String::len).max(check.len()),
                1,
                || h.check.as_deref() == Some(check.as_str()),
            ) {
                return Err(Failure::damage());
            }
        }
        let record = self.history_record(
            n,
            input,
            prefix.generation + 1,
            state.current,
            state.what_bytes,
        )?;
        let bytes = codec::emit_origin(&record).map_err(|_| Failure::damage())?;
        drop(record);
        if !work::test(B::Fields, 0, 2, || {
            prefix.end as usize + bytes.len() <= A && trace.len() >= prefix.end as usize
        }) {
            return Err(Failure::damage());
        }
        let suffix = &trace[prefix.end as usize..];
        if !work::test(B::Fields, 0, 1, || suffix.len() <= bytes.len())
            || !work::test(B::Relationships, suffix.len(), 1, || {
                suffix == &bytes[..suffix.len()]
            })
        {
            return Err(Failure::damage());
        }
        Ok(bytes)
    }
    pub(in crate::adapters::jsonl::ledger) fn history_member(
        &mut self,
        n: &Node<P>,
        prefix: Owned<Prefix>,
        trace: Owned<Vec<u8>>,
        temporary: bool,
        association: &Association<P>,
        physical: &Physical<P>,
    ) -> Result<MemberState, Failure> {
        let pair = &self.grant.grants[n.scope as usize - 1];
        if !work::test(B::Fields, 0, 5, || {
            (1..=128).contains(&prefix.generation)
                && prefix.end > 0
                && prefix.end <= A as u64
                && prefix.end <= trace.len() as u64
                && prefix.end >= association.origin_end
        }) {
            return Err(Failure::damage());
        }
        let accepted = &trace[..prefix.end as usize];
        let digest = Owned::new(hash(accepted, true));
        if !work::test(
            B::Relationships,
            digest
                .len()
                .max(prefix.sha256.as_ref().map_or(0, String::len)),
            1,
            || prefix.sha256.as_deref() == Some(digest.as_str()),
        ) {
            return Err(Failure::damage());
        }
        drop(digest);
        let mut state = HistoryState {
            spans: Owned::new(Vec::with_capacity(128)),
            keys: Owned::new(Vec::with_capacity(128)),
            current: 1,
            what_bytes: 0,
            prospective: None,
        };
        let mut start = 0;
        for seq in 1..=prefix.generation {
            let rest = &accepted[start..];
            let length = rest
                .iter()
                .position(|b| *b == b'\n')
                .ok_or_else(Failure::damage)?
                + 1;
            if !work::test(B::Fields, 0, 1, || length <= C) {
                return Err(Failure::damage());
            }
            let end = start + length;
            let (record, canonical_input) =
                codec::retained_origin(&accepted[start..end]).map_err(|_| Failure::damage())?;
            let key = record.input.key.as_ref().ok_or_else(Failure::damage)?;
            for prior in state.keys.iter() {
                if work::test(B::KeyUniqueness, key.len().max(prior.len()), 1, || {
                    key == prior
                }) {
                    return Err(Failure::damage());
                }
            }
            let expected =
                self.history_record(n, &record.input, seq, state.current, state.what_bytes)?;
            if !work::test(
                B::Semantic,
                record.logical().max(expected.logical()),
                64,
                || *record == *expected,
            ) {
                return Err(Failure::damage());
            }
            drop(expected);
            if seq == 1 {
                let input_hash = Owned::new(canonical_input.digest());
                let origin_hash = Owned::new(hash(&accepted[..end], false));
                if !work::test(
                    B::Relationships,
                    association.logical().max(
                        record.logical()
                            + input_hash.len()
                            + origin_hash.len()
                            + physical.logical(),
                    ),
                    32,
                    || {
                        association.slot == u64::from(n.scope)
                            && association.key == record.result.key
                            && association.change == pair.change
                            && association.custody == pair.custody
                            && association.actor == self.grant.owner
                            && association.input_sha256 == *input_hash
                            && association.origin_end == end as u64
                            && association.origin_sha256 == *origin_hash
                            && association.physical == *physical
                    },
                ) {
                    return Err(Failure::damage());
                }
            }
            if record.kind != "intent_assessed" {
                state.current = seq;
                state.what_bytes = record
                    .input
                    .what
                    .as_ref()
                    .ok_or_else(Failure::damage)?
                    .len();
            }
            state.keys.push(key.clone());
            state.keys.refresh();
            state.spans.push(Span {
                start,
                end,
                intent: state.current,
                assessment: record.kind == "intent_assessed",
            });
            state.spans.refresh();
            work::update(|w| {
                w.span_entries_peak = w.span_entries_peak.max(state.spans.len() as u64);
                w.key_entries_peak = w.key_entries_peak.max(state.keys.len() as u64);
            });
            drop(record);
            start = end;
        }
        if !work::test(B::Fields, 0, 1, || start == accepted.len()) {
            return Err(Failure::damage());
        }
        let pending = if let Some(p) = &prefix.pending {
            Some(self.feasible_pending(n, &prefix, &trace, &state, p)?)
        } else {
            None
        };
        if temporary {
            let t: Owned<Prefix> = n.control(&mut self.ctx, "checkpoint.tmp")?;
            let same = work::test(
                B::Relationships,
                t.logical().max(prefix.logical()),
                32,
                || *t == *prefix,
            );
            if !same {
                if let Some(p) = &prefix.pending {
                    let bytes = pending.as_ref().unwrap();
                    let expected_hash = Owned::new(successor_hash(accepted, bytes));
                    if !work::test(
                        B::Relationships,
                        t.logical().max(prefix.logical()) + expected_hash.len(),
                        32,
                        || {
                            trace.len() == prefix.end as usize + bytes.len()
                                && t.format == prefix.format
                                && t.custody == prefix.custody
                                && t.change == prefix.change
                                && t.generation == prefix.generation + 1
                                && t.end == trace.len() as u64
                                && t.sha256.as_deref() == Some(expected_hash.as_str())
                                && t.pending.is_none()
                        },
                    ) {
                        return Err(Failure::damage());
                    }
                    let _ = p;
                } else {
                    let prospective = t.pending.as_ref().ok_or_else(Failure::damage)?;
                    if !work::test(
                        B::Relationships,
                        t.logical().max(prefix.logical()),
                        32,
                        || {
                            trace.len() == prefix.end as usize
                                && t.format == prefix.format
                                && t.custody == prefix.custody
                                && t.change == prefix.change
                                && t.generation == prefix.generation
                                && t.end == prefix.end
                                && t.sha256 == prefix.sha256
                        },
                    ) {
                        return Err(Failure::damage());
                    }
                    self.feasible_pending(n, &prefix, &trace, &state, prospective)?;
                    state.prospective = Some(Owned::constructed(|| prospective.input.clone()));
                }
            }
        }
        drop(pending);
        let (origin, _) = codec::retained_origin(&accepted[..association.origin_end as usize])
            .map_err(|_| Failure::damage())?;
        n.binding(&self.members)?;
        Ok(MemberState {
            prefix,
            trace,
            record: Some(origin),
            temporary,
            anchor_temporary: false,
            history: Some(state),
        })
    }
}
pub(in crate::adapters::jsonl::ledger) fn successor_hash(prefix: &[u8], next: &[u8]) -> String {
    let _state = work::Fixed::new(std::mem::size_of::<Sha256>());
    work::update(|w| {
        w.candidate_hash_bytes += (prefix.len() + next.len()) as u64;
        w.hash_state_bytes_peak = w
            .hash_state_bytes_peak
            .max(std::mem::size_of::<Sha256>() as u64);
    });
    let mut h = Sha256::new();
    h.update(prefix);
    h.update(next);
    format!("{:x}", h.finalize())
}
