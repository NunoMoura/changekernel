use crate::adapters::read_adapter::adapter_error::AdapterError;
use crate::adapters::read_adapter::projection::Projection;
use crate::adapters::read_adapter::test_values as values;
use crate::adapters::read_adapter::work::Work;
use crate::application::read::{ChangeAnchor, ChangeRange, ReadLimits, RecordSelection};
use crate::application::read_budget::ReadWorkLimits;
use crate::application::read_call::ReadCall;
use serde_json::{json, Value};

fn parse(value: &Value) -> Result<ReadCall, AdapterError> {
    super::decode(
        &serde_json::to_vec(value).expect("fixture JSON"),
        &mut Work::try_new(ReadWorkLimits::default()).expect("work"),
    )
}
fn history() -> Value {
    let p = Projection::new(131072);
    json!({"ReadChange": {
        "change": values::key_json(),
        "range":p.range(&ChangeRange {after:values::position(0), through:values::position(2)}).expect("range"),
        "selection":"AllRecords", "page_cursor":null, "limits":values::limits_json()
    }})
}

#[test]
fn all_three_requests_preserve_qualified_fields_and_null_presence() {
    let call = parse(&values::resolve_json()).expect("resolve");
    assert!(matches!(
        call,
        ReadCall::Resolve {
            anchor: ChangeAnchor::Beginning,
            ..
        }
    ));
    let call = parse(&history()).expect("history");
    let ReadCall::Change(request) = call else {
        panic!("wrong family")
    };
    assert_eq!(request.range.through, values::position(2));
    assert_eq!(request.selection, RecordSelection::AllRecords);
    assert_eq!(request.page_cursor, None);
    let p = Projection::new(131072);
    let call = parse(&json!({"ReadContent":{
        "membership":p.membership(&values::membership()).expect("membership"),
        "limits":values::limits_json()
    }}))
    .expect("content");
    let ReadCall::Content { membership, limits } = call else {
        panic!("wrong family")
    };
    assert_eq!(membership, values::membership());
    assert_eq!(
        limits,
        ReadLimits {
            reply_bytes: 131072,
            ..ReadLimits::default()
        }
    );
}

#[test]
fn wide_numbers_and_ids_are_exact_not_javascript_numbers_or_normalized_text() {
    for number in [0, 1, 9_007_199_254_740_991, 9_007_199_254_740_993, u64::MAX] {
        let mut value = values::resolve_json();
        value["ResolveChangeCursor"]["anchor"] = json!({"Sequence":number.to_string()});
        let ReadCall::Resolve { anchor, .. } = parse(&value).expect("lossless sequence") else {
            panic!("family")
        };
        assert_eq!(anchor, ChangeAnchor::Sequence(number));
    }
    for sequence in [
        json!(1),
        json!(1.0),
        json!("-1"),
        json!("+1"),
        json!("01"),
        json!("18446744073709551616"),
        json!(""),
        json!("1e3"),
    ] {
        let mut value = values::resolve_json();
        value["ResolveChangeCursor"]["anchor"] = json!({"Sequence":sequence});
        assert_eq!(parse(&value), Err(AdapterError::InvalidRequest));
    }
    for id in [
        "00".repeat(16),
        "FF".repeat(16),
        "f".repeat(31),
        "g".repeat(32),
    ] {
        let mut value = values::resolve_json();
        value["ResolveChangeCursor"]["change"]["owner"] = json!(id);
        assert_eq!(parse(&value), Err(AdapterError::InvalidRequest));
    }
    let mut value = values::resolve_json();
    value["ResolveChangeCursor"]["change"]["owner"] = json!("ff".repeat(16));
    let ReadCall::Resolve { change, .. } = parse(&value).expect("maximum ID") else {
        panic!("family")
    };
    assert_eq!(*change.owner.as_bytes(), [255; 16]);
}

#[test]
fn malformed_duplicate_unknown_and_missing_semantic_fields_fail_closed() {
    let good = serde_json::to_string(&values::resolve_json()).expect("JSON");
    let payload =
        serde_json::to_string(&values::resolve_json()["ResolveChangeCursor"]).expect("payload");
    for text in [
        good.replace(
            "\"anchor\":\"Beginning\"",
            "\"anchor\":\"Beginning\",\"anchor\":\"Current\"",
        ),
        good.replace(
            "\"owner\":",
            "\"owner\":\"01010101010101010101010101010101\",\"owner\":",
        ),
        good.replace(
            "\"scanned_records\":32",
            "\"scanned_records\":32,\"scanned_records\":32",
        ),
        good.replace("\"Beginning\"", "\"UnknownAnchor\""),
        good.replace("\"anchor\":\"Beginning\",", ""),
        format!("{good} null"),
        format!("{{\"ResolveChangeCursor\":{payload},\"ResolveChangeCursor\":{payload}}}"),
    ] {
        assert!(
            super::decode(
                text.as_bytes(),
                &mut Work::try_new(ReadWorkLimits::default()).expect("work")
            )
            .is_err(),
            "{text}"
        );
    }
    for field in [
        "owner_control",
        "verification",
        "authority",
        "path",
        "retry",
    ] {
        let mut value = values::resolve_json();
        value["ResolveChangeCursor"][field] = json!(true);
        assert_eq!(parse(&value), Err(AdapterError::InvalidRequest));
    }
    let mut value = history();
    value["ReadChange"]
        .as_object_mut()
        .expect("object")
        .remove("page_cursor");
    assert_eq!(
        parse(&value),
        Err(AdapterError::InvalidRequest),
        "absent is not null"
    );
    let mut value = history();
    value["ReadChange"]["range"]["after"]
        .as_object_mut()
        .expect("position")
        .remove("operation");
    assert_eq!(parse(&value), Err(AdapterError::InvalidRequest));
    let mut value = history();
    value["ReadChange"]["selection"] =
        json!({"MatchingRecords":{"kinds":[], "operations":[], "actors":[]}});
    assert_eq!(
        parse(&value),
        Err(AdapterError::InvalidRequest),
        "missing references is not an empty set"
    );
}

#[test]
fn matching_sets_reject_duplicates_and_large_collections_without_silent_deduplication() {
    let mut value = history();
    value["ReadChange"]["selection"] = json!({"MatchingRecords":{
        "kinds":["Start", "Start"], "operations":[], "actors":[], "references":[]
    }});
    assert_eq!(parse(&value), Err(AdapterError::InvalidRequest));
    value["ReadChange"]["selection"]["MatchingRecords"]["kinds"] = json!(["Start"]);
    value["ReadChange"]["selection"]["MatchingRecords"]["operations"] = json!((1..=65)
        .map(|n| json!({"change":values::key_json(), "operation":values::hex(n)}))
        .collect::<Vec<_>>());
    assert_eq!(parse(&value), Err(AdapterError::Limit));
    let mut object = values::resolve_json();
    object["ResolveChangeCursor"]["limits"]["reply_bytes"] = json!(u64::MAX);
    assert_eq!(parse(&object), Err(AdapterError::InvalidRequest));
}

#[test]
fn all_reference_selectors_and_operation_kinds_round_trip_without_erasing_qualifiers() {
    use crate::application::read::{
        ActorReference, OperationKind, OperationReference, QualifiedReference, RecordMatch,
    };
    use std::collections::BTreeSet;
    let selection = RecordSelection::MatchingRecords(RecordMatch {
        kinds: BTreeSet::from([
            OperationKind::Start,
            OperationKind::Propose,
            OperationKind::Assess,
            OperationKind::Decide,
            OperationKind::Retract,
            OperationKind::Reaffirm,
            OperationKind::SetGrant,
            OperationKind::RevokeGrant,
            OperationKind::Admit,
            OperationKind::Dispatch,
            OperationKind::Finding,
            OperationKind::Adapt,
            OperationKind::Progress,
            OperationKind::Fulfill,
            OperationKind::Withdraw,
            OperationKind::Reconcile,
        ]),
        operations: BTreeSet::from([OperationReference {
            change: values::identity().change_key(),
            operation: values::id(6),
        }]),
        actors: BTreeSet::from([ActorReference {
            change: values::identity().change_key(),
            actor: values::id(5),
        }]),
        references: BTreeSet::from([
            QualifiedReference::Change(values::identity().change_key()),
            QualifiedReference::Operation(OperationReference {
                change: values::identity().change_key(),
                operation: values::id(6),
            }),
            QualifiedReference::Content(values::content(7)),
            QualifiedReference::Membership(values::membership()),
            QualifiedReference::GroundObservation {
                change: values::identity().change_key(),
                ground: values::id(10),
                version: values::id(11),
            },
        ]),
    });
    let mut request = history();
    request["ReadChange"]["selection"] = Projection::new(131072)
        .selection(&selection)
        .expect("selector projection");
    let ReadCall::Change(parsed) = parse(&request).expect("selectors") else {
        panic!("family")
    };
    assert_eq!(parsed.selection, selection);
}

#[test]
fn request_bytes_and_work_are_admitted_before_serde() {
    assert_eq!(
        super::decode(
            &vec![b' '; 32769],
            &mut Work::try_new(ReadWorkLimits::default()).expect("work")
        ),
        Err(AdapterError::Limit)
    );
    let mut tiny = Work::try_new(ReadWorkLimits {
        allocation_bytes: 1,
        ..ReadWorkLimits::default()
    })
    .expect("positive ceiling");
    assert_eq!(
        super::decode(b"{", &mut tiny),
        Err(AdapterError::Limit),
        "prepayment precedes parsing"
    );
}
