use super::*;

fn refuse_operation(f: &mut Fixture, operation: Operation, error: Error) {
    let context = f.ports.context.clone();
    let before = f.status();
    let accepted = f.ports.accepted.clone();
    let prefix = f.ports.last_operation.clone();
    f.ports.context = context.clone();
    assert_eq!(
        f.pursuit
            .submit(f.submission(operation.clone()), &mut f.ports),
        Err(error)
    );
    assert_eq!(f.ports.accepted, accepted);
    assert_eq!(f.ports.last_operation, prefix);
    assert_eq!(f.status(), before);
    assert_eq!(f.pursuit.record(&operation.id, &mut f.ports), Ok(None));
    f.ports.context = context;
}

fn refuse(f: &mut Fixture, command: Command, error: Error) {
    refuse_operation(
        f,
        Operation {
            fresh: vec![],
            id: OperationId::new(),
            command,
        },
        error,
    );
}

fn progress(f: &mut Fixture, p: &Proposal) -> Progress {
    Progress {
        agreement: p.agreement.clone(),
        terms: BTreeSet::from([p.terms.binding[0].statement.clone()]),
        criteria: BTreeSet::new(),
        evidence: f.ports.native_evidence.clone(),
        understanding: ProgressDimension {
            value: ProgressValue::Advanced,
            assessment: f.text("finding exposed an unknown in the current terms"),
        },
        outcome: ProgressDimension {
            value: ProgressValue::Unknown,
            assessment: f.text("no observed improvement yet"),
        },
        basis: ChangeBasis::CorrectedUnderstanding,
    }
}

#[test]
fn incomplete_draft_is_retained_but_neither_decision_can_accept_empty_binding_in_either_order() {
    for owner_first in [true, false] {
        let mut f = Fixture::new();
        f.initiate();
        let mut p = f.proposal(None, vec![]);
        p.terms.binding.clear();
        p.terms.criteria.clear();
        let a = f.retain_proposal(&p);
        let record = f
            .pursuit
            .record(&f.proposal_operations[&p.id], &mut f.ports)
            .unwrap()
            .unwrap();
        assert_eq!(
            record.operation.command,
            Command::Propose {
                proposal: p.clone(),
                access: Access::Owner
            }
        );
        let adoption = Decision {
            id: DecisionId::new(),
            proposal: p.id.clone(),
            kind: DecisionKind::Adopt,
            dependencies: vec![],
        };
        let undertaking = Decision {
            id: DecisionId::new(),
            proposal: p.id.clone(),
            kind: DecisionKind::Undertake { assessment: a.id },
            dependencies: vec![],
        };
        for owner in [owner_first, !owner_first] {
            let decision = if owner {
                f.owner();
                &adoption
            } else {
                f.agent();
                &undertaking
            };
            refuse(&mut f, Command::Decide(decision.clone()), Error::Invalid);
        }
        assert_eq!(f.status().current_agreement, None);
        // Refused decisions are not unmatched decisions that can later be retracted.
        for decision in [adoption, undertaking] {
            refuse(
                &mut f,
                Command::Retract {
                    decision: decision.id,
                },
                Error::Invalid,
            );
        }
        let reason = f.text("stop this incomplete draft");
        f.execute(Command::Withdraw { reason }).unwrap();
        assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
    }
}

#[test]
fn criterion_free_agreement_activates_in_either_order_only_with_retained_matching_assessment() {
    for owner_first in [true, false] {
        let mut f = Fixture::new();
        f.initiate();
        let other = f.proposal(None, vec![]);
        let other_assessment = f.retain_proposal(&other);
        let mut p = f.proposal(None, vec![]);
        p.terms.criteria.clear();
        f.execute(Command::Propose {
            proposal: p.clone(),
            access: Access::Owner,
        })
        .unwrap();
        if owner_first {
            f.adopt(&p, vec![]);
        }
        f.agent();
        for (assessment, error) in [
            (AssessmentId::new(), Error::Invalid),
            (other_assessment.id, Error::Conflict),
        ] {
            refuse(
                &mut f,
                Command::Decide(Decision {
                    id: DecisionId::new(),
                    proposal: p.id.clone(),
                    kind: DecisionKind::Undertake { assessment },
                    dependencies: vec![],
                }),
                error,
            );
        }
        f.owner();
        let a = f.assessment(&p, vec![]);
        let material = a.coverage.clone();
        let bytes = f.ports.materials.remove(&material).unwrap();
        refuse(
            &mut f,
            Command::Assess {
                assessment: a.clone(),
                access: Access::Owner,
            },
            Error::Unavailable,
        );
        f.ports.materials.insert(material, bytes);
        f.execute(Command::Assess {
            assessment: a.clone(),
            access: Access::Owner,
        })
        .unwrap();
        let material = a.limitations.clone();
        let bytes = f.ports.materials.remove(&material).unwrap();
        f.agent();
        refuse(
            &mut f,
            Command::Decide(Decision {
                id: DecisionId::new(),
                proposal: p.id.clone(),
                kind: DecisionKind::Undertake {
                    assessment: a.id.clone(),
                },
                dependencies: vec![],
            }),
            Error::Unavailable,
        );
        f.ports.materials.insert(material, bytes);
        // The second decision must not activate privately planned state if acceptance fails.
        if !owner_first {
            f.undertake(&p, &a, vec![]);
        }
        assert_eq!(f.status().current_agreement, None);
        let kind = if owner_first {
            f.agent();
            DecisionKind::Undertake {
                assessment: a.id.clone(),
            }
        } else {
            f.owner();
            DecisionKind::Adopt
        };
        let operation = Operation {
            fresh: vec![],
            id: OperationId::new(),
            command: Command::Decide(Decision {
                id: DecisionId::new(),
                proposal: p.id.clone(),
                kind,
                dependencies: vec![],
            }),
        };
        f.ports.refuse_acceptance = true;
        refuse_operation(&mut f, operation.clone(), Error::Unavailable);
        f.ports.refuse_acceptance = false;
        let accepted = f
            .pursuit
            .submit(f.submission(operation.clone()), &mut f.ports)
            .unwrap();
        assert!(
            matches!(&accepted.effect, Effect::Decision { activated: Some(id), .. } if id == &p.agreement)
        );
        assert_eq!(
            f.pursuit.submit(f.submission(operation), &mut f.ports),
            Ok(accepted)
        );
        assert_eq!(f.status().current_agreement, Some(p.agreement));
        assert_eq!(f.status().settlement, None);
    }
}

#[test]
fn progress_can_omit_criteria_without_changing_agreement_or_fulfilling() {
    for criterion_free in [false, true] {
        let mut f = Fixture::new();
        f.initiate();
        let mut p = f.proposal(None, vec![]);
        if criterion_free {
            p.terms.criteria.clear();
        }
        add_term(&mut f, &mut p);
        let a = f.retain_proposal(&p);
        f.adopt(&p, vec![]);
        f.undertake(&p, &a, vec![]);
        let mut progress = progress(&mut f, &p);
        progress.terms = BTreeSet::from([p.terms.binding[1].statement.clone()]);
        let before = f.status();
        let accepted = f
            .execute(Command::Progress {
                progress: progress.clone(),
                access: Access::Owner,
            })
            .unwrap();
        assert_eq!(accepted.effect, Effect::Recorded);
        let record = f
            .pursuit
            .record(&accepted.operation, &mut f.ports)
            .unwrap()
            .unwrap();
        assert_eq!(
            record.operation.command,
            Command::Progress {
                progress: progress.clone(),
                access: Access::Owner
            }
        );
        let after = f.status();
        assert_eq!(after.current_agreement, before.current_agreement);
        assert_eq!(after.settlement, None);
        assert_eq!(after.accepted_operations, before.accepted_operations + 1);
        if !criterion_free {
            // Criteria remain optional current IDs, not a new criterion-to-progress-term evaluator.
            progress.criteria.insert(p.terms.criteria[0].id.clone());
            f.execute(Command::Progress {
                progress,
                access: Access::Owner,
            })
            .unwrap();
            assert_eq!(f.status().settlement, None);
        } else {
            progress.criteria.insert(CriterionId::new());
            refuse(
                &mut f,
                Command::Progress {
                    progress,
                    access: Access::Owner,
                },
                Error::Invalid,
            );
        }
    }
}

fn add_term(f: &mut Fixture, p: &mut Proposal) {
    let material = f.text("preserve a separate explicit constraint");
    p.terms.binding.push(TermSelection {
        statement: MaterialReference {
            identity: f.identity.clone(),
            operation: f.proposal_operations[&p.id].clone(),
            material,
        },
        context: BTreeSet::new(),
    });
}

fn agree_without_criteria(f: &mut Fixture) -> Proposal {
    f.initiate();
    let mut p = f.proposal(None, vec![]);
    p.terms.criteria.clear();
    let a = f.retain_proposal(&p);
    f.adopt(&p, vec![]);
    f.undertake(&p, &a, vec![]);
    f.owner();
    p
}

#[test]
fn progress_rejects_absent_context_foreign_spliced_alias_and_unselected_terms() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let pending = f.proposal(Some(p.agreement.clone()), vec![]);
    f.retain_proposal(&pending);
    let mut foreign = Fixture::new();
    let (foreign_proposal, _) = foreign.agree();
    let selected = p.terms.binding[0].statement.clone();
    let alias = f
        .execute(Command::Finding {
            finding: Finding {
                agreement: Some(p.agreement.clone()),
                claim: selected.material.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Owner,
        })
        .unwrap();
    let mut invalid = vec![
        p.terms.context.first().unwrap().clone(),
        p.terms.criteria[0].definition.clone(),
        pending.terms.binding[0].statement.clone(),
        foreign_proposal.terms.binding[0].statement.clone(),
    ];
    // Even an accepted binding of the identical material is not the selected exact reference.
    for operation in [
        alias.operation,
        OperationId::new(),
        f.proposal_operations[&pending.id].clone(),
    ] {
        invalid.push(MaterialReference {
            operation,
            ..selected.clone()
        });
    }
    let equal_bytes = f.ports.materials[&selected.material].clone();
    invalid.push(MaterialReference {
        material: f.text(std::str::from_utf8(&equal_bytes).unwrap()),
        ..selected.clone()
    });
    for part in 0..5 {
        let mut reference = selected.clone();
        match part {
            0 => reference.identity.owner = OwnerId::new(),
            1 => reference.identity.ledger = LedgerId::new(),
            2 => reference.identity.change = ChangeId::new(),
            3 => reference.identity.agent = ActorId::new(),
            _ => reference.identity.owner_actor = ActorId::new(),
        }
        invalid.push(reference);
    }
    let mut valid = progress(&mut f, &p);
    // A current criterion must not mask invalid terms (including an empty term set).
    valid.criteria.insert(p.terms.criteria[0].id.clone());
    let mut absent = valid.clone();
    absent.terms.clear();
    refuse(
        &mut f,
        Command::Progress {
            progress: absent,
            access: Access::Owner,
        },
        Error::Invalid,
    );
    for term in invalid {
        let mut bad = valid.clone();
        bad.terms.insert(term);
        refuse(
            &mut f,
            Command::Progress {
                progress: bad,
                access: Access::Owner,
            },
            Error::Invalid,
        );
    }
    for criterion in [CriterionId::new(), pending.terms.criteria[0].id.clone()] {
        let mut bad = valid.clone();
        bad.criteria.insert(criterion);
        refuse(
            &mut f,
            Command::Progress {
                progress: bad,
                access: Access::Owner,
            },
            Error::Invalid,
        );
    }
    f.execute(Command::Progress {
        progress: valid,
        access: Access::Owner,
    })
    .unwrap();
}

#[test]
fn progress_subset_requires_evidence_both_dimensions_and_all_retained_agreement_materials() {
    let mut f = Fixture::new();
    f.initiate();
    let mut p = f.proposal(None, vec![]);
    add_term(&mut f, &mut p);
    let a = f.retain_proposal(&p);
    f.adopt(&p, vec![]);
    f.undertake(&p, &a, vec![]);
    f.owner();
    let valid = progress(&mut f, &p);
    let mut no_evidence = valid.clone();
    no_evidence.evidence.clear();
    refuse(
        &mut f,
        Command::Progress {
            progress: no_evidence,
            access: Access::Owner,
        },
        Error::Invalid,
    );
    let command = Command::Progress {
        progress: valid.clone(),
        access: Access::Owner,
    };
    // Narrow progress is not permission to drop other binding terms, context or assessment grounds.
    let required = vec![
        p.terms.binding[0].statement.material.clone(),
        p.terms.binding[1].statement.material.clone(),
        p.terms.context.first().unwrap().material.clone(),
        p.terms.criteria[0].definition.material.clone(),
        p.terms.unknowns[0].question.clone(),
        p.terms.unknowns[0].bounded_by.clone(),
        a.feasibility,
        a.capabilities,
        a.resources,
        a.commitments,
        a.coverage,
        a.limitations,
        valid.understanding.assessment.clone(),
        valid.outcome.assessment.clone(),
        valid.evidence[0].material.clone(),
        valid.evidence[0].limitations.clone(),
    ];
    for material in &required {
        let bytes = f.ports.materials.remove(material).unwrap();
        refuse(&mut f, command.clone(), Error::Unavailable);
        f.ports.materials.insert(material.clone(), bytes);
    }
    let unselected = p.terms.binding[1].statement.material.clone();
    let bytes = f
        .ports
        .materials
        .insert(
            unselected.clone(),
            b"changed outside the progress subset".to_vec(),
        )
        .unwrap();
    refuse(&mut f, command.clone(), Error::Conflict);
    f.ports.materials.insert(unselected, bytes);
    let accepted = f.execute(command).unwrap();
    let record = f
        .pursuit
        .record(&accepted.operation, &mut f.ports)
        .unwrap()
        .unwrap();
    for material in required {
        assert_eq!(
            record.checks.materials[&material],
            f.ports.materials[&material]
        );
    }
}

#[test]
fn progress_requires_owner_control_or_one_complete_current_pursuit_grant() {
    let mut f = Fixture::new();
    let p = agree_without_criteria(&mut f);
    let valid = progress(&mut f, &p);
    let command = |access| Command::Progress {
        progress: valid.clone(),
        access,
    };
    f.agent();
    refuse(&mut f, command(Access::Owner), Error::Denied);
    f.owner();
    f.ports.context.authority.owner_control = None;
    refuse(&mut f, command(Access::Owner), Error::Denied);
    f.owner();
    f.ports.context.authority.actor = ActorId::new();
    refuse(&mut f, command(Access::Owner), Error::Denied);
    f.owner();
    f.ports.context.authority.represented_owner = OwnerId::new();
    refuse(&mut f, command(Access::Owner), Error::Denied);
    f.owner();
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Progress]));
    spec.target = GrantTarget::Pursuit(p.agreement.clone());
    let mut incomplete = spec.clone();
    incomplete
        .materials
        .remove(&p.terms.binding[0].statement.material);
    let first = f.grant(incomplete);
    let mut complement = spec.clone();
    complement.materials = BTreeSet::from([p.terms.binding[0].statement.material.clone()]);
    let second = f.grant(complement);
    let mut wrong_action = spec.clone();
    wrong_action.actions = BTreeSet::from([GrantAction::Finding]);
    let wrong_action = f.grant(wrong_action);
    let draft_spec = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    let draft = f.grant(draft_spec);
    f.agent();
    for grant in [first, second, wrong_action, draft] {
        refuse(&mut f, command(Access::Grant(grant)), Error::Denied);
    }
    let grant = f.grant(spec);
    // Possessing the grant is not the named recipient's authority.
    refuse(&mut f, command(Access::Grant(grant.clone())), Error::Denied);
    f.agent();
    f.execute(command(Access::Grant(grant.clone()))).unwrap();
    f.owner();
    f.execute(Command::RevokeGrant {
        id: grant.id.clone(),
        expected_generation: grant.generation,
    })
    .unwrap();
    f.agent();
    refuse(&mut f, command(Access::Grant(grant)), Error::Denied);
    assert_eq!(f.status().settlement, None);
}

#[test]
fn progress_rejects_stale_agreements_and_previous_or_pending_revision_selections() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let old = progress(&mut f, &p);
    let next = f.proposal(Some(p.agreement.clone()), vec![]);
    let assessment = f.retain_proposal(&next);
    let current = progress(&mut f, &next);
    f.adopt(&next, vec![]);
    let mut pending_terms = old.clone();
    pending_terms.terms = current.terms.clone();
    refuse(
        &mut f,
        Command::Progress {
            progress: pending_terms,
            access: Access::Owner,
        },
        Error::Invalid,
    );
    refuse(
        &mut f,
        Command::Progress {
            progress: current.clone(),
            access: Access::Owner,
        },
        Error::Invalid,
    );
    f.execute(Command::Progress {
        progress: old.clone(),
        access: Access::Owner,
    })
    .unwrap();
    assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
    f.undertake(&next, &assessment, vec![]);
    f.owner();
    refuse(
        &mut f,
        Command::Progress {
            progress: old.clone(),
            access: Access::Owner,
        },
        Error::Stale,
    );
    let mut old_terms = current.clone();
    old_terms.terms = old.terms;
    refuse(
        &mut f,
        Command::Progress {
            progress: old_terms,
            access: Access::Owner,
        },
        Error::Invalid,
    );
    let mut old_criteria = current.clone();
    old_criteria.criteria.insert(p.terms.criteria[0].id.clone());
    refuse(
        &mut f,
        Command::Progress {
            progress: old_criteria,
            access: Access::Owner,
        },
        Error::Invalid,
    );
    let mut current = current;
    current.criteria.insert(next.terms.criteria[0].id.clone());
    f.execute(Command::Progress {
        progress: current,
        access: Access::Owner,
    })
    .unwrap();
    assert_eq!(f.status().current_agreement, Some(next.agreement));
    assert_eq!(f.status().settlement, None);
}

#[test]
fn criterion_free_decisions_and_progress_preserve_authority_and_changed_ground_guards() {
    let mut f = Fixture::new();
    f.initiate();
    let ground = f.dependency();
    let mut p = f.proposal(None, vec![]);
    p.terms.criteria.clear();
    let mut assessment = f.retain_proposal(&p);
    let owner = Decision {
        id: DecisionId::new(),
        proposal: p.id.clone(),
        kind: DecisionKind::Adopt,
        dependencies: vec![ground.clone()],
    };
    let agent = Decision {
        id: DecisionId::new(),
        proposal: p.id.clone(),
        kind: DecisionKind::Undertake {
            assessment: assessment.id.clone(),
        },
        dependencies: vec![],
    };
    f.agent();
    refuse(&mut f, Command::Decide(owner.clone()), Error::Denied);
    f.owner();
    refuse(&mut f, Command::Decide(agent.clone()), Error::Denied);
    f.execute(Command::Decide(owner.clone())).unwrap();
    let current = Dependency {
        ground: ground.ground,
        version: GroundVersion::new(),
    };
    f.ports
        .grounds
        .insert(current.ground.clone(), current.version.clone());
    // Even criterion-free undertaking retains current assessment dependencies.
    assessment.id = AssessmentId::new();
    assessment.dependencies = vec![current.clone()];
    f.execute(Command::Assess {
        assessment: assessment.clone(),
        access: Access::Owner,
    })
    .unwrap();
    let stale = Dependency {
        ground: current.ground.clone(),
        version: GroundVersion::new(),
    };
    f.agent();
    refuse(
        &mut f,
        Command::Decide(Decision {
            dependencies: vec![stale],
            ..agent.clone()
        }),
        Error::Stale,
    );
    f.undertake(&p, &assessment, vec![]);
    assert_eq!(f.status().current_agreement, None);
    f.agent();
    refuse(
        &mut f,
        Command::Reaffirm {
            decision: owner.id.clone(),
            dependencies: vec![current.clone()],
            assessment: None,
        },
        Error::Denied,
    );
    f.owner();
    f.execute(Command::Reaffirm {
        decision: owner.id.clone(),
        dependencies: vec![current.clone()],
        assessment: None,
    })
    .unwrap();
    assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
    let progress = progress(&mut f, &p);
    let changed = GroundVersion::new();
    f.ports.grounds.insert(current.ground.clone(), changed);
    refuse(
        &mut f,
        Command::Progress {
            progress: progress.clone(),
            access: Access::Owner,
        },
        Error::Stale,
    );
    let fulfillment = f.fulfillment(&p);
    refuse(&mut f, Command::Fulfill(fulfillment), Error::Stale);
    f.ports.grounds.insert(current.ground, current.version);
    f.execute(Command::Progress {
        progress,
        access: Access::Owner,
    })
    .unwrap();
}

#[test]
fn criterion_free_fulfillment_is_nonvacuous_and_withdrawal_remains_available() {
    let mut f = Fixture::new();
    let p = agree_without_criteria(&mut f);
    let fulfillment = f.fulfillment(&p);
    assert!(fulfillment.criteria.is_empty());
    f.agent();
    refuse(&mut f, Command::Fulfill(fulfillment.clone()), Error::Denied);
    f.owner();
    let operation = Operation {
        fresh: vec![],
        id: OperationId::new(),
        command: Command::Fulfill(fulfillment.clone()),
    };
    refuse_operation(&mut f, operation.clone(), Error::Invalid);
    refuse_operation(&mut f, operation, Error::Invalid);
    let mut invented = fulfillment;
    invented.criteria.push(CriterionEvidence {
        criterion: CriterionId::new(),
        evidence: f.ports.native_evidence.clone(),
    });
    refuse(&mut f, Command::Fulfill(invented), Error::Invalid);
    let (_, action) = f.action(&p);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    f.execute(Command::Dispatch {
        action: action.id.clone(),
    })
    .unwrap();
    f.owner();
    let reason = f.text("stop without evidence of fulfillment; dispatched work remains unresolved");
    f.execute(Command::Withdraw { reason }).unwrap();
    assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
    let Read::Action(original) = f
        .pursuit
        .read(Query::Action(action.id), Access::Owner, &mut f.ports)
        .unwrap()
    else {
        panic!("action")
    };
    assert_eq!(original.phase, ActionPhase::Dispatched);
}

#[test]
fn criterion_free_agreement_can_add_criteria_only_by_matching_revision_then_fulfill_with_evidence()
{
    let mut f = Fixture::new();
    let p = agree_without_criteria(&mut f);
    let mut revision = f.proposal(Some(p.agreement.clone()), vec![]);
    revision.terms.binding = p.terms.binding.clone();
    revision.terms.context = p.terms.context.clone();
    revision.terms.criteria[0].terms = BTreeSet::from([p.terms.binding[0].statement.clone()]);
    let assessment = f.retain_proposal(&revision);
    f.adopt(&revision, vec![]);
    let empty = f.fulfillment(&p);
    refuse(&mut f, Command::Fulfill(empty.clone()), Error::Invalid);
    assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
    f.undertake(&revision, &assessment, vec![]);
    f.owner();
    refuse(&mut f, Command::Fulfill(empty), Error::Stale);
    // The earlier material reference is valid because this revision explicitly selects it.
    let progress = progress(&mut f, &revision);
    f.execute(Command::Progress {
        progress,
        access: Access::Owner,
    })
    .unwrap();
    let fulfillment = f.fulfillment(&revision);
    for kind in 0..4 {
        let mut bad = fulfillment.clone();
        match kind {
            0 => bad.criteria.clear(),
            1 => bad.criteria[0].evidence.clear(),
            2 => bad.criteria.push(bad.criteria[0].clone()),
            _ => bad.criteria[0].criterion = CriterionId::new(),
        }
        refuse(&mut f, Command::Fulfill(bad), Error::Invalid);
    }
    let operation = Operation {
        fresh: vec![],
        id: OperationId::new(),
        command: Command::Fulfill(fulfillment),
    };
    f.ports.refuse_acceptance = true;
    refuse_operation(&mut f, operation.clone(), Error::Unavailable);
    f.ports.refuse_acceptance = false;
    let accepted = f
        .pursuit
        .submit(f.submission(operation.clone()), &mut f.ports)
        .unwrap();
    let before = f.status();
    assert_eq!(
        before.settlement,
        Some(Settlement::Fulfilled(revision.agreement))
    );
    assert_eq!(
        f.pursuit.submit(f.submission(operation), &mut f.ports),
        Ok(accepted)
    );
    assert_eq!(f.status(), before);
}

#[test]
fn failed_progress_acceptance_publishes_nothing_and_retry_binds_exact_terms() {
    for cut in 0..6 {
        let mut f = Fixture::new();
        f.initiate();
        let dependency = f.dependency();
        let mut p = f.proposal(None, vec![dependency.clone()]);
        add_term(&mut f, &mut p);
        let a = f.retain_proposal(&p);
        f.adopt(&p, vec![]);
        f.undertake(&p, &a, vec![]);
        let progress = progress(&mut f, &p);
        let before = f.status();
        let context = f.ports.context.clone();
        let materials = f.ports.materials.clone();
        let prefix = f.ports.last_operation.clone();
        let history = f.ports.accepted.clone();
        let operation = Operation {
            fresh: vec![],
            id: OperationId::new(),
            command: Command::Progress {
                progress: progress.clone(),
                access: Access::Owner,
            },
        };
        let error = match cut {
            0 => {
                f.ports.refuse_acceptance = true;
                Error::Unavailable
            }
            1 => {
                f.ports.race = Some(Race::Material(
                    p.terms.binding[1].statement.material.clone(),
                ));
                Error::Conflict
            }
            2 => {
                f.ports.race = Some(Race::Context);
                Error::Stale
            }
            3 => {
                f.ports.race = Some(Race::Ground(dependency.ground.clone()));
                Error::Stale
            }
            4 => {
                f.ports.race = Some(Race::Disclosure);
                Error::Stale
            }
            _ => {
                f.ports.race = Some(Race::Prefix);
                Error::Stale
            }
        };
        assert_eq!(
            f.pursuit
                .submit(f.submission(operation.clone()), &mut f.ports),
            Err(error)
        );
        assert_eq!(f.ports.accepted, history);
        // Restore only the injected port race so state can be inspected and the same ID retried.
        f.ports.refuse_acceptance = false;
        f.ports.context = context;
        f.ports.materials = materials;
        f.ports.last_operation = prefix;
        f.ports
            .grounds
            .insert(dependency.ground, dependency.version);
        assert_eq!(f.status(), before);
        assert_eq!(f.pursuit.record(&operation.id, &mut f.ports), Ok(None));
        let accepted = f
            .pursuit
            .submit(f.submission(operation.clone()), &mut f.ports)
            .unwrap();
        assert_eq!(
            f.status().accepted_operations,
            before.accepted_operations + 1
        );
        assert_eq!(
            f.pursuit
                .submit(f.submission(operation.clone()), &mut f.ports),
            Ok(accepted.clone())
        );
        let mut changed = operation.clone();
        let Command::Progress { progress, .. } = &mut changed.command else {
            unreachable!()
        };
        progress.terms = BTreeSet::from([p.terms.binding[1].statement.clone()]);
        assert_eq!(
            f.pursuit.submit(f.submission(changed), &mut f.ports),
            Err(Error::Conflict)
        );
        let context = f.ports.context.clone();
        f.ports.context.disclosure.clear();
        assert_eq!(
            f.pursuit
                .submit(f.submission(operation.clone()), &mut f.ports),
            Err(Error::Denied)
        );
        f.ports.context = context;
        let record = f
            .pursuit
            .record(&operation.id, &mut f.ports)
            .unwrap()
            .unwrap();
        assert_eq!(record.operation, operation);
        assert_eq!(
            f.pursuit.submit(f.submission(operation), &mut f.ports),
            Ok(accepted)
        );
        assert_eq!(
            f.status().accepted_operations,
            before.accepted_operations + 1
        );
        assert_eq!(f.status().settlement, None);
    }
}
