//! Independent P2 boundary tests. All authority, material and native-condition inputs are
//! in-process fixtures; these tests establish no host permission or durable acceptance.
use changekernel::unqualified_pursuit::*;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone)]
enum Cut {
    Reject,
    Context,
    Material(MaterialId),
    Ground(GroundId),
}
struct Boundary {
    context: Context,
    materials: BTreeMap<MaterialId, Vec<u8>>,
    grounds: BTreeMap<GroundId, GroundVersion>,
    evidence: Evidence,
    judgment: ScopeJudgment,
    cut: Option<Cut>,
    accepted: Vec<(Operation, Accepted)>,
    last_operation: Option<OperationId>,
}
impl Boundary {
    fn check(&mut self, checks: &Checks) -> Result<()> {
        match self.cut.take() {
            Some(Cut::Reject) => return Err(Error::Unavailable),
            Some(Cut::Context) => self.context.disclosure.clear(),
            Some(Cut::Material(id)) => {
                self.materials.insert(id, b"substituted bytes".to_vec());
            }
            Some(Cut::Ground(id)) => {
                self.grounds.insert(id, GroundVersion::new());
            }
            None => {}
        }
        if checks.context != self.context || checks.expected_operation != self.last_operation {
            return Err(Error::Stale);
        }
        if !self.context.disclosure.contains(&checks.disclosure)
            && !self
                .context
                .disclosure
                .contains(&ReadScope::Change(checks.identity.change.clone()))
        {
            return Err(Error::Denied);
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
        if let Some((_, judgment)) = &checks.adaptation {
            if judgment != &self.judgment {
                return Err(Error::Stale);
            }
        }
        if let Some((request, conditions)) = &checks.native {
            if conditions.action != request.id || conditions.evidence != vec![self.evidence.clone()]
            {
                return Err(Error::Stale);
            }
        }
        Ok(())
    }
    fn text(&mut self, text: &str) -> MaterialId {
        let id = MaterialId::new();
        self.materials.insert(id.clone(), text.as_bytes().to_vec());
        id
    }
}
impl Ports for Boundary {
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
        Ok(self.judgment.clone())
    }
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions> {
        Ok(NativeConditions {
            action: action.id.clone(),
            evidence: vec![self.evidence.clone()],
        })
    }
    fn accept(&mut self, checks: &Checks, op: &Operation, result: &Accepted) -> Result<()> {
        self.check(checks)?;
        assert!(
            !self.accepted.iter().any(|(old, _)| old.id == op.id),
            "duplicate acceptance"
        );
        self.accepted.push((op.clone(), result.clone()));
        self.last_operation = Some(op.id.clone());
        Ok(())
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        self.check(checks)
    }
}
struct Harness {
    app: Pursuit,
    io: Boundary,
    identity: Identity,
}
struct Pair {
    proposal: Proposal,
    proposal_op: Operation,
    assessment: Assessment,
    adopt: DecisionId,
    undertake: DecisionId,
}
impl Harness {
    fn new() -> Self {
        let identity = Identity {
            owner: OwnerId::new(),
            owner_actor: ActorId::new(),
            ledger: LedgerId::new(),
            change: ChangeId::new(),
            agent: ActorId::new(),
        };
        let material = MaterialId::new();
        let limitations = MaterialId::new();
        let evidence = Evidence {
            source: identity.agent.clone(),
            material: material.clone(),
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
        let io = Boundary {
            context,
            materials: BTreeMap::from([
                (material, b"fixture observation".to_vec()),
                (limitations, b"not native proof".to_vec()),
            ]),
            grounds: BTreeMap::new(),
            judgment: ScopeJudgment::WithinDiscretion(evidence.clone()),
            evidence,
            cut: None,
            accepted: vec![],
            last_operation: None,
        };
        Self {
            app: Pursuit::new(identity.clone()).unwrap(),
            io,
            identity,
        }
    }
    fn actor(&mut self, owner: bool) {
        self.io.context.version = ContextVersion::new();
        self.io.context.authority = Authority {
            actor: if owner {
                self.identity.owner_actor.clone()
            } else {
                self.identity.agent.clone()
            },
            represented_owner: self.identity.owner.clone(),
            owner_control: owner.then(|| self.identity.clone()),
            agent_role: (!owner).then(|| self.identity.clone()),
        };
        self.io.context.disclosure =
            BTreeSet::from([ReadScope::Change(self.identity.change.clone())]);
    }
    fn execute(&mut self, command: Command) -> (Operation, Accepted) {
        let op = Operation {
            id: OperationId::new(),
            command,
        };
        let result = self.app.execute(op.clone(), &mut self.io).unwrap();
        (op, result)
    }
    fn refuse(&mut self, command: Command) -> Error {
        let n = self.io.accepted.len();
        let op = Operation {
            id: OperationId::new(),
            command,
        };
        let error = self.app.execute(op, &mut self.io).unwrap_err();
        assert_eq!(self.io.accepted.len(), n);
        error
    }
    fn status(&mut self) -> Status {
        self.actor(true);
        let Read::Status(status) = self
            .app
            .read(Query::Status, Access::Owner, &mut self.io)
            .unwrap()
        else {
            panic!("status reply")
        };
        status
    }
    fn initiate(&mut self) {
        let wish = self.io.text("Checkout feels wrong");
        self.execute(Command::Initiate {
            wish,
            access: Access::Owner,
        });
    }
    fn pair(
        &mut self,
        expected: Option<AgreementId>,
        deps: Vec<Dependency>,
        terms: Option<Terms>,
    ) -> Pair {
        self.actor(true);
        let operation = OperationId::new();
        let terms = terms.unwrap_or_else(|| {
            let statement = self
                .io
                .text("Investigate price display; do not change payment behavior");
            let context = self
                .io
                .text("User values price clarity; choose inspection method");
            let definition = self.io.text("Explain the observed discrepancy");
            let reference = |material| MaterialReference {
                identity: self.identity.clone(),
                operation: operation.clone(),
                material,
            };
            let statement = reference(statement);
            let context = reference(context);
            let definition = reference(definition);
            Terms {
                binding: vec![TermSelection {
                    statement: statement.clone(),
                    context: BTreeSet::from([context.clone()]),
                }],
                context: BTreeSet::from([context]),
                unknowns: vec![Unknown {
                    question: self.io.text("Which label misleads?"),
                    bounded_by: self.io.text("Read-only investigation"),
                    affected: BTreeSet::from([statement.clone()]),
                }],
                criteria: vec![Criterion {
                    id: CriterionId::new(),
                    definition,
                    terms: BTreeSet::from([statement]),
                }],
            }
        });
        let proposal = Proposal {
            id: ProposalId::new(),
            agreement: AgreementId::new(),
            identity: self.identity.clone(),
            expected_agreement: expected,
            terms,
            dependencies: deps.clone(),
        };
        let proposal_op = Operation {
            id: operation,
            command: Command::Propose {
                proposal: proposal.clone(),
                access: Access::Owner,
            },
        };
        self.app.execute(proposal_op.clone(), &mut self.io).unwrap();
        let assessment = Assessment {
            id: AssessmentId::new(),
            proposal: proposal.id.clone(),
            feasibility: self.io.text("Bounded inspection is feasible"),
            capabilities: self.io.text("Fixture conditions only"),
            resources: self.io.text("One foreground operation"),
            commitments: self
                .io
                .text("Declared commitments inspected; discovery is not exhaustive"),
            coverage: self.io.text("This Change only"),
            limitations: self.io.text("No host or durable store"),
            dependencies: deps.clone(),
            blockers: vec![],
        };
        self.execute(Command::Assess {
            assessment: assessment.clone(),
            access: Access::Owner,
        });
        let adopt = DecisionId::new();
        self.execute(Command::Decide(Decision {
            id: adopt.clone(),
            proposal: proposal.id.clone(),
            kind: DecisionKind::Adopt,
            dependencies: deps.clone(),
        }));
        self.actor(false);
        let undertake = DecisionId::new();
        let (_, result) = self.execute(Command::Decide(Decision {
            id: undertake.clone(),
            proposal: proposal.id.clone(),
            kind: DecisionKind::Undertake {
                assessment: assessment.id.clone(),
            },
            dependencies: deps,
        }));
        assert!(matches!(
            result.effect,
            Effect::Decision {
                activated: Some(_),
                ..
            }
        ));
        Pair {
            proposal,
            proposal_op,
            assessment,
            adopt,
            undertake,
        }
    }
    fn grant(
        &mut self,
        agreement: &AgreementId,
        scopes: BTreeSet<ScopeId>,
    ) -> (GrantUse, GrantSpec) {
        self.actor(true);
        let id = GrantId::new();
        let spec = GrantSpec {
            recipient: self.identity.agent.clone(),
            target: GrantTarget::Pursuit(agreement.clone()),
            actions: BTreeSet::from([GrantAction::Admit, GrantAction::Dispatch]),
            materials: self.io.materials.keys().cloned().collect(),
            disclosure: self.io.materials.keys().cloned().collect(),
            native_actions: BTreeSet::from([NativeActionId::new()]),
            native_scope: scopes,
            limits: BTreeSet::from([LimitId::new()]),
        };
        self.execute(Command::SetGrant {
            id: id.clone(),
            expected_generation: None,
            spec: spec.clone(),
        });
        (GrantUse { id, generation: 1 }, spec)
    }
    fn action(
        pair: &Pair,
        grant: &GrantUse,
        spec: &GrantSpec,
        condition: &MaterialId,
    ) -> ActionRequest {
        ActionRequest {
            id: ActionId::new(),
            agreement: pair.proposal.agreement.clone(),
            grant: grant.clone(),
            native_action: spec.native_actions.first().unwrap().clone(),
            scope: spec.native_scope.clone(),
            limits: spec.limits.clone(),
            dependencies: vec![],
            conditions: vec![condition.clone()],
        }
    }
}

#[test]
fn serialization_cuts_do_not_publish_or_reserve_a_retry_identity() {
    for kind in 0..3 {
        let mut h = Harness::new();
        let wish = h.io.text("Bounded draft");
        let bytes = h.io.materials[&wish].clone();
        let op = Operation {
            id: OperationId::new(),
            command: Command::Initiate {
                wish: wish.clone(),
                access: Access::Owner,
            },
        };
        h.io.cut = Some(match kind {
            0 => Cut::Reject,
            1 => Cut::Context,
            _ => Cut::Material(wish.clone()),
        });
        assert!(h.app.execute(op.clone(), &mut h.io).is_err());
        h.actor(true);
        h.io.materials.insert(wish, bytes);
        assert!(!h.status().initiated);
        let first = h.app.execute(op.clone(), &mut h.io).unwrap();
        assert_eq!(h.app.execute(op, &mut h.io).unwrap(), first);
        assert_eq!(h.io.accepted.len(), 1);
    }
}

#[test]
fn retry_keeps_original_authority_but_requires_current_disclosure_and_exact_material() {
    let mut h = Harness::new();
    let wish = h.io.text("Original owner wish");
    let (op, result) = h.execute(Command::Initiate {
        wish: wish.clone(),
        access: Access::Owner,
    });
    let original = h.app.record(&op.id, &mut h.io).unwrap().unwrap();
    h.actor(true);
    let reason = h.io.text("Withdraw without fulfilling");
    h.execute(Command::Withdraw { reason });
    h.io.cut = Some(Cut::Context);
    assert!(h.app.execute(op.clone(), &mut h.io).is_err());
    h.actor(true);
    assert_eq!(h.app.execute(op.clone(), &mut h.io).unwrap(), result);
    assert_eq!(h.app.record(&op.id, &mut h.io).unwrap(), Some(original));
    let mut conflict = op.clone();
    conflict.command = Command::Withdraw {
        reason: wish.clone(),
    };
    assert_eq!(h.app.execute(conflict, &mut h.io), Err(Error::Conflict));
    h.io.materials
        .insert(wish, b"same handle, changed content".to_vec());
    assert_eq!(h.app.execute(op, &mut h.io), Err(Error::Conflict));
    assert_eq!(h.io.accepted.len(), 2);
}

#[test]
fn grant_replacement_does_not_revive_old_admission_and_grants_do_not_union() {
    let mut h = Harness::new();
    h.initiate();
    let pair = h.pair(None, vec![], None);
    let scope = ScopeId::new();
    let other = ScopeId::new();
    let (grant, spec) = h.grant(&pair.proposal.agreement, BTreeSet::from([scope]));
    h.grant(&pair.proposal.agreement, BTreeSet::from([other.clone()]));
    h.actor(false);
    let action = Harness::action(&pair, &grant, &spec, &h.io.evidence.material);
    let mut union = action.clone();
    union.scope.insert(other);
    assert_eq!(h.refuse(Command::Admit(union)), Error::Denied);
    h.execute(Command::Admit(action.clone()));
    h.actor(true);
    h.execute(Command::SetGrant {
        id: grant.id.clone(),
        expected_generation: Some(1),
        spec: spec.clone(),
    });
    h.actor(false);
    assert!(
        h.refuse(Command::Dispatch {
            action: action.id.clone()
        }) == Error::Denied
    );
    h.actor(true);
    h.execute(Command::RevokeGrant {
        id: grant.id.clone(),
        expected_generation: 2,
    });
    assert_eq!(
        h.refuse(Command::SetGrant {
            id: grant.id,
            expected_generation: Some(3),
            spec
        }),
        Error::Conflict
    );
}

#[test]
fn proposal_ground_reaffirmation_preserves_terms_and_each_partys_decision() {
    let mut h = Harness::new();
    h.initiate();
    let ground = GroundId::new();
    let old = GroundVersion::new();
    h.io.grounds.insert(ground.clone(), old.clone());
    let pair = h.pair(
        None,
        vec![Dependency {
            ground: ground.clone(),
            version: old,
        }],
        None,
    );
    let (grant, spec) = h.grant(&pair.proposal.agreement, BTreeSet::from([ScopeId::new()]));
    let original = h
        .app
        .record(&pair.proposal_op.id, &mut h.io)
        .unwrap()
        .unwrap();
    let next = GroundVersion::new();
    h.io.grounds.insert(ground.clone(), next.clone());
    let deps = vec![Dependency {
        ground: ground.clone(),
        version: next.clone(),
    }];
    h.actor(false);
    let action = Harness::action(&pair, &grant, &spec, &h.io.evidence.material);
    assert_eq!(h.refuse(Command::Admit(action.clone())), Error::Stale);
    assert_eq!(
        h.refuse(Command::Reaffirm {
            decision: pair.adopt.clone(),
            dependencies: deps.clone(),
            assessment: None
        }),
        Error::Denied
    );
    h.actor(true);
    h.execute(Command::Reaffirm {
        decision: pair.adopt,
        dependencies: deps.clone(),
        assessment: None,
    });
    let mut assessment = pair.assessment;
    assessment.id = AssessmentId::new();
    assessment.dependencies = deps.clone();
    h.execute(Command::Assess {
        assessment: assessment.clone(),
        access: Access::Owner,
    });
    h.actor(false);
    h.execute(Command::Reaffirm {
        decision: pair.undertake,
        dependencies: deps,
        assessment: Some(assessment.id),
    });
    // A boundary race still cannot publish the new action after planning succeeds.
    h.io.cut = Some(Cut::Ground(ground.clone()));
    assert_eq!(h.refuse(Command::Admit(action.clone())), Error::Stale);
    h.io.grounds.insert(ground, next);
    h.execute(Command::Admit(action));
    // Original proposal history remains byte/identity exact despite effective reaffirmation.
    h.actor(true);
    assert_eq!(
        h.app.record(&pair.proposal_op.id, &mut h.io).unwrap(),
        Some(original)
    );
    assert_eq!(h.status().current_agreement, Some(pair.proposal.agreement));
}

#[test]
fn revision_cannot_hide_pending_effects_and_withdrawal_keeps_action_association() {
    let mut h = Harness::new();
    h.initiate();
    let pair = h.pair(None, vec![], None);
    let (grant, spec) = h.grant(&pair.proposal.agreement, BTreeSet::from([ScopeId::new()]));
    h.actor(false);
    let action = Harness::action(&pair, &grant, &spec, &h.io.evidence.material);
    h.execute(Command::Admit(action.clone()));
    h.execute(Command::Dispatch {
        action: action.id.clone(),
    });
    let revision = h.pair(
        Some(pair.proposal.agreement.clone()),
        vec![],
        Some(pair.proposal.terms.clone()),
    );
    h.actor(true);
    let acceptance = h.io.text("Owner acceptance against the same criteria");
    let fulfillment = Fulfillment {
        agreement: revision.proposal.agreement.clone(),
        criteria: revision
            .proposal
            .terms
            .criteria
            .iter()
            .map(|c| CriterionEvidence {
                criterion: c.id.clone(),
                evidence: vec![h.io.evidence.clone()],
            })
            .collect(),
        resolutions: vec![],
        acceptance,
    };
    assert!(h.refuse(Command::Fulfill(fulfillment)) == Error::Conflict);
    let reason = h.io.text("Stop pursuit, retain unresolved responsibility");
    h.execute(Command::Withdraw { reason });
    h.actor(false);
    assert_eq!(
        h.refuse(Command::Dispatch {
            action: action.id.clone()
        }),
        Error::Terminal
    );
    h.actor(true);
    let id = GrantId::new();
    let spec = GrantSpec {
        recipient: h.identity.agent.clone(),
        target: GrantTarget::Reconciliation(BTreeSet::from([action.id.clone()])),
        actions: BTreeSet::from([GrantAction::Reconcile]),
        materials: h.io.materials.keys().cloned().collect(),
        disclosure: h.io.materials.keys().cloned().collect(),
        native_actions: BTreeSet::new(),
        native_scope: BTreeSet::new(),
        limits: BTreeSet::new(),
    };
    h.execute(Command::SetGrant {
        id: id.clone(),
        expected_generation: None,
        spec,
    });
    h.actor(false);
    let recovery = GrantUse { id, generation: 1 };
    h.execute(Command::Reconcile {
        action: action.id.clone(),
        grant: recovery.clone(),
        evidence: vec![h.io.evidence.clone()],
        outcome: ActionOutcome::Unknown,
    });
    let Read::Action(retained) = h
        .app
        .read(
            Query::Action(action.id.clone()),
            Access::Grant(recovery),
            &mut h.io,
        )
        .unwrap()
    else {
        panic!("action reply")
    };
    assert_eq!(retained.request, action);
    assert_eq!(retained.phase, ActionPhase::Dispatched);
    assert_eq!(retained.outcome, ActionOutcome::Unknown);
    assert_eq!(h.status().settlement, Some(Settlement::Withdrawn));
}

#[test]
fn replacement_assessment_does_not_resolve_an_evidenced_blocker_by_omission() {
    let mut h = Harness::new();
    h.initiate();
    let pair = h.pair(None, vec![], None);
    h.actor(true);
    let blocker =
        h.io.text("Known unresolved discrepancy against the agreed criterion");
    let mut blocked = pair.assessment.clone();
    blocked.id = AssessmentId::new();
    blocked.blockers = vec![blocker];
    h.execute(Command::Assess {
        assessment: blocked.clone(),
        access: Access::Owner,
    });
    h.actor(false);
    h.execute(Command::Reaffirm {
        decision: pair.undertake.clone(),
        dependencies: vec![],
        assessment: Some(blocked.id),
    });
    h.actor(true);
    // Same assessment sources, but the unresolved blocker is omitted. No resolution is supplied.
    let mut omission = pair.assessment;
    omission.id = AssessmentId::new();
    h.execute(Command::Assess {
        assessment: omission.clone(),
        access: Access::Owner,
    });
    h.actor(false);
    h.execute(Command::Reaffirm {
        decision: pair.undertake,
        dependencies: vec![],
        assessment: Some(omission.id),
    });
    h.actor(true);
    let acceptance =
        h.io.text("Accept against the current agreement only if blockers are resolved");
    let fulfillment = Fulfillment {
        agreement: pair.proposal.agreement,
        criteria: pair
            .proposal
            .terms
            .criteria
            .iter()
            .map(|criterion| CriterionEvidence {
                criterion: criterion.id.clone(),
                evidence: vec![h.io.evidence.clone()],
            })
            .collect(),
        resolutions: vec![],
        acceptance,
    };
    assert_eq!(h.refuse(Command::Fulfill(fulfillment)), Error::Conflict);
}
