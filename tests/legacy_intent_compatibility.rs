#![cfg(target_os = "linux")]
//! Frozen public-protocol bytes captured from the pre-P1 source baseline.
//! This is a source regression, not human approval or release qualification.
use changekernel::ReferencedIntent;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
};

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

struct Fixture(PathBuf);
impl Drop for Fixture {
    fn drop(&mut self) {
        // Preserve failed custody for diagnosis rather than changing its evidence.
        if !std::thread::panicking() {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
}

enum Client {
    Library(Box<ReferencedIntent>),
    Process(Child),
}
impl Client {
    fn new(process: bool) -> Self {
        if process {
            Self::Process(
                Command::new(env!("CARGO_BIN_EXE_changekernel"))
                    .arg("--referenced-intent-bridge")
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .unwrap(),
            )
        } else {
            Self::Library(Box::default())
        }
    }
    fn send(&mut self, bytes: &[u8]) -> Vec<u8> {
        match self {
            Self::Library(client) => client.handle(bytes).expect("valid envelope lost its reply"),
            Self::Process(child) => {
                let input = child.stdin.as_mut().unwrap();
                input
                    .write_all(&(bytes.len() as u32).to_be_bytes())
                    .unwrap();
                input.write_all(bytes).unwrap();
                input.flush().unwrap();
                let output = child.stdout.as_mut().unwrap();
                let mut header = [0; 4];
                output.read_exact(&mut header).unwrap();
                let len = u32::from_be_bytes(header) as usize;
                assert!((1..=262144).contains(&len));
                let mut reply = vec![0; len];
                output.read_exact(&mut reply).unwrap();
                reply
            }
        }
    }
    fn observe_closed(&mut self) {
        match self {
            Self::Library(client) => assert!(client.is_closed()),
            Self::Process(child) => {
                assert!(child.wait().unwrap().success());
                let mut stderr = Vec::new();
                child
                    .stderr
                    .as_mut()
                    .unwrap()
                    .read_to_end(&mut stderr)
                    .unwrap();
                assert!(stderr.is_empty(), "unexpected bridge stderr: {stderr:?}");
            }
        }
    }
}
impl Drop for Client {
    fn drop(&mut self) {
        if let Self::Process(child) = self {
            drop(child.stdin.take());
            if child.try_wait().unwrap().is_none() {
                child.kill().unwrap();
            }
            child.wait().unwrap();
        }
    }
}

fn retained_files(root: &Path) -> BTreeMap<String, String> {
    let mut files = BTreeMap::new();
    for name in ["trace.jsonl", "checkpoint.json", "incident.json"] {
        files.insert(
            format!("slot/{name}"),
            digest(&fs::read(root.join("slot").join(name)).unwrap()),
        );
    }
    for entry in fs::read_dir(root.join("slot/materials")).unwrap() {
        let path = entry.unwrap().path();
        files.insert(
            path.strip_prefix(root).unwrap().to_str().unwrap().into(),
            digest(&fs::read(&path).unwrap()),
        );
    }
    files
}

#[test]
fn legacy_bytes_survive_library_stdio_and_cross_transport_reopen() {
    let golden: Value =
        serde_json::from_str(include_str!("fixtures/legacy_intent_compatibility.json")).unwrap();
    let expected_files: BTreeMap<String, String> =
        serde_json::from_value(golden["files"].clone()).unwrap();
    // Sequential clients avoid inheriting library custody descriptors across fork.
    // Each store is reopened through the other public transport.
    for process_first in [false, true] {
        let root = Fixture(
            std::env::temp_dir().join(format!("ck-p1-{}-{process_first}", std::process::id())),
        );
        fs::create_dir(&root.0).unwrap();
        for (session, steps) in golden["sessions"].as_array().unwrap().iter().enumerate() {
            let mut client = Client::new(process_first ^ (session == 1));
            for step in steps.as_array().unwrap() {
                let mut request = step["request"].clone();
                if request["kind"] == "connect" {
                    request["grant"]["directory"] = root.0.join("slot").to_str().unwrap().into();
                    request["grant"]["anchor"] =
                        root.0.join("slot-anchor.json").to_str().unwrap().into();
                }
                let reply = client.send(&serde_json::to_vec(&request).unwrap());
                assert_eq!(reply.last(), Some(&b'\n'));
                assert_eq!(
                    digest(&reply),
                    step["response_sha256"].as_str().unwrap(),
                    "{} (process_first={process_first}, session={session}): {}",
                    step["label"],
                    String::from_utf8_lossy(&reply)
                );
            }
            client.observe_closed();
            assert_eq!(retained_files(&root.0), expected_files);
        }
    }
}
