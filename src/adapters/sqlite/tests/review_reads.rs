//! Manager-review regressions: caller ceilings and prepaid early/fallback refusal paths.
use super::super::cold_read::read_local_framed;
use super::super::tests::{self, support};
use crate::adapters::codec;
use crate::application::read::{ChangeAnchor, ReadLimits, ReadRefusal, ReadReply};
use crate::application::read_budget::{ReadBudget, ReadWorkLimits};
use crate::application::read_call::ReadCall;

#[test]
fn early_invalid_limits_and_denial_never_widen_even_an_unusable_reply_ceiling() {
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let before = support::native_snapshot(&path);
    let refusal_size = codec::encode_read_reply(&ReadReply::Refused(ReadRefusal::Limit), 64)
        .expect("fixed refusal")
        .len();
    for maximum in [
        0,
        1,
        refusal_size - 1,
        refusal_size,
        63,
        64,
        2 * 1024 * 1024 + 1,
    ] {
        for (scanned, history) in [(0, true), (32, false), (0, false)] {
            {
                let mut g = local.0.lock().expect("fixture");
                g.history = history;
                g.locks = 0;
                g.history_calls = 0;
            }
            let limits = ReadLimits {
                reply_bytes: maximum,
                scanned_records: scanned,
                ..ReadLimits::default()
            };
            let call = ReadCall::Resolve {
                change: id.change_key(),
                anchor: ChangeAnchor::Current,
                limits,
            };
            let bytes = codec::encode_read_call(&call)
                .expect("limits are decoded data, not a larger ceiling");
            let reply = read_local_framed(
                &reference,
                &mut local,
                &root,
                &bytes,
                ReadWorkLimits::default(),
            );
            if maximum < refusal_size {
                assert_eq!(reply, Err(codec::CodecError::Limit));
            } else {
                let frame = reply.expect("refusal fits actual caller ceiling");
                assert!(frame.len() <= maximum);
                let reason = if limits.validate().is_err() {
                    ReadRefusal::Limit
                } else {
                    ReadRefusal::Denied
                };
                assert_eq!(
                    codec::decode_read_reply(&frame),
                    Ok(ReadReply::Refused(reason))
                );
            }
            let g = local.0.lock().expect("fixture");
            assert_eq!(
                g.history_calls,
                usize::from(limits.validate().is_ok()),
                "invalid caller limits or one initial denial, never a source query"
            );
        }
    }
    assert_eq!(support::native_snapshot(&path), before);
}

#[test]
fn insufficient_frontend_or_decode_budget_returns_codec_failure_without_unpaid_refusal() {
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let before = support::native_snapshot(&path);
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits {
            reply_bytes: 64,
            ..ReadLimits::default()
        },
    };
    let bytes = codec::encode_read_call(&call).expect("call");
    for work in [
        ReadWorkLimits {
            allocation_bytes: 65535,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            work_units: 65535,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            allocation_bytes: 65536,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            work_units: 65536,
            ..ReadWorkLimits::default()
        },
        ReadWorkLimits {
            allocation_bytes: 0,
            ..ReadWorkLimits::default()
        },
    ] {
        local.0.lock().expect("fixture").locks = 0;
        assert_eq!(
            read_local_framed(&reference, &mut local, &root, &bytes, work),
            Err(codec::CodecError::Limit)
        );
        assert_eq!(
            local.0.lock().expect("fixture").locks,
            0,
            "no execute/source work after reserve or decode failure"
        );
    }
    assert_eq!(support::native_snapshot(&path), before);
}

#[test]
fn exhausted_optional_budget_keeps_prepaid_denial_and_two_refusal_replacement_capacity() {
    let (original, id, path, reference, mut local, root) = tests::provision();
    drop(original);
    let before = support::native_snapshot(&path);
    let call = ReadCall::Resolve {
        change: id.change_key(),
        anchor: ChangeAnchor::Current,
        limits: ReadLimits {
            reply_bytes: 64,
            ..ReadLimits::default()
        },
    };
    let bytes = codec::encode_read_call(&call).expect("call");
    let default = ReadWorkLimits::default();
    let mut decode = ReadBudget::try_new(default).expect("limits");
    codec::decode_read_call_bounded(&bytes, &mut decode).expect("bounded decode");
    let remaining = decode.remaining_for_test();
    for stage in ["initial-denial", "work-failure-then-final-denial"] {
        for tighten in ["allocation", "work"] {
            {
                let mut g = local.0.lock().expect("fixture");
                g.history = stage != "initial-denial";
                g.history_calls = 0;
                g.locks = 0;
                g.disclose_hook = if stage == "initial-denial" {
                    None
                } else {
                    Some(Box::new(|g| {
                        g.disclose_hook = Some(Box::new(|g| {
                            g.history = false;
                        }));
                    }))
                };
            }
            let work = ReadWorkLimits {
                allocation_bytes: if tighten == "allocation" {
                    65536 + default.allocation_bytes - remaining.allocation_bytes
                } else {
                    default.allocation_bytes
                },
                work_units: if tighten == "work" {
                    65536 + default.work_units - remaining.work_units
                } else {
                    default.work_units
                },
                ..default
            };
            let frame = read_local_framed(&reference, &mut local, &root, &bytes, work)
                .expect("reserved refusal remains available");
            assert!(frame.len() <= 64);
            assert_eq!(
                codec::decode_read_reply(&frame),
                Ok(ReadReply::Refused(ReadRefusal::Denied))
            );
            let g = local.0.lock().expect("fixture");
            assert_eq!(g.locks, 1);
            assert_eq!(
                g.history_calls,
                if stage == "initial-denial" { 1 } else { 2 }
            );
        }
    }
    assert_eq!(support::native_snapshot(&path), before);
}
