//! Trusted fixture composition. Not an installed authentication service or controller.
use crate::{
    adapters::jsonl::opening::{decode, emit, Custody, OpeningIoHook, OpeningMode, OpeningSlot},
    kernel::changes::opening::{OpeningError, Request},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OpeningPermission {
    Allow,
    Deny,
    Unavailable,
}
/// Trusted-host current policy lease, independent of request JSON. The host must
/// hold policy valid for the entire call (including provisioning and delivery).
/// Do not implement this with a stale cached grant. Principal is authenticated by
/// the fixture host, not by this library. No subprocess may inherit custody fds.
pub trait OpeningGuard {
    fn principal(&self) -> &str;
    fn current_permission(&mut self) -> OpeningPermission;
}
/// Owns every custody descriptor and one cooperative writer lock until drop.
/// Before constructing a successor, the host must confirm predecessor exit and
/// no inherited custody handles. Do not fork an owning host or run untrusted code.
pub struct OpeningHost {
    custody: Custody,
}
impl OpeningHost {
    /// Explicit first-use, same-identity preparation resume, or non-initializing reopen.
    /// The optional concrete I/O hook is trusted test instrumentation, never client data.
    pub fn connect(
        slot: OpeningSlot,
        mode: OpeningMode,
        guard: &mut dyn OpeningGuard,
        hook: Option<OpeningIoHook>,
    ) -> Result<Self, OpeningError> {
        authorize(guard)?;
        Ok(Self {
            custody: Custody::connect(slot, mode, hook)?,
        })
    }
    pub fn open_change(&mut self, json: &[u8], guard: &mut dyn OpeningGuard) -> Vec<u8> {
        self.dispatch(json, guard, "open_change")
    }
    pub fn inspect_change(&mut self, json: &[u8], guard: &mut dyn OpeningGuard) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_change")
    }
    fn dispatch(&mut self, json: &[u8], guard: &mut dyn OpeningGuard, op: &str) -> Vec<u8> {
        let answer = (|| {
            let input: Request = decode(json).map_err(|_| OpeningError::InvalidInput)?;
            if input.op != op {
                return Err(OpeningError::Unsupported);
            }
            // No private key lookup or disclosure precedes independent current policy.
            authorize(guard)?;
            if input.workspace_id != "workspace-1" || input.change != "change-1" {
                return Err(OpeningError::Denied);
            }
            let result = match op {
                "open_change" => {
                    emit(&self.custody.open(&input)?).map_err(|_| OpeningError::Unavailable)?
                }
                "inspect_change" => self.custody.inspect()?,
                _ => return Err(OpeningError::Unsupported),
            };
            authorize(guard)?; // commitment does not confer current disclosure rights
            self.custody.delivery_cut()?;
            Ok(result)
        })();
        answer.unwrap_or_else(OpeningError::json)
    }
}
fn authorize(guard: &mut dyn OpeningGuard) -> Result<(), OpeningError> {
    match guard.current_permission() {
        OpeningPermission::Unavailable => Err(OpeningError::Unavailable),
        OpeningPermission::Deny => Err(OpeningError::Denied),
        OpeningPermission::Allow if guard.principal() == "owner-1" => Ok(()),
        OpeningPermission::Allow => Err(OpeningError::Denied),
    }
}
