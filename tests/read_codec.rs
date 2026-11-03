//! Read framing and malformed-data behavior, independent of stored format framing.
use changekernel::adapters::codec::{self, CodecError};
use changekernel::unqualified_change::{
    ChangeAnchor, ChangeId, ChangeKey, LedgerId, OwnerId, ReadCall, ReadLimits, ReadRefusal,
    ReadReply, ReadValue,
};

fn call() -> ReadCall {
    ReadCall::Resolve {
        change: ChangeKey {
            owner: OwnerId::from_bytes([1; 16]).expect("nonzero"),
            ledger: LedgerId::from_bytes([2; 16]).expect("nonzero"),
            change: ChangeId::from_bytes([3; 16]).expect("nonzero"),
        },
        anchor: ChangeAnchor::Beginning,
        limits: ReadLimits::default(),
    }
}
fn frame(body: &[u8]) -> Vec<u8> {
    let mut out = b"CKRC".to_vec();
    out.extend_from_slice(&codec::READ_PROTOCOL_VERSION.to_be_bytes());
    out.extend_from_slice(&(body.len() as u32).to_be_bytes());
    out.extend_from_slice(body);
    out
}
#[test]
fn unsupported_read_version_wins_before_malformed_body_or_declared_size() {
    let mut bytes = frame(&[0xff]);
    bytes[4..8].copy_from_slice(&(codec::READ_PROTOCOL_VERSION + 1).to_be_bytes());
    bytes[8..12].copy_from_slice(&u32::MAX.to_be_bytes());
    assert_eq!(codec::decode_read_call(&bytes), Err(CodecError::Version));
    bytes[..4].copy_from_slice(b"CKRR");
    assert_eq!(codec::decode_read_reply(&bytes), Err(CodecError::Version));
    assert!(
        codec::decode_request(&bytes).is_err(),
        "read frames are not stored request aliases"
    );
}
#[test]
fn exact_frames_reject_unknown_fields_duplicate_oneofs_and_all_truncations() {
    let encoded = codec::encode_read_call(&call()).expect("valid call");
    assert_eq!(codec::decode_read_call(&encoded), Ok(call()));
    for end in 0..encoded.len() {
        assert!(
            codec::decode_read_call(&encoded[..end]).is_err(),
            "truncation at {end}"
        );
    }
    let mut body = encoded[12..].to_vec();
    body.extend_from_slice(&encoded[12..]);
    assert_eq!(
        codec::decode_read_call(&frame(&body)),
        Err(CodecError::Duplicate)
    );
    let mut body = encoded[12..].to_vec();
    body.extend_from_slice(&[0x20, 1]);
    assert_eq!(
        codec::decode_read_call(&frame(&body)),
        Err(CodecError::UnknownField)
    );
    assert_eq!(
        codec::decode_read_call(&frame(&[0x0a, 0xff, 0xff, 0xff, 0xff, 0x7f])),
        Err(CodecError::Malformed)
    );
}
#[test]
fn empty_retained_bytes_and_denial_are_distinct_and_whole_reply_size_is_enforced() {
    let bytes = ReadReply::Returned(ReadValue::Content(Vec::new()));
    let encoded = codec::encode_read_reply(&bytes, 64).expect("empty bytes have presence");
    assert_eq!(codec::decode_read_reply(&encoded), Ok(bytes));
    let refusal = ReadReply::Refused(ReadRefusal::Denied);
    let denied = codec::encode_read_reply(&refusal, 64).expect("reason-free denial");
    assert_eq!(codec::decode_read_reply(&denied), Ok(refusal));
    assert_ne!(encoded, denied);
    let large = ReadReply::Returned(ReadValue::Content(vec![7; 64]));
    assert_eq!(
        codec::encode_read_reply(&large, 64),
        Err(CodecError::Limit),
        "header and nested field lengths count too"
    );
    let exact = codec::encode_read_reply(&large, 128).expect("fits");
    assert!(codec::encode_read_reply(&large, exact.len()).is_ok());
    assert_eq!(
        codec::encode_read_reply(&large, exact.len() - 1),
        Err(CodecError::Limit)
    );
}
#[test]
fn refused_unknown_enum_is_not_default_denial_and_duplicate_content_is_not_merged() {
    let mut bytes = b"CKRR".to_vec();
    bytes.extend_from_slice(&codec::READ_PROTOCOL_VERSION.to_be_bytes());
    bytes.extend_from_slice(&2u32.to_be_bytes());
    bytes.extend_from_slice(&[0x20, 99]);
    assert_eq!(codec::decode_read_reply(&bytes), Err(CodecError::Enum));
    bytes[8..12].copy_from_slice(&4u32.to_be_bytes());
    bytes[12..14].copy_from_slice(&[0x1a, 0]);
    bytes.extend_from_slice(&[0x1a, 0]);
    assert_eq!(codec::decode_read_reply(&bytes), Err(CodecError::Duplicate));
}

#[test]
fn exposed_read_errors_have_lowercase_messages_and_standard_error_support() {
    use changekernel::unqualified_change::Error;
    fn check(error: &(dyn std::error::Error + Send + Sync), expected: &str) {
        assert_eq!(error.to_string(), expected);
        assert!(
            error.source().is_none(),
            "these leaf errors have no hidden underlying cause"
        );
    }
    for (error, message) in [
        (Error::Invalid, "invalid operation or value"),
        (Error::Conflict, "operation conflicts with current state"),
        (Error::Denied, "permission denied"),
        (Error::Stale, "stale state or version"),
        (
            Error::Unavailable,
            "required evidence or resource unavailable",
        ),
        (Error::Terminal, "change is terminal"),
        (Error::NeedsRevision, "revision required"),
    ] {
        check(&error, message);
    }
    for (error, message) in [
        (CodecError::Malformed, "malformed encoding"),
        (
            CodecError::Limit,
            "encoding size or resource limit exceeded",
        ),
        (CodecError::Version, "unsupported encoding version"),
        (CodecError::UnknownField, "unknown encoded field"),
        (CodecError::Wire, "invalid wire type or value"),
        (CodecError::Enum, "unknown enum value"),
        (CodecError::Id, "invalid identifier"),
        (
            CodecError::Presence,
            "missing or conflicting field presence",
        ),
        (CodecError::Duplicate, "duplicate field, key or set member"),
    ] {
        check(&error, message);
    }
    for (error, message) in [
        (ReadRefusal::Denied, "read denied"),
        (ReadRefusal::Invalid, "invalid read request or anchor"),
        (
            ReadRefusal::Changed,
            "read context or consistency condition changed",
        ),
        (ReadRefusal::Unavailable, "read source unavailable"),
        (ReadRefusal::Limit, "read limit exceeded"),
        (ReadRefusal::Unsupported, "unsupported read source profile"),
    ] {
        check(&error, message);
    }
    let output = ReadReply::Returned(ReadValue::Content(vec![7; 64]));
    let error =
        codec::encode_read_reply(&output, 64).expect_err("output exceeds complete frame ceiling");
    check(&error, "encoding size or resource limit exceeded");
}
