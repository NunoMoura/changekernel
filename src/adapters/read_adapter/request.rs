//! Only three structured calls, with explicit fields and no authority/path inputs.
use super::adapter_error::AdapterError;
use super::object_record::impl_object_record;
use super::request_values::{self, Cursor, Decimal, Id, Key, Limits, Membership, Range, Selection};
use super::work::Work;
use crate::application::read::{ChangeAnchor, ReadChangeRequest};
use crate::application::read_call::ReadCall;
use crate::kernel::change::OperationId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
enum Anchor {
    Beginning,
    Current,
    Operation(Id),
    Sequence(Decimal),
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Resolve {
    change: Key,
    anchor: Anchor,
    limits: Limits,
}
impl_object_record!(Resolve);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct History {
    change: Key,
    range: Range,
    selection: Selection,
    #[serde(deserialize_with = "request_values::required_option")]
    page_cursor: Option<Cursor>,
    limits: Limits,
}
impl_object_record!(History);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Content {
    membership: Membership,
    limits: Limits,
}
impl_object_record!(Content);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
enum Request {
    ResolveChangeCursor(Resolve),
    ReadChange(Box<History>),
    ReadContent(Content),
}

pub(super) fn decode(bytes: &[u8], work: &mut Work) -> Result<ReadCall, AdapterError> {
    work.request(bytes.len())?;
    // from_slice requires EOF. Named DTOs enter through map-only visitors; the
    // derived map handling rejects duplicate/unknown fields without an input tree.
    // Nullable semantic fields use required_option: missing is not silently null.
    let request: Request =
        serde_json::from_slice(bytes).map_err(|_| AdapterError::InvalidRequest)?;
    Ok(match request {
        Request::ResolveChangeCursor(r) => ReadCall::Resolve {
            change: r.change.into_domain()?,
            anchor: match r.anchor {
                Anchor::Beginning => ChangeAnchor::Beginning,
                Anchor::Current => ChangeAnchor::Current,
                Anchor::Operation(id) => ChangeAnchor::Operation(
                    OperationId::from_bytes(id.0).map_err(|_| AdapterError::InvalidRequest)?,
                ),
                Anchor::Sequence(n) => ChangeAnchor::Sequence(n.0),
            },
            limits: r.limits.into_domain()?,
        },
        Request::ReadChange(r) => ReadCall::Change(Box::new(ReadChangeRequest {
            change: r.change.into_domain()?,
            range: r.range.into_domain()?,
            selection: r.selection.into_domain()?,
            page_cursor: r.page_cursor.map(Cursor::into_domain).transpose()?,
            limits: r.limits.into_domain()?,
        })),
        Request::ReadContent(r) => ReadCall::Content {
            membership: r.membership.into_domain()?,
            limits: r.limits.into_domain()?,
        },
    })
}

#[cfg(test)]
#[path = "request_tests.rs"]
mod tests;
