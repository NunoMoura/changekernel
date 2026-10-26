//! Explicit caller-retained declaration, not authenticated context or a transport/journal.
use super::pursuit_records::HISTORY_VERSION;
use crate::kernel::change::pursuit::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SubmissionProfile {
    pub codec: u32,
    pub schema: u32,
    pub semantic: u32,
}
pub const CURRENT_PROFILE: SubmissionProfile = SubmissionProfile {
    codec: 2,
    schema: 2,
    semantic: HISTORY_VERSION,
};
impl SubmissionProfile {
    pub fn is_current(&self) -> bool {
        *self == CURRENT_PROFILE
    }
}

/// Retain this complete immutable value and original bytes before submission.
/// Declarations must match the bound original and current authenticated context;
/// neither these fields nor an encoded frame provide authority.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Submission {
    pub profile: SubmissionProfile,
    pub target: ChangeKey,
    pub actor: ActorId,
    pub represented_owner: OwnerId,
    pub operation: Operation,
}
