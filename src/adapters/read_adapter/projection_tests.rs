use super::Projection;
use crate::adapters::read_adapter::adapter_error::AdapterError;
use serde_json::json;

#[test]
fn exact_complete_json_size_counts_escaping_envelopes_and_binary_expansion() {
    for bytes in [
        Vec::new(),
        b"hello".to_vec(),
        b"\0\n\r\t\\\"".to_vec(),
        "🦀é".as_bytes().to_vec(),
        vec![0xff, 0, 0x80],
    ] {
        let make = |maximum| {
            let p = Projection::new(maximum);
            p.object([("Returned", p.object([("Content", p.bytes(&bytes)?)])?)])
        };
        let output = make(131072).expect("small fixture");
        let length = serde_json::to_vec(&output).expect("JSON").len();
        assert_eq!(
            make(length),
            Ok(output.clone()),
            "inclusive complete boundary"
        );
        assert_eq!(make(length - 1), Err(AdapterError::Limit));
        let data = &output["Returned"]["Content"];
        let restored = if data["encoding"] == "utf8" {
            data["data"].as_str().expect("text").as_bytes().to_vec()
        } else {
            let hex = data["data"].as_str().expect("hex");
            let (pairs, remainder) = hex.as_bytes().as_chunks::<2>();
            assert!(remainder.is_empty(), "complete hex byte pairs");
            pairs
                .iter()
                .map(|pair| {
                    u8::from_str_radix(std::str::from_utf8(pair).expect("ASCII"), 16).expect("byte")
                })
                .collect()
        };
        assert_eq!(restored, bytes);
    }
}

#[test]
fn counters_refuse_before_nodes_strings_or_collections_exceed_reservations() {
    let p = Projection::new(131072);
    assert!(
        p.array(0..8191, |_| p.boolean(false)).is_ok(),
        "8191 values plus array"
    );
    let p = Projection::new(131072);
    assert_eq!(
        p.array(0..8192, |_| p.boolean(false)),
        Err(AdapterError::Limit)
    );
    let p = Projection::new(131072);
    assert_eq!(
        p.hex(&vec![255; 65536]),
        Err(AdapterError::Limit),
        "quotes count too"
    );
    let p = Projection::new(131072);
    p.allocation.set(64);
    assert_eq!(
        p.text("x"),
        Err(AdapterError::Limit),
        "string allocation is prepaid"
    );
    let p = Projection::new(131072);
    assert_eq!(p.decimal(u64::MAX), Ok(json!("18446744073709551615")));
}
