//! Unqualified referenced-intent source prototype; no controller or application effects.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
/// Unqualified, in-process P2 source surface. Not a supported SDK, host or durable service.
pub mod unqualified_pursuit {
    pub use crate::application::pursuit::{Pursuit, StoredOperation};
    pub use crate::application::pursuit_ports::*;
    pub use crate::kernel::change::pursuit::*;
}
#[cfg(target_os = "linux")]
pub use adapters::jsonl::store::{
    ReferencedIntentIoEvent, ReferencedIntentIoFault, ReferencedIntentIoHook,
};
#[cfg(target_os = "linux")]
pub use adapters::stdio::bridge::run as referenced_intent_bridge;
mod kernel {
    pub mod change {
        pub mod intent;
        pub mod pursuit;
    }
}
mod application {
    #[cfg(target_os = "linux")]
    pub mod change;
    pub(crate) mod ports;
    pub mod pursuit;
    pub mod pursuit_ports;
}
mod adapters {
    pub(crate) mod codec;
    #[cfg(target_os = "linux")]
    pub mod jsonl {
        pub mod store;
    }
    #[cfg(target_os = "linux")]
    pub mod stdio {
        pub mod bridge;
        pub(crate) mod session;
    }
    #[cfg(target_os = "linux")]
    pub mod linux {
        pub(crate) mod custody_fs;
        pub(crate) mod custody_identity;
    }
}
#[cfg(target_os = "linux")]
pub use adapters::stdio::session::ReferencedIntent;
#[cfg(target_os = "linux")]
impl ReferencedIntent {
    pub fn new() -> Self {
        Self::configured(None)
    }
    /// Source-test instrumentation only; the stdio bridge has no hook or auto-approval mode.
    pub fn with_io_hook(hook: ReferencedIntentIoHook) -> Self {
        Self::configured(Some(hook))
    }
    fn configured(hook: Option<ReferencedIntentIoHook>) -> Self {
        Self::assemble(
            adapters::jsonl::store::Factory { hook },
            adapters::codec::LegacyCodec,
        )
    }
}
