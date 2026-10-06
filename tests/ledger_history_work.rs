//! Constructor ownership and independent completed-entry observations.
//! Runtime whole-call witnesses are not claimed by these constructor tests.
use changekernel::{
    LedgerCollectionPermission, LedgerGrant, LedgerGrantSpec, LedgerGuard, LedgerHistoryCall,
    LedgerHistoryGrant, LedgerHistoryGrantSpec, LedgerHistoryInput, LedgerHistoryWork, LedgerHost,
    LedgerMemberPermission, LedgerPair, LedgerPermission, LedgerWork, OpeningError, OpeningMode,
};
use std::path::Path;
const C: usize = 1_048_576;
fn pairs() -> [LedgerPair; 16] {
    std::array::from_fn(|i| LedgerPair {
        change: format!("change-{i}"),
        custody: format!("member-{i}"),
    })
}
fn spec(grants: &[LedgerPair; 16]) -> LedgerHistoryGrantSpec<'_> {
    LedgerHistoryGrantSpec {
        profile: "ck-ledger-history@5",
        ledger: "ledger-1",
        custody: "ledger-custody",
        owner: "owner-1",
        workspace_id: "workspace-1",
        binding: "fixture@1",
        directory: Path::new("/unopened-ledger"),
        anchor: Path::new("/elsewhere/anchor.json"),
        grants,
        policy: "fixture-notice@1",
        check: "notice-what@1",
        evaluator: "utf8-length@1",
        adopter: "owner-1",
    }
}
#[test]
fn admitted_input_transfers_without_copy_and_observes_real_capacity() {
    assert_eq!(LedgerHistoryWork::last_call().call, None);
    let mut bytes = Vec::with_capacity(C);
    bytes.extend_from_slice(b"not yet decoded");
    let pointer = bytes.as_ptr();
    let input = LedgerHistoryInput::new(&mut bytes);
    assert!(bytes.is_empty());
    assert_eq!(bytes.capacity(), 0);
    assert_eq!(input.as_bytes().as_ptr(), pointer);
    assert_eq!(input.capacity(), C);
    let work = LedgerHistoryWork::last_call();
    assert_eq!(work.call, Some(LedgerHistoryCall::Input));
    assert_eq!(work.input_admission.attempts, 1);
    assert_eq!(work.input_admission.matches, 1);
    assert_eq!(work.supplied_input_bytes, 15);
    assert_eq!(work.supplied_input_capacity, C as u64);
    assert_eq!(work.named_payload_peak, C as u64);
    assert_eq!(work.constructions.completions, 1);
    assert_eq!(work.ingress.attempts, 0);
    assert_eq!(work.permissions.attempts, 0);
    assert_eq!(work.shared_passes + work.member_passes, 0);
    drop(input);
    assert_eq!(
        format!("{work:?}"),
        format!("{:?}", LedgerHistoryWork::last_call())
    );
}
#[test]
fn rejected_short_oversized_backing_remains_external_unchanged() {
    let mut bytes = Vec::with_capacity(C + 1);
    bytes.extend_from_slice(b"{} ");
    let original = (bytes.as_ptr(), bytes.len(), bytes.capacity());
    let input = LedgerHistoryInput::new(&mut bytes);
    assert_eq!((bytes.as_ptr(), bytes.len(), bytes.capacity()), original);
    assert_eq!(bytes, b"{} ");
    assert_eq!(input.as_bytes(), b"");
    assert_eq!(input.capacity(), 0);
    let work = LedgerHistoryWork::last_call();
    assert_eq!(work.supplied_input_bytes, 3);
    assert_eq!(work.supplied_input_capacity, original.2 as u64);
    assert_eq!(work.input_admission.no_matches, 1);
    assert_eq!(work.named_payload_peak, 0);
    assert_eq!(work.constructions.attempts, 0);
    assert_eq!(
        work.ingress.attempts + work.permissions.attempts + work.reads.attempts,
        0
    );
    // Debug reads only scalar state, never enrolls the rejected backing.
    assert!(format!("{input:?}").contains("admitted: false"));
}
#[test]
fn maximum_length_input_is_admitted_but_above_bound_is_not_transferred() {
    let mut exact = vec![0; C];
    let input = LedgerHistoryInput::new(&mut exact);
    assert_eq!(input.as_bytes().len(), C);
    assert!(exact.is_empty());
    let first = LedgerHistoryWork::last_call();
    let mut over = vec![0; C + 1];
    let pointer = over.as_ptr();
    let rejected = LedgerHistoryInput::new(&mut over);
    assert_eq!(over.as_ptr(), pointer);
    assert_eq!(over.len(), C + 1);
    assert_eq!(rejected.capacity(), 0);
    let latest = LedgerHistoryWork::last_call();
    assert_eq!(latest.input_admission.no_matches, 1);
    assert_eq!(latest.named_payload_peak, 0);
    assert_eq!(first.named_payload_peak, C as u64);
    drop(input);
    assert_eq!(
        format!("{latest:?}"),
        format!("{:?}", LedgerHistoryWork::last_call())
    );
}
#[test]
fn grant_copies_only_normalized_values_and_seals_without_private_io() {
    let mut grants = pairs();
    grants[0].change.reserve(C + 1);
    let caller_capacity = grants[0].change.capacity();
    let grant = LedgerHistoryGrant::new(spec(&grants)).unwrap();
    let work = LedgerHistoryWork::last_call();
    assert_eq!(work.call, Some(LedgerHistoryCall::Grant));
    assert_eq!(work.grant_admission.matches, 1);
    assert_eq!(work.constructions.completions, 1);
    assert_eq!(work.grant_vectors_peak, 1);
    assert!(work.named_payload_peak > 0);
    assert!(work.named_payload_peak < 4096);
    assert_eq!(grants[0].change.capacity(), caller_capacity);
    assert_eq!(work.reads.attempts + work.permissions.attempts, 0);
    assert_eq!(work.shared_passes + work.member_passes, 0);
    let mut empty = vec![];
    drop(LedgerHistoryInput::new(&mut empty));
    let latest = LedgerHistoryWork::last_call();
    drop(grant);
    assert_eq!(latest.call, Some(LedgerHistoryCall::Input));
    assert_eq!(
        format!("{latest:?}"),
        format!("{:?}", LedgerHistoryWork::last_call())
    );
}
#[test]
fn overlong_last_grant_scalar_rejects_before_any_content_scan_or_copy() {
    let mut grants = pairs();
    grants[15].custody = "x".repeat(65);
    assert_eq!(
        LedgerHistoryGrant::new(spec(&grants)).unwrap_err(),
        OpeningError::Unavailable
    );
    let work = LedgerHistoryWork::last_call();
    assert_eq!(work.grant_admission.no_matches, 1);
    assert_eq!(work.fields.no_matches, 1);
    assert_eq!(work.fields.operand_bytes, 0);
    assert_eq!(work.constructions.attempts, 0);
    assert_eq!(work.named_payload_peak, 0);
    assert_eq!(work.errors.matches, 1);
    assert_eq!(work.reads.attempts, 0);
}
#[test]
fn wrong_policy_and_duplicate_pairs_reject_with_reached_operand_work() {
    let mut grants = pairs();
    let mut wrong = spec(&grants);
    wrong.policy = "wrong";
    assert_eq!(
        LedgerHistoryGrant::new(wrong).unwrap_err(),
        OpeningError::Unavailable
    );
    let policy = LedgerHistoryWork::last_call();
    assert!(policy.fields.operand_bytes >= "fixture-notice@1".len() as u64);
    assert_eq!(policy.grant_admission.no_matches, 1);
    assert_eq!(policy.named_payload_peak, 0);
    grants[15].change = grants[0].change.clone();
    assert_eq!(
        LedgerHistoryGrant::new(spec(&grants)).unwrap_err(),
        OpeningError::Unavailable
    );
    let duplicate = LedgerHistoryWork::last_call();
    assert_eq!(duplicate.identifiers.no_matches, 1);
    assert!(duplicate.identifiers.operand_bytes > 0);
    assert_eq!(duplicate.constructions.attempts, 0);
    assert_eq!(duplicate.reads.attempts + duplicate.permissions.attempts, 0);
}
#[test]
fn lexical_path_refusal_and_reserved_anchor_do_not_access_filesystem() {
    let grants = pairs();
    for path in ["relative", "/a/../b", "/a/./b", "/a//b", "/a/", "/a\n"] {
        let mut invalid = spec(&grants);
        invalid.directory = Path::new(path);
        assert_eq!(
            LedgerHistoryGrant::new(invalid).unwrap_err(),
            OpeningError::Unavailable
        );
        assert_eq!(LedgerHistoryWork::last_call().reads.attempts, 0);
        assert_eq!(LedgerHistoryWork::last_call().named_payload_peak, 0);
    }
    for path in ["/elsewhere/anchor.tmp", "/unopened-ledger/anchor.json"] {
        let mut invalid = spec(&grants);
        invalid.anchor = Path::new(path);
        assert_eq!(
            LedgerHistoryGrant::new(invalid).unwrap_err(),
            OpeningError::Unavailable
        );
        assert_eq!(LedgerHistoryWork::last_call().reads.attempts, 0);
    }
}
struct Denied;
impl LedgerGuard for Denied {
    fn principal(&self) -> &str {
        "owner-1"
    }
    fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
        LedgerPermission::Deny
    }
    fn member(&mut self, _: &str, _: &str, _: LedgerMemberPermission) -> LedgerPermission {
        panic!("denied collection must not reach member")
    }
}
#[test]
fn new_constructor_entries_do_not_reset_legacy_observer_or_vice_versa() {
    let grants = pairs();
    let legacy = LedgerGrant::new(LedgerGrantSpec {
        profile: "ck-ledger@4",
        ledger: "ledger-1",
        custody: "ledger-custody",
        owner: "owner-1",
        workspace_id: "workspace-1",
        binding: "fixture@1",
        directory: Path::new("/unopened-ledger"),
        anchor: Path::new("/elsewhere/anchor.json"),
        grants: &grants,
    })
    .unwrap();
    assert!(matches!(
        LedgerHost::connect(legacy, OpeningMode::Reopen, &mut Denied, None),
        Err(OpeningError::Denied)
    ));
    let old_work = LedgerWork::last_call();
    let new_grant = LedgerHistoryGrant::new(spec(&grants)).unwrap();
    let new_work = LedgerHistoryWork::last_call();
    assert_eq!(
        format!("{old_work:?}"),
        format!("{:?}", LedgerWork::last_call())
    );
    let legacy = LedgerGrant::new(LedgerGrantSpec {
        profile: "ck-ledger@4",
        ledger: "ledger-1",
        custody: "ledger-custody",
        owner: "owner-1",
        workspace_id: "workspace-1",
        binding: "fixture@1",
        directory: Path::new("/unopened-ledger"),
        anchor: Path::new("/elsewhere/anchor.json"),
        grants: &grants,
    })
    .unwrap();
    assert!(matches!(
        LedgerHost::connect(legacy, OpeningMode::Reopen, &mut Denied, None),
        Err(OpeningError::Denied)
    ));
    drop(new_grant);
    assert_eq!(
        format!("{new_work:?}"),
        format!("{:?}", LedgerHistoryWork::last_call())
    );
}

#[test]
fn invalid_utf8_path_refusal_charges_each_available_byte_range() {
    use std::ffi::OsString;
    use std::os::unix::ffi::OsStringExt;
    use std::path::PathBuf;
    let grants = pairs();
    let small = PathBuf::from(OsString::from_vec(vec![b'/', 0xff]));
    let mut large = vec![b'a'; 4083];
    large[0] = b'/';
    large[4082] = 0xff;
    let large = PathBuf::from(OsString::from_vec(large));
    let observe = |directory: &Path| {
        let mut installation = spec(&grants);
        installation.directory = directory;
        assert_eq!(
            LedgerHistoryGrant::new(installation).unwrap_err(),
            OpeningError::Unavailable
        );
        let work = LedgerHistoryWork::last_call();
        assert_eq!(work.reads.attempts, 0);
        assert_eq!(work.constructions.attempts, 0);
        assert_eq!(work.named_payload_peak, 0);
        work
    };
    let short = observe(&small);
    let long = observe(&large);
    println!(
        "S1 operand bytes {}/{}, schema words {}/{}",
        short.fields.operand_bytes,
        long.fields.operand_bytes,
        short.fields.schema_words,
        long.fields.schema_words
    );
    assert_eq!(long.fields.operand_bytes - short.fields.operand_bytes, 4081);
}
#[test]
fn lexical_path_component_predicates_are_charged_when_entered() {
    let grants = pairs();
    let large = "/a".repeat(512);
    let observe = |directory: &Path| {
        let mut installation = spec(&grants);
        installation.directory = directory;
        drop(LedgerHistoryGrant::new(installation).unwrap());
        let work = LedgerHistoryWork::last_call();
        assert_eq!(work.reads.attempts, 0);
        work
    };
    let short = observe(Path::new("/a"));
    let long = observe(Path::new(&large));
    println!(
        "S2 attempts {}/{}, schema words {}/{}",
        short.fields.attempts,
        long.fields.attempts,
        short.fields.schema_words,
        long.fields.schema_words
    );
    assert!(long.fields.attempts >= short.fields.attempts + 3 * 511);
    assert!(long.fields.schema_words >= short.fields.schema_words + 3 * 511);
}

// Actual host whole-call observations. These do not substitute for the separate
// lifecycle/failure owners' candidate-selected integration suites.
struct Fixture(std::path::PathBuf);
impl Fixture {
    fn new() -> Self {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "ck-history-work-{}-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&root).unwrap();
        Self(root)
    }
    fn grant(&self) -> LedgerHistoryGrant {
        let grants = pairs();
        let directory = self.0.join("ledger");
        let anchor = self.0.join("anchor.json");
        let mut s = spec(&grants);
        s.directory = &directory;
        s.anchor = &anchor;
        LedgerHistoryGrant::new(s).unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.0).unwrap();
    }
}
struct CurrentGuard {
    collection_create: std::sync::Arc<std::sync::atomic::AtomicBool>,
    create: std::sync::Arc<std::sync::atomic::AtomicBool>,
    principal_valid: std::sync::Arc<std::sync::atomic::AtomicBool>,
    history: std::sync::Arc<std::sync::atomic::AtomicBool>,
    adopt: bool,
    check: bool,
}
impl CurrentGuard {
    fn new() -> Self {
        Self {
            collection_create: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true)),
            create: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true)),
            principal_valid: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true)),
            history: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true)),
            adopt: true,
            check: true,
        }
    }
}
impl changekernel::LedgerHistoryGuard for CurrentGuard {
    fn principal(&self) -> &str {
        if self
            .principal_valid
            .load(std::sync::atomic::Ordering::SeqCst)
        {
            "owner-1"
        } else {
            "owner-2"
        }
    }
    fn collection(&mut self, _: &str, permission: LedgerCollectionPermission) -> LedgerPermission {
        if permission == LedgerCollectionPermission::Create
            && !self
                .collection_create
                .load(std::sync::atomic::Ordering::SeqCst)
        {
            LedgerPermission::Deny
        } else {
            LedgerPermission::Allow
        }
    }
    fn member(
        &mut self,
        _: &str,
        _: &str,
        p: changekernel::LedgerHistoryMemberPermission,
    ) -> LedgerPermission {
        use changekernel::LedgerHistoryMemberPermission as P;
        let allowed = match p {
            P::Create => self.create.load(std::sync::atomic::Ordering::SeqCst),
            P::History => self.history.load(std::sync::atomic::Ordering::SeqCst),
            P::AdoptIntent => self.adopt,
            P::RunCheck => self.check,
            _ => true,
        };
        if allowed {
            LedgerPermission::Allow
        } else {
            LedgerPermission::Deny
        }
    }
}
fn ingress(v: serde_json::Value) -> LedgerHistoryInput {
    let mut bytes = serde_json::to_vec(&v).unwrap();
    LedgerHistoryInput::new(&mut bytes)
}
fn host_create(
    h: &mut changekernel::LedgerHistoryHost,
    g: &mut CurrentGuard,
    key: &str,
) -> serde_json::Value {
    let input = ingress(
        serde_json::json!({"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":key,"what":"x".repeat(81),"why":null}),
    );
    let value: serde_json::Value = serde_json::from_slice(&h.create_change(&input, g)).unwrap();
    assert_eq!(value["kind"], "created", "{value}");
    value
}
#[test]
fn actual_host_snapshots_distinguish_retained_calculation_new_execution_and_disposal() {
    use changekernel::LedgerHistoryHost;
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    let connection = host.connection_work();
    assert_eq!(connection.call, Some(LedgerHistoryCall::Connect));
    assert_eq!(connection.member_passes, 0);
    assert!(connection.shared_passes > 0);
    assert!(connection.permissions.matches >= 2);
    let original = host_create(&mut host, &mut guard, "open");
    assert_eq!(original["adoption"], "authenticated_direct");
    let check = ingress(
        serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"check","expected_intent":"change-0:origin","check":"notice-what@1"}),
    );
    let response: serde_json::Value =
        serde_json::from_slice(&host.run_check(&check, &mut guard)).unwrap();
    assert_eq!(response["kind"], "intent_assessed", "{response}");
    assert_eq!(response["passed"], false);
    let execution = host.last_work();
    assert_eq!(execution.check_attempts, 1);
    assert_eq!(execution.check_acceptances, 1);
    assert!(execution.evaluator_calculations.completions > 0);
    assert!(execution.records.completions > 0);
    assert!(execution.member_passes <= 16);
    assert!(execution.shared_passes <= 16);
    assert!(execution.named_payload_peak <= 64 * 1024 * 1024);
    assert!(execution.records_peak <= 2);
    assert!(execution.trace_buffers_peak <= 2);
    let request = ingress(
        serde_json::json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":null,"purpose":"understanding"}),
    );
    let response: serde_json::Value =
        serde_json::from_slice(&host.inspect_context(&request, &mut guard)).unwrap();
    assert_eq!(response["kind"], "change_context", "{response}");
    assert_eq!(response["records"].as_array().unwrap().len(), 2);
    assert_eq!(response["assessments"][0]["applicability"], "current");
    assert_eq!(response["accepted"]["last"], 2);
    assert_eq!(response["selected"]["last"], 2);
    let read = host.last_work();
    assert_eq!(read.check_attempts + read.check_acceptances, 0);
    assert!(read.evaluator_calculations.completions > 0);
    assert!(read.copied_record_bytes > 0);
    assert!(read.projection.attempts > 0);
    assert_eq!(read.applicability.matches, 1);
    assert_eq!(read.outputs.matches, 1);
    assert!(read.trace_buffers_peak <= 2);
    assert_eq!(
        format!("{connection:?}"),
        format!("{:?}", host.connection_work())
    );
    drop(ingress(serde_json::json!({})));
    assert_eq!(format!("{read:?}"), format!("{:?}", host.last_work()));
    drop(host);
    assert_eq!(
        LedgerHistoryWork::last_call().call,
        Some(LedgerHistoryCall::Input)
    );
}
#[test]
fn final_hook_revocation_discards_private_output_before_sealing() {
    use changekernel::{LedgerHistoryHost, LedgerIoFault};
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    host_create(&mut host, &mut guard, "open");
    drop(host);
    let history = guard.history.clone();
    let hook = Box::new(move |event: changekernel::LedgerIoEvent| {
        if event.object == "reply" && event.step == "before" {
            history.store(false, std::sync::atomic::Ordering::SeqCst);
        }
        LedgerIoFault::Continue
    });
    let mut host =
        LedgerHistoryHost::connect(fixture.grant(), OpeningMode::Reopen, &mut guard, Some(hook))
            .unwrap();
    let request = ingress(
        serde_json::json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":null,"purpose":"understanding"}),
    );
    assert_eq!(
        host.inspect_context(&request, &mut guard),
        b"{\"v\":5,\"kind\":\"error\",\"code\":\"denied\"}\n"
    );
    let denied = host.last_work();
    assert_eq!(denied.outputs.attempts, 1);
    assert_eq!(denied.outputs.no_matches, 1);
    assert_eq!(denied.outputs.matches, 0);
    assert_eq!(denied.errors.matches, 1);
    assert_eq!(denied.permission_denied, 1);
    assert!(denied.copied_record_bytes > 0);
    assert!(denied.named_payload_peak > 0);
    assert_eq!(denied.retention.attempts, 0);
    drop(host);
    assert_eq!(
        format!("{denied:?}"),
        format!("{:?}", LedgerHistoryWork::last_call())
    );
}

fn assert_whole_call_limits(w: LedgerHistoryWork) {
    const A: u64 = 16_777_216;
    const T: u64 = 17_825_792;
    const Q: u64 = 2_097_152;
    const C: u64 = 1_048_576;
    let (s, m) = (w.shared_passes, w.member_passes);
    assert!(s <= 16 && m <= 64, "passes {w:?}");
    if w.call != Some(LedgerHistoryCall::ListChanges) {
        assert!(m <= 16);
    }
    assert!(w.permissions.attempts <= 256, "permissions {w:?}");
    assert!(
        w.buffered_bytes <= 4 * s * (C + 1) + m * (4 * (C + 1) + T + 1) + 32 * (C + 1),
        "reads {w:?}"
    );
    assert!(w.accepted_hash_bytes <= m * A, "accepted hashing {w:?}");
    assert!(
        w.candidate_hash_bytes <= m * (A + 4 * C) + 32 * C,
        "candidate hashing {w:?}"
    );
    assert!(
        w.controls.attempts <= 4 * s + 4 * m + 32,
        "control codecs {w:?}"
    );
    assert!(
        w.control_emissions.attempts <= 4 * s + 4 * m + 32,
        "control emissions {w:?}"
    );
    assert!(w.records.attempts <= 128 * m + 32, "record codecs {w:?}");
    assert!(
        w.record_emissions.attempts <= 128 * m + 32,
        "record emissions {w:?}"
    );
    assert!(
        w.constructions.attempts <= 2 * 128 * m + 16 * (s + m) + 256,
        "owning constructions {w:?}"
    );
    assert!(
        w.key_uniqueness.attempts + w.key_lookup.attempts + w.key_feasibility.attempts
            <= 8_384 * m + 512,
        "key predicates {w:?}"
    );
    assert!(
        w.semantic.attempts <= 128 * m + 32,
        "semantic predicates {w:?}"
    );
    assert!(
        w.evaluator_calculations.attempts <= 128 * m + 32,
        "evaluations {w:?}"
    );
    assert!(
        w.fields.attempts <= 512 * (1 + 4 * s + 132 * m + 32 + 256),
        "field checks {w:?}"
    );
    assert!(w.copied_record_bytes <= Q, "copy bytes {w:?}");
    assert!(
        w.named_payload_peak <= 64 * 1024 * 1024,
        "payload capacities {w:?}"
    );
    assert!(
        w.trace_buffers_peak <= 2 && w.trace_capacity_peak <= 2 * (T + 1),
        "trace owners {w:?}"
    );
    assert!(w.records_peak <= 2, "record owners {w:?}");
    assert!(
        w.grant_vectors_peak <= 1 && w.accepted_vectors_peak <= 1 && w.metadata_vectors_peak <= 1,
        "collection owners {w:?}"
    );
    assert!(
        w.span_entries_peak <= 128 && w.key_entries_peak <= 128 && w.assessment_entries_peak <= 127,
        "descriptor owners {w:?}"
    );
    assert!(w.check_attempts <= 1 && w.check_acceptances <= 1);
}
#[test]
fn count_capacity_retry_and_both_read_operations_have_real_whole_call_witnesses() {
    use changekernel::LedgerHistoryHost;
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    host_create(&mut host, &mut guard, "open");
    let request = ingress(
        serde_json::json!({"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"revise","expected_intent":"change-0:origin","what":"Fits","why":null}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.revise_intent(&request, &mut guard)).unwrap();
    assert_eq!(result["kind"], "intent_revised", "{result}");
    assert_whole_call_limits(host.last_work());
    for n in 3..=128 {
        let input = ingress(
            serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":format!("check-{n}"),"expected_intent":"change-0:op:2","check":"notice-what@1"}),
        );
        let result: serde_json::Value =
            serde_json::from_slice(&host.run_check(&input, &mut guard)).unwrap();
        assert_eq!(result["seq"], n, "{result}");
        assert_whole_call_limits(host.last_work());
    }
    let input = ingress(
        serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"overflow","expected_intent":"change-0:op:2","check":"notice-what@1"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.run_check(&input, &mut guard)).unwrap();
    assert_eq!(result["code"], "unsupported");
    assert_eq!(host.last_work().check_attempts, 0);
    assert_whole_call_limits(host.last_work());
    guard.adopt = false;
    let result: serde_json::Value =
        serde_json::from_slice(&host.revise_intent(&request, &mut guard)).unwrap();
    assert_eq!(result["seq"], 2);
    assert_whole_call_limits(host.last_work());
    let original = host_create(&mut host, &mut guard, "open");
    assert_eq!(original["seq"], 1);
    assert_whole_call_limits(host.last_work());
    let input = ingress(
        serde_json::json!({"v":5,"op":"select_change","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.select_change(&input, &mut guard)).unwrap();
    assert_eq!(result["member"]["accepted"]["last"], 128);
    assert_whole_call_limits(host.last_work());
    let input = ingress(
        serde_json::json!({"v":5,"op":"inspect_history","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":"change-0:op:4","from":null,"limit":1}),
    );
    let bytes = host.inspect_history(&input, &mut guard);
    let result: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(result["coverage"]["last"], 1, "{result}");
    assert_eq!(result["next"]["at"], "change-0:op:4");
    assert_eq!(result["next"]["from"], "change-0:op:2");
    assert_whole_call_limits(host.last_work());
    println!("near-count range work {:?}", host.last_work());
}
#[test]
fn all_sixteen_longer_members_are_validated_in_both_list_sweeps() {
    use changekernel::LedgerHistoryHost;
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    for i in 0..16 {
        host_create(&mut host, &mut guard, &format!("open-{i}"));
        let input = ingress(
            serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":format!("change-{i}"),"key":"check","expected_intent":format!("change-{i}:origin"),"check":"notice-what@1"}),
        );
        let result: serde_json::Value =
            serde_json::from_slice(&host.run_check(&input, &mut guard)).unwrap();
        assert_eq!(result["seq"], 2, "{result}");
    }
    let input = ingress(
        serde_json::json!({"v":5,"op":"list_changes","ledger":"ledger-1","workspace_id":"workspace-1","cursor":null,"limit":1}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.list_changes(&input, &mut guard)).unwrap();
    assert_eq!(result["kind"], "change_page", "{result}");
    assert_eq!(result["members"].as_array().unwrap().len(), 1);
    assert!(result["next"].is_object());
    let work = host.last_work();
    assert_eq!(work.member_passes, 32);
    assert_eq!(work.span_entries_peak, 2);
    assert_eq!(work.metadata_entries_peak, 16);
    assert_eq!(work.check_attempts + work.check_acceptances, 0);
    assert!(work.evaluator_calculations.matches >= 32);
    assert_whole_call_limits(work);
    println!("16-member list work {work:?}");
}

#[test]
fn escaped_maximum_text_near_byte_capacity_and_limit_context_are_observed() {
    use changekernel::LedgerHistoryHost;
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    let what = format!("x{}", "\0".repeat(65_535));
    let why = "\0".repeat(65_536);
    let input = ingress(
        serde_json::json!({"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"max","what":what,"why":why}),
    );
    assert_eq!(input.capacity(), C);
    let result: serde_json::Value =
        serde_json::from_slice(&host.create_change(&input, &mut guard)).unwrap();
    assert_eq!(result["kind"], "created", "{result}");
    assert_whole_call_limits(host.last_work());
    let mut tip = "change-0:origin".to_owned();
    let mut accepted = 1;
    for seq in 2..=24 {
        let input = ingress(
            serde_json::json!({"v":5,"op":"revise_intent","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":format!("large-{seq}"),"expected_intent":tip,"what":what,"why":why}),
        );
        let result: serde_json::Value =
            serde_json::from_slice(&host.revise_intent(&input, &mut guard)).unwrap();
        assert_whole_call_limits(host.last_work());
        if result["code"] == "unsupported" {
            break;
        }
        assert_eq!(result["kind"], "intent_revised", "{result}");
        tip = result["intent"].as_str().unwrap().to_owned();
        accepted += 1;
    }
    assert!(accepted > 16 && accepted < 24);
    let context = ingress(
        serde_json::json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":null,"purpose":"understanding"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.inspect_context(&context, &mut guard)).unwrap();
    assert_eq!(result["records"], serde_json::json!([]));
    assert_eq!(result["assessments"], serde_json::json!([]));
    assert_eq!(result["coverage"]["required"], accepted);
    assert_eq!(result["coverage"]["complete"], false);
    assert_eq!(result["gaps"][0]["code"], "required_material_limit");
    assert!(result["gaps"][0]["required_bytes"].as_u64().unwrap() > 15 * 1024 * 1024);
    assert_eq!(host.last_work().copied_record_bytes, 0);
    assert_whole_call_limits(host.last_work());
    println!("near-byte context work {:?}", host.last_work());
    let range = ingress(
        serde_json::json!({"v":5,"op":"inspect_history","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":null,"from":null,"limit":4}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.inspect_history(&range, &mut guard)).unwrap();
    assert_eq!(result["records"].as_array().unwrap().len(), 2);
    assert_eq!(result["next"]["from"], "change-0:op:3");
    assert_whole_call_limits(host.last_work());
}
#[test]
fn refused_input_foreign_reference_stale_intent_and_failed_connection_charge_only_entered_work() {
    use changekernel::{LedgerHistoryGuard, LedgerHistoryHost, LedgerHistoryMemberPermission};
    struct Deny;
    impl LedgerHistoryGuard for Deny {
        fn principal(&self) -> &str {
            panic!("non-Allow must not read principal")
        }
        fn collection(&mut self, _: &str, _: LedgerCollectionPermission) -> LedgerPermission {
            LedgerPermission::Deny
        }
        fn member(
            &mut self,
            _: &str,
            _: &str,
            _: LedgerHistoryMemberPermission,
        ) -> LedgerPermission {
            panic!("denied Connect must not reach a member")
        }
    }
    let fixture = Fixture::new();
    assert!(matches!(
        LedgerHistoryHost::connect(
            fixture.grant(),
            OpeningMode::FreshProvision,
            &mut Deny,
            None
        ),
        Err(OpeningError::Denied)
    ));
    let refused = LedgerHistoryWork::last_call();
    assert_eq!(refused.call, Some(LedgerHistoryCall::Connect));
    assert_eq!(refused.permission_denied, 1);
    assert_eq!(refused.principals.attempts, 0);
    assert_eq!(refused.reads.attempts, 0);
    assert_eq!(refused.shared_passes + refused.member_passes, 0);
    assert!(refused.named_payload_peak > 0);
    assert_whole_call_limits(refused);
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    host_create(&mut host, &mut guard, "open");
    let mut external = Vec::with_capacity(C + 1);
    external.extend_from_slice(b"{}");
    let invalid = LedgerHistoryInput::new(&mut external);
    let result: serde_json::Value =
        serde_json::from_slice(&host.run_check(&invalid, &mut guard)).unwrap();
    assert_eq!(result["code"], "invalid_input");
    assert_eq!(
        host.last_work().ingress.attempts
            + host.last_work().permissions.attempts
            + host.last_work().reads.attempts,
        0
    );
    assert_eq!(host.last_work().supplied_input_capacity, (C + 1) as u64);
    assert_whole_call_limits(host.last_work());
    let foreign = ingress(
        serde_json::json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":"foreign:origin","purpose":"understanding"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.inspect_context(&foreign, &mut guard)).unwrap();
    assert_eq!(result["code"], "denied");
    assert_eq!(host.last_work().reads.attempts, 0);
    assert_eq!(
        host.last_work().member_passes + host.last_work().shared_passes,
        0
    );
    assert_whole_call_limits(host.last_work());
    let stale = ingress(
        serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"stale","expected_intent":"change-0:op:2","check":"unknown@1"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.run_check(&stale, &mut guard)).unwrap();
    assert_eq!(result["code"], "conflict");
    assert_eq!(
        host.last_work().check_attempts + host.last_work().check_acceptances,
        0
    );
    assert_whole_call_limits(host.last_work());
}

#[test]
fn prospective_pending_recovery_and_read_validation_have_distinct_execution_counters() {
    use changekernel::{LedgerHistoryHost, LedgerIoFault};
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    host_create(&mut host, &mut guard, "open");
    drop(host);
    let once = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
    let armed = once.clone();
    let hook = Box::new(move |e: changekernel::LedgerIoEvent| {
        if e.scope == 1
            && e.phase == "reserve"
            && e.object == "checkpoint.tmp"
            && e.step == "written"
            && armed.swap(false, std::sync::atomic::Ordering::SeqCst)
        {
            LedgerIoFault::Refuse
        } else {
            LedgerIoFault::Continue
        }
    });
    let mut host =
        LedgerHistoryHost::connect(fixture.grant(), OpeningMode::Reopen, &mut guard, Some(hook))
            .unwrap();
    let input = ingress(
        serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"check","expected_intent":"change-0:origin","check":"notice-what@1"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.run_check(&input, &mut guard)).unwrap();
    assert_eq!(result["code"], "unavailable");
    let first = host.last_work();
    assert_eq!(first.check_attempts, 1);
    assert_eq!(first.check_acceptances, 0);
    assert_eq!(first.retention.attempts, 0);
    assert_whole_call_limits(first);
    let context = ingress(
        serde_json::json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":null,"purpose":"understanding"}),
    );
    let result: serde_json::Value =
        serde_json::from_slice(&host.inspect_context(&context, &mut guard)).unwrap();
    assert_eq!(result["accepted"]["last"], 1, "{result}");
    assert_eq!(host.last_work().cleanup.attempts, 0);
    assert_eq!(
        host.last_work().check_attempts + host.last_work().check_acceptances,
        0
    );
    assert!(host.last_work().evaluator_calculations.attempts > 0);
    assert_whole_call_limits(host.last_work());
    guard.check = false;
    let result: serde_json::Value =
        serde_json::from_slice(&host.run_check(&input, &mut guard)).unwrap();
    assert_eq!(result["code"], "denied");
    assert_eq!(host.last_work().cleanup.attempts, 0);
    assert_whole_call_limits(host.last_work());
    guard.check = true;
    let result: serde_json::Value =
        serde_json::from_slice(&host.run_check(&input, &mut guard)).unwrap();
    assert_eq!(result["kind"], "intent_assessed", "{result}");
    let resumed = host.last_work();
    assert_eq!(resumed.cleanup.attempts, 1);
    assert_eq!(resumed.check_attempts, 1);
    assert_eq!(resumed.check_acceptances, 1);
    assert_whole_call_limits(resumed);
    guard.check = false;
    let retry = host.run_check(&input, &mut guard);
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&retry).unwrap(),
        result
    );
    assert_eq!(
        host.last_work().check_attempts + host.last_work().check_acceptances,
        0
    );
    assert_whole_call_limits(host.last_work());
}

#[test]
fn creation_recovery_cleanup_requires_fresh_authority_before_mutation() {
    use changekernel::{LedgerHistoryHost, LedgerIoFault};
    use std::sync::{atomic::Ordering, Arc};
    for anchor_remnant in [false, true] {
        for revocation in ["member_create", "collection_create", "history", "principal"] {
            let fixture = Fixture::new();
            let mut guard = CurrentGuard::new();
            let hook = Box::new(|e: changekernel::LedgerIoEvent| {
                if e.scope == 1
                    && e.phase == "reserve"
                    && e.object == "checkpoint.tmp"
                    && e.step == "written"
                {
                    LedgerIoFault::Refuse
                } else {
                    LedgerIoFault::Continue
                }
            });
            let mut host = LedgerHistoryHost::connect(
                fixture.grant(),
                OpeningMode::FreshProvision,
                &mut guard,
                Some(hook),
            )
            .unwrap();
            let request = ingress(
                serde_json::json!({"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"open","what":"Fits","why":null}),
            );
            let refused: serde_json::Value =
                serde_json::from_slice(&host.create_change(&request, &mut guard)).unwrap();
            assert_eq!(refused["code"], "unavailable");
            assert_eq!(host.last_work().retention.attempts, 0);
            drop(host);
            let members = fixture.0.join("ledger/members");
            let member = members.join("m-1");
            // Installed-identical anchor sibling is recognized only with an
            // empty initial checkpoint/trace and no checkpoint temporary. This
            // fixture stages that case separately from the producer's real
            // prospective checkpoint remnant, not as coexisting remnants.
            let temporary = if anchor_remnant {
                std::fs::remove_file(member.join("checkpoint.tmp")).unwrap();
                std::fs::copy(members.join("m-1.anchor.json"), members.join("anchor.tmp")).unwrap();
                members.join("anchor.tmp")
            } else {
                member.join("checkpoint.tmp")
            };
            let paths = [
                fixture.0.join("ledger/creation.json"),
                members.join("m-1.anchor.json"),
                member.join("checkpoint.json"),
                member.join("trace.jsonl"),
                member.join("incident.json"),
                temporary,
            ];
            let before: Vec<_> = paths.iter().map(|p| std::fs::read(p).unwrap()).collect();
            let permission = match revocation {
                "member_create" => guard.create.clone(),
                "collection_create" => guard.collection_create.clone(),
                "history" => guard.history.clone(),
                "principal" => guard.principal_valid.clone(),
                _ => unreachable!(),
            };
            let seen = Arc::new(std::sync::atomic::AtomicBool::new(false));
            let observed = seen.clone();
            let permission_hook = permission.clone();
            let hook = Box::new(move |e: changekernel::LedgerIoEvent| {
                let selected = if anchor_remnant {
                    e.scope == 1 && e.object == "anchor.tmp"
                } else {
                    e.scope == 1 && e.object == "checkpoint.tmp"
                };
                if selected && e.step == "read" && !observed.swap(true, Ordering::SeqCst) {
                    permission_hook.store(false, Ordering::SeqCst);
                }
                LedgerIoFault::Continue
            });
            let mut host = LedgerHistoryHost::connect(
                fixture.grant(),
                OpeningMode::Reopen,
                &mut guard,
                Some(hook),
            )
            .unwrap();
            let denied: serde_json::Value =
                serde_json::from_slice(&host.create_change(&request, &mut guard)).unwrap();
            assert!(seen.load(Ordering::SeqCst));
            assert_eq!(
                denied["code"], "denied",
                "{revocation} anchor={anchor_remnant}: {denied}"
            );
            let work = host.last_work();
            println!("A1 {revocation} anchor={anchor_remnant}: remnant_bytes={} cleanup={:?} permissions={:?} principal={:?}", before[5].len(), work.cleanup, work.permissions, work.principals);
            assert_eq!(
                work.cleanup.attempts, 0,
                "{revocation} anchor={anchor_remnant}"
            );
            assert_eq!(work.retention.attempts, 0);
            assert_eq!(work.outputs.attempts, 0);
            assert_whole_call_limits(work);
            for (path, bytes) in paths.iter().zip(&before) {
                assert_eq!(&std::fs::read(path).unwrap(), bytes);
            }
            permission.store(true, Ordering::SeqCst);
            let accepted: serde_json::Value =
                serde_json::from_slice(&host.create_change(&request, &mut guard)).unwrap();
            assert_eq!(accepted["kind"], "created", "{accepted}");
            assert_eq!(accepted["seq"], 1);
            let recovered = host.last_work();
            assert_eq!(recovered.cleanup.completions, 1);
            assert_whole_call_limits(recovered);
            assert!(!member.join("checkpoint.tmp").exists());
            assert!(!members.join("anchor.tmp").exists());
            assert_eq!(
                std::fs::read(member.join("trace.jsonl"))
                    .unwrap()
                    .iter()
                    .filter(|b| **b == b'\n')
                    .count(),
                1
            );
        }
    }
}

#[test]
fn pending_actor_and_opcode_refusals_charge_only_entered_operand_groups() {
    use changekernel::{LedgerHistoryHost, LedgerIoFault};
    let fixture = Fixture::new();
    let mut guard = CurrentGuard::new();
    let mut host = LedgerHistoryHost::connect(
        fixture.grant(),
        OpeningMode::FreshProvision,
        &mut guard,
        None,
    )
    .unwrap();
    host_create(&mut host, &mut guard, "open");
    drop(host);
    let hook = Box::new(|e: changekernel::LedgerIoEvent| {
        if e.scope == 1
            && e.phase == "reserve"
            && e.object == "checkpoint.tmp"
            && e.step == "renamed"
        {
            LedgerIoFault::Refuse
        } else {
            LedgerIoFault::Continue
        }
    });
    let mut host =
        LedgerHistoryHost::connect(fixture.grant(), OpeningMode::Reopen, &mut guard, Some(hook))
            .unwrap();
    let request = ingress(
        serde_json::json!({"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"check","expected_intent":"change-0:origin","check":"notice-what@1"}),
    );
    let refused: serde_json::Value =
        serde_json::from_slice(&host.run_check(&request, &mut guard)).unwrap();
    assert_eq!(refused["code"], "unavailable");
    assert_eq!(host.last_work().retention.attempts, 0);
    drop(host);
    let checkpoint = fixture.0.join("ledger/members/m-1/checkpoint.json");
    let original = std::fs::read_to_string(&checkpoint).unwrap();
    assert_eq!(original.matches("\"actor\":\"owner-1\"").count(), 1);
    let context = ingress(
        serde_json::json!({"v":5,"op":"inspect_context","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","at":null,"purpose":"understanding"}),
    );
    for actor in ["x".repeat(4096), "owner-2".to_owned()] {
        let changed = original.replace("\"actor\":\"owner-1\"", &format!("\"actor\":\"{actor}\""));
        std::fs::write(&checkpoint, &changed).unwrap();
        let mut host =
            LedgerHistoryHost::connect(fixture.grant(), OpeningMode::Reopen, &mut guard, None)
                .unwrap();
        let reply: serde_json::Value =
            serde_json::from_slice(&host.inspect_context(&context, &mut guard)).unwrap();
        assert_eq!(reply["code"], "unavailable");
        let work = host.last_work();
        println!(
            "A2 actor length {}: {:?}",
            actor.len(),
            work.key_feasibility
        );
        assert!(work.key_feasibility.operand_bytes >= actor.len().max("owner-1".len()) as u64);
        assert_eq!(work.key_feasibility.no_matches, 1);
        // Actor refusal prevents entering the opcode comparison.
        assert_eq!(work.key_feasibility.schema_words, 2);
        assert_eq!(work.key_feasibility.attempts, 2);
        assert_eq!(work.cleanup.attempts + work.retention.attempts, 0);
        assert_whole_call_limits(work);
        assert_eq!(std::fs::read_to_string(&checkpoint).unwrap(), changed);
        drop(host);
    }
    let check_input = r#"{"v":5,"op":"run_check","ledger":"ledger-1","workspace_id":"workspace-1","change":"change-0","key":"check","expected_intent":"change-0:origin","check":"notice-what@1"}"#;
    let create_input = r#"{"v":5,"op":"create_change","ledger":"ledger-1","workspace_id":"workspace-1","key":"check","what":"Fits","why":null}"#;
    assert_eq!(original.matches(check_input).count(), 1);
    let changed = original.replace(check_input, create_input);
    std::fs::write(&checkpoint, &changed).unwrap();
    let mut host =
        LedgerHistoryHost::connect(fixture.grant(), OpeningMode::Reopen, &mut guard, None).unwrap();
    let reply: serde_json::Value =
        serde_json::from_slice(&host.inspect_context(&context, &mut guard)).unwrap();
    assert_eq!(reply["code"], "unavailable");
    let work = host.last_work();
    println!("A2 opcode refusal: {:?}", work.key_feasibility);
    assert_eq!(work.key_feasibility.attempts, 3);
    assert_eq!(work.key_feasibility.schema_words, 3);
    assert_eq!(work.key_feasibility.operand_bytes, 20); // owner-1 plus actual opcode/available alternatives
    assert_eq!(work.key_feasibility.no_matches, 1);
    assert_whole_call_limits(work);
    assert_eq!(std::fs::read_to_string(&checkpoint).unwrap(), changed);
}
