//! Concrete profile-selected history lifecycle and independent observations.
pub(crate) mod codec;
mod observation;
mod operations;
mod projection;
pub(super) mod sequential;
pub use observation::{LedgerHistoryCall, LedgerHistoryWork};

use super::*;
use crate::kernel::changes::ledger_history::LedgerHistoryGrant;
pub(crate) fn connect(
    grant: LedgerHistoryGrant,
    mode: OpeningMode,
    hook: Option<LedgerIoHook>,
) -> Result<Custody, OpeningError> {
    Custody::connect_inner(grant.into(), mode, hook).map_err(|_| OpeningError::Unavailable)
}
pub(crate) fn request(bytes: &[u8]) -> Result<Owned<Request>, OpeningError> {
    super::codec::decode(bytes, B::Ingress).map_err(|_| OpeningError::InvalidInput)
}
pub(crate) fn reply(result: Result<Owned<Vec<u8>>, OpeningError>) -> Vec<u8> {
    match result {
        Ok(v) => v.into_inner(),
        Err(e) => {
            work::attempt(B::Errors, 0, 1);
            let code = match e {
                OpeningError::InvalidInput => "invalid_input",
                OpeningError::Unsupported => "unsupported",
                OpeningError::Denied => "denied",
                OpeningError::Conflict => "conflict",
                OpeningError::Unavailable => "unavailable",
            };
            let v = Owned::constructed(|| codec::ErrorReply {
                v: work::version(),
                kind: "error".into(),
                code: code.into(),
            });
            let bytes = super::codec::emit_reply(&*v, C).expect("bounded closed error");
            drop(v);
            work::complete(B::Errors, true);
            bytes.into_inner()
        }
    }
}
