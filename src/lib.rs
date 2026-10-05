//! Unqualified source library: native operations and trusted-fixture JSONL opening; no controller or application effects.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
mod kernel {
    pub mod containers {
        pub mod intake;
    }
    pub mod changes {
        pub mod assessment;
        pub mod intent;
        pub mod intent_trace;
        pub mod ledger;
        pub mod opening;
    }
    pub mod state {
        pub mod file_candidate;
        pub mod source_observation;
    }
}
mod ports {
    pub mod container_intake;
    pub mod continuation;
    pub mod source_observer;
}
mod application {
    #[cfg(target_os = "linux")]
    pub mod assessment;
    pub mod file_candidate;
    pub mod intake;
    pub mod intent;
    #[cfg(target_os = "linux")]
    pub mod intent_trace;
    #[cfg(target_os = "linux")]
    pub mod ledger;
    #[cfg(target_os = "linux")]
    pub mod opening;
    pub mod source_observation;
}
mod adapters {
    #[cfg(target_os = "linux")]
    pub mod jsonl {
        pub mod intent_trace;
        pub mod ledger;
        pub mod opening;
    }
    pub mod sqlite {
        pub mod container_intake;
        pub mod continuation;
        pub mod file_candidate;
        pub mod intent;
    }
    pub mod git {
        pub mod source_observation;
    }
    #[cfg(target_os = "linux")]
    pub mod linux {
        pub mod local_packet;
    }
}
pub use adapters::git::source_observation::GitSourceObserver;
#[cfg(target_os = "linux")]
pub use adapters::jsonl::opening::{
    OpeningIoEvent, OpeningIoFault, OpeningIoHook, OpeningMode, OpeningSlot,
};
#[cfg(target_os = "linux")]
pub use adapters::linux::local_packet;
pub use adapters::sqlite::container_intake::SqliteIntake;
pub use application::file_candidate::{
    prepare as prepare_file_candidate, read as read_file_candidate,
};
pub use application::intake::Intake;
pub use application::intent::{read as read_intent, revise as revise_intent};
#[cfg(target_os = "linux")]
pub use application::opening::{OpeningGuard, OpeningHost, OpeningPermission};
pub use application::source_observation::observe as observe_committed_source;
pub use kernel::changes::intent::{IntentRevision, IntentRevisionRequest};
pub use kernel::changes::opening::OpeningError;
pub use kernel::containers::intake::{Issue, Proposal, Receipt};
pub use kernel::state::file_candidate::{
    CandidateScope, FileCandidate, FileCandidateRequest, FileEffect, ProposedFile,
};
pub use kernel::state::source_observation::{
    CommittedObservation, ObservationIssue, ObservedFile, PathResult, SourceSelection,
};
pub use ports::continuation::{
    ContinuationStore, CustodyUse, FileCandidateStore, IntentRevisionStore, SourceCustody,
};
pub use ports::source_observer::SourceObserver;

#[cfg(target_os = "linux")]
pub use application::intent_trace::IntentHost;

#[cfg(target_os = "linux")]
pub use adapters::jsonl::intent_trace::IntentWork;

#[cfg(target_os = "linux")]
pub use application::assessment::{AssessmentHost, AssessmentPolicy};

#[cfg(target_os = "linux")]
pub use adapters::jsonl::intent_trace::assessment_work::{
    AssessmentComparison, AssessmentComparisons, AssessmentWork,
};

#[cfg(target_os = "linux")]
pub use adapters::jsonl::ledger::{
    LedgerBoundary, LedgerIoEvent, LedgerIoFault, LedgerIoHook, LedgerWork,
};
#[cfg(target_os = "linux")]
pub use application::ledger::{
    LedgerCollectionPermission, LedgerGuard, LedgerHost, LedgerMemberPermission, LedgerPermission,
};
pub use kernel::changes::ledger::{LedgerGrant, LedgerGrantSpec, LedgerInput, LedgerPair};
