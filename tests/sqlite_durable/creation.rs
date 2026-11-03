use super::support;
use changekernel::adapters::sqlite::{
    CreationIntent, CreationProgress, LedgerIdentity, Original, OriginalOutcome, Register,
    StoreError,
};
use changekernel::unqualified_change::Error;
use std::fs;
#[test]
fn accepted_start_pending_inclusion_finishes_the_same_request_without_new_start() {
    let id = support::identity(61);
    let reg = super::directory("pending-reg");
    let path = super::directory("pending-original");
    let verify = super::root();
    let local = support::local(&id, &reg, &path, &verify);
    let mut registry = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &verify,
    )
    .unwrap();
    let start = support::start(&local, &id);
    let intent =
        CreationIntent::try_new(registry.reference(), id.clone(), path, start.clone()).unwrap();
    let retained = CreationIntent::from_frame(&intent.to_frame().unwrap()).unwrap();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Include(id.clone()));
    let first = match registry.create(&retained, &mut local.clone()).unwrap() {
        CreationProgress::StartAcceptedPendingInclusion(a) => a,
        _ => panic!("unexpected activation"),
    };
    local.0.lock().unwrap().disclosure = false;
    assert!(matches!(
        registry.reconcile(&retained, &mut local.clone()),
        Err(StoreError::Refused(Error::Denied))
    ));
    local.0.lock().unwrap().disclosure = true;
    local
        .0
        .lock()
        .unwrap()
        .custody
        .insert(support::Permit::Include(id.clone()));
    let reference = match registry.reconcile(&retained, &mut local.clone()).unwrap() {
        CreationProgress::Ready { reference, start } => {
            assert_eq!(start, first);
            reference
        }
        _ => panic!("still pending"),
    };
    let again = registry.reconcile(&retained, &mut local.clone()).unwrap();
    assert!(matches!(again,CreationProgress::Ready{start,..}if start==first));
    drop(registry);
    let mut original = Original::open(&reference, local, &verify).unwrap();
    assert_eq!(
        original.resolve_original(&start).unwrap(),
        OriginalOutcome::Accepted(first)
    );
}
#[test]
fn unexplained_allocation_remains_preserved_and_blocks_same_request() {
    use std::io::Write;
    use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt};
    let id = support::identity(62);
    let reg = super::directory("orphan-reg");
    let path = super::directory("orphan-original");
    let verify = super::root();
    let local = support::local(&id, &reg, &path, &verify);
    let mut registry = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &verify,
    )
    .unwrap();
    fs::DirBuilder::new().mode(0o700).create(&path).unwrap();
    let mut file = fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .mode(0o600)
        .open(path.join("unique-remnant"))
        .unwrap();
    file.write_all(b"preserve unique orphan").unwrap();
    file.sync_all().unwrap();
    drop(file);
    let intent = CreationIntent::try_new(
        registry.reference(),
        id.clone(),
        path.clone(),
        support::start(&local, &id),
    )
    .unwrap();
    for _ in 0..2 {
        assert!(matches!(
            registry.reconcile(&intent, &mut local.clone()),
            Err(StoreError::BlockedOrphan)
        ));
        assert_eq!(
            fs::read(path.join("unique-remnant")).unwrap(),
            b"preserve unique orphan"
        );
        assert!(!path.join("ledger.sqlite").exists());
    }
}
#[test]
fn missing_previously_selected_registry_is_not_empty_or_a_bootstrap_fallback() {
    let id = support::identity(63);
    let reg = super::directory("missing-root");
    let path = super::directory("unused-original");
    let verify = super::root();
    let local = support::local(&id, &reg, &path, &verify);
    let registry = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &verify,
    )
    .unwrap();
    let selection = registry.reference().selection().clone();
    drop(registry);
    fs::rename(reg.join("custody.ctrl"), reg.join("preserved-control")).unwrap();
    assert!(Register::open(&selection, local.clone(), &verify).is_err());
    assert!(Register::bootstrap_new(&reg, selection.ledger, local, &verify).is_err());
    assert!(!reg.join("custody.ctrl").exists());
    assert!(reg.join("preserved-control").exists());
}
#[test]
fn every_existing_entry_reconciliation_requires_current_verification_permission() {
    let id = support::identity(64);
    let reg = super::directory("verify-reconcile-reg");
    let path = super::directory("verify-reconcile-original");
    let verify = super::root();
    let local = support::local(&id, &reg, &path, &verify);
    let mut registry = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &verify,
    )
    .unwrap();
    let intent = CreationIntent::try_new(
        registry.reference(),
        id.clone(),
        path,
        support::start(&local, &id),
    )
    .unwrap();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Include(id.clone()));
    assert!(matches!(
        registry.create(&intent, &mut local.clone()).unwrap(),
        CreationProgress::StartAcceptedPendingInclusion(_)
    ));
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Verify(verify));
    assert!(matches!(
        registry.reconcile(&intent, &mut local.clone()),
        Err(StoreError::Refused(Error::Denied))
    ));
}
#[test]
fn included_start_pending_activation_is_not_reported_as_pending_inclusion() {
    let id = support::identity(66);
    let reg = super::directory("pending-activation-reg");
    let path = super::directory("pending-activation-original");
    let verify = super::root();
    let local = support::local(&id, &reg, &path, &verify);
    let mut registry = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: id.owner.clone(),
            ledger: id.ledger.clone(),
        },
        local.clone(),
        &verify,
    )
    .unwrap();
    let intent = CreationIntent::try_new(
        registry.reference(),
        id.clone(),
        path,
        support::start(&local, &id),
    )
    .unwrap();
    local
        .0
        .lock()
        .unwrap()
        .custody
        .remove(&support::Permit::Activate(id.clone()));
    let first = match registry.create(&intent, &mut local.clone()).unwrap() {
        CreationProgress::StartAcceptedPendingActivation(a) => a,
        _ => panic!("wrong inclusion/activation knowledge"),
    };
    local
        .0
        .lock()
        .unwrap()
        .custody
        .insert(support::Permit::Activate(id));
    assert!(
        matches!(registry.reconcile(&intent,&mut local.clone()).unwrap(),CreationProgress::Ready{start,..}if start==first)
    );
}
