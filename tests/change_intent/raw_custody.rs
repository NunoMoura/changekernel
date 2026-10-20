use super::*;
use changekernel::ReferencedIntentIoFault as Fault;
use std::os::unix::fs::symlink;

#[test]
fn component_and_regular_symlinks_refuse_without_following_or_holding_the_lock() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    c.close();

    let mut c = Client::library();
    let alias = f.root.join("alias");
    symlink(&f.root, &alias).unwrap();
    let mut connect = f.connect("reopen");
    connect["grant"]["directory"] = json!(alias.join("slot"));
    assert_eq!(c.send(connect)["value"]["code"], "unavailable");
    fs::remove_file(alias).unwrap();

    // Refuse a regular-file role after the lock has already been acquired.
    let control = f.root.join("slot/checkpoint.json");
    let saved = f.root.join("saved-checkpoint");
    fs::rename(&control, &saved).unwrap();
    symlink(&saved, &control).unwrap();
    let before = f.snapshot();
    let mut c = Client::library();
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
    fs::remove_file(&control).unwrap();
    fs::rename(saved, control).unwrap();
    let mut c = Client::library();
    c.connect(&f, "reopen"); // failed acquisition released all owned descriptors/lock
    c.close();
}

#[test]
fn raw_refusal_quarantines_without_incident_but_raw_rename_failure_persists() {
    for refuse in [true, false] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        c.close();
        let target = f.root.join("outside");
        fs::write(&target, "untouched").unwrap();
        let temp = f.root.join("slot/materials/material.tmp");
        let hook_temp = temp.clone();
        let mut fired = false;
        let mut c = Client {
            transport: Transport::Library(Box::new(ReferencedIntent::with_io_hook(Box::new(
                move |e| {
                    if !fired
                        && e.phase == "material"
                        && e.object == "material.tmp"
                        && e.step
                            == if refuse {
                                "before_create"
                            } else {
                                "before_rename"
                            }
                    {
                        fired = true;
                        if refuse {
                            symlink(&target, &hook_temp).unwrap();
                        } else {
                            // A real renameat ENOENT, not a synthetic I/O-hook failure.
                            fs::remove_file(&hook_temp).unwrap();
                        }
                    }
                    Fault::Continue
                },
            )))),
            id: 1,
        };
        c.connect(&f, "reopen");
        let mut r = request("retain_text");
        r["text"] = json!("raw failure boundary");
        assert_eq!(c.call(r)["code"], "unavailable");
        assert_eq!(fs::read(f.root.join("outside")).unwrap(), b"untouched");
        let incident: Value =
            serde_json::from_slice(&fs::read(f.root.join("slot/incident.json")).unwrap()).unwrap();
        assert_eq!(incident["state"], if refuse { "clear" } else { "blocked" });
        assert_eq!(c.query("absent")["code"], "unavailable"); // both quarantine this owner
        c.close();
        let mut c = Client::library();
        if refuse {
            fs::remove_file(temp).unwrap(); // test repairs its injected refusal only
            c.connect(&f, "reopen");
            c.retain("raw failure boundary"); // refusal did not persist a false I/O incident
            c.close();
        } else {
            assert_eq!(incident["issue"], "io");
            assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
        }
    }
}
