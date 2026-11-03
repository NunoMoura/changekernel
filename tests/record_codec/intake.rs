//! Current qualified-key and original-intake wire boundaries, not provenance authentication.
use super::fixture::{Fixture, TestId};
use super::wire::{self, Value};
use changekernel::adapters::codec::{self, CodecError};
use changekernel::unqualified_change::{
    Access, ActorId, Change, ChangeId, Command, ContentLimits, ContentReference, Disposition,
    Evidence, Finding, GrantAction, HistoryHead, OperationId, OwnerId, StoredOperation,
    CURRENT_PROFILE,
};
use std::collections::BTreeSet;
fn original() -> (Fixture, StoredOperation) {
    let mut f = Fixture::new();
    f.initiate();
    let record = f.ports.records[0].clone();
    (f, record)
}
#[test]
fn complete_content_keys_distinguish_namespaces_and_reject_reordered_typed_duplicates() {
    let (f, mut record) = original();
    let first = record.checks.content_items.keys().next().unwrap().clone();
    let mut second = first.clone();
    second.establishing.change = ChangeId::new();
    let mut third = first.clone();
    third.establishing.owner = OwnerId::new();
    let keys = BTreeSet::from([first.clone(), second.clone(), third]);
    record.retained_content_items = keys.clone();
    record.operation.first_retention = keys.clone();
    record
        .checks
        .content_items
        .insert(second.clone(), b"distinct namespace, same leaf".to_vec());
    let raw = codec::encode_record(&record).unwrap();
    assert_eq!(codec::decode_record(&raw), Ok(record.clone()));
    let duplicate = wire::mutate(&raw, &[4], |all| {
        let mut member = all.iter().find(|x| x.tag == 109).unwrap().clone();
        let Value::Bytes(key) = &mut member.value else {
            unreachable!()
        };
        let mut fields = wire::fields(key);
        fields.reverse();
        *key = wire::encode(&fields);
        all.push(member);
    });
    assert_eq!(codec::decode_record(&duplicate), Err(CodecError::Duplicate));
    let duplicate_map = wire::mutate(&raw, &[4, 5], |all| {
        let mut entry = all.iter().find(|x| x.tag == 7).unwrap().clone();
        let Value::Bytes(value) = &mut entry.value else {
            unreachable!()
        };
        let mut parts = wire::fields(value);
        parts.reverse();
        let Value::Bytes(key) = &mut parts.iter_mut().find(|x| x.tag == 101).unwrap().value else {
            unreachable!()
        };
        let mut qualifier = wire::fields(key);
        qualifier.reverse();
        *key = wire::encode(&qualifier);
        *value = wire::encode(&parts);
        all.push(entry);
    });
    assert_eq!(
        codec::decode_record(&duplicate_map),
        Err(CodecError::Duplicate)
    );
    let request = f.operation_request(record.operation);
    let raw = codec::encode_request(&request).unwrap();
    assert_eq!(codec::decode_request(&raw), Ok(request));
    let invalid = wire::mutate(&raw, &[5, 4], |all| {
        all.push(wire::bytes(
            4,
            wire::encode(&[wire::bytes(2, first.id.as_bytes().to_vec())]),
        ))
    });
    assert_eq!(codec::decode_request(&invalid), Err(CodecError::Presence));
}
#[test]
fn retired_content_and_content_entity_tags_never_alias_qualified_meanings() {
    let (f, record) = original();
    let request = codec::encode_request(&record.operation_request().unwrap()).unwrap();
    assert_eq!(
        codec::decode_request(&wire::mutate(&request, &[5, 4, 2, 1], |all| all
            .iter_mut()
            .find(|x| x.tag == 101)
            .unwrap()
            .tag = 1)),
        Err(CodecError::UnknownField)
    );
    let raw = codec::encode_record(&record).unwrap();
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4], |all| all
            .push(wire::bytes(9, f.key().id.as_bytes().to_vec())))),
        Err(CodecError::UnknownField)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 8], |all| {
            all[0].tag = 9;
        })),
        Err(CodecError::UnknownField)
    );
    // A full envelope from the preceding development format is refused before its payload.
    let old = wire::mutate(&raw, &[], |all| {
        for f in all.iter_mut().filter(|f| f.tag <= 3) {
            f.value = Value::Uint(2);
        }
    });
    assert_eq!(codec::decode_record(&old), Err(CodecError::Version));
}
#[test]
fn original_source_snapshot_presence_oneofs_and_limitation_bytes_are_bounded_before_decode() {
    let (_, record) = original();
    let raw = codec::encode_record(&record).unwrap();
    // Checks.intakes -> entry.snapshot -> source_claim.
    let source = [4, 5, 11, 2, 2];
    for tag in 1..=4 {
        assert_eq!(
            codec::decode_record(&wire::mutate(&raw, &source, |all| all.retain(|x| x.tag != tag))),
            Err(CodecError::Presence)
        );
    }
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 5, 11, 2], |all| all
            .iter_mut()
            .find(|x| x.tag == 1)
            .unwrap()
            .value =
            Value::Uint(3))),
        Err(CodecError::Presence)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &source, |all| all
            .iter_mut()
            .find(|x| x.tag == 1)
            .unwrap()
            .value =
            Value::Uint(3))),
        Err(CodecError::Enum)
    );
    let key = record.checks.content_items.keys().next().unwrap();
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 5, 11, 2, 2, 2], |all| all
            .push(wire::bytes(2, wire::content_key(key))))),
        Err(CodecError::Duplicate)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 5, 11, 2, 2, 3], |all| all
            .push(wire::bytes(2, ActorId::new().as_bytes().to_vec())))),
        Err(CodecError::Duplicate)
    );
    let edge = wire::mutate(&raw, &source, |all| {
        all.iter_mut().find(|x| x.tag == 4).unwrap().value = Value::Bytes(vec![0; 1024 * 1024])
    });
    let decoded = codec::decode_record(&edge).unwrap();
    assert_eq!(
        codec::decode_record(&codec::encode_record(&decoded).unwrap()),
        Ok(decoded)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &source, |all| all
            .iter_mut()
            .find(|x| x.tag == 4)
            .unwrap()
            .value =
            Value::Bytes(vec![0; 1024 * 1024 + 1]))),
        Err(CodecError::Limit)
    );
    let mut excess = record.clone();
    excess
        .checks
        .intakes
        .values_mut()
        .next()
        .unwrap()
        .source_claim
        .limitations = vec![0; 1024 * 1024 + 1];
    assert_eq!(codec::encode_record(&excess), Err(CodecError::Limit));
    let mut unexpected_prior = record.clone();
    unexpected_prior
        .checks
        .intakes
        .values_mut()
        .next()
        .unwrap()
        .prior_establishment = Some(ContentReference {
        identity: record.checks.identity.clone(),
        operation: record.operation.id.clone(),
        content: key.clone(),
    });
    assert_eq!(
        codec::encode_record(&unexpected_prior),
        Err(CodecError::Presence)
    );
    // Decoding structured claims does not validate historical establishment evidence.
    let changed = wire::mutate(&raw, &[4, 5, 11, 2, 2, 2], |all| {
        *all = vec![wire::bytes(2, wire::content_key(key))]
    });
    let decoded = codec::decode_record(&changed).unwrap();
    assert!(Change::reconstruct(
        HistoryHead {
            profile: CURRENT_PROFILE,
            identity: record.checks.identity,
            accepted_operations: 1,
            last_operation: Some(record.operation.id)
        },
        vec![decoded]
    )
    .is_err());
}
#[test]
fn derived_output_original_inputs_and_snapshots_roundtrip_and_restore_without_live_ports() {
    let mut f = Fixture::new();
    f.initiate();
    let key = f.text("accepted source");
    let parent = f
        .execute(Command::Finding {
            finding: Finding {
                agreement: None,
                claim: key.clone(),
                evidence: f.ports.native_evidence.clone(),
                disposition: Disposition::Unknown,
            },
            access: Access::Owner,
        })
        .unwrap();
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    spec.creation = Some(ContentLimits {
        items: 1,
        payload_bytes: 32,
    });
    let g = f.grant(spec);
    f.ports.creation_sources.insert((
        f.identity.clone(),
        f.identity.agent.clone(),
        f.identity.agent.clone(),
    ));
    let mut output = f.fresh(b"derived output");
    output.derived_from.insert(ContentReference {
        identity: f.identity.clone(),
        operation: parent.operation,
        content: key.clone(),
    });
    f.agent();
    let operation = f.operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: output.key.clone(),
                evidence: vec![Evidence {
                    source: f.identity.agent.clone(),
                    content: output.key.clone(),
                    limitations: output.key.clone(),
                }],
                disposition: Disposition::Unknown,
            },
            access: Access::Grant(g),
        },
        vec![output],
    );
    let operation_request = f.operation_request(operation.clone());
    assert_eq!(
        codec::decode_request(&codec::encode_request(&operation_request).unwrap()),
        Ok(operation_request.clone())
    );
    let accepted = f
        .pursuit
        .execute(operation_request.clone(), &mut f.ports)
        .unwrap();
    let originals = f.ports.records.clone();
    let records: Vec<_> = originals
        .iter()
        .map(|r| codec::decode_record(&codec::encode_record(r).unwrap()).unwrap())
        .collect();
    assert_eq!(records, originals);
    f.pursuit = Change::reconstruct(
        HistoryHead {
            profile: CURRENT_PROFILE,
            identity: f.identity.clone(),
            accepted_operations: records.len() as u64,
            last_operation: Some(operation.id),
        },
        records,
    )
    .unwrap();
    assert_eq!(
        f.pursuit.execute(operation_request, &mut f.ports),
        Ok(accepted)
    );
    assert_eq!(f.ports.records, originals);
    let mut forged = originals.clone();
    forged.last_mut().unwrap().operation.fresh[0]
        .derived_from
        .clear();
    let head = HistoryHead {
        profile: CURRENT_PROFILE,
        identity: f.identity,
        accepted_operations: forged.len() as u64,
        last_operation: f.ports.last_operation,
    };
    assert!(Change::reconstruct(head, forged).is_err());
}
