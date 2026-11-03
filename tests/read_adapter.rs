//! One Included original, supplied fixture trust only. No live host or H claim.
use api::adapters::ids;
use api::adapters::read_adapter::{self, AdapterError};
use api::adapters::sqlite::{
    CreationIntent, CreationProgress, LedgerIdentity, Original, PreparedOperationRequest, Register,
    WriterCustody,
};
use api::unqualified_change::{
    Access, Command, ContentId, ContentKey, ContextVersion, Disposition, Evidence, Finding,
    Operation, OperationId, OperationRequest, ReadWorkLimits, CURRENT_PROFILE,
};
use changekernel as api;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::path::Path;

// Read-only reuse of existing supplied-trust fixture and staging gate. These helpers
// serve broader storage tests; unused writer helpers are not new adapter production APIs.
#[path = "sqlite_durable/staging.rs"]
mod staging;
#[allow(dead_code)]
#[path = "sqlite_durable/support.rs"]
mod support;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[test]
fn fixture_reads_preserve_paging_content_permissions_and_private_boundary() {
    let root = staging::root(Path::new(env!("CHANGEKERNEL_SQLITE_STAGE")))
        .expect("required external controlled stage");
    let nonce = hex(&ids::candidate().expect("fixture nonce"));
    let register_path = root.join(format!("adapter-register-{nonce}"));
    let original_path = root.join(format!("adapter-original-{nonce}"));
    let identity = support::identity(71);
    let local = support::local(&identity, &register_path, &original_path, &root);
    local.0.lock().expect("fixture").context.version =
        ContextVersion::from_bytes([251; 16]).expect("private version");
    let initial = support::start(&local, &identity);
    let empty = ContentKey {
        establishing: identity.change_key(),
        id: ContentId::from_bytes([11; 16]).expect("content"),
    };
    support::source(&local, &empty, b"");
    let mut register = Register::bootstrap_new(
        &register_path,
        LedgerIdentity {
            owner: identity.owner.clone(),
            ledger: identity.ledger.clone(),
        },
        local.clone(),
        &root,
    )
    .expect("fixture register");
    let intent = CreationIntent::try_new(
        register.reference(),
        identity.clone(),
        original_path.clone(),
        initial,
    )
    .expect("fixture intent");
    let reference = match register
        .create(&intent, &mut local.clone())
        .expect("fixture creation")
    {
        CreationProgress::Ready { reference, .. } => *reference,
        _ => panic!("fixture did not reach Included"),
    };
    drop(register);
    let binary = ContentKey {
        establishing: identity.change_key(),
        id: ContentId::from_bytes([14; 16]).expect("binary key"),
    };
    support::source(&local, &binary, &[255, 0, 128]);
    let operation = OperationRequest {
        profile: CURRENT_PROFILE,
        target: identity.change_key(),
        actor: identity.owner_actor.clone(),
        represented_owner: identity.owner.clone(),
        operation: Operation {
            id: OperationId::from_bytes([13; 16]).expect("operation"),
            command: Command::Finding {
                finding: Finding {
                    agreement: None,
                    claim: binary.clone(),
                    evidence: vec![Evidence {
                        source: identity.owner_actor.clone(),
                        content: binary.clone(),
                        limitations: empty.clone(),
                    }],
                    disposition: Disposition::Unknown,
                },
                access: Access::Owner,
            },
            fresh: vec![],
            first_retention: BTreeSet::from([binary.clone()]),
        },
    };
    let mut original =
        Original::open(&reference, local.clone(), &root).expect("explicit fixture writer");
    original
        .submit(
            &PreparedOperationRequest::from_operation_request(&operation)
                .expect("prepared fixture"),
        )
        .expect("fixture contribution");
    original.close().expect("quiescent fixture");
    let before = support::native_snapshot(&original_path);
    let register_before = support::native_snapshot(&register_path);
    let key = json!({"owner":hex(identity.owner.as_bytes()),"ledger":hex(identity.ledger.as_bytes()),"change":hex(identity.change.as_bytes())});
    let limits = json!({"scanned_records":1,"returned_records":1,"reply_bytes":131072});
    let call = |request: &Value| {
        read_adapter::read_fixture(
            &reference,
            &mut local.clone(),
            &root,
            &serde_json::to_vec(request).expect("request JSON"),
            ReadWorkLimits::default(),
        )
    };
    let beginning =
        call(&json!({"ResolveChangeCursor":{"change":key,"anchor":"Beginning","limits":limits}}))
            .expect("resolve beginning");
    let current =
        call(&json!({"ResolveChangeCursor":{"change":key,"anchor":"Current","limits":limits}}))
            .expect("resolve current");
    assert_eq!(beginning["Returned"]["Position"]["sequence"], "0");
    assert_eq!(current["Returned"]["Position"]["sequence"], "2");
    let range = json!({"after":beginning["Returned"]["Position"],"through":current["Returned"]["Position"]});
    let mut request = json!({"ReadChange":{"change":key,"range":range,"selection":"AllRecords","page_cursor":null,"limits":limits}});
    let first = call(&request).expect("first page");
    let first_page = &first["Returned"]["Change"];
    assert_eq!(first_page["records"].as_array().expect("records").len(), 1);
    assert_eq!(first_page["scanned"]["through"]["sequence"], "1");
    assert!(first_page["records"][0]["command"]
        .get("Initiate")
        .is_some());
    let empty_membership = first_page["records"][0]["memberships"][0]["reference"].clone();
    request["ReadChange"]["page_cursor"] =
        first_page["progress"]["More"]["next_page_cursor"].clone();
    let second = call(&request).expect("explicit next call");
    let second_page = &second["Returned"]["Change"];
    assert_eq!(second_page["scanned"]["after"]["sequence"], "1");
    assert_eq!(second_page["scanned"]["through"]["sequence"], "2");
    assert_eq!(second_page["progress"], "EndOfRange");
    assert!(second_page["records"][0]["command"]
        .get("Finding")
        .is_some());
    let binary_key = json!({"establishing":key,"id":hex(binary.id.as_bytes())});
    let binary_membership = second_page["records"][0]["memberships"]
        .as_array()
        .expect("memberships")
        .iter()
        .find(|membership| membership["reference"]["content"] == binary_key)
        .expect("binary qualified Content membership")["reference"]
        .clone();
    let content_request =
        |membership: &Value| json!({"ReadContent":{"membership":membership,"limits":limits}});
    assert_eq!(
        call(&content_request(&empty_membership)),
        Ok(json!({"Returned":{"Content":{"encoding":"utf8","data":""}}}))
    );
    assert_eq!(
        call(&content_request(&binary_membership)),
        Ok(json!({"Returned":{"Content":{"encoding":"hex","data":"ff0080"}}}))
    );
    for result in [&beginning, &current, &first, &second] {
        let text = serde_json::to_string(result).expect("public result");
        assert!(
            !text.contains(&hex(&[251; 16])),
            "private ContextVersion must not leak"
        );
        assert!(!text.contains(original_path.to_str().expect("fixture path")));
        assert!(!text.contains(register_path.to_str().expect("fixture path")));
        assert!(!text.contains("owner_control"));
    }
    local.0.lock().expect("fixture").history = false;
    assert_eq!(call(&request), Ok(json!({"Refused":"Denied"})));
    assert!(call(&content_request(&empty_membership))
        .expect("independent permission")
        .get("Returned")
        .is_some());
    local.0.lock().expect("fixture").retained_content = false;
    assert_eq!(
        call(&content_request(&binary_membership)),
        Ok(json!({"Refused":"Denied"}))
    );
    {
        let mut inputs = local.0.lock().expect("fixture");
        inputs.history = true;
        inputs.context.authority.actor = identity.agent.clone();
        inputs.context.authority.owner_control = None;
        inputs.context.authority.agent_role = Some(identity.clone());
    }
    assert_eq!(
        call(&request),
        Ok(json!({"Refused":"Denied"})),
        "fixture agent role is not owner authority"
    );
    let locks = local.0.lock().expect("fixture").locks;
    assert_eq!(
        read_adapter::read_fixture(
            &reference,
            &mut local.clone(),
            &root,
            b"{}",
            ReadWorkLimits::default()
        ),
        Err(AdapterError::InvalidRequest)
    );
    assert_eq!(
        local.0.lock().expect("fixture").locks,
        locks,
        "bad JSON never reaches fixture boundary"
    );
    assert_eq!(
        support::native_snapshot(&original_path),
        before,
        "source remains unchanged"
    );
    assert_eq!(
        support::native_snapshot(&register_path),
        register_before,
        "register remains unchanged"
    );
}
