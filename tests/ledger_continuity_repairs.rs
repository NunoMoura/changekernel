#![cfg(target_os = "linux")]
//! Focused failure-precedence regressions for the R35 source repairs.
use changekernel::*;
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
};

static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Owner;
impl LedgerGuard for Owner {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
    fn member(&mut self, _: &str, _: &str, _: LedgerMemberPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
}
impl LedgerHistoryGuard for Owner {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
    fn member(&mut self, _: &str, _: &str, _: LedgerHistoryMemberPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
}
impl LedgerContinuityGuard for Owner {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        LedgerPermission::Allow
    }
    fn member(
        &mut self,
        _: &str,
        _: &str,
        _: LedgerContinuityMemberPermission,
    ) -> LedgerPermission {
        LedgerPermission::Allow
    }
}
struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "ck-continuity-repair-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).unwrap();
        Self(root)
    }
    fn path(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
    fn host(&self, version: u64, seen: Arc<Mutex<Vec<LedgerIoEvent>>>) -> Host {
        let pairs = std::array::from_fn(|i| LedgerPair {
            change: format!("change-{i}"),
            custody: format!("member-{i}"),
        });
        let directory = self.path("ledger");
        let anchor = self.path("anchor.json");
        let hook: LedgerIoHook = Box::new({
            let seen = seen.clone();
            move |event| {
                seen.lock().unwrap().push(event);
                LedgerIoFault::Continue
            }
        });
        match version {
            4 => Host::V4(Box::new(
                LedgerHost::connect(
                    LedgerGrant::new(LedgerGrantSpec {
                        profile: "ck-ledger@4",
                        ledger: "ledger-1",
                        custody: "ledger-custody",
                        owner: "owner-1",
                        workspace_id: "workspace-1",
                        binding: "fixture@1",
                        directory: &directory,
                        anchor: &anchor,
                        grants: &pairs,
                    })
                    .unwrap(),
                    OpeningMode::FreshProvision,
                    &mut Owner,
                    Some(hook),
                )
                .unwrap(),
            )),
            5 => Host::V5(Box::new(
                LedgerHistoryHost::connect(
                    LedgerHistoryGrant::new(LedgerHistoryGrantSpec {
                        profile: "ck-ledger-history@5",
                        ledger: "ledger-1",
                        custody: "ledger-custody",
                        owner: "owner-1",
                        workspace_id: "workspace-1",
                        binding: "fixture@1",
                        directory: &directory,
                        anchor: &anchor,
                        grants: &pairs,
                        policy: "fixture-notice@1",
                        check: "notice-what@1",
                        evaluator: "utf8-length@1",
                        adopter: "owner-1",
                    })
                    .unwrap(),
                    OpeningMode::FreshProvision,
                    &mut Owner,
                    Some(hook),
                )
                .unwrap(),
            )),
            6 => {
                drop(hook);
                Host::V6(Box::new(
                    LedgerContinuityHost::connect(
                        LedgerContinuityGrant::new(LedgerContinuityGrantSpec {
                            profile: "ck-ledger-continuity@6",
                            ledger: "ledger-1",
                            custody: "ledger-custody",
                            owner: "owner-1",
                            workspace_id: "workspace-1",
                            binding: "fixture@1",
                            directory: &directory,
                            anchor: &anchor,
                            grants: &pairs,
                            policy: "fixture-notice@1",
                            check: "notice-what@1",
                            evaluator: "utf8-length@1",
                            adopter: "owner-1",
                        })
                        .unwrap(),
                        OpeningMode::FreshProvision,
                        &mut Owner,
                        Some(Box::new(move |event| {
                            if let LedgerContinuityIoEvent::File(event) = event {
                                seen.lock().unwrap().push(event);
                            }
                            LedgerContinuityIoFault::Continue
                        })),
                    )
                    .unwrap(),
                ))
            }
            _ => unreachable!(),
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        if std::thread::panicking() {
            eprintln!("preserved failed repair fixture: {}", self.0.display());
        } else {
            fs::remove_dir_all(&self.0).unwrap();
        }
    }
}
// Boxing is test-only; it does not alter source custody or its accounting.
enum Host {
    V4(Box<LedgerHost>),
    V5(Box<LedgerHistoryHost>),
    V6(Box<LedgerContinuityHost>),
}
impl Host {
    fn list(&mut self, version: u64) -> Value {
        let mut bytes = serde_json::to_vec(&json!({
            "v": version, "op": "list_changes", "ledger": "ledger-1",
            "workspace_id": "workspace-1", "limit": 1, "cursor": null
        }))
        .unwrap();
        let output = match self {
            Self::V4(host) => host.list_changes(&LedgerInput::new(bytes), &mut Owner),
            Self::V5(host) => host.list_changes(&LedgerHistoryInput::new(&mut bytes), &mut Owner),
            Self::V6(host) => {
                host.list_changes(&LedgerContinuityInput::new(&mut bytes), &mut Owner)
            }
        };
        serde_json::from_slice(&output).unwrap()
    }
}

#[test]
fn shared_refusal_order_is_profile_selected_with_compound_damage() {
    // v6 requires a supported btrfs test root; use an external TMPDIR.
    for version in [4, 5, 6] {
        for damage in ["missing", "malformed", "selector", "temporary"] {
            let fixture = Fixture::new();
            let seen = Arc::new(Mutex::new(Vec::new()));
            let mut host = fixture.host(version, seen.clone());
            let incident = fs::read(fixture.path("ledger/incident.json")).unwrap();
            fs::rename(fixture.path("ledger"), fixture.path("held-ledger")).unwrap();
            match damage {
                "missing" => fs::remove_file(fixture.path("anchor.json")).unwrap(),
                "malformed" => fs::write(fixture.path("anchor.json"), b"{").unwrap(),
                "selector" => {
                    let bytes = fs::read_to_string(fixture.path("anchor.json")).unwrap();
                    fs::write(
                        fixture.path("anchor.json"),
                        bytes.replace("\"ledger-1\"", "\"other-id\""),
                    )
                    .unwrap();
                }
                "temporary" => fs::write(fixture.path("anchor.tmp"), b"{}").unwrap(),
                _ => unreachable!(),
            }
            seen.lock().unwrap().clear();
            assert_eq!(host.list(version)["code"], "unavailable");
            let anchor_reads = seen
                .lock()
                .unwrap()
                .iter()
                .filter(|event| {
                    event.scope == 0 && event.object == "anchor.json" && event.step == "before_read"
                })
                .count();
            if version == 6 {
                assert_eq!(anchor_reads, 0, "v{version}/{damage}");
                let work = LedgerContinuityWork::last_call();
                assert_eq!(work.identity_acquisitions.attempts, 0);
                assert_eq!(work.retention.attempts, 0);
            } else {
                assert!(anchor_reads > 0, "v{version}/{damage}");
            }
            assert_eq!(
                fs::read(fixture.path("held-ledger/incident.json")).unwrap(),
                incident,
                "v{version}/{damage}"
            );
        }
    }
}
