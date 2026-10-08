//! Independently selected v6 surface, isolated observer and scoped identity hooks.
mod observation;
pub use observation::{LedgerContinuityCall, LedgerContinuityWork};
pub(super) mod identity;
pub(super) mod receipt;
pub(super) mod size;
use super::*;
use crate::kernel::changes::ledger_continuity::LedgerContinuityGrant;
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerIdentityObject {
    LedgerDirectory,
    LedgerLock,
    MembersDirectory,
    MemberDirectory,
    MemberLock,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerIdentityStep {
    BeforeFsType,
    AfterFsType,
    BeforeFsInfo,
    AfterFsInfo,
    BeforeHandle,
    AfterHandle,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerContinuityIoEvent {
    File(LedgerIoEvent),
    Identity {
        scope: u8,
        object: LedgerIdentityObject,
        step: LedgerIdentityStep,
    },
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerContinuityIoFault {
    Continue,
    Io,
    ShortWrite,
    Refuse,
    NativeErrno(i32),
    MalformedIdentity,
}
pub type LedgerContinuityIoHook =
    Box<dyn FnMut(LedgerContinuityIoEvent) -> LedgerContinuityIoFault>;
pub(crate) fn connect(
    grant: LedgerContinuityGrant,
    mode: OpeningMode,
    hook: Option<LedgerContinuityIoHook>,
) -> Result<Custody<layout::Native>, OpeningError> {
    if !identity::supported() {
        return Err(OpeningError::Unavailable);
    }
    Custody::<layout::Native>::connect_context(grant.into(), mode, hook)
        .map_err(|_| OpeningError::Unavailable)
}
pub(crate) fn request(bytes: &[u8]) -> Result<Owned<Request>, OpeningError> {
    super::codec::decode(bytes, B::Ingress).map_err(|_| OpeningError::InvalidInput)
}
pub(crate) fn reply(result: Result<Owned<Vec<u8>>, OpeningError>) -> Vec<u8> {
    super::history::reply(result)
}

use serde_core::{
    de::{self, MapAccess, Visitor},
    ser::SerializeStruct,
    Deserialize, Deserializer, Serialize, Serializer,
};
use std::fmt;
#[derive(Clone, Debug, PartialEq, Eq)]
pub(in crate::adapters::jsonl::ledger) struct MemberAnchorWire {
    pub format: String,
    pub custody: String,
    pub ledger: String,
    pub workspace_id: String,
    pub binding: String,
    pub change: String,
    pub owner: String,
    pub key: String,
    pub directory: String,
    pub directory_identity: identity::Identity,
    pub lock_identity: identity::Identity,
    pub stage: String,
    pub policy: String,
    pub check: String,
    pub evaluator: String,
    pub adopter: String,
}
shape!(MemberAnchorWire {
    format: String,
    custody: String,
    ledger: String,
    workspace_id: String,
    binding: String,
    change: String,
    owner: String,
    key: String,
    directory: String,
    directory_identity: identity::Identity,
    lock_identity: identity::Identity,
    stage: String,
    policy: String,
    check: String,
    evaluator: String,
    adopter: String
});
impl<P: layout::Layout> From<MemberAnchorWire> for super::codec::MemberAnchor<P> {
    fn from(a: MemberAnchorWire) -> Self {
        Self {
            identity: P::Member::from_value(Some(identity::Pair {
                directory: a.directory_identity,
                lock: a.lock_identity,
            })),
            base: super::codec::MemberAnchorBase {
                format: a.format,
                custody: a.custody,
                ledger: a.ledger,
                workspace_id: a.workspace_id,
                binding: a.binding,
                change: a.change,
                owner: a.owner,
                key: a.key,
                directory: a.directory,
                directory_device: 0,
                directory_inode: 0,
                lock_device: 0,
                lock_inode: 0,
                stage: a.stage,
            },
            adoption: Some(super::selection::Adoption {
                policy: a.policy,
                check: a.check,
                evaluator: a.evaluator,
                adopter: a.adopter,
            }),
        }
    }
}
