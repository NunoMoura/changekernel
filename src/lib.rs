//! Unqualified native library: bounded intake and committed-source reads; no host or effects.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
mod kernel {
    pub mod containers {
        pub mod intake;
    }
    pub mod state {
        pub mod source_observation;
    }
}
mod ports {
    pub mod container_intake;
    pub mod source_observer;
}
mod application {
    pub mod intake;
    pub mod source_observation;
}
mod adapters {
    pub mod sqlite {
        pub mod container_intake;
    }
    pub mod git {
        pub mod source_observation;
    }
}
pub use adapters::git::source_observation::GitSourceObserver;
pub use adapters::sqlite::container_intake::SqliteIntake;
pub use application::intake::Intake;
pub use application::source_observation::observe as observe_committed_source;
pub use kernel::containers::intake::{Issue, Proposal, Receipt};
pub use kernel::state::source_observation::{
    CommittedObservation, ObservationIssue, ObservedFile, PathResult, SourceSelection,
};
