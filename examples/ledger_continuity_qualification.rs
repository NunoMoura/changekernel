//! Preparation-only consumer for a separately authorized Linux/btrfs witness.
//! This trusted owner-1 fixture is neither a controller nor an effect executor.
//! No phase runs implicitly; failed namespaces and evidence are never removed.
//! The operator and same-privilege host are trusted; private evidence is not a
//! disclosure service, portable grant or proof against hostile fixture writers.
use changekernel::{
    LedgerCollectionPermission, LedgerContinuityGrant, LedgerContinuityGrantSpec,
    LedgerContinuityGuard, LedgerContinuityHost, LedgerContinuityInput,
    LedgerContinuityMemberPermission, LedgerContinuityWork, LedgerPair, LedgerPermission,
    OpeningMode,
};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{
    env,
    error::Error,
    ffi::OsString,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const HELP: &str = "ledger_continuity_qualification --help
ledger_continuity_qualification seed ROOT EXPECTED_EXE_SHA256
ledger_continuity_qualification resume ROOT EXPECTED_EXE_SHA256

Requires separately authorized execution of exact immutable Linux/btrfs bytes.
ROOT must be a canonical absolute external namespace. Seed requires absence;
resume requires original seed.json and custody. No repair or cleanup occurs.
EXPECTED_EXE_SHA256 is 64 lowercase hex digits for the actual running binary.
Evidence contains private accepted material; retain it under the fixture owner.
This witnesses continuity only, not application effects, dogfood or controller authority.";
const LEDGER: &str = "qualification-ledger";
const EXAMPLE: &str = "ledger_continuity_qualification";
const MAX_EXE: u64 = 128 * 1024 * 1024;
const MAX_FILE: usize = 65_536;
const MAX_EVIDENCE: usize = 2_097_152;
type Result<T> = std::result::Result<T, Box<dyn Error>>;

#[derive(Debug, PartialEq, Eq)]
enum Command {
    Help,
    Phase {
        seed: bool,
        root: PathBuf,
        expected: String,
    },
}
fn require(ok: bool, message: &str) -> Result<()> {
    if ok {
        Ok(())
    } else {
        Err(message.into())
    }
}
fn digest_text(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
fn lexical_root(root: &Path) -> Result<()> {
    let s = root.to_str().ok_or("ROOT must be UTF-8")?;
    require(
        root.is_absolute() && s.len() > 1,
        "ROOT must be absolute, not /",
    )?;
    require(
        s[1..]
            .split('/')
            .all(|p| !p.is_empty() && p != "." && p != ".."),
        "ROOT must have canonical spelling",
    )?;
    require(
        !s.chars().any(char::is_control),
        "ROOT contains control characters",
    )?;
    require(
        !root.starts_with(env!("CARGO_MANIFEST_DIR")),
        "ROOT must be outside the source/build manifest namespace",
    )
}
fn command(args: Vec<OsString>) -> Result<Command> {
    if args == [OsString::from("--help")] {
        return Ok(Command::Help);
    }
    require(
        args.len() == 3,
        "expected --help or seed/resume ROOT EXPECTED_EXE_SHA256",
    )?;
    let seed = match args[0].to_str() {
        Some("seed") => true,
        Some("resume") => false,
        _ => return Err("unsupported phase".into()),
    };
    let root = PathBuf::from(&args[1]);
    lexical_root(&root)?;
    let expected = args[2].to_str().ok_or("digest must be UTF-8")?.to_owned();
    require(
        digest_text(&expected),
        "expected digest must be 64 lowercase hex digits",
    )?;
    Ok(Command::Phase {
        seed,
        root,
        expected,
    })
}
fn hash_reader(mut reader: impl Read, limit: u64) -> Result<String> {
    let mut hash = Sha256::new();
    let mut bytes = 0u64;
    let mut buffer = [0u8; 8192];
    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        bytes += n as u64;
        require(bytes <= limit, "hash input exceeds fixture bound")?;
        hash.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn running_digest(expected: &str) -> Result<String> {
    require(
        cfg!(target_os = "linux"),
        "only the explicit Linux fixture is supported",
    )?;
    // Linux's proc link names the executed inode, even if its pathname changed.
    // current_exe() plus reopening its pathname could hash replacement bytes.
    let image = File::open("/proc/self/exe")?;
    require(
        image.metadata()?.is_file(),
        "running image is not a regular file",
    )?;
    let actual = hash_reader(image, MAX_EXE)?;
    require(
        actual == expected,
        "running executable digest mismatch; custody not opened",
    )?;
    Ok(actual)
}
fn namespace(root: &Path, seed: bool) -> Result<()> {
    lexical_root(root)?;
    let parent = root.parent().ok_or("missing ROOT parent")?;
    require(
        fs::canonicalize(parent)? == parent,
        "ROOT parent is not canonical",
    )?;
    if seed {
        require(
            fs::symlink_metadata(root).is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound),
            "seed requires an absent ROOT",
        )
    } else {
        require(
            fs::symlink_metadata(root)?.is_dir(),
            "resume ROOT must be a real directory",
        )?;
        require(
            fs::canonicalize(root)? == root,
            "resume ROOT is not canonical",
        )
    }
}
fn read_file(path: &Path, limit: usize) -> Result<Vec<u8>> {
    let parent = path.parent().ok_or("missing file parent")?;
    require(
        fs::canonicalize(parent)? == parent,
        "evidence/custody parent is not canonical",
    )?;
    let mut options = OpenOptions::new();
    options.read(true);
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(libc::O_NOFOLLOW);
    }
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    require(
        metadata.is_file(),
        "evidence/custody must be a regular file",
    )?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        require(
            metadata.nlink() == 1,
            "evidence/custody link count is not one",
        )?;
    }
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1).read_to_end(&mut bytes)?;
    require(
        bytes.len() <= limit,
        "evidence/custody exceeds fixture bound",
    )?;
    Ok(bytes)
}
fn create_directory(path: &Path) -> Result<()> {
    let mut builder = fs::DirBuilder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        builder.mode(0o700);
    }
    builder.create(path)?;
    Ok(())
}
fn custody_paths() -> Vec<String> {
    let mut paths = vec!["anchor-parent/shared.json".into()];
    for name in ["writer.lock", "creation.json", "incident.json"] {
        paths.push(format!("ledger-parent/ledger/{name}"));
    }
    for slot in 1..=2 {
        paths.push(format!("ledger-parent/ledger/members/m-{slot}.anchor.json"));
        for name in [
            "writer.lock",
            "trace.jsonl",
            "checkpoint.json",
            "incident.json",
        ] {
            paths.push(format!("ledger-parent/ledger/members/m-{slot}/{name}"));
        }
    }
    paths
}
fn snapshot(root: &Path) -> Result<Value> {
    let mut files = Map::new();
    for relative in custody_paths() {
        // Fixed known custody files only; no recursive inventory or cleanup.
        // Exact UTF-8 bytes include acceptance controls and enrolled identities.
        files.insert(
            relative.clone(),
            Value::String(String::from_utf8(read_file(
                &root.join(relative),
                MAX_FILE,
            )?)?),
        );
    }
    Ok(Value::Object(files))
}

struct Owner;
impl LedgerContinuityGuard for Owner {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, ledger: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        if ledger == LEDGER {
            LedgerPermission::Allow
        } else {
            LedgerPermission::Deny
        }
    }
    fn member(
        &mut self,
        ledger: &str,
        change: &str,
        _: LedgerContinuityMemberPermission,
    ) -> LedgerPermission {
        if ledger == LEDGER && matches!(change, "change-0" | "change-1") {
            LedgerPermission::Allow
        } else {
            LedgerPermission::Deny
        }
    }
}
fn host(root: &Path, mode: OpeningMode) -> Result<LedgerContinuityHost> {
    let grants: [LedgerPair; 16] = std::array::from_fn(|i| LedgerPair {
        change: format!("change-{i}"),
        custody: format!("qualification-member-{i}"),
    });
    let grant = LedgerContinuityGrant::new(LedgerContinuityGrantSpec {
        profile: "ck-ledger-continuity@6",
        ledger: LEDGER,
        custody: "qualification-custody",
        owner: "owner-1",
        workspace_id: "workspace-1",
        binding: "fixture@1",
        directory: &root.join("ledger-parent/ledger"),
        anchor: &root.join("anchor-parent/shared.json"),
        grants: &grants,
        policy: "fixture-notice@1",
        check: "notice-what@1",
        evaluator: "utf8-length@1",
        adopter: "owner-1",
    })
    .map_err(|e| format!("grant refused: {e:?}"))?;
    LedgerContinuityHost::connect(grant, mode, &mut Owner, None).map_err(|e| {
        format!("native custody refused: {e:?}; support/continuity remains unestablished").into()
    })
}
fn requests() -> Vec<Value> {
    let base = |op: &str, extra: Value| {
        let mut v = json!({"v":6,"op":op,"ledger":LEDGER,"workspace_id":"workspace-1"});
        v.as_object_mut()
            .unwrap()
            .extend(extra.as_object().unwrap().clone());
        v
    };
    vec![
        base(
            "create_change",
            json!({"key":"create-a","what":"Preserve original intent and exact Check results across clean restart at this configured namespace.","why":"Qualify continuity without claiming native effects."}),
        ),
        base(
            "create_change",
            json!({"key":"create-b","what":"Keep second Change independent.","why":null}),
        ),
        base(
            "run_check",
            json!({"change":"change-0","key":"check-before","expected_intent":"change-0:origin","check":"notice-what@1"}),
        ),
        base(
            "revise_intent",
            json!({"change":"change-0","key":"revise-a","expected_intent":"change-0:origin","what":"Preserve restart evidence.","why":"Witness current applicability."}),
        ),
        base(
            "run_check",
            json!({"change":"change-0","key":"check-after","expected_intent":"change-0:op:3","check":"notice-what@1"}),
        ),
        base(
            "inspect_history",
            json!({"change":"change-0","at":null,"from":null,"limit":4}),
        ),
        base(
            "inspect_context",
            json!({"change":"change-0","at":null,"purpose":"understanding"}),
        ),
        base(
            "inspect_context",
            json!({"change":"change-0","at":"change-0:op:2","purpose":"understanding"}),
        ),
        base(
            "inspect_context",
            json!({"change":"change-1","at":null,"purpose":"understanding"}),
        ),
    ]
}
fn request_bytes() -> Vec<String> {
    requests().iter().map(Value::to_string).collect()
}
fn work(w: LedgerContinuityWork) -> Value {
    json!({"shared_passes":w.shared_passes,"member_passes":w.member_passes,
        "identity_acquisitions":w.identity_acquisitions.attempts,
        "native_fstype":w.native_fstype.attempts,"native_fsinfo":w.native_fsinfo.attempts,"native_handle":w.native_handle.attempts,
        "identity_io_failures":w.identity_io_failures,"identity_refusals":w.identity_refusals,
        "check_attempts":w.check_attempts,"check_acceptances":w.check_acceptances,
        "named_payload_peak":w.named_payload_peak,"named_fixed_bytes_peak":w.named_fixed_bytes_peak})
}
fn call(h: &mut LedgerContinuityHost, request: &str) -> Result<String> {
    let v: Value = serde_json::from_str(request)?;
    let input = LedgerContinuityInput::new(&mut request.as_bytes().to_vec());
    let response = match v["op"].as_str() {
        Some("create_change") => h.create_change(&input, &mut Owner),
        Some("revise_intent") => h.revise_intent(&input, &mut Owner),
        Some("run_check") => h.run_check(&input, &mut Owner),
        Some("inspect_history") => h.inspect_history(&input, &mut Owner),
        Some("inspect_context") => h.inspect_context(&input, &mut Owner),
        _ => return Err("unexpected fixture operation".into()),
    };
    require(
        response.len() <= MAX_FILE,
        "response exceeds this small fixture's bound",
    )?;
    Ok(String::from_utf8(response)?)
}
fn validate_responses(raw: &[String]) -> Result<()> {
    require(raw.len() == 9, "incomplete phase responses")?;
    let replies: Vec<Value> = raw
        .iter()
        .map(|s| serde_json::from_str(s))
        .collect::<std::result::Result<_, _>>()?;
    for (i, kind) in [
        "created",
        "created",
        "intent_assessed",
        "intent_revised",
        "intent_assessed",
        "history_view",
        "change_context",
        "change_context",
        "change_context",
    ]
    .iter()
    .enumerate()
    {
        let r = &replies[i];
        require(
            r["v"] == 6
                && r["kind"] == *kind
                && r["ledger"] == LEDGER
                && r["workspace_id"] == "workspace-1",
            "unexpected phase response; continuity not established",
        )?;
    }
    for (i, change, seq, reference) in [
        (0, "change-0", 1, "change-0:origin"),
        (1, "change-1", 1, "change-1:origin"),
        (2, "change-0", 2, "change-0:op:2"),
        (3, "change-0", 3, "change-0:op:3"),
        (4, "change-0", 4, "change-0:op:4"),
    ] {
        let r = &replies[i];
        require(
            r["actor"] == "owner-1"
                && r["change"] == change
                && r["seq"] == seq
                && r["result"] == reference,
            "wrong accepted attribution/reference",
        )?;
    }
    require(
        replies[2]["passed"] == false
            && replies[2]["intent"] == "change-0:origin"
            && replies[4]["passed"] == true
            && replies[4]["intent"] == "change-0:op:3",
        "fixed Check results/subjects differ",
    )?;
    for r in &replies[6..9] {
        require(
            r["projection"] == "ck-ledger-understanding@2"
                && r["adoption_scope"] == "authenticated_direct_only",
            "wrong context interpretation/scope",
        )?;
    }
    let current = &replies[6];
    require(
        current["coverage"] == json!({"required":4,"returned":4,"complete":true})
            && current["current_intent"] == "change-0:op:3",
        "incomplete current context",
    )?;
    require(
        current["assessments"]
            == json!([
                {"assessment":"change-0:op:2","intent":"change-0:origin","applicability":"historical"},
                {"assessment":"change-0:op:4","intent":"change-0:op:3","applicability":"current"}
            ]),
        "wrong current applicability",
    )?;
    let historical = &replies[7];
    require(
        historical["coverage"] == json!({"required":2,"returned":2,"complete":true})
            && historical["current_intent"] == "change-0:origin"
            && historical["assessments"]
                == json!([
                    {"assessment":"change-0:op:2","intent":"change-0:origin","applicability":"current"}
                ]),
        "wrong historical context/applicability",
    )?;
    require(
        replies[8]["coverage"] == json!({"required":1,"returned":1,"complete":true})
            && replies[8]["current_intent"] == "change-1:origin"
            && replies[8]["assessments"] == json!([]),
        "second Change is not independent",
    )?;
    require(
        replies[5]["records"] == current["records"],
        "history/context accepted-prefix mismatch",
    )?;
    let records = current["records"]
        .as_array()
        .ok_or("missing context records")?;
    require(records.len() == 4, "wrong accepted record count")?;
    require(
        historical["records"] == json!(&records[..2]),
        "historical prefix differs",
    )?;
    let inputs = requests();
    for (record, i) in records.iter().zip([0, 2, 3, 4]) {
        require(
            record["input"] == inputs[i] && record["result"] == replies[i],
            "record lost original input/result",
        )?;
    }
    require(
        replies[8]["records"][0]["input"] == inputs[1]
            && replies[8]["records"][0]["result"] == replies[1],
        "second origin lost original input/result",
    )
}
fn strings(v: &Value) -> Result<Vec<String>> {
    v.as_array()
        .ok_or("missing evidence array")?
        .iter()
        .map(|v| {
            v.as_str()
                .map(str::to_owned)
                .ok_or_else(|| "non-string evidence entry".into())
        })
        .collect()
}
fn validate_seed(e: &Value, root: &Path, digest: &str) -> Result<Vec<String>> {
    require(
        e["example"] == EXAMPLE && e["phase"] == "seed" && e["status"] == "ok",
        "original complete seed evidence required",
    )?;
    require(
        e["root"].as_str() == root.to_str() && e["exe_sha256"] == digest,
        "phase namespace/executable mismatch; custody not opened",
    )?;
    require(
        strings(&e["requests"])? == request_bytes(),
        "wrong original phase requests",
    )?;
    let raw = strings(&e["responses"])?;
    validate_responses(&raw)?;
    let files = e["custody"]
        .as_object()
        .ok_or("missing original custody evidence")?;
    require(
        files.len() == custody_paths().len()
            && custody_paths().iter().all(|p| {
                files
                    .get(p)
                    .is_some_and(|v| v.as_str().is_some_and(|s| s.len() <= MAX_FILE))
            }),
        "incomplete original custody evidence",
    )?;
    Ok(raw)
}
fn write_evidence(root: &Path, seed: bool, evidence: &Value) -> Result<PathBuf> {
    let name = if seed {
        "seed.json".to_owned()
    } else {
        format!(
            "resume-{}-{}.json",
            SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos(),
            std::process::id()
        )
    };
    let path = root.join(name);
    let mut bytes = serde_json::to_vec_pretty(evidence)?;
    bytes.push(b'\n');
    require(
        bytes.len() <= MAX_EVIDENCE,
        "phase evidence exceeds fixture bound",
    )?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    File::open(root)?.sync_all()?;
    Ok(path)
}
fn phase(seed: bool, root: &Path, expected: &str) -> Result<Value> {
    let digest = running_digest(expected)?; // Before any fixture access or creation.
    namespace(root, seed)?;
    let original = if seed {
        None
    } else {
        let evidence: Value =
            serde_json::from_slice(&read_file(&root.join("seed.json"), MAX_EVIDENCE)?)?;
        let responses = validate_seed(&evidence, root, &digest)?;
        require(
            snapshot(root)? == evidence["custody"],
            "accepted bytes/identities differ before connection; unavailable",
        )?;
        Some((evidence, responses))
    };
    if seed {
        create_directory(root)?;
        create_directory(&root.join("ledger-parent"))?;
        create_directory(&root.join("anchor-parent"))?;
    }
    let mut h = host(
        root,
        if seed {
            OpeningMode::FreshProvision
        } else {
            OpeningMode::Reopen
        },
    )?;
    let connection = work(h.connection_work());
    if let Some((e, _)) = &original {
        require(
            snapshot(root)? == e["custody"],
            "reopen altered original custody; unavailable",
        )?;
    }
    let requests = request_bytes();
    let mut responses = vec![String::new(); requests.len()];
    let mut observations = vec![Value::Null; requests.len()];
    // Resume first inspects, then delivers accepted original-key results. Missing
    // or changed acceptance evidence was refused above, never seeded/repaired.
    let order: Vec<usize> = if seed {
        (0..9).collect()
    } else {
        vec![5, 6, 7, 8, 0, 1, 2, 3, 4]
    };
    for &i in &order {
        responses[i] = call(&mut h, &requests[i])?;
        observations[i] = work(h.last_work());
        if let Some((e, old)) = &original {
            require(
                responses[i] == old[i],
                "exact original response differs; continuity unestablished",
            )?;
            require(
                h.last_work().check_attempts == 0 && h.last_work().check_acceptances == 0,
                "resume evaluated/accepted a new Check",
            )?;
            require(
                snapshot(root)? == e["custody"],
                "resume changed accepted bytes/identities; unavailable",
            )?;
        } else {
            let r: Value = serde_json::from_str(&responses[i])?;
            require(
                r["kind"] != "error",
                "seed operation refused; preserve partial fixture",
            )?;
        }
    }
    validate_responses(&responses)?;
    let evidence = json!({"example":EXAMPLE,"phase":if seed {"seed"} else {"resume"},"status":"ok",
        "exe_sha256":digest,"root":root.to_str(),"requests":requests,"responses":responses,
        "custody":snapshot(root)?,"pid":std::process::id(),"execution_order":order,
        "connection_work":connection,"operation_work":observations,
        "limits":"trusted owner-1 continuity fixture only; host events require separate approval; no application effects or controller authority"});
    let path = write_evidence(root, seed, &evidence)?;
    drop(h);
    Ok(
        json!({"phase":if seed {"seed"} else {"resume"},"status":"ok","root":root.to_str(),"exe_sha256":digest,"evidence":path.to_str()}),
    )
}
fn main() {
    let result = command(env::args_os().skip(1).collect()).and_then(|c| match c {
        Command::Help => {
            println!("{HELP}");
            Ok(())
        }
        Command::Phase {
            seed,
            root,
            expected,
        } => {
            println!("{}", phase(seed, &root, &expected)?);
            Ok(())
        }
    });
    if let Err(error) = result {
        println!(
            "{}",
            json!({"status":"unavailable","error":error.to_string(),"preserve":"do not clean up, repair, re-enroll or infer an outcome"})
        );
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn args(parts: &[&str]) -> Vec<OsString> {
        parts.iter().map(OsString::from).collect()
    }

    #[test]
    fn help_and_explicit_phase_admission_are_pure() {
        assert_eq!(command(args(&["--help"])).unwrap(), Command::Help);
        let digest = "a".repeat(64);
        for phase in ["seed", "resume"] {
            assert!(matches!(
                command(args(&[phase, "/external/fixture", &digest])).unwrap(),
                Command::Phase { .. }
            ));
        }
        for parts in [
            vec![],
            vec!["seed"],
            vec!["resume", "relative", &digest],
            vec!["seed", "/external/../fixture", &digest],
            vec!["seed", "/external//fixture", &digest],
            vec!["seed", "/external/fixture", "BAD"],
            vec!["--help", "extra"],
        ] {
            assert!(command(args(&parts)).is_err(), "{parts:?}");
        }
    }
    #[test]
    fn hash_is_exact_and_bounded_without_filesystem() {
        assert_eq!(
            hash_reader(std::io::Cursor::new(b"abc"), 3).unwrap(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert!(hash_reader(std::io::Cursor::new(b"abc"), 2).is_err());
        assert!(!digest_text(&"A".repeat(64)));
    }
    #[test]
    fn wrong_or_missing_phase_evidence_refuses_in_pure_validation() {
        let root = Path::new("/external/fixture");
        let digest = "a".repeat(64);
        for e in [
            Value::Null,
            json!({"example":EXAMPLE,"phase":"resume","status":"ok"}),
            json!({"example":EXAMPLE,"phase":"seed","status":"ok","root":"/other","exe_sha256":digest}),
            json!({"example":EXAMPLE,"phase":"seed","status":"ok","root":"/external/fixture","exe_sha256":"b".repeat(64)}),
            json!({"example":EXAMPLE,"phase":"seed","status":"ok","root":"/external/fixture","exe_sha256":digest,"requests":request_bytes(),"responses":[]}),
        ] {
            assert!(validate_seed(&e, root, &digest).is_err());
        }
    }
    // Wire-field fixture grounded in history_record/HistoryResult::serialize
    // and history_view. Views include the fields consumed by this oracle, not
    // fabricated native identities, a host implementation or runtime evidence.
    fn source_responses() -> Vec<Value> {
        let inputs = requests();
        let mut replies = Vec::new();
        for (i, kind, change, seq, reference) in [
            (0, "created", "change-0", 1, "change-0:origin"),
            (1, "created", "change-1", 1, "change-1:origin"),
            (2, "intent_assessed", "change-0", 2, "change-0:op:2"),
            (3, "intent_revised", "change-0", 3, "change-0:op:3"),
            (4, "intent_assessed", "change-0", 4, "change-0:op:4"),
        ] {
            let mut result = json!({"v":6,"kind":kind,"ledger":LEDGER,"workspace_id":"workspace-1",
                "change":change,"key":inputs[i]["key"],"actor":"owner-1","result":reference,"seq":seq});
            if matches!(i, 0 | 1 | 3) {
                result["adoption"] = json!("authenticated_direct");
            }
            if i == 3 {
                result["intent"] = json!("change-0:op:3");
                result["previous_intent"] = json!("change-0:origin");
            }
            if matches!(i, 2 | 4) {
                let intent = if i == 2 {
                    "change-0:origin"
                } else {
                    "change-0:op:3"
                };
                let what = inputs[if i == 2 { 0 } else { 3 }]["what"].as_str().unwrap();
                result.as_object_mut().unwrap().extend(json!({"intent":intent,
                    "policy":"fixture-notice@1","check":"notice-what@1","evaluator":"utf8-length@1",
                    "passed":i == 4,"feedback":if i == 2 {"shorten_or_use_other_channel"} else {"fits"},
                    "evidence":{"intent":intent,"field":"what","utf8_bytes":what.len(),"limit":80}
                }).as_object().unwrap().clone());
            }
            replies.push(result);
        }
        let records: Vec<Value> = [0, 2, 3, 4].into_iter().map(|i| json!({
            "v":6,"custody":"qualification-member-0","ledger":LEDGER,"workspace_id":"workspace-1",
            "binding":"fixture@1","change":"change-0","seq":replies[i]["seq"],
            "prev":match i {0 => Value::Null, 2 => json!("change-0:origin"), 3 => json!("change-0:op:2"), _ => json!("change-0:op:3")},
            "kind":replies[i]["kind"],"input":inputs[i],"result":replies[i]
        })).collect();
        replies.push(
            json!({"v":6,"kind":"history_view","ledger":LEDGER,"workspace_id":"workspace-1",
            "change":"change-0","projection":"ck-ledger-history-range@2","records":records}),
        );
        for (change, current, required, material, assessments) in [
            (
                "change-0",
                "change-0:op:3",
                4,
                json!(records),
                json!([
                    {"assessment":"change-0:op:2","intent":"change-0:origin","applicability":"historical"},
                    {"assessment":"change-0:op:4","intent":"change-0:op:3","applicability":"current"}
                ]),
            ),
            (
                "change-0",
                "change-0:origin",
                2,
                json!(&records[..2]),
                json!([
                    {"assessment":"change-0:op:2","intent":"change-0:origin","applicability":"current"}
                ]),
            ),
            (
                "change-1",
                "change-1:origin",
                1,
                json!([{
                    "v":6,"custody":"qualification-member-1","ledger":LEDGER,"workspace_id":"workspace-1",
                    "binding":"fixture@1","change":"change-1","seq":1,"prev":null,"kind":"created",
                    "input":inputs[1],"result":replies[1]
                }]),
                json!([]),
            ),
        ] {
            replies.push(json!({"v":6,"kind":"change_context","ledger":LEDGER,"workspace_id":"workspace-1",
                "change":change,"projection":"ck-ledger-understanding@2","adoption_scope":"authenticated_direct_only",
                "current_intent":current,"records":material,"assessments":assessments,
                "coverage":{"required":required,"returned":required,"complete":true}}));
        }
        replies
    }
    #[test]
    fn source_response_oracle_accepts_positive_transcript_and_refuses_wrong_kinds() {
        let inputs = requests();
        assert!(inputs[0]["what"].as_str().unwrap().len() > 80);
        assert!(inputs[3]["what"].as_str().unwrap().len() <= 80);
        let replies = source_responses();
        let raw = |values: &[Value]| values.iter().map(|v| format!("{v}\n")).collect::<Vec<_>>();
        validate_responses(&raw(&replies)).unwrap();
        for (i, wrong) in [(2, "assessment"), (4, "assessment"), (5, "change_history")] {
            let mut wrong_replies = replies.clone();
            wrong_replies[i]["kind"] = json!(wrong);
            let error = validate_responses(&raw(&wrong_replies)).unwrap_err();
            assert!(error.to_string().contains("unexpected phase response"));
        }
    }
    #[test]
    fn missing_or_refused_responses_cannot_be_complete_seed_evidence() {
        assert!(validate_responses(&[]).is_err());
        assert!(validate_responses(&vec![
            r#"{"v":6,"kind":"error","code":"unavailable"}"#
                .to_owned();
            9
        ])
        .is_err());
    }
}
