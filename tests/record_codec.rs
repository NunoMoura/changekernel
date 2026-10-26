use changekernel::{adapters::codec::*, unqualified_pursuit::*};
#[path = "adaptive_pursuit/fixture.rs"]
#[allow(dead_code)]
mod fixture;
use fixture::*;
#[path = "record_codec/adversarial.rs"]
mod adversarial;
#[path = "record_codec/histories.rs"]
mod histories;
#[path = "record_codec/wire.rs"]
mod wire;

#[test]
fn accepted_records_and_caller_retained_requests_roundtrip_and_reconstruct() {
    let mut f = Fixture::new();
    let (p, _) = f.agree();
    f.owner();
    f.execute(Command::Fulfill(f.fulfillment(&p))).unwrap();
    let expected = f.status();
    let records: Vec<_> = f
        .ports
        .records
        .iter()
        .map(|record| {
            let raw = encode_record(record).unwrap();
            let restored = decode_record(&raw).unwrap();
            assert_eq!(&restored, record);
            let request = encode_request(&record.submission().unwrap()).unwrap();
            assert_eq!(decode_request(&request), Ok(record.submission().unwrap()));
            restored
        })
        .collect();
    let head = HistoryHead {
        profile: CURRENT_PROFILE,
        identity: f.identity.clone(),
        accepted_operations: records.len() as u64,
        last_operation: f.ports.last_operation.clone(),
    };
    f.pursuit = Pursuit::reconstruct(head, records).unwrap();
    assert_eq!(f.status(), expected);
}
