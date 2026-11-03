use super::fixture::{self, Fixture, TestId};
use changekernel::adapters::codec;
use changekernel::unqualified_change::{
    Access, ActionId, ActionOutcome, Adaptation, Attribution, Change, ChangeBasis, Command,
    ContentLimits, Disposition, Error, Finding, FreshContent, GrantAction, GrantTarget,
    HistoryHead, OperationId, OriginSelector, Progress, ProgressDimension, ProgressValue, Query,
    Read, ReadScope, Resolution, ScopeId, ScopeJudgment, Settlement, CURRENT_PROFILE,
};
use std::collections::BTreeSet;

fn restore(f: &mut Fixture) {
    let expected = f.status();
    let originals = f.ports.records.clone();
    let records = originals
        .iter()
        .map(|record| {
            let raw = codec::encode_record(record).unwrap();
            let decoded = codec::decode_record(&raw).unwrap();
            assert_eq!(&decoded, record);
            assert_eq!(
                codec::decode_request(
                    &codec::encode_request(&record.operation_request().unwrap()).unwrap()
                ),
                Ok(record.operation_request().unwrap())
            );
            decoded
        })
        .collect::<Vec<_>>();
    f.pursuit = Change::reconstruct(
        HistoryHead {
            profile: CURRENT_PROFILE,
            identity: f.identity.clone(),
            accepted_operations: records.len() as u64,
            last_operation: f.ports.last_operation.clone(),
        },
        records,
    )
    .unwrap();
    assert_eq!(f.status(), expected);
    for original in originals {
        assert_eq!(
            f.pursuit.record(&original.operation.id, &mut f.ports),
            Ok(Some(original))
        );
    }
}

#[test]
fn adaptive_agreement_actions_revisions_and_fulfillment_restore_their_actual_meaning() {
    let mut f = Fixture::new();
    f.initiate();
    let dependency = f.dependency();
    let p = f.proposal(None, vec![dependency]);
    f.retain_proposal(&p);
    let mut assessment = f.assessment(&p, p.dependencies.clone());
    let blocker = f.text("endorsed blocker must survive revision");
    assessment.blockers.push(blocker.clone());
    f.execute(Command::Assess {
        assessment: assessment.clone(),
        access: Access::Owner,
    })
    .unwrap();
    f.adopt(&p, vec![]);
    f.undertake(&p, &assessment, vec![]);
    f.owner();
    for disposition in [
        Disposition::Supports,
        Disposition::Challenges,
        Disposition::Unknown,
    ] {
        let claim = f.text("an attributed finding");
        f.execute(Command::Finding {
            finding: Finding {
                agreement: Some(p.agreement.clone()),
                claim,
                evidence: f.ports.native_evidence.clone(),
                disposition,
            },
            access: Access::Owner,
        })
        .unwrap();
    }
    let (_, action) = f.action(&p);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    f.execute(Command::Dispatch {
        action: action.id.clone(),
    })
    .unwrap();
    f.owner();
    let adaptation = Adaptation {
        agreement: p.agreement.clone(),
        previous_approach: p.terms.context.first().unwrap().content.clone(),
        changed_approach: f.text("a different provisional approach"),
        grounds: f.ports.native_evidence.clone(),
        discretion: ScopeId::new(),
    };
    f.execute(Command::Adapt {
        adaptation,
        access: Access::Owner,
    })
    .unwrap();
    for value in [
        ProgressValue::Advanced,
        ProgressValue::Unchanged,
        ProgressValue::Regressed,
        ProgressValue::Unknown,
    ] {
        let progress = Progress {
            agreement: p.agreement.clone(),
            terms: BTreeSet::from([p.terms.binding[0].statement.clone()]),
            criteria: p.terms.criteria.iter().map(|c| c.id.clone()).collect(),
            evidence: f.ports.native_evidence.clone(),
            understanding: ProgressDimension {
                value,
                assessment: f.text("understanding assessment"),
            },
            outcome: ProgressDimension {
                value,
                assessment: f.text("outcome assessment"),
            },
            basis: ChangeBasis::CorrectedUnderstanding,
        };
        f.execute(Command::Progress {
            progress,
            access: Access::Owner,
        })
        .unwrap();
    }
    let revision = f.proposal(Some(p.agreement.clone()), vec![]);
    let next = f.retain_proposal(&revision);
    let unmatched = f.adopt(&revision, vec![]);
    f.execute(Command::Retract {
        decision: unmatched.id,
    })
    .unwrap();
    let adoption = f.adopt(&revision, vec![]);
    let undertaking = f.undertake(&revision, &next, vec![]);
    f.owner();
    f.execute(Command::Reaffirm {
        decision: adoption.id,
        dependencies: vec![],
        assessment: None,
    })
    .unwrap();
    f.agent();
    f.execute(Command::Reaffirm {
        decision: undertaking.id,
        dependencies: vec![],
        assessment: Some(next.id),
    })
    .unwrap();
    f.owner();
    for basis in [ChangeBasis::Observation, ChangeBasis::RevisedTargets] {
        let progress = Progress {
            agreement: revision.agreement.clone(),
            terms: BTreeSet::from([revision.terms.binding[0].statement.clone()]),
            criteria: BTreeSet::new(),
            evidence: f.ports.native_evidence.clone(),
            understanding: ProgressDimension {
                value: ProgressValue::Advanced,
                assessment: f.text("improved understanding"),
            },
            outcome: ProgressDimension {
                value: ProgressValue::Unknown,
                assessment: f.text("no claimed improvement"),
            },
            basis,
        };
        f.execute(Command::Progress {
            progress,
            access: Access::Owner,
        })
        .unwrap();
    }
    restore(&mut f);
    assert_eq!(
        f.execute(Command::Fulfill(f.fulfillment(&revision))),
        Err(Error::Conflict)
    );
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Reconcile]));
    spec.target = GrantTarget::Reconciliation(BTreeSet::from([action.id.clone()]));
    let grant = f.grant(spec);
    f.agent();
    for outcome in [
        ActionOutcome::Unknown,
        ActionOutcome::ReportedPartial,
        ActionOutcome::ReportedNotApplied,
        ActionOutcome::ReportedApplied,
    ] {
        f.execute(Command::Reconcile {
            action: action.id.clone(),
            grant: grant.clone(),
            evidence: f.ports.native_evidence.clone(),
            outcome,
        })
        .unwrap();
    }
    f.owner();
    let mut acceptance = f.fulfillment(&revision);
    acceptance.resolutions.push(Resolution {
        blocker,
        evidence: f.ports.native_evidence.clone(),
    });
    f.execute(Command::Fulfill(acceptance)).unwrap();
    restore(&mut f);
    assert_eq!(
        f.status().settlement,
        Some(Settlement::Fulfilled(revision.agreement))
    );
    let Read::Action(restored) = f
        .pursuit
        .read(
            Query::Action(action.id.clone()),
            Access::Owner,
            &mut f.ports,
        )
        .unwrap()
    else {
        panic!("action")
    };
    assert_eq!(restored.request, action);
    assert_eq!(restored.outcome, ActionOutcome::ReportedApplied);
}

fn payload(f: &Fixture, text: &[u8]) -> FreshContent {
    let mut p = f.fresh(text);
    p.attributed_source = f.identity.owner_actor.clone();
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&p.key)
        .unwrap()
        .source_claim
        .attribution = Attribution::Actor(f.identity.owner_actor.clone());
    p
}
#[test]
fn fresh_draft_and_historical_origin_replacement_revocation_restore_without_recharge() {
    let mut f = Fixture::new();
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::CreateDraft]));
    spec.target = GrantTarget::DraftCreation(f.identity.change.clone());
    spec.creation = Some(ContentLimits {
        items: 64,
        payload_bytes: 8 * 1024 * 1024,
    });
    spec.content_origins.insert(OriginSelector::CurrentGrant);
    spec.disclosure_origins.insert(OriginSelector::CurrentGrant);
    let grant = f.grant(spec);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.owner_actor.clone(),
    ));
    let fresh = payload(&f, b"fresh draft wish");
    f.agent();
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::Initiate {
            wish: fresh.key.clone(),
            access: Access::Grant(grant),
        },
        vec![fresh.clone()],
        &f,
    );
    let accepted = f
        .pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    let origin = f.ports.created[&fresh.key].origin.clone();
    let mut proposal = f.proposal(None, vec![]);
    proposal.terms.criteria.clear();
    let assessment = f.assessment(&proposal, vec![]);
    let mut spec = f.draft_spec(BTreeSet::from([
        GrantAction::Finding,
        GrantAction::Propose,
        GrantAction::Assess,
    ]));
    spec.content_items.remove(&fresh.key);
    spec.content_origins
        .insert(OriginSelector::Historical(Box::new(origin.clone())));
    spec.disclosure_origins
        .insert(OriginSelector::Historical(Box::new(origin)));
    spec.creation = Some(ContentLimits {
        items: 64,
        payload_bytes: 8 * 1024 * 1024,
    });
    spec.content_origins.insert(OriginSelector::CurrentGrant);
    spec.disclosure_origins.insert(OriginSelector::CurrentGrant);
    let grant = f.grant(spec.clone());
    f.agent();
    f.execute(Command::Propose {
        proposal: proposal.clone(),
        access: Access::Grant(grant.clone()),
    })
    .unwrap();
    f.execute(Command::Assess {
        assessment,
        access: Access::Grant(grant.clone()),
    })
    .unwrap();
    let finding = payload(
        &f,
        b"new observed question, attributed not independent proof",
    );
    let new = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: finding.key.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Grant(grant.clone()),
        },
        vec![finding],
        &f,
    );
    f.pursuit
        .execute(f.operation_request(new), &mut f.ports)
        .unwrap();
    f.owner();
    f.execute(Command::SetGrant {
        id: grant.id.clone(),
        expected_generation: Some(1),
        spec,
    })
    .unwrap();
    f.execute(Command::RevokeGrant {
        id: grant.id,
        expected_generation: 2,
    })
    .unwrap();
    restore(&mut f);
    f.agent();
    let count = f.ports.records.len();
    assert_eq!(
        f.pursuit.execute(
            codec::decode_request(
                &codec::encode_request(&f.operation_request(operation.clone())).unwrap()
            )
            .unwrap(),
            &mut f.ports
        ),
        Ok(accepted)
    );
    assert_eq!(f.ports.records.len(), count);
    f.owner();
    let reason = f.text("withdraw incomplete draft, not fulfillment");
    f.execute(Command::Withdraw { reason }).unwrap();
    restore(&mut f);
    assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
}

#[test]
fn unavailable_and_revision_judgments_survive_codec_but_never_become_permission() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    f.owner();
    let adaptation = Adaptation {
        agreement: p.agreement,
        previous_approach: p.terms.context.first().unwrap().content.clone(),
        changed_approach: f.text("another method"),
        grounds: f.ports.native_evidence.clone(),
        discretion: ScopeId::new(),
    };
    f.execute(Command::Adapt {
        adaptation,
        access: Access::Owner,
    })
    .unwrap();
    for judgment in [ScopeJudgment::RequiresRevision, ScopeJudgment::Unavailable] {
        let mut records = f.ports.records.clone();
        let r = records.last_mut().unwrap();
        r.checks.adaptation.as_mut().unwrap().1 = judgment;
        let decoded = codec::decode_record(&codec::encode_record(r).unwrap()).unwrap();
        assert_eq!(&decoded, r);
        *r = decoded;
        let head = HistoryHead {
            profile: CURRENT_PROFILE,
            identity: f.identity.clone(),
            accepted_operations: records.len() as u64,
            last_operation: f.ports.last_operation.clone(),
        };
        assert!(Change::reconstruct(head, records).is_err());
    }
}

#[test]
fn scoped_context_and_origin_metadata_survive_without_authorizing_forged_history() {
    let mut f = Fixture::new();
    f.initiate();
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    spec.creation = Some(ContentLimits {
        items: 1,
        payload_bytes: 100,
    });
    let grant = f.grant(spec);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.owner_actor.clone(),
    ));
    let fresh = payload(&f, b"scoped source");
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: fresh.key.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Supports,
            },
            access: Access::Grant(grant),
        },
        vec![fresh.clone()],
        &f,
    );
    f.agent();
    f.pursuit
        .execute(f.operation_request(operation), &mut f.ports)
        .unwrap();
    let origin = f.ports.created[&fresh.key].origin.scope();
    f.owner();
    let claim = f.text("a scoped context remains attributable");
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim,
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Owner,
        },
        vec![],
        &f,
    );
    f.ports.context.disclosure.extend([
        ReadScope::Operation(operation.id.clone()),
        ReadScope::Content(fresh.key.clone()),
        ReadScope::Action(ActionId::new()),
        ReadScope::Origin(origin.clone()),
    ]);
    f.pursuit
        .execute(f.operation_request(operation), &mut f.ports)
        .unwrap();
    restore(&mut f);
    // An operation's original checks cannot be silently turned into a read-origin authority.
    let mut records = f.ports.records.clone();
    let last = records.last_mut().unwrap();
    last.checks.disclosure_origin = Some(origin);
    *last = codec::decode_record(&codec::encode_record(last).unwrap()).unwrap();
    let head = HistoryHead {
        profile: CURRENT_PROFILE,
        identity: f.identity.clone(),
        accepted_operations: records.len() as u64,
        last_operation: f.ports.last_operation.clone(),
    };
    assert!(Change::reconstruct(head, records).is_err());
}
