//! Supplied environment contracts, not network ports. The caller provides the trusted boundary
//! for authority, sources, judgments, guarded acceptance and disclosure. P2 fixtures supply these
//! contracts but do not establish authentic host/source enforcement, production authentication,
//! durable acceptance, native permission or a host dispatch implementation.
use super::records::StoredOperation;
use crate::kernel::change::{
    Accepted, Action, ActionId, ActionRequest, Adaptation, Authority, ChangeId, ContentCreation,
    ContentKey, ContextVersion, Error, FreshContent, GroundId, GroundVersion, Identity,
    IntakeSnapshot, NativeConditions, Operation, OperationId, OriginScope, Result, ScopeJudgment,
    SourceClaim, Status,
};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum ReadScope {
    Change(ChangeId),
    Operation(OperationId),
    /// Trusted disclosure for accepted origins in this exact scope, never provisional origins.
    Origin(OriginScope),
    Content(ContentKey),
    Action(ActionId),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Context {
    pub version: ContextVersion,
    pub authority: Authority,
    /// Internal disclosure only. These capabilities must come from the trusted boundary,
    /// never from fields in an operation, a model judgment or a caller's approval flag.
    pub disclosure: BTreeSet<ReadScope>,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Checks {
    pub identity: Identity,
    pub expected_operation: Option<OperationId>,
    pub context: Context,
    pub disclosure: ReadScope,
    /// Resolved from accepted state only, for a content read.
    pub disclosure_origin: Option<OriginScope>,
    /// Private staging, not externally resolvable content until guarded acceptance.
    pub creation: Option<ContentCreation>,
    /// The operation's exact content bindings, frozen with its acceptance. Later use of
    /// content does not add membership to an earlier operation. No creation rights follow.
    pub content_items: BTreeMap<ContentKey, Vec<u8>>,
    pub intakes: BTreeMap<ContentKey, IntakeSnapshot>,
    pub grounds: BTreeMap<GroundId, GroundVersion>,
    pub adaptation: Option<(Adaptation, ScopeJudgment)>,
    pub native: Option<(ActionRequest, NativeConditions)>,
}

/// Knowledge of the acceptance outcome, not a transport-success boolean.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Acceptance {
    Accepted,
    /// Permission, source, prefix or conflicting-reuse refusal. No historical outcome
    /// assertion follows, even when the current append did not run. Disclose nothing denied.
    Refused(Error),
    /// Authoritative resolution established noncommit of this unchanged original request.
    /// Only this outcome can permit its unchanged resubmission; absence must not be guessed
    /// from denied lookup, stale prefix, ID conflict or transport failure.
    NotAccepted(Error),
    /// Commit may have succeeded. Never convert an I/O error or lost reply to nonacceptance.
    Indeterminate,
}

pub trait Ports {
    fn context(&mut self) -> Result<Context>;
    /// Bind the requested input to the actual authorized source object/conditions independently
    /// of caller labels or proposed keys. Report known bindings even if presentation omitted them.
    /// Local accepted-prefix facts are the only supported establishment evidence in this slice.
    fn resolve_content(
        &mut self,
        checks: &Checks,
        request: &IntakeRequest,
    ) -> Result<ContentObservation>;
    /// Authorize the complete intake, including actual output and separately scoped derivation
    /// inputs, retention and source conditions. Repeat under accept's guard through commit.
    /// This publishes nothing; an API name or caller claim does not authenticate provenance.
    fn authorize_intake(&mut self, checks: &Checks, operation: &Operation) -> Result<()>;
    /// Supply an immutable current version, not a text-equality guess. A changed ground
    /// receives a new version even if its contents later resemble an older observation.
    /// Missing coverage or unverifiable versions return Unavailable, never "no conflict".
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion>;
    /// An attributed, retained assessment, not an oracle about meaning or permission.
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment>;
    /// Models supported conditions only; grants and these assertions create no native rights.
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions>;
    /// Atomically accept the COMPLETE original envelope and its controls, or report what is
    /// actually known. Revalidate all checks (including source/disclosure, context, prefix,
    /// grants/generations/limits, origins and typed ChangeKey-local entity collisions) and keep
    /// the trusted local guard serialized through commit, not just before starting a transaction.
    /// Revalidate the complete retained OperationRequest derived from the record, including profile,
    /// target and actor/owner. Check full-key establishment collisions separately from membership.
    /// Revalidate current observations against stable facts, not old classification fields;
    /// foreign evidence remains unsupported. This trait alone authenticates no real sources.
    /// Publish record, retry result, bytes, attribution, origins and usage together. No waits for
    /// humans/models/tools belong inside this cut. Accepted means committed; uncertain I/O,
    /// cancellation or lost acknowledgment means Indeterminate unless noncommit is established.
    /// Accepted certifies this exact envelope was appended at its expected prefix, not merely
    /// that its OperationId already exists. A stale instance must reopen/reconstruct to recover
    /// the original result; it cannot publish a different candidate on an ID-only duplicate.
    /// Refused carries no original-acceptance knowledge and never authorizes resubmission.
    /// The application publishes its private candidate only on Accepted, and fences uncertainty.
    fn accept(&mut self, record: &StoredOperation) -> Acceptance;
    /// Revalidate all checks, including current disclosure, before returning a read/retry.
    /// This must not append or mutate accepted history.
    fn disclose(&mut self, checks: &Checks) -> Result<()>;
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Query {
    Status,
    Operation(OperationId),
    Content(ContentKey),
    Action(ActionId),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Read {
    Status(Status),
    Operation(Option<Accepted>),
    Content(Vec<u8>),
    Action(Action),
}

/// Complete typed intake intent; neither candidate keys nor these labels establish source facts.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum IntakeRequest {
    Fresh(FreshContent),
    FirstRetention(ContentKey),
    KnownReuse(ContentKey),
}
impl IntakeRequest {
    pub fn key(&self) -> &ContentKey {
        match self {
            Self::Fresh(p) => &p.key,
            Self::FirstRetention(k) | Self::KnownReuse(k) => k,
        }
    }
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ContentObservation {
    pub bytes: Vec<u8>,
    pub source_claim: SourceClaim,
}
