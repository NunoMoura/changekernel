//! Trusted, explicitly supplied P2 fixture boundary. This is not production authentication,
//! durable acceptance, native permission, or a host dispatch implementation.
use crate::kernel::change::pursuit::*;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum ReadScope {
    Change(ChangeId),
    Operation(OperationId),
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
    pub materials: BTreeMap<MaterialId, Vec<u8>>,
    pub grounds: BTreeMap<GroundId, GroundVersion>,
    pub adaptation: Option<(Adaptation, ScopeJudgment)>,
    pub native: Option<(ActionRequest, NativeConditions)>,
}

pub trait Ports {
    fn context(&mut self) -> Result<Context>;
    /// Resolve exact retained contents under current internal source permissions. Identity
    /// must not be rebound to different contents, including on an original-result retry.
    fn material(&mut self, id: &MaterialId) -> Result<Vec<u8>>;
    /// Supply an immutable current version, not a text-equality guess. A changed ground
    /// receives a new version even if its contents later resemble an older observation.
    /// Missing coverage or unverifiable versions return Unavailable, never "no conflict".
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion>;
    /// An attributed, retained assessment, not an oracle about meaning or permission.
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment>;
    /// Models supported conditions only; grants and these assertions create no native rights.
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions>;
    /// Revalidate *all* checks and current disclosure at one serialization point, then accept
    /// this exact operation/result once, or return an error without accepting anything.
    /// The scoped expected operation, context version, actor/capabilities, material contents,
    /// grounds and supplied judgments must still match. No implementation of this persistence/host contract is selected here.
    fn accept(&mut self, checks: &Checks, operation: &Operation, result: &Accepted) -> Result<()>;
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
