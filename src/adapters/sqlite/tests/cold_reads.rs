//! The read entry starts at the Included reference, never Original::open or a writer cache.
use super::super::cold_read::{read_local, read_local_framed};
use super::super::tests::{self, support};
use crate::adapters::codec;
use crate::application::read::{ChangeAnchor, ReadLimits, ReadRefusal, ReadReply};
use crate::application::read_budget::ReadWorkLimits;
use crate::application::read_call::{ReadCall, ReadValue};

#[test]
fn cold_entry_verifies_physical_original_without_lifecycle_or_source_mutation() {
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let before = support::native_snapshot(&path);
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits::default(),
    };
    let reply = read_local(
        &reference,
        &mut local,
        &root,
        &call,
        ReadWorkLimits::default(),
    );
    assert!(
        matches!(reply,ReadReply::Returned(ReadValue::Position(ref p)) if p.sequence==1),
        "{reply:?}"
    );
    assert_eq!(
        support::native_snapshot(&path),
        before,
        "no clean/opening/live publication, checkpoint, source SHM or SQL writes"
    );
    let request = codec::encode_read_call(&call).expect("call");
    let frame = read_local_framed(
        &reference,
        &mut local,
        &root,
        &request,
        ReadWorkLimits::default(),
    )
    .expect("framed read");
    assert_eq!(codec::decode_read_reply(&frame).expect("reply"), reply);
    assert_eq!(support::native_snapshot(&path), before);
}
#[test]
fn cold_denial_precedes_missing_source_and_work_limits_tighten_before_copy() {
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits::default(),
    };
    local.0.lock().expect("guard").history = false;
    std::fs::rename(path.join("ledger.sqlite"), path.join("preserved.sqlite"))
        .expect("own fault fixture");
    assert_eq!(
        read_local(
            &reference,
            &mut local,
            &root,
            &call,
            ReadWorkLimits::default()
        ),
        ReadReply::Refused(ReadRefusal::Denied)
    );
    // An exact membership in another namespace is not authority to probe this missing one.
    let mut foreign = id.clone();
    foreign.change = crate::kernel::change::ChangeId::from_bytes([99; 16]).expect("foreign Change");
    let foreign = ReadCall::Content {
        membership: crate::kernel::change::ContentReference {
            identity: foreign,
            operation: crate::kernel::change::OperationId::from_bytes([12; 16]).expect("op"),
            content: crate::kernel::change::ContentKey {
                establishing: id.change_key(),
                id: crate::kernel::change::ContentId::from_bytes([11; 16]).expect("content"),
            },
        },
        limits: ReadLimits::default(),
    };
    assert_eq!(
        read_local(
            &reference,
            &mut local,
            &root,
            &foreign,
            ReadWorkLimits::default()
        ),
        ReadReply::Refused(ReadRefusal::Denied)
    );
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits::default(),
    };
    let before = support::native_snapshot(&path);
    let work = ReadWorkLimits {
        source_bytes: 1,
        ..ReadWorkLimits::default()
    };
    assert_eq!(
        read_local(&reference, &mut local, &root, &call, work),
        ReadReply::Refused(ReadRefusal::Limit)
    );
    assert_eq!(support::native_snapshot(&path), before);
    assert!(matches!(
        read_local(
            &reference,
            &mut local,
            &root,
            &call,
            ReadWorkLimits::default()
        ),
        ReadReply::Returned(_)
    ));
}
#[test]
fn public_history_preserves_actual_counterpart_ground_version_that_prevented_activation() {
    use super::super::prepared_operation_request::PreparedOperationRequest;
    use crate::application::read::{ChangeRange, ReadChangeRequest, RecordSelection};
    use crate::kernel::change::{
        Access, AgreementId, Assessment, AssessmentId, Authority, Command, ContentReference,
        Decision, DecisionId, DecisionKind, Dependency, Effect, GroundId, GroundVersion,
        OperationId, Proposal, ProposalId, TermSelection, Terms,
    };
    use std::collections::BTreeSet;
    let (mut original, id, _, reference, mut local, root) = tests::provision();
    let first = &original.records[0];
    let wish = first
        .checks
        .content_items
        .keys()
        .next()
        .expect("wish")
        .clone();
    let member = ContentReference {
        identity: id.clone(),
        operation: first.operation.id.clone(),
        content: wish.clone(),
    };
    let mut request = support::grant(&id, 60).operation_request().clone();
    let proposal = Proposal {
        id: ProposalId::from_bytes([60; 16]).expect("id"),
        agreement: AgreementId::from_bytes([61; 16]).expect("id"),
        identity: id.clone(),
        expected_agreement: None,
        terms: Terms {
            binding: vec![TermSelection {
                statement: member,
                context: BTreeSet::new(),
            }],
            context: BTreeSet::new(),
            unknowns: vec![],
            criteria: vec![],
        },
        dependencies: vec![],
    };
    request.operation.command = Command::Propose {
        proposal: proposal.clone(),
        access: Access::Owner,
    };
    original
        .submit(&PreparedOperationRequest::from_operation_request(&request).expect("request"))
        .expect("proposal");
    let assessment = Assessment {
        id: AssessmentId::from_bytes([62; 16]).expect("id"),
        proposal: proposal.id.clone(),
        feasibility: wish.clone(),
        capabilities: wish.clone(),
        resources: wish.clone(),
        commitments: wish.clone(),
        coverage: wish.clone(),
        limitations: wish,
        dependencies: vec![],
        blockers: vec![],
    };
    request.operation.id = OperationId::from_bytes([62; 16]).expect("id");
    request.operation.command = Command::Assess {
        assessment: assessment.clone(),
        access: Access::Owner,
    };
    original
        .submit(&PreparedOperationRequest::from_operation_request(&request).expect("request"))
        .expect("assessment");
    let ground = GroundId::from_bytes([64; 16]).expect("id");
    let old = GroundVersion::from_bytes([65; 16]).expect("id");
    let current = GroundVersion::from_bytes([66; 16]).expect("id");
    local
        .0
        .lock()
        .expect("guard")
        .grounds
        .insert(ground.clone(), old.clone());
    request.operation.id = OperationId::from_bytes([63; 16]).expect("id");
    request.operation.command = Command::Decide(Decision {
        id: DecisionId::from_bytes([63; 16]).expect("id"),
        proposal: proposal.id.clone(),
        kind: DecisionKind::Adopt,
        dependencies: vec![Dependency {
            ground: ground.clone(),
            version: old,
        }],
    });
    original
        .submit(&PreparedOperationRequest::from_operation_request(&request).expect("request"))
        .expect("owner adoption");
    let owner = local.0.lock().expect("guard").context.clone();
    {
        let mut g = local.0.lock().expect("guard");
        g.grounds.insert(ground.clone(), current.clone());
        g.context.authority = Authority {
            actor: id.agent.clone(),
            represented_owner: id.owner.clone(),
            owner_control: None,
            agent_role: Some(id.clone()),
        };
    }
    request.actor = id.agent.clone();
    request.operation.id = OperationId::from_bytes([67; 16]).expect("id");
    request.operation.command = Command::Decide(Decision {
        id: DecisionId::from_bytes([67; 16]).expect("id"),
        proposal: proposal.id,
        kind: DecisionKind::Undertake {
            assessment: assessment.id,
        },
        dependencies: vec![],
    });
    let accepted = original
        .submit(&PreparedOperationRequest::from_operation_request(&request).expect("request"))
        .expect("agent undertaking accepted without activation");
    assert!(matches!(
        accepted.effect,
        Effect::Decision {
            activated: None,
            ..
        }
    ));
    {
        let mut g = local.0.lock().expect("guard");
        g.context = owner;
        g.grounds.clear();
    }
    drop(original);
    let resolve = |anchor| ReadCall::Resolve {
        change: id.change_key(),
        anchor,
        limits: ReadLimits::default(),
    };
    let after = match read_local(
        &reference,
        &mut local,
        &root,
        &resolve(ChangeAnchor::Beginning),
        ReadWorkLimits::default(),
    ) {
        ReadReply::Returned(ReadValue::Position(p)) => p,
        r => panic!("{r:?}"),
    };
    let through = match read_local(
        &reference,
        &mut local,
        &root,
        &resolve(ChangeAnchor::Current),
        ReadWorkLimits::default(),
    ) {
        ReadReply::Returned(ReadValue::Position(p)) => p,
        r => panic!("{r:?}"),
    };
    let call = ReadCall::Change(Box::new(ReadChangeRequest {
        change: id.change_key(),
        range: ChangeRange { after, through },
        selection: RecordSelection::AllRecords,
        page_cursor: None,
        limits: ReadLimits::default(),
    }));
    let bytes = codec::encode_read_call(&call).expect("call");
    let frame = read_local_framed(
        &reference,
        &mut local,
        &root,
        &bytes,
        ReadWorkLimits::default(),
    )
    .expect("framed history");
    let page = match codec::decode_read_reply(&frame).expect("reply") {
        ReadReply::Returned(ReadValue::Change(p)) => p,
        r => panic!("{r:?}"),
    };
    let last = page.records.last().expect("undertaking");
    assert!(matches!(&last.command,Command::Decide(d) if d.dependencies.is_empty()));
    assert_eq!(
        last.ground_observations,
        std::collections::BTreeMap::from([(ground.clone(), current.clone())])
    );
    assert_eq!(last.accepted,accepted,"actual current observation explains why a previously recorded counterpart did not activate");
    let mut filtered = call.clone();
    if let ReadCall::Change(r) = &mut filtered {
        r.selection = crate::application::read::RecordSelection::MatchingRecords(
            crate::application::read::RecordMatch {
                operations: BTreeSet::from([crate::application::read::OperationReference {
                    change: id.change_key(),
                    operation: request.operation.id.clone(),
                }]),
                references: BTreeSet::from([
                    crate::application::read::QualifiedReference::GroundObservation {
                        change: id.change_key(),
                        ground: ground.clone(),
                        version: current,
                    },
                ]),
                ..crate::application::read::RecordMatch::default()
            },
        );
    }
    assert!(
        matches!(read_local(&reference,&mut local,&root,&filtered,ReadWorkLimits::default()),ReadReply::Returned(ReadValue::Change(ref p)) if p.records.len()==1)
    );
    if let ReadCall::Change(r) = &mut filtered {
        if let crate::application::read::RecordSelection::MatchingRecords(m) = &mut r.selection {
            m.references = BTreeSet::from([
                crate::application::read::QualifiedReference::GroundObservation {
                    change: id.change_key(),
                    ground,
                    version: GroundVersion::from_bytes([65; 16]).expect("old version"),
                },
            ]);
        }
    }
    assert!(
        matches!(read_local(&reference,&mut local,&root,&filtered,ReadWorkLimits::default()),ReadReply::Returned(ReadValue::Change(ref p)) if p.records.is_empty()),
        "requested counterpart versions are not silently reinterpreted as actual observations"
    );
}
#[test]
fn accepted_one_mebibyte_retention_remains_retrievable_and_does_not_inflate_public_history() {
    use super::super::prepared_operation_request::PreparedOperationRequest;
    use crate::application::read::{ChangeRange, ReadChangeRequest, RecordSelection};
    use crate::kernel::change::{
        Access, Command, ContentId, ContentKey, ContentReference, Disposition, Evidence, Finding,
        OperationId,
    };
    let (mut original, id, _, reference, mut local, root) = tests::provision();
    let wish = original.records[0]
        .checks
        .content_items
        .keys()
        .next()
        .expect("wish")
        .clone();
    let key = ContentKey {
        establishing: id.change_key(),
        id: ContentId::from_bytes([70; 16]).expect("id"),
    };
    let payload = vec![0xa7; 1024 * 1024];
    support::source(&local, &key, &payload);
    let mut request = support::grant(&id, 70).operation_request().clone();
    request.operation.id = OperationId::from_bytes([70; 16]).expect("id");
    request.operation.command = Command::Finding {
        finding: Finding {
            agreement: None,
            claim: key.clone(),
            evidence: vec![Evidence {
                source: id.owner_actor.clone(),
                content: key.clone(),
                limitations: wish,
            }],
            disposition: Disposition::Unknown,
        },
        access: Access::Owner,
    };
    request.operation.first_retention.insert(key.clone());
    original
        .submit(&PreparedOperationRequest::from_operation_request(&request).expect("request"))
        .expect("ordinary 1 MiB retention");
    assert!(
        codec::encode_record(original.records.last().expect("record"))
            .expect("frame")
            .len()
            > 1024 * 1024,
        "metadata makes the accepted stored frame exceed 1 MiB"
    );
    let membership = ContentReference {
        identity: id.clone(),
        operation: request.operation.id,
        content: key,
    };
    drop(original);
    let limit = ReadLimits {
        reply_bytes: 2 * 1024 * 1024,
        ..ReadLimits::default()
    };
    let call = ReadCall::Content {
        membership,
        limits: limit,
    };
    {
        let mut g = local.0.lock().expect("guard");
        g.sources.clear();
        g.history = false;
    }
    let bytes = codec::encode_read_call(&call).expect("call");
    let frame = read_local_framed(
        &reference,
        &mut local,
        &root,
        &bytes,
        ReadWorkLimits::default(),
    )
    .expect("framed bytes");
    assert_eq!(
        codec::decode_read_reply(&frame),
        Ok(ReadReply::Returned(ReadValue::Content(payload)))
    );
    {
        let mut g = local.0.lock().expect("guard");
        g.history = true;
        g.retained_content = false;
    }
    let mut resolve = |anchor| match read_local(
        &reference,
        &mut local,
        &root,
        &ReadCall::Resolve {
            change: id.change_key(),
            anchor,
            limits: ReadLimits::default(),
        },
        ReadWorkLimits::default(),
    ) {
        ReadReply::Returned(ReadValue::Position(p)) => p,
        r => panic!("{r:?}"),
    };
    let after = resolve(ChangeAnchor::Beginning);
    let through = resolve(ChangeAnchor::Current);
    let call = ReadCall::Change(Box::new(ReadChangeRequest {
        change: id.change_key(),
        range: ChangeRange { after, through },
        selection: RecordSelection::AllRecords,
        page_cursor: None,
        limits: ReadLimits::default(),
    }));
    let bytes = codec::encode_read_call(&call).expect("call");
    let frame = read_local_framed(
        &reference,
        &mut local,
        &root,
        &bytes,
        ReadWorkLimits::default(),
    )
    .expect("history frame");
    assert!(
        frame.len() < 8192,
        "undisclosed payload bytes must not consume the public record's page reservation"
    );
    assert!(
        matches!(codec::decode_read_reply(&frame).expect("reply"),ReadReply::Returned(ReadValue::Change(ref p)) if p.records.len()==2)
    );
}
#[test]
fn accepted_large_fresh_record_keeps_public_history_small_and_original_content_exact() {
    use super::super::prepared_operation_request::PreparedOperationRequest;
    use crate::application::operation_request::{OperationRequest, CURRENT_PROFILE};
    use crate::application::ports::ContentObservation;
    use crate::application::read::{ChangeRange, ReadChangeRequest, RecordSelection};
    use crate::kernel::change::{
        Access, Attribution, BindingKnowledge, Command, ContentId, ContentKey, ContentLimits,
        ContentReference, ContextVersion, Disposition, Evidence, Finding, FreshContent, GrantId,
        GrantUse, InputKind, Operation, OperationId, OriginSelector, SourceClaim,
    };
    use std::collections::BTreeSet;
    let (mut original, id, _, reference, mut local, root) = tests::provision();
    let mut grant = support::grant(&id, 93).operation_request().clone();
    if let Command::SetGrant { spec, .. } = &mut grant.operation.command {
        spec.creation = Some(ContentLimits {
            items: 1,
            payload_bytes: 1024 * 1024,
        });
        spec.content_origins.insert(OriginSelector::CurrentGrant);
        spec.disclosure_origins.insert(OriginSelector::CurrentGrant);
    }
    original
        .submit(&PreparedOperationRequest::from_operation_request(&grant).expect("grant"))
        .expect("accepted grant");
    let key = ContentKey {
        establishing: id.change_key(),
        id: ContentId::from_bytes([94; 16]).expect("content id"),
    };
    let bytes = vec![0x5c; 1024 * 1024];
    {
        let mut g = local.0.lock().expect("fixture");
        g.context.version = ContextVersion::from_bytes([10; 16]).expect("version");
        g.context.authority.actor = id.agent.clone();
        g.context.authority.owner_control = None;
        g.context.authority.agent_role = Some(id.clone());
        g.sources.insert(
            key.clone(),
            ContentObservation {
                bytes: bytes.clone(),
                source_claim: SourceClaim {
                    input_kind: InputKind::NewContribution,
                    binding_knowledge: BindingKnowledge::NoKnownBinding,
                    attribution: Attribution::Actor(id.agent.clone()),
                    limitations: vec![],
                },
            },
        );
    }
    let operation = OperationId::from_bytes([95; 16]).expect("operation");
    let request = OperationRequest {
        profile: CURRENT_PROFILE,
        target: id.change_key(),
        actor: id.agent.clone(),
        represented_owner: id.owner.clone(),
        operation: Operation {
            id: operation.clone(),
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
                access: Access::Grant(GrantUse {
                    id: GrantId::from_bytes([93; 16]).expect("grant"),
                    generation: 1,
                }),
            },
            fresh: vec![FreshContent {
                key: key.clone(),
                derived_from: BTreeSet::new(),
                bytes: bytes.clone(),
                attributed_source: id.agent.clone(),
            }],
            first_retention: BTreeSet::new(),
        },
    };
    original
        .submit(
            &PreparedOperationRequest::from_operation_request(&request).expect("ordinary request"),
        )
        .expect("accepted ordinary fresh Content");
    assert!(
        codec::encode_record(original.records.last().expect("record"))
            .expect("frame")
            .len()
            > 3 * 1024 * 1024
    );
    drop(original);
    {
        let mut g = local.0.lock().expect("fixture");
        g.context.authority.actor = id.owner_actor.clone();
        g.context.authority.owner_control = Some(id.clone());
        g.context.authority.agent_role = None;
        g.context.version = ContextVersion::from_bytes([11; 16]).expect("version");
        g.history = false;
        g.sources.clear();
        g.resolve_calls = 0;
    }
    let reply = read_local(
        &reference,
        &mut local,
        &root,
        &ReadCall::Content {
            membership: ContentReference {
                identity: id.clone(),
                operation,
                content: key,
            },
            limits: ReadLimits {
                reply_bytes: 2 * 1024 * 1024,
                ..ReadLimits::default()
            },
        },
        ReadWorkLimits::default(),
    );
    match reply {
        ReadReply::Returned(ReadValue::Content(got)) => assert_eq!(got, bytes),
        r => panic!("large fresh Content not returned: {r:?}"),
    };
    local.0.lock().expect("fixture").history = true;
    let resolve = |anchor, local: &mut support::Local| match read_local(
        &reference,
        local,
        &root,
        &ReadCall::Resolve {
            change: id.change_key(),
            anchor,
            limits: ReadLimits::default(),
        },
        ReadWorkLimits::default(),
    ) {
        ReadReply::Returned(ReadValue::Position(p)) => p,
        r => panic!("{r:?}"),
    };
    let after = resolve(ChangeAnchor::Beginning, &mut local);
    let through = resolve(ChangeAnchor::Current, &mut local);
    let call = ReadCall::Change(Box::new(ReadChangeRequest {
        change: id.change_key(),
        range: ChangeRange { after, through },
        selection: RecordSelection::AllRecords,
        page_cursor: None,
        limits: ReadLimits::default(),
    }));
    let reply = read_local_framed(
        &reference,
        &mut local,
        &root,
        &codec::encode_read_call(&call).expect("call"),
        ReadWorkLimits::default(),
    )
    .expect("complete frame");
    assert!(reply.len() < 16 * 1024);
    assert!(
        matches!(codec::decode_read_reply(&reply).expect("reply"),ReadReply::Returned(ReadValue::Change(ref p)) if p.records.len()==3)
    );
    assert_eq!(local.0.lock().expect("fixture").resolve_calls, 0);
}
fn physical_fault(path: &std::path::Path, table: &str, needle: &[u8]) {
    let db = path.join("ledger.sqlite");
    let wal = path.join("ledger.sqlite-wal");
    let mut main = std::fs::read(&db).expect("closed source main");
    let mut journals = if wal.exists() {
        Some(std::fs::read(&wal).expect("closed source WAL"))
    } else {
        None
    };
    super::super::native_read_shape::fault_table_byte(
        &mut main,
        journals.as_deref_mut(),
        table,
        needle,
    )
    .expect("physical logical-page fault, unchanged head");
    let mut budget =
        crate::application::read_budget::ReadBudget::try_new(ReadWorkLimits::default())
            .expect("budget");
    super::super::native_read_shape::admit(&main, journals.as_deref(), &mut budget)
        .expect("fault still meets native structural bounds");
    std::fs::copy(&db, path.join(format!("preserved-before-{table}.sqlite")))
        .expect("preserve unique bytes");
    std::fs::write(&db, main).expect("fault in own source");
    if let Some(bytes) = journals {
        std::fs::copy(&wal, path.join(format!("preserved-before-{table}.wal")))
            .expect("preserve unique bytes");
        std::fs::write(wal, bytes).expect("valid checksums with damaged earlier data");
    }
}
#[test]
fn physical_earlier_record_and_control_faults_with_unchanged_head_are_not_cached_or_skipped() {
    for (table, needle) in [
        ("records", b"retained owner wish".as_slice()),
        ("results", [9u8; 16].as_slice()),
    ] {
        let (mut original, id, path, reference, mut local, root) = tests::provision();
        original
            .submit(&support::grant(&id, 40))
            .expect("later accepted head");
        drop(original);
        let control = std::fs::read(path.join("custody.ctrl")).expect("witness");
        physical_fault(&path, table, needle);
        assert_eq!(
            std::fs::read(path.join("custody.ctrl")).expect("same witness"),
            control
        );
        let call = ReadCall::Resolve {
            change: id.change_key(),
            anchor: ChangeAnchor::Sequence(1),
            limits: ReadLimits::default(),
        };
        assert_eq!(
            read_local(
                &reference,
                &mut local,
                &root,
                &call,
                ReadWorkLimits::default()
            ),
            ReadReply::Refused(ReadRefusal::Unavailable),
            "full verification even for an earlier anchor, not just observed head"
        );
    }
}
#[test]
fn final_physical_record_change_source_growth_custody_and_context_changes_release_no_frame() {
    use std::os::unix::fs::OpenOptionsExt;
    for fault in [0, 1, 2, 3, 4] {
        let (original, id, path, reference, mut local, root) = tests::provision();
        drop(original);
        let call = ReadCall::Resolve {
            change: id.change_key(),
            anchor: ChangeAnchor::Current,
            limits: ReadLimits::default(),
        };
        local.0.lock().expect("guard").disclose_hook = Some(Box::new(move |g| {
            g.disclose_hook = Some(Box::new(move |g| match fault {
                0 => physical_fault(&path, "records", b"retained owner wish"),
                1 => {
                    let p = path.join("ledger.sqlite-wal");
                    let n = std::fs::metadata(&p).expect("WAL").len();
                    std::fs::OpenOptions::new()
                        .write(true)
                        .open(p)
                        .expect("own source")
                        .set_len(n + 1)
                        .expect("growth");
                }
                2 => {
                    std::fs::rename(
                        path.join("ledger.sqlite"),
                        path.join("preserved-replaced.sqlite"),
                    )
                    .expect("preserve source");
                    std::fs::OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .mode(0o600)
                        .open(path.join("ledger.sqlite"))
                        .expect("replacement fault");
                }
                3 => {
                    g.context.version =
                        crate::kernel::change::ContextVersion::from_bytes([98; 16]).expect("id");
                }
                _ => {
                    g.history = false;
                }
            }));
        }));
        let bytes = codec::encode_read_call(&call).expect("request");
        let frame = read_local_framed(
            &reference,
            &mut local,
            &root,
            &bytes,
            ReadWorkLimits::default(),
        )
        .expect("complete refusal frame");
        let reply = codec::decode_read_reply(&frame).expect("reply");
        assert!(
            matches!(reply, ReadReply::Refused(_)),
            "fault {fault} released {reply:?}"
        );
        if fault == 4 {
            assert_eq!(reply, ReadReply::Refused(ReadRefusal::Denied));
        }
        if fault == 3 {
            assert_eq!(reply, ReadReply::Refused(ReadRefusal::Changed));
        }
    }
}
#[test]
fn clean_main_read_and_pre_native_header_or_page_cycle_refusal_leave_source_untouched() {
    for fault in ["none", "page-count", "schema-cycle"] {
        let (original, id, path, reference, mut local, root) = tests::provision();
        original
            .close()
            .expect("explicit arrangement checkpoint, not read entry");
        // A completed Clean checkpoint permits main-only proof. Preserve closed sidecars
        // outside the canonical names so no valid WAL frame masks the physical main fault.
        for name in ["ledger.sqlite-wal", "ledger.sqlite-shm"] {
            let member = path.join(name);
            if member.exists() {
                std::fs::rename(&member, path.join(format!("preserved-closed-{name}")))
                    .expect("preserve closed sidecar");
            }
        }
        let main = path.join("ledger.sqlite");
        if fault != "none" {
            std::fs::copy(&main, path.join("preserved-before-shape.sqlite"))
                .expect("preserve valid bytes");
            let mut bytes = std::fs::read(&main).expect("main");
            if fault == "page-count" {
                bytes[28..32].copy_from_slice(&u32::MAX.to_be_bytes());
            } else {
                assert_eq!(bytes[100], 5, "fixed-schema interior root");
                bytes[108..112].copy_from_slice(&1u32.to_be_bytes());
            }
            std::fs::write(&main, &bytes).expect("own physical adversary");
        }
        let before = support::native_snapshot(&path);
        let reply = read_local(
            &reference,
            &mut local,
            &root,
            &ReadCall::Resolve {
                change: id.change_key(),
                anchor: ChangeAnchor::Current,
                limits: ReadLimits::default(),
            },
            ReadWorkLimits::default(),
        );
        if fault == "none" {
            assert!(
                matches!(reply,ReadReply::Returned(ReadValue::Position(ref p)) if p.sequence==1),
                "{reply:?}"
            );
        } else if fault == "page-count" {
            assert_eq!(reply, ReadReply::Refused(ReadRefusal::Limit));
        } else {
            assert_eq!(reply, ReadReply::Refused(ReadRefusal::Unavailable));
        }
        assert_eq!(support::native_snapshot(&path), before);
    }
}
#[test]
fn read_work_limits_cover_control_copy_native_and_reconstruction_without_partial_success() {
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits::default(),
    };
    let before = support::native_snapshot(&path);
    for work in [
        ReadWorkLimits {
            source_bytes: 1,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            io_bytes: 1,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            allocation_bytes: 1024 * 1024,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            work_units: 65536,
            ..ReadWorkLimits::default()
        },
    ] {
        assert_eq!(
            read_local(&reference, &mut local, &root, &call, work),
            ReadReply::Refused(ReadRefusal::Limit)
        );
        assert_eq!(support::native_snapshot(&path), before);
    }
    assert!(matches!(
        read_local(
            &reference,
            &mut local,
            &root,
            &call,
            ReadWorkLimits::default()
        ),
        ReadReply::Returned(_)
    ));
}
#[test]
fn thirty_two_small_ordinary_records_fit_the_default_read_work_envelope() {
    let (mut original, id, _, reference, mut local, root) = tests::provision();
    for n in 1..32 {
        original
            .submit(&support::grant(&id, 39 + n))
            .expect("ordinary acceptance");
    }
    drop(original);
    let reply = read_local(
        &reference,
        &mut local,
        &root,
        &ReadCall::Resolve {
            change: id.change_key(),
            anchor: ChangeAnchor::Current,
            limits: ReadLimits::default(),
        },
        ReadWorkLimits::default(),
    );
    assert!(
        matches!(reply,ReadReply::Returned(ReadValue::Position(ref p)) if p.sequence==32),
        "{reply:?}"
    );
}
#[test]
fn pending_cuts_are_verified_without_resolution_writes_or_indeterminate_prefix_fallback() {
    use super::super::control::{Mutation, Pending, Stage, Witness};
    use super::super::custody::WriterCustody;
    for (stage, committed, expected) in [
        (Stage::Prepared, false, Some(1)),
        (Stage::CommitPossible, false, None),
        (Stage::CommitPossible, true, Some(2)),
        (Stage::Prepared, true, None),
    ] {
        let (mut original, id, path, reference, mut local, root) = tests::provision();
        let before = original.store.witness.cut.clone();
        let request = support::grant(&id, 40);
        if committed {
            original.submit(&request).expect("accepted cut");
        }
        drop(original);
        std::fs::copy(
            path.join("custody.ctrl"),
            path.join("preserved-before-pending.ctrl"),
        )
        .expect("preserve witness");
        let custody = WriterCustody::open(&path).expect("exclusive fault fixture");
        let mut after = before.advance().expect("revision");
        after.count = 2;
        after.last = Some(request.operation_request().operation.id.clone());
        Witness::rewrite_for_test(&custody, "custody.ctrl", |w| {
            w.cut = before;
            w.pending = Some(Pending {
                stage,
                mutation: Mutation::Append,
                after,
                request: request.frame().to_vec(),
            });
        });
        drop(custody);
        let before_read = support::native_snapshot(&path);
        let call = ReadCall::Resolve {
            change: id.change_key(),
            anchor: ChangeAnchor::Beginning,
            limits: ReadLimits::default(),
        };
        let reply = read_local(
            &reference,
            &mut local,
            &root,
            &call,
            ReadWorkLimits::default(),
        );
        if expected.is_some() {
            assert!(matches!(reply, ReadReply::Returned(_)), "{reply:?}");
        } else {
            assert!(
                matches!(reply, ReadReply::Refused(_)),
                "must not reveal a verified but indeterminate earlier prefix: {reply:?}"
            );
        }
        if let Some(n) = expected {
            let call = ReadCall::Resolve {
                change: id.change_key(),
                anchor: ChangeAnchor::Current,
                limits: ReadLimits::default(),
            };
            assert!(
                matches!(read_local(&reference,&mut local,&root,&call,ReadWorkLimits::default()),ReadReply::Returned(ReadValue::Position(ref p)) if p.sequence==n)
            );
        }
        assert_eq!(
            support::native_snapshot(&path),
            before_read,
            "read did not clear/finalize pending mutation or lifecycle"
        );
    }
}
#[test]
fn cold_missing_wal_never_falls_back_to_an_older_valid_main_prefix() {
    let (mut original, id, path, reference, mut local, root) = tests::provision();
    original
        .submit(&support::grant(&id, 40))
        .expect("later record");
    drop(original);
    std::fs::rename(path.join("ledger.sqlite-wal"), path.join("preserved-wal"))
        .expect("own fault fixture");
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits::default(),
    };
    assert_eq!(
        read_local(
            &reference,
            &mut local,
            &root,
            &call,
            ReadWorkLimits::default()
        ),
        ReadReply::Refused(ReadRefusal::Unavailable)
    );
}
