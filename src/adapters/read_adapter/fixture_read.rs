//! One fixture-backed call. The private single-use callback is only a test injection seam.
use super::adapter_error::AdapterError;
use super::request;
use super::response;
use super::work::{self, Work};
use crate::adapters::codec::{self, CodecError};
use crate::adapters::sqlite::{self, OriginalReference, ReadDisclosure, TrustedLocal};
use crate::application::read_budget::ReadWorkLimits;
use crate::kernel::change::Identity;
use serde_json::Value;
use std::path::Path;

/// Converts and executes exactly one fixture read, returning a real structured JSON value.
///
/// This is an unqualified fixture harness, not a host API or authenticated service. Trusted
/// Rust wiring supplies the Included original, current owner-role/disclosure observations,
/// custody and verification directory. JSON cannot supply these or impersonate an owner.
/// The existing P34 entry performs source/permission checks; decoding or matching an echo
/// alone establishes neither. No paging, retry, fetch, cache or native action is added.
///
/// # Representation
///
/// Exactly one externally tagged call is required:
/// - `ResolveChangeCursor`: `change`, `anchor`, `limits`.
/// - `ReadChange`: `change`, `range`, `selection`, `page_cursor`, `limits`.
/// - `ReadContent`: `membership`, `limits`.
///
/// Change keys contain `owner`, `ledger`, `change`. Every ID is 32 lowercase nonzero hex
/// digits. Memberships contain `identity`, `operation`, `content`; identity additionally
/// contains `owner_actor` and `agent`, and Content keys contain `establishing` and `id`.
/// Positions/ranges/cursors use exactly the returned public fields. Nullable fields are
/// required, with explicit `null` for absence. Wide integers (sequences and generations)
/// are canonical unsigned decimal strings; limits/profile integers are JSON u32 numbers.
///
/// Anchors are `"Beginning"`, `"Current"`, `{"Operation": id}` or `{"Sequence": "0"}`.
/// Selection is `"AllRecords"` or `{"MatchingRecords": {...}}` with all four array fields:
/// `kinds`, `operations`, `actors`, `references`. References are externally tagged Change,
/// Operation, Content, Membership or GroundObservation with their qualified public fields.
/// Every named record, including nested records and non-null cursors, must be a JSON
/// object, never a positional array. Only the four selector collections above are arrays.
/// Duplicates, unknown fields/variants and missing fields are errors, not defaults.
///
/// Results are `{"Returned": {"Position"|"Change"|"Content": value}}` or
/// `{"Refused": reason}`. Public semantic enums retain explicit variant names and fields.
/// Content and source-claim limitation bytes are `{"encoding":"utf8","data":text}` when
/// valid UTF-8, otherwise `{"encoding":"hex","data":lowercase_hex}`. No normalization
/// or lossy replacement occurs; an empty utf8 string is successful empty Content.
///
/// # Bounds
///
/// Input JSON is at most 32 KiB. The backend construction ceiling is tightened to 128 KiB
/// (P34's conservative page estimator itself reserves 64 KiB); actual frames above 32 KiB
/// fail before decoding. Compact JSON, including its complete envelope, must fit both the
/// caller's original reply ceiling and 128 KiB. Larger valid P34 results may therefore fail.
/// Projection is capped at 8192 nodes and 16 MiB reserved allocation, with two additional
/// complete byte buffers reserved. Codec/Serde work is conservatively prepaid before entry.
/// Total adapter reservations are at most 1536 MiB allocation and 64 Mi work units, debited
/// from `work` before passing its remainder to P34. Source/I/O ceilings are unchanged.
/// These are cumulative reservations, not RSS guarantees. Separate maxima are not a promise
/// that their combination fits: maximum-sized JSON plus the reserved maximum reply is refused
/// before the backend. This availability loss is deliberate; no partial result is released.
///
/// # Errors
///
/// [`AdapterError`] distinguishes malformed structured input, bounds, request/backend/reply
/// codec failures and inconsistent reply bindings. Errors carry no private paths or input
/// text. A decoded semantic refusal remains a successful `Value` with `Refused`, never an
/// adapter error or empty success. Even a refusal must fit the complete output ceiling.
///
/// # Example
///
/// ```no_run
/// # use changekernel::adapters::read_adapter::{self, AdapterError};
/// # use changekernel::adapters::sqlite::{OriginalReference, ReadDisclosure, TrustedLocal};
/// # use changekernel::unqualified_change::ReadWorkLimits;
/// # use std::path::Path;
/// # fn example<B: TrustedLocal>(reference: &OriginalReference, fixture: &mut B, stage: &Path)
/// # -> Result<(), AdapterError> where for<'g> B::Guard<'g>: ReadDisclosure {
/// let request = br#"{"ResolveChangeCursor":{
///   "change":{"owner":"01010101010101010101010101010101",
///             "ledger":"03030303030303030303030303030303",
///             "change":"04040404040404040404040404040404"},
///   "anchor":"Beginning",
///   "limits":{"scanned_records":32,"returned_records":16,"reply_bytes":4096}
/// }}"#;
/// let reply = read_adapter::read_fixture(reference, fixture, stage, request, ReadWorkLimits::default())?;
/// // A structured Refused is not an empty successful read.
/// if let Some(reason) = reply.get("Refused") { eprintln!("read refused: {reason}"); }
/// # Ok(()) }
/// ```
pub fn read_fixture<B: TrustedLocal>(
    reference: &OriginalReference,
    boundary: &mut B,
    verification: &Path,
    request: &[u8],
    work: ReadWorkLimits,
) -> Result<Value, AdapterError>
where
    for<'guard> B::Guard<'guard>: ReadDisclosure,
{
    run(request, reference.identity(), work, |frame, remaining| {
        sqlite::read_local_framed(reference, boundary, verification, frame, remaining)
    })
}

fn run(
    bytes: &[u8],
    identity: &Identity,
    work: ReadWorkLimits,
    invoke: impl FnOnce(&[u8], ReadWorkLimits) -> Result<Vec<u8>, CodecError>,
) -> Result<Value, AdapterError> {
    let mut budget = Work::try_new(work)?;
    let mut call = request::decode(bytes, &mut budget)?;
    let requested = response::limits(&call);
    response::tighten(&mut call);
    budget.reply(work::REPLY_FRAME_BYTES.min(requested.reply_bytes))?;
    budget.output()?;
    let frame = codec::encode_read_call(&call).map_err(|_| AdapterError::RequestCodec)?;
    let response = invoke(&frame, budget.remaining()?).map_err(|_| AdapterError::BackendCodec)?;
    response::decode(&response, &call, identity, requested.reply_bytes)
}

#[cfg(test)]
#[path = "fixture_read_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "request_shape_tests.rs"]
mod shape_tests;

#[cfg(test)]
#[path = "content_pipeline_tests.rs"]
mod content_tests;
