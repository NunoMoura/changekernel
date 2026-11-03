//! The finite request schema. Serde parses it directly, never through an input Value tree.
use super::adapter_error::AdapterError;
use super::object_record::impl_object_record;
use crate::application::operation_request::OperationRequestProfile;
use crate::application::read::{
    ActorReference, ChangePageCursor, ChangePosition, ChangeRange, OperationKind,
    OperationReference, QualifiedReference, ReadLimits, ReadSource, RecordMatch, RecordSelection,
};
use crate::kernel::change::{
    ActorId, ChangeId, ChangeKey, ContentId, ContentKey, ContentReference, GroundId, GroundVersion,
    Identity, LedgerId, OperationId, OwnerId,
};
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::BTreeSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub(super) struct Id(pub(super) [u8; 16]);

impl TryFrom<String> for Id {
    type Error = AdapterError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.len() != 32
            || !value
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(AdapterError::InvalidRequest);
        }
        let mut bytes = [0; 16];
        for (index, byte) in bytes.iter_mut().enumerate() {
            *byte = u8::from_str_radix(&value[index * 2..index * 2 + 2], 16)
                .map_err(|_| AdapterError::InvalidRequest)?;
        }
        if bytes == [0; 16] {
            return Err(AdapterError::InvalidRequest);
        }
        Ok(Self(bytes))
    }
}
impl From<Id> for String {
    fn from(id: Id) -> Self {
        use std::fmt::Write;
        let mut text = String::with_capacity(32);
        for byte in id.0 {
            write!(text, "{byte:02x}").expect("writing to a String cannot fail");
        }
        text
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub(super) struct Decimal(pub(super) u64);
impl TryFrom<String> for Decimal {
    type Error = AdapterError;
    fn try_from(value: String) -> Result<Self, Self::Error> {
        if value.is_empty()
            || value.len() > 20
            || !value.bytes().all(|b| b.is_ascii_digit())
            || (value.len() > 1 && value.starts_with('0'))
        {
            return Err(AdapterError::InvalidRequest);
        }
        value
            .parse()
            .map(Self)
            .map_err(|_| AdapterError::InvalidRequest)
    }
}
impl From<Decimal> for String {
    fn from(value: Decimal) -> Self {
        value.0.to_string()
    }
}

// deserialize_with makes a nullable field REQUIRED, rather than treating omission as None.
pub(super) fn required_option<'de, D, T>(deserializer: D) -> Result<Option<T>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::deserialize(deserializer)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Key {
    owner: Id,
    ledger: Id,
    change: Id,
}
impl_object_record!(Key);
impl Key {
    pub(super) fn into_domain(self) -> Result<ChangeKey, AdapterError> {
        Ok(ChangeKey {
            owner: OwnerId::from_bytes(self.owner.0).map_err(|_| AdapterError::InvalidRequest)?,
            ledger: LedgerId::from_bytes(self.ledger.0)
                .map_err(|_| AdapterError::InvalidRequest)?,
            change: ChangeId::from_bytes(self.change.0)
                .map_err(|_| AdapterError::InvalidRequest)?,
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Subject {
    owner: Id,
    owner_actor: Id,
    ledger: Id,
    change: Id,
    agent: Id,
}
impl_object_record!(Subject);
impl Subject {
    fn into_domain(self) -> Result<Identity, AdapterError> {
        Ok(Identity {
            owner: OwnerId::from_bytes(self.owner.0).map_err(|_| AdapterError::InvalidRequest)?,
            owner_actor: ActorId::from_bytes(self.owner_actor.0)
                .map_err(|_| AdapterError::InvalidRequest)?,
            ledger: LedgerId::from_bytes(self.ledger.0)
                .map_err(|_| AdapterError::InvalidRequest)?,
            change: ChangeId::from_bytes(self.change.0)
                .map_err(|_| AdapterError::InvalidRequest)?,
            agent: ActorId::from_bytes(self.agent.0).map_err(|_| AdapterError::InvalidRequest)?,
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Content {
    establishing: Key,
    id: Id,
}
impl_object_record!(Content);
impl Content {
    fn into_domain(self) -> Result<ContentKey, AdapterError> {
        Ok(ContentKey {
            establishing: self.establishing.into_domain()?,
            id: ContentId::from_bytes(self.id.0).map_err(|_| AdapterError::InvalidRequest)?,
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Membership {
    identity: Subject,
    operation: Id,
    content: Content,
}
impl_object_record!(Membership);
impl Membership {
    pub(super) fn into_domain(self) -> Result<ContentReference, AdapterError> {
        Ok(ContentReference {
            identity: self.identity.into_domain()?,
            operation: OperationId::from_bytes(self.operation.0)
                .map_err(|_| AdapterError::InvalidRequest)?,
            content: self.content.into_domain()?,
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Profile {
    codec: u32,
    schema: u32,
    semantic: u32,
}
impl_object_record!(Profile);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Source {
    identity: Subject,
    profile: Profile,
}
impl_object_record!(Source);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Position {
    source: Source,
    sequence: Decimal,
    #[serde(deserialize_with = "required_option")]
    operation: Option<Id>,
}
impl_object_record!(Position);
impl Position {
    fn into_domain(self) -> Result<ChangePosition, AdapterError> {
        Ok(ChangePosition {
            source: ReadSource {
                identity: self.source.identity.into_domain()?,
                profile: OperationRequestProfile {
                    codec: self.source.profile.codec,
                    schema: self.source.profile.schema,
                    semantic: self.source.profile.semantic,
                },
            },
            sequence: self.sequence.0,
            operation: self
                .operation
                .map(|id| OperationId::from_bytes(id.0).map_err(|_| AdapterError::InvalidRequest))
                .transpose()?,
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Range {
    after: Position,
    through: Position,
}
impl_object_record!(Range);
impl Range {
    pub(super) fn into_domain(self) -> Result<ChangeRange, AdapterError> {
        Ok(ChangeRange {
            after: self.after.into_domain()?,
            through: self.through.into_domain()?,
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Operation {
    change: Key,
    operation: Id,
}
impl_object_record!(Operation);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Actor {
    change: Key,
    actor: Id,
}
impl_object_record!(Actor);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
struct Ground {
    change: Key,
    ground: Id,
    version: Id,
}
impl_object_record!(Ground);
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
enum Reference {
    Change(Key),
    Operation(Operation),
    Content(Content),
    Membership(Membership),
    GroundObservation(Ground),
}
impl Reference {
    fn into_domain(self) -> Result<QualifiedReference, AdapterError> {
        Ok(match self {
            Self::Change(k) => QualifiedReference::Change(k.into_domain()?),
            Self::Operation(o) => QualifiedReference::Operation(OperationReference {
                change: o.change.into_domain()?,
                operation: OperationId::from_bytes(o.operation.0)
                    .map_err(|_| AdapterError::InvalidRequest)?,
            }),
            Self::Content(c) => QualifiedReference::Content(c.into_domain()?),
            Self::Membership(m) => QualifiedReference::Membership(m.into_domain()?),
            Self::GroundObservation(g) => QualifiedReference::GroundObservation {
                change: g.change.into_domain()?,
                ground: GroundId::from_bytes(g.ground.0)
                    .map_err(|_| AdapterError::InvalidRequest)?,
                version: GroundVersion::from_bytes(g.version.0)
                    .map_err(|_| AdapterError::InvalidRequest)?,
            },
        })
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
enum Kind {
    Start,
    Propose,
    Assess,
    Decide,
    Retract,
    Reaffirm,
    SetGrant,
    RevokeGrant,
    Admit,
    Dispatch,
    Finding,
    Adapt,
    Progress,
    Fulfill,
    Withdraw,
    Reconcile,
}
impl From<Kind> for OperationKind {
    fn from(kind: Kind) -> Self {
        match kind {
            Kind::Start => Self::Start,
            Kind::Propose => Self::Propose,
            Kind::Assess => Self::Assess,
            Kind::Decide => Self::Decide,
            Kind::Retract => Self::Retract,
            Kind::Reaffirm => Self::Reaffirm,
            Kind::SetGrant => Self::SetGrant,
            Kind::RevokeGrant => Self::RevokeGrant,
            Kind::Admit => Self::Admit,
            Kind::Dispatch => Self::Dispatch,
            Kind::Finding => Self::Finding,
            Kind::Adapt => Self::Adapt,
            Kind::Progress => Self::Progress,
            Kind::Fulfill => Self::Fulfill,
            Kind::Withdraw => Self::Withdraw,
            Kind::Reconcile => Self::Reconcile,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Matcher {
    kinds: Vec<Kind>,
    operations: Vec<Operation>,
    actors: Vec<Actor>,
    references: Vec<Reference>,
}
impl_object_record!(Matcher);
fn unique<T: Ord>(
    values: impl Iterator<Item = Result<T, AdapterError>>,
) -> Result<BTreeSet<T>, AdapterError> {
    let mut output = BTreeSet::new();
    for value in values {
        if !output.insert(value?) {
            return Err(AdapterError::InvalidRequest);
        }
    }
    Ok(output)
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(super) enum Selection {
    AllRecords,
    MatchingRecords(Matcher),
}
impl Selection {
    pub(super) fn into_domain(self) -> Result<RecordSelection, AdapterError> {
        Ok(match self {
            Self::AllRecords => RecordSelection::AllRecords,
            Self::MatchingRecords(m) => {
                if [
                    m.kinds.len(),
                    m.operations.len(),
                    m.actors.len(),
                    m.references.len(),
                ]
                .into_iter()
                .any(|n| n > 64)
                {
                    return Err(AdapterError::Limit);
                }
                RecordSelection::MatchingRecords(RecordMatch {
                    kinds: unique(m.kinds.into_iter().map(|k| Ok(k.into())))?,
                    operations: unique(m.operations.into_iter().map(|o| {
                        Ok(OperationReference {
                            change: o.change.into_domain()?,
                            operation: OperationId::from_bytes(o.operation.0)
                                .map_err(|_| AdapterError::InvalidRequest)?,
                        })
                    }))?,
                    actors: unique(m.actors.into_iter().map(|a| {
                        Ok(ActorReference {
                            change: a.change.into_domain()?,
                            actor: ActorId::from_bytes(a.actor.0)
                                .map_err(|_| AdapterError::InvalidRequest)?,
                        })
                    }))?,
                    references: unique(m.references.into_iter().map(Reference::into_domain))?,
                })
            }
        })
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Cursor {
    range: Range,
    selection: Selection,
    reader: Id,
    permission_scope: Key,
    last_scanned: Position,
}
impl_object_record!(Cursor);
impl Cursor {
    pub(super) fn into_domain(self) -> Result<ChangePageCursor, AdapterError> {
        Ok(ChangePageCursor {
            range: self.range.into_domain()?,
            selection: self.selection.into_domain()?,
            reader: ActorId::from_bytes(self.reader.0).map_err(|_| AdapterError::InvalidRequest)?,
            permission_scope: self.permission_scope.into_domain()?,
            last_scanned: self.last_scanned.into_domain()?,
        })
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(remote = "Self", deny_unknown_fields)]
pub(super) struct Limits {
    scanned_records: u32,
    returned_records: u32,
    reply_bytes: u32,
}
impl_object_record!(Limits);
impl Limits {
    pub(super) fn into_domain(self) -> Result<ReadLimits, AdapterError> {
        Ok(ReadLimits {
            scanned_records: usize::try_from(self.scanned_records)
                .map_err(|_| AdapterError::Limit)?,
            returned_records: usize::try_from(self.returned_records)
                .map_err(|_| AdapterError::Limit)?,
            reply_bytes: usize::try_from(self.reply_bytes).map_err(|_| AdapterError::Limit)?,
        })
    }
}

// All repeated request elements (DTO and domain) must fit the request reservation.
const _: () = assert!(std::mem::size_of::<Reference>() <= 1024);
const _: () = assert!(std::mem::size_of::<QualifiedReference>() <= 1024);
const _: () = assert!(std::mem::size_of::<Operation>() <= 1024);
const _: () = assert!(std::mem::size_of::<Actor>() <= 1024);
