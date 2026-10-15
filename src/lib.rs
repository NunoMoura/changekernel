//! Unqualified referenced-intent source prototype; no controller or application effects.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
#[cfg(target_os = "linux")]
pub use adapters::jsonl::referenced_intent::{
    ReferencedIntentIoEvent, ReferencedIntentIoFault, ReferencedIntentIoHook,
};
#[cfg(target_os = "linux")]
pub use adapters::stdio::referenced_intent::run as referenced_intent_bridge;
#[cfg(target_os = "linux")]
pub use application::referenced_intent::ReferencedIntent;
mod kernel {
    pub mod changes {
        pub mod referenced_intent;
    }
}
mod application {
    #[cfg(target_os = "linux")]
    pub mod referenced_intent;
}
mod adapters {
    #[cfg(target_os = "linux")]
    pub mod jsonl {
        pub mod referenced_intent;
    }
    #[cfg(target_os = "linux")]
    pub mod stdio {
        pub mod referenced_intent;
    }
    #[cfg(target_os = "linux")]
    pub mod linux {
        pub(crate) mod custody_fs;
        pub(crate) mod custody_identity;
    }
}
