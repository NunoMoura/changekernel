//! Unqualified, in-process P2 source library; no host, persistence or native execution.
/// Unqualified, in-process P2 source surface. Not a supported SDK, host or durable service.
pub mod unqualified_pursuit {
    pub use crate::application::pursuit::{Pursuit, StoredOperation};
    pub use crate::application::pursuit_ports::*;
    pub use crate::kernel::change::pursuit::*;
}
mod kernel {
    pub mod change {
        pub mod pursuit;
    }
}
mod application {
    pub mod pursuit;
    pub mod pursuit_ports;
}
