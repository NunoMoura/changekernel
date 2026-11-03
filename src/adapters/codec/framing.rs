//! Strict bounded current-format length-framed Protobuf. Original raw frames remain store-owned.
//! Typed equality, not reserialization/canonical bytes, identifies an unchanged retry.
use super::bridge::{self, Budget};
use super::typed::{WOperationRequest, WRecordFrame, WRequestFrame, WStoredOperation};
use super::wire::{self, WireSchema};
use crate::application::operation_request::{OperationRequest, CURRENT_PROFILE};
use crate::application::read_budget::ReadBudget;
use crate::application::records::StoredOperation;
use prost::Message;

pub const CODEC_VERSION: u32 = CURRENT_PROFILE.codec;
pub const SCHEMA_VERSION: u32 = CURRENT_PROFILE.schema;
pub(super) const MAX_FRAME: usize = 16 * 1024 * 1024;
pub(super) const MAX_CONTENT: usize = 1024 * 1024;
pub(super) const MAX_REPEATED: usize = 4096;
pub(super) const MAX_DEPTH: usize = 32;
const RECORD_MAGIC: &[u8; 4] = b"CKR\0";
const REQUEST_MAGIC: &[u8; 4] = b"CKQ\0";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CodecError {
    Malformed,
    Limit,
    Version,
    UnknownField,
    Wire,
    Enum,
    Id,
    Presence,
    Duplicate,
}
impl std::fmt::Display for CodecError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Malformed => "malformed encoding",
            Self::Limit => "encoding size or resource limit exceeded",
            Self::Version => "unsupported encoding version",
            Self::UnknownField => "unknown encoded field",
            Self::Wire => "invalid wire type or value",
            Self::Enum => "unknown enum value",
            Self::Id => "invalid identifier",
            Self::Presence => "missing or conflicting field presence",
            Self::Duplicate => "duplicate field, key or set member",
        })
    }
}
impl std::error::Error for CodecError {}
pub(super) type Result<T> = std::result::Result<T, CodecError>;

fn body<'a>(frame: &'a [u8], magic: &[u8; 4]) -> Result<&'a [u8]> {
    if frame.len() > MAX_FRAME {
        return Err(CodecError::Limit);
    }
    if frame.len() < 8 || &frame[..4] != magic {
        return Err(CodecError::Malformed);
    }
    let length =
        u32::from_be_bytes(frame[4..8].try_into().map_err(|_| CodecError::Malformed)?) as usize;
    if length != frame.len() - 8 {
        return Err(CodecError::Malformed);
    }
    Ok(&frame[8..])
}
fn frame<W: Message + WireSchema>(value: &W, magic: &[u8; 4]) -> Result<Vec<u8>> {
    let len = value.encoded_len();
    if len.checked_add(8).ok_or(CodecError::Limit)? > MAX_FRAME {
        return Err(CodecError::Limit);
    }
    let mut out = Vec::with_capacity(len + 8);
    out.extend_from_slice(magic);
    out.extend_from_slice(&(len as u32).to_be_bytes());
    value.encode(&mut out).map_err(|_| CodecError::Malformed)?;
    // Validate structural encoding too; this is NOT a canonical/re-encode equality check.
    wire::scan(&out[8..], W::schema(), 1)?;
    Ok(out)
}

pub fn encode_record(record: &StoredOperation) -> Result<Vec<u8>> {
    if !record.profile.is_current() {
        return Err(CodecError::Version);
    }
    let mut budget = Budget::new();
    let value = WRecordFrame {
        codec_version: Some(record.profile.codec),
        schema_version: Some(record.profile.schema),
        semantic_version: Some(record.profile.semantic),
        payload: Some(WStoredOperation::pack(record, &mut budget)?),
    };
    frame(&value, RECORD_MAGIC)
}
pub fn decode_record(bytes: &[u8]) -> Result<StoredOperation> {
    let input = body(bytes, RECORD_MAGIC)?;
    let profile = wire::envelope(input)?;
    wire::scan(input, WRecordFrame::schema(), 1)?;
    let value: WRecordFrame = Message::decode(input).map_err(|_| CodecError::Malformed)?;
    WStoredOperation::unpack(bridge::required(value.payload)?, profile)
}
const _: () = assert!(std::mem::size_of::<WStoredOperation>() <= 4096);
const _: () = assert!(std::mem::size_of::<StoredOperation>() <= 4096);

/// Weight only public semantic/provenance spans. Retained/fresh payload bytes, Context,
/// private grants and acceptance controls do not consume public item availability.
pub(crate) fn public_record_weight(bytes: &[u8]) -> Result<usize> {
    let input = body(bytes, RECORD_MAGIC)?;
    let mut weight = 0usize;
    wire::message_fields(input, |tag, record| {
        if tag != 4 {
            return Ok(());
        }
        wire::message_fields(record, |tag, part| {
            match tag {
                4 | 6 => {
                    weight = weight.checked_add(part.len()).ok_or(CodecError::Limit)?;
                }
                3 => wire::message_fields(part, |tag, op| {
                    if tag == 2 {
                        weight = weight.checked_add(op.len()).ok_or(CodecError::Limit)?;
                    }
                    if tag == 3 {
                        wire::message_fields(op, |tag, fresh| {
                            if tag != 2 {
                                weight =
                                    weight.checked_add(fresh.len()).ok_or(CodecError::Limit)?;
                            }
                            Ok(())
                        })?;
                    }
                    Ok(())
                })?,
                5 => wire::message_fields(part, |tag, checks| {
                    match tag {
                        8..=11 => {
                            weight = weight.checked_add(checks.len()).ok_or(CodecError::Limit)?;
                        }
                        6 => wire::message_fields(checks, |tag, creation| {
                            if tag == 2 {
                                wire::message_fields(creation, |tag, entry| {
                                    if tag == 2 {
                                        wire::message_fields(entry, |tag, recorded| {
                                            if tag == 2 {
                                                weight = weight
                                                    .checked_add(recorded.len())
                                                    .ok_or(CodecError::Limit)?;
                                            }
                                            Ok(())
                                        })?;
                                    }
                                    Ok(())
                                })?;
                            }
                            Ok(())
                        })?,
                        _ => {}
                    }
                    Ok(())
                })?,
                _ => {}
            }
            Ok(())
        })
    })?;
    Ok(weight)
}
pub(crate) fn record_read_cost(bytes: &[u8], budget: &mut ReadBudget) -> Result<u64> {
    let input = body(bytes, RECORD_MAGIC)?;
    wire::envelope(input)?;
    budget
        .work((input.len() as u64) * 64)
        .map_err(|_| CodecError::Limit)?;
    wire::scan(input, WRecordFrame::schema(), 1)?;
    let (nodes, payload) = wire::allocation_cost(input, WRecordFrame::schema(), 1)?;
    let cost = nodes.checked_add(payload).ok_or(CodecError::Limit)?;
    // Vec growth <=2; B-tree insertion can allocate a complete 11-slot node on its first
    // element. Sixteen slots cover both plus node/child-array overhead before conversion.
    budget
        .allocate(cost.checked_mul(16).ok_or(CodecError::Limit)?)
        .map_err(|_| CodecError::Limit)?;
    Ok(cost)
}
pub(crate) fn request_read_cost(bytes: &[u8], budget: &mut ReadBudget) -> Result<u64> {
    let input = body(bytes, REQUEST_MAGIC)?;
    wire::envelope(input)?;
    budget
        .work((input.len() as u64) * 64)
        .map_err(|_| CodecError::Limit)?;
    wire::scan(input, WRequestFrame::schema(), 1)?;
    let (nodes, payload) = wire::allocation_cost(input, WRequestFrame::schema(), 1)?;
    let cost = nodes.checked_add(payload).ok_or(CodecError::Limit)?;
    budget
        .allocate(cost.checked_mul(16).ok_or(CodecError::Limit)?)
        .map_err(|_| CodecError::Limit)?;
    Ok(cost)
}
pub fn encode_request(operation_request: &OperationRequest) -> Result<Vec<u8>> {
    if !operation_request.profile.is_current() {
        return Err(CodecError::Version);
    }
    let mut budget = Budget::new();
    let value = WRequestFrame {
        codec_version: Some(operation_request.profile.codec),
        schema_version: Some(operation_request.profile.schema),
        semantic_version: Some(operation_request.profile.semantic),
        payload: Some(WOperationRequest::pack(operation_request, &mut budget)?),
    };
    frame(&value, REQUEST_MAGIC)
}
pub fn decode_request(bytes: &[u8]) -> Result<OperationRequest> {
    let input = body(bytes, REQUEST_MAGIC)?;
    let profile = wire::envelope(input)?;
    wire::scan(input, WRequestFrame::schema(), 1)?;
    let value: WRequestFrame = Message::decode(input).map_err(|_| CodecError::Malformed)?;
    WOperationRequest::unpack(bridge::required(value.payload)?, profile)
}
