//! Strict one-of meanings for the independently versioned read protocol.
use super::bridge::{self, Bridge, Budget};
use super::framing::{CodecError, Result};
use super::read_messages::{
    WChangeRequest, WCursor, WLimits, WMatcher, WOperationReference, WPage, WPosition,
};
use super::typed::messages::{WChangeKey, WContentKey, WContentReference, WEmpty};
use super::wire::{Rule, Schema, Shape, WireSchema};
use crate::application::read::{
    ChangeAnchor, ChangeProgress, OperationKind, QualifiedReference, ReadRefusal, ReadReply,
    RecordSelection,
};
use crate::application::read_call::{ReadCall, ReadValue};

macro_rules! union_message {
    ($name:ident { $( $field:ident: $ty:ty, [$($attr:tt)*], $tag:literal, $shape:expr; )* }) => {
        #[derive(Clone, PartialEq, prost::Message)]
        pub(super) struct $name { $( #[prost($($attr)*)] pub $field: Option<$ty>, )* }
        impl WireSchema for $name {
            fn schema() -> Schema { Schema { oneof: true, fields: &[
                $( Rule { tag: $tag, shape: $shape, required: false, repeated: false, limit: 4096, fresh: false }, )*
            ] } }
        }
    };
}
union_message!(WAnchor {
    beginning: WEmpty, [message, optional, tag="1"], 1, Shape::Message(WEmpty::schema);
    current: WEmpty, [message, optional, tag="2"], 2, Shape::Message(WEmpty::schema);
    operation: Vec<u8>, [bytes="vec", optional, tag="3"], 3, Shape::Id;
    sequence: u64, [uint64, optional, tag="4"], 4, Shape::Uint;
});
impl Bridge for ChangeAnchor {
    type Wire = WAnchor;
    fn pack(&self, b: &mut Budget) -> Result<WAnchor> {
        let mut w = WAnchor::default();
        match self {
            Self::Beginning => w.beginning = Some(().pack(b)?),
            Self::Current => w.current = Some(().pack(b)?),
            Self::Operation(op) => w.operation = Some(op.pack(b)?),
            Self::Sequence(n) => w.sequence = Some(*n),
        }
        Ok(w)
    }
    fn unpack(w: WAnchor) -> Result<Self> {
        Ok(match (w.beginning, w.current, w.operation, w.sequence) {
            (Some(_), None, None, None) => Self::Beginning,
            (None, Some(_), None, None) => Self::Current,
            (None, None, Some(op), None) => Self::Operation(Bridge::unpack(op)?),
            (None, None, None, Some(n)) => Self::Sequence(n),
            _ => return Err(CodecError::Presence),
        })
    }
}
union_message!(WSelection {
    all: WEmpty, [message, optional, tag="1"], 1, Shape::Message(WEmpty::schema);
    matching: WMatcher, [message, optional, tag="2"], 2, Shape::Message(WMatcher::schema);
});
impl Bridge for RecordSelection {
    type Wire = WSelection;
    fn pack(&self, b: &mut Budget) -> Result<WSelection> {
        Ok(match self {
            Self::AllRecords => WSelection {
                all: Some(().pack(b)?),
                matching: None,
            },
            Self::MatchingRecords(m) => WSelection {
                all: None,
                matching: Some(m.pack(b)?),
            },
        })
    }
    fn unpack(w: WSelection) -> Result<Self> {
        match (w.all, w.matching) {
            (Some(_), None) => Ok(Self::AllRecords),
            (None, Some(m)) => Ok(Self::MatchingRecords(Bridge::unpack(m)?)),
            _ => Err(CodecError::Presence),
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WGroundReference {
    #[prost(message, optional, tag = "1")]
    change: Option<WChangeKey>,
    #[prost(bytes = "vec", optional, tag = "2")]
    ground: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    version: Option<Vec<u8>>,
}
impl WireSchema for WGroundReference {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WChangeKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
union_message!(WReference {
    change: WChangeKey, [message, optional, tag="1"], 1, Shape::Message(WChangeKey::schema);
    operation: WOperationReference, [message, optional, tag="2"], 2, Shape::Message(WOperationReference::schema);
    content: WContentKey, [message, optional, tag="3"], 3, Shape::Message(WContentKey::schema);
    membership: WContentReference, [message, optional, tag="4"], 4, Shape::Message(WContentReference::schema);
    ground: WGroundReference, [message, optional, tag="5"], 5, Shape::Message(WGroundReference::schema);
});
impl Bridge for QualifiedReference {
    type Wire = WReference;
    fn pack(&self, b: &mut Budget) -> Result<WReference> {
        let mut w = WReference::default();
        match self {
            Self::Change(k) => w.change = Some(k.pack(b)?),
            Self::Operation(r) => w.operation = Some(r.pack(b)?),
            Self::Content(k) => w.content = Some(k.pack(b)?),
            Self::Membership(r) => w.membership = Some(r.pack(b)?),
            Self::GroundObservation {
                change,
                ground,
                version,
            } => {
                w.ground = Some(WGroundReference {
                    change: Some(change.pack(b)?),
                    ground: Some(ground.pack(b)?),
                    version: Some(version.pack(b)?),
                })
            }
        }
        Ok(w)
    }
    fn unpack(w: WReference) -> Result<Self> {
        Ok(
            match (w.change, w.operation, w.content, w.membership, w.ground) {
                (Some(k), None, None, None, None) => Self::Change(Bridge::unpack(k)?),
                (None, Some(r), None, None, None) => Self::Operation(Bridge::unpack(r)?),
                (None, None, Some(k), None, None) => Self::Content(Bridge::unpack(k)?),
                (None, None, None, Some(r), None) => Self::Membership(Bridge::unpack(r)?),
                (None, None, None, None, Some(r)) => Self::GroundObservation {
                    change: Bridge::unpack(bridge::required(r.change)?)?,
                    ground: Bridge::unpack(bridge::required(r.ground)?)?,
                    version: Bridge::unpack(bridge::required(r.version)?)?,
                },
                _ => return Err(CodecError::Presence),
            },
        )
    }
}
union_message!(WProgress {
    more: WCursor, [message, optional, tag="1"], 1, Shape::Message(WCursor::schema);
    end: WEmpty, [message, optional, tag="2"], 2, Shape::Message(WEmpty::schema);
});
impl Bridge for ChangeProgress {
    type Wire = WProgress;
    fn pack(&self, b: &mut Budget) -> Result<WProgress> {
        Ok(match self {
            Self::More { next_page_cursor } => WProgress {
                more: Some(next_page_cursor.pack(b)?),
                end: None,
            },
            Self::EndOfRange => WProgress {
                more: None,
                end: Some(().pack(b)?),
            },
        })
    }
    fn unpack(w: WProgress) -> Result<Self> {
        match (w.more, w.end) {
            (Some(c), None) => Ok(Self::More {
                next_page_cursor: Bridge::unpack(c)?,
            }),
            (None, Some(_)) => Ok(Self::EndOfRange),
            _ => Err(CodecError::Presence),
        }
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WResolve {
    #[prost(message, optional, tag = "1")]
    change: Option<WChangeKey>,
    #[prost(message, optional, tag = "2")]
    anchor: Option<WAnchor>,
    #[prost(message, optional, tag = "3")]
    limits: Option<WLimits>,
}
impl WireSchema for WResolve {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WChangeKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAnchor::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WLimits::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WContentRequest {
    #[prost(message, optional, tag = "1")]
    membership: Option<WContentReference>,
    #[prost(message, optional, tag = "2")]
    limits: Option<WLimits>,
}
impl WireSchema for WContentRequest {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WContentReference::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WLimits::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
union_message!(WCall {
    resolve: WResolve, [message, optional, tag="1"], 1, Shape::Message(WResolve::schema);
    change: WChangeRequest, [message, optional, tag="2"], 2, Shape::Message(WChangeRequest::schema);
    content: WContentRequest, [message, optional, tag="3"], 3, Shape::Message(WContentRequest::schema);
});
impl Bridge for ReadCall {
    type Wire = WCall;
    fn pack(&self, b: &mut Budget) -> Result<WCall> {
        let mut w = WCall::default();
        match self {
            Self::Resolve {
                change,
                anchor,
                limits,
            } => {
                w.resolve = Some(WResolve {
                    change: Some(change.pack(b)?),
                    anchor: Some(anchor.pack(b)?),
                    limits: Some(limits.pack(b)?),
                })
            }
            Self::Change(r) => w.change = Some(r.pack(b)?),
            Self::Content { membership, limits } => {
                w.content = Some(WContentRequest {
                    membership: Some(membership.pack(b)?),
                    limits: Some(limits.pack(b)?),
                })
            }
        }
        Ok(w)
    }
    fn unpack(w: WCall) -> Result<Self> {
        Ok(match (w.resolve, w.change, w.content) {
            (Some(r), None, None) => Self::Resolve {
                change: Bridge::unpack(bridge::required(r.change)?)?,
                anchor: Bridge::unpack(bridge::required(r.anchor)?)?,
                limits: Bridge::unpack(bridge::required(r.limits)?)?,
            },
            (None, Some(r), None) => Self::Change(Bridge::unpack(r)?),
            (None, None, Some(r)) => Self::Content {
                membership: Bridge::unpack(bridge::required(r.membership)?)?,
                limits: Bridge::unpack(bridge::required(r.limits)?)?,
            },
            _ => return Err(CodecError::Presence),
        })
    }
}
union_message!(WReply {
    position: WPosition, [message, optional, tag="1"], 1, Shape::Message(WPosition::schema);
    change: WPage, [message, optional, tag="2"], 2, Shape::Message(WPage::schema);
    content: Vec<u8>, [bytes="vec", optional, tag="3"], 3, Shape::Content;
    refused: i32, [int32, optional, tag="4"], 4, Shape::Enum(&[1,2,3,4,5,6]);
});
impl Bridge for ReadReply<ReadValue> {
    type Wire = WReply;
    fn pack(&self, b: &mut Budget) -> Result<WReply> {
        let mut w = WReply::default();
        match self {
            Self::Returned(ReadValue::Position(p)) => w.position = Some(p.pack(b)?),
            Self::Returned(ReadValue::Change(p)) => w.change = Some(p.pack(b)?),
            Self::Returned(ReadValue::Content(bytes)) => w.content = Some(bytes.pack(b)?),
            Self::Refused(r) => w.refused = Some(r.pack(b)?),
        }
        Ok(w)
    }
    fn unpack(w: WReply) -> Result<Self> {
        Ok(match (w.position, w.change, w.content, w.refused) {
            (Some(p), None, None, None) => Self::Returned(ReadValue::Position(Bridge::unpack(p)?)),
            (None, Some(p), None, None) => Self::Returned(ReadValue::Change(Bridge::unpack(p)?)),
            (None, None, Some(bytes), None) => Self::Returned(ReadValue::Content(bytes)),
            (None, None, None, Some(r)) => Self::Refused(Bridge::unpack(r)?),
            _ => return Err(CodecError::Presence),
        })
    }
}
impl Bridge for ReadRefusal {
    type Wire = i32;
    fn pack(&self, _: &mut Budget) -> Result<i32> {
        Ok(match self {
            Self::Denied => 1,
            Self::Invalid => 2,
            Self::Changed => 3,
            Self::Unavailable => 4,
            Self::Limit => 5,
            Self::Unsupported => 6,
        })
    }
    fn unpack(v: i32) -> Result<Self> {
        match v {
            1 => Ok(Self::Denied),
            2 => Ok(Self::Invalid),
            3 => Ok(Self::Changed),
            4 => Ok(Self::Unavailable),
            5 => Ok(Self::Limit),
            6 => Ok(Self::Unsupported),
            _ => Err(CodecError::Enum),
        }
    }
}
impl Bridge for OperationKind {
    type Wire = i32;
    fn pack(&self, _: &mut Budget) -> Result<i32> {
        Ok(match self {
            Self::Start => 1,
            Self::Propose => 2,
            Self::Assess => 3,
            Self::Decide => 4,
            Self::Retract => 5,
            Self::Reaffirm => 6,
            Self::SetGrant => 7,
            Self::RevokeGrant => 8,
            Self::Admit => 9,
            Self::Dispatch => 10,
            Self::Finding => 11,
            Self::Adapt => 12,
            Self::Progress => 13,
            Self::Fulfill => 14,
            Self::Withdraw => 15,
            Self::Reconcile => 16,
        })
    }
    fn unpack(v: i32) -> Result<Self> {
        match v {
            1 => Ok(Self::Start),
            2 => Ok(Self::Propose),
            3 => Ok(Self::Assess),
            4 => Ok(Self::Decide),
            5 => Ok(Self::Retract),
            6 => Ok(Self::Reaffirm),
            7 => Ok(Self::SetGrant),
            8 => Ok(Self::RevokeGrant),
            9 => Ok(Self::Admit),
            10 => Ok(Self::Dispatch),
            11 => Ok(Self::Finding),
            12 => Ok(Self::Adapt),
            13 => Ok(Self::Progress),
            14 => Ok(Self::Fulfill),
            15 => Ok(Self::Withdraw),
            16 => Ok(Self::Reconcile),
            _ => Err(CodecError::Enum),
        }
    }
}
