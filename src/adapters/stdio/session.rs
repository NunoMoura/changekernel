//! Trusted-host protocol decoding and connection lifetime, shared by library and stdio.
use crate::{adapters, application, kernel};
use adapters::{
    codec::{self, envelopes, version_scan::VersionScan},
    jsonl::store::Factory,
};
use application::change::Change;
use kernel::change::intent::{Error, V};
/// Trusted host envelopes only. This is not an agent-accessible raw-envelope tool.
/// The caller supplies serialized current leases and genuine UI confirmation.
pub struct ReferencedIntent {
    change: Change<Factory, codec::LegacyCodec>,
    next: u64,
}
impl Default for ReferencedIntent {
    fn default() -> Self {
        Self::new()
    }
}
impl ReferencedIntent {
    pub(crate) fn assemble(factory: Factory, codec: codec::LegacyCodec) -> Self {
        Self {
            change: Change::new(factory, codec),
            next: 1,
        }
    }
    pub fn is_closed(&self) -> bool {
        self.change.is_closed()
    }
    pub fn close(&mut self) {
        self.change.close();
    }
    /// A protocol error closes custody and returns None. A missing reply establishes
    /// neither rollback nor non-acceptance.
    pub fn handle(&mut self, bytes: &[u8]) -> Option<Vec<u8>> {
        self.change.expire_preparation();
        if self.is_closed() || crate::VERSION != V || codec::parse::<VersionScan>(bytes).is_err() {
            self.close();
            return None;
        }
        let h = match codec::parse::<envelopes::Header>(bytes) {
            Ok(h) if h.id == self.next && h.id <= 1_000_000 => h,
            _ => {
                self.close();
                return None;
            }
        };
        self.next += 1;
        let command = match envelopes::decode(&h.kind, bytes) {
            Ok(e) => e.command(),
            Err(Error::Unsupported) => return Some(envelopes::failure(h.id, Error::Unsupported)),
            Err(_) => {
                self.close();
                return None;
            }
        };
        Some(
            self.change
                .dispatch(h.id, command)
                .unwrap_or_else(|e| envelopes::failure(h.id, e)),
        )
    }
}
