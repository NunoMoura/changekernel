use changekernel::{
    observe_committed_source, GitSourceObserver, Intake, ObservationIssue as Issue, PathResult,
    SourceSelection, SqliteIntake,
};
use sha2::Digest;
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicUsize, Ordering},
    time::{Duration, Instant},
};

static NEXT: AtomicUsize = AtomicUsize::new(0);
struct Repo(PathBuf);
impl Repo {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "ck-observe-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).unwrap();
        git(&path, &["init", "-q"]);
        Self(path)
    }
    fn setup(&self) -> (Intake<SqliteIntake>, String) {
        let db = self.0.parent().unwrap().join(format!(
            "ck-observe-store-{}-{}.db",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        // Keep store outside observed repo. Fixture removes file via return? test process temp names unique.
        let mut intake = Intake::new(SqliteIntake::initialize(&db).unwrap());
        intake.create("c", "owner").unwrap();
        (intake, db.to_string_lossy().into_owned())
    }
    fn binding(&self, paths: &[&str]) -> GitSourceObserver {
        GitSourceObserver::new(
            "c".into(),
            "s".into(),
            self.0.clone(),
            PathBuf::from("/usr/bin/git"),
            paths.iter().map(|s| (*s).into()).collect(),
        )
        .unwrap()
    }
    fn commit(&self) -> String {
        git(&self.0, &["add", "-A"]);
        let output = Command::new("/usr/bin/git")
            .current_dir(&self.0)
            .args([
                "-c",
                "user.name=Test",
                "-c",
                "user.email=t@x",
                "commit",
                "-qm",
                "first",
            ])
            .output()
            .unwrap();
        assert!(output.status.success(), "{output:?}");
        String::from_utf8(git(&self.0, &["rev-parse", "HEAD"]))
            .unwrap()
            .trim()
            .into()
    }
}
impl Drop for Repo {
    fn drop(&mut self) {
        fs::remove_dir_all(&self.0).unwrap();
    }
}
fn git(root: &Path, args: &[&str]) -> Vec<u8> {
    let output = Command::new("/usr/bin/git")
        .current_dir(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{args:?}: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    output.stdout
}
fn selection(commit: &str, paths: &[&str]) -> SourceSelection {
    SourceSelection {
        container_id: "c".into(),
        source_id: "s".into(),
        commit: commit.into(),
        paths: paths.iter().map(|s| (*s).into()).collect(),
    }
}
fn snapshot(dir: &Path) -> Vec<(PathBuf, Vec<u8>)> {
    fn walk(dir: &Path, root: &Path, out: &mut Vec<(PathBuf, Vec<u8>)>) {
        for entry in fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            if entry.file_type().unwrap().is_dir() {
                walk(&entry.path(), root, out);
            } else {
                out.push((
                    entry.path().strip_prefix(root).unwrap().into(),
                    fs::read(entry.path()).unwrap(),
                ));
            }
        }
    }
    let mut data = Vec::new();
    walk(dir, dir, &mut data);
    data.sort_by(|a, b| a.0.cmp(&b.0));
    data
}
#[test]
fn exact_commit_scope_absence_and_no_effects() {
    let r = Repo::new();
    fs::write(r.0.join("binary"), [0, 255, 10]).unwrap();
    fs::write(r.0.join("é.txt"), "雪\n").unwrap();
    fs::write(r.0.join("run"), b"#!/bin/sh\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(r.0.join("run"), fs::Permissions::from_mode(0o755)).unwrap();
    }
    let commit = r.commit();
    let (intake, db) = r.setup();
    let binding = r.binding(&["binary", "é.txt", "run", "missing"]);
    fs::write(r.0.join("binary"), b"dirty").unwrap();
    fs::write(r.0.join("untracked"), b"private").unwrap();
    let before = snapshot(&r.0);
    let intake_before = fs::read(&db).unwrap();
    let result = observe_committed_source(
        &intake,
        &binding,
        &selection(&commit, &["missing", "binary", "é.txt", "run"]),
        "owner",
    )
    .unwrap();
    assert_eq!(result.commit, commit);
    assert_eq!(result.paths[0].1, PathResult::Absent);
    let PathResult::Present(binary) = &result.paths[1].1 else {
        panic!()
    };
    assert_eq!(binary.bytes, [0, 255, 10]);
    assert_eq!(
        binary.fingerprint,
        format!("sha256@1:{:x}", sha2::Sha256::digest(&binary.bytes))
    );
    assert_eq!(
        binary.object_id,
        String::from_utf8(git(&r.0, &["rev-parse", &format!("{commit}:binary")]))
            .unwrap()
            .trim()
    );
    assert!(!binary.executable);
    let PathResult::Present(unicode) = &result.paths[2].1 else {
        panic!()
    };
    assert_eq!(unicode.bytes, "雪\n".as_bytes());
    let PathResult::Present(run) = &result.paths[3].1 else {
        panic!()
    };
    assert!(run.executable);
    assert_eq!(
        before,
        snapshot(&r.0),
        "read changed repository files/refs/index/config"
    );
    assert_eq!(
        intake_before,
        fs::read(&db).unwrap(),
        "read changed intake storage"
    );
    fs::remove_file(db).unwrap();
}
#[test]
fn scope_and_unsupported_entries_fail_closed() {
    let r = Repo::new();
    fs::create_dir(r.0.join("dir")).unwrap();
    fs::write(r.0.join("dir/file"), b"ok").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink("dir/file", r.0.join("link")).unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let binding = r.binding(&["dir/file", "dir/missing", "link", "link/child"]);
    for path in [
        "../dir/file",
        "/dir/file",
        "dir//file",
        "dir/./file",
        "dir/../file",
        "dir\\file",
        ".git/config",
    ] {
        let request = selection(&commit, &[path]);
        assert!(matches!(
            observe_committed_source(&intake, &binding, &request, "owner"),
            Err(Issue::InvalidInput)
        ));
    }
    let duplicate = selection(&commit, &["dir/file", "dir/file"]);
    assert_eq!(
        observe_committed_source(&intake, &binding, &duplicate, "owner"),
        Err(Issue::InvalidInput)
    );
    assert_eq!(
        observe_committed_source(
            &intake,
            &binding,
            &selection(&commit, &["dir/file"]),
            "other"
        ),
        Err(Issue::Denied)
    );
    let mut wrong = selection(&commit, &["dir/file"]);
    wrong.source_id = "other".into();
    assert_eq!(
        observe_committed_source(&intake, &binding, &wrong, "owner"),
        Err(Issue::Denied)
    );
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["link"]), "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(
        observe_committed_source(
            &intake,
            &binding,
            &selection(&commit, &["link/child"]),
            "owner"
        ),
        Err(Issue::Unavailable)
    );
    assert_eq!(
        observe_committed_source(
            &intake,
            &binding,
            &selection(&commit, &["dir/file", "link"]),
            "owner"
        ),
        Err(Issue::Unavailable)
    );
    fs::remove_file(db).unwrap();
}
#[test]
fn missing_objects_hostile_config_limits_and_child_failure() {
    let r = Repo::new();
    fs::write(r.0.join("big"), vec![42; 1_048_577]).unwrap();
    fs::write(r.0.join("small"), b"yes").unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let binding = r.binding(&["big", "small"]);
    assert_eq!(
        observe_committed_source(
            &intake,
            &binding,
            &selection(&commit, &["small", "big"]),
            "owner"
        ),
        Err(Issue::Unavailable)
    );
    fs::write(
        r.0.join(".git/config"),
        format!(
            "{}\n[include]\n path = /tmp/evil",
            fs::read_to_string(r.0.join(".git/config")).unwrap()
        ),
    )
    .unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["small"]), "owner"),
        Err(Issue::Unavailable)
    );
    git(&r.0, &["config", "--local", "--remove-section", "include"]);
    let oid = String::from_utf8(git(&r.0, &["rev-parse", &format!("{commit}:small")]))
        .unwrap()
        .trim()
        .to_string();
    let object = r.0.join(".git/objects").join(&oid[..2]).join(&oid[2..]);
    fs::remove_file(&object).unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["small"]), "owner"),
        Err(Issue::Unavailable)
    );
    fs::write(object, b"not a Git object").unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["small"]), "owner"),
        Err(Issue::Unavailable)
    );
    fs::remove_file(db).unwrap();
}
#[test]
fn total_byte_bound_and_submodule_are_unavailable() {
    let r = Repo::new();
    let names: Vec<String> = (0..9).map(|n| format!("chunk{n}")).collect();
    for name in &names {
        fs::write(r.0.join(name), vec![b'x'; 1_048_576]).unwrap();
    }
    let commit = r.commit();
    let (intake, db) = r.setup();
    let paths: Vec<&str> = names.iter().map(String::as_str).collect();
    let binding = r.binding(&paths);
    let before = snapshot(&r.0);
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &paths), "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(before, snapshot(&r.0));
    // A gitlink is not a missing ordinary file.
    git(
        &r.0,
        &[
            "update-index",
            "--add",
            "--cacheinfo",
            &format!("160000,{commit},module"),
        ],
    );
    let output = Command::new("/usr/bin/git")
        .current_dir(&r.0)
        .args([
            "-c",
            "user.name=Test",
            "-c",
            "user.email=t@x",
            "commit",
            "-qm",
            "gitlink",
        ])
        .output()
        .unwrap();
    assert!(output.status.success(), "{output:?}");
    let linked = String::from_utf8(git(&r.0, &["rev-parse", "HEAD"])).unwrap();
    assert_eq!(
        observe_committed_source(
            &intake,
            &r.binding(&["module"]),
            &selection(linked.trim(), &["module"]),
            "owner"
        ),
        Err(Issue::Unavailable)
    );
    fs::remove_file(db).unwrap();
}

#[test]
fn linked_worktree_indirection_is_unavailable() {
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let linked = r.0.parent().unwrap().join(format!(
        "ck-linked-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    git(
        &r.0,
        &[
            "worktree",
            "add",
            "--detach",
            linked.to_str().unwrap(),
            &commit,
        ],
    );
    let binding = GitSourceObserver::new(
        "c".into(),
        "s".into(),
        linked.clone(),
        PathBuf::from("/usr/bin/git"),
        vec!["file".into()],
    )
    .unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["file"]), "owner"),
        Err(Issue::Unavailable)
    );
    git(
        &r.0,
        &["worktree", "remove", "--force", linked.to_str().unwrap()],
    );
    fs::remove_file(db).unwrap();
}

#[cfg(unix)]
#[test]
fn child_timeout_and_output_overflow_are_unavailable() {
    use std::os::unix::fs::PermissionsExt;
    use std::sync::{atomic::AtomicBool, Arc};
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let script = r.0.parent().unwrap().join(format!(
        "ck-git-script-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&script, b"#!/bin/sh\nsleep 30 &\nwait\n").unwrap();
    fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
    let bind = || {
        GitSourceObserver::new(
            "c".into(),
            "s".into(),
            r.0.clone(),
            script.clone(),
            vec!["file".into()],
        )
        .unwrap()
    };
    let start = Instant::now();
    assert_eq!(
        observe_committed_source(&intake, &bind(), &selection(&commit, &["file"]), "owner"),
        Err(Issue::Unavailable)
    );
    assert!(start.elapsed() < Duration::from_secs(12));
    let flag = Arc::new(AtomicBool::new(false));
    let cancel = Arc::clone(&flag);
    let timer = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(80));
        cancel.store(true, Ordering::Relaxed);
    });
    let start = Instant::now();
    assert_eq!(
        observe_committed_source(
            &intake,
            &bind().with_cancellation(flag),
            &selection(&commit, &["file"]),
            "owner"
        ),
        Err(Issue::Unavailable)
    );
    timer.join().unwrap();
    assert!(start.elapsed() < Duration::from_secs(2));
    fs::write(
        &script,
        b"#!/bin/sh\nwhile :; do printf '012345678901234567890123456789'; done\n",
    )
    .unwrap();
    let start = Instant::now();
    assert_eq!(
        observe_committed_source(&intake, &bind(), &selection(&commit, &["file"]), "owner"),
        Err(Issue::Unavailable)
    );
    assert!(start.elapsed() < Duration::from_secs(12));
    fs::remove_file(script).unwrap();
    fs::remove_file(db).unwrap();
}

#[test]
fn unsupported_repository_forms_and_bounded_selection() {
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let binding = r.binding(&["file"]);
    assert_eq!(
        observe_committed_source(
            &intake,
            &binding,
            &selection(&commit, &["not-allowed"]),
            "owner"
        ),
        Err(Issue::InvalidInput)
    );
    let too_many = selection(&commit, &vec!["file"; 65]);
    assert_eq!(
        observe_committed_source(&intake, &binding, &too_many, "owner"),
        Err(Issue::InvalidInput)
    );
    fs::write(r.0.join(".git/objects/info/alternates"), b"/tmp/foreign\n").unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["file"]), "owner"),
        Err(Issue::Unavailable)
    );
    fs::remove_file(r.0.join(".git/objects/info/alternates")).unwrap();
    fs::write(r.0.join(".git/objects/pack/test.promisor"), b"").unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["file"]), "owner"),
        Err(Issue::Unavailable)
    );
    fs::remove_file(db).unwrap();
}

#[test]
fn readable_objects_must_match_the_selected_chain() {
    let r = Repo::new();
    fs::create_dir(r.0.join("dir")).unwrap();
    fs::write(r.0.join("dir/file"), b"good").unwrap();
    let commit = r.commit();
    fs::write(r.0.join("dir/file"), b"evil").unwrap();
    fs::rename(r.0.join("dir/file"), r.0.join("dir/gone")).unwrap();
    let next = r.commit();
    let (intake, db) = r.setup();
    let binding = r.binding(&["dir/file", "dir/missing"]);
    let request = selection(&commit, &["dir/file", "dir/missing"]);
    let oid = |revision: &str| {
        String::from_utf8(git(&r.0, &["rev-parse", revision]))
            .unwrap()
            .trim()
            .to_string()
    };
    let object = |id: &str| r.0.join(".git/objects").join(&id[..2]).join(&id[2..]);
    for (kind, old, new) in [
        ("commit", commit.clone(), next.clone()),
        (
            "root tree",
            oid(&format!("{commit}^{{tree}}")),
            oid(&format!("{next}^{{tree}}")),
        ),
        (
            "nested tree",
            oid(&format!("{commit}:dir")),
            oid(&format!("{next}:dir")),
        ),
        (
            "blob",
            oid(&format!("{commit}:dir/file")),
            oid(&format!("{next}:dir/gone")),
        ),
    ] {
        let path = object(&old);
        let original = fs::read(&path).unwrap();
        fs::remove_file(&path).unwrap();
        // A well-formed, readable object under a different object's identity.
        fs::copy(object(&new), &path).unwrap();
        let before = snapshot(&r.0);
        let result = observe_committed_source(&intake, &binding, &request, "owner");
        let after = snapshot(&r.0);
        fs::remove_file(&path).unwrap();
        fs::write(&path, original).unwrap();
        assert_eq!(result, Err(Issue::Unavailable), "{kind} mismatch");
        assert_eq!(
            before, after,
            "verification must not repair or write objects"
        );
    }
    // Verification must also work for ordinary packed objects, not just loose files.
    git(&r.0, &["gc", "--prune=now"]);
    let result = observe_committed_source(&intake, &binding, &request, "owner").unwrap();
    let PathResult::Present(file) = &result.paths[0].1 else {
        panic!()
    };
    assert_eq!(file.bytes, b"good");
    assert_eq!(result.paths[1].1, PathResult::Absent);
    fs::remove_file(db).unwrap();
}

#[test]
fn store_unavailability_is_not_authorization_denial() {
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let binding = r.binding(&["file"]);
    let request = selection(&commit, &["file"]);
    let lock = rusqlite::Connection::open(&db).unwrap();
    lock.execute_batch("BEGIN EXCLUSIVE").unwrap();
    assert_eq!(
        intake.open("c", "owner"),
        Err(changekernel::Issue::Unavailable)
    );
    let result = observe_committed_source(&intake, &binding, &request, "owner");
    lock.execute_batch("ROLLBACK").unwrap();
    assert_eq!(result, Err(Issue::Unavailable));
    assert_eq!(
        observe_committed_source(&intake, &binding, &request, "other"),
        Err(Issue::Denied)
    );
    assert!(observe_committed_source(&intake, &binding, &request, "owner").is_ok());
    fs::remove_file(db).unwrap();
}

#[cfg(target_os = "linux")]
#[test]
fn exited_child_does_not_leave_closed_stream_descendants_running() {
    use std::os::unix::fs::PermissionsExt;
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let (intake, db) = r.setup();
    let script = r.0.join("git-fixture");
    let pidfile = r.0.join("descendant.pid");
    for code in [0, 1] {
        fs::write(&script, format!(
            "#!/bin/sh\n/usr/bin/sleep 30 </dev/null >/dev/null 2>&1 &\nprintf '%s' \"$!\" > '{}'\nexit {code}\n",
            pidfile.display()
        )).unwrap();
        fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
        let binding = GitSourceObserver::new(
            "c".into(),
            "s".into(),
            r.0.clone(),
            script.clone(),
            vec!["file".into()],
        )
        .unwrap();
        let result =
            observe_committed_source(&intake, &binding, &selection(&commit, &["file"]), "owner");
        let pid = fs::read_to_string(&pidfile).unwrap();
        let running = fs::read_to_string(format!("/proc/{pid}/stat")).is_ok_and(|stat| {
            let state = stat
                .rsplit_once(')')
                .unwrap()
                .1
                .trim_start()
                .chars()
                .next()
                .unwrap();
            state != 'Z' && state != 'X'
        });
        // Clean up even if this regression fails on an older implementation.
        if running {
            Command::new("/usr/bin/kill")
                .args(["-KILL", &pid])
                .status()
                .unwrap();
        }
        assert_eq!(result, Err(Issue::Unavailable));
        assert!(!running, "child exit {code} leaked descendant {pid}");
    }
    fs::remove_file(db).unwrap();
}
