//! Shape regressions at the single-invocation fixture seam, without native execution.
use crate::adapters::codec::{self, CodecError};
use crate::adapters::read_adapter::adapter_error::AdapterError;
use crate::adapters::read_adapter::projection::Projection;
use crate::adapters::read_adapter::request;
use crate::adapters::read_adapter::test_values as values;
use crate::adapters::read_adapter::work::Work;
use crate::application::read::{ChangeRange, ReadRefusal, ReadReply};
use crate::application::read_budget::ReadWorkLimits;
use serde_json::{json, Value};
use std::cell::Cell;

// Declaration order matters: these arrays would be valid positional records under
// an ordinary Serde derive. JSON map iteration order would miss that regression.
const RECORD_FIELDS: &[&[&str]] = &[
    &["change", "anchor", "limits"],
    &["change", "range", "selection", "page_cursor", "limits"],
    &["membership", "limits"],
    &["owner", "ledger", "change"],
    &["owner", "owner_actor", "ledger", "change", "agent"],
    &["establishing", "id"],
    &["identity", "operation", "content"],
    &["codec", "schema", "semantic"],
    &["identity", "profile"],
    &["source", "sequence", "operation"],
    &["after", "through"],
    &["change", "operation"],
    &["change", "actor"],
    &["change", "ground", "version"],
    &["kinds", "operations", "actors", "references"],
    &[
        "range",
        "selection",
        "reader",
        "permission_scope",
        "last_scanned",
    ],
    &["scanned_records", "returned_records", "reply_bytes"],
];

fn requests() -> [Value; 3] {
    let projection = Projection::new(131072);
    let range = projection
        .range(&ChangeRange {
            after: values::position(0),
            through: values::position(2),
        })
        .expect("range");
    let membership = projection
        .membership(&values::membership())
        .expect("membership");
    let operation = json!({"change": values::key_json(), "operation": values::hex(6)});
    let selection = json!({"MatchingRecords": {
        "kinds": ["Start", "Finding"],
        "operations": [operation],
        "actors": [{"change": values::key_json(), "actor": values::hex(5)}],
        "references": [
            {"Change": values::key_json()},
            {"Operation": operation},
            {"Content": membership["content"]},
            {"Membership": membership},
            {"GroundObservation": {
                "change": values::key_json(), "ground": values::hex(10), "version": values::hex(11)
            }}
        ]
    }});
    let cursor = json!({
        "range": range,
        "selection": selection,
        "reader": values::hex(2),
        "permission_scope": values::key_json(),
        "last_scanned": projection.position(&values::position(1)).expect("position")
    });
    [
        values::resolve_json(),
        json!({"ReadChange": {
            "change": values::key_json(), "range": range, "selection": selection,
            "page_cursor": cursor, "limits": values::limits_json()
        }}),
        json!({"ReadContent": {"membership": membership, "limits": values::limits_json()}}),
    ]
}

struct RecordSite {
    pointer: String,
    fields: &'static [&'static str],
}

// Visit every occurrence, including repeated records inside selectors and cursors.
// The only other objects in these fixtures are single-key enum envelopes.
fn record_sites(value: &Value, pointer: &str, sites: &mut Vec<RecordSite>) {
    match value {
        Value::Object(object) => {
            if let Some(fields) = RECORD_FIELDS.iter().find(|fields| {
                fields.len() == object.len()
                    && fields.iter().all(|field| object.contains_key(*field))
            }) {
                sites.push(RecordSite {
                    pointer: pointer.to_owned(),
                    fields,
                });
            } else {
                assert_eq!(object.len(), 1, "unknown fixture record at {pointer}");
            }
            for (field, child) in object {
                record_sites(child, &format!("{pointer}/{field}"), sites);
            }
        }
        Value::Array(array) => {
            for (index, child) in array.iter().enumerate() {
                record_sites(child, &format!("{pointer}/{index}"), sites);
            }
        }
        _ => {}
    }
}

fn assert_admitted(value: &Value) {
    let bytes = serde_json::to_vec(value).expect("request JSON");
    let expected = request::decode(
        &bytes,
        &mut Work::try_new(ReadWorkLimits::default()).expect("work"),
    )
    .expect("named objects and schema arrays decode");
    let calls = Cell::new(0);
    let result = super::run(
        &bytes,
        &values::identity(),
        ReadWorkLimits::default(),
        |frame, _| {
            calls.set(calls.get() + 1);
            assert_eq!(
                codec::decode_read_call(frame).expect("protocol call"),
                expected
            );
            codec::encode_read_reply(&ReadReply::Refused(ReadRefusal::Denied), 131072)
        },
    );
    assert_eq!(calls.get(), 1);
    assert_eq!(result, Ok(json!({"Refused": "Denied"})));
}

fn assert_invalid(bytes: &[u8], site: &str) {
    let calls = Cell::new(0);
    let result = super::run(
        bytes,
        &values::identity(),
        ReadWorkLimits::default(),
        |_, _| {
            calls.set(calls.get() + 1);
            Err(CodecError::Limit)
        },
    );
    assert_eq!(calls.get(), 0, "invalid shape reached backend at {site}");
    assert_eq!(result, Err(AdapterError::InvalidRequest), "{site}");
}

#[test]
fn named_records_reject_positional_arrays_and_nonobjects_before_invocation() {
    for request in requests() {
        assert_admitted(&request);
        let mut sites = Vec::new();
        record_sites(&request, "", &mut sites);
        for site in sites {
            let record = request.pointer(&site.pointer).expect("record");
            let positional = Value::Array(
                site.fields
                    .iter()
                    .map(|field| record[*field].clone())
                    .collect(),
            );
            for wrong in [
                positional,
                json!([]),
                json!(false),
                json!(0),
                json!("object"),
                Value::Null,
            ] {
                // This one record is optional; explicit null is its valid absence.
                if wrong.is_null() && site.pointer == "/ReadChange/page_cursor" {
                    continue;
                }
                let mut malformed = request.clone();
                *malformed.pointer_mut(&site.pointer).expect("record") = wrong;
                assert_invalid(
                    &serde_json::to_vec(&malformed).expect("JSON"),
                    &site.pointer,
                );
            }
        }
        // The externally tagged call envelope itself must not become an array.
        assert_invalid(
            &serde_json::to_vec(&json!([request])).expect("JSON"),
            "call envelope",
        );
    }
}

#[test]
fn every_named_record_keeps_missing_duplicate_and_unknown_field_checks() {
    for request in requests() {
        let mut sites = Vec::new();
        record_sites(&request, "", &mut sites);
        for site in sites {
            let mut unknown = request.clone();
            unknown.pointer_mut(&site.pointer).expect("record")["unexpected"] = json!(true);
            assert_invalid(&serde_json::to_vec(&unknown).expect("JSON"), &site.pointer);
            for field in site.fields {
                let mut missing = request.clone();
                missing
                    .pointer_mut(&site.pointer)
                    .expect("record")
                    .as_object_mut()
                    .expect("object")
                    .remove(*field);
                assert_invalid(&serde_json::to_vec(&missing).expect("JSON"), &site.pointer);

                // Value maps cannot retain duplicate keys. Splice one raw duplicate
                // record into a uniquely marked location in otherwise ordinary JSON.
                let record = request.pointer(&site.pointer).expect("record");
                let mut duplicate = serde_json::to_string(record).expect("record JSON");
                assert_eq!(duplicate.pop(), Some('}'));
                duplicate.push_str(&format!(
                    ",{}:{}}}",
                    serde_json::to_string(field).expect("field JSON"),
                    serde_json::to_string(&record[*field]).expect("value JSON"),
                ));
                let mut marked = request.clone();
                *marked.pointer_mut(&site.pointer).expect("record") =
                    json!("DUPLICATE_RECORD_SITE");
                let marked = serde_json::to_string(&marked).expect("marked JSON");
                let marker = "\"DUPLICATE_RECORD_SITE\"";
                assert_eq!(marked.matches(marker).count(), 1);
                assert_invalid(marked.replace(marker, &duplicate).as_bytes(), &site.pointer);
            }
        }
    }
}

#[test]
fn selector_collections_stay_arrays_and_optional_values_stay_explicit() {
    let [_, history, _] = requests();
    for selector in [
        "/ReadChange/selection/MatchingRecords",
        "/ReadChange/page_cursor/selection/MatchingRecords",
    ] {
        let mut empty = history.clone();
        for field in ["kinds", "operations", "actors", "references"] {
            empty.pointer_mut(selector).expect("matcher")[field] = json!([]);
            for wrong in [json!({}), Value::Null, json!("[]"), json!(false), json!(0)] {
                let mut malformed = history.clone();
                malformed.pointer_mut(selector).expect("matcher")[field] = wrong;
                assert_invalid(&serde_json::to_vec(&malformed).expect("JSON"), field);
            }
        }
        assert_admitted(&empty);
    }
    let mut all = history.clone();
    all["ReadChange"]["selection"] = json!("AllRecords");
    all["ReadChange"]["page_cursor"]["selection"] = json!("AllRecords");
    assert_admitted(&all);
    all["ReadChange"]["page_cursor"] = Value::Null;
    assert_admitted(&all);
    let mut matching_without_cursor = history.clone();
    matching_without_cursor["ReadChange"]["page_cursor"] = Value::Null;
    assert_admitted(&matching_without_cursor);

    // Positions exercise both null and present operation IDs; neither is an array.
    for position in ["after", "through"] {
        for wrong in [json!([]), json!([values::hex(6)]), json!({})] {
            let mut malformed = history.clone();
            malformed["ReadChange"]["range"][position]["operation"] = wrong;
            assert_invalid(&serde_json::to_vec(&malformed).expect("JSON"), position);
        }
    }
    for wrong in [Value::Null, json!([]), json!({}), json!(false)] {
        let mut malformed = history.clone();
        malformed["ReadChange"]["selection"] = wrong;
        assert_invalid(&serde_json::to_vec(&malformed).expect("JSON"), "selection");
    }
}
