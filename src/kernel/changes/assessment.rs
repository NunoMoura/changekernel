//! Fixed, independently adopted notice fixture definition; no evaluator runtime.
use super::{intent_trace::Request, opening::identifier};
pub(crate) const POLICY: &str = "fixture-notice@1";
pub(crate) const CHECK: &str = "notice-what@1";
pub(crate) const EVALUATOR: &str = "utf8-length@1";
pub(crate) fn valid(r: &Request) -> bool {
    if r.v != 3 || !identifier(&r.workspace_id) || !identifier(&r.change) {
        return false;
    }
    match r.op.as_str() {
        "revise_intent" => {
            r.check.is_none()
                && r.at.is_none()
                && r.key.as_deref().is_some_and(identifier)
                && r.expected_intent
                    .as_deref()
                    .is_some_and(|s| super::intent_trace::reference(s).is_some())
                && r.what
                    .as_deref()
                    .is_some_and(|s| !s.trim().is_empty() && s.len() <= 65_536)
                && r.why
                    .as_ref()
                    .is_some_and(|s| s.as_ref().is_none_or(|s| s.len() <= 65_536))
        }
        "inspect_intent" | "inspect_assessment" => {
            r.check.is_none()
                && r.key.is_none()
                && r.expected_intent.is_none()
                && r.what.is_none()
                && r.why.is_none()
                && r.at.as_ref().is_some_and(|s| {
                    s.as_ref()
                        .is_none_or(|s| super::intent_trace::reference(s).is_some())
                })
        }
        "assess_intent" => {
            r.key.as_deref().is_some_and(identifier)
                && r.expected_intent
                    .as_deref()
                    .is_some_and(|s| super::intent_trace::reference(s).is_some())
                && r.what.is_none()
                && r.why.is_none()
                && r.at.is_none()
                && r.check.as_deref().is_some_and(|s| {
                    !s.is_empty()
                        && s.len() <= 64
                        && s.bytes()
                            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'@' | b'-'))
                })
        }
        _ => false,
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Evidence {
    pub intent: String,
    pub field: String,
    pub utf8_bytes: u64,
    pub limit: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Assessed {
    pub v: u64,
    pub kind: String,
    pub workspace_id: String,
    pub change: String,
    pub key: String,
    pub actor: String,
    pub result: String,
    pub seq: u64,
    pub intent: String,
    pub policy: String,
    pub check: String,
    pub evaluator: String,
    pub passed: bool,
    pub feedback: String,
    pub evidence: Evidence,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct Assessment {
    pub v: u64,
    pub custody: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub seq: u64,
    pub prev: String,
    pub kind: String,
    pub input: Request,
    pub result: Assessed,
}
