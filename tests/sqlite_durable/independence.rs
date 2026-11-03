use super::support;
use changekernel::adapters::sqlite::{
    CreationIntent, CreationProgress, LedgerIdentity, Original, OriginalOutcome, Register,
};
use std::fs;
#[test]
fn broken_other_original_and_unavailable_register_do_not_block_healthy_known_original() {
    let verify = super::root();
    let reg = super::directory("independent-reg");
    let a = support::identity(81);
    let b = support::identity(82);
    let pa = super::directory("independent-a");
    let pb = super::directory("independent-b");
    let la = support::local(&a, &reg, &pa, &verify);
    let lb = support::local(&b, &reg, &pb, &verify);
    for p in [
        support::Permit::Reserve(b.clone()),
        support::Permit::Bind(b.clone()),
        support::Permit::Include(b.clone()),
    ] {
        la.0.lock().unwrap().custody.insert(p);
    }
    let mut registry = Register::bootstrap_new(
        &reg,
        LedgerIdentity {
            owner: a.owner.clone(),
            ledger: a.ledger.clone(),
        },
        la.clone(),
        &verify,
    )
    .unwrap();
    let ia = CreationIntent::try_new(registry.reference(), a.clone(), pa, support::start(&la, &a))
        .unwrap();
    let ib = CreationIntent::try_new(
        registry.reference(),
        b.clone(),
        pb.clone(),
        support::start(&lb, &b),
    )
    .unwrap();
    let ra = match registry.create(&ia, &mut la.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => reference,
        _ => panic!("A not ready"),
    };
    let rb = match registry.create(&ib, &mut lb.clone()).unwrap() {
        CreationProgress::Ready { reference, .. } => reference,
        _ => panic!("B not ready"),
    };
    drop(registry);
    let mut sa = Original::open(&ra, la.clone(), &verify).unwrap();
    let mut sb = Original::open(&rb, lb, &verify).unwrap();
    fs::rename(
        pb.join("ledger.sqlite-wal"),
        pb.join("preserved-required-wal"),
    )
    .unwrap();
    assert!(sb.passive_checkpoint().is_err());
    drop(sb);
    fs::rename(&reg, reg.with_extension("unavailable")).unwrap();
    let request = support::grant(&a, 91);
    let first = sa.submit(&request).unwrap();
    drop(sa);
    let mut reopened = Original::open(&ra, la, &verify).unwrap();
    assert_eq!(
        reopened.resolve_original(&request).unwrap(),
        OriginalOutcome::Accepted(first)
    );
}
