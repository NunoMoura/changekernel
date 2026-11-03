//! Explicit supplied trust. Implementors serialize ALL relevant local mutations with lock().
//! These callbacks are not H authentication or proof of an actual external source binding.
use crate::application::operation_request::OperationRequest;
use crate::application::ports::{Checks, ContentObservation, Context, IntakeRequest};
use crate::kernel::change::{
    ActionRequest, Adaptation, ContentEstablishment, Error, GroundId, GroundVersion, Identity,
    LedgerId, NativeConditions, Operation, OwnerId, RecordedContent, Result, ScopeJudgment,
};
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LedgerIdentity {
    pub owner: OwnerId,
    pub ledger: LedgerId,
}
/// Separate native custody from record/source disclosure and from domain grants.
pub enum CustodyUse<'a> {
    Bootstrap(&'a Path),
    OpenRegister(&'a Path),
    Reserve(&'a Identity),
    Allocate(&'a Identity, &'a Path),
    BindChange(&'a Identity),
    Include(&'a Identity),
    Activate(&'a Identity),
    OpenOriginal(&'a Identity, &'a Path),
    Resolve(&'a Identity, &'a OperationRequest),
    Verify(&'a Path),
    Maintain(Option<&'a Identity>),
}
/// Facts from a completely validated accepted prefix, never caller-presented establishment.
pub struct RetainedSource<'a> {
    pub bytes: &'a [u8],
    pub establishment: &'a ContentEstablishment,
    pub fresh: Option<&'a RecordedContent>,
}
pub trait LocalGuard {
    fn context(&mut self) -> Result<Context>;
    fn resolve_content(
        &mut self,
        checks: &Checks,
        request: &IntakeRequest,
        retained: Option<RetainedSource<'_>>,
    ) -> Result<ContentObservation>;
    fn authorize_intake(&mut self, checks: &Checks, operation: &Operation) -> Result<()>;
    fn disclose(&mut self, checks: &Checks) -> Result<()>;
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion>;
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment>;
    fn native_conditions(&mut self, request: &ActionRequest) -> Result<NativeConditions>;
    fn authorize_custody(
        &mut self,
        identity: &LedgerIdentity,
        action: CustodyUse<'_>,
    ) -> Result<()>;
}
/// Required relevant-resource guard. No human/model/tool waits in guarded storage cuts.
/// An original owns its boundary, not a borrow/lock of the collection register.
pub trait TrustedLocal {
    type Guard<'a>: LocalGuard
    where
        Self: 'a;
    fn lock(&mut self) -> Result<Self::Guard<'_>>;
}
impl<T: TrustedLocal> TrustedLocal for &mut T {
    type Guard<'a>
        = T::Guard<'a>
    where
        Self: 'a;
    fn lock(&mut self) -> Result<Self::Guard<'_>> {
        (**self).lock()
    }
}
pub(super) fn owner(context: &Context, ledger: &LedgerIdentity) -> Result<()> {
    let a = &context.authority;
    let control = a.owner_control.as_ref().ok_or(Error::Denied)?;
    if a.actor != control.owner_actor
        || a.represented_owner != ledger.owner
        || control.owner != ledger.owner
        || control.ledger != ledger.ledger
    {
        return Err(Error::Denied);
    }
    Ok(())
}
