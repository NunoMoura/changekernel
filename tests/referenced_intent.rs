#![cfg(target_os = "linux")]
use changekernel::ReferencedIntent;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
};
#[path = "referenced_intent/budgets.rs"]
mod budgets;
#[path = "referenced_intent/conformance.rs"]
mod conformance;
#[path = "referenced_intent/generated_recovery.rs"]
mod generated_recovery;
#[path = "referenced_intent/provisioning.rs"]
mod provisioning;
#[path = "referenced_intent/raw_custody.rs"]
mod raw_custody;
#[path = "referenced_intent/recovery.rs"]
mod recovery;
const V: &str = "0.5.0-prototype.1";
const POLICY:&str="{\"format\":\"ck-plan-policy\",\"owner\":\"person-1\",\"ledger\":\"ledger-1\",\"change\":\"change-1\",\"coverage\":\"closed-personal-plan\",\"actions\":[\"open_intent\",\"revise_intent\"],\"approval\":\"local-tui-exact\",\"domain_requirements\":[],\"relationships\":[],\"external_effects\":false}\n";
fn material(s: &str) -> Value {
    json!({"custody":"custody-1","sha256":format!("{:x}",Sha256::digest(s.as_bytes())),"bytes":s.len(),"text":"utf8-exact"})
}
fn fact(n: u64) -> Value {
    json!({"ledger":"ledger-1","change":"change-1","seq":n})
}
fn lease(mutate: &str) -> Value {
    json!({"principal":"person-1","disclose":"allow","mutate":mutate})
}
fn request(op: &str) -> Value {
    json!({"version":V,"op":op,"ledger":"ledger-1","change":"change-1"})
}
static NEXT: AtomicU64 = AtomicU64::new(0);
// Library-owned descriptors must not be inherited by a concurrent test's fork.
// Production stdio children do not fork; serialize the mixed library/process harness.
static FIXTURES: std::sync::Mutex<()> = std::sync::Mutex::new(());
struct Fixture {
    root: PathBuf,
    _serial: std::sync::MutexGuard<'static, ()>,
}
impl Fixture {
    fn new() -> Self {
        let serial = FIXTURES.lock().unwrap_or_else(|p| p.into_inner());
        let p = std::env::temp_dir().join(format!(
            "ri-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&p).unwrap();
        Self {
            root: p,
            _serial: serial,
        }
    }
    fn connect(&self, mode: &str) -> Value {
        json!({"bridge":"ck-intent-bridge","id":1,"kind":"connect","mode":mode,"grant":{"version":V,"custody":"custody-1","ledger":"ledger-1","change":"change-1","owner":"person-1","coverage":"closed-personal-plan","policy":material(POLICY),"directory":self.root.join("slot"),"anchor":self.root.join("slot-anchor.json")},"authorization":lease("allow")})
    }
    fn snapshot(&self) -> BTreeMap<PathBuf, (Vec<u8>, std::time::SystemTime)> {
        fn walk(p: &Path, out: &mut BTreeMap<PathBuf, (Vec<u8>, std::time::SystemTime)>) {
            for e in fs::read_dir(p).unwrap() {
                let p = e.unwrap().path();
                if p.is_dir() {
                    walk(&p, out)
                } else {
                    out.insert(
                        p.clone(),
                        (
                            fs::read(&p).unwrap(),
                            fs::metadata(&p).unwrap().modified().unwrap(),
                        ),
                    );
                }
            }
        }
        let mut out = BTreeMap::new();
        walk(&self.root, &mut out);
        out
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if !std::thread::panicking() {
            fs::remove_dir_all(&self.root).unwrap();
        }
    }
}
enum Transport {
    Library(Box<ReferencedIntent>),
    Process(Child),
}
struct Client {
    transport: Transport,
    id: u64,
}
impl Client {
    fn library() -> Self {
        Self {
            transport: Transport::Library(Box::default()),
            id: 1,
        }
    }
    fn process() -> Self {
        Self {
            transport: Transport::Process(
                Command::new(env!("CARGO_BIN_EXE_changekernel"))
                    .arg("--referenced-intent-bridge")
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .unwrap(),
            ),
            id: 1,
        }
    }
    fn send(&mut self, mut v: Value) -> Value {
        v["id"] = json!(self.id);
        self.id += 1;
        let bytes = serde_json::to_vec(&v).unwrap();
        let out = match &mut self.transport {
            Transport::Library(c) => c.handle(&bytes).expect("valid frame produced no response"),
            Transport::Process(c) => {
                let w = c.stdin.as_mut().unwrap();
                w.write_all(&(bytes.len() as u32).to_be_bytes()).unwrap();
                w.write_all(&bytes).unwrap();
                w.flush().unwrap();
                let r = c.stdout.as_mut().unwrap();
                let mut h = [0; 4];
                r.read_exact(&mut h).unwrap();
                let n = u32::from_be_bytes(h) as usize;
                assert!((1..=262144).contains(&n));
                let mut out = vec![0; n];
                r.read_exact(&mut out).unwrap();
                out
            }
        };
        assert_eq!(out.last(), Some(&b'\n'));
        let out: Value = serde_json::from_slice(&out).unwrap();
        assert_eq!(out["id"], v["id"]);
        out
    }
    fn connect(&mut self, f: &Fixture, mode: &str) {
        let r = self.send(f.connect(mode));
        assert_eq!(r["kind"], "connected", "{}: {r}", f.root.display());
        assert_eq!(r["version"], V);
    }
    fn call(&mut self, r: Value) -> Value {
        self.call_lease(r, "allow")
    }
    fn call_lease(&mut self, r: Value, m: &str) -> Value {
        self.send(
            json!({"bridge":"ck-intent-bridge","kind":"call","authorization":lease(m),"request":r}),
        )["value"]
            .clone()
    }
    fn retain(&mut self, s: &str) -> Value {
        let mut r = request("retain_text");
        r["text"] = json!(s);
        let out = self.call(r);
        assert_eq!(out["kind"], "retained", "{out}");
        assert_eq!(out["material"], material(s));
        out["material"].clone()
    }
    fn proposal(&mut self, key: &str, seq: u64, what: &str, why: Option<&str>) -> Value {
        let instruction = self.retain(&format!("Adopt {what}"));
        let what = self.retain(what);
        let why = why.map(|s| self.retain(s));
        let mut r = request(if seq == 0 {
            "open_intent"
        } else {
            "revise_intent"
        });
        r["key"] = json!(key);
        r["instruction"] = instruction;
        r["replacement"] = json!({"what":what,"why":why});
        if seq > 0 {
            r["expected"] = fact(seq)
        }
        r
    }
    fn prepare(&mut self, r: Value) -> Value {
        self.send(json!({"bridge":"ck-intent-bridge","kind":"prepare","authorization":lease("allow"),"request":r}))
    }
    fn confirm(&mut self, r: Value) -> Value {
        self.send(json!({"bridge":"ck-intent-bridge","kind":"confirm","authorization":lease("allow"),"input":r,"confirmed":true}))["value"].clone()
    }
    fn adopt(&mut self, r: Value) -> Value {
        let prepared = self.prepare(r.clone());
        assert_eq!(prepared["kind"], "prepared", "{prepared}");
        assert_eq!(prepared["input"], r);
        let review: Value =
            serde_json::from_str(prepared["presentation"].as_str().unwrap()).unwrap();
        assert_eq!(review["input"], r);
        assert_eq!(review["policy_text"], POLICY);
        let out = self.confirm(r);
        assert_eq!(out["kind"], "accepted", "{out}");
        out
    }
    fn query(&mut self, key: &str) -> Value {
        let mut r = request("inspect_operation");
        r["key"] = json!(key);
        self.call_lease(r, "deny")
    }
    fn context(&mut self, at: Value) -> Value {
        let mut r = request("read_context");
        r["at"] = at;
        self.call_lease(r, "deny")
    }
    fn close(&mut self) {
        let out = self.send(json!({"bridge":"ck-intent-bridge","kind":"close"}));
        assert_eq!(out["kind"], "closed");
        if let Transport::Process(c) = &mut self.transport {
            assert!(c.wait().unwrap().success());
        }
    }
}
impl Drop for Client {
    fn drop(&mut self) {
        if let Transport::Process(c) = &mut self.transport {
            drop(c.stdin.take());
            if c.try_wait().unwrap().is_none() {
                c.kill().unwrap();
            }
            c.wait().unwrap();
        }
    }
}
#[test]
fn actual_bridge_dinner_fresh_reader_and_original_result() {
    let f = Fixture::new();
    let mut c = Client::process();
    c.connect(&f, "fresh_provision");
    assert!(c.context(Value::Null)["intent"].is_null());
    let friday = c.proposal("friday", 0, "Organize dinner Friday", None);
    assert_eq!(c.adopt(friday)["result"]["fact"], fact(1));
    let saturday = c.proposal("saturday", 1, "Organize dinner Saturday", Some(""));
    fs::write(
        f.root.join("sender-request.json"),
        serde_json::to_vec(&saturday).unwrap(),
    )
    .unwrap();
    let original = c.adopt(saturday.clone());
    assert_eq!(original["result"]["fact"], fact(2));
    c.close();
    drop(c);
    let mut c = Client::process();
    c.connect(&f, "reopen");
    let old = c.context(fact(1));
    assert_eq!(old["tip"], fact(2));
    assert_eq!(old["at"], fact(1));
    let sunday = c.proposal("sunday", 2, "Organize dinner Sunday", None);
    c.adopt(sunday);
    let before = f.snapshot();
    let q = c.query("saturday");
    assert_eq!(q["result"], original["result"]);
    assert_eq!(q["tip"], fact(3));
    assert_eq!(c.call_lease(saturday.clone(), "deny"), original);
    assert_eq!(c.context(Value::Null)["at"], fact(3));
    let mut changed = saturday.clone();
    changed["replacement"]["why"] = Value::Null;
    assert_eq!(c.call_lease(changed, "deny")["code"], "conflict");
    let mut history = request("read_history");
    history["through"] = Value::Null;
    history["after"] = json!(0);
    history["limit"] = json!(1);
    let page = c.call_lease(history, "deny");
    assert_eq!(page["next_after"], 1);
    assert_eq!(page["through"], fact(3));
    for reference in [
        &page["records"][0]["input"]["instruction"],
        &page["records"][0]["input"]["replacement"]["what"],
        &page["records"][0]["approval"],
    ] {
        let mut resolve = request("resolve_text");
        resolve["material"] = reference.clone();
        let out = c.call_lease(resolve, "deny");
        assert_eq!(out["kind"], "resolved");
        assert_eq!(material(out["text"].as_str().unwrap()), *reference);
    }
    assert_eq!(f.snapshot(), before, "queries/retries changed custody");
    c.close();
}
#[test]
fn trusted_host_split_exact_input_and_disclosure() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("open", 0, "é\n\u{1b}[31mDinner", None);
    let before = f.snapshot();
    assert_eq!(c.call(r.clone())["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
    let p = c.prepare(r.clone());
    assert_eq!(p["kind"], "prepared", "{p}");
    assert!(p["presentation"].as_str().unwrap().contains("\\u001b"));
    let mut changed = r.clone();
    changed["key"] = json!("other");
    assert_eq!(c.confirm(changed)["code"], "conflict");
    assert_eq!(f.snapshot(), before);
    c.adopt(r.clone());
    let mut query = request("inspect_operation");
    query["key"] = json!("open");
    let before = f.snapshot();
    let mut auth = lease("allow");
    auth["disclose"] = json!("deny");
    let out = c.send(
        json!({"bridge":"ck-intent-bridge","kind":"call","authorization":auth,"request":query}),
    );
    assert_eq!(out["value"]["code"], "denied");
    assert!(out["value"].get("result").is_none());
    assert_eq!(f.snapshot(), before);
    assert_eq!(c.call_lease(r, "deny")["kind"], "accepted");
    c.close();
}
#[test]
fn invalid_frames_close_without_initialization() {
    let f = Fixture::new();
    let good = serde_json::to_string(&f.connect("fresh_provision")).unwrap();
    for bytes in [
        good.replace("\"id\":1", "\"id\":1,\"id\":1"),
        good.replace(V, "0.5.0-prototype.2"),
        good.replace("\"id\":1", "\"id\":2"),
        format!("{good}x"),
        good.replace("\"coverage\":", "\"foreign\":true,\"coverage\":"),
    ] {
        let mut c = ReferencedIntent::new();
        assert!(c.handle(bytes.as_bytes()).is_none());
        assert!(c.is_closed());
        assert!(!f.root.join("slot").exists());
    }
}
#[test]
fn source_limits_and_no_approval_on_generated_overflow() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let control = "\u{1}".repeat(4096);
    let reference = c.retain(&control);
    let mut r = request("open_intent");
    r["key"] = json!("large");
    r["instruction"] = reference.clone();
    r["replacement"] = json!({"what":reference,"why":reference});
    let before = f.snapshot();
    assert_eq!(c.prepare(r)["value"]["code"], "unsupported");
    assert_eq!(f.snapshot(), before);
    c.close();
}
#[test]
fn material_damage_refuses_read_without_writes() {
    let f = Fixture::new();
    let mut c = Client::library();
    c.connect(&f, "fresh_provision");
    let r = c.proposal("open", 0, "Friday", None);
    let digest = r["replacement"]["what"]["sha256"]
        .as_str()
        .unwrap()
        .to_owned();
    c.adopt(r);
    c.close();
    fs::write(
        f.root.join(format!("slot/materials/{digest}.txt")),
        "damage",
    )
    .unwrap();
    let before = f.snapshot();
    let mut c = Client::library();
    let out = c.send(f.connect("reopen"));
    assert_eq!(out["value"]["code"], "unavailable");
    assert_eq!(f.snapshot(), before);
}
#[test]
fn eof_and_close_release_actual_child_custody() {
    let f = Fixture::new();
    let mut c = Client::process();
    c.connect(&f, "fresh_provision");
    let mut other = Client::library();
    assert_eq!(
        other.send(f.connect("reopen"))["value"]["code"],
        "unavailable"
    );
    if let Transport::Process(p) = &mut c.transport {
        drop(p.stdin.take());
        assert!(p.wait().unwrap().success());
    }
    let mut reopened = Client::process();
    reopened.connect(&f, "reopen");
    reopened.close();
}
