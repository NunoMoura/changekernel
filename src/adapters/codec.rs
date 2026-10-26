//! Strict bounded current-format length-framed Protobuf. Original raw frames remain store-owned.
//! Typed equality, not reserialization/canonical bytes, identifies an unchanged retry.
mod bridge;
mod typed;
mod wire;
use crate::unqualified_pursuit::{StoredOperation, Submission, SubmissionProfile, CURRENT_PROFILE};
use bridge::Budget;
use prost::Message;
use typed::{WRecordFrame, WRequestFrame, WStoredOperation, WSubmission};
use wire::WireSchema;

pub const CODEC_VERSION: u32 = CURRENT_PROFILE.codec;
pub const SCHEMA_VERSION: u32 = CURRENT_PROFILE.schema;
const MAX_FRAME: usize = 16 * 1024 * 1024;
const MAX_MATERIAL: usize = 1024 * 1024;
const MAX_REPEATED: usize = 4096;
const MAX_DEPTH: usize = 32;
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
type Result<T> = std::result::Result<T, CodecError>;

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
pub fn encode_request(submission: &Submission) -> Result<Vec<u8>> {
    if !submission.profile.is_current() {
        return Err(CodecError::Version);
    }
    let mut budget = Budget::new();
    let value = WRequestFrame {
        codec_version: Some(submission.profile.codec),
        schema_version: Some(submission.profile.schema),
        semantic_version: Some(submission.profile.semantic),
        payload: Some(WSubmission::pack(submission, &mut budget)?),
    };
    frame(&value, REQUEST_MAGIC)
}
pub fn decode_request(bytes: &[u8]) -> Result<Submission> {
    let input = body(bytes, REQUEST_MAGIC)?;
    let profile = wire::envelope(input)?;
    wire::scan(input, WRequestFrame::schema(), 1)?;
    let value: WRequestFrame = Message::decode(input).map_err(|_| CodecError::Malformed)?;
    WSubmission::unpack(bridge::required(value.payload)?, profile)
}
