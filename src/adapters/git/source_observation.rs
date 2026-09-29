//! Restricted local Git object reader. Not OS containment: host protects executable and repository.
use crate::{
    kernel::state::source_observation::{
        self, CommittedObservation, ObservationIssue as Issue, ObservedFile, PathResult,
        SourceSelection, MAX_FILE, MAX_TOTAL,
    },
    ports::source_observer::SourceObserver,
};
use std::{
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread,
    time::{Duration, Instant},
};

const DEADLINE: Duration = Duration::from_secs(8);
const MAX_META: usize = 2_097_152;
const MAX_DIAGNOSTIC: usize = 16_384;
const MAX_CONTROL: usize = 8_192;
const MAX_DIRECTORY: usize = 4_096;

pub struct GitSourceObserver {
    container: String,
    source: String,
    repository: PathBuf,
    object_directory: PathBuf,
    linked_directory: Option<PathBuf>,
    git: PathBuf,
    allowed: Vec<String>,
    cancelled: Option<Arc<AtomicBool>>,
}

impl GitSourceObserver {
    /// All arguments are installed by a trusted host, not accepted from a proposal or source file.
    pub fn new(
        container: String,
        source: String,
        repository: PathBuf,
        git: PathBuf,
        allowed: Vec<String>,
    ) -> Result<Self, Issue> {
        if !crate::kernel::containers::intake::identifier(&container)
            || !crate::kernel::containers::intake::identifier(&source)
            || allowed.len() > 4096
            || allowed.iter().map(String::len).sum::<usize>() > MAX_META
            || allowed.iter().any(|p| !source_observation::valid_path(p))
            || allowed
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len()
                != allowed.len()
            || !repository.is_absolute()
            || !git.is_absolute()
            || !plain_path(&repository)
            || !plain_path(&git)
            || !git.is_file()
        {
            return Err(Issue::Unavailable);
        }
        Ok(Self {
            container,
            source,
            object_directory: repository.join(".git"),
            repository,
            linked_directory: None,
            git,
            allowed,
            cancelled: None,
        })
    }

    /// The host independently installs all three directories; pointers only confirm that binding.
    pub fn new_linked(
        container: String,
        source: String,
        worktree: PathBuf,
        git_directory: PathBuf,
        common_directory: PathBuf,
        git: PathBuf,
        allowed: Vec<String>,
    ) -> Result<Self, Issue> {
        linked_topology(&worktree, &git_directory, &common_directory)?;
        let mut observer = Self::new(container, source, worktree, git, allowed)?;
        observer.object_directory = common_directory;
        observer.linked_directory = Some(git_directory);
        Ok(observer)
    }

    /// Host can cancel an in-flight read; the child process group is terminated.
    pub fn with_cancellation(mut self, flag: Arc<AtomicBool>) -> Self {
        self.cancelled = Some(flag);
        self
    }

    fn cancelled(&self) -> bool {
        self.cancelled
            .as_ref()
            .is_some_and(|flag| flag.load(Ordering::Relaxed))
    }

    fn inspect(&self, deadline: Instant) -> Result<(), Issue> {
        let dot = &self.object_directory;
        if let Some(private) = &self.linked_directory {
            linked_topology(&self.repository, private, dot)?;
            require_missing(&private.join("config.worktree"))?;
        }
        if !self.repository.is_dir()
            || !dot.is_dir()
            || !plain_path(dot)
            || !plain_path(&dot.join("objects"))
            || !dot.join("objects").is_dir()
        {
            return Err(Issue::Unavailable);
        }
        // This is a small passive subset, not Git's general config language. Never hide a
        // directive in ignored escapes/continuations or permit source-selected executables.
        passive_config(&read_regular(&dot.join("config"), MAX_DIAGNOSTIC)?)?;
        for name in [
            "commondir",
            "config.worktree",
            "shallow",
            "objects/info/alternates",
            "objects/info/http-alternates",
        ] {
            require_missing(&dot.join(name))?;
        }
        // No external object links or promisor packs. Finite scan; huge stores unavailable.
        let mut budget = 100_000;
        scan_objects(
            &dot.join("objects"),
            0,
            &mut budget,
            deadline,
            self.cancelled.as_deref(),
        )?;
        Ok(())
    }

    fn git(&self, args: &[&str], limit: usize, deadline: Instant) -> Result<Vec<u8>, Issue> {
        self.git_input(args, None, limit, deadline)
    }

    fn git_input(
        &self,
        args: &[&str],
        input: Option<&[u8]>,
        limit: usize,
        deadline: Instant,
    ) -> Result<Vec<u8>, Issue> {
        if Instant::now() >= deadline || self.cancelled() {
            return Err(Issue::Unavailable);
        }
        let mut cmd = Command::new(&self.git);
        cmd.arg("--git-dir")
            .arg(&self.object_directory)
            .args(args)
            .current_dir(&self.repository)
            .env_clear()
            .env("GIT_CONFIG_NOSYSTEM", "1")
            .env("GIT_CONFIG_GLOBAL", "/dev/null")
            .env("GIT_CONFIG_SYSTEM", "/dev/null")
            .env("GIT_NO_REPLACE_OBJECTS", "1")
            .env("GIT_NO_LAZY_FETCH", "1")
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_PAGER", "cat")
            .stdin(if input.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            cmd.process_group(0);
        }
        let mut child = cmd.spawn().map_err(|_| Issue::Unavailable)?;
        let mut workers = Vec::new();
        // All exits after spawn pass through cleanup, including pipe/worker failures.
        let result = (|| {
            let out = child.stdout.take().ok_or(Issue::Unavailable)?;
            let err = child.stderr.take().ok_or(Issue::Unavailable)?;
            let (tx, rx) = mpsc::channel();
            let mut result = [None, None, Some(Vec::new())];
            if let Some(input) = input {
                let mut pipe = child.stdin.take().ok_or(Issue::Unavailable)?;
                let data = input.to_vec();
                let tx = tx.clone();
                result[2] = None;
                workers.push(thread::spawn(move || {
                    let written = pipe.write_all(&data).ok().map(|()| Vec::new());
                    drop(pipe);
                    let _ = tx.send((2, written));
                }));
            }
            for (index, pipe, cap) in [
                (0, Box::new(out) as Box<dyn Read + Send>, limit),
                (1, Box::new(err) as Box<dyn Read + Send>, MAX_DIAGNOSTIC),
            ] {
                let tx = tx.clone();
                workers.push(thread::spawn(move || {
                    let mut data = Vec::new();
                    let read = pipe.take((cap + 1) as u64).read_to_end(&mut data);
                    let value = if read.is_ok() && data.len() <= cap {
                        Some(data)
                    } else {
                        None
                    };
                    let _ = tx.send((index, value));
                }));
            }
            drop(tx);
            while result.iter().any(Option::is_none) {
                if self.cancelled() || Instant::now() >= deadline {
                    return Err(Issue::Unavailable);
                }
                let remaining = deadline
                    .saturating_duration_since(Instant::now())
                    .min(Duration::from_millis(10));
                match rx.recv_timeout(remaining) {
                    Ok((index, Some(data))) => result[index] = Some(data),
                    Ok((_, None)) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                        return Err(Issue::Unavailable)
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                }
            }
            while Instant::now() < deadline && !self.cancelled() {
                match child.try_wait() {
                    Ok(Some(status)) if status.success() => {
                        return result[0].take().ok_or(Issue::Unavailable)
                    }
                    Ok(Some(_)) | Err(_) => return Err(Issue::Unavailable),
                    Ok(None) => thread::sleep(Duration::from_millis(5)),
                }
            }
            Err(Issue::Unavailable)
        })();
        // EOF and a reaped leader do not prove that its process group is settled.
        let settled = terminate(&mut child);
        let until = Instant::now() + Duration::from_millis(500);
        while workers.iter().any(|worker| !worker.is_finished()) && Instant::now() < until {
            thread::sleep(Duration::from_millis(5));
        }
        let mut joined = true;
        for worker in workers {
            if !worker.is_finished() || worker.join().is_err() {
                joined = false;
            }
        }
        if settled.is_err() || !joined || self.cancelled() || Instant::now() >= deadline {
            return Err(Issue::Unavailable);
        }
        result
    }

    fn object(
        &self,
        kind: &str,
        oid: &str,
        cap: usize,
        deadline: Instant,
    ) -> Result<Vec<u8>, Issue> {
        let bytes = self.git(&["cat-file", kind, oid], cap, deadline)?;
        // cat-file can return readable corrupt bytes under an old object ID. Hash the exact
        // captured bytes with Git's object header/algorithm, without writing an object.
        let digest = self.git_input(
            &["hash-object", "--no-filters", "-t", kind, "--stdin"],
            Some(&bytes),
            128,
            deadline,
        )?;
        if !digest
            .strip_suffix(b"\n")
            .is_some_and(|hash| hash.eq_ignore_ascii_case(oid.as_bytes()))
        {
            return Err(Issue::Unavailable);
        }
        Ok(bytes)
    }

    fn capture(&self, selection: &SourceSelection) -> Result<CommittedObservation, Issue> {
        // Process-group descendant cleanup is only supported on Unix in this profile.
        #[cfg(not(unix))]
        {
            let _ = selection;
            return Err(Issue::Unavailable);
        }
        let deadline = Instant::now() + DEADLINE;
        self.inspect(deadline)?;
        if self.cancelled() {
            return Err(Issue::Unavailable);
        }
        let format = self.git(&["rev-parse", "--show-object-format"], 64, deadline)?;
        let oid_len = match format.as_slice() {
            b"sha1\n" => 40,
            b"sha256\n" => 64,
            _ => return Err(Issue::Unavailable),
        };
        if selection.commit.len() != oid_len {
            return Err(Issue::Unavailable);
        }
        let header = self.object("commit", &selection.commit, MAX_META, deadline)?;
        let first = header
            .split(|b| *b == b'\n')
            .next()
            .ok_or(Issue::Unavailable)?;
        let tree = std::str::from_utf8(first.strip_prefix(b"tree ").ok_or(Issue::Unavailable)?)
            .map_err(|_| Issue::Unavailable)?;
        if tree.len() != oid_len || !source_observation::valid_oid(tree) {
            return Err(Issue::Unavailable);
        }
        let mut total = 0;
        let mut paths = Vec::with_capacity(selection.paths.len());
        for path in &selection.paths {
            let mut current = tree.to_owned();
            let mut value = None;
            let segments: Vec<_> = path.split('/').collect();
            for (i, segment) in segments.iter().enumerate() {
                // Derive the next edge from verified bytes, not a second mutable-object read.
                let tree_bytes = self.object("tree", &current, MAX_META, deadline)?;
                let Some((mode, oid)) = tree_entry(&tree_bytes, segment, oid_len / 2)? else {
                    value = Some(PathResult::Absent);
                    break;
                };
                if i + 1 < segments.len() {
                    if mode != 0o040000 {
                        return Err(Issue::Unavailable);
                    }
                    current = oid;
                } else {
                    if !matches!(mode, 0o100644 | 0o100755) {
                        return Err(Issue::Unavailable);
                    }
                    let size = self.git(&["cat-file", "-s", &oid], 32, deadline)?;
                    let size = std::str::from_utf8(&size)
                        .map_err(|_| Issue::Unavailable)?
                        .trim_end_matches('\n')
                        .parse::<usize>()
                        .map_err(|_| Issue::Unavailable)?;
                    if size > MAX_FILE || size > MAX_TOTAL.saturating_sub(total) {
                        return Err(Issue::Unavailable);
                    }
                    let bytes = self.object("blob", &oid, size, deadline)?;
                    if bytes.len() != size {
                        return Err(Issue::Unavailable);
                    }
                    total += size;
                    value = Some(PathResult::Present(ObservedFile {
                        fingerprint: source_observation::fingerprint(&bytes),
                        bytes,
                        executable: mode == 0o100755,
                        object_id: oid,
                    }));
                }
            }
            paths.push((path.clone(), value.ok_or(Issue::Unavailable)?));
        }
        if self.cancelled() || Instant::now() >= deadline {
            return Err(Issue::Unavailable);
        }
        Ok(CommittedObservation {
            container_id: selection.container_id.clone(),
            source_id: selection.source_id.clone(),
            commit: selection.commit.clone(),
            paths,
        })
    }
}

impl SourceObserver for GitSourceObserver {
    fn container_id(&self) -> &str {
        &self.container
    }
    fn source_id(&self) -> &str {
        &self.source
    }
    fn allowed_paths(&self) -> &[String] {
        &self.allowed
    }
    fn observe(&self, selection: &SourceSelection) -> Result<CommittedObservation, Issue> {
        self.capture(selection)
    }
}

fn tree_entry(
    mut bytes: &[u8],
    selected: &str,
    hash_len: usize,
) -> Result<Option<(u32, String)>, Issue> {
    let mut found = None;
    while !bytes.is_empty() {
        let space = bytes
            .iter()
            .position(|b| *b == b' ')
            .ok_or(Issue::Unavailable)?;
        let mode = std::str::from_utf8(&bytes[..space]).map_err(|_| Issue::Unavailable)?;
        let mode = u32::from_str_radix(mode, 8).map_err(|_| Issue::Unavailable)?;
        bytes = &bytes[space + 1..];
        let nul = bytes
            .iter()
            .position(|b| *b == 0)
            .ok_or(Issue::Unavailable)?;
        let name = &bytes[..nul];
        let rest = &bytes[nul + 1..];
        if name.is_empty() || name.contains(&b'/') || rest.len() < hash_len {
            return Err(Issue::Unavailable);
        }
        if name == selected.as_bytes() {
            if found.is_some() {
                return Err(Issue::Unavailable);
            }
            let oid = rest[..hash_len]
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect();
            found = Some((mode, oid));
        }
        bytes = &rest[hash_len..];
    }
    Ok(found)
}

fn linked_topology(worktree: &Path, private: &Path, common: &Path) -> Result<(), Issue> {
    if ![worktree, private, common]
        .into_iter()
        .all(linked_directory)
        || common.file_name() != Some(std::ffi::OsStr::new(".git"))
        || private.parent() != Some(common.join("worktrees").as_path())
    {
        return Err(Issue::Unavailable);
    }
    // Equality against independently installed paths, never resolution of source instructions.
    for (path, expected) in [
        (
            worktree.join(".git"),
            format!("gitdir: {}\n", private.display()),
        ),
        (
            private.join("gitdir"),
            format!("{}\n", worktree.join(".git").display()),
        ),
        (private.join("commondir"), "../..\n".into()),
    ] {
        if read_regular(&path, MAX_CONTROL)? != expected.as_bytes() {
            return Err(Issue::Unavailable);
        }
    }
    Ok(())
}

fn linked_directory(path: &Path) -> bool {
    let Some(text) = path.to_str() else {
        return false;
    };
    text.len() <= MAX_DIRECTORY
        && !text.chars().any(char::is_control)
        && (text == "/"
            || text
                .split('/')
                .skip(1)
                .all(|part| !part.is_empty() && part != "." && part != ".."))
        && plain_path(path)
        && path.is_dir()
}

fn read_regular(path: &Path, limit: usize) -> Result<Vec<u8>, Issue> {
    let metadata = fs::symlink_metadata(path).map_err(|_| Issue::Unavailable)?;
    if !metadata.is_file() || metadata.len() > limit as u64 || !plain_path(path) {
        return Err(Issue::Unavailable);
    }
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| Issue::Unavailable)?
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| Issue::Unavailable)?;
    if bytes.len() > limit {
        return Err(Issue::Unavailable);
    }
    Ok(bytes)
}

fn require_missing(path: &Path) -> Result<(), Issue> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        _ => Err(Issue::Unavailable),
    }
}

fn passive_config(bytes: &[u8]) -> Result<(), Issue> {
    let config = std::str::from_utf8(bytes).map_err(|_| Issue::Unavailable)?;
    let mut section = None;
    let mut format = false;
    let mut bare = false;
    let mut seen = std::collections::HashSet::new();
    for line in config.lines() {
        let line = line.trim_matches([' ', '\t']);
        if line.is_empty() || line.starts_with(['#', ';']) {
            continue;
        }
        if line.contains('\\') || line.chars().any(|c| c.is_control() && c != '\t') {
            return Err(Issue::Unavailable);
        }
        if line.starts_with('[') {
            section = Some(config_section(line)?);
            continue;
        }
        let (kind, name) = section.ok_or(Issue::Unavailable)?;
        let (key, value) = line.split_once('=').ok_or(Issue::Unavailable)?;
        let key = key.trim_matches([' ', '\t']).to_ascii_lowercase();
        let value = value.trim_matches([' ', '\t']);
        let value = if value.starts_with('"') {
            value
                .strip_prefix('"')
                .and_then(|v| v.strip_suffix('"'))
                .ok_or(Issue::Unavailable)?
        } else {
            if value.contains(['#', ';']) {
                return Err(Issue::Unavailable);
            }
            value
        };
        if value.is_empty()
            || value.contains('"')
            || value.chars().any(char::is_control)
            || !seen.insert((kind, name, key.clone()))
        {
            return Err(Issue::Unavailable);
        }
        match (kind, key.as_str()) {
            ("core", "repositoryformatversion") if value == "0" => format = true,
            ("core", "bare") if value == "false" => bare = true,
            ("core", "filemode" | "logallrefupdates" | "ignorecase" | "precomposeunicode")
                if value == "true" || value == "false" => {}
            ("user", "name" | "email")
            | ("remote", "url" | "fetch")
            | ("branch", "remote" | "merge" | "vscode-merge-base") => {}
            _ => return Err(Issue::Unavailable),
        }
    }
    if !format || !bare {
        return Err(Issue::Unavailable);
    }
    Ok(())
}

fn config_section(line: &str) -> Result<(&'static str, &str), Issue> {
    let inner = line
        .strip_prefix('[')
        .and_then(|v| v.strip_suffix(']'))
        .ok_or(Issue::Unavailable)?;
    if inner.eq_ignore_ascii_case("core") {
        return Ok(("core", ""));
    }
    if inner.eq_ignore_ascii_case("user") {
        return Ok(("user", ""));
    }
    let (kind, name) = inner.split_once([' ', '\t']).ok_or(Issue::Unavailable)?;
    let kind = if kind.eq_ignore_ascii_case("remote") {
        "remote"
    } else if kind.eq_ignore_ascii_case("branch") {
        "branch"
    } else {
        return Err(Issue::Unavailable);
    };
    let name = name
        .trim_start_matches([' ', '\t'])
        .strip_prefix('"')
        .and_then(|v| v.strip_suffix('"'))
        .ok_or(Issue::Unavailable)?;
    if name.is_empty() || name.contains('"') || name.chars().any(char::is_control) {
        return Err(Issue::Unavailable);
    }
    Ok((kind, name))
}

fn plain_path(path: &Path) -> bool {
    if !path.is_absolute() {
        return false;
    }
    let mut prefix = PathBuf::new();
    for component in path.components() {
        if matches!(component, Component::ParentDir | Component::CurDir) {
            return false;
        }
        prefix.push(component);
        if fs::symlink_metadata(&prefix).map_or(true, |m| m.file_type().is_symlink()) {
            return false;
        }
    }
    true
}

fn scan_objects(
    path: &Path,
    depth: usize,
    budget: &mut usize,
    deadline: Instant,
    cancelled: Option<&AtomicBool>,
) -> Result<(), Issue> {
    if depth > 3
        || Instant::now() >= deadline
        || cancelled.is_some_and(|flag| flag.load(Ordering::Relaxed))
    {
        return Err(Issue::Unavailable);
    }
    for entry in fs::read_dir(path).map_err(|_| Issue::Unavailable)? {
        if *budget == 0
            || Instant::now() >= deadline
            || cancelled.is_some_and(|flag| flag.load(Ordering::Relaxed))
        {
            return Err(Issue::Unavailable);
        }
        *budget -= 1;
        let entry = entry.map_err(|_| Issue::Unavailable)?;
        let kind = entry.file_type().map_err(|_| Issue::Unavailable)?;
        if kind.is_dir() {
            scan_objects(&entry.path(), depth + 1, budget, deadline, cancelled)?;
        } else if !kind.is_file() || entry.file_name().to_string_lossy().ends_with(".promisor") {
            return Err(Issue::Unavailable);
        }
    }
    Ok(())
}

fn terminate(child: &mut std::process::Child) -> Result<(), Issue> {
    #[cfg(unix)]
    {
        unsafe extern "C" {
            fn kill(pid: i32, signal: i32) -> i32;
        }
        let group = -(child.id() as i32);
        // Always settle the owned group, even after a successful/nonzero leader exit.
        unsafe {
            kill(group, 9);
        }
        let _ = child.kill();
        let until = Instant::now() + Duration::from_millis(500);
        loop {
            let reaped = matches!(child.try_wait(), Ok(Some(_)));
            // ESRCH means the group no longer exists. Permission/other errors are not proof.
            let gone = unsafe { kill(group, 0) } == -1
                && std::io::Error::last_os_error().raw_os_error() == Some(3);
            if reaped && gone {
                return Ok(());
            }
            if Instant::now() >= until {
                return Err(Issue::Unavailable);
            }
            thread::sleep(Duration::from_millis(5));
        }
    }
    #[cfg(not(unix))]
    {
        let _ = child.kill();
        Err(Issue::Unavailable)
    }
}
