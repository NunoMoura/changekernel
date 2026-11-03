//! P34 behavior on actual Included originals, not the old point-read path.
use super::super::tests::support;
use super::reads_fixture as tests;
use super::reads_fixture::ReadFixture as Original;
use crate::adapters::codec;
use crate::application::read::{
    ActorReference, ChangeAnchor, ChangePage, ChangeProgress, ChangeRange, OperationKind,
    OperationReference, QualifiedReference, ReadChangeRequest, ReadLimits, ReadRefusal, ReadReply,
    RecordMatch, RecordSelection,
};
use crate::application::read_call::{ReadCall, ReadValue};
use crate::kernel::change::{ChangeId, Command, ContentReference, OperationId};
use std::collections::BTreeSet;

#[track_caller]
fn returned<T: std::fmt::Debug>(reply: ReadReply<T>) -> T {
    match reply {
        ReadReply::Returned(value) => value,
        ReadReply::Refused(r) => panic!("unexpected refusal: {r}"),
    }
}
fn request(store: &mut Original, id: &crate::kernel::change::Identity) -> ReadChangeRequest {
    let after = returned(store.resolve_change_cursor(
        &id.change_key(),
        &ChangeAnchor::Beginning,
        ReadLimits::default(),
    ));
    let through = returned(store.resolve_change_cursor(
        &id.change_key(),
        &ChangeAnchor::Current,
        ReadLimits::default(),
    ));
    ReadChangeRequest {
        change: id.change_key(),
        range: ChangeRange { after, through },
        selection: RecordSelection::AllRecords,
        page_cursor: None,
        limits: ReadLimits::default(),
    }
}
fn cursor(page: ChangePage) -> crate::application::read::ChangePageCursor {
    match page.progress {
        ChangeProgress::More { next_page_cursor } => *next_page_cursor,
        ChangeProgress::EndOfRange => panic!("expected continuation"),
    }
}
#[test]
fn exact_anchors_do_not_clamp_and_ids_are_not_history_order() {
    let (mut store, id, _, _, _, _) = tests::provision();
    store
        .submit(&support::grant(&id, 90))
        .expect("grant accepted");
    store
        .submit(&support::grant(&id, 20))
        .expect("grant accepted");
    let mut expected = None;
    for (n, op) in [(1, 12), (2, 90), (3, 20)] {
        let by_sequence = returned(store.resolve_change_cursor(
            &id.change_key(),
            &ChangeAnchor::Sequence(n),
            ReadLimits::default(),
        ));
        let by_operation = returned(store.resolve_change_cursor(
            &id.change_key(),
            &ChangeAnchor::Operation(OperationId::from_bytes([op; 16]).expect("nonzero")),
            ReadLimits::default(),
        ));
        assert_eq!(by_sequence, by_operation);
        expected = Some(by_sequence);
    }
    assert_eq!(
        returned(store.resolve_change_cursor(
            &id.change_key(),
            &ChangeAnchor::Current,
            ReadLimits::default()
        )),
        expected.expect("three records")
    );
    for anchor in [
        ChangeAnchor::Sequence(4),
        ChangeAnchor::Sequence(u64::MAX),
        ChangeAnchor::Operation(OperationId::from_bytes([99; 16]).expect("nonzero")),
    ] {
        assert_eq!(
            store.resolve_change_cursor(&id.change_key(), &anchor, ReadLimits::default()),
            ReadReply::Refused(ReadRefusal::Invalid)
        );
    }
}
#[test]
fn fixed_ranges_and_replayed_pages_do_not_lose_boundary_matches_after_append() {
    let (mut store, id, _, _, _, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let mut req = request(&mut store, &id);
    req.limits.returned_records = 1;
    req.limits.scanned_records = 1;
    let first = returned(store.read_change(&req));
    assert_eq!(first.records[0].position.sequence, 1);
    assert_eq!(
        returned(store.read_change(&req)),
        first,
        "page replay is not consumption"
    );
    req.page_cursor = Some(cursor(first));
    store
        .submit(&support::grant(&id, 41))
        .expect("later append accepted");
    let second = returned(store.read_change(&req));
    assert_eq!(second.records[0].position.sequence, 2);
    assert_eq!(second.observed_head.sequence, 3);
    assert_eq!(second.scanned.after.sequence, 1);
    assert_eq!(second.scanned.through.sequence, 2);
    assert_eq!(second.progress, ChangeProgress::EndOfRange);
}
#[test]
fn same_record_conjunction_actual_actor_and_reference_matching_need_no_content_fetch() {
    let (mut store, id, _, _, local, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let mut req = request(&mut store, &id);
    let content = store.records[0]
        .checks
        .content_items
        .keys()
        .next()
        .expect("wish")
        .clone();
    let count = local.0.lock().expect("fixture lock").resolve_calls;
    {
        let mut g = local.0.lock().expect("fixture lock");
        g.sources.clear();
        g.retained_content = false;
    }
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        kinds: BTreeSet::from([OperationKind::Start]),
        operations: BTreeSet::from([OperationReference {
            change: id.change_key(),
            operation: OperationId::from_bytes([40; 16]).expect("nonzero"),
        }]),
        ..RecordMatch::default()
    });
    let empty = returned(store.read_change(&req));
    assert!(
        empty.records.is_empty(),
        "different records cannot satisfy a conjunction"
    );
    assert_eq!(empty.scanned.through.sequence, 2);
    assert_eq!(empty.progress, ChangeProgress::EndOfRange);
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        actors: BTreeSet::from([ActorReference {
            change: id.change_key(),
            actor: id.agent.clone(),
        }]),
        ..RecordMatch::default()
    });
    assert!(
        returned(store.read_change(&req)).records.is_empty(),
        "represented owner is not the actual actor"
    );
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        actors: BTreeSet::from([ActorReference {
            change: id.change_key(),
            actor: id.owner_actor.clone(),
        }]),
        references: BTreeSet::from([QualifiedReference::Content(content)]),
        ..RecordMatch::default()
    });
    assert_eq!(returned(store.read_change(&req)).records.len(), 1);
    assert_eq!(
        local.0.lock().expect("fixture lock").resolve_calls,
        count,
        "history must not resolve Content"
    );
}
#[test]
fn empty_filtered_pages_advance_last_scanned_not_last_match() {
    let (mut store, id, _, _, _, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let mut req = request(&mut store, &id);
    req.limits.scanned_records = 1;
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        kinds: BTreeSet::from([OperationKind::SetGrant]),
        ..RecordMatch::default()
    });
    let first = returned(store.read_change(&req));
    assert!(first.records.is_empty());
    let next = cursor(first);
    assert_eq!(next.last_scanned.sequence, 1);
    req.page_cursor = Some(next);
    let second = returned(store.read_change(&req));
    assert_eq!(second.records[0].position.sequence, 2);
    assert_eq!(second.progress, ChangeProgress::EndOfRange);
    req.selection = RecordSelection::MatchingRecords(RecordMatch::default());
    req.page_cursor = None;
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Invalid)
    );
}
#[test]
fn cursor_binding_position_and_selection_changes_refuse_without_partial_page() {
    let (mut store, id, _, _, _, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let mut req = request(&mut store, &id);
    req.limits.scanned_records = 1;
    let good = cursor(returned(store.read_change(&req)));
    let mut wrong = good.clone();
    wrong.permission_scope.change = ChangeId::from_bytes([22; 16]).expect("nonzero");
    req.page_cursor = Some(wrong);
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Invalid)
    );
    let mut wrong = good.clone();
    wrong.last_scanned.operation = Some(OperationId::from_bytes([40; 16]).expect("nonzero"));
    req.page_cursor = Some(wrong);
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Invalid)
    );
    let mut wrong = good.clone();
    wrong.last_scanned.source.identity.change = ChangeId::from_bytes([22; 16]).expect("nonzero");
    req.page_cursor = Some(wrong);
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Invalid)
    );
    req.page_cursor = Some(good.clone());
    assert_eq!(good, req.page_cursor.clone().expect("typed equality"));
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        kinds: BTreeSet::from([OperationKind::Start]),
        ..RecordMatch::default()
    });
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Invalid)
    );
}
#[test]
fn history_and_exact_content_membership_have_independent_permissions() {
    let (mut store, id, _, _, local, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let req = request(&mut store, &id);
    let content = store.records[0]
        .checks
        .content_items
        .keys()
        .next()
        .expect("wish")
        .clone();
    let member = ContentReference {
        identity: id.clone(),
        operation: store.records[0].operation.id.clone(),
        content,
    };
    {
        let mut g = local.0.lock().expect("fixture lock");
        g.history = false;
        g.retained_content = true;
        g.sources.clear();
    }
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Denied)
    );
    assert_eq!(
        returned(store.read_content(&member, ReadLimits::default())),
        b"retained owner wish"
    );
    let mut wrong = member.clone();
    wrong.operation = OperationId::from_bytes([40; 16]).expect("nonzero");
    assert_eq!(
        store.read_content(&wrong, ReadLimits::default()),
        ReadReply::Refused(ReadRefusal::Denied)
    );
    {
        let mut g = local.0.lock().expect("fixture lock");
        g.history = true;
        g.retained_content = false;
    }
    assert_eq!(returned(store.read_change(&req)).records.len(), 2);
    assert_eq!(
        store.read_content(&member, ReadLimits::default()),
        ReadReply::Refused(ReadRefusal::Denied)
    );
}
#[test]
fn history_preserves_command_attribution_and_provenance_not_private_checks() {
    let (mut store, id, _, _, _, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let req = request(&mut store, &id);
    let page = returned(store.read_change(&req));
    assert_eq!(page.records[0].command, store.records[0].operation.command);
    assert_eq!(page.records[0].accepted, store.records[0].accepted);
    assert_eq!(
        page.records[1].command, store.records[1].operation.command,
        "full grant terms survive"
    );
    assert!(matches!(page.records[0].command, Command::Initiate { .. }));
    assert_eq!(
        page.records[0].memberships[0].intake,
        *store.records[0]
            .checks
            .intakes
            .values()
            .next()
            .expect("source facts")
    );
    assert_eq!(
        page.records[0].memberships[0].reference.operation,
        store.records[0].operation.id
    );
}
#[test]
fn public_bookmark_survives_private_context_change_but_rechecks_current_permission() {
    let (mut store, id, _, _, local, _) = tests::provision();
    store
        .submit(&support::grant(&id, 40))
        .expect("grant accepted");
    let mut req = request(&mut store, &id);
    req.limits.scanned_records = 1;
    let first = returned(store.read_change(&req));
    let old = cursor(first.clone());
    local.0.lock().expect("fixture lock").context.version =
        crate::kernel::change::ContextVersion::from_bytes([78; 16]).expect("nonzero");
    assert_eq!(
        returned(store.read_change(&req)),
        first,
        "private context versions are not public source/bookmark bindings"
    );
    req.page_cursor = Some(old);
    assert_eq!(
        returned(store.read_change(&req)).records[0]
            .position
            .sequence,
        2
    );
    local.0.lock().expect("fixture lock").history = false;
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Denied),
        "a logical scope bookmark is never permission"
    );
}
#[test]
fn denied_caller_never_receives_source_limits_or_liveness_distinctions() {
    for oversized in [true, false] {
        let (mut store, id, path, _, local, _) = tests::provision();
        let req = request(&mut store, &id);
        let member = ContentReference {
            identity: id.clone(),
            operation: store.records[0].operation.id.clone(),
            content: store.records[0]
                .checks
                .content_items
                .keys()
                .next()
                .expect("wish")
                .clone(),
        };
        if oversized {
            // Control files are not SQLite descriptors. Preserve original bytes before fault.
            std::fs::copy(
                path.join("custody.ctrl"),
                path.join("preserved-before-limit.ctrl"),
            )
            .expect("preserve fixture");
            std::fs::OpenOptions::new()
                .write(true)
                .open(path.join("custody.ctrl"))
                .expect("own control")
                .set_len(65 * 1024 * 1024)
                .expect("bounded sparse fault");
        } else {
            std::fs::rename(
                path.join("custody.ctrl"),
                path.join("preserved-unavailable.ctrl"),
            )
            .expect("own unavailable-source fixture");
        }
        {
            let mut g = local.0.lock().expect("fixture lock");
            g.history = false;
            g.retained_content = false;
        }
        assert_eq!(
            store.resolve_change_cursor(
                &id.change_key(),
                &ChangeAnchor::Current,
                ReadLimits::default()
            ),
            ReadReply::Refused(ReadRefusal::Denied)
        );
        assert_eq!(
            store.read_change(&req),
            ReadReply::Refused(ReadRefusal::Denied)
        );
        assert_eq!(
            store.read_content(&member, ReadLimits::default()),
            ReadReply::Refused(ReadRefusal::Denied)
        );
        local.0.lock().expect("fixture lock").history = true;
        assert_eq!(
            store.read_change(&req),
            ReadReply::Refused(if oversized {
                ReadRefusal::Limit
            } else {
                ReadRefusal::Unavailable
            })
        );
    }
}
#[test]
fn accepted_and_prior_membership_references_match_but_private_disclosure_controls_do_not() {
    let (mut store, id, _, _, local, _) = tests::provision();
    let member = ContentReference {
        identity: id.clone(),
        operation: store.records[0].operation.id.clone(),
        content: store.records[0]
            .checks
            .content_items
            .keys()
            .next()
            .expect("wish")
            .clone(),
    };
    let hidden = crate::kernel::change::ContentKey {
        establishing: id.change_key(),
        id: crate::kernel::change::ContentId::from_bytes([77; 16]).expect("nonzero"),
    };
    local
        .0
        .lock()
        .expect("fixture lock")
        .context
        .disclosure
        .insert(crate::application::ports::ReadScope::Content(
            hidden.clone(),
        ));
    let mut grant = support::grant(&id, 40).operation_request().clone();
    if let Command::SetGrant { spec, .. } = &mut grant.operation.command {
        spec.content_items.insert(member.content.clone());
    }
    store.submit(&super::super::prepared_operation_request::PreparedOperationRequest::from_operation_request(&grant).expect("valid request")).expect("grant accepted");
    let mut req = request(&mut store, &id);
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        references: BTreeSet::from([QualifiedReference::Membership(member.clone())]),
        ..RecordMatch::default()
    });
    assert_eq!(
        returned(store.read_change(&req)).records.len(),
        2,
        "accepted and prior membership both count"
    );
    let mut later = member;
    later.operation = grant.operation.id;
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        references: BTreeSet::from([QualifiedReference::Membership(later)]),
        ..RecordMatch::default()
    });
    assert_eq!(
        returned(store.read_change(&req)).records[0]
            .position
            .sequence,
        2
    );
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        references: BTreeSet::from([QualifiedReference::Content(hidden)]),
        ..RecordMatch::default()
    });
    assert!(
        returned(store.read_change(&req)).records.is_empty(),
        "unrelated private controls are not public references"
    );
}
#[test]
fn actual_agent_actor_is_selected_not_its_represented_owner() {
    use crate::kernel::change::{
        Access, Authority, ContextVersion, Disposition, Evidence, Finding, GrantUse,
    };
    let (mut store, id, _, _, local, _) = tests::provision();
    let wish = store.records[0]
        .checks
        .content_items
        .keys()
        .next()
        .expect("wish")
        .clone();
    let mut grant = support::grant(&id, 40).operation_request().clone();
    if let Command::SetGrant { spec, .. } = &mut grant.operation.command {
        spec.content_items.insert(wish.clone());
        spec.disclosure.insert(wish.clone());
    }
    store.submit(&super::super::prepared_operation_request::PreparedOperationRequest::from_operation_request(&grant).expect("request")).expect("recording grant");
    let owner_context = local.0.lock().expect("fixture lock").context.clone();
    {
        let mut g = local.0.lock().expect("fixture lock");
        g.context.version = ContextVersion::from_bytes([50; 16]).expect("nonzero");
        g.context.authority = Authority {
            actor: id.agent.clone(),
            represented_owner: id.owner.clone(),
            owner_control: None,
            agent_role: Some(id.clone()),
        };
    }
    let mut contribution = grant;
    contribution.actor = id.agent.clone();
    contribution.operation.id = OperationId::from_bytes([41; 16]).expect("nonzero");
    contribution.operation.command = Command::Finding {
        finding: Finding {
            agreement: None,
            claim: wish.clone(),
            evidence: vec![Evidence {
                source: id.agent.clone(),
                content: wish.clone(),
                limitations: wish,
            }],
            disposition: Disposition::Unknown,
        },
        access: Access::Grant(GrantUse {
            id: crate::kernel::change::GrantId::from_bytes([40; 16]).expect("nonzero"),
            generation: 1,
        }),
    };
    store.submit(&super::super::prepared_operation_request::PreparedOperationRequest::from_operation_request(&contribution).expect("request")).expect("agent contribution");
    local.0.lock().expect("fixture lock").context = owner_context;
    let mut req = request(&mut store, &id);
    req.selection = RecordSelection::MatchingRecords(RecordMatch {
        actors: BTreeSet::from([ActorReference {
            change: id.change_key(),
            actor: id.agent.clone(),
        }]),
        ..RecordMatch::default()
    });
    let page = returned(store.read_change(&req));
    assert_eq!(page.records.len(), 1);
    assert_eq!(page.records[0].accepted.actor, id.agent);
    assert_eq!(page.records[0].accepted.represented_owner, id.owner);
    assert_eq!(page.records[0].position.sequence, 3);
}
#[test]
fn empty_retained_content_is_returned_exactly_without_history_or_a_source_fetch() {
    use crate::kernel::change::{Access, ContentId, ContentKey, Disposition, Evidence, Finding};
    let (mut store, id, _, _, local, _) = tests::provision();
    let wish = store.records[0]
        .checks
        .content_items
        .keys()
        .next()
        .expect("wish")
        .clone();
    let empty = ContentKey {
        establishing: id.change_key(),
        id: ContentId::from_bytes([51; 16]).expect("nonzero"),
    };
    support::source(&local, &empty, &[]);
    let mut request = support::grant(&id, 52).operation_request().clone();
    request.operation.command = Command::Finding {
        finding: Finding {
            agreement: None,
            claim: empty.clone(),
            evidence: vec![Evidence {
                source: id.owner_actor.clone(),
                content: empty.clone(),
                limitations: wish,
            }],
            disposition: Disposition::Unknown,
        },
        access: Access::Owner,
    };
    request.operation.first_retention.insert(empty.clone());
    store.submit(&super::super::prepared_operation_request::PreparedOperationRequest::from_operation_request(&request).expect("request")).expect("first retention");
    let member = ContentReference {
        identity: id,
        operation: request.operation.id,
        content: empty,
    };
    let resolves = local.0.lock().expect("fixture lock").resolve_calls;
    {
        let mut g = local.0.lock().expect("fixture lock");
        g.sources.clear();
        g.history = false;
    }
    assert_eq!(
        returned(store.read_content(&member, ReadLimits::default())),
        Vec::<u8>::new()
    );
    let call = codec::encode_read_call(&ReadCall::Content {
        membership: member,
        limits: ReadLimits::default(),
    })
    .expect("request");
    let frame = store.read_framed(&call).expect("whole frame");
    assert_eq!(
        codec::decode_read_reply(&frame),
        Ok(ReadReply::Returned(ReadValue::Content(Vec::new())))
    );
    assert_eq!(
        local.0.lock().expect("fixture lock").resolve_calls,
        resolves
    );
}
#[test]
fn unchanged_head_never_certifies_tampered_earlier_pairs_or_normalized_controls() {
    for controls in [false, true] {
        for content in [false, true] {
            let (mut store, id, _, _, _, _) = tests::provision();
            store.submit(&support::grant(&id, 40)).expect("later grant");
            let mut req = request(&mut store, &id);
            req.range.through = returned(store.resolve_change_cursor(
                &id.change_key(),
                &ChangeAnchor::Sequence(1),
                ReadLimits::default(),
            ));
            let membership = ContentReference {
                identity: id.clone(),
                operation: store.records[0].operation.id.clone(),
                content: store.records[0]
                    .checks
                    .content_items
                    .keys()
                    .next()
                    .expect("wish")
                    .clone(),
            };
            let c = store
                .writer()
                .store
                .connection
                .as_ref()
                .expect("owned connection");
            let before = super::super::schema::head(c).expect("head");
            if controls {
                c.execute(
                    "UPDATE results SET context=?1 WHERE operation=?2",
                    rusqlite::params![vec![77u8; 16], membership.operation.as_bytes().as_slice()],
                )
                .expect("fault in own disposable database");
            } else {
                c.execute(
                    "UPDATE records SET frame=?1 WHERE sequence=1",
                    [vec![77u8; 16]],
                )
                .expect("fault in own disposable database");
            }
            assert_eq!(
                super::super::schema::head(c).expect("unchanged head"),
                before
            );
            assert!(
                store.writer().store.live().is_ok(),
                "this deliberately proves why live/head alone is insufficient"
            );
            if content {
                assert_eq!(
                    store.read_content(&membership, ReadLimits::default()),
                    ReadReply::Refused(ReadRefusal::Unavailable)
                );
            } else {
                assert_eq!(
                    store.read_change(&req),
                    ReadReply::Refused(ReadRefusal::Unavailable),
                    "no earlier cached page or older-prefix fallback"
                );
            }
            // The read retains no mutable handle and never reopens a fallback writer.
        }
    }
}
#[test]
fn native_read_vm_budget_refuses_before_unbounded_sql_work_and_restores_writer_limits() {
    use rusqlite::limits::Limit;
    let (mut store, id, _, _, _, _) = super::super::tests::provision();
    let c = store.store.connection.as_ref().expect("owned connection");
    let before = c.limit(Limit::SQLITE_LIMIT_LENGTH).expect("native limit");
    {
        let budget = super::super::native_read_budget::NativeReadBudget::try_new(c)
            .expect("scoped read budget");
        let result: super::super::store_error::StoreResult<i64> = c.query_row("WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n", [], |r| r.get(0)).map_err(Into::into);
        assert!(matches!(
            super::super::native_read_budget::classify(&budget, result),
            Err(super::super::store_error::StoreError::Limit)
        ));
    }
    assert_eq!(
        c.limit(Limit::SQLITE_LIMIT_LENGTH)
            .expect("restored native limit"),
        before
    );
    store
        .submit(&support::grant(&id, 40))
        .expect("read budget must not become an ordinary-acceptance ceiling");
}
#[test]
fn framed_history_preserves_public_meaning_without_payload_and_final_packing_revocation_refuses() {
    let (mut store, id, _, _, local, _) = tests::provision();
    let req = request(&mut store, &id);
    let call = codec::encode_read_call(&ReadCall::Change(Box::new(req))).expect("call fits");
    let bytes = store.read_framed(&call).expect("framed read");
    assert!(
        !bytes
            .windows(b"retained owner wish".len())
            .any(|w| w == b"retained owner wish"),
        "history never embeds payload"
    );
    let value = returned(codec::decode_read_reply(&bytes).expect("valid reply"));
    match value {
        ReadValue::Change(page) => {
            assert_eq!(page.records[0].command, store.records[0].operation.command)
        }
        _ => panic!("wrong response family"),
    }
    // The physical path's second history check occurs after complete packing.
    local.0.lock().expect("fixture lock").disclose_hook = Some(Box::new(|g| {
        g.disclose_hook = Some(Box::new(|g| {
            g.history = false;
        }));
    }));
    let bytes = store
        .read_framed(&call)
        .expect("reason-free framed refusal");
    assert_eq!(
        codec::decode_read_reply(&bytes),
        Ok(ReadReply::Refused(ReadRefusal::Denied))
    );
}
#[test]
fn framed_source_limit_refusal_rechecks_current_authorization_after_packing() {
    let (mut store, id, _, _, local, _) = tests::provision();
    let mut req = request(&mut store, &id);
    req.limits.reply_bytes = 512;
    let call = codec::encode_read_call(&ReadCall::Change(Box::new(req))).expect("request");
    local.0.lock().expect("fixture lock").disclose_hook = Some(Box::new(|g| {
        g.disclose_hook = Some(Box::new(|g| {
            g.history = false;
        }));
    }));
    let frame = store.read_framed(&call).expect("whole refusal");
    assert_eq!(
        codec::decode_read_reply(&frame),
        Ok(ReadReply::Refused(ReadRefusal::Denied)),
        "new denial hides even source-limit distinctions"
    );
}
#[test]
fn oversized_first_item_does_not_advance_or_skip_and_final_revocation_refuses() {
    let (mut store, id, _, _, local, _) = tests::provision();
    let mut req = request(&mut store, &id);
    req.limits.reply_bytes = 512;
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Limit)
    );
    req.limits = ReadLimits::default();
    assert_eq!(
        returned(store.read_change(&req)).records[0]
            .position
            .sequence,
        1
    );
    local.0.lock().expect("fixture lock").disclose_hook = Some(Box::new(|g| {
        g.disclose_hook = Some(Box::new(|g| {
            g.history = false;
        }));
    }));
    assert_eq!(
        store.read_change(&req),
        ReadReply::Refused(ReadRefusal::Denied),
        "no partial page after final revocation"
    );
}
