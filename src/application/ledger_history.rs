//! Independently authenticated v5 composition on the private selected ledger path.
use crate::{
    adapters::jsonl::ledger::{
        self,
        history::{self, LedgerHistoryCall as Call, LedgerHistoryWork as Work},
        work::{self, Boundary as B, Owned},
        Custody, LedgerIoHook,
    },
    kernel::changes::{
        ledger_history::{LedgerHistoryGrant, LedgerHistoryInput},
        opening::OpeningError,
    },
    LedgerCollectionPermission, LedgerGuard, LedgerMemberPermission, LedgerPermission, OpeningMode,
};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerHistoryMemberPermission {
    Create,
    Metadata,
    History,
    AdoptIntent,
    RunCheck,
}
pub trait LedgerHistoryGuard {
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
        permission: LedgerHistoryMemberPermission,
    ) -> LedgerPermission;
}
pub struct LedgerHistoryHost {
    custody: Custody,
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
    g: &mut dyn LedgerHistoryGuard,
    ledger: &str,
    p: LedgerCollectionPermission,
) -> Result<(), OpeningError> {
    let d = g.collection(ledger, p);
    authorize(|| g.principal(), d)
}
pub(crate) fn member(
    g: &mut dyn LedgerHistoryGuard,
    ledger: &str,
    change: &str,
    p: LedgerHistoryMemberPermission,
) -> Result<(), OpeningError> {
    let d = g.member(ledger, change, p);
    authorize(|| g.principal(), d)
}
pub(crate) struct SharedGuard<'a>(pub &'a mut dyn LedgerHistoryGuard);
impl LedgerGuard for SharedGuard<'_> {
    fn principal(&self) -> &str {
        self.0.principal()
    }
    fn collection(&mut self, l: &str, p: LedgerCollectionPermission) -> LedgerPermission {
        self.0.collection(l, p)
    }
    fn member(&mut self, l: &str, c: &str, p: LedgerMemberPermission) -> LedgerPermission {
        self.0.member(
            l,
            c,
            match p {
                LedgerMemberPermission::Create => LedgerHistoryMemberPermission::Create,
                LedgerMemberPermission::Metadata => LedgerHistoryMemberPermission::Metadata,
                LedgerMemberPermission::History => LedgerHistoryMemberPermission::History,
            },
        )
    }
}
impl LedgerHistoryHost {
    pub fn connect(
        grant: LedgerHistoryGrant,
        mode: OpeningMode,
        guard: &mut dyn LedgerHistoryGuard,
        hook: Option<LedgerIoHook>,
    ) -> Result<Self, OpeningError> {
        work::history_begin(Call::Connect, 0);
        work::fixed_baseline(std::mem::size_of::<LedgerHistoryGrant>());
        work::update(|w| w.grant_vectors_peak = 1);
        let result = (|| {
            let grant = Owned::new(grant);
            let _hook_header = work::Fixed::new(std::mem::size_of::<Option<LedgerIoHook>>());
            collection(guard, &grant.ledger, LedgerCollectionPermission::Connect)?;
            let mut custody = history::connect(grant.into_inner(), mode, hook)?;
            custody.finish_connect(&mut SharedGuard(guard))?;
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
        let snapshot = work::history_seal();
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
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "create_change", Call::CreateChange)
    }
    pub fn list_changes(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "list_changes", Call::ListChanges)
    }
    pub fn select_change(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "select_change", Call::SelectChange)
    }
    pub fn revise_intent(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "revise_intent", Call::ReviseIntent)
    }
    pub fn run_check(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "run_check", Call::RunCheck)
    }
    pub fn inspect_history(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_history", Call::InspectHistory)
    }
    pub fn inspect_context(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
    ) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_context", Call::InspectContext)
    }
    fn dispatch(
        &mut self,
        json: &LedgerHistoryInput,
        guard: &mut dyn LedgerHistoryGuard,
        op: &str,
        call: Call,
    ) -> Vec<u8> {
        work::history_begin(call, json.capacity() + self.custody.payload());
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
            let input = history::request(json.as_bytes())?;
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
                        LedgerHistoryMemberPermission::Metadata,
                    )?;
                }
                member(
                    guard,
                    self.custody.ledger(),
                    change,
                    LedgerHistoryMemberPermission::History,
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
                    let (subject, _) =
                        history::codec::reference(r).ok_or(OpeningError::InvalidInput)?;
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
                    LedgerHistoryMemberPermission::Metadata,
                )?;
                member(
                    guard,
                    self.custody.ledger(),
                    &cursor.after,
                    LedgerHistoryMemberPermission::History,
                )?;
            }
            self.custody.history_dispatch(&input, guard)
        })();
        work::finish_history_output(result.is_ok());
        let bytes = history::reply(result);
        self.last = work::history_seal();
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
