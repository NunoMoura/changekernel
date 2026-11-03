//! Portable pursuit rules. No identity generation, authentication or native execution.
use super::content::{
    ContentEstablishment, ContentLimits, FreshContent, OriginSelector, RecordedContent,
};
use std::collections::{BTreeMap, BTreeSet};

macro_rules! identities {
    ($($name:ident),+ $(,)?) => {$(
        #[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
        pub struct $name([u8; 16]);
        impl $name {
            pub fn from_bytes(bytes: [u8; 16]) -> Result<Self> {
                if bytes == [0; 16] { Err(Error::Invalid) } else { Ok(Self(bytes)) }
            }
            pub fn as_bytes(&self) -> &[u8; 16] { &self.0 }
        }
        impl TryFrom<[u8; 16]> for $name {
            type Error = Error;
            fn try_from(bytes: [u8; 16]) -> Result<Self> { Self::from_bytes(bytes) }
        }
    )+};
}
// Separate value types, not a global registry. Value ordering is never history order.
identities!(
    ActorId,
    OwnerId,
    LedgerId,
    ChangeId,
    ProposalId,
    AgreementId,
    AssessmentId,
    DecisionId,
    GrantId,
    ActionId,
    OperationId,
    ContentId,
    GroundId,
    GroundVersion,
    CriterionId,
    ScopeId,
    LimitId,
    NativeActionId,
    ContextVersion
);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Error {
    Invalid,
    Conflict,
    Denied,
    Stale,
    Unavailable,
    Terminal,
    NeedsRevision,
}
impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Invalid => "invalid operation or value",
            Self::Conflict => "operation conflicts with current state",
            Self::Denied => "permission denied",
            Self::Stale => "stale state or version",
            Self::Unavailable => "required evidence or resource unavailable",
            Self::Terminal => "change is terminal",
            Self::NeedsRevision => "revision required",
        })
    }
}
impl std::error::Error for Error {}
pub type Result<T> = std::result::Result<T, Error>;
/// Entity namespace. Participant and authority bindings remain independent checks.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ChangeKey {
    pub owner: OwnerId,
    pub ledger: LedgerId,
    pub change: ChangeId,
}
/// Immutable content identity, independent of the retaining operation's local membership.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ContentKey {
    pub establishing: ChangeKey,
    pub id: ContentId,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Identity {
    pub owner: OwnerId,
    pub owner_actor: ActorId,
    pub ledger: LedgerId,
    pub change: ChangeId,
    pub agent: ActorId,
}
impl Identity {
    pub fn change_key(&self) -> ChangeKey {
        ChangeKey {
            owner: self.owner.clone(),
            ledger: self.ledger.clone(),
            change: self.change.clone(),
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Dependency {
    pub ground: GroundId,
    pub version: GroundVersion,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Evidence {
    pub source: ActorId,
    pub content: ContentKey,
    pub limitations: ContentKey,
}
/// Exact content membership in one accepted operation of this subject.
/// Only the executing operation's own bindings may be provisional until guarded acceptance.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct ContentReference {
    pub identity: Identity,
    pub operation: OperationId,
    pub content: ContentKey,
}
/// A retained proposed statement, with explicit nonbinding source/context links.
/// The kernel neither extracts requirements from prose nor infers these links.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TermSelection {
    pub statement: ContentReference,
    pub context: BTreeSet<ContentReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unknown {
    pub question: ContentKey,
    pub bounded_by: ContentKey,
    pub affected: BTreeSet<ContentReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Criterion {
    pub id: CriterionId,
    pub definition: ContentReference,
    pub terms: BTreeSet<ContentReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Terms {
    pub binding: Vec<TermSelection>,
    pub context: BTreeSet<ContentReference>,
    pub unknowns: Vec<Unknown>,
    pub criteria: Vec<Criterion>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Proposal {
    pub id: ProposalId,
    pub agreement: AgreementId,
    pub identity: Identity,
    pub expected_agreement: Option<AgreementId>,
    pub terms: Terms,
    pub dependencies: Vec<Dependency>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Assessment {
    pub id: AssessmentId,
    pub proposal: ProposalId,
    pub feasibility: ContentKey,
    pub capabilities: ContentKey,
    pub resources: ContentKey,
    pub commitments: ContentKey,
    pub coverage: ContentKey,
    pub limitations: ContentKey,
    pub dependencies: Vec<Dependency>,
    pub blockers: Vec<ContentKey>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DecisionKind {
    Adopt,
    Undertake { assessment: AssessmentId },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Decision {
    pub id: DecisionId,
    pub proposal: ProposalId,
    pub kind: DecisionKind,
    pub dependencies: Vec<Dependency>,
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct GrantUse {
    pub id: GrantId,
    pub generation: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Access {
    Owner,
    Grant(GrantUse),
}
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum GrantTarget {
    DraftCreation(ChangeId),
    Draft(ChangeId),
    Pursuit(AgreementId),
    Reconciliation(BTreeSet<ActionId>),
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum GrantAction {
    CreateDraft,
    Propose,
    Assess,
    Finding,
    Adapt,
    Progress,
    Admit,
    Dispatch,
    Reconcile,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GrantSpec {
    pub recipient: ActorId,
    pub target: GrantTarget,
    pub actions: BTreeSet<GrantAction>,
    pub content_items: BTreeSet<ContentKey>,
    pub disclosure: BTreeSet<ContentKey>,
    /// Explicit per-operation creation bounds. Absence permits retained inputs only.
    pub creation: Option<ContentLimits>,
    pub content_origins: BTreeSet<OriginSelector>,
    pub disclosure_origins: BTreeSet<OriginSelector>,
    pub native_actions: BTreeSet<NativeActionId>,
    pub native_scope: BTreeSet<ScopeId>,
    pub limits: BTreeSet<LimitId>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Grant {
    pub id: GrantId,
    pub generation: u64,
    pub spec: GrantSpec,
    pub revoked: bool,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Disposition {
    Supports,
    Challenges,
    Unknown,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Finding {
    pub agreement: Option<AgreementId>,
    pub claim: ContentKey,
    pub evidence: Vec<Evidence>,
    pub disposition: Disposition,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Adaptation {
    pub agreement: AgreementId,
    pub previous_approach: ContentKey,
    pub changed_approach: ContentKey,
    pub grounds: Vec<Evidence>,
    pub discretion: ScopeId,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProgressValue {
    Advanced,
    Unchanged,
    Regressed,
    Unknown,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ProgressDimension {
    pub value: ProgressValue,
    pub assessment: ContentKey,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChangeBasis {
    Observation,
    CorrectedUnderstanding,
    RevisedTargets,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Progress {
    pub agreement: AgreementId,
    /// Nonempty exact selection of current binding statements, never context or aliases.
    pub terms: BTreeSet<ContentReference>,
    /// Optional current criteria; progress does not accept fulfillment.
    pub criteria: BTreeSet<CriterionId>,
    pub evidence: Vec<Evidence>,
    pub understanding: ProgressDimension,
    pub outcome: ProgressDimension,
    pub basis: ChangeBasis,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ActionRequest {
    pub id: ActionId,
    pub agreement: AgreementId,
    pub grant: GrantUse,
    pub native_action: NativeActionId,
    pub scope: BTreeSet<ScopeId>,
    pub limits: BTreeSet<LimitId>,
    pub dependencies: Vec<Dependency>,
    pub conditions: Vec<ContentKey>,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActionPhase {
    Admitted,
    Dispatched,
    Reconciled,
}
/// Sourced reports, never execution proof inferred from a finding or matching state.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActionOutcome {
    Unknown,
    ReportedApplied,
    ReportedNotApplied,
    ReportedPartial,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Action {
    pub request: ActionRequest,
    pub actor: ActorId,
    pub phase: ActionPhase,
    pub admission_dependencies: Vec<Dependency>,
    pub evidence: Vec<Evidence>,
    pub outcome: ActionOutcome,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CriterionEvidence {
    pub criterion: CriterionId,
    pub evidence: Vec<Evidence>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Resolution {
    pub blocker: ContentKey,
    pub evidence: Vec<Evidence>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Fulfillment {
    pub agreement: AgreementId,
    pub criteria: Vec<CriterionEvidence>,
    pub resolutions: Vec<Resolution>,
    pub acceptance: ContentKey,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Settlement {
    Fulfilled(AgreementId),
    Withdrawn,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Command {
    Initiate {
        wish: ContentKey,
        access: Access,
    },
    Propose {
        proposal: Proposal,
        access: Access,
    },
    Assess {
        assessment: Assessment,
        access: Access,
    },
    Decide(Decision),
    Retract {
        decision: DecisionId,
    },
    Reaffirm {
        decision: DecisionId,
        dependencies: Vec<Dependency>,
        assessment: Option<AssessmentId>,
    },
    SetGrant {
        id: GrantId,
        expected_generation: Option<u64>,
        spec: GrantSpec,
    },
    RevokeGrant {
        id: GrantId,
        expected_generation: u64,
    },
    Admit(ActionRequest),
    /// Models the dispatch boundary only. It never invokes a model, tool or native action.
    Dispatch {
        action: ActionId,
    },
    Finding {
        finding: Finding,
        access: Access,
    },
    Adapt {
        adaptation: Adaptation,
        access: Access,
    },
    Progress {
        progress: Progress,
        access: Access,
    },
    Fulfill(Fulfillment),
    Withdraw {
        reason: ContentKey,
    },
    Reconcile {
        action: ActionId,
        grant: GrantUse,
        evidence: Vec<Evidence>,
        outcome: ActionOutcome,
    },
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Operation {
    pub id: OperationId,
    pub command: Command,
    pub fresh: Vec<FreshContent>,
    pub first_retention: BTreeSet<ContentKey>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Effect {
    Initiated,
    Proposed(ProposalId),
    Assessed(AssessmentId),
    Decision {
        decision: DecisionId,
        activated: Option<AgreementId>,
    },
    Retracted(DecisionId),
    Reaffirmed {
        decision: DecisionId,
        activated: Option<AgreementId>,
    },
    Grant(GrantUse),
    Revoked(GrantUse),
    Admitted(ActionId),
    Dispatched(ActionId),
    Recorded,
    Settled(Settlement),
    Reconciled(ActionId),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Accepted {
    pub operation: OperationId,
    pub actor: ActorId,
    pub represented_owner: OwnerId,
    pub effect: Effect,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Status {
    pub initiated: bool,
    pub current_agreement: Option<AgreementId>,
    pub settlement: Option<Settlement>,
    pub accepted_operations: usize,
}

/// Domain input established by application ports, not by request approval booleans.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Authority {
    pub actor: ActorId,
    pub represented_owner: OwnerId,
    pub owner_control: Option<Identity>,
    pub agent_role: Option<Identity>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ScopeJudgment {
    WithinDiscretion(Evidence),
    RequiresRevision,
    Unavailable,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NativeConditions {
    pub action: ActionId,
    pub evidence: Vec<Evidence>,
}
#[derive(Clone, Debug)]
pub(crate) struct Validation {
    pub authority: Authority,
    pub content_items: BTreeSet<ContentKey>,
    pub fresh: BTreeSet<ContentKey>,
    pub grounds: BTreeMap<GroundId, GroundVersion>,
    pub scope: Option<ScopeJudgment>,
    pub native: Option<NativeConditions>,
}
#[derive(Clone, Debug)]
pub(crate) struct EffectiveDecision {
    pub decision: Decision,
    pub actor: ActorId,
    pub retracted: bool,
    pub matched: bool,
    pub blockers: BTreeSet<ContentKey>,
}
#[derive(Clone, Debug)]
pub(crate) struct Agreement {
    pub proposal: ProposalId,
    pub adoption: DecisionId,
    pub undertaking: DecisionId,
    pub blockers: BTreeSet<ContentKey>,
}
#[derive(Clone, Debug)]
pub(crate) struct State {
    pub identity: Identity,
    pub initiated: bool,
    pub current: Option<AgreementId>,
    pub settlement: Option<Settlement>,
    pub proposals: BTreeMap<ProposalId, Proposal>,
    pub assessments: BTreeMap<AssessmentId, Assessment>,
    pub decisions: BTreeMap<DecisionId, EffectiveDecision>,
    pub agreements: BTreeMap<AgreementId, Agreement>,
    pub grants: BTreeMap<GrantId, Grant>,
    pub actions: BTreeMap<ActionId, Action>,
    pub history: BTreeMap<OperationId, (Operation, Accepted)>,
    pub last_operation: Option<OperationId>,
    pub content_items: BTreeMap<ContentKey, Vec<u8>>,
    pub created: BTreeMap<ContentKey, RecordedContent>,
    pub established: BTreeMap<ContentKey, ContentEstablishment>,
}
impl State {
    pub fn try_new(identity: Identity) -> Result<Self> {
        if identity.owner_actor == identity.agent {
            return Err(Error::Invalid);
        }
        Ok(Self {
            identity,
            initiated: false,
            current: None,
            settlement: None,
            proposals: BTreeMap::new(),
            assessments: BTreeMap::new(),
            decisions: BTreeMap::new(),
            agreements: BTreeMap::new(),
            grants: BTreeMap::new(),
            actions: BTreeMap::new(),
            history: BTreeMap::new(),
            last_operation: None,
            content_items: BTreeMap::new(),
            created: BTreeMap::new(),
            established: BTreeMap::new(),
        })
    }
    pub fn status(&self) -> Status {
        Status {
            initiated: self.initiated,
            current_agreement: self.current.clone(),
            settlement: self.settlement.clone(),
            accepted_operations: self.history.len(),
        }
    }
}
