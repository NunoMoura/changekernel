//! Unqualified native library: bounded intake custody, no host or effects.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
mod kernel {
    pub mod containers {
        pub mod intake;
    }
}
mod ports {
    pub mod container_intake;
}
mod application {
    pub mod intake;
}
mod adapters {
    pub mod sqlite {
        pub mod container_intake;
    }
}
pub use adapters::sqlite::container_intake::SqliteIntake;
pub use application::intake::Intake;
pub use kernel::containers::intake::{Issue, Proposal, Receipt};
