use crate::adapters::codec;
use crate::adapters::read_adapter::adapter_error::AdapterError;
use crate::adapters::read_adapter::test_values as values;
use crate::adapters::read_adapter::work::Work;
use crate::application::read::{
    ChangeAnchor, ChangePage, ChangePageCursor, ChangeProgress, ChangeRange, ReadChangeRequest,
    ReadLimits, ReadRefusal, ReadReply, RecordSelection,
};
use crate::application::read_budget::ReadWorkLimits;
use crate::application::read_call::{ReadCall, ReadValue};
use crate::kernel::change::ActorId;
use serde_json::json;

fn resolve() -> ReadCall {
    ReadCall::Resolve {
        change: values::identity().change_key(),
        anchor: ChangeAnchor::Beginning,
        limits: ReadLimits::default(),
    }
}
fn frame(reply: &ReadReply<ReadValue>) -> Vec<u8> {
    codec::encode_read_reply(reply, 131072).expect("fixture protocol")
}
fn page() -> (ReadCall, ReadReply<ReadValue>) {
    let range = ChangeRange {
        after: values::position(0),
        through: values::position(3),
    };
    let selection = RecordSelection::AllRecords;
    let call = ReadCall::Change(Box::new(ReadChangeRequest {
        change: values::identity().change_key(),
        range: range.clone(),
        selection: selection.clone(),
        page_cursor: None,
        limits: ReadLimits::default(),
    }));
    let page = ChangePage {
        records: vec![],
        scanned: ChangeRange {
            after: range.after.clone(),
            through: values::position(1),
        },
        observed_head: values::position(4),
        progress: ChangeProgress::More {
            next_page_cursor: Box::new(ChangePageCursor {
                range,
                selection,
                reader: values::identity().owner_actor,
                permission_scope: values::identity().change_key(),
                last_scanned: values::position(1),
            }),
        },
    };
    (call, ReadReply::Returned(ReadValue::Change(Box::new(page))))
}

#[test]
fn semantic_refusals_remain_distinct_from_empty_success_and_protocol_failure() {
    for (reason, name) in [
        (ReadRefusal::Denied, "Denied"),
        (ReadRefusal::Invalid, "Invalid"),
        (ReadRefusal::Changed, "Changed"),
        (ReadRefusal::Unavailable, "Unavailable"),
        (ReadRefusal::Limit, "Limit"),
        (ReadRefusal::Unsupported, "Unsupported"),
    ] {
        let encoded = frame(&ReadReply::Refused(reason));
        assert_eq!(
            super::decode(&encoded, &resolve(), &values::identity(), 131072),
            Ok(json!({"Refused":name}))
        );
    }
    let content = ReadCall::Content {
        membership: values::membership(),
        limits: ReadLimits::default(),
    };
    let empty = frame(&ReadReply::Returned(ReadValue::Content(vec![])));
    assert_eq!(
        super::decode(&empty, &content, &values::identity(), 131072),
        Ok(json!({"Returned":{"Content":{"encoding":"utf8","data":""}}}))
    );
    assert_eq!(
        super::decode(&empty, &resolve(), &values::identity(), 131072),
        Err(AdapterError::ReplyMismatch)
    );
    for end in 0..empty.len() {
        assert_eq!(
            super::decode(&empty[..end], &content, &values::identity(), 131072),
            Err(AdapterError::ReplyCodec)
        );
    }
    let mut bad = empty.clone();
    bad[4..8].copy_from_slice(&3u32.to_be_bytes());
    assert_eq!(
        super::decode(&bad, &content, &values::identity(), 131072),
        Err(AdapterError::ReplyCodec)
    );
    assert_eq!(
        super::decode(&vec![0; 32769], &content, &values::identity(), 131072),
        Err(AdapterError::Limit)
    );
}

#[test]
fn matching_empty_page_preserves_scan_head_and_reusable_cursor_without_claiming_end() {
    let (mut call, reply) = page();
    let ReadCall::Change(request) = &mut call else {
        panic!("family")
    };
    request.selection = RecordSelection::MatchingRecords(crate::application::read::RecordMatch {
        kinds: std::collections::BTreeSet::from([crate::application::read::OperationKind::Finding]),
        ..Default::default()
    });
    let ReadReply::Returned(ReadValue::Change(mut page)) = reply else {
        panic!("page")
    };
    let ChangeProgress::More { next_page_cursor } = &mut page.progress else {
        panic!("continuation")
    };
    next_page_cursor.selection = request.selection.clone();
    let reply = ReadReply::Returned(ReadValue::Change(page));
    let value = super::decode(&frame(&reply), &call, &values::identity(), 131072).expect("page");
    assert_eq!(value["Returned"]["Change"]["records"], json!([]));
    assert_eq!(
        value["Returned"]["Change"]["scanned"]["through"]["sequence"],
        "1"
    );
    assert_eq!(
        value["Returned"]["Change"]["observed_head"]["sequence"],
        "4"
    );
    assert_eq!(
        value["Returned"]["Change"]["progress"]["More"]["next_page_cursor"]["range"]["through"]
            ["sequence"],
        "3"
    );
    let next = json!({"ReadChange":{
        "change":values::key_json(),
        "range":value["Returned"]["Change"]["progress"]["More"]["next_page_cursor"]["range"],
        "selection":value["Returned"]["Change"]["progress"]["More"]["next_page_cursor"]["selection"],
        "page_cursor":value["Returned"]["Change"]["progress"]["More"]["next_page_cursor"],
        "limits":values::limits_json()
    }});
    let mut work = Work::try_new(ReadWorkLimits::default()).expect("work");
    let parsed = crate::adapters::read_adapter::request::decode(
        &serde_json::to_vec(&next).expect("JSON"),
        &mut work,
    )
    .expect("reuse");
    let ReadCall::Change(parsed) = parsed else {
        panic!("family")
    };
    assert_eq!(parsed.page_cursor.expect("cursor").last_scanned.sequence, 1);
}

#[test]
fn reply_positions_and_continuations_cannot_silently_rebind_a_fixed_call() {
    let good = ReadReply::Returned(ReadValue::Position(values::position(0)));
    assert!(super::decode(&frame(&good), &resolve(), &values::identity(), 131072).is_ok());
    let wrong_anchor = ReadReply::Returned(ReadValue::Position(values::position(1)));
    assert_eq!(
        super::decode(
            &frame(&wrong_anchor),
            &resolve(),
            &values::identity(),
            131072
        ),
        Err(AdapterError::ReplyMismatch)
    );
    let mut other = values::identity();
    other.agent = ActorId::from_bytes([99; 16]).expect("nonzero");
    assert_eq!(
        super::decode(&frame(&good), &resolve(), &other, 131072),
        Err(AdapterError::ReplyMismatch)
    );
    for change in 0..5 {
        let (call, reply) = page();
        let ReadReply::Returned(ReadValue::Change(mut p)) = reply else {
            panic!("page")
        };
        match change {
            0 => p.scanned.after = values::position(1),
            1 => p.observed_head = values::position(2),
            2 => p.progress = ChangeProgress::EndOfRange,
            3 | 4 => {
                let ChangeProgress::More { next_page_cursor } = &mut p.progress else {
                    panic!("cursor")
                };
                if change == 3 {
                    next_page_cursor.reader = values::identity().agent;
                } else {
                    next_page_cursor.range.through = values::position(4);
                }
            }
            _ => unreachable!(),
        }
        assert_eq!(
            super::decode(
                &frame(&ReadReply::Returned(ReadValue::Change(p))),
                &call,
                &values::identity(),
                131072
            ),
            Err(AdapterError::ReplyMismatch)
        );
    }
}

#[test]
fn complete_envelope_and_actual_caller_ceiling_apply_even_to_refusals() {
    let reply = ReadReply::Refused(ReadRefusal::Denied);
    let value = super::project(&reply, 131072).expect("refusal");
    let length = serde_json::to_vec(&value).expect("JSON").len();
    assert_eq!(super::project(&reply, length), Ok(value));
    assert_eq!(super::project(&reply, length - 1), Err(AdapterError::Limit));
    let mut call = resolve();
    let ReadCall::Resolve { limits, .. } = &mut call else {
        panic!("family")
    };
    limits.reply_bytes = 1;
    assert_eq!(
        super::decode(&frame(&reply), &call, &values::identity(), 131072),
        Err(AdapterError::Limit)
    );
}
