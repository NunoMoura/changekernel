//! Checked-in P34 Protobuf mapping. Existing stored messages/tags are not changed.
use super::bridge::{self, Bridge, Budget};
use super::framing::{CodecError, Result};
use super::typed::messages::{
    WAccepted, WChangeKey, WContentReference, WEvidence, WGrantUse, WGroundMap, WIdentity,
    WIntakeSnapshot, WNativeConditions,
};
use super::typed::variants::{WCommand, WGrantTarget};
use super::wire::{Rule, Schema, Shape, WireSchema};
use crate::application::operation_request::OperationRequestProfile;
use crate::application::read::{
    ActorReference, ChangePage, ChangePageCursor, ChangePosition, ChangeRange, OperationReference,
    PublicMembership, PublicOrigin, PublicRecord, ReadChangeRequest, ReadLimits, ReadSource,
    RecordMatch,
};

// This small macro keeps each public field's presence, wire shape and typed conversion
// adjacent. It generates no alternative interpretation and never alters stored definitions.
macro_rules! field {
    (pack, required, $value:expr, $b:expr) => {
        Some(($value).pack($b)?)
    };
    (pack, optional, $value:expr, $b:expr) => {
        bridge::pack_optional(&$value, $b)?
    };
    (pack, list, $value:expr, $b:expr) => {
        bridge::pack_list(&$value, $b)?
    };
    (pack, set, $value:expr, $b:expr) => {
        bridge::pack_set(&$value, $b)?
    };
    (pack, map, $value:expr, $b:expr) => {
        bridge::pack_map(&$value, $b)?
    };
    (unpack, required, $value:expr) => {
        Bridge::unpack(bridge::required($value)?)?
    };
    (unpack, optional, $value:expr) => {
        bridge::unpack_optional($value)?
    };
    (unpack, list, $value:expr) => {
        bridge::unpack_list($value)?
    };
    (unpack, set, $value:expr) => {
        bridge::unpack_set($value)?
    };
    (unpack, map, $value:expr) => {
        bridge::unpack_map($value)?
    };
    (required, required) => {
        true
    };
    (required, $other:ident) => {
        false
    };
    (repeated, map) => {
        true
    };
    (repeated, set) => {
        true
    };
    (repeated, list) => {
        true
    };
    (repeated, $other:ident) => {
        false
    };
}
macro_rules! read_message {
    ($wire:ident => $domain:ident { $( $mode:ident $name:ident : $ty:ty,
        [$($attr:tt)*], $tag:literal, $shape:expr; )* }) => {
        #[derive(Clone, PartialEq, prost::Message)]
        pub(super) struct $wire {
            $( #[prost($($attr)*)] pub $name: $ty, )*
        }
        impl WireSchema for $wire {
            fn schema() -> Schema { Schema { oneof: false, fields: &[
                $( Rule { tag: $tag, shape: $shape, required: field!(required, $mode),
                    repeated: field!(repeated, $mode), limit: 4096, fresh: false }, )*
            ] } }
        }
        impl Bridge for $domain {
            type Wire = $wire;
            fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
                b.message(|b| Ok($wire { $( $name: field!(pack, $mode, self.$name, b), )* }))
            }
            fn unpack(w: Self::Wire) -> Result<Self> {
                Ok(Self { $( $name: field!(unpack, $mode, w.$name), )* })
            }
        }
    };
}

impl Bridge for usize {
    type Wire = u64;
    fn pack(&self, _: &mut Budget) -> Result<u64> {
        u64::try_from(*self).map_err(|_| CodecError::Limit)
    }
    fn unpack(v: u64) -> Result<Self> {
        usize::try_from(v).map_err(|_| CodecError::Limit)
    }
}

read_message!(WReadProfile => OperationRequestProfile {
    required codec: Option<u32>, [uint32, optional, tag="1"], 1, Shape::Version(3);
    required schema: Option<u32>, [uint32, optional, tag="2"], 2, Shape::Version(3);
    required semantic: Option<u32>, [uint32, optional, tag="3"], 3, Shape::Version(3);
});
impl Bridge for u32 {
    type Wire = u32;
    fn pack(&self, _: &mut Budget) -> Result<u32> {
        Ok(*self)
    }
    fn unpack(v: u32) -> Result<Self> {
        Ok(v)
    }
}
read_message!(WLimits => ReadLimits {
    required scanned_records: Option<u64>, [uint64, optional, tag="1"], 1, Shape::Uint;
    required returned_records: Option<u64>, [uint64, optional, tag="2"], 2, Shape::Uint;
    required reply_bytes: Option<u64>, [uint64, optional, tag="3"], 3, Shape::Uint;
});
read_message!(WSource => ReadSource {
    required identity: Option<WIdentity>, [message, optional, tag="1"], 1, Shape::Message(WIdentity::schema);
    required profile: Option<WReadProfile>, [message, optional, tag="2"], 2, Shape::Message(<WReadProfile as WireSchema>::schema);
});
read_message!(WPosition => ChangePosition {
    required source: Option<WSource>, [message, optional, tag="1"], 1, Shape::Message(WSource::schema);
    required sequence: Option<u64>, [uint64, optional, tag="2"], 2, Shape::Uint;
    optional operation: Option<Vec<u8>>, [bytes="vec", optional, tag="3"], 3, Shape::Id;
});
read_message!(WRange => ChangeRange {
    required after: Option<WPosition>, [message, optional, tag="1"], 1, Shape::Message(WPosition::schema);
    required through: Option<WPosition>, [message, optional, tag="2"], 2, Shape::Message(WPosition::schema);
});
read_message!(WOperationReference => OperationReference {
    required change: Option<WChangeKey>, [message, optional, tag="1"], 1, Shape::Message(WChangeKey::schema);
    required operation: Option<Vec<u8>>, [bytes="vec", optional, tag="2"], 2, Shape::Id;
});
read_message!(WActorReference => ActorReference {
    required change: Option<WChangeKey>, [message, optional, tag="1"], 1, Shape::Message(WChangeKey::schema);
    required actor: Option<Vec<u8>>, [bytes="vec", optional, tag="2"], 2, Shape::Id;
});
read_message!(WMatcher => RecordMatch {
    set kinds: Vec<i32>, [int32, repeated, tag="1"], 1, Shape::Enum(&[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    set operations: Vec<WOperationReference>, [message, repeated, tag="2"], 2, Shape::Message(WOperationReference::schema);
    set actors: Vec<WActorReference>, [message, repeated, tag="3"], 3, Shape::Message(WActorReference::schema);
    set references: Vec<super::read_variants::WReference>, [message, repeated, tag="4"], 4, Shape::Message(super::read_variants::WReference::schema);
});
read_message!(WCursor => ChangePageCursor {
    required range: Option<WRange>, [message, optional, tag="1"], 1, Shape::Message(WRange::schema);
    required selection: Option<super::read_variants::WSelection>, [message, optional, tag="2"], 2, Shape::Message(super::read_variants::WSelection::schema);
    required reader: Option<Vec<u8>>, [bytes="vec", optional, tag="3"], 3, Shape::Id;
    required permission_scope: Option<WChangeKey>, [message, optional, tag="4"], 4, Shape::Message(WChangeKey::schema);
    required last_scanned: Option<WPosition>, [message, optional, tag="5"], 5, Shape::Message(WPosition::schema);
});
read_message!(WChangeRequest => ReadChangeRequest {
    required change: Option<WChangeKey>, [message, optional, tag="1"], 1, Shape::Message(WChangeKey::schema);
    required range: Option<WRange>, [message, optional, tag="2"], 2, Shape::Message(WRange::schema);
    required selection: Option<super::read_variants::WSelection>, [message, optional, tag="3"], 3, Shape::Message(super::read_variants::WSelection::schema);
    optional page_cursor: Option<WCursor>, [message, optional, tag="4"], 4, Shape::Message(WCursor::schema);
    required limits: Option<WLimits>, [message, optional, tag="5"], 5, Shape::Message(WLimits::schema);
});
read_message!(WPublicOrigin => PublicOrigin {
    required grant: Option<WGrantUse>, [message, optional, tag="1"], 1, Shape::Message(WGrantUse::schema);
    required target: Option<WGrantTarget>, [message, optional, tag="2"], 2, Shape::Message(WGrantTarget::schema);
});
read_message!(WMembership => PublicMembership {
    required reference: Option<WContentReference>, [message, optional, tag="1"], 1, Shape::Message(WContentReference::schema);
    required intake: Option<WIntakeSnapshot>, [message, optional, tag="2"], 2, Shape::Message(WIntakeSnapshot::schema);
    optional attributed_source: Option<Vec<u8>>, [bytes="vec", optional, tag="3"], 3, Shape::Id;
    set derived_from: Vec<WContentReference>, [message, repeated, tag="4"], 4, Shape::Message(WContentReference::schema);
    optional origin: Option<WPublicOrigin>, [message, optional, tag="5"], 5, Shape::Message(WPublicOrigin::schema);
});
read_message!(WPublicRecord => PublicRecord {
    required position: Option<WPosition>, [message, optional, tag="1"], 1, Shape::Message(WPosition::schema);
    required command: Option<WCommand>, [message, optional, tag="2"], 2, Shape::Message(WCommand::schema);
    required accepted: Option<WAccepted>, [message, optional, tag="3"], 3, Shape::Message(WAccepted::schema);
    optional used_grant: Option<WGrantUse>, [message, optional, tag="4"], 4, Shape::Message(WGrantUse::schema);
    list memberships: Vec<WMembership>, [message, repeated, tag="5"], 5, Shape::Message(WMembership::schema);
    optional discretion_evidence: Option<WEvidence>, [message, optional, tag="6"], 6, Shape::Message(WEvidence::schema);
    optional native_evidence: Option<WNativeConditions>, [message, optional, tag="7"], 7, Shape::Message(WNativeConditions::schema);
    map ground_observations: Vec<WGroundMap>, [message, repeated, tag="8"], 8, Shape::Message(WGroundMap::schema);
});
read_message!(WPage => ChangePage {
    list records: Vec<WPublicRecord>, [message, repeated, tag="1"], 1, Shape::Message(WPublicRecord::schema);
    required scanned: Option<WRange>, [message, optional, tag="2"], 2, Shape::Message(WRange::schema);
    required observed_head: Option<WPosition>, [message, optional, tag="3"], 3, Shape::Message(WPosition::schema);
    required progress: Option<super::read_variants::WProgress>, [message, optional, tag="4"], 4, Shape::Message(super::read_variants::WProgress::schema);
});
