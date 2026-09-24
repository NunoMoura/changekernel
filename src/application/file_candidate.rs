//! Capture through a host-installed observer; private custody never publishes source changes.
use crate::{
    application::{intake::Intake, source_observation::observe},
    kernel::{
        changes::intent::valid_digest,
        containers::intake::{self, Issue, Result},
        state::{
            file_candidate::{self, FileCandidate, FileCandidateRequest},
            source_observation::{ObservationIssue, SourceSelection},
        },
    },
    ports::{
        continuation::{CustodyUse, FileCandidateStore, SourceCustody},
        source_observer::SourceObserver,
    },
};

/// installed_binding_revision is trusted host configuration paired with observer, not copied
/// from request data. Neither observer nor policy is selected by candidate content.
pub fn prepare<S: FileCandidateStore, O: SourceObserver, G: SourceCustody>(
    intake: &mut Intake<S>,
    observer: &O,
    installed_binding_revision: &str,
    custody: &G,
    request: &FileCandidateRequest,
    actor: &str,
) -> Result<FileCandidate> {
    intake.read(&request.container_id, &request.change_id, actor)?;
    file_candidate::validate_request(request)?;
    let scope = request.scope();
    custody.with_authorization(actor, &scope, CustodyUse::RetainAndDeliver, || {
        if let Some(candidate) = intake.store.candidate_retry(request, actor)? {
            file_candidate::validate_record(&candidate)?;
            if candidate.actor != actor || candidate.request != *request {
                return Err(Issue::Unavailable);
            }
            return Ok(candidate);
        }
        intake.store.check_intent_head(
            &request.container_id,
            &request.change_id,
            &request.intent_revision,
            actor,
        )?;
        if !intake::identifier(installed_binding_revision)
            || installed_binding_revision != request.binding_revision
        {
            return Err(Issue::Denied);
        }
        let observation = observe(
            intake,
            observer,
            &SourceSelection {
                container_id: request.container_id.clone(),
                source_id: request.source_id.clone(),
                commit: request.commit.clone(),
                paths: scope.paths.clone(),
            },
            actor,
        )
        .map_err(|issue| match issue {
            ObservationIssue::Denied => Issue::Denied,
            ObservationIssue::InvalidInput => Issue::InvalidInput,
            ObservationIssue::Unavailable => Issue::Unavailable,
        })?;
        file_candidate::validate_observation(request, &observation)?;
        let candidate = FileCandidate {
            candidate_id: file_candidate::identity(
                &request.container_id,
                actor,
                &request.request_id,
            ),
            actor: actor.into(),
            request: request.clone(),
            observation,
        };
        // The store must repeat the head guard inside its atomic write, not rely on the preflight.
        let retained = intake.store.retain_candidate(&candidate, actor)?;
        file_candidate::validate_record(&retained)?;
        if retained.actor != actor || retained.request != *request {
            return Err(Issue::Unavailable);
        }
        Ok(retained)
    })
}

pub fn read<S: FileCandidateStore, G: SourceCustody>(
    intake: &Intake<S>,
    custody: &G,
    container: &str,
    candidate: &str,
    actor: &str,
) -> Result<FileCandidate> {
    intake.open(container, actor)?;
    if !valid_digest(candidate) {
        return Err(Issue::InvalidInput);
    }
    let retained = intake.store.candidate(container, candidate, actor)?;
    file_candidate::validate_record(&retained)?;
    if retained.request.container_id != container
        || retained.candidate_id != candidate
        || retained.actor != actor
    {
        return Err(Issue::Unavailable);
    }
    let scope = retained.request.scope();
    custody.with_authorization(actor, &scope, CustodyUse::Deliver, || Ok(retained))
}
