use changekernel::unqualified_change::{
    Acceptance, Access, ActionId, ActionOutcome, ActionPhase, ActionRequest, ActorId, Adaptation,
    AgreementId, AssessmentId, Attribution, Change, ChangeId, Checks, Command, ContentId,
    ContentKey, ContentLimits, ContentObservation, Context, ContextVersion, CreatedIdentity,
    CriterionId, Decision, DecisionId, DecisionKind, Dependency, Disposition, Effect, Error,
    Finding, GrantAction, GrantId, GrantTarget, GrantUse, GroundId, GroundVersion, HistoryHead,
    Identity, IntakeRequest, LedgerId, LimitId, NativeActionId, NativeConditions, Operation,
    OperationId, OperationRequestError, OriginScope, OriginSelector, OwnerId, Ports, ProposalId,
    Query, Read, ReadScope, Result, ScopeId, ScopeJudgment, Settlement, StoredOperation,
    CURRENT_PROFILE,
};

#[test]
fn persistent_ids_reject_zero_and_preserve_values_across_independent_construction() {
    macro_rules! check {
        ($($id:ident),+ $(,)?) => {$({
            assert_eq!($id::from_bytes([0; 16]), Err(Error::Invalid));
            let bytes = [0x83; 16];
            let first = $id::from_bytes(bytes).unwrap();
            let restored = $id::from_bytes(*first.as_bytes()).unwrap();
            assert_eq!(restored, first);
            assert_eq!(restored.as_bytes(), &bytes);
            let mut different = bytes;
            different[15] ^= 1;
            assert_ne!(first, $id::from_bytes(different).unwrap());
        })+};
    }
    check!(
        ActorId,
        OwnerId,
        LedgerId,
        ChangeId,
        ProposalId,
        AgreementId,
        AssessmentId,
        DecisionId,
        GrantId,
        ActionId,
        OperationId,
        ContentId,
        GroundId,
        GroundVersion,
        CriterionId,
        ScopeId,
        LimitId,
        NativeActionId,
        ContextVersion
    );
}

#[path = "change/fixture.rs"]
#[allow(dead_code)]
mod fixture;
use fixture::{Fixture, FixturePorts, Race, TestId};

fn head(f: &Fixture) -> HistoryHead {
    HistoryHead {
        profile: CURRENT_PROFILE,
        identity: f.identity.clone(),
        accepted_operations: f.ports.records.len() as u64,
        last_operation: f.ports.last_operation.clone(),
    }
}
fn reopen(f: &mut Fixture) {
    f.pursuit = Change::reconstruct(head(f), f.ports.records.clone()).unwrap();
}
fn refuse_history(head: HistoryHead, records: Vec<StoredOperation>) {
    assert!(Change::reconstruct(head, records).is_err());
}
fn op(f: &Fixture, command: Command) -> Operation {
    fixture::new_operation(OperationId::new(), command, vec![], f)
}

#[test]
fn reconstruction_uses_accepted_order_not_persistent_id_order_and_preserves_retry() {
    let mut f = Fixture::new();
    let wish = f.text("a retained draft");
    let mut initial = op(
        &f,
        Command::Initiate {
            wish,
            access: Access::Owner,
        },
    );
    initial.id = OperationId::from_bytes([0xff; 16]).unwrap();
    let accepted = f
        .pursuit
        .execute(f.operation_request(initial.clone()), &mut f.ports)
        .unwrap();
    let reason = f.text("withdraw without fulfilling");
    let mut last = op(&f, Command::Withdraw { reason });
    last.id = OperationId::from_bytes([1; 16]).unwrap();
    f.pursuit
        .execute(f.operation_request(last), &mut f.ports)
        .unwrap();
    assert!(f.ports.records[0].operation.id > f.ports.records[1].operation.id);
    let expected = f.status();
    reopen(&mut f);
    assert_eq!(f.status(), expected);
    let count = f.ports.records.len();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(initial.clone()), &mut f.ports),
        Ok(accepted.clone())
    );
    assert_eq!(f.ports.records.len(), count);
    let original = f
        .pursuit
        .record(&initial.id, &mut f.ports)
        .unwrap()
        .unwrap();
    assert_eq!(original, f.ports.records[0]);
    let mut conflicting = initial.clone();
    conflicting.command = Command::Withdraw {
        reason: f.text("different original request"),
    };
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(conflicting), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Conflict))
    );
    f.agent();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(initial.clone()), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Conflict))
    );
    f.owner();
    f.ports.context.disclosure.clear();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(initial), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Denied))
    );
}

#[derive(Clone, Copy)]
enum OutcomeCut {
    Reject,
    BeforeCommit,
    AfterCommit,
}
struct Uncertain<'a> {
    inner: &'a mut FixturePorts,
    cut: OutcomeCut,
    calls: usize,
}
impl Ports for Uncertain<'_> {
    fn context(&mut self) -> Result<Context> {
        self.calls += 1;
        self.inner.context()
    }
    fn resolve_content(
        &mut self,
        checks: &Checks,
        request: &IntakeRequest,
    ) -> Result<ContentObservation> {
        self.inner.resolve_content(checks, request)
    }
    fn authorize_intake(&mut self, checks: &Checks, operation: &Operation) -> Result<()> {
        self.inner.authorize_intake(checks, operation)
    }
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion> {
        self.inner.ground(id)
    }
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment> {
        self.inner.discretion(adaptation)
    }
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions> {
        self.inner.native_conditions(action)
    }
    fn accept(&mut self, record: &StoredOperation) -> Acceptance {
        match self.cut {
            OutcomeCut::Reject => Acceptance::NotAccepted(Error::Unavailable),
            OutcomeCut::BeforeCommit => Acceptance::Indeterminate,
            OutcomeCut::AfterCommit => {
                assert_eq!(self.inner.accept(record), Acceptance::Accepted);
                Acceptance::Indeterminate
            }
        }
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        self.inner.disclose(checks)
    }
}

#[test]
fn definite_rejection_leaves_handle_writable_and_same_id_can_be_submitted() {
    let mut f = Fixture::new();
    let wish = f.text("not yet accepted");
    let operation = op(
        &f,
        Command::Initiate {
            wish,
            access: Access::Owner,
        },
    );
    let mut ports = Uncertain {
        inner: &mut f.ports,
        cut: OutcomeCut::Reject,
        calls: 0,
    };
    assert_eq!(
        f.pursuit.execute(
            fixture::operation_request_for(
                &f.identity,
                &ports.inner.context.authority,
                operation.clone()
            ),
            &mut ports
        ),
        Err(OperationRequestError::NotAccepted(Error::Unavailable))
    );
    assert!(ports.inner.records.is_empty());
    assert_eq!(f.pursuit.record(&operation.id, &mut ports), Ok(None));
    assert!(!f.status().initiated);
    f.pursuit
        .execute(f.operation_request(operation), &mut f.ports)
        .unwrap();
    assert!(f.status().initiated);
    assert_eq!(f.ports.records.len(), 1);
}

#[test]
fn indeterminate_before_or_after_commit_fences_without_a_false_nonacceptance_result() {
    for cut in [OutcomeCut::BeforeCommit, OutcomeCut::AfterCommit] {
        let mut f = Fixture::new();
        let wish = f.text("may have been accepted");
        let operation = op(
            &f,
            Command::Initiate {
                wish,
                access: Access::Owner,
            },
        );
        let mut ports = Uncertain {
            inner: &mut f.ports,
            cut,
            calls: 0,
        };
        assert_eq!(
            f.pursuit.execute(
                fixture::operation_request_for(
                    &f.identity,
                    &ports.inner.context.authority,
                    operation.clone()
                ),
                &mut ports
            ),
            Err(OperationRequestError::Indeterminate)
        );
        let calls = ports.calls;
        assert_eq!(
            f.pursuit.execute(
                fixture::operation_request_for(
                    &f.identity,
                    &ports.inner.context.authority,
                    operation.clone()
                ),
                &mut ports
            ),
            Err(OperationRequestError::Fenced)
        );
        let different = Operation {
            id: OperationId::new(),
            command: Command::Withdraw {
                reason: operation_content(&operation),
            },
            fresh: vec![],
            first_retention: std::collections::BTreeSet::new(),
        };
        assert_eq!(
            f.pursuit.execute(
                fixture::operation_request_for(
                    &f.identity,
                    &ports.inner.context.authority,
                    different
                ),
                &mut ports
            ),
            Err(OperationRequestError::Fenced)
        );
        assert_eq!(
            f.pursuit.record(&operation.id, &mut ports),
            Err(Error::Unavailable)
        );
        assert_eq!(
            f.pursuit.read(Query::Status, Access::Owner, &mut ports),
            Err(Error::Unavailable)
        );
        assert_eq!(ports.calls, calls);
        assert_eq!(
            ports.inner.records.len(),
            usize::from(matches!(cut, OutcomeCut::AfterCommit))
        );
        // A trusted store reopen supplies the verified complete prefix, never current execute.
        reopen(&mut f);
        let original = f.pursuit.record(&operation.id, &mut f.ports).unwrap();
        if matches!(cut, OutcomeCut::AfterCommit) {
            let original = original.unwrap();
            assert_eq!(original.operation, operation);
            assert_eq!(
                f.pursuit
                    .execute(f.operation_request(operation), &mut f.ports),
                Ok(original.accepted)
            );
        } else {
            assert_eq!(original, None);
            assert!(!f.status().initiated);
            f.pursuit
                .execute(f.operation_request(operation), &mut f.ports)
                .unwrap();
        }
        assert_eq!(f.ports.records.len(), 1);
        assert!(f.status().initiated);
    }
}
fn operation_content(operation: &Operation) -> ContentKey {
    let Command::Initiate { wish, .. } = &operation.command else {
        unreachable!()
    };
    wish.clone()
}

#[test]
fn reconstruction_refuses_missing_reordered_duplicate_unsupported_and_inconsistent_controls() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    f.owner();
    let original_head = head(&f);
    let original = f.ports.records.clone();
    for kind in 0..23 {
        let mut h = original_head.clone();
        let mut records = original.clone();
        match kind {
            0 => {
                records.remove(0);
            }
            1 => {
                records.pop();
            }
            2 => records.swap(1, 2),
            3 => records.push(records.last().unwrap().clone()),
            4 => h.profile.semantic += 1,
            5 => h.profile.semantic = 0,
            6 => records[1].profile.semantic += 1,
            7 => records[1].profile.semantic = 0,
            8 => h.accepted_operations += 1,
            9 => h.last_operation = None,
            10 => h.identity.change = ChangeId::new(),
            11 => records[1].sequence += 1,
            12 => records[1].checks.expected_operation = None,
            13 => records[1].accepted.effect = Effect::Recorded,
            14 => records[1].accepted.actor = ActorId::new(),
            15 => records[1].accepted.represented_owner = OwnerId::new(),
            16 => records[1].accepted.operation = OperationId::new(),
            17 => records[1].checks.identity.ledger = LedgerId::new(),
            18 => records[1].checks.context.disclosure.clear(),
            19 => records[1].checks.disclosure = ReadScope::Change(f.identity.change.clone()),
            20 => {
                records[1].creations.clear();
            }
            21 => {
                records[0].retained_content_items.clear();
            }
            _ => {
                records[0].establishments.insert(f.key());
            }
        }
        refuse_history(h, records);
    }
    let restored = Change::reconstruct(original_head, original).unwrap();
    assert_eq!(
        restored.read(Query::Status, Access::Owner, &mut f.ports),
        Ok(Read::Status(f.status()))
    );
    assert_eq!(f.status().current_agreement, Some(p.agreement));
}

#[test]
fn reconstruction_checks_content_membership_and_historical_grounds_instead_of_live_ports() {
    let mut f = Fixture::new();
    f.initiate();
    let dependency = f.dependency();
    let p = f.proposal(None, vec![dependency.clone()]);
    let a = f.retain_proposal(&p);
    f.adopt(&p, vec![]);
    f.undertake(&p, &a, vec![]);
    let h = head(&f);
    let original = f.ports.records.clone();
    for kind in 0..10 {
        let mut records = original.clone();
        let r = &mut records[2];
        match kind {
            0 => {
                r.checks.content_items.remove(&a.coverage);
            }
            1 => {
                r.checks
                    .content_items
                    .insert(f.key(), b"extra implicit binding".to_vec());
            }
            2 => {
                r.checks
                    .content_items
                    .get_mut(&p.terms.binding[0].statement.content)
                    .unwrap()
                    .push(1);
            }
            3 => {
                r.checks.grounds.clear();
            }
            4 => {
                r.checks
                    .grounds
                    .insert(dependency.ground.clone(), GroundVersion::new());
            }
            5 => {
                r.checks
                    .grounds
                    .insert(GroundId::new(), GroundVersion::new());
            }
            6 => {
                r.checks.disclosure_origin = Some(OriginScope {
                    identity: f.identity.clone(),
                    grant: GrantUse {
                        id: GrantId::new(),
                        generation: 1,
                    },
                    target: GrantTarget::Draft(f.identity.change.clone()),
                })
            }
            7 => r.checks.context.authority.owner_control = None,
            8 => r.checks.context.authority.represented_owner = OwnerId::new(),
            _ => {
                let r = &mut records[1];
                let Command::Propose { proposal, .. } = &mut r.operation.command else {
                    unreachable!()
                };
                proposal.terms.binding[0].statement.operation = records_operation(&original[0]);
            }
        }
        refuse_history(h.clone(), records);
    }
    // Reconstruction does not consult the changed present or fetch missing sources.
    f.ports.grounds.clear();
    let content_items = std::mem::take(&mut f.ports.content_items);
    reopen(&mut f);
    assert_eq!(f.status().current_agreement, Some(p.agreement));
    f.agent();
    let undertaking = original.last().unwrap();
    assert_eq!(
        f.pursuit
            .execute(undertaking.operation_request().unwrap(), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Unavailable))
    );
    f.ports.content_items = content_items;
    assert_eq!(
        f.pursuit
            .execute(undertaking.operation_request().unwrap(), &mut f.ports),
        Ok(undertaking.accepted.clone())
    );
}
fn records_operation(record: &StoredOperation) -> OperationId {
    record.operation.id.clone()
}

fn fresh_finding(f: &mut Fixture) -> (Operation, GrantUse) {
    f.initiate();
    let mut spec = f.draft_spec(std::collections::BTreeSet::from([GrantAction::Finding]));
    spec.creation = Some(ContentLimits {
        items: 2,
        payload_bytes: 200,
    });
    spec.content_origins.insert(OriginSelector::CurrentGrant);
    spec.disclosure_origins.insert(OriginSelector::CurrentGrant);
    let grant = f.grant(spec);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.owner_actor.clone(),
    ));
    let mut payload = f.fresh(b"a new attributed finding");
    payload.attributed_source = f.identity.owner_actor.clone();
    f.ports
        .inputs
        .borrow_mut()
        .get_mut(&payload.key)
        .unwrap()
        .source_claim
        .attribution = Attribution::Actor(f.identity.owner_actor.clone());
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: payload.key.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Grant(grant.clone()),
        },
        vec![payload],
        f,
    );
    (operation, grant)
}

#[test]
fn reconstruction_preserves_original_creation_origins_usage_snapshots_and_retry_after_revocation() {
    let mut f = Fixture::new();
    let (operation, grant) = fresh_finding(&mut f);
    f.agent();
    let accepted = f
        .pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    let creation = f
        .ports
        .records
        .last()
        .unwrap()
        .checks
        .creation
        .clone()
        .unwrap();
    f.owner();
    f.execute(Command::RevokeGrant {
        id: grant.id.clone(),
        expected_generation: grant.generation,
    })
    .unwrap();
    reopen(&mut f);
    let original = f
        .pursuit
        .record(&operation.id, &mut f.ports)
        .unwrap()
        .unwrap();
    assert_eq!(original.checks.creation, Some(creation.clone()));
    f.agent();
    let count = f.ports.records.len();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation.clone()), &mut f.ports),
        Ok(accepted)
    );
    assert_eq!(f.ports.records.len(), count);
    let mut new_id = operation.clone();
    new_id.id = OperationId::new();
    assert_eq!(
        f.pursuit.execute(f.operation_request(new_id), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Denied))
    );
    let content = operation.fresh[0].key.clone();
    f.ports.denied_content_items.insert(content.clone());
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation.clone()), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Denied))
    );
    f.ports.denied_content_items.clear();
    // A new independent explicit historical-origin grant can reuse retained content.
    let origin = creation.content_items[&content].origin.clone();
    let mut spec = f.draft_spec(std::collections::BTreeSet::from([GrantAction::Finding]));
    spec.content_items.remove(&content);
    spec.content_origins
        .insert(OriginSelector::Historical(Box::new(origin.clone())));
    spec.disclosure_origins
        .insert(OriginSelector::Historical(Box::new(origin)));
    let independent = f.grant(spec);
    reopen(&mut f);
    f.agent();
    assert_eq!(
        f.pursuit.read(
            Query::Content(content),
            Access::Grant(independent),
            &mut f.ports
        ),
        Ok(Read::Content(operation.fresh[0].bytes.clone()))
    );
}

#[test]
fn reconstruction_rejects_tampered_creation_grant_snapshot_origin_usage_and_payload_membership() {
    let mut f = Fixture::new();
    let (operation, _) = fresh_finding(&mut f);
    f.agent();
    f.pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    let h = head(&f);
    let original = f.ports.records.clone();
    for kind in 0..18 {
        let mut records = original.clone();
        let r = records.last_mut().unwrap();
        match kind {
            0 => r.used_grant = None,
            1 => r.grant_snapshot = None,
            2 => r.used_grant.as_mut().unwrap().generation += 1,
            3 => r.grant_snapshot.as_mut().unwrap().generation += 1,
            4 => r.grant_snapshot.as_mut().unwrap().revoked = true,
            5 => r.checks.creation = None,
            6 => r.checks.creation.as_mut().unwrap().usage.items += 1,
            7 => r.checks.creation.as_mut().unwrap().usage.payload_bytes += 1,
            8 => r.checks.creation.as_mut().unwrap().grant.spec.creation = None,
            9 => {
                r.checks
                    .creation
                    .as_mut()
                    .unwrap()
                    .content_items
                    .values_mut()
                    .next()
                    .unwrap()
                    .origin
                    .recorder = ActorId::new()
            }
            10 => {
                r.checks
                    .creation
                    .as_mut()
                    .unwrap()
                    .content_items
                    .values_mut()
                    .next()
                    .unwrap()
                    .origin
                    .represented_owner = OwnerId::new()
            }
            11 => {
                r.checks
                    .creation
                    .as_mut()
                    .unwrap()
                    .content_items
                    .values_mut()
                    .next()
                    .unwrap()
                    .origin
                    .binding
                    .operation = OperationId::new()
            }
            12 => {
                r.checks
                    .creation
                    .as_mut()
                    .unwrap()
                    .content_items
                    .values_mut()
                    .next()
                    .unwrap()
                    .origin
                    .binding
                    .identity
                    .change = ChangeId::new()
            }
            13 => {
                r.checks
                    .creation
                    .as_mut()
                    .unwrap()
                    .content_items
                    .values_mut()
                    .next()
                    .unwrap()
                    .origin
                    .grant
                    .generation += 1
            }
            14 => r
                .checks
                .creation
                .as_mut()
                .unwrap()
                .content_items
                .values_mut()
                .next()
                .unwrap()
                .payload
                .bytes
                .push(0),
            15 => r.operation.fresh[0].attributed_source = ActorId::new(),
            16 => r.operation.fresh.push(r.operation.fresh[0].clone()),
            _ => {
                r.checks.content_items.remove(&operation.fresh[0].key);
            }
        }
        refuse_history(h.clone(), records);
    }
    reopen(&mut f);
    f.agent();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation.clone()), &mut f.ports)
            .unwrap()
            .operation,
        operation.id
    );
}

#[test]
fn accepted_but_unacknowledged_fresh_record_recovers_without_reallocation_or_recharging() {
    let mut f = Fixture::new();
    let (operation, _) = fresh_finding(&mut f);
    f.agent();
    let before = f.ports.records.len();
    let mut ports = Uncertain {
        inner: &mut f.ports,
        cut: OutcomeCut::AfterCommit,
        calls: 0,
    };
    assert_eq!(
        f.pursuit.execute(
            fixture::operation_request_for(
                &f.identity,
                &ports.inner.context.authority,
                operation.clone()
            ),
            &mut ports
        ),
        Err(OperationRequestError::Indeterminate)
    );
    assert_eq!(ports.inner.records.len(), before + 1);
    assert_eq!(ports.inner.created.len(), 1);
    assert_eq!(
        f.pursuit.execute(
            fixture::operation_request_for(
                &f.identity,
                &ports.inner.context.authority,
                operation.clone()
            ),
            &mut ports
        ),
        Err(OperationRequestError::Fenced)
    );
    reopen(&mut f);
    f.agent();
    let expected = f.ports.records.last().unwrap().accepted.clone();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation), &mut f.ports),
        Ok(expected)
    );
    assert_eq!(f.ports.created.len(), 1);
    assert_eq!(f.ports.records.len(), before + 1);
}

#[test]
fn restoration_keeps_unmatched_decisions_stale_grounds_revision_and_original_action_accountability()
{
    let mut f = Fixture::new();
    f.initiate();
    let dependency = f.dependency();
    let p = f.proposal(None, vec![]);
    let a = f.retain_proposal(&p);
    let adopted = f.adopt(&p, vec![dependency.clone()]);
    let changed = Dependency {
        ground: dependency.ground.clone(),
        version: GroundVersion::new(),
    };
    f.ports
        .grounds
        .insert(changed.ground.clone(), changed.version.clone());
    f.undertake(&p, &a, vec![]);
    assert_eq!(f.status().current_agreement, None);
    reopen(&mut f);
    assert_eq!(f.status().current_agreement, None);
    f.execute(Command::Reaffirm {
        decision: adopted.id,
        dependencies: vec![changed],
        assessment: None,
    })
    .unwrap();
    let (spec, action) = f.action(&p);
    f.agent();
    let admission = op(&f, Command::Admit(action.clone()));
    let admitted = f
        .pursuit
        .execute(f.operation_request(admission.clone()), &mut f.ports)
        .unwrap();
    f.execute(Command::Dispatch {
        action: action.id.clone(),
    })
    .unwrap();
    let mut queued = action.clone();
    queued.id = ActionId::new();
    f.execute(Command::Admit(queued.clone())).unwrap();
    let mut revision = f.proposal(Some(p.agreement.clone()), vec![]);
    revision.terms.criteria.clear();
    let assessment = f.retain_proposal(&revision);
    f.adopt(&revision, vec![]);
    f.execute(Command::SetGrant {
        id: action.grant.id.clone(),
        expected_generation: Some(1),
        spec,
    })
    .unwrap();
    reopen(&mut f);
    assert_eq!(f.status().current_agreement, Some(p.agreement.clone()));
    f.undertake(&revision, &assessment, vec![]);
    f.owner();
    f.execute(Command::RevokeGrant {
        id: action.grant.id.clone(),
        expected_generation: 2,
    })
    .unwrap();
    reopen(&mut f);
    assert_eq!(
        f.status().current_agreement,
        Some(revision.agreement.clone())
    );
    let empty = f.fulfillment(&revision);
    assert_eq!(f.execute(Command::Fulfill(empty)), Err(Error::Invalid));
    let reason = f.text("withdraw without hiding the dispatched action");
    f.execute(Command::Withdraw { reason }).unwrap();
    reopen(&mut f);
    f.agent();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(admission), &mut f.ports),
        Ok(admitted)
    );
    assert_eq!(
        f.execute(Command::Dispatch { action: queued.id }),
        Err(Error::Terminal)
    );
    f.owner();
    let Read::Action(original) = f
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
    assert_eq!(original.request, action);
    assert_eq!(original.phase, ActionPhase::Dispatched);
    let mut reconcile = f.draft_spec(std::collections::BTreeSet::from([GrantAction::Reconcile]));
    reconcile.target =
        GrantTarget::Reconciliation(std::collections::BTreeSet::from([action.id.clone()]));
    let grant = f.grant(reconcile);
    f.agent();
    f.execute(Command::Reconcile {
        action: action.id.clone(),
        grant,
        evidence: f.ports.native_evidence.clone(),
        outcome: ActionOutcome::ReportedPartial,
    })
    .unwrap();
    reopen(&mut f);
    assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
    let Read::Action(original) = f
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
    assert_eq!(original.request, action);
    assert_eq!(original.phase, ActionPhase::Reconciled);
    assert_eq!(original.outcome, ActionOutcome::ReportedPartial);
}

#[test]
fn reconstruction_validates_original_native_and_scope_judgments_not_new_observations() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let (_, action) = f.action(&p);
    f.agent();
    f.execute(Command::Admit(action.clone())).unwrap();
    let adaptation = Adaptation {
        agreement: p.agreement.clone(),
        previous_approach: p.terms.context.first().unwrap().content.clone(),
        changed_approach: f.text("a supported alternate approach"),
        grounds: f.ports.native_evidence.clone(),
        discretion: ScopeId::new(),
    };
    f.owner();
    f.execute(Command::Adapt {
        adaptation,
        access: Access::Owner,
    })
    .unwrap();
    let h = head(&f);
    let original = f.ports.records.clone();
    for kind in 0..10 {
        let mut records = original.clone();
        let length = records.len();
        match kind {
            0 => records[length - 2].checks.native = None,
            1 => records[length - 2].checks.native.as_mut().unwrap().1.action = ActionId::new(),
            2 => {
                records[length - 2]
                    .checks
                    .native
                    .as_mut()
                    .unwrap()
                    .0
                    .native_action = NativeActionId::new()
            }
            3 => records[length - 2]
                .checks
                .native
                .as_mut()
                .unwrap()
                .1
                .evidence
                .clear(),
            4 => records[length - 1].checks.adaptation = None,
            5 => {
                records[length - 1].checks.adaptation.as_mut().unwrap().1 =
                    ScopeJudgment::RequiresRevision
            }
            6 => {
                records[length - 1].checks.adaptation.as_mut().unwrap().1 =
                    ScopeJudgment::Unavailable
            }
            7 => {
                records[length - 1]
                    .checks
                    .adaptation
                    .as_mut()
                    .unwrap()
                    .0
                    .discretion = ScopeId::new()
            }
            8 => records[0].checks.native = records[length - 2].checks.native.clone(),
            _ => records[0].checks.adaptation = records[length - 1].checks.adaptation.clone(),
        }
        refuse_history(h.clone(), records);
    }
    f.ports.scope_judgment = ScopeJudgment::Unavailable;
    f.ports.native_evidence.clear();
    reopen(&mut f);
    assert_eq!(f.status().current_agreement, Some(p.agreement));
    let Read::Action(restored) = f
        .pursuit
        .read(Query::Action(action.id), Access::Owner, &mut f.ports)
        .unwrap()
    else {
        panic!("action")
    };
    assert_eq!(restored.phase, ActionPhase::Admitted);
}

#[test]
fn reconstruction_preserves_empty_drafts_and_nonvacuous_settlement_rules() {
    let mut f = Fixture::new();
    f.initiate();
    let mut draft = f.proposal(None, vec![]);
    draft.terms.binding.clear();
    draft.terms.criteria.clear();
    f.retain_proposal(&draft);
    reopen(&mut f);
    assert_eq!(
        f.execute(Command::Decide(Decision {
            id: DecisionId::new(),
            proposal: draft.id,
            kind: DecisionKind::Adopt,
            dependencies: vec![]
        })),
        Err(Error::Invalid)
    );
    let mut p = f.proposal(None, vec![]);
    p.terms.criteria.clear();
    let a = f.retain_proposal(&p);
    f.undertake(&p, &a, vec![]);
    f.adopt(&p, vec![]);
    reopen(&mut f);
    assert_eq!(
        f.execute(Command::Fulfill(f.fulfillment(&p))),
        Err(Error::Invalid)
    );
    let revision = f.proposal(Some(p.agreement), vec![]);
    let a = f.retain_proposal(&revision);
    f.adopt(&revision, vec![]);
    f.undertake(&revision, &a, vec![]);
    f.owner();
    f.execute(Command::Fulfill(f.fulfillment(&revision)))
        .unwrap();
    reopen(&mut f);
    assert_eq!(
        f.status().settlement,
        Some(Settlement::Fulfilled(revision.agreement))
    );
    let reason = f.text("no reopening after reconstruction");
    assert_eq!(
        f.execute(Command::Withdraw { reason }),
        Err(Error::Terminal)
    );
}

// Models the information needed at an atomic Ledger-wide cut by scanning accepted envelopes,
// not a separate ID authority/registry. Real SQL transactions/cross-Change constraints are adapter tests.
struct CollisionPort<'a> {
    inner: &'a mut FixturePorts,
    other: &'a [StoredOperation],
}
impl Ports for CollisionPort<'_> {
    fn context(&mut self) -> Result<Context> {
        self.inner.context()
    }
    fn resolve_content(
        &mut self,
        checks: &Checks,
        request: &IntakeRequest,
    ) -> Result<ContentObservation> {
        self.inner.resolve_content(checks, request)
    }
    fn authorize_intake(&mut self, checks: &Checks, operation: &Operation) -> Result<()> {
        self.inner.authorize_intake(checks, operation)
    }
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion> {
        self.inner.ground(id)
    }
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment> {
        self.inner.discretion(adaptation)
    }
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions> {
        self.inner.native_conditions(action)
    }
    fn accept(&mut self, record: &StoredOperation) -> Acceptance {
        assert!(self.other.iter().all(|old| old.checks.identity.owner
            == record.checks.identity.owner
            && old.checks.identity.ledger == record.checks.identity.ledger));
        for old in self.other {
            // Exactly eight entity kinds are Change-local. Content protection is independent.
            if old.checks.identity.change_key() == record.checks.identity.change_key()
                && old.creations.iter().any(|claim| match claim {
                    CreatedIdentity::Operation(_)
                    | CreatedIdentity::Proposal(_)
                    | CreatedIdentity::Agreement(_)
                    | CreatedIdentity::Assessment(_)
                    | CreatedIdentity::Decision(_)
                    | CreatedIdentity::Grant(_)
                    | CreatedIdentity::Action(_)
                    | CreatedIdentity::Criterion(_) => record.creations.contains(claim),
                })
            {
                return Acceptance::Refused(Error::Conflict);
            }
            for key in &record.establishments {
                if old.establishments.contains(key) {
                    return Acceptance::Refused(Error::Conflict);
                }
            }
            for id in &record.retained_content_items {
                if old
                    .checks
                    .content_items
                    .get(id)
                    .is_some_and(|original| Some(original) != record.checks.content_items.get(id))
                {
                    return Acceptance::Refused(Error::Conflict);
                }
            }
        }
        self.inner.accept(record)
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        self.inner.disclose(checks)
    }
}
fn second_change(first: &Fixture) -> Fixture {
    let mut second = Fixture::new();
    second.identity = Identity {
        change: second.identity.change.clone(),
        ..first.identity.clone()
    };
    second.pursuit = Change::try_new(second.identity.clone()).unwrap();
    second.ports.context.disclosure =
        std::collections::BTreeSet::from([ReadScope::Change(second.identity.change.clone())]);
    second.owner();
    second
}

#[test]
fn creation_claims_distinguish_cross_change_retention_from_fresh_collision_and_typed_ids() {
    let mut first = Fixture::new();
    let content = first.text("shared immutable source");
    let operation = op(
        &first,
        Command::Initiate {
            wish: content.clone(),
            access: Access::Owner,
        },
    );
    first
        .pursuit
        .execute(first.operation_request(operation.clone()), &mut first.ports)
        .unwrap();
    let mut second = second_change(&first);
    // Equal bytes and another Change's key do NOT admit foreign provenance.
    let foreign = second.operation(
        OperationId::new(),
        Command::Initiate {
            wish: content.clone(),
            access: Access::Owner,
        },
        vec![],
    );
    second
        .ports
        .content_items
        .insert(content.clone(), b"shared immutable source".to_vec());
    let mut ports = CollisionPort {
        inner: &mut second.ports,
        other: &first.ports.records,
    };
    assert_eq!(
        second.pursuit.execute(
            fixture::operation_request_for(
                &second.identity,
                &ports.inner.context.authority,
                foreign
            ),
            &mut ports
        ),
        Err(OperationRequestError::Refused(Error::Unavailable))
    );
    assert!(ports.inner.records.is_empty());
    // The same raw leaf is independent in this Change's namespace. Explicitly observed
    // pre-existing/unbound here; byte equality is not used to prove derivation or reuse.
    let local = ContentKey {
        establishing: second.identity.change_key(),
        id: content.id.clone(),
    };
    second
        .ports
        .content_items
        .insert(local.clone(), b"independent local input".to_vec());
    second.ports.inputs.borrow_mut().insert(
        local.clone(),
        ContentObservation {
            bytes: b"independent local input".to_vec(),
            source_claim: fixture::unbound_source(),
        },
    );
    let mut independent = op(
        &second,
        Command::Initiate {
            wish: local.clone(),
            access: Access::Owner,
        },
    );
    independent.id = OperationId::from_bytes(*content.id.as_bytes()).unwrap();
    let mut ports = CollisionPort {
        inner: &mut second.ports,
        other: &first.ports.records,
    };
    second
        .pursuit
        .execute(
            fixture::operation_request_for(
                &second.identity,
                &ports.inner.context.authority,
                independent,
            ),
            &mut ports,
        )
        .unwrap();
    let retained = ports.inner.records.last().unwrap();
    assert_eq!(
        retained.establishments,
        std::collections::BTreeSet::from([local.clone()])
    );
    assert!(retained.retained_content_items.contains(&local));
    assert!(!retained.establishments.contains(&content));
    reopen(&mut second);
    assert!(second.status().initiated);
    // Entity OperationId collision across Changes remains independent as well.
    let mut third = second_change(&first);
    let wish = third.text("separate draft");
    let mut independent = op(
        &third,
        Command::Initiate {
            wish,
            access: Access::Owner,
        },
    );
    independent.id = operation.id;
    let mut ports = CollisionPort {
        inner: &mut third.ports,
        other: &first.ports.records,
    };
    third
        .pursuit
        .execute(
            fixture::operation_request_for(
                &third.identity,
                &ports.inner.context.authority,
                independent,
            ),
            &mut ports,
        )
        .unwrap();
}

#[test]
fn exact_criterion_reuse_and_grant_generation_changes_are_not_new_identity_claims() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let mut revision = f.proposal(Some(p.agreement), vec![]);
    revision.terms = p.terms;
    let a = f.retain_proposal(&revision);
    let proposal_record = f
        .ports
        .records
        .iter()
        .find(|r| r.operation.id == f.proposal_operations[&revision.id])
        .unwrap();
    assert!(proposal_record
        .creations
        .contains(&CreatedIdentity::Proposal(revision.id.clone())));
    assert!(revision.terms.criteria.iter().all(|c| !proposal_record
        .creations
        .contains(&CreatedIdentity::Criterion(c.id.clone()))));
    f.adopt(&revision, vec![]);
    f.undertake(&revision, &a, vec![]);
    let (spec, action) = f.action(&revision);
    let grant_record = f.ports.records.last().unwrap();
    assert!(grant_record
        .creations
        .contains(&CreatedIdentity::Grant(action.grant.id.clone())));
    f.execute(Command::SetGrant {
        id: action.grant.id.clone(),
        expected_generation: Some(1),
        spec,
    })
    .unwrap();
    assert!(!f
        .ports
        .records
        .last()
        .unwrap()
        .creations
        .contains(&CreatedIdentity::Grant(action.grant.id.clone())));
    reopen(&mut f);
    f.execute(Command::RevokeGrant {
        id: action.grant.id.clone(),
        expected_generation: 2,
    })
    .unwrap();
    reopen(&mut f);
    let count = f.ports.records.len();
    f.agent();
    assert_eq!(f.execute(Command::Admit(action)), Err(Error::Denied));
    assert_eq!(f.ports.records.len(), count);
}

#[test]
fn stale_instance_cannot_publish_a_candidate_just_because_its_operation_id_exists() {
    let mut f = Fixture::new();
    let wish = f.text("the actual original request");
    let operation = op(
        &f,
        Command::Initiate {
            wish,
            access: Access::Owner,
        },
    );
    f.pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    let reason = f.text("a later accepted settlement");
    f.execute(Command::Withdraw { reason }).unwrap();
    let count = f.ports.records.len();
    let mut stale = Change::try_new(f.identity.clone()).unwrap();
    assert_eq!(
        stale.execute(f.operation_request(operation), &mut f.ports),
        // Current source now identifies the established object; stale first-retention
        // cannot relabel it unbound. This is a refusal, not original-outcome knowledge.
        Err(OperationRequestError::Refused(Error::Conflict))
    );
    assert_eq!(f.ports.records.len(), count);
    assert_eq!(
        stale.read(Query::Status, Access::Owner, &mut f.ports),
        Err(Error::Stale)
    );
    assert_eq!(f.status().settlement, Some(Settlement::Withdrawn));
}

#[test]
fn denied_original_lookup_is_a_refusal_not_evidence_of_noncommit() {
    let mut f = Fixture::new();
    let wish = f.text("an already accepted request");
    let operation = op(
        &f,
        Command::Initiate {
            wish,
            access: Access::Owner,
        },
    );
    let accepted = f
        .pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    reopen(&mut f);
    f.ports.context.disclosure.clear();
    assert_eq!(
        f.pursuit.record(&operation.id, &mut f.ports),
        Err(Error::Denied)
    );
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation.clone()), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Denied))
    );
    assert_eq!(f.ports.records.len(), 1);
    f.ports
        .context
        .disclosure
        .insert(ReadScope::Change(f.identity.change.clone()));
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation), &mut f.ports),
        Ok(accepted)
    );
    assert_eq!(f.ports.records.len(), 1);
}

#[test]
fn denied_accepted_retry_source_and_port_refusals_never_assert_noncommit() {
    let mut f = Fixture::new();
    let wish = f.text("a committed source");
    let operation = op(
        &f,
        Command::Initiate {
            wish: wish.clone(),
            access: Access::Owner,
        },
    );
    let accepted = f
        .pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    reopen(&mut f);
    f.ports.denied_content_items.insert(wish);
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation.clone()), &mut f.ports),
        Err(OperationRequestError::Refused(Error::Denied))
    );
    assert_eq!(f.ports.records.len(), 1);
    f.ports.denied_content_items.clear();
    assert_eq!(
        f.pursuit
            .execute(f.operation_request(operation), &mut f.ports),
        Ok(accepted)
    );

    for race in [Race::Context, Race::Prefix, Race::CreationSource] {
        let mut f = Fixture::new();
        let (operation, _) = fresh_finding(&mut f);
        f.agent();
        let context = f.ports.context.clone();
        let prefix = f.ports.last_operation.clone();
        let sources = f.ports.creation_sources.clone();
        f.ports.race = Some(race);
        let error = f
            .pursuit
            .execute(f.operation_request(operation.clone()), &mut f.ports)
            .unwrap_err();
        assert!(matches!(
            error,
            OperationRequestError::Refused(Error::Stale | Error::Denied)
        ));
        assert!(!f.ports.accepted.contains_key(&operation.id));
        f.ports.context = context;
        f.ports.last_operation = prefix;
        f.ports.creation_sources = sources;
        // A refused lookup/append is not permission to resubmit. Only a trusted reopen plus
        // an authorized original-ID resolution against the complete prefix establishes absence.
        reopen(&mut f);
        assert_eq!(
            f.pursuit.record(&operation.id, &mut f.ports),
            Err(Error::Denied)
        );
        f.owner();
        assert_eq!(f.pursuit.record(&operation.id, &mut f.ports), Ok(None));
        f.agent();
        f.pursuit
            .execute(f.operation_request(operation), &mut f.ports)
            .unwrap();
        assert_eq!(f.ports.created.len(), 1);
    }
}
