//! Streaming concrete Views from fully validated canonical spans.
use super::super::{members::MemberState, *};
use super::sequential::{self, Span, Q};
use crate::adapters::jsonl::opening::codec::{self as formatter, Bounded};
use serde_core::ser::SerializeStruct;
use serde_core::{
    de::{self, MapAccess, Visitor},
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct ViewPrefix {
    pub first: u64,
    pub last: u64,
    pub end: u64,
    pub sha256: String,
}
shape!(ViewPrefix {
    first: u64,
    last: u64,
    end: u64,
    sha256: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Metadata {
    pub change: String,
    pub origin: String,
    pub actor: String,
    pub accepted: ViewPrefix,
    pub progress: String,
}
shape!(Metadata {
    change: String,
    origin: String,
    actor: String,
    accepted: ViewPrefix,
    progress: String
});
pub(super) fn progress(m: &MemberState) -> &'static str {
    if m.prefix.pending.is_some() {
        "blocked_pending"
    } else if m.trace.len() as u64 > m.prefix.end {
        "blocked_unaccepted_tail"
    } else {
        "ready"
    }
}
pub(super) fn metadata(m: &MemberState) -> Result<Metadata, Failure> {
    let r = m.record.as_ref().ok_or_else(Failure::damage)?;
    work::attempt(B::Constructions, 0, 16);
    let v = Metadata {
        change: r.change.clone(),
        origin: r.result.result.clone(),
        actor: r.result.actor.clone(),
        accepted: ViewPrefix {
            first: 1,
            last: m.prefix.generation,
            end: m.prefix.end,
            sha256: m.prefix.sha256.clone().ok_or_else(Failure::damage)?,
        },
        progress: progress(m).into(),
    };
    work::complete(B::Constructions, true);
    work::buffered_capacity(v.heap(), false);
    Ok(v)
}
struct Object<'a, 'b> {
    out: &'a mut Bounded<'b>,
    first: bool,
}
impl<'a, 'b> Object<'a, 'b> {
    fn new(out: &'a mut Bounded<'b>) -> Result<Self, ()> {
        out.raw(b"{")?;
        Ok(Self { out, first: true })
    }
    fn name(&mut self, name: &str) -> Result<(), ()> {
        if !self.first {
            self.out.raw(b",")?;
        }
        self.first = false;
        self.out.value(name)?;
        self.out.raw(b":")
    }
    fn field<T: Serialize + Heap + ?Sized>(&mut self, name: &str, v: &T) -> Result<(), ()> {
        self.name(name)?;
        work::operands(B::ReplyEmissions, v.logical(), 1);
        self.out.value(v)
    }
    fn records(&mut self, trace: &[u8], spans: &[Span]) -> Result<(), ()> {
        self.name("records")?;
        self.out.raw(b"[")?;
        for (i, s) in spans.iter().enumerate() {
            if i != 0 {
                self.out.raw(b",")?;
            }
            let bytes = &trace[s.start..s.end - 1];
            self.out.raw(bytes)?;
            work::operands(B::ReplyEmissions, bytes.len(), 1);
            work::update(|w| w.copied_record_bytes += bytes.len() as u64);
        }
        self.out.raw(b"]")
    }
    fn end(self) -> Result<(), ()> {
        self.out.raw(b"}")
    }
}
fn output(
    limit: usize,
    _logical: usize,
    fill: impl FnOnce(&mut Bounded<'_>) -> Result<(), ()>,
) -> Result<Owned<Vec<u8>>, Failure> {
    work::attempt(B::Outputs, 0, 1);
    work::attempt(B::Emissions, 0, 1);
    work::attempt(B::ReplyEmissions, 0, 0);
    let _writer = work::Fixed::new(std::mem::size_of::<Bounded<'_>>());
    let allocation = work::Allocation::new(false);
    let bytes = formatter::emit_stream(limit, Some(&|n| allocation.resize(n)), fill)
        .map_err(|_| Failure::damage())?;
    work::complete(B::Emissions, true);
    work::complete(B::ReplyEmissions, true);
    Ok(allocation.adopt(bytes))
}
#[derive(Clone, Debug, PartialEq, Eq)]
struct Assessment {
    assessment: String,
    intent: String,
    applicability: String,
}
shape!(Assessment {
    assessment: String,
    intent: String,
    applicability: String
});
#[derive(Clone, Debug, PartialEq, Eq)]
struct Gap {
    code: String,
    first: u64,
    last: u64,
    required_bytes: u64,
    budget: u64,
}
shape!(Gap {
    code: String,
    first: u64,
    last: u64,
    required_bytes: u64,
    budget: u64
});
#[derive(Clone, Debug, PartialEq, Eq)]
struct ContextCoverage {
    required: u64,
    returned: u64,
    complete: bool,
}
shape!(ContextCoverage {
    required: u64,
    returned: u64,
    complete: bool
});
#[derive(Clone, Debug, PartialEq, Eq)]
struct RangeCoverage {
    first: u64,
    last: u64,
    returned: u64,
    complete: bool,
}
shape!(RangeCoverage {
    first: u64,
    last: u64,
    returned: u64,
    complete: bool
});
struct Adopted<'a>(&'a selection::Adoption);
impl Heap for Adopted<'_> {
    fn heap(&self) -> usize {
        0
    }
    fn logical(&self) -> usize {
        self.0.logical() + 4
    }
}
impl Serialize for Adopted<'_> {
    fn serialize<S: serde_core::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut o = s.serialize_struct("adopted_check", 6)?;
        o.serialize_field("policy", &self.0.policy)?;
        o.serialize_field("check", &self.0.check)?;
        o.serialize_field("evaluator", &self.0.evaluator)?;
        o.serialize_field("adopter", &self.0.adopter)?;
        o.serialize_field("field", "what")?;
        o.serialize_field("limit", &80u64)?;
        o.end()
    }
}
impl<P: Layout> Custody<P> {
    pub(super) fn selected_position(
        input: Option<&str>,
        change: &str,
        count: u64,
    ) -> Result<u64, OpeningError> {
        let Some(r) = input else {
            return Ok(count);
        };
        let (subject, n) = super::codec::reference(r).ok_or(OpeningError::InvalidInput)?;
        if !work::test(B::Projection, subject.len().max(change.len()), 3, || {
            subject == change && n >= 1 && n <= count
        }) {
            return Err(OpeningError::Unavailable);
        }
        Ok(n)
    }
    pub(super) fn history_view(
        &self,
        input: &Request,
        m: &MemberState,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        let state = m.history.as_ref().ok_or(OpeningError::Unavailable)?;
        let change = input.change.as_deref().unwrap();
        let h = input.history();
        let selected = Self::selected_position(
            h.at.as_ref().and_then(Option::as_deref),
            change,
            m.prefix.generation,
        )?;
        let selected_end = state.spans[selected as usize - 1].end;
        let selected_hash = Owned::new(if selected == m.prefix.generation {
            m.prefix.sha256.clone().unwrap()
        } else {
            hash(&m.trace[..selected_end], false)
        });
        let accepted = ViewPrefix {
            first: 1,
            last: m.prefix.generation,
            end: m.prefix.end,
            sha256: m.prefix.sha256.clone().unwrap(),
        };
        let selected_prefix = ViewPrefix {
            first: 1,
            last: selected,
            end: selected_end as u64,
            sha256: (*selected_hash).clone(),
        };
        let accepted = Owned::new(accepted);
        let selected_prefix = Owned::new(selected_prefix);
        drop(selected_hash);
        let origin = Owned::new(sequential::reference(change, 1));
        let tip = Owned::new(sequential::reference(change, m.prefix.generation));
        let cursor = Owned::new(sequential::reference(change, selected));
        if input.op == "inspect_history" {
            let from = Self::selected_position(
                h.from
                    .as_ref()
                    .and_then(Option::as_deref)
                    .or(Some(origin.as_str())),
                change,
                selected,
            )?;
            let mut end = from as usize - 1;
            let mut bytes = 0;
            for span in &state.spans[from as usize - 1..selected as usize] {
                if !work::test(B::Projection, 0, 2, || {
                    end - (from as usize - 1) < input.limit.unwrap() as usize
                        && bytes + span.end - span.start <= Q - 16_384
                }) {
                    break;
                }
                bytes += span.end - span.start;
                end += 1;
            }
            let covered = RangeCoverage {
                first: from,
                last: end as u64,
                returned: end as u64 - from + 1,
                complete: end == selected as usize,
            };
            let next = if covered.complete {
                None
            } else {
                let mut next = Owned::constructed(|| input.clone());
                match &mut *next {
                    Request::History(r) => {
                        r.at = Some(Some((*cursor).clone()));
                        r.from = Some(Some(sequential::reference(change, end as u64 + 1)));
                    }
                    _ => unreachable!(),
                };
                next.refresh();
                Some(next)
            };
            output(Q, bytes, |out| {
                let mut o = Object::new(out)?;
                o.field("v", &work::version())?;
                o.field("kind", "history_view")?;
                o.field("ledger", &self.grant.ledger)?;
                o.field("workspace_id", &self.grant.workspace_id)?;
                o.field("change", change)?;
                o.field(
                    "projection",
                    if work::continuity_mode() {
                        "ck-ledger-history-range@2"
                    } else {
                        "ck-ledger-history-range@1"
                    },
                )?;
                o.field("origin", origin.as_str())?;
                o.field("tip", tip.as_str())?;
                o.field("cursor", cursor.as_str())?;
                o.field("accepted", &*accepted)?;
                o.field("selected", &*selected_prefix)?;
                o.records(&m.trace, &state.spans[from as usize - 1..end])?;
                o.field("coverage", &covered)?;
                o.field("next", &next.as_deref())?;
                o.field("progress", progress(m))?;
                o.end()
            })
            .map_err(|_| OpeningError::Unavailable)
        } else {
            let current = state.spans[selected as usize - 1].intent;
            let current_ref = Owned::new(sequential::reference(change, current));
            let fits = work::test(B::Projection, 0, 1, || selected_end <= Q - 65_536);
            let mut assessments = Owned::new(Vec::with_capacity(if fits { 127 } else { 0 }));
            if fits {
                for (i, span) in state.spans[..selected as usize].iter().enumerate() {
                    if span.assessment {
                        let applicable =
                            work::test(B::Applicability, 0, 1, || span.intent == current);
                        assessments.push(Assessment {
                            assessment: sequential::reference(change, i as u64 + 1),
                            intent: sequential::reference(change, span.intent),
                            applicability: if applicable { "current" } else { "historical" }.into(),
                        });
                        assessments.refresh();
                        work::update(|w| {
                            w.assessment_entries_peak =
                                w.assessment_entries_peak.max(assessments.len() as u64)
                        });
                    }
                }
            }
            let gaps = Owned::new(if fits {
                Vec::new()
            } else {
                vec![Gap {
                    code: "required_material_limit".into(),
                    first: 1,
                    last: selected,
                    required_bytes: selected_end as u64,
                    budget: (Q - 65_536) as u64,
                }]
            });
            let coverage = ContextCoverage {
                required: selected,
                returned: if fits { selected } else { 0 },
                complete: fits,
            };
            output(Q, if fits { selected_end } else { 0 }, |out| {
                let mut o = Object::new(out)?;
                o.field("v", &work::version())?;
                o.field("kind", "change_context")?;
                o.field("ledger", &self.grant.ledger)?;
                o.field("workspace_id", &self.grant.workspace_id)?;
                o.field("change", change)?;
                o.field(
                    "projection",
                    if work::continuity_mode() {
                        "ck-ledger-understanding@2"
                    } else {
                        "ck-ledger-understanding@1"
                    },
                )?;
                o.field("purpose", "understanding")?;
                o.field("origin", origin.as_str())?;
                o.field("tip", tip.as_str())?;
                o.field("cursor", cursor.as_str())?;
                o.field("current_intent", current_ref.as_str())?;
                o.field("accepted", &*accepted)?;
                o.field("selected", &*selected_prefix)?;
                o.field("adoption_scope", "authenticated_direct_only")?;
                o.field(
                    "adopted_check",
                    &Adopted(self.grant.adoption.as_ref().unwrap()),
                )?;
                o.records(
                    &m.trace,
                    if fits {
                        &state.spans[..selected as usize]
                    } else {
                        &[]
                    },
                )?;
                o.field("assessments", &*assessments)?;
                o.field("coverage", &coverage)?;
                o.field("gaps", &*gaps)?;
                o.field("progress", progress(m))?;
                o.end()
            })
            .map_err(|_| OpeningError::Unavailable)
        }
    }
    pub(super) fn history_selection(&self, m: &MemberState) -> Result<Owned<Vec<u8>>, Failure> {
        let metadata = Owned::new(metadata(m)?);
        output(L, metadata.logical(), |out| {
            let mut o = Object::new(out)?;
            o.field("v", &work::version())?;
            o.field("kind", "selection")?;
            o.field("ledger", &self.grant.ledger)?;
            o.field("workspace_id", &self.grant.workspace_id)?;
            o.field("member", &*metadata)?;
            o.end()
        })
    }
    pub(super) fn history_page(
        &self,
        input: &Request,
        members: &[Metadata],
        after: Option<&str>,
    ) -> Result<Owned<Vec<u8>>, OpeningError> {
        let cursor = after.map(|s| crate::kernel::changes::ledger::Cursor {
            v: work::version(),
            ledger: self.grant.ledger.clone(),
            workspace_id: self.grant.workspace_id.clone(),
            after: s.into(),
            limit: input.limit.unwrap(),
        });
        let _capacity = work::Allocation::new(false);
        _capacity.resize(cursor.heap());
        output(L, members.iter().map(Heap::logical).sum(), |out| {
            let mut o = Object::new(out)?;
            o.field("v", &work::version())?;
            o.field("kind", "change_page")?;
            o.field("ledger", &self.grant.ledger)?;
            o.field("workspace_id", &self.grant.workspace_id)?;
            o.field("order", "change_asc")?;
            o.field("members", members)?;
            o.field("next", &cursor)?;
            o.end()
        })
        .map_err(|_| OpeningError::Unavailable)
    }
}
