//! Model-free trusted fixtures. Assertions here are not native permission or semantic truth.
use changekernel::unqualified_change::{
    Acceptance, Accepted, Access, ActionId, ActionRequest, ActorId, Adaptation, AgreementId,
    Assessment, AssessmentId, Attribution, Authority, BindingKnowledge, Change, ChangeId, Checks,
    Command, ContentId, ContentKey, ContentObservation, ContentOrigin, ContentReference,
    ContentUsage, Context, ContextVersion, Criterion, CriterionEvidence, CriterionId, Decision,
    DecisionId, DecisionKind, Dependency, Effect, Error, Evidence, FreshContent, Fulfillment,
    Grant, GrantAction, GrantId, GrantSpec, GrantTarget, GrantUse, GroundId, GroundVersion,
    Identity, InputKind, IntakeCase, IntakeRequest, LedgerId, LimitId, NativeActionId,
    NativeConditions, Operation, OperationId, OperationRequest, OwnerId, Ports, Proposal,
    ProposalId, Query, Read, ReadScope, RecordedContent, Result, ScopeId, ScopeJudgment,
    SourceClaim, Status, StoredOperation, TermSelection, Terms, Unknown, CURRENT_PROFILE,
};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};
#[path = "../support/ids.rs"]
mod ids;
#[path = "../support/intake.rs"]
mod intake;
pub use ids::TestId;
#[path = "../support/operation_request.rs"]
mod operation_request;
pub use operation_request::TestSubmit;

pub enum Race {
    Content(ContentKey),
    Ground(GroundId),
    Context,
    Disclosure,
    Prefix,
    CreationSource,
    CreationGrant,
    GrantGeneration(GrantId),
    GrantRevocation(GrantId),
    SourceClaim(ContentKey, SourceClaim),
}
pub struct FixturePorts {
    pub context: Context,
    pub content_items: BTreeMap<ContentKey, Vec<u8>>,
    pub created: BTreeMap<ContentKey, RecordedContent>,
    pub inputs: RefCell<BTreeMap<ContentKey, ContentObservation>>,
    pub grants: BTreeMap<GrantId, Grant>,
    pub creation_sources: BTreeSet<(Identity, ActorId, ActorId)>,
    pub denied_content_items: BTreeSet<ContentKey>,
    pub grounds: BTreeMap<GroundId, GroundVersion>,
    pub accepted: BTreeMap<OperationId, (Operation, Accepted)>,
    pub records: Vec<StoredOperation>,
    pub last_operation: Option<OperationId>,
    pub scope_judgment: ScopeJudgment,
    pub native_evidence: Vec<Evidence>,
    pub race: Option<Race>,
    pub refuse_acceptance: bool,
    pub disclose_calls: usize,
}
impl FixturePorts {
    pub fn validate(&mut self, checks: &Checks) -> Result<()> {
        match self.race.take() {
            Some(Race::Content(id)) => {
                self.content_items
                    .insert(id, b"changed during acceptance".to_vec());
            }
            Some(Race::Ground(id)) => {
                self.grounds.insert(id, GroundVersion::new());
            }
            Some(Race::Context) => {
                self.context.version = ContextVersion::new();
                self.context.authority.owner_control = None;
            }
            Some(Race::Disclosure) => {
                self.context.disclosure.clear();
            }
            Some(Race::Prefix) => {
                self.last_operation = Some(OperationId::new());
            }
            Some(Race::CreationSource) => self.creation_sources.clear(),
            Some(Race::GrantGeneration(id)) => self.grants.get_mut(&id).unwrap().generation += 1,
            Some(Race::GrantRevocation(id)) => self.grants.get_mut(&id).unwrap().revoked = true,
            Some(Race::SourceClaim(key, source)) => {
                self.inputs.borrow_mut().get_mut(&key).unwrap().source_claim = source
            }
            Some(Race::CreationGrant) => {
                let grant = &checks.creation.as_ref().unwrap().grant;
                self.grants.get_mut(&grant.id).unwrap().generation += 1;
            }
            None => {}
        }
        if checks.expected_operation != self.last_operation {
            return Err(Error::Stale);
        }
        if checks.context != self.context {
            return Err(Error::Stale);
        }
        if !self.context.disclosure.contains(&checks.disclosure)
            && !self
                .context
                .disclosure
                .contains(&ReadScope::Change(checks.identity.change.clone()))
            && !checks.disclosure_origin.as_ref().is_some_and(|origin| {
                matches!(&checks.disclosure, ReadScope::Content(id)
                    if self.created.get(id).is_some_and(|r| r.origin.scope() == *origin))
                    && self
                        .context
                        .disclosure
                        .contains(&ReadScope::Origin(origin.clone()))
            })
        {
            return Err(Error::Denied);
        }
        for (key, bytes) in &checks.content_items {
            let original = checks.intakes.get(key).ok_or(Error::Invalid)?;
            let request = match original.case {
                IntakeCase::Fresh => IntakeRequest::Fresh(
                    checks
                        .creation
                        .as_ref()
                        .and_then(|c| c.content_items.get(key))
                        .ok_or(Error::Invalid)?
                        .payload
                        .clone(),
                ),
                IntakeCase::FirstRetention => IntakeRequest::FirstRetention(key.clone()),
                IntakeCase::KnownReuse => IntakeRequest::KnownReuse(key.clone()),
            };
            let current = self.resolve_content(checks, &request)?;
            if current.bytes != *bytes || current.source_claim != original.source_claim {
                return Err(Error::Conflict);
            }
        }
        for (id, version) in &checks.grounds {
            if self.grounds.get(id) != Some(version) {
                return Err(Error::Stale);
            }
        }
        if checks
            .adaptation
            .as_ref()
            .is_some_and(|(_, judgment)| *judgment != self.scope_judgment)
        {
            return Err(Error::Stale);
        }
        if checks.native.as_ref().is_some_and(|(request, conditions)| {
            conditions.action != request.id || conditions.evidence != self.native_evidence
        }) {
            return Err(Error::Stale);
        }
        Ok(())
    }
}
impl Ports for FixturePorts {
    fn context(&mut self) -> Result<Context> {
        Ok(self.context.clone())
    }
    fn resolve_content(
        &mut self,
        _: &Checks,
        request: &IntakeRequest,
    ) -> Result<ContentObservation> {
        let key = request.key();
        if self.denied_content_items.contains(key) {
            return Err(Error::Denied);
        }
        // Supplied trusted-boundary catalog, NOT an authentic native provenance adapter.
        // No observation is fabricated from request payloads, attribution, or local absence.
        let mut observation = self
            .inputs
            .borrow()
            .get(key)
            .cloned()
            .ok_or(Error::Unavailable)?;
        if !matches!(request, IntakeRequest::Fresh(_)) || self.content_items.contains_key(key) {
            observation.bytes = self
                .content_items
                .get(key)
                .cloned()
                .ok_or(Error::Unavailable)?;
        }
        Ok(observation)
    }
    fn authorize_intake(&mut self, checks: &Checks, operation: &Operation) -> Result<()> {
        if checks
            .content_items
            .keys()
            .any(|k| self.denied_content_items.contains(k))
        {
            return Err(Error::Denied);
        }
        let Some(creation) = checks.creation.as_ref() else {
            return Ok(());
        };
        if self.grants.get(&creation.grant.id) != Some(&creation.grant) {
            return Err(Error::Stale);
        }
        let grant = &creation.grant;
        if grant.revoked
            || grant.spec.recipient != checks.context.authority.actor
            || checks.identity.owner != checks.context.authority.represented_owner
        {
            return Err(Error::Denied);
        }
        let usage = ContentUsage::measure(&operation.fresh)?;
        if usage != creation.usage
            || !usage.within(grant.spec.creation.as_ref().ok_or(Error::Denied)?)
            || creation.content_items.len() != operation.fresh.len()
        {
            return Err(Error::Invalid);
        }
        for payload in &operation.fresh {
            if self.content_items.contains_key(&payload.key)
                || self.created.contains_key(&payload.key)
            {
                return Err(Error::Conflict);
            }
            if !self.creation_sources.contains(&(
                checks.identity.clone(),
                checks.context.authority.actor.clone(),
                payload.attributed_source.clone(),
            )) {
                return Err(Error::Denied);
            }
            let expected = RecordedContent {
                payload: payload.clone(),
                origin: ContentOrigin {
                    binding: ContentReference {
                        identity: checks.identity.clone(),
                        operation: operation.id.clone(),
                        content: payload.key.clone(),
                    },
                    recorder: checks.context.authority.actor.clone(),
                    represented_owner: checks.context.authority.represented_owner.clone(),
                    grant: GrantUse {
                        id: grant.id.clone(),
                        generation: grant.generation,
                    },
                    target: grant.spec.target.clone(),
                },
            };
            if creation.content_items.get(&payload.key) != Some(&expected)
                || checks.content_items.get(&payload.key) != Some(&payload.bytes)
            {
                return Err(Error::Conflict);
            }
        }
        Ok(())
    }
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion> {
        self.grounds.get(id).cloned().ok_or(Error::Unavailable)
    }
    fn discretion(&mut self, _: &Adaptation) -> Result<ScopeJudgment> {
        Ok(self.scope_judgment.clone())
    }
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions> {
        Ok(NativeConditions {
            action: action.id.clone(),
            evidence: self.native_evidence.clone(),
        })
    }
    fn accept(&mut self, record: &StoredOperation) -> Acceptance {
        let checks = &record.checks;
        let operation = &record.operation;
        let accepted = &record.accepted;
        let validation = self.validate(checks).and_then(|()| {
            // Every grant-consuming intake, not just fresh creation, is guarded.
            if let Some(used) = &record.used_grant {
                let current = self.grants.get(&used.id).ok_or(Error::Denied)?;
                if current.revoked || current.generation != used.generation {
                    return Err(Error::Stale);
                }
                if record.grant_snapshot.as_ref() != Some(current) {
                    return Err(Error::Stale);
                }
            } else if record.grant_snapshot.is_some() {
                return Err(Error::Invalid);
            }
            self.authorize_intake(checks, operation)
        });
        if let Err(error) = validation {
            return Acceptance::Refused(error);
        }
        if self.accepted.contains_key(&operation.id) {
            return Acceptance::Refused(Error::Conflict);
        }
        if self.refuse_acceptance {
            // A complete authorized prefix and authoritative absence are known here.
            return Acceptance::NotAccepted(Error::Unavailable);
        }
        // All fallible checks precede publication of any bytes, origin or accepted ID.
        if let Some(creation) = &checks.creation {
            for (id, recorded) in &creation.content_items {
                self.content_items
                    .insert(id.clone(), recorded.payload.bytes.clone());
                self.created.insert(id.clone(), recorded.clone());
            }
        }
        for (key, bytes) in &checks.content_items {
            self.content_items.insert(key.clone(), bytes.clone());
            let mut observation = self.inputs.borrow_mut();
            let input = observation.get_mut(key).unwrap();
            input.source_claim.input_kind = InputKind::PreExisting;
            input.source_claim.binding_knowledge = BindingKnowledge::Known(key.clone());
        }
        match (&operation.command, &accepted.effect) {
            (Command::SetGrant { spec, .. }, Effect::Grant(g)) => {
                self.grants.insert(
                    g.id.clone(),
                    Grant {
                        id: g.id.clone(),
                        generation: g.generation,
                        spec: spec.clone(),
                        revoked: false,
                    },
                );
            }
            (Command::RevokeGrant { id, .. }, Effect::Revoked(g)) => {
                let grant = self.grants.get_mut(id).unwrap();
                grant.generation = g.generation;
                grant.revoked = true;
            }
            _ => {}
        }
        self.accepted
            .insert(operation.id.clone(), (operation.clone(), accepted.clone()));
        self.last_operation = Some(operation.id.clone());
        self.records.push(record.clone());
        Acceptance::Accepted
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        self.disclose_calls += 1;
        self.validate(checks)
    }
}

/// Explicit cached caller metadata; does not fetch context or repair an OperationRequest.
pub fn operation_request_for(
    identity: &Identity,
    authority: &Authority,
    operation: Operation,
) -> OperationRequest {
    OperationRequest {
        profile: CURRENT_PROFILE,
        target: identity.change_key(),
        actor: authority.actor.clone(),
        represented_owner: authority.represented_owner.clone(),
        operation,
    }
}

pub struct Fixture {
    pub pursuit: Change,
    pub ports: FixturePorts,
    pub identity: Identity,
    pub proposal_operations: BTreeMap<ProposalId, OperationId>,
}
impl Fixture {
    pub fn new() -> Self {
        let identity = Identity {
            owner: OwnerId::new(),
            owner_actor: ActorId::new(),
            ledger: LedgerId::new(),
            change: ChangeId::new(),
            agent: ActorId::new(),
        };
        let evidence_content = local_key(&identity);
        let limitations = local_key(&identity);
        let evidence = Evidence {
            source: identity.owner_actor.clone(),
            content: evidence_content.clone(),
            limitations: limitations.clone(),
        };
        let context = Context {
            version: ContextVersion::new(),
            authority: Authority {
                actor: identity.owner_actor.clone(),
                represented_owner: identity.owner.clone(),
                owner_control: Some(identity.clone()),
                agent_role: None,
            },
            disclosure: BTreeSet::from([ReadScope::Change(identity.change.clone())]),
        };
        let content_items = BTreeMap::from([
            (evidence_content, b"supplied fixture observation".to_vec()),
            (limitations, b"fixture only; no native execution".to_vec()),
        ]);
        let inputs = RefCell::new(
            content_items
                .iter()
                .map(|(k, b)| {
                    (
                        k.clone(),
                        ContentObservation {
                            bytes: b.clone(),
                            source_claim: unbound_source(),
                        },
                    )
                })
                .collect(),
        );
        let ports = FixturePorts {
            context,
            content_items,
            inputs,
            created: BTreeMap::new(),
            grants: BTreeMap::new(),
            creation_sources: BTreeSet::new(),
            denied_content_items: BTreeSet::new(),
            grounds: BTreeMap::new(),
            accepted: BTreeMap::new(),
            records: Vec::new(),
            last_operation: None,
            scope_judgment: ScopeJudgment::WithinDiscretion(evidence.clone()),
            native_evidence: vec![evidence],
            race: None,
            refuse_acceptance: false,
            disclose_calls: 0,
        };
        Self {
            pursuit: Change::try_new(identity.clone()).unwrap(),
            ports,
            identity,
            proposal_operations: BTreeMap::new(),
        }
    }
    pub fn owner(&mut self) {
        self.ports.context.version = ContextVersion::new();
        self.ports.context.authority = Authority {
            actor: self.identity.owner_actor.clone(),
            represented_owner: self.identity.owner.clone(),
            owner_control: Some(self.identity.clone()),
            agent_role: None,
        };
    }
    pub fn agent(&mut self) {
        self.ports.context.version = ContextVersion::new();
        self.ports.context.authority = Authority {
            actor: self.identity.agent.clone(),
            represented_owner: self.identity.owner.clone(),
            owner_control: None,
            agent_role: Some(self.identity.clone()),
        };
    }
    pub fn key(&self) -> ContentKey {
        local_key(&self.identity)
    }
    pub fn fresh(&self, bytes: &[u8]) -> FreshContent {
        let key = self.key();
        self.fresh_keyed(key, bytes)
    }
    pub fn fresh_keyed(&self, key: ContentKey, bytes: &[u8]) -> FreshContent {
        assert_eq!(key.establishing, self.identity.change_key());
        self.inputs_for_output(&key, bytes);
        FreshContent {
            key,
            bytes: bytes.to_vec(),
            attributed_source: self.identity.agent.clone(),
            derived_from: BTreeSet::new(),
        }
    }
    fn inputs_for_output(&self, key: &ContentKey, bytes: &[u8]) {
        self.ports.inputs.borrow_mut().insert(
            key.clone(),
            ContentObservation {
                bytes: bytes.to_vec(),
                source_claim: SourceClaim {
                    input_kind: InputKind::NewContribution,
                    binding_knowledge: BindingKnowledge::NoKnownBinding,
                    attribution: Attribution::Actor(self.identity.agent.clone()),
                    limitations: b"supplied fixture output; no authentic native provenance"
                        .to_vec(),
                },
            },
        );
    }
    pub fn text(&mut self, text: &str) -> ContentKey {
        let id = self.key();
        self.ports.inputs.borrow_mut().insert(
            id.clone(),
            ContentObservation {
                bytes: text.as_bytes().to_vec(),
                source_claim: unbound_source(),
            },
        );
        self.ports
            .content_items
            .insert(id.clone(), text.as_bytes().to_vec());
        id
    }
    pub fn dependency(&mut self) -> Dependency {
        let ground = GroundId::new();
        let version = GroundVersion::new();
        self.ports.grounds.insert(ground.clone(), version.clone());
        Dependency { ground, version }
    }
    /// Caller fixture declaration; never queries the live port or repairs an existing request.
    pub fn operation_request(&self, operation: Operation) -> OperationRequest {
        operation_request_for(&self.identity, &self.ports.context.authority, operation)
    }
    /// Constructs a NEW request from cached source/accepted data. Never repairs an Operation
    /// or OperationRequest supplied to operation_request()/execute()/TestSubmit.
    pub fn operation(
        &self,
        id: OperationId,
        command: Command,
        fresh: Vec<FreshContent>,
    ) -> Operation {
        let accepted: BTreeSet<_> = self
            .ports
            .records
            .iter()
            .flat_map(|r| r.checks.content_items.keys().cloned())
            .collect();
        let first_retention = intake::requirements(
            &command,
            &self.ports.scope_judgment,
            &self.ports.native_evidence,
        )
        .into_iter()
        .filter(|k| !accepted.contains(k) && !fresh.iter().any(|p| &p.key == k))
        .collect();
        Operation {
            id,
            command,
            fresh,
            first_retention,
        }
    }
    pub fn execute(&mut self, command: Command) -> Result<Accepted> {
        let id = match &command {
            Command::Propose { proposal, .. } => self
                .proposal_operations
                .get(&proposal.id)
                .cloned()
                .unwrap_or_else(OperationId::new),
            _ => OperationId::new(),
        };
        let operation = self.operation(id, command, vec![]);
        let operation_request = self.operation_request(operation);
        self.pursuit.submit(operation_request, &mut self.ports)
    }
    pub fn status(&mut self) -> Status {
        self.owner();
        let Read::Status(s) = self
            .pursuit
            .read(Query::Status, Access::Owner, &mut self.ports)
            .unwrap()
        else {
            panic!("status")
        };
        s
    }
    pub fn initiate(&mut self) {
        self.owner();
        let wish = self.text("checkout feels wrong");
        self.execute(Command::Initiate {
            wish,
            access: Access::Owner,
        })
        .unwrap();
    }
    pub fn proposal(
        &mut self,
        expected: Option<AgreementId>,
        dependencies: Vec<Dependency>,
    ) -> Proposal {
        self.owner();
        let id = ProposalId::new();
        let operation = OperationId::new();
        self.proposal_operations
            .insert(id.clone(), operation.clone());
        let statement = self.text("show total before payment; preserve billing");
        let context = self.text("earlier price clarity matters; inspect then adapt local layout");
        let definition = self.text("total is visible before payment");
        let reference = |content| ContentReference {
            identity: self.identity.clone(),
            operation: operation.clone(),
            content,
        };
        let statement = reference(statement);
        let context = reference(context);
        let definition = reference(definition);
        Proposal {
            id,
            agreement: AgreementId::new(),
            identity: self.identity.clone(),
            expected_agreement: expected,
            terms: Terms {
                binding: vec![TermSelection {
                    statement: statement.clone(),
                    context: BTreeSet::from([context.clone()]),
                }],
                context: BTreeSet::from([context]),
                unknowns: vec![Unknown {
                    question: self.text("which display works?"),
                    bounded_by: self.text("local fixture observations only"),
                    affected: BTreeSet::from([statement.clone()]),
                }],
                criteria: vec![Criterion {
                    id: CriterionId::new(),
                    definition,
                    terms: BTreeSet::from([statement]),
                }],
            },
            dependencies,
        }
    }
    pub fn assessment(&mut self, p: &Proposal, dependencies: Vec<Dependency>) -> Assessment {
        Assessment {
            id: AssessmentId::new(),
            proposal: p.id.clone(),
            feasibility: self.text("plausible in fixture"),
            capabilities: self.text("no native capabilities supplied"),
            resources: self.text("bounded fixture resources"),
            commitments: self.text("known declared commitments only"),
            coverage: self.text("not a complete Ledger scan"),
            limitations: self.text("missing history remains unavailable"),
            dependencies,
            blockers: vec![],
        }
    }
    pub fn retain_proposal(&mut self, p: &Proposal) -> Assessment {
        self.owner();
        self.execute(Command::Propose {
            proposal: p.clone(),
            access: Access::Owner,
        })
        .unwrap();
        let a = self.assessment(p, p.dependencies.clone());
        self.execute(Command::Assess {
            assessment: a.clone(),
            access: Access::Owner,
        })
        .unwrap();
        a
    }
    pub fn adopt(&mut self, p: &Proposal, deps: Vec<Dependency>) -> Decision {
        self.owner();
        let d = Decision {
            id: DecisionId::new(),
            proposal: p.id.clone(),
            kind: DecisionKind::Adopt,
            dependencies: deps,
        };
        self.execute(Command::Decide(d.clone())).unwrap();
        d
    }
    pub fn undertake(&mut self, p: &Proposal, a: &Assessment, deps: Vec<Dependency>) -> Decision {
        self.agent();
        let d = Decision {
            id: DecisionId::new(),
            proposal: p.id.clone(),
            kind: DecisionKind::Undertake {
                assessment: a.id.clone(),
            },
            dependencies: deps,
        };
        self.execute(Command::Decide(d.clone())).unwrap();
        d
    }
    pub fn agree(&mut self) -> (Proposal, Assessment) {
        self.initiate();
        let p = self.proposal(None, vec![]);
        let a = self.retain_proposal(&p);
        self.adopt(&p, vec![]);
        self.undertake(&p, &a, vec![]);
        (p, a)
    }
    pub fn grant(&mut self, spec: GrantSpec) -> GrantUse {
        self.owner();
        let id = GrantId::new();
        let Effect::Grant(g) = self
            .execute(Command::SetGrant {
                id,
                expected_generation: None,
                spec,
            })
            .unwrap()
            .effect
        else {
            panic!("grant")
        };
        g
    }
    pub fn draft_spec(&self, actions: BTreeSet<GrantAction>) -> GrantSpec {
        GrantSpec {
            creation: None,
            content_origins: BTreeSet::new(),
            disclosure_origins: BTreeSet::new(),
            recipient: self.identity.agent.clone(),
            target: GrantTarget::Draft(self.identity.change.clone()),
            actions,
            content_items: self.ports.content_items.keys().cloned().collect(),
            disclosure: BTreeSet::new(),
            native_actions: BTreeSet::new(),
            native_scope: BTreeSet::new(),
            limits: BTreeSet::new(),
        }
    }
    pub fn action(&mut self, p: &Proposal) -> (GrantSpec, ActionRequest) {
        let condition = self.text("supported fixture-only native conditions");
        let native_action = NativeActionId::new();
        let scope = BTreeSet::from([ScopeId::new()]);
        let limits = BTreeSet::from([LimitId::new()]);
        let spec = GrantSpec {
            creation: None,
            content_origins: BTreeSet::new(),
            disclosure_origins: BTreeSet::new(),
            recipient: self.identity.agent.clone(),
            target: GrantTarget::Pursuit(p.agreement.clone()),
            actions: BTreeSet::from([
                GrantAction::Admit,
                GrantAction::Dispatch,
                GrantAction::Finding,
                GrantAction::Adapt,
                GrantAction::Progress,
            ]),
            content_items: self.ports.content_items.keys().cloned().collect(),
            disclosure: self.ports.content_items.keys().cloned().collect(),
            native_actions: BTreeSet::from([native_action.clone()]),
            native_scope: scope.clone(),
            limits: limits.clone(),
        };
        let grant = self.grant(spec.clone());
        (
            spec,
            ActionRequest {
                id: ActionId::new(),
                agreement: p.agreement.clone(),
                grant,
                native_action,
                scope,
                limits,
                dependencies: vec![],
                conditions: vec![condition],
            },
        )
    }
    pub fn fulfillment(&self, p: &Proposal) -> Fulfillment {
        Fulfillment {
            agreement: p.agreement.clone(),
            criteria: p
                .terms
                .criteria
                .iter()
                .map(|c| CriterionEvidence {
                    criterion: c.id.clone(),
                    evidence: self.ports.native_evidence.clone(),
                })
                .collect(),
            resolutions: vec![],
            acceptance: self.ports.native_evidence[0].content.clone(),
        }
    }
}

pub fn local_key(identity: &Identity) -> ContentKey {
    ContentKey {
        establishing: identity.change_key(),
        id: ContentId::new(),
    }
}
pub fn unbound_source() -> SourceClaim {
    SourceClaim {
        input_kind: InputKind::PreExisting,
        binding_knowledge: BindingKnowledge::NoKnownBinding,
        attribution: Attribution::Unknown,
        limitations: b"supplied fixture input; limited local binding knowledge, not global absence"
            .to_vec(),
    }
}

/// Build new fields before borrowing the cached fixture; never accepts an existing Operation.
pub fn new_operation(
    id: OperationId,
    command: Command,
    fresh: Vec<FreshContent>,
    f: &Fixture,
) -> Operation {
    f.operation(id, command, fresh)
}
