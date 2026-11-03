// Checked-in typed current-format Protobuf definitions/conversions. No protoc or build-time generation.
// Tags are stable and meaningful presence is explicit. Wire types never enter the kernel.
// Rust type/field names are not encoded; Content/OperationRequest naming preserves the numbered codec.
use super::super::bridge::{self, Bridge, Budget, Entry};
use super::super::framing::{CodecError, Result, CODEC_VERSION, SCHEMA_VERSION};
use super::super::wire::{Rule, Schema, Shape, WireSchema};
use super::variants::{
    WAccess, WAttribution, WBindingKnowledge, WCommand, WCreatedIdentity, WDecisionKind, WEffect,
    WGrantTarget, WOriginSelector, WReadScope, WScopeJudgment,
};
use crate::application::operation_request::{OperationRequest, OperationRequestProfile};
use crate::application::ports::{Checks, Context, ReadScope};
use crate::application::records::{StoredOperation, HISTORY_VERSION};
use crate::kernel::change::{
    Accepted, ActionId, ActionOutcome, ActionRequest, ActorId, Adaptation, AgreementId, Assessment,
    AssessmentId, Attribution, Authority, BindingKnowledge, ChangeBasis, ChangeId, ChangeKey,
    Command, ContentCreation, ContentId, ContentKey, ContentLimits, ContentOrigin,
    ContentReference, ContentUsage, ContextVersion, Criterion, CriterionEvidence, CriterionId,
    Decision, DecisionId, DecisionKind, Dependency, Disposition, Effect, Evidence, Finding,
    FreshContent, Fulfillment, Grant, GrantAction, GrantId, GrantSpec, GrantTarget, GrantUse,
    GroundId, GroundVersion, Identity, InputKind, IntakeCase, IntakeSnapshot, LedgerId,
    NativeActionId, NativeConditions, Operation, OperationId, OriginScope, OwnerId, Progress,
    ProgressDimension, ProgressValue, Proposal, ProposalId, RecordedContent, Resolution, ScopeId,
    ScopeJudgment, SourceClaim, TermSelection, Terms, Unknown,
};
use std::collections::BTreeSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WGrantAction {
    CreateDraft = 1,
    Propose = 2,
    Assess = 3,
    Finding = 4,
    Adapt = 5,
    Progress = 6,
    Admit = 7,
    Dispatch = 8,
    Reconcile = 9,
}
impl Bridge for GrantAction {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::CreateDraft => 1,
            Self::Propose => 2,
            Self::Assess => 3,
            Self::Finding => 4,
            Self::Adapt => 5,
            Self::Progress => 6,
            Self::Admit => 7,
            Self::Dispatch => 8,
            Self::Reconcile => 9,
        })
    }
    fn unpack(value: i32) -> Result<Self> {
        match value {
            1 => Ok(Self::CreateDraft),
            2 => Ok(Self::Propose),
            3 => Ok(Self::Assess),
            4 => Ok(Self::Finding),
            5 => Ok(Self::Adapt),
            6 => Ok(Self::Progress),
            7 => Ok(Self::Admit),
            8 => Ok(Self::Dispatch),
            9 => Ok(Self::Reconcile),
            _ => Err(CodecError::Enum),
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WDisposition {
    Supports = 1,
    Challenges = 2,
    Unknown = 3,
}
impl Bridge for Disposition {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::Supports => 1,
            Self::Challenges => 2,
            Self::Unknown => 3,
        })
    }
    fn unpack(value: i32) -> Result<Self> {
        match value {
            1 => Ok(Self::Supports),
            2 => Ok(Self::Challenges),
            3 => Ok(Self::Unknown),
            _ => Err(CodecError::Enum),
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WProgressValue {
    Advanced = 1,
    Unchanged = 2,
    Regressed = 3,
    Unknown = 4,
}
impl Bridge for ProgressValue {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::Advanced => 1,
            Self::Unchanged => 2,
            Self::Regressed => 3,
            Self::Unknown => 4,
        })
    }
    fn unpack(value: i32) -> Result<Self> {
        match value {
            1 => Ok(Self::Advanced),
            2 => Ok(Self::Unchanged),
            3 => Ok(Self::Regressed),
            4 => Ok(Self::Unknown),
            _ => Err(CodecError::Enum),
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WChangeBasis {
    Observation = 1,
    CorrectedUnderstanding = 2,
    RevisedTargets = 3,
}
impl Bridge for ChangeBasis {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::Observation => 1,
            Self::CorrectedUnderstanding => 2,
            Self::RevisedTargets => 3,
        })
    }
    fn unpack(value: i32) -> Result<Self> {
        match value {
            1 => Ok(Self::Observation),
            2 => Ok(Self::CorrectedUnderstanding),
            3 => Ok(Self::RevisedTargets),
            _ => Err(CodecError::Enum),
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WActionOutcome {
    Unknown = 1,
    ReportedApplied = 2,
    ReportedNotApplied = 3,
    ReportedPartial = 4,
}
impl Bridge for ActionOutcome {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::Unknown => 1,
            Self::ReportedApplied => 2,
            Self::ReportedNotApplied => 3,
            Self::ReportedPartial => 4,
        })
    }
    fn unpack(value: i32) -> Result<Self> {
        match value {
            1 => Ok(Self::Unknown),
            2 => Ok(Self::ReportedApplied),
            3 => Ok(Self::ReportedNotApplied),
            4 => Ok(Self::ReportedPartial),
            _ => Err(CodecError::Enum),
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WIdentity {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub owner: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub owner_actor: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub ledger: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "4")]
    pub change: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "5")]
    pub agent: Option<Vec<u8>>,
}
impl WireSchema for WIdentity {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Identity {
    type Wire = WIdentity;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WIdentity {
                owner: Some(self.owner.pack(b)?),
                owner_actor: Some(self.owner_actor.pack(b)?),
                ledger: Some(self.ledger.pack(b)?),
                change: Some(self.change.pack(b)?),
                agent: Some(self.agent.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            owner: <OwnerId as Bridge>::unpack(bridge::required(w.owner)?)?,
            owner_actor: <ActorId as Bridge>::unpack(bridge::required(w.owner_actor)?)?,
            ledger: <LedgerId as Bridge>::unpack(bridge::required(w.ledger)?)?,
            change: <ChangeId as Bridge>::unpack(bridge::required(w.change)?)?,
            agent: <ActorId as Bridge>::unpack(bridge::required(w.agent)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WDependency {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub ground: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub version: Option<Vec<u8>>,
}
impl WireSchema for WDependency {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Dependency {
    type Wire = WDependency;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WDependency {
                ground: Some(self.ground.pack(b)?),
                version: Some(self.version.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            ground: <GroundId as Bridge>::unpack(bridge::required(w.ground)?)?,
            version: <GroundVersion as Bridge>::unpack(bridge::required(w.version)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WEvidence {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub source: Option<Vec<u8>>,
    // Tag 2 retired: unqualified content identity.
    #[prost(message, optional, tag = "102")]
    pub content: Option<WContentKey>,
    // Tag 3 retired: unqualified content identity.
    #[prost(message, optional, tag = "103")]
    pub limitations: Option<WContentKey>,
}
impl WireSchema for WEvidence {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 102,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 103,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Evidence {
    type Wire = WEvidence;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WEvidence {
                source: Some(self.source.pack(b)?),
                content: Some(self.content.pack(b)?),
                limitations: Some(self.limitations.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            source: <ActorId as Bridge>::unpack(bridge::required(w.source)?)?,
            content: <ContentKey as Bridge>::unpack(bridge::required(w.content)?)?,
            limitations: <ContentKey as Bridge>::unpack(bridge::required(w.limitations)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentReference {
    #[prost(message, optional, tag = "1")]
    pub identity: Option<WIdentity>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub operation: Option<Vec<u8>>,
    // Tag 3 retired: unqualified content identity.
    #[prost(message, optional, tag = "103")]
    pub content: Option<WContentKey>,
}
impl WireSchema for WContentReference {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WIdentity::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 103,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ContentReference {
    type Wire = WContentReference;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContentReference {
                identity: Some(self.identity.pack(b)?),
                operation: Some(self.operation.pack(b)?),
                content: Some(self.content.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            identity: <Identity as Bridge>::unpack(bridge::required(w.identity)?)?,
            operation: <OperationId as Bridge>::unpack(bridge::required(w.operation)?)?,
            content: <ContentKey as Bridge>::unpack(bridge::required(w.content)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WTermSelection {
    #[prost(message, optional, tag = "1")]
    pub statement: Option<WContentReference>,
    #[prost(message, repeated, tag = "2")]
    pub context: Vec<WContentReference>,
}
impl WireSchema for WTermSelection {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WContentReference::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for TermSelection {
    type Wire = WTermSelection;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WTermSelection {
                statement: Some(self.statement.pack(b)?),
                context: bridge::pack_set(&self.context, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            statement: <ContentReference as Bridge>::unpack(bridge::required(w.statement)?)?,
            context: bridge::unpack_set(w.context)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WUnknown {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub question: Option<WContentKey>,
    // Tag 2 retired: unqualified content identity.
    #[prost(message, optional, tag = "102")]
    pub bounded_by: Option<WContentKey>,
    #[prost(message, repeated, tag = "3")]
    pub affected: Vec<WContentReference>,
}
impl WireSchema for WUnknown {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 101,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 102,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Unknown {
    type Wire = WUnknown;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WUnknown {
                question: Some(self.question.pack(b)?),
                bounded_by: Some(self.bounded_by.pack(b)?),
                affected: bridge::pack_set(&self.affected, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            question: <ContentKey as Bridge>::unpack(bridge::required(w.question)?)?,
            bounded_by: <ContentKey as Bridge>::unpack(bridge::required(w.bounded_by)?)?,
            affected: bridge::unpack_set(w.affected)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCriterion {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub definition: Option<WContentReference>,
    #[prost(message, repeated, tag = "3")]
    pub terms: Vec<WContentReference>,
}
impl WireSchema for WCriterion {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentReference::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Criterion {
    type Wire = WCriterion;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WCriterion {
                id: Some(self.id.pack(b)?),
                definition: Some(self.definition.pack(b)?),
                terms: bridge::pack_set(&self.terms, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <CriterionId as Bridge>::unpack(bridge::required(w.id)?)?,
            definition: <ContentReference as Bridge>::unpack(bridge::required(w.definition)?)?,
            terms: bridge::unpack_set(w.terms)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WTerms {
    #[prost(message, repeated, tag = "1")]
    pub binding: Vec<WTermSelection>,
    #[prost(message, repeated, tag = "2")]
    pub context: Vec<WContentReference>,
    #[prost(message, repeated, tag = "3")]
    pub unknowns: Vec<WUnknown>,
    #[prost(message, repeated, tag = "4")]
    pub criteria: Vec<WCriterion>,
}
impl WireSchema for WTerms {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WTermSelection::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WUnknown::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WCriterion::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Terms {
    type Wire = WTerms;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WTerms {
                binding: bridge::pack_list(&self.binding, b)?,
                context: bridge::pack_set(&self.context, b)?,
                unknowns: bridge::pack_list(&self.unknowns, b)?,
                criteria: bridge::pack_list(&self.criteria, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            binding: bridge::unpack_list(w.binding)?,
            context: bridge::unpack_set(w.context)?,
            unknowns: bridge::unpack_list(w.unknowns)?,
            criteria: bridge::unpack_list(w.criteria)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WProposal {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub agreement: Option<Vec<u8>>,
    #[prost(message, optional, tag = "3")]
    pub identity: Option<WIdentity>,
    #[prost(bytes = "vec", optional, tag = "4")]
    pub expected_agreement: Option<Vec<u8>>,
    #[prost(message, optional, tag = "5")]
    pub terms: Option<WTerms>,
    #[prost(message, repeated, tag = "6")]
    pub dependencies: Vec<WDependency>,
}
impl WireSchema for WProposal {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WIdentity::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WTerms::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WDependency::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Proposal {
    type Wire = WProposal;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WProposal {
                id: Some(self.id.pack(b)?),
                agreement: Some(self.agreement.pack(b)?),
                identity: Some(self.identity.pack(b)?),
                expected_agreement: bridge::pack_optional(&self.expected_agreement, b)?,
                terms: Some(self.terms.pack(b)?),
                dependencies: bridge::pack_list(&self.dependencies, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <ProposalId as Bridge>::unpack(bridge::required(w.id)?)?,
            agreement: <AgreementId as Bridge>::unpack(bridge::required(w.agreement)?)?,
            identity: <Identity as Bridge>::unpack(bridge::required(w.identity)?)?,
            expected_agreement: bridge::unpack_optional(w.expected_agreement)?,
            terms: <Terms as Bridge>::unpack(bridge::required(w.terms)?)?,
            dependencies: bridge::unpack_list(w.dependencies)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAssessment {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub proposal: Option<Vec<u8>>,
    // Tag 3 retired: unqualified content identity.
    #[prost(message, optional, tag = "103")]
    pub feasibility: Option<WContentKey>,
    // Tag 4 retired: unqualified content identity.
    #[prost(message, optional, tag = "104")]
    pub capabilities: Option<WContentKey>,
    // Tag 5 retired: unqualified content identity.
    #[prost(message, optional, tag = "105")]
    pub resources: Option<WContentKey>,
    // Tag 6 retired: unqualified content identity.
    #[prost(message, optional, tag = "106")]
    pub commitments: Option<WContentKey>,
    // Tag 7 retired: unqualified content identity.
    #[prost(message, optional, tag = "107")]
    pub coverage: Option<WContentKey>,
    // Tag 8 retired: unqualified content identity.
    #[prost(message, optional, tag = "108")]
    pub limitations: Option<WContentKey>,
    #[prost(message, repeated, tag = "9")]
    pub dependencies: Vec<WDependency>,
    // Tag 10 retired: unqualified content identity.
    #[prost(message, repeated, tag = "110")]
    pub blockers: Vec<WContentKey>,
}
impl WireSchema for WAssessment {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 103,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 104,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 105,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 106,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 107,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 108,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 9,
                    shape: Shape::Message(WDependency::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 110,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Assessment {
    type Wire = WAssessment;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAssessment {
                id: Some(self.id.pack(b)?),
                proposal: Some(self.proposal.pack(b)?),
                feasibility: Some(self.feasibility.pack(b)?),
                capabilities: Some(self.capabilities.pack(b)?),
                resources: Some(self.resources.pack(b)?),
                commitments: Some(self.commitments.pack(b)?),
                coverage: Some(self.coverage.pack(b)?),
                limitations: Some(self.limitations.pack(b)?),
                dependencies: bridge::pack_list(&self.dependencies, b)?,
                blockers: bridge::pack_list(&self.blockers, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <AssessmentId as Bridge>::unpack(bridge::required(w.id)?)?,
            proposal: <ProposalId as Bridge>::unpack(bridge::required(w.proposal)?)?,
            feasibility: <ContentKey as Bridge>::unpack(bridge::required(w.feasibility)?)?,
            capabilities: <ContentKey as Bridge>::unpack(bridge::required(w.capabilities)?)?,
            resources: <ContentKey as Bridge>::unpack(bridge::required(w.resources)?)?,
            commitments: <ContentKey as Bridge>::unpack(bridge::required(w.commitments)?)?,
            coverage: <ContentKey as Bridge>::unpack(bridge::required(w.coverage)?)?,
            limitations: <ContentKey as Bridge>::unpack(bridge::required(w.limitations)?)?,
            dependencies: bridge::unpack_list(w.dependencies)?,
            blockers: bridge::unpack_list(w.blockers)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WDecision {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub proposal: Option<Vec<u8>>,
    #[prost(message, optional, tag = "3")]
    pub kind: Option<WDecisionKind>,
    #[prost(message, repeated, tag = "4")]
    pub dependencies: Vec<WDependency>,
}
impl WireSchema for WDecision {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WDecisionKind::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WDependency::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Decision {
    type Wire = WDecision;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WDecision {
                id: Some(self.id.pack(b)?),
                proposal: Some(self.proposal.pack(b)?),
                kind: Some(self.kind.pack(b)?),
                dependencies: bridge::pack_list(&self.dependencies, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <DecisionId as Bridge>::unpack(bridge::required(w.id)?)?,
            proposal: <ProposalId as Bridge>::unpack(bridge::required(w.proposal)?)?,
            kind: <DecisionKind as Bridge>::unpack(bridge::required(w.kind)?)?,
            dependencies: bridge::unpack_list(w.dependencies)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WGrantUse {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(uint64, optional, tag = "2")]
    pub generation: Option<u64>,
}
impl WireSchema for WGrantUse {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for GrantUse {
    type Wire = WGrantUse;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WGrantUse {
                id: Some(self.id.pack(b)?),
                generation: Some(self.generation.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <GrantId as Bridge>::unpack(bridge::required(w.id)?)?,
            generation: <u64 as Bridge>::unpack(bridge::required(w.generation)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentLimits {
    #[prost(uint64, optional, tag = "1")]
    pub items: Option<u64>,
    #[prost(uint64, optional, tag = "2")]
    pub payload_bytes: Option<u64>,
}
impl WireSchema for WContentLimits {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ContentLimits {
    type Wire = WContentLimits;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContentLimits {
                items: Some(self.items.pack(b)?),
                payload_bytes: Some(self.payload_bytes.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            items: <u64 as Bridge>::unpack(bridge::required(w.items)?)?,
            payload_bytes: <u64 as Bridge>::unpack(bridge::required(w.payload_bytes)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentUsage {
    #[prost(uint64, optional, tag = "1")]
    pub items: Option<u64>,
    #[prost(uint64, optional, tag = "2")]
    pub payload_bytes: Option<u64>,
}
impl WireSchema for WContentUsage {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ContentUsage {
    type Wire = WContentUsage;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContentUsage {
                items: Some(self.items.pack(b)?),
                payload_bytes: Some(self.payload_bytes.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            items: <u64 as Bridge>::unpack(bridge::required(w.items)?)?,
            payload_bytes: <u64 as Bridge>::unpack(bridge::required(w.payload_bytes)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WOriginScope {
    #[prost(message, optional, tag = "1")]
    pub identity: Option<WIdentity>,
    #[prost(message, optional, tag = "2")]
    pub grant: Option<WGrantUse>,
    #[prost(message, optional, tag = "3")]
    pub target: Option<WGrantTarget>,
}
impl WireSchema for WOriginScope {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WIdentity::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WGrantUse::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WGrantTarget::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for OriginScope {
    type Wire = WOriginScope;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WOriginScope {
                identity: Some(self.identity.pack(b)?),
                grant: Some(self.grant.pack(b)?),
                target: Some(self.target.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            identity: <Identity as Bridge>::unpack(bridge::required(w.identity)?)?,
            grant: <GrantUse as Bridge>::unpack(bridge::required(w.grant)?)?,
            target: <GrantTarget as Bridge>::unpack(bridge::required(w.target)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentOrigin {
    #[prost(message, optional, tag = "1")]
    pub binding: Option<WContentReference>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub recorder: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub represented_owner: Option<Vec<u8>>,
    #[prost(message, optional, tag = "4")]
    pub grant: Option<WGrantUse>,
    #[prost(message, optional, tag = "5")]
    pub target: Option<WGrantTarget>,
}
impl WireSchema for WContentOrigin {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WContentReference::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WGrantUse::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WGrantTarget::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ContentOrigin {
    type Wire = WContentOrigin;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContentOrigin {
                binding: Some(self.binding.pack(b)?),
                recorder: Some(self.recorder.pack(b)?),
                represented_owner: Some(self.represented_owner.pack(b)?),
                grant: Some(self.grant.pack(b)?),
                target: Some(self.target.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            binding: <ContentReference as Bridge>::unpack(bridge::required(w.binding)?)?,
            recorder: <ActorId as Bridge>::unpack(bridge::required(w.recorder)?)?,
            represented_owner: <OwnerId as Bridge>::unpack(bridge::required(w.represented_owner)?)?,
            grant: <GrantUse as Bridge>::unpack(bridge::required(w.grant)?)?,
            target: <GrantTarget as Bridge>::unpack(bridge::required(w.target)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WFreshContent {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub key: Option<WContentKey>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub bytes: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub attributed_source: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "4")]
    pub derived_from: Vec<WContentReference>,
}
impl WireSchema for WFreshContent {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 101,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Content,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for FreshContent {
    type Wire = WFreshContent;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WFreshContent {
                key: Some(self.key.pack(b)?),
                bytes: Some(self.bytes.pack(b)?),
                attributed_source: Some(self.attributed_source.pack(b)?),
                derived_from: bridge::pack_set(&self.derived_from, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            key: <ContentKey as Bridge>::unpack(bridge::required(w.key)?)?,
            bytes: <Vec<u8> as Bridge>::unpack(bridge::required(w.bytes)?)?,
            attributed_source: <ActorId as Bridge>::unpack(bridge::required(w.attributed_source)?)?,
            derived_from: bridge::unpack_set(w.derived_from)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WRecordedContent {
    #[prost(message, optional, tag = "1")]
    pub payload: Option<WFreshContent>,
    #[prost(message, optional, tag = "2")]
    pub origin: Option<WContentOrigin>,
}
impl WireSchema for WRecordedContent {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WFreshContent::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentOrigin::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for RecordedContent {
    type Wire = WRecordedContent;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WRecordedContent {
                payload: Some(self.payload.pack(b)?),
                origin: Some(self.origin.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            payload: <FreshContent as Bridge>::unpack(bridge::required(w.payload)?)?,
            origin: <ContentOrigin as Bridge>::unpack(bridge::required(w.origin)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentCreation {
    #[prost(message, optional, tag = "1")]
    pub grant: Option<WGrant>,
    #[prost(message, repeated, tag = "2")]
    pub content_items: Vec<WRecordedMap>,
    #[prost(message, optional, tag = "3")]
    pub usage: Option<WContentUsage>,
}
impl WireSchema for WContentCreation {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WGrant::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WRecordedMap::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WContentUsage::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ContentCreation {
    type Wire = WContentCreation;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContentCreation {
                grant: Some(self.grant.pack(b)?),
                content_items: bridge::pack_map::<_, _, WRecordedMap>(&self.content_items, b)?,
                usage: Some(self.usage.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            grant: <Grant as Bridge>::unpack(bridge::required(w.grant)?)?,
            content_items: bridge::unpack_map(w.content_items)?,
            usage: <ContentUsage as Bridge>::unpack(bridge::required(w.usage)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WGrantSpec {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub recipient: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub target: Option<WGrantTarget>,
    #[prost(enumeration = "WGrantAction", repeated, packed = "false", tag = "3")]
    pub actions: Vec<i32>,
    // Tag 4 retired: unqualified content identity.
    #[prost(message, repeated, tag = "104")]
    pub content_items: Vec<WContentKey>,
    // Tag 5 retired: unqualified content identity.
    #[prost(message, repeated, tag = "105")]
    pub disclosure: Vec<WContentKey>,
    #[prost(message, optional, tag = "6")]
    pub creation: Option<WContentLimits>,
    #[prost(message, repeated, tag = "7")]
    pub content_origins: Vec<WOriginSelector>,
    #[prost(message, repeated, tag = "8")]
    pub disclosure_origins: Vec<WOriginSelector>,
    #[prost(bytes = "vec", repeated, tag = "9")]
    pub native_actions: Vec<Vec<u8>>,
    #[prost(bytes = "vec", repeated, tag = "10")]
    pub native_scope: Vec<Vec<u8>>,
    #[prost(bytes = "vec", repeated, tag = "11")]
    pub limits: Vec<Vec<u8>>,
}
impl WireSchema for WGrantSpec {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WGrantTarget::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Enum(&[1, 2, 3, 4, 5, 6, 7, 8, 9]),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 104,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 105,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WContentLimits::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WOriginSelector::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
                    shape: Shape::Message(WOriginSelector::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 9,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 10,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 11,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for GrantSpec {
    type Wire = WGrantSpec;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WGrantSpec {
                recipient: Some(self.recipient.pack(b)?),
                target: Some(self.target.pack(b)?),
                actions: bridge::pack_set(&self.actions, b)?,
                content_items: bridge::pack_set(&self.content_items, b)?,
                disclosure: bridge::pack_set(&self.disclosure, b)?,
                creation: bridge::pack_optional(&self.creation, b)?,
                content_origins: bridge::pack_set(&self.content_origins, b)?,
                disclosure_origins: bridge::pack_set(&self.disclosure_origins, b)?,
                native_actions: bridge::pack_set(&self.native_actions, b)?,
                native_scope: bridge::pack_set(&self.native_scope, b)?,
                limits: bridge::pack_set(&self.limits, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            recipient: <ActorId as Bridge>::unpack(bridge::required(w.recipient)?)?,
            target: <GrantTarget as Bridge>::unpack(bridge::required(w.target)?)?,
            actions: bridge::unpack_set(w.actions)?,
            content_items: bridge::unpack_set(w.content_items)?,
            disclosure: bridge::unpack_set(w.disclosure)?,
            creation: bridge::unpack_optional(w.creation)?,
            content_origins: bridge::unpack_set(w.content_origins)?,
            disclosure_origins: bridge::unpack_set(w.disclosure_origins)?,
            native_actions: bridge::unpack_set(w.native_actions)?,
            native_scope: bridge::unpack_set(w.native_scope)?,
            limits: bridge::unpack_set(w.limits)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WGrant {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(uint64, optional, tag = "2")]
    pub generation: Option<u64>,
    #[prost(message, optional, tag = "3")]
    pub spec: Option<WGrantSpec>,
    #[prost(bool, optional, tag = "4")]
    pub revoked: Option<bool>,
}
impl WireSchema for WGrant {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WGrantSpec::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Bool,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Grant {
    type Wire = WGrant;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WGrant {
                id: Some(self.id.pack(b)?),
                generation: Some(self.generation.pack(b)?),
                spec: Some(self.spec.pack(b)?),
                revoked: Some(self.revoked.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <GrantId as Bridge>::unpack(bridge::required(w.id)?)?,
            generation: <u64 as Bridge>::unpack(bridge::required(w.generation)?)?,
            spec: <GrantSpec as Bridge>::unpack(bridge::required(w.spec)?)?,
            revoked: <bool as Bridge>::unpack(bridge::required(w.revoked)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WFinding {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    // Tag 2 retired: unqualified content identity.
    #[prost(message, optional, tag = "102")]
    pub claim: Option<WContentKey>,
    #[prost(message, repeated, tag = "3")]
    pub evidence: Vec<WEvidence>,
    #[prost(enumeration = "WDisposition", optional, tag = "4")]
    pub disposition: Option<i32>,
}
impl WireSchema for WFinding {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 102,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Enum(&[1, 2, 3]),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Finding {
    type Wire = WFinding;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WFinding {
                agreement: bridge::pack_optional(&self.agreement, b)?,
                claim: Some(self.claim.pack(b)?),
                evidence: bridge::pack_list(&self.evidence, b)?,
                disposition: Some(self.disposition.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: bridge::unpack_optional(w.agreement)?,
            claim: <ContentKey as Bridge>::unpack(bridge::required(w.claim)?)?,
            evidence: bridge::unpack_list(w.evidence)?,
            disposition: <Disposition as Bridge>::unpack(bridge::required(w.disposition)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAdaptation {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    // Tag 2 retired: unqualified content identity.
    #[prost(message, optional, tag = "102")]
    pub previous_approach: Option<WContentKey>,
    // Tag 3 retired: unqualified content identity.
    #[prost(message, optional, tag = "103")]
    pub changed_approach: Option<WContentKey>,
    #[prost(message, repeated, tag = "4")]
    pub grounds: Vec<WEvidence>,
    #[prost(bytes = "vec", optional, tag = "5")]
    pub discretion: Option<Vec<u8>>,
}
impl WireSchema for WAdaptation {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 102,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 103,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Adaptation {
    type Wire = WAdaptation;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAdaptation {
                agreement: Some(self.agreement.pack(b)?),
                previous_approach: Some(self.previous_approach.pack(b)?),
                changed_approach: Some(self.changed_approach.pack(b)?),
                grounds: bridge::pack_list(&self.grounds, b)?,
                discretion: Some(self.discretion.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: <AgreementId as Bridge>::unpack(bridge::required(w.agreement)?)?,
            previous_approach: <ContentKey as Bridge>::unpack(bridge::required(
                w.previous_approach,
            )?)?,
            changed_approach: <ContentKey as Bridge>::unpack(bridge::required(
                w.changed_approach,
            )?)?,
            grounds: bridge::unpack_list(w.grounds)?,
            discretion: <ScopeId as Bridge>::unpack(bridge::required(w.discretion)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WProgressDimension {
    #[prost(enumeration = "WProgressValue", optional, tag = "1")]
    pub value: Option<i32>,
    // Tag 2 retired: unqualified content identity.
    #[prost(message, optional, tag = "102")]
    pub assessment: Option<WContentKey>,
}
impl WireSchema for WProgressDimension {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Enum(&[1, 2, 3, 4]),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 102,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ProgressDimension {
    type Wire = WProgressDimension;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WProgressDimension {
                value: Some(self.value.pack(b)?),
                assessment: Some(self.assessment.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            value: <ProgressValue as Bridge>::unpack(bridge::required(w.value)?)?,
            assessment: <ContentKey as Bridge>::unpack(bridge::required(w.assessment)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WProgress {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub terms: Vec<WContentReference>,
    #[prost(bytes = "vec", repeated, tag = "3")]
    pub criteria: Vec<Vec<u8>>,
    #[prost(message, repeated, tag = "4")]
    pub evidence: Vec<WEvidence>,
    #[prost(message, optional, tag = "5")]
    pub understanding: Option<WProgressDimension>,
    #[prost(message, optional, tag = "6")]
    pub outcome: Option<WProgressDimension>,
    #[prost(enumeration = "WChangeBasis", optional, tag = "7")]
    pub basis: Option<i32>,
}
impl WireSchema for WProgress {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WProgressDimension::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WProgressDimension::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Enum(&[1, 2, 3]),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Progress {
    type Wire = WProgress;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WProgress {
                agreement: Some(self.agreement.pack(b)?),
                terms: bridge::pack_set(&self.terms, b)?,
                criteria: bridge::pack_set(&self.criteria, b)?,
                evidence: bridge::pack_list(&self.evidence, b)?,
                understanding: Some(self.understanding.pack(b)?),
                outcome: Some(self.outcome.pack(b)?),
                basis: Some(self.basis.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: <AgreementId as Bridge>::unpack(bridge::required(w.agreement)?)?,
            terms: bridge::unpack_set(w.terms)?,
            criteria: bridge::unpack_set(w.criteria)?,
            evidence: bridge::unpack_list(w.evidence)?,
            understanding: <ProgressDimension as Bridge>::unpack(bridge::required(
                w.understanding,
            )?)?,
            outcome: <ProgressDimension as Bridge>::unpack(bridge::required(w.outcome)?)?,
            basis: <ChangeBasis as Bridge>::unpack(bridge::required(w.basis)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WActionRequest {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub agreement: Option<Vec<u8>>,
    #[prost(message, optional, tag = "3")]
    pub grant: Option<WGrantUse>,
    #[prost(bytes = "vec", optional, tag = "4")]
    pub native_action: Option<Vec<u8>>,
    #[prost(bytes = "vec", repeated, tag = "5")]
    pub scope: Vec<Vec<u8>>,
    #[prost(bytes = "vec", repeated, tag = "6")]
    pub limits: Vec<Vec<u8>>,
    #[prost(message, repeated, tag = "7")]
    pub dependencies: Vec<WDependency>,
    // Tag 8 retired: unqualified content identity.
    #[prost(message, repeated, tag = "108")]
    pub conditions: Vec<WContentKey>,
}
impl WireSchema for WActionRequest {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WGrantUse::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WDependency::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 108,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ActionRequest {
    type Wire = WActionRequest;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WActionRequest {
                id: Some(self.id.pack(b)?),
                agreement: Some(self.agreement.pack(b)?),
                grant: Some(self.grant.pack(b)?),
                native_action: Some(self.native_action.pack(b)?),
                scope: bridge::pack_set(&self.scope, b)?,
                limits: bridge::pack_set(&self.limits, b)?,
                dependencies: bridge::pack_list(&self.dependencies, b)?,
                conditions: bridge::pack_list(&self.conditions, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <ActionId as Bridge>::unpack(bridge::required(w.id)?)?,
            agreement: <AgreementId as Bridge>::unpack(bridge::required(w.agreement)?)?,
            grant: <GrantUse as Bridge>::unpack(bridge::required(w.grant)?)?,
            native_action: <NativeActionId as Bridge>::unpack(bridge::required(w.native_action)?)?,
            scope: bridge::unpack_set(w.scope)?,
            limits: bridge::unpack_set(w.limits)?,
            dependencies: bridge::unpack_list(w.dependencies)?,
            conditions: bridge::unpack_list(w.conditions)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCriterionEvidence {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub criterion: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub evidence: Vec<WEvidence>,
}
impl WireSchema for WCriterionEvidence {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for CriterionEvidence {
    type Wire = WCriterionEvidence;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WCriterionEvidence {
                criterion: Some(self.criterion.pack(b)?),
                evidence: bridge::pack_list(&self.evidence, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            criterion: <CriterionId as Bridge>::unpack(bridge::required(w.criterion)?)?,
            evidence: bridge::unpack_list(w.evidence)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WResolution {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub blocker: Option<WContentKey>,
    #[prost(message, repeated, tag = "2")]
    pub evidence: Vec<WEvidence>,
}
impl WireSchema for WResolution {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 101,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Resolution {
    type Wire = WResolution;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WResolution {
                blocker: Some(self.blocker.pack(b)?),
                evidence: bridge::pack_list(&self.evidence, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            blocker: <ContentKey as Bridge>::unpack(bridge::required(w.blocker)?)?,
            evidence: bridge::unpack_list(w.evidence)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WFulfillment {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub criteria: Vec<WCriterionEvidence>,
    #[prost(message, repeated, tag = "3")]
    pub resolutions: Vec<WResolution>,
    // Tag 4 retired: unqualified content identity.
    #[prost(message, optional, tag = "104")]
    pub acceptance: Option<WContentKey>,
}
impl WireSchema for WFulfillment {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WCriterionEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WResolution::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 104,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Fulfillment {
    type Wire = WFulfillment;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WFulfillment {
                agreement: Some(self.agreement.pack(b)?),
                criteria: bridge::pack_list(&self.criteria, b)?,
                resolutions: bridge::pack_list(&self.resolutions, b)?,
                acceptance: Some(self.acceptance.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: <AgreementId as Bridge>::unpack(bridge::required(w.agreement)?)?,
            criteria: bridge::unpack_list(w.criteria)?,
            resolutions: bridge::unpack_list(w.resolutions)?,
            acceptance: <ContentKey as Bridge>::unpack(bridge::required(w.acceptance)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WOperation {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub command: Option<WCommand>,
    #[prost(message, repeated, tag = "3")]
    pub fresh: Vec<WFreshContent>,
    #[prost(message, repeated, tag = "4")]
    pub first_retention: Vec<WContentKey>,
}
impl WireSchema for WOperation {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WCommand::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WFreshContent::schema),
                    required: false,
                    repeated: true,
                    limit: 64,
                    fresh: true,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Operation {
    type Wire = WOperation;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        bridge::check_fresh(&self.fresh)?;
        b.message(|b| {
            Ok(WOperation {
                id: Some(self.id.pack(b)?),
                command: Some(self.command.pack(b)?),
                fresh: bridge::pack_list(&self.fresh, b)?,
                first_retention: bridge::pack_set(&self.first_retention, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <OperationId as Bridge>::unpack(bridge::required(w.id)?)?,
            command: <Command as Bridge>::unpack(bridge::required(w.command)?)?,
            fresh: bridge::unpack_list(w.fresh)?,
            first_retention: bridge::unpack_set(w.first_retention)?,
        };
        bridge::check_fresh(&result.fresh)?;
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAccepted {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub operation: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub actor: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub represented_owner: Option<Vec<u8>>,
    #[prost(message, optional, tag = "4")]
    pub effect: Option<WEffect>,
}
impl WireSchema for WAccepted {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WEffect::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Accepted {
    type Wire = WAccepted;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAccepted {
                operation: Some(self.operation.pack(b)?),
                actor: Some(self.actor.pack(b)?),
                represented_owner: Some(self.represented_owner.pack(b)?),
                effect: Some(self.effect.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            operation: <OperationId as Bridge>::unpack(bridge::required(w.operation)?)?,
            actor: <ActorId as Bridge>::unpack(bridge::required(w.actor)?)?,
            represented_owner: <OwnerId as Bridge>::unpack(bridge::required(w.represented_owner)?)?,
            effect: <Effect as Bridge>::unpack(bridge::required(w.effect)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAuthority {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub actor: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub represented_owner: Option<Vec<u8>>,
    #[prost(message, optional, tag = "3")]
    pub owner_control: Option<WIdentity>,
    #[prost(message, optional, tag = "4")]
    pub agent_role: Option<WIdentity>,
}
impl WireSchema for WAuthority {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WIdentity::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WIdentity::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Authority {
    type Wire = WAuthority;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAuthority {
                actor: Some(self.actor.pack(b)?),
                represented_owner: Some(self.represented_owner.pack(b)?),
                owner_control: bridge::pack_optional(&self.owner_control, b)?,
                agent_role: bridge::pack_optional(&self.agent_role, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            actor: <ActorId as Bridge>::unpack(bridge::required(w.actor)?)?,
            represented_owner: <OwnerId as Bridge>::unpack(bridge::required(w.represented_owner)?)?,
            owner_control: bridge::unpack_optional(w.owner_control)?,
            agent_role: bridge::unpack_optional(w.agent_role)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WNativeConditions {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub action: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub evidence: Vec<WEvidence>,
}
impl WireSchema for WNativeConditions {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for NativeConditions {
    type Wire = WNativeConditions;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WNativeConditions {
                action: Some(self.action.pack(b)?),
                evidence: bridge::pack_list(&self.evidence, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            action: <ActionId as Bridge>::unpack(bridge::required(w.action)?)?,
            evidence: bridge::unpack_list(w.evidence)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContext {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub version: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub authority: Option<WAuthority>,
    #[prost(message, repeated, tag = "3")]
    pub disclosure: Vec<WReadScope>,
}
impl WireSchema for WContext {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAuthority::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WReadScope::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Context {
    type Wire = WContext;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContext {
                version: Some(self.version.pack(b)?),
                authority: Some(self.authority.pack(b)?),
                disclosure: bridge::pack_set(&self.disclosure, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            version: <ContextVersion as Bridge>::unpack(bridge::required(w.version)?)?,
            authority: <Authority as Bridge>::unpack(bridge::required(w.authority)?)?,
            disclosure: bridge::unpack_set(w.disclosure)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WChecks {
    #[prost(message, optional, tag = "1")]
    pub identity: Option<WIdentity>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub expected_operation: Option<Vec<u8>>,
    #[prost(message, optional, tag = "3")]
    pub context: Option<WContext>,
    #[prost(message, optional, tag = "4")]
    pub disclosure: Option<WReadScope>,
    #[prost(message, optional, tag = "5")]
    pub disclosure_origin: Option<WOriginScope>,
    #[prost(message, optional, tag = "6")]
    pub creation: Option<WContentCreation>,
    #[prost(message, repeated, tag = "7")]
    pub content_items: Vec<WContentMap>,
    #[prost(message, repeated, tag = "8")]
    pub grounds: Vec<WGroundMap>,
    #[prost(message, optional, tag = "9")]
    pub adaptation: Option<WAdaptationPair>,
    #[prost(message, optional, tag = "10")]
    pub native: Option<WNativePair>,
    #[prost(message, repeated, tag = "11")]
    pub intakes: Vec<WIntakeEntry>,
}
impl WireSchema for WChecks {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WIdentity::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WContext::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WReadScope::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WOriginScope::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WContentCreation::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WContentMap::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
                    shape: Shape::Message(WGroundMap::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 9,
                    shape: Shape::Message(WAdaptationPair::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 10,
                    shape: Shape::Message(WNativePair::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 11,
                    shape: Shape::Message(WIntakeEntry::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Checks {
    type Wire = WChecks;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WChecks {
                identity: Some(self.identity.pack(b)?),
                expected_operation: bridge::pack_optional(&self.expected_operation, b)?,
                context: Some(self.context.pack(b)?),
                disclosure: Some(self.disclosure.pack(b)?),
                disclosure_origin: bridge::pack_optional(&self.disclosure_origin, b)?,
                creation: bridge::pack_optional(&self.creation, b)?,
                content_items: bridge::pack_map::<_, _, WContentMap>(&self.content_items, b)?,
                grounds: bridge::pack_map::<_, _, WGroundMap>(&self.grounds, b)?,
                adaptation: bridge::pack_optional(&self.adaptation, b)?,
                native: bridge::pack_optional(&self.native, b)?,
                intakes: bridge::pack_map::<_, _, WIntakeEntry>(&self.intakes, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            identity: <Identity as Bridge>::unpack(bridge::required(w.identity)?)?,
            expected_operation: bridge::unpack_optional(w.expected_operation)?,
            context: <Context as Bridge>::unpack(bridge::required(w.context)?)?,
            disclosure: <ReadScope as Bridge>::unpack(bridge::required(w.disclosure)?)?,
            disclosure_origin: bridge::unpack_optional(w.disclosure_origin)?,
            creation: bridge::unpack_optional(w.creation)?,
            content_items: bridge::unpack_map(w.content_items)?,
            grounds: bridge::unpack_map(w.grounds)?,
            adaptation: bridge::unpack_optional(w.adaptation)?,
            native: bridge::unpack_optional(w.native)?,
            intakes: bridge::unpack_map(w.intakes)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WStoredOperation {
    #[prost(uint32, optional, tag = "1")]
    pub semantic_version: Option<u32>,
    #[prost(uint64, optional, tag = "2")]
    pub sequence: Option<u64>,
    #[prost(message, optional, tag = "3")]
    pub operation: Option<WOperation>,
    #[prost(message, optional, tag = "4")]
    pub accepted: Option<WAccepted>,
    #[prost(message, optional, tag = "5")]
    pub checks: Option<WChecks>,
    #[prost(message, optional, tag = "6")]
    pub used_grant: Option<WGrantUse>,
    #[prost(message, optional, tag = "7")]
    pub grant_snapshot: Option<WGrant>,
    #[prost(message, repeated, tag = "8")]
    pub creations: Vec<WCreatedIdentity>,
    // Tag 9 retired: unqualified content identity.
    #[prost(message, repeated, tag = "109")]
    pub retained_content_items: Vec<WContentKey>,
    #[prost(message, repeated, tag = "10")]
    pub establishments: Vec<WContentKey>,
}
impl WireSchema for WStoredOperation {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Version(HISTORY_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WOperation::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WAccepted::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WChecks::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WGrantUse::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WGrant::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
                    shape: Shape::Message(WCreatedIdentity::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 109,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 10,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl WStoredOperation {
    pub(in crate::adapters::codec) fn pack(
        value: &StoredOperation,
        b: &mut Budget,
    ) -> Result<Self> {
        b.message(|b| {
            Ok(WStoredOperation {
                semantic_version: Some(value.profile.semantic),
                sequence: Some(value.sequence.pack(b)?),
                operation: Some(value.operation.pack(b)?),
                accepted: Some(value.accepted.pack(b)?),
                checks: Some(value.checks.pack(b)?),
                used_grant: bridge::pack_optional(&value.used_grant, b)?,
                grant_snapshot: bridge::pack_optional(&value.grant_snapshot, b)?,
                creations: bridge::pack_set(&value.creations, b)?,
                retained_content_items: bridge::pack_set(&value.retained_content_items, b)?,
                establishments: bridge::pack_set(&value.establishments, b)?,
            })
        })
    }
    pub(in crate::adapters::codec) fn unpack(
        w: Self,
        profile: OperationRequestProfile,
    ) -> Result<StoredOperation> {
        if bridge::required(w.semantic_version)? != profile.semantic {
            return Err(CodecError::Version);
        }
        let result = StoredOperation {
            profile,
            sequence: <u64 as Bridge>::unpack(bridge::required(w.sequence)?)?,
            operation: <Operation as Bridge>::unpack(bridge::required(w.operation)?)?,
            accepted: <Accepted as Bridge>::unpack(bridge::required(w.accepted)?)?,
            checks: <Checks as Bridge>::unpack(bridge::required(w.checks)?)?,
            used_grant: bridge::unpack_optional(w.used_grant)?,
            grant_snapshot: bridge::unpack_optional(w.grant_snapshot)?,
            creations: bridge::unpack_set(w.creations)?,
            retained_content_items: bridge::unpack_set(w.retained_content_items)?,
            establishments: bridge::unpack_set(w.establishments)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAdaptationPair {
    #[prost(message, optional, tag = "1")]
    pub adaptation: Option<WAdaptation>,
    #[prost(message, optional, tag = "2")]
    pub judgment: Option<WScopeJudgment>,
}
impl WireSchema for WAdaptationPair {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WAdaptation::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WScopeJudgment::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for (Adaptation, ScopeJudgment) {
    type Wire = WAdaptationPair;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAdaptationPair {
                adaptation: Some(self.0.pack(b)?),
                judgment: Some(self.1.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok((
            <Adaptation as Bridge>::unpack(bridge::required(w.adaptation)?)?,
            <ScopeJudgment as Bridge>::unpack(bridge::required(w.judgment)?)?,
        ))
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WNativePair {
    #[prost(message, optional, tag = "1")]
    pub request: Option<WActionRequest>,
    #[prost(message, optional, tag = "2")]
    pub conditions: Option<WNativeConditions>,
}
impl WireSchema for WNativePair {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WActionRequest::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WNativeConditions::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for (ActionRequest, NativeConditions) {
    type Wire = WNativePair;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WNativePair {
                request: Some(self.0.pack(b)?),
                conditions: Some(self.1.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok((
            <ActionRequest as Bridge>::unpack(bridge::required(w.request)?)?,
            <NativeConditions as Bridge>::unpack(bridge::required(w.conditions)?)?,
        ))
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentMap {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub key: Option<WContentKey>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub value: Option<Vec<u8>>,
}
impl WireSchema for WContentMap {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 101,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Content,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WGroundMap {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub key: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub value: Option<Vec<u8>>,
}
impl WireSchema for WGroundMap {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WRecordedMap {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub key: Option<WContentKey>,
    #[prost(message, optional, tag = "2")]
    pub value: Option<WRecordedContent>,
}
impl WireSchema for WRecordedMap {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 101,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WRecordedContent::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WActionSet {
    #[prost(bytes = "vec", repeated, tag = "1")]
    pub values: Vec<Vec<u8>>,
}
impl WireSchema for WActionSet {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[Rule {
                tag: 1,
                shape: Shape::Id,
                required: false,
                repeated: true,
                limit: 4096,
                fresh: false,
            }],
        }
    }
}
impl Bridge for BTreeSet<ActionId> {
    type Wire = WActionSet;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WActionSet {
                values: bridge::pack_set(self, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        bridge::unpack_set(w.values)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WEmpty {}
impl WireSchema for WEmpty {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[],
        }
    }
}
impl Bridge for () {
    type Wire = WEmpty;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|_| Ok(WEmpty {}))
    }
    fn unpack(_: WEmpty) -> Result<Self> {
        Ok(())
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WDecisionKindUndertake {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub assessment: Option<Vec<u8>>,
}
impl WireSchema for WDecisionKindUndertake {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[Rule {
                tag: 1,
                shape: Shape::Id,
                required: true,
                repeated: false,
                limit: 4096,
                fresh: false,
            }],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandInitiate {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub wish: Option<WContentKey>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandInitiate {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 101,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAccess::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandPropose {
    #[prost(message, optional, tag = "1")]
    pub proposal: Option<WProposal>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandPropose {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WProposal::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAccess::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandAssess {
    #[prost(message, optional, tag = "1")]
    pub assessment: Option<WAssessment>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandAssess {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WAssessment::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAccess::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandRetract {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub decision: Option<Vec<u8>>,
}
impl WireSchema for WCommandRetract {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[Rule {
                tag: 1,
                shape: Shape::Id,
                required: true,
                repeated: false,
                limit: 4096,
                fresh: false,
            }],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandReaffirm {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub decision: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub dependencies: Vec<WDependency>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub assessment: Option<Vec<u8>>,
}
impl WireSchema for WCommandReaffirm {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WDependency::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandSetGrant {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(uint64, optional, tag = "2")]
    pub expected_generation: Option<u64>,
    #[prost(message, optional, tag = "3")]
    pub spec: Option<WGrantSpec>,
}
impl WireSchema for WCommandSetGrant {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WGrantSpec::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandRevokeGrant {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(uint64, optional, tag = "2")]
    pub expected_generation: Option<u64>,
}
impl WireSchema for WCommandRevokeGrant {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Uint,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandDispatch {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub action: Option<Vec<u8>>,
}
impl WireSchema for WCommandDispatch {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[Rule {
                tag: 1,
                shape: Shape::Id,
                required: true,
                repeated: false,
                limit: 4096,
                fresh: false,
            }],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandFinding {
    #[prost(message, optional, tag = "1")]
    pub finding: Option<WFinding>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandFinding {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WFinding::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAccess::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandAdapt {
    #[prost(message, optional, tag = "1")]
    pub adaptation: Option<WAdaptation>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandAdapt {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WAdaptation::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAccess::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandProgress {
    #[prost(message, optional, tag = "1")]
    pub progress: Option<WProgress>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandProgress {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WProgress::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WAccess::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandWithdraw {
    // Tag 1 retired: unqualified content identity.
    #[prost(message, optional, tag = "101")]
    pub reason: Option<WContentKey>,
}
impl WireSchema for WCommandWithdraw {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[Rule {
                tag: 101,
                shape: Shape::Message(WContentKey::schema),
                required: true,
                repeated: false,
                limit: 4096,
                fresh: false,
            }],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommandReconcile {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub action: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub grant: Option<WGrantUse>,
    #[prost(message, repeated, tag = "3")]
    pub evidence: Vec<WEvidence>,
    #[prost(enumeration = "WActionOutcome", optional, tag = "4")]
    pub outcome: Option<i32>,
}
impl WireSchema for WCommandReconcile {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WGrantUse::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: true,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Enum(&[1, 2, 3, 4]),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WEffectDecision {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub decision: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub activated: Option<Vec<u8>>,
}
impl WireSchema for WEffectDecision {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WEffectReaffirmed {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub decision: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub activated: Option<Vec<u8>>,
}
impl WireSchema for WEffectReaffirmed {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WChangeKey {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub owner: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub ledger: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub change: Option<Vec<u8>>,
}
impl WireSchema for WChangeKey {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ChangeKey {
    type Wire = WChangeKey;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WChangeKey {
                owner: Some(self.owner.pack(b)?),
                ledger: Some(self.ledger.pack(b)?),
                change: Some(self.change.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(Self {
            owner: OwnerId::unpack(bridge::required(w.owner)?)?,
            ledger: LedgerId::unpack(bridge::required(w.ledger)?)?,
            change: ChangeId::unpack(bridge::required(w.change)?)?,
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WOperationRequest {
    #[prost(message, optional, tag = "1")]
    pub target: Option<WChangeKey>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub actor: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub represented_owner: Option<Vec<u8>>,
    #[prost(message, optional, tag = "4")]
    pub operation: Option<WOperation>,
}
impl WireSchema for WOperationRequest {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WChangeKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WOperation::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl WOperationRequest {
    pub(in crate::adapters::codec) fn pack(
        value: &OperationRequest,
        b: &mut Budget,
    ) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                target: Some(value.target.pack(b)?),
                actor: Some(value.actor.pack(b)?),
                represented_owner: Some(value.represented_owner.pack(b)?),
                operation: Some(value.operation.pack(b)?),
            })
        })
    }
    pub(in crate::adapters::codec) fn unpack(
        w: Self,
        profile: OperationRequestProfile,
    ) -> Result<OperationRequest> {
        Ok(OperationRequest {
            profile,
            target: ChangeKey::unpack(bridge::required(w.target)?)?,
            actor: ActorId::unpack(bridge::required(w.actor)?)?,
            represented_owner: OwnerId::unpack(bridge::required(w.represented_owner)?)?,
            operation: Operation::unpack(bridge::required(w.operation)?)?,
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WRecordFrame {
    #[prost(uint32, optional, tag = "1")]
    pub codec_version: Option<u32>,
    #[prost(uint32, optional, tag = "2")]
    pub schema_version: Option<u32>,
    #[prost(uint32, optional, tag = "3")]
    pub semantic_version: Option<u32>,
    #[prost(message, optional, tag = "4")]
    pub payload: Option<WStoredOperation>,
}
impl WireSchema for WRecordFrame {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Version(CODEC_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Version(SCHEMA_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Version(HISTORY_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WStoredOperation::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WRequestFrame {
    #[prost(uint32, optional, tag = "1")]
    pub codec_version: Option<u32>,
    #[prost(uint32, optional, tag = "2")]
    pub schema_version: Option<u32>,
    #[prost(uint32, optional, tag = "3")]
    pub semantic_version: Option<u32>,
    // Tag 4 (standalone Operation payload) is retired.
    #[prost(message, optional, tag = "5")]
    pub payload: Option<WOperationRequest>,
}
impl WireSchema for WRequestFrame {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Version(CODEC_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Version(SCHEMA_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Version(HISTORY_VERSION),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WOperationRequest::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Entry<ContentKey, Vec<u8>> for WContentMap {
    fn pack_entry(k: &ContentKey, v: &Vec<u8>, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                key: Some(k.pack(b)?),
                value: Some(v.pack(b)?),
            })
        })
    }
    fn unpack_entry(self) -> Result<(ContentKey, Vec<u8>)> {
        Ok((
            <ContentKey as Bridge>::unpack(bridge::required(self.key)?)?,
            <Vec<u8> as Bridge>::unpack(bridge::required(self.value)?)?,
        ))
    }
}
impl Entry<GroundId, GroundVersion> for WGroundMap {
    fn pack_entry(k: &GroundId, v: &GroundVersion, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                key: Some(k.pack(b)?),
                value: Some(v.pack(b)?),
            })
        })
    }
    fn unpack_entry(self) -> Result<(GroundId, GroundVersion)> {
        Ok((
            <GroundId as Bridge>::unpack(bridge::required(self.key)?)?,
            <GroundVersion as Bridge>::unpack(bridge::required(self.value)?)?,
        ))
    }
}
impl Entry<ContentKey, RecordedContent> for WRecordedMap {
    fn pack_entry(k: &ContentKey, v: &RecordedContent, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                key: Some(k.pack(b)?),
                value: Some(v.pack(b)?),
            })
        })
    }
    fn unpack_entry(self) -> Result<(ContentKey, RecordedContent)> {
        Ok((
            <ContentKey as Bridge>::unpack(bridge::required(self.key)?)?,
            <RecordedContent as Bridge>::unpack(bridge::required(self.value)?)?,
        ))
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WContentKey {
    #[prost(message, optional, tag = "1")]
    pub establishing: Option<WChangeKey>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub id: Option<Vec<u8>>,
}
impl WireSchema for WContentKey {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WChangeKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ContentKey {
    type Wire = WContentKey;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WContentKey {
                establishing: Some(self.establishing.pack(b)?),
                id: Some(self.id.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(Self {
            establishing: <ChangeKey as Bridge>::unpack(bridge::required(w.establishing)?)?,
            id: <ContentId as Bridge>::unpack(bridge::required(w.id)?)?,
        })
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WSourceClaim {
    #[prost(enumeration = "WInputKind", optional, tag = "1")]
    pub input_kind: Option<i32>,
    #[prost(message, optional, tag = "2")]
    pub binding_knowledge: Option<WBindingKnowledge>,
    #[prost(message, optional, tag = "3")]
    pub attribution: Option<WAttribution>,
    #[prost(bytes = "vec", optional, tag = "4")]
    pub limitations: Option<Vec<u8>>,
}
impl WireSchema for WSourceClaim {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Enum(&[1, 2]),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WBindingKnowledge::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WAttribution::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Content,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for SourceClaim {
    type Wire = WSourceClaim;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WSourceClaim {
                input_kind: Some(self.input_kind.pack(b)?),
                binding_knowledge: Some(self.binding_knowledge.pack(b)?),
                attribution: Some(self.attribution.pack(b)?),
                limitations: Some(self.limitations.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(Self {
            input_kind: InputKind::unpack(bridge::required(w.input_kind)?)?,
            binding_knowledge: BindingKnowledge::unpack(bridge::required(w.binding_knowledge)?)?,
            attribution: Attribution::unpack(bridge::required(w.attribution)?)?,
            limitations: Vec::<u8>::unpack(bridge::required(w.limitations)?)?,
        })
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WIntakeSnapshot {
    #[prost(enumeration = "WIntakeCase", optional, tag = "1")]
    pub case: Option<i32>,
    #[prost(message, optional, tag = "2")]
    pub source_claim: Option<WSourceClaim>,
    #[prost(message, optional, tag = "3")]
    pub prior_establishment: Option<WContentReference>,
}
impl WireSchema for WIntakeSnapshot {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Enum(&[1, 2, 3]),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WSourceClaim::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WContentReference::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for IntakeSnapshot {
    type Wire = WIntakeSnapshot;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        if (self.case == IntakeCase::KnownReuse) != self.prior_establishment.is_some() {
            return Err(CodecError::Presence);
        }
        b.message(|b| {
            Ok(WIntakeSnapshot {
                case: Some(self.case.pack(b)?),
                source_claim: Some(self.source_claim.pack(b)?),
                prior_establishment: bridge::pack_optional(&self.prior_establishment, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            case: IntakeCase::unpack(bridge::required(w.case)?)?,
            source_claim: SourceClaim::unpack(bridge::required(w.source_claim)?)?,
            prior_establishment: bridge::unpack_optional(w.prior_establishment)?,
        };
        if (result.case == IntakeCase::KnownReuse) != result.prior_establishment.is_some() {
            return Err(CodecError::Presence);
        }
        Ok(result)
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WIntakeEntry {
    #[prost(message, optional, tag = "1")]
    pub key: Option<WContentKey>,
    #[prost(message, optional, tag = "2")]
    pub snapshot: Option<WIntakeSnapshot>,
}
impl WireSchema for WIntakeEntry {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WContentKey::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WIntakeSnapshot::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Entry<ContentKey, IntakeSnapshot> for WIntakeEntry {
    fn pack_entry(key: &ContentKey, value: &IntakeSnapshot, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                key: Some(key.pack(b)?),
                snapshot: Some(value.pack(b)?),
            })
        })
    }
    fn unpack_entry(self) -> Result<(ContentKey, IntakeSnapshot)> {
        Ok((
            ContentKey::unpack(bridge::required(self.key)?)?,
            IntakeSnapshot::unpack(bridge::required(self.snapshot)?)?,
        ))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WInputKind {
    NewContribution = 1,
    PreExisting = 2,
}
impl Bridge for InputKind {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::NewContribution => 1,
            Self::PreExisting => 2,
        })
    }
    fn unpack(v: i32) -> Result<Self> {
        match v {
            1 => Ok(Self::NewContribution),
            2 => Ok(Self::PreExisting),
            _ => Err(CodecError::Enum),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(in crate::adapters::codec) enum WIntakeCase {
    Fresh = 1,
    FirstRetention = 2,
    KnownReuse = 3,
}
impl Bridge for IntakeCase {
    type Wire = i32;
    fn pack(&self, b: &mut Budget) -> Result<i32> {
        b.charge(1)?;
        Ok(match self {
            Self::Fresh => 1,
            Self::FirstRetention => 2,
            Self::KnownReuse => 3,
        })
    }
    fn unpack(v: i32) -> Result<Self> {
        match v {
            1 => Ok(Self::Fresh),
            2 => Ok(Self::FirstRetention),
            3 => Ok(Self::KnownReuse),
            _ => Err(CodecError::Enum),
        }
    }
}
