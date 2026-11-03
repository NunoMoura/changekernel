use changekernel::adapters::codec;
use changekernel::unqualified_change::{Change, Command, HistoryHead, CURRENT_PROFILE};
#[path = "change/fixture.rs"]
#[allow(dead_code)]
mod fixture;
use fixture::Fixture;
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
            let raw = codec::encode_record(record).unwrap();
            let restored = codec::decode_record(&raw).unwrap();
            assert_eq!(&restored, record);
            let request = codec::encode_request(&record.operation_request().unwrap()).unwrap();
            assert_eq!(
                codec::decode_request(&request),
                Ok(record.operation_request().unwrap())
            );
            restored
        })
        .collect();
    let head = HistoryHead {
        profile: CURRENT_PROFILE,
        identity: f.identity.clone(),
        accepted_operations: records.len() as u64,
        last_operation: f.ports.last_operation.clone(),
    };
    f.pursuit = Change::reconstruct(head, records).unwrap();
    assert_eq!(f.status(), expected);
}

#[path = "record_codec/intake.rs"]
mod intake;
