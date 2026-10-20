use super::*;

pub(crate) fn request(op: &str, key: &str, expected: Option<Fact>) -> Request {
    Request {
        op: op.into(),
        key: Some(key.into()),
        expected,
        instruction: Some(Material::of(b"instruction")),
        replacement: Some(Intent {
            what: Material::of(b"what"),
            why: None,
        }),
        text: None,
        at: None,
        through: None,
        after: None,
        limit: None,
        material: None,
    }
}
fn pending(input: Request) -> Pending {
    Pending {
        input,
        approval: Material::of(b"approval"),
    }
}

#[test]
fn legal_progression_requires_open_then_exact_previous_fact_and_unique_keys() {
    let open = pending(request("open_intent", "first", None));
    let first = prospective(&open, &[]).unwrap();
    assert_eq!(first.seq, 1);
    assert_eq!(first.prev, None);
    assert_eq!(first.input, open.input);
    assert_eq!(first.approval, open.approval);
    let revision = pending(request("revise_intent", "second", Some(Fact::at(1))));
    let second = prospective(&revision, std::slice::from_ref(&first)).unwrap();
    assert_eq!(second.seq, 2);
    assert_eq!(second.prev, Some(Fact::at(1)));
    assert_eq!(second.outcome().kind, "intent_revised");
    for invalid in [
        revision.clone(),
        pending(request("read_context", "read", None)),
    ] {
        assert_eq!(prospective(&invalid, &[]), Err(Error::Unavailable));
    }
    for invalid in [
        open,
        pending(request("revise_intent", "first", Some(Fact::at(1)))),
        pending(request("revise_intent", "new", None)),
        pending(request("revise_intent", "new", Some(Fact::at(2)))),
    ] {
        assert_eq!(
            prospective(&invalid, std::slice::from_ref(&first)),
            Err(Error::Unavailable)
        );
    }
}

#[test]
fn progression_limit_and_admission_error_precedence_remain_legacy() {
    let mut records = vec![];
    for n in 1..=128 {
        let input = request(
            if n == 1 {
                "open_intent"
            } else {
                "revise_intent"
            },
            &format!("key-{n}"),
            (n > 1).then(|| Fact::at(n - 1)),
        );
        records.push(prospective(&pending(input), &records).unwrap());
    }
    let next = request("revise_intent", "overflow", Some(Fact::at(128)));
    assert_eq!(
        prospective(&pending(next.clone()), &records),
        Err(Error::Unavailable)
    );
    assert_eq!(
        admit_new(&next, 128, Some(Fact::at(128))),
        Err(Error::Unsupported)
    );
    let stale = request("revise_intent", "stale", Some(Fact::at(127)));
    assert_eq!(
        admit_new(&stale, 128, Some(Fact::at(128))),
        Err(Error::Conflict)
    );
    assert_eq!(admit_new(&stale, 0, None), Err(Error::Conflict));
    assert_eq!(
        admit_new(&request("open_intent", "again", None), 1, Some(Fact::at(1))),
        Err(Error::Unsupported)
    );
}

#[test]
fn exact_input_binds_material_presence_and_all_input_fields() {
    let original = request("revise_intent", "key", Some(Fact::at(1)));
    assert_eq!(exact_input(&original, &original.clone()), Ok(()));
    let mut changed = original.clone();
    changed.replacement.as_mut().unwrap().why = Some(Material::of(b""));
    assert_eq!(exact_input(&original, &changed), Err(Error::Conflict));
    changed = original.clone();
    changed.instruction = Some(Material::of(b"instruction\n"));
    assert_eq!(exact_input(&original, &changed), Err(Error::Conflict));
    changed = original.clone();
    changed.expected = Some(Fact::at(2));
    assert_eq!(exact_input(&original, &changed), Err(Error::Conflict));
}

#[test]
fn exact_approval_requires_fixed_principal_subject_decision_ui_and_presentation() {
    let receipt = Receipt {
        format: "ck-local-approval".into(),
        principal: "person-1".into(),
        subject_sha256: hash(b"exact input"),
        presentation: Material::of(b"review\n"),
        decision: "adopt".into(),
        ui: "local-tui-exact".into(),
    };
    assert_eq!(approval_principal(&receipt), Ok(()));
    assert_eq!(approval_subject(&receipt, &hash(b"exact input")), Ok(()));
    assert_eq!(
        approval_subject(&receipt, &hash(b"exact input\n")),
        Err(Error::Unavailable)
    );
    for field in ["format", "principal", "decision", "ui"] {
        let mut changed = receipt.clone();
        match field {
            "format" => changed.format = "foreign".into(),
            "principal" => changed.principal = "person-2".into(),
            "decision" => changed.decision = "reject".into(),
            _ => changed.ui = "other".into(),
        }
        assert!(approval_principal(&changed)
            .and_then(|()| approval_subject(&changed, &receipt.subject_sha256))
            .is_err());
    }
    assert_eq!(exact_presentation("review\n", "review\n"), Ok(()));
    assert_eq!(
        exact_presentation("review\n", "review"),
        Err(Error::Unavailable)
    );
}

#[test]
fn review_source_policy_does_not_normalize_text_or_expand_legacy_whitespace() {
    assert_eq!(review_sources("", "what"), Err(Error::Invalid));
    assert_eq!(
        review_sources("instruction", " \t\r\n"),
        Err(Error::Invalid)
    );
    assert_eq!(review_sources(" ", "\u{a0}"), Ok(()));
}

#[test]
fn historical_review_binds_named_predecessor_without_new_admission() {
    let old = request("revise_intent", "old", Some(Fact::at(1)));
    assert_eq!(
        historical_review_subject(&old, Some(&Fact::at(1))),
        Ok(Some(Fact::at(1)))
    );
    assert_eq!(
        historical_review_subject(&old, Some(&Fact::at(2))),
        Err(Error::Unavailable)
    );
    assert_eq!(
        historical_review_subject(&old, None),
        Err(Error::Unavailable)
    );
    let open = request("open_intent", "first", None);
    assert_eq!(historical_review_subject(&open, None), Ok(None));
    assert_eq!(
        historical_review_subject(&open, Some(&Fact::at(1))),
        Err(Error::Unavailable)
    );
    assert_eq!(admit_new(&old, 2, Some(Fact::at(2))), Err(Error::Conflict));
}
