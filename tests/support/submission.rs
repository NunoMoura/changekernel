//! Explicit-submission helper for definite-outcome fixtures. Unexpected uncertainty is a test failure,
//! never silently converted into a definite refusal. Uncertainty tests use execute directly.
use changekernel::unqualified_pursuit::*;

pub trait TestSubmit {
    fn submit(&mut self, submission: Submission, ports: &mut impl Ports) -> Result<Accepted>;
}
impl TestSubmit for Pursuit {
    fn submit(&mut self, submission: Submission, ports: &mut impl Ports) -> Result<Accepted> {
        match self.execute(submission, ports) {
            Ok(accepted) => Ok(accepted),
            Err(SubmissionError::Refused(error) | SubmissionError::NotAccepted(error)) => {
                Err(error)
            }
            Err(other) => panic!("unexpected uncertain/fenced definite-outcome fixture: {other:?}"),
        }
    }
}
