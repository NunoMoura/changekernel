//! Values for the explicitly selected, fresh-only intent fixture.
use super::opening::{identifier, Request as OpeningRequest};
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Request {
    pub v: u64,
    pub op: String,
    pub workspace_id: String,
    pub change: String,
    pub key: Option<String>,
    pub expected_intent: Option<String>,
    pub what: Option<String>,
    pub why: Option<Option<String>>,
    pub at: Option<Option<String>>,
}
impl Request {
    pub fn valid(&self) -> bool {
        identifier(&self.workspace_id)
            && identifier(&self.change)
            && match (self.v, self.op.as_str()) {
                (1, "open_change") => {
                    self.expected_intent.is_none() && self.at.is_none() && self.opening().valid()
                }
                (1, "inspect_change") => {
                    self.key.is_none()
                        && self.expected_intent.is_none()
                        && self.what.is_none()
                        && self.why.is_none()
                        && self.at.is_none()
                }
                (2, "revise_intent") => {
                    self.at.is_none()
                        && self.key.as_deref().is_some_and(identifier)
                        && self
                            .expected_intent
                            .as_deref()
                            .is_some_and(|s| reference(s).is_some())
                        && self
                            .what
                            .as_deref()
                            .is_some_and(|s| !s.trim().is_empty() && s.len() <= 65_536)
                        && self
                            .why
                            .as_ref()
                            .is_some_and(|s| s.as_ref().is_none_or(|s| s.len() <= 65_536))
                }
                (2, "inspect_intent") => {
                    self.key.is_none()
                        && self.expected_intent.is_none()
                        && self.what.is_none()
                        && self.why.is_none()
                        && self
                            .at
                            .as_ref()
                            .is_some_and(|s| s.as_ref().is_none_or(|s| reference(s).is_some()))
                }
                _ => false,
            }
    }
    pub fn opening(&self) -> OpeningRequest {
        OpeningRequest {
            v: self.v,
            op: self.op.clone(),
            workspace_id: self.workspace_id.clone(),
            change: self.change.clone(),
            key: self.key.clone(),
            what: self.what.clone(),
            why: self.why.clone(),
        }
    }
    pub fn from_opening(r: OpeningRequest) -> Self {
        Self {
            v: r.v,
            op: r.op,
            workspace_id: r.workspace_id,
            change: r.change,
            key: r.key,
            what: r.what,
            why: r.why,
            expected_intent: None,
            at: None,
        }
    }
}
pub(crate) fn reference(s: &str) -> Option<(&str, u64)> {
    if s.len() > 71 {
        return None;
    }
    let (change, rest) = s.split_once(':')?;
    if !identifier(change) {
        return None;
    }
    if rest == "origin" {
        return Some((change, 1));
    }
    let n = rest.strip_prefix("op:")?;
    let seq: u64 = n.parse().ok()?;
    ((2..=128).contains(&seq) && n == seq.to_string()).then_some((change, seq))
}
pub(crate) fn logical(seq: u64) -> String {
    if seq == 1 {
        "change-1:origin".into()
    } else {
        format!("change-1:op:{seq}")
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Revised {
    pub v: u64,
    pub kind: String,
    pub workspace_id: String,
    pub change: String,
    pub key: String,
    pub actor: String,
    pub result: String,
    pub seq: u64,
    pub intent: String,
    pub previous_intent: String,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Revision {
    pub v: u64,
    pub custody: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: String,
    pub kind: String,
    pub input: Request,
    pub result: Revised,
}
