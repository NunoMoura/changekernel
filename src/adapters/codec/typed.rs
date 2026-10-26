// Checked-in typed current-format Protobuf definitions/conversions. No protoc or build-time generation.
// Tags are stable and meaningful presence is explicit. Wire types never enter the kernel.
use super::{bridge::*, wire::*, CodecError, Result, CODEC_VERSION, SCHEMA_VERSION};
use crate::unqualified_pursuit::*;
use std::collections::BTreeSet;
mod variants;
use variants::*;

#[derive(Clone, Copy, Debug, PartialEq, Eq, prost::Enumeration)]
#[repr(i32)]
pub(super) enum WGrantAction {
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
pub(super) enum WDisposition {
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
pub(super) enum WProgressValue {
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
pub(super) enum WChangeBasis {
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
pub(super) enum WActionOutcome {
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
pub(super) struct WIdentity {
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
            owner: <OwnerId as Bridge>::unpack(required(w.owner)?)?,
            owner_actor: <ActorId as Bridge>::unpack(required(w.owner_actor)?)?,
            ledger: <LedgerId as Bridge>::unpack(required(w.ledger)?)?,
            change: <ChangeId as Bridge>::unpack(required(w.change)?)?,
            agent: <ActorId as Bridge>::unpack(required(w.agent)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WDependency {
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
            ground: <GroundId as Bridge>::unpack(required(w.ground)?)?,
            version: <GroundVersion as Bridge>::unpack(required(w.version)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WEvidence {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub source: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub material: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub limitations: Option<Vec<u8>>,
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
impl Bridge for Evidence {
    type Wire = WEvidence;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WEvidence {
                source: Some(self.source.pack(b)?),
                material: Some(self.material.pack(b)?),
                limitations: Some(self.limitations.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            source: <ActorId as Bridge>::unpack(required(w.source)?)?,
            material: <MaterialId as Bridge>::unpack(required(w.material)?)?,
            limitations: <MaterialId as Bridge>::unpack(required(w.limitations)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WMaterialReference {
    #[prost(message, optional, tag = "1")]
    pub identity: Option<WIdentity>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub operation: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub material: Option<Vec<u8>>,
}
impl WireSchema for WMaterialReference {
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
impl Bridge for MaterialReference {
    type Wire = WMaterialReference;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WMaterialReference {
                identity: Some(self.identity.pack(b)?),
                operation: Some(self.operation.pack(b)?),
                material: Some(self.material.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            identity: <Identity as Bridge>::unpack(required(w.identity)?)?,
            operation: <OperationId as Bridge>::unpack(required(w.operation)?)?,
            material: <MaterialId as Bridge>::unpack(required(w.material)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WTermSelection {
    #[prost(message, optional, tag = "1")]
    pub statement: Option<WMaterialReference>,
    #[prost(message, repeated, tag = "2")]
    pub context: Vec<WMaterialReference>,
}
impl WireSchema for WTermSelection {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WMaterialReference::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WMaterialReference::schema),
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
                context: pack_set(&self.context, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            statement: <MaterialReference as Bridge>::unpack(required(w.statement)?)?,
            context: unpack_set(w.context)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WUnknown {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub question: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub bounded_by: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "3")]
    pub affected: Vec<WMaterialReference>,
}
impl WireSchema for WUnknown {
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
                    shape: Shape::Message(WMaterialReference::schema),
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
                affected: pack_set(&self.affected, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            question: <MaterialId as Bridge>::unpack(required(w.question)?)?,
            bounded_by: <MaterialId as Bridge>::unpack(required(w.bounded_by)?)?,
            affected: unpack_set(w.affected)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WCriterion {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub definition: Option<WMaterialReference>,
    #[prost(message, repeated, tag = "3")]
    pub terms: Vec<WMaterialReference>,
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
                    shape: Shape::Message(WMaterialReference::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WMaterialReference::schema),
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
                terms: pack_set(&self.terms, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <CriterionId as Bridge>::unpack(required(w.id)?)?,
            definition: <MaterialReference as Bridge>::unpack(required(w.definition)?)?,
            terms: unpack_set(w.terms)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WTerms {
    #[prost(message, repeated, tag = "1")]
    pub binding: Vec<WTermSelection>,
    #[prost(message, repeated, tag = "2")]
    pub context: Vec<WMaterialReference>,
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
                    shape: Shape::Message(WMaterialReference::schema),
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
                binding: pack_list(&self.binding, b)?,
                context: pack_set(&self.context, b)?,
                unknowns: pack_list(&self.unknowns, b)?,
                criteria: pack_list(&self.criteria, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            binding: unpack_list(w.binding)?,
            context: unpack_set(w.context)?,
            unknowns: unpack_list(w.unknowns)?,
            criteria: unpack_list(w.criteria)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WProposal {
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
                expected_agreement: pack_optional(&self.expected_agreement, b)?,
                terms: Some(self.terms.pack(b)?),
                dependencies: pack_list(&self.dependencies, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <ProposalId as Bridge>::unpack(required(w.id)?)?,
            agreement: <AgreementId as Bridge>::unpack(required(w.agreement)?)?,
            identity: <Identity as Bridge>::unpack(required(w.identity)?)?,
            expected_agreement: unpack_optional(w.expected_agreement)?,
            terms: <Terms as Bridge>::unpack(required(w.terms)?)?,
            dependencies: unpack_list(w.dependencies)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WAssessment {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub proposal: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub feasibility: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "4")]
    pub capabilities: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "5")]
    pub resources: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "6")]
    pub commitments: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "7")]
    pub coverage: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "8")]
    pub limitations: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "9")]
    pub dependencies: Vec<WDependency>,
    #[prost(bytes = "vec", repeated, tag = "10")]
    pub blockers: Vec<Vec<u8>>,
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
                Rule {
                    tag: 6,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Id,
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
                    shape: Shape::Id,
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
                    tag: 10,
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
                dependencies: pack_list(&self.dependencies, b)?,
                blockers: pack_list(&self.blockers, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <AssessmentId as Bridge>::unpack(required(w.id)?)?,
            proposal: <ProposalId as Bridge>::unpack(required(w.proposal)?)?,
            feasibility: <MaterialId as Bridge>::unpack(required(w.feasibility)?)?,
            capabilities: <MaterialId as Bridge>::unpack(required(w.capabilities)?)?,
            resources: <MaterialId as Bridge>::unpack(required(w.resources)?)?,
            commitments: <MaterialId as Bridge>::unpack(required(w.commitments)?)?,
            coverage: <MaterialId as Bridge>::unpack(required(w.coverage)?)?,
            limitations: <MaterialId as Bridge>::unpack(required(w.limitations)?)?,
            dependencies: unpack_list(w.dependencies)?,
            blockers: unpack_list(w.blockers)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WDecision {
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
                dependencies: pack_list(&self.dependencies, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <DecisionId as Bridge>::unpack(required(w.id)?)?,
            proposal: <ProposalId as Bridge>::unpack(required(w.proposal)?)?,
            kind: <DecisionKind as Bridge>::unpack(required(w.kind)?)?,
            dependencies: unpack_list(w.dependencies)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WGrantUse {
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
            id: <GrantId as Bridge>::unpack(required(w.id)?)?,
            generation: <u64 as Bridge>::unpack(required(w.generation)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WMaterialLimits {
    #[prost(uint64, optional, tag = "1")]
    pub items: Option<u64>,
    #[prost(uint64, optional, tag = "2")]
    pub payload_bytes: Option<u64>,
}
impl WireSchema for WMaterialLimits {
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
impl Bridge for MaterialLimits {
    type Wire = WMaterialLimits;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WMaterialLimits {
                items: Some(self.items.pack(b)?),
                payload_bytes: Some(self.payload_bytes.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            items: <u64 as Bridge>::unpack(required(w.items)?)?,
            payload_bytes: <u64 as Bridge>::unpack(required(w.payload_bytes)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WMaterialUsage {
    #[prost(uint64, optional, tag = "1")]
    pub items: Option<u64>,
    #[prost(uint64, optional, tag = "2")]
    pub payload_bytes: Option<u64>,
}
impl WireSchema for WMaterialUsage {
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
impl Bridge for MaterialUsage {
    type Wire = WMaterialUsage;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WMaterialUsage {
                items: Some(self.items.pack(b)?),
                payload_bytes: Some(self.payload_bytes.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            items: <u64 as Bridge>::unpack(required(w.items)?)?,
            payload_bytes: <u64 as Bridge>::unpack(required(w.payload_bytes)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WOriginScope {
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
            identity: <Identity as Bridge>::unpack(required(w.identity)?)?,
            grant: <GrantUse as Bridge>::unpack(required(w.grant)?)?,
            target: <GrantTarget as Bridge>::unpack(required(w.target)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WMaterialOrigin {
    #[prost(message, optional, tag = "1")]
    pub binding: Option<WMaterialReference>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub recorder: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub represented_owner: Option<Vec<u8>>,
    #[prost(message, optional, tag = "4")]
    pub grant: Option<WGrantUse>,
    #[prost(message, optional, tag = "5")]
    pub target: Option<WGrantTarget>,
}
impl WireSchema for WMaterialOrigin {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WMaterialReference::schema),
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
impl Bridge for MaterialOrigin {
    type Wire = WMaterialOrigin;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WMaterialOrigin {
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
            binding: <MaterialReference as Bridge>::unpack(required(w.binding)?)?,
            recorder: <ActorId as Bridge>::unpack(required(w.recorder)?)?,
            represented_owner: <OwnerId as Bridge>::unpack(required(w.represented_owner)?)?,
            grant: <GrantUse as Bridge>::unpack(required(w.grant)?)?,
            target: <GrantTarget as Bridge>::unpack(required(w.target)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WFreshMaterial {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub bytes: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub attributed_source: Option<Vec<u8>>,
}
impl WireSchema for WFreshMaterial {
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
                    shape: Shape::Material,
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
impl Bridge for FreshMaterial {
    type Wire = WFreshMaterial;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WFreshMaterial {
                id: Some(self.id.pack(b)?),
                bytes: Some(self.bytes.pack(b)?),
                attributed_source: Some(self.attributed_source.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <MaterialId as Bridge>::unpack(required(w.id)?)?,
            bytes: <Vec<u8> as Bridge>::unpack(required(w.bytes)?)?,
            attributed_source: <ActorId as Bridge>::unpack(required(w.attributed_source)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WRecordedMaterial {
    #[prost(message, optional, tag = "1")]
    pub payload: Option<WFreshMaterial>,
    #[prost(message, optional, tag = "2")]
    pub origin: Option<WMaterialOrigin>,
}
impl WireSchema for WRecordedMaterial {
    fn schema() -> Schema {
        Schema {
            oneof: false,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WFreshMaterial::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WMaterialOrigin::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for RecordedMaterial {
    type Wire = WRecordedMaterial;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WRecordedMaterial {
                payload: Some(self.payload.pack(b)?),
                origin: Some(self.origin.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            payload: <FreshMaterial as Bridge>::unpack(required(w.payload)?)?,
            origin: <MaterialOrigin as Bridge>::unpack(required(w.origin)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WMaterialCreation {
    #[prost(message, optional, tag = "1")]
    pub grant: Option<WGrant>,
    #[prost(message, repeated, tag = "2")]
    pub materials: Vec<WRecordedMap>,
    #[prost(message, optional, tag = "3")]
    pub usage: Option<WMaterialUsage>,
}
impl WireSchema for WMaterialCreation {
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
                    shape: Shape::Message(WMaterialUsage::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for MaterialCreation {
    type Wire = WMaterialCreation;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WMaterialCreation {
                grant: Some(self.grant.pack(b)?),
                materials: pack_map::<_, _, WRecordedMap>(&self.materials, b)?,
                usage: Some(self.usage.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            grant: <Grant as Bridge>::unpack(required(w.grant)?)?,
            materials: unpack_map(w.materials)?,
            usage: <MaterialUsage as Bridge>::unpack(required(w.usage)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WGrantSpec {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub recipient: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub target: Option<WGrantTarget>,
    #[prost(enumeration = "WGrantAction", repeated, packed = "false", tag = "3")]
    pub actions: Vec<i32>,
    #[prost(bytes = "vec", repeated, tag = "4")]
    pub materials: Vec<Vec<u8>>,
    #[prost(bytes = "vec", repeated, tag = "5")]
    pub disclosure: Vec<Vec<u8>>,
    #[prost(message, optional, tag = "6")]
    pub creation: Option<WMaterialLimits>,
    #[prost(message, repeated, tag = "7")]
    pub material_origins: Vec<WOriginSelector>,
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
                    tag: 4,
                    shape: Shape::Id,
                    required: false,
                    repeated: true,
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
                    shape: Shape::Message(WMaterialLimits::schema),
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
                actions: pack_set(&self.actions, b)?,
                materials: pack_set(&self.materials, b)?,
                disclosure: pack_set(&self.disclosure, b)?,
                creation: pack_optional(&self.creation, b)?,
                material_origins: pack_set(&self.material_origins, b)?,
                disclosure_origins: pack_set(&self.disclosure_origins, b)?,
                native_actions: pack_set(&self.native_actions, b)?,
                native_scope: pack_set(&self.native_scope, b)?,
                limits: pack_set(&self.limits, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            recipient: <ActorId as Bridge>::unpack(required(w.recipient)?)?,
            target: <GrantTarget as Bridge>::unpack(required(w.target)?)?,
            actions: unpack_set(w.actions)?,
            materials: unpack_set(w.materials)?,
            disclosure: unpack_set(w.disclosure)?,
            creation: unpack_optional(w.creation)?,
            material_origins: unpack_set(w.material_origins)?,
            disclosure_origins: unpack_set(w.disclosure_origins)?,
            native_actions: unpack_set(w.native_actions)?,
            native_scope: unpack_set(w.native_scope)?,
            limits: unpack_set(w.limits)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WGrant {
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
            id: <GrantId as Bridge>::unpack(required(w.id)?)?,
            generation: <u64 as Bridge>::unpack(required(w.generation)?)?,
            spec: <GrantSpec as Bridge>::unpack(required(w.spec)?)?,
            revoked: <bool as Bridge>::unpack(required(w.revoked)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WFinding {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub claim: Option<Vec<u8>>,
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
                    tag: 2,
                    shape: Shape::Id,
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
                agreement: pack_optional(&self.agreement, b)?,
                claim: Some(self.claim.pack(b)?),
                evidence: pack_list(&self.evidence, b)?,
                disposition: Some(self.disposition.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: unpack_optional(w.agreement)?,
            claim: <MaterialId as Bridge>::unpack(required(w.claim)?)?,
            evidence: unpack_list(w.evidence)?,
            disposition: <Disposition as Bridge>::unpack(required(w.disposition)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WAdaptation {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub previous_approach: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub changed_approach: Option<Vec<u8>>,
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
                grounds: pack_list(&self.grounds, b)?,
                discretion: Some(self.discretion.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: <AgreementId as Bridge>::unpack(required(w.agreement)?)?,
            previous_approach: <MaterialId as Bridge>::unpack(required(w.previous_approach)?)?,
            changed_approach: <MaterialId as Bridge>::unpack(required(w.changed_approach)?)?,
            grounds: unpack_list(w.grounds)?,
            discretion: <ScopeId as Bridge>::unpack(required(w.discretion)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WProgressDimension {
    #[prost(enumeration = "WProgressValue", optional, tag = "1")]
    pub value: Option<i32>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub assessment: Option<Vec<u8>>,
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
            value: <ProgressValue as Bridge>::unpack(required(w.value)?)?,
            assessment: <MaterialId as Bridge>::unpack(required(w.assessment)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WProgress {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub terms: Vec<WMaterialReference>,
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
                    shape: Shape::Message(WMaterialReference::schema),
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
                terms: pack_set(&self.terms, b)?,
                criteria: pack_set(&self.criteria, b)?,
                evidence: pack_list(&self.evidence, b)?,
                understanding: Some(self.understanding.pack(b)?),
                outcome: Some(self.outcome.pack(b)?),
                basis: Some(self.basis.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: <AgreementId as Bridge>::unpack(required(w.agreement)?)?,
            terms: unpack_set(w.terms)?,
            criteria: unpack_set(w.criteria)?,
            evidence: unpack_list(w.evidence)?,
            understanding: <ProgressDimension as Bridge>::unpack(required(w.understanding)?)?,
            outcome: <ProgressDimension as Bridge>::unpack(required(w.outcome)?)?,
            basis: <ChangeBasis as Bridge>::unpack(required(w.basis)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WActionRequest {
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
    #[prost(bytes = "vec", repeated, tag = "8")]
    pub conditions: Vec<Vec<u8>>,
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
                    tag: 8,
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
impl Bridge for ActionRequest {
    type Wire = WActionRequest;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WActionRequest {
                id: Some(self.id.pack(b)?),
                agreement: Some(self.agreement.pack(b)?),
                grant: Some(self.grant.pack(b)?),
                native_action: Some(self.native_action.pack(b)?),
                scope: pack_set(&self.scope, b)?,
                limits: pack_set(&self.limits, b)?,
                dependencies: pack_list(&self.dependencies, b)?,
                conditions: pack_list(&self.conditions, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <ActionId as Bridge>::unpack(required(w.id)?)?,
            agreement: <AgreementId as Bridge>::unpack(required(w.agreement)?)?,
            grant: <GrantUse as Bridge>::unpack(required(w.grant)?)?,
            native_action: <NativeActionId as Bridge>::unpack(required(w.native_action)?)?,
            scope: unpack_set(w.scope)?,
            limits: unpack_set(w.limits)?,
            dependencies: unpack_list(w.dependencies)?,
            conditions: unpack_list(w.conditions)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WCriterionEvidence {
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
                evidence: pack_list(&self.evidence, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            criterion: <CriterionId as Bridge>::unpack(required(w.criterion)?)?,
            evidence: unpack_list(w.evidence)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WResolution {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub blocker: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub evidence: Vec<WEvidence>,
}
impl WireSchema for WResolution {
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
impl Bridge for Resolution {
    type Wire = WResolution;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WResolution {
                blocker: Some(self.blocker.pack(b)?),
                evidence: pack_list(&self.evidence, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            blocker: <MaterialId as Bridge>::unpack(required(w.blocker)?)?,
            evidence: unpack_list(w.evidence)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WFulfillment {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub agreement: Option<Vec<u8>>,
    #[prost(message, repeated, tag = "2")]
    pub criteria: Vec<WCriterionEvidence>,
    #[prost(message, repeated, tag = "3")]
    pub resolutions: Vec<WResolution>,
    #[prost(bytes = "vec", optional, tag = "4")]
    pub acceptance: Option<Vec<u8>>,
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
                    tag: 4,
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
impl Bridge for Fulfillment {
    type Wire = WFulfillment;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WFulfillment {
                agreement: Some(self.agreement.pack(b)?),
                criteria: pack_list(&self.criteria, b)?,
                resolutions: pack_list(&self.resolutions, b)?,
                acceptance: Some(self.acceptance.pack(b)?),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            agreement: <AgreementId as Bridge>::unpack(required(w.agreement)?)?,
            criteria: unpack_list(w.criteria)?,
            resolutions: unpack_list(w.resolutions)?,
            acceptance: <MaterialId as Bridge>::unpack(required(w.acceptance)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WOperation {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub id: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub command: Option<WCommand>,
    #[prost(message, repeated, tag = "3")]
    pub fresh: Vec<WFreshMaterial>,
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
                    shape: Shape::Message(WFreshMaterial::schema),
                    required: false,
                    repeated: true,
                    limit: 64,
                    fresh: true,
                },
            ],
        }
    }
}
impl Bridge for Operation {
    type Wire = WOperation;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        check_fresh(&self.fresh)?;
        b.message(|b| {
            Ok(WOperation {
                id: Some(self.id.pack(b)?),
                command: Some(self.command.pack(b)?),
                fresh: pack_list(&self.fresh, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            id: <OperationId as Bridge>::unpack(required(w.id)?)?,
            command: <Command as Bridge>::unpack(required(w.command)?)?,
            fresh: unpack_list(w.fresh)?,
        };
        check_fresh(&result.fresh)?;
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WAccepted {
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
            operation: <OperationId as Bridge>::unpack(required(w.operation)?)?,
            actor: <ActorId as Bridge>::unpack(required(w.actor)?)?,
            represented_owner: <OwnerId as Bridge>::unpack(required(w.represented_owner)?)?,
            effect: <Effect as Bridge>::unpack(required(w.effect)?)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WAuthority {
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
                owner_control: pack_optional(&self.owner_control, b)?,
                agent_role: pack_optional(&self.agent_role, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            actor: <ActorId as Bridge>::unpack(required(w.actor)?)?,
            represented_owner: <OwnerId as Bridge>::unpack(required(w.represented_owner)?)?,
            owner_control: unpack_optional(w.owner_control)?,
            agent_role: unpack_optional(w.agent_role)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WNativeConditions {
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
                evidence: pack_list(&self.evidence, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            action: <ActionId as Bridge>::unpack(required(w.action)?)?,
            evidence: unpack_list(w.evidence)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WContext {
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
                disclosure: pack_set(&self.disclosure, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            version: <ContextVersion as Bridge>::unpack(required(w.version)?)?,
            authority: <Authority as Bridge>::unpack(required(w.authority)?)?,
            disclosure: unpack_set(w.disclosure)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WChecks {
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
    pub creation: Option<WMaterialCreation>,
    #[prost(message, repeated, tag = "7")]
    pub materials: Vec<WMaterialMap>,
    #[prost(message, repeated, tag = "8")]
    pub grounds: Vec<WGroundMap>,
    #[prost(message, optional, tag = "9")]
    pub adaptation: Option<WAdaptationPair>,
    #[prost(message, optional, tag = "10")]
    pub native: Option<WNativePair>,
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
                    shape: Shape::Message(WMaterialCreation::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WMaterialMap::schema),
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
                expected_operation: pack_optional(&self.expected_operation, b)?,
                context: Some(self.context.pack(b)?),
                disclosure: Some(self.disclosure.pack(b)?),
                disclosure_origin: pack_optional(&self.disclosure_origin, b)?,
                creation: pack_optional(&self.creation, b)?,
                materials: pack_map::<_, _, WMaterialMap>(&self.materials, b)?,
                grounds: pack_map::<_, _, WGroundMap>(&self.grounds, b)?,
                adaptation: pack_optional(&self.adaptation, b)?,
                native: pack_optional(&self.native, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        let result = Self {
            identity: <Identity as Bridge>::unpack(required(w.identity)?)?,
            expected_operation: unpack_optional(w.expected_operation)?,
            context: <Context as Bridge>::unpack(required(w.context)?)?,
            disclosure: <ReadScope as Bridge>::unpack(required(w.disclosure)?)?,
            disclosure_origin: unpack_optional(w.disclosure_origin)?,
            creation: unpack_optional(w.creation)?,
            materials: unpack_map(w.materials)?,
            grounds: unpack_map(w.grounds)?,
            adaptation: unpack_optional(w.adaptation)?,
            native: unpack_optional(w.native)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WStoredOperation {
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
    #[prost(bytes = "vec", repeated, tag = "9")]
    pub retained_materials: Vec<Vec<u8>>,
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
                    tag: 9,
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
impl WStoredOperation {
    pub(super) fn pack(value: &StoredOperation, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(WStoredOperation {
                semantic_version: Some(value.profile.semantic),
                sequence: Some(value.sequence.pack(b)?),
                operation: Some(value.operation.pack(b)?),
                accepted: Some(value.accepted.pack(b)?),
                checks: Some(value.checks.pack(b)?),
                used_grant: pack_optional(&value.used_grant, b)?,
                grant_snapshot: pack_optional(&value.grant_snapshot, b)?,
                creations: pack_set(&value.creations, b)?,
                retained_materials: pack_set(&value.retained_materials, b)?,
            })
        })
    }
    pub(super) fn unpack(w: Self, profile: SubmissionProfile) -> Result<StoredOperation> {
        if required(w.semantic_version)? != profile.semantic {
            return Err(CodecError::Version);
        }
        let result = StoredOperation {
            profile,
            sequence: <u64 as Bridge>::unpack(required(w.sequence)?)?,
            operation: <Operation as Bridge>::unpack(required(w.operation)?)?,
            accepted: <Accepted as Bridge>::unpack(required(w.accepted)?)?,
            checks: <Checks as Bridge>::unpack(required(w.checks)?)?,
            used_grant: unpack_optional(w.used_grant)?,
            grant_snapshot: unpack_optional(w.grant_snapshot)?,
            creations: unpack_set(w.creations)?,
            retained_materials: unpack_set(w.retained_materials)?,
        };
        Ok(result)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WAdaptationPair {
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
            <Adaptation as Bridge>::unpack(required(w.adaptation)?)?,
            <ScopeJudgment as Bridge>::unpack(required(w.judgment)?)?,
        ))
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WNativePair {
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
            <ActionRequest as Bridge>::unpack(required(w.request)?)?,
            <NativeConditions as Bridge>::unpack(required(w.conditions)?)?,
        ))
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WMaterialMap {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub key: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub value: Option<Vec<u8>>,
}
impl WireSchema for WMaterialMap {
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
                    shape: Shape::Material,
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
pub(super) struct WGroundMap {
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
pub(super) struct WRecordedMap {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub key: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub value: Option<WRecordedMaterial>,
}
impl WireSchema for WRecordedMap {
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
                    shape: Shape::Message(WRecordedMaterial::schema),
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
pub(super) struct WActionSet {
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
                values: pack_set(self, b)?,
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        unpack_set(w.values)
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WEmpty {}
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
pub(super) struct WDecisionKindUndertake {
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
pub(super) struct WCommandInitiate {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub wish: Option<Vec<u8>>,
    #[prost(message, optional, tag = "2")]
    pub access: Option<WAccess>,
}
impl WireSchema for WCommandInitiate {
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
pub(super) struct WCommandPropose {
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
pub(super) struct WCommandAssess {
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
pub(super) struct WCommandRetract {
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
pub(super) struct WCommandReaffirm {
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
pub(super) struct WCommandSetGrant {
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
pub(super) struct WCommandRevokeGrant {
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
pub(super) struct WCommandDispatch {
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
pub(super) struct WCommandFinding {
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
pub(super) struct WCommandAdapt {
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
pub(super) struct WCommandProgress {
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
pub(super) struct WCommandWithdraw {
    #[prost(bytes = "vec", optional, tag = "1")]
    pub reason: Option<Vec<u8>>,
}
impl WireSchema for WCommandWithdraw {
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
pub(super) struct WCommandReconcile {
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
pub(super) struct WEffectDecision {
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
pub(super) struct WEffectReaffirmed {
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
pub(super) struct WChangeKey {
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
            owner: OwnerId::unpack(required(w.owner)?)?,
            ledger: LedgerId::unpack(required(w.ledger)?)?,
            change: ChangeId::unpack(required(w.change)?)?,
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WSubmission {
    #[prost(message, optional, tag = "1")]
    pub target: Option<WChangeKey>,
    #[prost(bytes = "vec", optional, tag = "2")]
    pub actor: Option<Vec<u8>>,
    #[prost(bytes = "vec", optional, tag = "3")]
    pub represented_owner: Option<Vec<u8>>,
    #[prost(message, optional, tag = "4")]
    pub operation: Option<WOperation>,
}
impl WireSchema for WSubmission {
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
impl WSubmission {
    pub(super) fn pack(value: &Submission, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                target: Some(value.target.pack(b)?),
                actor: Some(value.actor.pack(b)?),
                represented_owner: Some(value.represented_owner.pack(b)?),
                operation: Some(value.operation.pack(b)?),
            })
        })
    }
    pub(super) fn unpack(w: Self, profile: SubmissionProfile) -> Result<Submission> {
        Ok(Submission {
            profile,
            target: ChangeKey::unpack(required(w.target)?)?,
            actor: ActorId::unpack(required(w.actor)?)?,
            represented_owner: OwnerId::unpack(required(w.represented_owner)?)?,
            operation: Operation::unpack(required(w.operation)?)?,
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct WRecordFrame {
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
pub(super) struct WRequestFrame {
    #[prost(uint32, optional, tag = "1")]
    pub codec_version: Option<u32>,
    #[prost(uint32, optional, tag = "2")]
    pub schema_version: Option<u32>,
    #[prost(uint32, optional, tag = "3")]
    pub semantic_version: Option<u32>,
    // Tag 4 (standalone Operation payload) is retired.
    #[prost(message, optional, tag = "5")]
    pub payload: Option<WSubmission>,
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
                    shape: Shape::Message(WSubmission::schema),
                    required: true,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Entry<MaterialId, Vec<u8>> for WMaterialMap {
    fn pack_entry(k: &MaterialId, v: &Vec<u8>, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                key: Some(k.pack(b)?),
                value: Some(v.pack(b)?),
            })
        })
    }
    fn unpack_entry(self) -> Result<(MaterialId, Vec<u8>)> {
        Ok((
            <MaterialId as Bridge>::unpack(required(self.key)?)?,
            <Vec<u8> as Bridge>::unpack(required(self.value)?)?,
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
            <GroundId as Bridge>::unpack(required(self.key)?)?,
            <GroundVersion as Bridge>::unpack(required(self.value)?)?,
        ))
    }
}
impl Entry<MaterialId, RecordedMaterial> for WRecordedMap {
    fn pack_entry(k: &MaterialId, v: &RecordedMaterial, b: &mut Budget) -> Result<Self> {
        b.message(|b| {
            Ok(Self {
                key: Some(k.pack(b)?),
                value: Some(v.pack(b)?),
            })
        })
    }
    fn unpack_entry(self) -> Result<(MaterialId, RecordedMaterial)> {
        Ok((
            <MaterialId as Bridge>::unpack(required(self.key)?)?,
            <RecordedMaterial as Bridge>::unpack(required(self.value)?)?,
        ))
    }
}
