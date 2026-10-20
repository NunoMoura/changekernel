use super::*;
use changekernel::{ReferencedIntentIoFault as Fault, ReferencedIntentIoHook};
fn hooked(h: ReferencedIntentIoHook) -> Client {
    Client {
        transport: Transport::Library(Box::new(ReferencedIntent::with_io_hook(h))),
        id: 1,
    }
}
fn envelope(kind: &str, r: Value) -> Value {
    let field = if kind == "confirm" {
        "input"
    } else {
        "request"
    };
    let mut v = json!({"bridge":"ck-intent-bridge","kind":kind,"authorization":lease("allow")});
    v[field] = r;
    if kind == "confirm" {
        v["confirmed"] = json!(true)
    }
    v
}

// A separate source-test process runs the identical library acceptance path.
// The production binary has no fault or affirmative-test environment switch.
#[test]
fn cut_child() {
    let Ok(path) = std::env::var("CK_RI_CUT_SCENARIO") else {
        return;
    };
    let scenario: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
    let phase = scenario["phase"].as_str().unwrap().to_owned();
    let object = scenario["object"].as_str().unwrap().to_owned();
    let step = scenario["step"].as_str().unwrap().to_owned();
    let mut c = hooked(Box::new(move |e| {
        if e.phase == phase && e.object == object {
            if step == "short_written" && e.step == "before_write" {
                return Fault::ShortWrite;
            }
            if e.step == step {
                unsafe { libc::_exit(73) }
            }
        }
        Fault::Continue
    }));
    for frame in scenario["frames"].as_array().unwrap() {
        c.send(frame.clone());
    }
    panic!("requested process cut was not reached");
}
pub(super) fn cut(f: &Fixture, frames: Vec<Value>, phase: &str, object: &str, step: &str) {
    let scenario = f.root.join("scenario.json");
    fs::write(
        &scenario,
        serde_json::to_vec(&json!({"phase":phase,"object":object,"step":step,"frames":frames}))
            .unwrap(),
    )
    .unwrap();
    let out = Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "recovery::cut_child", "--nocapture"])
        .env("CK_RI_CUT_SCENARIO", scenario)
        .output()
        .unwrap();
    assert_eq!(
        out.status.code(),
        Some(73),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
}
#[test]
fn installed_prefix_and_only_explicit_exact_resubmission_recover_cuts() {
    for (phase, object, step, status) in [
        ("reserve", "checkpoint.tmp", "synced", "not_found_now"),
        ("reserve", "checkpoint.tmp", "renamed", "pending"),
        ("reserve", "checkpoint.tmp", "parent_synced", "pending"),
        ("append", "trace.jsonl", "short_written", "pending"),
        ("append", "trace.jsonl", "written", "pending"),
        ("append", "trace.jsonl", "synced", "pending"),
        ("checkpoint", "checkpoint.tmp", "synced", "pending"),
        ("checkpoint", "checkpoint.tmp", "renamed", "accepted"),
        ("checkpoint", "checkpoint.tmp", "parent_synced", "accepted"),
    ] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        let r = c.proposal("original", 0, "Friday", None);
        let prepared = c.prepare(r.clone());
        let presentation = prepared["presentation"].clone();
        c.close();
        cut(
            &f,
            vec![
                f.connect("reopen"),
                envelope("prepare", r.clone()),
                envelope("confirm", r.clone()),
            ],
            phase,
            object,
            step,
        );
        let before = f.snapshot();
        let mut c = Client::library();
        c.connect(&f, "reopen");
        let q = c.query("original");
        assert_eq!(q["status"], status, "{phase}/{step}: {q}");
        assert_eq!(c.query("absent")["status"], "not_found_now");
        assert_eq!(f.snapshot(), before, "inspection cleaned a cut");
        if status != "accepted" {
            let denied=c.send(json!({"bridge":"ck-intent-bridge","kind":"prepare","authorization":lease("deny"),"request":r}));
            assert_eq!(denied["value"]["code"], "denied");
            assert_eq!(f.snapshot(), before);
            let p = c.prepare(r.clone());
            assert_eq!(
                p["presentation"], presentation,
                "original presentation replaced"
            );
            let accepted = c.confirm(r.clone());
            assert_eq!(accepted["kind"], "accepted", "{phase}/{step}: {accepted}");
        }
        let original = c.query("original")["result"].clone();
        assert_eq!(original["fact"], fact(1));
        let after = f.snapshot();
        assert_eq!(c.call_lease(r, "deny")["result"], original);
        assert_eq!(f.snapshot(), after);
        c.close();
        let mut c = Client::process();
        c.connect(&f, "reopen");
        assert_eq!(c.query("original")["result"], original);
        c.close();
    }
}
#[test]
fn genuine_mutation_failures_latch_and_survive_reopen() {
    for (phase, object, step, fault) in [
        ("material", "material.tmp", "before_write", Fault::Io),
        (
            "material",
            "material.tmp",
            "before_write",
            Fault::ShortWrite,
        ),
        ("material", "material.tmp", "before_sync", Fault::Io),
        ("material", "material.tmp", "before_rename", Fault::Io),
        ("material", "directory", "before_sync", Fault::Io),
        ("reserve", "checkpoint.tmp", "before_sync", Fault::Io),
        ("reserve", "checkpoint.tmp", "before_rename", Fault::Io),
        ("append", "trace.jsonl", "before_write", Fault::ShortWrite),
        ("append", "trace.jsonl", "before_sync", Fault::Io),
        ("checkpoint", "replacement_parent", "before_sync", Fault::Io),
    ] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        let r = c.proposal("original", 0, "Friday", None);
        c.close();
        let mut fired = false;
        let mut c = hooked(Box::new(move |e| {
            if !fired && e.phase == phase && e.object == object && e.step == step {
                fired = true;
                fault
            } else {
                Fault::Continue
            }
        }));
        c.connect(&f, "reopen");
        assert_eq!(c.prepare(r.clone())["kind"], "prepared");
        let out = c.confirm(r);
        assert_eq!(out["code"], "unavailable", "{phase}/{object}/{step}: {out}");
        assert_eq!(c.query("original")["code"], "unavailable");
        c.close();
        let incident: Value =
            serde_json::from_slice(&fs::read(f.root.join("slot/incident.json")).unwrap()).unwrap();
        assert_eq!(incident["state"], "blocked");
        let before = f.snapshot();
        let mut c = Client::library();
        assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
        assert_eq!(f.snapshot(), before);
    }
}
#[test]
fn read_failure_is_memory_only_including_reopen() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("open", 0, "Friday", None);
    c.adopt(r);
    c.close();
    let before = f.snapshot();
    let mut fired = false;
    let mut c = hooked(Box::new(move |e| {
        if !fired && e.object == "checkpoint.json" && e.step == "before_sync" {
            fired = true;
            Fault::Io
        } else {
            Fault::Continue
        }
    }));
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before, "reopen persisted read failure");
    let mut c = Client::library();
    c.connect(&f, "reopen");
    assert_eq!(c.query("open")["status"], "accepted");
    c.close();
}
#[test]
fn retention_temp_is_not_adoption_and_requires_matching_explicit_retry() {
    for step in ["synced", "renamed"] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        c.close();
        let mut r = request("retain_text");
        r["text"] = json!("orphan\n");
        cut(
            &f,
            vec![f.connect("reopen"), envelope("call", r.clone())],
            "material",
            "material.tmp",
            step,
        );
        let before = f.snapshot();
        let mut c = Client::library();
        c.connect(&f, "reopen");
        let q = c.query("nothing");
        assert_eq!(q["status"], "not_found_now");
        assert!(c.context(Value::Null)["intent"].is_null());
        assert_eq!(f.snapshot(), before);
        assert_eq!(c.call(r)["material"], material("orphan\n"));
        assert!(!f.root.join("slot/materials/material.tmp").exists());
        c.close();
    }
}
#[test]
fn unexplained_tail_and_obsolete_control_are_readable_not_mutation_ready() {
    for control in [false, true] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        let r = c.proposal("first", 0, "Friday", None);
        c.adopt(r.clone());
        let next = c.proposal("next", 1, "Saturday", None);
        c.close();
        if control {
            fs::copy(
                f.root.join("slot/checkpoint.json"),
                f.root.join("slot/checkpoint.tmp"),
            )
            .unwrap();
        } else {
            let mut trace = fs::OpenOptions::new()
                .append(true)
                .open(f.root.join("slot/trace.jsonl"))
                .unwrap();
            trace.write_all(b"unaccepted bytes").unwrap();
        }
        let before = f.snapshot();
        let mut c = Client::library();
        c.connect(&f, "reopen");
        let q = c.query("first");
        assert_eq!(q["status"], "accepted");
        assert_eq!(
            q["readiness"],
            json!([if control {
                "blocked_control_temp"
            } else {
                "blocked_unaccepted_tail"
            }])
        );
        assert_eq!(c.call_lease(r, "deny")["kind"], "accepted");
        assert_eq!(c.prepare(next)["value"]["code"], "unavailable");
        assert_eq!(f.snapshot(), before);
        c.close();
    }
}
#[test]
fn missing_and_partial_controls_are_never_rebuilt() {
    for target in ["checkpoint.json", "incident.json", "checkpoint.tmp"] {
        let f = Fixture::new();
        let mut c = Client::library();
        c.connect(&f, "fresh_provision");
        c.close();
        if target.ends_with("tmp") {
            fs::write(f.root.join("slot").join(target), "{").unwrap();
        } else {
            fs::remove_file(f.root.join("slot").join(target)).unwrap();
        }
        let before = f.snapshot();
        let mut c = Client::library();
        assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unavailable");
        assert_eq!(f.snapshot(), before);
    }
}
