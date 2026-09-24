use crate::kernel::state::source_observation::{
    CommittedObservation, ObservationIssue, SourceSelection,
};

/// Host-installed binding; never derived from request content.
pub trait SourceObserver {
    fn container_id(&self) -> &str;
    fn source_id(&self) -> &str;
    fn allowed_paths(&self) -> &[String];
    fn observe(
        &self,
        selection: &SourceSelection,
    ) -> Result<CommittedObservation, ObservationIssue>;
}
