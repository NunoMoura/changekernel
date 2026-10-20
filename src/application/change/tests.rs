use super::*;
use std::{cell::RefCell, collections::BTreeMap, rc::Rc};

fn request(op: &str, key: &str, expected: Option<Fact>) -> Request {
    Request {
        op: op.into(),
        key: Some(key.into()),
        expected,
        instruction: Some(Material::of(b"instruction")),
        replacement: Some(Intent {
            what: Material::of(b"what"),
            why: Some(Material::of(b"why")),
        }),
        text: None,
        at: None,
        through: None,
        after: None,
        limit: None,
        material: None,
    }
}
#[derive(Default)]
struct State {
    generation: u64,
    records: Vec<Record>,
    pending: Option<Pending>,
    temp: Option<Option<Pending>>,
    readiness: Vec<String>,
}
impl ReadState for State {
    fn records(&self) -> &[Record] {
        &self.records
    }
    fn generation(&self) -> u64 {
        self.generation
    }
    fn pending(&self) -> Option<&Pending> {
        self.pending.as_ref()
    }
    fn temporary_pending(&self) -> Option<&Option<Pending>> {
        self.temp.as_ref()
    }
    fn readiness(&self) -> &[String] {
        &self.readiness
    }
}
#[test]
fn pending_recovery_precedes_new_admission_but_not_blocked_material_or_tail() {
    let r = request("revise_intent", "same", Some(Fact::at(127)));
    let p = Pending {
        input: r.clone(),
        approval: Material::of(b"approval"),
    };
    let mut state = State {
        generation: 128,
        pending: Some(p.clone()),
        ..State::default()
    };
    assert_eq!(matching_pending(&state, &r), Ok(Some(p.clone())));
    let mut conflicting = r.clone();
    conflicting.expected = Some(Fact::at(128));
    assert_eq!(matching_pending(&state, &conflicting), Err(Error::Conflict));
    let other = request("open_intent", "different", None);
    assert_eq!(matching_pending(&state, &other), Err(Error::Unavailable));
    for blocked in ["blocked_material_temp", "blocked_unaccepted_tail"] {
        state.readiness = vec![blocked.into()];
        assert_eq!(
            matching_pending(&state, &conflicting),
            Err(Error::Unavailable)
        );
    }
    state.readiness.clear();
    state.pending = None;
    state.temp = Some(Some(p.clone()));
    assert_eq!(matching_pending(&state, &r), Ok(Some(p)));
    assert_eq!(matching_pending(&state, &conflicting), Err(Error::Conflict));
    assert_eq!(matching_pending(&state, &other), Err(Error::Unavailable));
    state.temp = Some(None);
    assert_eq!(
        matching_pending(&state, &conflicting),
        Err(Error::Unavailable)
    );
    state.temp = None;
    assert_eq!(matching_pending(&state, &r), Err(Error::Conflict));
    assert_eq!(
        matching_pending(&state, &conflicting),
        Err(Error::Unsupported)
    );
}

type Events = Rc<RefCell<Vec<String>>>;
struct MaterialPort {
    texts: BTreeMap<String, String>,
    events: Events,
}
impl Materials for MaterialPort {
    fn resolve(&self, material: &Material) -> Result<String> {
        let text = self.texts.get(&material.sha256).ok_or(Error::Unavailable)?;
        self.events.borrow_mut().push(format!("read:{text}"));
        Ok(text.clone())
    }
    fn policy(&self) -> Material {
        Material::of(POLICY.as_bytes())
    }
}
struct CodecPort {
    receipt: Receipt,
    events: Events,
}
impl Encoding for CodecPort {
    fn response(&self, _: u64, _: &Response) -> Result<Vec<u8>> {
        panic!("not used by grounds")
    }
    fn review(&self, _: &Review) -> Result<String> {
        self.events.borrow_mut().push("encode:review".into());
        Ok("review\n".into())
    }
    fn approval(&self, _: &str) -> Result<Receipt> {
        self.events.borrow_mut().push("decode:approval".into());
        Ok(self.receipt.clone())
    }
    fn receipt(&self, _: &Receipt) -> Result<String> {
        panic!("not used by grounds")
    }
    fn subject(&self, _: &Request) -> Result<String> {
        self.events.borrow_mut().push("encode:subject".into());
        Ok(hash(b"subject"))
    }
}
fn material_ports() -> (MaterialPort, CodecPort) {
    let events = Events::default();
    let texts = [
        "instruction",
        "what",
        "why",
        "old what",
        "old why",
        POLICY,
        "approval",
        "review\n",
    ]
    .into_iter()
    .map(|text| (Material::of(text.as_bytes()).sha256, text.into()))
    .collect();
    let store = MaterialPort {
        texts,
        events: events.clone(),
    };
    let codec = CodecPort {
        receipt: Receipt {
            format: "ck-local-approval".into(),
            principal: "person-1".into(),
            subject_sha256: hash(b"subject"),
            presentation: Material::of(b"review\n"),
            decision: "adopt".into(),
            ui: "local-tui-exact".into(),
        },
        events,
    };
    (store, codec)
}
#[test]
fn review_reads_current_sources_then_previous_sources_then_policy() {
    let (store, codec) = material_ports();
    let r = request("revise_intent", "next", Some(Fact::at(1)));
    let mut previous = request("open_intent", "first", None);
    previous.replacement = Some(Intent {
        what: Material::of(b"old what"),
        why: Some(Material::of(b"old why")),
    });
    let previous = Record {
        version: V.into(),
        custody: "custody-1".into(),
        seq: 1,
        prev: None,
        input: previous,
        approval: Material::of(b"approval"),
    };
    review::review(&store, &codec, &r, Some(&previous)).unwrap();
    assert_eq!(
        *store.events.borrow(),
        vec![
            "read:instruction".into(),
            "read:what".into(),
            "read:why".into(),
            "read:old what".into(),
            "read:old why".into(),
            format!("read:{POLICY}"),
            "encode:review".into(),
        ]
    );
    store.events.borrow_mut().clear();
    let mut too_large = r;
    too_large.replacement.as_mut().unwrap().what.bytes = 4097;
    assert_eq!(
        review::review(&store, &codec, &too_large, Some(&previous)),
        Err(Error::Unsupported)
    );
    assert_eq!(*store.events.borrow(), vec!["read:instruction"]);
}
#[test]
fn grounds_preserves_principal_subject_and_presentation_short_circuit_order() {
    let (store, mut codec) = material_ports();
    let r = request("open_intent", "first", None);
    let approval = Material::of(b"approval");
    codec.receipt.principal = "person-2".into();
    assert_eq!(
        review::grounds(&store, &codec, &r, &approval, None),
        Err(Error::Unavailable)
    );
    let before_subject = vec![
        "read:approval".into(),
        "decode:approval".into(),
        "read:instruction".into(),
        "read:what".into(),
        "read:why".into(),
        format!("read:{POLICY}"),
        "encode:review".into(),
    ];
    assert_eq!(*store.events.borrow(), before_subject);
    codec.receipt.principal = "person-1".into();
    codec.receipt.subject_sha256 = hash(b"wrong");
    store.events.borrow_mut().clear();
    assert_eq!(
        review::grounds(&store, &codec, &r, &approval, None),
        Err(Error::Unavailable)
    );
    let mut through_subject = before_subject;
    through_subject.push("encode:subject".into());
    assert_eq!(*store.events.borrow(), through_subject);
    codec.receipt.subject_sha256 = hash(b"subject");
    store.events.borrow_mut().clear();
    assert_eq!(review::grounds(&store, &codec, &r, &approval, None), Ok(()));
    through_subject.extend(["read:review\n".into(), "encode:review".into()]);
    assert_eq!(*store.events.borrow(), through_subject);
}
