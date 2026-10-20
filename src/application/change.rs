//! Serialized change orchestration over consumed persistence and exact-encoding capabilities.
use super::ports::*;
use crate::kernel::change::intent::*;
mod preflight;
pub(crate) mod review;
use preflight::preflight;
struct Preparation {
    since: std::time::Instant,
    input: Request,
    presentation: String,
    pending: Option<Pending>,
}
/// One serialized connection; protocol validation stays in the consuming adapter.
pub(crate) struct Change<F: Connect, C: Encoding> {
    factory: F,
    codec: C,
    owner: Option<F::Store>,
    prepared: Option<Preparation>,
    closed: bool,
}
impl<F: Connect, C: Encoding> Change<F, C> {
    pub fn new(factory: F, codec: C) -> Self {
        Self {
            factory,
            codec,
            owner: None,
            prepared: None,
            closed: false,
        }
    }
    pub fn expire_preparation(&mut self) {
        if self
            .prepared
            .as_ref()
            .is_some_and(|p| p.since.elapsed() >= std::time::Duration::from_secs(120))
        {
            self.prepared = None;
        }
    }
    pub fn is_closed(&self) -> bool {
        self.closed
    }
    pub fn close(&mut self) {
        self.prepared = None;
        self.owner = None;
        self.closed = true;
    }
    pub fn dispatch(&mut self, id: u64, command: Command) -> Result<Vec<u8>> {
        match command {
            Command::Connect {
                mode,
                grant,
                authorization,
            } => {
                if id != 1 || self.owner.is_some() {
                    return Err(Error::Unavailable);
                }
                authorization.check(mode != "reopen")?;
                self.owner = Some(self.factory.connect(grant, &mode)?);
                authorization.check(false)?;
                self.codec.response(id, &Response::Connected)
            }
            Command::Close => {
                self.close();
                self.codec.response(id, &Response::Closed)
            }
            Command::Discard => {
                self.prepared = None;
                self.codec.response(id, &Response::Discarded)
            }
            Command::Call {
                prepare,
                authorization,
                request,
            } => {
                // Retention always needs both rights; authority refusal is not a storage incident.
                authorization.check(request.op == "retain_text")?;
                let store = self.owner.as_mut().ok_or(Error::Unavailable)?;
                if request.op == "retain_text" {
                    store.phase("material");
                }
                let s = match store.snapshot() {
                    Ok(s) => s,
                    Err(_) => {
                        if request.op == "retain_text" {
                            store.finish_failure()
                        } else {
                            store.quarantine()
                        }
                        return Err(Error::Unavailable);
                    }
                };
                let r = &request;
                let out = (|| {
                    if r.mutation() {
                        if let Some(old) = s.accepted(r.key()) {
                            exact_input(&old.input, r)?;
                            self.codec.response(id, &Response::Accepted(old.outcome()))
                        } else if !prepare {
                            Err(Error::Unavailable)
                        } else {
                            authorization.check(true)?;
                            if self.prepared.is_some() {
                                return Err(Error::Unavailable);
                            }
                            let pending = matching_pending(&s, r)?;
                            let presentation = if let Some(p) = &pending {
                                store.original_presentation(p)?
                            } else {
                                self.codec.review(&review::review(
                                    store,
                                    &self.codec,
                                    r,
                                    s.records().last(),
                                )?)?
                            };
                            preflight(&self.codec, store, &s, r, &presentation, pending.as_ref())?;
                            let bytes = self.codec.response(
                                id,
                                &Response::Prepared {
                                    input: r.clone(),
                                    presentation: presentation.clone(),
                                },
                            )?;
                            self.prepared = Some(Preparation {
                                since: std::time::Instant::now(),
                                input: r.clone(),
                                presentation,
                                pending,
                            });
                            Ok(bytes)
                        }
                    } else if prepare {
                        Err(Error::Invalid)
                    } else {
                        read_or_retain(&self.codec, store, &s, id, r, &authorization)
                    }
                })();
                if r.mutation() && store.io_failed() {
                    store.quarantine();
                }
                if out == Err(Error::Unavailable) && !r.mutation() {
                    if r.op == "retain_text" {
                        store.finish_failure()
                    } else {
                        store.quarantine()
                    }
                }
                authorization.check(false)?;
                out
            }
            Command::Confirm {
                authorization,
                input,
            } => {
                authorization.check(true)?;
                let p = self.prepared.take().ok_or(Error::Unavailable)?;
                exact_input(&p.input, &input)?;
                let store = self.owner.as_mut().ok_or(Error::Unavailable)?;
                store.phase("reserve");
                let out = (|| {
                    let s = store.snapshot()?;
                    if let Some(r) = s.accepted(input.key()) {
                        exact_input(&r.input, &input)?;
                        return self.codec.response(id, &Response::Accepted(r.outcome()));
                    }
                    let pending = matching_pending(&s, &input)?;
                    if pending != p.pending {
                        return Err(Error::Conflict);
                    }
                    let review = if let Some(pending) = &pending {
                        store.original_presentation(pending)?
                    } else {
                        self.codec.review(&review::review(
                            store,
                            &self.codec,
                            &input,
                            s.records().last(),
                        )?)?
                    };
                    if review != p.presentation {
                        return Err(Error::Conflict);
                    }
                    preflight(&self.codec, store, &s, &input, &review, pending.as_ref())?;
                    let pending = match pending {
                        Some(p) => p,
                        None => {
                            let presentation = store.retain(&review)?;
                            let receipt = Receipt {
                                format: "ck-local-approval".into(),
                                principal: "person-1".into(),
                                subject_sha256: self.codec.subject(&input)?,
                                presentation,
                                decision: "adopt".into(),
                                ui: "local-tui-exact".into(),
                            };
                            let receipt = self.codec.receipt(&receipt)?;
                            let approval = store.retain(&receipt)?;
                            Pending {
                                input: input.clone(),
                                approval,
                            }
                        }
                    };
                    let r = store.reserve_commit(&s, pending, &authorization)?;
                    self.codec.response(id, &Response::Accepted(r.outcome()))
                })();
                if out == Err(Error::Unavailable) {
                    store.finish_failure()
                }
                authorization.check(false)?;
                out
            }
        }
    }
}
fn matching_pending(s: &impl ReadState, r: &Request) -> Result<Option<Pending>> {
    if s.readiness().iter().any(|s| {
        matches!(
            s.as_str(),
            "blocked_material_temp" | "blocked_unaccepted_tail"
        )
    }) {
        return Err(Error::Unavailable);
    }
    if let Some(p) = s.pending() {
        if p.input.key() != r.key() {
            return Err(Error::Unavailable);
        }
        exact_input(&p.input, r)?;
        return Ok(Some(p.clone()));
    }
    if let Some(t) = s.temporary_pending() {
        if let Some(p) = t.as_ref() {
            if p.input.key() != r.key() {
                return Err(Error::Unavailable);
            }
            exact_input(&p.input, r)?;
            return Ok(Some(p.clone()));
        }
        return Err(Error::Unavailable);
    }
    admit_new(r, s.generation(), s.tip())?;
    Ok(None)
}
fn read_or_retain<P: Persistence, C: Encoding>(
    codec: &C,
    store: &mut P,
    s: &P::State,
    id: u64,
    r: &Request,
    lease: &Lease,
) -> Result<Vec<u8>> {
    match r.op.as_str() {
        "retain_text" => {
            lease.check(true)?;
            let material = store.retain_agent(r.text.as_deref().ok_or(Error::Invalid)?, s)?;
            codec.response(id, &Response::Retained(material))
        }
        "resolve_text" => {
            let material = r.material.as_ref().ok_or(Error::Invalid)?.clone();
            let text = store.resolve(&material)?;
            codec
                .response(id, &Response::Resolved { material, text })
                .map_err(|_| Error::Unavailable)
        }
        "inspect_operation" => {
            let result = s.accepted(r.key()).map(Record::outcome);
            let status = if result.is_some() {
                "accepted"
            } else if s.pending().is_some_and(|p| p.input.key() == r.key()) {
                "pending"
            } else {
                "not_found_now"
            };
            codec.response(
                id,
                &Response::Operation {
                    key: r.key().into(),
                    status: status.into(),
                    result,
                    tip: s.tip(),
                    readiness: s.readiness().to_vec(),
                },
            )
        }
        "read_context" => {
            let at = r.at.clone().or_else(|| s.tip());
            if at.as_ref().is_some_and(|f| f.seq > s.generation()) {
                return Err(Error::Invalid);
            }
            let record = at.as_ref().map(|f| &s.records()[f.seq as usize - 1]);
            codec.response(
                id,
                &Response::Context(Context {
                    tip: s.tip(),
                    at: at.clone(),
                    intent: record.and_then(|r| r.input.replacement.clone()),
                    approval: record.map(|r| r.approval.clone()),
                    policy: store.policy(),
                    coverage: ContextCoverage {
                        first: if at.is_some() { 1 } else { 0 },
                        last: at.as_ref().map_or(0, |f| f.seq),
                        through: at,
                    },
                    readiness: s.readiness().to_vec(),
                }),
            )
        }
        "read_history" => {
            let through = r.through.clone().or_else(|| s.tip());
            let last = through.as_ref().map_or(0, |f| f.seq);
            let after = r.after.ok_or(Error::Invalid)?;
            if last > s.generation() || after > last {
                return Err(Error::Invalid);
            }
            let mut page = History {
                tip: s.tip(),
                through,
                records: vec![],
                coverage: HistoryCoverage { first: 0, last: 0 },
                next_after: None,
                readiness: s.readiness().to_vec(),
            };
            let count = (last - after).min(r.limit.ok_or(Error::Invalid)?);
            for n in after + 1..=after + count {
                let old = page.clone();
                page.records.push(s.records()[n as usize - 1].clone());
                page.coverage = HistoryCoverage {
                    first: after + 1,
                    last: n,
                };
                page.next_after = (n < last).then_some(n);
                if codec
                    .response(id, &Response::History(page.clone()))
                    .is_err()
                {
                    page = old;
                    break;
                }
            }
            if after < last && page.records.is_empty() {
                return Err(Error::Unavailable);
            }
            codec.response(id, &Response::History(page.clone()))
        }
        _ => Err(Error::Invalid),
    }
}

#[cfg(test)]
mod tests;
