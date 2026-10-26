//! Deterministic allocation for tests only. Production callers retain adapter-generated IDs.
use changekernel::unqualified_pursuit::*;
use std::sync::atomic::{AtomicU64, Ordering};

pub trait TestId {
    fn new() -> Self;
}
static NEXT: AtomicU64 = AtomicU64::new(1);
macro_rules! ids {
    ($($id:ident),+ $(,)?) => {$(
        impl TestId for $id {
            fn new() -> Self {
                let value = NEXT.fetch_add(1, Ordering::Relaxed);
                assert_ne!(value, 0, "test ID space exhausted");
                Self::from_bytes(u128::from(value).to_be_bytes()).unwrap()
            }
        }
    )+};
}
ids!(
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
