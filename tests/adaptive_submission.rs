//! Current declaration/coherence boundaries; fixture authority is not host authentication.
use changekernel::{adapters::codec::*, unqualified_pursuit::*};
#[path = "adaptive_pursuit/fixture.rs"]
#[allow(dead_code)]
mod fixture;
use fixture::*;
use std::collections::BTreeSet;

#[derive(Default, Debug, PartialEq, Eq)]
struct Calls {
    context: usize,
    material: usize,
    creation: usize,
    native: usize,
    accept: usize,
    disclose: usize,
}
struct Counted<'a> {
    inner: &'a mut FixturePorts,
    calls: Calls,
}
impl Ports for Counted<'_> {
    fn context(&mut self) -> Result<Context> {
        self.calls.context += 1;
        self.inner.context()
    }
    fn material(&mut self, id: &MaterialId) -> Result<Vec<u8>> {
        self.calls.material += 1;
        self.inner.material(id)
    }
    fn authorize_creation(&mut self, checks: &Checks, operation: &Operation) -> Result<()> {
        self.calls.creation += 1;
        self.inner.authorize_creation(checks, operation)
    }
    fn ground(&mut self, id: &GroundId) -> Result<GroundVersion> {
        self.inner.ground(id)
    }
    fn discretion(&mut self, adaptation: &Adaptation) -> Result<ScopeJudgment> {
        self.inner.discretion(adaptation)
    }
    fn native_conditions(&mut self, action: &ActionRequest) -> Result<NativeConditions> {
        self.calls.native += 1;
        self.inner.native_conditions(action)
    }
    fn accept(&mut self, record: &StoredOperation) -> Acceptance {
        self.calls.accept += 1;
        self.inner.accept(record)
    }
    fn disclose(&mut self, checks: &Checks) -> Result<()> {
        self.calls.disclose += 1;
        self.inner.disclose(checks)
    }
}
fn initiate(f: &mut Fixture) -> Submission {
    let wish = f.text("declared original");
    f.submission(Operation {
        id: OperationId::new(),
        command: Command::Initiate {
            wish,
            access: Access::Owner,
        },
        fresh: vec![],
    })
}

#[test]
fn declaration_tampering_is_not_repaired_and_cannot_reach_native_or_acceptance() {
    for mutation in 0..9 {
        let mut f = Fixture::new();
        let (proposal, _) = f.agree();
        let (_, action) = f.action(&proposal);
        f.agent();
        let original = f.submission(Operation {
            id: OperationId::new(),
            command: Command::Admit(action),
            fresh: vec![],
        });
        let mut wrong = original.clone();
        match mutation {
            0 => wrong.target.owner = OwnerId::new(),
            1 => wrong.target.ledger = LedgerId::new(),
            2 => wrong.target.change = ChangeId::new(),
            3 => wrong.profile.codec = 1,
            4 => wrong.profile.schema = 1,
            5 => wrong.profile.semantic = 1,
            6 => wrong.profile.codec = u32::MAX,
            7 => wrong.actor = ActorId::new(),
            8 => wrong.represented_owner = OwnerId::new(),
            _ => unreachable!(),
        }
        // Current-format decoding must preserve even an unauthenticated wrong declaration.
        if wrong.profile.is_current() {
            wrong = decode_request(&encode_request(&wrong).unwrap()).unwrap();
        }
        let before = f.ports.records.len();
        let mut ports = Counted {
            inner: &mut f.ports,
            calls: Calls::default(),
        };
        let error = if mutation < 7 {
            Error::Conflict
        } else {
            Error::Denied
        };
        assert_eq!(
            f.pursuit.execute(wrong, &mut ports),
            Err(SubmissionError::Refused(error))
        );
        assert_eq!(
            ports.calls,
            Calls {
                context: usize::from(mutation >= 7),
                ..Calls::default()
            }
        );
        assert_eq!(ports.inner.records.len(), before);
        f.pursuit.execute(original, &mut ports).unwrap();
        assert_eq!(ports.calls.context, usize::from(mutation >= 7) + 1);
        assert_eq!(ports.calls.native, 1);
        assert_eq!(ports.calls.accept, 1);
        assert_eq!(ports.inner.records.len(), before + 1);
    }
}

#[test]
fn rejected_fresh_declaration_never_authorizes_creation_or_reserves_original() {
    let mut f = Fixture::new();
    f.initiate();
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    spec.creation = Some(MaterialLimits {
        items: 1,
        payload_bytes: 32,
    });
    let grant = f.grant(spec);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.owner_actor.clone(),
    ));
    let payload = FreshMaterial {
        id: MaterialId::new(),
        bytes: b"retained".to_vec(),
        attributed_source: f.identity.owner_actor.clone(),
    };
    f.agent();
    let original = f.submission(Operation {
        id: OperationId::new(),
        command: Command::Finding {
            finding: Finding {
                agreement: None,
                claim: payload.id.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Grant(grant),
        },
        fresh: vec![payload],
    });
    let mut wrong = original.clone();
    wrong.actor = ActorId::new();
    let count = f.ports.records.len();
    let mut ports = Counted {
        inner: &mut f.ports,
        calls: Calls::default(),
    };
    assert_eq!(
        f.pursuit.execute(wrong, &mut ports),
        Err(SubmissionError::Refused(Error::Denied))
    );
    assert_eq!(
        ports.calls,
        Calls {
            context: 1,
            ..Calls::default()
        }
    );
    assert_eq!(ports.inner.records.len(), count);
    assert!(ports.inner.created.is_empty());
    f.pursuit.execute(original, &mut ports).unwrap();
    assert_eq!(ports.calls.context, 2);
    assert_eq!(ports.calls.creation, 1);
    assert_eq!(ports.calls.accept, 1);
    assert_eq!(ports.inner.created.len(), 1);
}

#[test]
fn current_restore_recovers_complete_original_and_can_continue_without_recharge() {
    let mut f = Fixture::new();
    let original = initiate(&mut f);
    let encoded_request = encode_request(&original).unwrap();
    let accepted = f.pursuit.execute(original.clone(), &mut f.ports).unwrap();
    let saved = f.ports.records[0].clone();
    assert_eq!(saved.submission().unwrap(), original);
    let decoded = decode_record(&encode_record(&saved).unwrap()).unwrap();
    assert_eq!(decoded.profile, original.profile);
    assert_eq!(
        decoded.submission().unwrap(),
        decode_request(&encoded_request).unwrap()
    );
    let head = HistoryHead {
        profile: saved.profile,
        identity: f.identity.clone(),
        accepted_operations: 1,
        last_operation: Some(saved.operation.id.clone()),
    };
    f.pursuit = Pursuit::reconstruct(head, vec![decoded]).unwrap();
    let mut ports = Counted {
        inner: &mut f.ports,
        calls: Calls::default(),
    };
    assert_eq!(f.pursuit.execute(original, &mut ports), Ok(accepted));
    assert_eq!(ports.calls.context, 1);
    assert_eq!(ports.calls.accept, 0);
    assert_eq!(ports.calls.creation, 0);
    assert_eq!(ports.inner.records.len(), 1);
    let reason = MaterialId::new();
    ports
        .inner
        .materials
        .insert(reason.clone(), b"stop current original".to_vec());
    let next = submission_for(
        &f.identity,
        &ports.inner.context.authority,
        Operation {
            id: OperationId::new(),
            command: Command::Withdraw { reason },
            fresh: vec![],
        },
    );
    f.pursuit.execute(next, &mut ports).unwrap();
    assert_eq!(ports.calls.accept, 1);
    assert_eq!(ports.inner.records.len(), 2);
}

#[test]
fn retained_profile_and_record_coherence_never_default_to_current_constants() {
    let mut f = Fixture::new();
    let original = initiate(&mut f);
    f.pursuit.execute(original.clone(), &mut f.ports).unwrap();
    let saved = f.ports.records[0].clone();
    for mutation in 0..8 {
        let mut record = saved.clone();
        match mutation {
            0 => record.profile.codec = 1,
            1 => record.profile.schema = 1,
            2 => record.profile.semantic = 1,
            3 => record.accepted.actor = ActorId::new(),
            4 => record.accepted.represented_owner = OwnerId::new(),
            5 => record.accepted.operation = OperationId::new(),
            6 => record.checks.context.authority.represented_owner = OwnerId::new(),
            7 => record.checks.identity.change = ChangeId::new(),
            _ => unreachable!(),
        }
        if mutation < 3 {
            assert_eq!(record.submission().unwrap().profile, record.profile);
            assert_ne!(record.submission().unwrap().profile, CURRENT_PROFILE);
            assert_eq!(encode_record(&record), Err(CodecError::Version));
        } else if mutation < 7 {
            assert_eq!(record.submission(), Err(Error::Invalid));
        }
        let head = HistoryHead {
            profile: saved.profile,
            identity: f.identity.clone(),
            accepted_operations: 1,
            last_operation: Some(saved.operation.id.clone()),
        };
        assert!(Pursuit::reconstruct(head, vec![record]).is_err());
    }
    for mutation in 0..3 {
        let mut head = HistoryHead {
            profile: saved.profile,
            identity: f.identity.clone(),
            accepted_operations: 1,
            last_operation: Some(saved.operation.id.clone()),
        };
        match mutation {
            0 => head.profile.codec = 1,
            1 => head.profile.schema = 1,
            2 => head.profile.semantic = 1,
            _ => unreachable!(),
        }
        assert!(Pursuit::reconstruct(head, vec![saved.clone()]).is_err());
    }
    assert_eq!(saved.submission().unwrap(), original);
}

#[test]
fn authenticated_actor_and_input_changes_conflict_without_an_extra_retry_namespace() {
    let mut f = Fixture::new();
    let original = initiate(&mut f);
    let accepted = f.pursuit.execute(original.clone(), &mut f.ports).unwrap();
    let mut changed = original.clone();
    changed.operation.command = Command::Withdraw {
        reason: match &original.operation.command {
            Command::Initiate { wish, .. } => wish.clone(),
            _ => unreachable!(),
        },
    };
    assert_eq!(
        f.pursuit.execute(changed, &mut f.ports),
        Err(SubmissionError::Refused(Error::Conflict))
    );
    f.agent();
    let mut changed_actor = original.clone();
    changed_actor.actor = f.identity.agent.clone();
    assert_eq!(
        f.pursuit.execute(changed_actor, &mut f.ports),
        Err(SubmissionError::Refused(Error::Conflict))
    );
    f.owner();
    assert_eq!(f.pursuit.execute(original, &mut f.ports), Ok(accepted));
    assert_eq!(f.ports.records.len(), 1);
}

#[test]
fn equal_change_keys_do_not_erase_full_participant_identity_checks() {
    let mut f = Fixture::new();
    f.initiate();
    let mut proposal = f.proposal(None, vec![]);
    proposal.identity.owner_actor = ActorId::new();
    assert_eq!(proposal.identity.change_key(), f.identity.change_key());
    let submission = f.submission(Operation {
        id: f.proposal_operations[&proposal.id].clone(),
        command: Command::Propose {
            proposal,
            access: Access::Owner,
        },
        fresh: vec![],
    });
    let count = f.ports.records.len();
    assert_eq!(
        f.pursuit.execute(submission, &mut f.ports),
        Err(SubmissionError::Refused(Error::Stale))
    );
    assert_eq!(f.ports.records.len(), count);
}
