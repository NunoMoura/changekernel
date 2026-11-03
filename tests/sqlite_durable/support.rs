//! Explicit supplied native/source fixture, never authentic H or an external-source verifier.
use super::api::adapters::sqlite::{
    CustodyUse, LedgerIdentity, LocalGuard, PreparedOperationRequest, ReadDisclosure,
    RetainedSource, TrustedLocal,
};
use super::api::unqualified_change::{
    Access, ActionRequest, ActorId, Adaptation, Attribution, Authority, BindingKnowledge, ChangeId,
    Checks, Command, ContentId, ContentKey, ContentObservation, Context, ContextVersion, Error,
    GrantAction, GrantId, GrantSpec, GrantTarget, GroundId, GroundVersion, Identity, InputKind,
    IntakeRequest, LedgerId, NativeConditions, Operation, OperationId, OperationRequest, OwnerId,
    ReadScope, Result, ScopeJudgment, SourceClaim, CURRENT_PROFILE,
};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Permit {
    Bootstrap(PathBuf),
    OpenRegister(PathBuf),
    Reserve(Identity),
    Allocate(Identity, PathBuf),
    Bind(Identity),
    Include(Identity),
    Activate(Identity),
    Open(Identity, PathBuf),
    Resolve(Identity),
    Verify(PathBuf),
    Maintain,
}
pub type InputHook = Box<dyn FnOnce(&mut Inputs) + Send>;
pub struct Inputs {
    pub ledger: LedgerIdentity,
    pub context: Context,
    pub custody: BTreeSet<Permit>,
    pub sources: BTreeMap<ContentKey, ContentObservation>,
    pub denied: BTreeSet<ContentKey>,
    pub grounds: BTreeMap<GroundId, GroundVersion>,
    pub intake: bool,
    pub disclosure: bool,
    pub history: bool,
    pub retained_content: bool,
    pub history_calls: usize,
    pub content_calls: usize,
    pub resolve_calls: usize,
    pub locks: usize,
    pub authorize_calls: usize,
    pub deny_on_authorize: Option<usize>,
    pub context_hook: Option<InputHook>,
    pub disclose_hook: Option<InputHook>,
    pub include_hook: Option<Box<dyn FnOnce() + Send>>,
    pub after_intake_hook: Option<InputHook>,
    next_lock_hook: Option<InputHook>,
}
#[derive(Clone)]
pub struct Local(pub Arc<Mutex<Inputs>>);
pub struct Guard<'a>(MutexGuard<'a, Inputs>);
impl TrustedLocal for Local {
    type Guard<'a> = Guard<'a>;
    fn lock(&mut self) -> Result<Self::Guard<'_>> {
        let mut guard = self.0.lock().map_err(|_| Error::Unavailable)?;
        guard.locks += 1;
        if let Some(hook) = guard.next_lock_hook.take() {
            hook(&mut guard);
        }
        Ok(Guard(guard))
    }
}
impl LocalGuard for Guard<'_> {
    fn context(&mut self) -> Result<Context> {
        let context = self.0.context.clone();
        if let Some(hook) = self.0.context_hook.take() {
            hook(&mut self.0)
        }
        Ok(context)
    }
    fn resolve_content(
        &mut self,
        _checks: &Checks,
        request: &IntakeRequest,
        retained: Option<RetainedSource<'_>>,
    ) -> Result<ContentObservation> {
        self.0.resolve_calls += 1;
        let key = request.key();
        if self.0.denied.contains(key) {
            return Err(Error::Denied);
        }
        let mut observed = self.0.sources.get(key).cloned().ok_or(Error::Unavailable)?;
        if let Some(retained) = retained {
            if retained.establishment.binding.content != *key {
                return Err(Error::Conflict);
            }
            if matches!(
                observed.source_claim.binding_knowledge,
                BindingKnowledge::NoKnownBinding
            ) {
                observed.source_claim.binding_knowledge = BindingKnowledge::Known(key.clone());
            }
            observed.source_claim.input_kind = InputKind::PreExisting;
        }
        Ok(observed)
    }
    fn authorize_intake(&mut self, checks: &Checks, _operation: &Operation) -> Result<()> {
        self.0.authorize_calls += 1;
        if self.0.deny_on_authorize == Some(self.0.authorize_calls)
            || !self.0.intake
            || checks.context != self.0.context
            || checks
                .content_items
                .keys()
                .any(|k| self.0.denied.contains(k))
        {
            Err(Error::Denied)
        } else {
            // Arm under the preparation guard; change source facts only at the next
            // acquisition, after this guard has released and before final validation.
            if let Some(hook) = self.0.after_intake_hook.take() {
                self.0.next_lock_hook = Some(hook);
            }
            Ok(())
        }
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        if let Some(hook) = self.0.disclose_hook.take() {
            hook(&mut self.0)
        }
        if !self.0.disclosure
            || checks.context != self.0.context
            || checks
                .content_items
                .keys()
                .any(|k| self.0.denied.contains(k))
        {
            return Err(Error::Denied);
        }
        if !self.0.context.disclosure.contains(&checks.disclosure)
            && !self
                .0
                .context
                .disclosure
                .contains(&ReadScope::Change(checks.identity.change.clone()))
            && !checks.disclosure_origin.as_ref().is_some_and(|o| {
                self.0
                    .context
                    .disclosure
                    .contains(&ReadScope::Origin(o.clone()))
            })
        {
            return Err(Error::Denied);
        }
        Ok(())
    }
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion> {
        self.0.grounds.get(id).cloned().ok_or(Error::Unavailable)
    }
    fn discretion(&mut self, _: &Adaptation) -> Result<ScopeJudgment> {
        Err(Error::Unavailable)
    }
    fn native_conditions(&mut self, _: &ActionRequest) -> Result<NativeConditions> {
        Err(Error::Unavailable)
    }
    fn authorize_custody(&mut self, ledger: &LedgerIdentity, action: CustodyUse<'_>) -> Result<()> {
        if ledger != &self.0.ledger || self.0.context.authority.represented_owner != ledger.owner {
            return Err(Error::Denied);
        }
        if matches!(&action, CustodyUse::Include(_)) {
            if let Some(hook) = self.0.include_hook.take() {
                hook();
            }
        }
        let permit = match action {
            CustodyUse::Bootstrap(p) => Permit::Bootstrap(p.to_owned()),
            CustodyUse::OpenRegister(p) => Permit::OpenRegister(p.to_owned()),
            CustodyUse::Reserve(id) => Permit::Reserve(id.clone()),
            CustodyUse::Allocate(id, p) => Permit::Allocate(id.clone(), p.to_owned()),
            CustodyUse::BindChange(id) => Permit::Bind(id.clone()),
            CustodyUse::Include(id) => Permit::Include(id.clone()),
            CustodyUse::Activate(id) => Permit::Activate(id.clone()),
            CustodyUse::OpenOriginal(id, p) => Permit::Open(id.clone(), p.to_owned()),
            CustodyUse::Resolve(id, _) => Permit::Resolve(id.clone()),
            CustodyUse::Verify(p) => Permit::Verify(p.to_owned()),
            CustodyUse::Maintain(_) => Permit::Maintain,
        };
        if !self.0.custody.contains(&permit) {
            return Err(Error::Denied);
        }
        Ok(())
    }
}
impl ReadDisclosure for Guard<'_> {
    fn read_context(&mut self) -> Result<super::api::adapters::sqlite::ReadContext> {
        let context = super::api::adapters::sqlite::ReadContext::new(
            self.0.context.authority.clone(),
            self.0.context.version.clone(),
        );
        if let Some(hook) = self.0.context_hook.take() {
            hook(&mut self.0);
        }
        Ok(context)
    }
    fn disclose_history(&mut self, _: &Identity) -> Result<()> {
        self.0.history_calls += 1;
        if let Some(hook) = self.0.disclose_hook.take() {
            hook(&mut self.0);
        }
        if self.0.history {
            Ok(())
        } else {
            Err(Error::Denied)
        }
    }
    fn authorize_content(
        &mut self,
        membership: &super::api::unqualified_change::ContentReference,
    ) -> Result<()> {
        if self.0.retained_content && !self.0.denied.contains(&membership.content) {
            Ok(())
        } else {
            Err(Error::Denied)
        }
    }
    fn disclose_retained_content(
        &mut self,
        membership: &super::api::unqualified_change::ContentReference,
        _: RetainedSource<'_>,
    ) -> Result<()> {
        self.0.content_calls += 1;
        if let Some(hook) = self.0.disclose_hook.take() {
            hook(&mut self.0);
        }
        if self.0.retained_content && !self.0.denied.contains(&membership.content) {
            Ok(())
        } else {
            Err(Error::Denied)
        }
    }
}
pub fn identity(change: u8) -> Identity {
    Identity {
        owner: OwnerId::from_bytes([1; 16]).unwrap(),
        ledger: LedgerId::from_bytes([2; 16]).unwrap(),
        change: ChangeId::from_bytes([change; 16]).unwrap(),
        owner_actor: ActorId::from_bytes([3; 16]).unwrap(),
        agent: ActorId::from_bytes([4; 16]).unwrap(),
    }
}
pub fn local(identity: &Identity, register: &Path, original: &Path, verification: &Path) -> Local {
    let custody = BTreeSet::from([
        Permit::Bootstrap(register.to_owned()),
        Permit::OpenRegister(register.to_owned()),
        Permit::Reserve(identity.clone()),
        Permit::Allocate(identity.clone(), original.to_owned()),
        Permit::Bind(identity.clone()),
        Permit::Include(identity.clone()),
        Permit::Activate(identity.clone()),
        Permit::Open(identity.clone(), original.to_owned()),
        Permit::Resolve(identity.clone()),
        Permit::Verify(verification.to_owned()),
        Permit::Maintain,
    ]);
    Local(Arc::new(Mutex::new(Inputs {
        ledger: LedgerIdentity {
            owner: identity.owner.clone(),
            ledger: identity.ledger.clone(),
        },
        context: Context {
            version: ContextVersion::from_bytes([9; 16]).unwrap(),
            authority: Authority {
                actor: identity.owner_actor.clone(),
                represented_owner: identity.owner.clone(),
                owner_control: Some(identity.clone()),
                agent_role: None,
            },
            disclosure: BTreeSet::from([ReadScope::Change(identity.change.clone())]),
        },
        custody,
        sources: BTreeMap::new(),
        denied: BTreeSet::new(),
        grounds: BTreeMap::new(),
        intake: true,
        disclosure: true,
        history: true,
        retained_content: true,
        history_calls: 0,
        content_calls: 0,
        resolve_calls: 0,
        locks: 0,
        authorize_calls: 0,
        deny_on_authorize: None,
        context_hook: None,
        disclose_hook: None,
        include_hook: None,
        after_intake_hook: None,
        next_lock_hook: None,
    })))
}
pub fn source(local: &Local, key: &ContentKey, bytes: &[u8]) {
    local.0.lock().unwrap().sources.insert(
        key.clone(),
        ContentObservation {
            bytes: bytes.to_vec(),
            source_claim: SourceClaim {
                input_kind: InputKind::PreExisting,
                binding_knowledge: BindingKnowledge::NoKnownBinding,
                attribution: Attribution::Unknown,
                limitations: b"fixture observation; no global absence proof".to_vec(),
            },
        },
    );
}
pub fn start(local: &Local, identity: &Identity) -> PreparedOperationRequest {
    let wish = ContentKey {
        establishing: identity.change_key(),
        id: ContentId::from_bytes([11; 16]).unwrap(),
    };
    source(local, &wish, b"retained owner wish");
    PreparedOperationRequest::from_operation_request(&OperationRequest {
        profile: CURRENT_PROFILE,
        target: identity.change_key(),
        actor: identity.owner_actor.clone(),
        represented_owner: identity.owner.clone(),
        operation: Operation {
            id: OperationId::from_bytes([12; 16]).unwrap(),
            command: Command::Initiate {
                wish: wish.clone(),
                access: Access::Owner,
            },
            fresh: vec![],
            first_retention: BTreeSet::from([wish]),
        },
    })
    .unwrap()
}
pub fn grant(identity: &Identity, n: u8) -> PreparedOperationRequest {
    PreparedOperationRequest::from_operation_request(&OperationRequest {
        profile: CURRENT_PROFILE,
        target: identity.change_key(),
        actor: identity.owner_actor.clone(),
        represented_owner: identity.owner.clone(),
        operation: Operation {
            id: OperationId::from_bytes([n; 16]).unwrap(),
            command: Command::SetGrant {
                id: GrantId::from_bytes([n; 16]).unwrap(),
                expected_generation: None,
                spec: GrantSpec {
                    recipient: identity.agent.clone(),
                    target: GrantTarget::Draft(identity.change.clone()),
                    native_scope: BTreeSet::new(),
                    native_actions: BTreeSet::new(),
                    limits: BTreeSet::new(),
                    content_items: BTreeSet::new(),
                    content_origins: BTreeSet::new(),
                    disclosure: BTreeSet::new(),
                    disclosure_origins: BTreeSet::new(),
                    creation: None,
                    actions: BTreeSet::from([GrantAction::Finding]),
                },
            },
            fresh: vec![],
            first_retention: BTreeSet::new(),
        },
    })
    .unwrap()
}

#[derive(Debug, PartialEq, Eq)]
pub struct RetainedObject {
    device: u64,
    inode: u64,
    owner: u32,
    group: u32,
    mode: u32,
    bytes: Option<Vec<u8>>,
}
/// Quiescent test sources only. Never opens descriptors to a live source's DB/WAL/SHM.
pub fn native_snapshot(path: &Path) -> BTreeMap<std::ffi::OsString, RetainedObject> {
    use std::os::unix::fs::MetadataExt;
    std::iter::once((std::ffi::OsString::from("."), path.to_owned()))
        .chain(std::fs::read_dir(path).unwrap().map(|entry| {
            let entry = entry.unwrap();
            (entry.file_name(), entry.path())
        }))
        .map(|(name, path)| {
            let m = std::fs::symlink_metadata(&path).unwrap();
            (
                name,
                RetainedObject {
                    device: m.dev(),
                    inode: m.ino(),
                    owner: m.uid(),
                    group: m.gid(),
                    mode: m.mode(),
                    bytes: if m.is_file() {
                        Some(std::fs::read(path).unwrap())
                    } else {
                        None
                    },
                },
            )
        })
        .collect()
}
