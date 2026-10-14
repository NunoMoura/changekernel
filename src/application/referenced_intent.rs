//! One serialized trusted-host connection, shared by library and stdio.
use crate::{
    adapters::jsonl::referenced_intent::{Snapshot, Store},
    kernel::changes::referenced_intent::*,
};
use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
mod preflight;
use preflight::preflight;
closed!(Connect {
    bridge: String,
    id: u64,
    kind: String,
    mode: String,
    grant: Grant,
    authorization: Lease
});
closed!(Call {
    bridge: String,
    id: u64,
    kind: String,
    authorization: Lease,
    request: Request
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Confirmed;
impl Serialize for Confirmed {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        s.serialize_bool(true)
    }
}
impl<'de> Deserialize<'de> for Confirmed {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        struct True;
        impl<'de> Visitor<'de> for True {
            type Value = Confirmed;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("literal true")
            }
            fn visit_bool<E: de::Error>(self, b: bool) -> std::result::Result<Confirmed, E> {
                if b {
                    Ok(Confirmed)
                } else {
                    Err(E::custom("literal true required"))
                }
            }
        }
        d.deserialize_bool(True)
    }
}
closed!(Confirm {
    bridge: String,
    id: u64,
    kind: String,
    authorization: Lease,
    input: Request,
    confirmed: Confirmed
});
closed!(Control {
    bridge: String,
    id: u64,
    kind: String
});
closed!(Connected {
    bridge: String,
    id: u64,
    kind: String,
    version: String
});
closed!(Closed {
    bridge: String,
    id: u64,
    kind: String
});
closed!(Prepared {
    bridge: String,
    id: u64,
    kind: String,
    input: Request,
    presentation: String
});
closed!(Accepted {
    version: String,
    kind: String,
    result: Outcome
});
closed!(Operation { version:String,kind:String,key:String,status:String,result:Option<Outcome>,tip:Option<Fact>,readiness:Vec<String> });
closed!(ErrorReply {
    version: String,
    kind: String,
    code: String,
    acceptance: String
});
closed!(Retained {
    version: String,
    kind: String,
    material: Material
});
closed!(Resolved {
    version: String,
    kind: String,
    material: Material,
    text: String
});
closed!(ContextCoverage { first:u64,last:u64,through:Option<Fact> });
closed!(HistoryCoverage {
    first: u64,
    last: u64
});
closed!(ContextReply { version:String,kind:String,tip:Option<Fact>,at:Option<Fact>,intent:Option<Intent>,approval:Option<Material>,policy:Material,coverage:ContextCoverage,readiness:Vec<String> });
closed!(HistoryReply { version:String,kind:String,tip:Option<Fact>,through:Option<Fact>,records:Vec<Record>,coverage:HistoryCoverage,next_after:Option<u64>,readiness:Vec<String> });
closed!(Discarded {
    version: String,
    kind: String
});
struct Reply<'a, T> {
    id: u64,
    value: &'a T,
}
impl<T: Serialize> Serialize for Reply<'_, T> {
    fn serialize<S: Serializer>(&self, s: S) -> std::result::Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("reply", 4)?;
        o.serialize_field("bridge", "ck-intent-bridge")?;
        o.serialize_field("id", &self.id)?;
        o.serialize_field("kind", "reply")?;
        o.serialize_field("value", self.value)?;
        o.end()
    }
}
fn reply<T: Serialize>(id: u64, value: &T) -> Result<Vec<u8>> {
    emit(&Reply { id, value })
}
fn accepted(id: u64, r: &Record) -> Result<Vec<u8>> {
    reply(
        id,
        &Accepted {
            version: V.into(),
            kind: "accepted".into(),
            result: r.outcome(),
        },
    )
}
fn failure(id: u64, e: Error) -> Vec<u8> {
    reply(
        id,
        &ErrorReply {
            version: V.into(),
            kind: "error".into(),
            code: e.code().into(),
            acceptance: "not_established".into(),
        },
    )
    .expect("fixed bounded error")
}

use crate::adapters::jsonl::referenced_intent::ReferencedIntentIoHook;
use crate::kernel::changes::referenced_intent::versions::VersionScan;
struct Header {
    id: u64,
    kind: String,
}
impl<'de> Deserialize<'de> for Header {
    fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
        struct H;
        impl<'de> Visitor<'de> for H {
            type Value = Header;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("bridge header")
            }
            fn visit_map<M: MapAccess<'de>>(
                self,
                mut m: M,
            ) -> std::result::Result<Header, M::Error> {
                let (mut id, mut kind, mut bridge) = (None, None, None);
                while let Some(k) = m.next_key::<String>()? {
                    match k.as_str() {
                        "id" => {
                            if id.is_some() {
                                return Err(de::Error::custom("duplicate id"));
                            }
                            id = Some(m.next_value::<u64>()?);
                        }
                        "kind" => {
                            if kind.is_some() {
                                return Err(de::Error::custom("duplicate kind"));
                            }
                            kind = Some(m.next_value::<String>()?);
                        }
                        "bridge" => {
                            if bridge.is_some() {
                                return Err(de::Error::custom("duplicate bridge"));
                            }
                            bridge = Some(m.next_value::<String>()?);
                        }
                        _ => {
                            m.next_value::<de::IgnoredAny>()?;
                        }
                    }
                }
                if bridge.as_deref() != Some("ck-intent-bridge") {
                    return Err(de::Error::custom("bridge"));
                }
                Ok(Header {
                    id: id.ok_or_else(|| de::Error::missing_field("id"))?,
                    kind: kind.ok_or_else(|| de::Error::missing_field("kind"))?,
                })
            }
        }
        d.deserialize_map(H)
    }
}
struct Preparation {
    since: std::time::Instant,
    input: Request,
    presentation: String,
    pending: Option<Pending>,
}
/// Trusted host envelopes only. This is not an agent-accessible raw-envelope tool.
/// The caller supplies serialized current leases and genuine UI confirmation.
pub struct ReferencedIntent {
    hook: Option<ReferencedIntentIoHook>,
    owner: Option<Store>,
    prepared: Option<Preparation>,
    next: u64,
    closed: bool,
}
impl Default for ReferencedIntent {
    fn default() -> Self {
        Self::new()
    }
}
impl ReferencedIntent {
    pub fn new() -> Self {
        Self {
            hook: None,
            owner: None,
            prepared: None,
            next: 1,
            closed: false,
        }
    }
    /// Source-test instrumentation only; the stdio bridge has no hook or auto-approval mode.
    pub fn with_io_hook(hook: ReferencedIntentIoHook) -> Self {
        Self {
            hook: Some(hook),
            ..Self::new()
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
    /// A protocol error closes custody and returns None. A missing reply establishes
    /// neither rollback nor non-acceptance.
    pub fn handle(&mut self, bytes: &[u8]) -> Option<Vec<u8>> {
        if self
            .prepared
            .as_ref()
            .is_some_and(|p| p.since.elapsed() >= std::time::Duration::from_secs(120))
        {
            self.prepared = None;
        }
        if self.closed || crate::VERSION != V || parse::<VersionScan>(bytes).is_err() {
            self.close();
            return None;
        }
        let h = match parse::<Header>(bytes) {
            Ok(h) if h.id == self.next && h.id <= 1_000_000 => h,
            _ => {
                self.close();
                return None;
            }
        };
        self.next += 1;
        let decoded = match h.kind.as_str() {
            "connect" => parse::<Connect>(bytes).map(Envelope::Connect),
            "call" | "prepare" => parse::<Call>(bytes).map(Envelope::Call),
            "confirm" => parse::<Confirm>(bytes).map(Envelope::Confirm),
            "discard" | "close" => parse::<Control>(bytes).map(Envelope::Control),
            _ => Err(Error::Invalid),
        };
        let e = match decoded {
            Ok(e) => e,
            Err(Error::Unsupported) => return Some(failure(h.id, Error::Unsupported)),
            Err(_) => {
                self.close();
                return None;
            }
        };
        let out = self.dispatch(h.id, e);
        Some(out.unwrap_or_else(|e| failure(h.id, e)))
    }
    fn dispatch(&mut self, id: u64, e: Envelope) -> Result<Vec<u8>> {
        match e {
            Envelope::Connect(c) => {
                if id != 1 || self.owner.is_some() {
                    return Err(Error::Unavailable);
                }
                c.authorization.check(c.mode != "reopen")?;
                self.owner = Some(Store::connect(c.grant, &c.mode, self.hook.take())?);
                c.authorization.check(false)?;
                emit(&Connected {
                    bridge: "ck-intent-bridge".into(),
                    id,
                    kind: "connected".into(),
                    version: V.into(),
                })
            }
            Envelope::Control(c) => {
                if c.kind == "close" {
                    self.close();
                    emit(&Closed {
                        bridge: "ck-intent-bridge".into(),
                        id,
                        kind: "closed".into(),
                    })
                } else {
                    self.prepared = None;
                    reply(
                        id,
                        &Discarded {
                            version: V.into(),
                            kind: "discarded".into(),
                        },
                    )
                }
            }
            Envelope::Call(c) => {
                // Retention always needs both rights; authority refusal is not a storage incident.
                c.authorization.check(c.request.op == "retain_text")?;
                let store = self.owner.as_mut().ok_or(Error::Unavailable)?;
                if c.request.op == "retain_text" {
                    store.phase("material");
                }
                let s = match store.snapshot() {
                    Ok(s) => s,
                    Err(_) => {
                        if c.request.op == "retain_text" {
                            store.finish_failure()
                        } else {
                            store.quarantine()
                        }
                        return Err(Error::Unavailable);
                    }
                };
                let r = &c.request;
                let out = (|| {
                    if r.mutation() {
                        if let Some(old) = s.accepted(r.key()) {
                            if old.input != *r {
                                Err(Error::Conflict)
                            } else {
                                accepted(id, old)
                            }
                        } else if c.kind == "call" {
                            Err(Error::Unavailable)
                        } else {
                            c.authorization.check(true)?;
                            if self.prepared.is_some() {
                                return Err(Error::Unavailable);
                            }
                            let pending = matching_pending(&s, r)?;
                            let presentation = if let Some(p) = &pending {
                                store.original_presentation(p)?
                            } else {
                                String::from_utf8(emit(&store.review(r, s.records.last())?)?)
                                    .map_err(|_| Error::Unavailable)?
                            };
                            preflight(store, &s, r, &presentation, pending.as_ref())?;
                            let prepared = Prepared {
                                bridge: "ck-intent-bridge".into(),
                                id,
                                kind: "prepared".into(),
                                input: r.clone(),
                                presentation: presentation.clone(),
                            };
                            let bytes = emit(&prepared)?;
                            self.prepared = Some(Preparation {
                                since: std::time::Instant::now(),
                                input: r.clone(),
                                presentation,
                                pending,
                            });
                            Ok(bytes)
                        }
                    } else if c.kind != "call" {
                        Err(Error::Invalid)
                    } else {
                        read_or_retain(store, &s, id, r, &c.authorization)
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
                c.authorization.check(false)?;
                out
            }
            Envelope::Confirm(c) => {
                c.authorization.check(true)?;
                let p = self.prepared.take().ok_or(Error::Unavailable)?;
                if p.input != c.input {
                    return Err(Error::Conflict);
                }
                let store = self.owner.as_mut().ok_or(Error::Unavailable)?;
                store.phase("reserve");
                let out = (|| {
                    let s = store.snapshot()?;
                    if let Some(r) = s.accepted(c.input.key()) {
                        return if r.input == c.input {
                            accepted(id, r)
                        } else {
                            Err(Error::Conflict)
                        };
                    }
                    let pending = matching_pending(&s, &c.input)?;
                    if pending != p.pending {
                        return Err(Error::Conflict);
                    }
                    let review = if let Some(pending) = &pending {
                        store.original_presentation(pending)?
                    } else {
                        String::from_utf8(emit(&store.review(&c.input, s.records.last())?)?)
                            .map_err(|_| Error::Unavailable)?
                    };
                    if review != p.presentation {
                        return Err(Error::Conflict);
                    }
                    preflight(store, &s, &c.input, &review, pending.as_ref())?;
                    let pending = match pending {
                        Some(p) => p,
                        None => {
                            let presentation = store.retain(&review)?;
                            let receipt = Receipt {
                                format: "ck-local-approval".into(),
                                principal: "person-1".into(),
                                subject_sha256: hash(&emit(&c.input)?),
                                presentation,
                                decision: "adopt".into(),
                                ui: "local-tui-exact".into(),
                            };
                            let receipt = String::from_utf8(emit(&receipt)?)
                                .map_err(|_| Error::Unavailable)?;
                            let approval = store.retain(&receipt)?;
                            Pending {
                                input: c.input.clone(),
                                approval,
                            }
                        }
                    };
                    let r = store.reserve_commit(&s, pending, &c.authorization)?;
                    accepted(id, &r)
                })();
                if out == Err(Error::Unavailable) {
                    store.finish_failure()
                }
                c.authorization.check(false)?;
                out
            }
        }
    }
}
enum Envelope {
    Connect(Connect),
    Call(Call),
    Confirm(Confirm),
    Control(Control),
}
fn matching_pending(s: &Snapshot, r: &Request) -> Result<Option<Pending>> {
    if s.readiness.iter().any(|s| {
        matches!(
            s.as_str(),
            "blocked_material_temp" | "blocked_unaccepted_tail"
        )
    }) {
        return Err(Error::Unavailable);
    }
    if let Some(p) = &s.prefix.pending {
        if p.input.key() != r.key() {
            return Err(Error::Unavailable);
        }
        if p.input != *r {
            return Err(Error::Conflict);
        }
        return Ok(Some(p.clone()));
    }
    if let Some(t) = &s.temp {
        if let Some(p) = &t.pending {
            if p.input.key() != r.key() {
                return Err(Error::Unavailable);
            }
            if p.input != *r {
                return Err(Error::Conflict);
            }
            return Ok(Some(p.clone()));
        }
        return Err(Error::Unavailable);
    }
    if r.op == "open_intent" {
        if s.prefix.generation != 0 {
            return Err(Error::Unsupported);
        }
    } else if s.tip().is_none() || r.expected != s.tip() {
        return Err(Error::Conflict);
    }
    if s.prefix.generation == 128 {
        return Err(Error::Unsupported);
    }
    Ok(None)
}
fn read_or_retain(
    store: &mut Store,
    s: &Snapshot,
    id: u64,
    r: &Request,
    lease: &Lease,
) -> Result<Vec<u8>> {
    match r.op.as_str() {
        "retain_text" => {
            lease.check(true)?;
            let material = store.retain_agent(r.text.as_deref().ok_or(Error::Invalid)?, s)?;
            reply(
                id,
                &Retained {
                    version: V.into(),
                    kind: "retained".into(),
                    material,
                },
            )
        }
        "resolve_text" => {
            let material = r.material.as_ref().ok_or(Error::Invalid)?.clone();
            let text = store.resolve(&material)?;
            reply(
                id,
                &Resolved {
                    version: V.into(),
                    kind: "resolved".into(),
                    material,
                    text,
                },
            )
            .map_err(|_| Error::Unavailable)
        }
        "inspect_operation" => {
            let result = s.accepted(r.key()).map(Record::outcome);
            let status = if result.is_some() {
                "accepted"
            } else if s
                .prefix
                .pending
                .as_ref()
                .is_some_and(|p| p.input.key() == r.key())
            {
                "pending"
            } else {
                "not_found_now"
            };
            reply(
                id,
                &Operation {
                    version: V.into(),
                    kind: "operation".into(),
                    key: r.key().into(),
                    status: status.into(),
                    result,
                    tip: s.tip(),
                    readiness: s.readiness.clone(),
                },
            )
        }
        "read_context" => {
            let at = r.at.clone().or_else(|| s.tip());
            if at.as_ref().is_some_and(|f| f.seq > s.prefix.generation) {
                return Err(Error::Invalid);
            }
            let record = at.as_ref().map(|f| &s.records[f.seq as usize - 1]);
            reply(
                id,
                &ContextReply {
                    version: V.into(),
                    kind: "context".into(),
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
                    readiness: s.readiness.clone(),
                },
            )
        }
        "read_history" => {
            let through = r.through.clone().or_else(|| s.tip());
            let last = through.as_ref().map_or(0, |f| f.seq);
            let after = r.after.ok_or(Error::Invalid)?;
            if last > s.prefix.generation || after > last {
                return Err(Error::Invalid);
            }
            let mut page = HistoryReply {
                version: V.into(),
                kind: "history".into(),
                tip: s.tip(),
                through,
                records: vec![],
                coverage: HistoryCoverage { first: 0, last: 0 },
                next_after: None,
                readiness: s.readiness.clone(),
            };
            let count = (last - after).min(r.limit.ok_or(Error::Invalid)?);
            for n in after + 1..=after + count {
                let old = page.clone();
                page.records.push(s.records[n as usize - 1].clone());
                page.coverage = HistoryCoverage {
                    first: after + 1,
                    last: n,
                };
                page.next_after = (n < last).then_some(n);
                if reply(id, &page).is_err() {
                    page = old;
                    break;
                }
            }
            if after < last && page.records.is_empty() {
                return Err(Error::Unavailable);
            }
            reply(id, &page)
        }
        _ => Err(Error::Invalid),
    }
}
