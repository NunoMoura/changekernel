//! Failures outside a successfully decoded semantic read reply.
use serde::{Deserialize, Serialize};
use std::fmt;

/// Adapter failures never stand for a semantic refusal, empty data or partial coverage.
/// Messages carry no request text, source locations or private policy observations.
/// See [`super::read_fixture`] for the complete call contract and example.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[non_exhaustive]
#[must_use]
pub enum AdapterError {
    /// Malformed JSON, unknown/missing/duplicate fields, or an invalid scalar/set member.
    InvalidRequest,
    /// An adapter input, representation, work, allocation or complete-output bound failed.
    Limit,
    /// The typed request could not be encoded by the existing read protocol.
    RequestCodec,
    /// The fixture read entry failed to return a complete protocol frame.
    BackendCodec,
    /// The reply was not a valid current read-protocol frame.
    ReplyCodec,
    /// A decoded reply disagreed with the call's kind or fixed source/range bindings.
    ReplyMismatch,
}

impl fmt::Display for AdapterError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidRequest => "invalid structured read request",
            Self::Limit => "read adapter limit exceeded",
            Self::RequestCodec => "read request encoding failed",
            Self::BackendCodec => "fixture read protocol failed",
            Self::ReplyCodec => "read reply decoding failed",
            Self::ReplyMismatch => "read reply does not match call",
        })
    }
}

impl std::error::Error for AdapterError {}
