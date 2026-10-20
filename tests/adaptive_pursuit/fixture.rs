//! Model-free trusted fixtures. Assertions here are not native permission or semantic truth.
use changekernel::unqualified_pursuit::*;
use std::collections::{BTreeMap, BTreeSet};

pub enum Race {
    Material(MaterialId),
    Ground(GroundId),
    Context,
}
pub struct FixturePorts {
    pub context: Context,
    pub materials: BTreeMap<MaterialId, Vec<u8>>,
    pub grounds: BTreeMap<GroundId, GroundVersion>,
    pub accepted: BTreeMap<OperationId, (Operation, Accepted)>,
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
            None => {}
        }
        if checks.expected_operation != self.last_operation {
            return Err(Error::Stale);
        }
        if checks.context != self.context {
            return Err(Error::Stale);
        }
        for (id, bytes) in &checks.materials {
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
        self.materials.get(id).cloned().ok_or(Error::Unavailable)
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
    fn accept(
        &mut self,
        checks: &Checks,
        operation: &Operation,
        accepted: &Accepted,
    ) -> Result<()> {
        self.validate(checks)?;
        if self.refuse_acceptance {
            return Err(Error::Unavailable);
        }
        if self.accepted.contains_key(&operation.id) {
            return Err(Error::Conflict);
        }
        self.accepted
            .insert(operation.id.clone(), (operation.clone(), accepted.clone()));
        self.last_operation = Some(operation.id.clone());
        Ok(())
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        self.disclose_calls += 1;
        self.validate(checks)
    }
}

pub struct Fixture {
    pub pursuit: Pursuit,
    pub ports: FixturePorts,
    pub identity: Identity,
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
            grounds: BTreeMap::new(),
            accepted: BTreeMap::new(),
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
    pub fn execute(&mut self, command: Command) -> Result<Accepted> {
        self.pursuit.execute(
            Operation {
                id: OperationId::new(),
                command,
            },
            &mut self.ports,
        )
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
        Proposal {
            id: ProposalId::new(),
            agreement: AgreementId::new(),
            identity: self.identity.clone(),
            expected_agreement: expected,
            terms: Terms {
                why: self.text("earlier price clarity matters"),
                what: self.text("show total before payment; preserve billing"),
                how: self.text("bounded investigation then adapt within discretion"),
                unknowns: vec![Unknown {
                    dimension: Dimension::How,
                    question: self.text("which display works?"),
                    bounded_by: self.text("local fixture observations only"),
                }],
                criteria: vec![Criterion {
                    id: CriterionId::new(),
                    definition: self.text("total is visible before payment"),
                }],
                mandatory: vec![self.text("no billing changes")],
                discretion: vec![self.text("layout and local method may change")],
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
