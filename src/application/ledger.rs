//! Independently authenticated fixture policy and bounded v4 dispatch.
use crate::{
    adapters::jsonl::ledger::{self, Custody, LedgerIoHook, LedgerWork},
    adapters::jsonl::opening::OpeningMode,
    kernel::changes::{
        ledger::{LedgerGrant, LedgerInput},
        opening::OpeningError,
    },
};
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerPermission {
    Allow,
    Deny,
    Unavailable,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerCollectionPermission {
    Connect,
    Create,
    List,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LedgerMemberPermission {
    Create,
    Metadata,
    History,
}
/// Current trusted policy lease. No client actor or cached authorization bit.
/// Confirm predecessor exit before a successor; never fork an owning host or
/// expose custody descriptors to untrusted code.
pub trait LedgerGuard {
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
        permission: LedgerMemberPermission,
    ) -> LedgerPermission;
}
pub struct LedgerHost {
    custody: Custody,
    connection_work: LedgerWork,
}
impl LedgerHost {
    pub fn connect(
        grant: LedgerGrant,
        mode: OpeningMode,
        guard: &mut dyn LedgerGuard,
        hook: Option<LedgerIoHook>,
    ) -> Result<Self, OpeningError> {
        ledger::begin_connection(&grant);
        collection(guard, &grant.ledger, LedgerCollectionPermission::Connect)?;
        let mut custody = Custody::connect(grant, mode, hook)?;
        custody.finish_connect(guard)?;
        Ok(Self {
            custody,
            connection_work: LedgerWork::last_call(),
        })
    }
    pub fn connection_work(&self) -> LedgerWork {
        self.connection_work
    }
    pub fn last_work(&self) -> LedgerWork {
        LedgerWork::last_call()
    }
    pub fn create_change(&mut self, json: &LedgerInput, guard: &mut dyn LedgerGuard) -> Vec<u8> {
        self.dispatch(json, guard, "create_change")
    }
    pub fn list_changes(&mut self, json: &LedgerInput, guard: &mut dyn LedgerGuard) -> Vec<u8> {
        self.dispatch(json, guard, "list_changes")
    }
    pub fn select_change(&mut self, json: &LedgerInput, guard: &mut dyn LedgerGuard) -> Vec<u8> {
        self.dispatch(json, guard, "select_change")
    }
    pub fn inspect_change(&mut self, json: &LedgerInput, guard: &mut dyn LedgerGuard) -> Vec<u8> {
        self.dispatch(json, guard, "inspect_change")
    }
    fn dispatch(&mut self, json: &LedgerInput, guard: &mut dyn LedgerGuard, op: &str) -> Vec<u8> {
        ledger::begin_dispatch(json.capacity(), self.custody.payload());
        self.custody.rebase();
        let answer = (|| {
            let input = ledger::request(json)?;
            if !ledger::schema(input.op.len().max(op.len()), 1, || input.op == op) {
                return Err(OpeningError::Unsupported);
            }
            if !ledger::schema(
                (input.ledger.len() + input.workspace_id.len())
                    .max(self.custody.ledger().len() + "workspace-1".len()),
                2,
                || input.ledger == self.custody.ledger() && input.workspace_id == "workspace-1",
            ) {
                // Resolve current collection unavailability before association denial.
                collection(guard, self.custody.ledger(), permission(op))?;
                return Err(OpeningError::Denied);
            }
            collection(guard, self.custody.ledger(), permission(op))?;
            if let Some(change) = &input.change {
                if op == "select_change" {
                    member(
                        guard,
                        self.custody.ledger(),
                        change,
                        LedgerMemberPermission::Metadata,
                    )?;
                }
                member(
                    guard,
                    self.custody.ledger(),
                    change,
                    LedgerMemberPermission::History,
                )?;
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
                    LedgerMemberPermission::Metadata,
                )?;
                member(
                    guard,
                    self.custody.ledger(),
                    &cursor.after,
                    LedgerMemberPermission::History,
                )?;
            }
            self.custody.dispatch(&input, guard)
        })();
        ledger::reply(answer)
    }
}
fn permission(op: &str) -> LedgerCollectionPermission {
    match op {
        "create_change" => LedgerCollectionPermission::Create,
        "list_changes" => LedgerCollectionPermission::List,
        _ => LedgerCollectionPermission::Connect,
    }
}
pub(crate) fn authorize(guard: &dyn LedgerGuard, p: LedgerPermission) -> Result<(), OpeningError> {
    if ledger::work::history_mode() {
        return super::ledger_history::authorize(|| guard.principal(), p);
    }
    ledger::schema(0, 1, || p == LedgerPermission::Allow);
    match p {
        LedgerPermission::Unavailable => Err(OpeningError::Unavailable),
        LedgerPermission::Deny => Err(OpeningError::Denied),
        LedgerPermission::Allow => {
            let principal = guard.principal();
            // A scalar length guard prevents charging an arbitrary trusted
            // principal backing as a compared client identifier range.
            if !ledger::schema(0, 1, || principal.len() == "owner-1".len())
                || !ledger::schema(principal.len(), 1, || principal == "owner-1")
            {
                Err(OpeningError::Denied)
            } else {
                Ok(())
            }
        }
    }
}

pub(crate) fn collection(
    guard: &mut dyn LedgerGuard,
    ledger: &str,
    p: LedgerCollectionPermission,
) -> Result<(), OpeningError> {
    let decision = guard.collection(ledger, p);
    authorize(guard, decision)
}
pub(crate) fn member(
    guard: &mut dyn LedgerGuard,
    ledger: &str,
    change: &str,
    p: LedgerMemberPermission,
) -> Result<(), OpeningError> {
    let decision = guard.member(ledger, change, p);
    authorize(guard, decision)
}
