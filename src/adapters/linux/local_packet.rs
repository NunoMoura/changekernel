//! Linux byte-and-peer boundary for the future protected local control plane.
//!
//! Packet credentials do not establish durable enrollment, source permissions,
//! domain acceptance or service qualification. The trusted host owns those guards.

/// Maximum bytes in one request or reply packet; packets are never reassembled.
pub const MAX_PACKET_BYTES: usize = 196_608;

/// Kernel-observed peer data, not a transferable authorization token.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PeerCredentials {
    pub pid: i32,
    pub uid: u32,
    pub gid: u32,
}

/// Transport outcomes, separate from domain results encoded by the dispatcher.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PacketIssue {
    Denied,
    InvalidInput,
    Unavailable,
}
