//! Explicit caller-retained declaration, not authenticated context or a transport/journal.
use super::records::HISTORY_VERSION;
use crate::kernel::change::{ActorId, ChangeKey, Operation, OwnerId};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct OperationRequestProfile {
    pub codec: u32,
    pub schema: u32,
    pub semantic: u32,
}
pub const CURRENT_PROFILE: OperationRequestProfile = OperationRequestProfile {
    codec: 3,
    schema: 3,
    semantic: HISTORY_VERSION,
};
impl OperationRequestProfile {
    pub fn is_current(&self) -> bool {
        *self == CURRENT_PROFILE
    }
}

/// Retain this complete immutable value and original bytes before submission.
/// Declarations must match the bound original and current authenticated context;
/// neither these fields nor an encoded frame provide authority.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OperationRequest {
    pub profile: OperationRequestProfile,
    pub target: ChangeKey,
    pub actor: ActorId,
    pub represented_owner: OwnerId,
    pub operation: Operation,
}
