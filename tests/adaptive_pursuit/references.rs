use super::*;

fn operation(f: &Fixture, proposal: &Proposal, access: Access) -> Operation {
    Operation {
        fresh: vec![],
        id: f.proposal_operations[&proposal.id].clone(),
        command: Command::Propose {
            proposal: proposal.clone(),
            access,
        },
    }
}
fn own_reference(f: &Fixture, p: &Proposal, material: MaterialId) -> MaterialReference {
    MaterialReference {
        identity: f.identity.clone(),
        operation: f.proposal_operations[&p.id].clone(),
        material,
    }
}
fn propose(f: &mut Fixture, p: &Proposal) -> Result<Accepted> {
    f.execute(Command::Propose {
        proposal: p.clone(),
        access: Access::Owner,
    })
}
fn finding(f: &mut Fixture, material: MaterialId) -> Accepted {
    f.execute(Command::Finding {
        finding: Finding {
            agreement: None,
            claim: material,
            evidence: f.ports.native_evidence.clone(),
            disposition: Disposition::Unknown,
        },
        access: Access::Owner,
    })
    .unwrap()
}

#[test]
fn explicit_statement_and_context_bind_without_dimension_slots_or_inferred_requirements() {
    for owner_first in [true, false] {
        let mut f = Fixture::new();
        f.initiate();
        let p = f.proposal(None, vec![]);
        let a = f.retain_proposal(&p);
        // One explicit statement, linked to provisional context. Neither context nor
        // a question becomes another selected term or a fulfillment criterion.
        assert_eq!(p.terms.binding.len(), 1);
        assert_eq!(p.terms.binding[0].context, p.terms.context);
        assert_eq!(
            p.terms.criteria[0].terms,
            BTreeSet::from([p.terms.binding[0].statement.clone()])
        );
        if owner_first {
            f.adopt(&p, vec![]);
            f.undertake(&p, &a, vec![]);
        } else {
            f.undertake(&p, &a, vec![]);
            f.adopt(&p, vec![]);
        }
        assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
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
        // Supplying only context evidence cannot replace the selected criterion.
        let mut invalid = f.fulfillment(&p);
        invalid.criteria.clear();
        assert_eq!(f.execute(Command::Fulfill(invalid)), Err(Error::Invalid));
        f.execute(Command::Fulfill(f.fulfillment(&p))).unwrap();
    }
}

#[test]
fn binding_and_definition_cannot_be_context_even_through_another_accepted_operation() {
    for criterion in [true, false] {
        for alias in [true, false] {
            let mut f = Fixture::new();
            f.initiate();
            let mut p = f.proposal(None, vec![]);
            let original = if criterion {
                p.terms.criteria[0].definition.clone()
            } else {
                p.terms.binding[0].statement.clone()
            };
            let mut context = original.clone();
            if alias {
                context.operation = finding(&mut f, original.material.clone()).operation;
            }
            p.terms.context.insert(context.clone());
            p.terms.binding[0].context.insert(context);
            let before = f.status().accepted_operations;
            assert_eq!(propose(&mut f, &p), Err(Error::Conflict));
            assert_eq!(f.status().accepted_operations, before);
        }
    }
    // Equal bytes with distinct identities do not collapse roles or infer identity.
    let mut f = Fixture::new();
    f.initiate();
    let mut p = f.proposal(None, vec![]);
    let bytes = f.ports.materials[&p.terms.binding[0].statement.material].clone();
    let separate = f.text(std::str::from_utf8(&bytes).unwrap());
    p.terms.context = BTreeSet::from([own_reference(&f, &p, separate)]);
    p.terms.binding[0].context = p.terms.context.clone();
    propose(&mut f, &p).unwrap();
}

#[test]
fn statement_context_links_must_be_explicit_context_selections() {
    let mut f = Fixture::new();
    f.initiate();
    let mut p = f.proposal(None, vec![]);
    p.terms.context.clear();
    assert_eq!(propose(&mut f, &p), Err(Error::Invalid));
    // Omitting a link does not infer one from matching prose or a question.
    p.terms.binding[0].context.clear();
    propose(&mut f, &p).unwrap();
}

#[test]
fn references_require_original_accepted_pairs_not_current_material_presence_or_equal_bytes() {
    let mut f = Fixture::new();
    let first = f.text("original source");
    let initial = f
        .execute(Command::Initiate {
            wish: first.clone(),
            access: Access::Owner,
        })
        .unwrap();
    let second = f.text("later source");
    let later = finding(&mut f, second.clone());
    let original = f
        .pursuit
        .record(&initial.operation, &mut f.ports)
        .unwrap()
        .unwrap();
    let retry = f
        .pursuit
        .submit(original.submission().unwrap(), &mut f.ports)
        .unwrap();
    assert_eq!(retry, initial);
    let mut p = f.proposal(None, vec![]);
    let mut reference = own_reference(&f, &p, second.clone());
    reference.operation = initial.operation.clone();
    p.terms.context.insert(reference.clone());
    assert_eq!(propose(&mut f, &p), Err(Error::Invalid));
    // Matching bytes under another identity cannot manufacture historical membership.
    let equal = f.text("original source");
    p.terms.context.remove(&reference);
    reference.material = equal;
    p.terms.context.insert(reference.clone());
    assert_eq!(propose(&mut f, &p), Err(Error::Invalid));
    // An actual later binding works; it never changes the first operation's membership.
    p.terms.context.remove(&reference);
    reference.operation = later.operation;
    reference.material = second;
    p.terms.context.insert(reference);
    propose(&mut f, &p).unwrap();
    assert_eq!(
        f.pursuit.record(&initial.operation, &mut f.ports).unwrap(),
        Some(original)
    );
}

#[test]
fn missing_foreign_and_unaccepted_references_are_not_inferred_from_access() {
    for kind in 0..5 {
        let mut f = Fixture::new();
        f.initiate();
        let mut p = f.proposal(None, vec![]);
        let mut reference = p.terms.context.first().unwrap().clone();
        match kind {
            0 => reference.operation = OperationId::new(),
            1 => reference.identity.owner = OwnerId::new(),
            2 => reference.identity.ledger = LedgerId::new(),
            3 => reference.identity.change = ChangeId::new(),
            _ => {
                f.ports.materials.remove(&reference.material);
            }
        }
        p.terms.context = BTreeSet::from([reference.clone()]);
        p.terms.binding[0].context = p.terms.context.clone();
        assert_eq!(
            propose(&mut f, &p),
            Err(if kind == 4 {
                Error::Unavailable
            } else {
                Error::Invalid
            })
        );
    }
    // Even genuinely accepted foreign membership cannot be imported as local authority.
    let mut foreign = Fixture::new();
    foreign.initiate();
    let p = foreign.proposal(None, vec![]);
    propose(&mut foreign, &p).unwrap();
    let mut f = Fixture::new();
    f.initiate();
    f.ports.materials.extend(foreign.ports.materials.clone());
    let mut local = f.proposal(None, vec![]);
    local
        .terms
        .context
        .insert(p.terms.binding[0].statement.clone());
    assert_eq!(propose(&mut f, &local), Err(Error::Invalid));
}

#[test]
fn failed_acceptance_publishes_no_provisional_membership_or_material_freeze() {
    for cut in 0..4 {
        let mut f = Fixture::new();
        f.initiate();
        let p = f.proposal(None, vec![]);
        let op = operation(&f, &p, Access::Owner);
        let material = p.terms.binding[0].statement.material.clone();
        f.ports.race = match cut {
            0 => Some(Race::Material(material.clone())),
            1 => Some(Race::Context),
            2 => Some(Race::Disclosure),
            _ => None,
        };
        f.ports.refuse_acceptance = cut == 3;
        assert!(f
            .pursuit
            .submit(f.submission(op.clone()), &mut f.ports)
            .is_err());
        f.ports.refuse_acceptance = false;
        f.owner();
        f.ports
            .context
            .disclosure
            .insert(ReadScope::Change(f.identity.change.clone()));
        assert_eq!(f.ports.accepted.len(), 1);
        assert_eq!(f.pursuit.record(&op.id, &mut f.ports).unwrap(), None);
        assert_eq!(
            f.pursuit.read(
                Query::Material(material.clone()),
                Access::Owner,
                &mut f.ports
            ),
            Err(Error::Invalid)
        );
        let mut other = f.proposal(None, vec![]);
        other
            .terms
            .context
            .insert(p.terms.binding[0].statement.clone());
        assert_eq!(propose(&mut f, &other), Err(Error::Invalid));
        // Failure did not freeze fresh bytes or reserve operation/proposal/criterion IDs.
        f.ports
            .materials
            .insert(material, b"replacement before first acceptance".to_vec());
        let accepted = f
            .pursuit
            .submit(f.submission(op.clone()), &mut f.ports)
            .unwrap();
        assert_eq!(
            f.pursuit.submit(f.submission(op), &mut f.ports),
            Ok(accepted)
        );
        propose(&mut f, &other).unwrap();
    }
}

#[test]
fn own_references_do_not_grant_fresh_material_or_union_finite_grants() {
    let mut f = Fixture::new();
    f.initiate();
    let p = f.proposal(None, vec![]);
    let mut first = f.draft_spec(BTreeSet::from([GrantAction::Propose]));
    let statement = p.terms.binding[0].statement.material.clone();
    first.materials.remove(&statement);
    let a = f.grant(first);
    let mut second = f.draft_spec(BTreeSet::from([GrantAction::Propose]));
    second.materials = BTreeSet::from([statement]);
    f.grant(second);
    f.agent();
    assert_eq!(
        f.execute(Command::Propose {
            proposal: p.clone(),
            access: Access::Grant(a)
        }),
        Err(Error::Denied)
    );
    let complete = f.draft_spec(BTreeSet::from([GrantAction::Propose]));
    let grant = f.grant(complete);
    f.agent();
    // Accepted references and origin do not give authority over newly supplied text.
    let mut changed = p.clone();
    let new = f.text("fresh delegated claim");
    changed
        .terms
        .context
        .insert(own_reference(&f, &changed, new));
    assert_eq!(
        f.execute(Command::Propose {
            proposal: changed,
            access: Access::Grant(grant.clone())
        }),
        Err(Error::Denied)
    );
    f.execute(Command::Propose {
        proposal: p,
        access: Access::Grant(grant),
    })
    .unwrap();
}

#[test]
fn guarded_granted_proposal_checks_prefix_disclosure_and_content_before_publication() {
    for cut in 0..3 {
        let mut f = Fixture::new();
        f.initiate();
        let p = f.proposal(None, vec![]);
        let spec = f.draft_spec(BTreeSet::from([GrantAction::Propose]));
        let grant = f.grant(spec);
        f.agent();
        let op = operation(&f, &p, Access::Grant(grant));
        let before = f.ports.accepted.len();
        f.ports.race = Some(match cut {
            // A concurrent grant replacement/revocation changes the accepted prefix;
            // a privately planned operation cannot publish against that new prefix.
            0 => Race::Prefix,
            1 => Race::Disclosure,
            _ => Race::Material(p.terms.binding[0].statement.material.clone()),
        });
        assert!(f
            .pursuit
            .submit(f.submission(op.clone()), &mut f.ports)
            .is_err());
        assert_eq!(f.ports.accepted.len(), before);
        assert!(!f.ports.accepted.contains_key(&op.id));
    }
}

#[test]
fn criterion_links_are_nonempty_exact_selected_statements_not_context_or_material_aliases() {
    for kind in 0..4 {
        let mut f = Fixture::new();
        f.initiate();
        let mut p = f.proposal(None, vec![]);
        p.terms.criteria[0].terms = match kind {
            0 => BTreeSet::new(),
            1 => p.terms.context.clone(),
            2 => {
                let mut alias = p.terms.binding[0].statement.clone();
                alias.operation = finding(&mut f, alias.material.clone()).operation;
                BTreeSet::from([alias])
            }
            _ => BTreeSet::from([p.terms.criteria[0].definition.clone()]),
        };
        assert_eq!(propose(&mut f, &p), Err(Error::Invalid));
    }
}

#[test]
fn criterion_definition_and_exact_term_links_are_frozen_but_fresh_ids_allow_changes() {
    for kind in 0..4 {
        let mut f = Fixture::new();
        f.initiate();
        let p = f.proposal(None, vec![]);
        propose(&mut f, &p).unwrap();
        let mut next = f.proposal(None, vec![]);
        next.terms = p.terms.clone();
        match kind {
            0 => {
                let definition = f.text("new criterion definition");
                next.terms.criteria[0].definition = own_reference(&f, &next, definition);
            }
            1 => {
                let original = &p.terms.criteria[0].definition;
                let alias = finding(&mut f, original.material.clone());
                next.terms.criteria[0].definition.operation = alias.operation;
            }
            2 => {
                let statement = f.text("new explicitly selected term");
                let reference = own_reference(&f, &next, statement);
                next.terms.binding.push(TermSelection {
                    statement: reference.clone(),
                    context: BTreeSet::new(),
                });
                next.terms.criteria[0].terms.insert(reference);
            }
            _ => {
                let original = &p.terms.binding[0].statement;
                let alias = finding(&mut f, original.material.clone());
                let mut reference = original.clone();
                reference.operation = alias.operation;
                next.terms.binding.push(TermSelection {
                    statement: reference.clone(),
                    context: BTreeSet::new(),
                });
                next.terms.criteria[0].terms = BTreeSet::from([reference]);
            }
        }
        let before = f.ports.accepted.len();
        assert_eq!(propose(&mut f, &next), Err(Error::Conflict));
        assert_eq!(f.ports.accepted.len(), before);
        next.terms.criteria[0].id = CriterionId::new();
        propose(&mut f, &next).unwrap();
    }
}

#[test]
fn revised_roles_need_fresh_proposal_and_matching_decisions_not_inheritance() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let mut revision = f.proposal(Some(p.agreement.clone()), vec![]);
    // Promote the former provisional context only by explicit new term selection.
    let statement = p.terms.context.first().unwrap().clone();
    revision.terms.binding = vec![TermSelection {
        statement: statement.clone(),
        context: BTreeSet::new(),
    }];
    revision.terms.context.clear();
    revision.terms.unknowns.clear();
    revision.terms.criteria[0].terms = BTreeSet::from([statement]);
    let assessment = f.retain_proposal(&revision);
    f.undertake(&revision, &assessment, vec![]);
    assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
    f.adopt(&revision, vec![]);
    assert_eq!(
        f.status().current_agreement,
        Some(revision.agreement.clone())
    );
    // Reusing a criterion does not import the old agreement's acceptance.
    let mut old = f.fulfillment(&revision);
    old.agreement = p.agreement;
    assert_eq!(f.execute(Command::Fulfill(old)), Err(Error::Stale));
}

#[test]
fn incomplete_draft_reference_retries_use_current_sources_and_disclosure() {
    let mut f = Fixture::new();
    f.initiate();
    let mut incomplete = f.proposal(None, vec![]);
    incomplete.terms.criteria.clear();
    let op = operation(&f, &incomplete, Access::Owner);
    let accepted = f
        .pursuit
        .submit(f.submission(op.clone()), &mut f.ports)
        .unwrap();
    let original = f.pursuit.record(&op.id, &mut f.ports).unwrap().unwrap();
    let material = incomplete.terms.context.first().unwrap().material.clone();
    let bytes = f.ports.materials.remove(&material).unwrap();
    assert_eq!(
        f.pursuit.submit(f.submission(op.clone()), &mut f.ports),
        Err(Error::Unavailable)
    );
    f.ports
        .materials
        .insert(material.clone(), b"rebound context".to_vec());
    assert_eq!(
        f.pursuit.submit(f.submission(op.clone()), &mut f.ports),
        Err(Error::Conflict)
    );
    f.ports.materials.insert(material, bytes);
    f.ports.race = Some(Race::Disclosure);
    assert_eq!(
        f.pursuit.submit(f.submission(op.clone()), &mut f.ports),
        Err(Error::Stale)
    );
    f.ports
        .context
        .disclosure
        .insert(ReadScope::Change(f.identity.change.clone()));
    assert_eq!(
        f.pursuit.submit(f.submission(op), &mut f.ports),
        Ok(accepted)
    );
    assert_eq!(
        f.pursuit
            .record(&original.operation.id, &mut f.ports)
            .unwrap(),
        Some(original)
    );
}

#[test]
fn fresh_operations_cannot_edit_proposals_or_rebind_agreement_identity() {
    let mut f = Fixture::new();
    f.initiate();
    let p = f.proposal(None, vec![]);
    propose(&mut f, &p).unwrap();
    let mut changed = p.clone();
    changed.terms.binding[0].context.clear();
    let before = f.ports.accepted.len();
    // A new operation is not an exact retry and cannot edit the accepted proposal.
    assert_eq!(
        f.pursuit.submit(
            f.submission(Operation {
                fresh: vec![],
                id: OperationId::new(),
                command: Command::Propose {
                    proposal: changed.clone(),
                    access: Access::Owner
                },
            }),
            &mut f.ports
        ),
        Err(Error::Conflict)
    );
    changed.id = ProposalId::new();
    assert_eq!(propose(&mut f, &changed), Err(Error::Conflict));
    changed.agreement = AgreementId::new();
    propose(&mut f, &changed).unwrap();
    assert_eq!(f.ports.accepted.len(), before + 1);
    let mut duplicate = f.proposal(None, vec![]);
    duplicate
        .terms
        .binding
        .push(duplicate.terms.binding[0].clone());
    assert_eq!(propose(&mut f, &duplicate), Err(Error::Invalid));
}

#[test]
fn accepted_references_need_current_source_access_and_cannot_be_rebound_on_reuse() {
    let mut f = Fixture::new();
    f.initiate();
    let p = f.proposal(None, vec![]);
    propose(&mut f, &p).unwrap();
    let mut next = f.proposal(None, vec![]);
    next.terms = p.terms.clone();
    let material = p.terms.binding[0].statement.material.clone();
    let original = f.ports.materials.remove(&material).unwrap();
    assert_eq!(propose(&mut f, &next), Err(Error::Unavailable));
    f.ports.materials.insert(
        material.clone(),
        b"different text at accepted identity".to_vec(),
    );
    assert_eq!(propose(&mut f, &next), Err(Error::Conflict));
    f.ports.materials.insert(material, original);
    propose(&mut f, &next).unwrap();
}

#[test]
fn decisions_on_different_role_selections_never_match_even_when_text_is_shared() {
    for owner_first in [true, false] {
        let mut f = Fixture::new();
        f.initiate();
        let first = f.proposal(None, vec![]);
        let a = f.retain_proposal(&first);
        let mut other = f.proposal(None, vec![]);
        other.terms = first.terms.clone();
        // Same exact statement/criterion, different explicit context linkage.
        other.terms.binding[0].context.clear();
        let b = f.retain_proposal(&other);
        if owner_first {
            f.adopt(&first, vec![]);
            f.undertake(&other, &b, vec![]);
        } else {
            f.undertake(&first, &a, vec![]);
            f.adopt(&other, vec![]);
        }
        assert_eq!(f.status().current_agreement, None);
        if owner_first {
            f.undertake(&first, &a, vec![]);
        } else {
            f.adopt(&first, vec![]);
        }
        assert_eq!(f.status().current_agreement, Some(first.agreement));
    }
}

#[test]
fn question_links_are_optional_exact_references_not_dimension_tags_or_resolution() {
    let mut f = Fixture::new();
    f.initiate();
    let mut p = f.proposal(None, vec![]);
    let mut affected = p.terms.binding[0].statement.clone();
    affected.operation = OperationId::new();
    p.terms.unknowns[0].affected = BTreeSet::from([affected]);
    assert_eq!(propose(&mut f, &p), Err(Error::Invalid));
    p.terms.unknowns[0].affected.clear();
    let assessment = f.retain_proposal(&p);
    f.adopt(&p, vec![]);
    f.undertake(&p, &assessment, vec![]);
    f.owner();
    let record = f
        .pursuit
        .record(&f.proposal_operations[&p.id], &mut f.ports)
        .unwrap()
        .unwrap();
    let Command::Propose { proposal, .. } = record.operation.command else {
        panic!("proposal")
    };
    assert_eq!(proposal.terms.unknowns, p.terms.unknowns);
}
