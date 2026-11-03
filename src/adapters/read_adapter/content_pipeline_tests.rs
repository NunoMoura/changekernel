//! Actual-frame and complete-JSON boundaries through the one-call seam, without native I/O.
use crate::adapters::codec;
use crate::adapters::read_adapter::adapter_error::AdapterError;
use crate::adapters::read_adapter::test_values as values;
use crate::adapters::read_adapter::work;
use crate::application::read::{ReadLimits, ReadReply};
use crate::application::read_budget::ReadWorkLimits;
use crate::application::read_call::{ReadCall, ReadValue};
use serde_json::{json, Value};
use std::cell::Cell;

fn encode_content(bytes: &[u8]) -> Vec<u8> {
    // Test payloads stay around 32 KiB; no large fixtures or native capacity probe.
    assert!(bytes.len() <= work::REPLY_FRAME_BYTES + 1);
    codec::encode_read_reply(
        &ReadReply::Returned(ReadValue::Content(bytes.to_vec())),
        work::BACKEND_REPLY_BYTES,
    )
    .expect("bounded Content frame")
}

fn content_at_frame_size(byte: u8, frame_bytes: usize) -> (Vec<u8>, Vec<u8>) {
    assert!((work::REPLY_FRAME_BYTES..=work::REPLY_FRAME_BYTES + 1).contains(&frame_bytes));
    // Two bounded codec encodes, not a wire parser or an unbounded sizing search.
    // Measure overhead nearby, then verify the requested exact size on the real frame.
    let probe_size = work::REPLY_FRAME_BYTES - 64;
    let overhead = encode_content(&vec![byte; probe_size]).len() - probe_size;
    assert!(overhead <= 64);
    let content = vec![byte; frame_bytes - overhead];
    let frame = encode_content(&content);
    assert_eq!(frame.len(), frame_bytes);
    (content, frame)
}

fn expected_content(encoding: &str, data: &str) -> Value {
    json!({"Returned": {"Content": {"encoding": encoding, "data": data}}})
}

fn run_content(frame: Vec<u8>, reply_bytes: usize) -> Result<Value, AdapterError> {
    let request = json!({"ReadContent": {
        "membership": {
            "identity": {
                "owner": values::hex(1), "owner_actor": values::hex(2),
                "ledger": values::hex(3), "change": values::hex(4), "agent": values::hex(5)
            },
            "operation": values::hex(6),
            "content": {"establishing": values::key_json(), "id": values::hex(7)}
        },
        "limits": {
            "scanned_records": 32, "returned_records": 16,
            "reply_bytes": u32::try_from(reply_bytes).expect("u32 limit")
        }
    }});
    let calls = Cell::new(0);
    let result = super::run(
        &serde_json::to_vec(&request).expect("request JSON"),
        &values::identity(),
        ReadWorkLimits::default(),
        |call, _| {
            calls.set(calls.get() + 1);
            let backend_ceiling = reply_bytes.min(work::BACKEND_REPLY_BYTES);
            assert_eq!(
                codec::decode_read_call(call).expect("existing call codec"),
                ReadCall::Content {
                    membership: values::membership(),
                    limits: ReadLimits {
                        scanned_records: 32,
                        returned_records: 16,
                        reply_bytes: backend_ceiling,
                    },
                }
            );
            assert!(
                frame.len() <= backend_ceiling,
                "backend respects its caller ceiling"
            );
            Ok(frame)
        },
    );
    assert_eq!(
        calls.get(),
        1,
        "one backend invocation, with no retry on failure"
    );
    result
}

#[test]
fn ascii_and_non_utf8_content_succeed_at_the_actual_frame_cap() {
    for (byte, encoding, unit) in [(b'x', "utf8", "x"), (0xff, "hex", "ff")] {
        let (content, frame) = content_at_frame_size(byte, work::REPLY_FRAME_BYTES);
        let expected = expected_content(encoding, &unit.repeat(content.len()));
        assert!(serde_json::to_vec(&expected).expect("complete JSON").len() < work::OUTPUT_BYTES);
        assert_eq!(
            run_content(frame, work::OUTPUT_BYTES),
            Ok(expected),
            "exact bytes and complete envelopes, not truncated Content"
        );
    }
}

#[test]
fn valid_content_frame_one_byte_over_cap_fails_without_partial_output() {
    let (content, frame) = content_at_frame_size(b'x', work::REPLY_FRAME_BYTES + 1);
    // Prove this is a valid encoded Content reply, unlike oversized junk padding.
    assert_eq!(
        codec::decode_read_reply(&frame),
        Ok(ReadReply::Returned(ReadValue::Content(content)))
    );
    assert_eq!(
        run_content(frame, work::OUTPUT_BYTES),
        Err(AdapterError::Limit)
    );
}

#[test]
fn escaped_utf8_must_fit_the_whole_json_ceiling_not_just_its_data_string() {
    let content = vec![0; work::OUTPUT_BYTES / 6];
    let text = std::str::from_utf8(&content).expect("NUL bytes are valid UTF-8");
    // Each NUL is six JSON bytes (\u0000). The quoted data alone fits exactly;
    // the required encoding tag and outer Returned/Content objects do not.
    assert_eq!(
        serde_json::to_vec(text).expect("escaped string").len(),
        work::OUTPUT_BYTES
    );
    let expected = expected_content("utf8", text);
    assert!(serde_json::to_vec(&expected).expect("complete JSON").len() > work::OUTPUT_BYTES);
    let frame = encode_content(&content);
    assert!(frame.len() < work::REPLY_FRAME_BYTES);
    // A larger valid caller ceiling cannot widen the adapter's whole-output cap.
    assert_eq!(
        run_content(frame, work::OUTPUT_BYTES * 2),
        Err(AdapterError::Limit)
    );
}

#[test]
fn complete_caller_output_ceiling_is_inclusive_and_one_byte_short_fails() {
    for (content, encoding, data) in [
        (vec![b'x'; 256], "utf8", "x".repeat(256)),
        (vec![0xff; 256], "hex", "ff".repeat(256)),
        (vec![0; 256], "utf8", "\0".repeat(256)),
    ] {
        let expected = expected_content(encoding, &data);
        let exact = serde_json::to_vec(&expected)
            .expect("complete compact JSON")
            .len();
        let frame = encode_content(&content);
        assert!(exact < work::OUTPUT_BYTES);
        assert!(
            frame.len() < exact - 1,
            "both caller ceilings admit the actual frame"
        );
        assert_eq!(run_content(frame.clone(), exact), Ok(expected));
        assert_eq!(run_content(frame, exact - 1), Err(AdapterError::Limit));
    }
}
