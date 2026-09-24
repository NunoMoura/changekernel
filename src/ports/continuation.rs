//! Frozen continuation boundaries. Callers authenticate actors; stores enforce durable custody.
use crate::{
    kernel::{
        changes::intent::{IntentRevision, IntentRevisionRequest},
        containers::intake::Result,
        state::file_candidate::{CandidateScope, FileCandidate, FileCandidateRequest},
    },
    ports::container_intake::ContainerIntakeStore,
};

pub trait ContinuationStore: ContainerIntakeStore {
    /// None selects the head; Some selects a retained member of its verified history.
    fn intent_revision(
        &self,
        container: &str,
        change: &str,
        revision: Option<&str>,
        actor: &str,
    ) -> Result<IntentRevision>;
    /// Read-only preflight, not a publication permit; writers repeat this inside their transaction.
    fn check_intent_head(
        &self,
        container: &str,
        change: &str,
        expected: &str,
        actor: &str,
    ) -> Result<IntentRevision>;
}

pub trait IntentRevisionStore: ContinuationStore {
    /// Exact retries reconcile before the expected-head condition for a new append.
    fn revise_intent(
        &mut self,
        request: &IntentRevisionRequest,
        actor: &str,
    ) -> Result<IntentRevision>;
}

pub trait FileCandidateStore: ContinuationStore {
    /// Owner/current custody checks still apply. Missing retry grounds are not a cache miss.
    fn candidate_retry(
        &self,
        request: &FileCandidateRequest,
        actor: &str,
    ) -> Result<Option<FileCandidate>>;
    /// Reconcile retry, then check the expected intent head and retain all rows in one transaction.
    fn retain_candidate(&mut self, candidate: &FileCandidate, actor: &str)
        -> Result<FileCandidate>;
    fn candidate(&self, container: &str, candidate: &str, actor: &str) -> Result<FileCandidate>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CustodyUse {
    RetainAndDeliver,
    Deliver,
}

/// Trusted host policy, never deserialized from proposal content. RetainAndDeliver authorizes
/// protected non-expiring custody under this profile, not merely reading the live source.
/// The host must keep the applicable current grant valid throughout the callback (e.g. with a
/// scoped policy lock), call it exactly once if authorized, never on denial, and return its result.
/// Rust borrowing alone is not cross-process authorization or revocation enforcement.
pub trait SourceCustody {
    fn with_authorization<T>(
        &self,
        actor: &str,
        scope: &CandidateScope,
        usage: CustodyUse,
        operation: impl FnOnce() -> Result<T>,
    ) -> Result<T>;
}
