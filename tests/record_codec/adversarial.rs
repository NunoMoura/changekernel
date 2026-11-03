use super::fixture::{self, Fixture, TestId};
use super::wire::{self, Value};
use changekernel::adapters::codec::{self, CodecError};
use changekernel::unqualified_change::{
    Access, ActionId, ActionOutcome, ActorId, ChangeBasis, Command, Disposition, Error, Evidence,
    Finding, FreshContent, GrantAction, GrantId, GrantTarget, GrantUse, OperationId,
    OperationRequest, OperationRequestError, Progress, ProgressDimension, ProgressValue,
    StoredOperation,
};
use std::collections::BTreeSet;

fn request() -> OperationRequest {
    let f = Fixture::new();
    f.operation_request(fixture::new_operation(
        OperationId::new(),
        Command::Initiate {
            wish: f.key(),
            access: Access::Owner,
        },
        vec![],
        &f,
    ))
}

fn record() -> StoredOperation {
    let mut f = Fixture::new();
    f.initiate();
    f.ports.records.remove(0)
}
fn rejected(raw: &[u8]) {
    assert!(codec::decode_request(raw).is_err());
}

#[test]
fn frames_are_exact_bounded_and_kind_specific_at_every_cut() {
    let raw = codec::encode_request(&request()).unwrap();
    for end in 0..raw.len() {
        rejected(&raw[..end]);
    }
    let mut trailing = raw.clone();
    trailing.push(0);
    rejected(&trailing);
    let mut joined = raw.clone();
    joined.extend(&raw);
    rejected(&joined);
    let mut length = raw.clone();
    length[4..8].copy_from_slice(&u32::MAX.to_be_bytes());
    rejected(&length);
    let r = codec::encode_record(&record()).unwrap();
    assert!(codec::decode_request(&r).is_err());
    assert!(codec::decode_record(&raw).is_err());
    for end in 0..r.len() {
        assert!(codec::decode_record(&r[..end]).is_err());
    }
    assert!(codec::decode_request(&raw).is_ok());
    assert!(codec::decode_record(&r).is_ok());
}

#[test]
fn versions_presence_singulars_oneofs_and_wire_types_are_strict() {
    let raw = codec::encode_request(&request()).unwrap();
    for tag in [1, 2, 3, 5] {
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[], |f| f.retain(|x| x.tag != tag))),
            Err(CodecError::Presence)
        );
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[], |f| {
                let x = f.iter().find(|x| x.tag == tag).unwrap().clone();
                f.push(x);
            })),
            Err(CodecError::Duplicate)
        );
    }
    for tag in 1..=3 {
        for version in [0, 1, u32::MAX as u64, u64::MAX] {
            assert_eq!(
                codec::decode_request(&wire::mutate(&raw, &[], |f| f
                    .iter_mut()
                    .find(|x| x.tag == tag)
                    .unwrap()
                    .value =
                    Value::Uint(version))),
                Err(CodecError::Version)
            );
        }
    }
    // Required request ID and Command oneof. Owner is an explicitly present empty message.
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4], |f| f.retain(|x| x.tag != 1))),
        Err(CodecError::Presence)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4, 2], Vec::clear)),
        Err(CodecError::Presence)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4, 2], |f| f.push(wire::bytes(
            15,
            wire::encode(&[wire::bytes(1, vec![1; 16])])
        )))),
        Err(CodecError::Duplicate)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4, 2, 1, 2], Vec::clear)),
        Err(CodecError::Presence)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4, 2, 1, 2], |f| f.push(f[0].clone()))),
        Err(CodecError::Duplicate)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[], |f| f.push(wire::uint(99, 1)))),
        Err(CodecError::UnknownField)
    );
    assert_eq!(
        codec::decode_request(
            &wire::mutate(&raw, &[5, 4, 2, 1, 2, 1], |f| f.push(wire::uint(1, 1)))
        ),
        Err(CodecError::UnknownField)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[], |f| f[0].value = Value::Bytes(vec![1]))),
        Err(CodecError::Wire)
    );
    for bytes in [
        vec![0],
        vec![8, 128],
        vec![8, 255, 255, 255, 255, 255, 255, 255, 255, 255, 2],
        vec![11, 12],
        vec![13, 0, 0, 0, 0],
        vec![9, 0, 0, 0, 0, 0, 0, 0, 0],
    ] {
        rejected(&wire::framed(b"CKQ\0", bytes));
    }
    let r = codec::encode_record(&record()).unwrap();
    assert_eq!(
        codec::decode_record(&wire::mutate(&r, &[4], |f| f
            .iter_mut()
            .find(|x| x.tag == 1)
            .unwrap()
            .value = Value::Uint(1))),
        Err(CodecError::Version)
    );
}

#[test]
fn invalid_nested_ids_enums_booleans_and_missing_meaningful_scalars_fail() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let raw = codec::encode_request(&f.operation_request(fixture::new_operation(
        OperationId::new(),
        Command::Propose {
            proposal: p,
            access: Access::Owner,
        },
        vec![],
        &f,
    )))
    .unwrap();
    for invalid in [vec![], vec![0; 16], vec![1; 15], vec![1; 17]] {
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[5, 4, 2, 2, 1, 3], |fs| fs
                .iter_mut()
                .find(|x| x.tag == 1)
                .unwrap()
                .value =
                Value::Bytes(invalid))),
            Err(CodecError::Id)
        );
    }
    let finding = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: f.key(),
                evidence: vec![],
                disposition: Disposition::Unknown,
            },
            access: Access::Owner,
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(finding.clone())).unwrap();
    for value in [0, 4, 127, u64::MAX] {
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[5, 4, 2, 11, 1], |fs| fs
                .iter_mut()
                .find(|x| x.tag == 4)
                .unwrap()
                .value =
                Value::Uint(value))),
            Err(CodecError::Enum)
        );
    }
    let mut spec = f.draft_spec(BTreeSet::from([GrantAction::Finding]));
    spec.target = GrantTarget::Pursuit(f.status().current_agreement.unwrap());
    let agreement = f.status().current_agreement.clone();
    let grant = f.grant(spec);
    f.agent();
    f.execute(Command::Finding {
        finding: Finding {
            agreement,
            claim: f.ports.native_evidence[0].content.clone(),
            evidence: f.ports.native_evidence.clone(),
            disposition: Disposition::Unknown,
        },
        access: Access::Grant(grant),
    })
    .unwrap();
    let r = codec::encode_record(f.ports.records.last().unwrap()).unwrap();
    // Grant snapshot revoked=false must have explicit presence and a real bool, not prost's
    // usual "any nonzero means true" normalization.
    assert_eq!(
        codec::decode_record(&wire::mutate(&r, &[4, 7], |fs| fs.retain(|x| x.tag != 4))),
        Err(CodecError::Presence)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&r, &[4, 7], |fs| fs
            .iter_mut()
            .find(|x| x.tag == 4)
            .unwrap()
            .value = Value::Uint(2))),
        Err(CodecError::Enum)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&r, &[4, 7], |fs| fs.push(wire::uint(4, 0)))),
        Err(CodecError::Duplicate)
    );
    // Sequence zero remains a typed value; missing sequence is never silently defaulted.
    assert_eq!(
        codec::decode_record(&wire::mutate(&r, &[4], |fs| fs.retain(|x| x.tag != 2))),
        Err(CodecError::Presence)
    );
}

#[test]
fn typed_duplicate_sets_and_maps_fail_even_with_different_legal_field_order() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::Progress {
            progress: Progress {
                agreement: p.agreement,
                terms: BTreeSet::from([p.terms.binding[0].statement.clone()]),
                criteria: BTreeSet::new(),
                evidence: f.ports.native_evidence.clone(),
                understanding: ProgressDimension {
                    value: ProgressValue::Advanced,
                    assessment: f.text("learned"),
                },
                outcome: ProgressDimension {
                    value: ProgressValue::Unknown,
                    assessment: f.text("not proven"),
                },
                basis: ChangeBasis::Observation,
            },
            access: Access::Owner,
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(operation.clone())).unwrap();
    let duplicate = wire::mutate(&raw, &[5, 4, 2, 13, 1], |fs| {
        let mut field = fs.iter().find(|x| x.tag == 2).unwrap().clone();
        let Value::Bytes(v) = &mut field.value else {
            unreachable!()
        };
        let mut all = wire::fields(v);
        all.reverse();
        *v = wire::encode(&all);
        fs.push(field);
    });
    assert_eq!(
        codec::decode_request(&duplicate),
        Err(CodecError::Duplicate)
    );
    let r = codec::encode_record(&record()).unwrap();
    for change_value in [false, true] {
        let duplicate = wire::mutate(&r, &[4, 5], |fs| {
            let mut field = fs.iter().find(|x| x.tag == 7).unwrap().clone();
            let Value::Bytes(v) = &mut field.value else {
                unreachable!()
            };
            let mut all = wire::fields(v);
            if change_value {
                all.iter_mut().find(|x| x.tag == 2).unwrap().value =
                    Value::Bytes(b"changed".to_vec());
            }
            all.reverse();
            *v = wire::encode(&all);
            fs.push(field);
        });
        assert_eq!(codec::decode_record(&duplicate), Err(CodecError::Duplicate));
    }
}

#[test]
fn legal_noncanonical_order_and_packed_enums_preserve_typed_retry_identity() {
    let mut f = Fixture::new();
    f.initiate();
    let original = f.ports.records[0].clone();
    let raw = codec::encode_request(&original.operation_request().unwrap()).unwrap();
    let reordered = wire::mutate(&raw, &[], |all| all.reverse());
    let reordered = wire::mutate(&reordered, &[5, 4, 2, 1], |all| all.reverse());
    assert_ne!(raw, reordered);
    assert_eq!(
        codec::decode_request(&reordered),
        Ok(original.operation_request().unwrap())
    );
    let count = f.ports.records.len();
    assert_eq!(
        f.pursuit
            .execute(codec::decode_request(&reordered).unwrap(), &mut f.ports),
        Ok(original.accepted.clone())
    );
    assert_eq!(f.ports.records.len(), count);
    assert_eq!(reordered[0..4], raw[0..4]);
    let mut nonminimal = raw[8..].to_vec(); // Legal overlong varint encoding of the first key.
    nonminimal[0] |= 128;
    nonminimal.insert(1, 0);
    assert_eq!(
        codec::decode_request(&wire::framed(b"CKQ\0", nonminimal)),
        Ok(original.operation_request().unwrap())
    );
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::SetGrant {
            id: GrantId::new(),
            expected_generation: None,
            spec: f.draft_spec(BTreeSet::from([GrantAction::Finding, GrantAction::Propose])),
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(operation.clone())).unwrap();
    let packed = wire::mutate(&raw, &[5, 4, 2, 7, 3], |fs| {
        fs.retain(|x| x.tag != 3);
        fs.push(wire::bytes(3, vec![2, 4]));
    });
    // Enum numbers are explicit, not Rust discriminants: Propose=2, Finding=4.
    assert_eq!(
        codec::decode_request(&packed),
        Ok(f.operation_request(operation))
    );
    let duplicate = wire::mutate(&packed, &[5, 4, 2, 7, 3], |fs| {
        fs.retain(|x| x.tag != 3);
        fs.push(wire::bytes(3, vec![4, 4]));
    });
    assert_eq!(
        codec::decode_request(&duplicate),
        Err(CodecError::Duplicate)
    );
}

fn fresh_request(items: usize, bytes_per_item: usize) -> OperationRequest {
    let f = Fixture::new();
    let mut operation = request();
    operation.operation.fresh = (0..items)
        .map(|_| FreshContent {
            key: f.key(),
            derived_from: BTreeSet::new(),
            bytes: vec![7; bytes_per_item],
            attributed_source: ActorId::new(),
        })
        .collect();
    operation
}
#[test]
fn fresh_and_content_caps_apply_before_decode_without_recharging_other_copies() {
    let f = Fixture::new();
    let operation = fresh_request(64, 0);
    let raw = codec::encode_request(&operation).unwrap();
    assert_eq!(codec::decode_request(&raw), Ok(operation));
    assert_eq!(
        codec::encode_request(&fresh_request(65, 0)),
        Err(CodecError::Limit)
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4], |f| f
            .push(f.iter().find(|x| x.tag == 3).unwrap().clone()))),
        Err(CodecError::Limit)
    );
    let operation = fresh_request(8, 1024 * 1024);
    let raw = codec::encode_request(&operation).unwrap();
    assert_eq!(codec::decode_request(&raw), Ok(operation.clone()));
    let mut excess = operation;
    excess.operation.fresh.push(FreshContent {
        key: f.key(),
        derived_from: BTreeSet::new(),
        bytes: vec![1],
        attributed_source: ActorId::new(),
    });
    assert_eq!(codec::encode_request(&excess), Err(CodecError::Limit));
    let extra = wire::encode(&[
        wire::bytes(101, wire::content_key(&f.key())),
        wire::bytes(2, vec![1]),
        wire::bytes(3, ActorId::new().as_bytes().to_vec()),
    ]);
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4], |f| f.push(wire::bytes(3, extra)))),
        Err(CodecError::Limit)
    );
    assert_eq!(
        codec::encode_request(&fresh_request(1, 1024 * 1024 + 1)),
        Err(CodecError::Limit)
    );
    let mut one = fresh_request(1, 0);
    let small = codec::encode_request(&one).unwrap();
    assert_eq!(
        codec::decode_request(&wire::mutate(&small, &[5, 4, 3], |fs| fs
            .iter_mut()
            .find(|x| x.tag == 2)
            .unwrap()
            .value =
            Value::Bytes(vec![0; 1024 * 1024 + 1]))),
        Err(CodecError::Limit)
    );
    one.operation.fresh.push(one.operation.fresh[0].clone());
    assert_eq!(codec::encode_request(&one), Err(CodecError::Duplicate));
    assert_eq!(
        codec::decode_request(&wire::mutate(&small, &[5, 4], |fs| fs
            .push(fs.iter().find(|x| x.tag == 3).unwrap().clone()))),
        Err(CodecError::Duplicate)
    );
    // More than 8MiB of ordinary retained bytes is not Operation.fresh usage.
    let mut r = record();
    for _ in 0..9 {
        r.checks.content_items.insert(f.key(), vec![0; 1024 * 1024]);
    }
    let raw = codec::encode_record(&r).unwrap();
    assert_eq!(codec::decode_record(&raw), Ok(r));
}

#[test]
fn repeated_caps_preserve_list_order_and_count_packed_values_not_containers() {
    let f = Fixture::new();
    let evidence = Evidence {
        source: ActorId::new(),
        content: f.key(),
        limitations: f.key(),
    };
    let mut operation = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: f.key(),
                evidence: vec![evidence; 4096],
                disposition: Disposition::Supports,
            },
            access: Access::Owner,
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(operation.clone())).unwrap();
    assert_eq!(
        codec::decode_request(&raw),
        Ok(f.operation_request(operation.clone()))
    );
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4, 2, 11, 1], |fs| fs
            .push(fs.iter().find(|x| x.tag == 3).unwrap().clone()))),
        Err(CodecError::Limit)
    );
    let Command::Finding { finding, .. } = &mut operation.command else {
        unreachable!()
    };
    finding.evidence.push(finding.evidence[0].clone());
    assert_eq!(
        codec::encode_request(&f.operation_request(operation.clone())),
        Err(CodecError::Limit)
    );
    let mut f = Fixture::new();
    f.initiate();
    let grant = fixture::new_operation(
        OperationId::new(),
        Command::SetGrant {
            id: GrantId::new(),
            expected_generation: None,
            spec: f.draft_spec(BTreeSet::from([GrantAction::Finding])),
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(grant.clone())).unwrap();
    let many = wire::mutate(&raw, &[5, 4, 2, 7, 3], |fs| {
        fs.retain(|x| x.tag != 3);
        fs.push(wire::bytes(3, vec![4; 4097]));
    });
    assert_eq!(codec::decode_request(&many), Err(CodecError::Limit));
}

#[test]
fn full_frame_limit_includes_header_and_accepts_the_exact_edge() {
    let f = Fixture::new();
    let r = codec::encode_record(&record()).unwrap();
    let mut raw = wire::mutate(&r, &[4, 5], |fs| {
        for _ in 0..15 {
            fs.push(wire::bytes(
                7,
                wire::encode(&[
                    wire::bytes(101, wire::content_key(&f.key())),
                    wire::bytes(2, vec![0; 1024 * 1024]),
                ]),
            ));
        }
        fs.push(wire::bytes(
            7,
            wire::encode(&[
                wire::bytes(101, wire::content_key(&f.key())),
                wire::bytes(2, vec![]),
            ]),
        ));
    });
    let target = 16 * 1024 * 1024;
    let mut padding = target - raw.len();
    for _ in 0..4 {
        raw = wire::mutate(&raw, &[4, 5], |fs| {
            let Value::Bytes(entry) = &mut fs.last_mut().unwrap().value else {
                unreachable!()
            };
            let mut parts = wire::fields(entry);
            parts.iter_mut().find(|f| f.tag == 2).unwrap().value = Value::Bytes(vec![0; padding]);
            *entry = wire::encode(&parts);
        });
        if raw.len() == target {
            break;
        }
        padding = (padding as isize + target as isize - raw.len() as isize) as usize;
    }
    assert_eq!(raw.len(), target);
    let decoded = codec::decode_record(&raw).unwrap();
    assert_eq!(codec::encode_record(&decoded).unwrap().len(), target);
    let excess = wire::mutate(&raw, &[4, 5], |fs| {
        let Value::Bytes(entry) = &mut fs.last_mut().unwrap().value else {
            unreachable!()
        };
        let mut parts = wire::fields(entry);
        let Value::Bytes(v) = &mut parts.iter_mut().find(|f| f.tag == 2).unwrap().value else {
            unreachable!()
        };
        v.push(0);
        *entry = wire::encode(&parts);
    });
    assert_eq!(excess.len(), target + 1);
    assert_eq!(codec::decode_record(&excess), Err(CodecError::Limit));
    let mut decoded = decoded;
    let id = f.key();
    decoded.checks.content_items.insert(id, vec![0]);
    assert_eq!(codec::encode_record(&decoded), Err(CodecError::Limit));
}

#[test]
fn every_scalar_enum_family_and_nested_map_presence_has_a_real_guard() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    let progress = fixture::new_operation(
        OperationId::new(),
        Command::Progress {
            progress: Progress {
                agreement: p.agreement.clone(),
                terms: BTreeSet::from([p.terms.binding[0].statement.clone()]),
                criteria: BTreeSet::new(),
                evidence: f.ports.native_evidence.clone(),
                understanding: ProgressDimension {
                    value: ProgressValue::Advanced,
                    assessment: f.text("understanding"),
                },
                outcome: ProgressDimension {
                    value: ProgressValue::Regressed,
                    assessment: f.text("outcome"),
                },
                basis: ChangeBasis::Observation,
            },
            access: Access::Owner,
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(progress.clone())).unwrap();
    for (path, tag) in [
        (vec![5, 4, 2, 13, 1, 5], 1),
        (vec![5, 4, 2, 13, 1, 6], 1),
        (vec![5, 4, 2, 13, 1], 7),
    ] {
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &path, |fs| fs
                .iter_mut()
                .find(|x| x.tag == tag)
                .unwrap()
                .value =
                Value::Uint(255))),
            Err(CodecError::Enum)
        );
    }
    let reconcile = fixture::new_operation(
        OperationId::new(),
        Command::Reconcile {
            action: ActionId::new(),
            grant: GrantUse {
                id: GrantId::new(),
                generation: 1,
            },
            evidence: f.ports.native_evidence.clone(),
            outcome: ActionOutcome::Unknown,
        },
        vec![],
        &f,
    );
    let raw = codec::encode_request(&f.operation_request(reconcile.clone())).unwrap();
    assert_eq!(
        codec::decode_request(&wire::mutate(&raw, &[5, 4, 2, 16], |fs| fs
            .iter_mut()
            .find(|x| x.tag == 4)
            .unwrap()
            .value =
            Value::Uint(255))),
        Err(CodecError::Enum)
    );
    let raw = codec::encode_record(&record()).unwrap();
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 5, 7], |fs| fs.retain(|x| x.tag != 2))),
        Err(CodecError::Presence)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 5, 7], |fs| fs.push(fs[0].clone()))),
        Err(CodecError::Duplicate)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 4, 4], |fs| fs.push(wire::bytes(99, vec![])))),
        Err(CodecError::UnknownField)
    );
    assert_eq!(
        codec::decode_record(&wire::mutate(&raw, &[4, 4, 4], |fs| fs.push(wire::bytes(11, vec![])))),
        Err(CodecError::Duplicate)
    );
}

#[test]
fn repeated_list_order_is_preserved_and_changed_order_is_not_an_exact_retry() {
    let mut f = Fixture::new();
    f.initiate();
    let first = Evidence {
        source: f.identity.owner_actor.clone(),
        content: f.text("earlier observation"),
        limitations: f.text("earlier limits"),
    };
    let second = Evidence {
        source: f.identity.owner_actor.clone(),
        content: f.text("later observation"),
        limitations: f.text("later limits"),
    };
    let operation = fixture::new_operation(
        OperationId::new(),
        Command::Finding {
            finding: Finding {
                agreement: None,
                claim: f.text("source order matters"),
                evidence: vec![first.clone(), second.clone()],
                disposition: Disposition::Supports,
            },
            access: Access::Owner,
        },
        vec![],
        &f,
    );
    let accepted = f
        .pursuit
        .execute(f.operation_request(operation.clone()), &mut f.ports)
        .unwrap();
    let raw = codec::encode_request(&f.operation_request(operation.clone())).unwrap();
    assert_eq!(
        codec::decode_request(&raw),
        Ok(f.operation_request(operation.clone()))
    );
    let reordered = wire::mutate(&raw, &[5, 4, 2, 11, 1], |fields| {
        let indices = fields
            .iter()
            .enumerate()
            .filter(|(_, f)| f.tag == 3)
            .map(|(i, _)| i)
            .collect::<Vec<_>>();
        fields.swap(indices[0], indices[1]);
    });
    let changed = codec::decode_request(&reordered).unwrap();
    let Command::Finding { finding, .. } = &changed.operation.command else {
        unreachable!()
    };
    assert_eq!(finding.evidence, vec![second, first]);
    let count = f.ports.records.len();
    assert_eq!(
        f.pursuit.execute(changed, &mut f.ports),
        Err(OperationRequestError::Refused(Error::Conflict))
    );
    assert_eq!(f.ports.records.len(), count);
    assert_eq!(
        f.pursuit
            .execute(codec::decode_request(&raw).unwrap(), &mut f.ports),
        Ok(accepted)
    );
    // Passing defensive wire ceilings never supplies a recording grant.
    let over_permission = f.operation_request(fresh_request(64, 0).operation);
    let decoded = codec::decode_request(&codec::encode_request(&over_permission).unwrap()).unwrap();
    assert_eq!(
        f.pursuit.execute(decoded, &mut f.ports),
        Err(OperationRequestError::Refused(Error::Denied))
    );
}

#[test]
fn nested_truncation_and_huge_declared_lengths_fail_inside_valid_outer_frames() {
    let raw = codec::encode_request(&request()).unwrap();
    // Rebuild a correct outer length around an invalid nested Command/Initiate payload.
    for broken in [
        {
            let mut v = wire::var((101 << 3) | 2);
            v.extend([16, 1]);
            v
        },
        {
            let mut v = wire::var((101 << 3) | 2);
            v.push(128);
            v
        },
        {
            let mut bytes = wire::var((101 << 3) | 2);
            bytes.extend(wire::var(u64::MAX));
            bytes
        },
    ] {
        let raw = wire::mutate(&raw, &[5, 4], |operation| {
            operation.iter_mut().find(|f| f.tag == 2).unwrap().value =
                Value::Bytes(wire::encode(&[wire::bytes(1, broken)]));
        });
        assert_eq!(codec::decode_request(&raw), Err(CodecError::Malformed));
    }
    // The parent protobuf envelope itself must not trust an attacker-provided allocation size.
    let mut body = wire::encode(&[wire::uint(1, 2), wire::uint(2, 2), wire::uint(3, 2)]);
    body.push(42);
    body.extend(wire::var(u64::MAX));
    assert!(codec::decode_request(&wire::framed(b"CKQ\0", body)).is_err());
}

#[test]
fn complete_tuple_gate_precedes_any_payload_schema_for_both_frame_kinds() {
    for (magic, payload) in [(b"CKQ\0", 5), (b"CKR\0", 4)] {
        for codec in [0, 1, 2, 3, u64::MAX] {
            for schema in [0, 1, 2, 3, u64::MAX] {
                for semantic in [0, 1, 2, 3, u64::MAX] {
                    // Valid opaque span, deliberately malformed nested protobuf. Payload first.
                    let raw = wire::framed(
                        magic,
                        wire::encode(&[
                            wire::bytes(payload, vec![255]),
                            wire::uint(3, semantic),
                            wire::uint(1, codec),
                            wire::uint(2, schema),
                        ]),
                    );
                    let error = if magic == b"CKQ\0" {
                        codec::decode_request(&raw).unwrap_err()
                    } else {
                        codec::decode_record(&raw).unwrap_err()
                    };
                    assert_eq!(
                        error,
                        if (codec, schema, semantic) == (3, 3, 3) {
                            CodecError::Malformed
                        } else {
                            CodecError::Version
                        }
                    );
                }
            }
        }
        for absent in 1..=3 {
            let mut fields = vec![
                wire::bytes(payload, vec![255]),
                wire::uint(1, 2),
                wire::uint(2, 2),
                wire::uint(3, 2),
            ];
            fields.retain(|f| f.tag != absent);
            let raw = wire::framed(magic, wire::encode(&fields));
            let error = if magic == b"CKQ\0" {
                codec::decode_request(&raw).unwrap_err()
            } else {
                codec::decode_record(&raw).unwrap_err()
            };
            assert_eq!(error, CodecError::Presence);
            fields.push(wire::uint(absent, 2));
            fields.push(wire::uint(absent, 2));
            let raw = wire::framed(magic, wire::encode(&fields));
            let error = if magic == b"CKQ\0" {
                codec::decode_request(&raw).unwrap_err()
            } else {
                codec::decode_record(&raw).unwrap_err()
            };
            assert_eq!(error, CodecError::Duplicate);
        }
    }
}

#[test]
fn retired_request_payload_tag_is_never_an_alias_or_an_old_format_reader() {
    let original = request();
    let raw = codec::encode_request(&original).unwrap();
    let retired = wire::mutate(&raw, &[], |all| {
        all.iter_mut().find(|f| f.tag == 5).unwrap().tag = 4
    });
    assert_eq!(
        codec::decode_request(&retired),
        Err(CodecError::UnknownField)
    );
    let both = wire::mutate(&raw, &[], |all| {
        let mut retired = all.iter().find(|f| f.tag == 5).unwrap().clone();
        retired.tag = 4;
        all.push(retired);
    });
    assert_eq!(codec::decode_request(&both), Err(CodecError::UnknownField));
    let old = wire::framed(
        b"CKQ\0",
        wire::encode(&[
            wire::uint(1, 1),
            wire::uint(2, 1),
            wire::uint(3, 1),
            wire::bytes(4, vec![]),
        ]),
    );
    assert_eq!(codec::decode_request(&old), Err(CodecError::Version));
    // Record tag 4 still means StoredOperation and was not retired or repurposed.
    let record = record();
    assert_eq!(
        codec::decode_record(&codec::encode_record(&record).unwrap()),
        Ok(record)
    );
}

#[test]
fn declared_metadata_has_required_presence_and_survives_all_legal_ordering() {
    let original = request();
    let raw = codec::encode_request(&original).unwrap();
    for tag in 1..=4 {
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[5], |all| all.retain(|f| f.tag != tag))),
            Err(CodecError::Presence)
        );
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[5], |all| all
                .push(all.iter().find(|f| f.tag == tag).unwrap().clone()))),
            Err(CodecError::Duplicate)
        );
    }
    for tag in 1..=3 {
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[5, 1], |all| all.retain(|f| f.tag != tag))),
            Err(CodecError::Presence)
        );
        assert_eq!(
            codec::decode_request(&wire::mutate(&raw, &[5, 1], |all| all
                .iter_mut()
                .find(|f| f.tag == tag)
                .unwrap()
                .value =
                Value::Bytes(vec![0; 16]))),
            Err(CodecError::Id)
        );
    }
    let reordered = wire::mutate(&raw, &[], |all| all.reverse());
    let reordered = wire::mutate(&reordered, &[5], |all| all.reverse());
    let reordered = wire::mutate(&reordered, &[5, 1], |all| all.reverse());
    let reordered = wire::mutate(&reordered, &[5, 4], |all| all.reverse());
    assert_ne!(raw, reordered);
    assert_eq!(codec::decode_request(&reordered), Ok(original));
}
