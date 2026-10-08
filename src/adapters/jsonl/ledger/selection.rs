//! Closed private profile selection. Both profiles use the same custody machinery.
use super::{
    history::codec::{HistoryRequest, HistoryResult},
    work::Heap,
};
use crate::kernel::changes::{
    ledger::{Created, LedgerGrant, LedgerPair, Request},
    ledger_history::LedgerHistoryGrant,
    opening::identifier,
};
use serde_core::{Deserialize, Deserializer, Serialize, Serializer};
use std::{ops::Deref, path::PathBuf};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum Profile {
    Ledger,
    History,
    Continuity,
}
impl Profile {
    pub fn version(self) -> u64 {
        match self {
            Self::Ledger => 4,
            Self::History => 5,
            Self::Continuity => 6,
        }
    }
    pub fn tag(self, object: &str) -> &'static str {
        match (self, object) {
            (Self::Ledger, "profile") => "ck-ledger@4",
            (Self::History, "profile") => "ck-ledger-history@5",
            (Self::Ledger, "anchor") => "ck-ledger-anchor@4",
            (Self::History, "anchor") => "ck-ledger-history-anchor@5",
            (Self::Ledger, "creations") => "ck-ledger-creations@4",
            (Self::History, "creations") => "ck-ledger-history-creations@5",
            (Self::Ledger, "member-anchor") => "ck-ledger-member-anchor@4",
            (Self::History, "member-anchor") => "ck-ledger-history-member-anchor@5",
            (Self::Ledger, "prefix") => "ck-ledger-member-prefix@4",
            (Self::History, "prefix") => "ck-ledger-history-member-prefix@5",
            (Self::Ledger, "incident") => "ck-ledger-incident@4",
            (Self::History, "incident") => "ck-ledger-history-incident@5",
            (Self::Ledger, "member-incident") => "ck-ledger-member-incident@4",
            (Self::History, "member-incident") => "ck-ledger-history-member-incident@5",
            (Self::Continuity, "profile") => "ck-ledger-continuity@6",
            (Self::Continuity, "anchor") => "ck-ledger-continuity-anchor@6",
            (Self::Continuity, "creations") => "ck-ledger-continuity-creations@6",
            (Self::Continuity, "member-anchor") => "ck-ledger-continuity-member-anchor@6",
            (Self::Continuity, "prefix") => "ck-ledger-continuity-member-prefix@6",
            (Self::Continuity, "incident") => "ck-ledger-continuity-incident@6",
            (Self::Continuity, "member-incident") => "ck-ledger-continuity-member-incident@6",
            _ => unreachable!("closed custody object"),
        }
    }
    pub fn compared_tag(self, object: &str, legacy: usize) -> usize {
        match self {
            Self::Ledger => legacy,
            Self::History | Self::Continuity => self.tag(object).len(),
        }
    }
    pub fn trace_limit(self) -> usize {
        match self {
            Self::Ledger => crate::kernel::changes::ledger::T,
            Self::History | Self::Continuity => 17_825_792,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Adoption {
    pub policy: String,
    pub check: String,
    pub evaluator: String,
    pub adopter: String,
}
impl Heap for Adoption {
    fn heap(&self) -> usize {
        self.policy.heap() + self.check.heap() + self.evaluator.heap() + self.adopter.heap()
    }
    fn logical(&self) -> usize {
        self.policy.len() + self.check.len() + self.evaluator.len() + self.adopter.len()
    }
}
pub(super) struct Installation {
    pub profile: String,
    pub ledger: String,
    pub custody: String,
    pub owner: String,
    pub workspace_id: String,
    pub binding: String,
    pub directory: PathBuf,
    pub anchor: PathBuf,
    pub grants: [LedgerPair; 16],
    pub selected: Profile,
    pub adoption: Option<Adoption>,
}
impl From<LedgerGrant> for Installation {
    fn from(g: LedgerGrant) -> Self {
        Self {
            profile: g.profile,
            ledger: g.ledger,
            custody: g.custody,
            owner: g.owner,
            workspace_id: g.workspace_id,
            binding: g.binding,
            directory: g.directory,
            anchor: g.anchor,
            grants: g.grants,
            selected: Profile::Ledger,
            adoption: None,
        }
    }
}
impl From<LedgerHistoryGrant> for Installation {
    fn from(g: LedgerHistoryGrant) -> Self {
        Self {
            profile: g.profile,
            ledger: g.ledger,
            custody: g.custody,
            owner: g.owner,
            workspace_id: g.workspace_id,
            binding: g.binding,
            directory: g.directory,
            anchor: g.anchor,
            grants: g.grants,
            selected: Profile::History,
            adoption: Some(Adoption {
                policy: g.policy,
                check: g.check,
                evaluator: g.evaluator,
                adopter: g.adopter,
            }),
        }
    }
}
impl From<crate::kernel::changes::ledger_continuity::LedgerContinuityGrant> for Installation {
    fn from(g: crate::kernel::changes::ledger_continuity::LedgerContinuityGrant) -> Self {
        Self {
            profile: g.profile,
            ledger: g.ledger,
            custody: g.custody,
            owner: g.owner,
            workspace_id: g.workspace_id,
            binding: g.binding,
            directory: g.directory,
            anchor: g.anchor,
            grants: g.grants,
            selected: Profile::Continuity,
            adoption: Some(Adoption {
                policy: g.policy,
                check: g.check,
                evaluator: g.evaluator,
                adopter: g.adopter,
            }),
        }
    }
}
impl Installation {
    pub fn valid(&self) -> bool {
        self.profile == self.selected.tag("profile")
            && identifier(&self.ledger)
            && identifier(&self.custody)
            && self.owner == "owner-1"
            && self.workspace_id == "workspace-1"
            && self.binding == "fixture@1"
            && self.grants.iter().enumerate().all(|(i, p)| {
                identifier(&p.change)
                    && identifier(&p.custody)
                    && p.custody != self.custody
                    && self.grants[..i]
                        .iter()
                        .all(|q| q.change != p.change && q.custody != p.custody)
            })
    }
}
impl Heap for Installation {
    fn heap(&self) -> usize {
        self.profile.heap()
            + self.ledger.heap()
            + self.custody.heap()
            + self.owner.heap()
            + self.workspace_id.heap()
            + self.binding.heap()
            + self.directory.heap()
            + self.anchor.heap()
            + self.grants.heap()
            + self.adoption.heap()
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum SelectedRequest {
    Ledger(Request),
    History(HistoryRequest),
}
impl Deref for SelectedRequest {
    type Target = Request;
    fn deref(&self) -> &Request {
        match self {
            Self::Ledger(r) => r,
            Self::History(r) => &r.base,
        }
    }
}
impl SelectedRequest {
    pub fn payload(&self) -> usize {
        self.logical()
    }
    pub fn history(&self) -> &HistoryRequest {
        match self {
            Self::History(r) => r,
            _ => unreachable!("history dispatcher on legacy profile"),
        }
    }
}
impl Heap for SelectedRequest {
    fn heap(&self) -> usize {
        match self {
            Self::Ledger(r) => r.heap(),
            Self::History(r) => r.heap(),
        }
    }
    fn logical(&self) -> usize {
        match self {
            Self::Ledger(r) => r.payload(),
            Self::History(r) => r.logical(),
        }
    }
}
impl Serialize for SelectedRequest {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Ledger(r) => r.serialize(s),
            Self::History(r) => r.serialize(s),
        }
    }
}
impl<'de> Deserialize<'de> for SelectedRequest {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        if super::work::history_mode() {
            HistoryRequest::deserialize(d).map(Self::History)
        } else {
            Request::deserialize(d).map(Self::Ledger)
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) enum SelectedResult {
    Ledger(Created),
    History(Box<HistoryResult>),
}
impl Deref for SelectedResult {
    type Target = Created;
    fn deref(&self) -> &Created {
        match self {
            Self::Ledger(r) => r,
            Self::History(r) => &r.base,
        }
    }
}
impl Heap for SelectedResult {
    fn heap(&self) -> usize {
        match self {
            Self::Ledger(r) => r.heap(),
            Self::History(r) => r.heap(),
        }
    }
    fn logical(&self) -> usize {
        match self {
            Self::Ledger(r) => r.logical(),
            Self::History(r) => r.logical(),
        }
    }
}
impl Serialize for SelectedResult {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Ledger(r) => r.serialize(s),
            Self::History(r) => r.serialize(s),
        }
    }
}
impl<'de> Deserialize<'de> for SelectedResult {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        if super::work::history_mode() {
            HistoryResult::deserialize(d).map(|r| Self::History(Box::new(r)))
        } else {
            Created::deserialize(d).map(Self::Ledger)
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(super) struct Operation {
    pub v: u64,
    pub custody: String,
    pub ledger: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: Option<String>,
    pub kind: String,
    pub input: SelectedRequest,
    pub result: SelectedResult,
}
