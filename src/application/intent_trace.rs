//! Trusted-host composition for the fresh-only profile; no controller or effects.
use crate::{
    adapters::jsonl::{
        intent_trace::{Custody, IntentWork},
        opening::{OpeningIoHook, OpeningMode, OpeningSlot},
    },
    application::opening::{OpeningGuard, OpeningPermission},
    kernel::changes::{intent_trace::reference, opening::OpeningError},
};
/// Owns pinned custody and its cooperative lock. The trusted fixture must confirm
/// predecessor exit, keep policy valid throughout calls, and never fork this host.
pub struct IntentHost {
    custody: Custody,
}
impl IntentHost {
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
    pub fn revise_intent(&mut self, json: &[u8], guard: &mut dyn OpeningGuard) -> Vec<u8> {
        self.dispatch(json, guard, "revise_intent")
    }
    pub fn inspect_intent(&mut self, json: &[u8], guard: &mut dyn OpeningGuard) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_intent")
    }
    /// Last call's trusted-fixture work counters; not selectable by request JSON.
    pub fn work(&self) -> IntentWork {
        self.custody.work()
    }
    fn dispatch(&mut self, json: &[u8], guard: &mut dyn OpeningGuard, op: &str) -> Vec<u8> {
        self.custody.reset_work();
        let answer = (|| {
            let r = self.custody.request(json)?;
            if r.op != op {
                return Err(OpeningError::Unsupported);
            }
            authorize(guard)?;
            if r.workspace_id != "workspace-1" || r.change != "change-1" {
                return Err(OpeningError::Denied);
            }
            let embedded = r
                .expected_intent
                .as_deref()
                .or(r.at.as_ref().and_then(|v| v.as_deref()));
            if embedded.is_some_and(|s| reference(s).is_none_or(|(change, _)| change != r.change)) {
                return Err(OpeningError::Denied);
            }
            let response = if op == "inspect_intent" {
                self.custody
                    .inspect(embedded.and_then(reference).map(|(_, n)| n))?
            } else {
                self.custody.mutate(&r)?
            };
            if let Err(error) = authorize(guard).and_then(|_| self.custody.delivery_cut()) {
                self.custody.discard_reply();
                return Err(error);
            }
            Ok(response)
        })();
        answer.unwrap_or_else(|error| self.custody.error_reply(error))
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
