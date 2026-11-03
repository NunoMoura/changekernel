//! OS-backed candidates are explicit caller values, not implicit request regeneration.
use changekernel::adapters::ids;
use changekernel::unqualified_change::{
    Access, ChangeId, ChangeKey, Command, ContentId, ContentKey, LedgerId, Operation, OperationId,
    OwnerId,
};

#[test]
fn os_candidate_survives_typed_retention_and_request_construction_without_regeneration() {
    let bytes = ids::candidate().unwrap();
    assert_ne!(bytes, [0; 16]);
    let operation_id = OperationId::from_bytes(bytes).unwrap();
    let retained = *operation_id.as_bytes();
    assert_eq!(OperationId::from_bytes(retained).unwrap(), operation_id);
    // Equal bytes in different ID types remain distinct types; neither grants authority.
    let content = ContentId::from_bytes(retained).unwrap();
    let operation = Operation {
        id: operation_id,
        command: Command::Initiate {
            wish: ContentKey {
                establishing: ChangeKey {
                    owner: OwnerId::from_bytes([1; 16]).unwrap(),
                    ledger: LedgerId::from_bytes([2; 16]).unwrap(),
                    change: ChangeId::from_bytes([3; 16]).unwrap(),
                },
                id: content,
            },
            access: Access::Owner,
        },
        fresh: vec![],
        first_retention: Default::default(),
    };
    assert_eq!(operation.id.as_bytes(), &retained);
    assert_eq!(operation.clone(), operation);
}
