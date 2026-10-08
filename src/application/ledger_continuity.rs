//! Independently authenticated v5 composition on the private selected ledger path.
use crate::{
    adapters::jsonl::ledger::{
        self,
        continuity::{self, LedgerContinuityCall as Call, LedgerContinuityWork as Work},
        work::{self, Boundary as B, Owned},
        Custody,
    },
    kernel::changes::{
        ledger_continuity::{LedgerContinuityGrant, LedgerContinuityInput},
        opening::OpeningError,
    },
    LedgerCollectionPermission, LedgerPermission, OpeningMode,
};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerContinuityMemberPermission {
    Create,
    Metadata,
    History,
    AdoptIntent,
    RunCheck,
}
pub trait LedgerContinuityGuard {
    fn principal(&self) -> &str;
    fn collection(
        &mut self,
        ledger: &str,
        permission: LedgerCollectionPermission,
    ) -> LedgerPermission;
    fn member(
        &mut self,
        ledger: &str,
        change: &str,
        permission: LedgerContinuityMemberPermission,
    ) -> LedgerPermission;
}
pub struct LedgerContinuityHost {
    custody: Custody<crate::adapters::jsonl::ledger::layout::Native>,
    connection: Work,
    last: Work,
}
pub(crate) fn authorize<'a>(
    principal: impl FnOnce() -> &'a str,
    decision: LedgerPermission,
) -> Result<(), OpeningError> {
    work::attempt(B::Permissions, 0, 1);
    work::complete(B::Permissions, decision == LedgerPermission::Allow);
    match decision {
        LedgerPermission::Unavailable => {
            work::update(|w| w.permission_unavailable += 1);
            Err(OpeningError::Unavailable)
        }
        LedgerPermission::Deny => {
            work::update(|w| w.permission_denied += 1);
            Err(OpeningError::Denied)
        }
        LedgerPermission::Allow => {
            let principal = principal();
            if !work::test(B::Principals, 0, 1, || principal.len() == 7)
                || !work::test(B::Principals, principal.len().max(7), 1, || {
                    principal == "owner-1"
                })
            {
                Err(OpeningError::Denied)
            } else {
                Ok(())
            }
        }
    }
}
pub(crate) fn collection(
    g: &mut dyn LedgerContinuityGuard,
    ledger: &str,
    p: LedgerCollectionPermission,
) -> Result<(), OpeningError> {
    let d = g.collection(ledger, p);
    authorize(|| g.principal(), d)
}
pub(crate) fn member(
    g: &mut dyn LedgerContinuityGuard,
    ledger: &str,
    change: &str,
    p: LedgerContinuityMemberPermission,
) -> Result<(), OpeningError> {
    let d = g.member(ledger, change, p);
    authorize(|| g.principal(), d)
}
impl LedgerContinuityHost {
    pub fn connect(
        grant: LedgerContinuityGrant,
        mode: OpeningMode,
        guard: &mut dyn LedgerContinuityGuard,
        hook: Option<continuity::LedgerContinuityIoHook>,
    ) -> Result<Self, OpeningError> {
        work::continuity_begin(Call::Connect, 0);
        work::fixed_baseline(std::mem::size_of::<LedgerContinuityGrant>());
        work::update(|w| w.grant_vectors_peak = 1);
        let result = (|| {
            let grant = Owned::new(grant);
            let _hook_header = work::Fixed::new(std::mem::size_of::<
                Option<continuity::LedgerContinuityIoHook>,
            >());
            collection(guard, &grant.ledger, LedgerCollectionPermission::Connect)?;
            let mut custody = continuity::connect(grant.into_inner(), mode, hook)?;
            custody.finish_connect(&mut crate::application::ledger_history::SharedGuard(
                &mut Bridge(guard),
            ))?;
            Ok::<_, OpeningError>(custody)
        })();
        if result.is_err() {
            work::attempt(B::Errors, 0, 1);
            work::complete(B::Errors, true);
        }
        let mut result = result.map(|custody| {
            work::attempt(B::Constructions, 0, 1);
            work::fixed_baseline(std::mem::size_of::<Self>());
            let host = Self {
                custody,
                connection: Work::default(),
                last: Work::default(),
            };
            work::complete(B::Constructions, true);
            host
        });
        let snapshot = work::continuity_seal();
        if let Ok(host) = &mut result {
            host.connection = snapshot;
            host.last = snapshot;
        }
        result
    }
    pub fn connection_work(&self) -> Work {
        self.connection
    }
    pub fn last_work(&self) -> Work {
        self.last
    }
    pub fn create_change(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "create_change", Call::CreateChange)
    }
    pub fn list_changes(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "list_changes", Call::ListChanges)
    }
    pub fn select_change(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "select_change", Call::SelectChange)
    }
    pub fn revise_intent(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "revise_intent", Call::ReviseIntent)
    }
    pub fn run_check(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "run_check", Call::RunCheck)
    }
    pub fn inspect_history(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_history", Call::InspectHistory)
    }
    pub fn inspect_context(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_context", Call::InspectContext)
    }
    fn dispatch(
        &mut self,
        json: &LedgerContinuityInput,
        guard: &mut dyn LedgerContinuityGuard,
        op: &str,
        call: Call,
    ) -> Vec<u8> {
        work::continuity_begin(call, json.capacity() + self.custody.payload());
        work::fixed_baseline(std::mem::size_of::<Self>());
        work::descriptor_baseline(4);
        self.custody.rebase();
        work::update(|w| {
            w.supplied_input_bytes = json.supplied_len as u64;
            w.supplied_input_capacity = json.supplied_capacity as u64;
        });
        let result = (|| {
            if !work::test(B::Fields, 0, 1, || json.bytes.is_some()) {
                return Err(OpeningError::InvalidInput);
            }
            let input = continuity::request(json.as_bytes())?;
            if !ledger::schema(input.op.len().max(op.len()), 1, || input.op == op) {
                return Err(OpeningError::Unsupported);
            }
            collection(guard, self.custody.ledger(), permission(op))?;
            if !ledger::schema(
                input.ledger.len().max(self.custody.ledger().len())
                    + input.workspace_id.len().max(11),
                2,
                || input.ledger == self.custody.ledger() && input.workspace_id == "workspace-1",
            ) {
                return Err(OpeningError::Denied);
            }
            if let Some(change) = &input.change {
                if op == "select_change" {
                    member(
                        guard,
                        self.custody.ledger(),
                        change,
                        LedgerContinuityMemberPermission::Metadata,
                    )?;
                }
                member(
                    guard,
                    self.custody.ledger(),
                    change,
                    LedgerContinuityMemberPermission::History,
                )?;
                let h = input.history();
                for r in [
                    h.expected_intent.as_deref(),
                    h.at.as_ref().and_then(Option::as_deref),
                    h.from.as_ref().and_then(Option::as_deref),
                ]
                .into_iter()
                .flatten()
                {
                    let (subject, _) = crate::adapters::jsonl::ledger::history::codec::reference(r)
                        .ok_or(OpeningError::InvalidInput)?;
                    if !ledger::schema(subject.len().max(change.len()), 1, || subject == change) {
                        return Err(OpeningError::Denied);
                    }
                }
            }
            if let Some(Some(cursor)) = &input.cursor {
                if !ledger::schema(
                    cursor.ledger.len().max(input.ledger.len())
                        + cursor.workspace_id.len().max(input.workspace_id.len()),
                    2,
                    || cursor.ledger == input.ledger && cursor.workspace_id == input.workspace_id,
                ) {
                    return Err(OpeningError::Denied);
                }
                if !ledger::schema(0, 1, || Some(cursor.limit) == input.limit) {
                    return Err(OpeningError::InvalidInput);
                }
                member(
                    guard,
                    self.custody.ledger(),
                    &cursor.after,
                    LedgerContinuityMemberPermission::Metadata,
                )?;
                member(
                    guard,
                    self.custody.ledger(),
                    &cursor.after,
                    LedgerContinuityMemberPermission::History,
                )?;
            }
            self.custody.history_dispatch(&input, &mut Bridge(guard))
        })();
        work::finish_history_output(result.is_ok());
        let bytes = continuity::reply(result);
        self.last = work::continuity_seal();
        bytes
    }
}
pub(crate) fn permission(op: &str) -> LedgerCollectionPermission {
    match op {
        "create_change" => LedgerCollectionPermission::Create,
        "list_changes" => LedgerCollectionPermission::List,
        _ => LedgerCollectionPermission::Connect,
    }
}

struct Bridge<'a>(&'a mut dyn LedgerContinuityGuard);
impl crate::LedgerHistoryGuard for Bridge<'_> {
    fn principal(&self) -> &str {
        self.0.principal()
    }
    fn collection(&mut self, l: &str, p: LedgerCollectionPermission) -> LedgerPermission {
        self.0.collection(l, p)
    }
    fn member(
        &mut self,
        l: &str,
        c: &str,
        p: crate::LedgerHistoryMemberPermission,
    ) -> LedgerPermission {
        self.0.member(
            l,
            c,
            match p {
                crate::LedgerHistoryMemberPermission::Create => {
                    LedgerContinuityMemberPermission::Create
                }
                crate::LedgerHistoryMemberPermission::Metadata => {
                    LedgerContinuityMemberPermission::Metadata
                }
                crate::LedgerHistoryMemberPermission::History => {
                    LedgerContinuityMemberPermission::History
                }
                crate::LedgerHistoryMemberPermission::AdoptIntent => {
                    LedgerContinuityMemberPermission::AdoptIntent
                }
                crate::LedgerHistoryMemberPermission::RunCheck => {
                    LedgerContinuityMemberPermission::RunCheck
                }
            },
        )
    }
}
impl std::fmt::Debug for LedgerContinuityHost {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("LedgerContinuityHost")
            .finish_non_exhaustive()
    }
}
