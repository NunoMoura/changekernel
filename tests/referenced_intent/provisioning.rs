use super::*;
#[test]
fn explicit_preparation_resumes_only_supported_initial_cuts() {
    for (object, step) in [
        ("slot-anchor.json", "synced"),
        ("incident.json", "synced"),
        ("slot-anchor.tmp", "synced"),
        ("slot-anchor.tmp", "renamed"),
        ("slot-anchor.tmp", "parent_synced"),
    ] {
        let f = Fixture::new();
        recovery::cut(
            &f,
            vec![f.connect("fresh_provision")],
            "provision",
            object,
            step,
        );
        let mut c = Client::library();
        c.connect(&f, "resume_provision");
        assert!(c.context(Value::Null)["intent"].is_null());
        let r = c.proposal("first", 0, "Friday", None);
        assert_eq!(c.adopt(r)["result"]["fact"], fact(1));
        c.close();
    }
}
#[test]
fn grant_and_live_identity_cannot_be_replaced_by_paths() {
    for field in ["coverage", "owner", "policy"] {
        let f = Fixture::new();
        let mut connect = f.connect("fresh_provision");
        connect["grant"][field] = if field == "policy" {
            material("foreign policy")
        } else {
            json!("foreign")
        };
        let before = f.snapshot();
        let mut c = Client::library();
        let out = c.send(connect);
        assert_eq!(out["value"]["code"], "unsupported");
        assert_eq!(f.snapshot(), before);
    }
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("first", 0, "Friday", None);
    c.adopt(r);
    c.close();
    let lock = f.root.join("slot/writer.lock");
    fs::rename(&lock, f.root.join("old-lock")).unwrap();
    fs::write(&lock, []).unwrap();
    let before = f.snapshot();
    let mut c = Client::library();
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
}
#[test]
fn material_inventory_and_reference_integrity_are_not_filename_trust() {
    for damage in ["link", "unknown", "length", "missing"] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        let r = c.proposal("first", 0, "Friday", None);
        let name = format!(
            "slot/materials/{}.txt",
            r["replacement"]["what"]["sha256"].as_str().unwrap()
        );
        c.adopt(r);
        c.close();
        match damage {
            "link" => fs::hard_link(f.root.join(&name), f.root.join("external-link")).unwrap(),
            "unknown" => fs::write(f.root.join("slot/materials/foreign"), "x").unwrap(),
            "length" => fs::write(f.root.join(&name), "Friday!").unwrap(),
            "missing" => fs::remove_file(f.root.join(&name)).unwrap(),
            _ => unreachable!(),
        }
        let before = f.snapshot();
        let mut c = Client::library();
        assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
        assert_eq!(f.snapshot(), before);
    }
}
