//! Independently selected fresh-only deterministic assessment fixture.
use crate::{
    adapters::jsonl::{
        intent_trace::{
            assessment_work::{self as observation, AssessmentWork},
            Custody, ReadKind,
        },
        opening::{OpeningIoHook, OpeningMode, OpeningSlot},
    },
    application::opening::{OpeningGuard, OpeningPermission},
    kernel::changes::{intent_trace::reference, opening::OpeningError},
};
/// Independent trusted-composition selection; never request JSON authority.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AssessmentPolicy {
    Unavailable,
    NoticeWhat80,
}
/// Owns pinned descriptors and cooperative custody. Do not fork an owning host.
pub struct AssessmentHost {
    custody: Custody,
    work: AssessmentWork,
}
impl AssessmentHost {
    pub fn connect(
        slot: OpeningSlot,
        mode: OpeningMode,
        policy: AssessmentPolicy,
        guard: &mut dyn OpeningGuard,
        hook: Option<OpeningIoHook>,
    ) -> Result<Self, OpeningError> {
        Self::connect_observed(slot, mode, policy, guard, hook).0
    }
    /// Connection observation survives refusal before a host exists.
    pub fn connect_observed(
        slot: OpeningSlot,
        mode: OpeningMode,
        policy: AssessmentPolicy,
        guard: &mut dyn OpeningGuard,
        hook: Option<OpeningIoHook>,
    ) -> (Result<Self, OpeningError>, AssessmentWork) {
        observation::begin();
        let result = (|| {
            observation::field_attempt(32);
            let selected = policy == AssessmentPolicy::NoticeWhat80;
            observation::field_complete(selected);
            if !selected {
                return Err(OpeningError::Unavailable);
            }
            authorize(guard)?;
            Ok(Self {
                custody: Custody::connect_assessment(slot, mode, hook)?,
                work: AssessmentWork::default(),
            })
        })();
        let work = observation::finish_connection();
        (result, work)
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
    pub fn assess_intent(&mut self, json: &[u8], guard: &mut dyn OpeningGuard) -> Vec<u8> {
        self.dispatch(json, guard, "assess_intent")
    }
    pub fn inspect_assessment(&mut self, json: &[u8], guard: &mut dyn OpeningGuard) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_assessment")
    }
    pub fn work(&self) -> AssessmentWork {
        self.work
    }
    fn dispatch(&mut self, json: &[u8], guard: &mut dyn OpeningGuard, op: &str) -> Vec<u8> {
        observation::begin();
        self.custody.reset_work();
        let answer = (|| {
            let r = self.custody.assessment_request(json)?;
            observation::field_attempt(64);
            let matching = r.op == op && (r.v == 3 || r.op == "open_change");
            observation::field_complete(matching);
            if !matching {
                return Err(OpeningError::Unsupported);
            }
            authorize(guard)?;
            observation::field_attempt(20);
            let scoped = r.workspace_id == "workspace-1" && r.change == "change-1";
            observation::field_complete(scoped);
            if !scoped {
                return Err(OpeningError::Denied);
            }
            let embedded = r
                .expected_intent
                .as_deref()
                .or(r.at.as_ref().and_then(|s| s.as_deref()));
            observation::field_attempt(71);
            let foreign =
                embedded.is_some_and(|s| reference(s).is_none_or(|(change, _)| change != r.change));
            observation::field_complete(!foreign);
            if foreign {
                return Err(OpeningError::Denied);
            }
            let response = match op {
                "inspect_intent" | "inspect_assessment" => self.custody.inspect_kind(
                    embedded.and_then(reference).map(|(_, n)| n),
                    if op == "inspect_intent" {
                        ReadKind::Intent
                    } else {
                        ReadKind::Assessment
                    },
                )?,
                _ => self.custody.mutate(&r)?,
            };
            if let Err(error) = authorize(guard).and_then(|_| self.custody.delivery_cut()) {
                self.custody.discard_reply();
                return Err(error);
            }
            Ok(response)
        })();
        let bytes = answer.unwrap_or_else(|error| self.custody.error_reply(error));
        self.work = observation::finish(self.custody.work());
        bytes
    }
}
fn authorize(guard: &mut dyn OpeningGuard) -> Result<(), OpeningError> {
    observation::field_attempt(7);
    let result = match guard.current_permission() {
        OpeningPermission::Unavailable => Err(OpeningError::Unavailable),
        OpeningPermission::Deny => Err(OpeningError::Denied),
        OpeningPermission::Allow if guard.principal() == "owner-1" => Ok(()),
        OpeningPermission::Allow => Err(OpeningError::Denied),
    };
    observation::field_complete(result.is_ok());
    result
}
