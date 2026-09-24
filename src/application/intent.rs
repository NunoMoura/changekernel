//! Private intent coordination. No admission, delegation or worker execution.
use crate::{
    application::intake::Intake,
    kernel::{
        changes::intent::{self, IntentRevision, IntentRevisionRequest},
        containers::intake::{Issue, Result},
    },
    ports::continuation::{ContinuationStore, IntentRevisionStore},
};

pub fn read<S: ContinuationStore>(
    intake: &Intake<S>,
    container: &str,
    change: &str,
    revision: Option<&str>,
    actor: &str,
) -> Result<IntentRevision> {
    intake.read(container, change, actor)?;
    if revision.is_some_and(|id| !intent::valid_digest(id)) {
        return Err(Issue::InvalidInput);
    }
    intake
        .store
        .intent_revision(container, change, revision, actor)
}

pub fn revise<S: IntentRevisionStore>(
    intake: &mut Intake<S>,
    request: &IntentRevisionRequest,
    actor: &str,
) -> Result<IntentRevision> {
    intake.read(&request.container_id, &request.change_id, actor)?;
    intent::validate_request(request)?;
    intake.store.revise_intent(request, actor)
}
