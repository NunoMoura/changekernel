//! P34-only length framing. Stored `(3,3,3)` envelopes/tags remain unchanged.
use super::bridge::{Bridge, Budget};
use super::framing::{CodecError, Result};
use super::read_variants::{WCall, WReply};
use super::wire::{self, WireSchema};
use crate::application::read::ReadReply;
use crate::application::read_budget::ReadBudget;
use crate::application::read_call::{ReadCall, ReadValue};
use prost::Message;

/// Read framing/versioning is independent of the original record format.
pub const READ_PROTOCOL_VERSION: u32 = 2;
const CALL_MAGIC: &[u8; 4] = b"CKRC";
const REPLY_MAGIC: &[u8; 4] = b"CKRR";
const CALL_MAX: usize = 64 * 1024;
const REPLY_MAX: usize = 2 * 1024 * 1024;
const HEADER: usize = 12;

fn body<'a>(bytes: &'a [u8], magic: &[u8; 4], maximum: usize) -> Result<&'a [u8]> {
    if bytes.len() < HEADER || &bytes[..4] != magic {
        return Err(CodecError::Malformed);
    }
    // Select the version from the fixed header BEFORE scanning or decoding any body.
    let version = u32::from_be_bytes(bytes[4..8].try_into().map_err(|_| CodecError::Malformed)?);
    if version != READ_PROTOCOL_VERSION {
        return Err(CodecError::Version);
    }
    let length =
        u32::from_be_bytes(bytes[8..12].try_into().map_err(|_| CodecError::Malformed)?) as usize;
    if bytes.len() > maximum {
        return Err(CodecError::Limit);
    }
    if length != bytes.len() - HEADER {
        return Err(CodecError::Malformed);
    }
    Ok(&bytes[HEADER..])
}
fn frame<W: Message + WireSchema>(w: &W, magic: &[u8; 4], maximum: usize) -> Result<Vec<u8>> {
    let size = w
        .encoded_len()
        .checked_add(HEADER)
        .ok_or(CodecError::Limit)?;
    if size > maximum {
        return Err(CodecError::Limit);
    }
    let mut out = Vec::with_capacity(size);
    out.extend_from_slice(magic);
    out.extend_from_slice(&READ_PROTOCOL_VERSION.to_be_bytes());
    out.extend_from_slice(&((size - HEADER) as u32).to_be_bytes());
    w.encode(&mut out).map_err(|_| CodecError::Malformed)?;
    wire::scan(&out[HEADER..], W::schema(), 1)?;
    Ok(out)
}

/// Encodes one read call within the 64 KiB complete-frame bound.
///
/// This is wire validation, not authorization or semantic validation of requested limits,
/// anchors, selectors or cursor bindings. A successfully encoded call may still be refused.
///
/// # Errors
///
/// Returns [`CodecError::Limit`] for frame, collection, depth or integer-conversion bounds.
/// Returns another [`CodecError`] if a value cannot be represented by the strict current
/// read schema, including an unsupported embedded source profile. No partial frame is returned.
pub fn encode_read_call(call: &ReadCall) -> Result<Vec<u8>> {
    let value = call.pack(&mut Budget::new())?;
    frame(&value, CALL_MAGIC, CALL_MAX)
}
/// Decodes exactly one bounded read call, rejecting its version before body decoding.
///
/// Success validates wire shape/presence, not current permission, historical membership,
/// semantic request limits or cursor/range correctness. The read entry checks those separately.
///
/// # Errors
///
/// Returns [`CodecError::Version`] for an unsupported outer or embedded profile and
/// [`CodecError::Limit`] for the 64 KiB frame or nested representation bounds. Other
/// [`CodecError`] variants distinguish malformed framing/Protobuf, unknown fields or enums,
/// wrong wire types, missing required presence, invalid IDs and duplicate fields/set members.
/// No partially decoded call is returned.
pub fn decode_read_call(bytes: &[u8]) -> Result<ReadCall> {
    let input = body(bytes, CALL_MAGIC, CALL_MAX)?;
    wire::scan(input, WCall::schema(), 1)?;
    ReadCall::unpack(WCall::decode(input).map_err(|_| CodecError::Malformed)?)
}
pub(crate) fn read_call_header(bytes: &[u8]) -> Result<()> {
    body(bytes, CALL_MAGIC, CALL_MAX).map(|_| ())
}
pub(crate) fn decode_read_call_bounded(bytes: &[u8], budget: &mut ReadBudget) -> Result<ReadCall> {
    let input = body(bytes, CALL_MAGIC, CALL_MAX)?;
    budget
        .work(input.len() as u64 * 64)
        .map_err(|_| CodecError::Limit)?;
    wire::scan(input, WCall::schema(), 1)?;
    let (nodes, payload) = wire::allocation_cost(input, WCall::schema(), 1)?;
    budget
        .allocate(
            nodes
                .checked_add(payload)
                .and_then(|n| n.checked_mul(16))
                .ok_or(CodecError::Limit)?,
        )
        .map_err(|_| CodecError::Limit)?;
    ReadCall::unpack(WCall::decode(input).map_err(|_| CodecError::Malformed)?)
}
/// Encodes one complete reply, including its version, coverage and continuation.
///
/// `maximum` is a complete-frame byte ceiling, never raised or satisfied by truncation.
/// The caller must reserve packing work/allocation before invoking this codec. Encoding a
/// value establishes no source integrity, authorization or completeness on its own.
///
/// # Errors
///
/// Returns [`CodecError::Limit`] if `maximum` is outside 12 bytes..=2 MiB, the complete
/// frame does not fit, or a nested representation bound is exceeded. Other [`CodecError`]
/// variants reject values incompatible with the strict current schema. These are encoding
/// failures, not encoded [`ReadReply::Refused`] values; no partial frame is returned.
pub fn encode_read_reply(reply: &ReadReply<ReadValue>, maximum: usize) -> Result<Vec<u8>> {
    if !(HEADER..=REPLY_MAX).contains(&maximum) {
        return Err(CodecError::Limit);
    }
    let value = reply.pack(&mut Budget::new())?;
    frame(&value, REPLY_MAGIC, maximum)
}
/// Decodes exactly one bounded reply, not evidence of source integrity or current authority.
///
/// An encoded [`ReadReply::Refused`] decodes successfully as `Ok(ReadReply::Refused(_))`.
/// Returned empty Content is data, not refusal. Decoding alone does not verify a reply's
/// claimed history, coverage or membership.
///
/// # Errors
///
/// Returns [`CodecError::Version`] for an unsupported outer or embedded profile and
/// [`CodecError::Limit`] for the 2 MiB complete-frame or nested representation bounds.
/// Other [`CodecError`] variants reject malformed framing/Protobuf, unknown fields/enums,
/// wrong wire types, missing required presence, invalid IDs and duplicate fields/set members.
/// An error is neither a valid refusal nor an empty page; no partial reply is returned.
pub fn decode_read_reply(bytes: &[u8]) -> Result<ReadReply<ReadValue>> {
    let input = body(bytes, REPLY_MAGIC, REPLY_MAX)?;
    wire::scan(input, WReply::schema(), 1)?;
    ReadReply::<ReadValue>::unpack(WReply::decode(input).map_err(|_| CodecError::Malformed)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::operation_request::CURRENT_PROFILE;
    use crate::application::read::{
        ChangePosition, ChangeRange, OperationKind, ReadChangeRequest, ReadLimits, ReadSource,
        RecordMatch, RecordSelection,
    };
    use crate::kernel::change::{ActorId, ChangeId, Identity, LedgerId, OwnerId};
    use std::collections::BTreeSet;
    #[test]
    fn nested_typed_duplicate_sets_and_missing_meaningful_fields_are_not_silently_normalized() {
        let identity = Identity {
            owner: OwnerId::from_bytes([1; 16]).expect("nonzero"),
            owner_actor: ActorId::from_bytes([2; 16]).expect("nonzero"),
            ledger: LedgerId::from_bytes([3; 16]).expect("nonzero"),
            change: ChangeId::from_bytes([4; 16]).expect("nonzero"),
            agent: ActorId::from_bytes([5; 16]).expect("nonzero"),
        };
        let position = ChangePosition {
            source: ReadSource {
                identity: identity.clone(),
                profile: CURRENT_PROFILE,
            },
            sequence: 0,
            operation: None,
        };
        let call = ReadCall::Change(Box::new(ReadChangeRequest {
            change: identity.change_key(),
            range: ChangeRange {
                after: position.clone(),
                through: position,
            },
            selection: RecordSelection::MatchingRecords(RecordMatch {
                kinds: BTreeSet::from([OperationKind::Start]),
                ..RecordMatch::default()
            }),
            page_cursor: None,
            limits: ReadLimits::default(),
        }));
        let mut w = call.pack(&mut Budget::new()).expect("wire value");
        let matcher = w
            .change
            .as_mut()
            .expect("change")
            .selection
            .as_mut()
            .expect("selection")
            .matching
            .as_mut()
            .expect("matcher");
        matcher.kinds.push(1);
        let bytes =
            frame(&w, CALL_MAGIC, CALL_MAX).expect("structurally legal protobuf duplicate set");
        assert_eq!(decode_read_call(&bytes), Err(CodecError::Duplicate));
        let mut w = call.pack(&mut Budget::new()).expect("wire value");
        w.change
            .as_mut()
            .expect("change")
            .range
            .as_mut()
            .expect("range")
            .after
            .as_mut()
            .expect("after")
            .source
            .as_mut()
            .expect("source")
            .profile = None;
        let bytes = w.encode_to_vec();
        let mut malformed = CALL_MAGIC.to_vec();
        malformed.extend_from_slice(&READ_PROTOCOL_VERSION.to_be_bytes());
        malformed.extend_from_slice(&(bytes.len() as u32).to_be_bytes());
        malformed.extend(bytes);
        assert_eq!(decode_read_call(&malformed), Err(CodecError::Presence));
    }
}
