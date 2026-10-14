use super::*;
use changekernel::ReferencedIntentIoFault as Fault;
fn large_open(c: &mut Client) -> Value {
    let instruction = c.retain(&"I".repeat(4096));
    let what = c.retain(&"W".repeat(4096));
    let mut r = request("open_intent");
    r["key"] = json!("large-review");
    r["instruction"] = instruction;
    r["replacement"] = json!({"what":what,"why":null});
    r
}
fn retain_request(text: &str) -> Value {
    let mut r = request("retain_text");
    r["text"] = json!(text);
    r
}
fn prepared_large(f: &Fixture) -> (Value, String) {
    let mut c = Client::library();
    c.connect(f, "fresh_provision");
    let r = large_open(&mut c);
    let p = c.prepare(r.clone());
    assert_eq!(p["kind"], "prepared");
    let text = p["presentation"].as_str().unwrap().to_owned();
    assert!(text.len() > 4096 && text.len() <= 65536);
    c.close();
    (r, text)
}
fn frame(kind: &str, r: Value) -> Value {
    let mut f = json!({"bridge":"ck-intent-bridge","kind":kind,"authorization":lease("allow")});
    f[if kind == "confirm" {
        "input"
    } else {
        "request"
    }] = r;
    if kind == "confirm" {
        f["confirmed"] = json!(true)
    }
    f
}
fn staged(f: &Fixture, r: &Value) {
    recovery::cut(
        f,
        vec![
            f.connect("reopen"),
            frame("prepare", r.clone()),
            frame("confirm", r.clone()),
        ],
        "material",
        "material.tmp",
        "synced",
    );
}
#[test]
fn complete_large_review_cut_recovers_explicitly_without_adoption_then_accepts_once() {
    let f = Fixture::new();
    let (r, text) = prepared_large(&f);
    staged(&f, &r);
    assert_eq!(
        fs::read(f.root.join("slot/materials/material.tmp")).unwrap(),
        text.as_bytes()
    );
    let before = f.snapshot();
    let mut c = Client::process();
    c.connect(&f, "reopen");
    let q = c.query("large-review");
    assert_eq!(q["status"], "not_found_now");
    assert_eq!(q["readiness"], json!(["blocked_material_temp"]));
    assert_eq!(c.prepare(r.clone())["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
    for permission in ["deny", "unavailable"] {
        let out = c.call_lease(retain_request(&text), permission);
        assert_eq!(
            out["code"],
            if permission == "deny" {
                "denied"
            } else {
                "unavailable"
            }
        );
        assert_eq!(f.snapshot(), before);
    }
    let out = c.call(retain_request(&text));
    assert_eq!(out["kind"], "retained", "{out}");
    assert_eq!(out["material"], material(&text));
    assert!(!f.root.join("slot/materials/material.tmp").exists());
    let control = fs::read(f.root.join("slot/checkpoint.json")).unwrap();
    assert_eq!(control,b"{\"format\":\"ck-ref-prefix\",\"custody\":\"custody-1\",\"generation\":0,\"end\":0,\"sha256\":null,\"pending\":null}\n");
    assert!(fs::read(f.root.join("slot/trace.jsonl"))
        .unwrap()
        .is_empty());
    assert!(c.context(Value::Null)["intent"].is_null());
    // Lost reply and duplicate temp cleanup do not reingest, reserve or approve.
    assert_eq!(c.call(retain_request(&text)), out);
    c.close();
    fs::write(f.root.join("slot/materials/material.tmp"), &text).unwrap();
    let before = f.snapshot();
    let mut c = Client::process();
    c.connect(&f, "reopen");
    assert_eq!(
        c.query("large-review")["readiness"],
        json!(["blocked_material_temp"])
    );
    assert_eq!(f.snapshot(), before);
    assert_eq!(c.call(retain_request(&text)), out);
    assert_eq!(c.prepare(r.clone())["presentation"], text);
    let accepted = c.confirm(r.clone());
    assert_eq!(accepted["kind"], "accepted");
    assert_eq!(accepted["result"]["fact"], fact(1));
    assert_eq!(c.call_lease(r, "deny"), accepted);
    let next = c.proposal("later", 1, "Sunday", None);
    c.adopt(next);
    let before = f.snapshot();
    assert_eq!(
        c.call(retain_request(&text)),
        out,
        "historical review incorrectly re-admitted against current tip"
    );
    assert_eq!(c.context(Value::Null)["at"], fact(2));
    assert_eq!(f.snapshot(), before);
    c.close();
}
#[test]
fn absent_oversized_ingestion_and_each_source_role_are_refused() {
    let f = Fixture::new();
    let (r, text) = prepared_large(&f);
    let mut c = Client::library();
    c.connect(&f, "reopen");
    let before = f.snapshot();
    assert_eq!(c.call(retain_request(&text))["code"], "unsupported");
    assert_eq!(f.snapshot(), before);
    assert_eq!(
        c.call(retain_request(&"x".repeat(4097)))["code"],
        "unavailable"
    );
    assert_eq!(f.snapshot(), before);
    c.close();
    staged(&f, &r);
    let mut c = Client::library();
    c.connect(&f, "reopen");
    let m = c.call(retain_request(&text))["material"].clone();
    for role in ["instruction", "what", "why"] {
        let mut changed = r.clone();
        if role == "instruction" {
            changed[role] = m.clone()
        } else {
            changed["replacement"][role] = m.clone()
        };
        let before = f.snapshot();
        assert_eq!(c.prepare(changed)["value"]["code"], "unsupported", "{role}");
        assert_eq!(f.snapshot(), before);
    }
    // Small input is arbitrary UTF-8, not a generated JSON object.
    assert_eq!(
        c.call(retain_request("free text\0é\n"))["material"],
        material("free text\0é\n")
    );
    c.close();
}
#[test]
fn partial_noncanonical_foreign_mismatched_and_damaged_objects_preserve_evidence() {
    for damage in [
        "partial",
        "noncanonical",
        "foreign",
        "mismatch",
        "final",
        "duplicate-final",
        "absent-accepted",
    ] {
        let f = Fixture::new();
        let (r, text) = prepared_large(&f);
        staged(&f, &r);
        let tmp = f.root.join("slot/materials/material.tmp");
        let final_path = f.root.join(format!(
            "slot/materials/{}.txt",
            material(&text)["sha256"].as_str().unwrap()
        ));
        let supplied = match damage {
            "partial" => {
                fs::write(&tmp, &text.as_bytes()[..5000]).unwrap();
                text.clone()
            }
            "noncanonical" => {
                let s = format!(" {text}");
                fs::write(&tmp, &s).unwrap();
                s
            }
            "foreign" => {
                let s = "F".repeat(5000);
                fs::write(&tmp, &s).unwrap();
                s
            }
            "mismatch" => {
                let s = text.replace("large-review", "other-review");
                fs::write(&final_path, &text).unwrap();
                s
            }
            "final" => {
                fs::remove_file(&tmp).unwrap();
                fs::write(&final_path, "corrupt").unwrap();
                text.clone()
            }
            "duplicate-final" => {
                fs::write(&final_path, "corrupt").unwrap();
                text.clone()
            }
            "absent-accepted" => {
                let mut c = Client::library();
                c.connect(&f, "reopen");
                c.call(retain_request(&text));
                c.adopt(r.clone());
                c.close();
                fs::write(&tmp, &text).unwrap();
                fs::remove_file(&final_path).unwrap();
                text.clone()
            }
            _ => unreachable!(),
        };
        let before = f.snapshot();
        let mut c = Client::library();
        let connected = c.send(f.connect("reopen"));
        if damage == "absent-accepted" {
            assert_eq!(connected["value"]["code"], "unavailable");
        } else {
            assert_eq!(connected["kind"], "connected");
            assert_eq!(
                c.call(retain_request(&supplied))["code"],
                "unavailable",
                "{damage}"
            );
            c.close();
        }
        assert_eq!(f.snapshot(), before, "{damage} evidence changed");
    }
}
#[test]
fn recovery_barrier_failure_is_retained_not_cleared_by_successor() {
    let f = Fixture::new();
    let (r, text) = prepared_large(&f);
    staged(&f, &r);
    let mut fired = false;
    let mut renamed = false;
    let mut c = Client {
        transport: Transport::Library(Box::new(ReferencedIntent::with_io_hook(Box::new(
            move |e| {
                if e.phase == "material" && e.object == "material.tmp" && e.step == "renamed" {
                    renamed = true;
                }
                if renamed
                    && !fired
                    && e.phase == "material"
                    && e.object == "directory"
                    && e.step == "before_sync"
                {
                    fired = true;
                    Fault::Io
                } else {
                    Fault::Continue
                }
            },
        )))),
        id: 1,
    };
    c.connect(&f, "reopen");
    assert_eq!(c.call(retain_request(&text))["code"], "unavailable");
    assert_eq!(c.query("large-review")["code"], "unavailable");
    c.close();
    let incident: Value =
        serde_json::from_slice(&fs::read(f.root.join("slot/incident.json")).unwrap()).unwrap();
    assert_eq!(incident["state"], "blocked");
    assert_eq!(incident["issue"], "barrier");
    let before = f.snapshot();
    let mut c = Client::library();
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
}
#[test]
fn cut_after_final_rename_permits_exact_reply_recovery_without_new_fact() {
    let f = Fixture::new();
    let (r, text) = prepared_large(&f);
    recovery::cut(
        &f,
        vec![
            f.connect("reopen"),
            frame("prepare", r),
            frame("confirm", large_subject(&text)),
        ],
        "material",
        "material.tmp",
        "renamed",
    );
    let before = f.snapshot();
    let mut c = Client::process();
    c.connect(&f, "reopen");
    assert!(c.query("large-review")["result"].is_null());
    assert_eq!(c.call(retain_request(&text))["material"], material(&text));
    assert_eq!(f.snapshot(), before);
    assert!(c.context(Value::Null)["intent"].is_null());
    c.close();
}
fn large_subject(text: &str) -> Value {
    serde_json::from_str::<Value>(text).unwrap()["input"].clone()
}
