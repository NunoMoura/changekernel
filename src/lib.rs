//! Unqualified native library: bounded intake and committed-source reads; no host or effects.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
mod kernel {
    pub mod containers {
        pub mod intake;
    }
    pub mod changes {
        pub mod intent;
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
    pub mod file_candidate;
    pub mod intake;
    pub mod intent;
    pub mod source_observation;
}
mod adapters {
    pub mod sqlite {
        pub mod container_intake;
        pub mod continuation;
        pub mod file_candidate;
        pub mod intent;
    }
    pub mod git {
        pub mod source_observation;
    }
}
pub use adapters::git::source_observation::GitSourceObserver;
pub use adapters::sqlite::container_intake::SqliteIntake;
pub use application::file_candidate::{
    prepare as prepare_file_candidate, read as read_file_candidate,
};
pub use application::intake::Intake;
pub use application::intent::{read as read_intent, revise as revise_intent};
pub use application::source_observation::observe as observe_committed_source;
pub use kernel::changes::intent::{IntentRevision, IntentRevisionRequest};
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
