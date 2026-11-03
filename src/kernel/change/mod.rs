//! Portable Change models, content authority and pure rules.
mod content;
mod model;
mod rules;

pub use content::{
    Attribution, BindingKnowledge, ContentCreation, ContentEstablishment, ContentLimits,
    ContentOrigin, ContentUsage, FreshContent, InputKind, IntakeCase, IntakeSnapshot, OriginScope,
    OriginSelector, RecordedContent, SourceClaim,
};
pub use model::{
    Accepted, Access, Action, ActionId, ActionOutcome, ActionPhase, ActionRequest, ActorId,
    Adaptation, AgreementId, Assessment, AssessmentId, Authority, ChangeBasis, ChangeId, ChangeKey,
    Command, ContentId, ContentKey, ContentReference, ContextVersion, Criterion, CriterionEvidence,
    CriterionId, Decision, DecisionId, DecisionKind, Dependency, Disposition, Effect, Error,
    Evidence, Finding, Fulfillment, Grant, GrantAction, GrantId, GrantSpec, GrantTarget, GrantUse,
    GroundId, GroundVersion, Identity, LedgerId, LimitId, NativeActionId, NativeConditions,
    Operation, OperationId, OwnerId, Progress, ProgressDimension, ProgressValue, Proposal,
    ProposalId, Resolution, Result, ScopeId, ScopeJudgment, Settlement, Status, TermSelection,
    Terms, Unknown,
};
pub(crate) use model::{State, Validation};
