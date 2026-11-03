//! Explicit-request helper for definite-outcome fixtures. Unexpected uncertainty is a test failure,
//! never silently converted into a definite refusal. Uncertainty tests use execute directly.
use changekernel::unqualified_change::{
    Accepted, Change, OperationRequest, OperationRequestError, Ports, Result,
};

pub trait TestSubmit {
    fn submit(
        &mut self,
        operation_request: OperationRequest,
        ports: &mut impl Ports,
    ) -> Result<Accepted>;
}
impl TestSubmit for Change {
    fn submit(
        &mut self,
        operation_request: OperationRequest,
        ports: &mut impl Ports,
    ) -> Result<Accepted> {
        match self.execute(operation_request, ports) {
            Ok(accepted) => Ok(accepted),
            Err(
                OperationRequestError::Refused(error) | OperationRequestError::NotAccepted(error),
            ) => Err(error),
            Err(other) => panic!("unexpected uncertain/fenced definite-outcome fixture: {other:?}"),
        }
    }
}
