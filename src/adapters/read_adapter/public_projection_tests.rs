use crate::adapters::codec;
use crate::adapters::read_adapter::projection::Projection;
use crate::adapters::read_adapter::response;
use crate::adapters::read_adapter::test_values as v;
use crate::application::read::{self, PublicMembership, PublicOrigin, PublicRecord, ReadReply};
use crate::application::read_call::ReadValue;
use crate::kernel::change as domain;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

fn content(n: u8) -> Value {
    json!({"establishing":v::key_json(),"id":v::hex(n)})
}
fn identity() -> Value {
    json!({"owner":v::hex(1),"owner_actor":v::hex(2),"ledger":v::hex(3),"change":v::hex(4),"agent":v::hex(5)})
}
fn membership() -> Value {
    json!({"identity":identity(),"operation":v::hex(6),"content":content(7)})
}
fn evidence() -> Value {
    json!({"source":v::hex(5),"content":content(8),"limitations":content(9)})
}
fn dependency() -> Value {
    json!({"ground":v::hex(10),"version":v::hex(11)})
}
fn grant() -> Value {
    json!({"id":v::hex(12),"generation":"18446744073709551615"})
}
fn access() -> Value {
    json!({"Grant":grant()})
}
fn set<T: Ord>(item: T) -> BTreeSet<T> {
    BTreeSet::from([item])
}

fn spec() -> domain::GrantSpec {
    domain::GrantSpec {
        recipient: v::identity().agent,
        target: domain::GrantTarget::Draft(v::id(4)),
        actions: BTreeSet::from([
            domain::GrantAction::CreateDraft,
            domain::GrantAction::Propose,
            domain::GrantAction::Assess,
            domain::GrantAction::Finding,
            domain::GrantAction::Adapt,
            domain::GrantAction::Progress,
            domain::GrantAction::Admit,
            domain::GrantAction::Dispatch,
            domain::GrantAction::Reconcile,
        ]),
        content_items: set(v::content(7)),
        disclosure: set(v::content(8)),
        creation: Some(domain::ContentLimits {
            items: u64::MAX,
            payload_bytes: 9_007_199_254_740_993,
        }),
        content_origins: set(domain::OriginSelector::CurrentGrant),
        disclosure_origins: set(domain::OriginSelector::Historical(Box::new(
            domain::ContentOrigin {
                binding: v::membership(),
                recorder: v::identity().agent,
                represented_owner: v::identity().owner,
                grant: v::grant(),
                target: domain::GrantTarget::DraftCreation(v::id(4)),
            },
        ))),
        native_actions: set(v::id(13)),
        native_scope: set(v::id(14)),
        limits: set(v::id(15)),
    }
}
fn spec_json() -> Value {
    json!({"recipient":v::hex(5),"target":{"Draft":v::hex(4)},
        "actions":["CreateDraft","Propose","Assess","Finding","Adapt","Progress","Admit","Dispatch","Reconcile"],
        "content_items":[content(7)],"disclosure":[content(8)],
        "creation":{"items":"18446744073709551615","payload_bytes":"9007199254740993"},
        "content_origins":["CurrentGrant"],"disclosure_origins":[{"Historical":{
            "binding":membership(),"recorder":v::hex(5),"represented_owner":v::hex(1),
            "grant":grant(),"target":{"DraftCreation":v::hex(4)}
        }}],"native_actions":[v::hex(13)],"native_scope":[v::hex(14)],"limits":[v::hex(15)]})
}
fn record(command: domain::Command) -> PublicRecord {
    let position = v::position(1);
    PublicRecord {
        accepted: domain::Accepted {
            operation: position.operation.clone().expect("accepted"),
            actor: v::identity().agent,
            represented_owner: v::identity().owner,
            effect: domain::Effect::Recorded,
        },
        position,
        command,
        used_grant: Some(v::grant()),
        memberships: vec![],
        discretion_evidence: Some(v::evidence()),
        native_evidence: Some(domain::NativeConditions {
            action: v::id(16),
            evidence: vec![v::evidence()],
        }),
        ground_observations: BTreeMap::from([(v::id(10), v::id(99))]),
    }
}

#[test]
fn every_command_projects_full_semantic_fields_not_an_event_label_or_debug_string() {
    let terms = domain::Terms {
        binding: vec![domain::TermSelection {
            statement: v::membership(),
            context: set(v::membership()),
        }],
        context: set(v::membership()),
        unknowns: vec![domain::Unknown {
            question: v::content(17),
            bounded_by: v::content(18),
            affected: set(v::membership()),
        }],
        criteria: vec![domain::Criterion {
            id: v::id(19),
            definition: v::membership(),
            terms: set(v::membership()),
        }],
    };
    let terms_json = json!({"binding":[{"statement":membership(),"context":[membership()]}],
        "context":[membership()],"unknowns":[{"question":content(17),"bounded_by":content(18),"affected":[membership()]}],
        "criteria":[{"id":v::hex(19),"definition":membership(),"terms":[membership()]}]});
    let proposal = domain::Proposal {
        id: v::id(20),
        agreement: v::id(21),
        identity: v::identity(),
        expected_agreement: Some(v::id(22)),
        terms,
        dependencies: vec![v::dependency()],
    };
    let assessment = domain::Assessment {
        id: v::id(23),
        proposal: v::id(20),
        feasibility: v::content(24),
        capabilities: v::content(25),
        resources: v::content(26),
        commitments: v::content(27),
        coverage: v::content(28),
        limitations: v::content(29),
        dependencies: vec![v::dependency()],
        blockers: vec![v::content(30)],
    };
    let action = domain::ActionRequest {
        id: v::id(16),
        agreement: v::id(21),
        grant: v::grant(),
        native_action: v::id(13),
        scope: set(v::id(14)),
        limits: set(v::id(15)),
        dependencies: vec![v::dependency()],
        conditions: vec![v::content(31)],
    };
    let cases = vec![
        (
            domain::Command::Initiate {
                wish: v::content(7),
                access: domain::Access::Owner,
            },
            json!({"Initiate":{"wish":content(7),"access":"Owner"}}),
        ),
        (
            domain::Command::Propose {
                proposal,
                access: domain::Access::Grant(v::grant()),
            },
            json!({"Propose":{"proposal":{
            "id":v::hex(20),"agreement":v::hex(21),"identity":identity(),"expected_agreement":v::hex(22),"terms":terms_json,"dependencies":[dependency()]
        },"access":access()}}),
        ),
        (
            domain::Command::Assess {
                assessment,
                access: domain::Access::Grant(v::grant()),
            },
            json!({"Assess":{"assessment":{
            "id":v::hex(23),"proposal":v::hex(20),"feasibility":content(24),"capabilities":content(25),"resources":content(26),"commitments":content(27),
            "coverage":content(28),"limitations":content(29),"dependencies":[dependency()],"blockers":[content(30)]
        },"access":access()}}),
        ),
        (
            domain::Command::Decide(domain::Decision {
                id: v::id(32),
                proposal: v::id(20),
                kind: domain::DecisionKind::Undertake {
                    assessment: v::id(23),
                },
                dependencies: vec![v::dependency()],
            }),
            json!({"Decide":{"id":v::hex(32),"proposal":v::hex(20),"kind":{"Undertake":{"assessment":v::hex(23)}},"dependencies":[dependency()]}}),
        ),
        (
            domain::Command::Retract {
                decision: v::id(32),
            },
            json!({"Retract":{"decision":v::hex(32)}}),
        ),
        (
            domain::Command::Reaffirm {
                decision: v::id(32),
                dependencies: vec![v::dependency()],
                assessment: Some(v::id(23)),
            },
            json!({"Reaffirm":{"decision":v::hex(32),"dependencies":[dependency()],"assessment":v::hex(23)}}),
        ),
        (
            domain::Command::SetGrant {
                id: v::id(12),
                expected_generation: Some(u64::MAX),
                spec: spec(),
            },
            json!({"SetGrant":{"id":v::hex(12),"expected_generation":"18446744073709551615","spec":spec_json()}}),
        ),
        (
            domain::Command::RevokeGrant {
                id: v::id(12),
                expected_generation: u64::MAX,
            },
            json!({"RevokeGrant":{"id":v::hex(12),"expected_generation":"18446744073709551615"}}),
        ),
        (
            domain::Command::Admit(action),
            json!({"Admit":{"id":v::hex(16),"agreement":v::hex(21),"grant":grant(),"native_action":v::hex(13),"scope":[v::hex(14)],
            "limits":[v::hex(15)],"dependencies":[dependency()],"conditions":[content(31)]}}),
        ),
        (
            domain::Command::Dispatch { action: v::id(16) },
            json!({"Dispatch":{"action":v::hex(16)}}),
        ),
        (
            domain::Command::Finding {
                finding: domain::Finding {
                    agreement: None,
                    claim: v::content(7),
                    evidence: vec![v::evidence()],
                    disposition: domain::Disposition::Unknown,
                },
                access: domain::Access::Owner,
            },
            json!({"Finding":{"finding":{"agreement":null,"claim":content(7),"evidence":[evidence()],"disposition":"Unknown"},"access":"Owner"}}),
        ),
        (
            domain::Command::Adapt {
                adaptation: domain::Adaptation {
                    agreement: v::id(21),
                    previous_approach: v::content(17),
                    changed_approach: v::content(18),
                    grounds: vec![v::evidence()],
                    discretion: v::id(14),
                },
                access: domain::Access::Owner,
            },
            json!({"Adapt":{"adaptation":{"agreement":v::hex(21),"previous_approach":content(17),"changed_approach":content(18),"grounds":[evidence()],"discretion":v::hex(14)},"access":"Owner"}}),
        ),
        (
            domain::Command::Progress {
                progress: domain::Progress {
                    agreement: v::id(21),
                    terms: set(v::membership()),
                    criteria: set(v::id(19)),
                    evidence: vec![v::evidence()],
                    understanding: domain::ProgressDimension {
                        value: domain::ProgressValue::Advanced,
                        assessment: v::content(17),
                    },
                    outcome: domain::ProgressDimension {
                        value: domain::ProgressValue::Regressed,
                        assessment: v::content(18),
                    },
                    basis: domain::ChangeBasis::CorrectedUnderstanding,
                },
                access: domain::Access::Owner,
            },
            json!({"Progress":{"progress":{"agreement":v::hex(21),"terms":[membership()],"criteria":[v::hex(19)],"evidence":[evidence()],
                "understanding":{"value":"Advanced","assessment":content(17)},"outcome":{"value":"Regressed","assessment":content(18)},"basis":"CorrectedUnderstanding"},"access":"Owner"}}),
        ),
        (
            domain::Command::Fulfill(domain::Fulfillment {
                agreement: v::id(21),
                criteria: vec![domain::CriterionEvidence {
                    criterion: v::id(19),
                    evidence: vec![v::evidence()],
                }],
                resolutions: vec![domain::Resolution {
                    blocker: v::content(30),
                    evidence: vec![v::evidence()],
                }],
                acceptance: v::content(33),
            }),
            json!({"Fulfill":{"agreement":v::hex(21),"criteria":[{"criterion":v::hex(19),"evidence":[evidence()]}],"resolutions":[{"blocker":content(30),"evidence":[evidence()]}],"acceptance":content(33)}}),
        ),
        (
            domain::Command::Withdraw {
                reason: v::content(7),
            },
            json!({"Withdraw":{"reason":content(7)}}),
        ),
        (
            domain::Command::Reconcile {
                action: v::id(16),
                grant: v::grant(),
                evidence: vec![v::evidence()],
                outcome: domain::ActionOutcome::ReportedPartial,
            },
            json!({"Reconcile":{"action":v::hex(16),"grant":grant(),"evidence":[evidence()],"outcome":"ReportedPartial"}}),
        ),
    ];
    for (command, expected) in cases {
        assert_eq!(
            Projection::new(131072).command(&command),
            Ok(expected.clone())
        );
        // Exercise the real protocol conversion, not just a self-defined JSON stand-in.
        let record = record(command);
        let page = read::ChangePage {
            records: vec![record],
            scanned: read::ChangeRange {
                after: v::position(0),
                through: v::position(1),
            },
            observed_head: v::position(1),
            progress: read::ChangeProgress::EndOfRange,
        };
        let reply = ReadReply::Returned(ReadValue::Change(Box::new(page)));
        let frame = codec::encode_read_reply(&reply, 131072).expect("public frame");
        let decoded = codec::decode_read_reply(&frame).expect("existing codec");
        let projected = response::project(&decoded, 131072).expect("complete public projection");
        let output = &projected["Returned"]["Change"]["records"][0];
        assert_eq!(output["command"], expected);
        assert_eq!(
            output["ground_observations"],
            json!([{"ground":v::hex(10),"version":v::hex(99)}]),
            "actual observation differs from requested dependency"
        );
        assert_eq!(output["accepted"]["actor"], v::hex(5));
        assert_eq!(output["discretion_evidence"], evidence());
        assert_eq!(
            output["native_evidence"],
            json!({"action":v::hex(16),"evidence":[evidence()]})
        );
    }
}

#[test]
fn accepted_effects_keep_ids_activation_and_settlement_meaning() {
    let cases = vec![
        (domain::Effect::Initiated, json!("Initiated")),
        (
            domain::Effect::Proposed(v::id(20)),
            json!({"Proposed":v::hex(20)}),
        ),
        (
            domain::Effect::Assessed(v::id(23)),
            json!({"Assessed":v::hex(23)}),
        ),
        (
            domain::Effect::Decision {
                decision: v::id(32),
                activated: Some(v::id(21)),
            },
            json!({"Decision":{"decision":v::hex(32),"activated":v::hex(21)}}),
        ),
        (
            domain::Effect::Decision {
                decision: v::id(32),
                activated: None,
            },
            json!({"Decision":{"decision":v::hex(32),"activated":null}}),
        ),
        (
            domain::Effect::Retracted(v::id(32)),
            json!({"Retracted":v::hex(32)}),
        ),
        (
            domain::Effect::Reaffirmed {
                decision: v::id(32),
                activated: None,
            },
            json!({"Reaffirmed":{"decision":v::hex(32),"activated":null}}),
        ),
        (
            domain::Effect::Reaffirmed {
                decision: v::id(32),
                activated: Some(v::id(21)),
            },
            json!({"Reaffirmed":{"decision":v::hex(32),"activated":v::hex(21)}}),
        ),
        (domain::Effect::Grant(v::grant()), json!({"Grant":grant()})),
        (
            domain::Effect::Revoked(v::grant()),
            json!({"Revoked":grant()}),
        ),
        (
            domain::Effect::Admitted(v::id(16)),
            json!({"Admitted":v::hex(16)}),
        ),
        (
            domain::Effect::Dispatched(v::id(16)),
            json!({"Dispatched":v::hex(16)}),
        ),
        (domain::Effect::Recorded, json!("Recorded")),
        (
            domain::Effect::Settled(domain::Settlement::Withdrawn),
            json!({"Settled":"Withdrawn"}),
        ),
        (
            domain::Effect::Settled(domain::Settlement::Fulfilled(v::id(21))),
            json!({"Settled":{"Fulfilled":v::hex(21)}}),
        ),
        (
            domain::Effect::Reconciled(v::id(16)),
            json!({"Reconciled":v::hex(16)}),
        ),
    ];
    for (effect, expected) in cases {
        assert_eq!(Projection::new(131072).effect(&effect), Ok(expected));
    }
}

#[test]
fn membership_provenance_is_explicit_and_optional_facts_are_not_inferred() {
    for (case, name) in [
        (domain::IntakeCase::Fresh, "Fresh"),
        (domain::IntakeCase::FirstRetention, "FirstRetention"),
        (domain::IntakeCase::KnownReuse, "KnownReuse"),
    ] {
        for known in [false, true] {
            let mut r = record(domain::Command::Withdraw {
                reason: v::content(7),
            });
            r.memberships.push(PublicMembership {
                reference: v::membership(),
                intake: domain::IntakeSnapshot {
                    case: case.clone(),
                    source_claim: domain::SourceClaim {
                        input_kind: if known {
                            domain::InputKind::PreExisting
                        } else {
                            domain::InputKind::NewContribution
                        },
                        binding_knowledge: if known {
                            domain::BindingKnowledge::Known(v::content(7))
                        } else {
                            domain::BindingKnowledge::NoKnownBinding
                        },
                        attribution: if known {
                            domain::Attribution::Actor(v::id(5))
                        } else {
                            domain::Attribution::Unknown
                        },
                        limitations: vec![0xff, 0, 0x80],
                    },
                    prior_establishment: if known { Some(v::membership()) } else { None },
                },
                attributed_source: if known { Some(v::id(5)) } else { None },
                derived_from: set(v::membership()),
                origin: if known {
                    Some(PublicOrigin {
                        grant: v::grant(),
                        target: domain::GrantTarget::Pursuit(v::id(21)),
                    })
                } else {
                    None
                },
            });
            let projected = Projection::new(131072).record(&r).expect("record");
            let m = &projected["memberships"][0];
            assert_eq!(m["reference"], membership());
            assert_eq!(m["intake"]["case"], name);
            assert_eq!(
                m["intake"]["source_claim"]["limitations"],
                json!({"encoding":"hex","data":"ff0080"})
            );
            assert_eq!(
                m["intake"]["source_claim"]["input_kind"],
                if known {
                    "PreExisting"
                } else {
                    "NewContribution"
                }
            );
            assert_eq!(
                m["intake"]["source_claim"]["binding_knowledge"],
                if known {
                    json!({"Known":content(7)})
                } else {
                    json!("NoKnownBinding")
                }
            );
            assert_eq!(
                m["intake"]["source_claim"]["attribution"],
                if known {
                    json!({"Actor":v::hex(5)})
                } else {
                    json!("Unknown")
                }
            );
            assert_eq!(
                m["origin"],
                if known {
                    json!({"grant":grant(),"target":{"Pursuit":v::hex(21)}})
                } else {
                    Value::Null
                }
            );
            assert_eq!(
                m["attributed_source"],
                if known { json!(v::hex(5)) } else { Value::Null }
            );
            assert_eq!(
                m["intake"]["prior_establishment"],
                if known { membership() } else { Value::Null }
            );
            assert_eq!(m["derived_from"], json!([membership()]));
            for forbidden in [
                "checks",
                "context",
                "authority",
                "version",
                "custody",
                "verification",
                "path",
            ] {
                assert!(
                    projected.get(forbidden).is_none(),
                    "private acceptance fields are not public record fields"
                );
            }
        }
    }
}

#[test]
fn remaining_nested_variants_are_values_not_fallbacks() {
    let p = Projection::new(131072);
    assert_eq!(
        p.target(&domain::GrantTarget::Reconciliation(set(v::id(16)))),
        Ok(json!({"Reconciliation":[v::hex(16)]}))
    );
    let d = domain::Decision {
        id: v::id(32),
        proposal: v::id(20),
        kind: domain::DecisionKind::Adopt,
        dependencies: vec![],
    };
    assert_eq!(p.decision(&d).expect("decision")["kind"], "Adopt");
    for (value, name) in [
        (domain::ProgressValue::Advanced, "Advanced"),
        (domain::ProgressValue::Unchanged, "Unchanged"),
        (domain::ProgressValue::Regressed, "Regressed"),
        (domain::ProgressValue::Unknown, "Unknown"),
    ] {
        assert_eq!(
            p.dimension(&domain::ProgressDimension {
                value,
                assessment: v::content(7)
            }),
            Ok(json!({"value":name,"assessment":content(7)}))
        );
    }
    for (value, name) in [
        (domain::ActionOutcome::Unknown, "Unknown"),
        (domain::ActionOutcome::ReportedApplied, "ReportedApplied"),
        (
            domain::ActionOutcome::ReportedNotApplied,
            "ReportedNotApplied",
        ),
        (domain::ActionOutcome::ReportedPartial, "ReportedPartial"),
    ] {
        assert_eq!(p.outcome(value), Ok(json!(name)));
    }
    for (value, name) in [
        (domain::Disposition::Supports, "Supports"),
        (domain::Disposition::Challenges, "Challenges"),
        (domain::Disposition::Unknown, "Unknown"),
    ] {
        let f = domain::Finding {
            agreement: Some(v::id(21)),
            claim: v::content(7),
            evidence: vec![],
            disposition: value,
        };
        assert_eq!(p.finding(&f).expect("finding")["disposition"], name);
    }
    for (basis, name) in [
        (domain::ChangeBasis::Observation, "Observation"),
        (
            domain::ChangeBasis::CorrectedUnderstanding,
            "CorrectedUnderstanding",
        ),
        (domain::ChangeBasis::RevisedTargets, "RevisedTargets"),
    ] {
        let progress = domain::Progress {
            agreement: v::id(21),
            terms: set(v::membership()),
            criteria: set(v::id(19)),
            evidence: vec![],
            understanding: domain::ProgressDimension {
                value: domain::ProgressValue::Unknown,
                assessment: v::content(7),
            },
            outcome: domain::ProgressDimension {
                value: domain::ProgressValue::Unchanged,
                assessment: v::content(8),
            },
            basis,
        };
        assert_eq!(p.progress(&progress).expect("progress")["basis"], name);
    }
}
