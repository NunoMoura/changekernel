use super::support;
use changekernel::adapters::sqlite::{
    Original, OriginalOutcome, PreparedOperationRequest, StoreError,
};
use changekernel::unqualified_change::{
    Access, Attribution, BindingKnowledge, Command, ContentId, ContentKey, ContentLimits,
    ContentObservation, ContextVersion, Disposition, Error, Evidence, Finding, FreshContent,
    GrantId, GrantUse, InputKind, Operation, OperationId, OperationRequest, OperationRequestError,
    OriginSelector, Query, SourceClaim, CURRENT_PROFILE,
};
use std::fs;
#[test]
fn whole_intake_denial_at_final_guard_prevents_append_and_refusal_is_not_lookup_knowledge() {
    let (mut original, id, _, local, _) = super::included("final-intake-denial");
    let request = support::grant(&id, 92);
    {
        let mut inputs = local.0.lock().unwrap();
        inputs.deny_on_authorize = Some(inputs.authorize_calls + 2);
    }
    assert_eq!(
        original.submit(&request),
        Err(OperationRequestError::Refused(Error::Denied))
    );
    assert_eq!(
        original.resolve_original(&request).unwrap(),
        OriginalOutcome::NotAccepted
    );
    local.0.lock().unwrap().deny_on_authorize = None;
    let accepted = original.submit(&request).unwrap();
    local.0.lock().unwrap().disclosure = false;
    assert!(matches!(
        original.resolve_original(&request),
        Err(StoreError::Refused(Error::Denied))
    ));
    local.0.lock().unwrap().disclosure = true;
    assert_eq!(
        original.resolve_original(&request).unwrap(),
        OriginalOutcome::Accepted(accepted)
    );
}
#[test]
fn qualified_fresh_origin_first_retention_retry_and_revocation_survive_restart() {
    use std::collections::BTreeSet;
    let (mut original, id, reference, local, _) = super::included("fresh-origin");
    let grant_id = GrantId::from_bytes([93; 16]).unwrap();
    let used = GrantUse {
        id: grant_id.clone(),
        generation: 1,
    };
    let mut declaration = support::grant(&id, 93).operation_request().clone();
    if let Command::SetGrant { spec, .. } = &mut declaration.operation.command {
        spec.creation = Some(ContentLimits {
            items: 1,
            payload_bytes: 1024,
        });
        spec.content_origins.insert(OriginSelector::CurrentGrant);
        spec.disclosure_origins.insert(OriginSelector::CurrentGrant);
    }
    original
        .submit(&PreparedOperationRequest::from_operation_request(&declaration).unwrap())
        .unwrap();
    let key = ContentKey {
        establishing: id.change_key(),
        id: ContentId::from_bytes([94; 16]).unwrap(),
    };
    let bytes = b"agent's original local output".to_vec();
    {
        let mut inputs = local.0.lock().unwrap();
        inputs.context.version = ContextVersion::from_bytes([10; 16]).unwrap();
        inputs.context.authority.actor = id.agent.clone();
        inputs.context.authority.owner_control = None;
        inputs.context.authority.agent_role = Some(id.clone());
        inputs.sources.insert(
            key.clone(),
            ContentObservation {
                bytes: bytes.clone(),
                source_claim: SourceClaim {
                    input_kind: InputKind::NewContribution,
                    binding_knowledge: BindingKnowledge::NoKnownBinding,
                    attribution: Attribution::Actor(id.agent.clone()),
                    limitations: b"fixture output claim".to_vec(),
                },
            },
        );
    }
    let operation_request = OperationRequest {
        profile: CURRENT_PROFILE,
        target: id.change_key(),
        actor: id.agent.clone(),
        represented_owner: id.owner.clone(),
        operation: Operation {
            id: OperationId::from_bytes([95; 16]).unwrap(),
            command: Command::Finding {
                finding: Finding {
                    agreement: None,
                    claim: key.clone(),
                    evidence: vec![Evidence {
                        source: id.agent.clone(),
                        content: key.clone(),
                        limitations: key.clone(),
                    }],
                    disposition: Disposition::Unknown,
                },
                access: Access::Grant(used.clone()),
            },
            fresh: vec![FreshContent {
                key: key.clone(),
                derived_from: BTreeSet::new(),
                bytes,
                attributed_source: id.agent.clone(),
            }],
            first_retention: BTreeSet::new(),
        },
    };
    let retained = PreparedOperationRequest::from_operation_request(&operation_request).unwrap();
    let first = original.submit(&retained).unwrap();
    drop(original);
    let mut reopened = Original::open(&reference, local.clone(), &super::root()).unwrap();
    assert_eq!(
        reopened.resolve_original(&retained).unwrap(),
        OriginalOutcome::Accepted(first.clone())
    );
    {
        let mut i = local.0.lock().unwrap();
        i.context.version = ContextVersion::from_bytes([11; 16]).unwrap();
        i.context.authority.actor = id.owner_actor.clone();
        i.context.authority.owner_control = Some(id.clone());
        i.context.authority.agent_role = None;
    }
    let revoke = PreparedOperationRequest::from_operation_request(&OperationRequest {
        profile: CURRENT_PROFILE,
        target: id.change_key(),
        actor: id.owner_actor.clone(),
        represented_owner: id.owner.clone(),
        operation: Operation {
            id: OperationId::from_bytes([96; 16]).unwrap(),
            command: Command::RevokeGrant {
                id: grant_id,
                expected_generation: 1,
            },
            fresh: vec![],
            first_retention: BTreeSet::new(),
        },
    })
    .unwrap();
    reopened.submit(&revoke).unwrap();
    {
        let mut i = local.0.lock().unwrap();
        i.context.version = ContextVersion::from_bytes([12; 16]).unwrap();
        i.context.authority.actor = id.agent.clone();
        i.context.authority.owner_control = None;
        i.context.authority.agent_role = Some(id);
    }
    assert_eq!(
        reopened.resolve_original(&retained).unwrap(),
        OriginalOutcome::Accepted(first)
    );
    assert!(matches!(
        reopened.read(Query::Content(key), Access::Grant(used)),
        Err(StoreError::Refused(Error::Denied))
    ));
}
#[test]
fn final_callback_custody_loss_blocks_read_retry_and_proven_absence() {
    for lookup in ["read", "accepted", "negative", "retry"] {
        for damage in ["wal", "control"] {
            let (mut original, id, _, local, path) = super::included("final-disclosure-cut");
            let request = support::grant(&id, 101);
            if lookup != "negative" {
                original.submit(&request).unwrap();
            }
            local.0.lock().unwrap().disclose_hook = Some(Box::new(move |_| {
                let name = if damage == "wal" {
                    "ledger.sqlite-wal"
                } else {
                    "custody.ctrl"
                };
                fs::rename(
                    path.join(name),
                    path.join(format!("preserved-callback-{name}")),
                )
                .unwrap();
            }));
            let denied = match lookup {
                "read" => original.read(Query::Status, Access::Owner).is_err(),
                "retry" => original.submit(&request).is_err(),
                _ => original.resolve_original(&request).is_err(),
            };
            assert!(denied, "{lookup} disclosed after {damage} loss");
            assert!(matches!(
                original.passive_checkpoint(),
                Err(StoreError::Fenced)
            ));
        }
    }
}
#[test]
fn resolve_permission_is_reauthorized_in_the_final_guard_not_only_at_context_fetch() {
    for lookup in ["accepted", "negative", "retry"] {
        for stage in ["context", "disclose"] {
            let (mut original, id, _, local, _) = super::included("resolve-permission-cut");
            let request = support::grant(&id, 102);
            if lookup != "negative" {
                original.submit(&request).unwrap();
            }
            let identity = id.clone();
            let hook: Box<dyn FnOnce(&mut support::Inputs) + Send> = Box::new(move |inputs| {
                inputs.custody.remove(&support::Permit::Resolve(identity));
            });
            {
                let mut inputs = local.0.lock().unwrap();
                if stage == "context" {
                    inputs.context_hook = Some(hook)
                } else {
                    inputs.disclose_hook = Some(hook)
                }
            }
            let denied = if lookup == "retry" {
                matches!(
                    original.submit(&request),
                    Err(OperationRequestError::Refused(Error::Denied))
                )
            } else {
                matches!(
                    original.resolve_original(&request),
                    Err(StoreError::Refused(Error::Denied))
                )
            };
            assert!(denied, "{lookup} bypassed Resolve revoked in {stage}");
            assert!(original.read(Query::Status, Access::Owner).is_ok());
        }
    }
}
#[test]
fn close_with_maintain_but_without_current_verify_neither_copies_nor_claims_clean() {
    use std::os::unix::fs::DirBuilderExt;
    let (original, id, reference, local, path) = super::included("close-verify");
    drop(original);
    let verify = super::directory("close-verify-private");
    fs::DirBuilder::new().mode(0o700).create(&verify).unwrap();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .insert(support::Permit::Verify(verify.clone()));
    let original = Original::open(&reference, local.clone(), &verify).unwrap();
    let before = fs::read(path.join("custody.ctrl")).unwrap();
    let copies = fs::read_dir(&verify).unwrap().count();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Verify(verify.clone()));
    assert!(matches!(
        original.close(),
        Err(StoreError::Refused(Error::Denied))
    ));
    assert_eq!(fs::read(path.join("custody.ctrl")).unwrap(), before);
    assert_eq!(fs::read_dir(&verify).unwrap().count(), copies);
    assert!(path.join("ledger.sqlite-wal").exists());
    let _ = id;
}
