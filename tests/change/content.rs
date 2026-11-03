//! Operation-local content with explicitly authorized fixture sources, never pre-ingestion.
use super::fixture::{self, Fixture, Race, TestId, TestSubmit};
use changekernel::unqualified_change::{
    Accepted, Access, ActionId, ActionOutcome, ActionPhase, ActionRequest, ActorId, Adaptation,
    AgreementId, Assessment, AssessmentId, Attribution, ChangeBasis, ChangeId, Command, ContentKey,
    ContentLimits, ContentOrigin, ContentReference, Disposition, Effect, Error, Evidence, Finding,
    FreshContent, GrantAction, GrantId, GrantSpec, GrantTarget, GrantUse, LedgerId, LimitId,
    NativeActionId, Operation, OperationId, OriginScope, OriginSelector, OwnerId, Progress,
    ProgressDimension, ProgressValue, Proposal, ProposalId, Query, Read, ReadScope, Result,
    ScopeId, ScopeJudgment, Settlement, TermSelection, Terms,
};
use std::collections::BTreeSet;

fn fresh(f: &Fixture, bytes: &[u8]) -> FreshContent {
    f.fresh(bytes)
}
fn permit(f: &mut Fixture) {
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.agent.clone(),
    ));
}
fn spec(f: &Fixture, items: u64, payload_bytes: u64) -> GrantSpec {
    let mut s = f.draft_spec(BTreeSet::from([GrantAction::Finding, GrantAction::Propose]));
    s.content_items.clear();
    s.creation = Some(ContentLimits {
        items,
        payload_bytes,
    });
    s.content_origins.insert(OriginSelector::CurrentGrant);
    s.disclosure_origins.insert(OriginSelector::CurrentGrant);
    s
}
fn finding(f: &Fixture, g: &GrantUse, payloads: Vec<FreshContent>) -> Operation {
    let id = payloads[0].key.clone();
    fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: id.clone(),
                evidence: vec![Evidence {
                    source: f.identity.agent.clone(),
                    content: id.clone(),
                    limitations: id,
                }],
                disposition: Disposition::Unknown,
            },
            access: Access::Grant(g.clone()),
        },
        payloads,
        f,
    )
}
fn run(f: &mut Fixture, op: &Operation) -> Result<Accepted> {
    f.pursuit
        .submit(f.operation_request(op.clone()), &mut f.ports)
}
fn reuse(op: &Operation) -> Operation {
    let mut op = op.clone();
    op.id = OperationId::new();
    op.fresh.clear();
    op
}
fn setup(items: u64, bytes: u64) -> (Fixture, GrantUse) {
    let mut f = Fixture::new();
    f.initiate();
    permit(&mut f);
    let g = f.grant(spec(&f, items, bytes));
    f.agent();
    (f, g)
}
fn origin(f: &mut Fixture, op: &Operation, id: &ContentKey) -> ContentOrigin {
    f.owner();
    f.pursuit
        .record(&op.id, &mut f.ports)
        .unwrap()
        .unwrap()
        .checks
        .creation
        .unwrap()
        .content_items[id]
        .origin
        .clone()
}
fn refuse(f: &mut Fixture, op: &Operation, error: Error) {
    let accepted = f.ports.accepted.clone();
    let created = f.ports.created.clone();
    assert_eq!(run(f, op), Err(error));
    assert_eq!(f.ports.accepted, accepted);
    assert_eq!(f.ports.created, created);
    for payload in &op.fresh {
        if !created.contains_key(&payload.key) {
            assert!(!f.ports.content_items.contains_key(&payload.key));
        }
    }
}

#[test]
fn one_initial_grant_records_reads_and_reuses_future_content_with_derived_origin() {
    let (mut f, g) = setup(1, 8);
    for bytes in [b"finding".as_slice(), b"later"] {
        let payload = fresh(&f, bytes);
        let op = finding(&f, &g, vec![payload.clone()]);
        // Only explicit metadata disclosure for this operation; no content capability yet.
        f.ports.context.disclosure = BTreeSet::from([ReadScope::Operation(op.id.clone())]);
        let accepted = run(&mut f, &op).unwrap();
        assert_eq!(f.ports.content_items[&payload.key], bytes);
        assert_eq!(
            f.pursuit.read(
                Query::Content(payload.key.clone()),
                Access::Grant(g.clone()),
                &mut f.ports
            ),
            Err(Error::Denied)
        );
        let o = origin(&mut f, &op, &payload.key);
        assert_eq!(o.binding.identity, f.identity);
        assert_eq!(o.binding.operation, op.id);
        assert_eq!(o.binding.content, payload.key);
        assert_eq!(o.recorder, f.identity.agent);
        assert_eq!(o.represented_owner, f.identity.owner);
        assert_eq!(o.grant, g);
        assert_eq!(o.target, GrantTarget::Draft(f.identity.change.clone()));
        f.agent();
        f.ports.context.disclosure = BTreeSet::from([ReadScope::Origin(o.scope())]);
        assert_eq!(
            f.pursuit.read(
                Query::Content(payload.key.clone()),
                Access::Grant(g.clone()),
                &mut f.ports
            ),
            Ok(Read::Content(bytes.to_vec()))
        );
        for query in [Query::Status, Query::Operation(op.id.clone())] {
            assert_eq!(
                f.pursuit
                    .read(query, Access::Grant(g.clone()), &mut f.ports),
                Err(Error::Denied)
            );
        }
        let again = reuse(&op);
        f.ports
            .context
            .disclosure
            .insert(ReadScope::Operation(again.id.clone()));
        run(&mut f, &again).unwrap();
        f.ports
            .context
            .disclosure
            .insert(ReadScope::Operation(op.id.clone()));
        assert_eq!(run(&mut f, &op), Ok(accepted));
        assert_eq!(f.ports.created[&payload.key].payload, payload);
    }
}

#[test]
fn fresh_draft_creation_and_proposal_own_membership_are_atomic() {
    let mut f = Fixture::new();
    permit(&mut f);
    let mut s = spec(&f, 1, 32);
    s.target = GrantTarget::DraftCreation(f.identity.change.clone());
    s.actions = BTreeSet::from([GrantAction::CreateDraft]);
    let g = f.grant(s);
    let wish = fresh(&f, b"checkout feels wrong");
    let start = fixture::new_operation(
        OperationId::new(),
        Command::Initiate {
            wish: wish.key.clone(),
            access: Access::Grant(g),
        },
        vec![wish.clone()],
        &f,
    );
    f.agent();
    run(&mut f, &start).unwrap();
    let g = f.grant(spec(&f, 1, 32));
    let text = fresh(&f, b"show total first");
    let id = OperationId::new();
    let reference = ContentReference {
        identity: f.identity.clone(),
        operation: id.clone(),
        content: text.key.clone(),
    };
    let proposal = Proposal {
        id: ProposalId::new(),
        agreement: AgreementId::new(),
        identity: f.identity.clone(),
        expected_agreement: None,
        dependencies: vec![],
        terms: Terms {
            binding: vec![TermSelection {
                statement: reference,
                context: BTreeSet::new(),
            }],
            context: BTreeSet::new(),
            unknowns: vec![],
            criteria: vec![],
        },
    };
    let op = fixture::new_operation(
        id,
        Command::Propose {
            proposal: proposal.clone(),
            access: Access::Grant(g.clone()),
        },
        vec![text.clone()],
        &f,
    );
    f.agent();
    f.ports.refuse_acceptance = true;
    refuse(&mut f, &op, Error::Unavailable);
    f.ports.refuse_acceptance = false;
    run(&mut f, &op).unwrap();
    let mut linked = proposal;
    linked.id = ProposalId::new();
    linked.agreement = AgreementId::new();
    f.execute(Command::Propose {
        proposal: linked,
        access: Access::Grant(g),
    })
    .unwrap();
    assert_eq!(f.ports.created.len(), 2);
}

#[test]
fn creation_needs_one_complete_explicit_recording_grant_not_owner_or_finite_ids() {
    let (mut f, g) = setup(1, 16);
    let p = fresh(&f, b"new");
    let op = finding(&f, &g, vec![p]);
    let mut owner = op.clone();
    if let Command::Finding { access, .. } = &mut owner.command {
        *access = Access::Owner;
    }
    f.owner();
    refuse(&mut f, &owner, Error::Denied);
    let mut s = spec(&f, 1, 16);
    s.creation = None;
    let finite = f.grant(s);
    f.agent();
    let mut no_creation = op.clone();
    if let Command::Finding { access, .. } = &mut no_creation.command {
        *access = Access::Grant(finite);
    }
    refuse(&mut f, &no_creation, Error::Denied);
    let extra = f.text("private input");
    let mut partial = op.clone();
    if let Command::Finding { finding, .. } = &mut partial.command {
        finding.evidence[0].limitations = extra.clone();
    }
    let mut other = spec(&f, 1, 16);
    other.content_items.insert(extra);
    other.creation = None;
    f.grant(other);
    f.agent();
    refuse(&mut f, &partial, Error::Denied);
    let mut missing = partial.clone();
    if let Command::Finding { finding, .. } = &mut missing.command {
        let absent = f.key();
        finding.evidence[0].limitations = absent.clone();
        missing.first_retention.insert(absent);
    }
    refuse(&mut f, &missing, Error::Unavailable);
    run(&mut f, &op).unwrap();
}

#[test]
fn limits_count_identities_including_equal_and_empty_bytes_and_references_do_not_charge() {
    for (items, bytes, payloads, ok) in [
        (1, 6, vec![b"abc".as_slice(), b"abc"], false),
        (2, 5, vec![b"abc".as_slice(), b"abc"], false),
        (2, 6, vec![b"abc".as_slice(), b"abc"], true),
        (0, 0, vec![b"".as_slice()], false),
        (1, 0, vec![b"".as_slice()], true),
    ] {
        let (mut f, g) = setup(items, bytes);
        let ps: Vec<_> = payloads.into_iter().map(|b| fresh(&f, b)).collect();
        let mut op = finding(&f, &g, ps.clone());
        if ps.len() == 2 {
            if let Command::Finding { finding, .. } = &mut op.command {
                finding.evidence[0].limitations = ps[1].key.clone();
            }
        }
        if ok {
            run(&mut f, &op).unwrap();
            let count = f.ports.created.len();
            run(&mut f, &reuse(&op)).unwrap();
            run(&mut f, &op).unwrap();
            assert_eq!(f.ports.created.len(), count);
            f.owner();
            let c = f
                .pursuit
                .record(&op.id, &mut f.ports)
                .unwrap()
                .unwrap()
                .checks
                .creation
                .unwrap();
            assert_eq!(c.usage.items, ps.len() as u64);
            assert_eq!(
                c.usage.payload_bytes,
                ps.iter().map(|p| p.bytes.len() as u64).sum::<u64>()
            );
        } else {
            refuse(&mut f, &op, Error::Denied);
        }
    }
}

#[test]
fn extra_duplicate_existing_and_unsupported_payloads_publish_nothing() {
    let (mut f, g) = setup(3, 100);
    let p = fresh(&f, b"abc");
    let op = finding(&f, &g, vec![p.clone()]);
    let mut extra = op.clone();
    extra.fresh.push(fresh(&f, b"unused"));
    refuse(&mut f, &extra, Error::Invalid);
    let mut duplicate = op.clone();
    duplicate.fresh.push(p.clone());
    refuse(&mut f, &duplicate, Error::Conflict);
    let mut unsupported = op.clone();
    unsupported.command = Command::Withdraw {
        reason: p.key.clone(),
    };
    f.owner();
    refuse(&mut f, &unsupported, Error::Denied);
    f.agent();
    let existing = f.text("abc");
    let rebound = finding(
        &f,
        &g,
        vec![FreshContent {
            key: existing.clone(),
            ..p.clone()
        }],
    );
    let n = f.ports.accepted.len();
    assert_eq!(run(&mut f, &rebound), Err(Error::Conflict));
    assert_eq!(f.ports.accepted.len(), n);
    run(&mut f, &op).unwrap();
    let mut new_op = op.clone();
    new_op.id = OperationId::new();
    refuse(&mut f, &new_op, Error::Conflict);
}

#[test]
fn exact_historical_origins_survive_replacement_and_revocation_without_inheritance() {
    let (mut f, g) = setup(1, 32);
    let op = finding(&f, &g, vec![fresh(&f, b"first")]);
    run(&mut f, &op).unwrap();
    let id = op.fresh[0].key.clone();
    let o = origin(&mut f, &op, &id);
    let s = spec(&f, 1, 32);
    let Effect::Grant(replacement) = f
        .execute(Command::SetGrant {
            id: g.id.clone(),
            expected_generation: Some(1),
            spec: s.clone(),
        })
        .unwrap()
        .effect
    else {
        panic!()
    };
    let mut use_old = reuse(&op);
    if let Command::Finding { access, .. } = &mut use_old.command {
        *access = Access::Grant(replacement.clone());
    }
    f.agent();
    refuse(&mut f, &use_old, Error::Denied);
    assert_eq!(
        f.pursuit.read(
            Query::Content(id.clone()),
            Access::Grant(replacement.clone()),
            &mut f.ports
        ),
        Err(Error::Denied)
    );
    let second = finding(&f, &replacement, vec![fresh(&f, b"second")]);
    run(&mut f, &second).unwrap();
    let mut historical = s;
    historical.content_origins = BTreeSet::from([OriginSelector::Historical(Box::new(o.clone()))]);
    historical.disclosure_origins = historical.content_origins.clone();
    let independent = f.grant(historical);
    f.execute(Command::RevokeGrant {
        id: replacement.id,
        expected_generation: replacement.generation,
    })
    .unwrap();
    f.agent();
    if let Command::Finding { access, .. } = &mut use_old.command {
        *access = Access::Grant(independent.clone());
    }
    run(&mut f, &use_old).unwrap();
    assert_eq!(
        f.pursuit.read(
            Query::Content(id),
            Access::Grant(independent.clone()),
            &mut f.ports
        ),
        Ok(Read::Content(b"first".to_vec()))
    );
    let mut not_selected = reuse(&second);
    if let Command::Finding { access, .. } = &mut not_selected.command {
        *access = Access::Grant(independent);
    }
    refuse(&mut f, &not_selected, Error::Denied);
    assert_eq!(origin(&mut f, &op, &op.fresh[0].key), o);
}

#[test]
fn invented_historical_origins_and_foreign_context_scopes_are_not_authority() {
    let (mut f, g) = setup(1, 32);
    let op = finding(&f, &g, vec![fresh(&f, b"source")]);
    run(&mut f, &op).unwrap();
    let id = op.fresh[0].key.clone();
    let o = origin(&mut f, &op, &id);
    for i in 0..8 {
        let mut forged = o.clone();
        match i {
            0 => forged.binding.identity.owner = OwnerId::new(),
            1 => forged.binding.identity.ledger = LedgerId::new(),
            2 => forged.binding.identity.change = ChangeId::new(),
            3 => forged.grant.generation += 1,
            4 => forged.grant.id = GrantId::new(),
            5 => forged.target = GrantTarget::DraftCreation(f.identity.change.clone()),
            6 => forged.recorder = ActorId::new(),
            _ => forged.binding.operation = OperationId::new(),
        }
        let mut s = spec(&f, 1, 32);
        s.content_origins = BTreeSet::from([OriginSelector::Historical(Box::new(forged.clone()))]);
        f.owner();
        assert_eq!(
            f.execute(Command::SetGrant {
                id: GrantId::new(),
                expected_generation: None,
                spec: s
            }),
            Err(Error::Denied)
        );
        if i < 6 {
            f.agent();
            f.ports.context.disclosure = BTreeSet::from([ReadScope::Origin(forged.scope())]);
            assert_eq!(
                f.pursuit.read(
                    Query::Content(id.clone()),
                    Access::Grant(g.clone()),
                    &mut f.ports
                ),
                Err(Error::Denied)
            );
        }
        f.ports.context.disclosure = BTreeSet::from([ReadScope::Change(f.identity.change.clone())]);
    }
}

#[test]
fn source_conditions_and_current_actor_are_required_at_acceptance_and_recovery() {
    let (mut f, g) = setup(1, 32);
    let op = finding(&f, &g, vec![fresh(&f, b"claim")]);
    f.ports.creation_sources.clear();
    refuse(&mut f, &op, Error::Denied);
    permit(&mut f);
    let mut forged = op.clone();
    forged.fresh[0].attributed_source = f.identity.owner_actor.clone();
    refuse(&mut f, &forged, Error::Denied);
    f.ports.context.authority.represented_owner = OwnerId::new();
    refuse(&mut f, &op, Error::Denied);
    f.agent();
    f.ports.context.authority.actor = ActorId::new();
    refuse(&mut f, &op, Error::Denied);
    f.agent();
    let accepted = run(&mut f, &op).unwrap();
    f.ports.creation_sources.clear(); // retry requires source access, not a renewed creation permission.
    f.ports.denied_content_items.insert(op.fresh[0].key.clone());
    assert_eq!(run(&mut f, &op), Err(Error::Denied));
    f.ports.denied_content_items.clear();
    f.ports.context.disclosure.clear();
    assert_eq!(run(&mut f, &op), Err(Error::Denied));
    f.ports
        .context
        .disclosure
        .insert(ReadScope::Operation(op.id.clone()));
    assert_eq!(run(&mut f, &op), Ok(accepted.clone()));
    f.owner();
    assert_eq!(run(&mut f, &op), Err(Error::Conflict));
    f.ports
        .context
        .disclosure
        .insert(ReadScope::Change(f.identity.change.clone()));
    f.execute(Command::RevokeGrant {
        id: g.id,
        expected_generation: g.generation,
    })
    .unwrap();
    f.agent();
    assert_eq!(run(&mut f, &op), Ok(accepted));
    for mutation in 0..4 {
        let mut changed = op.clone();
        match mutation {
            0 => changed.fresh[0].bytes.push(0),
            1 => changed.fresh[0].attributed_source = ActorId::new(),
            2 => changed.fresh.clear(),
            _ => {
                if let Command::Finding { finding, .. } = &mut changed.command {
                    finding.evidence[0].limitations = f.key();
                }
            }
        }
        assert_eq!(run(&mut f, &changed), Err(Error::Conflict));
    }
}

#[test]
fn acceptance_races_publish_no_origins_bytes_or_reserved_operation_ids() {
    for i in 0..5 {
        let (mut f, g) = setup(1, 32);
        let op = finding(&f, &g, vec![fresh(&f, b"racing")]);
        let context = f.ports.context.clone();
        let prefix = f.ports.last_operation.clone();
        f.ports.race = Some(match i {
            0 => Race::Context,
            1 => Race::Disclosure,
            2 => Race::Prefix,
            3 => Race::CreationSource,
            _ => Race::CreationGrant,
        });
        let error = if i == 3 { Error::Denied } else { Error::Stale };
        refuse(&mut f, &op, error);
        f.ports.context = context;
        f.ports.last_operation = prefix;
        permit(&mut f);
        // Restore the explicitly modeled external cut, not an accepted revocation.
        if i == 4 {
            f.ports.grants.get_mut(&g.id).unwrap().generation = g.generation;
        }
        run(&mut f, &op).unwrap();
    }
}

#[test]
fn recording_and_disclosure_selectors_do_not_substitute_for_each_other() {
    let (mut f, g) = setup(1, 32);
    let op = finding(&f, &g, vec![fresh(&f, b"not shared")]);
    run(&mut f, &op).unwrap();
    let o = origin(&mut f, &op, &op.fresh[0].key);
    for read_only in [false, true] {
        let mut s = spec(&f, 1, 32);
        s.content_origins.clear();
        s.disclosure_origins.clear();
        if read_only {
            s.actions.clear();
            s.creation = None;
            s.disclosure_origins
                .insert(OriginSelector::Historical(Box::new(o.clone())));
        } else {
            s.content_origins
                .insert(OriginSelector::Historical(Box::new(o.clone())));
        }
        let grant = f.grant(s);
        f.agent();
        let read = f.pursuit.read(
            Query::Content(op.fresh[0].key.clone()),
            Access::Grant(grant.clone()),
            &mut f.ports,
        );
        assert_eq!(read.is_ok(), read_only);
        let mut again = reuse(&op);
        if let Command::Finding { access, .. } = &mut again.command {
            *access = Access::Grant(grant);
        }
        assert_eq!(run(&mut f, &again).is_ok(), !read_only);
    }
}

#[test]
fn revision_and_settlement_block_pursuit_but_explicit_original_action_grant_keeps_late_results() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    permit(&mut f);
    let (mut s, action) = f.action(&p);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    f.execute(Command::Dispatch {
        action: action.id.clone(),
    })
    .unwrap();
    s.creation = Some(ContentLimits {
        items: 1,
        payload_bytes: 32,
    });
    s.content_origins.insert(OriginSelector::CurrentGrant);
    s.disclosure_origins.insert(OriginSelector::CurrentGrant);
    let grant = f.grant(s.clone());
    f.agent();
    let mut op = finding(&f, &grant, vec![fresh(&f, b"late finding")]);
    if let Command::Finding { finding, .. } = &mut op.command {
        finding.agreement = Some(p.agreement.clone());
    }
    run(&mut f, &op).unwrap();
    let revision = f.proposal(Some(p.agreement.clone()), vec![]);
    let a = f.retain_proposal(&revision);
    f.adopt(&revision, vec![]);
    f.undertake(&revision, &a, vec![]);
    let mut stale = op.clone();
    stale.id = OperationId::new();
    stale.fresh = vec![fresh(&f, b"another")];
    if let Command::Finding { finding, .. } = &mut stale.command {
        finding.claim = stale.fresh[0].key.clone();
        finding.evidence[0].content = finding.claim.clone();
        finding.evidence[0].limitations = finding.claim.clone();
    }
    refuse(&mut f, &stale, Error::Stale);
    s.target = GrantTarget::Pursuit(revision.agreement.clone());
    s.content_items = f.ports.content_items.keys().cloned().collect();
    let revised = f.grant(s);
    f.agent();
    if let Command::Finding { finding, access } = &mut stale.command {
        finding.agreement = Some(revision.agreement.clone());
        *access = Access::Grant(revised.clone());
    }
    f.owner();
    let reason = f.text("stop; retain pending accountability");
    f.execute(Command::Withdraw { reason }).unwrap();
    f.agent();
    refuse(&mut f, &stale, Error::Terminal);
    let mut reconciliation = spec(&f, 1, 32);
    reconciliation.target = GrantTarget::Reconciliation(BTreeSet::from([action.id.clone()]));
    reconciliation.actions = BTreeSet::from([GrantAction::Reconcile]);
    let reconcile = f.grant(reconciliation);
    f.agent();
    let late = fresh(&f, b"late sourced outcome");
    let report = fixture::new_operation(
        OperationId::new(),
        Command::Reconcile {
            action: action.id.clone(),
            grant: reconcile.clone(),
            evidence: vec![Evidence {
                source: f.identity.agent.clone(),
                content: late.key.clone(),
                limitations: late.key.clone(),
            }],
            outcome: ActionOutcome::ReportedPartial,
        },
        vec![late.clone()],
        &f,
    );
    run(&mut f, &report).unwrap();
    let o = origin(&mut f, &report, &late.key);
    assert_eq!(
        o.target,
        GrantTarget::Reconciliation(BTreeSet::from([action.id.clone()]))
    );
    f.agent();
    let Read::Action(record) = f
        .pursuit
        .read(
            Query::Action(action.id.clone()),
            Access::Grant(reconcile.clone()),
            &mut f.ports,
        )
        .unwrap()
    else {
        panic!()
    };
    assert_eq!(record.request.agreement, p.agreement);
    assert_eq!(record.request.grant, action.grant);
    assert_eq!(record.phase, ActionPhase::Reconciled);
    assert_eq!(
        f.pursuit.read(
            Query::Content(late.key),
            Access::Grant(reconcile),
            &mut f.ports
        ),
        Ok(Read::Content(late.bytes))
    );
    assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
}

#[test]
fn draft_recording_cannot_dispatch_or_create_content_for_nonrecording_commands() {
    let (mut f, g) = setup(1, 32);
    let p = fresh(&f, b"not native authority");
    let op = fixture::new_operation(
        OperationId::new(),
        Command::Admit(ActionRequest {
            id: ActionId::new(),
            agreement: AgreementId::new(),
            grant: g,
            native_action: NativeActionId::new(),
            scope: BTreeSet::from([ScopeId::new()]),
            limits: BTreeSet::from([LimitId::new()]),
            dependencies: vec![],
            conditions: vec![p.key.clone()],
        }),
        vec![p.clone()],
        &f,
    );
    refuse(&mut f, &op, Error::Denied);
}

#[test]
fn origin_disclosure_can_be_authorized_before_ids_exist_without_exposing_private_content_or_metadata(
) {
    let (mut f, g) = setup(1, 32);
    let scope = OriginScope {
        identity: f.identity.clone(),
        grant: g.clone(),
        target: GrantTarget::Draft(f.identity.change.clone()),
    };
    for bytes in [b"first".as_slice(), b"future"] {
        let op = finding(&f, &g, vec![fresh(&f, bytes)]);
        f.ports.context.disclosure = BTreeSet::from([
            ReadScope::Origin(scope.clone()),
            ReadScope::Operation(op.id.clone()),
        ]);
        run(&mut f, &op).unwrap();
        assert_eq!(
            f.pursuit.read(
                Query::Content(op.fresh[0].key.clone()),
                Access::Grant(g.clone()),
                &mut f.ports
            ),
            Ok(Read::Content(bytes.to_vec()))
        );
    }
    f.ports.context.disclosure = BTreeSet::from([ReadScope::Change(f.identity.change.clone())]);
    f.owner();
    let secret = f.text("private retained source");
    let private = f
        .execute(Command::Finding {
            finding: Finding {
                agreement: None,
                claim: secret.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Owner,
        })
        .unwrap();
    f.agent();
    for query in [
        Query::Content(secret),
        Query::Status,
        Query::Operation(private.operation),
    ] {
        assert_eq!(
            f.pursuit
                .read(query, Access::Grant(g.clone()), &mut f.ports),
            Err(Error::Denied)
        );
    }
    let mut write_only = spec(&f, 1, 32);
    write_only.content_origins.clear();
    write_only.disclosure_origins.clear();
    let g = f.grant(write_only);
    f.agent();
    let op = finding(&f, &g, vec![fresh(&f, b"creation only")]);
    run(&mut f, &op).unwrap();
    assert_eq!(
        f.pursuit.read(
            Query::Content(op.fresh[0].key.clone()),
            Access::Grant(g),
            &mut f.ports
        ),
        Err(Error::Denied)
    );
    refuse(&mut f, &reuse(&op), Error::Denied);
}

#[test]
fn permitted_source_attribution_is_retained_but_never_supplies_recorder_or_owner_authority() {
    let (mut f, g) = setup(1, 32);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.owner_actor.clone(),
    ));
    let mut payload = fresh(&f, b"attributed owner words");
    payload.attributed_source = f.identity.owner_actor.clone();
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&payload.key)
        .unwrap()
        .source_claim
        .attribution = Attribution::Actor(f.identity.owner_actor.clone());
    let op = finding(&f, &g, vec![payload.clone()]);
    run(&mut f, &op).unwrap();
    let recorded = &f.ports.created[&payload.key];
    assert_eq!(recorded.payload.attributed_source, f.identity.owner_actor);
    assert_eq!(recorded.origin.recorder, f.identity.agent);
    assert_eq!(recorded.origin.represented_owner, f.identity.owner);
    let mut impersonation = reuse(&op);
    if let Command::Finding { access, .. } = &mut impersonation.command {
        *access = Access::Owner;
    }
    refuse(&mut f, &impersonation, Error::Denied);
    f.ports.context.authority.owner_control = Some(f.identity.clone());
    // A capability claim cannot overcome the actual actor check, even in this trusted fixture.
    refuse(&mut f, &impersonation, Error::Denied);
}

#[test]
fn fresh_progress_and_adaptation_require_all_existing_agreement_and_judgment_inputs() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    permit(&mut f);
    let mut s = spec(&f, 1, 32);
    s.target = GrantTarget::Pursuit(p.agreement.clone());
    s.actions = BTreeSet::from([GrantAction::Progress, GrantAction::Adapt]);
    s.content_items = f.ports.content_items.keys().cloned().collect();
    let g = f.grant(s.clone());
    f.agent();
    let payload = fresh(&f, b"learning, not fulfillment");
    let op = fixture::new_operation(
        OperationId::new(),
        Command::Progress {
            progress: Progress {
                agreement: p.agreement.clone(),
                terms: BTreeSet::from([p.terms.binding[0].statement.clone()]),
                criteria: BTreeSet::new(),
                evidence: f.ports.native_evidence.clone(),
                understanding: ProgressDimension {
                    value: ProgressValue::Advanced,
                    assessment: payload.key.clone(),
                },
                outcome: ProgressDimension {
                    value: ProgressValue::Unknown,
                    assessment: payload.key.clone(),
                },
                basis: ChangeBasis::CorrectedUnderstanding,
            },
            access: Access::Grant(g.clone()),
        },
        vec![payload.clone()],
        &f,
    );
    run(&mut f, &op).unwrap();
    let scope_content = f.text("new scoped judgment");
    f.ports.scope_judgment = ScopeJudgment::WithinDiscretion(Evidence {
        source: f.identity.agent.clone(),
        content: scope_content.clone(),
        limitations: f.ports.native_evidence[0].limitations.clone(),
    });
    let approach = fresh(&f, b"try a different layout");
    let mut adapt = fixture::new_operation(
        OperationId::new(),
        Command::Adapt {
            adaptation: Adaptation {
                agreement: p.agreement,
                previous_approach: payload.key,
                changed_approach: approach.key.clone(),
                grounds: f.ports.native_evidence.clone(),
                discretion: ScopeId::new(),
            },
            access: Access::Grant(g.clone()),
        },
        vec![approach.clone()],
        &f,
    );
    refuse(&mut f, &adapt, Error::Denied); // complete internal operation includes the port's judgment.
    s.content_items.insert(scope_content);
    f.owner();
    let Effect::Grant(g2) = f
        .execute(Command::SetGrant {
            id: g.id,
            expected_generation: Some(g.generation),
            spec: s.clone(),
        })
        .unwrap()
        .effect
    else {
        panic!()
    };
    adapt.first_retention.clear(); // SetGrant has now accepted this exact source.
    if let Command::Adapt { access, .. } = &mut adapt.command {
        *access = Access::Grant(g2.clone());
    }
    f.agent();
    refuse(&mut f, &adapt, Error::Denied); // previous approach originated in generation one.
    let old_origin = origin(&mut f, &op, &op.fresh[0].key);
    s.content_origins
        .insert(OriginSelector::Historical(Box::new(old_origin)));
    let Effect::Grant(g3) = f
        .execute(Command::SetGrant {
            id: g2.id,
            expected_generation: Some(g2.generation),
            spec: s,
        })
        .unwrap()
        .effect
    else {
        panic!()
    };
    if let Command::Adapt { access, .. } = &mut adapt.command {
        *access = Access::Grant(g3);
    }
    f.agent();
    run(&mut f, &adapt).unwrap();
    assert_eq!(f.status().settlement, None);
}

#[test]
fn fresh_inputs_remain_private_on_existing_binding_race_and_identity_collision_at_accept_cut() {
    for collision in [false, true] {
        let (mut f, g) = setup(1, 32);
        let mut s = spec(&f, 1, 32);
        let existing = f.text("original input");
        s.content_items.insert(existing.clone());
        f.owner();
        let Effect::Grant(g) = f
            .execute(Command::SetGrant {
                id: g.id,
                expected_generation: Some(g.generation),
                spec: s,
            })
            .unwrap()
            .effect
        else {
            panic!()
        };
        let mut op = finding(&f, &g, vec![fresh(&f, b"private staging")]);
        if let Command::Finding { finding, .. } = &mut op.command {
            finding.evidence[0].limitations = existing.clone();
        }
        f.agent();
        let id = if collision {
            op.fresh[0].key.clone()
        } else {
            existing.clone()
        };
        f.ports.race = Some(Race::Content(id.clone()));
        let accepted = f.ports.accepted.len();
        assert_eq!(run(&mut f, &op), Err(Error::Conflict));
        assert_eq!(f.ports.accepted.len(), accepted);
        assert!(f.ports.created.is_empty());
        f.owner();
        assert_eq!(
            f.pursuit.read(
                Query::Content(op.fresh[0].key.clone()),
                Access::Owner,
                &mut f.ports
            ),
            Err(Error::Invalid)
        );
        if collision {
            f.ports.content_items.remove(&id);
        } else {
            f.ports
                .content_items
                .insert(existing, b"original input".to_vec());
        }
        f.agent();
        run(&mut f, &op).unwrap();
    }
}

#[test]
fn owner_can_create_only_with_an_explicit_complete_grant_and_creation_source_permission() {
    let mut f = Fixture::new();
    f.initiate();
    let mut s = spec(&f, 1, 32);
    s.recipient = f.identity.owner_actor.clone();
    let g = f.grant(s);
    let mut p = fresh(&f, b"owner recording");
    p.attributed_source = f.identity.owner_actor.clone();
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&p.key)
        .unwrap()
        .source_claim
        .attribution = Attribution::Actor(f.identity.owner_actor.clone());
    let op = finding(&f, &g, vec![p]);
    refuse(&mut f, &op, Error::Denied);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.owner_actor.clone(),
        f.identity.owner_actor.clone(),
    ));
    run(&mut f, &op).unwrap();
    assert_eq!(
        f.ports.created[&op.fresh[0].key].origin.recorder,
        f.identity.owner_actor
    );
}

#[test]
fn fresh_assessment_uses_its_grants_complete_scope_and_is_retained_for_undertaking() {
    let mut f = Fixture::new();
    f.initiate();
    permit(&mut f);
    let p = f.proposal(None, vec![]);
    f.execute(Command::Propose {
        proposal: p.clone(),
        access: Access::Owner,
    })
    .unwrap();
    let payload = fresh(&f, b"bounded fixture assessment");
    let mut s = spec(&f, 1, 32);
    s.actions = BTreeSet::from([GrantAction::Assess]);
    // Fresh creation alone does not cover the already retained proposal.
    let partial = f.grant(s.clone());
    f.agent();
    let assessment = Assessment {
        id: AssessmentId::new(),
        proposal: p.id.clone(),
        feasibility: payload.key.clone(),
        capabilities: payload.key.clone(),
        resources: payload.key.clone(),
        commitments: payload.key.clone(),
        coverage: payload.key.clone(),
        limitations: payload.key.clone(),
        dependencies: vec![],
        blockers: vec![],
    };
    let mut op = fixture::new_operation(
        OperationId::new(),
        Command::Assess {
            assessment: assessment.clone(),
            access: Access::Grant(partial),
        },
        vec![payload],
        &f,
    );
    refuse(&mut f, &op, Error::Denied);
    s.content_items = f.ports.content_items.keys().cloned().collect();
    let complete = f.grant(s);
    f.agent();
    if let Command::Assess { access, .. } = &mut op.command {
        *access = Access::Grant(complete);
    }
    run(&mut f, &op).unwrap();
    f.undertake(&p, &assessment, vec![]);
    f.adopt(&p, vec![]);
    assert_eq!(f.status().current_agreement, Some(p.agreement));
}

#[test]
fn accepted_fresh_result_recovers_after_fulfillment_but_neither_new_recording_nor_native_creation_does(
) {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    permit(&mut f);
    let (mut s, action) = f.action(&p);
    s.creation = Some(ContentLimits {
        items: 1,
        payload_bytes: 32,
    });
    s.content_origins.insert(OriginSelector::CurrentGrant);
    let g = f.grant(s);
    f.agent();
    let payload = fresh(&f, b"native request is not recording");
    let mut native = action;
    native.grant = g.clone();
    native.conditions = vec![payload.key.clone()];
    let admit = fixture::new_operation(
        OperationId::new(),
        Command::Admit(native),
        vec![payload],
        &f,
    );
    refuse(&mut f, &admit, Error::Denied);
    let mut op = finding(&f, &g, vec![fresh(&f, b"retained learning")]);
    if let Command::Finding { finding, .. } = &mut op.command {
        finding.agreement = Some(p.agreement.clone());
    }
    let accepted = run(&mut f, &op).unwrap();
    f.owner();
    f.execute(Command::Fulfill(f.fulfillment(&p))).unwrap();
    f.agent();
    assert_eq!(run(&mut f, &op), Ok(accepted));
    refuse(&mut f, &reuse(&op), Error::Terminal);
    let mut fresh_op = finding(&f, &g, vec![fresh(&f, b"too late")]);
    if let Command::Finding { finding, .. } = &mut fresh_op.command {
        finding.agreement = Some(p.agreement);
    }
    refuse(&mut f, &fresh_op, Error::Terminal);
}
