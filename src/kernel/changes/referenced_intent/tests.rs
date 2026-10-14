use super::*;
#[test]
fn closed_requests_preserve_exact_typed_input() {
    let input=br#"{"version":"0.5.0-prototype.1","op":"read_context","ledger":"ledger-1","change":"change-1","at":null}"#;
    let r: Request = parse(input).unwrap();
    let reordered=br#" { "at": null, "change":"change-1","ledger":"ledger-1","op":"read_context","version":"0.5.0-prototype.1" } "#;
    assert_eq!(r, parse::<Request>(reordered).unwrap());
    let s = std::str::from_utf8(input).unwrap();
    for bad in [
        s.replace("\"at\":null", "\"at\":null,\"at\":null"),
        s.replace(",\"at\":null", ""),
        s.replace("\"at\":null", "\"at\":null,\"approval\":null"),
        s.replace("\"at\":null", "\"at\":false"),
        s.replace("ledger-1", "ledger-2"),
        format!("{s} false"),
        format!("\u{feff}{s}"),
    ] {
        assert!(parse::<Request>(bad.as_bytes()).is_err(), "{bad}");
    }
    for n in ["1.0", "-1", "129", "\"1\"", "null", "true"] {
        let history = format!(
            r#"{{"version":"{V}","op":"read_history","ledger":"ledger-1","change":"change-1","through":null,"after":{n},"limit":1}}"#
        );
        assert!(parse::<Request>(history.as_bytes()).is_err(), "{n}");
    }
    let unsupported = s.replace("read_context", "foreign");
    assert_eq!(
        parse::<Request>(unsupported.as_bytes()),
        Err(Error::Unsupported)
    );
}
#[test]
fn canonical_material_encoding_and_roles_are_exact() {
    let text = "é\n\t\r\0/\\\"";
    let encoded = emit(&text).unwrap();
    assert_eq!(
        encoded,
        "\"é\\u000a\\u0009\\u000d\\u0000/\\\\\\\"\"\n".as_bytes()
    );
    assert_eq!(parse::<String>(&encoded).unwrap(), text);
    assert_eq!(
        canonical::<String>(
            br#""a\nb"
"#
        ),
        Err(Error::Unavailable)
    );
    let a = Material::of(b"Saturday");
    let b = Material::of(b"Saturday\n");
    assert_ne!(a, b);
    assert_ne!(
        Intent {
            what: a.clone(),
            why: None
        },
        Intent {
            what: a,
            why: Some(Material::of(b""))
        }
    );
}
#[test]
fn retention_decoder_carries_recovery_bytes_but_keeps_frame_and_utf8_bounds() {
    for size in [4096, 4097, 65536] {
        let s=format!("{{\"version\":\"{V}\",\"op\":\"retain_text\",\"ledger\":\"ledger-1\",\"change\":\"change-1\",\"text\":\"{}\"}}","x".repeat(size));
        assert_eq!(
            parse::<Request>(s.as_bytes()).unwrap().text.unwrap().len(),
            size
        );
    }
    let s=format!("{{\"version\":\"{V}\",\"op\":\"retain_text\",\"ledger\":\"ledger-1\",\"change\":\"change-1\",\"text\":\"{}\"}}","x".repeat(65537));
    assert!(parse::<Request>(s.as_bytes()).is_err());
    assert!(parse::<Request>(&vec![b' '; LIMIT + 1]).is_err());
    assert!(parse::<String>(br#""\ud800""#).is_err());
    assert!(parse::<String>(&[b'"', 0xff, b'"']).is_err());
}
#[test]
fn version_mismatch_precedes_dependent_record_decoding() {
    let bad = br#"{"input":{"foreign":{"deep":"ignored"}},"version":"future"}"#;
    assert_eq!(versioned_canonical::<Record>(bad), Err(Error::Unsupported));
    assert!(parse::<versions::VersionScan>(bad).is_err());
}
