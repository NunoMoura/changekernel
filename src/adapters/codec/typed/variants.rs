// Checked-in typed oneof definitions and conversions; field numbers are never reused.
use super::super::bridge::{self, Bridge, Budget};
use super::super::framing::Result;
use super::super::wire::{Rule, Schema, Shape, WireSchema};
use super::messages::{
    WActionRequest, WActionSet, WCommandAdapt, WCommandAssess, WCommandDispatch, WCommandFinding,
    WCommandInitiate, WCommandProgress, WCommandPropose, WCommandReaffirm, WCommandReconcile,
    WCommandRetract, WCommandRevokeGrant, WCommandSetGrant, WCommandWithdraw, WContentKey,
    WContentOrigin, WDecision, WDecisionKindUndertake, WEffectDecision, WEffectReaffirmed, WEmpty,
    WEvidence, WFulfillment, WGrantUse, WOriginScope,
};
use crate::application::ports::ReadScope;
use crate::application::records::CreatedIdentity;
use crate::kernel::change::{
    Access, ActionId, ActionOutcome, ActionRequest, ActorId, Adaptation, AgreementId, Assessment,
    AssessmentId, Attribution, BindingKnowledge, ChangeId, Command, ContentKey, ContentOrigin,
    CriterionId, Decision, DecisionId, DecisionKind, Effect, Evidence, Finding, Fulfillment,
    GrantId, GrantSpec, GrantTarget, GrantUse, OperationId, OriginScope, OriginSelector, Progress,
    Proposal, ProposalId, ScopeJudgment, Settlement,
};
use std::collections::BTreeSet;

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WDecisionKind {
    #[prost(oneof = "w_decision_kind::Kind", tags = "1, 2")]
    pub kind: Option<w_decision_kind::Kind>,
}
pub(in crate::adapters::codec) mod w_decision_kind {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        Adopt(WEmpty),
        #[prost(message, tag = "2")]
        Undertake(WDecisionKindUndertake),
    }
}
impl WireSchema for WDecisionKind {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WDecisionKindUndertake::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for DecisionKind {
    type Wire = WDecisionKind;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WDecisionKind {
                kind: Some(match self {
                    Self::Adopt => w_decision_kind::Kind::Adopt(().pack(b)?),
                    Self::Undertake { assessment } => {
                        w_decision_kind::Kind::Undertake(WDecisionKindUndertake {
                            assessment: Some((assessment).pack(b)?),
                        })
                    }
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_decision_kind::Kind::Adopt(_) => Self::Adopt,
            w_decision_kind::Kind::Undertake(v) => Self::Undertake {
                assessment: <AssessmentId as Bridge>::unpack(bridge::required(v.assessment)?)?,
            },
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAccess {
    #[prost(oneof = "w_access::Kind", tags = "1, 2")]
    pub kind: Option<w_access::Kind>,
}
pub(in crate::adapters::codec) mod w_access {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        Owner(WEmpty),
        #[prost(message, tag = "2")]
        Grant(WGrantUse),
    }
}
impl WireSchema for WAccess {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WGrantUse::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Access {
    type Wire = WAccess;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAccess {
                kind: Some(match self {
                    Self::Owner => w_access::Kind::Owner(().pack(b)?),
                    Self::Grant(v) => w_access::Kind::Grant(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_access::Kind::Owner(_) => Self::Owner,
            w_access::Kind::Grant(v) => Self::Grant(<GrantUse as Bridge>::unpack(v)?),
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WGrantTarget {
    #[prost(oneof = "w_grant_target::Kind", tags = "1, 2, 3, 4")]
    pub kind: Option<w_grant_target::Kind>,
}
pub(in crate::adapters::codec) mod w_grant_target {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(bytes = "vec", tag = "1")]
        DraftCreation(Vec<u8>),
        #[prost(bytes = "vec", tag = "2")]
        Draft(Vec<u8>),
        #[prost(bytes = "vec", tag = "3")]
        Pursuit(Vec<u8>),
        #[prost(message, tag = "4")]
        Reconciliation(WActionSet),
    }
}
impl WireSchema for WGrantTarget {
    fn schema() -> Schema {
        Schema {
            oneof: true,
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
                    required: false,
                    repeated: false,
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
                Rule {
                    tag: 4,
                    shape: Shape::Message(WActionSet::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for GrantTarget {
    type Wire = WGrantTarget;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WGrantTarget {
                kind: Some(match self {
                    Self::DraftCreation(v) => w_grant_target::Kind::DraftCreation(v.pack(b)?),
                    Self::Draft(v) => w_grant_target::Kind::Draft(v.pack(b)?),
                    Self::Pursuit(v) => w_grant_target::Kind::Pursuit(v.pack(b)?),
                    Self::Reconciliation(v) => w_grant_target::Kind::Reconciliation(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_grant_target::Kind::DraftCreation(v) => {
                Self::DraftCreation(<ChangeId as Bridge>::unpack(v)?)
            }
            w_grant_target::Kind::Draft(v) => Self::Draft(<ChangeId as Bridge>::unpack(v)?),
            w_grant_target::Kind::Pursuit(v) => Self::Pursuit(<AgreementId as Bridge>::unpack(v)?),
            w_grant_target::Kind::Reconciliation(v) => {
                Self::Reconciliation(<BTreeSet<ActionId> as Bridge>::unpack(v)?)
            }
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WOriginSelector {
    #[prost(oneof = "w_origin_selector::Kind", tags = "1, 2")]
    pub kind: Option<w_origin_selector::Kind>,
}
pub(in crate::adapters::codec) mod w_origin_selector {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        CurrentGrant(WEmpty),
        #[prost(message, boxed, tag = "2")]
        Historical(Box<WContentOrigin>),
    }
}
impl WireSchema for WOriginSelector {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentOrigin::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for OriginSelector {
    type Wire = WOriginSelector;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WOriginSelector {
                kind: Some(match self {
                    Self::CurrentGrant => w_origin_selector::Kind::CurrentGrant(().pack(b)?),
                    Self::Historical(v) => {
                        w_origin_selector::Kind::Historical(Box::new(v.pack(b)?))
                    }
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_origin_selector::Kind::CurrentGrant(_) => Self::CurrentGrant,
            w_origin_selector::Kind::Historical(v) => {
                Self::Historical(Box::<ContentOrigin>::unpack(*v)?)
            }
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WSettlement {
    #[prost(oneof = "w_settlement::Kind", tags = "1, 2")]
    pub kind: Option<w_settlement::Kind>,
}
pub(in crate::adapters::codec) mod w_settlement {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(bytes = "vec", tag = "1")]
        Fulfilled(Vec<u8>),
        #[prost(message, tag = "2")]
        Withdrawn(WEmpty),
    }
}
impl WireSchema for WSettlement {
    fn schema() -> Schema {
        Schema {
            oneof: true,
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
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Settlement {
    type Wire = WSettlement;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WSettlement {
                kind: Some(match self {
                    Self::Fulfilled(v) => w_settlement::Kind::Fulfilled(v.pack(b)?),
                    Self::Withdrawn => w_settlement::Kind::Withdrawn(().pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_settlement::Kind::Fulfilled(v) => {
                Self::Fulfilled(<AgreementId as Bridge>::unpack(v)?)
            }
            w_settlement::Kind::Withdrawn(_) => Self::Withdrawn,
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WScopeJudgment {
    #[prost(oneof = "w_scope_judgment::Kind", tags = "1, 2, 3")]
    pub kind: Option<w_scope_judgment::Kind>,
}
pub(in crate::adapters::codec) mod w_scope_judgment {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, boxed, tag = "1")]
        WithinDiscretion(Box<WEvidence>),
        #[prost(message, tag = "2")]
        RequiresRevision(WEmpty),
        #[prost(message, tag = "3")]
        Unavailable(WEmpty),
    }
}
impl WireSchema for WScopeJudgment {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEvidence::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for ScopeJudgment {
    type Wire = WScopeJudgment;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WScopeJudgment {
                kind: Some(match self {
                    Self::WithinDiscretion(v) => {
                        w_scope_judgment::Kind::WithinDiscretion(Box::new(v.pack(b)?))
                    }
                    Self::RequiresRevision => w_scope_judgment::Kind::RequiresRevision(().pack(b)?),
                    Self::Unavailable => w_scope_judgment::Kind::Unavailable(().pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_scope_judgment::Kind::WithinDiscretion(v) => {
                Self::WithinDiscretion(<Evidence as Bridge>::unpack(*v)?)
            }
            w_scope_judgment::Kind::RequiresRevision(_) => Self::RequiresRevision,
            w_scope_judgment::Kind::Unavailable(_) => Self::Unavailable,
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WReadScope {
    #[prost(oneof = "w_read_scope::Kind", tags = "1, 2, 3, 104, 5")]
    pub kind: Option<w_read_scope::Kind>,
}
pub(in crate::adapters::codec) mod w_read_scope {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(bytes = "vec", tag = "1")]
        Change(Vec<u8>),
        #[prost(bytes = "vec", tag = "2")]
        Operation(Vec<u8>),
        #[prost(message, tag = "3")]
        Origin(WOriginScope),
        // Tag 4 retired.
        #[prost(message, tag = "104")]
        Content(WContentKey),
        #[prost(bytes = "vec", tag = "5")]
        Action(Vec<u8>),
    }
}
impl WireSchema for WReadScope {
    fn schema() -> Schema {
        Schema {
            oneof: true,
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
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WOriginScope::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 104,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
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
impl Bridge for ReadScope {
    type Wire = WReadScope;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WReadScope {
                kind: Some(match self {
                    Self::Change(v) => w_read_scope::Kind::Change(v.pack(b)?),
                    Self::Operation(v) => w_read_scope::Kind::Operation(v.pack(b)?),
                    Self::Origin(v) => w_read_scope::Kind::Origin(v.pack(b)?),
                    Self::Content(v) => w_read_scope::Kind::Content(v.pack(b)?),
                    Self::Action(v) => w_read_scope::Kind::Action(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_read_scope::Kind::Change(v) => Self::Change(<ChangeId as Bridge>::unpack(v)?),
            w_read_scope::Kind::Operation(v) => {
                Self::Operation(<OperationId as Bridge>::unpack(v)?)
            }
            w_read_scope::Kind::Origin(v) => Self::Origin(<OriginScope as Bridge>::unpack(v)?),
            w_read_scope::Kind::Content(v) => Self::Content(<ContentKey as Bridge>::unpack(v)?),
            w_read_scope::Kind::Action(v) => Self::Action(<ActionId as Bridge>::unpack(v)?),
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCreatedIdentity {
    #[prost(oneof = "w_created_identity::Kind", tags = "1, 2, 3, 4, 5, 6, 7, 8")]
    pub kind: Option<w_created_identity::Kind>,
}
pub(in crate::adapters::codec) mod w_created_identity {
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(bytes = "vec", tag = "1")]
        Operation(Vec<u8>),
        #[prost(bytes = "vec", tag = "2")]
        Proposal(Vec<u8>),
        #[prost(bytes = "vec", tag = "3")]
        Agreement(Vec<u8>),
        #[prost(bytes = "vec", tag = "4")]
        Assessment(Vec<u8>),
        #[prost(bytes = "vec", tag = "5")]
        Decision(Vec<u8>),
        #[prost(bytes = "vec", tag = "6")]
        Grant(Vec<u8>),
        #[prost(bytes = "vec", tag = "7")]
        Action(Vec<u8>),
        #[prost(bytes = "vec", tag = "8")]
        Criterion(Vec<u8>),
        // Tag 9 retired: content establishments are separate full-key claims.
    }
}
impl WireSchema for WCreatedIdentity {
    fn schema() -> Schema {
        Schema {
            oneof: true,
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
                    required: false,
                    repeated: false,
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
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
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
impl Bridge for CreatedIdentity {
    type Wire = WCreatedIdentity;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WCreatedIdentity {
                kind: Some(match self {
                    Self::Operation(v) => w_created_identity::Kind::Operation(v.pack(b)?),
                    Self::Proposal(v) => w_created_identity::Kind::Proposal(v.pack(b)?),
                    Self::Agreement(v) => w_created_identity::Kind::Agreement(v.pack(b)?),
                    Self::Assessment(v) => w_created_identity::Kind::Assessment(v.pack(b)?),
                    Self::Decision(v) => w_created_identity::Kind::Decision(v.pack(b)?),
                    Self::Grant(v) => w_created_identity::Kind::Grant(v.pack(b)?),
                    Self::Action(v) => w_created_identity::Kind::Action(v.pack(b)?),
                    Self::Criterion(v) => w_created_identity::Kind::Criterion(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_created_identity::Kind::Operation(v) => {
                Self::Operation(<OperationId as Bridge>::unpack(v)?)
            }
            w_created_identity::Kind::Proposal(v) => {
                Self::Proposal(<ProposalId as Bridge>::unpack(v)?)
            }
            w_created_identity::Kind::Agreement(v) => {
                Self::Agreement(<AgreementId as Bridge>::unpack(v)?)
            }
            w_created_identity::Kind::Assessment(v) => {
                Self::Assessment(<AssessmentId as Bridge>::unpack(v)?)
            }
            w_created_identity::Kind::Decision(v) => {
                Self::Decision(<DecisionId as Bridge>::unpack(v)?)
            }
            w_created_identity::Kind::Grant(v) => Self::Grant(<GrantId as Bridge>::unpack(v)?),
            w_created_identity::Kind::Action(v) => Self::Action(<ActionId as Bridge>::unpack(v)?),
            w_created_identity::Kind::Criterion(v) => {
                Self::Criterion(<CriterionId as Bridge>::unpack(v)?)
            }
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WCommand {
    #[prost(
        oneof = "w_command::Kind",
        tags = "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16"
    )]
    pub kind: Option<w_command::Kind>,
}
pub(in crate::adapters::codec) mod w_command {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        Initiate(WCommandInitiate),
        #[prost(message, tag = "2")]
        Propose(WCommandPropose),
        #[prost(message, boxed, tag = "3")]
        Assess(Box<WCommandAssess>),
        #[prost(message, tag = "4")]
        Decide(WDecision),
        #[prost(message, tag = "5")]
        Retract(WCommandRetract),
        #[prost(message, tag = "6")]
        Reaffirm(WCommandReaffirm),
        #[prost(message, tag = "7")]
        SetGrant(WCommandSetGrant),
        #[prost(message, tag = "8")]
        RevokeGrant(WCommandRevokeGrant),
        #[prost(message, tag = "9")]
        Admit(WActionRequest),
        #[prost(message, tag = "10")]
        Dispatch(WCommandDispatch),
        #[prost(message, tag = "11")]
        Finding(WCommandFinding),
        #[prost(message, tag = "12")]
        Adapt(WCommandAdapt),
        #[prost(message, tag = "13")]
        Progress(WCommandProgress),
        #[prost(message, tag = "14")]
        Fulfill(WFulfillment),
        #[prost(message, tag = "15")]
        Withdraw(WCommandWithdraw),
        #[prost(message, tag = "16")]
        Reconcile(WCommandReconcile),
    }
}
impl WireSchema for WCommand {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WCommandInitiate::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WCommandPropose::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 3,
                    shape: Shape::Message(WCommandAssess::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WDecision::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Message(WCommandRetract::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WCommandReaffirm::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WCommandSetGrant::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
                    shape: Shape::Message(WCommandRevokeGrant::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 9,
                    shape: Shape::Message(WActionRequest::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 10,
                    shape: Shape::Message(WCommandDispatch::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 11,
                    shape: Shape::Message(WCommandFinding::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 12,
                    shape: Shape::Message(WCommandAdapt::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 13,
                    shape: Shape::Message(WCommandProgress::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 14,
                    shape: Shape::Message(WFulfillment::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 15,
                    shape: Shape::Message(WCommandWithdraw::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 16,
                    shape: Shape::Message(WCommandReconcile::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for Command {
    type Wire = WCommand;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WCommand {
                kind: Some(match self {
                    Self::Initiate { wish, access } => {
                        w_command::Kind::Initiate(WCommandInitiate {
                            wish: Some((wish).pack(b)?),
                            access: Some((access).pack(b)?),
                        })
                    }
                    Self::Propose { proposal, access } => {
                        w_command::Kind::Propose(WCommandPropose {
                            proposal: Some((proposal).pack(b)?),
                            access: Some((access).pack(b)?),
                        })
                    }
                    Self::Assess { assessment, access } => {
                        w_command::Kind::Assess(Box::new(WCommandAssess {
                            assessment: Some((assessment).pack(b)?),
                            access: Some((access).pack(b)?),
                        }))
                    }
                    Self::Decide(v) => w_command::Kind::Decide(v.pack(b)?),
                    Self::Retract { decision } => w_command::Kind::Retract(WCommandRetract {
                        decision: Some((decision).pack(b)?),
                    }),
                    Self::Reaffirm {
                        decision,
                        dependencies,
                        assessment,
                    } => w_command::Kind::Reaffirm(WCommandReaffirm {
                        decision: Some((decision).pack(b)?),
                        dependencies: bridge::pack_list(dependencies, b)?,
                        assessment: bridge::pack_optional(assessment, b)?,
                    }),
                    Self::SetGrant {
                        id,
                        expected_generation,
                        spec,
                    } => w_command::Kind::SetGrant(WCommandSetGrant {
                        id: Some((id).pack(b)?),
                        expected_generation: bridge::pack_optional(expected_generation, b)?,
                        spec: Some((spec).pack(b)?),
                    }),
                    Self::RevokeGrant {
                        id,
                        expected_generation,
                    } => w_command::Kind::RevokeGrant(WCommandRevokeGrant {
                        id: Some((id).pack(b)?),
                        expected_generation: Some((expected_generation).pack(b)?),
                    }),
                    Self::Admit(v) => w_command::Kind::Admit(v.pack(b)?),
                    Self::Dispatch { action } => w_command::Kind::Dispatch(WCommandDispatch {
                        action: Some((action).pack(b)?),
                    }),
                    Self::Finding { finding, access } => {
                        w_command::Kind::Finding(WCommandFinding {
                            finding: Some((finding).pack(b)?),
                            access: Some((access).pack(b)?),
                        })
                    }
                    Self::Adapt { adaptation, access } => w_command::Kind::Adapt(WCommandAdapt {
                        adaptation: Some((adaptation).pack(b)?),
                        access: Some((access).pack(b)?),
                    }),
                    Self::Progress { progress, access } => {
                        w_command::Kind::Progress(WCommandProgress {
                            progress: Some((progress).pack(b)?),
                            access: Some((access).pack(b)?),
                        })
                    }
                    Self::Fulfill(v) => w_command::Kind::Fulfill(v.pack(b)?),
                    Self::Withdraw { reason } => w_command::Kind::Withdraw(WCommandWithdraw {
                        reason: Some((reason).pack(b)?),
                    }),
                    Self::Reconcile {
                        action,
                        grant,
                        evidence,
                        outcome,
                    } => w_command::Kind::Reconcile(WCommandReconcile {
                        action: Some((action).pack(b)?),
                        grant: Some((grant).pack(b)?),
                        evidence: bridge::pack_list(evidence, b)?,
                        outcome: Some((outcome).pack(b)?),
                    }),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_command::Kind::Initiate(v) => Self::Initiate {
                wish: <ContentKey as Bridge>::unpack(bridge::required(v.wish)?)?,
                access: <Access as Bridge>::unpack(bridge::required(v.access)?)?,
            },
            w_command::Kind::Propose(v) => Self::Propose {
                proposal: <Proposal as Bridge>::unpack(bridge::required(v.proposal)?)?,
                access: <Access as Bridge>::unpack(bridge::required(v.access)?)?,
            },
            w_command::Kind::Assess(v) => Self::Assess {
                assessment: <Assessment as Bridge>::unpack(bridge::required(v.assessment)?)?,
                access: <Access as Bridge>::unpack(bridge::required(v.access)?)?,
            },
            w_command::Kind::Decide(v) => Self::Decide(<Decision as Bridge>::unpack(v)?),
            w_command::Kind::Retract(v) => Self::Retract {
                decision: <DecisionId as Bridge>::unpack(bridge::required(v.decision)?)?,
            },
            w_command::Kind::Reaffirm(v) => Self::Reaffirm {
                decision: <DecisionId as Bridge>::unpack(bridge::required(v.decision)?)?,
                dependencies: bridge::unpack_list(v.dependencies)?,
                assessment: bridge::unpack_optional(v.assessment)?,
            },
            w_command::Kind::SetGrant(v) => Self::SetGrant {
                id: <GrantId as Bridge>::unpack(bridge::required(v.id)?)?,
                expected_generation: bridge::unpack_optional(v.expected_generation)?,
                spec: <GrantSpec as Bridge>::unpack(bridge::required(v.spec)?)?,
            },
            w_command::Kind::RevokeGrant(v) => Self::RevokeGrant {
                id: <GrantId as Bridge>::unpack(bridge::required(v.id)?)?,
                expected_generation: <u64 as Bridge>::unpack(bridge::required(
                    v.expected_generation,
                )?)?,
            },
            w_command::Kind::Admit(v) => Self::Admit(<ActionRequest as Bridge>::unpack(v)?),
            w_command::Kind::Dispatch(v) => Self::Dispatch {
                action: <ActionId as Bridge>::unpack(bridge::required(v.action)?)?,
            },
            w_command::Kind::Finding(v) => Self::Finding {
                finding: <Finding as Bridge>::unpack(bridge::required(v.finding)?)?,
                access: <Access as Bridge>::unpack(bridge::required(v.access)?)?,
            },
            w_command::Kind::Adapt(v) => Self::Adapt {
                adaptation: <Adaptation as Bridge>::unpack(bridge::required(v.adaptation)?)?,
                access: <Access as Bridge>::unpack(bridge::required(v.access)?)?,
            },
            w_command::Kind::Progress(v) => Self::Progress {
                progress: <Progress as Bridge>::unpack(bridge::required(v.progress)?)?,
                access: <Access as Bridge>::unpack(bridge::required(v.access)?)?,
            },
            w_command::Kind::Fulfill(v) => Self::Fulfill(<Fulfillment as Bridge>::unpack(v)?),
            w_command::Kind::Withdraw(v) => Self::Withdraw {
                reason: <ContentKey as Bridge>::unpack(bridge::required(v.reason)?)?,
            },
            w_command::Kind::Reconcile(v) => Self::Reconcile {
                action: <ActionId as Bridge>::unpack(bridge::required(v.action)?)?,
                grant: <GrantUse as Bridge>::unpack(bridge::required(v.grant)?)?,
                evidence: bridge::unpack_list(v.evidence)?,
                outcome: <ActionOutcome as Bridge>::unpack(bridge::required(v.outcome)?)?,
            },
        })
    }
}
#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WEffect {
    #[prost(
        oneof = "w_effect::Kind",
        tags = "1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13"
    )]
    pub kind: Option<w_effect::Kind>,
}
pub(in crate::adapters::codec) mod w_effect {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        Initiated(WEmpty),
        #[prost(bytes = "vec", tag = "2")]
        Proposed(Vec<u8>),
        #[prost(bytes = "vec", tag = "3")]
        Assessed(Vec<u8>),
        #[prost(message, tag = "4")]
        Decision(WEffectDecision),
        #[prost(bytes = "vec", tag = "5")]
        Retracted(Vec<u8>),
        #[prost(message, tag = "6")]
        Reaffirmed(WEffectReaffirmed),
        #[prost(message, tag = "7")]
        Grant(WGrantUse),
        #[prost(message, tag = "8")]
        Revoked(WGrantUse),
        #[prost(bytes = "vec", tag = "9")]
        Admitted(Vec<u8>),
        #[prost(bytes = "vec", tag = "10")]
        Dispatched(Vec<u8>),
        #[prost(message, tag = "11")]
        Recorded(WEmpty),
        #[prost(message, tag = "12")]
        Settled(WSettlement),
        #[prost(bytes = "vec", tag = "13")]
        Reconciled(Vec<u8>),
    }
}
impl WireSchema for WEffect {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
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
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 4,
                    shape: Shape::Message(WEffectDecision::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 5,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 6,
                    shape: Shape::Message(WEffectReaffirmed::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 7,
                    shape: Shape::Message(WGrantUse::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 8,
                    shape: Shape::Message(WGrantUse::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 9,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 10,
                    shape: Shape::Id,
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 11,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 12,
                    shape: Shape::Message(WSettlement::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 13,
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
impl Bridge for Effect {
    type Wire = WEffect;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WEffect {
                kind: Some(match self {
                    Self::Initiated => w_effect::Kind::Initiated(().pack(b)?),
                    Self::Proposed(v) => w_effect::Kind::Proposed(v.pack(b)?),
                    Self::Assessed(v) => w_effect::Kind::Assessed(v.pack(b)?),
                    Self::Decision {
                        decision,
                        activated,
                    } => w_effect::Kind::Decision(WEffectDecision {
                        decision: Some((decision).pack(b)?),
                        activated: bridge::pack_optional(activated, b)?,
                    }),
                    Self::Retracted(v) => w_effect::Kind::Retracted(v.pack(b)?),
                    Self::Reaffirmed {
                        decision,
                        activated,
                    } => w_effect::Kind::Reaffirmed(WEffectReaffirmed {
                        decision: Some((decision).pack(b)?),
                        activated: bridge::pack_optional(activated, b)?,
                    }),
                    Self::Grant(v) => w_effect::Kind::Grant(v.pack(b)?),
                    Self::Revoked(v) => w_effect::Kind::Revoked(v.pack(b)?),
                    Self::Admitted(v) => w_effect::Kind::Admitted(v.pack(b)?),
                    Self::Dispatched(v) => w_effect::Kind::Dispatched(v.pack(b)?),
                    Self::Recorded => w_effect::Kind::Recorded(().pack(b)?),
                    Self::Settled(v) => w_effect::Kind::Settled(v.pack(b)?),
                    Self::Reconciled(v) => w_effect::Kind::Reconciled(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_effect::Kind::Initiated(_) => Self::Initiated,
            w_effect::Kind::Proposed(v) => Self::Proposed(<ProposalId as Bridge>::unpack(v)?),
            w_effect::Kind::Assessed(v) => Self::Assessed(<AssessmentId as Bridge>::unpack(v)?),
            w_effect::Kind::Decision(v) => Self::Decision {
                decision: <DecisionId as Bridge>::unpack(bridge::required(v.decision)?)?,
                activated: bridge::unpack_optional(v.activated)?,
            },
            w_effect::Kind::Retracted(v) => Self::Retracted(<DecisionId as Bridge>::unpack(v)?),
            w_effect::Kind::Reaffirmed(v) => Self::Reaffirmed {
                decision: <DecisionId as Bridge>::unpack(bridge::required(v.decision)?)?,
                activated: bridge::unpack_optional(v.activated)?,
            },
            w_effect::Kind::Grant(v) => Self::Grant(<GrantUse as Bridge>::unpack(v)?),
            w_effect::Kind::Revoked(v) => Self::Revoked(<GrantUse as Bridge>::unpack(v)?),
            w_effect::Kind::Admitted(v) => Self::Admitted(<ActionId as Bridge>::unpack(v)?),
            w_effect::Kind::Dispatched(v) => Self::Dispatched(<ActionId as Bridge>::unpack(v)?),
            w_effect::Kind::Recorded(_) => Self::Recorded,
            w_effect::Kind::Settled(v) => Self::Settled(<Settlement as Bridge>::unpack(v)?),
            w_effect::Kind::Reconciled(v) => Self::Reconciled(<ActionId as Bridge>::unpack(v)?),
        })
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WBindingKnowledge {
    #[prost(oneof = "w_binding_knowledge::Kind", tags = "1,2")]
    pub kind: Option<w_binding_knowledge::Kind>,
}
pub(in crate::adapters::codec) mod w_binding_knowledge {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        NoKnownBinding(WEmpty),
        #[prost(message, tag = "2")]
        Known(WContentKey),
    }
}
impl WireSchema for WBindingKnowledge {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
                Rule {
                    tag: 2,
                    shape: Shape::Message(WContentKey::schema),
                    required: false,
                    repeated: false,
                    limit: 4096,
                    fresh: false,
                },
            ],
        }
    }
}
impl Bridge for BindingKnowledge {
    type Wire = WBindingKnowledge;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WBindingKnowledge {
                kind: Some(match self {
                    Self::NoKnownBinding => w_binding_knowledge::Kind::NoKnownBinding(().pack(b)?),
                    Self::Known(v) => w_binding_knowledge::Kind::Known(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_binding_knowledge::Kind::NoKnownBinding(_) => Self::NoKnownBinding,
            w_binding_knowledge::Kind::Known(v) => Self::Known(ContentKey::unpack(v)?),
        })
    }
}

#[derive(Clone, PartialEq, prost::Message)]
pub(in crate::adapters::codec) struct WAttribution {
    #[prost(oneof = "w_attribution::Kind", tags = "1,2")]
    pub kind: Option<w_attribution::Kind>,
}
pub(in crate::adapters::codec) mod w_attribution {
    use super::*;
    #[derive(Clone, PartialEq, prost::Oneof)]
    pub enum Kind {
        #[prost(message, tag = "1")]
        Unknown(WEmpty),
        #[prost(bytes = "vec", tag = "2")]
        Actor(Vec<u8>),
    }
}
impl WireSchema for WAttribution {
    fn schema() -> Schema {
        Schema {
            oneof: true,
            fields: &[
                Rule {
                    tag: 1,
                    shape: Shape::Message(WEmpty::schema),
                    required: false,
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
impl Bridge for Attribution {
    type Wire = WAttribution;
    fn pack(&self, b: &mut Budget) -> Result<Self::Wire> {
        b.message(|b| {
            Ok(WAttribution {
                kind: Some(match self {
                    Self::Unknown => w_attribution::Kind::Unknown(().pack(b)?),
                    Self::Actor(v) => w_attribution::Kind::Actor(v.pack(b)?),
                }),
            })
        })
    }
    fn unpack(w: Self::Wire) -> Result<Self> {
        Ok(match bridge::required(w.kind)? {
            w_attribution::Kind::Unknown(_) => Self::Unknown,
            w_attribution::Kind::Actor(v) => Self::Actor(ActorId::unpack(v)?),
        })
    }
}
