//! Small deterministic values for conversion tests; not supplied source authenticity.
use crate::application::operation_request::CURRENT_PROFILE;
use crate::application::read::{ChangePosition, ReadSource};
use crate::kernel::change as domain;
use serde_json::{json, Value};

pub(super) fn id<T: TryFrom<[u8; 16]>>(byte: u8) -> T
where
    T::Error: std::fmt::Debug,
{
    T::try_from([byte; 16]).expect("nonzero test ID")
}

pub(super) fn identity() -> domain::Identity {
    domain::Identity {
        owner: domain::OwnerId::from_bytes([1; 16]).expect("nonzero"),
        owner_actor: domain::ActorId::from_bytes([2; 16]).expect("nonzero"),
        ledger: domain::LedgerId::from_bytes([3; 16]).expect("nonzero"),
        change: domain::ChangeId::from_bytes([4; 16]).expect("nonzero"),
        agent: domain::ActorId::from_bytes([5; 16]).expect("nonzero"),
    }
}
pub(super) fn hex(byte: u8) -> String {
    format!("{byte:02x}").repeat(16)
}
pub(super) fn key_json() -> Value {
    json!({"owner":hex(1), "ledger":hex(3), "change":hex(4)})
}
pub(super) fn limits_json() -> Value {
    json!({"scanned_records":32, "returned_records":16, "reply_bytes":131072})
}
pub(super) fn resolve_json() -> Value {
    json!({"ResolveChangeCursor": {"change":key_json(), "anchor":"Beginning", "limits":limits_json()}})
}
pub(super) fn position(sequence: u64) -> ChangePosition {
    ChangePosition {
        source: ReadSource {
            identity: identity(),
            profile: CURRENT_PROFILE,
        },
        sequence,
        operation: if sequence == 0 {
            None
        } else {
            Some(
                domain::OperationId::from_bytes(u128::from(sequence).to_be_bytes())
                    .expect("nonzero"),
            )
        },
    }
}
pub(super) fn content(byte: u8) -> domain::ContentKey {
    domain::ContentKey {
        establishing: identity().change_key(),
        id: domain::ContentId::from_bytes([byte; 16]).expect("nonzero"),
    }
}
pub(super) fn membership() -> domain::ContentReference {
    domain::ContentReference {
        identity: identity(),
        operation: domain::OperationId::from_bytes([6; 16]).expect("nonzero"),
        content: content(7),
    }
}
pub(super) fn evidence() -> domain::Evidence {
    domain::Evidence {
        source: identity().agent,
        content: content(8),
        limitations: content(9),
    }
}
pub(super) fn dependency() -> domain::Dependency {
    domain::Dependency {
        ground: domain::GroundId::from_bytes([10; 16]).expect("nonzero"),
        version: domain::GroundVersion::from_bytes([11; 16]).expect("nonzero"),
    }
}
pub(super) fn grant() -> domain::GrantUse {
    domain::GrantUse {
        id: domain::GrantId::from_bytes([12; 16]).expect("nonzero"),
        generation: u64::MAX,
    }
}
