//! Unqualified Linux/Btrfs trusted-local persistence. No H/source authentication or host execution.
mod backend;
mod cold_read;
mod control;
mod custody;
mod local;
mod native_read_budget;
mod native_read_shape;
mod original;
mod ports;
mod preflight;
mod prepared_operation_request;
mod read;
mod records;
mod register;
mod schema;
mod store_error;
#[cfg(test)]
mod tests;

pub use cold_read::{read_local, read_local_framed};
pub use custody::{CustodyBinding, WriterCustody};
pub use local::{CustodyUse, LedgerIdentity, LocalGuard, RetainedSource, TrustedLocal};
pub use original::{Original, OriginalOutcome, OriginalReference};
pub use prepared_operation_request::PreparedOperationRequest;
pub use read::{ReadContext, ReadDisclosure};
pub use register::{
    CreationIntent, CreationProgress, Register, RegisterReference, RegisterSelection,
};
pub use store_error::{StoreError, StoreResult};
