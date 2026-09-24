use crate::{
    application::intake::Intake,
    kernel::{
        containers::intake::Issue as IntakeIssue,
        state::source_observation::{
            self, CommittedObservation, ObservationIssue, SourceSelection,
        },
    },
    ports::{container_intake::ContainerIntakeStore, source_observer::SourceObserver},
};

/// Access is rechecked on every read. No intake writes, capture retention or publication.
pub fn observe<S: ContainerIntakeStore, O: SourceObserver>(
    intake: &Intake<S>,
    observer: &O,
    selection: &SourceSelection,
    actor: &str,
) -> Result<CommittedObservation, ObservationIssue> {
    intake
        .open(&selection.container_id, actor)
        .map_err(|issue| match issue {
            IntakeIssue::Denied => ObservationIssue::Denied,
            IntakeIssue::InvalidInput => ObservationIssue::InvalidInput,
            IntakeIssue::Unavailable | IntakeIssue::Conflict => ObservationIssue::Unavailable,
        })?;
    if selection.container_id != observer.container_id()
        || selection.source_id != observer.source_id()
    {
        return Err(ObservationIssue::Denied);
    }
    source_observation::validate(selection, observer.allowed_paths())?;
    observer.observe(selection)
}
