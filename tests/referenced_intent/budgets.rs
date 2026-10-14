use super::*;
fn full_store_subject() -> Value {
    let mut r = request("open_intent");
    r["key"] = json!("full");
    r["instruction"] = material(POLICY);
    r["replacement"] = json!({"what":material(POLICY),"why":null});
    r
}
#[test]
fn full_item_or_raw_budget_refuses_growth_but_preserves_readable_prefix() {
    for item_limit in [true, false] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        c.close();
        let directory = f.root.join("slot/materials");
        let count = if item_limit { 767 } else { 256 };
        for n in 0..count {
            let size = if item_limit {
                32
            } else if n == 255 {
                65_536 - POLICY.len()
            } else {
                65_536
            };
            let prefix = format!("orphan-{n:03}");
            let text = format!("{prefix}{}", "x".repeat(size - prefix.len()));
            let r = material(&text);
            fs::write(
                directory.join(format!("{}.txt", r["sha256"].as_str().unwrap())),
                text,
            )
            .unwrap();
        }
        let before = f.snapshot();
        let mut c = Client::library();
        c.connect(&f, "reopen");
        let mut retain = request("retain_text");
        retain["text"] = json!("new material");
        assert_eq!(c.call(retain)["code"], "unsupported");
        assert_eq!(c.query("absent")["status"], "not_found_now");
        if item_limit {
            let r = full_store_subject();
            assert_eq!(c.prepare(r)["value"]["code"], "unsupported");
        }
        assert_eq!(f.snapshot(), before);
        c.close();
    }
}
#[test]
fn intact_prefix_remains_readable_with_bounded_unexplained_tail() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("first", 0, "Friday", None);
    let original = c.adopt(r.clone());
    c.close();
    let p = f.root.join("slot/trace.jsonl");
    let length = fs::metadata(&p).unwrap().len() as usize;
    let mut trace = fs::OpenOptions::new().append(true).open(&p).unwrap();
    // No pending: the physical-trace cap bounds the unexplained bytes; they do
    // not become a record merely because they exceed an individual-record cap.
    trace.write_all(&vec![b'x'; 4_456_448 - length]).unwrap();
    trace.sync_all().unwrap();
    drop(trace);
    let before = f.snapshot();
    let mut c = Client::library();
    c.connect(&f, "reopen");
    let q = c.query("first");
    assert_eq!(q["status"], "accepted");
    assert_eq!(q["readiness"], json!(["blocked_unaccepted_tail"]));
    assert_eq!(c.call_lease(r, "deny"), original);
    assert_eq!(f.snapshot(), before);
    c.close();
    let mut trace = fs::OpenOptions::new().append(true).open(&p).unwrap();
    trace.write_all(b"x").unwrap();
    drop(trace);
    let before = f.snapshot();
    let mut c = Client::library();
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
}
#[test]
fn oversized_staging_is_unavailable_and_preserved() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    c.close();
    fs::write(
        f.root.join("slot/materials/material.tmp"),
        vec![b'x'; 65_537],
    )
    .unwrap();
    let before = f.snapshot();
    let mut c = Client::library();
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
}
