use crate::adapters::codec::{self, CodecError};
use crate::adapters::read_adapter::adapter_error::AdapterError;
use crate::adapters::read_adapter::response;
use crate::adapters::read_adapter::test_values as values;
use crate::application::read::{ReadRefusal, ReadReply};
use crate::application::read_budget::ReadWorkLimits;
use crate::application::read_call::ReadValue;
use serde_json::json;
use std::cell::Cell;

#[test]
fn one_call_uses_existing_protocol_with_debited_work_and_no_retry() {
    let requests = Cell::new(0);
    let json = serde_json::to_vec(&values::resolve_json()).expect("JSON");
    let result = super::run(
        &json,
        &values::identity(),
        ReadWorkLimits::default(),
        |frame, remaining| {
            requests.set(requests.get() + 1);
            let call = codec::decode_read_call(frame).expect("existing protocol");
            assert_eq!(response::limits(&call).reply_bytes, 131072);
            let maximum = ReadWorkLimits::default();
            assert!(remaining.allocation_bytes < maximum.allocation_bytes);
            assert!(remaining.work_units < maximum.work_units);
            assert_eq!(remaining.source_bytes, maximum.source_bytes);
            assert_eq!(remaining.io_bytes, maximum.io_bytes);
            codec::encode_read_reply(
                &ReadReply::Returned(ReadValue::Position(values::position(0))),
                131072,
            )
        },
    )
    .expect("structured result");
    assert_eq!(requests.get(), 1);
    assert_eq!(result["Returned"]["Position"]["sequence"], "0");
    let result = super::run(
        &json,
        &values::identity(),
        ReadWorkLimits::default(),
        |_, _| {
            requests.set(requests.get() + 1);
            Err(CodecError::Limit)
        },
    );
    assert_eq!(result, Err(AdapterError::BackendCodec));
    assert_eq!(requests.get(), 2, "one failed invocation, not a retry loop");
}

#[test]
fn invalid_semantic_ceilings_are_never_repaired_into_successful_reads() {
    for ceiling in [0, 1, 12, 63, 2 * 1024 * 1024 + 1, u32::MAX] {
        let mut request = values::resolve_json();
        request["ResolveChangeCursor"]["limits"]["reply_bytes"] = json!(ceiling);
        let bytes = serde_json::to_vec(&request).expect("JSON");
        let result = super::run(
            &bytes,
            &values::identity(),
            ReadWorkLimits::default(),
            |frame, _| {
                let call = codec::decode_read_call(frame).expect("protocol");
                let limits = response::limits(&call);
                assert_eq!(
                    limits.reply_bytes, ceiling as usize,
                    "invalid ceiling must be unchanged"
                );
                assert_eq!(limits.validate(), Err(ReadRefusal::Limit));
                codec::encode_read_reply(
                    &ReadReply::Refused(ReadRefusal::Limit),
                    limits.reply_bytes.min(2 * 1024 * 1024),
                )
            },
        );
        if ceiling < 16 {
            assert!(
                matches!(
                    result,
                    Err(AdapterError::BackendCodec) | Err(AdapterError::Limit)
                ),
                "a refusal cannot fit"
            );
        } else {
            assert_eq!(result, Ok(json!({"Refused":"Limit"})));
        }
    }
    let mut request = values::resolve_json();
    request["ResolveChangeCursor"]["limits"]["reply_bytes"] = json!(2 * 1024 * 1024);
    super::run(
        &serde_json::to_vec(&request).expect("JSON"),
        &values::identity(),
        ReadWorkLimits::default(),
        |frame, _| {
            assert_eq!(
                response::limits(&codec::decode_read_call(frame).expect("call")).reply_bytes,
                131072
            );
            codec::encode_read_reply(&ReadReply::Refused(ReadRefusal::Denied), 131072)
        },
    )
    .expect("valid ceiling may tighten");
}

#[test]
fn invalid_record_limits_also_prevent_ceiling_repair() {
    let mut request = values::resolve_json();
    request["ResolveChangeCursor"]["limits"]["scanned_records"] = json!(0);
    request["ResolveChangeCursor"]["limits"]["reply_bytes"] = json!(2 * 1024 * 1024);
    let result = super::run(
        &serde_json::to_vec(&request).expect("JSON"),
        &values::identity(),
        ReadWorkLimits::default(),
        |frame, _| {
            let call = codec::decode_read_call(frame).expect("protocol");
            assert_eq!(response::limits(&call).reply_bytes, 2 * 1024 * 1024);
            codec::encode_read_reply(&ReadReply::Refused(ReadRefusal::Limit), 131072)
        },
    );
    assert_eq!(result, Ok(json!({"Refused":"Limit"})));
}

#[test]
fn adapter_errors_are_standard_serializable_leaf_errors_not_private_diagnostics() {
    let error = super::run(
        b"{}",
        &values::identity(),
        ReadWorkLimits::default(),
        |_, _| unreachable!("invalid JSON"),
    )
    .expect_err("bad request");
    let standard: &(dyn std::error::Error + Send + Sync) = &error;
    assert!(standard.source().is_none());
    assert_eq!(standard.to_string(), "invalid structured read request");
    let value = serde_json::to_value(error).expect("error serialization");
    let restored: AdapterError = serde_json::from_value(value).expect("error deserialization");
    assert_eq!(restored, error);
    assert!(serde_json::from_str::<AdapterError>("\"UnknownFutureError\"").is_err());
}

#[test]
fn malformed_requests_and_exhausted_aggregate_reservations_never_invoke_backend() {
    let count = Cell::new(0);
    let invalid = super::run(
        b"{}",
        &values::identity(),
        ReadWorkLimits::default(),
        |_, _| {
            count.set(count.get() + 1);
            unreachable!("malformed request must not reach fixture")
        },
    );
    assert_eq!(invalid, Err(AdapterError::InvalidRequest));
    let mut json = serde_json::to_vec(&values::resolve_json()).expect("JSON");
    // Whitespace is legal JSON. The maximum request plus worst-case reply exceeds
    // the aggregate adapter reservation, despite each separate byte cap being legal.
    json.resize(32768, b' ');
    let exhausted = super::run(
        &json,
        &values::identity(),
        ReadWorkLimits::default(),
        |_, _| {
            count.set(count.get() + 1);
            unreachable!("combined reservation must precede backend")
        },
    );
    assert_eq!(exhausted, Err(AdapterError::Limit));
    assert_eq!(count.get(), 0);
    let tiny = ReadWorkLimits {
        allocation_bytes: 1,
        ..ReadWorkLimits::default()
    };
    let request = serde_json::to_vec(&values::resolve_json()).expect("JSON");
    assert_eq!(
        super::run(&request, &values::identity(), tiny, |_, _| unreachable!(
            "no budget"
        )),
        Err(AdapterError::Limit)
    );
}

#[test]
fn backend_oversize_wrong_family_and_malformed_reply_are_not_empty_success() {
    let request = serde_json::to_vec(&values::resolve_json()).expect("JSON");
    assert_eq!(
        super::run(
            &request,
            &values::identity(),
            ReadWorkLimits::default(),
            |_, _| Ok(vec![0; 32769])
        ),
        Err(AdapterError::Limit)
    );
    assert_eq!(
        super::run(
            &request,
            &values::identity(),
            ReadWorkLimits::default(),
            |_, _| Ok(vec![])
        ),
        Err(AdapterError::ReplyCodec)
    );
    assert_eq!(
        super::run(
            &request,
            &values::identity(),
            ReadWorkLimits::default(),
            |_, _| {
                codec::encode_read_reply(&ReadReply::Returned(ReadValue::Content(vec![])), 131072)
            }
        ),
        Err(AdapterError::ReplyMismatch)
    );
}
