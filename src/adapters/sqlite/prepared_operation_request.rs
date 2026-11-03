//! Immutable caller-retained operation request bytes and their typed declaration.
use super::store_error::{StoreError, StoreResult};
use crate::adapters::codec;
use crate::adapters::codec::CodecError;
use crate::application::operation_request::OperationRequest;
use crate::kernel::change::Error;

/// Immutable original caller bytes plus typed identity. Caller retention is external and required.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreparedOperationRequest {
    pub(super) raw: Vec<u8>,
    pub(super) typed: OperationRequest,
}
impl PreparedOperationRequest {
    pub fn from_frame(bytes: &[u8]) -> StoreResult<Self> {
        let typed = codec::decode_request(bytes).map_err(|e| match e {
            CodecError::Version => StoreError::UnsupportedProfile,
            CodecError::Limit => StoreError::Limit,
            _ => StoreError::Refused(Error::Invalid),
        })?;
        Ok(Self {
            raw: bytes.to_vec(),
            typed,
        })
    }
    pub fn from_operation_request(value: &OperationRequest) -> StoreResult<Self> {
        Self::from_frame(&codec::encode_request(value).map_err(|_| StoreError::Limit)?)
    }
    pub fn frame(&self) -> &[u8] {
        &self.raw
    }
    pub fn operation_request(&self) -> &OperationRequest {
        &self.typed
    }
}
