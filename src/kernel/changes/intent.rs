//! Versioned private intent records. Identities are data, never approval or authority.
use crate::kernel::containers::intake::{self, Issue, Proposal, Receipt, Result};

/// Bounded complete-history verification for the initial native profile, including revision zero.
pub const MAX_INTENT_REVISIONS: usize = 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntentRevision {
    pub container_id: String,
    pub change_id: String,
    pub revision_id: String,
    /// Both fields are absent only for the immutable original intake revision.
    pub previous_revision: Option<String>,
    pub request_id: Option<String>,
    pub actor: String,
    pub what: String,
    pub why: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntentRevisionRequest {
    pub container_id: String,
    pub change_id: String,
    pub request_id: String,
    pub expected_revision: String,
    pub what: String,
    pub why: Option<String>,
}

pub fn valid_digest(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

pub fn validate_request(request: &IntentRevisionRequest) -> Result<()> {
    // Reject oversized input before cloning exact text into the shared intake validator.
    if request.what.len() > 65_536 || request.why.as_ref().is_some_and(|why| why.len() > 65_536) {
        return Err(Issue::InvalidInput);
    }
    intake::validate(&Proposal {
        container_id: request.container_id.clone(),
        request_id: request.request_id.clone(),
        what: request.what.clone(),
        why: request.why.clone(),
    })?;
    if !valid_digest(&request.change_id) || !valid_digest(&request.expected_revision) {
        return Err(Issue::InvalidInput);
    }
    Ok(())
}

pub fn identity(revision: &IntentRevision) -> String {
    intake::digest(
        "changekernel.native-intent.revision@1",
        &[
            &revision.container_id,
            &revision.change_id,
            &revision.actor,
            revision.previous_revision.as_deref().unwrap_or(""),
            revision.request_id.as_deref().unwrap_or(""),
            &revision.what,
        ],
        revision.why.as_deref(),
    )
}

pub fn origin(receipt: &Receipt) -> IntentRevision {
    let mut revision = IntentRevision {
        container_id: receipt.container_id.clone(),
        change_id: receipt.change_id.clone(),
        revision_id: String::new(),
        previous_revision: None,
        request_id: None,
        actor: receipt.actor.clone(),
        what: receipt.what.clone(),
        why: receipt.why.clone(),
    };
    revision.revision_id = identity(&revision);
    revision
}

impl IntentRevision {
    /// Construct data for a proposed revision, not a retained receipt or an authorization grant.
    pub fn successor(request: &IntentRevisionRequest, actor: &str) -> Result<Self> {
        if !intake::identifier(actor) {
            return Err(Issue::Denied);
        }
        validate_request(request)?;
        let mut revision = IntentRevision {
            container_id: request.container_id.clone(),
            change_id: request.change_id.clone(),
            revision_id: String::new(),
            previous_revision: Some(request.expected_revision.clone()),
            request_id: Some(request.request_id.clone()),
            actor: actor.into(),
            what: request.what.clone(),
            why: request.why.clone(),
        };
        revision.revision_id = identity(&revision);
        Ok(revision)
    }
}

pub fn validate_record(revision: &IntentRevision) -> Result<()> {
    let shape = match (&revision.previous_revision, &revision.request_id) {
        (None, None) => true,
        (Some(previous), Some(request)) => valid_digest(previous) && intake::identifier(request),
        _ => false,
    };
    if !shape
        || !intake::identifier(&revision.container_id)
        || !intake::identifier(&revision.actor)
        || !valid_digest(&revision.change_id)
        || revision.what.trim().is_empty()
        || revision.what.len() > 65_536
        || revision.why.as_ref().is_some_and(|why| why.len() > 65_536)
        || revision.revision_id != identity(revision)
    {
        return Err(Issue::Unavailable);
    }
    Ok(())
}
