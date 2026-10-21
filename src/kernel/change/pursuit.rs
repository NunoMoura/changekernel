//! Unqualified, in-process P2 rules. No durable identity, authentication or native execution.
use std::{
    collections::{BTreeMap, BTreeSet},
    fmt,
    sync::Arc,
};
mod rules;

macro_rules! identities {
    ($($name:ident),+ $(,)?) => {$(
        #[derive(Clone)]
        pub struct $name(Arc<()>);
        impl $name { pub fn new() -> Self { Self(Arc::new(())) } }
        impl Default for $name { fn default() -> Self { Self::new() } }
        impl PartialEq for $name { fn eq(&self, other: &Self) -> bool { Arc::ptr_eq(&self.0, &other.0) } }
        impl Eq for $name {}
        impl PartialOrd for $name { fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> { Some(self.cmp(other)) } }
        impl Ord for $name { fn cmp(&self, other: &Self) -> std::cmp::Ordering { Arc::as_ptr(&self.0).cmp(&Arc::as_ptr(&other.0)) } }
        impl fmt::Debug for $name { fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(concat!(stringify!($name), "(..)")) } }
    )+};
}
// These are separate handle types, not a global resource registry or a serialization grammar.
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
    MaterialId,
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
pub type Result<T> = std::result::Result<T, Error>;
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Identity {
    pub owner: OwnerId,
    pub owner_actor: ActorId,
    pub ledger: LedgerId,
    pub change: ChangeId,
    pub agent: ActorId,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Dependency {
    pub ground: GroundId,
    pub version: GroundVersion,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Evidence {
    pub source: ActorId,
    pub material: MaterialId,
    pub limitations: MaterialId,
}
/// Exact material membership in one accepted operation of this subject.
/// Only the executing operation's own bindings may be provisional until guarded acceptance.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct MaterialReference {
    pub identity: Identity,
    pub operation: OperationId,
    pub material: MaterialId,
}
/// A retained proposed statement, with explicit nonbinding source/context links.
/// The kernel neither extracts requirements from prose nor infers these links.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TermSelection {
    pub statement: MaterialReference,
    pub context: BTreeSet<MaterialReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Unknown {
    pub question: MaterialId,
    pub bounded_by: MaterialId,
    pub affected: BTreeSet<MaterialReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Criterion {
    pub id: CriterionId,
    pub definition: MaterialReference,
    pub terms: BTreeSet<MaterialReference>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Terms {
    pub binding: Vec<TermSelection>,
    pub context: BTreeSet<MaterialReference>,
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
    pub feasibility: MaterialId,
    pub capabilities: MaterialId,
    pub resources: MaterialId,
    pub commitments: MaterialId,
    pub coverage: MaterialId,
    pub limitations: MaterialId,
    pub dependencies: Vec<Dependency>,
    pub blockers: Vec<MaterialId>,
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
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GrantUse {
    pub id: GrantId,
    pub generation: u64,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Access {
    Owner,
    Grant(GrantUse),
}
#[derive(Clone, Debug, PartialEq, Eq)]
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
    pub materials: BTreeSet<MaterialId>,
    pub disclosure: BTreeSet<MaterialId>,
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
    pub claim: MaterialId,
    pub evidence: Vec<Evidence>,
    pub disposition: Disposition,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Adaptation {
    pub agreement: AgreementId,
    pub previous_approach: MaterialId,
    pub changed_approach: MaterialId,
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
    pub assessment: MaterialId,
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
    pub conditions: Vec<MaterialId>,
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
    pub blocker: MaterialId,
    pub evidence: Vec<Evidence>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Fulfillment {
    pub agreement: AgreementId,
    pub criteria: Vec<CriterionEvidence>,
    pub resolutions: Vec<Resolution>,
    pub acceptance: MaterialId,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Settlement {
    Fulfilled(AgreementId),
    Withdrawn,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Command {
    Initiate {
        wish: MaterialId,
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
        reason: MaterialId,
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
    pub blockers: BTreeSet<MaterialId>,
}
#[derive(Clone, Debug)]
pub(crate) struct Agreement {
    pub proposal: ProposalId,
    pub adoption: DecisionId,
    pub undertaking: DecisionId,
    pub blockers: BTreeSet<MaterialId>,
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
    pub materials: BTreeMap<MaterialId, Vec<u8>>,
}
impl State {
    pub fn new(identity: Identity) -> Result<Self> {
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
            materials: BTreeMap::new(),
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
