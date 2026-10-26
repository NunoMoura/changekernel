//! Model-free trusted fixtures. Assertions here are not native permission or semantic truth.
use changekernel::unqualified_pursuit::*;
use std::collections::{BTreeMap, BTreeSet};
#[path = "../support/ids.rs"]
mod ids;
pub use ids::TestId;
#[path = "../support/submission.rs"]
mod submission;
pub use submission::TestSubmit;

pub enum Race {
    Material(MaterialId),
    Ground(GroundId),
    Context,
    Disclosure,
    Prefix,
    CreationSource,
    CreationGrant,
}
pub struct FixturePorts {
    pub context: Context,
    pub materials: BTreeMap<MaterialId, Vec<u8>>,
    pub created: BTreeMap<MaterialId, RecordedMaterial>,
    pub grants: BTreeMap<GrantId, Grant>,
    pub creation_sources: BTreeSet<(Identity, ActorId, ActorId)>,
    pub denied_materials: BTreeSet<MaterialId>,
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
            Some(Race::Material(id)) => {
                self.materials
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
                matches!(&checks.disclosure, ReadScope::Material(id)
                    if self.created.get(id).is_some_and(|r| r.origin.scope() == *origin))
                    && self
                        .context
                        .disclosure
                        .contains(&ReadScope::Origin(origin.clone()))
            })
        {
            return Err(Error::Denied);
        }
        for (id, bytes) in &checks.materials {
            if checks
                .creation
                .as_ref()
                .is_some_and(|c| c.materials.contains_key(id))
            {
                continue;
            }
            if self.denied_materials.contains(id) {
                return Err(Error::Denied);
            }
            if self.materials.get(id) != Some(bytes) {
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
    fn material(&mut self, id: &MaterialId) -> Result<Vec<u8>> {
        if self.denied_materials.contains(id) {
            return Err(Error::Denied);
        }
        self.materials.get(id).cloned().ok_or(Error::Unavailable)
    }
    fn authorize_creation(&mut self, checks: &Checks, operation: &Operation) -> Result<()> {
        let creation = checks.creation.as_ref().ok_or(Error::Invalid)?;
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
        let usage = MaterialUsage::measure(&operation.fresh)?;
        if usage != creation.usage
            || !usage.within(grant.spec.creation.as_ref().ok_or(Error::Denied)?)
            || creation.materials.len() != operation.fresh.len()
        {
            return Err(Error::Invalid);
        }
        for payload in &operation.fresh {
            if self.materials.contains_key(&payload.id) || self.created.contains_key(&payload.id) {
                return Err(Error::Conflict);
            }
            if !self.creation_sources.contains(&(
                checks.identity.clone(),
                checks.context.authority.actor.clone(),
                payload.attributed_source.clone(),
            )) {
                return Err(Error::Denied);
            }
            let expected = RecordedMaterial {
                payload: payload.clone(),
                origin: MaterialOrigin {
                    binding: MaterialReference {
                        identity: checks.identity.clone(),
                        operation: operation.id.clone(),
                        material: payload.id.clone(),
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
            if creation.materials.get(&payload.id) != Some(&expected)
                || checks.materials.get(&payload.id) != Some(&payload.bytes)
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
            if checks.creation.is_some() {
                self.authorize_creation(checks, operation)
            } else {
                Ok(())
            }
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
            for (id, recorded) in &creation.materials {
                self.materials
                    .insert(id.clone(), recorded.payload.bytes.clone());
                self.created.insert(id.clone(), recorded.clone());
            }
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

/// Explicit cached caller metadata; does not fetch context or repair a Submission.
pub fn submission_for(
    identity: &Identity,
    authority: &Authority,
    operation: Operation,
) -> Submission {
    Submission {
        profile: CURRENT_PROFILE,
        target: identity.change_key(),
        actor: authority.actor.clone(),
        represented_owner: authority.represented_owner.clone(),
        operation,
    }
}

pub struct Fixture {
    pub pursuit: Pursuit,
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
        let evidence_material = MaterialId::new();
        let limitations = MaterialId::new();
        let evidence = Evidence {
            source: identity.owner_actor.clone(),
            material: evidence_material.clone(),
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
        let ports = FixturePorts {
            context,
            materials: BTreeMap::from([
                (evidence_material, b"supplied fixture observation".to_vec()),
                (limitations, b"fixture only; no native execution".to_vec()),
            ]),
            created: BTreeMap::new(),
            grants: BTreeMap::new(),
            creation_sources: BTreeSet::new(),
            denied_materials: BTreeSet::new(),
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
            pursuit: Pursuit::new(identity.clone()).unwrap(),
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
    pub fn text(&mut self, text: &str) -> MaterialId {
        let id = MaterialId::new();
        self.ports
            .materials
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
    pub fn submission(&self, operation: Operation) -> Submission {
        submission_for(&self.identity, &self.ports.context.authority, operation)
    }
    pub fn execute(&mut self, command: Command) -> Result<Accepted> {
        let operation = Operation {
            fresh: vec![],
            id: match &command {
                Command::Propose { proposal, .. } => self
                    .proposal_operations
                    .get(&proposal.id)
                    .cloned()
                    .unwrap_or_else(OperationId::new),
                _ => OperationId::new(),
            },
            command,
        };
        let submission = self.submission(operation);
        self.pursuit.submit(submission, &mut self.ports)
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
        let reference = |material| MaterialReference {
            identity: self.identity.clone(),
            operation: operation.clone(),
            material,
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
            material_origins: BTreeSet::new(),
            disclosure_origins: BTreeSet::new(),
            recipient: self.identity.agent.clone(),
            target: GrantTarget::Draft(self.identity.change.clone()),
            actions,
            materials: self.ports.materials.keys().cloned().collect(),
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
            material_origins: BTreeSet::new(),
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
            materials: self.ports.materials.keys().cloned().collect(),
            disclosure: self.ports.materials.keys().cloned().collect(),
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
            acceptance: self.ports.native_evidence[0].material.clone(),
        }
    }
}
