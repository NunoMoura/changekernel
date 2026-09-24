use changekernel::{Intake, Issue, Proposal, SqliteIntake};
use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};
fn path() -> PathBuf {
    let root = std::env::temp_dir().join(format!(
        "ck-kernel-{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir(&root).unwrap();
    root.join("store.db")
}
#[test]
fn exact_optional_unicode_bounds_and_trusted_actor() {
    let file = path();
    let mut intake = Intake::new(SqliteIntake::initialize(&file).unwrap());
    intake.create("  scope  ", "owner").unwrap();
    let mut p = Proposal {
        container_id: "  scope  ".into(),
        request_id: "request".into(),
        what: "  e\u{301}  ".into(),
        why: None,
    };
    let absent = intake.propose(&p, "owner").unwrap();
    assert_eq!(absent.what, p.what);
    assert_eq!(absent.why, None);
    p.why = Some(String::new());
    assert_eq!(intake.propose(&p, "owner"), Err(Issue::Conflict));
    p.request_id = "second".into();
    let empty = intake.propose(&p, "owner").unwrap();
    assert_eq!(empty.why.as_deref(), Some(""));
    assert_eq!(
        intake.read("  scope  ", &empty.change_id, "other"),
        Err(Issue::Denied)
    );
    intake.create("independent", "other").unwrap();
    let scoped = Proposal {
        container_id: "independent".into(),
        request_id: "second".into(),
        what: "other intent".into(),
        why: None,
    };
    let independent = intake.propose(&scoped, "other").unwrap();
    assert_ne!(independent.change_id, empty.change_id);
    assert_eq!(
        intake.read("independent", &independent.change_id, "owner"),
        Err(Issue::Denied)
    );
    assert_eq!(intake.propose(&p, "\n"), Err(Issue::Denied));
    for id in ["", " \t", "bad\n", &"x".repeat(257)] {
        let mut invalid = p.clone();
        invalid.request_id = id.into();
        assert_eq!(intake.propose(&invalid, "owner"), Err(Issue::InvalidInput));
    }
    p.request_id = "third".into();
    p.what = "x".repeat(65_536);
    assert!(intake.propose(&p, "owner").is_ok());
    p.what.push('x');
    assert_eq!(intake.propose(&p, "owner"), Err(Issue::InvalidInput));
    fs::remove_dir_all(file.parent().unwrap()).unwrap();
}
