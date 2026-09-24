//! Private file proposals and retained grounds; no freshness or publication authority.
use crate::kernel::{
    changes::intent::valid_digest,
    containers::intake::{self, Issue, Result},
    state::source_observation::{self, CommittedObservation, PathResult, MAX_FILE, MAX_TOTAL},
};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProposedFile {
    pub bytes: Vec<u8>,
    pub executable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileEffect {
    pub path: String,
    /// None means deletion. Read-only dependencies are listed separately.
    pub value: Option<ProposedFile>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileCandidateRequest {
    pub container_id: String,
    pub change_id: String,
    pub request_id: String,
    pub intent_revision: String,
    pub source_id: String,
    pub binding_revision: String,
    pub commit: String,
    pub effects: Vec<FileEffect>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileCandidate {
    pub candidate_id: String,
    pub actor: String,
    pub request: FileCandidateRequest,
    pub observation: CommittedObservation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CandidateScope {
    pub container_id: String,
    pub change_id: String,
    pub intent_revision: String,
    pub source_id: String,
    pub binding_revision: String,
    pub paths: Vec<String>,
}

impl FileCandidateRequest {
    /// Order is part of request identity: effects first, then explicit dependencies.
    pub fn paths(&self) -> Vec<String> {
        self.effects
            .iter()
            .map(|e| e.path.clone())
            .chain(self.dependencies.iter().cloned())
            .collect()
    }
    pub fn scope(&self) -> CandidateScope {
        CandidateScope {
            container_id: self.container_id.clone(),
            change_id: self.change_id.clone(),
            intent_revision: self.intent_revision.clone(),
            source_id: self.source_id.clone(),
            binding_revision: self.binding_revision.clone(),
            paths: self.paths(),
        }
    }
}

pub fn validate_request(request: &FileCandidateRequest) -> Result<()> {
    if !intake::identifier(&request.container_id)
        || !intake::identifier(&request.request_id)
        || !intake::identifier(&request.source_id)
        || !intake::identifier(&request.binding_revision)
        || !valid_digest(&request.change_id)
        || !valid_digest(&request.intent_revision)
        || !source_observation::valid_oid(&request.commit)
        || request.effects.is_empty()
        || request
            .effects
            .len()
            .saturating_add(request.dependencies.len())
            > 64
    {
        return Err(Issue::InvalidInput);
    }
    let mut unique = HashSet::new();
    let mut total = 0;
    for path in request
        .effects
        .iter()
        .map(|e| &e.path)
        .chain(&request.dependencies)
    {
        if !source_observation::valid_path(path) || !unique.insert(path) {
            return Err(Issue::InvalidInput);
        }
    }
    for file in request.effects.iter().filter_map(|e| e.value.as_ref()) {
        if file.bytes.len() > MAX_FILE || file.bytes.len() > MAX_TOTAL - total {
            return Err(Issue::InvalidInput);
        }
        total += file.bytes.len();
    }
    Ok(())
}

pub fn validate_observation(
    request: &FileCandidateRequest,
    observation: &CommittedObservation,
) -> Result<()> {
    if observation.container_id != request.container_id
        || observation.source_id != request.source_id
        || observation.commit != request.commit
        || observation.paths.iter().map(|p| p.0.as_str()).ne(request
            .effects
            .iter()
            .map(|e| e.path.as_str())
            .chain(request.dependencies.iter().map(String::as_str)))
    {
        return Err(Issue::Unavailable);
    }
    let mut total = 0;
    for (_, prior) in &observation.paths {
        if let PathResult::Present(file) = prior {
            if file.bytes.len() > MAX_FILE
                || file.bytes.len() > MAX_TOTAL - total
                || !source_observation::valid_oid(&file.object_id)
                || file.object_id.len() != request.commit.len()
                || file.fingerprint != source_observation::fingerprint(&file.bytes)
            {
                return Err(Issue::Unavailable);
            }
            total += file.bytes.len();
        }
    }
    for (effect, (_, prior)) in request.effects.iter().zip(&observation.paths) {
        if effect.value.is_none() && matches!(prior, PathResult::Absent) {
            return Err(Issue::Conflict);
        }
    }
    Ok(())
}

pub fn identity(container: &str, actor: &str, request: &str) -> String {
    intake::digest(
        "changekernel.native-file-candidate.id@1",
        &[container, actor, request],
        None,
    )
}

// All fields (including binary values and counts) are length-prefixed; no JSON normalization.
fn field(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_be_bytes());
    hash.update(bytes);
}
fn request_hash(request: &FileCandidateRequest, actor: &str) -> Sha256 {
    let mut hash = Sha256::new();
    for value in [
        "changekernel.native-file-candidate.request@1",
        &request.container_id,
        &request.change_id,
        actor,
        &request.request_id,
        &request.intent_revision,
        &request.source_id,
        &request.binding_revision,
        &request.commit,
    ] {
        field(&mut hash, value.as_bytes());
    }
    field(&mut hash, &(request.effects.len() as u64).to_be_bytes());
    for effect in &request.effects {
        field(&mut hash, effect.path.as_bytes());
        match &effect.value {
            None => field(&mut hash, &[0]),
            Some(file) => {
                field(&mut hash, &[1]);
                field(&mut hash, &file.bytes);
                field(&mut hash, &[u8::from(file.executable)]);
            }
        }
    }
    field(
        &mut hash,
        &(request.dependencies.len() as u64).to_be_bytes(),
    );
    for path in &request.dependencies {
        field(&mut hash, path.as_bytes());
    }
    hash
}

impl FileCandidateRequest {
    /// Versioned request identity only; a matching digest grants no authority.
    pub fn digest(&self, actor: &str) -> String {
        format!("{:x}", request_hash(self, actor).finalize())
    }
}

impl FileCandidate {
    pub fn integrity(&self) -> String {
        let candidate = self;
        let mut hash = request_hash(&candidate.request, &candidate.actor);
        field(&mut hash, b"changekernel.native-file-candidate.record@1");
        field(&mut hash, candidate.candidate_id.as_bytes());
        for (path, prior) in &candidate.observation.paths {
            field(&mut hash, path.as_bytes());
            match prior {
                PathResult::Absent => field(&mut hash, &[0]),
                PathResult::Present(file) => {
                    field(&mut hash, &[1]);
                    field(&mut hash, &file.bytes);
                    field(&mut hash, &[u8::from(file.executable)]);
                    field(&mut hash, file.object_id.as_bytes());
                    field(&mut hash, file.fingerprint.as_bytes());
                }
            }
        }
        format!("{:x}", hash.finalize())
    }
}

pub fn validate_record(candidate: &FileCandidate) -> Result<()> {
    if !intake::identifier(&candidate.actor)
        || candidate.candidate_id
            != identity(
                &candidate.request.container_id,
                &candidate.actor,
                &candidate.request.request_id,
            )
        || validate_request(&candidate.request).is_err()
        || validate_observation(&candidate.request, &candidate.observation).is_err()
    {
        return Err(Issue::Unavailable);
    }
    Ok(())
}
