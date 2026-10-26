//! Trusted, explicitly supplied P2 fixture boundary. This is not production authentication,
//! durable acceptance, native permission, or a host dispatch implementation.
use super::pursuit_records::StoredOperation;
use crate::kernel::change::pursuit::*;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum ReadScope {
    Change(ChangeId),
    Operation(OperationId),
    /// Trusted disclosure for accepted origins in this exact scope, never provisional origins.
    Origin(OriginScope),
    Material(MaterialId),
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
    /// Resolved from accepted state only, for a material read.
    pub disclosure_origin: Option<OriginScope>,
    /// Private staging, not externally resolvable material until guarded acceptance.
    pub creation: Option<MaterialCreation>,
    /// The operation's exact material bindings, frozen with its acceptance. Later use of
    /// a material does not add membership to an earlier operation. No creation rights follow.
    pub materials: BTreeMap<MaterialId, Vec<u8>>,
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
    /// Resolve exact retained contents under current internal source permissions. Identity
    /// must not be rebound to different contents, including on an original-result retry.
    fn material(&mut self, id: &MaterialId) -> Result<Vec<u8>>;
    /// Explicitly authorize exact staged payloads/attribution, retention and source conditions
    /// for this actor/owner/Change. Reject existing IDs even for equal bytes. No default allow.
    /// This check must be repeated at accept's serialization cut; it must publish nothing.
    fn authorize_creation(&mut self, checks: &Checks, operation: &Operation) -> Result<()>;
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
    /// Revalidate the complete retained Submission derived from the record, including profile,
    /// target and actor/owner. Material guards remain conservative in the current unqualified
    /// representation; this does not implement MaterialKey/intake or foreign-origin validation.
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
    Material(MaterialId),
    Action(ActionId),
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Read {
    Status(Status),
    Operation(Option<Accepted>),
    Material(Vec<u8>),
    Action(Action),
}
