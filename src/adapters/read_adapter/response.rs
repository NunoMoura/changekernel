//! Call-relative checks are consistency checks, never source authentication or permission.
use super::adapter_error::AdapterError;
use super::projection::Projection;
use super::work;
use crate::adapters::codec;
use crate::application::operation_request::CURRENT_PROFILE;
use crate::application::read::{
    ChangeAnchor, ChangePageCursor, ChangePosition, ChangeProgress, ReadLimits, ReadRefusal,
    ReadReply,
};
use crate::application::read_call::{ReadCall, ReadValue};
use crate::kernel::change::Identity;
use serde_json::Value;

pub(super) fn limits(call: &ReadCall) -> ReadLimits {
    match call {
        ReadCall::Resolve { limits, .. } | ReadCall::Content { limits, .. } => *limits,
        ReadCall::Change(request) => request.limits,
    }
}
pub(super) fn tighten(call: &mut ReadCall) {
    let limits = match call {
        ReadCall::Resolve { limits, .. } | ReadCall::Content { limits, .. } => limits,
        ReadCall::Change(request) => &mut request.limits,
    };
    // Invalid limits belong to P34's refusal path, not to a repaired valid request.
    if limits.validate().is_ok() {
        limits.reply_bytes = limits.reply_bytes.min(work::BACKEND_REPLY_BYTES);
    }
}
fn position(value: &ChangePosition, identity: &Identity) -> bool {
    value.source.identity == *identity
        && value.source.profile == CURRENT_PROFILE
        && ((value.sequence == 0) == value.operation.is_none())
}
fn same_position_when_equal(a: &ChangePosition, b: &ChangePosition) -> bool {
    a.sequence != b.sequence || a == b
}
fn cursor(
    value: &ChangePageCursor,
    request: &crate::application::read::ReadChangeRequest,
    through: &ChangePosition,
    identity: &Identity,
) -> bool {
    value.range == request.range
        && value.selection == request.selection
        && value.last_scanned == *through
        && value.permission_scope == request.change
        && value.reader == identity.owner_actor
}
fn check(call: &ReadCall, value: &ReadValue, identity: &Identity) -> Result<(), AdapterError> {
    let valid = match (call, value) {
        (ReadCall::Resolve { change, anchor, .. }, ReadValue::Position(p)) => {
            *change == identity.change_key()
                && position(p, identity)
                && match anchor {
                    ChangeAnchor::Beginning => p.sequence == 0,
                    ChangeAnchor::Current => true,
                    ChangeAnchor::Sequence(n) => p.sequence == *n,
                    ChangeAnchor::Operation(id) => p.operation.as_ref() == Some(id),
                }
        }
        (ReadCall::Content { membership, .. }, ReadValue::Content(_)) => {
            membership.identity == *identity
        }
        (ReadCall::Change(request), ReadValue::Change(page)) => {
            let start = request
                .page_cursor
                .as_ref()
                .map_or(&request.range.after, |c| &c.last_scanned);
            let mut previous = page.scanned.after.sequence;
            let records = page.records.iter().all(|r| {
                let ordered = r.position.sequence > previous;
                previous = r.position.sequence;
                ordered
                    && r.position.sequence <= page.scanned.through.sequence
                    && position(&r.position, identity)
                    && r.position.operation.as_ref() == Some(&r.accepted.operation)
                    && same_position_when_equal(&r.position, &page.scanned.through)
                    && same_position_when_equal(&r.position, &page.observed_head)
                    && r.memberships.iter().all(|m| {
                        m.reference.identity == *identity
                            && m.reference.operation == r.accepted.operation
                    })
            });
            let interval = page.scanned.through.sequence.checked_sub(start.sequence);
            request.change == identity.change_key()
                && position(&request.range.after, identity)
                && position(&request.range.through, identity)
                && page.scanned.after == *start
                && position(start, identity)
                && position(&page.scanned.through, identity)
                && request
                    .page_cursor
                    .as_ref()
                    .is_none_or(|c| cursor(c, request, start, identity))
                && position(&page.observed_head, identity)
                && request.range.after.sequence <= start.sequence
                && page.scanned.through.sequence <= request.range.through.sequence
                && page.observed_head.sequence >= request.range.through.sequence
                && interval.is_some_and(|n| n <= request.limits.scanned_records as u64)
                && page.records.len() <= request.limits.returned_records
                && records
                && (request.selection != crate::application::read::RecordSelection::AllRecords
                    || interval == Some(page.records.len() as u64))
                && same_position_when_equal(&request.range.after, &request.range.through)
                && same_position_when_equal(&page.scanned.after, &page.scanned.through)
                && same_position_when_equal(&page.observed_head, &request.range.through)
                && (page.scanned.through.sequence != request.range.through.sequence
                    || page.scanned.through == request.range.through)
                && match &page.progress {
                    ChangeProgress::EndOfRange => page.scanned.through == request.range.through,
                    ChangeProgress::More { next_page_cursor } => {
                        page.scanned.through.sequence > start.sequence
                            && page.scanned.through.sequence < request.range.through.sequence
                            && cursor(next_page_cursor, request, &page.scanned.through, identity)
                    }
                }
        }
        _ => false,
    };
    if valid {
        Ok(())
    } else {
        Err(AdapterError::ReplyMismatch)
    }
}

pub(super) fn decode(
    frame: &[u8],
    call: &ReadCall,
    identity: &Identity,
    output_maximum: usize,
) -> Result<Value, AdapterError> {
    // Work/allocation for the whole accepted frame was prepaid before calling P34.
    // Refuse larger frames before invoking the codec, even if P34 could return them.
    if frame.len() > work::REPLY_FRAME_BYTES || frame.len() > limits(call).reply_bytes {
        return Err(AdapterError::Limit);
    }
    let reply = codec::decode_read_reply(frame).map_err(|_| AdapterError::ReplyCodec)?;
    if let ReadReply::Returned(value) = &reply {
        check(call, value, identity)?;
    }
    project(&reply, output_maximum)
}

pub(super) fn project(reply: &ReadReply<ReadValue>, maximum: usize) -> Result<Value, AdapterError> {
    let projection = Projection::new(maximum);
    match reply {
        ReadReply::Refused(reason) => projection.object([(
            "Refused",
            projection.text(match reason {
                ReadRefusal::Denied => "Denied",
                ReadRefusal::Invalid => "Invalid",
                ReadRefusal::Changed => "Changed",
                ReadRefusal::Unavailable => "Unavailable",
                ReadRefusal::Limit => "Limit",
                ReadRefusal::Unsupported => "Unsupported",
            })?,
        )]),
        ReadReply::Returned(value) => {
            let value = match value {
                ReadValue::Position(position) => {
                    projection.object([("Position", projection.position(position)?)])?
                }
                ReadValue::Change(page) => {
                    projection.object([("Change", projection.page(page)?)])?
                }
                ReadValue::Content(bytes) => {
                    projection.object([("Content", projection.bytes(bytes)?)])?
                }
            };
            projection.object([("Returned", value)])
        }
    }
}

// Public read wrappers supplement the existing codec's stored wire/domain size assertions.
const _: () = assert!(std::mem::size_of::<crate::application::read::PublicRecord>() <= 4096);
const _: () = assert!(std::mem::size_of::<crate::application::read::ReadChangeRequest>() <= 4096);
const _: () = assert!(std::mem::size_of::<ChangePageCursor>() <= 4096);

#[cfg(test)]
#[path = "response_tests.rs"]
mod tests;
