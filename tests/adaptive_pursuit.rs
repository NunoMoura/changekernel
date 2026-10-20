use changekernel::unqualified_pursuit::*;
use std::collections::BTreeSet;
#[path = "adaptive_pursuit/fixture.rs"]
mod fixture;
use fixture::*;

#[test]
fn exact_agreement_activates_in_either_order_and_never_from_proposal_alone() {
    for owner_first in [true, false] {
        let mut f = Fixture::new();
        f.initiate();
        let p = f.proposal(None, vec![]);
        let a = f.retain_proposal(&p);
        assert_eq!(f.status().current_agreement, None);
        if owner_first {
            f.adopt(&p, vec![]);
        } else {
            f.undertake(&p, &a, vec![]);
        }
        assert_eq!(f.status().current_agreement, None);
        if owner_first {
            f.undertake(&p, &a, vec![]);
        } else {
            f.adopt(&p, vec![]);
        }
        assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
        let count = f.status().accepted_operations;
        let mut changed = p.clone();
        changed.terms.what = f.text("new terms under old identity");
        assert_eq!(
            f.execute(Command::Propose {
                proposal: changed,
                access: Access::Owner
            }),
            Err(Error::Stale)
        );
        assert_eq!(f.status().accepted_operations, count);
    }
}

#[test]
fn unmatched_decisions_retract_by_their_own_party_and_revision_does_not_suspend_terms() {
    let mut f = Fixture::new();
    let (first, _) = f.agree();
    let revision = f.proposal(Some(first.agreement.clone()), vec![]);
    let assessment = f.retain_proposal(&revision);
    let adoption = f.adopt(&revision, vec![]);
    assert_eq!(f.status().current_agreement, Some(first.agreement.clone()));
    f.agent();
    assert_eq!(
        f.execute(Command::Retract {
            decision: adoption.id.clone()
        }),
        Err(Error::Denied)
    );
    f.owner();
    f.execute(Command::Retract {
        decision: adoption.id,
    })
    .unwrap();
    f.undertake(&revision, &assessment, vec![]);
    assert_eq!(f.status().current_agreement, Some(first.agreement.clone()));
    f.adopt(&revision, vec![]);
    assert_eq!(
        f.status().current_agreement,
        Some(revision.agreement.clone())
    );
    let other = f.proposal(Some(first.agreement), vec![]);
    assert_eq!(
        f.execute(Command::Propose {
            proposal: other,
            access: Access::Owner
        }),
        Err(Error::Stale)
    );
}

#[test]
fn proposal_ground_change_requires_each_dependent_party_to_reaffirm_without_revising_terms() {
    let mut f = Fixture::new();
    f.initiate();
    let old = f.dependency();
    let p = f.proposal(None, vec![old.clone()]);
    let a = f.retain_proposal(&p);
    let owner = f.adopt(&p, vec![]);
    let agent = f.undertake(&p, &a, vec![]);
    let (_, action) = f.action(&p);
    let new = Dependency {
        ground: old.ground.clone(),
        version: GroundVersion::new(),
    };
    f.ports
        .grounds
        .insert(new.ground.clone(), new.version.clone());
    f.agent();
    assert_eq!(f.execute(Command::Admit(action.clone())), Err(Error::Stale));
    assert_eq!(
        f.execute(Command::Reaffirm {
            decision: owner.id.clone(),
            dependencies: vec![new.clone()],
            assessment: None
        }),
        Err(Error::Denied)
    );
    f.owner();
    f.execute(Command::Reaffirm {
        decision: owner.id,
        dependencies: vec![new.clone()],
        assessment: None,
    })
    .unwrap();
    f.agent();
    assert_eq!(f.execute(Command::Admit(action.clone())), Err(Error::Stale));
    f.owner();
    let current_assessment = f.assessment(&p, vec![new.clone()]);
    f.execute(Command::Assess {
        assessment: current_assessment.clone(),
        access: Access::Owner,
    })
    .unwrap();
    f.agent();
    f.execute(Command::Reaffirm {
        decision: agent.id,
        dependencies: vec![new],
        assessment: Some(current_assessment.id),
    })
    .unwrap();
    f.execute(Command::Admit(action)).unwrap();
    assert_eq!(f.status().current_agreement, Some(p.agreement));
}

#[test]
fn unrelated_ground_changes_do_not_stale_agreement_and_one_sided_dependency_only_needs_its_party() {
    let mut f = Fixture::new();
    f.initiate();
    let ground = f.dependency();
    let unrelated = f.dependency();
    let p = f.proposal(None, vec![]);
    let a = f.retain_proposal(&p);
    let owner = f.adopt(&p, vec![ground.clone()]);
    f.undertake(&p, &a, vec![]);
    let (_, action) = f.action(&p);
    f.ports
        .grounds
        .insert(unrelated.ground, GroundVersion::new());
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    let mut next_action = action;
    next_action.id = ActionId::new();
    let current = Dependency {
        ground: ground.ground,
        version: GroundVersion::new(),
    };
    f.ports
        .grounds
        .insert(current.ground.clone(), current.version.clone());
    assert_eq!(
        f.execute(Command::Admit(next_action.clone())),
        Err(Error::Stale)
    );
    f.owner();
    f.execute(Command::Reaffirm {
        decision: owner.id,
        dependencies: vec![current],
        assessment: None,
    })
    .unwrap();
    f.agent();
    f.execute(Command::Admit(next_action)).unwrap();
}

#[test]
fn named_grants_require_cas_one_complete_scope_and_never_revive_old_queued_generations() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let (spec, action) = f.action(&p);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    let mut union = action.clone();
    union.id = ActionId::new();
    union.scope.insert(ScopeId::new());
    let mut second = spec.clone();
    second.native_scope = union
        .scope
        .difference(&spec.native_scope)
        .cloned()
        .collect();
    f.grant(second);
    f.agent();
    assert_eq!(f.execute(Command::Admit(union)), Err(Error::Denied));
    f.owner();
    assert_eq!(
        f.execute(Command::SetGrant {
            id: action.grant.id.clone(),
            expected_generation: Some(2),
            spec: spec.clone()
        }),
        Err(Error::Conflict)
    );
    let Effect::Grant(replaced) = f
        .execute(Command::SetGrant {
            id: action.grant.id.clone(),
            expected_generation: Some(1),
            spec: spec.clone(),
        })
        .unwrap()
        .effect
    else {
        panic!("replacement")
    };
    assert_eq!(replaced.generation, 2);
    f.agent();
    assert_eq!(
        f.execute(Command::Dispatch {
            action: action.id.clone()
        }),
        Err(Error::Denied)
    );
    f.owner();
    f.execute(Command::RevokeGrant {
        id: replaced.id.clone(),
        expected_generation: 2,
    })
    .unwrap();
    assert_eq!(
        f.execute(Command::SetGrant {
            id: replaced.id,
            expected_generation: Some(3),
            spec: spec.clone()
        }),
        Err(Error::Conflict)
    );
    let _new = f.grant(spec);
    f.agent();
    assert_eq!(
        f.execute(Command::Dispatch { action: action.id }),
        Err(Error::Denied)
    );
}

#[test]
fn draft_creation_and_disclosure_only_grants_do_not_grant_recording_or_dispatch() {
    let mut f = Fixture::new();
    let wish = f.text("draft wish");
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::CreateDraft]));
    spec.target = GrantTarget::DraftCreation(f.identity.change.clone());
    let creation = f.grant(spec);
    f.agent();
    f.execute(Command::Initiate {
        wish: wish.clone(),
        access: Access::Grant(creation),
    })
    .unwrap();
    let p = f.proposal(None, vec![]);
    let mut read_only = f.draft_spec(BTreeSet::new());
    read_only.disclosure.insert(wish.clone());
    let read_grant = f.grant(read_only);
    f.agent();
    assert_eq!(
        f.pursuit.read(
            Query::Material(wish.clone()),
            Access::Grant(read_grant.clone()),
            &mut f.ports
        ),
        Ok(Read::Material(b"draft wish".to_vec()))
    );
    let count = f.ports.accepted.len();
    assert_eq!(
        f.execute(Command::Propose {
            proposal: p.clone(),
            access: Access::Grant(read_grant.clone())
        }),
        Err(Error::Denied)
    );
    assert_eq!(
        f.execute(Command::Decide(Decision {
            id: DecisionId::new(),
            proposal: p.id,
            kind: DecisionKind::Adopt,
            dependencies: vec![]
        })),
        Err(Error::Invalid)
    );
    assert_eq!(f.ports.accepted.len(), count);
    f.ports.context.disclosure.clear();
    assert_eq!(
        f.pursuit.read(
            Query::Material(wish),
            Access::Grant(read_grant),
            &mut f.ports
        ),
        Err(Error::Denied)
    );
}

#[test]
fn original_result_retry_retains_original_authority_and_requires_current_disclosure_and_exact_contents(
) {
    let mut f = Fixture::new();
    let wish = f.text("draft");
    let operation = Operation {
        id: OperationId::new(),
        command: Command::Initiate {
            wish: wish.clone(),
            access: Access::Owner,
        },
    };
    let original_context = f.ports.context.clone();
    let accepted = f.pursuit.execute(operation.clone(), &mut f.ports).unwrap();
    let count = f.ports.accepted.len();
    f.owner();
    let stored = f
        .pursuit
        .record(&operation.id, &mut f.ports)
        .unwrap()
        .unwrap();
    assert_eq!(stored.checks.context, original_context);
    assert_eq!(
        f.pursuit.execute(operation.clone(), &mut f.ports),
        Ok(accepted.clone())
    );
    assert_eq!(f.ports.accepted.len(), count);
    f.ports.context.disclosure.clear();
    assert_eq!(
        f.pursuit.execute(operation.clone(), &mut f.ports),
        Err(Error::Denied)
    );
    f.ports
        .context
        .disclosure
        .insert(ReadScope::Change(f.identity.change.clone()));
    f.ports
        .materials
        .insert(wish.clone(), b"rebound under the same identity".to_vec());
    assert_eq!(
        f.pursuit.execute(operation.clone(), &mut f.ports),
        Err(Error::Conflict)
    );
    f.ports.materials.insert(wish, b"draft".to_vec());
    let mut conflict = operation.clone();
    conflict.command = Command::Withdraw {
        reason: f.text("changed exact input"),
    };
    assert_eq!(
        f.pursuit.execute(conflict, &mut f.ports),
        Err(Error::Conflict)
    );
    f.agent();
    assert_eq!(
        f.pursuit.execute(operation, &mut f.ports),
        Err(Error::Conflict)
    );
}

#[test]
fn guarded_acceptance_rejects_toctou_and_failure_without_partial_state_or_reserved_retry_ids() {
    for race in 0..3 {
        let mut f = Fixture::new();
        let wish = f.text("original");
        let operation = Operation {
            id: OperationId::new(),
            command: Command::Initiate {
                wish: wish.clone(),
                access: Access::Owner,
            },
        };
        f.ports.race = Some(if race == 0 {
            Race::Material(wish.clone())
        } else {
            Race::Context
        });
        if race == 2 {
            f.ports.race = None;
            f.ports.refuse_acceptance = true;
        }
        assert!(f.pursuit.execute(operation.clone(), &mut f.ports).is_err());
        assert_eq!(f.ports.accepted.len(), 0);
        assert!(!f.status().initiated);
        f.ports.materials.insert(wish, b"original".to_vec());
        f.ports.refuse_acceptance = false;
        f.pursuit.execute(operation, &mut f.ports).unwrap();
        assert!(f.status().initiated);
    }
    let mut f = Fixture::new();
    f.initiate();
    let dep = f.dependency();
    let p = f.proposal(None, vec![dep.clone()]);
    let before = f.status().accepted_operations;
    f.ports.race = Some(Race::Ground(dep.ground));
    assert_eq!(
        f.execute(Command::Propose {
            proposal: p,
            access: Access::Owner
        }),
        Err(Error::Stale)
    );
    assert_eq!(f.status().accepted_operations, before);
}

#[test]
fn learning_adaptation_and_both_progress_dimensions_are_claims_not_revision_or_fulfillment() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let finding = Finding {
        agreement: Some(p.agreement.clone()),
        claim: f.text("earlier prototype challenged layout hypothesis"),
        evidence: f.ports.native_evidence.clone(),
        disposition: Disposition::Challenges,
    };
    f.owner();
    f.execute(Command::Finding {
        finding,
        access: Access::Owner,
    })
    .unwrap();
    let adaptation = Adaptation {
        agreement: p.agreement.clone(),
        previous_approach: p.terms.how.clone(),
        changed_approach: f.text("use another local layout method"),
        grounds: f.ports.native_evidence.clone(),
        discretion: ScopeId::new(),
    };
    f.ports.scope_judgment = ScopeJudgment::RequiresRevision;
    let before = f.status().accepted_operations;
    assert_eq!(
        f.execute(Command::Adapt {
            adaptation: adaptation.clone(),
            access: Access::Owner
        }),
        Err(Error::NeedsRevision)
    );
    assert_eq!(f.status().accepted_operations, before);
    f.ports.scope_judgment = ScopeJudgment::WithinDiscretion(f.ports.native_evidence[0].clone());
    f.execute(Command::Adapt {
        adaptation,
        access: Access::Owner,
    })
    .unwrap();
    let progress = Progress {
        agreement: p.agreement.clone(),
        criteria: p.terms.criteria.iter().map(|c| c.id.clone()).collect(),
        evidence: f.ports.native_evidence.clone(),
        understanding: ProgressDimension {
            value: ProgressValue::Advanced,
            assessment: f.text("understanding advanced from feedback"),
        },
        outcome: ProgressDimension {
            value: ProgressValue::Unknown,
            assessment: f.text("no observed outcome improvement yet"),
        },
        basis: ChangeBasis::CorrectedUnderstanding,
    };
    f.execute(Command::Progress {
        progress,
        access: Access::Owner,
    })
    .unwrap();
    let status = f.status();
    assert_eq!(status.current_agreement, Some(p.agreement));
    assert_eq!(status.settlement, None);
}

#[test]
fn revision_invalidates_queued_actions_but_does_not_hide_earlier_dispatched_accountability() {
    let mut f = Fixture::new();
    let (first, _) = f.agree();
    let (_, action) = f.action(&first);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    f.execute(Command::Dispatch {
        action: action.id.clone(),
    })
    .unwrap();
    let mut queued = action.clone();
    queued.id = ActionId::new();
    f.execute(Command::Admit(queued.clone())).unwrap();
    let revision = f.proposal(Some(first.agreement), vec![]);
    let assessment = f.retain_proposal(&revision);
    f.adopt(&revision, vec![]);
    f.undertake(&revision, &assessment, vec![]);
    assert_eq!(
        f.execute(Command::Dispatch { action: queued.id }),
        Err(Error::Stale)
    );
    f.owner();
    assert_eq!(
        f.execute(Command::Fulfill(f.fulfillment(&revision))),
        Err(Error::Conflict)
    );
    let reason = f.text("withdraw despite unresolved save");
    f.execute(Command::Withdraw { reason }).unwrap();
    let mut reconcile = f.draft_spec(BTreeSet::from([GrantAction::Reconcile]));
    reconcile.target = GrantTarget::Reconciliation(BTreeSet::from([action.id.clone()]));
    let grant = f.grant(reconcile);
    f.agent();
    let Read::Action(original) = f
        .pursuit
        .read(
            Query::Action(action.id.clone()),
            Access::Grant(grant.clone()),
            &mut f.ports,
        )
        .unwrap()
    else {
        panic!("action")
    };
    assert_eq!(original.request, action);
    f.execute(Command::Reconcile {
        action: action.id.clone(),
        grant: grant.clone(),
        evidence: f.ports.native_evidence.clone(),
        outcome: ActionOutcome::Unknown,
    })
    .unwrap();
    f.execute(Command::Reconcile {
        action: action.id.clone(),
        grant,
        evidence: f.ports.native_evidence.clone(),
        outcome: ActionOutcome::ReportedApplied,
    })
    .unwrap();
    assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
    f.agent();
    assert_eq!(
        f.execute(Command::Dispatch { action: action.id }),
        Err(Error::Terminal)
    );
    f.owner();
    assert_eq!(
        f.execute(Command::Fulfill(f.fulfillment(&revision))),
        Err(Error::Terminal)
    );
}

#[test]
fn fulfillment_needs_owner_complete_criteria_evidence_and_blocker_resolution_then_is_terminal() {
    let mut f = Fixture::new();
    f.initiate();
    let p = f.proposal(None, vec![]);
    f.owner();
    f.execute(Command::Propose {
        proposal: p.clone(),
        access: Access::Owner,
    })
    .unwrap();
    let mut a = f.assessment(&p, vec![]);
    let blocker = f.text("known relevant payment blocker");
    a.blockers.push(blocker.clone());
    f.execute(Command::Assess {
        assessment: a.clone(),
        access: Access::Owner,
    })
    .unwrap();
    f.adopt(&p, vec![]);
    f.undertake(&p, &a, vec![]);
    let mut fulfillment = f.fulfillment(&p);
    assert_eq!(
        f.execute(Command::Fulfill(fulfillment.clone())),
        Err(Error::Denied)
    );
    f.owner();
    assert_eq!(
        f.execute(Command::Fulfill(fulfillment.clone())),
        Err(Error::Conflict)
    );
    fulfillment.resolutions.push(Resolution {
        blocker,
        evidence: f.ports.native_evidence.clone(),
    });
    let mut incomplete = fulfillment.clone();
    incomplete.criteria.clear();
    assert_eq!(f.execute(Command::Fulfill(incomplete)), Err(Error::Invalid));
    f.execute(Command::Fulfill(fulfillment)).unwrap();
    assert_eq!(
        f.status().settlement,
        Some(Settlement::Fulfilled(p.agreement.clone()))
    );
    let reason = f.text("cannot reopen by withdrawing");
    assert_eq!(
        f.execute(Command::Withdraw { reason }),
        Err(Error::Terminal)
    );
    let late = f.proposal(Some(p.agreement), vec![]);
    assert_eq!(
        f.execute(Command::Propose {
            proposal: late,
            access: Access::Owner
        }),
        Err(Error::Terminal)
    );
}

#[test]
fn stale_unmatched_decision_cannot_activate_until_its_party_reaffirms() {
    let mut f = Fixture::new();
    f.initiate();
    let dep = f.dependency();
    let p = f.proposal(None, vec![]);
    let a = f.retain_proposal(&p);
    let owner = f.adopt(&p, vec![dep.clone()]);
    let current = Dependency {
        ground: dep.ground,
        version: GroundVersion::new(),
    };
    f.ports
        .grounds
        .insert(current.ground.clone(), current.version.clone());
    f.undertake(&p, &a, vec![]);
    assert_eq!(f.status().current_agreement, None);
    f.execute(Command::Reaffirm {
        decision: owner.id,
        dependencies: vec![current],
        assessment: None,
    })
    .unwrap();
    assert_eq!(f.status().current_agreement, Some(p.agreement));
}

#[test]
fn same_kind_subject_identity_cannot_be_rebound_and_missing_material_does_not_create_terms() {
    let mut f = Fixture::new();
    f.initiate();
    let p = f.proposal(None, vec![]);
    f.execute(Command::Propose {
        proposal: p.clone(),
        access: Access::Owner,
    })
    .unwrap();
    let mut rebound = p.clone();
    rebound.terms.how = f.text("replacement contents under old proposal ID");
    let before = f.status().accepted_operations;
    assert_eq!(
        f.execute(Command::Propose {
            proposal: rebound,
            access: Access::Owner
        }),
        Err(Error::Conflict)
    );
    let assessment = f.assessment(&p, vec![]);
    f.execute(Command::Assess {
        assessment: assessment.clone(),
        access: Access::Owner,
    })
    .unwrap();
    let mut changed = assessment;
    changed.coverage = f.text("silently claim exhaustive coverage");
    assert_eq!(
        f.execute(Command::Assess {
            assessment: changed,
            access: Access::Owner
        }),
        Err(Error::Conflict)
    );
    let missing = f.proposal(None, vec![]);
    f.ports.materials.remove(&missing.terms.why);
    assert_eq!(
        f.execute(Command::Propose {
            proposal: missing,
            access: Access::Owner
        }),
        Err(Error::Unavailable)
    );
    assert_eq!(f.status().accepted_operations, before + 1);
}

#[test]
fn accepted_grant_operation_retry_recovers_after_revocation_without_dispatch_or_authority_reconstruction(
) {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let (spec, action) = f.action(&p);
    f.agent();
    let original_context = f.ports.context.clone();
    let op = Operation {
        id: OperationId::new(),
        command: Command::Admit(action.clone()),
    };
    let accepted = f.pursuit.execute(op.clone(), &mut f.ports).unwrap();
    f.owner();
    f.execute(Command::RevokeGrant {
        id: action.grant.id.clone(),
        expected_generation: 1,
    })
    .unwrap();
    let record = f.pursuit.record(&op.id, &mut f.ports).unwrap().unwrap();
    assert_eq!(record.checks.context, original_context);
    assert_eq!(record.used_grant, Some(action.grant));
    assert_eq!(record.grant_snapshot.unwrap().spec, spec);
    let count = f.ports.accepted.len();
    f.agent();
    assert_eq!(f.pursuit.execute(op, &mut f.ports), Ok(accepted));
    assert_eq!(f.ports.accepted.len(), count);
    assert_eq!(
        f.execute(Command::Dispatch { action: action.id }),
        Err(Error::Denied)
    );
}

#[test]
fn a_second_state_instance_cannot_overwrite_scoped_accepted_state_at_the_boundary() {
    let mut f = Fixture::new();
    let mut stale = Pursuit::new(f.identity.clone()).unwrap();
    f.initiate();
    let before = f.ports.accepted.len();
    let wish = f.text("second competing draft");
    let operation = Operation {
        id: OperationId::new(),
        command: Command::Initiate {
            wish,
            access: Access::Owner,
        },
    };
    assert_eq!(stale.execute(operation, &mut f.ports), Err(Error::Stale));
    assert_eq!(f.ports.accepted.len(), before);
    assert_eq!(
        stale.read(Query::Status, Access::Owner, &mut f.ports),
        Err(Error::Stale)
    );
}

#[test]
fn queued_action_keeps_its_original_grounds_even_after_current_agreement_reaffirmation() {
    let mut f = Fixture::new();
    f.initiate();
    let dep = f.dependency();
    let p = f.proposal(None, vec![]);
    let a = f.retain_proposal(&p);
    let owner = f.adopt(&p, vec![dep.clone()]);
    f.undertake(&p, &a, vec![]);
    let (_, action) = f.action(&p);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    let current = Dependency {
        ground: dep.ground,
        version: GroundVersion::new(),
    };
    f.ports
        .grounds
        .insert(current.ground.clone(), current.version.clone());
    f.owner();
    f.execute(Command::Reaffirm {
        decision: owner.id,
        dependencies: vec![current],
        assessment: None,
    })
    .unwrap();
    f.agent();
    assert_eq!(
        f.execute(Command::Dispatch { action: action.id }),
        Err(Error::Stale)
    );
}

#[test]
fn reaffirmation_and_revision_cannot_resolve_endorsed_blockers_by_omission() {
    let mut f = Fixture::new();
    let (p, initial) = f.agree();
    f.agent();
    let old = f
        .ports
        .accepted
        .values()
        .find_map(|(op, _)| match &op.command {
            Command::Decide(d) if matches!(d.kind, DecisionKind::Undertake { .. }) => {
                Some(d.id.clone())
            }
            _ => None,
        })
        .unwrap();
    let blocker = f.text("endorsed unresolved blocker");
    let mut with_blocker = initial.clone();
    with_blocker.id = AssessmentId::new();
    with_blocker.blockers.push(blocker.clone());
    f.owner();
    f.execute(Command::Assess {
        assessment: with_blocker.clone(),
        access: Access::Owner,
    })
    .unwrap();
    f.agent();
    f.execute(Command::Reaffirm {
        decision: old.clone(),
        dependencies: vec![],
        assessment: Some(with_blocker.id),
    })
    .unwrap();
    let mut omitted = initial;
    omitted.id = AssessmentId::new();
    f.owner();
    f.execute(Command::Assess {
        assessment: omitted.clone(),
        access: Access::Owner,
    })
    .unwrap();
    f.agent();
    f.execute(Command::Reaffirm {
        decision: old,
        dependencies: vec![],
        assessment: Some(omitted.id),
    })
    .unwrap();
    f.owner();
    assert_eq!(
        f.execute(Command::Fulfill(f.fulfillment(&p))),
        Err(Error::Conflict)
    );
    let next = f.proposal(Some(p.agreement), vec![]);
    let next_assessment = f.retain_proposal(&next);
    f.adopt(&next, vec![]);
    f.undertake(&next, &next_assessment, vec![]);
    f.owner();
    assert_eq!(
        f.execute(Command::Fulfill(f.fulfillment(&next))),
        Err(Error::Conflict)
    );
    let mut unendorsed = f.assessment(&next, vec![]);
    unendorsed
        .blockers
        .push(f.text("unendorsed assessment must not veto"));
    f.execute(Command::Assess {
        assessment: unendorsed,
        access: Access::Owner,
    })
    .unwrap();
    let mut acceptance = f.fulfillment(&next);
    acceptance.resolutions.push(Resolution {
        blocker,
        evidence: f.ports.native_evidence.clone(),
    });
    f.execute(Command::Fulfill(acceptance)).unwrap();
}
