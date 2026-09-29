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
struct Repo(PathBuf, std::cell::RefCell<Vec<PathBuf>>);

struct Linked {
    worktree: PathBuf,
    private: PathBuf,
    common: PathBuf,
}
impl Linked {
    fn binding(&self, git: PathBuf, paths: &[&str]) -> GitSourceObserver {
        GitSourceObserver::new_linked(
            "c".into(),
            "s".into(),
            self.worktree.clone(),
            self.private.clone(),
            self.common.clone(),
            git,
            paths.iter().map(|p| (*p).into()).collect(),
        )
        .unwrap()
    }
}
impl Drop for Linked {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.worktree);
    }
}
impl Repo {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "ck-observe-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&path).unwrap();
        git(&path, &["init", "-q"]);
        Self(path, std::cell::RefCell::new(Vec::new()))
    }
    fn linked(&self, commit: &str) -> Linked {
        let name = format!(
            "ck-linked-{}-{}-雪",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        );
        let worktree = self.0.parent().unwrap().join(format!("{name} space"));
        let common = self.0.join(".git");
        let linked = Linked {
            // Git's fixture registration replaces the space; no pointer discovers this binding.
            private: common.join("worktrees").join(format!("{name}-space")),
            worktree,
            common,
        };
        git(
            &self.0,
            &[
                "worktree",
                "add",
                "--detach",
                linked.worktree.to_str().unwrap(),
                commit,
            ],
        );
        linked
    }
    fn setup(&self) -> (Intake<SqliteIntake>, String) {
        let db = self.0.parent().unwrap().join(format!(
            "ck-observe-store-{}-{}.db",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        // Keep storage outside the observed source and clean it even on a failed assertion.
        self.1.borrow_mut().push(db.clone());
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
        let _ = fs::remove_dir_all(&self.0);
        for path in self.1.get_mut() {
            let _ = fs::remove_file(&*path);
            for suffix in ["-journal", "-wal", "-shm"] {
                let _ = fs::remove_file(format!("{}{suffix}", path.display()));
            }
        }
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
#[derive(Debug, PartialEq, Eq)]
enum SnapshotEntry {
    Directory,
    File(Vec<u8>),
    Symlink(PathBuf),
    Special,
}
fn snapshot(dir: &Path) -> Vec<(PathBuf, SnapshotEntry)> {
    fn walk(dir: &Path, root: &Path, out: &mut Vec<(PathBuf, SnapshotEntry)>) {
        for entry in fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let kind = entry.file_type().unwrap();
            let value = if kind.is_dir() {
                walk(&entry.path(), root, out);
                SnapshotEntry::Directory
            } else if kind.is_symlink() {
                SnapshotEntry::Symlink(fs::read_link(entry.path()).unwrap())
            } else if kind.is_file() {
                SnapshotEntry::File(fs::read(entry.path()).unwrap())
            } else {
                SnapshotEntry::Special
            };
            out.push((entry.path().strip_prefix(root).unwrap().into(), value));
        }
    }
    let mut data = Vec::new();
    walk(dir, dir, &mut data);
    data.sort_by(|a, b| a.0.cmp(&b.0));
    data
}
fn passive_developer_config(path: &Path) {
    let mut config = fs::read_to_string(path).unwrap();
    config.push_str(
        "\n# Passive developer metadata\n; No helpers\n[user]\n name = \"Developer 雪\"\n email = dev@example.test\n[remote \"origin\"]\n url = https://example.test/repository.git\n fetch = +refs/heads/*:refs/remotes/origin/*\n[branch \"main\"]\n remote = origin\n merge = refs/heads/main\n vscode-merge-base = origin/main\n",
    );
    fs::write(path, config).unwrap();
}

fn unavailable_unchanged(
    r: &Repo,
    linked: Option<&Linked>,
    intake: &Intake<SqliteIntake>,
    binding: &GitSourceObserver,
    request: &SourceSelection,
    db: &str,
) {
    let before = snapshot(&r.0);
    let linked_before = linked.map(|l| snapshot(&l.worktree));
    let store_before = fs::read(db).unwrap();
    assert_eq!(
        observe_committed_source(intake, binding, request, "owner"),
        Err(Issue::Unavailable)
    );
    assert_eq!(before, snapshot(&r.0), "observer mutated source/controls");
    assert_eq!(linked_before, linked.map(|l| snapshot(&l.worktree)));
    assert_eq!(store_before, fs::read(db).unwrap());
}

#[cfg(unix)]
fn forbidden_git(r: &Repo) -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let script = r.0.join("forbidden-git");
    fs::write(
        &script,
        format!(
            "#!/bin/sh\n/usr/bin/touch '{}'\nexit 1\n",
            r.0.join("git-was-run").display()
        ),
    )
    .unwrap();
    fs::set_permissions(&script, fs::Permissions::from_mode(0o755)).unwrap();
    script
}

#[cfg(unix)]
fn malformed_controls(path: &Path, check: impl Fn()) {
    let original = fs::read(path).unwrap();
    for bytes in [
        b"gitdir: /uninstalled\n".to_vec(),
        b"/uninstalled/.git\n".to_vec(),
        b"../../foreign\n".to_vec(),
        original.strip_suffix(b"\n").unwrap().to_vec(),
        [original.as_slice(), b"extra\n"].concat(),
        vec![b'x'; 8193],
    ] {
        fs::write(path, bytes).unwrap();
        check();
    }
    fs::remove_file(path).unwrap();
    check();
    fs::create_dir(path).unwrap();
    check();
    fs::remove_dir(path).unwrap();
    let target = path.with_extension("saved-control");
    fs::write(&target, &original).unwrap();
    std::os::unix::fs::symlink(&target, path).unwrap();
    check();
    fs::remove_file(path).unwrap();
    fs::remove_file(target).unwrap();
    assert!(Command::new("/usr/bin/mkfifo")
        .arg(path)
        .status()
        .unwrap()
        .success());
    check();
    fs::remove_file(path).unwrap();
    fs::write(path, original).unwrap();
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
    passive_developer_config(&r.0.join(".git/config"));
    fs::write(r.0.join("binary"), b"new HEAD").unwrap();
    r.commit();
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
    let linked = r.linked(&commit);
    let binding = GitSourceObserver::new(
        "c".into(),
        "s".into(),
        linked.worktree.clone(),
        PathBuf::from("/usr/bin/git"),
        vec!["file".into()],
    )
    .unwrap();
    assert_eq!(
        observe_committed_source(&intake, &binding, &selection(&commit, &["file"]), "owner"),
        Err(Issue::Unavailable)
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
    let script = r.0.join("git-fixture");
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

#[test]
fn installed_linked_source_captures_old_commit_without_effects() {
    let r = Repo::new();
    fs::write(r.0.join("binary"), [0, 255, 10]).unwrap();
    fs::write(r.0.join("é.txt"), "雪\n").unwrap();
    let commit = r.commit();
    let linked = r.linked(&commit);
    passive_developer_config(&linked.common.join("config"));
    let (intake, db) = r.setup();
    let binding = linked.binding(
        PathBuf::from("/usr/bin/git"),
        &["binary", "é.txt", "missing"],
    );
    fs::write(r.0.join("binary"), b"new HEAD").unwrap();
    let next = r.commit();
    git(&linked.worktree, &["reset", "--hard", &next]);
    fs::write(linked.worktree.join("binary"), b"dirty").unwrap();
    fs::write(linked.worktree.join("untracked"), b"private").unwrap();
    let before = snapshot(&r.0);
    let linked_before = snapshot(&linked.worktree);
    let store_before = fs::read(&db).unwrap();
    let request = selection(&commit, &["missing", "é.txt", "binary"]);
    let result = observe_committed_source(&intake, &binding, &request, "owner").unwrap();
    assert_eq!(result.container_id, "c");
    assert_eq!(result.source_id, "s");
    assert_eq!(result.commit, commit);
    assert_eq!(result.paths[0], ("missing".into(), PathResult::Absent));
    for (index, name, bytes) in [
        (1, "é.txt", "雪\n".as_bytes()),
        (2, "binary", &[0, 255, 10]),
    ] {
        assert_eq!(result.paths[index].0, name);
        let PathResult::Present(file) = &result.paths[index].1 else {
            panic!()
        };
        assert_eq!(file.bytes, bytes);
        assert_eq!(
            file.fingerprint,
            format!("sha256@1:{:x}", sha2::Sha256::digest(bytes))
        );
        assert_eq!(
            file.object_id,
            String::from_utf8(git(&r.0, &["rev-parse", &format!("{commit}:{name}")]))
                .unwrap()
                .trim()
        );
    }
    assert_eq!(
        observe_committed_source(&intake, &binding, &request, "other"),
        Err(Issue::Denied)
    );
    for field in ["container", "source"] {
        let mut wrong = request.clone();
        if field == "container" {
            wrong.container_id = "other".into();
        } else {
            wrong.source_id = "other".into();
        }
        assert_eq!(
            observe_committed_source(&intake, &binding, &wrong, "owner"),
            Err(Issue::Denied)
        );
    }
    assert_eq!(
        observe_committed_source(
            &intake,
            &binding,
            &selection(&commit, &["not-allowed"]),
            "owner"
        ),
        Err(Issue::InvalidInput)
    );
    assert_eq!(before, snapshot(&r.0));
    assert_eq!(linked_before, snapshot(&linked.worktree));
    assert_eq!(store_before, fs::read(&db).unwrap());
}

#[cfg(unix)]
#[test]
fn linked_controls_and_installed_directories_are_revalidated_before_git() {
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let linked = r.linked(&commit);
    let (intake, db) = r.setup();
    let script = forbidden_git(&r);
    let binding = linked.binding(script.clone(), &["file"]);
    let request = selection(&commit, &["file"]);
    for path in [
        linked.worktree.join(".git"),
        linked.private.join("gitdir"),
        linked.private.join("commondir"),
    ] {
        malformed_controls(&path, || {
            unavailable_unchanged(&r, Some(&linked), &intake, &binding, &request, &db)
        });
    }
    assert!(!r.0.join("git-was-run").exists());
    let other = Repo::new();
    for (worktree, private, common) in [
        (r.0.clone(), linked.private.clone(), linked.common.clone()),
        (
            linked.worktree.clone(),
            linked.common.clone(),
            linked.common.clone(),
        ),
        (
            linked.worktree.clone(),
            linked.private.clone(),
            other.0.join(".git"),
        ),
    ] {
        assert!(matches!(
            GitSourceObserver::new_linked(
                "c".into(),
                "s".into(),
                worktree,
                private,
                common,
                script.clone(),
                vec!["file".into()]
            ),
            Err(Issue::Unavailable)
        ));
    }
    // Components() normalizes some spelling; reject those forms before touching the topology.
    for worktree in [
        PathBuf::from(format!("{}/.", linked.worktree.display())),
        PathBuf::from(format!(
            "{}/../{}",
            linked.worktree.display(),
            linked.worktree.file_name().unwrap().to_str().unwrap()
        )),
        PathBuf::from(format!("{}//", linked.worktree.display())),
        PathBuf::from(format!("{}/bad\nname", linked.worktree.display())),
        PathBuf::from(format!("/{}", "x".repeat(4096))),
        PathBuf::from("relative"),
    ] {
        assert!(matches!(
            GitSourceObserver::new_linked(
                "c".into(),
                "s".into(),
                worktree,
                linked.private.clone(),
                linked.common.clone(),
                script.clone(),
                vec!["file".into()]
            ),
            Err(Issue::Unavailable)
        ));
    }
    use std::os::unix::ffi::OsStringExt;
    let non_utf8 = PathBuf::from(std::ffi::OsString::from_vec(b"/tmp/invalid-\xff".to_vec()));
    assert!(matches!(
        GitSourceObserver::new_linked(
            "c".into(),
            "s".into(),
            non_utf8,
            linked.private.clone(),
            linked.common.clone(),
            script.clone(),
            vec!["file".into()]
        ),
        Err(Issue::Unavailable)
    ));
    // A protected directory replaced by a symlink must invalidate an already installed observer.
    for directory in [&linked.worktree, &linked.private, &linked.common] {
        let saved = directory.with_extension("saved-directory");
        fs::rename(directory, &saved).unwrap();
        std::os::unix::fs::symlink(&saved, directory).unwrap();
        let result = observe_committed_source(&intake, &binding, &request, "owner");
        fs::remove_file(directory).unwrap();
        fs::rename(saved, directory).unwrap();
        assert_eq!(result, Err(Issue::Unavailable));
        assert!(!r.0.join("git-was-run").exists());
    }
}

#[cfg(unix)]
#[test]
fn passive_config_subset_rejects_active_ambiguous_and_nonregular_controls() {
    let r = Repo::new();
    fs::write(r.0.join("file"), b"ok").unwrap();
    let commit = r.commit();
    let linked = r.linked(&commit);
    let (intake, db) = r.setup();
    let config_path = linked.common.join("config");
    passive_developer_config(&config_path);
    let config = fs::read(&config_path).unwrap();
    let request = selection(&commit, &["file"]);
    let script = forbidden_git(&r);
    let ordinary = GitSourceObserver::new(
        "c".into(),
        "s".into(),
        r.0.clone(),
        script.clone(),
        vec!["file".into()],
    )
    .unwrap();
    let linked_binding = linked.binding(script, &["file"]);
    let check = || {
        for binding in [&ordinary, &linked_binding] {
            unavailable_unchanged(&r, Some(&linked), &intake, binding, &request, &db);
        }
    };
    for unsupported in [
        "[include]\n path = /uninstalled\n",
        "[includeIf \"gitdir:/tmp/\"]\n path = /uninstalled\n",
        "[extensions]\n worktreeConfig = true\n",
        "[core]\n hooksPath = /uninstalled\n",
        "[core]\n worktree = /uninstalled\n",
        "[filter \"f\"]\n smudge = /uninstalled\n",
        "[alias]\n inspect = !touch /uninstalled\n",
        "[credential]\n helper = /uninstalled\n",
        "[protocol \"file\"]\n allow = always\n",
        "[url \"/uninstalled\"]\n insteadOf = https://example.test\n",
        "[user]\n name = text\\\n[include]\n path = /uninstalled\n",
        "[user]\n email = \"dev\\t@example.test\"\n",
        "[user]\n name = \"unterminated\n",
        "[user]\n name = text ; unsupported inline comment\n",
        "[remote.origin]\n url = /uninstalled\n",
        "[branch main]\n remote = origin\n",
        "[user] trailing\n name = dev\n",
        "[ core ]\n",
        "[remote \"extra\" ]\n url = /uninstalled\n",
        "[core]\n bare = true\n",
        "[core]\n repositoryformatversion = 1\n",
        "[user]\n email = first\n email = second\n",
    ] {
        fs::write(
            &config_path,
            [config.as_slice(), unsupported.as_bytes()].concat(),
        )
        .unwrap();
        check();
    }
    malformed_controls(&config_path, check);
    fs::write(&config_path, vec![b'#'; 16_385]).unwrap();
    check();
    fs::write(&config_path, &config).unwrap();
    for path in [
        linked.common.join("config.worktree"),
        linked.private.join("config.worktree"),
    ] {
        fs::write(&path, b"[core]\n hooksPath = /uninstalled\n").unwrap();
        // Private config need not steer the common reader, but the linked profile refuses it.
        unavailable_unchanged(&r, Some(&linked), &intake, &linked_binding, &request, &db);
        fs::remove_file(path).unwrap();
    }
    assert!(!r.0.join("git-was-run").exists());
}

#[cfg(unix)]
#[test]
fn linked_store_exclusions_and_exact_object_identity_remain_required() {
    let r = Repo::new();
    fs::write(r.0.join("file"), b"good").unwrap();
    let commit = r.commit();
    let linked = r.linked(&commit);
    let (intake, db) = r.setup();
    let request = selection(&commit, &["file"]);
    let binding = linked.binding(PathBuf::from("/usr/bin/git"), &["file"]);
    let forbidden = linked.binding(forbidden_git(&r), &["file"]);
    for name in [
        "commondir",
        "shallow",
        "objects/info/alternates",
        "objects/info/http-alternates",
        "objects/pack/test.promisor",
    ] {
        let path = linked.common.join(name);
        fs::write(&path, b"/uninstalled\n").unwrap();
        unavailable_unchanged(&r, Some(&linked), &intake, &forbidden, &request, &db);
        fs::remove_file(path).unwrap();
    }
    // Missing common store is not tree-proven absence and must fail before any object command.
    let objects = linked.common.join("objects");
    let saved = linked.common.join("saved-objects");
    fs::rename(&objects, &saved).unwrap();
    unavailable_unchanged(&r, Some(&linked), &intake, &forbidden, &request, &db);
    fs::rename(saved, objects).unwrap();
    assert!(!r.0.join("git-was-run").exists());
    let oid = String::from_utf8(git(&r.0, &["rev-parse", &format!("{commit}:file")]))
        .unwrap()
        .trim()
        .to_owned();
    let object = linked
        .common
        .join("objects")
        .join(&oid[..2])
        .join(&oid[2..]);
    let original = fs::read(&object).unwrap();
    fs::remove_file(&object).unwrap();
    unavailable_unchanged(&r, Some(&linked), &intake, &binding, &request, &db);
    // A well-formed blob with different bytes under the original ID is also unavailable.
    fs::write(r.0.join("file"), b"evil").unwrap();
    let next = r.commit();
    let different = String::from_utf8(git(&r.0, &["rev-parse", &format!("{next}:file")]))
        .unwrap()
        .trim()
        .to_owned();
    fs::copy(
        linked
            .common
            .join("objects")
            .join(&different[..2])
            .join(&different[2..]),
        &object,
    )
    .unwrap();
    unavailable_unchanged(&r, Some(&linked), &intake, &binding, &request, &db);
    fs::remove_file(&object).unwrap();
    fs::write(object, original).unwrap();
    assert!(observe_committed_source(&intake, &binding, &request, "owner").is_ok());
}

#[cfg(unix)]
#[test]
fn ordinary_source_directory_preserves_native_bytes() {
    use std::ffi::OsString;
    use std::os::unix::ffi::OsStringExt;

    let parent = Repo::new();
    let approved = Repo(
        parent.0.join(OsString::from_vec(b"source-\xff".to_vec())),
        std::cell::RefCell::new(Vec::new()),
    );
    let foreign = Repo(
        parent.0.join("source-\u{fffd}"),
        std::cell::RefCell::new(Vec::new()),
    );
    assert_ne!(approved.0, foreign.0);
    assert_eq!(approved.0.to_string_lossy(), foreign.0.to_string_lossy());
    for path in [&approved.0, &foreign.0] {
        fs::create_dir(path).unwrap();
        git(path, &["init", "-q"]);
    }
    fs::write(approved.0.join("file"), b"approved source").unwrap();
    let approved_commit = approved.commit();
    fs::write(foreign.0.join("file"), b"foreign source").unwrap();
    let foreign_commit = foreign.commit();
    let absent = Command::new("/usr/bin/git")
        .arg("--git-dir")
        .arg(approved.0.join(".git"))
        .args(["cat-file", "-e", &foreign_commit])
        .output()
        .unwrap();
    assert!(
        !absent.status.success(),
        "foreign commit must be absent from approved store"
    );

    let (intake, db) = approved.setup();
    let binding = approved.binding(&["file"]);
    let before = snapshot(&parent.0);
    let store_before = fs::read(&db).unwrap();
    let actual = observe_committed_source(
        &intake,
        &binding,
        &selection(&approved_commit, &["file"]),
        "owner",
    );
    let foreign_result = observe_committed_source(
        &intake,
        &binding,
        &selection(&foreign_commit, &["file"]),
        "owner",
    );
    assert_eq!(before, snapshot(&parent.0));
    assert_eq!(store_before, fs::read(&db).unwrap());
    let fixture_path = parent.0.clone();
    drop(intake);
    drop(approved);
    drop(foreign);
    drop(parent);
    assert!(
        !fixture_path.exists(),
        "fixture repositories must be removed"
    );
    assert!(!Path::new(&db).exists(), "fixture intake must be removed");
    assert_eq!(
        foreign_result,
        Err(Issue::Unavailable),
        "never attribute a lossy-path sibling to the installed source"
    );
    let actual = actual.expect("approved native-byte path must remain usable");
    assert_eq!(actual.container_id, "c");
    assert_eq!(actual.source_id, "s");
    assert_eq!(actual.commit, approved_commit);
    assert!(
        matches!(&actual.paths[0].1, PathResult::Present(file) if file.bytes == b"approved source")
    );
}
