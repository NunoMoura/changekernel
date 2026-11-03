//! Local intake proof boundaries. The catalog is supplied fixture trust, not native provenance.
use super::fixture::{self, Fixture, Race, TestId, TestSubmit};
use changekernel::unqualified_change::{
    Accepted, Access, ActorId, Attribution, BindingKnowledge, Change, ChangeId, Command, ContentId,
    ContentKey, ContentLimits, ContentObservation, ContentReference, Disposition, Error, Evidence,
    Finding, FreshContent, GrantAction, GrantId, GrantUse, HistoryHead, InputKind, IntakeCase,
    Operation, OperationId, OriginSelector, Result, CURRENT_PROFILE,
};
use std::collections::BTreeSet;
fn finding(key: &ContentKey, access: Access) -> Command {
    Command::Finding {
        finding: Finding {
            agreement: None,
            claim: key.clone(),
            evidence: vec![Evidence {
                source: ActorId::new(),
                content: key.clone(),
                limitations: key.clone(),
            }],
            disposition: Disposition::Unknown,
        },
        access,
    }
}
fn run(f: &mut Fixture, op: &Operation) -> Result<Accepted> {
    f.pursuit
        .submit(f.operation_request(op.clone()), &mut f.ports)
}
fn reopen(f: &mut Fixture) {
    f.pursuit = Change::reconstruct(
        HistoryHead {
            profile: CURRENT_PROFILE,
            identity: f.identity.clone(),
            accepted_operations: f.ports.records.len() as u64,
            last_operation: f.ports.last_operation.clone(),
        },
        f.ports.records.clone(),
    )
    .unwrap();
}
fn grant(f: &mut Fixture, content_items: BTreeSet<ContentKey>, creation: bool) -> GrantUse {
    let mut s = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    s.content_items = content_items;
    s.creation = creation.then_some(ContentLimits {
        items: 2,
        payload_bytes: 128,
    });
    s.content_origins.insert(OriginSelector::CurrentGrant);
    let g = f.grant(s);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.agent.clone(),
    ));
    f.agent();
    g
}
#[test]
fn first_retention_preserves_uncertainty_without_authorship_origin_or_retry_reestablishment() {
    let mut f = Fixture::new();
    f.initiate();
    let key = f.text("pre-existing input, unknown attribution");
    let op = f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]);
    assert_eq!(op.first_retention, BTreeSet::from([key.clone()]));
    let accepted = run(&mut f, &op).unwrap();
    let original = f.ports.records.last().unwrap().clone();
    assert_eq!(original.establishments, op.first_retention);
    assert_eq!(original.retained_content_items, op.first_retention);
    assert!(original.checks.creation.is_none());
    assert!(!f.ports.created.contains_key(&key));
    let initial = &original.checks.intakes[&key];
    assert_eq!(initial.case, IntakeCase::FirstRetention);
    assert_eq!(
        initial.source_claim.binding_knowledge,
        BindingKnowledge::NoKnownBinding
    );
    assert_eq!(initial.source_claim.attribution, Attribution::Unknown);
    assert!(!initial.source_claim.limitations.is_empty());
    assert_eq!(
        f.ports.inputs.borrow()[&key].source_claim.binding_knowledge,
        BindingKnowledge::Known(key.clone())
    );
    assert_eq!(run(&mut f, &op), Ok(accepted.clone()));
    reopen(&mut f);
    assert_eq!(run(&mut f, &op), Ok(accepted));
    assert_eq!(
        f.pursuit.record(&op.id, &mut f.ports).unwrap(),
        Some(original.clone())
    );
    let reuse = f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]);
    assert!(reuse.first_retention.is_empty());
    run(&mut f, &reuse).unwrap();
    let current = f.ports.records.last().unwrap();
    assert!(current.establishments.is_empty());
    assert!(current.retained_content_items.is_empty());
    assert_eq!(current.checks.intakes[&key].case, IntakeCase::KnownReuse);
    assert_eq!(
        current.checks.intakes[&key]
            .prior_establishment
            .as_ref()
            .unwrap()
            .operation,
        op.id
    );
    assert_eq!(
        f.ports
            .records
            .iter()
            .find(|r| r.operation.id == op.id)
            .unwrap(),
        &original
    );
    reopen(&mut f);
    let g = grant(&mut f, BTreeSet::new(), false);
    let not_fresh_origin = f.operation(OperationId::new(), finding(&key, Access::Grant(g)), vec![]);
    assert_eq!(run(&mut f, &not_fresh_origin), Err(Error::Denied));
}
#[test]
fn missing_extra_wrong_and_overlapping_intake_declarations_are_never_repaired() {
    let mut f = Fixture::new();
    let key = f.text("explicit first retention");
    let original = f.operation(
        OperationId::new(),
        Command::Initiate {
            wish: key.clone(),
            access: Access::Owner,
        },
        vec![],
    );
    for mutation in 0..3 {
        let mut wrong = original.clone();
        match mutation {
            0 => wrong.first_retention.clear(),
            1 => {
                wrong.first_retention.insert(f.key());
            }
            _ => {
                if let Command::Initiate { wish, .. } = &mut wrong.command {
                    *wish = f.key();
                }
            }
        }
        assert_eq!(f.operation_request(wrong.clone()).operation, wrong);
        assert_eq!(run(&mut f, &wrong), Err(Error::Invalid));
        assert!(f.ports.records.is_empty());
    }
    run(&mut f, &original).unwrap();
    let g = grant(&mut f, BTreeSet::new(), true);
    let payload = f.fresh(b"new");
    let mut wrong = f.operation(
        OperationId::new(),
        finding(&payload.key, Access::Grant(g)),
        vec![payload.clone()],
    );
    wrong.first_retention.insert(payload.key);
    assert_eq!(run(&mut f, &wrong), Err(Error::Invalid));
}
#[test]
fn known_objects_cannot_be_renamed_even_with_derivation_but_new_outputs_can_use_scoped_inputs() {
    let mut f = Fixture::new();
    f.initiate();
    let input = f.text("same bytes");
    let parent = f.operation(OperationId::new(), finding(&input, Access::Owner), vec![]);
    run(&mut f, &parent).unwrap();
    let g = grant(&mut f, BTreeSet::new(), true);
    let mut output = f.fresh(b"same bytes");
    output.derived_from.insert(ContentReference {
        identity: f.identity.clone(),
        operation: parent.id.clone(),
        content: input.clone(),
    });
    let mut op = f.operation(
        OperationId::new(),
        finding(&output.key, Access::Grant(g.clone())),
        vec![output.clone()],
    );
    // Even a valid local parent reference cannot turn Known(input) into an output.
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&output.key)
        .unwrap()
        .source_claim
        .binding_knowledge = BindingKnowledge::Known(input.clone());
    assert_eq!(run(&mut f, &op), Err(Error::Conflict));
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&output.key)
        .unwrap()
        .source_claim
        .binding_knowledge = BindingKnowledge::NoKnownBinding;
    // Output creation authority does not authorize this previously accepted input.
    assert_eq!(run(&mut f, &op), Err(Error::Denied));
    let scoped = grant(&mut f, BTreeSet::from([input.clone()]), true);
    op.command = finding(&output.key, Access::Grant(scoped));
    run(&mut f, &op).unwrap();
    let record = f.ports.records.last().unwrap();
    assert_eq!(record.checks.content_items.len(), 2);
    assert_eq!(
        record.checks.intakes[&input]
            .prior_establishment
            .as_ref()
            .unwrap()
            .operation,
        parent.id
    );
    assert_eq!(record.checks.creation.as_ref().unwrap().usage.items, 1);
    let original = record.clone();
    assert_eq!(run(&mut f, &op).unwrap(), original.accepted);
    assert_eq!(f.ports.records.last().unwrap(), &original);
    reopen(&mut f);
    f.ports.denied_content_items.insert(input);
    assert_eq!(run(&mut f, &op), Err(Error::Denied));
}
#[test]
fn derivation_requires_previous_exact_local_membership_and_retains_it_through_reconstruction() {
    for mutation in 0..4 {
        let mut f = Fixture::new();
        f.initiate();
        let input = f.text("parent");
        let parent = f.operation(OperationId::new(), finding(&input, Access::Owner), vec![]);
        run(&mut f, &parent).unwrap();
        let g = grant(&mut f, BTreeSet::from([input.clone()]), true);
        let mut output = f.fresh(b"derived");
        let id = OperationId::new();
        let mut reference = ContentReference {
            identity: f.identity.clone(),
            operation: parent.id,
            content: input,
        };
        match mutation {
            0 => reference.operation = id.clone(),
            1 => reference.operation = f.ports.records[0].operation.id.clone(),
            2 => reference.identity.change = ChangeId::new(),
            _ => reference.content.establishing.change = ChangeId::new(),
        }
        output.derived_from.insert(reference);
        let op = f.operation(id, finding(&output.key, Access::Grant(g)), vec![output]);
        let before = f.ports.records.len();
        assert!(run(&mut f, &op).is_err());
        assert_eq!(f.ports.records.len(), before);
    }
}
#[test]
fn whole_nonfresh_intake_guard_checks_grant_generation_revocation_and_source_claim_races() {
    for mutation in 0..5 {
        let mut f = Fixture::new();
        f.initiate();
        let key = f.text("retained input");
        let g = grant(&mut f, BTreeSet::from([key.clone()]), false);
        let op = f.operation(
            OperationId::new(),
            finding(&key, Access::Grant(g.clone())),
            vec![],
        );
        assert!(op.first_retention.is_empty());
        let before = f.ports.records.len();
        let old_source = f.ports.inputs.borrow()[&key].source_claim.clone();
        f.ports.race = Some(match mutation {
            0 => Race::GrantGeneration(g.id.clone()),
            1 => Race::GrantRevocation(g.id.clone()),
            _ => {
                let mut changed = old_source.clone();
                match mutation {
                    2 => changed.binding_knowledge = BindingKnowledge::NoKnownBinding,
                    3 => changed.attribution = Attribution::Actor(ActorId::new()),
                    _ => changed.limitations.push(1),
                }
                Race::SourceClaim(key.clone(), changed)
            }
        });
        assert_eq!(
            run(&mut f, &op),
            Err(if mutation < 2 {
                Error::Stale
            } else {
                Error::Conflict
            })
        );
        assert_eq!(f.ports.records.len(), before);
        f.ports.grants.get_mut(&g.id).unwrap().generation = g.generation;
        f.ports.grants.get_mut(&g.id).unwrap().revoked = false;
        f.ports
            .inputs
            .borrow_mut()
            .get_mut(&key)
            .unwrap()
            .source_claim = old_source;
        run(&mut f, &op).unwrap();
    }
}
#[test]
fn first_retention_and_fresh_current_source_races_publish_no_establishment() {
    for fresh in [false, true] {
        let mut f = Fixture::new();
        f.initiate();
        let (key, op) = if fresh {
            let g = grant(&mut f, BTreeSet::new(), true);
            let output = f.fresh(b"output");
            (
                output.key.clone(),
                f.operation(
                    OperationId::new(),
                    finding(&output.key, Access::Grant(g)),
                    vec![output],
                ),
            )
        } else {
            let key = f.text("unbound existing input");
            (
                key.clone(),
                f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]),
            )
        };
        let mut claim = f.ports.inputs.borrow()[&key].source_claim.clone();
        claim.binding_knowledge = BindingKnowledge::Known(key.clone());
        f.ports.race = Some(Race::SourceClaim(key.clone(), claim));
        let before = f.ports.records.len();
        assert_eq!(run(&mut f, &op), Err(Error::Conflict));
        assert_eq!(f.ports.records.len(), before);
        assert!(!f.ports.created.contains_key(&key));
    }
}
#[test]
fn accepted_retry_refuses_contradictory_identity_or_changed_stable_facts_without_replacing_original(
) {
    for mutation in 0..4 {
        let mut f = Fixture::new();
        f.initiate();
        let key = f.text("retained source");
        let op = f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]);
        let accepted = run(&mut f, &op).unwrap();
        let original = f.ports.records.last().unwrap().clone();
        reopen(&mut f);
        let old = f.ports.inputs.borrow()[&key].source_claim.clone();
        {
            let mut inputs = f.ports.inputs.borrow_mut();
            let claim = &mut inputs.get_mut(&key).unwrap().source_claim;
            match mutation {
                0 => claim.binding_knowledge = BindingKnowledge::Known(f.key()),
                1 => claim.attribution = Attribution::Actor(ActorId::new()),
                2 => claim.limitations.push(1),
                _ => claim.input_kind = InputKind::NewContribution,
            }
        }
        assert_eq!(run(&mut f, &op), Err(Error::Conflict));
        assert_eq!(f.ports.records.last().unwrap(), &original);
        f.ports
            .inputs
            .borrow_mut()
            .get_mut(&key)
            .unwrap()
            .source_claim = old;
        assert_eq!(run(&mut f, &op), Ok(accepted));
    }
}
#[test]
fn foreign_keys_and_origins_are_representable_but_not_admissible_local_evidence() {
    let mut f = Fixture::new();
    f.initiate();
    let mut key = f.key();
    key.establishing.change = ChangeId::new();
    f.ports.inputs.borrow_mut().insert(
        key.clone(),
        ContentObservation {
            bytes: b"equal bytes are no proof".to_vec(),
            source_claim: fixture::unbound_source(),
        },
    );
    f.ports
        .content_items
        .insert(key.clone(), b"equal bytes are no proof".to_vec());
    let op = f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]);
    assert_eq!(run(&mut f, &op), Err(Error::Unavailable));
    let output = FreshContent {
        key,
        ..f.fresh(b"foreign fresh claim")
    };
    let g = grant(&mut f, BTreeSet::new(), true);
    let op = f.operation(
        OperationId::new(),
        finding(&output.key, Access::Grant(g)),
        vec![output],
    );
    assert_eq!(run(&mut f, &op), Err(Error::Unavailable));
}
#[test]
fn reconstruction_refuses_intake_mode_prior_membership_and_establishment_claim_tampering() {
    let mut f = Fixture::new();
    f.initiate();
    let key = f.text("retained input");
    let first = f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]);
    run(&mut f, &first).unwrap();
    let reuse = f.operation(OperationId::new(), finding(&key, Access::Owner), vec![]);
    run(&mut f, &reuse).unwrap();
    for mutation in 0..6 {
        let mut records = f.ports.records.clone();
        let last = records.last_mut().unwrap();
        match mutation {
            0 => last.checks.intakes.clear(),
            1 => {
                last.establishments.insert(key.clone());
            }
            2 => last.checks.intakes.get_mut(&key).unwrap().case = IntakeCase::FirstRetention,
            3 => {
                last.checks
                    .intakes
                    .get_mut(&key)
                    .unwrap()
                    .prior_establishment
                    .as_mut()
                    .unwrap()
                    .operation = reuse.id.clone()
            }
            4 => last
                .checks
                .intakes
                .get_mut(&key)
                .unwrap()
                .source_claim
                .limitations
                .push(1),
            _ => {
                last.operation.first_retention.insert(key.clone());
            }
        }
        assert!(Change::reconstruct(
            HistoryHead {
                profile: CURRENT_PROFILE,
                identity: f.identity.clone(),
                accepted_operations: records.len() as u64,
                last_operation: f.ports.last_operation.clone()
            },
            records
        )
        .is_err());
    }
}

#[test]
fn fresh_attribution_is_observed_not_defaulted_and_independent_same_leaf_establishments_coexist() {
    let leaf = ContentId::new();
    let mut established = BTreeSet::new();
    for _ in 0..2 {
        let mut f = Fixture::new();
        f.initiate();
        let g = grant(&mut f, BTreeSet::new(), true);
        let key = ContentKey {
            establishing: f.identity.change_key(),
            id: leaf.clone(),
        };
        let output = f.fresh_keyed(key.clone(), b"equal bytes establish no shared origin");
        let op = f.operation(
            OperationId::new(),
            finding(&key, Access::Grant(g)),
            vec![output],
        );
        for attribution in [Attribution::Unknown, Attribution::Actor(ActorId::new())] {
            f.ports
                .inputs
                .borrow_mut()
                .get_mut(&key)
                .unwrap()
                .source_claim
                .attribution = attribution;
            assert_eq!(run(&mut f, &op), Err(Error::Denied));
        }
        f.ports
            .inputs
            .borrow_mut()
            .get_mut(&key)
            .unwrap()
            .source_claim
            .attribution = Attribution::Actor(f.identity.agent.clone());
        run(&mut f, &op).unwrap();
        let record = f.ports.records.last().unwrap();
        assert_eq!(record.establishments, BTreeSet::from([key.clone()]));
        assert_eq!(record.checks.creation.as_ref().unwrap().usage.items, 1);
        established.insert(key);
    }
    assert_eq!(established.len(), 2);
}
#[test]
fn known_foreign_objects_cannot_hide_as_unbound_local_inputs_or_supply_historical_origins() {
    let mut f = Fixture::new();
    f.initiate();
    let local = f.text("pre-existing object");
    let mut foreign = local.clone();
    foreign.establishing.change = ChangeId::new();
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&local)
        .unwrap()
        .source_claim
        .binding_knowledge = BindingKnowledge::Known(foreign);
    let first = f.operation(OperationId::new(), finding(&local, Access::Owner), vec![]);
    assert_eq!(run(&mut f, &first), Err(Error::Conflict));
    let g = grant(&mut f, BTreeSet::new(), true);
    let output = f.fresh(b"new contribution");
    let op = f.operation(
        OperationId::new(),
        finding(&output.key, Access::Grant(g)),
        vec![output.clone()],
    );
    run(&mut f, &op).unwrap();
    let mut foreign_origin = f.ports.created[&output.key].origin.clone();
    foreign_origin.binding.content.establishing.change = ChangeId::new();
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    spec.content_items.clear();
    spec.content_origins = BTreeSet::from([OriginSelector::Historical(Box::new(foreign_origin))]);
    f.owner();
    assert_eq!(
        f.execute(Command::SetGrant {
            id: GrantId::new(),
            expected_generation: None,
            spec
        }),
        Err(Error::Unavailable)
    );
}
