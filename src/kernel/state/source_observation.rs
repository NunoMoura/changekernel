//! Committed views only. Bytes are data, never instructions or executable configuration.
use sha2::{Digest, Sha256};

pub const MAX_FILE: usize = 1_048_576;
pub const MAX_TOTAL: usize = 8_388_608;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ObservationIssue {
    InvalidInput,
    Denied,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceSelection {
    pub container_id: String,
    pub source_id: String,
    pub commit: String,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObservedFile {
    pub bytes: Vec<u8>,
    pub executable: bool,
    pub object_id: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PathResult {
    Present(ObservedFile),
    Absent,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommittedObservation {
    pub container_id: String,
    pub source_id: String,
    pub commit: String,
    /// Requested paths only, in request order; no working-tree or ref freshness claim.
    pub paths: Vec<(String, PathResult)>,
}

pub fn valid_oid(s: &str) -> bool {
    (s.len() == 40 || s.len() == 64) && s.bytes().all(|b| b.is_ascii_hexdigit())
}

pub fn valid_path(path: &str) -> bool {
    !path.is_empty()
        && path.len() <= 1024
        && !path.starts_with('/')
        && !path.contains('\\')
        && !path.chars().any(char::is_control)
        && path
            .split('/')
            .all(|part| !part.is_empty() && part != "." && part != ".." && part != ".git")
}

pub fn validate(selection: &SourceSelection, allowed: &[String]) -> Result<(), ObservationIssue> {
    use crate::kernel::containers::intake::identifier;
    if !identifier(&selection.container_id)
        || !identifier(&selection.source_id)
        || !valid_oid(&selection.commit)
        || selection.paths.len() > 64
        || selection
            .paths
            .iter()
            .any(|p| !valid_path(p) || !allowed.contains(p))
    {
        return Err(ObservationIssue::InvalidInput);
    }
    let mut unique = std::collections::HashSet::new();
    if !selection.paths.iter().all(|p| unique.insert(p)) {
        return Err(ObservationIssue::InvalidInput);
    }
    Ok(())
}

pub fn fingerprint(bytes: &[u8]) -> String {
    format!("sha256@1:{:x}", Sha256::digest(bytes))
}
