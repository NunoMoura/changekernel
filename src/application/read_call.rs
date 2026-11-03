//! Typed elementary read calls, independent of their transport framing.
use super::read::{ChangeAnchor, ChangePage, ChangePosition, ReadChangeRequest, ReadLimits};
use crate::kernel::change::{ChangeKey, ContentReference};

/// P34 calls do not discover Ledgers, follow foreign references or invoke native reads.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum ReadCall {
    Resolve {
        change: ChangeKey,
        anchor: ChangeAnchor,
        limits: ReadLimits,
    },
    Change(Box<ReadChangeRequest>),
    Content {
        membership: ContentReference,
        limits: ReadLimits,
    },
}

/// The reply kind is explicit; returned empty Content is not denial or unavailability.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum ReadValue {
    Position(ChangePosition),
    Change(Box<ChangePage>),
    Content(Vec<u8>),
}
