use super::*;
fn close_eof(c: &mut Client) {
    if let Transport::Process(p) = &mut c.transport {
        drop(p.stdin.take());
        assert!(p.wait().unwrap().success());
    } else {
        panic!("process required")
    }
}
#[test]
fn frame_bounds_partial_utf8_ids_and_versions_fail_closed_and_release_owner() {
    for bytes in [
        vec![0, 0, 0, 0],
        262_145u32.to_be_bytes().to_vec(),
        vec![0, 0],
        vec![0, 0, 0, 2, b'{'],
        vec![0, 0, 0, 1, 0xff],
    ] {
        let mut c = Client::process();
        if let Transport::Process(p) = &mut c.transport {
            p.stdin.as_mut().unwrap().write_all(&bytes).unwrap();
        }
        close_eof(&mut c);
        if let Transport::Process(p) = &mut c.transport {
            let mut stdout = Vec::new();
            p.stdout.as_mut().unwrap().read_to_end(&mut stdout).unwrap();
            assert!(stdout.is_empty());
            let mut stderr = Vec::new();
            p.stderr.as_mut().unwrap().read_to_end(&mut stderr).unwrap();
            assert!(stderr.len() <= 65536);
        }
    }
    let f = Fixture::new();
    let mut c = Client::process();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("first", 0, "Friday", None);
    c.adopt(r);
    c.close();
    for invalid in ["id", "version", "unknown", "duplicate", "trailing"] {
        let mut c = Client::process();
        c.connect(&f, "reopen");
        let mut r = request("inspect_operation");
        r["key"] = json!("first");
        let mut frame = json!({"bridge":"ck-intent-bridge","id":2,"kind":"call","authorization":lease("allow"),"request":r});
        if invalid == "id" {
            frame["id"] = json!(1)
        }
        if invalid == "version" {
            frame["request"]["version"] = json!("future")
        }
        if invalid == "unknown" {
            frame["request"]["approval"] = json!(true)
        }
        let mut text = serde_json::to_string(&frame).unwrap();
        if invalid == "duplicate" {
            text = text.replace("\"key\":\"first\"", "\"key\":\"first\",\"key\":\"first\"")
        }
        if invalid == "trailing" {
            text.push('x')
        }
        let before = f.snapshot();
        if let Transport::Process(p) = &mut c.transport {
            let w = p.stdin.as_mut().unwrap();
            w.write_all(&(text.len() as u32).to_be_bytes()).unwrap();
            w.write_all(text.as_bytes()).unwrap();
            w.flush().unwrap();
        }
        close_eof(&mut c);
        if let Transport::Process(p) = &mut c.transport {
            let mut out = vec![];
            p.stdout.as_mut().unwrap().read_to_end(&mut out).unwrap();
            assert!(out.is_empty(), "{invalid}");
        }
        assert_eq!(f.snapshot(), before);
        let mut reopened = Client::process();
        reopened.connect(&f, "reopen");
        assert_eq!(reopened.query("first")["status"], "accepted");
        reopened.close();
    }
}
#[test]
fn discard_eof_and_replaced_input_never_reserve_a_prepared_key() {
    let f = Fixture::new();
    let mut c = Client::process();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("first", 0, "Friday", None);
    let before = f.snapshot();
    assert_eq!(c.prepare(r.clone())["kind"], "prepared");
    assert_eq!(
        c.send(json!({"bridge":"ck-intent-bridge","kind":"discard"}))["value"]["kind"],
        "discarded"
    );
    assert_eq!(c.confirm(r.clone())["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
    assert_eq!(c.prepare(r.clone())["kind"], "prepared");
    close_eof(&mut c);
    assert_eq!(f.snapshot(), before);
    let mut c = Client::process();
    c.connect(&f, "reopen");
    assert_eq!(c.query("first")["status"], "not_found_now");
    assert!(c.context(Value::Null)["intent"].is_null());
    c.adopt(r);
    c.close();
}
#[test]
fn exact_stale_inputs_and_same_text_new_keys_have_distinct_facts() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let open = c.proposal("first", 0, "Friday", None);
    let original = c.adopt(open.clone());
    let a = c.proposal("a", 1, "Saturday", None);
    let b = c.proposal("b", 1, "Sunday", None);
    c.adopt(a.clone());
    let before = f.snapshot();
    assert_eq!(c.prepare(b)["value"]["code"], "conflict");
    let mut conflict = open.clone();
    conflict["op"] = json!("revise_intent");
    conflict["expected"] = fact(1);
    assert_eq!(c.call(conflict)["code"], "conflict");
    assert_eq!(f.snapshot(), before);
    let same = c.proposal("same", 2, "Saturday", None);
    assert_eq!(c.adopt(same)["result"]["fact"], fact(3));
    assert_eq!(c.call_lease(open, "deny"), original);
    assert_eq!(c.context(fact(1))["at"], fact(1));
    assert_eq!(c.context(fact(1))["tip"], fact(3));
    c.close();
}
#[test]
fn bounded_pages_reach_record_limit_without_duplicate_or_overflow_acceptance() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    for seq in 1..=128 {
        let r = c.proposal(&format!("k{seq}"), seq - 1, "plan", None);
        assert_eq!(c.adopt(r)["result"]["fact"], fact(seq));
    }
    let refused = c.proposal("overflow", 128, "plan", None);
    let before = f.snapshot();
    assert_eq!(c.prepare(refused)["value"]["code"], "unsupported");
    assert_eq!(f.snapshot(), before);
    let mut after = 0;
    let mut calls = 0;
    loop {
        let mut r = request("read_history");
        r["through"] = fact(128);
        r["after"] = json!(after);
        r["limit"] = json!(8);
        let page = c.call_lease(r, "deny");
        assert_eq!(page["kind"], "history");
        let records = page["records"].as_array().unwrap();
        assert_eq!(records.len(), 8);
        assert_eq!(records[0]["seq"], after + 1);
        assert_eq!(records[7]["seq"], after + 8);
        assert_eq!(page["through"], fact(128));
        calls += 1;
        if page["next_after"].is_null() {
            break;
        }
        after = page["next_after"].as_u64().unwrap();
        assert!(calls <= 16)
    }
    assert_eq!(calls, 16);
    assert_eq!(f.snapshot(), before);
    c.close();
}
#[test]
fn historical_large_revision_retention_does_not_admit_against_current_tip() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let first = c.proposal("first", 0, "Friday", None);
    c.adopt(first);
    let mut r = request("revise_intent");
    r["key"] = json!("large-revision");
    r["expected"] = fact(1);
    r["instruction"] = c.retain(&"I".repeat(4096));
    r["replacement"] = json!({"what":c.retain(&"W".repeat(4096)),"why":null});
    let p = c.prepare(r.clone());
    let text = p["presentation"].as_str().unwrap().to_owned();
    assert!(text.len() > 4096);
    assert_eq!(c.confirm(r)["kind"], "accepted");
    let sunday = c.proposal("sunday", 2, "Sunday", None);
    c.adopt(sunday);
    let before = f.snapshot();
    let mut retained = request("retain_text");
    retained["text"] = json!(text);
    assert_eq!(c.call(retained)["kind"], "retained");
    assert_eq!(c.context(Value::Null)["at"], fact(3));
    assert_eq!(f.snapshot(), before);
    c.close();
}
#[test]
fn losing_the_actual_confirm_reply_does_not_undo_native_acceptance() {
    let f = Fixture::new();
    let mut c = Client::process();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("lost-reply", 0, "Friday", None);
    assert_eq!(c.prepare(r.clone())["kind"], "prepared");
    fs::write(
        f.root.join("sender-request.json"),
        serde_json::to_vec(&r).unwrap(),
    )
    .unwrap();
    let confirm = json!({"bridge":"ck-intent-bridge","id":c.id,"kind":"confirm","authorization":lease("allow"),"input":r,"confirmed":true});
    if let Transport::Process(p) = &mut c.transport {
        drop(p.stdout.take());
        let bytes = serde_json::to_vec(&confirm).unwrap();
        let w = p.stdin.as_mut().unwrap();
        w.write_all(&(bytes.len() as u32).to_be_bytes()).unwrap();
        w.write_all(&bytes).unwrap();
        w.flush().unwrap();
        drop(p.stdin.take());
        assert!(!p.wait().unwrap().success());
    }
    let before = f.snapshot();
    let mut c = Client::process();
    c.connect(&f, "reopen");
    let out = c.query("lost-reply");
    assert_eq!(out["status"], "accepted");
    assert_eq!(out["result"]["fact"], fact(1));
    assert_eq!(c.call_lease(r, "deny")["result"], out["result"]);
    assert_eq!(f.snapshot(), before);
    c.close();
}
#[test]
fn false_host_confirmation_is_not_the_confirmed_true_schema() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("first", 0, "Friday", None);
    c.prepare(r.clone());
    let before = f.snapshot();
    if let Transport::Library(p) = &mut c.transport {
        let frame = json!({"bridge":"ck-intent-bridge","id":c.id,"kind":"confirm","authorization":lease("allow"),"input":r,"confirmed":false});
        assert!(p.handle(&serde_json::to_vec(&frame).unwrap()).is_none());
        assert!(p.is_closed());
    }
    assert_eq!(f.snapshot(), before);
}
#[test]
fn unknown_version_anchor_refuses_before_dependent_decoding_without_mutation() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    c.close();
    let p = f.root.join("slot-anchor.json");
    let s = String::from_utf8(fs::read(&p).unwrap()).unwrap();
    let s = s
        .replace(V, "future")
        .replace("\"root\":{", "\"root\":{\"foreign\":true,");
    fs::write(p, s).unwrap();
    let before = f.snapshot();
    let mut c = Client::library();
    assert_eq!(c.send(f.connect("reopen"))["value"]["code"], "unsupported");
    assert_eq!(f.snapshot(), before);
}
